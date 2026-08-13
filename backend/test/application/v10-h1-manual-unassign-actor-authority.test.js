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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import {
  automaticallyUnassignApplication,
  unassignApplication,
} from "../../src/services/application.service.js";
import { replacePrimaryRecruiter } from "../../src/services/job.service.js";
import { lockCompany } from "../../src/services/platform-admin.service.js";
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
const APPLIED_AT = new Date("2026-08-14T08:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-14T07:59:00.000Z");

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "H1 Actor Authority Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-h1-actor.pdf",
    originalFileName: "v10-h1-actor.pdf",
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
    title: "H1 Actor Authority Job",
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

const setupH1Company = async ({ emailPrefix }) => {
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
  const successor = await createActiveRecruiterContext({
    email: `${emailPrefix}.successor@example.com`,
    fullName: "Successor Primary",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
    jobTitle: "Successor",
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
    fullName: "H1 Candidate",
  });

  return { manager, primary, successor, assignee, candidate };
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
 * After the manual Unassign soft-reads Job (stale Primary/Company still
 * visible), commit a concurrent authority-losing writer before Unassign
 * continues with that stale snapshot.
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

describe("V10 Final Acceptance H1 — manual Unassign actor authority at commit", () => {
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

  it("1. stale Primary Unassign fails after concurrent Primary replacement; Assignee preserved", async () => {
    const ctx = await setupH1Company({ emailPrefix: "v10.h1.r1" });
    const job = await createJobWithTeam({
      companyId: ctx.manager.company._id,
      primaryMemberId: ctx.primary.membership._id,
      supportingMemberIds: [
        ctx.successor.membership._id,
        ctx.assignee.membership._id,
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
        await replacePrimaryRecruiter({
          managerUser: ctx.manager.user,
          jobId: job._id.toString(),
          newPrimaryCompanyMemberId: ctx.successor.membership._id.toString(),
          keepOldPrimaryAsSupporting: true,
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

    const persistedJob = await Job.findById(job._id).lean();
    expect(persistedJob.primaryRecruiterCompanyMemberId.toString()).toBe(
      ctx.successor.membership._id.toString(),
    );

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
    expect(after.assignee).toBe(ctx.assignee.membership._id.toString());
  });

  it("2. stale Unassign fails after concurrent Company LOCK; assignment kept (freeze)", async () => {
    const ctx = await setupH1Company({ emailPrefix: "v10.h1.r2" });
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
        await lockCompany({ companyId: ctx.manager.company._id.toString() });
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
    ).rejects.toMatchObject({ statusCode: 409 });

    const company = await Company.findById(ctx.manager.company._id).lean();
    expect(company.operationalStatus).toBe(COMPANY_OPERATIONAL_STATUS.LOCKED);

    const after = snapshotAssignment(await Application.findById(application._id));
    expect(after).toEqual(before);
    expect(after.assignee).toBe(ctx.assignee.membership._id.toString());
  });

  it("3a. current Primary Unassign still succeeds", async () => {
    const ctx = await setupH1Company({ emailPrefix: "v10.h1.r3a" });
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

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persisted.version).toBe(2);
    expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
  });

  it("3b. current Company Manager Unassign still succeeds", async () => {
    const ctx = await setupH1Company({ emailPrefix: "v10.h1.r3b" });
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

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persisted.version).toBe(2);
  });

  it("4. automatic Unassign remains actor-authority-free and still clears Assignee", async () => {
    const ctx = await setupH1Company({ emailPrefix: "v10.h1.r4" });
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

    // Even if Company is already locked, internal automatic Unassign must still
    // clear the outgoing Assignee (lifecycle/team eligibility loss), not apply
    // manual actor-authority / Company-operational gates.
    await lockCompany({ companyId: ctx.manager.company._id.toString() });

    await automaticallyUnassignApplication({
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: ctx.assignee.membership._id.toString(),
      expectedVersion: 1,
    });

    const persisted = await Application.findById(application._id).lean();
    expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
    expect(persisted.version).toBe(2);
    expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
  });
});
