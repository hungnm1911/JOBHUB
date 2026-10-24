import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const normalizeJobSpy = vi.hoisted(() => vi.fn());
const normalizeUploadedSpy = vi.hoisted(() => vi.fn());
const evaluateSpy = vi.hoisted(() => vi.fn());
const codexCall = vi.hoisted(() => vi.fn());

vi.mock("../../../ai-kit/src/llm/codex-client.js", () => ({
  createCodexClient: () => ({ createResponse: codexCall }),
}));
vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  normalizeJobSpy.mockImplementation(actual.aiKit.normalizeJob);
  return { aiKit: Object.freeze({
    ...actual.aiKit,
    normalizeJob: normalizeJobSpy,
    evaluateCv: evaluateSpy,
  }) };
});
vi.mock("../../src/services/candidate-cv-ai-normalization.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, normalizeOwnUploadedCandidateCv: normalizeUploadedSpy };
});

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

let sequence = 0;
const providerResponse = (output) => ({
  status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(output) }] }],
});
const feedback = (overrides = {}) => ({
  requirementGroups: [{ requirement: "Node.js", priority: "REQUIRED", semanticScore: 0,
    evidenceState: "NO_EVIDENCE", jobSourceIds: ["J0"], cvSourceIds: [] }],
  overallSummary: "Add verified evidence of Node.js work if available.",
  fieldReviews: { skills: "No evidence", category: "Aligned", experience: "Unknown",
    employmentType: "Unknown", workMode: "Unknown" },
  cvImprovements: [{ section: "professionalSummary", cvSourceId: null,
    comment: "No summary yet", suggestion: "Describe relevant verified work", rewrite: null }],
  ...overrides,
});

const setup = async ({ jobStatus = JOB_STATUS.PUBLISHED,
  sourceType = CANDIDATE_CV_SOURCE_TYPE.GENERATED } = {}) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v04-candidate-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v04-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V04-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v04-recruiter-${marker}@example.com`,
    company: manager.company,
    employeeCode: `AI-V04-R-${marker}`,
  });
  const category = await Category.create({ name: `AI-V04 Field ${marker}`, level: CATEGORY_LEVEL.FIELD });
  const job = await Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: recruiter.membership._id,
    primaryRecruiterCompanyMemberId: recruiter.membership._id,
    status: jobStatus,
    publishedAt: jobStatus === JOB_STATUS.DRAFT ? null : new Date("2026-01-01"),
    applicationDeadline: new Date(Date.now() + 86_400_000),
    title: "Backend Engineer",
    jobDescription: "Build canonical services with Node.js",
    requiredSkills: ["Node.js"],
    salary: { type: "NEGOTIABLE" },
    fieldCategoryIds: [category._id],
    positionCategoryIds: [],
    experienceLevelId: null,
    employmentType: "FULL_TIME",
    workModes: ["HYBRID"],
    location: { provinceCode: "01", districtCode: null },
  });
  const candidateCv = await CandidateCV.create({
    candidateUserId: candidate.user._id,
    name: "My CV",
    sourceType,
    status: sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
      ? CANDIDATE_CV_STATUS.DRAFT : CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: category._id,
    ...(sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
      ? { generatedContent: {} }
      : { uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/current",
        originalFileName: "current.pdf", mimeType: "application/pdf",
        sizeBytes: 100, pageCount: 1, uploadedAt: new Date(),
      } }),
  });
  const requestEvaluation = (cvId = candidateCv._id.toString(), jobId = job._id.toString()) =>
    agent.post(`/api/candidate/jobs/${jobId}/evaluate-cv`)
      .set("Authorization", `Bearer ${token}`)
      .send({ candidateCvId: cvId });
  return { agent, candidateCv, job, manager, requestEvaluation };
};

describe("AI-V04 Slice 2 — Candidate CV Evaluation HTTP", () => {
  beforeAll(connectTestDatabase);
  beforeEach(() => {
    evaluateSpy.mockReset();
    normalizeUploadedSpy.mockReset();
    normalizeJobSpy.mockClear();
    codexCall.mockReset();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("returns the complete runtime evaluation from an own private Generated Draft and persisted Job", async () => {
    const { job, candidateCv, requestEvaluation } = await setup();
    const { aiKit } = await vi.importActual("../../src/services/ai-kit.service.js");
    evaluateSpy.mockImplementation(aiKit.evaluateCv);
    codexCall.mockResolvedValue(providerResponse(feedback()));

    const response = await requestEvaluation().expect(200);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(normalizeJobSpy).toHaveBeenCalledOnce();
    expect(normalizeJobSpy.mock.calls[0][0]).toMatchObject({
      jobId: job._id.toString(), requiredSkills: ["Node.js"],
    });
    expect(evaluateSpy).toHaveBeenCalledOnce();
    expect(evaluateSpy.mock.calls[0][0].jobNormalizationResult.status).toBe("READY");
    expect(evaluateSpy.mock.calls[0][0].cvNormalizationResult.status).toBe("READY");
    expect(codexCall).toHaveBeenCalledOnce();
    expect(response.body.evaluationResult).toMatchObject({
      jobId: job._id.toString(), candidateCvId: candidateCv._id.toString(),
      matchScore: expect.any(Number), overallSummary: feedback().overallSummary,
      fieldReviews: [
        { criterion: "skills", score: 0, review: "No evidence" },
        { criterion: "category", score: expect.any(Number), review: "Aligned" },
        { criterion: "experience", score: expect.any(Number), review: "Unknown" },
        { criterion: "employmentType", score: expect.any(Number), review: "Unknown" },
        { criterion: "workMode", score: expect.any(Number), review: "Unknown" },
      ],
      cvImprovements: [{ section: "professionalSummary", sourceReference: null,
        comment: "No summary yet", suggestion: "Describe relevant verified work", rewrite: null }],
    });
    expect(await CandidateCV.findById(candidateCv._id)).toMatchObject({
      status: CANDIDATE_CV_STATUS.DRAFT, visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    });
  });

  it("accepts sparse feedback and a low score as a successful business result", async () => {
    const { requestEvaluation } = await setup();
    evaluateSpy.mockResolvedValue({ jobId: "job", candidateCvId: "cv", matchScore: 0,
      overallSummary: "", fieldReviews: [], cvImprovements: [] });

    const response = await requestEvaluation().expect(200);
    expect(response.body.evaluationResult).toMatchObject({ matchScore: 0,
      overallSummary: "", cvImprovements: [] });
  });

  it("passes an own Uploaded CV through the existing normalization entry", async () => {
    const { candidateCv, requestEvaluation } = await setup({ sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED });
    normalizeUploadedSpy.mockResolvedValue({ status: "READY",
      profile: { source: { candidateCvId: candidateCv._id.toString() } } });
    evaluateSpy.mockResolvedValue({ matchScore: 0, fieldReviews: [], cvImprovements: [] });

    await requestEvaluation().expect(200);
    expect(normalizeUploadedSpy).toHaveBeenCalledOnce();
    expect(evaluateSpy.mock.calls[0][0].cvNormalizationResult.profile.source.candidateCvId)
      .toBe(candidateCv._id.toString());
  });

  it("rejects anonymous and non-Candidate callers before evaluation", async () => {
    const { agent, job, candidateCv } = await setup();
    const admin = await createVerifiedUser({
      email: `ai-v04-admin-${++sequence}@example.com`, role: USER_ROLE.PLATFORM_ADMIN,
    });
    const adminToken = await loginAndGetAccessToken(agent, { email: admin.user.email });
    const path = `/api/candidate/jobs/${job._id}/evaluate-cv`;

    await agent.post(path).send({ candidateCvId: candidateCv._id.toString() }).expect(401);
    await agent.post(path).set("Authorization", `Bearer ${adminToken}`)
      .send({ candidateCvId: candidateCv._id.toString() }).expect(403);
    expect(evaluateSpy).not.toHaveBeenCalled();
  });

  it("rejects a foreign or archived CV before reading the Job source", async () => {
    const { candidateCv, requestEvaluation } = await setup();
    const other = await createVerifiedUser({ email: `ai-v04-other-${++sequence}@example.com` });
    const foreignCv = await CandidateCV.create({
      candidateUserId: other.user._id, name: "Other CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT, visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      categoryId: candidateCv.categoryId, generatedContent: {},
    });

    await requestEvaluation(foreignCv._id.toString()).expect(404);
    await CandidateCV.updateOne({ _id: candidateCv._id }, { archivedAt: new Date() });
    await requestEvaluation().expect(404);
    expect(normalizeJobSpy).not.toHaveBeenCalled();
    expect(evaluateSpy).not.toHaveBeenCalled();
  });

  it("uses V8 visibility for drafts, historical Jobs, and inactive Companies", async () => {
    const { job, manager, requestEvaluation } = await setup({ jobStatus: JOB_STATUS.DRAFT });
    evaluateSpy.mockResolvedValue({ matchScore: 0 });
    await requestEvaluation().expect(404);

    await Job.updateOne({ _id: job._id }, {
      status: JOB_STATUS.CLOSED, publishedAt: new Date("2026-01-01"),
    });
    await requestEvaluation().expect(200);
    await Company.updateOne({ _id: manager.company._id }, {
      operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED,
    });
    await requestEvaluation().expect(404);
    expect(evaluateSpy).toHaveBeenCalledOnce();
  });

  it("stops on failed normalization without returning an evaluation", async () => {
    const { requestEvaluation } = await setup();
    normalizeJobSpy.mockReturnValueOnce({ status: "FAILED", profile: null });

    const response = await requestEvaluation().expect(503);
    expect(response.body.evaluationResult).toBeUndefined();
    expect(evaluateSpy).not.toHaveBeenCalled();
  });

  it("stops when Uploaded CV normalization fails", async () => {
    const { requestEvaluation } = await setup({ sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED });
    normalizeUploadedSpy.mockResolvedValue({ status: "FAILED", profile: null });

    const response = await requestEvaluation().expect(503);
    expect(response.body.evaluationResult).toBeUndefined();
    expect(evaluateSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid resource IDs through the existing access checks", async () => {
    const { requestEvaluation } = await setup();

    await requestEvaluation("invalid-cv").expect(404);
    await requestEvaluation(undefined, "invalid-job").expect(400);
    expect(evaluateSpy).not.toHaveBeenCalled();
  });

  it("treats malformed provider output as an error, not a business score", async () => {
    const { requestEvaluation } = await setup();
    const { aiKit } = await vi.importActual("../../src/services/ai-kit.service.js");
    evaluateSpy.mockImplementation(aiKit.evaluateCv);
    codexCall.mockResolvedValue(providerResponse({ requirementGroups: [] }));

    const response = await requestEvaluation().expect(500);
    expect(response.body.evaluationResult).toBeUndefined();
    expect(response.body.error.message).toBe("Internal server error");
    expect(codexCall).toHaveBeenCalledOnce();
  });

  it("uses the global error handler for provider failure without a fabricated result", async () => {
    const { requestEvaluation } = await setup();
    evaluateSpy.mockRejectedValue(new Error("provider unavailable"));

    const response = await requestEvaluation().expect(500);
    expect(response.body.evaluationResult).toBeUndefined();
    expect(response.body.error.message).toBe("Internal server error");
  });
});
