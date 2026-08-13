import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import {
  firstAssignApplication,
  getCandidateMyApplication,
  getManagedJobPipelineWorkspace,
  getRecruiterMyApplication,
  listCandidateMyApplications,
  listManagedJobs,
  listPrimaryJobApplications,
  listRecruiterMyApplications,
  reassignApplication,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import { lockAccount } from "../../src/services/platform-admin.service.js";
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
const PAST_DEADLINE = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T16:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-13T15:59:00.000Z");

const PIPELINE_NON_APPLIED_NON_TERMINAL = Object.freeze([
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
]);

const PIPELINE_STATUSES = Object.freeze([
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
]);

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s05-reads.pdf",
    originalFileName: "v10-s05-reads.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  status = JOB_STATUS.PUBLISHED,
  title = "Slice 05 Read Job",
  applicationDeadline = FUTURE_DEADLINE(),
}) => {
  const publishedAt =
    status === JOB_STATUS.DRAFT || status === JOB_STATUS.PENDING_APPROVAL
      ? null
      : new Date("2026-01-15");

  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status,
    publishedAt,
    applicationDeadline,
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
};

const createDirectApplication = async ({
  candidateUserId,
  jobId,
  status = APPLICATION_STATUS.APPLIED,
  assignedRecruiterCompanyMemberId = null,
  appliedAt = APPLIED_AT,
  submittedCvSnapshot = buildUploadedSnapshot(),
  version = 0,
}) => {
  const created = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  if (
    status === APPLICATION_STATUS.APPLIED &&
    assignedRecruiterCompanyMemberId == null &&
    version === 0
  ) {
    return created;
  }

  const $set = {
    status,
    assignedRecruiterCompanyMemberId,
    version,
  };

  if (status === APPLICATION_STATUS.WITHDRAWN) {
    $set.withdrawnAt = new Date("2026-08-13T16:30:00.000Z");
  }

  await Application.updateOne({ _id: created._id }, { $set });
  return Application.findById(created._id);
};

const setupCompany = async ({ emailPrefix = "v10.s05.reads" } = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    fullName: "Primary Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-P`,
    jobTitle: "Lead Recruiter",
  });
  const supporting = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting@example.com`,
    fullName: "Supporting Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-S`,
    jobTitle: "Supporting Recruiter",
  });
  const supportingB = await createActiveRecruiterContext({
    email: `${emailPrefix}.supportingb@example.com`,
    fullName: "Supporting Recruiter B",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-B`,
    jobTitle: "Supporting Recruiter B",
  });

  return { manager, primary, supporting, supportingB };
};

const applicationIds = (result) =>
  (result.applications ?? []).map((item) => item.id);

const workloadEntry = (workload, companyMemberId) =>
  workload.find(
    (entry) => entry.companyMemberId === companyMemberId.toString(),
  );

const filterByCurrentAssignee = (applications, companyMemberId) =>
  applications.filter(
    (application) =>
      application.assignedRecruiterCompanyMemberId ===
      companyMemberId.toString(),
  );

describe("V10 Slice 05 — Assignment read projections (F06–F10)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("places Unassigned pipeline-status Applications in the matching workspace group (BR-03/BR-05/BR-43)", async () => {
    const { primary } = await setupCompany({
      emailPrefix: "v10.s05.pipeline.unassigned",
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
    });

    const created = [];
    for (const [index, status] of PIPELINE_NON_APPLIED_NON_TERMINAL.entries()) {
      const candidate = await createVerifiedUser({
        email: `cand.unassigned.group.${index}@example.com`,
      });
      created.push(
        await createDirectApplication({
          candidateUserId: candidate.user._id,
          jobId: job._id,
          status,
          assignedRecruiterCompanyMemberId: null,
          version: 1,
          appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
        }),
      );
    }

    const workspace = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });

    expect(Object.keys(workspace.pipeline).sort()).toEqual(
      [...PIPELINE_STATUSES].sort(),
    );
    expect(workspace.pipeline).not.toHaveProperty("UNASSIGNED");

    for (const [index, status] of PIPELINE_NON_APPLIED_NON_TERMINAL.entries()) {
      expect(workspace.pipeline[status]).toHaveLength(1);
      expect(workspace.pipeline[status][0]).toMatchObject({
        id: created[index]._id.toString(),
        status,
        isUnassigned: true,
        assignedRecruiterCompanyMemberId: null,
        assignedRecruiter: null,
      });
      expect(workspace.countsByStatus[status]).toBe(1);
    }

    expect(workspace.unassignedCount).toBe(4);
    expect(workspace.unassignedApplications).toHaveLength(4);
    expect(
      workspace.unassignedApplications.every((item) => item.isUnassigned),
    ).toBe(true);
  });

  it("filters Unassigned outside APPLIED using current Assignee, not status (BR-05)", async () => {
    const { primary, supporting } = await setupCompany({
      emailPrefix: "v10.s05.unassigned.filter",
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const unassignedCandidate = await createVerifiedUser({
      email: "cand.filter.unassigned@example.com",
    });
    const assignedCandidate = await createVerifiedUser({
      email: "cand.filter.assigned@example.com",
    });
    const unassigned = await createDirectApplication({
      candidateUserId: unassignedCandidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.CONTACTED,
      assignedRecruiterCompanyMemberId: null,
      version: 1,
    });
    const assigned = await createDirectApplication({
      candidateUserId: assignedCandidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.CONTACTED,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
      appliedAt: new Date(APPLIED_AT.getTime() + 1000),
    });

    const workspace = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });

    expect(workspace.pipeline.CONTACTED).toHaveLength(2);
    expect(workspace.unassignedApplications.map((item) => item.id)).toEqual([
      unassigned._id.toString(),
    ]);
    expect(
      filterByCurrentAssignee(
        workspace.applications,
        supporting.membership._id,
      ).map((item) => item.id),
    ).toEqual([assigned._id.toString()]);

    await reassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: assigned._id.toString(),
      assigneeCompanyMemberId: primary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const after = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(
      filterByCurrentAssignee(after.applications, supporting.membership._id),
    ).toEqual([]);
    expect(
      filterByCurrentAssignee(after.applications, primary.membership._id).map(
        (item) => item.id,
      ),
    ).toEqual([assigned._id.toString()]);
    expect(after.unassignedApplications.map((item) => item.id)).toEqual([
      unassigned._id.toString(),
    ]);
  });

  it("reflects Recruiter My Applications across A → NONE → B (F07)", async () => {
    const { primary, supporting, supportingB } = await setupCompany({
      emailPrefix: "v10.s05.myapps.anb",
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id, supportingB.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "cand.myapps.anb@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    expect(
      applicationIds(
        await listRecruiterMyApplications({ actorUser: supporting.user }),
      ),
    ).toEqual([application._id.toString()]);

    const unassigned = await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    expect(
      applicationIds(
        await listRecruiterMyApplications({ actorUser: supporting.user }),
      ),
    ).toEqual([]);
    expect(
      applicationIds(
        await listRecruiterMyApplications({ actorUser: supportingB.user }),
      ),
    ).toEqual([]);
    await expect(
      getRecruiterMyApplication({
        actorUser: supporting.user,
        applicationId: application._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await firstAssignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedVersion: unassigned.application.version,
    });

    expect(
      applicationIds(
        await listRecruiterMyApplications({ actorUser: supporting.user }),
      ),
    ).toEqual([]);
    const bView = await listRecruiterMyApplications({
      actorUser: supportingB.user,
    });
    expect(applicationIds(bView)).toEqual([application._id.toString()]);
    expect(bView.applications[0].status).toBe(APPLICATION_STATUS.SCREENING);
    expect(bView.currentWorkloadCount).toBe(1);
  });

  it("reflects Candidate My Applications assignee null then the new Assignee (F08/BR-32/BR-41)", async () => {
    const { primary, supporting, supportingB } = await setupCompany({
      emailPrefix: "v10.s05.candidate.assignee",
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id, supportingB.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "cand.assignee.s05@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    const before = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id.toString(),
    });
    expect(before.application.status).toBe(
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    );
    expect(before.application.assignedRecruiter).toEqual({
      fullName: "Supporting Recruiter",
      avatarUrl: null,
      jobTitle: "Supporting Recruiter",
    });

    const unassigned = await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const afterUnassign = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id.toString(),
    });
    expect(afterUnassign.application.isUnassigned).toBe(true);
    expect(afterUnassign.application.assignedRecruiter).toBeNull();
    expect(afterUnassign.application.status).toBe(
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    );
    expect(JSON.stringify(afterUnassign)).not.toContain("Supporting Recruiter");
    expect(afterUnassign.application).not.toHaveProperty(
      "assignedRecruiterCompanyMemberId",
    );
    expect(JSON.stringify(afterUnassign)).not.toContain(supporting.user.email);

    await firstAssignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedVersion: unassigned.application.version,
    });

    const afterAssign = await listCandidateMyApplications({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
    });
    expect(afterAssign.applications).toHaveLength(1);
    expect(afterAssign.applications[0].assignedRecruiter).toEqual({
      fullName: "Supporting Recruiter B",
      avatarUrl: null,
      jobTitle: "Supporting Recruiter B",
    });
    expect(afterAssign.applications[0].status).toBe(
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    );
    expect(JSON.stringify(afterAssign)).not.toContain("Supporting Recruiter\"");
    expect(JSON.stringify(afterAssign)).not.toContain("assignmentHistory");
  });

  it("derives workload for A → NONE, NONE → B, and A → B (F10/BR-33/BR-34)", async () => {
    const { primary, supporting, supportingB } = await setupCompany({
      emailPrefix: "v10.s05.workload.transitions",
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id, supportingB.membership._id],
    });
    const candidateA = await createVerifiedUser({
      email: "cand.workload.a@example.com",
    });
    const candidateB = await createVerifiedUser({
      email: "cand.workload.b@example.com",
    });
    const toUnassign = await createDirectApplication({
      candidateUserId: candidateA.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });
    const toReassign = await createDirectApplication({
      candidateUserId: candidateB.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.CONTACTED,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
      appliedAt: new Date(APPLIED_AT.getTime() + 1000),
    });

    const before = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(
      workloadEntry(before.currentWorkloadByAssignee, supporting.membership._id)
        .count,
    ).toBe(2);

    const unassigned = await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: toUnassign._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const afterUnassign = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(
      workloadEntry(
        afterUnassign.currentWorkloadByAssignee,
        supporting.membership._id,
      ).count,
    ).toBe(1);
    expect(
      workloadEntry(
        afterUnassign.currentWorkloadByAssignee,
        supportingB.membership._id,
      ),
    ).toBeUndefined();
    expect(
      (
        await listRecruiterMyApplications({ actorUser: supporting.user })
      ).currentWorkloadCount,
    ).toBe(1);

    await firstAssignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: toUnassign._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedVersion: unassigned.application.version,
    });

    const afterAssignB = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(
      workloadEntry(
        afterAssignB.currentWorkloadByAssignee,
        supporting.membership._id,
      ).count,
    ).toBe(1);
    expect(
      workloadEntry(
        afterAssignB.currentWorkloadByAssignee,
        supportingB.membership._id,
      ).count,
    ).toBe(1);

    await reassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: toReassign._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const afterReassign = await listManagedJobs({ actorUser: primary.user });
    expect(
      workloadEntry(
        afterReassign.currentWorkloadByAssignee,
        supporting.membership._id,
      ),
    ).toBeUndefined();
    expect(
      workloadEntry(
        afterReassign.currentWorkloadByAssignee,
        supportingB.membership._id,
      ).count,
    ).toBe(2);
    expect(
      (
        await listRecruiterMyApplications({ actorUser: supporting.user })
      ).currentWorkloadCount,
    ).toBe(0);
    expect(
      (
        await listRecruiterMyApplications({ actorUser: supportingB.user })
      ).currentWorkloadCount,
    ).toBe(2);
  });

  it("keeps CLOSED/EXPIRED non-terminal assigned Applications in workload (F09/BR-25/BR-27/BR-30)", async () => {
    const { primary, supporting } = await setupCompany({
      emailPrefix: "v10.s05.workload.jobstatus",
    });
    const closed = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
      status: JOB_STATUS.CLOSED,
      title: "Closed Continuity",
    });
    const expired = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
      status: JOB_STATUS.EXPIRED,
      applicationDeadline: PAST_DEADLINE(),
      title: "Expired Continuity",
    });
    const closedCandidate = await createVerifiedUser({
      email: "cand.closed.s05@example.com",
    });
    const expiredCandidate = await createVerifiedUser({
      email: "cand.expired.s05@example.com",
    });
    const closedApplication = await createDirectApplication({
      candidateUserId: closedCandidate.user._id,
      jobId: closed._id,
      status: APPLICATION_STATUS.INTERVIEW_COMPLETED,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });
    await createDirectApplication({
      candidateUserId: expiredCandidate.user._id,
      jobId: expired._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    const before = await listManagedJobs({ actorUser: primary.user });
    expect(
      workloadEntry(before.currentWorkloadByAssignee, supporting.membership._id)
        .count,
    ).toBe(2);
    expect(
      (
        await listRecruiterMyApplications({ actorUser: supporting.user })
      ).currentWorkloadCount,
    ).toBe(2);

    await unassignApplication({
      actorUser: primary.user,
      jobId: closed._id.toString(),
      applicationId: closedApplication._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const afterUnassign = await listManagedJobs({ actorUser: primary.user });
    expect(
      workloadEntry(
        afterUnassign.currentWorkloadByAssignee,
        supporting.membership._id,
      ).count,
    ).toBe(1);

    const closedWorkspace = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: closed._id.toString(),
    });
    expect(closedWorkspace.pipeline.INTERVIEW_COMPLETED).toHaveLength(1);
    expect(closedWorkspace.pipeline.INTERVIEW_COMPLETED[0].isUnassigned).toBe(
      true,
    );
    expect(closedWorkspace.job.status).toBe(JOB_STATUS.CLOSED);
  });

  it("excludes terminal Applications from active workload (BR-20/BR-33)", async () => {
    const { primary, supporting } = await setupCompany({
      emailPrefix: "v10.s05.workload.terminal",
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const statuses = [
      APPLICATION_STATUS.CONTACTED,
      APPLICATION_STATUS.HIRED,
      APPLICATION_STATUS.REJECTED,
      APPLICATION_STATUS.WITHDRAWN,
    ];

    for (const [index, status] of statuses.entries()) {
      const candidate = await createVerifiedUser({
        email: `cand.terminal.s05.${index}@example.com`,
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
      });
    }

    const workspace = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(
      workloadEntry(
        workspace.currentWorkloadByAssignee,
        supporting.membership._id,
      ).count,
    ).toBe(1);

    const mine = await listRecruiterMyApplications({
      actorUser: supporting.user,
    });
    expect(mine.applications).toHaveLength(4);
    expect(mine.currentWorkloadCount).toBe(1);
    expect(
      mine.applications.filter((item) => item.isActiveWorkload),
    ).toHaveLength(1);
  });

  it("does not grant Pipeline authority from Unassigned reads or lost eligibility (BR-18/BR-19)", async () => {
    const { manager, primary, supporting } = await setupCompany({
      emailPrefix: "v10.s05.authority",
    });
    const platformAdmin = await createVerifiedUser({
      email: "v10.s05.authority.admin@example.com",
      fullName: "Slice 05 Admin",
      role: USER_ROLE.PLATFORM_ADMIN,
    });
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "cand.authority.s05@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    expect(
      applicationIds(
        await listRecruiterMyApplications({ actorUser: supporting.user }),
      ),
    ).toEqual([application._id.toString()]);

    await lockAccount({
      targetUserId: supporting.user._id.toString(),
      actorUserId: platformAdmin.user._id,
    });

    expect(
      applicationIds(
        await listRecruiterMyApplications({ actorUser: supporting.user }),
      ),
    ).toEqual([application._id.toString()]);
    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.CONTACTED,
        expectedStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const persistedAfterLock = await Application.findById(application._id);
    expect(persistedAfterLock.status).toBe(APPLICATION_STATUS.SCREENING);
    expect(String(persistedAfterLock.assignedRecruiterCompanyMemberId)).toBe(
      supporting.membership._id.toString(),
    );

    const unassigned = await unassignApplication({
      actorUser: primary.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    const workspace = await getManagedJobPipelineWorkspace({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(workspace.pipeline.SCREENING[0].isUnassigned).toBe(true);
    const primaryView = await listPrimaryJobApplications({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });
    expect(
      primaryView.applications.find(
        (item) => item.id === application._id.toString(),
      ).isUnassigned,
    ).toBe(true);
    const candidateView = await getCandidateMyApplication({
      candidateUserId: candidate.user._id,
      actorUser: candidate.user,
      applicationId: application._id.toString(),
    });
    expect(candidateView.application.isUnassigned).toBe(true);

    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.CONTACTED,
        expectedStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: unassigned.application.version,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      updateApplicationRecruitmentPipelineStatus({
        actorUser: manager.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.CONTACTED,
        expectedStatus: APPLICATION_STATUS.SCREENING,
        expectedVersion: unassigned.application.version,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
