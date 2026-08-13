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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Company from "../../src/models/company.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  reassignApplication,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import {
  removeSupportingRecruiter,
  replacePrimaryRecruiter,
} from "../../src/services/job.service.js";
import {
  lockAccount,
  lockCompany,
} from "../../src/services/platform-admin.service.js";
import {
  lockRecruiter,
  terminateRecruiter,
} from "../../src/services/recruiter.service.js";
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
const APPLIED_AT = new Date("2026-08-13T08:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-13T07:59:00.000Z");

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "TX-02 Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-tx02.pdf",
    originalFileName: "v10-tx02.pdf",
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
    title: "TX-02 Eligibility Job",
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

const setupTx02Company = async ({ emailPrefix }) => {
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
    fullName: "TX-02 Candidate",
  });
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.admin@example.com`,
    fullName: "TX-02 Platform Admin",
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

// Hold only transactional eligibility reads (`.session(...)`) so an
// eligibility-losing writer can commit while the Application transaction is open
// after a stale eligible snapshot was observed.
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

const installCompanyEligibilityReadBarrier = () =>
  installTransactionalFindByIdBarrier(Company);

const installUserEligibilityReadBarrier = () =>
  installTransactionalFindByIdBarrier(User);

const installCompanyLockSaveBarrier = () => {
  const originalSave = Company.prototype.save;
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let armed = true;

  vi.spyOn(Company.prototype, "save").mockImplementation(async function saveWithBarrier(
    ...args
  ) {
    if (
      armed &&
      this.operationalStatus === COMPANY_OPERATIONAL_STATUS.LOCKED
    ) {
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

const snapshotFields = (application) => ({
  assignee: application.assignedRecruiterCompanyMemberId
    ? String(application.assignedRecruiterCompanyMemberId)
    : null,
  status: application.status,
  snapshotName: application.submittedCvSnapshot?.name,
  snapshotStorageKey: application.submittedCvSnapshot?.pdfFile?.storageKey,
  version: application.version,
});

describe("V10 Final Acceptance H3 — TX-02 multi-dimension Assignee eligibility coordination", () => {
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

  it("1a. Company lock wins before Pipeline → stale Pipeline fails; assignment/status/snapshot unchanged", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c1a" });
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
    const before = snapshotFields(await Application.findById(application._id));

    const barrier = installCompanyEligibilityReadBarrier();
    const pipelinePromise = updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.supporting.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    await barrier.awaitReady();
    await lockCompany({ companyId: ctx.manager.company._id.toString() });
    barrier.release();

    await expect(pipelinePromise).rejects.toMatchObject({ statusCode: 409 });

    const company = await Company.findById(ctx.manager.company._id).lean();
    expect(company.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);

    const after = snapshotFields(await Application.findById(application._id));
    expect(after).toEqual(before);
  });

  it("1b. Pipeline wins before Company lock → status commits; lock freezes without reassign/unassign", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c1b" });
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
    const beforeSnapshot = snapshotFields(
      await Application.findById(application._id),
    );

    const barrier = installCompanyLockSaveBarrier();
    const lockPromise = lockCompany({
      companyId: ctx.manager.company._id.toString(),
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

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(after.submittedCvSnapshot.name).toBe(beforeSnapshot.snapshotName);
    expect(after.submittedCvSnapshot.pdfFile.storageKey).toBe(
      beforeSnapshot.snapshotStorageKey,
    );
    expect(after.version).toBe(2);

    const company = await Company.findById(ctx.manager.company._id).lean();
    expect(company.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);
  });

  it("2a. Company lock wins before First Assign → no new responsibility", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c2a" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const barrier = installCompanyEligibilityReadBarrier();
    const assignPromise = firstAssignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 0,
    });

    await barrier.awaitReady();
    await lockCompany({ companyId: ctx.manager.company._id.toString() });
    barrier.release();

    await expect(assignPromise).rejects.toMatchObject({ statusCode: 409 });

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.APPLIED);
    expect(after.version).toBe(0);
  });

  it("2b. First Assign wins before Company lock → assignment kept; processing frozen after lock", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c2b" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });
    const application = await createUnassignedAppliedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const barrier = installCompanyLockSaveBarrier();
    const lockPromise = lockCompany({
      companyId: ctx.manager.company._id.toString(),
    });

    await barrier.awaitReady();

    await firstAssignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 0,
    });

    barrier.release();
    await lockPromise;

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(after.status).toBe(APPLICATION_STATUS.APPLIED);

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: ctx.supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const frozen = await Application.findById(application._id).lean();
    expect(String(frozen.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(frozen.status).toBe(APPLICATION_STATUS.APPLIED);
  });

  it("2c. Company lock wins before Reassign → stale target responsibility not committed", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c2c" });
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
    });

    const barrier = installCompanyEligibilityReadBarrier();
    const reassignPromise = reassignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.supportingB.membership._id.toString(),
      expectedVersion: 1,
    });

    await barrier.awaitReady();
    await lockCompany({ companyId: ctx.manager.company._id.toString() });
    barrier.release();

    await expect(reassignPromise).rejects.toMatchObject({ statusCode: 409 });

    const after = await Application.findById(application._id).lean();
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supportingB.membership._id.toString(),
    );
  });

  it("3a. User eligibility loss wins before Pipeline → stale Pipeline fails", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c3a" });
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
    const before = snapshotFields(await Application.findById(application._id));

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

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    const after = snapshotFields(await Application.findById(application._id));
    expect(after).toEqual(before);
  });

  it("3b. Pipeline wins before User eligibility loss → status kept; lifecycle does not rollback Application", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c3b" });
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

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);
  });

  it("4. User eligibility loss wins before Assign/Reassign → stale target not committed", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c4" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
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
      assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 0,
    });

    await barrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    barrier.release();

    await expect(assignPromise).rejects.toMatchObject({ statusCode: 409 });

    const after = await Application.findById(unassigned._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
  });

  it("5a. Supporting removal wins before outgoing Assignee Pipeline → Pipeline fails", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c5a" });
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

    const barrier = installCompanyEligibilityReadBarrier();
    const pipelinePromise = updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.supporting.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    await barrier.awaitReady();
    await removeSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId:
        ctx.supporting.membership._id.toString(),
    });
    barrier.release();

    await expect(pipelinePromise).rejects.toMatchObject({
      statusCode: expect.any(Number),
    });

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);

    const persistedJob = await Job.findById(job._id).lean();
    expect(
      (persistedJob.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).not.toContain(ctx.supporting.membership._id.toString());
  });

  it("5b. Pipeline wins before Supporting removal → removal observes current state and Unassigns", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c5b" });
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

  it("6a. Primary leave-team wins before outgoing Assignee Pipeline → Pipeline fails", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c6a" });
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

    const barrier = installCompanyEligibilityReadBarrier();
    const pipelinePromise = updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    await barrier.awaitReady();
    await replacePrimaryRecruiter({
      managerUser: ctx.manager.user,
      jobId: job._id.toString(),
      newPrimaryCompanyMemberId: ctx.supporting.membership._id.toString(),
      keepOldPrimaryAsSupporting: false,
    });
    barrier.release();

    await expect(pipelinePromise).rejects.toMatchObject({
      statusCode: expect.any(Number),
    });

    const after = await Application.findById(application._id).lean();
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
    expect(after.status).toBe(APPLICATION_STATUS.SCREENING);
  });

  it("6b. Pipeline wins before Primary leave-team → leave-team Unassign preserves committed status", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c6b" });
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

    await updateApplicationRecruitmentPipelineStatus({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      targetStatus: APPLICATION_STATUS.CONTACTED,
      expectedStatus: APPLICATION_STATUS.SCREENING,
      expectedVersion: 1,
    });

    await replacePrimaryRecruiter({
      managerUser: ctx.manager.user,
      jobId: job._id.toString(),
      newPrimaryCompanyMemberId: ctx.supporting.membership._id.toString(),
      keepOldPrimaryAsSupporting: false,
    });

    const after = await Application.findById(application._id).lean();
    expect(after.status).toBe(APPLICATION_STATUS.CONTACTED);
    expect(after.assignedRecruiterCompanyMemberId).toBeNull();
  });

  it("7. Recruiter LOCK/TERMINATE ↔ First Assign keeps final-zero-guard invariant", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c7" });
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
      lockRecruiter({
        managerUser: ctx.manager.user,
        recruiterId: ctx.supporting.user._id.toString(),
        transfers: [],
      }),
      firstAssignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: unassigned._id.toString(),
        assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    const application = await Application.findById(unassigned._id).lean();

    if (membership.status === COMPANY_MEMBER_STATUS.LOCKED) {
      expect(application.assignedRecruiterCompanyMemberId).toBeNull();
      expect(
        results.some(
          (item) =>
            item.status === "fulfilled" &&
            item.value?.membership?.status === COMPANY_MEMBER_STATUS.LOCKED,
        ),
      ).toBe(true);
    } else {
      expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
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

    const terminateCtx = await setupTx02Company({ emailPrefix: "v10.h3.c7t" });
    const terminateJob = await createJobWithTeam({
      companyId: terminateCtx.manager.company._id,
      primaryMemberId: terminateCtx.primary.membership._id,
      supportingMemberIds: [terminateCtx.supporting.membership._id],
    });
    const terminateApp = await createUnassignedAppliedApplication({
      candidateUserId: terminateCtx.candidate.user._id,
      jobId: terminateJob._id,
    });

    const terminateResults = await Promise.allSettled([
      terminateRecruiter({
        managerUser: terminateCtx.manager.user,
        recruiterId: terminateCtx.supporting.user._id.toString(),
        transfers: [],
      }),
      firstAssignApplication({
        actorUser: terminateCtx.primary.user,
        jobId: terminateJob._id.toString(),
        applicationId: terminateApp._id.toString(),
        assigneeCompanyMemberId:
          terminateCtx.supporting.membership._id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const terminateMembership = await CompanyMember.findById(
      terminateCtx.supporting.membership._id,
    ).lean();
    const terminatePersisted = await Application.findById(
      terminateApp._id,
    ).lean();

    if (terminateMembership.status === COMPANY_MEMBER_STATUS.TERMINATED) {
      expect(terminatePersisted.assignedRecruiterCompanyMemberId).toBeNull();
    } else {
      expect(terminateMembership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
      expect(String(terminatePersisted.assignedRecruiterCompanyMemberId)).toBe(
        terminateCtx.supporting.membership._id.toString(),
      );
      expect(
        terminateResults.some(
          (item) =>
            item.status === "rejected" && item.reason?.statusCode === 409,
        ),
      ).toBe(true);
    }
  });

  it("9. Company lock never reassigns or unassigns Application responsibility", async () => {
    const ctx = await setupTx02Company({ emailPrefix: "v10.h3.c9" });
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
    const before = snapshotFields(await Application.findById(application._id));

    await lockCompany({ companyId: ctx.manager.company._id.toString() });

    const after = snapshotFields(await Application.findById(application._id));
    expect(after).toEqual(before);
  });
});
