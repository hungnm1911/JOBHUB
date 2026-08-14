import { z } from "zod";

import AppError from "../utils/app-error.js";

// V11 Slice 06: client may only supply Message content. type / sender identity
// are server-owned (BR-13); SYSTEM Message create via this surface is rejected
// by the strict body schema.
const sendConversationNormalMessageSchema = z
  .object({
    content: z
      .string({
        required_error: "content is required",
        invalid_type_error: "content must be a string",
      })
      .trim()
      .min(1, "content must not be empty")
      .max(10000, "content must be at most 10000 characters"),
  })
  .strict();

const validateSendConversationNormalMessage = (request, _response, next) => {
  const parsed = sendConversationNormalMessageSchema.safeParse(
    request.body ?? {},
  );

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

export default validateSendConversationNormalMessage;
