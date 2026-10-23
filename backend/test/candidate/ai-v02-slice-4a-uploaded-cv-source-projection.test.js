import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import { projectAuthorizedUploadedCandidateCvSource } from "../../src/services/candidate-cv-ai-normalization.service.js";
import { loadOwnActiveCandidateCv } from "../../src/services/candidate-cv.service.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/database.js";

let sequence = 0;
const candidate = async () => {
  sequence += 1;
  return (await createVerifiedUser({ email: `candidate.ai-v02-4a.${sequence}@example.com` })).user;
};

const createTaxonomy = async () => {
  const field = await Category.create({ name: "Engineering", level: CATEGORY_LEVEL.FIELD });
  const position = await Category.create({
    name: "Backend Developer",
    level: CATEGORY_LEVEL.POSITION,
    parentCategoryId: field._id,
  });
  const experienceLevel = await ExperienceLevel.create({ code: EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS });
  return { field, position, experienceLevel };
};

const createUploaded = (owner, taxonomy, overrides = {}) => CandidateCV.create({
  candidateUserId: owner._id,
  name: "Private uploaded CV",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  status: CANDIDATE_CV_STATUS.ACTIVE,
  visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
  categoryId: taxonomy.position._id,
  experienceLevelId: taxonomy.experienceLevel._id,
  skillTags: ["Node.js", "Backend", "Node.js"],
  employmentTypes: ["FULL_TIME", "CONTRACT"],
  workModes: ["REMOTE", "HYBRID"],
  preferredLocations: [
    { provinceCode: "79", districtCode: null },
    { provinceCode: "1", districtCode: "271" },
  ],
  uploadedFile: {
    storageKey: "candidate-cvs/uploaded/ai-v02-4a",
    originalFileName: "cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4096,
    pageCount: 1,
    uploadedAt: new Date("2026-01-15T00:00:00.000Z"),
  },
  ...overrides,
});

const loadOwn = (owner, cv) => loadOwnActiveCandidateCv({
  candidateUserId: owner._id,
  actorUser: owner,
  candidateCvId: cv._id.toString(),
});

const expectAppError = async (promise, statusCode, issue) => {
  const error = await promise.then(() => null, (caught) => caught);
  expect(error).toMatchObject({ name: "AppError", statusCode });
  if (issue) {
    expect(error.details.issues).toEqual(expect.arrayContaining([expect.stringContaining(issue)]));
  }
};

describe("AI-V02 Slice 4a — authorized Uploaded CandidateCV source projection", () => {
  beforeAll(connectTestDatabase);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });
  afterAll(disconnectTestDatabase);

  it("projects exactly eight persisted metadata fields and resolved taxonomy without reading PDF or AI Kit", async () => {
    const owner = await candidate();
    const taxonomy = await createTaxonomy();
    const cv = await createUploaded(owner, taxonomy);
    const before = await CandidateCV.collection.findOne({ _id: cv._id });

    const source = await projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv));

    expect(source).toEqual({
      candidateCvId: cv._id.toString(),
      categoryId: taxonomy.position._id.toString(),
      experienceLevelId: taxonomy.experienceLevel._id.toString(),
      skillTags: ["Node.js", "Backend", "Node.js"],
      employmentTypes: ["FULL_TIME", "CONTRACT"],
      workModes: ["REMOTE", "HYBRID"],
      preferredLocations: [
        { provinceCode: "79", districtCode: null },
        { provinceCode: "1", districtCode: "271" },
      ],
      taxonomy: {
        category: {
          id: taxonomy.position._id.toString(),
          name: "Backend Developer",
          level: CATEGORY_LEVEL.POSITION,
          parentCategoryId: taxonomy.field._id.toString(),
        },
        experienceLevel: {
          id: taxonomy.experienceLevel._id.toString(),
          code: EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
        },
      },
    });
    expect(await CandidateCV.collection.findOne({ _id: cv._id })).toEqual(before);
  });

  it("refuses Generated sources without changing B2", async () => {
    const owner = await candidate();
    const taxonomy = await createTaxonomy();
    const generated = await CandidateCV.create({
      candidateUserId: owner._id,
      name: "Generated CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId: taxonomy.field._id,
      generatedContent: {},
    });
    await expectAppError(projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, generated)), 409);
  });

  it("refuses unauthorized and archived sources at the canonical access boundary", async () => {
    const owner = await candidate();
    const other = await candidate();
    const taxonomy = await createTaxonomy();
    const cv = await createUploaded(owner, taxonomy);
    const archived = await createUploaded(owner, taxonomy, { archivedAt: new Date() });

    await expectAppError(loadOwn(other, cv), 404);
    await expectAppError(loadOwn(owner, archived), 404);
  });

  it("refuses invalid or missing taxonomy references", async () => {
    const owner = await candidate();
    const taxonomy = await createTaxonomy();
    const cv = await createUploaded(owner, taxonomy);

    await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: { categoryId: new mongoose.Types.ObjectId() } });
    await expectAppError(projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv)), 400);

    await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: { categoryId: taxonomy.position._id } });
    await Category.collection.updateOne({ _id: taxonomy.position._id }, { $set: { level: "INDUSTRY" } });
    await expectAppError(projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv)), 400);

    await Category.collection.updateOne({ _id: taxonomy.position._id }, { $set: { level: CATEGORY_LEVEL.POSITION } });
    await CandidateCV.collection.updateOne({ _id: cv._id }, { $set: { experienceLevelId: new mongoose.Types.ObjectId() } });
    await expectAppError(projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv)), 400);
  });

  it("keeps nullable ExperienceLevel persisted as null with no invented taxonomy", async () => {
    const owner = await candidate();
    const taxonomy = await createTaxonomy();
    const cv = await createUploaded(owner, taxonomy, {
      categoryId: taxonomy.field._id,
      experienceLevelId: null,
    });

    const source = await projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv));
    expect(source.categoryId).toBe(taxonomy.field._id.toString());
    expect(source.experienceLevelId).toBeNull();
    expect(source.taxonomy).toEqual({
      category: {
        id: taxonomy.field._id.toString(),
        name: "Engineering",
        level: CATEGORY_LEVEL.FIELD,
        parentCategoryId: null,
      },
      experienceLevel: null,
    });
  });

  it.each(["experienceLevelId", "skillTags", "preferredLocations"])(
    "refuses a missing persisted %s rather than filling a Mongoose default",
    async (field) => {
      const owner = await candidate();
      const taxonomy = await createTaxonomy();
      const cv = await createUploaded(owner, taxonomy);
      await CandidateCV.collection.updateOne(
        { _id: cv._id },
        { $unset: { [field]: "" } },
        { bypassDocumentValidation: true },
      );

      await expectAppError(projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv)), 500, `/${field} must be persisted`);
    },
  );

  it.each([
    [{ categoryId: "507f1f77bcf86cd799439011" }, "/categoryId"],
    [{ skillTags: "Node.js" }, "/skillTags"],
    [{ employmentTypes: ["INVALID"] }, "/employmentTypes/0"],
    [{ preferredLocations: [{ provinceCode: "FOREIGN", districtCode: null }] }, "/preferredLocations/0"],
    [{ uploadedFile: null }, "/uploadedFile"],
    [{ status: CANDIDATE_CV_STATUS.DRAFT }, "/status"],
  ])("refuses malformed persisted source %# instead of accepting hydrated defaults", async (corruption, issue) => {
    const owner = await candidate();
    const taxonomy = await createTaxonomy();
    const cv = await createUploaded(owner, taxonomy);
    await CandidateCV.collection.updateOne(
      { _id: cv._id },
      { $set: corruption },
      { bypassDocumentValidation: true },
    );

    await expectAppError(projectAuthorizedUploadedCandidateCvSource(await loadOwn(owner, cv)), 500, issue);
  });
});
