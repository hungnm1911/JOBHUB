import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const optimizeCv = vi.hoisted(() => vi.fn());
const normalizeUploaded = vi.hoisted(() => vi.fn());
vi.mock("../../src/services/candidate-cv-ai-normalization.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, normalizeOwnUploadedCandidateCv: normalizeUploaded };
});
vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { aiKit: Object.freeze({ ...actual.aiKit, optimizeCv }) };
});

import { verifyOptimizationProposal } from "../../src/services/candidate-cv-optimization-proposal.service.js";
import USER_ROLE from "../../src/constants/user-role.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import {
  createActiveCompanyManagerContext, createActiveRecruiterContext,
  createVerifiedUser, loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase, connectTestDatabase, createTestAgent, disconnectTestDatabase,
} from "../helpers/database.js";

let sequence = 0;
const optimizationResult = {
  professionalSummary: "Targeted summary", skills: ["Node.js"],
  workExperiences: null, projects: null, educations: null,
  certifications: null, languages: null,
};

const setup = async ({ sourceType = "GENERATED" } = {}) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v06-r1-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v06-r1-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V06-R1-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v06-r1-recruiter-${marker}@example.com`, company: manager.company,
    employeeCode: `AI-V06-R1-R-${marker}`,
  });
  const category = await Category.create({ name: `Engineering R1 ${marker}`, level: "FIELD" });
  const job = await Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: recruiter.membership._id,
    primaryRecruiterCompanyMemberId: recruiter.membership._id,
    status: "PUBLISHED", publishedAt: new Date("2026-01-01"),
    applicationDeadline: new Date(Date.now() + 86_400_000),
    title: "Backend Engineer", jobDescription: "Build Node.js services",
    requiredSkills: ["Node.js"], salary: { type: "NEGOTIABLE" },
    fieldCategoryIds: [category._id], positionCategoryIds: [],
    experienceLevelId: null, employmentType: "FULL_TIME", workModes: ["HYBRID"],
    location: { provinceCode: "01", districtCode: null },
  });
  const source = await CandidateCV.create({
    candidateUserId: candidate.user._id, name: "Source CV",
    sourceType, status: sourceType === "GENERATED" ? "DRAFT" : "ACTIVE",
    visibility: "PRIVATE", categoryId: category._id,
    ...(sourceType === "UPLOADED" ? { uploadedFile: {
      storageKey: `candidate-cvs/uploaded/r1-${marker}.pdf`,
      originalFileName: "source.pdf", mimeType: "application/pdf",
      sizeBytes: 100, pageCount: 1, uploadedAt: new Date(),
    } } : { generatedContent: {
      personalInfo: { fullName: "Candidate Name" },
      professionalSummary: "Original summary",
      professionalSummaryHtml: "<p>Original <strong>summary</strong></p>",
      skills: ["JavaScript"],
      workExperiences: [{
        companyName: "Acme", description: "Built APIs",
        descriptionHtml: "<p>Built <em>APIs</em></p>",
      }],
      projects: [{
        name: "Ledger", description: "Used Node",
        descriptionHtml: "<p>Used <strong>Node</strong></p>",
      }],
    } }),
  });
  const evaluationResult = {
    jobId: job._id.toString(), candidateCvId: source._id.toString(),
    matchScore: 45, overallSummary: "Emphasize supported backend work",
    fieldReviews: ["skills", "category", "experience", "employmentType", "workMode"]
      .map((criterion) => ({ criterion, score: 45, review: "Needs review" })),
    cvImprovements: [{
      section: "skills",
      sourceReference: { sourcePath: "/generatedContent/skills/0", evidence: [] },
      comment: "Relevant skill can be clearer", suggestion: "Clarify verified work",
      rewrite: null,
    }],
  };
  const path = `/api/candidate/jobs/${job._id}/optimize-cv/preview`;
  const request = (body = { candidateCvId: source._id.toString(), evaluationResult }) =>
    agent.post(path).set("Authorization", `Bearer ${token}`).send(body);
  return { agent, path, source, job, marker, evaluationResult, request };
};

describe("AI-V06 R1 Optimization Preview API", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    optimizeCv.mockReset();
    normalizeUploaded.mockReset();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("returns 200 baseline and V7-normalized proposedContent without persistence", async () => {
    const { source, evaluationResult, job, request } = await setup();
    const sourceBefore = await CandidateCV.findById(source._id).lean();
    optimizeCv.mockResolvedValue(optimizationResult);
    const create = vi.spyOn(CandidateCV, "create");

    const response = await request().expect(200);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(Object.keys(response.body).sort()).toEqual(["baseline", "proposal", "proposedContent"]);
    expect(response.body.baseline).toMatchObject({
      professionalSummary: "Original summary",
      professionalSummaryHtml: "<p>Original <strong>summary</strong></p>",
      skills: ["JavaScript"],
    });
    expect(response.body.proposedContent).toMatchObject({
      personalInfo: { fullName: "Candidate Name" },
      professionalSummary: "Targeted summary", professionalSummaryHtml: null,
      skills: ["Node.js"],
      workExperiences: [{
        description: "Built APIs", descriptionHtml: "<p>Built <em>APIs</em></p>",
      }],
      projects: [{
        description: "Used Node", descriptionHtml: "<p>Used <strong>Node</strong></p>",
      }],
    });
    const { proposal } = response.body;
    expect(proposal.payload).toMatchObject({
      candidateUserId: source.candidateUserId.toString(),
      jobId: job._id.toString(), candidateCvId: source._id.toString(),
      proposedContent: response.body.proposedContent,
      metadata: { name: "Source CV" },
      sourceRevision: {
        sourceType: "GENERATED", updatedAt: sourceBefore.updatedAt.toISOString(),
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(proposal.payload).not.toHaveProperty("baseline");
    expect(verifyOptimizationProposal(proposal, {
      candidateUserId: source.candidateUserId, jobId: job._id, candidateCvId: source._id,
    }).valid).toBe(true);
    expect(optimizeCv).toHaveBeenCalledOnce();
    expect(optimizeCv).toHaveBeenCalledWith(expect.objectContaining({
      evaluationResult,
      jobMatchProfile: expect.objectContaining({ source: expect.objectContaining({
        jobId: job._id.toString(),
      }) }),
    }));
    expect(create).not.toHaveBeenCalled();
    expect(await CandidateCV.findById(source._id).lean()).toEqual(sourceBefore);
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("previews an Uploaded CV in Generated V7 shape without persistence or extra LLM steps", async () => {
    const { source, evaluationResult, request } = await setup({ sourceType: "UPLOADED" });
    const sourceBefore = await CandidateCV.findById(source._id).lean();
    const pdfContent = Object.fromEntries([
      "careerPositioning", "professionalSummary", "skills", "workExperiences",
      "projects", "educations", "certifications", "languages",
      "otherCareerClaims", "unresolvedContent",
    ].map((section) => [section, []]));
    pdfContent.professionalSummary = [{ value: "Uploaded summary", evidence: ["Uploaded summary"] }];
    normalizeUploaded.mockImplementation(async ({ onAuthorizedSource }) => {
      onAuthorizedSource(await CandidateCV.findById(source._id).lean());
      return { status: "READY", profile: {
        source: { type: "UPLOADED_CV", candidateCvId: source._id.toString() },
        pdfContent,
      } };
    });
    optimizeCv.mockResolvedValue(optimizationResult);
    const create = vi.spyOn(CandidateCV, "create");

    const response = await request().expect(200);

    const generatedKeys = [
      "personalInfo", "hiddenSections", "professionalSummary", "professionalSummaryHtml",
      "skills", "workExperiences", "projects", "educations", "certifications", "languages",
    ].sort();
    expect(Object.keys(response.body).sort()).toEqual(["baseline", "proposal", "proposedContent"]);
    expect(Object.keys(response.body.baseline).sort()).toEqual(generatedKeys);
    expect(Object.keys(response.body.proposedContent).sort()).toEqual(generatedKeys);
    expect(response.body.baseline.professionalSummary).toBe("Uploaded summary");
    expect(response.body.proposedContent).toMatchObject({
      professionalSummary: "Targeted summary", professionalSummaryHtml: null,
      skills: ["Node.js"],
    });
    expect(normalizeUploaded).toHaveBeenCalledOnce();
    expect(optimizeCv).toHaveBeenCalledOnce();
    expect(optimizeCv).toHaveBeenCalledWith(expect.objectContaining({
      evaluationResult,
      cvMatchProfile: expect.objectContaining({ source: expect.objectContaining({
        type: "UPLOADED_CV", candidateCvId: source._id.toString(),
      }) }),
    }));
    expect(create).not.toHaveBeenCalled();
    expect(await CandidateCV.findById(source._id).lean()).toEqual(sourceBefore);
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("returns an unchanged proposal when the Optimization Result has no changes", async () => {
    const { request } = await setup();
    optimizeCv.mockResolvedValue({
      professionalSummary: null, skills: null, workExperiences: null, projects: null,
      educations: null, certifications: null, languages: null,
    });

    const { body } = await request().expect(200);

    expect(body.proposedContent).toEqual(body.baseline);
    expect(body.proposedContent.workExperiences[0].descriptionHtml)
      .toBe("<p>Built <em>APIs</em></p>");
  });

  it("reuses authorization and rejects invalid input without calling AI or persisting", async () => {
    const { agent, path, source, evaluationResult, request } = await setup();
    const admin = await createVerifiedUser({
      email: `ai-v06-r1-admin-${++sequence}@example.com`, role: USER_ROLE.PLATFORM_ADMIN,
    });
    const adminToken = await loginAndGetAccessToken(agent, { email: admin.user.email });
    const body = { candidateCvId: source._id.toString(), evaluationResult };
    const other = await createVerifiedUser({ email: `ai-v06-r1-other-${++sequence}@example.com` });
    const foreign = await CandidateCV.create({
      candidateUserId: other.user._id, name: "Other CV", sourceType: "GENERATED",
      status: "DRAFT", visibility: "PUBLIC", categoryId: source.categoryId,
      generatedContent: {},
    });

    await agent.post(path).send(body).expect(401);
    await agent.post(path).set("Authorization", `Bearer ${adminToken}`).send(body).expect(403);
    await request({ ...body, evaluationResult: { ...evaluationResult, cvImprovements: null } })
      .expect(400);
    await request({ candidateCvId: foreign._id.toString(), evaluationResult }).expect(404);
    await request({ ...body, evaluationResult: { ...evaluationResult,
      candidateCvId: foreign._id.toString() } }).expect(400);

    expect(optimizeCv).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it("returns failure and persists nothing when inference fails", async () => {
    const { request } = await setup();
    optimizeCv.mockRejectedValueOnce(new Error("Inference failed"));

    await request().expect(500);

    expect(await CandidateCV.countDocuments()).toBe(1);
  });
});
