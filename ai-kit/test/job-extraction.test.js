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
  employmentType: null,
  workModes: [
    {
      value: "REMOTE",
      references: ["/jobDescription"],
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

const createCodex = (payload) => ({
  createResponse: vi.fn().mockResolvedValue({
    output_text: typeof payload === "string" ? payload : JSON.stringify(payload),
    output: [],
    status: "completed",
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
      .toThrow("At least one of codex, gemini, or groq must be provided");
  });

  it.each([
    ["codex", { codex: {} }, "codex must provide a createResponse method"],
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
  it("sends Codex the canonical strict JSON schema through the Responses API", async () => {
    const codex = createCodex(makeExtraction());
    const extractor = createJobExtractor({ codex, logger: createLogger() });

    await extractor.extractJob(makeJobRawInput());

    expect(codex.createResponse).toHaveBeenCalledOnce();
    const [request] = codex.createResponse.mock.calls[0];

    expect(request.input.map(({ role }) => role)).toEqual(["system", "user"]);
    expect(request.input[1].content).not.toContain("job-1");
    expect(request.input[1].content).not.toContain("provinceCode");
    expect(request.input[1].content).not.toContain("FULL_TIME");
    expect(request.text.format).toEqual({
      type: "json_schema",
      name: "job_extraction_result",
      schema: buildV01ProviderSchema("JobExtractionResult", "codex"),
      strict: true,
    });
  });

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
    expect(request.messages[1].content).not.toContain("FULL_TIME");
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

  it("uses Codex first, retries once, then falls back through Gemini to Groq", async () => {
    const order = [];
    const codex = {
      createResponse: vi.fn(async () => {
        order.push("codex");
        throw createHttpError(503);
      }),
    };
    const gemini = {
      generateContent: vi.fn(async () => {
        order.push("gemini");
        throw createHttpError(503);
      }),
    };
    const groq = createGroq(makeExtraction());
    groq.createChatCompletion.mockImplementation(async () => {
      order.push("groq");
      return {
        choices: [{
          finish_reason: "stop",
          message: { content: JSON.stringify(makeExtraction()) },
        }],
      };
    });
    const extractor = createJobExtractor({
      codex,
      gemini,
      groq,
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput()))
      .resolves.toEqual(makeExtraction());
    expect(order).toEqual(["codex", "codex", "gemini", "groq"]);
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

  it("extracts explicit description metadata when structured fields are missing", async () => {
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
      workModes: [],
      residualClaims: [{ value: "Fintech domain", references: ["/jobDescription"] }],
      uncertainClaims: [{ value: "Some travel", references: ["/jobDescription"] }],
      conflictingClaims: [{
        subject: "workModes",
        claims: [
          { value: "REMOTE", references: ["/jobDescription"] },
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

  it.each([
    [
      "a range minimum written as 'từ 2 đến 4 năm'",
      "Yêu cầu từ 2 đến 4 năm kinh nghiệm phát triển frontend.",
      {
        requirements: [{
          name: "từ 2 đến 4 năm kinh nghiệm phát triển frontend",
          priority: "REQUIRED",
          references: ["/jobDescription"],
        }],
        minimumExperienceYears: { value: 2, references: ["/jobDescription"] },
      },
    ],
    [
      "a minimum written in words",
      "Bắt buộc có ít nhất hai năm kinh nghiệm làm việc.",
      {
        minimumExperienceYears: { value: 2, references: ["/jobDescription"] },
      },
    ],
    [
      "every bullet under a requirements heading as REQUIRED",
      "Yêu cầu ứng viên:\n- Node.js\n- Docker",
      {
        requirements: [
          { name: "Node.js", priority: "REQUIRED", references: ["/jobDescription"] },
          { name: "Docker", priority: "REQUIRED", references: ["/jobDescription"] },
        ],
      },
    ],
  ])("accepts %s without lexical re-validation", async (_name, jobDescription, claims) => {
    const extraction = { ...makeSparseExtraction(), ...claims };
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      jobDescription,
      requiredSkills: [],
      employmentType: null,
      workModes: [],
    }))).resolves.toEqual(extraction);
  });

  it("accepts a qualified requirement merged with its structured skill tag", async () => {
    const extraction = makeExtraction();
    extraction.requirements[0] = {
      name: "Thành thạo Node.js",
      priority: "REQUIRED",
      references: ["/requiredSkills/0", "/jobDescription"],
    };
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      jobDescription: "Bắt buộc thành thạo Node.js. Ưu tiên Docker. Làm việc từ xa.",
    }))).resolves.toEqual(extraction);
  });

  it.each([
    ["a requirement absent from the description", (extraction) => {
      extraction.requirements[1] = {
        name: "Kubernetes",
        priority: null,
        references: ["/jobDescription"],
      };
    }],
    ["an experience minimum absent from the description", (extraction) => {
      extraction.minimumExperienceYears = {
        value: 5,
        references: ["/jobDescription"],
      };
    }],
    ["a priority the description does not state", (extraction) => {
      extraction.requirements[1].priority = "REQUIRED";
    }],
  ])("does not certify free-text semantics for %s from a field-level pointer", async (_name, mutate) => {
    const extraction = makeExtraction();
    mutate(extraction);
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput()))
      .resolves.toEqual(extraction);
  });

  it.each([
    [
      "'internal tooling' read as an internship",
      { jobDescription: "Phát triển internal tooling cho đội vận hành." },
      {
        residualClaims: [{
          value: "Phát triển internal tooling cho đội vận hành",
          references: ["/jobDescription"],
        }],
      },
    ],
    [
      "'contract testing' read as a contract against structured FULL_TIME",
      {
        jobDescription: "Yêu cầu kinh nghiệm contract testing với Pact.",
        employmentType: "FULL_TIME",
      },
      {
        requirements: [{
          name: "kinh nghiệm contract testing với Pact",
          priority: "REQUIRED",
          references: ["/jobDescription"],
        }],
      },
    ],
    [
      "a commercial-contract duty read as a contract employment type",
      { jobDescription: "Soạn thảo và rà soát hợp đồng thương mại." },
      {
        residualClaims: [{
          value: "Soạn thảo và rà soát hợp đồng thương mại",
          references: ["/jobDescription"],
        }],
      },
    ],
    [
      "'tự động hóa' read as freelance",
      { jobDescription: "Viết test tự động hóa cho hệ thống thanh toán." },
      {
        residualClaims: [{
          value: "Viết test tự động hóa cho hệ thống thanh toán",
          references: ["/jobDescription"],
        }],
      },
    ],
    [
      "a negated internship read as an internship",
      { jobDescription: "Vị trí này không tuyển thực tập sinh." },
      {
        uncertainClaims: [{
          value: "Vị trí này không tuyển thực tập sinh",
          references: ["/jobDescription"],
        }],
      },
    ],
    [
      "'không làm việc từ xa' read as remote",
      { jobDescription: "Không làm việc từ xa; làm việc tại văn phòng." },
      {
        workModes: [{ value: "ONSITE", references: ["/jobDescription"] }],
      },
    ],
    [
      "'không làm việc từ xa' read as a conflict with structured ONSITE",
      { jobDescription: "Không làm việc từ xa.", workModes: ["ONSITE"] },
      {},
    ],
    [
      "'kết hợp với team' read as hybrid",
      { jobDescription: "Kết hợp với team sản phẩm để thiết kế API." },
      {
        residualClaims: [{
          value: "Kết hợp với team sản phẩm để thiết kế API",
          references: ["/jobDescription"],
        }],
      },
    ],
  ])("accepts %s without lexical enum inference", async (_name, inputOverrides, claims) => {
    const extraction = { ...makeSparseExtraction(), ...claims };
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput({
      requiredSkills: [],
      employmentType: null,
      workModes: [],
      ...inputOverrides,
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
    ["a structured work mode withheld from the prompt", {}, (extraction) => {
      extraction.workModes[0].references = ["/workModes/0"];
    }],
    ["a structured employment type withheld from the prompt", {}, (extraction) => {
      extraction.employmentType = {
        value: "FULL_TIME",
        references: ["/employmentType"],
      };
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
    ["a requirement cited only from the title", (extraction) => {
      extraction.requirements[1].references = ["/title"];
      extraction.requirements[1].priority = null;
    }],
    ["an experience minimum cited only from the title", (extraction) => {
      extraction.minimumExperienceYears = {
        value: 5,
        references: ["/title"],
      };
    }],
    ["a requirement that does not carry its cited skill tag", (extraction) => {
      extraction.requirements[1].references = ["/requiredSkills/0", "/jobDescription"];
    }],
    ["a requirement cited only from its skill tag", (extraction) => {
      extraction.requirements[0].references = ["/requiredSkills/0"];
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

    expect(error.details.join("\n")).toMatch(/does not support|does not cite the Job description/);
  });

  it.each([
    ["a skill tag the description does not mention", { requiredSkills: ["Node.js", "Kafka"] }, () => {}],
    ["a description requirement without its skill-tag association", {}, (extraction) => {
      extraction.requirements[0].references = ["/jobDescription"];
    }],
    ["structured employment type and work modes", {}, () => {}],
    ["a description value that differs from structured metadata", {
      jobDescription: "Yêu cầu: Node.js bắt buộc. Ưu tiên Docker. Làm việc tại văn phòng. Bán thời gian.",
    }, (extraction) => {
      extraction.employmentType = { value: "PART_TIME", references: ["/jobDescription"] };
      extraction.workModes = [{ value: "ONSITE", references: ["/jobDescription"] }];
    }],
  ])("leaves %s to consolidation instead of requiring it in the extraction", async (
    _name,
    inputOverrides,
    mutate,
  ) => {
    const extraction = makeExtraction();
    mutate(extraction);
    const extractor = createJobExtractor({
      gemini: createGemini(extraction),
      logger: createLogger(),
    });

    await expect(extractor.extractJob(makeJobRawInput(inputOverrides)))
      .resolves.toEqual(extraction);
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
