import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { extractPdfTextFromBuffer } from "../../../ai-kit/src/document/pdf-text-extractor.js";

const optimizeCv = vi.hoisted(() => vi.fn());
const normalizeUploaded = vi.hoisted(() => vi.fn());
vi.mock("../../src/services/ai-kit.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { aiKit: Object.freeze({ ...actual.aiKit, optimizeCv }) };
});
vi.mock("../../src/services/candidate-cv-ai-normalization.service.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, normalizeOwnUploadedCandidateCv: normalizeUploaded };
});

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

const previewPdf = (agent, token, cvId) => agent
  .get(`/api/candidate/cvs/${cvId}/preview`)
  .set("Authorization", `Bearer ${token}`)
  .buffer(true)
  .parse((res, callback) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
  });

const setup = async ({ sourceType = "GENERATED" } = {}) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v06-http-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v06-http-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V06-HTTP-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v06-http-recruiter-${marker}@example.com`, company: manager.company,
    employeeCode: `AI-V06-HTTP-R-${marker}`,
  });
  const category = await Category.create({ name: `Engineering ${marker}`, level: "FIELD" });
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
    visibility: "PRIVATE",
    categoryId: category._id,
    ...(sourceType === "GENERATED" ? { generatedContent: {
      personalInfo: { fullName: "Candidate Name" },
      professionalSummary: "Original summary", skills: ["JavaScript"],
    } } : { uploadedFile: {
      storageKey: `candidate-cvs/uploaded/${marker}.pdf`,
      originalFileName: "source.pdf", mimeType: "application/pdf",
      sizeBytes: 100, pageCount: 1, uploadedAt: new Date(),
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
  const path = `/api/candidate/jobs/${job._id}/optimize-cv`;
  const request = (body = { candidateCvId: source._id.toString(), evaluationResult }) =>
    agent.post(path).set("Authorization", `Bearer ${token}`).send(body);
  return { agent, candidate, token, job, source, evaluationResult, path, request };
};

describe("AI-V06 Slice 08 Candidate HTTP optimization", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    optimizeCv.mockReset();
    normalizeUploaded.mockReset();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("previews, edits, and re-previews a V06-created Generated Draft through V7", async () => {
    const { agent, token, candidate, source, job, evaluationResult, request } = await setup();
    const sourceBefore = await CandidateCV.findById(source._id).lean();
    optimizeCv.mockResolvedValue(optimizationResult);

    const response = await request().expect(201);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.cv).toMatchObject({
      id: expect.any(String), name: "Source CV", sourceType: "GENERATED",
      status: "DRAFT", visibility: "PRIVATE", isDefault: false,
      generatedContent: {
        personalInfo: { fullName: "Candidate Name" },
        professionalSummary: "Targeted summary", skills: ["Node.js"],
      },
    });
    expect(optimizeCv).toHaveBeenCalledWith(expect.objectContaining({
      evaluationResult,
      jobMatchProfile: expect.objectContaining({ source: expect.objectContaining({
        jobId: job._id.toString(),
      }) }),
      cvMatchProfile: expect.objectContaining({ source: expect.objectContaining({
        candidateCvId: source._id.toString(),
      }) }),
    }));
    const saved = await CandidateCV.findById(response.body.cv.id).lean();
    expect(saved).toMatchObject({
      candidateUserId: candidate.user._id, status: "DRAFT", isDefault: false,
      generatedContent: { professionalSummary: "Targeted summary", skills: ["Node.js"] },
    });
    expect(await CandidateCV.findById(source._id).lean()).toEqual(sourceBefore);
    expect(await CandidateCV.countDocuments()).toBe(2);
    await agent.get(`/api/candidate/cvs/${response.body.cv.id}`)
      .set("Authorization", `Bearer ${token}`).expect(200);
    const cvId = response.body.cv.id;
    const firstPreview = await previewPdf(agent, token, cvId);
    expect(firstPreview.status).toBe(200);
    expect(firstPreview.headers["content-type"]).toMatch(/application\/pdf/);
    expect(firstPreview.headers["content-disposition"]).toContain("inline");
    expect(firstPreview.body.subarray(0, 4).toString()).toBe("%PDF");
    expect(await extractPdfTextFromBuffer(firstPreview.body)).toContain("Targeted summary");

    const editedSummary = "Candidate revised backend experience";
    const edited = await agent.put(`/api/candidate/cvs/${cvId}/generated-content`)
      .set("Authorization", `Bearer ${token}`)
      .send({ professionalSummary: editedSummary }).expect(200);
    expect(edited.body.cv).toMatchObject({
      id: cvId, status: "DRAFT", isDefault: false,
      generatedContent: { professionalSummary: editedSummary },
    });

    const secondPreview = await previewPdf(agent, token, cvId);
    expect(secondPreview.status).toBe(200);
    expect(secondPreview.headers["content-type"]).toMatch(/application\/pdf/);
    expect(secondPreview.headers["content-disposition"]).toContain("inline");
    const secondText = await extractPdfTextFromBuffer(secondPreview.body);
    expect(secondText).toContain(editedSummary);
    expect(secondText).not.toContain("Targeted summary");
    expect(secondPreview.body.equals(firstPreview.body)).toBe(false);

    const updated = await CandidateCV.findById(cvId).lean();
    expect(updated.status).toBe("DRAFT");
    expect(updated.isDefault).toBe(false);
    expect(updated.generatedContent.professionalSummary).toBe(editedSummary);
    expect(await CandidateCV.findById(source._id).lean()).toEqual(sourceBefore);
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it("accepts Uploaded V04 feedback on non-output sections as advisory context", async () => {
    const { source, evaluationResult, request } = await setup({ sourceType: "UPLOADED" });
    const pdfContent = Object.fromEntries([
      "careerPositioning", "professionalSummary", "skills", "workExperiences",
      "projects", "educations", "certifications", "languages",
      "otherCareerClaims", "unresolvedContent",
    ].map((section) => [section, []]));
    pdfContent.careerPositioning = [{ value: "Backend engineer", evidence: ["Backend engineer"] }];
    pdfContent.otherCareerClaims = [{ value: "Five years Python", evidence: ["Five years Python"] }];
    pdfContent.unresolvedContent = [{ value: "Maybe cloud", evidence: ["Maybe cloud"] }];
    normalizeUploaded.mockImplementation(async ({ onAuthorizedSource }) => {
      onAuthorizedSource(await CandidateCV.findById(source._id).lean());
      return { status: "READY", profile: {
        source: { type: "UPLOADED_CV", candidateCvId: source._id.toString() },
        pdfContent,
      } };
    });
    const improvements = ["careerPositioning", "otherCareerClaims", "unresolvedContent"]
      .map((section) => ({
        section, sourceReference: { sourcePath: null, evidence: [section] },
        comment: `Review ${section}`, suggestion: null, rewrite: null,
      }));
    const advice = { ...evaluationResult, cvImprovements: improvements };
    optimizeCv.mockResolvedValue(optimizationResult);

    const response = await request({
      candidateCvId: source._id.toString(), evaluationResult: advice,
    }).expect(201);

    expect(normalizeUploaded).toHaveBeenCalledOnce();
    expect(optimizeCv).toHaveBeenCalledWith(expect.objectContaining({ evaluationResult: advice }));
    expect(Object.keys(response.body.cv.generatedContent).sort()).toEqual([
      "personalInfo", "hiddenSections", "professionalSummary", "skills",
      "workExperiences", "projects", "educations", "certifications", "languages",
    ].sort());
    expect(Object.keys(optimizeCv.mock.calls[0][0].generatedBaseline).sort())
      .toEqual(Object.keys(optimizationResult).sort());
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it("rejects malformed input and non-Candidate callers before orchestration", async () => {
    const { agent, path, source, evaluationResult, request } = await setup();
    const admin = await createVerifiedUser({
      email: `ai-v06-http-admin-${++sequence}@example.com`, role: USER_ROLE.PLATFORM_ADMIN,
    });
    const adminToken = await loginAndGetAccessToken(agent, { email: admin.user.email });
    const body = { candidateCvId: source._id.toString(), evaluationResult };

    await agent.post(path).send(body).expect(401);
    await agent.post(path).set("Authorization", `Bearer ${adminToken}`)
      .send(body).expect(403);
    await request({ ...body, candidateUserId: admin.user._id.toString() }).expect(400);
    await request({ ...body, evaluationResult: { ...evaluationResult, cvImprovements: null } })
      .expect(400);
    await request({ ...body, evaluationResult: { ...evaluationResult,
      cvImprovements: [{ ...evaluationResult.cvImprovements[0], section: "personalInfo" }],
    } }).expect(400);
    await request({ ...body, evaluationResult: { ...evaluationResult,
      fieldReviews: evaluationResult.fieldReviews.map((review) => ({
        ...review, criterion: "skills",
      })) } }).expect(400);
    expect(optimizeCv).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("reuses own-CV and visible-Job gates and rejects a mismatched V04 identity", async () => {
    const { job, source, evaluationResult, request } = await setup();
    const other = await createVerifiedUser({ email: `ai-v06-http-other-${++sequence}@example.com` });
    const foreignCv = await CandidateCV.create({
      candidateUserId: other.user._id, name: "Other CV", sourceType: "GENERATED",
      status: "DRAFT", visibility: "PUBLIC", categoryId: source.categoryId,
      generatedContent: {},
    });

    await request({ candidateCvId: foreignCv._id.toString(), evaluationResult }).expect(404);
    await request({ candidateCvId: source._id.toString(),
      evaluationResult: { ...evaluationResult, jobId: foreignCv._id.toString() } }).expect(400);
    await request({ candidateCvId: source._id.toString(),
      evaluationResult: { ...evaluationResult, candidateCvId: foreignCv._id.toString() } })
      .expect(400);
    await Job.updateOne({ _id: job._id }, { status: "DRAFT", publishedAt: null });
    await request().expect(404);
    expect(optimizeCv).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it("returns failure without a Draft when inference or persistence fails", async () => {
    const { request } = await setup();
    optimizeCv.mockRejectedValueOnce(new Error("Inference failed"));
    await request().expect(500);
    expect(await CandidateCV.countDocuments()).toBe(1);

    optimizeCv.mockResolvedValueOnce(optimizationResult);
    const create = vi.spyOn(CandidateCV, "create").mockRejectedValueOnce(new Error("Write failed"));
    await request().expect(500);
    expect(create).toHaveBeenCalledOnce();
    expect(await CandidateCV.countDocuments()).toBe(1);
  });
});
