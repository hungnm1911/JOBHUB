import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadPublicJob: vi.fn(), normalizeJob: vi.fn() }));
vi.mock("../../src/services/job-discovery.service.js", () => ({
  loadPublicJobDiscoverySource: mocks.loadPublicJob,
}));
vi.mock("../../src/services/ai-kit.service.js", () => ({ aiKit: { normalizeJob: mocks.normalizeJob } }));

import Category from "../../src/models/category.model.js";
import {
  InvalidJobNormalizationSourceError, normalizeLoadedJob,
} from "../../src/services/job-ai-normalization-core.service.js";
import { normalizeCandidateVisibleJob } from "../../src/services/job-ai-normalization.service.js";

const jobId = new mongoose.Types.ObjectId();
const source = {
  _id: jobId, title: "Engineer", jobDescription: null, requiredSkills: [],
  salary: null, fieldCategoryIds: [], positionCategoryIds: [],
  experienceLevelId: null, employmentType: null, workModes: [], location: null,
};
const loaded = (persistedJob = source) => ({
  job: { _id: jobId, toObject: () => persistedJob }, persistedJob,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(Category, "find").mockResolvedValue([]);
  mocks.normalizeJob.mockReturnValue({ status: "READY", profile: { source: { jobId: jobId.toString() } } });
});

describe("AI-V05 strict Job normalization boundary", () => {
  it("propagates a MongoDB failure from the Candidate source lookup", async () => {
    const failure = new mongoose.mongo.MongoNetworkError("lookup unavailable");
    mocks.loadPublicJob.mockRejectedValue(failure);
    await expect(normalizeCandidateVisibleJob({ jobId, strictFailures: true })).rejects.toBe(failure);
    expect(await normalizeCandidateVisibleJob({ jobId })).toEqual({ status: "FAILED", profile: null });
  });

  it("propagates a MongoDB taxonomy failure in strict mode while preserving V01 default", async () => {
    const failure = new mongoose.mongo.MongoNetworkError("taxonomy unavailable");
    vi.spyOn(Category, "find").mockRejectedValue(failure);
    await expect(normalizeLoadedJob(loaded(), { strictFailures: true })).rejects.toBe(failure);
    expect(await normalizeLoadedJob(loaded())).toEqual({ status: "FAILED", profile: null });
    expect(mocks.normalizeJob).not.toHaveBeenCalled();
  });

  it("classifies malformed projection and missing taxonomy as Job data errors", async () => {
    await expect(normalizeLoadedJob(loaded({ ...source, location: { provinceCode: "FOREIGN" } }),
      { strictFailures: true })).rejects.toBeInstanceOf(InvalidJobNormalizationSourceError);
    const categoryId = new mongoose.Types.ObjectId();
    await expect(normalizeLoadedJob(loaded({ ...source, fieldCategoryIds: [categoryId] }),
      { strictFailures: true })).rejects.toBeInstanceOf(InvalidJobNormalizationSourceError);
    expect(mocks.normalizeJob).not.toHaveBeenCalled();
  });

  it("propagates an unexpected AI Kit exception in strict mode", async () => {
    const failure = new Error("unexpected AI Kit exception");
    mocks.normalizeJob.mockImplementationOnce(() => { throw failure; });
    await expect(normalizeLoadedJob(loaded(), { strictFailures: true })).rejects.toBe(failure);
  });

  it("identifies only AI Kit's coded invalid Job input as a data error", async () => {
    const failure = Object.assign(new Error("invalid Job input"), {
      code: "INVALID_JOB_INPUT", details: ["/title is invalid"],
    });
    mocks.normalizeJob.mockImplementationOnce(() => { throw failure; });
    await expect(normalizeLoadedJob(loaded(), { strictFailures: true }))
      .rejects.toBeInstanceOf(InvalidJobNormalizationSourceError);
    expect(mocks.normalizeJob.mock.calls[0][1]).toEqual({ strictFailures: true });
  });
});
