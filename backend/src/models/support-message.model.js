import mongoose from "mongoose";
import USER_ROLE from "../constants/user-role.js";
import COMPANY_MEMBER_ROLE from "../constants/company-member-role.js";
const { Schema } = mongoose;
const schema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "SupportConversation",
      required: true,
      immutable: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      immutable: true,
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    senderName: { type: String, required: true, immutable: true },
    senderRole: {
      type: String,
      enum: [USER_ROLE.PLATFORM_ADMIN, COMPANY_MEMBER_ROLE.COMPANY_MANAGER],
      required: true,
      immutable: true,
    },
    clientRequestId: { type: String, required: true, immutable: true },
    content: { type: String, required: true, maxlength: 4000, immutable: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index(
  { companyId: 1, senderUserId: 1, clientRequestId: 1 },
  { unique: true },
);
schema.index({ companyId: 1, createdAt: -1, _id: -1 });
export default mongoose.model("SupportMessage", schema);
