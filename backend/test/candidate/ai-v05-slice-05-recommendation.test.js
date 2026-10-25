import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ assess: vi.fn(), score: vi.fn(), publicDetail: vi.fn() }));
vi.mock("../../src/services/candidate-job-recommendation-assessment.service.js", () => ({
  assessOwnDefaultCvJobCandidates: mocks.assess,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({
  aiKit: { scoreRecommendationAssessment: mocks.score },
}));
vi.mock("../../src/services/job-discovery.service.js", () => ({
  getPublicJobDiscoveryDetail: mocks.publicDetail,
}));

import { recommendOwnDefaultCvJobs } from "../../src/services/candidate-job-recommendation.service.js";

const actorUser = { _id: "candidate" };
const cvNormalizationResult = { status: "READY", profile: { source: { candidateCvId: "cv" } } };
const assessed = (index) => ({ jobId: `job-${index}`, jobKey: `J${index}`,
  cvNormalizationResult, jobNormalizationResult: { status: "READY",
    profile: { source: { jobId: `job-${index}` } } },
  assessment: { jobId: `job-${index}`, jobKey: `J${index}`,
    requirementGroups: [], reason: `Reason ${index}` } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assess.mockResolvedValue(Array.from({ length: 12 }, (_, index) => assessed(index + 1)));
  mocks.score.mockImplementation(({ jobNormalizationResult }) => ({
    jobId: jobNormalizationResult.profile.source.jobId,
    matchScore: Number(jobNormalizationResult.profile.source.jobId.slice(4)) * 5,
  }));
  mocks.publicDetail.mockImplementation(async ({ jobId }) => ({ id: jobId,
    effectiveState: "DISCOVERABLE", title: `Public ${jobId}` }));
});

describe("AI-V05 F04 final recommendation", () => {
  it("ranks by V03 Match Score, caps at 10, and preserves each Job reason", async () => {
    const result = await recommendOwnDefaultCvJobs({ actorUser });
    expect(result).toHaveLength(10);
    expect(result.map(({ job }) => job.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `job-${12 - index}`));
    expect(result[0]).toEqual({ job: { id: "job-12", effectiveState: "DISCOVERABLE",
      title: "Public job-12" }, matchScore: 60, reason: "Reason 12" });
    expect(mocks.assess).toHaveBeenCalledWith({ actorUser });
    expect(mocks.score).toHaveBeenCalledTimes(12);
    expect(mocks.score.mock.calls[0][0].cvNormalizationResult).toBe(cvNormalizationResult);
    expect(mocks.publicDetail).toHaveBeenCalledTimes(10);
  });

  it("rechecks canonical visibility and fills from lower scored Jobs without a threshold", async () => {
    mocks.publicDetail.mockImplementation(async ({ jobId }) => {
      if (jobId === "job-12") return { id: jobId, effectiveState: "HISTORICAL_READ_ONLY" };
      if (jobId === "job-11") throw { statusCode: 404 };
      return { id: jobId, effectiveState: "DISCOVERABLE" };
    });
    const result = await recommendOwnDefaultCvJobs({ actorUser });
    expect(result.map(({ job }) => job.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `job-${10 - index}`));
    expect(result.at(-1).matchScore).toBe(5);
    expect(mocks.publicDetail).toHaveBeenCalledTimes(12);
  });

  it("returns empty results without scoring or public reads", async () => {
    mocks.assess.mockResolvedValue([]);
    expect(await recommendOwnDefaultCvJobs({ actorUser })).toEqual([]);
    expect(mocks.score).not.toHaveBeenCalled();
    expect(mocks.publicDetail).not.toHaveBeenCalled();
  });

  it("accepts the persisted Job ObjectId and normalized string identity for the same Job", async () => {
    mocks.assess.mockResolvedValue([{ ...assessed(1), jobId: { toString: () => "job-1" } }]);
    const result = await recommendOwnDefaultCvJobs({ actorUser });
    expect(result).toHaveLength(1);
    expect(mocks.publicDetail).toHaveBeenCalledWith({ actorUser,
      jobId: expect.objectContaining({ toString: expect.any(Function) }) });
  });

  it("fails the request on scoring or public read dependency errors", async () => {
    mocks.score.mockImplementationOnce(() => { throw new TypeError("Invalid score"); });
    await expect(recommendOwnDefaultCvJobs({ actorUser })).rejects.toThrow("Invalid score");
    expect(mocks.publicDetail).not.toHaveBeenCalled();
    mocks.score.mockImplementation(({ jobNormalizationResult }) => ({
      jobId: jobNormalizationResult.profile.source.jobId, matchScore: 50,
    }));
    mocks.publicDetail.mockRejectedValue(new Error("Database unavailable"));
    await expect(recommendOwnDefaultCvJobs({ actorUser })).rejects.toThrow("Database unavailable");
  });
});
