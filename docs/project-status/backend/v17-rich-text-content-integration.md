# Backend V17 Rich Text Content Integration Project Status

## Current project state

**V17 — Rich Text Content Integration** is in progress. Slice 01 — Rich Text
Core is implemented; Slice 01 acceptance findings F01–F03 were corrected and
focused checks passed on 2026-11-02. The core is not
yet connected to a resource. Product and Data authority remain
`docs/product/backend/versions/v17-rich-text-content-integration.md` and
`docs/data/backend/versions/v17-rich-text-content-integration-data-model.md`.

## Deferred / not started

- Job, Generated CV, and Company service integration; API, schema, persistence,
  snapshot, PDF, Search, and AI Kit changes remain for later slices.
- The common backend `verify:agent` gate and full regression suite were not run
  for Slice 01 at the user's request. V17 is not marked complete.

## Implementation record (slice detail)

Slice 01 implements the shared Full/Minimal HTML normalization and corresponding
plain-text derivation in `backend/src/services/rich-text.service.js` for
`BR-01`–`BR-03`, `BR-09`, and Data §10. It follows the Frontend V04 formatting
and URL allowlists, strips unsupported or unsafe formatting, preserves readable
text and block boundaries without generating list markers, decodes HTML entities,
and represents markup-only content as empty. The
core leaves resource-specific required-content and length validation with the
future resource service integrations. It adds no persistence or HTTP behavior.

## Verification status

- 2026-11-02: `cd backend && npx vitest run test/services/v17-slice01-rich-text-core.test.js`
  passed (1 file, 17 tests; includes F01–F03 regression cases, which failed before the fix).
- 2026-11-02: `cd backend && npx eslint src/services/rich-text.service.js test/services/v17-slice01-rich-text-core.test.js`
  passed.
- 2026-11-02: `cd backend && npm run verify:architecture` passed
  (`ARCH-001` through `ARCH-019`).
- `cd backend && npm run verify:agent` was intentionally skipped by user scope.
