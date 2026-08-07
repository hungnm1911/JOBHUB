import mongoose from "mongoose";

import AUTH_TOKEN_TYPE from "../constants/auth-token-type.js";

const { Schema, model } = mongoose;

const authTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: Object.values(AUTH_TOKEN_TYPE),
    },

    tokenHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  },
);

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthToken = model("AuthToken", authTokenSchema);

export default AuthToken;
