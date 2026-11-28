import mongoose from "mongoose";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import NOTIFICATION_TYPE from "../constants/notification-type.js";
import Announcement from "../models/announcement.model.js";
import AnnouncementRecipient from "../models/announcement-recipient.model.js";
import User from "../models/user.model.js";
import Company from "../models/company.model.js";
import { createNotificationEvent, materializeNotificationEvent } from "./notification.service.js";
import AppError from "../utils/app-error.js";
import { escapeRegex } from "../utils/escape-regex.js";
import { paginationMetadata } from "../utils/list-query.js";
import logger from "../utils/logger.js";

const toAnnouncement = async (item) => {
  const [deliveredCount, failedCount, failure] = await Promise.all([
    AnnouncementRecipient.countDocuments({ announcementId: item._id, deliveredAt: { $ne: null } }),
    AnnouncementRecipient.countDocuments({ announcementId: item._id, deliveredAt: null, lastError: { $ne: null } }),
    AnnouncementRecipient.findOne({ announcementId: item._id, deliveredAt: null, lastError: { $ne: null } }).sort({ updatedAt: -1 }).select("lastError"),
  ]);
  return { id: item.id, title: item.title, content: item.content,
    authorUserId: item.authorUserId, publishedAt: item.publishedAt, createdAt: item.createdAt,
    totalRecipients: item.totalRecipients, deliveredCount, failedCount,
    lastError: failure?.lastError ?? null,
    status: deliveredCount === item.totalRecipients ? "COMPLETE" : "PENDING" };
};
const getAnnouncement = async (id) => {
  const item = mongoose.isValidObjectId(id) ? await Announcement.findById(id) : null;
  if (!item) throw new AppError(404, "Announcement not found");
  return toAnnouncement(item);
};
const listAnnouncements = async (options) => {
  const filter = options.q ? { $or: ["title", "content"].map((key) => ({ [key]: { $regex: escapeRegex(options.q), $options: "i" } })) } : {};
  const [items, total] = await Promise.all([
    Announcement.find(filter).sort(options.sort).skip(options.skip).limit(options.limit),
    Announcement.countDocuments(filter),
  ]);
  return { announcements: await Promise.all(items.map(toAnnouncement)), pagination: paginationMetadata(options, total) };
};
const publishAnnouncement = async ({ authorUserId, title, content, clientRequestId }) => {
  const identity = { authorUserId, clientRequestId };
  const replay = async () => {
    const existing = await Announcement.findOne(identity);
    if (!existing) return null;
    if (existing.title !== title || existing.content !== content) throw new AppError(409, "Request key already used with different content");
    return toAnnouncement(existing);
  };
  const prior = await replay();
  if (prior) return prior;
  const session = await mongoose.startSession();
  let id;
  try {
    await session.withTransaction(async () => {
      const author = await User.findOneAndUpdate({ _id: authorUserId, role: USER_ROLE.PLATFORM_ADMIN, status: USER_STATUS.ACTIVE },
        { $set: { status: USER_STATUS.ACTIVE } }, { session });
      if (!author) throw new AppError(403, "Active Platform Admin required");
      id = new mongoose.Types.ObjectId();
      let total = 0;
      let batch = [];
      const cursor = User.find({ status: USER_STATUS.ACTIVE, _id: { $ne: authorUserId } }).select("_id").session(session).cursor();
      for await (const user of cursor) {
        batch.push({ announcementId: id, recipientUserId: user._id });
        total += 1;
        if (batch.length === 200) { await AnnouncementRecipient.insertMany(batch, { session }); batch = []; }
      }
      if (batch.length) await AnnouncementRecipient.insertMany(batch, { session });
      await Announcement.create([{ _id: id, ...identity, title, content, publishedAt: new Date(), totalRecipients: total }], { session });
    }, { readConcern: { level: "snapshot" } });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const result = await replay();
    if (result) return result;
    throw error;
  } finally { await session.endSession(); }
  return getAnnouncement(id);
};

// Scheduling remains in the canonical Notification worker. Each pass is bounded.
const recoverAdminNotifications = async ({ limit = 100 } = {}) => {
  const submissions = await Company.find({ submittedAdminRecipients: { $type: "array" }, submittedAdminNotifiedAt: null }).sort({ submittedAt: 1 }).limit(limit);
  for (const company of submissions) {
    try {
      for (const recipientUserId of company.submittedAdminRecipients) {
        await createNotificationEvent({ eventKey: `company-submit:${company.id}:${recipientUserId}`,
          type: NOTIFICATION_TYPE.COMPANY_SUBMITTED, companyId: company._id,
          recipients: [{ recipientUserId, content: `Hồ sơ doanh nghiệp ${company.reviewSnapshot?.name ?? company.name} đang chờ xét duyệt.` }] });
      }
      await Company.updateOne({ _id: company._id, submittedAdminNotifiedAt: null }, { $set: { submittedAdminNotifiedAt: new Date() } }, { timestamps: false });
    } catch (error) { logger.warn("Admin submission notification recovery failed", { companyId: company.id, error }); }
  }
  const pending = await AnnouncementRecipient.find({ deliveredAt: null }).sort({ updatedAt: 1, _id: 1 }).limit(limit);
  for (const row of pending) {
    try {
      const item = await Announcement.findById(row.announcementId);
      if (!item) throw new Error("Announcement unavailable");
      const { event } = await createNotificationEvent({ eventKey: `announcement:${item.id}:${row.recipientUserId}`,
        type: NOTIFICATION_TYPE.PLATFORM_ANNOUNCEMENT, announcementId: item._id, actorUserId: item.authorUserId,
        recipients: [{ recipientUserId: row.recipientUserId, content: `${item.title}\n\n${item.content}` }] });
      const result = await materializeNotificationEvent({ eventId: event._id });
      if (!result?.materializedAt) throw new Error("Inbox materialization pending");
      await AnnouncementRecipient.updateOne({ _id: row._id }, { $set: { deliveredAt: new Date(), lastError: null }, $inc: { attempts: 1 } });
    } catch (error) {
      await AnnouncementRecipient.updateOne({ _id: row._id }, { $set: { lastError: "Không thể tạo inbox; hệ thống sẽ thử lại." }, $inc: { attempts: 1 } });
      logger.warn("Announcement delivery pending", { recipientId: row.id, error });
    }
  }
};
export { getAnnouncement, listAnnouncements, publishAnnouncement, recoverAdminNotifications };
