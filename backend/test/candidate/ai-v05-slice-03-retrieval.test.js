import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cvFindOne: vi.fn(), normalizeGenerated: vi.fn(), normalizeUploaded: vi.fn(),
  buildQuery: vi.fn(), companyFind: vi.fn(), jobFind: vi.fn(), aggregate: vi.fn(),
}));

vi.mock("../../src/services/candidate-cv-ai-normalization.service.js", () => ({
  normalizeOwnGeneratedCandidateCv: mocks.normalizeGenerated,
  normalizeOwnUploadedCandidateCv: mocks.normalizeUploaded,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({
  aiKit: { buildCvQueryText: mocks.buildQuery },
}));
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Company from "../../src/models/company.model.js";
import Job from "../../src/models/job.model.js";
import { retrieveOwnDefaultCvJobCandidates } from "../../src/services/candidate-job-recommendation-retrieval.service.js";

const id = (value) => ({ toString: () => value, equals: (other) => other.toString() === value });
const actorUser = { _id: id("candidate-1"), role: "CANDIDATE", status: "ACTIVE" };
const cv = { _id: id("cv-1"), sourceType: "GENERATED", status: "ACTIVE" };
const company = { _id: id("company-1"), approvalStatus: "APPROVED", operationalStatus: "ACTIVE" };
const job = {
  _id: id("job-1"), companyId: company._id, status: "PUBLISHED",
  publishedAt: new Date("2026-10-01T00:00:00.000Z"),
  applicationDeadline: new Date("2099-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.spyOn(CandidateCV, "findOne").mockImplementation(mocks.cvFindOne);
  vi.spyOn(Company, "find").mockImplementation(mocks.companyFind);
  vi.spyOn(Job, "find").mockImplementation(mocks.jobFind);
  vi.spyOn(Job, "aggregate").mockImplementation(mocks.aggregate);
  mocks.cvFindOne.mockResolvedValue(cv);
  mocks.normalizeGenerated.mockResolvedValue({ status: "READY", profile: { source: {} } });
  mocks.buildQuery.mockReturnValue("Software Engineering; Node.js");
  mocks.companyFind.mockReturnValue({ select: () => ({ lean: async () => [company] }) });
  mocks.aggregate.mockResolvedValue([{ _id: job._id, vectorScore: 0.83 }]);
  mocks.jobFind.mockReturnValue({ lean: async () => [job] });
});

describe("AI-V05 Slice 03 retrieval", () => {
  it("pre-filters eligible Jobs and returns only revalidated DISCOVERABLE hits", async () => {
    const now = new Date("2026-10-25T00:00:00.000Z");
    const result = await retrieveOwnDefaultCvJobCandidates({ actorUser, now });
    const stage = mocks.aggregate.mock.calls[0][0][0].$vectorSearch;
    expect(stage).toMatchObject({
      index: "job_embedding_text_v05_vector_idx", path: "embeddingText",
      query: { text: "Software Engineering; Node.js" }, model: "voyage-4",
      filter: { status: "PUBLISHED", publishedAt: { $ne: null },
        applicationDeadline: { $gt: now }, companyId: { $in: [company._id] } },
    });
    expect(result).toEqual({ cvNormalizationResult: { status: "READY", profile: { source: {} } },
      candidates: [{ job, vectorScore: 0.83, retrievalRank: 1 }] });
    expect(mocks.cvFindOne).toHaveBeenCalledWith({
      candidateUserId: actorUser._id, isDefault: true, archivedAt: null,
    });
    expect(mocks.companyFind.mock.calls[0][0]).toEqual({
      approvalStatus: "APPROVED", operationalStatus: "ACTIVE",
    });
    expect(mocks.normalizeUploaded).not.toHaveBeenCalled();
  });

  it("drops historical hits after canonical visibility revalidation", async () => {
    mocks.jobFind.mockReturnValue({ lean: async () => [{
      ...job, applicationDeadline: new Date("2020-01-01T00:00:00.000Z"),
    }] });
    expect((await retrieveOwnDefaultCvJobCandidates({ actorUser })).candidates).toEqual([]);
  });

  it.each([
    ["closed", { status: "CLOSED" }],
    ["unpublished", { publishedAt: null }],
  ])("drops a %s Job through the real visibility owner", async (_label, changes) => {
    mocks.jobFind.mockReturnValue({ lean: async () => [{ ...job, ...changes }] });
    expect((await retrieveOwnDefaultCvJobCandidates({ actorUser })).candidates).toEqual([]);
  });

  it("drops a Job when its Company becomes inactive before revalidation", async () => {
    mocks.companyFind.mockReturnValueOnce({ select: () => ({ lean: async () => [company] }) });
    mocks.companyFind.mockReturnValueOnce({ select: () => ({ lean: async () => [
      { ...company, operationalStatus: "INACTIVE" },
    ] }) });
    expect((await retrieveOwnDefaultCvJobCandidates({ actorUser })).candidates).toEqual([]);
  });

  it("skips a Job without companyId while preserving hit order and revalidating valid Jobs", async () => {
    const malformedJob = { _id: id("job-bad") };
    const laterJob = { ...job, _id: id("job-2") };
    mocks.aggregate.mockResolvedValue([
      { _id: job._id, vectorScore: 0.9 },
      { _id: malformedJob._id, vectorScore: 0.8 },
      { _id: laterJob._id, vectorScore: 0.7 },
    ]);
    mocks.jobFind.mockReturnValue({ lean: async () => [laterJob, malformedJob, job] });

    const result = await retrieveOwnDefaultCvJobCandidates({ actorUser });

    expect(result.candidates).toEqual([
      { job, vectorScore: 0.9, retrievalRank: 1 },
      { job: laterJob, vectorScore: 0.7, retrievalRank: 3 },
    ]);
    expect(mocks.companyFind.mock.calls[1][0]).toEqual({ _id: { $in: ["company-1"] } });
  });

  it("propagates Company lookup failures instead of returning an empty result", async () => {
    const databaseError = new Error("Company lookup failed");
    mocks.companyFind.mockReturnValueOnce({ select: () => ({ lean: async () => [company] }) });
    mocks.companyFind.mockReturnValueOnce({ select: () => ({ lean: async () => { throw databaseError; } }) });

    await expect(retrieveOwnDefaultCvJobCandidates({ actorUser })).rejects.toBe(databaseError);
  });

  it("uses the existing Uploaded CV normalizer when the Default is Uploaded", async () => {
    mocks.cvFindOne.mockResolvedValue({ ...cv, sourceType: "UPLOADED" });
    mocks.normalizeUploaded.mockResolvedValue({ status: "READY", profile: { source: {} } });
    await retrieveOwnDefaultCvJobCandidates({ actorUser });
    expect(mocks.normalizeUploaded).toHaveBeenCalledOnce();
    expect(mocks.normalizeGenerated).not.toHaveBeenCalled();
  });

  it("does not query the provider when no Company is eligible", async () => {
    mocks.companyFind.mockReturnValue({ select: () => ({ lean: async () => [] }) });
    expect((await retrieveOwnDefaultCvJobCandidates({ actorUser })).candidates).toEqual([]);
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it("refuses a Default CV switch during normalization", async () => {
    mocks.cvFindOne.mockResolvedValueOnce(cv).mockResolvedValueOnce({ ...cv, _id: id("cv-2") });
    await expect(retrieveOwnDefaultCvJobCandidates({ actorUser })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["inactive", { ...cv, status: "DRAFT" }],
  ])("rejects a %s Default CV before normalization", async (_label, candidateCv) => {
    mocks.cvFindOne.mockResolvedValue(candidateCv);

    await expect(retrieveOwnDefaultCvJobCandidates({ actorUser })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.cvFindOne).toHaveBeenCalledWith({
      candidateUserId: actorUser._id, isDefault: true, archivedAt: null,
    });
    expect(mocks.normalizeGenerated).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it("excludes an archived Default CV through the owner lookup filter", async () => {
    const archivedCv = { ...cv, archivedAt: new Date("2026-10-01T00:00:00.000Z") };
    mocks.cvFindOne.mockImplementation(async (filter) =>
      filter.archivedAt === null ? null : archivedCv);

    await expect(retrieveOwnDefaultCvJobCandidates({ actorUser })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.cvFindOne).toHaveBeenCalledWith({
      candidateUserId: actorUser._id, isDefault: true, archivedAt: null,
    });
    expect(mocks.normalizeGenerated).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });

  it.each([
    ["Default CV lookup", "cv"],
    ["eligible Company lookup", "company"],
    ["vector retrieval", "aggregate"],
    ["Job hydration", "job"],
  ])("propagates %s DB failures", async (_label, stage) => {
    const databaseError = new Error(`${stage} failed`);
    if (stage === "cv") mocks.cvFindOne.mockRejectedValue(databaseError);
    if (stage === "company") {
      mocks.companyFind.mockReturnValue({ select: () => ({ lean: async () => { throw databaseError; } }) });
    }
    if (stage === "aggregate") mocks.aggregate.mockRejectedValue(databaseError);
    if (stage === "job") {
      mocks.jobFind.mockReturnValue({ lean: async () => { throw databaseError; } });
    }

    await expect(retrieveOwnDefaultCvJobCandidates({ actorUser })).rejects.toBe(databaseError);
  });
});
