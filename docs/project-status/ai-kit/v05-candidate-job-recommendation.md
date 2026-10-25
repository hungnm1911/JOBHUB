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
classification finding is fixed with focused regression coverage. Slice 05 —
Final Scoring, Ranking & Candidate HTTP delivery (F04) is implemented and
focused offline verified. Live end-to-end checkpoints of
`POST /api/candidate/job-recommendations` passed for both a Generated and an
Uploaded Default CV. Actual Atlas Automated Embedding token usage has not been
captured. AI-V05 Final Acceptance is **PENDING**.

## Deferred / not started

- AI-V05 Final Acceptance is PENDING.
- Atlas Automated Embedding token usage and retrieval quality remain unverified.
- CCPro batch input/output limits and representative semantic quality remain
  unverified beyond the two live end-to-end checkpoints below. Uploaded CV
  acceptance requires technical correctness only; semantic quality is not an
  acceptance blocker for it.
- Operational risk: an earlier Uploaded CV checkpoint (request
  `89acc87d-4b98-4031-b3a9-0af397bfae1f`) failed with HTTP 500 when the F03
  batch call hit the 90-second CCPro client timeout
  (`APIConnectionTimeoutError`, stage `batch_inference`); the passing rerun's
  batch completed in about 48 seconds. The cause of the earlier timeout is
  unproven. No timeout, model, or batch-size change is required.

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
- Slice 05 carries the READY CV profile and per-Job F03 assessment into a
  deterministic AI Kit scorer that calls the unchanged V03 field and weighted
  calculators. Backend sorts by Match Score, rechecks each selected Job through
  the canonical Job Discovery public detail owner, excludes non-DISCOVERABLE
  Jobs, and returns up to 10 public Job DTOs with their mapped reasons via
  authenticated Candidate `POST /api/candidate/job-recommendations`. Results
  are runtime only; Vector Score is not returned or used for final ranking.

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
- Slice 05 focused AI Kit Vitest passed (3 files, 26 tests); focused Backend
  Vitest passed (4 files, 31 tests), including Candidate HTTP authentication,
  authorization, shared error handling, ranking, cap, reason mapping, and final
  visibility recheck. Targeted ESLint in both areas and Backend
  `npm run verify:architecture` passed. Full `verify:agent` gates, live provider
  calls, and Atlas calls were not run per this slice's focused verification
  limit. Final Acceptance and representative live quality remain unverified.
- Generated CV live end-to-end checkpoint: PASS. HTTP 200; retrieval returned
  50 Jobs; the batch held 12 Jobs in one generative inference; 10
  recommendations were returned with Match Score and reason.
- Uploaded CV live end-to-end checkpoint on 2026-10-25: PASS. Request
  `b2158abd-2b0e-4ff8-98f2-430d7ebba188`, HTTP 200 in about 61.9 seconds,
  against the `jobhub-dev` development Backend (CCPro `gpt-5.6-sol`). Fixture
  Candidate User `0207a7e0667687e65da04fc9` (seed `candidate-1`); Default CV
  `6ade1009a1a368ae3eff96b8` (`UPLOADED`, `ACTIVE`), created from
  `ai-kit/test/fixtures/ai-v02-standard-developer-synthetic.pdf` through the
  canonical upload and set-Default endpoints; the fixture's original Default
  CV is Generated CV `6addd1f774d982982464aea8`. V02 normalization was READY,
  inferred from retrieval proceeding. Retrieval returned 50 candidates and the
  F03 batch held 12 Jobs. Provider calls, one per use case: V02 normalization
  1 call (2,033 tokens) and F03 batch assessment 1 call (8,980 tokens). The
  response `{ recommendations }` held 10 items, each with `job`, `matchScore`,
  and `reason`. A read-only recheck through `resolveJobDiscoveryVisibility`
  found all 5 sampled Jobs (of the 10 returned) `PUBLISHED` and
  `DISCOVERABLE`. Semantic quality was
  not assessed. No full gate was run.
