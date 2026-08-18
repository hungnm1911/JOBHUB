# V13 — Notification và phân phối realtime Data Model

> **File:** `docs/data/versions/v13-notification-realtime-distribution-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v13-notification-realtime-distribution.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v13-notification-realtime-distribution.md
```

Product Specification là authority đối với business behavior.

Tài liệu Data Model xác định:

* dữ liệu Notification nào phải được persist;
* cách biểu diễn durable Notification;
* persistence tối thiểu cần thiết để hỗ trợ eventual recovery;
* persistence identity để chống duplicate Notification;
* entity/collection nào được thêm hoặc mở rộng;
* relationship và ownership;
* field và constraint;
* index cần thiết;
* state persistence;
* persistence transition;
* transaction/atomicity requirement trong database của hệ thống;
* boundary giữa constraint do schema/database bảo vệ và constraint do service bảo vệ;
* multi-tenant/data ownership;
* compatibility với V12, nơi chưa có Notification persistence;
* các field/collection chủ động không thêm.

Tài liệu này **không thay đổi hoặc mở rộng business behavior** của Product Specification.

Nếu persistence design mâu thuẫn với Product Specification, Product Specification thắng và Data Contract phải được sửa.

---

# 2. Thay đổi so với version trước

V12 không persist Notification.

V13 giới thiệu mới lớp Notification chung cho các event thuộc phạm vi V13 và durable recovery state cần thiết cho eventual consistency.

| Entity / Collection                                  | Trạng thái  | Mô tả                                                                                                                  |
| ---------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Notification` / `notifications`                     | `NEW`       | Lưu durable inbox item, historical content, resource reference, logical event reference và read state.                 |
| `NotificationEvent` / `notification_events`          | `NEW`       | Lưu durable obligation cho một logical Notification event cùng recipient snapshot để hỗ trợ recovery và deduplication. |
| `User` / `users`                                     | `UNCHANGED` | Owner của Notification inbox; không thêm unread counter.                                                               |
| `CompanyMember` / `company_members`                  | `UNCHANGED` | Dùng để resolve Recruiter → User khi xác định recipient; Notification không thuộc CompanyMember.                       |
| `Job` / `jobs`                                       | `UNCHANGED` | Dùng để resolve Primary Recruiter và Company context từ Application.                                                   |
| `Application` / `applications`                       | `UNCHANGED` | Nguồn current Candidate, Job, Assignment và Application Status.                                                        |
| `Conversation` / `conversations`                     | `UNCHANGED` | V13 không persist Socket room hoặc Conversation realtime mode mới.                                                     |
| `Message` / `messages`                               | `UNCHANGED` | Nguồn của `CHAT_MESSAGE_CREATED`.                                                                                      |
| `CandidateAvailability` / `candidate_availabilities` | `UNCHANGED` | Nguồn của first-submit Availability flow.                                                                              |
| `InterviewSchedule` / `interview_schedules`          | `UNCHANGED` | Nguồn current Interview Schedule lifecycle và Schedule Notification.                                                   |

`JobInvitation` không thuộc persistence scope của V13.

Nếu macro database chứa `JobInvitation` hoặc các field phục vụ future Job Invitation, V13 không được coi chúng là dependency hoặc persistence responsibility của version này.

---

## 2.1. Entity mới

V13 bổ sung:

* `Notification`;
* `NotificationEvent`.

`NotificationEvent` là persistence entity nội bộ phục vụ:

* ghi nhận một logical event có nghĩa vụ tạo Notification;
* cố định recipient tại thời điểm business event xảy ra;
* giữ historical content cần materialize cho từng recipient;
* hỗ trợ recovery nếu durable Notification chưa được tạo ngay;
* cung cấp logical identity cho deduplication.

`NotificationEvent` **không phải** Notification inbox của User.

`NotificationEvent` cũng **không phải** generic realtime-event log.

---

## 2.2. Notification mới

V13 bổ sung:

* `Notification`.

Các đặc điểm chính:

* canonical `type` enum cho toàn bộ Notification V13;
* bổ sung `APPLICATION_UNASSIGNED`;
* bổ sung `INTERVIEW_AVAILABILITY_SUBMITTED`;
* bổ sung `CHAT_MESSAGE_CREATED`;
* các tên Interview Notification canonical của V13;
* bổ sung `content`;
* bổ sung `messageId`;
* `eventId` required cho mọi Notification;
* giữ `applicationId` là required;
* giữ `interviewScheduleId` khi event thuộc Schedule;
* không bổ sung Job Invitation type/reference.

---

## 2.3. Entity giữ nguyên nhưng được sử dụng

Không thay đổi schema V13 đối với:

* `User`;
* `CompanyMember`;
* `Job`;
* `Application`;
* `Conversation`;
* `Message`;
* `CandidateAvailability`;
* `InterviewSchedule`.

Không thay đổi schema của các entity này chỉ để phục vụ realtime.

---

# 3. Collection / Entity tổng thể

V13 sử dụng trực tiếp:

```text
notifications
notification_events

users
company_members
jobs
applications
conversations
messages
candidate_availabilities
interview_schedules
```

Vai trò:

| Entity / Collection     | Responsibility                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `Notification`          | Durable inbox item của một recipient User; lưu historical content và read state.           |
| `NotificationEvent`     | Durable recovery/deduplication source cho một logical business event cần tạo Notification. |
| `User`                  | Identity của recipient và actor.                                                           |
| `CompanyMember`         | Resolve Recruiter business identity sang User.                                             |
| `Job`                   | Resolve Primary Recruiter và Company context.                                              |
| `Application`           | Source of truth cho Candidate, Job, Assignment và Application lifecycle.                   |
| `Conversation`          | Source relation của Chat; không lưu realtime session state.                                |
| `Message`               | Source Message đã persist thành công.                                                      |
| `CandidateAvailability` | Source cho Availability first-submit.                                                      |
| `InterviewSchedule`     | Source cho Schedule lifecycle và Schedule reference.                                       |

Không tạo thêm collection ngoài danh sách V13 trực tiếp nếu chưa có canonical requirement mới.

---

# 4. Quan hệ dữ liệu

## 4.1. User → Notification

**Cardinality**

```text
User 1 ───── N Notification
```

**Owner**

`Notification`

**Reference**

```text
Notification.recipientUserId
```

**Constraint**

* mỗi Notification có đúng một recipient User;
* read state thuộc recipient User đó;
* Notification không thuộc CompanyMember;
* một User có thể nhận Notification từ nhiều Application và nhiều Company khác nhau.

**Lifecycle**

* Notification tồn tại lâu dài;
* User offline không làm mất Notification;
* resource liên quan thay đổi không xóa Notification.

---

## 4.2. NotificationEvent → Notification

**Cardinality**

```text
NotificationEvent 1 ───── N Notification
```

Một logical event có thể có một hoặc nhiều recipient.

**Owner**

`Notification`

**Reference**

```text
Notification.eventId
```

**Constraint**

Đối với Notification tạo mới từ V13:

```text
(eventId, recipientUserId)
```

phải duy nhất.

Do đó:

```text
1 logical event
+
1 recipient
=
tối đa 1 Notification
```

**Lifecycle**

* `NotificationEvent` được persist cùng source business transition theo atomicity contract của V13;
* `Notification` có thể được materialize sau source commit;
* `NotificationEvent` được giữ để phục vụ recovery và deduplication;
* mọi Notification V13 phải thuộc một `NotificationEvent`.

---

## 4.3. Application → NotificationEvent

**Cardinality**

```text
Application 1 ───── N NotificationEvent
```

**Reference**

```text
NotificationEvent.applicationId
```

**Required**

YES.

Toàn bộ durable Notification thuộc scope V13 đều phát sinh trong context của một Application.

Vì Job Invitation đã được defer, V13 không có Notification không thuộc Application.

---

## 4.4. Application → Notification

**Cardinality**

```text
Application 1 ───── N Notification
```

**Reference**

```text
Notification.applicationId
```

**Required**

YES.

`applicationId` tiếp tục required như V12.

V13 **không** đổi field này thành optional.

---

## 4.5. Message → NotificationEvent

Áp dụng cho:

```text
CHAT_MESSAGE_CREATED
```

**Cardinality**

```text
Message 1 ───── N NotificationEvent
```

Trong normal V13 flow, một Message tương ứng với một logical `CHAT_MESSAGE_CREATED` event; cardinality persistence vẫn cho phép lịch sử độc lập mà không đặt reverse reference trong Message.

**Reference**

```text
NotificationEvent.messageId
```

`messageId` required khi:

```text
type = CHAT_MESSAGE_CREATED
```

---

## 4.6. Message → Notification

**Cardinality**

```text
Message 1 ───── N Notification
```

**Reference**

```text
Notification.messageId
```

`messageId` required cho `CHAT_MESSAGE_CREATED`.

Không thêm reverse:

```text
Message.notificationId
```

vì một Message có thể tạo Notification cho nhiều recipient.

---

## 4.7. InterviewSchedule → NotificationEvent

Áp dụng cho:

```text
INTERVIEW_SCHEDULE_CREATED
INTERVIEW_SCHEDULE_CHANGED
INTERVIEW_SCHEDULE_CONFIRMED
INTERVIEW_SCHEDULE_DECLINED
```

**Reference**

```text
NotificationEvent.interviewScheduleId
```

Required đối với các loại trên.

---

## 4.8. InterviewSchedule → Notification

**Reference**

```text
Notification.interviewScheduleId
```

Required đối với Schedule Notification.

Không required đối với:

```text
INTERVIEW_AVAILABILITY_REQUESTED
INTERVIEW_AVAILABILITY_SUBMITTED
```

vì Availability và Schedule là hai resource khác nhau.

---

## 4.9. CandidateAvailability → Notification

V13 không bổ sung direct reference:

```text
candidateAvailabilityId
```

cho Notification.

Availability Notification được resolve qua:

```text
Notification.applicationId
        ↓
Application
        ↓
current CandidateAvailability
```

Product Specification không yêu cầu Notification giữ snapshot hoặc direct navigation tới một Availability revision cụ thể.

---

## 4.10. Conversation → Notification

Không bổ sung:

```text
conversationId
```

vào Notification.

Chat Notification resolve theo:

```text
Notification.messageId
        ↓
Message
        ↓
Conversation
        ↓
Application
```

và Notification đã có `applicationId` để giữ Application context trực tiếp.

Không lưu duplicate Conversation reference nếu không có persistence requirement riêng.

---

# 5. Notification

## 5.1. Responsibility

`Notification` chịu trách nhiệm lưu:

* một durable inbox item của một User;
* loại business event;
* recipient;
* historical content của Notification tại thời điểm tạo;
* Application context;
* Message reference nếu Notification thuộc Chat;
* Interview Schedule reference nếu Notification thuộc Schedule;
* logical Notification event reference đối với Notification V13;
* read state;
* thời điểm persistence của Notification.

`Notification` **không chịu trách nhiệm** lưu:

* current Application state;
* current Assignment;
* current Schedule status;
* current Chat permission;
* tenant authorization;
* Socket delivery state;
* online/offline state;
* Message read receipt;
* Notification preference;
* retry attempt history;
* Job Invitation state.

---

## 5.2. Fields

| Field                 | Type          | Required    | Default   | Constraint                                 | Ý nghĩa                                                                               |
| --------------------- | ------------- | ----------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `_id`                 | `ObjectId`    | YES         | generated | unique                                     | Định danh Notification.                                                               |
| `eventId`             | `ObjectId`    | YES         | —         | ref `NotificationEvent`, immutable sau tạo | Logical event tạo Notification.                                                       |
| `recipientUserId`     | `ObjectId`    | YES                      | —                 | ref `User`, immutable                      | User sở hữu Notification.                                                             |
| `actorUserId`         | `ObjectId`    | NO                       | `null`            | ref `User`, immutable                      | Human actor nếu event có actor được persist; có thể null với system-originated event. |
| `type`                | `String enum` | YES                      | —                 | immutable                                  | Loại Notification.                                                                    |
| `content`             | `String`      | YES                      | —                 | non-empty, immutable                       | Historical display content của Notification.                                          |
| `applicationId`       | `ObjectId`    | YES                      | —                 | ref `Application`, immutable               | Application context.                                                                  |
| `messageId`           | `ObjectId`    | Conditional              | `null`            | ref `Message`, immutable                   | Message nguồn của Chat Notification.                                                  |
| `interviewScheduleId` | `ObjectId`    | Conditional              | `null`            | ref `InterviewSchedule`, immutable         | Schedule nguồn của Interview Schedule Notification.                                   |
| `readAt`              | `Date`        | NO                       | `null`            | one-way lifecycle                          | `null` = unread; có giá trị = read.                                                   |
| `createdAt`           | `Date`        | YES                      | automatic         | —                                          | Thời điểm Notification document được tạo.                                             |
| `updatedAt`           | `Date`        | YES                      | automatic         | —                                          | Thời điểm document được cập nhật, chủ yếu do read transition.                         |

### `eventId`

V12 không persist Notification. Mọi Notification do V13 tạo phải có `eventId` và thuộc đúng một durable `NotificationEvent`.

Service không được tạo Notification thiếu `eventId`.

---

## 5.3. Enum `Notification.type`

Canonical V13 durable Notification types:

```text
DIRECT_APPLICATION_CREATED

APPLICATION_ASSIGNED
APPLICATION_REASSIGNED
APPLICATION_UNASSIGNED
APPLICATION_STATUS_CHANGED
APPLICATION_HIRED
APPLICATION_REJECTED
APPLICATION_WITHDRAWN

INTERVIEW_AVAILABILITY_REQUESTED
INTERVIEW_AVAILABILITY_SUBMITTED

INTERVIEW_SCHEDULE_CREATED
INTERVIEW_SCHEDULE_CHANGED
INTERVIEW_SCHEDULE_CONFIRMED
INTERVIEW_SCHEDULE_DECLINED

CHAT_MESSAGE_CREATED
```

### Không thuộc enum V13

Không đưa các realtime-only event vào `Notification.type`, bao gồm Conversation mode update.

Không đưa:

```text
CONVERSATION_BECAME_READ_ONLY
CONVERSATION_PAUSED_UNASSIGNED
CONVERSATION_BECAME_WRITABLE
```

vào durable Notification enum.

Không đưa Job Invitation events:

```text
JOB_INVITATION_RECEIVED
JOB_INVITATION_ACCEPTED
JOB_INVITATION_REJECTED
JOB_INVITATION_REVOKED
JOB_INVITATION_INVALIDATED
INVITED_APPLICATION_CREATED
```

vào V13 enum.

Không có:

```text
INTERVIEW_SCHEDULE_CANCELLED
INTERVIEW_SCHEDULE_COMPLETED
```

trong canonical V13 Notification enum.

Schedule cancellation dùng:

```text
INTERVIEW_SCHEDULE_CHANGED
```

---

## 5.4. Indexes

### IDX-N01 — Notification inbox

```text
{ recipientUserId: 1, createdAt: -1, _id: -1 }
```

**Loại:** Compound.

**Mục đích:**

* tải Notification inbox theo recipient;
* hỗ trợ thứ tự ổn định khi nhiều Notification có cùng thời điểm;
* hỗ trợ pagination của inbox ở Data/API layer sau.

---

### IDX-N02 — Unread lookup

```text
{ recipientUserId: 1, readAt: 1 }
```

**Loại:** Compound.

**Mục đích:**

* xác định tổng Notification chưa đọc của một User;
* không cần persist unread counter vào User.

---

### IDX-N03 — Logical event recipient uniqueness

```text
{ eventId: 1, recipientUserId: 1 }
```

**Loại:** Unique.

**Mục đích:**

Bảo vệ invariant:

```text
1 logical event
+
1 recipient
→ tối đa 1 Notification
```

---

## 5.5. Embedded documents

`Notification` không bổ sung embedded document mới.

---

## 5.6. Reference rules

| Field                 | Reference           | Required    | Cardinality | Rule                                           |
| --------------------- | ------------------- | ----------- | ----------- | ---------------------------------------------- |
| `eventId`             | `NotificationEvent` | V13 YES     | N → 1       | V13 Notification phải thuộc một logical event. |
| `recipientUserId`     | `User`              | YES         | N → 1       | User sở hữu read state.                        |
| `actorUserId`         | `User`              | NO          | N → 1       | Không dùng làm authorization source.           |
| `applicationId`       | `Application`       | YES         | N → 1       | Bắt buộc cho mọi Notification V13.             |
| `messageId`           | `Message`           | Conditional | N → 1       | Chỉ required cho `CHAT_MESSAGE_CREATED`.       |
| `interviewScheduleId` | `InterviewSchedule` | Conditional | N → 1       | Required cho Schedule Notification.            |

Referenced resource có tồn tại về mặt structural không đồng nghĩa actor hiện còn quyền đối với resource đó.

Current permission do service/module nguồn kiểm tra.

---

# 6. NotificationEvent

## 6.1. Responsibility

`NotificationEvent` chịu trách nhiệm lưu **durable obligation** của một logical business event cần tạo một hoặc nhiều Notification.

Entity này tồn tại để hỗ trợ hai Product invariant:

```text
required Notification cuối cùng phải recover
```

và:

```text
1 logical event / recipient
→ tối đa 1 Notification
```

`NotificationEvent` lưu:

* stable logical event identity;
* Notification type;
* Application context;
* source Message/Schedule reference khi cần;
* actor nếu có;
* recipient snapshot;
* historical content snapshot theo từng recipient;
* materialization state.

`NotificationEvent` **không chịu trách nhiệm** lưu:

* Socket delivery;
* delivery acknowledgement;
* online session;
* retry count;
* error log;
* Notification read state;
* current resource authorization;
* generic domain event history của toàn hệ thống.

---

## 6.2. Fields

| Field                 | Type                              | Required    | Default   | Constraint                         | Ý nghĩa                                                        |
| --------------------- | --------------------------------- | ----------- | --------- | ---------------------------------- | -------------------------------------------------------------- |
| `_id`                 | `ObjectId`                        | YES         | generated | unique                             | Định danh durable logical event.                               |
| `eventKey`            | `String`                          | YES         | —         | unique, immutable, non-empty       | Stable identity của logical business event qua retry.          |
| `type`                | `String enum`                     | YES         | —         | immutable                          | Notification type phải materialize.                            |
| `actorUserId`         | `ObjectId`                        | NO          | `null`    | ref `User`, immutable              | Human actor nếu có.                                            |
| `applicationId`       | `ObjectId`                        | YES         | —         | ref `Application`, immutable       | Application context.                                           |
| `messageId`           | `ObjectId`                        | Conditional | `null`    | ref `Message`, immutable           | Required cho Chat event.                                       |
| `interviewScheduleId` | `ObjectId`                        | Conditional | `null`    | ref `InterviewSchedule`, immutable | Required cho Schedule event.                                   |
| `recipients`          | `NotificationRecipientSnapshot[]` | YES         | —         | minimum 1, immutable               | Recipient + historical content được cố định tại event time.    |
| `materializedAt`      | `Date`                            | NO          | `null`    | one-way lifecycle                  | Có giá trị khi mọi required Notification của event đã tồn tại. |
| `createdAt`           | `Date`                            | YES         | automatic | —                                  | Thời điểm durable event obligation được ghi nhận.              |
| `updatedAt`           | `Date`                            | YES         | automatic | —                                  | Thời điểm materialization state được cập nhật.                 |

---

## 6.3. Embedded `NotificationRecipientSnapshot`

```text
NotificationRecipientSnapshot {
  recipientUserId
  content
}
```

| Field             | Type       | Required | Constraint            | Ý nghĩa                                                       |
| ----------------- | ---------- | -------- | --------------------- | ------------------------------------------------------------- |
| `recipientUserId` | `ObjectId` | YES      | ref `User`, immutable | Recipient đã được xác định tại event time.                    |
| `content`         | `String`   | YES      | non-empty, immutable  | Historical Notification content dành riêng cho recipient này. |

### Invariant recipient snapshot

Trong cùng một `NotificationEvent`:

```text
recipientUserId
```

không được xuất hiện nhiều hơn một lần.

Nếu một User đồng thời thỏa nhiều business role recipient của cùng logical event, event vẫn chỉ chứa User đó một lần.

---

## 6.4. Vì sao phải snapshot recipient

Product Specification yêu cầu recipient được xác định từ current trusted business state tại thời điểm event.

Ví dụ:

```text
Candidate Confirm Schedule
Application đang ASSIGNED(A)
→ recipient = A
```

Sau đó Application có thể:

```text
ASSIGNED(A)
→ ASSIGNED(B)
```

Nếu Notification materialization xảy ra sau Reassign, recovery **không được** tính lại recipient thành B.

Do đó:

```text
recipient tại business event time
→ persisted recipient snapshot
→ recovery dùng snapshot này
```

Không recompute recipient từ current Assignment tại thời điểm retry.

---

## 6.5. Vì sao phải snapshot content

Một logical event có thể tạo content khác nhau cho từng recipient.

Ví dụ Direct Application:

```text
Candidate
→ nội dung xác nhận ứng tuyển

Primary
→ nội dung về hồ sơ mới chưa phân công
```

Do Notification có thể materialize sau source commit, recovery phải sử dụng historical content đã được quyết định cùng event.

Không dựng lại content từ current resource state tại thời điểm retry.

---

## 6.6. `eventKey`

`eventKey` là persistence identity của **logical business event**, không phải Socket event id.

Contract:

* cùng một logical business event phải dùng cùng `eventKey` qua retry/recovery;
* hai business event khác nhau phải có identity khác nhau;
* representation cụ thể của `eventKey` không thuộc Data Contract;
* database unique index bảo vệ không tồn tại hai `NotificationEvent` cùng `eventKey`;
* service chịu trách nhiệm bảo đảm retry của cùng business event không tự phát sinh logical identity mới.

---

## 6.7. Enum

`NotificationEvent.type` sử dụng cùng canonical enum với V13 `Notification.type`:

```text
DIRECT_APPLICATION_CREATED

APPLICATION_ASSIGNED
APPLICATION_REASSIGNED
APPLICATION_UNASSIGNED
APPLICATION_STATUS_CHANGED
APPLICATION_HIRED
APPLICATION_REJECTED
APPLICATION_WITHDRAWN

INTERVIEW_AVAILABILITY_REQUESTED
INTERVIEW_AVAILABILITY_SUBMITTED

INTERVIEW_SCHEDULE_CREATED
INTERVIEW_SCHEDULE_CHANGED
INTERVIEW_SCHEDULE_CONFIRMED
INTERVIEW_SCHEDULE_DECLINED

CHAT_MESSAGE_CREATED
```

Không persist Conversation realtime-only state bằng `NotificationEvent`.

---

## 6.8. Indexes

### IDX-NE01 — Logical event uniqueness

```text
{ eventKey: 1 }
```

**Loại:** Unique.

**Mục đích:**

* chống tạo hai durable event obligation cho cùng logical event;
* cung cấp persistence protection cho retry.

---

### IDX-NE02 — Pending materialization

```text
{ materializedAt: 1, createdAt: 1 }
```

**Loại:** Compound.

**Mục đích:**

Tìm các durable event chưa materialize đầy đủ Notification:

```text
materializedAt = null
```

để phục vụ eventual recovery.

Data Contract không quy định worker, scheduler hoặc cơ chế retry cụ thể.

---

## 6.9. Reference rules

| Field                          | Reference           | Required    | Rule                                                          |
| ------------------------------ | ------------------- | ----------- | ------------------------------------------------------------- |
| `actorUserId`                  | `User`              | NO          | Chỉ là historical actor identity, không cấp quyền.            |
| `applicationId`                | `Application`       | YES         | Mọi V13 durable Notification event thuộc Application context. |
| `messageId`                    | `Message`           | Conditional | Required cho `CHAT_MESSAGE_CREATED`.                          |
| `interviewScheduleId`          | `InterviewSchedule` | Conditional | Required cho Schedule event.                                  |
| `recipients[].recipientUserId` | `User`              | YES         | Recipient đã được resolve trước khi event được persist.       |

---

# 7. State Matrix

## 7.1. Notification read state

| `readAt` | Derived state | Hợp lệ | Ý nghĩa                              |
| -------- | ------------- | ------ | ------------------------------------ |
| `null`   | `UNREAD`      | YES    | Notification chưa được recipient mở. |
| Date     | `READ`        | YES    | Notification đã được recipient mở.   |

Không tồn tại field:

```text
isRead
```

Read state chỉ được derive từ `readAt`.

---

## 7.2. NotificationEvent materialization state

Không persist enum `status`.

State được derive từ `materializedAt`.

| `materializedAt` | Derived state  | Ý nghĩa                                                      |
| ---------------- | -------------- | ------------------------------------------------------------ |
| `null`           | `PENDING`      | Một hoặc nhiều required Notification có thể chưa tồn tại.    |
| Date             | `MATERIALIZED` | Mọi recipient snapshot đã có durable Notification tương ứng. |

Transition duy nhất:

```text
PENDING
→ MATERIALIZED
```

Không có:

```text
MATERIALIZED
→ PENDING
```

---

## 7.3. Partial materialization matrix

Giả sử event có `N` recipient snapshot.

| Notification tồn tại               | `materializedAt` | Hợp lệ       | Ý nghĩa                                                                                                     |
| ---------------------------------- | ---------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `0 .. N-1`                         | `null`           | YES          | Event đang chờ hoặc đang được recover.                                                                      |
| `N`                                | `null`           | YES tạm thời | Mọi Notification đã tồn tại nhưng completion marker chưa được ghi; recovery được phép xác nhận và hoàn tất. |
| `N`                                | Date             | YES          | Materialization hoàn tất.                                                                                   |
| `< N`                              | Date             | NO           | Không được đánh dấu hoàn tất khi còn thiếu Notification.                                                    |
| `> N` cho cùng event/recipient set | bất kỳ           | NO           | Vi phạm deduplication invariant.                                                                            |

---

## 7.4. Reference matrix theo Notification type

### Application / Assignment types

```text
DIRECT_APPLICATION_CREATED
APPLICATION_ASSIGNED
APPLICATION_REASSIGNED
APPLICATION_UNASSIGNED
APPLICATION_STATUS_CHANGED
APPLICATION_HIRED
APPLICATION_REJECTED
APPLICATION_WITHDRAWN
```

| Field                 | Requirement  |
| --------------------- | ------------ |
| `applicationId`       | REQUIRED     |
| `messageId`           | MUST BE NULL |
| `interviewScheduleId` | MUST BE NULL |

---

### Availability types

```text
INTERVIEW_AVAILABILITY_REQUESTED
INTERVIEW_AVAILABILITY_SUBMITTED
```

| Field                 | Requirement  |
| --------------------- | ------------ |
| `applicationId`       | REQUIRED     |
| `messageId`           | MUST BE NULL |
| `interviewScheduleId` | MUST BE NULL |

---

### Interview Schedule types

```text
INTERVIEW_SCHEDULE_CREATED
INTERVIEW_SCHEDULE_CHANGED
INTERVIEW_SCHEDULE_CONFIRMED
INTERVIEW_SCHEDULE_DECLINED
```

| Field                 | Requirement  |
| --------------------- | ------------ |
| `applicationId`       | REQUIRED     |
| `interviewScheduleId` | REQUIRED     |
| `messageId`           | MUST BE NULL |

---

### Chat type

```text
CHAT_MESSAGE_CREATED
```

| Field                 | Requirement  |
| --------------------- | ------------ |
| `applicationId`       | REQUIRED     |
| `messageId`           | REQUIRED     |
| `interviewScheduleId` | MUST BE NULL |

Cùng reference matrix áp dụng cho:

* `NotificationEvent`;
* V13-created `Notification`.

---

# 8. Persistence Transitions

Phần này chỉ mô tả persistence consequence của các business transition đã tồn tại trong Product Specification.

Không tạo business transition mới.

---

## 8.1. Generic Notification-producing transition

### Trigger business

Bất kỳ successful business transition nào thuộc F02–F07 và sau actor filtering còn ít nhất một recipient.

### Trước

Source entity đang ở persisted state hợp lệ của module nguồn.

Không tồn tại `NotificationEvent` cho logical event này.

### Sau source persistence boundary

```text
Source business state
= new canonical state

NotificationEvent
= tồn tại
eventKey = logical event identity
type = canonical Notification type
applicationId = source Application
recipients = immutable recipient snapshots
materializedAt = null
```

Nếu event thuộc Chat:

```text
messageId = source Message
```

Nếu event thuộc Schedule:

```text
interviewScheduleId = source InterviewSchedule
```

### Các entity bị thay đổi

* source entity/entity set của version nguồn;
* `NotificationEvent`.

### Chưa bắt buộc thay đổi trong cùng bước

* `Notification`.

Durable Notification có thể materialize sau source commit.

### Invariant

* source mutation đã thắng phải có durable event obligation nếu event yêu cầu Notification;
* recipient phải được cố định tại source event time;
* stale request không được tạo event cho business mutation không thắng;
* cùng logical event chỉ có một `NotificationEvent`.

---

## 8.2. Business transition không còn recipient sau filtering

Ví dụ:

```text
Candidate action
+
Candidate là recipient duy nhất
+
actor filtering loại Candidate
```

hoặc:

```text
Candidate Confirm/Decline
+
Application đang UNASSIGNED
→ không có Recruiter recipient
```

### Sau

Source business transition vẫn persist bình thường.

V13 không tạo:

```text
NotificationEvent
Notification
```

cho event không có durable recipient.

Không tạo empty `NotificationEvent.recipients = []`.

---

## 8.3. `DIRECT_APPLICATION_CREATED`

### Source persistence

Application Direct Apply đã được tạo thành công theo V09/V10.

### V13 persisted consequence

Một `NotificationEvent`:

```text
type = DIRECT_APPLICATION_CREATED

applicationId = Application

recipients =
- Candidate User
- Primary Recruiter User

materializedAt = null
```

Content được snapshot riêng cho từng recipient.

Application không tự Assign cho Primary.

---

## 8.4. `APPLICATION_ASSIGNED`

### Source transition

```text
Application
UNASSIGNED
→ ASSIGNED(B)
```

### V13 persisted consequence

```text
NotificationEvent.type
= APPLICATION_ASSIGNED
```

Recipient snapshots sau actor filtering:

```text
Candidate
new Assignee B
```

Nếu B chính là actor và bị actor filtering:

```text
B không nằm trong recipients
```

Source Assignment state vẫn là authority.

---

## 8.5. `APPLICATION_REASSIGNED`

### Source transition

```text
ASSIGNED(A)
→ ASSIGNED(B)
```

### V13 persisted consequence

Tạo:

```text
APPLICATION_REASSIGNED
```

recipient snapshots:

```text
Candidate
A
B
```

sau actor filtering.

Không tạo persistence event giả:

```text
APPLICATION_UNASSIGNED
+
APPLICATION_ASSIGNED
```

cho cùng Reassign operation.

Nếu V11 đồng thời tạo SYSTEM Message, Message đó có logical `CHAT_MESSAGE_CREATED` event riêng.

Do đó một source transaction có thể tạo nhiều `NotificationEvent` độc lập.

---

## 8.6. `APPLICATION_UNASSIGNED`

### Source transition

```text
ASSIGNED(A)
→ UNASSIGNED
```

Áp dụng cho:

* manual Unassign;
* automatic Unassign.

### V13 persisted consequence

```text
NotificationEvent.type
= APPLICATION_UNASSIGNED
```

Recipient snapshots sau actor filtering:

```text
Candidate
A
```

Candidate content snapshot không được chứa internal lifecycle cause đã bị Product Specification cấm expose.

Conversation realtime mode không được persist vào `NotificationEvent`.

---

## 8.7. Application Status / Terminal / Withdraw

### Non-terminal status

Khi Product Specification yêu cầu:

```text
APPLICATION_STATUS_CHANGED
```

tạo `NotificationEvent` cho Candidate sau actor filtering.

### `HIRED`

Tạo:

```text
APPLICATION_HIRED
```

Không đồng thời tạo:

```text
APPLICATION_STATUS_CHANGED
```

cho cùng status transition.

### `REJECTED`

Tạo:

```text
APPLICATION_REJECTED
```

Không đồng thời tạo generic status event.

### `WITHDRAWN`

Nếu Application đang Assigned tại successful Withdraw boundary:

```text
recipient snapshot
= current Assignee User
```

Nếu Application đang Unassigned:

```text
recipient snapshot
= Primary Recruiter User
```

Candidate không nằm trong recipients.

---

## 8.8. Availability requested

Khi source Interview flow yêu cầu Candidate gửi Availability:

```text
type = INTERVIEW_AVAILABILITY_REQUESTED
applicationId = Application
recipient = Candidate
```

Không có `interviewScheduleId`.

---

## 8.9. Availability first-submit

Khi Candidate Availability được persist lần đầu:

Nếu Application đang:

```text
ASSIGNED(A)
```

tạo:

```text
type = INTERVIEW_AVAILABILITY_SUBMITTED
recipient = A.userId
```

Nếu Application đang:

```text
UNASSIGNED
```

không tạo `NotificationEvent`.

Không fallback Primary.

Availability edit sau first-submit không tạo V13 Notification event.

---

## 8.10. Interview Schedule created

Khi Schedule được tạo thành công ở canonical V12 flow:

```text
type = INTERVIEW_SCHEDULE_CREATED
applicationId = Application
interviewScheduleId = Schedule
recipient = Candidate
```

Nếu cùng source transition cũng làm Application đổi status và Product Specification yêu cầu `APPLICATION_STATUS_CHANGED`, đó là **logical event riêng**.

Hai durable obligations được persist độc lập.

---

## 8.11. Interview Schedule changed

Khi Schedule thay đổi thuộc Product V13 scope:

```text
type = INTERVIEW_SCHEDULE_CHANGED
```

bao gồm Schedule chuyển:

```text
→ CANCELLED
```

Không tạo:

```text
INTERVIEW_SCHEDULE_CANCELLED
```

---

## 8.12. Interview Schedule Confirm / Decline

Nếu Candidate response thành công và Application đang:

```text
ASSIGNED(A)
```

tạo event:

```text
INTERVIEW_SCHEDULE_CONFIRMED
```

hoặc:

```text
INTERVIEW_SCHEDULE_DECLINED
```

với:

```text
recipient snapshot = A.userId
```

Nếu Application đang:

```text
UNASSIGNED
```

không tạo durable Notification event cho Recruiter.

Không recompute recipient sau này nếu Assignment thay đổi.

---

## 8.13. `CHAT_MESSAGE_CREATED`

### Source transition

Message đã được V11 lưu thành công.

### Sau

Tạo:

```text
NotificationEvent.type
= CHAT_MESSAGE_CREATED

applicationId
= Application của Conversation

messageId
= Message
```

Recipient snapshot được xác định theo Conversation authority sau business mutation liên quan.

Candidate NORMAL Message:

```text
recipient = current Assigned Recruiter
```

Assigned Recruiter NORMAL Message:

```text
recipient = Candidate
```

SYSTEM Message:

```text
recipient set
= participant hợp lệ sau source transition
```

Không thêm Notification reference ngược vào Message.

---

## 8.14. Conversation realtime mode transition

Các transition:

```text
WRITABLE
→ PAUSED_UNASSIGNED

PAUSED_UNASSIGNED
→ WRITABLE

WRITABLE / PAUSED_UNASSIGNED
→ READ_ONLY
```

không tạo persistence entity mới trong V13.

Không persist:

```text
Conversation.status
RealtimeEvent
SocketEvent
SocketSession
```

V13 chỉ dựa vào source Application state để client có thể resync current Conversation behavior.

---

## 8.15. Notification materialization

### Trước

```text
NotificationEvent.materializedAt = null
```

Một hoặc nhiều recipient snapshot chưa có `Notification` tương ứng.

### Materialization cho một recipient

Tạo một `Notification` với:

```text
eventId
recipientUserId
type
content
applicationId
messageId nếu có
interviewScheduleId nếu có
actorUserId nếu có
readAt = null
```

Dữ liệu được copy từ immutable `NotificationEvent`.

### Duplicate retry

Nếu Notification cho:

```text
(eventId, recipientUserId)
```

đã tồn tại, retry không được tạo document thứ hai.

### Khi mọi recipient đã có Notification

```text
NotificationEvent.materializedAt
= thời điểm hoàn tất
```

---

## 8.16. Notification read transition

### Trước

```text
Notification.readAt = null
```

### Trigger

Recipient mở chính Notification.

### Sau

```text
Notification.readAt = timestamp
```

### Invariant

Nếu `readAt` đã có giá trị:

* không ghi lại thời điểm mới;
* không chuyển lại `null`.

Không thay đổi `NotificationEvent`.

---

# 9. Transaction / Atomicity Requirements

Transaction/atomicity trong section này chỉ áp dụng cho persisted state trong database của hệ thống.

Không suy diễn thành distributed transaction với Socket.IO hoặc external service.

---

## TX-01 — Source business transition + durable Notification obligation

### Business source

Áp dụng cho các successful source transition thuộc:

* Direct Application;
* Assign;
* Reassign;
* Unassign;
* Application Status;
* Hire;
* Reject;
* Withdraw;
* Availability request;
* Availability first-submit;
* Interview Schedule mutation;
* Interview response;
* Message creation;

khi Product Specification yêu cầu một hoặc nhiều durable Notification.

### Trong cùng database atomic boundary

Phải persist:

1. toàn bộ source business state bắt buộc của transition;
2. mọi `NotificationEvent` bắt buộc phát sinh từ transition đó.

Ví dụ một source transition có thể tạo:

```text
Application mutation
+
APPLICATION_REASSIGNED NotificationEvent
+
SYSTEM Message
+
CHAT_MESSAGE_CREATED NotificationEvent
```

nếu các module nguồn yêu cầu các persisted result đó.

### Sau commit phải đảm bảo

```text
Source business state đã thành công
→ durable obligation cho mọi required Notification đã tồn tại
```

### Không được xuất hiện

```text
Source transition đã commit
nhưng
không có bất kỳ persisted recovery source nào
cho required Notification
```

### Nếu event không có recipient

Không tạo `NotificationEvent` rỗng.

Source business transition vẫn được phép commit.

---

## 9.1. Phân biệt `NotificationEvent` và `Notification`

TX-01 **không yêu cầu durable `Notification` inbox document phải được tạo trong cùng transaction với source business mutation**.

Đây là điểm khác với strong-consistency model đã bị Product Specification loại bỏ.

Canonical V13 là:

```text
Source business state
+
NotificationEvent obligation
        ↓
commit
        ↓
Notification materialization
có thể xảy ra sau
```

Do đó nếu việc materialize `Notification` tạm thời thất bại:

```text
source business state
không rollback
```

`NotificationEvent` còn tồn tại để recovery tiếp tục.

---

## 9.2. Vì sao durable obligation thuộc source atomic boundary

Product contract đồng thời yêu cầu:

```text
business result không rollback
chỉ vì Notification materialization lỗi
```

và:

```text
required Notification cuối cùng không được mất
```

Để cả hai cùng đúng trong persisted state, V13 phân biệt:

```text
NotificationEvent
= durable obligation / recovery source

Notification
= user-facing durable inbox item
```

Việc ghi obligation thuộc persisted completion của source transition.

Việc materialize inbox item là eventual.

---

## 9.3. Notification materialization không yêu cầu cross-document transaction mới

Trong recovery/materialization:

* Notification của từng recipient có thể được tạo độc lập;
* partial materialization là persistence state hợp lệ;
* unique constraint chống duplicate khi retry;
* `materializedAt` chỉ được ghi sau khi mọi required Notification tồn tại.

Không yêu cầu rollback các Notification đã tạo nếu một recipient khác chưa materialize thành công.

Recovery tiếp tục phần còn thiếu.

---

## 9.4. `readAt` không yêu cầu transaction cross-document

Notification read transition chỉ thay đổi một Notification.

Không thay đổi:

* User;
* NotificationEvent;
* Application;
* Message;
* Schedule.

---

## 9.5. Realtime delivery không thuộc database transaction

Socket delivery chỉ được thực hiện sau khi dữ liệu tương ứng đã persist theo Product Contract.

Không persist rollback logic cho Socket emit failure.

Socket emit failure:

```text
không xóa Notification
không rollback Message
không rollback Application
không rollback Interview state
```

V13 không yêu cầu exactly-once Socket delivery.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema chỉ bảo vệ constraint có đủ local persistence context.

| Constraint                                              | Owner    | Lý do                                        |
| ------------------------------------------------------- | -------- | -------------------------------------------- |
| `Notification.recipientUserId` required                 | Schema   | Local field structure.                       |
| `Notification.applicationId` required                   | Schema   | Mọi V13 Notification đều Application-scoped. |
| `Notification.type` thuộc canonical enum                | Schema   | Local enum.                                  |
| `Notification.content` non-empty                        | Schema   | Local historical field.                      |
| Conditional Message/Schedule reference matrix           | Schema   | `type` và references nằm cùng document.      |
| `NotificationEvent.eventKey` required                   | Schema   | Local field.                                 |
| `NotificationEvent.eventKey` unique                     | Database | Dùng unique index.                           |
| `NotificationEvent.recipients` non-empty                | Schema   | Event tồn tại chỉ khi có durable recipient.  |
| `NotificationEvent.type` enum                           | Schema   | Local enum.                                  |
| `NotificationEvent.applicationId` required              | Schema   | Mọi event thuộc Application context.         |
| `Notification(eventId, recipientUserId)` unique cho V13 | Database | Chống duplicate materialization.             |
| `readAt` nullable Date                                  | Schema   | Local type.                                  |
| `materializedAt` nullable Date                          | Schema   | Local type.                                  |

Database/schema không tự xác định business role của recipient.

---

## 10.2. Service bảo vệ

Service chịu trách nhiệm đối với business/cross-document constraint.

| Constraint                                                 | Owner                                 | Lý do                                                         |
| ---------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Business transition nguồn hợp lệ                           | Source service                        | Thuộc V09–V12 business contract.                              |
| Recipient là Candidate đúng Application                    | Service                               | Cross-document ownership.                                     |
| Recruiter recipient là current Assignee                    | Service                               | Cần Application + CompanyMember state.                        |
| Recruiter recipient có User tương ứng                      | Service                               | CompanyMember → User resolution.                              |
| Primary recipient là Primary của đúng Job                  | Service                               | Application → Job relationship.                               |
| Actor filtering                                            | Service                               | Business rule.                                                |
| Candidate Unassign content không lộ internal cause         | Service                               | Product semantics.                                            |
| Recipient snapshot không chứa duplicate User               | Service                               | Cần dedupe theo business identity.                            |
| Same logical event retry giữ cùng `eventKey`               | Service                               | Database chỉ biết uniqueness, không biết logical equivalence. |
| Event không được tạo cho stale mutation                    | Service / source concurrency boundary | Cần biết mutation nào thắng.                                  |
| Confirm/Decline khi UNASSIGNED không fallback              | Service                               | Cross-document current state.                                 |
| Availability first-submit khi UNASSIGNED không tạo event   | Service                               | Cross-document state.                                         |
| Availability edit không tạo event                          | Service                               | Business lifecycle.                                           |
| Reassign không phát sinh Assign + Unassign event giả       | Service                               | Business semantic.                                            |
| NotificationEvent recipient/content snapshot phải bất biến | Service + schema                      | Historical truth.                                             |
| `materializedAt` chỉ set khi đủ Notification               | Service                               | Cần kiểm tra cross-document materialization.                  |
| `readAt` chỉ null → Date                                   | Service                               | One-way business transition.                                  |
| User chỉ mark read Notification của mình                   | Service                               | Ownership/authorization.                                      |
| Resource permission khi mở Notification                    | Source resource service               | Notification không cấp quyền.                                 |
| Cross-tenant relation hợp lệ                               | Service                               | Cần Company/Application context.                              |
| Notification bắt buộc có `eventId`                         | Service + schema                      | Mọi inbox item thuộc một durable logical event.               |

---

## 10.3. Transaction bảo vệ

Transaction/atomic persistence boundary chịu trách nhiệm:

* source state và durable `NotificationEvent` obligation không bị tách thành partial persisted result;
* mọi required `NotificationEvent` của cùng source transition được ghi nhận cùng persisted completion;
* stale request không được để lại event obligation cho transition không thắng.

---

## 10.4. Không ép schema bảo vệ cross-document business

Schema không được tự suy luận:

* User có phải Candidate owner hay không;
* CompanyMember có phải current Assignee hay không;
* Recruiter còn eligible hay không;
* Primary có thuộc Job hay không;
* Application đang `ASSIGNED` hay `UNASSIGNED`;
* Schedule có đang ở state cho phép hay không;
* Message sender có Chat authority hay không.

Các rule này thuộc service/module nguồn.

---

# 11. Token / TTL Lifecycle

> V13 không bổ sung token/TTL persistence mới.

Không có TTL cho:

* `Notification`;
* `NotificationEvent`.

Notification được giữ lâu dài theo Product Specification.

`NotificationEvent` không được TTL-cleanup trong V13 vì event identity và recovery state vẫn là persistence source hỗ trợ deduplication của Notification tồn tại lâu dài.

---

# 12. Multi-tenant Data Boundary

V13 không tạo tenant model mới.

Canonical Company context của một Application được resolve qua:

```text
Application
   ↓
Job
   ↓
Company
```

---

## 12.1. Resource ownership

| Resource                | Data owner                          | Tenant context                                |
| ----------------------- | ----------------------------------- | --------------------------------------------- |
| `Notification`          | `recipientUserId`                   | Business context resolve qua `applicationId`. |
| `NotificationEvent`     | Internal system persistence         | Company context resolve qua `applicationId`.  |
| `Application`           | Theo canonical Application contract | Job → Company.                                |
| `Message`               | Conversation/Application context    | Application → Job → Company.                  |
| `InterviewSchedule`     | Application context                 | Application → Job → Company.                  |
| `CandidateAvailability` | Candidate/Application context       | Application → Job → Company.                  |

Notification inbox là **User-owned**, không phải Company-owned inbox.

Một Candidate có thể có Notification từ nhiều Company.

Một Recruiter chỉ được trở thành recipient khi business rule của đúng tenant xác định User đó là recipient hợp lệ.

---

## 12.2. Backend tenant resolution

```text
Authenticated User
        ↓
Notification.recipientUserId
        ↓
Notification.applicationId
        ↓
Application
        ↓
Job
        ↓
Company context
```

Đối với event creation:

```text
Source Application
        ↓
Job / Company
        ↓
current trusted business relationship
        ↓
recipient User
        ↓
NotificationEvent recipient snapshot
```

---

## 12.3. Không persist duplicate tenant key trong Notification

V13 không bổ sung:

```text
Notification.companyId
Notification.jobId
Notification.recipientCompanyMemberId
```

vì:

* Application đã cung cấp business context;
* recipient inbox thuộc User;
* duplicate tenant reference tạo thêm consistency obligation không cần thiết.

---

## 12.4. Cross-tenant invariant

Không được tồn tại Notification/Event trong đó:

```text
applicationId
```

và:

```text
messageId / interviewScheduleId
```

trỏ tới resource thuộc Application khác hoặc Company context khác.

Database reference type không đủ để bảo vệ invariant này.

Service phải kiểm tra.

---

# 13. Snapshot / Historical Data

V13 bổ sung historical persistence ở hai cấp.

---

## 13.1. Notification content snapshot

`Notification.content` là historical representation của nội dung recipient đã nhận.

Sau khi Notification được tạo:

```text
content
= immutable
```

Resource live thay đổi sau đó không sửa lại content cũ.

Ví dụ:

```text
APPLICATION_UNASSIGNED
```

content Candidate tiếp tục phản ánh event đã xảy ra, kể cả Application sau đó đã được Assign lại.

---

## 13.2. NotificationEvent recipient snapshot

Snapshot được tạo khi source business transition thành công và required Notification recipient đã được xác định.

Snapshot chứa:

| Field             | Source                                      | Ý nghĩa                                             |
| ----------------- | ------------------------------------------- | --------------------------------------------------- |
| `recipientUserId` | Trusted recipient resolution tại event time | Người phải nhận Notification của logical event này. |
| `content`         | Event + recipient semantics tại event time  | Nội dung phải materialize cho recipient.            |

Lifecycle:

* tạo cùng durable event obligation;
* immutable;
* không recompute khi resource thay đổi;
* không đổi khi Application Reassign sau đó;
* không đổi khi Recruiter mất eligibility sau đó;
* được dùng cho eventual recovery.

Nguyên tắc:

```text
recipient snapshot
!=
current recipient recomputation
```

---

## 13.3. Reference không phải snapshot

Các field:

```text
applicationId
messageId
interviewScheduleId
```

là live references tới historical/current resource.

Notification không snapshot toàn bộ resource.

Khi User mở Notification, current resource state và authorization vẫn được kiểm tra từ resource thật.

---

## 13.4. Actor identity

`actorUserId`, nếu được persist, là historical identity của human actor tại event time.

Nó không được dùng để quyết định:

* current recipient;
* current authorization;
* current Assignment.

---

# 14. Explicitly Excluded Persistence

V13 chủ động **KHÔNG thêm**:

```text
JobInvitation Notification types
jobInvitationId
```

Không thêm generic Job Invitation persistence chỉ vì macro database có artifact tương lai.

---

## 14.1. Không thêm delivery/session persistence

Không tạo:

```text
SocketSession
SocketConnection
NotificationDelivery
RealtimeEvent
MessageDelivery
MessageReadReceipt
OnlinePresence
```

V13 không persist:

```text
socketId
roomId
deliveredAt
deliveryStatus
deliveryAck
lastSeen
onlineUsers
typingUsers
```

---

## 14.2. Không thêm unread counter

Không thêm:

```text
User.unreadNotificationCount
Notification.isRead
```

Unread được xác định bằng:

```text
Notification.readAt = null
```

---

## 14.3. Không thêm Notification state không thuộc Product

Không thêm:

```text
archivedAt
deletedAt
expiresAt
isArchived
isDeleted
priority
categoryBadge
preferenceState
```

V13 cũng không bổ sung:

```text
InterviewSchedule.status = COMPLETED
INTERVIEW_SCHEDULE_COMPLETED
```

---

## 14.4. Không thêm realtime mode vào Conversation

Không thêm:

```text
Conversation.status
Conversation.mode
Conversation.isReadOnly
Conversation.pausedAt
```

chỉ để phục vụ V13 realtime.

Current Conversation behavior tiếp tục derive từ Application/Assignment lifecycle của V11.

---

## 14.5. Không thêm Message delivery/read fields

Không thêm vào `Message`:

```text
readAt
isRead
deliveredAt
notificationId
socketEventId
```

---

## 14.6. Không thêm duplicate resource references

Không thêm vào Notification:

```text
conversationId
candidateAvailabilityId
jobId
companyId
recipientCompanyMemberId
```

khi Product Specification không cần chúng.

---

## 14.7. Không thêm retry telemetry vào canonical persistence

Không thêm chỉ cho V13:

```text
retryCount
lastAttemptAt
lastError
nextRetryAt
```

Product yêu cầu eventual recovery nhưng không yêu cầu canonical persistence của retry telemetry.

Cách điều phối retry thuộc Engineering Contract.

---

## 14.8. Không thêm external delivery persistence

Không thêm persistence phục vụ:

* email Notification;
* mobile push;
* SMS;
* external webhook.

Các capability này ngoài phạm vi V13.

---

# 15. Compatibility với version trước

## 15.1. V12 không persist Notification

Canonical V12 Product/Data không có Notification persistence, Notification API hoặc Notification realtime.

Không có persisted Notification từ V12 cần migration, type normalization hoặc `content` backfill.

---

## 15.2. Entity mới của V13

V13 giới thiệu mới:

```text
Notification
NotificationEvent
```

Mọi Notification V13 có `eventId` required và tham gia unique constraint:

```text
{ eventId: 1, recipientUserId: 1 }
```

`eventId` luôn required và unique index áp dụng cho toàn bộ Notification.

---

## 15.3. `applicationId`

Mọi Notification V13 giữ:

```text
applicationId = required
```

Không đổi thành optional. Job Invitation Notification đã được defer khỏi V13.

---

## 15.4. Message

`Message` giữ nguyên schema/lifecycle V11.

V13 không:

* thêm Notification id vào Message;
* thêm read receipt;
* thêm delivery status;
* thêm Socket metadata.

---

## 15.5. Conversation

`Conversation` giữ nguyên persistence contract V11.

Không persist V13-specific Conversation realtime mode.

---

## 15.6. Application

`Application` giữ nguyên canonical V10–V12 fields và state model.

V13 không dùng Notification để thay thế:

* `candidateUserId`;
* `jobId`;
* `assignedRecruiterCompanyMemberId`;
* `status`;
* Assignment state;
* terminal state.

---

## 15.7. CandidateAvailability

Không sửa current-set persistence semantics V12.

First-submit Notification không tạo Availability history hoặc additional snapshot.

---

## 15.8. InterviewSchedule

Không sửa:

* Schedule status;
* version;
* creator identity;
* events/history;
* Application relation.

V13 chỉ persist Notification obligations sau successful V12 transition.

---

## 15.9. Job Invitation artifact

Nếu macro hoặc branch khác đã chứa:

```text
JobInvitation
Application.source = RECRUITER_INVITATION
sourceInvitationId
sourceRecruiterCompanyMemberId
```

V13 không được coi những field/entity đó là thay đổi do V13.

Nếu chúng chưa tồn tại trong canonical persistence version trước, V13 không thêm chúng.

Nếu chúng đã tồn tại do một canonical version khác, V13 để nguyên và không sử dụng chúng cho Notification V13.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng.

1. Mỗi `Notification` có đúng một `recipientUserId`.

2. Mọi Notification V13 có `applicationId`.

3. Mọi Notification V13 có `eventId`.

4. `Notification.type` chỉ thuộc canonical V13 durable Notification enum.

5. Job Invitation type không tồn tại trong V13 Notification enum.

6. Conversation realtime-only state không tồn tại trong V13 Notification enum.

7. `APPLICATION_UNASSIGNED` tồn tại như durable Notification type.

8. `INTERVIEW_AVAILABILITY_SUBMITTED` tồn tại như durable Notification type.

9. Schedule `CANCELLED` dùng `INTERVIEW_SCHEDULE_CHANGED`.

10. `Notification.applicationId` không optional trong V13.

11. `CHAT_MESSAGE_CREATED` phải có `messageId`.

12. Schedule Notification phải có `interviewScheduleId`.

13. Application/Availability Notification không có `messageId` hoặc `interviewScheduleId` không liên quan.

14. Một `NotificationEvent` có ít nhất một recipient snapshot.

15. Recipient User không được xuất hiện hai lần trong cùng một event.

16. Recipient snapshot bất biến sau source event commit.

17. Recipient không được recompute khi eventual recovery xảy ra.

18. Historical content snapshot bất biến.

19. `eventKey` duy nhất trên `NotificationEvent`.

20. Cùng một logical event qua retry phải giữ cùng logical identity.

21. Một cặp:

```text
eventId + recipientUserId
```

chỉ có tối đa một Notification.

22. `NotificationEvent.materializedAt` chỉ có giá trị khi mọi required Notification đã tồn tại.

23. Partial Notification materialization là persistence state hợp lệ.

24. Partial materialization không rollback source business mutation.

25. Required Notification thiếu phải có durable `NotificationEvent` để recovery tiếp tục.

26. Source business transition yêu cầu Notification và durable event obligation không được commit tách rời.

27. Notification document không bắt buộc phải tồn tại trong cùng source transaction.

28. Notification realtime không được phát trước khi durable Notification tương ứng tồn tại.

29. Socket emit failure không xóa durable Notification.

30. Socket emit failure không rollback source business state.

31. `Notification.readAt = null` nghĩa là unread.

32. `readAt` chỉ transition:

```text
null
→ Date
```

33. Không transition `readAt` về `null`.

34. User chỉ được thay đổi read state của Notification có `recipientUserId` là chính User đó.

35. Notification ownership không cấp resource authorization.

36. `Notification.actorUserId` không phải authorization source.

37. `NotificationEvent.actorUserId` không phải recipient source khi recovery.

38. Recruiter recipient được resolve thành User trước khi snapshot event được persist.

39. Không persist CompanyMember làm owner của Notification.

40. Notification inbox của một User có thể chứa Application thuộc nhiều Company.

41. Cross-tenant Message/Schedule/Application references không được tồn tại trong cùng Notification/Event.

42. V13 không persist unread counter trong User.

43. V13 không persist Socket session, presence hoặc delivery receipt.

44. V13 không thêm direct Conversation reference vào Notification.

45. V13 không thêm Job/Company duplicate reference vào Notification.

46. V13 không sửa Message, Conversation, Application, CandidateAvailability hoặc InterviewSchedule schema chỉ để phục vụ realtime.

47. V13 persistence design không được kéo Job Invitation trở lại business scope.

---

# 17. Definition of Data Completion

V13 Data Contract được coi là hoàn thành khi:

* `Notification` mới đã được xác định;
* `NotificationEvent` đã được xác định;
* mọi canonical Notification type đã được xác định;
* `APPLICATION_UNASSIGNED` đã được persistence support;
* `INTERVIEW_AVAILABILITY_SUBMITTED` đã được persistence support;
* Job Invitation type/reference không nằm trong V13;
* `applicationId` vẫn required;
* Message và Schedule reference matrix đã rõ;
* recipient/content snapshot contract đã rõ;
* logical event identity đã rõ;
* deduplication constraint đã rõ;
* eventual materialization state đã rõ;
* Notification read state đã rõ;
* index phục vụ inbox, unread, recovery và dedupe đã được xác định;
* source transition → NotificationEvent persistence consequence đã được xác định;
* transaction boundary giữa source state và durable obligation đã rõ;
* durable Notification được xác định là eventual materialization, không thuộc source transaction bắt buộc;
* partial materialization được xác định là hợp lệ và recoverable;
* constraint ownership giữa schema/database/service/transaction đã rõ;
* multi-tenant ownership đã rõ;
* V12 không có Notification cần migrate hoặc backfill;
* mọi Notification V13 có `eventId` required và dùng unique event-recipient index;
* các entity V09–V12 không bị thay đổi ngoài requirement V13;
* toàn bộ Explicitly Excluded Persistence không bị implementation ngoài ý muốn;
* mọi persistence invariant có enforcement owner phù hợp.

Data Completion không đồng nghĩa schema đã được code.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự suy đoán business hoặc persistence architecture quan trọng.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V13.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entity/collection;
* fields;
* embedded recipient snapshot;
* references;
* relationships;
* cardinality;
* enums;
* indexes;
* uniqueness;
* persistence state;
* persistence transitions;
* transaction/atomicity requirement;
* persistence invariants;
* constraint ownership;
* migration compatibility.

Tài liệu này **không định nghĩa**:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request body;
* response body;
* controller;
* route;
* middleware implementation;
* service function structure;
* database query cụ thể;
* MongoDB/Mongoose method cụ thể;
* Socket event payload cụ thể;
* Socket room topology;
* retry worker;
* scheduler;
* queue technology;
* cách encode `eventKey`;
* cách dispatch recovery;
* source-code structure;
* UI behavior;
* frontend flow;
* test framework.

---

## 18.1. Atomicity boundary

Canonical V13 chỉ yêu cầu atomicity đối với persisted state trong database của hệ thống.

```text
Source persisted business result
+
NotificationEvent durable obligation
=
database atomic boundary
```

Sau đó:

```text
Notification materialization
=
eventual persistence
```

Realtime delivery xảy ra sau durable state phù hợp và nằm ngoài database atomic completion.

Không suy diễn contract này thành:

* distributed transaction;
* exactly-once Socket delivery;
* exactly-once external side effect;
* SMTP transaction;
* Cloudinary transaction;
* push-provider transaction;
* SMS-provider transaction.

---

## 18.2. Authority

```text
Approved Product Spec
→ business truth

Approved V13 Data Contract
→ persistence truth

Engineering Contracts
→ architecture / coordination truth

Implementation
→ actual code

Tests
→ implementation evidence

Macro database / diagram / raw draft
→ input material only
```

Nếu macro database hoặc implementation mâu thuẫn với Product Specification:

```text
Product Specification thắng
```

Nếu implementation mâu thuẫn với Data Contract nhưng không phải business conflict:

```text
Data Contract thắng
```

cho tới khi canonical contract được con người cập nhật và phê duyệt lại.
