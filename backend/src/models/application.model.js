import mongoose from "mongoose";

import APPLICATION_SOURCE from "../constants/application-source.js";
import APPLICATION_STATUS from "../constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import { generatedCvContentSchema } from "./candidate-cv.model.js";

const { Schema, model } = mongoose;

const APPLICATION_SOURCE_VALUES = Object.values(APPLICATION_SOURCE);
const APPLICATION_STATUS_VALUES = Object.values(APPLICATION_STATUS);
const SNAPSHOT_SOURCE_TYPE_VALUES = Object.values(CANDIDATE_CV_SOURCE_TYPE);

const IMMUTABLE_APPLICATION_IDENTITY_FIELDS = Object.freeze([
  "candidateUserId",
  "jobId",
  "source",
  "appliedAt",
]);

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const hasPresentSubdocument = (value) => {
  return value != null && typeof value === "object";
};

const cvSnapshotPdfFileSchema = new Schema(
  {
    storageKey: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "pdfFile.storageKey must be a non-empty string",
      },
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "pdfFile.originalFileName must be a non-empty string",
      },
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      enum: {
        values: [CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE],
        message: "pdfFile.mimeType must be application/pdf",
      },
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: [1, "pdfFile.sizeBytes must be greater than 0"],
    },
    pageCount: {
      type: Number,
      required: true,
      min: [1, "pdfFile.pageCount must be greater than 0"],
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const submittedCvSnapshotSchema = new Schema(
  {
    sourceCandidateCvId: {
      type: Schema.Types.ObjectId,
      ref: "CandidateCV",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "submittedCvSnapshot.name must be a non-empty string",
      },
    },
    sourceType: {
      type: String,
      required: true,
      enum: {
        values: SNAPSHOT_SOURCE_TYPE_VALUES,
        message:
          "submittedCvSnapshot.sourceType must be GENERATED or UPLOADED",
      },
    },
    generatedContent: {
      type: generatedCvContentSchema,
      required: false,
      default: undefined,
    },
    pdfFile: {
      type: cvSnapshotPdfFileSchema,
      required: true,
    },
    capturedAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const assertApplicationLocalInvariants = (application) => {
  const errors = [];
  const snapshot = application.submittedCvSnapshot;
  const hasGeneratedContent = hasPresentSubdocument(snapshot?.generatedContent);
  const hasPdfFile = hasPresentSubdocument(snapshot?.pdfFile);

  if (application.status === APPLICATION_STATUS.APPLIED) {
    if (application.withdrawnAt != null) {
      errors.push("APPLIED Application must not have withdrawnAt");
    }

    if (application.withdrawReason != null) {
      errors.push("APPLIED Application must not have withdrawReason");
    }
  }

  if (application.status === APPLICATION_STATUS.WITHDRAWN) {
    if (application.withdrawnAt == null) {
      errors.push("WITHDRAWN Application must have withdrawnAt");
    }
  }

  if (snapshot?.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    if (!hasGeneratedContent) {
      errors.push("GENERATED submittedCvSnapshot must have generatedContent");
    }

    if (!hasPdfFile) {
      errors.push("GENERATED submittedCvSnapshot must have pdfFile");
    }
  }

  if (snapshot?.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    if (hasGeneratedContent) {
      errors.push("UPLOADED submittedCvSnapshot must not have generatedContent");
    }

    if (!hasPdfFile) {
      errors.push("UPLOADED submittedCvSnapshot must have pdfFile");
    }
  }

  if (typeof application.version === "number" && application.version < 0) {
    errors.push("Application version must be non-negative");
  }

  return errors;
};

const APPLICATION_COLLECTION_VALIDATOR = Object.freeze({
  $expr: {
    $and: [
      {
        $gte: ["$version", 0],
      },
      {
        $or: [
          {
            $ne: ["$status", APPLICATION_STATUS.APPLIED],
          },
          {
            $eq: [{ $ifNull: ["$withdrawnAt", null] }, null],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", APPLICATION_STATUS.APPLIED],
          },
          {
            $eq: [{ $ifNull: ["$withdrawReason", null] }, null],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", APPLICATION_STATUS.WITHDRAWN],
          },
          {
            $ne: [{ $ifNull: ["$withdrawnAt", null] }, null],
          },
        ],
      },
      {
        $or: [
          {
            $ne: [
              "$submittedCvSnapshot.sourceType",
              CANDIDATE_CV_SOURCE_TYPE.GENERATED,
            ],
          },
          {
            $and: [
              {
                $ne: [
                  { $ifNull: ["$submittedCvSnapshot.generatedContent", null] },
                  null,
                ],
              },
              {
                $eq: [
                  { $type: "$submittedCvSnapshot.generatedContent" },
                  "object",
                ],
              },
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: [
              "$submittedCvSnapshot.sourceType",
              CANDIDATE_CV_SOURCE_TYPE.GENERATED,
            ],
          },
          {
            $and: [
              {
                $ne: [
                  { $ifNull: ["$submittedCvSnapshot.pdfFile", null] },
                  null,
                ],
              },
              {
                $eq: [{ $type: "$submittedCvSnapshot.pdfFile" }, "object"],
              },
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: [
              "$submittedCvSnapshot.sourceType",
              CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
            ],
          },
          {
            $eq: [
              { $ifNull: ["$submittedCvSnapshot.generatedContent", null] },
              null,
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: [
              "$submittedCvSnapshot.sourceType",
              CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
            ],
          },
          {
            $and: [
              {
                $ne: [
                  { $ifNull: ["$submittedCvSnapshot.pdfFile", null] },
                  null,
                ],
              },
              {
                $eq: [{ $type: "$submittedCvSnapshot.pdfFile" }, "object"],
              },
            ],
          },
        ],
      },
      {
        $or: [
          {
            $eq: [{ $ifNull: ["$submittedCvSnapshot.pdfFile", null] }, null],
          },
          {
            $eq: [
              "$submittedCvSnapshot.pdfFile.mimeType",
              CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
            ],
          },
        ],
      },
      {
        $or: [
          {
            $eq: [{ $ifNull: ["$submittedCvSnapshot.pdfFile", null] }, null],
          },
          {
            $gt: ["$submittedCvSnapshot.pdfFile.sizeBytes", 0],
          },
        ],
      },
      {
        $or: [
          {
            $eq: [{ $ifNull: ["$submittedCvSnapshot.pdfFile", null] }, null],
          },
          {
            $gt: ["$submittedCvSnapshot.pdfFile.pageCount", 0],
          },
        ],
      },
    ],
  },
});

const applicationSchema = new Schema(
  {
    candidateUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: {
        values: APPLICATION_SOURCE_VALUES,
        message: "source must use canonical Application source values",
      },
      default: APPLICATION_SOURCE.DIRECT_APPLICATION,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: APPLICATION_STATUS_VALUES,
        message: "status must use canonical Application status values",
      },
      default: APPLICATION_STATUS.APPLIED,
    },
    submittedCvSnapshot: {
      type: submittedCvSnapshotSchema,
      required: true,
    },
    appliedAt: {
      type: Date,
      required: true,
    },
    withdrawnAt: {
      type: Date,
      default: null,
    },
    withdrawReason: {
      type: String,
      default: null,
      trim: true,
    },
    version: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "version must be non-negative"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "applications",
  },
);

applicationSchema.pre("validate", function enforceApplicationLocalInvariants() {
  if (!this.isNew) {
    for (const field of IMMUTABLE_APPLICATION_IDENTITY_FIELDS) {
      if (this.isModified(field)) {
        this.invalidate(
          field,
          `${field} is immutable after Application creation`,
        );
      }
    }
  }

  const errors = assertApplicationLocalInvariants(this);

  if (errors.length > 0) {
    this.invalidate("status", errors[0]);
  }
});

applicationSchema.index(
  { candidateUserId: 1, jobId: 1 },
  {
    unique: true,
  },
);

const Application = model("Application", applicationSchema);

const ensureApplicationCollectionInvariants = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring Application collection invariants",
    );
  }

  await Application.init();

  const collectionName = Application.collection.collectionName;
  const applyValidator = () =>
    connection.db.command({
      collMod: collectionName,
      validator: APPLICATION_COLLECTION_VALIDATOR,
      validationLevel: "strict",
      validationAction: "error",
    });

  try {
    await applyValidator();
    return;
  } catch (error) {
    const isMissingNamespace =
      error?.code === 26 ||
      error?.codeName === "NamespaceNotFound" ||
      /ns does not exist/i.test(error?.message ?? "");

    if (!isMissingNamespace) {
      throw error;
    }
  }

  try {
    await connection.db.createCollection(collectionName, {
      validator: APPLICATION_COLLECTION_VALIDATOR,
      validationLevel: "strict",
      validationAction: "error",
    });
  } catch (error) {
    const collectionAlreadyExists =
      error?.codeName === "NamespaceExists" ||
      /already exists/i.test(error?.message ?? "");

    if (!collectionAlreadyExists) {
      throw error;
    }

    await applyValidator();
  }
};

export {
  APPLICATION_COLLECTION_VALIDATOR,
  assertApplicationLocalInvariants,
  applicationSchema,
  cvSnapshotPdfFileSchema,
  ensureApplicationCollectionInvariants,
  submittedCvSnapshotSchema,
};

export default Application;
