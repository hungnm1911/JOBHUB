import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import Application from "../../src/models/application.model.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CAPTURED_AT = new Date("2026-08-12T06:00:00.000Z");
const APPLIED_AT = new Date("2026-08-12T06:00:01.000Z");

const buildSnapshotPdfFile = () => ({
  storageKey: "applications/submitted-cv-snapshots/demo.pdf",
  originalFileName: "demo.pdf",
  mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
  sizeBytes: 2048,
  pageCount: 2,
});

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Uploaded CV",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: buildSnapshotPdfFile(),
  capturedAt: CAPTURED_AT,
});

const createApplication = async () => {
  const { user } = await createVerifiedUser({
    email: `candidate-${new mongoose.Types.ObjectId()}@example.com`,
  });
  const jobId = new mongoose.Types.ObjectId();
  const app = await Application.create({
    candidateUserId: user._id,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: buildUploadedSnapshot(),
    appliedAt: APPLIED_AT,
    version: 0,
  });
  return app;
};

const assertIdentityUnchanged = async (appId, original) => {
  const reloaded = await Application.findById(appId).lean();
  expect(reloaded.candidateUserId.toString()).toBe(
    original.candidateUserId.toString(),
  );
  expect(reloaded.jobId.toString()).toBe(original.jobId.toString());
  expect(reloaded.source).toBe(original.source);
  expect(new Date(reloaded.appliedAt).toISOString()).toBe(
    new Date(original.appliedAt).toISOString(),
  );
};

describe("Application query-update identity immutability", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("replaceOne", () => {
    it("rejects candidateUserId mutation", async () => {
      const app = await createApplication();
      const anotherUserId = new mongoose.Types.ObjectId();

      await expect(
        Application.replaceOne(
          { _id: app._id },
          {
            candidateUserId: anotherUserId,
            jobId: app.jobId,
            source: app.source,
            status: app.status,
            submittedCvSnapshot: app.submittedCvSnapshot.toObject(),
            appliedAt: app.appliedAt,
            version: app.version,
          },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });

    it("rejects jobId mutation", async () => {
      const app = await createApplication();
      const anotherJobId = new mongoose.Types.ObjectId();

      await expect(
        Application.replaceOne(
          { _id: app._id },
          {
            candidateUserId: app.candidateUserId,
            jobId: anotherJobId,
            source: app.source,
            status: app.status,
            submittedCvSnapshot: app.submittedCvSnapshot.toObject(),
            appliedAt: app.appliedAt,
            version: app.version,
          },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });

    it("rejects source mutation", async () => {
      const app = await createApplication();

      await expect(
        Application.replaceOne(
          { _id: app._id },
          {
            candidateUserId: app.candidateUserId,
            jobId: app.jobId,
            source: "INVENTED_SOURCE",
            status: app.status,
            submittedCvSnapshot: app.submittedCvSnapshot.toObject(),
            appliedAt: app.appliedAt,
            version: app.version,
          },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });

    it("rejects appliedAt mutation", async () => {
      const app = await createApplication();
      const differentDate = new Date("2020-01-01T00:00:00.000Z");

      await expect(
        Application.replaceOne(
          { _id: app._id },
          {
            candidateUserId: app.candidateUserId,
            jobId: app.jobId,
            source: app.source,
            status: app.status,
            submittedCvSnapshot: app.submittedCvSnapshot.toObject(),
            appliedAt: differentDate,
            version: app.version,
          },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });
  });

  describe("findOneAndReplace", () => {
    it("rejects jobId mutation", async () => {
      const app = await createApplication();
      const anotherJobId = new mongoose.Types.ObjectId();

      await expect(
        Application.findOneAndReplace(
          { _id: app._id },
          {
            candidateUserId: app.candidateUserId,
            jobId: anotherJobId,
            source: app.source,
            status: app.status,
            submittedCvSnapshot: app.submittedCvSnapshot.toObject(),
            appliedAt: app.appliedAt,
            version: app.version,
          },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });
  });

  describe("$currentDate", () => {
    it("rejects appliedAt mutation", async () => {
      const app = await createApplication();

      await expect(
        Application.updateOne(
          { _id: app._id },
          { $currentDate: { appliedAt: true } },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });
  });

  describe("bulkWrite", () => {
    it("rejects jobId mutation", async () => {
      const app = await createApplication();
      const anotherJobId = new mongoose.Types.ObjectId();

      await expect(
        Application.bulkWrite([
          {
            updateOne: {
              filter: { _id: app._id },
              update: { $set: { jobId: anotherJobId } },
            },
          },
        ]),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });

    it("rejects candidateUserId mutation", async () => {
      const app = await createApplication();
      const anotherUserId = new mongoose.Types.ObjectId();

      await expect(
        Application.bulkWrite([
          {
            updateOne: {
              filter: { _id: app._id },
              update: { $set: { candidateUserId: anotherUserId } },
            },
          },
        ]),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });
  });

  describe("aggregation update pipeline", () => {
    it("rejects jobId mutation via pipeline", async () => {
      const app = await createApplication();
      const anotherJobId = new mongoose.Types.ObjectId();

      await expect(
        Application.updateOne(
          { _id: app._id },
          [{ $set: { jobId: anotherJobId } }],
          { updatePipeline: true },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });

    it("rejects candidateUserId mutation via pipeline", async () => {
      const app = await createApplication();
      const anotherUserId = new mongoose.Types.ObjectId();

      await expect(
        Application.updateOne(
          { _id: app._id },
          [{ $set: { candidateUserId: anotherUserId } }],
          { updatePipeline: true },
        ),
      ).rejects.toThrow();

      await assertIdentityUnchanged(app._id, app);
    });
  });
});
