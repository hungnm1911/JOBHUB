/**
 * Development-only demo Candidate seeder.
 *
 * Usage:
 *   node scripts/seed-candidate-demo.js
 *
 * Credentials printed at the end (local demo only).
 */
import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";

import APPLICATION_SOURCE from "../src/constants/application-source.js";
import APPLICATION_STATUS from "../src/constants/application-status.js";
import APPLICATION_SUBMITTED_CV_STORAGE from "../src/constants/application-submitted-cv-storage.js";
import CANDIDATE_CV_SOURCE_TYPE from "../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../src/constants/candidate-cv-uploaded-storage.js";
import CANDIDATE_CV_VISIBILITY from "../src/constants/candidate-cv-visibility.js";
import CLOUDINARY_FOLDER from "../src/constants/cloudinary-folder.js";
import JOB_INVITATION_STATUS from "../src/constants/job-invitation-status.js";
import JOB_STATUS from "../src/constants/job-status.js";
import NOTIFICATION_TYPE from "../src/constants/notification-type.js";
import USER_ROLE from "../src/constants/user-role.js";
import USER_STATUS from "../src/constants/user-status.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import config from "../src/config/index.js";
import MESSAGE_TYPE from "../src/constants/message-type.js";
import Application from "../src/models/application.model.js";
import CandidateCV from "../src/models/candidate-cv.model.js";
import Category from "../src/models/category.model.js";
import CompanyMember from "../src/models/company-member.model.js";
import Conversation from "../src/models/conversation.model.js";
import ExperienceLevel from "../src/models/experience-level.model.js";
import Job from "../src/models/job.model.js";
import JobInvitation from "../src/models/job-invitation.model.js";
import Message from "../src/models/message.model.js";
import Notification from "../src/models/notification.model.js";
import SavedJob from "../src/models/saved-job.model.js";
import User from "../src/models/user.model.js";
import {
  APPLICATION_CV_SNAPSHOT_STORAGE,
  captureGeneratedCvSnapshot,
} from "../src/services/cv-snapshot.service.js";
import { uploadFileBuffer } from "../src/services/file.service.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "../src/services/notification.service.js";
import { hashPassword } from "../src/utils/hash-password.js";

const DEMO = Object.freeze({
  email: "candidate.demo@jobhub.local",
  password: "Demo@123456",
  fullName: "Nguyễn Văn Demo",
  phoneNumber: "0901234567",
  dateOfBirth: new Date("1998-05-15T00:00:00.000Z"),
  avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=NVDemo",
});

const now = Date.now();
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days) => new Date(now + days * 24 * 60 * 60 * 1000);

const buildSeedPdfBuffer = async (label = "JOBHUB Demo CV") => {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  page.drawText(label, { x: 48, y: 780, size: 18 });
  page.drawText("Seeded PDF for local preview/download.", {
    x: 48,
    y: 750,
    size: 12,
  });
  return Buffer.from(await document.save());
};

const uploadSeedPdf = async ({ buffer, assetFolder, resourceType, deliveryType }) => {
  return uploadFileBuffer({
    buffer,
    assetFolder,
    resourceType,
    deliveryType,
  });
};

const buildGeneratedContent = () => ({
  personalInfo: {
    fullName: DEMO.fullName,
    email: DEMO.email,
    phone: DEMO.phoneNumber,
    displayLocation: "Hồ Chí Minh",
    links: ["https://github.com/jobhub-demo"],
    avatarUrl: DEMO.avatarUrl,
  },
  professionalSummary:
    "Frontend engineer với kinh nghiệm React, TypeScript và hệ thống tuyển dụng SaaS.",
  professionalSummaryHtml:
    "<p>Frontend engineer với kinh nghiệm React, TypeScript và hệ thống tuyển dụng SaaS.</p>",
  educations: [
    {
      institutionName: "Đại học Bách Khoa TP.HCM",
      degree: "Cử nhân",
      fieldOfStudy: "Công nghệ thông tin",
      startDate: new Date("2016-09-01T00:00:00.000Z"),
      endDate: new Date("2020-06-30T00:00:00.000Z"),
    },
  ],
  skills: ["React", "TypeScript", "Node.js", "Tailwind CSS"],
  workExperiences: [
    {
      companyName: "JOBHUB Demo Soft",
      position: "Senior Frontend Engineer",
      startDate: new Date("2022-01-01T00:00:00.000Z"),
      endDate: null,
      description: "Xây dựng dashboard ứng viên và luồng tìm việc.",
      descriptionHtml: "<p>Xây dựng dashboard ứng viên và luồng tìm việc.</p>",
      achievements: ["Ship Candidate Dashboard", "Cải thiện UX tìm việc"],
    },
  ],
  projects: [
    {
      name: "Candidate Dashboard",
      role: "Frontend Lead",
      technologies: ["React", "Tailwind"],
      description: "Dashboard tổng quan cho ứng viên JOBHUB.",
      descriptionHtml: "<p>Dashboard tổng quan cho ứng viên JOBHUB.</p>",
      projectUrl: null,
    },
  ],
  certifications: [
    {
      name: "AWS Cloud Practitioner",
      issuer: "Amazon",
      issueDate: new Date("2024-03-01T00:00:00.000Z"),
      expirationDate: null,
      credentialId: "AWS-DEMO-001",
      credentialUrl: null,
    },
  ],
  languages: [
    { name: "Tiếng Việt", proficiency: "NATIVE" },
    { name: "English", proficiency: "ADVANCED" },
  ],
  hiddenSections: [],
});

const buildSubmittedSnapshot = async (cv) => {
  if (cv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    const { snapshot } = await captureGeneratedCvSnapshot({
      candidateCv: {
        ...cv.toObject(),
        generatedContent: cv.generatedContent ?? buildGeneratedContent(),
      },
      storage: APPLICATION_CV_SNAPSHOT_STORAGE,
    });
    return snapshot;
  }

  const pdfBuffer = await buildSeedPdfBuffer(cv.name);
  const stored = await uploadSeedPdf({
    buffer: pdfBuffer,
    assetFolder: APPLICATION_CV_SNAPSHOT_STORAGE.assetFolder,
    resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
    deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
  });

  return {
    sourceCandidateCvId: cv._id,
    name: cv.name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    pdfFile: {
      storageKey: stored.publicId,
      originalFileName: `${cv.name}.pdf`,
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: pdfBuffer.length,
      pageCount: 1,
    },
    capturedAt: new Date(),
  };
};

async function ensureCandidate() {
  let user = await User.findOne({ email: DEMO.email }).select("+passwordHash");
  const passwordHash = await hashPassword(DEMO.password);

  if (!user) {
    user = await User.create({
      fullName: DEMO.fullName,
      email: DEMO.email,
      passwordHash,
      role: USER_ROLE.CANDIDATE,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
      phoneNumber: DEMO.phoneNumber,
      dateOfBirth: DEMO.dateOfBirth,
      avatarUrl: DEMO.avatarUrl,
    });
  } else {
    user.fullName = DEMO.fullName;
    user.passwordHash = passwordHash;
    user.role = USER_ROLE.CANDIDATE;
    user.status = USER_STATUS.ACTIVE;
    user.emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    user.mustChangePassword = false;
    user.phoneNumber = DEMO.phoneNumber;
    user.dateOfBirth = DEMO.dateOfBirth;
    user.avatarUrl = DEMO.avatarUrl;
    await user.save();
  }

  return user;
}

async function resolveTaxonomy() {
  const category =
    (await Category.findOne({ level: "FIELD", parentCategoryId: null }).sort({
      createdAt: 1,
    })) ||
    (await Category.findOne({}).sort({ createdAt: 1 }));

  if (!category) {
    throw new Error(
      "Không tìm thấy Category trong DB. Hãy seed catalog/categories trước.",
    );
  }

  const experienceLevel =
    (await ExperienceLevel.findOne({ code: "THREE_TO_FIVE_YEARS" })) ||
    (await ExperienceLevel.findOne({}).sort({ createdAt: 1 }));

  return { category, experienceLevel };
}

async function wipeCandidateOwnedData(candidateUserId) {
  const applications = await Application.find({ candidateUserId }).select("_id");
  const applicationIds = applications.map((item) => item._id);
  const invitations = await JobInvitation.find({ candidateUserId }).select("_id");
  const invitationIds = invitations.map((item) => item._id);
  const conversations =
    applicationIds.length === 0
      ? []
      : await Conversation.find({ applicationId: { $in: applicationIds } }).select("_id");
  const conversationIds = conversations.map((item) => item._id);

  await Promise.all([
    conversationIds.length === 0
      ? Promise.resolve()
      : Message.deleteMany({ conversationId: { $in: conversationIds } }),
    conversationIds.length === 0
      ? Promise.resolve()
      : Conversation.deleteMany({ _id: { $in: conversationIds } }),
    Application.deleteMany({ candidateUserId }),
    CandidateCV.deleteMany({ candidateUserId }),
    SavedJob.deleteMany({ candidateUserId }),
    JobInvitation.deleteMany({ candidateUserId }),
    Notification.deleteMany({ recipientUserId: candidateUserId }),
  ]);

  return { applicationIds, invitationIds };
}

async function ensureCvs(candidate, taxonomy) {
  const common = {
    candidateUserId: candidate._id,
    visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
    categoryId: taxonomy.category._id,
    experienceLevelId: taxonomy.experienceLevel?._id ?? null,
    preferredLocations: [{ provinceCode: "79", districtCode: null }],
    skillTags: ["React", "TypeScript", "Node.js", "Tailwind"],
    employmentTypes: ["FULL_TIME"],
    workModes: ["HYBRID"],
    archivedAt: null,
  };

  const defaultCv = await CandidateCV.create({
    ...common,
    name: "CV Frontend chính",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    isDefault: true,
    generatedContent: buildGeneratedContent(),
  });

  const draftCv = await CandidateCV.create({
    ...common,
    name: "CV nháp Backend",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    isDefault: false,
    generatedContent: buildGeneratedContent(),
  });

  const uploadedPdfBuffer = await buildSeedPdfBuffer("CV PDF đã tải lên");
  const uploadedStored = await uploadSeedPdf({
    buffer: uploadedPdfBuffer,
    assetFolder: CLOUDINARY_FOLDER.CANDIDATE_UPLOADED_CVS,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });

  const uploadedCv = await CandidateCV.create({
    ...common,
    name: "CV PDF đã tải lên",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    isDefault: false,
    uploadedFile: {
      storageKey: uploadedStored.publicId,
      originalFileName: "nguyen-van-demo.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: uploadedPdfBuffer.length,
      pageCount: 1,
      uploadedAt: daysAgo(4),
    },
  });

  return { defaultCv, draftCv, uploadedCv };
}

async function loadDemoJobs() {
  const jobs = await Job.find({ status: JOB_STATUS.PUBLISHED })
    .sort({ publishedAt: -1, _id: -1 })
    .limit(8);

  if (jobs.length < 6) {
    throw new Error(
      `Cần ít nhất 6 Job PUBLISHED để seed đủ Applications + Invitations (hiện có ${jobs.length}). Hãy publish thêm Job hoặc chạy seed AI-V05 trước.`,
    );
  }

  return jobs;
}

async function ensureApplications(candidate, cvs, jobs) {
  const statuses = [
    APPLICATION_STATUS.APPLIED,
    APPLICATION_STATUS.SCREENING,
    APPLICATION_STATUS.CONTACTED,
    APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    APPLICATION_STATUS.HIRED,
    APPLICATION_STATUS.REJECTED,
  ];

  const created = [];
  for (let index = 0; index < Math.min(statuses.length, jobs.length); index += 1) {
    const job = jobs[index];
    const status = statuses[index];
    const cv = index % 2 === 0 ? cvs.defaultCv : cvs.uploadedCv;

    const application = await Application.create({
      candidateUserId: candidate._id,
      jobId: job._id,
      source: APPLICATION_SOURCE.DIRECT_APPLICATION,
      status: APPLICATION_STATUS.APPLIED,
      submittedCvSnapshot: await buildSubmittedSnapshot(cv),
      appliedAt: daysAgo(index + 1),
      withdrawnAt: null,
      withdrawReason: null,
      assignedRecruiterCompanyMemberId: null,
      version: 0,
    });

    if (status !== APPLICATION_STATUS.APPLIED || job.primaryRecruiterCompanyMemberId) {
      await Application.updateOne(
        { _id: application._id },
        {
          $set: {
            status,
            version: 1,
            assignedRecruiterCompanyMemberId:
              job.primaryRecruiterCompanyMemberId ?? null,
            ...(status === APPLICATION_STATUS.WITHDRAWN
              ? { withdrawnAt: daysAgo(1) }
              : {}),
          },
        },
      );
    }

    created.push(await Application.findById(application._id));
  }

  return created;
}

async function ensureSavedJobs(candidate, jobs) {
  const targets = jobs.slice(0, 5);
  for (const [index, job] of targets.entries()) {
    await SavedJob.create({
      candidateUserId: candidate._id,
      jobId: job._id,
      savedAt: daysAgo(index + 1),
    });
  }
  return targets.length;
}

async function ensureInvitations(candidate, cvs, jobs, applications = []) {
  const appliedJobIds = new Set(applications.map((item) => String(item.jobId)));
  const inviteJobs = jobs.filter((job) => !appliedJobIds.has(String(job._id))).slice(0, 3);
  const created = [];
  for (const [index, job] of inviteJobs.entries()) {
    let senderId = job.primaryRecruiterCompanyMemberId;
    if (!senderId) {
      const member = await CompanyMember.findOne({
        companyId: job.companyId,
        status: "ACTIVE",
      }).sort({ createdAt: 1 });
      senderId = member?._id;
    }
    if (!senderId) {
      continue;
    }

    const invitation = await JobInvitation.create({
      candidateUserId: candidate._id,
      invitedCvId: cvs.defaultCv._id,
      jobId: job._id,
      sentByRecruiterCompanyMemberId: senderId,
      greetingMessage: `Chào ${DEMO.fullName}, chúng tôi thấy hồ sơ của bạn phù hợp với vị trí ${job.title}.`,
      invitedCvSnapshot: await buildSubmittedSnapshot(cvs.defaultCv),
      status: JOB_INVITATION_STATUS.PENDING,
      sentAt: daysAgo(index + 2),
      expiresAt: daysFromNow(10 - index),
      acceptedAt: null,
      rejectedAt: null,
      revokedAt: null,
      invalidatedAt: null,
      invalidationReason: null,
    });
    created.push(invitation);
  }
  return created;
}

async function ensureConversations(candidate, applications) {
  let created = 0;

  for (const application of applications) {
    if (application.assignedRecruiterCompanyMemberId == null) {
      continue;
    }

    const assignee = await CompanyMember.findById(
      application.assignedRecruiterCompanyMemberId,
    ).select("userId");

    if (!assignee?.userId) {
      continue;
    }

    const [conversation] = await Conversation.create([
      { applicationId: application._id },
    ]);

    await Message.create([
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

    created += 1;
  }

  return created;
}

async function ensureNotifications(candidate, applications, invitations) {
  const payloads = [];

  if (applications[0]) {
    payloads.push({
      type: NOTIFICATION_TYPE.APPLICATION_STATUS_CHANGED,
      applicationId: applications[0]._id,
      content: `Đơn ứng tuyển của bạn đã chuyển sang trạng thái ${applications[0].status}.`,
    });
  }
  if (applications[3]) {
    payloads.push({
      type: NOTIFICATION_TYPE.INTERVIEW_AVAILABILITY_REQUESTED,
      applicationId: applications[3]._id,
      content: "Nhà tuyển dụng yêu cầu bạn gửi lịch rảnh để sắp xếp phỏng vấn.",
    });
  }
  if (applications[4]) {
    payloads.push({
      type: NOTIFICATION_TYPE.APPLICATION_HIRED,
      applicationId: applications[4]._id,
      content: "Chúc mừng! Một đơn ứng tuyển của bạn đã được nhận.",
    });
  }
  if (invitations[0]) {
    payloads.push({
      type: NOTIFICATION_TYPE.JOB_INVITATION_RECEIVED,
      jobInvitationId: invitations[0]._id,
      content: "Bạn nhận được lời mời ứng tuyển mới từ nhà tuyển dụng.",
    });
  }

  for (const [index, payload] of payloads.entries()) {
    const { event } = await createNotificationEvent({
      eventKey: `candidate-demo:${candidate._id}:${index}:${payload.type}`,
      type: payload.type,
      applicationId: payload.applicationId,
      jobInvitationId: payload.jobInvitationId,
      recipients: [
        {
          recipientUserId: candidate._id,
          content: payload.content,
        },
      ],
    });
    await materializeNotificationEvent({ eventId: event._id });
  }

  return payloads.length;
}

async function main() {
  if (config.env !== "development") {
    throw new Error("Script chỉ chạy khi NODE_ENV=development");
  }

  await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);

  const candidate = await ensureCandidate();
  const taxonomy = await resolveTaxonomy();
  await wipeCandidateOwnedData(candidate._id);
  const cvs = await ensureCvs(candidate, taxonomy);
  const jobs = await loadDemoJobs();
  const applications = await ensureApplications(candidate, cvs, jobs);
  const savedCount = await ensureSavedJobs(candidate, jobs);
  const invitations = await ensureInvitations(candidate, cvs, jobs, applications);
  const conversationCount = await ensureConversations(candidate, applications);
  const notificationCount = await ensureNotifications(
    candidate,
    applications,
    invitations,
  );

  const summary = {
    login: {
      email: DEMO.email,
      password: DEMO.password,
      url: `${config.frontendBaseUrl ?? "http://localhost:5173"}/login`,
      dashboard: `${config.frontendBaseUrl ?? "http://localhost:5173"}/candidate`,
    },
    seeded: {
      candidateId: String(candidate._id),
      cvs: 3,
      applications: applications.length,
      conversations: conversationCount,
      savedJobs: savedCount,
      invitations: invitations.length,
      notifications: notificationCount,
      jobsUsed: jobs.slice(0, 8).map((job) => ({
        id: String(job._id),
        title: job.title,
      })),
    },
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`seed-candidate-demo failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {});
  }
}
