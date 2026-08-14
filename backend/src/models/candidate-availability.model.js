import mongoose from "mongoose";

import AVAILABILITY_DAY_PART from "../constants/availability-day-part.js";

const { Schema, model } = mongoose;

const DAY_PART_VALUES = Object.values(AVAILABILITY_DAY_PART);
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isValidTimeZone = (value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const availabilitySlotSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      validate: {
        validator: isCalendarDate,
        message: "slot.date must be a calendar date in YYYY-MM-DD format",
      },
    },
    dayPart: {
      type: String,
      required: true,
      enum: {
        values: DAY_PART_VALUES,
        message: "slot.dayPart must be MORNING or AFTERNOON",
      },
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

const candidateAvailabilitySchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      immutable: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: isValidTimeZone,
        message: "timezone must be a valid IANA time zone identifier",
      },
    },
    slots: {
      type: [availabilitySlotSchema],
      required: true,
      default: [],
    },
    revision: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "revision must be non-negative"],
      validate: {
        validator: Number.isInteger,
        message: "revision must be a non-negative integer",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "candidate_availabilities",
  },
);

candidateAvailabilitySchema.pre(
  "validate",
  function enforceCandidateAvailabilityLocalInvariants() {
    const seenSlots = new Set();

    for (const slot of this.slots ?? []) {
      const key = `${slot.date}:${slot.dayPart}`;

      if (seenSlots.has(key)) {
        this.invalidate(
          "slots",
          "slots must not contain duplicate (date, dayPart) values",
        );
        return;
      }

      seenSlots.add(key);
    }
  },
);

for (const method of ["updateOne", "updateMany", "findOneAndUpdate"]) {
  candidateAvailabilitySchema.pre(
    method,
    function rejectCandidateAvailabilityQueryUpdates() {
      throw new Error(
        "CandidateAvailability query updates are not supported; use approved Availability workflows",
      );
    },
  );
}

for (const method of ["replaceOne", "findOneAndReplace", "bulkWrite"]) {
  candidateAvailabilitySchema.pre(
    method,
    function rejectCandidateAvailabilityReplacementWrites() {
      throw new Error(
        "CandidateAvailability replacement writes are not supported; use approved Availability workflows",
      );
    },
  );
}

candidateAvailabilitySchema.index({ applicationId: 1 }, { unique: true });

const CandidateAvailability = model(
  "CandidateAvailability",
  candidateAvailabilitySchema,
);

const ensureCandidateAvailabilityCollection = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring CandidateAvailability collection",
    );
  }

  await CandidateAvailability.init();
};

export {
  availabilitySlotSchema,
  candidateAvailabilitySchema,
  ensureCandidateAvailabilityCollection,
  isCalendarDate,
  isValidTimeZone,
};

export default CandidateAvailability;
