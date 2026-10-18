# JOBHUB Project Status

This directory is the single entry point for JOBHUB implementation and
verification snapshots.

The canonical high-level product status remains in
[the Product Roadmap](../product/roadmap.md). Approved Product Specifications
define business requirements, Data Contracts define persistence requirements,
and Engineering documents define architecture and ownership. The files mapped
below record implementation and verification evidence only.

## Reading a status leaf

Open only the one leaf for the affected application/version; open
[Platform and operations](backend/platform-and-operations.md) only for
cross-version gates or operational state. A leaf is orientation, not authority.

Standard leaf layout, in order:

1. `Current project state` — headline status and short summary.
2. `Deferred / not started` (`Known issues / known mismatches` in Platform and
   operations).
3. Detail and history sections, such as `Implementation record (slice detail)`,
   `Previously completed and verified baseline`, and revision sections.
4. `Verification status` — always last.

Reading rules:

- Read sections 1 and 2, which sit at the top of the leaf, and only the most
  recent entry of section 4.
- Do not read section 3 in full; search it by keyword (slice, endpoint, entity)
  when the task touches that work.
- When updating a leaf, revise these sections in place instead of appending
  narrative history or implementation detail owned by Engineering documents.

## Backend

- [Platform and operations](backend/platform-and-operations.md)
- [V1 — Account authentication](backend/v01-account-authentication.md)
- [V2 — Company onboarding and platform administration](backend/v02-company-onboarding-platform-administration.md)
- [V3 — Company recruitment staff management](backend/v3-company-recruitment-staff-management.md)
- [V4 — Platform standard catalogs](backend/v4-platform-standard-catalogs.md)
- [V4.1 — Vietnam location migration](backend/v4.1-vietnam-location-migration.md)
- [V4.2 — Structured salary, metadata catalog, and candidate skill keyword](backend/v4.2-structured-salary-metadata-catalog-candidate-skill-keyword.md)
- [V5 — Job approval lifecycle](backend/v5-job-approval-lifecycle.md)
- [V6 — Recruitment team responsibility transfer](backend/v6-recruitment-team-responsibility-transfer.md)
- [V7 — Candidate profile and CV library](backend/v7-candidate-profile-cv-library.md)
- [V8 — Job discovery](backend/v8-job-discovery.md)
- [V9 — Candidate direct apply application](backend/v9-candidate-direct-apply-application.md)
- [V10 — Application assignment and recruitment pipeline](backend/v10-application-assignment-recruitment-pipeline.md)
- [V11 — Application conversation and chat](backend/v11-application-conversation-chat.md)
- [V12 — Interview schedule](backend/v12-interview-schedule.md)
- [V13 — Notification and realtime distribution](backend/v13-notification-realtime-distribution.md)
- [V14 — Candidate search public CV](backend/v14-candidate-search-public-cv.md)
- [V15 — Job invitation and recruiter sourcing](backend/v15-job-invitation-recruiter-sourcing.md)
- V16 and V17 do not yet have implementation snapshots; see the Product Roadmap.

## Frontend

- [V1 — Authentication foundation](frontend/v01-authentication-foundation.md)

## AI Kit

- [Package foundation](ai-kit/foundation.md)
