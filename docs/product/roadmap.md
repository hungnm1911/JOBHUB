# JOBHUB Product Roadmap

## Purpose

This document provides the high-level product roadmap for JOBHUB.

It identifies the planned business versions and their current status.

Detailed business requirements are defined only in the corresponding documents under:

`docs/product/versions/`

A version must not be implemented from this roadmap alone.

When a detailed version specification exists and has been reviewed and approved, that version document becomes the canonical business contract for implementation.

---

## Versions

| Version | Scope | Status |
| --- | --- | --- |
| V1 | Tài khoản và vòng đời xác thực | COMPLETED AND VERIFIED |
| V2 | Company onboarding và quản trị cấp nền tảng | COMPLETED AND VERIFIED |
| V3 | Quản lý nhân sự tuyển dụng của Company | COMPLETED AND VERIFIED |
| V4 | Danh mục chuẩn của nền tảng | COMPLETED AND VERIFIED |
| V5 | Job và vòng đời phê duyệt Job | COMPLETED AND VERIFIED |
| V6 | Recruitment Team và chuyển giao trách nhiệm | COMPLETED AND VERIFIED |
| V7 | Candidate Profile và thư viện CV | COMPLETED AND VERIFIED |
| V8 | Job Discovery | PENDING |
| V9 | Candidate chủ động Apply và tạo Application | COMPLETED AND VERIFIED |
| V10 | Phân công Application và Recruitment Pipeline | COMPLETED AND VERIFIED |
| V11 | Conversation và Chat thuộc Application | COMPLETED AND VERIFIED |
| V12 | Interview Schedule | IN PROGRESS |
| V13 | Notification và phân phối realtime | READY FOR IMPLEMENTATION |
| V14 | Candidate Search trên CV PUBLIC | READY FOR IMPLEMENTATION |
| V15 | Job Invitation và nhánh Recruiter săn ứng viên | PLANNED |
| V16 | Saved Jobs | PLANNED |
| V17 | Dashboard, thống kê và giám sát | PLANNED |

---

## Status meanings

### PLANNED

The version exists in the product roadmap but its repository-level business specification has not yet been approved for implementation.

Agents must not infer detailed requirements from the version name.

### PENDING

The version has planning material in the repository but is intentionally held
before implementation. Its specifications and data contract are not approved
implementation authority, and no business slice may start until the roadmap
and project status explicitly move it forward.

### READY FOR IMPLEMENTATION

The version has an approved canonical business specification under `docs/product/versions/` and may be decomposed into implementation tasks.

### IN PROGRESS

Implementation of the version has started but its complete business scope has not yet been verified.

### COMPLETED AND VERIFIED

The approved business scope of the version has been implemented and the required repository verification has passed.

---

## Current project state

V1 through V7 are `COMPLETED AND VERIFIED`.

V5 Final Acceptance / regression closure passed across F01–F12 after Slices
01–12 and the recorded acceptance corrections. V6 Final Acceptance / regression
closure passed across F01–F05, BR-01–BR-33, and TX-01–TX-03 after its recorded
remediations and the required backend verification gate. V7 Final Acceptance /
regression closure passed across F01–F10, BR-01–BR-46, and TX-01 after Slices
01–11 and the recorded acceptance remediations. V8 remains `PENDING`. V9 has
approved Product/Data contracts; Slices 01–05 and Slice 06 Final Acceptance /
Regression Closure are complete, including the recorded Application identity
immutability remediation and required backend verification gate. V9 is
`COMPLETED AND VERIFIED`. V10 previously passed Final Acceptance / regression
closure across F01–F11, BR-01–BR-53, and TX-01–TX-05 after Slices 01–13, the
F11 Platform User lifecycle/recovery extension, and the Job-team responsibility
writer remediation. That implementation remains the regression baseline. The
approved V10 Product/Data contracts then defined the `ASSIGN / UNASSIGN` core
lifecycle refactor; Slices 01–10 of that revision are implemented and verified,
including Concurrency Closure / Final Acceptance (TX-01/TX-02/TX-05 race
closure, Platform LOCK partial-progress retry, and stale trusted A→B cleanup).
V10 is therefore `COMPLETED AND VERIFIED` against the current canonical
revision. V11 Final Acceptance / regression closure passed across F01–F10,
BR-01–BR-55, and TX-01–TX-08 after Slices 01–06 and the Slice 07 acceptance
suite, including the recorded final remediations for Send guard-document
timestamps, complementary Send ↔ eligibility-loss ordering, and actual Send ↔
Assign-again ordering. The required backend verification gate passed after
those remediations; V11 is therefore `COMPLETED AND VERIFIED` against the
approved Conversation/Chat Product/Data contracts. Realtime, notification,
attachment, and related deferred capabilities remain outside V11 by product
boundary. V12 now has approved Product/Data contracts and is `IN PROGRESS`;
Slices 01–08 are implemented and verified, while Slice 09 Final Acceptance is
resolving recorded acceptance findings. V13 has approved Product/Data
contracts and is `READY FOR IMPLEMENTATION`; its Slice 01 may start against
those contracts and the approved recovery ownership/trigger contract. V12
closure remains a later acceptance gate for V13 Slices 06–08, not a Slice 01
prerequisite. V14 has approved Product/Data contracts and is `READY FOR
IMPLEMENTATION`; its Slice 01 may start against those contracts and the
approved Candidate Search eligibility ownership boundary. V15 through V17
must not be implemented merely from their roadmap titles.

V14 canonical specification:

`docs/product/versions/v14-candidate-search-public-cv.md`

V14 canonical persistence contract:

`docs/data/versions/v14-candidate-search-public-cv-data-model.md`

V13 canonical specification:

`docs/product/versions/v13-notification-realtime-distribution.md`

V13 canonical persistence contract:

`docs/data/versions/v13-notification-realtime-distribution-data-model.md`

V12 canonical specification:

`docs/product/versions/v12-interview-schedule.md`

V12 canonical persistence contract:

`docs/data/versions/v12-interview-schedule-data-model.md`

V10 canonical specification:

`docs/product/versions/v10-application-assignment-recruitment-pipeline.md`

V10 canonical persistence contract:

`docs/data/versions/v10-application-assignment-recruitment-pipeline-data-model.md`

V11 canonical specification:

`docs/product/versions/v11-application-conversation-chat.md`

V11 canonical persistence contract:

`docs/data/versions/v11-application-conversation-chat-data-model.md`

V9 canonical specification:

`docs/product/versions/v9-candidate-direct-apply-application.md`

V9 canonical persistence contract:

`docs/data/versions/v9-candidate-direct-apply-application-data-model.md`

V7 canonical specification:

`docs/product/versions/v7-candidate-profile-cv-library.md`

V7 canonical persistence contract:

`docs/data/versions/v7-candidate-profile-cv-library-data-model.md`

V6 canonical specification:

`docs/product/versions/v6-recruitment-team-responsibility-transfer.md`

V6 canonical persistence contract:

`docs/data/versions/v6-recruitment-team-responsibility-transfer-data-model.md`

V5 canonical specification:

`docs/product/versions/v5-job-approval-lifecycle.md`

V5 canonical persistence contract:

`docs/data/versions/v5-job-approval-lifecycle-data-model.md`

V4 canonical specification:

`docs/product/versions/v4-platform-standard-catalogs.md`

V4 canonical persistence contract:

`docs/data/versions/v4-platform-standard-catalogs-data-model.md`

V3 canonical specification:

`docs/product/versions/v3-company-recruitment-staff-management.md`

V3 canonical persistence contract:

`docs/data/versions/v3-company-recruitment-staff-management-data-model.md`

V2 canonical specification:

`docs/product/versions/v02-company-onboarding-platform-administration.md`

V2 canonical persistence contract:

`docs/data/versions/v02-company-onboarding-platform-administration.md`

---

## Product documentation rules

- The roadmap defines version ordering and high-level scope only.
- Detailed business behavior belongs in the corresponding version specification.
- Agents must not invent requirements for versions that do not yet have an approved specification.
- Product requirements must not be inferred from existing implementation code.
- Technical or database design must not redefine product business rules.
- When a business decision changes, the canonical version specification must be updated before implementation based on that changed requirement proceeds.
