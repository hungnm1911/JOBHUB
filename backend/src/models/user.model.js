import mongoose from "mongoose";

import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return value === null || value <= new Date();
        },
        message: "Date of birth cannot be in the future",
      },
    },

    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
      unique: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      required: true,
      enum: Object.values(USER_ROLE),
      immutable: true,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const User = model("User", userSchema);

export default User;