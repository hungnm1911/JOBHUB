import { z } from "zod";

import AppError from "../utils/app-error.js";

const verifyEmailSchema = z
  .object({
    token: z
      .string({
        required_error: "Verification token is required",
      })
      .min(1, "Verification token is required"),
  })
  .strict();

const resolveVerifyEmailPayload = (request) => {
  if (request.method === "GET") {
    return { token: request.query?.token };
  }

  return request.body;
};

const validateVerifyEmail = (request, _response, next) => {
  const parsed = verifyEmailSchema.safeParse(
    resolveVerifyEmailPayload(request),
  );

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

export default validateVerifyEmail;
