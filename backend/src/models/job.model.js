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

// Data V4.2 §5.3: the only fields of an embedded Structured Salary.
const SALARY_FIELDS = Object.freeze([
  "type",
  "minAmount",
  "maxAmount",
  "period",
  "customPeriodLabel",
]);

// MongoDB's default `$trim` set differs from `String.prototype.trim`, so the
// collection validator trims exactly the characters the Salary helper trims.
const TRIM_WHITESPACE_CHARACTERS = Array.from({ length: 0x10000 }, (_, code) =>
  String.fromCharCode(code),
)
  .filter((character) => character.trim() === "")
  .join("");

const SALARY_AMOUNT_JSON_SCHEMA = Object.freeze({
  bsonType: ["int", "long", "double", "null"],
  multipleOf: 1,
  minimum: Number.MIN_SAFE_INTEGER,
  maximum: Number.MAX_SAFE_INTEGER,
});

const salaryAmountsMatch = (minAmountFilter, maxAmountFilter) => ({
  "salary.minAmount": minAmountFilter,
  "salary.maxAmount": maxAmountFilter,
});

// Database-level guard for query-write paths where document-context validators
// do not see the merged final team state (Data Contract 10.1), plus the V4.2
// rules that every Job persists `salary` as `null` or a complete canonical
// Structured Salary (Data V4.2 §5.2, §5.3, §7.2, §10.1, §16) and that a Job
// outside DRAFT persists one (§7.1). It must accept exactly what
// `getJobSalaryInvariantErrors` accepts.
// Only the `v42-legacy-salary-cutover` migration applies this validator, after
// zero-legacy verification; runtime startup only verifies that it is active.
const JOB_COLLECTION_VALIDATOR = Object.freeze({
  $and: [
    {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "primaryRecruiterCompanyMemberId",
          "supportingRecruiterCompanyMemberIds",
          "salary",
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
          salary: {
            bsonType: ["object", "null"],
            required: [...SALARY_FIELDS],
            additionalProperties: false,
            properties: {
              type: { enum: SALARY_TYPE_VALUES },
              minAmount: SALARY_AMOUNT_JSON_SCHEMA,
              maxAmount: SALARY_AMOUNT_JSON_SCHEMA,
              period: { enum: [...SALARY_PERIOD_VALUES, null] },
              customPeriodLabel: { bsonType: ["string", "null"] },
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
      $or: [
        { salary: null },
        {
          "salary.type": SALARY_TYPE.NEGOTIABLE,
          ...salaryAmountsMatch(null, null),
          "salary.period": null,
          "salary.customPeriodLabel": null,
        },
        {
          $and: [
            {
              $or: [
                {
                  "salary.type": SALARY_TYPE.FIXED,
                  ...salaryAmountsMatch({ $ne: null }, { $ne: null }),
                  $expr: {
                    $eq: ["$salary.minAmount", "$salary.maxAmount"],
                  },
                },
                {
                  "salary.type": SALARY_TYPE.RANGE,
                  ...salaryAmountsMatch({ $ne: null }, { $ne: null }),
                  $expr: {
                    $lte: ["$salary.minAmount", "$salary.maxAmount"],
                  },
                },
                {
                  "salary.type": SALARY_TYPE.FROM,
                  ...salaryAmountsMatch({ $ne: null }, null),
                },
                {
                  "salary.type": SALARY_TYPE.UP_TO,
                  ...salaryAmountsMatch(null, { $ne: null }),
                },
              ],
            },
            {
              $or: [
                {
                  "salary.period": SALARY_PERIOD.ETC,
                  $expr: {
                    $cond: [
                      {
                        $eq: [
                          { $type: "$salary.customPeriodLabel" },
                          "string",
                        ],
                      },
                      {
                        $ne: [
                          {
                            $trim: {
                              input: "$salary.customPeriodLabel",
                              chars: TRIM_WHITESPACE_CHARACTERS,
                            },
                          },
                          "",
                        ],
                      },
                      false,
                    ],
                  },
                },
                {
                  "salary.period": {
                    $in: SALARY_PERIOD_VALUES.filter(
                      (period) => period !== SALARY_PERIOD.ETC,
                    ),
                  },
                  "salary.customPeriodLabel": null,
                },
              ],
            },
          ],
        },
      ],
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

// V4.2 Structured Salary shape and type/amount/period matrix (Data §5.3, §5.6,
// §7.2). Amounts are VND integers; no currency is persisted. Shared by schema
// validation and the Job service so both enforce one local invariant.
const getJobSalaryInvariantErrors = (salary) => {
  if (salary == null) {
    return [];
  }

  if (typeof salary !== "object" || Array.isArray(salary)) {
    return ["salary must be a Structured Salary"];
  }

  // Own keys of a Mongoose subdocument are internals, not Salary fields.
  const fields = Object.keys(
    typeof salary.toObject === "function" ? salary.toObject() : salary,
  );
  // Data §5.3, §9.1: non-applicable fields persist as `null`, never absent.
  const errors = [
    ...fields
      .filter((field) => !SALARY_FIELDS.includes(field))
      .map((field) => `salary.${field} is not a Structured Salary field`),
    ...SALARY_FIELDS.filter((field) => !fields.includes(field)).map(
      (field) => `salary.${field} is required`,
    ),
  ];

  const { type, minAmount, maxAmount, period, customPeriodLabel } = salary;

  if (!SALARY_TYPE_VALUES.includes(type)) {
    return [...errors, "salary.type must be a canonical SalaryType value"];
  }

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
jobSchema.index(
  {
    status: 1,
    "salary.period": 1,
    "salary.type": 1,
    "salary.minAmount": 1,
    "salary.maxAmount": 1,
  },
  { name: "job_discovery_salary_range_idx" },
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

const JOB_COLLECTION_VALIDATION_OPTIONS = Object.freeze({
  validator: JOB_COLLECTION_VALIDATOR,
  validationLevel: "strict",
  validationAction: "error",
});

const V42_CUTOVER_INSTRUCTIONS =
  "run `node scripts/run-migration.js v42-legacy-salary-cutover --preflight`, " +
  "remediate any reported Job, then run " +
  "`node scripts/run-migration.js v42-legacy-salary-cutover`";

// Read-only: whether the `jobs` collection enforces exactly the current
// JOB_COLLECTION_VALIDATOR.
const isJobCollectionValidatorActive = async (
  connection = mongoose.connection,
) => {
  const [collectionInfo] = await connection.db
    .listCollections({ name: Job.collection.collectionName })
    .toArray();
  const options = collectionInfo?.options ?? {};

  return (
    options.validationLevel ===
      JOB_COLLECTION_VALIDATION_OPTIONS.validationLevel &&
    options.validationAction ===
      JOB_COLLECTION_VALIDATION_OPTIONS.validationAction &&
    JSON.stringify(options.validator) ===
      JSON.stringify(JOB_COLLECTION_VALIDATOR)
  );
};

// Startup fails closed instead of applying the validator: activation over
// data that was never cut over would freeze legacy Salary records in place.
const assertJobCollectionInvariantsActive = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before verifying Job collection invariants",
    );
  }

  await Job.init();

  if (!(await isJobCollectionValidatorActive(connection))) {
    throw new Error(
      `Job collection validator is missing or stale (V4.2 strict Salary guard inactive); ${V42_CUTOVER_INSTRUCTIONS}`,
    );
  }

  const unready = await Job.collection.findOne(
    {
      $or: [
        { salaryText: { $exists: true } },
        { $nor: [JOB_COLLECTION_VALIDATOR] },
      ],
    },
    { projection: { _id: 1 } },
  );

  if (unready) {
    throw new Error(
      `jobs/${unready._id} is not cut over to the V4.2 Salary contract; ${V42_CUTOVER_INSTRUCTIONS}`,
    );
  }
};

export {
  assertJobCollectionInvariantsActive,
  assertJobRecruitmentTeamInvariants,
  getJobSalaryInvariantErrors,
  isJobCollectionValidatorActive,
  isNotForbiddenLocationProvinceCode,
  JOB_COLLECTION_VALIDATION_OPTIONS,
  JOB_COLLECTION_VALIDATOR,
  SALARY_FIELDS,
};
export default Job;
