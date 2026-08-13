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
import COMPANY_MEMBER_ROLE from "../../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  automaticallyUnassignApplication,
  firstAssignApplication,
  reassignApplication,
  unassignApplication,
} from "../../src/services/application.service.js";
import { lockAccount } from "../../src/services/platform-admin.service.js";
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
const APPLIED_AT = new Date("2026-08-14T08:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-14T07:59:00.000Z");

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Actor Lifecycle Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-actor-lifecycle.pdf",
    originalFileName: "v10-actor-lifecycle.pdf",
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
    title: "Actor Lifecycle Eligibility Job",
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

const createUnassignedApplication = async ({ candidateUserId, jobId }) =>
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

const setupActorLifecycleCompany = async ({ emailPrefix }) => {
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
  const assignee = await createActiveRecruiterContext({
    email: `${emailPrefix}.assignee@example.com`,
    fullName: "Assignee Supporting",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-A`,
    jobTitle: "Assignee",
  });
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Actor Lifecycle Candidate",
  });
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.admin@example.com`,
    fullName: "Actor Lifecycle Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
    password: DEFAULT_PASSWORD,
  });

  return { manager, primary, supporting, assignee, candidate, platformAdmin };
};

const wrapQueryAfterLoad = (query, afterLoad) => {
  const run = async () => {
    const document = await query;
    await afterLoad(document);
    return document;
  };

  return {
    then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
    select: (...selectArgs) =>
      wrapQueryAfterLoad(query.select(...selectArgs), afterLoad),
    session: (session) =>
      wrapQueryAfterLoad(query.session(session), afterLoad),
    lean: (...leanArgs) =>
      wrapQueryAfterLoad(query.lean(...leanArgs), afterLoad),
  };
};

/**
 * After manual assignment soft-reads Job (stale pre-tx actor context still
 * looks valid), commit a concurrent actor-eligibility-losing writer before the
 * mutation continues.
 */
const installStaleJobPreReadThenConcurrentWriter = ({
  jobId,
  runConcurrentWriter,
}) => {
  const originalFindById = Job.findById.bind(Job);
  let preReadIntercepted = false;

  vi.spyOn(Job, "findById").mockImplementation((id, ...rest) => {
    const query = originalFindById(id, ...rest);

    if (preReadIntercepted || id?.toString() !== jobId.toString()) {
      return query;
    }

    return wrapQueryAfterLoad(query, async () => {
      if (preReadIntercepted) {
        return;
      }

      preReadIntercepted = true;
      vi.spyOn(Job, "findById").mockRestore();
      await runConcurrentWriter();
    });
  });
};

const snapshotAssignment = (application) => ({
  assignee: application.assignedRecruiterCompanyMemberId
    ? String(application.assignedRecruiterCompanyMemberId)
    : null,
  status: application.status,
  version: application.version,
});

/**
 * Canonical CompanyMember LOCK requires zero Job/Application responsibility,
 * so a still-Primary actor cannot be locked via lockRecruiter. This writer
 * applies the same ACTIVE→LOCKED membership transition the actor acquire
 * serializes against, proving membership eligibility at commit.
 */
const lockActorMembershipDirectly = async ({ membershipId, companyId, role }) => {
  const locked = await CompanyMember.findOneAndUpdate(
    {
      _id: membershipId,
      companyId,
      role,
      status: COMPANY_MEMBER_STATUS.ACTIVE,
    },
    {
      $set: {
        status: COMPANY_MEMBER_STATUS.LOCKED,
      },
    },
    { returnDocument: "after" },
  );

  expect(locked).not.toBeNull();
  expect(locked.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
};

describe("V10 Final Acceptance — manual assignment actor lifecycle eligibility at commit", () => {
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

  it("1. Primary actor User LOCK wins before manual Unassign → stale Unassign fails; Assignee kept", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.1" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        await lockAccount({
          targetUserId: ctx.primary.user._id.toString(),
          actorUserId: ctx.platformAdmin.user._id,
        });
      },
    });

    await expect(
      unassignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const user = await User.findById(ctx.primary.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
    expect(after.assignee).toBe(ctx.assignee.membership._id.toString());
  });

  it("2a. Primary actor User LOCK wins before First Assign → Application stays Unassigned", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.2a" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createUnassignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        await lockAccount({
          targetUserId: ctx.primary.user._id.toString(),
          actorUserId: ctx.platformAdmin.user._id,
        });
      },
    });

    await expect(
      firstAssignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
    expect(after.assignee).toBeNull();
  });

  it("2b. Primary actor User LOCK wins before Reassign → Application keeps prior Assignee", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.2b" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [
        ctx.assignee.membership._id,
        ctx.supporting.membership._id,
      ],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        await lockAccount({
          targetUserId: ctx.primary.user._id.toString(),
          actorUserId: ctx.platformAdmin.user._id,
        });
      },
    });

    await expect(
      reassignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
    expect(after.assignee).toBe(ctx.assignee.membership._id.toString());
  });

  it("3. Primary actor CompanyMember LOCK wins before manual Unassign → stale Unassign fails", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.3" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        await lockActorMembershipDirectly({
          membershipId: ctx.primary.membership._id,
          companyId: ctx.manager.company._id,
          role: COMPANY_MEMBER_ROLE.RECRUITER,
        });
      },
    });

    await expect(
      unassignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const membership = await CompanyMember.findById(
      ctx.primary.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);

    const user = await User.findById(ctx.primary.user._id).lean();
    expect(user.status).toBe(USER_STATUS.ACTIVE);

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
  });

  it("4a. Company Manager actor User ACTIVE loss wins before CM Unassign → Assignee kept", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.4a" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    // Platform Admin cannot LOCK an owning CM User while Company stays
    // APPROVED+ACTIVE (must use Company lock). Prove the commit User acquire
    // against the same ACTIVE→LOCKED User transition without relying on the
    // blocked Platform Admin shortcut.
    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        const locked = await User.findOneAndUpdate(
          {
            _id: ctx.manager.user._id,
            status: USER_STATUS.ACTIVE,
          },
          {
            $set: {
              status: USER_STATUS.LOCKED,
            },
          },
          { returnDocument: "after" },
        );
        expect(locked).not.toBeNull();
      },
    });

    await expect(
      unassignApplication({
        actorUser: ctx.manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const user = await User.findById(ctx.manager.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.manager.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
    expect(membership.role).toBe(COMPANY_MEMBER_ROLE.COMPANY_MANAGER);

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
  });

  it("4b. Company Manager actor CompanyMember ACTIVE loss wins before CM Unassign", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.4b" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    // V3 does not expose CM membership LOCK/TERMINATE as a business operation;
    // still prove commit revalidates current CM membership ACTIVE state.
    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        await lockActorMembershipDirectly({
          membershipId: ctx.manager.membership._id,
          companyId: ctx.manager.company._id,
          role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
        });
      },
    });

    await expect(
      unassignApplication({
        actorUser: ctx.manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
  });

  it("5. Valid Primary Unassign wins before actor User LOCK → Unassign kept; LOCK still completes", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.5" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });

    const result = await unassignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
      expectedVersion: 1,
    });

    expect(result.application.assignedRecruiterCompanyMemberId).toBeNull();
    expect(result.application.version).toBe(2);

    await lockAccount({
      targetUserId: ctx.primary.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persisted.version).toBe(2);

    const user = await User.findById(ctx.primary.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);
  });

  it("6a. Current valid Primary Assign / Reassign / Unassign still succeed", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.6a" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [
        ctx.assignee.membership._id,
        ctx.supporting.membership._id,
      ],
    });
    const application = await createUnassignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
    });

    const assigned = await firstAssignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
      expectedVersion: 0,
    });
    expect(assigned.application.assignedRecruiterCompanyMemberId).toBe(
      ctx.assignee.membership._id.toString(),
    );

    const reassigned = await reassignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
      expectedVersion: 1,
    });
    expect(reassigned.application.assignedRecruiterCompanyMemberId).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const unassigned = await unassignApplication({
      actorUser: ctx.primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.supporting.membership._id.toString(),
      expectedVersion: 2,
    });
    expect(unassigned.application.assignedRecruiterCompanyMemberId).toBeNull();
    expect(unassigned.application.version).toBe(3);
  });

  it("6b. Current valid Company Manager Unassign still succeeds", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.6b" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });

    const result = await unassignApplication({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
      expectedVersion: 1,
    });

    expect(result.application.assignedRecruiterCompanyMemberId).toBeNull();
    expect(result.application.version).toBe(2);
  });

  it("7. mustChangePassword current-state rejection at commit without inventing a writer", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.7" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });
    const before = snapshotAssignment(await Application.findById(application._id));

    installStaleJobPreReadThenConcurrentWriter({
      jobId: job._id,
      runConcurrentWriter: async () => {
        await User.updateOne(
          { _id: ctx.primary.user._id },
          { $set: { mustChangePassword: true } },
        );
      },
    });

    await expect(
      unassignApplication({
        actorUser: ctx.primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      details: { field: "mustChangePassword" },
    });

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
  });

  it("8. Automatic Unassign is not blocked by the new manual actor gate", async () => {
    const ctx = await setupActorLifecycleCompany({ emailPrefix: "v10.actor.8" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.assignee.membership._id],
    });
    const application = await createAssignedApplication({
      candidateUserId: ctx.candidate.user._id,
      jobId: job._id,
      assigneeMemberId: ctx.assignee.membership._id,
    });

    // Primary actor already lifecycle-ineligible — automatic Unassign must still
    // clear the outgoing Assignee without the manual actor business-access gate.
    await lockAccount({
      targetUserId: ctx.primary.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await automaticallyUnassignApplication({
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
      expectedVersion: 1,
    });

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persisted.version).toBe(2);
  });
});
