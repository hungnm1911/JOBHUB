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
| V3 | Quản lý nhân sự tuyển dụng của Company | PLANNED |
| V4 | Danh mục chuẩn của nền tảng | PLANNED |
| V5 | Job và vòng đời phê duyệt Job | PLANNED |
| V6 | Recruitment Team và chuyển giao trách nhiệm | PLANNED |
| V7 | Candidate Profile và thư viện CV | PLANNED |
| V8 | Job Discovery | PLANNED |
| V9 | Candidate chủ động Apply và tạo Application | PLANNED |
| V10 | Phân công Application và Recruitment Pipeline | PLANNED |
| V11 | Conversation và Chat thuộc Application | PLANNED |
| V12 | Interview Schedule | PLANNED |
| V13 | Notification và phân phối realtime | PLANNED |
| V14 | Candidate Search trên CV PUBLIC | PLANNED |
| V15 | Job Invitation và nhánh Recruiter săn ứng viên | PLANNED |
| V16 | Saved Jobs | PLANNED |
| V17 | Dashboard, thống kê và giám sát | PLANNED |

---

## Status meanings

### PLANNED

The version exists in the product roadmap but its repository-level business specification has not yet been approved for implementation.

Agents must not infer detailed requirements from the version name.

### READY FOR IMPLEMENTATION

The version has an approved canonical business specification under `docs/product/versions/` and may be decomposed into implementation tasks.

### IN PROGRESS

Implementation of the version has started but its complete business scope has not yet been verified.

### COMPLETED AND VERIFIED

The approved business scope of the version has been implemented and the required repository verification has passed.

---

## Current milestone

V1 and V2 are `COMPLETED AND VERIFIED`.

There is no further version currently `READY FOR IMPLEMENTATION` or `IN PROGRESS`. Versions V3 through V17 remain `PLANNED` and must not be implemented merely from their roadmap titles.

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
