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
    description: z.string().trim().nullable().optional(),
    descriptionHtml: z.string().nullable().optional(),
    contactInfo: optionalNullableTrimmedString(500, "Contact info"),
  })
  .strict()
  .superRefine((profile, context) => {
    if (!Object.hasOwn(profile, "descriptionHtml") && profile.description?.length > 5000) {
      context.addIssue({
        code: "custom",
        path: ["description"],
        message: "Description must not exceed 5000 characters",
      });
    }
  });

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
