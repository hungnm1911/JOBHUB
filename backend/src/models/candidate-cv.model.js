import mongoose from "mongoose";

import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../constants/candidate-cv-visibility.js";
import CV_LANGUAGE_PROFICIENCY from "../constants/cv-language-proficiency.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import HARVARD_CV_SECTION from "../constants/harvard-cv-section.js";
import LOCATION from "../constants/location.js";
import WORK_MODE from "../constants/work-mode.js";

const { Schema, model } = mongoose;

const LOCATION_VALUES = Object.values(LOCATION);
const EMPLOYMENT_TYPE_VALUES = Object.values(EMPLOYMENT_TYPE);
const WORK_MODE_VALUES = Object.values(WORK_MODE);
const LANGUAGE_PROFICIENCY_VALUES = Object.values(CV_LANGUAGE_PROFICIENCY);
const HARVARD_CV_SECTION_VALUES = Object.values(HARVARD_CV_SECTION);

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const hasDistinctStrings = (values) => {
  if (!Array.isArray(values)) {
    return false;
  }

  return new Set(values).size === values.length;
};

const hasPresentSubdocument = (value) => {
  return value != null && typeof value === "object";
};

const cvPersonalInfoSchema = new Schema(
  {
    fullName: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    displayLocation: {
      type: String,
      trim: true,
      default: null,
    },
    links: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const cvEducationSchema = new Schema(
  {
    institutionName: {
      type: String,
      trim: true,
      default: null,
    },
    degree: {
      type: String,
      trim: true,
      default: null,
    },
    fieldOfStudy: {
      type: String,
      trim: true,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const cvWorkExperienceSchema = new Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: null,
    },
    position: {
      type: String,
      trim: true,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    achievements: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const cvProjectSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      default: null,
    },
    role: {
      type: String,
      trim: true,
      default: null,
    },
    technologies: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    projectUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const cvCertificationSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      default: null,
    },
    issuer: {
      type: String,
      trim: true,
      default: null,
    },
    issueDate: {
      type: Date,
      default: null,
    },
    expirationDate: {
      type: Date,
      default: null,
    },
    credentialId: {
      type: String,
      trim: true,
      default: null,
    },
    credentialUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const cvLanguageSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      default: null,
    },
    proficiency: {
      type: String,
      enum: {
        values: [...LANGUAGE_PROFICIENCY_VALUES, null],
        message: "Language proficiency must use the canonical proficiency enum",
      },
      default: null,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const generatedCvContentSchema = new Schema(
  {
    personalInfo: {
      type: cvPersonalInfoSchema,
      default: () => ({}),
    },
    professionalSummary: {
      type: String,
      trim: true,
      default: null,
    },
    educations: {
      type: [cvEducationSchema],
      default: [],
    },
    skills: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    workExperiences: {
      type: [cvWorkExperienceSchema],
      default: [],
    },
    projects: {
      type: [cvProjectSchema],
      default: [],
    },
    certifications: {
      type: [cvCertificationSchema],
      default: [],
    },
    languages: {
      type: [cvLanguageSchema],
      default: [],
    },
    hiddenSections: {
      type: [
        {
          type: String,
          trim: true,
          enum: {
            values: HARVARD_CV_SECTION_VALUES,
            message:
              "hiddenSections members must use the canonical Harvard section vocabulary",
          },
        },
      ],
      default: [],
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const uploadedCvFileSchema = new Schema(
  {
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    pageCount: {
      type: Number,
      required: true,
      min: 1,
    },
    uploadedAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const assertCandidateCvLocalInvariants = (candidateCv) => {
  const errors = [];
  const hasGeneratedContent = hasPresentSubdocument(candidateCv.generatedContent);
  const hasUploadedFile = hasPresentSubdocument(candidateCv.uploadedFile);

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    if (!hasGeneratedContent) {
      errors.push("GENERATED CandidateCV must have generatedContent");
    }

    if (hasUploadedFile) {
      errors.push("GENERATED CandidateCV must not have uploadedFile");
    }
  }

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    if (candidateCv.status === CANDIDATE_CV_STATUS.DRAFT) {
      errors.push("UPLOADED CandidateCV must not have status DRAFT");
    }

    if (!hasUploadedFile) {
      errors.push("UPLOADED CandidateCV must have uploadedFile");
    }

    if (hasGeneratedContent) {
      errors.push("UPLOADED CandidateCV must not have generatedContent");
    }
  }

  if (candidateCv.status === CANDIDATE_CV_STATUS.DRAFT && candidateCv.isDefault) {
    errors.push("DRAFT CandidateCV must not be Default");
  }

  if (candidateCv.archivedAt != null && candidateCv.isDefault) {
    errors.push("Archived CandidateCV must not be Default");
  }

  if (
    candidateCv.isDefault &&
    candidateCv.status !== CANDIDATE_CV_STATUS.ACTIVE
  ) {
    errors.push("Default CandidateCV must have status ACTIVE");
  }

  if (candidateCv.isDefault && candidateCv.archivedAt != null) {
    errors.push("Default CandidateCV must not be archived");
  }

  return errors;
};

// Database-level guard for query-write paths where document `pre("validate")`
// does not run (Data V7 §11.1 schema/local validation ownership).
const CANDIDATE_CV_COLLECTION_VALIDATOR = Object.freeze({
  $expr: {
    $and: [
      {
        $or: [
          {
            $ne: ["$sourceType", CANDIDATE_CV_SOURCE_TYPE.UPLOADED],
          },
          {
            $ne: ["$status", CANDIDATE_CV_STATUS.DRAFT],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$sourceType", CANDIDATE_CV_SOURCE_TYPE.GENERATED],
          },
          {
            $and: [
              {
                $ne: [{ $ifNull: ["$generatedContent", null] }, null],
              },
              {
                $eq: [{ $type: "$generatedContent" }, "object"],
              },
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$sourceType", CANDIDATE_CV_SOURCE_TYPE.GENERATED],
          },
          {
            $eq: [{ $ifNull: ["$uploadedFile", null] }, null],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$sourceType", CANDIDATE_CV_SOURCE_TYPE.UPLOADED],
          },
          {
            $and: [
              {
                $ne: [{ $ifNull: ["$uploadedFile", null] }, null],
              },
              {
                $eq: [{ $type: "$uploadedFile" }, "object"],
              },
            ],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$sourceType", CANDIDATE_CV_SOURCE_TYPE.UPLOADED],
          },
          {
            $eq: [{ $ifNull: ["$generatedContent", null] }, null],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$status", CANDIDATE_CV_STATUS.DRAFT],
          },
          {
            $ne: ["$isDefault", true],
          },
        ],
      },
      {
        $or: [
          {
            $eq: [{ $ifNull: ["$archivedAt", null] }, null],
          },
          {
            $ne: ["$isDefault", true],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$isDefault", true],
          },
          {
            $eq: ["$status", CANDIDATE_CV_STATUS.ACTIVE],
          },
        ],
      },
      {
        $or: [
          {
            $ne: ["$isDefault", true],
          },
          {
            $eq: [{ $ifNull: ["$archivedAt", null] }, null],
          },
        ],
      },
    ],
  },
});

const candidateCvSchema = new Schema(
  {
    candidateUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return isNonEmptyTrimmedString(value);
        },
        message: "CandidateCV name is required",
      },
    },

    sourceType: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_CV_SOURCE_TYPE),
      immutable: true,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_CV_STATUS),
    },

    visibility: {
      type: String,
      required: true,
      enum: Object.values(CANDIDATE_CV_VISIBILITY),
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    experienceLevelId: {
      type: Schema.Types.ObjectId,
      ref: "ExperienceLevel",
      default: null,
    },

    preferredLocations: {
      type: [
        {
          type: String,
          enum: {
            values: LOCATION_VALUES,
            message: "preferredLocations must use canonical Location values",
          },
        },
      ],
      default: [],
      validate: {
        validator: hasDistinctStrings,
        message: "preferredLocations must not contain duplicates",
      },
    },

    skillTags: {
      type: [
        {
          type: String,
          trim: true,
          validate: {
            validator(value) {
              return isNonEmptyTrimmedString(value);
            },
            message: "Each skill tag must be a non-empty string",
          },
        },
      ],
      default: [],
    },

    employmentTypes: {
      type: [
        {
          type: String,
          enum: {
            values: EMPLOYMENT_TYPE_VALUES,
            message:
              "employmentTypes must use canonical EmploymentType values",
          },
        },
      ],
      default: [],
      validate: {
        validator: hasDistinctStrings,
        message: "employmentTypes must not contain duplicates",
      },
    },

    workModes: {
      type: [
        {
          type: String,
          enum: {
            values: WORK_MODE_VALUES,
            message: "workModes must use canonical WorkMode values",
          },
        },
      ],
      default: [],
      validate: {
        validator: hasDistinctStrings,
        message: "workModes must not contain duplicates",
      },
    },

    isDefault: {
      type: Boolean,
      required: true,
      default: false,
    },

    generatedContent: {
      type: generatedCvContentSchema,
      required: false,
      default: undefined,
    },

    uploadedFile: {
      type: uploadedCvFileSchema,
      required: false,
      default: undefined,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "candidate_cvs",
  },
);

candidateCvSchema.pre("validate", function enforceCandidateCvLocalInvariants() {
  const errors = assertCandidateCvLocalInvariants(this);

  if (errors.length > 0) {
    this.invalidate("sourceType", errors[0]);
  }
});

candidateCvSchema.index({ candidateUserId: 1, archivedAt: 1 });
candidateCvSchema.index(
  { candidateUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDefault: true,
      archivedAt: null,
    },
  },
);

const CandidateCV = model("CandidateCV", candidateCvSchema);

const ensureCandidateCvCollectionInvariants = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring CandidateCV collection invariants",
    );
  }

  await CandidateCV.init();

  const collectionName = CandidateCV.collection.collectionName;
  const applyValidator = () =>
    connection.db.command({
      collMod: collectionName,
      validator: CANDIDATE_CV_COLLECTION_VALIDATOR,
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
      validator: CANDIDATE_CV_COLLECTION_VALIDATOR,
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
  assertCandidateCvLocalInvariants,
  candidateCvSchema,
  ensureCandidateCvCollectionInvariants,
};

export default CandidateCV;
