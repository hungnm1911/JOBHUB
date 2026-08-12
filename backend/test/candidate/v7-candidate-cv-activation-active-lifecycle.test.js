import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
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
  activateOwnGeneratedCandidateCv,
  saveOwnGeneratedContent,
} from "../../src/services/candidate-cv.service.js";
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

const incompleteGeneratedContent = () => {
  return {
    personalInfo: {
      fullName: "Jane Candidate",
      email: null,
      phone: null,
    },
    professionalSummary: null,
    educations: [],
    skills: [],
    workExperiences: [],
    projects: [],
    certifications: [],
    languages: [],
  };
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Lifecycle CV",
  status = CANDIDATE_CV_STATUS.DRAFT,
  isDefault = false,
  archivedAt = null,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  skillTags = ["metadata-skill"],
  generatedContent = {},
}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility,
    categoryId,
    skillTags,
    isDefault,
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

describe("V7 Slice 05 — Generated CV activation + ACTIVE lifecycle (F04)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("explicit activation", () => {
    it("activates own complete Generated DRAFT without changing metadata or Profile", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.activate.ok@example.com",
        fullName: "Profile Name",
      });
      await User.findByIdAndUpdate(user._id, {
        phoneNumber: "+84909999999",
      });
      const category = await createFieldCategory();
      const draft = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        generatedContent: completeGeneratedContent(),
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post(`/api/candidate/cvs/${draft._id}/activate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(response.body.cv.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      );
      expect(response.body.cv.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
      expect(response.body.cv.isDefault).toBe(false);
      expect(response.body.cv.name).toBe("Lifecycle CV");
      expect(response.body.cv.skillTags).toEqual(["metadata-skill"]);
      expect(response.body.completeness.isComplete).toBe(true);

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(persisted.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
      expect(persisted.skillTags).toEqual(["metadata-skill"]);
      expect(persisted.generatedContent.personalInfo.fullName).toBe(
        "Jane Candidate",
      );

      const profile = await User.findById(user._id);
      expect(profile.fullName).toBe("Profile Name");
      expect(profile.phoneNumber).toBe("+84909999999");
    });

    it("rejects incomplete activation and keeps DRAFT", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.activate.incomplete@example.com",
      });
      const category = await createFieldCategory("Product");
      const draft = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        generatedContent: incompleteGeneratedContent(),
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post(`/api/candidate/cvs/${draft._id}/activate`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/completeness/i);

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
    });

    it("does not activate merely because content is complete without explicit activate", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.activate.no-auto@example.com",
      });
      const category = await createFieldCategory("Design");
      const draft = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const saveResponse = await agent
        .put(`/api/candidate/cvs/${draft._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(completeGeneratedContent());

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body.completeness.isComplete).toBe(true);
      expect(saveResponse.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    });
  });

  describe("ACTIVE content edit lifecycle", () => {
    it("keeps ACTIVE when saved content remains complete", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.active.keep@example.com",
      });
      const category = await createFieldCategory("Ops");
      const active = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        isDefault: true,
        generatedContent: completeGeneratedContent(),
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const nextContent = {
        ...completeGeneratedContent(),
        professionalSummary: "Updated complete summary",
        skills: ["Node.js", "MongoDB"],
      };

      const response = await agent
        .put(`/api/candidate/cvs/${active._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(nextContent);

      expect(response.status).toBe(200);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(response.body.cv.isDefault).toBe(true);
      expect(response.body.completeness.isComplete).toBe(true);
      expect(response.body.cv.generatedContent.professionalSummary).toBe(
        "Updated complete summary",
      );
      expect(response.body.cv.skillTags).toEqual(["metadata-skill"]);

      const persisted = await CandidateCV.findById(active._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(persisted.isDefault).toBe(true);
    });

    it("atomically demotes ACTIVE Default to DRAFT and clears isDefault when incomplete", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.active.demote@example.com",
        fullName: "Profile Stays",
      });
      const category = await createFieldCategory("Security");
      const active = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Default Active",
        status: CANDIDATE_CV_STATUS.ACTIVE,
        isDefault: true,
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        generatedContent: completeGeneratedContent(),
      });
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .put(`/api/candidate/cvs/${active._id}/generated-content`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(incompleteGeneratedContent());

      expect(response.status).toBe(200);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(response.body.cv.isDefault).toBe(false);
      expect(response.body.completeness.isComplete).toBe(false);
      expect(response.body.cv.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
      expect(response.body.cv.name).toBe("Default Active");

      const persisted = await CandidateCV.findById(active._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
      expect(persisted.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
      expect(persisted.generatedContent.personalInfo.fullName).toBe(
        "Jane Candidate",
      );

      const profile = await User.findById(user._id);
      expect(profile.fullName).toBe("Profile Stays");
    });
  });

  describe("concurrency and stale writes", () => {
    it("rejects activation when content becomes incomplete before the status write commits", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.activate.race@example.com",
      });
      const category = await createFieldCategory("Race");
      const draft = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        generatedContent: completeGeneratedContent(),
      });

      const originalFindOneAndUpdate = CandidateCV.findOneAndUpdate.bind(
        CandidateCV,
      );
      let releaseActivation;
      const holdActivation = new Promise((resolve) => {
        releaseActivation = resolve;
      });
      let resolveActivationReached;
      const activationReached = new Promise((resolve) => {
        resolveActivationReached = resolve;
      });

      vi.spyOn(CandidateCV, "findOneAndUpdate").mockImplementation(
        (filter, update, options) => {
          if (update?.$set?.status === CANDIDATE_CV_STATUS.ACTIVE) {
            resolveActivationReached();
            return holdActivation.then(() =>
              originalFindOneAndUpdate(filter, update, options),
            );
          }

          return originalFindOneAndUpdate(filter, update, options);
        },
      );

      const activatePromise = activateOwnGeneratedCandidateCv({
        candidateUserId: user._id,
        actorUser: user,
        candidateCvId: draft._id.toString(),
      });

      await activationReached;

      await saveOwnGeneratedContent({
        candidateUserId: user._id,
        actorUser: user,
        candidateCvId: draft._id.toString(),
        generatedContent: incompleteGeneratedContent(),
      });

      releaseActivation();

      await expect(activatePromise).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/changed before activation/i),
      });

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
      expect(persisted.generatedContent.personalInfo.email).toBeNull();
    });

    it("rejects activation when intervening content edit shares the validated updatedAt", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.activate.same-ms@example.com",
      });
      const category = await createFieldCategory("SameMs");
      const draft = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        generatedContent: completeGeneratedContent(),
      });

      const beforeRace = await CandidateCV.findById(draft._id).lean();
      const validatedUpdatedAt = beforeRace.updatedAt;
      const incompleteContent = incompleteGeneratedContent();

      const originalFindOneAndUpdate = CandidateCV.findOneAndUpdate.bind(
        CandidateCV,
      );
      let releaseActivation;
      const holdActivation = new Promise((resolve) => {
        releaseActivation = resolve;
      });
      let resolveActivationReached;
      const activationReached = new Promise((resolve) => {
        resolveActivationReached = resolve;
      });

      vi.spyOn(CandidateCV, "findOneAndUpdate").mockImplementation(
        (filter, update, options) => {
          if (update?.$set?.status === CANDIDATE_CV_STATUS.ACTIVE) {
            resolveActivationReached();
            return holdActivation.then(() =>
              originalFindOneAndUpdate(filter, update, options),
            );
          }

          return originalFindOneAndUpdate(filter, update, options);
        },
      );

      const activatePromise = activateOwnGeneratedCandidateCv({
        candidateUserId: user._id,
        actorUser: user,
        candidateCvId: draft._id.toString(),
      });

      await activationReached;

      // Finite timestamp resolution: content becomes incomplete while updatedAt
      // remains the exact value observed by activation validation.
      await CandidateCV.collection.updateOne(
        {
          _id: draft._id,
        },
        {
          $set: {
            generatedContent: incompleteContent,
            updatedAt: validatedUpdatedAt,
          },
        },
      );

      const midRace = await CandidateCV.findById(draft._id).lean();

      expect(midRace.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(midRace.generatedContent.personalInfo.email).toBeNull();
      expect(midRace.updatedAt.getTime()).toBe(validatedUpdatedAt.getTime());

      releaseActivation();

      await expect(activatePromise).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/changed before activation/i),
      });

      const persisted = await CandidateCV.findById(draft._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
      expect(persisted.generatedContent.personalInfo.email).toBeNull();
      expect(persisted.updatedAt.getTime()).toBe(validatedUpdatedAt.getTime());
    });

    it("does not leave ACTIVE content incomplete under concurrent demoting save", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.active.race@example.com",
      });
      const category = await createFieldCategory("Concurrent");
      const active = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        isDefault: true,
        generatedContent: completeGeneratedContent(),
      });

      const [first, second] = await Promise.allSettled([
        saveOwnGeneratedContent({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: active._id.toString(),
          generatedContent: {
            ...completeGeneratedContent(),
            professionalSummary: "Still complete A",
          },
        }),
        saveOwnGeneratedContent({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: active._id.toString(),
          generatedContent: incompleteGeneratedContent(),
        }),
      ]);

      const outcomes = [first, second];
      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");

      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.length + rejected.length).toBe(2);

      for (const result of rejected) {
        expect(result.reason).toMatchObject({
          statusCode: 409,
        });
      }

      const persisted = await CandidateCV.findById(active._id);
      if (persisted.status === CANDIDATE_CV_STATUS.ACTIVE) {
        expect(persisted.isDefault).toBe(true);
        expect(persisted.generatedContent.professionalSummary).toMatch(
          /Still complete/,
        );
      } else {
        expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
        expect(persisted.isDefault).toBe(false);
        expect(persisted.generatedContent.personalInfo.email).toBeNull();
      }
    });
  });

  describe("ownership source and archive guards", () => {
    it("allows activation only for own non-archived Generated DRAFT CVs", async () => {
      const { user: owner } = await createVerifiedUser({
        email: "cv.activate.owner@example.com",
      });
      const { user: peer } = await createVerifiedUser({
        email: "cv.activate.peer@example.com",
      });
      const category = await createFieldCategory("Guards");
      const ownedDraft = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        generatedContent: completeGeneratedContent(),
      });
      const peerDraft = await createGeneratedCv({
        candidateUserId: peer._id,
        categoryId: category._id,
        name: "Peer Draft",
        generatedContent: completeGeneratedContent(),
      });
      const archived = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Archived",
        archivedAt: new Date(),
        generatedContent: completeGeneratedContent(),
      });
      const uploaded = await createUploadedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
      });
      const alreadyActive = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Already Active",
        status: CANDIDATE_CV_STATUS.ACTIVE,
        generatedContent: completeGeneratedContent(),
      });

      const agent = createTestAgent();
      const ownerToken = await loginAndGetAccessToken(agent, {
        email: owner.email,
      });
      const peerToken = await loginAndGetAccessToken(agent, {
        email: peer.email,
      });

      const peerAttempt = await agent
        .post(`/api/candidate/cvs/${ownedDraft._id}/activate`)
        .set("Authorization", `Bearer ${peerToken}`);
      const archivedAttempt = await agent
        .post(`/api/candidate/cvs/${archived._id}/activate`)
        .set("Authorization", `Bearer ${ownerToken}`);
      const uploadedAttempt = await agent
        .post(`/api/candidate/cvs/${uploaded._id}/activate`)
        .set("Authorization", `Bearer ${ownerToken}`);
      const activeAttempt = await agent
        .post(`/api/candidate/cvs/${alreadyActive._id}/activate`)
        .set("Authorization", `Bearer ${ownerToken}`);
      const unknownAttempt = await agent
        .post(`/api/candidate/cvs/${new mongoose.Types.ObjectId()}/activate`)
        .set("Authorization", `Bearer ${ownerToken}`);
      const peerIsolation = await agent
        .post(`/api/candidate/cvs/${peerDraft._id}/activate`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(peerAttempt.status).toBe(404);
      expect(archivedAttempt.status).toBe(409);
      expect(uploadedAttempt.status).toBe(409);
      expect(activeAttempt.status).toBe(409);
      expect(unknownAttempt.status).toBe(404);
      expect(peerIsolation.status).toBe(404);

      await createVerifiedUser({
        email: "cv.activate.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
        fullName: "Admin",
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: "cv.activate.admin@example.com",
      });
      const adminAttempt = await agent
        .post(`/api/candidate/cvs/${ownedDraft._id}/activate`)
        .set("Authorization", `Bearer ${adminToken}`);
      const anonymousAttempt = await agent.post(
        `/api/candidate/cvs/${ownedDraft._id}/activate`,
      );

      expect(adminAttempt.status).toBe(403);
      expect(anonymousAttempt.status).toBe(401);
    });
  });
});
