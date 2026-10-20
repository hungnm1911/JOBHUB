# Frontend V2 Company Onboarding Project Status

## Current project state

The Company Manager onboarding screens for V2 F02, F03, and F08 are
`IMPLEMENTED AND VERIFIED` as of 2026-10-19. `/onboarding/company` is guarded
by `ProtectedRoute` and `RoleRoute` (`COMPANY_STAFF`) and is reached after
Company Manager registration (F01) or after login with `PENDING_ACTIVATION`.

- **F02:** `CompanyProfileForm` edits the V02 profile fields (name,
  business registration number, website, address, contact info, description,
  logo URL, banner URL) through `PATCH /api/company`, with "save draft" and
  "continue" actions. Logo and banner are chosen as image files and uploaded
  through `POST /api/company/images/:kind` (`logo` / `banner`); the returned
  public URL is written into `logoUrl` / `bannerUrl` and persisted only when
  the user saves the draft or continues. Client limits mirror
  `backend/src/middlewares/validate-company-draft-update.js`; continuing
  requires name and business registration number (BR-05).
- **F03:** `CompanySubmissionReview` shows the saved profile, requires a
  client-side confirmation checkbox, and submits through
  `POST /api/company/submit`. Field rejections return the user to the form with
  the field error.
- **After submit / F08:** onboarding access only reads the Company while
  `NOT_SUBMITTED`, so `GET /api/company` answering `409` on `approvalStatus` is
  shown as one combined "submitted" screen. It explains the remaining steps and
  offers `POST /api/company/resend-approval-confirmation`, reporting the
  backend outcome (resent, still-valid confirmation, not awaiting activation,
  or email unavailable). The frontend cannot distinguish `PENDING`, `APPROVED`,
  and `REJECTED` because the V02 onboarding context exposes no status read.
- **F07:** the approval email links to `/confirm-company-approval?token=…`
  (Data Contract updated 2026-10-19). `CompanyApprovalConfirmationResult`
  posts the token once to `POST /api/auth/confirm-company-approval` and shows
  activated, invalid/expired/used link (`400 token`), not applicable (`409`),
  or retryable failure. After activation, a stored session of the same
  Company Manager is logged out through
  `endSessionOfActivatedUser` so the next login is a normal ACTIVE session;
  other users' sessions are kept.
- Logout is available through the authentication feature's
  `SessionAccountCard`, composed into the onboarding flow by the page.

## Verification status

- `cd frontend && yarn verify:agent` passed (12 focused tests, ESLint, Vite
  build).
- Browser run against the local backend: registered a test Company Manager
  (`cm-onboarding-test-1792421904733@example.com`, company
  `TEST Onboarding Company (xóa được)`), saw required-field errors, saved a
  draft, reviewed, submitted, reloaded into the submitted screen, received the
  "not awaiting activation" resend outcome while `PENDING`, logged out, logged
  back in to the submitted screen, and was redirected to `/login` when opening
  the route logged out.
- F07 browser run: a test confirmation token for
  `TEST Onboarding Company (xóa được)` opened `/confirm-company-approval`,
  activated the Company Manager and Company, kept the unrelated Platform Admin
  session, and reopening the same link showed the invalid-link state.
- Not exercised: a successful resend, the `409` not-applicable state, and
  logout of the activated Company Manager's own onboarding session.

## Platform Admin registration review (F04–F06)

`IMPLEMENTED AND VERIFIED` as of 2026-10-19 under
`frontend/src/features/company-registration-review/`. Every `/admin` route is
guarded by `ProtectedRoute` and `RoleRoute` (`PLATFORM_ADMIN`) and rendered in
`PlatformAdminLayout` (sidebar: overview, company registration review). Login
sends a Platform Admin to `/admin`.

- **Overview (`/admin`):** per-stage counts from the F04 list, each linking to
  the list filtered by `?stage=`, and the five longest-waiting `PENDING`
  registrations. Nothing outside the F04 list response is shown.

- **F04 list:** `GET /api/platform-admin/company-registrations`, shown with
  client-side stage tabs kept in the `?stage=` URL parameter (pending, approved awaiting Company Manager
  activation, active, rejected, locked, all) and a client-side search by
  company name, business registration number, and Company Manager.
- **F04 detail:** `GET /api/platform-admin/company-registrations/:companyId`
  shows the submitted `reviewSnapshot` through the shared
  `CompanyProfileCard`, the Company Manager summary, and review timestamps;
  invalid or unknown ids show a not-found state.
- **F05 / F06:** only `PENDING` registrations show approve and reject, each
  behind an inline confirmation. Approve uses the 60 s email-delivery timeout;
  `503` is reported as "approved but email not sent" and the detail reloads.
  `409` and `404` reload the detail. Reject states that the decision is final.
- Not implemented because V02 does not define them: rejection reasons
  (F06/BR-09), KYC checks, internal admin notes, legal document attachments,
  extra company or representative fields, Platform Admin resend or edit, and
  rejection emails.

### Verification

- `cd frontend && yarn verify:agent` passed (12 focused tests, ESLint, Vite
  build).
- Browser run against the local backend as the configured Platform Admin:
  login redirected to the list; stage counts matched; approving
  `TEST Onboarding Company (xóa được)` sent the email and moved it to
  "approved, awaiting activation"; rejecting a second test registration
  (`cm-reject-test-1792422710703@example.com`, `TEST Reject Company (xóa
  được)`) moved it to the final rejected state; an invalid id showed the
  not-found state.
- Admin shell (2026-10-19): `yarn verify:agent` passed (13 tests, ESLint,
  build). At 1280 px the overview showed the 256 px sidebar and five stage
  cards in one row without horizontal overflow; `?stage=active` opened the
  list on the active tab.
- Not exercised: the approve `503` and the `409`/`404` race paths.
