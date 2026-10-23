# AI-V03 Job–CV Matching & Scoring Project Status

## Current project state

AI-V03 Slices 1–4 (F01 Match Result orchestration, F02 Semantic Skills
Assessment, F03 Deterministic Field Assessment, and F04 Skills Aggregation &
Weighted Score; BR-AI-23–34) are **implemented and verified offline** in AI Kit.
The `createAiKit` instance exposes `matchJobCv` for one pair of READY Job/CV
normalization results. It returns both source identities, the overall score,
five field scores, weights, and contributions after one semantic inference.
There is no persisted data or Backend consumer yet. AI-V03 Final Acceptance is
**not started**.

## Deferred / not started

Backend integration, live-provider acceptance, and AI-V03 semantic-quality
evaluation remain deferred. F02/F03/F04 remain internal owners consumed by
the F01 orchestration.

## Implementation record (slice detail)

- **2026-10-24 — Slice 4:** `ai-kit/src/matching/match-result-orchestration.js`
  composes the existing F02/F03/F04 owners into a runtime Match Result exposed
  as `createAiKit(...).matchJobCv`. It requires both normalization results to
  be READY, accepts sparse READY profiles, retains fixed weights, and
  propagates provider or invalid-assessment failures instead of returning a
  business score. Backend authorization and integration are not
  part of this slice.
- **2026-10-24 — Slice 3:** `ai-kit/src/matching/semantic-skills-assessment.js`
  sends relevant Job and CV career sources (including existing PDF excerpts)
  to one explicitly selected provider, validates completion and rubric output, prevents
  duplicate structured-skill counting, and restores source provenance. It
  returns `requirementGroups` for the existing F04 calculator. No package-root
  entry, persistence, or Backend integration was added.
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

- **2026-10-24 — S4-F01 acceptance fix:** `cd ai-kit && npx vitest run
  test/match-result-orchestration.test.js test/index.test.js
  test/v01-normalization-public-api.test.js` passed (3 files, 43 tests).
  `cd ai-kit && npm run verify:agent` passed (ESLint; 25 files, 431 tests).
  Regression coverage rejects non-READY and profile-only inputs before provider
  inference; sparse READY inputs still produce a Match Result. Provider calls
  were mocked; no live smoke was run.
- **2026-10-24 — Slice 4:** `cd ai-kit && npx vitest run
  test/match-result-orchestration.test.js test/index.test.js
  test/v01-normalization-public-api.test.js` passed (3 files, 36 tests) before
  the final invalid-completion case; `cd ai-kit && npm run verify:agent`
  passed after it (ESLint; 25 files, 425 tests). All provider responses were
  mocked; no live provider smoke was run. Backend lint and architecture checks
  passed; the full Backend test run was interrupted after widespread
  `mongodb-memory-server` startup failures. The focused Backend AI Kit
  integration test and ESLint check passed after its public-instance assertion
  was updated. `git diff --check` passed after the status edit.
- **2026-10-24 — Slice 3:** `cd ai-kit && npx vitest run
  test/semantic-skills-assessment.test.js` passed (1 file, 14 tests) before
  the final duplicate-source guard; `cd ai-kit && npm run verify:agent` passed
  after that guard (ESLint; 24 files, 414 tests). All provider responses were
  mocked; no live provider smoke or Backend verification was run.
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
