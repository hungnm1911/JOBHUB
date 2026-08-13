import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  addSupportingRecruiter,
  createDraftJob,
  executeForcedPrimaryTransfer,
} from "../../src/services/job.service.js";
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

/**
 * V10 Final Acceptance — Platform User lifecycle vs Job-team responsibility
 * writers (F11 / BR-49; reuse H3 TX-02 User ACTIVE acquire pattern).
 *
 * Platform Admin lock/terminate only mutates User.status. Job-team writers that
 * receive new responsibility must conditionally acquire User ACTIVE (and
 * Company/CompanyMember) at commit, matching replacePrimaryRecruiter.
 */

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

const setupCompany = async ({ emailPrefix }) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-P`,
  });
  const supporting = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
  });
  const platformAdmin = await createVerifiedUser({
    email: `${emailPrefix}.admin@example.com`,
    fullName: "F11 Job-team Platform Admin",
    role: USER_ROLE.PLATFORM_ADMIN,
    password: DEFAULT_PASSWORD,
  });

  return { manager, primary, supporting, platformAdmin };
};

const createPublishedJob = async ({
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
    title: "F11 Job-team Eligibility Job",
  });

describe("V10 F11 — Platform User lifecycle vs Job-team responsibility writers", () => {
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

  it("1a. Platform lock wins before createDraftJob → Draft/Primary not committed", async () => {
    const ctx = await setupCompany({ emailPrefix: "v10.f11.jt.1a" });

    const barrier = installUserEligibilityReadBarrier();
    const draftPromise = createDraftJob({
      recruiterUser: ctx.primary.user,
    });

    await barrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.primary.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    barrier.release();

    await expect(draftPromise).rejects.toMatchObject({ statusCode: 409 });

    const user = await User.findById(ctx.primary.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.primary.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);

    expect(
      await Job.countDocuments({
        primaryRecruiterCompanyMemberId: ctx.primary.membership._id,
      }),
    ).toBe(0);
  });

  it("1b. createDraftJob wins before Platform lock → Draft kept; lock still completes", async () => {
    const ctx = await setupCompany({ emailPrefix: "v10.f11.jt.1b" });

    const barrier = installUserLockSaveBarrier();
    const lockPromise = lockAccount({
      targetUserId: ctx.primary.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await barrier.awaitReady();

    const draft = await createDraftJob({
      recruiterUser: ctx.primary.user,
    });

    barrier.release();
    await lockPromise;

    expect(draft.status).toBe(JOB_STATUS.DRAFT);
    expect(draft.primaryRecruiterCompanyMemberId).toBe(
      ctx.primary.membership._id.toString(),
    );

    const persisted = await Job.findById(draft.id).lean();
    expect(persisted).not.toBeNull();
    expect(persisted.status).toBe(JOB_STATUS.DRAFT);
    expect(String(persisted.primaryRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );

    const user = await User.findById(ctx.primary.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.primary.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("2a. Platform lock wins before addSupportingRecruiter → Supporting not added", async () => {
    const ctx = await setupCompany({ emailPrefix: "v10.f11.jt.2a" });
    const job = await createPublishedJob({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
    });

    const barrier = installUserEligibilityReadBarrier();
    const addPromise = addSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId: ctx.supporting.membership._id.toString(),
    });

    await barrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    barrier.release();

    await expect(addPromise).rejects.toMatchObject({ statusCode: 409 });

    const persisted = await Job.findById(job._id).lean();
    expect(persisted.supportingRecruiterCompanyMemberIds ?? []).toEqual([]);

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("2b. addSupportingRecruiter wins before Platform lock → Supporting kept; lock completes", async () => {
    const ctx = await setupCompany({ emailPrefix: "v10.f11.jt.2b" });
    const job = await createPublishedJob({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
    });

    const barrier = installUserLockSaveBarrier();
    const lockPromise = lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await barrier.awaitReady();

    const team = await addSupportingRecruiter({
      actorUser: ctx.manager.user,
      jobId: job._id.toString(),
      supportingRecruiterCompanyMemberId: ctx.supporting.membership._id.toString(),
    });

    barrier.release();
    await lockPromise;

    expect(team.supportingRecruiterCompanyMemberIds).toContain(
      ctx.supporting.membership._id.toString(),
    );

    const persisted = await Job.findById(job._id).lean();
    expect(
      (persisted.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).toContain(ctx.supporting.membership._id.toString());

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });

  it("3a. Platform lock wins before forced Primary transfer → replacement does not receive Primary", async () => {
    const ctx = await setupCompany({ emailPrefix: "v10.f11.jt.3a" });
    const job = await createPublishedJob({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });

    const barrier = installUserEligibilityReadBarrier();
    const transferPromise = executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: ctx.manager.company._id,
      oldPrimaryCompanyMemberId: ctx.primary.membership._id,
      replacementCompanyMemberId: ctx.supporting.membership._id,
    });

    await barrier.awaitReady();
    await lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });
    barrier.release();

    await expect(transferPromise).rejects.toMatchObject({ statusCode: 409 });

    const persisted = await Job.findById(job._id).lean();
    expect(String(persisted.primaryRecruiterCompanyMemberId)).toBe(
      ctx.primary.membership._id.toString(),
    );
    expect(
      (persisted.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).toContain(ctx.supporting.membership._id.toString());

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);
  });

  it("3b. forced Primary transfer wins before Platform lock → transfer kept; lock completes", async () => {
    const ctx = await setupCompany({ emailPrefix: "v10.f11.jt.3b" });
    const job = await createPublishedJob({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [ctx.supporting.membership._id],
    });

    const barrier = installUserLockSaveBarrier();
    const lockPromise = lockAccount({
      targetUserId: ctx.supporting.user._id.toString(),
      actorUserId: ctx.platformAdmin.user._id,
    });

    await barrier.awaitReady();

    const transferred = await executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: ctx.manager.company._id,
      oldPrimaryCompanyMemberId: ctx.primary.membership._id,
      replacementCompanyMemberId: ctx.supporting.membership._id,
    });

    barrier.release();
    await lockPromise;

    expect(transferred.primaryRecruiterCompanyMemberId).toBe(
      ctx.supporting.membership._id.toString(),
    );

    const persisted = await Job.findById(job._id).lean();
    expect(String(persisted.primaryRecruiterCompanyMemberId)).toBe(
      ctx.supporting.membership._id.toString(),
    );
    expect(
      (persisted.supportingRecruiterCompanyMemberIds ?? []).map(String),
    ).not.toContain(ctx.supporting.membership._id.toString());

    const user = await User.findById(ctx.supporting.user._id).lean();
    expect(user.status).toBe(USER_STATUS.LOCKED);

    const membership = await CompanyMember.findById(
      ctx.supporting.membership._id,
    ).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.ACTIVE);
  });
});
