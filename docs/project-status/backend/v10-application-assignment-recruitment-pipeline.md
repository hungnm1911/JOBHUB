# Backend V10 Application Assignment and Recruitment Pipeline Project Status

## Current project state

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

The current canonical V10 Product Specification covers F01–F11 and BR-01–BR-53.
Slice 01 reuses the existing Application field, indexes, revision/CAS,
Candidate–Job uniqueness, identity immutability, and snapshot contract. It
changed only the local status × assignment-state persistence matrix so every
non-terminal Recruitment Status can persist `UNASSIGNED`; no new V10
persistence entity, field, collection, counter, history, index, migration, or
backfill was added.

## Current ASSIGN / UNASSIGN revision

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

## Previous revision summary (historical)

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
`docs/product/backend/versions/v10-application-assignment-recruitment-pipeline.md`
and
`docs/data/backend/versions/v10-application-assignment-recruitment-pipeline-data-model.md`.
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

## Verification status

- V10 Slice 07 CompanyMember Recruiter LOCK/TERMINATE automatic Unassign integration (`ASSIGN / UNASSIGN` revision): the official `cd backend && npm run verify:agent` gate passed after CompanyMember LOCK/TERMINATE switched Application resolution from trusted `A → B` handoff to Slice 06 `A → NONE` automatic Unassign while keeping V6 Job-team Primary transfer / Supporting removal and the dual current-state final zero-responsibility guard (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 107 files / 998 tests). Focused LOCK/TERMINATE Unassign coverage passed 1 file / 17 tests. No generic Recruitment Team removal change, Platform Admin User lifecycle change, Application replacement heuristic, history, recovery state, queue, worker, field, collection, index, or migration was added.

- V10 Slice 06 Canonical Automatic-Unassign Primitive (`ASSIGN / UNASSIGN` revision): the official `cd backend && npm run verify:agent` gate passed after the internal `A → NONE` primitive reused the existing assigned-state CAS (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 107 files / 994 tests). Focused automatic-Unassign coverage passed 1 file / 22 tests. No public HTTP endpoint, CompanyMember LOCK/TERMINATE change, Recruitment Team removal change, Platform Admin User lifecycle change, field, collection, index, history, recovery state, queue, worker, or migration was added.

- V10 Slice 01 Persistence State Matrix (`ASSIGN / UNASSIGN` revision): the official `cd backend && npm run verify:agent` gate passed after the local/collection status × assignment-state matrix update (ESLint: 0 errors / 2 existing warnings in `test/job/v6-acceptance.test.js`; architecture: ARCH-001 through ARCH-016; Vitest: 104 files / 900 tests). Focused persistence coverage passed 2 files / 37 tests. No schema, index, migration, or backfill was added.
