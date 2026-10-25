const EXPERIENCE_LABELS = Object.freeze({
  NO_EXPERIENCE: "No experience required",
  UNDER_1_YEAR: "Under 1 year of experience",
  ONE_TO_THREE_YEARS: "1 to 3 years of experience",
  THREE_TO_FIVE_YEARS: "3 to 5 years of experience",
  FIVE_TO_TEN_YEARS: "5 to 10 years of experience",
  OVER_TEN_YEARS: "Over 10 years of experience",
});

const clean = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const distinct = (values) => {
  const seen = new Set();

  return values.map(clean).filter((value) => {
    const key = value.toLowerCase();

    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// AI-V05 Data §7.1: only semantic values from a READY V01 JobMatchProfile.
// Provenance, IDs, salary, location, work metadata, and lifecycle are excluded.
const buildJobEmbeddingText = (normalizationResult) => {
  if (normalizationResult?.status !== "READY" || !normalizationResult.profile) {
    throw new TypeError("READY JobMatchProfile is required");
  }

  const { freeText, metadata } = normalizationResult.profile;
  const sections = [
    ["Job Title", clean(freeText.title?.value)],
    ["Career Fields", distinct(metadata.fieldCategories.map((item) => item.value.name)).join(", ")],
    ["Career Positions", distinct(metadata.positionCategories.map((item) => item.value.name)).join(", ")],
    ["Required Skills", distinct(metadata.requiredSkills.map((item) => item.value)).join(", ")],
    ["Job Description", clean(freeText.jobDescription?.value)],
    ["Experience Level", EXPERIENCE_LABELS[metadata.experienceLevel?.value.code] ?? ""],
  ];

  return sections.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("\n");
};

export { buildJobEmbeddingText };
