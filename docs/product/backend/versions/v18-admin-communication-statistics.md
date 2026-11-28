# V18 — Admin communication, support and statistics

Status: APPROVED FOR IMPLEMENTATION by the user on 2026-11-28, following review
of `work/admin-interface-proposal/implementation-scope.md` and explicit approval
of all proposed defaults. This specification owns the new behavior; existing
V1–V17 lifecycle and Application chat authority remain unchanged.

## Goal and scope

Implement the selected JOBHUB Bàn điều hành, platform announcements, Admin
inbox, Company support chat, and point-in-time platform statistics. FE uses real
HTTP contracts, existing auth and Socket.IO. No mock production data.

## F01 — Platform announcements

ACTIVE Platform Admin publishes immutable plain-text title (1–160 chars) and
content (1–4000 chars), after preview/confirmation. Required clientRequestId
(1–80 ASCII letters/digits/hyphen/underscore) identifies a logical publish per
sender. Same key + payload retries return the same announcement; changed payload
returns 409. Audience is all ACTIVE Users at publish snapshot, except sender,
including other Admins. New/later-activated Users are excluded. Offline recipients
retain durable inbox items. Recipient eligibility changing later does not rewrite
that historical audience; normal auth still controls access.

The publish transaction fixes the audience in separate bounded-size records;
notification delivery is asynchronous and bounded, recoverable and deduplicated.
History shows totalRecipients, deliveredCount (durable inbox items, NOT read or
socket delivery), pending/complete progress, failedCount and lastError. Zero audience
completes immediately. No edit/delete/recall/scheduling, targeting, email/push/SMS.

## F02 — Admin notifications

Reuse own Notification list, unread-count, fetch/open and realtime. New types:
PLATFORM_ANNOUNCEMENT, COMPANY_SUBMITTED, SUPPORT_MESSAGE_CREATED. On Company
submit, snapshot currently ACTIVE Admin recipients; on Manager support message,
notify currently ACTIVE Admins. On Admin support message, notify current eligible
Manager. Human sender never self-notifies. Required source obligations are atomic
with source writes, recovery uses snapshots, readAt remains per User. No mark-all,
unread reset, per-module unread persistence, typing, receipts or presence.

## F03 — Company support

At most one SupportConversation per Company, independent of V11 Application
Conversation. All ACTIVE Admins share access. Only current ACTIVE Company Manager
with ACTIVE membership of APPROVED+ACTIVE Company has Company-side access; no
Recruiter/Candidate access. Either side can initiate by sending first text message
(1–4000 chars). Both sides have list/read/send UI, HTTP history pagination, realtime
and HTTP resynchronization on reconnect. Each message records actual User identity
and senderName/role snapshot. Idempotent send uses sender+Company+clientRequestId;
changed payload under an existing key returns 409.

Each read/send reevaluates current authorization. Admin can read retained history
after Company lock; no send after lock. Manager loses access with User/membership/
Company eligibility loss. Send serializes against User, membership and Company
lifecycle writes. No ticket assignment/SLA, attachments, edits/deletes, group chat,
Application chat access or changes to recruitment workflow.

## F04 — Platform statistics

ACTIVE Admin reads totals and independent status breakdowns of all persisted Users,
Companies (including drafts), Jobs and Applications at read time. User actorType
resolves COMPANY_STAFF via CompanyMember.role; missing membership is explicitly
UNRESOLVED, never guessed as Recruiter. Empty collections return zero totals and
zero-valued canonical status keys. Include generatedAt; independent aggregates are
not a transactional cross-collection snapshot. V2 review summary remains separate
and excludes drafts. No trend/date filters, export, revenue, ratios or realtime KPI.

## F05 — Frontend surfaces

Bàn điều hành uses navy sidebar and existing JOBHUB tokens/React components.
Admin routes include overview, Company registrations/list/snapshot decision,
Companies/current detail/Recruiters, Accounts/detail with independent membership
state, immutable FIELD/POSITION creation, announcements/compose/progress, own
notifications, shared Company support, statistics. Manager has Company support UI.
Existing V2 approve/reject/lock/account rules remain authoritative, including 503
approval email failure after a committed approval: reread before another action.
List filtering/sorting/paging uses server contracts, no client-side total guesses.
Loading/error/empty states, confirmations and duplicate-submit protection required.

## Business rules

BR-01: Authentication and current eligibility are server-owned on every protected read/write.
BR-02: Durable source/obligation writes are atomic; recipient+logical event unique.
BR-03: Realtime is post-commit best-effort; HTTP persisted state is authoritative.
BR-04: Admin support never grants access to Application Conversation/Message.
BR-05: Announcement audience and published content are immutable.
BR-06: Existing product/data meanings and account/membership separation are preserved.
