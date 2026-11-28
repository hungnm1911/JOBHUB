# V18 Admin / Company support HTTP contract

All endpoints prefix /api. Admin requires ACTIVE authenticated PLATFORM_ADMIN.
Company support requires ACTIVE current Company Manager and APPROVED+ACTIVE Company.
Errors use existing {error:{message,details}} transport: 400 malformed body/query,
401 session missing/invalid, 403 unauthorized, 404 unavailable entity, 409 state or
idempotency conflict. Body keys strict; extra keys rejected. Plain-text inputs are
trimmed and bounded per Product V18. IDs valid Mongo ObjectIds or 404.

All list queries: page default1, limit default20/max100, q optional trimmed <=200,
sort default-createdAt; unsupported/repeated keys return400. Stable _id tie-breaker.
Response pagination {page,limit,total,totalPages}; empty totalPages0, beyond-last200.

| Method/path | Input | Result |
| --- | --- | --- |
| GET /platform-admin/announcements | page,limit,q,sort(createdAt) | {announcements,pagination} |
| POST /platform-admin/announcements | {title,content,clientRequestId} | 202 {announcement} (also idempotent replay) |
| GET /platform-admin/announcements/:announcementId | no query | {announcement} |
| GET /platform-admin/support-conversations | page,limit,q(company name),sort(createdAt,lastMessageAt) | {conversations,pagination} |
| GET /platform-admin/companies/:companyId/support/messages | page,limit,q(content),sort(createdAt) | {company,conversation,messages,pagination} |
| POST /platform-admin/companies/:companyId/support/messages | {content,clientRequestId} | 200 {message,conversation} |
| GET /company/support/messages | same history query | {company,conversation,messages,pagination} |
| POST /company/support/messages | {content,clientRequestId} | 200 {message,conversation} |
| GET /platform-admin/statistics | no query | {statistics} |

Announcement DTO: id,title,content,authorUserId,publishedAt,createdAt,totalRecipients,
deliveredCount,failedCount,lastError,status(PENDING/COMPLETE). Progress means durable
inbox materialization only. Recipient internals never returned.
SupportConversation DTO: id,companyId,companyName,lastMessageAt,createdAt.
SupportMessage DTO: id,companyId,conversationId,senderUserId,senderName,senderRole,
content,createdAt. Raw clientRequestId not exposed. Missing conversation is null
with empty messages; reads do not create it.
Statistics: generatedAt, users:{total,byStatus,byActorType}, companies:{total,
byApprovalStatus,byOperationalStatus}, jobs:{total,byStatus}, applications:{total,byStatus}.

Own inbox uses existing /notifications endpoints, adding the three V18 types and
references. No new notification read state protocol. Existing `notification`
realtime payload unchanged. New `support:message` payload {companyId,message}
is emitted only to eligible server-selected recipients after commit. HTTP focus /
Socket connect resynchronization required; missed realtime does not mean lost data.

Existing Admin account/Company/Recruiter/category endpoints remain defined in
v1-v4-api-contract.md; V18 FE must consume those current shapes without mock data.
