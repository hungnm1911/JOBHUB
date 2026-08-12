import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const directApplySchema = z
  .object({
    jobId: objectIdString,
    candidateCvId: objectIdString,
  })
  .strict();

const validateDirectApply = (request, _response, next) => {
  const parsed = directApplySchema.safeParse(request.body ?? {});

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

export default validateDirectApply;
