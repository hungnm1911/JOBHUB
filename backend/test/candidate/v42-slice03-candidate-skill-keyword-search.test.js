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
import USER_STATUS from "../../src/constants/user-status.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
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

const SEARCH_ROUTE = "/api/jobs/candidate-search/cvs";

const createRecruiter = async (emailPrefix = "v42.s03") => {
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

  return recruiter;
};

const createCandidate = async (suffix, overrides = {}) => {
  return createVerifiedUser({
    email: `candidate.v42.s03.${suffix}@example.com`,
    fullName: `Candidate ${suffix}`,
    ...overrides,
  });
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
  employmentTypes = [],
  generatedContent = {},
  originalFileName = "uploaded.pdf",
}) => {
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
    preferredLocations: [],
    employmentTypes,
    workModes: [],
    isDefault: false,
  };

  if (sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    baseDoc.generatedContent = generatedContent;
  } else {
    baseDoc.uploadedFile = {
      storageKey: `candidate-cvs/${new mongoose.Types.ObjectId().toString()}`,
      originalFileName,
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

const ids = (results) => results.map((item) => item.cvId);

describe("V4.2 Slice 03 — Candidate Skill Keyword Search (F05; BR-22–BR-26)", () => {
  let recruiter;
  let category;
  let candidate;

  const search = (filters) =>
    listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
      filters,
    });

  const seedCv = (overrides) =>
    createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      ...overrides,
    });

  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const seedBase = async () => {
    category = await Category.create({
      name: "Software Engineering",
      level: CATEGORY_LEVEL.FIELD,
    });
    recruiter = await createRecruiter();
    candidate = await createCandidate("base");
  };

  it("keeps existing results, filters, and sort when keyword is absent or blank", async () => {
    await seedBase();
    const older = await seedCv({
      name: "Older",
      skillTags: ["nodejs"],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const newer = await seedCv({
      name: "Newer",
      skillTags: ["react"],
      employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
      updatedAt: new Date("2026-08-05T00:00:00.000Z"),
    });
    const noTags = await seedCv({
      name: "No Tags",
      skillTags: [],
      updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    });

    const expectedAll = [newer, noTags, older].map((cv) => cv._id.toString());

    expect(ids(await search())).toEqual(expectedAll);
    expect(ids(await search({ keyword: undefined }))).toEqual(expectedAll);
    expect(ids(await search({ keyword: null }))).toEqual(expectedAll);
    expect(ids(await search({ keyword: "   " }))).toEqual(expectedAll);
    expect(
      ids(
        await search({
          keyword: "",
          employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
        }),
      ),
    ).toEqual([newer._id.toString(), older._id.toString()]);
  });

  it("matches keyword as a case-insensitive substring of any skill tag (BR-23, BR-24)", async () => {
    await seedBase();
    const nodeCv = await seedCv({
      name: "Node",
      skillTags: ["NodeJS"],
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const mixedCv = await seedCv({
      name: "Mixed",
      skillTags: ["java", "MongoDB", "spring"],
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await seedCv({ name: "React", skillTags: ["react"] });
    await seedCv({ name: "Empty", skillTags: [] });

    expect(ids(await search({ keyword: "node" }))).toEqual([
      nodeCv._id.toString(),
    ]);
    expect(ids(await search({ keyword: "NODE" }))).toEqual([
      nodeCv._id.toString(),
    ]);
    expect(ids(await search({ keyword: "  oDeJ  " }))).toEqual([
      nodeCv._id.toString(),
    ]);
    expect(ids(await search({ keyword: "mongo" }))).toEqual([
      mixedCv._id.toString(),
    ]);
    expect(ids(await search({ keyword: "a" }))).toEqual(
      expect.arrayContaining([mixedCv._id.toString()]),
    );
    expect(await search({ keyword: "python" })).toEqual([]);
  });

  it("treats regex metacharacters in the keyword as literal text", async () => {
    await seedBase();
    const cppCv = await seedCv({ name: "Cpp", skillTags: ["C++"] });
    const cCv = await seedCv({ name: "C", skillTags: ["c"] });
    const dottedCv = await seedCv({ name: "Dotted", skillTags: ["node.js"] });
    await seedCv({ name: "Undotted", skillTags: ["nodexjs"] });
    const bracketCv = await seedCv({ name: "Bracket", skillTags: ["[a-z](x)|y$"] });

    expect(ids(await search({ keyword: "c++" }))).toEqual([
      cppCv._id.toString(),
    ]);
    expect(ids(await search({ keyword: "c" }))).toEqual(
      expect.arrayContaining([cppCv._id.toString(), cCv._id.toString()]),
    );
    expect(ids(await search({ keyword: "node.js" }))).toEqual([
      dottedCv._id.toString(),
    ]);
    expect(await search({ keyword: ".*" })).toEqual([]);
    expect(await search({ keyword: "^c$" })).toEqual([]);
    expect(ids(await search({ keyword: "(" }))).toEqual([
      bracketCv._id.toString(),
    ]);
    expect(await search({ keyword: "+" })).toEqual([
      expect.objectContaining({ cvId: cppCv._id.toString() }),
    ]);
    expect(ids(await search({ keyword: "[a-z](x)|y$" }))).toEqual([
      bracketCv._id.toString(),
    ]);
  });

  it("does not match the keyword against Candidate/CV fields other than skillTags (BR-22)", async () => {
    await seedBase();
    const namedCandidate = await createCandidate("mongo", {
      fullName: "Mongo Nguyen",
    });

    await createCandidateCv({
      candidateUserId: namedCandidate.user._id,
      categoryId: category._id,
      name: "Mongo Expert CV",
      skillTags: ["java"],
      generatedContent: { professionalSummary: "Mongo database specialist" },
    });
    await createCandidateCv({
      candidateUserId: namedCandidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      name: "Uploaded Mongo CV",
      skillTags: ["python"],
      originalFileName: "mongo-resume.pdf",
    });
    const skillMatch = await seedCv({ name: "Plain", skillTags: ["mongodb"] });

    expect(ids(await search({ keyword: "mongo" }))).toEqual([
      skillMatch._id.toString(),
    ]);
  });

  it("combines keyword and structured skillTags filter with AND (BR-26)", async () => {
    await seedBase();
    const both = await seedCv({ name: "Both", skillTags: ["nodejs", "mongodb"] });
    await seedCv({ name: "Structured Only", skillTags: ["nodejs"] });
    await seedCv({ name: "Keyword Only", skillTags: ["mongodb"] });
    await seedCv({ name: "Neither", skillTags: ["react"] });

    expect(
      ids(await search({ keyword: "mongo", skillTags: ["nodejs"] })),
    ).toEqual([both._id.toString()]);
    expect(
      await search({ keyword: "python", skillTags: ["nodejs"] }),
    ).toEqual([]);
  });

  it("keeps structured skillTags filter exact, case-sensitive, ANY semantics (BR-25)", async () => {
    await seedBase();
    const lower = await seedCv({
      name: "Lower",
      skillTags: ["nodejs", "docker"],
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const react = await seedCv({
      name: "React",
      skillTags: ["react"],
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    expect(await search({ skillTags: ["NodeJS"] })).toEqual([]);
    expect(await search({ skillTags: ["node"] })).toEqual([]);
    expect(ids(await search({ skillTags: ["nodejs"] }))).toEqual([
      lower._id.toString(),
    ]);
    expect(ids(await search({ skillTags: ["nodejs", "react"] }))).toEqual([
      react._id.toString(),
      lower._id.toString(),
    ]);
  });

  it("keeps Candidate Search eligibility unchanged for keyword matches", async () => {
    await seedBase();
    const unverified = await createCandidate("unverified");
    const locked = await createCandidate("locked", {
      status: USER_STATUS.LOCKED,
    });

    await User.updateOne(
      { _id: unverified.user._id },
      { $set: { emailVerifiedAt: null } },
    );

    const eligibleGenerated = await seedCv({
      name: "Eligible Generated",
      skillTags: ["mongodb"],
    });
    const eligibleUploaded = await seedCv({
      name: "Eligible Uploaded",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      skillTags: ["MongoDB Atlas"],
    });
    await seedCv({
      name: "Draft",
      status: CANDIDATE_CV_STATUS.DRAFT,
      skillTags: ["mongodb"],
    });
    await seedCv({
      name: "Private",
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      skillTags: ["mongodb"],
    });
    await seedCv({
      name: "Archived",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      archivedAt: new Date("2026-08-10T00:00:00.000Z"),
      skillTags: ["mongodb"],
    });
    await createCandidateCv({
      candidateUserId: unverified.user._id,
      categoryId: category._id,
      name: "Unverified Owner",
      skillTags: ["mongodb"],
    });
    await createCandidateCv({
      candidateUserId: locked.user._id,
      categoryId: category._id,
      name: "Locked Owner",
      skillTags: ["mongodb"],
    });

    const results = await search({ keyword: "MONGO" });

    expect(results).toHaveLength(2);
    expect(ids(results)).toEqual(
      expect.arrayContaining([
        eligibleGenerated._id.toString(),
        eligibleUploaded._id.toString(),
      ]),
    );
  });

  it("supports the keyword query param over HTTP and rejects non-string keyword without mutating CVs", async () => {
    await seedBase();
    const agent = createTestAgent();
    const both = await seedCv({ name: "Both", skillTags: ["nodejs", "mongodb"] });
    await seedCv({ name: "Structured Only", skillTags: ["nodejs"] });
    const before = await CandidateCV.findById(both._id).lean();

    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const response = await agent
      .get(SEARCH_ROUTE)
      .query({ keyword: "MONGO", skillTags: "nodejs" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.cvs.map((cv) => cv.cvId)).toEqual([
      both._id.toString(),
    ]);

    const invalid = await agent
      .get(`${SEARCH_ROUTE}?keyword=node&keyword=mongo`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(invalid.status).toBe(400);

    const after = await CandidateCV.findById(both._id).lean();

    expect(after.skillTags).toEqual(before.skillTags);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it("does not open Candidate Search to non-Recruiter actors via keyword", async () => {
    await seedBase();
    const agent = createTestAgent();

    await seedCv({ name: "Mongo", skillTags: ["mongodb"] });

    const anonymous = await agent.get(SEARCH_ROUTE).query({ keyword: "mongo" });

    expect(anonymous.status).toBe(401);

    const candidateToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const asCandidate = await agent
      .get(SEARCH_ROUTE)
      .query({ keyword: "mongo" })
      .set("Authorization", `Bearer ${candidateToken}`);

    expect(asCandidate.status).toBe(403);
  });
});
