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
- `JobDiscoveryRoute` now gates `/`, `/jobs`, `/jobs/:jobId`, and
  `/companies/:companyId` using resolved authentication state and CompanyMember
  context from `/auth/me`: Guest, Candidate, Recruiter with active membership,
  and Platform Admin can enter; authenticated Company Manager is shown an
  unavailable state. Pending activation enters Company onboarding. The backend
  API remains the authority for every discovery request.
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

## Deferred / not started

- Work mode, Employment type, Experience and Salary filters; Position
  selection inside a Field; multi-select filters; explicit sort selection.
- My CVs, upload-during-apply (V9 F02 steps 4–5), and a Saved Jobs list page.
- Mockup items without Product/API authority were not implemented: event
  banner, response-rate/partner statistics, bookmark button, app download and
  links to non-existent tools. "Featured jobs" is presented as "newest jobs"
  because Backend V8 has no featured concept.

## Verification status

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
