# Backend V15 Job Invitation and Recruiter Sourcing Project Status

## Current project state

**V15 — Job Invitation và nhánh Recruiter săn ứng viên** is
`COMPLETED AND VERIFIED`.
Slice 01 — Persistence Kernel, Slice 02 — Send Job Invitation + Direct Apply
Exclusion, Slice 03 — Candidate Invitation Read + Current-State Evaluation,
Slice 04 — Candidate Reject Job Invitation, Slice 05 — Primary Invitation
Management + Revoke, Slice 06 — Invitation Expiration + Invalidation
Materialization, Slice 07 — Invitation-source Application Compatibility,
Slice 08 — Atomic Accept + Availability Handoff, and Slice 09 — Acceptance +
Concurrency Closure are `IMPLEMENTED AND VERIFIED`. Slice 09 closes `F01`–`F11`
across `BR-01`–`BR-61` and `TX-01`–`TX-05` without adding business capability
beyond the approved canonical contracts. Its approved Product/Data contracts
remain `docs/product/backend/versions/v15-job-invitation-recruiter-sourcing.md` and
`docs/data/backend/versions/v15-job-invitation-recruiter-sourcing-data-model.md`.

## Deferred / not started

- **V15 closure:** Final Acceptance / regression closure is complete across
  F01–F11, BR-01–BR-61, and TX-01–TX-05 after Slices 01–08 and the Slice 09
  acceptance and concurrency suite. V15 is `COMPLETED AND VERIFIED`; no V15
  business slice remains in the approved Job Invitation specification.
  Sourcing KPI/report/dashboard, Company Manager Invitation management,
  Invitation audit/history, configurable lifetime, `EXPIRED` notification,
  Candidate Accept self-notification, and a new realtime protocol stay
  outside V15 by product boundary.

## Implementation record (slice detail)

Slice 09 is acceptance and concurrency closure on the existing Slice 01–08
owners. It does not add a workflow, API, field, worker, or permission. Focused
coverage proves Candidate–Job exclusion across concurrent Send/Send,
Send/Direct Apply, Accept/Direct Apply, and Accept/Send; resend after real
`EXPIRED`/`REVOKED`/`INVALIDATED` materialization; permanent Invitation block
after `REJECTED` while Direct Apply remains allowed; existing Application
blocking future Invitation; one terminal winner among Accept/Reject/Revoke and
expiration/invalidation with no losing-action side effects; stale persisted
`PENDING` is not Send/Direct Apply/Accept/Revoke authority; delayed
materialization does not overwrite a committed terminal winner and keeps
`invalidatedAt` as source-cause time; Job `CLOSED` maps to `EXPIRED`;
Generated and Uploaded V14 Send eligibility plus immutable snapshots after
live CV edits; Send binds `InvitedCvSnapshot` to the exact CandidateCV
revision re-checked at TX-01 commit; Accept/Reject/Revoke serialize with
authoritative invalidation sources at terminal commit; Accept-created `RECRUITER_INVITATION`
Applications continue on
canonical V10–V12 Assignment/Pipeline/Conversation/Availability/Interview
owners without historical-sender authority; Direct Apply keeps V9 Replace/
Withdraw while Invitation-source Applications do not; tenant/ownership
boundaries deny Supporting, Company Manager, Platform Admin, foreign
Candidate, and client `companyId` expansion; Notification reference matrix and
V13 durability/recovery hold, with no `JOB_INVITATION_EXPIRED` and no
synthetic `APPLICATION_ASSIGNED` / `APPLICATION_STATUS_CHANGED` on Accept.
Sourcing KPI/report/dashboard, Company Manager Invitation management,
Invitation audit/history, configurable lifetime, `EXPIRED` notification,
Candidate Accept self-notification, a new realtime protocol, and V16 remain
out of scope.

Verification for this Slice 09 state: `cd backend && npm run verify:agent`
passed on 2026-08-19 with ESLint 0 errors / the same 2 pre-existing V6
`no-unused-vars` warnings, architecture rules `ARCH-001` through `ARCH-016`,
148 passing test files, and 1,449 passing tests.
Focused Slice 09 coverage is
`test/application/v15-slice09-acceptance-concurrency-closure.test.js`
(33 tests). Slice 08 coverage remains
`test/application/v15-slice08-atomic-accept-availability-handoff.test.js`
(12 tests). Slice 07 coverage remains
`test/application/v15-slice07-invitation-source-application-compatibility.test.js`
(9 tests). Slice 06 coverage remains
`test/application/v15-slice06-invitation-expiration-invalidation.test.js`
(13 tests), plus Day-15 production-runtime wiring in
`test/application/v15-invitation-expiration-runtime.test.js` (3 tests). Slice 05 coverage remains
`test/application/v15-slice05-primary-invitation-management.test.js`
(13 tests). Slice 04 coverage remains
`test/application/v15-slice04-candidate-reject-job-invitation.test.js`
(10 tests). Slice 03 coverage remains
`test/application/v15-slice03-candidate-invitation-read.test.js` (8 tests).
Slice 02 coverage remains
`test/application/v15-slice02-send-job-invitation.test.js` (16 tests). Slice 01
persistence suites remain
`test/application/v15-slice01-persistence-kernel.test.js` and
`test/notification/v15-slice01-invitation-notification-foundation.test.js`.
No further V15 business slice remains in the approved specification.

## Current Job Invitation revision

- **Implemented; verified:** V15 Final Acceptance finding — Day-15 Invitation
  expiration has a production runtime trigger (`F07`; `BR-23`–`BR-25`; Data
  time-driven `PENDING → EXPIRED` persistence):
  `backend/src/workers/job-invitation-expiration.worker.js` follows the V13
  Notification recovery start/stop pattern, is started from `backend/index.js`
  after Job Invitation collection readiness, and delegates only to existing
  `materializeDueExpiredJobInvitations`. A due `PENDING` Invitation is
  eventually persisted `EXPIRED` without user traffic; not-yet-due and
  terminal Invitations are unchanged; repeated passes are idempotent. No
  `JOB_INVITATION_EXPIRED`, TTL deletion, second evaluator, or BR-23
  timezone/day-count change. Focused regressions in
  `test/application/v15-invitation-expiration-runtime.test.js` (3 tests).
  The official backend gate passed (ESLint: 0 errors / 2 existing warnings
  in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest:
  148 files / 1,449 tests).

- **Implemented; verified:** V15 Final Acceptance finding — Accept/Reject/Revoke
  serialize with authoritative invalidation sources (`F04`–`F08`; `BR-16`,
  `BR-31`–`BR-34`, `BR-47`; `TX-02`–`TX-05`): `acceptOwnJobInvitation`,
  `rejectOwnJobInvitation`, and `revokePrimaryJobInvitation` reuse
  `acquireJobInvitationActionSerialization` in
  `candidate-job-serialization.service.js` to dummy-write the Job Company,
  historical sender CompanyMember, historical sender User, Job, Candidate
  User, and invited CandidateCV (Send-compatible order, restored `updatedAt`)
  and evaluate `evaluateJobInvitationCurrentState` from those acquired
  documents inside the same MongoDB transaction. A source mutation that
  commits first cannot lose the terminal outcome to a stale Accept/Reject/
  Revoke; a terminal action that commits first is kept and later invalidation
  catch-up does not overwrite it. No global source+Invitation transaction,
  no Day-15 trigger change, and no new persistence field. Focused regressions
  in `test/application/v15-slice09-acceptance-concurrency-closure.test.js`
  (33 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 147 files / 1,446 tests).

- **Implemented; verified:** V15 Final Acceptance finding — Send binds exact
  CandidateCV revision to persisted `InvitedCvSnapshot` (`F01`/`F02`;
  `BR-10`–`BR-14`; Data snapshot/`TX-01`): `sendJobInvitation` still captures
  the snapshot outside MongoDB (no Cloudinary/PDF work inside the transaction)
  but TX-01 now reuses `acquireCandidateJobSerialization` to dummy-write
  serialize the selected CandidateCV with restored `updatedAt`, re-checks V14
  eligibility, and refuses commit when the re-checked document is not the
  captured revision. Source mutation that wins first (content, `PUBLIC →
  PRIVATE`, Generated `ACTIVE → DRAFT`, Archive) cannot commit a stale Send;
  Send that wins first keeps the captured snapshot and later CandidateCV
  mutations follow existing post-Send semantics. Accept/Reject/Revoke later
  gained invalidation-source serialization (see the finding above). Focused
  regressions in
  `test/application/v15-slice09-acceptance-concurrency-closure.test.js`
  (21 tests at that finding; 33 tests after invalidation-source serialization).
  The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 147 files / 1,434 tests).

- **Implemented; verified:** V15 Slice 09 — Acceptance + Concurrency Closure
  (`F01`–`F11` closure; `BR-01`–`BR-61`; `TX-01`–`TX-05`): existing Slice 01–08
  owners compose into one Invitation lifecycle without a new workflow, API,
  field, worker, or business capability. Focused acceptance proves Candidate–
  Job exclusion under concurrent Send/Accept/Direct Apply, resend after real
  `EXPIRED`/`REVOKED`/`INVALIDATED`, permanent Invitation block after
  `REJECTED`, existing Application blocking future Invitation, one terminal
  winner among Accept/Reject/Revoke and expiration/invalidation with no
  losing-action side effects, stale persisted `PENDING` without authority,
  delayed materialization that does not change a committed terminal winner,
  Job `CLOSED` → `EXPIRED` and source-cause `invalidatedAt`, Generated and
  Uploaded V14 Send eligibility plus immutable snapshots, Accept-created
  Application continuation on canonical V10–V12 owners without historical-
  sender authority, source-specific Replace/Withdraw, tenant/ownership
  denial for Supporting/Company Manager/Platform Admin/foreign Candidate/
  client `companyId`, Notification reference matrix and V13 durability/
  recovery, and absence of deferred V15 persistence. No production-owner
  change was required; current Slice 01–08 behavior already matched the
  canonical V15 contract. A later acceptance finding binds Send
  `InvitedCvSnapshot` to the exact CandidateCV revision re-checked at TX-01
  (see the Send snapshot-revision finding above). Focused coverage in
  `test/application/v15-slice09-acceptance-concurrency-closure.test.js`
  (13 tests at Slice 09 close; 21 tests after the snapshot-revision finding;
  33 tests after invalidation-source serialization).
  The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 147 files / 1,426 tests).

- **Implemented; verified:** V15 Slice 08 — Atomic Accept + Availability
  Handoff (`F04` closure, `F10` closure, `F11`; `BR-34`, `BR-37`–`BR-49`,
  `BR-54`–`BR-60`; `TX-02`): `acceptOwnJobInvitation` in
  `job-invitation.service.js` lets only the authenticated Candidate owner of
  the exact Invitation Accept, after Candidate–Job serialization and a shared
  Slice 03 current-state re-check inside the commit transaction. Persisted
  `PENDING` is not actionability. Expiration, invalidation, or another terminal
  cause with earlier effective time returns 409 with no Application,
  Conversation, CandidateAvailability, or durable NotificationEvent. Successful
  Accept commits `PENDING → ACCEPTED` + `acceptedAt`, creates exactly one
  Invitation-source Application at `CONTACTED` (initial Assignee = historical
  sender, submitted snapshot = deep copy of `invitedCvSnapshot`, no fake
  `appliedAt`/Withdraw metadata), reuses V11 `createConversationOnFirstAssignIfAbsent`,
  and writes `JOB_INVITATION_ACCEPTED` + `INVITED_APPLICATION_CREATED` for the
  sender plus existing V13 `INTERVIEW_AVAILABILITY_REQUESTED` for the Candidate
  in one MongoDB transaction. Application uniqueness and `sourceInvitationId`
  uniqueness remain database protection. No synthetic `APPLICATION_ASSIGNED` /
  `APPLICATION_STATUS_CHANGED`, no pre-Accept chat, no live CV recapture, no
  `sourceRecruiterCompanyMemberId`. Inbox materialization stays best-effort
  post-commit. HTTP `POST /api/candidate/invitations/:invitationId/accept`.
  Focused coverage in
  `test/application/v15-slice08-atomic-accept-availability-handoff.test.js`
  (12 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 146 files / 1,413 tests).

- **Implemented; verified:** V15 Slice 07 — Invitation-source Application
  Compatibility (`F04` partial, `F10`; `BR-37`–`BR-46`, `BR-54`, `BR-55`,
  `BR-60` compatibility/enabler): existing Application read, assignment,
  pipeline, Conversation, Availability, Interview, and submitted-CV snapshot
  owners in `application.service.js` accept `source = RECRUITER_INVITATION`
  under the same ownership, tenant, and current-assignee rules as Direct
  Applications. Canonical entry state is persisted `CONTACTED` with no fake
  `APPLIED → SCREENING → CONTACTED`. After `CONTACTED`, V10 Reassign/Unassign/
  First Assign again follow current `assignedRecruiterCompanyMemberId`,
  eligibility, and current team; historical Invitation sender is attribution
  via immutable `sourceInvitationId`, not Application authority. Pipeline from
  `CONTACTED` reuses canonical V10/V12 rules, including the Interview-proposal
  cutover to `INTERVIEW_SCHEDULED`. Conversation history/Send work when a
  Conversation already exists and still derive from Application owner +
  current Assignee + current lifecycle. Availability first-submit and
  Interview owners accept Invitation-source Applications at `CONTACTED`
  without inventing `CandidateAvailability` before first submit. Replace
  Submitted CV and Withdraw remain Direct Apply-only and return 409 for
  Invitation-source Applications. Submitted CV snapshots stay independent of
  live CandidateCV and source Invitation. Slice 07 does not create
  Application from Accept, move Invitation to `ACCEPTED`, create Conversation,
  or emit `JOB_INVITATION_ACCEPTED` / `INVITED_APPLICATION_CREATED` /
  Accept-time `INTERVIEW_AVAILABILITY_REQUESTED`. Focused coverage in
  `test/application/v15-slice07-invitation-source-application-compatibility.test.js`
  (9 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 145 files / 1,401 tests).

- **Implemented; verified:** V15 Slice 05 — Primary Invitation Management +
  Revoke (`F06`, `F11` partial; `BR-24`, `BR-27`, `BR-28`, `BR-34`, `BR-51`,
  `BR-56`–`BR-59`, `BR-61`; `TX-04`): authenticated ACTIVE Recruiter who is
  current Primary of the exact Job in the operational Company lists/reads
  that Job's Invitation history, including terminal and Supporting-sent
  records, via `GET /api/jobs/:jobId/invitations` and
  `GET /api/jobs/:jobId/invitations/:invitationId`. `revokePrimaryJobInvitation`
  reuses `evaluateJobInvitationCurrentState` inside the commit transaction,
  acquires Candidate–Job serialization, and commits `PENDING → REVOKED` plus
  `revokedAt` plus durable Candidate `JOB_INVITATION_REVOKED` in one MongoDB
  transaction. An earlier expiration, Job-closed/deadline, or invalidation
  cause blocks Revoke without persisting `REVOKED`. Historical sender,
  Candidate, Job, and invited CV snapshot stay unchanged; the current Primary
  who Revokes does not become sender. Supporting, Company Manager, Platform
  Admin, former Primary, and Invitation-id knowledge do not create management
  authority. `REVOKED` remains terminal and continues to allow later Send
  when other current Send conditions remain valid. Inbox
  materialization/realtime failure after commit does not roll back the
  business transition. Accept, persistent Expiration/Invalidation, and
  Invitation-source Application remain later slices. Focused coverage in
  `test/application/v15-slice05-primary-invitation-management.test.js`
  (13 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 143 files / 1,379 tests).

- **Implemented; verified:** V15 Slice 04 — Candidate Reject Job Invitation
  (`F05`, `F11` partial; `BR-20`, `BR-25`, `BR-26`, `BR-30`, `BR-34`,
  `BR-36`, `BR-50`, `BR-56`–`BR-59`; `TX-03`): authenticated Candidate Rejects
  only own actionable Invitations via
  `POST /api/candidate/invitations/:invitationId/reject`. `rejectOwnJobInvitation`
  reuses `evaluateJobInvitationCurrentState` inside the commit transaction,
  acquires Candidate–Job serialization, and commits `PENDING → REJECTED` plus
  `rejectedAt` plus durable sender `JOB_INVITATION_REJECTED` in one MongoDB
  transaction. An earlier expiration or invalidation cause blocks Reject
  without persisting `REJECTED`. Identity/snapshot/sender fields stay
  unchanged; no reject reason, Application, Conversation, Message, or
  Candidate self-notification. `REJECTED` remains terminal and continues to
  block future Send for the same Candidate–Job; Direct Apply remains allowed
  under canonical Direct Apply rules. Inbox materialization/realtime failure
  after commit does not roll back the business transition. Accept, persistent
  Expiration/Invalidation, and Invitation-source Application remain later
  slices. Focused coverage in
  `test/application/v15-slice04-candidate-reject-job-invitation.test.js`
  (10 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 142 files / 1,366 tests).

- **Implemented; verified:** V15 Slice 03 — Candidate Invitation Read +
  Current-State Evaluation (`F03`, `F07`/`F08` enabler; `BR-15`, `BR-16`,
  `BR-23`–`BR-26`, `BR-31`–`BR-34`, `BR-53`, `BR-58`, `BR-59`): authenticated
  Candidate lists/reads only own Invitations, including terminal history, via
  `GET /api/candidate/invitations` and
  `GET /api/candidate/invitations/:invitationId`. Read model includes
  Job/Company, historical sender, greeting, immutable invited CV snapshot,
  sent/expiry information, and current status. Shared
  `evaluateJobInvitationCurrentState` treats persisted `PENDING` as
  non-actionable when current Job/cutoff state requires `EXPIRED` or current
  Candidate/CV/Company/sender eligibility requires `INVALIDATED`, without
  persisting those transitions or `canAccept`/`canReject`. Terminal persisted
  states stay terminal. `JOB_INVITATION_RECEIVED` is not current-state
  authority. Accept, expiration worker, and invalidation
  persistence remain later slices. Focused coverage in
  `test/application/v15-slice03-candidate-invitation-read.test.js` (8 tests).
  The official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 141
  files / 1,356 tests).

- **Implemented; verified:** V15 Slice 02 — Send Job Invitation + Direct Apply
  Exclusion (`F01`, `F02`, `F09`, `F11` partial; `BR-03`–`BR-22`, `BR-23` Send
  cutoff, `BR-35`, `BR-36`, `BR-48`, `BR-56`, `BR-61`; `TX-01`): authenticated
  ACTIVE Recruiter in an operational Company who is current Primary or
  Supporting of the exact selected Job can `POST /api/jobs/:jobId/invitations`
  for an exact V14 search-eligible CandidateCV. Send re-checks authoritative
  Recruiter/Company/Job-team/Job-window state, captures immutable
  `InvitedCvSnapshot` through shared `cv-snapshot.service.js`, persists
  BR-23 `expiresAt` (`Asia/Ho_Chi_Minh`, sent date = Day 1, own cutoff =
  `00:00` start of Day 16, min with `Job.applicationDeadline`), and commits
  `JobInvitation(PENDING)` plus durable `JOB_INVITATION_RECEIVED` in one
  MongoDB transaction. Existing Application, `PENDING`, and `REJECTED` block
  Send; `EXPIRED`/`REVOKED`/`INVALIDATED` do not self-block resend; effective
  `PENDING` blocks Direct Apply. Concurrent Send and Direct Apply share
  `acquireCandidateJobSerialization` on existing Job then Candidate User
  documents. Send does not create Application, Conversation, or Message.
  Focused coverage in
  `test/application/v15-slice02-send-job-invitation.test.js` (16 tests). The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 140
  files / 1,348 tests).

## Verification status

- V15 Final Acceptance finding — Day-15 Invitation expiration production
  runtime trigger: focused coverage passed 3 tests in
  `test/application/v15-invitation-expiration-runtime.test.js`. Then
  `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 148 files / 1,449 tests).

- V15 Slice 09 Acceptance + Concurrency Closure: focused Slice 09 coverage
  passed 33 tests in
  `test/application/v15-slice09-acceptance-concurrency-closure.test.js`. Then
  `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 147 files / 1,446 tests). Coverage includes Candidate–Job
  exclusion under concurrent Send/Accept/Direct Apply, resend after real
  `EXPIRED`/`REVOKED`/`INVALIDATED`, `REJECTED` Invitation block with Direct
  Apply still allowed, one terminal winner among Accept/Reject/Revoke and
  expiration/invalidation, stale `PENDING` without authority, delayed
  materialization that does not change a committed winner, Job `CLOSED` →
  `EXPIRED`, Generated/Uploaded snapshot lock, Send snapshot-versus-CandidateCV
  revision races, Accept/Reject/Revoke versus concurrent invalidation-source
  races, Accept-created Application
  continuation on V10–V12 owners, tenant/ownership denial, Notification
  reference matrix and V13 recovery, and deferred-scope absence.
