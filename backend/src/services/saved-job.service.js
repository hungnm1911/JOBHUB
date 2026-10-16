import mongoose from "mongoose";

import JOB_DISCOVERY_VISIBILITY from "../constants/job-discovery-visibility.js";
import USER_ROLE from "../constants/user-role.js";
import Company from "../models/company.model.js";
import Job from "../models/job.model.js";
import Application from "../models/application.model.js";
import SavedJob from "../models/saved-job.model.js";
import {
  resolveEffectiveJobStatus,
  resolveJobDiscoveryVisibility,
  toPublicJobLocation,
  toPublicJobSalary,
} from "./job.service.js";
import AppError from "../utils/app-error.js";

const assertCandidate = (actorUser, candidateUserId) => {
  if (actorUser?.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }
  if (!candidateUserId?.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only manage their own Saved Jobs");
  }
};

const normalizeJobId = (jobId) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(400, "Invalid Job id", { field: "jobId" });
  }
  return new mongoose.Types.ObjectId(jobId);
};

const loadAccessibleJob = async (jobId) => {
  const job = await Job.findById(jobId).lean();
  if (!job) throw new AppError(404, "Job not found", { field: "jobId" });
  const company = await Company.findById(job.companyId)
    .select("_id name logoUrl approvalStatus operationalStatus")
    .lean();
  const visibility = resolveJobDiscoveryVisibility({ job, company });
  if (visibility === JOB_DISCOVERY_VISIBILITY.INACCESSIBLE) {
    throw new AppError(404, "Job not found", { field: "jobId" });
  }
  return { job, company, visibility };
};

const isDuplicate = (error) => error?.code === 11000;

const saveJob = async ({ candidateUserId, actorUser, jobId }) => {
  assertCandidate(actorUser, candidateUserId);
  const normalizedJobId = normalizeJobId(jobId);
  await loadAccessibleJob(normalizedJobId);

  let saved;
  try {
    saved = await SavedJob.findOneAndUpdate(
      { candidateUserId, jobId: normalizedJobId },
      { $setOnInsert: { candidateUserId, jobId: normalizedJobId, savedAt: new Date() } },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    ).lean();
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    saved = await SavedJob.findOne({ candidateUserId, jobId: normalizedJobId }).lean();
  }

  return { message: "Job saved successfully.", saved: true, savedAt: saved.savedAt };
};

const unsaveJob = async ({ candidateUserId, actorUser, jobId }) => {
  assertCandidate(actorUser, candidateUserId);
  const normalizedJobId = normalizeJobId(jobId);
  await SavedJob.deleteOne({ candidateUserId, jobId: normalizedJobId });
  return { message: "Job unsaved successfully.", saved: false };
};

const toSavedJobProjection = ({ job, company }) => ({
  id: job._id.toString(),
  title: job.title,
  company: {
    id: company._id.toString(),
    name: company.name,
    logoUrl: company.logoUrl ?? null,
  },
  location: toPublicJobLocation(job.location),
  employmentType: job.employmentType,
  workModes: job.workModes,
  salary: toPublicJobSalary(job.salary),
  status: resolveEffectiveJobStatus(job),
  publishedAt: job.publishedAt,
  applicationDeadline: job.applicationDeadline,
});

const listSavedJobs = async ({ candidateUserId, actorUser }) => {
  assertCandidate(actorUser, candidateUserId);
  const savedJobs = await SavedJob.find({ candidateUserId })
    .sort({ savedAt: -1, _id: -1 })
    .lean();
  if (savedJobs.length === 0) return { savedJobs: [] };

  const jobIds = savedJobs.map((entry) => entry.jobId);
  const jobs = await Job.find({ _id: { $in: jobIds } }).lean();
  const companies = await Company.find({ _id: { $in: jobs.map((job) => job.companyId) } })
    .select("_id name logoUrl approvalStatus operationalStatus")
    .lean();
  const jobById = new Map(jobs.map((job) => [job._id.toString(), job]));
  const companyById = new Map(companies.map((company) => [company._id.toString(), company]));
  const accessible = [];
  const applications = await Application.find({ candidateUserId, jobId: { $in: jobIds } })
    .select("jobId")
    .lean();
  const appliedJobIds = new Set(applications.map((application) => application.jobId.toString()));

  for (const saved of savedJobs) {
    const job = jobById.get(saved.jobId.toString());
    const company = job && companyById.get(job.companyId.toString());
    const visibility = resolveJobDiscoveryVisibility({ job, company });
    if (visibility === JOB_DISCOVERY_VISIBILITY.INACCESSIBLE) continue;
    accessible.push({
      job: toSavedJobProjection({ job, company }),
      savedAt: saved.savedAt,
      hasApplication: appliedJobIds.has(saved.jobId.toString()),
    });
  }
  return { savedJobs: accessible };
};

export { listSavedJobs, saveJob, unsaveJob };
