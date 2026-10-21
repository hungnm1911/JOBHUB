# Backend V1 Account Authentication Project Status

## Current project state

V1 API completion is implemented and verified (2026-10-21), including Me, Admin Accounts list/detail, Change Password, Resend Verification and Company Manager self forgot/reset-password via membership roles (including onboarding). Existing lifecycle and activation boundaries are preserved.

- Change Password atomically revokes every session and old reset credentials. Token replacement is serialized with consumption; verification consumption is transactional, and failed mail issuance cleans up only its own token.
- The common backend gate passed: 178 files / 1,823 tests, ARCH-001–ARCH-019, ESLint 0 errors / 2 pre-existing warnings. Shared gate evidence is recorded in [Platform and operations](platform-and-operations.md).

## Deferred / not started

- No implementation or verification item remains in the approved V1–V4 API completion scope. Held lifecycle/identity operations remain outside scope.

## Previously completed and verified baseline

- **Implemented; verified:** Browser-clickable auth email actions now use the shared `/api/auth/<action>?token=…` URL contract, fixing Gmail/browser `GET` clicks that previously reached non-existent bare-host paths while only body-token `POST` endpoints existed. V2 company-approval confirmation and V1 email verification consume their valid query token on `GET`; V3 Recruiter activation and V1/V3 password reset return a minimal password form on `GET` and consume only on its existing completion `POST`. The change adds no persistence fields or token types and leaves `jwt.js` access-JWT behavior unchanged. `APP_BASE_URL` must resolve to the reachable API origin. Focused auth suites passed; ESLint and architecture checks passed; the full suite passed `323/323` with `--fileParallelism=false`. The default parallel `verify:agent` run flaked twice on unrelated MongoMemoryServer startup timeouts.

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

## Verification status

- 2026-10-21 final common backend gate passed with `VITEST_MAX_WORKERS=2 npm run verify:agent`: ESLint 0 errors / 2 pre-existing V6 test warnings; ARCH-001–ARCH-019; 178/178 files and 1,823/1,823 tests. No tests were excluded and timeouts were unchanged. The earlier default-worker run's unrelated V15 timeout passed alone (33/33) before the clean gate rerun.
- Focused completion run: five files / 39 tests passed (`v1-api-completion`, `v2-v3-api-completion`, `v3-recruiter-password-reset`, `v3-acceptance`, `v4-optional-pagination`). After reusing the existing regex helper, the two affected completion suites passed again (16/16).
- `git diff --check` and whitespace checks on the seven new files passed. Shared environment and gate evidence: [Platform and operations](platform-and-operations.md).
- Real SMTP, live MongoDB/provider and frontend runtime checks were not performed. Integration tests use MongoMemoryReplSet, mocked mail and stubbed Location provider.
