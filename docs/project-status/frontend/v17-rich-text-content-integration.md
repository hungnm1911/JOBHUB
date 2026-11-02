# Frontend V17 Rich Text Content Integration Project Status

## Current project state

Company Description integration (`F03`, `F06`) and the existing public Job
detail read surface (`F01`, `F03`, `F05`) are implemented as of 2026-11-02.
Focused Rich Text tests, focused ESLint, and the production build passed. This
is a focused verification snapshot; the common frontend `verify:agent` gate and
browser acceptance were not run by user scope. V17 is not marked complete.

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

## Deferred / not started

- Job create/edit and their HTML-only changed-field submission, including
  unchanged-field omission on partial update: **DEFERRED**. No Frontend Job
  create/edit form or route exists. Backend V17 owns the current write contract.
- Application and Invitation Job summary Rich Text: **DEFERRED**. No such
  Frontend screen or component exists; the existing Apply dialog shows only
  the Job title.
- Generated CV and any other V17 Frontend display work outside the Company and
  public Job detail surfaces remain deferred.
- Browser acceptance and the common frontend `verify:agent` gate remain pending
  under the requested focused-only verification scope.

## Impact coverage — Job UI

| Existing surface | Description use | V17 result |
| --- | --- | --- |
| `/jobs/:jobId` public Job detail (permitted viewers) | Full Job Description | HTML viewer with safe rendering and escaped plain-text fallback; focused tests passed |
| `/` Home Job cards and `/jobs` search result cards | Title, Company, tags, and metadata only | No Description consumer; no UI change |
| Apply dialog on Job detail/cards | Job title only | No Description consumer; no UI change |
| Job create/edit, Application/Invitation Job summary | No Frontend route or component | **DEFERRED**; no new screen built |

## Verification status

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
