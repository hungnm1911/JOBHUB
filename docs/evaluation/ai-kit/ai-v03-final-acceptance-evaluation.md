# AI-V03 Final Acceptance Evaluation

**Review date:** 2026-10-24. **Product Owner decision:** `ACCEPTED`, confirmed
in discussion on 2026-10-24. There is no separate decision document in the
repository.

This report records the existing offline verification and representative live
semantic evaluation for [AI-V03 §16–§20](../../product/ai-kit/versions/v03-job-cv-matching-scoring.md).
It is acceptance evidence, not a new Product Rule, runtime gate, output schema,
or change to the approved scope. The matching data remains runtime-only under
the [AI-V03 Data Contract](../../data/ai-kit/versions/v03-job-cv-matching-scoring.md).

## Offline verification and Gate 2B

- AI Kit F01–F04 and the Candidate Backend HTTP entry were verified offline.
  The [AI-V03 status leaf](../../project-status/ai-kit/v03-job-cv-matching-scoring.md)
  records focused checks and the official gates for each slice.
- Gate 2B finding `G2B-D02` removed full-payload semantic-assessment runtime
  debug logging. Its focused checks and both official offline gates passed.
- The Product Owner confirmed that `G2B-S01` (evidence-state enum and
  prompt/schema alignment) and `G2B-D01` (runtime debug artifact removal) were
  corrected and checked before Final Acceptance. They are not deviations.
- Final Acceptance finding `FA-L01` removed raw provider error content from
  provider-adapter and final HTTP error logs. That remediation's focused checks
  and both official offline gates passed: AI Kit ESLint and 438 tests in 26 files;
  Backend ESLint (two existing warnings), ARCH-001–019, and 1,982 tests in
  187 files. These are previously recorded runs, not reruns for this report.
- The offline suites exercise output contracts, source/rubric guards,
  deterministic score tables, weighting, HTTP authorization, sparse READY
  input, and failure propagation with mocked provider responses. They do not
  establish live semantic quality.

## Representative live semantic evaluation

The case captures are local, ignored diagnostic artifacts under
`ai-kit/.smoke-output/ai-v03-representative-2026-10-24/`; this report keeps
only the review summary in version control. The S1 and S4/S5 expected ledger
was prepared before the provider calls. The S1 and S4/S5 captures include the
provider output before runtime validation, so the source-association failure
can be distinguished from a provider transport or JSON-shape failure.

| Case | Observed live result | Semantic review |
|---|---|---|
| S1 — supported mixed-priority skills | One completed provider call; HTTP 200; PostgreSQL/Postgres `REQUIRED`, React `PREFERRED`, and Docker `UNSPECIFIED` each scored 100 with source IDs; Skills and Match Score 100. | Matches the prewritten ledger: equivalent wording was merged once, required priority won, and CV evidence was associated with each requirement. |
| S4/S5 — explicit mismatch and unresolved conflict, initial capture | One completed provider call; HTTP 500 without a Match Result. The pre-validation output correctly marked production React `MISMATCH` at 0 and Python years `CONFLICT` at 0, but omitted structured Job source `J1` when merging Python with the JD. | This was a source-association finding in the initial run, not a provider transport failure or an accepted final output. |
| S4/S5 — `FA-S01` live recheck | One completed provider call; HTTP 200; React stayed `MISMATCH` at 0, Python stayed `CONFLICT` at 0, and Python included both `J1` and `JD`. Skills Score 0; Match Score 60 from the four deterministic fields. | Satisfies the ledger and preserves the distinction between evidence of nonmatch and contradictory evidence. The focused regression for the source-association guard is recorded in `ai-kit/test/semantic-skills-assessment.test.js`. |
| S6 — related skill without a literal claim | Both synthetic normalization profiles were READY; the CV asserted JavaScript, with no TypeScript claim. One completed provider call returned TypeScript `PARTIAL` at 40 using associated JavaScript career sources. Skills Score 40; Match Score 76. | The 40-point judgment represents transferable foundation under the approved rubric; it does not assert that the CV proves TypeScript experience. This is a bounded semantic judgment from one live case. |

S1, S4/S5, and S6 exercise the recorded representative paths. S1's Docker
result differs from a unit fixture but fits its actual live source evidence.
Other §16.1 branches retain their offline evidence. The two semantic HTTP 500
findings were handled before acceptance, including the S4/S5 `FA-S01` recheck.

## Accepted deviations — FA-L01

The Product Owner accepted exactly these two remaining FA-L01 deviations as
**`ACCEPTED — NON-BLOCKING`** for AI-V03 Final Acceptance, based on the demo
scope and lack of observed impact on the matching use case:

| Finding | Original severity and governing convention | Remaining behavior | Acceptance rationale and action |
|---|---|---|---|
| Unrecognized provider error code in logs | High; [AI Kit logging and sensitive-data convention](../../engineering/ai-kit-conventions.md#logging-and-sensitive-data) | The bounded metadata filter can pass an unrecognized `error.code`, such as `PRIVATE_JOB_CV_RESPONSE_MARKER`, into application logs. | Potential privacy/logging risk; no observed impact on Matching behavior, score, provider inference, or demo performance. No additional whitelist or AI-V03 hardening required. |
| Missing throw-site stack in HTTP 4xx logs | Medium; [Backend error-handling/logging convention](../../engineering/backend-conventions.md#error-handling) | The final HTTP error handler records normalized metadata without the full throw-site stack. | Less debugging detail; HTTP handling, business behavior, score, and demo performance are unaffected. No further AI-V03 remediation required. |

These are the Product Owner's 2026-10-24 decisions from discussion, not a
separate decision document. They do not change or cancel the Engineering
Conventions and set no automatic precedent for AI-V04, AI-V05, or later work.
The repaired G2B findings and `FA-S01` are not accepted deviations.

## Verification limits and scope

Gemini and Groq have offline compatibility evidence, but no equivalent live
semantic evaluation to these Codex cases. Representative cases do not measure
statistical accuracy or production-scale stability. S6's JavaScript-to-
TypeScript `PARTIAL` score is a semantic judgment within the approved rubric,
not a claim that the CV proves TypeScript experience. These are verification
limits, not accepted deviations. Match Result history and a full assessment in
the HTTP response are outside the approved AI-V03 scope.

No new completeness threshold, hard score gate, persistence, retry policy,
provider-wide guarantee, or future-version contract follows from this
acceptance. Strict provider-native output constrained the declared schema;
runtime validation and the live source/evidence review supplied separate
checks. The Product Owner's `ACCEPTED` verdict is project acceptance, not a
new runtime state.

No tests, full verification gates, or provider calls were repeated while
preparing this documentation.
