import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  executeTrustedPreLifecycleApplicationHandoff,
  firstAssignApplication,
  forceReassignApplication,
  reassignApplication,
} from "../../src/services/application.service.js";
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
const APPLIED_AT = new Date("2026-08-13T08:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T08:00:00.000Z");

const TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s07.pdf",
    originalFileName: "v10-s07.pdf",
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
  title = "Backend Engineer",
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title,
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

const createAssignedApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
  status = APPLICATION_STATUS.APPLIED,
  version = 1,
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  const created = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  const update = {
    status,
    assignedRecruiterCompanyMemberId: assigneeMemberId,
    version,
  };

  if (status === APPLICATION_STATUS.WITHDRAWN) {
    update.withdrawnAt = new Date();
  }

  await Application.updateOne({ _id: created._id }, { $set: update });

  return Application.findById(created._id);
};

const createUnassignedAppliedApplication = async ({
  candidateUserId,
  jobId,
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  return Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });
};

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s07" } = {}) => {
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
  const supporting = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting@example.com`,
    fullName: "Supporting Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
    jobTitle: "Supporting Recruiter",
  });
  const supportingB = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting.b@example.com`,
    fullName: "Supporting Recruiter B",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-SB`,
    jobTitle: "Supporting Recruiter B",
  });
  const peer = await createActiveRecruiterContext({
    email: `${emailPrefix}.peer@example.com`,
    fullName: "Peer Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-PEER`,
    jobTitle: "Peer Recruiter",
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [
      supporting.membership._id,
      supportingB.membership._id,
    ],
  });

  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Slice 07 Candidate",
  });

  return {
    manager,
    primary,
    supporting,
    supportingB,
    peer,
    job,
    candidate,
  };
};

const markAssigneeIneligible = async (membershipId, mode) => {
  if (mode === "locked") {
    await CompanyMember.updateOne(
      { _id: membershipId },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );
    return;
  }

  if (mode === "off-team") {
    await Job.updateOne(
      { supportingRecruiterCompanyMemberIds: membershipId },
      { $pull: { supportingRecruiterCompanyMemberIds: membershipId } },
    );
  }
};

describe("V10 Slice 07 — Assignment/handoff lifecycle boundary foundation", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("1. recovery forced reassignment still works when Assignee is already ineligible", async () => {
    const { manager, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.recovery" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    await markAssigneeIneligible(supporting.membership._id, "locked");

    const result = await forceReassignApplication({
      actorUser: manager.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    expect(result.application.assignedRecruiterCompanyMemberId).toBe(
      supportingB.membership._id.toString(),
    );
    expect(result.application.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(result.application.version).toBe(2);
  });

  it("2. trusted pre-lifecycle handoff transfers A→B while A remains currently eligible", async () => {
    const { manager, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.prelife" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    const result = await executeTrustedPreLifecycleApplicationHandoff({
      companyId: manager.company._id,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
      verifiedOutgoingSubjectCompanyMemberId:
        supporting.membership._id.toString(),
    });

    expect(result.application.assignedRecruiterCompanyMemberId).toBe(
      supportingB.membership._id.toString(),
    );
    expect(result.application.version).toBe(2);

    const membership = await CompanyMember.findById(
      supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("3. public CM API ignores client-declared pre-lifecycle fields and may reassign an eligible Assignee", async () => {
    const agent = createTestAgent();
    const { manager, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.fakereason" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });
    const token = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });

    // Service ignores client-declared pre-lifecycle fields; public CM A → B
    // now uses canonical assignment management rather than recovery-only.
    const ignoredFieldsResult = await forceReassignApplication({
      actorUser: manager.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
      handoffMode: "pre-lifecycle",
      lifecycleReason: "LOCK",
      verifiedOutgoingSubjectCompanyMemberId:
        supporting.membership._id.toString(),
    });
    expect(ignoredFieldsResult.application.assignedRecruiterCompanyMemberId).toBe(
      supportingB.membership._id.toString(),
    );

    // Unknown client "reason" fields are rejected by the public contract body.
    const fakeReasonResponse = await agent
      .post(
        `/api/jobs/${job._id}/applications/${application._id}/force-reassign`,
      )
      .set("Authorization", `Bearer ${token}`)
      .send({
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 2,
        handoffMode: "pre-lifecycle",
        lifecycleReason: "TERMINATE",
        verifiedOutgoingSubjectCompanyMemberId:
          supporting.membership._id.toString(),
      });

    expect(fakeReasonResponse.status).toBe(400);

    const eligibleResponse = await agent
      .post(
        `/api/jobs/${job._id}/applications/${application._id}/force-reassign`,
      )
      .set("Authorization", `Bearer ${token}`)
      .send({
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 2,
      });

    expect(eligibleResponse.status).toBe(200);
    expect(eligibleResponse.body.application.assignedRecruiterCompanyMemberId)
      .toBe(supporting.membership._id.toString());
  });

  it("4. pre-lifecycle handoff preserves status, snapshot, and identity fields", async () => {
    const { manager, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.preserve" });
    const snapshot = buildUploadedSnapshot({ name: "Preserve Pre-Lifecycle" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
      status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      submittedCvSnapshot: snapshot,
    });
    const before = await Application.findById(application._id).lean();

    await executeTrustedPreLifecycleApplicationHandoff({
      companyId: manager.company._id,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
      verifiedOutgoingSubjectCompanyMemberId:
        supporting.membership._id.toString(),
    });

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
    expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
    expect(String(after.jobId)).toBe(String(before.jobId));
    expect(after.source).toBe(before.source);
    expect(after).not.toHaveProperty("forced");
    expect(after).not.toHaveProperty("lifecycleOperationId");
    expect(after).not.toHaveProperty("previousAssignee");
  });

  it("5. pre-lifecycle handoff works for non-terminal Applications on CLOSED and EXPIRED Jobs", async () => {
    for (const [index, status] of [
      JOB_STATUS.CLOSED,
      JOB_STATUS.EXPIRED,
    ].entries()) {
      const { manager, primary, supporting, supportingB, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: `v10.s07.joblife.${index}`,
        });
      const endedJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [
          supporting.membership._id,
          supportingB.membership._id,
        ],
        status,
        title: `Ended Job ${status}`,
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: endedJob._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });

      const result = await executeTrustedPreLifecycleApplicationHandoff({
        companyId: manager.company._id,
        jobId: endedJob._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId:
          supporting.membership._id.toString(),
      });

      expect(result.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(result.application.assignedRecruiterCompanyMemberId).toBe(
        supportingB.membership._id.toString(),
      );
      expect(result.job.status).toBe(status);
    }
  });

  it("6. terminal Applications cannot be administratively handed off", async () => {
    for (const [index, status] of TERMINAL_STATUSES.entries()) {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: `v10.s07.term.${index}`,
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status,
      });

      await expect(
        executeTrustedPreLifecycleApplicationHandoff({
          companyId: manager.company._id,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
          verifiedOutgoingSubjectCompanyMemberId:
            supporting.membership._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
  });

  it("7. pre-lifecycle target must pass the same First Assign/Reassign eligibility rules", async () => {
    const home = await setupCompanyWithTeam({ emailPrefix: "v10.s07.target" });
    const foreign = await setupCompanyWithTeam({
      emailPrefix: "v10.s07.target.foreign",
    });
    const application = await createAssignedApplication({
      candidateUserId: home.candidate.user._id,
      jobId: home.job._id,
      assigneeMemberId: home.supporting.membership._id,
    });

    await expect(
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: home.manager.company._id,
        jobId: home.job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: foreign.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          home.supporting.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId:
          home.supporting.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: home.manager.company._id,
        jobId: home.job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: home.peer.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          home.supporting.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId:
          home.supporting.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await CompanyMember.updateOne(
      { _id: home.supportingB.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: home.manager.company._id,
        jobId: home.job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: home.supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          home.supporting.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId:
          home.supporting.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("8. stale expected Assignee or version is rejected for pre-lifecycle handoff", async () => {
    const { manager, supporting, supportingB, primary, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.stale" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });

    await executeTrustedPreLifecycleApplicationHandoff({
      companyId: manager.company._id,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
      verifiedOutgoingSubjectCompanyMemberId:
        supporting.membership._id.toString(),
    });

    await expect(
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: manager.company._id,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 2,
        verifiedOutgoingSubjectCompanyMemberId:
          supporting.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: manager.company._id,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId:
          supportingB.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("9. concurrent normal Reassign and administrative handoff produce one canonical winner", async () => {
    const { manager, primary, supporting, supportingB, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.race" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });

    const results = await Promise.allSettled([
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: manager.company._id,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId:
          supporting.membership._id.toString(),
      }),
      reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      }),
    ]);

    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.statusCode).toBe(409);

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.version).toBe(2);
    expect([
      primary.membership._id.toString(),
      supportingB.membership._id.toString(),
    ]).toContain(String(persisted.assignedRecruiterCompanyMemberId));
  });

  it("10. First Assign/Reassign cannot commit onto a target that lost eligibility before commit", async () => {
    const assignCase = await setupCompanyWithTeam({
      emailPrefix: "v10.s07.assign.lost",
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: assignCase.candidate.user._id,
      jobId: assignCase.job._id,
    });
    await CompanyMember.updateOne(
      { _id: assignCase.supporting.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      firstAssignApplication({
        actorUser: assignCase.primary.user,
        jobId: assignCase.job._id.toString(),
        applicationId: unassigned._id.toString(),
        assigneeCompanyMemberId:
          assignCase.supporting.membership._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reassignCase = await setupCompanyWithTeam({
      emailPrefix: "v10.s07.reassign.lost",
    });
    const assigned = await createAssignedApplication({
      candidateUserId: reassignCase.candidate.user._id,
      jobId: reassignCase.job._id,
      assigneeMemberId: reassignCase.supporting.membership._id,
    });
    await CompanyMember.updateOne(
      { _id: reassignCase.supportingB.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      reassignApplication({
        actorUser: reassignCase.primary.user,
        jobId: reassignCase.job._id.toString(),
        applicationId: assigned._id.toString(),
        assigneeCompanyMemberId:
          reassignCase.supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          reassignCase.supporting.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const userInactiveCase = await setupCompanyWithTeam({
      emailPrefix: "v10.s07.user.lost",
    });
    const userAssigned = await createAssignedApplication({
      candidateUserId: userInactiveCase.candidate.user._id,
      jobId: userInactiveCase.job._id,
      assigneeMemberId: userInactiveCase.supporting.membership._id,
    });
    await User.updateOne(
      { _id: userInactiveCase.supportingB.user._id },
      { $set: { status: USER_STATUS.LOCKED } },
    );

    await expect(
      reassignApplication({
        actorUser: userInactiveCase.primary.user,
        jobId: userInactiveCase.job._id.toString(),
        applicationId: userAssigned._id.toString(),
        assigneeCompanyMemberId:
          userInactiveCase.supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          userInactiveCase.supporting.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects trusted pre-lifecycle handoff when verified subject does not match outgoing Assignee", async () => {
    const { manager, supporting, supportingB, primary, job, candidate } =
      await setupCompanyWithTeam({ emailPrefix: "v10.s07.subject" });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });

    await expect(
      executeTrustedPreLifecycleApplicationHandoff({
        companyId: manager.company._id,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
        verifiedOutgoingSubjectCompanyMemberId: primary.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
