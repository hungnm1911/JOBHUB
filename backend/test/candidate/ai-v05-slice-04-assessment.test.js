import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), normalizeJob: vi.fn(), assess: vi.fn() }));
vi.mock("../../src/services/candidate-job-recommendation-retrieval.service.js", () => ({
  retrieveOwnDefaultCvJobCandidates: mocks.retrieve,
}));
vi.mock("../../src/services/job-ai-normalization.service.js", () => ({
  normalizeCandidateVisibleJob: mocks.normalizeJob,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({
  aiKit: { assessRecommendationBatch: mocks.assess },
}));

import { assessOwnDefaultCvJobCandidates } from "../../src/services/candidate-job-recommendation-assessment.service.js";
import { InvalidJobNormalizationSourceError } from "../../src/services/job-ai-normalization-core.service.js";

const actorUser = { _id: "candidate" };
const cvNormalizationResult = { status: "READY", profile: { source: { candidateCvId: "cv" } } };
const candidates = Array.from({ length: 15 }, (_, index) => ({
  job: { _id: `job-${index + 1}` }, vectorScore: 1 - index / 100,
  retrievalRank: index + 1,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.retrieve.mockResolvedValue({ cvNormalizationResult, candidates });
  mocks.normalizeJob.mockImplementation(async ({ jobId }) => ({ status: "READY", profile: {
    source: { jobId },
  } }));
  mocks.assess.mockImplementation(async ({ jobs }) => jobs.map(({ jobKey }) => ({ jobKey,
    requirementGroups: [], reason: `Reason ${jobKey}` })));
});

describe("AI-V05 Slice 04 Backend handoff", () => {
  it("assesses the first 12 Vector-ranked Jobs with the same READY CV profile", async () => {
    const result = await assessOwnDefaultCvJobCandidates({ actorUser });
    expect(mocks.retrieve).toHaveBeenCalledOnce();
    expect(mocks.normalizeJob).toHaveBeenCalledTimes(12);
    expect(mocks.normalizeJob.mock.calls.map(([input]) => input)).toEqual(
      candidates.slice(0, 12).map(({ job }) => ({
        actorUser, jobId: job._id, strictFailures: true,
      })),
    );
    expect(mocks.assess).toHaveBeenCalledOnce();
    expect(mocks.assess.mock.calls[0][0].cvNormalizationResult).toBe(cvNormalizationResult);
    expect(mocks.assess.mock.calls[0][0].jobs.map(({ jobKey }) => jobKey))
      .toEqual(Array.from({ length: 12 }, (_, index) => `J${index + 1}`));
    expect(result).toHaveLength(12);
    expect(result[0].cvNormalizationResult).toBe(cvNormalizationResult);
    expect(result[11]).toMatchObject({ jobId: "job-12", vectorScore: 0.89,
      assessment: { reason: "Reason J12" } });
  });

  it("accepts an adjustable batch size", async () => {
    const result = await assessOwnDefaultCvJobCandidates({ actorUser, batchSize: 2 });
    expect(result).toHaveLength(2);
    expect(mocks.normalizeJob).toHaveBeenCalledTimes(2);
    expect(mocks.assess).toHaveBeenCalledOnce();
  });

  it("does not infer for an empty retrieval", async () => {
    mocks.retrieve.mockResolvedValue({ cvNormalizationResult, candidates: [] });
    expect(await assessOwnDefaultCvJobCandidates({ actorUser })).toEqual([]);
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it("skips only identified invalid Jobs and keeps retrieval order and actual batch keys", async () => {
    mocks.normalizeJob.mockImplementation(async ({ jobId }) => {
      if (jobId === "job-2" || jobId === "job-4") {
        throw new InvalidJobNormalizationSourceError(500, "Invalid Job source");
      }
      return { status: "READY", profile: { source: { jobId } } };
    });
    const result = await assessOwnDefaultCvJobCandidates({ actorUser, batchSize: 4 });
    expect(result.map(({ jobId, retrievalRank, jobKey }) => ({ jobId, retrievalRank, jobKey })))
      .toEqual([{ jobId: "job-1", retrievalRank: 1, jobKey: "J1" },
        { jobId: "job-3", retrievalRank: 3, jobKey: "J2" }]);
    expect(mocks.assess.mock.calls[0][0].jobs.map(({ jobKey }) => jobKey)).toEqual(["J1", "J2"]);
  });

  it("returns an empty result without inference when all shortlisted Jobs are invalid", async () => {
    mocks.normalizeJob.mockRejectedValue(new InvalidJobNormalizationSourceError(500, "Invalid Job source"));
    expect(await assessOwnDefaultCvJobCandidates({ actorUser, batchSize: 2 })).toEqual([]);
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it("propagates dependency failures and unclassified FAILED results", async () => {
    const failure = new Error("MongoDB unavailable");
    mocks.normalizeJob.mockRejectedValueOnce(failure);
    await expect(assessOwnDefaultCvJobCandidates({ actorUser })).rejects.toBe(failure);
    expect(mocks.assess).not.toHaveBeenCalled();
    mocks.normalizeJob.mockResolvedValueOnce({ status: "FAILED", profile: null });
    await expect(assessOwnDefaultCvJobCandidates({ actorUser })).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.assess).not.toHaveBeenCalled();
  });

  it("fails the whole request when Job normalization or batch assessment fails", async () => {
    mocks.normalizeJob.mockResolvedValueOnce({ status: "FAILED" });
    await expect(assessOwnDefaultCvJobCandidates({ actorUser })).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.assess).not.toHaveBeenCalled();
    mocks.normalizeJob.mockImplementation(async ({ jobId }) => ({ status: "READY", profile: {
      source: { jobId },
    } }));
    const failure = new Error("Invalid batch");
    mocks.assess.mockRejectedValue(failure);
    await expect(assessOwnDefaultCvJobCandidates({ actorUser })).rejects.toBe(failure);
  });
});
