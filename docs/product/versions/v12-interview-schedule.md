# V12 — Interview Schedule

> **File:** `docs/product/versions/v12-interview-schedule.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V12.

---

## 1. Mục tiêu

V12 bổ sung quy trình thu thập lịch rảnh và thống nhất lịch phỏng vấn trong phạm vi một `Application`.

Sau khi `Application` được đưa tới `CONTACTED`:

1. Candidate được yêu cầu cung cấp lịch rảnh;
2. Candidate chủ động gửi bộ lịch rảnh hiện hành như tín hiệu tiếp tục tham gia quy trình tuyển dụng;
3. Assigned Recruiter chỉ được chọn một ngày/buổi nằm trong lịch rảnh Candidate đã cung cấp;
4. Recruiter gửi một đề xuất phỏng vấn cụ thể;
5. Candidate xác nhận hoặc từ chối đề xuất;
6. đề xuất có thể bị Recruiter hoặc hệ thống làm mất hiệu lực trong các trường hợp hợp lệ;
7. Assignment/Reassign/Unassign nội bộ Company không làm reset quy trình Candidate-facing;
8. lifecycle của `InterviewSchedule` không thay thế Recruitment Pipeline của `Application`.

V12 tách rõ ba khái niệm:

```text
Application Recruitment Status
≠
Candidate Availability
≠
Interview Schedule
```

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V12 bao gồm:

* mở quy trình cung cấp lịch rảnh khi `Application` đạt `CONTACTED`;
* xác định Candidate đã gửi lịch rảnh hay chưa;
* cho phép Candidate gửi bộ lịch rảnh hiện hành;
* cho phép Candidate gửi một bộ lịch rảnh rỗng;
* cho phép Candidate chỉnh sửa lịch rảnh khi nghiệp vụ cho phép;
* biểu diễn lịch rảnh theo `ngày + MORNING/AFTERNOON`;
* cho Assigned Recruiter xem trạng thái gửi lịch và bộ lịch rảnh hiện hành;
* cho Assigned Recruiter chọn một slot hợp lệ từ lịch rảnh Candidate;
* tạo đề xuất phỏng vấn ở `PROPOSED`;
* chuyển `Application` từ `CONTACTED` sang `INTERVIEW_SCHEDULED` khi proposal đầu tiên được gửi;
* Candidate xác nhận proposal;
* Candidate từ chối proposal;
* Recruiter thu hồi proposal đang chờ;
* hệ thống tự hủy proposal đã quá ngày;
* hủy Schedule còn hiệu lực khi `Application` kết thúc;
* cho phép gửi proposal mới sau `DECLINED` hoặc `CANCELLED` nếu còn điều kiện hợp lệ;
* giữ lịch sử các proposal đã phát sinh;
* bảo toàn Availability và Schedule qua Reassign hoặc Unassign;
* kế thừa authorization đọc từ `Application`;
* xác định các business state cần version Notification sử dụng về sau.

### 2.2. Ngoài phạm vi

V12 không triển khai:

* giao diện Calendar cụ thể;
* Notification persistence;
* Notification API;
* Notification realtime;
* Socket.IO;
* thời gian phỏng vấn chính xác theo giờ/phút;
* thời lượng phỏng vấn;
* ghi chú trên từng availability slot;
* panel hoặc nhiều Interviewer;
* phân quyền cho Interviewer;
* nhiều vòng phỏng vấn;
* `NO_SHOW`;
* `RESCHEDULE_REQUESTED`;
* `IN_PROGRESS`;
* `COMPLETED` trong lifecycle của `InterviewSchedule`;
* video call;
* tích hợp Google Meet, Zoom hoặc nền tảng họp bên ngoài;
* tạo meeting tự động;
* thay đổi Conversation hoặc Message;
* thiết kế persistence hoặc audit schema cụ thể.

Không suy diễn hoặc tự bổ sung chức năng ngoài phạm vi đã chốt.

---

## 3. Dependency với các version trước

V12 sử dụng các business contract đã có:

* V05 — Job lifecycle và trạng thái `CLOSED` / `EXPIRED`;
* V09 — `Application` và Candidate ownership;
* V10 — Recruitment Pipeline;
* V10 — Assignment / Reassign / Unassign và current Assigned Recruiter;
* V10 — Application terminal lifecycle;
* V11 — Conversation và Chat thuộc `Application`.

V12 không tạo lại `Application`.

V12 không thay đổi:

* Candidate của `Application`;
* Job của `Application`;
* source của `Application`;
* submitted CV snapshot;
* Assignment model;
* Recruitment Team;
* Job lifecycle;
* Conversation ownership;
* quyền Chat đã được chốt ở V11.

V12 chỉ bổ sung Candidate Availability và Interview Schedule vào lifecycle của `Application`.

Nếu một invariant của version trước không bị tài liệu này chủ động override thì invariant đó tiếp tục có hiệu lực.

### 3.1. Override transition `CONTACTED → INTERVIEW_SCHEDULED`

Kể từ V12, transition:

```text
CONTACTED → INTERVIEW_SCHEDULED
```

không còn được thực hiện như một Recruitment Pipeline mutation độc lập.

Transition này chỉ hợp lệ khi là một phần của cùng business outcome tạo
Interview Schedule đầu tiên ở trạng thái `PROPOSED`.

Mọi Application mutation surface thuộc các version trước phải tuân theo rule
này khi V12 có hiệu lực.

V12 không thay đổi transition:

```text
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
```

vốn tiếp tục thuộc Recruitment Pipeline độc lập.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Candidate

Candidate sở hữu `Application`.

Trong V12, Candidate:

* nhận yêu cầu cung cấp lịch rảnh;
* gửi hoặc chỉnh sửa lịch rảnh;
* xem proposal thuộc `Application` của mình;
* xác nhận hoặc từ chối proposal đang `PROPOSED`.

### 4.2. Assigned Recruiter

Recruiter đang là current Assignee của `Application`.

Assigned Recruiter là Recruiter duy nhất được trực tiếp:

* xem Candidate Availability phục vụ xử lý Application;
* chọn slot để gửi proposal;
* tạo Interview Schedule;
* thu hồi proposal đang chờ.

Quyền thao tác luôn đi theo current Assignee, không đi theo người từng tạo Schedule.

### 4.3. Candidate Availability

Candidate Availability là bộ ngày/buổi Candidate hiện tuyên bố có thể tham gia phỏng vấn.

Candidate Availability:

* thuộc một `Application`;
* không phải Interview Schedule;
* có thể đã được submit nhưng không có slot nào;
* có thể được Candidate chỉnh sửa khi không bị khóa bởi một proposal đang chờ.

### 4.4. Availability Slot

Một availability slot có business granularity:

```text
DATE + DAY_PART
```

Trong đó `DAY_PART` chỉ gồm:

```text
MORNING
AFTERNOON
```

Ví dụ:

```text
2026-08-20 + MORNING
2026-08-20 + AFTERNOON
```

V12 không gán giờ bắt đầu/kết thúc cụ thể cho `MORNING` hoặc `AFTERNOON`.

### 4.5. Interview Schedule

Mỗi `InterviewSchedule` đại diện cho **một proposal cụ thể** do Assigned Recruiter gửi tới Candidate.

Một Schedule không đại diện cho toàn bộ vòng phỏng vấn.

Một Application có thể có nhiều Schedule lịch sử do nhiều proposal khác nhau.

### 4.6. System

System thực hiện các hậu quả lifecycle tự động đã được V12 chốt, bao gồm:

* làm `PROPOSED` mất hiệu lực khi ngày proposal đã qua;
* làm Schedule còn hiệu lực mất hiệu lực khi Application kết thúc.

---

## 5. Quan hệ nghiệp vụ chính

```text
Job
 │
 └── Application
      │
      ├── Candidate Availability
      │     └── 0..N Availability Slot hiện hành
      │
      └── 0..N Interview Schedule
            └── mỗi Schedule = một proposal cụ thể
```

Các nguyên tắc:

* Candidate Availability luôn thuộc một `Application`;
* Interview Schedule luôn thuộc một `Application`;
* Candidate Availability không thuộc Candidate nói chung;
* Interview Schedule không thuộc Candidate nói chung;
* Interview Schedule không thuộc cặp Candidate–Recruiter lâu dài;
* Reassign không đổi ownership của Interview Schedule;
* một Schedule lịch sử tiếp tục thuộc Application ban đầu;
* nhiều Schedule không đồng nghĩa nhiều vòng phỏng vấn.

Phần này chỉ mô tả quan hệ nghiệp vụ.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Trạng thái Candidate Availability

Ở mức business, Availability có hai tình trạng:

| Trạng thái      | Ý nghĩa                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `NOT_SUBMITTED` | Candidate chưa phản hồi yêu cầu cung cấp lịch rảnh.                                    |
| `SUBMITTED`     | Candidate đã chủ động gửi Availability. Bộ Availability có thể chứa 0 hoặc nhiều slot. |

`SUBMITTED` không đồng nghĩa với việc Candidate có ít nhất một slot rảnh.

Ví dụ hợp lệ:

```text
Availability = SUBMITTED
Slots = []
```

### 6.2. Trạng thái Interview Schedule

V12 sử dụng đúng bốn trạng thái:

| Trạng thái  | Ý nghĩa                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `PROPOSED`  | Assigned Recruiter đã gửi một proposal cụ thể và đang chờ Candidate phản hồi. |
| `CONFIRMED` | Candidate đã chấp nhận ngày/buổi được đề xuất.                                |
| `DECLINED`  | Candidate đã chủ động từ chối proposal.                                       |
| `CANCELLED` | Proposal hoặc lịch đã được Recruiter/System làm mất hiệu lực.                 |

V12 không có `InterviewSchedule.COMPLETED`.

### 6.3. Application Status liên quan

Các Application Status trực tiếp liên quan tới V12:

* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

Các terminal status và transition terminal tiếp tục do canonical Application lifecycle xác định.

V12 không định nghĩa lại toàn bộ Recruitment Pipeline.

---

## 7. Tổ hợp trạng thái hợp lệ

Các tổ hợp chính trong lifecycle scheduling:

| Application           | Availability            | Schedule hiện tại          | Ý nghĩa                                                                                                                                |
| --------------------- | ----------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTACTED`           | `NOT_SUBMITTED`         | Không có                   | Candidate chưa phản hồi yêu cầu cung cấp lịch.                                                                                         |
| `CONTACTED`           | `SUBMITTED` với 0 slot  | Không có                   | Candidate đã phản hồi nhưng hiện không đưa ra slot rảnh.                                                                               |
| `CONTACTED`           | `SUBMITTED` với ≥1 slot | Không có                   | Recruiter có thể chọn slot hợp lệ để gửi proposal đầu tiên.                                                                            |
| `CONTACTED`           | `SUBMITTED`             | `PROPOSED`                 | Chỉ tồn tại trong cùng business outcome chuyển Application sang `INTERVIEW_SCHEDULED`; committed state cuối không được giữ tổ hợp này. |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`             | `PROPOSED`                 | Đang chờ Candidate phản hồi proposal.                                                                                                  |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`             | `DECLINED`                 | Proposal gần nhất bị Candidate từ chối; Application không rollback.                                                                    |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`             | `CANCELLED`                | Proposal gần nhất đã mất hiệu lực; Application không rollback.                                                                         |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`             | `CONFIRMED`                | Candidate đã chấp nhận lịch phỏng vấn.                                                                                                 |
| `INTERVIEW_SCHEDULED` | `SUBMITTED`             | Không có proposal đang chờ | Có thể xảy ra giữa các lần proposal sau `DECLINED` hoặc `CANCELLED`.                                                                   |

Một Application có thể có nhiều Schedule lịch sử nhưng tối đa một Schedule `PROPOSED` tại một thời điểm.

Các Application Status ngoài lifecycle scheduling của V12 tiếp tục tuân theo canonical Recruitment Pipeline và không bị bảng này phủ định.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Application = SCREENING
        ↓
Assigned Recruiter chuyển hợp lệ
        ↓
Application = CONTACTED
        ↓
Candidate được yêu cầu cung cấp lịch rảnh
        ↓
Candidate có thể:
  - chưa phản hồi;
  - submit lịch rỗng;
  - submit một hoặc nhiều slot
        ↓
Application vẫn CONTACTED
        ↓
Assigned Recruiter xem Availability
        ↓
Nếu có slot hợp lệ:
Assigned Recruiter chọn một slot
        ↓
Tạo Interview Schedule = PROPOSED
        ↓
Application CONTACTED → INTERVIEW_SCHEDULED
        ↓
Candidate phản hồi
        ├──────── CONFIRM ────────→ Schedule = CONFIRMED
        │
        └──────── DECLINE ────────→ Schedule = DECLINED
                                     Application vẫn INTERVIEW_SCHEDULED

Hoặc Recruiter/System:
PROPOSED → CANCELLED
Application vẫn INTERVIEW_SCHEDULED

Sau DECLINED/CANCELLED:
        ↓
Candidate có thể chỉnh Availability
        ↓
Recruiter có thể gửi proposal khác nếu đủ điều kiện

Sau CONFIRMED:
        ↓
V12 coi việc thống nhất lịch đã hoàn thành
        ↓
Recruitment Pipeline tiếp tục độc lập
        ↓
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
```

---

# 9. Functional Requirements

## F01 — Mở quy trình cung cấp lịch rảnh

### Actor

* Assigned Recruiter;
* Candidate.

### Mục tiêu

Bắt đầu quy trình Interview Schedule khi Application đạt `CONTACTED`.

### Tiền điều kiện

* `Application` tồn tại;
* transition sang `CONTACTED` hợp lệ theo Recruitment Pipeline hiện hành.

### Luồng chính

1. Assigned Recruiter chuyển Application hợp lệ tới `CONTACTED`.
2. Hệ thống ghi nhận rằng Candidate cần cung cấp lịch rảnh.
3. Candidate có thể bắt đầu phản hồi Availability.
4. Application vẫn ở `CONTACTED` cho tới khi Recruiter gửi proposal đầu tiên.

### Kết quả

* quy trình scheduling được mở;
* Candidate Availability ban đầu ở tình trạng `NOT_SUBMITTED`.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`

### Không thuộc chức năng này

* triển khai Notification;
* UI Notification;
* realtime.

---

## F02 — Candidate gửi lịch rảnh

### Actor

* Candidate owner của Application.

### Mục tiêu

Cho Candidate chủ động xác nhận rằng mình vẫn tiếp tục quy trình tuyển dụng và cung cấp các ngày/buổi có thể tham gia.

### Tiền điều kiện

* Application thuộc Candidate hiện tại;
* Application đã bước vào lifecycle scheduling hợp lệ;
* không có proposal `PROPOSED` đang khóa Availability.

### Luồng chính

1. Candidate chọn 0 hoặc nhiều slot.
2. Mỗi slot gồm ngày và `MORNING` hoặc `AFTERNOON`.
3. Candidate submit Availability.
4. Availability chuyển từ `NOT_SUBMITTED` sang `SUBMITTED`, hoặc cập nhật bộ `SUBMITTED` hiện hành.

### Kết quả

* Recruiter có thể phân biệt Candidate đã phản hồi hay chưa;
* Application không đổi status;
* không tạo Interview Schedule.

### Trường hợp từ chối

* Candidate thao tác Application không thuộc mình;
* Candidate chọn ngày trong quá khứ;
* có Schedule `PROPOSED` đang chờ phản hồi.

### Business Rules liên quan

* `BR-03`
* `BR-04`
* `BR-05`
* `BR-06`
* `BR-07`
* `BR-08`
* `BR-09`

---

## F03 — Candidate chỉnh sửa Availability

### Actor

* Candidate owner.

### Mục tiêu

Cho Candidate duy trì bộ lịch rảnh hiện hành trước hoặc giữa các proposal.

### Tiền điều kiện

* Candidate có quyền trên Application;
* không có Schedule `PROPOSED` đang chờ Candidate.

### Luồng chính

Candidate có thể:

* thêm slot;
* bỏ slot;
* đưa bộ Availability về rỗng;
* gửi lại bộ Availability mới nhất.

### Kết quả

* Recruiter đọc lại phải thấy bộ Availability hiện hành;
* lịch sử Schedule đã tồn tại không bị thay đổi;
* slot từng bị Candidate `DECLINED` không trở thành proposal hợp lệ trở lại chỉ vì Candidate chỉnh Availability.

### Trường hợp từ chối

* có Schedule `PROPOSED` đang chờ;
* Candidate thao tác Application không thuộc mình;
* slot mới nằm trong quá khứ.

### Business Rules liên quan

* `BR-06`
* `BR-08`
* `BR-13`
* `BR-14`

---

## F04 — Recruiter xem trạng thái Availability

### Actor

* actor có quyền đọc Application theo canonical authorization hiện hành.

### Mục tiêu

Cho phía xử lý Application biết Candidate đã phản hồi yêu cầu scheduling hay chưa và hiện có những slot nào.

### Kết quả

Phải phân biệt được:

```text
NOT_SUBMITTED
```

với:

```text
SUBMITTED + 0 slot
```

và:

```text
SUBMITTED + ≥1 slot
```

### Business Rules liên quan

* `BR-03`
* `BR-04`
* `BR-10`
* `BR-33`

---

## F05 — Assigned Recruiter gửi proposal phỏng vấn

### Actor

* current Assigned Recruiter.

### Mục tiêu

Đề xuất một ngày/buổi phỏng vấn cụ thể từ Availability của Candidate.

### Tiền điều kiện

* actor là current Assigned Recruiter;
* Candidate đã submit Availability;
* có slot hợp lệ;
* slot thuộc bộ Availability hiện hành;
* slot không nằm trong quá khứ;
* slot chưa bị Candidate từ chối trước đó;
* không tồn tại Schedule `PROPOSED`;
* không tồn tại Schedule `CONFIRMED` còn hiệu lực;
* Application chưa terminal.

### Luồng chính

1. Recruiter chọn một slot hợp lệ.
2. Recruiter gửi proposal.
3. Một Interview Schedule mới được tạo với `PROPOSED`.
4. Nếu đây là proposal đầu tiên khi Application còn `CONTACTED`, Application chuyển sang `INTERVIEW_SCHEDULED`.
5. Candidate Availability bị khóa chỉnh sửa trong lúc proposal đang `PROPOSED`.

### Kết quả

* Candidate có đúng một proposal đang chờ;
* Recruiter không được tạo proposal thứ hai cho tới khi proposal hiện tại kết thúc.

### Trường hợp từ chối

* actor không phải current Assignee;
* Candidate chưa submit Availability;
* Availability rỗng;
* chọn slot ngoài Availability;
* chọn slot trong quá khứ;
* chọn slot đã từng bị Candidate từ chối;
* đang có proposal `PROPOSED`;
* đã có Schedule `CONFIRMED` còn hiệu lực;
* Application terminal.

### Business Rules liên quan

* `BR-11` đến `BR-18`
* `BR-25`

---

## F06 — Candidate xác nhận proposal

### Actor

* Candidate owner.

### Mục tiêu

Xác nhận chấp nhận ngày/buổi do Recruiter đề xuất.

### Tiền điều kiện

* Schedule thuộc Application của Candidate;
* Schedule đang `PROPOSED`;
* Schedule chưa bị hủy hoặc quá hạn;
* Application chưa terminal.

### Luồng chính

1. Candidate xác nhận proposal.
2. Schedule chuyển `PROPOSED → CONFIRMED`.

### Kết quả

* Application vẫn `INTERVIEW_SCHEDULED`;
* V12 coi việc thống nhất lịch đã đạt kết quả thành công;
* không tạo thêm Schedule mới khi `CONFIRMED` còn hiệu lực.

### Business Rules liên quan

* `BR-19`
* `BR-21`
* `BR-22`
* `BR-24`
* `BR-26`

---

## F07 — Candidate từ chối proposal

### Actor

* Candidate owner.

### Mục tiêu

Từ chối ngày/buổi cụ thể do Recruiter đề xuất mà không rollback Recruitment Pipeline.

### Tiền điều kiện

* Schedule thuộc Application của Candidate;
* Schedule đang `PROPOSED`;
* Schedule vẫn còn hiệu lực.

### Luồng chính

1. Candidate từ chối proposal.
2. Schedule chuyển `PROPOSED → DECLINED`.
3. Application tiếp tục giữ `INTERVIEW_SCHEDULED`.
4. Slot của proposal bị đánh dấu không còn được phép đề xuất lại cho Application này.
5. Candidate được chỉnh Availability trở lại.
6. Recruiter có thể gửi proposal khác nếu còn slot hợp lệ.

### Kết quả

* proposal cũ được giữ làm lịch sử;
* Application không quay về `CONTACTED`.

### Business Rules liên quan

* `BR-13`
* `BR-20`
* `BR-22`
* `BR-27`

---

## F08 — Hủy hoặc hết hiệu lực proposal

### Actor

* current Assigned Recruiter đối với proposal đang chờ;
* System đối với lifecycle tự động.

### Mục tiêu

Làm một proposal không còn giá trị mà không coi đó là Candidate từ chối.

### Luồng chính

Các trường hợp gồm:

1. Recruiter thu hồi Schedule `PROPOSED`;
2. ngày của Schedule `PROPOSED` đã qua mà Candidate chưa phản hồi;
3. Application trở thành terminal khi Schedule đang `PROPOSED`;
4. Application trở thành terminal khi Schedule đang `CONFIRMED`.

### Kết quả

Schedule chuyển:

```text
PROPOSED → CANCELLED
```

hoặc, khi Application terminal:

```text
CONFIRMED → CANCELLED
```

Nếu Application chưa terminal:

* Application vẫn `INTERVIEW_SCHEDULED`;
* Availability không bị reset;
* slot của Schedule `CANCELLED` không bị coi là Candidate đã từ chối;
* slot có thể được proposal lại nếu vẫn thỏa tất cả điều kiện khác.

### Business Rules liên quan

* `BR-14`
* `BR-20`
* `BR-23`
* `BR-25`
* `BR-28`
* `BR-29`

---

## F09 — Tiếp tục scheduling sau proposal không thành công

### Actor

* Candidate;
* current Assigned Recruiter.

### Mục tiêu

Cho Application tiếp tục scheduling sau `DECLINED` hoặc `CANCELLED` mà không rollback về `CONTACTED`.

### Luồng chính

1. Proposal trước đã `DECLINED` hoặc `CANCELLED`.
2. Candidate có thể chỉnh bộ Availability.
3. Recruiter xem bộ Availability mới nhất.
4. Nếu có slot hợp lệ, Recruiter có thể tạo Schedule `PROPOSED` mới.
5. Application tiếp tục giữ `INTERVIEW_SCHEDULED`.

### Kết quả

* mỗi proposal mới là một Schedule mới;
* Schedule lịch sử không được kích hoạt lại;
* slot `DECLINED` không được dùng lại;
* slot `CANCELLED` có thể dùng lại nếu vẫn hợp lệ.

### Business Rules liên quan

* `BR-13`
* `BR-14`
* `BR-15`
* `BR-20`

---

## F10 — Bảo toàn scheduling qua Assignment lifecycle

### Actor

* Candidate;
* Assigned Recruiter hiện tại;
* các actor quản lý Assignment theo V10.

### Mục tiêu

Không để thay đổi nhân sự nội bộ Company reset Candidate-facing scheduling.

### Luồng chính

Khi Application:

```text
ASSIGNED(A)
→ UNASSIGNED
```

hoặc:

```text
ASSIGNED(A)
→ ASSIGNED(B)
```

thì:

* Availability giữ nguyên;
* Schedule hiện tại giữ nguyên;
* Schedule lịch sử giữ nguyên;
* Application status giữ nguyên;
* Recruiter cũ mất quyền mutation;
* Recruiter mới tiếp quản khi trở thành current Assignee;
* Candidate vẫn được xem và phản hồi một Schedule `PROPOSED` còn hiệu lực ngay cả khi Application tạm thời `UNASSIGNED`.

### Business Rules liên quan

* `BR-30`
* `BR-31`
* `BR-32`

---

## F11 — Xem Interview data và lịch sử

### Actor

* mọi actor đã có quyền đọc Application tương ứng.

### Mục tiêu

Cho actor hợp lệ xem Interview data mà không tạo một authorization domain mới.

### Nội dung có thể đọc theo projection được phép

* Candidate đã submit Availability hay chưa;
* Availability hiện hành;
* Schedule đang chờ;
* Schedule đã `CONFIRMED`;
* Schedule đã `DECLINED`;
* Schedule đã `CANCELLED`;
* lịch sử các proposal thuộc Application.

### Kết quả

Quyền đọc Interview data luôn bắt nguồn từ quyền đọc Application.

V12 không tự cấp read authority mới cho Primary Recruiter, Supporting Recruiter hoặc Company Manager.

### Business Rules liên quan

* `BR-33`
* `BR-34`
* `BR-35`

---

# 10. Business Rules

## BR-01 — Interview Schedule thuộc Application

Candidate Availability và Interview Schedule luôn tồn tại trong ngữ cảnh một `Application` cụ thể.

## BR-02 — CONTACTED mở scheduling

Luồng cung cấp Availability bắt đầu khi Application được chuyển hợp lệ tới `CONTACTED`.

## BR-03 — Submit Availability là phản hồi nghiệp vụ

Candidate submit Availability là tín hiệu Candidate đã phản hồi yêu cầu scheduling và vẫn tiếp tục trong quy trình tuyển dụng.

## BR-04 — Availability rỗng hợp lệ

Candidate được phép submit Availability với `0` slot.

`SUBMITTED` và “có slot rảnh” là hai thông tin độc lập.

## BR-05 — Granularity của Availability Slot

Một slot chỉ gồm:

```text
DATE + MORNING
```

hoặc:

```text
DATE + AFTERNOON
```

V12 không quy định giờ/phút cụ thể.

## BR-06 — Không chọn ngày trong quá khứ

Candidate không được đưa ngày đã qua vào Availability hiện hành.

## BR-07 — Job expiry không phải upper bound của Availability

V12 không giới hạn ngày cuối của Availability theo `Job.expiredAt`.

Job `EXPIRED` không tự ngăn một Application chưa kết thúc tiếp tục scheduling.

## BR-08 — Candidate duy trì Availability hiện hành

Candidate có thể thêm, bỏ hoặc đưa Availability về rỗng khi lifecycle cho phép chỉnh sửa.

## BR-09 — Submit Availability không tạo Schedule

Submit Availability:

* không tạo Interview Schedule;
* không tạo `PROPOSED`;
* không chuyển Application khỏi `CONTACTED`.

## BR-10 — Phải phân biệt chưa submit và submit rỗng

Read model nghiệp vụ phải phân biệt:

```text
NOT_SUBMITTED
```

với:

```text
SUBMITTED + []
```

## BR-11 — Chỉ current Assigned Recruiter được tạo proposal

Có role Recruiter nhưng không phải current Assignee không đủ authority để tạo proposal.

## BR-12 — Proposal phải lấy từ Availability của Candidate

Recruiter chỉ được chọn slot hiện thuộc bộ Availability Candidate đã cung cấp.

Recruiter không được tự tạo ngày/buổi ngoài Availability.

## BR-13 — Slot bị DECLINED không được proposal lại

Nếu Candidate đã từ chối một Schedule sử dụng một slot cụ thể, slot đó không được dùng để gửi proposal khác cho cùng Application.

## BR-14 — CANCELLED không đồng nghĩa DECLINED

Một slot từng thuộc Schedule `CANCELLED` không bị disable chỉ vì cancellation.

Slot đó có thể được dùng lại nếu vẫn thỏa mọi điều kiện hợp lệ khác.

## BR-15 — Mỗi proposal là một Schedule mới

Sau `DECLINED` hoặc `CANCELLED`, proposal mới phải được xem là một Schedule mới.

Schedule lịch sử không được kích hoạt lại thành proposal mới.

## BR-16 — Tối đa một PROPOSED

Một Application có tối đa một Interview Schedule `PROPOSED` tại một thời điểm.

## BR-17 — PROPOSED khóa chỉnh Availability

Trong thời gian có Schedule `PROPOSED`, Candidate không được thay đổi Availability.

## BR-18 — Proposal đầu tiên đưa Application sang INTERVIEW_SCHEDULED

Khi proposal đầu tiên được tạo từ Application `CONTACTED`:

```text
Application:
CONTACTED → INTERVIEW_SCHEDULED
```

## BR-19 — Confirm không đổi Application Status

Candidate xác nhận:

```text
Schedule:
PROPOSED → CONFIRMED
```

Application tiếp tục:

```text
INTERVIEW_SCHEDULED
```

## BR-20 — Schedule failure không rollback Application

`DECLINED` hoặc `CANCELLED` không làm:

```text
INTERVIEW_SCHEDULED → CONTACTED
```

## BR-21 — CONFIRMED là kết quả thành công của scheduling

`CONFIRMED` biểu thị hai bên đã thống nhất ngày/buổi phỏng vấn.

Nó không biểu thị buổi phỏng vấn đã diễn ra.

## BR-22 — Candidate chỉ phản hồi PROPOSED

Candidate chỉ được `CONFIRM` hoặc `DECLINE` Schedule đang `PROPOSED` và còn hiệu lực.

Candidate không được phản hồi Schedule đã `DECLINED`, `CANCELLED` hoặc một Schedule không thuộc Application của mình.

## BR-23 — V12 không có Schedule COMPLETED

V12 không sử dụng `InterviewSchedule.COMPLETED`.

Việc phỏng vấn đã hoàn thành thuộc Recruitment Pipeline của Application.

## BR-24 — V12 không gate INTERVIEW_COMPLETED bằng Schedule

V12 không bổ sung requirement rằng:

```text
Schedule = CONFIRMED
```

là precondition mới để Application được chuyển:

```text
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
```

Transition đó tiếp tục tuân theo canonical Recruitment Pipeline.

## BR-25 — PROPOSED tự hết hiệu lực sau ngày được đề xuất

`MORNING` và `AFTERNOON` đều được xem là còn hiệu lực trong toàn bộ ngày được đề xuất.

Nếu Schedule vẫn `PROPOSED` khi đã sang ngày kế tiếp:

```text
PROPOSED → CANCELLED
```

Không định nghĩa giờ kết thúc riêng cho `MORNING` hoặc `AFTERNOON`.

## BR-26 — CONFIRMED chặn proposal mới

Khi tồn tại Schedule `CONFIRMED` còn hiệu lực, Recruiter không được tạo thêm Interview Schedule mới cho Application.

## BR-27 — DECLINED không reset Availability

Candidate từ chối proposal không làm xóa Availability.

Sau `DECLINED`, Candidate được tiếp tục quyết định bộ Availability hiện hành của mình.

## BR-28 — CANCELLED không reset Availability

Cancellation không làm xóa hoặc reset Candidate Availability.

## BR-29 — Application terminal invalidates Schedule còn hiệu lực

Khi Application chuyển hợp lệ sang terminal status:

```text
PROPOSED → CANCELLED
```

hoặc:

```text
CONFIRMED → CANCELLED
```

nếu Schedule tương ứng còn hiệu lực.

Schedule đã `DECLINED` hoặc `CANCELLED` không bị thay đổi.

## BR-30 — Reassign không reset scheduling

Reassign không:

* xóa Availability;
* xóa Schedule;
* đổi Schedule state;
* tạo Schedule mới;
* đổi Application Status chỉ vì Reassign.

## BR-31 — Unassign không reset scheduling

Automatic hoặc manual Unassign nội bộ Company không reset Availability, Schedule hoặc Application Status.

## BR-32 — Candidate-facing proposal sống độc lập với khoảng UNASSIGNED

Nếu Schedule `PROPOSED` vẫn còn hiệu lực khi Application tạm thời `UNASSIGNED`, Candidate vẫn được xem và phản hồi proposal.

Recruiter mutation chỉ tiếp tục khi có current Assigned Recruiter hợp lệ.

## BR-33 — Interview read authority kế thừa Application

V12 không tạo authority đọc Interview data độc lập.

Actor chỉ được đọc Interview data khi đã có quyền đọc Application tương ứng theo canonical authorization của hệ thống.

## BR-34 — Interview authority không mở Chat authority

Quyền đọc Availability hoặc Schedule không cấp quyền đọc hoặc gửi Message trong Conversation.

## BR-35 — Không cross-Application

Candidate không được đọc hoặc thao tác Interview data của Application khác ngoài phạm vi authorization của mình.

Recruiter không được dùng một Availability hoặc Schedule của Application này để thao tác Application khác.

## BR-36 — Job CLOSED/EXPIRED không tự cancel scheduling

Job `CLOSED` hoặc `EXPIRED` không tự làm Schedule của một Application chưa terminal chuyển `CANCELLED`.

Application chưa kết thúc vẫn có thể tiếp tục quy trình scheduling.

## BR-37 — Lịch sử proposal phải được bảo toàn về mặt nghiệp vụ

Các Schedule đã `DECLINED`, `CANCELLED` hoặc `CONFIRMED` phải tiếp tục được nhận diện là lịch sử của Application.

Việc tạo proposal mới không được xóa hoặc biến đổi ý nghĩa của proposal cũ.

## BR-38 — Request mất hiệu lực không được Candidate xác nhận

Một request đã `CANCELLED`, đã quá hạn hoặc đã bị Application terminal làm mất hiệu lực không được Candidate `CONFIRM`.

## BR-39 — Application terminal chặn scheduling tiếp theo

Sau khi Application terminal:

* không được tạo proposal mới;
* Candidate không được tiếp tục phản hồi proposal cũ;
* Schedule còn hiệu lực phải được xử lý theo `BR-29`.

---

# 11. State Transitions

## 11.1. Candidate Availability

| Hành động                    | Trước           | Sau         | Actor     |
| ---------------------------- | --------------- | ----------- | --------- |
| Candidate submit lần đầu     | `NOT_SUBMITTED` | `SUBMITTED` | Candidate |
| Candidate chỉnh Availability | `SUBMITTED`     | `SUBMITTED` | Candidate |

Candidate chỉ được chỉnh khi không có Schedule `PROPOSED`.

---

## 11.2. Interview Schedule

| Hành động                           | Trước                 | Sau         | Actor                      |
| ----------------------------------- | --------------------- | ----------- | -------------------------- |
| Recruiter gửi proposal              | Không có Schedule mới | `PROPOSED`  | Current Assigned Recruiter |
| Candidate xác nhận                  | `PROPOSED`            | `CONFIRMED` | Candidate                  |
| Candidate từ chối                   | `PROPOSED`            | `DECLINED`  | Candidate                  |
| Recruiter thu hồi proposal đang chờ | `PROPOSED`            | `CANCELLED` | Current Assigned Recruiter |
| Proposal qua ngày mà chưa phản hồi  | `PROPOSED`            | `CANCELLED` | System                     |
| Application terminal                | `PROPOSED`            | `CANCELLED` | System lifecycle           |
| Application terminal                | `CONFIRMED`           | `CANCELLED` | System lifecycle           |

Không có transition:

```text
DECLINED → *
CANCELLED → *
CONFIRMED → PROPOSED
CONFIRMED → COMPLETED
```

trong business contract của V12.

---

## 11.3. Application transitions do V12 trực tiếp tác động

| Hành động                  | Trước       | Sau                   | Actor                      |
| -------------------------- | ----------- | --------------------- | -------------------------- |
| Proposal đầu tiên được gửi | `CONTACTED` | `INTERVIEW_SCHEDULED` | Current Assigned Recruiter |

Các hành động:

```text
CONFIRM
DECLINE
CANCEL
```

không đổi Application khỏi `INTERVIEW_SCHEDULED`.

Transition:

```text
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED
```

thuộc Recruitment Pipeline hiện hành và không phải state transition do lifecycle của Interview Schedule điều khiển.

---

# 12. Authorization và ownership boundary

| Hành động                | Actor được phép                     | Resource / Scope                                | Điều kiện                                                   |
| ------------------------ | ----------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Submit Availability      | Candidate                           | Application của chính mình                      | Scheduling đã được mở và không có `PROPOSED` khóa chỉnh sửa |
| Chỉnh Availability       | Candidate                           | Application của chính mình                      | Không có `PROPOSED`                                         |
| Xem Availability         | Actor có Application read authority | Application tương ứng                           | Theo canonical read projection                              |
| Tạo proposal             | Current Assigned Recruiter          | Application đang được assign cho mình           | Đủ điều kiện scheduling                                     |
| Xem proposal             | Actor có Application read authority | Application tương ứng                           | Theo canonical read projection                              |
| Confirm                  | Candidate                           | Schedule thuộc Application của mình             | `PROPOSED` và còn hiệu lực                                  |
| Decline                  | Candidate                           | Schedule thuộc Application của mình             | `PROPOSED` và còn hiệu lực                                  |
| Cancel proposal đang chờ | Current Assigned Recruiter          | Schedule thuộc Application đang được assign     | `PROPOSED`                                                  |
| Tiếp quản sau Reassign   | Recruiter mới                       | Application mình vừa trở thành current Assignee | Không thay đổi dữ liệu Schedule cũ                          |

Các nguyên tắc:

* quyền mutation Recruiter lấy từ current Assignment;
* người từng tạo Schedule không giữ mutation authority sau khi mất Assignment;
* Candidate ownership lấy từ Application;
* V12 không tự mở read authority mới;
* Interview read authority không mở Chat authority;
* client không được tự tạo authority bằng cách cung cấp identifier của Candidate, Recruiter, Company hoặc Application khác.

---

# 13. Multi-tenant boundary

V12 không tạo tenant model mới.

Interview data kế thừa tenant boundary của Application và Job.

Quan hệ canonical:

```text
Authenticated Actor
        ↓
Authorized Application
        ↓
Canonical Job / Company scope
        ↓
Candidate Availability
Interview Schedule
```

Các nguyên tắc:

* Interview data của một Application thuộc cùng Company scope với Application đó;
* Recruiter của tenant khác không được thao tác Interview data;
* quyền cross-tenant không được hình thành chỉ vì biết identifier của Application hoặc Schedule;
* Reassign/Unassign chỉ chuyển responsibility theo các rule Assignment đã có, không chuyển Interview data sang tenant khác;
* V12 không tạo ngoại lệ cross-company mới.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng:

1. Candidate Availability và Interview Schedule luôn gắn với một Application.
2. Availability và Interview Schedule là hai khái niệm độc lập.
3. Candidate có thể `SUBMITTED` Availability với 0 slot.
4. Candidate chưa submit và Candidate submit rỗng phải phân biệt được về mặt nghiệp vụ.
5. Availability Slot chỉ sử dụng `DATE + MORNING/AFTERNOON`.
6. Candidate không được chọn ngày trong quá khứ.
7. Job expiry không phải upper bound của Availability.
8. Submit Availability không tạo Schedule.
9. Submit Availability không chuyển Application khỏi `CONTACTED`.
10. Chỉ current Assigned Recruiter được tạo proposal.
11. Proposal chỉ được chọn từ Availability của Candidate.
12. Recruiter không được tự chọn slot ngoài Availability.
13. Một Application có tối đa một Schedule `PROPOSED`.
14. Candidate không được chỉnh Availability khi có `PROPOSED`.
15. Proposal đầu tiên đồng thời đưa Application `CONTACTED → INTERVIEW_SCHEDULED`.
16. `CONFIRM`, `DECLINE` và `CANCEL` không rollback Application về `CONTACTED`.
17. Candidate chỉ phản hồi Schedule `PROPOSED` còn hiệu lực.
18. `DECLINED` làm slot tương ứng không được proposal lại.
19. `CANCELLED` không làm slot tương ứng bị disable chỉ vì cancellation.
20. Schedule mới sau `DECLINED` hoặc `CANCELLED` là một Schedule mới.
21. Schedule lịch sử không được kích hoạt lại.
22. `CONFIRMED` biểu thị việc thống nhất lịch, không biểu thị phỏng vấn hoàn thành.
23. V12 không có `InterviewSchedule.COMPLETED`.
24. `INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED` không do Interview Schedule lifecycle điều khiển.
25. Schedule `PROPOSED` quá ngày phải trở thành `CANCELLED`.
26. MORNING và AFTERNOON đều còn hiệu lực tới hết ngày của proposal.
27. Application terminal làm `PROPOSED` hoặc `CONFIRMED` còn hiệu lực chuyển `CANCELLED`.
28. Application terminal không bị Schedule kéo ngược sang status khác.
29. Job `CLOSED` hoặc `EXPIRED` không tự cancel Schedule của Application chưa terminal.
30. Reassign không reset Availability hoặc Schedule.
31. Unassign không reset Availability hoặc Schedule.
32. Candidate vẫn có thể phản hồi một `PROPOSED` còn hiệu lực trong khoảng Application tạm `UNASSIGNED`.
33. Mutation authority của Recruiter luôn đi theo current Assignee.
34. V12 không tạo read authority độc lập ngoài Application.
35. Interview read authority không mở Conversation authority.
36. Interview data không được truy cập cross-Application hoặc cross-tenant ngoài authorization hợp lệ.
37. Các proposal lịch sử phải được bảo toàn về mặt business.
38. Proposal đã mất hiệu lực không được xác nhận sau đó.
39. Không được tạo proposal mới sau khi Application terminal.
40. Không được tạo proposal mới khi đã có Schedule `CONFIRMED` còn hiệu lực.

---

# 15. Các quyết định chủ động defer

Các nội dung đã được xem xét nhưng chủ động không thuộc V12:

* Notification persistence và delivery;
* Notification realtime;
* Socket.IO;
* Calendar UI cụ thể;
* xác định giờ cụ thể trong `MORNING` hoặc `AFTERNOON`;
* start time theo giờ/phút;
* duration;
* ghi chú từng slot;
* nhiều vòng phỏng vấn;
* nhiều Interviewer;
* panel Interview;
* quyền riêng cho Interviewer;
* `RESCHEDULE_REQUESTED`;
* `NO_SHOW`;
* `IN_PROGRESS`;
* `InterviewSchedule.COMPLETED`;
* automatic meeting generation;
* video call integration;
* audit persistence design;
* cách lưu lịch sử chỉnh sửa Availability;
* cách lưu current Availability so với các snapshot cũ;
* realtime synchronization.

Các nội dung trên có thể được bổ sung ở version sau.

Không được tự implement chúng như requirement của V12.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V12.

Các quyết định còn lại về persistence, concurrency mechanism, API contract, schema, index, storage hoặc source-code structure không phải business blocker của Product Specification này.

---

# 17. Definition of Business Completion

V12 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` đến `F11` đều được đáp ứng;
* toàn bộ `BR-01` đến `BR-39` được đáp ứng;
* Candidate có thể phản hồi `CONTACTED` bằng Availability;
* hệ thống phân biệt được chưa submit với submit rỗng;
* Recruiter chỉ có thể proposal từ slot Candidate cung cấp;
* một Application không có nhiều proposal đang chờ đồng thời;
* Candidate có thể Confirm hoặc Decline proposal hợp lệ;
* `DECLINED` và `CANCELLED` có semantics khác nhau;
* slot `DECLINED` không được proposal lại;
* slot `CANCELLED` có thể dùng lại khi còn hợp lệ;
* Application không rollback về `CONTACTED` chỉ vì proposal thất bại;
* proposal quá ngày tự mất hiệu lực;
* Application terminal làm Schedule còn hiệu lực mất hiệu lực;
* `COMPLETED` đã được loại khỏi Schedule lifecycle;
* Application Pipeline tiếp tục độc lập sau scheduling;
* Reassign/Unassign không reset Candidate-facing scheduling;
* authorization đọc tiếp tục kế thừa Application;
* tenant boundary được giữ;
* Notification và các chức năng đã defer không bị implementation ngoài ý muốn;
* không xuất hiện behavior ngoài boundary của version.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V12.

Tài liệu định nghĩa:

```text
WHAT MUST HAPPEN
```

không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Tài liệu này không quy định:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* controller;
* service;
* route;
* middleware implementation;
* database query;
* persistence schema;
* embedded hay referenced data;
* index;
* transaction mechanism;
* optimistic locking/CAS implementation;
* source-code structure;
* test framework.

Các data/engineering contract phải phục vụ business truth trong tài liệu này.

Nếu data design hoặc implementation mâu thuẫn với tài liệu này, **Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
