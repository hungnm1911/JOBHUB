import mongoose from "mongoose";

const { Schema, model } = mongoose;

const authSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    refreshTokenHash: {
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

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthSession = model("AuthSession", authSessionSchema);

export default AuthSession;
