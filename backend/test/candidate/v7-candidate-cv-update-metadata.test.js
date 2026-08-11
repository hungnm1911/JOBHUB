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
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
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

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  status = CANDIDATE_CV_STATUS.DRAFT,
  isDefault = false,
  archivedAt = null,
  skillTags = ["Tag A"],
  generatedSkills = ["Harvard Skill"],
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [LOCATION.HA_NOI],
    skillTags,
    employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
    workModes: [WORK_MODE.ONSITE],
    isDefault,
    archivedAt,
    generatedContent: {
      personalInfo: {
        fullName: "Jane Candidate",
        email: "jane@example.com",
        phone: "0123456789",
        displayLocation: "Ha Noi",
      },
      professionalSummary: "Summary",
      educations: [
        {
          institutionName: "Uni",
          degree: "BSc",
        },
      ],
      skills: generatedSkills,
      certifications: [],
      languages: [],
    },
  });
};

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  name = "Uploaded CV",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  isDefault = true,
  archivedAt = null,
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [LOCATION.HO_CHI_MINH],
    skillTags: ["PDF Tag"],
    employmentTypes: [EMPLOYMENT_TYPE.CONTRACT],
    workModes: [WORK_MODE.HYBRID],
    isDefault,
    archivedAt,
    uploadedFile: {
      storageKey: "jobhub/candidate-cvs/uploaded/current",
      originalFileName: "current.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 2048,
      pageCount: 2,
      uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
};

describe("V7 Slice 08 — Rename + metadata + visibility (F07)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("updates common metadata for Generated and Uploaded CVs without changing content or lifecycle", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.meta.owner@example.com",
    });
    const field = await createFieldCategory();
    const position = await createPositionCategory({
      parentCategoryId: field._id,
    });
    const experienceLevel = await createExperienceLevel(
      EXPERIENCE_LEVEL.THREE_TO_FIVE_YEARS,
    );
    const generated = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: field._id,
      status: CANDIDATE_CV_STATUS.DRAFT,
    });
    const uploaded = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: field._id,
    });
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const generatedResponse = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Renamed Generated",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        categoryId: position._id.toString(),
        experienceLevelId: experienceLevel._id.toString(),
        preferredLocations: [LOCATION.DA_NANG, LOCATION.FOREIGN],
        skillTags: ["Metadata Skill"],
        employmentTypes: [EMPLOYMENT_TYPE.PART_TIME],
        workModes: [WORK_MODE.REMOTE, WORK_MODE.HYBRID],
      });

    expect(generatedResponse.status).toBe(200);
    expect(generatedResponse.body.cv).toMatchObject({
      id: generated._id.toString(),
      name: "Renamed Generated",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      status: CANDIDATE_CV_STATUS.DRAFT,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      categoryId: position._id.toString(),
      experienceLevelId: experienceLevel._id.toString(),
      preferredLocations: [LOCATION.DA_NANG, LOCATION.FOREIGN],
      skillTags: ["Metadata Skill"],
      employmentTypes: [EMPLOYMENT_TYPE.PART_TIME],
      workModes: [WORK_MODE.REMOTE, WORK_MODE.HYBRID],
      isDefault: false,
      archivedAt: null,
      generatedContent: {
        skills: ["Harvard Skill"],
        personalInfo: {
          displayLocation: "Ha Noi",
        },
      },
      uploadedFile: null,
    });

    const uploadedResponse = await agent
      .patch(`/api/candidate/cvs/${uploaded._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Renamed Uploaded",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        categoryId: position._id.toString(),
        skillTags: ["Uploaded Metadata"],
        workModes: [WORK_MODE.REMOTE],
      });

    expect(uploadedResponse.status).toBe(200);
    expect(uploadedResponse.body.cv).toMatchObject({
      id: uploaded._id.toString(),
      name: "Renamed Uploaded",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      categoryId: position._id.toString(),
      skillTags: ["Uploaded Metadata"],
      workModes: [WORK_MODE.REMOTE],
      isDefault: true,
      archivedAt: null,
      generatedContent: null,
      uploadedFile: {
        originalFileName: "current.pdf",
        pageCount: 2,
      },
    });
    expect(uploadedResponse.body.cv.uploadedFile).not.toHaveProperty(
      "storageKey",
    );

    const persistedGenerated = await CandidateCV.findById(generated._id);
    expect(persistedGenerated.generatedContent.skills).toEqual([
      "Harvard Skill",
    ]);
    expect(persistedGenerated.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(persistedGenerated.toObject()).not.toHaveProperty("isSearchable");
    expect(persistedGenerated.toObject()).not.toHaveProperty(
      "effectiveVisibility",
    );
    expect(persistedGenerated.toObject()).not.toHaveProperty(
      "isPubliclyAccessible",
    );

    const persistedUploaded = await CandidateCV.findById(uploaded._id);
    expect(persistedUploaded.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/current",
    );
    expect(persistedUploaded.isDefault).toBe(true);
  });

  it("rename-only patches change name without touching other metadata or content", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.meta.rename@example.com",
    });
    const category = await createFieldCategory("Rename Field");
    const generated = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Before Rename",
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      skillTags: ["Keep Tag"],
    });
    const before = generated.toObject();
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "After Rename",
      });

    expect(response.status).toBe(200);
    expect(response.body.cv.name).toBe("After Rename");
    expect(response.body.cv.visibility).toBe(before.visibility);
    expect(response.body.cv.categoryId).toBe(category._id.toString());
    expect(response.body.cv.skillTags).toEqual(["Keep Tag"]);
    expect(response.body.cv.generatedContent.skills).toEqual(["Harvard Skill"]);
    expect(response.body.cv.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
    expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
  });

  it("rejects invalid V4 catalog values including REMOTE as Preferred Location", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.meta.invalid@example.com",
    });
    const category = await createFieldCategory("Invalid");
    const generated = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
    });
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const remoteLocation = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        preferredLocations: ["REMOTE"],
      });
    const unknownCategory = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      });
    const unknownExperience = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        experienceLevelId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      });
    const forbiddenLifecycle = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Nope",
        status: CANDIDATE_CV_STATUS.ACTIVE,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        isDefault: true,
      });
    const emptyPatch = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(remoteLocation.status).toBe(400);
    expect(unknownCategory.status).toBe(400);
    expect(unknownExperience.status).toBe(400);
    expect(forbiddenLifecycle.status).toBe(400);
    expect(emptyPatch.status).toBe(400);

    const remoteWorkMode = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        workModes: [WORK_MODE.REMOTE],
      });
    expect(remoteWorkMode.status).toBe(200);
    expect(remoteWorkMode.body.cv.workModes).toEqual([WORK_MODE.REMOTE]);

    const persisted = await CandidateCV.findById(generated._id);
    expect(persisted.preferredLocations).toEqual([LOCATION.HA_NOI]);
    expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(persisted.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
    expect(persisted.isDefault).toBe(false);
  });

  it("keeps skillTags independent from Generated skills and does not auto-activate", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.meta.skills@example.com",
    });
    const category = await createFieldCategory("Skills");
    const generated = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      status: CANDIDATE_CV_STATUS.DRAFT,
      skillTags: ["Old Tag"],
      generatedSkills: ["React", "Node"],
    });
    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        skillTags: ["Metadata Only"],
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      });

    expect(response.status).toBe(200);
    expect(response.body.cv.skillTags).toEqual(["Metadata Only"]);
    expect(response.body.cv.generatedContent.skills).toEqual([
      "React",
      "Node",
    ]);
    expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(response.body.cv.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);

    const persisted = await CandidateCV.findById(generated._id);
    expect(persisted.skillTags).toEqual(["Metadata Only"]);
    expect(persisted.generatedContent.skills).toEqual(["React", "Node"]);
    expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
  });

  it("rejects archived CVs and cross-owner metadata updates", async () => {
    const { user: owner } = await createVerifiedUser({
      email: "cv.meta.archive.owner@example.com",
    });
    const { user: peer } = await createVerifiedUser({
      email: "cv.meta.archive.peer@example.com",
    });
    const category = await createFieldCategory("Archive");
    const active = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Active Uploaded",
    });
    const archived = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Archived Uploaded",
      archivedAt: new Date("2026-03-01T00:00:00.000Z"),
      isDefault: false,
    });
    const agent = createTestAgent();
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });
    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.email,
    });

    const archivedAttempt = await agent
      .patch(`/api/candidate/cvs/${archived._id.toString()}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Should Fail",
      });
    const peerAttempt = await agent
      .patch(`/api/candidate/cvs/${active._id.toString()}`)
      .set("Authorization", `Bearer ${peerToken}`)
      .send({
        name: "Peer Hijack",
      });

    expect(archivedAttempt.status).toBe(409);
    expect(peerAttempt.status).toBe(404);

    const persistedActive = await CandidateCV.findById(active._id);
    expect(persistedActive.name).toBe("Active Uploaded");
  });

  it("PUBLIC visibility remains intent-only and does not grant non-owner access", async () => {
    const { user: owner } = await createVerifiedUser({
      email: "cv.meta.public.owner@example.com",
    });
    const { user: peer } = await createVerifiedUser({
      email: "cv.meta.public.peer@example.com",
    });
    await createVerifiedUser({
      email: "cv.meta.public.admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
      fullName: "Admin",
    });
    await createActiveCompanyManagerContext({
      email: "cv.meta.public.manager@example.com",
    });
    await createActiveRecruiterContext({
      email: "cv.meta.public.recruiter@example.com",
    });
    const category = await createFieldCategory("Public Intent");
    const generated = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    });
    const agent = createTestAgent();
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });

    const updateResponse = await agent
      .patch(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.cv.visibility).toBe(
      CANDIDATE_CV_VISIBILITY.PUBLIC,
    );

    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.email,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "cv.meta.public.admin@example.com",
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: "cv.meta.public.manager@example.com",
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: "cv.meta.public.recruiter@example.com",
    });

    const peerDetail = await agent
      .get(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${peerToken}`);
    const adminDetail = await agent
      .get(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const managerDetail = await agent
      .get(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${managerToken}`);
    const recruiterDetail = await agent
      .get(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${recruiterToken}`);
    const anonymousDetail = await agent.get(
      `/api/candidate/cvs/${generated._id.toString()}`,
    );

    expect(peerDetail.status).toBe(404);
    expect(adminDetail.status).toBe(403);
    expect(managerDetail.status).toBe(403);
    expect(recruiterDetail.status).toBe(403);
    expect(anonymousDetail.status).toBe(401);

    const ownerDetail = await agent
      .get(`/api/candidate/cvs/${generated._id.toString()}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(ownerDetail.status).toBe(200);
    expect(ownerDetail.body.cv.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
  });
});
