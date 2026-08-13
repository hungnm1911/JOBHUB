import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = (fieldName) =>
  z
    .string({
      error: `${fieldName} is required`,
    })
    .regex(/^[a-fA-F0-9]{24}$/, `Invalid ${fieldName}`);

const reassignApplicationSchema = z
  .object({
    assigneeCompanyMemberId: objectIdString("assigneeCompanyMemberId"),
    expectedAssigneeCompanyMemberId: objectIdString(
      "expectedAssigneeCompanyMemberId",
    ),
    expectedVersion: z
      .number({
        invalid_type_error: "expectedVersion must be a number",
      })
      .int("expectedVersion must be an integer")
      .nonnegative("expectedVersion must be a non-negative integer"),
  })
  .strict();

const validateReassignApplication = (request, _response, next) => {
  const parsed = reassignApplicationSchema.safeParse(request.body ?? {});

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

export default validateReassignApplication;
