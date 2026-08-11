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
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import USER_ROLE from "../../src/constants/user-role.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
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

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const buildPdfBuffer = async (pageCount = 1, marker = "uploaded-cv") => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([400, 600]);
    page.drawText(`${marker}-${index + 1}`, {
      x: 40,
      y: 500,
      size: 12,
    });
  }

  return Buffer.from(await document.save());
};

const incompleteGeneratedContent = () => {
  return {
    personalInfo: {
      fullName: "Draft Candidate",
      email: null,
      phone: null,
      displayLocation: null,
      links: [],
      avatarUrl: null,
    },
    professionalSummary: "Partial draft summary",
    educations: [
      {
        institutionName: "Draft University",
      },
    ],
    skills: [],
    workExperiences: [],
    projects: [],
    certifications: [],
    languages: [],
    hiddenSections: ["projects"],
  };
};

const completeGeneratedContent = () => {
  return {
    personalInfo: {
      fullName: "Active Candidate",
      email: "active@example.com",
      phone: "+84901234567",
      displayLocation: "Ha Noi",
      links: ["https://example.com"],
      avatarUrl: null,
    },
    professionalSummary: "Complete professional summary",
    educations: [
      {
        institutionName: "Example University",
        degree: "BSc",
        fieldOfStudy: "CS",
        startDate: "2018",
        endDate: "2022",
      },
    ],
    skills: ["Node.js", "MongoDB"],
    workExperiences: [
      {
        companyName: "Example Co",
        position: "Engineer",
        startDate: "2022",
        endDate: "2024",
        description: "Built APIs",
        achievements: ["Shipped V7"],
      },
    ],
    projects: [
      {
        name: "JobHub",
        role: "Backend",
        technologies: ["Node.js"],
        description: "Recruitment platform",
        projectUrl: "https://example.com/jobhub",
      },
    ],
    certifications: [
      {
        name: "AWS Certified",
        issuer: "Amazon",
        issueDate: "2023",
      },
    ],
    languages: [
      {
        name: "English",
        proficiency: CV_LANGUAGE_PROFICIENCY.FLUENT,
      },
    ],
    hiddenSections: [],
  };
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  status = CANDIDATE_CV_STATUS.DRAFT,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  isDefault = false,
  archivedAt = null,
  generatedContent = incompleteGeneratedContent(),
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
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault,
    archivedAt,
    generatedContent,
  });
};

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  name = "Uploaded CV",
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  isDefault = false,
  archivedAt = null,
  uploadedFile = {
    storageKey: "jobhub/candidate-cvs/uploaded/current-file",
    originalFileName: "current-resume.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 1,
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
    isDefault,
    archivedAt,
    uploadedFile,
  });
};

const assertPdfResponse = (response, { dispositionPrefix }) => {
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toMatch(/application\/pdf/);
  expect(response.headers["content-disposition"]).toContain(dispositionPrefix);
  expect(response.headers["cache-control"]).toContain("private");
  expect(Buffer.isBuffer(response.body) || response.body instanceof Buffer).toBe(
    true,
  );
  expect(response.body.length).toBeGreaterThan(100);
  expect(response.body.subarray(0, 4).toString("utf8")).toBe("%PDF");
  expect(response.text ?? "").not.toContain("publicUrl");
  expect(response.text ?? "").not.toContain("secureUrl");
  expect(response.text ?? "").not.toContain("cloudinary");
};

describe("V7 Slice 09 — Preview + Download Candidate CV (F08)", () => {
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

  it("previews Generated DRAFT incomplete content without mutating lifecycle state", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.preview.draft@example.com",
    });
    const category = await createFieldCategory("Preview Draft");
    const draftCv = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Incomplete Draft",
      status: CANDIDATE_CV_STATUS.DRAFT,
      generatedContent: incompleteGeneratedContent(),
    });
    const before = await CandidateCV.findById(draftCv._id).lean();

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .get(`/api/candidate/cvs/${draftCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assertPdfResponse(response, { dispositionPrefix: "inline" });

    const after = await CandidateCV.findById(draftCv._id).lean();
    expect(after.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(after.isDefault).toBe(false);
    expect(after.visibility).toBe(before.visibility);
    expect(after.archivedAt).toBeNull();
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
    expect(after.generatedContent.personalInfo.fullName).toBe("Draft Candidate");
    expect(after.generatedContent.skills).toEqual([]);
  });

  it("previews and officially downloads Generated ACTIVE from Harvard content", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.preview.active@example.com",
    });
    const category = await createFieldCategory("Preview Active");
    const activeCv = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      name: "Active Generated",
      status: CANDIDATE_CV_STATUS.ACTIVE,
      generatedContent: completeGeneratedContent(),
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const previewResponse = await agent
      .get(`/api/candidate/cvs/${activeCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assertPdfResponse(previewResponse, { dispositionPrefix: "inline" });

    const downloadResponse = await agent
      .get(`/api/candidate/cvs/${activeCv._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assertPdfResponse(downloadResponse, { dispositionPrefix: "attachment" });
    expect(downloadResponse.headers["content-disposition"]).toMatch(
      /Active Generated\.pdf/i,
    );

    const after = await CandidateCV.findById(activeCv._id).lean();
    expect(after.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
    expect(after).not.toHaveProperty("generatedPdf");
    expect(after).not.toHaveProperty("publicUrl");
    expect(after).not.toHaveProperty("publicDownloadUrl");
  });

  it("denies official PDF download for Generated DRAFT", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.download.draft.deny@example.com",
    });
    const category = await createFieldCategory("Download Draft Deny");
    const draftCv = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      status: CANDIDATE_CV_STATUS.DRAFT,
      generatedContent: completeGeneratedContent(),
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .get(`/api/candidate/cvs/${draftCv._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/DRAFT/i);
    expect(response.body.error.details?.field).toBe("status");

    const after = await CandidateCV.findById(draftCv._id).lean();
    expect(after.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
  });

  it("previews and downloads current Uploaded PDF after replacement storageKey", async () => {
    const currentPdf = await buildPdfBuffer(1, "current-file");
    const downloadSpy = vi
      .spyOn(fileService, "downloadFileBuffer")
      .mockResolvedValue(currentPdf);

    const { user } = await createVerifiedUser({
      email: "cv.uploaded.delivery@example.com",
    });
    const category = await createFieldCategory("Uploaded Delivery");
    const uploadedCv = await createUploadedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/new-current",
        originalFileName: "new-current.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: currentPdf.length,
        pageCount: 1,
        uploadedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const previewResponse = await agent
      .get(`/api/candidate/cvs/${uploadedCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assertPdfResponse(previewResponse, { dispositionPrefix: "inline" });
    expect(previewResponse.body.equals(currentPdf)).toBe(true);
    expect(downloadSpy).toHaveBeenCalledWith({
      publicId: "jobhub/candidate-cvs/uploaded/new-current",
      resourceType: "raw",
    });

    const downloadResponse = await agent
      .get(`/api/candidate/cvs/${uploadedCv._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assertPdfResponse(downloadResponse, { dispositionPrefix: "attachment" });
    expect(downloadResponse.body.equals(currentPdf)).toBe(true);
    expect(downloadResponse.headers["content-disposition"]).toMatch(
      /new-current\.pdf/i,
    );

    const after = await CandidateCV.findById(uploadedCv._id).lean();
    expect(after.uploadedFile.storageKey).toBe(
      "jobhub/candidate-cvs/uploaded/new-current",
    );
    expect(after).not.toHaveProperty("previousFiles");
    expect(after).not.toHaveProperty("publicUrl");
  });

  it("denies archived and cross-owner preview/download", async () => {
    const { user: owner } = await createVerifiedUser({
      email: "cv.delivery.owner@example.com",
    });
    const { user: peer } = await createVerifiedUser({
      email: "cv.delivery.peer@example.com",
    });
    const category = await createFieldCategory("Delivery Guards");
    const archived = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Archived CV",
      status: CANDIDATE_CV_STATUS.ACTIVE,
      archivedAt: new Date("2026-03-01T00:00:00.000Z"),
      generatedContent: completeGeneratedContent(),
    });
    const owned = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Owned Active",
      status: CANDIDATE_CV_STATUS.ACTIVE,
      generatedContent: completeGeneratedContent(),
    });

    const agent = createTestAgent();
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });
    const peerToken = await loginAndGetAccessToken(agent, {
      email: peer.email,
    });

    const archivedPreview = await agent
      .get(`/api/candidate/cvs/${archived._id}/preview`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const archivedDownload = await agent
      .get(`/api/candidate/cvs/${archived._id}/download`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(archivedPreview.status).toBe(404);
    expect(archivedDownload.status).toBe(404);

    const peerPreview = await agent
      .get(`/api/candidate/cvs/${owned._id}/preview`)
      .set("Authorization", `Bearer ${peerToken}`);
    const peerDownload = await agent
      .get(`/api/candidate/cvs/${owned._id}/download`)
      .set("Authorization", `Bearer ${peerToken}`);

    expect(peerPreview.status).toBe(404);
    expect(peerDownload.status).toBe(404);
  });

  it("keeps PUBLIC visibility intent-only with no anonymous/Recruiter/CM/Admin access", async () => {
    const downloadSpy = vi
      .spyOn(fileService, "downloadFileBuffer")
      .mockResolvedValue(await buildPdfBuffer(1, "public-cv"));

    const { user: owner } = await createVerifiedUser({
      email: "cv.public.owner@example.com",
    });
    const manager = await createActiveCompanyManagerContext({
      email: "cv.public.manager@example.com",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "cv.public.recruiter@example.com",
      company: manager.company,
    });
    await createVerifiedUser({
      email: "cv.public.admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
      fullName: "Platform Admin",
    });
    const category = await createFieldCategory("Public Boundary");
    const publicUploaded = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/public-current",
        originalFileName: "public-current.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 1024,
        pageCount: 1,
        uploadedAt: new Date("2026-01-15T00:00:00.000Z"),
      },
    });

    const agent = createTestAgent();
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
    });
    const recruiterToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "cv.public.admin@example.com",
    });

    const ownerPreview = await agent
      .get(`/api/candidate/cvs/${publicUploaded._id}/preview`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    assertPdfResponse(ownerPreview, { dispositionPrefix: "inline" });
    expect(downloadSpy).toHaveBeenCalledTimes(1);

    for (const token of [managerToken, recruiterToken, adminToken]) {
      const previewResponse = await agent
        .get(`/api/candidate/cvs/${publicUploaded._id}/preview`)
        .set("Authorization", `Bearer ${token}`);
      const downloadResponse = await agent
        .get(`/api/candidate/cvs/${publicUploaded._id}/download`)
        .set("Authorization", `Bearer ${token}`);

      expect(previewResponse.status).toBe(403);
      expect(downloadResponse.status).toBe(403);
    }

    const anonymousPreview = await agent.get(
      `/api/candidate/cvs/${publicUploaded._id}/preview`,
    );
    const anonymousDownload = await agent.get(
      `/api/candidate/cvs/${publicUploaded._id}/download`,
    );

    expect(anonymousPreview.status).toBe(401);
    expect(anonymousDownload.status).toBe(401);

    const after = await CandidateCV.findById(publicUploaded._id).lean();
    expect(after.visibility).toBe(CANDIDATE_CV_VISIBILITY.PUBLIC);
    expect(after).not.toHaveProperty("isPubliclyAccessible");
    expect(after).not.toHaveProperty("publicUrl");
    expect(after).not.toHaveProperty("publicDownloadUrl");
  });
});
