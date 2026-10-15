# Backend V9 Candidate Direct Apply Application Project Status

## Current project state

**V9 — Candidate chủ động Apply và tạo Application** has Slice 01 — Application
persistence foundation, Slice 02 — Direct Apply with Generated ACTIVE CV, Slice
03 — Direct Apply with Uploaded CV and upload-first flow, Slice 04 — Replace
current Submitted CV, and Slice 05 — Withdraw Application
`IMPLEMENTED AND VERIFIED` (F01, F02, F03 for Generated/Uploaded Apply plus
F03/F04 Replace boundary and F05 Withdraw boundary).
Its approved Product and Data contracts are
`docs/product/versions/v9-candidate-direct-apply-application.md` and
`docs/data/versions/v9-candidate-direct-apply-application-data-model.md`.
Slice 01 adds canonical Application persistence; Slice 02 adds authenticated
Candidate `POST /api/candidate/applications` with Generated ACTIVE CV
eligibility, Harvard snapshot capture/upload, and Candidate–Job uniqueness via
`PT-01`/`TX-01`; Slice 03 extends the same `directApplyToJob` workflow for own
non-archived Uploaded `ACTIVE` CVs (`PRIVATE`/`PUBLIC`), reuses canonical V7
Uploaded CV creation for upload-first Apply, and captures independent Uploaded
snapshot PDFs before Application commit; Slice 04 adds authenticated Candidate
`PUT /api/candidate/applications/:applicationId/submitted-cv` with APPLIED +
owner + Job eligibility + CV eligibility guards, whole-snapshot replacement,
version/CAS stale-write exclusion, and Generated/Uploaded cross-combination
replacement on the same snapshot architecture; Slice 05 adds authenticated
Candidate `POST /api/candidate/applications/:applicationId/withdraw` with
owner/APPLIED/revision-CAS guard, atomic `APPLIED → WITHDRAWN` mutation
(`status`, `withdrawnAt`, optional `withdrawReason`, `version + 1`), and stale
exclusion for concurrent Withdraw and Replace-vs-Withdraw from the same
revision. My Applications, Invitation, Notification, and other deferred-scope
modules remain not implemented by design; V9 Slice 06 Final Acceptance &
Regression Closure is completed and verified. V9 is `COMPLETED AND VERIFIED`.

## Deferred / not started

- **V9 deferred scope:** downstream pipeline states, My Applications,
  Invitation, Assigned Recruiter, Notification, Chat/Interview, and related
  history/snapshots remain out of implementation scope. V9 Slice 06 itself is
  completed and verified.

## Previously completed and verified baseline

- **Implemented; verified:** V9 Slice 05 — Withdraw Application (F05; BR-03,
  BR-12–BR-16, BR-32–BR-39, BR-42; PT-03; TX-03; TX-04): extends canonical
  `application.service.js` with `withdrawApplication` so authenticated Candidate
  can withdraw only own Application while current persisted state is exactly
  `status=APPLIED` and `version=expectedVersion`; Withdraw deliberately does not
  require Job accepting eligibility (`PUBLISHED`/deadline/Company ACTIVE) and
  remains allowed when Job is `CLOSED`, effectively expired, or owning Company
  is not ACTIVE. Persisted mutation is one atomic Application update that sets
  `status=WITHDRAWN`, sets `withdrawnAt`, stores optional `withdrawReason`
  (otherwise `null`), and increments `version` by exactly 1 while preserving
  `_id`, `candidateUserId`, `jobId`, `source`, `appliedAt`, and current
  `submittedCvSnapshot`; no Application delete/create, no snapshot replacement,
  no CandidateCV/Job/Company/Recruitment Team mutation. Candidate route contract
  adds `POST /api/candidate/applications/:applicationId/withdraw` with
  `{ expectedVersion, withdrawReason? }`. Focused coverage in
  `test/application/v9-withdraw-application.test.js` (6 tests). The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 85 files
  / 615 tests).

- **Implemented; verified:** V9 Final Acceptance finding — Application business
  identity immutability (PI-02; PT-02; PT-03; BR-31; BR-35): canonical
  `application.model.js` now fail-closes attempts to change `candidateUserId`,
  `jobId`, `source`, or `appliedAt` after creation through document save and
  query-update operators (including `$currentDate`). Replacement writes,
  aggregation-pipeline updates, and `bulkWrite` are rejected because no
  canonical V9 workflow owns those write paths. Focused regression coverage in
  `test/application/v9-application-query-update-invariants.test.js` verifies the
  previously bypassing `$currentDate` and `bulkWrite` paths plus replacement and
  pipeline paths while asserting persisted identity remains unchanged.

- **Completed and verified:** V9 Slice 06 — Final Acceptance & Regression
  Closure: verification gate `cd backend && npm run verify:agent` passed
  (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 87 files /
  651 tests). The focused Application invariant regression passed 3 files / 42
  tests. No remaining acceptance finding blocks V9 repository closure; deferred
  scope (My Applications, downstream pipeline, Assigned Recruiter, Invitation,
  Notification, Chat/Interview, snapshot/status history, and future
  sources/statuses/fields) remains intentionally out of implementation scope.

- **Implemented; verified:** V9 Slice 04 — Replace current Submitted CV (F03,
  F04; BR-03, BR-05–BR-08, BR-23–BR-31, BR-36, BR-37, BR-39; PT-02; TX-02;
  TX-04): extends canonical `application.service.js` with
  `replaceSubmittedCv` so authenticated Candidate can replace only own
  Application while current persisted state is exactly `status=APPLIED` and
  `version=expectedVersion`; replace rechecks Job accepting-application
  eligibility through canonical `isJobPubliclyEligible` and reuses the same
  Slice 02–03 snapshot capture owners for both Generated and Uploaded
  CandidateCV sources (`GENERATED↔GENERATED`, `GENERATED↔UPLOADED`,
  `UPLOADED↔GENERATED`, `UPLOADED↔UPLOADED`), preparing external snapshot
  artifact before the DB mutation. Persisted mutation is one atomic Application
  update that replaces the whole current `submittedCvSnapshot` and increments
  `version` by exactly 1 without changing `_id`, `candidateUserId`, `jobId`,
  `source`, `status`, or `appliedAt`; no snapshot history, no new Application,
  no recruiter assignment, and no Job/Company/CandidateCV mutation. Best-effort
  orphan snapshot cleanup runs only when DB commit fails. Candidate route
  contract adds `PUT /api/candidate/applications/:applicationId/submitted-cv`
  with `{ candidateCvId, expectedVersion }`. Focused coverage in
  `test/application/v9-replace-submitted-cv.test.js` (10 tests). The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 84 files /
  609 tests).

- **Implemented; verified:** V9 Slice 03 — Direct Apply with Uploaded CV and
  upload-first flow (F01, F02, F03 Uploaded path; BR-05–BR-09, BR-11–BR-17,
  BR-22–BR-27; PT-01; TX-01): extends canonical `directApplyToJob` so own
  non-archived Uploaded `ACTIVE` CandidateCVs (`PRIVATE`/`PUBLIC`) use the same
  `POST /api/candidate/applications` contract as Generated Apply; upload-first
  reuses canonical V7 `POST /api/candidate/cvs/uploaded` before Apply without
  temporary application-only CV or combined upload+apply endpoint; Uploaded
  snapshot capture downloads the current Uploaded PDF, copies it to restricted
  Application snapshot storage, persists `sourceType=UPLOADED` without
  `generatedContent`, and keeps snapshot independent from later Uploaded PDF
  replacement, rename, visibility/Default changes, and archive; Job eligibility,
  Application creation semantics, and Candidate–Job uniqueness remain unchanged
  from Slice 02. No Replace, Withdraw, CAS workflow, My Applications,
  Invitation, Notification, or Slice 04–06 behavior. Engineering SoT owner
  `directApplyToJob`. Focused coverage in
  `test/application/v9-direct-apply-uploaded.test.js` (6 tests). The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 83 files /
  599 tests).

- **Implemented; verified:** V9 Slice 02 — Direct Apply with Generated ACTIVE CV
  (F01, F02, F03 Generated path; BR-01–BR-08, BR-10, BR-12–BR-25, BR-43,
  BR-44; PT-01; TX-01): authenticated Candidate creates own Direct Application
  via `POST /api/candidate/applications` with `{ jobId, candidateCvId }`;
  Candidate identity comes only from authenticated access; Job must exist, be
  effectively `PUBLISHED` with future deadline, and belong to an operationally
  ACTIVE Company via reused `isJobPubliclyEligible`; CandidateCV must be own
  non-archived Generated `ACTIVE` (`PRIVATE`/`PUBLIC` allowed; `DRAFT`/Uploaded
  rejected); capture deep-copies structured Generated content, renders Harvard
  PDF, uploads snapshot PDF to restricted storage, and persists complete current
  `submittedCvSnapshot` before Application commit with `source=DIRECT_APPLICATION`,
  `status=APPLIED`, `version=0`, and immutable identity fields; Apply does not
  mutate CandidateCV/Job/Company/Recruitment Team or assign Recruiter;
  Candidate–Job uniqueness is enforced by service pre-check plus Slice 01 unique
  index with concurrent Apply regression. No Uploaded Apply, upload-first Apply,
  temporary application-only CV, Replace, Withdraw, CAS workflow, My
  Applications, Invitation, Notification, or Slice 03–06 behavior. Engineering
  SoT owner `directApplyToJob`. Focused coverage in
  `test/application/v9-direct-apply-generated.test.js` (4 tests). The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 82 files /
  593 tests).

- **Implemented; verified:** V9 Slice 01 — Application persistence foundation
  (persistence foundation for F01–F05; no Fxx completed): adds canonical
  Application source (`DIRECT_APPLICATION`) and status (`APPLIED`, `WITHDRAWN`)
  constants, `applications` persistence with required current
  `submittedCvSnapshot` (`sourceCandidateCvId`, `name`, `sourceType`,
  conditional `generatedContent`, `pdfFile`, `capturedAt`) and embedded
  `CvSnapshotPdfFile` metadata (`storageKey`, `originalFileName`, `mimeType`,
  `sizeBytes`, `pageCount`); enforces local Application and snapshot state
  matrices, immutable business identity (`candidateUserId`, `jobId`, `source`,
  `appliedAt`), non-negative revision `version` default `0`, and compound unique
  `{ candidateUserId, jobId }`; wires `ensureApplicationCollectionInvariants`
  at app and test DB connect with MongoDB collection validator for query-update
  paths; preserves multi-tenant shape via `jobId` only (no `companyId` or
  reverse arrays) and all V9 explicit exclusions (no Assigned/Source Recruiter,
  Invitation, snapshot history, Job snapshot, standalone `jobId` index, or Job
  deletion guard). No Direct Apply route/service, snapshot capture/render/upload,
  Replace, Withdraw, CAS workflow, or Slice 02–06 behavior. Focused coverage in
  `test/application/v9-application-foundation.test.js` (8 tests). The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 81 files /
  589 tests). At that point Slice 02+ were not yet started; they are recorded
  above as implemented and verified.

- **Prepared; verified:** V9 Slice 01 implementation readiness — approved V9
  Product/Data contracts are established as repository sources of truth;
  BR-40/BR-41 and Data persistence ownership now inherit the disjoint V5
  hard-delete boundary without a standalone `jobId` deletion index, PT-04,
  TX-05, or Application-existence Job guard; roadmap/project status mark V9
  `READY FOR IMPLEMENTATION` for Slice 01 only; Engineering SoT assigns V9 S01
  Application source/status constants and persistence ownership; and the V6
  acceptance assertion that forbade all future `applications` collections was
  narrowed while retaining every V6-owned deferred-scope assertion. The
  existing MongoDB replica-set harness, transaction rollback regression,
  collection-invariant patterns, and deterministic architecture gate are
  sufficient for S01 persistence/index/state-matrix verification, so no test
  infrastructure or verification rule was changed. The official backend gate
  passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 80 files /
  581 tests). No V9 Fxx behavior was implemented at that point; later slices
  are recorded above.

## Verification status

- V9 Slice 01 Implementation Readiness baseline (pre-implementation): the
  official `cd backend && npm run verify:agent` gate passed after the
  readiness-only canonical/ownership/V6-regression changes (ESLint: 0 errors /
  2 existing warnings in `test/job/v6-acceptance.test.js`; architecture:
  ARCH-001 through ARCH-016; Vitest: 80 files / 581 tests). No verification
  rule was changed or relaxed, and no V9 Fxx behavior was implemented.
