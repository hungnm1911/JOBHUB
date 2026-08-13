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
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  getManagedJobPipelineWorkspace,
  isApplicationUnassigned,
  listManagedJobs,
  reassignApplication,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import { hashPassword } from "../../src/utils/hash-password.js";
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
const PAST_DEADLINE = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T07:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-13T06:59:00.000Z");

const PIPELINE_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
];

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s11.pdf",
    originalFileName: "v10-s11.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  status = JOB_STATUS.PUBLISHED,
  title = "Managed Job",
  applicationDeadline = FUTURE_DEADLINE(),
}) => {
  const publishedAt =
    status === JOB_STATUS.DRAFT || status === JOB_STATUS.PENDING_APPROVAL
      ? null
      : new Date("2026-01-15");

  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
    publishedAt,
    applicationDeadline,
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

const createDirectApplication = async ({
  candidateUserId,
  jobId,
  status = APPLICATION_STATUS.APPLIED,
  assignedRecruiterCompanyMemberId = null,
  appliedAt = APPLIED_AT,
  submittedCvSnapshot = buildUploadedSnapshot(),
  version = 0,
}) => {
  const created = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  if (
    status === APPLICATION_STATUS.APPLIED &&
    assignedRecruiterCompanyMemberId == null &&
    version === 0
  ) {
    return created;
  }

  const $set = {
    status,
    assignedRecruiterCompanyMemberId,
    version,
  };

  if (status === APPLICATION_STATUS.WITHDRAWN) {
    $set.withdrawnAt = new Date("2026-08-13T08:00:00.000Z");
  }

  await Application.updateOne(
    { _id: created._id },
    {
      $set,
    },
  );

  return Application.findById(created._id);
};

const insertLegacyMissingAssigneeApplication = async ({
  candidateUserId,
  jobId,
}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: buildUploadedSnapshot(),
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

const setupCompany = async ({ emailPrefix = "v10.s11" } = {}) => {
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
  const peerPrimary = await createActiveRecruiterContext({
    email: `${emailPrefix}.peer@example.com`,
    fullName: "Peer Primary",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-PEER`,
    jobTitle: "Peer Recruiter",
  });

  return { manager, primary, supporting, peerPrimary };
};

const workloadEntry = (workload, companyMemberId) => {
  return workload.find(
    (entry) => entry.companyMemberId === companyMemberId.toString(),
  );
};

describe("V10 Slice 11 — Managed Jobs, Pipeline Workspace, Current Workload (F06/F10)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — listManagedJobs", () => {
    it("lets Recruiter see Jobs where they are current Primary", async () => {
      const { primary, supporting, peerPrimary } = await setupCompany();
      const owned = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "Owned Job",
      });
      await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: peerPrimary.membership._id,
        supportingMemberIds: [primary.membership._id],
        title: "Peer Job",
      });

      const result = await listManagedJobs({ actorUser: primary.user });

      expect(result.managedJobs).toHaveLength(1);
      expect(result.managedJobs[0].job.id).toBe(owned._id.toString());
      expect(result.managedJobs[0].supportingRecruiterCount).toBe(1);
    });

    it("does not treat Supporting-only Jobs as Managed Jobs", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.supp",
      });
      await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "Primary Owned",
      });

      const result = await listManagedJobs({ actorUser: supporting.user });

      expect(result.managedJobs).toHaveLength(0);
      expect(result.currentWorkloadByAssignee).toEqual([]);
    });

    it("includes PUBLISHED, CLOSED, and EXPIRED Jobs under current Primary", async () => {
      const { primary } = await setupCompany({
        emailPrefix: "v10.s11.lifecycle",
      });
      const published = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "Published",
      });
      const closed = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        status: JOB_STATUS.CLOSED,
        title: "Closed",
      });
      const expired = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        status: JOB_STATUS.EXPIRED,
        applicationDeadline: PAST_DEADLINE(),
        title: "Expired",
      });

      const result = await listManagedJobs({ actorUser: primary.user });
      const ids = result.managedJobs.map((item) => item.job.id).sort();

      expect(ids).toEqual(
        [published._id.toString(), closed._id.toString(), expired._id.toString()].sort(),
      );
      expect(
        result.managedJobs.map((item) => item.job.status).sort(),
      ).toEqual(
        [JOB_STATUS.PUBLISHED, JOB_STATUS.CLOSED, JOB_STATUS.EXPIRED].sort(),
      );
    });
  });

  describe("service — getManagedJobPipelineWorkspace", () => {
    it("groups Applications into the eight canonical Recruitment Statuses (BR-43)", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.pipeline",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });

      for (const [index, status] of PIPELINE_STATUSES.entries()) {
        const candidate = await createVerifiedUser({
          email: `cand.pipeline.${index}@example.com`,
        });
        await createDirectApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status,
          assignedRecruiterCompanyMemberId:
            status === APPLICATION_STATUS.APPLIED
              ? null
              : supporting.membership._id,
          version: status === APPLICATION_STATUS.APPLIED ? 0 : 1,
          appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
        });
      }

      const workspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });

      expect(Object.keys(workspace.pipeline).sort()).toEqual(
        [...PIPELINE_STATUSES].sort(),
      );
      for (const status of PIPELINE_STATUSES) {
        expect(workspace.pipeline[status]).toHaveLength(1);
        expect(workspace.countsByStatus[status]).toBe(1);
      }
      expect(workspace.applicationCount).toBe(8);
      expect(workspace.unassignedCount).toBe(1);
      expect(workspace.unassignedApplications).toHaveLength(1);
      expect(workspace.unassignedApplications[0].isUnassigned).toBe(true);
    });

    it("treats legacy missing assignee and explicit null as Unassigned (BR-05)", async () => {
      const { primary } = await setupCompany({
        emailPrefix: "v10.s11.unassigned",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
      });
      const candidateNull = await createVerifiedUser({
        email: "cand.null@example.com",
      });
      const candidateLegacy = await createVerifiedUser({
        email: "cand.legacy@example.com",
      });

      await createDirectApplication({
        candidateUserId: candidateNull.user._id,
        jobId: job._id,
        assignedRecruiterCompanyMemberId: null,
      });
      const legacy = await insertLegacyMissingAssigneeApplication({
        candidateUserId: candidateLegacy.user._id,
        jobId: job._id,
      });

      const persistedLegacy = await Application.collection.findOne({
        _id: legacy._id,
      });
      expect(persistedLegacy).not.toHaveProperty(
        "assignedRecruiterCompanyMemberId",
      );
      expect(isApplicationUnassigned(persistedLegacy)).toBe(true);

      const workspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });

      expect(workspace.unassignedCount).toBe(2);
      expect(workspace.unassignedApplications).toHaveLength(2);
      expect(
        workspace.unassignedApplications.every((item) => item.isUnassigned),
      ).toBe(true);
      expect(workspace.countsByStatus[APPLICATION_STATUS.APPLIED]).toBe(2);
      expect(
        PIPELINE_STATUSES.includes("UNASSIGNED"),
      ).toBe(false);
      expect(workspace.pipeline).not.toHaveProperty("UNASSIGNED");
    });

    it("places Assigned Applications under the current Assignee", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.assignee",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.assignee@example.com",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const workspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });

      expect(workspace.pipeline.SCREENING[0]).toMatchObject({
        assignedRecruiterCompanyMemberId: supporting.membership._id.toString(),
        isUnassigned: false,
      });
      expect(workspace.pipeline.SCREENING[0].assignedRecruiter).toMatchObject({
        companyMemberId: supporting.membership._id.toString(),
        fullName: "Supporting Recruiter",
      });
    });
  });

  describe("service — Current Workload (F10 / BR-33–BR-35)", () => {
    it("counts only non-terminal Applications and excludes HIRED/REJECTED/WITHDRAWN", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.workload.terminal",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });

      const statuses = [
        APPLICATION_STATUS.APPLIED,
        APPLICATION_STATUS.SCREENING,
        APPLICATION_STATUS.HIRED,
        APPLICATION_STATUS.REJECTED,
        APPLICATION_STATUS.WITHDRAWN,
      ];

      for (const [index, status] of statuses.entries()) {
        const candidate = await createVerifiedUser({
          email: `cand.wl.${index}@example.com`,
        });
        await createDirectApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status,
          assignedRecruiterCompanyMemberId: supporting.membership._id,
          version: 1,
          appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
        });
      }

      const workspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });

      expect(
        workloadEntry(workspace.currentWorkloadByAssignee, supporting.membership._id),
      ).toEqual({
        companyMemberId: supporting.membership._id.toString(),
        count: 2,
      });
    });

    it("includes non-terminal Applications on CLOSED and EXPIRED Jobs", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.workload.jobstatus",
      });
      const closed = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        status: JOB_STATUS.CLOSED,
        title: "Closed Workload",
      });
      const expired = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        status: JOB_STATUS.EXPIRED,
        applicationDeadline: PAST_DEADLINE(),
        title: "Expired Workload",
      });

      const candidateClosed = await createVerifiedUser({
        email: "cand.closed.wl@example.com",
      });
      const candidateExpired = await createVerifiedUser({
        email: "cand.expired.wl@example.com",
      });

      await createDirectApplication({
        candidateUserId: candidateClosed.user._id,
        jobId: closed._id,
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });
      await createDirectApplication({
        candidateUserId: candidateExpired.user._id,
        jobId: expired._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const list = await listManagedJobs({ actorUser: primary.user });
      expect(
        workloadEntry(list.currentWorkloadByAssignee, supporting.membership._id),
      ).toEqual({
        companyMemberId: supporting.membership._id.toString(),
        count: 2,
      });

      const closedWorkspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: closed._id.toString(),
      });
      expect(
        workloadEntry(
          closedWorkspace.currentWorkloadByAssignee,
          supporting.membership._id,
        ).count,
      ).toBe(1);

      const expiredWorkspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: expired._id.toString(),
      });
      expect(
        workloadEntry(
          expiredWorkspace.currentWorkloadByAssignee,
          supporting.membership._id,
        ).count,
      ).toBe(1);
    });

    it("moves derived workload from A to B on Reassign (BR-34)", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.workload.reassign",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.reassign.wl@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const before = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });
      expect(
        workloadEntry(before.currentWorkloadByAssignee, supporting.membership._id)
          .count,
      ).toBe(1);
      expect(
        workloadEntry(before.currentWorkloadByAssignee, primary.membership._id),
      ).toBeUndefined();

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const after = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });
      expect(
        workloadEntry(after.currentWorkloadByAssignee, supporting.membership._id),
      ).toBeUndefined();
      expect(
        workloadEntry(after.currentWorkloadByAssignee, primary.membership._id)
          .count,
      ).toBe(1);
      expect(after.pipeline.SCREENING[0].assignedRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
    });

    it("removes Application from workload after terminal Pipeline transition", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.workload.reject",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.reject.wl@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.REJECTED,
        expectedStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: 1,
      });

      const workspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });

      expect(workspace.currentWorkloadByAssignee).toEqual([]);
      expect(workspace.pipeline.REJECTED).toHaveLength(1);
      expect(workspace.countsByStatus[APPLICATION_STATUS.REJECTED]).toBe(1);
    });

    it("scopes Primary-visible workload to Managed Jobs only, not company-global", async () => {
      const { primary, supporting, peerPrimary } = await setupCompany({
        emailPrefix: "v10.s11.workload.scope",
      });
      const jobA = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "Job A",
      });
      const jobB = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: peerPrimary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "Job B",
      });

      for (let index = 0; index < 3; index += 1) {
        const candidate = await createVerifiedUser({
          email: `cand.joba.${index}@example.com`,
        });
        await createDirectApplication({
          candidateUserId: candidate.user._id,
          jobId: jobA._id,
          status: APPLICATION_STATUS.SCREENING,
          assignedRecruiterCompanyMemberId: supporting.membership._id,
          version: 1,
          appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
        });
      }

      for (let index = 0; index < 5; index += 1) {
        const candidate = await createVerifiedUser({
          email: `cand.jobb.${index}@example.com`,
        });
        await createDirectApplication({
          candidateUserId: candidate.user._id,
          jobId: jobB._id,
          status: APPLICATION_STATUS.CONTACTED,
          assignedRecruiterCompanyMemberId: supporting.membership._id,
          version: 1,
          appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
        });
      }

      const primaryView = await listManagedJobs({ actorUser: primary.user });
      expect(
        workloadEntry(
          primaryView.currentWorkloadByAssignee,
          supporting.membership._id,
        ).count,
      ).toBe(3);

      const peerView = await listManagedJobs({ actorUser: peerPrimary.user });
      expect(
        workloadEntry(
          peerView.currentWorkloadByAssignee,
          supporting.membership._id,
        ).count,
      ).toBe(5);

      const jobAWorkspace = await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: jobA._id.toString(),
      });
      expect(
        workloadEntry(
          jobAWorkspace.currentWorkloadByAssignee,
          supporting.membership._id,
        ).count,
      ).toBe(3);
    });
  });

  describe("authorization and read-only semantics", () => {
    it("denies cross-tenant and non-Primary workspace access", async () => {
      const local = await setupCompany({ emailPrefix: "v10.s11.auth.a" });
      const foreign = await setupCompany({ emailPrefix: "v10.s11.auth.b" });
      const job = await createJob({
        companyId: local.primary.membership.companyId,
        primaryMemberId: local.primary.membership._id,
        supportingMemberIds: [local.supporting.membership._id],
      });

      await expect(
        getManagedJobPipelineWorkspace({
          actorUser: local.supporting.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        getManagedJobPipelineWorkspace({
          actorUser: foreign.primary.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        listManagedJobs({ actorUser: foreign.primary.user }),
      ).resolves.toMatchObject({ managedJobs: [] });
    });

    it("does not mutate Job or Application on Managed Jobs / workspace reads", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.readonly",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.readonly.s11@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 2,
      });

      const jobBefore = await Job.findById(job._id).lean();
      const appBefore = await Application.findById(application._id).lean();

      await listManagedJobs({ actorUser: primary.user });
      await getManagedJobPipelineWorkspace({
        actorUser: primary.user,
        jobId: job._id.toString(),
      });

      const jobAfter = await Job.findById(job._id).lean();
      const appAfter = await Application.findById(application._id).lean();

      expect(jobAfter.status).toBe(jobBefore.status);
      expect(String(jobAfter.primaryRecruiterCompanyMemberId)).toBe(
        String(jobBefore.primaryRecruiterCompanyMemberId),
      );
      expect(jobAfter.updatedAt.getTime()).toBe(jobBefore.updatedAt.getTime());
      expect(appAfter.status).toBe(appBefore.status);
      expect(String(appAfter.assignedRecruiterCompanyMemberId)).toBe(
        String(appBefore.assignedRecruiterCompanyMemberId),
      );
      expect(appAfter.version).toBe(appBefore.version);
      expect(appAfter.submittedCvSnapshot).toEqual(appBefore.submittedCvSnapshot);
      expect(appAfter.updatedAt.getTime()).toBe(appBefore.updatedAt.getTime());
    });
  });

  describe("HTTP — Managed Jobs and Pipeline Workspace", () => {
    it("returns Managed Jobs and workspace for authenticated Primary", async () => {
      const agent = createTestAgent();
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.http",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "HTTP Managed",
      });
      const candidate = await createVerifiedUser({
        email: "cand.http.s11@example.com",
        fullName: "HTTP Candidate",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });

      const managedResponse = await agent
        .get("/api/jobs/managed")
        .set("Authorization", `Bearer ${token}`);

      expect(managedResponse.status).toBe(200);
      expect(managedResponse.body.managedJobs).toHaveLength(1);
      expect(managedResponse.body.managedJobs[0].job.title).toBe("HTTP Managed");
      expect(
        workloadEntry(
          managedResponse.body.currentWorkloadByAssignee,
          supporting.membership._id,
        ).count,
      ).toBe(1);

      const workspaceResponse = await agent
        .get(`/api/jobs/${job._id}/workspace`)
        .set("Authorization", `Bearer ${token}`);

      expect(workspaceResponse.status).toBe(200);
      expect(workspaceResponse.body.pipeline.SCREENING).toHaveLength(1);
      expect(workspaceResponse.body.pipeline.SCREENING[0].candidate.fullName).toBe(
        "HTTP Candidate",
      );
      expect(workspaceResponse.body.unassignedCount).toBe(0);
    });

    it("blocks Supporting on workspace and non-Recruiter roles on Managed Jobs surfaces", async () => {
      const agent = createTestAgent();
      const { manager, primary, supporting } = await setupCompany({
        emailPrefix: "v10.s11.http.deny",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.deny.s11@example.com",
      });
      const platformAdmin = await User.create({
        fullName: "Platform Admin",
        email: "pa.v10.s11@example.com",
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        role: USER_ROLE.PLATFORM_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
      });

      const supportingToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: candidate.user.email,
        password: DEFAULT_PASSWORD,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: platformAdmin.email,
        password: DEFAULT_PASSWORD,
      });

      const supportingManaged = await agent
        .get("/api/jobs/managed")
        .set("Authorization", `Bearer ${supportingToken}`);
      expect(supportingManaged.status).toBe(200);
      expect(supportingManaged.body.managedJobs).toEqual([]);

      const supportingWorkspace = await agent
        .get(`/api/jobs/${job._id}/workspace`)
        .set("Authorization", `Bearer ${supportingToken}`);
      expect(supportingWorkspace.status).toBe(403);

      for (const token of [managerToken, candidateToken, adminToken]) {
        const managedResponse = await agent
          .get("/api/jobs/managed")
          .set("Authorization", `Bearer ${token}`);
        expect(managedResponse.status).toBe(403);

        const workspaceResponse = await agent
          .get(`/api/jobs/${job._id}/workspace`)
          .set("Authorization", `Bearer ${token}`);
        expect(workspaceResponse.status).toBe(403);
      }
    });
  });
});
