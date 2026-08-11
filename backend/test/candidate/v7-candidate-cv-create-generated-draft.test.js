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
import EXPERIENCE_LEVEL from "../../src/constants/experience-level.js";
import LOCATION from "../../src/constants/location.js";
import USER_ROLE from "../../src/constants/user-role.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import ExperienceLevel from "../../src/models/experience-level.model.js";
import {
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
    parentCategoryId: null,
  });
};

const createPositionCategory = async ({
  name = "Backend Engineer",
  parentCategoryId,
}) => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.POSITION,
    parentCategoryId,
  });
};

const createExperienceLevel = async (
  code = EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
) => {
  return ExperienceLevel.create({
    code,
  });
};

const requiredDraftBody = ({
  categoryId,
  name = "My Generated Draft",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
} = {}) => {
  return {
    name,
    visibility,
    categoryId: categoryId.toString(),
  };
};

describe("V7 Slice 03 — Create Generated CV Draft (F03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("required and optional metadata", () => {
    it("creates GENERATED/DRAFT with required metadata only and empty generated content", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.draft.required@example.com",
      });
      const category = await createFieldCategory();
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(requiredDraftBody({ categoryId: category._id }));

      expect(response.status).toBe(201);
      expect(response.body.cv).toMatchObject({
        candidateUserId: user._id.toString(),
        name: "My Generated Draft",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        status: CANDIDATE_CV_STATUS.DRAFT,
        visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        categoryId: category._id.toString(),
        experienceLevelId: null,
        preferredLocations: [],
        skillTags: [],
        employmentTypes: [],
        workModes: [],
        isDefault: false,
        archivedAt: null,
        uploadedFile: null,
      });
      expect(response.body.cv.generatedContent).toEqual({
        personalInfo: {
          fullName: null,
          email: null,
          phone: null,
          displayLocation: null,
          links: [],
          avatarUrl: null,
        },
        professionalSummary: null,
        educations: [],
        skills: [],
        workExperiences: [],
        projects: [],
        certifications: [],
        languages: [],
        hiddenSections: [],
      });

      const persisted = await CandidateCV.findById(response.body.cv.id);
      expect(persisted.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
      expect(persisted.archivedAt).toBeNull();
      expect(persisted.uploadedFile).toBeUndefined();
      expect(persisted.generatedContent).toBeTruthy();
      expect(persisted.toObject()).not.toHaveProperty("companyId");
      expect(persisted.toObject()).not.toHaveProperty("jobId");

      const listResponse = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.cvs).toHaveLength(1);
      expect(listResponse.body.cvs[0].id).toBe(response.body.cv.id);
      expect(listResponse.body.cvs[0].status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    });

    it("accepts optional V4 metadata without synthesizing Harvard content from them", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.draft.optional@example.com",
        fullName: "Optional Candidate",
      });
      const category = await createFieldCategory("Product");
      const experienceLevel = await createExperienceLevel(
        EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
      );
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...requiredDraftBody({
            categoryId: category._id,
            name: "Optional Metadata Draft",
            visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
          }),
          experienceLevelId: experienceLevel._id.toString(),
          preferredLocations: [LOCATION.HA_NOI, LOCATION.FOREIGN],
          skillTags: ["Node.js", "MongoDB"],
          employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME, EMPLOYMENT_TYPE.CONTRACT],
          workModes: [WORK_MODE.HYBRID, WORK_MODE.REMOTE],
        });

      expect(response.status).toBe(201);
      expect(response.body.cv).toMatchObject({
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        experienceLevelId: experienceLevel._id.toString(),
        preferredLocations: [LOCATION.HA_NOI, LOCATION.FOREIGN],
        skillTags: ["Node.js", "MongoDB"],
        employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME, EMPLOYMENT_TYPE.CONTRACT],
        workModes: [WORK_MODE.HYBRID, WORK_MODE.REMOTE],
        status: CANDIDATE_CV_STATUS.DRAFT,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      });
      expect(response.body.cv.generatedContent.personalInfo.fullName).toBeNull();
      expect(response.body.cv.generatedContent.skills).toEqual([]);
      expect(response.body.cv.generatedContent.workExperiences).toEqual([]);
    });

    it("rejects missing required metadata", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.draft.missing@example.com",
      });
      const category = await createFieldCategory("Ops");
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const missingName = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
          categoryId: category._id.toString(),
        });
      const missingVisibility = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "No Visibility",
          categoryId: category._id.toString(),
        });
      const missingCategory = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "No Category",
          visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        });

      expect(missingName.status).toBe(400);
      expect(missingVisibility.status).toBe(400);
      expect(missingCategory.status).toBe(400);
      expect(await CandidateCV.countDocuments()).toBe(0);
    });
  });

  describe("canonical V4 validation", () => {
    it("accepts FIELD or POSITION Category and rejects unknown Category/ExperienceLevel", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.draft.catalog@example.com",
      });
      const field = await createFieldCategory("Security");
      const position = await createPositionCategory({
        name: "Security Engineer",
        parentCategoryId: field._id,
      });
      const experienceLevel = await createExperienceLevel();
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const fieldDraft = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(requiredDraftBody({ categoryId: field._id, name: "Field Draft" }));
      const positionDraft = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(
          requiredDraftBody({
            categoryId: position._id,
            name: "Position Draft",
          }),
        );

      expect(fieldDraft.status).toBe(201);
      expect(positionDraft.status).toBe(201);
      expect(fieldDraft.body.cv.categoryId).toBe(field._id.toString());
      expect(positionDraft.body.cv.categoryId).toBe(position._id.toString());

      const unknownCategory = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(
          requiredDraftBody({
            categoryId: new mongoose.Types.ObjectId(),
            name: "Unknown Category",
          }),
        );
      const unknownExperience = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...requiredDraftBody({
            categoryId: field._id,
            name: "Unknown Experience",
          }),
          experienceLevelId: new mongoose.Types.ObjectId().toString(),
        });

      expect(unknownCategory.status).toBe(400);
      expect(unknownExperience.status).toBe(400);
      expect(experienceLevel.code).toBe(EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS);
      expect(await CandidateCV.countDocuments()).toBe(2);
    });

    it("rejects REMOTE as Preferred Location while accepting REMOTE WorkMode", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.draft.remote@example.com",
      });
      const category = await createFieldCategory("Remote Rules");
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const remoteAsLocation = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...requiredDraftBody({
            categoryId: category._id,
            name: "Remote As Location",
          }),
          preferredLocations: ["REMOTE"],
        });
      const remoteAsWorkMode = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...requiredDraftBody({
            categoryId: category._id,
            name: "Remote As WorkMode",
          }),
          workModes: [WORK_MODE.REMOTE],
        });

      expect(remoteAsLocation.status).toBe(400);
      expect(remoteAsWorkMode.status).toBe(201);
      expect(remoteAsWorkMode.body.cv.workModes).toEqual([WORK_MODE.REMOTE]);
      expect(remoteAsWorkMode.body.cv.preferredLocations).toEqual([]);
    });

    it("rejects client ownership and lifecycle override fields", async () => {
      const { user: owner } = await createVerifiedUser({
        email: "cv.draft.owner@example.com",
      });
      const { user: other } = await createVerifiedUser({
        email: "cv.draft.other@example.com",
      });
      const category = await createFieldCategory("Ownership");
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: owner.email,
      });

      const response = await agent
        .post("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...requiredDraftBody({ categoryId: category._id }),
          candidateUserId: other._id.toString(),
          companyId: new mongoose.Types.ObjectId().toString(),
          sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
          status: CANDIDATE_CV_STATUS.ACTIVE,
          isDefault: true,
          archivedAt: new Date().toISOString(),
          uploadedFile: {
            storageKey: "hack.pdf",
          },
          generatedContent: {
            personalInfo: {
              fullName: "Injected",
            },
            skills: ["Hacked"],
          },
        });

      expect(response.status).toBe(400);
      expect(await CandidateCV.countDocuments()).toBe(0);
    });
  });

  describe("authorization boundary", () => {
    it("denies non-Candidate actors and anonymous create", async () => {
      const manager = await createActiveCompanyManagerContext({
        email: "cv.draft.manager@example.com",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "cv.draft.recruiter@example.com",
        company: manager.company,
      });
      await createVerifiedUser({
        email: "cv.draft.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
        fullName: "Platform Admin",
      });
      const category = await createFieldCategory("Access");
      const agent = createTestAgent();
      const body = requiredDraftBody({ categoryId: category._id });

      for (const email of [
        manager.user.email,
        recruiter.user.email,
        "cv.draft.admin@example.com",
      ]) {
        const token = await loginAndGetAccessToken(agent, { email });
        const response = await agent
          .post("/api/candidate/cvs")
          .set("Authorization", `Bearer ${token}`)
          .send(body);

        expect(response.status).toBe(403);
      }

      const anonymous = await agent.post("/api/candidate/cvs").send(body);
      expect(anonymous.status).toBe(401);
      expect(await CandidateCV.countDocuments()).toBe(0);
    });
  });
});
