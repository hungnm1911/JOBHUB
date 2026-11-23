# Frontend V17 Rich Text Content Integration Project Status

## Current project state

Company Description integration (`F03`, `F06`) and the existing public Job
detail read surface (`F01`, `F03`, `F05`) are implemented as of 2026-11-02.
Generated CV create/edit Rich Text fields (`F02`) are implemented as of
2026-11-23 with focused tests, targeted ESLint, and a production build.
Focused Rich Text tests, focused ESLint, and the production build passed.
Final E2E Phase 01 browser acceptance passed for public Company Rich Text and
legacy fallback, and published Rich Text and legacy Job detail on desktop and
mobile. The common frontend `verify:agent` gate was not run in that phase by
user scope.
Admin review of the newly captured Company HTML snapshot and public display
after activation passed on 2026-11-03. Phase 01 is complete; V17 is not marked
complete.

- `/onboarding/company` (Company Staff in the existing pending-activation flow)
  uses the Full `RichTextEditor`. `PATCH /api/company` omits both description
  representations when the field is unchanged and sends only `descriptionHtml`
  when edited. The backend derives the canonical plain `description`.
- The existing preview and `/admin/company-registrations/:companyId` review
  render live Company or immutable review-snapshot HTML through the Full
  `RichTextViewer`. `/companies/:companyId` and the Company section of
  `/jobs/:jobId` render the corresponding discovery API projections the same
  way. Missing HTML falls back to escaped plain text.
- `GET /api/company`, `PATCH /api/company`, `POST /api/company/submit`,
  Platform Admin registration detail, and public Company/Job detail remain the
  existing API boundaries. No route, realtime event, lifecycle, authorization,
  or persistence owner changed in Frontend.
- `/jobs/:jobId` renders `jobDescriptionHtml` through the Full
  `RichTextViewer` when present, with escaped `jobDescription` fallback for
  legacy responses. It consumes the existing `GET /api/job-discovery/jobs/:jobId`
  response without changing Search or Job actions.
- Generated CV create and edit share `CvGeneratedContentFields`. The existing
  `professionalSummary`, `workExperiences[].description`, and
  `projects[].description` controls use the Minimal `RichTextEditor`; their
  HTML and plain text pairs flow through the existing Candidate CV write APIs.

## Deferred / not started

- Job create/edit and their HTML-only changed-field submission, including
  unchanged-field omission on partial update: **DEFERRED**. No Frontend Job
  create/edit form or route exists. Backend V17 owns the current write contract.
- Application and Invitation Job summary Rich Text: **DEFERRED**. No such
  Frontend screen or component exists; the existing Apply dialog shows only
  the Job title.
- Generated CV Rich Text display outside the editing forms and other V17
  Frontend display work outside the Company and public Job detail surfaces
  remain deferred.
- The common frontend `verify:agent` gate now passes the Job Discovery
  authentication tests and stops at two existing React Hooks ESLint errors
  outside V17. The Vite config lint error is resolved.

## Impact coverage — Job UI

| Existing surface | Description use | V17 result |
| --- | --- | --- |
| `/jobs/:jobId` public Job detail (permitted viewers) | Full Job Description | HTML viewer with safe rendering and escaped plain-text fallback; focused tests passed |
| `/` Home Job cards and `/jobs` search result cards | Title, Company, tags, and metadata only | No Description consumer; no UI change |
| Apply dialog on Job detail/cards | Job title only | No Description consumer; no UI change |
| Job create/edit, Application/Invitation Job summary | No Frontend route or component | **DEFERRED**; no new screen built |

## Verification status

- 2026-11-23: The V8 Job Discovery route regression was fixed in its canonical
  guard without changing the V17 Rich Text forms or their tests. The isolated
  Job Discovery test passed (11/11); `yarn verify:agent` passed all test groups
  and stopped at the two existing React Hooks ESLint errors deliberately left
  outside this fix. Targeted ESLint for the guard and Vite config passed, and
  a separate `yarn build` passed. No browser check ran for this correction.
- 2026-11-23: `cd frontend && yarn test:rich-text` passed (36 tests),
  `yarn test:candidate-cvs` passed (7 tests), targeted ESLint on changed source
  and tests passed, `yarn build` passed, and `git diff --check` passed. The
  new Generated CV regression failed before the fix (0 of 3 expected editors)
  and passed after the fix. `yarn verify:agent` stopped at three unrelated
  Job Discovery auth-route assertions; the isolated test reproduced the same
  failures. Separate `yarn lint` reported three unrelated existing errors in
  `ApplicationConversationPanel.jsx`, `useCandidateApplicationDetail.js`, and
  `vite.config.js`. No browser or live backend integration check ran.
- 2026-11-03: Final E2E Phase 01 Browser displayed the new test Company's
  captured HTML review snapshot in the Platform Admin surface after approval,
  activation, and active profile update; its public Company page displayed the
  updated live HTML. Browser DOM values matched admin/public API and database
  values. Evidence: `tmp/evidence/v17/e2e-phase01/checkpoint.md`. No frontend
  code changed or full `verify:agent` ran in this phase.
- 2026-11-02: Final E2E Phase 01 Browser checked public Company HTML and
  escaped legacy plain text, published Job HTML and legacy fallback, and the
  Rich Text Job layout at 1280px and 390px without horizontal overflow. The
  browser DOM contained no `script` or unsafe link `href`; public API and
  database values matched. Screenshots and DOM evidence:
  `tmp/evidence/v17/e2e-phase01/checkpoint.md`. Admin review of the new
  Company snapshot was pending at this checkpoint and completed on 2026-11-03.
  No frontend code changed or full `verify:agent` ran in this phase.
- 2026-11-02: `cd frontend && yarn test:rich-text` passed (36 tests), including
  public Job detail HTML sanitization, legacy/missing-HTML response fallback,
  and the existing Company integration coverage. Focused ESLint on the affected
  component and tests, `yarn build`, and `git diff --check` passed. The build
  reported the existing large-chunk warning. Job create/edit and partial-update
  behavior could not be exercised in Frontend because their UI is absent.
- 2026-11-02: `cd frontend && node --test test/company-rich-text-integration.test.js`
  passed (6 tests). Coverage: website-only PATCH preserving HTML/plain text;
  Rich Text edit and legacy edit submitting HTML without stale plain text;
  clear and continue response; save/reset; sanitized review/admin/public Company
  and Job detail rendering and escaped legacy fallback.
- 2026-11-02: `cd frontend && yarn test:rich-text` passed (34 tests, including
  the Company integration file); focused ESLint on affected source and test
  files, `yarn build`, and `git diff --check` passed. The build reported the
  existing large-chunk warning.
