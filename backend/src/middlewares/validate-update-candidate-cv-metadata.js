import { z } from "zod";

import CANDIDATE_CV_VISIBILITY from "../constants/candidate-cv-visibility.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import LOCATION from "../constants/location.js";
import WORK_MODE from "../constants/work-mode.js";
import AppError from "../utils/app-error.js";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const uniqueEnumArray = (values, fieldLabel) => {
  return z.array(z.enum(values)).superRefine((items, context) => {
    if (new Set(items).size !== items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldLabel} must not contain duplicates`,
      });
    }
  });
};

// F07 partial patch — only canonical common metadata; lifecycle/content/ownership
// overrides are rejected by .strict().
const updateCandidateCvMetadataSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "CandidateCV name is required")
      .optional(),
    visibility: z
      .enum(Object.values(CANDIDATE_CV_VISIBILITY), {
        errorMap: () => ({
          message: "visibility must be PRIVATE or PUBLIC",
        }),
      })
      .optional(),
    categoryId: objectIdString.optional(),
    experienceLevelId: objectIdString.nullable().optional(),
    preferredLocations: uniqueEnumArray(
      Object.values(LOCATION),
      "preferredLocations",
    ).optional(),
    skillTags: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Each skill tag must be a non-empty string"),
      )
      .optional(),
    employmentTypes: uniqueEnumArray(
      Object.values(EMPLOYMENT_TYPE),
      "employmentTypes",
    ).optional(),
    workModes: uniqueEnumArray(Object.values(WORK_MODE), "workModes").optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CandidateCV metadata update requires at least one field",
      });
    }
  });

const validateUpdateCandidateCvMetadata = (request, _response, next) => {
  const parsed = updateCandidateCvMetadataSchema.safeParse(request.body ?? {});

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

export default validateUpdateCandidateCvMetadata;
