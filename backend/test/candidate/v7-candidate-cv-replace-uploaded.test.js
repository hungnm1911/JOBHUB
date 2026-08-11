import { PDFDocument } from "pdf-lib";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import LOCATION from "../../src/constants/location.js";
import USER_ROLE from "../../src/constants/user-role.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import * as fileService from "../../src/services/file.service.js";
import {
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const createExperienceLevel = async (
  code = EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
) => {
  return ExperienceLevel.create({
    code,
  });
};

const buildPdfBuffer = async (pageCount = 1) => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }

  return Buffer.from(await document.save());
};

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
  0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
  0x00, 0x05, 0xfe, 0x02, 0xfe, 0xa7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  experienceLevelId = null,
  name = "Current Uploaded CV",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  isDefault = false,
  archivedAt = null,
  uploadedFile = {
    storageKey: "jobhub/candidate-cvs/uploaded/old-file",
    originalFileName: "old-resume.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 1,
    uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility,
    categoryId,
    experienceLevelId,
    preferredLocations: [LOCATION.HA_NOI],
    skillTags: ["Node.js"],
    employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
    workModes: [WORK_MODE.HYBRID],
    isDefault,
    archivedAt,
    uploadedFile,
  });
};

describe("V7 Slice 07 — Replace Uploaded PDF (F06)", () => {
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

  it("replaces uploadedFile atomically and preserves common metadata/lifecycle", async () => {
    const uploadSpy = vi
      .spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/new-file",
        resourceType: "raw",
      });
    const deleteSpy = vi.spyOn(fileService, "deleteFile").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/old-file",
      result: "ok",
    });

    const { user } = await createVerifiedUser({
      email: "cv.replace.success@example.com",
    });
    const category = await createFieldCategory();
    const experienceLevel = await createExperienceLevel();
    const existing = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      experienceLevelId: experienceLevel._id,
      name: "Keep My Name",
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      isDefault: true,
    });
    const pdfBuffer = await buildPdfBuffer(3);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .put(`/api/candidate/cvs/${existing._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pdfBuffer, {
        filename: "new-resume.pdf",
        contentType: "application/octet-stream",
      });

    expect(response.status).toBe(200);
    expect(response.body.cv).toMatchObject({
      id: existing._id.toString(),
      candidateUserId: user._id.toString(),
      name: "Keep My Name",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      categoryId: category._id.toString(),
      experienceLevelId: experienceLevel._id.toString(),
      preferredLocations: [LOCATION.HA_NOI],
      skillTags: ["Node.js"],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [WORK_MODE.HYBRID],
      isDefault: true,
      archivedAt: null,
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/new-file",
        originalFileName: "new-resume.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: pdfBuffer.length,
        pageCount: 3,
      },
    });
    expect(response.body.cv.uploadedFile.uploadedAt).toBeTruthy();
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/old-file",
      resourceType: "raw",
    });

    const persisted = await CandidateCV.findById(existing._id);
    expect(persisted.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/new-file",
    );
    expect(persisted.uploadedFile.pageCount).toBe(3);
    expect(persisted.uploadedFile.sizeBytes).toBe(pdfBuffer.length);
    expect(persisted.uploadedFile.originalFileName).toBe("new-resume.pdf");
    expect(persisted.name).toBe("Keep My Name");
    expect(persisted.isDefault).toBe(true);
    expect(persisted.toObject()).not.toHaveProperty("previousFiles");
    expect(persisted.toObject()).not.toHaveProperty("fileHistory");
  });

  it("does not mutate uploadedFile or upload storage when the new PDF is invalid", async () => {
    const uploadSpy = vi.spyOn(fileService, "uploadFileBuffer");
    const deleteSpy = vi.spyOn(fileService, "deleteFile");

    const { user } = await createVerifiedUser({
      email: "cv.replace.invalid@example.com",
    });
    const category = await createFieldCategory("Invalid Replace");
    const existing = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
    });
    const before = existing.toObject();
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .put(`/api/candidate/cvs/${existing._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pngBuffer, {
        filename: "fake.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(415);
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();

    const persisted = await CandidateCV.findById(existing._id).lean();
    expect(persisted.uploadedFile).toMatchObject({
      storageKey: before.uploadedFile.storageKey,
      originalFileName: before.uploadedFile.originalFileName,
      mimeType: before.uploadedFile.mimeType,
      sizeBytes: before.uploadedFile.sizeBytes,
      pageCount: before.uploadedFile.pageCount,
    });
    expect(persisted.name).toBe(before.name);
    expect(persisted.visibility).toBe(before.visibility);
    expect(persisted.isDefault).toBe(before.isDefault);
    expect(persisted.status).toBe(before.status);
  });

  it("keeps the old current file when persistence fails after the new upload", async () => {
    const uploadSpy = vi
      .spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/orphan-new",
        resourceType: "raw",
      });
    const deleteSpy = vi.spyOn(fileService, "deleteFile").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/orphan-new",
      result: "ok",
    });
    vi.spyOn(CandidateCV, "findOneAndUpdate").mockResolvedValue(null);

    const { user } = await createVerifiedUser({
      email: "cv.replace.persist-fail@example.com",
    });
    const category = await createFieldCategory("Persist Fail");
    const existing = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
    });
    const pdfBuffer = await buildPdfBuffer(1);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .put(`/api/candidate/cvs/${existing._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pdfBuffer, "replacement.pdf");

    expect(response.status).toBe(409);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/orphan-new",
      resourceType: "raw",
    });
    expect(deleteSpy).not.toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/old-file",
      resourceType: "raw",
    });

    const persisted = await CandidateCV.findById(existing._id);
    expect(persisted.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/old-file",
    );
  });

  it("does not roll back the committed replacement when old-file cleanup fails", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/committed-new",
      resourceType: "raw",
    });
    const deleteSpy = vi
      .spyOn(fileService, "deleteFile")
      .mockRejectedValue(new Error("simulated cleanup failure"));

    const { user } = await createVerifiedUser({
      email: "cv.replace.cleanup-fail@example.com",
    });
    const category = await createFieldCategory("Cleanup Fail");
    const existing = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
    });
    const pdfBuffer = await buildPdfBuffer(2);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .put(`/api/candidate/cvs/${existing._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pdfBuffer, "kept-new.pdf");

    expect(response.status).toBe(200);
    expect(response.body.cv.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/committed-new",
    );
    expect(deleteSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/old-file",
      resourceType: "raw",
    });

    const persisted = await CandidateCV.findById(existing._id);
    expect(persisted.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/committed-new",
    );
    expect(persisted.uploadedFile.pageCount).toBe(2);
  });

  it("rejects stale concurrent replace so cleanup cannot delete the newer current file", async () => {
    const uploadSpy = vi
      .spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/stale-attempt",
        resourceType: "raw",
      });
    const deleteSpy = vi.spyOn(fileService, "deleteFile").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/stale-attempt",
      result: "ok",
    });

    const { user } = await createVerifiedUser({
      email: "cv.replace.stale@example.com",
    });
    const category = await createFieldCategory("Stale");
    const existing = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/baseline",
        originalFileName: "baseline.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 1000,
        pageCount: 1,
        uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    // Concurrent winner already moved current file away from the stale baseline.
    await CandidateCV.updateOne(
      { _id: existing._id },
      {
        $set: {
          uploadedFile: {
            storageKey: "jobhub/candidate-cvs/uploaded/concurrent-winner",
            originalFileName: "winner.pdf",
            mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
            sizeBytes: 1500,
            pageCount: 2,
            uploadedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        },
      },
    );

    // Force the stale request to still believe baseline is current.
    const originalFindOne = CandidateCV.findOne.bind(CandidateCV);
    let stalePreReadDone = false;
    const findOneSpy = vi
      .spyOn(CandidateCV, "findOne")
      .mockImplementation(async (filter) => {
        const document = await originalFindOne(filter);

        if (
          !stalePreReadDone &&
          document &&
          filter?._id?.toString?.() === existing._id.toString() &&
          document.uploadedFile?.storageKey ===
            "jobhub/candidate-cvs/uploaded/concurrent-winner"
        ) {
          stalePreReadDone = true;
          document.uploadedFile.storageKey =
            "jobhub/candidate-cvs/uploaded/baseline";
        }

        return document;
      });

    const pdfBuffer = await buildPdfBuffer(1);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .put(`/api/candidate/cvs/${existing._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pdfBuffer, "stale.pdf");

    expect(response.status).toBe(409);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/stale-attempt",
      resourceType: "raw",
    });
    expect(deleteSpy).not.toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/concurrent-winner",
      resourceType: "raw",
    });
    expect(deleteSpy).not.toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/baseline",
      resourceType: "raw",
    });

    findOneSpy.mockRestore();

    const persisted = await CandidateCV.findById(existing._id);
    expect(persisted.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/concurrent-winner",
    );
  });

  it("rejects ownership, Generated source, and archived Uploaded CV replacements", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/unused",
    });

    const { user: owner } = await createVerifiedUser({
      email: "cv.replace.owner@example.com",
    });
    const { user: peer } = await createVerifiedUser({
      email: "cv.replace.peer@example.com",
    });
    await createVerifiedUser({
      email: "cv.replace.admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
      fullName: "Admin",
    });
    const category = await createFieldCategory("Guards");
    const ownUploaded = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Own Uploaded",
    });
    const archivedUploaded = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Archived Uploaded",
      archivedAt: new Date("2026-03-01T00:00:00.000Z"),
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/archived",
        originalFileName: "archived.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 900,
        pageCount: 1,
        uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const generated = await CandidateCV.create({
      candidateUserId: owner._id,
      name: "Generated Draft",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId: category._id,
      preferredLocations: [],
      skillTags: [],
      employmentTypes: [],
      workModes: [],
      isDefault: false,
      archivedAt: null,
      generatedContent: {},
    });
    const pdfBuffer = await buildPdfBuffer(1);
    const agent = createTestAgent();
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });
    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.email,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "cv.replace.admin@example.com",
    });

    const peerAttempt = await agent
      .put(`/api/candidate/cvs/${ownUploaded._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${peerToken}`)
      .attach("file", pdfBuffer, "peer.pdf");
    const generatedAttempt = await agent
      .put(`/api/candidate/cvs/${generated._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("file", pdfBuffer, "generated.pdf");
    const archivedAttempt = await agent
      .put(
        `/api/candidate/cvs/${archivedUploaded._id.toString()}/uploaded-file`,
      )
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("file", pdfBuffer, "archived.pdf");
    const adminAttempt = await agent
      .put(`/api/candidate/cvs/${ownUploaded._id.toString()}/uploaded-file`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", pdfBuffer, "admin.pdf");
    const anonymousAttempt = await agent
      .put(`/api/candidate/cvs/${ownUploaded._id.toString()}/uploaded-file`)
      .attach("file", pdfBuffer, "anon.pdf");

    expect(peerAttempt.status).toBe(404);
    expect(generatedAttempt.status).toBe(409);
    expect(archivedAttempt.status).toBe(409);
    expect(adminAttempt.status).toBe(403);
    expect(anonymousAttempt.status).toBe(401);

    const unchanged = await CandidateCV.findById(ownUploaded._id);
    expect(unchanged.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/old-file",
    );
  });
});
