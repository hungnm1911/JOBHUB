import mongoose from "mongoose";

import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";

const { Schema, model } = mongoose;

const NULL_LIFECYCLE_FIELDS = Object.freeze([
  "reviewSnapshot",
  "submittedAt",
  "reviewedByUserId",
  "reviewedAt",
  "activatedAt",
]);

const COMPANY_STATE_MATRIX = Object.freeze([
  {
    approvalStatus: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    present: Object.freeze([]),
    absent: NULL_LIFECYCLE_FIELDS,
  },
  {
    approvalStatus: COMPANY_APPROVAL_STATUS.PENDING,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    present: Object.freeze(["reviewSnapshot", "submittedAt"]),
    absent: Object.freeze([
      "reviewedByUserId",
      "reviewedAt",
      "activatedAt",
    ]),
  },
  {
    approvalStatus: COMPANY_APPROVAL_STATUS.REJECTED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    present: Object.freeze([
      "reviewSnapshot",
      "submittedAt",
      "reviewedByUserId",
      "reviewedAt",
    ]),
    absent: Object.freeze(["activatedAt"]),
  },
  {
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    present: Object.freeze([
      "reviewSnapshot",
      "submittedAt",
      "reviewedByUserId",
      "reviewedAt",
    ]),
    absent: Object.freeze(["activatedAt"]),
  },
  {
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
    present: NULL_LIFECYCLE_FIELDS,
    absent: Object.freeze([]),
  },
  {
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    present: NULL_LIFECYCLE_FIELDS,
    absent: Object.freeze([]),
  },
]);

const VALID_STATE_PAIRS = Object.freeze(
  new Set(
    COMPANY_STATE_MATRIX.map(
      (entry) => `${entry.approvalStatus}:${entry.operationalStatus}`,
    ),
  ),
);

const FIELD_BSON_TYPE_WHEN_PRESENT = Object.freeze({
  reviewSnapshot: "object",
  submittedAt: "date",
  reviewedByUserId: "objectId",
  reviewedAt: "date",
  activatedAt: "date",
});

const companyReviewSnapshotSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: null,
      trim: true,
    },
    bannerUrl: {
      type: String,
      default: null,
      trim: true,
    },
    website: {
      type: String,
      default: null,
      trim: true,
    },
    address: {
      type: String,
      default: null,
      trim: true,
    },
    description: {
      type: String,
      default: null,
      trim: true,
    },
    contactInfo: {
      type: String,
      default: null,
      trim: true,
    },
    businessRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

const assertNullField = (company, fieldName, errors) => {
  if (company[fieldName] != null) {
    errors.push(`${fieldName} must be null for the current Company state`);
  }
};

const assertPresentField = (company, fieldName, errors) => {
  if (company[fieldName] == null) {
    errors.push(`${fieldName} is required for the current Company state`);
  }
};

const assertCompanyStateInvariants = (company) => {
  const errors = [];
  const statePair = `${company.approvalStatus}:${company.operationalStatus}`;
  const matrixEntry = COMPANY_STATE_MATRIX.find(
    (entry) =>
      entry.approvalStatus === company.approvalStatus &&
      entry.operationalStatus === company.operationalStatus,
  );

  if (!matrixEntry) {
    errors.push(`Invalid Company state pair: ${statePair}`);
  } else {
    for (const fieldName of matrixEntry.present) {
      assertPresentField(company, fieldName, errors);
    }

    for (const fieldName of matrixEntry.absent) {
      assertNullField(company, fieldName, errors);
    }
  }

  if (
    company.submittedAt != null &&
    company.reviewedAt != null &&
    company.submittedAt > company.reviewedAt
  ) {
    errors.push("submittedAt must be less than or equal to reviewedAt");
  }

  if (
    company.reviewedAt != null &&
    company.activatedAt != null &&
    company.reviewedAt > company.activatedAt
  ) {
    errors.push("reviewedAt must be less than or equal to activatedAt");
  }

  return errors;
};

const buildStateMatrixOneOfClause = (entry) => {
  const properties = {
    approvalStatus: {
      enum: [entry.approvalStatus],
    },
    operationalStatus: {
      enum: [entry.operationalStatus],
    },
  };
  const required = ["approvalStatus", "operationalStatus"];

  for (const fieldName of entry.present) {
    properties[fieldName] = {
      bsonType: FIELD_BSON_TYPE_WHEN_PRESENT[fieldName],
    };
    required.push(fieldName);
  }

  for (const fieldName of entry.absent) {
    properties[fieldName] = {
      bsonType: ["null"],
    };
    required.push(fieldName);
  }

  if (entry.present.includes("reviewSnapshot")) {
    properties.reviewSnapshot = {
      bsonType: "object",
      required: ["name", "businessRegistrationNumber"],
      properties: {
        name: { bsonType: "string" },
        businessRegistrationNumber: { bsonType: "string" },
      },
    };
  }

  return {
    required,
    properties,
  };
};

const COMPANY_COLLECTION_VALIDATOR = Object.freeze({
  $and: [
    {
      $jsonSchema: {
        bsonType: "object",
        required: ["approvalStatus", "operationalStatus"],
        properties: {
          approvalStatus: {
            enum: Object.values(COMPANY_APPROVAL_STATUS),
          },
          operationalStatus: {
            enum: Object.values(COMPANY_OPERATIONAL_STATUS),
          },
        },
        oneOf: COMPANY_STATE_MATRIX.map(buildStateMatrixOneOfClause),
      },
    },
    {
      $expr: {
        $and: [
          {
            $or: [
              { $eq: [{ $ifNull: ["$submittedAt", null] }, null] },
              { $eq: [{ $ifNull: ["$reviewedAt", null] }, null] },
              { $lte: ["$submittedAt", "$reviewedAt"] },
            ],
          },
          {
            $or: [
              { $eq: [{ $ifNull: ["$reviewedAt", null] }, null] },
              { $eq: [{ $ifNull: ["$activatedAt", null] }, null] },
              { $lte: ["$reviewedAt", "$activatedAt"] },
            ],
          },
        ],
      },
    },
  ],
});

const companySchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      default: null,
    },

    logoUrl: {
      type: String,
      trim: true,
      default: null,
    },

    bannerUrl: {
      type: String,
      trim: true,
      default: null,
    },

    website: {
      type: String,
      trim: true,
      default: null,
    },

    address: {
      type: String,
      trim: true,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      default: null,
    },

    contactInfo: {
      type: String,
      trim: true,
      default: null,
    },

    businessRegistrationNumber: {
      type: String,
      trim: true,
      default: null,
    },

    reviewSnapshot: {
      type: companyReviewSnapshotSchema,
      default: null,
    },

    approvalStatus: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_APPROVAL_STATUS),
      default: COMPANY_APPROVAL_STATUS.NOT_SUBMITTED,
    },

    operationalStatus: {
      type: String,
      required: true,
      enum: Object.values(COMPANY_OPERATIONAL_STATUS),
      default: COMPANY_OPERATIONAL_STATUS.INACTIVE,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    reviewedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    activatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

companySchema.pre("validate", function validateCompanyState() {
  const errors = assertCompanyStateInvariants(this);

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
});

companySchema.index(
  { businessRegistrationNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      businessRegistrationNumber: { $type: "string" },
    },
  },
);
companySchema.index({ approvalStatus: 1 });

const Company = model("Company", companySchema);

const ensureCompanyCollectionInvariants = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring Company collection invariants",
    );
  }

  const collectionName = Company.collection.collectionName;
  const applyValidator = () =>
    connection.db.command({
      collMod: collectionName,
      validator: COMPANY_COLLECTION_VALIDATOR,
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
      validator: COMPANY_COLLECTION_VALIDATOR,
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

export { ensureCompanyCollectionInvariants, VALID_STATE_PAIRS };
export default Company;
