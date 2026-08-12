import { z } from "zod";

import AppError from "../utils/app-error.js";

const withdrawApplicationSchema = z
  .object({
    expectedVersion: z
      .number({
        invalid_type_error: "expectedVersion must be a number",
      })
      .int("expectedVersion must be an integer")
      .nonnegative("expectedVersion must be a non-negative integer"),
    withdrawReason: z
      .string({
        invalid_type_error: "withdrawReason must be a string",
      })
      .trim()
      .min(1, "withdrawReason must not be empty")
      .max(2000, "withdrawReason must be at most 2000 characters")
      .optional()
      .nullable(),
  })
  .strict()
  .transform((payload) => ({
    expectedVersion: payload.expectedVersion,
    withdrawReason: payload.withdrawReason ?? null,
  }));

const validateWithdrawApplication = (request, _response, next) => {
  const parsed = withdrawApplicationSchema.safeParse(request.body ?? {});

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

export default validateWithdrawApplication;
