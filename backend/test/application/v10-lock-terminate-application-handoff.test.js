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
import Application from "../../src/models/application.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import {
  firstAssignApplication,
  reassignApplication,
} from "../../src/services/application.service.js";
import {
  lockRecruiter,
  terminateRecruiter,
} from "../../src/services/recruiter.service.js";
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
  title = "Lifecycle Job",
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

const setupLifecycleCompany = async ({ emailPrefix }) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const outgoing = await createActiveRecruiterContext({
    email: `${emailPrefix}.outgoing@example.com`,
    fullName: "Outgoing Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-O`,
    jobTitle: "Outgoing",
  });
  const replacement = await createActiveRecruiterContext({
    email: `${emailPrefix}.replacement@example.com`,
    fullName: "Replacement Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-R`,
    jobTitle: "Replacement",
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

  return { manager, outgoing, replacement, supportingB, candidate };
};

describe("V10 Slice 08 — LOCK/TERMINATE unified responsibility handoff", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  for (const lifecycleAction of [
    { name: "LOCK", run: lockRecruiter, status: COMPANY_MEMBER_STATUS.LOCKED },
    {
      name: "TERMINATE",
      run: terminateRecruiter,
      status: COMPANY_MEMBER_STATUS.TERMINATED,
    },
  ]) {
    describe(`${lifecycleAction.name} with Application responsibility`, () => {
      for (const [index, jobStatus] of [
        JOB_STATUS.PUBLISHED,
        JOB_STATUS.CLOSED,
        JOB_STATUS.EXPIRED,
      ].entries()) {
        it(`hands off non-terminal Application on ${jobStatus} Job before ${lifecycleAction.name}`, async () => {
          const ctx = await setupLifecycleCompany({
            emailPrefix: `v10.s08.${lifecycleAction.name.toLowerCase()}.${index}`,
          });
          const job = await createJobWithTeam({
            companyId: ctx.manager.company._id,
            primaryMemberId: ctx.outgoing.membership._id,
            supportingMemberIds: [ctx.replacement.membership._id],
            status: jobStatus,
            title: `${lifecycleAction.name} ${jobStatus}`,
          });
          const snapshot = buildUploadedSnapshot({
            name: `${lifecycleAction.name}-${jobStatus}`,
          });
          const application = await createAssignedApplication({
            candidateUserId: ctx.candidate.user._id,
            jobId: job._id,
            assigneeMemberId: ctx.outgoing.membership._id,
            status: APPLICATION_STATUS.CONTACTED,
            submittedCvSnapshot: snapshot,
          });
          const before = await Application.findById(application._id).lean();

          const transfers =
            jobStatus === JOB_STATUS.PUBLISHED
              ? [
                  {
                    jobId: job._id.toString(),
                    replacementCompanyMemberId:
                      ctx.replacement.membership._id.toString(),
                  },
                ]
              : [
                  {
                    jobId: job._id.toString(),
                    replacementCompanyMemberId:
                      ctx.replacement.membership._id.toString(),
                  },
                ];

          const result = await lifecycleAction.run({
            managerUser: ctx.manager.user,
            recruiterId: ctx.outgoing.user._id.toString(),
            transfers,
          });

          expect(result.membership.status).toBe(lifecycleAction.status);

          const after = await Application.findById(application._id).lean();
          expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
            ctx.replacement.membership._id.toString(),
          );
          expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
          expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
          expect(String(after.candidateUserId)).toBe(
            String(before.candidateUserId),
          );
          expect(String(after.jobId)).toBe(String(before.jobId));
          expect(after.source).toBe(before.source);
          expect(after.version).toBe(before.version + 1);
          expect(after.assignedRecruiterCompanyMemberId).not.toBeNull();
        });
      }
    });
  }

  it("handles both Job-team and Application responsibility before LOCK", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s08.both",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.outgoing.membership._id,
      supportingMemberIds: [
        ctx.replacement.membership._id,
        ctx.supportingB.membership._id,
      ],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await lockRecruiter({
      managerUser: ctx.manager.user,
      recruiterId: ctx.outgoing.user._id.toString(),
      transfers: [
        {
          jobId: job._id.toString(),
          replacementCompanyMemberId: ctx.replacement.membership._id.toString(),
        },
      ],
    });

    const persistedJob = await Job.findById(job._id).lean();
    expect(String(persistedJob.primaryRecruiterCompanyMemberId)).toBe(
      ctx.replacement.membership._id.toString(),
    );
    expect(
      (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).not.toContain(ctx.outgoing.membership._id.toString());

    const persistedApp = await Application.findById(application._id).lean();
    expect(String(persistedApp.assignedRecruiterCompanyMemberId)).toBe(
      ctx.replacement.membership._id.toString(),
    );

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("does not rewrite terminal Applications and still completes LOCK", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s08.terminal",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const hired = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.HIRED,
    });
    const rejectedCandidate = await createVerifiedUser({
      email: "v10.s08.terminal.rejected@example.com",
    });
    const rejected = await createAssignedApplication({
      candidateUserId: rejectedCandidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.REJECTED,
    });

    await lockRecruiter({
      managerUser: ctx.manager.user,
      recruiterId: ctx.outgoing.user._id.toString(),
      transfers: [],
    });

    const hiredAfter = await Application.findById(hired._id).lean();
    const rejectedAfter = await Application.findById(rejected._id).lean();
    expect(String(hiredAfter.assignedRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );
    expect(String(rejectedAfter.assignedRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("Supporting Application handoff uses current Primary without inventing another selector", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s08.supporting",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [
        ctx.outgoing.membership._id,
        ctx.supportingB.membership._id,
      ],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    });

    await terminateRecruiter({
      managerUser: ctx.manager.user,
      recruiterId: ctx.outgoing.user._id.toString(),
      transfers: [],
    });

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.replacement.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.INTERVIEW_SCHEDULED);

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
  });

  it("blocks lifecycle completion when required Application replacement is missing/invalid", async () => {
    const missing = await setupLifecycleCompany({
      emailPrefix: "v10.s08.missing",
    });
    const closedJob = await createJobWithTeam({
      companyId: missing.manager.company._id,
      primaryMemberId: missing.outgoing.membership._id,
      supportingMemberIds: [missing.replacement.membership._id],
      status: JOB_STATUS.CLOSED,
    });
    await createAssignedApplication({
      candidateUserId: missing.candidate.user._id,
      jobId: closedJob._id,
      assigneeMemberId: missing.outgoing.membership._id,
    });

    await expect(
      lockRecruiter({
        managerUser: missing.manager.user,
        recruiterId: missing.outgoing.user._id.toString(),
        transfers: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const stillActive = await CompanyMember.findById(
      missing.outgoing.membership._id,
    ).lean();
    expect(stillActive.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    const invalid = await setupLifecycleCompany({
      emailPrefix: "v10.s08.invalid",
    });
    const publishedJob = await createJobWithTeam({
      companyId: invalid.manager.company._id,
      primaryMemberId: invalid.outgoing.membership._id,
      supportingMemberIds: [invalid.replacement.membership._id],
    });
    await createAssignedApplication({
      candidateUserId: invalid.candidate.user._id,
      jobId: publishedJob._id,
      assigneeMemberId: invalid.outgoing.membership._id,
    });
    await CompanyMember.updateOne(
      { _id: invalid.replacement.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      lockRecruiter({
        managerUser: invalid.manager.user,
        recruiterId: invalid.outgoing.user._id.toString(),
        transfers: [
          {
            jobId: publishedJob._id.toString(),
            replacementCompanyMemberId:
              invalid.replacement.membership._id.toString(),
          },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const membership = await CompanyMember.findById(
      invalid.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("keeps partial Application handoff progress when a later handoff fails (TX-05)", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s08.partial",
    });
    const jobA = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.outgoing.membership._id,
      supportingMemberIds: [ctx.replacement.membership._id],
      title: "Job A",
    });
    const jobB = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [
        ctx.outgoing.membership._id,
        ctx.supportingB.membership._id,
      ],
      title: "Job B",
    });
    const appA = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: jobA._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const candidateB = await createVerifiedUser({
      email: "v10.s08.partial.candidate.b@example.com",
    });
    const appB = await createAssignedApplication({
      candidateUserId: candidateB.user._id,
      jobId: jobB._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    await CompanyMember.updateOne(
      { _id: ctx.supportingB.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [
          {
            jobId: jobA._id.toString(),
            replacementCompanyMemberId:
              ctx.replacement.membership._id.toString(),
          },
          {
            // Override Supporting Take-over context with an ineligible target.
            jobId: jobB._id.toString(),
            replacementCompanyMemberId:
              ctx.supportingB.membership._id.toString(),
          },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    const persistedA = await Application.findById(appA._id).lean();
    const persistedB = await Application.findById(appB._id).lean();
    expect(String(persistedA.assignedRecruiterCompanyMemberId)).toBe(
      ctx.replacement.membership._id.toString(),
    );
    expect(String(persistedB.assignedRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );

    const persistedJobA = await Job.findById(jobA._id).lean();
    expect(String(persistedJobA.primaryRecruiterCompanyMemberId)).toBe(
      ctx.replacement.membership._id.toString(),
    );
  });

  it("First Assign race with LOCK cannot leave LOCKED + active Application responsibility", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s08.race",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const results = await Promise.allSettled([
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [],
      }),
      firstAssignApplication({
        actorUser: ctx.replacement.user,
        jobId: job._id.toString(),
        applicationId: unassigned._id.toString(),
        assigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    const application = await Application.findById(unassigned._id).lean();

    if (membership.status === COMPANY_MEMBER_STATUS.LOCKED) {
      expect(application.assignedRecruiterCompanyMemberId).toBeNull();
      const lockResult = results.find(
        (item) =>
          item.status === "fulfilled" &&
          item.value?.membership?.status === COMPANY_MEMBER_STATUS.LOCKED,
      );
      expect(lockResult).toBeTruthy();
    } else {
      expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
      expect(String(application.assignedRecruiterCompanyMemberId)).toBe(
        ctx.outgoing.membership._id.toString(),
      );
      const rejectedLock = results.find(
        (item) =>
          item.status === "rejected" && item.reason?.statusCode === 409,
      );
      expect(rejectedLock).toBeTruthy();
    }
  });

  it("Reassign onto outgoing Recruiter before LOCK completion is visible to final guard", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s08.reassign.race",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [
        ctx.outgoing.membership._id,
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
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [],
      }),
      reassignApplication({
        actorUser: ctx.replacement.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
        expectedAssigneeCompanyMemberId:
          ctx.supportingB.membership._id.toString(),
        expectedVersion: 1,
      }),
    ]);

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    const persisted = await Application.findById(application._id).lean();

    if (membership.status === COMPANY_MEMBER_STATUS.LOCKED) {
      expect(String(persisted.assignedRecruiterCompanyMemberId)).not.toBe(
        ctx.outgoing.membership._id.toString(),
      );
    } else {
      expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
      expect([
        ctx.outgoing.membership._id.toString(),
        ctx.supportingB.membership._id.toString(),
      ]).toContain(String(persisted.assignedRecruiterCompanyMemberId));
      expect(
        results.some(
          (item) =>
            item.status === "rejected" && item.reason?.statusCode === 409,
        ),
      ).toBe(true);
    }
  });
});
