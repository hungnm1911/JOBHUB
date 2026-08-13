import { z } from "zod";

import APPLICATION_STATUS from "../constants/application-status.js";
import AppError from "../utils/app-error.js";

const applicationStatusValues = Object.values(APPLICATION_STATUS);

const recruitmentPipelineStatusSchema = z
  .object({
    targetStatus: z.enum(applicationStatusValues, {
      error: "targetStatus is required",
    }),
    expectedStatus: z.enum(applicationStatusValues, {
      error: "expectedStatus is required",
    }),
    expectedVersion: z
      .number({
        invalid_type_error: "expectedVersion must be a number",
      })
      .int("expectedVersion must be an integer")
      .nonnegative("expectedVersion must be a non-negative integer"),
  })
  .strict();

const validateRecruitmentPipelineStatus = (request, _response, next) => {
  const parsed = recruitmentPipelineStatusSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || undefined,
      }),
    );
  }

  // Preserve non-contract body fields such as client companyId so the service
  // can reject authorization-expansion attempts under the tenant boundary.
  request.body = {
    ...request.body,
    ...parsed.data,
  };

  return next();
};

export default validateRecruitmentPipelineStatus;
