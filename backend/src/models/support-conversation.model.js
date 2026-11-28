import mongoose from "mongoose";
const { Schema } = mongoose;
const schema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      immutable: true,
      unique: true,
    },
    lastMessageAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index({ lastMessageAt: -1, _id: -1 });
export default mongoose.model("SupportConversation", schema);
