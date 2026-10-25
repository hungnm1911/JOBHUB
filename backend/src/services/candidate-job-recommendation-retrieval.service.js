import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import COMPANY_APPROVAL_STATUS from "../constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../constants/company-operational-status.js";
import JOB_DISCOVERY_VISIBILITY from "../constants/job-discovery-visibility.js";
import JOB_STATUS from "../constants/job-status.js";
import Company from "../models/company.model.js";
import Job from "../models/job.model.js";
import AppError from "../utils/app-error.js";
import { aiKit } from "./ai-kit.service.js";
import {
  normalizeOwnGeneratedCandidateCv,
  normalizeOwnUploadedCandidateCv,
} from "./candidate-cv-ai-normalization.service.js";
import { loadOwnDefaultCandidateCv } from "./candidate-cv.service.js";
import { resolveJobDiscoveryVisibility } from "./job.service.js";

const INDEX_NAME = "job_embedding_text_v05_vector_idx";
const RETRIEVAL_LIMIT = 50;

const retrieveOwnDefaultCvJobCandidates = async ({ actorUser, now = new Date() } = {}) => {
  const defaultCv = await loadOwnDefaultCandidateCv({ actorUser });
  const normalizeCv = defaultCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
    ? normalizeOwnGeneratedCandidateCv
    : defaultCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED
      ? normalizeOwnUploadedCandidateCv
      : null;
  if (!normalizeCv) throw new AppError(500, "Default CV source type is invalid");

  const normalizationResult = await normalizeCv({
    candidateUserId: actorUser._id,
    actorUser,
    candidateCvId: defaultCv._id,
  });
  if (normalizationResult?.status !== "READY" || !normalizationResult.profile) {
    throw new AppError(503, "Default CV normalization is unavailable");
  }

  // Default designation can change while an Uploaded CV is being normalized.
  const currentDefault = await loadOwnDefaultCandidateCv({ actorUser });
  if (!currentDefault._id.equals(defaultCv._id)) {
    throw new AppError(409, "Default CV changed during retrieval");
  }

  const queryText = aiKit.buildCvQueryText(normalizationResult);
  if (!queryText) throw new AppError(503, "Default CV has no career query content");

  const eligibleCompanies = await Company.find({
    approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
    operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
  }).select("_id").lean();
  if (eligibleCompanies.length === 0) return [];

  const hits = await Job.aggregate([
    { $vectorSearch: {
      index: INDEX_NAME,
      path: "embeddingText",
      query: { text: queryText },
      model: "voyage-4",
      filter: {
        status: JOB_STATUS.PUBLISHED,
        publishedAt: { $ne: null },
        applicationDeadline: { $gt: now },
        companyId: { $in: eligibleCompanies.map(({ _id }) => _id) },
      },
      numCandidates: 1000,
      limit: RETRIEVAL_LIMIT,
    } },
    { $project: { _id: 1, vectorScore: { $meta: "vectorSearchScore" } } },
  ]);

  if (hits.length === 0) return [];

  const jobs = await Job.find({ _id: { $in: hits.map(({ _id }) => _id) } }).lean();
  const jobsWithCompany = jobs.filter((job) => job?.companyId != null);
  const jobById = new Map(jobsWithCompany.map((job) => [job._id.toString(), job]));
  const companies = await Company.find({
    _id: { $in: [...new Set(jobsWithCompany.map((job) => job.companyId.toString()))] },
  }).select("_id approvalStatus operationalStatus").lean();
  const companyById = new Map(companies.map((company) => [company._id.toString(), company]));

  return hits.flatMap((hit, index) => {
    const job = jobById.get(hit._id.toString());
    if (!job) return [];
    const company = companyById.get(job.companyId.toString());
    if (resolveJobDiscoveryVisibility({ job, company, now: new Date() })
      !== JOB_DISCOVERY_VISIBILITY.DISCOVERABLE) return [];
    return [{ job, vectorScore: hit.vectorScore, retrievalRank: index + 1 }];
  });
};

export { retrieveOwnDefaultCvJobCandidates };
