import { beforeEach, describe, expect, it, vi } from "vitest";

const { codexCall } = vi.hoisted(() => ({ codexCall: vi.fn() }));
vi.mock("../src/llm/codex-client.js", () => ({
  createCodexClient: () => ({ createResponse: codexCall }),
}));

import { createBatchSemanticAssessor } from "../src/recommendation/batch-semantic-assessment.js";

const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const assess = createBatchSemanticAssessor({ llm: {
  codex: { apiKey: "offline", baseURL: "https://example.test", model: "model" },
}, logger });
const cvNormalizationResult = { status: "READY", profile: {
  source: { type: "GENERATED_CV", candidateCvId: "private-cv" },
  metadata: { skillTags: [{ value: "Node", sourcePath: "/skillTags/0" }] },
  freeText: { professionalSummary: null },
  content: { skills: [], workExperiences: [], projects: [], educations: [],
    certifications: [], languages: [] },
} };
const jobs = ["private-job-1", "private-job-2"].map((jobId, index) => ({
  jobKey: `J${index + 1}`,
  jobNormalizationResult: { status: "READY", profile: {
    source: { type: "JOB", jobId },
    metadata: { requiredSkills: [{ value: index ? "React" : "Node.js",
      sourcePath: "/requiredSkills/0" }] },
    freeText: { jobDescription: null },
  } },
}));
const group = (score = 100) => ({ requirement: "Skill", priority: "REQUIRED",
  semanticScore: score, evidenceState: score ? "SUPPORTED" : "NO_EVIDENCE",
  jobSourceIds: ["J0"], cvSourceIds: score ? ["C0"] : [] });
const output = { jobs: [
  { jobKey: "J1", requirementGroups: [group()], reason: "Node.js experience fits." },
  { jobKey: "J2", requirementGroups: [group(0)], reason: "React evidence is absent." },
] };
const response = (value) => ({ status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(value) }] }] });

beforeEach(() => { vi.clearAllMocks(); codexCall.mockResolvedValue(response(output)); });

describe("AI-V05 F03 batch semantic assessment", () => {
  it("uses one strict inference and resolves each Job's own sources", async () => {
    const result = await assess({ cvNormalizationResult, jobs });
    expect(codexCall).toHaveBeenCalledOnce();
    const request = codexCall.mock.calls[0][0];
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.text.format.schema.properties.jobs.items.required)
      .toEqual(["jobKey", "requirementGroups", "reason"]);
    expect(request.instructions).toContain("REQUIRED wins conflicts");
    expect(request.instructions).toContain("reason for each Job");
    const input = JSON.parse(request.input);
    expect(input.jobs.map((item) => item.jobKey)).toEqual(["J1", "J2"]);
    expect(request.input).not.toContain("private-job");
    expect(request.input).not.toContain("private-cv");
    expect(result.map(({ jobId, reason }) => ({ jobId, reason }))).toEqual([
      { jobId: "private-job-1", reason: "Node.js experience fits." },
      { jobId: "private-job-2", reason: "React evidence is absent." },
    ]);
    expect(result[0].requirementGroups[0].jobSources[0].value).toBe("Node.js");
    expect(result[1].requirementGroups[0].jobSources[0].value).toBe("React");
  });

  it("maps results by jobKey when the provider reverses their order", async () => {
    codexCall.mockResolvedValue(response({ jobs: [...output.jobs].reverse() }));
    const result = await assess({ cvNormalizationResult, jobs });
    expect(result.map(({ jobKey, jobId }) => [jobKey, jobId])).toEqual([
      ["J1", "private-job-1"], ["J2", "private-job-2"],
    ]);
  });

  it.each([
    [{ jobs: output.jobs.slice(0, 1) }, "missing"],
    [{ jobs: [output.jobs[0], output.jobs[0]] }, "duplicate"],
    [{ jobs: [output.jobs[0], { ...output.jobs[1], jobKey: "other" }] }, "unknown"],
    [{ jobs: [output.jobs[0], { ...output.jobs[1], reason: " " }] }, "blank reason"],
    [{ jobs: [output.jobs[0], { ...output.jobs[1], requirementGroups: [] }] }, "missing group"],
    [{ jobs: [output.jobs[0], { ...output.jobs[1], requirementGroups: [
      { ...group(), jobSourceIds: ["J1"] },
    ] }] }, "foreign source"],
  ])("rejects %s for the whole batch (%s)", async (invalid) => {
    codexCall.mockResolvedValue(response(invalid));
    await expect(assess({ cvNormalizationResult, jobs })).rejects
      .toMatchObject({ code: "INVALID_SEMANTIC_SKILLS_ASSESSMENT" });
    expect(codexCall).toHaveBeenCalledOnce();
  });

  it("rejects incomplete provider completion", async () => {
    codexCall.mockResolvedValue({ ...response(output), status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" } });
    const diagnostic = vi.fn();
    await expect(assess({ cvNormalizationResult, jobs, diagnostic })).rejects
      .toMatchObject({ code: "INVALID_SEMANTIC_SKILLS_ASSESSMENT",
        diagnosticStage: "structured_extraction", diagnosticCode: "RESPONSE_NOT_COMPLETED" });
    expect(diagnostic).toHaveBeenCalledWith({ gate: "structured_extraction",
      status: "FAIL", code: "RESPONSE_NOT_COMPLETED" });
  });

  it("identifies an invalid Responses output message before JSON parsing", async () => {
    codexCall.mockResolvedValue({ ...response(output), output: [{ type: "message",
      role: "assistant", status: "completed", content: [] }] });
    const diagnostic = vi.fn();
    await expect(assess({ cvNormalizationResult, jobs, diagnostic })).rejects
      .toMatchObject({ diagnosticStage: "structured_extraction",
        diagnosticCode: "OUTPUT_MESSAGE_INVALID" });
    expect(diagnostic).toHaveBeenCalledWith({ gate: "structured_extraction",
      status: "FAIL", code: "OUTPUT_MESSAGE_INVALID" });
    expect(diagnostic.mock.calls.some(([event]) => event.gate === "batch_json")).toBe(false);
  });

  it("identifies invalid JSON and invalid evidence at separate batch gates", async () => {
    const diagnostic = vi.fn();
    codexCall.mockResolvedValue({ ...response(output), output: [{ type: "message",
      role: "assistant", status: "completed", content: [{ type: "output_text", text: "{" }] }] });
    await expect(assess({ cvNormalizationResult, jobs, diagnostic })).rejects
      .toMatchObject({ diagnosticStage: "batch_json", diagnosticCode: "INVALID_JSON" });
    expect(diagnostic).toHaveBeenCalledWith({ gate: "batch_json", status: "FAIL",
      code: "INVALID_JSON" });

    diagnostic.mockClear();
    codexCall.mockResolvedValue(response({ jobs: [output.jobs[0], {
      ...output.jobs[1], requirementGroups: [{ ...group(), jobSourceIds: ["J1"] }],
    }] }));
    await expect(assess({ cvNormalizationResult, jobs, diagnostic })).rejects
      .toMatchObject({ diagnosticStage: "evidence_resolution",
        diagnosticCode: "EVIDENCE_INVALID" });
    expect(diagnostic).toHaveBeenCalledWith({ gate: "evidence_resolution", status: "FAIL",
      code: "EVIDENCE_INVALID", jobIndex: 1 });
  });

  it("rejects non READY input before inference", async () => {
    await expect(assess({ cvNormalizationResult, jobs: [
      { ...jobs[0], jobNormalizationResult: { status: "FAILED" } },
    ] })).rejects.toThrow(TypeError);
    expect(codexCall).not.toHaveBeenCalled();
  });

  it("rejects duplicate Job identities before inference", async () => {
    await expect(assess({ cvNormalizationResult, jobs: [jobs[0], {
      ...jobs[1], jobNormalizationResult: jobs[0].jobNormalizationResult,
    }] })).rejects.toThrow(TypeError);
    expect(codexCall).not.toHaveBeenCalled();
  });
});
