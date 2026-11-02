# Backend V17 Rich Text Content Integration Project Status

## Current project state

**V17 — Rich Text Content Integration** is in progress. Slices 01–06 — Rich Text
Core, Job Description, Generated CV integration, Harvard PDF / CV Snapshot
Compatibility, Legacy Migration, and Company Description — are implemented with focused checks
passing on 2026-11-02. Slice 04 acceptance was rechecked with PDF and
Application/Invitation snapshot tests during Slice 05 verification.
Product and Data authority remain
`docs/product/backend/versions/v17-rich-text-content-integration.md` and
`docs/data/backend/versions/v17-rich-text-content-integration-data-model.md`.

## Deferred / not started

- Frontend display remains for a later slice. Company legacy records remain
  plain-text compatible; Company backfill is optional and is excluded from the
  current V17 migration definition. No local or
  Atlas write migration has run; an operator must review the read-only
  `node scripts/run-migration.js v17-legacy-rich-text-backfill --preflight`
  report before any explicit production backfill.
- The common backend `verify:agent` gate and full regression suite were not run
  for Slices 01–06 at the user's request. V17 is not marked complete.

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

Slice 04 acceptance: Harvard PDF renders supported Minimal formatting and
falls back to legacy plain text. V09 Direct Apply/Replace captures Generated CV
HTML with plain text; V15 Send captures an invited snapshot and Accept copies
that snapshot. Source edits and the Slice 05 backfill do not rewrite historical
Application or Invitation snapshots.

Slice 05 adds the explicit `v17-legacy-rich-text-backfill` migration to the
existing runner. Read-only preflight reports eligible records/fields and sampled
IDs. Only DRAFT Jobs and non-archived Generated DRAFT/ACTIVE CVs are eligible;
HTML is generated from escaped literal plain text and stored only if the shared
normalizer derives the exact original plain string. Conditional HTML-only
updates leave plain text, lifecycle, ownership, and timestamps intact. Locked
Jobs, archived/Uploaded CVs, incompatible plain strings, Company, and historical
snapshots remain untouched. Repeated execution makes no further changes.

Slice 06 adds optional Full `Company.descriptionHtml` to existing draft and
active profile writes and read responses. HTML updates derive the persisted
plain `description`; plain-only updates clear HTML; unrelated patches preserve
both. Submit captures both representations in a new immutable review snapshot.
Legacy Company and historical review snapshots remain readable without HTML.

Slice 01–04 Backend impact audit:

| Classification | Paths and evidence |
|---|---|
| UPDATED | Job DRAFT write/read and Discovery detail (`job.service.js`, `job-discovery.service.js`; Slice 02 tests); Generated CV write/read and AI source projection (`candidate-cv.service.js`, `candidate-cv-ai-normalization.service.js`; Slice 03 tests); Harvard PDF and new snapshot capture/copy (`candidate-cv-harvard-pdf.service.js`, `cv-snapshot.service.js`, `application.service.js`, `job-invitation.service.js`; Slice 04 acceptance tests). |
| UNCHANGED-SAFE | Discovery keyword/relevance matches `jobDescription`; Job AI normalization reads plain text; AI-V06 career projection removes HTML; completeness reads plain text; existing Application/Invitation snapshots are independent copies. Existing focused tests and source-path inspection support these boundaries. |
| DEFERRED | Company integration and Frontend display belong to later slices. |

Slice 06 Backend impact audit:

| Classification | Paths and evidence |
|---|---|
| UPDATED | `company.model.js` stores optional live/snapshot HTML; draft/active validators and `company.service.js` normalize writes and capture both fields at submit; `toPublicCompany`, `platform-admin.service.js` review detail, and `job-discovery.service.js` Company and Job detail projections expose nullable HTML. Focused HTTP and persistence tests cover these paths. |
| UNCHANGED-SAFE | `auth.service.js` registration/confirmation and `platform-admin.service.js` approval/rejection/lock preserve Company content and use existing serializers; list summaries do not carry Description. Existing auth, approval, rejection, confirmation, tenant and Discovery tests passed. Historical snapshots are not updated. |
| DEFERRED | Frontend rendering; optional Company legacy backfill. The V17 migration currently excludes Company, and legacy plain-only reads return `descriptionHtml: null`. |

## Verification status

- 2026-11-02: Slice 06 focused `cd backend && LOG_LEVEL=silent npx vitest run` with Company draft/active/submit, Platform Admin registrations/approve/reject, confirmation, and V8 Discovery files passed (8 files, 59 tests). After adding Job detail Company HTML projection, the affected V8 test passed again (1 passed, 19 skipped); after strengthening registration and rich approval assertions, the two affected tests passed again (2 passed, 11 skipped). Focused ESLint, `git diff --check`, and `npm run verify:architecture` passed (`ARCH-001`–`ARCH-019`). `verify:agent`, full gate, LLM/provider calls, and data-write migration were skipped by user scope.
- 2026-11-02: Candidate My Application and Candidate Invitation Job summaries now expose nullable `jobDescriptionHtml` alongside unchanged plain text. Four focused HTTP regressions (Rich Text and legacy Job, list and detail for each surface) failed before the serializer fix and passed afterward. `cd backend && npx vitest run test/application/v10-candidate-my-applications.test.js test/application/v15-slice03-candidate-invitation-read.test.js` passed (2 files, 23 tests); focused ESLint on both services and tests passed. The full `verify:agent` gate was skipped by user scope.
- 2026-11-02: `cd backend && npx vitest run test/database/v17-slice05-legacy-rich-text-backfill.test.js test/candidate/v17-slice04-harvard-pdf-layout.test.js test/application/v9-direct-apply-generated.test.js test/application/v9-replace-submitted-cv.test.js test/application/v15-slice08-atomic-accept-availability-handoff.test.js` passed (5 files, 36 tests). Migration tests cover dry-run document/index preservation, eligibility, exact escaped legacy text, idempotency, locked Job and historical snapshot preservation. Slice 04 PDF and snapshot acceptance passed in the same run. Focused ESLint on the new migration/test passed; `npm run verify:architecture` passed (`ARCH-001`–`ARCH-019`). No LLM or local/Atlas write migration ran. The full `verify:agent` gate was skipped by user scope.
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
