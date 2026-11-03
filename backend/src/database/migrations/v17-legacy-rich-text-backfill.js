import mongoose from "mongoose";

import { MODEL_AUTO_INIT_DISABLED_OPTIONS } from "../../config/mongodb.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../constants/candidate-cv-status.js";
import JOB_STATUS from "../../constants/job-status.js";
import CandidateCV from "../../models/candidate-cv.model.js";
import Job from "../../models/job.model.js";
import { normalizeRichText } from "../../services/rich-text.service.js";

const name = "v17-legacy-rich-text-backfill";
const connectionOptions = MODEL_AUTO_INIT_DISABLED_OPTIONS;
const SAMPLE_LIMIT = 20;

const escapeText = (value) => value.replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

// Legacy text is always escaped as literal text. Never parse markup-looking
// characters from a plain field as source HTML.
const compatibleHtml = (plain, preset) => {
  if (typeof plain !== "string" || plain.trim() === "") return null;
  const candidate = `<p>${escapeText(plain).replace(/\r\n?|\n/gu, "<br>")}</p>`;
  const normalized = normalizeRichText(candidate, preset);
  return normalized.text === plain ? normalized.html : null;
};

const newCounts = () => ({
  scanned: 0,
  eligibleRecords: 0,
  eligibleFields: 0,
  existingHtmlFields: 0,
  emptyPlainFields: 0,
  incompatiblePlainFields: 0,
  excludedRecords: 0,
  modifiedRecords: 0,
  changedConcurrently: 0,
  samples: [],
});

const sample = (counts, id, fields) => {
  if (counts.samples.length < SAMPLE_LIMIT) counts.samples.push({ id: id.toString(), fields });
};

const addField = (counts, set, path, plain, html, preset) => {
  if (html != null) {
    counts.existingHtmlFields += 1;
    return;
  }
  if (typeof plain !== "string" || plain.trim() === "") {
    counts.emptyPlainFields += 1;
    return;
  }
  const compatible = compatibleHtml(plain, preset);
  if (compatible == null) {
    counts.incompatiblePlainFields += 1;
    return;
  }
  set[path] = compatible;
  counts.eligibleFields += 1;
};

const scanJobs = async (connection, write) => {
  const counts = newCounts();
  const cursor = Job.collection.find({}, {
    projection: { _id: 1, status: 1, jobDescription: 1, jobDescriptionHtml: 1 },
  });
  for await (const job of cursor) {
    counts.scanned += 1;
    if (job.status !== JOB_STATUS.DRAFT) {
      counts.excludedRecords += 1;
      continue;
    }
    const set = {};
    addField(counts, set, "jobDescriptionHtml", job.jobDescription,
      job.jobDescriptionHtml, "full");
    if (Object.keys(set).length === 0) continue;
    counts.eligibleRecords += 1;
    sample(counts, job._id, Object.keys(set));
    if (!write) continue;
    const result = await connection.db.collection(Job.collection.name).updateOne(
      { _id: job._id, status: JOB_STATUS.DRAFT,
        jobDescription: job.jobDescription, jobDescriptionHtml: null },
      { $set: set },
    );
    if (result.modifiedCount === 1) counts.modifiedRecords += 1;
    else counts.changedConcurrently += 1;
  }
  return counts;
};

const scanCandidateCvs = async (connection, write) => {
  const counts = newCounts();
  const cursor = CandidateCV.collection.find({}, {
    projection: { _id: 1, sourceType: 1, status: 1, archivedAt: 1,
      generatedContent: 1 },
  });
  for await (const cv of cursor) {
    counts.scanned += 1;
    if (cv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED ||
      ![CANDIDATE_CV_STATUS.DRAFT, CANDIDATE_CV_STATUS.ACTIVE].includes(cv.status) ||
      cv.archivedAt != null || cv.generatedContent == null ||
      typeof cv.generatedContent !== "object" || Array.isArray(cv.generatedContent)) {
      counts.excludedRecords += 1;
      continue;
    }
    const content = cv.generatedContent;
    const set = {};
    addField(counts, set, "generatedContent.professionalSummaryHtml",
      content.professionalSummary, content.professionalSummaryHtml, "minimal");
    for (const section of ["workExperiences", "projects"]) {
      if (!Array.isArray(content[section])) continue;
      content[section].forEach((item, index) => {
        if (item == null || typeof item !== "object" || Array.isArray(item)) return;
        addField(counts, set, `generatedContent.${section}.${index}.descriptionHtml`,
          item.description, item.descriptionHtml, "minimal");
      });
    }
    if (Object.keys(set).length === 0) continue;
    counts.eligibleRecords += 1;
    sample(counts, cv._id, Object.keys(set));
    if (!write) continue;
    // Compare the entire original content so an edit or array reorder cannot
    // receive HTML calculated for an older plain value or item position.
    const result = await connection.db.collection(CandidateCV.collection.name).updateOne(
      { _id: cv._id, sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        status: { $in: [CANDIDATE_CV_STATUS.DRAFT, CANDIDATE_CV_STATUS.ACTIVE] },
        archivedAt: null, generatedContent: content },
      { $set: set },
    );
    if (result.modifiedCount === 1) counts.modifiedRecords += 1;
    else counts.changedConcurrently += 1;
  }
  return counts;
};

const scan = async (connection, write) => {
  if (connection.readyState !== 1) {
    throw new Error("MongoDB connection must be ready before V17 rich text migration");
  }
  return {
    name,
    mode: write ? "migration" : "preflight",
    jobs: await scanJobs(connection, write),
    candidateCvs: await scanCandidateCvs(connection, write),
  };
};

const preflight = async (connection = mongoose.connection) => scan(connection, false);
const migrate = async (connection = mongoose.connection) => scan(connection, true);

export { connectionOptions, migrate, name, preflight };
