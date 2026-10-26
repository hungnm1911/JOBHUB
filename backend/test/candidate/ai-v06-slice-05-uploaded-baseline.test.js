import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import User from "../../src/models/user.model.js";
import { prepareOwnUploadedCvBaseline } from "../../src/services/candidate-cv-optimization-baseline.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase, connectTestDatabase, disconnectTestDatabase,
} from "../helpers/database.js";

let sequence = 0;
const createSource = async () => {
  const candidate = (await createVerifiedUser({
    email: `v06-uploaded-baseline-${++sequence}@example.com`,
  })).user;
  const category = await Category.create({ name: `Engineering ${sequence}`, level: "FIELD" });
  const cv = await CandidateCV.create({
    candidateUserId: candidate._id,
    name: "Uploaded source",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: "PRIVATE",
    categoryId: category._id,
    skillTags: ["Backend"],
    uploadedFile: {
      storageKey: `candidate-cvs/uploaded/${sequence}.pdf`,
      originalFileName: "source.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      pageCount: 1,
      uploadedAt: new Date(),
    },
  });
  return { candidate, cv };
};

const pdfContent = () => ({
  careerPositioning: [{ value: "Backend engineer", evidence: ["Backend engineer"] }],
  professionalSummary: [{ value: "Builds APIs", evidence: ["Builds APIs"] }],
  skills: [{ value: "Node.js", evidence: ["Node.js"] }],
  workExperiences: [{ companyName: "Acme", position: "Engineer", period: "2020–now",
    description: "Built APIs", achievements: ["Reduced latency"], evidence: ["Built APIs"] }],
  projects: [{ name: "Portal", role: "Lead", period: "2019", technologies: ["Vue"],
    description: "Built portal", evidence: ["Built portal"] }],
  educations: [{ institutionName: "University", degree: "BSc", fieldOfStudy: "CS",
    period: "2012–2016", evidence: ["University"] }],
  certifications: [{ name: "Cloud", issuer: "Vendor", date: "2022", credentialId: "C-1",
    evidence: ["Cloud"] }],
  languages: [{ name: "English", statedProficiency: "ADVANCED", evidence: ["English"] }],
  otherCareerClaims: [{ value: "Five years Python", evidence: ["Five years Python"] }],
  unresolvedContent: [{ value: "Maybe cloud", evidence: ["Maybe cloud"] }],
});

const readyResult = (cv, content = pdfContent()) => ({
  status: "READY",
  profile: {
    source: { type: "UPLOADED_CV", candidateCvId: cv._id.toString() },
    pdfContent: content,
  },
});

const prepare = ({ candidate, cv }, normalizationResult = readyResult(cv)) =>
  prepareOwnUploadedCvBaseline({
    actorUser: candidate,
    candidateUserId: candidate._id,
    candidateCvId: cv._id.toString(),
    normalizationResult,
  });

describe("AI-V06 Slice 05 — Uploaded CV baseline (F02/BR-AI-05)", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("maps seven career sections and current Candidate Profile without modifying the source", async () => {
    const source = await createSource();
    await User.collection.updateOne({ _id: source.candidate._id }, {
      $set: { fullName: "Mai", phoneNumber: "0123456789", avatarUrl: "https://example.com/mai.png" },
    });
    const result = readyResult(source.cv);
    expect(result.profile.pdfContent.projects[0]).not.toHaveProperty("projectUrl");
    expect(result.profile.pdfContent.certifications[0]).not.toHaveProperty("credentialUrl");
    const sourceBefore = await CandidateCV.collection.findOne({ _id: source.cv._id });
    const resultBefore = structuredClone(result);

    const baseline = await prepare(source, result);

    expect(baseline.metadata).toMatchObject({ name: "Uploaded source", skillTags: ["Backend"] });
    expect(baseline.generatedContent.personalInfo).toEqual({
      fullName: "Mai", email: source.candidate.email, phone: "0123456789",
      displayLocation: null, links: [], avatarUrl: "https://example.com/mai.png",
    });
    expect(baseline.careerSections).toEqual({
      professionalSummary: "Builds APIs", skills: ["Node.js"],
      workExperiences: [{ companyName: "Acme", position: "Engineer", description: "Built APIs",
        startDate: null, endDate: null, achievements: ["Reduced latency"] }],
      projects: [{ name: "Portal", role: "Lead", description: "Built portal", projectUrl: null,
        technologies: ["Vue"] }],
      educations: [{ institutionName: "University", degree: "BSc", fieldOfStudy: "CS",
        startDate: null, endDate: null }],
      certifications: [{ name: "Cloud", issuer: "Vendor", credentialId: "C-1",
        credentialUrl: null, issueDate: null, expirationDate: null }],
      languages: [{ name: "English", proficiency: "ADVANCED" }],
    });
    expect(baseline.generatedContent).toMatchObject(baseline.careerSections);
    expect(baseline.generatedContent.hiddenSections).toEqual([]);
    expect(JSON.stringify(baseline.generatedContent)).not.toMatch(/evidence|period|Maybe cloud|Five years Python/);
    baseline.careerSections.workExperiences[0].companyName = "Changed";
    expect(baseline.generatedContent.workExperiences[0].companyName).toBe("Acme");
    expect(result).toEqual(resultBefore);
    expect(await CandidateCV.collection.findOne({ _id: source.cv._id })).toEqual(sourceBefore);
  });

  it("keeps sparse normalized content and absent Candidate Profile fields empty", async () => {
    const source = await createSource();
    await User.collection.updateOne({ _id: source.candidate._id }, {
      $unset: { fullName: "", phoneNumber: "", avatarUrl: "" },
    });
    const content = Object.fromEntries(Object.keys(pdfContent()).map((key) => [key, []]));

    const baseline = await prepare(source, readyResult(source.cv, content));

    expect(baseline.careerSections).toEqual({
      professionalSummary: null, skills: [], workExperiences: [], projects: [],
      educations: [], certifications: [], languages: [],
    });
    expect(baseline.generatedContent.personalInfo).toEqual({
      fullName: null, email: source.candidate.email, phone: null,
      displayLocation: null, links: [], avatarUrl: null,
    });
  });

  it("does not turn free-text periods into dates or incompatible proficiency into an enum", async () => {
    const source = await createSource();
    const content = pdfContent();
    content.workExperiences[0].period = "Spring 2020 to present";
    content.educations[0].period = "2012-ish";
    content.certifications[0].date = "mid 2022";
    content.languages[0].statedProficiency = "advanced-ish";

    const baseline = await prepare(source, readyResult(source.cv, content));

    expect(baseline.careerSections.workExperiences[0]).toMatchObject({ startDate: null, endDate: null });
    expect(baseline.careerSections.educations[0]).toMatchObject({ startDate: null, endDate: null });
    expect(baseline.careerSections.certifications[0]).toMatchObject({ issueDate: null, expirationDate: null });
    expect(baseline.careerSections.languages).toEqual([{ name: "English", proficiency: null }]);
  });

  it("requires a READY profile for the authorized Uploaded source", async () => {
    const source = await createSource();
    const other = await createSource();
    await expect(prepare(source, { status: "FAILED", profile: null }))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(prepare(source, readyResult(other.cv)))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(prepare({ ...source, candidate: other.candidate }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
