# Recruiter FE API completion — 2026-11-26

Approved scope: the user's five-item Recruiter FE API completion request. This
extends reads only: choices for Supporting and Assignee, team display,
Primary Application detail, and list controls. Existing mutation authorization,
continuous eligibility, tenant resolution, snapshots, scheduling and Chat rules
remain canonical in Product V5/V6/V10–V15. No schema, index or migration changes.

## New reads

All paths below have `/api` prefix and require authenticated business access.

| GET path | Authority | Result |
| --- | --- | --- |
| `/jobs/:jobId/team/supporting-options` | Owning Company Manager or current Primary; effectively PUBLISHED Job | `{ recruiters, pagination }`; eligible same-company Recruiters excluding current Primary/Supporting; ACTIVE membership and User, completed password setup |
| `/jobs/:jobId/assignment-options` | Owning Company Manager or current Primary; effectively PUBLISHED/CLOSED/EXPIRED Job | `{ recruiters, pagination }`; ACTIVE Recruiters in current team, using V10 target eligibility; includes current Assignee when on-team; client excludes that identity for Reassign |
| `/jobs/:jobId/applications/:applicationId` | Current Primary only, same Company and matching Job | `{ job, application }`; same Application projection as Job list/workspace, including snapshot metadata, Availability, Schedule history and version; no Chat authority |

Choices always paginate, default page=1/limit=20, max limit=100. `q` searches
fullName/jobTitle as literal case-insensitive substring. `sort=fullName` or
`-fullName`, default ascending, stable CompanyMember ID tie-break. Each item is
`{ companyMemberId, fullName, jobTitle, avatarUrl }`; no email, credential,
account details or personnel-management authority. Mutation still revalidates
current eligibility. Manager/Primary identification comes from trusted
membership; supplied companyId is only a tenant guard. Nonexistent/invalid new
resource IDs return 404, forbidden actor/tenant 403, ineligible Job state 409.

Existing `GET /jobs/:jobId/team` retains ID fields and adds `primaryRecruiter`
(nullable summary) and `supportingRecruiters` (summary array) with the same
minimal fields as choices. The dedicated ended-Job team-read policy is unchanged;
assignment choices do not rely on that endpoint. Missing/deleted User records
retain legacy ID references, but have no display summary.

## List controls

Query controls are additive. Without controls existing endpoints retain their
unpaginated shape/order (except scoped Job lists, which always paginate).
Supplying q/filter/sort/page/limit enables pagination with the same defaults and
limits as choices. Existing CV metadata/keyword alone retain their prior shape.
Unknown controls, repeated controls, invalid enums/IDs, blank or >200-character
q, unsupported sorts or malformed pagination return 400. `companyId` never
changes the actor/tenant. Sort prefix `-` means descending; ID is the tie-break.

| Existing GET | Search | Filters | Sort (default) |
| --- | --- | --- | --- |
| `/jobs` | q: title | scope, persisted status | createdAt (ASC), title, applicationDeadline |
| `/jobs/managed` | q: title | persisted status | createdAt (ASC), title |
| `/jobs/:jobId/applications` | q: Candidate fullName | status, source, jobId, assigneeCompanyMemberId (ID or NONE) | createdAt (ASC), updatedAt |
| `/jobs/my-applications` | q: Candidate fullName or Job title | status, source, jobId, assigneeCompanyMemberId (ID or NONE) | createdAt (ASC), updatedAt |
| `/jobs/candidate-search/cvs` | existing keyword: skills only; q rejected | existing V14 metadata filters | updatedAt (DESC) |
| `/jobs/:jobId/invitations` | q: Candidate or sender fullName | evaluated current status | createdAt (DESC), sentAt |
| `/notifications` | q: content | type, readState=READ/UNREAD | createdAt (DESC) |

Responses retain resource keys and add
`pagination: { page, limit, total, totalPages }`. Total is after eligibility and
filters, before slicing; empty totalPages=0, out-of-range page returns [].
Application/workload/unread statistics remain scoped to the full authorized
resource set, independent of list filters or page. No state transition is added.
Workspace/Kanban remains an unpaginated projection with its eight status groups.
Notification controls are shared for all authenticated recipients, preserving
ownership and existing Candidate consumers.

Job lists filter/count/page in MongoDB, preserving the V6 DB-pagination guarantee.
Other reads filter/page their existing authorized derived projections in memory;
they do not claim bounded DB reads or production-scale query performance. CV
sort occurs on the underlying eligible-CV query before projection and paging.
Invitation filtering uses evaluated current status, never stale persisted PENDING.

## Ownership and verification

Routes/controllers parse transport input; existing resource services enforce
policy and project lists. `utils/list-query.js` owns only generic parsing,
filter/sort/page mechanics via resource-provided field/search selectors.
No second router, service layer, directory model or permission source is added.
Tests: `backend/test/job/recruiter-fe-api-completion.test.js`, amended scoped
Job/team projection regressions, and the official Backend gate. Live providers,
Frontend UI and production load require separate verification.
