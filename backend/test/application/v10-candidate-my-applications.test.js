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
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  getCandidateMyApplication,
  listCandidateMyApplications,
  reassignApplication,
  updateApplicationRecruitmentPipelineStatus,
  withdrawApplication,
} from "../../src/services/application.service.js";
import { hashPassword } from "../../src/utils/hash-password.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST_DEADLINE = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T07:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-13T06:59:00.000Z");

const ALL_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
];

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s13.pdf",
    originalFileName: "v10-s13.pdf",
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
  title = "Candidate My Applications Job",
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
    $set.withdrawnAt = new Date("2026-08-13T08:00:00.000Z");
  }

  await Application.updateOne({ _id: created._id }, { $set });
  return Application.findById(created._id);
};

const setupCompany = async ({ emailPrefix = "v10.s13" } = {}) => {
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

  return { manager, primary, supporting };
};

const applicationIds = (result) =>
  result.applications.map((application) => application.id);

describe("V10 Slice 13 — Candidate My Applications (F08 / F09 partial)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — owner-scoped projection", () => {
    it("lets Candidate see all own Applications and never another Candidate's", async () => {
      const { primary } = await setupCompany({
        emailPrefix: "v10.s13.owner",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        title: "Owner Job",
      });
      const candidateA = await createVerifiedUser({
        email: "cand.a.s13@example.com",
      });
      const candidateB = await createVerifiedUser({
        email: "cand.b.s13@example.com",
      });
      const ownApp = await createDirectApplication({
        candidateUserId: candidateA.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
      });
      const foreignApp = await createDirectApplication({
        candidateUserId: candidateB.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });

      const result = await listCandidateMyApplications({
        candidateUserId: candidateA.user._id,
        actorUser: candidateA.user,
      });

      expect(applicationIds(result)).toEqual([ownApp._id.toString()]);
      expect(result.applications[0].job.title).toBe("Owner Job");
      expect(result.applications[0].company.name).toBeTruthy();
      expect(result.applications[0].company.id).toBe(
        primary.membership.companyId.toString(),
      );

      await expect(
        getCandidateMyApplication({
          candidateUserId: candidateA.user._id,
          actorUser: candidateA.user,
          applicationId: foreignApp._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("covers all current Recruitment Statuses in list/detail", async () => {
      const { primary } = await setupCompany({
        emailPrefix: "v10.s13.statuses",
      });
      const candidate = await createVerifiedUser({
        email: "cand.statuses.s13@example.com",
      });

      const created = [];
      for (const [index, status] of ALL_STATUSES.entries()) {
        const job = await createJob({
          companyId: primary.membership.companyId,
          primaryMemberId: primary.membership._id,
          title: `Status Job ${status}`,
        });
        created.push(
          await createDirectApplication({
            candidateUserId: candidate.user._id,
            jobId: job._id,
            status,
            assignedRecruiterCompanyMemberId:
              status === APPLICATION_STATUS.APPLIED
                ? null
                : primary.membership._id,
            version: status === APPLICATION_STATUS.APPLIED ? 0 : 1,
            appliedAt: new Date(APPLIED_AT.getTime() + index * 1000),
          }),
        );
      }

      const result = await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
      });

      expect(result.applications).toHaveLength(8);
      expect(new Set(result.applications.map((row) => row.status))).toEqual(
        new Set(ALL_STATUSES),
      );

      const hired = created.find(
        (application) => application.status === APPLICATION_STATUS.HIRED,
      );
      const detail = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: hired._id.toString(),
      });
      expect(detail.application.status).toBe(APPLICATION_STATUS.HIRED);
    });

    it("reads Applications on PUBLISHED, CLOSED, and EXPIRED Jobs without changing status", async () => {
      const { primary } = await setupCompany({
        emailPrefix: "v10.s13.job.lifecycle",
      });
      const candidate = await createVerifiedUser({
        email: "cand.lifecycle.s13@example.com",
      });
      const publishedJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        status: JOB_STATUS.PUBLISHED,
        title: "Published Role",
      });
      const closedJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        status: JOB_STATUS.CLOSED,
        title: "Closed Role",
      });
      const expiredJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        status: JOB_STATUS.EXPIRED,
        applicationDeadline: PAST_DEADLINE(),
        title: "Expired Role",
      });

      const publishedApp = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: publishedJob._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
      });
      const closedApp = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: closedJob._id,
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });
      const expiredApp = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: expiredJob._id,
        status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 2000),
      });

      const result = await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
      });

      expect(applicationIds(result)).toEqual([
        expiredApp._id.toString(),
        closedApp._id.toString(),
        publishedApp._id.toString(),
      ]);
      expect(result.applications.map((row) => row.job.status)).toEqual([
        JOB_STATUS.EXPIRED,
        JOB_STATUS.CLOSED,
        JOB_STATUS.PUBLISHED,
      ]);
      expect(result.applications.map((row) => row.status)).toEqual([
        APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        APPLICATION_STATUS.CONTACTED,
        APPLICATION_STATUS.SCREENING,
      ]);
    });

    it("exposes Candidate-visible Assignee fields only and null when Unassigned (BR-32)", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s13.assignee",
      });
      await User.updateOne(
        { _id: supporting.user._id },
        { $set: { avatarUrl: "https://cdn.example.com/supporting.png" } },
      );
      const unassignedJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "Unassigned Job",
      });
      const assignedJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "Assigned Job",
      });
      const candidate = await createVerifiedUser({
        email: "cand.assignee.s13@example.com",
      });
      const unassigned = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: unassignedJob._id,
      });
      const assigned = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: assignedJob._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });

      const result = await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
      });

      const unassignedView = result.applications.find(
        (row) => row.id === unassigned._id.toString(),
      );
      const assignedView = result.applications.find(
        (row) => row.id === assigned._id.toString(),
      );

      expect(unassignedView.isUnassigned).toBe(true);
      expect(unassignedView.assignedRecruiter).toBeNull();

      expect(assignedView.isUnassigned).toBe(false);
      expect(assignedView.assignedRecruiter).toEqual({
        fullName: "Supporting Recruiter",
        avatarUrl: "https://cdn.example.com/supporting.png",
        jobTitle: "Supporting Recruiter",
      });
      expect(assignedView.assignedRecruiter).not.toHaveProperty("email");
      expect(assignedView.assignedRecruiter).not.toHaveProperty("phone");
      expect(assignedView.assignedRecruiter).not.toHaveProperty(
        "companyMemberId",
      );
      expect(assignedView).not.toHaveProperty(
        "assignedRecruiterCompanyMemberId",
      );
      expect(JSON.stringify(assignedView)).not.toContain(
        supporting.user.email,
      );
      expect(JSON.stringify(assignedView)).not.toContain(
        COMPANY_MEMBER_STATUS.ACTIVE,
      );
    });

    it("reflects First Assign / Reassign current Assignee without former history", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s13.reassign",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.reassign.s13@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      const before = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      });
      expect(before.application.assignedRecruiter).toBeNull();

      const assigned = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      const afterAssign = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      });
      expect(afterAssign.application.assignedRecruiter.fullName).toBe(
        "Supporting Recruiter",
      );

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: assigned.application.version,
      });

      const afterReassign = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      });

      expect(afterReassign.application.assignedRecruiter).toEqual({
        fullName: "Primary Recruiter",
        avatarUrl: null,
        jobTitle: "Lead Recruiter",
      });
      expect(JSON.stringify(afterReassign)).not.toContain(
        "Supporting Recruiter",
      );
    });

    it("keeps final Assignee on terminal Applications when persisted", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s13.terminal",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.terminal.s13@example.com",
      });
      const hired = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.HIRED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 2,
      });

      const detail = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: hired._id.toString(),
      });

      expect(detail.application.status).toBe(APPLICATION_STATUS.HIRED);
      expect(detail.application.assignedRecruiter.fullName).toBe(
        "Supporting Recruiter",
      );
      expect(detail.application.assignedRecruiter.jobTitle).toBe(
        "Supporting Recruiter",
      );
    });

    it("reflects latest Replace snapshot, Withdraw, and Pipeline status", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s13.live.state",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.live.state.s13@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        submittedCvSnapshot: buildUploadedSnapshot({
          name: "Initial Snapshot",
        }),
      });

      await Application.updateOne(
        { _id: application._id },
        {
          $set: {
            submittedCvSnapshot: buildUploadedSnapshot({
              name: "Replaced Snapshot",
            }),
            version: 1,
          },
        },
      );

      const afterReplace = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      });
      expect(afterReplace.application.submittedCvSnapshot.name).toBe(
        "Replaced Snapshot",
      );

      const assigned = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 1,
      });

      const advanced = await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: assigned.application.version,
      });

      const afterPipeline = await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      });
      expect(afterPipeline.application.status).toBe(
        APPLICATION_STATUS.SCREENING,
      );
      expect(afterPipeline.application.version).toBe(
        advanced.application.version,
      );

      const withdrawCandidate = await createVerifiedUser({
        email: "cand.withdraw.live.s13@example.com",
      });
      const withdrawApp = await createDirectApplication({
        candidateUserId: withdrawCandidate.user._id,
        jobId: job._id,
        appliedAt: new Date(APPLIED_AT.getTime() + 5000),
      });
      await withdrawApplication({
        candidateUserId: withdrawCandidate.user._id,
        actorUser: withdrawCandidate.user,
        applicationId: withdrawApp._id.toString(),
        expectedVersion: 0,
        withdrawReason: "Changed mind",
      });

      const withdrawnView = await getCandidateMyApplication({
        candidateUserId: withdrawCandidate.user._id,
        actorUser: withdrawCandidate.user,
        applicationId: withdrawApp._id.toString(),
      });
      expect(withdrawnView.application.status).toBe(
        APPLICATION_STATUS.WITHDRAWN,
      );
      expect(withdrawnView.application.withdrawReason).toBe("Changed mind");
    });

    it("supports F08 status filter and Job/Company name search", async () => {
      const { primary, manager } = await setupCompany({
        emailPrefix: "v10.s13.filter",
      });
      const candidate = await createVerifiedUser({
        email: "cand.filter.s13@example.com",
      });
      const alphaJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        title: "Alpha Backend Engineer",
      });
      const betaJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        title: "Beta Frontend Engineer",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: alphaJob._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: betaJob._id,
        status: APPLICATION_STATUS.HIRED,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 2,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });

      const byStatus = await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        status: APPLICATION_STATUS.SCREENING,
      });
      expect(byStatus.applications).toHaveLength(1);
      expect(byStatus.applications[0].status).toBe(
        APPLICATION_STATUS.SCREENING,
      );

      const byJobName = await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        q: "frontend",
      });
      expect(byJobName.applications).toHaveLength(1);
      expect(byJobName.applications[0].job.title).toBe(
        "Beta Frontend Engineer",
      );

      const byCompany = await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        q: manager.company.name.slice(0, 6),
      });
      expect(byCompany.applications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("authorization and read-only semantics", () => {
    it("does not mutate Application on Candidate My Applications reads", async () => {
      const { primary } = await setupCompany({
        emailPrefix: "v10.s13.readonly",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
      });
      const candidate = await createVerifiedUser({
        email: "cand.readonly.s13@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 2,
      });

      const before = await Application.findById(application._id).lean();

      await listCandidateMyApplications({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
      });
      await getCandidateMyApplication({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id.toString(),
      });

      const after = await Application.findById(application._id).lean();
      expect(after.status).toBe(before.status);
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        String(before.assignedRecruiterCompanyMemberId),
      );
      expect(after.version).toBe(before.version);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });
  });

  describe("HTTP — GET /api/candidate/applications", () => {
    it("returns list and detail for authenticated Candidate", async () => {
      const agent = createTestAgent();
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s13.http",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "HTTP Candidate Job",
      });
      const candidate = await createVerifiedUser({
        email: "cand.http.s13@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: candidate.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get("/api/candidate/applications")
        .set("Authorization", `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.applications).toHaveLength(1);
      expect(listResponse.body.applications[0].job.title).toBe(
        "HTTP Candidate Job",
      );
      expect(listResponse.body.applications[0].assignedRecruiter).toEqual({
        fullName: "Supporting Recruiter",
        avatarUrl: null,
        jobTitle: "Supporting Recruiter",
      });

      const detailResponse = await agent
        .get(`/api/candidate/applications/${application._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.application.id).toBe(
        application._id.toString(),
      );
      expect(detailResponse.body.application.submittedCvSnapshot.name).toBe(
        "Submitted CV Snapshot",
      );
    });

    it("blocks Recruiter, Company Manager, and Platform Admin", async () => {
      const agent = createTestAgent();
      const { manager, primary } = await setupCompany({
        emailPrefix: "v10.s13.http.deny",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
      });
      const candidate = await createVerifiedUser({
        email: "cand.deny.s13@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });
      const platformAdmin = await User.create({
        fullName: "Platform Admin",
        email: "pa.v10.s13@example.com",
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        role: USER_ROLE.PLATFORM_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
      });

      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: primary.user.email,
        password: DEFAULT_PASSWORD,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: platformAdmin.email,
        password: DEFAULT_PASSWORD,
      });

      for (const token of [recruiterToken, managerToken, adminToken]) {
        const listResponse = await agent
          .get("/api/candidate/applications")
          .set("Authorization", `Bearer ${token}`);
        expect(listResponse.status).toBe(403);

        const detailResponse = await agent
          .get(`/api/candidate/applications/${application._id}`)
          .set("Authorization", `Bearer ${token}`);
        expect(detailResponse.status).toBe(403);
      }
    });
  });
});
