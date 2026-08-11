import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import JOB_STATUS from "../../src/constants/job-status.js";

import Job from "../../src/models/job.model.js";
import {
  addSupportingRecruiter,
  closePublishedJob,
  removeSupportingRecruiter,
  replacePrimaryRecruiter,
} from "../../src/services/job.service.js";

import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST_DEADLINE = new Date("2020-01-01T00:00:00.000Z");

let empCounter = 0;
const emp = () => `NV-STALE-PRI-${++empCounter}`;

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  applicationDeadline = FUTURE_DEADLINE(),
  title = "Stale Primary Authority Job",
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline,
    title,
  });

const supportingIdsOf = (job) =>
  (job.supportingRecruiterCompanyMemberIds ?? []).map((id) => id.toString());

/**
 * After the target Job's authorization pre-read completes, run concurrent F04
 * replace-primary, then return the stale pre-read document so the original
 * mutation continues with outdated Primary authority.
 */
const installStalePrimaryPreReadThenReplace = ({
  jobId,
  managerUser,
  newPrimaryCompanyMemberId,
  keepOldPrimaryAsSupporting,
}) => {
  const originalFindById = Job.findById.bind(Job);
  let preReadIntercepted = false;

  vi.spyOn(Job, "findById").mockImplementation(async (...args) => {
    const result = await originalFindById(...args);

    if (!preReadIntercepted && args[0]?.toString() === jobId.toString()) {
      preReadIntercepted = true;
      vi.spyOn(Job, "findById").mockRestore();

      await replacePrimaryRecruiter({
        managerUser,
        jobId: jobId.toString(),
        newPrimaryCompanyMemberId: newPrimaryCompanyMemberId.toString(),
        keepOldPrimaryAsSupporting,
      });
    }

    return result;
  });
};

describe("V6 Final Acceptance — stale Primary mutation authority at write boundary", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
    empCounter = 0;
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("concurrent F04 after Primary pre-check must not mutate", () => {
    it("rejects add Supporting when F04 replaces Primary before write (old Primary → NONE)", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.add.none@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-ADD-NONE",
      });
      const oldPrimary = await createActiveRecruiterContext({
        email: "old.v6.stale.add.none@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const successor = await createActiveRecruiterContext({
        email: "succ.v6.stale.add.none@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const target = await createActiveRecruiterContext({
        email: "target.v6.stale.add.none@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: oldPrimary.membership._id,
        supportingIds: [successor.membership._id],
      });

      installStalePrimaryPreReadThenReplace({
        jobId: job._id,
        managerUser: manager.user,
        newPrimaryCompanyMemberId: successor.membership._id,
        keepOldPrimaryAsSupporting: false,
      });

      await expect(
        addSupportingRecruiter({
          actorUser: oldPrimary.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: target.membership._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
        successor.membership._id.toString(),
      );
      expect(supportingIdsOf(persisted)).not.toContain(
        target.membership._id.toString(),
      );
      expect(supportingIdsOf(persisted)).not.toContain(
        oldPrimary.membership._id.toString(),
      );
      expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
    });

    it("rejects remove Supporting when F04 replaces Primary before write", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.remove@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-REMOVE",
      });
      const oldPrimary = await createActiveRecruiterContext({
        email: "old.v6.stale.remove@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const successor = await createActiveRecruiterContext({
        email: "succ.v6.stale.remove@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const removable = await createActiveRecruiterContext({
        email: "rem.v6.stale.remove@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: oldPrimary.membership._id,
        supportingIds: [successor.membership._id, removable.membership._id],
      });

      installStalePrimaryPreReadThenReplace({
        jobId: job._id,
        managerUser: manager.user,
        newPrimaryCompanyMemberId: successor.membership._id,
        keepOldPrimaryAsSupporting: true,
      });

      await expect(
        removeSupportingRecruiter({
          actorUser: oldPrimary.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: removable.membership._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
        successor.membership._id.toString(),
      );
      expect(supportingIdsOf(persisted)).toContain(
        removable.membership._id.toString(),
      );
      expect(supportingIdsOf(persisted)).toContain(
        oldPrimary.membership._id.toString(),
      );
      expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
    });

    it("rejects close when F04 keeps old Primary as Supporting before write (BR-31)", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.close.sup@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-CLOSE-SUP",
      });
      const oldPrimary = await createActiveRecruiterContext({
        email: "old.v6.stale.close.sup@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const successor = await createActiveRecruiterContext({
        email: "succ.v6.stale.close.sup@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: oldPrimary.membership._id,
        supportingIds: [successor.membership._id],
      });

      installStalePrimaryPreReadThenReplace({
        jobId: job._id,
        managerUser: manager.user,
        newPrimaryCompanyMemberId: successor.membership._id,
        keepOldPrimaryAsSupporting: true,
      });

      await expect(
        closePublishedJob({
          actorUser: oldPrimary.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
      expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
        successor.membership._id.toString(),
      );
      expect(supportingIdsOf(persisted)).toContain(
        oldPrimary.membership._id.toString(),
      );
    });

    it("rejects close when F04 moves old Primary to NONE before write", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.close.none@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-CLOSE-NONE",
      });
      const oldPrimary = await createActiveRecruiterContext({
        email: "old.v6.stale.close.none@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const successor = await createActiveRecruiterContext({
        email: "succ.v6.stale.close.none@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: oldPrimary.membership._id,
        supportingIds: [successor.membership._id],
      });

      installStalePrimaryPreReadThenReplace({
        jobId: job._id,
        managerUser: manager.user,
        newPrimaryCompanyMemberId: successor.membership._id,
        keepOldPrimaryAsSupporting: false,
      });

      await expect(
        closePublishedJob({
          actorUser: oldPrimary.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
      expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
        successor.membership._id.toString(),
      );
      expect(supportingIdsOf(persisted)).not.toContain(
        oldPrimary.membership._id.toString(),
      );
    });
  });

  describe("canonical authority still succeeds without race", () => {
    it("allows current Primary to add / remove Supporting and close", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.happy.pri@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-HAPPY-PRI",
      });
      const primary = await createActiveRecruiterContext({
        email: "pri.v6.stale.happy@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const supportingA = await createActiveRecruiterContext({
        email: "supA.v6.stale.happy@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const supportingB = await createActiveRecruiterContext({
        email: "supB.v6.stale.happy@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const addJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
      });

      const added = await addSupportingRecruiter({
        actorUser: primary.user,
        jobId: addJob._id.toString(),
        supportingRecruiterCompanyMemberId: supportingA.membership._id.toString(),
      });
      expect(added.supportingRecruiterCompanyMemberIds).toContain(
        supportingA.membership._id.toString(),
      );

      const removeJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        supportingIds: [supportingB.membership._id],
        title: "Primary remove happy",
      });

      const removed = await removeSupportingRecruiter({
        actorUser: primary.user,
        jobId: removeJob._id.toString(),
        supportingRecruiterCompanyMemberId: supportingB.membership._id.toString(),
      });
      expect(removed.supportingRecruiterCompanyMemberIds).not.toContain(
        supportingB.membership._id.toString(),
      );

      const closeJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        title: "Primary close happy",
      });

      const closed = await closePublishedJob({
        actorUser: primary.user,
        jobId: closeJob._id.toString(),
      });
      expect(closed.status).toBe(JOB_STATUS.CLOSED);
    });

    it("allows Company Manager to add / remove Supporting and close without being Primary", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.happy.cm@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-HAPPY-CM",
      });
      const primary = await createActiveRecruiterContext({
        email: "pri.v6.stale.happy.cm@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const supportingA = await createActiveRecruiterContext({
        email: "supA.v6.stale.happy.cm@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const supportingB = await createActiveRecruiterContext({
        email: "supB.v6.stale.happy.cm@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const addJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
      });

      const added = await addSupportingRecruiter({
        actorUser: manager.user,
        jobId: addJob._id.toString(),
        supportingRecruiterCompanyMemberId: supportingA.membership._id.toString(),
      });
      expect(added.primaryRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
      expect(added.supportingRecruiterCompanyMemberIds).toContain(
        supportingA.membership._id.toString(),
      );

      const removeJob = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        supportingIds: [supportingB.membership._id],
        title: "CM remove happy",
      });

      const removed = await removeSupportingRecruiter({
        actorUser: manager.user,
        jobId: removeJob._id.toString(),
        supportingRecruiterCompanyMemberId: supportingB.membership._id.toString(),
      });
      expect(removed.supportingRecruiterCompanyMemberIds).not.toContain(
        supportingB.membership._id.toString(),
      );

      const closeJobDoc = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        title: "CM close happy",
      });

      const closed = await closePublishedJob({
        actorUser: manager.user,
        jobId: closeJobDoc._id.toString(),
      });
      expect(closed.status).toBe(JOB_STATUS.CLOSED);
      expect(closed.primaryRecruiterCompanyMemberId).toBe(
        primary.membership._id.toString(),
      );
    });

    it("rejects cross-tenant Primary add / remove / close", async () => {
      const managerA = await createActiveCompanyManagerContext({
        email: "cmA.v6.stale.xtenant@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-XTENANT-A",
      });
      const primaryA = await createActiveRecruiterContext({
        email: "priA.v6.stale.xtenant@example.com",
        company: managerA.company,
        employeeCode: emp(),
      });
      const supportingA = await createActiveRecruiterContext({
        email: "supA.v6.stale.xtenant@example.com",
        company: managerA.company,
        employeeCode: emp(),
      });
      const targetA = await createActiveRecruiterContext({
        email: "targetA.v6.stale.xtenant@example.com",
        company: managerA.company,
        employeeCode: emp(),
      });

      const managerB = await createActiveCompanyManagerContext({
        email: "cmB.v6.stale.xtenant@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-XTENANT-B",
      });
      const primaryB = await createActiveRecruiterContext({
        email: "priB.v6.stale.xtenant@example.com",
        company: managerB.company,
        employeeCode: emp(),
      });

      const job = await createPublishedJob({
        companyId: managerA.company._id,
        primaryMemberId: primaryA.membership._id,
        supportingIds: [supportingA.membership._id],
      });

      await expect(
        addSupportingRecruiter({
          actorUser: primaryB.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: targetA.membership._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        removeSupportingRecruiter({
          actorUser: primaryB.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: supportingA.membership._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        closePublishedJob({
          actorUser: primaryB.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
      expect(supportingIdsOf(persisted)).toEqual([
        supportingA.membership._id.toString(),
      ]);
      expect(supportingIdsOf(persisted)).not.toContain(
        targetA.membership._id.toString(),
      );
    });

    it("rejects Primary add / remove / close when Job is past effective deadline", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cm.v6.stale.deadline@example.com",
        businessRegistrationNumber: "BRN-V6-STALE-DEADLINE",
      });
      const primary = await createActiveRecruiterContext({
        email: "pri.v6.stale.deadline@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const supporting = await createActiveRecruiterContext({
        email: "sup.v6.stale.deadline@example.com",
        company: manager.company,
        employeeCode: emp(),
      });
      const target = await createActiveRecruiterContext({
        email: "target.v6.stale.deadline@example.com",
        company: manager.company,
        employeeCode: emp(),
      });

      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: primary.membership._id,
        supportingIds: [supporting.membership._id],
        applicationDeadline: PAST_DEADLINE,
      });

      await expect(
        addSupportingRecruiter({
          actorUser: primary.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: target.membership._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        removeSupportingRecruiter({
          actorUser: primary.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: supporting.membership._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      await expect(
        closePublishedJob({
          actorUser: primary.user,
          jobId: job._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const persisted = await Job.findById(job._id).lean();
      expect(persisted.status).toBe(JOB_STATUS.PUBLISHED);
      expect(supportingIdsOf(persisted)).toEqual([
        supporting.membership._id.toString(),
      ]);
    });
  });
});
