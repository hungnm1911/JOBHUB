import EXPERIENCE_LEVEL from "../constants/experience-level.js";
import ExperienceLevel from "../models/experience-level.model.js";

const CANONICAL_EXPERIENCE_LEVEL_CODES = Object.values(EXPERIENCE_LEVEL);

const CANONICAL_EXPERIENCE_LEVEL_RANK = new Map(
  CANONICAL_EXPERIENCE_LEVEL_CODES.map((code, index) => [code, index]),
);

const toPublicExperienceLevel = (experienceLevel) => {
  return {
    id: experienceLevel._id.toString(),
    code: experienceLevel.code,
  };
};

const listExperienceLevels = async () => {
  const experienceLevels = await ExperienceLevel.find({
    code: { $in: CANONICAL_EXPERIENCE_LEVEL_CODES },
  })
    .select("_id code")
    .lean();

  return experienceLevels
    .sort(
      (left, right) =>
        CANONICAL_EXPERIENCE_LEVEL_RANK.get(left.code) -
        CANONICAL_EXPERIENCE_LEVEL_RANK.get(right.code),
    )
    .map(toPublicExperienceLevel);
};

export { listExperienceLevels };
