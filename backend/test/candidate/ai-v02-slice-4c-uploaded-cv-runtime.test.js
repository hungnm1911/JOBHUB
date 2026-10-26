import { PDFDocument } from "pdf-lib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const normalizeUploadedCvSpy = vi.hoisted(() => vi.fn());
vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    aiKit: Object.freeze({ ...actual.aiKit, normalizeUploadedCv: normalizeUploadedCvSpy }),
  };
});

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { normalizeOwnUploadedCandidateCv } from "../../src/services/candidate-cv-ai-normalization.service.js";
import * as fileService from "../../src/services/file.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/database.js";

let sequence = 0;
const createCandidate = async () => (
  await createVerifiedUser({ email: `ai-v02-4c-${++sequence}@example.com` })
).user;

const buildPdf = async () => {
  const document = await PDFDocument.create();
  document.addPage();
  return Buffer.from(await document.save());
};

const createCv = async (owner, pdfBuffer, overrides = {}) => {
  const category = await Category.create({
    name: `AI-V02 runtime ${++sequence}`,
    level: CATEGORY_LEVEL.FIELD,
  });
  const cv = await CandidateCV.create({
    candidateUserId: owner._id,
    name: "Uploaded CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: category._id,
    experienceLevelId: null,
    skillTags: ["Node.js"],
    employmentTypes: [],
    workModes: [],
    preferredLocations: [],
    uploadedFile: {
      storageKey: "jobhub/candidate-cvs/uploaded/current",
      originalFileName: "current.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      pageCount: 1,
      uploadedAt: new Date("2026-10-01T00:00:00.000Z"),
    },
    ...overrides,
  });
  return { cv, category };
};

const normalize = (owner, cv, onAuthorizedSource) => normalizeOwnUploadedCandidateCv({
  candidateUserId: owner._id,
  actorUser: owner,
  candidateCvId: cv._id.toString(),
  onAuthorizedSource,
});

const expectError = async (promise, statusCode) => {
  const error = await promise.then(() => null, (caught) => caught);
  expect(error).toMatchObject({ name: "AppError", statusCode });
  return error;
};

describe("AI-V02 Slice 4c — own Uploaded CV runtime invocation", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    normalizeUploadedCvSpy.mockReset();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it.each([
    ["READY", { status: "READY", profile: { source: { type: "UPLOADED_CV" } } }],
    ["FAILED", { status: "FAILED", profile: null }],
  ])("passes the current source and PDF to one AI Kit invocation and preserves %s", async (_status, aiResult) => {
    const owner = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv, category } = await createCv(owner, pdfBuffer);
    const before = await CandidateCV.collection.findOne({ _id: cv._id });
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);
    normalizeUploadedCvSpy.mockResolvedValue(aiResult);
    const onAuthorizedSource = vi.fn();

    const result = await normalize(owner, cv, onAuthorizedSource);

    expect(result).toBe(aiResult);
    expect(onAuthorizedSource).toHaveBeenCalledTimes(_status === "READY" ? 1 : 0);
    if (_status === "READY") {
      expect(onAuthorizedSource).toHaveBeenCalledWith(before);
    }
    expect(normalizeUploadedCvSpy).toHaveBeenCalledTimes(1);
    const [{ cvSource, pdfBuffer: suppliedPdf }] = normalizeUploadedCvSpy.mock.calls[0];
    expect(suppliedPdf).toBe(pdfBuffer);
    expect(cvSource).toEqual({
      candidateCvId: cv._id.toString(),
      categoryId: category._id.toString(),
      experienceLevelId: null,
      skillTags: ["Node.js"],
      employmentTypes: [],
      workModes: [],
      preferredLocations: [],
      taxonomy: {
        category: { id: category._id.toString(), name: category.name, level: CATEGORY_LEVEL.FIELD, parentCategoryId: null },
        experienceLevel: null,
      },
    });
    expect(download).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      publicId: "jobhub/candidate-cvs/uploaded/current",
    }));
    expect(await CandidateCV.collection.findOne({ _id: cv._id })).toEqual(before);
  });

  it("refuses unauthorized, archived, wrong-type, and missing-PDF sources before AI Kit", async () => {
    const owner = await createCandidate();
    const other = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv } = await createCv(owner, pdfBuffer);
    const { cv: archived } = await createCv(owner, pdfBuffer, { archivedAt: new Date() });
    const generated = await CandidateCV.create({
      candidateUserId: owner._id,
      name: "Generated CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId: cv.categoryId,
      generatedContent: {},
    });
    const download = vi.spyOn(fileService, "downloadFileBuffer");

    await expectError(normalize(other, cv), 404);
    await expectError(normalize(owner, archived), 404);
    await expectError(normalize(owner, generated), 409);
    await CandidateCV.collection.updateOne(
      { _id: cv._id },
      { $unset: { uploadedFile: "" } },
      { bypassDocumentValidation: true },
    );
    await expectError(normalize(owner, cv), 500);
    expect(download).not.toHaveBeenCalled();
    expect(normalizeUploadedCvSpy).not.toHaveBeenCalled();
  });

  it("uses the replacement PDF and never a prior key", async () => {
    const owner = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv } = await createCv(owner, pdfBuffer);
    await CandidateCV.collection.updateOne({ _id: cv._id }, {
      $set: {
        "uploadedFile.storageKey": "jobhub/candidate-cvs/uploaded/replacement",
        "uploadedFile.uploadedAt": new Date("2026-10-02T00:00:00.000Z"),
      },
    });
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);
    normalizeUploadedCvSpy.mockResolvedValue({ status: "FAILED", profile: null });

    await normalize(owner, cv);

    expect(download).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      publicId: "jobhub/candidate-cvs/uploaded/replacement",
    }));
    expect(normalizeUploadedCvSpy).toHaveBeenCalledTimes(1);
  });

  it("reads and invokes again on a later call without reusing a profile or PDF", async () => {
    const owner = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv } = await createCv(owner, pdfBuffer);
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);
    normalizeUploadedCvSpy.mockResolvedValue({ status: "FAILED", profile: null });

    await normalize(owner, cv);
    await normalize(owner, cv);

    expect(download).toHaveBeenCalledTimes(2);
    expect(normalizeUploadedCvSpy).toHaveBeenCalledTimes(2);
  });

  it("refuses a replacement during PDF download before AI Kit", async () => {
    const owner = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv } = await createCv(owner, pdfBuffer);
    vi.spyOn(fileService, "downloadFileBuffer").mockImplementation(async () => {
      await CandidateCV.collection.updateOne({ _id: cv._id }, {
        $set: {
          "uploadedFile.storageKey": "jobhub/candidate-cvs/uploaded/replacement",
          "uploadedFile.uploadedAt": new Date("2026-10-02T00:00:00.000Z"),
        },
      });
      return pdfBuffer;
    });

    await expectError(normalize(owner, cv), 409);
    expect(normalizeUploadedCvSpy).not.toHaveBeenCalled();
  });

  it("distinguishes storage/PDF failure from provider errors", async () => {
    const owner = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv } = await createCv(owner, pdfBuffer);
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockRejectedValueOnce(new Error("storage down"));

    await expectError(normalize(owner, cv), 502);
    download.mockResolvedValueOnce(Buffer.from("not a PDF"));
    await expectError(normalize(owner, cv), 502);
    expect(normalizeUploadedCvSpy).not.toHaveBeenCalled();

    download.mockResolvedValue(pdfBuffer);
    const providerError = new Error("provider unavailable");
    normalizeUploadedCvSpy.mockRejectedValue(providerError);
    await expect(normalize(owner, cv)).rejects.toBe(providerError);
    expect(normalizeUploadedCvSpy).toHaveBeenCalledTimes(1);
  });

  it("maps AI Kit's coded source refusal to a projection error", async () => {
    const owner = await createCandidate();
    const pdfBuffer = await buildPdf();
    const { cv } = await createCv(owner, pdfBuffer);
    vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);
    normalizeUploadedCvSpy.mockRejectedValue(Object.assign(new Error("invalid source"), {
      code: "INVALID_UPLOADED_CV_INPUT",
      details: ["/categoryId"],
    }));

    const error = await expectError(normalize(owner, cv), 500);
    expect(error.details.issues).toEqual(["/categoryId"]);
  });
});
