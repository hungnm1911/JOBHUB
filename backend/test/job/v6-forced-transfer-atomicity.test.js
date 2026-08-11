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
  executeForcedPrimaryTransfer,
} from "../../src/services/job.service.js";
import { lockRecruiter } from "../../src/services/recruiter.service.js";

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
const emp = () => `NV-FT-ATOM-${++empCounter}`;

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  applicationDeadline = FUTURE_DEADLINE(),
  title = "Forced Transfer Atomicity Job",
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

const assertNoPrimaryInSupporting = (job) => {
  const primaryId = job.primaryRecruiterCompanyMemberId.toString();
  const sIds = supportingIdsOf(job);
  expect(sIds).not.toContain(primaryId);
  expect(new Set(sIds).size).toBe(sIds.length);
};

describe("V6 forced Primary transfer — atomic cross-field invariant", () => {
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

  it("stale NONE classification + concurrent add Supporting cannot leave replacement as Primary and Supporting", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.atom.stale@example.com",
      businessRegistrationNumber: "BRN-V6-FT-ATOM-STALE",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.atom.stale@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.atom.stale@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
    });
    const creator = job.createdByCompanyMemberId.toString();
    const companyId = job.companyId.toString();
    const title = job.title;
    const status = job.status;

    const originalFindById = Job.findById.bind(Job);
    let preReadIntercepted = false;

    vi.spyOn(Job, "findById").mockImplementation(async (...args) => {
      const result = await originalFindById(...args);

      if (!preReadIntercepted && args[0]?.toString() === job._id.toString()) {
        preReadIntercepted = true;
        vi.spyOn(Job, "findById").mockRestore();

        await addSupportingRecruiter({
          actorUser: manager.user,
          jobId: job._id.toString(),
          supportingRecruiterCompanyMemberId: replacement.membership._id.toString(),
        });
      }

      return result;
    });

    await executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacement.membership._id,
    });

    const persisted = await Job.findById(job._id).lean();

    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).not.toContain(
      replacement.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).not.toContain(
      outgoing.membership._id.toString(),
    );
    assertNoPrimaryInSupporting(persisted);
    expect(persisted.createdByCompanyMemberId.toString()).toBe(creator);
    expect(persisted.companyId.toString()).toBe(companyId);
    expect(persisted.title).toBe(title);
    expect(persisted.status).toBe(status);
  });

  it("forced transfer when replacement is already Supporting promotes and removes replacement from Supporting", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.atom.supporting@example.com",
      businessRegistrationNumber: "BRN-V6-FT-ATOM-SUP",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.atom.supporting@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.atom.supporting@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const otherSupporting = await createActiveRecruiterContext({
      email: "other.v6.ft.atom.supporting@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      supportingIds: [
        replacement.membership._id,
        otherSupporting.membership._id,
      ],
    });

    await executeForcedPrimaryTransfer({
      jobId: job._id,
      companyId: manager.company._id,
      oldPrimaryCompanyMemberId: outgoing.membership._id,
      replacementCompanyMemberId: replacement.membership._id,
    });

    const persisted = await Job.findById(job._id).lean();

    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).toContain(
      otherSupporting.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).not.toContain(
      replacement.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).not.toContain(
      outgoing.membership._id.toString(),
    );
    assertNoPrimaryInSupporting(persisted);
  });

  it("forced transfer via lock keeps outgoing Primary at NONE and unique Supporting list", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "cm.v6.ft.atom.lock@example.com",
      businessRegistrationNumber: "BRN-V6-FT-ATOM-LOCK",
    });
    const outgoing = await createActiveRecruiterContext({
      email: "outgoing.v6.ft.atom.lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });
    const replacement = await createActiveRecruiterContext({
      email: "replacement.v6.ft.atom.lock@example.com",
      company: manager.company,
      employeeCode: emp(),
    });

    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: outgoing.membership._id,
      supportingIds: [replacement.membership._id],
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

    const persisted = await Job.findById(job._id).lean();

    expect(persisted.primaryRecruiterCompanyMemberId.toString()).toBe(
      replacement.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).not.toContain(
      outgoing.membership._id.toString(),
    );
    expect(supportingIdsOf(persisted)).not.toContain(
      replacement.membership._id.toString(),
    );
    assertNoPrimaryInSupporting(persisted);
  });
});
