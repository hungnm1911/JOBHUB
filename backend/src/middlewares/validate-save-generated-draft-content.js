import { z } from "zod";

import CV_LANGUAGE_PROFICIENCY from "../constants/cv-language-proficiency.js";
import HARVARD_CV_SECTION from "../constants/harvard-cv-section.js";
import AppError from "../utils/app-error.js";

const HARVARD_CV_SECTION_VALUES = Object.values(HARVARD_CV_SECTION);

const optionalNullableTrimmedString = z
  .union([z.null(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  });

const optionalNullableDate = z
  .union([z.null(), z.coerce.date()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value ?? null;
  });

const stringArray = z
  .array(z.string().trim().min(1, "Array items must be non-empty strings"))
  .optional();

const personalInfoSchema = z
  .object({
    fullName: optionalNullableTrimmedString,
    email: optionalNullableTrimmedString,
    phone: optionalNullableTrimmedString,
    displayLocation: optionalNullableTrimmedString,
    links: stringArray,
    avatarUrl: optionalNullableTrimmedString,
  })
  .strict()
  .optional();

const educationSchema = z
  .object({
    institutionName: optionalNullableTrimmedString,
    degree: optionalNullableTrimmedString,
    fieldOfStudy: optionalNullableTrimmedString,
    startDate: optionalNullableDate,
    endDate: optionalNullableDate,
  })
  .strict();

const workExperienceSchema = z
  .object({
    companyName: optionalNullableTrimmedString,
    position: optionalNullableTrimmedString,
    startDate: optionalNullableDate,
    endDate: optionalNullableDate,
    description: optionalNullableTrimmedString,
    achievements: stringArray,
  })
  .strict();

const projectSchema = z
  .object({
    name: optionalNullableTrimmedString,
    role: optionalNullableTrimmedString,
    technologies: stringArray,
    description: optionalNullableTrimmedString,
    projectUrl: optionalNullableTrimmedString,
  })
  .strict();

const certificationSchema = z
  .object({
    name: optionalNullableTrimmedString,
    issuer: optionalNullableTrimmedString,
    issueDate: optionalNullableDate,
    expirationDate: optionalNullableDate,
    credentialId: optionalNullableTrimmedString,
    credentialUrl: optionalNullableTrimmedString,
  })
  .strict();

const languageSchema = z
  .object({
    name: optionalNullableTrimmedString,
    proficiency: z
      .union([
        z.null(),
        z.enum(Object.values(CV_LANGUAGE_PROFICIENCY), {
          errorMap: () => ({
            message:
              "Language proficiency must use the canonical proficiency enum",
          }),
        }),
      ])
      .optional(),
  })
  .strict();

const saveGeneratedDraftContentSchema = z
  .object({
    personalInfo: personalInfoSchema,
    professionalSummary: optionalNullableTrimmedString,
    educations: z.array(educationSchema).optional(),
    skills: stringArray,
    workExperiences: z.array(workExperienceSchema).optional(),
    projects: z.array(projectSchema).optional(),
    certifications: z.array(certificationSchema).optional(),
    languages: z.array(languageSchema).optional(),
    hiddenSections: z
      .array(
        z.enum(HARVARD_CV_SECTION_VALUES, {
          errorMap: () => ({
            message:
              "hiddenSections members must use the canonical Harvard section vocabulary",
          }),
        }),
      )
      .optional(),
  })
  .strict();

const validateSaveGeneratedDraftContent = (request, _response, next) => {
  const parsed = saveGeneratedDraftContentSchema.safeParse(request.body ?? {});

  if (!parsed.success) {
    const [firstIssue] = parsed.error.issues;

    return next(
      new AppError(400, firstIssue.message, {
        field: firstIssue.path.join(".") || undefined,
      }),
    );
  }

  request.body = parsed.data;

  return next();
};

export default validateSaveGeneratedDraftContent;
