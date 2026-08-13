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
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import AuthSession from "../../src/models/auth-session.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  forceReassignApplication,
  reassignApplication,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import {
  lockAccount,
  terminateAccount,
} from "../../src/services/platform-admin.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
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
  name: "Slice 09 Snapshot",
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
  title = "Slice 09 Job",
}) =>
  Job.create({
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
}) =>
  Application.create({
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

const setupSlice09Company = async ({ emailPrefix }) => {
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
  const outgoing = await createActiveRecruiterContext({
    email: `${emailPrefix}.outgoing@example.com`,
    fullName: "Outgoing Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-O`,
    jobTitle: "Outgoing",
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
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.admin@example.com`,
    fullName: "Slice 09 Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
    password: DEFAULT_PASSWORD,
  });

  return {
    manager,
    primary,
    outgoing,
    supportingB,
    candidate,
    platformAdmin,
  };
};

const wrapQueryWithBarrier = (query, { onReady, hold }) => {
  const run = async () => {
    const document = await query;
    onReady();
    await hold;
    return document;
  };

  return {
    then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
    select: (...selectArgs) =>
      wrapQueryWithBarrier(query.select(...selectArgs), { onReady, hold }),
    session: (session) =>
      wrapQueryWithBarrier(query.session(session), { onReady, hold }),
  };
};

const installTransactionalFindByIdBarrier = (Model) => {
  const originalFindById = Model.findById.bind(Model);
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let armed = true;

  vi.spyOn(Model, "findById").mockImplementation((id, ...rest) => {
    const query = originalFindById(id, ...rest);
    const originalSession = query.session.bind(query);

    query.session = (session) => {
      const sessionQuery = originalSession(session);

      if (!armed) {
        return sessionQuery;
      }

      return wrapQueryWithBarrier(sessionQuery, {
        hold,
        onReady: () => {
          if (armed) {
            armed = false;
            resolveReady();
          }
        },
      });
    };

    return query;
  });

  return {
    awaitReady: () => ready,
    release: () => release(),
  };
};

const installUserEligibilityReadBarrier = () =>
  installTransactionalFindByIdBarrier(User);

const installUserLockSaveBarrier = () => {
  const originalSave = User.prototype.save;
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let armed = true;

  vi.spyOn(User.prototype, "save").mockImplementation(async function saveWithBarrier(
    ...args
  ) {
    if (armed && this.status === USER_STATUS.LOCKED) {
      armed = false;
      resolveReady();
      await hold;
    }

    return originalSave.apply(this, args);
  });

  return {
    awaitReady: () => ready,
    release: () => release(),
  };
};

describe("V10 Slice 09 — Platform Admin User LOCK/TERMINATE automatic Unassign", () => {
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

  for (const lifecycle of [
    {
      name: "LOCK",
      run: lockAccount,
      status: USER_STATUS.LOCKED,
    },
    {
      name: "TERMINATE",
      run: terminateAccount,
      status: USER_STATUS.TERMINATED,
    },
  ]) {
    it(`${lifecycle.name} automatic Unassigns all current non-terminal Applications (A → NONE)`, async () => {
      const ctx = await setupSlice09Company({
        emailPrefix: `v10.s09.${lifecycle.name.toLowerCase()}.core`,
      });
      const job = await createJobWithTeam({
        companyId: ctx.manager.company._id,
        primaryMemberId: ctx.primary.membership._id,
        supportingMemberIds: [ctx.outgoing.membership._id],
      });
      const snapshot = buildUploadedSnapshot({
        name: `${lifecycle.name}-core`,
      });
      const application = await createAssignedApplication({
        candidateUserId: ctx.candidate.user._id,
        jobId: job._id,
        assigneeMemberId: ctx.outgoing.membership._id,
        status: APPLICATION_STATUS.CONTACTED,
        submittedCvSnapshot: snapshot,
      });
      const before = await Application.findById(application._id).lean();
      const beforeJob = await Job.findById(job._id).lean();
      await AuthSession.create({
        userId: ctx.outgoing.user._id,
        refreshTokenHash: `v10-s09-${lifecycle.name.toLowerCase()}-session`,
        expiresAt: FUTURE_DEADLINE(),
      });

      const result = await lifecycle.run({
        targetUserId: ctx.outgoing.user._id.toString(),
        actorUserId: ctx.platformAdmin.user._id,
      });

      expect(result.status).toBe(lifecycle.status);
      expect((await User.findById(ctx.outgoing.user._id).lean()).status).toBe(
        lifecycle.status,
      );
      expect(
        await AuthSession.countDocuments({ userId: ctx.outgoing.user._id }),
      ).toBe(0);

      const after = await Application.findById(application._id).lean();
      expect(after.assignedRecruiterCompanyMemberId).toBeNull();
      expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.source).toBe(before.source);
      expect(after.version).toBe(before.version + 1);

      const membership = await CompanyMember.findById(
        ctx.outgoing.membership._id,
      ).lean();
      expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

      const afterJob = await Job.findById(job._id).lean();
      expect(String(afterJob.primaryRecruiterCompanyMemberId)).toBe(
        String(beforeJob.primaryRecruiterCompanyMemberId),
      );
      expect(
        (afterJob.supportingRecruiterCompanyMemberIds ?? []).map(String).sort(),
      ).toEqual(
        (beforeJob.supportingRecruiterCompanyMemberIds ?? [])
          .map(String)
          .sort(),
      );
    });
  }

  it("detaches all five non-terminal statuses on LOCK", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.all.nonterminal",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });

    const applications = [];
    for (const [index, status] of NON_TERMINAL_STATUSES.entries()) {
      const candidate = await createVerifiedUser({
        email: `v10.s09.all.nonterminal.candidate.${index}@example.com`,
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

    await lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    for (const [index, application] of applications.entries()) {
      const after = await Application.findById(application._id).lean();
      expect(after.assignedRecruiterCompanyMemberId).toBeNull();
      expect(after.status).toBe(NON_TERMINAL_STATUSES[index]);
    }
  });

  it("keeps terminal Application final Assignee", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.terminal",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const hired = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.HIRED,
    });
    const rejectedCandidate = await createVerifiedUser({
      email: "v10.s09.terminal.rejected@example.com",
    });
    const rejected = await createAssignedApplication({
      candidateUserId: rejectedCandidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.REJECTED,
    });
    const withdrawnCandidate = await createVerifiedUser({
      email: "v10.s09.terminal.withdrawn@example.com",
    });
    const withdrawn = await createAssignedApplication({
      candidateUserId: withdrawnCandidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.WITHDRAWN,
    });

    await terminateAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    for (const application of [hired, rejected, withdrawn]) {
      const after = await Application.findById(application._id).lean();
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        ctx.outgoing.membership._id.toString(),
      );
    }
  });

  it("completes LOCK while Primary/Supporting responsibility remains (no zero-responsibility guard)", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.no.zero.guard",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.outgoing.membership._id,
      supportingMemberIds: [ctx.primary.membership._id],
    });
    await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    expect((await User.findById(ctx.outgoing.user._id).lean()).status).toBe(
      USER_STATUS.LOCKED,
    );
    expect(
      (await CompanyMember.findById(ctx.outgoing.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    const afterJob = await Job.findById(job._id).lean();
    expect(String(afterJob.primaryRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );
    expect(
      (afterJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).toContain(ctx.primary.membership._id.toString());

    const application = await Application.findOne({ jobId: job._id }).lean();
    expect(application.assignedRecruiterCompanyMemberId).toBeNull();
  });

  it("Platform Admin has no Assign / Reassign / force-reassign / Pipeline authority", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.no.authority",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });
    const assigned = await createAssignedApplication({
      candidateUserId: (
        await createVerifiedUser({
          email: "v10.s09.no.authority.candidate2@example.com",
        })
      ).user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await expect(
      firstAssignApplication({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: unassigned._id.toString(),
        assigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      reassignApplication({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: assigned._id.toString(),
        assigneeCompanyMemberId: ctx.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      forceReassignApplication({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: assigned._id.toString(),
        assigneeCompanyMemberId: ctx.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: assigned._id.toString(),
        targetStatus: APPLICATION_STATUS.CONTACTED,
        expectedStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("keeps partial Application Unassign progress across User LOCK and retries remaining via TERMINATE (TX-05)", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.partial",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const appA = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });
    const candidateB = await createVerifiedUser({
      email: "v10.s09.partial.candidate.b@example.com",
    });
    const appB = await createAssignedApplication({
      candidateUserId: candidateB.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });

    const orderedIds = [appA._id, appB._id].map(String).sort();
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

    await lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    vi.restoreAllMocks();

    expect((await User.findById(ctx.outgoing.user._id).lean()).status).toBe(
      USER_STATUS.LOCKED,
    );
    expect(
      (await CompanyMember.findById(ctx.outgoing.membership._id).lean()).status,
    ).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

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

    await terminateAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    expect(
      (await Application.findById(appA._id).lean())
        .assignedRecruiterCompanyMemberId,
    ).toBeNull();
    expect(
      (await Application.findById(appB._id).lean())
        .assignedRecruiterCompanyMemberId,
    ).toBeNull();
    expect((await User.findById(ctx.outgoing.user._id).lean()).status).toBe(
      USER_STATUS.TERMINATED,
    );
  });

  it("User eligibility loss wins before Assign → stale Assign fails (TX-02)", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.tx02.assign",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const barrier = installUserEligibilityReadBarrier();
    const assignPromise = firstAssignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: unassigned._id.toString(),
      assigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
      expectedVersion: 0,
    });

    await barrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    barrier.release();

    await expect(assignPromise).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await Application.findById(unassigned._id).lean())
        .assignedRecruiterCompanyMemberId,
    ).toBeNull();
  });

  it("Assign wins before User LOCK → LOCK still commits and Unassigns the newly assigned Application", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.assign.then.lock",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const barrier = installUserLockSaveBarrier();
    const lockPromise = lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await barrier.awaitReady();
    await firstAssignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: unassigned._id.toString(),
      assigneeCompanyMemberId: ctx.outgoing.membership._id.toString(),
      expectedVersion: 0,
    });
    barrier.release();
    await lockPromise;

    expect((await User.findById(ctx.outgoing.user._id).lean()).status).toBe(
      USER_STATUS.LOCKED,
    );
    expect(
      (await Application.findById(unassigned._id).lean())
        .assignedRecruiterCompanyMemberId,
    ).toBeNull();
  });

  it("Pipeline wins before User LOCK → status kept; automatic Unassign clears Assignee only", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.pipeline.then.lock",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    const barrier = installUserLockSaveBarrier();
    const lockPromise = lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await barrier.awaitReady();
    await updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.outgoing.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });
    barrier.release();
    await lockPromise;

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
  });

  it("stale automatic Unassign does not clear a newer Assignee after Reassign A → B", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.stale.unassign",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [
        ctx.outgoing.membership._id,
        ctx.supportingB.membership._id,
      ],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    const originalFindOneAndUpdate =
      Application.findOneAndUpdate.bind(Application);
    let reassignInjected = false;
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
          String(filter.assignedRecruiterCompanyMemberId) ===
            String(ctx.outgoing.membership._id);

        if (isAutomaticUnassign && !reassignInjected) {
          reassignInjected = true;
          await originalFindOneAndUpdate(
            {
              _id: application._id,
              assignedRecruiterCompanyMemberId: ctx.outgoing.membership._id,
              version: 1,
              status: { $in: [...NON_TERMINAL_STATUSES] },
            },
            {
              $set: {
                assignedRecruiterCompanyMemberId: ctx.supportingB.membership._id,
                version: 2,
              },
            },
          );
        }

        return originalFindOneAndUpdate.apply(this, args);
      },
    );

    await lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    expect(reassignInjected).toBe(true);
    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supportingB.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
  });

  it("terminal transition winner is not automatic Unassigned", async () => {
    const ctx = await setupSlice09Company({
      emailPrefix: "v10.s09.terminal.winner",
    });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.outgoing.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.outgoing.membership._id,
      status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
    });

    const originalFindOneAndUpdate =
      Application.findOneAndUpdate.bind(Application);
    let terminalInjected = false;
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
          update.$set.assignedRecruiterCompanyMemberId === null;

        if (isAutomaticUnassign && !terminalInjected) {
          terminalInjected = true;
          await originalFindOneAndUpdate(
            { _id: application._id },
            {
              $set: {
                status: APPLICATION_STATUS.HIRED,
                version: 2,
              },
            },
          );
        }

        return originalFindOneAndUpdate.apply(this, args);
      },
    );

    await lockAccount({
      targetUserId: ctx.outgoing.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    expect(terminalInjected).toBe(true);
    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.HIRED);
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.outgoing.membership._id.toString(),
    );
  });
});
