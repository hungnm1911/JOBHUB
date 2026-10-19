# AI Kit Foundation

## Current project state

- **Readiness:** AI Kit technical foundation: ready. AI-V01 Product
  Specification and Data Contract: approved. AI-V01 F01/F02: not implemented
  and not verified. AI-V01 R2 Runtime Shape Contract correction/validation and
  R4 contract-test coverage are complete, so AI-V01 is `READY FOR
  IMPLEMENTATION`. This readiness does not claim that F01/F02 behavior exists.
  AI-V02 and AI-V03 are not approved by the current roadmap.
- **Implemented; verified:** `ai-kit/` is the private `@jobhub/ai-kit` npm
  package using Node.js ES modules. Its package root is the only production
  source entrypoint and exports the minimal `createAiKit` composition factory;
  explicit `tooling/smoke-gemini` and `tooling/smoke-groq` subpaths expose only
  the manual smoke harnesses. The
  factory accepts separate optional `llm.gemini` and `llm.groq` configuration
  plus a required injected logger contract, validates their boundary shapes,
  and still exposes no AI capability. The internal Gemini provider foundation
  uses `@google/genai` 2.30.0 through one provider-specific adapter; the
  internal Groq provider foundation uses `groq-sdk` 1.6.0 through a separate
  provider-specific adapter that owns SDK construction and
  `chat.completions.create` delegation. The internal
  `executeWithLlmFallback` orchestrator accepts provider call functions without
  unifying either adapter contract, preserves successful provider results, and
  performs at most one fallback attempt for HTTP 429/500/502/503/504 or a
  structured response-free connection/timeout failure. Neither adapter nor the
  fallback orchestrator is composed until a real package capability needs it,
  so startup remains valid with neither, either, or both provider
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
  `createAiKit` export, injecting normalized Backend Gemini/Groq configuration
  and the canonical Backend logger. Groq's default configured model is
  `openai/gpt-oss-120b`. `backend/package-lock.json` records the link, and the
  canonical clean install is `npm ci` in `ai-kit/`, then `npm ci` in
  `backend/`; the install and runtime context must contain both sibling
  directories (details in
  [Backend platform and operations](../backend/platform-and-operations.md)).
  AI Kit runs inside the Backend process and has no process of its own; Backend
  startup does not yet import `ai-kit.service.js`.
- **Manual provider smoke harnesses implemented; Gemini and Groq live-verified:**
  `ai-kit/scripts/smoke-gemini.js` and `smoke-groq.js` call their internal
  adapters with explicitly injected configuration. Their Backend tooling
  composition entrypoints consume normalized `config.aiKit.llm.<provider>`
  values and
  import the harnesses through explicit package tooling subpaths, so Backend
  remains the environment owner, does not deep-import AI Kit filesystem
  internals, and AI Kit does not import Backend or read `process.env`. The
  explicit `smoke:gemini` and `smoke:groq` commands are excluded from offline
  test and verification scripts. On 2026-10-18 Groq model
  `openai/gpt-oss-120b` returned the exact marker `JOBHUB_GROQ_OK`, and Gemini
  model `gemini-3.8-flash` returned the exact marker `JOBHUB_GEMINI_OK`.

## Deferred / not started

- AI-V01 F01/F02 normalization implementation has not started. Evidence
  resolution, consolidation, structured-metadata precedence,
  REQUIRED-over-OPTIONAL, hallucination prevention, and Backend authorization/
  ownership enforcement remain runtime responsibilities; R4 records them as
  deferred rather than claiming they are verified.
- Wiring Gemini-to-Groq fallback into a provider-backed package capability,
  retry/circuit breaking, CV
  ingestion/document workflows, scanned-PDF coverage, HTTP transport,
  configuration/environment loading, matching, profiles, agents, vector
  storage, and database integration are not started or not yet verified.
- AI Kit is not integrated into the frontend and is not configured as a
  repository workspace.
- The Node.js engine mismatch reported by `npm ci` (`file-type@22.0.1`
  requires Node `>=22`; the verified environment runs 20.19.1) is not
  addressed.

## Verification status

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
