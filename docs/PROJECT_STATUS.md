# JOBHUB Project Status

## Current project state

**V14 — Candidate Search trên CV PUBLIC** is `IN PROGRESS`.
Its approved canonical Product/Data contracts are tracked at
`docs/product/versions/v14-candidate-search-public-cv.md` and
`docs/data/versions/v14-candidate-search-public-cv-data-model.md`.

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
groups only: Category + Experience (`BR-17`–`BR-19`, `BR-21`–`BR-23`). The
canonical owner remains `candidate-cv.service.js`, extending the existing Slice
02 browse workflow (no parallel eligibility path) so filters are applied only
within the already search-eligible CandidateCV pool. Category filter reuses the
canonical V4/V7 Category hierarchy: selected `POSITION` matches that POSITION;
selected `FIELD` matches the FIELD and all child POSITION categories. Multiple
Category values in-group are OR-composed. Experience filter reuses canonical V7
representation (`experienceLevelId -> ExperienceLevel`) and OR-composes
multiple selected Experience values in-group. Cross-group composition is AND
between Category and Experience when both are present. When a group is not
filtered, missing metadata for that group does not exclude a CV; when a group
is filtered, missing corresponding metadata does not match. No metadata
inference from full CV content was added. HTTP browse now accepts
`categoryIds`/`experienceLevelIds` query filters; Slice 03 intentionally does
not add Skill/Location/EmploymentType/WorkMode filtering, keyword/full-text,
ranking, or Preview-side behavior.

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
(`test/auth/v14-candidate-search-browse-eligible-cvs.test.js`, 8 tests), and
`cd backend && npm run verify:agent` passed with architecture rules
`ARCH-001` through `ARCH-016`, 134 passing test files, and 1,281 passing tests.
ESLint reported 0 errors and the same 2 pre-existing `no-unused-vars` warnings
in `test/job/v6-acceptance.test.js`.

**V13 — Notification và phân phối realtime** is `IN PROGRESS`.
Its approved canonical Product/Data contracts are tracked at
`docs/product/versions/v13-notification-realtime-distribution.md` and
`docs/data/versions/v13-notification-realtime-distribution-data-model.md`.
Gate 00 corrects the canonical boundary before business implementation: V12
did not persist Notification, so V13 introduces both `Notification` and
`NotificationEvent` as new entities; every V13 Notification has a required
`eventId` and the `{ eventId, recipientUserId }` uniqueness is not partial.
V13 also inherits the V12 Interview Schedule lifecycle unchanged and does not
add `InterviewSchedule.COMPLETED` or `INTERVIEW_SCHEDULE_COMPLETED`.

Slice 01 is implemented and verified for the Durable Notification Kernel +
Recovery Foundation (`F11` partial; `BR-01`, `BR-04`, `BR-05`, `BR-47`–`BR-49`
and the persistence foundation of `TX-01`). It adds the canonical
`Notification` and `NotificationEvent` models, immutable recipient/content
snapshots, canonical type/reference invariants, durable-event and
event-recipient uniqueness indexes, idempotent materialization, and bounded
pending-event recovery. `notification.service.js` owns durable-event creation,
materialization, and recovery; source services may pass their active MongoDB
session so later slices can persist source state plus required obligation in
one transaction. `notification-recovery.worker.js` runs an immediate bounded
pass followed by non-overlapping passes; `backend/index.js` starts it after
collection readiness and stops it before MongoDB disconnect. Slice 01 does not
yet attach events to Direct Apply, Message, Assignment, Pipeline, Availability,
or Interview transitions; it adds no inbox/read API, realtime delivery,
delivery/session/presence persistence, or Job Invitation persistence.

Slice 02 is implemented and verified for Notification Inbox + Read State
(`F01`; `BR-01`–`BR-08`, `BR-43`). Authenticated Users can list and fetch only
their own durable Notifications, retrieve a User-wide unread total derived
solely from `readAt`, and explicitly open their own Notification via the
one-way, idempotent `null → Date` transition. Listing/fetching does not mark
Notifications read; no mark-all, mark-unread, bulk mutation, delete/archive,
module badge, delivery/session state, or realtime behavior is added.
Notification opening remains a Notification-only workflow: historical inbox
items stay readable independently of current referenced resource state, while
any resource navigation/action must continue through the canonical source
module's current authorization.

Slice 03 is implemented and verified for Direct Application Notification
(`F02`; `BR-09`–`BR-12`, `BR-47`–`BR-49`, `TX-01`). The canonical Direct Apply
service now creates an `APPLIED`, `UNASSIGNED` Application and the single
`DIRECT_APPLICATION_CREATED` durable obligation in one database transaction.
It snapshots the Candidate self-confirmation and current Job Primary's
unassigned-application message from trusted state, de-duplicates a shared
User recipient, and makes an immediate best-effort inbox materialization
attempt. Materialization failure leaves the committed Application and pending
event for Slice 01 recovery; no Assignment, Conversation, Message, realtime,
or other source workflow behavior is added.

Slice 04 is implemented and verified for Durable Chat Notification (`F07`
partial; `BR-10`, `BR-34`–`BR-37`, `BR-47`–`BR-49`, `TX-01`). Every successful
V11 NORMAL or canonical SYSTEM Message now persists a single
`CHAT_MESSAGE_CREATED` NotificationEvent in the same source transaction.
Recipient/content snapshots use trusted post-transition Application and current
Assignee state: Candidate sends notify the current Assignee, Assignee sends
notify the Candidate, and SYSTEM Messages notify only valid post-transition
participants. Human senders are excluded. Immediate materialization is
best-effort; a failure leaves the committed Message and pending obligation for
Slice 01 recovery, which remains idempotent. This slice adds no Assignment
Notification, realtime, delivery/read receipt, Conversation state, or Message
schema behavior.

Slice 05 is implemented for Assignment Notification (`F03`; `BR-10`–`BR-19`,
`BR-47`–`BR-50`, `TX-01`). Successful Assign, Reassign, and manual or automatic
Unassign now persist their respective `APPLICATION_ASSIGNED`,
`APPLICATION_REASSIGNED`, or `APPLICATION_UNASSIGNED` NotificationEvent inside
the same source transaction. Recipient/content snapshots use trusted winning
Application, outgoing/new Assignee, Job, and human actor state with actor
filtering; automatic Unassign has no synthetic actor and candidate content
does not expose lifecycle causes. Reassign remains one assignment event and any
canonical SYSTEM Message remains an independent `CHAT_MESSAGE_CREATED` event.
Post-commit inbox materialization is best-effort and recovery remains
idempotent; no pipeline, interview, or realtime behavior is added.

Slice 06 is implemented and verified for Pipeline + Withdraw + Availability
Request Notification (`F04`, `F05` partial; `BR-10`, `BR-11`, `BR-20`–`BR-24`,
`BR-47`–`BR-50`, `TX-01`). Winning Pipeline transitions, Candidate Withdraw,
and first Interview Proposal cutover now persist their required lifecycle
`NotificationEvent` obligations in the same source transaction:
`APPLICATION_STATUS_CHANGED` for non-terminal moves (including first proposal
`CONTACTED → INTERVIEW_SCHEDULED`), terminal `APPLICATION_HIRED` /
`APPLICATION_REJECTED` without a redundant status event,
`APPLICATION_WITHDRAWN` to the current Assignee or Job Primary when
UNASSIGNED, and `INTERVIEW_AVAILABILITY_REQUESTED` independently on
`→ CONTACTED` so both events coexist. Recipient/content snapshots use trusted
Application/Job/Assignee/Primary state with human actor filtering; Candidate
self-notify on Withdraw is excluded. Post-commit materialization is
best-effort; recovery remains idempotent. This slice does not change V10/V12
source lifecycles, Availability submit, Schedule notifications, Assignment
redesign, or realtime.

Slice 07 is implemented and verified for Candidate Availability First Submit
Notification (`F05` closure; `BR-25`–`BR-27`, `BR-47`–`BR-49`, `TX-01`). A
winning V12 first-submit now serializes with Application Assignment changes
without changing Application status, version, or timestamps. When the
Application is `ASSIGNED(A)`, the sole current `CandidateAvailability` and one
`INTERVIEW_AVAILABILITY_SUBMITTED` durable obligation for trusted current
Assignee A commit in the same transaction; recipient/content are snapshotted
from the persisted CompanyMember/User and Job state. When `UNASSIGNED`,
first-submit still commits with no NotificationEvent and no Primary, outgoing,
or future-Assignee fallback. Availability edit remains a separate current-set
workflow and creates no additional event. Post-commit materialization is
best-effort/recoverable and idempotent. This slice adds no Interview Schedule
Notification, Availability lifecycle change, or realtime behavior.

Slice 08 is implemented and verified for Interview Schedule Notification
(`F06`; `BR-10`, `BR-28`–`BR-33`, `BR-47`–`BR-50`, `TX-01`). The winning V12
proposal creation creates its independent `INTERVIEW_SCHEDULE_CREATED`
obligation for the Candidate alongside the first-proposal Application event
when applicable. Recruiter cancellation, expiration, and terminal Application
cancellation create `INTERVIEW_SCHEDULE_CHANGED` independently; terminal
cancellation coexists with its required Application event. Candidate
Confirm/Decline snapshot only the current Assignee at the guarded winning
transition, while `UNASSIGNED` responses preserve V12 behavior without an
event or recipient fallback. Every required event commits with the source
transition, and post-commit materialization remains best-effort, recoverable,
and idempotent. No V12 Availability, Assignment, Schedule history, or realtime
behavior changes.

Slice 09 is implemented and verified for Notification Realtime Distribution
(`F09`, `F11` realtime closure; `BR-04`, `BR-08`, `BR-42`–`BR-44`, `BR-50`;
Data §9.5 / §14.1). `realtime-distribution.service.js` owns Socket.IO
lifecycle, `authenticateAccess` handshake auth (ACTIVE User + valid
AuthSession only), in-memory `user:{userId}` membership, and recipient-scoped
Notification emit. `backend/index.js` attaches after the HTTP server exists
and closes the plane before MongoDB disconnect. `notification.service.js`
best-effort emits only after a durable `Notification` insert, outside any
MongoDB transaction; Socket failure does not roll back source state,
`NotificationEvent`, or `Notification`. Read state remains `Notification.readAt`.
Reconnect does not replay Socket history. Offline/resync uses durable
Notification and canonical Conversation HTTP reads (Slice 12); no Socket
replay orchestration is added to the realtime plane.

Slice 10 is implemented and verified for Message Realtime Distribution
(`F07` closure; `BR-34`–`BR-37`, `BR-50`; Data §9.5 / §14.1). After every
successful V11 NORMAL or canonical SYSTEM Message commit,
`application.service.js` best-effort emits `REALTIME_EVENT.MESSAGE` through
the Slice 09 authenticated multi-session connection plane to trusted
post-transition Conversation participants only: Candidate sends reach the
current Assignee, Assignee sends reach the Candidate, and SYSTEM Messages
reach valid post-transition participants with no stale-Assignee fan-out.
Emit is post-commit, best-effort, non-exactly-once, and does not roll back
persisted Message, `NotificationEvent`, or `Notification` on Socket failure.
Durable `CHAT_MESSAGE_CREATED` from Slice 04 is unchanged. Offline resync is
Slice 12; typing/presence/read receipt and delivery persistence remain out of scope.

Slice 11 is implemented and verified for Conversation State Realtime
(`F08`; `BR-38`–`BR-41`, `BR-50`; Data §8.14 / §9.5 / §14.1). After winning
Assignment or Application terminal transitions that change V11 Conversation
interaction mode, `application.service.js` best-effort emits
`REALTIME_EVENT.CONVERSATION_STATE` with `WRITABLE`, `PAUSED_UNASSIGNED`, or
`READ_ONLY` through the Slice 09 authenticated multi-session connection plane
to trusted post-transition Conversation participants only: Unassign emits
`PAUSED_UNASSIGNED` to the Candidate; Assign again emits `WRITABLE` to the
Candidate and current Assignee; terminal Pipeline/Withdraw emits `READ_ONLY`
to valid historical readers; Reassign `ASSIGNED(A) → ASSIGNED(B)` emits no
fake pause/resume cycle. Emit is post-commit, best-effort, creates no durable
`NotificationEvent`/`Notification`, and does not roll back source Application,
Assignment, or Conversation state on Socket failure. Focused coverage in
`test/notification/v13-slice11-conversation-state-realtime-distribution.test.js`
(9 tests). Reconnect/offline resync is implemented and verified in Slice 12.

Slice 12 is implemented and verified for Offline / Reconnect Resync (`F10`;
`BR-02`, `BR-45`, `BR-46`). Missed realtime events are not replayed on Socket
reconnect; clients recover authoritative state through existing durable HTTP
reads only — `GET /api/notifications` for Notification inbox,
`GET /api/candidate/applications/:applicationId/conversation` and
`GET /api/jobs/my-applications/:applicationId/conversation` for Message history
and current Conversation interaction mode derived from Application/Assignment
authority. No new resync endpoint, Socket event history, missed-event queue,
`SocketSession`, delivery cursor, or per-device sync persistence is added.
Focused coverage in
`test/notification/v13-slice12-offline-reconnect-resync.test.js` (6 tests).

**V12 — Interview Schedule** is `IN PROGRESS`: Slices 01–08 are implemented and
verified, while Slice 09 Final Acceptance is resolving recorded acceptance
findings. Slice 01 covers first Candidate Availability submit and Application-read projection
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
`docs/product/versions/v12-interview-schedule.md` and
`docs/data/versions/v12-interview-schedule-data-model.md`. Gate 00 closes the
V10 compatibility boundary: from V12 onward,
`CONTACTED → INTERVIEW_SCHEDULED` is valid only in the same business outcome as
the first `InterviewSchedule(PROPOSED)` creation. Pre-V12 Applications already
at `INTERVIEW_SCHEDULED` or later retain their historical state without
synthetic Availability/Schedule backfill, rollback, or inferred proposal
history; no new legacy state may be created after cutover.

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

**V11 — Conversation và Chat thuộc Application** is `COMPLETED AND VERIFIED`.
Slices 01–06 plus Slice 07 Final Acceptance & Regression Closure passed across
`F01`–`F10`, `BR-01`–`BR-55`, and `TX-01`–`TX-08`. Canonical Product/Data
contracts remain authority for the closed Conversation/Chat business scope.
Realtime Chat, Socket.IO, notification, attachment, read receipt, typing,
edit/delete/reaction, Direct Chat, Assignment History, Status History, and
Application Timeline stay out of V11 by approved product boundary (deferred /
later versions), not as remaining V11 business slices.

**V7 — Candidate Profile và thư viện CV** is `COMPLETED AND VERIFIED`. Slices
01–11 are implemented and verified
(Candidate Profile / F01; CandidateCV foundation + My CVs read / F02; Generated
CV Draft create / F03; Generated Builder save + completeness feedback / F04
Builder; Generated activation + ACTIVE edit lifecycle / F04 activation;
Uploaded CV create / F05; Uploaded PDF replace / F06; rename / common metadata /
visibility update / F07; Preview / Download / F08; Default CV management / F09;
Archive CV / F10). Recorded Final Acceptance blockers (Uploaded restricted
Cloudinary delivery; Harvard Unicode PDF fidelity; `hiddenSections[]` Harvard
vocabulary; Generated activation same-millisecond content CAS; CandidateCV
query-update local-invariant enforcement) are remediated and verified. Final
Acceptance / regression closure passed across F01–F10, BR-01–BR-46, and TX-01.

V7's approved business specification is at `docs/product/versions/v7-candidate-profile-cv-library.md`, and its approved persistence contract is at `docs/data/versions/v7-candidate-profile-cv-library-data-model.md`.

V1 through V7 are `COMPLETED AND VERIFIED`. The V6 focused closure baseline
passed 12 files / 155 tests and its official backend gate passed before this
readiness transition; no known V6 business-blocking finding remains.

V3 Slices 01–09 are implemented and verified under the backend gate below. Product F10 Recruiter update is intentionally out of V3 scope (reserved numbering; not deferred as a remaining slice).

V4 Slices 01–05 are implemented and verified. V5 Slices 01–12 and the recorded acceptance corrections are implemented; Final Acceptance / regression closure passed across F01–F12. V6 has Final Acceptance / regression closure across F01–F05, BR-01–BR-33, and TX-01–TX-03. V7 Final Acceptance / regression closure passed across F01–F10, BR-01–BR-46, and TX-01.

**V10 — Phân công Application và Recruitment Pipeline** Slices 01–10 of the
current `ASSIGN / UNASSIGN` revision are `IMPLEMENTED AND VERIFIED`. Slice 01
opened the persistence state matrix so every non-terminal Recruitment Status
can persist `UNASSIGNED` or Assigned. Slice 02 extends Primary Assign of
Unassigned Applications (`NONE → Recruiter`) to every non-terminal status on
`PUBLISHED`/`CLOSED`/`EXPIRED` Jobs, reusing the existing First Assign HTTP
surface and TX-01/TX-02 foundation. Slice 03 extends Primary Reassign /
Take over / Unassign (`A → B`, `A → Primary`, `A → NONE`) to every
non-terminal status on `PUBLISHED`/`CLOSED`/`EXPIRED` Jobs, converging those
mutations onto one current-assignee CAS foundation. Slice 04 extends the same
canonical Assign / Reassign / Unassign primitives to the owning-Company
Manager, without a recovery-only restriction and without Pipeline authority.
Slice 05 keeps Managed Jobs / Pipeline Workspace / Recruiter My Applications /
Candidate My Applications / Current Workload compatible with that matrix:
Unassigned remains assignment-state, not a pipeline group; reads use current
Assignee; workload stays derived and unpersisted. Slice 06 adds the canonical
internal automatic-Unassign primitive (`A → NONE`) so later lifecycle/team
operations can detach non-terminal Application responsibility of an outgoing
Recruiter without a public HTTP surface, replacement Recruiter, or synthetic
`A → B`. Slice 07 wires that primitive into CompanyMember Recruiter
LOCK/TERMINATE: non-terminal Applications are automatic-Unassigned
(`A → NONE`) before lifecycle completion, Job-team Primary transfer and
Supporting removal still follow V6 (no `NONE Primary`), and the final
zero-responsibility guard reads current persisted Job + Application state.
Slice 08 wires the same primitive into Recruitment Team removal
(`removeSupportingRecruiter`, Primary leave via `replacePrimaryRecruiter`):
Job-scoped non-terminal Applications assigned to the outgoing Recruiter become
`A → NONE` before team-removal completion; Primary↔Supporting role changes
while the Recruiter remains on-team and eligible do not Unassign; V6 Job-team
invariants (exactly one Primary; no Application replacement) remain.
Slice 09 wires the same primitive into Platform Admin Recruiter User
LOCK/TERMINATE: V1 User lifecycle still commits without Job/Application
zero-responsibility guard and without mutating CompanyMember or Job-team;
after eligibility loss, current non-terminal Applications are automatic
Unassigned (`A → NONE`) independently per Application (TX-05).
Slice 10 closes concurrency/final acceptance: deterministic TX-01/TX-02/TX-05
race coverage across Assign/Reassign/Unassign/Pipeline/Replace/Withdraw and
lifecycle/team/Platform eligibility races; Platform already-`LOCKED` retry
reconciles remaining Application responsibilities without forcing TERMINATE;
dead trusted pre-lifecycle A→B handoff helper removed (CM `force-reassign`
remains the public A→B compatibility surface). The current Product/Data
contracts remain approved implementation authority. V10 Assignment Model
Revision is `COMPLETED AND VERIFIED`.
The prior implementation and its 104-file / 893-test green baseline encoded
the old state matrix and direct-handoff lifecycle semantics; that baseline
remains regression history, not completion evidence for the current canonical
revision.

Previous V10 implementation baseline (historical, not current completion
evidence) has Slice 01 —
Application persistence foundation, Slice 02 — V9 compatibility +
Job-retention compatibility, Slice 03 — Unassigned Applications +
Primary Application View, Slice 04 — First Assign Application,
Slice 05 — Reassign / Take over Application, Slice 06 — Company Manager
Administrative Forced Reassignment, the Slice 07 corrective assignment/
handoff lifecycle-boundary foundation, Slice 08 — Recruiter LOCK /
TERMINATE Unified Responsibility Handoff, Slice 09 — Recruitment Team
Eligibility-Loss Application Handoff, Slice 10 — Recruitment Pipeline,
Slice 11 — Managed Jobs / Pipeline Workspace / Current Workload,
Slice 12 — Recruiter My Applications, and Slice 13 — Candidate My
Applications, plus the V10 F11 business extension — Platform Admin Recruiter
Account Lock/Terminate → Company Responsibility Recovery. That prior revision's
Final Acceptance / regression closure passed across F01–F11, BR-01–BR-53, and
TX-01–TX-05. The canonical Product/Data contract paths are
`docs/product/versions/v10-application-assignment-recruitment-pipeline.md`
and
`docs/data/versions/v10-application-assignment-recruitment-pipeline-data-model.md`.
Slice 01 extends the canonical Application status vocabulary to the eight V10
Recruitment Statuses, adds nullable `assignedRecruiterCompanyMemberId`
(legacy absent and explicit `null` both mean Unassigned; no V9 backfill),
enforces the local status×assignment matrix, keeps `version`/CAS, and adds
IDX-A02–A05 while preserving Candidate–Job uniqueness and V9 identity/snapshot
invariants. Slice 02 locks V9 Direct Apply / Replace / Withdraw behavior onto
the V10 Application shape (Assigned APPLIED still Replace/Withdraw; Withdraw
keeps Assignee; SCREENING locks Candidate Replace/Withdraw; CLOSED/EXPIRED
blocks Replace but not Withdraw and does not auto-mutate Applications) and
keeps Job retention on the V5 lifecycle without an Application↔Job delete
transaction. Slice 03 adds Primary-only
`GET /api/jobs/:jobId/applications` so the current Primary Recruiter can read
Direct Applications of that Job (Assigned and Unassigned), deriving Unassigned
from missing/null assignee rather than status, exposing Candidate, Job,
Recruitment Status, current Assignee, `appliedAt`, and `submittedCvSnapshot`
without mutating Application state or opening CandidateCV library access.
Slice 04 adds Primary-only First Assign via
`POST /api/jobs/:jobId/applications/:applicationId/assign` so an Unassigned
`APPLIED` Direct Application becomes Assigned to an eligible Primary or
Supporting Recruiter without changing status/snapshot/identity, using
version/Unassigned CAS (TX-01) and eligibility re-check at commit (TX-02).
Slice 05 adds Primary-only Reassign / Take over via
`POST /api/jobs/:jobId/applications/:applicationId/reassign` so a non-terminal
Assigned Application transfers responsibility atomically `A → B` (Take over =
target is current Primary) without Unassign, status/snapshot/identity changes,
or takeover history fields, reusing First Assign eligibility and version +
expected-assignee CAS. Slice 06 adds Company Manager-only administrative forced
reassignment via
`POST /api/jobs/:jobId/applications/:applicationId/force-reassign` when the
current Assignee is operationally ineligible, transferring `A → B` to an
eligible Recruiter without making the Manager an Assignee, without arbitrary
reassignment while Assignee remains eligible, and without Job-status blocking
on `CLOSED`/`EXPIRED`. The Slice 07 corrective foundation adds trusted internal
pre-lifecycle handoff (`executeTrustedPreLifecycleApplicationHandoff`) for
still-eligible Assignees that are verified subjects of an eligibility-losing
operation, keeps public CM force-reassign recovery-only, and joins First Assign/
Reassign/handoff target commits to the shared TX-02 multi-dimension Assignee
eligibility acquires (Company + CompanyMember + User + Job team). Slice 08 extends existing Recruiter LOCK /
TERMINATE so Active Recruiter Responsibility is the union of V6 Job-team
responsibility and non-terminal Application responsibility
(PUBLISHED/CLOSED/EXPIRED), reuses V6 forced-transfer plus Slice 07 trusted
pre-lifecycle Application handoff before lifecycle completion, and commits
`LOCKED`/`TERMINATED` only after the dual zero-responsibility final guard
(TX-05 partial progress preserved). Slice 09 extends V6 Recruitment Team
operations that remove a Recruiter from the current team
(`removeSupportingRecruiter`, Primary leave via `replacePrimaryRecruiter`) so
required non-terminal Application handoff completes before team-removal
commit, reusing Slice 07 trusted A→B with canonical V6 replacement context
(Supporting leave → current Primary; Primary leave → new Primary) while
PRIMARY→SUPPORTING keep-eligible leaves assignments unchanged; V6 PUBLISHED-only
normal team-mutation gates are preserved. F11 additionally allows the existing
CM replace-Primary/remove-Supporting surfaces on unfinished `DRAFT` or
`PENDING_APPROVAL` only when persisted outgoing Platform User is already
`LOCKED`/`TERMINATED`; it does not open normal team management or mutate
`CLOSED`/`EXPIRED` team history. Slice 10 adds current-Assignee-only
Recruitment Pipeline via
`POST /api/jobs/:jobId/applications/:applicationId/pipeline` with canonical
forward and Reject transitions, continuous eligibility at commit, status/version
CAS (TX-01), and CLOSED/EXPIRED Job continuity for existing Applications.
Slice 11 adds Primary Managed Jobs read projections via
`GET /api/jobs/managed` and `GET /api/jobs/:jobId/workspace`: Jobs where the
actor is current `primaryRecruiterCompanyMemberId` (including
`PUBLISHED`/`CLOSED`/`EXPIRED`), eight-status Pipeline grouping, Unassigned as
assignment-state only, and Current Workload derived from non-terminal assigned
Applications scoped to the actor’s Managed Jobs (never company-global; never
filtered by `Job.status = PUBLISHED`; never persisted as counters/KPI). Slice 12
adds Recruiter My Applications via `GET /api/jobs/my-applications` and
`GET /api/jobs/my-applications/:applicationId` as a current-assignee projection
(`assignedRecruiterCompanyMemberId` = actor CompanyMember), including
Applications on `PUBLISHED`/`CLOSED`/`EXPIRED` Jobs, exposing Candidate/Job/
status/Assignee/`appliedAt`/`submittedCvSnapshot` without CandidateCV library
access, keeping terminal Applications readable but out of active workload, and
never granting Pipeline authority from list membership alone. Slice 13 adds
Candidate My Applications via `GET /api/candidate/applications` and
`GET /api/candidate/applications/:applicationId` as an owner-scoped projection
(`candidateUserId` = authenticated Candidate), covering all eight Recruitment
Statuses and Jobs in `PUBLISHED`/`CLOSED`/`EXPIRED`, with Job + Company +
snapshot + live Assignee `fullName`/`avatarUrl`/`jobTitle` only (no email/phone
or Assignment History), optional status/`q` filters, and no mutation of
Application state or expansion of Replace/Withdraw/Pipeline authority.
The current canonical V10 Product Specification covers F01–F11 and BR-01–BR-53.
Slice 01 reuses the existing Application field, indexes, revision/CAS,
Candidate–Job uniqueness, identity immutability, and snapshot contract. It
changed only the local status × assignment-state persistence matrix so every
non-terminal Recruitment Status can persist `UNASSIGNED`; no new V10
persistence entity, field, collection, counter, history, index, migration, or
backfill was added.

**V8 — Job Discovery** is roadmap-status `PENDING`. Its Product and Data
documents are planning drafts only: they are intentionally held for later
versions, have no approval or implementation authority, and Slice 01 must not
start. Before any V8 implementation, approve and track the reconciled V8
contracts, and explicitly move V8 out of `PENDING` in both this document and
the roadmap.

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

## Operational provisioning

- **Provisioned and login-verified:** The single platform-configured administrator account is present in MongoDB Atlas as one `PLATFORM_ADMIN`, with `ACTIVE` status, a verified email, `mustChangePassword=false`, and a bcrypt password hash. Its previous sessions and temporary authentication tokens were revoked during provisioning; a live login verification succeeded and the verification session was removed. The account identifier and secrets are intentionally not recorded in repository documentation.

## Current V11 Conversation revision

- **Implemented; verified:** V11 Slice 07 — Final Acceptance & Regression
  Closure (`F01`–`F10`; `BR-01`–`BR-55`; `TX-01`–`TX-08`): cross-cutting
  acceptance suite confirms Slices 01–06 compose into one Conversation
  lifecycle (First Assign → NORMAL exchange → Reassign → Manual Unassign →
  Assign lại → terminal) with a single Conversation id and required SYSTEM
  Message transcript; closes authorization-matrix gaps (Platform Admin /
  Company Manager / foreign Candidate / Primary-not-Assignee / Take over Chat
  handoff / BR-48 history-does-not-authorize); Company-lock freeze without
  Unassign or SYSTEM; HIRED/REJECTED read-only with no terminal SYSTEM and no
  Assign reopen; withdraw-before-Assign leaves no Conversation; Job
  `CLOSED`/`EXPIRED` does not override `PAUSED_UNASSIGNED`; complementary
  TX-06–TX-08 keep/fail races (a valid Send completed before an invalidating
  transition is retained; a completed Reassign/Take over/Unassign/terminal/
  Company-lock/eligibility-loss transition rejects stale Send; Assign again
  restores current Send authority on the same Conversation); deferred-scope
  absence; and V10 assignment/pipeline regression with Conversation side
  effects. Focused coverage in
  `test/application/v11-acceptance.test.js` (20 tests). Combined focused V11
  baseline: 8 files / 104 tests. Official backend gate passed after the final
  acceptance remediations
  (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`;
  architecture: ARCH-001 through ARCH-016; Vitest: 119 files / 1,140 tests).

- **Resolved; verified:** V11 Final Acceptance findings (`F02`, `F06`, `F10`;
  `BR-25`, `BR-29`, `BR-30`, `BR-43`, `BR-46`, `BR-49`, `BR-55`; `TX-05`,
  `TX-06`): NORMAL Message Send guard acquires no longer leave guard-document
  `updatedAt` changes; `commitNormalMessageSend` reuses canonical TX-02 acquires
  and the Application writable CAS, then restores each touched document's
  pre-Send timestamp inside the same MongoDB transaction via
  `acquireWithRestoredUpdatedAt`, preserving serialization/write-conflict
  behavior while successful Send persists only the new Message. Complementary
  eligibility-loss ordering now verifies that a Message completed first is
  retained through the later Automatic Unassign consequence. Actual Send ↔
  Assign-again ordering now verifies both rejection while
  `PAUSED_UNASSIGNED` and successful current-authority evaluation when Assign
  again completes first, while reusing the same Conversation and preserving
  Recruitment Status. Regressions are in
  `test/application/v11-normal-message-send.test.js` and
  `test/application/v11-acceptance.test.js`. The current focused V11 baseline
  passes 8 files / 104 tests; the official backend gate passes ESLint with 0
  errors / 2 existing warnings, ARCH-001 through ARCH-016, and Vitest with 119
  files / 1,140 tests.

- **Implemented; verified:** V11 Slice 06 — NORMAL Message Send + Full Chat
  Concurrency (`F02` send, `F07`–`F10`; `BR-13`–`BR-14`, `BR-25`, `BR-32`,
  `BR-34`, `BR-39`–`BR-46`, `BR-49`–`BR-50`, `BR-54`; `TX-06`–`TX-08`): Candidate
  owner and current continuously eligible Assigned Recruiter may send `NORMAL`
  Message only while Conversation is writable (`ACTIVE`), reusing
  `evaluateApplicationConversationChatAuthority` and V10 TX-02 commit acquires
  (Company → CompanyMember → User → Job team) plus Application writable CAS that
  does not bump `version` or mutate Recruitment Status, Assignment State,
  Candidate, Job, source, or `submittedCvSnapshot`. Sender identity is
  server-owned (Candidate User only; Recruiter User + CompanyMember); client
  cannot create `SYSTEM` Message or declare sender fields. Job `CLOSED` /
  `EXPIRED` does not block Send. Deterministic races cover Send ↔
  Reassign / Unassign / Withdraw / Company lock / Platform eligibility loss /
  Assign again, including the required complementary completion orderings.
  HTTP: `POST /api/candidate/applications/:applicationId/conversation/messages`
  and `POST /api/jobs/my-applications/:applicationId/conversation/messages`
  (Recruiter business access requires Company operational). Realtime,
  notification, and attachment remain out of this slice. Focused coverage in
  `test/application/v11-normal-message-send.test.js` (1 file / 15 tests).
  The latest official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 119 files / 1,140 tests).

- **Implemented; verified:** V11 Slice 05 — Conversation History Read +
  Authorization Modes (`F02` read portion, `F04`/`F05`/`F07`/`F08`/`F09` read
  modes; `BR-07`–`BR-12`, `BR-16`–`BR-17`, `BR-22`, `BR-31`–`BR-40`, `BR-48`,
  `BR-51`–`BR-52`, `BR-54`, `BR-55`): extends
  `evaluateApplicationConversationChatAuthority` so derived modes
  `ACTIVE` / `PAUSED_UNASSIGNED` / `ELIGIBILITY_LOSS_WINDOW` /
  `FROZEN_COMPANY` / `READ_ONLY` authorize Conversation history from current
  Application/lifecycle facts only (never Message history, participant lists,
  or duplicated Conversation state). Candidate owner reads in every mode where
  Conversation exists; current continuously eligible Assignee reads ACTIVE;
  no Recruiter reads while `UNASSIGNED` or in the eligibility-loss window;
  Company-lock freeze and terminal history allow persisted/final Assignee read
  only when `User` and `CompanyMember` are both `ACTIVE`, without requiring
  Company operational or current Recruitment Team membership; Job
  `CLOSED`/`EXPIRED` does not revoke ACTIVE read; new Assignee after
  Reassign/Assign again reads full history with preserved sender identity.
  HTTP surfaces: `GET /api/candidate/applications/:applicationId/conversation`
  and `GET /api/jobs/my-applications/:applicationId/conversation` (Recruiter
  Chat-history context permits frozen/terminal read when Company is LOCKED).
  NORMAL Message Send, TX-06–TX-08, realtime, notification, and attachment
  remain out of this slice. Focused coverage in
  `test/application/v11-conversation-history-read.test.js` (1 file / 13
  tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 117 files / 1,105 tests).

- **Implemented; verified:** V11 Slice 04 — Automatic Unassign Chat Consequence
  (`F05`; `BR-23`, `BR-26`–`BR-28`, `BR-47`, `BR-51`, `BR-54`, `BR-55`; `TX-04`):
  extends canonical `automaticallyUnassignApplication` so each non-terminal
  Application Automatic Unassign `A → NONE` that already has a Conversation
  keeps that Conversation and Message history, keeps Recruitment Status, and
  creates exactly one awaiting-assignee SYSTEM Message (no human sender; no
  lifecycle/team-removal reason exposure) in the same per-Application
  transaction. Missing Conversation keeps V10 behavior (`A → NONE` only; no
  Conversation or SYSTEM Message created for V11). Failed CAS / Message-create
  failure cannot leave Automatic Unassign without the required SYSTEM Message,
  or a SYSTEM Message without the corresponding `A → NONE`. Batch lifecycle /
  team callers remain independent per Application (no global all-or-nothing).
  CompanyMember LOCK/TERMINATE, Recruitment Team removal, and Platform Admin
  User LOCK/TERMINATE reuse the same consequence. Adds pure
  `evaluateApplicationConversationChatAuthority` so eligibility-loss window
  denies Send immediately (Candidate read-only; outgoing Recruiter neither
  reads nor sends) and BR-54 denies LOCKED/TERMINATED Recruiter Chat access
  despite historical association — without implementing Send/read HTTP,
  Company-lock freeze, or terminal read-only surfaces. Focused coverage in
  `test/application/v11-automatic-unassign-chat-consequence.test.js` (1 file /
  12 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 116 files / 1,092 tests).

- **Implemented; verified:** V11 Slice 03 — Manual Unassign + Assign lại
  (`F04`, `F06`; `BR-21`–`BR-25`, `BR-29`–`BR-30`, `BR-47`, `BR-51`; `TX-03`,
  `TX-05`): successful Manual Unassign `A → NONE` on a non-terminal Application
  that already has a Conversation keeps that Conversation and Message history,
  keeps Recruitment Status, and creates exactly one awaiting-assignee SYSTEM
  Message in the same V10 Unassign transaction. Successful Assign again
  `NONE → B` when Conversation already exists reuses that Conversation (no
  second Conversation), keeps Recruitment Status/history, and creates exactly
  one new-assignee SYSTEM Message in the same Assign transaction. Unassigned
  Applications with no Conversation continue First Assign behavior (create
  Conversation, no SYSTEM Message). Missing Conversation on Unassign does not
  create Conversation or SYSTEM Message. Failed CAS / Message-create failure
  cannot leave Unassign or Assign again without the required SYSTEM Message, or
  a SYSTEM Message without the corresponding assignment transition. Automatic
  Unassign Chat consequence is Slice 04. Send/read, authorization HTTP,
  Company-lock freeze, terminal read-only, realtime, notification, and
  attachment remain out of this slice. Focused coverage in
  `test/application/v11-unassign-assign-again-system-message.test.js` (1 file /
  11 tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 115 files / 1,080 tests).

- **Implemented; verified:** V11 Slice 02 — Reassign / Take over + SYSTEM
  Message (`F03`; `BR-15`–`BR-20`, `BR-47`, `BR-51`; `TX-02`): successful
  Reassign / Take over / CM force-reassign `A → B` on a non-terminal Application
  that already has a Conversation keeps that Conversation and all Message
  history (including historical sender identity), keeps Recruitment Status, and
  creates exactly one SYSTEM Message (no human sender) reflecting the
  responsibility transition in the same V10 assignment transaction. Missing
  Conversation does not create Conversation or SYSTEM Message. Unassign does
  not create SYSTEM Message in this slice. Failed CAS / Message-create failure
  cannot leave assignee changed without the required SYSTEM Message, or a
  SYSTEM Message without the corresponding assignment transition. V10
  authority, eligibility, tenant, expected-assignee/CAS invariants are
  unchanged. Automatic Unassign Chat consequence, Send/read, authorization,
  Company-lock freeze, terminal read-only, realtime, notification, and
  attachment remained out of this slice (Manual Unassign / Assign again Chat
  consequences are Slice 03). Focused coverage in
  `test/application/v11-reassign-takeover-system-message.test.js` (1 file / 10
  tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 114 files / 1,069 tests).

- **Implemented; verified:** V11 Slice 01 — Conversation & Message Foundation +
  First Assign (`F01`; `BR-01`–`BR-06`, `BR-13` persistence foundation,
  `BR-49`, `BR-50`, `BR-53`; `TX-01`): adds canonical `conversations` and
  `messages` persistence (`Conversation.applicationId` unique/immutable;
  Message `NORMAL`/`SYSTEM` with historical sender matrix; no Candidate,
  current Assignee, Job, Company, participant list, or Chat-state duplication).
  Successful First Assign of a non-terminal Unassigned Application that has
  never had a Conversation keeps Recruitment Status, creates exactly one
  Conversation, and creates no SYSTEM Message (`0` Messages is valid). Assign
  and Conversation creation commit in the same V10 First Assign transaction;
  Conversation-create failure rolls back Assign. V10 authority, eligibility,
  tenant, Assignment State, and CAS invariants are unchanged. Reassign/Take
  over/Unassign SYSTEM Message, Assign again Chat consequence, Send/read,
  authorization, Company-lock freeze, terminal read-only, realtime,
  notification, and attachment remain out of this slice. Focused coverage in
  `test/application/v11-conversation-message-foundation.test.js` and
  `test/application/v11-first-assign-conversation.test.js` (2 files / 23
  tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 113 files / 1,059 tests).

## Current V10 ASSIGN / UNASSIGN revision

- **Implemented; verified:** V10 Slice 01 — Persistence State Matrix (F01, F02,
  F03, F04, F11 persistence enabler; BR-03–BR-05, BR-10, BR-17, BR-20, BR-28,
  BR-52; PI-07, PI-10, PI-14, PI-23, PI-26; TX-01 foundation): updates the
  Application local and collection status × assignment-state matrix so every
  non-terminal Recruitment Status (`APPLIED`, `SCREENING`, `CONTACTED`,
  `INTERVIEW_SCHEDULED`, `INTERVIEW_COMPLETED`) may persist Unassigned
  (`assignedRecruiterCompanyMemberId` null/absent) or a current Assignee;
  `UNASSIGNED` remains assignment-state only and is not a Recruitment Status;
  `HIRED`/`REJECTED` still require a final Assignee; `WITHDRAWN` keeps V9
  compatibility (null or last Assignee). No status-enum, field, collection,
  index, migration, or backfill change. Assign/Unassign/Reassign APIs,
  automatic Unassign, and later-slice orchestration are unchanged. Focused
  coverage in `test/application/v10-application-foundation.test.js` and
  `test/application/v9-application-root-field-collection-validator.test.js`
  (2 files / 37 tests). The official backend gate passed (ESLint: 0 errors / 2
  existing warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through
  ARCH-016; Vitest: 104 files / 900 tests).

- **Implemented; verified:** V10 Slice 02 — Assign Unassigned Application at
  every non-terminal Recruitment Status by Primary Recruiter (F02, F09;
  BR-06–BR-11, BR-17, BR-27, BR-36–BR-38, BR-40; TX-01, TX-02): extends the
  existing `firstAssignApplication` / `POST /api/jobs/:jobId/applications/:applicationId/assign`
  owner so current Primary can Assign an Unassigned Application (`NONE → Recruiter`)
  to self or a current eligible Supporting Recruiter from `APPLIED`,
  `SCREENING`, `CONTACTED`, `INTERVIEW_SCHEDULED`, or `INTERVIEW_COMPLETED`,
  including on `CLOSED`/`EXPIRED` Jobs. Assign mutates only current Assignee and
  concurrency metadata; Recruitment Status, Candidate, Job, source,
  `submittedCvSnapshot`, and Recruitment Team are unchanged. Target eligibility
  is revalidated at commit (TX-02). Supporting cannot self-claim. Terminal and
  already-Assigned Applications are rejected. Concurrent/stale Assign cannot
  overwrite a newer state. Company Manager Assign was later delivered in
  Slice 04. Unassign, Reassign/Take over behavior from Slice 02's perspective,
  and automatic eligibility-loss Unassign, remained later slices at that time. Focused
  coverage in `test/application/v10-first-assign.test.js` (1 file / 28 tests).
  The official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 104
  files / 914 tests).

- **Implemented; verified:** V10 Slice 03 — Primary Reassign / Take over /
  Unassign Application (F03, F09, F10; BR-10–BR-14, BR-17–BR-19, BR-27,
  BR-33–BR-38; TX-01, TX-02, TX-03): current Primary can change the current
  Assignee of every non-terminal Direct Application via atomic `A → B`
  (Reassign), `A → Primary` (Take over), or `A → NONE` (Unassign) on
  `PUBLISHED`/`CLOSED`/`EXPIRED` Jobs. Mutations reuse one assigned-state CAS
  foundation (`commitAssignedAssigneeMutation`) and Slice 02 TX-02 eligibility
  only when the target is not `NONE`. Successful writes change only current
  Assignee and concurrency metadata. After Unassign, the Application leaves
  My Applications/workload, appears in the Unassigned projection, and cannot
  continue Pipeline until Assign again. Terminal Applications and Supporting
  Recruiter authority are rejected. Stale expected-assignee/version operations
  cannot overwrite a newer Assignee or `NONE`. Company Manager assignment
  management was delivered in Slice 04. Automatic eligibility-loss Unassign
  remains a later slice.
  Focused coverage in `test/application/v10-reassign-takeover.test.js`
  (1 file / 40 tests). Adjacent First Assign and force-reassign suites
  remained green (3 files / 85 tests together). The official backend gate
  passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 104
  files / 936 tests).

- **Implemented; verified:** V10 Slice 04 — Company Manager Application
  Assignment Management (F01, F02, F04, F09; BR-06–BR-08, BR-10–BR-11,
  BR-15–BR-17, BR-27, BR-36–BR-38, BR-40, BR-42, BR-53; TX-01, TX-02, TX-03):
  owning-Company Manager can Assign (`NONE → Recruiter`), change Assignee
  (`A → B`), and Unassign (`A → NONE`) every non-terminal Direct Application
  on `PUBLISHED`/`CLOSED`/`EXPIRED` Jobs. Actor-specific CM work is
  authorization/scope only; mutations reuse `firstAssignApplication` /
  `reassignApplication` / `unassignApplication` and the Slice 02–03 CAS plus
  TX-02 eligibility-at-commit primitives. CM does not become Assignee and has
  no Pipeline or snapshot-delivery authority. Tenant resolves from
  authenticated CM membership → owning Company → Job → Application.
  Historical `forceReassignApplication` remains a CM-only A→B compatibility
  wrapper without the former recovery-only restriction. Automatic Unassign,
  CompanyMember LOCK/TERMINATE, Recruitment Team removal, and Platform Admin
  Unassign are unchanged. Focused coverage in
  `test/application/v10-company-manager-assignment.test.js` (1 file / 28 tests).
  Adjacent First Assign, Reassign/Unassign, force-reassign, Primary view, and
  Slice 07 handoff suites remained green (6 files / 134 tests together). The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 105
  files / 964 tests).

- **Implemented; verified:** V10 Slice 05 — Read Projections and Current
  Workload Compatibility (F06, F07, F08, F09, F10; BR-03, BR-05, BR-18–BR-20,
  BR-25, BR-27, BR-30–BR-35, BR-41, BR-43): existing Managed Jobs, Pipeline
  Workspace, Recruiter My Applications, Candidate My Applications, and Current
  Workload owners remain the canonical read projections. Every non-terminal
  Application may be `ASSIGNED` or `UNASSIGNED`; Unassigned Applications still
  occupy their Recruitment Status pipeline group and the independent Unassigned
  filter, which uses current `assignedRecruiterCompanyMemberId` rather than
  `APPLIED`. Recruiter My Applications follows current Assignee only
  (`A → NONE` / `A → B` remove from A; `NONE → B` / `A → B` add to B) and does
  not grant Pipeline authority from list membership. Candidate My Applications
  keeps owner visibility at every Recruitment Status, nulls assignee-facing
  fields after Unassign, and shows the new Assignee after Assign again without
  history or extra recruiter data. Current Workload counts only non-terminal
  assigned Applications, including on `CLOSED`/`EXPIRED` Jobs, and is never
  persisted. No new field, collection, index, migration, or workload counter
  was added. Automatic Unassign / CompanyMember LOCK/TERMINATE / team-removal /
  Platform Admin lifecycle Unassign remain later slices. Focused coverage in
  `test/application/v10-assignment-read-projections.test.js` (1 file / 8 tests).
  The official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 106
  files / 972 tests).

- **Implemented; verified:** V10 Slice 06 — Canonical Automatic-Unassign
  Primitive (F04, F09, F11; BR-08, BR-10–BR-11, BR-17, BR-28, BR-31,
  BR-33–BR-38, BR-48–BR-53; TX-01, TX-02, TX-05): trusted internal
  `automaticallyUnassignApplication` detaches a non-terminal Application
  (`A → NONE`) still assigned to the expected outgoing Recruiter. It reuses
  `commitAssignedAssigneeMutation` (version + expected Assignee + non-terminal
  status CAS) and does not create a second mutation engine. Successful writes
  change only `assignedRecruiterCompanyMemberId → null`, `version + 1`, and
  existing concurrency/timestamp metadata. Recruitment Status, Candidate, Job,
  source, `submittedCvSnapshot`, and Recruitment Team are unchanged. No
  replacement Recruiter and no synthetic `A → B`. Terminal Applications keep
  the final Assignee. `automaticallyUnassignCurrentResponsibilitiesOfRecruiter`
  detaches current non-terminal responsibilities independently per Application
  (TX-05: no global all-or-nothing transaction, no persisted progress/recovery
  state). Retry always rereads current persisted Application state. Not a
  public HTTP surface. Not wired into CompanyMember LOCK/TERMINATE, Recruitment
  Team removal, or Platform Admin User lifecycle. Focused coverage in
  `test/application/v10-automatic-unassign.test.js` (1 file / 22 tests). The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 107
  files / 994 tests).

- **Implemented; verified:** V10 Slice 07 — CompanyMember Recruiter LOCK /
  TERMINATE automatic Unassign integration (F04, F09, F11; BR-08, BR-27–BR-28,
  BR-36–BR-38, BR-46, BR-50–BR-53; TX-02, TX-05): Company Manager
  `lockRecruiter` / `terminateRecruiter` reuse Slice 06
  `automaticallyUnassignCurrentResponsibilitiesOfRecruiter` so every
  non-terminal Application assigned to the outgoing Recruiter becomes
  `A → NONE` before lifecycle completion. Application replacement is not
  required and CompanyMember lifecycle no longer performs automatic
  Application `A → B` handoff. Recruitment Status, Candidate, Job, source, and
  `submittedCvSnapshot` are preserved; terminal Applications keep their final
  Assignee. Job-team responsibility still follows V6 (Primary replacement via
  `transfers[]` when needed; Supporting removal; no `NONE Primary`). Final
  guard requires `activeJobResponsibilityCount == 0` and
  `nonTerminalAssignedApplicationCount == 0` from current persisted state.
  TX-05 keeps independently committed Application detaches; retry continues
  from current responsibilities; concurrent Assign before the final boundary
  is visible to the guard; stale automatic Unassign cannot clear a newer
  Assignee. Generic Recruitment Team removal and Platform Admin User
  LOCK/TERMINATE are unchanged by this slice (team removal is Slice 08). Focused
  coverage in
  `test/application/v10-lock-terminate-application-handoff.test.js`
  (1 file / 17 tests). The official backend gate passed (ESLint: 0 errors / 2
  existing warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through
  ARCH-016; Vitest: 107 files / 998 tests).

- **Implemented; verified:** V10 Slice 08 — Recruitment Team Removal
  automatic Unassign integration (F09, F11; BR-08, BR-27–BR-28, BR-36–BR-38,
  BR-50–BR-52; TX-02, TX-05): `removeSupportingRecruiter` and Primary leave via
  `replacePrimaryRecruiter` reuse Slice 06 Job-scoped automatic Unassign
  (`automaticallyUnassignRecruiterApplicationsOnJobForTeamRemoval` →
  `automaticallyUnassignCurrentResponsibilitiesOfRecruiterOnJob`) so every
  non-terminal Application of the mutated Job still assigned to the outgoing
  Recruiter becomes `A → NONE` before team-removal completion. No Application
  replacement and no synthetic `A → B` / Take-over to Primary or new Primary.
  Primary↔Supporting role changes while the Recruiter remains on-team and
  eligible do not Unassign. Recruitment Status, Candidate, Job, source, and
  `submittedCvSnapshot` are preserved; terminal Applications keep their final
  Assignee; only Applications of the mutated Job are detached. V6 Job-team
  invariants remain (exactly one Primary; PUBLISHED-only normal mutation;
  F11 unfinished recovery gates). TX-05 keeps independently committed
  Application detaches; retry continues from current Job/Application state;
  stale automatic Unassign cannot clear a newer Assignee; team-removal vs
  Assign/Pipeline races obey TX-02. Platform Admin User LOCK/TERMINATE is
  unchanged. Focused coverage in
  `test/application/v10-team-removal-application-handoff.test.js` plus updated
  TX-02 / F11 recovery assertions. The official backend gate passed (ESLint: 0
  errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; ARCH-001
  through ARCH-016; Vitest: 107 files / 1008 tests).

- **Implemented; verified:** V10 Slice 09 — Platform Admin Recruiter User
  LOCK/TERMINATE automatic Unassign (F11; BR-08, BR-42, BR-46–BR-53; TX-02,
  TX-05): `lockAccount` / `terminateAccount` keep independent V1 User
  lifecycle authority (status transition + session revoke) without
  Job/Application zero-responsibility guard, without CompanyMember sync, and
  without Job Primary/Supporting mutation. After User eligibility loss
  commits, they reuse Slice 06
  `automaticallyUnassignCurrentResponsibilitiesOfRecruiter` so every current
  non-terminal Application assigned to the persisted Recruiter CompanyMember
  becomes `A → NONE`. No replacement Recruiter and no Platform Admin
  assignment/pipeline authority. Recruitment Status, Candidate, Job, source,
  and `submittedCvSnapshot` are preserved; terminal Applications keep their
  final Assignee. TX-05 keeps independently committed Application detaches;
  partial progress does not roll back User lifecycle; retry continues from
  current responsibilities (including TERMINATE of an already LOCKED User and
  repeated TERMINATE of an already TERMINATED User);
  stale automatic Unassign cannot clear a newer Assignee; User lifecycle vs
  Assign/Pipeline races obey TX-02. CompanyMember LOCK/TERMINATE, generic
  team removal, and Company-lock freeze semantics are unchanged. Focused
  coverage in
  `test/application/v10-platform-admin-user-lifecycle-automatic-unassign.test.js`
  plus updated H2 / TX-02 / Slice 05 read-projection assertions. The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 108
  files / 1020 tests).

- **Implemented; verified:** V10 Slice 10 — Concurrency Closure and Final
  Acceptance (F02–F11; BR-07–BR-08, BR-17–BR-20, BR-23, BR-28, BR-33–BR-40,
  BR-47–BR-53; TX-01, TX-02, TX-05): final integration slice for the
  `ASSIGN / UNASSIGN` revision. Deterministic regressions close remaining
  same-Application races (Assign↔Reassign, Assign↔Unassign, manual
  Unassign↔Replace/Withdraw) on top of existing Assign↔Assign,
  Reassign↔Unassign, Unassign↔Pipeline, automatic Unassign↔Pipeline/Replace/
  Withdraw, and Reassign↔Pipeline coverage; TX-02 eligibility races across
  Company/CompanyMember/User/team/Platform boundaries remain green; TX-05
  partial-progress is proven for CompanyMember LOCK/TERMINATE, team removal,
  and Platform User LOCK/TERMINATE. Smallest defect fixed: repeated Platform
  Admin LOCK of an already-`LOCKED` Recruiter User reconciles remaining
  non-terminal Application responsibilities without forcing TERMINATE.
  Stale trusted pre-lifecycle A→B helper
  (`executeTrustedPreLifecycleApplicationHandoff` /
  `executeAdministrativeApplicationHandoff`) removed — no production callers;
  public CM `force-reassign` remains the canonical A→B compatibility surface.
  Canonical-state acceptance reconfirmed (non-terminal Assigned/Unassigned
  matrix, Unassigned cannot Pipeline, Assign-again continues current status,
  terminals keep final Assignee, WITHDRAWN may be Assigned or Unassigned,
  assignment mutations do not change status/snapshot/identity/team, workload
  stays derived, CLOSED/EXPIRED continuity, Company-lock freeze without
  auto-Unassign, V6 exactly-one Primary). Focused coverage in
  `test/application/v10-assignment-concurrency-acceptance.test.js`, updated
  Platform User lifecycle / V1 lock / stale-helper cleanup suites. Focused V10
  + lock baseline passed 23 files / 372 tests. The official backend gate
  passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 109
  files / 1019 tests). V10 Assignment Model Revision is
  `COMPLETED AND VERIFIED`.

- **Implemented; verified:** V10 Final Acceptance finding H1 — manual Unassign /
  assignment-management commit with stale actor authority or Company state
  (BR-06/BR-12/BR-15/BR-53; TX-02): shared manual Assign/Reassign/Unassign
  owners revalidate/acquire current actor authority and Company operational
  state at the commit boundary. Target `NONE` still skips target eligibility
  but no longer skips actor/Company coordination. Automatic Unassign remains
  a trusted internal path without the manual actor gate. Deterministic races:
  stale Primary Unassign after Primary replacement fails and preserves
  Assignee; stale Unassign after Company LOCK fails and keeps assignment under
  freeze semantics; current Primary/CM Unassign and automatic Unassign under
  locked Company remain green. Focused regressions in
  `test/application/v10-h1-manual-unassign-actor-authority.test.js` (5 tests).
  Remains closed; later extended by the actor lifecycle-eligibility finding
  below without redesigning H1 Primary-replacement / Company-lock semantics.

- **Implemented; verified:** V10 Final Acceptance finding — manual
  assignment-management actor lifecycle eligibility at commit (BR-06/BR-12/
  BR-15/BR-53; V1/V3 Company Staff business access; TX-02): H1 Company +
  Primary-relation commit boundary extended so Primary and Company Manager
  actors also soft-read then conditionally acquire current
  `CompanyMember` (same Company, expected role, `ACTIVE`) and `User`
  (`ACTIVE` + current `mustChangePassword=false`) before Application CAS.
  Shared helper `acquireActiveCompanyStaffMembershipForBusinessAccessTx`
  covers Recruiter and Company Manager roles; acquire order is
  Company → actor Membership → actor User → target Membership/User (when
  target ≠ NONE) → Job → Application CAS, avoiding Job→Membership/User
  inversion. Automatic Unassign remains outside this gate. Deterministic
  regressions in
  `test/application/v10-manual-assignment-actor-lifecycle-eligibility.test.js`
  (11 tests): Primary User LOCK before Unassign/First Assign/Reassign;
  Primary CompanyMember LOCK before Unassign; CM User/Membership loss before
  Unassign; winner reverse; valid Primary/CM paths; `mustChangePassword`
  current-state rejection; automatic Unassign unaffected. Prior H1 and H2
  remain closed. Focused assignment/TX-02/lifecycle suites passed 12 files /
  224 tests. The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 111 files / 1036 tests).

- **Implemented; verified:** V10 Final Acceptance finding H2 — direct Platform
  User `TERMINATE` same-intent retry/reconciliation after partial automatic
  Unassign (F11; BR-47/BR-48/BR-52; TX-05): `terminateAccount` now treats
  already-`TERMINATED` as an idempotent reconciliation path mirroring
  repeated LOCK. No new lifecycle transition; User stays `TERMINATED`;
  sessions are revoked again; current non-terminal Application
  responsibilities are rescanned from persisted state and remaining
  outgoing-Assignee refs are detached. Already-detached Applications are
  skipped safely; terminal final Assignees and newer Assignees are not
  stale-cleared. Other invalid User transitions remain non-idempotent. No
  queue/worker/recovery entity/`lifecycleOperationId`, global transaction,
  CompanyMember/Job-team mutation, or Platform Admin assignment authority.
  Focused regression in
  `test/application/v10-platform-admin-user-lifecycle-automatic-unassign.test.js`
  plus updated V1 terminate account suite. Engineering SoT ownership rows
  updated for repeated TERMINATE. Focused lifecycle/Unassign/LOCK/TERMINATE/
  TX-05 suites passed 8 files / 106 tests. The official backend gate passed
  (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`;
  ARCH-001 through ARCH-016; Vitest: 110 files / 1025 tests).

## Previously completed and verified baseline

The V10 entries below record verification evidence for the implementation that
predates the current approved `ASSIGN / UNASSIGN` contract revision. They remain
regression history and reusable implementation evidence, but they do not mark
the current V10 revision complete.

- **Implemented; verified:** V10 Final Acceptance finding — Platform User
  lifecycle vs Job-team responsibility writers (F11 / BR-49; H3 TX-02
  coordination reuse): `createDraftJob`, `addSupportingRecruiter`, and
  `executeForcedPrimaryTransfer` now conditionally acquire Company operational
  + CompanyMember ACTIVE + User ACTIVE at the Job-team responsibility commit
  boundary in the same Company → Membership → User order as
  `replacePrimaryRecruiter` / H3, so a Platform Admin `User` LOCK/TERMINATE that
  commits first blocks stale new Primary/Supporting responsibility while a
  valid team mutation that commits first is retained and Platform lifecycle may
  still complete afterward without responsibility rollback, zero-guard, or
  CompanyMember lifecycle coupling. Focused regressions in
  `test/job/v10-f11-job-team-user-eligibility-coordination.test.js`; adjacent
  H2/H3/V6 team/forced-transfer suites remain green. The official backend gate
  passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 104
  files / 893 tests).

- **Implemented; verified:** V10 F11 — Platform Admin Recruiter Account
  Lock/Terminate → Company Responsibility Recovery (BR-46–BR-53): canonical
  Platform Admin `User.status` lifecycle remains independent from Company
  Manager `CompanyMember(RECRUITER).status` lifecycle. Platform lock/terminate
  still commits immediately under V1, revokes sessions, retains identity, and
  does not mutate CompanyMember, Job team, Application Assignee/status, or
  `submittedCvSnapshot`. Existing CM `force-reassign` recovers non-terminal
  Applications from outgoing `User = LOCKED | TERMINATED` across
  `PUBLISHED`/`CLOSED`/`EXPIRED`; existing replace-Primary/remove-Supporting
  surfaces now also recognize persisted Platform User ineligibility as the
  only CM recovery context that opens V6 unfinished `DRAFT`/
  `PENDING_APPROVAL` team mutation, while normal gates remain unchanged.
  Platform-ineligible outgoing Primary must leave the active team; replacement
  retains same-company/current-team/current-eligibility rules and uses shared
  H3 Company/User coordination at commit. Terminal Applications retain final
  Assignee; recovery does not synchronize CompanyMember lifecycle or change
  Company-lock semantics. No endpoint, field, collection, counter, history,
  queue, worker, or automatic/random replacement was added. Focused recovery
  coverage in
  `test/application/v10-h2-platform-admin-user-lifecycle-eligibility.test.js`
  expanded from 8 to 21 tests; focused V10 recovery baseline passed 3 files /
  50 tests, and adjacent V1/V3/V6/H3 regression baseline passed 9 files / 83
  tests. The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 103 files / 887 tests).

- **Implemented; verified:** V10 Final Acceptance finding H2 — Platform Admin
  User account lifecycle vs Application eligibility boundary (V1 F10/F11; V3
  User.status ↔ CompanyMember.status independence; V10 BR-08/BR-28/BR-42;
  PI-14/PI-17; TX-02 after H3): reconciled acceptance wording that would have
  blocked generic Platform Admin `lockAccount`/`terminateAccount` while a
  Recruiter still held Job/Application responsibility. Canonical owner remains
  Platform Admin User lifecycle in `platform-admin.service.js`; PI-24 / TX-05
  final zero-responsibility continues to apply only to Company Manager Recruiter
  CompanyMember LOCK/TERMINATE. Platform lock/terminate may complete with
  outstanding Application responsibility, must not mutate Application
  assignment/status/snapshot or Job Recruitment Team / CompanyMember, and must
  not gain First Assign / Reassign / Take over / administrative handoff /
  Pipeline authority. After `User.status` leaves `ACTIVE`, continuous Assignee
  eligibility is lost and H3 TX-02 User acquires keep stale Assign/Reassign/
  Pipeline from committing; Application mutation that commits first is retained
  and subsequent processing freezes. The later V10 F11 extension above closes
  the Company Manager responsibility-recovery orchestration that H2 alone did
  not claim. Focused regressions in
  `test/application/v10-h2-platform-admin-user-lifecycle-eligibility.test.js`
  (8 tests). Related V1 lock/terminate + H3 TX-02 suites passed together
  (4 files / 36 tests). No product-behavior code change was required beyond
  H3 coordination plus ownership/regression proof. The official backend gate
  passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 103
  files / 874 tests).

- **Implemented; verified:** V10 Final Acceptance finding H3 — TX-02 multi-dimension
  Assignee eligibility coordination (BR-07/BR-08/BR-28/BR-36–BR-38; TX-02):
  Application First Assign / Reassign / Take over / administrative recovery &
  pre-lifecycle handoff / Recruitment Pipeline commit paths now serialize against
  eligibility-losing writers on Company, CompanyMember, User, and Job Recruitment
  Team via shared conditional acquires in `assertAssigneeEligibleAtAssignmentCommit`
  (Job-service helpers). Company lock and generic User lifecycle still do not
  reassign/unassign Applications; Recruiter LOCK/TERMINATE final-zero-guard and
  team-removal outstanding-responsibility invariants remain. Deterministic race
  regressions in `test/application/v10-tx02-eligibility-coordination.test.js`
  (14 tests). Focused V10/V6 TX-02 related suites passed 9 files / 142 tests.
  The official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 102
  files / 866 tests).

- **Implemented; verified:** V10 Final Acceptance finding H1 — Application-scoped
  `submittedCvSnapshot` Preview/Download (F06–F08; BR-31): authenticated delivery
  of the persisted snapshot PDF via `file.service` + Application submitted-CV
  restricted storage, without exposing `pdfFile.storageKey` on normal Application
  projections and without falling back to live CandidateCV. Candidate owner
  routes `GET /api/candidate/applications/:applicationId/submitted-cv/preview|download`;
  current Primary routes
  `GET /api/jobs/:jobId/applications/:applicationId/submitted-cv/preview|download`;
  current Assignee routes
  `GET /api/jobs/my-applications/:applicationId/submitted-cv/preview|download`.
  Peer Candidate, non-Primary/non-Assignee Recruiter, cross-tenant, Company
  Manager, and Platform Admin are denied; reads do not mutate Application,
  snapshot, CandidateCV, Job, Assignee, or `version`. Focused coverage in
  `test/application/v10-submitted-cv-snapshot-delivery.test.js` (9 tests). The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 101
  files / 852 tests).

- **Implemented; verified:** V10 Slice 13 — Candidate My Applications (F08, F09
  partial; BR-20, BR-23, BR-25–BR-27, BR-30–BR-32, BR-41): owner-scoped read
  projections via `GET /api/candidate/applications` and
  `GET /api/candidate/applications/:applicationId`; membership is authenticated
  `candidateUserId` only (never client-supplied identity); all eight Recruitment
  Statuses remain visible; Applications on `PUBLISHED`/`CLOSED`/`EXPIRED` Jobs
  stay in Candidate history without auto status mutation; projection includes
  Job, Company, `appliedAt`, `submittedCvSnapshot`, and live Assignee
  `fullName`/`avatarUrl`/`jobTitle` only (Unassigned → null; Reassign reflects
  current Assignee; no email/phone/`companyMemberId`/history); optional F08
  status/`q` filters reuse IDX-A05 without new collections; Recruiter/CM/
  Platform Admin denied; reads do not mutate Application or expand
  Replace/Withdraw/Pipeline authority. Focused coverage in
  `test/application/v10-candidate-my-applications.test.js` (11 tests). The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 100
  files / 843 tests).

- **Implemented; verified:** V10 Slice 12 — Recruiter My Applications (F07, F09
  partial; BR-08, BR-18, BR-20, BR-25, BR-27, BR-30–BR-31, BR-33–BR-34, BR-40):
  current-assignee read projections via `GET /api/jobs/my-applications` and
  `GET /api/jobs/my-applications/:applicationId`; membership is
  `assignedRecruiterCompanyMemberId` = actor CompanyMember (First Assign /
  Reassign into appear; Reassign away remove; no Assignment History); not
  limited by Job accepting lifecycle (`PUBLISHED`/`CLOSED`/`EXPIRED` retained);
  Primary does not absorb Supporting assignments merely by managing the Job;
  Supporting sees own assignments; terminals remain readable when still assigned
  but are excluded from active `currentWorkloadCount`; snapshot-only Candidate CV
  access; CM/Platform Admin/Candidate denied; reads do not mutate Application;
  Pipeline authority still requires Slice 10 continuous eligibility. Focused
  coverage in `test/application/v10-recruiter-my-applications.test.js` (13
  tests). The official backend gate passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016;
  Vitest: 99 files / 832 tests).

- **Implemented; verified:** V10 Slice 11 — Managed Jobs, Pipeline Workspace,
  and Current Workload (F06, F10; BR-03, BR-05, BR-18–BR-20, BR-25, BR-27,
  BR-30, BR-33–BR-35, BR-40, BR-43): Primary-only read projections via
  `GET /api/jobs/managed` and `GET /api/jobs/:jobId/workspace`; Managed Jobs are
  current-Primary Jobs including `PUBLISHED`/`CLOSED`/`EXPIRED` (not accepting-
  only); Pipeline groups the eight canonical Recruitment Statuses; Unassigned
  remains assignment-state (legacy missing or explicit `null`); Current Workload
  derives from non-terminal assigned Applications scoped to the actor’s Managed
  Jobs (CLOSED/EXPIRED still count; Reassign moves A→B; terminal transitions
  drop workload; never company-global; never persisted KPI/history/counters);
  Supporting/CM/Candidate/Platform Admin do not receive Primary Managed Jobs
  authority; reads do not mutate Job/Application. Focused coverage in
  `test/application/v10-managed-jobs-pipeline-workspace.test.js` (15 tests). The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 98 files
  / 819 tests).

- **Implemented; verified:** V10 Slice 10 — Recruitment Pipeline (F05, F09
  partial; BR-08, BR-18–BR-24, BR-30–BR-31, BR-36, BR-38–BR-39, BR-43, BR-45;
  TX-01; TX-02): current eligible Assignee advances or rejects a Direct
  Application through the canonical Recruitment Status chain via
  `POST /api/jobs/:jobId/applications/:applicationId/pipeline`; authority is
  Assignee-bound (Primary of the Job does not bypass Supporting responsibility;
  Supporting processes only own assignments; CM/Platform Admin/Candidate have no
  Pipeline authority); continuous eligibility (company/team/role/member/user +
  Company operational) is re-checked at commit and stored assignee alone does
  not authorize; mutations touch only `status` + `version` while preserving
  assignee/snapshot/identity; skip/backward/reopen/`WITHDRAWN` Recruiter
  transitions are rejected; Interview statuses remain status-only with no
  schedule entity or history timestamps; existing Applications remain processable
  on `CLOSED`/`EXPIRED` Jobs; Company lock freezes processing without mutating
  Application; Reassign↔Pipeline, Replace↔SCREENING, and Withdraw↔SCREENING
  races follow TX-01 winners. Focused coverage in
  `test/application/v10-recruitment-pipeline.test.js`. The official backend gate
  passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 97 files
  / 804 tests).

- **Implemented; verified:** V10 Slice 09 — Recruitment Team Eligibility-Loss
  Application Handoff (F04, F09 partial; BR-07–BR-08, BR-15–BR-17, BR-27–BR-28,
  BR-33, BR-36–BR-38, BR-40, BR-42; TX-01; TX-02; TX-05): extends
  `removeSupportingRecruiter` and leave-team `replacePrimaryRecruiter` so
  non-terminal Applications assigned to the outgoing Recruiter are handed off
  via Slice 07 trusted pre-lifecycle `A → B` before team-removal completion;
  Supporting leave reuses current Primary Take-over context; Primary leave
  reuses `newPrimaryCompanyMemberId`; PRIMARY→SUPPORTING keep-eligible leaves
  assignments unchanged; terminal Applications do not block and keep final
  Assignee; TX-02 membership acquire + Job-scoped zero-app guard serializes
  against concurrent First Assign/Reassign; V6 PUBLISHED-only team-mutation
  gates preserved (CLOSED/EXPIRED Application handoff covered by the shared
  helper / Slice 08 LOCK-TERMINATE path); Company lock keeps assignment.
  Focused coverage in
  `test/application/v10-team-removal-application-handoff.test.js`. The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 96 files
  / 769 tests).

- **Implemented; verified:** V10 Slice 08 — Recruiter LOCK / TERMINATE Unified
  Responsibility Handoff (F04, F09 partial; BR-07–BR-08, BR-15–BR-17, BR-27–BR-28,
  BR-33, BR-36–BR-38, BR-40, BR-42; TX-01; TX-02; TX-05; PI-24): extends
  `lockRecruiter` / `terminateRecruiter` so Active Recruiter Responsibility is
  the union of V6 unfinished Job-team responsibility and every non-terminal
  Application assigned to the outgoing Recruiter (independent of Job
  `PUBLISHED`/`CLOSED`/`EXPIRED`); required Application handoff reuses Slice 07
  trusted pre-lifecycle `A → B` transfer with replacement from existing
  `transfers[]` or Supporting→Primary Take-over context; terminal Applications
  are left untouched; TX-05 keeps committed partial transfers when a later
  handoff fails; final dual zero-responsibility guard inside the lifecycle
  transaction blocks `LOCKED`/`TERMINATED` while any Job-team or Application
  responsibility remains and serializes against concurrent First Assign/
  Reassign. Focused coverage in
  `test/application/v10-lock-terminate-application-handoff.test.js`. The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 95 files
  / 757 tests).

- **Implemented; verified:** V10 Slice 07 corrective finding — Assignment/handoff
  lifecycle boundary foundation (F04/BR-15/BR-28/BR-36–BR-38/BR-40/BR-42; TX-01;
  TX-02; PI-23): public CM `forceReassignApplication` remains recovery-only
  when the current Assignee is operationally ineligible; trusted internal
  `executeTrustedPreLifecycleApplicationHandoff` allows `A → B` while the
  outgoing Assignee is still eligible only when they are the verified subject
  of an eligibility-losing lifecycle/team operation (not via client-declared
  reason on the public API); First Assign/Reassign/handoff reuse shared target
  eligibility and acquire ACTIVE Recruiter membership at commit through
  `acquireActiveRecruiterMembershipForTeamResponsibilityTx` so responsibility
  cannot land on a Recruiter that already lost eligibility; atomic A→B CAS
  preserves status/snapshot/identity and continues on `CLOSED`/`EXPIRED` Jobs;
  terminal Applications remain blocked. Focused coverage in
  `test/application/v10-slice07-handoff-lifecycle-boundary.test.js` plus Slice
  04–06 regressions. The official backend gate passed (ESLint: 0 errors / 2
  existing warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through
  ARCH-016; Vitest: 94 files / 744 tests).

- **Implemented; verified:** V10 Slice 06 — Company Manager Administrative
  Forced Reassignment (F04, F09 partial; BR-07, BR-10, BR-15–BR-17, BR-27–BR-28,
  BR-36–BR-38, BR-40, BR-42; TX-01; TX-02 administrative handoff): authenticated
  Company Manager force-reassigns a non-terminal Assigned `DIRECT_APPLICATION`
  via `POST /api/jobs/:jobId/applications/:applicationId/force-reassign`
  (`forceReassignApplication`) only when the current Assignee is operationally
  ineligible (off-team / non-ACTIVE membership / non-ACTIVE User / non-Recruiter
  role); target must be an eligible Primary or Supporting Recruiter; Manager
  cannot become Assignee; still-eligible Assignee blocks arbitrary swap; atomic
  A→B CAS preserves status/snapshot/identity and works on `CLOSED`/`EXPIRED`
  Jobs; Platform Admin/Recruiter/Candidate and cross-tenant Managers denied.
  Focused coverage in `test/application/v10-force-reassign.test.js`. The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 93 files
  / 733 tests).

- **Implemented; verified:** V10 Slice 05 — Reassign and Take over Application
  (F03; BR-10, BR-12–BR-14, BR-17–BR-19, BR-34, BR-36–BR-38, BR-40; TX-01;
  TX-02 eligibility-at-commit): authenticated current Primary Reassigns a
  non-terminal Assigned `DIRECT_APPLICATION` via
  `POST /api/jobs/:jobId/applications/:applicationId/reassign`
  (`reassignApplication`) to another eligible Primary or Supporting Recruiter,
  including Take over onto self; mutation sets only
  `assignedRecruiterCompanyMemberId` and increments `version` while preserving
  status/snapshot/identity; atomic A→B CAS (expected assignee + version +
  non-terminal) prevents Unassign intermediates and concurrent/stale overwrite;
  Supporting self-reassign/takeover, non-Primary, cross-company, off-team,
  non-operational target, and terminal Applications are denied. Focused
  coverage in `test/application/v10-reassign-takeover.test.js`. The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 92 files
  / 716 tests).

- **Implemented; verified:** V10 Slice 04 — First Assign Application (F02;
  BR-06–BR-11, BR-17, BR-36–BR-37, BR-40, BR-42; TX-01; TX-02 eligibility-at-
  commit): authenticated current Primary First Assigns an Unassigned
  `APPLIED` `DIRECT_APPLICATION` via
  `POST /api/jobs/:jobId/applications/:applicationId/assign`
  (`firstAssignApplication`) to self or a valid Supporting Recruiter; assignee
  eligibility is re-checked inside the commit transaction from persisted
  Job/CompanyMember/User/Company data; mutation sets only
  `assignedRecruiterCompanyMemberId` and increments `version` while preserving
  status/snapshot/identity; Unassigned CAS + version prevent concurrent/
  stale overwrite; Supporting self-claim, non-Primary, cross-company,
  off-team, non-operational assignee, and terminal Applications are denied.
  Focused coverage in `test/application/v10-first-assign.test.js`. The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 91 files
  / 698 tests).

- **Implemented; verified:** V10 Slice 03 — Unassigned Applications and Primary
  Application View (F01; BR-03, BR-05, BR-31, BR-40, BR-44): authenticated
  Recruiter who is current Primary of a Job lists that Job's
  `DIRECT_APPLICATION` Applications via `GET /api/jobs/:jobId/applications`
  (`listPrimaryJobApplications`); response includes Job, Candidate summary,
  Recruitment Status, current Assigned Recruiter when present, `appliedAt`,
  and `submittedCvSnapshot`; Unassigned is derived from absent/null
  `assignedRecruiterCompanyMemberId` (not status); Supporting, other-Job
  Primary, cross-Company Recruiter, Company Manager, Platform Admin, and
  Candidate are denied; snapshot read does not grant CandidateCV My CVs
  access; read does not mutate status/assignee/snapshot/identity/version.
  Focused coverage in `test/application/v10-primary-application-view.test.js`.
  The official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 90 files
  / 684 tests).

- **Implemented; verified:** V10 Slice 02 — V9 compatibility and Job-retention
  compatibility (F01, F09; BR-01–BR-02, BR-23, BR-25–BR-26, BR-29–BR-31, BR-36,
  BR-39, BR-41, BR-44; TX-01 compatibility): keeps canonical V9
  `directApplyToJob` / `replaceSubmittedCv` / `withdrawApplication` on the V10
  Application shape — Direct Apply still creates one `APPLIED` Unassigned
  Application per Candidate–Job (explicit
  `assignedRecruiterCompanyMemberId: null`), legacy absent assignee remains
  Unassigned, Replace stays owner + exact `APPLIED` + Job-accepting only and
  preserves Assignee/identity/source, Withdraw stays owner + exact `APPLIED`
  (Unassigned or Assigned; allowed after Job `CLOSED`/`EXPIRED`) and keeps the
  final Assignee plus snapshot, while `SCREENING`+ locks Candidate Replace/
  Withdraw. Job `closePublishedJob` / `expirePublishedJobIfDue` do not mutate
  Applications; Job retention stays V5 pre-publication delete authority without
  a new Application-existence delete guard or Apply↔Delete transaction. Focused
  coverage in `test/application/v10-v9-compatibility.test.js`. The official
  backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 89 files
  / 674 tests).

- **Implemented; verified:** V10 Slice 01 — Application persistence foundation
  (persistence enabler for F01–F10; BR-03–BR-05, BR-17, BR-20, BR-33, BR-35–BR-36,
  BR-43–BR-45; TX-01 persistence foundation): extends canonical
  `application-status.js` to the eight V10 Recruitment Statuses (`APPLIED`,
  `SCREENING`, `CONTACTED`, `INTERVIEW_SCHEDULED`, `INTERVIEW_COMPLETED`,
  `HIRED`, `REJECTED`, `WITHDRAWN`) without adding `UNASSIGNED` to status;
  extends `application.model.js` with nullable
  `assignedRecruiterCompanyMemberId` (legacy absent and `null` both Unassigned;
  no V9 backfill), local + collection status×assignment matrix guards, preserved
  `version`/CAS, Direct Apply creation still forced to `APPLIED` + Unassigned so
  the expanded enum cannot invent pipeline states through V9 create, and
  indexes `{ jobId, status }`, `{ jobId, assignedRecruiterCompanyMemberId }`,
  `{ assignedRecruiterCompanyMemberId, status }`, `{ candidateUserId, status }`
  while keeping unique `{ candidateUserId, jobId }`. No Assign/Pipeline
  workflows, history/KPI/workload fields, Job snapshot, Interview entity,
  `sourceRecruiterCompanyMemberId`, or Job delete-guard changes. Focused
  coverage in `test/application/v10-application-foundation.test.js`. The
  official backend gate passed (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 88 files
  / 665 tests).

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
  589 tests). V8 remains `PENDING`; V9 Slice 02+ remains deferred by dependency
  order.

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
  581 tests). No V9 Fxx behavior was implemented. V8 remains `PENDING`, so V9
  Slice 02+ remains deferred by dependency order.

- **Completed and verified:** V7 Final Acceptance / regression closure — all approved scope F01–F10, BR-01–BR-46, and TX-01 was reviewed against the canonical Product Spec and Data Contract, FINAL slice claims, Engineering Contracts, current implementation, and focused V7 tests. The official backend gate passed (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; ARCH-001 through ARCH-016; Vitest: 80 files / 581 tests), and the focused V7 suite passed 14 files / 100 tests. The five previously recorded acceptance findings are closed; no acceptance blocker remains. No Candidate Search, Application, Job Invitation, Restore, Hard Delete, public/share access, generated-PDF persistence, or other V7 scope expansion was accepted.

- **Implemented; verified:** V7 acceptance finding — CandidateCV local state invariants enforced on query-update persistence (F05/F09; BR-23, BR-37; Data V7 State Matrix / §10.2 / §11.1): MongoDB collection validator on `candidate_cvs` (plus existing document `pre("validate")`) rejects invalid local combinations through `findOneAndUpdate`/`updateOne` even with `runValidators: true`, including `UPLOADED + DRAFT`, GENERATED/UPLOADED payload XOR violations, `DRAFT + isDefault=true`, and `archivedAt != null + isDefault=true`; canonical Generated activation/ACTIVE demotion, Uploaded file replacement, Default set/unset, and Archive (`archivedAt` + `isDefault=false`) remain allowed; maximum-one Default partial unique index / TX-01 unchanged. Wired via `ensureCandidateCvCollectionInvariants` at app and test DB connect. Focused regressions in `test/candidate/v7-candidate-cv-query-update-invariants.test.js`.

- **Implemented; verified:** V7 acceptance finding — Generated CV activation binds validated `generatedContent` on `DRAFT → ACTIVE` commit (F04; BR-14–BR-21; Data V7 §9.3 / §10.2): `activateOwnGeneratedCandidateCv` no longer treats `updatedAt` as the sole concurrency token; the conditional activation write also matches the exact validated Generated-content snapshot so a same-millisecond concurrent content mutation that keeps `updatedAt` unchanged cannot persist `ACTIVE` with incomplete current content; incomplete Draft activation and ownership/source/archive guards remain unchanged; ACTIVE incomplete edit still atomically persists content + `DRAFT` + `isDefault=false`. Focused regression in `test/candidate/v7-candidate-cv-activation-active-lifecycle.test.js` (same-millisecond `updatedAt` collision case).

- **Implemented; verified:** V7 acceptance finding — Generated `hiddenSections[]` locked to fixed Harvard section vocabulary (F04; BR-12; Data V7 §6.11): HTTP save validation and CandidateCV schema both reuse `HARVARD_CV_SECTION` so unknown/user-defined section names are rejected and cannot persist; completeness remains independent of hide presentation. Focused regressions in `test/candidate/v7-candidate-cv-builder-completeness.test.js` plus activation/Preview suites.

- **Implemented; verified:** V7 acceptance finding — Harvard Generated PDF Unicode fidelity (F08; BR-32, BR-34): `renderHarvardCandidateCvPdf` embeds OFL Noto Serif (regular/bold/italic) via `@pdf-lib/fontkit` and stops lossy NFKD/ASCII/`?` sanitization so valid Vietnamese `generatedContent` survives Draft Preview and ACTIVE official Download; no Generated PDF persistence/history and no Uploaded delivery changes. Focused coverage in `test/candidate/v7-candidate-cv-harvard-unicode.test.js` plus existing preview/download suite.

- **Implemented; verified:** V7 acceptance finding — Uploaded Candidate CV restricted Cloudinary delivery (F05/F06/F08; BR-34, BR-40, BR-43): Candidate CV domain uploads/replaces/downloads/cleans Uploaded PDFs via `file.service` with explicit Cloudinary `authenticated` delivery (default public `upload` unchanged for other callers); Candidate-facing serialization omits internal `uploadedFile.storageKey` while persistence retains it; owner-scoped preview/download and Slice 07 replacement failure/stale-write semantics unchanged. Focused coverage in `test/candidate/v7-candidate-cv-uploaded-storage-access.test.js` plus updated create/replace/preview/download/metadata suites.

- **Implemented; verified:** V7 Slice 11 — Archive Candidate CV (F10; BR-08, BR-38–BR-45): authenticated Candidate soft-archives own non-archived CandidateCV via `DELETE /api/candidate/cvs/:cvId` (Archive ≡ Delete from My CVs); atomically `$set`s `archivedAt=now` and `isDefault=false` so `archivedAt != null` + `isDefault=true` cannot persist; preserves ownership/`sourceType`/`status`/`visibility`/common metadata/`generatedContent`/`uploadedFile` without `status=ARCHIVED`, hard delete, external Uploaded PDF cleanup, restore/unarchive, or Default auto-replacement; archived CVs leave Slice 02 My CVs list/detail and remain denied by existing active-library guards (Builder/activation/replace/metadata/preview/download/Default); `PUBLIC` does not keep archived CVs usable. Engineering SoT owner `archiveOwnCandidateCv`. Focused coverage in `test/candidate/v7-candidate-cv-archive.test.js` (7 tests).

- **Implemented; verified:** V7 Slice 10 — Default CV management (F09; BR-35–BR-37; TX-01): authenticated Candidate sets/switches/unsets Default on own CandidateCV via `PUT/DELETE /api/candidate/cvs/:cvId/default`; Default remains optional (`NONE` allowed); eligibility requires own non-archived `status=ACTIVE` (Generated DRAFT, archived, foreign, and missing targets rejected); set when none exists flips `target.isDefault=true`; switch A→B clears A and sets B in one MongoDB multi-document transaction so partial `A=false,B=false` cannot commit; explicit Unset clears only the current Default without auto-selecting a replacement; mutations touch only `isDefault` (no `sourceType`/`status`/`visibility`/metadata/`generatedContent`/`uploadedFile`/ownership changes); reuses Slice 02 partial-unique active-Default index for concurrent maximum-one protection and leaves Slice 05 ACTIVE→DRAFT Default-clear semantics unchanged; no `User.defaultCandidateCvId`, Default history, Archive, Apply, or Search. Engineering SoT owners `setOwnCandidateCvAsDefault` / `unsetOwnCandidateCvDefault`. Focused coverage in `test/candidate/v7-candidate-cv-default.test.js` (13 tests).

- **Implemented; verified:** V7 Slice 09 — Preview + Download Candidate CV (F08; BR-32–BR-34, BR-43): authenticated Candidate previews own non-archived CandidateCV via `GET /api/candidate/cvs/:cvId/preview` and downloads via `GET /api/candidate/cvs/:cvId/download`; Generated Preview renders current `generatedContent` through the fixed Harvard PDF owner for both `DRAFT` and `ACTIVE` (including incomplete Draft) without mutating status/completeness/metadata/visibility/Default/archive; Generated official PDF download is allowed only for `ACTIVE` and denied for `DRAFT`; Uploaded Preview/Download stream the current `uploadedFile` bytes via owner-scoped authenticated delivery using `file.service` `downloadFileBuffer` (signed storage fetch is implementation detail only); no persisted Generated PDF, PDF history, `publicUrl`/`publicDownloadUrl`/`isPubliclyAccessible`, or public sharing; `PUBLIC` remains intent-only without anonymous/Recruiter/Company Manager/Platform Admin access. Engineering SoT owners `renderHarvardCandidateCvPdf` / `previewOwnCandidateCv` / `downloadOwnCandidateCv`. Focused coverage in `test/candidate/v7-candidate-cv-preview-download.test.js` (6 tests).

- **Implemented; verified:** V7 Slice 08 — Rename + metadata + visibility (F07; BR-05, BR-27–BR-31, BR-43, BR-45, BR-46): authenticated Candidate patches own non-archived CandidateCV common metadata via `PATCH /api/candidate/cvs/:cvId` for both Generated and Uploaded sources; supports independent updates of `name`/`visibility`/`categoryId`/`experienceLevelId`/`preferredLocations`/`skillTags`/`employmentTypes`/`workModes`; reuses V4 Category FIELD/POSITION, ExperienceLevel, and fixed Location/EmploymentType/WorkMode vocabularies (`REMOTE` WorkMode-only); validates referenced Category/ExperienceLevel before commit; rename and metadata changes do not rewrite Generated Harvard content, Uploaded PDF, `sourceType`, `status`, `isDefault`, or `archivedAt`; `skillTags` stay independent of `generatedContent.skills`; `PUBLIC` persists visibility intent only without anonymous/Recruiter/Company Manager/Platform Admin access, Candidate Search, or derived fields such as `isSearchable`/`effectiveVisibility`; ownership from authenticated Candidate only; archived/cross-owner updates denied. No F08–F10 Preview/Default/archive workflows. Engineering SoT owner `updateOwnCandidateCvMetadata`. Focused coverage in `test/candidate/v7-candidate-cv-update-metadata.test.js` (6 tests).

- **Implemented; verified:** V7 Slice 07 — Replace Uploaded PDF (F06; BR-22, BR-25, BR-26): authenticated Candidate replaces the current PDF of own non-archived `UPLOADED` CandidateCV via multipart `PUT /api/candidate/cvs/:cvId/uploaded-file` after reusing Slice 06 `inspectUploadedCandidateCvPdf` (actual PDF, password, exact 10 MB, ≤20 pages) before any current-file mutation; valid replacement uploads the new artifact then atomically `$set`s the entire `uploadedFile` value under a prior-`storageKey` predicate so concurrent/stale requests cannot commit over a newer current file or clean up that newer artifact; invalid validation leaves `uploadedFile` and common metadata/lifecycle unchanged with no external upload; persistence failure after upload keeps the old current file and best-effort cleans the orphan new storage; old external cleanup runs only after committed persistence and cleanup failure does not roll back the swap; ownership/`sourceType=UPLOADED`/`status=ACTIVE`/`name`/`visibility`/Category/ExperienceLevel/preferredLocations/skillTags/employmentTypes/workModes/`isDefault`/`archivedAt` are preserved with no file history/`previousFiles`/versioning. No F07–F10 rename/Default/archive/Preview or Generated replace. Engineering SoT owner `replaceOwnUploadedCandidateCvPdf`. Focused coverage in `test/candidate/v7-candidate-cv-replace-uploaded.test.js` (6 tests).

- **Implemented; verified:** V7 Slice 06 — Uploaded CV creation (F05; BR-05, BR-10, BR-22–BR-24, BR-28–BR-30): authenticated Candidate creates own Uploaded CV via multipart `POST /api/candidate/cvs/uploaded` after Candidate-CV-domain PDF inspection (magic-byte PDF detection via `file-type`, password/page inspection via `pdf-lib`, exact 10 MB limit independent of global upload config, ≤20 pages); persists `sourceType=UPLOADED`, `status=ACTIVE`, `isDefault=false`, `archivedAt=null`, validated `uploadedFile` metadata (`storageKey`/`originalFileName`/`mimeType`/`sizeBytes`/`pageCount`/`uploadedAt`), and absent `generatedContent` with no `UPLOADED/DRAFT` path; reuses V4 Category FIELD/POSITION, ExperienceLevel, and fixed Location/EmploymentType/WorkMode vocabularies (`REMOTE` WorkMode-only); ownership from authenticated Candidate only; invalid file/metadata creates no CandidateCV; external upload then DB failure cleans up orphan storage best-effort without distributed transactions. Generic `file.service` remains storage-only. Engineering SoT owners `inspectUploadedCandidateCvPdf` / `createUploadedCandidateCv`. Focused coverage in `test/candidate/v7-candidate-cv-create-uploaded.test.js` (10 tests).

- **Implemented; verified:** V7 Slice 05 — Generated CV activation + ACTIVE lifecycle (F04 activation; BR-14–BR-21): authenticated Candidate explicitly activates own non-archived Generated `DRAFT` via `POST /api/candidate/cvs/:cvId/activate` after revalidating current content with the Slice 04 completeness evaluator; only complete content commits `DRAFT → ACTIVE`; incomplete activation leaves `DRAFT`; completeness alone never auto-activates. `PUT /api/candidate/cvs/:cvId/generated-content` now also saves Generated `ACTIVE` content: complete saves stay `ACTIVE`; incomplete saves atomically persist content, `ACTIVE → DRAFT`, and `isDefault=false` so `DRAFT + isDefault=true` cannot persist; ownership/visibility/common metadata and Candidate Profile remain unchanged. Activation originally bound `updatedAt` against concurrent content edits (later acceptance finding also binds validated `generatedContent`; see activation content-CAS finding above); ACTIVE demotion uses conditional same-document writes. No F05–F10 upload/rename/Default/archive/Preview workflows. Engineering SoT owners `activateOwnGeneratedCandidateCv` / `saveOwnGeneratedContent`. Focused coverage in `test/candidate/v7-candidate-cv-activation-active-lifecycle.test.js` (including later same-millisecond concurrency regression).

- **Implemented; verified:** V7 Slice 04 — Generated CV Builder save + completeness feedback (F04 Builder; BR-12–BR-19): authenticated Candidate saves Harvard structured content on own non-archived Generated `DRAFT` via `PUT /api/candidate/cvs/:cvId/generated-content`; partial DRAFT persistence allowed without requiring completeness; exact Product completeness evaluation returns `completeness.isComplete` after save; incomplete Education/WorkExperience/Project drafts do not by themselves fail completeness; existing Certification/Language records must satisfy Product item-level required fields to be activation-ready; Profile and CandidateCV metadata remain independent of Generated content; complete content still stays `DRAFT` (no `DRAFT → ACTIVE`, ACTIVE edit, or Default clearing). Data V7 §9.3 wording was narrowed to mirror Product exact completeness (deferred S04 prerequisite). Engineering SoT owner `saveOwnGeneratedDraftContent` / `evaluateGeneratedCvCompleteness`. Focused coverage in `test/candidate/v7-candidate-cv-builder-completeness.test.js` (including later `hiddenSections` vocabulary regressions).

- **Implemented; verified:** V7 Slice 03 — Create Generated CV Draft (F03; BR-04, BR-05, BR-09–BR-11, BR-28–BR-31): authenticated Candidate creates own Generated CV via `POST /api/candidate/cvs` with required `name`/`visibility`/`categoryId` and optional `experienceLevelId`/`preferredLocations`/`skillTags`/`employmentTypes`/`workModes`; persists exact `sourceType=GENERATED`, `status=DRAFT`, `isDefault=false`, `archivedAt=null`, empty `generatedContent`, and absent `uploadedFile`; Category accepts FIELD or POSITION; ExperienceLevel and V4 fixed vocabularies are validated before create (`REMOTE` rejected as Preferred Location, accepted as WorkMode); client ownership/Company/lifecycle/content override fields are rejected; metadata create does not synthesize Harvard content; created Draft appears in Slice 02 My CVs. No F04–F10 mutation workflows. Engineering SoT owner `createGeneratedDraftCandidateCv`. Focused coverage in `test/candidate/v7-candidate-cv-create-generated-draft.test.js` (7 tests).

- **Implemented; verified:** V7 Slice 02 — CandidateCV foundation + My CVs read (F02; BR-04–BR-08, BR-42, BR-43, BR-46): adds `candidate_cvs` persistence for both Generated and Uploaded CVs distinguished by immutable `sourceType`; common metadata/state foundation with V4 `categoryId`/`experienceLevelId` refs and fixed `preferredLocations`/`employmentTypes`/`workModes` vocabularies (no Location/EmploymentType/WorkMode collections); local schema invariants for status/visibility enums, Generated/Uploaded payload XOR, `UPLOADED ≠ DRAFT`, Default/archive local rules, ownership/active-library index, and partial-unique active Default; authenticated Candidate `GET /api/candidate/cvs` and `GET /api/candidate/cvs/:cvId` return only own non-archived CVs; `PUBLIC` does not grant peer Candidate, Recruiter, Company Manager, Platform Admin, or anonymous access; no Company/Job/Application/Invitation ownership fields; no F03–F10 mutation workflows. Engineering SoT CandidateCV owners were added as the Slice 02 documentation prerequisite. Focused coverage in `test/candidate/v7-candidate-cv-foundation.test.js` (7 tests).

- **Implemented; verified:** V7 Slice 01 — Candidate Profile (F01; BR-01–BR-03): authenticated Candidate reads and updates own Profile via `GET/PATCH /api/candidate/profile` reusing existing `users` persistence only; F01 exposes read/write `fullName`, `avatarUrl`, `dateOfBirth`, `phoneNumber` and read-only `email`; updates mutate the existing User document (no `CandidateProfile` collection/model, no User schema migration/index/multi-document transaction); `email`, `role`, `status`, `passwordHash`, `emailVerifiedAt`, `mustChangePassword`, sessions, and tokens are unchanged; Profile mutation does not touch CandidateCV and the Profile service boundary does not import CV workflows. Focused coverage in `test/candidate/v7-candidate-profile.test.js` (7 tests).

- **Implemented; verified:** V6 Slice 01 — Recruitment Team persistence + read (F01; BR-01–BR-07, BR-09, BR-11, BR-14–BR-16, BR-32): extends `Job` with `supportingRecruiterCompanyMemberIds` (default `[]`, no-duplicate, Primary-not-in-Supporting schema validators); adds V6 lookup indexes `{ primaryRecruiterCompanyMemberId, status, applicationDeadline }` and `{ supportingRecruiterCompanyMemberIds, status, applicationDeadline }`; `createDraftJob` explicitly initializes empty Supporting; generic `toPublicJob` does NOT serialize Supporting (team data available only via dedicated F01 read); a dedicated `GET /api/jobs/:jobId/team` endpoint returns the Recruitment Team (Primary + Supporting list) authorized only for owning Company Manager (regardless of Job status), or current Primary/Supporting of the Job within the same tenant only while the Job is not ended (CLOSED, EXPIRED, or effectively expired PUBLISHED with `now >= applicationDeadline` deny Recruiter team-read; historical references do not self-grant F01 authorization) — Supporting does not gain broader V5 Job-content visibility; an explicit idempotent migration `v6-supporting-recruiter-backfill` backfills existing V5 Jobs and verifies indexes; V5 lifecycle, authorization, creator, `applicationDeadline` partial-DRAFT semantics, and reassign-Primary behavior are unchanged. No later-slice mutation, `TX-02` concurrency guard, forced transfer, audit/history, or notification behavior was introduced. Focused coverage in `test/job/v6-recruitment-team-read.test.js`.

- **Prepared; verified:** V6 implementation readiness — V5 Final Acceptance closed without blocking findings after canonical Product/Data/Engineering review and the 13-file, 94-test V5 Job regression suite passed; approved V6 Product/Data contracts are established as repository sources of truth; roadmap/project status now mark V6 `READY FOR IMPLEMENTATION`; Engineering SoT assigns V6 F01 embedded team persistence and team-read ownership to the existing Job model/service boundary; and Data V6's invalid `F07` reference is corrected to BR-07 plus the inherited V5 Job-create transition. The existing MongoDB replica-set harness, transaction rollback test, canonical migration runner, and focused migration-test pattern are sufficient for Slice 01 persistence/backfill/index invariants. The architecture gate does not reject a valid canonical Job-model extension or versioned migration, so no test infrastructure or verification rule was changed. No V6 Fxx behavior was implemented.

- **Implemented; verified:** Browser-clickable auth email actions now use the shared `/api/auth/<action>?token=…` URL contract, fixing Gmail/browser `GET` clicks that previously reached non-existent bare-host paths while only body-token `POST` endpoints existed. V2 company-approval confirmation and V1 email verification consume their valid query token on `GET`; V3 Recruiter activation and V1/V3 password reset return a minimal password form on `GET` and consume only on its existing completion `POST`. The change adds no persistence fields or token types and leaves `jwt.js` access-JWT behavior unchanged. `APP_BASE_URL` must resolve to the reachable API origin. Focused auth suites passed; ESLint and architecture checks passed; the full suite passed `323/323` with `--fileParallelism=false`. The default parallel `verify:agent` run flaked twice on unrelated MongoMemoryServer startup timeouts.

- **Canonicalized; Product/Data/Engineering authority verified:** V5 acceptance finding — residual F12 DRAFT hard-delete and BR-41 effective-expiration documentation contradictions aligned without changing verified runtime behavior: Product F12 no longer blanket-rejects Recruiter delete and no longer has a duplicate rejection block; lifecycle invariants state lifecycle-specific hard-delete authority and outstanding responsibility via effective `PUBLISHED`; Product BR-26/BR-28/BR-41 plus authorization table conditions require effective `PUBLISHED` / deadline semantics; Data Contract lock/terminate blocking, close/reassign preconditions, constraint ownership, and persistence invariant #46 exclude past-deadline persisted `PUBLISHED` from outstanding responsibility; Engineering `source-of-truth.md` F12 owner row is lifecycle-specific (Primary `DRAFT`, CM `PENDING_APPROVAL`) and BR-41 anti-patterns forbid treating past-deadline `PUBLISHED` as blocking. Slice 12 / F10–F11 / reassign-close acceptance implementations remain the behavior source already verified.

- **Implemented; verified:** V5 acceptance finding — reassign Primary and manual close require effective `PUBLISHED` at the mutation boundary (F08/F09; BR-26, BR-28, BR-30, BR-31; TX-02/TX-03): `reassignPrimaryRecruiter` and `closePublishedJob` reuse `isJobEffectivelyPublished` / `resolveEffectiveJobStatus` for early denial of persisted `PUBLISHED` with `now >= applicationDeadline` without materializing `EXPIRED`; conditional writes require `applicationDeadline > $$NOW` via `$expr` so a fixed deadline crossed after the operation starts (before MongoDB decides the write) cannot reassign Primary or close into `CLOSED`; failed operations leave Primary, status, content, ownership, and `publishedAt` unchanged. Clock-crossing regressions (deadline unchanged) cover Company Manager reassign, Primary close, and Company Manager close in `test/job/v5-job-reassign-primary.test.js` and `test/job/v5-job-manual-close.test.js`.

- **Implemented; verified:** V5 acceptance finding — public eligibility requires the Company argument to be the Job owner (F11; BR-35, BR-38): `isJobPubliclyEligible` returns `false` when the provided Company is missing or its id does not match `job.companyId`, so a foreign `APPROVED + ACTIVE` Company cannot make another tenant's Job eligible; after ownership match, existing effective-`PUBLISHED` and owning-Company operational checks remain unchanged. Regression in `test/job/v5-job-effective-expiration-public-eligibility.test.js`.

- **Implemented; verified:** V5 acceptance finding — submit DRAFT→PENDING_APPROVAL no longer commits unvalidated content under edit↔submit interleaving (F04; BR-10, BR-18, BR-19; TX-02): `submitDraftJob` binds the atomic status transition to the validated submit-relevant content snapshot (and `updatedAt`) so an intervening Primary content edit after completeness validation fails the submit with 409 even when `updatedAt` is unchanged due to timestamp resolution, leaves the Job as `DRAFT` with the edited content, and never persists incomplete/`PENDING_APPROVAL` content; successful submit still transitions only `status` without mutating ownership/creator/Primary/`publishedAt`. Regression in `test/job/v5-job-submit-draft.test.js`.

- **Implemented; verified:** V5 Slice 12 — DRAFT privacy + pre-publication delete authority correction (F03, F12; BR-33, BR-34, BR-36, BR-37, BR-38, BR-43; TX-04): corrects the shared internal-visibility and hard-delete authorization boundary so `DRAFT` stays private to the current Primary Recruiter; Company Managers list/read same-Company Jobs from `PENDING_APPROVAL` onward and are denied `DRAFT` list/read; peer Recruiters remain limited to peer `PUBLISHED`; historical creator/former-Primary association alone still does not authorize. Manual hard-delete is lifecycle-state dependent — current Primary deletes only `DRAFT`, Company Manager deletes only `PENDING_APPROVAL`, and no V5 actor deletes `PUBLISHED`/`CLOSED`/`EXPIRED` — via conditional TX-04 physical delete (tenant + exact status, plus current Primary membership for DRAFT) without soft-delete/`DELETED`/cascade. F07 reject remains CM-only `PENDING_APPROVAL` hard-delete. Slice 03 originally implemented broader CM visibility (including `DRAFT`) and Slice 08 originally implemented CM-only pre-publication delete for both `DRAFT` and `PENDING_APPROVAL`; Slice 12 corrects those canonical mismatches without changing edit/submit/approve/publish/reassign/close/expiration or BR-41 semantics from Slices 01–11. Focused coverage in `test/job/v5-job-draft-privacy-delete-authority.test.js`, with regression updates in Slice 03/08 suites.

- **Implemented; verified:** V5 Slice 11 — Effective expiration + public eligibility (F10, F11; BR-30, BR-31, BR-32, BR-35, BR-40; TX-02): canonical deadline-driven effective Job status treats persisted `PUBLISHED` with `now >= applicationDeadline` as effectively `EXPIRED` without requiring a prior persist write; optional atomic lifecycle persist `PUBLISHED → EXPIRED` via `expirePublishedJobIfDue` changes only `status` while retaining ownership, creator, Primary, `publishedAt`, and content as a V5 terminal historical state; reusable `isJobPubliclyEligible` originally required effective `PUBLISHED`, `now < applicationDeadline`, and Company `APPROVED + ACTIVE` (DRAFT/PENDING/CLOSED/EXPIRED/deleted/past-deadline/non-ACTIVE Company are ineligible) without Candidate discovery/search/Application surfaces; a later acceptance finding additionally requires the Company argument to be the Job owner (see public-eligibility ownership finding above); BR-41 outstanding-Primary responsibility excludes effectively expired `PUBLISHED` Jobs as well as persisted `EXPIRED`. Focused coverage in `test/job/v5-job-effective-expiration-public-eligibility.test.js`.

- **Implemented; verified:** V5 Slice 10 — Manual close Job (F09; BR-28, BR-29, BR-32, BR-38; TX-02): current Primary Recruiter or Company Manager of the owning Company closes a `PUBLISHED` Job via `POST /api/jobs/:jobId/close`; TX-02 atomically transitions only `status` `PUBLISHED → CLOSED` on the Job document without mutating company ownership, creator, current Primary, `publishedAt`, or published content; `CLOSED` is retained as a V5 terminal historical state (no hard-delete, no reopen); peer Recruiters, historical creators, former Primaries, cross-tenant actors, and client `companyId`/Job id alone cannot authorize; stale close after leave-`PUBLISHED` (including already `CLOSED`/`EXPIRED`) is denied; closing clears BR-41 outstanding-Primary blocking for that Job. Focused coverage in `test/job/v5-job-manual-close.test.js`.

- **Implemented; verified:** V5 Slice 09 — Reassign Primary Recruiter (F08; BR-05, BR-06, BR-07, BR-26, BR-27, BR-38, BR-43; TX-03): Company Manager of the owning Company reassigns current Primary via `POST /api/jobs/:jobId/reassign-primary` only while the Job is `PUBLISHED`; successor must be an ACTIVE same-Company Recruiter with ACTIVE User; TX-03 atomically updates only `primaryRecruiterCompanyMemberId` without mutating creator, company ownership, content, status, or `publishedAt`, and without CompanyMember/history writes; Recruiter/cross-tenant actors and client `companyId`/membership id cannot expand authority; stale reassignment after leave-`PUBLISHED` is denied; BR-41 outstanding-Primary responsibility follows the new current Primary. Focused coverage in `test/job/v5-job-reassign-primary.test.js`.

- **Implemented; verified:** V5 Slice 08 — Manual pre-publication delete (F12; BR-32, BR-33, BR-34, BR-38; TX-04): originally implemented Company Manager hard-delete of never-published Jobs in `DRAFT` or `PENDING_APPROVAL` via `DELETE /api/jobs/:jobId` with conditional physical deletion (`findOneAndDelete` guarded by tenant `companyId` + pre-publication statuses) reusing the Slice 07 TX-04 delete foundation without a second soft-delete/`DELETED` abstraction; Recruiter (including current Primary) had no hard-delete authority under that slice. Slice 12 later corrected DRAFT delete authority to current Primary only and retained CM-only authority for `PENDING_APPROVAL` (see Slice 12). Focused coverage remains in `test/job/v5-job-manual-delete.test.js` (updated for the corrected matrix).

- **Implemented; verified:** V5 Slice 07 — Reject pending Job (F07; BR-20, BR-23, BR-38; TX-04): Company Manager of the owning Company rejects a `PENDING_APPROVAL` Job via `POST /api/jobs/:jobId/reject` using the Slice 05 approval-authority boundary; reject is a conditional physical delete (`findOneAndDelete` guarded by `PENDING_APPROVAL` + tenant `companyId`) with no persisted `REJECTED`/rejection-metadata/soft-delete fields and no cascade into Company, CompanyMember, Category, or ExperienceLevel; stale reject after approve/leave-pending and reject of `DRAFT`/`PUBLISHED`/`CLOSED`/`EXPIRED` are denied; Job id / client `companyId` cannot expand authority. Focused coverage in `test/job/v5-job-reject-pending.test.js`.

- **Implemented; verified:** V5 Slice 06 — Approve and publish Job (F06; BR-20, BR-21, BR-22, BR-24, BR-32, BR-38; TX-01): Company Manager of the owning Company approves a `PENDING_APPROVAL` Job via `POST /api/jobs/:jobId/approve`; approve is publish with no intermediate `APPROVED` state; publish-time revalidation covers Company activity (trusted CM context), Primary Recruiter validity/same-Company membership, V4 catalog/vocabulary integrity, and future `applicationDeadline` via `assertJobReadyForApprovalLifecycle`; TX-01 atomically sets `status=PUBLISHED` and `publishedAt` on the same Job document without mutating content/ownership/creator/Primary; failed approves leave `PENDING_APPROVAL` with `publishedAt=null`; published content remains immutable under the Slice 02 edit boundary and establishes the BR-32 historical boundary. Focused coverage in `test/job/v5-job-approve-publish.test.js`.

- **Implemented; verified:** V5 Slice 05 — Company Manager pending-review access (F05; BR-19, BR-20, BR-37, BR-38): reuses Slice 03 Company-scoped internal Job visibility so same-Company Managers can list/read `PENDING_APPROVAL` Jobs with submitted recruitment content, status, creator, and current Primary via `GET /api/jobs` and `GET /api/jobs/:jobId`; Slice 02 content-mutation boundary keeps pending content immutable (including Manager edit denial); cross-tenant Job id access remains blocked; BR-20 approval-decision authority is owned by `assertCompanyManagerJobApprovalAuthority` for later F06/F07 reuse without persisting approve/reject, review markers, or a duplicate Job-read path. Focused coverage in `test/job/v5-job-manager-pending-review.test.js`.

- **Implemented; verified:** V5 Slice 04 — Submit Job for approval (F04; BR-10–BR-19, BR-38): current Primary Recruiter submits a Company-owned `DRAFT` Job via `POST /api/jobs/:jobId/submit` after the canonical submit-validation boundary confirms completeness (title, description, skills, salary, FIELD/POSITION categories, Location, EmploymentType, WorkMode, ExperienceLevel, future `applicationDeadline`) and V4 catalog integrity (FIELD/POSITION levels, POSITION parent in selected FIELD set, ExperienceLevel dataset membership, fixed vocabularies); only `status` transitions `DRAFT → PENDING_APPROVAL` without mutating content/ownership/creator/Primary; failed submits leave the Job as `DRAFT`; post-submit content remains immutable under the Slice 02 edit boundary. Focused coverage in `test/job/v5-job-submit-draft.test.js`.

- **Implemented; verified:** V5 Slice 03 — Internal Job visibility (F03; BR-36, BR-37, BR-38, BR-43): originally implemented Company-scoped Job visibility in `job.service.js` so current Primary Recruiters read their Jobs in every existing status and read Company `PUBLISHED` Jobs of peers via `GET /api/jobs` and `GET /api/jobs/:jobId`, while peer `DRAFT`/`PENDING_APPROVAL`/`CLOSED`/`EXPIRED` and historical creator/former-Primary association alone do not authorize; that slice also allowed Company Managers to read all same-Company Jobs including `DRAFT`. Slice 12 later corrected CM visibility to begin at `PENDING_APPROVAL` and exclude `DRAFT` (see Slice 12). Tenant resolution stays membership-derived (client `companyId`/Job id cannot expand scope). Focused coverage remains in `test/job/v5-job-internal-visibility.test.js` (updated for the corrected CM boundary).

- **Implemented; verified:** V5 Slice 02 — Edit partial DRAFT + content immutability boundary (F02; BR-08, BR-09, BR-19, BR-24, BR-25, BR-38): current Primary Recruiter updates DRAFT recruitment content via `PATCH /api/jobs/:jobId` within membership-resolved Company tenant; partial content patches are allowed without submit completeness; ownership/creator/Primary/status/`publishedAt` are rejected from the edit contract and unchanged by the operation; content mutation is denied for `PENDING_APPROVAL`, `PUBLISHED`, `CLOSED`, and `EXPIRED`, and for non-Primary/cross-tenant actors. Focused coverage in `test/job/v5-job-edit-draft.test.js`.

- **Implemented; verified:** V5 Slice 01 — Job foundation + Create DRAFT + Responsibility guard (F01; BR-01–BR-08, BR-38, BR-41, BR-42): valid Recruiter creates Company-owned `Job` documents at `status=DRAFT` via `POST /api/jobs` with Company resolved from trusted Recruiter membership (client `companyId` cannot expand tenant); creator and initial Primary are the creating Recruiter membership and are immutable for ownership/history; partial DRAFT content is allowed without submit-completeness requirements; schema reuses V4 `Category`/`ExperienceLevel` refs and fixed `Location`/`EmploymentType`/`WorkMode` vocabularies without new catalog collections or Supporting Recruiter fields; Recruiter lock/terminate call the Job-owned outstanding-Primary guard for `DRAFT`/`PENDING_APPROVAL`/`PUBLISHED` outside TX-04/TX-05 without a new jobs↔company_members multi-document transaction. Focused coverage in `test/job/v5-job-create-draft.test.js` and `test/job/v5-recruiter-responsibility-guard.test.js`.

- **Prepared; verified:** V5 implementation readiness — the approved Product/Data contracts were established as repository sources of truth; roadmap and project status then marked V5 `READY FOR IMPLEMENTATION`; the existing MongoDB replica-set test harness supported the persistence and transaction invariants needed by Slice 01; and the backend verification gate accepted the then-current pre-V5 baseline without weakening architecture or regression checks. No V5 Fxx behavior was implemented by that readiness step. Slice 01 was required to combine Job foundation/create DRAFT with the BR-41 Recruiter lock/terminate responsibility guard.

- **Implemented; verified:** V4 Slice 05 — V4 acceptance and regression closure (F01–F06; BR-01–BR-20): cross-cutting suite confirms FIELD→POSITION structure and schema immutability, Platform Admin-only Category creation (Candidate/Company Manager/Recruiter denied), absence of Category/ExperienceLevel mutation/list/CRUD surfaces beyond create endpoints, exact closed Location/EmploymentType/WorkMode vocabularies plus six-record ExperienceLevel dataset, no CompanyMember catalog role, and V1/V2/V3 identity surfaces unchanged; Data Contract authorization ownership is aligned to Engineering SoT middleware enforcement without changing business behavior. Coverage in `test/catalog/v4-acceptance.test.js` plus prior V4 slice suites.

- **Implemented; verified:** V4 Slice 04 — ExperienceLevel canonical dataset (F06; BR-01, BR-15, BR-16, BR-17, BR-20): persisted `experience_levels` documents expose only `_id` + immutable unique `code` from the locked six-member set; dataset initialization is owned by `src/database/migrations/v4-experience-level-dataset.js` through the existing `scripts/run-migration.js` runner (idempotent upsert; no seed/startup/API path); re-application does not create duplicates and verification requires exactly the six canonical records. Focused coverage in `test/catalog/v4-experience-level-dataset.test.js`.

- **Implemented; verified:** V4 Slice 03 — Category POSITION creation (F02; BR-01, BR-02, BR-04, BR-05, BR-06, BR-07, BR-08, BR-10, BR-18, BR-19, BR-20): valid Platform Admin creates immutable platform-scoped `Category` documents at `level=POSITION` under an existing `FIELD` via `POST /api/platform-admin/categories/fields/:fieldId/positions`; parent must exist and be `FIELD` (not another POSITION); uniqueness is scoped by `{ parentCategoryId, normalizedName }` so same names may exist under different FIELDs while same-FIELD duplicates including concurrent creates are rejected; parent FIELD is not mutated; authorization reuses `authorize-platform-admin` without service role re-checks. Focused coverage in `test/catalog/v4-category-position-creation.test.js`.

- **Implemented; verified:** V4 Slice 02 — Category FIELD creation (F01; BR-01, BR-02, BR-03, BR-05, BR-06, BR-07, BR-08, BR-09, BR-18, BR-19, BR-20): valid Platform Admin creates immutable platform-scoped `Category` documents at `level=FIELD` with `parentCategoryId=null` via `POST /api/platform-admin/categories/fields`; `normalizedName` is derived by the Category model (trim, collapse whitespace, case-fold) and compound unique `{ parentCategoryId, normalizedName }` rejects duplicates including concurrent creates; authorization reuses `authorize-platform-admin` without service role re-checks; no POSITION creation, list/read, edit/delete, or tenant ownership fields. Focused coverage in `test/catalog/v4-category-field-creation.test.js`.

- **Implemented; verified:** V4 Slice 01 — Fixed platform vocabularies (F03, F04, F05; BR-01, BR-11, BR-12, BR-13, BR-14, BR-17, BR-20): canonical non-persisted constant modules provide closed platform sets for `Location` (exactly 64 Data Contract members: 63 Vietnam province/city snapshot values plus `FOREIGN`; `REMOTE` excluded), `EmploymentType` (8 fixed values), and `WorkMode` (`ONSITE`, `HYBRID`, `REMOTE`); no collections, seeds, admin CRUD, or Job/CV integration. Focused coverage in `test/catalog/v4-fixed-vocabularies.test.js`.

- **Prepared; verified:** V4 implementation readiness — the approved Product/Data contract paths are established, the Product Location definition is aligned to the canonical fixed snapshot of 63 Vietnam province/city members plus `FOREIGN`, and roadmap/project state now mark V4 `READY FOR IMPLEMENTATION`. No V4 business behavior or persistence was introduced by the readiness step itself. Slice 01 requires only fixed non-persisted vocabularies, so the existing unit-test infrastructure and backend gate are sufficient; Category authorization ownership is deferred to Slice 02 and ExperienceLevel dataset initialization ownership is deferred to Slice 04.

- **Implemented; verified:** V3 Slice 09 — V3 acceptance & regression closure (F01–F09, F11–F17; BR-01–BR-29; TX-01–TX-07 as applied): cross-cutting acceptance suite confirms end-to-end Recruiter lifecycle, cross-tenant/`companyId` non-expansion, invalid-actor matrix, platform/Company restriction precedence, pre-activation denials, TERMINATED terminal transitions, session revocation after lock/reset/terminate, V1 Candidate + V2 CM membership SoT compatibility (no persisted `Company.managerUserId`), credential non-leakage, and explicit F10 PATCH/PUT absence. Coverage in `test/auth/v3-acceptance.test.js` plus prior V3 slice suites.

- **Implemented; verified:** V3 Slice 08 — Recruiter termination & historical retention (F13, F16 / TX-05; BR-19, BR-20, BR-21): valid Company Manager terminates same-tenant Recruiter membership from `ACTIVE` or `LOCKED` to terminal `TERMINATED`; TX-05 atomically sets membership `TERMINATED` and revokes all `AuthSession` records without hard-deleting User/CompanyMember or changing `User.status`/Company lifecycle; email/`employeeCode`/`jobTitle`/tenant relationship are retained and email cannot be reused for a new Recruiter; lock/unlock/second terminate from `TERMINATED` are rejected. Focused coverage in `test/auth/v3-recruiter-termination.test.js`.

- **Implemented; verified:** V3 Slice 07 — Recruiter lock & unlock (F11, F12 / TX-04; BR-16, BR-17, BR-18, BR-22, BR-23): valid Company Manager locks/unlocks same-tenant Recruiter membership only; lock allows only `ACTIVE → LOCKED` and atomically revokes all Recruiter `AuthSession` records; unlock allows only `LOCKED → ACTIVE` without restoring sessions and rejects platform-restricted Users and `TERMINATED` membership; neither path changes `User.status` or Company lifecycle. Focused coverage in `test/auth/v3-recruiter-lock-unlock.test.js`.

- **Implemented; verified:** V3 Slice 06 — Recruiter password recovery & CM-initiated reset (F06, F07 / TX-03; BR-06, BR-07, BR-12, BR-14, BR-15, BR-17, BR-22): activated Recruiters reuse `PASSWORD_RESET` self forgot/reset; valid CM can initiate same-tenant reset only after initial activation and not for `TERMINATED` membership; completion atomically updates `passwordHash`, sets `mustChangePassword=false`, consumes the token, and revokes all `AuthSession` records without changing User/membership/Company lifecycle; CM never receives password or raw token. Focused coverage in `test/auth/v3-recruiter-password-reset.test.js`.

- **Implemented; verified:** V3 Slice 05 — Recruiter list & detail (F08, F09; BR-06, BR-07, BR-23, BR-29): valid Company Manager lists and reads Recruiter detail only in the membership-derived tenant via `CompanyMember(role=RECRUITER)`; responses expose management fields (`fullName`, `email`, `employeeCode`, `jobTitle`, User/membership status, activation readiness) without passwordHash/token/session credentials; client `companyId` cannot expand scope; Recruiter peers and invalid Company state are rejected. Focused coverage in `test/auth/v3-recruiter-list-detail.test.js`.

- **Implemented; verified:** V3 Slice 04 — Recruiter activation completion (F05 / TX-02; BR-11, BR-12, BR-13): Recruiter completes activation with a valid single-use `RECRUITER_ACTIVATION` token and self-chosen password; TX-02 atomically updates `passwordHash`, sets `mustChangePassword=false` and `emailVerifiedAt` (settled decision: activation also verifies email), and consumes the token without changing `User.status`, `CompanyMember`, or Company lifecycle; afterward only the activation/password gate is cleared and business access still uses F14 layered authorization. Focused coverage in `test/auth/v3-recruiter-activation.test.js`.

- **Implemented; verified:** V3 Slice 03 — Recruiter creation + activation issuance (F03, F04; F16 identity/history foundation): valid Company Manager creates Recruiter in membership-derived tenant with required `fullName`/`email`/`employeeCode`/`jobTitle`; TX-01 atomically persists `User(COMPANY_STAFF, ACTIVE, mustChangePassword=true)` + `CompanyMember(RECRUITER, ACTIVE)`; after commit issues hashed `RECRUITER_ACTIVATION` token and emails the Recruiter only (no password/raw credential to CM); SMTP stays outside TX-01. Focused coverage in `test/auth/v3-recruiter-creation.test.js`.

- **Implemented; verified:** V3 Slice 02 — Company Staff authorization & tenant context (F02, F14, F15): tenant resolves from `CompanyMember` only (client `companyId` cannot expand scope); business access requires User `ACTIVE` + membership `ACTIVE` + Company `APPROVED`/`ACTIVE` + `mustChangePassword=false` before Company role; platform User and Company restrictions outrank membership; `RECRUITER` cannot manage other Recruiters. Focused service + non-prod probe coverage in `test/auth/v3-company-staff-authorization.test.js`.

- **Implemented; verified:** V3 Slice 01 — Company Staff foundation and V2 cutover (F01, F17): platform role `COMPANY_STAFF`; `CompanyMember` as sole Company-role source of truth; onboarding TX-06 creates User + Company + `CompanyMember(COMPANY_MANAGER)` while preserving `PENDING_ACTIVATION` semantics; V2 tenant/manager resolution uses membership instead of `Company.managerUserId`; TX-07 migration under approved owners (`scripts/run-migration.js`, `src/database/migrations/v3-tx07-company-manager-to-company-staff.js`) converts legacy pairs, verifies invariants, then removes `managerUserId`.

- **Implemented; verified:** V3 acceptance finding — TX-07 now preserves each legacy `Company.managerUserId` as the exact `CompanyMember(companyId, userId=legacy manager, role=COMPANY_MANAGER)` pair, converts that User `COMPANY_MANAGER → COMPANY_STAFF` only inside the pair persistence-unit transaction, keeps `managerUserId` until post-migrate invariant verification succeeds, then removes it; rejects conflicting non-pair `COMPANY_MANAGER` memberships and does not broad-convert orphan `COMPANY_MANAGER` users. Focused regressions in `test/auth/v3-tx07-company-staff-cutover.test.js`.

- **Implemented; verified:** V3 acceptance finding — TX-07 failure-path evidence now covers missing/invalid-role legacy manager Users, conflicting non-pair `COMPANY_MANAGER` memberships, orphan legacy `COMPANY_MANAGER` Users (verification fail blocks `managerUserId` removal), incomplete global cutover when one persistence unit fails (all `managerUserId` values retained), and pre-removal detection of `COMPANY_MANAGER` memberships pointing at non-`COMPANY_STAFF` Users. Coverage in `test/auth/v3-tx07-company-staff-cutover.test.js`.

- **Prepared; verified:** V3 Product/Data contract paths and repository milestone status were aligned for `READY FOR IMPLEMENTATION` before Slice 01; the backend replica-set test infrastructure proves transaction rollback; migration tooling ownership is defined by the engineering contracts.

- **Implemented; lint-verified:** the Node.js ES-module backend project foundation, package scripts, Express application bootstrap, `/api` root router, hello-world endpoint, application middleware composition, and process startup/shutdown orchestration exist. The current backend source passes the configured ESLint command.
- **Implemented; test-verified for registration:** MongoDB connection/disconnection infrastructure and startup integration exist. The candidate registration request path uses MongoDB through `auth.service.js` to persist `User` and `AuthToken` records.
- **Implemented; not runtime-verified in this snapshot:** Cloudinary client configuration, startup connection verification, file upload/delete service operations, and non-production test endpoints exist.
- **Implemented; test-verified for registration (mail mocked in automated tests):** Nodemailer transport configuration and the canonical mail-sending service exist. The candidate registration request path invokes `mail.service.js`.
- **Implemented; lint-verified:** centralized unmatched-route and final error middleware exist and are registered after application routes. Some expected file errors still bypass the centralized formatter, as noted below.
- **Normalized; lint-verified:** V1/V2 authentication-token types have one canonical owner at `backend/src/constants/auth-token-type.js`, containing `EMAIL_VERIFICATION`, `PASSWORD_RESET`, and `COMPANY_APPROVAL_CONFIRMATION`; unused invite-token helpers and the competing token-type owner have been removed.
- **Normalized; lint-verified:** `backend/src/config/index.js` is the sole dotenv loader and the sole direct `process.env` reader; the root entry point and other configuration modules consume normalized configuration.
- **Implemented; verified:** `backend/scripts/verify-architecture.js` provides dependency-free deterministic checks for the initial approved backend architecture invariants and passes against the current backend source.
- **Documented only:** backend architecture, conventions, canonical responsibility owners, and known technical mismatches are defined under `docs/engineering/`.
- **Documented only:** repository-level and backend-specific agent contracts exist.
- **Implemented; verified:** V1 Slice 1 — `POST /api/auth/register/candidate` creates an unverified `CANDIDATE` account, persists an `EMAIL_VERIFICATION` `AuthToken`, and sends verification email through the canonical mail service. Automated Vitest coverage exists for the registration path.
- **Implemented; verified:** V1 Slice 2 — `POST /api/auth/verify-email` validates and consumes `EMAIL_VERIFICATION` `AuthToken` records, sets `User.emailVerifiedAt`, rejects invalid/expired/consumed tokens, and does not change account status or issue login credentials.
- **Implemented; verified:** V1 Slice 3 — `POST /api/auth/login` requires valid credentials, verified email, and `ACTIVE` account status; creates one independent expiring `AuthSession` with hashed refresh credential; returns short-lived access token bound to the session.
- **Implemented; verified:** V1 Slice 4 — session-bound access authentication validates short-lived access JWTs against an existing unexpired `AuthSession` owned by the same `ACTIVE` user; revoked/expired/mismatched sessions, missing users, and non-`ACTIVE` account status are rejected. A non-production probe route exercises the middleware for tests only.
- **Implemented; verified:** V1 Slice 5 — `POST /api/auth/refresh` accepts a valid refresh credential for an existing unexpired `AuthSession`, requires the owning `ACTIVE` user, and returns a new short-lived access token bound to the same session without rotating the refresh credential or extending session expiration.
- **Implemented; verified:** V1 Slice 6 — `POST /api/auth/logout` revokes only the authenticated current `AuthSession` via access authentication; concurrent sessions remain valid; access and refresh credentials for the removed session are rejected afterward.
- **Implemented; verified:** V1 Slice 7 — `POST /api/auth/forgot-password` issues one expiring hashed `PASSWORD_RESET` `AuthToken` for existing accounts, replaces prior usable reset tokens, sends reset mail through the canonical mail service, and returns the same success response for nonexistent emails without creating tokens or sending mail.
- **Implemented; verified:** V1 Slice 8 — `POST /api/auth/reset-password` consumes a valid unexpired `PASSWORD_RESET` token, updates `passwordHash` under the V1 password policy, keeps `mustChangePassword` false, and revokes all `AuthSession` records for the user; invalid/expired/reused tokens change nothing.
- **Implemented; verified:** V1 Slice 9 — `POST /api/platform-admin/accounts/:userId/lock` requires session-bound access authentication and Platform Admin authorization; transitions only eligible `ACTIVE` non–Platform-Admin targets to `LOCKED`, preserves email verification and identity data, and revokes all `AuthSession` records for the target; rejects self-targeting, Platform-Admin-to-Platform-Admin lock, non-`ACTIVE` targets, and unknown accounts.
- **Implemented; verified:** V1 Slice 10 — `POST /api/platform-admin/accounts/:userId/terminate` requires session-bound access authentication and Platform Admin authorization; transitions eligible `ACTIVE` or `LOCKED` non–Platform-Admin targets to `TERMINATED`, preserves email verification and identity data, and revokes all `AuthSession` records for the target; rejects self-targeting, Platform-Admin-to-Platform-Admin terminate, already-`TERMINATED` targets, and unknown accounts.
- **Implemented; lint-verified:** `User`, `AuthToken`, and `AuthSession` Mongoose models, password/token hashing utilities, auth service/controller/routes, access-authentication service/middleware, platform-admin authorization middleware, platform-admin lock/terminate service/controller/routes, and registration/verification/login/refresh/logout/forgot-password/reset-password request handling.

- **Implemented; verified:** V1 acceptance remediation — session-bound access authentication now requires the owning user to remain `ACTIVE`, with regression coverage for non-`ACTIVE` access denial and post-lock/post-terminate protected-access rejection.
- **Prepared; verified:** V2 implementation-readiness governance was aligned while V2 was still `READY FOR IMPLEMENTATION`: V1 was already `COMPLETED AND VERIFIED`, and V2 became the then-current milestone with approved Product/Data contracts and no V2 business behavior introduced by the readiness change alone.
- **Prepared; verified:** backend integration tests use a single-node MongoDB replica set, and an infrastructure regression proves failed transactions roll back writes before V2 Slice 01 introduces TX-01.
- **Implemented; verified:** V2 Slice 01 — `POST /api/auth/register/company-manager` creates a Company Manager User with explicit `PENDING_ACTIVATION` status and a linked Company at `NOT_SUBMITTED + INACTIVE` under TX-01 (adapted by V3 TX-06 to `COMPANY_STAFF` + `CompanyMember`); Company persistence foundation/indexes exist; Candidate V1 registration lifecycle remains unchanged.
- **Implemented; verified:** V2 Slice 02 — limited onboarding authentication for Company Manager `PENDING_ACTIVATION` (login/refresh/logout without activating the account or setting `emailVerifiedAt`); `GET/PATCH /api/company` resolve the manager's Company via Company membership, allow draft profile updates only while `NOT_SUBMITTED + INACTIVE`, reject client-supplied company identifiers and cross-tenant/invalid-state updates; normal ACTIVE access authentication remains unchanged.
- **Implemented; verified:** V2 Slice 03 — `POST /api/company/submit` (onboarding auth) requires owned Company at `NOT_SUBMITTED + INACTIVE` with `name` and unique `businessRegistrationNumber`, atomically persists immutable `reviewSnapshot` + `submittedAt` and transitions to `PENDING + INACTIVE`, rejects missing required fields, duplicate BRN, second submit, and post-submit draft mutation.
- **Implemented; verified:** V2 Slice 04 — `GET /api/platform-admin/company-registrations` and `GET /api/platform-admin/company-registrations/:companyId` require ACTIVE Platform Admin access; list/detail submitted registrations with associated Company Manager and immutable `reviewSnapshot` as the review source; unsubmitted Companies and non-admin actors are rejected; responses do not expose live profile as the review basis and do not create tenant membership beyond the canonical Company Manager membership.
- **Implemented; verified:** V2 Slice 05 — `POST /api/platform-admin/company-registrations/:companyId/reject` requires ACTIVE Platform Admin access and source state `PENDING + INACTIVE` with submitted snapshot; atomically transitions to `REJECTED + INACTIVE` with `reviewedByUserId`/`reviewedAt`, keeps Company Manager `PENDING_ACTIVATION`, retains immutable `reviewSnapshot`, creates no confirmation token, and treats reject as terminal (no second reject, draft update, or resubmit).
- **Implemented; verified:** V2 Slice 06 — `POST /api/platform-admin/company-registrations/:companyId/approve` requires ACTIVE Platform Admin access and source state `PENDING + INACTIVE` with submitted snapshot; under TX-02 transitions to `APPROVED + INACTIVE` with `reviewedByUserId`/`reviewedAt`, issues `COMPANY_APPROVAL_CONFIRMATION` for the Company Manager, keeps Company Manager `PENDING_ACTIVATION`, leaves Company inactive, and does not consume/activate.
- **Implemented; verified:** V2 Slice 07 — `POST /api/auth/confirm-company-approval` consumes a valid unexpired `COMPANY_APPROVAL_CONFIRMATION` owned by a `PENDING_ACTIVATION` Company Manager whose Company is `APPROVED + INACTIVE`; under TX-03 atomically sets User `ACTIVE` + `emailVerifiedAt`, Company `APPROVED + ACTIVE` + `activatedAt`, and removes the token; rejects invalid/expired/reused tokens and invalid source states without partial activation.
- **Implemented; verified:** V2 Slice 08 — `POST /api/company/resend-approval-confirmation` (onboarding auth) allows a `PENDING_ACTIVATION` Company Manager to resend only when their owned Company is `APPROVED + INACTIVE` and no usable confirmation remains; issues one new `COMPANY_APPROVAL_CONFIRMATION`, sends confirmation email, preserves User/Company state, and rejects resend while a valid confirmation is still active.
- **Implemented; verified:** V2 Slice 09 — `GET/PATCH /api/company` for ACTIVE Company Managers resolve the owned Company via membership only while `APPROVED + ACTIVE`; allow updates to `logoUrl`, `bannerUrl`, `website`, `address`, `description`, and `contactInfo`; preserve `name`, `businessRegistrationNumber`, review snapshot, approval/operational state, and lifecycle timestamps; reject forbidden fields, cross-tenant identifiers, and invalid Company states without re-review. Active-profile writes commit only via source-state guarded atomic update requiring owned membership + `APPROVED + ACTIVE` at write time.
- **Implemented; verified:** V2 Slice 10 — `POST /api/platform-admin/companies/:companyId/lock` requires ACTIVE Platform Admin access and source state Company `APPROVED + ACTIVE` with Manager `role = COMPANY_STAFF` and `status = ACTIVE`; under TX-04 atomically sets Company `APPROVED + LOCKED`, Manager `TERMINATED`, and revokes all Manager `AuthSession` records; retains Company/User/profile/`reviewSnapshot`/lifecycle timestamps and Company Manager membership; rejects unauthorized actors, invalid Company/Manager source states, and second lock; provides no unlock/reactivation path.
- **Implemented; verified:** V2 acceptance finding #1 — account-level Platform Admin lock/terminate rejects Company Managers whose owned Company would leave the V2 state matrix (including `APPROVED + ACTIVE`), preserving F10/TX-04 as the canonical Company lifecycle lock path; V1 Candidate and Company-Manager-without-Company account workflows remain unchanged.
- **Implemented; verified:** V2 acceptance finding — TX-04 lock now requires referenced Manager source state `role = COMPANY_STAFF` and `status = ACTIVE` before any Company/User/session writes; wrong-role managers return 409 with Company/User/session state unchanged.
- **Implemented; verified:** V2 acceptance finding #2 — Company lifecycle transitions now commit only via source-state guarded atomic updates: draft update and submit require `NOT_SUBMITTED + INACTIVE` at write time (submit uses an atomic snapshot+PENDING pipeline update), and approve/reject require `PENDING + INACTIVE` at write time so concurrent draft/submit, approve/reject, and reject/reject races cannot both succeed.
- **Implemented; verified:** V2 acceptance finding — F09 active-profile update no longer uses read-check-save: concurrent F10 lock between check and write returns 409 and leaves profile fields unchanged on the locked Company.
- **Implemented; verified:** V2 acceptance finding #3 — F08 concurrent resend now keeps at most one usable `COMPANY_APPROVAL_CONFIRMATION` per Company Manager via service-level exclusive claim after create; loser requests receive 409 without changing User/Company state or reviving expired tokens.
- **Implemented; verified:** V2 acceptance finding — F08 resend durable exclusivity: new `COMPANY_APPROVAL_CONFIRMATION` rows are persisted as non-usable issuance placeholders until exclusive claim and mail succeed, then promoted under a transaction; partial failure or interrupted cleanup cannot leave an extra usable credential or a usable token that was never sent.
- **Implemented; verified:** V2 acceptance finding #4 — F05/TX-02 mail-failure path no longer compensates outside the transaction: after TX-02 commits `APPROVED + INACTIVE` with confirmation capability, SMTP failure returns 503 without deleting the token or reversing Company approval, so partial compensation cannot leave `APPROVED` without a usable confirmation.
- **Canonicalized; Product/Data authority verified:** V2 acceptance finding #5 — limited onboarding authentication for Company Manager `PENDING_ACTIVATION` is now authorized by Product V02 `BR-21` (and aligned Data Contract persistence/auth lifecycle notes): separate from normal V01 ACTIVE authentication; credentials may create onboarding context with `emailVerifiedAt = null` without setting `ACTIVE`; scope limited to F02/F03/F08 plus onboarding refresh/logout; ends when User leaves `PENDING_ACTIVATION`. Backend behavior was not redesigned in this canonicalization step.
- **Verified; evidence closed:** V2 acceptance finding — BR-21 limited onboarding authentication now has focused regressions for onboarding refresh, current-session-only logout, loss of onboarding authorization after F07 activation, and rejection of onboarding access after termination; existing implementation already matched BR-21 so no behavior change was required.
- **Implemented; verified:** V2 acceptance finding — Company local state-matrix, conditional snapshot/timestamp requirements, and timestamp ordering are enforced at the Company collection validator (schema/database owner) for document saves, `findOneAndUpdate`, `updateOne`, and aggregation-pipeline updates; document `pre("validate")` remains as a shared-rule save-path check.
- **Implemented; verified:** V2 acceptance finding #6 — F05 approve and F06 reject now require referenced Manager source state `role = COMPANY_STAFF` and `status = PENDING_ACTIVATION` before committing Company/token transitions; invalid Manager role or status returns 409 without changing Company, User, or confirmation-token state.
- **Implemented; verified:** V2 acceptance finding #7 — `AuthToken` and `AuthSession` models now declare the canonical index contract: unique `AuthToken.tokenHash`, compound `AuthToken { userId: 1, type: 1 }`, and unique `AuthSession.refreshTokenHash`, while retaining existing `userId` lookup and TTL `expiresAt` indexes.
- **Implemented; verified:** V2 acceptance finding #8 — onboarding `GET /api/company` now enforces the F02 lifecycle boundary `NOT_SUBMITTED + INACTIVE` (mirroring F09 active GET `APPROVED + ACTIVE`); onboarding authentication cannot read `PENDING`, `REJECTED`, or `APPROVED + INACTIVE` Company state through that route.

## Known issues / known mismatches

- Several configuration values are both required and given unreachable defaults.
- Model and middleware barrels are empty or disconnected; seed files are placeholders.
- File-controller error formatting overlaps the centralized error handler, while request/input and business validation ownership also overlaps.
- Human decisions remain open around barrel usage, error-format boundaries, required-versus-defaulted configuration, request validation placement, and seed ownership.

## Deferred / not started

- **V13 later-slice gates:** V12 closure is deferred as the acceptance gate for
  V13 Slices 06–08 and does not block Slice 01. Slice 09–12 are implemented on
  the shared authenticated connection plane with durable HTTP resync for offline
  recovery; Slice 13 Final Acceptance remains later work.
- **V12 Final Acceptance:** Slices 01–08 are implemented and verified. Slice 09
  Final Acceptance remains in progress only for recorded acceptance findings;
  Slice 07 terminal cancellation and Slice 08 Assignment/Interview-read
  compatibility are not deferred.
- **V8 remains `PENDING`:** its Product/Data planning drafts are not approved
  implementation authority.
- **V9 deferred scope:** downstream pipeline states, My Applications,
  Invitation, Assigned Recruiter, Notification, Chat/Interview, and related
  history/snapshots remain out of implementation scope. V9 Slice 06 itself is
  completed and verified.
- V2 approved business functions F01–F10 and acceptance findings #1–#8 are complete. No further V2 business slices remain in the approved specification.
- V3 approved business functions F01–F09 and F11–F17 are complete; F10 Recruiter update is intentionally not implemented in V3. No further V3 business slices remain in the approved specification.
- V4 approved business functions F01–F06 are complete; acceptance/regression closure is verified. No further V4 business slices remain in the approved specification. Deferred V4 items (Category list/read, Job/CV integration, dynamic catalog management) stay out of scope without a new approved specification.
- V5 Slices 01–12 cover F01–F12 including the F03/F12 DRAFT privacy and delete-authority correction, plus verified acceptance corrections for submit/edit stale validation, reassign/close effective-`PUBLISHED` and mutation-boundary deadline (`$$NOW`), public-eligibility owning-Company binding, and Product/Data/Engineering documentation alignment. Final Acceptance / regression closure passed; no V5 business slice remains.
- V6 Final Acceptance / regression closure is complete: F01–F05, BR-01–BR-33, and TX-01–TX-03 were rerun with the Slices 01–06 suites, S07 acceptance suite, and the five remediation suites. The focused baseline passed 12 files / 155 tests and the official backend gate passed. No known V6 business-blocking finding remains.
- **V7 closure:** Final Acceptance / regression closure is complete across F01–F10, BR-01–BR-46, and TX-01. V7 is `COMPLETED AND VERIFIED`; no V7 business slice remains in the approved specification.
- **V11 closure:** Final Acceptance / regression closure is complete across F01–F10, BR-01–BR-55, and TX-01–TX-08. V11 is `COMPLETED AND VERIFIED`; no V11 business slice remains in the approved Conversation/Chat specification. Realtime, notification, attachment, and related deferred capabilities stay outside V11 by product boundary.
- **Resolved in S09 / acceptance:** Fixed Harvard PDF renderer (including Unicode fidelity) and owner-scoped Uploaded PDF delivery via restricted Cloudinary `authenticated` delivery are established; Preview/Download do not persist public URLs or Generated PDF state.
- **Resolved in S08:** Generated and Uploaded CVs share one owner-scoped common metadata mutation path; `PUBLIC` remains intent-only in V7 without search/access expansion.
- **Resolved in S07:** Uploaded PDF replacement validates before mutating current file; persistence failure keeps the prior current file; concurrent/stale replace cannot delete a newer current external artifact; reuses the S06 inspection owner.
- **Resolved in S06 / acceptance:** Candidate CV domain owns Uploaded-PDF business validation (actual PDF, password, exact 10 MB, ≤20 pages) via `inspectUploadedCandidateCvPdf`; Candidate Uploaded artifacts use restricted Cloudinary delivery while generic `file.service` remains infrastructure with optional authenticated delivery for that domain.
- **Resolved in S04 / acceptance:** Data §9.3 structured-record wording narrowed to Product V7 exact Generated completeness (incomplete Education/WorkExperience/Project drafts do not fail completeness by themselves; Certification/Language keep item-level validity for activation-readiness); `hiddenSections[]` members are locked to the fixed Harvard section vocabulary and cannot bypass completeness.
## Verification status

- Deterministic architecture verification exists, and the official backend verification command is `cd backend && npm run verify:agent`.
- V13 Slice 12 Offline / Reconnect Resync: focused integration coverage passed
  the new 6-test
  `test/notification/v13-slice12-offline-reconnect-resync.test.js` plus existing
  Slice 09–11 realtime suites. Then `cd backend && npm run verify:agent` passed
  (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`;
  architecture: ARCH-001 through ARCH-016; Vitest: 132 files / 1,260 tests).
  Coverage includes no Socket replay on reconnect, durable Notification inbox
  HTTP resync, canonical Conversation/Message HTTP resync, authoritative
  Conversation mode recovery after missed transitions, new-realtime-only delivery
  after reconnect, no duplicate durable data across reconnects, cross-user HTTP
  authorization on resync reads, and no offline sync/delivery persistence.
- V13 Slice 09 Notification Realtime Distribution: focused Notification
  coverage passed 5 files / 32 tests, including the new 6-test
  `test/notification/v13-slice09-notification-realtime-distribution.test.js`
  plus existing Slice 01, 02, 07, and 08 Notification suites. Then
  `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 129 files / 1,235 tests). Coverage includes rejected
  unauthenticated/invalid-session handshakes, recipient-only fan-out to every
  active socket of that User, no cross-user leak, emit only after durable
  insert, no ghost emit on materialization failure, Socket emit/disconnect
  failure leaving durable state intact, in-memory room membership without
  replay, and no SocketSession/delivery/presence persistence.
- V13 Slice 09 Notification Realtime Distribution engineering prerequisite:
  Product/Data F09 ownership points were locked into Engineering SoT,
  `architecture.md`, and `backend-conventions.md` without implementing F09
  Socket behavior. Document consistency check: the deferred “realtime
  engineering contract before Slice 09” note in PROJECT_STATUS was replaced by
  the recorded owners above; no remaining engineering doc still defers Socket
  ownership as a Slice 09 blocker. Official `cd backend && npm run verify:agent`
  passed after the documentation-only change (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 128 files / 1,229 tests).
- V13 Slice 07 Candidate Availability First Submit Notification: the focused
  Slice 07 plus V12 Availability/Assignment regression baseline passed 4 files /
  41 tests, including the new 7-test
  `test/notification/v13-slice07-candidate-availability-notification.test.js`;
  then `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2 existing
  warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through
  ARCH-016; Vitest: 127 files / 1,222 tests). Coverage includes ASSIGNED trusted
  recipient snapshots and Assignment ordering, UNASSIGNED no-event/no-fallback
  behavior, edit exclusion, TX-01 rollback, concurrent duplicate first-submit,
  and recoverable idempotent materialization.
- V13 Slice 01 Implementation Readiness baseline: focused V12 Availability +
  MongoDB transaction infrastructure coverage passed (2 files / 23 tests),
  then the official `cd backend && npm run verify:agent` gate passed without
  implementing V13 Fxx behavior (ESLint: 0 errors / 2 existing warnings in
  `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016;
  Vitest: 124 files / 1,194 tests). The stale fixed UTC calendar date in the V12
  Candidate Availability HTTP regression was replaced by a future UTC date;
  production date validation was not changed. Existing `MongoMemoryReplSet`
  and transaction rollback coverage are sufficient for Slice 01 persistence
  invariants, and no verification rule was changed or relaxed.
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
- V11 Final Acceptance & Regression Closure: after closing the Send guard-document timestamp side effect, complementary Send ↔ eligibility-loss keep ordering, and actual Send ↔ Assign-again ordering, the official `cd backend && npm run verify:agent` gate passed across F01–F10 / BR-01–BR-55 / TX-01–TX-08 (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 119 files / 1,140 tests). The focused V11 baseline passed 8 files / 104 tests, including `test/application/v11-acceptance.test.js` (20 tests) and `test/application/v11-normal-message-send.test.js` (15 tests). The remediations add no new Chat capability, field, collection, index, or migration.
- V11 Slice 01 Conversation & Message Foundation + First Assign: the official `cd backend && npm run verify:agent` gate passed after Conversation/Message persistence and First Assign TX-01 Conversation creation (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 113 files / 1,059 tests). Focused coverage passed 2 files / 23 tests. No Chat send/read HTTP, Reassign/Unassign SYSTEM Message, authorization, freeze, notification, realtime, attachment, Application field, or migration was added.
- V10 Slice 07 CompanyMember Recruiter LOCK/TERMINATE automatic Unassign integration (`ASSIGN / UNASSIGN` revision): the official `cd backend && npm run verify:agent` gate passed after CompanyMember LOCK/TERMINATE switched Application resolution from trusted `A → B` handoff to Slice 06 `A → NONE` automatic Unassign while keeping V6 Job-team Primary transfer / Supporting removal and the dual current-state final zero-responsibility guard (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 107 files / 998 tests). Focused LOCK/TERMINATE Unassign coverage passed 1 file / 17 tests. No generic Recruitment Team removal change, Platform Admin User lifecycle change, Application replacement heuristic, history, recovery state, queue, worker, field, collection, index, or migration was added.
- V10 Slice 06 Canonical Automatic-Unassign Primitive (`ASSIGN / UNASSIGN` revision): the official `cd backend && npm run verify:agent` gate passed after the internal `A → NONE` primitive reused the existing assigned-state CAS (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 107 files / 994 tests). Focused automatic-Unassign coverage passed 1 file / 22 tests. No public HTTP endpoint, CompanyMember LOCK/TERMINATE change, Recruitment Team removal change, Platform Admin User lifecycle change, field, collection, index, history, recovery state, queue, worker, or migration was added.
- V10 Slice 01 Persistence State Matrix (`ASSIGN / UNASSIGN` revision): the official `cd backend && npm run verify:agent` gate passed after the local/collection status × assignment-state matrix update (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 104 files / 900 tests). Focused persistence coverage passed 2 files / 37 tests. No schema, index, migration, or backfill was added.
- V9 Slice 01 Implementation Readiness baseline (pre-implementation): the
  official `cd backend && npm run verify:agent` gate passed after the
  readiness-only canonical/ownership/V6-regression changes (ESLint: 0 errors /
  2 existing warnings in `test/job/v6-acceptance.test.js`; architecture:
  ARCH-001 through ARCH-016; Vitest: 80 files / 581 tests). No verification
  rule was changed or relaxed, and no V9 Fxx behavior was implemented.
- V7 Final Acceptance baseline: after Slices 01–11 and all recorded acceptance remediations (Uploaded restricted delivery, Harvard Unicode fidelity, `hiddenSections` vocabulary, activation content CAS, and query-update local-invariant enforcement), the official `cd backend && npm run verify:agent` gate passed (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture verification: ARCH-001 through ARCH-016; Vitest: 80 files / 581 tests). The focused V7 suite also passed 14 files / 100 tests. Final Acceptance / regression closure is complete.
- V7 Slice 09 baseline: the official `cd backend && npm run verify:agent` gate passed after Preview/Download (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture verification: ARCH-001 through ARCH-016; Vitest: 75 files / 543 tests passed, including `test/candidate/v7-candidate-cv-preview-download.test.js` with 6 focused tests).
- V7 Slice 08 baseline: the official `cd backend && npm run verify:agent` gate passed after rename/metadata/visibility update (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture verification: ARCH-001 through ARCH-016; Vitest: 74 files / 537 tests passed, including `test/candidate/v7-candidate-cv-update-metadata.test.js` with 6 focused tests).
- V7 Slice 07 baseline: ESLint (0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`) and architecture verification (ARCH-001 through ARCH-016) passed via `npm run verify:agent`; the default parallel Vitest run flaked twice on unrelated MongoMemoryServer port conflicts in two auth suites; the full suite then passed with `npx vitest run --fileParallelism=false` (**73 files / 531 tests**, including `test/candidate/v7-candidate-cv-replace-uploaded.test.js` with 6 focused tests).
- V7 Slice 06 baseline: the official `cd backend && npm run verify:agent` gate passed after Uploaded CV create (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture verification: ARCH-001 through ARCH-016; Vitest: 72 files / 525 tests passed, including `test/candidate/v7-candidate-cv-create-uploaded.test.js` with 10 focused tests).
- V7 Slice 05 baseline: the official `cd backend && npm run verify:agent` gate passed after Generated activation + ACTIVE lifecycle (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture verification: ARCH-001 through ARCH-016; Vitest: 71 files / 515 tests passed, including `test/candidate/v7-candidate-cv-activation-active-lifecycle.test.js` with 8 focused tests).
- V7 Slice 02 baseline: the official `cd backend && npm run verify:agent` gate passed after CandidateCV foundation + My CVs read (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture verification: ARCH-001 through ARCH-016; Vitest: 68 files / 495 tests passed, including `test/candidate/v7-candidate-cv-foundation.test.js` with 7 focused tests).
- V7 Slice 01 baseline: the official `cd backend && npm run verify:agent` gate passed after F01 Candidate Profile implementation (ESLint: 0 errors / 2 existing warnings; architecture verification: ARCH-001 through ARCH-016; Vitest: 67 files / 488 tests passed, including `test/candidate/v7-candidate-profile.test.js` with 7 focused tests).
- V7 Slice 01 Implementation Readiness baseline (pre-implementation): the official `cd backend && npm run verify:agent` gate passed after the readiness-only documentation changes (ESLint: 0 errors / 2 existing warnings; architecture verification: ARCH-001 through ARCH-016; Vitest: 66 files / 481 tests passed). No verification rule was changed or relaxed.
- `npm run verify:agent` consists of ESLint, deterministic architecture verification, and Vitest. The latest auth-email-action change passed its focused suites, ESLint, architecture verification, and the full suite with `--fileParallelism=false`; the default parallel run flaked twice on unrelated MongoMemoryServer startup timeouts.
- Current V6 closure baseline: the combined focused V6 suite passed **12 files / 155 tests**, including Slices 01–06, the 29-test S07 acceptance suite, and all five Final Acceptance remediation suites. The official `cd backend && npm run verify:agent` gate also passed after that rerun (ESLint 0 errors / 2 existing warnings, architecture verification, and full Vitest).
- Focused automated tests cover V1 Slices 1–10 (`test/auth/*.test.js`), V2 flows (adapted), `test/auth/company-member-foundation.test.js`, `test/auth/v3-tx07-company-staff-cutover.test.js`, `test/auth/v3-company-staff-authorization.test.js`, `test/auth/v3-recruiter-creation.test.js`, `test/auth/v3-recruiter-activation.test.js`, `test/auth/v3-recruiter-list-detail.test.js`, `test/auth/v3-recruiter-password-reset.test.js`, `test/auth/v3-recruiter-lock-unlock.test.js`, `test/auth/v3-recruiter-termination.test.js`, `test/auth/v3-acceptance.test.js`, `test/catalog/v4-fixed-vocabularies.test.js`, `test/catalog/v4-category-field-creation.test.js`, `test/catalog/v4-category-position-creation.test.js`, `test/catalog/v4-experience-level-dataset.test.js`, `test/catalog/v4-acceptance.test.js`, `test/job/v5-job-create-draft.test.js`, `test/job/v5-recruiter-responsibility-guard.test.js`, `test/job/v5-job-edit-draft.test.js`, `test/job/v5-job-internal-visibility.test.js`, `test/job/v5-job-submit-draft.test.js`, `test/job/v5-job-manager-pending-review.test.js`, `test/job/v5-job-approve-publish.test.js`, `test/job/v5-job-reject-pending.test.js`, `test/job/v5-job-manual-delete.test.js`, `test/job/v5-job-reassign-primary.test.js`, `test/job/v5-job-manual-close.test.js`, `test/job/v5-job-effective-expiration-public-eligibility.test.js`, `test/job/v5-job-draft-privacy-delete-authority.test.js`, `test/job/v6-recruitment-team-read.test.js`, `test/job/v6-recruitment-team-add-supporting.test.js`, `test/job/v6-recruitment-team-remove-supporting.test.js`, `test/job/v6-recruitment-team-replace-primary.test.js`, `test/job/v6-forced-transfer-lock.test.js`, `test/job/v6-forced-transfer-terminate.test.js`, `test/job/v6-acceptance.test.js`, `test/job/v6-tx02-lifecycle-assignment-concurrency.test.js`, `test/job/v6-forced-transfer-atomicity.test.js`, `test/job/v6-forced-transfer-unfinished-mutation-boundary.test.js`, `test/job/v6-stale-primary-mutation-authority.test.js`, `test/job/v6-recruitment-team-query-update-invariants.test.js`, and existing V2 registration/onboarding/platform-admin suites.
- No automated test script is defined outside the backend package; frontend verification is outside `verify:agent` and was not run.
- Backend startup, Cloudinary connectivity/operations, live SMTP delivery, endpoint smoke tests outside automated registration coverage, and frontend verification are outside `verify:agent` and were not run, so their behavior is not verified by this snapshot.
- V5 Final Acceptance / regression closure passed after the acceptance fixes above: canonical F01–F12 review found no remaining blocker and the focused V5 Job regression suite passed 13 files / 94 tests.
- V6 Final Acceptance / regression closure passed after rerunning the full focused V6 baseline against the five remediation findings. This snapshot has no known V6 business-blocking finding.

## Implemented / verified

- **Implemented; verified:** V6 Final Acceptance finding — Job schema enforces Recruitment Team local invariants on query-update persistence (Data Contract 10.1; BR-01–BR-04): `supportingRecruiterCompanyMemberIds` is required with canonical `[]` representation; MongoDB collection validator plus document `pre('validate')` guard reject query writes that would `$unset` the field, duplicate Supporting, or leave `Primary ∈ Supporting` even with `runValidators: true`; canonical F02/F03/F04/F05 mutation paths unchanged. Focused regressions in `test/job/v6-recruitment-team-query-update-invariants.test.js` (8 tests).

- **Implemented; verified:** V6 Final Acceptance finding — stale Primary cannot mutate Recruitment Team or close Job after losing Primary authority (F02, F03, F09/V5 close; BR-14, BR-15, BR-31): Recruiter paths for add Supporting, remove Supporting, and close Job bind `primaryRecruiterCompanyMemberId = actorCompanyMemberId` into the conditional write so concurrent F04 replacement that demotes the actor to Supporting or NONE fails at the mutation boundary (403) without changing the Job; Company Manager retains company-scoped authorization without a Primary predicate; effective-PUBLISHED/deadline, tenant, TX-01/TX-02, and F04 semantics are unchanged. Focused regressions in `test/job/v6-stale-primary-mutation-authority.test.js` (8 tests).

- **Implemented; verified:** V6 Final Acceptance finding — forced transfer unfinished/effective-deadline predicate at mutation boundary (F05; BR-24, BR-30, BR-31; TX-01): `executeForcedPrimaryTransfer` and `executeForcedSupportingRemoval` bind `JOB_STILL_UNFINISHED_AT_FORCED_MUTATION` (`DRAFT` | `PENDING_APPROVAL` | `PUBLISHED` with `applicationDeadline > $$NOW`) into the conditional write so Jobs that become `CLOSED`, `EXPIRED`, or effectively expired after unfinished discovery cannot have historical Primary/Supporting mutated; finished-Job misses are no-ops and lock/terminate re-evaluate zero active responsibility on current unfinished state. Focused regressions in `test/job/v6-forced-transfer-unfinished-mutation-boundary.test.js` (9 tests).

- **Implemented; verified:** V6 Final Acceptance finding — forced Primary transfer preserves `Primary ∉ Supporting` under stale pre-read classification (F05; BR-02, BR-25, BR-26; TX-01 / Data Contract 8.7): `executeForcedPrimaryTransfer` no longer branches final persistence on a pre-transaction NONE vs Supporting classification; one atomic `$set` Primary + `$pullAll` of replacement and outgoing Primary from Supporting guarantees the final persisted state regardless of concurrent add-Supporting after a stale NONE pre-read. Focused regressions in `test/job/v6-forced-transfer-atomicity.test.js` (3 tests).

- **Implemented; verified:** V6 Final Acceptance finding — TX-02 serialization between active-team assignment and `LOCK`/`TERMINATE` completion (F02, F04, F05; TX-02): every path that assigns active Primary/Supporting responsibility acquires the ACTIVE Recruiter membership inside the same MongoDB transaction before the Job write, and lock/terminate re-assert zero unfinished responsibility inside the terminal lifecycle transaction so concurrent create-DRAFT / add-Supporting / replace-Primary / forced-transfer cannot commit `LOCKED`/`TERMINATED` with active unfinished team responsibility. Focused regressions in `test/job/v6-tx02-lifecycle-assignment-concurrency.test.js` (8 tests).

- **Implemented; verified:** V6 Slice 07 — Final acceptance suite (F01–F05; BR-01–BR-33; TX-01–TX-03): cross-cutting suite covers Recruitment Team structural invariants (exactly one Primary, 0..N unique Supporting, Primary not in Supporting, per-Job responsibility not User/CompanyMember role, `createdByCompanyMemberId` independent of current Primary through replace/forced-transfer); F01 read boundary; F02/F03/F04 constraints; TX-01 atomic outcome checks; F05 forced-transfer happy paths and BR-27/BR-26/BR-28/BR-29 regressions; deferred-scope absence; V5 Supporting-default compatibility. Coverage in `test/job/v6-acceptance.test.js` (**29 tests**). The later blocking findings (TX-02 lifecycle/assignment serialization; forced Primary `Primary ∉ Supporting` race; forced mutation after Job ended; stale Primary add/remove/close authority; query-update schema invariant bypass) were remediated and then rerun with the entire focused V6 baseline: 12 files / 155 tests passed, followed by the official backend gate. V6 Final Acceptance is `COMPLETED AND VERIFIED`.

- **Implemented; verified:** V6 Slice 06 — Forced transfer before TERMINATE + unlock regression (F05 TERMINATE/UNLOCK; BR-23–BR-29, BR-32; TX-02, TX-03): extends `terminateRecruiter` to accept `transfers` array and reuse the same canonical forced-transfer foundation from Slice 05; before terminate completion, finds all unfinished Jobs (DRAFT, PENDING_APPROVAL, effectively-PUBLISHED) where Recruiter is Primary or Supporting; for Primary Jobs, executes forced transfer to replacement (existing Supporting promotes; NONE-state replacement uses forced exception NONE→SUPPORTING→PRIMARY per BR-25); old Primary always ends at NONE (BR-26); for Supporting Jobs, removes Supporting responsibility automatically (BR-28); TX-02 concurrency guard locks replacement membership within transaction; TX-03 per-Job independent commits; blocks terminate when any Primary Job has no valid replacement (BR-27); replacement must pass full operational eligibility (BR-08/BR-10) and belong to same Company (BR-09); LOCKED Recruiters can be terminated from LOCKED with forced transfer; CLOSED/EXPIRED/effectively-expired PUBLISHED Jobs are excluded; `createdByCompanyMemberId`, `companyId`, Job content, and Job lifecycle state are unchanged (BR-32); unlock regression proves unlock does not restore Primary or Supporting positions after forced transfer — team state after lock/forced-transfer is the canonical current state; unlock does not write `primaryRecruiterCompanyMemberId` or `supportingRecruiterCompanyMemberIds` (BR-29); V3 persisted state/session-revocation invariants (TX-05) are preserved. Focused coverage in `test/job/v6-forced-transfer-terminate.test.js` (15 tests).

- **Implemented; verified:** V6 Slice 05 — Forced transfer before LOCK (F05 LOCK; BR-02, BR-08–BR-10, BR-18, BR-20, BR-22–BR-28, BR-30, BR-32; TX-02, TX-03): modifies `lockRecruiter` to accept `transfers` array specifying per-Job Primary replacement; before lock completion, finds all unfinished Jobs (DRAFT, PENDING_APPROVAL, effectively-PUBLISHED) where Recruiter is Primary or Supporting; for Primary Jobs, executes forced transfer to replacement (existing Supporting promotes via SUPPORTING→PRIMARY; NONE-state replacement uses forced exception NONE→SUPPORTING→PRIMARY per BR-25); old Primary always ends at NONE (BR-26, not kept as Supporting); for Supporting Jobs, removes Supporting responsibility automatically (BR-28); TX-02 concurrency guard locks replacement membership within transaction to prevent concurrent LOCKED/TERMINATED; TX-03 per-Job independent commits (no global all-or-nothing); blocks lock when any Primary Job has no valid replacement (BR-27); replacement must pass full operational eligibility (BR-08/BR-10) and belong to same Company (BR-09); replacement cannot be the Recruiter being locked; `createdByCompanyMemberId`, `companyId`, Job content, and Job lifecycle state are unchanged; CLOSED/EXPIRED/effectively-expired PUBLISHED Jobs are excluded from forced transfer; no forced-transfer for TERMINATE (Slice 06); no unlock behavior change; no normal team management on DRAFT/PENDING_APPROVAL opened. Focused coverage in `test/job/v6-forced-transfer-lock.test.js` (16 tests); existing V5 reassign test updated to reflect auto-removal of Supporting before lock.

- **Implemented; verified:** V6 Slice 04 — Replace Primary Recruiter (F04; BR-02, BR-04, BR-06, BR-08–BR-10, BR-12–BR-13, BR-19–BR-22, BR-30, BR-32; TX-01, TX-02): adds `POST /api/jobs/:jobId/team/replace-primary` allowing Company Manager to replace the current Primary with a current Supporting Recruiter of the same Job; Company Manager chooses whether old Primary stays as Supporting or leaves team (`keepOldPrimaryAsSupporting`); new Primary must pass full operational eligibility (active membership, active User, `mustChangePassword=false`, same Company, Company `APPROVED + ACTIVE`) checked within a transaction; TX-01 atomic single-document mutation ensures no intermediate state with missing Primary, dual Primary, or new Primary still in Supporting; TX-02 concurrency boundary prevents concurrent LOCKED/TERMINATED from committing while promoting; normal replacement requires Job effectively `PUBLISHED` (persisted `PUBLISHED` with `$$NOW < applicationDeadline`); `NONE → PRIMARY_RECRUITER` direct transition is rejected; `createdByCompanyMemberId`, `companyId`, Job content, and Job lifecycle state are unchanged; Recruiter and Supporting actors cannot replace Primary (BR-19). Focused coverage in `test/job/v6-recruitment-team-replace-primary.test.js`.

- **Implemented; verified:** V6 Slice 04 acceptance finding — both canonical `POST /api/jobs/:jobId/team/replace-primary` and legacy `POST /api/jobs/:jobId/reassign-primary` now require explicit `keepOldPrimaryAsSupporting` (boolean) in the request body; the canonical `replacePrimaryRecruiter` service no longer has a default value — if the field is missing, the request is rejected with 400 before any mutation; Company Manager must explicitly choose the outcome of the current Primary per F04 step 3; no normal Primary replacement surface silently defaults `PRIMARY_RECRUITER → SUPPORTING_RECRUITER` or `→ NONE`. Focused regressions in `test/job/v6-recruitment-team-replace-primary.test.js`, `test/job/v5-job-reassign-primary.test.js`, and `test/job/v5-job-manual-close.test.js`.

- **Implemented; verified:** V6 Slice 03 — Remove Supporting Recruiter (F03; BR-12–BR-15, BR-18, BR-30, BR-32): adds `DELETE /api/jobs/:jobId/team/supporting/:companyMemberId` allowing Company Manager or current Primary Recruiter to remove a Supporting Recruiter from an effectively `PUBLISHED` Job; atomic conditional `$pull` with `$$NOW` deadline guard ensures mutation-boundary consistency; target must be current Supporting (not Primary, not absent); Primary, `createdBy`, Company ownership, Job content, and Job lifecycle state are unchanged; BR-18 responsibility-transfer check is vacuously satisfied because V6 has no Application/Invitation responsibility objects — no speculative persistence or lookup was created; cross-tenant, ended-Job (`CLOSED`, `EXPIRED`, effectively expired `PUBLISHED`), and unauthorized-actor requests are denied; F01 read authorization and F02 add-Supporting/TX-02 behavior remain unchanged. Focused coverage in `test/job/v6-recruitment-team-remove-supporting.test.js`.

- **Implemented; verified:** V6 Slice 02 — Add Supporting Recruiter (F02; BR-04, BR-08–BR-10, BR-12–BR-17, BR-30, BR-32) + TX-02 boundary. Adds `POST /api/jobs/:jobId/team/supporting` with validator + service-side canonical eligibility checks; constrains operation to effectively `PUBLISHED` at mutation boundary (deadline via `$$NOW` semantics); enforces operational eligibility for target Recruiter (active membership, recruiter role, active User, `mustChangePassword=false`, same Company, Company `APPROVED + ACTIVE`); preserves job invariants (Primary/createdBy/company ownership/status/content unchanged) while atomically updating only `supportingRecruiterCompanyMemberIds`; extends lock/terminate completion guard to block LOCKED/TERMINATED recruiters that still hold active Supporting responsibilities on un-ended jobs (TX-02); regression ensures generic Job read does not expose `supportingRecruiterCompanyMemberIds`. Focused coverage in `test/job/v6-recruitment-team-add-supporting.test.js`. 
