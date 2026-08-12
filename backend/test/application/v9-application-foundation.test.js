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

const buildSnapshotPdfFile = (overrides = {}) => ({
  storageKey: "applications/submitted-cv-snapshots/demo.pdf",
  originalFileName: "demo.pdf",
  mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
  sizeBytes: 2048,
  pageCount: 2,
  ...overrides,
});

const buildGeneratedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Generated CV",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
  generatedContent: {
    personalInfo: {
      fullName: "Jane Candidate",
      email: "jane@example.com",
    },
    professionalSummary: "Summary",
    skills: ["Node.js"],
  },
  pdfFile: buildSnapshotPdfFile(),
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const buildUploadedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Uploaded CV",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: buildSnapshotPdfFile({
    storageKey: "applications/submitted-cv-snapshots/uploaded.pdf",
    originalFileName: "uploaded.pdf",
  }),
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const buildApplicationFields = ({
  candidateUserId,
  jobId,
  source = APPLICATION_SOURCE.DIRECT_APPLICATION,
  status = APPLICATION_STATUS.APPLIED,
  submittedCvSnapshot = buildGeneratedSnapshot(),
  appliedAt = APPLIED_AT,
  withdrawnAt = null,
  withdrawReason = null,
  version = 0,
} = {}) => ({
  candidateUserId,
  jobId,
  source,
  status,
  submittedCvSnapshot,
  appliedAt,
  withdrawnAt,
  withdrawReason,
  version,
});

const expectWriteRejectedByPersistence = async (write) => {
  await expect(write()).rejects.toBeTruthy();
};

describe("V9 Slice 01 — Application persistence foundation", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("Application persistence foundation", () => {
    it("persists APPLIED Direct Application with GENERATED and UPLOADED snapshots", async () => {
      const { user } = await createVerifiedUser({
        email: "application.owner@example.com",
      });
      const jobId = new mongoose.Types.ObjectId();

      const generatedApplication = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId,
          submittedCvSnapshot: buildGeneratedSnapshot({
            sourceCandidateCvId: new mongoose.Types.ObjectId(),
          }),
        }),
      );

      const uploadedApplication = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId: new mongoose.Types.ObjectId(),
          submittedCvSnapshot: buildUploadedSnapshot(),
        }),
      );

      expect(generatedApplication.collection.collectionName).toBe("applications");
      expect(uploadedApplication.collection.collectionName).toBe("applications");
      expect(generatedApplication.source).toBe(
        APPLICATION_SOURCE.DIRECT_APPLICATION,
      );
      expect(generatedApplication.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(generatedApplication.version).toBe(0);
      expect(generatedApplication.withdrawnAt).toBeNull();
      expect(generatedApplication.withdrawReason).toBeNull();
      expect(
        generatedApplication.submittedCvSnapshot.sourceType,
      ).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
      expect(
        generatedApplication.submittedCvSnapshot.generatedContent.personalInfo
          .fullName,
      ).toBe("Jane Candidate");
      expect(
        uploadedApplication.submittedCvSnapshot.sourceType,
      ).toBe(CANDIDATE_CV_SOURCE_TYPE.UPLOADED);
      expect(
        uploadedApplication.submittedCvSnapshot.generatedContent,
      ).toBeUndefined();
      expect(generatedApplication.toObject()).not.toHaveProperty("companyId");
      expect(generatedApplication.toObject()).not.toHaveProperty(
        "assignedRecruiterCompanyMemberId",
      );
      expect(generatedApplication.toObject()).not.toHaveProperty(
        "sourceRecruiterCompanyMemberId",
      );
      expect(generatedApplication.toObject()).not.toHaveProperty(
        "sourceInvitationId",
      );
      expect(generatedApplication.toObject()).not.toHaveProperty("jobSnapshot");
      expect(generatedApplication.toObject()).not.toHaveProperty(
        "submittedCvSnapshots",
      );
      expect(generatedApplication.createdAt).toBeInstanceOf(Date);
      expect(generatedApplication.updatedAt).toBeInstanceOf(Date);
    });

    it("persists WITHDRAWN Application with optional withdrawReason", async () => {
      const { user } = await createVerifiedUser({
        email: "application.withdrawn@example.com",
      });
      const withdrawnAt = new Date("2026-08-12T07:00:00.000Z");

      const withdrawn = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId: new mongoose.Types.ObjectId(),
          status: APPLICATION_STATUS.WITHDRAWN,
          withdrawnAt,
          withdrawReason: "Accepted another offer",
          version: 1,
        }),
      );

      expect(withdrawn.status).toBe(APPLICATION_STATUS.WITHDRAWN);
      expect(withdrawn.withdrawnAt?.toISOString()).toBe(withdrawnAt.toISOString());
      expect(withdrawn.withdrawReason).toBe("Accepted another offer");
      expect(withdrawn.version).toBe(1);
    });

    it("enforces Candidate–Job uniqueness regardless of status or snapshot", async () => {
      const { user } = await createVerifiedUser({
        email: "application.unique@example.com",
      });
      const jobId = new mongoose.Types.ObjectId();

      await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId,
        }),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId,
            submittedCvSnapshot: buildUploadedSnapshot(),
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId,
            status: APPLICATION_STATUS.WITHDRAWN,
            withdrawnAt: new Date("2026-08-12T08:00:00.000Z"),
            version: 1,
          }),
        ),
      );
    });

    it("rejects Application status × withdrawal field matrix violations", async () => {
      const { user } = await createVerifiedUser({
        email: "application.status-matrix@example.com",
      });
      const base = {
        candidateUserId: user._id,
        jobId: new mongoose.Types.ObjectId(),
      };

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            withdrawnAt: new Date("2026-08-12T08:00:00.000Z"),
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            withdrawReason: "Too early",
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            status: APPLICATION_STATUS.WITHDRAWN,
            withdrawnAt: null,
          }),
        ),
      );
    });

    it("rejects Submitted CV Snapshot source matrix and PDF metadata violations", async () => {
      const { user } = await createVerifiedUser({
        email: "application.snapshot-matrix@example.com",
      });
      const base = {
        candidateUserId: user._id,
        jobId: new mongoose.Types.ObjectId(),
      };

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            submittedCvSnapshot: buildGeneratedSnapshot({
              generatedContent: undefined,
            }),
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            submittedCvSnapshot: buildUploadedSnapshot({
              generatedContent: {
                personalInfo: {
                  fullName: "Should not persist",
                },
              },
            }),
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            submittedCvSnapshot: buildUploadedSnapshot({
              pdfFile: buildSnapshotPdfFile({
                mimeType: "text/plain",
              }),
            }),
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            submittedCvSnapshot: buildUploadedSnapshot({
              pdfFile: buildSnapshotPdfFile({
                sizeBytes: 0,
              }),
            }),
          }),
        ),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            ...base,
            submittedCvSnapshot: buildUploadedSnapshot({
              pdfFile: buildSnapshotPdfFile({
                pageCount: 0,
              }),
            }),
          }),
        ),
      );
    });

    it("rejects negative Application version", async () => {
      const { user } = await createVerifiedUser({
        email: "application.version@example.com",
      });

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId: new mongoose.Types.ObjectId(),
            version: -1,
          }),
        ),
      );
    });

    it("rejects findOneAndUpdate that breaks Application local invariants even with runValidators", async () => {
      const { user } = await createVerifiedUser({
        email: "application.query-update@example.com",
      });
      const application = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId: new mongoose.Types.ObjectId(),
        }),
      );

      await expectWriteRejectedByPersistence(() =>
        Application.findOneAndUpdate(
          { _id: application._id },
          {
            $set: {
              withdrawnAt: new Date("2026-08-12T09:00:00.000Z"),
            },
          },
          { returnDocument: "after", runValidators: true },
        ),
      );

      const persisted = await Application.findById(application._id).lean();
      expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(persisted.withdrawnAt).toBeNull();
    });

    it("blocks mutating immutable Application identity fields on save", async () => {
      const { user } = await createVerifiedUser({
        email: "application.immutable@example.com",
      });
      const application = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId: new mongoose.Types.ObjectId(),
        }),
      );

      application.jobId = new mongoose.Types.ObjectId();

      await expectWriteRejectedByPersistence(() => application.save());
    });
  });
});
