# Recruiter home — Company Jobs first

## Current project state

**IMPLEMENTED / FOCUSED VERIFIED; common frontend gate blocked by existing lint.**

The approved `/recruiter` home uses the Company Jobs first layout. The existing
Recruiter route guards/layout remain in place. The main area lists internal
persisted-PUBLISHED Jobs through `COMPANY_PUBLISHED` or `MY_TEAM`, with title
search, sorting, pagination, effective-expiry labels and internal detail links.
There are no Candidate Apply/Save actions or cross-Company discovery reads.

The side area shows recent assigned Applications, including terminal records
for review, the full-scope workload supplied by the Backend, and read-only recent
Notifications. Resource loading/error/empty states are independent. Notification
and reconnect events trigger authoritative HTTP resynchronization. Previewing a
Notification does not mark it opened.

The existing menu/logo, default Recruiter login landing, account workspace link
and successful activation link now reach `/recruiter`. Feature ownership remains
in `recruiter-workspace/components/RecruiterHome/`; the page only composes it.
Product authority: approved home composition in Backend Product V6, with the
existing V10 Application/workload and V13 Notification semantics.

## Deferred / not started

- The earlier Recruiter review fixes (message-history resync, Notification
  target routing, scheduling timezone and historical Assignee filters) remain
  outside this implementation, per the user's instruction.
- Common-gate ESLint failures remain in Candidate ApplicationConversationPanel,
  useCandidateApplicationDetail and ApplicationStatusBadge. No rule was disabled
  and these unrelated files were not changed.
- Live authenticated Recruiter/Backend E2E is unverified. Browser checks below
  use temporary fixture responses against the actual route/layout/components;
  they do not prove Backend authorization, persistence or live integration.

## Verification status

- `NODE_OPTIONS=--no-experimental-global-navigator corepack yarn verify:agent`:
  all 127 tests passed, including the three new Recruiter home tests; the command
  failed at the three existing ESLint errors before its build stage.
- `corepack yarn build`: passed separately; existing large-chunk warning remains.
- Focused ESLint on all changed/new frontend source files and
  `test/recruiter-home.test.js`: passed.
- Browser fixture checks: actual `/recruiter` route and layout rendered the main
  Jobs area and side rail; title search and `MY_TEAM` scope updated the Job list
  while workload/recent records remained independent. Mobile rendering at 375px
  and 320px had no document-level horizontal overflow. Browser paging changed
  to the next Jobs page while the side rail stayed intact. Internal detail-link
  navigation and server-side query contracts are covered by the focused tests.
- No Backend implementation, schema, migration or production dependency changed.
