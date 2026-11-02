# Frontend V17 Rich Text Content Integration Project Status

## Current project state

Company Description integration (`F03`, `F06`) is implemented on the existing
Company onboarding and read surfaces as of 2026-11-02, with focused tests,
focused ESLint, and the production build passing. This is a focused verification
snapshot; the common frontend `verify:agent` gate and browser acceptance were
not run by user scope. V17 is not marked complete.

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

## Deferred / not started

- Other V17 Frontend display work outside Company Description remains deferred.
- Browser acceptance and the common frontend `verify:agent` gate remain pending
  under the requested focused-only verification scope.

## Verification status

- 2026-11-02: `cd frontend && node --test test/company-rich-text-integration.test.js`
  passed (6 tests). Coverage: website-only PATCH preserving HTML/plain text;
  Rich Text edit and legacy edit submitting HTML without stale plain text;
  clear and continue response; save/reset; sanitized review/admin/public Company
  and Job detail rendering and escaped legacy fallback.
- 2026-11-02: `cd frontend && yarn test:rich-text` passed (34 tests, including
  the Company integration file); focused ESLint on affected source and test
  files, `yarn build`, and `git diff --check` passed. The build reported the
  existing large-chunk warning.
