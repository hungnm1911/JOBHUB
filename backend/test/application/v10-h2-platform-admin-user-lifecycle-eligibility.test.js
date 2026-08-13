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

/**
 * V10 Final Acceptance H2 reconcile:
 * Platform Admin generic User account lifecycle (V1 F10/F11) remains independent
 * of Recruiter CompanyMember LOCK/TERMINATE zero-responsibility (V3/V10 BR-28 /
 * PI-24). After H3, TX-02 User ACTIVE acquires already serialize Application
 * mutations against User eligibility loss without mutating Application /
 * Job-team / CompanyMember from Platform Admin lock/terminate.
 */

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T08:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-13T07:59:00.000Z");

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "H2 Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-h2.pdf",
    originalFileName: "v10-h2.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
});

const createJobWithTeam = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "H2 Platform User Lifecycle Job",
  });

const createAssignedApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
  status = APPLICATION_STATUS.APPLIED,
  version = 1,
}) => {
  const created = await Application.create({
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

  await Application.updateOne(
    { _id: created._id },
    {
      $set: {
        status,
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version,
      },
    },
  );

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

const setupH2Company = async ({ emailPrefix }) => {
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
    fullName: "H2 Candidate",
  });
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.admin@example.com`,
    fullName: "H2 Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
    password: DEFAULT_PASSWORD,
  });

  return {
    manager,
    primary,
    supporting,
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

const snapshotApplication = (application) => ({
  status: application.status,
  version: application.version,
  assignedRecruiterCompanyMemberId: application.assignedRecruiterCompanyMemberId
    ? String(application.assignedRecruiterCompanyMemberId)
    : null,
  snapshotStorageKey: application.submittedCvSnapshot?.pdfFile?.storageKey,
  snapshotName: application.submittedCvSnapshot?.name,
});

const snapshotJobTeam = (job) => ({
  primaryRecruiterCompanyMemberId: String(job.primaryRecruiterCompanyMemberId),
  supportingRecruiterCompanyMemberIds: (
    job.supportingRecruiterCompanyMemberIds ?? []
  )
    .map(String)
    .sort(),
  status: job.status,
});

describe("V10 Final Acceptance H2 — Platform Admin User lifecycle vs Application eligibility", () => {
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

  it("1. Platform Admin lock succeeds with non-terminal assigned Application; assignee/status/snapshot unchanged (V1/V3)", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c1" });
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
    const beforeApp = snapshotApplication(application);
    const beforeMembership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    const beforeJob = snapshotJobTeam(await Job.findById(job._id).lean());

    const locked = await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    expect(locked.status).toBe(USER_STATUS.LOCKED);

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(membership.status).toBe(beforeMembership.status);
    expect(membership.role).toBe(beforeMembership.role);

    const afterApp = snapshotApplication(
      await Application.findById(application._id).lean(),
    );
    expect(afterApp).toEqual(beforeApp);

    const afterJob = snapshotJobTeam(await Job.findById(job._id).lean());
    expect(afterJob).toEqual(beforeJob);
  });

  it("2. After Platform lock, Recruiter cannot continue Pipeline (BR-08 / PI-14)", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c2" });
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

    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
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
    ).rejects.toMatchObject({ statusCode: 409 });

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
  });

  it("3. Platform lock wins race with Pipeline → stale Pipeline fails (TX-02 / H3)", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c3" });
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
    const before = snapshotApplication(
      await Application.findById(application._id).lean(),
    );

    const barrier = installUserEligibilityReadBarrier();
    const pipelinePromise = updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.supporting.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    await barrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    barrier.release();

    await expect(pipelinePromise).rejects.toMatchObject({ statusCode: 409 });

    const after = snapshotApplication(
      await Application.findById(application._id).lean(),
    );
    expect(after).toEqual(before);
  });

  it("4. Pipeline wins before Platform lock → Pipeline kept; lock succeeds; subsequent Pipeline blocked", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c4" });
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

    const barrier = installUserLockSaveBarrier();
    const lockPromise = lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await barrier.awaitReady();

    await updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.supporting.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    barrier.release();
    await lockPromise;

    const afterLock = await Application.findById(application._id).lean();
    expect(afterLock.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(String(afterLock.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: ctx.supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        expectedStatus: APPLICATION_STATUS.CONTACTED,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("5. Platform lock wins race with First Assign/Reassign onto target → stale acquisition fails", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c5" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });
    const assigned = await createAssignedApplication({
      candidateUserId: (
        await createVerifiedUser({
          email: "v10.h2.c5.candidate2@example.com",
          fullName: "H2 Candidate 2",
        })
      ).user._id,
      jobId: job._id,
      assigneeMemberId: ctx.primary.membership._id,
      status: APPLICATION_STATUS.APPLIED,
    });

    const assignBarrier = installUserEligibilityReadBarrier();
    const assignPromise = firstAssignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: unassigned._id.toString(),
      assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 0,
    });

    await assignBarrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    assignBarrier.release();

    await expect(assignPromise).rejects.toMatchObject({ statusCode: 409 });

    const afterAssign = await Application.findById(unassigned._id).lean();
    expect(afterAssign.assignedRecruiterCompanyMemberId).toBeNull();

    // Target remains LOCKED; a subsequent Reassign onto the same target also fails.
    await expect(
      reassignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: assigned._id.toString(),
        assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.primary.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const afterReassign = await Application.findById(assigned._id).lean();
    expect(String(afterReassign.assignedRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
  });

  it("6. Platform terminate with Application responsibility keeps V1/V3 termination; Application not rewritten", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c6" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.CONTACTED,
    });
    const beforeApp = snapshotApplication(application);
    const beforeJob = snapshotJobTeam(await Job.findById(job._id).lean());
    const beforeMembership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();

    const terminated = await terminateAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    expect(terminated.status).toBe(USER_STATUS.TERMINATED);

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.TERMINATED);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(membership.status).toBe(beforeMembership.status);

    const afterApp = snapshotApplication(
      await Application.findById(application._id).lean(),
    );
    expect(afterApp).toEqual(beforeApp);

    const afterJob = snapshotJobTeam(await Job.findById(job._id).lean());
    expect(afterJob).toEqual(beforeJob);
  });

  it("7. Platform Admin has no First Assign / Reassign / Take over / administrative handoff / Pipeline authority (BR-42)", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c7" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const unassigned = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });
    const assigned = await createAssignedApplication({
      candidateUserId: (
        await createVerifiedUser({
          email: "v10.h2.c7.candidate2@example.com",
          fullName: "H2 Candidate 2",
        })
      ).user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.SCREENING,
    });

    await expect(
      firstAssignApplication({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: unassigned._id.toString(),
        assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      reassignApplication({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: assigned._id.toString(),
        assigneeCompanyMemberId: ctx.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      forceReassignApplication({
        actorUser: ctx.platformAdmin.user,
        jobId: job._id.toString(),
        applicationId: assigned._id.toString(),
        assigneeCompanyMemberId: ctx.primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
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

  it("8. Generic Platform User lifecycle does not mutate CompanyMember or Job Recruitment Team", async () => {
    const ctx = await setupH2Company({ emailPrefix: "v10.h2.c8" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [
        ctx.supporting.membership._id,
        ctx.supportingB.membership._id,
      ],
    });
    await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.supporting.membership._id,
      status: APPLICATION_STATUS.APPLIED,
    });

    const beforePrimaryMembership = await CompanyMember.findById(
      ctx.primary.membership._id,
    ).lean();
    const beforeSupportingMembership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    const beforeJob = snapshotJobTeam(await Job.findById(job._id).lean());

    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    await terminateAccount({
      targetUserId: ctx.primary.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    const afterPrimaryMembership = await CompanyMember.findById(
      ctx.primary.membership._id,
    ).lean();
    const afterSupportingMembership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    const afterJob = snapshotJobTeam(await Job.findById(job._id).lean());

    expect(afterSupportingMembership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(afterSupportingMembership.status).toBe(
      beforeSupportingMembership.status,
    );
    expect(afterPrimaryMembership.status).toBe(beforePrimaryMembership.status);
    expect(afterJob).toEqual(beforeJob);

    const supportingUser = await User.findById(ctx.supporting.user._id).lean();
    const primaryUser = await User.findById(ctx.primary.user._id).lean();
    expect(supportingUser.status).toBe(USER_STATUS.LOCKED);
    expect(primaryUser.status).toBe(USER_STATUS.TERMINATED);
  });
});
