# AI-V04 CV Evaluation & Improvement Project Status

## Current project state

AI-V04 F01 (BR-AI-01–07) is **implemented** in AI Kit and through the
authenticated Candidate Backend HTTP entry. The use case prepares an authorized
Job/CV pair, returns the total score, summary, five scored field reviews and CV
improvements, and does not persist the result. One structured-output inference
provides semantic assessment and feedback; the V03 calculators determine the
scores. The supplied 2026-10-25 Product decision accepts **Product/Functional
behavior** based on implementation, focused tests and H1/H2/H3 live evidence.
The [acceptance report](../../evaluation/ai-kit/ai-v04-final-acceptance-evaluation.md)
records the case outcomes and their limits. **Official Engineering Verification
is INCOMPLETE:** the Backend full gate has not completed and must not be
reported as passed.

## Deferred / not started

No approved AI-V04 functional slice remains deferred. Frontend integration is
outside the implemented Candidate HTTP use case. The recorded live cases do not
establish repeatable semantic scores across inferences or provider-wide quality.
The official Backend full gate remains outstanding.

## Implementation record (slice detail)

- **AI Kit:** `ai-kit/src/evaluation/cv-evaluation.js` owns V04 inference,
  feedback validation, section/item references and result composition. It
  reuses V03 source/rubric validation and deterministic/weighted scoring, plus
  the shared Generated/Uploaded CV career read view. V03 `matchJobCv` remains
  independent.
- **Backend:** The Candidate HTTP entry uses existing authorized Job/CV profile
  preparation and calls AI Kit `evaluateCv`. Results remain runtime-only.

## Verification status

- **2026-10-25 — Final Acceptance evidence:** H1 returned HTTP 200, Match Score
  60; H2 regression returned HTTP 200, Match Score 52.3333; H3 final returned
  HTTP 200, Match Score 79.2, with Kubernetes `CONFLICT` at 0 and a valid
  `NO_EVIDENCE` association. These are the supplied live outcomes
  summarized in the [acceptance report](../../evaluation/ai-kit/ai-v04-final-acceptance-evaluation.md).
  Semantic scores varied between inferences; the deterministic calculator
  continued to apply the supplied semantic assessment and field scores
  correctly. Existing AI Kit and Backend focused tests were reported PASS;
  this documentation closure did not rerun them or a provider call.
- **2026-10-24 — Earlier AI Kit gate:** Focused Vitest passed (4 files, 57
  tests) and targeted ESLint passed. `cd ai-kit && npm run verify:agent` passed
  for Slice 1 (ESLint; 27 files, 451 tests). This earlier gate does not verify
  the later Backend integration or the final live cases. **The official Backend
  full gate is INCOMPLETE; no official Backend PASS is claimed.**
