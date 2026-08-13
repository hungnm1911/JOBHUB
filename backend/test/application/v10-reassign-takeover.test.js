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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  getManagedJobPipelineWorkspace,
  listManagedJobs,
  listPrimaryJobApplications,
  listRecruiterMyApplications,
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
const APPLIED_AT = new Date("2026-08-13T07:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T07:00:00.000Z");

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
    storageKey: "applications/submitted-cv-snapshots/v10-s05.pdf",
    originalFileName: "v10-s05.pdf",
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

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s05" } = {}) => {
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
    fullName: "Reassign Candidate",
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

describe("V10 Slice 03 — Primary Reassign / Take over / Unassign Application (F03, F09, F10)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — reassignApplication", () => {
    it("lets Primary Reassign A → Supporting B (BR-12/BR-14)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.a2b",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: primary.membership._id,
      });

      const result = await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedAssigneeCompanyMemberId: primary.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application).toMatchObject({
        id: application._id.toString(),
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        version: 2,
      });
      expect(result.application.assignedRecruiter).toMatchObject({
        companyMemberId: supporting.membership._id.toString(),
        fullName: "Supporting Recruiter",
      });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.version).toBe(2);
    });

    it("lets Primary Reassign Supporting → Primary (BR-12)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.s2p",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });

      const result = await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application.assignedRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
      expect(result.application.status).toBe(APPLICATION_STATUS.SCREENING);
    });

    it("lets Primary Take over Application onto self (BR-13)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.takeover",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });

      const result = await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application.assignedRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
      expect(result.application.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(result.application).not.toHaveProperty("takenOver");
      expect(result.application).not.toHaveProperty("takeoverAt");

      const persisted = await Application.findById(application._id).lean();
      expect(persisted).not.toHaveProperty("takenOver");
      expect(persisted).not.toHaveProperty("takeoverAt");
      expect(persisted).not.toHaveProperty("previousAssignee");
    });

    it("allows Reassign at each non-terminal status (BR-17)", async () => {
      for (const [index, status] of NON_TERMINAL_STATUSES.entries()) {
        const { primary, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s05.nt.${index}`,
          });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });

        const result = await reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(status);
        expect(result.application.assignedRecruiterCompanyMemberId).toBe(
          supportingB.membership._id.toString(),
        );
      }
    });

    it("rejects Reassign on terminal Applications (BR-17)", async () => {
      for (const [index, status] of TERMINAL_STATUSES.entries()) {
        const { primary, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s05.term.${index}`,
          });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });

        await expect(
          reassignApplication({
            actorUser: primary.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: supportingB.membership._id.toString(),
            expectedAssigneeCompanyMemberId:
              supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const persisted = await Application.findById(application._id).lean();
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
        expect(persisted.version).toBe(1);
      }
    });

    it("denies Supporting Reassign or Take over (BR-19)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.supp.deny",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: primary.membership._id,
      });

      await expect(
        reassignApplication({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        reassignApplication({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedAssigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("denies Recruiter who is not current Primary", async () => {
      const { peer, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.notprimary",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await expect(
        reassignApplication({
          actorUser: peer.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects cross-company or non-team target (BR-40)", async () => {
      const home = await setupCompanyWithTeam({ emailPrefix: "v10.s05.home" });
      const foreign = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.foreign",
      });
      const application = await createAssignedApplication({
        candidateUserId: home.candidate.user._id,
        jobId: home.job._id,
        assigneeMemberId: home.primary.membership._id,
      });

      await expect(
        reassignApplication({
          actorUser: home.primary.user,
          jobId: home.job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: foreign.primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        reassignApplication({
          actorUser: home.primary.user,
          jobId: home.job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: home.peer.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            home.primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects inactive Member/User/Company target (TX-02)", async () => {
      const lockedCase = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.locked",
      });
      const lockedApp = await createAssignedApplication({
        candidateUserId: lockedCase.candidate.user._id,
        jobId: lockedCase.job._id,
        assigneeMemberId: lockedCase.primary.membership._id,
      });
      await CompanyMember.updateOne(
        { _id: lockedCase.supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );
      await expect(
        reassignApplication({
          actorUser: lockedCase.primary.user,
          jobId: lockedCase.job._id.toString(),
          applicationId: lockedApp._id.toString(),
          assigneeCompanyMemberId:
            lockedCase.supporting.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            lockedCase.primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const inactiveUserCase = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.inactiveuser",
      });
      const inactiveUserApp = await createAssignedApplication({
        candidateUserId: inactiveUserCase.candidate.user._id,
        jobId: inactiveUserCase.job._id,
        assigneeMemberId: inactiveUserCase.primary.membership._id,
      });
      await User.updateOne(
        { _id: inactiveUserCase.supporting.user._id },
        { $set: { status: USER_STATUS.LOCKED } },
      );
      await expect(
        reassignApplication({
          actorUser: inactiveUserCase.primary.user,
          jobId: inactiveUserCase.job._id.toString(),
          applicationId: inactiveUserApp._id.toString(),
          assigneeCompanyMemberId:
            inactiveUserCase.supporting.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            inactiveUserCase.primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const inactiveCompanyCase = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.inactiveco",
      });
      const inactiveCompanyApp = await createAssignedApplication({
        candidateUserId: inactiveCompanyCase.candidate.user._id,
        jobId: inactiveCompanyCase.job._id,
        assigneeMemberId: inactiveCompanyCase.primary.membership._id,
      });
      await Company.findByIdAndUpdate(
        inactiveCompanyCase.manager.company._id,
        {
          $set: {
            operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
          },
        },
        { runValidators: true },
      );
      await expect(
        reassignApplication({
          actorUser: inactiveCompanyCase.primary.user,
          jobId: inactiveCompanyCase.job._id.toString(),
          applicationId: inactiveCompanyApp._id.toString(),
          assigneeCompanyMemberId:
            inactiveCompanyCase.supporting.membership._id.toString(),
          expectedAssigneeCompanyMemberId:
            inactiveCompanyCase.primary.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("preserves status and snapshot on Reassign (BR-14/BR-34)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.preserve",
        });
      const snapshot = buildUploadedSnapshot({ name: "Preserve Reassign" });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        submittedCvSnapshot: snapshot,
      });
      const before = await Application.findById(application._id).lean();

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const after = await Application.findById(application._id).lean();
      expect(after.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(after.version).toBe(2);
    });

    it("never persists an Unassigned intermediate on Reassign (BR-10/TX-03)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.no.unassign",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      const before = await Application.findById(application._id).lean();
      expect(before.assignedRecruiterCompanyMemberId).toBeTruthy();

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      // Single atomic $set A → B (no $unset / null write). Final state must remain Assigned.
      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeTruthy();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(String(persisted.assignedRecruiterCompanyMemberId)).not.toBe(
        String(supporting.membership._id),
      );
      expect(persisted.version).toBe(2);
    });

    it("rejects stale Assignee or version (BR-36/BR-37/TX-01)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.stale",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 2,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        reassignApplication({
          actorUser: primary.user,
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

    it("allows only one winner when two Reassigns compete (BR-37/TX-01)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.race",
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
          actorUser: primary.user,
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
      expect(persisted.assignedRecruiterCompanyMemberId).toBeTruthy();
      expect(persisted.version).toBe(2);
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
    });

    it("preserves newer status when status mutation wins before Reassign (BR-38)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.status.race",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
        version: 1,
      });

      // Simulate a future pipeline status mutation (Slice 05 does not own pipeline):
      // assignee-bound CAS that only bumps status + version.
      const statusWinner = await Application.findOneAndUpdate(
        {
          _id: application._id,
          assignedRecruiterCompanyMemberId: supporting.membership._id,
          version: 1,
          status: APPLICATION_STATUS.APPLIED,
        },
        {
          $set: { status: APPLICATION_STATUS.SCREENING },
          $inc: { version: 1 },
        },
        { returnDocument: "after" },
      );
      expect(statusWinner.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(statusWinner.version).toBe(2);

      await expect(
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const afterStale = await Application.findById(application._id).lean();
      expect(afterStale.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(String(afterStale.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(afterStale.version).toBe(2);

      const retried = await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 2,
      });

      expect(retried.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(retried.application.assignedRecruiterCompanyMemberId).toBe(
        supportingB.membership._id.toString(),
      );
      expect(retried.application.version).toBe(3);
    });

    it("blocks former Assignee after Reassign wins the race (BR-38)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.reassign.wins",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
        version: 1,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const staleStatusAttempt = await Application.findOneAndUpdate(
        {
          _id: application._id,
          assignedRecruiterCompanyMemberId: supporting.membership._id,
          version: 1,
          status: APPLICATION_STATUS.APPLIED,
        },
        {
          $set: { status: APPLICATION_STATUS.SCREENING },
          $inc: { version: 1 },
        },
        { returnDocument: "after" },
      );

      expect(staleStatusAttempt).toBeNull();

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);
    });

    it.each([JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
      "Reassigns A → B on a %s Job without changing status (F09/BR-27)",
      async (jobStatus) => {
        const { primary, supporting, supportingB, job, candidate } =
          await setupCompanyWithTeam({
            emailPrefix: `v10.s03.reassign.job.${jobStatus.toLowerCase()}`,
          });
        await Job.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status: APPLICATION_STATUS.CONTACTED,
        });

        const result = await reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(APPLICATION_STATUS.CONTACTED);
        expect(result.application.assignedRecruiterCompanyMemberId).toBe(
          supportingB.membership._id.toString(),
        );
        expect(result.job.status).toBe(jobStatus);
      },
    );

    it("revalidates target B eligibility at commit for non-terminal Reassign (TX-02)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s03.reassign.elig.commit",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
      });
      await CompanyMember.updateOne(
        { _id: supportingB.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );

      await expect(
        reassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.status).toBe(APPLICATION_STATUS.INTERVIEW_COMPLETED);
      expect(persisted.version).toBe(1);
    });
  });

  describe("service — unassignApplication", () => {
    it.each(NON_TERMINAL_STATUSES)(
      "lets Primary Unassign A → NONE from %s without changing status (F03/BR-12/BR-14)",
      async (status) => {
        const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s03.unassign.${status.toLowerCase()}`,
        });
        const snapshot = buildUploadedSnapshot({ name: `Unassign ${status}` });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
          submittedCvSnapshot: snapshot,
        });
        const before = await Application.findById(application._id).lean();

        const result = await unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.application).toMatchObject({
          id: application._id.toString(),
          status,
          isUnassigned: true,
          assignedRecruiterCompanyMemberId: null,
          assignedRecruiter: null,
          version: 2,
        });

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
        expect(persisted.status).toBe(status);
        expect(persisted.version).toBe(2);
        expect(persisted.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
        expect(String(persisted.candidateUserId)).toBe(String(before.candidateUserId));
        expect(String(persisted.jobId)).toBe(String(before.jobId));
        expect(persisted.source).toBe(before.source);
      },
    );

    it.each([JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
      "Unassigns A → NONE on a %s Job without changing status (F09/BR-27)",
      async (jobStatus) => {
        const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s03.unassign.job.${jobStatus.toLowerCase()}`,
        });
        await Job.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        });

        const result = await unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(
          APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        );
        expect(result.application.isUnassigned).toBe(true);
        expect(result.application.assignedRecruiterCompanyMemberId).toBeNull();
        expect(result.job.status).toBe(jobStatus);
      },
    );

    it("rejects Unassign on terminal Applications (BR-17)", async () => {
      for (const [index, status] of TERMINAL_STATUSES.entries()) {
        const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s03.unassign.term.${index}`,
        });
        const application = await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: supporting.membership._id,
          status,
        });

        await expect(
          unassignApplication({
            actorUser: primary.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const persisted = await Application.findById(application._id).lean();
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
        expect(persisted.version).toBe(1);
      }
    });

    it("denies Supporting Unassign (BR-19)", async () => {
      const { supporting, supportingB, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.unassign.supp.deny",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supportingB.membership._id,
      });

      await expect(
        unassignApplication({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("does not require target eligibility for A → NONE (F03/BR-12)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.unassign.no.target",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });
      await CompanyMember.updateOne(
        { _id: supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );

      const result = await unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      expect(result.application.isUnassigned).toBe(true);
      expect(result.application.status).toBe(APPLICATION_STATUS.CONTACTED);
    });

    it("rejects stale Unassign based on A after B is committed (BR-36/BR-37/TX-01)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s03.unassign.stale",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supportingB.membership._id.toString(),
      );
      expect(persisted.version).toBe(2);
    });

    it("allows only one winner when Reassign and Unassign compete (BR-37/TX-01)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s03.reassign.unassign.race",
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
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
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
      const winnerIsUnassigned = persisted.assignedRecruiterCompanyMemberId == null;
      const winnerIsB =
        persisted.assignedRecruiterCompanyMemberId != null &&
        String(persisted.assignedRecruiterCompanyMemberId) ===
          supportingB.membership._id.toString();
      expect(winnerIsUnassigned || winnerIsB).toBe(true);
    });

    it("blocks former Assignee Pipeline after Unassign wins (BR-18/BR-38)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.unassign.vs.pipeline",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      await unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        updateApplicationRecruitmentPipelineStatus({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
          expectedVersion: 2,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.version).toBe(2);
    });

    it("preserves newer non-terminal status when Pipeline wins before Unassign (BR-38)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.pipeline.then.unassign",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 1,
      });

      await expect(
        unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const retried = await unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 2,
      });

      expect(retried.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(retried.application.isUnassigned).toBe(true);
      expect(retried.application.version).toBe(3);
    });

    it("allows only one winner when Unassign and Pipeline compete (BR-38/TX-01)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.unassign.pipeline.race",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.APPLIED,
      });

      const results = await Promise.allSettled([
        unassignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
        updateApplicationRecruitmentPipelineStatus({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          targetStatus: APPLICATION_STATUS.SCREENING,
          expectedStatus: APPLICATION_STATUS.APPLIED,
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
      if (persisted.assignedRecruiterCompanyMemberId == null) {
        expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      } else {
        expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
      }
    });

    it("reflects current Assignee in My Applications, Unassigned, and workload (BR-33/BR-34)", async () => {
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s03.workload.projection",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });

      const beforeMine = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      expect(
        beforeMine.applications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(true);
      expect(beforeMine.currentWorkloadCount).toBeGreaterThanOrEqual(1);

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const afterReassignOld = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      const afterReassignNew = await listRecruiterMyApplications({
        actorUser: supportingB.user,
      });
      expect(
        afterReassignOld.applications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(false);
      expect(
        afterReassignNew.applications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(true);

      await unassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
        expectedVersion: 2,
      });

      const afterUnassignOld = await listRecruiterMyApplications({
        actorUser: supportingB.user,
      });
      expect(
        afterUnassignOld.applications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(false);

      const primaryView = await listPrimaryJobApplications({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });
      const unassignedView = primaryView.applications.find(
        (item) => item.id === application._id.toString(),
      );
      expect(unassignedView.isUnassigned).toBe(true);
      expect(unassignedView.status).toBe(APPLICATION_STATUS.SCREENING);

      const workspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });
      expect(
        workspace.unassignedApplications.some(
          (item) => item.id === application._id.toString(),
        ),
      ).toBe(true);
      expect(
        workspace.currentWorkloadByAssignee.some(
          (entry) =>
            entry.companyMemberId === supportingB.membership._id.toString(),
        ),
      ).toBe(false);

      const managed = await listManagedJobs({ actorUser: primary.user });
      const managedJob = managed.managedJobs.find(
        (item) => item.job.id === job._id.toString(),
      );
      expect(managedJob.unassignedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/reassign", () => {
    it("Reassigns via HTTP for authenticated Primary", async () => {
      const agent = createTestAgent();
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.http",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(
          `/api/jobs/${job._id}/applications/${application._id}/reassign`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supportingB.membership._id.toString(),
        version: 2,
      });
    });

    it("Take over via HTTP targets Primary self", async () => {
      const agent = createTestAgent();
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s05.http.takeover",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(
          `/api/jobs/${job._id}/applications/${application._id}/reassign`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.assignedRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
      expect(response.body.application.status).toBe(
        APPLICATION_STATUS.CONTACTED,
      );
    });

    it("blocks Supporting Reassign over HTTP", async () => {
      const agent = createTestAgent();
      const { primary, supporting, supportingB, job, candidate } =
        await setupCompanyWithTeam({
          emailPrefix: "v10.s05.http.deny",
        });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: primary.membership._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
      });

      const response = await agent
        .post(
          `/api/jobs/${job._id}/applications/${application._id}/reassign`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedAssigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/unassign", () => {
    it("Unassigns via HTTP for authenticated Primary without changing status", async () => {
      const agent = createTestAgent();
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.http.unassign",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supporting.membership._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/unassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        status: APPLICATION_STATUS.SCREENING,
        isUnassigned: true,
        assignedRecruiterCompanyMemberId: null,
        assignedRecruiter: null,
        version: 2,
      });
    });

    it("blocks Supporting Unassign over HTTP", async () => {
      const agent = createTestAgent();
      const { supporting, supportingB, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.http.unassign.deny",
      });
      const application = await createAssignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        assigneeMemberId: supportingB.membership._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/unassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          expectedAssigneeCompanyMemberId: supportingB.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });

    it("blocks Company Manager Unassign over HTTP (F04 not in this slice)", async () => {
      const agent = createTestAgent();
      const { manager, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s03.http.unassign.cm",
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

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/unassign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(403);
    });
  });
});
