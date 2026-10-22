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

AI-V01 is the only approved AI Kit business version. Approval establishes
Product/Data authority; it does not itself establish implementation or Final
Acceptance. Implementation and verification evidence, including resolved
Final Acceptance H1/H2/H3 findings, is recorded in the
[AI Kit status leaf](../../project-status/ai-kit/foundation.md).
Public Job access, Uploaded CV processing, HTTP integration, Job/CV CRUD hooks,
and AI-specific persistence remain deferred/outside this runtime scope.

AI-V02 and AI-V03 are not approved by this roadmap. AI #1, AI #2, and AI #3 in
Engineering architecture remain direction only and do not independently
approve another version, scope, Product Specification, or Data Contract.
