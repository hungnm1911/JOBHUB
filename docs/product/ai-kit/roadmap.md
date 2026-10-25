# JOBHUB AI Kit Product Roadmap

## Purpose

This document is the roadmap authority for JOBHUB AI Kit business versions and
their scope. Approved AI Kit Product Specifications belong under
`docs/product/ai-kit/versions/`, and approved AI Kit Data Contracts belong under
`docs/data/ai-kit/versions/`.

This roadmap and `docs/product/backend/roadmap.md` have no parent-child approval
relationship. The Backend roadmap is not a portfolio approval gate for AI Kit
versions. AI Kit capabilities must still preserve JOBHUB Backend domain
boundaries and canonical data semantics.

## Current state

### AI-V01 — Job/CV Normalization

- **Product/Data approval status:** `APPROVED`
- **Implementation status:** `IMPLEMENTED — VERIFIED OFFLINE` (F01/F02 and
  Backend B1 internal Job / B2 own Generated CV runtime consumers)
- **Final Acceptance status:** `PENDING RECHECK — NOT APPROVED`; AI-V01 is
  not declared `COMPLETE`.
- **Functional requirements:** `F01`, `F02`
- **Business rules:** `BR-AI-01` through `BR-AI-14`
- **Canonical Product Specification:**
  [`versions/v01-job-cv-normalization.md`](versions/v01-job-cv-normalization.md)
- **Canonical Data Contract:**
  [`../../data/ai-kit/versions/ai-v01-job-cv-normalization-data-model.md`](../../data/ai-kit/versions/ai-v01-job-cv-normalization-data-model.md)

AI-V01 is an approved AI Kit business version. Approval establishes
Product/Data authority; it does not itself establish implementation or Final
Acceptance. Implementation and verification evidence, including resolved
Final Acceptance H1/H2/H3 findings, is recorded in the
[AI-V01 status leaf](../../project-status/ai-kit/v01-job-cv-normalization.md).
Public Job access, Uploaded CV processing, HTTP integration, Job/CV CRUD hooks,
and AI-specific persistence remain deferred/outside this runtime scope.

### AI-V02 — Uploaded CV Normalization

- **Product/Data approval status:** `APPROVED` (F01, BR-AI-15–BR-AI-22,
  baseline decisions D1–D4)
- **Implementation status:** See the [AI-V02 project-status leaf](../../project-status/ai-kit/v02-uploaded-cv-normalization.md)
- **Final Acceptance status:** `ACCEPTED` (2026-10-23; documented semantic
  limitations retained in the [AI-V02 project-status leaf](../../project-status/ai-kit/v02-uploaded-cv-normalization.md))
- **Functional requirements:** `F01`
- **Business rules:** `BR-AI-15` through `BR-AI-22`
- **Canonical Product Specification:**
  [`versions/v02-uploaded-cv-normalization.md`](versions/v02-uploaded-cv-normalization.md)
- **Canonical Data Contract:**
  [`../../data/ai-kit/versions/ai-v02-uploaded-cv-normalization-data-model.md`](../../data/ai-kit/versions/ai-v02-uploaded-cv-normalization-data-model.md)

The approved Product/Data Contract governs AI-V02; implementation verification
and Final Acceptance evidence are recorded in the linked status leaf and
[BR-AI-22 evaluation report](../../evaluation/ai-kit/ai-v02-br-ai-22-evaluation-report.md).

### AI-V03 — Job–CV Matching & Weighted Scoring

- **Product/Data approval status:** `APPROVED`
- **Implementation status:** `IMPLEMENTED — VERIFIED OFFLINE` (F01–F04 and
  Candidate Backend HTTP entry)
- **Final Acceptance status:** `ACCEPTED` (2026-10-24; representative live
  semantic evaluation and accepted deviations recorded in the linked status leaf)
- **Functional requirements:** `F01` through `F04`
- **Business rules:** `BR-AI-23` through `BR-AI-34`
- **Canonical Product Specification:**
  [`versions/v03-job-cv-matching-scoring.md`](versions/v03-job-cv-matching-scoring.md)
- **Canonical Data Contract:**
  [`../../data/ai-kit/versions/v03-job-cv-matching-scoring.md`](../../data/ai-kit/versions/v03-job-cv-matching-scoring.md)

AI-V03 implementation, offline verification, representative live evaluation,
and the Product Owner's Final Acceptance decision are recorded in the
[AI-V03 status leaf](../../project-status/ai-kit/v03-job-cv-matching-scoring.md).
AI #1, AI #2, and AI #3 in Engineering architecture remain direction only and
do not independently approve another version, scope, Product Specification, or
Data Contract.

### AI-V04 — CV Evaluation & Improvement

- **Product/Data approval status:** `APPROVED`
- **Implementation status:** `IMPLEMENTED` (AI Kit evaluation and Candidate
  Backend HTTP entry; focused tests passed per recorded evidence)
- **Final Acceptance status:** `ACCEPTED` for Product/Functional behavior
  (2026-10-25; focused regression, HTTP acceptance, H1/H2/H3). Product/Functional
  phase closed by the Product decision with the remaining verification risk accepted.
- **Official Engineering Verification:** `INCOMPLETE / NOT RUN` (V04 Backend full
  gate); no official Backend `PASS` or verified version `COMPLETE` claim.
- **Functional requirements:** `F01`
- **Business rules:** `BR-AI-01` through `BR-AI-07`
- **Canonical Product Specification:**
  [`versions/v04-cv-evaluation-improvement.md`](versions/v04-cv-evaluation-improvement.md)
- **Canonical Data Contract:**
  [`../../data/ai-kit/versions/v04-cv-evaluation-improvement.md`](../../data/ai-kit/versions/v04-cv-evaluation-improvement.md)

AI-V04 uses V01/V02 Match Profiles and V03 scoring for a CV evaluation with
feedback through the Candidate HTTP entry. The Product/Functional phase is
closed; official engineering closure remains unverified. Acceptance evidence
and the verification limit are recorded in the
[AI-V04 project-status leaf](../../project-status/ai-kit/v04-cv-evaluation-improvement.md).

### AI-V05 — Candidate Job Recommendation

- **Product/Data approval status:** `APPROVED` (Product/Data Decisions supplied for AI-V05)
- **Implementation status:** `NOT STARTED`
- **Final Acceptance status:** `NOT STARTED`
- **Functional requirements:** `F01` through `F04`
- **Business rules:** `BR-AI-01` through `BR-AI-19`
- **Canonical Product Specification:**
  [`versions/v05-candidate-job-recommendation.md`](versions/v05-candidate-job-recommendation.md)
- **Canonical Data Contract:**
  [`../../data/ai-kit/versions/v05-candidate-job-recommendation.md`](../../data/ai-kit/versions/v05-candidate-job-recommendation.md)

Approval establishes Product/Data authority, not implementation or Final
Acceptance. Current state and documentation alignment are recorded in the
[AI-V05 project-status leaf](../../project-status/ai-kit/v05-candidate-job-recommendation.md).
