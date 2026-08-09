import mongoose from "mongoose";

import EXPERIENCE_LEVEL from "../constants/experience-level.js";

const { Schema, model } = mongoose;

const experienceLevelSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      enum: Object.values(EXPERIENCE_LEVEL),
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "experience_levels",
  },
);

experienceLevelSchema.index({ code: 1 }, { unique: true });

const ExperienceLevel = model("ExperienceLevel", experienceLevelSchema);

export default ExperienceLevel;
