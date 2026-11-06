# Frontend V03 Job Discovery Project Status

## Current project state

The public homepage and Job detail screens for Backend V8 F02, F03, F04
(Category and Location only) and F06/F07 retain their `IMPLEMENTED; CODE GATE
PASSED` baseline as of 2026-10-31. The V8 Enhancement (F01–F03B) is
**ACCEPTED within the focused verification scope** as of 2026-11-03, with
Product Owner acceptance of each slice. This does not newly accept all V8 or
V17 work. Human visual review against the provided homepage mockup is pending.
The Homepage Featured UX consuming Backend V8 F02/F05, BR-42/BR-43 and
API-V8-01 is **IMPLEMENTED / ACCEPTED within the focused verification scope**
as of 2026-11-07 by Product Owner decision, with the known risks below.
Its later Job navigation code gate passed, but browser/E2E verification of
Featured remains unconfirmed.
The [Backend V8 status](../backend/v8-job-discovery.md) records its baseline and
focused backend evidence.

- **Homepage (`/`) implemented baseline:** hero with the two newest
  discoverable Jobs and the live discoverable total; keyword search and the
  same Province/District-level unit multi-select picker as `/jobs`; Field Category panel
  (client-side pages of six, per-Field counts read from the discovery list
  `pagination.total`); a static JOBHUB introduction carousel describing only
  existing capabilities; and the discovery list (six per page, `FEATURED` on
  the unfiltered Homepage, backend default sort when filtered, with "Xem tất cả"
  linking to default `/jobs`). Filters live in the URL (`q`, `locations`,
  `field`, `page`); legacy `location` links remain readable.
- **Job detail (`/jobs/:jobId`):** API-V8-02 public projection with the
  historical read-only notice distinguishing `CLOSED` from expired Jobs;
  404/403 are shown as "not viewable" without retry.
- Discovery requests set `requiresAuthentication: true` so an existing session
  is sent (optional authentication) and the backend applies its actor rules.
- `JobDiscoveryRoute` gates `/`, `/jobs`, `/jobs/:jobId`, and
  `/companies/:companyId` using resolved authentication state and User role:
  Guest and Candidate can enter; authenticated Company Staff and Platform Admin
  see an access-denied state. It no longer reads CompanyMember context. Pending
  activation enters Company onboarding. The backend API remains the authority
  for every discovery request. F03A is accepted.
- **Company Detail (`/companies/:companyId`):** F03B Company Jobs section is
  implemented, focused-verified, and accepted as of 2026-11-03.
  It mounts after a successful Company profile read, uses the existing public
  Job list with `companyId`, `NEWEST`, and ten Jobs per page, and keeps Jobs
  pagination/loading/error/retry separate from the profile. Company changes
  reset the Jobs page and discard stale results. The Company description keeps
  the V17 Rich Text viewer path.
- `AppHeader` and `AppFooter` were redesigned for every `RootLayout` screen;
  guest Login/Register links are kept and the footer links only to existing
  routes.
- Owners: `apis/job-discovery.api.js`, `apis/category.api.js`,
  `apis/location.api.js`, `features/job-discovery/`, `pages/HomePage.jsx`,
  `pages/JobDetailPage.jsx`; vocabularies `JOB_STATUS`, `WORK_MODE`,
  `EMPLOYMENT_TYPE`, `EXPERIENCE_LEVEL`, `SALARY_TYPE`, `SALARY_PERIOD` in
  `utils/constant.js`; `--success` theme token in `styles/globals.css`.
- **Find Jobs (`/jobs`) and homepage job cards:** hover-reveal Direct Apply
  (V9 F01/F02 without in-flow upload) and Saved Jobs heart (V16 F01/F02/F04)
  are composed by pages; guests are sent to `/login`. Apply is always visible
  on Job detail. Code gate `yarn verify:agent` passed 2026-11-01. Candidate
  apply-with-CV was not browser-checked (no Candidate session).
- **Job navigation:** the two newest-Job Hero previews open Job detail from
  the whole item. Homepage, Find Jobs, and Company Jobs cards open Job detail
  from the Job title or Company logo, while Company name opens Company detail.
  The Company logo destination in `JobCard` and `JobResultCard` is intentional
  UX approved by the Product Owner. Other content in those cards has no
  navigation action; Apply and Save keep their own actions. This navigation
  change passed focused tests and the Frontend code gate on 2026-11-07.

## Deferred / not started

- Work mode, Employment type, Experience and Salary filters; Position
  selection inside a Field; multi-select filters; explicit sort selection.
- My CVs, upload-during-apply (V9 F02 steps 4–5), and a Saved Jobs list page.
- Browser-level visual/integration checks for the enhancement.
- **Accepted/deferred Featured risks:** the Product Owner accepted the MEDIUM
  transition regression coverage gap without adding tests. The LOW stale URL
  `page` case is outside this closure scope and deferred. Browser/E2E checks
  for Featured remain unverified.
- Mockup items without Product/API authority were not implemented: event
  banner, response-rate/partner statistics, bookmark button, app download and
  links to non-existent tools.

## Verification status

- 2026-11-07 Featured acceptance closure: the Product Owner accepted Homepage
  Featured UX within the focused scope and approved the JobCard/JobResultCard
  Company logo navigation to Job detail. The MEDIUM transition regression
  coverage gap was accepted without new tests; the LOW stale URL `page` case
  was deferred. The focused test and subsequent code-gate evidence below
  supports this state. No browser/E2E result is claimed for Featured.
- 2026-11-07 Job navigation UX: `cd frontend && yarn test:job-cards`
  passed 6 tests, `yarn test:featured-homepage` passed 5 tests, targeted
  ESLint on the changed components and tests passed, and `git diff --check`
  passed. The tests covered whole-item Hero navigation, logo/Company-name
  destinations, and unchanged Apply/Save actions. The subsequent
  `cd frontend && yarn verify:agent` passed authentication, Job card, Featured Homepage, and
  rich-text tests, ESLint, and the production build. Browser and E2E checks
  were not run. The parallel focused test run emitted a non-fatal Vite
  WebSocket port-in-use warning; the build retained the existing >500 kB
  chunk warning.

- 2026-11-07 Featured Homepage slice: `cd frontend && yarn test:featured-homepage`
  passed 4 focused tests covering the unfiltered Featured query, six cards and
  three-page response, default `/jobs` link, and keyword/location/field searches
  retaining unrestricted default-sort pagination. Targeted ESLint on the changed
  Frontend source and test and `git diff --check` passed. Full
  `yarn verify:agent`, browser, and E2E checks were not run per this slice's
  instruction; Product Owner acceptance was recorded in the later closure
  decision above.

- 2026-11-06 Homepage Location picker: `cd frontend && yarn verify:agent`
  passed authentication, Job card, and rich-text tests, ESLint, and production
  build. In the running browser, `/` loaded Province and District-level unit
  catalogs from the backend (`200`), applying Hà Nội / Ba Đình wrote
  `?locations=1%3A1` and sent `GET /api/job-discovery/jobs?locations=1:1`
  (`200`); a legacy `?location=1` link displayed Hà Nội and keyword search
  carried it forward as `locations=1`. The existing >500 kB chunk warning
  remains.

- 2026-11-03 Job card navigation: `cd frontend && yarn test:job-cards`
  passed (6 tests), `node --test test/company-jobs-section.test.js` passed
  (8 tests), and `cd frontend && yarn verify:agent` passed authentication,
  Job card navigation, and rich-text tests, ESLint, and production build.
  The build retained the existing >500 kB chunk warning. Browser interaction
  and Candidate-session Save/Apply were not checked. This later gate entry is
  for Job card navigation; it is not a rerun of the F03B slice's full gate.

- 2026-11-03 F03B: the new Company Jobs focused file and the related Company
  rich-text and Job rich-text integration files passed (3 files / 16 tests);
  the discovery route guard file passed (11 tests), for 27 focused tests in
  total. Targeted ESLint on the changed Frontend source and tests passed;
  `git diff --check` passed. The full `yarn verify:agent` gate, browser, and
  E2E checks were not run per the F03B slice instruction. F03B and the V8
  Enhancement were accepted by the Product Owner within this focused scope.
  The accumulated local code diff has
  not received an independent direct review; full enhancement gates, browser,
  and E2E verification remain unconfirmed.

- 2026-11-03 F03A: `cd frontend && yarn test:auth` passed all 5 directly
  related authentication/route files (31 tests, including 11 focused discovery
  route tests). Targeted ESLint on the changed guard and test passed;
  `git diff --check` passed. The full `yarn verify:agent` gate, browser, and E2E
  checks were not run per the F03A slice instruction.

- 2026-11-01 actor-aware navigation: `cd frontend && yarn verify:agent`
  passed 17 authentication tests, ESLint, and the production build (existing
  >500 kB chunk warning). A one-off route-guard render check covered Guest,
  Candidate, active Recruiter, Platform Admin, active Company Manager, and
  unresolved Company Staff context. No browser or live-backend check was
  performed for this change.

- 2026-10-31: `cd frontend && yarn verify:agent` passed (13 authentication
  tests, ESLint, production build; existing >500 kB chunk warning). Manual
  check in the Cursor browser (~1000 px viewport, local backend data): hero,
  search, Field counts, combined keyword + province + Field filtering, URL
  restore of the province select, Job detail, and the 404 state. Not checked:
  desktop ≥1024 px two-column layout, mobile widths, authenticated Candidate,
  Recruiter, or Company Manager sessions, and a historical read-only Job.
