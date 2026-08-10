import { z } from "zod";

import AppError from "../utils/app-error.js";

const activateRecruiterLinkSchema = z
  .object({
    token: z
      .string({
        required_error: "Recruiter activation token is required",
      })
      .min(1, "Recruiter activation token is required"),
  })
  .strict();

const validateActivateRecruiterLink = (request, _response, next) => {
  const parsed = activateRecruiterLinkSchema.safeParse({
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

export default validateActivateRecruiterLink;
