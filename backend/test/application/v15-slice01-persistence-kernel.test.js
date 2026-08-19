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
import JOB_INVITATION_INVALIDATION_REASON from "../../src/constants/job-invitation-invalidation-reason.js";
import JOB_INVITATION_STATUS from "../../src/constants/job-invitation-status.js";
import Application from "../../src/models/application.model.js";
import JobInvitation, {
  ensureJobInvitationCollectionInvariants,
} from "../../src/models/job-invitation.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const SENT_AT = new Date("2026-08-19T02:00:00.000Z");
const EXPIRES_AT = new Date("2026-09-03T16:59:59.999Z");
const CAPTURED_AT = new Date("2026-08-19T02:00:00.000Z");
const SOURCE_CAUSE_AT = new Date("2026-08-19T03:00:00.000Z");
const MATERIALIZED_AT = new Date("2026-08-19T03:10:00.000Z");

const FORBIDDEN_JOB_INVITATION_FIELDS = [
  "applicationId",
  "companyId",
  "events",
  "jobDescriptionSnapshot",
  "rejectReason",
  "currentPrimaryRecruiterCompanyMemberId",
  "currentAssignedRecruiterCompanyMemberId",
  "sourceRecruiterCompanyMemberId",
  "isActive",
  "isExpired",
  "canAccept",
  "canReject",
  "canRevoke",
  "deliveryStatus",
  "socketEventId",
  "expiredAt",
];

const buildSnapshotPdfFile = (overrides = {}) => ({
  storageKey: "job-invitations/invited-cv-snapshots/demo.pdf",
  originalFileName: "demo.pdf",
  mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
  sizeBytes: 2048,
  pageCount: 2,
  ...overrides,
});

const buildGeneratedSnapshot = (overrides = {}) => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Invited Generated CV",
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
  name: "Invited Uploaded CV",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: buildSnapshotPdfFile({
    storageKey: "job-invitations/invited-cv-snapshots/uploaded.pdf",
    originalFileName: "uploaded.pdf",
  }),
  capturedAt: CAPTURED_AT,
  ...overrides,
});

const buildInvitationFields = ({
  candidateUserId = new mongoose.Types.ObjectId(),
  invitedCvId = new mongoose.Types.ObjectId(),
  jobId = new mongoose.Types.ObjectId(),
  sentByRecruiterCompanyMemberId = new mongoose.Types.ObjectId(),
  invitedCvSnapshot = buildGeneratedSnapshot(),
  greetingMessage = null,
  status = JOB_INVITATION_STATUS.PENDING,
  sentAt = SENT_AT,
  expiresAt = EXPIRES_AT,
  acceptedAt = null,
  rejectedAt = null,
  revokedAt = null,
  invalidatedAt = null,
  invalidationReason = null,
} = {}) => ({
  candidateUserId,
  invitedCvId,
  jobId,
  sentByRecruiterCompanyMemberId,
  invitedCvSnapshot,
  greetingMessage,
  status,
  sentAt,
  expiresAt,
  acceptedAt,
  rejectedAt,
  revokedAt,
  invalidatedAt,
  invalidationReason,
});

const buildRawInvitation = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  ...buildInvitationFields(overrides),
  createdAt: SENT_AT,
  updatedAt: SENT_AT,
});

const buildInvitationApplicationFields = ({
  candidateUserId = new mongoose.Types.ObjectId(),
  jobId = new mongoose.Types.ObjectId(),
  sourceInvitationId = new mongoose.Types.ObjectId(),
  assignedRecruiterCompanyMemberId = new mongoose.Types.ObjectId(),
  status = APPLICATION_STATUS.CONTACTED,
  submittedCvSnapshot = buildGeneratedSnapshot(),
  appliedAt = null,
  withdrawnAt = null,
  withdrawReason = null,
  version = 0,
} = {}) => ({
  candidateUserId,
  jobId,
  source: APPLICATION_SOURCE.RECRUITER_INVITATION,
  sourceInvitationId,
  status,
  assignedRecruiterCompanyMemberId,
  submittedCvSnapshot,
  appliedAt,
  withdrawnAt,
  withdrawReason,
  version,
});

const indexKeyEquals = (indexKey, expected) => {
  const expectedEntries = Object.entries(expected);
  const indexEntries = Object.entries(indexKey ?? {});
  if (indexEntries.length !== expectedEntries.length) {
    return false;
  }

  return expectedEntries.every(
    ([field, direction], position) =>
      indexEntries[position]?.[0] === field &&
      indexEntries[position]?.[1] === direction,
  );
};

describe("V15 Slice 01 — Persistence kernel", () => {
  beforeAll(async () => {
    await connectTestDatabase();
    await ensureJobInvitationCollectionInvariants();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("JobInvitation vocabulary and document shape", () => {
    it("exposes the six canonical statuses and exact invalidation reasons", () => {
      expect(Object.values(JOB_INVITATION_STATUS)).toEqual([
        JOB_INVITATION_STATUS.PENDING,
        JOB_INVITATION_STATUS.ACCEPTED,
        JOB_INVITATION_STATUS.REJECTED,
        JOB_INVITATION_STATUS.REVOKED,
        JOB_INVITATION_STATUS.EXPIRED,
        JOB_INVITATION_STATUS.INVALIDATED,
      ]);
      expect(Object.values(JOB_INVITATION_INVALIDATION_REASON)).toEqual([
        JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
        JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_EMAIL_UNVERIFIED,
        JOB_INVITATION_INVALIDATION_REASON.INVITED_CV_ARCHIVED,
        JOB_INVITATION_INVALIDATION_REASON.COMPANY_NOT_OPERATIONAL,
        JOB_INVITATION_INVALIDATION_REASON.SENDER_NOT_ACTIVE,
        JOB_INVITATION_INVALIDATION_REASON.SENDER_COMPANY_MEMBERSHIP_INVALID,
        JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
      ]);
      expect(Object.values(JOB_INVITATION_INVALIDATION_REASON)).not.toContain(
        "OTHER_ELIGIBILITY_FAILED",
      );
    });

    it("persists PENDING Invitation with V9 snapshot shape and no excluded fields", async () => {
      const invitation = await JobInvitation.create({
        ...buildInvitationFields({
          greetingMessage: "We would like to invite you.",
        }),
        companyId: new mongoose.Types.ObjectId(),
        applicationId: new mongoose.Types.ObjectId(),
        rejectReason: "not stored",
        isExpired: true,
      });

      expect(invitation.collection.collectionName).toBe("job_invitations");
      expect(invitation.status).toBe(JOB_INVITATION_STATUS.PENDING);
      expect(invitation.greetingMessage).toBe("We would like to invite you.");
      expect(invitation.expiresAt.toISOString()).toBe(EXPIRES_AT.toISOString());
      expect(invitation.acceptedAt).toBeNull();
      expect(invitation.invalidatedAt).toBeNull();
      expect(invitation.invalidationReason).toBeNull();
      expect(invitation.invitedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      );
      expect(invitation.invitedCvSnapshot.sourceCandidateCvId).toBeDefined();
      expect(invitation.invitedCvSnapshot.pdfFile.storageKey).toBeTruthy();
      expect(invitation.invitedCvSnapshot.capturedAt).toBeInstanceOf(Date);

      const persisted = await JobInvitation.findById(invitation._id).lean();
      for (const field of FORBIDDEN_JOB_INVITATION_FIELDS) {
        expect(persisted).not.toHaveProperty(field);
      }
    });

    it("reuses the V9 submitted-CV snapshot fields for invitedCvSnapshot", async () => {
      const invitation = await JobInvitation.create(
        buildInvitationFields({
          invitedCvSnapshot: buildUploadedSnapshot(),
        }),
      );
      const application = await Application.create(
        buildInvitationApplicationFields({
          submittedCvSnapshot: invitation.invitedCvSnapshot.toObject(),
          sourceInvitationId: invitation._id,
        }),
      );

      const invited = invitation.invitedCvSnapshot.toObject();
      const submitted = application.submittedCvSnapshot.toObject();
      expect(Object.keys(invited).sort()).toEqual(Object.keys(submitted).sort());
      expect(submitted.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.UPLOADED);
      expect(submitted.generatedContent).toBeUndefined();
    });
  });

  describe("JobInvitation status × terminal metadata matrix", () => {
    it("rejects mongoose creation outside PENDING", async () => {
      await expect(
        JobInvitation.create(
          buildInvitationFields({
            status: JOB_INVITATION_STATUS.ACCEPTED,
            acceptedAt: SENT_AT,
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("rejects mixed terminal timestamps on PENDING", async () => {
      await expect(
        JobInvitation.create(
          buildInvitationFields({
            acceptedAt: SENT_AT,
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("persists each terminal status only with its matching metadata", async () => {
      const accepted = buildRawInvitation({
        status: JOB_INVITATION_STATUS.ACCEPTED,
        acceptedAt: SENT_AT,
      });
      const rejected = buildRawInvitation({
        status: JOB_INVITATION_STATUS.REJECTED,
        rejectedAt: SENT_AT,
      });
      const revoked = buildRawInvitation({
        status: JOB_INVITATION_STATUS.REVOKED,
        revokedAt: SENT_AT,
      });
      const expired = buildRawInvitation({
        status: JOB_INVITATION_STATUS.EXPIRED,
      });
      const invalidated = buildRawInvitation({
        status: JOB_INVITATION_STATUS.INVALIDATED,
        invalidatedAt: SOURCE_CAUSE_AT,
        invalidationReason:
          JOB_INVITATION_INVALIDATION_REASON.SENDER_REMOVED_FROM_JOB_TEAM,
      });

      await JobInvitation.collection.insertMany([
        accepted,
        rejected,
        revoked,
        expired,
        invalidated,
      ]);

      const persistedInvalidated = await JobInvitation.collection.findOne({
        _id: invalidated._id,
      });
      expect(persistedInvalidated.invalidatedAt.toISOString()).toBe(
        SOURCE_CAUSE_AT.toISOString(),
      );
      expect(persistedInvalidated.invalidatedAt.toISOString()).not.toBe(
        MATERIALIZED_AT.toISOString(),
      );
    });

    it("rejects INVALIDATED without exact reason or effective-cause time", async () => {
      await expect(
        JobInvitation.collection.insertOne(
          buildRawInvitation({
            status: JOB_INVITATION_STATUS.INVALIDATED,
            invalidationReason:
              JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
          }),
        ),
      ).rejects.toBeTruthy();

      await expect(
        JobInvitation.collection.insertOne(
          buildRawInvitation({
            status: JOB_INVITATION_STATUS.INVALIDATED,
            invalidatedAt: SOURCE_CAUSE_AT,
          }),
        ),
      ).rejects.toBeTruthy();

      await expect(
        JobInvitation.collection.insertOne(
          buildRawInvitation({
            status: JOB_INVITATION_STATUS.INVALIDATED,
            invalidatedAt: SOURCE_CAUSE_AT,
            invalidationReason: "OTHER_ELIGIBILITY_FAILED",
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("rejects non-INVALIDATED documents that carry invalidationReason", async () => {
      await expect(
        JobInvitation.collection.insertOne(
          buildRawInvitation({
            invalidationReason:
              JOB_INVITATION_INVALIDATION_REASON.CANDIDATE_NOT_ACTIVE,
          }),
        ),
      ).rejects.toBeTruthy();
    });
  });

  describe("JobInvitation uniqueness, indexes, and identity", () => {
    it("allows only one PENDING Invitation per Candidate–Job", async () => {
      const candidateUserId = new mongoose.Types.ObjectId();
      const jobId = new mongoose.Types.ObjectId();

      await JobInvitation.create(
        buildInvitationFields({ candidateUserId, jobId }),
      );

      await expect(
        JobInvitation.create(
          buildInvitationFields({
            candidateUserId,
            jobId,
            invitedCvId: new mongoose.Types.ObjectId(),
          }),
        ),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it("allows historical terminal Invitations plus a new PENDING for the same Candidate–Job", async () => {
      const candidateUserId = new mongoose.Types.ObjectId();
      const jobId = new mongoose.Types.ObjectId();

      await JobInvitation.collection.insertOne(
        buildRawInvitation({
          candidateUserId,
          jobId,
          status: JOB_INVITATION_STATUS.EXPIRED,
        }),
      );
      await JobInvitation.collection.insertOne(
        buildRawInvitation({
          candidateUserId,
          jobId,
          status: JOB_INVITATION_STATUS.REVOKED,
          revokedAt: SENT_AT,
        }),
      );

      const pending = await JobInvitation.create(
        buildInvitationFields({ candidateUserId, jobId }),
      );
      expect(pending.status).toBe(JOB_INVITATION_STATUS.PENDING);
    });

    it("declares canonical indexes and does not TTL-delete expiresAt", async () => {
      await JobInvitation.init();
      const indexes = await JobInvitation.collection.indexes();

      const pendingUnique = indexes.find(
        (index) =>
          index.unique === true &&
          indexKeyEquals(index.key, { candidateUserId: 1, jobId: 1 }),
      );
      expect(pendingUnique).toBeDefined();
      expect(pendingUnique.partialFilterExpression).toEqual({
        status: JOB_INVITATION_STATUS.PENDING,
      });

      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, {
            candidateUserId: 1,
            jobId: 1,
            createdAt: -1,
          }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, {
            candidateUserId: 1,
            createdAt: -1,
            _id: -1,
          }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, { jobId: 1, createdAt: -1, _id: -1 }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, { jobId: 1, status: 1 }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, { candidateUserId: 1, status: 1 }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, {
            sentByRecruiterCompanyMemberId: 1,
            status: 1,
          }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, { invitedCvId: 1, status: 1 }),
        ),
      ).toBe(true);
      expect(
        indexes.some((index) =>
          indexKeyEquals(index.key, { status: 1, expiresAt: 1 }),
        ),
      ).toBe(true);

      expect(indexes.some((index) => index.expireAfterSeconds != null)).toBe(
        false,
      );
    });

    it("rejects identity-field mutation after creation", async () => {
      const invitation = await JobInvitation.create(buildInvitationFields());

      await expect(
        JobInvitation.updateOne(
          { _id: invitation._id },
          { $set: { sentByRecruiterCompanyMemberId: new mongoose.Types.ObjectId() } },
        ),
      ).rejects.toThrow("JobInvitation identity fields are immutable after creation");

      invitation.jobId = new mongoose.Types.ObjectId();
      await expect(invitation.save()).rejects.toBeTruthy();
    });
  });

  describe("Application Invitation source extension", () => {
    it("adds RECRUITER_INVITATION without a Source Recruiter field", () => {
      expect(Object.values(APPLICATION_SOURCE)).toEqual([
        APPLICATION_SOURCE.DIRECT_APPLICATION,
        APPLICATION_SOURCE.RECRUITER_INVITATION,
      ]);
    });

    it("creates Invitation-source Application at CONTACTED with sourceInvitationId", async () => {
      const senderId = new mongoose.Types.ObjectId();
      const application = await Application.create(
        buildInvitationApplicationFields({
          assignedRecruiterCompanyMemberId: senderId,
        }),
      );

      expect(application.source).toBe(APPLICATION_SOURCE.RECRUITER_INVITATION);
      expect(application.status).toBe(APPLICATION_STATUS.CONTACTED);
      expect(application.appliedAt).toBeNull();
      expect(application.withdrawnAt).toBeNull();
      expect(application.withdrawReason).toBeNull();
      expect(application.assignedRecruiterCompanyMemberId.toString()).toBe(
        senderId.toString(),
      );
      expect(application.toObject()).not.toHaveProperty(
        "sourceRecruiterCompanyMemberId",
      );
    });

    it("rejects Invitation-source creation outside CONTACTED or without assignee", async () => {
      await expect(
        Application.create(
          buildInvitationApplicationFields({
            status: APPLICATION_STATUS.APPLIED,
          }),
        ),
      ).rejects.toBeTruthy();

      await expect(
        Application.create(
          buildInvitationApplicationFields({
            status: APPLICATION_STATUS.SCREENING,
          }),
        ),
      ).rejects.toBeTruthy();

      await expect(
        Application.create(
          buildInvitationApplicationFields({
            assignedRecruiterCompanyMemberId: null,
          }),
        ),
      ).rejects.toBeTruthy();
    });

    it("rejects source-dependent structural violations at the collection boundary", async () => {
      await expect(
        Application.collection.insertOne({
          ...buildInvitationApplicationFields({
            appliedAt: SENT_AT,
          }),
          _id: new mongoose.Types.ObjectId(),
          createdAt: SENT_AT,
          updatedAt: SENT_AT,
        }),
      ).rejects.toBeTruthy();

      await expect(
        Application.collection.insertOne({
          _id: new mongoose.Types.ObjectId(),
          candidateUserId: new mongoose.Types.ObjectId(),
          jobId: new mongoose.Types.ObjectId(),
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
          sourceInvitationId: new mongoose.Types.ObjectId(),
          status: APPLICATION_STATUS.APPLIED,
          submittedCvSnapshot: buildGeneratedSnapshot(),
          appliedAt: SENT_AT,
          version: 0,
          createdAt: SENT_AT,
          updatedAt: SENT_AT,
        }),
      ).rejects.toBeTruthy();
    });

    it("enforces unique sourceInvitationId when present and keeps Candidate–Job uniqueness", async () => {
      const sourceInvitationId = new mongoose.Types.ObjectId();
      await Application.create(
        buildInvitationApplicationFields({ sourceInvitationId }),
      );

      await expect(
        Application.create(
          buildInvitationApplicationFields({
            sourceInvitationId,
            jobId: new mongoose.Types.ObjectId(),
          }),
        ),
      ).rejects.toMatchObject({ code: 11000 });

      const candidateUserId = new mongoose.Types.ObjectId();
      const jobId = new mongoose.Types.ObjectId();
      await Application.create(
        buildInvitationApplicationFields({ candidateUserId, jobId }),
      );
      await expect(
        Application.create(
          buildInvitationApplicationFields({
            candidateUserId,
            jobId,
            sourceInvitationId: new mongoose.Types.ObjectId(),
          }),
        ),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it("declares the partial unique sourceInvitationId index", async () => {
      await Application.init();
      const indexes = await Application.collection.indexes();
      const sourceInvitationIndex = indexes.find(
        (index) =>
          index.unique === true &&
          indexKeyEquals(index.key, { sourceInvitationId: 1 }),
      );

      expect(sourceInvitationIndex).toBeDefined();
      expect(sourceInvitationIndex.partialFilterExpression).toEqual({
        sourceInvitationId: { $exists: true, $type: "objectId" },
      });
    });
  });
});
