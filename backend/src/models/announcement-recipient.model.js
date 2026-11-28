import mongoose from "mongoose";

const { Schema } = mongoose;
const announcementRecipientSchema = new Schema(
  {
    announcementId: {
      type: Schema.Types.ObjectId,
      ref: "Announcement",
      required: true,
      immutable: true,
    },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    deliveredAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);
announcementRecipientSchema.index(
  { announcementId: 1, recipientUserId: 1 },
  { unique: true },
);
announcementRecipientSchema.index({ deliveredAt: 1, updatedAt: 1, _id: 1 });
const AnnouncementRecipient = mongoose.model(
  "AnnouncementRecipient",
  announcementRecipientSchema,
);
export default AnnouncementRecipient;
