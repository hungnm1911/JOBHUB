# Backend V12 Interview Schedule Project Status

## Current project state

**V12 — Interview Schedule** is `COMPLETED AND VERIFIED`: Slices 01–08 plus
Slice 09 Final Acceptance passed across `F01`–`F11`, `BR-01`–`BR-39`,
`TX-01`–`TX-03`, and `PI-01`–`PI-20`. The final independent architecture review
found no Critical or High finding; its one Medium finding (Availability edit
was not blocked on a terminal Application) is fixed and regression-covered, and
the official backend gate passed afterwards. Two non-blocking Low findings are
deferred (see below). Slice 01 covers first Candidate Availability submit and Application-read projection
(`F01`, `F02`, `F04`, `F11` partial; `BR-01`–`BR-10`, `BR-33`, `BR-35`).
Slice 02 is implemented and verified for the first Interview Proposal and
pipeline cutover (`F05`; `BR-11`, `BR-12`, `BR-15`–`BR-18`, `BR-25`–`BR-26`,
`BR-35`–`BR-36`, `BR-39`; `TX-01` foundation): the current eligible Assigned
Recruiter can create one `PROPOSED` Schedule from a current Availability slot,
atomically move `CONTACTED → INTERVIEW_SCHEDULED`, and advance Availability
revision. Schedule identity snapshots the selected slot and creator; partial
active-Schedule uniqueness is persisted. Notification, realtime, or
Conversation/Message authority change are not included. Its approved
Product/Data contracts are tracked at
`docs/product/backend/versions/v12-interview-schedule.md` and
`docs/data/backend/versions/v12-interview-schedule-data-model.md`. Gate 00 closes the
V10 compatibility boundary: from V12 onward,
`CONTACTED → INTERVIEW_SCHEDULED` is valid only in the same business outcome as
the first `InterviewSchedule(PROPOSED)` creation. Pre-V12 Applications already
at `INTERVIEW_SCHEDULED` or later retain their historical state without
synthetic Availability/Schedule backfill, rollback, or inferred proposal
history; no new legacy state may be created after cutover.

## Deferred / not started

- **V12 closure:** Final Acceptance is complete; no V12 business slice remains.
  Notification, realtime, Calendar UI, exact-time/duration scheduling,
  `InterviewSchedule.COMPLETED`, and Availability/Schedule audit history stay
  outside V12 by approved product/data boundary.
- **Deferred non-blocking Low findings (no V12 business behavior is violated):**
  - Reproposal increments `Application.version`/`updatedAt` as its
    terminal-serialization write, while Data Contract §8.4 lists Application as
    unchanged for follow-up proposals; needs a Data Contract clarification or a
    switch to the restore-`updatedAt` acquire used by other V12 writes.
  - Candidate-facing Application projections include
    `createdByUserId`/`createdByCompanyMemberId` of each Schedule; a
    Candidate-specific projection without creator identity is a follow-up.

## Implementation record (slice detail)

Slice 03 is implemented for Candidate current Availability edit (`F03`;
`BR-06`, `BR-08`, `BR-17`; `TX-02` and the Availability↔proposal completion
of `TX-01`): an owner replaces the existing current set through
`PUT /api/candidate/applications/:applicationId/availability` using
`expectedRevision`. The edit permits `[]`, validates timezone-relative
non-past unique date/day-part slots, preserves Application and Schedule
history, and advances only the current Availability revision. It shares the
Availability transactional write with proposal creation, so an edit that wins
invalidates a stale proposal and a winning proposal prevents the stale edit
and locks further edits while `PROPOSED` exists. Slice 03 does not add
Confirm/Decline/Cancel, reproposal, history expansion, expiration runtime,
notification, realtime, or Chat authorization changes.

Slice 04 is implemented for Candidate Confirm / Decline (`F06`, `F07`;
`BR-13`, `BR-19`, `BR-21`–`BR-22`, `BR-24`, `BR-26`–`BR-27`, `BR-38`):
Candidate ownership resolves only through the canonical Application, including
when temporarily `UNASSIGNED`. A live `PROPOSED` Schedule has one guarded
outcome only—`CONFIRMED` or `DECLINED`; an expired, terminal, non-`PROPOSED`,
or cross-Application proposal is rejected. The transition keeps Application
at `INTERVIEW_SCHEDULED`, leaves Availability untouched, and retains immutable
proposal identity; `DECLINED` is therefore persisted history for the existing
same-Application declined-slot exclusion. Slice 04 does not add cancellation,
expiration mutation, reproposal, Schedule-history reads, Notification,
realtime, or Chat authorization changes.

Slice 05 is implemented for Recruiter Cancel, reproposal, and Schedule History
(`F08` partial, `F09`, `F11`; `BR-13`–`BR-15`, `BR-20`, `BR-28`,
`BR-33`–`BR-37`): only the current continuously eligible Assigned Recruiter
can atomically cancel a `PROPOSED` Schedule, including after Reassign; cancel
preserves Application and Availability. A new `PROPOSED` document can be
created while the Application remains `INTERVIEW_SCHEDULED` after `DECLINED`
or `CANCELLED`, with the existing Availability revision guard. Declined slots
remain excluded while cancelled-only slots can be proposed again. Existing
Application reads now expose current Availability and each immutable Schedule
history record under their pre-existing Application read authority, without
expanding Conversation/Message authority. Recruiter manual
`CONFIRMED → CANCELLED`, terminal coupled cancellation, Notification, realtime,
and Availability history remain out of this slice.

Slice 06 is implemented for automatic Interview Proposal expiration
(`F08` partial; `BR-14`, `BR-20`, `BR-25`, `BR-28`, `BR-38`): when
`now >= expiresAt`, a guarded System lifecycle persists `PROPOSED → CANCELLED`
without mutating Application status, Candidate Availability, or Schedule
history identity; MORNING and AFTERNOON remain valid through the full
proposed calendar day; repeated expiration execution is idempotent; expired
proposals cannot be Confirmed or Declined; reproposal remains available for
cancelled-only slots. Runtime execution reuses the V12 scheduling service
owner with operation-boundary invocation (mutations and Application reads),
not a general-purpose scheduler. Recruiter manual
`CONFIRMED → CANCELLED`, terminal Application coupled cancellation,
Notification, and realtime remain out of this slice.

Slice 07 is implemented and verified for terminal Application atomic Interview
Schedule cancellation (`F08` partial; `BR-29`, `BR-38`, `BR-39`, `TX-03`):
every canonical terminal Application transition now atomically cancels only its
active `PROPOSED` or `CONFIRMED` Schedule, preserving Schedule identity/history
and Candidate Availability. Terminal transitions without an active Schedule
remain valid and create none; historical `DECLINED`/`CANCELLED` records are not
rewritten. Proposal creation now serializes through the Application concurrency
token with terminal transitions, so no terminal Application can commit with an
active Schedule. This does not add general Recruiter
`CONFIRMED → CANCELLED`, change expiration, Candidate response, reproposal,
Notification/realtime, or Conversation/Message authorization semantics.

Slice 08 is implemented and verified for Assignment + Interview read
compatibility closure (`F10`, `F11`; `BR-30`–`BR-36`): Reassign, manual
Unassign, automatic Unassign, and Assign-again retain current Candidate
Availability and immutable Interview Schedule history without resetting statuses
or creator identity. Recruiter-side proposal/cancel authority follows only the
current continuously eligible Assignee; Candidate `PROPOSED` responses remain
available while the Application is temporarily `UNASSIGNED`. Every existing
Application read projection continues to hydrate `NOT_SUBMITTED`, submitted
Availability (including `[]`), and Schedule history only after its pre-existing
Application authorization passes. Job `CLOSED`/`EXPIRED` does not cancel or
hide Interview data for a non-terminal Application, and Interview reads do not
expand V11 Conversation/Message authority.

Acceptance remediation: production startup now awaits
`ensureCandidateAvailabilityCollection()` before opening the HTTP listener,
matching the test harness and Interview Schedule readiness path, so PI-01's
unique `applicationId` index is established (or startup fails) before traffic
is accepted. First-submit/edit/proposal business behavior is unchanged.

## Verification status

- V12 Final Acceptance (Slice 09): independent architecture review found no
  Critical/High finding. The Medium finding — `editCandidateAvailability`
  accepted edits on a terminal Application — is fixed by a terminal-status guard
  (409, `field: "status"`) in the existing owner and covered by a regression
  test in `test/application/v12-slice01-candidate-availability.test.js`
  (failed before the fix, passes after). The focused V12/V13-interview suites
  passed (8 files / 76 tests), then `cd backend && npm run verify:agent` passed
  (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`;
  architecture: ARCH-001 through ARCH-018; Vitest: 169 files / 1,764 tests).
  An earlier full run had one failure in the unrelated V14
  `v14-candidate-search-generated-preview.test.js` (PDF charset assertion) that
  passed in isolation and in the final full run; it is not a V12 behavior.

- V12 Gate 00 Implementation Readiness baseline: the official
  `cd backend && npm run verify:agent` gate passed without implementing any V12
  Fxx behavior (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016;
  Vitest: 119 files / 1,140 tests). Existing `MongoMemoryReplSet` test
  infrastructure supports the collection/index and transaction invariants
  required by the approved V12 slices; no verification rule was changed or
  relaxed.

- V12 Slice 01 Current Availability First Submit + Read: focused Availability
  and Pipeline regression tests passed (2 files / 40 tests), then
  `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 120 files / 1,145 tests). No InterviewSchedule, proposal,
  Availability edit/CAS, notification, realtime, scheduler/worker/queue, or
  Conversation/Message authorization behavior was added.

- V12 Slices 07–08 Final Acceptance baseline: focused terminal-cancellation and
  Assignment/Interview-read compatibility regressions passed (2 files / 16
  tests): `test/application/v12-slice07-terminal-interview-cancellation.test.js`
  and `test/application/v12-slice08-assignment-interview-compatibility.test.js`;
  then `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2
  existing warnings in `test/job/v6-acceptance.test.js`; architecture:
  ARCH-001 through ARCH-016; Vitest: 124 files / 1,194 tests).

- V12 acceptance finding — Candidate Availability unique-index startup
  readiness: production `backend/index.js` now awaits
  `ensureCandidateAvailabilityCollection()` before `startHttpServer`, so PI-01
  index initialization failure aborts startup without opening the HTTP listener;
  test harness and production share the same minimum readiness guarantee.
  Focused regressions in
  `test/application/v12-candidate-availability-startup-readiness.test.js`
  (plus existing Slice 01 Availability suite) passed, then
  `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 124 files / 1,194 tests). No Availability/proposal/Schedule
  business-behavior change and no generic index manager were added.

- V12 Slice 06 Automatic Interview Proposal Expiration: focused expiration
  lifecycle tests passed (`test/application/v12-slice06-interview-proposal-expiration.test.js`,
  1 file / 12 tests), then `cd backend && npm run verify:agent` passed (ESLint:
  0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`;
  architecture: ARCH-001 through ARCH-016; Vitest: 121 files / 1,173 tests).
  No general-purpose scheduler/cron/TTL, status `EXPIRED`, Schedule hard-delete,
  terminal Application coupled cancellation, Recruiter `CONFIRMED → CANCELLED`,
  notification, realtime, or Conversation/Message authorization behavior was
  added.
