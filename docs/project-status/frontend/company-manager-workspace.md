# Frontend Company Manager Workspace Project Status

## Current project state

2026-11-27: the approved Company Manager screens are implemented with live API
modules, scoped automated verification and real-component browser-fixture checks.
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
- The existing onboarding route and post-login destination are preserved.
  RootLayout owns header/footer/unsaved changes; CompanyManagerLayout owns only
  workspace navigation. Backend guards remain authoritative.

## Deferred / not started

- Company Manager homepage after login is explicitly deferred by the user.
- Full Frontend gate acceptance awaits the three existing lint findings in
  `candidate-applications/components/ApplicationConversationPanel.jsx`,
  `candidate-applications/hooks/useCandidateApplicationDetail.js` and
  `candidate-dashboard/components/ApplicationStatusBadge.jsx`. These files are
  outside this change; a HEAD-content lint check reproduced the first finding.
- Real authenticated browser-to-running-Backend E2E, SMTP and Cloudinary were
  not verified. Browser QA uses mocked API responses and actual components;
  Backend HTTP integration tests use disposable MongoDB.

## Verification status

- `NODE_OPTIONS=--no-experimental-global-navigator corepack yarn test:company-manager`
  passed **8/8** tests: route membership boundary, workspace/public header navigation, pending/no-DRAFT Job list,
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
- API handoff: [V1–V4 API](../../engineering/v1-v4-api-contract.md#company-manager-handover-preview--2026-11-27)
  and [Job/assignment API](../../engineering/recruiter-api-contract.md#company-manager-workspace-consumption--2026-11-27).
