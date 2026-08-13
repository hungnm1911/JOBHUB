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
  firstAssignApplication,
  forceReassignApplication,
  listPrimaryJobApplications,
  reassignApplication,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
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
const APPLIED_AT = new Date("2026-08-13T11:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T11:00:00.000Z");

const NON_TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
]);

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
    storageKey: "applications/submitted-cv-snapshots/v10-s04-cm.pdf",
    originalFileName: "v10-s04-cm.pdf",
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
  title = "Backend Engineer",
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
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

const createUnassignedApplication = async ({
  candidateUserId,
  jobId,
  status = APPLICATION_STATUS.APPLIED,
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  const created = await createUnassignedAppliedApplication({
    candidateUserId,
    jobId,
    submittedCvSnapshot,
  });

  if (status === APPLICATION_STATUS.APPLIED) {
    return created;
  }

  await Application.updateOne(
    { _id: created._id },
    { $set: { status, version: 1 } },
  );

  return Application.findById(created._id);
};

const expectedVersionForUnassignedStatus = (status) => {
  return status === APPLICATION_STATUS.APPLIED ? 0 : 1;
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

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s04.cm" } = {}) => {
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
    fullName: "CM Assign Candidate",
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

const assertBusinessIdentityUnchanged = (before, after) => {
  expect(after.status).toBe(before.status);
  expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
  expect(String(after.jobId)).toBe(String(before.jobId));
  expect(after.source).toBe(before.source);
  expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
};

describe("V10 Slice 04 — Company Manager Application Assignment Management (F01, F02, F04, F09)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — Company Manager Assign / Reassign / Unassign", () => {
    it("lets owning-Company Manager Assign NONE → Recruiter (BR-06/BR-15)", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.assign",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const before = await Application.findById(application._id).lean();

      const result = await firstAssignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      expect(result.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        version: 1,
      });
      expect(result.application.assignedRecruiterCompanyMemberId).not.toBe(
        manager.membership._id.toString(),
      );

      const after = await Application.findById(application._id).lean();
      assertBusinessIdentityUnchanged(before, after);
      expect(after.version).toBe(1);
    });

    it("lets owning-Company Manager change Assignee A → B without becoming Assignee (BR-15/BR-16)", async () => {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s04.cm.reassign",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      const before = await Application.findById(application._id).lean();

      const result = await reassignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application).toMatchObject({
        status: APPLICATION_STATUS.SCREENING,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supportingB.membership._id.toString(),
        version: 2,
      });
      expect(result.application.assignedRecruiterCompanyMemberId).not.toBe(
        manager.membership._id.toString(),
      );

      const after = await Application.findById(application._id).lean();
      assertBusinessIdentityUnchanged(before, after);
    });

    it("lets owning-Company Manager Unassign A → NONE (BR-10/BR-15)", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.unassign",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });
      const before = await Application.findById(application._id).lean();

      const result = await unassignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application).toMatchObject({
        status: APPLICATION_STATUS.CONTACTED,
        isUnassigned: true,
        assignedRecruiterCompanyMemberId: null,
        assignedRecruiter: null,
        version: 2,
      });

      const after = await Application.findById(application._id).lean();
      assertBusinessIdentityUnchanged(before, after);
      expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    });

    it.each(NON_TERMINAL_STATUSES)(
      "Assigns Unassigned %s Applications (BR-17)",
      async (status) => {
        const { manager, primary, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s04.cm.status.assign.${status.toLowerCase()}`,
        });
        const application = await createUnassignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status,
        });

        const result = await firstAssignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: expectedVersionForUnassignedStatus(status),
        });

        expect(result.application.status).toBe(status);
        expect(result.application.assignedRecruiterCompanyMemberId).toBe(
          primary.membership._id.toString(),
        );
      },
    );

    it.each(NON_TERMINAL_STATUSES)(
      "Reassigns and Unassigns %s Applications (BR-17)",
      async (status) => {
        const { manager, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s04.cm.status.mutate.${status.toLowerCase()}`,
          });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });

        const reassigned = await reassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });
        expect(reassigned.application.status).toBe(status);
        expect(reassigned.application.assignedRecruiterCompanyMemberId).toBe(
          supportingB.membership._id.toString(),
        );

        const unassigned = await unassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 2,
        });
        expect(unassigned.application.status).toBe(status);
        expect(unassigned.application.isUnassigned).toBe(true);
      },
    );

    it.each([JOB_STATUS.PUBLISHED, JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
      "manages Assignee on a %s Job (F09/BR-27)",
      async (jobStatus) => {
        const { manager, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s04.cm.job.${jobStatus.toLowerCase()}`,
          });
        await Job.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
        const unassigned = await createUnassignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
        });

        const assigned = await firstAssignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: unassigned._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });
        expect(assigned.application.status).toBe(
          APPLICATION_STATUS.INTERVIEW_COMPLETED,
        );

        const reassigned = await reassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: unassigned._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 2,
        });
        expect(reassigned.application.assignedRecruiterCompanyMemberId).toBe(
          supportingB.membership._id.toString(),
        );

        const cleared = await unassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: unassigned._id.toString(),
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 3,
        });
        expect(cleared.application.isUnassigned).toBe(true);
        expect(cleared.application.status).toBe(
          APPLICATION_STATUS.INTERVIEW_COMPLETED,
        );
      },
    );

    it("rejects cross-company Company Manager (BR-40/BR-53)", async () => {
      const home = await setupCompanyWithTeam({ emailPrefix: "v10.s04.cm.home" });
      const foreign = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.foreign",
      });
      const assignedCandidate = await createVerifiedUser({
        email: "v10.s04.cm.home.assigned.candidate@example.com",
        fullName: "Assigned Candidate",
      });
      const unassigned = await createUnassignedAppliedApplication({
        candidateUserId: home.candidate.user._id,
        jobId: home.job._id,
      });
      const assigned = await createAssignedApplication({
        candidateUserId: assignedCandidate.user._id,
        jobId: home.job._id,
        assigneeMemberId: home.supporting.membership._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: foreign.manager.user,
          jobId: home.job._id.toString(),
          applicationId: unassigned._id.toString(),
          assigneeCompanyMemberId: home.supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        reassignApplication({
          actorUser: foreign.manager.user,
          jobId: home.job._id.toString(),
          applicationId: assigned._id.toString(),
          assigneeCompanyMemberId: home.supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        unassignApplication({
          actorUser: foreign.manager.user,
          jobId: home.job._id.toString(),
          applicationId: assigned._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        firstAssignApplication({
          actorUser: home.manager.user,
          jobId: home.job._id.toString(),
          applicationId: unassigned._id.toString(),
          assigneeCompanyMemberId: home.supporting.membership._id.toString(),
          expectedVersion: 0,
          clientCompanyId: foreign.manager.company._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects off-team, ineligible, and Company Manager targets (BR-07/BR-16)", async () => {
      const { manager, supporting, peer, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s04.cm.target",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: peer.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        firstAssignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: manager.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await CompanyMember.updateOne(
        { _id: supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );
      await expect(
        firstAssignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.version).toBe(0);
    });

    it.each(TERMINAL_STATUSES)(
      "rejects Assign/Reassign/Unassign on %s Applications (BR-17)",
      async (status) => {
        const { manager, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s04.cm.terminal.${status.toLowerCase()}`,
          });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });

        await expect(
          firstAssignApplication({
            actorUser: manager.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: supportingB.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        await expect(
          reassignApplication({
            actorUser: manager.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: supportingB.membership._id.toString(),
            expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        await expect(
          unassignApplication({
            actorUser: manager.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });
      },
    );

    it("does not grant Company Manager Recruitment Pipeline authority (BR-16)", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.pipeline",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
    });

    it("allows only one winner when Primary and Company Manager mutate the same revision (BR-37/TX-01)", async () => {
      const { manager, primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s04.cm.race",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      const results = await Promise.allSettled([
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        reassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
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
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect([
        primary.membership._id.toString(),
        supportingB.membership._id.toString(),
      ]).toContain(String(persisted.assignedRecruiterCompanyMemberId));
    });

    it("fails CM Assign when target eligibility is lost at commit (BR-07/TX-02)", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.elig",
      });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      await User.updateOne(
        { _id: supporting.user._id },
        { $set: { status: USER_STATUS.LOCKED } },
      );

      await expect(
        firstAssignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(persisted.version).toBe(1);
    });

    it("lets Company Manager read Job Applications without mutating them (F01)", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.read",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });
      const before = await Application.findById(application._id).lean();

      const result = await listPrimaryJobApplications({
        actorUser: manager.user,
        jobId: job._id.toString(),
      });

      expect(result.applications).toHaveLength(1);
      expect(result.applications[0]).toMatchObject({
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        candidate: { fullName: "CM Assign Candidate" },
      });
      expect(result.applications[0].submittedCvSnapshot.pdfFile.storageKey)
        .toBeUndefined();

      const after = await Application.findById(application._id).lean();
      assertBusinessIdentityUnchanged(before, after);
      expect(after.version).toBe(before.version);
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        String(before.assignedRecruiterCompanyMemberId),
      );
    });
  });

  describe("HTTP — Company Manager assignment surfaces", () => {
    it("Assigns, Reassigns, and Unassigns via canonical HTTP for Company Manager", async () => {
      const agent = createTestAgent();
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s04.cm.http",
        });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get(`/api/jobs/${job._id}/applications`)
        .set("Authorization", `Bearer ${token}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.applications).toHaveLength(1);

      const assignResponse = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        });
      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.application.assignedRecruiterCompanyMemberId)
        .toBe(supporting.membership._id.toString());

      const reassignResponse = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/reassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });
      expect(reassignResponse.status).toBe(200);
      expect(
        reassignResponse.body.application.assignedRecruiterCompanyMemberId,
      ).toBe(supportingB.membership._id.toString());

      const unassignResponse = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/unassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 2,
        });
      expect(unassignResponse.status).toBe(200);
      expect(unassignResponse.body.application.isUnassigned).toBe(true);
    });

    it("keeps force-reassign as a CM-only A → B compatibility surface, including eligible Assignees", async () => {
      const agent = createTestAgent();
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s04.cm.force",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

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

      const response = await agent
        .post(
          `/api/jobs/${job._id}/applications/${application._id}/force-reassign`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 2,
        });
      expect(response.status).toBe(200);
      expect(response.body.application.assignedRecruiterCompanyMemberId).toBe(
        supporting.membership._id.toString(),
      );
    });

    it("rejects Company Manager Pipeline and snapshot-delivery HTTP (BR-16)", async () => {
      const agent = createTestAgent();
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.cm.http.deny",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const pipelineResponse = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/pipeline`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        });
      expect(pipelineResponse.status).toBe(403);

      const previewResponse = await agent
        .get(
          `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/preview`,
        )
        .set("Authorization", `Bearer ${token}`);
      expect(previewResponse.status).toBe(403);
    });
  });
});
