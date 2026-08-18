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
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import COMPANY_MEMBER_STATUS from "../../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import EMPLOYMENT_TYPE from "../../src/constants/employment-type.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import LOCATION from "../../src/constants/location.js";
import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import WORK_MODE from "../../src/constants/work-mode.js";
import Application from "../../src/models/application.model.js";
import CandidateAvailability from "../../src/models/candidate-availability.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import CompanyMember from "../../src/models/company-member.model.js";
import Conversation from "../../src/models/conversation.model.js";
import InterviewSchedule from "../../src/models/interview-schedule.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import User from "../../src/models/user.model.js";
import {
  archiveOwnCandidateCv,
  updateOwnCandidateCvMetadata,
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

const SEARCH_PATH = "/api/jobs/candidate-search/cvs";
const previewPath = (cvId) => `${SEARCH_PATH}/${cvId}/preview`;
const downloadPath = (cvId) => `${SEARCH_PATH}/${cvId}/download`;
const HISTORICAL_SNAPSHOT_SUMMARY = "HISTORICAL_SNAPSHOT_SUMMARY_V14S07";
const LIVE_CV_SUMMARY = "LIVE_CURRENT_SUMMARY_V14S07";

const generatedContent = ({
  fullName = "Slice 07 Candidate",
  professionalSummary = LIVE_CV_SUMMARY,
} = {}) => ({
  personalInfo: {
    fullName,
    email: "v14.slice07.contact@example.com",
    phone: "+84901114007",
    displayLocation: "Ha Noi",
    links: [],
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
});

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
  });
};

const createRecruiterWithProofJob = async ({
  emailPrefix = "v14.slice07",
  status = JOB_STATUS.DRAFT,
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
  const proofJob = await Job.create({
    companyId: manager.company._id,
    createdByCompanyMemberId: recruiter.membership._id,
    primaryRecruiterCompanyMemberId: recruiter.membership._id,
    supportingRecruiterCompanyMemberIds: [],
    status,
  });

  return { manager, recruiter, proofJob };
};

const createCandidateCv = async ({
  candidateUserId,
  categoryId,
  sourceType = CANDIDATE_CV_SOURCE_TYPE.GENERATED,
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PUBLIC,
  archivedAt = null,
  name = "Candidate CV",
  skillTags = ["nodejs"],
  preferredLocations = [LOCATION.HA_NOI],
  employmentTypes = [EMPLOYMENT_TYPE.FULL_TIME],
  workModes = [WORK_MODE.REMOTE],
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
    skillTags,
    preferredLocations,
    employmentTypes,
    workModes,
    isDefault: false,
  };

  if (sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    baseDoc.generatedContent = generatedContent();
  } else {
    baseDoc.uploadedFile = {
      storageKey: `candidate-cvs/${new mongoose.Types.ObjectId().toString()}`,
      originalFileName: "uploaded.pdf",
      mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
      sizeBytes: 1024,
      pageCount: 1,
      uploadedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
  }

  return CandidateCV.create(baseDoc);
};

const authHeader = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
});

const searchCvs = (agent, accessToken, query = {}) => {
  return agent.get(SEARCH_PATH).query(query).set(authHeader(accessToken));
};

const previewCv = (agent, accessToken, cvId) => {
  return agent.get(previewPath(cvId)).set(authHeader(accessToken));
};

const assertSearchContains = (response, cvId) => {
  expect(response.status).toBe(200);
  expect(response.body.cvs.map((item) => item.cvId)).toContain(cvId.toString());
};

const assertSearchOmits = (response, cvId) => {
  expect(response.status).toBe(200);
  expect(response.body.cvs.map((item) => item.cvId)).not.toContain(
    cvId.toString(),
  );
};

const assertInlinePreview = (response) => {
  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toMatch(/application\/pdf/);
  expect(response.headers["content-disposition"]).toContain("inline");
  expect(response.headers["content-disposition"]).not.toContain("attachment");
};

const assertDeniedSearchAndPreview = async ({
  agent,
  accessToken,
  cvId,
  expectedStatus,
}) => {
  const search = await searchCvs(agent, accessToken);
  expect(search.status).toBe(expectedStatus);

  const filtered = await searchCvs(agent, accessToken, {
    skillTags: "nodejs",
  });
  expect(filtered.status).toBe(expectedStatus);

  const preview = await previewCv(agent, accessToken, cvId);
  expect(preview.status).toBe(expectedStatus);
};

const captureCounts = async () => ({
  applications: await Application.countDocuments(),
  conversations: await Conversation.countDocuments(),
  messages: await Message.countDocuments(),
  notifications: await Notification.countDocuments(),
  notificationEvents: await NotificationEvent.countDocuments(),
  interviewSchedules: await InterviewSchedule.countDocuments(),
  availabilities: await CandidateAvailability.countDocuments(),
});

describe("V14 Slice 07 — Dynamic revocation + read-only acceptance closure (F01–F06)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("Authorization and ownership boundary", () => {
    it("denies Anonymous, Candidate, Company Manager, and Platform Admin Search/Preview (BR-01, BR-05)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { manager, recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.authz",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.authz@example.com",
      });
      const platformAdmin = await createVerifiedUser({
        email: "admin.v14.s07.authz@example.com",
        role: USER_ROLE.PLATFORM_ADMIN,
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
      });

      const anonymousSearch = await agent.get(SEARCH_PATH);
      expect(anonymousSearch.status).toBe(401);
      const anonymousPreview = await agent.get(previewPath(candidateCv._id));
      expect(anonymousPreview.status).toBe(401);

      for (const account of [candidate, manager, platformAdmin]) {
        const token = await loginAndGetAccessToken(agent, {
          email: account.user.email,
          password: DEFAULT_PASSWORD,
        });
        await assertDeniedSearchAndPreview({
          agent,
          accessToken: token,
          cvId: candidateCv._id,
          expectedStatus: 403,
        });
      }

      const recruiterToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(
        await searchCvs(agent, recruiterToken),
        candidateCv._id,
      );
      assertInlinePreview(
        await previewCv(agent, recruiterToken, candidateCv._id),
      );
    });

    it("does not let client-supplied companyId create cross-company authorization, and keeps CandidateCV Candidate-owned (BR-02, BR-15)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const companyA = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.tenant.a",
      });
      const companyB = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.tenant.b",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.tenant@example.com",
        fullName: "Shared Public Candidate",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        name: "Shared PUBLIC CV",
      });

      const tokenA = await loginAndGetAccessToken(agent, {
        email: companyA.recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const tokenB = await loginAndGetAccessToken(agent, {
        email: companyB.recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      assertSearchContains(await searchCvs(agent, tokenA), candidateCv._id);
      assertSearchContains(await searchCvs(agent, tokenB), candidateCv._id);
      assertInlinePreview(await previewCv(agent, tokenA, candidateCv._id));
      assertInlinePreview(await previewCv(agent, tokenB, candidateCv._id));

      const expanded = await searchCvs(agent, tokenA, {
        companyId: companyB.manager.company._id.toString(),
      });
      expect(expanded.status).toBe(403);
      expect(expanded.body.error.message).toMatch(
        /not an authorization source/i,
      );

      const expandedPreview = await agent
        .get(previewPath(candidateCv._id))
        .query({ companyId: companyB.manager.company._id.toString() })
        .set(authHeader(tokenA));
      expect(expandedPreview.status).toBe(403);

      const persisted = await CandidateCV.findById(candidateCv._id).lean();
      expect(persisted.candidateUserId.toString()).toBe(
        candidate.user._id.toString(),
      );
      expect(persisted).not.toHaveProperty("companyId");
      expect(persisted).not.toHaveProperty("tenantId");
      expect(persisted).not.toHaveProperty("recruiterId");
      expect(persisted).not.toHaveProperty("recruiterCompanyMemberId");
      for (const field of [
        "companyId",
        "tenantId",
        "recruiterId",
        "searchEligible",
        "deletedAt",
      ]) {
        expect(Object.keys(CandidateCV.schema.paths)).not.toContain(field);
      }
    });
  });

  describe("Recruiter eligibility revocation", () => {
    it("revokes Search and Preview after the last Primary Job membership is removed (BR-03, BR-04, BR-33)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { manager, recruiter, proofJob } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.last.primary",
      });
      const replacement = await createActiveRecruiterContext({
        email: "replacement.v14.s07.last.primary@example.com",
        company: manager.company,
        employeeCode: "NV-V14-S07-LAST-P-REPL",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.last.primary@example.com",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(await searchCvs(agent, accessToken), candidateCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, candidateCv._id));

      await Job.updateOne(
        { _id: proofJob._id },
        {
          $set: {
            primaryRecruiterCompanyMemberId: replacement.membership._id,
            supportingRecruiterCompanyMemberIds: [],
          },
        },
      );

      await assertDeniedSearchAndPreview({
        agent,
        accessToken,
        cvId: candidateCv._id,
        expectedStatus: 403,
      });
    });

    it("revokes Search and Preview after the last Supporting Job membership is removed (BR-03, BR-04, BR-33)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { manager } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.last.supporting",
      });
      const primary = await createActiveRecruiterContext({
        email: "primary.v14.s07.last.supporting@example.com",
        company: manager.company,
        employeeCode: "NV-V14-S07-LAST-S-P",
      });
      const supporting = await createActiveRecruiterContext({
        email: "supporting.v14.s07.last.supporting@example.com",
        company: manager.company,
        employeeCode: "NV-V14-S07-LAST-S-S",
      });
      const proofJob = await Job.create({
        companyId: manager.company._id,
        createdByCompanyMemberId: primary.membership._id,
        primaryRecruiterCompanyMemberId: primary.membership._id,
        supportingRecruiterCompanyMemberIds: [supporting.membership._id],
        status: JOB_STATUS.CLOSED,
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.last.supporting@example.com",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: supporting.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(await searchCvs(agent, accessToken), candidateCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, candidateCv._id));

      await Job.updateOne(
        { _id: proofJob._id },
        { $set: { supportingRecruiterCompanyMemberIds: [] } },
      );

      await assertDeniedSearchAndPreview({
        agent,
        accessToken,
        cvId: candidateCv._id,
        expectedStatus: 403,
      });
    });

    it("revokes Search and Preview when Recruiter membership or User is no longer eligible (BR-02, BR-04, BR-33)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const membershipCase = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.recruiter.mem",
      });
      const userCase = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.recruiter.user",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.recruiter.lifecycle@example.com",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
      });

      const membershipToken = await loginAndGetAccessToken(agent, {
        email: membershipCase.recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertInlinePreview(
        await previewCv(agent, membershipToken, candidateCv._id),
      );
      await CompanyMember.updateOne(
        { _id: membershipCase.recruiter.membership._id },
        { $set: { status: COMPANY_MEMBER_STATUS.LOCKED } },
      );
      await assertDeniedSearchAndPreview({
        agent,
        accessToken: membershipToken,
        cvId: candidateCv._id,
        expectedStatus: 403,
      });

      const userToken = await loginAndGetAccessToken(agent, {
        email: userCase.recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(await searchCvs(agent, userToken), candidateCv._id);
      userCase.recruiter.user.status = USER_STATUS.LOCKED;
      await userCase.recruiter.user.save();
      await assertDeniedSearchAndPreview({
        agent,
        accessToken: userToken,
        cvId: candidateCv._id,
        expectedStatus: 403,
      });
    });

    it("revokes Search and Preview when the Recruiter Company is no longer active (BR-02, BR-04, BR-33)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { manager, recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.company.lock",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.company.lock@example.com",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(await searchCvs(agent, accessToken), candidateCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, candidateCv._id));

      manager.company.operationalStatus = COMPANY_OPERATIONAL_STATUS.LOCKED;
      await manager.company.save();

      await assertDeniedSearchAndPreview({
        agent,
        accessToken,
        cvId: candidateCv._id,
        expectedStatus: 403,
      });
    });
  });

  describe("CandidateCV and Candidate eligibility revocation", () => {
    it("removes PUBLIC→PRIVATE CVs from later Search and denies subsequent Preview, including known cvId (BR-16, BR-29, BR-30)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.private",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.private@example.com",
      });
      const generatedCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        name: "Generated PUBLIC",
      });
      const uploadedCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        name: "Uploaded PUBLIC",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const listed = await searchCvs(agent, accessToken);
      assertSearchContains(listed, generatedCv._id);
      assertSearchContains(listed, uploadedCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, generatedCv._id));

      await updateOwnCandidateCvMetadata({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        candidateCvId: generatedCv._id.toString(),
        patch: { visibility: CANDIDATE_CV_VISIBILITY.PRIVATE },
      });
      await updateOwnCandidateCvMetadata({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        candidateCvId: uploadedCv._id.toString(),
        patch: { visibility: CANDIDATE_CV_VISIBILITY.PRIVATE },
      });

      const listedAfter = await searchCvs(agent, accessToken, {
        skillTags: "nodejs",
      });
      assertSearchOmits(listedAfter, generatedCv._id);
      assertSearchOmits(listedAfter, uploadedCv._id);
      expect(listedAfter.body.cvs).toHaveLength(0);

      expect(
        (await previewCv(agent, accessToken, generatedCv._id)).status,
      ).toBe(404);
      expect(
        (await previewCv(agent, accessToken, uploadedCv._id)).status,
      ).toBe(404);
    });

    it("removes archived CVs from later Search and denies subsequent Preview (BR-14, BR-29, BR-31)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.archive",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.archive@example.com",
      });
      const generatedCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        name: "Generated to archive",
      });
      const uploadedCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
        name: "Uploaded to archive",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(await searchCvs(agent, accessToken), generatedCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, generatedCv._id));

      await archiveOwnCandidateCv({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        candidateCvId: generatedCv._id.toString(),
      });
      await archiveOwnCandidateCv({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        candidateCvId: uploadedCv._id.toString(),
      });

      const listedAfter = await searchCvs(agent, accessToken);
      assertSearchOmits(listedAfter, generatedCv._id);
      assertSearchOmits(listedAfter, uploadedCv._id);
      expect(
        (await previewCv(agent, accessToken, generatedCv._id)).status,
      ).toBe(404);
      expect(
        (await previewCv(agent, accessToken, uploadedCv._id)).status,
      ).toBe(404);
    });

    it("removes CVs from Search and denies Preview when the Candidate is no longer ACTIVE or verified (BR-13, BR-32)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.owner",
      });
      const inactiveOwner = await createVerifiedUser({
        email: "candidate.v14.s07.owner.inactive@example.com",
      });
      const unverifiedOwner = await createVerifiedUser({
        email: "candidate.v14.s07.owner.unverified@example.com",
      });
      const inactiveCv = await createCandidateCv({
        candidateUserId: inactiveOwner.user._id,
        categoryId: category._id,
        name: "Inactive owner CV",
      });
      const unverifiedCv = await createCandidateCv({
        candidateUserId: unverifiedOwner.user._id,
        categoryId: category._id,
        name: "Unverified owner CV",
      });

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      const listed = await searchCvs(agent, accessToken);
      assertSearchContains(listed, inactiveCv._id);
      assertSearchContains(listed, unverifiedCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, inactiveCv._id));

      inactiveOwner.user.status = USER_STATUS.LOCKED;
      await inactiveOwner.user.save();
      await User.updateOne(
        { _id: unverifiedOwner.user._id },
        { $set: { emailVerifiedAt: null } },
      );

      const listedAfter = await searchCvs(agent, accessToken);
      assertSearchOmits(listedAfter, inactiveCv._id);
      assertSearchOmits(listedAfter, unverifiedCv._id);
      expect((await previewCv(agent, accessToken, inactiveCv._id)).status).toBe(
        404,
      );
      expect(
        (await previewCv(agent, accessToken, unverifiedCv._id)).status,
      ).toBe(404);
    });
  });

  describe("Read-only boundary and historical snapshot independence", () => {
    it("keeps Search, Filter, and Preview read-only and does not create recruitment, view, or Download surfaces (BR-28, BR-34–BR-37)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.readonly",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.readonly@example.com",
        fullName: "Read Only Candidate",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        name: "Read Only PUBLIC CV",
      });

      const beforeCv = await CandidateCV.findById(candidateCv._id).lean();
      const beforeOwner = await User.findById(candidate.user._id).lean();
      const beforeCounts = await captureCounts();
      const beforeCollections = (await CandidateCV.db.db.listCollections().toArray())
        .map((item) => item.name)
        .sort();

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });

      const listed = await searchCvs(agent, accessToken, {
        skillTags: "nodejs",
        preferredLocations: LOCATION.HA_NOI,
        employmentTypes: EMPLOYMENT_TYPE.FULL_TIME,
        workModes: WORK_MODE.REMOTE,
      });
      expect(listed.body.cvs).toHaveLength(1);
      expect(listed.body.cvs[0]).not.toHaveProperty("generatedContent");
      expect(listed.body.cvs[0]).not.toHaveProperty("email");
      expect(listed.body.cvs[0]).not.toHaveProperty("phone");
      assertInlinePreview(await previewCv(agent, accessToken, candidateCv._id));

      const download = await agent
        .get(downloadPath(candidateCv._id))
        .set(authHeader(accessToken));
      expect(download.status).toBe(404);

      const afterCv = await CandidateCV.findById(candidateCv._id).lean();
      const afterOwner = await User.findById(candidate.user._id).lean();
      expect(afterCv).toEqual(beforeCv);
      expect(afterOwner).toEqual(beforeOwner);
      expect(await captureCounts()).toEqual(beforeCounts);

      const afterCollections = (await CandidateCV.db.db.listCollections().toArray())
        .map((item) => item.name)
        .sort();
      expect(afterCollections).toEqual(beforeCollections);
      for (const name of [
        "candidate_searches",
        "candidate_search_results",
        "candidate_search_histories",
        "candidate_cv_views",
        "candidate_cv_view_histories",
        "job_invitations",
      ]) {
        expect(afterCollections).not.toContain(name);
      }
      expect(beforeCv).not.toHaveProperty("viewCount");
      expect(beforeCv).not.toHaveProperty("viewedByRecruiterIds");
      expect(beforeCv).not.toHaveProperty("searchEligible");
      expect(beforeCv).not.toHaveProperty("deletedAt");
    });

    it("does not rewrite an existing Application submittedCvSnapshot when the live CandidateCV later changes or leaves Search (BR-38)", async () => {
      const agent = createTestAgent();
      const category = await createFieldCategory();
      const { recruiter } = await createRecruiterWithProofJob({
        emailPrefix: "v14.s07.snapshot",
      });
      const candidate = await createVerifiedUser({
        email: "candidate.v14.s07.snapshot@example.com",
      });
      const candidateCv = await createCandidateCv({
        candidateUserId: candidate.user._id,
        categoryId: category._id,
        name: "Live Search CV",
      });
      const capturedAt = new Date("2026-01-15T00:00:00.000Z");
      const application = await Application.create({
        candidateUserId: candidate.user._id,
        jobId: new mongoose.Types.ObjectId(),
        source: APPLICATION_SOURCE.DIRECT_APPLICATION,
        status: APPLICATION_STATUS.APPLIED,
        submittedCvSnapshot: {
          sourceCandidateCvId: candidateCv._id,
          name: "Historical Submitted Name",
          sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
          generatedContent: generatedContent({
            fullName: "Historical Snapshot Candidate",
            professionalSummary: HISTORICAL_SNAPSHOT_SUMMARY,
          }),
          pdfFile: {
            storageKey: "applications/submitted-cv-snapshots/v14-s07.pdf",
            originalFileName: "historical.pdf",
            mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
            sizeBytes: 2048,
            pageCount: 1,
          },
          capturedAt,
        },
        appliedAt: new Date("2026-01-15T00:00:01.000Z"),
        withdrawnAt: null,
        withdrawReason: null,
        assignedRecruiterCompanyMemberId: null,
        version: 0,
      });
      const snapshotBefore = JSON.parse(
        JSON.stringify(application.submittedCvSnapshot.toObject()),
      );

      const accessToken = await loginAndGetAccessToken(agent, {
        email: recruiter.user.email,
        password: DEFAULT_PASSWORD,
      });
      assertSearchContains(await searchCvs(agent, accessToken), candidateCv._id);
      assertInlinePreview(await previewCv(agent, accessToken, candidateCv._id));

      await updateOwnCandidateCvMetadata({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        candidateCvId: candidateCv._id.toString(),
        patch: {
          name: "Renamed after Search",
          visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
        },
      });
      await CandidateCV.updateOne(
        { _id: candidateCv._id },
        {
          $set: {
            "generatedContent.professionalSummary": "CHANGED_AFTER_SEARCH",
          },
        },
      );
      await archiveOwnCandidateCv({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        candidateCvId: candidateCv._id.toString(),
      });

      assertSearchOmits(await searchCvs(agent, accessToken), candidateCv._id);
      expect(
        (await previewCv(agent, accessToken, candidateCv._id)).status,
      ).toBe(404);

      const snapshotAfter = await Application.findById(application._id)
        .select("submittedCvSnapshot")
        .lean();
      expect(snapshotAfter.submittedCvSnapshot).toMatchObject({
        name: "Historical Submitted Name",
        sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
        generatedContent: {
          professionalSummary: HISTORICAL_SNAPSHOT_SUMMARY,
        },
      });
      expect(snapshotAfter.submittedCvSnapshot.sourceCandidateCvId.toString()).toBe(
        candidateCv._id.toString(),
      );
      expect(new Date(snapshotAfter.submittedCvSnapshot.capturedAt).toISOString()).toBe(
        capturedAt.toISOString(),
      );
      expect(snapshotAfter.submittedCvSnapshot.generatedContent.professionalSummary).not.toBe(
        "CHANGED_AFTER_SEARCH",
      );

      const liveCv = await CandidateCV.findById(candidateCv._id).lean();
      expect(liveCv.name).toBe("Renamed after Search");
      expect(liveCv.visibility).toBe(CANDIDATE_CV_VISIBILITY.PRIVATE);
      expect(liveCv.archivedAt).not.toBeNull();
      expect(liveCv.generatedContent.professionalSummary).toBe(
        "CHANGED_AFTER_SEARCH",
      );
      expect(JSON.parse(JSON.stringify(snapshotAfter.submittedCvSnapshot))).toEqual(
        snapshotBefore,
      );
    });
  });
});
