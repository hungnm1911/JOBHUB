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
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import * as applicationService from "../../src/services/application.service.js";
import { forceReassignApplication } from "../../src/services/application.service.js";
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
const APPLIED_AT = new Date("2026-08-13T08:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-13T08:00:00.000Z");

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v10-s07.pdf",
    originalFileName: "v10-s07.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Backend Engineer",
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

const createAssignedApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
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
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version: 1,
      },
    },
  );

  return Application.findById(created._id);
};

describe("V10 Slice 10 — stale trusted A→B handoff cleanup", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("does not export the removed trusted pre-lifecycle A→B helper", () => {
    expect(
      applicationService.executeTrustedPreLifecycleApplicationHandoff,
    ).toBeUndefined();
    expect(
      applicationService.executeAdministrativeApplicationHandoff,
    ).toBeUndefined();
  });

  it("keeps CM force-reassign as the canonical public A→B compatibility surface", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "v10.s10.cleanup.manager@example.com",
      businessRegistrationNumber: "BRN-V10-S10-CLEANUP",
    });
    const primary = await createActiveRecruiterContext({
      email: "v10.s10.cleanup.primary@example.com",
      fullName: "Primary Recruiter",
      company: manager.company,
      employeeCode: "NV-V10-S10-CLEANUP-P",
      jobTitle: "Lead Recruiter",
    });
    const supporting = await createActiveRecruiterContext({
      email: "v10.s10.cleanup.supporting@example.com",
      fullName: "Supporting Recruiter",
      company: manager.company,
      employeeCode: "NV-V10-S10-CLEANUP-S",
      jobTitle: "Supporting Recruiter",
    });
    const supportingB = await createActiveRecruiterContext({
      email: "v10.s10.cleanup.supporting.b@example.com",
      fullName: "Supporting Recruiter B",
      company: manager.company,
      employeeCode: "NV-V10-S10-CLEANUP-SB",
      jobTitle: "Supporting Recruiter B",
    });
    const job = await createPublishedJob({
      companyId: manager.company._id,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [
        supporting.membership._id,
        supportingB.membership._id,
      ],
    });
    const candidate = await createVerifiedUser({
      email: "v10.s10.cleanup.candidate@example.com",
    });
    const application = await createAssignedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: supporting.membership._id,
    });

    const result = await forceReassignApplication({
      actorUser: manager.user,
      jobId: job._id.toString(),
      applicationId: application._id.toString(),
      assigneeCompanyMemberId: supportingB.membership._id.toString(),
      expectedAssigneeCompanyMemberId: supporting.membership._id.toString(),
      expectedVersion: 1,
    });

    expect(result.application.assignedRecruiterCompanyMemberId).toBe(
      supportingB.membership._id.toString(),
    );
    expect(result.application.status).toBe(APPLICATION_STATUS.APPLIED);
    expect(result.application.version).toBe(2);
  });
});
