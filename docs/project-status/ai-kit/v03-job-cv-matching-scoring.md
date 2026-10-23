# AI-V03 Job–CV Matching & Scoring Project Status

## Current project state

AI-V03 Slices 1 and 2 (F03 Deterministic Field Assessment and F04 Skills
Aggregation & Weighted Score; BR-AI-28/29/30/31/32) are **implemented and
verified offline** as internal AI Kit scorers. F04 consumes grouped Skills
Assessment scores and the four F03 field scores to calculate Skills Score,
Match Score, weights, and contributions. There is no persisted data or Backend
consumer yet. AI-V03 Final Acceptance is **not started**.

## Deferred / not started

Semantic Skills Assessment, complete Match Result orchestration, Backend
integration, and AI-V03 evaluation remain deferred. The F03/F04 scorers are
internal until approved orchestration consumes them.

## Implementation record (slice detail)

- **2026-10-24 — Slice 1:** `ai-kit/src/matching/deterministic-field-scoring.js`
  uses canonical category identity and FIELD–POSITION ancestry, the shared
  Experience Level order, and exact canonical Employment Type and Work Mode
  comparisons. Focused unit tests cover all four score tables, multiple Job
  categories, sparse metadata, and Generated/Uploaded CV metadata. The
  normalization profiles and Backend integration were not changed.
- **2026-10-24 — Slice 2:** `ai-kit/src/matching/weighted-match-scoring.js`
  averages one semantic score per grouped requirement within each priority
  group, applies 80/20 or full weight for the only populated group, then applies
  fixed 40/25/25/5/5 field weights. It exposes field contributions for the
  runtime breakdown. Focused tests use mock assessment only. No provider,
  persistence, or Backend integration was added.

## Verification status

- **2026-10-24 — Slice 2:** `cd ai-kit && npx vitest run
  test/weighted-match-scoring.test.js` passed (1 file, 10 tests); the final
  suite, including the added group-size case, passed under
  `cd ai-kit && npm run verify:agent` (ESLint; 23 files, 399 tests). No live
  provider smoke was run. Backend verification was not run because Backend code
  and integration were unchanged.
- **2026-10-24 — Slice 1:** `cd ai-kit && npx vitest run
  test/deterministic-field-scoring.test.js` passed (1 file, 19 tests).
  `cd ai-kit && npm run verify:agent` passed (ESLint; 22 files, 388 tests).
  No live provider smoke was run. Backend verification was not run because
  Backend code and integration were unchanged.
