# V15 — Job Invitation và nhánh Recruiter săn ứng viên Data Model

> **File:** `docs/data/versions/v15-job-invitation-recruiter-sourcing-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v15-job-invitation-recruiter-sourcing.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v15-job-invitation-recruiter-sourcing.md
```

Product Specification là authority đối với business behavior.

Tài liệu Data Model xác định:

* dữ liệu Job Invitation nào cần được persist;
* entity/collection nào chịu trách nhiệm lưu Invitation;
* relationship giữa Candidate, CandidateCV, Job, Recruiter, Invitation và Application;
* field và constraint cần thiết;
* index phục vụ uniqueness, ownership, lifecycle và invalidation;
* representation của Job Invitation state;
* persistence transition tương ứng với Send, Accept, Reject, Revoke, Expire và Invalidate;
* cách persist Application được tạo từ Recruiter Invitation;
* transaction / atomicity requirement;
* durable Notification obligation của V15;
* lifecycle của Invited CV Snapshot;
* multi-tenant ownership;
* boundary giữa constraint do schema/database bảo vệ và constraint do service bảo vệ;
* compatibility với V5–V14;
* các persistence artifact từ macro database/entity diagram không còn phù hợp và chủ động không được đưa vào V15.

Tài liệu này **không được thay đổi hoặc mở rộng business behavior** đã được định nghĩa trong Product Specification.

Transaction/atomicity trong Data Contract này mặc định chỉ áp dụng cho persisted state thuộc database của hệ thống.

Không suy diễn transaction requirement thành:

* distributed transaction với Socket.IO;
* distributed transaction với Cloudinary hoặc file storage khác;
* transaction với SMTP;
* exactly-once realtime delivery;
* exactly-once external side effect;

trừ khi Product/Data Contract yêu cầu rõ.

Nếu Data Model mâu thuẫn với Product Specification, phải báo conflict thay vì tự điều chỉnh business requirement.

---

## 2. Thay đổi so với version trước

V15 tiếp tục sử dụng persistence foundation của V5–V14 và bổ sung Job Invitation như một domain resource mới.

| Entity / Collection             | Trạng thái  | Mô tả                                                                                       |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `job_invitations`               | `NEW`       | Lưu Job Invitation lifecycle, sender attribution và Invited CV Snapshot                     |
| `applications`                  | `UPDATED`   | Bổ sung source `RECRUITER_INVITATION`, `sourceInvitationId` và source-dependent constraints |
| `notifications`                 | `UPDATED`   | Bổ sung Job Invitation Notification types và `jobInvitationId`                              |
| `notification_events`           | `UPDATED`   | Bổ sung durable Notification obligations cho Job Invitation events                          |
| `candidate_cvs`                 | `UNCHANGED` | Live Candidate CV dùng làm nguồn khi Recruiter gửi Invitation                               |
| `jobs`                          | `UNCHANGED` | Job context, Company tenant source và lifecycle authority                                   |
| `companies`                     | `UNCHANGED` | Company operational state và tenant owner                                                   |
| `company_members`               | `UNCHANGED` | Sender, current Primary và current Assigned Recruiter identity                              |
| `users`                         | `UNCHANGED` | Candidate và Recruiter account identity                                                     |
| `conversations`                 | `UNCHANGED` | Conversation tiếp tục thuộc Application; được tạo khi Accept                                |
| `candidate_availabilities`      | `UNCHANGED` | Accept không tạo Availability giả; absence tiếp tục biểu diễn NOT_SUBMITTED                 |
| `interview_schedules`           | `UNCHANGED` | V15 không thay đổi Interview Schedule persistence                                           |
| `messages`                      | `UNCHANGED` | Invitation greeting không phải Chat Message                                                 |
| `InvitedCvSnapshot_EMBEDDED`    | `NEW`       | Historical snapshot của exact CandidateCV tại Send                                          |
| `SubmittedCvSnapshot_EMBEDDED`  | `UNCHANGED` | Reuse canonical V9 shape cho Application                                                    |
| `CvSnapshotPdfFile_EMBEDDED`    | `UNCHANGED` | Reuse canonical snapshot PDF representation                                                 |
| `NotificationRecipientSnapshot` | `UNCHANGED` | Reuse V13 recipient/content snapshot                                                        |

### 2.1. Entity mới

* `JobInvitation`
* `InvitedCvSnapshot_EMBEDDED`

Không tạo collection riêng cho `InvitedCvSnapshot`.

### 2.2. Entity được mở rộng

* `Application`
* `Notification`
* `NotificationEvent`

### 2.3. Entity giữ nguyên nhưng được sử dụng

* `CandidateCV`
* `Job`
* `Company`
* `CompanyMember`
* `User`
* `Conversation`
* `CandidateAvailability`
* `InterviewSchedule`
* `Message`
* `SubmittedCvSnapshot_EMBEDDED`
* `CvSnapshotPdfFile_EMBEDDED`
* `NotificationRecipientSnapshot`

Không thay đổi schema của entity được đánh dấu `UNCHANGED` nếu không có requirement tương ứng.

---

## 3. Collection / Entity tổng thể

V15 sử dụng các entity/collection:

```text
job_invitations

applications

notifications
notification_events

candidate_cvs
jobs
companies
company_members
users

conversations
candidate_availabilities
interview_schedules
messages
```

Embedded documents:

```text
InvitedCvSnapshot_EMBEDDED
GeneratedCvContent_EMBEDDED
CvSnapshotPdfFile_EMBEDDED
SubmittedCvSnapshot_EMBEDDED
NotificationRecipientSnapshot
```

Vai trò tổng quát:

| Entity / Collection            | Responsibility                                         |
| ------------------------------ | ------------------------------------------------------ |
| `job_invitations`              | Lưu current/historical Job Invitation lifecycle        |
| `applications`                 | Lưu Application sau khi Candidate Accept Invitation    |
| `notifications`                | Durable user-facing inbox item                         |
| `notification_events`          | Durable obligation và recovery source cho Notification |
| `candidate_cvs`                | Live Candidate-owned CV source                         |
| `jobs`                         | Job context và nguồn xác định Company tenant           |
| `companies`                    | Company operational state                              |
| `company_members`              | Recruiter membership và historical sender reference    |
| `users`                        | Candidate/Recruiter account identity                   |
| `conversations`                | Conversation thuộc Application                         |
| `candidate_availabilities`     | Current Candidate Availability nếu đã submit           |
| `interview_schedules`          | Existing Interview Schedule lifecycle                  |
| `messages`                     | Existing V11 chat persistence                          |
| `InvitedCvSnapshot_EMBEDDED`   | Historical CV truth tại Send                           |
| `SubmittedCvSnapshot_EMBEDDED` | Historical/current submitted CV truth của Application  |

Không tạo thêm collection ngoài danh sách này nếu chưa có quyết định được phê duyệt.

Không tạo field/collection chỉ để "phòng sau này có thể cần".

---

## 4. Quan hệ dữ liệu

Persistence relationships chính:

```text
User(Candidate) 1 ───── N JobInvitation

CandidateCV 1 ───── N JobInvitation

Job 1 ───── N JobInvitation

CompanyMember 1 ───── N JobInvitation

JobInvitation 1 ───── 0..1 Application

Application 1 ───── 0..1 Conversation

JobInvitation 1 ───── N NotificationEvent

JobInvitation 1 ───── N Notification
```

### 4.1. Candidate → JobInvitation

**Cardinality**

```text
User(Candidate) 1 ───── N JobInvitation
```

**Owner**

`JobInvitation`

**Reference**

```text
JobInvitation.candidateUserId
```

**Constraint**

* required;
* referenced User phải là Candidate theo Product requirement;
* Candidate phải là owner của `invitedCvId`;
* Candidate identity không thay đổi sau Send.

**Lifecycle**

* User mutation không rewrite `invitedCvSnapshot`;
* Candidate lifecycle có thể làm `PENDING` Invitation bị invalidate theo Product;
* historical Candidate reference được giữ trên terminal Invitation.

---

### 4.2. CandidateCV → JobInvitation

**Cardinality**

```text
CandidateCV 1 ───── N JobInvitation
```

**Owner**

`JobInvitation`

**Reference**

```text
JobInvitation.invitedCvId
```

**Constraint**

* required;
* CandidateCV phải thuộc `candidateUserId`;
* CV phải thỏa Send eligibility tại successful Send;
* reference chỉ thể hiện provenance/live identity;
* historical Invitation CV content phải dùng `invitedCvSnapshot`.

**Lifecycle**

Sau Send:

```text
CandidateCV edit
CandidateCV rename
visibility change
Generated lifecycle change
```

không rewrite snapshot.

CandidateCV Archive có thể gây:

```text
PENDING
→ INVALIDATED
```

theo canonical V15.

---

### 4.3. Job → JobInvitation

**Cardinality**

```text
Job 1 ───── N JobInvitation
```

**Owner**

`JobInvitation`

**Reference**

```text
JobInvitation.jobId
```

**Constraint**

* required;
* Job phải thuộc same Company với sender tại Send;
* Job lifecycle eligibility được kiểm tra bởi service;
* Job là canonical source để resolve Company tenant.

**Lifecycle**

Job kết thúc accepting lifecycle có thể làm `PENDING` Invitation:

```text
→ EXPIRED
```

theo Product Specification.

Không tạo reverse array:

```text
Job.invitationIds[]
```

---

### 4.4. CompanyMember → JobInvitation

**Cardinality**

```text
CompanyMember 1 ───── N JobInvitation
```

**Owner**

`JobInvitation`

**Reference**

```text
JobInvitation.sentByRecruiterCompanyMemberId
```

**Constraint**

* required;
* sender phải là Recruiter đủ eligibility tại Send;
* sender phải thuộc Company của Job;
* sender phải là current Primary hoặc Supporting theo Product;
* reference này là historical attribution.

**Lifecycle**

Sau Send:

```text
sender team role thay đổi
sender bị remove khỏi team
sender lifecycle thay đổi
```

không rewrite historical sender.

Reference sender không tự cấp current authorization.

---

### 4.5. JobInvitation → Application

**Cardinality**

```text
JobInvitation 1 ───── 0..1 Application
```

**Owner**

`Application`

**Reference**

```text
Application.sourceInvitationId
```

**Constraint**

```text
Application.source = RECRUITER_INVITATION
→ sourceInvitationId required
```

```text
Application.source = DIRECT_APPLICATION
→ sourceInvitationId = null
```

Một JobInvitation chỉ tạo tối đa một Application.

**Lifecycle**

Successful Accept:

```text
JobInvitation PENDING
        ↓
ACCEPTED

Application absent
        ↓
Application created
```

Sau đó Application có lifecycle độc lập theo V10+.

Không tạo reverse field:

```text
JobInvitation.applicationId
```

---

### 4.6. Application → Conversation

**Cardinality**

```text
Application 1 ───── 0..1 Conversation
```

**Owner**

`Conversation`

**Reference**

```text
Conversation.applicationId
```

**Constraint**

* required trên Conversation;
* unique;
* một Application tối đa một Conversation.

**Lifecycle**

Successful Invitation Accept tạo Conversation cùng Application.

Reassign/Unassign không tạo Conversation mới.

---

### 4.7. JobInvitation → NotificationEvent

**Cardinality**

```text
JobInvitation 1 ───── N NotificationEvent
```

**Owner**

`NotificationEvent`

**Reference**

```text
NotificationEvent.jobInvitationId
```

**Constraint**

Required đối với canonical V15 Invitation Notification event types.

**Lifecycle**

NotificationEvent là historical durable obligation.

JobInvitation terminal transition sau đó không rewrite event đã tồn tại.

---

### 4.8. JobInvitation → Notification

**Cardinality**

```text
JobInvitation 1 ───── N Notification
```

**Owner**

`Notification`

**Reference**

```text
Notification.jobInvitationId
```

**Constraint**

Required đối với Job Invitation Notification types.

**Lifecycle**

Notification có read lifecycle riêng qua `readAt`.

Notification không sở hữu hoặc quyết định Invitation lifecycle.

---

## 5. `JobInvitation` / `job_invitations`

### 5.1. Responsibility

Entity này chịu trách nhiệm lưu:

* Candidate được mời;
* exact CandidateCV được chọn;
* Job được mời;
* Recruiter thực tế gửi Invitation;
* Invited CV Snapshot;
* optional greeting;
* current Invitation status;
* thời điểm Send;
* effective response cutoff;
* terminal timestamp tương ứng;
* invalidation reason nếu bị invalidated;
* document timestamps.

Entity này **không chịu trách nhiệm** lưu:

* live Candidate Profile;
* live CandidateCV content thay cho snapshot;
* Company duplicate;
* Job Description snapshot;
* current Primary duplicate;
* current Assigned Recruiter;
* Application Recruitment Pipeline;
* Application status history;
* assignment history;
* Chat;
* Message;
* Notification read state;
* sourcing KPI;
* generic audit event timeline.

Điều này giữ `JobInvitation` là owner của Invitation lifecycle thay vì trở thành nơi chứa toàn bộ downstream recruitment data.

---

### 5.2. Fields

| Field                            | Type                         | Required | Default         | Constraint                     | Ý nghĩa                       |
| -------------------------------- | ---------------------------- | -------: | --------------- | ------------------------------ | ----------------------------- |
| `_id`                            | `ObjectId`                   |      YES | generated       | unique                         | Định danh Invitation          |
| `candidateUserId`                | `ObjectId`                   |      YES | —               | ref `User`, immutable          | Candidate được mời            |
| `invitedCvId`                    | `ObjectId`                   |      YES | —               | ref `CandidateCV`, immutable   | Exact CV được Recruiter chọn  |
| `jobId`                          | `ObjectId`                   |      YES | —               | ref `Job`, immutable           | Job được mời                  |
| `sentByRecruiterCompanyMemberId` | `ObjectId`                   |      YES | —               | ref `CompanyMember`, immutable | Historical sender             |
| `invitedCvSnapshot`              | `InvitedCvSnapshot_EMBEDDED` |      YES | —               | immutable                      | CV historical truth tại Send  |
| `greetingMessage`                | `String`                     |       NO | `null`          | immutable sau Send             | Optional greeting             |
| `status`                         | `String enum`                |      YES | `PENDING`       | canonical lifecycle enum       | Current Invitation status     |
| `sentAt`                         | `Date`                       |      YES | Send time       | immutable                      | Business Send timestamp       |
| `expiresAt`                      | `Date`                       |      YES | derived at Send | không gia hạn                  | Effective response cutoff     |
| `acceptedAt`                     | `Date`                       |       NO | `null`          | required khi `ACCEPTED`        | Accept completion time        |
| `rejectedAt`                     | `Date`                       |       NO | `null`          | required khi `REJECTED`        | Reject completion time        |
| `revokedAt`                      | `Date`                       |       NO | `null`          | required khi `REVOKED`         | Revoke completion time        |
| `invalidatedAt`                  | `Date`                       |       NO | `null`          | required khi `INVALIDATED`     | Effective time của source cause |
| `invalidationReason`             | `String enum`                |       NO | `null`          | required khi `INVALIDATED`     | Historical invalidation cause |
| `createdAt`                      | `Date`                       |      YES | automatic       | —                              | Record creation time          |
| `updatedAt`                      | `Date`                       |      YES | automatic       | —                              | Record update time            |

`expiresAt` biểu diễn effective response cutoff.

`invalidatedAt` biểu diễn **effective business time của invalidating source
cause**, không phải thời điểm worker/service materialize
`JobInvitation.status = INVALIDATED`.

Ví dụ:

```text
sender bị remove khỏi Job team lúc 10:00
→ Invitation mất hiệu lực từ 10:00

JobInvitation được persist sang INVALIDATED lúc 10:10
→ invalidatedAt = 10:00
```

Semantic này giữ nguyên Product BR-34: business cause xảy ra trước quyết định
terminal outcome. Materialization muộn không làm dịch chuyển effective time
của invalidation.

Không dùng TTL để delete Invitation.

---

### 5.3. Enum

#### `status`

```text
PENDING
ACCEPTED
REJECTED
REVOKED
EXPIRED
INVALIDATED
```

| Giá trị       | Ý nghĩa                                                              |
| ------------- | -------------------------------------------------------------------- |
| `PENDING`     | Invitation còn chờ Candidate response                                |
| `ACCEPTED`    | Candidate đã Accept và downstream Application đã được tạo atomically |
| `REJECTED`    | Candidate từ chối                                                    |
| `REVOKED`     | Current Primary thực hiện Revoke hợp lệ                              |
| `EXPIRED`     | Invitation hết khả năng response do expiry/Job accepting lifecycle   |
| `INVALIDATED` | Invitation mất eligibility vì một invalidation cause thuộc Product   |

Không thêm state ngoài Product vocabulary.

#### `invalidationReason`

```text
CANDIDATE_NOT_ACTIVE
CANDIDATE_EMAIL_UNVERIFIED
INVITED_CV_ARCHIVED

COMPANY_NOT_OPERATIONAL

SENDER_NOT_ACTIVE
SENDER_COMPANY_MEMBERSHIP_INVALID
SENDER_REMOVED_FROM_JOB_TEAM
```

Các tên trên phản ánh business condition của Product, không giả định một
literal lifecycle state duy nhất. Đặc biệt, `COMPANY_NOT_OPERATIONAL` bao phủ
mọi trạng thái làm Company không còn operational theo canonical Company
lifecycle, bao gồm nhưng không giới hạn ở `LOCKED`; nó không bổ sung một
invalidation cause mới.

Không dùng generic:

```text
OTHER_ELIGIBILITY_FAILED
```

nếu Product Specification đã xác định exact business causes.

Không dùng Job accepting-lifecycle cause làm invalidation reason nếu canonical outcome của chúng là `EXPIRED`.

---

### 5.4. Indexes

| Index                                                           | Loại           | Mục đích                                                        |
| --------------------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| `{ candidateUserId: 1, jobId: 1 }` với partial `status=PENDING` | Unique Partial | Tối đa một PENDING Invitation trên Candidate–Job                |
| `{ candidateUserId: 1, jobId: 1, createdAt: -1 }`               | Compound       | Resend/history eligibility                                      |
| `{ candidateUserId: 1, createdAt: -1, _id: -1 }`                | Compound       | Candidate Invitation history                                    |
| `{ jobId: 1, createdAt: -1, _id: -1 }`                          | Compound       | Current Primary xem Invitation history của Job                  |
| `{ jobId: 1, status: 1 }`                                       | Compound       | Resolve affected PENDING Invitations khi Job lifecycle thay đổi |
| `{ candidateUserId: 1, status: 1 }`                             | Compound       | Candidate lifecycle invalidation                                |
| `{ sentByRecruiterCompanyMemberId: 1, status: 1 }`              | Compound       | Sender lifecycle/team invalidation                              |
| `{ invitedCvId: 1, status: 1 }`                                 | Compound       | CandidateCV Archive invalidation                                |
| `{ status: 1, expiresAt: 1 }`                                   | Compound       | Expiration scan/materialization                                 |

Không tạo TTL index cho `expiresAt`.

Invitation hết hạn phải được giữ làm historical record.

---

### 5.5. Embedded documents

`JobInvitation` sở hữu:

```text
invitedCvSnapshot {
  sourceCandidateCvId
  name
  sourceType
  generatedContent?
  pdfFile
  capturedAt
}
```

Document cha sở hữu embedded document:

```text
JobInvitation
```

Snapshot được tạo tại:

```text
successful Send
```

Snapshot:

* là deep historical representation của exact invited CandidateCV;
* immutable sau khi Invitation được tạo;
* không có lifecycle độc lập;
* không có collection riêng;
* không update khi live CandidateCV thay đổi.

Chi tiết snapshot được chuẩn hóa thêm tại Section 13.

---

### 5.6. Reference rules

| Field                            | Reference       | Required | Cardinality | Rule               |
| -------------------------------- | --------------- | -------: | ----------- | ------------------ |
| `candidateUserId`                | `User`          |      YES | N → 1       | Candidate owner    |
| `invitedCvId`                    | `CandidateCV`   |      YES | N → 1       | Exact invited CV   |
| `jobId`                          | `Job`           |      YES | N → 1       | Job/tenant context |
| `sentByRecruiterCompanyMemberId` | `CompanyMember` |      YES | N → 1       | Historical sender  |

Database chỉ bảo vệ structural validity của ObjectId/reference representation.

Service phải kiểm tra:

```text
CandidateCV.candidateUserId
=
JobInvitation.candidateUserId
```

và current eligibility/cross-document relationship tại business transition time.

---

## 6. Các entity được mở rộng

### 6.1. Responsibility

#### `Application`

V15 mở rộng `Application` để lưu:

* source `RECRUITER_INVITATION`;
* source Invitation reference;
* canonical initial Application state của Invitation branch;
* initial Assigned Recruiter;
* Submitted CV Snapshot được copy từ Invited CV Snapshot.

`Application` không chịu trách nhiệm lưu sender attribution duplicate.

Sender được resolve qua:

```text
Application.sourceInvitationId
        ↓
JobInvitation.sentByRecruiterCompanyMemberId
```

#### `Notification`

V15 mở rộng durable V13 Notification để hỗ trợ Job Invitation inbox items.

Notification tiếp tục chịu trách nhiệm lưu:

* recipient;
* historical actor;
* notification type;
* historical content;
* source references;
* read state.

Notification không chịu trách nhiệm lưu Invitation lifecycle.

#### `NotificationEvent`

V15 mở rộng V13 durable obligation để hỗ trợ Job Invitation logical events.

`NotificationEvent` vẫn là:

```text
durable obligation / recovery source
```

không phải Job Invitation audit log.

---

### 6.2. Fields

#### `Application`

V15 ảnh hưởng các field:

| Field                              | Type              |    Required | Default          | Constraint                     | Ý nghĩa                     |
| ---------------------------------- | ----------------- | ----------: | ---------------- | ------------------------------ | --------------------------- |
| `source`                           | `String enum`     |         YES | existing         | thêm `RECRUITER_INVITATION`    | Application creation source |
| `sourceInvitationId`               | `ObjectId`        | Conditional | `null`           | ref `JobInvitation`, immutable | Source Invitation           |
| `status`                           | existing enum     |         YES | source-dependent | source-specific creation state | Current Recruitment Status  |
| `assignedRecruiterCompanyMemberId` | `ObjectId` / null |    existing | source-dependent | ref `CompanyMember`            | Current Assignee            |
| `submittedCvSnapshot`              | embedded          |         YES | —                | existing V9 snapshot contract  | Submitted CV truth          |
| `appliedAt`                        | `Date` / null     | Conditional | source-dependent | Direct Apply only              | Direct Apply timestamp      |
| `withdrawnAt`                      | `Date` / null     |          NO | `null`           | Invitation source luôn null    | Withdraw timestamp          |
| `withdrawReason`                   | `String` / null   |          NO | `null`           | Invitation source luôn null    | Withdraw reason             |

V15 không thêm:

```text
sourceRecruiterCompanyMemberId
```

#### `Notification`

V15 thêm:

| Field             | Type       |    Required | Default | Constraint                     | Ý nghĩa                   |
| ----------------- | ---------- | ----------: | ------- | ------------------------------ | ------------------------- |
| `jobInvitationId` | `ObjectId` | Conditional | `null`  | ref `JobInvitation`, immutable | Invitation source context |

Existing `applicationId` trở thành conditional theo Notification type thay vì globally required cho mọi V15 type.

#### `NotificationEvent`

V15 thêm:

| Field             | Type       |    Required | Default | Constraint                     | Ý nghĩa                          |
| ----------------- | ---------- | ----------: | ------- | ------------------------------ | -------------------------------- |
| `jobInvitationId` | `ObjectId` | Conditional | `null`  | ref `JobInvitation`, immutable | Invitation logical-event context |

Existing `applicationId` tiếp tục required đối với Application-scoped types nhưng không required đối với pure Invitation events.

---

### 6.3. Enum

#### `Application.source`

```text
DIRECT_APPLICATION
RECRUITER_INVITATION
```

#### V15 `Notification.type` / `NotificationEvent.type`

Thêm:

```text
JOB_INVITATION_RECEIVED
JOB_INVITATION_ACCEPTED
JOB_INVITATION_REJECTED
JOB_INVITATION_REVOKED
JOB_INVITATION_INVALIDATED
INVITED_APPLICATION_CREATED
```

Không thêm:

```text
JOB_INVITATION_EXPIRED
```

Existing canonical V13 types tiếp tục giữ nguyên.

---

### 6.4. Indexes

#### `Application`

Giữ toàn bộ canonical indexes của V9/V10.

V15 bổ sung:

| Index                                         | Loại           | Mục đích                                     |
| --------------------------------------------- | -------------- | -------------------------------------------- |
| `{ sourceInvitationId: 1 }` khi field tồn tại | Unique Partial | Một JobInvitation tạo tối đa một Application |

Existing Candidate–Job unique constraint tiếp tục bảo vệ:

```text
Candidate + Job
→ tối đa một Application
```

#### `Notification`

Giữ canonical V13 indexes.

Không thêm index cho `jobInvitationId` chỉ vì field mới tồn tại nếu không có canonical query requirement riêng.

#### `NotificationEvent`

Giữ:

```text
{ eventKey: 1 } UNIQUE
```

và:

```text
{ materializedAt: 1, createdAt: 1 }
```

Không thêm retry/error indexes speculative.

---

### 6.5. Embedded documents

#### `Application`

Không thêm embedded document shape mới.

`submittedCvSnapshot` tiếp tục reuse exact V9 snapshot structure.

Tại Accept:

```text
Application.submittedCvSnapshot
=
deep copy JobInvitation.invitedCvSnapshot
```

#### `Notification`

Không thêm embedded document mới.

#### `NotificationEvent`

Tiếp tục reuse:

```text
NotificationRecipientSnapshot {
  recipientUserId
  content
}
```

Recipient/content được snapshot tại logical event time.

---

### 6.6. Reference rules

#### `Application`

| Field                              | Reference       |         Required | Cardinality | Rule                                               |
| ---------------------------------- | --------------- | ---------------: | ----------- | -------------------------------------------------- |
| `sourceInvitationId`               | `JobInvitation` |      Conditional | N → 0..1    | Required khi source là `RECRUITER_INVITATION`      |
| `assignedRecruiterCompanyMemberId` | `CompanyMember` | source-dependent | N → 0..1    | Initial sender tại Accept; mutable sau đó theo V10 |

Cross-document constraints:

```text
Application.candidateUserId
=
JobInvitation.candidateUserId
```

```text
Application.jobId
=
JobInvitation.jobId
```

#### `Notification`

| Field             | Reference       |    Required | Cardinality | Rule                                       |
| ----------------- | --------------- | ----------: | ----------- | ------------------------------------------ |
| `jobInvitationId` | `JobInvitation` | Conditional | N → 1       | Required cho Invitation Notification types |
| `applicationId`   | `Application`   | Conditional | N → 1       | Required cho Application-scoped types      |

#### `NotificationEvent`

| Field                          | Reference       |    Required | Cardinality | Rule                                        |
| ------------------------------ | --------------- | ----------: | ----------- | ------------------------------------------- |
| `jobInvitationId`              | `JobInvitation` | Conditional | N → 1       | Required cho Invitation event types         |
| `applicationId`                | `Application`   | Conditional | N → 1       | Required cho Application-scoped event types |
| `recipients[].recipientUserId` | `User`          |         YES | N → 1       | Historical recipient snapshot               |

---

# 7. State Matrix

## 7.1. JobInvitation status × terminal metadata

| `status`                                            | `acceptedAt` | `rejectedAt` | `revokedAt` | `invalidatedAt` | `invalidationReason` | Hợp lệ | Ý nghĩa                              |
| --------------------------------------------------- | ------------ | ------------ | ----------- | --------------- | -------------------- | ------ | ------------------------------------ |
| `PENDING`                                           | null         | null         | null        | null            | null                 | YES    | Đang chờ response                    |
| `ACCEPTED`                                          | Date         | null         | null        | null            | null                 | YES    | Accept hoàn tất                      |
| `REJECTED`                                          | null         | Date         | null        | null            | null                 | YES    | Candidate Reject                     |
| `REVOKED`                                           | null         | null         | Date        | null            | null                 | YES    | Current Primary Revoke               |
| `EXPIRED`                                           | null         | null         | null        | null            | null                 | YES    | Invitation hết hiệu lực              |
| `INVALIDATED`                                       | null         | null         | null        | Date            | value                | YES    | Eligibility bị mất                   |
| bất kỳ state terminal với nhiều terminal timestamps | mixed        | mixed        | mixed       | mixed           | mixed                | NO     | Không được có nhiều terminal outcome |

---

## 7.2. Invitation status × source Application

| Invitation status | Application sourced từ Invitation | Hợp lệ | Ý nghĩa                          |
| ----------------- | --------------------------------- | ------ | -------------------------------- |
| `PENDING`         | absent                            | YES    | Chưa Accept                      |
| `REJECTED`        | absent                            | YES    | Reject không tạo Application     |
| `REVOKED`         | absent                            | YES    | Revoke không tạo Application     |
| `EXPIRED`         | absent                            | YES    | Expire không tạo Application     |
| `INVALIDATED`     | absent                            | YES    | Invalidate không tạo Application |
| `ACCEPTED`        | exactly one                       | YES    | Accept đã hoàn tất               |
| `ACCEPTED`        | absent                            | NO     | Partial persisted state          |
| non-`ACCEPTED`    | present từ chính Invitation       | NO     | Application không được tồn tại   |

Cross-document matrix này được bảo vệ bằng service + transaction + uniqueness.

---

## 7.3. Application source matrix

| `source`               | `sourceInvitationId` | `appliedAt` | Initial `status` | Initial Assignee             | Hợp lệ |
| ---------------------- | -------------------- | ----------- | ---------------- | ---------------------------- | ------ |
| `DIRECT_APPLICATION`   | null                 | Date        | `APPLIED`        | canonical direct-apply state | YES    |
| `RECRUITER_INVITATION` | required             | null        | `CONTACTED`      | sender                       | YES    |
| `RECRUITER_INVITATION` | required             | null        | `APPLIED`        | bất kỳ                       | NO     |
| `RECRUITER_INVITATION` | required             | null        | `SCREENING`      | bất kỳ                       | NO     |
| `RECRUITER_INVITATION` | required             | null        | `WITHDRAWN`      | bất kỳ                       | NO     |

Sau creation, current Assignee tiếp tục tuân theo V10 assignment lifecycle.

---

## 7.4. Snapshot source matrix

| `sourceType` | `generatedContent` | `pdfFile` | Hợp lệ |
| ------------ | ------------------ | --------- | ------ |
| `GENERATED`  | present            | present   | YES    |
| `GENERATED`  | absent             | present   | NO     |
| `GENERATED`  | bất kỳ             | absent    | NO     |
| `UPLOADED`   | absent             | present   | YES    |
| `UPLOADED`   | present            | present   | NO     |
| `UPLOADED`   | bất kỳ             | absent    | NO     |

---

## 7.5. Notification reference matrix

| Type                               | `jobInvitationId` | `applicationId` | Hợp lệ |
| ---------------------------------- | ----------------- | --------------- | ------ |
| `JOB_INVITATION_RECEIVED`          | required          | null            | YES    |
| `JOB_INVITATION_ACCEPTED`          | required          | null            | YES    |
| `JOB_INVITATION_REJECTED`          | required          | null            | YES    |
| `JOB_INVITATION_REVOKED`           | required          | null            | YES    |
| `JOB_INVITATION_INVALIDATED`       | required          | null            | YES    |
| `INVITED_APPLICATION_CREATED`      | required          | required        | YES    |
| `INTERVIEW_AVAILABILITY_REQUESTED` | null              | required        | YES    |

Các V13 type khác tiếp tục dùng canonical V13 reference matrix.

---

# 8. Persistence Transitions

## 8.1. Send Job Invitation

### Trigger business

Successful Recruiter Send Invitation.

### Trước

```text
Candidate tồn tại

CandidateCV tồn tại
và current Send eligibility hợp lệ

Job tồn tại
và current Send eligibility hợp lệ

Application(candidate, job) absent

PENDING Invitation(candidate, job) absent

REJECTED history không chặn Send
```

### Sau

```text
JobInvitation
status = PENDING

candidateUserId = Candidate
invitedCvId = selected CandidateCV
jobId = selected Job

sentByRecruiterCompanyMemberId = sender

invitedCvSnapshot = captured exact CV snapshot

sentAt = now
expiresAt = effective response cutoff
```

Required durable event:

```text
NotificationEvent
type = JOB_INVITATION_RECEIVED
jobInvitationId = Invitation
recipient = Candidate
```

### Các entity bị thay đổi

* `JobInvitation`
* `NotificationEvent`

### Các entity không thay đổi

* `CandidateCV`
* `Job`
* `Company`
* `CompanyMember`
* `Application`

### Invariant cần giữ

* exact invited CV snapshot phải tồn tại;
* one-PENDING Candidate–Job uniqueness;
* source business success phải có durable Notification obligation.

---

## 8.2. Candidate Accept Invitation

### Trigger business

Candidate Accept successful.

### Trước

```text
JobInvitation.status = PENDING

Application(candidate, job) absent

Invitation vẫn actionable
theo current authoritative state
```

### Sau

```text
JobInvitation
status = ACCEPTED
acceptedAt = now
```

```text
Application
source = RECRUITER_INVITATION
sourceInvitationId = JobInvitation.id

candidateUserId = JobInvitation.candidateUserId
jobId = JobInvitation.jobId

status = CONTACTED

assignedRecruiterCompanyMemberId
= JobInvitation.sentByRecruiterCompanyMemberId

submittedCvSnapshot
= deep copy JobInvitation.invitedCvSnapshot

appliedAt = null
withdrawnAt = null
withdrawReason = null
```

```text
Conversation
applicationId = new Application.id
```

Không tạo CandidateAvailability document.

Required durable events:

```text
JOB_INVITATION_ACCEPTED
INVITED_APPLICATION_CREATED
INTERVIEW_AVAILABILITY_REQUESTED
```

### Các entity bị thay đổi

* `JobInvitation`
* `Application`
* `Conversation`
* `NotificationEvent`

### Các entity không thay đổi

* `CandidateCV`
* `CandidateAvailability`
* `Job`
* Recruitment Team

### Invariant cần giữ

* Accept và Application creation là một atomic database outcome;
* exactly one Application;
* submitted snapshot phải bằng invited snapshot;
* initial Assignee phải là sender;
* Application create trực tiếp ở `CONTACTED`;
* Conversation phải tồn tại sau commit;
* required durable Notification obligations phải tồn tại.

---

## 8.3. Candidate Reject Invitation

### Trigger business

Candidate Reject successful.

### Trước

```text
JobInvitation.status = PENDING
```

### Sau

```text
JobInvitation.status = REJECTED
rejectedAt = now
```

```text
NotificationEvent
type = JOB_INVITATION_REJECTED
recipient = sender
```

### Các entity bị thay đổi

* `JobInvitation`
* `NotificationEvent`

### Invariant cần giữ

* không tạo Application;
* không tạo Conversation;
* terminal transition chỉ thắng một lần.

---

## 8.4. Current Primary Revoke Invitation

### Trigger business

Current Primary thực hiện Revoke hợp lệ.

### Trước

```text
JobInvitation.status = PENDING
```

### Sau

```text
JobInvitation.status = REVOKED
revokedAt = now
```

```text
NotificationEvent
type = JOB_INVITATION_REVOKED
recipient = Candidate
```

### Các entity bị thay đổi

* `JobInvitation`
* `NotificationEvent`

### Invariant cần giữ

* historical sender không thay đổi;
* Revoke actor không trở thành sender;
* không tạo Application.

---

## 8.5. Expire Invitation

### Trigger business

Canonical Invitation expiration condition.

### Trước

```text
JobInvitation.status = PENDING
```

### Sau

```text
JobInvitation.status = EXPIRED
```

Nếu Product requirement làm effective response cutoff sớm hơn current `expiresAt`, persistence được phép phản ánh effective cutoff theo canonical rule.

### Các entity bị thay đổi

* `JobInvitation`

### Các entity không thay đổi

* `NotificationEvent`
* `Notification`
* `Application`

### Invariant cần giữ

Không tạo:

```text
JOB_INVITATION_EXPIRED
```

Notification event.

---

## 8.6. Invalidate Invitation

### Trigger business

Một canonical invalidation condition trở thành true.

### Trước

```text
JobInvitation.status = PENDING
```

### Sau

```text
JobInvitation.status = INVALIDATED

invalidatedAt = effective business time of invalidating source cause
invalidationReason = canonical reason
```

```text
NotificationEvent
type = JOB_INVITATION_INVALIDATED

recipients:
- Candidate
- historical sender
```

### Các entity bị thay đổi

* `JobInvitation`
* `NotificationEvent`

### Invariant cần giữ

* snapshot không bị xóa;
* invalidation reason phải phản ánh exact Product cause;
* `invalidatedAt` phải giữ effective time của source cause kể cả khi terminal
  materialization xảy ra sau;
* source lifecycle authority không được suy ra từ stale Invitation status.

---

## 8.7. Reassign / Unassign Application sau Accept

### Trigger business

Canonical V10 assignment transition.

### Trước

```text
Application.source = RECRUITER_INVITATION
assignedRecruiterCompanyMemberId = A
```

### Sau

Có thể:

```text
assignedRecruiterCompanyMemberId = B
```

hoặc:

```text
assignedRecruiterCompanyMemberId = null
```

theo V10.

### Các entity bị thay đổi

* `Application`
* các existing V10/V11/V13 consequences nếu transition đó yêu cầu.

### Các entity không thay đổi

* `JobInvitation.sentByRecruiterCompanyMemberId`
* `Application.sourceInvitationId`
* `JobInvitation.invitedCvSnapshot`
* `Application.submittedCvSnapshot`

### Invariant cần giữ

Historical sourcing attribution và current assignment là hai khái niệm độc lập.

---

# 9. Transaction / Atomicity Requirements

Chỉ workflow cần bảo vệ cross-document invariant hoặc không được phép xuất hiện partial persisted state mới cần transaction.

Không dùng transaction mặc định cho mọi operation.

Transaction/atomicity trong section này chỉ áp dụng cho persisted state thuộc database của hệ thống.

---

## TX-01 — Send Invitation + durable Notification obligation

**Business source**

Successful Send Job Invitation.

Trong cùng transaction:

1. tạo `JobInvitation`;
2. tạo required `JOB_INVITATION_RECEIVED NotificationEvent`.

Sau khi commit phải đảm bảo:

```text
JobInvitation.status = PENDING

và

durable JOB_INVITATION_RECEIVED obligation tồn tại
```

Không được xuất hiện partial state:

```text
Invitation đã được tạo thành công

nhưng

không có persisted recovery source
cho required Notification
```

Nếu một bước bắt buộc thất bại:

```text
rollback toàn bộ transition
```

`Notification` inbox document không bắt buộc materialize trong TX-01.

---

## TX-02 — Accept Invitation

**Business source**

Successful Candidate Accept.

Trong cùng transaction:

1. conditional transition `PENDING → ACCEPTED`;
2. persist `acceptedAt`;
3. tạo `Application`;
4. persist `sourceInvitationId`;
5. persist `status = CONTACTED`;
6. persist initial Assigned Recruiter = sender;
7. copy invited snapshot → submitted snapshot;
8. tạo `Conversation`;
9. tạo `JOB_INVITATION_ACCEPTED NotificationEvent`;
10. tạo `INVITED_APPLICATION_CREATED NotificationEvent`;
11. tạo `INTERVIEW_AVAILABILITY_REQUESTED NotificationEvent`.

Sau khi commit phải đảm bảo:

```text
JobInvitation = ACCEPTED
```

và:

```text
exactly one Application
cho Candidate–Job
```

và:

```text
Application.sourceInvitationId
=
JobInvitation.id
```

và:

```text
Application.status = CONTACTED
```

và:

```text
Application.assignedRecruiterCompanyMemberId
=
JobInvitation.sentByRecruiterCompanyMemberId
```

và:

```text
Conversation.applicationId
=
Application.id
```

và mọi required durable Notification obligations đã tồn tại.

Không được xuất hiện partial state:

```text
Invitation = ACCEPTED
nhưng
Application absent
```

hoặc:

```text
Application tồn tại
nhưng
Invitation vẫn PENDING
```

hoặc:

```text
Application tồn tại
nhưng
Conversation absent
```

hoặc:

```text
Application.submittedCvSnapshot
không phản ánh invitedCvSnapshot
```

Nếu bất kỳ bước bắt buộc nào thất bại:

```text
rollback toàn bộ transition
```

Không yêu cầu durable inbox `Notification` materialize trong transaction này.

---

## TX-03 — Reject Invitation

Trong cùng transaction:

1. conditional `PENDING → REJECTED`;
2. persist `rejectedAt`;
3. tạo `JOB_INVITATION_REJECTED NotificationEvent`.

Không được xuất hiện:

```text
Invitation = REJECTED
nhưng
required durable Notification obligation absent
```

---

## TX-04 — Revoke Invitation

Trong cùng transaction:

1. conditional `PENDING → REVOKED`;
2. persist `revokedAt`;
3. tạo `JOB_INVITATION_REVOKED NotificationEvent`.

---

## TX-05 — Persist Invitation Invalidation

Trong cùng transaction khi một individual Invitation được materialize sang terminal invalid state:

1. conditional `PENDING → INVALIDATED`;
2. persist `invalidatedAt` bằng effective business time của invalidating source
   cause;
3. persist exact `invalidationReason`;
4. tạo `JOB_INVITATION_INVALIDATED NotificationEvent`.

Không dùng thời điểm TX-05/worker chạy làm `invalidatedAt` nếu source cause đã
xảy ra trước đó.

Không được có:

```text
status = INVALIDATED
nhưng
invalidationReason = null
```

---

## 9.1. Source lifecycle transition không mặc định transaction với toàn bộ affected Invitations

Các source lifecycle mutation như:

* Candidate lifecycle;
* Company lifecycle;
* sender lifecycle;
* Recruitment Team mutation;
* CandidateCV Archive;
* Job lifecycle;

tiếp tục dùng transaction/atomicity contract của source module.

V15 không mặc định yêu cầu:

```text
source mutation
+
mọi affected JobInvitation
+
mọi NotificationEvent
```

phải nằm trong một global transaction.

Current authoritative state phải được re-check tại action time.

Persisted stale `PENDING` Invitation không tạo quyền Accept/Reject/Revoke trái current authoritative state.

Affected Invitation terminal materialization được xử lý theo contract V15 nhưng không nâng source operation thành distributed/global transaction nếu Product không yêu cầu.

---

## 9.2. Notification materialization

Giữ canonical V13:

```text
source state
+
NotificationEvent
        ↓
commit
        ↓
Notification inbox materialization
có thể xảy ra sau
```

Temporary Notification materialization failure không rollback source business state.

Realtime emit nằm ngoài database transaction.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema chỉ bảo vệ những constraint nó có đủ local persistence context để xác định.

| Constraint                                    | Owner             | Lý do                          |
| --------------------------------------------- | ----------------- | ------------------------------ |
| JobInvitation required fields                 | Schema/database   | Local document structure       |
| `status` thuộc canonical enum                 | Schema            | Local enum                     |
| `invalidationReason` thuộc enum               | Schema            | Local enum                     |
| status/terminal timestamp matrix              | Schema/database   | Các field nằm cùng document    |
| snapshot source matrix                        | Schema            | Local embedded structure       |
| Invitation identity fields immutable          | Schema            | Local lifecycle                |
| Candidate–Job tối đa một `PENDING` Invitation | Database          | Partial unique index           |
| Candidate–Job tối đa một Application          | Existing Database | Existing unique index          |
| `sourceInvitationId` unique khi tồn tại       | Database          | Partial unique index           |
| `Application.source` thuộc enum               | Schema            | Local enum                     |
| local source/nullability matrix               | Schema/database   | Cùng Application document      |
| `Conversation.applicationId` unique           | Database          | Existing unique index          |
| Job Invitation Notification type enum         | Schema            | Local enum                     |
| local Notification reference matrix           | Schema            | Type + refs cùng document      |
| `NotificationEvent.eventKey` unique           | Database          | Unique index                   |
| `(eventId, recipientUserId)` unique           | Database          | Durable dedupe                 |
| `readAt` structural lifecycle                 | Schema            | Local field                    |
| `materializedAt` structural state             | Schema/service    | Local field + completion logic |

---

## 10.2. Service bảo vệ

Service chịu trách nhiệm đối với business/cross-document constraint.

| Constraint                                                  | Owner        | Lý do                          |
| ----------------------------------------------------------- | ------------ | ------------------------------ |
| User được mời phải là Candidate hợp lệ                      | Service      | Cần User business state        |
| CandidateCV phải thuộc Candidate                            | Service      | Cross-document                 |
| CandidateCV phải thỏa current Send eligibility              | Service      | Cross-document + lifecycle     |
| Sender phải là Recruiter hợp lệ                             | Service      | User + CompanyMember context   |
| Sender phải cùng Company với Job                            | Service      | Cross-document tenant rule     |
| Sender phải là current Primary/Supporting                   | Service      | Current Recruitment Team state |
| Job phải đang cho phép Send                                 | Service      | Job lifecycle                  |
| Company phải operational                                    | Service      | Cross-document                 |
| Candidate phải ACTIVE/email verified khi Product yêu cầu    | Service      | User lifecycle                 |
| Historical REJECTED Invitation có chặn resend hay không     | Service      | Business history rule          |
| Existing Application chặn Send                              | Service + DB | Business rule + uniqueness     |
| Exact invalidation cause                                    | Service      | Business semantics             |
| Candidate ownership của Accept/Reject                       | Service      | Authorization                  |
| Current Primary authority của Revoke                        | Service      | Current role                   |
| Snapshot capture đúng source                                | Service      | Cross-document copy            |
| Application Candidate/Job khớp Invitation                   | Service + TX | Cross-document                 |
| Initial assignee = sender                                   | Service + TX | Cross-document business rule   |
| Current state được re-check dù Invitation vẫn stale PENDING | Service      | Authoritative state rule       |
| Recipient resolution                                        | Service      | Business recipient semantics   |
| Tenant isolation                                            | Service      | Cross-document authorization   |

Không ép database/schema bảo vệ invariant mà persistence layer không có đủ context để xác định.

---

# 11. Token / TTL Lifecycle

> V15 không bổ sung token/TTL persistence mới.

`JobInvitation.expiresAt` không phải TTL cleanup artifact.

Không dùng:

```text
TTL delete
```

để xóa terminal Invitation.

Invitation phải được giữ như historical business data.

---

# 12. Multi-tenant Data Boundary

### Canonical tenant key

V15 không thêm:

```text
JobInvitation.companyId
```

Canonical tenant được resolve bằng:

```text
JobInvitation.jobId
        ↓
Job.companyId
        ↓
Company
```

### Resource ownership

| Resource            | Tenant owner            | Cách xác định                                       |
| ------------------- | ----------------------- | --------------------------------------------------- |
| `JobInvitation`     | `Company`               | `jobId → Job.companyId`                             |
| `Application`       | `Company`               | `jobId → Job.companyId`                             |
| `Conversation`      | `Company`               | `applicationId → Application.jobId → Job.companyId` |
| `CandidateCV`       | Candidate-owned         | `candidateUserId`                                   |
| `Notification`      | Recipient User          | `recipientUserId`                                   |
| `NotificationEvent` | Internal source context | source references + recipient snapshots             |

CandidateCV không trở thành Company-owned chỉ vì nó được snapshot vào JobInvitation.

### Backend tenant resolution

```text
Authenticated User
        ↓
trusted User / CompanyMember relationship
        ↓
Job
        ↓
Job.companyId
        ↓
Company / Tenant
        ↓
scoped JobInvitation/Application operation
```

Backend phải bảo đảm:

* sender CompanyMember thuộc Company của Job;
* cross-company JobInvitation mutation bị chặn;
* Application source Invitation thuộc cùng Job/Candidate;
* `sourceInvitationId` không được dùng để bypass tenant check;
* Candidate chỉ thao tác Invitation thuộc chính mình;
* current Primary chỉ quản lý Invitation thuộc Job mà mình hiện quản lý.

Client-supplied:

```text
companyId
candidateUserId
jobId
invitedCvId
sourceInvitationId
```

không tự tạo authorization.

---

# 13. Snapshot / Historical Data

## 13.1. Invited CV Snapshot

Snapshot được tạo khi:

```text
successful Send Job Invitation
```

Snapshot chứa:

| Field                 | Source                                | Ý nghĩa                                            |
| --------------------- | ------------------------------------- | -------------------------------------------------- |
| `sourceCandidateCvId` | `CandidateCV._id`                     | Provenance của exact CV                            |
| `name`                | `CandidateCV.name`                    | Tên CV tại Send                                    |
| `sourceType`          | `CandidateCV.sourceType`              | GENERATED / UPLOADED                               |
| `generatedContent`    | Generated CV content                  | Structured historical content nếu source GENERATED |
| `pdfFile`             | canonical snapshot PDF representation | Historical PDF                                     |
| `capturedAt`          | Send capture time                     | Thời điểm snapshot                                 |

Lifecycle:

* được tạo đúng một lần tại successful Send;
* thuộc `JobInvitation`;
* không tồn tại độc lập;
* immutable sau creation;
* không update khi CandidateCV thay đổi;
* được giữ cùng historical Invitation;
* V15 không tạo snapshot version history.

Nguyên tắc:

```text
InvitedCvSnapshot
!=
live CandidateCV
```

---

## 13.2. Submitted CV Snapshot từ Invitation

Tại successful Accept:

```text
Application.submittedCvSnapshot
=
deep copy JobInvitation.invitedCvSnapshot
```

Không recapture live CandidateCV.

Ví dụ:

```text
T1:
Recruiter Send bằng CandidateCV V1

T2:
Candidate chỉnh CandidateCV thành V2

T3:
Candidate Accept

Application.submittedCvSnapshot
=
V1
```

không phải V2.

Snapshot Application tiếp tục tuân theo canonical V9 snapshot contract.

---

## 13.3. Historical sender

Historical sourcing attribution:

```text
JobInvitation.sentByRecruiterCompanyMemberId
```

Field này không thay khi:

* sender không còn current team member;
* Primary thay đổi;
* Application Reassign;
* Application Unassign;
* CompanyMember lifecycle thay đổi sau event.

Nguyên tắc:

```text
historical sender attribution
!=
current Application responsibility
```

---

# 14. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V15:

### Collection

```text
ApplicationStatusHistory
AssignmentHistory
JobInvitationEvent
JobInvitationAudit
JobInvitationHistory

SourcingMetric
SourcingStatistic
SourcingLeaderboard

NotificationDelivery
RealtimeEvent
```

### `JobInvitation` fields

```text
applicationId

events[]

jobDescriptionSnapshot

rejectReason

companyId

currentPrimaryRecruiterCompanyMemberId

currentAssignedRecruiterCompanyMemberId

isActive
isExpired
canAccept
canReject
canRevoke

deliveryStatus
socketEventId
```

### `Application` fields

```text
sourceRecruiterCompanyMemberId

invitedCvId

invitationSenderUserId
invitationSenderCompanyMemberId

invitationAcceptedAt

statusHistory[]
assignmentHistory[]
```

Sender attribution được resolve qua:

```text
Application.sourceInvitationId
→ JobInvitation.sentByRecruiterCompanyMemberId
```

### `Job` fields

```text
hasInvitation
invitationIds[]
canInvite
hasApplication
canDelete
```

### `CandidateCV` fields

Không thêm chỉ vì V15:

```text
companyId
invitationIds[]
isInvitable
isSearchEligible
```

V15 không tạo CandidateCV soft-delete lifecycle mới.

Nếu raw diagram chứa `deletedAt`, field đó không được dùng để tự tạo V15 business behavior.

### Notification persistence

Không thêm:

```text
Notification.isRead

deliveryStatus
deliveredAt

socketId
roomId

currentInvitationStatus
```

Không thêm type:

```text
JOB_INVITATION_EXPIRED
```

Mỗi field, collection, index hoặc persistence abstraction chưa có business requirement không được thêm chỉ để "phòng sau này cần".

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

### V5 Job

* canonical Job lifecycle tiếp tục là authority;
* V15 không thêm Job snapshot nếu Product không yêu cầu;
* Job historical retention không bị phá.

### V7 CandidateCV

* CandidateCV tiếp tục Candidate-owned;
* `GENERATED` và `UPLOADED` tiếp tục cùng CandidateCV entity;
* V15 không tạo Hard Delete lifecycle mới;
* Archive/current eligibility tiếp tục theo canonical CV contract.

### V9 Application

* Candidate–Job uniqueness tiếp tục giữ;
* Submitted CV Snapshot shape tiếp tục giữ;
* snapshot không được thay bằng live CandidateCV reference.

### V10 Assignment/Pipeline

* current Assignee tiếp tục là `assignedRecruiterCompanyMemberId`;
* Reassign/Unassign không rewrite source hoặc snapshot;
* current responsibility và historical Invitation sender là hai dimension khác nhau.

### V11 Conversation

* Conversation tiếp tục thuộc Application;
* one Conversation per Application;
* V15 không tạo pre-Accept Conversation.

### V12 Availability

* absence của CandidateAvailability tiếp tục biểu diễn `NOT_SUBMITTED`;
* Accept không tạo Availability giả.

### V13 Notification

* durable `NotificationEvent`;
* recipient snapshot;
* content snapshot;
* eventKey;
* eventual materialization;
* dedupe;
* readAt;
* realtime outside database transaction;

tiếp tục được giữ.

### V14 Candidate Search

* V15 không persist Candidate Search session/result/view history;
* current Search/Preview eligibility không được duplicate vào Invitation flags.

---

## 15.2. Persistence behavior phải giữ

* live CandidateCV mutation không rewrite existing historical snapshot;
* Application source/identity không bị Reassign thay đổi;
* existing V10 assignment transitions vẫn áp dụng sau Accept;
* Notification history không cấp current authorization;
* realtime failure không rollback durable business data;
* JobInvitation expiration không delete historical record.

---

## 15.3. Thay đổi được phép

V15 được phép:

* tạo collection `job_invitations`;
* thêm `RECRUITER_INVITATION` vào Application source;
* thêm `sourceInvitationId`;
* cho source Invitation có canonical creation state `CONTACTED`;
* tạo initial Assignee = Invitation sender;
* tạo Conversation trong Accept transaction;
* mở rộng Notification / NotificationEvent bằng Invitation types;
* thêm `jobInvitationId`;
* tạo Invited CV Snapshot.

---

## 15.4. Thay đổi không được phép

V15 không được âm thầm:

* tạo Application nguồn Invitation ở `SCREENING`;
* tạo fake `APPLIED → SCREENING`;
* thêm Application status history chỉ để support Accept;
* thêm AssignmentHistory chỉ để support Accept;
* thêm `sourceRecruiterCompanyMemberId`;
* biến sender thành permanent Application authorization actor;
* tạo CandidateAvailability giả;
* tạo pre-Accept Conversation;
* dùng live CandidateCV thay snapshot;
* tạo JobInvitation audit/event timeline;
* thêm Job snapshot nếu Product không yêu cầu;
* dùng stale `PENDING` làm authority thay current business state;
* đưa Notification inbox materialization vào source strong transaction;
* tạo distributed transaction với external services.

Version hiện tại không được reinterpret dữ liệu hoặc lifecycle của version trước nếu Product Specification không cho phép.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở persisted state:

1. Mỗi JobInvitation thuộc đúng một Candidate.
2. Mỗi JobInvitation tham chiếu đúng một invited CandidateCV.
3. `invitedCvId` phải thuộc `candidateUserId` tại successful Send.
4. Mỗi JobInvitation thuộc đúng một Job.
5. Sender identity bất biến sau Send.
6. JobInvitation tenant được derive từ Job.
7. CandidateCV không trở thành Company-owned vì Invitation.
8. `invitedCvSnapshot` bắt buộc tồn tại.
9. Invited CV Snapshot immutable sau Send.
10. Snapshot source matrix phải hợp lệ.
11. Snapshot PDF phải giữ historical independence khỏi live CandidateCV.
12. `JobInvitation.status` chỉ thuộc sáu canonical states.
13. Một JobInvitation chỉ có tối đa một terminal outcome.
14. `ACCEPTED` bắt buộc có `acceptedAt`.
15. `REJECTED` bắt buộc có `rejectedAt`.
16. `REVOKED` bắt buộc có `revokedAt`.
17. `INVALIDATED` bắt buộc có `invalidatedAt` bằng effective business time của invalidating source cause.
18. `INVALIDATED` bắt buộc có `invalidationReason`.
19. Non-`INVALIDATED` không được có invalidation reason.
20. Candidate–Job có tối đa một `PENDING` Invitation.
21. Candidate–Job có tối đa một Application.
22. Một JobInvitation tạo tối đa một Application.
23. `DIRECT_APPLICATION` không có `sourceInvitationId`.
24. `RECRUITER_INVITATION` bắt buộc có `sourceInvitationId`.
25. Application nguồn Invitation không được create ở `APPLIED`.
26. Application nguồn Invitation không được create ở `SCREENING`.
27. Application nguồn Invitation không được `WITHDRAWN`.
28. Application nguồn Invitation được create trực tiếp ở `CONTACTED`.
29. Initial Assignee của Invitation Application là Invitation sender.
30. Current Assignee sau creation tiếp tục theo V10.
31. Historical sender không thay khi current Assignee thay.
32. Application submitted snapshot tại Accept bằng deep copy invited snapshot.
33. Application nguồn Invitation không persist fake Direct Apply timestamp.
34. Application nguồn Invitation không persist Withdraw fields.
35. `ACCEPTED` Invitation phải có đúng một source Application sau TX-02 commit.
36. Non-`ACCEPTED` Invitation không được có Application sourced từ chính Invitation.
37. Successful Accept phải có Conversation.
38. Accept không tạo CandidateAvailability giả.
39. Accept phải có mọi required durable NotificationEvent obligations.
40. Accept không tạo synthetic `APPLICATION_ASSIGNED`.
41. Accept không tạo synthetic `APPLICATION_STATUS_CHANGED`.
42. Send phải có `JOB_INVITATION_RECEIVED` durable obligation.
43. Reject phải có `JOB_INVITATION_REJECTED` durable obligation.
44. Revoke phải có `JOB_INVITATION_REVOKED` durable obligation.
45. Invalidate phải có `JOB_INVITATION_INVALIDATED` durable obligation.
46. Expire không tạo `JOB_INVITATION_EXPIRED`.
47. Invitation Notification types phải có `jobInvitationId`.
48. `INVITED_APPLICATION_CREATED` phải có cả `jobInvitationId` và `applicationId`.
49. Existing V13 Application-scoped Notification types tiếp tục require `applicationId`.
50. Notification recipient/content phải được snapshot tại logical event time.
51. Notification materialization có thể xảy ra sau source commit.
52. Notification materialization failure không rollback source business state.
53. Một `eventKey` có tối đa một NotificationEvent.
54. Một `(eventId, recipientUserId)` có tối đa một Notification.
55. Realtime delivery không phải persisted business authority.
56. Persisted stale `PENDING` không override current authoritative source state.
57. Source lifecycle mutation không mặc định phải nằm trong global transaction với toàn bộ affected Invitations.
58. Terminal Invitation không bị TTL delete.
59. V15 không có JobInvitation audit collection.
60. V15 không thêm Source Recruiter authorization field vào Application.

Enforcement owner của các invariant trên là:

* schema/database đối với local structure và uniqueness;
* service đối với business/cross-document validity;
* transaction đối với atomic cross-document outcome;
* kết hợp nhiều lớp khi invariant cần cả concurrency và business context.

---

# 17. Definition of Data Completion

Data contract được coi là đáp ứng V15 khi:

* `JobInvitation` entity đã được xác định đầy đủ;
* mọi Invitation field có persistence contract rõ ràng;
* Invitation enum khớp Product Specification;
* Invited CV Snapshot contract đã rõ;
* Candidate–Job PENDING uniqueness đã có database protection;
* Invitation history/resend lookup đã có access path cần thiết;
* lifecycle expiration/invalidation lookup đã có indexes cần thiết;
* `Application` hỗ trợ source `RECRUITER_INVITATION`;
* `sourceInvitationId` có contract rõ;
* source-specific Application matrix đã được định nghĩa;
* Invitation Application create trực tiếp ở canonical initial status;
* initial Assignee semantics đã rõ;
* no-fake-Apply timestamp semantics đã rõ;
* Submitted CV Snapshot copy semantics đã rõ;
* Conversation creation requirement đã rõ;
* Availability absence semantics được giữ;
* Notification enum/reference matrix đã được mở rộng;
* `NotificationEvent` durability pattern V13 được giữ;
* `jobInvitationId` reference contract đã rõ;
* persistence transitions Send/Accept/Reject/Revoke/Expire/Invalidate đã được xác định;
* required database transaction boundaries đã được xác định;
* source-lifecycle operation không bị nâng guarantee ngoài Product requirement;
* constraint ownership giữa schema/database/service/transaction đã rõ;
* multi-tenant ownership đã rõ;
* snapshot/historical behavior đã rõ;
* compatibility với V5–V14 đã được giữ;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn;
* toàn bộ Persistence Invariants có enforcement owner rõ ràng.

Data Completion không đồng nghĩa với việc schema đã được code.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự suy đoán business hoặc data architecture quan trọng.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract của V15**.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE V15 PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entities / collections;
* fields;
* embedded documents;
* references;
* relationships;
* cardinality;
* enums;
* indexes;
* uniqueness;
* snapshots;
* persistence state;
* persistence transitions;
* transaction / atomicity requirements;
* persistence invariants;
* ownership của constraint;
* multi-tenant persistence boundary.

Tài liệu này **không định nghĩa**:

* REST endpoints;
* HTTP methods;
* HTTP status codes;
* request body;
* response body;
* controllers;
* routes;
* middleware implementation;
* service function structure;
* MongoDB query cụ thể;
* Mongoose method cụ thể;
* worker/scheduler source-code structure;
* Socket.IO room;
* Socket.IO event payload;
* UI behavior;
* frontend flow;
* test framework;
* Cloudinary implementation;
* storage vendor implementation;
* SMTP behavior;
* distributed transaction;
* exactly-once external delivery.

Boundary giữa các canonical layer:

```text
Product Specification
        │
        │ WHAT MUST HAPPEN
        ↓
Data Contract
        │
        │ WHAT MUST EXIST / PERSIST
        ↓
Engineering Contracts
        │
        │ HOW THE SYSTEM IS STRUCTURED
        ↓
Implementation
        │
        │ ACTUAL CODE
        ↓
Tests
```

Thứ tự authority:

```text
Approved Product Spec
→ business truth

Approved Data Contract
→ persistence truth

Engineering docs
→ architecture truth

PROJECT_STATUS
→ implementation snapshot

Source code + tests
→ actual implementation evidence

Raw idea / macro database / diagrams
→ input material only
```

Data Model không được dùng để tạo business requirement mới.

Nếu persistence design cần một behavior chưa tồn tại trong Product Specification, vấn đề đó phải được đưa trở lại Product layer để con người quyết định trước khi implementation.
 
