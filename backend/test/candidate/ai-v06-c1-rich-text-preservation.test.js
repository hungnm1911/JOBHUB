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
const json = (value) => JSON.parse(JSON.stringify(value));

const setup = async (sourceType) => {
  const marker = ++sequence;
  const agent = createTestAgent();
  const candidate = await createVerifiedUser({ email: `ai-v06-c1-${marker}@example.com` });
  const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
  const manager = await createActiveCompanyManagerContext({
    email: `ai-v06-c1-manager-${marker}@example.com`,
    businessRegistrationNumber: `AI-V06-C1-${marker}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `ai-v06-c1-recruiter-${marker}@example.com`, company: manager.company,
    employeeCode: `AI-V06-C1-R-${marker}`,
  });
  const category = await Category.create({ name: `Engineering C1 ${marker}`, level: "FIELD" });
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
      storageKey: `candidate-cvs/uploaded/c1-${marker}.pdf`,
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

const nullResult = {
  professionalSummary: null, skills: null, workExperiences: null, projects: null,
  educations: null, certifications: null, languages: null,
};
const sameTextExperience = {
  companyName: "Acme", position: "Dev", startDate: "2020-01-01T00:00:00.000Z",
  endDate: null, description: "Built APIs", achievements: [],
};

// AI-V06 F03, BR-AI-03/06, Data 6.6/6.7: rich text preservation coverage.
describe("AI-V06 C1 rich text preservation (Generated Source)", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    optimizeCv.mockReset();
    normalizeUploaded.mockReset();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  const run = async (result) => {
    const ctx = await setup("GENERATED");
    optimizeCv.mockResolvedValue(result);
    const { body } = await ctx.preview().expect(200);
    const commit = await ctx.commit(body.proposal).expect(201);
    const draft = await CandidateCV.findById(commit.body.cv.id ?? commit.body.cv._id).lean();
    return { ...ctx, body, draft };
  };

  it("keeps all HTML when every section is null and Preview equals the Draft", async () => {
    const { body, draft } = await run(nullResult);
    const { proposedContent } = body;
    expect(proposedContent.professionalSummaryHtml).toBe("<p>Original <strong>summary</strong></p>");
    expect(proposedContent.workExperiences[0].descriptionHtml).toBe("<p>Built <em>APIs</em></p>");
    expect(proposedContent.professionalSummary).toBe("Original summary");
    expect(json(draft.generatedContent)).toEqual(proposedContent);
  });

  it("clears only the replaced section's HTML (summary replaced, experience null)", async () => {
    const { body, draft } = await run({ ...nullResult, professionalSummary: "New summary" });
    expect(body.proposedContent.professionalSummary).toBe("New summary");
    expect(body.proposedContent.professionalSummaryHtml ?? null).toBeNull();
    expect(body.proposedContent.workExperiences[0].descriptionHtml).toBe("<p>Built <em>APIs</em></p>");
    expect(json(draft.generatedContent)).toEqual(body.proposedContent);
    expect(draft.generatedContent.professionalSummaryHtml ?? null).toBeNull();
  });

  it("characterizes a replacement item with identical text: plain text kept, HTML dropped (change semantics)", async () => {
    const { body, draft } = await run({ ...nullResult, workExperiences: [sameTextExperience] });
    const item = body.proposedContent.workExperiences[0];
    expect(item.description).toBe("Built APIs");
    // AI output carries no HTML (Data 6.6), so a replaced item is plain-only and
    // stale HTML is never paired with new plain text.
    expect(item.descriptionHtml ?? null).toBeNull();
    expect(json(draft.generatedContent)).toEqual(body.proposedContent);
  });

  it("does not leave stale HTML when replacement text differs", async () => {
    const { body, draft } = await run({
      ...nullResult, workExperiences: [{ ...sameTextExperience, description: "Built REST APIs" }],
    });
    const item = body.proposedContent.workExperiences[0];
    expect(item.description).toBe("Built REST APIs");
    expect(item.descriptionHtml ?? null).toBeNull();
    expect(draft.generatedContent.workExperiences[0].descriptionHtml ?? null).toBeNull();
  });

  it("never sends HTML to the AI and leaves the Source CV untouched", async () => {
    const { source } = await run(nullResult);
    const input = optimizeCv.mock.calls[0][0];
    expect(JSON.stringify(input.generatedBaseline)).not.toMatch(/Html/);
    const after = await CandidateCV.findById(source._id).lean();
    expect(after.generatedContent.workExperiences[0].descriptionHtml).toBe("<p>Built <em>APIs</em></p>");
    expect(await CandidateCV.countDocuments()).toBe(2);
  });
});
