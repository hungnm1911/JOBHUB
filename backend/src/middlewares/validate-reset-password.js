import { z } from "zod";

import AppError from "../utils/app-error.js";

const resetPasswordSchema = z
  .object({
    token: z
      .string({
        required_error: "Password reset token is required",
      })
      .min(1, "Password reset token is required"),
    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must not exceed 64 characters"),
  })
  .strict();

const validateResetPassword = (request, _response, next) => {
  const parsed = resetPasswordSchema.safeParse(request.body);

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

export default validateResetPassword;
