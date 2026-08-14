import mongoose from "mongoose";

import AVAILABILITY_DAY_PART from "../constants/availability-day-part.js";
import INTERVIEW_SCHEDULE_STATUS from "../constants/interview-schedule-status.js";
import { isCalendarDate, isValidTimeZone } from "./candidate-availability.model.js";

const { Schema, model } = mongoose;

const DAY_PART_VALUES = Object.values(AVAILABILITY_DAY_PART);
const STATUS_VALUES = Object.values(INTERVIEW_SCHEDULE_STATUS);
const ACTIVE_SCHEDULE_STATUSES = Object.freeze([
  INTERVIEW_SCHEDULE_STATUS.PROPOSED,
  INTERVIEW_SCHEDULE_STATUS.CONFIRMED,
]);

const interviewScheduleSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      required: true,
      default: INTERVIEW_SCHEDULE_STATUS.PROPOSED,
      enum: {
        values: STATUS_VALUES,
        message: "status must use canonical InterviewSchedule values",
      },
    },
    date: {
      type: String,
      required: true,
      immutable: true,
      validate: {
        validator: isCalendarDate,
        message: "date must be a calendar date in YYYY-MM-DD format",
      },
    },
    dayPart: {
      type: String,
      required: true,
      immutable: true,
      enum: {
        values: DAY_PART_VALUES,
        message: "dayPart must be MORNING or AFTERNOON",
      },
    },
    timezone: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      validate: {
        validator: isValidTimeZone,
        message: "timezone must be a valid IANA time zone identifier",
      },
    },
    expiresAt: {
      type: Date,
      required: true,
      immutable: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    createdByCompanyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMember",
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "interview_schedules",
  },
);

interviewScheduleSchema.index(
  { applicationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ACTIVE_SCHEDULE_STATUSES },
    },
  },
);
interviewScheduleSchema.index({ applicationId: 1, createdAt: -1 });
interviewScheduleSchema.index({ applicationId: 1, date: 1, dayPart: 1, status: 1 });
interviewScheduleSchema.index({ status: 1, expiresAt: 1 });

const InterviewSchedule = model("InterviewSchedule", interviewScheduleSchema);

const ensureInterviewScheduleCollection = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring InterviewSchedule collection",
    );
  }

  await InterviewSchedule.init();
};

export {
  ACTIVE_SCHEDULE_STATUSES,
  ensureInterviewScheduleCollection,
  interviewScheduleSchema,
};
export default InterviewSchedule;
