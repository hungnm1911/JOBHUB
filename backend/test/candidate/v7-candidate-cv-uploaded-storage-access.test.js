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
import CANDIDATE_CV_UPLOADED_STORAGE from "../../src/constants/candidate-cv-uploaded-storage.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CLOUDINARY_FOLDER from "../../src/constants/cloudinary-folder.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
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

const createFieldCategory = async (name = "Storage Access Field") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const buildPdfBuffer = async (pageCount = 1) => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }

  return Buffer.from(await document.save());
};

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  storageKey = "jobhub/candidate-cvs/uploaded/current-restricted",
}) => {
  return CandidateCV.create({
    candidateUserId,
    name: "Restricted Storage CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
    categoryId,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt: null,
    uploadedFile: {
      storageKey,
      originalFileName: "current.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 1200,
      pageCount: 1,
      uploadedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
  });
};

const assertNoStorageKeyLeak = (uploadedFile) => {
  expect(uploadedFile).toBeTruthy();
  expect(uploadedFile).not.toHaveProperty("storageKey");
  expect(uploadedFile).toMatchObject({
    originalFileName: expect.any(String),
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: expect.any(Number),
    pageCount: expect.any(Number),
  });
  expect(uploadedFile.uploadedAt).toBeTruthy();
};

describe("V7 acceptance — Uploaded CV restricted storage access (F05/F06/F08)", () => {
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

  it("create Uploaded CV uploads with restricted Cloudinary delivery and hides storageKey", async () => {
    const uploadSpy = vi
      .spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/restricted-create",
        resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
        deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
      });
    const deleteSpy = vi.spyOn(fileService, "deleteFile");

    const { user } = await createVerifiedUser({
      email: "cv.storage.create@example.com",
    });
    const category = await createFieldCategory("Create Restricted");
    const pdfBuffer = await buildPdfBuffer(2);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .post("/api/candidate/cvs/uploaded")
      .set("Authorization", `Bearer ${accessToken}`)
      .field("name", "Restricted Create")
      .field("visibility", CANDIDATE_CV_VISIBILITY.PUBLIC)
      .field("categoryId", category._id.toString())
      .attach("file", pdfBuffer, "resume.pdf");

    expect(response.status).toBe(201);
    expect(uploadSpy).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      assetFolder: CLOUDINARY_FOLDER.CANDIDATE_UPLOADED_CVS,
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });
    expect(uploadSpy.mock.calls[0][0].deliveryType).not.toBe("upload");
    expect(deleteSpy).not.toHaveBeenCalled();

    assertNoStorageKeyLeak(response.body.cv.uploadedFile);

    const persisted = await CandidateCV.findById(response.body.cv.id).lean();
    expect(persisted.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/restricted-create",
    );
  });

  it("replace Uploaded CV uses the same restricted delivery for upload and old-file cleanup", async () => {
    const uploadSpy = vi
      .spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/restricted-replace",
        resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
        deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
      });
    const deleteSpy = vi.spyOn(fileService, "deleteFile").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/current-restricted",
      result: "ok",
    });

    const { user } = await createVerifiedUser({
      email: "cv.storage.replace@example.com",
    });
    const category = await createFieldCategory("Replace Restricted");
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

    expect(response.status).toBe(200);
    expect(uploadSpy).toHaveBeenCalledWith({
      buffer: expect.any(Buffer),
      assetFolder: CLOUDINARY_FOLDER.CANDIDATE_UPLOADED_CVS,
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });
    expect(deleteSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/current-restricted",
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });

    assertNoStorageKeyLeak(response.body.cv.uploadedFile);

    const persisted = await CandidateCV.findById(existing._id).lean();
    expect(persisted.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/restricted-replace",
    );
  });

  it("preview and download fetch the restricted asset type and still hide storageKey on detail", async () => {
    const currentPdf = await buildPdfBuffer(1);
    const downloadSpy = vi
      .spyOn(fileService, "downloadFileBuffer")
      .mockResolvedValue(currentPdf);

    const { user } = await createVerifiedUser({
      email: "cv.storage.preview@example.com",
    });
    const category = await createFieldCategory("Preview Restricted");
    const uploadedCv = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      storageKey: "jobhub/candidate-cvs/uploaded/restricted-current",
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const previewResponse = await agent
      .get(`/api/candidate/cvs/${uploadedCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(previewResponse.status).toBe(200);
    expect(downloadSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/restricted-current",
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });

    const detailResponse = await agent
      .get(`/api/candidate/cvs/${uploadedCv._id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(detailResponse.status).toBe(200);
    assertNoStorageKeyLeak(detailResponse.body.cv.uploadedFile);

    const downloadResponse = await agent
      .get(`/api/candidate/cvs/${uploadedCv._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(downloadResponse.status).toBe(200);
    expect(downloadSpy).toHaveBeenLastCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/restricted-current",
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });
  });

  it("create persistence-failure cleanup deletes with the same restricted delivery type", async () => {
    const uploadSpy = vi
      .spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/restricted-orphan",
        resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
        deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
      });
    const deleteSpy = vi.spyOn(fileService, "deleteFile").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/restricted-orphan",
      result: "ok",
    });
    vi.spyOn(CandidateCV, "create").mockRejectedValue(
      new Error("simulated persistence failure"),
    );

    const { user } = await createVerifiedUser({
      email: "cv.storage.orphan@example.com",
    });
    const category = await createFieldCategory("Orphan Restricted");
    const pdfBuffer = await buildPdfBuffer(1);
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .post("/api/candidate/cvs/uploaded")
      .set("Authorization", `Bearer ${accessToken}`)
      .field("name", "Orphan Restricted")
      .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
      .field("categoryId", category._id.toString())
      .attach("file", pdfBuffer, "resume.pdf");

    expect(response.status).toBe(500);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/restricted-orphan",
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });
    expect(await CandidateCV.countDocuments()).toBe(0);
  });
});
