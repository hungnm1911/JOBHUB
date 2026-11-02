import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { migrate, preflight } from "../../src/database/migrations/v17-legacy-rich-text-backfill.js";
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from "../helpers/database.js";

const { ObjectId } = mongoose.Types;
const originalTime = new Date("2025-01-01T00:00:00.000Z");
const collections = ["jobs", "candidate_cvs", "applications", "jobinvitations"];

const snapshot = async () => Object.fromEntries(await Promise.all(collections.map(async (name) => [
  name,
  await mongoose.connection.db.collection(name).find({}).sort({ _id: 1 }).toArray(),
])));

const seed = async () => {
  const ids = Object.fromEntries([
    "draft", "locked", "incompatible", "generated", "archived", "uploaded",
  ].map((key) => [key, new ObjectId()]));
  const jobBase = { companyId: new ObjectId(), createdByCompanyMemberId: new ObjectId(),
    primaryRecruiterCompanyMemberId: new ObjectId(),
    supportingRecruiterCompanyMemberIds: [] };
  await mongoose.connection.db.collection("jobs").insertMany([
    { ...jobBase, _id: ids.draft, status: "DRAFT", salary: null,
      jobDescription: "A <b>literal</b> & B", jobDescriptionHtml: null,
      updatedAt: originalTime },
    { ...jobBase, _id: ids.locked, status: "PUBLISHED",
      salary: { type: "NEGOTIABLE", minAmount: null, maxAmount: null,
        period: null, customPeriodLabel: null }, jobDescription: "Locked text",
      updatedAt: originalTime },
    { ...jobBase, _id: ids.incompatible, status: "DRAFT", salary: null,
      jobDescription: "  leading space", updatedAt: originalTime },
  ], { bypassDocumentValidation: true });
  await mongoose.connection.db.collection("candidate_cvs").insertMany([
    { _id: ids.generated, sourceType: "GENERATED", status: "ACTIVE",
      archivedAt: null, updatedAt: originalTime,
      generatedContent: {
        professionalSummary: "Engineer & mentor", professionalSummaryHtml: null,
        workExperiences: [
          { description: "First\nSecond", descriptionHtml: null },
          { description: "Already rich", descriptionHtml: "<p>Already <strong>rich</strong></p>" },
        ],
        projects: [{ description: "Use <script> literally" }],
      } },
    { _id: ids.archived, sourceType: "GENERATED", status: "ACTIVE",
      archivedAt: originalTime, generatedContent: { professionalSummary: "Archived" } },
    { _id: ids.uploaded, sourceType: "UPLOADED", status: "ACTIVE",
      archivedAt: null, generatedContent: { professionalSummary: "Unexpected" } },
  ], { bypassDocumentValidation: true });
  await mongoose.connection.db.collection("applications").insertOne({
    _id: new ObjectId(), submittedCvSnapshot: {
      sourceCandidateCvId: ids.generated,
      generatedContent: { professionalSummary: "Historical summary" },
    },
  }, { bypassDocumentValidation: true });
  await mongoose.connection.db.collection("jobinvitations").insertOne({
    _id: new ObjectId(), invitedCvId: ids.generated, status: "PENDING",
    invitedCvSnapshot: { generatedContent: { professionalSummary: "Invited summary" } },
  }, { bypassDocumentValidation: true });
  return ids;
};

describe("V17 Slice 05 — legacy rich text backfill", () => {
  beforeAll(connectTestDatabase);
  afterEach(clearDatabase);
  afterAll(disconnectTestDatabase);

  it("previews eligibility without changing documents, collections, or indexes", async () => {
    await seed();
    const before = await snapshot();
    const indexesBefore = await Promise.all(collections.map((name) =>
      mongoose.connection.db.collection(name).indexes()));

    const report = await preflight();

    expect(report.mode).toBe("preflight");
    expect(report.jobs).toMatchObject({ scanned: 3, eligibleRecords: 1,
      eligibleFields: 1, excludedRecords: 1, incompatiblePlainFields: 1,
      modifiedRecords: 0 });
    expect(report.candidateCvs).toMatchObject({ scanned: 3, eligibleRecords: 1,
      eligibleFields: 3, existingHtmlFields: 1, excludedRecords: 2,
      modifiedRecords: 0 });
    expect(await snapshot()).toEqual(before);
    expect(await Promise.all(collections.map((name) =>
      mongoose.connection.db.collection(name).indexes()))).toEqual(indexesBefore);
  });

  it("adds only exact-compatible escaped HTML and is idempotent while preserving history", async () => {
    const ids = await seed();
    const before = await snapshot();

    const first = await migrate();
    const after = await snapshot();

    expect(first.jobs.modifiedRecords).toBe(1);
    expect(first.candidateCvs.modifiedRecords).toBe(1);
    expect(after.jobs.find((job) => job._id.equals(ids.draft))).toMatchObject({
      jobDescription: "A <b>literal</b> & B",
      jobDescriptionHtml: "<p>A &lt;b&gt;literal&lt;/b&gt; &amp; B</p>",
      updatedAt: originalTime,
    });
    expect(after.jobs.find((job) => job._id.equals(ids.locked))).toEqual(
      before.jobs.find((job) => job._id.equals(ids.locked)));
    expect(after.jobs.find((job) => job._id.equals(ids.incompatible))).toEqual(
      before.jobs.find((job) => job._id.equals(ids.incompatible)));
    const generated = after.candidate_cvs.find((cv) => cv._id.equals(ids.generated));
    expect(generated.updatedAt).toEqual(originalTime);
    expect(generated.generatedContent).toMatchObject({
      professionalSummary: "Engineer & mentor",
      professionalSummaryHtml: "<p>Engineer &amp; mentor</p>",
      workExperiences: [
        { description: "First\nSecond", descriptionHtml: "<p>First<br />Second</p>" },
        { description: "Already rich", descriptionHtml: "<p>Already <strong>rich</strong></p>" },
      ],
      projects: [{ description: "Use <script> literally",
        descriptionHtml: "<p>Use &lt;script&gt; literally</p>" }],
    });
    expect(after.candidate_cvs.filter((cv) => !cv._id.equals(ids.generated))).toEqual(
      before.candidate_cvs.filter((cv) => !cv._id.equals(ids.generated)));
    expect(after.applications).toEqual(before.applications);
    expect(after.jobinvitations).toEqual(before.jobinvitations);

    const second = await migrate();
    expect(second.jobs.modifiedRecords).toBe(0);
    expect(second.candidateCvs.modifiedRecords).toBe(0);
    expect(await snapshot()).toEqual(after);
  });
});
