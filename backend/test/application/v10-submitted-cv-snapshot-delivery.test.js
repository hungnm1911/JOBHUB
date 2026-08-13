import { PDFDocument } from "pdf-lib";
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
import APPLICATION_SUBMITTED_CV_STORAGE from "../../src/constants/application-submitted-cv-storage.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../../src/constants/candidate-cv-uploaded-storage.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import * as fileService from "../../src/services/file.service.js";
import {
  getCandidateMyApplication,
  listPrimaryJobApplications,
} from "../../src/services/application.service.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-13T07:00:00.000Z");
const CAPTURED_AT = new Date("2026-08-13T06:59:00.000Z");
const SNAPSHOT_STORAGE_KEY =
  "jobhub/applications/submitted-cv-snapshots/h1-snapshot.pdf";
const LIVE_CV_STORAGE_KEY =
  "jobhub/candidate-cvs/uploaded/h1-live-current.pdf";

const buildPdfBuffer = async (pageCount = 1, marker = "snapshot") => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([400, 600]);
    page.drawText(`${marker}-${index + 1}`, {
      x: 40,
      y: 500,
      size: 12,
    });
  }

  return Buffer.from(await document.save());
};

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: SNAPSHOT_STORAGE_KEY,
    originalFileName: "h1-snapshot.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 1,
  },
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const createJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
  title = "H1 Snapshot Delivery Job",
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
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
  submittedCvSnapshot = buildUploadedSnapshot(),
  version = 0,
}) => {
  const created = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot,
    appliedAt: APPLIED_AT,
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

  await Application.updateOne(
    { _id: created._id },
    {
      $set: {
        status,
        assignedRecruiterCompanyMemberId,
        version,
      },
    },
  );

  return Application.findById(created._id);
};

const setupTenant = async (emailPrefix) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix}-P`,
    fullName: "Primary Recruiter",
  });
  const supporting = await createActiveRecruiterContext({
    email: `${emailPrefix}.supporting@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix}-S`,
    fullName: "Supporting Recruiter",
  });
  const outsider = await createActiveRecruiterContext({
    email: `${emailPrefix}.outsider@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix}-O`,
    fullName: "Outsider Recruiter",
  });

  return { manager, primary, supporting, outsider };
};

const parseBinaryResponse = (res, callback) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

const assertPdfResponse = (response, { dispositionPrefix, fileName }) => {
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toMatch(/application\/pdf/);
  expect(response.headers["content-disposition"]).toContain(dispositionPrefix);
  expect(response.headers["content-disposition"]).toContain(fileName);
  expect(response.headers["cache-control"]).toBe("private, no-store");
  expect(Buffer.isBuffer(response.body)).toBe(true);
  expect(response.body.length).toBeGreaterThan(0);
};

const mockSnapshotDownload = (pdfBuffer) => {
  return vi.spyOn(fileService, "downloadFileBuffer").mockImplementation(
    async ({ publicId, resourceType, deliveryType }) => {
      if (publicId === SNAPSHOT_STORAGE_KEY) {
        expect(resourceType).toBe(APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE);
        expect(deliveryType).toBe(APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE);
        return pdfBuffer;
      }

      if (publicId === LIVE_CV_STORAGE_KEY) {
        expect(resourceType).toBe(CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE);
        expect(deliveryType).toBe(CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE);
        return buildPdfBuffer(1, "live-cv");
      }

      throw new Error(`Unexpected download publicId: ${publicId}`);
    },
  );
};

describe("V10 acceptance H1 — Application submittedCvSnapshot read/download", () => {
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

  it("lets Candidate owner preview and download their Application snapshot (1)", async () => {
    const snapshotPdf = await buildPdfBuffer(1, "owner-snapshot");
    const downloadSpy = mockSnapshotDownload(snapshotPdf);
    const { primary } = await setupTenant("h1.owner");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
    });
    const owner = await createVerifiedUser({
      email: "h1.owner.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: owner.user._id,
      jobId: job._id,
    });

    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: owner.user.email,
    });

    const preview = await agent
      .get(
        `/api/candidate/applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    const download = await agent
      .get(
        `/api/candidate/applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assertPdfResponse(preview, {
      dispositionPrefix: "inline",
      fileName: "h1-snapshot.pdf",
    });
    assertPdfResponse(download, {
      dispositionPrefix: "attachment",
      fileName: "h1-snapshot.pdf",
    });
    expect(Buffer.compare(preview.body, snapshotPdf)).toBe(0);
    expect(Buffer.compare(download.body, snapshotPdf)).toBe(0);
    expect(downloadSpy).toHaveBeenCalledWith({
      publicId: SNAPSHOT_STORAGE_KEY,
      resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
      deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
    });
  });

  it("rejects another Candidate from reading the snapshot (2)", async () => {
    mockSnapshotDownload(await buildPdfBuffer(1, "peer-denied"));
    const { primary } = await setupTenant("h1.peer");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
    });
    const owner = await createVerifiedUser({
      email: "h1.peer.owner@example.com",
    });
    const peer = await createVerifiedUser({
      email: "h1.peer.other@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: owner.user._id,
      jobId: job._id,
    });

    const agent = createTestAgent();
    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.user.email,
    });

    const preview = await agent
      .get(
        `/api/candidate/applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${peerToken}`);
    const download = await agent
      .get(
        `/api/candidate/applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${peerToken}`);

    expect(preview.status).toBe(404);
    expect(download.status).toBe(404);
    expect(fileService.downloadFileBuffer).not.toHaveBeenCalled();
  });

  it("lets current Primary of the Job preview and download the snapshot (3)", async () => {
    const snapshotPdf = await buildPdfBuffer(1, "primary-snapshot");
    mockSnapshotDownload(snapshotPdf);
    const { primary, supporting } = await setupTenant("h1.primary");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "h1.primary.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
    });

    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: primary.user.email,
    });

    const preview = await agent
      .get(
        `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    const download = await agent
      .get(
        `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assertPdfResponse(preview, {
      dispositionPrefix: "inline",
      fileName: "h1-snapshot.pdf",
    });
    assertPdfResponse(download, {
      dispositionPrefix: "attachment",
      fileName: "h1-snapshot.pdf",
    });
    expect(Buffer.compare(preview.body, snapshotPdf)).toBe(0);
  });

  it("lets current Assignee preview and download via My Applications (4)", async () => {
    const snapshotPdf = await buildPdfBuffer(1, "assignee-snapshot");
    mockSnapshotDownload(snapshotPdf);
    const { primary, supporting } = await setupTenant("h1.assignee");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "h1.assignee.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: supporting.user.email,
    });

    const preview = await agent
      .get(
        `/api/jobs/my-applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    const download = await agent
      .get(
        `/api/jobs/my-applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assertPdfResponse(preview, {
      dispositionPrefix: "inline",
      fileName: "h1-snapshot.pdf",
    });
    assertPdfResponse(download, {
      dispositionPrefix: "attachment",
      fileName: "h1-snapshot.pdf",
    });
    expect(Buffer.compare(download.body, snapshotPdf)).toBe(0);
  });

  it("rejects Recruiters outside current Primary / current Assignee scope (5)", async () => {
    mockSnapshotDownload(await buildPdfBuffer(1, "outsider"));
    const { primary, supporting, outsider } = await setupTenant("h1.scope");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "h1.scope.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    const agent = createTestAgent();
    const outsiderToken = await loginAndGetAccessToken(agent, {
      email: outsider.user.email,
    });
    const supportingToken = await loginAndGetAccessToken(agent, {
      email: supporting.user.email,
    });

    const primaryDeniedForSupporting = await agent
      .get(
        `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${supportingToken}`);
    const outsiderPrimaryPath = await agent
      .get(
        `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${outsiderToken}`);
    const outsiderMyApps = await agent
      .get(
        `/api/jobs/my-applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(primaryDeniedForSupporting.status).toBe(403);
    expect(outsiderPrimaryPath.status).toBe(403);
    expect(outsiderMyApps.status).toBe(403);
    expect(fileService.downloadFileBuffer).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant Recruiter snapshot access (6)", async () => {
    mockSnapshotDownload(await buildPdfBuffer(1, "cross-tenant"));
    const tenantA = await setupTenant("h1.tenant.a");
    const tenantB = await setupTenant("h1.tenant.b");
    const job = await createJob({
      companyId: tenantA.primary.membership.companyId,
      primaryMemberId: tenantA.primary.membership._id,
      supportingMemberIds: [tenantA.supporting.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "h1.cross.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: tenantA.supporting.membership._id,
      version: 1,
    });

    const agent = createTestAgent();
    const foreignPrimaryToken = await loginAndGetAccessToken(agent, {
      email: tenantB.primary.user.email,
    });
    const foreignAssigneeToken = await loginAndGetAccessToken(agent, {
      email: tenantB.supporting.user.email,
    });

    const foreignPrimary = await agent
      .get(
        `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${foreignPrimaryToken}`);
    const foreignMyApps = await agent
      .get(
        `/api/jobs/my-applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${foreignAssigneeToken}`);

    expect(foreignPrimary.status).toBe(403);
    expect(foreignMyApps.status).toBe(403);
    expect(fileService.downloadFileBuffer).not.toHaveBeenCalled();
  });

  it("does not grant snapshot access to Company Manager or Platform Admin (7)", async () => {
    mockSnapshotDownload(await buildPdfBuffer(1, "admin-denied"));
    const { manager, primary, supporting } = await setupTenant("h1.admin");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const candidate = await createVerifiedUser({
      email: "h1.admin.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });
    await createVerifiedUser({
      email: "h1.admin.platform@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
      fullName: "Platform Admin",
    });

    const agent = createTestAgent();
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "h1.admin.platform@example.com",
    });

    for (const token of [managerToken, adminToken]) {
      const candidatePath = await agent
        .get(
          `/api/candidate/applications/${application._id}/submitted-cv/preview`,
        )
        .set("Authorization", `Bearer ${token}`);
      const primaryPath = await agent
        .get(
          `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/preview`,
        )
        .set("Authorization", `Bearer ${token}`);
      const myAppsPath = await agent
        .get(
          `/api/jobs/my-applications/${application._id}/submitted-cv/download`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(candidatePath.status).toBe(403);
      expect(primaryPath.status).toBe(403);
      expect(myAppsPath.status).toBe(403);
    }

    expect(fileService.downloadFileBuffer).not.toHaveBeenCalled();
  });

  it("delivers submittedCvSnapshot bytes, not live CandidateCV content (8, 9)", async () => {
    const snapshotPdf = await buildPdfBuffer(1, "independent-snapshot");
    const downloadSpy = mockSnapshotDownload(snapshotPdf);
    const { primary } = await setupTenant("h1.independent");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
    });
    const owner = await createVerifiedUser({
      email: "h1.independent.candidate@example.com",
    });
    const category = await Category.create({
      name: "Software Engineering",
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });
    const sourceCv = await CandidateCV.create({
      candidateUserId: owner.user._id,
      name: "Live Source CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
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
      uploadedFile: {
        storageKey: LIVE_CV_STORAGE_KEY,
        originalFileName: "live-current.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 1024,
        pageCount: 1,
        uploadedAt: new Date("2026-01-10T00:00:00.000Z"),
      },
    });
    const application = await createDirectApplication({
      candidateUserId: owner.user._id,
      jobId: job._id,
      submittedCvSnapshot: buildUploadedSnapshot({
        sourceCandidateCvId: sourceCv._id,
        name: "Frozen Snapshot",
        pdfFile: {
          storageKey: SNAPSHOT_STORAGE_KEY,
          originalFileName: "h1-snapshot.pdf",
          mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
          sizeBytes: 2048,
          pageCount: 1,
        },
      }),
    });

    await CandidateCV.updateOne(
      { _id: sourceCv._id },
      {
        $set: {
          name: "Replaced Live CV",
          archivedAt: new Date("2026-08-13T12:00:00.000Z"),
          isDefault: false,
          "uploadedFile.storageKey":
            "jobhub/candidate-cvs/uploaded/h1-live-replaced.pdf",
          "uploadedFile.originalFileName": "live-replaced.pdf",
        },
      },
    );

    const agent = createTestAgent();
    const token = await loginAndGetAccessToken(agent, {
      email: owner.user.email,
    });

    const download = await agent
      .get(
        `/api/candidate/applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assertPdfResponse(download, {
      dispositionPrefix: "attachment",
      fileName: "h1-snapshot.pdf",
    });
    expect(Buffer.compare(download.body, snapshotPdf)).toBe(0);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith({
      publicId: SNAPSHOT_STORAGE_KEY,
      resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
      deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
    });
    expect(downloadSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: LIVE_CV_STORAGE_KEY,
      }),
    );
    expect(downloadSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: "jobhub/candidate-cvs/uploaded/h1-live-replaced.pdf",
      }),
    );
  });

  it("keeps storageKey private on Application projections and does not mutate on read (10, 11)", async () => {
    const snapshotPdf = await buildPdfBuffer(1, "readonly");
    mockSnapshotDownload(snapshotPdf);
    const { primary, supporting } = await setupTenant("h1.readonly");
    const job = await createJob({
      companyId: primary.membership.companyId,
      primaryMemberId: primary.membership._id,
      supportingMemberIds: [supporting.membership._id],
    });
    const owner = await createVerifiedUser({
      email: "h1.readonly.candidate@example.com",
    });
    const application = await createDirectApplication({
      candidateUserId: owner.user._id,
      jobId: job._id,
      status: APPLICATION_STATUS.SCREENING,
      assignedRecruiterCompanyMemberId: supporting.membership._id,
      version: 1,
    });

    const before = await Application.findById(application._id).lean();
    const candidateDetail = await getCandidateMyApplication({
      candidateUserId: owner.user._id,
      actorUser: owner.user,
      applicationId: application._id.toString(),
    });
    const primaryList = await listPrimaryJobApplications({
      actorUser: primary.user,
      jobId: job._id.toString(),
    });

    expect(candidateDetail.application.submittedCvSnapshot.pdfFile).toEqual({
      originalFileName: "h1-snapshot.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 2048,
      pageCount: 1,
    });
    expect(candidateDetail.application.submittedCvSnapshot.pdfFile).not.toHaveProperty(
      "storageKey",
    );
    expect(
      primaryList.applications[0].submittedCvSnapshot.pdfFile,
    ).not.toHaveProperty("storageKey");
    expect(JSON.stringify(candidateDetail)).not.toContain(SNAPSHOT_STORAGE_KEY);
    expect(JSON.stringify(primaryList)).not.toContain(SNAPSHOT_STORAGE_KEY);

    const agent = createTestAgent();
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: owner.user.email,
    });
    const primaryToken = await loginAndGetAccessToken(agent, {
      email: primary.user.email,
    });
    const assigneeToken = await loginAndGetAccessToken(agent, {
      email: supporting.user.email,
    });

    await agent
      .get(
        `/api/candidate/applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    await agent
      .get(
        `/api/jobs/${job._id}/applications/${application._id}/submitted-cv/download`,
      )
      .set("Authorization", `Bearer ${primaryToken}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    await agent
      .get(
        `/api/jobs/my-applications/${application._id}/submitted-cv/preview`,
      )
      .set("Authorization", `Bearer ${assigneeToken}`)
      .buffer(true)
      .parse(parseBinaryResponse);

    const after = await Application.findById(application._id).lean();
    expect(after.version).toBe(before.version);
    expect(after.status).toBe(before.status);
    expect(String(after.assignedRecruiterCompanyMemberId)).toBe(
      String(before.assignedRecruiterCompanyMemberId),
    );
    expect(JSON.parse(JSON.stringify(after.submittedCvSnapshot))).toEqual(
      JSON.parse(JSON.stringify(before.submittedCvSnapshot)),
    );
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
  });
});
