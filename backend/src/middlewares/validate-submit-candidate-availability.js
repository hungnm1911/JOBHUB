import { z } from "zod";

import AVAILABILITY_DAY_PART from "../constants/availability-day-part.js";
import AppError from "../utils/app-error.js";

const calendarDateSchema = z
  .string({
    error: "slots[].date must be a string",
  })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "slots[].date must use YYYY-MM-DD");

const submitCandidateAvailabilitySchema = z
  .object({
    timezone: z
      .string({
        error: "timezone must be a string",
      })
      .trim()
      .min(1, "timezone must not be empty"),
    slots: z.array(
      z
        .object({
          date: calendarDateSchema,
          dayPart: z.enum(
            [AVAILABILITY_DAY_PART.MORNING, AVAILABILITY_DAY_PART.AFTERNOON],
            {
              error: "slots[].dayPart must be MORNING or AFTERNOON",
            },
          ),
        })
        .strict(),
    ),
  })
  .strict();

const validateSubmitCandidateAvailability = (request, _response, next) => {
  const parsed = submitCandidateAvailabilitySchema.safeParse(request.body ?? {});

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

export default validateSubmitCandidateAvailability;
