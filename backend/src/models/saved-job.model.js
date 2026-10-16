import mongoose from "mongoose";

const { Schema, model } = mongoose;

const savedJobSchema = new Schema(
  {
    candidateUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    savedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { versionKey: false },
);

savedJobSchema.index({ candidateUserId: 1, jobId: 1 }, { unique: true });
savedJobSchema.index({ candidateUserId: 1, savedAt: -1 });

const SavedJob = model("SavedJob", savedJobSchema);

const ensureSavedJobCollection = async (connection = mongoose.connection) => {
  if (connection.readyState !== 1) {
    throw new Error(
      "MongoDB connection must be ready before ensuring SavedJob collection",
    );
  }

  await SavedJob.init();
};

export { ensureSavedJobCollection };
export default SavedJob;
