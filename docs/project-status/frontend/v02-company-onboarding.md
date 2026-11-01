# Frontend V2 Company Onboarding Project Status

## Current project state

The Company Manager onboarding screens for V2 F02, F03, and F08 are
`IMPLEMENTED AND VERIFIED` as of 2026-11-01. `/onboarding/company` is guarded
by `ProtectedRoute` and `RoleRoute` (`COMPANY_STAFF` with `PENDING_ACTIVATION`)
and is reached after Company Manager registration (F01) or after login with
`PENDING_ACTIVATION`.

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
- **Company Preview design pilot (2026-10-21):** presentation implemented
  with a single reading flow, key–value sections, full profile values, image
  inspection, and warning/checkbox/actions together. `CompanyProfileCard`
  exposes an opt-in `presentation="review"`; its default Admin presentation
  remains unchanged. Business/API/validation/session behavior and the Design
  Contract are unchanged. The approved Contemporary Product + Enterprise
  prototype is now implemented: company identity anchors the profile, section
  headings align with compact metadata, prose has a reading measure, full URLs
  use sans-serif, and media frames fit uncropped images. The confirmation area
  ends the main surface; account controls remain secondary. Code gate and
  isolated-fixture Chrome checks passed; human visual review, native 200% zoom
  and live authenticated workflow validation remain pending. `[Đo]` values have
  fixture evidence only; none have become fixed Design Contract tokens.
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

- 2026-11-01 onboarding route guard: `cd frontend && yarn verify:agent` passed
  13 authentication tests, ESLint, and the production build. Route matching
  confirmed the protected/role boundary and `PENDING_ACTIVATION` status rule.
  No browser check was performed for this route change.

- Company Preview approved-prototype implementation (2026-10-21):
  `cd frontend && yarn verify:agent` passed (13 authentication tests, ESLint,
  production build; existing >500 kB chunk warning). Chrome DevTools MCP
  exercised the production components in a temporary Vite fixture at
  360/768/1024/1440px with normal, long, portrait, wide, broken-image and empty
  data (24 combinations). Full fields, no horizontal overflow, uncropped
  image ratios, fallbacks and initial controls passed. Keyboard checkbox
  enable/disable, focus and action traversal passed at 360/1440px. A
  fixture-only Axios adapter verified edit, both actions disabled while
  submitting, loading indicator, one POST and the success callback; no real
  submit/logout or DB writes occurred. Long-content reflow passed at
  720/512/384 CSS px; native 200% zoom remains unverified. Screenshots and JSON
  evidence are under `/tmp/jobhub-preview-implementation/` (temporary).
  Source comparison preserves the default profile branch, `SafeImage`, submit
  handler, Admin Detail, Pending, API/auth/validation, shared defaults and
  Design Contract. Current `[Đo]` candidates: identity 32/40 desktop and 26/34
  mobile, prose 16/28 with max 65ch, section-heading column 10rem, asset URLs
  14/20 sans-serif, banner max 15rem in a content-fitting frame. Human review,
  native zoom, assistive-technology and live authenticated integration checks
  remain open; this fixture evidence does not approve those values as tokens.
- Earlier Company Preview visual refinement (2026-10-21; presentation superseded
  by the implementation above): `cd frontend && yarn verify:agent`
  passed (13 authentication tests, ESLint, production build; chunk-size warning
  >500 kB). Existing Chrome DevTools MCP 1.9.0 and Windows Chrome exercised the
  real presentation components in a temporary Vite fixture with the existing
  header, footer, stepper and account component; no DB records were seeded.
  All 24 combinations passed: 360/768/1024/1440px × normal, portrait (300×1500),
  wide (6000×160), long content, empty fields and failed images. Checked full
  name/URL text, no page/pilot overflow, contained image ratio, fallbacks and
  initial unchecked/disabled controls. Tab/Shift+Tab/Space, visible focus and
  checkbox enable/disable passed at 360/1440px without submit/logout requests.
  Baseline/after/focus screenshots and measurements are under
  `/tmp/jobhub-preview-refinement/` (temporary local artifacts).
  Native zoom shortcuts had no effect in headless Chrome. Equivalent 200%
  reflow passed at 720/512/384 CSS px (1440/1024/768 physical px, DPR 2);
  at 180 CSS px the unchanged global navigation overflowed to 261px while
  Preview itself did not overflow. This is not a native browser zoom pass.
  Source/hash checks preserve default profile JSX, Admin Detail, Pending,
  onboarding/API/auth behavior, global styles, dependencies and Design Contract.
  Fixture-validated candidates: content max 64rem, title 24/32, section title
  16/24, section gap 24px, label column 11rem, URL 14/20 monospace, banner max
  20rem with frame min 8rem. Native 200% zoom, loading/API integration, actual
  font delivery, contrast measurement and human visual approval remain open;
  candidates are not fixed tokens. Earlier static SSR checks covered four
  default-profile baselines (identical) and four review fixtures.
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
