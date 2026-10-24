import { beforeEach, describe, expect, it, vi } from "vitest";

const { codexCall, geminiCall, groqCall } = vi.hoisted(() => ({
  codexCall: vi.fn(), geminiCall: vi.fn(), groqCall: vi.fn(),
}));
vi.mock("../src/llm/codex-client.js", () => ({
  createCodexClient: () => ({ createResponse: codexCall }),
}));
vi.mock("../src/llm/gemini-client.js", () => ({
  createGeminiClient: () => ({ generateContent: geminiCall }),
}));
vi.mock("../src/llm/groq-client.js", () => ({
  createGroqClient: () => ({ createChatCompletion: groqCall }),
}));

import { createSemanticSkillsAssessor, SemanticSkillsAssessmentError } from "../src/matching/semantic-skills-assessment.js";
import { calculateWeightedMatchScore } from "../src/matching/weighted-match-scoring.js";

const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
const llm = {
  codex: { apiKey: "offline", baseURL: "https://example.test", model: "model" },
  gemini: { apiKey: "offline", model: "model" },
  groq: { apiKey: "offline", model: "model" },
};
const assess = createSemanticSkillsAssessor({ llm, logger });
const job = {
  source: { type: "JOB", jobId: "job-private" },
  metadata: { requiredSkills: [
    { value: "Node.js", sourcePath: "/requiredSkills/0" },
    { value: "PostgreSQL", sourcePath: "/requiredSkills/1" },
  ] },
  freeText: { jobDescription: {
    value: "Must know Node.js. PostgreSQL required. React preferred. Docker helpful.",
    sourcePath: "/jobDescription",
  } },
};
const generatedCv = {
  source: { type: "GENERATED_CV", candidateCvId: "cv-private" },
  metadata: { skillTags: [{ value: "Node", sourcePath: "/skillTags/0" }] },
  freeText: { professionalSummary: null },
  content: {
    skills: [{ value: "React", sourcePath: "/generatedContent/skills/0" }],
    workExperiences: [], projects: [{ sourcePath: "/generatedContent/projects/0",
      freeText: { technologies: [{ value: "Postgres", sourcePath: "/generatedContent/projects/0/technologies/0" }] } }],
    educations: [], certifications: [], languages: [],
  },
};
const group = (requirement, priority, semanticScore, evidenceState, jobSourceIds, cvSourceIds) => ({
  requirement, priority, semanticScore, evidenceState, jobSourceIds, cvSourceIds,
});
const groups = [
  group("Node.js", "REQUIRED", 100, "SUPPORTED", ["J0", "JD"], ["C0"]),
  group("PostgreSQL", "REQUIRED", 80, "SUPPORTED", ["J1", "JD"], ["C2"]),
  group("React", "PREFERRED", 90, "SUPPORTED", ["JD"], ["C1"]),
  group("Docker", "UNSPECIFIED", 0, "NO_EVIDENCE", ["JD"], []),
];
const codexResponse = (value, overrides = {}) => ({
  status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(value) }] }],
  ...overrides,
});
const fields = { categoryScore: 0, experienceScore: 0, employmentTypeScore: 0, workModeScore: 0 };

describe("AI-V03 F02 Semantic Skills Assessment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assesses all requirements in one strict inference and restores source provenance", async () => {
    codexCall.mockResolvedValue(codexResponse({ requirementGroups: groups }));
    const result = await assess({ jobMatchProfile: job, cvMatchProfile: generatedCv });

    expect(codexCall).toHaveBeenCalledOnce();
    expect(geminiCall).not.toHaveBeenCalled();
    expect(groqCall).not.toHaveBeenCalled();
    const request = codexCall.mock.calls[0][0];
    expect(request.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(request.instructions).toContain("REQUIRED wins conflicts");
    expect(request.instructions).toContain("0,10,...,100");
    const input = JSON.parse(request.input);
    expect(input.job).toHaveLength(3);
    expect(input.cv).toHaveLength(3);
    expect(JSON.stringify(input)).not.toContain("cv-private");
    expect(JSON.stringify(input)).not.toContain("job-private");
    expect(result.requirementGroups[0].jobSources).toEqual([
      { id: "J0", kind: "requiredSkill", value: "Node.js", sourcePath: "/requiredSkills/0" },
      { id: "JD", kind: "jobDescription", value: job.freeText.jobDescription.value, sourcePath: "/jobDescription" },
    ]);
    expect(result.requirementGroups[1].cvSources[0].provenance).toEqual({
      sourcePath: "/generatedContent/projects/0", fieldSourcePaths: {
        technologies: ["/generatedContent/projects/0/technologies/0"],
      }, evidence: [],
    });
    expect(calculateWeightedMatchScore(result, fields).skillsScore).toBe(81);
  });

  it("accepts a sparse READY pair with zero requirements and one inference", async () => {
    codexCall.mockResolvedValue(codexResponse({ requirementGroups: [] }));
    const sparseJob = { ...job, metadata: { requiredSkills: [] },
      freeText: { jobDescription: null } };
    const result = await assess({ jobMatchProfile: sparseJob, cvMatchProfile: generatedCv });
    expect(result).toEqual({ requirementGroups: [] });
    expect(codexCall).toHaveBeenCalledOnce();
    expect(calculateWeightedMatchScore(result, fields).skillsScore).toBe(0);
  });

  it("preserves uploaded CV excerpt evidence and unresolved conflict claims", async () => {
    const uploaded = {
      source: { type: "UPLOADED_CV", candidateCvId: "pdf-private" },
      metadata: { skillTags: [] },
      pdfContent: {
        careerPositioning: [], professionalSummary: [], skills: [
          { value: "Python 3 years", evidence: ["Python 3 years"] },
        ], workExperiences: [], projects: [], educations: [], certifications: [],
        languages: [], otherCareerClaims: [], unresolvedContent: [
          { value: "Python 5 years", evidence: ["Python 5 years"] },
        ],
      },
    };
    const pythonJob = { ...job, metadata: { requiredSkills: [
      { value: "Python", sourcePath: "/requiredSkills/0" },
    ] }, freeText: { jobDescription: null } };
    codexCall.mockResolvedValue(codexResponse({ requirementGroups: [
      group("Python", "REQUIRED", 0, "CONFLICT", ["J0"], ["C0", "C1"]),
    ] }));
    const result = await assess({ jobMatchProfile: pythonJob, cvMatchProfile: uploaded });
    expect(JSON.parse(codexCall.mock.calls[0][0].input).cv.map((source) => source.evidence))
      .toEqual([["Python 3 years"], ["Python 5 years"]]);
    expect(result.requirementGroups[0].cvSources.map((source) => source.provenance.evidence))
      .toEqual([["Python 3 years"], ["Python 5 years"]]);
    expect(result.requirementGroups[0].evidenceState).toBe("CONFLICT");
    expect(result.requirementGroups[0].semanticScore).toBe(0);
  });

  it("associates the structured Python source when S4S5 merges it with JD in a conflict", async () => {
    // Projection of S4S5.capture.json: J1 was omitted from the Python group.
    const s4s5Job = { ...job, metadata: { requiredSkills: [
      { value: "React", sourcePath: "/requiredSkills/0" },
      { value: "Python", sourcePath: "/requiredSkills/1" },
    ] }, freeText: { jobDescription: { value:
      "Required: production React application development. Required: at least five years of Python experience.",
    sourcePath: "/jobDescription" } } };
    const s4s5Cv = { ...generatedCv,
      metadata: { skillTags: [{ value: "Python", sourcePath: "/skillTags/0" }] },
      freeText: { professionalSummary: { value:
        "I have never developed or shipped a React application in production. I have 3 years of Python experience.",
      sourcePath: "/professionalSummary" } },
      content: { ...generatedCv.content, skills: [{ value: "Python: 5 years of experience",
        sourcePath: "/generatedContent/skills/0" }], projects: [] },
    };
    const react = group("Production React application development", "REQUIRED", 0,
      "MISMATCH", ["J0", "JD"], ["C1"]);
    const python = group("At least five years of Python experience", "REQUIRED", 0,
      "CONFLICT", ["JD"], ["C0", "C1", "C2"]);
    codexCall.mockResolvedValueOnce(codexResponse({ requirementGroups: [react, python] }))
      .mockResolvedValueOnce(codexResponse({ requirementGroups: [
        react, { ...python, jobSourceIds: ["J1", "JD"] },
      ] }));

    await expect(assess({ jobMatchProfile: s4s5Job, cvMatchProfile: s4s5Cv }))
      .rejects.toBeInstanceOf(SemanticSkillsAssessmentError);
    const result = await assess({ jobMatchProfile: s4s5Job, cvMatchProfile: s4s5Cv });

    expect(result.requirementGroups[1]).toMatchObject({
      priority: "REQUIRED", semanticScore: 0, evidenceState: "CONFLICT",
    });
    expect(result.requirementGroups[1].jobSources.map((source) => source.id))
      .toEqual(["J1", "JD"]);
    const instruction = codexCall.mock.calls[0][0].instructions;
    expect(instruction).toMatch(/every structured requiredSkill.*exactly one.*requirement group/i);
    expect(instruction).toMatch(/MISMATCH.*CONFLICT.*NO_EVIDENCE/);
    expect(instruction).toContain("both the structured ID and JD");
  });

  it.each(["MISMATCH", "CONFLICT"])(
    "classifies a zero-score %s without CV evidence as NO_EVIDENCE", async (evidenceState) => {
      codexCall.mockResolvedValue(codexResponse({ requirementGroups: [
        group("Node.js", "REQUIRED", 0, evidenceState, ["J0"], []), groups[1],
      ] }));

      const result = await assess({ jobMatchProfile: job, cvMatchProfile: generatedCv });

      expect(codexCall).toHaveBeenCalledOnce();
      expect(result.requirementGroups[0]).toMatchObject({
        semanticScore: 0, evidenceState: "NO_EVIDENCE", cvSources: [],
      });
      expect(calculateWeightedMatchScore(result, fields).skillsScore).toBe(40);
    },
  );

  it("keeps a zero-score mismatch when CV evidence is associated", async () => {
    codexCall.mockResolvedValue(codexResponse({ requirementGroups: [
      group("Node.js", "REQUIRED", 0, "MISMATCH", ["J0"], ["C0"]), groups[1],
    ] }));

    const result = await assess({ jobMatchProfile: job, cvMatchProfile: generatedCv });

    expect(result.requirementGroups[0].evidenceState).toBe("MISMATCH");
    expect(result.requirementGroups[0].cvSources).toHaveLength(1);
  });

  it.each([
    ["missing structured skill", [groups[0]]],
    ["priority override", [group("Node.js", "PREFERRED", 100, "SUPPORTED", ["J0"], ["C0"]), groups[1]]],
    ["duplicate requirement", [groups[0], { ...groups[0], requirement: " node.JS " }, groups[1]]],
    ["same structured skill counted twice", [groups[0], { ...groups[1], jobSourceIds: ["J0", "J1"] }]],
    ["unapproved score", [{ ...groups[0], semanticScore: 95 }, groups[1]]],
    ["unknown evidence state", [{ ...groups[0], evidenceState: "MATCH" }, groups[1]]],
    ["fabricated source", [{ ...groups[0], cvSourceIds: ["C99"] }, groups[1]]],
    ["conflict with positive score", [{ ...groups[0], evidenceState: "CONFLICT" }, groups[1]]],
    ["missing evidence with positive score", [{ ...groups[0], cvSourceIds: [] }, groups[1]]],
    ["no-evidence state with CV source", [{ ...groups[0], semanticScore: 0,
      evidenceState: "NO_EVIDENCE" }, groups[1]]],
  ])("rejects invalid output: %s", async (_label, requirementGroups) => {
    codexCall.mockResolvedValue(codexResponse({ requirementGroups }));
    await expect(assess({ jobMatchProfile: job, cvMatchProfile: generatedCv }))
      .rejects.toBeInstanceOf(SemanticSkillsAssessmentError);
  });

  it("treats invalid JSON, refusal and incomplete response as AI failure", async () => {
    codexCall.mockResolvedValueOnce(codexResponse({ requirementGroups: groups }, { status: "incomplete" }))
      .mockResolvedValueOnce(codexResponse({ requirementGroups: groups }, { output: [{
        type: "message", role: "assistant", status: "completed", content: [{ type: "refusal" }],
      }] }))
      .mockResolvedValueOnce(codexResponse({ requirementGroups: groups }, { output: [{
        type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "{" }],
      }] }));
    for (let index = 0; index < 3; index += 1) {
      await expect(assess({ jobMatchProfile: job, cvMatchProfile: generatedCv }))
        .rejects.toBeInstanceOf(SemanticSkillsAssessmentError);
    }
  });

  it.each(["codex", "gemini", "groq"])(
    "constrains %s evidenceState to the validator's five states in the provider request", async (provider) => {
      const output = JSON.stringify({ requirementGroups: groups });
      codexCall.mockResolvedValue(codexResponse({ requirementGroups: groups }));
      geminiCall.mockResolvedValue({ candidates: [{ finishReason: "STOP",
        content: { role: "model", parts: [{ text: output }] } }] });
      groqCall.mockResolvedValue({ choices: [{ finish_reason: "stop",
        message: { role: "assistant", content: output } }] });

      await assess({ jobMatchProfile: job, cvMatchProfile: generatedCv, provider });

      const request = provider === "codex" ? codexCall.mock.calls[0][0]
        : provider === "gemini" ? geminiCall.mock.calls[0][0] : groqCall.mock.calls[0][0];
      const schema = provider === "codex" ? request.text.format.schema
        : provider === "gemini" ? request.config.responseJsonSchema
          : request.response_format.json_schema.schema;
      expect(schema.properties.requirementGroups.items.properties.evidenceState).toEqual({
        type: "string", enum: ["SUPPORTED", "PARTIAL", "MISMATCH", "NO_EVIDENCE", "CONFLICT"],
      });
      const instruction = provider === "codex" ? request.instructions
        : provider === "gemini" ? request.config.systemInstruction : request.messages[0].content;
      expect(instruction).toContain("SUPPORTED when CV evidence supports the requirement");
      expect(instruction).toContain("PARTIAL when it supports only part");
      expect(instruction).toContain("not mention count");
      expect(instruction).toMatch(/NO_EVIDENCE[^.]*cvSourceIds: \[\]/);
      expect(instruction).toMatch(/MISMATCH[^.]*relevant CV source IDs/);
      expect(instruction).toMatch(/CONFLICT[^.]*relevant CV source IDs/);
      expect(instruction).toContain("explicit first-use date that makes the claimed duration impossible is an unresolved CONFLICT with score 0, not PARTIAL");
      expect(instruction).toContain("shorter dated period alone does not rule out earlier experience");
      expect(instruction).toContain("do not infer CONFLICT from missing history");
    },
  );

  it.each(["gemini", "groq"])("uses %s provider-native strict schema on explicit selection", async (provider) => {
    const output = JSON.stringify({ requirementGroups: groups });
    geminiCall.mockResolvedValue({ candidates: [{ finishReason: "STOP",
      content: { role: "model", parts: [{ text: output }] } }] });
    groqCall.mockResolvedValue({ choices: [{ finish_reason: "stop",
      message: { role: "assistant", content: output } }] });
    const result = await assess({ jobMatchProfile: job, cvMatchProfile: generatedCv, provider });
    expect(result.requirementGroups).toHaveLength(4);
    if (provider === "gemini") {
      expect(geminiCall).toHaveBeenCalledOnce();
      expect(geminiCall.mock.calls[0][0].config).toMatchObject({
        responseMimeType: "application/json", responseJsonSchema: expect.any(Object),
      });
    } else {
      expect(groqCall).toHaveBeenCalledOnce();
      expect(groqCall.mock.calls[0][0].response_format.json_schema.strict).toBe(true);
    }
    expect(codexCall).not.toHaveBeenCalled();
  });

  it("propagates provider failures without retry and rejects unusable inputs before calling", async () => {
    const failure = new Error("offline failure");
    codexCall.mockRejectedValue(failure);
    await expect(assess({ jobMatchProfile: job, cvMatchProfile: generatedCv })).rejects.toBe(failure);
    expect(codexCall).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    await expect(assess({ jobMatchProfile: {}, cvMatchProfile: generatedCv })).rejects.toThrow(TypeError);
    expect(codexCall).not.toHaveBeenCalled();
  });
});
