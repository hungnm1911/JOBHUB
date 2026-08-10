import { z } from "zod";

import AppError from "../utils/app-error.js";

const confirmCompanyApprovalSchema = z
  .object({
    token: z
      .string({
        required_error: "Approval confirmation token is required",
      })
      .min(1, "Approval confirmation token is required"),
  })
  .strict();

const resolveConfirmCompanyApprovalPayload = (request) => {
  if (request.method === "GET") {
    return { token: request.query?.token };
  }

  return request.body;
};

const validateConfirmCompanyApproval = (request, _response, next) => {
  const parsed = confirmCompanyApprovalSchema.safeParse(
    resolveConfirmCompanyApprovalPayload(request),
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

export default validateConfirmCompanyApproval;
