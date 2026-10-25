# AI-V05 Candidate Job Recommendation Project Status

## Current project state

AI-V05 Product Specification and Data Contract are **APPROVED**. Slice 01 — Job
Embedding Foundation (F02 support) is implemented and verified with focused
offline tests: READY JobMatchProfile formatting, optional Job `embeddingText`,
best-effort sync after publish, and explicit reconciliation. Slice 02's
`jobhub-dev` Atlas Vector Search Index is `READY` and queryable on all three
nodes. Actual Atlas Automated Embedding token usage has not been captured.
Final Acceptance is not started.

## Deferred / not started

- Query embedding, recommendation orchestration, and Candidate HTTP delivery
  remain deferred.
- Atlas Automated Embedding token usage and retrieval quality remain unverified;
  no query embedding or generative provider call was run.

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
