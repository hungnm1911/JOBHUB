import { z } from "zod";

import AppError from "../utils/app-error.js";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");
// V04 advice can target Uploaded CV sections outside V06's seven output fields.
const evaluationSection = z.enum([
  "careerPositioning", "professionalSummary", "skills", "workExperiences",
  "projects", "educations", "certifications", "languages",
  "otherCareerClaims", "unresolvedContent",
]);

// V04's runtime result is advisory context. The service still checks its
// identity against the authorized Job and CV and sources Candidate facts itself.
const evaluationResult = z.object({
  jobId: objectId,
  candidateCvId: objectId,
  matchScore: z.number().finite().min(0).max(100),
  overallSummary: z.string(),
  fieldReviews: z.array(z.object({
    criterion: z.enum(["skills", "category", "experience", "employmentType", "workMode"]),
    score: z.number().finite().min(0).max(100),
    review: z.string(),
  }).strict()).length(5).refine((reviews) =>
    new Set(reviews.map(({ criterion }) => criterion)).size === 5,
  "Evaluation must review each scoring criterion once"),
  cvImprovements: z.array(z.object({
    section: evaluationSection,
    sourceReference: z.object({
      sourcePath: z.string().nullable().optional(),
      evidence: z.array(z.unknown()).optional(),
    }).passthrough().nullable(),
    comment: z.string(),
    suggestion: z.string().nullable(),
    rewrite: z.string().nullable(),
  }).strict()),
}).strict();

const requestSchema = z.object({ candidateCvId: objectId, evaluationResult }).strict();

const validateOptimizeCandidateCv = (request, _response, next) => {
  const parsed = requestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return next(new AppError(400, issue.message, {
      field: issue.path.join(".") || undefined,
    }));
  }

  request.body = parsed.data;
  return next();
};

export default validateOptimizeCandidateCv;
