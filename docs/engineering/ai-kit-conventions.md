# AI Kit Engineering Conventions

## Scope and authority

These conventions apply to code under `ai-kit/`. They define enforceable rules
for the current package foundation and for future AI Kit changes.

[`architecture.md`](architecture.md#ai-kit--current-state) defines AI Kit's
runtime role, ownership, and architectural constraints. The
[AI Kit foundation status](../project-status/ai-kit/foundation.md) records
implementation and verification state; it does not define requirements.
Approved Product Specifications and Data Contracts remain authoritative for
business behavior and persistence. AI-V01 Product/Data authority is approved
and deterministic. Its F01 (`normalizeJob`) and F02 (`normalizeGeneratedCv`)
normalization is reachable only through the `createAiKit` instance. The
superseded LLM-based F01 Job extraction stage, its R2 contract file and
loader, and its R4 contract tests have been retired. AI-V02 and
AI-V03 are not approved. AI #1/#2/#3 architecture direction does not
independently approve another business capability.

## Terminology

- **Must** or **must not** identifies a required rule.
- **Current foundation** identifies behavior implemented and verified today.
- **Future capability rule** applies only after the relevant Product and Data
  authority exists; it does not imply that the capability is implemented.
- **Public API** means an approved production export from the package root
  and the approved runtime members of the instance it creates.
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
│   ├── codex-client.js
│   ├── gemini-client.js
│   ├── groq-client.js
│   ├── llm-fallback.js
│   └── provider-usage.js
├── normalization/
│   ├── normalization-support.js
│   ├── job-normalization.js
│   └── cv-normalization.js
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
- The `createAiKit` instance exposes the AI-V01 runtime entry `normalizeJob`
  and `normalizeGeneratedCv` as the F01/F02 owners' functions themselves. The
  facade must not wrap, translate, or re-validate their results or coded
  errors, and the package root must not export the owners or their constants
  separately. Callers distinguish refusal by `error.code`
  (`INVALID_JOB_INPUT`, `INVALID_GENERATED_CV_INPUT`) and the result by
  `status` (`READY` with a profile, `FAILED` with `profile: null`).
- Backend creates the shared package instance only in
  `backend/src/services/ai-kit.service.js`. AI Kit must not create a second
  Backend-owned application instance.
- Current Backend consumers are B1 `job-ai-normalization.service.js`
  (`normalizeInternalJob` → `normalizeJob`) and B2
  `candidate-cv-ai-normalization.service.js`
  (`normalizeOwnGeneratedCandidateCv` → `normalizeGeneratedCv`). They reuse
  `loadInternalJob` / `loadOwnActiveCandidateCv` for canonical source access.
  Backend owns canonical source validation and passes only valid plain,
  career-relevant projections with resolved taxonomy to AI Kit. Lossless
  persisted-source projection must not use public DTOs or hydration to repair
  malformed stored values; schema defaults apply only to absent keys. IDs and
  dates cross as strings, and Generated CV `personalInfo` carries only `links`.
  Local Location invariants reuse Backend model validators; AI Kit checks
  projection shape and resolved-reference consistency without duplicating
  Backend domain rules or external catalog validation (AI Data §11.2–11.3).
- B1/B2 return AI Kit results unchanged. Unknown/wrong-level references are
  Backend refusals; invalid persisted projections, including AI Kit's
  `INVALID_JOB_INPUT` / `INVALID_GENERATED_CV_INPUT`, are 500 projection errors.
  Only typed DB availability failures in source/raw/taxonomy reads become
  `FAILED` with `profile: null`, without calling the normalizer or logging
  source content/raw driver diagnostics; unexpected errors propagate.
  Sparse DRAFTs do not acquire submit, completeness, default, or PUBLIC gates.
- B1/B2 are runtime service entries only. Public Job access, Uploaded CV,
  Recruiter/application CV access, HTTP integration, Job/CV CRUD hooks, and
  AI-specific persistence are not implemented by these entries. AI #1/#2/#3
  remain future direction requiring their own approved Product/Data authority.
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

- `src/llm/codex-client.js` is the only direct `openai` consumer.
- `src/llm/gemini-client.js` is the only direct `@google/genai` consumer.
- `src/llm/groq-client.js` is the only direct `groq-sdk` consumer.
- Future capabilities must depend on AI Kit-owned capability or adapter
  boundaries, not import a provider SDK directly.
- A provider adapter owns SDK construction, provider request delegation,
  provider-boundary validation, and minimal provider failure logging. It must
  not own business prompts, matching/scoring rules, authorization, or
  persistence.
- Each adapter call sends at most one HTTP attempt. Adapters disable SDK-level
  automatic retries explicitly (Codex and Groq `maxRetries: 0`; Gemini
  `httpOptions.retryOptions.attempts: 1`) so provider recovery stays owned by
  the fallback policy.
- Provider-specific request and response shapes must not be declared a
  universal LLM contract merely to hide differences between SDKs.

### Fallback policy

- `src/llm/llm-fallback.js` is the canonical fallback classifier and
  orchestrator. Consumers must not duplicate or widen its policy.
- The composing capability declares the provider order and a bounded
  per-provider attempt count. A retry or next-provider fallback occurs only
  after an eligible failure.
- Eligible HTTP statuses are exactly 429, 500, 502, 503, and 504.
- A connection/timeout failure is eligible only when the structured error or
  its `cause` chain contains a recognized name, `code`, or `errno` and no HTTP
  response. Error message text alone must not determine eligibility.
- Authentication, configuration, request-validation, and programming failures
  must propagate without retry or fallback. A final provider failure propagates
  unchanged.
- The fallback utility is internal and currently has no capability
  composition. Its existence must not be described as automatic fallback for
  all AI requests.
- Do not add further retries, a circuit breaker, provider registry, or
  universal LLM abstraction without a concrete capability need and an approved
  architecture change.

### Logging and sensitive data

- Runtime modules use the injected logger; they must not obtain or construct a
  second application logger.
- Logs must not include API keys, access credentials, CV or Job Description
  content, business prompts, tool arguments containing private data, or raw
  provider responses. Prefer minimal metadata such as provider/model and
  normalized status.
- Each successful provider API call logs `input_tokens`, `output_tokens`,
  `total_tokens`, and `cached_tokens` through the injected logger. An
  unavailable provider usage field is logged as `null`, not guessed.
- Before delegating each API request, the provider adapter logs
  `AI provider API request started` with only `provider`, configured `model`,
  and SDK `operation`. Manual smoke harnesses use the same adapters, so the
  request is visible while waiting for a response, including failed calls.
- Errors must be propagated according to the owning boundary. Logging must not
  replace, swallow, or rewrite a provider error unless an approved capability
  contract requires translation.

### Structured output

AI-V01 runtime shapes are owned by the deterministic F01/F02 owners
(`job-normalization.js`, `cv-normalization.js`): each defines its source
projection, its profile, and the READY/FAILED result it returns. The former
`ai-kit/v01-contract.json` and its loader have been retired. AI-V01 uses
no structured LLM output or JSON Schema validator; Ajv is not a production
dependency. ESLint's transitive Ajv dependency remains development tooling.

An approved capability that consumes structured LLM output must validate that
output before treating it as trusted data. Consumers of AI-V01 must
reuse the F01/F02 owners' result shapes rather than define a parallel profile
or result shape. AI
Kit must not invent one shared JSON schema for capabilities that do not yet
have specifications.

## Document extraction

- `src/document/pdf-text-extractor.js` is the only direct `pdfjs-dist`
  consumer and uses the legacy ESM Node build.
- Standard font data is resolved from the installed PDF.js package by the
  extractor; no environment setting or remote font service is required.
- `extractPdfText(pdfPath)` accepts a non-empty path string and extracts the
  existing text layer in page order, retaining line and page boundaries.
- PDF.js does not perform OCR; a document without extractable text returns an
  empty string. OCR and uploaded-CV business workflows remain deferred.
- Each extraction owns its loading task and worker. Page resources must be
  cleaned after text extraction; the loading task must be destroyed in a
  `finally` block on success or failure, including loading failures.
- No shared worker, global worker override, or shared-runtime disposal owner
  is required. Finishing one extraction must not affect concurrent calls.
- `pdfjs-dist` is pinned to `5.6.205` for Node 20.19 compatibility; dependency
  upgrades must check the Node engine requirement.
- Buffer input remains deferred; focused fixtures do not prove an uploaded-CV
  ingestion pipeline or OCR capability.

## Tests and verification

### Offline tests

- `npm test` and `npm run verify:agent` must remain deterministic and must not
  call live LLM providers or consume API quota.
- Provider SDKs and network behavior are mocked in offline provider tests.
- Tests cover public exports, dependency boundaries, input/error propagation,
  fallback eligibility and attempt limits, sensitive logging, and resource
  cleanup when the affected behavior changes.
- `test/v01-normalization-public-api.test.js` covers the AI-V01 runtime entry
  through `@jobhub/ai-kit`: the instance exposes exactly `normalizeJob` and
  `normalizeGeneratedCv`, works without provider configuration and without
  logging, returns results equal to the F01/F02 owners' (complete and
  sparse/DRAFT-like READY, FAILED without a profile), and refuses unresolved
  or wrong-level taxonomy references with the owners' coded errors without
  echoing source content.
- `test/job-normalization.test.js` covers revised F01 deterministic Job
  normalization: complete and sparse READY profiles, empty metadata not filled
  from free text, metadata/description differences preserved, no priority or
  free-text requirements, verbatim free text, valid Structured Salary
  variants, determinism and immutability, input refusal without echoing Job
  content, FAILED without a profile, and the no-provider/no-contract import
  boundary.
- `test/cv-normalization.test.js` covers F02 deterministic Generated CV
  normalization: complete and near-empty READY profiles, missing sections and
  draft items left empty, empty metadata not filled from free text, separate
  `skillTags`/content skills/project technologies with duplicates, conflicting
  experience claims preserved without derived durations, unmappable language
  proficiency, `hiddenSections` with hidden content kept, no deduplication of
  structured/free-text overlap, determinism and immutability, input refusal
  without echoing CV content, FAILED without a profile, and the import and
  package-root boundaries.
- Local deterministic fixtures may exercise a real library, as the current
  text-native PDF fixture does, provided they require no external service.
- A focused test may import an internal module directly; that import does not
  make the module part of the production public API.

### Manual live smoke

Run provider smoke checks separately:

```bash
cd ai-kit
npm run smoke:codex
npm run smoke:gemini
npm run smoke:groq
```

- Live smoke may consume quota and requires provider credentials supplied by
  Backend-owned configuration.
- Smoke commands must remain outside `npm test` and `npm run verify:agent`.
- Each harness logs start and pass/fail with provider/model and elapsed
  `durationMs` through its injected logger; pass is emitted only after marker
  validation. Token usage remains owned by the provider adapter. Backend CLI
  log formatting redacts the configured API key in messages and metadata;
  marker-validation errors must not echo unexpected provider response text.
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
