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

const companyDraftUpdateSchema = z
  .object({
    name: optionalNullableTrimmedString(200, "Name"),
    logoUrl: optionalNullableTrimmedString(500, "Logo URL"),
    bannerUrl: optionalNullableTrimmedString(500, "Banner URL"),
    website: optionalNullableTrimmedString(500, "Website"),
    address: optionalNullableTrimmedString(500, "Address"),
    description: optionalNullableTrimmedString(5000, "Description"),
    contactInfo: optionalNullableTrimmedString(500, "Contact info"),
    businessRegistrationNumber: optionalNullableTrimmedString(
      100,
      "Business registration number",
    ),
  })
  .strict();

const validateCompanyDraftUpdate = (request, _response, next) => {
  const parsed = companyDraftUpdateSchema.safeParse(request.body);

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

export default validateCompanyDraftUpdate;
