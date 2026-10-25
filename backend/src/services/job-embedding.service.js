import Job from "../models/job.model.js";
import { aiKit } from "./ai-kit.service.js";
import { normalizeLoadedJob } from "./job-ai-normalization-core.service.js";

const SEMANTIC_FIELDS = Object.freeze([
  "title",
  "jobDescription",
  "requiredSkills",
  "fieldCategoryIds",
  "positionCategoryIds",
  "experienceLevelId",
]);

// A derived write must never advance the canonical Job's updatedAt or overwrite
// a semantic source that changed between normalization and persistence.
const synchronizeJobEmbeddingText = async (jobId) => {
  const persistedJob = await Job.collection.findOne({ _id: jobId });

  if (!persistedJob || !persistedJob.publishedAt) return "SKIPPED";

  const normalized = await normalizeLoadedJob({
    job: Job.hydrate(persistedJob),
    persistedJob,
  });

  if (normalized.status !== "READY") return "FAILED";

  const embeddingText = aiKit.buildJobEmbeddingText(normalized);

  if (!embeddingText) return "FAILED";
  if (persistedJob.embeddingText === embeddingText) return "UNCHANGED";

  const sourceMatch = Object.fromEntries(
    SEMANTIC_FIELDS.map((field) => [field, persistedJob[field] ?? null]),
  );
  const result = await Job.updateOne(
    {
      _id: persistedJob._id,
      publishedAt: { $ne: null },
      ...sourceMatch,
    },
    { $set: { embeddingText } },
    { timestamps: false, runValidators: true },
  );

  return result.modifiedCount === 1 ? "UPDATED" : "SKIPPED";
};

// Explicit operator reconciliation; no scheduler or request-path scan.
const reconcilePublishedJobEmbeddingTexts = async ({ onResult } = {}) => {
  const counts = { UPDATED: 0, UNCHANGED: 0, FAILED: 0, SKIPPED: 0 };
  const cursor = Job.find({ publishedAt: { $ne: null } })
    .select("_id")
    .lean()
    .cursor();

  for await (const job of cursor) {
    let outcome;

    try {
      outcome = await synchronizeJobEmbeddingText(job._id);
    } catch (error) {
      outcome = "FAILED";
      onResult?.({ jobId: job._id.toString(), outcome, errorType: error.name });
      counts[outcome] += 1;
      continue;
    }

    counts[outcome] += 1;
    onResult?.({ jobId: job._id.toString(), outcome });
  }

  return counts;
};

export { reconcilePublishedJobEmbeddingTexts, synchronizeJobEmbeddingText };
