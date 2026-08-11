import { z } from "zod";

import AppError from "../utils/app-error.js";

const optionalNullableTrimmedString = (maxLength, fieldLabel) => {
  return z
    .union([
      z.null(),
      z
        .string()
        .trim()
        .max(maxLength, `${fieldLabel} must not exceed ${maxLength} characters`),
    ])
    .optional();
};

const candidateProfileUpdateSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(100, "Full name must not exceed 100 characters")
      .optional(),
    avatarUrl: optionalNullableTrimmedString(500, "Avatar URL"),
    dateOfBirth: z
      .union([
        z.null(),
        z.coerce.date().refine((value) => value <= new Date(), {
          message: "Date of birth cannot be in the future",
        }),
      ])
      .optional(),
    phoneNumber: optionalNullableTrimmedString(20, "Phone number"),
  })
  .strict();

const validateCandidateProfileUpdate = (request, _response, next) => {
  const parsed = candidateProfileUpdateSchema.safeParse(request.body);

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || firstIssue.code,
      }),
    );
  }

  request.body = parsed.data;

  return next();
};

export default validateCandidateProfileUpdate;
