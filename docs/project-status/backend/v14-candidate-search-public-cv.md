# Backend V14 Candidate Search Public CV Project Status

## Current project state

**V14 — Candidate Search trên CV PUBLIC** is `COMPLETED AND VERIFIED`.
Its approved canonical Product/Data contracts are tracked at
`docs/product/backend/versions/v14-candidate-search-public-cv.md` and
`docs/data/backend/versions/v14-candidate-search-public-cv-data-model.md`.

## Deferred / not started

- **V14 closure:** Final Acceptance / regression closure is complete across F01–F06 and BR-01–BR-38 after Slices 01–06 and the Slice 07 dynamic-revocation and read-only acceptance suite. V14 is `COMPLETED AND VERIFIED`; no V14 business slice remains in the approved Candidate Search specification. Keyword/full-text search, Saved Search, Recruiter Download, Direct Message, and Job Invitation stay outside V14 by product boundary.

## Implementation record (slice detail)

Slice 01 is implemented and verified for Recruiter Candidate Search
eligibility (`F01`; `BR-01`–`BR-05`, `BR-33`). The canonical owner reuses
`company.service.js` Recruiter business context and adds a `job.service.js`
proof-of-membership workflow that derives eligibility from current persisted
state on every check: authenticated active Recruiter User, active Recruiter
`CompanyMember`, active canonical `Company`, and current Primary/Supporting
membership on at least one same-Company `Job` regardless of `PUBLISHED`,
deadline, or Application activity. No static permission field or derived
eligibility persistence was added. V14 also adds the canonical same-Company
Recruitment Team lookup indexes on `Job`
(`{ companyId, primaryRecruiterCompanyMemberId }` and
`{ companyId, supportingRecruiterCompanyMemberIds }`) plus focused HTTP/service
coverage via the Candidate Search authorization probe.

Slice 02 is implemented and verified for browsing the current search-eligible
CandidateCV pool with stable default ordering (`F02`, `F04`; `BR-06`–`BR-16`,
`BR-24`, `BR-25`, `BR-32`). The canonical owner extends
`candidate-cv.service.js` with a Recruiter browse workflow gated by Slice 01
authorization (`authorizeRecruiterCandidateSearchAccess`) and exposed via
`GET /api/jobs/candidate-search/cvs` (Job-independent path). Eligibility is
derived from authoritative current state only: local CandidateCV `PUBLIC` +
not archived, Generated requires `status=ACTIVE`, Uploaded keeps V7 persisted
`status=ACTIVE` normalization without an Uploaded-specific status business
predicate, and final inclusion requires current Candidate `User` to be
`ACTIVE` with verified email. Results remain CV-granular (no candidate-level
aggregation, no metadata mixing across CVs), and list projection is limited to
safe summary fields (`candidateFullName`, `cvName`, CV metadata). No full CV
content, contact details, Candidate Profile payload, `defaultCandidateCvId`
filtering, Preview/Download, or F03 filter groups were introduced in this
slice.

Slice 03 (`F03` partial) is implemented and verified for the first two filter
groups: Category + Experience (`BR-17`–`BR-19`, `BR-21`–`BR-23`). The canonical
owner remains `candidate-cv.service.js`, extending the existing Slice 02 browse
workflow (no parallel eligibility path) so filters are applied only within the
already search-eligible CandidateCV pool. Category filter reuses the canonical
V4/V7 Category hierarchy: selected `POSITION` matches that POSITION; selected
`FIELD` matches the FIELD and all child POSITION categories. Experience filter
reuses canonical V7 representation (`experienceLevelId -> ExperienceLevel`) and
OR-composes selected values in-group.

Slice 04 (`F03` closure) is implemented and verified for the remaining four
filter groups: Skill + Location + Employment Type + Work Mode (`BR-17`,
`BR-18`, `BR-20`–`BR-23`). The same canonical filter-composition workflow in
`candidate-cv.service.js` is extended (no parallel filter path) and keeps:
in-group OR semantics (`skillTags[]`, `preferredLocations[]`,
`employmentTypes[]`, `workModes[]`), cross-group AND semantics across all six
filter groups, and Slice 02 search-eligible-first narrowing. Missing optional
metadata remains non-excluding when a group is not filtered, and non-matching
when that group is filtered. No metadata inference was added from generated CV
content, uploaded PDF, address, summary, or work history. HTTP browse now
accepts all six filter-group query params:
`categoryIds`, `experienceLevelIds`, `skillTags`, `preferredLocations`,
`employmentTypes`, `workModes`.

Slice 05 is implemented and verified for Generated CV Recruiter Preview
(`F05` partial, `F06` partial; `BR-26`, `BR-27`, `BR-29`–`BR-38`). Eligible
Recruiters preview the current Harvard representation of a `GENERATED`
CandidateCV via the shared `GET /api/jobs/candidate-search/cvs/:cvId/preview`
surface. The Generated-specific owner remains `candidate-cv.service.js`
(`previewSearchEligibleGeneratedCandidateCv`), gated by Slice 01
`authorizeRecruiterCandidateSearchAccess` and reusing Slice 02 current
CandidateCV eligibility (`PUBLIC`, not archived, Generated `status=ACTIVE`,
Candidate owner `ACTIVE` with verified email). Preview re-checks that
authoritative state on every request and does not treat prior search-list
membership or client knowledge of `cvId` as authorization.
`GENERATED/DRAFT/PUBLIC`, PRIVATE, archived, Uploaded, missing, and
ineligible-owner CVs are denied by the Generated-specific workflow. Delivery
reuses the V7 Harvard renderer on current CV content, including contact
details the Candidate placed in that CV, without expanding to Candidate
Profile, other CVs, Application, or Recruiter Download. The workflow is
read-only: no CandidateCV/Profile/Account mutation, snapshot, view
history/count, Invitation, Application, Conversation, Message, Notification,
or realtime event. Slice 01–04 Search/Filter behavior is unchanged.

Slice 06 is implemented and verified for Uploaded CV Recruiter Preview
(`F05` closure, `F06` partial; `BR-12`, `BR-14`, `BR-16`, `BR-26`–`BR-38`
for `UPLOADED`). The shared Preview HTTP owner is
`previewSearchEligibleCandidateCv`; Uploaded-specific delivery is
`previewSearchEligibleUploadedCandidateCv`. Recruiter eligibility remains
Slice 01 HTTP authorization and current CandidateCV eligibility reuses Slice
02 (`PUBLIC`, not archived, `sourceType=UPLOADED`, Candidate owner `ACTIVE`
with verified email) without an Uploaded `status` business predicate.
Persisted Uploaded `status=ACTIVE` stays V7 normalization only. Delivery
reuses the canonical restricted Uploaded-PDF path
(`buildUploadedCvPdfDelivery` / authenticated `downloadFileBuffer`) for the
current file of that CV only. PRIVATE, archived, Generated (from the
Uploaded-specific workflow), missing, ineligible-owner, and previously listed
CVs that are no longer search-eligible are denied. Preview stays read-only
and does not add Download, snapshot, view history/count, Invitation,
Application, Conversation, Message, Notification, or realtime. Slice 05
Generated Preview and Slice 01–04 Search/Filter behavior are unchanged.

Slice 07 is implemented and verified for Dynamic Revocation + Read-only
Acceptance Closure (`F01`–`F06` closure; `BR-01`–`BR-38`). It reuses the
Slice 01–06 owners and HTTP surfaces without a parallel Search/Preview path.
Focused acceptance proves every later Search, Filter, and Preview request
re-derives Recruiter and CandidateCV eligibility from current authoritative
state: last Primary/Supporting Job membership loss, Recruiter User or
CompanyMember ineligibility, Company operational loss, Candidate ACTIVE/email
verification loss, `PUBLIC → PRIVATE`, and Archive all revoke subsequent
access. Prior search-list membership and client knowledge of `cvId` are not
authorization. Anonymous, Candidate, Company Manager, and Platform Admin
remain denied; client-supplied `companyId` cannot create cross-company
authorization; CandidateCV stays Candidate-owned. Search/Filter/Preview stay
read-only: no CandidateCV/Profile/Account mutation, no view/search history or
count, no Recruiter Download, no Invitation/Application/Conversation/Message/
Notification/realtime object, and no rewrite of an existing Application
`submittedCvSnapshot`. Keyword/full-text search, Saved Search, view analytics,
and V15+ Job Invitation remain out of scope. No production-owner change was
required; current Slice 01–06 behavior already matched the canonical V14
contract.

Slice 02 also adds the V14 CandidateCV browse/sort index set in the canonical
partial scope (`visibility=PUBLIC`, `archivedAt=null`):
`{ updatedAt:-1,_id:-1 }`,
`{ categoryId:1,updatedAt:-1,_id:-1 }`,
`{ experienceLevelId:1,updatedAt:-1,_id:-1 }`,
`{ skillTags:1,updatedAt:-1,_id:-1 }`,
`{ preferredLocations:1,updatedAt:-1,_id:-1 }`,
`{ employmentTypes:1,updatedAt:-1,_id:-1 }`,
`{ workModes:1,updatedAt:-1,_id:-1 }`.

Verification for this state: focused V14 Slice 01 suite passed
(`test/auth/v14-recruiter-candidate-search-eligibility.test.js`, 13 tests), and
focused V14 Slice 02 suite passed
(`test/auth/v14-candidate-search-browse-eligible-cvs.test.js`, 11 tests), and
focused V14 Slice 05 suite passed
(`test/auth/v14-candidate-search-generated-preview.test.js`, 7 tests), and
focused V14 Slice 06 suite passed
(`test/auth/v14-candidate-search-uploaded-preview.test.js`, 8 tests), and
focused V14 Slice 07 suite passed
(`test/auth/v14-candidate-search-acceptance.test.js`, 11 tests), and the
combined V14 Slice 01–07 focused baseline passed 5 files / 50 tests, and
`cd backend && npm run verify:agent` passed with architecture rules
`ARCH-001` through `ARCH-016`, 137 passing test files, and 1,310 passing tests.
ESLint reported 0 errors and the same 2 pre-existing `no-unused-vars` warnings
in `test/job/v6-acceptance.test.js`. V14 is `COMPLETED AND VERIFIED`; no V14
business slice remains in the approved Candidate Search specification.
Keyword/full-text search, Saved Search, Recruiter Download, Direct Message,
and Job Invitation stay outside V14 by product boundary.

## Verification status

- V14 Slice 07 Dynamic Revocation + Read-only Acceptance Closure: focused
  Slice 07 coverage passed 11 tests in
  `test/auth/v14-candidate-search-acceptance.test.js`, and the combined V14
  Slice 01–07 baseline passed 5 files / 50 tests. Then
  `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 137 files / 1,310 tests). Coverage includes Recruiter last
  Primary/Supporting membership loss, Recruiter User/membership ineligibility,
  Company operational loss, Candidate ACTIVE/email-verification loss,
  `PUBLIC → PRIVATE`, Archive, denied Anonymous/Candidate/Company Manager/
  Platform Admin Search, client `companyId` non-expansion, CandidateCV
  Candidate ownership, read-only Search/Filter/Preview, no Recruiter Download,
  and unchanged historical Application `submittedCvSnapshot`.
