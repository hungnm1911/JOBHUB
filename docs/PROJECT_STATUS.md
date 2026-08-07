# JOBHUB Project Status

## Current milestone

The currently prepared product milestone is **V2 — Company onboarding và quản trị cấp nền tảng**.

V2 is **ready for implementation**: its approved business specification exists at `docs/product/versions/v02-company-onboarding-platform-administration.md`, and its persistence contract exists at `docs/data/versions/v02-company-onboarding-platform-administration.md`.

V1 backend business implementation is **complete** for the approved specification: Slices 1–10 (F01 registration through F11 platform-admin terminate account) are implemented with automated tests. All V1 business functions (F01–F11) have backend workflow coverage.

V2 business implementation has not started. The repository is prepared to begin V2 Slice 01 without implementing F01 behavior in the readiness change.

## Completed and verified

- **Implemented; lint-verified:** the Node.js ES-module backend project foundation, package scripts, Express application bootstrap, `/api` root router, hello-world endpoint, application middleware composition, and process startup/shutdown orchestration exist. The current backend source passes the configured ESLint command.
- **Implemented; test-verified for registration:** MongoDB connection/disconnection infrastructure and startup integration exist. The candidate registration request path uses MongoDB through `auth.service.js` to persist `User` and `AuthToken` records.
- **Implemented; not runtime-verified in this snapshot:** Cloudinary client configuration, startup connection verification, file upload/delete service operations, and non-production test endpoints exist.
- **Implemented; test-verified for registration (mail mocked in automated tests):** Nodemailer transport configuration and the canonical mail-sending service exist. The candidate registration request path invokes `mail.service.js`.
- **Implemented; lint-verified:** centralized unmatched-route and final error middleware exist and are registered after application routes. Some expected file errors still bypass the centralized formatter, as noted below.
- **Normalized; lint-verified:** V1 authentication-token types have one canonical owner at `backend/src/constants/auth-token-type.js`, containing only `EMAIL_VERIFICATION` and `PASSWORD_RESET`; unused invite-token helpers and the competing token-type owner have been removed.
- **Normalized; lint-verified:** `backend/src/config/index.js` is the sole dotenv loader and the sole direct `process.env` reader; the root entry point and other configuration modules consume normalized configuration.
- **Implemented; verified:** `backend/scripts/verify-architecture.js` provides dependency-free deterministic checks for the initial approved backend architecture invariants and passes against the current backend source.
- **Documented only:** backend architecture, conventions, canonical responsibility owners, and known technical mismatches are defined under `docs/engineering/`.
- **Documented only:** repository-level and backend-specific agent contracts exist.
- **Implemented; verified:** V1 Slice 1 — `POST /api/auth/register/candidate` creates an unverified `CANDIDATE` account, persists an `EMAIL_VERIFICATION` `AuthToken`, and sends verification email through the canonical mail service. Automated Vitest coverage exists for the registration path.
- **Implemented; verified:** V1 Slice 2 — `POST /api/auth/verify-email` validates and consumes `EMAIL_VERIFICATION` `AuthToken` records, sets `User.emailVerifiedAt`, rejects invalid/expired/consumed tokens, and does not change account status or issue login credentials.
- **Implemented; verified:** V1 Slice 3 — `POST /api/auth/login` requires valid credentials, verified email, and `ACTIVE` account status; creates one independent expiring `AuthSession` with hashed refresh credential; returns short-lived access token bound to the session.
- **Implemented; verified:** V1 Slice 4 — session-bound access authentication validates short-lived access JWTs against an existing unexpired `AuthSession` owned by the same `ACTIVE` user; revoked/expired/mismatched sessions, missing users, and non-`ACTIVE` account status are rejected. A non-production probe route exercises the middleware for tests only.
- **Implemented; verified:** V1 Slice 5 — `POST /api/auth/refresh` accepts a valid refresh credential for an existing unexpired `AuthSession`, requires the owning `ACTIVE` user, and returns a new short-lived access token bound to the same session without rotating the refresh credential or extending session expiration.
- **Implemented; verified:** V1 Slice 6 — `POST /api/auth/logout` revokes only the authenticated current `AuthSession` via access authentication; concurrent sessions remain valid; access and refresh credentials for the removed session are rejected afterward.
- **Implemented; verified:** V1 Slice 7 — `POST /api/auth/forgot-password` issues one expiring hashed `PASSWORD_RESET` `AuthToken` for existing accounts, replaces prior usable reset tokens, sends reset mail through the canonical mail service, and returns the same success response for nonexistent emails without creating tokens or sending mail.
- **Implemented; verified:** V1 Slice 8 — `POST /api/auth/reset-password` consumes a valid unexpired `PASSWORD_RESET` token, updates `passwordHash` under the V1 password policy, keeps `mustChangePassword` false, and revokes all `AuthSession` records for the user; invalid/expired/reused tokens change nothing.
- **Implemented; verified:** V1 Slice 9 — `POST /api/platform-admin/accounts/:userId/lock` requires session-bound access authentication and Platform Admin authorization; transitions only eligible `ACTIVE` non–Platform-Admin targets to `LOCKED`, preserves email verification and identity data, and revokes all `AuthSession` records for the target; rejects self-targeting, Platform-Admin-to-Platform-Admin lock, non-`ACTIVE` targets, and unknown accounts.
- **Implemented; verified:** V1 Slice 10 — `POST /api/platform-admin/accounts/:userId/terminate` requires session-bound access authentication and Platform Admin authorization; transitions eligible `ACTIVE` or `LOCKED` non–Platform-Admin targets to `TERMINATED`, preserves email verification and identity data, and revokes all `AuthSession` records for the target; rejects self-targeting, Platform-Admin-to-Platform-Admin terminate, already-`TERMINATED` targets, and unknown accounts.
- **Implemented; lint-verified:** `User`, `AuthToken`, and `AuthSession` Mongoose models, password/token hashing utilities, auth service/controller/routes, access-authentication service/middleware, platform-admin authorization middleware, platform-admin lock/terminate service/controller/routes, and registration/verification/login/refresh/logout/forgot-password/reset-password request handling.

- **Implemented; verified:** V1 acceptance remediation — session-bound access authentication now requires the owning user to remain `ACTIVE`, with regression coverage for non-`ACTIVE` access denial and post-lock/post-terminate protected-access rejection.
- **Prepared; verified:** V2 implementation-readiness governance is aligned: V1 is `COMPLETED AND VERIFIED`, V2 is `READY FOR IMPLEMENTATION`, and V2 is the current milestone. No V2 business behavior is implemented by the readiness change.
- **Prepared; verified:** backend integration tests use a single-node MongoDB replica set, and an infrastructure regression proves failed transactions roll back writes before V2 Slice 01 introduces TX-01.

## Known issues / known mismatches

- Several configuration values are both required and given unreachable defaults.
- Model and middleware barrels are empty or disconnected; seed files are placeholders.
- File-controller error formatting overlaps the centralized error handler, while request/input and business validation ownership also overlaps.
- Human decisions remain open around barrel usage, error-format boundaries, required-versus-defaulted configuration, request validation placement, and seed ownership.

## Deferred / not started

- V2 Slice 01 and all later V2 slices are not started.
- Architecture rule `ARCH-016` still enforces the exact V1 authentication-token type set. It does not block Slice 01 and must be updated only when the later approve/confirmation slice introduces the approved `COMPANY_APPROVAL_CONFIRMATION` type.
- V3 through V17 remain `PLANNED`. Their roadmap titles are not approved detailed specifications and are not implementation authority.

## Verification status

- Deterministic architecture verification exists, and the official backend verification command is `cd backend && npm run verify:agent`.
- `npm run verify:agent` consists of ESLint, deterministic architecture verification, and Vitest; it was run for this snapshot and passed.
- The current baseline is 11 passing test files and 55 passing tests: all 54 V1 regression tests plus one MongoDB transaction-capability regression.
- Focused automated tests cover V1 Slices 1–10: candidate registration, email verification, login, session-bound access authentication, access refresh, logout, forgot-password issuance, password-reset completion, platform-admin lock account, and platform-admin terminate account (`test/auth/*.test.js`).
- No automated test script is defined outside the backend package; frontend verification is outside `verify:agent` and was not run.
- Backend startup, Cloudinary connectivity/operations, live SMTP delivery, endpoint smoke tests outside automated registration coverage, and frontend verification are outside `verify:agent` and were not run, so their behavior is not verified by this snapshot.

## Next recommended task

Begin V2 Slice 01 — F01 Company Manager and Company onboarding — against the approved V2 product and data contracts.
