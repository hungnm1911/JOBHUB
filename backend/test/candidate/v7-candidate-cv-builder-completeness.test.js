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
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import USER_ROLE from "../../src/constants/user-role.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import User from "../../src/models/user.model.js";
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

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const createGeneratedDraft = async ({
  candidateUserId,
  categoryId,
  name = "Builder Draft",
  status = CANDIDATE_CV_STATUS.DRAFT,
  archivedAt = null,
  generatedContent = {},
  skillTags = [],
}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    skillTags,
    isDefault: false,
    archivedAt,
    generatedContent,
  });
};

const createUploadedCv = async ({ candidateUserId, categoryId }) => {
  return CandidateCV.create({
    candidateUserId,
    name: "Uploaded CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    isDefault: false,
    archivedAt: null,
    uploadedFile: {
      storageKey: "candidate-cvs/demo.pdf",
      originalFileName: "demo.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      pageCount: 1,
      uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
};

const completeGeneratedContent = () => {
  return {
    personalInfo: {
      fullName: "Jane Candidate",
      email: "jane@example.com",
      phone: "+84901234567",
      displayLocation: "Ha Noi",
      links: ["https://example.com"],
      avatarUrl: "https://cdn.example.com/avatar.png",
    },
    professionalSummary: "Backend engineer summary",
    educations: [
      {
        institutionName: "Example University",
        degree: "BSc",
        fieldOfStudy: "CS",
      },
      {
        institutionName: "Incomplete School",
      },
    ],
    skills: ["Node.js"],
    workExperiences: [
      {
        companyName: "Partial Co",
      },
    ],
    projects: [
      {
        name: "Partial Project",
      },
    ],
    certifications: [
      {
        name: "AWS Certified",
        issuer: "Amazon",
      },
    ],
    languages: [
      {
        name: "English",
        proficiency: CV_LANGUAGE_PROFICIENCY.FLUENT,
      },
    ],
    hiddenSections: ["projects"],
  };
};

describe("V7 Slice 04 — Generated CV Builder save + completeness (F04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("partial DRAFT save", () => {
    it("persists incomplete Harvard content without requiring completeness or activation", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.builder.partial@example.com",
        fullName: "Profile Name",
      });
      await User.findByIdAndUpdate(user._id, {
        phoneNumber: "+84909999999",
      });
      const category = await createFieldCategory();
      const draft = await createGeneratedDraft({
        candidateUserId: user._id,
        categoryId: category._id,
        skillTags: ["metadata-skill"],
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .put(`/api/candidate/cvs/${draft._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          personalInfo: {
            fullName: "Builder Name",
            email: null,
            phone: null,
          },
          professionalSummary: null,
          educations: [
            {
              institutionName: "Only Institution",
            },
          ],
          skills: [],
          workExperiences: [
            {
              companyName: "WIP Company",
            },
          ],
          projects: [],
          certifications: [],
          languages: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(response.body.cv.isDefault).toBe(false);
      expect(response.body.completeness.isComplete).toBe(false);
      expect(response.body.cv.generatedContent.personalInfo.fullName).toBe(
        "Builder Name",
      );
      expect(response.body.cv.generatedContent.educations).toHaveLength(1);
      expect(response.body.cv.generatedContent.workExperiences[0].companyName).toBe(
        "WIP Company",
      );
      expect(response.body.cv.skillTags).toEqual(["metadata-skill"]);
      expect(response.body.cv.name).toBe("Builder Draft");

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.skillTags).toEqual(["metadata-skill"]);
      expect(persisted.generatedContent.personalInfo.fullName).toBe(
        "Builder Name",
      );

      const profile = await User.findById(user._id);
      expect(profile.fullName).toBe("Profile Name");
      expect(profile.phoneNumber).toBe("+84909999999");
    });

    it("reports completeness true for exact Product requirements while keeping DRAFT", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.builder.complete@example.com",
      });
      const category = await createFieldCategory("Product");
      const draft = await createGeneratedDraft({
        candidateUserId: user._id,
        categoryId: category._id,
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .put(`/api/candidate/cvs/${draft._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(completeGeneratedContent());

      expect(response.status).toBe(200);
      expect(response.body.completeness.isComplete).toBe(true);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(response.body.cv.generatedContent.skills).toEqual(["Node.js"]);
      expect(response.body.cv.generatedContent.educations).toHaveLength(2);
      expect(response.body.cv.generatedContent.personalInfo.links).toEqual([
        "https://example.com",
      ]);
      expect(response.body.cv.generatedContent.personalInfo.avatarUrl).toContain(
        "avatar.png",
      );

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
    });

    it("treats incomplete Certification/Language records as not activation-ready without rejecting DRAFT save", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.builder.records@example.com",
      });
      const category = await createFieldCategory("Security");
      const draft = await createGeneratedDraft({
        candidateUserId: user._id,
        categoryId: category._id,
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const incompleteRecords = await agent
        .put(`/api/candidate/cvs/${draft._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          ...completeGeneratedContent(),
          certifications: [
            {
              issuer: "Missing Name Cert",
            },
          ],
          languages: [
            {
              name: "Japanese",
            },
          ],
        });

      expect(incompleteRecords.status).toBe(200);
      expect(incompleteRecords.body.completeness.isComplete).toBe(false);
      expect(incompleteRecords.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);

      const invalidProficiency = await agent
        .put(`/api/candidate/cvs/${draft._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          languages: [
            {
              name: "French",
              proficiency: "EXPERT",
            },
          ],
        });

      expect(invalidProficiency.status).toBe(400);
    });

    it("rejects non-canonical skill split structures", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.builder.skills@example.com",
      });
      const category = await createFieldCategory("Design");
      const draft = await createGeneratedDraft({
        candidateUserId: user._id,
        categoryId: category._id,
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .put(`/api/candidate/cvs/${draft._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          technicalSkills: ["React"],
          tools: ["Figma"],
          softSkills: ["Communication"],
        });

      expect(response.status).toBe(400);
      expect(await CandidateCV.findById(draft._id)).toMatchObject({
        status: CANDIDATE_CV_STATUS.DRAFT,
      });
    });
  });

  describe("ownership source and archive guards", () => {
    it("allows only own non-archived Generated DRAFT CVs", async () => {
      const { user: owner } = await createVerifiedUser({
        email: "cv.builder.owner@example.com",
      });
      const { user: peer } = await createVerifiedUser({
        email: "cv.builder.peer@example.com",
      });
      const category = await createFieldCategory("Ops");
      const ownedDraft = await createGeneratedDraft({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Owned Draft",
      });
      const peerDraft = await createGeneratedDraft({
        candidateUserId: peer._id,
        categoryId: category._id,
        name: "Peer Draft",
      });
      const archived = await createGeneratedDraft({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Archived Draft",
        archivedAt: new Date(),
      });
      const uploaded = await createUploadedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
      });

      const agent = createTestAgent();
      const ownerToken = await loginAndGetAccessToken(agent, {
        email: owner.email,
      });
      const peerToken = await loginAndGetAccessToken(agent, {
        email: peer.email,
      });
      const body = {
        personalInfo: {
          fullName: "Updated",
        },
      };

      const peerAttempt = await agent
        .put(`/api/candidate/cvs/${ownedDraft._id}/generated-content`)
        .set("Authorization", `Bearer ${peerToken}`)
        .send(body);
      const archivedAttempt = await agent
        .put(`/api/candidate/cvs/${archived._id}/generated-content`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);
      const uploadedAttempt = await agent
        .put(`/api/candidate/cvs/${uploaded._id}/generated-content`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);
      const unknownAttempt = await agent
        .put(
          `/api/candidate/cvs/${new mongoose.Types.ObjectId()}/generated-content`,
        )
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);
      const peerOwnReadIsolation = await agent
        .put(`/api/candidate/cvs/${peerDraft._id}/generated-content`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);

      expect(peerAttempt.status).toBe(404);
      expect(archivedAttempt.status).toBe(409);
      expect(uploadedAttempt.status).toBe(409);
      expect(unknownAttempt.status).toBe(404);
      expect(peerOwnReadIsolation.status).toBe(404);

      await createVerifiedUser({
        email: "cv.builder.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
        fullName: "Admin",
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: "cv.builder.admin@example.com",
      });
      const adminAttempt = await agent
        .put(`/api/candidate/cvs/${ownedDraft._id}/generated-content`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(body);
      const anonymousAttempt = await agent
        .put(`/api/candidate/cvs/${ownedDraft._id}/generated-content`)
        .send(body);

      expect(adminAttempt.status).toBe(403);
      expect(anonymousAttempt.status).toBe(401);
    });
  });
});
