import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = z
  .string({
    error: "New Primary Recruiter CompanyMember id is required",
  })
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid new Primary Recruiter CompanyMember id");

const replacePrimaryRecruiterSchema = z.object({
  newPrimaryCompanyMemberId: objectIdString,
  keepOldPrimaryAsSupporting: z.boolean({
    error:
      "keepOldPrimaryAsSupporting is required — Company Manager must choose the outcome of the current Primary Recruiter",
  }),
});

const validateReplacePrimaryRecruiter = (request, _response, next) => {
  const parsed = replacePrimaryRecruiterSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || undefined,
      }),
    );
  }

  request.body = {
    ...request.body,
    ...parsed.data,
  };

  return next();
};

export default validateReplacePrimaryRecruiter;
