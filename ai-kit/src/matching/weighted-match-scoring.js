const FIELD_WEIGHTS = Object.freeze({
  skills: 0.4,
  category: 0.25,
  experience: 0.25,
  employmentType: 0.05,
  workMode: 0.05,
});

const mean = (scores) => scores.reduce((sum, score) => sum + score, 0) / scores.length;

// Each entry is one already-grouped Job requirement with one semantic score.
// Evidence and semantic equivalence are resolved before this calculation.
const scoreSkills = (requirementGroups) => {
  if (!Array.isArray(requirementGroups)) {
    throw new TypeError("Skills assessment must contain requirement groups");
  }

  const required = [];
  const lowerPriority = [];

  for (const group of requirementGroups) {
    const { priority, semanticScore } = group;

    if (!Number.isInteger(semanticScore) || semanticScore < 0
      || semanticScore > 100 || semanticScore % 10 !== 0) {
      throw new TypeError("Each requirement group needs a rubric score");
    }

    if (priority === "REQUIRED") {
      required.push(semanticScore);
    } else if (priority === "PREFERRED" || priority === "UNSPECIFIED") {
      lowerPriority.push(semanticScore);
    } else {
      throw new TypeError("Each requirement group needs a known priority");
    }
  }

  if (required.length && lowerPriority.length) {
    return mean(required) * 0.8 + mean(lowerPriority) * 0.2;
  }
  if (required.length) return mean(required);
  if (lowerPriority.length) return mean(lowerPriority);
  return 0;
};

const calculateWeightedMatchScore = (skillsAssessment, deterministicFieldScores) => {
  const skillsScore = scoreSkills(skillsAssessment?.requirementGroups);
  const fieldScores = {
    skills: skillsScore,
    category: deterministicFieldScores?.categoryScore,
    experience: deterministicFieldScores?.experienceScore,
    employmentType: deterministicFieldScores?.employmentTypeScore,
    workMode: deterministicFieldScores?.workModeScore,
  };

  if (Object.values(fieldScores).some((score) => !Number.isFinite(score)
    || score < 0 || score > 100)) {
    throw new TypeError("All five field scores must be numbers from 0 to 100");
  }

  const contributions = Object.fromEntries(Object.entries(FIELD_WEIGHTS).map(
    ([field, weight]) => [field, fieldScores[field] * weight],
  ));

  return {
    matchScore: Object.values(contributions).reduce((sum, score) => sum + score, 0),
    skillsScore,
    categoryScore: fieldScores.category,
    experienceScore: fieldScores.experience,
    employmentTypeScore: fieldScores.employmentType,
    workModeScore: fieldScores.workMode,
    weights: FIELD_WEIGHTS,
    contributions,
  };
};

export { calculateWeightedMatchScore };
