import { describe, expect, it, vi } from "vitest";

import {
  createJobExtractor,
  JOB_EXTRACTION_ERROR_CODES,
  JobExtractionError,
} from "../src/normalization/job-extraction.js";
import { buildV01ProviderSchema } from "../src/normalization/v01-contract.js";

const JOB_DESCRIPTION = "Yêu cầu: Node.js bắt buộc. Ưu tiên Docker. Làm việc từ xa.";

const createLogger = () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

const makeJobRawInput = (overrides = {}) => ({
  jobId: "job-1",
  title: "Backend Engineer",
  jobDescription: JOB_DESCRIPTION,
  requiredSkills: ["Node.js"],
  fieldCategoryIds: ["field-1"],
  positionCategoryIds: ["position-1"],
  experienceLevelId: "level-1",
  employmentType: "FULL_TIME",
  workModes: ["REMOTE"],
  location: { provinceCode: "01", districtCode: null },
  ...overrides,
});

const makeExtraction = () => ({
  requirements: [
    {
      name: "Node.js",
      priority: "REQUIRED",
      references: ["/requiredSkills/0", "/jobDescription"],
    },
    {
      name: "Docker",
      priority: "OPTIONAL",
      references: ["/jobDescription"],
    },
  ],
  minimumExperienceYears: null,
  employmentType: {
    value: "FULL_TIME",
    references: ["/employmentType"],
  },
  workModes: [
    {
      value: "REMOTE",
      references: ["/workModes/0", "/jobDescription"],
    },
  ],
  residualClaims: [],
  uncertainClaims: [],
  conflictingClaims: [],
});

const makeSparseExtraction = () => ({
  requirements: [],
  minimumExperienceYears: null,
  employmentType: null,
  workModes: [],
  residualClaims: [],
  uncertainClaims: [],
  conflictingClaims: [],
});

const createGemini = (payload) => ({
  generateContent: vi.fn().mockResolvedValue({
    text: typeof payload === "string" ? payload : JSON.stringify(payload),
    candidates: [{ finishReason: "STOP" }],
  }),
});

const createGroq = (payload) => ({
  createChatCompletion: vi.fn().mockResolvedValue({
    choices: [{
      finish_reason: "stop",
      message: {
        content: typeof payload === "string" ? payload : JSON.stringify(payload),
      },
    }],
  }),
});

const createHttpError = (status) => {
  return Object.assign(new Error(`HTTP ${status}`), { status });
};

const expectExtractionError = async (promise, code) => {
  const error = await promise.catch((caught) => caught);

  expect(error).toBeInstanceOf(JobExtractionError);
  expect(error.code).toBe(code);

  return error;
};

describe("createJobExtractor boundary", () => {
  it("requires a logger contract", () => {
    expect(() => createJobExtractor({ gemini: createGemini({}) }))
      .toThrow("logger must provide error, info, and warn methods");
  });

  it("requires at least one provider client", () => {
    expect(() => createJobExtractor({ logger: createLogger() }))
      .toThrow("At least one of gemini or groq must be provided");
  });

  it.each([
    ["gemini", { gemini: {} }, "gemini must provide a generateContent method"],
    ["groq", { groq: {} }, "groq must provide a createChatCompletion method"],
  ])("rejects a malformed %s client", (_name, clients, message) => {
    expect(() => createJobExtractor({ ...clients, logger: createLogger() }))
      .toThrow(message);
  });
});

describe("Job extraction input contract", () => {
  it.each([
    ["missing required field", (input) => delete input.title],
    ["non-canonical employment type", (input) => {
      input.employmentType = "PERMANENT";
    }],
    ["field outside JobRawInput", (input) => {
      input.companyId = "company-1";
    }],
  ])("refuses %s without calling a provider", async (_name, mutate) => {
    const gemini = createGemini(makeExtraction());
    const extractor = createJobExtractor({ gemini, logger: createLogger() });
    const input = makeJobRawInput();
    mutate(input);

    const error = await expectExtractionError(
      extractor.extractJob(input),
      JOB_EXTRACTION_ERROR_CODES.INVALID_JOB_INPUT,
    );

    expect(error.details.length).toBeGreaterThan(0);
    expect(gemini.generateContent).not.toHaveBeenCalled();
  });

  it("refuses a null input", async () => {
    const extractor = createJobExtractor({
      gemini: createGemini(makeExtraction()),
      logger: createLogger(),
    });

    await expectExtractionError(
      extractor.extractJob(null),
      JOB_EXTRACTION_ERROR_CODES.INVALID_JOB_INPUT,
    );
  });
});

describe("Job extraction provider requests", () => {
  it("sends Gemini a minimized source document with the canonical response schema", async () => {
    const gemini = createGemini(makeExtraction());
    const extractor = createJobExtractor({ gemini, logger: createLogger() });

    await extractor.extractJob(makeJobRawInput());

    expect(gemini.generateContent).toHaveBeenCalledTimes(1);

    const [{ contents, config }] = gemini.generateContent.mock.calls[0];
    const userText = contents[0].parts[0].text;
    const sourceDocument = JSON.parse(userText.slice(userText.indexOf("{")));

    expect(sourceDocument).toEqual({
      title: "Backend Engineer",
      jobDescription: JOB_DESCRIPTION,
      requiredSkills: ["Node.js"],
      employmentType: "FULL_TIME",
      workModes: ["REMOTE"],
    });
    expect(config).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: buildV01ProviderSchema("JobExtractionResult", "gemini"),
      temperature: 0,
    });
    expect(config.systemInstruction).toContain("REQUIRED");
  });

  it("sends Groq the same contract through a JSON-schema response format", async () => {
    const groq = createGroq(makeExtraction());
    const extractor = createJobExtractor({ groq, logger: createLogger() });

    await extractor.extractJob(makeJobRawInput());

    const [request] = groq.createChatCompletion.mock.calls[0];

    expect(request.messages.map(({ role }) => role)).toEqual(["system", "user"]);
    expect(request.messages[1].content).not.toContain("job-1");
    expect(request.messages[1].content).not.toContain("provinceCode");
    expect(request.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "job_extraction_result",
        schema: buildV01ProviderSchema("JobExtractionResult", "groq"),
        strict: true,
      },
    });
    expect(request.temperature).toBe(0);
  });

  it("falls back to Groq once when Gemini is unavailable", async () => {
    const gemini = {
      generateContent: vi.fn().mockRejectedValue(createHttpError(503)),
    };
    const groq = createGroq(makeExtraction());
    const extractor = createJobExtractor({ gemini, groq, logger: createLogger() });

    await expect(extractor.extractJob(makeJobRawInput()))
      .resolves.toEqual(makeExtraction());
    expect(gemini.generateContent).toHaveBeenCalledTimes(1);
    expect(groq.createChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("propagates a non-fallback Gemini failure unchanged", async () => {
    const providerError = createHttpError(400);
    const gemini = {
      generateContent: vi.fn().mockRejectedValue(providerError),
    };
    const groq = createGroq(makeExtraction());
    const extractor = createJobExtractor({ gemini, groq, logger: createLogger() });

    await expect(extractor.extractJob(makeJobRawInput())).rejects.toBe(providerError);
    expect(groq.createChatCompletion).not.toHaveBeenCalled();
  });

  it("propagates a single-provider failure unchanged", async () => {
    const providerError = createHttpError(503);
    const extractor = createJobExtractor({
      groq: { createChatCompletion: vi.fn().mockRejectedValue(providerError) },
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput())).rejects.toBe(providerError);
  });
});

describe("Job extraction output acceptance", () => {
  it("returns a contract-valid, evidence-resolved extraction", async () => {
    const extractor = createJobExtractor({
      gemini: createGemini(makeExtraction()),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput()))
      .resolves.toEqual(makeExtraction());
  });

  it("accepts an empty extraction for a sparse Job without a completeness threshold", async () => {
    const extractor = createJobExtractor({
      gemini: createGemini(makeSparseExtraction()),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      title: null,
      jobDescription: null,
      requiredSkills: [],
      employmentType: null,
      workModes: [],
      location: null,
    }))).resolves.toEqual(makeSparseExtraction());
  });

  it("preserves explicit description metadata when structured fields are missing", async () => {
    const extraction = {
      ...makeSparseExtraction(),
      employmentType: {
        value: "FULL_TIME",
        references: ["/jobDescription"],
      },
      workModes: [{ value: "REMOTE", references: ["/jobDescription"] }],
    };
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      jobDescription: "Hình thức toàn thời gian. Làm việc từ xa.",
      requiredSkills: [],
      employmentType: null,
      workModes: [],
    }))).resolves.toEqual(extraction);
  });

  it("preserves conflicting, uncertain, residual, and null-priority claims", async () => {
    const jobDescription = [
      "Kubernetes",
      "Fintech domain",
      "Some travel",
      "Làm việc từ xa.",
      "Làm việc tại văn phòng.",
    ].join(". ");
    const extraction = {
      ...makeExtraction(),
      requirements: [
        {
          name: "Kubernetes",
          priority: null,
          references: ["/requiredSkills/0", "/jobDescription"],
        },
      ],
      minimumExperienceYears: null,
      residualClaims: [{ value: "Fintech domain", references: ["/jobDescription"] }],
      uncertainClaims: [{ value: "Some travel", references: ["/jobDescription"] }],
      conflictingClaims: [{
        subject: "workModes",
        claims: [
          { value: "REMOTE", references: ["/workModes/0"] },
          { value: "ONSITE", references: ["/jobDescription"] },
        ],
      }],
    };
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      jobDescription,
      requiredSkills: ["Kubernetes"],
    })))
      .resolves.toEqual(extraction);
  });

  it("keeps an explicitly optional requirement optional under a requirements heading", async () => {
    const extraction = makeExtraction();
    extraction.requirements = [{
      name: "Docker",
      priority: "OPTIONAL",
      references: ["/requiredSkills/0", "/jobDescription"],
    }];
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      jobDescription: "Yêu cầu ứng viên\nƯu tiên Docker. Làm việc từ xa.",
      requiredSkills: ["Docker"],
    }))).resolves.toEqual(extraction);
  });

  it("rejects duplicate references instead of repairing schema-invalid output", async () => {
    const extraction = makeExtraction();
    extraction.requirements[0].references = [
      "/jobDescription",
      "/requiredSkills/0",
      "/jobDescription",
    ];
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );
  });
});

describe("Job extraction output rejection", () => {
  it.each([
    ["empty text", ""],
    ["truncated non-JSON text", "Here is the extraction: {"],
  ])("rejects %s", async (_name, text) => {
    const extractor = createJobExtractor({
      gemini: createGemini(text),
      logger: createLogger(),
    });

    await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );
  });

  it.each([
    ["Gemini refusal", {
      gemini: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify(makeExtraction()),
          promptFeedback: { blockReason: "SAFETY" },
          candidates: [],
        }),
      },
    }],
    ["Gemini truncation", {
      gemini: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify(makeExtraction()),
          candidates: [{ finishReason: "MAX_TOKENS" }],
        }),
      },
    }],
    ["Groq refusal", {
      groq: {
        createChatCompletion: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "stop",
            message: { content: null, refusal: "Request refused" },
          }],
        }),
      },
    }],
    ["Groq truncation", {
      groq: {
        createChatCompletion: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "length",
            message: { content: JSON.stringify(makeExtraction()) },
          }],
        }),
      },
    }],
  ])("rejects %s", async (_name, provider) => {
    const extractor = createJobExtractor({ ...provider, logger: createLogger() });

    await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );
  });

  it.each([
    ["an unknown priority", (extraction) => {
      extraction.requirements[0].priority = "MANDATORY";
    }],
    ["a missing claim collection", (extraction) => {
      delete extraction.conflictingClaims;
    }],
    ["a requirement without evidence", (extraction) => {
      extraction.requirements[0].references = [];
    }],
    ["a non-canonical work mode", (extraction) => {
      extraction.workModes[0].value = "WFH";
    }],
    ["a matching score outside AI-V01", (extraction) => {
      extraction.matchScore = 0.8;
    }],
    ["a single-claim conflict", (extraction) => {
      extraction.conflictingClaims = [{
        subject: "workModes",
        claims: [{ value: "REMOTE", references: ["/workModes/0"] }],
      }];
    }],
  ])("rejects %s against the canonical contract", async (_name, mutate) => {
    const extraction = makeExtraction();
    mutate(extraction);
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    const error = await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(error.details.length).toBeGreaterThan(0);
  });

  it.each([
    ["a null description", { jobDescription: null }, (extraction) => {
      extraction.requirements[1].references = ["/jobDescription"];
    }],
    ["an out-of-range skill index", {}, (extraction) => {
      extraction.requirements[0].references = ["/requiredSkills/3"];
    }],
    ["an empty structured work-mode list", { workModes: [] }, (extraction) => {
      extraction.workModes[0].references = ["/workModes/0"];
    }],
    ["a null structured employment type", { employmentType: null }, (extraction) => {
      extraction.employmentType.references = ["/employmentType"];
    }],
    ["a field withheld from the prompt", {}, (extraction) => {
      extraction.residualClaims = [{ value: "Hanoi", references: ["/location"] }];
    }],
    ["a conflict claim without evidence", {}, (extraction) => {
      extraction.conflictingClaims = [{
        subject: "workModes",
        claims: [
          { value: "REMOTE", references: ["/workModes/0"] },
          { value: "ONSITE", references: ["/workModes/1"] },
        ],
      }];
    }],
  ])("rejects a reference to %s", async (_name, inputOverrides, mutate) => {
    const extraction = makeExtraction();
    mutate(extraction);
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    const error = await expectExtractionError(
      extractor.extractJob(makeJobRawInput(inputOverrides)),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(error.details.join("\n")).toContain("does not resolve to source evidence");
  });

  it.each([
    ["a fabricated requirement", (extraction) => {
      extraction.requirements[1] = {
        name: "Kubernetes",
        priority: null,
        references: ["/jobDescription"],
      };
    }],
    ["an inferred experience minimum", (extraction) => {
      extraction.minimumExperienceYears = {
        value: 5,
        references: ["/jobDescription"],
      };
    }],
    ["an unsupported REQUIRED priority", (extraction) => {
      extraction.requirements[1].priority = "REQUIRED";
    }],
    ["an unrelated but non-empty pointer", (extraction) => {
      extraction.requirements[1].references = ["/title"];
      extraction.requirements[1].priority = null;
    }],
  ])("rejects %s despite a resolving pointer", async (_name, mutate) => {
    const extraction = makeExtraction();
    mutate(extraction);
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    const error = await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(error.details.join("\n")).toMatch(/does not support|priority is not supported/);
  });

  it("rejects output that silently drops a structured required skill", async () => {
    const extraction = makeExtraction();
    extraction.requirements.shift();
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    const error = await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(error.details).toContain(
      "/requiredSkills/0 is not preserved as a Job requirement",
    );
  });

  it("rejects output that silently drops a structured/description conflict", async () => {
    const extraction = makeExtraction();
    extraction.workModes[0].references = ["/workModes/0"];
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    const error = await expectExtractionError(
      extractor.extractJob(makeJobRawInput({
        jobDescription: `${JOB_DESCRIPTION} Làm việc tại văn phòng.`,
      })),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(error.details).toContain("workModes conflict is not preserved");
  });

  it("rejects duplicate REQUIRED/OPTIONAL versions of one requirement", async () => {
    const extraction = makeExtraction();
    extraction.requirements = [
      {
        name: "Node.js",
        priority: "REQUIRED",
        references: ["/requiredSkills/0", "/jobDescription"],
      },
      {
        name: "Node.js",
        priority: "OPTIONAL",
        references: ["/requiredSkills/0", "/jobDescription"],
      },
    ];
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    const error = await expectExtractionError(
      extractor.extractJob(makeJobRawInput({
        jobDescription: "Node.js bắt buộc. Node.js là lợi thế. Làm việc từ xa.",
      })),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(error.details).toContain(
      "equivalent Job requirements are duplicated instead of consolidated",
    );
  });

  it("logs rejected output without Job content", async () => {
    const extraction = makeExtraction();
    extraction.requirements[1].references = ["/location"];
    const logger = createLogger();
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger,
    });

    await expectExtractionError(
      extractor.extractJob(makeJobRawInput()),
      JOB_EXTRACTION_ERROR_CODES.INVALID_EXTRACTION_OUTPUT,
    );

    expect(logger.warn).toHaveBeenCalledWith("Job extraction output rejected", {
      reason: "LLM Job extraction fails semantic/evidence validation",
      issueCount: expect.any(Number),
    });

    const loggedText = JSON.stringify([
      logger.warn.mock.calls,
      logger.info.mock.calls,
      logger.error.mock.calls,
    ]);

    expect(loggedText).not.toContain(JOB_DESCRIPTION);
    expect(loggedText).not.toContain("Docker");
  });
});
