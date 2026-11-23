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
const json = (value) => JSON.parse(JSON.stringify(value));

const setup = async (sourceType) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v06-r4-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v06-r4-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V06-R4-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v06-r4-recruiter-${marker}@example.com`, company: manager.company,
    employeeCode: `AI-V06-R4-R-${marker}`,
  });
  const category = await Category.create({ name: `Engineering R4 ${marker}`, level: "FIELD" });
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
  const uploaded = sourceType === "UPLOADED";
  const source = await CandidateCV.create({
    candidateUserId: candidate.user._id, name: "Source CV",
    sourceType, status: uploaded ? "ACTIVE" : "DRAFT",
    visibility: "PRIVATE", categoryId: category._id,
    ...(uploaded ? { uploadedFile: {
      storageKey: `candidate-cvs/uploaded/r4-${marker}.pdf`,
      originalFileName: "source.pdf", mimeType: "application/pdf",
      sizeBytes: 100, pageCount: 1, uploadedAt: new Date(),
    } } : { generatedContent: {
      personalInfo: { fullName: "Candidate Name" },
      professionalSummary: "Original summary",
      professionalSummaryHtml: "<p>Original <strong>summary</strong></p>",
      skills: ["JavaScript"],
      workExperiences: [{
        companyName: "Acme", position: "Dev", startDate: new Date("2020-01-01"),
        description: "Built APIs", descriptionHtml: "<p>Built <em>APIs</em></p>",
      }],
      educations: [{ institutionName: "Uni", startDate: new Date("2015-09-01") }],
    } }),
  });
  if (uploaded) {
    const pdfContent = Object.fromEntries([
      "careerPositioning", "professionalSummary", "skills", "workExperiences",
      "projects", "educations", "certifications", "languages",
      "otherCareerClaims", "unresolvedContent",
    ].map((section) => [section, []]));
    pdfContent.professionalSummary = [{ value: "Uploaded summary", evidence: ["Uploaded summary"] }];
    normalizeUploaded.mockImplementation(async ({ onAuthorizedSource }) => {
      onAuthorizedSource(await CandidateCV.findById(source._id).lean());
      return { status: "READY", profile: {
        source: { type: "UPLOADED_CV", candidateCvId: source._id.toString() }, pdfContent,
      } };
    });
  }
  const evaluationResult = {
    jobId: job._id.toString(), candidateCvId: source._id.toString(),
    matchScore: 45, overallSummary: "Emphasize supported backend work",
    fieldReviews: ["skills", "category", "experience", "employmentType", "workMode"]
      .map((criterion) => ({ criterion, score: 45, review: "Needs review" })),
    cvImprovements: [],
  };
  const post = (suffix, body) => agent.post(`/api/candidate/jobs/${job._id}/optimize-cv${suffix}`)
    .set("Authorization", `Bearer ${token}`).send(body);
  return {
    source, job,
    preview: () => post("/preview", { candidateCvId: source._id.toString(), evaluationResult }),
    commit: (proposal) => post("/commit", { proposal }),
  };
};

describe("AI-V06 R4 Preview → Commit round trip", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    optimizeCv.mockReset();
    normalizeUploaded.mockReset();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it.each(["GENERATED", "UPLOADED"])("commits the unmodified %s Preview Proposal as one Draft", async (sourceType) => {
    const { source, preview, commit } = await setup(sourceType);
    optimizeCv.mockResolvedValue(optimizationResult);
    const create = vi.spyOn(CandidateCV, "create");

    const previewResponse = await preview().expect(200);
    expect(create).not.toHaveBeenCalled();
    expect(await CandidateCV.countDocuments()).toBe(1);
    expect(optimizeCv).toHaveBeenCalledOnce();
    const normalizeCalls = normalizeUploaded.mock.calls.length;
    const sourceBefore = await CandidateCV.findById(source._id).lean();
    const { proposal, proposedContent } = previewResponse.body;

    const commitResponse = await commit(proposal).expect(201);

    expect(optimizeCv).toHaveBeenCalledOnce();
    expect(normalizeUploaded).toHaveBeenCalledTimes(normalizeCalls);
    expect(create).toHaveBeenCalledOnce();
    expect(await CandidateCV.countDocuments()).toBe(2);
    expect(await CandidateCV.findById(source._id).lean()).toEqual(sourceBefore);

    const draft = await CandidateCV.findById(commitResponse.body.cv.id ?? commitResponse.body.cv._id).lean();
    expect(draft).toMatchObject({ sourceType: "GENERATED", status: "DRAFT", isDefault: false });
    expect(draft._id.toString()).not.toBe(source._id.toString());
    expect(json(draft.generatedContent)).toEqual(proposedContent);
    expect(proposedContent.professionalSummary).toBe("Targeted summary");
    expect(proposedContent.skills).toEqual(["Node.js"]);
    const { metadata } = proposal.payload;
    expect(draft.name).toBe(metadata.name);
    expect(draft.visibility).toBe(metadata.visibility);
    expect(draft.categoryId.toString()).toBe(metadata.categoryId);
    expect(json(draft.skillTags ?? [])).toEqual(json(metadata.skillTags ?? []));
    expect(json(draft.employmentTypes ?? [])).toEqual(json(metadata.employmentTypes ?? []));
    expect(json(draft.workModes ?? [])).toEqual(json(metadata.workModes ?? []));
  });

  it("preserves Generated rich text and dates through the round trip", async () => {
    const { preview, commit } = await setup("GENERATED");
    optimizeCv.mockResolvedValue(optimizationResult);

    const { body } = await preview().expect(200);
    const response = await commit(body.proposal).expect(201);

    const draft = await CandidateCV.findById(response.body.cv.id ?? response.body.cv._id).lean();
    expect(draft.generatedContent.workExperiences[0].descriptionHtml).toBe("<p>Built <em>APIs</em></p>");
    expect(draft.generatedContent.workExperiences[0].startDate.toISOString())
      .toBe("2020-01-01T00:00:00.000Z");
    expect(draft.generatedContent.educations[0].startDate.toISOString())
      .toBe("2015-09-01T00:00:00.000Z");
  });
});
