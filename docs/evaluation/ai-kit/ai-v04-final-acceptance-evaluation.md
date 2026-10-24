# AI-V04 Final Acceptance Evaluation

**Review date:** 2026-10-25. **Product/Functional Acceptance:** `ACCEPTED`;
phase closed by the Product decision supplied in the Final Acceptance request.
The user accepts the remaining verification risk under the machine resource
limit and does not require the Backend full gate. **Official Engineering
Verification:** `INCOMPLETE / NOT RUN` for the V04 Backend full gate.

This report records the supplied acceptance outcomes against
[AI-V04 Product Specification §16–§20](../../product/ai-kit/versions/v04-cv-evaluation-improvement.md)
and the [AI-V04 Data Contract](../../data/ai-kit/versions/v04-cv-evaluation-improvement.md).
It records evidence and limits; it does not add a Product Rule, score threshold,
runtime validator or persistence requirement. Implementation state is in the
[AI-V04 status leaf](../../project-status/ai-kit/v04-cv-evaluation-improvement.md).

## Acceptance evidence

| Case | Supplied live outcome | Acceptance reading |
|---|---|---|
| H1 | HTTP 200; Match Score 60 | Successful end-to-end evaluation observed. |
| H2 regression | HTTP 200; Match Score 52.3333 | Regression request completed with a lower score; a lower score is a business result, not an HTTP failure. |
| H3 final | HTTP 200; Match Score 79.2; Kubernetes `CONFLICT` at 0; valid `NO_EVIDENCE` association | Conflict and absence of evidence remained distinct in the final result. |

The supplied evidence also reports PASS for the AI Kit and Backend focused tests
available for this work. The repository contains focused AI Kit evaluation and
Backend Candidate HTTP tests, including section targeting, source references,
score calculation, and error behavior. This closure did not rerun those tests or
the live provider, and the supplied H1/H2/H3 outcomes are not accompanied by
tracked raw captures or command logs here. Scores are recorded exactly as
supplied; no fresh precision or reproducibility claim is inferred.

## Behavior and interpretation

`sourceReference` locates the CV item to improve within the named section. It
is not a complete citation list for the comment. Evidence supporting a comment
can come from another CV item or section. When one improvement has no unique
target item, it remains section-level with `sourceReference: null`, or is split
into separate item-specific improvements. Target sections are selected from
the career content applicable to the evaluated Generated or Uploaded PDF CV;
an improvement for a section of the other CV type is omitted. These statements
align the [Product Specification](../../product/ai-kit/versions/v04-cv-evaluation-improvement.md)
and [Data Contract](../../data/ai-kit/versions/v04-cv-evaluation-improvement.md)
with the existing evaluation implementation and focused tests.

Semantic assessment can vary across provider inferences, so H1, H2 and H3 do
not establish a fixed semantic score for repeated calls. The deterministic
V03 field and weighted calculators continue to compute the score from each
accepted assessment; the observed score variation does not by itself show a
calculator defect. The recorded cases do not measure broader semantic accuracy
or provider-wide stability.

The reported H3 response contained four CV improvements with no rewrite text.
V04 now prompts for a concise, evidence-bound rewrite when useful, while allowing
`null` when a safe rewrite would require invented facts. A rewrite remains
advisory and the Candidate decides whether to use it. This prompt adjustment
has focused offline regression coverage; no live provider result after the
adjustment is recorded here.

## Verification limits and decision

The earlier AI Kit Slice 1 official gate passed (ESLint; 27 files, 451 tests),
as recorded in the [status leaf](../../project-status/ai-kit/v04-cv-evaluation-improvement.md).
Focused AI Kit and Backend tests are reported PASS in the supplied evidence,
without command transcripts in this report. The **V04 Backend official full
gate remains `INCOMPLETE / NOT RUN`**. No provider, focused suite or full
verification gate was run for this documentation closure.

AI-V04 Product/Functional Acceptance is **`ACCEPTED`** and that phase is closed
by the supplied Product decision. This acceptance includes the stated residual
verification risk. Official Engineering Verification remains **`INCOMPLETE /
NOT RUN`**; the repository's required official verification evidence is absent,
so this report does not claim official Backend `PASS` or verified version
`COMPLETE`.
