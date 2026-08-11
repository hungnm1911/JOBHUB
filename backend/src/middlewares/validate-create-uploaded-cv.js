import { z } from "zod";

import CANDIDATE_CV_VISIBILITY from "../constants/candidate-cv-visibility.js";
import EMPLOYMENT_TYPE from "../constants/employment-type.js";
import LOCATION from "../constants/location.js";
import WORK_MODE from "../constants/work-mode.js";
import AppError from "../utils/app-error.js";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const parseJsonArrayField = (value, fieldLabel) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new AppError(400, `CandidateCV ${fieldLabel} must be an array`, {
      field: fieldLabel,
    });
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      throw new Error("not an array");
    }

    return parsed;
  } catch {
    throw new AppError(
      400,
      `CandidateCV ${fieldLabel} must be a JSON array`,
      {
        field: fieldLabel,
      },
    );
  }
};

const uniqueEnumArray = (values, fieldLabel) => {
  return z
    .array(z.enum(values))
    .optional()
    .superRefine((items, context) => {
      if (items == null) {
        return;
      }

      if (new Set(items).size !== items.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldLabel} must not contain duplicates`,
        });
      }
    });
};

const createUploadedCvSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "CandidateCV name is required"),
    visibility: z.enum(Object.values(CANDIDATE_CV_VISIBILITY), {
      errorMap: () => ({
        message: "visibility must be PRIVATE or PUBLIC",
      }),
    }),
    categoryId: objectIdString,
    experienceLevelId: objectIdString.nullable().optional(),
    preferredLocations: uniqueEnumArray(
      Object.values(LOCATION),
      "preferredLocations",
    ),
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
    ),
    workModes: uniqueEnumArray(Object.values(WORK_MODE), "workModes"),
  })
  .strict();

const validateCreateUploadedCv = (request, _response, next) => {
  try {
    const rawBody = request.body ?? {};

    const normalizedBody = {
      ...rawBody,
      experienceLevelId:
        rawBody.experienceLevelId === "" ? null : rawBody.experienceLevelId,
      preferredLocations: parseJsonArrayField(
        rawBody.preferredLocations,
        "preferredLocations",
      ),
      skillTags: parseJsonArrayField(rawBody.skillTags, "skillTags"),
      employmentTypes: parseJsonArrayField(
        rawBody.employmentTypes,
        "employmentTypes",
      ),
      workModes: parseJsonArrayField(rawBody.workModes, "workModes"),
    };

    const parsed = createUploadedCvSchema.safeParse(normalizedBody);

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
  } catch (error) {
    return next(error);
  }
};

export default validateCreateUploadedCv;
