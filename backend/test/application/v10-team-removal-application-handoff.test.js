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
  executeTrustedTeamRemovalApplicationHandoffs,
  firstAssignApplication,
  reassignApplication,
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

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s09.pdf",
    originalFileName: "v10-s09.pdf",
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
    fullName: "Slice 09 Candidate",
  });

  return { manager, primary, supporting, supportingB, candidate };
};

describe("V10 Slice 09 — Recruitment Team eligibility-loss Application handoff", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("removes Supporting with assigned non-terminal Application after handoff on PUBLISHED Job", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.remove.published",
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
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
    expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
    expect(String(after.jobId)).toBe(String(before.jobId));
    expect(after.source).toBe(before.source);
    expect(after.version).toBe(before.version + 1);
    expect(after.assignedRecruiterCompanyMemberId).not.toBeNull();
  });

  for (const [index, jobStatus] of [
    JOB_STATUS.CLOSED,
    JOB_STATUS.EXPIRED,
  ].entries()) {
    it(`team-removal Application handoff path works on ${jobStatus} Job without Job-status gate`, async () => {
      const ctx = await setupTeamCompany({
        emailPrefix: `v10.s09.handoff.${index}`,
      });
      const job = await createJobWithTeam({
        companyId: ctx.manager.company._id,
        primaryMemberId: ctx.primary.membership._id,
        supportingMemberIds: [ctx.supporting.membership._id],
        status: jobStatus,
        title: `Handoff ${jobStatus}`,
      });
      const snapshot = buildUploadedSnapshot({
        name: `handoff-${jobStatus}`,
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

      // V10 Application handoff for team-removal context has no Job-status gate
      // (CLOSED/EXPIRED Applications still hand off A→B to current Primary).
      await executeTrustedTeamRemovalApplicationHandoffs({
        companyId: ctx.manager.company._id,
        jobId: job._id,
        outgoingCompanyMemberId: ctx.supporting.membership._id,
        replacementCompanyMemberId: ctx.primary.membership._id,
      });

      const after = await Application.findById(application._id).lean();
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        ctx.primary.membership._id.toString(),
      );
      expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(after.version).toBe(before.version + 1);

      const persistedJob = await Job.findById(job._id).lean();
      expect(
        (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
      ).toContain(ctx.supporting.membership._id.toString());
    });
  }

  it("hands off Applications before Primary leave-team transfer completes", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.primary.leave",
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
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
    expect(after.version).toBe(before.version + 1);
  });

  it("keeps existing Application assignment when Primary becomes Supporting", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.primary.keep",
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

  it("does not block team removal for terminal Applications and keeps final Assignee", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.terminal",
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
      email: "v10.s09.terminal.rejected@example.com",
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

  it("blocks team mutation when Application handoff target is ineligible", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.ineligible",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
    });

    await CompanyMember.updateOne(
      { _id: ctx.primary.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      removeSupportingRecruiter({
        actorUser: ctx.manager.user,
        jobId: job._id.toString(),
        supportingRecruiterCompanyMemberId:
          ctx.supporting.membership._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const persistedJob = await Job.findById(job._id).lean();
    expect(
      (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).toContain(ctx.supporting.membership._id.toString());

    const application = await Application.findOne({ jobId: job._id }).lean();
    expect(String(application.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
  });

  it("blocks Primary leave-team when successor cannot receive Application handoff", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.missing",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.primary.membership._id,
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
  });

  it("does not persist an Unassigned intermediate during Supporting removal handoff", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.nounassign",
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
    expect(after.assignedRecruiterCompanyMemberId).not.toBeNull();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.INTERVIEW_COMPLETED);
  });

  it("First Assign race with Supporting removal cannot leave off-team + active Application", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.concurrent.assign",
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
      emailPrefix: "v10.s09.concurrent.reassign",
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

  it("Company lock keeps Application assignment and does not reassign/unassign", async () => {
    const ctx = await setupTeamCompany({
      emailPrefix: "v10.s09.companylock",
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
