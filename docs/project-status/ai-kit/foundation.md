# AI Kit Foundation

## Current project state

- **Readiness:** The AI Kit technical foundation is ready. This leaf tracks the
  shared package, provider, document extraction, and Backend integration state.
  See the [AI-V01 status](v01-job-cv-normalization.md) for F01/F02, Backend
  B1/B2, and Final Acceptance evidence.

- **Implemented; verified:** `ai-kit/` is the private `@jobhub/ai-kit` npm
  package using Node.js ES modules. Its package root is the only production
  source entrypoint and exports the minimal `createAiKit` composition factory;
  explicit `tooling/smoke-codex`, `tooling/smoke-gemini`, and
  `tooling/smoke-groq` subpaths expose only the manual smoke harnesses. The
  factory accepts separate optional `llm.codex`, `llm.gemini`, and `llm.groq` configuration
  plus a required injected logger contract, validates their boundary shapes,
  and exposes the runtime members tracked in the relevant version leaf. The
  internal Codex-compatible provider foundation uses `openai` 6.49.0 and the
  Responses API through one provider-specific adapter. The internal Gemini
  provider foundation uses `@google/genai` 2.30.0 through one
  provider-specific adapter; the
  internal Groq provider foundation uses `groq-sdk` 1.6.0 through a separate
  provider-specific adapter that owns SDK construction and
  `chat.completions.create` delegation. The internal
  `executeWithLlmProviderChain` orchestrator accepts provider call functions
  without unifying their adapter contracts, preserves successful provider
  results, and allows retry/fallback only for HTTP 429/500/502/503/504 or a
  structured response-free connection/timeout failure. All adapters
  disable SDK-level automatic retries. Each adapter logs the provider, model,
  and SDK operation before sending a request, including smoke calls and each
  retry/fallback attempt. Successful provider calls log normalized
  `input_tokens`, `output_tokens`, `total_tokens`, and `cached_tokens` without
  prompt or response content. No capability
  currently composes the adapters or the fallback orchestrator, and
  `createAiKit` does not construct them, so startup remains valid with any
  provider combination configurations. ESLint and Vitest remain aligned with the backend tooling,
  with a package-local `verify:agent` gate and explicit no-`process.env` and
  provider-SDK-import source boundaries.

- **Document extraction foundation implemented:** AI Kit locks `pdfjs-dist`
  5.6.205 and confines its import to the internal
  `src/document/pdf-text-extractor.js` adapter. `extractPdfText(pdfPath)` extracts
  existing text layers in page order, cleans pages, and destroys its loading
  task/worker per call. Image-only PDFs return empty text; there is no OCR or
  shared-runtime disposal operation. The extractor is not exported from the
  package root or integrated with Uploaded CV normalization. Historical Scribe
  evidence below does not verify this PDF.js implementation.

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

- PDF extraction does not perform OCR or Uploaded CV ingestion. Additional
  retry/circuit-breaking policy beyond the bounded provider chain is deferred.
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
