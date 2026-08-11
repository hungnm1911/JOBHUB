import { fileTypeFromBuffer } from "file-type";
import { PDFDocument } from "pdf-lib";

import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import AppError from "../utils/app-error.js";

/**
 * Candidate CV domain owner for Uploaded-PDF business validation (F05/BR-22).
 * Generic file storage must not own these rules.
 */
const inspectUploadedCandidateCvPdf = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(400, "Uploaded CV PDF is required", {
      field: "file",
    });
  }

  if (buffer.length > CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_BYTES) {
    throw new AppError(400, "Uploaded CV PDF must not exceed 10 MB", {
      field: "file",
    });
  }

  // Magic-byte detection — do not trust client mimeType / extension alone.
  const detectedFileType = await fileTypeFromBuffer(buffer);

  if (
    detectedFileType == null ||
    detectedFileType.mime !== CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE
  ) {
    throw new AppError(415, "Uploaded CV must be a valid PDF", {
      field: "file",
    });
  }

  let pdfDocument;

  try {
    pdfDocument = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    throw new AppError(415, "Uploaded CV must be a valid PDF", {
      field: "file",
    });
  }

  if (pdfDocument.isEncrypted) {
    throw new AppError(
      400,
      "Uploaded CV PDF must not be password-protected",
      {
        field: "file",
      },
    );
  }

  const pageCount = pdfDocument.getPageCount();

  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT
  ) {
    throw new AppError(400, "Uploaded CV PDF must not exceed 20 pages", {
      field: "file",
    });
  }

  return {
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: buffer.length,
    pageCount,
  };
};

export { inspectUploadedCandidateCvPdf };
