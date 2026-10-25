# AI-V05 Candidate Job Recommendation Project Status

## Current project state

AI-V05 Product Specification and Data Contract are **APPROVED**. Slice 01 — Job
Embedding Foundation (F02 support) is implemented and verified with focused
offline tests: READY JobMatchProfile formatting, optional Job `embeddingText`,
best-effort sync after publish, and explicit reconciliation. Slice 02's
`jobhub-dev` Atlas Vector Search Index is `READY` and queryable on all three
nodes. Slice 03 — Default CV query and eligible Job retrieval — is implemented
as an internal runtime service and passed focused offline and one live
development checkpoint. Slice 04 — Batch Semantic Assessment & Reason (F03)
is implemented and focused offline verified; the H1 Job normalization failure
classification finding is fixed with focused regression coverage. Actual Atlas Automated Embedding
token usage has not been captured. Final Scoring, Candidate HTTP delivery, and
Final Acceptance are not started.

## Deferred / not started

- Final Scoring, Candidate HTTP delivery, and Final Acceptance remain deferred.
- Atlas Automated Embedding token usage and retrieval quality remain unverified;
  one live query embedding checkpoint was run, without a generative call.
- CCPro batch input/output limits and representative semantic quality remain
  unverified; Slice 04 made no live generative call.

## Implementation record (slice detail)

- Slice 01 reuses AI-V01 Job normalization after the canonical publish transition.
  The formatter includes Title, resolved FIELD/POSITION names, Required Skills,
  Description, and a descriptive ExperienceLevel label. Derived write failure
  leaves the Job published and can be repaired with
  `cd backend && npm run reconcile:job-embedding-text`. Draft edits do not
  trigger embedding work.
- On 2026-10-25, Slice 02 verified `NODE_ENV=development`, the
  `jobhub-dev.cffome0.mongodb.net` Atlas host, and database `jobhub` before
  writes. All 66 existing Jobs had
  `publishedAt` and lacked `embeddingText` (65 `PUBLISHED`, one `CLOSED`). The
  first explicit reconciliation returned `UPDATED=66, FAILED=0, SKIPPED=0`;
  the second returned `UNCHANGED=66`. Afterward, 66/66 published Jobs had
  nonempty `embeddingText` (35,671 characters total). A SHA-256 digest of all
  sorted Job documents excluding `embeddingText` matched before and after:
  `266603cbf97095b0c8b4d325e041110cbd95f505c1636c6b1f37c00665ebdfe8`.
- The sole `jobs` Search Index is `job_embedding_text_v05_vector_idx`, type
  `vectorSearch`, with `embeddingText` as `autoEmbed` `voyage-4` and filters
  `status`, `publishedAt`, `applicationDeadline`, `companyId`. Use
  `cd backend && npm run manage:job-embedding-index -- --check` to inspect it,
  or `--create` to create it again if absent. The command refuses a different
  development target or conflicting Vector Search Index and never drops or
  replaces an index. Actual indexing token usage must be read from Atlas
  Search & Vector Search → Automated Embedding → Usage, filtered to this index
  and the index creation interval; the MongoDB connection does not expose it.
- Slice 03 resolves the owning Candidate's active Default CV, reuses V01/V02
  normalization, builds runtime query text from the READY CV profile, and uses
  the existing `voyage-4` index. The retrieval pre-filter uses published Job
  state, future deadline, and APPROVED/ACTIVE Company IDs. Each hit is re-read
  and checked through `resolveJobDiscoveryVisibility`; only `DISCOVERABLE` hits
  retain their Vector Score and retrieval order. No CV query text, vector, or
  candidate list is persisted.
- Slice 04 carries the READY CV profile from retrieval without normalizing it
  again, selects the first 12 Vector-ranked Job hits by default (batch size is
  adjustable), and normalizes each Job through the existing Candidate-visible
  owner. One strict batch inference returns jobKey, V03 requirement groups, and
  a reason per Job. Exact jobKey coverage and per-Job V03 source resolution are
  required; invalid or incomplete output fails the request. This internal
  runtime path neither calculates final scores nor persists results.
- Slice 04 now opts into strict Job normalization failures: identified invalid
  Job source or taxonomy is skipped before batch, while dependency errors,
  unexpected AI Kit exceptions, and unclassified FAILED results fail the
  request. Remaining Jobs retain retrieval order and receive contiguous
  batch jobKeys; an empty prepared batch returns without inference.

## Verification status

- Focused AI Kit tests passed: `npx vitest run test/job-embedding-text.test.js
  test/job-normalization.test.js` (68 tests). Focused Backend tests passed:
  `npx vitest run test/job/v5-job-approve-publish.test.js
  test/job/ai-v01-b1-job-normalization.test.js` (50 tests), including publish
  success despite a derived write failure and reconciliation of stale text.
  After the final optional-field assertion, the publish suite passed again
  (7 tests).
- Focused ESLint on changed AI Kit/Backend code and Backend
  `npm run verify:architecture` passed. Full `verify:agent` gates were not run
  because this slice explicitly limits verification to focused checks.
- Slice 01 ran no Atlas Index, provider call, or live integration test.
- Slice 02 live checks: `npm run reconcile:job-embedding-text` completed twice
  with the counts above; `npm run manage:job-embedding-index -- --create`
  created the sole index and a second run was idempotent; `--check` returned
  `READY` and `queryable=true`, as did all three node status details. Focused
  Backend Vitest passed (2 files, 50 tests); AI Kit embedding formatter Vitest
  passed (1 file, 2 tests). Focused ESLint, `node --check`, and Backend
  `npm run verify:architecture` passed. The full `verify:agent` gates were
  deliberately not run for this focused slice. No retrieval or generative
  provider call was run. Atlas token usage remains unavailable from the
  credentials used here; 35,671 characters is source coverage, not token usage.
- Slice 03 focused AI Kit Vitest passed (2 files, 5 tests); focused Backend
  Vitest passed (1 file, 5 tests). Focused ESLint and Backend
  `npm run verify:architecture` passed. The full `verify:agent` gates were not
  run per the slice limit. Read-only development checks reconfirmed the index
  `READY/queryable`, six eligible Companies, 65 eligible Jobs with
  `embeddingText`, and 18 active Generated Default CVs. One live retrieval
  checkpoint using an active Candidate's Generated Default CV returned 50
  candidates with 50 numeric Vector Scores after canonical visibility
  revalidation. No generative provider was called. Atlas token usage remains
  unavailable from the MongoDB credentials.
- Slice 04 focused AI Kit Vitest passed (3 files, 57 tests); focused Backend
  Vitest passed (2 files, 21 tests). Focused ESLint and Backend
  `npm run verify:architecture` passed. The full `verify:agent` gates were not
  run per the slice limit. No live provider call was made; CCPro batch limits
  and semantic quality still need integration verification.
- H1 fix focused Backend Vitest passed (4 files, 64 tests), including V01/V03
  compatibility and V05 invalid Job, MongoDB failure, empty batch, and batch
  failure cases. Focused AI Kit Vitest passed (3 files, 101 tests), including
  strict unexpected-exception and default FAILED behavior. Focused ESLint and
  Backend `npm run verify:architecture` passed. Full `verify:agent` gates,
  provider calls, and Atlas calls were not run per this focused task.
