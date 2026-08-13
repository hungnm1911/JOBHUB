import { PDFDocument } from "pdf-lib";
import mongoose from "mongoose";

import APPLICATION_SOURCE from "../constants/application-source.js";
import APPLICATION_STATUS from "../constants/application-status.js";
import APPLICATION_SUBMITTED_CV_STORAGE from "../constants/application-submitted-cv-storage.js";
import CANDIDATE_CV_SOURCE_TYPE from "../constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../constants/candidate-cv-status.js";
import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import CANDIDATE_CV_UPLOADED_STORAGE from "../constants/candidate-cv-uploaded-storage.js";
import CLOUDINARY_FOLDER from "../constants/cloudinary-folder.js";
import USER_ROLE from "../constants/user-role.js";
import USER_STATUS from "../constants/user-status.js";
import Application from "../models/application.model.js";
import CandidateCV from "../models/candidate-cv.model.js";
import Company from "../models/company.model.js";
import CompanyMember from "../models/company-member.model.js";
import Job from "../models/job.model.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";
import { renderHarvardCandidateCvPdf } from "./candidate-cv-harvard-pdf.service.js";
import {
  assertSameCompanyTenant,
  resolveRecruiterBusinessContext,
} from "./company.service.js";
import { deleteFile, downloadFileBuffer, uploadFileBuffer } from "./file.service.js";
import { isJobPubliclyEligible, toPublicJob } from "./job.service.js";

const uploadApplicationSubmittedCvSnapshotFile = (buffer) => {
  return uploadFileBuffer({
    buffer,
    assetFolder: CLOUDINARY_FOLDER.APPLICATION_SUBMITTED_CV_SNAPSHOTS,
    resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
    deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
  });
};

const deleteApplicationSubmittedCvSnapshotFile = (publicId) => {
  return deleteFile({
    publicId,
    resourceType: APPLICATION_SUBMITTED_CV_STORAGE.RESOURCE_TYPE,
    deliveryType: APPLICATION_SUBMITTED_CV_STORAGE.DELIVERY_TYPE,
  });
};

const isMongoDuplicateKeyError = (error) => {
  return error?.code === 11000;
};

const assertCandidateActor = (user) => {
  if (!user || user.role !== USER_ROLE.CANDIDATE) {
    throw new AppError(403, "Candidate access required");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new AppError(403, "Candidate account is not active");
  }
};

const deepCopyGeneratedContent = (generatedContent) => {
  if (generatedContent == null) {
    return null;
  }

  if (typeof generatedContent.toObject === "function") {
    return generatedContent.toObject();
  }

  return JSON.parse(JSON.stringify(generatedContent));
};

const toPublicSnapshotPdfFile = (pdfFile) => {
  if (pdfFile == null) {
    return null;
  }

  return {
    originalFileName: pdfFile.originalFileName,
    mimeType: pdfFile.mimeType,
    sizeBytes: pdfFile.sizeBytes,
    pageCount: pdfFile.pageCount,
  };
};

const toPublicSubmittedCvSnapshot = (submittedCvSnapshot) => {
  if (submittedCvSnapshot == null) {
    return null;
  }

  const result = {
    sourceCandidateCvId: submittedCvSnapshot.sourceCandidateCvId,
    name: submittedCvSnapshot.name,
    sourceType: submittedCvSnapshot.sourceType,
    pdfFile: toPublicSnapshotPdfFile(submittedCvSnapshot.pdfFile),
    capturedAt: submittedCvSnapshot.capturedAt,
  };

  if (submittedCvSnapshot.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    result.generatedContent = deepCopyGeneratedContent(
      submittedCvSnapshot.generatedContent,
    );
  }

  return result;
};

const toPublicApplication = (application) => {
  return {
    id: application._id,
    candidateUserId: application.candidateUserId,
    jobId: application.jobId,
    source: application.source,
    status: application.status,
    submittedCvSnapshot: toPublicSubmittedCvSnapshot(
      application.submittedCvSnapshot,
    ),
    appliedAt: application.appliedAt,
    withdrawnAt: application.withdrawnAt,
    withdrawReason: application.withdrawReason,
    version: application.version,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

// BR-05 / PI-05: Unassigned is assignment-state only (absent or null), never a status.
const isApplicationUnassigned = (application) => {
  return application?.assignedRecruiterCompanyMemberId == null;
};

const toPublicCandidateSummary = (user) => {
  if (user == null) {
    return null;
  }

  return {
    id: user._id.toString(),
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? null,
  };
};

const toPublicAssignedRecruiterSummary = ({ membership, user } = {}) => {
  if (membership == null) {
    return null;
  }

  return {
    companyMemberId: membership._id.toString(),
    jobTitle: membership.jobTitle ?? null,
    fullName: user?.fullName ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  };
};

const toPrimaryJobApplicationView = (
  application,
  { candidate, assignedRecruiter } = {},
) => {
  const assignedRecruiterCompanyMemberId =
    application.assignedRecruiterCompanyMemberId == null
      ? null
      : application.assignedRecruiterCompanyMemberId.toString();

  return {
    id: application._id.toString(),
    candidateUserId: application.candidateUserId.toString(),
    jobId: application.jobId.toString(),
    source: application.source,
    status: application.status,
    assignedRecruiterCompanyMemberId,
    isUnassigned: isApplicationUnassigned(application),
    assignedRecruiter: assignedRecruiter ?? null,
    candidate: candidate ?? null,
    submittedCvSnapshot: toPublicSubmittedCvSnapshot(
      application.submittedCvSnapshot,
    ),
    appliedAt: application.appliedAt,
    withdrawnAt: application.withdrawnAt,
    withdrawReason: application.withdrawReason,
    version: application.version,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

const listPrimaryJobApplications = async ({
  actorUser,
  jobId,
  clientCompanyId,
} = {}) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const context = await resolveRecruiterBusinessContext({
    user: actorUser,
    clientCompanyId,
  });

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  // BR-40: tenant from trusted membership → Job.companyId, never client companyId alone.
  assertSameCompanyTenant({
    resourceCompanyId: job.companyId,
    tenantCompanyId: context.companyId,
  });

  if (
    job.primaryRecruiterCompanyMemberId.toString() !==
    context.membership._id.toString()
  ) {
    throw new AppError(
      403,
      "Only the current Primary Recruiter can view Applications for this Job",
      { field: "role" },
    );
  }

  // BR-44: V10 Primary Application View only covers Direct Applications.
  const applications = await Application.find({
    jobId: job._id,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
  }).sort({ appliedAt: 1, _id: 1 });

  const candidateUserIds = [
    ...new Set(
      applications.map((application) => application.candidateUserId.toString()),
    ),
  ];
  const assigneeMemberIds = [
    ...new Set(
      applications
        .filter((application) => !isApplicationUnassigned(application))
        .map((application) =>
          application.assignedRecruiterCompanyMemberId.toString(),
        ),
    ),
  ];

  const [candidates, assigneeMemberships] = await Promise.all([
    candidateUserIds.length === 0
      ? []
      : User.find({ _id: { $in: candidateUserIds } }).select(
          "fullName avatarUrl",
        ),
    assigneeMemberIds.length === 0
      ? []
      : CompanyMember.find({ _id: { $in: assigneeMemberIds } }).select(
          "userId jobTitle",
        ),
  ]);

  const candidateById = new Map(
    candidates.map((candidate) => [candidate._id.toString(), candidate]),
  );
  const assigneeMembershipById = new Map(
    assigneeMemberships.map((membership) => [
      membership._id.toString(),
      membership,
    ]),
  );

  const assigneeUserIds = [
    ...new Set(
      assigneeMemberships.map((membership) => membership.userId.toString()),
    ),
  ];
  const assigneeUsers =
    assigneeUserIds.length === 0
      ? []
      : await User.find({ _id: { $in: assigneeUserIds } }).select(
          "fullName avatarUrl",
        );
  const assigneeUserById = new Map(
    assigneeUsers.map((user) => [user._id.toString(), user]),
  );

  const applicationViews = applications.map((application) => {
    const candidate = toPublicCandidateSummary(
      candidateById.get(application.candidateUserId.toString()),
    );

    let assignedRecruiter = null;

    if (!isApplicationUnassigned(application)) {
      const membership = assigneeMembershipById.get(
        application.assignedRecruiterCompanyMemberId.toString(),
      );
      const assigneeUser =
        membership == null
          ? null
          : assigneeUserById.get(membership.userId.toString());

      assignedRecruiter = toPublicAssignedRecruiterSummary({
        membership,
        user: assigneeUser,
      });
    }

    return toPrimaryJobApplicationView(application, {
      candidate,
      assignedRecruiter,
    });
  });

  return {
    job: toPublicJob(job),
    applications: applicationViews,
  };
};

const loadJobAcceptingDirectApplications = async (jobId, now = new Date()) => {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const job = await Job.findById(jobId);

  if (!job) {
    throw new AppError(404, "Job not found", {
      field: "jobId",
    });
  }

  const company = await Company.findById(job.companyId);

  if (!isJobPubliclyEligible({ job, company, now })) {
    throw new AppError(409, "Job is not accepting applications", {
      field: "jobId",
    });
  }

  return job;
};

const downloadUploadedCandidateCvFile = (publicId) => {
  return downloadFileBuffer({
    publicId,
    resourceType: CANDIDATE_CV_UPLOADED_STORAGE.RESOURCE_TYPE,
    deliveryType: CANDIDATE_CV_UPLOADED_STORAGE.DELIVERY_TYPE,
  });
};

const loadEligibleCandidateCvForDirectApply = async ({
  candidateUserId,
  candidateCvId,
}) => {
  if (!mongoose.isValidObjectId(candidateCvId)) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  const candidateCv = await CandidateCV.findOne({
    _id: candidateCvId,
    candidateUserId,
  });

  if (!candidateCv) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  if (candidateCv.archivedAt != null) {
    throw new AppError(409, "Archived Candidate CV cannot be used to apply", {
      field: "candidateCvId",
    });
  }

  if (candidateCv.status !== CANDIDATE_CV_STATUS.ACTIVE) {
    throw new AppError(409, "Only ACTIVE Candidate CVs can be used to apply", {
      field: "status",
    });
  }

  if (candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.UPLOADED) {
    if (
      candidateCv.uploadedFile == null ||
      typeof candidateCv.uploadedFile.storageKey !== "string" ||
      candidateCv.uploadedFile.storageKey.trim() === ""
    ) {
      throw new AppError(409, "Uploaded Candidate CV is missing current file", {
        field: "candidateCvId",
      });
    }
  } else if (candidateCv.sourceType !== CANDIDATE_CV_SOURCE_TYPE.GENERATED) {
    throw new AppError(404, "Candidate CV not found", {
      field: "candidateCvId",
    });
  }

  return candidateCv;
};

const buildSnapshotOriginalFileName = (candidateCvName) => {
  const trimmedName =
    typeof candidateCvName === "string" ? candidateCvName.trim() : "";

  if (trimmedName === "") {
    return "submitted-cv.pdf";
  }

  return trimmedName.toLowerCase().endsWith(".pdf")
    ? trimmedName
    : `${trimmedName}.pdf`;
};

const resolveUploadedSnapshotOriginalFileName = (candidateCv) => {
  const uploadedOriginalFileName =
    typeof candidateCv.uploadedFile?.originalFileName === "string"
      ? candidateCv.uploadedFile.originalFileName.trim()
      : "";

  if (uploadedOriginalFileName !== "") {
    return uploadedOriginalFileName;
  }

  return buildSnapshotOriginalFileName(candidateCv.name);
};

const captureUploadedSubmittedCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
}) => {
  let pdfBuffer;

  try {
    pdfBuffer = await downloadUploadedCandidateCvFile(
      candidateCv.uploadedFile.storageKey,
    );
  } catch {
    throw new AppError(502, "Failed to retrieve Uploaded CV PDF for snapshot", {
      field: "candidateCvId",
    });
  }

  const storedFile = await uploadApplicationSubmittedCvSnapshotFile(pdfBuffer);
  const pageCount = candidateCv.uploadedFile.pageCount;
  const sizeBytes = candidateCv.uploadedFile.sizeBytes ?? pdfBuffer.length;

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError(502, "Failed to capture Uploaded CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes < 1) {
    throw new AppError(502, "Failed to capture Uploaded CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  return {
    snapshot: {
      sourceCandidateCvId: candidateCv._id,
      name: candidateCv.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: storedFile.publicId,
        originalFileName: resolveUploadedSnapshotOriginalFileName(candidateCv),
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes,
        pageCount,
      },
      capturedAt,
    },
    storageKey: storedFile.publicId,
  };
};

const captureGeneratedSubmittedCvSnapshot = async ({
  candidateCv,
  capturedAt = new Date(),
}) => {
  const generatedContent = deepCopyGeneratedContent(
    candidateCv.generatedContent,
  );
  const pdfBuffer = await renderHarvardCandidateCvPdf(generatedContent);
  const pdfDocument = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDocument.getPageCount();

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new AppError(502, "Failed to render Generated CV snapshot PDF", {
      field: "candidateCvId",
    });
  }

  const storedFile = await uploadApplicationSubmittedCvSnapshotFile(pdfBuffer);

  return {
    snapshot: {
      sourceCandidateCvId: candidateCv._id,
      name: candidateCv.name,
      sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
      generatedContent,
      pdfFile: {
        storageKey: storedFile.publicId,
        originalFileName: buildSnapshotOriginalFileName(candidateCv.name),
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: pdfBuffer.length,
        pageCount,
      },
      capturedAt,
    },
    storageKey: storedFile.publicId,
  };
};

const directApplyToJob = async ({
  candidateUserId,
  actorUser,
  jobId,
  candidateCvId,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only apply for themselves");
  }

  const job = await loadJobAcceptingDirectApplications(jobId);
  const candidateCv = await loadEligibleCandidateCvForDirectApply({
    candidateUserId,
    candidateCvId,
  });

  const existingApplication = await Application.findOne({
    candidateUserId,
    jobId: job._id,
  }).select("_id");

  if (existingApplication) {
    throw new AppError(
      409,
      "Application already exists for this Candidate and Job",
      {
        field: "jobId",
      },
    );
  }

  let uploadedSnapshotStorageKey = null;

  try {
    const capturedAt = new Date();
    const captureSubmittedCvSnapshot =
      candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
        ? captureGeneratedSubmittedCvSnapshot
        : captureUploadedSubmittedCvSnapshot;
    const { snapshot: submittedCvSnapshot, storageKey } =
      await captureSubmittedCvSnapshot({
        candidateCv,
        capturedAt,
      });
    uploadedSnapshotStorageKey = storageKey;

    const application = await Application.create({
      candidateUserId,
      jobId: job._id,
      source: APPLICATION_SOURCE.DIRECT_APPLICATION,
      status: APPLICATION_STATUS.APPLIED,
      submittedCvSnapshot,
      appliedAt: new Date(),
      withdrawnAt: null,
      withdrawReason: null,
      // V10: Unassigned is assignment-state only; normalize on Direct Apply write.
      assignedRecruiterCompanyMemberId: null,
      version: 0,
    });

    return toPublicApplication(application);
  } catch (error) {
    if (uploadedSnapshotStorageKey) {
      try {
        await deleteApplicationSubmittedCvSnapshotFile(
          uploadedSnapshotStorageKey,
        );
      } catch {
        // Best-effort orphan cleanup when DB commit fails.
      }
    }

    if (isMongoDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "Application already exists for this Candidate and Job",
        {
          field: "jobId",
        },
      );
    }

    throw error;
  }
};

const loadOwnedApplicationForReplace = async ({ candidateUserId, applicationId }) => {
  if (!mongoose.isValidObjectId(applicationId)) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  const application = await Application.findOne({
    _id: applicationId,
    candidateUserId,
  });

  if (!application) {
    throw new AppError(404, "Application not found", {
      field: "applicationId",
    });
  }

  return application;
};

const replaceSubmittedCv = async ({
  candidateUserId,
  actorUser,
  applicationId,
  candidateCvId,
  expectedVersion,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only replace Applications for themselves");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  const application = await loadOwnedApplicationForReplace({
    candidateUserId,
    applicationId,
  });

  if (application.status !== APPLICATION_STATUS.APPLIED) {
    throw new AppError(409, "Only APPLIED Applications can replace Submitted CV", {
      field: "status",
    });
  }

  await loadJobAcceptingDirectApplications(application.jobId);
  const candidateCv = await loadEligibleCandidateCvForDirectApply({
    candidateUserId,
    candidateCvId,
  });

  const capturedAt = new Date();
  const captureSubmittedCvSnapshot =
    candidateCv.sourceType === CANDIDATE_CV_SOURCE_TYPE.GENERATED
      ? captureGeneratedSubmittedCvSnapshot
      : captureUploadedSubmittedCvSnapshot;
  let uploadedSnapshotStorageKey = null;

  try {
    const { snapshot: submittedCvSnapshot, storageKey } =
      await captureSubmittedCvSnapshot({
        candidateCv,
        capturedAt,
      });
    uploadedSnapshotStorageKey = storageKey;

    const replacedApplication = await Application.findOneAndUpdate(
      {
        _id: application._id,
        candidateUserId,
        status: APPLICATION_STATUS.APPLIED,
        version: expectedVersion,
      },
      {
        $set: {
          submittedCvSnapshot,
        },
        $inc: {
          version: 1,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!replacedApplication) {
      const latestApplication = await Application.findById(application._id);

      if (latestApplication?.status !== APPLICATION_STATUS.APPLIED) {
        throw new AppError(
          409,
          "Application is no longer APPLIED and cannot replace Submitted CV",
          {
            field: "status",
          },
        );
      }

      throw new AppError(409, "Application has changed; refresh and retry replace", {
        field: "expectedVersion",
      });
    }

    return toPublicApplication(replacedApplication);
  } catch (error) {
    if (uploadedSnapshotStorageKey) {
      try {
        await deleteApplicationSubmittedCvSnapshotFile(uploadedSnapshotStorageKey);
      } catch {
        // Best-effort orphan cleanup when DB commit fails.
      }
    }

    throw error;
  }
};

const withdrawApplication = async ({
  candidateUserId,
  actorUser,
  applicationId,
  expectedVersion,
  withdrawReason,
}) => {
  assertCandidateActor(actorUser);

  if (!candidateUserId.equals(actorUser._id)) {
    throw new AppError(403, "Candidates may only withdraw Applications for themselves");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AppError(400, "expectedVersion must be a non-negative integer", {
      field: "expectedVersion",
    });
  }

  const application = await loadOwnedApplicationForReplace({
    candidateUserId,
    applicationId,
  });

  if (application.status !== APPLICATION_STATUS.APPLIED) {
    throw new AppError(409, "Only APPLIED Applications can be withdrawn", {
      field: "status",
    });
  }

  const normalizedWithdrawReason =
    typeof withdrawReason === "string" ? withdrawReason.trim() || null : null;
  const withdrawnAt = new Date();
  const withdrawnApplication = await Application.findOneAndUpdate(
    {
      _id: application._id,
      candidateUserId,
      status: APPLICATION_STATUS.APPLIED,
      version: expectedVersion,
    },
    {
      $set: {
        status: APPLICATION_STATUS.WITHDRAWN,
        withdrawnAt,
        withdrawReason: normalizedWithdrawReason,
      },
      $inc: {
        version: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!withdrawnApplication) {
    const latestApplication = await Application.findById(application._id);

    if (latestApplication?.status !== APPLICATION_STATUS.APPLIED) {
      throw new AppError(409, "Application is no longer APPLIED and cannot be withdrawn", {
        field: "status",
      });
    }

    throw new AppError(409, "Application has changed; refresh and retry withdraw", {
      field: "expectedVersion",
    });
  }

  return toPublicApplication(withdrawnApplication);
};

export {
  captureGeneratedSubmittedCvSnapshot,
  captureUploadedSubmittedCvSnapshot,
  deepCopyGeneratedContent,
  directApplyToJob,
  isApplicationUnassigned,
  listPrimaryJobApplications,
  loadEligibleCandidateCvForDirectApply,
  loadJobAcceptingDirectApplications,
  replaceSubmittedCv,
  withdrawApplication,
  toPrimaryJobApplicationView,
  toPublicApplication,
};
