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

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
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
import { inspectUploadedCandidateCvPdf } from "../../src/services/candidate-cv-uploaded-pdf.service.js";
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

const createPositionCategory = async ({
  name = "Backend Engineer",
  parentCategoryId,
}) => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.POSITION,
    parentCategoryId,
  });
};

const createExperienceLevel = async (
  code = EXPERIENCE_LEVEL.ONE_TO_THREE_YEARS,
) => {
  return ExperienceLevel.create({
    code,
  });
};

const buildPdfBuffer = async (pageCount = 1) => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }

  return Buffer.from(await document.save());
};

const buildEncryptedPdfBuffer = () => {
  return Buffer.from(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj
4 0 obj<< /Filter /Standard /V 1 /R 2 /Length 40 /O <00> /U <00> /P -4 >>endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000190 00000 n 
trailer<< /Size 5 /Root 1 0 R /Encrypt 4 0 R >>
startxref
280
%%EOF`);
};

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
  0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
  0x00, 0x05, 0xfe, 0x02, 0xfe, 0xa7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00,
  0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("V7 Slice 06 — Uploaded CV creation (F05)", () => {
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

  describe("PDF inspection ownership", () => {
    it("accepts a real unencrypted PDF within exact size and page limits", async () => {
      const buffer = await buildPdfBuffer(3);
      const inspected = await inspectUploadedCandidateCvPdf(buffer);

      expect(inspected).toEqual({
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: buffer.length,
        pageCount: 3,
      });
      expect(CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
      expect(CANDIDATE_CV_UPLOADED_PDF.MAX_PAGE_COUNT).toBe(20);
    });

    it("rejects non-PDF bytes even when client would claim application/pdf", async () => {
      await expect(inspectUploadedCandidateCvPdf(pngBuffer)).rejects.toMatchObject(
        {
          statusCode: 415,
          message: expect.stringMatching(/valid PDF/i),
        },
      );
    });

    it("rejects password-protected PDFs", async () => {
      await expect(
        inspectUploadedCandidateCvPdf(buildEncryptedPdfBuffer()),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/password/i),
      });
    });

    it("rejects PDFs over 20 pages", async () => {
      const buffer = await buildPdfBuffer(21);

      await expect(inspectUploadedCandidateCvPdf(buffer)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringMatching(/20 pages/i),
      });
    });

    it("rejects buffers larger than the exact Candidate CV 10 MB limit", async () => {
      const oversized = Buffer.alloc(
        CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_BYTES + 1,
        0x25,
      );

      await expect(inspectUploadedCandidateCvPdf(oversized)).rejects.toMatchObject(
        {
          statusCode: 400,
          message: expect.stringMatching(/10 MB/i),
        },
      );
    });
  });

  describe("HTTP create Uploaded CV", () => {
    it("creates UPLOADED/ACTIVE with validated file metadata and canonical optional fields", async () => {
      const uploadSpy = vi
        .spyOn(fileService, "uploadFileBuffer")
        .mockResolvedValue({
          publicId: "jobhub/candidate-cvs/uploaded/demo-cv",
          bytes: 1234,
          resourceType: "raw",
        });
      const deleteSpy = vi.spyOn(fileService, "deleteFile");

      const { user } = await createVerifiedUser({
        email: "cv.uploaded.create@example.com",
      });
      const field = await createFieldCategory();
      const position = await createPositionCategory({
        parentCategoryId: field._id,
      });
      const experienceLevel = await createExperienceLevel();
      const pdfBuffer = await buildPdfBuffer(2);
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "My Uploaded CV")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PUBLIC)
        .field("categoryId", position._id.toString())
        .field("experienceLevelId", experienceLevel._id.toString())
        .field(
          "preferredLocations",
          JSON.stringify([LOCATION.HA_NOI, LOCATION.HO_CHI_MINH]),
        )
        .field("skillTags", JSON.stringify(["Node.js", "PDF"]))
        .field(
          "employmentTypes",
          JSON.stringify([EMPLOYMENT_TYPE.FULL_TIME]),
        )
        .field(
          "workModes",
          JSON.stringify([WORK_MODE.REMOTE, WORK_MODE.HYBRID]),
        )
        .attach("file", pdfBuffer, {
          filename: "resume.pdf",
          contentType: "application/octet-stream",
        });

      expect(response.status).toBe(201);
      expect(response.body.cv).toMatchObject({
        candidateUserId: user._id.toString(),
        name: "My Uploaded CV",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        status: CANDIDATE_CV_STATUS.ACTIVE,
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
        categoryId: position._id.toString(),
        experienceLevelId: experienceLevel._id.toString(),
        preferredLocations: [LOCATION.HA_NOI, LOCATION.HO_CHI_MINH],
        skillTags: ["Node.js", "PDF"],
        employmentTypes: [EMPLOYMENT_TYPE.FULL_TIME],
        workModes: [WORK_MODE.REMOTE, WORK_MODE.HYBRID],
        isDefault: false,
        archivedAt: null,
        generatedContent: null,
        uploadedFile: {
          storageKey: "jobhub/candidate-cvs/uploaded/demo-cv",
          originalFileName: "resume.pdf",
          mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
          sizeBytes: pdfBuffer.length,
          pageCount: 2,
        },
      });
      expect(response.body.cv.uploadedFile.uploadedAt).toBeTruthy();
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).not.toHaveBeenCalled();

      const persisted = await CandidateCV.findById(response.body.cv.id);
      expect(persisted.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.UPLOADED);
      expect(persisted.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
      expect(persisted.generatedContent).toBeUndefined();
      expect(persisted.uploadedFile.storageKey).toBe(
        "jobhub/candidate-cvs/uploaded/demo-cv",
      );
      expect(persisted.uploadedFile.pageCount).toBe(2);

      const listResponse = await agent
        .get("/api/candidate/cvs")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.cvs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: response.body.cv.id,
            sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
            status: CANDIDATE_CV_STATUS.ACTIVE,
          }),
        ]),
      );
    });

    it("rejects REMOTE as preferred location while accepting it as WorkMode", async () => {
      vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/unused",
      });

      const { user } = await createVerifiedUser({
        email: "cv.uploaded.remote@example.com",
      });
      const category = await createFieldCategory("Remote Field");
      const pdfBuffer = await buildPdfBuffer(1);
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const remoteLocation = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "Remote Location CV")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .field("preferredLocations", JSON.stringify(["REMOTE"]))
        .attach("file", pdfBuffer, "resume.pdf");

      expect(remoteLocation.status).toBe(400);
      expect(await CandidateCV.countDocuments()).toBe(0);

      const remoteWorkMode = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "Remote WorkMode CV")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .field("workModes", JSON.stringify([WORK_MODE.REMOTE]))
        .attach("file", pdfBuffer, "resume.pdf");

      expect(remoteWorkMode.status).toBe(201);
      expect(remoteWorkMode.body.cv.workModes).toEqual([WORK_MODE.REMOTE]);
    });

    it("does not create CandidateCV when PDF validation fails", async () => {
      const uploadSpy = vi.spyOn(fileService, "uploadFileBuffer");
      const { user } = await createVerifiedUser({
        email: "cv.uploaded.invalid@example.com",
      });
      const category = await createFieldCategory("Invalid");
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "Bad File")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .attach("file", pngBuffer, {
          filename: "fake.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(415);
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("does not leave a CandidateCV when persistence fails after external upload", async () => {
      const uploadSpy = vi
        .spyOn(fileService, "uploadFileBuffer")
        .mockResolvedValue({
          publicId: "jobhub/candidate-cvs/uploaded/orphan",
          resourceType: "raw",
        });
      const deleteSpy = vi
        .spyOn(fileService, "deleteFile")
        .mockResolvedValue({
          publicId: "jobhub/candidate-cvs/uploaded/orphan",
          result: "ok",
        });
      vi.spyOn(CandidateCV, "create").mockRejectedValue(
        new Error("simulated persistence failure"),
      );

      const { user } = await createVerifiedUser({
        email: "cv.uploaded.orphan@example.com",
      });
      const category = await createFieldCategory("Orphan");
      const pdfBuffer = await buildPdfBuffer(1);
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });

      const response = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "Orphan Risk")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .attach("file", pdfBuffer, "resume.pdf");

      expect(response.status).toBe(500);
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith({
        publicId: "jobhub/candidate-cvs/uploaded/orphan",
        resourceType: "raw",
      });
      expect(await CandidateCV.countDocuments()).toBe(0);
    });

    it("rejects missing required metadata and unauthorized actors", async () => {
      vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
        publicId: "jobhub/candidate-cvs/uploaded/unused",
      });

      const { user } = await createVerifiedUser({
        email: "cv.uploaded.guards@example.com",
      });
      await createVerifiedUser({
        email: "cv.uploaded.admin@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
        fullName: "Admin",
      });
      const category = await createFieldCategory("Guards");
      const pdfBuffer = await buildPdfBuffer(1);
      const agent = createTestAgent();
      const accessToken = await loginAndGetAccessToken(agent, {
        email: user.email,
      });
      const adminToken = await loginAndGetAccessToken(agent, {
        email: "cv.uploaded.admin@example.com",
      });

      const missingName = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .attach("file", pdfBuffer, "resume.pdf");
      const missingFile = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${accessToken}`)
        .field("name", "No File")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString());
      const adminAttempt = await agent
        .post("/api/candidate/cvs/uploaded")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Admin CV")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .attach("file", pdfBuffer, "resume.pdf");
      const anonymousAttempt = await agent
        .post("/api/candidate/cvs/uploaded")
        .field("name", "Anon CV")
        .field("visibility", CANDIDATE_CV_VISIBILITY.PRIVATE)
        .field("categoryId", category._id.toString())
        .attach("file", pdfBuffer, "resume.pdf");

      expect(missingName.status).toBe(400);
      expect(missingFile.status).toBe(400);
      expect(adminAttempt.status).toBe(403);
      expect(anonymousAttempt.status).toBe(401);
      expect(await CandidateCV.countDocuments()).toBe(0);
    });
  });
});
