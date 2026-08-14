import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import CandidateAvailability, {
  ensureCandidateAvailabilityCollection,
} from "../../src/models/candidate-availability.model.js";
import { submitCandidateAvailabilityFirstTime } from "../../src/services/application.service.js";
import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const productionEntryPath = path.join(backendRoot, "index.js");

const CAPTURED_AT = new Date("2026-08-14T00:00:00.000Z");
const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const findIndexByKey = (indexes, key) =>
  indexes.find((index) => {
    const indexKey = index.key;
    const expectedKeys = Object.keys(key);

    return (
      Object.keys(indexKey).length === expectedKeys.length &&
      expectedKeys.every((field) => indexKey[field] === key[field])
    );
  });

const readStartServerBody = () => {
  const source = fs.readFileSync(productionEntryPath, "utf8");
  const match = source.match(
    /const startServer = async \(\) => \{([\s\S]*?)\n\};/,
  );

  expect(match).not.toBeNull();

  return {
    source,
    startServerBody: match[1],
  };
};

const createJob = async ({ companyId, primaryMemberId }) =>
  Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: [],
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Availability Startup Job",
    jobDescription: "Build APIs",
    requiredSkills: ["Node.js"],
    salaryText: "1000-2000",
    fieldCategoryIds: [],
    positionCategoryIds: [],
    location: null,
    employmentType: null,
    workModes: [],
    experienceLevelId: null,
  });

const createContactedApplication = async ({
  candidateUserId,
  jobId,
  assigneeMemberId,
}) => {
  const application = await Application.create({
    candidateUserId,
    jobId,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: {
      sourceCandidateCvId: new mongoose.Types.ObjectId(),
      name: "Submitted CV",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      pdfFile: {
        storageKey: "applications/v12-startup.pdf",
        originalFileName: "v12-startup.pdf",
        mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
        sizeBytes: 100,
        pageCount: 1,
      },
      capturedAt: CAPTURED_AT,
    },
    appliedAt: CAPTURED_AT,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        status: APPLICATION_STATUS.CONTACTED,
        assignedRecruiterCompanyMemberId: assigneeMemberId,
        version: 1,
      },
    },
  );

  return Application.findById(application._id);
};

describe("V12 Candidate Availability production startup readiness (PI-01)", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("awaits Candidate Availability persistence readiness before opening the HTTP listener", () => {
    const { source, startServerBody } = readStartServerBody();

    expect(source).toMatch(
      /import\s*\{[^}]*ensureCandidateAvailabilityCollection[^}]*\}\s*from\s*["'].*candidate-availability\.model\.js["']/s,
    );

    const availabilityReadyAt = startServerBody.indexOf(
      "await ensureCandidateAvailabilityCollection(",
    );
    const httpListenAt = startServerBody.indexOf("await startHttpServer(");

    expect(availabilityReadyAt).toBeGreaterThanOrEqual(0);
    expect(httpListenAt).toBeGreaterThan(availabilityReadyAt);
  });

  it("does not open the HTTP listener when Candidate Availability initialization fails", () => {
    const { startServerBody } = readStartServerBody();

    const availabilityReadyAt = startServerBody.indexOf(
      "await ensureCandidateAvailabilityCollection(",
    );
    const httpListenAt = startServerBody.indexOf("await startHttpServer(");

    expect(availabilityReadyAt).toBeGreaterThanOrEqual(0);
    expect(httpListenAt).toBeGreaterThan(availabilityReadyAt);

    const betweenReadinessAndListen = startServerBody.slice(
      availabilityReadyAt,
      httpListenAt,
    );

    expect(betweenReadinessAndListen).not.toMatch(/\bcatch\s*\(/);
    expect(startServerBody).not.toMatch(
      /ensureCandidateAvailabilityCollection\([^)]*\)\s*\.catch\(/,
    );
  });

  it("requires a ready MongoDB connection before Candidate Availability readiness", async () => {
    await expect(
      ensureCandidateAvailabilityCollection({ readyState: 0 }),
    ).rejects.toThrow(
      "MongoDB connection must be ready before ensuring CandidateAvailability collection",
    );
  });

  it("keeps the unique applicationId index as the PI-01 enforcement owner", async () => {
    await ensureCandidateAvailabilityCollection(mongoose.connection);
    await CandidateAvailability.syncIndexes();

    const indexes = await CandidateAvailability.collection.indexes();
    const applicationIdIndex = findIndexByKey(indexes, { applicationId: 1 });

    expect(applicationIdIndex).toBeDefined();
    expect(applicationIdIndex.unique).toBe(true);
  });

  it("keeps PI-01 unique-index enforcement for concurrent first-submit Availability", async () => {
    await CandidateAvailability.syncIndexes();

    const manager = await createActiveCompanyManagerContext({
      email: "v12.startup.manager@example.com",
      businessRegistrationNumber: "BRN-V12-STARTUP",
    });
    const recruiter = await createActiveRecruiterContext({
      email: "v12.startup.recruiter@example.com",
      company: manager.company,
      employeeCode: "V12-STARTUP-R",
    });
    const candidate = await createVerifiedUser({
      email: "v12.startup.candidate@example.com",
    });
    const job = await createJob({
      companyId: manager.company._id,
      primaryMemberId: recruiter.membership._id,
    });
    const application = await createContactedApplication({
      candidateUserId: candidate.user._id,
      jobId: job._id,
      assigneeMemberId: recruiter.membership._id,
    });

    const results = await Promise.allSettled([
      submitCandidateAvailabilityFirstTime({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [{ date: "2026-08-14", dayPart: "MORNING" }],
        now: new Date("2026-08-14T01:00:00.000Z"),
      }),
      submitCandidateAvailabilityFirstTime({
        candidateUserId: candidate.user._id,
        actorUser: candidate.user,
        applicationId: application._id,
        timezone: "UTC",
        slots: [{ date: "2026-08-14", dayPart: "AFTERNOON" }],
        now: new Date("2026-08-14T01:00:00.000Z"),
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 409 });
    expect(await CandidateAvailability.countDocuments()).toBe(1);
  });
});
