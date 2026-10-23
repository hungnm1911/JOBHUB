# AI-V03 Job–CV Matching & Scoring Project Status

## Current project state

AI-V03 Slice 1 (F03 Deterministic Field Assessment; BR-AI-29/30/31) is
**implemented and verified offline** as an internal AI Kit scorer. It computes
Career Category, Experience Level, Employment Type, and Work Mode scores from
READY `JobMatchProfile` and `CVMatchProfile` metadata, including sparse fields.
It creates no persisted data and has no Backend consumer yet. AI-V03 Final
Acceptance is **not started**.

## Deferred / not started

Semantic Skills Assessment, Skills aggregation, weighted Match Score, complete
Match Result, Backend integration, and AI-V03 evaluation remain deferred. The
F03 scorer is internal until approved orchestration consumes it.

## Implementation record (slice detail)

- **2026-10-24 — Slice 1:** `ai-kit/src/matching/deterministic-field-scoring.js`
  uses canonical category identity and FIELD–POSITION ancestry, the shared
  Experience Level order, and exact canonical Employment Type and Work Mode
  comparisons. Focused unit tests cover all four score tables, multiple Job
  categories, sparse metadata, and Generated/Uploaded CV metadata. The
  normalization profiles and Backend integration were not changed.

## Verification status

- **2026-10-24 — Slice 1:** `cd ai-kit && npx vitest run
  test/deterministic-field-scoring.test.js` passed (1 file, 19 tests).
  `cd ai-kit && npm run verify:agent` passed (ESLint; 22 files, 388 tests).
  No live provider smoke was run. Backend verification was not run because
  Backend code and integration were unchanged.
