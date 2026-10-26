# AI Kit Engineering Conventions

## Scope and authority

These conventions apply to code under `ai-kit/`. They define enforceable rules
for the current package foundation and for future AI Kit changes.

[`architecture.md`](architecture.md#ai-kit--current-state) defines AI Kit's
runtime role, ownership, and architectural constraints. The
[AI Kit foundation status](../project-status/ai-kit/foundation.md) records
shared package evidence, while the
[AI-V01 status](../project-status/ai-kit/v01-job-cv-normalization.md) records
V01 implementation and acceptance evidence, and the
[AI-V02 status](../project-status/ai-kit/v02-uploaded-cv-normalization.md)
records V02 implementation and verification evidence; none defines requirements.
Approved Product Specifications and Data Contracts remain authoritative for
business behavior and persistence. AI-V01 Product/Data authority is approved
and deterministic. Its F01 (`normalizeJob`) and F02 (`normalizeGeneratedCv`)
normalization is reachable only through the `createAiKit` instance. The
superseded LLM-based F01 Job extraction stage, its R2 contract file and
loader, and its R4 contract tests have been retired. AI-V02 Product/Data
authority is approved and Final Acceptance is `ACCEPTED`; its F01
(`normalizeUploadedCv`) is implemented offline through the same instance.
AI-V03 Product/Data authority is approved; F01 Match Result orchestration and
F02–F04 assessment/scoring are implemented offline. AI-V04 Product/Data
authority is approved; F01 Slice 1 implements the internal evaluation entry,
and Slice 2 adds the Candidate Backend HTTP entry. AI-V05 Product/Data authority
is approved; Slice 01 adds deterministic Job embedding text and Backend
post-publish synchronization, and Slice 05 reuses V03 calculators for final
recommendation scoring through the shared facade. AI #1/#2/#3 architecture direction
does not independently approve another business capability.

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
│   ├── cv-normalization.js
│   ├── cv-match-profile-career.js
│   ├── uploaded-cv-normalization.js
│   └── uploaded-cv-semantic-extraction.js
├── document/
│   └── pdf-text-extractor.js
├── matching/
│   ├── deterministic-field-scoring.js
│   ├── semantic-skills-assessment.js
│   ├── match-result-orchestration.js
│   └── weighted-match-scoring.js
└── evaluation/
    └── cv-evaluation.js
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
- B1/B2 are runtime service entries. AI-V03 F01 adds a Candidate HTTP consumer
  through Backend's own CV and V8 Job visibility gates, reusing their lossless
  source projections and the AI-V02 Uploaded CV runtime entry. AI-V04 F01 adds
  a distinct Candidate HTTP consumer of the same authorized profile preparation
  and the `evaluateCv` entry. Recruiter/
  application CV access, Job/CV CRUD hooks, and AI-specific persistence are
  not implemented by these entries. AI #1/#2/#3 remain future direction
  requiring their own approved Product/Data authority.
- AI-V02 Slice 4a projects an already authorized own active Uploaded CandidateCV
  in the Backend CandidateCV AI service into the eight-field `cvSource`, using
  persisted metadata and B2 taxonomy resolution. The projection is not an
  authorization entry or an Uploaded normalization consumer; no PDF, AI Kit,
  provider, persistence, or cache operation occurs in that slice. Slice 4c adds
  an internal own-Candidate runtime entry in the same service. It binds the
  projected metadata and current PDF to one Uploaded file identity, then calls
  the shared `normalizeUploadedCv` entry once and returns its READY/FAILED
  result unchanged. No HTTP consumer or additional actor scope is approved.
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
  `httpOptions.retryOptions.attempts: 1`) and Gemini SDK automatic continuation
  (`config.automaticContinuation: false`) so provider recovery stays owned by
  the fallback policy.
- Provider-specific request and response shapes must not be declared a
  universal LLM contract merely to hide differences between SDKs.

### Fallback policy

- `src/llm/llm-fallback.js` is the canonical fallback classifier and
  orchestrator. Consumers must not duplicate its policy or widen eligibility
  outside this owner.
- The composing capability declares the provider order and a bounded
  per-provider attempt count. A retry or next-provider fallback occurs only
  after an eligible failure.
- Under the current provider-availability policy, eligible HTTP statuses are
  exactly 429, 500, 502, 503, and 504.
- A connection/timeout failure is eligible only when the structured error or
  its `cause` chain contains a recognized name, `code`, or `errno` and no HTTP
  response. Error message text alone must not determine eligibility.
- Under that policy, authentication, configuration, request-validation, and
  programming failures propagate without retry or fallback. A final provider
  failure propagates unchanged.
- AI-V06 must compose configured providers in Codex → Gemini → Groq order.
  For AI-V06 only, provider request errors, timeouts, incomplete responses,
  and malformed or contract-invalid output are eligible to advance to the next
  provider. Completion and contract validation must occur inside each provider
  attempt so a returned response is not mistaken for a valid result. Accept the
  first completed, contract-valid output, including an all-`null` optimization
  result, without a semantic quality rejection gate. If no provider produces
  one, surface an AI-processing failure; do not fabricate a successful result.
  Caller input, Backend authorization, local configuration, and programming
  failures are outside this provider fallback boundary. Implement the scoped
  eligibility in the canonical fallback owner without changing V02–V05
  behavior.
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
- Provider adapter failure logs include only provider, configured model, HTTP
  status, and a bounded error code. Do not pass an SDK error object, its message,
  stack, cause, or response body to the logger.
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
dependency, and the AI-V02 validator below interprets its own schema. ESLint's transitive Ajv dependency remains development tooling.

An approved capability that consumes structured LLM output must validate that
output before treating it as trusted data.

AI-V06 Slice 01 output contract (`src/optimization/optimization-result.js`)
defines the single provider-native strict schema and parser for its seven
required, nullable career sections. Item fields follow Generated CV V7; the
parser checks structure, enum values, and ISO date syntax. An all-null result
passes. Slice 02 (`src/optimization/cv-optimization.js`) builds a compact
Job/CV source context separated from V04 advisory feedback, prompts only for
the seven sections, and uses the existing single-provider structured inference
helper with the Slice 01 schema and parser. Fallback and baseline composition
remain deferred.

AI-V02 F01 output contract (`src/normalization/uploaded-cv-normalization.js`):

- `UPLOADED_CV_PDF_EXTRACTION_SCHEMA` is the single strict schema for the LLM
  interpretation of extracted PDF text. It uses only `type`, `properties`,
  `required`, `additionalProperties: false`, and `items`, with
  `["string", "null"]` for absent scalars; every property is required. Groups:
  `careerPositioning`, `professionalSummary`, `skills`, `workExperiences`,
  `projects`, `educations`, `certifications`, `languages`,
  `otherCareerClaims`, `unresolvedContent`. Each claim or item carries
  `evidence`, requested as verbatim excerpts of the extracted text. Values stay
  as stated: periods, dates, and proficiency are text, not ISO dates or
  canonical enums.
  Backend metadata is not part of the schema.
- `composeUploadedCvProfile({ cvSource, extractedText, pdfExtractionOutput, diagnostic })`
  refuses an invalid Backend metadata source or empty text with
  `UploadedCvNormalizationError` `INVALID_UPLOADED_CV_INPUT`. It returns FAILED
  with no profile when the provider output text is not JSON, violates the
  schema (including blank strings), has a claim without evidence, or has an
  item that states no value. A non-empty excerpt absent from the
  whitespace-collapsed PDF.js text is reported only through the optional
  diagnostic callback used by `--debug` (`EXCERPT_NOT_FOUND` with paths and
  count); it does not make the result FAILED. Lexical matching neither verifies
  grounding nor substitutes for the separate BR-AI-22 interpretation-quality
  assessment. Otherwise it returns READY with
  `{ source: { type: "UPLOADED_CV", candidateCvId }, metadata, pdfContent }`:
  `metadata` is the shared CandidateCV metadata group with JSON Pointer
  `sourcePath` provenance, identical to the Generated variant; `pdfContent` is
  the validated interpretation copied as-is. Sparse output is READY. Neither
  side overrides, merges, or deduplicates the other.
- `readCvCareerContent(profile)` in `src/normalization/cv-match-profile-career.js`
  is the shared consumer read contract for either `CVMatchProfile` variant.
  It returns a frozen object with the same ten career groups listed above;
  every group is an array of `{ value, provenance }`. Claim `value` is a
  string. Item `value` has stable fields for its group, including the union of
  source-specific fields: `startDate`/`endDate` and `period`, `issueDate` and
  `date`, `proficiency` and `statedProficiency`. An absent scalar is `null`; an
  absent list is `[]`. No field is inferred from another. `provenance` always
  has `{ sourcePath, fieldSourcePaths, evidence }`: Generated content uses its
  existing JSON Pointer paths and no PDF evidence; Uploaded content has no
  Generated path and retains the PDF evidence excerpts. Item field paths are
  retained individually, including list element paths. Order, duplicates,
  conflicting `otherCareerClaims`, and `unresolvedContent` are preserved.
  Shared Backend metadata remains at `profile.metadata`; Generated CV links
  and `hiddenSections` remain in its source-specific `content`. This reader
  does not change either profile or introduce semantic extraction.
- The owner does not call providers, build prompts, fall back to JSON Mode, or
  log. Provider-specific strict-mode wiring belongs to the F01 orchestration.
  Consumers use the shared career reader instead of defining a parallel
  interpretation of the two source shapes. AI Kit must not invent one shared
  JSON schema for capabilities that do not yet have specifications.

AI-V02 F01 runtime orchestration (`src/normalization/uploaded-cv-semantic-extraction.js`):

- `createAiKit` exposes `normalizeUploadedCv({ cvSource, pdfBuffer, provider })`;
  `provider` defaults to `codex` and may explicitly select `gemini` or `groq`. Backend
  must supply the authorized source and current PDF bytes; AI Kit checks the
  source projection before extraction, but does not authorize or persist it.
- The owner extracts the PDF text once, sends only that text and a short
  evidence-bound instruction to exactly one adapter call, then passes the
  provider's output text to `composeUploadedCvProfile`. No Backend metadata
  enters the prompt, no second semantic pass, retry, or automatic provider
  fallback occurs. Provider failures propagate; invalid output returns FAILED.
- Codex uses Responses API `text.format.type: "json_schema"` with `strict: true`
  and the same schema. Only a `completed` response with null
  `incomplete_details`/`error` and one completed assistant text message without
  refusal or tool output can reach output validation. A refused, incomplete,
  failed, or malformed response returns FAILED even if it contains valid JSON.
- Gemini uses `responseMimeType: "application/json"` with
  `responseJsonSchema: UPLOADED_CV_PDF_EXTRACTION_SCHEMA` in its native SDK.
  Only a first candidate with `finishReason: "STOP"` and no continuation token
  can reach output validation; missing, unfinished, truncated, or blocked
  candidate states return FAILED even when text is structurally valid.
  Groq uses `response_format.type: "json_schema"` with `strict: true` and the
  same schema. Only a first choice with `finish_reason: "stop"` and no message
  refusal can reach output validation; other or missing finish reasons return
  FAILED. Neither silently switches to JSON Object Mode. Adapter request and
  schema acceptance are covered offline; live acceptance and semantic quality
  require separate evaluation.

AI-V03 F02 Semantic Skills Assessment (`src/matching/semantic-skills-assessment.js`):

- Consumes READY `JobMatchProfile` and `CVMatchProfile` internally. The prompt
  contains structured required skills, Job Description, and nonempty CV career
  claims with short source IDs and existing PDF evidence excerpts when present;
  it excludes source identities and unrelated metadata. The shared career
  reader supplies Generated/Uploaded CV content.
- Uses one explicitly selected adapter call (Codex by default, or Gemini/Groq)
  with a strict provider-native JSON schema. No retry or automatic fallback is
  composed. Invalid completion or output raises a coded AI-processing error;
  a missing skill or missing evidence remains a valid assessment outcome.
- Validates rubric scores, priority, source references, structured-skill
  coverage, and duplicate structured-skill use before returning
  `requirementGroups`. Restores source paths and PDF excerpts from the input
  profiles after validation. The provider never authors provenance paths.
- The returned assessment is the logical input to F04. F02 does not calculate
  weights or Match Score. Semantic grounding and equivalence quality require
  evaluation; strict output validation does not establish their accuracy.

AI-V04 F01 Slice 1 CV Evaluation (`src/evaluation/cv-evaluation.js`):

- Consumes one authorized READY Job/CV normalization pair through the
  `createAiKit` instance `evaluateCv` entry. Backend Slice 2 owns access checks
  and HTTP response mapping.
- Uses one provider-native strict structured-output inference for V03-compatible
  semantic requirement groups and V04 feedback. Reuses the V03 source/rubric
  validation and deterministic/weighted score calculators; feedback never
  supplies or changes scores.
- Accepts empty review text and an empty improvement list. Specific CV item
  references are resolved from the existing source-aware career view; null
  references retain section-level feedback. Invalid structured output fails
  the request, while sparse evidence and low scores remain business results.
- Does not persist, edit CV content, apply to Jobs, or call another provider
  automatically.

## Document extraction

- `src/document/pdf-text-extractor.js` is the only direct `pdfjs-dist`
  consumer and uses the legacy ESM Node build.
- Standard font data is resolved from the installed PDF.js package by the
  extractor; no environment setting or remote font service is required.
- `extractPdfText(pdfPath)` accepts a non-empty path string and extracts the
  existing text layer in page order, retaining line and page boundaries.
- PDF.js does not perform OCR; for `extractPdfText`, a document without
  extractable text returns an empty string. OCR remains out of scope.
- `extractPdfTextFromBuffer(pdfBuffer)` is the AI-V02 F01 extraction boundary
  for an uploaded PDF Buffer supplied by Backend. It accepts a non-empty
  `Buffer`/`Uint8Array`, passes PDF.js a copy so the caller's bytes are never
  detached or altered, and returns the same text-layer format. Failures throw
  `PdfTextExtractionError` with `code` `INVALID_PDF_INPUT` (refused before PDF.js
  resources are created), `PDF_UNREADABLE` (PDF.js failure, original error as
  `cause`, no content in the message), or `PDF_TEXT_NOT_EXTRACTABLE` (empty text
  layer). Empty text is never a successful result on this boundary. It is not
  exported from the package root and does not call providers, persist, or cache.
- Each extraction owns its loading task and worker. Page resources must be
  cleaned after text extraction; the loading task must be destroyed in a
  `finally` block on success or failure, including loading failures.
- No shared worker, global worker override, or shared-runtime disposal owner
  is required. Finishing one extraction must not affect concurrent calls.
- `pdfjs-dist` is pinned to `5.6.205` for Node 20.19 compatibility; dependency
  upgrades must check the Node engine requirement.
- Focused fixtures prove the extraction boundary only; they do not prove the
  AI-V02 semantic extraction, `CVMatchProfile` composition, Backend
  integration, or an OCR capability.

## Tests and verification

### Offline tests

- `npm test` and `npm run verify:agent` must remain deterministic and must not
  call live LLM providers or consume API quota.
- Provider SDKs and network behavior are mocked in offline provider tests.
- Tests cover public exports, dependency boundaries, input/error propagation,
  fallback eligibility and attempt limits, sensitive logging, and resource
  cleanup when the affected behavior changes.
- `test/v01-normalization-public-api.test.js` covers the AI-V01 runtime entries
  through `@jobhub/ai-kit`: `normalizeJob` and `normalizeGeneratedCv` work
  without provider configuration or logging, return results equal to the
  F01/F02 owners' (complete and sparse/DRAFT-like READY, FAILED without a
  profile), and refuse unresolved
  or wrong-level taxonomy references with the owners' coded errors without
  echoing source content.
- `test/uploaded-cv-semantic-extraction.test.js`,
  `test/uploaded-cv-provider-http.test.js`, and
  `test/uploaded-cv-codex-http.test.js` cover the AI-V02 `normalizeUploadedCv`
  entry through the package root, including one-pass provider requests,
  structured output, completion checks, and offline SDK HTTP boundaries.
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

For AI-V02 F01, `npm run smoke:uploaded-cv:codex -- --pdf <path>` runs a
provider-free preflight by default; `--live` explicitly enables one Codex
normalization call. The PDF path is relative to `ai-kit/`. The CLI uses a
synthetic, source-contract-valid `cvSource`, so its result does not establish
Backend ownership or authorization. It reports request configuration,
completion, result status, token usage, duration, and aggregate claim/evidence
counts without printing PDF content, raw responses, or personal data.
`--live --debug --full-output` additionally writes the complete LLM extraction
JSON, complete `CVMatchProfile` JSON (or `null` when absent), and a safe gate
summary under ignored local `ai-kit/.smoke-output/`. This is an explicit manual
inspection artifact, outside AI Kit runtime persistence or cache. The files do
not contain credentials, request headers, the request prompt, or PDF input text
as a separate artifact. Console diagnostics remain redacted.

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
