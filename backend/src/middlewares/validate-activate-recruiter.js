import { z } from "zod";

import AppError from "../utils/app-error.js";

const activateRecruiterSchema = z
  .object({
    token: z
      .string({
        required_error: "Recruiter activation token is required",
      })
      .min(1, "Recruiter activation token is required"),
    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must not exceed 64 characters"),
  })
  .strict();

const validateActivateRecruiter = (request, _response, next) => {
  const parsed = activateRecruiterSchema.safeParse(request.body);

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

export default validateActivateRecruiter;
