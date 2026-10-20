# AI Kit Foundation

## Current project state

- **Readiness:** AI Kit technical foundation: ready. AI-V01 Product
  Specification and Data Contract: approved; R2 Runtime Shape Contract and R4
  contract-test coverage: complete. AI-V01 is `IN PROGRESS`: Slice 01 (F01 Job
  extraction stage) is implemented and verified offline and live through
  Groq; Gemini live extraction remains unverified. F01 consolidation into
  `JobMatchProfile` and F02 are not
  implemented, so F01 is not complete. AI-V02 and AI-V03 are not approved by
  the current roadmap.
- **AI-V01 Slice 01 — F01 Job extraction stage implemented; verified:**
  internal `src/normalization/job-extraction.js` (`createJobExtractor`)
  validates `JobRawInput`, sends the LLM only title, description, and
  `requiredSkills`, uses Gemini JSON Schema
  structured output or Groq strict JSON Schema (`strict: true`), and calls
  Gemini with Groq fallback (or the single injected provider). It returns a
  `JobExtractionResult` only after response-completeness, JSON, canonical Draft
  2020-12, JSON Pointer provenance, title-only, skill-tag evidence,
  description-citation, and duplicate-requirement checks; otherwise it throws a coded
  `JobExtractionError` or propagates the provider error. Field-level pointers
  do not prove free-text semantic support, so priority, experience scope, and
  wording alignment are not verified deterministically (acceptance finding H1,
  resolved by approved option 1); they rely on the prompt and live evaluation.
  Acceptance finding H2 is partially addressed: a labeled expected-outcome
  ledger grades description-level semantic completeness on mocked outputs. A
  validator PASS is not evidence of semantic completeness. Acceptance finding
  H3 is implemented and verified offline; live quality of the final prompt is
  only partially verified (see the H3 verification entries). By approved
  decision, `JobExtractionResult` holds only claims stated in the Job's free
  text: the LLM decides requirement equivalence (including skill-tag
  association and REQUIRED for a requirement presented as both mandatory and
  preferred), while structured employment type/work modes, their precedence
  and conflicts with description values, and unmentioned skill tags belong to
  the not-yet-implemented F01 consolidation stage.
  `src/normalization/v01-contract.js` is the sole production contract loader;
  `ajv` 8.20.0 moved from dev to production dependency (approved). Not
  exported from the package root and not used by Backend.
- **Implemented; verified:** `ai-kit/` is the private `@jobhub/ai-kit` npm
  package using Node.js ES modules. Its package root is the only production
  source entrypoint and exports the minimal `createAiKit` composition factory;
  explicit `tooling/smoke-codex`, `tooling/smoke-gemini`, and
  `tooling/smoke-groq` subpaths expose only the manual smoke harnesses. The
  factory accepts separate optional `llm.codex`, `llm.gemini`, and `llm.groq` configuration
  plus a required injected logger contract, validates their boundary shapes,
  and still exposes no AI capability. The internal Codex-compatible provider
  foundation uses `openai` 6.49.0 and the Responses API through one
  provider-specific adapter. The internal Gemini provider foundation
  uses `@google/genai` 2.30.0 through one provider-specific adapter; the
  internal Groq provider foundation uses `groq-sdk` 1.6.0 through a separate
  provider-specific adapter that owns SDK construction and
  `chat.completions.create` delegation. The internal
  `executeWithLlmProviderChain` orchestrator accepts provider call functions
  without unifying their adapter contracts, preserves successful provider
  results, and allows retry/fallback only for HTTP 429/500/502/503/504 or a
  structured response-free connection/timeout failure. The F01 composition is
  Codex (at most two HTTP attempts), Gemini (one), then Groq (one); all adapters
  disable SDK-level automatic retries. Each adapter logs the provider, model,
  and SDK operation before sending a request, including smoke calls and each
  retry/fallback attempt. Successful provider calls log normalized
  `input_tokens`, `output_tokens`, `total_tokens`, and `cached_tokens` without
  prompt or response content. The adapters and
  fallback orchestrator are composed only inside the internal F01 Job
  extraction stage, not by `createAiKit`, so startup remains valid with any
  provider combination
  configurations. ESLint and Vitest remain aligned with the backend tooling,
  with a package-local `verify:agent` gate and explicit no-`process.env` and
  provider-SDK-import source boundaries.
- **Document extraction foundation implemented; verified:** AI Kit locks
  `scribe.js-ocr` 0.16.1 and confines its direct import to the internal
  `src/document/pdf-text-extractor.js` adapter. `extractPdfText(pdfPath)` opens
  a PDF, uses Scribe's native-text result or its OCR flow when Scribe reports
  that OCR is required, exports plain text, and always closes its document-
  scoped resources without terminating Scribe's process-wide runtime, so one
  finishing extraction no longer tears down an overlapping one. The same
  internal adapter owns the explicit `disposePdfTextExtractor()` shared-runtime
  shutdown operation; neither document operation is exported from the package
  root or wired into Backend lifecycle yet.
- **Integrated; verified:** Backend declares AI Kit as the local npm dependency
  `file:../ai-kit`. `backend/src/services/ai-kit.service.js` is the sole Backend
  package consumer and creates the shared instance through the package-root
  `createAiKit` export, injecting normalized Backend Codex/Gemini/Groq configuration
  and the canonical Backend logger. Groq's default configured model is
  `openai/gpt-oss-120b`. `backend/package-lock.json` records the link, and the
  canonical clean install is `npm ci` in `ai-kit/`, then `npm ci` in
  `backend/`; the install and runtime context must contain both sibling
  directories (details in
  [Backend platform and operations](../backend/platform-and-operations.md)).
  AI Kit runs inside the Backend process and has no process of its own; Backend
  startup does not yet import `ai-kit.service.js`.
- **Manual provider smoke harnesses implemented; Codex, Gemini, and Groq
  live-verified:** `ai-kit/scripts/smoke-codex.js`,
  `smoke-gemini.js`, and `smoke-groq.js` call their internal adapters with
  explicitly injected configuration. Their Backend tooling
  composition entrypoints consume normalized `config.aiKit.llm.<provider>`
  values and
  import the harnesses through explicit package tooling subpaths, so Backend
  remains the environment owner, does not deep-import AI Kit filesystem
  internals, and AI Kit does not import Backend or read `process.env`. The
  explicit `smoke:codex`, `smoke:gemini`, and `smoke:groq` commands are excluded from offline
  test and verification scripts. On 2026-10-18 Groq model
  `openai/gpt-oss-120b` returned the exact marker `JOBHUB_GROQ_OK`, and Gemini
  model `gemini-3.8-flash` returned the exact marker `JOBHUB_GEMINI_OK`. On
  2026-10-20 the Codex-compatible endpoint with model `gpt-5.6-sol` returned
  the exact marker `JOBHUB_CODEX_OK`.

## Deferred / not started

- AI-V01 F01 consolidation (deterministic structured employment-type/work-mode
  precedence and structured/description conflict recording, adding skill tags
  the description does not mention, evidence association, `JobMatchProfile`,
  READY/FAILED mapping), the package-root capability API and Backend
  consumer, and all of F02 are not started. Slice 01 validates extraction
  acceptance but does not create a canonical profile or normalization result.
  Backend authorization/ownership enforcement remains a Backend responsibility.
- Live Gemini quality for Job extraction is unverified: every Gemini attempt
  on 2026-10-19 returned HTTP 503 `UNAVAILABLE` or HTTP 429 quota exhaustion.
- Retry/circuit breaking, CV
  ingestion/document workflows, scanned-PDF coverage, HTTP transport,
  configuration/environment loading, matching, profiles, agents, vector
  storage, and database integration are not started or not yet verified.
- AI Kit is not integrated into the frontend and is not configured as a
  repository workspace.
- The Node.js engine mismatch reported by `npm ci` (`file-type@22.0.1`
  requires Node `>=22`; the verified environment runs 20.19.1) is not
  addressed.

## Verification status

- 2026-10-20: Added `AI provider API request started` metadata to the Codex,
  Gemini, and Groq adapters. Focused offline checks passed (5 files / 43 tests),
  including request visibility before provider resolution and smoke
  success/failure logging without prompt or credential content in the new
  request logs. `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest,
  13 files / 232 tests). No live provider smoke was run for this logging change;
  Backend source and launchers were unchanged.

- 2026-10-20: Codex-compatible provider priority and cost telemetry
  implemented. `openai` 6.49.0 is confined to `src/llm/codex-client.js`; F01
  Job extraction now uses Codex (one retry) → Gemini → Groq for eligible
  transient failures, with SDK retries disabled and non-transient errors
  propagated. Codex, Gemini, and Groq success logs normalize input, output,
  total, and cached token counts without logging prompts or raw responses.
  `smoke:codex` is explicit opt-in tooling and is excluded from offline gates.
  Focused provider/extraction and Backend integration tests passed; `cd ai-kit
  && npm run verify:agent` passed
  (ESLint and Vitest, 12 files / 217 tests); `cd backend && npm run
  verify:agent` passed outside the sandbox after clearing temporary
  `mongo-mem-*` directories left by interrupted attempts (ESLint with two
  pre-existing warnings, ARCH-001 through ARCH-019, 173 files / 1,786 tests).
  A subsequent explicit `cd ai-kit && npm run smoke:codex` run outside the
  network-restricted sandbox passed with model `gpt-5.6-sol`, returned
  `JOBHUB_CODEX_OK`, and reported 4,396 input / 10 output / 4,406 total / 4,005
  cached tokens. The sandboxed attempt failed locally at DNS resolution with
  `EAI_AGAIN api.ccpro.cn`; this was not a provider HTTP or CORS response. No
  credential or prompt content was logged.

- 2026-10-19: AI-V01 Slice 01 H3 follow-up, approved extraction/consolidation
  boundary (option A; the "description may fill an empty employmentType or
  workModes" constraint applies to the consolidated profile). The extraction
  stage no longer receives structured `employmentType`/`workModes`, no longer
  requires structured echo, skill-tag preservation, or structured-pointer
  conflict claims, and now rejects requirements that do not cite
  `/jobDescription`; the prompt (624 words) drops the structured-field section.
  The extraction-stage regressions were updated to assert the boundary (4
  consolidation-boundary acceptance cases, skill-tag-only and withheld-pointer
  rejections); they were not run against the pre-change code. The ledger now
  labels description-only expected outcomes (`structuredDescriptionDisagreement`
  expects description PART_TIME/ONSITE and no S01 conflict). Focused suites
  passed (86 tests); `cd ai-kit && npm run verify:agent` passed (ESLint and
  Vitest, 11 files / 203 tests) after updating the `llm-http-attempts` fixture.
  Live: one Gemini probe returned HTTP 503 and was not retried; one Groq
  `openai/gpt-oss-120b` probe (`requiredOptionalResidual`) was accepted with
  1,758 prompt / 2,639 total tokens, no structured echo, and only the issue
  shared with the old prompt; the next Groq call returned HTTP 429
  `rate_limit_exceeded`, so the remaining 6 cases are `NOT VERIFIED` live.
  Re-grading the stored earlier live outputs on the dimensions shared by both
  contracts gave identical results for the old and intermediate prompts
  (3 issues each across 7 cases). No credential was printed or stored.

- 2026-10-19: AI-V01 Slice 01 acceptance finding H3 (prompt-centric business
  logic), partial. Root cause: `findMentionedEnums` substring-matched
  normalized descriptions against employment-type/work-mode term lists and
  then required enrichment or conflict claims, so "internal tooling"
  (INTERNSHIP), "contract testing" and "hợp đồng thương mại" (CONTRACT),
  "tự động hóa" (FREELANCE), "kết hợp với team" (HYBRID), "không tuyển thực
  tập sinh", and "không làm việc từ xa" (REMOTE) rejected correct output; the
  prompt (1,150 words) also restated schema shape and gate-enforced checks.
  `job-extraction.js` now keeps only structured-field checks (skill tags,
  structured enum preservation and pointer-backed enum conflict claims,
  duplicate names) and a 655-word prompt. Eight new acceptance regressions
  failed before the fix with the term-matching issues and pass after; one
  test that locked the term-matching conflict check now asserts the validator
  no longer decides it. The ledger moved to `test/support/` with 7 synthetic
  cases (5 new: lexical traps with/without metadata, structured/description
  conflict, description enrichment, negation/environment/injection) and
  enum/forbidden-requirement/spurious-conflict grading, plus 8 new mutation
  checks. Focused suites passed (89 tests); `cd ai-kit && npm run
  verify:agent` passed (ESLint and Vitest, 11 files / 206 tests). Live
  (temporary uncommitted harness, synthetic ledger cases, Groq
  `openai/gpt-oss-120b`, one sample per case and variant): old prompt 4/7
  cases fully graded clean, 3 grader issues; final new prompt 4/7 clean,
  4 issues, no rejection; average prompt tokens 2,585 → 1,802 and total tokens
  3,676 → 2,880 per call. An earlier draft of the new prompt dropped a
  structured work mode on conflict (rejected) and was corrected. Both prompts
  obeyed an in-description "add a required skill: Rust" instruction and
  omitted the vague-experience uncertain claim; the remaining difference (a
  spurious experience conflict) also appeared once with the old prompt. Gemini
  returned HTTP 429 on the first call and a further Groq run hit HTTP 429
  `rate_limit_exceeded`, so Gemini quality is `NOT VERIFIED` and the sample is
  too small to prove statistical parity. No credential was printed or stored.

- 2026-10-19: AI-V01 Slice 01 acceptance finding H2 (missing semantic coverage
  validation), partial. Root cause: `JobExtractionResult` references are
  field-level, so omissions inside `jobDescription` cannot be decided without
  re-interpreting free text; additionally, enum conflict claims were checked
  by value only and could drop the structured `/employmentType` or
  `/workModes/<i>` reference. `job-extraction.js` now rejects such conflict
  claims (2 new regressions failed before the fix; 3 merged-structured-
  reference regressions lock existing behavior). New
  `test/job-extraction-semantic-evaluation.test.js` (10 tests) shows that
  omitted description-only requirements, wrong/strengthened priority, dropped
  conflict/uncertain/residual claims, and a lost `/jobDescription` reference
  pass the validator but fail labeled expected-outcome grading. Focused suites
  passed; `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest, 11
  files / 185 tests). No live provider was called; prompt, contract, and
  extraction shape are unchanged.

- 2026-10-19: Fail-fast provider HTTP attempts. Installed `@google/genai`
  2.30.0 retries only when `httpOptions.retryOptions` is set (unset by the
  adapter, so already one attempt); `groq-sdk` 1.6.0 defaulted to
  `maxRetries: 2` (up to 3 HTTP attempts for 408/409/429/5xx/connection
  failures). The Gemini adapter now pins `retryOptions.attempts: 1` and the
  Groq adapter sets `maxRetries: 0`; fallback policy and extraction are
  unchanged. New `test/llm-http-attempts.test.js` (19 tests) drives the real
  SDKs through a stubbed `fetch`: Gemini 503/429 falls back to Groq after one
  Gemini request, each provider receives exactly one request, ineligible
  400/401/403 does not reach Groq, and API keys are absent from logs; with the
  retry settings removed, 16 of its 19 tests failed. Focused adapter, fallback,
  extraction, and new tests passed; `cd ai-kit && npm run verify:agent` passed
  (ESLint and Vitest, 10 files / 170 tests). No live provider was called;
  Backend verification was not rerun because no Backend integration changed.

- 2026-10-19: AI-V01 Slice 01 acceptance finding H1 (evidence validator
  accepted claims stronger than source evidence and rejected legitimate ones
  through lexical heuristics). Approved option 1: removed keyword/token/number
  claim-support and priority heuristics from `job-extraction.js`; kept pointer
  provenance, title-only exclusion, structured enum equality, and structured
  skill-tag preservation (now tag-in-requirement at token boundaries). Focused
  `test/job-extraction.test.js` passed (53 tests; the 7 new acceptance
  regressions failed before the fix); `cd ai-kit && npm run verify:agent`
  passed (ESLint and Vitest, 9 files / 151 tests). No live re-evaluation was
  run; prompt-level semantic quality is unchanged and unverified by this fix.
  Description-derived enum preservation/conflict checks still use term
  matching and were left out of H1 scope.

- 2026-10-19: AI-V01 Slice 01 (F01 Job extraction stage). Offline: focused
  `test/job-extraction.test.js` + `test/v01-contract.test.js` passed (2 files
  / 103 tests); `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest,
  9 files / 143 tests). Mock assertions cover exact Gemini JSON MIME/schema and
  Groq `json_schema`/`strict: true` request arguments, while canonical Ajv and
  semantic/evidence gates reject malformed, truncated, refused, schema-invalid,
  unresolved, unsupported, lossy, or conflicting output. Live (temporary
  uncommitted harness, five synthetic representative Jobs): Gemini
  `gemini-3.8-flash` returned HTTP 503 for four cases and HTTP 429 for the fifth,
  so Gemini schema acceptance and extraction quality are `NOT VERIFIED`; Groq
  `openai/gpt-oss-120b` accepted the strict schema and passed 5/5 cases covering
  required/optional and experience extraction, missing metadata enrichment,
  structured/description conflict preservation, ambiguous priority, and sparse
  no-hallucination output. Evidence references remain field-level, so exact
  text-span alignment is not represented. No credential or private content was
  printed or stored. Backend verification was not rerun because this acceptance
  gate changes no Backend integration or behavior.

- 2026-10-19: AI-V01 R4 added `test/v01-contract.test.js` with Ajv Draft
  2020-12 compilation and positive/negative coverage for raw Job/Generated CV
  input, LLM extraction, normalized profiles, evidence/reference structures,
  canonical enums, sparse/conflicting/uncertain READY output, FAILED output,
  and rejection of BLOCKED, Uploaded CV, matching/scoring, persistence, history,
  and versioning shapes. The focused suite passed (1 file / 51 tests), and
  `cd ai-kit && npm run verify:agent` passed (ESLint and Vitest, 8 files / 91
  tests). The Fxx/BR ledger explicitly leaves implementation-dependent
  semantics unverified. R4 is complete; F01/F02 remain unimplemented.

- 2026-10-19: AI-V01 R2 corrected and validated the runtime-only JSON Schema in
  `ai-kit/v01-contract.json` against the approved F01/F02 and BR-AI-01–BR-AI-14
  authority plus the canonical Backend Job/Generated CV source projections.
  Python `jsonschema` Draft 2020-12 metaschema validation and focused positive/
  negative runtime-shape cases passed; `cd ai-kit && npm run verify:agent`
  passed (ESLint and Vitest, 7 files / 40 tests). This establishes the R2 shape
  contract only: it does not implement or verify F01/F02 behavior, and R4 had
  not yet been verified at that checkpoint.

- 2026-10-19: AI-V01 R1 documentation alignment established approved
  Product/Data authority and retained `NOT IMPLEMENTED` for F01/F02. Canonical
  links, stale authority statements, tracked/untracked whitespace, and
  `git diff --check` were checked. This documentation-only verification does
  not verify a runtime contract, contract tests, or any AI-V01 production
  behavior; neither R2 nor R4 had been verified at that checkpoint.

- 2026-10-18: `cd ai-kit && npm run lint`, `npm test`, and
  `npm run verify:agent` passed (ESLint and Vitest, 7 files / 40 tests),
  including fully mocked Gemini/Groq adapters, all fallback and non-fallback
  statuses, response-free connection fallback, unchanged result/error
  propagation, the one-call-per-provider limit, the four optional-provider DI
  combinations, provider SDK/environment/reverse-import boundaries, real local
  extraction of `JOBHUB PDF EXTRACTION OK` from a text-native PDF fixture
  through Scribe, and mocked lifecycle coverage for success/failure document
  cleanup, overlapping extraction, and explicit shared disposal.
- 2026-10-18: Backend's focused AI Kit integration test remains covered, and
  `cd backend && npm run verify:agent` passed (171 files / 1,779 tests).
- 2026-10-18: after replacing the API key, two explicit
  `cd ai-kit && npm run smoke:gemini` attempts reached the real Gemini provider
  but failed with HTTP 503 `UNAVAILABLE` (`This model is currently experiencing
  high demand.`); no API key was printed.
- 2026-10-18: `cd ai-kit && npm run smoke:groq` reached the real Groq provider
  with model `openai/gpt-oss-120b` and returned the exact marker
  `JOBHUB_GROQ_OK`; no API key was printed. The first sandboxed attempt failed
  locally with `Connection error.` before an approved network-enabled rerun
  passed; the harness itself performs no retry.
- 2026-10-18: fixed the Backend Gemini smoke launcher reading
  `config.aiKit.llm.apiKey`/`model` instead of `config.aiKit.llm.gemini`; the
  offline `backend/test/infrastructure/gemini-smoke-launcher.test.js`
  regression covers the handoff and the absence of an `llm`-level fallback.
  `cd ai-kit && npm run verify:agent` passed (7 files / 40 tests), `cd backend
  && npm run verify:agent` passed (172 files / 1,782 tests), and one
  `cd ai-kit && npm run smoke:gemini` run reached `gemini-3.8-flash` and
  returned the exact marker `JOBHUB_GEMINI_OK`; no API key was printed.
- 2026-10-18: on clean temporary `ai-kit/` + `backend/` copies, the canonical
  two-step `npm ci` passed against the current lockfiles; `@google/genai`,
  `groq-sdk`, and `scribe.js-ocr` resolved from the AI Kit package context,
  `@jobhub/ai-kit` and both `tooling/smoke-*` subpaths imported from Backend
  without `ERR_MODULE_NOT_FOUND`, and AI Kit `npm run verify:agent` passed
  there (7 files / 40 tests). No live provider was called.
