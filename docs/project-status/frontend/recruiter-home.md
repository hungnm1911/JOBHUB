# Recruiter home — Company Jobs first

## Current project state

**IMPLEMENTED / FOCUSED VERIFIED; common frontend gate blocked by existing lint.**

The approved Recruiter home is now `/` under the website `RootLayout`, with
header/footer and no management sidebar. `WebsiteHomePage` selects it only for a
resolved active Recruiter. Guest/Candidate keep the existing Discovery homepage.
The company-first Jobs list retains internal `COMPANY_PUBLISHED`/`MY_TEAM`,
server search/paging and expiry semantics, but opens public `/jobs/:jobId` detail.
The website adds keyword/Location search to `/jobs`, a six-Job NEWEST market
preview, and direct links into the separate management workspace.

Recent assigned Applications/workload and read-only Notification previews retain
the existing independent states and HTTP resync. `/recruiter` redirects to
`/recruiter/jobs`; sidebar home/logo and activation success return to `/`.
`GuestRoute` alone resolves the post-login return/default location after staff
membership finishes loading, with retry on context failure. Public Job and
Company pages reuse existing Discovery components without Candidate actions.
Product authority is V6's approved home composition and V8's approved Recruiter
public-read extension; no new schema, endpoint, production dependency or migration.

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
  all 138 tests passed, including 16 Discovery guard cases and nine home/website
  cases. The common command failed at the same three existing ESLint errors
  listed above; it is not recorded as passed.
- `corepack yarn build`: passed separately, with the existing large-chunk warning.
- Focused ESLint on every changed/new frontend source/test: passed.
- Browser fixture checks against the actual router/layout/components: `/` has
  the website shell; company Job -> public detail -> public Company/Company Jobs
  works; keyword + Location search reaches `/jobs?q=React&locations=01`; the
  management link reaches `/recruiter/jobs` with the separate sidebar. Candidate
  action controls are absent. No page-wide horizontal overflow at 1440px, 375px
  or 320px; no browser console errors observed in this fixture session.
- Regression cases cover delayed/failed/recovered membership, login default and
  deep-link state, public read-only browsing, Company-scoped public Jobs, home
  scopes/paging and independent partial failures. They do not prove live E2E.
- Backend API verification is recorded separately in the Backend V8 leaf.
