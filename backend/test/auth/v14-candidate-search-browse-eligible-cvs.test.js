import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import USER_STATUS from "../../src/constants/user-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import Job from "../../src/models/job.model.js";
import User from "../../src/models/user.model.js";
import { listCandidateSearchEligibleCandidateCvs } from "../../src/services/candidate-cv.service.js";
import {
  DEFAULT_PASSWORD,
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

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
  });
};

const createPositionCategory = async ({
  fieldCategoryId,
  name = "Backend Developer",
} = {}) => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.POSITION,
    parentCategoryId: fieldCategoryId,
  });
};

const createExperienceLevel = async (
  code = "UNDER_1_YEAR",
) => {
  return ExperienceLevel.create({ code });
};

const createRecruiterWithProofJob = async ({
  emailPrefix = "v14.browse",
} = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `${emailPrefix}.recruiter@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-R`,
  });

  await Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: recruiter.membership._id,
    primaryRecruiterCompanyMemberId: recruiter.membership._id,
    supportingRecruiterCompanyMemberIds: [],
    status: JOB_STATUS.DRAFT,
  });

  return { manager, recruiter };
};

const createCandidateCv = async ({
  candidateUserId,
  categoryId,
  sourceType = CANDIDATE_CV_SOURCE_TYPE.GENERATED,
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
  archivedAt = null,
  name = "Candidate CV",
  updatedAt,
  skillTags = [],
  preferredLocations = [],
  employmentTypes = [],
  workModes = [],
} = {}) => {
  const baseDoc = {
    candidateUserId,
    categoryId,
    name,
    sourceType,
    status,
    visibility,
    archivedAt,
    experienceLevelId: null,
    skillTags,
    preferredLocations,
    employmentTypes,
    workModes,
    isDefault: false,
  };

  if (sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    baseDoc.generatedContent = {};
  } else {
    baseDoc.uploadedFile = {
      storageKey: `candidate-cvs/${new mongoose.Types.ObjectId().toString()}`,
      originalFileName: "uploaded.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      pageCount: 1,
      uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
  }

  const created = await CandidateCV.create(baseDoc);

  if (updatedAt) {
    await CandidateCV.updateOne(
      { _id: created._id },
      { $set: { updatedAt } },
      { timestamps: false },
    );
  }

  return CandidateCV.findById(created._id);
};

describe("V14 Slice 02 — Browse eligible Candidate CV list + stable sort (F02, F04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("declares CandidateCV browse/sort indexes with V14 partial scope", async () => {
    await CandidateCV.syncIndexes();
    const indexes = await CandidateCV.collection.indexes();

    const findIndex = (key) =>
      indexes.find((idx) => JSON.stringify(idx.key) === JSON.stringify(key));

    const expectedKeys = [
      { updatedAt: -1, _id: -1 },
      { categoryId: 1, updatedAt: -1, _id: -1 },
      { experienceLevelId: 1, updatedAt: -1, _id: -1 },
      { skillTags: 1, updatedAt: -1, _id: -1 },
      { preferredLocations: 1, updatedAt: -1, _id: -1 },
      { employmentTypes: 1, updatedAt: -1, _id: -1 },
      { workModes: 1, updatedAt: -1, _id: -1 },
    ];

    for (const key of expectedKeys) {
      const index = findIndex(key);
      expect(index).toBeTruthy();
      expect(index.partialFilterExpression).toEqual({
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        archivedAt: null,
      });
    }
  });

  it("returns only search-eligible CVs and keeps per-CV independent results (BR-07..BR-16, BR-25, BR-32)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice02.eligible",
    });
    const candidateA = await createVerifiedUser({
      email: "candidate.v14.slice02.a@example.com",
      fullName: "Candidate A",
    });
    const candidateB = await createVerifiedUser({
      email: "candidate.v14.slice02.b@example.com",
      fullName: "Candidate B",
    });
    const unverifiedCandidate = await createVerifiedUser({
      email: "candidate.v14.slice02.unverified@example.com",
      fullName: "Candidate Unverified",
    });
    const inactiveCandidate = await createVerifiedUser({
      email: "candidate.v14.slice02.inactive@example.com",
      fullName: "Candidate Inactive",
      status: USER_STATUS.LOCKED,
    });

    await User.updateOne(
      { _id: unverifiedCandidate.user._id },
      { $set: { emailVerifiedAt: null } },
    );

    const eligibleGeneratedA = await createCandidateCv({
      candidateUserId: candidateA.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Generated CV A",
      skillTags: ["nodejs"],
    });
    const eligibleUploadedA = await createCandidateCv({
      candidateUserId: candidateA.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Uploaded CV A",
      skillTags: ["react"],
    });

    await createCandidateCv({
      candidateUserId: candidateB.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Generated Draft Public",
    });
    await createCandidateCv({
      candidateUserId: candidateB.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      name: "Generated Active Private",
    });
    await createCandidateCv({
      candidateUserId: candidateB.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      archivedAt: new Date("2026-08-10T00:00:00.000Z"),
      name: "Uploaded Archived",
    });
    await createCandidateCv({
      candidateUserId: unverifiedCandidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Uploaded Unverified",
    });
    await createCandidateCv({
      candidateUserId: inactiveCandidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Generated Inactive Owner",
    });

    const results = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
    });

    expect(results).toHaveLength(2);
    expect(results.map((item) => item.cvId)).toEqual(
      expect.arrayContaining([
        eligibleGeneratedA._id.toString(),
        eligibleUploadedA._id.toString(),
      ]),
    );
    expect(results.every((item) => item.candidateFullName === "Candidate A")).toBe(
      true,
    );
  });

  it("uses stable default sort by updatedAt desc then _id desc (BR-24)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice02.sort",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice02.sort@example.com",
      fullName: "Stable Sort Candidate",
    });

    const tieTime = new Date("2026-08-18T00:00:00.000Z");

    const older = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Older",
      updatedAt: tieTime,
    });
    const newer = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "Newer",
      updatedAt: tieTime,
    });

    const results = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
    });

    expect(results).toHaveLength(2);
    expect(results[0].cvId).toBe(newer._id.toString());
    expect(results[1].cvId).toBe(older._id.toString());
  });

  it("exposes only safe summary projection on HTTP browse route and is job-independent (BR-06, BR-25)", async () => {
    const agent = createTestAgent();
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice02.http",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice02.http@example.com",
      fullName: "HTTP Candidate",
    });

    await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      name: "HTTP Generated",
      skillTags: ["javascript"],
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/jobs/candidate-search/cvs")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cvs).toHaveLength(1);
    expect(response.body.cvs[0]).toMatchObject({
      cvId: expect.any(String),
      candidateFullName: "HTTP Candidate",
      cvName: "HTTP Generated",
      categoryId: category._id.toString(),
      experienceLevelId: null,
      skillTags: ["javascript"],
      preferredLocations: [],
      employmentTypes: [],
      workModes: [],
    });
    expect(response.body.cvs[0]).not.toHaveProperty("candidateUserId");
    expect(response.body.cvs[0]).not.toHaveProperty("updatedAt");
    expect(response.body.cvs[0]).not.toHaveProperty("generatedContent");
    expect(response.body.cvs[0]).not.toHaveProperty("uploadedFile");
    expect(response.body.cvs[0]).not.toHaveProperty("email");
    expect(response.body.cvs[0]).not.toHaveProperty("phone");
    expect(response.body.cvs[0]).not.toHaveProperty("profile");
  });

  it("applies Category hierarchy filter with OR semantics in-group (BR-19, BR-21)", async () => {
    const fieldA = await createFieldCategory("Engineering");
    const positionA1 = await createPositionCategory({
      fieldCategoryId: fieldA._id,
      name: "Backend",
    });
    const positionA2 = await createPositionCategory({
      fieldCategoryId: fieldA._id,
      name: "Frontend",
    });
    const fieldB = await createFieldCategory("Design");
    const positionB1 = await createPositionCategory({
      fieldCategoryId: fieldB._id,
      name: "UI Designer",
    });
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice03.category",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice03.category@example.com",
      fullName: "Category Candidate",
    });

    const cvFieldA = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: fieldA._id,
      name: "CV Field A",
    });
    const cvPositionA1 = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: positionA1._id,
      name: "CV Position A1",
    });
    const cvPositionA2 = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: positionA2._id,
      name: "CV Position A2",
    });
    const cvPositionB1 = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: positionB1._id,
      name: "CV Position B1",
    });

    const results = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        categoryIds: [fieldA._id.toString(), positionB1._id.toString()],
      },
    });

    expect(results.map((result) => result.cvId)).toEqual(
      expect.arrayContaining([
        cvFieldA._id.toString(),
        cvPositionA1._id.toString(),
        cvPositionA2._id.toString(),
        cvPositionB1._id.toString(),
      ]),
    );
    expect(results).toHaveLength(4);
  });

  it("applies Experience filter OR semantics and excludes missing metadata when filtered (BR-21, BR-22)", async () => {
    const category = await createFieldCategory("Finance");
    const junior = await createExperienceLevel("UNDER_1_YEAR");
    const senior = await createExperienceLevel("FIVE_TO_TEN_YEARS");
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice03.experience",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice03.experience@example.com",
      fullName: "Experience Candidate",
    });

    const cvJunior = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Junior",
    });
    await CandidateCV.updateOne(
      { _id: cvJunior._id },
      { $set: { experienceLevelId: junior._id } },
    );

    const cvSenior = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Senior",
    });
    await CandidateCV.updateOne(
      { _id: cvSenior._id },
      { $set: { experienceLevelId: senior._id } },
    );

    await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Missing Experience",
    });

    const filtered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        experienceLevelIds: [junior._id.toString(), senior._id.toString()],
      },
    });

    expect(filtered.map((result) => result.cvId)).toEqual(
      expect.arrayContaining([cvJunior._id.toString(), cvSenior._id.toString()]),
    );
    expect(filtered).toHaveLength(2);
  });

  it("composes AND across Category and Experience groups (BR-21)", async () => {
    const field = await createFieldCategory("Operations");
    const position = await createPositionCategory({
      fieldCategoryId: field._id,
      name: "Supply Chain Specialist",
    });
    const level = await createExperienceLevel("THREE_TO_FIVE_YEARS");
    const otherLevel = await createExperienceLevel("OVER_TEN_YEARS");
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice03.and",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice03.and@example.com",
      fullName: "AND Candidate",
    });

    const targetCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: position._id,
      name: "Target CV",
    });
    await CandidateCV.updateOne(
      { _id: targetCv._id },
      { $set: { experienceLevelId: level._id } },
    );

    const wrongExperienceCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: position._id,
      name: "Wrong Experience CV",
    });
    await CandidateCV.updateOne(
      { _id: wrongExperienceCv._id },
      { $set: { experienceLevelId: otherLevel._id } },
    );

    const wrongCategoryCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: field._id,
      name: "Wrong Category CV",
    });
    await CandidateCV.updateOne(
      { _id: wrongCategoryCv._id },
      { $set: { experienceLevelId: otherLevel._id } },
    );

    const filtered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        categoryIds: [position._id.toString()],
        experienceLevelIds: [level._id.toString()],
      },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].cvId).toBe(targetCv._id.toString());
  });

  it("supports HTTP filter query params for category + experience (F03 partial)", async () => {
    const agent = createTestAgent();
    const field = await createFieldCategory("Product");
    const position = await createPositionCategory({
      fieldCategoryId: field._id,
      name: "Product Manager",
    });
    const level = await createExperienceLevel("ONE_TO_THREE_YEARS");
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice03.http",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice03.http@example.com",
      fullName: "HTTP Filter Candidate",
    });

    const matchedCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: position._id,
      name: "Matched CV",
    });
    await CandidateCV.updateOne(
      { _id: matchedCv._id },
      { $set: { experienceLevelId: level._id } },
    );

    await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: field._id,
      name: "No Experience CV",
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/jobs/candidate-search/cvs")
      .query({
        categoryIds: field._id.toString(),
        experienceLevelIds: level._id.toString(),
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cvs).toHaveLength(1);
    expect(response.body.cvs[0].cvId).toBe(matchedCv._id.toString());
  });

  it("applies Skill/Location/EmploymentType/WorkMode with OR in-group and excludes missing metadata when filtered (BR-20..BR-23)", async () => {
    const category = await createFieldCategory("Marketing");
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice04.or",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice04.or@example.com",
      fullName: "Slice04 OR Candidate",
    });

    const cvSkillOnly = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Skill Only",
      skillTags: ["nodejs"],
      preferredLocations: [],
      employmentTypes: [],
      workModes: [],
    });
    const cvLocationOnly = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Location Only",
      skillTags: [],
      preferredLocations: [LOCATION.HA_NOI],
      employmentTypes: [],
      workModes: [],
    });
    const cvEmploymentOnly = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Employment Only",
      skillTags: [],
      preferredLocations: [],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [],
    });
    const cvWorkModeOnly = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV WorkMode Only",
      skillTags: [],
      preferredLocations: [],
      employmentTypes: [],
      workModes: [WORK_MODE.REMOTE],
    });
    await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "CV Missing Optional Metadata",
      skillTags: [],
      preferredLocations: [],
      employmentTypes: [],
      workModes: [],
    });

    const skillFiltered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        skillTags: ["nodejs", "reactjs"],
      },
    });
    expect(skillFiltered).toHaveLength(1);
    expect(skillFiltered[0].cvId).toBe(cvSkillOnly._id.toString());

    const locationFiltered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        preferredLocations: [LOCATION.HA_NOI, LOCATION.DA_NANG],
      },
    });
    expect(locationFiltered).toHaveLength(1);
    expect(locationFiltered[0].cvId).toBe(cvLocationOnly._id.toString());

    const employmentFiltered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        employmentTypes: [
          EMPLOYMENT_TYPE.FULL_TIME,
          EMPLOYMENT_TYPE.PART_TIME,
        ],
      },
    });
    expect(employmentFiltered).toHaveLength(1);
    expect(employmentFiltered[0].cvId).toBe(cvEmploymentOnly._id.toString());

    const workModeFiltered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        workModes: [WORK_MODE.REMOTE, WORK_MODE.ONSITE],
      },
    });
    expect(workModeFiltered).toHaveLength(1);
    expect(workModeFiltered[0].cvId).toBe(cvWorkModeOnly._id.toString());
  });

  it("composes AND across all six filter groups including Slice 03 groups (BR-21)", async () => {
    const field = await createFieldCategory("Data");
    const position = await createPositionCategory({
      fieldCategoryId: field._id,
      name: "Data Engineer",
    });
    const experience = await createExperienceLevel("THREE_TO_FIVE_YEARS");
    const otherExperience = await createExperienceLevel("ONE_TO_THREE_YEARS");
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice04.and6",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice04.and6@example.com",
      fullName: "Slice04 AND Candidate",
    });

    const targetCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: position._id,
      name: "Target CV 6 groups",
      skillTags: ["nodejs", "mongodb"],
      preferredLocations: [LOCATION.HA_NOI],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [WORK_MODE.HYBRID],
    });
    await CandidateCV.updateOne(
      { _id: targetCv._id },
      { $set: { experienceLevelId: experience._id } },
    );

    const wrongSkill = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: position._id,
      name: "Wrong Skill",
      skillTags: ["reactjs"],
      preferredLocations: [LOCATION.HA_NOI],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [WORK_MODE.HYBRID],
    });
    await CandidateCV.updateOne(
      { _id: wrongSkill._id },
      { $set: { experienceLevelId: experience._id } },
    );

    const wrongExperience = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: position._id,
      name: "Wrong Experience",
      skillTags: ["nodejs"],
      preferredLocations: [LOCATION.HA_NOI],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [WORK_MODE.HYBRID],
    });
    await CandidateCV.updateOne(
      { _id: wrongExperience._id },
      { $set: { experienceLevelId: otherExperience._id } },
    );

    const filtered = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters: {
        categoryIds: [field._id.toString()],
        experienceLevelIds: [experience._id.toString()],
        skillTags: ["nodejs"],
        preferredLocations: [LOCATION.HA_NOI],
        employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
        workModes: [WORK_MODE.HYBRID],
      },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].cvId).toBe(targetCv._id.toString());
  });

  it("supports HTTP query params for Skill/Location/EmploymentType/WorkMode filters", async () => {
    const agent = createTestAgent();
    const category = await createFieldCategory("HR");
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice04.http",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice04.http@example.com",
      fullName: "Slice04 HTTP Candidate",
    });

    const matchedCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Slice04 HTTP Matched",
      skillTags: ["nodejs"],
      preferredLocations: [LOCATION.HA_NOI],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      workModes: [WORK_MODE.REMOTE],
    });

    await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Slice04 HTTP Unmatched",
      skillTags: ["reactjs"],
      preferredLocations: [LOCATION.DA_NANG],
      employmentTypes: [EMPLOYMENT_TYPE.CONTRACT],
      workModes: [WORK_MODE.ONSITE],
    });

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get("/api/jobs/candidate-search/cvs")
      .query({
        skillTags: "nodejs",
        preferredLocations: LOCATION.HA_NOI,
        employmentTypes: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: WORK_MODE.REMOTE,
      })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cvs).toHaveLength(1);
    expect(response.body.cvs[0].cvId).toBe(matchedCv._id.toString());
  });
});
