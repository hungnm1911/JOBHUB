import { PDFDocument } from "pdf-lib";

import APPLICATION_SUBMITTED_CV_STORAGE from "../constants/application-submitted-cv-storage.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../constants/candidate-cv-uploaded-storage.js";
import CLOUDINARY_FOLDER from "../constants/cloudinary-folder.js";
import AppError from "../utils/app-error.js";
import { renderHarvardCandidateCvPdf } from "./candidate-cv-harvard-pdf.service.js";
import { deleteFile, downloadFileBuffer, uploadFileBuffer } from "./file.service.js";

const APPLICATION_CV_SNAPSHOT_STORAGE = Object.freeze({
  assetFolder: CLOUDINARY_FOLDER.APPLICATION_SUBMITTED_CV_SNAPSHOTS,
  resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
  deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
});

const JOB_INVITATION_CV_SNAPSHOT_STORAGE = Object.freeze({
  assetFolder: CLOUDINARY_FOLDER.JOB_INVITATION_INVITED_CV_SNAPSHOTS,
  resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
  deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
});

const deepCopyGeneratedContent = (generatedContent) => {
  if (generatedContent == null) {
    return null;
  }

  if (typeof generatedContent.toObject === "function") {
    return generatedContent.toObject();
  }

  return JSON.parse(JSON.stringify(generatedContent));
};

const toPlainSnapshot = (snapshot) => {
  if (snapshot == null) {
    return null;
  }

  if (typeof snapshot.toObject === "function") {
    return snapshot.toObject({ depopulate: true });
  }

  return snapshot;
};

const deepCopyCvSnapshot = (snapshot) => {
  const plain = toPlainSnapshot(snapshot);

  if (plain == null) {
    return null;
  }

  const copied = {
    sourceCandidateCvId: plain.sourceCandidateCvId,
    name: plain.name,
    sourceType: plain.sourceType,
    pdfFile: {
      storageKey: plain.pdfFile.storageKey,
      originalFileName: plain.pdfFile.originalFileName,
      mimeType: plain.pdfFile.mimeType,
      sizeBytes: plain.pdfFile.sizeBytes,
      pageCount: plain.pdfFile.pageCount,
    },
    capturedAt:
      plain.capturedAt instanceof Date
        ? new Date(plain.capturedAt)
        : new Date(plain.capturedAt),
  };

  if (plain.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    copied.generatedContent = deepCopyGeneratedContent(plain.generatedContent);
  }

  return copied;
};

const uploadCvSnapshotFile = ({ buffer, storage }) => {
  return uploadFileBuffer({
    buffer,
    assetFolder: storage.assetFolder,
    resourceType: storage.resourceType,
    deliveryType: storage.deliveryType,
  });
};

const deleteCvSnapshotFile = ({ storageKey, storage }) => {
  return deleteFile({
    publicId: storageKey,
    resourceType: storage.resourceType,
    deliveryType: storage.deliveryType,
  });
};

const downloadUploadedCandidateCvFile = (publicId) => {
  return downloadFileBuffer({
    publicId,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });
};

const buildSnapshotOriginalFileName = (candidateCvName) => {
  const trimmedName =
    typeof candidateCvName === "string" ? candidateCvName.trim() : "";

  if (trimmedName === "") {
    return "submitted-cv.pdf";
  }

  return trimmedName.toLowerCase().endsWith(".pdf")
    ? trimmedName
    : `${trimmedName}.pdf`;
};

const resolveUploadedSnapshotOriginalFileName = (candidateCv) => {
  const uploadedOriginalFileName =
    typeof candidateCv.uploadedFile?.originalFileName === "string"
      ? candidateCv.uploadedFile.originalFileName.trim()
      : "";

  if (uploadedOriginalFileName !== "") {
    return uploadedOriginalFileName;
  }

  return buildSnapshotOriginalFileName(candidateCv.name);
};

const captureUploadedCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
  storage,
}) => {
  let pdfBuffer;

  try {
    pdfBuffer = await downloadUploadedCandidateCvFile(
      candidateCv.uploadedFile.storageKey,
    );
  } catch {
    throw new AppError(502, "Failed to retrieve Uploaded CV PDF for snapshot", {
      field: "candidateCvId",
    });
  }

  const storedFile = await uploadCvSnapshotFile({ buffer: pdfBuffer, storage });
  const pageCount = candidateCv.uploadedFile.pageCount;
  const sizeBytes = candidateCv.uploadedFile.sizeBytes ?? pdfBuffer.length;

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError(502, "Failed to capture Uploaded CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
    throw new AppError(502, "Failed to capture Uploaded CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  return {
    snapshot: {
      sourceCandidateCvId: candidateCv._id,
      name: candidateCv.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: storedFile.publicId,
        originalFileName: resolveUploadedSnapshotOriginalFileName(candidateCv),
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes,
        pageCount,
      },
      capturedAt,
    },
    storageKey: storedFile.publicId,
  };
};

const captureGeneratedCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
  storage,
}) => {
  const generatedContent = deepCopyGeneratedContent(
    candidateCv.generatedContent,
  );
  const pdfBuffer = await renderHarvardCandidateCvPdf(generatedContent);
  const pdfDocument = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDocument.getPageCount();

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError(502, "Failed to render Generated CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  const storedFile = await uploadCvSnapshotFile({ buffer: pdfBuffer, storage });

  return {
    snapshot: {
      sourceCandidateCvId: candidateCv._id,
      name: candidateCv.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      generatedContent,
      pdfFile: {
        storageKey: storedFile.publicId,
        originalFileName: buildSnapshotOriginalFileName(candidateCv.name),
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: pdfBuffer.length,
        pageCount,
      },
      capturedAt,
    },
    storageKey: storedFile.publicId,
  };
};

const captureCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
  storage,
}) => {
  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    return captureGeneratedCvSnapshot({
      candidateCv,
      capturedAt,
      storage,
    });
  }

  return captureUploadedCvSnapshot({
    candidateCv,
    capturedAt,
    storage,
  });
};

export {
  APPLICATION_CV_SNAPSHOT_STORAGE,
  JOB_INVITATION_CV_SNAPSHOT_STORAGE,
  captureCvSnapshot,
  captureGeneratedCvSnapshot,
  captureUploadedCvSnapshot,
  deepCopyCvSnapshot,
  deepCopyGeneratedContent,
  deleteCvSnapshotFile,
};
