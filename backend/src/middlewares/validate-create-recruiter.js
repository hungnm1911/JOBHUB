import { z } from "zod";

import AppError from "../utils/app-error.js";

const createRecruiterSchema = z
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
    employeeCode: z
      .string({
        required_error: "Employee code is required",
      })
      .trim()
      .min(1, "Employee code is required")
      .max(100, "Employee code must not exceed 100 characters"),
    jobTitle: z
      .string({
        required_error: "Job title is required",
      })
      .trim()
      .min(1, "Job title is required")
      .max(100, "Job title must not exceed 100 characters"),
  })
  .strict();

const validateCreateRecruiter = (request, _response, next) => {
  const parsed = createRecruiterSchema.safeParse(request.body);

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

export default validateCreateRecruiter;
