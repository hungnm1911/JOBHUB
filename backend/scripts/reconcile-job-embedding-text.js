import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import { reconcilePublishedJobEmbeddingTexts } from "../src/services/job-embedding.service.js";

try {
  await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
  const counts = await reconcilePublishedJobEmbeddingTexts({
    onResult: ({ jobId, outcome, errorType }) => {
      if (outcome === "FAILED") {
        process.stderr.write(`Job ${jobId}: ${errorType ?? "NOT_READY"}\n`);
      }
    },
  });

  process.stdout.write(`${JSON.stringify(counts)}\n`);
  if (counts.FAILED > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Job embedding reconciliation failed: ${error.name}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
