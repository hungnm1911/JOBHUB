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
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import {
  migrate as migrateExperienceLevels,
  verify as verifyExperienceLevels,
} from "../../src/database/migrations/v4-experience-level-dataset.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import {
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CANONICAL_EXPERIENCE_LEVEL_CODES = Object.freeze([
  "NO_EXPERIENCE",
  "UNDER_1_YEAR",
  "ONE_TO_THREE_YEARS",
  "THREE_TO_FIVE_YEARS",
  "FIVE_TO_TEN_YEARS",
  "OVER_TEN_YEARS",
]);

const readPersistedExperienceLevels = async () => {
  const documents = await ExperienceLevel.find().lean();

  return documents.map((document) => ({
    id: document._id.toString(),
    code: document.code,
  }));
};

describe("V4.2 Slice 02 — Public Experience Level Catalog Read (F04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("reads the full canonical catalog publicly without authentication", async () => {
    await migrateExperienceLevels();

    const response = await createTestAgent().get("/api/experience-levels");

    expect(response.status).toBe(200);
    expect(
      response.body.experienceLevels.map((experienceLevel) => experienceLevel.code),
    ).toEqual(CANONICAL_EXPERIENCE_LEVEL_CODES);
  });

  it("returns the same catalog to an authenticated actor", async () => {
    await migrateExperienceLevels();
    const agent = createTestAgent();
    await createVerifiedUser({ email: "candidate@example.com" });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: "candidate@example.com",
    });

    const anonymous = await createTestAgent().get("/api/experience-levels");
    const authenticated = await agent
      .get("/api/experience-levels")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(authenticated.status).toBe(200);
    expect(authenticated.body).toEqual(anonymous.body);
  });

  it("exposes exactly the persisted identifier and canonical code for each level", async () => {
    await migrateExperienceLevels();
    const persisted = await readPersistedExperienceLevels();

    const response = await createTestAgent().get("/api/experience-levels");

    expect(Object.keys(response.body)).toEqual(["experienceLevels"]);
    expect(response.body.experienceLevels).toHaveLength(6);
    expect(response.body.experienceLevels).toEqual(
      CANONICAL_EXPERIENCE_LEVEL_CODES.map((code) =>
        persisted.find((experienceLevel) => experienceLevel.code === code),
      ),
    );

    for (const experienceLevel of response.body.experienceLevels) {
      expect(Object.keys(experienceLevel).sort()).toEqual(["code", "id"]);
    }
  });

  it("includes every level regardless of whether a Job or CandidateCV references it", async () => {
    await migrateExperienceLevels();
    const before = await createTestAgent().get("/api/experience-levels");
    const referenced = before.body.experienceLevels.find(
      (experienceLevel) =>
        experienceLevel.code === EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
    );
    const { user } = await createVerifiedUser({
      email: "cv.owner@example.com",
    });
    const category = await Category.create({
      name: "Software Engineering",
      level: CATEGORY_LEVEL.FIELD,
      parentCategoryId: null,
    });

    await CandidateCV.create({
      candidateUserId: user._id,
      name: "Generated CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId: category._id,
      experienceLevelId: referenced.id,
      generatedContent: {},
    });

    const after = await createTestAgent().get("/api/experience-levels");

    expect(before.status).toBe(200);
    expect(after.status).toBe(200);
    expect(after.body).toEqual(before.body);
    expect(after.body.experienceLevels).toHaveLength(6);
  });

  it("does not initialize or mutate the canonical ExperienceLevel dataset", async () => {
    const emptyResponse = await createTestAgent().get("/api/experience-levels");

    expect(emptyResponse.status).toBe(200);
    expect(await ExperienceLevel.countDocuments()).toBe(0);

    await migrateExperienceLevels();
    const persistedBefore = await ExperienceLevel.find().sort({ code: 1 }).lean();

    await createTestAgent().get("/api/experience-levels");

    const persistedAfter = await ExperienceLevel.find().sort({ code: 1 }).lean();

    expect(persistedAfter).toEqual(persistedBefore);
    await expect(verifyExperienceLevels()).resolves.toMatchObject({
      ok: true,
      totalCount: 6,
    });
  });
});
