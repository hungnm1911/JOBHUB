import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { prepareOwnGeneratedCvBaseline } from "../../src/services/candidate-cv-optimization-baseline.service.js";
import { activateOwnGeneratedCandidateCv } from "../../src/services/candidate-cv.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase, connectTestDatabase, disconnectTestDatabase,
} from "../helpers/database.js";

let sequence = 0;
const createCandidate = async () => {
  sequence += 1;
  return (await createVerifiedUser({ email: `v06-baseline-${sequence}@example.com` })).user;
};

const createGenerated = async (candidate, overrides = {}) => {
  const category = await Category.create({ name: `Engineering ${++sequence}`, level: "FIELD" });
  return CandidateCV.create({
    candidateUserId: candidate._id,
    name: "Source CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId: category._id,
    skillTags: ["Backend"],
    preferredLocations: [{ provinceCode: "79", districtCode: null }],
    employmentTypes: ["FULL_TIME"],
    workModes: ["REMOTE"],
    generatedContent: {},
    ...overrides,
  });
};

const readSource = (cv) => CandidateCV.collection.findOne({ _id: cv._id });
const prepare = (candidate, cv) => prepareOwnGeneratedCvBaseline({
  actorUser: candidate,
  candidateUserId: candidate._id,
  candidateCvId: cv._id.toString(),
});

describe("AI-V06 Slice 04 — Generated CV baseline (F02/BR-AI-04)", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("keeps all seven career sections, fixed content, and metadata from an ACTIVE source without mutation", async () => {
    const candidate = await createCandidate();
    const cv = await createGenerated(candidate, {
      generatedContent: {
        personalInfo: { fullName: "Mai Nguyen", email: "mai@example.com", phone: "+84901234567", links: ["https://example.com"] },
        professionalSummary: "Backend engineer",
        skills: ["Node.js"],
        workExperiences: [{ companyName: "Acme", startDate: new Date("2020-01-01T00:00:00.000Z"), achievements: ["Led API"] }],
        projects: [{ name: "Ledger", technologies: ["Node.js"] }],
        educations: [{ institutionName: "University", degree: "BSc" }],
        certifications: [{ name: "Cloud certification" }],
        languages: [{ name: "English", proficiency: "FLUENT" }],
        hiddenSections: ["projects"],
      },
    });
    const activation = await activateOwnGeneratedCandidateCv({
      actorUser: candidate,
      candidateUserId: candidate._id,
      candidateCvId: cv._id.toString(),
    });
    expect(activation.completeness.isComplete).toBe(true);
    expect(activation.cv.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
    const before = await readSource(cv);
    expect(before.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);

    const baseline = await prepare(candidate, cv);

    expect(baseline.generatedContent).toEqual(before.generatedContent);
    expect(baseline.careerSections).toEqual({
      professionalSummary: before.generatedContent.professionalSummary,
      skills: before.generatedContent.skills,
      workExperiences: before.generatedContent.workExperiences,
      projects: before.generatedContent.projects,
      educations: before.generatedContent.educations,
      certifications: before.generatedContent.certifications,
      languages: before.generatedContent.languages,
    });
    expect(baseline.metadata).toEqual({
      name: before.name,
      visibility: before.visibility,
      categoryId: before.categoryId,
      experienceLevelId: before.experienceLevelId,
      preferredLocations: before.preferredLocations,
      skillTags: before.skillTags,
      employmentTypes: before.employmentTypes,
      workModes: before.workModes,
    });
    baseline.generatedContent.personalInfo.fullName = "Changed";
    baseline.generatedContent.hiddenSections.push("skills");
    baseline.careerSections.workExperiences[0].companyName = "Changed";
    baseline.metadata.skillTags.push("Changed");
    expect(baseline.generatedContent.workExperiences[0].companyName).toBe("Acme");
    expect(await readSource(cv)).toEqual(before);
  });

  it("supports a sparse, incomplete DRAFT without filling absent persisted content", async () => {
    const candidate = await createCandidate();
    const cv = await createGenerated(candidate);
    await CandidateCV.collection.updateOne({ _id: cv._id }, {
      $set: { "generatedContent.personalInfo.fullName": "Mai" },
      $unset: {
        "generatedContent.professionalSummary": "",
        "generatedContent.skills": "",
        "generatedContent.workExperiences": "",
        "generatedContent.projects": "",
        "generatedContent.educations": "",
        "generatedContent.certifications": "",
        "generatedContent.languages": "",
        "generatedContent.hiddenSections": "",
        skillTags: "",
      },
    });
    const before = await readSource(cv);

    const baseline = await prepare(candidate, cv);

    expect(baseline.generatedContent).toEqual(before.generatedContent);
    expect(Object.hasOwn(baseline.generatedContent, "skills")).toBe(false);
    expect(Object.hasOwn(baseline.generatedContent, "hiddenSections")).toBe(false);
    expect(Object.hasOwn(baseline.metadata, "skillTags")).toBe(false);
    expect(baseline.careerSections).toEqual({
      professionalSummary: null,
      skills: [],
      workExperiences: [],
      projects: [],
      educations: [],
      certifications: [],
      languages: [],
    });
    expect(baseline.generatedContent.personalInfo.fullName).toBe("Mai");
    expect(await readSource(cv)).toEqual(before);
  });

  it("uses the V7 owner read gate and refuses Uploaded sources", async () => {
    const owner = await createCandidate();
    const other = await createCandidate();
    const cv = await createGenerated(owner);
    await expect(prepare(other, cv)).rejects.toMatchObject({ statusCode: 404 });
    await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: { archivedAt: new Date() } });
    await expect(prepare(owner, cv)).rejects.toMatchObject({ statusCode: 404 });

    const uploaded = await createGenerated(owner);
    await CandidateCV.collection.updateOne({ _id: uploaded._id }, {
      $set: {
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        uploadedFile: { storageKey: "candidate-cvs/uploaded/cv.pdf", originalFileName: "cv.pdf", mimeType: "application/pdf", sizeBytes: 100, pageCount: 1, uploadedAt: new Date() },
      },
      $unset: { generatedContent: "" },
    });
    await expect(prepare(owner, uploaded)).rejects.toMatchObject({ statusCode: 409 });
  });
});
