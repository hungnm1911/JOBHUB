# Frontend V03 Job Discovery Project Status

## Current project state

The public homepage and Job detail screens for Backend V8 F02, F03, F04 (Category and
Location only) and F06/F07 are `IMPLEMENTED; CODE GATE PASSED` as of
2026-10-31. Human visual review against the provided homepage mockup is
pending.

- **Homepage (`/`):** hero with the two newest discoverable Jobs and the live
  discoverable total; keyword + province search bar; Field Category panel
  (client-side pages of six, per-Field counts read from the discovery list
  `pagination.total`); a static JOBHUB introduction carousel describing only
  existing capabilities; and the discovery list (six per page, backend default
  sort). Filters live in the URL (`q`, `location`, `field`, `page`).
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
  implemented and focused-verified as of 2026-11-03, pending review/acceptance.
  It mounts after a successful Company profile read, uses the existing public
  Job list with `companyId`, `NEWEST`, and ten Jobs per page, and keeps Jobs
  pagination/loading/error/retry separate from the profile. Company changes
  reset the Jobs page and discard stale results.
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
- **Job card navigation:** homepage, Find Jobs, and Company Jobs cards open
  Job detail from the Job title and Company detail from the Company name or
  logo. Other card content has no navigation action; Apply and Save keep their
  own actions. Focused navigation tests and the frontend code gate passed on
  2026-11-03.

## Deferred / not started

- Work mode, Employment type, Experience and Salary filters; Position
  selection inside a Field; multi-select filters; explicit sort selection.
- My CVs, upload-during-apply (V9 F02 steps 4–5), and a Saved Jobs list page.
- F03B review/acceptance and browser-level visual/integration checks.
- Mockup items without Product/API authority were not implemented: event
  banner, response-rate/partner statistics, bookmark button, app download and
  links to non-existent tools. "Featured jobs" is presented as "newest jobs"
  because Backend V8 has no featured concept.

## Verification status

- 2026-11-03 Job card navigation: `cd frontend && yarn test:job-cards`
  passed (6 tests), `node --test test/company-jobs-section.test.js` passed
  (8 tests), and `cd frontend && yarn verify:agent` passed authentication,
  Job card navigation, and rich-text tests, ESLint, and production build.
  The build retained the existing >500 kB chunk warning. Browser interaction
  and Candidate-session Save/Apply were not checked.

- 2026-11-03 F03B: the new Company Jobs focused file and the related Company
  rich-text and Job rich-text integration files passed (3 files / 16 tests);
  the discovery route guard file passed (11 tests). Targeted ESLint on the
  changed Frontend source and tests passed; `git diff --check` passed. The
  full `yarn verify:agent` gate, browser, and E2E checks were not run per the
  F03B slice instruction. Review/acceptance is pending; V8 Enhancement is not
  Final Accepted.

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
