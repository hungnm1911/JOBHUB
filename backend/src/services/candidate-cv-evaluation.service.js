import { aiKit } from "./ai-kit.service.js";
import { prepareOwnCandidateCvJobProfiles } from "./candidate-job-match.service.js";

const evaluateOwnCandidateCvForJob = async (input) => {
  const profiles = await prepareOwnCandidateCvJobProfiles(input);
  return aiKit.evaluateCv(profiles);
};

export { evaluateOwnCandidateCvForJob };
