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

import { createAiKit } from "@jobhub/ai-kit";

const sourced = (value, sourcePath = "/metadata") => ({ value, sourcePath });
const position = sourced({ id: "backend", level: "POSITION", parentCategoryId: "engineering" });
const job = {
  source: { type: "JOB", jobId: "job-private" },
  metadata: {
    requiredSkills: [sourced("Node.js", "/requiredSkills/0")],
    fieldCategories: [], positionCategories: [position],
    experienceLevel: sourced({ code: "ONE_TO_THREE_YEARS" }),
    employmentType: sourced("FULL_TIME"), workModes: [sourced("HYBRID")],
  },
  freeText: { jobDescription: sourced("Node.js required. React preferred", "/jobDescription") },
};
const cvMetadata = {
  category: position, experienceLevel: sourced({ code: "ONE_TO_THREE_YEARS" }),
  employmentTypes: [sourced("FULL_TIME")], workModes: [sourced("HYBRID")],
  skillTags: [sourced("Node.js", "/skillTags/0")],
};
const generatedCv = {
  source: { type: "GENERATED_CV", candidateCvId: "generated-private" },
  metadata: cvMetadata,
  freeText: { professionalSummary: null },
  content: {
    skills: [], workExperiences: [{ sourcePath: "/generatedContent/workExperiences/0",
      freeText: { description: sourced("Built backend APIs", "/generatedContent/workExperiences/0/description") } }],
    projects: [], educations: [], certifications: [], languages: [],
  },
};
const uploadedCv = {
  source: { type: "UPLOADED_CV", candidateCvId: "uploaded-private" },
  metadata: cvMetadata,
  pdfContent: {
    careerPositioning: [], professionalSummary: [], skills: [], workExperiences: [],
    projects: [{ name: "Search project", role: null, period: null, technologies: [],
      description: "Built a search feature", projectUrl: null,
      evidence: ["Built a search feature"] }],
    educations: [], certifications: [], languages: [], otherCareerClaims: [], unresolvedContent: [],
  },
};
const groups = [{ requirement: "Node.js", priority: "REQUIRED", semanticScore: 80,
  evidenceState: "SUPPORTED", jobSourceIds: ["J0", "JD"], cvSourceIds: ["C0"] }];
const reviews = { skills: "Evidence supports part of the requirement", category: "Aligned",
  experience: "Aligned", employmentType: "Aligned", workMode: "Aligned" };
const feedback = (overrides = {}) => ({
  requirementGroups: groups,
  overallSummary: "Relevant backend experience with room for clearer examples.",
  fieldReviews: reviews,
  cvImprovements: [],
  ...overrides,
});
const response = (output) => ({
  status: "completed", incomplete_details: null, error: null,
  output: [{ type: "message", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: JSON.stringify(output) }] }],
});
const ready = (profile) => ({ status: "READY", profile });
const aiKit = createAiKit({
  llm: {
    codex: { apiKey: "offline", baseURL: "https://example.test", model: "model" },
    gemini: { apiKey: "offline", model: "model" },
    groq: { apiKey: "offline", model: "model" },
  },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
});

describe("AI-V04 F01 CV Evaluation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["Generated", generatedCv, "workExperiences", "/generatedContent/workExperiences/0"],
    ["Uploaded", uploadedCv, "projects", null],
  ])("returns one %s CV evaluation with V03 scoring and source feedback", async (
    _variant, cv, section, sourcePath,
  ) => {
    const improvement = { section, cvSourceId: "C1", comment: "Describe the result",
      suggestion: "Add an outcome if verified", rewrite: null };
    codexCall.mockResolvedValue(response(feedback({ cvImprovements: [improvement,
      { ...improvement, cvSourceId: null, comment: "Section-level note" }] })));
    const before = structuredClone(cv);

    const result = await aiKit.evaluateCv({
      jobNormalizationResult: ready(job), cvNormalizationResult: ready(cv),
    });

    expect(codexCall).toHaveBeenCalledOnce();
    expect(geminiCall).not.toHaveBeenCalled();
    expect(groqCall).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      jobId: "job-private", candidateCvId: cv.source.candidateCvId,
      matchScore: 92, overallSummary: feedback().overallSummary,
      fieldReviews: [
        { criterion: "skills", score: 80, review: reviews.skills },
        { criterion: "category", score: 100, review: reviews.category },
        { criterion: "experience", score: 100, review: reviews.experience },
        { criterion: "employmentType", score: 100, review: reviews.employmentType },
        { criterion: "workMode", score: 100, review: reviews.workMode },
      ],
    });
    expect(result.cvImprovements[0]).toEqual({
      section, sourceReference: sourcePath
        ? { sourcePath, fieldSourcePaths: { description: `${sourcePath}/description` }, evidence: [] }
        : { sourcePath: null, fieldSourcePaths: {}, evidence: ["Built a search feature"] },
      comment: "Describe the result", suggestion: "Add an outcome if verified", rewrite: null,
    });
    expect(result.cvImprovements[1].sourceReference).toBeNull();
    expect(cv).toEqual(before);
    const request = codexCall.mock.calls[0][0];
    expect(request.text.format).toMatchObject({ type: "json_schema", name: "cv_evaluation", strict: true });
    expect(request.instructions).toContain("0,10,...,100");
    expect(request.instructions).toContain("Candidate control");
    expect(request.input).not.toContain("private");
    expect(JSON.parse(request.input).cv).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "C1", group: section }),
    ]));
  });

  it("preserves V03 public Match Result scoring and accepts empty feedback", async () => {
    codexCall.mockResolvedValueOnce(response(feedback({
      overallSummary: "", fieldReviews: Object.fromEntries(Object.keys(reviews).map((key) => [key, ""])),
    }))).mockResolvedValueOnce(response({ requirementGroups: groups }));
    const args = { jobNormalizationResult: ready(job), cvNormalizationResult: ready(generatedCv) };

    const evaluation = await aiKit.evaluateCv(args);
    const v03 = await aiKit.matchJobCv(args);

    expect(evaluation.matchScore).toBe(v03.matchScore);
    expect(evaluation.fieldReviews.map((review) => review.score)).toEqual([
      v03.skillsScore, v03.categoryScore, v03.experienceScore,
      v03.employmentTypeScore, v03.workModeScore,
    ]);
    expect(evaluation.overallSummary).toBe("");
    expect(evaluation.cvImprovements).toEqual([]);
  });

  it("omits Generated CV feedback aimed at Uploaded-only sections without changing scoring", async () => {
    const improvement = (section, comment, cvSourceId = null) => ({
      section, cvSourceId, comment, suggestion: null, rewrite: null,
    });
    codexCall.mockResolvedValue(response(feedback({ cvImprovements: [
      improvement("otherCareerClaims", "Unsupported target", "C1"),
      improvement("careerPositioning", "Unsupported target"),
      improvement("unresolvedContent", "Unsupported target"),
      improvement("workExperiences", "Describe the outcome", "C1"),
    ] })));

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(generatedCv) });

    expect(codexCall).toHaveBeenCalledOnce();
    const request = codexCall.mock.calls[0][0];
    expect(JSON.parse(request.input).careerSections).not.toContain("otherCareerClaims");
    expect(request.text.format.schema.properties.cvImprovements.items.properties.section.enum)
      .not.toContain("otherCareerClaims");
    expect(request.instructions).toContain("only the careerSections supplied");
    expect(result.matchScore).toBe(92);
    expect(result.cvImprovements).toEqual([{ section: "workExperiences",
      sourceReference: { sourcePath: "/generatedContent/workExperiences/0",
        fieldSourcePaths: { description: "/generatedContent/workExperiences/0/description" },
        evidence: [] },
      comment: "Describe the outcome", suggestion: null, rewrite: null }]);
  });

  it("keeps Uploaded CV other career claims as an eligible feedback section", async () => {
    const cv = { ...uploadedCv, pdfContent: { ...uploadedCv.pdfContent,
      otherCareerClaims: [{ value: "Led a migration", evidence: ["Led a migration"] }],
    } };
    codexCall.mockResolvedValue(response(feedback({ cvImprovements: [{
      section: "otherCareerClaims", cvSourceId: "C2", comment: "Quantify the result",
      suggestion: null, rewrite: null,
    }] })));

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(cv) });

    expect(codexCall).toHaveBeenCalledOnce();
    expect(JSON.parse(codexCall.mock.calls[0][0].input).careerSections)
      .toContain("otherCareerClaims");
    expect(codexCall.mock.calls[0][0].text.format.schema.properties
      .cvImprovements.items.properties.section.enum).toContain("otherCareerClaims");
    expect(result.matchScore).toBe(92);
    expect(result.cvImprovements).toEqual([{ section: "otherCareerClaims",
      sourceReference: { sourcePath: null, fieldSourcePaths: {}, evidence: ["Led a migration"] },
      comment: "Quantify the result", suggestion: null, rewrite: null }]);
  });

  it("returns a valid low-evidence result for a sparse READY pair", async () => {
    codexCall.mockResolvedValue(response(feedback({ requirementGroups: [],
      overallSummary: "The CV does not provide enough evidence for a firm conclusion.",
      cvImprovements: [],
    })));
    const sparseJob = { ...job, metadata: { requiredSkills: [], fieldCategories: [],
      positionCategories: [], experienceLevel: null, employmentType: null, workModes: [] },
    freeText: { jobDescription: null } };
    const sparseCv = { ...generatedCv, metadata: { category: position, experienceLevel: cvMetadata.experienceLevel,
      employmentTypes: [], workModes: [], skillTags: [] },
    content: { skills: [], workExperiences: [], projects: [], educations: [],
      certifications: [], languages: [] } };

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(sparseJob),
      cvNormalizationResult: ready(sparseCv) });

    expect(result.matchScore).toBe(0);
    expect(result.fieldReviews).toHaveLength(5);
    expect(result.cvImprovements).toEqual([]);
  });

  it("supplies the normalized Job title as V04 context when JD and categories are sparse", async () => {
    codexCall.mockResolvedValue(response(feedback({ requirementGroups: [] })));
    const sparseJob = { ...job,
      freeText: { title: sourced("Backend Engineer", "/title"), jobDescription: null },
      metadata: { ...job.metadata, requiredSkills: [], fieldCategories: [], positionCategories: [] },
    };

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(sparseJob),
      cvNormalizationResult: ready(generatedCv) });

    expect(codexCall).toHaveBeenCalledOnce();
    const request = codexCall.mock.calls[0][0];
    expect(JSON.parse(request.input)).toMatchObject({ jobTitle: "Backend Engineer", job: [],
      jobMetadata: { fieldCategories: [], positionCategories: [] } });
    expect(request.instructions).toContain("Job title");
    expect(result.matchScore).toBe(35);
  });

  it.each([null, sourced("   ", "/title")])(
    "keeps an absent or blank Job title optional in V04 context (%j)", async (title) => {
      codexCall.mockResolvedValue(response(feedback({ requirementGroups: [] })));
      const result = await aiKit.evaluateCv({ jobNormalizationResult: ready({ ...job,
        freeText: { ...job.freeText, title }, metadata: { ...job.metadata, requiredSkills: [] },
      }), cvNormalizationResult: ready(generatedCv) });

      expect(codexCall).toHaveBeenCalledOnce();
      expect(JSON.parse(codexCall.mock.calls[0][0].input).jobTitle).toBeNull();
      expect(result.fieldReviews).toHaveLength(5);
    },
  );

  it("grounds ongoing tenure feedback in the evaluation time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T10:00:00.000Z"));
    try {
      codexCall.mockResolvedValue(response(feedback()));
      const cv = { ...generatedCv, content: { ...generatedCv.content,
        workExperiences: [{ sourcePath: "/generatedContent/workExperiences/0",
          startDate: sourced("2022-10-01T00:00:00.000Z", "/generatedContent/workExperiences/0/startDate"),
          endDate: null,
          freeText: { description: sourced("Four years of production Node.js work",
            "/generatedContent/workExperiences/0/description") } }],
      } };

      const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
        cvNormalizationResult: ready(cv) });

      expect(codexCall).toHaveBeenCalledOnce();
      const request = codexCall.mock.calls[0][0];
      const input = JSON.parse(request.input);
      expect(input.evaluationTimestamp).toBe("2026-10-24T10:00:00.000Z");
      expect(input.cv).toEqual(expect.arrayContaining([expect.objectContaining({
        group: "workExperiences", value: expect.objectContaining({
          startDate: "2022-10-01T00:00:00.000Z",
          description: "Four years of production Node.js work",
        }),
      })]));
      expect(request.instructions).toContain("Do not flag a tenure discrepancy when the supplied dates are consistent with the claim");
      expect(result.matchScore).toBe(92);
    } finally {
      vi.useRealTimers();
    }
  });

  it("references a Summary target when Work Experience supplies supporting evidence", async () => {
    const cv = { ...generatedCv,
      metadata: { ...cvMetadata, skillTags: ["Node.js", "React", "SQL", "Git", "AWS", "Jest"]
        .map((value, index) => sourced(value, `/skillTags/${index}`)) },
      freeText: { professionalSummary: sourced("Experienced production Redis engineer",
        "/generatedContent/professionalSummary") },
      content: { ...generatedCv.content,
        skills: ["TypeScript", "Docker", "Redis", "Linux"]
          .map((value, index) => sourced(value, `/generatedContent/skills/${index}`)),
        workExperiences: [{ sourcePath: "/generatedContent/workExperiences/0",
          freeText: { description: sourced("Redis proof of concept only",
            "/generatedContent/workExperiences/0/description") } }],
      },
    };
    codexCall.mockResolvedValue(response(feedback({ cvImprovements: [{
      section: "professionalSummary", cvSourceId: "C6",
      comment: "The Summary claims production Redis work, while Work Experience C11 describes only a proof of concept.",
      suggestion: "Qualify the Summary claim.", rewrite: null,
    }] })));

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(cv) });

    expect(codexCall).toHaveBeenCalledOnce();
    const request = codexCall.mock.calls[0][0];
    expect(JSON.parse(request.input).cv).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "C6", group: "professionalSummary" }),
      expect.objectContaining({ id: "C11", group: "workExperiences" }),
    ]));
    expect(request.instructions).toContain("cvSourceId identifies the single CV item to improve");
    expect(request.instructions).toContain("Supporting evidence may come from another CV item or section");
    expect(result.cvImprovements[0].sourceReference).toEqual({
      sourcePath: "/generatedContent/professionalSummary", fieldSourcePaths: {}, evidence: [],
    });
    expect(result.matchScore).toBe(92);
  });

  it("keeps feedback about multiple CV projects at section level", async () => {
    const cv = { ...generatedCv, content: { ...generatedCv.content,
      projects: [
        { sourcePath: "/generatedContent/projects/0",
          name: sourced("Redis proof of concept", "/generatedContent/projects/0/name") },
        { sourcePath: "/generatedContent/projects/1",
          name: sourced("Local Docker setup", "/generatedContent/projects/1/name") },
      ],
    } };
    codexCall.mockResolvedValue(response(feedback({ cvImprovements: [
      { section: "projects", cvSourceId: null,
        comment: "Redis was only a proof of concept and Docker was only used locally.",
        suggestion: "Clarify each project's production scope.", rewrite: null },
      { section: "projects", cvSourceId: "C2", comment: "Redis was only a proof of concept.",
        suggestion: null, rewrite: null },
      { section: "projects", cvSourceId: "C3", comment: "Docker was only used locally.",
        suggestion: null, rewrite: null },
    ] })));

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(cv) });

    expect(codexCall).toHaveBeenCalledOnce();
    const request = codexCall.mock.calls[0][0];
    expect(JSON.parse(request.input).cv).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "C2", group: "projects" }),
      expect.objectContaining({ id: "C3", group: "projects" }),
    ]));
    expect(request.instructions).toContain("When one improvement targets more than one CV item, set cvSourceId to null");
    expect(result.cvImprovements.map((item) => item.sourceReference?.sourcePath ?? null))
      .toEqual([null, "/generatedContent/projects/0", "/generatedContent/projects/1"]);
    expect(result.matchScore).toBe(92);
  });

  it("rejects invalid READY input before inference", async () => {
    await expect(aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: { status: "FAILED", profile: null } })).rejects.toThrow(TypeError);
    expect(codexCall).not.toHaveBeenCalled();
  });

  it.each([
    ["gemini", geminiCall, () => ({ candidates: [{ finishReason: "STOP", content: {
      role: "model", parts: [{ text: JSON.stringify(feedback()) }],
    } }] })],
    ["groq", groqCall, () => ({ choices: [{ finish_reason: "stop", message: {
      role: "assistant", content: JSON.stringify(feedback()),
    } }] })],
  ])("uses one strict %s inference when explicitly selected", async (provider, call, makeResponse) => {
    call.mockResolvedValue(makeResponse());
    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(generatedCv), provider });

    expect(call).toHaveBeenCalledOnce();
    expect(codexCall).not.toHaveBeenCalled();
    expect(result.matchScore).toBe(92);
    if (provider === "gemini") {
      expect(call.mock.calls[0][0].config.responseJsonSchema.properties)
        .toHaveProperty("cvImprovements");
    } else {
      expect(call.mock.calls[0][0].response_format.json_schema.strict).toBe(true);
    }
  });

  it.each([
    ["wrong section source", "projects", "C1"],
    ["invented source", "workExperiences", "C99"],
  ])("retains %s as section-level feedback", async (_case, section, cvSourceId) => {
    const improvement = { section, cvSourceId, comment: "Useful feedback",
      suggestion: "Clarify the outcome", rewrite: null };
    codexCall.mockResolvedValue(response(feedback({ cvImprovements: [improvement] })));

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(generatedCv) });

    expect(result.matchScore).toBe(92);
    expect(result.cvImprovements).toEqual([{ section, sourceReference: null,
      comment: improvement.comment, suggestion: improvement.suggestion, rewrite: null }]);
  });

  it.each([
    ["invalid skills rubric", { requirementGroups: [{ ...groups[0], semanticScore: 77 }] }],
    ["invalid scoring source", { requirementGroups: [{ ...groups[0], cvSourceIds: ["C99"] }] }],
    ["NO_EVIDENCE with a CV source", { requirementGroups: [{ ...groups[0],
      semanticScore: 0, evidenceState: "NO_EVIDENCE" }] }],
    ["invalid improvement source type", { cvImprovements: [{ section: "workExperiences",
      cvSourceId: 99, comment: "Invalid", suggestion: null, rewrite: null }] }],
    ["missing improvement field", { cvImprovements: [{ section: "workExperiences",
      cvSourceId: "C1", comment: "Invalid", suggestion: null }] }],
  ])("rejects %s without a low-score business result", async (_case, invalid) => {
    codexCall.mockResolvedValue(response(feedback(invalid)));
    await expect(aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(generatedCv) })).rejects.toMatchObject({ code: "INVALID_CV_EVALUATION" });
  });

  it("instructs V04 inference to leave absent skill evidence unassociated", async () => {
    const h3Job = { ...job,
      metadata: { ...job.metadata, requiredSkills: [sourced("Terraform", "/requiredSkills/0"),
        sourced("RabbitMQ", "/requiredSkills/1")] },
      freeText: { jobDescription: sourced("Terraform and RabbitMQ required", "/jobDescription") },
    };
    codexCall.mockResolvedValue(response(feedback({ requirementGroups: [
      { requirement: "Terraform", priority: "REQUIRED", semanticScore: 0,
        evidenceState: "NO_EVIDENCE", jobSourceIds: ["J0", "JD"], cvSourceIds: [] },
      { requirement: "RabbitMQ", priority: "REQUIRED", semanticScore: 0,
        evidenceState: "NO_EVIDENCE", jobSourceIds: ["J1", "JD"], cvSourceIds: [] },
    ] })));

    const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(h3Job),
      cvNormalizationResult: ready(generatedCv) });

    const instruction = codexCall.mock.calls[0][0].instructions;
    expect(JSON.parse(codexCall.mock.calls[0][0].input).cv.length).toBeGreaterThan(0);
    expect(instruction).toMatch(/NO_EVIDENCE[^.]*cvSourceIds: \[\]/);
    expect(instruction).toMatch(/MISMATCH[^.]*relevant CV source IDs/);
    expect(instruction).toMatch(/CONFLICT[^.]*relevant CV source IDs/);
    expect(instruction).toContain("do not attach unrelated CV source IDs");
    expect(result.fieldReviews.find((review) => review.criterion === "skills").score).toBe(0);
  });

  it.each([
    ["explicit first exposure contradicts three years", "First used Kubernetes in March 2025; production rotation ended in September 2025.", "CONFLICT", 0],
    ["a dated rotation leaves earlier experience unknown", "Kubernetes production rotation ran from March to September 2025.", "PARTIAL", 50],
  ])("keeps Kubernetes tenure evidence distinct when %s", async (
    _case, history, evidenceState, semanticScore,
  ) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T00:00:00.000Z"));
    try {
      const kubernetesJob = { ...job,
        metadata: { ...job.metadata, requiredSkills: [sourced("Three years of Kubernetes production experience", "/requiredSkills/0")] },
        freeText: { jobDescription: sourced("Requires three years of Kubernetes production experience", "/jobDescription") },
      };
      const kubernetesCv = { ...generatedCv,
        metadata: { ...generatedCv.metadata, skillTags: [] },
        freeText: { professionalSummary: sourced("Three years of Kubernetes production experience", "/professionalSummary") },
        content: { ...generatedCv.content, workExperiences: [{
          sourcePath: "/generatedContent/workExperiences/0",
          startDate: sourced("2025-03-01T00:00:00.000Z", "/generatedContent/workExperiences/0/startDate"),
          endDate: sourced("2025-09-30T00:00:00.000Z", "/generatedContent/workExperiences/0/endDate"),
          freeText: { description: sourced(history, "/generatedContent/workExperiences/0/description") },
        }] },
      };
      codexCall.mockResolvedValue(response(feedback({ requirementGroups: [{
        requirement: "Three years of Kubernetes production experience", priority: "REQUIRED",
        semanticScore, evidenceState, jobSourceIds: ["J0", "JD"], cvSourceIds: ["C0", "C1"],
      }] })));

      const result = await aiKit.evaluateCv({ jobNormalizationResult: ready(kubernetesJob),
        cvNormalizationResult: ready(kubernetesCv) });

      expect(codexCall).toHaveBeenCalledOnce();
      const request = codexCall.mock.calls[0][0];
      const input = JSON.parse(request.input);
      expect(input.evaluationTimestamp).toBe("2026-10-25T00:00:00.000Z");
      expect(input.job).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "J0", value: "Three years of Kubernetes production experience" }),
      ]));
      expect(input.cv).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "C0", group: "professionalSummary",
          value: "Three years of Kubernetes production experience" }),
        expect.objectContaining({ id: "C1", group: "workExperiences", value: expect.objectContaining({
          startDate: "2025-03-01T00:00:00.000Z", endDate: "2025-09-30T00:00:00.000Z",
          description: history,
        }) }),
      ]));
      expect(request.instructions).toContain("explicit first-use date that makes the claimed duration impossible is an unresolved CONFLICT with score 0, not PARTIAL");
      expect(request.instructions).toContain("shorter dated period alone does not rule out earlier experience");
      expect(request.instructions).toContain("do not infer CONFLICT from missing history");
      expect(result.fieldReviews.find((review) => review.criterion === "skills").score)
        .toBe(semanticScore);
      expect(result.matchScore).toBe(60 + semanticScore * 0.4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates provider failure without fabricating feedback or a score", async () => {
    const failure = new Error("provider unavailable");
    codexCall.mockRejectedValue(failure);
    await expect(aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(generatedCv) })).rejects.toBe(failure);
  });

  it("rejects an incomplete provider response even with valid JSON", async () => {
    codexCall.mockResolvedValue({ ...response(feedback()), status: "incomplete" });
    await expect(aiKit.evaluateCv({ jobNormalizationResult: ready(job),
      cvNormalizationResult: ready(generatedCv) })).rejects.toMatchObject({
      code: "INVALID_CV_EVALUATION",
    });
  });
});
