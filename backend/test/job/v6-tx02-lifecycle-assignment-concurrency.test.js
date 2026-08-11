import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS, {
  OUTSTANDING_PRIMARY_JOB_STATUSES,
} from "../../src/constants/job-status.js";

import CompanyMember from "../../src/models/company-member.model.js";
import Job from "../../src/models/job.model.js";
import {
  addSupportingRecruiter,
  createDraftJob,
  replacePrimaryRecruiter,
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

let empCounter = 0;
const emp = () => `NV-TX02-${++empCounter}`;

const buildUnfinishedResponsibilityFilter = (memberId) => ({
  $or: [
    { primaryRecruiterCompanyMemberId: memberId },
    { supportingRecruiterCompanyMemberIds: memberId },
  ],
  status: { $in: OUTSTANDING_PRIMARY_JOB_STATUSES },
  $nor: [
    {
      status: JOB_STATUS.PUBLISHED,
      applicationDeadline: { $ne: null, $lte: new Date() },
    },
  ],
});

const assertTx02InvariantForMember = async (memberId) => {
  const membership = await CompanyMember.findById(memberId).lean();

  if (membership.status === COMPANY_MEMBER_STATUS.ACTIVE) {
    return;
  }

  const unfinishedResponsibility = await Job.findOne(
    buildUnfinishedResponsibilityFilter(memberId),
  ).lean();

  expect(unfinishedResponsibility).toBeNull();
};

const EARLY_SETUP_AUTH_MESSAGES = new Set([
  "Company Staff access required",
  "Recruiter access required",
  "Company Manager access required",
]);

const settledServiceOutcome = (result) => {
  if (result.status === "fulfilled") {
    return { ok: true, value: result.value };
  }

  return {
    ok: false,
    statusCode: result.reason?.statusCode,
    message: result.reason?.message,
  };
};

const assertNoEarlySetupAuthFailure = (results) => {
  for (const result of results) {
    const outcome = settledServiceOutcome(result);

    if (!outcome.ok) {
      expect(EARLY_SETUP_AUTH_MESSAGES.has(outcome.message)).toBe(false);
    }
  }
};

const runConcurrentInterleaving = async ({ operations, memberIds }) => {
  const results = await Promise.allSettled(
    operations.map((operation) => operation()),
  );

  assertNoEarlySetupAuthFailure(results);

  for (const memberId of memberIds) {
    await assertTx02InvariantForMember(memberId);
  }
};

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  applicationDeadline = FUTURE_DEADLINE(),
}) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline,
    title: "TX-02 Concurrency Job",
  });

describe("V6 TX-02 — lifecycle completion vs team assignment serialization", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
    empCounter = 0;
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("create DRAFT initial Primary vs LOCK cannot commit LOCKED + active Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.draft-lock@example.com",
      businessRegistrationNumber: "BRN-TX02-DRAFT-LOCK",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.tx02.draft-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    await runConcurrentInterleaving({
      memberIds: [recruiter.membership._id],
      operations: [
        () =>
          lockRecruiter({
            managerUser: manager.user,
            recruiterId: recruiter.user._id,
          }),
        () =>
          createDraftJob({
            recruiterUser: recruiter.user,
          }),
      ],
    });
  });

  it("create DRAFT initial Primary vs TERMINATE cannot commit TERMINATED + active Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.draft-term@example.com",
      businessRegistrationNumber: "BRN-TX02-DRAFT-TERM",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "recruiter.tx02.draft-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    await runConcurrentInterleaving({
      memberIds: [recruiter.membership._id],
      operations: [
        () =>
          terminateRecruiter({
            managerUser: manager.user,
            recruiterId: recruiter.user._id,
          }),
        () =>
          createDraftJob({
            recruiterUser: recruiter.user,
          }),
      ],
    });
  });

  it("add Supporting vs LOCK cannot commit LOCKED + active Supporting", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.add-lock@example.com",
      businessRegistrationNumber: "BRN-TX02-ADD-LOCK",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.tx02.add-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const target = await createActiveRecruiterContext({
      email: "target.tx02.add-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
    });

    await runConcurrentInterleaving({
      memberIds: [target.membership._id],
      operations: [
        () =>
          lockRecruiter({
            managerUser: manager.user,
            recruiterId: target.user._id,
          }),
        () =>
          addSupportingRecruiter({
            actorUser: manager.user,
            jobId: job._id.toString(),
            supportingRecruiterCompanyMemberId: target.membership._id.toString(),
          }),
      ],
    });
  });

  it("add Supporting vs TERMINATE cannot commit TERMINATED + active Supporting", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.add-term@example.com",
      businessRegistrationNumber: "BRN-TX02-ADD-TERM",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.tx02.add-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const target = await createActiveRecruiterContext({
      email: "target.tx02.add-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
    });

    await runConcurrentInterleaving({
      memberIds: [target.membership._id],
      operations: [
        () =>
          terminateRecruiter({
            managerUser: manager.user,
            recruiterId: target.user._id,
          }),
        () =>
          addSupportingRecruiter({
            actorUser: manager.user,
            jobId: job._id.toString(),
            supportingRecruiterCompanyMemberId: target.membership._id.toString(),
          }),
      ],
    });
  });

  it("replace Primary vs LOCK cannot commit LOCKED + active Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.replace-lock@example.com",
      businessRegistrationNumber: "BRN-TX02-REPLACE-LOCK",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.tx02.replace-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const successor = await createActiveRecruiterContext({
      email: "successor.tx02.replace-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [successor.membership._id],
    });

    await runConcurrentInterleaving({
      memberIds: [successor.membership._id],
      operations: [
        () =>
          lockRecruiter({
            managerUser: manager.user,
            recruiterId: successor.user._id,
          }),
        () =>
          replacePrimaryRecruiter({
            managerUser: manager.user,
            jobId: job._id.toString(),
            newPrimaryCompanyMemberId: successor.membership._id.toString(),
            keepOldPrimaryAsSupporting: false,
          }),
      ],
    });
  });

  it("replace Primary vs TERMINATE cannot commit TERMINATED + active Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.replace-term@example.com",
      businessRegistrationNumber: "BRN-TX02-REPLACE-TERM",
    });
    const primary = await createActiveRecruiterContext({
      email: "primary.tx02.replace-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const successor = await createActiveRecruiterContext({
      email: "successor.tx02.replace-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingIds: [successor.membership._id],
    });

    await runConcurrentInterleaving({
      memberIds: [successor.membership._id],
      operations: [
        () =>
          terminateRecruiter({
            managerUser: manager.user,
            recruiterId: successor.user._id,
          }),
        () =>
          replacePrimaryRecruiter({
            managerUser: manager.user,
            jobId: job._id.toString(),
            newPrimaryCompanyMemberId: successor.membership._id.toString(),
            keepOldPrimaryAsSupporting: false,
          }),
      ],
    });
  });

  it("forced-transfer replacement vs LOCK on replacement cannot commit LOCKED + active Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.forced-lock@example.com",
      businessRegistrationNumber: "BRN-TX02-FORCED-LOCK",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.tx02.forced-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.tx02.forced-lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
    });

    await runConcurrentInterleaving({
      memberIds: [replacement.membership._id],
      operations: [
        () =>
          lockRecruiter({
            managerUser: manager.user,
            recruiterId: replacement.user._id,
          }),
        () =>
          lockRecruiter({
            managerUser: manager.user,
            recruiterId: outgoing.user._id,
            transfers: [
              {
                jobId: job._id.toString(),
                replacementCompanyMemberId: replacement.membership._id.toString(),
              },
            ],
          }),
      ],
    });
  });

  it("forced-transfer replacement vs TERMINATE on replacement cannot commit TERMINATED + active Primary", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.tx02.forced-term@example.com",
      businessRegistrationNumber: "BRN-TX02-FORCED-TERM",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.tx02.forced-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.tx02.forced-term@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
    });

    await runConcurrentInterleaving({
      memberIds: [replacement.membership._id],
      operations: [
        () =>
          terminateRecruiter({
            managerUser: manager.user,
            recruiterId: replacement.user._id,
          }),
        () =>
          terminateRecruiter({
            managerUser: manager.user,
            recruiterId: outgoing.user._id,
            transfers: [
              {
                jobId: job._id.toString(),
                replacementCompanyMemberId: replacement.membership._id.toString(),
              },
            ],
          }),
      ],
    });
  });
});
