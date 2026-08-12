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
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const expectWriteRejectedByPersistence = async (write) => {
  await expect(write()).rejects.toBeTruthy();
};

const createFieldCategory = async (name = "Query Update Field") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const createGeneratedDraft = async ({ candidateUserId, categoryId, name }) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.DRAFT,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    isDefault: false,
    archivedAt: null,
    generatedContent: {},
  });
};

const createGeneratedActive = async ({
  candidateUserId,
  categoryId,
  name,
  isDefault = false,
}) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    isDefault,
    archivedAt: null,
    generatedContent: {
      personalInfo: {
        fullName: "Jane Candidate",
        email: "jane@example.com",
        phone: "+84901234567",
      },
      professionalSummary: "Summary",
      educations: [
        {
          institutionName: "Example University",
          degree: "BSc",
        },
      ],
      skills: ["Node.js"],
    },
  });
};

const createUploadedActive = async ({ candidateUserId, categoryId, name }) => {
  return CandidateCV.create({
    candidateUserId,
    name,
    sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    status: CANDIDATE_CV_STATUS.ACTIVE,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    isDefault: false,
    archivedAt: null,
    uploadedFile: {
      storageKey: "candidate-cvs/query-update.pdf",
      originalFileName: "query-update.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      pageCount: 1,
      uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
};

describe("V7 CandidateCV schema — local invariants on query updates", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects findOneAndUpdate that persists UPLOADED + DRAFT even with runValidators", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.query.uploaded-draft@example.com",
    });
    const category = await createFieldCategory("Uploaded Draft");
    const uploaded = await createUploadedActive({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Uploaded Active",
    });

    await expectWriteRejectedByPersistence(() =>
      CandidateCV.findOneAndUpdate(
        { _id: uploaded._id },
        {
          $set: {
            status: CANDIDATE_CV_STATUS.DRAFT,
            isDefault: true,
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persisted = await CandidateCV.findById(uploaded._id).lean();
    expect(persisted.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.UPLOADED);
    expect(persisted.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
    expect(persisted.isDefault).toBe(false);
  });

  it("rejects findOneAndUpdate that breaks GENERATED/UPLOADED payload XOR", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.query.payload-xor@example.com",
    });
    const category = await createFieldCategory("Payload XOR");
    const generated = await createGeneratedDraft({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Generated XOR",
    });
    const uploaded = await createUploadedActive({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Uploaded XOR",
    });

    await expectWriteRejectedByPersistence(() =>
      CandidateCV.findOneAndUpdate(
        { _id: generated._id },
        {
          $set: {
            uploadedFile: {
              storageKey: "candidate-cvs/illegal.pdf",
              originalFileName: "illegal.pdf",
              mimeType: "application/pdf",
              sizeBytes: 10,
              pageCount: 1,
              uploadedAt: new Date(),
            },
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    await expectWriteRejectedByPersistence(() =>
      CandidateCV.findOneAndUpdate(
        { _id: uploaded._id },
        {
          $set: {
            generatedContent: {
              skills: ["Nope"],
            },
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persistedGenerated = await CandidateCV.findById(generated._id).lean();
    const persistedUploaded = await CandidateCV.findById(uploaded._id).lean();

    expect(persistedGenerated.uploadedFile).toBeUndefined();
    expect(persistedGenerated.generatedContent).toBeTruthy();
    expect(persistedUploaded.generatedContent).toBeUndefined();
    expect(persistedUploaded.uploadedFile).toBeTruthy();
  });

  it("rejects findOneAndUpdate that sets DRAFT + isDefault=true", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.query.draft-default@example.com",
    });
    const category = await createFieldCategory("Draft Default");
    const draft = await createGeneratedDraft({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Draft Default",
    });

    await expectWriteRejectedByPersistence(() =>
      CandidateCV.findOneAndUpdate(
        { _id: draft._id },
        {
          $set: {
            isDefault: true,
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persisted = await CandidateCV.findById(draft._id).lean();
    expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(persisted.isDefault).toBe(false);
  });

  it("rejects findOneAndUpdate that sets archivedAt != null + isDefault=true", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.query.archive-default@example.com",
    });
    const category = await createFieldCategory("Archive Default");
    const activeDefault = await createGeneratedActive({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Active Default",
      isDefault: true,
    });

    await expectWriteRejectedByPersistence(() =>
      CandidateCV.findOneAndUpdate(
        { _id: activeDefault._id },
        {
          $set: {
            archivedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        },
        { returnDocument: "after", runValidators: true },
      ),
    );

    const persisted = await CandidateCV.findById(activeDefault._id).lean();
    expect(persisted.archivedAt).toBeNull();
    expect(persisted.isDefault).toBe(true);
    expect(persisted.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
  });

  it("still allows canonical query-update transitions under the same validator", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.query.canonical-ok@example.com",
    });
    const category = await createFieldCategory("Canonical OK");
    const draft = await createGeneratedDraft({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Activate Me",
    });
    const activeDefault = await createGeneratedActive({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Demote Me",
      isDefault: true,
    });
    const uploaded = await createUploadedActive({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Replace Me",
    });
    const switchTarget = await createGeneratedActive({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Switch Target",
      isDefault: false,
    });

    const activated = await CandidateCV.findOneAndUpdate(
      { _id: draft._id },
      {
        $set: {
          status: CANDIDATE_CV_STATUS.ACTIVE,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    expect(activated.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);

    const demoted = await CandidateCV.findOneAndUpdate(
      { _id: activeDefault._id },
      {
        $set: {
          status: CANDIDATE_CV_STATUS.DRAFT,
          isDefault: false,
          generatedContent: {
            personalInfo: {
              fullName: "Incomplete",
              email: null,
              phone: null,
            },
            professionalSummary: null,
            educations: [],
            skills: [],
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    expect(demoted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(demoted.isDefault).toBe(false);

    const replaced = await CandidateCV.findOneAndUpdate(
      { _id: uploaded._id },
      {
        $set: {
          uploadedFile: {
            storageKey: "candidate-cvs/replaced.pdf",
            originalFileName: "replaced.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2048,
            pageCount: 2,
            uploadedAt: new Date("2026-03-01T00:00:00.000Z"),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    expect(replaced.uploadedFile.storageKey).toBe(
      "candidate-cvs/replaced.pdf",
    );
    expect(replaced.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);

    const clearedDefault = await CandidateCV.findOneAndUpdate(
      { _id: demoted._id },
      {
        $set: {
          isDefault: false,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    expect(clearedDefault.isDefault).toBe(false);

    const setDefault = await CandidateCV.findOneAndUpdate(
      { _id: switchTarget._id },
      {
        $set: {
          isDefault: true,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    expect(setDefault.isDefault).toBe(true);
    expect(setDefault.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);

    const archived = await CandidateCV.findOneAndUpdate(
      { _id: setDefault._id },
      {
        $set: {
          archivedAt: new Date("2026-04-01T00:00:00.000Z"),
          isDefault: false,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.isDefault).toBe(false);
  });
});
