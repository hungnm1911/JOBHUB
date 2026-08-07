import { z } from "zod";

import AppError from "../utils/app-error.js";

const loginSchema = z
  .object({
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
      .min(1, "Password is required"),
  })
  .strict();

const validateLogin = (request, _response, next) => {
  const parsed = loginSchema.safeParse(request.body);

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

export default validateLogin;
