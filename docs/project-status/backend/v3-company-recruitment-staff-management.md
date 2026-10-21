# Backend V3 Company Recruitment Staff Management Project Status

## Current project state

V3 API completion is implemented and verified (2026-10-21). F10/BR-29 now permit employeeCode/jobTitle updates of same-Company non-TERMINATED Recruiters, following the approved business decision.

- Strict PATCH uses an atomic status predicate and the existing unique index; PUT remains unsupported. Both Recruiter lists support search/filter/stable sort/pagination. Platform Admin reads by Company ID; Company Manager stays tenant-bound.
- Activation resend uses existing activation credentials and SMTP cleanup. Existing create, lock, unlock, terminate and activation completion functions are unchanged.
- Common backend gate: 178 files / 1,823 tests passed; see [Platform and operations](platform-and-operations.md) for shared evidence.

## Deferred / not started

- No implementation or verification item remains in the approved V1–V4 API completion scope. Held lifecycle/identity operations remain outside scope.

## Previously completed and verified baseline

- **Implemented; verified:** V3 Slice 09 — V3 acceptance & regression closure (F01–F09, F11–F17; BR-01–BR-29; TX-01–TX-07 as applied): cross-cutting acceptance suite confirms end-to-end Recruiter lifecycle, cross-tenant/`companyId` non-expansion, invalid-actor matrix, platform/Company restriction precedence, pre-activation denials, TERMINATED terminal transitions, session revocation after lock/reset/terminate, V1 Candidate + V2 CM membership SoT compatibility (no persisted `Company.managerUserId`), credential non-leakage, and the original F10 PATCH/PUT absence (superseded for PATCH by the approved 2026-10-21 F10 revision; PUT remains unsupported). Coverage in `test/auth/v3-acceptance.test.js` plus prior V3 slice suites.

- **Implemented; verified:** V3 Slice 08 — Recruiter termination & historical retention (F13, F16 / TX-05; BR-19, BR-20, BR-21): valid Company Manager terminates same-tenant Recruiter membership from `ACTIVE` or `LOCKED` to terminal `TERMINATED`; TX-05 atomically sets membership `TERMINATED` and revokes all `AuthSession` records without hard-deleting User/CompanyMember or changing `User.status`/Company lifecycle; email/`employeeCode`/`jobTitle`/tenant relationship are retained and email cannot be reused for a new Recruiter; lock/unlock/second terminate from `TERMINATED` are rejected. Focused coverage in `test/auth/v3-recruiter-termination.test.js`.

- **Implemented; verified:** V3 Slice 07 — Recruiter lock & unlock (F11, F12 / TX-04; BR-16, BR-17, BR-18, BR-22, BR-23): valid Company Manager locks/unlocks same-tenant Recruiter membership only; lock allows only `ACTIVE → LOCKED` and atomically revokes all Recruiter `AuthSession` records; unlock allows only `LOCKED → ACTIVE` without restoring sessions and rejects platform-restricted Users and `TERMINATED` membership; neither path changes `User.status` or Company lifecycle. Focused coverage in `test/auth/v3-recruiter-lock-unlock.test.js`.

- **Implemented; verified:** V3 Slice 06 — Recruiter password recovery & CM-initiated reset (F06, F07 / TX-03; BR-06, BR-07, BR-12, BR-14, BR-15, BR-17, BR-22): activated Recruiters reuse `PASSWORD_RESET` self forgot/reset; valid CM can initiate same-tenant reset only after initial activation and not for `TERMINATED` membership; completion atomically updates `passwordHash`, sets `mustChangePassword=false`, consumes the token, and revokes all `AuthSession` records without changing User/membership/Company lifecycle; CM never receives password or raw token. Focused coverage in `test/auth/v3-recruiter-password-reset.test.js`.

- **Implemented; verified:** V3 Slice 05 — Recruiter list & detail (F08, F09; BR-06, BR-07, BR-23, BR-29): valid Company Manager lists and reads Recruiter detail only in the membership-derived tenant via `CompanyMember(role=RECRUITER)`; responses expose management fields (`fullName`, `email`, `employeeCode`, `jobTitle`, User/membership status, activation readiness) without passwordHash/token/session credentials; client `companyId` cannot expand scope; Recruiter peers and invalid Company state are rejected. Focused coverage in `test/auth/v3-recruiter-list-detail.test.js`.

- **Implemented; verified:** V3 Slice 04 — Recruiter activation completion (F05 / TX-02; BR-11, BR-12, BR-13): Recruiter completes activation with a valid single-use `RECRUITER_ACTIVATION` token and self-chosen password; TX-02 atomically updates `passwordHash`, sets `mustChangePassword=false` and `emailVerifiedAt` (settled decision: activation also verifies email), and consumes the token without changing `User.status`, `CompanyMember`, or Company lifecycle; afterward only the activation/password gate is cleared and business access still uses F14 layered authorization. Focused coverage in `test/auth/v3-recruiter-activation.test.js`.

- **Implemented; verified:** V3 Slice 03 — Recruiter creation + activation issuance (F03, F04; F16 identity/history foundation): valid Company Manager creates Recruiter in membership-derived tenant with required `fullName`/`email`/`employeeCode`/`jobTitle`; TX-01 atomically persists `User(COMPANY_STAFF, ACTIVE, mustChangePassword=true)` + `CompanyMember(RECRUITER, ACTIVE)`; after commit issues hashed `RECRUITER_ACTIVATION` token and emails the Recruiter only (no password/raw credential to CM); SMTP stays outside TX-01. Focused coverage in `test/auth/v3-recruiter-creation.test.js`.

- **Implemented; verified:** V3 Slice 02 — Company Staff authorization & tenant context (F02, F14, F15): tenant resolves from `CompanyMember` only (client `companyId` cannot expand scope); business access requires User `ACTIVE` + membership `ACTIVE` + Company `APPROVED`/`ACTIVE` + `mustChangePassword=false` before Company role; platform User and Company restrictions outrank membership; `RECRUITER` cannot manage other Recruiters. Focused service + non-prod probe coverage in `test/auth/v3-company-staff-authorization.test.js`.

- **Implemented; verified:** V3 Slice 01 — Company Staff foundation and V2 cutover (F01, F17): platform role `COMPANY_STAFF`; `CompanyMember` as sole Company-role source of truth; onboarding TX-06 creates User + Company + `CompanyMember(COMPANY_MANAGER)` while preserving `PENDING_ACTIVATION` semantics; V2 tenant/manager resolution uses membership instead of `Company.managerUserId`; TX-07 migration under approved owners (`scripts/run-migration.js`, `src/database/migrations/v3-tx07-company-manager-to-company-staff.js`) converts legacy pairs, verifies invariants, then removes `managerUserId`.

- **Implemented; verified:** V3 acceptance finding — TX-07 now preserves each legacy `Company.managerUserId` as the exact `CompanyMember(companyId, userId=legacy manager, role=COMPANY_MANAGER)` pair, converts that User `COMPANY_MANAGER → COMPANY_STAFF` only inside the pair persistence-unit transaction, keeps `managerUserId` until post-migrate invariant verification succeeds, then removes it; rejects conflicting non-pair `COMPANY_MANAGER` memberships and does not broad-convert orphan `COMPANY_MANAGER` users. Focused regressions in `test/auth/v3-tx07-company-staff-cutover.test.js`.

- **Implemented; verified:** V3 acceptance finding — TX-07 failure-path evidence now covers missing/invalid-role legacy manager Users, conflicting non-pair `COMPANY_MANAGER` memberships, orphan legacy `COMPANY_MANAGER` Users (verification fail blocks `managerUserId` removal), incomplete global cutover when one persistence unit fails (all `managerUserId` values retained), and pre-removal detection of `COMPANY_MANAGER` memberships pointing at non-`COMPANY_STAFF` Users. Coverage in `test/auth/v3-tx07-company-staff-cutover.test.js`.

- **Prepared; verified:** V3 Product/Data contract paths and repository milestone status were aligned for `READY FOR IMPLEMENTATION` before Slice 01; the backend replica-set test infrastructure proves transaction rollback; migration tooling ownership is defined by the engineering contracts.

## Verification status

- 2026-10-21 final common backend gate passed with `VITEST_MAX_WORKERS=2 npm run verify:agent`: ESLint 0 errors / 2 pre-existing V6 test warnings; ARCH-001–ARCH-019; 178/178 files and 1,823/1,823 tests. No tests were excluded and timeouts were unchanged. The earlier default-worker run's unrelated V15 timeout passed alone (33/33) before the clean gate rerun.
- Focused completion run: five files / 39 tests passed (`v1-api-completion`, `v2-v3-api-completion`, `v3-recruiter-password-reset`, `v3-acceptance`, `v4-optional-pagination`). After reusing the existing regex helper, the two affected completion suites passed again (16/16).
- `git diff --check` and whitespace checks on the seven new files passed. Shared environment and gate evidence: [Platform and operations](platform-and-operations.md).
- Real SMTP, live MongoDB/provider and frontend runtime checks were not performed. Integration tests use MongoMemoryReplSet, mocked mail and stubbed Location provider.
