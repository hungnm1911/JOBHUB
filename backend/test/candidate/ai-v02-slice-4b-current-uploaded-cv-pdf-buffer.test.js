import { PDFDocument } from "pdf-lib";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../../src/constants/candidate-cv-uploaded-storage.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { readOwnCurrentUploadedCandidateCvPdfBuffer } from "../../src/services/candidate-cv.service.js";
import * as fileService from "../../src/services/file.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/database.js";

let sequence = 0;

const buildPdf = async () => {
  const document = await PDFDocument.create();
  document.addPage();
  return Buffer.from(await document.save());
};

const createSource = async ({ owner, pdfBuffer, sourceType = CANDIDATE_CV_SOURCE_TYPE.UPLOADED, archivedAt = null }) => {
  const category = await Category.create({
    name: `AI-V02 4b field ${++sequence}`,
    level: CATEGORY_LEVEL.FIELD,
  });

  return CandidateCV.create({
    candidateUserId: owner._id,
    name: "Current Uploaded CV",
    sourceType,
    status: sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
      ? CANDIDATE_CV_STATUS.ACTIVE
      : CANDIDATE_CV_STATUS.DRAFT,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: category._id,
    archivedAt,
    ...(sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
      ? {
          uploadedFile: {
            storageKey: "jobhub/candidate-cvs/uploaded/current",
            originalFileName: "current.pdf",
            mimeType: "application/pdf",
            sizeBytes: pdfBuffer.length,
            pageCount: 1,
            uploadedAt: new Date("2026-10-01T00:00:00.000Z"),
          },
        }
      : { generatedContent: {} }),
  });
};

const readPdf = (owner, cv) => readOwnCurrentUploadedCandidateCvPdfBuffer({
  candidateUserId: owner._id,
  actorUser: owner,
  candidateCvId: cv._id.toString(),
});

const expectAppError = async (promise, statusCode) => {
  const error = await promise.then(() => null, (caught) => caught);
  expect(error).toMatchObject({ name: "AppError", statusCode });
  return error;
};

describe("AI-V02 Slice 4b — current authorized Uploaded CV PDF Buffer", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("reads only the current key with authenticated storage and returns the validated Buffer without writes", async () => {
    const { user: owner } = await createVerifiedUser({ email: `ai-v02-4b-${++sequence}@example.com` });
    const pdfBuffer = await buildPdf();
    const cv = await createSource({ owner, pdfBuffer });
    await CandidateCV.collection.updateOne(
      { _id: cv._id },
      { $set: { "uploadedFile.storageKey": "jobhub/candidate-cvs/uploaded/replacement" } },
    );
    const before = await CandidateCV.collection.findOne({ _id: cv._id });
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);

    const result = await readPdf(owner, cv);

    expect(result).toBe(pdfBuffer);
    expect(download).toHaveBeenCalledExactlyOnceWith({
      publicId: "jobhub/candidate-cvs/uploaded/replacement",
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });
    expect(await CandidateCV.collection.findOne({ _id: cv._id })).toEqual(before);
  });

  it.each([
    ["missing key", { $unset: { "uploadedFile.storageKey": "" } }],
    ["blank key", { $set: { "uploadedFile.storageKey": "   " } }],
    ["non-string key", { $set: { "uploadedFile.storageKey": 42 } }],
    ["wrong MIME", { $set: { "uploadedFile.mimeType": "text/plain" } }],
    ["invalid size", { $set: { "uploadedFile.sizeBytes": 0 } }],
    ["invalid page count", { $set: { "uploadedFile.pageCount": 0 } }],
    ["missing file", { $unset: { uploadedFile: "" } }],
    ["draft state", { $set: { status: CANDIDATE_CV_STATUS.DRAFT } }],
  ])("rejects %s before storage access", async (_label, update) => {
    const { user: owner } = await createVerifiedUser({ email: `ai-v02-4b-${++sequence}@example.com` });
    const pdfBuffer = await buildPdf();
    const cv = await createSource({ owner, pdfBuffer });
    await CandidateCV.collection.updateOne({ _id: cv._id }, update, { bypassDocumentValidation: true });
    const download = vi.spyOn(fileService, "downloadFileBuffer");

    await expectAppError(readPdf(owner, cv), 409);
    expect(download).not.toHaveBeenCalled();
  });

  it("rejects another owner, archived CV, and Generated CV before storage access", async () => {
    const { user: owner } = await createVerifiedUser({ email: `ai-v02-4b-${++sequence}@example.com` });
    const { user: other } = await createVerifiedUser({ email: `ai-v02-4b-${++sequence}@example.com` });
    const pdfBuffer = await buildPdf();
    const current = await createSource({ owner, pdfBuffer });
    const archived = await createSource({ owner, pdfBuffer, archivedAt: new Date() });
    const generated = await createSource({ owner, pdfBuffer, sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED });
    const download = vi.spyOn(fileService, "downloadFileBuffer");

    await expectAppError(readPdf(other, current), 404);
    await expectAppError(readPdf(owner, archived), 404);
    await expectAppError(readPdf(owner, generated), 409);
    await expectAppError(readOwnCurrentUploadedCandidateCvPdfBuffer({
      candidateUserId: owner._id,
      actorUser: null,
      candidateCvId: current._id.toString(),
    }), 403);
    expect(download).not.toHaveBeenCalled();
  });

  it("distinguishes storage failure and unreadable or mismatched PDF from invalid source", async () => {
    const { user: owner } = await createVerifiedUser({ email: `ai-v02-4b-${++sequence}@example.com` });
    const pdfBuffer = await buildPdf();
    const cv = await createSource({ owner, pdfBuffer });
    const failure = new Error("storage unavailable");
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockRejectedValueOnce(failure);

    const storageError = await expectAppError(readPdf(owner, cv), 502);
    expect(storageError.cause).toBe(failure);

    download.mockResolvedValueOnce(Buffer.from("not a PDF"));
    await expectAppError(readPdf(owner, cv), 502);

    download.mockResolvedValueOnce(Buffer.concat([pdfBuffer, Buffer.from("extra")]));
    await expectAppError(readPdf(owner, cv), 502);
    expect(download).toHaveBeenCalledTimes(3);
  });
});
