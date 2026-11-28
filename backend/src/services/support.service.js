import mongoose from "mongoose";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../constants/company-member-status.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import NOTIFICATION_TYPE from "../constants/notification-type.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import User from "../models/user.model.js";
import SupportConversation from "../models/support-conversation.model.js";
import SupportMessage from "../models/support-message.model.js";
import { resolveCompanyManagerRecruiterManagementContext } from "./company.service.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "./notification.service.js";
import { emitSupportMessageToRecipients } from "../sockets/index.js";
import { escapeRegex } from "../utils/escape-regex.js";
import { paginationMetadata } from "../utils/list-query.js";
import AppError from "../utils/app-error.js";
import logger from "../utils/logger.js";

const toMessage = (message) => ({
  id: message.id,
  companyId: message.companyId,
  conversationId: message.conversationId,
  senderUserId: message.senderUserId,
  senderName: message.senderName,
  senderRole: message.senderRole,
  content: message.content,
  createdAt: message.createdAt,
});
const toConversation = (conversation, company) =>
  conversation
    ? {
        id: conversation.id,
        companyId: company._id,
        companyName: company.name,
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
      }
    : null;
const resolveSupportContext = async ({
  userId,
  companyId,
  session = null,
  sending = false,
}) => {
  const user = await User.findById(userId).session(session);
  if (!user || user.status !== USER_STATUS.ACTIVE || user.mustChangePassword)
    throw new AppError(403, "Active account required");
  let company;
  let membership;
  const isAdmin = user.role === USER_ROLE.PLATFORM_ADMIN;
  if (isAdmin) {
    company = mongoose.isValidObjectId(companyId)
      ? await Company.findById(companyId).session(session)
      : null;
    if (!company) throw new AppError(404, "Company not found");
  } else {
    const context = await resolveCompanyManagerRecruiterManagementContext({
      user,
      session,
      clientCompanyId: companyId,
    });
    ({ company, membership } = context);
  }
  if (
    sending &&
    (company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
      company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE)
  )
    throw new AppError(409, "Company support is read-only");
  return { user, company, membership, isAdmin };
};

// Real writes on the lifecycle guard documents serialize Send against lock and
// termination, then restore timestamps inside the transaction (no profile edit).
const acquireSupportGuard = async (model, filter, session) => {
  const before = await model.findOne(filter).session(session);
  if (!before) throw new AppError(409, "Support eligibility changed");
  const acquired = await model.updateOne(
    { ...filter, _id: before._id },
    { $set: { updatedAt: new Date(before.updatedAt.getTime() + 1) } },
    { session, timestamps: false },
  );
  if (!acquired.matchedCount)
    throw new AppError(409, "Support eligibility changed");
  await model.updateOne(
    { _id: before._id },
    { $set: { updatedAt: before.updatedAt } },
    { session, timestamps: false },
  );
};
const getSupportMessages = async ({ userId, companyId, options }) => {
  const context = await resolveSupportContext({ userId, companyId });
  const company = context.company;
  const conversation = await SupportConversation.findOne({
    companyId: company._id,
  });
  const filter = {
    companyId: company._id,
    ...(options.q
      ? { content: { $regex: escapeRegex(options.q), $options: "i" } }
      : {}),
  };
  const [messages, total] = await Promise.all([
    SupportMessage.find(filter)
      .sort(options.sort)
      .skip(options.skip)
      .limit(options.limit),
    SupportMessage.countDocuments(filter),
  ]);
  return {
    company: {
      id: company.id,
      name: company.name,
      approvalStatus: company.approvalStatus,
      operationalStatus: company.operationalStatus,
    },
    conversation: toConversation(conversation, company),
    messages: messages.map(toMessage),
    pagination: paginationMetadata(options, total),
  };
};
const listSupportConversations = async (options) => {
  const match = options.q
    ? { "company.name": { $regex: escapeRegex(options.q), $options: "i" } }
    : {};
  const [result] = await SupportConversation.aggregate([
    {
      $lookup: {
        from: Company.collection.name,
        localField: "companyId",
        foreignField: "_id",
        as: "company",
      },
    },
    { $unwind: "$company" },
    { $match: match },
    {
      $facet: {
        rows: [
          { $sort: options.sort },
          { $skip: options.skip },
          { $limit: options.limit },
        ],
        total: [{ $count: "value" }],
      },
    },
  ]);
  return {
    conversations: result.rows.map((row) =>
      toConversation({ ...row, id: String(row._id) }, row.company),
    ),
    pagination: paginationMetadata(options, result.total[0]?.value ?? 0),
  };
};
const sendSupportMessage = async ({
  userId,
  companyId,
  content,
  clientRequestId,
}) => {
  let committed;
  let eventId;
  let recipients = [];
  let realtimeRecipients = [];
  let context;
  // Unique conversation/message races abort a transaction: retry using fresh state.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        context = await resolveSupportContext({
          userId,
          companyId,
          session,
          sending: true,
        });
        const { company, user, membership, isAdmin } = context;
        await acquireSupportGuard(
          Company,
          {
            _id: company._id,
            approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
            operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
          },
          session,
        );
        if (membership)
          await acquireSupportGuard(
            CompanyMember,
            {
              _id: membership._id,
              status: COMPANY_MEMBER_STATUS.ACTIVE,
              role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
            },
            session,
          );
        await acquireSupportGuard(
          User,
          {
            _id: user._id,
            status: USER_STATUS.ACTIVE,
            mustChangePassword: false,
          },
          session,
        );
        const prior = await SupportMessage.findOne({
          companyId: company._id,
          senderUserId: user._id,
          clientRequestId,
        }).session(session);
        if (prior) {
          if (prior.content !== content)
            throw new AppError(
              409,
              "Request key already used with different content",
            );
          committed = prior;
          eventId = null;
          return;
        }
        let manager;
        if (isAdmin) {
          const member = await CompanyMember.findOne({
            companyId: company._id,
            role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
            status: COMPANY_MEMBER_STATUS.ACTIVE,
          }).session(session);
          manager = member
            ? await User.findOne({
                _id: member.userId,
                role: USER_ROLE.COMPANY_STAFF,
                status: USER_STATUS.ACTIVE,
                mustChangePassword: false,
              }).session(session)
            : null;
          if (!manager) throw new AppError(409, "No eligible Company Manager");
          await acquireSupportGuard(
            CompanyMember,
            { _id: member._id, status: COMPANY_MEMBER_STATUS.ACTIVE },
            session,
          );
          await acquireSupportGuard(
            User,
            {
              _id: manager._id,
              status: USER_STATUS.ACTIVE,
              mustChangePassword: false,
            },
            session,
          );
        }
        const admins = await User.find({
          role: USER_ROLE.PLATFORM_ADMIN,
          status: USER_STATUS.ACTIVE,
          _id: { $ne: user._id },
        })
          .select("_id")
          .session(session);
        recipients = isAdmin ? [manager._id] : admins.map((admin) => admin._id);
        realtimeRecipients = [
          ...admins.map((admin) => admin._id),
          ...recipients,
        ];
        const conversation = await SupportConversation.findOneAndUpdate(
          { companyId: company._id },
          { $set: { lastMessageAt: new Date() } },
          { upsert: true, returnDocument: "after", session },
        );
        [committed] = await SupportMessage.create(
          [
            {
              conversationId: conversation._id,
              companyId: company._id,
              senderUserId: user._id,
              senderName: user.fullName,
              senderRole: isAdmin
                ? USER_ROLE.PLATFORM_ADMIN
                : COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
              content,
              clientRequestId,
            },
          ],
          { session },
        );
        if (recipients.length) {
          const { event } = await createNotificationEvent({
            eventKey: `support:${committed.id}`,
            type: NOTIFICATION_TYPE.SUPPORT_MESSAGE_CREATED,
            actorUserId: user._id,
            companyId: company._id,
            supportMessageId: committed._id,
            recipients: recipients.map((recipientUserId) => ({
              recipientUserId,
              content: `${user.fullName}: ${content}`,
            })),
            session,
          });
          eventId = event._id;
        }
      });
      break;
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    } finally {
      await session.endSession();
    }
  }
  if (eventId) {
    try {
      await materializeNotificationEvent({ eventId });
    } catch (error) {
      logger.warn("Support notification pending recovery", { eventId, error });
    }
  }
  // Current eligibility is re-evaluated after commit, including for sender sessions.
  const onlineRecipients = [];
  for (const recipientId of [...realtimeRecipients, userId]) {
    try {
      await resolveSupportContext({
        userId: recipientId,
        companyId: context.company._id,
      });
      onlineRecipients.push(recipientId);
    } catch {
      /* Lifecycle changes may revoke realtime delivery after commit. */
    }
  }
  emitSupportMessageToRecipients({
    recipientUserIds: onlineRecipients,
    companyId: context.company._id,
    message: toMessage(committed),
  });
  const conversation = await SupportConversation.findById(
    committed.conversationId,
  );
  return {
    message: toMessage(committed),
    conversation: toConversation(conversation, context.company),
  };
};
export { getSupportMessages, listSupportConversations, sendSupportMessage };
