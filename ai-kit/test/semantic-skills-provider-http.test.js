import { afterEach, describe, expect, it, vi } from "vitest";

import { createSemanticSkillsAssessor } from "../src/matching/semantic-skills-assessment.js";

const output = JSON.stringify({ requirementGroups: [] });
const jobMatchProfile = {
  source: { type: "JOB", jobId: "job-1" },
  metadata: { requiredSkills: [] },
  freeText: { jobDescription: null },
};
const cvMatchProfile = {
  source: { type: "GENERATED_CV", candidateCvId: "cv-1" },
  metadata: { skillTags: [] },
  freeText: { professionalSummary: null },
  content: {
    skills: [], workExperiences: [], projects: [], educations: [], certifications: [], languages: [],
  },
};
const llm = {
  codex: { apiKey: "offline", baseURL: "https://codex.example.test/v1", model: "offline-model" },
  gemini: { apiKey: "offline", model: "offline-model" },
  groq: { apiKey: "offline", model: "offline-model" },
};
const logger = { error: vi.fn(), info: vi.fn() };
const assess = createSemanticSkillsAssessor({ llm, logger });
const jsonResponse = (body) => new Response(JSON.stringify(body), {
  status: 200, headers: { "content-type": "application/json" },
});
const providerBody = {
  codex: { id: "resp_offline", object: "response", model: "offline-model",
    status: "completed", incomplete_details: null, error: null,
    output: [{ type: "message", role: "assistant", status: "completed",
      content: [{ type: "output_text", text: output, annotations: [] }] }] },
  gemini: { candidates: [{ finishReason: "STOP",
    content: { role: "model", parts: [{ text: output }] } }] },
  groq: { id: "chatcmpl-offline", object: "chat.completion", created: 0,
    model: "offline-model", choices: [{ index: 0, finish_reason: "stop",
      message: { role: "assistant", content: output } }] },
};
const states = ["SUPPORTED", "PARTIAL", "MISMATCH", "NO_EVIDENCE", "CONFLICT"];

afterEach(() => vi.unstubAllGlobals());

describe("AI-V03 F02 provider SDK HTTP schema", () => {
  it.each(["codex", "gemini", "groq"])("sends the five evidence states through %s", async (provider) => {
    const fetchMock = vi.fn(async () => jsonResponse(providerBody[provider]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(assess({ jobMatchProfile, cvMatchProfile, provider }))
      .resolves.toEqual({ requirementGroups: [] });

    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    const schema = provider === "codex" ? request.text.format.schema
      : provider === "gemini" ? request.generationConfig.responseJsonSchema
        : request.response_format.json_schema.schema;
    expect(schema.properties.requirementGroups.items.properties.evidenceState)
      .toEqual({ type: "string", enum: states });
  });
});
