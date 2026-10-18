# V11 — Conversation và Chat thuộc Application

> **File:** `docs/product/versions/v11-application-conversation-chat.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V11.

---

## 1. Mục tiêu

V11 bổ sung kênh giao tiếp có kiểm soát giữa Candidate và phía tuyển dụng trong phạm vi một `Application` đã tồn tại.

Sau V11, hệ thống phải xác định được:

1. `Application` nào đã có `Conversation`;
2. ai hiện được phép đọc `Conversation`;
3. ai hiện được phép gửi `Message`;
4. khi nào `Conversation` đang hoạt động, tạm dừng hoặc chỉ còn quyền đọc;
5. việc thay đổi current Assignee ảnh hưởng thế nào tới quyền Chat;
6. cách giữ nguyên lịch sử giao tiếp khi Application được Reassign, Unassign, Automatic Unassign hoặc Assign lại;
7. khi nào hệ thống phải ghi nhận `SYSTEM Message` về thay đổi người phụ trách;
8. cách Chat phản ứng khi Application kết thúc, Company bị lock hoặc Job đã `CLOSED` / `EXPIRED`.

V11 không tạo một quan hệ nhắn tin độc lập giữa Candidate và Recruiter.

Conversation luôn thuộc một `Application` cụ thể và quyền Chat được xác định từ current business state của chính Application đó.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

* Conversation thuộc Application.
* Mỗi Application có tối đa một Conversation chính.
* Tạo Conversation khi Application được Assign lần đầu.
* Candidate và current Assigned Recruiter giao tiếp trong Conversation.
* `NORMAL Message`.
* `SYSTEM Message`.
* Ghi nhận đúng người thực tế đã gửi từng NORMAL Message.
* Giữ nguyên Conversation và Message history khi Reassign.
* Giữ nguyên Conversation khi Unassign.
* Giữ nguyên Conversation khi Automatic Unassign.
* Tiếp tục cùng Conversation khi Assign lại sau Unassign.
* Chuyển quyền Chat sang Assignee mới khi Reassign hoặc Assign lại.
* Thu hồi quyền Chat của Assignee cũ.
* Tạm dừng gửi Message khi Application đang `UNASSIGNED`.
* Continuous eligibility đối với Recruiter Chat authority.
* Freeze gửi Message khi Company không operational do Company lock.
* Read-only khi Application trở thành terminal.
* Tiếp tục Chat khi Job `CLOSED` hoặc `EXPIRED` nhưng Application vẫn còn hoạt động.
* Giữ Conversation và Message history lâu dài.
* Bảo vệ business outcome trước các thao tác cạnh tranh liên quan tới Message, assignment, lifecycle và terminal transition.

### 2.2. Ngoài phạm vi

* Realtime Chat.
* Socket.IO hoặc cơ chế realtime tương đương.
* Notification.
* Notification realtime.
* Attachment.
* Hình ảnh trong Message.
* File trong Message.
* Voice Message.
* Gửi CV qua attachment.
* Edit Message.
* Delete Message.
* Reaction.
* Read receipt.
* Typing indicator.
* Online/offline.
* Last seen.
* Recruitment notes hoặc ghi chú nội bộ.
* Interview Schedule.
* Candidate phản hồi lịch phỏng vấn.
* Assignment History đầy đủ.
* Status History.
* Application Timeline.
* Audit timeline.
* Candidate Search.
* Job Invitation.
* Accept hoặc Reject Invitation.
* Application từ Invitation.
* Direct Conversation giữa Candidate và Recruiter khi chưa có Application.
* Group Chat.
* Nhiều Conversation chính cho cùng một Application.
* Company Manager đọc hoặc gửi Message.
* Platform Admin đọc hoặc gửi Message.
* Primary Recruiter đọc Chat khi không phải current Assignee.
* Recruiter cũ đọc Chat chỉ vì đã từng là Assignee.

Không suy diễn hoặc tự bổ sung chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V11 sử dụng và mở rộng các business concept đã tồn tại:

* V1 — `User`, authentication và Platform User lifecycle.
* V2 — `Company` và Company operational lifecycle.
* V3 — `CompanyMember` và Recruiter membership lifecycle.
* V5 — `Job` và Job lifecycle.
* V6 — Recruitment Team gồm Primary Recruiter và Supporting Recruiter.
* V7 — Candidate Profile, Candidate CV và `submittedCvSnapshot`.
* V8 — Job Discovery và điều kiện Job còn nhận hồ sơ.
* V9 — `Application`, Replace Submitted CV và Withdraw.
* V10 — Recruitment Status.
* V10 — Assignment State `ASSIGNED / UNASSIGNED`.
* V10 — Primary Recruiter assignment-management authority.
* V10 — Company Manager assignment-management authority.
* V10 — Reassign và Take over.
* V10 — Manual Unassign.
* V10 — Automatic Unassign.
* V10 — continuous Assignee eligibility.
* V10 — Company-lock freeze semantics.
* V10 — Candidate My Applications.
* V10 — Recruiter My Applications.
* V10 — concurrency boundary đối với Application state.

V11 không thay đổi các invariant Assignment hoặc Recruitment Pipeline của V10.

Đặc biệt:

* Assign không tự động chuyển `APPLIED → SCREENING`;
* Reassign, Take over, Unassign và Assign lại không thay đổi Recruitment Status;
* mọi non-terminal Recruitment Status có thể `ASSIGNED` hoặc `UNASSIGNED`;
* Company Manager có assignment-management authority nhưng không có Recruitment Pipeline authority;
* Application `UNASSIGNED` không tiến Recruitment Pipeline;
* Recruiter mất eligibility không được tiếp tục xử lý Application;
* Job `CLOSED` hoặc `EXPIRED` không tự kết thúc Application đã tồn tại;
* terminal Application không reopen.

V11 chỉ bổ sung hệ quả communication của các state và transition đó.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Conversation

`Conversation` là kênh giao tiếp chính thuộc một Application cụ thể.

Conversation không thuộc:

* Candidate nói chung;
* Recruiter nói chung;
* cặp Candidate–Recruiter;
* cặp Candidate–Company;
* Job nói chung;
* Recruitment Team nói chung.

Một Application có tối đa một Conversation chính.

Conversation có thể tiếp tục tồn tại kể cả khi Application tạm thời không có current Assignee.

---

### 4.2. Message

`Message` là một nội dung giao tiếp thuộc Conversation.

V11 có hai loại Message:

* `NORMAL`;
* `SYSTEM`.

Message đã được ghi nhận tiếp tục thuộc lịch sử Conversation và không đổi người gửi khi current Assignee thay đổi.

---

### 4.3. NORMAL Message

`NORMAL Message` là Message do:

* Candidate sở hữu Application;
* hoặc current Assigned Recruiter đủ quyền Chat;

thực tế gửi.

Mỗi NORMAL Message phải giữ được danh tính thực tế của người đã gửi tại thời điểm Message được ghi nhận.

---

### 4.4. SYSTEM Message

`SYSTEM Message` là Message do hệ thống tạo để phản ánh thay đổi current responsibility có ý nghĩa trực tiếp đối với Conversation.

SYSTEM Message không phải Message của:

* Candidate;
* Primary Recruiter;
* Company Manager;
* Recruiter cũ;
* Recruiter mới;
* Platform Admin.

SYSTEM Message không phải Assignment History đầy đủ và không được dùng làm nguồn xác định current Assignee hoặc authorization.

---

### 4.5. Candidate

Candidate là User sở hữu Application.

Candidate là participant cố định phía Candidate của Conversation.

Candidate không mất ownership của Conversation khi current Assignee thay đổi.

---

### 4.6. Current Assigned Recruiter

Current Assigned Recruiter là Recruiter hiện đang được Application ghi nhận là Assignee theo V10.

Đối với Conversation đang hoạt động, Recruiter chỉ có Chat authority khi đồng thời:

* là current Assigned Recruiter;
* thuộc đúng Company;
* thuộc current Recruitment Team của Job;
* có role Recruiter;
* CompanyMember đang `ACTIVE`;
* User đang `ACTIVE`;
* Company đang operational.

Stored Assignee reference không tự tạo Chat authority nếu Recruiter không còn đủ eligibility.

---

### 4.7. Former Assignee

Former Assignee là Recruiter đã từng trực tiếp phụ trách Application nhưng không còn là current Assignee.

Former Assignee có thể vẫn xuất hiện trong lịch sử Message với tư cách người đã thực tế gửi Message.

Việc từng là Assignee không tạo quyền đọc hoặc gửi Conversation hiện tại.

---

### 4.8. Primary Recruiter

Primary Recruiter có assignment-management authority theo V10.

Primary không mặc nhiên có Chat authority.

Nếu Primary không phải current Assignee thì không được đọc hoặc gửi Message.

Nếu Primary Take over Application và trở thành current Assignee thì Chat authority được xác định theo current Assignee rules.

---

### 4.9. Company Manager

Company Manager có assignment-management authority theo V10 nhưng không phải participant của Conversation.

Company Manager không được:

* đọc Conversation;
* gửi NORMAL Message;
* gửi SYSTEM Message với tư cách người dùng.

Các assignment transition do Company Manager thực hiện có thể làm hệ thống tạo SYSTEM Message theo V11.

---

### 4.10. Platform Admin

Platform Admin không có Chat authority.

Platform Admin User lifecycle action có thể làm current Assignee mất eligibility và dẫn tới Automatic Unassign theo V10.

SYSTEM Message phát sinh từ kết quả đó là system consequence, không phải Message do Platform Admin gửi.

---

## 5. Quan hệ nghiệp vụ chính

```text
Candidate
   │
   │ sở hữu
   ↓
Application
   │
   ├── thuộc một Job
   │
   ├── có 0..1 current Assigned Recruiter
   │
   └── có 0..1 Conversation chính
                │
                └── có 0..N Message
```

Một Candidate có nhiều Application thì mỗi Application có Conversation độc lập.

```text
Application Job A
└── Conversation A

Application Job B
└── Conversation B
```

Hai Conversation không được gộp dù:

* cùng Candidate;
* cùng Company;
* cùng Job family;
* hoặc cùng Assigned Recruiter.

Current Chat authority được xác định từ current Application relationships, không từ danh sách participant lịch sử.

Phần này chỉ mô tả quan hệ nghiệp vụ.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Recruitment Status

V11 sử dụng nguyên trạng Recruitment Status của V10:

* `APPLIED`
* `SCREENING`
* `CONTACTED`
* `INTERVIEW_SCHEDULED`
* `INTERVIEW_COMPLETED`
* `HIRED`
* `REJECTED`
* `WITHDRAWN`

`HIRED`, `REJECTED` và `WITHDRAWN` là terminal.

V11 không tạo Recruitment Status mới cho Chat.

---

### 6.2. Assignment State

V11 sử dụng Assignment State của V10:

* `UNASSIGNED`
* `ASSIGNED`

Conversation lifecycle không thay thế Assignment State.

---

### 6.3. Conversation Operational Mode

Conversation có các business mode sau:

* `NOT_CREATED`
* `ACTIVE`
* `PAUSED_UNASSIGNED`
* `FROZEN_COMPANY`
* `READ_ONLY`

| Mode                | Ý nghĩa                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOT_CREATED`       | Application chưa từng có Assignee nên chưa có Conversation                                                                                                        |
| `ACTIVE`            | Conversation tồn tại, Application non-terminal, đang có current eligible Assignee và Company operational                                                          |
| `PAUSED_UNASSIGNED` | Conversation đã tồn tại nhưng Application non-terminal hiện `UNASSIGNED`; lịch sử được giữ nhưng không nhận NORMAL Message mới                                    |
| `FROZEN_COMPANY`    | Conversation tồn tại, persisted Assignee được giữ nhưng Company không operational; lịch sử vẫn đọc được trong phạm vi đã chốt nhưng không nhận NORMAL Message mới |
| `READ_ONLY`         | Application đã terminal; Conversation chỉ giữ lịch sử và không nhận NORMAL Message mới                                                                            |

Các mode trên là business behavior của Conversation.

V11 không yêu cầu chúng phải trở thành Recruitment Status hoặc Assignment Status mới.

### 6.4. Eligibility-loss window trước Automatic Unassign

Khi current Assignee mất continuous eligibility nhưng Automatic Unassign của V10
chưa hoàn tất, Conversation không còn writable ngay lập tức. Đây là một
authorization behavior chuyển tiếp, không phải persisted Conversation mode mới.

Trong window này:

* Candidate vẫn được đọc history nhưng không được gửi;
* outgoing Recruiter không được đọc hoặc gửi;
* không được chờ `Application.assignedRecruiterCompanyMemberId` được clear mới
  thu hồi Send.

Sau khi Automatic Unassign hoàn tất, Conversation chuyển sang
`PAUSED_UNASSIGNED` theo các rule hiện có.

---

## 7. Tổ hợp trạng thái hợp lệ

| Application                          | Assignment   | Company                           | Conversation                  | Business behavior      |
| ------------------------------------ | ------------ | --------------------------------- | ----------------------------- | ---------------------- |
| Non-terminal, chưa từng Assign       | `UNASSIGNED` | Operational                       | Chưa tồn tại                  | `NOT_CREATED`          |
| Non-terminal                         | `ASSIGNED`   | Operational                       | Tồn tại                       | `ACTIVE`               |
| Non-terminal, Assignee vừa mất eligibility | `ASSIGNED` | Operational | Tồn tại | Candidate chỉ đọc; không actor nào gửi; outgoing Recruiter không đọc/gửi |
| Non-terminal, đã từng Assign         | `UNASSIGNED` | Operational                       | Tồn tại                       | `PAUSED_UNASSIGNED`    |
| Non-terminal                         | `ASSIGNED`   | Không operational do Company lock | Tồn tại                       | `FROZEN_COMPANY`       |
| Terminal                             | `ASSIGNED`   | Bất kỳ                            | Nếu đã tồn tại thì giữ nguyên | `READ_ONLY`            |
| `WITHDRAWN`, đã từng có Conversation | `UNASSIGNED` | Bất kỳ                            | Tồn tại                       | `READ_ONLY`            |
| `WITHDRAWN`, chưa từng Assign        | `UNASSIGNED` | Bất kỳ                            | Không tồn tại                 | Không tạo Conversation |

Điểm phân biệt bắt buộc:

```text
UNASSIGNED
không đồng nghĩa
NO CONVERSATION
```

Đúng hơn:

```text
chưa từng được Assign
→ chưa có Conversation

đã từng được Assign nhưng hiện UNASSIGNED
→ Conversation vẫn tồn tại và tạm dừng gửi Message
```

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Candidate có Application từ V10
APPLIED
UNASSIGNED
chưa từng Assign
  ↓
Chưa có Conversation
  ↓
Primary Recruiter hoặc Company Manager Assign lần đầu
  ↓
Application trở thành ASSIGNED
Recruitment Status giữ nguyên
  ↓
Conversation chính được tạo
  ↓
Không tạo SYSTEM Message cho First Assign
  ↓
Candidate và current Assigned Recruiter được Chat
  ↓
Hai bên gửi NORMAL Message
  ↓
Current responsibility có thể thay đổi:

A → B
A → NONE
NONE → B

  ↓
Conversation luôn được giữ nguyên
  ↓
SYSTEM Message được tạo cho các responsibility transition
sau khi Conversation đã tồn tại
  ↓
Nếu UNASSIGNED:
Candidate chỉ đọc
không ai gửi
không Recruiter nào có quyền đọc
  ↓
Khi Assign lại:
Conversation hoạt động lại với Assignee mới
  ↓
Application tiếp tục Recruitment Pipeline
  ↓
HIRED / REJECTED / WITHDRAWN
  ↓
Conversation READ_ONLY
  ↓
Không nhận NORMAL Message mới
```

Job `CLOSED` hoặc `EXPIRED` không tự thay đổi Conversation mode.

Company lock giữ persisted assignment nhưng chuyển Conversation sang freeze gửi Message theo boundary đã chốt.

---

# 9. Functional Requirements

## F01 — Khởi tạo Conversation khi Application được Assign lần đầu

### Actor

* Primary Recruiter.
* Company Manager.
* Hệ thống.

### Mục tiêu

Tạo Conversation chính cho Application tại lần đầu tiên Application có current Assigned Recruiter.

### Tiền điều kiện

* Application chưa terminal.
* Application chưa từng có Conversation.
* Application đang `UNASSIGNED`.
* Actor có assignment-management authority theo V10.
* Target Recruiter hợp lệ theo V10.

### Luồng chính

1. Actor thực hiện First Assign theo V10.
2. Application chuyển từ `UNASSIGNED` sang `ASSIGNED`.
3. Recruitment Status giữ nguyên.
4. Conversation chính được tạo cho Application.
5. Candidate và current Assigned Recruiter có thể bắt đầu giao tiếp.
6. Không tạo SYSTEM Message cho First Assign.

### Kết quả

* Application có đúng một Conversation chính.
* Conversation có thể chưa có Message nào.
* Candidate có thể Chat ngay cả khi Application vẫn `APPLIED`.
* First Assign không tự chuyển Application sang `SCREENING`.

### Trường hợp từ chối

* Application đã terminal.
* Assignment không hợp lệ theo V10.
* Application đã có Conversation và yêu cầu nhằm tạo Conversation thứ hai.
* Actor không có assignment-management authority.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-04`
* `BR-05`
* `BR-06`

### Không thuộc chức năng này

* Tạo Conversation thủ công khi Application chưa từng được Assign.
* Direct Chat trước Application.
* SYSTEM Message cho First Assign.

---

## F02 — Giao tiếp trong Conversation đang hoạt động

### Actor

* Candidate sở hữu Application.
* Current Assigned Recruiter đủ eligibility.

### Mục tiêu

Cho phép Candidate và Recruiter hiện đang trực tiếp phụ trách Application trao đổi NORMAL Message trong đúng Application.

### Tiền điều kiện

* Conversation đã tồn tại.
* Application chưa terminal.
* Application đang `ASSIGNED`.
* Company đang operational.
* Nếu actor là Recruiter, actor là current Assigned Recruiter và còn đủ continuous eligibility.
* Nếu actor là Candidate, actor sở hữu Application.

### Luồng chính

1. Actor truy cập Conversation của Application.
2. Actor đọc lịch sử Message.
3. Actor gửi NORMAL Message.
4. Message được ghi nhận với đúng người gửi thực tế.
5. Conversation tiếp tục gắn với cùng Application.

### Kết quả

* Message mới thuộc Conversation hiện tại.
* Người gửi thực tế được giữ trong lịch sử.
* Gửi Message không thay đổi Recruitment Status.
* Gửi Message không thay Assignment State.
* Gửi Message không thay Candidate, Job, source hoặc `submittedCvSnapshot`.

### Trường hợp từ chối

* Conversation chưa tồn tại.
* Application đang `UNASSIGNED`.
* Application đã terminal.
* Company đang bị freeze theo Company lock.
* Candidate không sở hữu Application.
* Recruiter không phải current Assignee.
* Recruiter đã mất eligibility.
* Primary không phải Assignee.
* Company Manager.
* Platform Admin.

### Business Rules liên quan

* `BR-07`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-11`
* `BR-12`
* `BR-13`
* `BR-14`

### Không thuộc chức năng này

* Attachment.
* Realtime.
* Read receipt.
* Edit hoặc Delete Message.

---

## F03 — Reassign, Take over và chuyển quyền Conversation

### Actor

* Primary Recruiter.
* Company Manager đối với Reassign.
* Hệ thống đối với SYSTEM Message.

### Mục tiêu

Giữ nguyên Conversation khi current Assignee thay đổi trực tiếp từ Recruiter này sang Recruiter khác và chuyển Chat authority sang Assignee mới.

### Tiền điều kiện

* Conversation đã tồn tại.
* Application chưa terminal.
* Assignment transition hợp lệ theo V10.
* Target Recruiter đủ current eligibility.

### Luồng chính

1. Current Assignee thay đổi `A → B`.
2. Conversation hiện tại được giữ nguyên.
3. Toàn bộ Message history được giữ.
4. Recruiter A mất quyền đọc và gửi.
5. Recruiter B có quyền đọc toàn bộ history.
6. Recruiter B có quyền gửi NORMAL Message nếu vẫn đủ eligibility.
7. Hệ thống tạo SYSTEM Message thông báo thay đổi người phụ trách.
8. Candidate tiếp tục dùng cùng Conversation.

Take over tuân theo cùng behavior.

### Kết quả

* Không tạo Conversation mới.
* Message cũ giữ nguyên người gửi.
* SYSTEM Message thuộc cùng Conversation.
* Recruitment Status không đổi.

### Trường hợp từ chối

* Application đã terminal.
* Assignment transition không hợp lệ.
* Target Recruiter không hợp lệ.
* Reassign thất bại nhưng SYSTEM Message thay đổi người phụ trách vẫn được ghi nhận.
* Required SYSTEM Message không thể trở thành cùng business outcome với responsibility transition.

### Business Rules liên quan

* `BR-15`
* `BR-16`
* `BR-17`
* `BR-18`
* `BR-19`
* `BR-20`

### Không thuộc chức năng này

* Assignment History đầy đủ.
* Cho Former Assignee tiếp tục đọc history.

---

## F04 — Unassign và tạm dừng Conversation

### Actor

* Primary Recruiter.
* Company Manager.
* Hệ thống.

### Mục tiêu

Giữ nguyên Conversation nhưng tạm dừng việc gửi Message khi một non-terminal Application đã từng có Conversation chuyển về `UNASSIGNED`.

### Tiền điều kiện

* Application chưa terminal.
* Application đang `ASSIGNED`.
* Conversation đã tồn tại.
* Unassign hợp lệ theo V10.

### Luồng chính

1. Application chuyển `ASSIGNED(A) → UNASSIGNED`.
2. Recruitment Status giữ nguyên.
3. Conversation và toàn bộ history được giữ.
4. Hệ thống tạo SYSTEM Message thông báo Application đang chờ người phụ trách mới.
5. Candidate tiếp tục được đọc history.
6. Candidate không được gửi NORMAL Message mới.
7. Recruiter A mất toàn bộ current Conversation access.
8. Không Recruiter nào được đọc hoặc gửi khi Application đang `UNASSIGNED`.

### Kết quả

* Conversation ở `PAUSED_UNASSIGNED`.
* Không tạo Conversation mới.
* Không xóa history.
* Không yêu cầu replacement ngay.

### Trường hợp từ chối

* Application đã terminal.
* Actor không có Unassign authority theo V10.
* NORMAL Message mới được ghi nhận sau khi Unassign đã hoàn tất.

### Business Rules liên quan

* `BR-21`
* `BR-22`
* `BR-23`
* `BR-24`
* `BR-25`

### Không thuộc chức năng này

* Xóa Conversation khi Unassign.
* Cho Candidate tiếp tục gửi Message vào hàng chờ.
* Historical Chat authority cho Former Assignee.

---

## F05 — Automatic Unassign khi Assignee mất eligibility

### Actor

* Hệ thống.

### Mục tiêu

Đồng bộ Chat authority với Automatic Unassign bắt buộc của V10 khi current Assignee mất eligibility.

### Tiền điều kiện

* Application đang non-terminal.
* Application đang `ASSIGNED`.
* Conversation đã tồn tại.
* Current Assignee mất eligibility theo lifecycle/team boundary của V10.

### Luồng chính

1. Recruiter mất processing eligibility.
2. Conversation mất writability ngay, không chờ Automatic Unassign hoàn tất.
3. Outgoing Recruiter mất quyền đọc và gửi ngay; Candidate chỉ được đọc history.
4. V10 đưa affected Application về `UNASSIGNED`.
5. Conversation và Message history được giữ nguyên.
6. Hệ thống tạo SYSTEM Message thông báo hồ sơ đang chờ người phụ trách mới.
7. Candidate tiếp tục được đọc history.
8. Candidate và mọi Recruiter không được gửi NORMAL Message mới.
9. Former Assignee không còn quyền đọc Conversation.

### Kết quả

* Conversation chuyển sang `PAUSED_UNASSIGNED`.
* Không expose lý do lifecycle nội bộ không cần thiết cho Candidate.
* Không tạo replacement.
* Recruitment Status giữ nguyên.

### Trường hợp từ chối

* Stale request của outgoing Recruiter cố gửi Message sau khi eligibility đã mất.
* Stale request cố tiếp tục dùng Assignee cũ sau Automatic Unassign.

### Business Rules liên quan

* `BR-08`
* `BR-22`
* `BR-23`
* `BR-26`
* `BR-27`
* `BR-28`
* `BR-55`

### Không thuộc chức năng này

* Platform Admin chọn replacement.
* Notification.
* Recovery task.

---

## F06 — Assign lại và kích hoạt lại Conversation

### Actor

* Primary Recruiter.
* Company Manager.
* Hệ thống.

### Mục tiêu

Cho phép một Conversation đã tạm dừng vì `UNASSIGNED` tiếp tục hoạt động với current Assignee mới.

### Tiền điều kiện

* Conversation đã tồn tại.
* Application chưa terminal.
* Application đang `UNASSIGNED`.
* Target Recruiter đủ eligibility.
* Assign hợp lệ theo V10.

### Luồng chính

1. Application chuyển `UNASSIGNED → ASSIGNED(B)`.
2. Conversation cũ được giữ nguyên.
3. Message history được giữ nguyên.
4. Hệ thống tạo SYSTEM Message thông báo người phụ trách mới.
5. Recruiter B được đọc toàn bộ history.
6. Candidate và Recruiter B được gửi NORMAL Message mới.
7. Recruitment Status giữ nguyên.

### Kết quả

* Conversation chuyển từ `PAUSED_UNASSIGNED` sang `ACTIVE`.
* Candidate tiếp tục cùng Conversation.
* Former Assignee không được lấy lại quyền chỉ vì từng tham gia Conversation.

### Trường hợp từ chối

* Application đã terminal.
* Target Recruiter không hợp lệ.
* Assign không hợp lệ theo V10.
* Yêu cầu nhằm tạo Conversation mới thay cho Conversation cũ.

### Business Rules liên quan

* `BR-16`
* `BR-18`
* `BR-22`
* `BR-29`
* `BR-30`

### Không thuộc chức năng này

* Tạo Conversation thứ hai.
* Khôi phục Former Assignee history access.

---

## F07 — Company lock và Conversation freeze

### Actor

* Candidate.
* Persisted Assigned Recruiter.
* Hệ thống.

### Mục tiêu

Giữ Conversation history nhưng ngăn gửi Message khi Company không operational do Company lock, đồng bộ với Company-lock semantics của V10.

### Tiền điều kiện

* Conversation đã tồn tại.
* Company bị lock theo canonical Company lifecycle.
* Persisted Assignee được V10 giữ nguyên.

### Luồng chính

1. Company mất operational state.
2. Assignment hiện tại không tự bị clear.
3. Conversation không bị xóa.
4. Candidate được đọc history.
5. Persisted Assigned Recruiter được đọc history khi `User` và
   `CompanyMember` đều còn `ACTIVE`; không yêu cầu còn thuộc current
   Recruitment Team hoặc Company đang operational chỉ để đọc trong freeze.
6. Candidate không được gửi NORMAL Message.
7. Recruiter không được gửi NORMAL Message.
8. Không tạo synthetic replacement hoặc Unassign chỉ vì Company lock.

### Kết quả

* Conversation ở `FROZEN_COMPANY`.
* History được bảo toàn.
* Không làm thay đổi Application Recruitment Status hoặc Assignment State.

### Trường hợp từ chối

* Candidate hoặc Recruiter cố gửi Message trong thời gian freeze.
* Actor khác cố suy diễn Company lock thành quyền đọc Chat.

### Business Rules liên quan

* `BR-31`
* `BR-32`
* `BR-33`
* `BR-54`

### Không thuộc chức năng này

* Company reactivation transition mới.
* Automatic Unassign chỉ vì Company lock.
* Realtime notification về Company lock.

---

## F08 — Terminal Application và read-only Conversation

### Actor

* Candidate.
* Final Assigned Recruiter trong trường hợp terminal giữ Assignee.
* Hệ thống.

### Mục tiêu

Đóng khả năng gửi Message khi Application kết thúc nhưng vẫn giữ history phù hợp với final Assignment State.

### Tiền điều kiện

Application chuyển sang:

* `HIRED`;
* `REJECTED`;
* hoặc `WITHDRAWN`.

### Luồng chính

1. Application trở thành terminal.
2. Conversation đã tồn tại chuyển sang read-only.
3. Không actor nào được gửi NORMAL Message mới.
4. Message history tiếp tục tồn tại.
5. Conversation không reopen trong V11.

Nếu terminal Application vẫn `ASSIGNED`:

* Candidate được đọc history;
* final Assigned Recruiter được đọc history khi `User` và `CompanyMember` đều
  còn `ACTIVE`; không yêu cầu còn thuộc current Recruitment Team hoặc Company
  đang operational chỉ để đọc terminal history.

Nếu Application đã `UNASSIGNED` trước khi `WITHDRAWN`:

* Candidate được đọc history;
* không Recruiter nào có historical Chat authority.

Nếu Candidate Withdraw trước khi Application từng được Assign:

* không tạo Conversation.

### Kết quả

* Conversation, nếu có, ở `READ_ONLY`.
* Không Message mới được ghi nhận sau terminal completion.
* Final Assignment State tiếp tục thuộc V10.

### Trường hợp từ chối

* Actor cố gửi Message sau terminal.
* Former Assignee không phải final Assignee cố đọc history.
* Application chưa từng có Conversation nhưng yêu cầu tạo Conversation chỉ vì Application đã terminal.

### Business Rules liên quan

* `BR-34`
* `BR-35`
* `BR-36`
* `BR-37`
* `BR-38`
* `BR-54`

### Không thuộc chức năng này

* Reopen Chat.
* Reopen Application.
* Historical Assignee access list.

---

## F09 — Chat tiếp tục khi Job kết thúc nhận hồ sơ

### Actor

* Candidate.
* Current eligible Assigned Recruiter.

### Mục tiêu

Bảo đảm Job `CLOSED` hoặc `EXPIRED` không tự khóa Conversation của non-terminal Application.

### Tiền điều kiện

* Conversation đã tồn tại.
* Application chưa terminal.
* Application đang `ASSIGNED`.
* Current Assignee còn đủ eligibility.
* Company operational.

### Luồng chính

1. Job chuyển sang `CLOSED` hoặc `EXPIRED`.
2. Application tiếp tục lifecycle độc lập.
3. Conversation vẫn hoạt động.
4. Candidate và current Assigned Recruiter tiếp tục được đọc và gửi NORMAL Message.

### Kết quả

* Job Status không tự thay đổi Conversation mode.
* Chat chỉ bị pause/freeze/read-only do các business condition tương ứng của V11.

### Trường hợp từ chối

* Suy diễn `Job CLOSED/EXPIRED → Conversation READ_ONLY`.
* Cho phép Chat nếu một điều kiện khác đã làm Conversation `PAUSED_UNASSIGNED`, `FROZEN_COMPANY` hoặc `READ_ONLY`.

### Business Rules liên quan

* `BR-39`
* `BR-40`

### Không thuộc chức năng này

* Reopen Job.
* Nhận Application mới.

---

## F10 — Consistency khi các hành động cạnh tranh

### Actor

* Candidate.
* Current Assigned Recruiter.
* Primary Recruiter.
* Company Manager.
* Platform Admin trong User lifecycle.
* Hệ thống.

### Mục tiêu

Bảo đảm Message và Conversation không phản ánh quyền hoặc business state đã stale khi các thao tác cạnh tranh xảy ra.

### Tiền điều kiện

Có từ hai business actions trở lên cạnh tranh trên cùng Application hoặc Conversation.

### Luồng chính

Hệ thống phải bảo vệ ít nhất các cạnh tranh:

* Send ↔ Reassign;
* Send ↔ Take over;
* Send ↔ Manual Unassign;
* Send ↔ Automatic Unassign;
* Send ↔ eligibility loss;
* Send ↔ Company lock;
* Send ↔ terminal Application transition;
* Send ↔ Assign lại.

Business result được xác định theo operation hợp lệ đã hoàn tất trước.

### Kết quả

* Message hợp lệ đã hoàn tất trước được giữ.
* Một state transition làm sender mất quyền hoàn tất trước thì pending Send dựa trên quyền cũ phải thất bại.
* Required SYSTEM Message không được tách khỏi responsibility transition mà nó phản ánh.
* Không ghi Message mới sau terminal, Unassign hoặc freeze đã có hiệu lực.
* Không cho Former Assignee gửi bằng stale current-Assignee reference.

### Trường hợp từ chối

* Stale request ghi Message sau khi quyền đã mất.
* SYSTEM Message báo thay đổi Assignee nhưng assignment transition tương ứng không hoàn tất.
* Responsibility transition thuộc V11 hoàn tất nhưng thiếu required SYSTEM Message.

### Business Rules liên quan

* `BR-18`
* `BR-25`
* `BR-28`
* `BR-41`
* `BR-42`
* `BR-43`
* `BR-44`
* `BR-45`
* `BR-46`
* `BR-55`

### Không thuộc chức năng này

* Quy định cơ chế transaction cụ thể.
* Quy định optimistic hoặc pessimistic locking cụ thể.

---

# 10. Business Rules

## BR-01 — V11 tiếp nhận Application hiện có

V11 bổ sung Conversation và Message cho Application đã tồn tại.

V11 không tạo lại Application, Candidate, Job hoặc `submittedCvSnapshot`.

---

## BR-02 — Conversation thuộc Application

Conversation luôn thuộc một Application cụ thể.

Conversation không phải quan hệ nhắn tin độc lập giữa Candidate và Recruiter.

---

## BR-03 — Một Application có tối đa một Conversation chính

Một Application có thể:

* chưa có Conversation;
* hoặc có đúng một Conversation chính.

Không được có nhiều Conversation chính song song cho cùng một Application.

---

## BR-04 — Chưa từng Assign thì chưa có Conversation

Application chưa từng có current Assigned Recruiter thì chưa có Conversation.

Candidate và Recruiter không được tạo Conversation thủ công trong trạng thái này.

---

## BR-05 — Conversation được tạo tại First Assign

Khi Application được Assign thành công lần đầu tiên, Conversation chính được tạo.

First Assign không tự thay đổi Recruitment Status.

---

## BR-06 — First Assign không tạo SYSTEM Message

Transition đầu tiên:

```text
NONE → Recruiter A
```

khi Conversation chưa từng tồn tại không tạo SYSTEM Message.

Conversation mới có thể tồn tại với `0` Message.

---

## BR-07 — Candidate Chat authority theo ownership

Candidate chỉ được truy cập Conversation thuộc Application của chính mình.

Candidate ownership không thay đổi khi Assignee thay đổi.

---

## BR-08 — Recruiter Chat authority là continuous

Recruiter chỉ có current Chat authority khi đồng thời:

* là current Assigned Recruiter;
* thuộc đúng Company;
* thuộc current Recruitment Team của Job;
* có role Recruiter;
* CompanyMember `ACTIVE`;
* User `ACTIVE`;
* Company operational,

trừ read behavior đặc thù của Company-lock freeze đã được định nghĩa riêng.

Stored Assignee reference không tự cấp Chat authority khi eligibility đã mất.

---

## BR-09 — Chỉ current Assignee có Recruiter Chat authority

Primary hoặc Supporting Recruiter không phải current Assignee không được đọc hoặc gửi Conversation.

Việc thuộc Recruitment Team không tự tạo Chat authority.

---

## BR-10 — Primary không mặc nhiên được đọc Chat

Primary được quản lý Application theo V10 nhưng không mặc nhiên được đọc hoặc gửi Conversation.

Primary muốn trực tiếp giao tiếp phải trở thành current Assignee theo transition hợp lệ.

---

## BR-11 — Company Manager không có Chat authority

Company Manager có assignment-management authority nhưng không được đọc hoặc gửi Conversation với tư cách Company Manager.

---

## BR-12 — Platform Admin không có Chat authority

Platform Admin không được đọc hoặc gửi Conversation thông qua Platform User lifecycle authority.

---

## BR-13 — NORMAL Message giữ người gửi thực tế

Mỗi NORMAL Message phải xác định được người thực tế đã gửi tại thời điểm Message được ghi nhận.

Message cũ không được đổi sender khi current Assignee thay đổi.

---

## BR-14 — Điều kiện gửi NORMAL Message

NORMAL Message chỉ được gửi khi:

* Conversation tồn tại;
* Application chưa terminal;
* Application đang `ASSIGNED`;
* Company operational;
* sender là Candidate owner hoặc current Assigned Recruiter còn đủ eligibility.

Frontend state không thay thế các business condition này.

---

## BR-15 — Reassign giữ nguyên Conversation

Transition:

```text
ASSIGNED(A) → ASSIGNED(B)
```

không tạo Conversation mới.

Conversation và toàn bộ Message history được giữ.

---

## BR-16 — Assignee mới tiếp quản history

Sau Reassign, Take over hoặc Assign lại:

* current Assignee mới được đọc toàn bộ Conversation history;
* Message cũ tiếp tục thể hiện đúng sender thực tế;
* history không bị rewrite theo Assignee mới.

---

## BR-17 — Former Assignee mất quyền

Ngay khi Recruiter không còn là current Assignee:

* Recruiter đó không còn current Chat authority;
* không được gửi Message mới;
* không được đọc Conversation chỉ vì từng là Assignee.

Message cũ do Recruiter đó gửi vẫn được giữ.

---

## BR-18 — Responsibility transition sau khi Conversation tồn tại tạo SYSTEM Message

Sau khi Conversation đã tồn tại, các transition sau phải tạo SYSTEM Message:

```text
Recruiter A → Recruiter B
Recruiter A → NONE
NONE → Recruiter B
```

Take over là trường hợp `A → B`.

First Assign được loại trừ theo `BR-06`.

---

## BR-19 — SYSTEM Message thuộc Conversation hiện tại

SYSTEM Message:

* thuộc Conversation hiện tại;
* được giữ trong history;
* không tạo Conversation mới;
* không thay Candidate;
* không thay Job;
* không thay source;
* không thay `submittedCvSnapshot`;
* không thay Recruitment Status.

---

## BR-20 — SYSTEM Message không phải Assignment History

SYSTEM Message chỉ cung cấp context giao tiếp về thay đổi người phụ trách.

SYSTEM Message không phải nguồn chuẩn để xác định:

* current Assignee;
* previous Assignee đầy đủ;
* Assignment History;
* current workload;
* authorization;
* lifecycle responsibility.

---

## BR-21 — Manual Unassign giữ Conversation

Khi:

```text
ASSIGNED(A) → UNASSIGNED
```

Conversation và toàn bộ Message history được giữ nguyên.

Recruitment Status không đổi.

---

## BR-22 — UNASSIGNED sau khi đã có Conversation làm Chat tạm dừng

Khi non-terminal Application đã có Conversation nhưng hiện `UNASSIGNED`:

* Candidate được đọc history;
* Candidate không được gửi;
* không Recruiter nào được đọc;
* không Recruiter nào được gửi.

Conversation không bị xóa.

---

## BR-23 — Unassign tạo SYSTEM Message

Manual Unassign và Automatic Unassign của một Application đã có Conversation phải tạo SYSTEM Message thông báo Application hiện đang chờ người phụ trách mới.

SYSTEM Message không cần expose lý do lifecycle nội bộ không cần thiết.

---

## BR-24 — Unassign không yêu cầu replacement

Conversation có thể tiếp tục tồn tại ở trạng thái tạm dừng trong khi Application chưa có replacement Assignee.

V11 không yêu cầu direct handoff.

---

## BR-25 — NORMAL Message sau Unassign phải bị từ chối

Sau khi Unassign đã hoàn tất, pending Send dựa trên Assignment State cũ không được ghi Message mới.

Quy tắc này áp dụng cho cả Candidate và outgoing Recruiter.

---

## BR-26 — Eligibility loss làm Recruiter mất Chat authority ngay

Khi current Assignee mất eligibility, Recruiter không được tiếp tục gửi hoặc đọc dựa trên stale Assignee state.

Automatic Unassign tiếp tục do V10 điều khiển.

Trong eligibility-loss window trước khi Automatic Unassign hoàn tất:

* Candidate vẫn được đọc history;
* Candidate không được gửi;
* outgoing Recruiter không được đọc hoặc gửi.

Không cần chờ Application được persist thành `UNASSIGNED` mới khóa Send.

---

## BR-27 — Automatic Unassign giữ Conversation và history

Automatic Unassign:

* không xóa Conversation;
* không xóa Message;
* không đổi sender lịch sử;
* không đổi Recruitment Status;
* chuyển Chat về behavior `PAUSED_UNASSIGNED`.

---

## BR-28 — SYSTEM Message của Automatic Unassign phản ánh responsibility outcome

SYSTEM Message của Automatic Unassign chỉ cần thông báo hồ sơ đang chờ người phụ trách mới.

V11 không yêu cầu expose cho Candidate việc Recruiter:

* bị Platform Admin lock;
* bị terminate;
* bị Company Manager lifecycle action;
* hoặc rời Recruitment Team.

---

## BR-29 — Assign lại sử dụng cùng Conversation

Khi một Application đã có Conversation chuyển:

```text
UNASSIGNED → ASSIGNED(B)
```

Conversation cũ phải được tiếp tục sử dụng.

Không tạo Conversation mới.

---

## BR-30 — Assign lại tạo SYSTEM Message

Assign lại sau một khoảng `UNASSIGNED` phải tạo SYSTEM Message thông báo người phụ trách mới.

Sau transition, Candidate và Assignee mới có thể tiếp tục Chat nếu các điều kiện khác đều hợp lệ.

---

## BR-31 — Company lock giữ Conversation và persisted assignment

Company lock không tự:

* xóa Conversation;
* xóa Message;
* Unassign current Assignee;
* tạo replacement.

Persisted assignment tiếp tục tuân theo Company-lock semantics của V10.

---

## BR-32 — Company lock freeze gửi Message

Trong thời gian Company không operational do Company lock:

* Candidate không được gửi NORMAL Message;
* persisted Assigned Recruiter không được gửi NORMAL Message;
* Conversation history vẫn tồn tại.

---

## BR-33 — Quyền đọc khi Company lock

Trong Company-lock freeze:

* Candidate được đọc Conversation history;
* persisted Assigned Recruiter được đọc Conversation history khi `User = ACTIVE`
  và `CompanyMember = ACTIVE`;
* không yêu cầu current Recruitment Team membership hoặc Company operational để
  giữ quyền đọc history này;
* `User` hoặc `CompanyMember` `LOCKED` / `TERMINATED` làm Recruiter mất quyền
  đọc và gửi;
* actor khác không được suy diễn thêm Chat authority.

---

## BR-34 — Terminal Application làm Conversation read-only

Khi Application trở thành:

* `HIRED`;
* `REJECTED`;
* `WITHDRAWN`;

Conversation đã tồn tại trở thành read-only.

Không nhận NORMAL Message mới.

---

## BR-35 — Terminal không xóa Conversation hoặc Message

Application terminal không làm xóa:

* Conversation;
* Message history;
* sender identity của Message cũ.

---

## BR-36 — Terminal Conversation không reopen trong V11

Conversation đã read-only do Application terminal không được mở lại để tiếp tục gửi Message.

---

## BR-37 — Terminal với final Assignee

Nếu Application trở thành terminal trong khi vẫn `ASSIGNED`:

* Candidate được đọc history;
* final Assigned Recruiter được đọc history khi `User = ACTIVE` và
  `CompanyMember = ACTIVE`;
* không yêu cầu current Recruitment Team membership hoặc Company operational để
  giữ quyền đọc terminal history này;
* không actor nào được gửi Message.

Nếu `User` hoặc `CompanyMember` của final Assignee là `LOCKED` / `TERMINATED`,
final association không bypass account lifecycle: Recruiter đó không được đọc
hoặc gửi. Former Assignee không phải final Assignee không được đọc.

---

## BR-38 — WITHDRAWN khi UNASSIGNED không tạo historical Recruiter authority

Nếu Application đã từng có Conversation, sau đó:

```text
ASSIGNED(A)
→ UNASSIGNED
→ WITHDRAWN
```

thì:

* Candidate được đọc Conversation history;
* không Recruiter nào có historical Chat authority;
* Former Assignee A không được đọc chỉ vì từng phụ trách Application.

Nếu Application `WITHDRAWN` trước lần Assign đầu tiên thì không tạo Conversation.

---

## BR-39 — Job CLOSED không khóa Chat

Job `CLOSED` không tự làm Conversation read-only hoặc paused.

Nếu Application vẫn non-terminal, `ASSIGNED`, Company operational và current Assignee đủ eligibility thì Chat tiếp tục hoạt động.

---

## BR-40 — Job EXPIRED không khóa Chat

Job `EXPIRED` không tự làm Conversation read-only hoặc paused.

Application và Conversation tiếp tục lifecycle độc lập theo V10/V11.

---

## BR-41 — Send cạnh tranh với Reassign

Nếu outgoing Recruiter gửi Message đồng thời với Reassign:

* Message hoàn tất hợp lệ trước thì Message được giữ;
* Reassign hoàn tất trước thì outgoing Recruiter không được ghi Message mới.

Candidate tiếp tục là participant trước và sau Reassign nếu Conversation vẫn writable.

---

## BR-42 — Send cạnh tranh với Unassign

Nếu Send hoàn tất hợp lệ trước Unassign thì Message được giữ.

Nếu Unassign hoàn tất trước thì mọi pending NORMAL Message mới phải thất bại cho tới khi Application được Assign lại.

---

## BR-43 — Send cạnh tranh với eligibility loss và Automatic Unassign

Nếu Recruiter mất eligibility trước khi Send hoàn tất thì request dựa trên eligibility cũ không được ghi Message.

Nếu Message đã hoàn tất hợp lệ trước eligibility loss thì Message được giữ.

---

## BR-44 — Send cạnh tranh với Company lock

Nếu Message hoàn tất hợp lệ trước Company lock thì Message được giữ.

Nếu Company lock đã có hiệu lực trước thì Candidate và Recruiter không được ghi NORMAL Message mới.

---

## BR-45 — Send cạnh tranh với terminal transition

Nếu Message hoàn tất hợp lệ trước terminal transition thì Message được giữ.

Nếu Application trở thành terminal trước thì pending Send phải thất bại.

---

## BR-46 — Stale operation không được vượt current Chat authority

Request dựa trên:

* stale Assignee;
* stale Assignment State;
* stale eligibility;
* stale Company operational state;
* stale Application status;

không được ghi Message trái với current completed business state.

---

## BR-47 — Responsibility transition và required SYSTEM Message là một business outcome

Đối với transition sau khi Conversation đã tồn tại mà V11 yêu cầu SYSTEM Message:

```text
A → B
A → NONE
NONE → B
```

không được tồn tại business outcome:

```text
responsibility transition thành công
nhưng thiếu required SYSTEM Message
```

hoặc:

```text
SYSTEM Message thay đổi người phụ trách được ghi nhận
nhưng responsibility transition tương ứng thất bại
```

V11 chỉ xác định tính toàn vẹn business outcome, không quy định cơ chế kỹ thuật thực hiện.

---

## BR-48 — Message history không cấp authorization

Không được dùng:

* Message sender history;
* SYSTEM Message history;
* người từng xuất hiện trong Conversation;

để tự tạo current Chat authority.

Authorization phải dựa trên current Application relationships và lifecycle rules.

---

## BR-49 — Conversation không thay đổi Application business content

Tạo Conversation, gửi Message hoặc tạo SYSTEM Message không được thay đổi:

* Candidate;
* Job;
* source;
* `submittedCvSnapshot`;
* Recruitment Status;
* Recruitment Team;
* Assignment State, ngoại trừ Assignment State được thay đổi bởi chính canonical V10 assignment operation.

---

## BR-50 — Conversation state không phải Recruitment Status

`ACTIVE`, `PAUSED_UNASSIGNED`, `FROZEN_COMPANY` và `READ_ONLY` là Conversation business behavior.

Không được tạo thêm Recruitment Status chỉ để biểu diễn Chat state.

---

## BR-51 — Conversation và Message được giữ khi responsibility thay đổi

Conversation và Message không bị xóa chỉ vì:

* Reassign;
* Take over;
* Manual Unassign;
* Automatic Unassign;
* Assign lại;
* Recruiter rời Recruitment Team;
* Recruiter mất Chat authority.

Mất quyền truy cập không đồng nghĩa mất dữ liệu lịch sử.

---

## BR-52 — Conversation và Message được giữ khi lifecycle kết thúc

Conversation và Message không bị xóa chỉ vì:

* Application terminal;
* Job `CLOSED`;
* Job `EXPIRED`.

---

## BR-53 — V11 không tạo Direct Conversation

Không có Conversation Candidate–Recruiter khi chưa có Application.

Recruiter không được tạo Chat trực tiếp chỉ vì thấy Candidate hoặc CV trong một business capability khác.

---

## BR-54 — Historical association không phải unconditional platform access

Persisted Assignee trong `FROZEN_COMPANY` và final Assignee của terminal
Application chỉ có historical read authority khi đồng thời:

```text
User = ACTIVE
AND
CompanyMember = ACTIVE
AND
Application vẫn ghi nhận Recruiter đó là persisted/final Assignee
```

`User` hoặc `CompanyMember` `LOCKED` / `TERMINATED` luôn thu hồi read/send
authority. Historical/final association không tạo khả năng bypass account
lifecycle.

---

## BR-55 — Eligibility loss khóa Send trước Automatic Unassign

Mất continuous eligibility của current Assignee khóa NORMAL Message ngay tại
thời điểm eligibility loss có hiệu lực. Pending Send dựa trên eligibility cũ
phải thất bại nếu eligibility loss hoàn tất trước Send; Message hoàn tất hợp lệ
trước đó được giữ.

---

# 11. State Transitions

## 11.1. Conversation lifecycle transitions

| Hành động                                     | Trước                                             | Sau                    | Actor                                             |
| --------------------------------------------- | ------------------------------------------------- | ---------------------- | ------------------------------------------------- |
| First Assign                                  | `NOT_CREATED`                                     | `ACTIVE`               | Primary Recruiter hoặc Company Manager + hệ thống |
| Reassign `A → B`                              | `ACTIVE`                                          | `ACTIVE`               | Primary Recruiter hoặc Company Manager + hệ thống |
| Take over                                     | `ACTIVE`                                          | `ACTIVE`               | Primary Recruiter + hệ thống                      |
| Manual Unassign                               | `ACTIVE`                                          | `PAUSED_UNASSIGNED`    | Primary Recruiter hoặc Company Manager + hệ thống |
| Automatic Unassign                            | `ACTIVE`                                          | `PAUSED_UNASSIGNED`    | Hệ thống                                          |
| Assign lại `NONE → B`                         | `PAUSED_UNASSIGNED`                               | `ACTIVE`               | Primary Recruiter hoặc Company Manager + hệ thống |
| Company lock                                  | `ACTIVE`                                          | `FROZEN_COMPANY`       | Company lifecycle consequence                     |
| Application terminal khi Conversation tồn tại | `ACTIVE` / `PAUSED_UNASSIGNED` / `FROZEN_COMPANY` | `READ_ONLY`            | Actor có terminal authority theo V9/V10           |
| Candidate Withdraw trước First Assign         | `NOT_CREATED`                                     | Không tạo Conversation | Candidate                                         |

Job `CLOSED` hoặc `EXPIRED` không tạo Conversation transition.

Eligibility loss khi Automatic Unassign đang pending không tạo mode persisted
mới: Candidate chỉ đọc, outgoing Recruiter không đọc/gửi, và không actor nào
gửi NORMAL Message.

V11 không định nghĩa Company reactivation transition mới.

---

## 11.2. Message creation transitions

| Hành động                           | Conversation mode       | Kết quả                                                |
| ----------------------------------- | ----------------------- | ------------------------------------------------------ |
| Candidate gửi NORMAL Message        | `ACTIVE`                | Message được ghi nhận nếu Candidate là owner           |
| Current Assignee gửi NORMAL Message | `ACTIVE`                | Message được ghi nhận nếu Recruiter còn đủ eligibility |
| Eligibility-loss window             | Authorization chuyển tiếp | Candidate chỉ đọc; outgoing Recruiter không đọc/gửi; không NORMAL Message |
| Gửi NORMAL Message                  | `PAUSED_UNASSIGNED`     | Không được phép                                        |
| Gửi NORMAL Message                  | `FROZEN_COMPANY`        | Không được phép                                        |
| Gửi NORMAL Message                  | `READ_ONLY`             | Không được phép                                        |
| First Assign                        | `NOT_CREATED → ACTIVE`  | Không tạo SYSTEM Message                               |
| Reassign / Take over                | Conversation đã tồn tại | Tạo SYSTEM Message                                     |
| Manual / Automatic Unassign         | Conversation đã tồn tại | Tạo SYSTEM Message                                     |
| Assign lại sau Unassign             | Conversation đã tồn tại | Tạo SYSTEM Message                                     |

Chỉ các transition được định nghĩa trong tài liệu này thuộc business contract của V11.

---

# 12. Authorization và ownership boundary

| Hành động                                          | Actor được phép              | Resource / Scope                                  | Điều kiện                                       |
| -------------------------------------------------- | ---------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Đọc active Conversation                            | Candidate                    | Application của chính Candidate                   | Conversation tồn tại                            |
| Gửi NORMAL Message                                 | Candidate                    | Application của chính Candidate                   | Conversation `ACTIVE`                           |
| Đọc active Conversation                            | Current Assigned Recruiter   | Application đang assign cho chính actor           | Actor còn đủ eligibility                        |
| Gửi NORMAL Message                                 | Current Assigned Recruiter   | Application đang assign cho chính actor           | Conversation `ACTIVE`, actor còn đủ eligibility |
| Đọc Conversation khi `UNASSIGNED`                  | Candidate                    | Application của chính Candidate                   | Conversation đã tồn tại                         |
| Gửi khi `UNASSIGNED`                               | Không actor nào              | Không có                                          | Không được phép                                 |
| Eligibility-loss window: đọc Conversation           | Candidate                    | Application của chính Candidate                   | Conversation đã tồn tại; Automatic Unassign pending |
| Eligibility-loss window: đọc/gửi                    | Outgoing Recruiter           | Không có                                          | Không được phép                                 |
| Đọc Conversation khi Company lock                  | Candidate                    | Application của chính Candidate                   | Conversation đã tồn tại                         |
| Đọc Conversation khi Company lock                  | Persisted Assigned Recruiter | Application đang giữ actor làm persisted Assignee | `User` + `CompanyMember` đều `ACTIVE`; không cần current Team |
| Gửi khi Company lock                               | Không actor nào              | Không có                                          | Không được phép                                 |
| Đọc terminal Conversation có final Assignee        | Candidate                    | Application của chính Candidate                   | Conversation tồn tại                            |
| Đọc terminal Conversation có final Assignee        | Final Assigned Recruiter     | Application giữ actor là final Assignee           | `User` + `CompanyMember` đều `ACTIVE`; không cần current Team |
| Đọc terminal Conversation `WITHDRAWN + UNASSIGNED` | Candidate                    | Application của chính Candidate                   | Conversation đã tồn tại                         |
| Đọc với tư cách Former Assignee                    | Không được phép              | Không có                                          | Từng là Assignee không tạo quyền                |
| Đọc/gửi khi không phải Assignee                    | Primary Recruiter            | Không có                                          | Không được phép                                 |
| Đọc/gửi                                            | Company Manager              | Không có                                          | Assignment authority không cấp Chat authority   |
| Đọc/gửi                                            | Platform Admin               | Không có                                          | Platform authority không cấp Chat authority     |
| Tạo SYSTEM Message                                 | Hệ thống                     | Conversation bị ảnh hưởng                         | Chỉ theo transition được V11 định nghĩa         |

Candidate khác không được truy cập Conversation.

Current Recruitment Team membership không bắt buộc cho terminal/frozen
historical read; Company operational cũng không bắt buộc cho quyền đọc trong
Company-lock freeze. Không condition historical nào bypass `User` hoặc
`CompanyMember` `LOCKED` / `TERMINATED`.

Recruiter không được dùng membership với Job hoặc Company khác để truy cập Conversation.

Authorization không được suy ra từ Message history hoặc identifier do client tự khai báo.

---

# 13. Multi-tenant boundary

V11 tiếp tục sử dụng Company-level tenant boundary của Application.

Canonical Company của Conversation được xác định thông qua:

```text
Conversation
    ↓
Application
    ↓
Job
    ↓
Company
```

Recruiter-side authorization được resolve:

```text
Authenticated Recruiter
        ↓
Current Company Membership
        ↓
Application current Assignee
        ↓
Job owning Company
        ↓
Current Recruitment Team
        ↓
Authorized Conversation Scope
```

Các nguyên tắc:

1. Conversation thuộc tenant của Company sở hữu Job thông qua Application.
2. Current Assigned Recruiter phải thuộc đúng Company của Job.
3. Recruiter của Company khác không được truy cập Conversation.
4. Quan hệ với một Job của Company A không cấp quyền đọc Conversation của Application thuộc Company B.
5. Company Manager không có Chat authority dù đang quản lý đúng Company.
6. Platform Admin lifecycle authority không tạo Company-side Chat authority.
7. Candidate ownership là user-scoped và độc lập với Company membership.
8. Candidate chỉ được truy cập Conversation của Application thuộc chính mình.
9. Former Assignee không giữ quyền chỉ vì từng thuộc tenant hoặc Recruitment Team.
10. Client-supplied company, application, conversation hoặc recruiter identity không tự tạo authorization.

Cross-tenant Conversation access bị cấm.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng trong V11:

1. V11 không tạo lại Application.
2. Conversation luôn thuộc một Application.
3. Một Application có tối đa một Conversation chính.
4. Application chưa từng được Assign thì chưa có Conversation.
5. First Assign tạo Conversation.
6. First Assign không tạo SYSTEM Message.
7. First Assign không tự chuyển `APPLIED → SCREENING`.
8. Chat không thay đổi Recruitment Status.
9. Chat không thay đổi Candidate, Job, source hoặc `submittedCvSnapshot`.
10. Candidate chỉ truy cập Conversation của Application thuộc chính mình.
11. Recruiter Chat authority phụ thuộc current Assignee và current eligibility.
12. Primary không phải Assignee không có Chat authority.
13. Supporting không phải Assignee không có Chat authority.
14. Company Manager không có Chat authority.
15. Platform Admin không có Chat authority.
16. NORMAL Message giữ người gửi thực tế.
17. Message cũ không đổi sender khi Assignee thay đổi.
18. Reassign không tạo Conversation mới.
19. Reassign giữ toàn bộ history.
20. Former Assignee mất current Chat authority sau Reassign.
21. Assignee mới tiếp quản toàn bộ history.
22. Reassign và Take over tạo SYSTEM Message.
23. Manual Unassign tạo SYSTEM Message nếu Conversation đã tồn tại.
24. Automatic Unassign tạo SYSTEM Message nếu Conversation đã tồn tại.
25. Assign lại sau Unassign tạo SYSTEM Message.
26. Responsibility transition cần SYSTEM Message và SYSTEM Message tương ứng phải tạo thành một business outcome thống nhất.
27. SYSTEM Message không phải Assignment History.
28. SYSTEM Message history không dùng để xác định current authorization.
29. `UNASSIGNED` không đồng nghĩa Conversation không tồn tại.
30. Conversation đã tồn tại được giữ khi Application trở lại `UNASSIGNED`.
31. Candidate được đọc nhưng không gửi khi Application `UNASSIGNED`.
32. Không Recruiter nào được đọc hoặc gửi khi non-terminal Application đang `UNASSIGNED`.
33. Assign lại dùng chính Conversation cũ.
34. Recruiter mất eligibility không được tiếp tục Chat bằng stale Assignee state.
35. Eligibility loss khóa Send ngay cả khi Automatic Unassign chưa hoàn tất;
    trong window đó Candidate chỉ đọc còn outgoing Recruiter không đọc/gửi.
36. Company lock giữ persisted assignment và Conversation.
37. Company lock freeze NORMAL Message của cả Candidate và Recruiter.
38. Persisted Assignee chỉ đọc Company-lock history khi User và CompanyMember
    đều ACTIVE; không cần current Recruitment Team membership.
39. Company lock không tự Unassign Application.
40. Job `CLOSED` không tự khóa Chat.
41. Job `EXPIRED` không tự khóa Chat.
42. `HIRED`, `REJECTED`, `WITHDRAWN` làm Conversation read-only nếu Conversation đã tồn tại.
43. Read-only Conversation không nhận NORMAL Message mới.
44. Terminal Conversation không reopen trong V11.
45. Terminal Application không xóa Conversation hoặc Message history.
46. Final Assignee chỉ đọc terminal history khi User và CompanyMember đều ACTIVE;
    không cần current Recruitment Team membership.
47. `WITHDRAWN + UNASSIGNED` sau khi đã từng có Conversation không cấp historical access cho Former Assignee.
48. `WITHDRAWN` trước First Assign không tạo Conversation.
49. Message hoàn tất hợp lệ trước state transition được giữ.
50. State transition làm sender mất quyền hoàn tất trước thì stale Send phải fail.
51. Stale Assignee, eligibility, Application status hoặc Company state không được tạo Message trái với current completed state.
52. Mất quyền truy cập không đồng nghĩa xóa Message.
53. Conversation và Message không bị xóa khi Reassign, Take over, Unassign hoặc Assign lại.
54. Conversation không phải Direct Conversation Candidate–Recruiter.
55. V11 không tạo Recruitment Status mới cho Chat.
56. Cross-tenant Conversation access bị cấm.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V11:

### 15.1. Realtime communication

Không triển khai như business capability bắt buộc của V11:

* realtime Message delivery;
* realtime SYSTEM Message;
* realtime Conversation state change;
* typing indicator;
* online/offline;
* last seen.

---

### 15.2. Notification

Defer:

* Notification persistence;
* Notification realtime;
* push notification;
* notification khi Assign/Reassign/Unassign;
* notification khi có Message mới.

SYSTEM Message trong Conversation không được coi là Notification subsystem.

---

### 15.3. Rich Message content

Defer:

* attachment;
* image;
* file;
* voice Message;
* CV attachment;
* tài liệu phỏng vấn;
* media khác.

---

### 15.4. Message interaction nâng cao

Defer:

* Edit Message;
* Delete Message;
* Reaction;
* Read receipt.

---

### 15.5. Recruitment collaboration ngoài Candidate Chat

Defer:

* internal recruitment notes;
* Company Manager đọc Chat;
* Company Manager gửi Chat;
* Platform Admin đọc Chat;
* Platform Admin gửi Chat;
* Primary đọc Chat khi không phải current Assignee;
* Former Assignee đọc history sau khi mất current authority;
* group Chat.

---

### 15.6. Historical tracking

Defer:

* Assignment History đầy đủ;
* Status History;
* Application Timeline;
* audit timeline;
* previous-Assignee history dùng như business capability.

SYSTEM Message không thay thế các capability này.

---

### 15.7. Interview scheduling

Defer:

* Interview Schedule entity;
* Candidate confirmation;
* Candidate decline;
* reschedule;
* meeting detail.

`INTERVIEW_SCHEDULED` và `INTERVIEW_COMPLETED` tiếp tục chỉ là Recruitment Status mà V11 kế thừa.

---

### 15.8. Candidate Search và Invitation

Defer:

* Candidate Search;
* Job Invitation;
* Accept Invitation;
* Reject Invitation;
* Application từ Invitation;
* Conversation trước khi có Application;
* Direct Candidate–Recruiter messaging.

Không được tự implement các nội dung defer trên như requirement bắt buộc của V11.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V11.

Các quyết định về data representation, persistence contract, API contract, Message pagination, cơ chế concurrency hoặc transaction cụ thể không thuộc Product Specification này.

---

# 17. Definition of Business Completion

V11 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — First Assign và Conversation initialization được đáp ứng;
* `F02` — Active Conversation và NORMAL Message được đáp ứng;
* `F03` — Reassign/Take over và chuyển quyền Conversation được đáp ứng;
* `F04` — Manual Unassign và Conversation pause được đáp ứng;
* `F05` — Automatic Unassign và eligibility-loss Chat boundary được đáp ứng;
* `F06` — Assign lại và Conversation resume được đáp ứng;
* `F07` — Company-lock Conversation freeze được đáp ứng;
* `F08` — Terminal read-only và historical access boundary được đáp ứng;
* `F09` — Job `CLOSED` / `EXPIRED` Chat continuity được đáp ứng;
* `F10` — concurrent business consistency được đáp ứng;
* toàn bộ `BR-01` đến `BR-55` được đáp ứng;
* một Application có tối đa một Conversation chính;
* First Assign tạo Conversation nhưng không tạo SYSTEM Message;
* Reassign, Take over, Unassign và Assign lại giữ nguyên Conversation;
* responsibility transition sau khi Conversation tồn tại tạo SYSTEM Message theo đúng rules;
* `UNASSIGNED` sau khi đã từng Assign giữ Conversation nhưng không nhận NORMAL Message mới;
* Candidate vẫn được đọc history khi `UNASSIGNED`;
* không Recruiter nào có current Conversation access khi Application `UNASSIGNED`;
* Assign lại kích hoạt cùng Conversation với Assignee mới;
* continuous Recruiter eligibility được bảo vệ;
* eligibility loss khóa Send ngay cả trước Automatic Unassign completion;
* Company lock freeze gửi Message nhưng không tự Unassign;
* persisted/final Assignee chỉ giữ historical read khi `User` và
  `CompanyMember` đều `ACTIVE`;
* terminal Application làm Conversation read-only;
* terminal `WITHDRAWN + UNASSIGNED` không tạo historical Recruiter authority;
* Job `CLOSED` hoặc `EXPIRED` không tự khóa Chat;
* sender identity của Message cũ được giữ;
* Primary, Supporting, Company Manager và Platform Admin giữ đúng authorization boundary;
* Candidate ownership boundary được giữ;
* tenant boundary được giữ;
* stale operation không ghi Message trái current completed business state;
* SYSTEM Message không bị biến thành Assignment History hoặc authorization source;
* Conversation và Message history không bị mất chỉ vì responsibility/lifecycle thay đổi;
* các capability đã defer không bị triển khai như requirement bắt buộc;
* không xuất hiện behavior ngoài boundary của version.

Việc implementation hoạt động về mặt kỹ thuật không tự động đồng nghĩa với Business Completion nếu chưa đáp ứng đầy đủ business contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V11.

Tài liệu định nghĩa:

```text
WHAT MUST HAPPEN
```

không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Tài liệu này không quy định:

* giao thức hoặc interface kỹ thuật cụ thể;
* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* persistence schema;
* embedded hay reference;
* field persistence cụ thể;
* index;
* database query;
* controller;
* service;
* route;
* middleware implementation;
* transaction implementation;
* optimistic hoặc pessimistic locking;
* source-code structure;
* framework;
* test framework.

Các quyết định kỹ thuật phải phục vụ business truth đã được định nghĩa trong tài liệu này.

Nếu data design hoặc implementation mâu thuẫn với tài liệu này, **Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
