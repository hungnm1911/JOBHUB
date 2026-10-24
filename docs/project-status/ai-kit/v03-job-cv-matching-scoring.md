# AI-V03 Job–CV Matching & Scoring Project Status

## Current project state

AI-V03 Slices 1–4 (F01 Match Result orchestration, F02 Semantic Skills
Assessment, F03 Deterministic Field Assessment, and F04 Skills Aggregation &
Weighted Score; BR-AI-23–34) are **implemented and verified offline** in AI Kit.
The `createAiKit` instance exposes `matchJobCv` for one pair of READY Job/CV
normalization results. It returns both source identities, the overall score,
five field scores, weights, and contributions after one semantic inference.
Slice 5 adds the Candidate Backend HTTP entry for F01, with V8 Job visibility,
own active CandidateCV access, and V01/V02 normalization reuse. Focused Backend
tests now cover real Uploaded CV normalization through the HTTP Match Result,
sparse READY input, and provider failure. The common Backend gate has passed.
G2B-D02 full-payload runtime debug logging is removed and verified offline.
FA-L01 raw provider error logging remediation is verified offline at the three
provider adapters and the Backend final HTTP error handler; two residual
logging deviations were accepted by the Product Owner for this version.
There is no persisted Match Result. The Product Owner approved AI-V03 Final
Acceptance as **`ACCEPTED`** on 2026-10-24 after reviewing the offline gates,
Gate 2B and representative live semantic evaluation (S1, S4/S5, S6), with the
two FA-L01 deviations recorded below and in the
[evaluation report](../../evaluation/ai-kit/ai-v03-final-acceptance-evaluation.md).

## Deferred / not started

No approved AI-V03 slice remains deferred. F02/F03/F04 remain internal owners
consumed by the F01 orchestration. The
representative evaluation is scoped to the recorded cases; it does not establish
provider-wide or production-scale semantic accuracy.

## Accepted deviations

The Product Owner confirmed both decisions in discussion on 2026-10-24; no
separate decision document exists in the repository. Each is **`ACCEPTED —
NON-BLOCKING` for AI-V03 Final Acceptance only**:

- **FA-L01, original High — unrecognized provider error code in logs.** The
  bounded metadata filter can still admit an unrecognized `error.code` string,
  such as `PRIVATE_JOB_CV_RESPONSE_MARKER`, into application logs. This is a
  potential logging/privacy risk against the
  [AI Kit logging convention](../../engineering/ai-kit-conventions.md#logging-and-sensitive-data),
  with no observed impact on Matching behavior, score, provider inference, or
  demo performance. The Product Owner did not require an additional whitelist
  or further AI-V03 hardening.
- **FA-L01, original Medium — missing throw-site stack in HTTP 4xx logs.** The
  Backend final error handler logs normalized metadata without the full
  throw-site stack expected by the
  [Backend error-handling/logging convention](../../engineering/backend-conventions.md#error-handling).
  This reduces debugging detail without changing HTTP handling, business
  behavior, Matching Score, or demo performance. The Product Owner did not
  require further AI-V03 remediation.

These decisions do not amend Engineering Conventions or set a precedent for
later versions. G2B-S01, G2B-D01/D02, FA-S01, and the related semantic HTTP
500 findings were corrected and checked before acceptance; they are not
accepted deviations. Representative coverage and the lack of equivalent live
Gemini/Groq semantic evaluation are verification limits, not deviations.

## Implementation record (slice detail)

- **2026-10-24 — Slice 5:** `POST /api/candidate/jobs/:jobId/match` accepts one
  own CandidateCV ID, checks Candidate ownership and V8 Job visibility,
  normalizes the persisted Job and Generated or Uploaded CV through existing
  owners, and passes only READY profiles to `aiKit.matchJobCv`. Historical
  read-only Jobs and own private Generated Drafts remain eligible under their
  existing access rules. No scoring or persistence was added to Backend.
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

- **2026-10-24 — Final Acceptance closure:** Product Owner verdict `ACCEPTED`.
  The [evaluation report](../../evaluation/ai-kit/ai-v03-final-acceptance-evaluation.md)
  consolidates the existing AI Kit and Backend offline gates, Gate 2B findings,
  `FA-L01`, and representative live S1, S4/S5 (including the `FA-S01` recheck),
  and S6 evidence. The initial S4/S5 source-association failure was corrected
  and rechecked. The Product Owner accepted exactly two residual FA-L01
  logging deviations as non-blocking on 2026-10-24. No test or provider call
  was rerun for this documentation-only status update.
- **2026-10-24 — FA-L01:** Synthetic provider errors carrying private markers
  failed the adapter and HTTP log regression checks before the fix, then passed
  after metadata-only logging. Focused tests passed (AI Kit: 3 files, 9 tests;
  Backend: 2 files, 16 tests), including HTTP provider failure without a Match
  Result. `cd ai-kit && npm run verify:agent` passed (ESLint; 26 files, 438
  tests). `cd backend && npm run verify:agent` passed (ESLint with two existing
  warnings; ARCH-001–019; 187 files, 1982 tests). No live provider was called.
- **2026-10-24 — G2B-D02:** Removed the development semantic-assessment
  diagnostic callback and Backend application-logger sink. A focused Backend
  composition regression failed before the fix because the sink was injected,
  then passed after removal. Focused AI Kit semantic/schema/orchestration tests
  passed (4 files, 47 tests). `cd ai-kit && npm run verify:agent` passed
  (ESLint; 26 files, 438 tests). `cd backend && npm run verify:agent` passed
  (ESLint with two existing warnings; ARCH-001–019; 187 files, 1982 tests).
  Provider responses were mocked in focused tests; no live provider was called.
- **2026-10-24 — S5-T01 acceptance coverage:** With `TMPDIR` on the workspace
  disk, `npx vitest run test/candidate/ai-v03-slice-5-candidate-match.test.js
  test/candidate/ai-v02-slice-4c-uploaded-cv-runtime.test.js --maxWorkers=1
  --silent` passed (2 files, 17 tests). The V03 HTTP suite uses the real V02
  Uploaded CV normalizer, real PDF text extraction, and real Matching with
  mocked storage download and provider responses. It also covers sparse READY
  and provider failure without a Match Result. Targeted ESLint passed. The
  initial test attempt without alternate `TMPDIR` failed at MongoDB startup
  because `/tmp` was full. No live provider or full Backend gate was run.
- **2026-10-24 — Slice 5:** Focused Backend command `npx vitest run
  test/candidate/ai-v03-slice-5-candidate-match.test.js
  test/job/v8-job-discovery.test.js test/job/ai-v01-b1-job-normalization.test.js`
  passed (3 files, 69 tests) with offline AI Kit mocks. The AI Kit official
  `npm run verify:agent` gate passed (25 files, 431 tests). Backend lint passed
  with two existing warnings and architecture verification passed ARCH-001–019.
  The default Backend full gate failed when `/tmp` filled during parallel
  MongoDB test startup; its retry with an alternate `TMPDIR` was stopped at the
  user's request before completion. No live provider smoke was run.
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
