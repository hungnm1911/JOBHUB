# Backend Platform and Operations Project Status

## Current project state

Error handling and development logging are standardized across both
applications.

**Backend:**
- `src/utils/logger.js` is the single dependency-free application logger.
  - Its level comes from `LOG_LEVEL` through `config.logging`: `debug` in
    development and `info` elsewhere.
  - Output is pretty and colorized outside production and JSON lines in
    production.
  - It prints error stacks, own properties, and `cause` chains.
- `src/middlewares/request-logger.js` runs first in `app.js`. It assigns a
  request id, returns it in a CORS-exposed `X-Request-Id` header, and logs one
  query-free access line per request.
- The final error handler logs 5xx at `error` and rejected 4xx at `debug`, with
  request id, method, and path.
- The error handler now maps body-parser http-errors marked `expose` to their
  4xx status. Previously, malformed JSON and oversized bodies returned `500`.
- `AppError` accepts an optional `{ cause }`.
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
- Latest backend gate (2026-10-21): `VITEST_MAX_WORKERS=2 npm run verify:agent` passed: 178 files / 1,823 tests, ARCH-001–ARCH-019, ESLint 0 errors / 2 pre-existing warnings. The AI Kit integration suite is included. Details and earlier failed attempts are in Verification status below.
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

- 2026-10-21 V1–V4 API completion final gate passed with `VITEST_MAX_WORKERS=2 npm run verify:agent`: ESLint 0 errors / 2 pre-existing V6 test warnings; ARCH-001–ARCH-019; 178/178 files and 1,823/1,823 tests. Worker concurrency was limited to two; no tests were excluded and timeout values were unchanged. Focused completion run passed 5 files / 39 tests; the two affected suites passed again after regex-helper reuse (16/16). Diff and new-file whitespace checks passed.
- Verification history for this completion: the first gate failed because the declared `@jobhub/ai-kit` workspace dependency was not installed and one old test excluded Company Manager self forgot-password. That expectation was updated for the approved V1 extension and passed in focused tests. After explicit user approval, `npm ci` succeeded in ai-kit and backend using existing lockfiles; manifests/lockfiles and AI Kit source stayed unchanged. The next default-worker gate passed 177/178 files and 1,822/1,823 tests, with one unrelated V15 concurrency test timing out at 30 seconds. Its entire suite passed alone (33/33), followed by the clean two-worker common gate above. No V5–V17 source or rules were changed.
- Dependency restoration audit output: AI Kit reported 0 vulnerabilities; backend reported 16 (4 moderate, 11 high, 1 critical) in its existing locked dependency graph. No audit fix or dependency version upgrade was performed as part of this scoped completion.

- Deterministic architecture verification exists, and the official backend verification command is `cd backend && npm run verify:agent`.

- `npm run verify:agent` consists of ESLint, deterministic architecture verification, and Vitest.

- Frontend verification has its own gate (`cd frontend && yarn verify:agent`); see the frontend status leaf. It is not covered by the backend gate.

- Backend startup, Cloudinary connectivity/operations, and live SMTP delivery are outside the backend `verify:agent` and were not run, so their behavior is not verified by this snapshot.
