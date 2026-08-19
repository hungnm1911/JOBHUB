import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const sendJobInvitationSchema = z
  .object({
    candidateCvId: objectIdString,
    greetingMessage: z
      .union([z.string(), z.null()])
      .optional()
      .transform((value) => {
        if (value == null) {
          return null;
        }

        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
      }),
  })
  .strict();

const validateSendJobInvitation = (request, _response, next) => {
  const parsed = sendJobInvitationSchema.safeParse(request.body ?? {});

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

export default validateSendJobInvitation;
