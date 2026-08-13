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

const NON_TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
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
    fullName: "Slice 07 Candidate",
  });

  return { manager, outgoing, replacement, supportingB, candidate };
};

describe("V10 Slice 07 — CompanyMember LOCK/TERMINATE automatic Unassign", () => {
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
        it(`automatically Unassigns non-terminal Application on ${jobStatus} Job before ${lifecycleAction.name}`, async () => {
          const ctx = await setupLifecycleCompany({
            emailPrefix: `v10.s07.${lifecycleAction.name.toLowerCase()}.${index}`,
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

          const result = await lifecycleAction.run({
            managerUser: ctx.manager.user,
            recruiterId: ctx.outgoing.user._id.toString(),
            transfers: [
              {
                jobId: job._id.toString(),
                replacementCompanyMemberId:
                  ctx.replacement.membership._id.toString(),
              },
            ],
          });

          expect(result.membership.status).toBe(lifecycleAction.status);

          const after = await Application.findById(application._id).lean();
          expect(after.assignedRecruiterCompanyMemberId).toBeNull();
          expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
          expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
          expect(String(after.candidateUserId)).toBe(
            String(before.candidateUserId),
          );
          expect(String(after.jobId)).toBe(String(before.jobId));
          expect(after.source).toBe(before.source);
          expect(after.version).toBe(before.version + 1);
        });
      }
    });
  }

  it("completes LOCK without Application replacement when only Application responsibility remains", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.no.app.replacement",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
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
      transfers: [],
    });

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const persistedJob = await Job.findById(job._id).lean();
    expect(String(persistedJob.primaryRecruiterCompanyMemberId)).toBe(
      ctx.replacement.membership._id.toString(),
    );
    expect(
      (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).not.toContain(ctx.outgoing.membership._id.toString());
  });

  it("detaches all five non-terminal statuses before TERMINATE", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.all.nonterminal",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });

    const applications = [];
    for (const [index, status] of NON_TERMINAL_STATUSES.entries()) {
      const candidate = await createVerifiedUser({
        email: `v10.s07.all.nonterminal.candidate.${index}@example.com`,
      });
      applications.push(
        await createAssignedApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          assigneeMemberId: ctx.outgoing.membership._id,
          status,
        }),
      );
    }

    await terminateRecruiter({
      managerUser: ctx.manager.user,
      recruiterId: ctx.outgoing.user._id.toString(),
      transfers: [],
    });

    for (const [index, application] of applications.entries()) {
      const after = await Application.findById(application._id).lean();
      expect(after.assignedRecruiterCompanyMemberId).toBeNull();
      expect(after.status).toBe(NON_TERMINAL_STATUSES[index]);
    }

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
  });

  it("handles both Job-team Primary transfer and Application Unassign before LOCK", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.both",
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
    expect(persistedApp.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persistedApp.status).toBe(APPLICATION_STATUS.SCREENING);

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("does not rewrite terminal Applications and still completes LOCK", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.terminal",
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
      email: "v10.s07.terminal.rejected@example.com",
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

  it("still requires V6 Primary replacement and does not create NONE Primary", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.primary.required",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.outgoing.membership._id,
      supportingMemberIds: [ctx.replacement.membership._id],
    });
    await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
    });

    await expect(
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { field: "primaryRecruiterCompanyMemberId" },
    });

    const stillActive = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(stillActive.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    const persistedJob = await Job.findById(job._id).lean();
    expect(String(persistedJob.primaryRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );

    const application = await Application.findOne({ jobId: job._id }).lean();
    expect(String(application.assignedRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );
  });

  it("blocks Primary transfer when Job-team replacement is ineligible", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.invalid.primary",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.outgoing.membership._id,
      supportingMemberIds: [ctx.replacement.membership._id],
    });
    await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
    });
    await CompanyMember.updateOne(
      { _id: ctx.replacement.membership._id },
      { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
    );

    await expect(
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [
          {
            jobId: job._id.toString(),
            replacementCompanyMemberId:
              ctx.replacement.membership._id.toString(),
          },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("keeps partial Application Unassign progress, blocks completion, and retries remaining current responsibilities (TX-05)", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.partial",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
      title: "Partial Unassign Job",
    });
    const appA = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const candidateB = await createVerifiedUser({
      email: "v10.s07.partial.candidate.b@example.com",
    });
    const appB = await createAssignedApplication({
      candidateUserId: candidateB.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    const orderedIds = [appA._id, appB._id]
      .map(String)
      .sort();
    const failingApplicationId = orderedIds[1];

    const originalFindOneAndUpdate =
      Application.findOneAndUpdate.bind(Application);
    vi.spyOn(Application, "findOneAndUpdate").mockImplementation(
      function mockFindOneAndUpdate(...args) {
        const [filter, update] = args;
        const isAutomaticUnassign =
          filter?.assignedRecruiterCompanyMemberId != null &&
          update?.$set &&
          Object.prototype.hasOwnProperty.call(
            update.$set,
            "assignedRecruiterCompanyMemberId",
          ) &&
          update.$set.assignedRecruiterCompanyMemberId === null;

        if (
          isAutomaticUnassign &&
          String(filter._id) === failingApplicationId
        ) {
          return Promise.resolve(null);
        }

        return originalFindOneAndUpdate.apply(this, args);
      },
    );

    await expect(
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    vi.restoreAllMocks();

    const membershipAfterFail = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membershipAfterFail.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    const persistedA = await Application.findById(appA._id).lean();
    const persistedB = await Application.findById(appB._id).lean();
    const unassignedCount = [
      persistedA.assignedRecruiterCompanyMemberId,
      persistedB.assignedRecruiterCompanyMemberId,
    ].filter((assignee) => assignee == null).length;
    const stillAssignedCount = [
      persistedA.assignedRecruiterCompanyMemberId,
      persistedB.assignedRecruiterCompanyMemberId,
    ].filter(
      (assignee) =>
        assignee != null &&
        String(assignee) === ctx.outgoing.membership._id.toString(),
    ).length;
    expect(unassignedCount).toBe(1);
    expect(stillAssignedCount).toBe(1);
    expect(persistedA.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(persistedB.status).toBe(APPLICATION_STATUS.CONTACTED);

    await lockRecruiter({
      managerUser: ctx.manager.user,
      recruiterId: ctx.outgoing.user._id.toString(),
      transfers: [],
    });

    const afterRetryA = await Application.findById(appA._id).lean();
    const afterRetryB = await Application.findById(appB._id).lean();
    expect(afterRetryA.assignedRecruiterCompanyMemberId).toBeNull();
    expect(afterRetryB.assignedRecruiterCompanyMemberId).toBeNull();

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });

  it("final guard does not commit LOCK on stale zero-responsibility state when Assign lands before completion (TX-02)", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.stale.zero",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.replacement.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const existing = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.APPLIED,
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: (
        await createVerifiedUser({
          email: "v10.s07.stale.zero.candidate.2@example.com",
        })
      ).user._id,
      jobId: job._id,
    });

    // Inject a valid Assign after Application Unassign but before Supporting
    // removal so outgoing is still team-eligible; the later final guard must
    // observe the new responsibility and block LOCK completion.
    let assignInjected = false;
    const originalFindOneAndUpdate = Job.findOneAndUpdate.bind(Job);
    vi.spyOn(Job, "findOneAndUpdate").mockImplementation(
      async function mockJobFindOneAndUpdate(...args) {
        const [, update] = args;
        const removesOutgoingSupporting =
          Array.isArray(update?.$pull?.supportingRecruiterCompanyMemberIds) ===
            false &&
          update?.$pull?.supportingRecruiterCompanyMemberIds != null &&
          String(update.$pull.supportingRecruiterCompanyMemberIds) ===
            String(ctx.outgoing.membership._id);

        if (removesOutgoingSupporting && !assignInjected) {
          assignInjected = true;
          await firstAssignApplication({
            actorUser: ctx.replacement.user,
            jobId: job._id.toString(),
            applicationId: unassigned._id.toString(),
            assigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
            expectedVersion: 0,
          });
        }

        return originalFindOneAndUpdate.apply(this, args);
      },
    );

    await expect(
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.outgoing.user._id.toString(),
        transfers: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(assignInjected).toBe(true);

    const existingAfter = await Application.findById(existing._id).lean();
    const newlyAssigned = await Application.findById(unassigned._id).lean();
    expect(existingAfter.assignedRecruiterCompanyMemberId).toBeNull();
    expect(String(newlyAssigned.assignedRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );
  });

  it("First Assign race with LOCK cannot leave LOCKED + active Application responsibility", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.race",
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

  it("Reassign onto outgoing Recruiter before LOCK completion is visible to final guard (TX-02)", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.reassign.race",
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

  it("stale automatic Unassign during LOCK does not clear an Assignee committed by concurrent Reassign (BR-36)", async () => {
    const ctx = await setupLifecycleCompany({
      emailPrefix: "v10.s07.stale.unassign",
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
      status: APPLICATION_STATUS.CONTACTED,
    });

    let concurrentReassignCommitted = false;
    const originalFindOneAndUpdate =
      Application.findOneAndUpdate.bind(Application);
    vi.spyOn(Application, "findOneAndUpdate").mockImplementation(
      async function mockFindOneAndUpdate(...args) {
        const [filter, update] = args;
        const isAutomaticUnassign =
          filter?.assignedRecruiterCompanyMemberId != null &&
          update?.$set &&
          Object.prototype.hasOwnProperty.call(
            update.$set,
            "assignedRecruiterCompanyMemberId",
          ) &&
          update.$set.assignedRecruiterCompanyMemberId === null &&
          String(filter._id) === String(application._id);

        if (isAutomaticUnassign && !concurrentReassignCommitted) {
          concurrentReassignCommitted = true;
          await Application.updateOne(
            {
              _id: application._id,
              version: 1,
              assignedRecruiterCompanyMemberId: ctx.outgoing.membership._id,
              status: APPLICATION_STATUS.CONTACTED,
            },
            {
              $set: {
                assignedRecruiterCompanyMemberId:
                  ctx.supportingB.membership._id,
              },
              $inc: { version: 1 },
            },
          );
        }

        return originalFindOneAndUpdate.apply(this, args);
      },
    );

    await lockRecruiter({
      managerUser: ctx.manager.user,
      recruiterId: ctx.outgoing.user._id.toString(),
      transfers: [],
    });

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supportingB.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(after.version).toBe(2);

    const membership = await CompanyMember.findById(
      ctx.outgoing.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
  });
});
