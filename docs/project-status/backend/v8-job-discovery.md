# Backend V8 Job Discovery Project Status

## Current project state

**V8 — Job Discovery** retains its previously `COMPLETED AND VERIFIED` backend
baseline. The V8 Enhancement (F01 Product/API contract, F02A actor
authorization, F02B optional `companyId` filtering, and Frontend F03A–F03B)
is **ACCEPTED within the focused verification scope** as of 2026-11-03.
This does not represent a new full-gate acceptance of V8 or other versions.
The Featured extension (F02/F05, BR-42/BR-43, API-V8-01 and Data V8) is
**APPROVED / PENDING IMPLEMENTATION**. The baseline verification below does not
verify Featured behavior.
Its Product and Data contracts are
[V8 Product](../../product/backend/versions/v8-job-discovery.md) and
[V8 Data](../../data/backend/versions/v8-job-discovery-data-model.md); the
[Frontend V03 status](../frontend/v03-job-discovery.md) records the consumer.

The read-only public surface is implemented under `/api/job-discovery` with
optional authentication: `GET /jobs` (list, search, filter, sort, pagination),
`GET /jobs/:jobId` (discoverable and historical read-only detail), and
`GET /companies/:companyId` (public Company information). It covers F01–F08 and
BR-01–BR-41: F02A allows Guest and Candidate and rejects authenticated
Platform Admin and Company Staff (Manager or Recruiter) with `403`; a Job is
discoverable only while `PUBLISHED`, before its deadline, and owned by a
publicly eligible Company. V8 adds no Job lifecycle mutation, Candidate–Job
persistence, Saved Jobs, Apply, or Application mutation, and creates no new
collection. Featured is approved to read existing Application records for
ranking only; the implemented baseline has not added that read. Location and
Salary filters on the list route are owned by V4.1 and V4.2, not V8.

The V8 Product/API contract specifies an optional single-ObjectId `companyId`
on `GET /api/job-discovery/jobs` for the public Company Detail Jobs list.
Backend applies it in the initial MongoDB Job match before Company eligibility,
keyword, sort, and facet pagination; the response envelope remains unchanged.
Company Detail reads the public Company profile and the filtered Jobs list
through separate V8 requests; its Frontend implementation is recorded in the
Frontend V03 status leaf.

The earlier baseline architecture review of V8 found no Critical or High
finding and no Medium finding that blocks completion. List pagination and
ordering now run in MongoDB (single aggregation: Job filter, Company
eligibility lookup, keyword, sort, skip/limit, and total count) instead of
loading every match and every active Company into memory; the public response
shape, sort semantics, and
pagination metadata are unchanged and no index or schema changed.

## Deferred / not started

- **Featured extension:** approved Product/Data contract; Backend `FEATURED`
  ranking, Top 18 before six-per-page pagination, and focused verification are
  pending. Existing Application may be read for ranking, but Application
  creation, status/source changes, and other mutations remain outside V8.
- **Non-blocking review items:** the list pipeline restates the discoverable
  predicate that `resolveJobDiscoveryVisibility` applies to detail, so the two
  must be kept in sync (the V8 owner row in `docs/engineering/source-of-truth.md`
  records this).
- **Not verified for the enhancement:** full Backend gate, MongoDB query plans
  (`explain`), and performance on large data sets. Frontend focused evidence
  and its remaining browser/E2E checks are recorded in the Frontend V03 leaf.
- **Out of V8 by design:** Apply, Application mutation, Saved Jobs, Candidate Search,
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

- V8 Enhancement closure: F01 Product/API contract and F02A–F02B were accepted
  by the Product Owner. Acceptance relies on the focused evidence below;
  the accumulated local code diff has not received an independent direct
  review. The full Backend `verify:agent` gate was not rerun for the
  enhancement. The baseline gate below predates the enhancement.
- F02B focused verification: full V8 Job Discovery file plus the directly
  related V4.1 Location and V4.2 Salary Discovery filter files passed
  (3 files / 63 tests). Targeted ESLint on the changed controller, service,
  and V8 test passed; `git diff --check` passed. The full `verify:agent` gate
  was not run per F02B slice instruction. MongoDB query plans and large-data
  performance remain unverified.
- F02A focused verification: `npx vitest run` on the full V8 file and four
  Candidate AI visibility/source files passed (5 files / 47 tests). Targeted
  ESLint on the changed service and V8 test passed; `git diff --check` passed.
  The full `verify:agent` gate was not run for F02A, per slice instruction.
- V8 final acceptance baseline: after the database-layer list query change, the
  official `cd backend && npm run verify:agent` gate passed (ESLint: 0 errors /
  2 existing warnings in `test/job/v6-acceptance.test.js`; architecture
  verification: ARCH-001 through ARCH-018; Vitest: 169 files / 1762 tests,
  including the 20 tests in `test/job/v8-job-discovery.test.js`). The
  architecture review verdict for V8 acceptance was no blocking finding.
