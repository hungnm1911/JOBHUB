# AI-V05 Candidate Job Recommendation Project Status

## Current project state

AI-V05 Product Specification and Data Contract are **APPROVED**. Slice 01 — Job
Embedding Foundation (F02 support) is implemented and verified with focused
offline tests: READY JobMatchProfile formatting, optional Job `embeddingText`,
best-effort sync after publish, and explicit reconciliation. Final Acceptance
is not started.

## Deferred / not started

- Atlas Vector Search Index, query embedding, recommendation orchestration,
  and Candidate HTTP delivery remain deferred.
- Atlas P1 evidence, index configuration, embedding model compatibility, and
  live provider behavior remain unverified.

## Implementation record (slice detail)

- Slice 01 reuses AI-V01 Job normalization after the canonical publish transition.
  The formatter includes Title, resolved FIELD/POSITION names, Required Skills,
  Description, and a descriptive ExperienceLevel label. Derived write failure
  leaves the Job published and can be repaired with
  `cd backend && npm run reconcile:job-embedding-text`. Draft edits do not
  trigger embedding work.

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
- No Atlas Index, provider call, or live integration test was run.
