import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import MESSAGE_TYPE from "../../src/constants/message-type.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  reassignApplication,
  sendCandidateApplicationConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessage,
  unassignApplication,
  withdrawApplication,
} from "../../src/services/application.service.js";
import {
  lockAccount,
  lockCompany,
} from "../../src/services/platform-admin.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-14T10:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T10:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v11-s06.pdf",
    originalFileName: "v11-s06.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  status = JOB_STATUS.PUBLISHED,
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Backend Engineer",
    jobDescription: "Build APIs",
    requiredSkills: ["Node.js"],
    salaryText: "1000-2000",
    fieldCategoryIds: [],
    positionCategoryIds: [],
    location: null,
    employmentType: null,
    workModes: [],
    experienceLevelId: null,
  });
};

const createUnassignedAppliedApplication = async ({
  candidateUserId,
  jobId,
}) => {
  return Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: buildUploadedSnapshot(),
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });
};

const installSendPreAcquireGate = (applicationId) => {
  let releaseGate;
  let signalReached;
  let hasGated = false;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });
  const reached = new Promise((resolve) => {
    signalReached = resolve;
  });

  const originalFindOne = Conversation.findOne.bind(Conversation);
  vi.spyOn(Conversation, "findOne").mockImplementation(function mockFindOne(
    ...args
  ) {
    const query = originalFindOne(...args);
    const originalExec = query.exec.bind(query);

    query.exec = async function mockExec(...execArgs) {
      const result = await originalExec(...execArgs);
      if (
        !hasGated &&
        result &&
        String(result.applicationId) === String(applicationId)
      ) {
        hasGated = true;
        signalReached();
        await gate;
      }
      return result;
    };

    return query;
  });

  return {
    release: () => releaseGate(),
    reached,
  };
};

const createAssignedConversationFixture = async ({
  emailPrefix,
  supporting = true,
} = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    fullName: "Primary Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-P`,
    jobTitle: "Lead Recruiter",
  });
  const supportingRecruiter = supporting
    ? await createActiveRecruiterContext({
        email: `${emailPrefix}.supporting@example.com`,
        fullName: "Supporting Recruiter",
        company: manager.company,
        employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
        jobTitle: "Supporting Recruiter",
      })
    : null;
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Conversation Candidate",
  });
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.platform@example.com`,
    fullName: "Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: supportingRecruiter
      ? [supportingRecruiter.membership._id]
      : [],
  });

  const application = await createUnassignedAppliedApplication({
    candidateUserId: candidate.user._id,
    jobId: job._id,
  });

  const assigned = await firstAssignApplication({
    actorUser: primary.user,
    jobId: job._id.toString(),
    applicationId: application._id.toString(),
    assigneeCompanyMemberId: primary.membership._id.toString(),
    expectedVersion: application.version,
  });

  const conversation = await Conversation.findOne({
    applicationId: application._id,
  });

  return {
    manager,
    primary,
    supportingRecruiter,
    candidate,
    platformAdmin,
    job,
    application: assigned.application,
    conversation,
  };
};

describe("V11 Slice 06 — NORMAL Message Send + Full Chat Concurrency", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lets Candidate and current Assignee send NORMAL Messages with historical sender identity (F02 / BR-13 / BR-14)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.ok",
    });
    const applicationBefore = await Application.findById(
      fixture.application.id,
    ).lean();

    const candidateSend =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "  Hello from candidate  ",
      });

    expect(candidateSend.message.type).toBe(MESSAGE_TYPE.NORMAL);
    expect(candidateSend.message.content).toBe("Hello from candidate");
    expect(candidateSend.message.senderUserId).toBe(
      fixture.candidate.user._id.toString(),
    );
    expect(candidateSend.message.senderCompanyMemberId).toBeNull();
    expect(candidateSend.conversation.mode).toBe("ACTIVE");
    expect(candidateSend.authority).toEqual({
      canRead: true,
      canSendNormal: true,
    });

    const recruiterSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "Hello from recruiter",
      });

    expect(recruiterSend.message.senderUserId).toBe(
      fixture.primary.user._id.toString(),
    );
    expect(recruiterSend.message.senderCompanyMemberId).toBe(
      fixture.primary.membership._id.toString(),
    );

    const applicationAfter = await Application.findById(
      fixture.application.id,
    ).lean();
    expect(applicationAfter.status).toBe(applicationBefore.status);
    expect(applicationAfter.version).toBe(applicationBefore.version);
    expect(String(applicationAfter.assignedRecruiterCompanyMemberId)).toBe(
      String(applicationBefore.assignedRecruiterCompanyMemberId),
    );
    expect(applicationAfter.candidateUserId.toString()).toBe(
      applicationBefore.candidateUserId.toString(),
    );
    expect(applicationAfter.jobId.toString()).toBe(
      applicationBefore.jobId.toString(),
    );
    expect(applicationAfter.source).toBe(applicationBefore.source);

    const messages = await Message.find({
      conversationId: fixture.conversation._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(messages).toHaveLength(2);
    expect(messages[0].senderCompanyMemberId).toBeNull();
    expect(String(messages[1].senderCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );

    const agent = createTestAgent();
    const candidateToken = await loginAndGetAccessToken(agent, {
      email: fixture.candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: fixture.primary.user.email,
      password: DEFAULT_PASSWORD,
    });

    const candidateHttp = await agent
      .post(
        `/api/candidate/applications/${fixture.application.id}/conversation/messages`,
      )
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({ content: "via http candidate" });
    expect(candidateHttp.status).toBe(201);
    expect(candidateHttp.body.message.senderCompanyMemberId).toBeNull();

    const recruiterHttp = await agent
      .post(
        `/api/jobs/my-applications/${fixture.application.id}/conversation/messages`,
      )
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ content: "via http recruiter" });
    expect(recruiterHttp.status).toBe(201);
    expect(recruiterHttp.body.message.senderCompanyMemberId).toBe(
      fixture.primary.membership._id.toString(),
    );

    const rejectedClientIdentity = await agent
      .post(
        `/api/candidate/applications/${fixture.application.id}/conversation/messages`,
      )
      .set("Authorization", `Bearer ${candidateToken}`)
      .send({
        content: "spoof",
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: fixture.primary.user._id.toString(),
      });
    expect(rejectedClientIdentity.status).toBe(400);
  });

  it("denies Send when UNASSIGNED, terminal, Company frozen, or actor is not current Assignee (BR-25 / BR-32 / BR-34 / BR-54)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.deny",
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "not assignee",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "ACTIVE" },
    });

    await unassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "after unassign",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "PAUSED_UNASSIGNED" },
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "former assignee",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "PAUSED_UNASSIGNED" },
    });

    const assignedAgain = await firstAssignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: (await Application.findById(fixture.application.id))
        .version,
    });

    const candidateOk =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "after assign again",
      });
    expect(candidateOk.conversation.mode).toBe("ACTIVE");

    await lockCompany({
      companyId: fixture.manager.company._id.toString(),
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "frozen company",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "FROZEN_COMPANY" },
    });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "frozen recruiter",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const other = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.send.terminal",
    });
    await withdrawApplication({
      candidateUserId: other.candidate.user._id,
      actorUser: other.candidate.user,
      applicationId: other.application.id,
      expectedVersion: other.application.version,
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: other.candidate.user._id,
        actorUser: other.candidate.user,
        applicationId: other.application.id,
        content: "terminal",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "READ_ONLY" },
    });

    expect(assignedAgain.application.assignedRecruiterCompanyMemberId).toBe(
      fixture.primary.membership._id.toString(),
    );
  });

  it("keeps Chat writable when Job is CLOSED or EXPIRED (F09 / BR-39 / BR-40)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.job.lifecycle",
    });

    await Job.findByIdAndUpdate(fixture.job._id, {
      $set: { status: JOB_STATUS.CLOSED },
    });

    const closedSend =
      await sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "still writable on closed job",
      });
    expect(closedSend.conversation.mode).toBe("ACTIVE");

    await Job.findByIdAndUpdate(fixture.job._id, {
      $set: { status: JOB_STATUS.EXPIRED },
    });

    const expiredSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "still writable on expired job",
      });
    expect(expiredSend.conversation.mode).toBe("ACTIVE");
  });

  it("locks Send in eligibility-loss window before Automatic Unassign completes (BR-43 / BR-55)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.elig.loss",
    });

    await User.findByIdAndUpdate(fixture.primary.user._id, {
      $set: { status: USER_STATUS.LOCKED },
    });

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "candidate during eligibility loss",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "ELIGIBILITY_LOSS_WINDOW" },
    });

    const stillAssigned = await Application.findById(fixture.application.id);
    expect(String(stillAssigned.assignedRecruiterCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: {
          ...fixture.primary.user.toObject(),
          status: USER_STATUS.LOCKED,
        },
        applicationId: fixture.application.id,
        content: "outgoing recruiter",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("TX-06: Reassign completing before Send rejects stale outgoing Recruiter Message (BR-41)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.reassign",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "stale outgoing send",
    });

    await gate.reached;

    await reassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.supportingRecruiter.membership._id.toString(),
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    const messages = await Message.find({
      conversationId: fixture.conversation._id,
      type: MESSAGE_TYPE.NORMAL,
    }).lean();
    expect(messages).toHaveLength(0);

    const newAssigneeSend =
      await sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.supportingRecruiter.user,
        applicationId: fixture.application.id,
        content: "new assignee after reassign",
      });
    expect(newAssigneeSend.message.senderCompanyMemberId).toBe(
      fixture.supportingRecruiter.membership._id.toString(),
    );
  });

  it("TX-06: Send completing before Reassign keeps Message and preserves sender (BR-13 / BR-41)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.send.wins",
    });

    const sent = await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "completed before reassign",
    });

    await reassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.supportingRecruiter.membership._id.toString(),
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    const persisted = await Message.findById(sent.message.id).lean();
    expect(persisted.content).toBe("completed before reassign");
    expect(String(persisted.senderUserId)).toBe(
      fixture.primary.user._id.toString(),
    );
    expect(String(persisted.senderCompanyMemberId)).toBe(
      fixture.primary.membership._id.toString(),
    );
  });

  it("TX-06: Unassign completing before Send rejects pending Candidate and Recruiter Messages (BR-25 / BR-42)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.unassign",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const candidateSendPromise =
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "stale after unassign",
      });

    await gate.reached;

    await unassignApplication({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    gate.release();

    await expect(candidateSendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);
  });

  it("TX-07: terminal Withdraw completing before Send rejects pending Message (BR-45)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.terminal",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "stale after withdraw",
    });

    await gate.reached;

    await withdrawApplication({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      expectedVersion: fixture.application.version,
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);
  });

  it("TX-08: Company lock completing before Send rejects pending Message (BR-44)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.company",
    });

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "stale after company lock",
    });

    await gate.reached;

    await lockCompany({
      companyId: fixture.manager.company._id.toString(),
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
      details: { mode: "FROZEN_COMPANY" },
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);
  });

  it("TX-06: Platform eligibility loss completing before Send rejects pending Message (BR-43)", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "v11.s06.race.platform",
      supporting: true,
    });

    expect(fixture.supportingRecruiter).toBeTruthy();

    const gate = installSendPreAcquireGate(fixture.application.id);

    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "stale after platform lock",
    });

    await gate.reached;

    await lockAccount({
      targetUserId: fixture.primary.user._id.toString(),
      actorUserId: fixture.platformAdmin.user._id,
    });

    gate.release();

    await expect(sendPromise).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(
      await Message.countDocuments({
        conversationId: fixture.conversation._id,
        type: MESSAGE_TYPE.NORMAL,
      }),
    ).toBe(0);

    const membership = await CompanyMember.findById(
      fixture.primary.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });
});
