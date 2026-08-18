import { PDFDocument, StandardFonts } from "pdf-lib";
import mongoose from "mongoose";
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
import CANDIDATE_CV_UPLOADED_STORAGE from "../../src/constants/candidate-cv-uploaded-storage.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import USER_STATUS from "../../src/constants/user-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import User from "../../src/models/user.model.js";
import * as fileService from "../../src/services/file.service.js";
import {
  listCandidateSearchEligibleCandidateCvs,
  previewSearchEligibleGeneratedCandidateCv,
  previewSearchEligibleUploadedCandidateCv,
} from "../../src/services/candidate-cv.service.js";
import {
  DEFAULT_PASSWORD,
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

const CONTACT_EMAIL = "v14.slice06.contact@example.com";
const CURRENT_STORAGE_KEY = "jobhub/candidate-cvs/uploaded/v14-slice06-current";
const REPLACED_STORAGE_KEY =
  "jobhub/candidate-cvs/uploaded/v14-slice06-replaced";

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
  });
};

const createRecruiterWithProofJob = async ({
  emailPrefix = "v14.slice06",
} = {}) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase().replace(/\./g, "-")}`,
  });
  const recruiter = await createActiveRecruiterContext({
    email: `${emailPrefix}.recruiter@example.com`,
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase().replace(/\./g, "-")}-R`,
  });

  await Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: recruiter.membership._id,
    primaryRecruiterCompanyMemberId: recruiter.membership._id,
    supportingRecruiterCompanyMemberIds: [],
    status: JOB_STATUS.DRAFT,
  });

  return { manager, recruiter };
};

const buildPdfBuffer = async (marker) => {
  const document = await PDFDocument.create();
  const page = document.addPage([400, 600]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText(marker, {
    x: 40,
    y: 500,
    size: 12,
    font,
  });

  return Buffer.from(await document.save());
};

const generatedContent = () => {
  return {
    personalInfo: {
      fullName: "Generated Sibling Candidate",
      email: CONTACT_EMAIL,
      phone: "+84901114006",
      displayLocation: "Ha Noi",
      links: [],
      avatarUrl: null,
    },
    professionalSummary: "Sibling generated CV must stay Slice 05",
    educations: [
      {
        institutionName: "Example University",
        degree: "BSc",
        fieldOfStudy: "CS",
        startDate: "2018",
        endDate: "2022",
      },
    ],
    skills: ["Node.js"],
    workExperiences: [],
    projects: [],
    certifications: [],
    languages: [],
    hiddenSections: [],
  };
};

const createCandidateCv = async ({
  candidateUserId,
  categoryId,
  sourceType = CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
  archivedAt = null,
  name = "Candidate CV",
  storageKey = CURRENT_STORAGE_KEY,
  originalFileName = "uploaded.pdf",
} = {}) => {
  const baseDoc = {
    candidateUserId,
    categoryId,
    name,
    sourceType,
    status,
    visibility,
    archivedAt,
    experienceLevelId: null,
    skillTags: [],
    preferredLocations: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
  };

  if (sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    baseDoc.generatedContent = generatedContent();
  } else {
    baseDoc.uploadedFile = {
      storageKey,
      originalFileName,
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 1024,
      pageCount: 1,
      uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
  }

  return CandidateCV.create(baseDoc);
};

const requestPdf = (agent, url, accessToken) => {
  return agent
    .get(url)
    .set("Authorization", `Bearer ${accessToken}`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
};

const assertInlinePdf = (response) => {
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toMatch(/application\/pdf/);
  expect(response.headers["content-disposition"]).toContain("inline");
  expect(response.headers["content-disposition"]).not.toContain("attachment");
  expect(response.headers["cache-control"]).toContain("private");
  expect(response.headers["cache-control"]).toContain("no-store");
  expect(Buffer.isBuffer(response.body)).toBe(true);
  expect(response.body.subarray(0, 4).toString("utf8")).toBe("%PDF");
};

const expectNotFound = async (work) => {
  await expect(work).rejects.toMatchObject({
    statusCode: 404,
    message: "Candidate CV not found",
  });
};

const mockRestrictedPdfDownload = (pdfByStorageKey) => {
  return vi.spyOn(fileService, "downloadFileBuffer").mockImplementation(
    async ({ publicId, resourceType, deliveryType }) => {
      expect(resourceType).toBe(CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE);
      expect(deliveryType).toBe(CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE);
      expect(deliveryType).not.toBe("upload");

      const pdfBuffer = pdfByStorageKey.get(publicId);

      if (!pdfBuffer) {
        const error = new Error(`Missing mocked PDF for ${publicId}`);
        error.statusCode = 404;
        throw error;
      }

      return pdfBuffer;
    },
  );
};

describe("V14 Slice 06 — Uploaded CV Recruiter Preview (F05 closure, F06 partial)", () => {
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

  it("previews current UPLOADED search-eligible PDF via restricted delivery without redacting contact text (BR-12, BR-26, BR-29)", async () => {
    const currentPdf = await buildPdfBuffer(`Contact ${CONTACT_EMAIL}`);
    const downloadSpy = mockRestrictedPdfDownload(
      new Map([[CURRENT_STORAGE_KEY, currentPdf]]),
    );
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.happy",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.happy@example.com",
      fullName: "Preview Candidate",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Public Uploaded CV",
      originalFileName: "public-uploaded.pdf",
    });

    const delivery = await previewSearchEligibleUploadedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });

    expect(delivery.mimeType).toBe(CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE);
    expect(delivery.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.UPLOADED);
    expect(delivery.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
    expect(delivery.fileName.toLowerCase()).toContain("public-uploaded");
    expect(delivery.buffer.equals(currentPdf)).toBe(true);
    expect(downloadSpy).toHaveBeenCalledWith({
      publicId: CURRENT_STORAGE_KEY,
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const response = await requestPdf(
      agent,
      `/api/jobs/candidate-search/cvs/${candidateCv._id}/preview`,
      accessToken,
    );

    assertInlinePdf(response);
    expect(response.body.equals(currentPdf)).toBe(true);
    expect(response.headers["content-disposition"]).toMatch(
      /public-uploaded\.pdf/i,
    );
  });

  it("does not use persisted Uploaded status as a V14 eligibility predicate (BR-12)", async () => {
    const currentPdf = await buildPdfBuffer("status-is-not-eligibility");
    mockRestrictedPdfDownload(new Map([[CURRENT_STORAGE_KEY, currentPdf]]));
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.status",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.status@example.com",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
    });

    await CandidateCV.collection.updateOne(
      { _id: candidateCv._id },
      { $set: { status: CANDIDATE_CV_STATUS.DRAFT } },
      { bypassDocumentValidation: true },
    );

    const persisted = await CandidateCV.collection.findOne({
      _id: candidateCv._id,
    });
    expect(persisted.status).toBe(CANDIDATE_CV_STATUS.DRAFT);

    const delivery = await previewSearchEligibleUploadedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });
    expect(delivery.buffer.equals(currentPdf)).toBe(true);
  });

  it("reads the current Uploaded PDF after replacement and does not keep a historical copy (BR-35)", async () => {
    const firstPdf = await buildPdfBuffer("first-current-file");
    const secondPdf = await buildPdfBuffer("second-current-file");
    const downloadSpy = mockRestrictedPdfDownload(
      new Map([
        [CURRENT_STORAGE_KEY, firstPdf],
        [REPLACED_STORAGE_KEY, secondPdf],
      ]),
    );
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.current",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.current@example.com",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
    });

    const first = await previewSearchEligibleUploadedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });
    expect(first.buffer.equals(firstPdf)).toBe(true);

    await CandidateCV.updateOne(
      { _id: candidateCv._id },
      {
        $set: {
          "uploadedFile.storageKey": REPLACED_STORAGE_KEY,
          "uploadedFile.originalFileName": "replaced.pdf",
        },
      },
    );

    const second = await previewSearchEligibleUploadedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });

    expect(second.buffer.equals(secondPdf)).toBe(true);
    expect(second.fileName.toLowerCase()).toContain("replaced");
    expect(downloadSpy).toHaveBeenLastCalledWith({
      publicId: REPLACED_STORAGE_KEY,
      resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
      deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
    });
    expect(await CandidateCV.countDocuments()).toBe(1);
    const persisted = await CandidateCV.findById(candidateCv._id).lean();
    expect(persisted).not.toHaveProperty("previousFiles");
    expect(persisted.uploadedFile.storageKey).toBe(REPLACED_STORAGE_KEY);
  });

  it("rejects PRIVATE, archived, missing, invalid, and Generated CVs (BR-14, BR-16, BR-29–BR-31)", async () => {
    mockRestrictedPdfDownload(new Map());
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.deny.cv",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.deny.cv@example.com",
    });

    const privateUploaded = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      name: "Uploaded Private",
    });
    const archived = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      archivedAt: new Date("2026-08-10T00:00:00.000Z"),
      name: "Uploaded Archived",
    });
    const generatedEligible = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      name: "Generated Eligible",
    });

    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: privateUploaded._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: archived._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: generatedEligible._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: new mongoose.Types.ObjectId().toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: "not-a-cv-id",
      }),
    );

    const generatedDelivery = await previewSearchEligibleGeneratedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: generatedEligible._id.toString(),
    });
    expect(generatedDelivery.sourceType).toBe(
      CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    );

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    for (const cvId of [
      privateUploaded._id,
      archived._id,
      new mongoose.Types.ObjectId(),
    ]) {
      const response = await agent
        .get(`/api/jobs/candidate-search/cvs/${cvId}/preview`)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(response.status).toBe(404);
    }

    const generatedHttp = await requestPdf(
      agent,
      `/api/jobs/candidate-search/cvs/${generatedEligible._id}/preview`,
      accessToken,
    );
    assertInlinePdf(generatedHttp);
  });

  it("rejects Preview when the Candidate owner is inactive or unverified (BR-32)", async () => {
    mockRestrictedPdfDownload(new Map());
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.owner",
    });
    const unverified = await createVerifiedUser({
      email: "candidate.v14.slice06.unverified@example.com",
    });
    const inactive = await createVerifiedUser({
      email: "candidate.v14.slice06.inactive@example.com",
      status: USER_STATUS.LOCKED,
    });

    await User.updateOne(
      { _id: unverified.user._id },
      { $set: { emailVerifiedAt: null } },
    );

    const unverifiedCv = await createCandidateCv({
      candidateUserId: unverified.user._id,
      categoryId: category._id,
    });
    const inactiveCv = await createCandidateCv({
      candidateUserId: inactive.user._id,
      categoryId: category._id,
    });

    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: unverifiedCv._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: inactiveCv._id.toString(),
      }),
    );
  });

  it("re-checks current eligibility and does not trust prior list membership or cvId knowledge (BR-29, BR-30)", async () => {
    const currentPdf = await buildPdfBuffer("eligible-then-private");
    mockRestrictedPdfDownload(new Map([[CURRENT_STORAGE_KEY, currentPdf]]));
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.recheck",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.recheck@example.com",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
    });

    const listed = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
    });
    expect(listed.map((item) => item.cvId)).toContain(
      candidateCv._id.toString(),
    );

    await previewSearchEligibleUploadedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });

    await CandidateCV.updateOne(
      { _id: candidateCv._id },
      { $set: { visibility: CANDIDATE_CV_VISIBILITY.PRIVATE } },
    );

    const listedAfter = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
    });
    expect(listedAfter).toHaveLength(0);

    await expectNotFound(() =>
      previewSearchEligibleUploadedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: candidateCv._id.toString(),
      }),
    );
  });

  it("keeps Preview read-only and does not expand to Profile, other CVs, Application, or Download (BR-27, BR-28, BR-34–BR-38)", async () => {
    const currentPdf = await buildPdfBuffer("boundary-current-pdf");
    mockRestrictedPdfDownload(new Map([[CURRENT_STORAGE_KEY, currentPdf]]));
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.boundary",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.boundary@example.com",
      fullName: "Boundary Candidate",
    });
    const publicCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Public Uploaded",
    });
    const otherCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      name: "Private Other CV",
      storageKey: "jobhub/candidate-cvs/uploaded/v14-slice06-other",
    });

    const beforeCv = await CandidateCV.findById(publicCv._id).lean();
    const beforeOwner = await User.findById(candidate.user._id).lean();

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    const preview = await requestPdf(
      agent,
      `/api/jobs/candidate-search/cvs/${publicCv._id}/preview`,
      accessToken,
    );
    assertInlinePdf(preview);
    expect(preview.body.equals(currentPdf)).toBe(true);

    const afterCv = await CandidateCV.findById(publicCv._id).lean();
    const afterOwner = await User.findById(candidate.user._id).lean();

    expect(afterCv).toEqual(beforeCv);
    expect(afterOwner).toEqual(beforeOwner);
    expect(await Application.countDocuments()).toBe(0);
    expect(await Conversation.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
    expect(await NotificationEvent.countDocuments()).toBe(0);

    const download = await agent
      .get(`/api/jobs/candidate-search/cvs/${publicCv._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(download.status).toBe(404);

    const profile = await agent
      .get("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profile.status).toBe(403);

    const otherPreview = await agent
      .get(`/api/jobs/candidate-search/cvs/${otherCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(otherPreview.status).toBe(404);

    const ownerLibrary = await agent
      .get("/api/candidate/cvs")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(ownerLibrary.status).toBe(403);

    const applications = await agent
      .get("/api/candidate/applications")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(applications.status).toBe(403);

    const browse = await agent
      .get("/api/jobs/candidate-search/cvs")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(browse.status).toBe(200);
    expect(browse.body.cvs).toHaveLength(1);
    expect(browse.body.cvs[0]).toEqual({
      cvId: publicCv._id.toString(),
      candidateFullName: "Boundary Candidate",
      cvName: "Public Uploaded",
      categoryId: category._id.toString(),
      experienceLevelId: null,
      skillTags: [],
      preferredLocations: [],
      employmentTypes: [],
      workModes: [],
    });
    expect(browse.body.cvs[0]).not.toHaveProperty("uploadedFile");
    expect(browse.body.cvs[0]).not.toHaveProperty("storageKey");
    expect(browse.body.cvs[0]).not.toHaveProperty("email");
    expect(browse.body.cvs[0]).not.toHaveProperty("phone");
  });

  it("HTTP denies Candidate, Company Manager, and Recruiter without current Candidate Search eligibility (BR-33)", async () => {
    const currentPdf = await buildPdfBuffer("authz-current-pdf");
    mockRestrictedPdfDownload(new Map([[CURRENT_STORAGE_KEY, currentPdf]]));
    const category = await createFieldCategory();
    const { manager, recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice06.authz",
    });
    const ineligibleRecruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.slice06.nojob@example.com",
      company: manager.company,
      employeeCode: "NV-V14-SLICE06-NOJOB",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice06.authz@example.com",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
    });

    const agent = createTestAgent();
    const previewPath = `/api/jobs/candidate-search/cvs/${candidateCv._id}/preview`;

    const candidateToken = await loginAndGetAccessToken(agent, {
      email: candidate.user.email,
    });
    const candidateResponse = await agent
      .get(previewPath)
      .set("Authorization", `Bearer ${candidateToken}`);
    expect(candidateResponse.status).toBe(403);

    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
      password: DEFAULT_PASSWORD,
    });
    const managerResponse = await agent
      .get(previewPath)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(managerResponse.status).toBe(403);

    const ineligibleToken = await loginAndGetAccessToken(agent, {
      email: ineligibleRecruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const ineligibleResponse = await agent
      .get(previewPath)
      .set("Authorization", `Bearer ${ineligibleToken}`);
    expect(ineligibleResponse.status).toBe(403);

    const eligibleToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });
    const eligibleResponse = await requestPdf(
      agent,
      previewPath,
      eligibleToken,
    );
    assertInlinePdf(eligibleResponse);
    expect(eligibleResponse.body.equals(currentPdf)).toBe(true);
  });
});
