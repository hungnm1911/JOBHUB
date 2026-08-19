import mongoose from "mongoose";

import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import JOB_INVITATION_INVALIDATION_REASON from "../constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../constants/job-invitation-status.js";
import { submittedCvSnapshotSchema } from "./application.model.js";

const { Schema, model } = mongoose;

const JOB_INVITATION_STATUS_VALUES = Object.values(JOB_INVITATION_STATUS);
const JOB_INVITATION_INVALIDATION_REASON_VALUES = Object.values(
  JOB_INVITATION_INVALIDATION_REASON,
);
const TERMINAL_JOB_INVITATION_STATUSES = Object.freeze([
  JOB_INVITATION_STATUS.ACCEPTED,
  JOB_INVITATION_STATUS.REJECTED,
  JOB_INVITATION_STATUS.REVOKED,
  JOB_INVITATION_STATUS.EXPIRED,
  JOB_INVITATION_STATUS.INVALIDATED,
]);

const IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS = Object.freeze([
  "candidateUserId",
  "invitedCvId",
  "jobId",
  "sentByRecruiterCompanyMemberId",
  "invitedCvSnapshot",
  "greetingMessage",
  "sentAt",
]);

const isNullish = (value) => value == null;

const hasPresentSubdocument = (value) => {
  return value != null && typeof value === "object";
};

const assertJobInvitationLocalInvariants = (invitation) => {
  const errors = [];
  const snapshot = invitation.invitedCvSnapshot;
  const hasGeneratedContent = hasPresentSubdocument(snapshot?.generatedContent);
  const hasPdfFile = hasPresentSubdocument(snapshot?.pdfFile);
  const status = invitation.status;
  const acceptedAt = invitation.acceptedAt;
  const rejectedAt = invitation.rejectedAt;
  const revokedAt = invitation.revokedAt;
  const invalidatedAt = invitation.invalidatedAt;
  const invalidationReason = invitation.invalidationReason;

  if (snapshot?.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    if (!hasGeneratedContent) {
      errors.push("GENERATED invitedCvSnapshot must have generatedContent");
    }

    if (!hasPdfFile) {
      errors.push("GENERATED invitedCvSnapshot must have pdfFile");
    }
  }

  if (snapshot?.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    if (hasGeneratedContent) {
      errors.push("UPLOADED invitedCvSnapshot must not have generatedContent");
    }

    if (!hasPdfFile) {
      errors.push("UPLOADED invitedCvSnapshot must have pdfFile");
    }
  }

  if (status === JOB_INVITATION_STATUS.PENDING) {
    if (!isNullish(acceptedAt)) {
      errors.push("PENDING JobInvitation must not have acceptedAt");
    }
    if (!isNullish(rejectedAt)) {
      errors.push("PENDING JobInvitation must not have rejectedAt");
    }
    if (!isNullish(revokedAt)) {
      errors.push("PENDING JobInvitation must not have revokedAt");
    }
    if (!isNullish(invalidatedAt)) {
      errors.push("PENDING JobInvitation must not have invalidatedAt");
    }
    if (!isNullish(invalidationReason)) {
      errors.push("PENDING JobInvitation must not have invalidationReason");
    }
  }

  if (status === JOB_INVITATION_STATUS.ACCEPTED) {
    if (acceptedAt == null) {
      errors.push("ACCEPTED JobInvitation must have acceptedAt");
    }
    if (!isNullish(rejectedAt)) {
      errors.push("ACCEPTED JobInvitation must not have rejectedAt");
    }
    if (!isNullish(revokedAt)) {
      errors.push("ACCEPTED JobInvitation must not have revokedAt");
    }
    if (!isNullish(invalidatedAt)) {
      errors.push("ACCEPTED JobInvitation must not have invalidatedAt");
    }
    if (!isNullish(invalidationReason)) {
      errors.push("ACCEPTED JobInvitation must not have invalidationReason");
    }
  }

  if (status === JOB_INVITATION_STATUS.REJECTED) {
    if (rejectedAt == null) {
      errors.push("REJECTED JobInvitation must have rejectedAt");
    }
    if (!isNullish(acceptedAt)) {
      errors.push("REJECTED JobInvitation must not have acceptedAt");
    }
    if (!isNullish(revokedAt)) {
      errors.push("REJECTED JobInvitation must not have revokedAt");
    }
    if (!isNullish(invalidatedAt)) {
      errors.push("REJECTED JobInvitation must not have invalidatedAt");
    }
    if (!isNullish(invalidationReason)) {
      errors.push("REJECTED JobInvitation must not have invalidationReason");
    }
  }

  if (status === JOB_INVITATION_STATUS.REVOKED) {
    if (revokedAt == null) {
      errors.push("REVOKED JobInvitation must have revokedAt");
    }
    if (!isNullish(acceptedAt)) {
      errors.push("REVOKED JobInvitation must not have acceptedAt");
    }
    if (!isNullish(rejectedAt)) {
      errors.push("REVOKED JobInvitation must not have rejectedAt");
    }
    if (!isNullish(invalidatedAt)) {
      errors.push("REVOKED JobInvitation must not have invalidatedAt");
    }
    if (!isNullish(invalidationReason)) {
      errors.push("REVOKED JobInvitation must not have invalidationReason");
    }
  }

  if (status === JOB_INVITATION_STATUS.EXPIRED) {
    if (!isNullish(acceptedAt)) {
      errors.push("EXPIRED JobInvitation must not have acceptedAt");
    }
    if (!isNullish(rejectedAt)) {
      errors.push("EXPIRED JobInvitation must not have rejectedAt");
    }
    if (!isNullish(revokedAt)) {
      errors.push("EXPIRED JobInvitation must not have revokedAt");
    }
    if (!isNullish(invalidatedAt)) {
      errors.push("EXPIRED JobInvitation must not have invalidatedAt");
    }
    if (!isNullish(invalidationReason)) {
      errors.push("EXPIRED JobInvitation must not have invalidationReason");
    }
  }

  if (status === JOB_INVITATION_STATUS.INVALIDATED) {
    if (invalidatedAt == null) {
      errors.push(
        "INVALIDATED JobInvitation must have invalidatedAt as the source-cause effective time",
      );
    }
    if (invalidationReason == null) {
      errors.push("INVALIDATED JobInvitation must have invalidationReason");
    }
    if (!isNullish(acceptedAt)) {
      errors.push("INVALIDATED JobInvitation must not have acceptedAt");
    }
    if (!isNullish(rejectedAt)) {
      errors.push("INVALIDATED JobInvitation must not have rejectedAt");
    }
    if (!isNullish(revokedAt)) {
      errors.push("INVALIDATED JobInvitation must not have revokedAt");
    }
  }

  if (
    status !== JOB_INVITATION_STATUS.INVALIDATED &&
    !isNullish(invalidationReason)
  ) {
    errors.push("Non-INVALIDATED JobInvitation must not have invalidationReason");
  }

  return errors;
};

const isNullOrMissingExpr = (path) => ({
  $eq: [{ $ifNull: [path, null] }, null],
});

const isDateExpr = (path) => ({
  $eq: [{ $type: path }, "date"],
});

const isObjectIdExpr = (path) => ({
  $eq: [{ $type: path }, "objectId"],
});

const presentObjectExpr = (path) => ({
  $and: [
    {
      $ne: [{ $ifNull: [path, null] }, null],
    },
    {
      $eq: [{ $type: path }, "object"],
    },
  ],
});

const nonEmptyStringExpr = (path) => ({
  $and: [
    {
      $eq: [{ $type: path }, "string"],
    },
    {
      $gt: [
        {
          $strLenCP: {
            $trim: {
              input: path,
            },
          },
        },
        0,
      ],
    },
  ],
});

const JOB_INVITATION_COLLECTION_VALIDATOR = Object.freeze({
  $expr: {
    $and: [
      isObjectIdExpr("$candidateUserId"),
      isObjectIdExpr("$invitedCvId"),
      isObjectIdExpr("$jobId"),
      isObjectIdExpr("$sentByRecruiterCompanyMemberId"),
      {
        $in: ["$status", JOB_INVITATION_STATUS_VALUES],
      },
      isDateExpr("$sentAt"),
      isDateExpr("$expiresAt"),
      presentObjectExpr("$invitedCvSnapshot"),
      isObjectIdExpr("$invitedCvSnapshot.sourceCandidateCvId"),
      nonEmptyStringExpr("$invitedCvSnapshot.name"),
      {
        $in: [
          "$invitedCvSnapshot.sourceType",
          [
            CANDIDATE_CV_SOURCE_TYPE.GENERATED,
            CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
          ],
        ],
      },
      isDateExpr("$invitedCvSnapshot.capturedAt"),
      presentObjectExpr("$invitedCvSnapshot.pdfFile"),
      nonEmptyStringExpr("$invitedCvSnapshot.pdfFile.storageKey"),
      nonEmptyStringExpr("$invitedCvSnapshot.pdfFile.originalFileName"),
      {
        $eq: [
          "$invitedCvSnapshot.pdfFile.mimeType",
          CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        ],
      },
      {
        $eq: [{ $mod: ["$invitedCvSnapshot.pdfFile.sizeBytes", 1] }, 0],
      },
      {
        $gt: ["$invitedCvSnapshot.pdfFile.sizeBytes", 0],
      },
      {
        $eq: [{ $mod: ["$invitedCvSnapshot.pdfFile.pageCount", 1] }, 0],
      },
      {
        $gt: ["$invitedCvSnapshot.pdfFile.pageCount", 0],
      },
      {
        $or: [
          {
            $ne: [
              "$invitedCvSnapshot.sourceType",
              CANDIDATE_CV_SOURCE_TYPE.GENERATED,
            ],
          },
          presentObjectExpr("$invitedCvSnapshot.generatedContent"),
        ],
      },
      {
        $or: [
          {
            $ne: [
              "$invitedCvSnapshot.sourceType",
              CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
            ],
          },
          isNullOrMissingExpr("$invitedCvSnapshot.generatedContent"),
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", JOB_INVITATION_STATUS.PENDING],
          },
          {
            $and: [
              isNullOrMissingExpr("$acceptedAt"),
              isNullOrMissingExpr("$rejectedAt"),
              isNullOrMissingExpr("$revokedAt"),
              isNullOrMissingExpr("$invalidatedAt"),
              isNullOrMissingExpr("$invalidationReason"),
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", JOB_INVITATION_STATUS.ACCEPTED],
          },
          {
            $and: [
              isDateExpr("$acceptedAt"),
              isNullOrMissingExpr("$rejectedAt"),
              isNullOrMissingExpr("$revokedAt"),
              isNullOrMissingExpr("$invalidatedAt"),
              isNullOrMissingExpr("$invalidationReason"),
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", JOB_INVITATION_STATUS.REJECTED],
          },
          {
            $and: [
              isDateExpr("$rejectedAt"),
              isNullOrMissingExpr("$acceptedAt"),
              isNullOrMissingExpr("$revokedAt"),
              isNullOrMissingExpr("$invalidatedAt"),
              isNullOrMissingExpr("$invalidationReason"),
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", JOB_INVITATION_STATUS.REVOKED],
          },
          {
            $and: [
              isDateExpr("$revokedAt"),
              isNullOrMissingExpr("$acceptedAt"),
              isNullOrMissingExpr("$rejectedAt"),
              isNullOrMissingExpr("$invalidatedAt"),
              isNullOrMissingExpr("$invalidationReason"),
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", JOB_INVITATION_STATUS.EXPIRED],
          },
          {
            $and: [
              isNullOrMissingExpr("$acceptedAt"),
              isNullOrMissingExpr("$rejectedAt"),
              isNullOrMissingExpr("$revokedAt"),
              isNullOrMissingExpr("$invalidatedAt"),
              isNullOrMissingExpr("$invalidationReason"),
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", JOB_INVITATION_STATUS.INVALIDATED],
          },
          {
            $and: [
              isDateExpr("$invalidatedAt"),
              {
                $in: [
                  "$invalidationReason",
                  JOB_INVITATION_INVALIDATION_REASON_VALUES,
                ],
              },
              isNullOrMissingExpr("$acceptedAt"),
              isNullOrMissingExpr("$rejectedAt"),
              isNullOrMissingExpr("$revokedAt"),
            ],
          },
        ],
      },
      {
        $or: [
          {
            $eq: ["$status", JOB_INVITATION_STATUS.INVALIDATED],
          },
          isNullOrMissingExpr("$invalidationReason"),
        ],
      },
    ],
  },
});

const jobInvitationSchema = new Schema(
  {
    candidateUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    invitedCvId: {
      type: Schema.Types.ObjectId,
      ref: "CandidateCV",
      required: true,
      immutable: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      immutable: true,
    },
    sentByRecruiterCompanyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMember",
      required: true,
      immutable: true,
    },
    invitedCvSnapshot: {
      type: submittedCvSnapshotSchema,
      required: true,
      immutable: true,
    },
    greetingMessage: {
      type: String,
      default: null,
      trim: true,
      immutable: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: JOB_INVITATION_STATUS_VALUES,
        message: "status must use canonical Job Invitation status values",
      },
      default: JOB_INVITATION_STATUS.PENDING,
    },
    sentAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    invalidatedAt: {
      type: Date,
      default: null,
    },
    invalidationReason: {
      type: String,
      default: null,
      enum: {
        values: [...JOB_INVITATION_INVALIDATION_REASON_VALUES, null],
        message:
          "invalidationReason must use canonical Job Invitation invalidation reasons",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "job_invitations",
    strict: true,
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

for (const field of IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS) {
  jobInvitationSchema.path(field).set(function captureIdentityAssignment(value) {
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

jobInvitationSchema.pre(
  "validate",
  function enforceJobInvitationLocalInvariants() {
    if (!this.isNew) {
      if (this.$locals.identityMutationAttempted) {
        const field = this.$locals.identityMutationAttempted;
        this.invalidate(
          field,
          `${field} is immutable after JobInvitation creation`,
        );
      }

      for (const field of IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS) {
        if (this.isModified(field)) {
          this.invalidate(
            field,
            `${field} is immutable after JobInvitation creation`,
          );
        }
      }
    }

    if (this.isNew && this.status !== JOB_INVITATION_STATUS.PENDING) {
      this.invalidate(
        "status",
        "JobInvitation creation must start with status=PENDING",
      );
    }

    const errors = assertJobInvitationLocalInvariants(this);

    if (errors.length > 0) {
      this.invalidate("status", errors[0]);
    }
  },
);

for (const method of ["updateOne", "updateMany", "findOneAndUpdate"]) {
  jobInvitationSchema.pre(method, function rejectIdentityMutation() {
    const update = this.getUpdate();

    if (Array.isArray(update)) {
      throw new Error(
        "JobInvitation model does not support aggregation pipeline updates",
      );
    }

    const mutatedIdentity = assertNoIdentityFieldMutation(
      update,
      IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS,
    );

    if (mutatedIdentity) {
      throw new Error(
        "JobInvitation identity fields are immutable after creation",
      );
    }
  });
}

for (const method of ["replaceOne", "findOneAndReplace"]) {
  jobInvitationSchema.pre(method, function rejectReplacementWrite() {
    throw new Error(
      "JobInvitation model does not support replacement writes; use updateOne with explicit field operators",
    );
  });
}

jobInvitationSchema.pre("bulkWrite", function rejectBulkWrite() {
  throw new Error(
    "JobInvitation model does not support bulkWrite; use updateOne with explicit field operators",
  );
});

jobInvitationSchema.index(
  { candidateUserId: 1, jobId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: JOB_INVITATION_STATUS.PENDING,
    },
  },
);
jobInvitationSchema.index({ candidateUserId: 1, jobId: 1, createdAt: -1 });
jobInvitationSchema.index({ candidateUserId: 1, createdAt: -1, _id: -1 });
jobInvitationSchema.index({ jobId: 1, createdAt: -1, _id: -1 });
jobInvitationSchema.index({ jobId: 1, status: 1 });
jobInvitationSchema.index({ candidateUserId: 1, status: 1 });
jobInvitationSchema.index({ sentByRecruiterCompanyMemberId: 1, status: 1 });
jobInvitationSchema.index({ invitedCvId: 1, status: 1 });
jobInvitationSchema.index({ status: 1, expiresAt: 1 });

const JobInvitation = model("JobInvitation", jobInvitationSchema);

const ensureJobInvitationCollectionInvariants = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring JobInvitation collection invariants",
    );
  }

  await JobInvitation.init();

  const collectionName = JobInvitation.collection.collectionName;
  const applyValidator = () =>
    connection.db.command({
      collMod: collectionName,
      validator: JOB_INVITATION_COLLECTION_VALIDATOR,
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
      validator: JOB_INVITATION_COLLECTION_VALIDATOR,
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
  IMMUTABLE_JOB_INVITATION_IDENTITY_FIELDS,
  JOB_INVITATION_COLLECTION_VALIDATOR,
  TERMINAL_JOB_INVITATION_STATUSES,
  assertJobInvitationLocalInvariants,
  ensureJobInvitationCollectionInvariants,
  jobInvitationSchema,
};

export default JobInvitation;
