import CandidateCV from "../models/candidate-cv.model.js";
import AppError from "../utils/app-error.js";
import { aiKit } from "./ai-kit.service.js";
import { prepareOwnCandidateCvJobProfiles } from "./candidate-job-match.service.js";
import {
  prepareOwnGeneratedCvBaseline,
  prepareOwnUploadedCvBaseline,
} from "./candidate-cv-optimization-baseline.service.js";
import {
  buildSourceRevision,
  issueOptimizationProposal,
  verifyOptimizationProposal,
} from "./candidate-cv-optimization-proposal.service.js";
import {
  createGeneratedDraftCandidateCv,
  loadOwnActiveCandidateCv,
  normalizeGeneratedContentForPersistence,
} from "./candidate-cv.service.js";
import { loadPublicJobDiscoverySource } from "./job-discovery.service.js";

// The request supplies only resource IDs and prior V04 advice. Authorized
// profiles and baseline are always prepared from the current canonical sources.
const optimizeOwnCandidateCvForJob = async ({
  actorUser, jobId, candidateCvId, evaluationResult, onSourceSnapshot,
} = {}) => {
  let sourceSnapshot;
  const { jobNormalizationResult, cvNormalizationResult } =
    await prepareOwnCandidateCvJobProfiles({
      actorUser, jobId, candidateCvId,
      onAuthorizedCvSource: (source) => { sourceSnapshot = source; },
    });
  const jobMatchProfile = jobNormalizationResult.profile;
  const cvMatchProfile = cvNormalizationResult.profile;
  const authorizedJobId = jobMatchProfile.source?.jobId;
  const authorizedCvId = cvMatchProfile.source?.candidateCvId;

  if (authorizedJobId !== jobId?.toString()
    || authorizedCvId !== candidateCvId?.toString()) {
    throw new AppError(500, "AI source identity does not match the authorized request");
  }
  if (evaluationResult?.jobId !== authorizedJobId
    || evaluationResult?.candidateCvId !== authorizedCvId) {
    throw new AppError(400, "Evaluation does not belong to the selected Job and CV");
  }
  if (!sourceSnapshot || sourceSnapshot._id?.toString() !== authorizedCvId) {
    throw new AppError(500, "AI CV source snapshot is unavailable or mismatched");
  }

  onSourceSnapshot?.(sourceSnapshot);

  const baselineInput = {
    actorUser,
    candidateUserId: actorUser._id,
    candidateCvId: authorizedCvId,
    sourceSnapshot,
  };
  let generatedBaseline;
  if (cvMatchProfile.source.type === "GENERATED_CV") {
    generatedBaseline = await prepareOwnGeneratedCvBaseline(baselineInput);
  } else if (cvMatchProfile.source.type === "UPLOADED_CV") {
    generatedBaseline = await prepareOwnUploadedCvBaseline({
      ...baselineInput,
      normalizationResult: cvNormalizationResult,
    });
  } else {
    throw new AppError(500, "AI CV source type is invalid");
  }

  const optimizationResult = await aiKit.optimizeCv({
    jobMatchProfile,
    cvMatchProfile,
    generatedBaseline: generatedBaseline.careerSections,
    evaluationResult,
  });

  return {
    jobId: authorizedJobId,
    candidateCvId: authorizedCvId,
    generatedBaseline,
    optimizationResult,
  };
};

const mergeOptimizationWithBaseline = (generatedBaseline, optimizationResult) => ({
  ...structuredClone(generatedBaseline.generatedContent),
  ...Object.fromEntries(Object.entries(generatedBaseline.careerSections).map(([section, value]) => [
    section,
    structuredClone(optimizationResult[section] === null
      ? generatedBaseline.generatedContent[section] ?? value
      : optimizationResult[section]),
  ])),
  ...(optimizationResult.professionalSummary === null
    ? {}
    : { professionalSummaryHtml: null }),
});

// AI-V06 F03 Optimize/Preview: no persistence. Both sides use the V7 Generated
// content normalizer that Commit/create will apply, so Preview equals Save.
const previewOptimizedCandidateCvForJob = async (input) => {
  let sourceSnapshot;
  const {
    jobId, candidateCvId, generatedBaseline, optimizationResult,
  } = await optimizeOwnCandidateCvForJob({
    ...input,
    onSourceSnapshot: (source) => { sourceSnapshot = source; },
  });
  const proposedContent = normalizeGeneratedContentForPersistence(
    mergeOptimizationWithBaseline(generatedBaseline, optimizationResult),
  );
  return {
    baseline: normalizeGeneratedContentForPersistence(generatedBaseline.generatedContent),
    proposedContent,
    proposal: issueOptimizationProposal({
      candidateUserId: input.actorUser._id,
      jobId,
      candidateCvId,
      metadata: generatedBaseline.metadata,
      proposedContent,
      sourceRevision: buildSourceRevision(sourceSnapshot),
    }),
  };
};

const COMMIT_REJECTIONS = {
  MALFORMED: [400, "Optimization Proposal is malformed"],
  INVALID_SIGNATURE: [400, "Optimization Proposal signature is invalid"],
  EXPIRED: [400, "Optimization Proposal has expired"],
  IDENTITY_MISMATCH: [403, "Optimization Proposal does not belong to this Candidate, Job or CV"],
};

const DATE_FIELDS = {
  educations: ["startDate", "endDate"],
  workExperiences: ["startDate", "endDate"],
  certifications: ["issueDate", "expirationDate"],
};

// Preview = Save: the signed content must already be in V7 persisted shape, so
// the V7 create owner (which normalizes again) stores exactly what was previewed.
const assertProposedContentPersistable = (content) => {
  const invalid = () => new AppError(400, "Optimization Proposal content is not persistable", {
    field: "proposal",
  });
  if (!content || typeof content !== "object") throw invalid();
  for (const [section, fields] of Object.entries(DATE_FIELDS)) {
    for (const item of content[section] ?? []) {
      for (const field of fields) {
        const value = item?.[field];
        if (value != null && (typeof value !== "string"
          || Number.isNaN(Date.parse(value))
          || new Date(value).toISOString() !== value)) throw invalid();
      }
    }
  }
  const normalized = normalizeGeneratedContentForPersistence(structuredClone(content));
  if (!isDeepEqual(normalized, content)) throw invalid();
};

const isDeepEqual = (a, b) => {
  const canon = (v) => (Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v);
  return JSON.stringify(canon(JSON.parse(JSON.stringify(a))))
    === JSON.stringify(canon(JSON.parse(JSON.stringify(b))));
};

// AI-V06 F03 Commit: no AI call, no Uploaded PDF read. Saves the signed
// proposedContent as a new Generated Draft through the V7 owner.
const commitOptimizedCandidateCvProposalForJob = async ({ actorUser, jobId, proposal }) => {
  const payload = proposal?.payload;
  const verification = verifyOptimizationProposal(proposal, {
    candidateUserId: actorUser._id,
    jobId,
    candidateCvId: payload?.candidateCvId,
  });
  if (!verification.valid) {
    const [status, message] = COMMIT_REJECTIONS[verification.reason];
    throw new AppError(status, message, { field: "proposal" });
  }

  await loadPublicJobDiscoverySource({ actorUser, jobId });
  const sourceConflict = () => new AppError(
    409, "Source CV changed since the proposal was created; optimize again", {
      field: "candidateCvId",
    });
  let source;
  try {
    source = await loadOwnActiveCandidateCv({
      candidateUserId: actorUser._id,
      actorUser,
      candidateCvId: payload.candidateCvId,
      lean: true,
    });
  } catch (error) {
    // An owned Source archived after Preview is a Source change (409); missing or
    // foreign Sources keep the 404 so ownership is not disclosed.
    if (error.statusCode === 404 || error.status === 404) {
      const archived = await CandidateCV.exists({
        _id: payload.candidateCvId,
        candidateUserId: actorUser._id,
        archivedAt: { $ne: null },
      });
      if (archived) throw sourceConflict();
    }
    throw error;
  }
  if (!isDeepEqual(buildSourceRevision(source), payload.sourceRevision)) {
    throw sourceConflict();
  }

  assertProposedContentPersistable(payload.proposedContent);
  return createGeneratedDraftCandidateCv({
    candidateUserId: actorUser._id,
    actorUser,
    draft: payload.metadata,
    generatedContent: payload.proposedContent,
  });
};

export {
  commitOptimizedCandidateCvProposalForJob,
  optimizeOwnCandidateCvForJob,
  previewOptimizedCandidateCvForJob,
};
