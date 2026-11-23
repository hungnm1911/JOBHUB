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

import { issueOptimizationProposal, buildSourceRevision }
  from "../../src/services/candidate-cv-optimization-proposal.service.js";
import * as cvService from "../../src/services/candidate-cv.service.js";
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

const setup = async ({ sourceType = "GENERATED" } = {}) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v06-r3-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v06-r3-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V06-R3-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v06-r3-recruiter-${marker}@example.com`, company: manager.company,
    employeeCode: `AI-V06-R3-R-${marker}`,
  });
  const category = await Category.create({ name: `Engineering R3 ${marker}`, level: "FIELD" });
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
      storageKey: `candidate-cvs/uploaded/r3-${marker}.pdf`,
      originalFileName: "source.pdf", mimeType: "application/pdf",
      sizeBytes: 100, pageCount: 1, uploadedAt: new Date(),
    } } : { generatedContent: { personalInfo: { fullName: "Candidate" }, skills: ["JS"] } }),
  });
  const proposedContent = cvService.normalizeGeneratedContentForPersistence({
    personalInfo: { fullName: "Candidate" },
    professionalSummary: "Targeted", professionalSummaryHtml: null,
    skills: ["Node.js"],
    workExperiences: [{
      companyName: "Acme", position: "Dev",
      startDate: "2020-01-01T00:00:00.000Z", endDate: null,
      descriptionHtml: "<p>Built <strong>APIs</strong></p>",
    }],
    educations: [{ institutionName: "Uni", startDate: "2015-09-01T00:00:00.000Z" }],
  });
  const sign = async (overrides = {}) => {
    const current = await CandidateCV.findById(source._id).lean();
    return JSON.parse(JSON.stringify(issueOptimizationProposal({
      candidateUserId: candidate.user._id, jobId: job._id, candidateCvId: source._id,
      metadata: { name: "Optimized CV", visibility: "PRIVATE", categoryId: category._id.toString() },
      proposedContent, sourceRevision: buildSourceRevision(current), ...overrides,
    })));
  };
  const path = `/api/candidate/jobs/${job._id}/optimize-cv/commit`;
  const commit = (proposal, auth = token) => agent.post(path)
    .set("Authorization", `Bearer ${auth}`).send({ proposal });
  return { agent, token, candidate, source, job, category, proposedContent, sign, commit, path };
};

describe("AI-V06 R3 Optimization Commit API", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    optimizeCv.mockReset();
    normalizeUploaded.mockReset();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it.each(["GENERATED", "UPLOADED"])("creates a GENERATED/DRAFT matching proposedContent from a %s source with zero AI calls", async (sourceType) => {
    const { source, proposedContent, sign, commit } = await setup({ sourceType });
    const sourceBefore = await CandidateCV.findById(source._id).lean();
    const proposal = await sign();

    const response = await commit(proposal).expect(201);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    const created = await CandidateCV.findById(response.body.cv.id ?? response.body.cv._id).lean();
    expect(created).toMatchObject({ sourceType: "GENERATED", status: "DRAFT", name: "Optimized CV" });
    expect(created._id.toString()).not.toBe(source._id.toString());
    expect(JSON.parse(JSON.stringify(created.generatedContent)))
      .toMatchObject(JSON.parse(JSON.stringify(proposedContent)));
    expect(created.generatedContent.workExperiences[0].descriptionHtml)
      .toBe("<p>Built <strong>APIs</strong></p>");
    expect(created.generatedContent.educations[0].startDate.toISOString())
      .toBe("2015-09-01T00:00:00.000Z");
    expect(await CandidateCV.findById(source._id).lean()).toEqual(sourceBefore);
    expect(optimizeCv).not.toHaveBeenCalled();
    expect(normalizeUploaded).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it.each([
    ["proposedContent", (p) => { p.payload.proposedContent.skills = ["Evil"]; }],
    ["metadata", (p) => { p.payload.metadata.name = "Other"; }],
    ["signature", (p) => { p.signature = "x".repeat(p.signature.length); }],
  ])("rejects tampered %s without creating a Draft", async (_n, tamper) => {
    const { sign, commit } = await setup();
    const proposal = await sign();
    tamper(proposal);
    await commit(proposal).expect(400);
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("rejects malformed bodies and expired proposals", async () => {
    const { sign, commit } = await setup();
    await commit(undefined).expect(400);
    await commit({ payload: {}, signature: "s" }).expect(400);
    await commit(await sign({ now: Date.now() - 2 * 3_600_000 })).expect(400);
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("rejects another Candidate, other Job and unauthenticated or non-Candidate callers", async () => {
    const { agent, token, sign, commit, job, source } = await setup();
    const proposal = await sign();
    const other = await createVerifiedUser({ email: `ai-v06-r3-other-${++sequence}@example.com` });
    const otherToken = await loginAndGetAccessToken(agent, { email: other.user.email });

    await commit(proposal, otherToken).expect(403);
    await agent.post(`/api/candidate/jobs/${job._id}/optimize-cv/commit`)
      .send({ proposal }).expect(401);
    await agent.post(`/api/candidate/jobs/${source._id}/optimize-cv/commit`)
      .set("Authorization", `Bearer ${token}`).send({ proposal }).expect(403);
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("returns 404 when the Job is no longer visible or the Source no longer exists", async () => {
    const { sign, commit, source, job } = await setup();
    const proposal = await sign();
    await Job.updateOne({ _id: job._id }, { status: "DRAFT" });
    await commit(proposal).expect(404);
    await Job.updateOne({ _id: job._id }, { status: "PUBLISHED" });
    await CandidateCV.deleteOne({ _id: source._id });
    await commit(proposal).expect(404);
    expect(await CandidateCV.countDocuments()).toBe(0);
  });

  it("returns 409 without creating a Draft when the owned Source was archived after Preview", async () => {
    const { sign, commit, source } = await setup();
    const proposal = await sign();
    await CandidateCV.updateOne({ _id: source._id }, { archivedAt: new Date() });
    await commit(proposal).expect(409);
    expect(await CandidateCV.countDocuments()).toBe(1);
    expect(optimizeCv).not.toHaveBeenCalled();
  });

  it("keeps 404 for an archived Source owned by someone else (signed for the caller)", async () => {
    const { sign, commit, source } = await setup();
    const other = await createVerifiedUser({ email: `ai-v06-r3-arch-${++sequence}@example.com` });
    const proposal = await sign();
    await CandidateCV.collection.updateOne({ _id: source._id },
      { $set: { candidateUserId: other.user._id, archivedAt: new Date() } });
    await commit(proposal).expect(404);
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("returns 409 when the Source CV changed after Preview, even within the same updatedAt", async () => {
    const { sign, commit, source } = await setup();
    const proposal = await sign();
    const { updatedAt } = await CandidateCV.findById(source._id).lean();
    await CandidateCV.collection.updateOne({ _id: source._id },
      { $set: { "generatedContent.skills": ["Changed"], updatedAt } });

    await commit(proposal).expect(409);

    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("creates no Draft when V7 validation fails or content is not persistable", async () => {
    const { sign, commit } = await setup();
    await commit(await sign({
      metadata: { name: "", visibility: "PRIVATE", categoryId: "bad" },
    })).expect(400);
    await commit(await sign({ proposedContent: { skills: [" padded "] } })).expect(400);
    await commit(await sign({ proposedContent: {
      ...(await setup()).proposedContent,
      educations: [{ institutionName: "U", startDate: "2020-01" }],
    } })).expect(400);
    expect(await CandidateCV.countDocuments()).toBe(2);
  });

  it("persists through the V7 create owner exactly once", async () => {
    const { sign, commit } = await setup();
    const create = vi.spyOn(CandidateCV, "create");
    await commit(await sign()).expect(201);
    expect(create).toHaveBeenCalledOnce();
  });
});
