/**
 * Development-only: seed Conversation + Messages for existing demo Candidate applications.
 *
 * Usage:
 *   node scripts/seed-candidate-demo-conversations.js
 */
import MESSAGE_TYPE from "../src/constants/message-type.js";
import USER_ROLE from "../src/constants/user-role.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import config from "../src/config/index.js";
import Application from "../src/models/application.model.js";
import CompanyMember from "../src/models/company-member.model.js";
import Conversation from "../src/models/conversation.model.js";
import Message from "../src/models/message.model.js";
import User from "../src/models/user.model.js";

const DEMO_EMAIL = "candidate.demo@jobhub.local";

async function main() {
  if (config.env !== "development") {
    throw new Error("Script chỉ chạy khi NODE_ENV=development");
  }

  await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);

  const candidate = await User.findOne({
    email: DEMO_EMAIL,
    role: USER_ROLE.CANDIDATE,
  });

  if (!candidate) {
    throw new Error(
      `Không tìm thấy candidate demo (${DEMO_EMAIL}). Chạy seed-candidate-demo.js trước.`,
    );
  }

  const applications = await Application.find({
    candidateUserId: candidate._id,
    assignedRecruiterCompanyMemberId: { $ne: null },
  }).sort({ appliedAt: -1 });

  let createdConversations = 0;
  let createdMessages = 0;
  const details = [];

  for (const application of applications) {
    const existing = await Conversation.findOne({
      applicationId: application._id,
    });

    if (existing) {
      details.push({
        applicationId: String(application._id),
        status: application.status,
        skipped: "conversation already exists",
      });
      continue;
    }

    const assignee = await CompanyMember.findById(
      application.assignedRecruiterCompanyMemberId,
    ).select("userId");

    if (!assignee?.userId) {
      details.push({
        applicationId: String(application._id),
        status: application.status,
        skipped: "assignee user missing",
      });
      continue;
    }

    const [conversation] = await Conversation.create([
      { applicationId: application._id },
    ]);
    createdConversations += 1;

    const messages = await Message.create([
      {
        conversationId: conversation._id,
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: null,
        senderCompanyMemberId: null,
        content:
          "Hội thoại đã được mở khi nhà tuyển dụng nhận phụ trách đơn ứng tuyển.",
      },
      {
        conversationId: conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: assignee.userId,
        senderCompanyMemberId: assignee._id,
        content:
          "Xin chào, chúng tôi đã nhận hồ sơ của bạn và muốn trao đổi thêm về kinh nghiệm gần đây.",
      },
      {
        conversationId: conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: candidate._id,
        senderCompanyMemberId: null,
        content:
          "Cảm ơn anh/chị. Em sẵn sàng trao đổi và có thể gửi thêm portfolio nếu cần.",
      },
    ]);

    createdMessages += messages.length;
    details.push({
      applicationId: String(application._id),
      status: application.status,
      conversationId: String(conversation._id),
      messages: messages.length,
      detailUrl: `${config.frontendBaseUrl ?? "http://localhost:5173"}/candidate/applications/${application._id}`,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        candidateId: String(candidate._id),
        createdConversations,
        createdMessages,
        details,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `seed-candidate-demo-conversations failed: ${error.stack || error.message}\n`,
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
