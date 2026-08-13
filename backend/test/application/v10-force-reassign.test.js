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
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
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
    storageKey: "applications/submitted-cv-snapshots/v10-s06.pdf",
    originalFileName: "v10-s06.pdf",
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

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s06" } = {}) => {
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
    fullName: "Force Reassign Candidate",
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

  if (mode === "terminated") {
    await CompanyMember.updateOne(
      { _id: membershipId },
      { $set: { status: COMPANY_MEMBER_STATUS.TERMINATED } },
    );
    return;
  }

  if (mode === "off-team") {
    await Job.updateOne(
      { supportingRecruiterCompanyMemberIds: membershipId },
      { $pull: { supportingRecruiterCompanyMemberIds: membershipId } },
    );
    return;
  }

  if (mode === "user-inactive") {
    const membership = await CompanyMember.findById(membershipId);
    await User.updateOne(
      { _id: membership.userId },
      { $set: { status: USER_STATUS.LOCKED } },
    );
  }
};

describe("V10 Slice 06 — Administrative Forced Reassignment (F04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — forceReassignApplication", () => {
    it("lets same-tenant Company Manager force-reassign from ineligible Assignee (BR-15)", async () => {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.happy",
        });
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

      expect(result.application).toMatchObject({
        status: APPLICATION_STATUS.SCREENING,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supportingB.membership._id.toString(),
        version: 2,
      });
      expect(result.application).not.toHaveProperty("forced");
      expect(result.application).not.toHaveProperty("forcedBy");

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted).not.toHaveProperty("forced");
      expect(persisted).not.toHaveProperty("previousAssignee");
    });

    it("allows handoff when current Assignee is LOCKED or TERMINATED (BR-28)", async () => {
      for (const [index, mode] of ["locked", "terminated"].entries()) {
        const { manager, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s06.mem.${index}`,
          });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
        });
        await markAssigneeIneligible(supporting.membership._id, mode);

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
      }
    });

    it("allows handoff when current Assignee is no longer on the team (BR-28)", async () => {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.offteam",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "off-team");

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
    });

    it("allows handoff when current Assignee User is not ACTIVE (BR-28)", async () => {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.userlock",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "user-inactive");

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
    });

    it("lets Company Manager force-reassign while current Assignee remains eligible (BR-15)", async () => {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.stillok",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
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
      expect(result.application.version).toBe(2);

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);
    });

    it("rejects cross-company or non-team target (BR-07/BR-40)", async () => {
      const home = await setupCompanyWithTeam({ emailPrefix: "v10.s06.home" });
      const foreign = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.foreign",
      });
      const application = await createAssignedApplication({
        candidateUserId: home.candidate.user._id,
        jobId: home.job._id,
        assigneeMemberId: home.supporting.membership._id,
      });
      await markAssigneeIneligible(home.supporting.membership._id, "locked");

      await expect(
        forceReassignApplication({
          actorUser: home.manager.user,
          jobId: home.job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: foreign.primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        forceReassignApplication({
          actorUser: home.manager.user,
          jobId: home.job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: home.peer.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects inactive target Assignee (BR-07)", async () => {
      const lockedTarget = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.badtarget",
      });
      const lockedApp = await createAssignedApplication({
        candidateUserId: lockedTarget.candidate.user._id,
        jobId: lockedTarget.job._id,
        assigneeMemberId: lockedTarget.supporting.membership._id,
      });
      await markAssigneeIneligible(
        lockedTarget.supporting.membership._id,
        "locked",
      );
      await CompanyMember.updateOne(
        { _id: lockedTarget.supportingB.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );

      await expect(
        forceReassignApplication({
          actorUser: lockedTarget.manager.user,
          jobId: lockedTarget.job._id.toString(),
          applicationId: lockedApp._id.toString(),
          assigneeCompanyMemberId:
            lockedTarget.supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            lockedTarget.supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects Company Manager membership as target Assignee (BR-16/BR-42)", async () => {
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.cmtarget",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "locked");

      await expect(
        forceReassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: manager.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects cross-tenant Company Manager (BR-40)", async () => {
      const home = await setupCompanyWithTeam({ emailPrefix: "v10.s06.tenanta" });
      const foreign = await setupCompanyWithTeam({
        emailPrefix: "v10.s06.tenantb",
      });
      const application = await createAssignedApplication({
        candidateUserId: home.candidate.user._id,
        jobId: home.job._id,
        assigneeMemberId: home.supporting.membership._id,
      });
      await markAssigneeIneligible(home.supporting.membership._id, "locked");

      await expect(
        forceReassignApplication({
          actorUser: foreign.manager.user,
          jobId: home.job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: home.supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("denies Platform Admin, Recruiter, and Candidate administrative authority (BR-42)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.actors",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "locked");

      const admin = await createVerifiedUser({
        email: "v10.s06.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
        fullName: "Platform Admin",
      });

      await expect(
        forceReassignApplication({
          actorUser: admin.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        forceReassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        forceReassignApplication({
          actorUser: candidate.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects terminal Applications (BR-17)", async () => {
      for (const [index, status] of TERMINAL_STATUSES.entries()) {
        const { manager, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s06.term.${index}`,
          });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });
        await markAssigneeIneligible(supporting.membership._id, "locked");

        await expect(
          forceReassignApplication({
            actorUser: manager.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: supportingB.membership._id.toString(),
            expectedAssigneeCompanyMemberId:
              supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });
      }
    });

    it("allows handoff on CLOSED and EXPIRED Jobs (BR-27/F09)", async () => {
      for (const [index, status] of [
        JOB_STATUS.CLOSED,
        JOB_STATUS.EXPIRED,
      ].entries()) {
        const { manager, primary, supporting, supportingB, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s06.joblife.${index}`,
          });
        const closedJob = await createPublishedJob({
          companyId: manager.company._id,
          primaryMemberId: primary.membership._id,
          supportingMemberIds: [
            supporting.membership._id,
            supportingB.membership._id,
          ],
          status,
          title: `Lifecycle Job ${status}`,
        });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: closedJob._id,
          assigneeMemberId: supporting.membership._id,
          status: APPLICATION_STATUS.CONTACTED,
        });
        await markAssigneeIneligible(supporting.membership._id, "locked");

        const result = await forceReassignApplication({
          actorUser: manager.user,
          jobId: closedJob._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(APPLICATION_STATUS.CONTACTED);
        expect(result.application.assignedRecruiterCompanyMemberId).toBe(
          supportingB.membership._id.toString(),
        );
        expect(result.job.status).toBe(status);
      }
    });

    it("preserves status and snapshot on forced reassignment (BR-10)", async () => {
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.preserve",
        });
      const snapshot = buildUploadedSnapshot({ name: "Preserve Forced" });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
        submittedCvSnapshot: snapshot,
      });
      const before = await Application.findById(application._id).lean();
      await markAssigneeIneligible(supporting.membership._id, "locked");

      await forceReassignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const after = await Application.findById(application._id).lean();
      expect(after.status).toBe(APPLICATION_STATUS.INTERVIEW_COMPLETED);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(after.version).toBe(2);
    });

    it("rejects stale Assignee or version (BR-36/TX-01)", async () => {
      const { manager, supporting, supportingB, primary, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.stale",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "locked");

      await forceReassignApplication({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        forceReassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 2,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        forceReassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);
    });

    it("allows only one winner between normal Reassign and forced Reassign (BR-37)", async () => {
      const { manager, primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.race",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      // Force path needs ineligible current Assignee; Primary Reassign does not.
      // Use off-team so Primary can still Reassign before eligibility flips in race:
      // both compete from the same expected assignee + version.
      await markAssigneeIneligible(supporting.membership._id, "off-team");

      const results = await Promise.allSettled([
        forceReassignApplication({
          actorUser: manager.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
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
      expect(persisted.assignedRecruiterCompanyMemberId).toBeTruthy();
      expect(persisted.version).toBe(2);
      expect([
        primary.membership._id.toString(),
        supportingB.membership._id.toString(),
      ]).toContain(String(persisted.assignedRecruiterCompanyMemberId));
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/force-reassign", () => {
    it("force-reassigns via HTTP for authenticated Company Manager", async () => {
      const agent = createTestAgent();
      const { manager, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.http",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "locked");
      const token = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(
          `/api/jobs/${job._id}/applications/${application._id}/force-reassign`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        assignedRecruiterCompanyMemberId: supportingB.membership._id.toString(),
        version: 2,
        isUnassigned: false,
      });
    });

    it("blocks Recruiter forced reassignment over HTTP", async () => {
      const agent = createTestAgent();
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s06.http.deny",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      await markAssigneeIneligible(supporting.membership._id, "locked");
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
      });

      const response = await agent
        .post(
          `/api/jobs/${job._id}/applications/${application._id}/force-reassign`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });
  });
});
