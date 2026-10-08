import mongoose from "mongoose";

import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import JOB_STATUS from "../constants/job-status.js";
import SALARY_PERIOD from "../constants/salary-period.js";
import SALARY_TYPE from "../constants/salary-type.js";
import WORK_MODE from "../constants/work-mode.js";

const { Schema, model } = mongoose;

const EMPLOYMENT_TYPE_VALUES = Object.values(EMPLOYMENT_TYPE);
const WORK_MODE_VALUES = Object.values(WORK_MODE);
const SALARY_TYPE_VALUES = Object.values(SALARY_TYPE);
const SALARY_PERIOD_VALUES = Object.values(SALARY_PERIOD);

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const isNonEmptyString = (value) => {
  return typeof value === "string" && value !== "";
};

// Data V4.1 §10.1: `FOREIGN` is a forbidden legacy representation owned by
// local schema validation; catalog existence stays with the semantic boundary.
const isNotForbiddenLocationProvinceCode = (value) => {
  return value !== "FOREIGN";
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

const assertJobRecruitmentTeamInvariants = (job) => {
  const errors = [];
  const supporting = job?.supportingRecruiterCompanyMemberIds;

  if (supporting == null) {
    errors.push("supportingRecruiterCompanyMemberIds is required");
  } else if (!Array.isArray(supporting)) {
    errors.push("supportingRecruiterCompanyMemberIds must be an array");
  } else {
    if (!hasDistinctObjectIds(supporting)) {
      errors.push(
        "supportingRecruiterCompanyMemberIds must not contain duplicates",
      );
    }

    const primaryId = job.primaryRecruiterCompanyMemberId;

    if (primaryId != null && supporting.length > 0) {
      const primaryKey = primaryId.toString();

      if (supporting.some((value) => value?.toString() === primaryKey)) {
        errors.push(
          "Primary Recruiter must not appear in supportingRecruiterCompanyMemberIds",
        );
      }
    }
  }

  return errors;
};

// Database-level guard for query-write paths where document-context validators
// do not see the merged final team state (Data Contract 10.1), plus the V4.2
// rule that a Job outside DRAFT persists a Structured Salary (Data V4.2 §7.1,
// §10.1). The `v42-legacy-salary-cutover` migration must complete before this
// validator is applied to a database that still holds legacy Salary records.
const JOB_COLLECTION_VALIDATOR = Object.freeze({
  $and: [
    {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "primaryRecruiterCompanyMemberId",
          "supportingRecruiterCompanyMemberIds",
        ],
        properties: {
          primaryRecruiterCompanyMemberId: {
            bsonType: "objectId",
          },
          supportingRecruiterCompanyMemberIds: {
            bsonType: "array",
            items: {
              bsonType: "objectId",
            },
          },
        },
      },
    },
    {
      $expr: {
        $eq: [
          { $size: "$supportingRecruiterCompanyMemberIds" },
          {
            $size: {
              $setUnion: ["$supportingRecruiterCompanyMemberIds"],
            },
          },
        ],
      },
    },
    {
      $expr: {
        $not: {
          $in: [
            "$primaryRecruiterCompanyMemberId",
            "$supportingRecruiterCompanyMemberIds",
          ],
        },
      },
    },
    {
      $or: [{ status: JOB_STATUS.DRAFT }, { salary: { $type: "object" } }],
    },
  ],
});

// V4.1 JobLocation: opaque Province Open API v1 codes. Existence and
// District → Province membership belong to the semantic Location boundary.
const jobLocationSchema = new Schema(
  {
    provinceCode: {
      type: String,
      required: true,
      validate: [
        {
          validator: isNonEmptyString,
          message: "location.provinceCode must be a non-empty string",
        },
        {
          validator: isNotForbiddenLocationProvinceCode,
          message: "location.provinceCode must not be FOREIGN",
        },
      ],
    },

    districtCode: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          return value == null || isNonEmptyString(value);
        },
        message:
          "location.districtCode must be a non-empty string when provided",
      },
    },
  },
  {
    _id: false,
  },
);

// V4.2 Structured Salary type/amount/period matrix (Data §5.6, §7.2). Amounts
// are VND integers; no currency is persisted. Shared by schema validation and
// the Job service so both enforce one local invariant.
const getJobSalaryInvariantErrors = (salary) => {
  if (salary == null) {
    return [];
  }

  if (typeof salary !== "object" || Array.isArray(salary)) {
    return ["salary must be a Structured Salary"];
  }

  const { type, minAmount, maxAmount, period, customPeriodLabel } = salary;

  if (!SALARY_TYPE_VALUES.includes(type)) {
    return ["salary.type must be a canonical SalaryType value"];
  }

  const errors = [];

  for (const [field, amount] of [
    ["minAmount", minAmount],
    ["maxAmount", maxAmount],
  ]) {
    if (amount != null && !Number.isSafeInteger(amount)) {
      errors.push(`salary.${field} must be an integer VND amount`);
    }
  }

  if (type === SALARY_TYPE.NEGOTIABLE) {
    if (minAmount != null || maxAmount != null) {
      errors.push("NEGOTIABLE salary must not have amounts");
    }

    if (period != null) {
      errors.push("NEGOTIABLE salary must not have a period");
    }

    if (customPeriodLabel != null) {
      errors.push("NEGOTIABLE salary must not have a customPeriodLabel");
    }

    return errors;
  }

  switch (type) {
    case SALARY_TYPE.FIXED:
      if (minAmount == null || maxAmount == null || minAmount !== maxAmount) {
        errors.push("FIXED salary requires equal minAmount and maxAmount");
      }
      break;
    case SALARY_TYPE.RANGE:
      if (minAmount == null || maxAmount == null) {
        errors.push("RANGE salary requires minAmount and maxAmount");
      } else if (minAmount > maxAmount) {
        errors.push("RANGE salary minAmount must not exceed maxAmount");
      }
      break;
    case SALARY_TYPE.FROM:
      if (minAmount == null || maxAmount != null) {
        errors.push("FROM salary requires only minAmount");
      }
      break;
    case SALARY_TYPE.UP_TO:
      if (minAmount != null || maxAmount == null) {
        errors.push("UP_TO salary requires only maxAmount");
      }
      break;
    default:
      break;
  }

  if (period == null) {
    errors.push("Numeric salary requires a period");
  } else if (!SALARY_PERIOD_VALUES.includes(period)) {
    errors.push("salary.period must be a canonical SalaryPeriod value");
  } else if (period === SALARY_PERIOD.ETC) {
    if (!isNonEmptyTrimmedString(customPeriodLabel)) {
      errors.push("ETC salary period requires a non-empty customPeriodLabel");
    }
  } else if (customPeriodLabel != null) {
    errors.push("customPeriodLabel is only allowed for ETC salary period");
  }

  return errors;
};

const jobSalarySchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: {
        values: SALARY_TYPE_VALUES,
        message: "salary.type must be a canonical SalaryType value",
      },
    },

    minAmount: {
      type: Number,
      default: null,
    },

    maxAmount: {
      type: Number,
      default: null,
    },

    period: {
      type: String,
      default: null,
      enum: {
        values: [...SALARY_PERIOD_VALUES, null],
        message: "salary.period must be a canonical SalaryPeriod value",
      },
    },

    customPeriodLabel: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

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
      required: true,
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

    salary: {
      type: jobSalarySchema,
      default: null,
      validate: {
        validator(value) {
          return getJobSalaryInvariantErrors(value).length === 0;
        },
        message(props) {
          return getJobSalaryInvariantErrors(props.value).join("; ");
        },
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
      type: jobLocationSchema,
      default: null,
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
});
jobSchema.index({
  companyId: 1,
  supportingRecruiterCompanyMemberIds: 1,
});
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
jobSchema.index(
  { status: 1, publishedAt: -1 },
  { name: "job_discovery_newest_idx" },
);
jobSchema.index(
  { status: 1, applicationDeadline: 1 },
  { name: "job_discovery_expiring_idx" },
);
jobSchema.index(
  { status: 1, fieldCategoryIds: 1, applicationDeadline: 1 },
  { name: "job_discovery_field_category_idx" },
);
jobSchema.index(
  { status: 1, positionCategoryIds: 1, applicationDeadline: 1 },
  { name: "job_discovery_position_category_idx" },
);
jobSchema.index(
  { status: 1, "location.provinceCode": 1, applicationDeadline: 1 },
  { name: "job_discovery_location_province_idx" },
);
jobSchema.index(
  {
    status: 1,
    "location.provinceCode": 1,
    "location.districtCode": 1,
    applicationDeadline: 1,
  },
  { name: "job_discovery_location_district_idx" },
);
jobSchema.index(
  { status: 1, employmentType: 1, applicationDeadline: 1 },
  { name: "job_discovery_employment_type_idx" },
);
jobSchema.index(
  { status: 1, experienceLevelId: 1, applicationDeadline: 1 },
  { name: "job_discovery_experience_idx" },
);
jobSchema.index(
  { status: 1, workModes: 1, applicationDeadline: 1 },
  { name: "job_discovery_work_mode_idx" },
);

jobSchema.pre("validate", function validateJobRecruitmentTeam() {
  const errors = assertJobRecruitmentTeamInvariants(this);

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
});

jobSchema.pre("validate", function validateJobSalaryDeclaration() {
  if (this.status !== JOB_STATUS.DRAFT && this.salary == null) {
    throw new Error("A Job outside DRAFT requires a Structured Salary");
  }
});

const Job = model("Job", jobSchema);

const ensureJobCollectionInvariants = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring Job collection invariants",
    );
  }

  await Job.init();

  const collectionName = Job.collection.collectionName;
  const applyValidator = () =>
    connection.db.command({
      collMod: collectionName,
      validator: JOB_COLLECTION_VALIDATOR,
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
      validator: JOB_COLLECTION_VALIDATOR,
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
  assertJobRecruitmentTeamInvariants,
  ensureJobCollectionInvariants,
  getJobSalaryInvariantErrors,
  isNotForbiddenLocationProvinceCode,
  JOB_COLLECTION_VALIDATOR,
};
export default Job;
