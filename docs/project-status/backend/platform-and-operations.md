# Backend Platform and Operations Project Status

## Current project state

2026-11-28: the Company Manager DRAFT Application-list disclosure is fixed by
reusing canonical V5 Job visibility. The common Backend gate passes 221 files /
2,277 tests; scoped behavior is recorded in [V10](v10-application-assignment-recruitment-pipeline.md).
The shared Company profile async fixes and separate Frontend gate limitation are
recorded in [Company Manager workspace](../frontend/company-manager-workspace.md).

2026-11-28: a separate Company Manager manual-QA tenant was provisioned in the
configured development `jobhub` database. It has one active Manager, 36 Recruiters,
48 Jobs and 261 Applications, with three instances per fixture group. Real HTTP
login/read verification passed; no Backend runtime or business rule changed.

2026-11-27: Company Manager forced-transfer preview passed the common Backend
gate. Scoped read integration is recorded in [V6](v6-recruitment-team-responsibility-transfer.md);
Frontend screens and their separate gate limitation are recorded in
[Company Manager workspace](../frontend/company-manager-workspace.md). No schema,
dependency or lifecycle change was introduced.

2026-11-27: the Recruiter public Discovery extension passed the common Backend gate. Scoped behavior is recorded in [V8 status](v8-job-discovery.md); the Recruiter website and Frontend limitations are recorded in [Recruiter home](../frontend/recruiter-home.md). No schema, dependency or lifecycle change was introduced.

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
- Cloudinary upload folders now use the required `CLOUDINARY_ROOT_FOLDER` from
  normalized Backend configuration. The local development root is `jobhub`;
  production local configuration uses `jobhub-production`. This separates
  Media Library locations while retaining the same Cloudinary credentials.
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
- 2026-11-28 Cloudinary folder configuration: three focused test files passed
  (10 tests), changed-file ESLint and ARCH-001–ARCH-019 passed, and
  `git diff --check` passed. The full Backend gate was intentionally skipped
  at the user's request; no live Cloudinary operation was performed.
- Latest backend gate (2026-11-28 CM correctness fixes): `npm run verify:agent` passed 221 files / 2,277 tests, ARCH-001–ARCH-019, ESLint 0 errors / 2 existing warnings.
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

- **Frontend deployed on Vercel 2026-11-28; Backend not deployed:** the
  Frontend is reported deployed at `https://jobhub-vn.vercel.app/` using
  `frontend/vercel.json` (Vite, frozen-lockfile install, `dist`, SPA rewrite,
  builds only for `main`). Its `VITE_*` values are placeholders because no
  Render Backend exists yet, so API and Socket.IO flows are not functional there.
  An HTTP check confirmed `/` and a deep path return `200 text/html` and a
  missing `/assets/` file returns `404`; a production build with dummy
  `VITE_*` values succeeded and contained no `localhost:8000`. No backend
  request, auth refresh, Socket.IO, CORS, or `yarn verify:agent` check was run.
  Pending: deploy Backend, set real `VITE_*` values and redeploy, and set
  `CORS_ALLOWED_ORIGINS`/`FRONTEND_BASE_URL` to the Vercel origin. See
  [Frontend README](../../../frontend/README.md#vercel-production).
- **Atlas production initialized; live verified 2026-11-28:** The new `jobhub`
  database on `jobhub-prod.a956r7b.mongodb.net` began with zero collections.
  The V4.2 Salary cutover applied and verified the strict `jobs` validator;
  a subsequent read-only preflight reported it active with zero Jobs. The V4
  migration inserted and verified all six canonical Experience Levels. The
  production Job sample data was subsequently seeded as recorded below.
- **Production Platform Admin provisioned and login-verified 2026-11-28:** The
  new Atlas database has exactly one `User`, with role `PLATFORM_ADMIN`, status
  `ACTIVE`, verified email, `mustChangePassword=false`, and a bcrypt password
  hash verified against the configured credential. The canonical login service
  succeeded, and its verification session was removed; zero sessions remain.
  The account identifier and credentials are not recorded here.
- **Production Category catalog seeded and live-verified 2026-11-28:** The
  production Atlas `categories` collection now has 25 FIELDs and 886 POSITIONs
  (911 total). The normalized TopCV-derived catalog is in
  `tmp/production-seed-data/seed-normaliztion/topcv-jobhub-category-catalog.json`; its audit
  list excludes 25 clearly unrelated source positions from the Tài xế, Biên
  phiên dịch, and Luật groups. The explicit production seed script uses the
  canonical Category service, verifies the compound unique index and exact
  FIELD→POSITION relationships, and a second dry-run reported zero missing
  records. Focused Node syntax and changed-file ESLint passed; the full Backend
  gate was skipped at the user's request.
- **Production Company sample data seeded and live-verified 2026-11-28:** The
  Atlas database now has 50 `APPROVED + ACTIVE` Companies, 50 active Company
  Manager memberships, and 50 active, email-verified Company Staff accounts.
  Their source definitions and owner-only credential file are local under
  `tmp/production-seed-data/seed-normaliztion/` and ignored by Git. Profiles
  cover all 25 seeded FIELDs, including six IT Companies; each description has
  520–527 words and matching Full rich-text HTML/plain text. FIELD affinity is
  seed metadata and profile wording because Company has no FIELD reference in
  its approved schema. The explicit seed uses one MongoDB transaction per
  Company/User/Membership trio and verifies the Company validator plus unique
  Manager membership index. A real Manager login and owned active Company read
  succeeded; the test session was removed. A second dry-run found zero missing
  records. Focused syntax, changed-file ESLint, dataset audit and live Atlas
  checks passed; the full Backend gate was skipped at the user's request.
- **Production Recruiter sample data seeded and live-verified 2026-11-28:**
  Each of the 50 active Companies has exactly three active Recruiter
  memberships, for 150 Recruiter Users and 150 memberships. The owner-only,
  Git-ignored `tmp/production-seed-data/seed-normaliztion/production-recruiters.json`
  groups each Company with its three Recruiters and their individual login
  credentials. This explicit operator seed provisions the final activated
  state directly; the normal V3 invitation and self-activation workflow is
  unchanged. Production dry-run reported zero missing records, the employee
  code unique index was verified, two real Recruiter logins and their own
  Company access succeeded, foreign-Company access returned 403, and the test
  sessions were removed. Focused checks passed; the full Backend gate was
  skipped at the user's request.
- **Production Job sample data seeded and live-verified 2026-11-28:**
  `backend/scripts/seed-production-jobs.js` used canonical Recruiter draft,
  submit, Company Manager publish, and Supporting Recruiter assignment services
  to create 500 `PUBLISHED` Jobs from the normalized, Git-ignored
  `tmp/production-seed-data/seed-normaliztion/production-jobs.json`. There are
  exactly 10 Jobs per each of 50 Companies; every Job has one Primary and two
  distinct, active, same-Company Supporting Recruiters, one valid FIELD→POSITION
  pair, a valid Structured Salary, a future deadline, and nonempty rich-text
  HTML/plain content and `embeddingText`. A repeat dry-run found 500 existing,
  zero missing; a separate live audit verified all counts and relations. The
  production Atlas Vector Search index remained `READY` and queryable, and a
  sample semantic query returned 50 eligible hits (the query limit), sufficient
  to supply 10 candidates. Source salaries of zero were treated as negotiable;
  numeric `triệu` salaries were interpreted as monthly VND. The local, ignored
  state file supports safe resumption. This is sample data derived from a raw
  dataset, and some source benefit wording retains third-party insurance names;
  content accuracy has not been manually certified. Focused Node syntax,
  changed-file ESLint, the architecture checker (ARCH-001–019), and 19 Job
  approval/team tests passed. The full Backend gate was skipped at the user's
  request.
- **Production Candidate sample accounts seeded and live-verified 2026-11-28:**
  `backend/scripts/seed-production-candidates.js` provisioned 200 synthetic
  `CANDIDATE` Users as `ACTIVE`, email-verified, and login-ready with individual
  hashed passwords and optional birth dates. Their owner-only credential source
  is the Git-ignored
  `tmp/production-seed-data/seed-normaliztion/production-candidates.json`.
  Stable seed IDs and email collision checks make the explicit operator run
  resumable; a repeat dry-run found 200 existing and zero missing. The live
  database audit found exactly 200 Candidate Users, zero Candidate CVs, and zero
  sessions for the seeded Candidates. Two real Candidate logins and Profile
  reads succeeded; their test sessions were removed. No verification email was
  sent for the reserved `.invalid` addresses. Focused Node syntax and
  changed-file ESLint, ARCH-001–019, and 13 auth/profile tests passed. The full
  Backend gate was skipped at the user's request.
- **Development Platform Admin previously provisioned and login-verified:** The
  separate development Atlas database has one configured `PLATFORM_ADMIN` with
  `ACTIVE` status, a verified email, `mustChangePassword=false`, and a bcrypt
  password hash. Its previous sessions and temporary authentication tokens
  were revoked during provisioning; the verification session was removed.
- **2026-11-28 Company Manager fixtures:** the isolated An Phúc Company is
  APPROVED/ACTIVE with an active Manager and three copies of each Recruiter/Job
  scenario: activation/password readiness, membership and Platform lifecycle,
  pending/published/closed/expired/deadline-effective Jobs, team changes, forced
  transfer including DRAFT IDs, and assigned/unassigned/terminal Applications.
  Thirteen generated Candidate CVs use real restricted Cloudinary snapshot PDFs;
  existing Users, Companies and catalogs were preserved. The explicit operational
  script and scenario guide are under `work/company-manager-seed/`; credentials,
  activation links and asset provenance remain only in the ignored 0600 manifest.
  Reapplication preserves manual test progress. No SMTP messages were sent;
  delivery needs a real inbox rather than the fixture's reserved `.example` domain.

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

- 2026-11-28 Company Manager correctness fixes: `cd backend && npm run verify:agent`
  passed **221 files / 2,277 tests**, **ARCH-001–ARCH-019**, ESLint **0 errors /
  2 existing V6 warnings** in 998.16 seconds. The new legacy/paginated DRAFT
  regression passes 2/2 tests with allowed-status coverage. Twelve real-component
  FE → HTTP → Express → disposable MongoDB flows passed after the fix, including
  review decisions, team changes, assignment changes, Recruiter activation-mail
  requests, lock/unlock/terminate transfers and active Company PATCH. SMTP and
  Location catalog were mocked; no development seed records were changed.
  Frontend tests/build and its existing Candidate lint blocker are recorded in
  the Frontend leaf; this Backend gate does not verify Frontend behavior.

- 2026-11-28 operational Company Manager provisioning:
  `node ../work/company-manager-seed/seed.mjs --dry-run`, `--apply` and `--verify`
  (from `backend/`) passed model/catalog/identity preflight, transactional Atlas
  creation and real Express HTTP login/read checks. Verified homepage totals
  (12 pending, 21 persisted-published), all visible Job group details/teams,
  Application lists with all eight statuses, Recruiter lifecycle projections,
  three-Job handover previews, and 403 boundaries for DRAFT/Discovery. Counts:
  50 new Users (1 Manager, 36 Recruiters, 13 Candidates), 1 Company, 37 memberships,
  48 Jobs, 13 CVs, 261 Applications, 93 Availability and 93 Schedule records.
  Terminal Interview schedules are CANCELLED under the V12 rule. Verification
  sessions were removed. Both operational `.mjs` files passed scoped ESLint;
  repository diff whitespace check passed. This was data provisioning under
  `work/`, with no Backend runtime/test/dependency change; the common Backend
  gate was not rerun. No browser E2E, SMTP delivery or external AI call is claimed.

- 2026-11-27 Company Manager handover preview: `cd backend && npm run verify:agent`
  passed **220 files / 2,275 tests**, **ARCH-001–ARCH-019**, ESLint **0 errors /
  2 existing V6 warnings**. Default sequential configuration, no excluded tests,
  logging suppression or changed timeouts; total run 972.25 seconds. The unchanged
  pre-existing V15 test delta was present in the working tree and remains outside
  this task. Focused preview passed **2/2** tests; existing lock/terminate suites
  passed **31/31**. MongoDB tests use disposable replicas and mocked external
  services. No real Atlas, SMTP, Cloudinary or authenticated browser-to-Backend
  E2E is claimed; the UI browser checks used mocked transport.

- 2026-11-27 Recruiter website / public Discovery: final `cd backend && npm run verify:agent` passed **219 files / 2,273 tests**, **ARCH-001–ARCH-019**, ESLint **0 errors / 2 existing V6 warnings**. Default sequential configuration, no excluded tests or changed timeouts. The working tree included the unchanged pre-existing uncommitted V15 test delta; that file remains outside this feature commit. Focused Discovery passed **1 file / 38 tests**. Integration uses disposable MongoDB and mocked external services; no live Atlas/SMTP/Cloudinary/provider or browser E2E is claimed. Frontend has its separate gate and known lint failures as recorded in [Recruiter home](../frontend/recruiter-home.md).

- 2026-11-27 Admin phases 2–3: final `cd backend && npm run verify:agent` passed **219 files / 2,267 tests**, **ARCH-001–ARCH-019**, ESLint **0 errors / 2 existing V6 warnings**. No tests were excluded and timeouts were unchanged. Focused registration search/summary and existing read regressions passed **3 files / 18 tests**. An earlier gate run was stopped to include the empty-key query regression; the final run above verified the completed code. Route/README/integration inventory matched **15/15 endpoints** and `git diff --check` passed. The gate ran on the working tree including the unchanged pre-existing V15 test delta, outside this feature. Integration tests use MongoMemoryReplSet and mocked external services; no live MongoDB/SMTP/Cloudinary, browser or Frontend verification is claimed. Scoped implementation state is recorded in [V2](v02-company-onboarding-platform-administration.md).

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
