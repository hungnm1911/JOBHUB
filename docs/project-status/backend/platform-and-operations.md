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
- About 30 silent best-effort `catch {}` blocks remain in business services
  (application, job, job-invitation, candidate-cv, recruiter, platform-admin,
  company). Some `AppError(502)` conversions there still drop the original
  error. These are documented for migration when those modules are next
  changed.

**Verification:**
- Backend `npm run verify:agent` passed: lint with 2 pre-existing test
  warnings, ARCH-001–ARCH-018, and 169 files / 1,749 tests, including the new
  `test/http/error-logging.test.js`.
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

- Deterministic architecture verification exists, and the official backend verification command is `cd backend && npm run verify:agent`.

- `npm run verify:agent` consists of ESLint, deterministic architecture verification, and Vitest.

- Frontend verification has its own gate (`cd frontend && yarn verify:agent`); see the frontend status leaf. It is not covered by the backend gate.

- Backend startup, Cloudinary connectivity/operations, and live SMTP delivery are outside the backend `verify:agent` and were not run, so their behavior is not verified by this snapshot.
