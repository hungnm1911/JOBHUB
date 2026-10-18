# V11 — Conversation và Chat thuộc Application Data Model

> **File:** `docs/data/versions/v11-application-conversation-chat-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v11-application-conversation-chat.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v11-application-conversation-chat.md
```

Product Specification là authority đối với business behavior.

Data Contract V11 xác định:

* entity/collection cần bổ sung;
* dữ liệu Conversation và Message cần persist;
* relationship giữa Conversation, Message và Application;
* cách giữ historical sender identity;
* cách persistence phân biệt Application chưa từng có Conversation với Application đã từng có Conversation nhưng hiện `UNASSIGNED`;
* representation của Conversation operational mode;
* persistence transition khi First Assign, Reassign, Take over, Unassign, Automatic Unassign và Assign lại;
* persistence consequence khi Application terminal hoặc Company lock;
* index và uniqueness cần thiết;
* transaction/atomicity requirement để Assignment State và required SYSTEM Message không tách rời;
* consistency requirement giữa Send Message và current Application/eligibility/lifecycle state;
* boundary giữa constraint do database/schema bảo vệ và constraint do service bảo vệ;
* multi-tenant data ownership.

Transaction/atomicity trong tài liệu này chỉ áp dụng cho persisted state thuộc database của hệ thống.

V11 không yêu cầu distributed transaction hoặc exactly-once guarantee với external system.

Nếu Data Model mâu thuẫn với Product Specification, Product Specification giữ authority và Data Model phải được sửa.

---

## 2. Thay đổi so với version trước

| Entity / Collection | Trạng thái  | Mô tả                                                                                                                |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `applications`      | `UPDATED`   | Không bổ sung field V11 nhưng mở rộng persistence transition để phối hợp với Conversation, Message và Chat authority |
| `conversations`     | `NEW`       | Lưu Conversation chính thuộc một Application                                                                         |
| `messages`          | `NEW`       | Lưu NORMAL và SYSTEM Message thuộc Conversation                                                                      |
| `users`             | `UNCHANGED` | Được dùng để xác định Candidate owner, Recruiter User và historical sender                                           |
| `company_members`   | `UNCHANGED` | Được dùng để xác định Recruiter membership, eligibility và historical Recruiter sender                               |
| `jobs`              | `UNCHANGED` | Được dùng để resolve owning Company và current Recruitment Team                                                      |
| `companies`         | `UNCHANGED` | Được dùng để resolve tenant và Company operational state                                                             |

### 2.1. Entity mới

* `Conversation`
* `Message`

### 2.2. Entity được mở rộng về persistence behavior

* `Application`

V11 không yêu cầu thêm field vào Application.

Application tiếp tục giữ các dữ liệu canonical từ V10, bao gồm:

```text
candidateUserId
jobId
assignedRecruiterCompanyMemberId
status
version
```

hoặc representation canonical tương đương đã được V10 phê duyệt.

V11 chỉ bổ sung cross-entity persistence invariant và transition liên quan Conversation/Message.

### 2.3. Entity giữ nguyên nhưng được sử dụng

* `User`
* `CompanyMember`
* `Job`
* `Company`

Không thay đổi schema của các entity này chỉ để phục vụ V11.

---

## 3. Collection / Entity tổng thể

V11 sử dụng:

```text
users
companies
company_members
jobs
applications
conversations
messages
```

Vai trò tổng quát:

| Entity / Collection | Responsibility                                                   |
| ------------------- | ---------------------------------------------------------------- |
| `users`             | Identity của Candidate và Recruiter User                         |
| `companies`         | Canonical tenant và Company operational state                    |
| `company_members`   | Company membership và Recruiter lifecycle/eligibility            |
| `jobs`              | Job owning Company và Recruitment Team context                   |
| `applications`      | Candidate ownership, Job, Recruitment Status và current Assignee |
| `conversations`     | Conversation chính duy nhất của một Application                  |
| `messages`          | Historical NORMAL/SYSTEM Message của Conversation                |

Không tạo thêm collection như:

```text
conversation_participants
conversation_members
chat_sessions
chat_status_history
assignment_chat_history
conversation_audit
```

trong V11.

---

## 4. Quan hệ dữ liệu

Quan hệ tổng thể:

```text
User 1 ───── 0..N Message
                   ↑
                   │ senderUserId

CompanyMember 1 ── 0..N Message
                   ↑
                   │ senderCompanyMemberId

Application 1 ───── 0..1 Conversation

Conversation 1 ──── 0..N Message

Job 1 ───────────── 0..N Application

Company 1 ───────── 0..N Job
```

---

### 4.1. Application → Conversation

**Cardinality**

```text
Application 1 ───── 0..1 Conversation
```

**Owner của relationship**

`Conversation`

**Reference**

```text
Conversation.applicationId
```

**Constraint**

* required;
* immutable sau khi tạo;
* unique trên toàn bộ Conversation;
* một Conversation không được tồn tại ngoài Application;
* một Application không được có hơn một Conversation.

**Lifecycle**

Conversation được tạo tại First Assign.

Sau khi tạo, Conversation được giữ khi:

* Reassign;
* Take over;
* Manual Unassign;
* Automatic Unassign;
* Assign lại;
* Application terminal;
* Job `CLOSED`;
* Job `EXPIRED`;
* Assignee cũ mất quyền.

Conversation không được chuyển từ Application này sang Application khác.

---

### 4.2. Conversation → Message

**Cardinality**

```text
Conversation 1 ───── 0..N Message
```

**Owner**

`Message`

**Reference**

```text
Message.conversationId
```

**Constraint**

* required;
* immutable;
* Message chỉ thuộc đúng một Conversation;
* một Conversation có thể có `0` Message.

`0 Message` là hợp lệ vì First Assign tạo Conversation nhưng không tạo SYSTEM Message.

---

### 4.3. User → Message

**Cardinality**

```text
User 1 ───── 0..N Message
```

**Reference**

```text
Message.senderUserId
```

Reference này lưu historical sender identity.

Nó không dùng để xác định current Chat authority.

---

### 4.4. CompanyMember → Message

**Cardinality**

```text
CompanyMember 1 ───── 0..N Message
```

**Reference**

```text
Message.senderCompanyMemberId
```

Reference này chỉ tồn tại đối với NORMAL Message do Recruiter gửi.

Nó lưu tư cách CompanyMember thực tế của Recruiter tại thời điểm gửi.

Reference lịch sử không cấp quyền truy cập Conversation về sau.

---

### 4.5. Conversation không trực tiếp reference Candidate

Không thêm:

```text
Conversation.candidateUserId
```

Candidate được resolve:

```text
Conversation
→ Application
→ candidateUserId
```

Application tiếp tục là source of truth.

---

### 4.6. Conversation không trực tiếp reference current Assignee

Không thêm:

```text
Conversation.assignedRecruiterCompanyMemberId
```

Current Assignee được resolve:

```text
Conversation
→ Application
→ assignedRecruiterCompanyMemberId
```

Điều này cho phép:

```text
A → B
A → NONE
NONE → B
```

mà không cần rewrite participant data trong Conversation.

---

### 4.7. Conversation không trực tiếp reference Job hoặc Company

Không thêm:

```text
Conversation.jobId
Conversation.companyId
```

Ownership được resolve:

```text
Conversation
→ Application
→ Job
→ Company
```

---

### 4.8. Không lưu relationship hai chiều Application ↔ Conversation

Không thêm:

```text
Application.conversationId
```

Canonical relationship chỉ lưu một phía:

```text
Conversation.applicationId
```

Unique constraint trên `Conversation.applicationId` bảo vệ cardinality `0..1`.

---

## 5. Conversation

### 5.1. Responsibility

Conversation chịu trách nhiệm lưu:

* identity của Conversation;
* Application mà Conversation thuộc về;
* thời điểm Conversation được tạo.

Conversation không chịu trách nhiệm lưu:

* Candidate;
* current Assignee;
* participant list;
* Recruitment Status;
* Assignment State;
* Company;
* Job;
* Recruitment Team;
* Conversation operational mode;
* read-only flag;
* last Assignee;
* previous Assignee;
* unread count;
* last seen;
* typing state;
* notification state.

---

### 5.2. Fields

| Field           | Type       | Required | Default   | Constraint                               | Ý nghĩa                         |
| --------------- | ---------- | -------: | --------- | ---------------------------------------- | ------------------------------- |
| `_id`           | `ObjectId` |      YES | generated | unique                                   | Định danh Conversation          |
| `applicationId` | `ObjectId` |      YES | —         | reference Application, immutable, unique | Application sở hữu Conversation |
| `createdAt`     | `Date`     |      YES | automatic | immutable business creation time         | Thời điểm Conversation được tạo |

V11 không yêu cầu mutable Conversation state nên không cần field cập nhật nghiệp vụ riêng.

---

### 5.3. Enum

Conversation không persist enum state mới trong V11.

Các business mode:

```text
NOT_CREATED
ACTIVE
PAUSED_UNASSIGNED
FROZEN_COMPANY
READ_ONLY
```

được derive từ canonical persisted state liên quan.

Không persist:

```text
Conversation.status
Conversation.chatState
Conversation.isReadOnly
```

trong V11.

---

### 5.4. Indexes

| Index                  | Loại   | Mục đích                                                                                  |
| ---------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `{ applicationId: 1 }` | Unique | Bảo vệ một Application có tối đa một Conversation và lookup Conversation theo Application |

Không thêm index theo:

* Candidate;
* Assignee;
* Company;
* Job;

vì các relationship này không được duplicate vào Conversation.

---

### 5.5. Embedded documents

> Conversation không sử dụng embedded document mới trong V11.

---

### 5.6. Reference rules

| Field           | Reference     | Required | Cardinality | Rule                                             |
| --------------- | ------------- | -------: | ----------- | ------------------------------------------------ |
| `applicationId` | `Application` |      YES | N → 1       | Conversation bắt buộc thuộc đúng một Application |

Database/schema bảo vệ reference shape và uniqueness.

Việc Application có tồn tại, có thuộc canonical tenant hợp lệ và Conversation có được phép tạo tại current business state hay không thuộc service/transaction responsibility.

---

## 6. Message

### 6.1. Responsibility

Message chịu trách nhiệm lưu:

* Conversation mà Message thuộc về;
* loại Message;
* nội dung Message;
* historical sender User nếu có;
* historical sender CompanyMember nếu có;
* thời điểm Message được ghi nhận.

Message không chịu trách nhiệm lưu:

* current Assignee;
* Candidate owner;
* Company;
* Job;
* current Conversation authorization;
* read receipt;
* delivery status;
* notification status;
* current Message visibility per actor;
* Assignment History.

---

### 6.2. Fields

| Field                   | Type               | Required | Default   | Constraint                         | Ý nghĩa                             |
| ----------------------- | ------------------ | -------: | --------- | ---------------------------------- | ----------------------------------- |
| `_id`                   | `ObjectId`         |      YES | generated | unique                             | Định danh Message                   |
| `conversationId`        | `ObjectId`         |      YES | —         | reference Conversation, immutable  | Conversation sở hữu Message         |
| `type`                  | `String`           |      YES | —         | enum `NORMAL/SYSTEM`, immutable    | Loại Message                        |
| `senderUserId`          | `ObjectId \| null` |       NO | `null`    | reference User, immutable          | User thực tế gửi NORMAL Message     |
| `senderCompanyMemberId` | `ObjectId \| null` |       NO | `null`    | reference CompanyMember, immutable | Recruiter membership thực tế đã gửi |
| `content`               | `String`           |      YES | —         | immutable                          | Nội dung Message                    |
| `createdAt`             | `Date`             |      YES | automatic | immutable                          | Thời điểm Message được ghi nhận     |

Không có `updatedAt` thuộc V11 vì V11 không có Message edit lifecycle.

---

### 6.3. Enum

#### `Message.type`

```text
NORMAL
SYSTEM
```

| Giá trị  | Ý nghĩa                                                                           |
| -------- | --------------------------------------------------------------------------------- |
| `NORMAL` | Message do Candidate hoặc current Assigned Recruiter gửi                          |
| `SYSTEM` | Message do hệ thống tạo cho responsibility transition được Product V11 định nghĩa |

Không thêm subtype như:

```text
ASSIGNED
REASSIGNED
UNASSIGNED
AUTO_UNASSIGNED
RESUMED
```

trong V11.

SYSTEM Message chỉ cần persist historical Conversation content; nó không phải Assignment History machine state.

---

### 6.4. Sender state matrix

| Message            | `senderUserId` | `senderCompanyMemberId` |
| ------------------ | -------------- | ----------------------- |
| Candidate `NORMAL` | Candidate User | `null`                  |
| Recruiter `NORMAL` | Recruiter User | Recruiter CompanyMember |
| `SYSTEM`           | `null`         | `null`                  |

Schema có thể bảo vệ local structural rules:

```text
SYSTEM
→ senderUserId = null
→ senderCompanyMemberId = null

NORMAL
→ senderUserId != null
```

Việc NORMAL Message là Candidate hay Recruiter hợp lệ không thể chỉ xác định bằng local Message document và thuộc service responsibility.

---

### 6.5. Indexes

| Index                                  | Loại     | Mục đích                                                |
| -------------------------------------- | -------- | ------------------------------------------------------- |
| `{ conversationId: 1, createdAt: -1 }` | Compound | Lấy Message history của một Conversation theo thời gian |

Không thêm index theo sender vì V11 không có requirement query Message theo historical sender.

---

### 6.6. Embedded documents

> Message không sử dụng embedded document mới trong V11.

---

### 6.7. Reference rules

| Field                   | Reference       |    Required | Cardinality | Rule                                    |
| ----------------------- | --------------- | ----------: | ----------- | --------------------------------------- |
| `conversationId`        | `Conversation`  |         YES | N → 1       | Message bắt buộc thuộc một Conversation |
| `senderUserId`          | `User`          | Conditional | N → 1       | Historical sender User                  |
| `senderCompanyMemberId` | `CompanyMember` | Conditional | N → 1       | Chỉ dùng cho Recruiter NORMAL Message   |

Historical sender reference không bị rewrite khi:

* Reassign;
* Unassign;
* Recruiter bị lock;
* Recruiter bị terminate;
* Recruiter rời Recruitment Team.

---

# 7. State Matrix

Conversation operational mode không được persist trực tiếp.

Nó được derive từ:

* Conversation có tồn tại hay không;
* `Application.status`;
* `Application.assignedRecruiterCompanyMemberId`;
* Company operational state;
* current Assignee eligibility khi kiểm tra Recruiter authority.

Trong Company-lock freeze và terminal history, persisted/final Assignee chỉ có
read authority khi `User = ACTIVE` và `CompanyMember = ACTIVE`. Current
Recruitment Team membership và Company operational không phải điều kiện của
historical read này; account lifecycle vẫn là điều kiện bắt buộc.

## 7.1. Canonical persisted-state matrix

| Conversation  | Application Status | Assignment   | Company                           | Mode dẫn xuất       | Hợp lệ                    |
| ------------- | ------------------ | ------------ | --------------------------------- | ------------------- | ------------------------- |
| Không tồn tại | Non-terminal       | `UNASSIGNED` | Operational                       | `NOT_CREATED`       | YES, nếu chưa từng Assign |
| Tồn tại       | Non-terminal       | `ASSIGNED`   | Operational                       | `ACTIVE`            | YES                       |
| Tồn tại | Non-terminal, Assignee vừa mất eligibility | `ASSIGNED` | Operational | Candidate chỉ đọc; Send bị khóa; outgoing Recruiter không đọc/gửi | YES, pending Automatic Unassign |
| Tồn tại       | Non-terminal       | `UNASSIGNED` | Operational                       | `PAUSED_UNASSIGNED` | YES                       |
| Tồn tại       | Non-terminal       | `ASSIGNED`   | Không operational do Company lock | `FROZEN_COMPANY`    | YES                       |
| Tồn tại       | Terminal           | `ASSIGNED`   | Bất kỳ                            | `READ_ONLY`         | YES                       |
| Tồn tại       | `WITHDRAWN`        | `UNASSIGNED` | Bất kỳ                            | `READ_ONLY`         | YES                       |
| Không tồn tại | `WITHDRAWN`        | `UNASSIGNED` | Bất kỳ                            | No Conversation     | YES nếu chưa từng Assign  |

### Không hợp lệ sau khi V11 business operation hoàn tất

```text
Conversation không tồn tại
+
Application đã được First Assign bởi V11
```

Không được tồn tại:

```text
Application current assignment transition yêu cầu SYSTEM Message
+
transition đã hoàn tất
+
required SYSTEM Message không tồn tại
```

Không được persist:

```text
Conversation.status = ACTIVE/PAUSED/READ_ONLY
```

vì V11 không thêm field state này.

---

## 7.2. First Assign và Assign lại được phân biệt bằng Conversation existence

Canonical distinction:

```text
Application = UNASSIGNED
Conversation không tồn tại
→ First Assign
```

```text
Application = UNASSIGNED
Conversation đã tồn tại
→ Assign lại
```

Không dùng historical Assignment collection để phân biệt hai trường hợp.

---

# 8. Persistence Transitions

## 8.1. First Assign

### Trigger business

* Product `F01`
* `BR-04`
* `BR-05`
* `BR-06`

### Trước

```text
Application:
assignedRecruiterCompanyMemberId = null
status = non-terminal

Conversation:
không tồn tại cho Application
```

### Sau

```text
Application:
assignedRecruiterCompanyMemberId = Recruiter A
status = giữ nguyên

Conversation:
applicationId = Application.id
createdAt = now

Message:
không tạo SYSTEM Message
```

### Entity bị thay đổi

* `Application`
* `Conversation`

### Entity không thay đổi

* Candidate
* Job
* Recruitment Status
* submittedCvSnapshot
* Recruitment Team

### Invariant

```text
First Assign success
→ Conversation phải tồn tại
```

---

## 8.2. Reassign A → B

### Trigger business

* `F03`
* `BR-15`–`BR-20`
* `BR-47`

### Trước

```text
Application.assignedRecruiterCompanyMemberId = A
Conversation tồn tại
Application non-terminal
```

### Sau

```text
Application.assignedRecruiterCompanyMemberId = B

Conversation:
giữ nguyên

Message:
thêm 1 SYSTEM Message phản ánh thay đổi người phụ trách
```

Historical NORMAL Message của A không thay đổi.

---

## 8.3. Take over

Persistence transition giống Reassign:

```text
Supporting A
→ Primary B
```

Application Assignee thay đổi.

Conversation giữ nguyên.

Một SYSTEM Message mới được thêm.

---

## 8.4. Manual Unassign

### Trigger business

* `F04`
* `BR-21`–`BR-25`
* `BR-47`

### Trước

```text
Application.assignedRecruiterCompanyMemberId = A
Application non-terminal
Conversation tồn tại
```

### Sau

```text
Application.assignedRecruiterCompanyMemberId = null
Application.status = giữ nguyên

Conversation:
giữ nguyên

Message:
thêm SYSTEM Message thông báo Application đang chờ người phụ trách mới
```

Mode dẫn xuất:

```text
PAUSED_UNASSIGNED
```

---

## 8.5. Automatic Unassign

### Trigger business

* `F05`
* V10 Automatic Unassign
* `BR-26`–`BR-28`
* `BR-55`
* `BR-47`

Đối với mỗi affected Application đã có Conversation:

### Trước

```text
Application.assignedRecruiterCompanyMemberId = A
Application non-terminal
Conversation tồn tại
```

### Sau

```text
Application.assignedRecruiterCompanyMemberId = null

Conversation:
giữ nguyên

Message:
thêm SYSTEM Message
```

Recruiter lifecycle reason không cần được persist vào SYSTEM Message như Assignment History metadata trong V11.

Ngay khi eligibility loss có hiệu lực, trước khi mutation `A → NONE` hoàn tất,
service phải thu hồi Send authority; Candidate chỉ được đọc history và outgoing
Recruiter không được đọc/gửi. Window này không thêm field hoặc enum persisted
mới vào Conversation.

Nếu affected Application chưa từng có Conversation, V11 không tạo Conversation chỉ vì Automatic Unassign.

---

## 8.6. Assign lại sau Unassign

### Trigger business

* `F06`
* `BR-29`
* `BR-30`
* `BR-47`

### Trước

```text
Application.assignedRecruiterCompanyMemberId = null
Application non-terminal
Conversation tồn tại
```

### Sau

```text
Application.assignedRecruiterCompanyMemberId = B

Conversation:
giữ nguyên

Message:
thêm SYSTEM Message thông báo người phụ trách mới
```

Mode dẫn xuất:

```text
PAUSED_UNASSIGNED
→ ACTIVE
```

Không tạo Conversation thứ hai.

---

## 8.7. Candidate / Recruiter gửi NORMAL Message

### Trigger business

* `F02`
* `BR-07`–`BR-14`

### Trước

Phải chứng minh current persisted state vẫn thỏa:

```text
Conversation tồn tại
Application non-terminal
Application ASSIGNED
Company operational
```

và sender authority tương ứng.

### Sau

```text
Message mới:
type = NORMAL
conversationId = current Conversation
sender identity = actor thực tế
content = nội dung gửi
createdAt = now
```

Application và Conversation không đổi.

---

## 8.8. Company lock

### Trigger business

* `F07`
* `BR-31`–`BR-33`

### Trước

```text
Company operational
Application ASSIGNED
Conversation tồn tại
```

### Sau

Company canonical state thay đổi theo Company lifecycle.

V11 không mutate:

```text
Application.assignedRecruiterCompanyMemberId
Conversation
Message history
```

Mode được derive thành:

```text
FROZEN_COMPANY
```

Không tạo SYSTEM Message chỉ vì Company lock.

---

## 8.9. Application terminal

### Trigger business

* `F08`
* `BR-34`–`BR-38`

Khi Application chuyển:

```text
HIRED
REJECTED
WITHDRAWN
```

không update Conversation document.

Conversation mode được derive thành:

```text
READ_ONLY
```

Message history giữ nguyên.

Không tạo generic terminal SYSTEM Message trong V11 vì Product Specification không yêu cầu.

---

## 8.10. Withdraw trước First Assign

### Trước

```text
Application:
APPLIED
UNASSIGNED

Conversation:
không tồn tại
```

### Sau

```text
Application:
WITHDRAWN
UNASSIGNED

Conversation:
vẫn không tồn tại
```

Không tạo Conversation.

---

# 9. Transaction / Atomicity Requirements

Chỉ các workflow có cross-document invariant hoặc race-sensitive completion mới yêu cầu atomicity.

V11 không yêu cầu transaction cho read-only retrieval đơn thuần.

---

## TX-01 — First Assign + Conversation creation

**Business source**

* `F01`
* `BR-05`
* `BR-06`

Trong cùng atomic business completion:

1. xác nhận First Assign vẫn hợp lệ theo V10;
2. cập nhật Application Assignee;
3. tạo Conversation duy nhất cho Application.

Sau commit:

```text
Application ASSIGNED(A)
AND
Conversation(applicationId = Application.id) tồn tại
```

Không được xuất hiện:

```text
Application đã First Assign thành công
nhưng
Conversation chưa tồn tại
```

hoặc:

```text
Conversation đã được tạo
nhưng
First Assign thất bại
```

Không tạo SYSTEM Message trong TX-01.

---

## TX-02 — Reassign / Take over + SYSTEM Message

**Business source**

* `F03`
* `BR-18`
* `BR-47`

Trong cùng atomic business completion:

1. xác nhận expected current Assignee và V10 eligibility;
2. thay current Assignee `A → B`;
3. giữ Conversation;
4. thêm required SYSTEM Message.

Sau commit:

```text
Application.assignee = B
AND
required SYSTEM Message tồn tại
```

Không được xuất hiện partial state:

```text
Application.assignee = B
nhưng thiếu SYSTEM Message
```

hoặc:

```text
SYSTEM Message nói responsibility đã đổi
nhưng Application vẫn ở A
```

---

## TX-03 — Manual Unassign + SYSTEM Message

**Business source**

* `F04`
* `BR-21`–`BR-25`
* `BR-47`

Trong cùng atomic completion:

1. xác nhận current Assignee expected;
2. chuyển `A → NONE`;
3. giữ Conversation;
4. thêm required SYSTEM Message.

Sau commit:

```text
Application.assignee = null
AND
SYSTEM Message Unassign tồn tại
```

---

## TX-04 — Automatic Unassign + SYSTEM Message

**Business source**

* `F05`
* `BR-26`–`BR-28`
* `BR-47`

Đối với mỗi affected Application đã có Conversation, Automatic Unassign và required SYSTEM Message phải tạo thành một atomic per-Application business outcome.

Sau completion của affected Application:

```text
Application.assignee = null
AND
required SYSTEM Message tồn tại
```

Nếu Application chưa từng có Conversation, V11 không yêu cầu tạo Conversation hoặc Message.

V11 không tự nâng requirement này thành một distributed/global transaction cho toàn bộ recruiter lifecycle.

Broader lifecycle atomicity tiếp tục thuộc canonical V10 contracts.

---

## TX-05 — Assign lại + SYSTEM Message

**Business source**

* `F06`
* `BR-29`
* `BR-30`
* `BR-47`

Trong cùng atomic completion:

1. xác nhận Application vẫn `UNASSIGNED`;
2. xác nhận Conversation đã tồn tại;
3. Assign target B theo V10;
4. thêm required SYSTEM Message.

Sau commit:

```text
Application.assignee = B
AND
same Conversation vẫn tồn tại
AND
required SYSTEM Message tồn tại
```

Không tạo Conversation mới.

---

## TX-06 — NORMAL Message authority + Message creation

**Business source**

* `F02`
* `F10`
* `BR-14`
* `BR-41`–`BR-46`

Send completion phải được bảo vệ để Message chỉ được ghi nhận nếu authority/state dùng để cho phép Send vẫn còn current tại thời điểm business completion.

Eligibility loss là state-invalidating transition cho Send ngay khi có hiệu lực;
không được chờ automatic-Unassign persistence completion. Trong khoảng đó,
Candidate được đọc history nhưng không được gửi, còn outgoing Recruiter không
được đọc hoặc gửi.

Việc kiểm tra và ghi Message phải phối hợp với các concurrent transition có thể làm mất quyền:

* Reassign;
* Take over;
* Manual Unassign;
* Automatic Unassign;
* Assignee eligibility loss;
* Company lock;
* terminal Application transition.

Không được xảy ra:

```text
state-invalidating transition đã hoàn tất
↓
stale Send vẫn tạo NORMAL Message
```

Message đã hoàn tất hợp lệ trước state-invalidating transition được giữ.

TX-06 không quy định một kỹ thuật locking cụ thể.

Implementation phải sử dụng concurrency coordination tương thích với canonical V10 state/version protection.

---

## TX-07 — Terminal transition ↔ Message creation

Application terminal transition và Send phải bảo vệ ordering:

```text
Message success trước terminal
→ Message được giữ

terminal success trước Message
→ Message không được tạo
```

V11 không yêu cầu update Conversation document khi terminal.

---

## TX-08 — Company lock ↔ Message creation

Company lock và Send phải bảo vệ ordering:

```text
Message hoàn tất hợp lệ trước Company lock
→ giữ Message

Company lock có hiệu lực trước Send completion
→ không tạo Message
```

Không update Conversation hoặc Assignee chỉ để thực hiện freeze.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema chỉ bảo vệ constraint có đủ local context.

| Constraint                              | Owner    | Lý do                                      |
| --------------------------------------- | -------- | ------------------------------------------ |
| `Conversation.applicationId` required   | Schema   | Structural field                           |
| `Conversation.applicationId` unique     | Database | Bảo vệ cardinality 0..1                    |
| `Conversation.applicationId` immutable  | Schema   | Conversation không được chuyển Application |
| `Message.conversationId` required       | Schema   | Structural relationship                    |
| `Message.conversationId` immutable      | Schema   | Message không đổi Conversation             |
| `Message.type` thuộc `NORMAL/SYSTEM`    | Schema   | Local enum                                 |
| `Message.type` immutable                | Schema   | Message type không đổi                     |
| `Message.content` required              | Schema   | Message phải có persisted content          |
| Message content immutable               | Schema   | V11 không có edit lifecycle                |
| Sender references immutable             | Schema   | Historical sender không rewrite            |
| `SYSTEM → senderUserId = null`          | Schema   | Local document invariant                   |
| `SYSTEM → senderCompanyMemberId = null` | Schema   | Local document invariant                   |
| `NORMAL → senderUserId != null`         | Schema   | Local document invariant                   |
| `{ applicationId: 1 }` unique           | Database | Một Application tối đa một Conversation    |

Database/schema không tự xác định:

* User có phải Candidate owner hay không;
* CompanyMember có phải current Assignee hay không;
* CompanyMember có role Recruiter hay không;
* Company operational hay không;
* Application terminal hay non-terminal;
* Application hiện `UNASSIGNED` hay không trong context gửi Message;
* cross-tenant validity.

---

## 10.2. Service bảo vệ

| Constraint                                     | Owner                            | Lý do                            |
| ---------------------------------------------- | -------------------------------- | -------------------------------- |
| Conversation chỉ được tạo tại First Assign     | Service + transaction            | Cần Application state            |
| First Assign target hợp lệ                     | V10 service boundary             | Cross-document business rule     |
| Candidate sender phải là Application owner     | Service                          | Ownership                        |
| Recruiter sender phải là current Assignee      | Service                          | Cross-document relation          |
| Recruiter phải còn continuous eligibility      | Service                          | User/Member/Company/Team context |
| Persisted/final Recruiter phải có account access để đọc history | Service | `User` và `CompanyMember` đều `ACTIVE`; historical association không bypass lifecycle |
| Company phải operational để gửi                | Service                          | Cross-document lifecycle         |
| `UNASSIGNED` không được gửi Message            | Service                          | Application state                |
| Former Assignee không được đọc/gửi             | Service                          | Current authorization            |
| Primary không phải Assignee không được đọc/gửi | Service                          | Business authorization           |
| Company Manager không được đọc/gửi             | Service                          | Role boundary                    |
| Platform Admin không được đọc/gửi              | Service                          | Role boundary                    |
| Target Recruiter phải cùng tenant              | Service                          | Tenant boundary                  |
| Reassign/Unassign/Assign lại hợp lệ            | V10 service boundary             | Assignment state machine         |
| Required SYSTEM Message đúng transition        | Service + transaction            | Cross-document invariant         |
| Terminal Conversation không nhận Message       | Service + concurrency protection | Application lifecycle            |
| Company lock freeze Send                       | Service + concurrency protection | Company lifecycle                |
| SYSTEM Message không dùng làm authority source | Service                          | Business/data interpretation     |

---

## 10.3. Transaction / concurrency layer bảo vệ

Transaction hoặc canonical concurrency mechanism bảo vệ:

* First Assign ↔ Conversation creation;
* Reassign ↔ SYSTEM Message;
* Take over ↔ SYSTEM Message;
* Manual Unassign ↔ SYSTEM Message;
* Automatic Unassign ↔ SYSTEM Message;
* Assign lại ↔ SYSTEM Message;
* Send ↔ assignment mutation;
* Send ↔ lifecycle eligibility loss;
* Send ↔ Company lock;
* Send ↔ terminal transition.

Database unique constraint không thay thế business concurrency protection.

---

# 11. Token / TTL Lifecycle

> V11 không bổ sung token/TTL persistence mới.

Conversation và Message không có TTL.

Không tự động xóa Message theo thời gian trong V11.

---

# 12. Multi-tenant Data Boundary

### Canonical tenant key

Canonical tenant của Conversation/Message là Company sở hữu Job của Application:

```text
Conversation
→ Application
→ Job
→ Company
```

Message kế thừa tenant từ Conversation.

---

### Resource ownership

| Resource       | Tenant owner | Cách xác định                                          |
| -------------- | ------------ | ------------------------------------------------------ |
| `Application`  | Company      | `Application → Job → Company`                          |
| `Conversation` | Company      | `Conversation → Application → Job → Company`           |
| `Message`      | Company      | `Message → Conversation → Application → Job → Company` |

Candidate ownership là user-level ownership độc lập:

```text
Application.candidateUserId
```

---

### Backend tenant resolution

Recruiter-side:

```text
Authenticated User
        ↓
CompanyMember hiện tại
        ↓
Application current Assignee
        ↓
Job
        ↓
Company
        ↓
Conversation
```

Candidate-side:

```text
Authenticated Candidate
        ↓
Application.candidateUserId
        ↓
Conversation
```

Không thêm `companyId` vào Conversation/Message chỉ để rút ngắn authorization path.

---

### Cross-tenant constraint

Không được tồn tại hợp lệ một NORMAL Recruiter Message nếu:

```text
sender CompanyMember
```

không thuộc canonical Company của Application.

Không được dùng client-supplied:

```text
companyId
candidateUserId
assignedRecruiterId
senderUserId
senderCompanyMemberId
```

làm authorization source.

Historical sender fields phải được derive từ authenticated actor/current trusted relationships tại thời điểm gửi.

---

# 13. Snapshot / Historical Data

V11 không bổ sung snapshot entity mới.

Tuy nhiên Message tự thân là historical communication record.

Historical sender identity được giữ bằng sender references tại thời điểm Message được tạo.

Nguyên tắc:

```text
historical Message sender
!=
current Application Assignee
```

Khi Application đổi:

```text
A → B
A → NONE
NONE → B
```

Message cũ không thay sender.

V11 không bổ sung:

* Assignment snapshot;
* Candidate snapshot;
* Recruiter profile snapshot;
* Job snapshot;
* Company snapshot.

Nếu tên/avatar/job title của historical sender cần snapshot bất biến trong tương lai, đó là requirement của version khác.

---

# 14. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V11:

### Conversation fields

```text
Conversation.candidateUserId
Conversation.assignedRecruiterCompanyMemberId
Conversation.jobId
Conversation.companyId
Conversation.participantUserIds
Conversation.participantCompanyMemberIds
Conversation.status
Conversation.chatState
Conversation.isReadOnly
Conversation.lastAssigneeId
Conversation.previousAssigneeId
Conversation.unreadCount
Conversation.lastMessageId
Conversation.lastSeenAt
Conversation.closedAt
Conversation.reopenedAt
```

### Application fields

```text
Application.conversationId
Application.chatStatus
Application.lastChatAt
```

### Message fields

```text
Message.updatedAt
Message.editedAt
Message.deletedAt
Message.readAt
Message.deliveryStatus
Message.reaction
Message.attachment
Message.eventType
Message.previousAssigneeId
Message.newAssigneeId
```

### Collections

```text
conversation_participants
conversation_members
conversation_status_history
message_reads
message_reactions
chat_notifications
assignment_history
chat_audit
```

### Persistence capability

Không thêm:

* TTL cho Message;
* automatic Message cleanup;
* Assignment History trá hình thông qua SYSTEM Message metadata;
* future realtime state;
* online/offline persistence;
* typing persistence;
* Notification persistence;
* Interview Schedule persistence;
* Invitation persistence.

Không thêm field/collection chỉ để “phòng sau này cần”.

---

# 15. Compatibility với version trước

## 15.1. Invariant V10 phải giữ

V11 phải tiếp tục giữ:

* một Application có tối đa một current Assignee;
* Recruitment Status và Assignment State độc lập;
* Assign không tự đổi Recruitment Status;
* Reassign không tự đổi Recruitment Status;
* Unassign không tự đổi Recruitment Status;
* Assign lại không tự đổi Recruitment Status;
* `UNASSIGNED` hợp lệ ở mọi non-terminal Recruitment Status;
* terminal Application không thay Assignee;
* current Assignee phải thỏa continuous eligibility để xử lý;
* Company Manager có assignment-management authority;
* Company Manager không có pipeline authority;
* Automatic Unassign xảy ra khi canonical V10 eligibility-loss trigger xảy ra;
* Company lock giữ persisted assignment;
* Job `CLOSED` / `EXPIRED` không kết thúc Application;
* stale Application operation không overwrite newer business state.

---

## 15.2. Persistence behavior phải giữ

Application tiếp tục là source of truth cho:

```text
candidateUserId
jobId
status
assignedRecruiterCompanyMemberId
version
```

hoặc canonical representation tương đương của V10.

V11 không tạo duplicate current-assignment state trong Conversation.

---

## 15.3. Thay đổi được phép

V11 được phép mở rộng persistence completion của V10 assignment transitions:

```text
First Assign
→ tạo Conversation

A → B
→ required SYSTEM Message

A → NONE
→ required SYSTEM Message

NONE → B sau khi Conversation tồn tại
→ required SYSTEM Message
```

V11 không thay đổi chính Assignment State transition.

Nó chỉ bổ sung persisted Conversation consequence.

---

## 15.4. Thay đổi không được phép

V11 không được:

* thay V10 Assignment authority;
* bỏ Company Manager assignment-management authority;
* cấm Unassign;
* tự tạo Assignee history làm source of truth;
* tự thay Recruitment Team;
* tự thay Application status;
* tự biến Company lock thành Unassign;
* tự dùng Conversation state thay Application state;
* tự tạo historical Chat authority cho Former Assignee.

---

## 15.5. Existing pre-V11 persisted data

Product Specification không định nghĩa business migration/backfill policy cho dataset đã tồn tại trước khi V11 được áp dụng.

Data Contract này không tự bổ sung một migration behavior mới.

Canonical persisted state sau khi V11 được coi là hoàn thành phải tuân theo các invariant của tài liệu này.

Chiến lược rollout hoặc normalization của pre-V11 data, nếu cần trong môi trường triển khai, thuộc engineering/deployment planning và không được dùng để thay đổi Product behavior.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở canonical persisted state của V11:

1. Mỗi Conversation bắt buộc thuộc đúng một Application.
2. Một Application có tối đa một Conversation.
3. Conversation không đổi Application sau khi tạo.
4. First Assign thành công theo V11 phải có Conversation tương ứng.
5. First Assign không tạo SYSTEM Message.
6. Application `UNASSIGNED` có thể không có Conversation nếu chưa từng Assign.
7. Application `UNASSIGNED` có thể có Conversation nếu đã từng Assign.
8. Conversation existence là persisted distinction giữa hai trường hợp trên.
9. Reassign không tạo Conversation mới.
10. Take over không tạo Conversation mới.
11. Manual Unassign không xóa Conversation.
12. Automatic Unassign không xóa Conversation.
13. Assign lại không tạo Conversation mới.
14. Responsibility transition `A → B` sau khi Conversation tồn tại phải có required SYSTEM Message.
15. Responsibility transition `A → NONE` sau khi Conversation tồn tại phải có required SYSTEM Message.
16. Responsibility transition `NONE → B` khi Conversation đã tồn tại phải có required SYSTEM Message.
17. Required SYSTEM Message không được tồn tại như successful responsibility event nếu corresponding transition thất bại.
18. SYSTEM Message không có human sender.
19. NORMAL Message luôn giữ sender User thực tế.
20. Recruiter NORMAL Message giữ CompanyMember sender thực tế.
21. Historical sender references không được rewrite sau Reassign.
22. Historical sender references không được rewrite sau Unassign.
23. Conversation không lưu duplicate Candidate.
24. Conversation không lưu duplicate current Assignee.
25. Conversation không lưu participant array.
26. Conversation không lưu duplicate Job hoặc Company.
27. Conversation operational mode không cần persisted state riêng.
28. Application terminal không update Conversation state field.
29. Company lock không update Conversation state field.
30. Company lock không clear persisted Assignee chỉ vì V11.
31. Job `CLOSED` / `EXPIRED` không update Conversation state.
32. NORMAL Message không được ghi nhận sau terminal completion.
33. NORMAL Message không được ghi nhận sau Unassign completion cho tới khi Assign lại.
34. NORMAL Message không được ghi nhận sau Company lock có hiệu lực.
35. Outgoing Recruiter không được ghi NORMAL Message sau Reassign/Unassign/eligibility loss đã hoàn tất.
36. Eligibility loss khóa Send trước khi Automatic Unassign hoàn tất; Candidate
    chỉ đọc và outgoing Recruiter không đọc/gửi trong window đó.
37. Message đã hoàn tất hợp lệ trước competing state transition được giữ.
38. Message history không dùng để xác định current Assignee.
39. SYSTEM Message history không dùng để xác định current Assignee.
40. Message history không dùng để cấp current Chat authorization.
41. Persisted/final Assignee chỉ đọc frozen/terminal history khi `User` và
    `CompanyMember` đều `ACTIVE`; không cần current Recruitment Team membership.
42. Conversation/Message không bị xóa bởi Reassign, Take over, Unassign hoặc Assign lại.
43. Conversation/Message không bị xóa chỉ vì Application terminal.
44. Conversation/Message không bị xóa chỉ vì Job `CLOSED` hoặc `EXPIRED`.
45. Cross-tenant Recruiter Message không được tồn tại hợp lệ.
46. Candidate chỉ được tạo NORMAL Message cho Conversation thuộc Application của chính Candidate.
47. Company Manager không tạo NORMAL Message.
48. Platform Admin không tạo NORMAL Message.
49. Primary không phải current Assignee không tạo NORMAL Message với tư cách Recruiter.
50. V11 không tạo Assignment History collection.
51. V11 không tạo Conversation state enum làm nguồn business truth.
52. Application tiếp tục là source of truth cho current Candidate, Job, Recruitment Status và current Assignee.

Enforcement owner của các invariant trên là:

* schema/database đối với local structural constraints;
* service đối với business/cross-document validity;
* transaction/concurrency layer đối với cross-document atomic outcome;
* kết hợp các lớp trên đối với race-sensitive state.

---

# 17. Definition of Data Completion

V11 Data Contract được coi là hoàn thành khi:

* `Conversation` đã có persistence contract rõ ràng;
* `Message` đã có persistence contract rõ ràng;
* Application không bị duplicate Conversation reference không cần thiết;
* relationship `Application 1 → 0..1 Conversation` được bảo vệ;
* relationship `Conversation 1 → 0..N Message` được xác định;
* NORMAL/SYSTEM enum được xác định;
* sender identity matrix được xác định;
* Message sender history không bị rewrite;
* Conversation operational modes được derive từ canonical existing state thay vì tạo duplicate state;
* First Assign persistence transition được xác định;
* Reassign/Take over persistence transition được xác định;
* Manual Unassign persistence transition được xác định;
* Automatic Unassign persistence consequence được xác định;
* Assign lại persistence transition được xác định;
* terminal persistence behavior được xác định;
* Company lock persistence behavior được xác định;
* Send concurrency boundary được xác định;
* unique Conversation constraint được xác định;
* Message history index cần thiết được xác định;
* TX-01 đến TX-08 được đáp ứng;
* constraint ownership giữa schema/database, service và transaction layer được xác định;
* multi-tenant data ownership được xác định;
* V10 persistence truth tiếp tục giữ authority đối với Assignment/Pipeline data;
* không có duplicate Candidate/current Assignee/Company/Job field trong Conversation;
* không có speculative participant/history/status collection;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn.

Data Completion không có nghĩa schema đã được code.

Nó có nghĩa persistence contract đủ rõ để implementation không phải tự suy đoán các decision quan trọng của V11.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V11.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu được phép định nghĩa:

* collections;
* fields;
* references;
* cardinality;
* enums;
* indexes;
* uniqueness;
* state representation;
* persistence transitions;
* atomicity requirements;
* persistence invariants;
* constraint ownership.

Tài liệu này không định nghĩa:

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
* transaction API cụ thể;
* locking algorithm cụ thể;
* source-code structure;
* frontend component;
* UI wording;
* test framework.

Data Contract cũng không yêu cầu:

```text
distributed transaction
exactly-once external delivery
external side-effect atomicity
```

vì V11 không có external side effect thuộc atomic completion.

Boundary canonical:

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
```

Thứ tự authority:

```text
Approved Product Spec
→ business truth

Approved Data Contract
→ persistence truth

Engineering docs
→ architecture truth

Source code + tests
→ actual implementation evidence

Raw macro database / diagrams
→ input material only
```

Nếu implementation hoặc engineering design mâu thuẫn với tài liệu này, Data Contract là authority đối với persistence behavior trừ khi canonical Product/Data Contract được con người cập nhật và phê duyệt lại.
