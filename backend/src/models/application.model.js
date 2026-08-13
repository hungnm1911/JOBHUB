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

// Recruitment statuses that are only valid with a current Assigned Recruiter.
// UNASSIGNED is an assignment-state derivation, never an Application.status value.
const APPLICATION_STATUSES_REQUIRING_ASSIGNEE = Object.freeze([
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
]);

const IMMUTABLE_APPLICATION_IDENTITY_FIELDS = Object.freeze([
  "candidateUserId",
  "jobId",
  "source",
  "appliedAt",
]);

const hasAssignedRecruiter = (application) => {
  return application?.assignedRecruiterCompanyMemberId != null;
};

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
      validate: {
        validator: Number.isInteger,
        message: "pdfFile.sizeBytes must be an integer",
      },
    },
    pageCount: {
      type: Number,
      required: true,
      min: [1, "pdfFile.pageCount must be greater than 0"],
      validate: {
        validator: Number.isInteger,
        message: "pdfFile.pageCount must be an integer",
      },
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
  const assigned = hasAssignedRecruiter(application);

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

  if (
    APPLICATION_STATUSES_REQUIRING_ASSIGNEE.includes(application.status) &&
    !assigned
  ) {
    errors.push(
      `${application.status} Application must have assignedRecruiterCompanyMemberId`,
    );
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

  if (typeof application.version === "number") {
    if (!Number.isInteger(application.version)) {
      errors.push("Application version must be an integer");
    }
    if (application.version < 0) {
      errors.push("Application version must be non-negative");
    }
  }

  if (typeof application.version !== "number") {
    errors.push("Application version must be non-negative");
  }

  return errors;
};

const APPLICATION_COLLECTION_VALIDATOR = Object.freeze({
  $expr: {
    $and: [
      {
        $eq: [{ $type: "$candidateUserId" }, "objectId"],
      },
      {
        $eq: [{ $type: "$jobId" }, "objectId"],
      },
      {
        $in: ["$source", APPLICATION_SOURCE_VALUES],
      },
      {
        $in: ["$status", APPLICATION_STATUS_VALUES],
      },
      {
        $eq: [{ $type: "$appliedAt" }, "date"],
      },
      {
        $gte: ["$version", 0],
      },
      {
        // Prevent fractional revision persistence via collection-level raw inserts/updates.
        $eq: [{ $mod: ["$version", 1] }, 0],
      },
      {
        $and: [
          {
            $ne: [{ $ifNull: ["$submittedCvSnapshot", null] }, null],
          },
          {
            $eq: [{ $type: "$submittedCvSnapshot" }, "object"],
          },
        ],
      },
      {
        $eq: [{ $type: "$submittedCvSnapshot.sourceCandidateCvId" }, "objectId"],
      },
      {
        $and: [
          {
            $eq: [{ $type: "$submittedCvSnapshot.name" }, "string"],
          },
          {
            $gt: [
              {
                $strLenCP: {
                  $trim: {
                    input: "$submittedCvSnapshot.name",
                  },
                },
              },
              0,
            ],
          },
        ],
      },
      {
        $in: [
          "$submittedCvSnapshot.sourceType",
          [
            CANDIDATE_CV_SOURCE_TYPE.GENERATED,
            CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
          ],
        ],
      },
      {
        $eq: [{ $type: "$submittedCvSnapshot.capturedAt" }, "date"],
      },
      {
        $and: [
          {
            $ne: [{ $ifNull: ["$submittedCvSnapshot.pdfFile", null] }, null],
          },
          {
            $eq: [{ $type: "$submittedCvSnapshot.pdfFile" }, "object"],
          },
        ],
      },
      {
        $and: [
          {
            $eq: [{ $type: "$submittedCvSnapshot.pdfFile.storageKey" }, "string"],
          },
          {
            $gt: [
              {
                $strLenCP: {
                  $trim: {
                    input: "$submittedCvSnapshot.pdfFile.storageKey",
                  },
                },
              },
              0,
            ],
          },
        ],
      },
      {
        $and: [
          {
            $eq: [
              { $type: "$submittedCvSnapshot.pdfFile.originalFileName" },
              "string",
            ],
          },
          {
            $gt: [
              {
                $strLenCP: {
                  $trim: {
                    input: "$submittedCvSnapshot.pdfFile.originalFileName",
                  },
                },
              },
              0,
            ],
          },
        ],
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
            $eq: [{ $type: "$withdrawnAt" }, "date"],
          },
        ],
      },
      {
        // assignedRecruiterCompanyMemberId is optional: absent/null = Unassigned;
        // when present it must be a CompanyMember ObjectId reference.
        $or: [
          {
            $eq: [
              { $ifNull: ["$assignedRecruiterCompanyMemberId", null] },
              null,
            ],
          },
          {
            $eq: [{ $type: "$assignedRecruiterCompanyMemberId" }, "objectId"],
          },
        ],
      },
      {
        // Local status × assignment matrix (Data Contract §7.1 / PI-07):
        // pipeline and terminal recruiter-owned statuses require an Assignee.
        $or: [
          {
            $not: {
              $in: ["$status", APPLICATION_STATUSES_REQUIRING_ASSIGNEE],
            },
          },
          {
            $eq: [{ $type: "$assignedRecruiterCompanyMemberId" }, "objectId"],
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
        $eq: [
          "$submittedCvSnapshot.pdfFile.mimeType",
          CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        ],
      },
      {
        // Prevent fractional PDF size persistence via collection-level raw inserts/updates.
        $eq: [{ $mod: ["$submittedCvSnapshot.pdfFile.sizeBytes", 1] }, 0],
      },
      {
        $gt: ["$submittedCvSnapshot.pdfFile.sizeBytes", 0],
      },
      {
        // Prevent fractional PDF pageCount persistence via collection-level raw inserts/updates.
        $eq: [{ $mod: ["$submittedCvSnapshot.pdfFile.pageCount", 1] }, 0],
      },
      {
        $gt: ["$submittedCvSnapshot.pdfFile.pageCount", 0],
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
      immutable: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      immutable: true,
    },
    source: {
      type: String,
      required: true,
      enum: {
        values: APPLICATION_SOURCE_VALUES,
        message: "source must use canonical Application source values",
      },
      default: APPLICATION_SOURCE.DIRECT_APPLICATION,
      immutable: true,
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
      immutable: true,
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
    assignedRecruiterCompanyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMember",
      default: null,
      required: false,
    },
    version: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "version must be non-negative"],
      validate: {
        validator: Number.isInteger,
        message: "version must be a non-negative integer",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "applications",
  },
);

const identityValuesEqual = (left, right) => {
  if (left == null && right == null) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }

  return String(left) === String(right);
};

// Run before Mongoose's immutable setter so a stripped assignment still
// fail-closes on save instead of becoming a silent no-op.
for (const field of IMMUTABLE_APPLICATION_IDENTITY_FIELDS) {
  applicationSchema.path(field).set(function captureIdentityAssignment(value) {
    if (this.isNew || this.$__ == null) {
      return value;
    }

    const current = this._doc?.[field];
    if (!identityValuesEqual(current, value)) {
      this.$locals.identityMutationAttempted = field;
    }

    return value;
  });
}

const isIdentityFieldPath = (key, identityFields) => {
  const rootPath = String(key).split(".")[0];
  return identityFields.includes(key) || identityFields.includes(rootPath);
};

const operatorPayloadTargetsIdentity = (payload, identityFields) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.keys(payload).some((key) =>
    isIdentityFieldPath(key, identityFields),
  );
};

const assertNoIdentityFieldMutation = (update, identityFields) => {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    return false;
  }

  const updateKeys = Object.keys(update);
  const operatorKeys = updateKeys.filter((key) => key.startsWith("$"));

  // Any update operator whose payload keys target identity fields, including
  // $currentDate, $set, $unset, $inc, $rename, and other MongoDB operators.
  for (const opKey of operatorKeys) {
    if (operatorPayloadTargetsIdentity(update[opKey], identityFields)) {
      return true;
    }

    if (
      opKey === "$rename" &&
      update[opKey] &&
      typeof update[opKey] === "object" &&
      !Array.isArray(update[opKey])
    ) {
      for (const destination of Object.values(update[opKey])) {
        if (
          typeof destination === "string" &&
          isIdentityFieldPath(destination, identityFields)
        ) {
          return true;
        }
      }
    }
  }

  if (operatorKeys.length === 0) {
    for (const field of identityFields) {
      if (Object.prototype.hasOwnProperty.call(update, field)) {
        return true;
      }
    }
  }

  return false;
};

applicationSchema.pre("validate", function enforceApplicationLocalInvariants() {
  if (!this.isNew) {
    if (this.$locals.identityMutationAttempted) {
      const field = this.$locals.identityMutationAttempted;
      this.invalidate(
        field,
        `${field} is immutable after Application creation`,
      );
    }

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

  // Creation-state invariant for V9 Direct Applications:
  // - must start at APPLIED (expanded status enum must not let Apply invent
  //   pipeline/terminal recruiter-owned states)
  // - must start Unassigned (absent or null assignee)
  // - must start with revision version=0
  // - WITHDRAWN / pipeline statuses appear only through later approved workflows
  if (this.isNew && this.source === APPLICATION_SOURCE.DIRECT_APPLICATION) {
    if (this.status !== APPLICATION_STATUS.APPLIED) {
      errors.push("Direct Application creation must start with status=APPLIED");
    }

    if (hasAssignedRecruiter(this)) {
      errors.push(
        "Direct Application creation must start Unassigned (assignedRecruiterCompanyMemberId null)",
      );
    }

    if (this.status === APPLICATION_STATUS.APPLIED) {
      if (this.version !== 0) {
        errors.push("Direct Application creation must use version=0");
      }
    }
  }

  if (errors.length > 0) {
    this.invalidate("status", errors[0]);
  }
});

// Query-update protection: reject any update that tries to mutate Application
// business identity fields via updateOne/findOneAndUpdate query paths.
for (const method of ["updateOne", "updateMany", "findOneAndUpdate"]) {
  applicationSchema.pre(method, function rejectIdentityMutation() {
    const update = this.getUpdate();

    // Aggregation pipeline updates (array form) are not used by any canonical
    // V9 Application workflow. Reject entirely to prevent identity bypass.
    if (Array.isArray(update)) {
      throw new Error(
        "Application model does not support aggregation pipeline updates",
      );
    }

    const mutatedIdentity = assertNoIdentityFieldMutation(
      update,
      IMMUTABLE_APPLICATION_IDENTITY_FIELDS,
    );

    if (mutatedIdentity) {
      throw new Error(
        "Application business identity fields are immutable after creation",
      );
    }
  });
}

// Replacement-write protection: replaceOne and findOneAndReplace are not used
// by any canonical V9 Application workflow. Reject entirely to prevent identity
// field mutation via full-document replacement.
for (const method of ["replaceOne", "findOneAndReplace"]) {
  applicationSchema.pre(method, function rejectReplacementWrite() {
    throw new Error(
      "Application model does not support replacement writes; use updateOne with explicit field operators",
    );
  });
}

// bulkWrite is not used by any canonical V9 Application workflow. Reject
// entirely to prevent identity mutation via mixed bulk operations.
applicationSchema.pre("bulkWrite", function rejectBulkWrite() {
  throw new Error(
    "Application model does not support bulkWrite; use updateOne with explicit field operators",
  );
});

applicationSchema.index(
  { candidateUserId: 1, jobId: 1 },
  {
    unique: true,
  },
);

// IDX-A02 — Job Pipeline / Kanban by Recruitment Status
applicationSchema.index({ jobId: 1, status: 1 });

// IDX-A03 — Job + current Assignee (null assignee = Unassigned of Job)
applicationSchema.index({ jobId: 1, assignedRecruiterCompanyMemberId: 1 });

// IDX-A04 — Recruiter My Applications / current workload
applicationSchema.index({ assignedRecruiterCompanyMemberId: 1, status: 1 });

// IDX-A05 — Candidate My Applications
applicationSchema.index({ candidateUserId: 1, status: 1 });

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
  APPLICATION_STATUSES_REQUIRING_ASSIGNEE,
  assertApplicationLocalInvariants,
  applicationSchema,
  cvSnapshotPdfFileSchema,
  ensureApplicationCollectionInvariants,
  submittedCvSnapshotSchema,
};

export default Application;
