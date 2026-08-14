# V12 — Interview Schedule Data Model

> **File:** `docs/data/versions/v12-interview-schedule-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v12-interview-schedule.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v12-interview-schedule.md
```

Product Specification là authority đối với business behavior.

Data Contract này xác định:

* dữ liệu nào của Candidate Availability phải được persist;
* dữ liệu nào của từng Interview Schedule proposal phải được persist;
* relationship với `Application`, `User`, `CompanyMember`;
* field và enum cần thiết;
* representation của `DATE + MORNING/AFTERNOON`;
* cách biểu diễn `NOT_SUBMITTED` và `SUBMITTED`;
* index và uniqueness cần thiết;
* state matrix ở persisted state;
* persistence transition;
* transaction / atomicity requirement;
* concurrency boundary giữa chỉnh Availability và tạo proposal;
* ownership giữa schema/database, service và transaction;
* historical representation của các Schedule;
* multi-tenant/data ownership;
* các field/collection từ macro database cũ chủ động không mang sang canonical V12.

Data Contract không được:

* đưa lại `InterviewSchedule.COMPLETED`;
* đưa lại arbitrary time range;
* đưa lại rollback `INTERVIEW_SCHEDULED → CONTACTED`;
* thêm Notification persistence;
* thêm event/audit persistence chỉ vì macro cũ từng có;
* tạo requirement mới ngoài Product V12.

Nếu implementation hoặc persistence design khác với contract này, contract này là authority đối với persistence truth.

---

## 2. Thay đổi so với version trước

| Entity / Collection        | Trạng thái  | Mô tả                                                                                                          |
| -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `applications`             | `UNCHANGED` | Không thêm field V12; tiếp tục sử dụng status, Candidate ownership, Job ownership và current Assignment đã có. |
| `candidate_availabilities` | `NEW`       | Lưu **một bộ Availability hiện hành** cho mỗi Application đã được Candidate submit.                            |
| `interview_schedules`      | `NEW`       | Lưu từng Interview proposal cụ thể và lịch sử proposal của Application.                                        |
| `users`                    | `UNCHANGED` | Dùng để resolve Candidate và User của Recruiter.                                                               |
| `company_members`          | `UNCHANGED` | Dùng để resolve current Assigned Recruiter và creator của proposal.                                            |
| `jobs`                     | `UNCHANGED` | Dùng để resolve Company/tenant thông qua Application.                                                          |
| `conversations`            | `UNCHANGED` | Không gắn Interview Schedule vào Conversation.                                                                 |
| `messages`                 | `UNCHANGED` | Không gắn Interview Schedule vào Message.                                                                      |

### 2.1. Entity mới

V12 canonical chỉ bổ sung hai collection:

```text
candidate_availabilities
interview_schedules
```

### 2.2. Entity được mở rộng

Không có collection cũ nào cần thêm field vì V12.

Đặc biệt, `Application` không thêm:

```text
currentInterviewScheduleId
interviewScheduleIds
candidateAvailabilityId
candidateAvailabilityIds
```

Các entity V12 tự reference về `Application`.

### 2.3. Entity giữ nguyên nhưng được sử dụng

* `Application`
* `User`
* `CompanyMember`
* `Job`
* `Conversation`
* `Message`

### 2.4. Các cấu trúc từ macro database/diagram cũ không mang sang canonical V12

Không bổ sung:

```text
InterviewScheduleEvent
Notification
InterviewScheduleSnapshot
```

trong Data Contract V12 này.

Lý do:

* Product V12 chỉ yêu cầu bảo toàn từng proposal lịch sử, không yêu cầu full transition audit trail;
* audit persistence đã được chủ động defer;
* Notification implementation thuộc version sau;
* mỗi Schedule document đã là historical record cho một proposal cụ thể;
* Product V12 không có Schedule `UPDATED` workflow cần snapshot trước/sau;
* Product V12 không có `COMPLETED`.

Macro/diagram cũ chỉ là input trước khi Product V12 được chỉnh lại và không phải persistence authority.

---

## 3. Collection / Entity tổng thể

V12 sử dụng trực tiếp:

```text
applications
candidate_availabilities
interview_schedules
```

và reference tới các entity đã có:

```text
users
company_members
jobs
```

Vai trò:

| Entity / Collection        | Responsibility                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `applications`             | Canonical Candidate ownership, Job ownership, Recruitment Status và current Assignment. |
| `candidate_availabilities` | Current Availability set Candidate đã submit cho một Application.                       |
| `interview_schedules`      | Mỗi document là một Interview proposal cụ thể; đồng thời bảo toàn proposal history.     |
| `users`                    | Canonical User identity.                                                                |
| `company_members`          | Canonical Recruiter membership và creator identity.                                     |
| `jobs`                     | Resolve Company/tenant của Application.                                                 |

Không tạo collection mới ngoài danh sách V12 canonical này.

---

# 4. Quan hệ dữ liệu

## 4.1. Application → CandidateAvailability

### Cardinality

```text
Application 1 ───── 0..1 CandidateAvailability
```

### Owner

`CandidateAvailability`

### Reference

```text
CandidateAvailability.applicationId
```

### Constraint

* `applicationId` required;
* unique;
* immutable;
* một Application có tối đa một current Availability document.

### Ý nghĩa

```text
Không có CandidateAvailability document
→ NOT_SUBMITTED

Có CandidateAvailability document
→ SUBMITTED
```

Không cần persist field:

```text
availabilityStatus
```

### Lifecycle

Candidate Availability không bị tạo khi Application chỉ mới đạt `CONTACTED`.

Document chỉ được tạo khi Candidate submit Availability lần đầu.

Sau đó các lần chỉnh sửa thay đổi current Availability document hiện hành thay vì tạo một immutable submission document mới.

---

## 4.2. Application → InterviewSchedule

### Cardinality

```text
Application 1 ───── 0..N InterviewSchedule
```

### Owner

`InterviewSchedule`

### Reference

```text
InterviewSchedule.applicationId
```

### Constraint

* required;
* immutable;
* một Application có thể có nhiều Schedule lịch sử;
* tối đa một Schedule ở active state:

```text
PROPOSED
hoặc
CONFIRMED
```

tại một thời điểm.

### Lifecycle

Mỗi lần Recruiter gửi proposal mới:

```text
→ tạo InterviewSchedule mới
```

Không tái sử dụng document `DECLINED` hoặc `CANCELLED`.

---

## 4.3. InterviewSchedule → User

### Cardinality

```text
User 1 ───── N InterviewSchedule
```

### Reference

```text
InterviewSchedule.createdByUserId
```

### Rule

Reference lưu User thực tế đã tạo proposal.

Field này:

* required;
* immutable;
* không quyết định mutation authority hiện tại.

Sau Reassign, creator cũ vẫn được bảo toàn nhưng current Assignee mới mới là actor có authority tiếp theo.

---

## 4.4. InterviewSchedule → CompanyMember

### Cardinality

```text
CompanyMember 1 ───── N InterviewSchedule
```

### Reference

```text
InterviewSchedule.createdByCompanyMemberId
```

### Rule

CompanyMember phải:

* thuộc đúng Company của Application;
* là current Assigned Recruiter tại thời điểm proposal được tạo;
* tương ứng với `createdByUserId`.

Reference này là historical creator identity.

Nó không phải current assignee reference.

---

## 4.5. InterviewSchedule và CandidateAvailability

Không tạo reference:

```text
InterviewSchedule.candidateAvailabilityId
InterviewSchedule.availabilitySlotId
InterviewSchedule.initialAvailabilityId
InterviewSchedule.initialAvailabilitySlotId
```

Schedule lưu trực tiếp immutable snapshot tối thiểu của slot được chọn:

```text
date
dayPart
timezone
```

Lý do:

* Availability hiện hành là mutable;
* Schedule là một proposal lịch sử;
* Schedule phải giữ nguyên ngày/buổi đã đề xuất dù Availability sau đó thay đổi;
* Product không yêu cầu lưu lịch sử từng Availability revision.

---

# 5. CandidateAvailability

## 5.1. Responsibility

`CandidateAvailability` chịu trách nhiệm lưu:

* Application mà Availability thuộc về;
* timezone dùng để diễn giải calendar date;
* bộ slot hiện hành;
* concurrency revision của current Availability;
* thời điểm document được tạo/cập nhật.

Entity này không chịu trách nhiệm lưu:

* lịch sử tất cả lần Candidate chỉnh Availability;
* Interview proposal;
* declined slot riêng;
* current Assigned Recruiter;
* Company;
* Job;
* Notification;
* event audit history.

---

## 5.2. Fields

| Field           | Type                 | Required | Default   | Constraint                           | Ý nghĩa                                                    |
| --------------- | -------------------- | -------: | --------- | ------------------------------------ | ---------------------------------------------------------- |
| `_id`           | `ObjectId`           |      YES | generated | unique                               | Định danh Availability.                                    |
| `applicationId` | `ObjectId`           |      YES | —         | ref `Application`, immutable, unique | Application sở hữu Availability.                           |
| `timezone`      | `String`             |      YES | —         | timezone identifier hợp lệ           | Timezone dùng để diễn giải các calendar date hiện hành.    |
| `slots`         | `AvailabilitySlot[]` |      YES | `[]`      | có thể rỗng                          | Bộ Availability hiện hành.                                 |
| `revision`      | `Integer`            |      YES | `0`       | `>= 0`                               | Concurrency guard cho chỉnh Availability và proposal race. |
| `createdAt`     | `Date`               |      YES | automatic | immutable                            | Thời điểm Candidate submit Availability lần đầu.           |
| `updatedAt`     | `Date`               |      YES | automatic | —                                    | Thời điểm current Availability được chỉnh gần nhất.        |

Không cần `submittedAt` riêng vì:

```text
document tồn tại
→ Candidate đã submit

createdAt
→ thời điểm submit lần đầu
```

Không thêm `submittedByUserId` vì Candidate canonical đã được xác định bằng:

```text
Application.candidateUserId
```

và Product V12 chưa yêu cầu historical audit của từng lần Availability submission.

---

## 5.3. Embedded document — AvailabilitySlot

```text
AvailabilitySlot {
  date
  dayPart
}
```

Fields:

| Field     | Type     | Required | Constraint                        | Ý nghĩa                       |
| --------- | -------- | -------: | --------------------------------- | ----------------------------- |
| `date`    | `String` |      YES | calendar date format `YYYY-MM-DD` | Ngày Candidate tuyên bố rảnh. |
| `dayPart` | `Enum`   |      YES | `MORNING` / `AFTERNOON`           | Buổi Candidate tuyên bố rảnh. |

Availability Slot không cần identity độc lập.

Không thêm:

```text
slotId
startAt
endAt
durationMinutes
note
```

### Local invariant

Trong một Availability document không được tồn tại hai phần tử cùng:

```text
(date, dayPart)
```

Ví dụ không hợp lệ:

```text
2026-08-20 + MORNING
2026-08-20 + MORNING
```

---

## 5.4. Enum

### `dayPart`

```text
MORNING
AFTERNOON
```

| Giá trị     | Ý nghĩa                                                      |
| ----------- | ------------------------------------------------------------ |
| `MORNING`   | Candidate rảnh trong buổi sáng của calendar date tương ứng.  |
| `AFTERNOON` | Candidate rảnh trong buổi chiều của calendar date tương ứng. |

Data Contract không gán hour boundary riêng cho hai giá trị này.

---

## 5.5. Indexes

| Index                  | Loại   | Mục đích                                                                                               |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `{ applicationId: 1 }` | Unique | Bảo đảm tối đa một current Availability document cho mỗi Application và phục vụ read theo Application. |

Không bổ sung index lịch sử Availability vì V12 không persist Availability history.

---

## 5.6. Reference rules

| Field           | Reference     | Required | Cardinality | Rule                                             |
| --------------- | ------------- | -------: | ----------- | ------------------------------------------------ |
| `applicationId` | `Application` |      YES | 0..1 → 1    | CandidateAvailability chỉ thuộc một Application. |

Service phải xác nhận authenticated Candidate:

```text
authenticatedUserId
=
Application.candidateUserId
```

khi submit/chỉnh Availability.

---

# 6. InterviewSchedule

## 6.1. Responsibility

Mỗi `InterviewSchedule` chịu trách nhiệm lưu:

* Application sở hữu proposal;
* status hiện tại của proposal;
* ngày được đề xuất;
* buổi được đề xuất;
* timezone của proposal;
* thời điểm proposal hết hiệu lực nếu vẫn `PROPOSED`;
* User và CompanyMember đã tạo proposal;
* thời điểm tạo/cập nhật.

Mỗi document là:

```text
một proposal cụ thể
```

không phải toàn bộ interview lifecycle.

---

## 6.2. Fields

| Field                      | Type       | Required | Default    | Constraint                         | Ý nghĩa                                                          |
| -------------------------- | ---------- | -------: | ---------- | ---------------------------------- | ---------------------------------------------------------------- |
| `_id`                      | `ObjectId` |      YES | generated  | unique                             | Định danh proposal.                                              |
| `applicationId`            | `ObjectId` |      YES | —          | ref `Application`, immutable       | Application sở hữu proposal.                                     |
| `status`                   | `Enum`     |      YES | `PROPOSED` | canonical enum                     | State hiện tại.                                                  |
| `date`                     | `String`   |      YES | —          | `YYYY-MM-DD`, immutable            | Calendar date được Recruiter đề xuất.                            |
| `dayPart`                  | `Enum`     |      YES | —          | `MORNING` / `AFTERNOON`, immutable | Buổi được Recruiter đề xuất.                                     |
| `timezone`                 | `String`   |      YES | —          | immutable                          | Timezone được snapshot từ current Availability khi tạo proposal. |
| `expiresAt`                | `Date`     |      YES | derived    | immutable                          | Instant bắt đầu calendar day kế tiếp theo `date + timezone`.     |
| `createdByUserId`          | `ObjectId` |      YES | —          | ref `User`, immutable              | User thực tế tạo proposal.                                       |
| `createdByCompanyMemberId` | `ObjectId` |      YES | —          | ref `CompanyMember`, immutable     | Recruiter CompanyMember thực tế tạo proposal.                    |
| `createdAt`                | `Date`     |      YES | automatic  | immutable                          | Thời điểm proposal được tạo.                                     |
| `updatedAt`                | `Date`     |      YES | automatic  | —                                  | Thời điểm status được cập nhật gần nhất.                         |

### `expiresAt`

`expiresAt` là derived persistence field.

Với:

```text
date = 2026-08-20
timezone = <timezone của proposal>
```

thì:

```text
expiresAt
=
instant tương ứng với 00:00 ngày 2026-08-21
trong timezone đó
```

Do đó cả:

```text
2026-08-20 MORNING
2026-08-20 AFTERNOON
```

đều còn hiệu lực tới hết calendar day `2026-08-20`.

`expiresAt` không phải TTL deletion.

Schedule phải được giữ làm history sau expiration.

---

## 6.3. Enum

### `status`

```text
PROPOSED
CONFIRMED
DECLINED
CANCELLED
```

| Giá trị     | Ý nghĩa persistence                                   |
| ----------- | ----------------------------------------------------- |
| `PROPOSED`  | Proposal đang chờ Candidate.                          |
| `CONFIRMED` | Candidate đã chấp nhận proposal và lịch còn hiệu lực. |
| `DECLINED`  | Candidate đã từ chối proposal.                        |
| `CANCELLED` | Proposal/lịch đã mất hiệu lực.                        |

Không có:

```text
COMPLETED
UPDATED
EXPIRED
NO_SHOW
IN_PROGRESS
RESCHEDULE_REQUESTED
```

trong Schedule status.

Proposal quá ngày chuyển sang:

```text
CANCELLED
```

chứ không tạo status `EXPIRED`.

---

## 6.4. Indexes

### Active Schedule uniqueness

```text
{ applicationId: 1 }
```

Unique partial index khi:

```text
status IN [PROPOSED, CONFIRMED]
```

Mục đích:

* một Application không có hai proposal chờ cùng lúc;
* không có `PROPOSED` mới khi đã có `CONFIRMED` còn hiệu lực;
* tối đa một active Schedule cho mỗi Application.

### Schedule history

```text
{ applicationId: 1, createdAt: -1 }
```

Mục đích:

* đọc proposal history của Application;
* lấy Schedule mới nhất.

### Declined-slot lookup

```text
{ applicationId: 1, date: 1, dayPart: 1, status: 1 }
```

Mục đích:

* kiểm tra slot đã từng bị Candidate `DECLINED`;
* ngăn proposal lại cùng slot sau một decline;
* phân biệt `DECLINED` với `CANCELLED`.

### Expiration scan

```text
{ status: 1, expiresAt: 1 }
```

Có thể giới hạn index vào `PROPOSED`.

Mục đích:

* tìm proposal `PROPOSED` đã tới `expiresAt`;
* hỗ trợ lifecycle auto-`CANCELLED`.

Không dùng TTL index.

---

## 6.5. Embedded documents

`InterviewSchedule` không sử dụng embedded event hoặc snapshot mới trong V12.

Không có:

```text
events[]
scheduleSnapshot
```

Schedule document tự lưu immutable proposal identity:

```text
date
dayPart
timezone
creator
createdAt
```

---

## 6.6. Reference rules

| Field                      | Reference       | Required | Cardinality | Rule                                          |
| -------------------------- | --------------- | -------: | ----------- | --------------------------------------------- |
| `applicationId`            | `Application`   |      YES | N → 1       | Application sở hữu Schedule.                  |
| `createdByUserId`          | `User`          |      YES | N → 1       | User tạo proposal.                            |
| `createdByCompanyMemberId` | `CompanyMember` |      YES | N → 1       | Current Assigned Recruiter tại thời điểm tạo. |

Service phải kiểm tra:

```text
createdByCompanyMemberId.userId
=
createdByUserId
```

và creator phải thuộc canonical Company của Application.

---

# 7. State Matrix

## 7.1. Application × Availability × Active Schedule

Trong bảng này:

```text
NOT_SUBMITTED = không có CandidateAvailability document
SUBMITTED     = CandidateAvailability document tồn tại
NONE          = không có Schedule PROPOSED/CONFIRMED
```

| Application state     | Availability    | Active Schedule | Hợp lệ | Ý nghĩa                                                               |
| --------------------- | --------------- | --------------- | -----: | --------------------------------------------------------------------- |
| `CONTACTED`           | `NOT_SUBMITTED` | `NONE`          |    YES | Candidate chưa phản hồi Availability.                                 |
| `CONTACTED`           | `SUBMITTED`     | `NONE`          |    YES | Candidate đã phản hồi; slots có thể rỗng hoặc có dữ liệu.             |
| `CONTACTED`           | bất kỳ          | `PROPOSED`      |     NO | Proposal đầu tiên phải commit cùng `CONTACTED → INTERVIEW_SCHEDULED`. |
| `CONTACTED`           | bất kỳ          | `CONFIRMED`     |     NO | Không thể Confirm mà Application chưa commit `INTERVIEW_SCHEDULED`.   |
| `INTERVIEW_SCHEDULED` | `NOT_SUBMITTED` | bất kỳ          |     NO | Application chỉ tới đây qua proposal dựa trên Availability đã submit. |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`     | `NONE`          |    YES | Giữa các proposal sau `DECLINED/CANCELLED`.                           |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`     | `PROPOSED`      |    YES | Đang chờ Candidate.                                                   |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`     | `CONFIRMED`     |    YES | Candidate đã xác nhận lịch.                                           |
| terminal Application  | `SUBMITTED`     | `PROPOSED`      |     NO | Active proposal phải bị cancel cùng terminal transition.              |
| terminal Application  | `SUBMITTED`     | `CONFIRMED`     |     NO | Confirmed schedule phải bị cancel cùng terminal transition.           |
| terminal Application  | `SUBMITTED`     | `NONE`          |    YES | Interview history được giữ nhưng không còn active Schedule.           |

`DECLINED` và `CANCELLED` là historical schedules nên có thể tồn tại đồng thời với:

* `NONE`;
* một Schedule `PROPOSED` mới;
* một Schedule `CONFIRMED` mới.

## 7.2. Assignment × Schedule

| Assignment state | Active Schedule | Hợp lệ | Ý nghĩa                                                                                     |
| ---------------- | --------------- | -----: | ------------------------------------------------------------------------------------------- |
| `ASSIGNED`       | `NONE`          |    YES | Không có active proposal.                                                                   |
| `ASSIGNED`       | `PROPOSED`      |    YES | Current Assignee có Recruiter mutation authority.                                           |
| `ASSIGNED`       | `CONFIRMED`     |    YES | Lịch đã được xác nhận.                                                                      |
| `UNASSIGNED`     | `NONE`          |    YES | Scheduling data được bảo toàn.                                                              |
| `UNASSIGNED`     | `PROPOSED`      |    YES | Candidate vẫn có thể phản hồi proposal; không có Recruiter mutation cho tới khi Assign lại. |
| `UNASSIGNED`     | `CONFIRMED`     |    YES | Confirmed Schedule không bị reset bởi Unassign.                                             |

Reassign/Unassign không làm thay đổi Schedule status.

## 7.3. Non-terminal Application status sau `INTERVIEW_SCHEDULED`

V12 không bổ sung coupling mới giữa active Schedule và các non-terminal pipeline state sau `INTERVIEW_SCHEDULED`.

Đặc biệt:

```text
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
```

không update `InterviewSchedule` như một phần của V12.

Chỉ Application **terminal** mới bắt buộc active Schedule:

```text
PROPOSED / CONFIRMED
→ CANCELLED
```

---

# 8. Persistence Transitions

## 8.1. Candidate submit Availability lần đầu

### Trigger business

* `F02`
* `BR-03`
* `BR-04`
* `BR-09`

### Trước

```text
Application.status = CONTACTED hoặc lifecycle hợp lệ
CandidateAvailability = absent
```

### Sau

```text
CandidateAvailability {
  applicationId
  timezone
  slots = [] hoặc N slots
  revision = 0
}

Application
→ không thay đổi
```

### Các entity thay đổi

* `CandidateAvailability`

### Các entity không thay đổi

* `Application`
* `InterviewSchedule`

### Invariant

Document tồn tại đồng nghĩa Candidate đã `SUBMITTED`.

Slots được phép rỗng.

Không tạo Schedule.

---

## 8.2. Candidate chỉnh current Availability

### Trigger business

* `F03`
* `BR-08`
* `BR-17`

### Trước

```text
CandidateAvailability.revision = R

không có InterviewSchedule status = PROPOSED
```

### Sau

```text
CandidateAvailability.slots = current set mới
CandidateAvailability.timezone = timezone hiện hành
CandidateAvailability.revision = R + 1
updatedAt = now
```

### Entity thay đổi

* `CandidateAvailability`

### Invariant

Không được commit Availability edit nếu một concurrent proposal đã trở thành `PROPOSED`.

---

## 8.3. Tạo proposal đầu tiên

### Trigger business

* `F05`
* `BR-11` đến `BR-18`

### Trước

```text
Application.status = CONTACTED

CandidateAvailability tồn tại
CandidateAvailability.revision = R

selected slot tồn tại trong current Availability

không có active Schedule
```

### Sau

```text
InterviewSchedule {
  applicationId
  status = PROPOSED
  date = selectedSlot.date
  dayPart = selectedSlot.dayPart
  timezone = CandidateAvailability.timezone
  expiresAt = derived
  createdBy...
}

Application.status = INTERVIEW_SCHEDULED

CandidateAvailability.revision = R + 1
```

Việc tăng Availability revision ở đây không thay đổi business Availability.

Nó là concurrency write để proposal creation không thể commit trên một Availability revision đã bị Candidate chỉnh đồng thời.

### Entity thay đổi

* `Application`
* `CandidateAvailability`
* `InterviewSchedule`

### Invariant

Sau commit không tồn tại:

```text
Application = CONTACTED
+
InterviewSchedule = PROPOSED
```

---

## 8.4. Tạo proposal tiếp theo

### Trigger business

* `F09`

### Trước

```text
Application.status = INTERVIEW_SCHEDULED

không có active Schedule

CandidateAvailability.revision = R

selected slot:
- thuộc current Availability
- chưa bị DECLINED trước đó
- còn hợp lệ
```

### Sau

```text
InterviewSchedule mới
status = PROPOSED

CandidateAvailability.revision = R + 1

Application.status
→ không đổi
```

### Entity thay đổi

* `CandidateAvailability`
* `InterviewSchedule`

### Entity không thay đổi

* `Application`

---

## 8.5. Candidate Confirm

### Trigger business

* `F06`

### Trước

```text
Schedule.status = PROPOSED
```

### Sau

```text
Schedule.status = CONFIRMED
updatedAt = now
```

### Entity thay đổi

* `InterviewSchedule`

### Entity không thay đổi

* `Application`
* `CandidateAvailability`

Transition phải là guarded state transition:

```text
PROPOSED → CONFIRMED
```

Schedule không còn `PROPOSED` thì Confirm phải fail.

---

## 8.6. Candidate Decline

### Trigger business

* `F07`

### Trước

```text
Schedule.status = PROPOSED
```

### Sau

```text
Schedule.status = DECLINED
updatedAt = now
```

### Entity thay đổi

* `InterviewSchedule`

### Entity không thay đổi

* `Application`
* `CandidateAvailability`

Không:

```text
Application → CONTACTED
```

Không xóa slot khỏi Candidate Availability.

Việc slot trở thành không được proposal lại được suy ra từ historical Schedule:

```text
same applicationId
same date
same dayPart
status = DECLINED
```

Không persist `disabled = true` riêng.

---

## 8.7. Recruiter Cancel proposal đang chờ

### Trigger business

* `F08`

### Trước

```text
Schedule.status = PROPOSED
```

### Sau

```text
Schedule.status = CANCELLED
```

### Entity thay đổi

* `InterviewSchedule`

### Entity không thay đổi

* `Application`
* `CandidateAvailability`

Slot không bị disable bởi cancellation.

---

## 8.8. Proposal quá ngày

### Trigger business

* `BR-25`

### Trước

```text
Schedule.status = PROPOSED
now >= Schedule.expiresAt
```

### Sau

```text
Schedule.status = CANCELLED
```

Không delete Schedule.

Không đổi Application.

Không đổi Availability.

---

## 8.9. Application trở thành terminal

### Trigger business

* `BR-29`
* `BR-39`

### Trước

Một trong:

```text
Application = non-terminal
Schedule = PROPOSED
```

hoặc:

```text
Application = non-terminal
Schedule = CONFIRMED
```

### Sau

```text
Application = terminal status tương ứng

Schedule.status = CANCELLED
```

Nếu không có active Schedule:

```text
Application terminal transition
→ không tạo Schedule mới
```

### Entity thay đổi

* `Application`
* active `InterviewSchedule` nếu tồn tại.

### Invariant

Không được commit:

```text
Application = terminal
+
Schedule = PROPOSED
```

hoặc:

```text
Application = terminal
+
Schedule = CONFIRMED
```

---

## 8.10. Reassign / Unassign

### Trigger business

* `F10`
* `BR-30`
* `BR-31`
* `BR-32`

### Sau Assignment transition

Các V12 entity:

```text
CandidateAvailability
→ không đổi

InterviewSchedule
→ không đổi
```

Không rewrite:

```text
createdByUserId
createdByCompanyMemberId
```

Current Recruiter authority luôn resolve từ canonical Assignment trên Application.

---

## 8.11. Application → INTERVIEW_COMPLETED

V12 không update Schedule.

```text
Application:
INTERVIEW_SCHEDULED
→ INTERVIEW_COMPLETED
```

không kéo theo:

```text
InterviewSchedule:
CONFIRMED → COMPLETED
```

và không yêu cầu tạo InterviewScheduleEvent.

---

# 9. Transaction / Atomicity Requirements

Transaction/atomicity trong section này chỉ áp dụng cho persisted state trong database của hệ thống.

V12 không yêu cầu:

* distributed transaction;
* external exactly-once delivery;
* SMTP atomicity;
* Cloudinary atomicity;
* Notification delivery atomicity;
* realtime delivery atomicity.

Notification không thuộc persistence scope V12.

---

## TX-01 — Tạo Interview proposal

### Business source

* `F05`
* `F09`
* `BR-12`
* `BR-16`
* `BR-17`
* `BR-18`

Trong cùng atomic workflow phải:

1. đọc và xác nhận canonical Application;
2. xác nhận current Assigned Recruiter;
3. xác nhận Application chưa terminal;
4. xác nhận current Candidate Availability;
5. xác nhận Availability revision mong đợi;
6. xác nhận selected slot thuộc current Availability;
7. xác nhận slot chưa bị Candidate `DECLINED` trước đó;
8. xác nhận không có active Schedule;
9. tạo Schedule `PROPOSED`;
10. nếu Application đang `CONTACTED`, chuyển Application sang `INTERVIEW_SCHEDULED`;
11. ghi concurrency change trên Candidate Availability revision.

Sau commit:

```text
selected proposal
+
Application state
+
validated Availability revision
```

phải cùng phản ánh một business outcome.

Không được xuất hiện partial state:

```text
Schedule = PROPOSED
nhưng
Application vẫn CONTACTED
```

đối với proposal đầu tiên.

Cũng không được xuất hiện:

```text
Schedule = PROPOSED cho slot X
nhưng concurrent Availability edit đã loại X
trước khi proposal được commit
```

Nếu Availability edit thắng race:

* proposal phải validate lại Availability mới hoặc fail.

Nếu proposal thắng race:

* Candidate edit dựa trên revision cũ phải fail/retry;
* sau commit Candidate không được chỉnh Availability khi Schedule còn `PROPOSED`.

---

## TX-02 — Candidate chỉnh Availability đối đầu proposal creation

### Business source

* `F03`
* `BR-17`

Availability edit phải được guard bởi:

```text
expected Availability revision
+
không có Schedule PROPOSED
```

và phải serialize được với `TX-01`.

Kết quả race chỉ được là một trong hai:

### Availability edit thắng trước

```text
Availability revision tăng
proposal dựa trên revision cũ không được commit
```

### Proposal thắng trước

```text
Schedule = PROPOSED
Availability edit không được commit
```

Không cho phép stale overwrite Availability sau khi proposal đã được tạo.

---

## TX-03 — Application terminal + active Schedule cancellation

### Business source

* `BR-29`
* `BR-39`

Nếu Application có Schedule:

```text
PROPOSED
hoặc
CONFIRMED
```

thì cùng persisted atomic completion phải:

1. commit terminal Application status;
2. chuyển active Schedule sang `CANCELLED`.

Sau commit:

```text
Application = terminal
→ không có active Schedule
```

Không được xuất hiện committed partial state:

```text
Application = REJECTED
Schedule = CONFIRMED
```

hoặc:

```text
Application = HIRED
Schedule = PROPOSED
```

do terminal transition của cùng business operation.

Nếu bất kỳ persisted state change bắt buộc nào thất bại:

```text
rollback toàn bộ coupled transition
```

---

## 9.4. Các operation không yêu cầu transaction mới

Không cần transaction chỉ vì V12 cho:

* first Availability creation nếu không có cross-document write;
* `PROPOSED → CONFIRMED`;
* `PROPOSED → DECLINED`;
* `PROPOSED → CANCELLED` bởi Recruiter;
* auto `PROPOSED → CANCELLED` do expiration.

Các transition này có thể được bảo vệ bằng atomic guarded write trên chính Schedule document.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

| Constraint                                                | Owner    | Lý do                                           |
| --------------------------------------------------------- | -------- | ----------------------------------------------- |
| `CandidateAvailability.applicationId` required            | Schema   | Local structural constraint.                    |
| Một Availability / Application                            | Database | Unique index.                                   |
| `slots` được phép `[]`                                    | Schema   | Product requirement có thể biểu diễn trực tiếp. |
| Slot chỉ có `date + dayPart`                              | Schema   | Structural representation.                      |
| `date` đúng format calendar date                          | Schema   | Local format validation.                        |
| `dayPart ∈ {MORNING, AFTERNOON}`                          | Schema   | Enum.                                           |
| Không duplicate `(date, dayPart)` trong cùng Availability | Schema   | Local document invariant.                       |
| Schedule status thuộc canonical enum                      | Schema   | Local enum validation.                          |
| Schedule date/dayPart/timezone immutable                  | Schema   | Proposal identity không được sửa.               |
| Creator references immutable                              | Schema   | Historical proposal identity.                   |
| Tối đa một active Schedule / Application                  | Database | Partial unique index trên `PROPOSED/CONFIRMED`. |
| `expiresAt` tồn tại                                       | Schema   | Required lifecycle field.                       |

---

## 10.2. Service bảo vệ

| Constraint                                                  | Owner                  | Lý do                                                         |
| ----------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Candidate là owner của Application                          | Service                | Cross-document authorization.                                 |
| Candidate chỉ submit/chỉnh trong lifecycle hợp lệ           | Service                | Business state rule.                                          |
| Candidate không submit ngày đã qua                          | Service                | Phụ thuộc current date/timezone.                              |
| Candidate không chỉnh khi có `PROPOSED`                     | Service + TX           | Cross-document invariant.                                     |
| Recruiter là current Assignee                               | Service                | Assignment context thuộc Application.                         |
| Recruiter còn continuous eligibility                        | Service                | V10 business authority.                                       |
| Schedule creator CompanyMember thuộc đúng Company           | Service                | Cross-document tenant check.                                  |
| `createdByUserId` khớp CompanyMember User                   | Service                | Cross-document relationship.                                  |
| Slot proposal thuộc current Availability                    | Service + TX           | Cross-document business rule.                                 |
| Slot chưa từng `DECLINED`                                   | Service                | Cần Schedule history.                                         |
| Slot proposal chưa ở quá khứ                                | Service                | Temporal business rule.                                       |
| Không proposal khi `CONFIRMED` còn hiệu lực                 | Database + Service     | Database chặn structurally; service trả business result đúng. |
| Application chưa terminal                                   | Service                | Cross-document lifecycle.                                     |
| Candidate chỉ Confirm/Decline Schedule của Application mình | Service                | Ownership.                                                    |
| Candidate chỉ Confirm/Decline `PROPOSED` còn hiệu lực       | Service + atomic write | State transition.                                             |
| Tenant boundary                                             | Service                | Cần Application → Job → Company context.                      |
| `expiresAt` đúng với `date + timezone`                      | Service                | Derived persistence value.                                    |
| Job `EXPIRED/CLOSED` không tự chặn scheduling               | Service                | Product lifecycle rule.                                       |

---

## 10.3. Transaction bảo vệ

| Constraint                                                                | Owner             |
| ------------------------------------------------------------------------- | ----------------- |
| Proposal đầu tiên và `CONTACTED → INTERVIEW_SCHEDULED` không được partial | `TX-01`           |
| Proposal không được dựa trên stale Availability                           | `TX-01` + `TX-02` |
| Candidate edit không được vượt qua proposal vừa commit                    | `TX-02`           |
| Terminal Application không được còn active Schedule                       | `TX-03`           |

Không ép schema/database tự kiểm tra business context mà nó không có.

---

# 11. Token / TTL Lifecycle

> V12 không bổ sung token/session/temporary credential persistence mới.

`InterviewSchedule.expiresAt` không phải TTL lifecycle.

Không được dùng TTL để delete expired Schedule.

Expired proposal phải:

```text
PROPOSED → CANCELLED
```

và document phải tiếp tục tồn tại làm history.

---

# 12. Multi-tenant Data Boundary

## 12.1. Canonical tenant key

V12 không persist `companyId` trực tiếp trên Availability hoặc Schedule.

Canonical tenant được resolve:

```text
CandidateAvailability / InterviewSchedule
        ↓ applicationId
Application
        ↓ jobId
Job
        ↓ companyId
Company
```

Canonical tenant key:

```text
Application.jobId → Job.companyId
```

---

## 12.2. Resource ownership

| Resource                | Tenant owner                      | Cách xác định                       |
| ----------------------- | --------------------------------- | ----------------------------------- |
| `CandidateAvailability` | Company của Job thuộc Application | `applicationId → jobId → companyId` |
| `InterviewSchedule`     | Company của Job thuộc Application | `applicationId → jobId → companyId` |

Candidate personal ownership:

```text
CandidateAvailability / Schedule
        ↓ applicationId
Application.candidateUserId
```

---

## 12.3. Recruiter tenant resolution

```text
Authenticated Recruiter User
        ↓
CompanyMember
        ↓
current Application Assignment
        ↓
Application → Job → Company
        ↓
V12 resource
```

Khi tạo Schedule:

```text
createdByCompanyMemberId.companyId
=
Application.jobId.companyId
```

phải đúng.

---

## 12.4. Cross-tenant rules

Không được:

* dùng `applicationId` của Company khác để đọc Interview data;
* tạo Schedule cho Application khác tenant;
* reference `createdByCompanyMemberId` thuộc Company khác;
* dùng client-supplied `companyId` làm authority;
* copy Availability hoặc Schedule giữa hai Application;
* thay tenant ownership của Schedule khi Reassign.

Reassign chỉ thay current responsibility.

Nó không thay Company ownership của Application hoặc Interview data.

---

# 13. Snapshot / Historical Data

## 13.1. Interview proposal history

Mỗi `InterviewSchedule` document là một historical proposal record độc lập.

Immutable historical identity gồm:

```text
applicationId
date
dayPart
timezone
createdByUserId
createdByCompanyMemberId
createdAt
```

Mutable phần lifecycle duy nhất:

```text
status
updatedAt
```

Khi proposal mới được tạo:

```text
Schedule mới
```

không overwrite Schedule cũ.

Các Schedule:

```text
DECLINED
CANCELLED
CONFIRMED
```

được giữ.

### Lưu ý với `CONFIRMED → CANCELLED`

Canonical V12 chỉ yêu cầu final current status của Schedule.

Nếu Schedule từng:

```text
PROPOSED
→ CONFIRMED
→ CANCELLED
```

thì persisted Schedule cuối cùng là:

```text
CANCELLED
```

V12 không yêu cầu persist đầy đủ transition timeline chứng minh Schedule từng `CONFIRMED`.

Full audit trail đã được defer.

---

## 13.2. Candidate Availability history

V12 không persist từng historical submission của Candidate Availability.

Canonical representation là:

```text
một current Availability document / Application
```

Các lần chỉnh sửa update:

```text
slots
timezone
revision
updatedAt
```

Không tạo một document mới cho mỗi lần chỉnh.

Nếu version sau cần Availability audit/history, version đó phải bổ sung contract riêng.

---

## 13.3. Schedule snapshot khỏi current Availability

Khi tạo Schedule, Schedule copy:

```text
date
dayPart
timezone
```

từ slot/current Availability đã được validate.

Sau đó:

```text
Schedule snapshot fields
!=
live Availability
```

Candidate chỉnh Availability sau khi proposal kết thúc không làm thay đổi Schedule lịch sử.

---

# 14. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V12:

### Không thêm collection

```text
interview_schedule_events
notifications
candidate_availability_history
interview_schedule_snapshots
```

### Không thêm Application fields

```text
currentInterviewScheduleId
interviewScheduleIds
candidateAvailabilityId
candidateAvailabilityIds
```

### Không thêm CandidateAvailability fields

```text
status
submittedByUserId
submittedAt
history
previousAvailabilityId
disabledSlots
jobId
companyId
```

### Không thêm AvailabilitySlot fields

```text
slotId
startAt
endAt
durationMinutes
note
```

### Không thêm InterviewSchedule fields

```text
initialAvailabilityId
initialAvailabilitySlotId

startAt
endAt
durationMinutes

mode
address
meetingLink
note
declineReason

completedAt

assignedRecruiterCompanyMemberId
currentAssigneeId

companyId
jobId

events
snapshot
```

### Không thêm Schedule states

```text
COMPLETED
EXPIRED
UPDATED
IN_PROGRESS
NO_SHOW
RESCHEDULE_REQUESTED
```

### Không thêm persistence chỉ cho future Notification

Không thêm:

```text
notificationSent
notificationId
notificationReadAt
outboxEvent
deliveryStatus
```

chỉ để chuẩn bị trước cho version Notification.

Business state change của V12 có thể được version Notification tích hợp sau mà không biến Notification persistence thành requirement của V12.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

### Application ownership

```text
Application.candidateUserId
```

tiếp tục là Candidate authority.

### Application tenant

```text
Application.jobId → Job.companyId
```

tiếp tục là Company authority.

### Assignment

```text
Application.assignedRecruiterCompanyMemberId
```

tiếp tục xác định current Assigned Recruiter.

V12 không lưu duplicate current Assignee trong Schedule.

### Recruitment Pipeline

V12 chỉ trực tiếp bổ sung persisted transition:

```text
CONTACTED → INTERVIEW_SCHEDULED
```

khi proposal đầu tiên được tạo.

Không đưa lại:

```text
INTERVIEW_SCHEDULED → CONTACTED
```

do Schedule decline/cancel.

### INTERVIEW_COMPLETED

V12 không couple:

```text
Schedule → COMPLETED
```

với:

```text
Application → INTERVIEW_COMPLETED
```

### Job lifecycle

Job:

```text
CLOSED
EXPIRED
```

không tự delete Availability hoặc cancel Schedule.

### V11 Chat

Không thay đổi:

* `Conversation`;
* `Message`;
* Conversation authorization;
* Chat authority.

---

## 15.2. Persistence behavior phải giữ

Reassign:

```text
InterviewSchedule
CandidateAvailability
→ không rewrite
```

Unassign:

```text
InterviewSchedule
CandidateAvailability
→ không reset
```

Candidate vẫn có thể phản hồi `PROPOSED` trong khoảng Application `UNASSIGNED`.

---

## 15.3. Pre-V12 persisted Applications

Application đã tồn tại trước V12 ở `INTERVIEW_SCHEDULED` hoặc một status phía
sau không bị backfill Candidate Availability hoặc Interview Schedule giả chỉ
để thỏa cấu trúc V12.

Các record đó được giữ theo historical truth của version đã tạo chúng.

Không rollback Application.

Không tự tạo Availability.

Không tự tạo Schedule.

Không suy diễn một proposal hoặc confirmation chưa từng xảy ra.

State Matrix V12 mô tả canonical state của scheduling flow được tạo theo V12;
legacy pre-V12 data là compatibility exception và không được dùng làm mẫu để
tạo state mới sau cutover.

Sau cutover, không được tạo thêm legacy state mới.

---

## 15.4. Thay đổi được phép so với macro V12 cũ

Canonical V12 chủ động thay:

```text
Availability append-only submissions
→ one mutable current Availability
```

```text
startAt/endAt
→ date + dayPart
```

```text
slots.length > 0
→ slots có thể []
```

```text
Schedule startAt + duration
→ date + dayPart
```

```text
COMPLETED
→ removed
```

```text
DECLINED/CANCELLED rollback Application
→ removed
```

```text
Notification persistence trong V12
→ removed khỏi V12
```

```text
InterviewScheduleEvent persistence
→ deferred
```

---

## 15.5. Thay đổi không được phép

Không được implementation âm thầm:

* thêm lại `COMPLETED`;
* bắt Candidate phải có ít nhất một slot mới được submit;
* giới hạn Availability bởi `Job.expiredAt`;
* cho Recruiter proposal ngoài Availability;
* xóa history Schedule cũ khi proposal mới được tạo;
* cho `CANCELLED` disable slot giống `DECLINED`;
* rollback Application về `CONTACTED`;
* reset Schedule khi Reassign/Unassign;
* mở Chat authority từ Interview read authority;
* thêm Notification vào atomic completion V12.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở persisted state.

## PI-01 — Một current Availability mỗi Application

```text
Application
→ tối đa 1 CandidateAvailability
```

**Owner:** Database unique index.

---

## PI-02 — Absence biểu diễn NOT_SUBMITTED

```text
CandidateAvailability absent
→ NOT_SUBMITTED
```

Không cần status field.

**Owner:** Data representation + Service.

---

## PI-03 — Availability rỗng hợp lệ

```text
CandidateAvailability exists
slots = []
```

là persisted state hợp lệ.

**Owner:** Schema.

---

## PI-04 — Không duplicate Availability slot

Trong cùng Availability:

```text
(date, dayPart)
```

không trùng nhau.

**Owner:** Schema/local validation.

---

## PI-05 — Schedule proposal identity immutable

Sau khi tạo Schedule:

```text
applicationId
date
dayPart
timezone
creator
```

không thay đổi.

**Owner:** Schema.

---

## PI-06 — Tối đa một active Schedule

Mỗi Application có tối đa một Schedule:

```text
status IN [PROPOSED, CONFIRMED]
```

**Owner:** Database partial unique index.

---

## PI-07 — First proposal không tồn tại với CONTACTED sau commit

Không có committed state:

```text
Application = CONTACTED
Schedule = PROPOSED
```

do proposal đầu tiên.

**Owner:** `TX-01`.

---

## PI-08 — PROPOSED phải dựa trên current Availability revision hợp lệ

Tại thời điểm proposal commit:

* Candidate Availability tồn tại;
* selected slot thuộc Availability;
* proposal và concurrent Availability edit không được cùng thắng trên stale state.

**Owner:** Service + `TX-01` + `TX-02`.

---

## PI-09 — PROPOSED khóa Availability edit

Nếu tồn tại:

```text
Schedule.status = PROPOSED
```

Candidate Availability không được commit edit mới.

**Owner:** Service + transaction concurrency guard.

---

## PI-10 — Slot DECLINED không được proposal lại

Sau khi một Schedule:

```text
(date = D, dayPart = P)
status = DECLINED
```

không được tạo Schedule mới hơn cho cùng Application với:

```text
date = D
dayPart = P
```

**Owner:** Service + historical lookup.

---

## PI-11 — CANCELLED không disable slot

Schedule `CANCELLED` tự nó không cấm proposal mới cùng `(date, dayPart)`.

**Owner:** Service.

---

## PI-12 — Schedule history không bị overwrite

Proposal mới:

```text
→ insert Schedule mới
```

không mutate Schedule terminal cũ thành `PROPOSED`.

**Owner:** Service.

---

## PI-13 — Proposal hết ngày không bị delete

Khi:

```text
now >= expiresAt
status = PROPOSED
```

Schedule phải chuyển:

```text
CANCELLED
```

và document vẫn tồn tại.

**Owner:** Service/System lifecycle.

---

## PI-14 — Terminal Application không có active Schedule

Sau terminal transaction commit:

```text
Application = terminal
→ không Schedule PROPOSED/CONFIRMED
```

**Owner:** `TX-03` + database active uniqueness.

---

## PI-15 — Reassign không rewrite creator

```text
createdByUserId
createdByCompanyMemberId
```

không đổi sau Reassign.

**Owner:** Schema + Service.

---

## PI-16 — Unassign không reset V12 data

```text
UNASSIGNED
```

không xóa hoặc reset:

* Availability;
* Schedule;
* Schedule status.

**Owner:** Service / V10 integration.

---

## PI-17 — Cross-tenant Schedule không tồn tại

Schedule creator và Application phải thuộc cùng canonical Company.

**Owner:** Service.

---

## PI-18 — Candidate cross-Application mutation bị cấm

Candidate chỉ được mutate V12 data khi:

```text
Application.candidateUserId
=
authenticated Candidate User
```

**Owner:** Service.

---

## PI-19 — Schedule không phụ thuộc Conversation

Không tồn tại V12 reference làm:

```text
InterviewSchedule → Conversation
InterviewSchedule → Message
```

**Owner:** Schema/Data Contract.

---

## PI-20 — INTERVIEW_COMPLETED không update Schedule

Application pipeline transition:

```text
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
```

không có V12 persisted Schedule transition bắt buộc.

**Owner:** Service integration boundary.

---

# 17. Definition of Data Completion

V12 Data Contract được coi là hoàn thành khi:

* `candidate_availabilities` được xác định;
* `interview_schedules` được xác định;
* `Application` không bị thêm duplicate V12 reference fields;
* `NOT_SUBMITTED` / `SUBMITTED` có canonical persistence representation;
* Availability rỗng được persist hợp lệ;
* `DATE + MORNING/AFTERNOON` được persist rõ ràng;
* timezone/date expiration representation đã rõ;
* current Availability có concurrency revision;
* từng proposal là một Schedule document độc lập;
* Schedule enum chỉ còn bốn state canonical;
* partial unique active-Schedule invariant được định nghĩa;
* declined-slot lookup được hỗ trợ;
* Schedule expiration lookup được hỗ trợ;
* Availability edit/proposal concurrency boundary đã rõ;
* first proposal/Application transition atomicity đã rõ;
* terminal Application/Schedule cancellation atomicity đã rõ;
* schema/database/service/transaction constraint ownership đã rõ;
* tenant ownership được resolve từ Application/Job thay vì duplicate `companyId`;
* Availability history không bị implementation ngoài ý muốn;
* InterviewScheduleEvent không bị implementation ngoài ý muốn;
* Notification không bị implementation ngoài ý muốn;
* `COMPLETED`, arbitrary start/end time và interview mode/location không bị mang lại từ macro cũ;
* compatibility với V10/V11 được giữ;
* toàn bộ Persistence Invariants có enforcement owner rõ ràng.

Data Completion không đồng nghĩa schema đã được code.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự quyết định lại business hoặc data architecture quan trọng.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V12.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* collection;
* fields;
* embedded documents;
* references;
* relationships;
* cardinality;
* enums;
* indexes;
* uniqueness;
* derived persistence fields;
* persisted state;
* persistence transitions;
* transaction/atomicity requirements;
* concurrency persistence requirements;
* historical representation;
* persistence invariants;
* ownership của constraint.

Tài liệu này không định nghĩa:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* controller;
* route;
* middleware implementation;
* service function structure;
* database query cụ thể;
* persistence library method cụ thể;
* source-code structure;
* scheduler implementation cụ thể;
* UI Calendar;
* Notification implementation;
* realtime implementation;
* test framework.

Boundary canonical:

```text
Product Specification
        │
        │ business truth
        ↓
Data Contract
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture/concurrency mechanics
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
→ implementation evidence

Raw macro database / entity diagram
→ input material only
```

Nếu raw macro database hoặc diagram khác tài liệu này, chúng không override canonical Product/Data Contract.

Nếu implementation cần một business behavior chưa có trong Product Specification, vấn đề đó phải quay lại Product layer thay vì được tự bổ sung trong persistence layer.
