import { recommendOwnDefaultCvJobs } from "../services/candidate-job-recommendation.service.js";
import config from "../config/index.js";

const DIAGNOSTIC_STAGES = new Set(["start", "retrieval", "job_normalization",
  "batch_inference", "structured_extraction", "batch_json", "batch_validation",
  "evidence_resolution", "scoring", "visibility", "complete"]);
const DIAGNOSTIC_CODES = new Set(["RESPONSE_NOT_COMPLETED", "RESPONSE_INCOMPLETE_DETAILS",
  "RESPONSE_ERROR_PRESENT", "OUTPUT_MISSING", "OUTPUT_ITEM_TYPE_INVALID",
  "OUTPUT_MESSAGE_INVALID", "INVALID_JSON", "JOB_COUNT_OR_SHAPE_INVALID",
  "JOB_MAPPING_OR_REASON_INVALID", "EVIDENCE_INVALID", "SCORING_FAILED",
  "VISIBILITY_FAILED"]);

const recommendOwnDefaultCvJobsHandler = async (request, response, next) => {
  const diagnostic = config.env === "development"
    ? { retrievalCandidates: null, shortlistSize: null, batchSize: null,
      currentStage: "start", providerEvents: [] }
    : null;
  if (diagnostic) request.aiV05Diagnostic = diagnostic;
  try {
    const recommendations = await recommendOwnDefaultCvJobs({ actorUser: request.auth.user,
      ...(diagnostic ? { diagnostic } : {}) });
    if (diagnostic) {
      response.setHeader("X-AI-V05-Retrieval-Candidates", String(diagnostic.retrievalCandidates));
      response.setHeader("X-AI-V05-Batch-Jobs", String(diagnostic.batchSize));
      response.setHeader("X-AI-V05-Provider-Calls", String(diagnostic.providerEvents
        .filter((event) => event.gate === "http_sdk" && event.status === "PASS").length));
      const usage = diagnostic.providerEvents.find((event) => event.gate === "usage");
      if (usage) {
        response.setHeader("X-AI-V05-Input-Tokens", String(usage.inputTokens));
        response.setHeader("X-AI-V05-Output-Tokens", String(usage.outputTokens));
      }
    }
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ recommendations });
  } catch (error) {
    if (diagnostic) {
      const stage = DIAGNOSTIC_STAGES.has(error?.diagnosticStage)
        ? error.diagnosticStage : diagnostic.currentStage;
      diagnostic.providerEvents.push({ gate: "checkpoint_error", status: "FAIL", stage,
        code: DIAGNOSTIC_CODES.has(error?.diagnosticCode)
          ? error.diagnosticCode : "UNCLASSIFIED_FAILURE",
        errorClass: typeof error?.constructor?.name === "string"
          && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.constructor.name)
          ? error.constructor.name : "UnknownError" });
    }
    return next(error);
  }
};

export { recommendOwnDefaultCvJobsHandler };
