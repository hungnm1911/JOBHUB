# Backend V11 Application Conversation and Chat Project Status

## Current project state

**V11 — Conversation và Chat thuộc Application** is `COMPLETED AND VERIFIED`.
Slices 01–06 plus Slice 07 Final Acceptance & Regression Closure passed across
`F01`–`F10`, `BR-01`–`BR-55`, and `TX-01`–`TX-08`. Canonical Product/Data
contracts remain authority for the closed Conversation/Chat business scope.
Realtime Chat, Socket.IO, notification, attachment, read receipt, typing,
edit/delete/reaction, Direct Chat, Assignment History, Status History, and
Application Timeline stay out of V11 by approved product boundary (deferred /
later versions), not as remaining V11 business slices.

## Deferred / not started

- **V11 closure:** Final Acceptance / regression closure is complete across F01–F10, BR-01–BR-55, and TX-01–TX-08. V11 is `COMPLETED AND VERIFIED`; no V11 business slice remains in the approved Conversation/Chat specification. Realtime, notification, attachment, and related deferred capabilities stay outside V11 by product boundary.

## Current Conversation revision

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

## Verification status

- V11 Final Acceptance & Regression Closure: after closing the Send guard-document timestamp side effect, complementary Send ↔ eligibility-loss keep ordering, and actual Send ↔ Assign-again ordering, the official `cd backend && npm run verify:agent` gate passed across F01–F10 / BR-01–BR-55 / TX-01–TX-08 (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 119 files / 1,140 tests). The focused V11 baseline passed 8 files / 104 tests, including `test/application/v11-acceptance.test.js` (20 tests) and `test/application/v11-normal-message-send.test.js` (15 tests). The remediations add no new Chat capability, field, collection, index, or migration.

- V11 Slice 01 Conversation & Message Foundation + First Assign: the official `cd backend && npm run verify:agent` gate passed after Conversation/Message persistence and First Assign TX-01 Conversation creation (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 113 files / 1,059 tests). Focused coverage passed 2 files / 23 tests. No Chat send/read HTTP, Reassign/Unassign SYSTEM Message, authorization, freeze, notification, realtime, attachment, Application field, or migration was added.
