# Backend V8 Job Discovery Project Status

## Current project state

**V8 — Job Discovery** is `COMPLETED AND VERIFIED` for the backend. Its approved
Product and Data contracts are `docs/product/versions/v8-job-discovery.md` and
`docs/data/versions/v8-job-discovery-data-model.md`.

The read-only public surface is implemented under `/api/job-discovery` with
optional authentication: `GET /jobs` (list, search, filter, sort, pagination),
`GET /jobs/:jobId` (discoverable and historical read-only detail), and
`GET /companies/:companyId` (public Company information). It covers F01–F08 and
BR-01–BR-41: Guest, Candidate, Recruiter, and Platform Admin are allowed,
authenticated Company Manager context is rejected, and a Job is discoverable
only while `PUBLISHED`, before its deadline, and owned by a publicly eligible
Company. V8 adds no Job lifecycle mutation, Candidate–Job persistence, Saved
Jobs, Apply, Application, or other deferred capability, and creates no new
collection. Location and Salary filters on the list route are owned by V4.1 and
V4.2, not V8.

The final architecture review of V8 found no Critical or High finding and no
Medium finding that blocks completion. List pagination and ordering now run in
MongoDB (single aggregation: Job filter, Company eligibility lookup, keyword,
sort, skip/limit, and total count) instead of loading every match and every
active Company into memory; the public response shape, sort semantics, and
pagination metadata are unchanged and no index or schema changed.

## Deferred / not started

- **Non-blocking review items:** the list pipeline restates the discoverable
  predicate that `resolveJobDiscoveryVisibility` applies to detail, so the two
  must be kept in sync (the V8 owner row in `docs/engineering/source-of-truth.md`
  records this).
- **Not verified:** MongoDB query plans (`explain`) and performance on large
  data sets; V8 has no frontend, so frontend behavior is out of scope here.
- **Out of V8 by design:** Apply, Application, Saved Jobs, Candidate Search,
  Job Invitation, Chat, Interview, Notification, Job recommendation, view
  tracking, and posted-date filtering.

## Previously completed and verified baseline

- **Implemented; verified:** V8 Job Discovery backend (F01–F08; BR-01–BR-41;
  Data V8 §5.1.4, §7, §10.2, §12.3): `job-discovery.routes.js` →
  `job-discovery.controller.js` → `job-discovery.service.js`, with
  `authenticateOptionalAccess` and the canonical visibility owner
  `resolveJobDiscoveryVisibility` / public Company eligibility in
  `job.service.js`. Search matches Job title, required skills, Company name, and
  Job Description; Category, Work mode, Employment type, and Experience filters
  combine as OR within a group and AND across groups; `NEWEST`, `RELEVANCE`, and
  `EXPIRING_SOON` use `_id` descending as the deterministic tie-breaker;
  `RELEVANCE` without a keyword resolves to `NEWEST`. Public projections omit
  Recruitment Team, creator, approval, and Company administration data.
- **Implemented; verified:** V8 database-layer list query (L3 remediation):
  `queryDiscoveryPage` runs one `Job.aggregate` — Job-level `$match` first so the
  existing `job_discovery_*` indexes narrow the set, then a Company `$lookup`
  restricted to `APPROVED` + `ACTIVE`, then the keyword `$match`, then a single
  `$facet` returning the total count and the sorted, skipped, and limited page.
  `RELEVANCE` rank is computed in MongoDB with `$regexMatch`. Only the requested
  page is hydrated with Category and ExperienceLevel data. No application-side
  sort or `slice` remains on the list path.
- **Implemented; verified:** V8 regression coverage in
  `test/job/v8-job-discovery.test.js` (20 tests): visibility and historical
  detail, Company non-ACTIVE blocking on list/search/filter/detail/Company,
  actor boundary including Company Manager on every endpoint, Category branch
  OR semantics, keyword scope and relevance priority, read-only guarantee, and
  database-layer pagination (page/last/empty page, deterministic tie-breaks,
  RELEVANCE paging, combined keyword + filter + eligibility + pagination, and a
  query-shape check that the list path does not use `Job.find` or
  `Company.find`). V4.1 Slice 05 and V4.2 Slice 06 Discovery filter tests continue
  to pass.

## Verification status

- V8 final acceptance baseline: after the database-layer list query change, the
  official `cd backend && npm run verify:agent` gate passed (ESLint: 0 errors /
  2 existing warnings in `test/job/v6-acceptance.test.js`; architecture
  verification: ARCH-001 through ARCH-018; Vitest: 169 files / 1762 tests,
  including the 20 tests in `test/job/v8-job-discovery.test.js`). The
  architecture review verdict for V8 acceptance was no blocking finding.
