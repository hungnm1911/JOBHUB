import { z } from "zod";

import AVAILABILITY_DAY_PART from "../constants/availability-day-part.js";
import AppError from "../utils/app-error.js";

const createFirstInterviewProposalSchema = z
  .object({
    date: z
      .string({ error: "date must be a string" })
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD"),
    dayPart: z.enum(
      [AVAILABILITY_DAY_PART.MORNING, AVAILABILITY_DAY_PART.AFTERNOON],
      { error: "dayPart must be MORNING or AFTERNOON" },
    ),
    expectedAvailabilityRevision: z
      .number({
        error: "expectedAvailabilityRevision must be a number",
      })
      .int("expectedAvailabilityRevision must be an integer")
      .nonnegative("expectedAvailabilityRevision must be a non-negative integer"),
  })
  .strict();

const validateCreateFirstInterviewProposal = (request, _response, next) => {
  const parsed = createFirstInterviewProposalSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;
    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || undefined,
      }),
    );
  }

  request.body = { ...request.body, ...parsed.data };
  return next();
};

export default validateCreateFirstInterviewProposal;
