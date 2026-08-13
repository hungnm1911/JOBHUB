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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  automaticallyUnassignApplication,
  automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob,
  automaticallyUnassignRecruiterApplicationsOnJobForTeamRemoval,
  firstAssignApplication,
  reassignApplication,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import {
  removeSupportingRecruiter,
  replacePrimaryRecruiter,
} from "../../src/services/job.service.js";
import { lockCompany } from "../../src/services/platform-admin.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T08:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T08:00:00.000Z");

const NON_TERMINAL_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
];

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s08.pdf",
    originalFileName: "v10-s08.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createJobWithTeam = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  status = JOB_STATUS.PUBLISHED,
  title = "Team Removal Job",
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
  status = APPLICATION_STATUS.SCREENING,
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

const setupTeamCompany = async ({ emailPrefix }) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    fullName: "Primary Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-P`,
    jobTitle: "Primary",
  });
  const supporting = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting@example.com`,
    fullName: "Supporting Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
    jobTitle: "Supporting",
  });
  const supportingB = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting.b@example.com`,
    fullName: "Supporting B",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-SB`,
    jobTitle: "Supporting B",
  });
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Slice 08 Candidate",
  });

  return { manager, primary, supporting, supportingB, candidate };
};

describe("V10 Slice 08 — Recruitment Team removal automatic Unassign", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("Supporting removal Unassigns affected Applications of that Job (A → NONE)", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.remove.published",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
      status: JOB_STATUS.PUBLISHED,
    });
    const snapshot = buildUploadedSnapshot({ name: "remove-published" });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
      submittedCvSnapshot: snapshot,
    });
    const before = await Application.findById(application._id).lean();

    const team = await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });

    expect(team.supportingRecruiterCompanyMemberIds).not.toContain(
      ctx.supporting.membership._id.toString(),
    );

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
    expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
    expect(String(after.jobId)).toBe(String(before.jobId));
    expect(after.source).toBe(before.source);
    expect(after.version).toBe(before.version + 1);
  });

  for (const [index, jobStatus] of [
    JOB_STATUS.CLOSED,
    JOB_STATUS.EXPIRED,
  ].entries()) {
    it(`Job-scoped automatic Unassign works on ${jobStatus} Applications without Job-status gate`, async () => {
      const ctx = await setupTeamCompany({
        emailPrefix: `v10.s08.unassign.${index}`,
      });
      const job = await createJobWithTeam({
        companyId: ctx.manager.company._id,
        primaryMemberId: ctx.primary.membership._id,
        supportingMemberIds: [ctx.supporting.membership._id],
        status: jobStatus,
        title: `Unassign ${jobStatus}`,
      });
      const snapshot = buildUploadedSnapshot({
        name: `unassign-${jobStatus}`,
      });
      const application = await createAssignedApplication({
        candidateUserId: ctx.candidate.user._id,
        jobId: job._id,
        assigneeMemberId: ctx.supporting.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
        submittedCvSnapshot: snapshot,
      });
      const before = await Application.findById(application._id).lean();

      // V6 BR-30: team removal mutation itself remains PUBLISHED-only.
      await expect(
        removeSupportingRecruiter({
          actorUser: ctx.manager.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId:
            ctx.supporting.membership._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      // Application detach for team-removal context has no Job-status gate.
      await automaticallyUnassignRecruiterApplicationsOnJobForTeamRemoval({
        jobId: job._id,
        outgoingCompanyMemberId: ctx.supporting.membership._id,
      });

      const after = await Application.findById(application._id).lean();
      expect(after.assignedRecruiterCompanyMemberId).toBeNull();
      expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(after.version).toBe(before.version + 1);

      const persistedJob = await Job.findById(job._id).lean();
      expect(
        (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
      ).toContain(ctx.supporting.membership._id.toString());
    });
  }

  it("outgoing Primary leave-team Unassigns Applications (A → NONE), not new Primary", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.primary.leave",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.primary.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const before = await Application.findById(application._id).lean();

    const team = await replacePrimaryRecruiter({
      managerUser: ctx.manager.user,
      jobId: job._id.toString(),
      newPrimaryCompanyMemberId: ctx.supporting.membership._id.toString(),
      keepOldPrimaryAsSupporting: false,
    });

    expect(team.primaryRecruiterCompanyMemberId).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(team.supportingRecruiterCompanyMemberIds).not.toContain(
      ctx.primary.membership._id.toString(),
    );

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(String(after.assignedRecruiterCompanyMemberId)).not.toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
    expect(after.version).toBe(before.version + 1);
  });

  it("Primary → Supporting while still eligible keeps Application assignment", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.primary.keep",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.primary.membership._id,
      status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    });
    const before = await Application.findById(application._id).lean();

    const team = await replacePrimaryRecruiter({
      managerUser: ctx.manager.user,
      jobId: job._id.toString(),
      newPrimaryCompanyMemberId: ctx.supporting.membership._id.toString(),
      keepOldPrimaryAsSupporting: true,
    });

    expect(team.primaryRecruiterCompanyMemberId).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(team.supportingRecruiterCompanyMemberIds).toContain(
      ctx.primary.membership._id.toString(),
    );

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(after.status).toBe(before.status);
    expect(after.version).toBe(before.version);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
  });

  it("Supporting → Primary while still eligible keeps Application assignment", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.supporting.promote",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
    });
    const before = await Application.findById(application._id).lean();

    const team = await replacePrimaryRecruiter({
      managerUser: ctx.manager.user,
      jobId: job._id.toString(),
      newPrimaryCompanyMemberId: ctx.supporting.membership._id.toString(),
      keepOldPrimaryAsSupporting: true,
    });

    expect(team.primaryRecruiterCompanyMemberId).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(after.status).toBe(before.status);
    expect(after.version).toBe(before.version);
  });

  for (const [index, status] of NON_TERMINAL_STATUSES.entries()) {
    it(`Unassigns ${status} Application on Supporting removal`, async () => {
      const ctx = await setupTeamCompany({
        emailPrefix: `v10.s08.status.${index}`,
      });
      const job = await createJobWithTeam({
        companyId: ctx.manager.company._id,
        primaryMemberId: ctx.primary.membership._id,
        supportingMemberIds: [ctx.supporting.membership._id],
      });
      const application = await createAssignedApplication({
        candidateUserId: ctx.candidate.user._id,
        jobId: job._id,
        assigneeMemberId: ctx.supporting.membership._id,
        status,
      });

      await removeSupportingRecruiter({
        actorUser: ctx.manager.user,
        jobId: job._id.toString(),
        supportingRecruiterCompanyMemberId:
          ctx.supporting.membership._id.toString(),
      });

      const after = await Application.findById(application._id).lean();
      expect(after.assignedRecruiterCompanyMemberId).toBeNull();
      expect(after.status).toBe(status);
    });
  }

  it("does not Unassign terminal Applications and keeps final Assignee", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.terminal",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const hired = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.HIRED,
    });
    const rejectedCandidate = await createVerifiedUser({
      email: "v10.s08.terminal.rejected@example.com",
    });
    const rejected = await createAssignedApplication({
      candidateUserId: rejectedCandidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.REJECTED,
    });

    await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });

    const hiredAfter = await Application.findById(hired._id).lean();
    const rejectedAfter = await Application.findById(rejected._id).lean();
    expect(String(hiredAfter.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(String(rejectedAfter.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const persistedJob = await Job.findById(job._id).lean();
    expect(
      (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).not.toContain(ctx.supporting.membership._id.toString());
  });

  it("does not require Application replacement and does not Assign to Primary", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.noreplacement",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
    });

    await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(String(after.assignedRecruiterCompanyMemberId)).not.toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.INTERVIEW_COMPLETED);
  });

  it("only Unassigns Applications of the mutated Job", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.job.scope",
    });
    const jobA = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
      title: "Job A",
    });
    const jobB = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
      title: "Job B",
    });
    const candidateB = await createVerifiedUser({
      email: "v10.s08.job.scope.candidate.b@example.com",
    });
    const appA = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: jobA._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const appB = await createAssignedApplication({
      candidateUserId: candidateB.user._id,
      jobId: jobB._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: jobA._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });

    const afterA = await Application.findById(appA._id).lean();
    const afterB = await Application.findById(appB._id).lean();
    expect(afterA.assignedRecruiterCompanyMemberId).toBeNull();
    expect(String(afterB.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const persistedB = await Job.findById(jobB._id).lean();
    expect(
      (persistedB.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).toContain(ctx.supporting.membership._id.toString());
  });

  it("keeps partial multi-Application Unassign progress and retry continues from current state", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.partial",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const candidate2 = await createVerifiedUser({
      email: "v10.s08.partial.c2@example.com",
    });
    const candidate3 = await createVerifiedUser({
      email: "v10.s08.partial.c3@example.com",
    });
    const app1 = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.APPLIED,
    });
    const app2 = await createAssignedApplication({
      candidateUserId: candidate2.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const app3 = await createAssignedApplication({
      candidateUserId: candidate3.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    await automaticallyUnassignApplication({
      applicationId: app1._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 1,
    });
    await reassignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: app2._id.toString(),
      assigneeCompanyMemberId: ctx.primary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const firstPass =
      await automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob({
        outgoingRecruiterCompanyMemberId: ctx.supporting.membership._id.toString(),
        jobId: job._id.toString(),
      });
    expect(firstPass.detached).toHaveLength(1);
    expect(String(firstPass.detached[0]._id)).toBe(String(app3._id));
    expect(firstPass.detached[0].assignedRecruiterCompanyMemberId).toBeNull();

    const retry =
      await automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob({
        outgoingRecruiterCompanyMemberId: ctx.supporting.membership._id.toString(),
        jobId: job._id.toString(),
      });
    expect(retry.detached).toHaveLength(0);
    expect(retry.failed).toHaveLength(0);

    const after = await Promise.all(
      [app1, app2, app3].map((application) =>
        Application.findById(application._id).lean(),
      ),
    );
    expect(after[0].assignedRecruiterCompanyMemberId).toBeNull();
    expect(String(after[1].assignedRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(after[2].assignedRecruiterCompanyMemberId).toBeNull();
  });

  it("stale automatic Unassign does not clear a newer Assignee", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.stale",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await reassignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: ctx.primary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    await expect(
      automaticallyUnassignApplication({
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(after.version).toBe(2);
  });

  it("Primary leave with ineligible successor Unassigns Applications then blocks Job-team transfer (TX-05 partial)", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.partial.primary",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.primary.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await User.updateOne(
      { _id: ctx.supporting.user._id },
      { $set: { status: USER_STATUS.LOCKED } },
    );

    await expect(
      replacePrimaryRecruiter({
        managerUser: ctx.manager.user,
        jobId: job._id.toString(),
        newPrimaryCompanyMemberId: ctx.supporting.membership._id.toString(),
        keepOldPrimaryAsSupporting: false,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const persistedJob = await Job.findById(job._id).lean();
    expect(String(persistedJob.primaryRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
  });

  it("First Assign race with Supporting removal cannot leave off-team + active Application", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.concurrent.assign",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const results = await Promise.allSettled([
      removeSupportingRecruiter({
        actorUser: ctx.manager.user,
        jobId: job._id.toString(),
        supportingRecruiterCompanyMemberId:
          ctx.supporting.membership._id.toString(),
      }),
      firstAssignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: unassigned._id.toString(),
        assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const persistedJob = await Job.findById(job._id).lean();
    const application = await Application.findById(unassigned._id).lean();
    const stillSupporting = (persistedJob.supportingRecruiterCompanyMemberIds ?? [])
      .map(String)
      .includes(ctx.supporting.membership._id.toString());

    if (!stillSupporting) {
      expect(String(application.assignedRecruiterCompanyMemberId)).not.toBe(
        ctx.supporting.membership._id.toString(),
      );
      expect(
        results.some(
          (item) =>
            item.status === "fulfilled" &&
            item.value?.primaryRecruiterCompanyMemberId ===
              ctx.primary.membership._id.toString(),
        ),
      ).toBe(true);
    } else {
      expect(String(application.assignedRecruiterCompanyMemberId)).toBe(
        ctx.supporting.membership._id.toString(),
      );
      expect(
        results.some(
          (item) =>
            item.status === "rejected" && item.reason?.statusCode === 409,
        ),
      ).toBe(true);
    }
  });

  it("Reassign onto outgoing Supporting before removal completion is visible to final guard", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.concurrent.reassign",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [
        ctx.supporting.membership._id,
        ctx.supportingB.membership._id,
      ],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supportingB.membership._id,
      status: APPLICATION_STATUS.APPLIED,
    });

    const results = await Promise.allSettled([
      removeSupportingRecruiter({
        actorUser: ctx.manager.user,
        jobId: job._id.toString(),
        supportingRecruiterCompanyMemberId:
          ctx.supporting.membership._id.toString(),
      }),
      reassignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          ctx.supportingB.membership._id.toString(),
        expectedVersion: 1,
      }),
    ]);

    const persistedJob = await Job.findById(job._id).lean();
    const after = await Application.findById(application._id).lean();
    const stillSupporting = (persistedJob.supportingRecruiterCompanyMemberIds ?? [])
      .map(String)
      .includes(ctx.supporting.membership._id.toString());

    if (!stillSupporting) {
      expect(String(after.assignedRecruiterCompanyMemberId)).not.toBe(
        ctx.supporting.membership._id.toString(),
      );
    } else {
      expect([
        ctx.supporting.membership._id.toString(),
        ctx.supportingB.membership._id.toString(),
      ]).toContain(String(after.assignedRecruiterCompanyMemberId));
      expect(
        results.some(
          (item) =>
            item.status === "rejected" && item.reason?.statusCode === 409,
        ),
      ).toBe(true);
    }
  });

  it("team-removal vs Pipeline: removal Unassign wins over stale Pipeline (TX-02)", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.pipeline.after",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: ctx.supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.CONTACTED,
        expectedStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: expect.any(Number) });

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
  });

  it("Pipeline that commits before team removal is preserved through A → NONE", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.pipeline.before",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.supporting.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
  });

  it("Company lock keeps Application assignment and does not reassign/unassign", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s08.companylock",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const before = await Application.findById(application._id).lean();

    await lockCompany({ companyId: ctx.manager.company._id.toString() });

    const company = await Company.findById(ctx.manager.company._id).lean();
    expect(company.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      String(before.assignedRecruiterCompanyMemberId),
    );
    expect(after.status).toBe(before.status);
    expect(after.version).toBe(before.version);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);

    const persistedJob = await Job.findById(job._id).lean();
    expect(String(persistedJob.primaryRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(
      (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).toContain(ctx.supporting.membership._id.toString());
  });
});
