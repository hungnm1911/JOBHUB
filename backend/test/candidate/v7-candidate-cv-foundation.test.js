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

const createExperienceLevel = async (
  code = EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
) => {
  return ExperienceLevel.create({
    code,
  });
};

const buildGeneratedCvFields = ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  status = CANDIDATE_CV_STATUS.DRAFT,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  experienceLevelId = null,
  preferredLocations = [],
  skillTags = [],
  employmentTypes = [],
  workModes = [],
  isDefault = false,
  archivedAt = null,
  generatedContent = {},
} = {}) => {
  return {
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility,
    categoryId,
    experienceLevelId,
    preferredLocations,
    skillTags,
    employmentTypes,
    workModes,
    isDefault,
    archivedAt,
    generatedContent,
  };
};

const buildUploadedCvFields = ({
  candidateUserId,
  categoryId,
  name = "Uploaded CV",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  experienceLevelId = null,
  preferredLocations = [],
  skillTags = [],
  employmentTypes = [],
  workModes = [],
  isDefault = false,
  archivedAt = null,
  uploadedFile = {
    storageKey: "candidate-cvs/demo.pdf",
    originalFileName: "demo.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    pageCount: 2,
    uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
} = {}) => {
  return {
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility,
    categoryId,
    experienceLevelId,
    preferredLocations,
    skillTags,
    employmentTypes,
    workModes,
    isDefault,
    archivedAt,
    uploadedFile,
  };
};

describe("V7 Slice 02 — CandidateCV foundation + My CVs read (F02)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("CandidateCV persistence foundation", () => {
    it("persists Generated and Uploaded CVs in one collection with V4 catalog representation", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.owner@example.com",
      });
      const category = await createFieldCategory();
      const experienceLevel = await createExperienceLevel();

      const generated = await CandidateCV.create(
        buildGeneratedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Harvard Draft",
          experienceLevelId: experienceLevel._id,
          preferredLocations: [LOCATION.HA_NOI, LOCATION.FOREIGN],
          skillTags: ["Node.js", "MongoDB"],
          employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
          workModes: [WORK_MODE.HYBRID, WORK_MODE.REMOTE],
          generatedContent: {
            personalInfo: {
              fullName: "Jane Candidate",
            },
            skills: ["JavaScript"],
          },
        }),
      );

      const uploaded = await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "PDF Resume",
          visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        }),
      );

      expect(generated.collection.collectionName).toBe("candidate_cvs");
      expect(uploaded.collection.collectionName).toBe("candidate_cvs");
      expect(generated.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
      expect(uploaded.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.UPLOADED);
      expect(generated.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
      expect(uploaded.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(generated.preferredLocations).toEqual([
        LOCATION.HA_NOI,
        LOCATION.FOREIGN,
      ]);
      expect(generated.employmentTypes).toEqual([EMPLOYMENT_TYPE.FULL_TIME]);
      expect(generated.workModes).toEqual([WORK_MODE.HYBRID, WORK_MODE.REMOTE]);
      expect(generated.experienceLevelId.toString()).toBe(
        experienceLevel._id.toString(),
      );
      expect(generated.archivedAt).toBeNull();
      expect(generated.toObject()).not.toHaveProperty("companyId");
      expect(generated.toObject()).not.toHaveProperty("companyMemberId");
      expect(generated.toObject()).not.toHaveProperty("jobId");
      expect(generated.toObject()).not.toHaveProperty("applicationId");
      expect(generated.toObject()).not.toHaveProperty("jobInvitationId");
      expect(mongoose.connection.collections.locations).toBeUndefined();
      expect(mongoose.connection.collections.employment_types).toBeUndefined();
      expect(mongoose.connection.collections.work_modes).toBeUndefined();
    });

    it("enforces source payload XOR, immutable sourceType, and UPLOADED≠DRAFT", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.invariants@example.com",
      });
      const category = await createFieldCategory("Data");

      await expect(
        CandidateCV.create({
          ...buildGeneratedCvFields({
            candidateUserId: user._id,
            categoryId: category._id,
          }),
          uploadedFile: {
            storageKey: "bad.pdf",
            originalFileName: "bad.pdf",
            mimeType: "application/pdf",
            sizeBytes: 10,
            pageCount: 1,
            uploadedAt: new Date(),
          },
        }),
      ).rejects.toThrow(/must not have uploadedFile/i);

      await expect(
        CandidateCV.create({
          ...buildUploadedCvFields({
            candidateUserId: user._id,
            categoryId: category._id,
          }),
          generatedContent: {
            skills: ["Nope"],
          },
        }),
      ).rejects.toThrow(/must not have generatedContent/i);

      await expect(
        CandidateCV.create({
          ...buildUploadedCvFields({
            candidateUserId: user._id,
            categoryId: category._id,
          }),
          status: CANDIDATE_CV_STATUS.DRAFT,
        }),
      ).rejects.toThrow(/must not have status DRAFT/i);

      const generated = await CandidateCV.create(
        buildGeneratedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Immutable Source",
        }),
      );

      generated.sourceType = CANDIDATE_CV_SOURCE_TYPE.UPLOADED;
      generated.markModified("sourceType");
      await generated.save();

      const reloaded = await CandidateCV.findById(generated._id);
      expect(reloaded.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
      expect(reloaded.uploadedFile).toBeUndefined();
      expect(reloaded.generatedContent).toBeTruthy();
    });

    it("rejects Default on DRAFT or archived CVs and keeps archivedAt null for active library", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.default@example.com",
      });
      const category = await createFieldCategory("Product");

      await expect(
        CandidateCV.create(
          buildGeneratedCvFields({
            candidateUserId: user._id,
            categoryId: category._id,
            status: CANDIDATE_CV_STATUS.DRAFT,
            isDefault: true,
          }),
        ),
      ).rejects.toThrow(/must not be Default/i);

      await expect(
        CandidateCV.create(
          buildUploadedCvFields({
            candidateUserId: user._id,
            categoryId: category._id,
            isDefault: true,
            archivedAt: new Date(),
          }),
        ),
      ).rejects.toThrow(/must not be Default/i);

      const active = await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Active Library CV",
        }),
      );

      expect(active.archivedAt).toBeNull();
      expect(active.isDefault).toBe(false);
    });

    it("enforces at most one active Default CandidateCV per Candidate", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.one-default@example.com",
      });
      const category = await createFieldCategory("Design");

      await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Default A",
          isDefault: true,
        }),
      );

      await expect(
        CandidateCV.create(
          buildUploadedCvFields({
            candidateUserId: user._id,
            categoryId: category._id,
            name: "Default B",
            isDefault: true,
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("My CVs owner-scoped active-library read", () => {
    it("lists only the authenticated Candidate's non-archived CVs", async () => {
      const { user: owner } = await createVerifiedUser({
        email: "cv.list.owner@example.com",
        fullName: "Owner Candidate",
      });
      const { user: other } = await createVerifiedUser({
        email: "cv.list.other@example.com",
        fullName: "Other Candidate",
      });
      const category = await createFieldCategory("Ops");

      const activeGenerated = await CandidateCV.create(
        buildGeneratedCvFields({
          candidateUserId: owner._id,
          categoryId: category._id,
          name: "Active Generated",
          status: CANDIDATE_CV_STATUS.ACTIVE,
          generatedContent: {
            personalInfo: {
              fullName: "Owner Candidate",
              email: "cv.list.owner@example.com",
              phone: "+84901111111",
            },
            professionalSummary: "Summary",
            educations: [
              {
                institutionName: "Uni",
                degree: "BSc",
              },
            ],
            skills: ["Go"],
          },
        }),
      );
      const activeUploaded = await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: owner._id,
          categoryId: category._id,
          name: "Active Uploaded",
          visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        }),
      );
      await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: owner._id,
          categoryId: category._id,
          name: "Archived Uploaded",
          archivedAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
      );
      await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: other._id,
          categoryId: category._id,
          name: "Other Candidate CV",
          visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        }),
      );

      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "cv.list.owner@example.com",
      });

      const response = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.cvs).toHaveLength(2);
      expect(response.body.cvs.map((cv) => cv.name).sort()).toEqual([
        "Active Generated",
        "Active Uploaded",
      ]);
      expect(response.body.cvs.every((cv) => cv.archivedAt === null)).toBe(
        true,
      );
      expect(
        response.body.cvs.every(
          (cv) => cv.candidateUserId === owner._id.toString(),
        ),
      ).toBe(true);
      expect(
        response.body.cvs.some((cv) => cv.id === activeGenerated._id.toString()),
      ).toBe(true);
      expect(
        response.body.cvs.some((cv) => cv.id === activeUploaded._id.toString()),
      ).toBe(true);
      expect(response.body.cvs[0]).not.toHaveProperty("generatedContent");
      expect(response.body.cvs[0]).not.toHaveProperty("uploadedFile");
    });

    it("returns owned active CV detail with source-specific payload only", async () => {
      const { user } = await createVerifiedUser({
        email: "cv.detail@example.com",
      });
      const category = await createFieldCategory("Security");

      const generated = await CandidateCV.create(
        buildGeneratedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Detail Generated",
          generatedContent: {
            personalInfo: {
              fullName: "Detail Candidate",
            },
            skills: ["Security"],
          },
        }),
      );
      const uploaded = await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Detail Uploaded",
        }),
      );
      const archived = await CandidateCV.create(
        buildGeneratedCvFields({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "Archived Detail",
          archivedAt: new Date(),
        }),
      );

      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: "cv.detail@example.com",
      });

      const generatedResponse = await agent
        .get(`/api/candidate/cvs/${generated._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(generatedResponse.status).toBe(200);
      expect(generatedResponse.body.cv.name).toBe("Detail Generated");
      expect(generatedResponse.body.cv.generatedContent.personalInfo.fullName).toBe(
        "Detail Candidate",
      );
      expect(generatedResponse.body.cv.uploadedFile).toBeNull();

      const uploadedResponse = await agent
        .get(`/api/candidate/cvs/${uploaded._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(uploadedResponse.status).toBe(200);
      expect(uploadedResponse.body.cv.uploadedFile.originalFileName).toBe(
        "demo.pdf",
      );
      expect(uploadedResponse.body.cv.generatedContent).toBeNull();

      const archivedResponse = await agent
        .get(`/api/candidate/cvs/${archived._id}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(archivedResponse.status).toBe(404);
    });

    it("denies cross-owner Candidate reads and non-Candidate actors including PUBLIC CVs", async () => {
      const { user: owner } = await createVerifiedUser({
        email: "cv.access.owner@example.com",
      });
      const { user: peer } = await createVerifiedUser({
        email: "cv.access.peer@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "cv.access.manager@example.com",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "cv.access.recruiter@example.com",
        company: manager.company,
      });
      await createVerifiedUser({
        email: "cv.access.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
        fullName: "Platform Admin",
      });
      const category = await createFieldCategory("Access");

      const publicCv = await CandidateCV.create(
        buildUploadedCvFields({
          candidateUserId: owner._id,
          categoryId: category._id,
          name: "Public CV",
          visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        }),
      );

      const agent = createTestAgent();
      const peerToken = await loginAndGetAccessToken(agent, {
        email: peer.email,
      });
      const managerToken = await loginAndGetAccessToken(agent, {
        email: manager.user.email,
      });
      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: "cv.access.admin@example.com",
      });

      const peerList = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${peerToken}`);
      expect(peerList.status).toBe(200);
      expect(peerList.body.cvs).toEqual([]);

      const peerDetail = await agent
        .get(`/api/candidate/cvs/${publicCv._id}`)
        .set("Authorization", `Bearer ${peerToken}`);
      expect(peerDetail.status).toBe(404);

      for (const token of [managerToken, recruiterToken, adminToken]) {
        const listResponse = await agent
          .get("/api/candidate/cvs")
          .set("Authorization", `Bearer ${token}`);
        const detailResponse = await agent
          .get(`/api/candidate/cvs/${publicCv._id}`)
          .set("Authorization", `Bearer ${token}`);

        expect(listResponse.status).toBe(403);
        expect(detailResponse.status).toBe(403);
      }

      const anonymousList = await agent.get("/api/candidate/cvs");
      const anonymousDetail = await agent.get(
        `/api/candidate/cvs/${publicCv._id}`,
      );

      expect(anonymousList.status).toBe(401);
      expect(anonymousDetail.status).toBe(401);
    });
  });
});
