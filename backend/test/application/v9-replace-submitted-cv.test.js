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
import COMPANY_OPERATIONAL_STATUS from "../../src/constants/company-operational-status.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import {
  directApplyToJob,
  replaceSubmittedCv,
} from "../../src/services/application.service.js";
import { saveOwnGeneratedContent } from "../../src/services/candidate-cv.service.js";
import {
  replaceOwnUploadedCandidateCvPdf,
  updateOwnCandidateCvMetadata,
} from "../../src/services/candidate-cv.service.js";
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
const PAST_DEADLINE = () => new Date(Date.now() - 60_000);

const createFieldCategory = async (name = "Software Engineering") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const completeGeneratedContent = (fullName = "Jane Candidate") => ({
  personalInfo: {
    fullName,
    email: "jane@example.com",
    phone: "+84901234567",
    displayLocation: "Ha Noi",
    links: ["https://example.com"],
    avatarUrl: null,
  },
  professionalSummary: "Backend engineer summary",
  educations: [
    {
      institutionName: "Example University",
      degree: "BSc",
      fieldOfStudy: "CS",
    },
  ],
  skills: ["Node.js", "MongoDB"],
  workExperiences: [
    {
      companyName: "Example Co",
      position: "Engineer",
      description: "Built APIs",
    },
  ],
  projects: [
    {
      name: "JobHub",
      role: "Backend",
      technologies: ["Node.js"],
      description: "Recruitment platform",
    },
  ],
  certifications: [
    {
      name: "AWS Certified",
      issuer: "Amazon",
    },
  ],
  languages: [
    {
      name: "English",
      proficiency: CV_LANGUAGE_PROFICIENCY.FLUENT,
    },
  ],
  hiddenSections: [],
});

const buildPdfBuffer = async (pageCount = 1) => {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage();
  }
  return Buffer.from(await document.save());
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  name = "Generated CV",
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  archivedAt = null,
  generatedContent = completeGeneratedContent(),
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
    isDefault: false,
    archivedAt,
    generatedContent,
  });
};

const createUploadedCv = async ({
  candidateUserId,
  categoryId,
  name = "Uploaded CV",
  status = CANDIDATE_CV_STATUS.ACTIVE,
  visibility = CANDIDATE_CV_VISIBILITY.PRIVATE,
  archivedAt = null,
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
    status,
    visibility,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt,
    uploadedFile,
  });
};

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  applicationDeadline = FUTURE_DEADLINE(),
  title = "Backend Engineer",
} = {}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [],
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

const setupBaseline = async () => {
  const candidate = await createVerifiedUser({
    email: "replace.candidate@example.com",
  });
  const owner = candidate.user;
  const manager = await createActiveCompanyManagerContext({
    email: "replace.manager@example.com",
    businessRegistrationNumber: "BRN-V9-REPLACE",
  });
  const recruiter = await createActiveRecruiterContext({
    email: "replace.recruiter@example.com",
    company: manager.company,
    employeeCode: "NV-V9-REPLACE",
  });
  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: recruiter.membership._id,
  });
  const category = await createFieldCategory();

  return { owner, manager, job, category };
};

describe("V9 Slice 04 — Replace Submitted CV (F03, F04)", () => {
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

  it.each([
    {
      initialType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      replacementType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    },
    {
      initialType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      replacementType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    },
    {
      initialType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      replacementType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    },
    {
      initialType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      replacementType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
    },
  ])(
    "replaces submitted snapshot for %s -> %s",
    async ({ initialType, replacementType }) => {
      const uploadSpy = vi.spyOn(fileService, "uploadFileBuffer");
      const downloadSpy = vi.spyOn(fileService, "downloadFileBuffer");
      uploadSpy.mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
      });
      uploadSpy.mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replaced-snapshot",
      });

      if (initialType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
        downloadSpy.mockResolvedValueOnce(await buildPdfBuffer(2));
      }
      if (replacementType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
        downloadSpy.mockResolvedValueOnce(await buildPdfBuffer(3));
      }

      const { owner, job, category } = await setupBaseline();
      const initialCv =
        initialType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
          ? await createGeneratedCv({
              candidateUserId: owner._id,
              categoryId: category._id,
              name: "Initial Generated",
              generatedContent: completeGeneratedContent("Initial Generated"),
            })
          : await createUploadedCv({
              candidateUserId: owner._id,
              categoryId: category._id,
              name: "Initial Uploaded",
            });
      const replacementCv =
        replacementType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
          ? await createGeneratedCv({
              candidateUserId: owner._id,
              categoryId: category._id,
              name: "Replacement Generated",
              visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
              generatedContent: completeGeneratedContent("Replacement Generated"),
            })
          : await createUploadedCv({
              candidateUserId: owner._id,
              categoryId: category._id,
              name: "Replacement Uploaded",
              visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
              uploadedFile: {
                storageKey: "jobhub/candidate-cvs/uploaded/replacement-source",
                originalFileName: "replacement.pdf",
                mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
                sizeBytes: 3072,
                pageCount: 3,
                uploadedAt: new Date("2026-01-02T00:00:00.000Z"),
              },
            });

      const created = await directApplyToJob({
        candidateUserId: owner._id,
        actorUser: owner,
        jobId: job._id.toString(),
        candidateCvId: initialCv._id.toString(),
      });

      const replaced = await replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      });

      expect(replaced.id.toString()).toBe(created.id.toString());
      expect(replaced.source).toBe(APPLICATION_SOURCE.DIRECT_APPLICATION);
      expect(replaced.status).toBe(APPLICATION_STATUS.APPLIED);
      expect(replaced.version).toBe(1);
      expect(replaced.candidateUserId.toString()).toBe(owner._id.toString());
      expect(replaced.jobId.toString()).toBe(job._id.toString());
      expect(new Date(replaced.appliedAt).toISOString()).toBe(
        new Date(created.appliedAt).toISOString(),
      );
      expect(replaced.submittedCvSnapshot.sourceCandidateCvId.toString()).toBe(
        replacementCv._id.toString(),
      );
      expect(replaced.submittedCvSnapshot.sourceType).toBe(replacementType);

      if (replacementType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
        expect(replaced.submittedCvSnapshot.generatedContent).toBeTruthy();
      } else {
        expect(replaced.submittedCvSnapshot).not.toHaveProperty("generatedContent");
      }
    },
  );

  it("rejects owner/status/job/CV eligibility violations", async () => {
    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      publicId: "jobhub/applications/submitted-cv-snapshots/snapshot",
    });
    vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(
      await buildPdfBuffer(2),
    );

    const { owner, manager, job, category } = await setupBaseline();
    const outsider = await createVerifiedUser({
      email: "replace.outsider@example.com",
    });
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Owner Initial"),
    });
    const replacementCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Eligible Replacement"),
    });
    const outsiderCv = await createGeneratedCv({
      candidateUserId: outsider.user._id,
      categoryId: category._id,
    });

    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    await expect(
      replaceSubmittedCv({
        candidateUserId: outsider.user._id,
        actorUser: outsider.user,
        applicationId: created.id.toString(),
        candidateCvId: outsiderCv._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await Application.updateOne(
      { _id: created.id },
      {
        $set: {
          status: APPLICATION_STATUS.WITHDRAWN,
          withdrawnAt: new Date(),
        },
        $inc: { version: 1 },
      },
    );
    await expect(
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await Application.updateOne(
      { _id: created.id },
      {
        $set: {
          status: APPLICATION_STATUS.APPLIED,
          withdrawnAt: null,
          withdrawReason: null,
          version: 0,
        },
      },
    );
    await Job.updateOne({ _id: job._id }, { status: JOB_STATUS.CLOSED });
    await expect(
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await Job.updateOne({ _id: job._id }, { status: JOB_STATUS.PUBLISHED });
    await Job.updateOne({ _id: job._id }, { applicationDeadline: PAST_DEADLINE() });
    await expect(
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await Job.updateOne({ _id: job._id }, { applicationDeadline: FUTURE_DEADLINE() });
    await Company.updateOne(
      { _id: manager.company._id },
      { operationalStatus: COMPANY_OPERATIONAL_STATUS.LOCKED },
    );
    await expect(
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await Company.updateOne(
      { _id: manager.company._id },
      { operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE },
    );
    await CandidateCV.updateOne({ _id: replacementCv._id }, { archivedAt: new Date() });
    await expect(
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("performs whole-snapshot replacement atomically with version advancement", async () => {
    vi.spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/gen-initial",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/up-replaced",
      });
    vi.spyOn(fileService, "downloadFileBuffer").mockResolvedValue(
      await buildPdfBuffer(4),
    );

    const { owner, job, category } = await setupBaseline();
    const generatedCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Gen Initial",
      generatedContent: completeGeneratedContent("Before Replace"),
    });
    const uploadedCv = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Upload Next",
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/upload-next",
        originalFileName: "upload-next.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 4096,
        pageCount: 4,
        uploadedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    });

    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: generatedCv._id.toString(),
    });

    const replaced = await replaceSubmittedCv({
      candidateUserId: owner._id,
      actorUser: owner,
      applicationId: created.id.toString(),
      candidateCvId: uploadedCv._id.toString(),
      expectedVersion: 0,
    });

    expect(replaced.version).toBe(1);
    const persisted = await Application.findById(created.id).lean();
    expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
    expect(persisted.submittedCvSnapshot).toMatchObject({
      sourceCandidateCvId: uploadedCv._id,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      name: "Upload Next",
      pdfFile: {
        storageKey: "jobhub/applications/submitted-cv-snapshots/up-replaced",
        originalFileName: "upload-next.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 4096,
        pageCount: 4,
      },
    });
    expect(persisted.submittedCvSnapshot).not.toHaveProperty("generatedContent");
  });

  it("keeps replaced snapshot independent from live source CV mutations", async () => {
    vi.spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/initial-generated",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replaced-uploaded",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/candidate-cvs/uploaded/new-live-file",
      });
    vi.spyOn(fileService, "downloadFileBuffer")
      .mockResolvedValueOnce(await buildPdfBuffer(2))
      .mockResolvedValueOnce(await buildPdfBuffer(5));
    vi.spyOn(fileService, "deleteFile").mockResolvedValue({
      publicId: "jobhub/candidate-cvs/uploaded/replacement-source",
      result: "ok",
    });

    const { owner, job, category } = await setupBaseline();
    const initialGeneratedCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
    });
    const replacementUploadedCv = await createUploadedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      name: "Replacement Uploaded",
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/replacement-source",
        originalFileName: "replacement-source.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 2048,
        pageCount: 2,
        uploadedAt: new Date("2026-01-05T00:00:00.000Z"),
      },
    });

    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialGeneratedCv._id.toString(),
    });

    await replaceSubmittedCv({
      candidateUserId: owner._id,
      actorUser: owner,
      applicationId: created.id.toString(),
      candidateCvId: replacementUploadedCv._id.toString(),
      expectedVersion: 0,
    });

    await updateOwnCandidateCvMetadata({
      candidateUserId: owner._id,
      actorUser: owner,
      candidateCvId: replacementUploadedCv._id.toString(),
      patch: {
        name: "Renamed Replacement",
        visibility: CANDIDATE_CV_VISIBILITY.PUBLIC,
      },
    });
    await replaceOwnUploadedCandidateCvPdf({
      candidateUserId: owner._id,
      actorUser: owner,
      candidateCvId: replacementUploadedCv._id.toString(),
      file: {
        buffer: await buildPdfBuffer(5),
        originalname: "replacement-live.pdf",
      },
    });

    const persisted = await Application.findById(created.id).lean();
    expect(persisted.submittedCvSnapshot.name).toBe("Replacement Uploaded");
    expect(persisted.submittedCvSnapshot.pdfFile.originalFileName).toBe(
      "replacement-source.pdf",
    );
    expect(persisted.submittedCvSnapshot.pdfFile.pageCount).toBe(2);
  });

  it("excludes stale concurrent replace writes from the same revision", async () => {
    vi.spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/initial-generated",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replace-a",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replace-b",
      });

    const { owner, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Initial"),
    });
    const replacementA = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Replace A"),
    });
    const replacementB = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Replace B"),
    });

    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    const outcomes = await Promise.allSettled([
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementA._id.toString(),
        expectedVersion: 0,
      }),
      replaceSubmittedCv({
        candidateUserId: owner._id,
        actorUser: owner,
        applicationId: created.id.toString(),
        candidateCvId: replacementB._id.toString(),
        expectedVersion: 0,
      }),
    ]);

    const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
    const rejected = outcomes.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 409 });

    const persisted = await Application.findById(created.id).lean();
    expect(persisted.version).toBe(1);
    expect(persisted.status).toBe(APPLICATION_STATUS.APPLIED);
  });

  it("exposes Candidate replace endpoint with ownership/CAS semantics", async () => {
    vi.spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/initial-snapshot",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replaced-snapshot",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/stale-snapshot",
      });

    const { owner, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Initial HTTP"),
    });
    const replacementCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Replacement HTTP"),
    });
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: owner.email,
    });
    const response = await agent
      .put(`/api/candidate/applications/${created.id}/submitted-cv`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        candidateCvId: replacementCv._id.toString(),
        expectedVersion: 0,
      });
    expect(response.status).toBe(200);
    expect(response.body.application.version).toBe(1);
    expect(response.body.application.status).toBe(APPLICATION_STATUS.APPLIED);

    const staleResponse = await agent
      .put(`/api/candidate/applications/${created.id}/submitted-cv`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        candidateCvId: initialCv._id.toString(),
        expectedVersion: 0,
      });
    expect(staleResponse.status).toBe(409);
  });

  it("does not mutate source CandidateCV while replacing Generated snapshot", async () => {
    vi.spyOn(fileService, "uploadFileBuffer")
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/initial-generated",
      })
      .mockResolvedValueOnce({
        publicId: "jobhub/applications/submitted-cv-snapshots/replaced-generated",
      });

    const { owner, job, category } = await setupBaseline();
    const initialCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Initial Source"),
    });
    const replacementCv = await createGeneratedCv({
      candidateUserId: owner._id,
      categoryId: category._id,
      generatedContent: completeGeneratedContent("Replacement Source"),
    });
    const replacementBefore = await CandidateCV.findById(replacementCv._id).lean();
    const created = await directApplyToJob({
      candidateUserId: owner._id,
      actorUser: owner,
      jobId: job._id.toString(),
      candidateCvId: initialCv._id.toString(),
    });

    await replaceSubmittedCv({
      candidateUserId: owner._id,
      actorUser: owner,
      applicationId: created.id.toString(),
      candidateCvId: replacementCv._id.toString(),
      expectedVersion: 0,
    });

    await saveOwnGeneratedContent({
      candidateUserId: owner._id,
      actorUser: owner,
      candidateCvId: replacementCv._id.toString(),
      generatedContent: completeGeneratedContent("Live Changed After Replace"),
    });

    const replacementAfter = await CandidateCV.findById(replacementCv._id).lean();
    expect(replacementAfter.sourceType).toBe(replacementBefore.sourceType);
    expect(replacementAfter.status).toBe(replacementBefore.status);

    const persisted = await Application.findById(created.id).lean();
    expect(
      persisted.submittedCvSnapshot.generatedContent.personalInfo.fullName,
    ).toBe("Replacement Source");
  });
});
