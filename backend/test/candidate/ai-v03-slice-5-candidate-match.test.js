import { readFile } from "node:fs/promises";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const normalizeJobSpy = vi.hoisted(() => vi.fn());
const matchSpy = vi.hoisted(() => vi.fn());
const normalizeUploadedSpy = vi.hoisted(() => vi.fn());
const codexCall = vi.hoisted(() => vi.fn());

vi.mock("../../../ai-kit/src/llm/codex-client.js", () => ({
  createCodexClient: () => ({ createResponse: codexCall }),
}));

vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  normalizeJobSpy.mockImplementation(actual.aiKit.normalizeJob);
  return {
    aiKit: Object.freeze({
      ...actual.aiKit,
      normalizeJob: normalizeJobSpy,
      matchJobCv: matchSpy,
    }),
  };
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
import * as fileService from "../../src/services/file.service.js";
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
const emptyPdfExtraction = () => Object.fromEntries([
  "careerPositioning", "professionalSummary", "skills", "workExperiences", "projects",
  "educations", "certifications", "languages", "otherCareerClaims", "unresolvedContent",
].map((group) => [group, []]));
const codexResponse = (output) => ({
  status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(output) }] }],
});
const useRealMatching = async () => {
  const { aiKit } = await vi.importActual("../../src/services/ai-kit.service.js");
  matchSpy.mockImplementation(aiKit.matchJobCv);
};

const setup = async ({ jobStatus = JOB_STATUS.PUBLISHED, sourceType = CANDIDATE_CV_SOURCE_TYPE.GENERATED } = {}) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v03-candidate-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v03-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V03-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v03-recruiter-${marker}@example.com`,
    company: manager.company,
    employeeCode: `AI-V03-R-${marker}`,
  });
  const category = await Category.create({ name: `AI-V03 Field ${marker}`, level: CATEGORY_LEVEL.FIELD });
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
    skillTags: sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED ? ["Node.js"] : [],
    ...(sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
      ? { generatedContent: {} }
      : { uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/current",
        originalFileName: "current.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        pageCount: 1,
        uploadedAt: new Date(),
      } }),
  });
  const requestMatch = (cvId = candidateCv._id.toString(), jobId = job._id.toString()) =>
    agent.post(`/api/candidate/jobs/${jobId}/match`)
      .set("Authorization", `Bearer ${token}`)
      .send({ candidateCvId: cvId });
  return { agent, candidate, candidateCv, job, manager, requestMatch };
};

describe("AI-V03 Slice 5 — Candidate Job–CV Matching HTTP entry", () => {
  beforeAll(connectTestDatabase);
  beforeEach(() => {
    matchSpy.mockReset();
    normalizeUploadedSpy.mockReset();
    normalizeJobSpy.mockClear();
    codexCall.mockReset();
    matchSpy.mockImplementation(async ({ jobNormalizationResult, cvNormalizationResult }) => ({
      jobId: jobNormalizationResult.profile.source.jobId,
      candidateCvId: cvNormalizationResult.profile.source.candidateCvId,
      matchScore: 42,
    }));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("matches an own PRIVATE Generated DRAFT with the persisted Job source", async () => {
    const { job, candidateCv, requestMatch } = await setup();
    const response = await requestMatch().expect(200);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.matchResult).toEqual({
      jobId: job._id.toString(), candidateCvId: candidateCv._id.toString(), matchScore: 42,
    });
    expect(normalizeJobSpy).toHaveBeenCalledOnce();
    expect(normalizeJobSpy.mock.calls[0][0]).toMatchObject({
      jobId: job._id.toString(),
      jobDescription: "Build canonical services with Node.js",
      requiredSkills: ["Node.js"],
    });
    expect(matchSpy).toHaveBeenCalledOnce();
    expect(matchSpy.mock.calls[0][0].jobNormalizationResult.status).toBe("READY");
    expect(matchSpy.mock.calls[0][0].cvNormalizationResult.status).toBe("READY");
  });

  it("uses the existing Uploaded CV normalization entry", async () => {
    const { candidateCv, requestMatch } = await setup({ sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED });
    normalizeUploadedSpy.mockResolvedValue({
      status: "READY", profile: { source: { candidateCvId: candidateCv._id.toString() } },
    });

    await requestMatch().expect(200);
    expect(normalizeUploadedSpy).toHaveBeenCalledOnce();
    expect(matchSpy).toHaveBeenCalledOnce();
  });

  it("passes the real V02 Uploaded CV normalization result into Matching", async () => {
    const { job, candidateCv, requestMatch } = await setup({
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    });
    const pdfBuffer = await readFile(new URL("../../../ai-kit/test/fixtures/pdf-text-extraction.pdf", import.meta.url));
    await CandidateCV.updateOne({ _id: candidateCv._id }, {
      "uploadedFile.sizeBytes": pdfBuffer.length,
    });
    const download = vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);
    const { normalizeOwnUploadedCandidateCv } = await vi.importActual(
      "../../src/services/candidate-cv-ai-normalization.service.js",
    );
    normalizeUploadedSpy.mockImplementation(normalizeOwnUploadedCandidateCv);
    await useRealMatching();
    codexCall
      .mockResolvedValueOnce(codexResponse(emptyPdfExtraction()))
      .mockResolvedValueOnce(codexResponse({ requirementGroups: [{
        requirement: "Node.js", priority: "REQUIRED", semanticScore: 100,
        evidenceState: "SUPPORTED", jobSourceIds: ["J0"], cvSourceIds: ["C0"],
      }] }));

    const response = await requestMatch().expect(200);

    expect(download).toHaveBeenCalledOnce();
    expect(normalizeUploadedSpy).toHaveBeenCalledOnce();
    expect(codexCall).toHaveBeenCalledTimes(2);
    expect(codexCall.mock.calls[0][0].input).toContain("JOBHUB PDF EXTRACTION OK");
    expect(matchSpy).toHaveBeenCalledOnce();
    expect(matchSpy.mock.calls[0][0].cvNormalizationResult).toMatchObject({
      status: "READY",
      profile: {
        source: { type: "UPLOADED_CV", candidateCvId: candidateCv._id.toString() },
        metadata: { skillTags: [{ value: "Node.js" }] },
        pdfContent: emptyPdfExtraction(),
      },
    });
    expect(response.body.matchResult).toMatchObject({
      jobId: job._id.toString(), candidateCvId: candidateCv._id.toString(),
      skillsScore: 100, categoryScore: 70,
    });
  });

  it("returns a complete Match Result for a sparse READY CV through HTTP", async () => {
    const { job, candidateCv, requestMatch } = await setup();
    await useRealMatching();
    codexCall.mockResolvedValue(codexResponse({ requirementGroups: [{
      requirement: "Node.js", priority: "REQUIRED", semanticScore: 0,
      evidenceState: "NO_EVIDENCE", jobSourceIds: ["J0"], cvSourceIds: [],
    }] }));

    const response = await requestMatch().expect(200);

    expect(matchSpy.mock.calls[0][0].cvNormalizationResult).toMatchObject({
      status: "READY", profile: { metadata: { skillTags: [] } },
    });
    expect(codexCall).toHaveBeenCalledOnce();
    expect(response.body.matchResult).toMatchObject({
      jobId: job._id.toString(), candidateCvId: candidateCv._id.toString(),
      skillsScore: 0,
      categoryScore: expect.any(Number), experienceScore: expect.any(Number),
      employmentTypeScore: expect.any(Number), workModeScore: expect.any(Number),
      weights: { skills: 0.4, category: 0.25, experience: 0.25,
        employmentType: 0.05, workMode: 0.05 },
    });
    const result = response.body.matchResult;
    expect(result.matchScore).toBeCloseTo(Object.values(result.contributions)
      .reduce((sum, contribution) => sum + contribution, 0));
  });

  it("returns an error without a Match Result when Matching inference fails", async () => {
    const { requestMatch } = await setup();
    await useRealMatching();
    codexCall.mockRejectedValue(new Error("provider unavailable"));

    const response = await requestMatch().expect(500);

    expect(matchSpy).toHaveBeenCalledOnce();
    expect(codexCall).toHaveBeenCalledOnce();
    expect(response.body.matchResult).toBeUndefined();
    expect(response.body.error.message).toBe("Internal server error");
  });

  it("rejects anonymous and non-Candidate actors before matching", async () => {
    const { agent, job, candidateCv } = await setup();
    const recruiter = await createVerifiedUser({ email: `ai-v03-actor-${++sequence}@example.com`, role: USER_ROLE.PLATFORM_ADMIN });
    const adminToken = await loginAndGetAccessToken(agent, { email: recruiter.user.email });
    const path = `/api/candidate/jobs/${job._id}/match`;

    await agent.post(path).send({ candidateCvId: candidateCv._id.toString() }).expect(401);
    await agent.post(path).set("Authorization", `Bearer ${adminToken}`)
      .send({ candidateCvId: candidateCv._id.toString() }).expect(403);
    expect(matchSpy).not.toHaveBeenCalled();
  });

  it("rejects another Candidate's CV and archived CV before using the Job source", async () => {
    const { candidateCv, requestMatch } = await setup();
    const other = await createVerifiedUser({ email: `ai-v03-other-${++sequence}@example.com` });
    const foreignCv = await CandidateCV.create({
      candidateUserId: other.user._id,
      name: "Other CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      categoryId: candidateCv.categoryId,
      generatedContent: {},
    });

    await requestMatch(foreignCv._id.toString()).expect(404);
    await CandidateCV.updateOne({ _id: candidateCv._id }, { archivedAt: new Date() });
    await requestMatch().expect(404);
    expect(normalizeJobSpy).not.toHaveBeenCalled();
    expect(matchSpy).not.toHaveBeenCalled();
  });

  it("uses V8 visibility: denies drafts and inactive Companies; accepts historical Jobs", async () => {
    const { job, manager, requestMatch } = await setup({ jobStatus: JOB_STATUS.DRAFT });
    await requestMatch().expect(404);
    expect(matchSpy).not.toHaveBeenCalled();

    await Job.updateOne({ _id: job._id }, { status: JOB_STATUS.CLOSED, publishedAt: new Date("2026-01-01") });
    await requestMatch().expect(200);
    await Company.updateOne({ _id: manager.company._id }, { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED });
    await requestMatch().expect(404);
    expect(matchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns a dependency failure without a Match Result when normalization is FAILED", async () => {
    const { requestMatch } = await setup();
    normalizeJobSpy.mockReturnValueOnce({ status: "FAILED", profile: null });

    const response = await requestMatch().expect(503);
    expect(response.body.matchResult).toBeUndefined();
    expect(matchSpy).not.toHaveBeenCalled();
  });
});
