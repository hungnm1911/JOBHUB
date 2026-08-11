import mongoose from "mongoose";

import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import JOB_STATUS from "../constants/job-status.js";
import LOCATION from "../constants/location.js";
import WORK_MODE from "../constants/work-mode.js";

const { Schema, model } = mongoose;

const LOCATION_VALUES = Object.values(LOCATION);
const EMPLOYMENT_TYPE_VALUES = Object.values(EMPLOYMENT_TYPE);
const WORK_MODE_VALUES = Object.values(WORK_MODE);

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const hasDistinctObjectIds = (values) => {
  if (!Array.isArray(values)) {
    return false;
  }

  const seen = new Set();

  for (const value of values) {
    const key = value?.toString();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
  }

  return true;
};

const hasDistinctStrings = (values) => {
  if (!Array.isArray(values)) {
    return false;
  }

  return new Set(values).size === values.length;
};

const jobSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      immutable: true,
    },

    createdByCompanyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMember",
      required: true,
      immutable: true,
    },

    primaryRecruiterCompanyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMember",
      required: true,
    },

    supportingRecruiterCompanyMemberIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "CompanyMember",
        },
      ],
      default: [],
      validate: [
        {
          validator: hasDistinctObjectIds,
          message:
            "supportingRecruiterCompanyMemberIds must not contain duplicates",
        },
        {
          validator(values) {
            if (!Array.isArray(values) || values.length === 0) {
              return true;
            }

            const primaryId = this.primaryRecruiterCompanyMemberId;

            if (primaryId == null) {
              return true;
            }

            const primaryKey = primaryId.toString();

            return values.every(
              (value) => value?.toString() !== primaryKey,
            );
          },
          message:
            "Primary Recruiter must not appear in supportingRecruiterCompanyMemberIds",
        },
      ],
    },

    title: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator(value) {
          return value == null || isNonEmptyTrimmedString(value);
        },
        message: "Job title must be a non-empty string when provided",
      },
    },

    jobDescription: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator(value) {
          return value == null || isNonEmptyTrimmedString(value);
        },
        message: "Job description must be a non-empty string when provided",
      },
    },

    requiredSkills: {
      type: [
        {
          type: String,
          trim: true,
          validate: {
            validator(value) {
              return isNonEmptyTrimmedString(value);
            },
            message: "Each required skill must be a non-empty string",
          },
        },
      ],
      default: [],
    },

    salaryText: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator(value) {
          return value == null || isNonEmptyTrimmedString(value);
        },
        message: "Salary text must be a non-empty string when provided",
      },
    },

    fieldCategoryIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      default: [],
      validate: {
        validator: hasDistinctObjectIds,
        message: "fieldCategoryIds must not contain duplicates",
      },
    },

    positionCategoryIds: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Category",
        },
      ],
      default: [],
      validate: {
        validator: hasDistinctObjectIds,
        message: "positionCategoryIds must not contain duplicates",
      },
    },

    location: {
      type: String,
      default: null,
      enum: {
        values: [...LOCATION_VALUES, null],
        message: "location must be a canonical Location value when provided",
      },
    },

    employmentType: {
      type: String,
      default: null,
      enum: {
        values: [...EMPLOYMENT_TYPE_VALUES, null],
        message:
          "employmentType must be a canonical EmploymentType value when provided",
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

    experienceLevelId: {
      type: Schema.Types.ObjectId,
      ref: "ExperienceLevel",
      default: null,
    },

    applicationDeadline: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.DRAFT,
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "jobs",
  },
);

jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({
  companyId: 1,
  primaryRecruiterCompanyMemberId: 1,
  status: 1,
});
jobSchema.index({
  primaryRecruiterCompanyMemberId: 1,
  status: 1,
  applicationDeadline: 1,
});
jobSchema.index({
  supportingRecruiterCompanyMemberIds: 1,
  status: 1,
  applicationDeadline: 1,
});

const Job = model("Job", jobSchema);

export default Job;
