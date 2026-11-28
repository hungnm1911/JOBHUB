# V18 — Admin communication and statistics Data Contract

Status: APPROVED FOR IMPLEMENTATION; supports approved V18 Product Specification.

## Purpose and changes

New Announcement, AnnouncementRecipient, SupportConversation, SupportMessage.
Extend canonical Notification/NotificationEvent with type-specific announcementId,
companyId and supportMessageId. Existing types/reference invariants unchanged.
Statistics reads existing entities only; no aggregate-counter persistence.

## Entity relations and invariants

Announcement: authorUserId, clientRequestId, title, content, publishedAt,
totalRecipients, timestamps. Unique {authorUserId,clientRequestId}; immutable
published content/audience count. User audience is captured under a MongoDB snapshot
transaction; selected IDs streamed and inserted in chunks, not one unbounded array.

AnnouncementRecipient: announcementId, recipientUserId, deliveredAt nullable,
lastError nullable, attempts default 0, timestamps. Unique pair; index
{deliveredAt,updatedAt,_id}. Delivered only after canonical Notification materialized.
Failed delivery remains pending. Recovery retries bounded batches and deduplicates
through canonical eventKey and {eventId,recipientUserId}. Progress is derived from
recipient rows, not a second delivery counter. No recipient email/profile copies.

SupportConversation: companyId unique, lastMessageAt, timestamps. Company owns
support identity; no Application reference or participant-controlled tenant ID.
SupportMessage: conversationId, companyId, senderUserId, senderName, senderRole
(PLATFORM_ADMIN/COMPANY_MANAGER), clientRequestId, content, timestamps. Unique
{companyId,senderUserId,clientRequestId}; history index {companyId,createdAt,_id}.
No mutable read-receipt/unread-message counter. Notification read state is separate.

Notification and NotificationEvent new reference matrix:
- PLATFORM_ANNOUNCEMENT: announcementId required, all other resource refs null.
- COMPANY_SUBMITTED: companyId required, all other resource refs null.
- SUPPORT_MESSAGE_CREATED: companyId and supportMessageId required, other refs null.
New refs forbidden for all old types. Canonical eventId required for every inbox item.
New type recipient/content snapshots use existing NotificationEvent; broadcast
uses one bounded single-recipient event per AnnouncementRecipient.

Company submit adds submittedAdminRecipients (User IDs) captured atomically with
snapshot/submit transition; this outbox seed is immutable and internal, never in
public Company DTO. Recovery creates canonical per-recipient obligations from
this source seed and marks submittedAdminNotifiedAt after all durable events exist.
An empty seed also completes. Source Company is retained; no unbounded retries in HTTP.

## Transactions and concurrency

Announcement + all audience rows commit together, snapshot read concern; sender
ACTIVE Admin is reacquired inside transaction. Message, conversation lastMessageAt,
and NotificationEvent commit together. Send acquires current User, Company and
Manager membership by conditional writes; lifecycle actions conflict on same docs.
Idempotent replay is permitted only after current authorization, returns existing
logical result, rejects changed payload. Unique indexes arbitrate concurrent first
conversation creation and duplicate sends; retry duplicate races outside aborted
transaction. Realtime emits only after commit; restart recovery is safe.

## Index readiness and compatibility

Canonical startup initializes new indexes before workers. New fields default null
(or empty source recipients) so old records retain old meaning. Legacy pending
submissions are not retroactively broadcast; only the new submit seed is recovered.
No migration of Application chats or statistics counters. Required replica-set
transaction deployment is inherited from existing backend workflows.
