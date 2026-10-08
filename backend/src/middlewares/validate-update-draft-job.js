import { z } from "zod";

import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import WORK_MODE from "../constants/work-mode.js";
import AppError from "../utils/app-error.js";

const optionalNullableTrimmedString = z.union([
  z
    .string()
    .trim()
    .min(1, "Value must be a non-empty string when provided"),
  z.null(),
]);

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const jobLocationInput = z
  .object({
    provinceCode: z.string().nullable().optional(),
    districtCode: z.string().nullable().optional(),
  })
  .strict();

const jobSalaryInput = z
  .object({
    type: z.string(),
    minAmount: z.number().nullable().optional(),
    maxAmount: z.number().nullable().optional(),
    period: z.string().nullable().optional(),
    customPeriodLabel: z.string().nullable().optional(),
  })
  .strict();

const updateDraftJobSchema = z
  .object({
    title: optionalNullableTrimmedString.optional(),
    jobDescription: optionalNullableTrimmedString.optional(),
    requiredSkills: z.array(z.string().trim().min(1)).optional(),
    salary: jobSalaryInput.nullable().optional(),
    fieldCategoryIds: z.array(objectIdString).optional(),
    positionCategoryIds: z.array(objectIdString).optional(),
    location: jobLocationInput.nullable().optional(),
    employmentType: z
      .enum(Object.values(EMPLOYMENT_TYPE))
      .nullable()
      .optional(),
    workModes: z.array(z.enum(Object.values(WORK_MODE))).optional(),
    experienceLevelId: objectIdString.nullable().optional(),
    applicationDeadline: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

const validateUpdateDraftJob = (request, _response, next) => {
  const parsed = updateDraftJobSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || undefined,
      }),
    );
  }

  request.body = parsed.data;

  return next();
};

export default validateUpdateDraftJob;
