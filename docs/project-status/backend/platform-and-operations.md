# Backend Platform and Operations Project Status

## Current project state

2026-11-26: the safe stack-location parser now supports paths with spaces, Unicode and parentheses while retaining private-message/function-label/query-frame exclusions. Recruiter Inbox and list-read follow-up passed the common Backend gate; no schema, dependency, Calendar API or Supporting Invitation authority change was introduced.

Error handling and runtime request logging are standardized across Backend
and its injected AI Kit logger.

**Backend:**
- `src/utils/logger.js` is the single dependency-free application logger.
  - Its level comes from `LOG_LEVEL` through `config.logging`: `debug` in
    development and `info` elsewhere.
  - Timestamps use `LOG_TIME_ZONE` (default `Asia/Bangkok`) and display as
    `YYYY-MM-DD HH:mm:ss` in pretty and JSON output.
  - Output is pretty and colorized outside production and JSON lines in
    production.
  - It prints error stacks, own properties, and `cause` chains.
- `src/middlewares/request-logger.js` runs first in `app.js`. It assigns a
  request id, returns it in a CORS-exposed `X-Request-Id` header, and logs one
  query-free structured access record for every completed (`info`) or aborted
  (`warn`) request, including method, status, duration, and abort flag. The canonical
  logger carries the id through concurrent asynchronous Backend/AI Kit work.
  Development also logs emitted JSON/text response bodies, response-producer
  call sites, and distinct logger call sites. Express-generated conditional 304
  logs retain the prepared representation and its original status while showing
  that the actual response had no body. Aborted requests include any existing
  route diagnostic checkpoint and record
  later response attempts separately.
- The final error handler logs 5xx at `error` and rejected 4xx at `warn`, with
  request id, actual HTTP status, safe error type/code/upstream status, and
  bounded throw-site locations from the exception and its causes. Development
  also logs the complete exception and cause stack; production keeps normalized
  metadata only.
- The error handler now maps body-parser http-errors marked `expose` to their
  4xx status. Previously, malformed JSON and oversized bodies returned `500`.
- `AppError` accepts an optional `{ cause }`.
- The shared HTTP integration-test agent connects using its Supertest
  listener's address family. On this macOS host, an IPv6 wildcard listener
  could share a port with an unrelated IPv4 loopback service, causing random
  non-JOBHUB responses when Supertest connected to `127.0.0.1`. The harness
  now targets `::1` for IPv6 listeners and retains IPv4 for IPv4 listeners.
- Bootstrap, MongoDB, Cloudinary, workers, realtime fan-out, and Notification
  recovery log through the logger. The previously silent fan-out and
  recovery-item failures are logged at `warn`.
- `src/services/ai-kit.service.js` is the sole Backend integration owner for
  the local `@jobhub/ai-kit` package. It injects optional normalized
  `config.aiKit.llm` values and the canonical Backend logger while creating the
  shared instance through the package-root public API. ARCH-019 rejects imports
  from other Backend source modules and rejects AI Kit deep imports.
- Canonical install is `npm ci` in `ai-kit/`, then `npm ci` in `backend/`;
  only Backend runs a process. `file:../ai-kit` installs as a symlink, so the
  install and runtime context must contain the sibling `ai-kit/` and
  `backend/` directories. Backend-only `npm ci` succeeds without installing AI
  Kit dependencies (and with a dangling link when `ai-kit/` is absent), and
  `npm ls @jobhub/ai-kit --depth=0` does not detect either case.
- About 30 silent best-effort `catch {}` blocks remain in business services
  (application, job, job-invitation, candidate-cv, recruiter, platform-admin,
  company). Some `AppError(502)` conversions there still drop the original
  error. These are documented for migration when those modules are next
  changed.

**Verification:**
- Latest backend gate (2026-11-26 Recruiter Inbox/list/logging follow-up): `npm run verify:agent` passed 218 files / 2,259 tests, ARCH-001–ARCH-019, ESLint 0 errors / 2 existing warnings. The prior spaced-path logging failure is fixed and regression-covered.
- 2026-10-18 clean-install check on temporary `ai-kit/` + `backend/` copies
  without `node_modules`/`.env` (Node 20.19.1, npm 10.8.2): after the
  canonical two-step install, `npm ls @jobhub/ai-kit --depth=0` passed,
  `@google/genai`, `groq-sdk`, and `scribe.js-ocr` resolved and imported from
  the AI Kit package context, `@jobhub/ai-kit` and both
  `@jobhub/ai-kit/tooling/smoke-*` subpaths imported from Backend, and AI Kit
  `npm run verify:agent` passed (7 files / 40 tests). Backend-only `npm ci`
  reproduced `ERR_MODULE_NOT_FOUND` for both tooling subpaths. Backend
  `npm run verify:agent` then passed (ARCH-001–ARCH-019, 172 files / 1,782
  tests). Backend startup does not yet import `ai-kit.service.js`.
- A browser-to-terminal smoke check ran the real Express `app` without
  MongoDB. It confirmed matching request ids for a 404, a malformed-JSON 400,
  and a network failure.

## Known issues / known mismatches


- Several configuration values are both required and given unreachable defaults.
- Model and middleware barrels are empty or disconnected; seed files are placeholders.
- File-controller error formatting overlaps the centralized error handler, while request/input and business validation ownership also overlaps.
- Human decisions remain open around barrel usage, error-format boundaries, required-versus-defaulted configuration, request validation placement, and seed ownership.

## Operational provisioning

- **Provisioned and login-verified:** The single platform-configured administrator account is present in MongoDB Atlas as one `PLATFORM_ADMIN`, with `ACTIVE` status, a verified email, `mustChangePassword=false`, and a bcrypt password hash. Its previous sessions and temporary authentication tokens were revoked during provisioning; a live login verification succeeded and the verification session was removed. The account identifier and secrets are intentionally not recorded in repository documentation.

## Previously completed and verified baseline

- **Implemented; lint-verified:** the Node.js ES-module backend project foundation, package scripts, Express application bootstrap, `/api` root router, hello-world endpoint, application middleware composition, and process startup/shutdown orchestration exist. The current backend source passes the configured ESLint command.
- **Implemented; verified:** application-wide CORS uses an exact frontend-origin whitelist normalized by `backend/src/config/index.js` from comma-separated `CORS_ALLOWED_ORIGINS` (default `http://localhost:5173`) and composed by `backend/src/app.js`; configured browser origins and bearer-token preflights are allowed, origins outside the whitelist are rejected, and requests without `Origin` remain available to non-browser clients. Focused coverage in `test/http/cors.test.js` (5 tests); the official backend gate passed 167 files / 1,735 tests.
- **Implemented; verified:** the Socket.IO server in `backend/src/sockets/realtime-server.socket.js` reuses the same `config.cors.allowedOrigins` whitelist: polling responses and preflights carry CORS headers for configured origins, and an `allowRequest` origin check rejects handshakes from other browser origins on every transport (including WebSocket), while handshakes without `Origin` remain available to non-browser clients. Focused coverage in `test/http/realtime-cors.test.js` (7 tests); the official backend gate passed 168 files / 1,742 tests.
- **Implemented; test-verified for registration:** MongoDB connection/disconnection infrastructure and startup integration exist. The candidate registration request path uses MongoDB through `auth.service.js` to persist `User` and `AuthToken` records.
- **Implemented; not runtime-verified in this snapshot:** Cloudinary client configuration, startup connection verification, file upload/delete service operations, and non-production test endpoints exist.
- **Implemented; test-verified for registration (mail mocked in automated tests):** Nodemailer transport configuration and the canonical mail-sending service exist. The candidate registration request path invokes `mail.service.js`.
- **Implemented; lint-verified:** centralized unmatched-route and final error middleware exist and are registered after application routes. Some expected file errors still bypass the centralized formatter, as noted below.
- **Normalized; lint-verified:** V1/V2 authentication-token types have one canonical owner at `backend/src/constants/auth-token-type.js`, containing `EMAIL_VERIFICATION`, `PASSWORD_RESET`, and `COMPANY_APPROVAL_CONFIRMATION`; unused invite-token helpers and the competing token-type owner have been removed.
- **Normalized; lint-verified:** `backend/src/config/index.js` is the sole dotenv loader and the sole direct `process.env` reader; the root entry point and other configuration modules consume normalized configuration.
- **Implemented; verified:** `backend/scripts/verify-architecture.js` provides dependency-free deterministic checks for the initial approved backend architecture invariants and passes against the current backend source.
- **Documented only:** backend architecture, conventions, canonical responsibility owners, and known technical mismatches are defined under `docs/engineering/`.
- **Documented only:** repository-level and backend-specific agent contracts exist.

## Verification status

- 2026-11-26 follow-up: `cd backend && npm run verify:agent` passed **218 files / 2,259 tests**, **ARCH-001–ARCH-019**, ESLint **0 errors / 2 existing warnings**. No tests were excluded or timeouts changed. The first attempt was stopped after a MongoMemoryServer random-port collision prevented V15 Slice 08 startup; the full retry above passed all tests. Logging regression evidence: existing failures plus a synthetic spaced/Unicode/parenthesized-path privacy test failed **6 tests** before the regex fix, then `npm test -- test/http/error-logging.test.js test/http/production-error-logging.test.js` passed **2 files / 16 tests**. Final focused `npm test -- test/job/recruiter-fe-api-completion.test.js test/application/v11-conversation-history-read.test.js test/http/production-error-logging.test.js` passed **3 files / 30 tests**. Inbox tests cover frozen Company read-only history, Manager/non-assignee denial, Unassign revocation and message pagination; list regressions preserve scope/eligibility/full workload and unread totals. Gate ran on the working tree including the unchanged pre-existing V15 test delta; that delta remains outside the follow-up commit. Earlier failed gate evidence below is retained as history and is superseded by this successful run. No live-provider, production query-plan/load, browser or Frontend verification is claimed; metadata-only in-memory selection remains explicitly documented in the [API contract](../../engineering/recruiter-api-contract.md).

- 2026-11-26 Recruiter FE API completion: `cd backend && npm run verify:agent` was executed with default logging and no excluded tests or changed timeouts. ESLint passed with 0 errors / 2 existing V6 warnings; ARCH-001–ARCH-019 passed. Vitest returned 216 passed / 2 failed files and 2,252 passed / 5 failed tests (218 files / 2,257 tests total). All failures are stack-location assertions in `test/http/error-logging.test.js` (3) and `test/http/production-error-logging.test.js` (2). Unmodified HEAD `d7a81da` in a separate checkout with spaces reproduced the exact 5 failures / 10 passes; moving the same checkout to a path without spaces passed both files / all 15 tests. No logging source or tests were changed. Therefore the common gate is recorded as failed, not accepted. Final focused command `npm test -- test/job/recruiter-fe-api-completion.test.js test/job/v6-recruiter-job-scopes.test.js test/job/v6-recruitment-team-read.test.js` passed 3 files / 78 tests on the final working tree. The gate includes a pre-existing uncommitted V15 test change that remains outside this feature commit. An earlier reduced-log run was stopped after the migration CLI stdout assertion failed because logging was suppressed; it is not acceptance evidence. No Atlas, SMTP, Cloudinary, browser/E2E or load check was performed. New read projections may paginate in memory as documented in the [API contract](../../engineering/recruiter-api-contract.md).

- 2026-11-23 readable timestamps: the two focused logging suites failed before
  the format change and passed afterward (**2 files / 12 tests**), covering
  pretty output, JSON output, and local-date rollover. Scoped ESLint and
  `git diff --check` passed. The full Backend gate was not rerun per user request.

- 2026-11-23 logging time zone: focused development and production logging
  suites reproduced the UTC-only timestamp before the fix and passed after it
  (**2 files / 12 tests**), including a local-date rollover check. Backend
  ESLint passed with 2 pre-existing V6 test warnings, ARCH-001–ARCH-019 passed,
  and `git diff --check` passed. The full Backend test run was stopped at user
  request; the full `verify:agent` gate was not completed.

- 2026-11-22 conditional-response trace: a focused Express ETag regression
  reproduced a `200` representation converted into `304` by `If-None-Match`.
  Before the fix, the development log showed only the logger's own source and
  `body: null`. After the fix, it records the response producer, original
  representation status/body, and the actual 304 with no body. The focused
  development suite passed **1 file / 6 tests**; all affected Backend logging
  and integration suites passed **5 files / 22 tests**. Scoped ESLint and diff
  whitespace checks passed. The full backend gate was not run for this
  follow-up, per user request.

- 2026-11-22 development diagnostics: the user-supplied recommendation log
  showed a client disconnect after about 60 seconds during a second Codex
  request, before a Backend exception or HTTP response. Code inspection found
  the frontend recommendation call uses a 60,000 ms Axios timeout; this is a
  likely explanation for that disconnect, not proof of the provider's eventual
  outcome. Before the fix, new development HTTP tests failed for missing
  response bodies, full error stacks, and abort checkpoints; provider-adapter
  tests failed for missing response/exception records. After the fix, focused
  Backend suites passed **5 files / 21 tests** and focused AI Kit provider
  suites passed **4 files / 33 tests**. The full backend gate and live provider
  behavior were not verified for this development-logging extension.

- 2026-11-22 logging regression: before the fix, focused HTTP tests failed on
  invisible `debug` access logs, a `null`/upstream-only HTTP status, and missing
  4xx throw-site logs; the asynchronous AI Kit request-id test also failed with
  two missing ids. After the fix, focused Backend suites passed **4 files / 15
  tests** (`test/http/error-logging.test.js`,
  `test/http/production-error-logging.test.js`,
  `test/services/ai-kit-logging-boundary.test.js`,
  `test/infrastructure/ai-kit-integration.test.js`); focused AI Kit provider
  suites passed **4 files / 33 tests** (Codex, Gemini, Groq, HTTP attempts).
  Focused ESLint on the five changed Backend source/test files passed, as did
  diff and new-file whitespace checks. Full Backend ESLint (0 errors / 2
  pre-existing V6 test warnings) and ARCH-001–ARCH-019 passed before the final
  request-context edit. The full Vitest run was stopped at user request; this
  change has no completed full backend gate or live provider verification.

- 2026-11-13 HTTP test transport fix: a probe reproduced a foreign-service
  `401` without JOBHUB's request-id header while the pending Job still existed;
  binding the observed port confirmed an IPv6 test listener and an unrelated
  IPv4 VS Code listener could coexist. The new transport regression failed
  before the fix (`IPv4` connection versus `IPv6` listener), then passed.
  `cd backend && npm test -- test/http/test-agent-transport.test.js test/job/v5-job-edit-draft.test.js test/job/v5-job-submit-draft.test.js test/job/v6-recruiter-job-scopes.test.js test/catalog/v41-location-catalog.test.js`
  passed **5 files / 89 tests**. A post-fix isolated MongoDB/HTTP probe performed
  **2,000 consecutive PENDING_APPROVAL PATCH requests**, all `409` with matching
  request ids and unchanged content/status. `cd backend && npm run verify:agent`
  passed **209 files / 2,182 tests**, **ARCH-001–ARCH-019**, and ESLint with
  **0 errors / 2 pre-existing warnings**. No Job business rule changed.

- 2026-10-21 V1–V4 API completion final gate passed with `VITEST_MAX_WORKERS=2 npm run verify:agent`: ESLint 0 errors / 2 pre-existing V6 test warnings; ARCH-001–ARCH-019; 178/178 files and 1,823/1,823 tests. Worker concurrency was limited to two; no tests were excluded and timeout values were unchanged. Focused completion run passed 5 files / 39 tests; the two affected suites passed again after regex-helper reuse (16/16). Diff and new-file whitespace checks passed.
- Verification history for this completion: the first gate failed because the declared `@jobhub/ai-kit` workspace dependency was not installed and one old test excluded Company Manager self forgot-password. That expectation was updated for the approved V1 extension and passed in focused tests. After explicit user approval, `npm ci` succeeded in ai-kit and backend using existing lockfiles; manifests/lockfiles and AI Kit source stayed unchanged. The next default-worker gate passed 177/178 files and 1,822/1,823 tests, with one unrelated V15 concurrency test timing out at 30 seconds. Its entire suite passed alone (33/33), followed by the clean two-worker common gate above. No V5–V17 source or rules were changed.
- Dependency restoration audit output: AI Kit reported 0 vulnerabilities; backend reported 16 (4 moderate, 11 high, 1 critical) in its existing locked dependency graph. No audit fix or dependency version upgrade was performed as part of this scoped completion.

- Deterministic architecture verification exists, and the official backend verification command is `cd backend && npm run verify:agent`.

- `npm run verify:agent` consists of ESLint, deterministic architecture verification, and Vitest.

- Frontend verification has its own gate (`cd frontend && yarn verify:agent`); see the frontend status leaf. It is not covered by the backend gate.

- Backend startup, Cloudinary connectivity/operations, and live SMTP delivery are outside the backend `verify:agent` and were not run, so their behavior is not verified by this snapshot.
