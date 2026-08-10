import { z } from "zod";

import AppError from "../utils/app-error.js";

const resetPasswordLinkSchema = z
  .object({
    token: z
      .string({
        required_error: "Password reset token is required",
      })
      .min(1, "Password reset token is required"),
  })
  .strict();

const validateResetPasswordLink = (request, _response, next) => {
  const parsed = resetPasswordLinkSchema.safeParse({
    token: request.query?.token,
  });

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join("."),
      }),
    );
  }

  return next();
};

export default validateResetPasswordLink;
