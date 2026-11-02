# Backend V17 Rich Text Content Integration Project Status

## Current project state

**V17 — Rich Text Content Integration** is in progress. Slices 01–04 — Rich Text
Core, Job Description, Generated CV integration, and Harvard PDF / CV Snapshot
Compatibility — are implemented with focused checks passing on 2026-11-02.
Product and Data authority remain
`docs/product/backend/versions/v17-rich-text-content-integration.md` and
`docs/data/backend/versions/v17-rich-text-content-integration-data-model.md`.

## Deferred / not started

- Company integration, migration, and Frontend display remain for later slices.
  Slice 04 reuses the existing Application/Invitation snapshot schema, capture,
  copy, persistence, and read paths; no historical snapshot rewrite was made.
- The common backend `verify:agent` gate and full regression suite were not run
  for Slices 01–04 at the user's request. V17 is not marked complete.

## Implementation record (slice detail)

Slice 01 implements the shared Full/Minimal HTML normalization and corresponding
plain-text derivation in `backend/src/services/rich-text.service.js` for
`BR-01`–`BR-03`, `BR-09`, and Data §10. It follows the Frontend V04 formatting
and URL allowlists, strips unsupported or unsafe formatting, preserves readable
text and block boundaries without generating list markers, decodes HTML entities,
and represents markup-only content as empty. The
core leaves resource-specific required-content and length validation with the
future resource service integrations. It adds no persistence or HTTP behavior.

Slice 02 adds optional `Job.jobDescriptionHtml` and uses the Slice 01 Full
normalizer in existing DRAFT create/update paths. The same Job write stores
sanitized HTML and derived plain text; plain-only updates clear HTML, and
unrelated patches preserve both. Existing internal Job and public Discovery
detail responses expose HTML alongside the existing plain text field; Search,
ranking, and AI normalization continue consuming plain text.

Slice 03 adds optional Minimal HTML alongside the three approved Generated CV
text fields. Existing CV writes sanitize HTML and derive plain text, clear stale
HTML on plain updates, and preserve untouched fields on partial saves. Existing
CV detail responses return both representations. Completeness and Draft/Active
transitions continue using meaningful plain text. The AI-V01 source projection
and AI-V06 optimization career sections omit HTML; the optimization Draft keeps
source HTML only for unchanged content. No AI Kit contract or LLM behavior
changed.

## Verification status

- 2026-11-02: after strengthening ordered/unordered-list PDF assertions, `cd backend && npx vitest run test/candidate/v7-candidate-cv-harvard-unicode.test.js` passed (6 tests); focused ESLint and `git diff --check` passed.
- 2026-11-02: `cd backend && npx vitest run test/candidate/v7-candidate-cv-harvard-unicode.test.js test/application/v9-direct-apply-generated.test.js test/application/v9-replace-submitted-cv.test.js test/application/v15-slice08-atomic-accept-availability-handoff.test.js` passed (4 files, 37 tests). Coverage includes Minimal and legacy plain-only PDF, Generated CV preview/download, V09 Direct Apply/Replace snapshot HTML and plain text, V15 Send → Accept copy, and source-edit independence.
- 2026-11-02: focused ESLint on the Slice 04 renderer and four affected test files passed; `git diff --check` passed. The common backend `verify:agent` gate was intentionally skipped by user scope.
- 2026-11-02: `cd backend && npx vitest run test/candidate/ai-v06-slice-07-action-persistence.test.js`
  passed (6 tests), including persisted Generated Draft checks for unchanged
  source HTML and AI-replaced plain text without stale HTML. Targeted ESLint on
  that test file passed; AI inference was mocked.
- 2026-11-02: `cd backend && npx vitest run` with eight focused Candidate CV,
  AI-V01, AI-V06, Builder, and lifecycle test files passed (87 tests); after
  adding the ACTIVE/default HTML regression, four directly affected files
  passed (64 tests). The final create-path addition passed in the Slice 03
  focused file (6 tests).
- 2026-11-02: focused ESLint on Slice 03 source and test files passed.
- 2026-11-02: `cd backend && npm run verify:architecture` passed
  (`ARCH-001` through `ARCH-019`); `git diff --check` passed.
- 2026-11-02: `cd backend && npx vitest run test/job/v17-slice02-job-rich-text.test.js test/job/v5-job-create-draft.test.js test/job/v5-job-edit-draft.test.js test/job/v5-job-submit-draft.test.js test/job/v8-job-discovery.test.js test/job/ai-v01-b1-job-normalization.test.js test/services/v17-slice01-rich-text-core.test.js` passed (7 files, 105 tests).
- 2026-11-02: focused ESLint on all changed backend source/test files passed.
- 2026-11-02: after adding HTML preservation to the submit regression,
  `cd backend && npx vitest run test/job/v5-job-submit-draft.test.js` passed
  (1 file, 8 tests), and focused ESLint on that file passed.
- 2026-11-02: `cd backend && npm run verify:architecture` passed (`ARCH-001` through `ARCH-019`).
- 2026-11-02: `git diff --check` passed.
- 2026-11-02: `cd backend && npx vitest run test/services/v17-slice01-rich-text-core.test.js`
  passed (1 file, 17 tests; includes F01–F03 regression cases, which failed before the fix).
- 2026-11-02: `cd backend && npx eslint src/services/rich-text.service.js test/services/v17-slice01-rich-text-core.test.js`
  passed.
- 2026-11-02: `cd backend && npm run verify:architecture` passed
  (`ARCH-001` through `ARCH-019`).
- `cd backend && npm run verify:agent` was intentionally skipped by user scope
  for Slices 01–03.
