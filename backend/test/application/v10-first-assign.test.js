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
import { firstAssignApplication } from "../../src/services/application.service.js";
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
const APPLIED_AT = new Date("2026-08-13T06:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T06:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s04.pdf",
    originalFileName: "v10-s04.pdf",
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

const NON_TERMINAL_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
];

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

const insertLegacyMissingAssigneeApplication = async ({
  candidateUserId,
  jobId,
  submittedCvSnapshot = buildUploadedSnapshot(),
}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await Application.collection.insertOne(doc);
  return doc;
};

const setupCompanyWithTeam = async ({ emailPrefix = "v10.s04" } = {}) => {
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
    supportingMemberIds: [supporting.membership._id],
  });

  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Assign Candidate",
  });

  return { manager, primary, supporting, peer, job, candidate };
};

describe("V10 Slice 02 — Assign Unassigned Application (F02, F09)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — firstAssignApplication", () => {
    it("lets Primary First Assign an Unassigned Application to self (BR-06/BR-11)", async () => {
      const { primary, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.self",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      const result = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedVersion: 0,
      });

      expect(result.application).toMatchObject({
        id: application._id.toString(),
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: primary.membership._id.toString(),
        version: 1,
        source: APPLICATION_SOURCE.DIRECT_APPLICATION,
      });
      expect(result.application.assignedRecruiter).toMatchObject({
        companyMemberId: primary.membership._id.toString(),
        fullName: "Primary Recruiter",
      });
      expect(result.application.submittedCvSnapshot.name).toBe(
        "Submitted CV Snapshot",
      );

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        primary.membership._id.toString(),
      );
      expect(persisted.version).toBe(1);
      expect(persisted.submittedCvSnapshot.name).toBe("Submitted CV Snapshot");
      expect(String(persisted.candidateUserId)).toBe(
        candidate.user._id.toString(),
      );
      expect(String(persisted.jobId)).toBe(job._id.toString());
      expect(persisted.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
    });

    it("lets Primary First Assign to a valid Supporting Recruiter", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.supp.target",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      const result = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      expect(result.application.assignedRecruiterCompanyMemberId).toBe(
        supporting.membership._id.toString(),
      );
      expect(result.application.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(result.application.isUnassigned).toBe(false);
    });

    it.each(NON_TERMINAL_STATUSES)(
      "lets Primary Assign an Unassigned %s Application without changing status (F02/BR-11)",
      async (status) => {
        const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s02.assign.${status.toLowerCase()}`,
        });
        const snapshot = buildUploadedSnapshot({ name: `Snapshot ${status}` });
        const application = await createUnassignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status,
          submittedCvSnapshot: snapshot,
        });
        const before = await Application.findById(application._id).lean();
        const expectedVersion = expectedVersionForUnassignedStatus(status);

        const result = await firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion,
        });

        expect(result.application).toMatchObject({
          status,
          isUnassigned: false,
          assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
          version: expectedVersion + 1,
        });

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.status).toBe(status);
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
        expect(persisted.version).toBe(expectedVersion + 1);
        expect(persisted.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
        expect(String(persisted.candidateUserId)).toBe(String(before.candidateUserId));
        expect(String(persisted.jobId)).toBe(String(before.jobId));
        expect(persisted.source).toBe(before.source);
      },
    );

    it.each([JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED])(
      "Assigns Unassigned SCREENING on a %s Job (F09/BR-27)",
      async (jobStatus) => {
        const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s02.job.${jobStatus.toLowerCase()}`,
        });
        await Job.updateOne({ _id: job._id }, { $set: { status: jobStatus } });
        const application = await createUnassignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status: APPLICATION_STATUS.SCREENING,
        });

        const result = await firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

        expect(result.application.status).toBe(APPLICATION_STATUS.SCREENING);
        expect(result.application.assignedRecruiterCompanyMemberId).toBe(
          supporting.membership._id.toString(),
        );
        expect(result.job.status).toBe(jobStatus);
      },
    );

    it("First Assigns legacy missing-assignee records as Unassigned (BR-05/PI-05)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.legacy",
      });
      const legacy = await insertLegacyMissingAssigneeApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      const persistedBefore = await Application.collection.findOne({
        _id: legacy._id,
      });
      expect(persistedBefore).not.toHaveProperty(
        "assignedRecruiterCompanyMemberId",
      );

      const result = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: legacy._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      expect(result.application.isUnassigned).toBe(false);
      expect(result.application.assignedRecruiterCompanyMemberId).toBe(
        supporting.membership._id.toString(),
      );
      expect(result.application.status).toBe(APPLICATION_STATUS.APPLIED);
    });

    it("denies Supporting self-claim of an Unassigned Application (BR-09)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.claim",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.version).toBe(0);
    });

    it("denies Supporting self-claim of Unassigned SCREENING (BR-09)", async () => {
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s02.claim.screening",
      });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
      });

      await expect(
        firstAssignApplication({
          actorUser: supporting.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      expect(persisted.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(persisted.version).toBe(1);
    });

    it("denies Recruiter who is not current Primary", async () => {
      const { peer, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.notprimary",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: peer.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("rejects cross-company assignee (BR-40)", async () => {
      const home = await setupCompanyWithTeam({ emailPrefix: "v10.s04.home" });
      const foreign = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.foreign",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: home.candidate.user._id,
        jobId: home.job._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: home.primary.user,
          jobId: home.job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: foreign.primary.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects assignee who is not on the current Recruitment Team", async () => {
      const { primary, peer, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.noteam",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await expect(
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: peer.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects non-operational assignee membership, user, or company (BR-07)", async () => {
      const lockedCase = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.locked",
      });
      const lockedApp = await createUnassignedAppliedApplication({
        candidateUserId: lockedCase.candidate.user._id,
        jobId: lockedCase.job._id,
      });
      await CompanyMember.updateOne(
        { _id: lockedCase.supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );
      await expect(
        firstAssignApplication({
          actorUser: lockedCase.primary.user,
          jobId: lockedCase.job._id.toString(),
          applicationId: lockedApp._id.toString(),
          assigneeCompanyMemberId:
            lockedCase.supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const inactiveUserCase = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.inactiveuser",
      });
      const inactiveUserApp = await createUnassignedAppliedApplication({
        candidateUserId: inactiveUserCase.candidate.user._id,
        jobId: inactiveUserCase.job._id,
      });
      await User.updateOne(
        { _id: inactiveUserCase.supporting.user._id },
        { $set: { status: USER_STATUS.LOCKED } },
      );
      await expect(
        firstAssignApplication({
          actorUser: inactiveUserCase.primary.user,
          jobId: inactiveUserCase.job._id.toString(),
          applicationId: inactiveUserApp._id.toString(),
          assigneeCompanyMemberId:
            inactiveUserCase.supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      // Non-operational Company is denied at trusted Recruiter business access
      // before First Assign commit; eligibility still re-checks Company in TX-02.
      const inactiveCompanyCase = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.inactiveco",
      });
      const inactiveCompanyApp = await createUnassignedAppliedApplication({
        candidateUserId: inactiveCompanyCase.candidate.user._id,
        jobId: inactiveCompanyCase.job._id,
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
        firstAssignApplication({
          actorUser: inactiveCompanyCase.primary.user,
          jobId: inactiveCompanyCase.job._id.toString(),
          applicationId: inactiveCompanyApp._id.toString(),
          assigneeCompanyMemberId:
            inactiveCompanyCase.supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("revalidates target eligibility at commit for Unassigned SCREENING (BR-07/TX-02)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s02.elig.screening",
      });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      await CompanyMember.updateOne(
        { _id: supporting.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );

      await expect(
        firstAssignApplication({
          actorUser: primary.user,
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

    it("rejects First Assign on terminal Applications (BR-17)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.terminal",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      await Application.updateOne(
        { _id: application._id },
        {
          $set: {
            status: APPLICATION_STATUS.WITHDRAWN,
            withdrawnAt: new Date(),
          },
        },
      );

      await expect(
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rejects Assign on HIRED and REJECTED Applications (BR-17)", async () => {
      for (const status of [
        APPLICATION_STATUS.HIRED,
        APPLICATION_STATUS.REJECTED,
      ]) {
        const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
          emailPrefix: `v10.s02.terminal.${status.toLowerCase()}`,
        });
        const application = await createUnassignedAppliedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
        });
        await Application.updateOne(
          { _id: application._id },
          {
            $set: {
              status,
              assignedRecruiterCompanyMemberId: supporting.membership._id,
              version: 1,
            },
          },
        );

        await expect(
          firstAssignApplication({
            actorUser: primary.user,
            jobId: job._id.toString(),
            applicationId: application._id.toString(),
            assigneeCompanyMemberId: primary.membership._id.toString(),
            expectedVersion: 1,
          }),
        ).rejects.toMatchObject({ statusCode: 409 });

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.status).toBe(status);
        expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
          supporting.membership._id.toString(),
        );
      }
    });

    it("rejects Assign when the Application already has an Assignee (BR-37)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s02.already",
      });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.CONTACTED,
      });

      await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      await expect(
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 2,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(persisted.version).toBe(2);
    });

    it("keeps APPLIED status and snapshot unchanged after First Assign (BR-11)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.preserve",
      });
      const snapshot = buildUploadedSnapshot({ name: "Preserve Me" });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        submittedCvSnapshot: snapshot,
      });
      const before = await Application.findById(application._id).lean();

      await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      const after = await Application.findById(application._id).lean();
      expect(after.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(after.version).toBe(1);
    });

    it("allows only one winner when two First Assigns compete (BR-37 / TX-01)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.race",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      const results = await Promise.allSettled([
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 0,
        }),
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        }),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.assignedRecruiterCompanyMemberId).toBeTruthy();
      expect(persisted.version).toBe(1);
    });

    it("rejects stale version without overwriting a newer assignment (BR-36)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.stale",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      await expect(
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Application.findById(application._id).lean();
      expect(String(persisted.assignedRecruiterCompanyMemberId)).toBe(
        supporting.membership._id.toString(),
      );
      expect(persisted.version).toBe(1);
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
    });

    it("allows only one winner when two Assigns compete on Unassigned CONTACTED (BR-37 / TX-01)", async () => {
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s02.race.contacted",
      });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.CONTACTED,
      });

      const results = await Promise.allSettled([
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 1,
        }),
        firstAssignApplication({
          actorUser: primary.user,
          jobId: job._id.toString(),
          applicationId: application._id.toString(),
          assigneeCompanyMemberId: supporting.membership._id.toString(),
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
      expect(persisted.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(persisted.version).toBe(2);
    });
  });

  describe("HTTP — POST /api/jobs/:jobId/applications/:applicationId/assign", () => {
    it("First Assigns via HTTP for authenticated Primary", async () => {
      const agent = createTestAgent();
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.http",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        status: APPLICATION_STATUS.APPLIED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        version: 1,
      });
    });

    it("blocks Supporting First Assign over HTTP", async () => {
      const agent = createTestAgent();
      const { supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s04.http.deny",
      });
      const application = await createUnassignedAppliedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 0,
        });

      expect(response.status).toBe(403);
    });

    it("Assigns Unassigned INTERVIEW_COMPLETED via HTTP without changing status", async () => {
      const agent = createTestAgent();
      const { primary, supporting, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s02.http.interview",
      });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: supporting.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application).toMatchObject({
        status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
        isUnassigned: false,
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        version: 2,
      });
    });

    it("Assigns Unassigned SCREENING via HTTP when Job is CLOSED", async () => {
      const agent = createTestAgent();
      const { primary, job, candidate } = await setupCompanyWithTeam({
        emailPrefix: "v10.s02.http.closed",
      });
      await Job.updateOne({ _id: job._id }, { $set: { status: JOB_STATUS.CLOSED } });
      const application = await createUnassignedApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
      });
      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const response = await agent
        .post(`/api/jobs/${job._id}/applications/${application._id}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          assigneeCompanyMemberId: primary.membership._id.toString(),
          expectedVersion: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.application.status).toBe(APPLICATION_STATUS.SCREENING);
      expect(response.body.application.assignedRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
      expect(response.body.job.status).toBe(JOB_STATUS.CLOSED);
    });
  });
});
