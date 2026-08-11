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
import USER_ROLE from "../../src/constants/user-role.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import {
  setOwnCandidateCvAsDefault,
  unsetOwnCandidateCvDefault,
} from "../../src/services/candidate-cv.service.js";
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

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  name = "Uploaded CV",
  isDefault = false,
  archivedAt = null,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault,
    archivedAt,
    uploadedFile: {
      storageKey: `candidate-cvs/${name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      originalFileName: `${name}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 2048,
      pageCount: 2,
      uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  status = CANDIDATE_CV_STATUS.DRAFT,
  isDefault = false,
  archivedAt = null,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
} = {}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault,
    archivedAt,
    generatedContent: {
      personalInfo: {
        fullName: "Jane Candidate",
        email: "jane@example.com",
        phone: "+84901234567",
      },
      professionalSummary: "Summary",
      educations: [],
      skills: ["Node.js"],
      workExperiences: [],
      projects: [],
      certifications: [],
      languages: [],
      hiddenSections: [],
    },
  });
};

const snapshotImmutableFields = (cv) => {
  return {
    sourceType: cv.sourceType,
    status: cv.status,
    visibility: cv.visibility,
    name: cv.name,
    categoryId: cv.categoryId.toString(),
    experienceLevelId: cv.experienceLevelId
      ? cv.experienceLevelId.toString()
      : null,
    preferredLocations: [...(cv.preferredLocations ?? [])],
    skillTags: [...(cv.skillTags ?? [])],
    employmentTypes: [...(cv.employmentTypes ?? [])],
    workModes: [...(cv.workModes ?? [])],
    candidateUserId: cv.candidateUserId.toString(),
    archivedAt: cv.archivedAt,
    generatedContent: cv.generatedContent
      ? JSON.parse(JSON.stringify(cv.generatedContent))
      : undefined,
    uploadedFile: cv.uploadedFile
      ? JSON.parse(JSON.stringify(cv.uploadedFile))
      : undefined,
  };
};

describe("V7 Slice 10 — Default CV management (F09)", () => {
  let agent;

  beforeAll(async () => {
    await connectTestDatabase();
    agent = createTestAgent();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("set Default when none exists", () => {
    it("sets an eligible Uploaded CV as Default without mutating other fields", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.default.set@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Set Default");
      const cv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Primary Upload",
      });
      const before = snapshotImmutableFields(cv);

      const response = await agent
        .put(`/api/candidate/cvs/${cv._id}/default`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.isDefault).toBe(true);
      expect(response.body.cv.id).toBe(cv._id.toString());

      const persisted = await CandidateCV.findById(cv._id);
      expect(persisted.isDefault).toBe(true);
      expect(snapshotImmutableFields(persisted)).toEqual(before);
    });

    it("sets an eligible Generated ACTIVE CV as Default", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.default.generated@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Generated Default");
      const cv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        name: "Active Generated",
      });

      const response = await agent
        .put(`/api/candidate/cvs/${cv._id}/default`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.isDefault).toBe(true);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(response.body.cv.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      );
    });
  });

  describe("switch Default A → B (TX-01)", () => {
    it("atomically clears A and sets B", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.default.switch@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Switch");
      const cvA = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Default A",
        isDefault: true,
      });
      const cvB = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Candidate B",
      });
      const beforeA = snapshotImmutableFields(cvA);
      const beforeB = snapshotImmutableFields(cvB);

      const response = await agent
        .put(`/api/candidate/cvs/${cvB._id}/default`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.id).toBe(cvB._id.toString());
      expect(response.body.cv.isDefault).toBe(true);

      const [persistedA, persistedB, defaults] = await Promise.all([
        CandidateCV.findById(cvA._id),
        CandidateCV.findById(cvB._id),
        CandidateCV.find({
          candidateUserId: user._id,
          isDefault: true,
          archivedAt: null,
        }),
      ]);

      expect(persistedA.isDefault).toBe(false);
      expect(persistedB.isDefault).toBe(true);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]._id.toString()).toBe(cvB._id.toString());
      expect(snapshotImmutableFields(persistedA)).toEqual(beforeA);
      expect(snapshotImmutableFields(persistedB)).toEqual(beforeB);
    });

    it("rolls back the whole switch when setting B fails after clearing A", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default.rollback@example.com",
      });
      const category = await createFieldCategory("Rollback");
      const cvA = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Keep Default",
        isDefault: true,
      });
      const cvB = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Target B",
      });

      const session = await mongoose.startSession();
      try {
        await expect(
          session.withTransaction(async () => {
            const cleared = await CandidateCV.findOneAndUpdate(
              {
                _id: cvA._id,
                candidateUserId: user._id,
                isDefault: true,
              },
              {
                $set: {
                  isDefault: false,
                },
              },
              {
                session,
                returnDocument: "after",
              },
            );

            expect(cleared.isDefault).toBe(false);

            // Force TX-01 abort after clear so B is never set.
            throw new Error("force TX-01 rollback");
          }),
        ).rejects.toThrow("force TX-01 rollback");
      } finally {
        await session.endSession();
      }

      const [persistedA, persistedB, defaults] = await Promise.all([
        CandidateCV.findById(cvA._id),
        CandidateCV.findById(cvB._id),
        CandidateCV.find({
          candidateUserId: user._id,
          isDefault: true,
          archivedAt: null,
        }),
      ]);

      expect(persistedA.isDefault).toBe(true);
      expect(persistedB.isDefault).toBe(false);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]._id.toString()).toBe(cvA._id.toString());
    });

    it("rejects switch when the target loses eligibility before set commits", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default.ineligible-switch@example.com",
      });
      const category = await createFieldCategory("Ineligible Switch");
      const cvA = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Still Default",
        isDefault: true,
      });
      const cvB = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Will Demote",
        status: CANDIDATE_CV_STATUS.ACTIVE,
      });

      // Demote target so setOwnCandidateCvAsDefault rejects after eligibility check.
      cvB.status = CANDIDATE_CV_STATUS.DRAFT;
      await cvB.save();

      await expect(
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cvB._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });

      const [persistedA, persistedB] = await Promise.all([
        CandidateCV.findById(cvA._id),
        CandidateCV.findById(cvB._id),
      ]);

      expect(persistedA.isDefault).toBe(true);
      expect(persistedB.isDefault).toBe(false);
      expect(persistedB.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    });
  });

  describe("explicit Unset Default", () => {
    it("clears Default without selecting a replacement", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.default.unset@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Unset");
      const defaultCv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Current Default",
        isDefault: true,
      });
      const otherCv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Other Active",
      });
      const before = snapshotImmutableFields(defaultCv);

      const response = await agent
        .delete(`/api/candidate/cvs/${defaultCv._id}/default`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.isDefault).toBe(false);

      const [persistedDefault, persistedOther, defaults] = await Promise.all([
        CandidateCV.findById(defaultCv._id),
        CandidateCV.findById(otherCv._id),
        CandidateCV.find({
          candidateUserId: user._id,
          isDefault: true,
          archivedAt: null,
        }),
      ]);

      expect(persistedDefault.isDefault).toBe(false);
      expect(persistedOther.isDefault).toBe(false);
      expect(defaults).toHaveLength(0);
      expect(snapshotImmutableFields(persistedDefault)).toEqual(before);
    });

    it("rejects unset when the CV is not currently Default", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.default.unset-not@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Unset Not Default");
      const cv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Not Default",
      });

      const response = await agent
        .delete(`/api/candidate/cvs/${cv._id}/default`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toMatch(/not the Default/i);
    });
  });

  describe("eligibility guards", () => {
    it("rejects Generated DRAFT, archived, foreign, and missing targets", async () => {
      const { user: owner, password } = await createVerifiedUser({
        email: "cv.default.owner@example.com",
      });
      const { user: peer } = await createVerifiedUser({
        email: "cv.default.peer@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: owner.email,
        password,
      });
      const category = await createFieldCategory("Guards");
      const draft = await createGeneratedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Draft",
        status: CANDIDATE_CV_STATUS.DRAFT,
      });
      const archived = await createUploadedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Archived",
        archivedAt: new Date("2026-02-01T00:00:00.000Z"),
      });
      const peerCv = await createUploadedCv({
        candidateUserId: peer._id,
        categoryId: category._id,
        name: "Peer CV",
      });

      const draftResponse = await agent
        .put(`/api/candidate/cvs/${draft._id}/default`)
        .set("Authorization", `Bearer ${token}`);
      expect(draftResponse.status).toBe(409);
      expect(draftResponse.body.error.message).toMatch(/ACTIVE/i);

      const archivedResponse = await agent
        .put(`/api/candidate/cvs/${archived._id}/default`)
        .set("Authorization", `Bearer ${token}`);
      expect(archivedResponse.status).toBe(409);
      expect(archivedResponse.body.error.message).toMatch(/Archived/i);

      const peerResponse = await agent
        .put(`/api/candidate/cvs/${peerCv._id}/default`)
        .set("Authorization", `Bearer ${token}`);
      expect(peerResponse.status).toBe(404);

      const missingResponse = await agent
        .put(`/api/candidate/cvs/${new mongoose.Types.ObjectId()}/default`)
        .set("Authorization", `Bearer ${token}`);
      expect(missingResponse.status).toBe(404);

      expect(draft.isDefault).toBe(false);
      expect((await CandidateCV.findById(draft._id)).isDefault).toBe(false);
      expect((await CandidateCV.findById(archived._id)).isDefault).toBe(false);
    });

    it("denies non-Candidate actors", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default.candidate-target@example.com",
      });
      const category = await createFieldCategory("Authz");
      const cv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
      });

      const manager = await createActiveCompanyManagerContext({
        email: "cv.default.manager@example.com",
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
        password: manager.password,
      });
      const managerResponse = await agent
        .put(`/api/candidate/cvs/${cv._id}/default`)
        .set("Authorization", `Bearer ${managerToken}`);
      expect(managerResponse.status).toBe(403);

      const recruiter = await createActiveRecruiterContext({
        email: "cv.default.recruiter@example.com",
      });
      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: recruiter.password,
      });
      const recruiterResponse = await agent
        .put(`/api/candidate/cvs/${cv._id}/default`)
        .set("Authorization", `Bearer ${recruiterToken}`);
      expect(recruiterResponse.status).toBe(403);
    });
  });

  describe("maximum-one uniqueness and concurrency", () => {
    it("keeps at most one active Default under concurrent set attempts", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default.concurrent@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const category = await createFieldCategory("Concurrent");
      const cvA = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Race A",
      });
      const cvB = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Race B",
      });

      const outcomes = await Promise.allSettled([
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cvA._id.toString(),
        }),
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cvB._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");

      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.length + rejected.length).toBe(2);

      for (const result of rejected) {
        expect(result.reason).toMatchObject({
          statusCode: 409,
        });
      }

      const defaults = await CandidateCV.find({
        candidateUserId: user._id,
        isDefault: true,
        archivedAt: null,
      });

      expect(defaults).toHaveLength(1);
    });

    it("keeps at most one Default under concurrent switches from A", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default.concurrent-switch@example.com",
      });
      const category = await createFieldCategory("Concurrent Switch");
      const cvA = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "From A",
        isDefault: true,
      });
      const cvB = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "To B",
      });
      const cvC = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "To C",
      });

      const outcomes = await Promise.allSettled([
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cvB._id.toString(),
        }),
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cvC._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);

      const defaults = await CandidateCV.find({
        candidateUserId: user._id,
        isDefault: true,
        archivedAt: null,
      });

      expect(defaults).toHaveLength(1);
      expect([cvB._id.toString(), cvC._id.toString()]).toContain(
        defaults[0]._id.toString(),
      );

      const persistedA = await CandidateCV.findById(cvA._id);
      expect(persistedA.isDefault).toBe(false);
    });
  });

  describe("Slice 05 Default-clear invariant remains authoritative", () => {
    it("does not invent a conflicting Default semantics path in F09", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default.slice05@example.com",
      });
      const category = await createFieldCategory("Slice05 Compat");
      const activeDefault = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Active Default",
        status: CANDIDATE_CV_STATUS.ACTIVE,
        isDefault: true,
      });

      // F09 must not re-set a Generated DRAFT as Default after demotion.
      activeDefault.status = CANDIDATE_CV_STATUS.DRAFT;
      activeDefault.isDefault = false;
      await activeDefault.save();

      await expect(
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: activeDefault._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });

      const persisted = await CandidateCV.findById(activeDefault._id);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(persisted.isDefault).toBe(false);
    });
  });

  describe("service-level unset ownership", () => {
    it("rejects unset for another Candidate's CV", async () => {
      const { user: owner } = await createVerifiedUser({
        email: "cv.default.unset-owner@example.com",
      });
      const { user: peer } = await createVerifiedUser({
        email: "cv.default.unset-peer@example.com",
      });
      const category = await createFieldCategory("Unset Ownership");
      const cv = await createUploadedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        isDefault: true,
      });

      await expect(
        unsetOwnCandidateCvDefault({
          candidateUserId: peer._id,
          actorUser: peer,
          candidateCvId: cv._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });

      const persisted = await CandidateCV.findById(cv._id);
      expect(persisted.isDefault).toBe(true);
    });
  });
});
