import AppError from "../utils/app-error.js";
import { aiKit } from "./ai-kit.service.js";
import { prepareOwnCandidateCvJobProfiles } from "./candidate-job-match.service.js";

const INVALID_CV_EVALUATION = "INVALID_CV_EVALUATION";

const evaluateOwnCandidateCvForJob = async (input) => {
  const profiles = await prepareOwnCandidateCvJobProfiles(input);

  try {
    return await aiKit.evaluateCv(profiles);
  } catch (error) {
    // AI Kit signals invalid/empty model output with this code; map it to an
    // operational response so clients can show a readable retry message.
    if (error?.code === INVALID_CV_EVALUATION) {
      throw new AppError(
        502,
        "CV evaluation is temporarily unavailable. Please try again.",
        { reason: INVALID_CV_EVALUATION },
        { cause: error },
      );
    }

    throw error;
  }
};

export { evaluateOwnCandidateCvForJob };
