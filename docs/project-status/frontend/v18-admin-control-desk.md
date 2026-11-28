# Frontend V18 Admin Bàn điều hành

## Current project state

Implemented the selected Bàn điều hành with real APIs: review summary/server-paged
list + existing snapshot decisions, Companies/Recruiters, Accounts/membership,
immutable FIELD/POSITION creation, announcement preview/publish/progress, own inbox,
shared Company support and status statistics. Manager support + notifications are
implemented. Candidate/Recruiter retain existing inbox and receive announcements.
Final common Frontend gate passed. Generic lifecycle actions are offered only for
Candidate or resolved Recruiter accounts; unresolved Company Staff is read-only.

## Deferred / not started

Production deployment, native zoom/assistive technology review and large-dataset
load tests remain unverified. No scheduled/recallable broadcast, attachment,
receipts/typing, trend charts or recruitment-chat Admin access. Existing production
build warns about chunks larger than 500 kB.

## Verification status

- Final common FE gate passed tests, lint and production build after fixing
  three existing Candidate lint blockers. Node 24 uses the compatibility environment flag:
  `NODE_OPTIONS=--no-experimental-global-navigator yarn verify:agent`.
- Headless Chrome with a separate temporary MongoDB/real BE + FE passed 10 checks:
  summary and oldest pending records; server Account pagination; Company current
  detail/Manager/Recruiter list; broadcast preview/publish/worker progress;
  category creation; live Admin↔Manager Socket chat; per-User read state; Manager
  broadcast/support inbox; statistics; eight Admin routes at 390px without page
  overflow. No browser page errors. Desktop 1440×1000 and mobile 390×844.
- Browser checks do not claim production validation or full coverage of existing
  account/Company destructive actions, SMTP approval mail or every error state.
