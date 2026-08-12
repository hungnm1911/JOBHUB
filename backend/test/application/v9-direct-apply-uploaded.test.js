import { PDFDocument } from "pdf-lib";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_ROLE from "../../src/constants/user-role.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Job from "../../src/models/job.model.js";
import { directApplyToJob } from "../../src/services/application.service.js";
import * as fileService from "../../src/services/file.service.js";
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

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const buildPdfBuffer = async (pageCount = 1) => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }

  return Buffer.from(await document.save());
};

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingIds = [],
  applicationDeadline = FUTURE_DEADLINE(),
  title = "Backend Engineer",
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline,
    title,
    description: "Build APIs",
    skills: ["Node.js"],
    salaryMin: 1000,
    salaryMax: 2000,
    categoryIds: [],
    locations: [],
    employmentTypes: [],
    workModes: [],
    experienceLevelId: null,
  });
};

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  name = "Uploaded CV",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  uploadedFile = {
    storageKey: "jobhub/candidate-cvs/uploaded/source-file",
    originalFileName: "resume.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
    uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
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
    isDefault: false,
    archivedAt: null,
    uploadedFile,
  });
};

const mockSnapshotUpload = (publicId = "jobhub/applications/submitted-cv-snapshots/uploaded-snapshot.pdf") => {
  vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
    assetId: "asset-uploaded",
    publicId,
    resourceType: "raw",
    deliveryType: "authenticated",
    format: "pdf",
    bytes: 2048,
    width: null,
    height: null,
    secureUrl: "https://example.invalid/uploaded-snapshot.pdf",
    version: 1,
    assetFolder: "jobhub/applications/submitted-cv-snapshots",
  });
};

const mockUploadedSourceDownload = (pdfBuffer) => {
  vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);
};

describe("V9 Slice 03 — Direct Apply with Uploaded CV (F01–F03)", () => {
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

  describe("happy path", () => {
    it.each([
      CANDIDATE_CV_VISIBILITY.PRIVATE,
      CANDIDATE_CV_VISIBILITY.PUBLIC,
    ])(
      "creates APPLIED Direct Application with captured Uploaded snapshot for %s visibility",
      async (visibility) => {
        const pdfBuffer = await buildPdfBuffer(2);
        mockUploadedSourceDownload(pdfBuffer);
        mockSnapshotUpload();

        const { user } = await createVerifiedUser({
          email: `apply.uploaded.${visibility.toLowerCase()}@example.com`,
        });
        const manager = await createActiveCompanyManagerContext({
          email: `manager.uploaded.${visibility.toLowerCase()}@example.com`,
          businessRegistrationNumber: `BRN-V9-UP-${visibility}`,
        });
        const recruiter = await createActiveRecruiterContext({
          email: `recruiter.uploaded.${visibility.toLowerCase()}@example.com`,
          company: manager.company,
          employeeCode: `NV-V9-UP-${visibility}`,
        });
        const job = await createPublishedJob({
          companyId: manager.company._id,
          primaryMemberId: recruiter.membership._id,
        });
        const category = await createFieldCategory();
        const candidateCv = await createUploadedCv({
          candidateUserId: user._id,
          categoryId: category._id,
          name: "My Uploaded CV",
          visibility,
        });

        const agent = createTestAgent();
        const accessToken = await loginAndGetAccessToken(agent, {
          email: user.email,
        });

        const response = await agent
          .post("/api/candidate/applications")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            jobId: job._id.toString(),
            candidateCvId: candidateCv._id.toString(),
          });

        expect(response.status).toBe(201);
        expect(response.body.application).toMatchObject({
          candidateUserId: user._id.toString(),
          jobId: job._id.toString(),
          source: APPLICATION_SOURCE.DIRECT_APPLICATION,
          status: APPLICATION_STATUS.APPLIED,
          version: 0,
          withdrawnAt: null,
          withdrawReason: null,
        });
        expect(response.body.application.submittedCvSnapshot).toMatchObject({
          sourceCandidateCvId: candidateCv._id.toString(),
          name: "My Uploaded CV",
          sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
          pdfFile: {
            originalFileName: "resume.pdf",
            mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
            pageCount: 2,
            sizeBytes: 2048,
          },
        });
        expect(
          response.body.application.submittedCvSnapshot,
        ).not.toHaveProperty("generatedContent");
        expect(
          response.body.application.submittedCvSnapshot.pdfFile,
        ).not.toHaveProperty("storageKey");

        const persisted = await Application.findOne({
          candidateUserId: user._id,
          jobId: job._id,
        }).lean();
        expect(persisted.submittedCvSnapshot.sourceType).toBe(
          CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        );
        expect(persisted.submittedCvSnapshot).not.toHaveProperty(
          "generatedContent",
        );
        expect(persisted.submittedCvSnapshot.pdfFile.storageKey).toBe(
          "jobhub/applications/submitted-cv-snapshots/uploaded-snapshot.pdf",
        );
        expect(fileService.downloadFileBuffer).toHaveBeenCalledWith(
          expect.objectContaining({
            publicId: "jobhub/candidate-cvs/uploaded/source-file",
            deliveryType: "authenticated",
          }),
        );
        expect(fileService.uploadFileBuffer).toHaveBeenCalledWith(
          expect.objectContaining({
            buffer: pdfBuffer,
            deliveryType: "authenticated",
          }),
        );
      },
    );

    it("supports upload-first flow via canonical V7 create then Direct Apply", async () => {
      const pdfBuffer = await buildPdfBuffer(1);
      const uploadSpy = vi
        .spyOn(fileService, "uploadFileBuffer")
        .mockResolvedValueOnce({
          publicId: "jobhub/candidate-cvs/uploaded/upload-first",
          resourceType: "raw",
        })
        .mockResolvedValueOnce({
          publicId: "jobhub/applications/submitted-cv-snapshots/upload-first-snapshot",
          resourceType: "raw",
        });
      vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(pdfBuffer);

      const { user } = await createVerifiedUser({
        email: "apply.upload-first@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.upload-first@example.com",
        businessRegistrationNumber: "BRN-V9-UPLOAD-FIRST",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.upload-first@example.com",
        company: manager.company,
        employeeCode: "NV-V9-UPLOAD-FIRST",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const createResponse = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "Upload First CV")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .attach("file", pdfBuffer, {
          filename: "upload-first.pdf",
          contentType: "application/octet-stream",
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.cv.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      );

      const applyResponse = await agent
        .post("/api/candidate/applications")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          jobId: job._id.toString(),
          candidateCvId: createResponse.body.cv.id,
        });

      expect(applyResponse.status).toBe(201);
      expect(applyResponse.body.application.submittedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      );
      expect(
        applyResponse.body.application.submittedCvSnapshot.pdfFile
          .originalFileName,
      ).toBe("upload-first.pdf");
      expect(uploadSpy).toHaveBeenCalledTimes(2);
      expect(await Application.countDocuments()).toBe(1);
      expect(await CandidateCV.countDocuments()).toBe(1);
    });
  });

  describe("snapshot independence and uniqueness", () => {
    it("keeps submitted snapshot unchanged after Uploaded PDF replacement and rename", async () => {
      const originalPdfBuffer = await buildPdfBuffer(2);
      const replacementPdfBuffer = await buildPdfBuffer(3);
      vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(
        originalPdfBuffer,
      );
      vi.spyOn(fileService, "uploadFileBuffer")
        .mockResolvedValueOnce({
          publicId: "jobhub/applications/submitted-cv-snapshots/frozen.pdf",
          resourceType: "raw",
        })
        .mockResolvedValueOnce({
          publicId: "jobhub/candidate-cvs/uploaded/replacement-file",
          resourceType: "raw",
        });
      vi.spyOn(fileService, "deleteFile").mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/source-file",
        result: "ok",
      });

      const { user } = await createVerifiedUser({
        email: "apply.uploaded.snapshot@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.uploaded.snapshot@example.com",
        businessRegistrationNumber: "BRN-V9-UP-SNAPSHOT",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.uploaded.snapshot@example.com",
        company: manager.company,
        employeeCode: "NV-V9-UP-SNAPSHOT",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const candidateCv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Original Name",
      });

      const application = await directApplyToJob({
        candidateUserId: user._id,
        actorUser: user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const replaceResponse = await agent
        .put(`/api/candidate/cvs/${candidateCv._id.toString()}/uploaded-file`)
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", replacementPdfBuffer, {
          filename: "replacement.pdf",
          contentType: "application/octet-stream",
        });
      expect(replaceResponse.status).toBe(200);

      const renameResponse = await agent
        .patch(`/api/candidate/cvs/${candidateCv._id.toString()}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Renamed CV" });
      expect(renameResponse.status).toBe(200);

      const persisted = await Application.findById(application.id).lean();
      expect(persisted.submittedCvSnapshot).toMatchObject({
        name: "Original Name",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        pdfFile: {
          storageKey: "jobhub/applications/submitted-cv-snapshots/frozen.pdf",
          originalFileName: "resume.pdf",
          pageCount: 2,
          sizeBytes: 2048,
        },
      });

      const liveCv = await CandidateCV.findById(candidateCv._id).lean();
      expect(liveCv.name).toBe("Renamed CV");
      expect(liveCv.uploadedFile.originalFileName).toBe("replacement.pdf");
      expect(liveCv.uploadedFile.pageCount).toBe(3);
    });

    it("preserves Application snapshot after CandidateCV archive", async () => {
      const pdfBuffer = await buildPdfBuffer(1);
      mockUploadedSourceDownload(pdfBuffer);
      mockSnapshotUpload();

      const { user } = await createVerifiedUser({
        email: "apply.uploaded.archive@example.com",
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.uploaded.archive@example.com",
        businessRegistrationNumber: "BRN-V9-UP-ARCHIVE",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.uploaded.archive@example.com",
        company: manager.company,
        employeeCode: "NV-V9-UP-ARCHIVE",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const candidateCv = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
      });

      const application = await directApplyToJob({
        candidateUserId: user._id,
        actorUser: user,
        jobId: job._id.toString(),
        candidateCvId: candidateCv._id.toString(),
      });

      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const archiveResponse = await agent
        .delete(`/api/candidate/cvs/${candidateCv._id.toString()}`)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(archiveResponse.status).toBe(200);

      const persisted = await Application.findById(application.id).lean();
      expect(persisted.submittedCvSnapshot.sourceType).toBe(
        CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      );
      expect(persisted.submittedCvSnapshot.pdfFile.storageKey).toBeTruthy();
    });

    it("allows only one Application per Candidate–Job under concurrent Uploaded Apply", async () => {
      const pdfBufferA = await buildPdfBuffer(1);
      const pdfBufferB = await buildPdfBuffer(2);
      mockSnapshotUpload();
      vi.spyOn(fileService, "downloadFileBuffer")
        .mockResolvedValueOnce(pdfBufferA)
        .mockResolvedValueOnce(pdfBufferB);

      const { user } = await createVerifiedUser({
        email: "apply.uploaded.concurrent@example.com",
        role: USER_ROLE.CANDIDATE,
      });
      const manager = await createActiveCompanyManagerContext({
        email: "manager.uploaded.concurrent@example.com",
        businessRegistrationNumber: "BRN-V9-UP-CONCURRENT",
      });
      const recruiter = await createActiveRecruiterContext({
        email: "recruiter.uploaded.concurrent@example.com",
        company: manager.company,
        employeeCode: "NV-V9-UP-CONCURRENT",
      });
      const job = await createPublishedJob({
        companyId: manager.company._id,
        primaryMemberId: recruiter.membership._id,
      });
      const category = await createFieldCategory();
      const uploadedCvA = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Uploaded CV A",
        uploadedFile: {
          storageKey: "jobhub/candidate-cvs/uploaded/cv-a",
          originalFileName: "cv-a.pdf",
          mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
          sizeBytes: pdfBufferA.length,
          pageCount: 1,
          uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const uploadedCvB = await createUploadedCv({
        candidateUserId: user._id,
        categoryId: category._id,
        name: "Uploaded CV B",
        uploadedFile: {
          storageKey: "jobhub/candidate-cvs/uploaded/cv-b",
          originalFileName: "cv-b.pdf",
          mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
          sizeBytes: pdfBufferB.length,
          pageCount: 2,
          uploadedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      });

      const outcomes = await Promise.allSettled([
        directApplyToJob({
          candidateUserId: user._id,
          actorUser: user,
          jobId: job._id.toString(),
          candidateCvId: uploadedCvA._id.toString(),
        }),
        directApplyToJob({
          candidateUserId: user._id,
          actorUser: user,
          jobId: job._id.toString(),
          candidateCvId: uploadedCvB._id.toString(),
        }),
      ]);

      const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
      const rejected = outcomes.filter((result) => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        statusCode: 409,
      });

      const applications = await Application.find({
        candidateUserId: user._id,
        jobId: job._id,
      });
      expect(applications).toHaveLength(1);
    });
  });
});
