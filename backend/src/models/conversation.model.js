import mongoose from "mongoose";

const { Schema, model } = mongoose;

const CONVERSATION_MUTATION_ERROR =
  "Conversation documents are immutable after creation";

const conversationSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      immutable: true,
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
    collection: "conversations",
  },
);

const rejectConversationMutation = function rejectConversationMutation() {
  throw new Error(CONVERSATION_MUTATION_ERROR);
};

for (const method of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "bulkWrite",
]) {
  conversationSchema.pre(method, rejectConversationMutation);
}

conversationSchema.index({ applicationId: 1 }, { unique: true });

const Conversation = model("Conversation", conversationSchema);

const ensureConversationCollection = async (
  connection = mongoose.connection,
) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring Conversation collection",
    );
  }

  await Conversation.init();
};

export { ensureConversationCollection };
export default Conversation;
