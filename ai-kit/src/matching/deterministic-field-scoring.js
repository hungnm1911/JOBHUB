import {
  CATEGORY_LEVELS,
  EXPERIENCE_LEVEL_CODES,
} from "../normalization/normalization-support.js";

const scoreCareerCategory = (jobMetadata, cvMetadata) => {
  const cvCategory = cvMetadata.category.value;
  const jobFields = jobMetadata.fieldCategories.map(({ value }) => value.id);
  const jobPositions = jobMetadata.positionCategories.map(({ value }) => value);

  if (cvCategory.level === CATEGORY_LEVELS.POSITION) {
    if (jobPositions.some(({ id }) => id === cvCategory.id)) {
      return 100;
    }

    if (
      jobFields.includes(cvCategory.parentCategoryId)
      || jobPositions.some(({ parentCategoryId }) => (
        parentCategoryId === cvCategory.parentCategoryId
      ))
    ) {
      return 50;
    }

    return 0;
  }

  if (cvCategory.level === CATEGORY_LEVELS.FIELD) {
    return jobFields.includes(cvCategory.id)
      || jobPositions.some(({ parentCategoryId }) => parentCategoryId === cvCategory.id)
      ? 70
      : 0;
  }

  return 0;
};

const scoreExperienceLevel = (jobMetadata, cvMetadata) => {
  const jobCode = jobMetadata.experienceLevel?.value.code;
  const cvCode = cvMetadata.experienceLevel?.value.code;

  if (!jobCode || !cvCode) {
    return 0;
  }

  const difference = EXPERIENCE_LEVEL_CODES.indexOf(cvCode)
    - EXPERIENCE_LEVEL_CODES.indexOf(jobCode);

  return [100, 75, 40, 15][difference] ?? 0;
};

const scoreEmploymentType = (jobMetadata, cvMetadata) => {
  const jobType = jobMetadata.employmentType?.value;

  return jobType && cvMetadata.employmentTypes.some(({ value }) => value === jobType)
    ? 100
    : 0;
};

const scoreWorkMode = (jobMetadata, cvMetadata) => {
  const jobModes = new Set(jobMetadata.workModes.map(({ value }) => value));

  return cvMetadata.workModes.some(({ value }) => jobModes.has(value)) ? 100 : 0;
};

// Inputs are the READY profiles produced by AI-V01 or AI-V02 normalization.
// Only their declared metadata is scored; free text and PDF claims are not used.
const scoreDeterministicFields = (jobMatchProfile, cvMatchProfile) => {
  const jobMetadata = jobMatchProfile.metadata;
  const cvMetadata = cvMatchProfile.metadata;

  return {
    categoryScore: scoreCareerCategory(jobMetadata, cvMetadata),
    experienceScore: scoreExperienceLevel(jobMetadata, cvMetadata),
    employmentTypeScore: scoreEmploymentType(jobMetadata, cvMetadata),
    workModeScore: scoreWorkMode(jobMetadata, cvMetadata),
  };
};

export { scoreDeterministicFields };
