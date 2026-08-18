import { inflateSync } from "node:zlib";

import mongoose from "mongoose";
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
import { renderHarvardCandidateCvPdf } from "../../src/services/candidate-cv-harvard-pdf.service.js";
import {
  listCandidateSearchEligibleCandidateCvs,
  previewSearchEligibleGeneratedCandidateCv,
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

const CONTACT_EMAIL = "v14.slice05.contact@example.com";
const CONTACT_PHONE = "+84901114005";
const CURRENT_SUMMARY = "V14 Slice 05 current generated summary";
const UPDATED_SUMMARY = "QZX14NOW current generated summary";

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
  });
};

const createRecruiterWithProofJob = async ({
  emailPrefix = "v14.slice05",
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

const generatedContent = ({
  fullName = "Generated Preview Candidate",
  email = CONTACT_EMAIL,
  phone = CONTACT_PHONE,
  professionalSummary = CURRENT_SUMMARY,
} = {}) => {
  return {
    personalInfo: {
      fullName,
      email,
      phone,
      displayLocation: "Ha Noi",
      links: ["https://linkedin.com/in/v14-slice05"],
      avatarUrl: null,
    },
    professionalSummary,
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
  sourceType = CANDIDATE_CV_SOURCE_TYPE.GENERATED,
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
  archivedAt = null,
  name = "Candidate CV",
  content,
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
    baseDoc.generatedContent = content ?? generatedContent();
  } else {
    baseDoc.uploadedFile = {
      storageKey: `candidate-cvs/${new mongoose.Types.ObjectId().toString()}`,
      originalFileName: "uploaded.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      pageCount: 1,
      uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
  }

  return CandidateCV.create(baseDoc);
};

const inflatePdfStreams = (pdfBuffer) => {
  const raw = pdfBuffer.toString("binary");
  const inflated = [];
  let position = 0;

  while (true) {
    const streamMarker = raw.indexOf("stream", position);

    if (streamMarker === -1) {
      break;
    }

    let dataStart = streamMarker + "stream".length;

    if (raw[dataStart] === "\r") {
      dataStart += 1;
    }

    if (raw[dataStart] === "\n") {
      dataStart += 1;
    }

    const endMarker = raw.indexOf("endstream", dataStart);

    if (endMarker === -1) {
      break;
    }

    let dataEnd = endMarker;

    if (raw[dataEnd - 1] === "\n") {
      dataEnd -= 1;
    }

    if (raw[dataEnd - 1] === "\r") {
      dataEnd -= 1;
    }

    try {
      inflated.push(
        inflateSync(
          Buffer.from(raw.slice(dataStart, dataEnd), "binary"),
        ).toString("binary"),
      );
    } catch {
      // Ignore non-FlateDecode streams.
    }

    position = endMarker + "endstream".length;
  }

  return inflated.join("\n");
};

const extractPdfMappedCharset = (pdfBuffer) => {
  const inflated = inflatePdfStreams(pdfBuffer);
  const hexStrings = [...inflated.matchAll(/<([0-9A-Fa-f]+)>/g)].map((match) =>
    Buffer.from(match[1], "hex").toString("binary"),
  );

  return [...new Set(hexStrings.join("").replace(/[^\x20-\x7E]/g, "").split(""))]
    .sort()
    .join("");
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

describe("V14 Slice 05 — Generated CV Recruiter Preview (F05 partial, F06 partial)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("previews current GENERATED search-eligible CV content including unredacted contact (BR-26, BR-29, BR-35)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.happy",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice05.happy@example.com",
      fullName: "Preview Candidate",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Public Generated CV",
    });

    const delivery = await previewSearchEligibleGeneratedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });
    const currentCv = await CandidateCV.findById(candidateCv._id);
    const expectedFull = await renderHarvardCandidateCvPdf(
      currentCv.generatedContent,
    );
    const redactedContent = {
      ...currentCv.toObject().generatedContent,
      personalInfo: {
        ...currentCv.toObject().generatedContent.personalInfo,
        email: null,
        phone: null,
      },
    };
    const expectedRedacted =
      await renderHarvardCandidateCvPdf(redactedContent);
    const previewCharset = extractPdfMappedCharset(delivery.buffer);

    expect(delivery.mimeType).toBe("application/pdf");
    expect(delivery.sourceType).toBe(CANDIDATE_CV_SOURCE_TYPE.GENERATED);
    expect(delivery.status).toBe(CANDIDATE_CV_STATUS.ACTIVE);
    expect(previewCharset).toBe(extractPdfMappedCharset(expectedFull));
    expect(previewCharset).toContain("@");
    expect(extractPdfMappedCharset(expectedRedacted)).not.toContain("@");

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
    expect(extractPdfMappedCharset(response.body)).toBe(previewCharset);
  });

  it("reads current CV content after updates and does not keep a historical copy (BR-35)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.current",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice05.current@example.com",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
    });

    const first = await previewSearchEligibleGeneratedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });
    expect(extractPdfMappedCharset(first.buffer)).not.toContain("Q");

    await CandidateCV.updateOne(
      { _id: candidateCv._id },
      {
        $set: {
          "generatedContent.professionalSummary": UPDATED_SUMMARY,
        },
      },
    );

    const second = await previewSearchEligibleGeneratedCandidateCv({
      actorUser: recruiter.user,
      candidateCvId: candidateCv._id.toString(),
    });
    const updatedCv = await CandidateCV.findById(candidateCv._id);
    const secondExpected = await renderHarvardCandidateCvPdf(
      updatedCv.generatedContent,
    );

    expect(extractPdfMappedCharset(second.buffer)).toContain("Q");
    expect(extractPdfMappedCharset(second.buffer)).toBe(
      extractPdfMappedCharset(secondExpected),
    );
    expect(await CandidateCV.countDocuments()).toBe(1);
  });

  it("rejects GENERATED/DRAFT/PUBLIC, PRIVATE, archived, missing, invalid, and Uploaded CVs (BR-29–BR-31)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.deny.cv",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice05.deny.cv@example.com",
    });

    const draftPublic = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      status: CANDIDATE_CV_STATUS.DRAFT,
      name: "Generated Draft Public",
    });
    const privateActive = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      name: "Generated Active Private",
    });
    const archived = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      archivedAt: new Date("2026-08-10T00:00:00.000Z"),
      name: "Generated Archived",
    });
    const uploadedEligible = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      name: "Uploaded Eligible",
    });

    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: draftPublic._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: privateActive._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: archived._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: uploadedEligible._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: new mongoose.Types.ObjectId().toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: "not-a-cv-id",
      }),
    );

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recruiter.user.email,
      password: DEFAULT_PASSWORD,
    });

    for (const cvId of [
      draftPublic._id,
      privateActive._id,
      archived._id,
      uploadedEligible._id,
      new mongoose.Types.ObjectId(),
    ]) {
      const response = await agent
        .get(`/api/jobs/candidate-search/cvs/${cvId}/preview`)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(response.status).toBe(404);
    }
  });

  it("rejects Preview when the Candidate owner is inactive or unverified (BR-32)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.owner",
    });
    const unverified = await createVerifiedUser({
      email: "candidate.v14.slice05.unverified@example.com",
    });
    const inactive = await createVerifiedUser({
      email: "candidate.v14.slice05.inactive@example.com",
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
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: unverifiedCv._id.toString(),
      }),
    );
    await expectNotFound(() =>
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: inactiveCv._id.toString(),
      }),
    );
  });

  it("re-checks current eligibility and does not trust prior list membership or cvId knowledge (BR-29, BR-30)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.recheck",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice05.recheck@example.com",
    });
    const candidateCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
    });

    const listed = await listCandidateSearchEligibleCandidateCvs({
      actorUser: recruiter.user,
    });
    expect(listed.map((item) => item.cvId)).toContain(candidateCv._id.toString());

    await previewSearchEligibleGeneratedCandidateCv({
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
      previewSearchEligibleGeneratedCandidateCv({
        actorUser: recruiter.user,
        candidateCvId: candidateCv._id.toString(),
      }),
    );
  });

  it("keeps Preview read-only and does not expand to Profile, other CVs, Application, or Download (BR-27, BR-28, BR-34–BR-38)", async () => {
    const category = await createFieldCategory();
    const { recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.boundary",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice05.boundary@example.com",
      fullName: "Boundary Candidate",
    });
    const publicCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      name: "Public Generated",
    });
    const otherCv = await createCandidateCv({
      candidateUserId: candidate.user._id,
      categoryId: category._id,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      name: "Private Other CV",
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
      cvName: "Public Generated",
      categoryId: category._id.toString(),
      experienceLevelId: null,
      skillTags: [],
      preferredLocations: [],
      employmentTypes: [],
      workModes: [],
    });
    expect(browse.body.cvs[0]).not.toHaveProperty("generatedContent");
    expect(browse.body.cvs[0]).not.toHaveProperty("email");
    expect(browse.body.cvs[0]).not.toHaveProperty("phone");
  });

  it("HTTP denies Candidate, Company Manager, and Recruiter without current Candidate Search eligibility (BR-33)", async () => {
    const category = await createFieldCategory();
    const { manager, recruiter } = await createRecruiterWithProofJob({
      emailPrefix: "v14.slice05.authz",
    });
    const ineligibleRecruiter = await createActiveRecruiterContext({
      email: "recruiter.v14.slice05.nojob@example.com",
      company: manager.company,
      employeeCode: "NV-V14-SLICE05-NOJOB",
    });
    const candidate = await createVerifiedUser({
      email: "candidate.v14.slice05.authz@example.com",
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
    const eligibleResponse = await requestPdf(agent, previewPath, eligibleToken);
    assertInlinePdf(eligibleResponse);
  });
});
