import { z } from "zod";

import AppError from "../utils/app-error.js";

const optionalNullableTrimmedString = (maxLength, fieldLabel) => {
  return z
    .union([
      z.null(),
      z
        .string()
        .trim()
        .max(maxLength, `${fieldLabel} must not exceed ${maxLength} characters`),
    ])
    .optional();
};

const companyActiveUpdateSchema = z
  .object({
    logoUrl: optionalNullableTrimmedString(500, "Logo URL"),
    bannerUrl: optionalNullableTrimmedString(500, "Banner URL"),
    website: optionalNullableTrimmedString(500, "Website"),
    address: optionalNullableTrimmedString(500, "Address"),
    description: optionalNullableTrimmedString(5000, "Description"),
    contactInfo: optionalNullableTrimmedString(500, "Contact info"),
  })
  .strict();

const validateCompanyActiveUpdate = (request, _response, next) => {
  const parsed = companyActiveUpdateSchema.safeParse(request.body);

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

export default validateCompanyActiveUpdate;
