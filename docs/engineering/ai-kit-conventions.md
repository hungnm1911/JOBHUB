# AI Kit Engineering Conventions

## Scope and authority

These conventions apply to code under `ai-kit/`. They define enforceable rules
for the current package foundation and for future AI Kit changes.

[`architecture.md`](architecture.md#ai-kit--current-state) defines AI Kit's
runtime role, ownership, and architectural constraints. The
[AI Kit foundation status](../project-status/ai-kit/foundation.md) records
implementation and verification state; it does not define requirements.
Approved Product Specifications and Data Contracts remain authoritative for
business behavior and persistence. AI-V01 Product/Data authority is approved,
and its R2 runtime shape contract plus R4 contract-test coverage are complete.
Only the internal F01 Job extraction stage (`JobRawInput` to
`JobExtractionResult`) exists; F01 consolidation into `JobMatchProfile` and all
of F02 are not implemented, and no AI-V01 capability is exported. AI-V02 and
AI-V03 are not approved. AI #1/#2/#3 architecture direction does not
independently approve another business capability.

## Terminology

- **Must** or **must not** identifies a required rule.
- **Current foundation** identifies behavior implemented and verified today.
- **Future capability rule** applies only after the relevant Product and Data
  authority exists; it does not imply that the capability is implemented.
- **Public API** means an approved production export from the package root.
  Tooling-only package subpaths are not production APIs.

## Package and source boundaries

- AI Kit must remain the private local JavaScript ESM package
  `@jobhub/ai-kit`, executed in the Backend Node.js process.
- AI Kit must not create an Express application, HTTP listener, independent
  process, deployment lifecycle, database connection, or environment loader.
- Backend remains the owner of process lifecycle, `process.env`, normalized
  configuration, the canonical logger, authentication, authorization,
  persistence, and JOBHUB domain services.
- AI Kit production source and tooling must not read `process.env` or import
  Backend modules. Backend dependencies must be injected.
- Production consumers must use approved package exports. Backend source must
  integrate through `backend/src/services/ai-kit.service.js` and must not
  deep-import `ai-kit/src/`.
- `src/index.js` is the production facade. A module is exported there only when
  an approved production consumer needs it; direct imports in focused internal
  tests do not justify expanding the public API.
- Explicit `tooling/smoke-gemini` and `tooling/smoke-groq` subpaths remain
  manual smoke harnesses. They must not expose production capabilities through
  a tooling path.

## Files, symbols, and organization

- JavaScript filenames use descriptive lowercase kebab-case and `.js`.
  Relative ESM imports include the `.js` extension.
- Functions, variables, parameters, and object fields use camel case.
  Module-level immutable closed sets and fixed markers use upper snake case.
- `index.js` is reserved for a real public facade; it must not become a generic
  barrel for internal modules.
- Tests use `<subject>.test.js`. Local fixtures belong under `test/fixtures/`
  and must not depend on an external service unless the test is explicitly a
  manual live smoke.
- New folders are introduced only for an approved capability with concrete
  modules. Do not pre-create `agents/`, `providers/`, `repositories/`,
  `domain/`, `shared/`, `utils/`, `prompts/`, `profiles/`, `matching/`,
  `retrieval/`, or `embedding/` as speculative structure.
- Backend controller/service/repository layering must not be copied into AI Kit
  without a responsibility that belongs to AI Kit and an explicit architecture
  decision.

The current source organization is:

```text
src/
├── index.js
├── create-ai-kit.js
├── llm/
│   ├── gemini-client.js
│   ├── groq-client.js
│   └── llm-fallback.js
├── normalization/
│   ├── v01-contract.js
│   └── job-extraction.js
└── document/
    └── pdf-text-extractor.js
```

This tree records current owners; it is not a required scaffold for every
future capability.

## Composition and Backend integration

- AI Kit receives plain data, normalized configuration, the injected logger,
  and narrowly scoped callbacks. It must not obtain those dependencies through
  global state or reverse imports.
- `createAiKit` is the current package composition boundary. Its public input
  validation must fail before initializing a dependent provider or capability.
- Backend creates the shared package instance only in
  `backend/src/services/ai-kit.service.js`. AI Kit must not create a second
  Backend-owned application instance.
- AI Kit must not access Mongoose models, query or mutate MongoDB, authenticate
  JWTs, inspect Express request/response objects, decide JOBHUB permissions, or
  call Backend-internal services directly.
- For a future tool call, the LLM may propose a tool and arguments. AI Kit may
  invoke only an injected callback; the Backend callback must validate the
  input, authorize the actor, and execute the canonical domain service.
- A tool registry, tool schema, permission model, or CV Agent workflow must not
  be introduced before an approved capability specification defines it.

## LLM providers and fallback

### Provider adapters

- `src/llm/gemini-client.js` is the only direct `@google/genai` consumer.
- `src/llm/groq-client.js` is the only direct `groq-sdk` consumer.
- Future capabilities must depend on AI Kit-owned capability or adapter
  boundaries, not import a provider SDK directly.
- A provider adapter owns SDK construction, provider request delegation,
  provider-boundary validation, and minimal provider failure logging. It must
  not own business prompts, matching/scoring rules, authorization, or
  persistence.
- Each adapter call sends at most one HTTP attempt. Adapters disable SDK-level
  automatic retries explicitly (Gemini `httpOptions.retryOptions.attempts: 1`;
  Groq `maxRetries: 0`, whose SDK default is 2 retries) so provider recovery
  stays owned by the fallback policy.
- Provider-specific request and response shapes must not be declared a
  universal LLM contract merely to hide differences between SDKs.

### Fallback policy

- `src/llm/llm-fallback.js` is the canonical fallback classifier and
  orchestrator. Consumers must not duplicate or widen its policy.
- The primary receives at most one attempt. The fallback receives at most one
  attempt and only after an eligible primary failure.
- Eligible HTTP statuses are exactly 429, 500, 502, 503, and 504.
- A connection/timeout failure is eligible only when the structured error or
  its `cause` chain contains a recognized name, `code`, or `errno` and no HTTP
  response. Error message text alone must not determine eligibility.
- Authentication, configuration, request-validation, and programming failures
  must propagate without fallback. A failed fallback propagates unchanged.
- The fallback utility is internal. Its only capability composition is the
  internal F01 Job extraction stage, which uses Gemini as primary and Groq as
  fallback when both clients are injected. Its existence must not be described
  as automatic fallback for all AI requests.
- Do not add retries, a circuit breaker, provider registry, or universal LLM
  abstraction without a concrete capability need and an approved architecture
  change.

### Logging and sensitive data

- Runtime modules use the injected logger; they must not obtain or construct a
  second application logger.
- Logs must not include API keys, access credentials, CV or Job Description
  content, business prompts, tool arguments containing private data, or raw
  provider responses. Prefer minimal metadata such as provider/model and
  normalized status.
- Errors must be propagated according to the owning boundary. Logging must not
  replace, swallow, or rewrite a provider error unless an approved capability
  contract requires translation.

### Structured output

[`ai-kit/v01-contract.json`](../../ai-kit/v01-contract.json) is the canonical
runtime-only shape contract for AI-V01 raw inputs, extraction results,
`JobMatchProfile`, `CVMatchProfile`, and normalization results. Its JSON Schema
rules validate structure; its `x-semantic-constraints` record the approved
cross-field rules that require deterministic runtime enforcement. The contract
does not implement F01/F02, perform authorization, or create persistence.

`src/normalization/v01-contract.js` is the only production loader of that
contract. It compiles definitions with the production `ajv` dependency and
derives deterministic provider-compatible projections from the canonical
`JobExtractionResult`. Gemini receives JSON MIME type plus its JSON Schema
projection; Groq receives `response_format.type = json_schema`, its projection,
and `strict: true`. Provider projections may omit unsupported validation
keywords, but they do not omit canonical fields; Draft 2020-12 Ajv validation
against the full canonical definition remains mandatory after the response.
Validation messages carry only instance paths and messages, never validated
content.

An approved capability that consumes structured LLM output must validate that
output before treating it as trusted data. The F01 Job extraction stage rejects
provider refusals/incomplete responses, non-JSON output, canonical-schema
violations, invalid or unresolved JSON Pointers, requirement or experience
claims cited only from the title, enum claims that differ from their cited
structured value, requirements that do not carry their cited structured skill
tag, dropped structured metadata, unpreserved enum conflicts, and duplicate
equivalent requirements. It does not repair schema-invalid output or retry it.
AI-V01 references are field-level JSON Pointers, which prove provenance but not
semantic support: whether free text supports a claim's priority, experience
scope, or wording is not decided by deterministic keyword, token, or number
matching. That alignment (BR-AI-01/09) is owned by the extraction prompt and
measured by reported live evaluation. Consumers of AI-V01 must
reuse its contract rather than define a parallel profile or result shape. AI
Kit must not invent one shared JSON schema for capabilities that do not yet
have specifications.

## Document extraction

- `src/document/pdf-text-extractor.js` is the only direct
  `scribe.js-ocr` consumer.
- Every opened document must be closed after both success and failure.
- Extraction must not terminate the shared Scribe runtime after each document
  or interfere with concurrent extractions.
- Shared teardown remains an explicit lifecycle operation through
  `disposePdfTextExtractor()`.
- Before a Scribe-backed production capability is accepted into Backend
  runtime, its integration must decide and verify startup/shutdown ownership,
  including whether Backend shutdown invokes shared disposal.
- Buffer input, scanned-PDF/OCR assets, and uploaded-CV ingestion remain
  deferred. The text-native fixture does not prove those paths.

## Tests and verification

### Offline tests

- `npm test` and `npm run verify:agent` must remain deterministic and must not
  call live LLM providers or consume API quota.
- Provider SDKs and network behavior are mocked in offline provider tests.
- Tests cover public exports, dependency boundaries, input/error propagation,
  fallback eligibility and attempt limits, sensitive logging, and resource
  cleanup when the affected behavior changes.
- `test/v01-contract.test.js` compiles the canonical AI-V01 contract as Draft
  2020-12 and validates raw input, extraction, normalized profile, and result
  positive/negative cases. Its exhaustive coverage ledger distinguishes
  structural guarantees from semantic behavior deferred to F01/F02 runtime;
  the suite must not simulate normalization merely to claim that behavior is
  verified.
- `test/job-extraction.test.js` covers the F01 extraction stage with mocked
  provider clients: input refusal, minimized prompt document, provider request
  shapes (including Gemini schema output and Groq strict JSON Schema), fallback
  composition, refusal/truncation, canonical-contract rejection,
  provenance/structured-evidence rejection, acceptance of legitimate claims
  without lexical re-validation, structured-source preservation, and logging
  without Job content. Offline tests cannot measure extraction quality; that
  requires a separately reported live evaluation.
- Local deterministic fixtures may exercise a real library, as the current
  text-native PDF fixture does, provided they require no external service.
- A focused test may import an internal module directly; that import does not
  make the module part of the production public API.

### Manual live smoke

Run provider smoke checks separately:

```bash
cd ai-kit
npm run smoke:gemini
npm run smoke:groq
```

- Live smoke may consume quota and requires provider credentials supplied by
  Backend-owned configuration.
- Smoke commands must remain outside `npm test` and `npm run verify:agent`.
- A successful smoke for one provider verifies only that provider. It must not
  be used as evidence that another provider or fallback composition works.

### Verification gates

The canonical AI Kit gate is:

```bash
cd ai-kit
npm run verify:agent
```

Run the Backend gate as well when a change affects the package integration
boundary or Backend behavior:

```bash
cd backend
npm run verify:agent
```

Documentation-only changes do not require either full code gate unless they
also modify executable behavior. Always run the requested documentation checks
and report skipped gates honestly.

## Future capability authority

Before implementing AI business behavior:

1. Identify the approved Product Specification and the requirements in scope.
2. Identify the approved Data Contract for every persisted input or output.
3. Identify existing canonical Backend and AI Kit owners before adding a new
   boundary or abstraction.
4. Separate deterministic business computation from probabilistic LLM output
   in the capability design and verification plan.
5. Define capability-specific output validation and evaluation before treating
   model output as trusted or persisting it.

Roadmap titles, task names, and overview ideas are not sufficient authority to
define business semantics. AI output must not be written to persistence without
Data authority. Prompts, output schemas, matching weights, scoring thresholds,
evaluation requirements, tool limits, retrieval/embedding design, and workflow
semantics remain decisions for their approved capability.
