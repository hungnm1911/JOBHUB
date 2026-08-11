import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = z
  .string({
    error: "Supporting Recruiter CompanyMember id is required",
  })
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid Supporting Recruiter CompanyMember id");

const addSupportingRecruiterSchema = z.object({
  supportingRecruiterCompanyMemberId: objectIdString,
});

const validateAddSupportingRecruiter = (request, _response, next) => {
  const parsed = addSupportingRecruiterSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || undefined,
      }),
    );
  }

  // Preserve non-contract body fields such as client companyId so the service
  // can reject authorization-expansion attempts under BR-38.
  request.body = {
    ...request.body,
    ...parsed.data,
  };

  return next();
};

export default validateAddSupportingRecruiter;

