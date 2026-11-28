import mongoose from "mongoose";

const { Schema } = mongoose;
const announcementSchema = new Schema(
  {
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    clientRequestId: { type: String, required: true, immutable: true },
    title: { type: String, required: true, maxlength: 160, immutable: true },
    content: { type: String, required: true, maxlength: 4000, immutable: true },
    publishedAt: { type: Date, required: true, immutable: true },
    totalRecipients: { type: Number, required: true, min: 0, immutable: true },
  },
  { timestamps: true, versionKey: false },
);
announcementSchema.index(
  { authorUserId: 1, clientRequestId: 1 },
  { unique: true },
);
announcementSchema.index({ createdAt: -1, _id: -1 });
const Announcement = mongoose.model("Announcement", announcementSchema);
export default Announcement;
