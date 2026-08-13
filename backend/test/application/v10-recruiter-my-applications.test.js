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
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import {
  firstAssignApplication,
  getRecruiterMyApplication,
  listRecruiterMyApplications,
  reassignApplication,
  updateApplicationRecruitmentPipelineStatus,
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

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s12.pdf",
    originalFileName: "v10-s12.pdf",
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
  title = "My Applications Job",
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

  await Application.updateOne(
    { _id: created._id },
    {
      $set,
    },
  );

  return Application.findById(created._id);
};

const setupCompany = async ({ emailPrefix = "v10.s12" } = {}) => {
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
  const peerPrimary = await createActiveRecruiterContext({
    email: `${emailPrefix}.peer@example.com`,
    fullName: "Peer Primary",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-PEER`,
    jobTitle: "Peer Recruiter",
  });

  return { manager, primary, supporting, peerPrimary };
};

const applicationIds = (result) =>
  result.applications.map((application) => application.id);

describe("V10 Slice 12 — Recruiter My Applications (F07 / F09 partial)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("service — current assignee projection", () => {
    it("lets Supporting see Applications assigned to self", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.supporting",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.supporting.s12@example.com",
        fullName: "Supporting Candidate",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const result = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });

      expect(applicationIds(result)).toEqual([application._id.toString()]);
      expect(result.applications[0].candidate.fullName).toBe(
        "Supporting Candidate",
      );
      expect(result.applications[0].job.id).toBe(job._id.toString());
      expect(result.applications[0].status).toBe(APPLICATION_STATUS.SCREENING);
      expect(result.applications[0].assignedRecruiterCompanyMemberId).toBe(
        supporting.membership._id.toString(),
      );
      expect(result.applications[0].isActiveWorkload).toBe(true);
      expect(result.currentWorkloadCount).toBe(1);
    });

    it("lets Primary see Applications only when Primary is the Assignee", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.primary.assignee",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const ownCandidate = await createVerifiedUser({
        email: "cand.primary.own.s12@example.com",
      });
      const supportingCandidate = await createVerifiedUser({
        email: "cand.primary.support.s12@example.com",
      });
      const ownApplication = await createDirectApplication({
        candidateUserId: ownCandidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: primary.membership._id,
        version: 1,
      });
      await createDirectApplication({
        candidateUserId: supportingCandidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });

      const result = await listRecruiterMyApplications({
        actorUser: primary.user,
      });

      expect(applicationIds(result)).toEqual([ownApplication._id.toString()]);
      expect(result.currentWorkloadCount).toBe(1);
    });

    it("does not put Supporting-assigned Applications into Primary My Applications", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.primary.not.support",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.primary.not.support.s12@example.com",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const primaryView = await listRecruiterMyApplications({
        actorUser: primary.user,
      });
      const supportingView = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });

      expect(primaryView.applications).toEqual([]);
      expect(primaryView.currentWorkloadCount).toBe(0);
      expect(supportingView.applications).toHaveLength(1);
    });

    it("reflects First Assign and Reassign into/out of the actor without history", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.assign.reassign",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.assign.reassign.s12@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
      });

      expect(
        (
          await listRecruiterMyApplications({
            actorUser: supporting.user,
          })
        ).applications,
      ).toEqual([]);

      const assigned = await firstAssignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: 0,
      });

      const afterAssign = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      expect(applicationIds(afterAssign)).toEqual([application._id.toString()]);
      expect(afterAssign.currentWorkloadCount).toBe(1);

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: assigned.application.version,
      });

      const afterReassignAway = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      const primaryAfterTakeover = await listRecruiterMyApplications({
        actorUser: primary.user,
      });

      expect(afterReassignAway.applications).toEqual([]);
      expect(afterReassignAway.currentWorkloadCount).toBe(0);
      expect(applicationIds(primaryAfterTakeover)).toEqual([
        application._id.toString(),
      ]);
      expect(primaryAfterTakeover.currentWorkloadCount).toBe(1);
    });

    it("includes non-terminal Applications on PUBLISHED, CLOSED, and EXPIRED Jobs", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.job.lifecycle",
      });
      const publishedJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        status: JOB_STATUS.PUBLISHED,
        title: "Published Job",
      });
      const closedJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        status: JOB_STATUS.CLOSED,
        title: "Closed Job",
      });
      const expiredJob = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        status: JOB_STATUS.EXPIRED,
        applicationDeadline: PAST_DEADLINE(),
        title: "Expired Job",
      });

      const publishedCandidate = await createVerifiedUser({
        email: "cand.published.s12@example.com",
      });
      const closedCandidate = await createVerifiedUser({
        email: "cand.closed.s12@example.com",
      });
      const expiredCandidate = await createVerifiedUser({
        email: "cand.expired.s12@example.com",
      });

      const publishedApp = await createDirectApplication({
        candidateUserId: publishedCandidate.user._id,
        jobId: publishedJob._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });
      const closedApp = await createDirectApplication({
        candidateUserId: closedCandidate.user._id,
        jobId: closedJob._id,
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });
      const expiredApp = await createDirectApplication({
        candidateUserId: expiredCandidate.user._id,
        jobId: expiredJob._id,
        status: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 2000),
      });

      const result = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });

      expect(applicationIds(result)).toEqual([
        publishedApp._id.toString(),
        closedApp._id.toString(),
        expiredApp._id.toString(),
      ]);
      expect(result.applications.map((row) => row.job.status)).toEqual([
        JOB_STATUS.PUBLISHED,
        JOB_STATUS.CLOSED,
        JOB_STATUS.EXPIRED,
      ]);
      expect(result.applications.every((row) => row.isActiveWorkload)).toBe(
        true,
      );
      expect(result.currentWorkloadCount).toBe(3);
    });

    it("keeps terminal HIRED/REJECTED/WITHDRAWN readable without active workload", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.terminal",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });

      const hiredCandidate = await createVerifiedUser({
        email: "cand.hired.s12@example.com",
      });
      const rejectedCandidate = await createVerifiedUser({
        email: "cand.rejected.s12@example.com",
      });
      const withdrawnCandidate = await createVerifiedUser({
        email: "cand.withdrawn.s12@example.com",
      });
      const activeCandidate = await createVerifiedUser({
        email: "cand.active.s12@example.com",
      });

      const hired = await createDirectApplication({
        candidateUserId: hiredCandidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.HIRED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 2,
      });
      const rejected = await createDirectApplication({
        candidateUserId: rejectedCandidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.REJECTED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 2,
        appliedAt: new Date(APPLIED_AT.getTime() + 1000),
      });
      const withdrawn = await createDirectApplication({
        candidateUserId: withdrawnCandidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.WITHDRAWN,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 2,
        appliedAt: new Date(APPLIED_AT.getTime() + 2000),
      });
      const active = await createDirectApplication({
        candidateUserId: activeCandidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        appliedAt: new Date(APPLIED_AT.getTime() + 3000),
      });

      const result = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });

      expect(applicationIds(result)).toEqual([
        hired._id.toString(),
        rejected._id.toString(),
        withdrawn._id.toString(),
        active._id.toString(),
      ]);
      expect(
        result.applications.filter((row) => !row.isActiveWorkload).map((row) => row.status),
      ).toEqual([
        APPLICATION_STATUS.HIRED,
        APPLICATION_STATUS.REJECTED,
        APPLICATION_STATUS.WITHDRAWN,
      ]);
      expect(result.currentWorkloadCount).toBe(1);

      const hiredDetail = await getRecruiterMyApplication({
        actorUser: supporting.user,
        applicationId: hired._id.toString(),
      });
      expect(hiredDetail.application.isActiveWorkload).toBe(false);
      expect(hiredDetail.application.status).toBe(APPLICATION_STATUS.HIRED);
    });

    it("exposes submittedCvSnapshot without CandidateCV library access (BR-31)", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.snapshot",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.snapshot.s12@example.com",
      });
      const category = await Category.create({
        name: "Software Engineering",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      });
      const liveCv = await CandidateCV.create({
        candidateUserId: candidate.user._id,
        name: "Private Live CV",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        categoryId: category._id,
        experienceLevelId: null,
        preferredLocations: [],
        skillTags: [],
        employmentTypes: [],
        workModes: [],
        isDefault: false,
        archivedAt: null,
        generatedContent: {
          personalInfo: {
            fullName: "Private Live CV",
            email: null,
            phone: null,
            displayLocation: null,
            links: [],
            avatarUrl: null,
          },
          professionalSummary: null,
          educations: [],
          skills: [],
          workExperiences: [],
          projects: [],
          certifications: [],
          languages: [],
          hiddenSections: [],
        },
      });
      const sourceCandidateCvId = new mongoose.Types.ObjectId();
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
        submittedCvSnapshot: buildUploadedSnapshot({
          sourceCandidateCvId,
          name: "Only Snapshot",
        }),
      });

      const list = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      const detail = await getRecruiterMyApplication({
        actorUser: supporting.user,
        applicationId: application._id.toString(),
      });

      expect(list.applications[0].submittedCvSnapshot.name).toBe("Only Snapshot");
      expect(
        String(list.applications[0].submittedCvSnapshot.sourceCandidateCvId),
      ).toBe(sourceCandidateCvId.toString());
      expect(detail.application.submittedCvSnapshot.name).toBe("Only Snapshot");
      expect(list.applications[0]).not.toHaveProperty("candidateCvs");
      expect(JSON.stringify(list)).not.toContain(liveCv._id.toString());
      expect(JSON.stringify(detail)).not.toContain("Private Live CV");
    });

    it("reflects current Reassign and Pipeline state without persisted counters", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.live.state",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.live.state.s12@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.APPLIED,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const before = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      expect(before.applications[0].status).toBe(APPLICATION_STATUS.APPLIED);

      const advanced = await updateApplicationRecruitmentPipelineStatus({
        actorUser: supporting.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        targetStatus: APPLICATION_STATUS.SCREENING,
        expectedStatus: APPLICATION_STATUS.APPLIED,
        expectedVersion: 1,
      });

      const afterPipeline = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      expect(afterPipeline.applications[0].status).toBe(
        APPLICATION_STATUS.SCREENING,
      );
      expect(afterPipeline.applications[0].version).toBe(
        advanced.application.version,
      );

      await reassignApplication({
        actorUser: primary.user,
        jobId: job._id.toString(),
        applicationId: application._id.toString(),
        assigneeCompanyMemberId: primary.membership._id.toString(),
        expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
        expectedVersion: advanced.application.version,
      });

      const afterReassign = await listRecruiterMyApplications({
        actorUser: supporting.user,
      });
      const primaryView = await listRecruiterMyApplications({
        actorUser: primary.user,
      });

      expect(afterReassign.applications).toEqual([]);
      expect(primaryView.applications[0].status).toBe(
        APPLICATION_STATUS.SCREENING,
      );
      expect(primaryView.currentWorkloadCount).toBe(1);
    });
  });

  describe("authorization and read-only semantics", () => {
    it("denies detail for peer Recruiter and cross-tenant actors", async () => {
      const local = await setupCompany({ emailPrefix: "v10.s12.auth.a" });
      const foreign = await setupCompany({ emailPrefix: "v10.s12.auth.b" });
      const job = await createJob({
        companyId: local.primary.membership.companyId,
        primaryMemberId: local.primary.membership._id,
        supportingMemberIds: [local.supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.auth.detail.s12@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: local.supporting.membership._id,
        version: 1,
      });

      await expect(
        getRecruiterMyApplication({
          actorUser: local.primary.user,
          applicationId: application._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        getRecruiterMyApplication({
          actorUser: local.peerPrimary.user,
          applicationId: application._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      await expect(
        getRecruiterMyApplication({
          actorUser: foreign.supporting.user,
          applicationId: application._id.toString(),
        }),
      ).rejects.toMatchObject({ statusCode: 403 });

      const foreignList = await listRecruiterMyApplications({
        actorUser: foreign.supporting.user,
      });
      expect(foreignList.applications).toEqual([]);
    });

    it("does not mutate Application on My Applications reads", async () => {
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.readonly",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.readonly.s12@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 2,
      });

      const before = await Application.findById(application._id).lean();

      await listRecruiterMyApplications({ actorUser: supporting.user });
      await getRecruiterMyApplication({
        actorUser: supporting.user,
        applicationId: application._id.toString(),
      });

      const after = await Application.findById(application._id).lean();

      expect(after.status).toBe(before.status);
      expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
        String(before.assignedRecruiterCompanyMemberId),
      );
      expect(after.version).toBe(before.version);
      expect(after.submittedCvSnapshot).toEqual(before.submittedCvSnapshot);
      expect(String(after.candidateUserId)).toBe(String(before.candidateUserId));
      expect(String(after.jobId)).toBe(String(before.jobId));
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });
  });

  describe("HTTP — GET /api/jobs/my-applications", () => {
    it("returns My Applications list and detail for authenticated Assignees", async () => {
      const agent = createTestAgent();
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.http",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
        title: "HTTP My Applications",
      });
      const candidate = await createVerifiedUser({
        email: "cand.http.s12@example.com",
        fullName: "HTTP Candidate",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listResponse = await agent
        .get("/api/jobs/my-applications")
        .set("Authorization", `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.applications).toHaveLength(1);
      expect(listResponse.body.applications[0].candidate.fullName).toBe(
        "HTTP Candidate",
      );
      expect(listResponse.body.applications[0].job.title).toBe(
        "HTTP My Applications",
      );
      expect(listResponse.body.currentWorkloadCount).toBe(1);

      const detailResponse = await agent
        .get(`/api/jobs/my-applications/${application._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.application.id).toBe(application._id.toString());
      expect(detailResponse.body.application.submittedCvSnapshot.name).toBe(
        "Submitted CV Snapshot",
      );
    });

    it("blocks Company Manager, Platform Admin, and Candidate on My Applications", async () => {
      const agent = createTestAgent();
      const { manager, primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.http.deny",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.deny.s12@example.com",
      });
      const application = await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });
      const platformAdmin = await User.create({
        fullName: "Platform Admin",
        email: "pa.v10.s12@example.com",
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        role: USER_ROLE.PLATFORM_ADMIN,
        status: USER_STATUS.ACTIVE,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
      });

      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: DEFAULT_PASSWORD,
      });
      const candidateToken = await loginAndGetAccessToken(agent, {
        email: candidate.user.email,
        password: DEFAULT_PASSWORD,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: platformAdmin.email,
        password: DEFAULT_PASSWORD,
      });

      for (const token of [managerToken, candidateToken, adminToken]) {
        const listResponse = await agent
          .get("/api/jobs/my-applications")
          .set("Authorization", `Bearer ${token}`);
        expect(listResponse.status).toBe(403);

        const detailResponse = await agent
          .get(`/api/jobs/my-applications/${application._id}`)
          .set("Authorization", `Bearer ${token}`);
        expect(detailResponse.status).toBe(403);
      }
    });

    it("does not open Candidate My CVs to Assignees via My Applications (BR-31)", async () => {
      const agent = createTestAgent();
      const { primary, supporting } = await setupCompany({
        emailPrefix: "v10.s12.http.cvs",
      });
      const job = await createJob({
        companyId: primary.membership.companyId,
        primaryMemberId: primary.membership._id,
        supportingMemberIds: [supporting.membership._id],
      });
      const candidate = await createVerifiedUser({
        email: "cand.http.cvs.s12@example.com",
      });
      await createDirectApplication({
        candidateUserId: candidate.user._id,
        jobId: job._id,
        status: APPLICATION_STATUS.SCREENING,
        assignedRecruiterCompanyMemberId: supporting.membership._id,
        version: 1,
      });

      const token = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });

      const libraryRes = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${token}`);
      expect(libraryRes.status).toBe(403);
    });
  });
});
