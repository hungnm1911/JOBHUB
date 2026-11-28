# Backend V18 Admin communication and statistics

## Current project state

User-approved V18 scope is implemented and verified on 2026-11-28.
Announcement audience snapshot/durable batch recovery, Company-submission Admin
notifications, Company support with independent authorization/idempotency and
read-only platform aggregates are implemented. Existing Notification inbox and
realtime plane are reused. Application chat authorization remains unchanged.

## Deferred / not started

Email/push/SMS, scheduled/targeted/recallable announcements, attachment/typing/
receipts/ticket assignment, trends/date filters/export and KPI realtime remain out
of scope. Production deployment/load testing is not claimed. Announcement audience
capture uses a transaction with bounded insert chunks; very large audiences remain
subject to the deployment's MongoDB transaction time/resource limits.

## Verification status

- Focused Notification + existing kernel/inbox regression: 3 files / 16 tests passed.
- Focused support/statistics: 1 file / 4 tests passed, including concurrent idempotent
  Send, tenant/role denial, Company lock, guard timestamps and zero-filled statistics.
- First common gate: lint 0 errors/2 existing warnings; ARCH-001–019 passed;
  222 files passed, refresh-access suite failed to start temporary MongoDB because
  its chosen port was already in use (2277 passed/7 skipped).
- Final common gate rerun passed: `cd backend && npm run verify:agent -- -- --maxWorkers=2`;
  lint 0 errors/2 existing warnings, ARCH-001–019, 223 files / 2284 tests passed.
  Two independent test workers were used; no suite was excluded or skipped.
- Additional isolated delivery smoke passed with 80 recipients and 20-row batches:
  injected one materialization failure stayed pending, subsequent recovery completed
  with exactly 80 inbox items/no duplicate, and zero-audience publication completed.
- Chrome checks used isolated MongoDB + real HTTP/Socket.IO, not production data;
  see Frontend V18 leaf. SMTP/Cloudinary/production external-service smoke not run.
