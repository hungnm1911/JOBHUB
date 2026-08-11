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
import LOCATION from "../../src/constants/location.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import {
  archiveOwnCandidateCv,
  setOwnCandidateCvAsDefault,
} from "../../src/services/candidate-cv.service.js";
import * as fileService from "../../src/services/file.service.js";
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
    preferredLocations: [LOCATION.HA_NOI],
    skillTags: ["Node.js"],
    employmentTypes: [],
    workModes: [],
    isDefault,
    archivedAt,
    uploadedFile: {
      storageKey: `jobhub/candidate-cvs/uploaded/${name
        .replace(/\s+/g, "-")
        .toLowerCase()}`,
      originalFileName: `${name}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 4096,
      pageCount: 3,
      uploadedAt: new Date("2026-01-15T00:00:00.000Z"),
    },
  });
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  status = CANDIDATE_CV_STATUS.ACTIVE,
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
    skillTags: ["Tag"],
    employmentTypes: [],
    workModes: [],
    isDefault,
    archivedAt,
    generatedContent: {
      personalInfo: {
        fullName: "Jane Candidate",
        email: "jane@example.com",
        phone: "+84901234567",
        displayLocation: "Ha Noi",
      },
      professionalSummary: "Backend engineer",
      educations: [
        {
          institutionName: "Example University",
          degree: "BSc",
          fieldOfStudy: "CS",
        },
      ],
      skills: ["Node.js"],
      workExperiences: [],
      projects: [],
      certifications: [],
      languages: [],
      hiddenSections: [],
    },
  });
};

const snapshotPreservedFields = (cv) => {
  return {
    candidateUserId: cv.candidateUserId.toString(),
    sourceType: cv.sourceType,
    status: cv.status,
    visibility: cv.visibility,
    name: cv.name,
    categoryId: cv.categoryId.toString(),
    preferredLocations: [...(cv.preferredLocations ?? [])],
    skillTags: [...(cv.skillTags ?? [])],
    generatedContent: cv.generatedContent
      ? JSON.parse(JSON.stringify(cv.generatedContent))
      : undefined,
    uploadedFile: cv.uploadedFile
      ? JSON.parse(JSON.stringify(cv.uploadedFile))
      : undefined,
  };
};

describe("V7 Slice 11 — Archive Candidate CV (F10)", () => {
  let agent;

  beforeAll(async () => {
    await connectTestDatabase();
    agent = createTestAgent();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("owner-scoped archive", () => {
    it("archives own non-default CV without hard delete or content mutation", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.archive.basic@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Archive Basic");
      const cv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Keep File",
      });
      const before = snapshotPreservedFields(cv);
      const deleteFileSpy = vi.spyOn(fileService, "deleteFile");

      const response = await agent
        .delete(`/api/candidate/cvs/${cv._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.archivedAt).toBeTruthy();
      expect(response.body.cv.isDefault).toBe(false);
      expect(response.body.cv.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(response.body.cv.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      );

      const persisted = await CandidateCV.findById(cv._id);
      expect(persisted).not.toBeNull();
      expect(persisted.archivedAt).toBeInstanceOf(Date);
      expect(persisted.isDefault).toBe(false);
      expect(snapshotPreservedFields(persisted)).toEqual(before);
      expect(deleteFileSpy).not.toHaveBeenCalled();
    });

    it("atomically clears Default when archiving the Default CV", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.archive.default@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Archive Default");
      const defaultCv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Was Default",
        isDefault: true,
      });
      const otherCv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Still Active",
      });
      const before = snapshotPreservedFields(defaultCv);

      const response = await agent
        .delete(`/api/candidate/cvs/${defaultCv._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cv.isDefault).toBe(false);
      expect(response.body.cv.archivedAt).toBeTruthy();

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
      expect(persistedDefault.archivedAt).toBeInstanceOf(Date);
      expect(persistedOther.isDefault).toBe(false);
      expect(persistedOther.archivedAt).toBeNull();
      expect(defaults).toHaveLength(0);
      expect(snapshotPreservedFields(persistedDefault)).toEqual(before);
    });

    it("rejects foreign and already-archived targets", async () => {
      const { user: owner, password } = await createVerifiedUser({
        email: "cv.archive.owner@example.com",
      });
      const { user: peer } = await createVerifiedUser({
        email: "cv.archive.peer@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: owner.email,
        password,
      });
      const category = await createFieldCategory("Archive Guards");
      const peerCv = await createUploadedCv({
        candidateUserId: peer._id,
        categoryId: category._id,
        name: "Peer CV",
      });
      const alreadyArchived = await createUploadedCv({
        candidateUserId: owner._id,
        categoryId: category._id,
        name: "Already Archived",
        archivedAt: new Date("2026-03-01T00:00:00.000Z"),
      });

      const peerResponse = await agent
        .delete(`/api/candidate/cvs/${peerCv._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(peerResponse.status).toBe(404);

      const archivedResponse = await agent
        .delete(`/api/candidate/cvs/${alreadyArchived._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(archivedResponse.status).toBe(409);
      expect(archivedResponse.body.error.message).toMatch(/already archived/i);

      const missingResponse = await agent
        .delete(`/api/candidate/cvs/${new mongoose.Types.ObjectId()}`)
        .set("Authorization", `Bearer ${token}`);
      expect(missingResponse.status).toBe(404);

      expect((await CandidateCV.findById(peerCv._id)).archivedAt).toBeNull();
    });
  });

  describe("active-library exclusion", () => {
    it("removes archived CV from My CVs list and detail", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.archive.list@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Archive List");
      const active = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Still Listed",
      });
      const toArchive = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Will Leave",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      });

      await agent
        .delete(`/api/candidate/cvs/${toArchive._id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const listResponse = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${token}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.cvs.map((cv) => cv.id)).toEqual([
        active._id.toString(),
      ]);

      const detailResponse = await agent
        .get(`/api/candidate/cvs/${toArchive._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(detailResponse.status).toBe(404);

      const persisted = await CandidateCV.findById(toArchive._id);
      expect(persisted.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
      expect(persisted.archivedAt).toBeInstanceOf(Date);
    });
  });

  describe("post-archive active-library capability denials", () => {
    it("rejects Builder, activate, replace, metadata, preview, download, and Default", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.archive.denials@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Archive Denials");
      const generated = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Archived Generated",
        status: CANDIDATE_CV_STATUS.DRAFT,
      });
      const uploaded = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Archived Uploaded",
      });

      await archiveOwnCandidateCv({
        candidateUserId: user._id,
        actorUser: user,
        candidateCvId: generated._id.toString(),
      });
      await archiveOwnCandidateCv({
        candidateUserId: user._id,
        actorUser: user,
        candidateCvId: uploaded._id.toString(),
      });

      const auth = { Authorization: `Bearer ${token}` };

      const contentSave = await agent
        .put(`/api/candidate/cvs/${generated._id}/generated-content`)
        .set(auth)
        .send({
          personalInfo: { fullName: "X", email: "x@example.com", phone: "1" },
          professionalSummary: "y",
          educations: [],
          skills: ["z"],
          workExperiences: [],
          projects: [],
          certifications: [],
          languages: [],
          hiddenSections: [],
        });
      expect(contentSave.status).toBe(409);

      const activate = await agent
        .post(`/api/candidate/cvs/${generated._id}/activate`)
        .set(auth);
      expect(activate.status).toBe(409);

      const replace = await agent
        .put(`/api/candidate/cvs/${uploaded._id}/uploaded-file`)
        .set(auth)
        .attach("file", Buffer.from("%PDF-1.4 archived"), "replacement.pdf");
      expect([400, 409, 413]).toContain(replace.status);
      expect(replace.status).not.toBe(200);

      const metadata = await agent
        .patch(`/api/candidate/cvs/${uploaded._id}`)
        .set(auth)
        .send({ name: "Should Fail" });
      expect(metadata.status).toBe(409);

      const previewGenerated = await agent
        .get(`/api/candidate/cvs/${generated._id}/preview`)
        .set(auth);
      expect(previewGenerated.status).toBe(404);

      const downloadUploaded = await agent
        .get(`/api/candidate/cvs/${uploaded._id}/download`)
        .set(auth);
      expect(downloadUploaded.status).toBe(404);

      const setDefault = await agent
        .put(`/api/candidate/cvs/${uploaded._id}/default`)
        .set(auth);
      expect(setDefault.status).toBe(409);

      await expect(
        setOwnCandidateCvAsDefault({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: uploaded._id.toString(),
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
      });

      const [persistedGenerated, persistedUploaded] = await Promise.all([
        CandidateCV.findById(generated._id),
        CandidateCV.findById(uploaded._id),
      ]);
      expect(persistedGenerated.name).toBe("Archived Generated");
      expect(persistedGenerated.generatedContent.personalInfo.fullName).toBe(
        "Jane Candidate",
      );
      expect(persistedUploaded.name).toBe("Archived Uploaded");
      expect(persistedUploaded.uploadedFile.storageKey).toContain(
        "archived-uploaded",
      );
    });
  });

  describe("terminal archive semantics", () => {
    it("does not provide restore and keeps document + payload after archive", async () => {
      const { user, password } = await createVerifiedUser({
        email: "cv.archive.terminal@example.com",
      });
      const token = await loginAndGetAccessToken(agent, {
        email: user.email,
        password,
      });
      const category = await createFieldCategory("Archive Terminal");
      const cv = await createGeneratedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Terminal Generated",
        isDefault: true,
      });

      const archiveResponse = await agent
        .delete(`/api/candidate/cvs/${cv._id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(archiveResponse.status).toBe(200);

      const restoreAttempt = await agent
        .post(`/api/candidate/cvs/${cv._id}/restore`)
        .set("Authorization", `Bearer ${token}`);
      expect(restoreAttempt.status).toBe(404);

      const unarchiveAttempt = await agent
        .put(`/api/candidate/cvs/${cv._id}/unarchive`)
        .set("Authorization", `Bearer ${token}`);
      expect(unarchiveAttempt.status).toBe(404);

      const persisted = await CandidateCV.findById(cv._id);
      expect(persisted).not.toBeNull();
      expect(persisted.archivedAt).toBeInstanceOf(Date);
      expect(persisted.isDefault).toBe(false);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(persisted.status).not.toBe("ARCHIVED");
      expect(persisted.generatedContent.skills).toEqual(["Node.js"]);
    });

    it("allows only one concurrent archive to succeed", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.archive.concurrent@example.com",
      });
      const category = await createFieldCategory("Archive Concurrent");
      const cv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Race Archive",
        isDefault: true,
      });

      const outcomes = await Promise.allSettled([
        archiveOwnCandidateCv({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cv._id.toString(),
        }),
        archiveOwnCandidateCv({
          candidateUserId: user._id,
          actorUser: user,
          candidateCvId: cv._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        statusCode: 409,
      });

      const persisted = await CandidateCV.findById(cv._id);
      expect(persisted.archivedAt).toBeInstanceOf(Date);
      expect(persisted.isDefault).toBe(false);
    });
  });
});
