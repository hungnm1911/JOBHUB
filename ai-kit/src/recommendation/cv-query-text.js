import { readCvCareerContent } from "../normalization/cv-match-profile-career.js";

const clean = (value) => {
  if (typeof value !== "string") return "";
  return value
    .replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const values = (items) => items.map((item) => clean(item.value)).filter(Boolean);
const unique = (items) => [...new Map(items.map((item) => [item.toLowerCase(), item])).values()];

// AI-V05 Data §7.2: career content only, with source and contact data excluded.
const buildCvQueryText = (normalizationResult) => {
  if (normalizationResult?.status !== "READY" || !normalizationResult.profile) {
    throw new TypeError("READY CVMatchProfile is required");
  }

  const { profile } = normalizationResult;
  const career = readCvCareerContent(profile);
  const sections = [
    ["Career Target", clean(profile.metadata.category?.value?.name)],
    ["Skill Tags", unique(values(profile.metadata.skillTags ?? [])).join(", ")],
    ["Career Positioning", unique(values(career.careerPositioning)).join("; ")],
    ["Professional Summary", unique(values(career.professionalSummary)).join("; ")],
    ["Skills", unique(values(career.skills)).join("; ")],
    ["Work Experience", career.workExperiences.map(({ value }) =>
      [value.position, value.description, ...(value.achievements ?? [])].map(clean).filter(Boolean).join("; ")).filter(Boolean).join("\n")],
    ["Projects", career.projects.map(({ value }) =>
      [value.role, ...(value.technologies ?? []), value.description].map(clean).filter(Boolean).join("; ")).filter(Boolean).join("\n")],
    ["Education", career.educations.map(({ value }) =>
      [value.degree, value.fieldOfStudy].map(clean).filter(Boolean).join("; ")).filter(Boolean).join("\n")],
    ["Certifications", career.certifications.map(({ value }) =>
      clean(value.name)).filter(Boolean).join("; ")],
  ];

  return sections.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("\n");
};

export { buildCvQueryText };
