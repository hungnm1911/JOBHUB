# AI-V06 Final Acceptance Evaluation

**Review date:** 2026-10-26. **Product Owner decision:** Final Acceptance
`ACCEPTED` with the LLM quality limits below. This closes the Backend/AI Kit
business phase, not the Frontend integration or official full-gate verification.
The decision was supplied in the acceptance request; no separate PO decision
record is present in the repository.

This report evaluates the existing evidence against the approved
[AI-V06 Product Specification](../../product/ai-kit/versions/v06-job-targeted-cv-optimization.md)
§§10–11, 16.2 and 20, the
[AI-V06 Data Contract](../../data/ai-kit/versions/v06-job-targeted-cv-optimization.md),
and the Backend V7 CandidateCV lifecycle. It does not change those contracts
or add a runtime quality gate. Slice verification details remain in the
[AI-V06 status leaf](../../project-status/ai-kit/v06-job-targeted-cv-optimization.md).

## Existing evidence reviewed

| Evidence | Observed result | Limit |
|---|---|---|
| Slices 01–03 | Focused AI Kit output-contract, inference and fallback tests plus targeted ESLint passed as recorded in the status leaf. All-null valid output and exhausted/invalid-provider failures have offline coverage. | No V06 official AI Kit gate or live Gemini/Groq fallback. |
| Slices 04–08 and H1 fix | Focused Backend baseline, authorized source snapshot, merge/persistence and Candidate HTTP tests passed as recorded in the status leaf. Slice 08 covers V06 Draft → V7 edit → Preview, authorization, input rejection and technical failures. | No V06 official Backend full gate. Provider responses in focused tests are mocked. |
| Generated V04 → V06 live | Existing `tmp/generated-v04-meta.json` records V04 HTTP 200, valid V06-compatible evaluation and Match Score 62.5. `tmp/09b2-http-meta.json` records V06 HTTP 201. `tmp/09b2-verification-summary.json` matches accepted output, merge, persisted Draft and HTTP detail across all seven sections; fixed fields stayed intact, the Source CV was unchanged, and V7 detail/Preview returned 200 with a PDF. | One Codex run on one source/Job pair; no broader semantic guarantee. |
| Uploaded V04 → V06 live | `tmp/09b3-verification-summary.json` records V04 HTTP 200, READY Uploaded normalization, same PDF identity and valid evaluation with Match Score 80.8333. `tmp/09b3b-verification-summary.json` records V06 HTTP 201 using that V04 result and the same PDF; output, merge, persisted Draft and V7 owner detail matched, Source CV stayed unchanged, and Preview returned 200 with a PDF. | One Codex run; semantic limits are listed below. |

The detailed captures are ignored local diagnostics under `tmp/`; the generated
Preview PDF also exists under `/tmp/jobhub-ai-v06-09b0-NQA2Lv/captures/`.
These paths identify existing evidence, not tracked or portable artifacts.
The capture summaries and focused test records were inspected for this review;
no provider call, test suite or full gate was repeated.

## Requirement coverage

`Verified` means the stated behavior has focused offline evidence and, where
listed, representative live evidence. `Partially verified` marks a specific
unobserved surface or semantic limit. `Unverified` is never inferred from a
different provider's success.

| Requirement | Coverage | Evidence and boundary |
|---|---|---|
| F01; BR-AI-01, BR-AI-02, BR-AI-08 | **Partially verified** | Candidate HTTP action, selected Job/CV identity, ownership and visibility rejection have focused coverage; both live actions were authenticated requests. Frontend entry after V04 is not implemented or verified. |
| F02; BR-AI-04 | **Verified** | Generated baseline and fixed-field preservation have focused and Generated live evidence. |
| F02; BR-AI-05 | **Partially verified** | Uploaded READY profile conversion, Candidate profile fields and sparse baseline have focused coverage and one same-PDF live case. Extraction varies across runs; broader conversion quality is not established. |
| F03; BR-AI-03, BR-AI-06 | **Verified** | Seven-section contract, allowed-section merge, one new persisted Generated `DRAFT`, non-default state and unchanged Source CV have focused and both live-case evidence. |
| F03; BR-AI-07 | **Partially verified** | Completed contract-valid Codex results formed both live Drafts; all-null acceptance and invalid-output fallback have focused offline coverage. Live semantic usefulness is bounded by the quality findings below. |
| F03; BR-AI-09 | **Partially verified** | Focused tests distinguish provider, dependency and persistence failure from successful business results and exercise Codex → Gemini → Groq fallback. Live fallback is **unverified**. |
| F04; BR-AI-10 | **Partially verified** | Both live Drafts were read and Previewed through V7 with HTTP 200/PDF; focused HTTP tests cover edit → Preview and unchanged Draft lifecycle. Live edit and Frontend interaction were not observed. |

### Unverified checks

| Cross-cutting check | Coverage | Boundary |
|---|---|---|
| Live Gemini/Groq and provider fallback | **Unverified** | Codex success and mocked fallback tests do not prove a live secondary-provider attempt. |
| V06 official Backend and AI Kit full gates | **Unverified** | Slice records contain focused passes, without a V06 official full-gate run. |
| Frontend V04 → V06 interaction | **Unverified** | Frontend implementation remains outside this Backend/AI Kit closure. |

The matrix covers BR-AI-01–10 without treating a one-case smoke as provider-wide
verification. For §16.2 and §20 DoD, both source types, valid output → Draft,
source immutability, permitted action, ownership, Draft lifecycle and Preview
have representative evidence. Technical failure/fallback has focused offline
evidence; live fallback remains unverified. Quality was reviewed on both live
paths and accepted by the Product Owner with the limitations below. The
Backend/AI Kit business DoD is therefore **accepted with limits**; official
engineering gate status remains **`INCOMPLETE / NOT RUN`** for V06. Frontend
integration is outside this closure.

## Accepted quality backlog — later LLM Optimization phase

These are quality findings, not added V06 runtime rejection rules. Product
§§9.4, 9.5 and BR-AI-07 explicitly separate semantic review from accepting a
completed, contract-valid result.

1. **Uploaded summary overstatement.** The live Draft says “API testing
   experience”; the PDF supports API Testing knowledge/skill, without an
   explicit API testing task or outcome. `tmp/09b3b-content-audit.json` also
   notes that “Developer” is broader than the PDF's manual-testing career
   positioning and that one testing project lacks its academic label. Tighten
   claim-strength wording and retain Candidate review before use.
2. **V02 extraction variability.** The same Uploaded PDF yielded 16 individual
   skill claims for the prior V04 run and four grouped skill lines for the V06
   run (`tmp/09b3-verification-summary.json` and
   `tmp/09b3b-verification-summary.json`). Compare normalization stability and
   grouping utility before changing V02 semantics.
3. **Express.js semantic score calibration.** The Uploaded V04 advisory treats
   Express.js as implied by MERN rather than explicitly named in the PDF.
   Review how inferred stack components affect semantic scores and advice;
   this acceptance does not change the V03/V04 scoring policy or recalculate
   the observed 80.8333 score.
4. **Redundant sections and inference/context efficiency.** The Generated
   V06 capture returned non-null replacements for sections that did not
   materially change. Review output economy and the V02 → V04 → V06 context
   size/cost while preserving the seven-section contract and required source
   evidence. No performance or token-budget threshold is introduced here.

## Architecture review and remaining verification

No Critical or High finding was identified in the reviewed V06 owner chain,
Product/Data boundaries, focused tests and representative captures. The
Uploaded overstatement is a **non-blocking Medium quality finding** under the
approved quality guidance and PO decision. A **Low documentation finding**
was stale Engineering “current state/deferred” text saying Slices 04–08 were
unconnected; it was corrected during closure. There is no evidence of a second
CandidateCV writer, a new persisted AI artifact, Source CV mutation, automatic
activation/default/apply, or a semantic rejection gate in the reviewed path.

Live Gemini/Groq attempts, live fallback, official V06 full gates, broad LLM
quality stability and the Frontend flow remain unverified. The Product Owner's
`ACCEPTED` decision includes these limits and does not declare those checks
passed. Diagnostic scripts, one-call locks, PDF captures and the credential
file under `/tmp/jobhub-ai-v06-09b0-NQA2Lv/` were retained: they are outside
version control, and their exact evidence/credential boundary was not suitable
for deletion in this documentation-only closure.
