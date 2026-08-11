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

import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import {
  closePublishedJob,
  executeForcedPrimaryTransfer,
  executeForcedSupportingRemoval,
} from "../../src/services/job.service.js";
import {
  lockRecruiter,
  terminateRecruiter,
} from "../../src/services/recruiter.service.js";

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
const emp = () => `NV-FT-UNF-${++empCounter}`;

const createJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  status = JOB_STATUS.PUBLISHED,
  applicationDeadline = FUTURE_DEADLINE(),
  title = "Forced Transfer Unfinished Boundary Job",
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status,
    publishedAt:
      status === JOB_STATUS.DRAFT || status === JOB_STATUS.PENDING_APPROVAL
        ? null
        : new Date("2026-01-15"),
    applicationDeadline,
    title: status === JOB_STATUS.DRAFT ? undefined : title,
  });

const teamSnapshot = (job) => ({
  primary: job.primaryRecruiterCompanyMemberId.toString(),
  supporting: (job.supportingRecruiterCompanyMemberIds ?? []).map((id) =>
    id.toString(),
  ),
  companyId: job.companyId.toString(),
  createdBy: job.createdByCompanyMemberId.toString(),
  status: job.status,
  title: job.title ?? null,
});

const installFindByIdEndJobAfterPreRead = ({
  jobId,
  endJob,
}) => {
  const originalFindById = Job.findById.bind(Job);
  let intercepted = false;

  vi.spyOn(Job, "findById").mockImplementation(async (...args) => {
    const result = await originalFindById(...args);

    if (!intercepted && args[0]?.toString() === jobId.toString()) {
      intercepted = true;
      vi.spyOn(Job, "findById").mockRestore();
      await endJob();
    }

    return result;
  });
};

const installDeadlineCrossingHoldOnForcedWrite = ({
  isForcedWrite,
  deadline,
}) => {
  const originalFindOneAndUpdate = Job.findOneAndUpdate.bind(Job);
  let releaseWrite;
  const holdWrite = new Promise((resolve) => {
    releaseWrite = resolve;
  });
  let resolveWriteReached;
  const writeReached = new Promise((resolve) => {
    resolveWriteReached = resolve;
  });

  vi.spyOn(Job, "findOneAndUpdate").mockImplementation(
    (filter, update, options) => {
      if (isForcedWrite(update)) {
        resolveWriteReached();
        return holdWrite.then(() =>
          originalFindOneAndUpdate(filter, update, options),
        );
      }

      return originalFindOneAndUpdate(filter, update, options);
    },
  );

  return {
    awaitWriteReached: () => writeReached,
    releaseAfterDeadline: async () => {
      const remaining = deadline.getTime() - Date.now() + 20;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      expect(Date.now()).toBeGreaterThanOrEqual(deadline.getTime());
      releaseWrite();
    },
  };
};

describe("V6 forced transfer — unfinished predicate at mutation boundary", () => {
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

  it("forced Primary transfer does not mutate when deadline crosses before mutation ($$NOW)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.deadline-pri@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-DL-PRI",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.unf.deadline-pri@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.deadline-pri@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const deadline = new Date(Date.now() + 300);
    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      applicationDeadline: deadline,
    });
    const before = teamSnapshot(job);

    expect(Date.now()).toBeLessThan(deadline.getTime());

    const hold = installDeadlineCrossingHoldOnForcedWrite({
      deadline,
      isForcedWrite: (update) =>
        update?.$set?.primaryRecruiterCompanyMemberId != null,
    });

    const transferPromise = executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacement.membership._id,
    });

    await hold.awaitWriteReached();
    await hold.releaseAfterDeadline();
    await transferPromise;

    const after = await Job.findById(job._id).lean();
    expect(teamSnapshot(after)).toEqual(before);
  });

  it("forced Supporting removal does not mutate when deadline crosses before mutation ($$NOW)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.deadline-sup@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-DL-SUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.v6.ft.unf.deadline-sup@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.ft.unf.deadline-sup@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const deadline = new Date(Date.now() + 300);
    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [supporting.membership._id],
      applicationDeadline: deadline,
    });
    const before = teamSnapshot(job);

    const hold = installDeadlineCrossingHoldOnForcedWrite({
      deadline,
      isForcedWrite: (update) =>
        update?.$pull?.supportingRecruiterCompanyMemberIds != null,
    });

    const removalPromise = executeForcedSupportingRemoval({
      jobId: job._id,
      companyId: manager.company._id,
      supportingCompanyMemberId: supporting.membership._id,
    });

    await hold.awaitWriteReached();
    await hold.releaseAfterDeadline();
    await removalPromise;

    const after = await Job.findById(job._id).lean();
    expect(teamSnapshot(after)).toEqual(before);
  });

  it("forced Primary transfer does not mutate historical team when concurrent close commits first", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.close-pri@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-CL-PRI",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.unf.close-pri@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.close-pri@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
    });
    const before = teamSnapshot(await Job.findById(job._id).lean());

    installFindByIdEndJobAfterPreRead({
      jobId: job._id,
      endJob: async () => {
        await closePublishedJob({
          actorUser: manager.user,
          jobId: job._id.toString(),
        });
      },
    });

    await executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacement.membership._id,
    });

    const after = await Job.findById(job._id).lean();
    expect(after.status).toBe(JOB_STATUS.CLOSED);
    expect(teamSnapshot(after)).toEqual({
      ...before,
      status: JOB_STATUS.CLOSED,
    });
  });

  it("forced Supporting removal does not mutate historical team when concurrent close commits first", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.close-sup@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-CL-SUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.v6.ft.unf.close-sup@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.ft.unf.close-sup@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [supporting.membership._id],
    });
    const before = teamSnapshot(await Job.findById(job._id).lean());

    installFindByIdEndJobAfterPreRead({
      jobId: job._id,
      endJob: async () => {
        await closePublishedJob({
          actorUser: manager.user,
          jobId: job._id.toString(),
        });
      },
    });

    await executeForcedSupportingRemoval({
      jobId: job._id,
      companyId: manager.company._id,
      supportingCompanyMemberId: supporting.membership._id,
    });

    const after = await Job.findById(job._id).lean();
    expect(after.status).toBe(JOB_STATUS.CLOSED);
    expect(teamSnapshot(after)).toEqual({
      ...before,
      status: JOB_STATUS.CLOSED,
    });
  });

  it("forced Primary/Supporting mutations do not mutate after persisted EXPIRED between discovery and write", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.expired@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-EXP",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.unf.expired@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.expired@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const primaryJob = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      supportingIds: [replacement.membership._id],
    });
    const supportingJob = await createJob({
      companyId: manager.company._id,
      primaryMemberId: replacement.membership._id,
      supportingIds: [outgoing.membership._id],
    });
    const beforePrimary = teamSnapshot(await Job.findById(primaryJob._id).lean());
    const beforeSupporting = teamSnapshot(
      await Job.findById(supportingJob._id).lean(),
    );

    installFindByIdEndJobAfterPreRead({
      jobId: primaryJob._id,
      endJob: async () => {
        await Job.collection.updateOne(
          { _id: primaryJob._id },
          {
            $set: {
              status: JOB_STATUS.EXPIRED,
              applicationDeadline: PAST_DEADLINE,
            },
          },
        );
      },
    });

    await executeForcedPrimaryTransfer({
      jobId: primaryJob._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacement.membership._id,
    });

    installFindByIdEndJobAfterPreRead({
      jobId: supportingJob._id,
      endJob: async () => {
        await Job.collection.updateOne(
          { _id: supportingJob._id },
          {
            $set: {
              status: JOB_STATUS.EXPIRED,
              applicationDeadline: PAST_DEADLINE,
            },
          },
        );
      },
    });

    await executeForcedSupportingRemoval({
      jobId: supportingJob._id,
      companyId: manager.company._id,
      supportingCompanyMemberId: outgoing.membership._id,
    });

    const afterPrimary = await Job.findById(primaryJob._id).lean();
    const afterSupporting = await Job.findById(supportingJob._id).lean();
    expect(afterPrimary.status).toBe(JOB_STATUS.EXPIRED);
    expect(afterSupporting.status).toBe(JOB_STATUS.EXPIRED);
    expect(teamSnapshot(afterPrimary)).toEqual({
      ...beforePrimary,
      status: JOB_STATUS.EXPIRED,
    });
    expect(teamSnapshot(afterSupporting)).toEqual({
      ...beforeSupporting,
      status: JOB_STATUS.EXPIRED,
    });
  });

  it("DRAFT and PENDING_APPROVAL still allow forced Primary transfer (BR-25)", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.prepub@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-PRE",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.unf.prepub@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacementDraft = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.draft@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacementPending = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.pending@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const draftJob = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      status: JOB_STATUS.DRAFT,
      applicationDeadline: null,
    });
    const pendingJob = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      status: JOB_STATUS.PENDING_APPROVAL,
      applicationDeadline: FUTURE_DEADLINE(),
    });

    await executeForcedPrimaryTransfer({
      jobId: draftJob._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacementDraft.membership._id,
    });
    await executeForcedPrimaryTransfer({
      jobId: pendingJob._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacementPending.membership._id,
    });

    const draftAfter = await Job.findById(draftJob._id).lean();
    const pendingAfter = await Job.findById(pendingJob._id).lean();
    expect(draftAfter.status).toBe(JOB_STATUS.DRAFT);
    expect(pendingAfter.status).toBe(JOB_STATUS.PENDING_APPROVAL);
    expect(draftAfter.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacementDraft.membership._id.toString(),
    );
    expect(pendingAfter.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacementPending.membership._id.toString(),
    );
  });

  it("active PUBLISHED with future deadline still forced-transfers normally", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.active@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-ACT",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.unf.active@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.active@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const other = await createActiveRecruiterContext({
      email: "other.v6.ft.unf.active@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      supportingIds: [replacement.membership._id, other.membership._id],
    });
    const creator = job.createdByCompanyMemberId.toString();
    const title = job.title;

    await executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacement.membership._id,
    });

    const after = await Job.findById(job._id).lean();
    expect(after.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(
      after.supportingRecruiterCompanyMemberIds.map((id) => id.toString()),
    ).toEqual([other.membership._id.toString()]);
    expect(after.companyId.toString()).toBe(manager.company._id.toString());
    expect(after.createdByCompanyMemberId.toString()).toBe(creator);
    expect(after.title).toBe(title);
    expect(after.status).toBe(JOB_STATUS.PUBLISHED);
  });

  it("lock re-evaluates zero active responsibility when Job closes before forced Primary mutation", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.lock-reeval@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-LOCK",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.unf.lock-reeval@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.unf.lock-reeval@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
    });
    const before = teamSnapshot(await Job.findById(job._id).lean());

    // Discover while unfinished, then close before forced mutation write.
    installFindByIdEndJobAfterPreRead({
      jobId: job._id,
      endJob: async () => {
        await closePublishedJob({
          actorUser: manager.user,
          jobId: job._id.toString(),
        });
      },
    });

    await lockRecruiter({
      managerUser: manager.user,
      recruiterId: outgoing.user._id,
      transfers: [
        {
          jobId: job._id.toString(),
          replacementCompanyMemberId: replacement.membership._id.toString(),
        },
      ],
    });

    const membership = await CompanyMember.findById(outgoing.membership._id).lean();
    const after = await Job.findById(job._id).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.LOCKED);
    expect(after.status).toBe(JOB_STATUS.CLOSED);
    expect(teamSnapshot(after)).toEqual({
      ...before,
      status: JOB_STATUS.CLOSED,
    });
  });

  it("terminate re-evaluates zero active responsibility when Supporting Job expires before removal", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.unf.term-reeval@example.com",
      businessRegistrationNumber: "BRN-V6-FT-UNF-TERM",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.v6.ft.unf.term-reeval@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const supporting = await createActiveRecruiterContext({
      email: "supporting.v6.ft.unf.term-reeval@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [supporting.membership._id],
    });
    const before = teamSnapshot(await Job.findById(job._id).lean());

    const originalFindById = Job.findById.bind(Job);
    let ended = false;

    vi.spyOn(Job, "findById").mockImplementation(async (...args) => {
      const result = await originalFindById(...args);

      if (!ended && args[0]?.toString() === job._id.toString()) {
        ended = true;
        vi.spyOn(Job, "findById").mockRestore();
        await Job.collection.updateOne(
          { _id: job._id },
          {
            $set: {
              status: JOB_STATUS.EXPIRED,
              applicationDeadline: PAST_DEADLINE,
            },
          },
        );
      }

      return result;
    });

    await terminateRecruiter({
      managerUser: manager.user,
      recruiterId: supporting.user._id,
      transfers: [],
    });

    const membership = await CompanyMember.findById(
      supporting.membership._id,
    ).lean();
    const after = await Job.findById(job._id).lean();
    expect(membership.status).toBe(COMPANY_MEMBER_STATUS.TERMINATED);
    expect(after.status).toBe(JOB_STATUS.EXPIRED);
    expect(teamSnapshot(after)).toEqual({
      ...before,
      status: JOB_STATUS.EXPIRED,
    });
  });
});
