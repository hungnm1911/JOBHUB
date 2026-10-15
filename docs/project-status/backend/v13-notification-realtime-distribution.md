# Backend V13 Notification and Realtime Distribution Project Status

## Current project state

**V13 — Notification và phân phối realtime** is `COMPLETED AND VERIFIED`:
Slices 01–12 plus Slice 13 Final Acceptance passed across `F01`–`F11`,
`BR-01`–`BR-50`, and `TX-01`. The final independent architecture review found
no Critical finding. Its one High finding (the V12 closure gate for Slices
06–08) was resolved when V12 became `COMPLETED AND VERIFIED`. Its one Medium
finding (malformed `notificationId` returned 500 instead of 404 on Notification
fetch/open) is fixed and regression-covered, and the official backend gate
passed afterwards. Two non-blocking Low findings are deferred (see below).
Its approved canonical Product/Data contracts are tracked at
`docs/product/versions/v13-notification-realtime-distribution.md` and
`docs/data/versions/v13-notification-realtime-distribution-data-model.md`.
Gate 00 corrects the canonical boundary before business implementation: V12
did not persist Notification, so V13 introduces both `Notification` and
`NotificationEvent` as new entities; every V13 Notification has a required
`eventId` and the `{ eventId, recipientUserId }` uniqueness is not partial.
V13 also inherits the V12 Interview Schedule lifecycle unchanged and does not
add `InterviewSchedule.COMPLETED` or `INTERVIEW_SCHEDULE_COMPLETED`.

## Deferred / not started

- **V13 closure:** Final Acceptance is complete; no V13 business slice remains.
  V12 is `COMPLETED AND VERIFIED`, so the V12 closure gate for Slices 06–08 is
  satisfied. Job Invitation Notification (owned by V15), Message read receipt,
  typing/presence, mark-all/mark-unread/delete/archive, Notification
  preference, email/push/SMS, Socket replay, and
  `InterviewSchedule.COMPLETED` stay outside V13 by approved product boundary.
- **Deferred non-blocking Low findings (no V13 business behavior is violated):**
  - Notification HTTP and realtime payloads serialize the raw `Notification`
    document (including `eventId`, `actorUserId`, `updatedAt`); for
    candidate-facing `APPLICATION_UNASSIGNED`, `actorUserId` being null vs set
    lets a Candidate infer automatic vs manual Unassign. Needs a public
    Notification projection in a later API-contract change.
  - The inbox list is unpaginated; Data Contract IDX-N01 defers pagination to
    the later Data/API layer.

## Implementation record (slice detail)

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

Slice 05 is implemented and verified for Assignment Notification (`F03`; `BR-10`–`BR-19`,
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
Data §9.5 / §14.1). `src/sockets/realtime-server.socket.js` owns Socket.IO
lifecycle, `authenticateAccess` handshake auth (ACTIVE User + valid
AuthSession only), and in-memory `user:{userId}` membership;
`src/sockets/realtime-events.socket.js` owns recipient-scoped transport
payloads/fan-out through the `src/sockets/index.js` facade. Business recipient
and post-commit decisions remain in their source services. `backend/index.js`
attaches after the HTTP server exists
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

## Verification status

- V13 Slice 13 Final Acceptance: independent architecture review of F01–F11,
  BR-01–BR-50, and TX-01 found no Critical finding; the V12-closure High gate
  was satisfied by V12 closure, the Medium finding (malformed `notificationId`
  → 500) was fixed in `notification.service.js` with the regression test in
  `test/notification/v13-slice02-notification-inbox-read-state.test.js` (failed
  with `expected 500 to be 404` before the fix), and the Low findings above are
  deferred. `cd backend && npm run verify:agent` passed (ESLint: 0 errors / 2
  existing warnings in `test/job/v6-acceptance.test.js`; architecture:
  ARCH-001 through ARCH-018; Vitest: 169 files / 1,765 tests). A first run
  failed only because MongoMemoryServer picked an already-used port in one
  suite; the rerun passed. Not verified: behavior against a real MongoDB/Socket.IO
  deployment or multiple server instances (rooms are in-memory by contract).

- V13 Socket.IO ownership refactor (2026-10-09): Socket.IO lifecycle,
  authenticated User-room membership, transport payloads, and fan-out moved
  without business-behavior or persistence changes from the former
  `services/realtime-distribution.service.js` owner into the canonical
  `src/sockets/` layer and public `src/sockets/index.js` facade. Business
  recipient resolution and durable/post-commit timing remain in
  `application.service.js` and `notification.service.js`. Focused V13 Slice
  09–12 coverage passed 4 files / 31 tests. Then `cd backend && npm run
  verify:agent` passed (ESLint: 0 errors / the same 2 pre-existing warnings in
  `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-018;
  Vitest: 167 files / 1,735 tests).

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
