import { z } from "zod";

import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import LOCATION from "../constants/location.js";
import WORK_MODE from "../constants/work-mode.js";
import AppError from "../utils/app-error.js";

const optionalNonEmptyString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  });

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const createDraftJobSchema = z
  .object({
    title: optionalNonEmptyString,
    jobDescription: optionalNonEmptyString,
    requiredSkills: z.array(z.string().trim().min(1)).optional(),
    salaryText: optionalNonEmptyString,
    fieldCategoryIds: z.array(objectIdString).optional(),
    positionCategoryIds: z.array(objectIdString).optional(),
    location: z
      .enum(Object.values(LOCATION))
      .nullable()
      .optional(),
    employmentType: z
      .enum(Object.values(EMPLOYMENT_TYPE))
      .nullable()
      .optional(),
    workModes: z.array(z.enum(Object.values(WORK_MODE))).optional(),
    experienceLevelId: objectIdString.nullable().optional(),
    applicationDeadline: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

const validateCreateDraftJob = (request, _response, next) => {
  const parsed = createDraftJobSchema.safeParse(request.body ?? {});

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

export default validateCreateDraftJob;
