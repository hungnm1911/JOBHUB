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
import Application, {
  ensureApplicationCollectionInvariants,
} from "../../src/models/application.model.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CAPTURED_AT = new Date("2026-08-12T06:00:00.000Z");
const APPLIED_AT = new Date("2026-08-12T06:00:01.000Z");

const buildSnapshotPdfFile = (overrides = {}) => ({
  storageKey: "applications/submitted-cv-snapshots/demo.pdf",
  originalFileName: "demo.pdf",
  mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
  sizeBytes: 2048,
  pageCount: 2,
  ...overrides,
});

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Uploaded CV",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: buildSnapshotPdfFile(),
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const buildValidRawDocument = (candidateUserId) => ({
  _id: new mongoose.Types.ObjectId(),
  candidateUserId,
  jobId: new mongoose.Types.ObjectId(),
  source: APPLICATION_SOURCE.DIRECT_APPLICATION,
  status: APPLICATION_STATUS.APPLIED,
  submittedCvSnapshot: buildUploadedSnapshot(),
  appliedAt: APPLIED_AT,
  withdrawnAt: null,
  withdrawReason: null,
  version: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const expectRawWriteRejected = async (op) => {
  await expect(op()).rejects.toThrow();
};

describe("V9 — Application root-field collection validator", () => {
  beforeAll(async () => {
    await connectTestDatabase();
    await ensureApplicationCollectionInvariants();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("rejects raw insert missing candidateUserId", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    delete doc.candidateUserId;

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw insert missing jobId", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    delete doc.jobId;

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw insert missing source", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    delete doc.source;

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw insert with source outside canonical enum", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    doc.source = "JOB_INVITATION";

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw insert missing status", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    delete doc.status;

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw insert with status outside canonical enum", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    doc.status = "UNASSIGNED";

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw insert missing appliedAt", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
    delete doc.appliedAt;

    await expectRawWriteRejected(() =>
      Application.collection.insertOne(doc),
    );
  });

  it("rejects raw update that unsets candidateUserId", async () => {
    const { user } = await createVerifiedUser({
      email: "raw-root-validator.unset-candidate@example.com",
    });
    const doc = buildValidRawDocument(user._id);
    await Application.collection.insertOne(doc);

    await expectRawWriteRejected(() =>
      Application.collection.updateOne(
        { _id: doc._id },
        { $unset: { candidateUserId: "" } },
      ),
    );
  });

  it("rejects raw update that unsets source", async () => {
    const { user } = await createVerifiedUser({
      email: "raw-root-validator.unset-source@example.com",
    });
    const doc = buildValidRawDocument(user._id);
    await Application.collection.insertOne(doc);

    await expectRawWriteRejected(() =>
      Application.collection.updateOne(
        { _id: doc._id },
        { $unset: { source: "" } },
      ),
    );
  });

  it("rejects raw update that sets invalid status", async () => {
    const { user } = await createVerifiedUser({
      email: "raw-root-validator.invalid-status@example.com",
    });
    const doc = buildValidRawDocument(user._id);
    await Application.collection.insertOne(doc);

    await expectRawWriteRejected(() =>
      Application.collection.updateOne(
        { _id: doc._id },
        { $set: { status: "UNASSIGNED" } },
      ),
    );
  });

  it("accepts raw update to every Unassigned-capable status without Assignee", async () => {
    const statusesAllowingUnassigned = [
      APPLICATION_STATUS.APPLIED,
      APPLICATION_STATUS.SCREENING,
      APPLICATION_STATUS.CONTACTED,
      APPLICATION_STATUS.INTERVIEW_SCHEDULED,
      APPLICATION_STATUS.INTERVIEW_COMPLETED,
      APPLICATION_STATUS.WITHDRAWN,
    ];

    for (const status of statusesAllowingUnassigned) {
      const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
      await Application.collection.insertOne(doc);

      const update = { status, version: 1 };
      if (status === APPLICATION_STATUS.WITHDRAWN) {
        update.withdrawnAt = new Date();
      }

      await Application.collection.updateOne(
        { _id: doc._id },
        { $set: update },
      );

      const persisted = await Application.collection.findOne({ _id: doc._id });
      expect(persisted.status).toBe(status);
      expect(persisted.assignedRecruiterCompanyMemberId ?? null).toBeNull();
    }
  });

  it("rejects raw update that sets HIRED or REJECTED without Assignee", async () => {
    for (const status of [
      APPLICATION_STATUS.HIRED,
      APPLICATION_STATUS.REJECTED,
    ]) {
      const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
      await Application.collection.insertOne(doc);

      await expectRawWriteRejected(() =>
        Application.collection.updateOne(
          { _id: doc._id },
          { $set: { status, version: 1 } },
        ),
      );

      const persisted = await Application.collection.findOne({ _id: doc._id });
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.assignedRecruiterCompanyMemberId ?? null).toBeNull();
    }
  });

  describe("withdrawal state matrix at collection boundary", () => {
    it("rejects APPLIED with non-null withdrawnAt", async () => {
      const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
      doc.status = APPLICATION_STATUS.APPLIED;
      doc.withdrawnAt = new Date();

      await expectRawWriteRejected(() =>
        Application.collection.insertOne(doc),
      );
    });

    it("rejects APPLIED with non-null withdrawReason", async () => {
      const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
      doc.status = APPLICATION_STATUS.APPLIED;
      doc.withdrawReason = "Some reason";

      await expectRawWriteRejected(() =>
        Application.collection.insertOne(doc),
      );
    });

    it("rejects WITHDRAWN with null withdrawnAt", async () => {
      const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
      doc.status = APPLICATION_STATUS.WITHDRAWN;
      doc.withdrawnAt = null;
      doc.version = 1;

      await expectRawWriteRejected(() =>
        Application.collection.insertOne(doc),
      );
    });

    it("accepts WITHDRAWN with valid withdrawnAt and optional withdrawReason", async () => {
      const doc = buildValidRawDocument(new mongoose.Types.ObjectId());
      doc.status = APPLICATION_STATUS.WITHDRAWN;
      doc.withdrawnAt = new Date();
      doc.withdrawReason = null;
      doc.version = 1;

      await Application.collection.insertOne(doc);

      const doc2 = buildValidRawDocument(new mongoose.Types.ObjectId());
      doc2.status = APPLICATION_STATUS.WITHDRAWN;
      doc2.withdrawnAt = new Date();
      doc2.withdrawReason = "Accepted another offer";
      doc2.version = 1;

      await Application.collection.insertOne(doc2);
    });
  });

  it("preserves valid document after failed raw update (no partial mutation)", async () => {
    const { user } = await createVerifiedUser({
      email: "raw-root-validator.no-partial@example.com",
    });
    const doc = buildValidRawDocument(user._id);
    await Application.collection.insertOne(doc);

    const before = await Application.collection.findOne({ _id: doc._id });

    await expectRawWriteRejected(() =>
      Application.collection.updateOne(
        { _id: doc._id },
        { $set: { status: "UNASSIGNED" } },
      ),
    );

    const after = await Application.collection.findOne({ _id: doc._id });
    expect(JSON.parse(JSON.stringify(after))).toEqual(
      JSON.parse(JSON.stringify(before)),
    );
  });

  it("accepts a fully valid raw insert", async () => {
    const doc = buildValidRawDocument(new mongoose.Types.ObjectId());

    await Application.collection.insertOne(doc);

    const persisted = await Application.collection.findOne({ _id: doc._id });
    expect(persisted).toBeTruthy();
    expect(persisted.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
    expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
  });
});
