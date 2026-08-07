import { z } from "zod";

import AppError from "../utils/app-error.js";

const refreshAccessSchema = z
  .object({
    refreshToken: z
      .string({
        required_error: "Refresh token is required",
      })
      .min(1, "Refresh token is required"),
  })
  .strict();

const validateRefreshAccess = (request, _response, next) => {
  const parsed = refreshAccessSchema.safeParse(request.body);

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

export default validateRefreshAccess;
