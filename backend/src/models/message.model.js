import mongoose from "mongoose";

import MESSAGE_TYPE from "../constants/message-type.js";

const { Schema, model } = mongoose;

const MESSAGE_TYPE_VALUES = Object.values(MESSAGE_TYPE);
const MESSAGE_MUTATION_ERROR =
  "Message documents are immutable after creation";

const isNonEmptyTrimmedString = (value) => {
  return typeof value === "string" && value.trim() !== "";
};

const assertMessageLocalInvariants = (message) => {
  const errors = [];
  const hasSenderUser = message.senderUserId != null;
  const hasSenderMembership = message.senderCompanyMemberId != null;

  if (message.type === MESSAGE_TYPE.SYSTEM) {
    if (hasSenderUser) {
      errors.push("SYSTEM Message must not have senderUserId");
    }

    if (hasSenderMembership) {
      errors.push("SYSTEM Message must not have senderCompanyMemberId");
    }
  }

  if (message.type === MESSAGE_TYPE.NORMAL && !hasSenderUser) {
    errors.push("NORMAL Message must have senderUserId");
  }

  return errors;
};

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: MESSAGE_TYPE_VALUES,
        message: "type must be NORMAL or SYSTEM",
      },
      immutable: true,
    },
    senderUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required: false,
      immutable: true,
    },
    senderCompanyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMember",
      default: null,
      required: false,
      immutable: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
      validate: {
        validator: isNonEmptyTrimmedString,
        message: "content must be a non-empty string",
      },
    },
    createdAt: {
      type: Date,
      immutable: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
    collection: "messages",
  },
);

messageSchema.pre("validate", function enforceMessageLocalInvariants() {
  const errors = assertMessageLocalInvariants(this);

  if (errors.length > 0) {
    this.invalidate("type", errors[0]);
  }
});

const rejectMessageMutation = function rejectMessageMutation() {
  throw new Error(MESSAGE_MUTATION_ERROR);
};

for (const method of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "bulkWrite",
]) {
  messageSchema.pre(method, rejectMessageMutation);
}

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = model("Message", messageSchema);

const ensureMessageCollection = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring Message collection",
    );
  }

  await Message.init();
};

export { assertMessageLocalInvariants, ensureMessageCollection };
export default Message;
