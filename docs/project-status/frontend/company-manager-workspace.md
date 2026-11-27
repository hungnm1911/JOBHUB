# Frontend Company Manager Workspace Project Status

## Current project state

2026-11-28 correctness fixes: the shared Company profile form locks text inputs
while PATCH is pending, tracks logo/banner uploads in its save/departure guard,
and ignores image responses after unmount. These fixes also apply to onboarding.
Four async regressions pass; the Frontend gate still stops on the same three
Candidate lint errors, with all 158 tests passing and production build passing.

2026-11-27: the approved Company Manager workspace and website homepage are
implemented with existing API modules, scoped automated verification and
real-component browser-fixture checks.
The common Frontend gate is **not passed**: its tests pass, but existing Candidate
lint errors stop the gate. A separate production build passes.

- `/company/jobs` defaults to pending approval and offers only Manager-visible
  Job statuses, server search/sort/paging and effective-expiration badges.
- `/company/jobs/:jobId` provides read-only content, explicit approve/publish,
  irreversible reject/delete and close confirmations, team management and
  Application assignment. No Job editing/reopen or Recruiter processing action
  is introduced for Manager.
- `/company/recruiters`, `/new`, `/:recruiterId` provide paginated search,
  creation/activation email, metadata edit, activation resend, password-reset
  email and membership unlock. User, membership and activation state remain
  distinct; account routes use User IDs.
- `/:recruiterId/handover?intent=lock|terminate` previews unfinished Primary Job
  IDs/statuses and Supporting count, selects eligible replacement CompanyMember
  IDs and calls the existing lifecycle mutations. All Primary replacements are
  required. A conflict/failure clears choices and rereads responsibilities and
  source membership before retry; partial progress is explained.
- `/company/profile` reuses the existing Company form in active mode: immutable
  legal identity is read-only and omitted from PATCH. Existing image upload,
  rich text and unsaved-change owners are reused.
- `/` is now the active Company Manager login default, preserving Company
  workspace return links and onboarding/password gates. Its homepage previews
  pending Jobs (3), persisted-published Jobs (2), newest Recruiters (3) and the
  owned Company using four independent internal reads. Totals come from server
  pagination, expiration badges use existing helpers, and each region supports
  loading/error/retry/empty states. Focus and shared socket CONNECT reread state;
  changing Manager identity remounts previews. Homepage links enter existing
  workspace screens, with no inline decisions or Recruiter processing.
- RootLayout owns header/footer/unsaved changes; CompanyManagerLayout owns only
  workspace navigation. Active Manager website navigation links home and Company
  management. The root-only homepage exception grants no Discovery resource/API
  access; Backend guards remain authoritative.

## Deferred / not started

- Full Frontend gate acceptance awaits the three existing lint findings in
  `candidate-applications/components/ApplicationConversationPanel.jsx`,
  `candidate-applications/hooks/useCandidateApplicationDetail.js` and
  `candidate-dashboard/components/ApplicationStatusBadge.jsx`. These files are
  outside this change; a HEAD-content lint check reproduced the first finding.
- Real authenticated browser-to-running-Backend E2E, SMTP and Cloudinary were
  not verified. Browser QA uses mocked API responses and actual components;
  Backend HTTP integration tests use disposable MongoDB.

## Verification status

- 2026-11-28: the two original async probes failed before the fix. Four permanent
  tests in `test/company-profile-async.test.js` now pass: pending uploads prevent
  save/departure, text inputs lock during PATCH, failed uploads release the guard,
  and overlapping logo/banner uploads block save until both settle. They run in
  `test:rich-text`, included by the official `verify:agent` gate. Final gate:
  158/158 tests pass, then the three existing Candidate lint errors stop it.
  Scoped ESLint for both changed form components and the new test passes;
  `corepack yarn build` passes separately. No live SMTP/Cloudinary or browser E2E
  is claimed for these focused JSDOM regression checks. Twelve component-to-real-HTTP
  flows also passed against disposable MongoDB after the fixes, with SMTP/catalog
  mocked; the seed tenant was preserved. The Backend DRAFT disclosure fix and
  its separate gate evidence are recorded in V10 / Platform and operations.

- `NODE_OPTIONS=--no-experimental-global-navigator corepack yarn test:company-manager`
  passed **16/16** tests: internal homepage query shapes and server totals,
  effective expiration, independent loading/error/retry/empty states,
  account-context recovery/default login/Company return links, root-only Manager
  access and ineligible account denial, identity-switch rereads, focus/reconnect
  refresh and listener cleanup, route membership boundary, workspace/public
  header navigation, pending/no-DRAFT Job list,
  effective expiration, approval confirmation, expected-version assignment on
  ended Jobs, partial-conflict handover retry, Manager Primary replacement and
  ended-team read-only behavior, metadata-only and active-profile PATCH limits.
  This command is included in the common `verify:agent` script.
- Scoped ESLint across every changed/new frontend JS/JSX module and the test
  passed. `corepack yarn build` passed with the existing >500 kB chunk warning.
- `NODE_OPTIONS=--no-experimental-global-navigator corepack yarn verify:agent`
  ran every test command successfully, then failed on the three baseline lint
  errors named above. Build was run separately after that failure. The Node flag
  accommodates the repository's existing JSDOM navigator assignments.
- Browser QA at 1280px and 375px used an ephemeral local Vite fixture with actual
  layouts/pages/components and mocked transport: list/detail navigation,
  approve confirmation/result, assignment chooser/result, create-form required
  validation, immutable Company identity, handover required replacement and
  confirmation. Measured page width equals viewport width at 375px for the
  Application, Recruiter create, Company profile and handover screens. Temporary
  viewport settings were reset and the fixture server stopped.
- Homepage browser QA at 1280px and 375px used the same ephemeral fixture with
  actual public routes, Company Manager guards, RootLayout and feature components.
  Verified pending/published previews and true totals, expiration/readiness,
  Manager header/footer, Job review navigation, Company profile navigation and
  return home. At both widths page scroll width equals viewport width; mobile
  Company/Recruiter cards and footer render without horizontal clipping. Temporary
  viewport settings were reset and the fixture server stopped. This is mocked
  transport QA, not authenticated browser-to-running-Backend E2E.
- Prior workspace code was committed and pushed to `origin/minhnd` as `dbbf23b`
  before homepage implementation, as requested. Homepage, seed tooling and
  correctness fixes are included in the subsequent Company Manager update.
- API handoff: [V1–V4 API](../../engineering/v1-v4-api-contract.md#company-manager-handover-preview--2026-11-27)
  and [Job/assignment API](../../engineering/recruiter-api-contract.md#company-manager-workspace-consumption--2026-11-27).
