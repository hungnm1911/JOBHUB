import { z } from "zod";

import AppError from "../utils/app-error.js";

const candidateRegistrationSchema = z
  .object({
    fullName: z
      .string({
        required_error: "Full name is required",
      })
      .trim()
      .min(1, "Full name is required")
      .max(100, "Full name must not exceed 100 characters"),
    email: z
      .string({
        required_error: "Email is required",
      })
      .trim()
      .min(1, "Email is required")
      .max(320, "Email must not exceed 320 characters")
      .email("Email must be a valid email address"),
    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must not exceed 64 characters"),
  })
  .strict();

const validateCandidateRegistration = (request, _response, next) => {
  const parsed = candidateRegistrationSchema.safeParse(request.body);

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join("."),
      }),
    );
  }

  request.body = parsed.data;

  return next();
};

export default validateCandidateRegistration;
