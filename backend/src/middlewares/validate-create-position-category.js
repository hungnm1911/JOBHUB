import { z } from "zod";

import AppError from "../utils/app-error.js";

const createPositionCategorySchema = z
  .object({
    name: z
      .string({
        required_error: "Category name is required",
      })
      .trim()
      .min(1, "Category name is required"),
  })
  .strict();

const validateCreatePositionCategory = (request, _response, next) => {
  const parsed = createPositionCategorySchema.safeParse(request.body);

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

export default validateCreatePositionCategory;
