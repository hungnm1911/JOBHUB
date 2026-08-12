import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const replaceSubmittedCvSchema = z
  .object({
    candidateCvId: objectIdString,
    expectedVersion: z
      .number({
        invalid_type_error: "expectedVersion must be a number",
      })
      .int("expectedVersion must be an integer")
      .nonnegative("expectedVersion must be a non-negative integer"),
  })
  .strict();

const validateReplaceSubmittedCv = (request, _response, next) => {
  const parsed = replaceSubmittedCvSchema.safeParse(request.body ?? {});

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

export default validateReplaceSubmittedCv;
