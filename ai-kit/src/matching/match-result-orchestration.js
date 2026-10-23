import { scoreDeterministicFields } from "./deterministic-field-scoring.js";
import { createSemanticSkillsAssessor } from "./semantic-skills-assessment.js";
import { calculateWeightedMatchScore } from "./weighted-match-scoring.js";
import { NORMALIZATION_STATUS } from "../normalization/normalization-support.js";

// The caller supplies authorized normalization results. Each matching
// request uses exactly one semantic assessment and keeps its result in memory.
const createMatchResultOrchestrator = ({ llm, logger }) => {
  const assessSkills = createSemanticSkillsAssessor({ llm, logger });

  return async ({ jobNormalizationResult, cvNormalizationResult, provider = "codex" } = {}) => {
    if (jobNormalizationResult?.status !== NORMALIZATION_STATUS.READY
      || cvNormalizationResult?.status !== NORMALIZATION_STATUS.READY
      || !jobNormalizationResult.profile || !cvNormalizationResult.profile) {
      throw new TypeError("Job and CV normalization results must both be READY");
    }

    const jobMatchProfile = jobNormalizationResult.profile;
    const cvMatchProfile = cvNormalizationResult.profile;

    // Reject malformed metadata before making a provider request. The field
    // calculator owns the deterministic rules, including sparse field scores.
    const fieldScores = scoreDeterministicFields(jobMatchProfile, cvMatchProfile);
    const skillsAssessment = await assessSkills({ jobMatchProfile, cvMatchProfile, provider });

    return {
      jobId: jobMatchProfile.source.jobId,
      candidateCvId: cvMatchProfile.source.candidateCvId,
      ...calculateWeightedMatchScore(skillsAssessment, fieldScores),
    };
  };
};

export { createMatchResultOrchestrator };
