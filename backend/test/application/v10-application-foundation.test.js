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
  APPLICATION_STATUSES_REQUIRING_ASSIGNEE,
  assertApplicationLocalInvariants,
  ensureApplicationCollectionInvariants,
} from "../../src/models/application.model.js";
import { createVerifiedUser } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const CAPTURED_AT = new Date("2026-08-13T06:00:00.000Z");
const APPLIED_AT = new Date("2026-08-13T06:00:01.000Z");
const WITHDRAWN_AT = new Date("2026-08-13T07:00:00.000Z");

const V10_STATUS_VALUES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
];

const NON_TERMINAL_STATUSES = [
  APPLICATION_STATUS.APPLIED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.CONTACTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_COMPLETED,
];

const TERMINAL_STATUSES_REQUIRING_FINAL_ASSIGNEE = [
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
];

const buildSnapshotPdfFile = (overrides = {}) => ({
  storageKey: "applications/submitted-cv-snapshots/v10-demo.pdf",
  originalFileName: "v10-demo.pdf",
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

const buildApplicationFields = ({
  candidateUserId,
  jobId,
  source = APPLICATION_SOURCE.DIRECT_APPLICATION,
  status = APPLICATION_STATUS.APPLIED,
  submittedCvSnapshot = buildUploadedSnapshot(),
  appliedAt = APPLIED_AT,
  withdrawnAt = null,
  withdrawReason = null,
  assignedRecruiterCompanyMemberId = null,
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
  assignedRecruiterCompanyMemberId,
  version,
});

const buildRawDocument = ({
  candidateUserId = new mongoose.Types.ObjectId(),
  jobId = new mongoose.Types.ObjectId(),
  status = APPLICATION_STATUS.APPLIED,
  assignedRecruiterCompanyMemberId,
  includeAssigneeField = true,
  withdrawnAt = null,
  withdrawReason = null,
  version = 0,
} = {}) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status,
    submittedCvSnapshot: buildUploadedSnapshot(),
    appliedAt: APPLIED_AT,
    withdrawnAt,
    withdrawReason,
    version,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (includeAssigneeField) {
    doc.assignedRecruiterCompanyMemberId =
      assignedRecruiterCompanyMemberId === undefined
        ? null
        : assignedRecruiterCompanyMemberId;
  }

  return doc;
};

const expectWriteRejectedByPersistence = async (write) => {
  await expect(write()).rejects.toBeTruthy();
};

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

describe("V10 Slice 01 — Application persistence foundation", () => {
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

  describe("V10 status vocabulary", () => {
    it("exposes the eight canonical V10 Application.status values and never UNASSIGNED", () => {
      expect(Object.values(APPLICATION_STATUS)).toEqual(V10_STATUS_VALUES);
      expect(APPLICATION_STATUS).not.toHaveProperty("UNASSIGNED");
      expect(Object.values(APPLICATION_STATUS)).not.toContain("UNASSIGNED");
      expect(Object.values(APPLICATION_STATUS)).not.toContain("INTERVIEW");
      expect(Object.values(APPLICATION_STATUS)).not.toContain("COMPLETED");
    });

    it("rejects status values outside the V10 vocabulary at the collection boundary", async () => {
      for (const invalidStatus of ["UNASSIGNED", "INTERVIEW", "COMPLETED", "FOO"]) {
        const doc = buildRawDocument({ status: invalidStatus });
        await expectWriteRejectedByPersistence(() =>
          Application.collection.insertOne(doc),
        );
      }
    });
  });

  describe("Assignment representation and legacy V9 compatibility", () => {
    it("persists Direct Application Unassigned as assignedRecruiterCompanyMemberId=null", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.unassigned-null@example.com",
      });

      const application = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId: new mongoose.Types.ObjectId(),
        }),
      );

      expect(application.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(application.assignedRecruiterCompanyMemberId).toBeNull();
      expect(application.version).toBe(0);
      expect(application.toObject()).not.toHaveProperty(
        "sourceRecruiterCompanyMemberId",
      );
      expect(application.toObject()).not.toHaveProperty("assignmentHistory");
      expect(application.toObject()).not.toHaveProperty("statusHistory");
      expect(application.toObject()).not.toHaveProperty("jobSnapshot");
    });

    it("treats legacy absent assignee and explicit null as the same Unassigned business state", async () => {
      const legacyAbsent = buildRawDocument({
        includeAssigneeField: false,
        status: APPLICATION_STATUS.APPLIED,
      });
      const explicitNull = buildRawDocument({
        assignedRecruiterCompanyMemberId: null,
        status: APPLICATION_STATUS.APPLIED,
      });

      await Application.collection.insertOne(legacyAbsent);
      await Application.collection.insertOne(explicitNull);

      const persistedAbsent = await Application.collection.findOne({
        _id: legacyAbsent._id,
      });
      const persistedNull = await Application.collection.findOne({
        _id: explicitNull._id,
      });

      expect(persistedAbsent).not.toHaveProperty(
        "assignedRecruiterCompanyMemberId",
      );
      expect(persistedNull.assignedRecruiterCompanyMemberId).toBeNull();

      // Both representations remain readable and Unassigned under the model.
      const viaModelAbsent = await Application.findById(legacyAbsent._id);
      const viaModelNull = await Application.findById(explicitNull._id);
      expect(viaModelAbsent.assignedRecruiterCompanyMemberId ?? null).toBeNull();
      expect(viaModelNull.assignedRecruiterCompanyMemberId).toBeNull();
    });

    it("accepts APPLIED and WITHDRAWN with either Unassigned or Assigned", async () => {
      const assigneeId = new mongoose.Types.ObjectId();

      const appliedUnassigned = buildRawDocument({
        status: APPLICATION_STATUS.APPLIED,
        assignedRecruiterCompanyMemberId: null,
      });
      const appliedAssigned = buildRawDocument({
        status: APPLICATION_STATUS.APPLIED,
        assignedRecruiterCompanyMemberId: assigneeId,
        version: 1,
      });
      const withdrawnUnassigned = buildRawDocument({
        status: APPLICATION_STATUS.WITHDRAWN,
        assignedRecruiterCompanyMemberId: null,
        withdrawnAt: WITHDRAWN_AT,
        version: 1,
      });
      const withdrawnAssigned = buildRawDocument({
        status: APPLICATION_STATUS.WITHDRAWN,
        assignedRecruiterCompanyMemberId: assigneeId,
        withdrawnAt: WITHDRAWN_AT,
        version: 2,
      });

      await Application.collection.insertOne(appliedUnassigned);
      await Application.collection.insertOne(appliedAssigned);
      await Application.collection.insertOne(withdrawnUnassigned);
      await Application.collection.insertOne(withdrawnAssigned);

      expect(
        await Application.collection.countDocuments({
          _id: {
            $in: [
              appliedUnassigned._id,
              appliedAssigned._id,
              withdrawnUnassigned._id,
              withdrawnAssigned._id,
            ],
          },
        }),
      ).toBe(4);
    });
  });

  describe("Local status × assignment state matrix", () => {
    const assigneeId = new mongoose.Types.ObjectId();

    const localInvariantInput = ({
      status,
      assignedRecruiterCompanyMemberId = null,
      withdrawnAt = null,
      withdrawReason = null,
      version = 1,
    }) => ({
      status,
      assignedRecruiterCompanyMemberId,
      withdrawnAt,
      withdrawReason,
      version,
      submittedCvSnapshot: buildUploadedSnapshot(),
    });

    it("exports HIRED and REJECTED as the only statuses that require a final Assignee", () => {
      expect([...APPLICATION_STATUSES_REQUIRING_ASSIGNEE]).toEqual(
        TERMINAL_STATUSES_REQUIRING_FINAL_ASSIGNEE,
      );
      for (const status of NON_TERMINAL_STATUSES) {
        expect(APPLICATION_STATUSES_REQUIRING_ASSIGNEE).not.toContain(status);
      }
      expect(APPLICATION_STATUSES_REQUIRING_ASSIGNEE).not.toContain(
        APPLICATION_STATUS.WITHDRAWN,
      );
    });

    it("allows every non-terminal status with Unassigned or Assigned at the local invariant", () => {
      for (const status of NON_TERMINAL_STATUSES) {
        expect(
          assertApplicationLocalInvariants(
            localInvariantInput({
              status,
              assignedRecruiterCompanyMemberId: null,
            }),
          ),
        ).toEqual([]);
        expect(
          assertApplicationLocalInvariants(
            localInvariantInput({
              status,
              assignedRecruiterCompanyMemberId: assigneeId,
            }),
          ),
        ).toEqual([]);
      }
    });

    it("allows WITHDRAWN with Unassigned or Assigned at the local invariant", () => {
      expect(
        assertApplicationLocalInvariants(
          localInvariantInput({
            status: APPLICATION_STATUS.WITHDRAWN,
            assignedRecruiterCompanyMemberId: null,
            withdrawnAt: WITHDRAWN_AT,
          }),
        ),
      ).toEqual([]);
      expect(
        assertApplicationLocalInvariants(
          localInvariantInput({
            status: APPLICATION_STATUS.WITHDRAWN,
            assignedRecruiterCompanyMemberId: assigneeId,
            withdrawnAt: WITHDRAWN_AT,
          }),
        ),
      ).toEqual([]);
    });

    it("rejects HIRED and REJECTED without a final Assignee at the local invariant", () => {
      for (const status of TERMINAL_STATUSES_REQUIRING_FINAL_ASSIGNEE) {
        const errorsForNull = assertApplicationLocalInvariants(
          localInvariantInput({
            status,
            assignedRecruiterCompanyMemberId: null,
          }),
        );
        const absentAssignee = localInvariantInput({ status });
        delete absentAssignee.assignedRecruiterCompanyMemberId;
        const errorsForAbsent =
          assertApplicationLocalInvariants(absentAssignee);

        expect(errorsForNull).toContain(
          `${status} Application must have assignedRecruiterCompanyMemberId`,
        );
        expect(errorsForAbsent).toContain(
          `${status} Application must have assignedRecruiterCompanyMemberId`,
        );
      }
    });

    it("persists every Unassigned-capable status with explicit null or legacy absent assignee", async () => {
      const statusesAllowingUnassigned = [
        ...NON_TERMINAL_STATUSES,
        APPLICATION_STATUS.WITHDRAWN,
      ];

      for (const status of statusesAllowingUnassigned) {
        const withdrawnAt =
          status === APPLICATION_STATUS.WITHDRAWN ? WITHDRAWN_AT : null;
        const explicitNull = buildRawDocument({
          status,
          assignedRecruiterCompanyMemberId: null,
          withdrawnAt,
          version: 1,
        });
        const legacyAbsent = buildRawDocument({
          status,
          includeAssigneeField: false,
          withdrawnAt,
          version: 1,
        });

        await Application.collection.insertOne(explicitNull);
        await Application.collection.insertOne(legacyAbsent);

        const persistedNull = await Application.collection.findOne({
          _id: explicitNull._id,
        });
        const persistedAbsent = await Application.collection.findOne({
          _id: legacyAbsent._id,
        });

        expect(persistedNull.status).toBe(status);
        expect(persistedNull.assignedRecruiterCompanyMemberId).toBeNull();
        expect(persistedAbsent.status).toBe(status);
        expect(persistedAbsent).not.toHaveProperty(
          "assignedRecruiterCompanyMemberId",
        );
      }
    });

    it("persists every Recruitment Status with a current Assignee reference", async () => {
      for (const status of V10_STATUS_VALUES) {
        const doc = buildRawDocument({
          status,
          assignedRecruiterCompanyMemberId: assigneeId,
          withdrawnAt:
            status === APPLICATION_STATUS.WITHDRAWN ? WITHDRAWN_AT : null,
          version: 1,
        });
        await Application.collection.insertOne(doc);

        const persisted = await Application.collection.findOne({ _id: doc._id });
        expect(persisted.status).toBe(status);
        expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
          assigneeId.toString(),
        );
      }
    });

    it("rejects HIRED and REJECTED when assignee is null or absent at the collection boundary", async () => {
      for (const status of TERMINAL_STATUSES_REQUIRING_FINAL_ASSIGNEE) {
        await expectWriteRejectedByPersistence(() =>
          Application.collection.insertOne(
            buildRawDocument({
              status,
              assignedRecruiterCompanyMemberId: null,
              version: 1,
            }),
          ),
        );

        await expectWriteRejectedByPersistence(() =>
          Application.collection.insertOne(
            buildRawDocument({
              status,
              includeAssigneeField: false,
              version: 1,
            }),
          ),
        );
      }
    });

    it("allows mongoose save of every Unassigned-capable status", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.matrix-save-unassigned-pipeline@example.com",
      });
      const statusesAllowingUnassigned = [
        ...NON_TERMINAL_STATUSES,
        APPLICATION_STATUS.WITHDRAWN,
      ];

      for (const status of statusesAllowingUnassigned) {
        const application = await Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId: new mongoose.Types.ObjectId(),
          }),
        );

        application.status = status;
        application.withdrawnAt =
          status === APPLICATION_STATUS.WITHDRAWN ? WITHDRAWN_AT : null;
        application.version = 1;
        await application.save();

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.status).toBe(status);
        expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
        expect(persisted.version).toBe(1);
      }
    });

    it("allows mongoose save of every Recruitment Status after Assignee is set", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.matrix-save-assigned@example.com",
      });

      for (const status of V10_STATUS_VALUES) {
        const application = await Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId: new mongoose.Types.ObjectId(),
          }),
        );

        application.status = status;
        application.assignedRecruiterCompanyMemberId = assigneeId;
        application.withdrawnAt =
          status === APPLICATION_STATUS.WITHDRAWN ? WITHDRAWN_AT : null;
        application.version = 1;
        await application.save();

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.status).toBe(status);
        expect(persisted.assignedRecruiterCompanyMemberId.toString()).toBe(
          assigneeId.toString(),
        );
        expect(persisted.version).toBe(1);
      }
    });

    it("rejects mongoose save that moves APPLIED Unassigned into HIRED or REJECTED without Assignee", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.matrix-save-hired-unassigned@example.com",
      });

      for (const status of TERMINAL_STATUSES_REQUIRING_FINAL_ASSIGNEE) {
        const application = await Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId: new mongoose.Types.ObjectId(),
          }),
        );

        application.status = status;
        application.version = 1;

        await expectWriteRejectedByPersistence(() => application.save());

        const persisted = await Application.findById(application._id).lean();
        expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
        expect(persisted.assignedRecruiterCompanyMemberId).toBeNull();
      }
    });
  });

  describe("Direct Application creation remains V9-compatible", () => {
    it("rejects Direct Application creation with pipeline/terminal statuses even when Assignee is present", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.create-pipeline@example.com",
      });
      const assigneeId = new mongoose.Types.ObjectId();

      for (const status of V10_STATUS_VALUES.filter(
        (value) => value !== APPLICATION_STATUS.APPLIED,
      )) {
        await expectWriteRejectedByPersistence(() =>
          Application.create(
            buildApplicationFields({
              candidateUserId: user._id,
              jobId: new mongoose.Types.ObjectId(),
              status,
              assignedRecruiterCompanyMemberId: assigneeId,
              withdrawnAt:
                status === APPLICATION_STATUS.WITHDRAWN ? WITHDRAWN_AT : null,
              version: status === APPLICATION_STATUS.APPLIED ? 0 : 1,
            }),
          ),
        );
      }
    });

    it("rejects Direct Application creation that starts Assigned", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.create-assigned@example.com",
      });

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId: new mongoose.Types.ObjectId(),
            status: APPLICATION_STATUS.APPLIED,
            assignedRecruiterCompanyMemberId: new mongoose.Types.ObjectId(),
            version: 0,
          }),
        ),
      );
    });

    it("preserves Candidate–Job uniqueness and version CAS foundation", async () => {
      const { user } = await createVerifiedUser({
        email: "v10.uniqueness-cas@example.com",
      });
      const jobId = new mongoose.Types.ObjectId();

      const first = await Application.create(
        buildApplicationFields({
          candidateUserId: user._id,
          jobId,
        }),
      );

      expect(first.version).toBe(0);

      await expectWriteRejectedByPersistence(() =>
        Application.create(
          buildApplicationFields({
            candidateUserId: user._id,
            jobId,
          }),
        ),
      );

      first.version = 1;
      await first.save();

      const persisted = await Application.findById(first._id).lean();
      expect(persisted.version).toBe(1);
      expect(persisted.candidateUserId.toString()).toBe(user._id.toString());
      expect(persisted.jobId.toString()).toBe(jobId.toString());
      expect(persisted.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
      expect(persisted.submittedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      );
    });
  });

  describe("Canonical V10 Application indexes", () => {
    it("keeps Candidate–Job uniqueness and creates IDX-A02 through IDX-A05", async () => {
      await Application.init();
      const indexes = await Application.collection.indexes();

      const hasUniqueCandidateJob = indexes.some(
        (index) =>
          index.unique === true &&
          indexKeyEquals(index.key, { candidateUserId: 1, jobId: 1 }),
      );
      const hasJobStatus = indexes.some((index) =>
        indexKeyEquals(index.key, { jobId: 1, status: 1 }),
      );
      const hasJobAssignee = indexes.some((index) =>
        indexKeyEquals(index.key, {
          jobId: 1,
          assignedRecruiterCompanyMemberId: 1,
        }),
      );
      const hasAssigneeStatus = indexes.some((index) =>
        indexKeyEquals(index.key, {
          assignedRecruiterCompanyMemberId: 1,
          status: 1,
        }),
      );
      const hasCandidateStatus = indexes.some((index) =>
        indexKeyEquals(index.key, { candidateUserId: 1, status: 1 }),
      );

      expect(hasUniqueCandidateJob).toBe(true);
      expect(hasJobStatus).toBe(true);
      expect(hasJobAssignee).toBe(true);
      expect(hasAssigneeStatus).toBe(true);
      expect(hasCandidateStatus).toBe(true);
    });
  });
});
