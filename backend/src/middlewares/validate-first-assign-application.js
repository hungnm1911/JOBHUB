import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = z
  .string({
    error: "assigneeCompanyMemberId is required",
  })
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid assignee CompanyMember id");

const firstAssignApplicationSchema = z
  .object({
    assigneeCompanyMemberId: objectIdString,
    expectedVersion: z
      .number({
        invalid_type_error: "expectedVersion must be a number",
      })
      .int("expectedVersion must be an integer")
      .nonnegative("expectedVersion must be a non-negative integer"),
  })
  .strict();

const validateFirstAssignApplication = (request, _response, next) => {
  const parsed = firstAssignApplicationSchema.safeParse(request.body ?? {});

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

export default validateFirstAssignApplication;
