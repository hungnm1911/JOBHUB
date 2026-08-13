# V10 — Phân công Application và Recruitment Pipeline

> **File:** `docs/product/versions/v10-application-assignment-recruitment-pipeline.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V10.

---

## 1. Mục tiêu

V10 bổ sung nhánh nghiệp vụ để Company tiếp nhận và xử lý các `Application` đã được Candidate tạo từ V9.

Sau V10, hệ thống phải xác định được độc lập:

1. Recruiter nào hiện đang chịu trách nhiệm trực tiếp xử lý một `Application`;
2. `Application` hiện đang ở bước nào trong Recruitment Pipeline.

V10 cho phép:

* Primary Recruiter và Company Manager của owning Company quản lý current Assignee của non-terminal `Application` theo mô hình `ASSIGN / UNASSIGN`;
* Assign một Unassigned Application cho Recruiter hợp lệ trong Recruitment Team của Job;
* đổi Assignee hiện tại từ Recruiter này sang Recruiter hợp lệ khác;
* Unassign một Application đang có Assignee mà không cần chọn replacement ngay;
* Primary Recruiter take over Application đang do Supporting Recruiter xử lý;
* Assigned Recruiter xử lý `Application` qua Recruitment Pipeline;
* Candidate theo dõi các `Application` của chính mình;
* Recruiter theo dõi các `Application` đang được giao;
* Primary Recruiter theo dõi toàn bộ `Application` của các Job mình đang quản lý;
* các `Application` đã tồn tại tiếp tục được xử lý kể cả khi Job đã `CLOSED` hoặc `EXPIRED`;
* hệ thống theo dõi current workload của Recruiter theo các non-terminal `Application` hiện đang được giao.
* hệ thống đưa non-terminal Application về `UNASSIGNED` khi current Assignee mất eligibility do CompanyMember lifecycle, rời Recruitment Team hoặc bị Platform Admin lock/terminate Platform User;
* Primary Recruiter hoặc Company Manager Assign lại Application từ chính Recruitment Status hiện tại khi có Recruiter phù hợp.

Từ V10, active responsibility của một Recruiter là hợp của hai dimension độc lập:

```text
Active Recruiter Responsibility
=
active Job-team responsibility theo V6
UNION
non-terminal Application responsibility theo V10
```

Job đã kết thúc accepting lifecycle không đồng nghĩa Application responsibility đã kết thúc.

V10 không tạo lại `Application` và không thay đổi bản chất của `submittedCvSnapshot` đã được xác định từ V9.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

* Tiếp nhận Direct Application từ V9.
* Trạng thái Unassigned của `Application`.
* Assign từ `UNASSIGNED` ở mọi Recruitment Status non-terminal.
* Reassign current Assignee.
* Unassign current Assignee.
* Take over.
* Assignment-management authority của Primary Recruiter và Company Manager.
* Điều kiện eligibility của Assigned Recruiter.
* Continuous eligibility trong quá trình xử lý.
* Recruitment Pipeline.
* Chuyển `Application` sang `REJECTED`.
* Ghi nhận `HIRED`.
* Tương thích với quyền `WITHDRAWN` của Candidate từ V9.
* Managed Jobs của Primary Recruiter.
* My Applications của Recruiter.
* My Applications của Candidate.
* Pipeline/Kanban theo Recruitment Status.
* Lọc Application theo Assignee.
* Xem danh sách Unassigned.
* Current workload.
* Tiếp tục xử lý Application sau khi Job `CLOSED` hoặc `EXPIRED`.
* Bảo vệ Job đã có Application khỏi hard delete.
* Bảo vệ business state trước các thao tác cạnh tranh trên cùng `Application`.
* Tích hợp non-terminal Application responsibility vào Recruiter lifecycle và Recruitment Team boundary bằng automatic Unassign khi Assignee mất eligibility hoặc rời team.
* Platform Admin User lock/terminate làm Recruiter mất eligibility và tự động đưa non-terminal Application của Recruiter đó về `UNASSIGNED`.
* Recruitment Team recovery sau Platform User lock/terminate của một Recruiter, độc lập với việc Application có thể chờ Assign lại.

### 2.2. Ngoài phạm vi

* Candidate Search.
* Job Invitation.
* Accept Invitation.
* Reject Invitation.
* Application từ `RECRUITER_INVITATION`.
* Conversation.
* Message.
* Chat realtime.
* Ghi chú nghiệp vụ.
* Interview Schedule entity.
* Candidate phản hồi lịch phỏng vấn.
* Notification.
* Notification realtime.
* Job snapshot.
* Assignment History.
* Status History.
* Application Timeline.
* Activity History.
* Historical workload.
* Performance KPI.
* Automatic hoặc random replacement Recruiter.
* Recovery task hoặc recovery status.
* Notification queue hoặc background worker.
* Kanban riêng theo Assignee.
* Drag-and-drop bắt buộc.
* Rollback Application về bước pipeline trước.
* Reopen terminal Application.

Không suy diễn hoặc tự bổ sung chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V10 sử dụng và mở rộng các business concept đã tồn tại:

* V1 — `User`, authentication và User lifecycle.
* V2 — `Company` và Company operational lifecycle.
* V3 — `CompanyMember`, Recruiter và Recruiter lifecycle.
* V5 — `Job`, Job lifecycle và owning Company.
* V6 — Recruitment Team gồm Primary Recruiter và Supporting Recruiter.
* V6 — các nguyên tắc chuyển giao trách nhiệm khi Recruiter thay đổi operational eligibility.
* V7 — Candidate Profile và Candidate CV.
* V8 — Job Discovery và điều kiện Job còn nhận hồ sơ.
* V9 — `Application`.
* V9 — `DIRECT_APPLICATION`.
* V9 — `submittedCvSnapshot`.
* V9 — quy tắc một Candidate–Job có tối đa một Application.
* V9 — Replace Submitted CV.
* V9 — Withdraw Application.

V10 không thay đổi các invariant đã chốt của các version trước, ngoại trừ các extension được ghi rõ trong tài liệu này để bảo vệ lifecycle của `Application`.

Đặc biệt:

* Job lifecycle và Application lifecycle là hai lifecycle độc lập;
* Recruitment Team vẫn có đúng một Primary Recruiter và `0..N` Supporting Recruiter;
* V10 không tự động thêm hoặc xóa Recruiter khỏi Recruitment Team khi Assign/Reassign Application;
* CandidateCV và `submittedCvSnapshot` tiếp tục là hai đối tượng độc lập;
* Recruiter xử lý Application thông qua `submittedCvSnapshot`, không thông qua quyền truy cập tự do vào thư viện CV của Candidate.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Application

`Application` là đơn ứng tuyển của một Candidate cho một Job cụ thể.

Recruitment Status thuộc về từng `Application`, không thuộc chung về Candidate.

Một Candidate có thể đồng thời có nhiều `Application` ở các trạng thái tuyển dụng khác nhau.

### 4.2. Candidate

Candidate là người sở hữu `Application` do chính mình tạo từ Direct Application của V9.

Candidate:

* theo dõi Application của chính mình;
* có thể Withdraw khi còn đủ điều kiện theo V9;
* có thể Replace Submitted CV khi còn đủ điều kiện theo V9;
* không phân công Recruiter;
* không cập nhật Recruitment Pipeline phía Company.

### 4.3. Primary Recruiter

Primary Recruiter là Recruiter hiện đang giữ vai trò Primary của Job.

Primary Recruiter:

* xem toàn bộ Application của Job;
* xem Unassigned Applications;
* Assign;
* Reassign;
* Unassign;
* Take over;
* theo dõi pipeline;
* theo dõi current workload;
* không mặc nhiên là Assigned Recruiter của mọi Application.

### 4.4. Supporting Recruiter

Supporting Recruiter là Recruiter hiện đang thuộc Supporting Team của Job.

Supporting Recruiter:

* không được tự nhận Unassigned Application;
* không được phân Application cho Recruiter khác;
* không được Unassign Application;
* chỉ trực tiếp xử lý Application khi chính mình là Assigned Recruiter hiện tại.

### 4.5. Assigned Recruiter

Assigned Recruiter là Recruiter hiện đang chịu trách nhiệm trực tiếp xử lý một `Application`.

Một Application có tối đa một Assigned Recruiter tại một thời điểm.

Khi được chọn làm target hoặc trực tiếp xử lý non-terminal Application, Assigned Recruiter phải là:

* Primary Recruiter của Job;

hoặc:

* Supporting Recruiter của Job.

Terminal Application giữ final Assignee nếu đã có; final association này không đòi hỏi Recruiter tiếp tục thuộc current Recruitment Team hoặc còn operational eligibility về sau.

### 4.6. Company Manager

Company Manager không trực tiếp thực hiện Recruitment Pipeline với tư cách Company Manager.

Company Manager có quyền quản lý current Assignee của mọi non-terminal Application thuộc Job của Company mình quản lý.

Company Manager:

* được Assign `NONE → Recruiter`;
* được đổi Assignee `Recruiter A → Recruiter B`;
* được Unassign `Recruiter A → NONE`;
* được dùng các quyền này trong vận hành thông thường hoặc để xử lý responsibility tại lifecycle/team boundary;
* không trở thành Assigned Recruiter chỉ vì có assignment-management authority;
* không được thay đổi Recruitment Status của Application với tư cách Company Manager;
* không được dùng Application assignment để tự thay đổi Recruitment Team;
* chỉ được quản lý Application trong đúng Company mình quản lý.

### 4.7. Platform Admin

Platform Admin chỉ quản lý generic Platform User lifecycle theo authority đã có từ V1.

Khi Platform Admin lock hoặc terminate User của một Recruiter:

* User lifecycle được phép hoàn tất ngay cả khi Recruiter còn Job/Application responsibility;
* mọi phiên của User bị thu hồi và identity được giữ theo V1;
* CompanyMember lifecycle và Recruitment Team không tự thay đổi;
* hệ thống tự đưa mọi non-terminal Application đang assign cho Recruiter đó về `UNASSIGNED`;
* Recruitment Status và toàn bộ Application business content được giữ nguyên.

Platform Admin không:

* Assign Application;
* Reassign Application;
* Unassign Application bằng assignment-management authority;
* Take over Application;
* chọn replacement Recruiter;
* trực tiếp cập nhật Recruitment Status của Application;
* transfer Primary responsibility, remove Supporting Recruiter hoặc tự động workload balance.

Platform Admin không trở thành Company-side recruitment actor thông qua account lifecycle action.

### 4.8. Unassigned Application

Unassigned là trạng thái phân công của Application khi current Assignee bằng `NONE`.

Một Application có thể Unassigned từ khi mới tạo hoặc trở lại Unassigned sau khi đã có Assignee.

Unassigned không phải Recruitment Status.

### 4.9. Current Workload

Current workload của Recruiter là tập hoặc số lượng non-terminal Applications hiện đang được assign trực tiếp cho Recruiter đó.

Current workload không phải performance KPI và không biểu diễn lịch sử trách nhiệm.

### 4.10. Active Recruiter Responsibility

Active Recruiter Responsibility là hợp của:

* active Job-team responsibility do V6 xác định trên Job chưa kết thúc;
* non-terminal Application responsibility do V10 xác định.

Non-terminal Application responsibility của một Recruiter tồn tại khi:

```text
Application.assignedRecruiterCompanyMemberId = Recruiter
AND
Application.status IN {
  APPLIED,
  SCREENING,
  CONTACTED,
  INTERVIEW_SCHEDULED,
  INTERVIEW_COMPLETED
}
```

Dimension này không phụ thuộc Job đang `PUBLISHED`, `CLOSED` hay `EXPIRED`.

Non-terminal Application ở `UNASSIGNED` không thuộc active responsibility của Recruiter nào và không được tiến pipeline cho tới khi được Assign lại.

Terminal Application ở `HIRED`, `REJECTED` hoặc `WITHDRAWN` không còn active responsibility cần xử lý. Assignee cuối cùng, nếu có, được giữ và không bị Assign/Unassign lại chỉ vì Recruiter sau đó mất eligibility.

---

## 5. Quan hệ nghiệp vụ chính

```text
Candidate
   │
   │ 1 — N
   ↓
Application
   │
   │ N — 1
   ↓
Job
   │
   └── thuộc đúng một Company
```

Một Candidate có thể có nhiều Application nhưng chỉ tối đa một Application cho cùng một Job.

```text
Job
├── đúng 1 Primary Recruiter
└── 0..N Supporting Recruiter

Application
└── 0..1 Assigned Recruiter
```

Mọi target Recruiter của non-terminal Application phải là Recruiter hợp lệ thuộc Recruitment Team hiện tại của chính Job đó. Terminal Application có thể giữ final Assignee đã trở thành ineligible hoặc rời team sau khi Application kết thúc.

Primary Recruiter của Job không tự động là Assigned Recruiter của mọi Application.

Supporting Recruiter thuộc team cũng không tự động có quyền trực tiếp xử lý mọi Application.

```text
Recruiter
├── active Job-team responsibility (V6)
└── non-terminal Application responsibility (V10)
```

Hai responsibility dimension này được resolve độc lập. Một Job `CLOSED` hoặc `EXPIRED` có thể không còn active Job-team responsibility theo V6 nhưng vẫn còn non-terminal Application responsibility theo V10.

```text
Application
├── Recruitment Status
└── Assignment Responsibility
```

Hai chiều này độc lập.

Ví dụ:

```text
Recruitment Status = APPLIED
Assigned Recruiter = Lan
```

có nghĩa Application đã được giao cho Lan nhưng Lan chưa bắt đầu Screening.

Phần này chỉ mô tả quan hệ nghiệp vụ.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Recruitment Status

Các trạng thái:

* `APPLIED`
* `SCREENING`
* `CONTACTED`
* `INTERVIEW_SCHEDULED`
* `INTERVIEW_COMPLETED`
* `HIRED`
* `REJECTED`
* `WITHDRAWN`

| Trạng thái            | Ý nghĩa                                                        |
| --------------------- | -------------------------------------------------------------- |
| `APPLIED`             | Candidate đã nộp hồ sơ; phía tuyển dụng chưa bắt đầu Screening |
| `SCREENING`           | Application đã bắt đầu và hiện ở bước xem xét hồ sơ            |
| `CONTACTED`           | Candidate đã được phía tuyển dụng liên hệ                      |
| `INTERVIEW_SCHEDULED` | Application đang ở bước đã lên lịch phỏng vấn                  |
| `INTERVIEW_COMPLETED` | Application đã hoàn thành bước phỏng vấn                       |
| `HIRED`               | Candidate đã được ghi nhận tuyển cho Application này           |
| `REJECTED`            | Application đã bị phía tuyển dụng từ chối                      |
| `WITHDRAWN`           | Candidate đã chủ động rút Application                          |

`HIRED`, `REJECTED` và `WITHDRAWN` là terminal states.

### 6.2. Assignment State

Assignment có hai trạng thái nghiệp vụ độc lập với Recruitment Status:

* `UNASSIGNED`
* `ASSIGNED`

| Trạng thái   | Ý nghĩa                                                  |
| ------------ | -------------------------------------------------------- |
| `UNASSIGNED` | Current Assignee là `NONE`; chưa có Recruiter trực tiếp chịu trách nhiệm |
| `ASSIGNED`   | Application có đúng một Assigned Recruiter hiện tại      |

`UNASSIGNED` không phải một giá trị của Recruitment Status.

---

## 7. Tổ hợp trạng thái hợp lệ

Recruitment Status và Assignment State là hai state dimensions độc lập. Mọi non-terminal Recruitment Status đều có thể kết hợp với `UNASSIGNED` hoặc `ASSIGNED`.

| Recruitment Status    | `UNASSIGNED` | `ASSIGNED` | Ý nghĩa |
| --------------------- | -----------: | ---------: | ------- |
| `APPLIED`             | Có | Có | Có thể chờ Assignee hoặc đã có Recruiter nhưng chưa bắt đầu Screening |
| `SCREENING`           | Có | Có | Có thể tạm không có Assignee; sau khi Assign lại tiếp tục từ Screening |
| `CONTACTED`           | Có | Có | Có thể tạm không có Assignee; sau khi Assign lại tiếp tục từ Contacted |
| `INTERVIEW_SCHEDULED` | Có | Có | Có thể tạm không có Assignee; sau khi Assign lại tiếp tục từ Interview Scheduled |
| `INTERVIEW_COMPLETED` | Có | Có | Có thể tạm không có Assignee; sau khi Assign lại tiếp tục từ Interview Completed |
| `HIRED`               | Không | Có | Kết thúc qua pipeline và giữ final Assignee |
| `REJECTED`            | Không | Có | Kết thúc qua pipeline và giữ final Assignee |
| `WITHDRAWN`           | Có | Có | Candidate có thể rút khi `APPLIED`; giữ Assignment State tại thời điểm kết thúc |

`HIRED + UNASSIGNED` và `REJECTED + UNASSIGNED` không phát sinh từ lifecycle được V10 định nghĩa vì chỉ current Assigned Recruiter mới được thực hiện các transition đó, còn terminal Application không được Unassign sau khi kết thúc.

Application `UNASSIGNED` giữ nguyên Recruitment Status nhưng không được tiến Recruitment Pipeline. Việc một Application đang có Assigned Recruiter cũng chỉ cấp quyền xử lý khi Recruiter đó còn operational eligibility hiện tại.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Candidate tạo Direct Application trong V9
  ↓
Application bắt đầu:
DIRECT_APPLICATION
APPLIED
UNASSIGNED
  ↓
Application xuất hiện trong Unassigned của Managed Job
  ↓
Primary Recruiter chọn chính mình
hoặc Supporting Recruiter hợp lệ
  ↓
Application được Assign
  ↓
Application vẫn APPLIED
  ↓
Application xuất hiện trong My Applications của Assigned Recruiter
  ↓
Assigned Recruiter thực sự bắt đầu xem xét
  ↓
APPLIED
  ↓
SCREENING
  ↓
CONTACTED
  ↓
INTERVIEW_SCHEDULED
  ↓
INTERVIEW_COMPLETED
  ↓
HIRED
```

Tại các bước đánh giá chưa kết thúc, Assigned Recruiter có thể chuyển Application sang `REJECTED` theo các transition được định nghĩa trong V10.

Trong khi Application vẫn `APPLIED`, Candidate có thể `WITHDRAWN` theo quyền của V9.

Nếu cần quản lý người chịu trách nhiệm:

```text
Primary hoặc Company Manager:
ASSIGNED(A) → ASSIGNED(B)
hoặc
ASSIGNED(A) → UNASSIGNED
  ↓
Recruitment Status không thay đổi
  ↓
Khi UNASSIGNED, Application dừng tiến pipeline
  ↓
Primary hoặc Company Manager có thể:
UNASSIGNED → ASSIGNED(B)
  ↓
Recruiter B tiếp tục từ chính Recruitment Status hiện tại
```

Nếu Platform Admin lock hoặc terminate Platform User của một Recruiter đang giữ responsibility:

```text
Platform Admin hoàn tất User ACTIVE → LOCKED | TERMINATED theo V1
  ↓
CompanyMember và Job team được giữ nguyên
  ↓
Recruiter mất processing eligibility ngay khi User không còn ACTIVE
  ↓
Hệ thống đưa mọi non-terminal Application đang assign cho Recruiter về UNASSIGNED
  ↓
Application giữ nguyên Recruitment Status và toàn bộ business content
  ↓
Company Manager xử lý Job-team responsibility theo V6 khi cần
  ↓
Primary hoặc Company Manager Assign lại Application khi có target hợp lệ
```

Platform User lifecycle và automatic Application Unassign không tự thay đổi `CompanyMember.status`. Nếu Company Manager sau đó muốn lock hoặc terminate Recruiter membership hoặc thay đổi Recruitment Team, operation đó tiếp tục dùng lifecycle riêng của V3/V6/V10.

Job chuyển sang `CLOSED` hoặc `EXPIRED` không làm dừng xử lý các Application đã tồn tại.

---

# 9. Functional Requirements

## F01 — Tiếp nhận Direct Application và Unassigned Applications

### Actor

* Candidate.
* Primary Recruiter.
* Company Manager.

### Mục tiêu

Tiếp nhận các Direct Application đã được tạo từ V9 và duy trì Unassigned Applications như một trạng thái hợp lệ trong quá trình xử lý tuyển dụng của V10.

### Tiền điều kiện

* Application đã tồn tại từ V9.
* Application thuộc nguồn `DIRECT_APPLICATION`.
* Application bắt đầu ở `APPLIED`.
* Application mới chưa có Assigned Recruiter; hoặc non-terminal Application đã trở lại `UNASSIGNED`.

### Luồng chính

1. Candidate hoàn tất Direct Application trong V9.
2. Application tồn tại ở `APPLIED`.
3. Application chưa có Assigned Recruiter.
4. Application được xem là Unassigned.
5. Primary Recruiter của Job và Company Manager của owning Company có thể xem Application trong phạm vi được quản lý tương ứng.
6. Actor có assignment-management authority có thể xem Candidate, CV snapshot và Recruitment Status của Application để thực hiện phân công.

### Kết quả

* Application tiếp tục là cùng Application đã tạo ở V9.
* Application vẫn giữ Candidate, Job, source và `submittedCvSnapshot`.
* Application chờ được Primary Recruiter hoặc Company Manager phân công.
* Nếu Application đã từng được xử lý, Recruitment Status hiện tại được giữ nguyên trong thời gian `UNASSIGNED`.

### Trường hợp từ chối

* Supporting Recruiter không được tự nhận Unassigned Application.
* Supporting Recruiter không được Assign Unassigned Application cho người khác.
* Recruiter không được cập nhật Recruitment Status của Application khi Application chưa có Assignee.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-04`
* `BR-05`

### Không thuộc chức năng này

* Tạo lại Application.
* Tạo lại CV snapshot.
* Tạo Job.
* Tự động Assign.
* Tự động chuyển `APPLIED → SCREENING`.

---

## F02 — Assign Unassigned Application

### Actor

* Primary Recruiter hiện tại của Job.
* Company Manager của Company sở hữu Job.

### Mục tiêu

Xác định Recruiter chịu trách nhiệm trực tiếp xử lý một non-terminal Unassigned Application, bất kể Application chưa từng được assign hay đã trở lại `UNASSIGNED`.

### Tiền điều kiện

* Actor là Primary Recruiter hiện tại của Job hoặc Company Manager của owning Company.
* Application chưa kết thúc.
* Application đang Unassigned.
* Assignee được chọn thỏa toàn bộ eligibility hiện tại.

### Luồng chính

1. Actor chọn một Unassigned Application trong scope được quản lý.
2. Actor chọn một Recruiter hợp lệ trong current Recruitment Team:

   * Primary Recruiter của Job, bao gồm chính actor khi actor là Primary;
   * hoặc Supporting Recruiter hợp lệ của Job.
3. Eligibility của Assignee được xác nhận tại thời điểm phân công.
4. Application được gắn với đúng một Assigned Recruiter.
5. Recruitment Status không thay đổi.

### Kết quả

* Application chuyển từ `UNASSIGNED` sang `ASSIGNED`.
* Application xuất hiện trong My Applications của Assigned Recruiter.
* Application giữ nguyên Recruitment Status hiện tại.
* Assigned Recruiter có quyền trực tiếp xử lý Application khi còn đủ eligibility.

### Trường hợp từ chối

Không được Assign khi:

* actor không phải Primary hiện tại của Job hoặc Company Manager của owning Company;
* Application không còn Unassigned;
* Application đã ở terminal state;
* Assignee không thuộc đúng Company;
* Assignee không có role Recruiter;
* Assignee không phải Primary hoặc Supporting hiện tại của Job;
* Company Member của Assignee không ACTIVE;
* User của Assignee không ACTIVE;
* Company không hoạt động;
* target Recruiter là `NONE` trong một yêu cầu Assign.

### Business Rules liên quan

* `BR-06`
* `BR-07`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-11`
* `BR-17`

### Không thuộc chức năng này

* Tự thêm Recruiter vào Recruitment Team.
* Thay Primary Recruiter của Job.
* Thay Supporting Team.
* Thay Recruitment Status.

---

## F03 — Reassign, Take over và Unassign bởi Primary Recruiter

### Actor

* Primary Recruiter hiện tại của Job.

### Mục tiêu

Quản lý current Assignee của một non-terminal Application thuộc Managed Job bằng cách đổi sang Recruiter hợp lệ khác, Take over hoặc đưa về `UNASSIGNED`.

### Tiền điều kiện

* Application đang có Assigned Recruiter.
* Application chưa kết thúc.
* Actor là Primary hiện tại của Job.
* Nếu target khác `NONE`, target Recruiter thỏa eligibility.

### Luồng chính — Reassign

1. Primary chọn Application đang có Assignee.
2. Primary chọn:

   * chính Primary;
   * hoặc Supporting Recruiter hợp lệ khác.
3. Assignee mới được xác nhận eligibility.
4. Current Assignee đổi từ Assignee cũ sang Assignee mới.
5. Recruitment Status được giữ nguyên.

### Luồng chính — Unassign

1. Primary chọn non-terminal Application đang có Assignee.
2. Primary chọn target `NONE`.
3. Application chuyển từ `ASSIGNED` sang `UNASSIGNED`.
4. Recruitment Status và toàn bộ Application business content được giữ nguyên.
5. Application không được tiến Recruitment Pipeline cho tới khi được Assign lại.

### Luồng chính — Take over

1. Primary chọn Application đang do Supporting Recruiter xử lý.
2. Primary thực hiện Take over.
3. Primary trở thành Assigned Recruiter hiện tại.
4. Supporting cũ mất quyền trực tiếp xử lý Application.
5. Recruitment Status được giữ nguyên.

### Kết quả

* Application luôn có tối đa một Assignee.
* Assignee cũ không còn current responsibility.
* Khi Reassign/Take over, Assignee mới nhận current responsibility.
* Khi Unassign, Application không thuộc current responsibility của Recruiter nào.
* Candidate, Job, source và CV snapshot không thay đổi.

### Trường hợp từ chối

* Application đã terminal.
* Actor không còn là Primary hiện tại.
* Target Recruiter khác `NONE` nhưng không hợp lệ.
* Primary cố cập nhật trực tiếp Recruitment Status của Application đang do Supporting xử lý mà chưa Take over.

### Business Rules liên quan

* `BR-10`
* `BR-12`
* `BR-13`
* `BR-14`
* `BR-17`
* `BR-18`
* `BR-19`

### Không thuộc chức năng này

* Thay Recruitment Team.
* Thay status cùng với Reassign/Take over/Unassign.
* Lưu Assignment History.

---

## F04 — Quản lý current Assignee bởi Company Manager

### Actor

* Company Manager của Company sở hữu Job.

### Mục tiêu

Cho phép Company Manager quản lý current Assignee của mọi non-terminal Application trong Company bằng mô hình `ASSIGN / UNASSIGN`, độc lập với Recruitment Pipeline authority.

### Tiền điều kiện

* Application thuộc Job của Company do Company Manager quản lý.
* Application chưa kết thúc.
* Target là `NONE` hoặc Recruiter hợp lệ của Recruitment Team hiện tại của Job.

### Luồng chính

1. Company Manager chọn non-terminal Application thuộc owning Company.
2. Company Manager chọn một trong các target hợp lệ:

   * Recruiter hợp lệ khi current Assignee là `NONE` — Assign;
   * Recruiter hợp lệ khác khi Application đang `ASSIGNED` — đổi Assignee;
   * `NONE` khi Application đang `ASSIGNED` — Unassign.
3. Nếu target khác `NONE`, eligibility được xác nhận theo đúng Company và current Recruitment Team của Job.
4. Current Assignee được cập nhật theo lựa chọn.
5. Recruitment Status, Candidate, Job, source, `submittedCvSnapshot` và Recruitment Team giữ nguyên.
6. Nếu Application trở thành `UNASSIGNED`, Application không được tiến pipeline cho tới khi được Assign lại.

### Kết quả

* Company Manager không trở thành Assignee.
* Company Manager không có quyền cập nhật Recruitment Status chỉ vì đã quản lý Assignee.
* Application có đúng một Assignee hợp lệ hoặc `NONE`.
* Không bắt buộc direct handoff `A → B` hoặc chọn replacement ngay.

### Trường hợp từ chối

* Application đã terminal.
* Application không thuộc Company của Company Manager.
* Target Recruiter khác `NONE` nhưng không hợp lệ.
* Yêu cầu nhằm cho Company Manager trực tiếp xử lý Recruitment Pipeline.

### Business Rules liên quan

* `BR-07`
* `BR-08`
* `BR-10`
* `BR-15`
* `BR-16`
* `BR-17`
* `BR-27`
* `BR-28`
* `BR-36`
* `BR-37`
* `BR-38`
* `BR-40`
* `BR-42`

### Không thuộc chức năng này

* Company Manager thực hiện Screening.
* Company Manager Reject/Hire Candidate với tư cách người xử lý Application.
* Tự thay đổi Recruitment Team thông qua Application assignment.

---

## F05 — Xử lý Recruitment Pipeline

### Actor

* Assigned Recruiter hiện tại.

### Mục tiêu

Cho phép Recruiter đang trực tiếp chịu trách nhiệm xử lý Application tiến qua Recruitment Pipeline hoặc kết thúc Application bằng `REJECTED` / `HIRED` theo transition hợp lệ.

### Tiền điều kiện

* Application có Assigned Recruiter.
* Actor là Assigned Recruiter hiện tại.
* Actor vẫn thỏa continuous eligibility.
* Application chưa ở terminal state.

### Luồng chính

Application được xử lý theo pipeline:

```text
APPLIED
→ SCREENING
→ CONTACTED
→ INTERVIEW_SCHEDULED
→ INTERVIEW_COMPLETED
→ HIRED
```

Assigned Recruiter có thể chuyển sang `REJECTED` từ các trạng thái:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

### Kết quả

* Application phản ánh Recruitment Status hiện tại.
* Recruitment Status transition không thay đổi Assignment State.
* Không được bỏ qua bước tiến bình thường.
* Không được chuyển lùi.
* Khi Application trở thành terminal, final Assignee được giữ và Application không được xử lý tiếp.

### Trường hợp từ chối

* Application chưa có Assignee.
* Actor không phải Assignee hiện tại.
* Actor đã mất eligibility.
* Transition không được định nghĩa.
* Application đã terminal.
* Primary không phải Assignee cố trực tiếp cập nhật status.
* Company Manager hoặc Platform Admin cố trực tiếp cập nhật pipeline.

### Business Rules liên quan

* `BR-08`
* `BR-18`
* `BR-19`
* `BR-20`
* `BR-21`
* `BR-22`
* `BR-24`
* `BR-36`
* `BR-38`
* `BR-39`

### Không thuộc chức năng này

* Rollback.
* Reopen.
* Interview Schedule entity.
* Timeline.
* Status History.

---

## F06 — Managed Jobs và Pipeline Workspace

### Actor

* Primary Recruiter.

### Mục tiêu

Cho phép Primary Recruiter theo dõi các Job mình đang quản lý cùng toàn bộ Application và current responsibility của các Application đó.

### Tiền điều kiện

* Recruiter hiện tại là Primary của Job.

### Luồng chính

Managed Jobs có thể bao gồm Job đang ở:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `PUBLISHED`;
* `CLOSED`;
* `EXPIRED`.

Với mỗi Job, Primary có thể theo dõi các thông tin nghiệp vụ hiện có như:

* Job hiện tại;
* Job Status;
* số Supporting Recruiter;
* tổng số Application;
* số Application chưa assign;
* số Application theo Recruitment Status.

Trong phạm vi một Managed Job, Primary có thể:

* xem toàn bộ Application;
* xem Candidate;
* xem `submittedCvSnapshot`;
* xem Assigned Recruiter hiện tại;
* xem Unassigned;
* Assign;
* Reassign;
* Unassign;
* Take over;
* theo dõi pipeline;
* lọc theo Assignee;
* theo dõi current workload.

Pipeline/Kanban sử dụng trực tiếp các Recruitment Status:

```text
APPLIED
SCREENING
CONTACTED
INTERVIEW_SCHEDULED
INTERVIEW_COMPLETED
HIRED
REJECTED
WITHDRAWN
```

Mỗi Recruitment Status là một nhóm/cột riêng.

### Kết quả

* Primary có cái nhìn tổng thể về Application của Job.
* Unassigned được phân biệt bằng assignment state, không tạo status mới.
* Primary chỉ trực tiếp cập nhật Recruitment Status khi chính mình là Assignee.

### Trường hợp từ chối

* Recruiter không phải Primary của Job.
* Primary cố trực tiếp cập nhật Application thuộc Supporting mà chưa Take over.

### Business Rules liên quan

* `BR-03`
* `BR-05`
* `BR-18`
* `BR-19`
* `BR-33`
* `BR-40`
* `BR-43`

### Không thuộc chức năng này

* Kanban riêng theo Assignee.
* Drag-and-drop bắt buộc.
* Historical assignment analytics.
* Performance KPI.

---

## F07 — My Applications của Recruiter

### Actor

* Primary Recruiter.
* Supporting Recruiter.

### Mục tiêu

Cho Recruiter theo dõi các Application hiện đang được assign trực tiếp cho chính mình.

### Tiền điều kiện

* Application đang có Recruiter hiện tại là Assigned Recruiter.

### Luồng chính

Recruiter có thể xem:

* Application được giao;
* Job;
* Job Status;
* Candidate;
* `submittedCvSnapshot`;
* Recruitment Status hiện tại;
* trạng thái terminal hoặc non-terminal.

Nếu Recruiter vẫn đủ eligibility và Application chưa kết thúc, Recruiter có thể cập nhật status theo transition hợp lệ.

### Kết quả

* Primary chỉ thấy Application trong My Applications khi Application được assign cho chính Primary.
* Supporting chỉ thấy Application đang được assign cho chính Supporting đó.
* Khi Reassign sang Recruiter khác hoặc Unassign, Application không còn thuộc current responsibility của Recruiter cũ.

### Trường hợp từ chối

* Application không được assign cho Recruiter hiện tại.
* Recruiter không còn eligibility để tiếp tục xử lý.
* Application terminal và Recruiter cố cập nhật trạng thái.

### Business Rules liên quan

* `BR-08`
* `BR-18`
* `BR-20`
* `BR-31`
* `BR-33`
* `BR-34`

### Không thuộc chức năng này

* Chat.
* Notes.
* Interview Schedule.
* Notification.
* Assignment History.

---

## F08 — My Applications của Candidate

### Actor

* Candidate.

### Mục tiêu

Cho Candidate theo dõi toàn bộ Application thuộc chính mình và trạng thái xử lý hiện tại.

### Tiền điều kiện

* Application thuộc Candidate hiện tại.

### Luồng chính

Candidate có thể xem danh sách và chi tiết Application của chính mình.

Thông tin có thể bao gồm:

* Job hiện tại;
* Company hiện tại;
* ngày ứng tuyển;
* `submittedCvSnapshot`;
* Recruitment Status hiện tại;
* Assigned Recruiter nếu đã được assign;
* Job Status hiện tại;
* thời gian Application được cập nhật gần nhất;
* source của Application.

Candidate có thể tìm theo:

* tên Job;
* tên Company.

Candidate có thể lọc theo:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`;
* `HIRED`;
* `REJECTED`;
* `WITHDRAWN`.

Candidate có thể xem hoặc download `submittedCvSnapshot` của chính Application.

Nếu Application hiện `UNASSIGNED`, Candidate được biết hồ sơ đang chờ người phụ trách, bất kể Recruitment Status non-terminal hiện tại.

Nếu Application hiện `ASSIGNED`, Candidate được xem:

* `fullName`;
* `avatar`;
* `jobTitle`;

của Assigned Recruiter hiện tại.

Sau Unassign, thông tin Assignee cũ không còn là current Assignee để hiển thị. Sau khi Assign lại, Candidate thấy thông tin của current Assignee mới; Recruitment Status không đổi chỉ vì các assignment transition này.

Candidate không được expose email hoặc phone cá nhân của Assigned Recruiter thông qua chức năng này.

### Kết quả

* Candidate chỉ xem Application của chính mình.
* Candidate thấy trạng thái hiện tại, không thấy status timeline.
* Candidate thấy Assignee hiện tại nếu đã được phân công.

### Trường hợp từ chối

* Candidate cố xem Application của Candidate khác.

### Business Rules liên quan

* `BR-23`
* `BR-31`
* `BR-32`
* `BR-41`

### Không thuộc chức năng này

* Chat.
* Notification.
* Interview Schedule detail.
* Invitation.
* Status timeline.
* Assignment History.

---

## F09 — Tiếp tục xử lý Application sau khi Job kết thúc nhận hồ sơ

### Actor

* Primary Recruiter.
* Assigned Recruiter.
* Company Manager trong assignment management.

### Mục tiêu

Bảo đảm Application đã tồn tại tiếp tục có lifecycle độc lập kể cả khi Job đã `CLOSED` hoặc `EXPIRED`.

### Tiền điều kiện

* Application đã tồn tại trước đó.

### Luồng chính

Khi Job chuyển sang `CLOSED` hoặc `EXPIRED`:

* Application hiện có không tự động kết thúc;
* non-terminal Application vẫn có thể được Assign;
* non-terminal Application vẫn có thể được Reassign;
* non-terminal Application vẫn có thể được Unassign;
* Primary vẫn có thể Take over;
* Company Manager vẫn có thể quản lý current Assignee;
* Assigned Recruiter vẫn có thể tiếp tục Recruitment Pipeline nếu còn đủ eligibility;
* Application vẫn có thể kết thúc bằng `REJECTED` hoặc `HIRED`;
* Candidate vẫn có thể Withdraw nếu Application còn `APPLIED`.
* mọi non-terminal Application đang assign vẫn là active Application responsibility cần được đưa về `UNASSIGNED` khi Recruiter mất eligibility do lifecycle hoặc rời Recruitment Team.

### Kết quả

* Job Status và Application Status tiếp tục là hai lifecycle độc lập.
* Recruitment responsibility đối với non-terminal Application không tự động kết thúc cùng Job.
* Không được suy ra `Job ended → Application responsibility ended`.
* Job đã có Application phải tiếp tục tồn tại.

### Trường hợp từ chối

* Candidate Replace Submitted CV sau khi Job không còn nhận hồ sơ.
* Hard delete Job đã có ít nhất một Application.

### Business Rules liên quan

* `BR-23`
* `BR-25`
* `BR-26`
* `BR-27`
* `BR-28`
* `BR-29`
* `BR-30`
* `BR-33`

### Không thuộc chức năng này

* Reopen Job.
* Tạo Application mới cho Job không còn nhận hồ sơ.
* Tạo Job snapshot.

---

## F10 — Current Workload

### Actor

* Primary Recruiter.

### Mục tiêu

Cho phép theo dõi trách nhiệm xử lý Application hiện tại của Recruiter trong phạm vi Managed Jobs.

### Tiền điều kiện

* Application đang non-terminal.
* Application có Assigned Recruiter hiện tại.

### Luồng chính

Current workload của Recruiter được xác định từ các non-terminal Application hiện đang được giao trực tiếp cho Recruiter đó.

Application thuộc Job `CLOSED` hoặc `EXPIRED` vẫn nằm trong current workload nếu còn non-terminal và đang assign cho Recruiter. Job status không phải điều kiện của workload derivation.

Khi Reassign hoặc Take over:

* Application rời current workload của Assignee cũ;
* Application thuộc current workload của Assignee mới nếu vẫn non-terminal.

Khi Unassign:

* Application rời current workload của Assignee cũ;
* Application không thuộc workload của Recruiter nào cho tới khi được Assign lại.

Khi Assign lại:

* Application thuộc current workload của Assignee mới nếu vẫn non-terminal.

Khi Application trở thành terminal:

* Application không còn thuộc current workload.

### Kết quả

* Workload phản ánh trách nhiệm hiện tại.
* Workload không phản ánh lịch sử từng xử lý Application.

### Trường hợp từ chối

Không được suy diễn current workload thành:

* performance score;
* hire rate;
* reject rate;
* historical workload;
* số Application từng phụ trách;
* thời gian xử lý trung bình.

### Business Rules liên quan

* `BR-33`
* `BR-34`
* `BR-35`

### Không thuộc chức năng này

* KPI performance.
* Historical analytics.
* Assignment History.

---

## F11 — Platform User lock/terminate và automatic Unassign

### Actor

* Platform Admin đối với generic Platform User lifecycle.
* Hệ thống đối với automatic Unassign.
* Company Manager đối với Job-team recovery và Assign lại Application.
* Primary Recruiter đối với Assign lại Application của Managed Job.

### Mục tiêu

Bảo đảm Platform Admin có thể lock hoặc terminate User ngay theo V1 mà không nhận assignment/pipeline authority; các non-terminal Application của Recruiter đó tự động trở về `UNASSIGNED`, còn Job-team responsibility tiếp tục được xử lý theo boundary V6.

### Tiền điều kiện

* Target User là `COMPANY_STAFF` có CompanyMember role `RECRUITER`.
* Platform Admin thực hiện một User lifecycle transition hợp lệ theo V1.
* Mọi Assign lại sau đó chỉ áp dụng trong scope actor quản lý.
* Target Recruiter khi Assign lại thỏa current eligibility và Recruitment Team eligibility của đúng Job.

### Luồng chính — Platform User lifecycle

1. Platform Admin lock hoặc terminate target User theo V1.
2. Operation không bị block bởi Primary, Supporting hoặc non-terminal Application responsibility còn tồn tại.
3. User chuyển sang `LOCKED` hoặc `TERMINATED` và toàn bộ session bị thu hồi theo V1.
4. `CompanyMember.status`, Job Primary và Supporting Team được giữ nguyên bởi Platform User lifecycle action.
5. Ngay khi User không còn `ACTIVE`, Recruiter không còn processing eligibility và không được nhận responsibility mới.
6. Hệ thống đưa mọi non-terminal Application đang assign cho Recruiter về `UNASSIGNED`.
7. Automatic Unassign giữ nguyên Recruitment Status, Candidate, Job, source, `submittedCvSnapshot` và Recruitment Team.
8. Terminal Application giữ final Assignee nếu đã có.

### Luồng chính — Tiếp tục recruitment operations

1. Company Manager xác định Job-team responsibility còn cần xử lý theo V6:

   ```text
   active Job-team responsibility
   ```
2. Nếu outgoing Recruiter là Primary của active Job, Company Manager thực hiện Primary transfer theo Job-team rules; Job không được có `NONE Primary`.
3. Nếu outgoing Recruiter là Supporting của active Job, Company Manager có thể remove outgoing Recruiter theo Job-team rules mà không cần direct Application handoff, vì affected non-terminal Applications đã `UNASSIGNED`.
4. Primary Recruiter của Job hoặc Company Manager có thể Assign từng Unassigned Application cho eligible Recruiter của current Recruitment Team.
5. Việc Assign lại không phụ thuộc Job đang `PUBLISHED`, `CLOSED` hay `EXPIRED` và tiếp tục từ chính Recruitment Status hiện tại.
6. Không bắt buộc chọn Application replacement ngay để hoàn tất Platform User lifecycle hoặc Job-team recovery.
7. Recovery không tự thay đổi CompanyMember lifecycle state.

### Kết quả

* Platform User lifecycle đã hoàn tất độc lập theo V1.
* Outgoing Recruiter không còn processing authority khi User ineligible.
* Mọi affected non-terminal Application trở thành `UNASSIGNED` và không tiến pipeline cho tới khi được Assign lại.
* Application giữ nguyên status, Candidate, Job, source và `submittedCvSnapshot`.
* Platform Admin không chọn replacement và không có assignment/pipeline authority.
* Job-team recovery vẫn giữ invariant đúng một Primary của V6.

### Trường hợp từ chối

* Platform Admin cố chọn replacement, quản lý Assignee, mutate Recruitment Status hoặc thay Recruitment Team.
* Primary hoặc Company Manager cố Assign resource ngoài scope mình quản lý.
* Target Recruiter cross-company, off-team hoặc không còn current eligibility.
* Client-declared company hoặc target identity không được current persisted relationships chứng minh.

### Business Rules liên quan

* `BR-07`
* `BR-08`
* `BR-10`
* `BR-15`
* `BR-16`
* `BR-17`
* `BR-27`
* `BR-28`
* `BR-36`
* `BR-37`
* `BR-38`
* `BR-40`
* `BR-42`
* `BR-46`
* `BR-47`
* `BR-48`
* `BR-49`
* `BR-50`
* `BR-51`
* `BR-52`
* `BR-53`

### Không thuộc chức năng này

* Automatic hoặc random replacement.
* Platform Admin Application-management authority.
* Đồng bộ User lifecycle với CompanyMember lifecycle.
* Notification, queue/worker, recovery task/status hoặc history.
* Behavior mới cho Company lock.

---

# 10. Business Rules

## BR-01 — V10 tiếp nhận Application từ V9

V10 xử lý `Application` đã được tạo bởi Direct Application của V9.

V10 không tạo lại Application khi bắt đầu quá trình phân công.

---

## BR-02 — Một Candidate–Job có tối đa một Application

V10 giữ nguyên invariant một Candidate chỉ có tối đa một Application cho cùng một Job.

---

## BR-03 — Recruitment Status và Assignment State độc lập

Recruitment Status biểu diễn vị trí của Application trong quá trình tuyển dụng.

Assignment State biểu diễn current Assignee là `NONE` hay một Recruiter đang chịu trách nhiệm trực tiếp.

Thay đổi một chiều không mặc nhiên thay đổi chiều còn lại.

---

## BR-04 — Một Application có tối đa một Assignee

Một Application có thể:

* có current Assignee là `NONE`;
* hoặc có đúng một Assigned Recruiter hiện tại.

Không được có nhiều Assigned Recruiter đồng thời.

---

## BR-05 — Unassigned không phải Recruitment Status

Unassigned chỉ biểu diễn current Assignee của Application là `NONE`.

Không tạo Recruitment Status `UNASSIGNED`.

---

## BR-06 — Primary và Company Manager được Assign Unassigned Application

Primary Recruiter hiện tại của Job và Company Manager của owning Company được Assign mọi non-terminal Unassigned Application trong scope mình quản lý.

Target Recruiter phải là:

* Primary Recruiter của Job;
* hoặc Supporting Recruiter hợp lệ của Job.

Supporting Recruiter không có assignment-management authority.

---

## BR-07 — Eligibility của Assignee

Một Recruiter chỉ hợp lệ để trở thành Assigned Recruiter khi đồng thời:

* thuộc Company sở hữu Job;
* có role Recruiter;
* đang là Primary hoặc Supporting của Job;
* Company Membership đang ACTIVE;
* User đang ACTIVE;
* Company đang hoạt động.

Toàn bộ điều kiện trên áp dụng cho mọi target Recruiter khác `NONE` của Assign, Reassign và Take over, kể cả khi Job đã `CLOSED` hoặc `EXPIRED`.

---

## BR-08 — Continuous Assignee Eligibility

Eligibility không chỉ được yêu cầu tại thời điểm Assign/Reassign.

Assigned Recruiter phải tiếp tục thỏa eligibility tại thời điểm thực hiện mỗi hành động xử lý Application.

Recruiter đã mất eligibility không được tiếp tục Recruitment Pipeline chỉ vì vẫn đang được ghi nhận là Assignee.

Stored assignment chỉ là current responsibility reference; nó không tự tạo processing authority. Continuous eligibility gồm đúng Company, current Recruitment Team membership, role Recruiter, CompanyMember `ACTIVE`, User `ACTIVE` và Company operational.

Khi một current Assignee riêng lẻ mất eligibility do CompanyMember lifecycle, rời Recruitment Team hoặc Platform User bị `LOCKED`/`TERMINATED`, mọi non-terminal Application đang assign cho Recruiter đó phải trở về `UNASSIGNED`. Company lock tự nó tiếp tục dùng semantics riêng được chốt tại `BR-28` và không phải automatic-Unassign trigger.

Khi Company không operational, mọi Assigned Recruiter trong Company đều không có processing authority cho tới khi Company trở lại operational theo một lifecycle transition được canonical version khác cho phép. V10 không tự tạo transition phục hồi Company.

---

## BR-09 — Supporting không tự nhận Application

Supporting Recruiter không được:

* tự nhận Unassigned Application;
* Assign Application cho chính mình;
* Assign Application cho Supporting Recruiter khác;
* giành Application đang thuộc Recruiter khác.

---

## BR-10 — Assignment model `ASSIGN / UNASSIGN`

Current Assignee của non-terminal Application được quản lý theo ba transition:

```text
NONE → Recruiter        — Assign
Recruiter A → Recruiter B — đổi Assignee
Recruiter A → NONE      — Unassign
```

Không có invariant buộc Application đã từng `ASSIGNED` phải luôn tiếp tục `ASSIGNED`. Direct handoff `A → B` không bắt buộc; Application có thể chờ ở `UNASSIGNED` cho tới khi có target phù hợp.

---

## BR-11 — Assignment management không thay đổi Application content hoặc Recruitment Status

Assign, Reassign, Take over và Unassign không được thay đổi:

* Candidate;
* Job;
* source;
* `submittedCvSnapshot`;
* Recruitment Status;
* Recruitment Team.

Assignment transition phải giữ nguyên Recruitment Status hiện tại. Khi Assign lại một Application đã tiến pipeline, Recruiter mới tiếp tục từ chính status đó.

---

## BR-12 — Primary được Reassign hoặc Unassign non-terminal Application

Primary Recruiter hiện tại được Reassign non-terminal Application từ Assignee hiện tại sang:

* chính Primary;
* hoặc Supporting Recruiter hợp lệ khác.

Primary cũng được đưa non-terminal Application từ current Assignee về `UNASSIGNED` mà không cần chọn replacement.

---

## BR-13 — Take over là trường hợp đặc biệt của Reassign

Take over chuyển responsibility của Application từ Supporting Recruiter hiện tại sang Primary Recruiter hiện tại.

Take over không thay đổi Recruitment Status.

---

## BR-14 — Reassign và Unassign chỉ thay đổi current responsibility

Reassign và Unassign không được thay đổi:

* Candidate;
* Job;
* source;
* `submittedCvSnapshot`;
* Recruitment Status.

Unassign cũng không được thay đổi Recruitment Team. Application `UNASSIGNED` không tiến pipeline; khi được Assign lại, processing tiếp tục từ Recruitment Status được giữ nguyên.

---

## BR-15 — Company Manager có assignment-management authority

Company Manager được quản lý current Assignee của mọi non-terminal Application thuộc Company mình quản lý:

* Assign từ `NONE` sang eligible Recruiter;
* đổi từ Recruiter A sang eligible Recruiter B;
* Unassign từ Recruiter A về `NONE`.

Authority này không phụ thuộc recovery reason hoặc việc current Assignee đã/sắp mất eligibility, và không biến Company Manager thành Recruiter xử lý Application.

---

## BR-16 — Assignment management không cấp quyền pipeline cho Company Manager

Company Manager không được trực tiếp thực hiện Recruitment Status transition chỉ vì có assignment-management authority.

Khi Application `ASSIGNED`, quyền xử lý thuộc về current Assigned Recruiter đủ eligibility. Khi Application `UNASSIGNED`, không Company-side actor nào được tiến pipeline.

Assignment-management authority không cấp Recruitment Pipeline authority cho Company Manager và không tự thay đổi Recruitment Team.

---

## BR-17 — Chỉ non-terminal Application được thay đổi Assignee

Assign, Reassign, Take over và Unassign chỉ được thực hiện khi Application ở một trong các trạng thái:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

Không được Assign/Reassign/Take over/Unassign:

* `HIRED`;
* `REJECTED`;
* `WITHDRAWN`.

Terminal Application không còn active responsibility cần quản lý; Assignee cuối cùng nếu có được giữ và không bị rewrite chỉ vì Recruiter sau đó mất eligibility, bị lock/terminate hoặc rời team.

---

## BR-18 — Quyền trực tiếp xử lý thuộc về current Assignee

Chỉ Assigned Recruiter hiện tại và còn đủ eligibility được trực tiếp cập nhật Recruitment Status trong hoạt động tuyển dụng thông thường.

Application chưa có Assignee không được Recruiter cập nhật Recruitment Status.

---

## BR-19 — Primary không mặc nhiên có quyền xử lý Application của Supporting

Primary Recruiter được xem toàn bộ Application của Job.

Nếu Application đang do Supporting Recruiter xử lý, Primary không được trực tiếp thay Recruitment Status.

Primary phải Take over hoặc được Assign/Reassign thành current Assignee trước nếu muốn trở thành người trực tiếp xử lý. Việc Unassign Application không cấp quyền xử lý cho Primary.

---

## BR-20 — Terminal states

Các terminal states là:

* `HIRED`;
* `REJECTED`;
* `WITHDRAWN`.

Terminal Application:

* không chuyển sang status khác;
* không reopen;
* không Assign;
* không Reassign;
* không Take over;
* không bị xóa chỉ vì đã kết thúc;
* giữ `submittedCvSnapshot`;
* giữ Assigned Recruiter cuối cùng nếu đã có.

---

## BR-21 — Pipeline tiến theo thứ tự

Ngoại trừ nhánh `REJECTED`, Application phải tiến theo thứ tự:

```text
APPLIED
→ SCREENING
→ CONTACTED
→ INTERVIEW_SCHEDULED
→ INTERVIEW_COMPLETED
→ HIRED
```

Không được bỏ qua bước.

---

## BR-22 — REJECTED được phép từ nhiều giai đoạn

Assigned Recruiter có thể chuyển Application sang `REJECTED` từ:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

`REJECTED` là terminal state.

---

## BR-23 — WITHDRAWN thuộc nhánh Candidate

Chỉ Candidate sở hữu Application được Withdraw.

Candidate chỉ được Withdraw khi Application đang `APPLIED`.

Candidate vẫn có thể Withdraw khi:

* Application chưa assign;
* Application đã assign nhưng chưa chuyển sang `SCREENING`;
* Job đã `CLOSED`;
* Job đã `EXPIRED`.

Từ `SCREENING`, Candidate không còn quyền Withdraw.

---

## BR-24 — Không rollback hoặc chuyển lùi

V10 không hỗ trợ transition lùi, bao gồm:

* `SCREENING → APPLIED`;
* `CONTACTED → SCREENING`;
* `INTERVIEW_SCHEDULED → CONTACTED`;
* `INTERVIEW_COMPLETED → INTERVIEW_SCHEDULED`.

V10 không cung cấp nghiệp vụ sửa sai bằng cách rollback về bước trước.

---

## BR-25 — CLOSED/EXPIRED không kết thúc Application hiện có

Job chuyển sang `CLOSED` hoặc `EXPIRED` không tự động:

* Reject Application;
* Withdraw Application;
* Hire Application;
* xóa Application;
* dừng Recruitment Pipeline của Application đã tồn tại.

---

## BR-26 — CLOSED/EXPIRED ngăn nhận hồ sơ mới và Replace CV

V10 giữ nguyên boundary từ các version trước:

Job không còn nhận hồ sơ thì:

* không nhận Direct Application mới;
* Candidate không được Replace Submitted CV.

Quyền Withdraw của một `APPLIED` Application vẫn được giữ.

---

## BR-27 — Application responsibility có thể tồn tại sau Job lifecycle

Non-terminal Application responsibility tồn tại khi Application đang assign cho Recruiter và status thuộc:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

Không thêm điều kiện Job phải `PUBLISHED`. Job đã `CLOSED` hoặc `EXPIRED` nhưng còn non-terminal Application vẫn còn active recruitment responsibility.

Các Application đó vẫn phải có khả năng:

* Assign;
* Reassign;
* Unassign;
* Take over;
* Company Manager assignment management;
* tiếp tục Recruitment Pipeline.

Active Recruiter Responsibility từ V10 là:

```text
active Job-team responsibility theo V6
UNION
non-terminal Application responsibility theo V10
```

Job ended không suy ra Application responsibility ended.

---

## BR-28 — Mất eligibility và lifecycle/team boundary

Khi một Recruiter đang là current Assignee của non-terminal Application mất operational eligibility do CompanyMember lifecycle hoặc rời current Recruitment Team của Job:

* Recruiter đó không được tiếp tục xử lý;
* mọi affected non-terminal Application phải chuyển `ASSIGNED(Recruiter) → UNASSIGNED`;
* Recruitment Status, Candidate, Job, source, `submittedCvSnapshot` và Recruitment Team được giữ nguyên;
* không bắt buộc chọn Application replacement trước khi lifecycle/team operation hoàn tất;
* Primary Recruiter hoặc Company Manager có thể Assign lại sau cho target hợp lệ;
* Job `CLOSED` hoặc `EXPIRED` không phải lý do để bỏ qua affected Application.

Khi Company Manager yêu cầu `LOCKED` hoặc `TERMINATED` cho Recruiter membership:

1. resolve cả active Job-team responsibility và mọi non-terminal Application responsibility của Recruiter;
2. xử lý Job-team transfer/removal theo V6, bao gồm Primary replacement khi V6 yêu cầu;
3. đưa mọi affected non-terminal Application về `UNASSIGNED` thay vì bắt buộc direct handoff `A → B`;
4. chạy final guard trên current state;
5. chỉ hoàn tất CompanyMember lifecycle khi active Job-team responsibility đã được resolve và không còn non-terminal Application assign cho outgoing Recruiter.

Không có Application replacement không phải lý do block lifecycle completion sau khi affected Applications đã `UNASSIGNED`. Invariant mỗi Job có đúng một Primary vẫn độc lập và có thể yêu cầu Primary transfer theo V6.

Final responsibility guard này chỉ áp dụng cho Company Manager initiated CompanyMember lifecycle. Generic Platform User lifecycle của V1 có thể hoàn tất ngay; hệ thống automatic Unassign affected non-terminal Applications như business consequence của eligibility loss.

Operation làm Recruiter rời Recruitment Team phải đưa mọi non-terminal Application đang assign cho Recruiter trên Job đó về `UNASSIGNED` trước hoặc cùng business completion của team removal. Đổi Primary/Supporting nhưng Recruiter vẫn còn trong team và vẫn fully eligible không tự tạo Unassign requirement. Primary transfer tiếp tục là Job-team operation và không được tạo `NONE Primary`.

Company lock là lifecycle riêng: Company lock action tự nó giữ current persisted assignment, freeze pipeline, không tự reassign, không Unassign và không tạo synthetic replacement. V10 không suy diễn thêm Company-lock behavior hoặc reactivation transition. Nếu Platform User hoặc CompanyMember của một Recruiter riêng lẻ có eligibility-losing transition riêng, automatic Unassign vẫn được xác định bởi chính transition đó.

Application assignment không được tự tạo Recruiter mới hoặc tự thay đổi Recruitment Team.

---

## BR-29 — Job đã có Application không được hard delete

Nếu Job đã có ít nhất một Application, Job phải tiếp tục tồn tại.

Không được hard delete Job theo cách làm Application mất Job mà nó thuộc về.

Job chưa có Application tiếp tục tuân theo quyền xóa đã được xác định ở Job lifecycle trước đó.

---

## BR-30 — Job Status và Application Status độc lập

`Job Status` không được dùng làm `Application Status`.

`Application Status` không được dùng để thay thế `Job Status`.

Job có thể `CLOSED` hoặc `EXPIRED` trong khi Application vẫn đang:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

---

## BR-31 — submittedCvSnapshot là hồ sơ tuyển dụng của Application

Các hành động:

* Assign;
* Reassign;
* Take over;
* Unassign;
* Recruitment Pipeline update;

không được thay đổi `submittedCvSnapshot`.

Recruiter chỉ được sử dụng snapshot thuộc Application trong phạm vi xử lý Application.

V10 không cấp quyền tự do duyệt các CV khác trong thư viện Candidate.

---

## BR-32 — Candidate-visible Assignee information

Khi Application đã được assign, Candidate được xem:

* `fullName`;
* `avatar`;
* `jobTitle`;

của Assigned Recruiter hiện tại.

V10 không expose email hoặc phone cá nhân của Assigned Recruiter thông qua Candidate My Applications.

---

## BR-33 — Current workload chỉ tính responsibility hiện tại

Current workload của Recruiter chỉ bao gồm non-terminal Applications hiện đang được assign cho Recruiter đó.

Terminal Applications không thuộc current workload.

Job status không tham gia workload derivation; non-terminal assigned Application trên Job `CLOSED`/`EXPIRED` vẫn thuộc current workload.

---

## BR-34 — Assignment transition cập nhật current workload

Khi một non-terminal Application được Reassign hoặc Take over:

* Assignee cũ mất Application khỏi current workload;
* Assignee mới nhận Application vào current workload.

Khi Unassign, Assignee cũ mất Application khỏi current workload và Application không thuộc workload của Recruiter nào. Khi Assign lại, target Recruiter nhận Application vào current workload.

Điều này không ghi nhận lịch sử đã từng phụ trách.

---

## BR-35 — Không có historical KPI hoặc responsibility history

V10 không dùng current workload để xác định:

* historical workload;
* performance KPI;
* số Application từng xử lý;
* hire rate;
* reject rate;
* thời gian xử lý trung bình.

V10 không lưu Assignment History hoặc Status History như một business capability.

---

## BR-36 — Stale operation không được ghi đè business state mới

Khi nhiều hành động cạnh tranh trên cùng Application, một hành động dựa trên state cũ không được ghi đè:

* Assignee mới hơn;
* Recruitment Status mới hơn;
* `submittedCvSnapshot` mới hơn.

Business result phải phản ánh state hợp lệ mới nhất đã được hoàn tất trước.

Quy tắc này cũng áp dụng giữa Application assignment/Unassign và lifecycle/team operation làm Recruiter mất eligibility. Stale eligibility, stale Assignee hoặc stale Application state không được ghi đè current state hay bỏ qua automatic Unassign.

---

## BR-37 — Cạnh tranh khi quản lý Assignee

Assign chỉ được thành công nếu Application vẫn đang Unassigned tại thời điểm việc phân công được quyết định.

Reassign chỉ được thành công nếu Application vẫn đang ở responsibility state mà hành động Reassign đang dựa vào.

Unassign chỉ được thành công nếu Application vẫn đang có current Assignee mà hành động Unassign đang dựa vào.

Hai hành động cạnh tranh không được làm Application có nhiều Assignee hoặc làm assignment cũ ghi đè assignment mới.

Assign, Reassign và Unassign còn phải phối hợp với eligibility-losing lifecycle/team operation:

* nếu lifecycle completion thắng trước, Recruiter đã mất eligibility không được nhận responsibility mới;
* nếu assignment vào outgoing Recruiter thắng trước, lifecycle/team operation phải nhìn thấy assignment mới và đưa Application đó về `UNASSIGNED`;
* stale Assign/Reassign không được khôi phục Assignee đã bị automatic Unassign.

---

## BR-38 — Reassign/Unassign cạnh tranh với status update

Nếu Recruiter A đang cập nhật Recruitment Status đồng thời Primary Reassign Application từ A sang B:

* nếu Reassign sang B hoặc Unassign hoàn tất trước, A không còn quyền cập nhật status;
* nếu status update của A hoàn tất hợp lệ trước và Application vẫn non-terminal, status mới được giữ và assignment transition có thể tiếp tục dựa trên state mới;
* nếu status update hoàn tất Application thành `HIRED` hoặc `REJECTED` trước, assignment transition phải fail và Application giữ final Assignee tại thời điểm trở thành terminal.

Không được để request dựa trên Assignee cũ ghi đè responsibility mới.

Company Manager assignment management và automatic Unassign cạnh tranh với status update theo cùng nguyên tắc: mutation dựa trên outgoing Assignee hoặc Application state cũ không được commit sau khi current responsibility đã đổi hoặc về `NONE`. Nếu non-terminal status update hoàn tất hợp lệ trước, status mới được giữ qua transition assignment sau đó.

Khi Candidate Withdraw đồng thời với Assign/Reassign/Unassign:

* nếu Withdraw hoàn tất trước, pending assignment transition phải fail vì Application đã terminal và final Assignment State được giữ;
* nếu assignment transition hoàn tất trước, Candidate vẫn có thể Withdraw khi Application còn `APPLIED`, và `WITHDRAWN` giữ Assignment State vừa hoàn tất.

---

## BR-39 — SCREENING cạnh tranh với Candidate actions từ V9

Khi Candidate Replace Submitted CV đồng thời Assigned Recruiter chuyển `APPLIED → SCREENING`:

* nếu Screening hoàn tất trước, Replace không còn hợp lệ;
* nếu Replace hoàn tất trước, snapshot mới phải được giữ và Screening sử dụng Application với snapshot mới nhất.

Khi Candidate Withdraw đồng thời Assigned Recruiter chuyển `APPLIED → SCREENING`:

* nếu Withdraw hoàn tất trước, Application trở thành `WITHDRAWN` và không tiếp tục Screening;
* nếu Screening hoàn tất trước, Candidate không còn quyền Withdraw.

Application không được vừa `WITHDRAWN` vừa tiếp tục Recruitment Pipeline.

---

## BR-40 — Company-scoped Recruitment Team

Primary Recruiter, Supporting Recruiter và Assigned Recruiter của một Job phải thuộc đúng Company sở hữu Job theo các membership rules hiện hành.

Không được dùng Recruiter thuộc Company khác làm Assignee.

Mọi target Recruiter khác `NONE` phải là eligible Recruiter của đúng Company và current Recruitment Team của Job. Company lock không được tạo synthetic same-company replacement vì toàn bộ Company đồng thời không operational.

---

## BR-41 — Candidate ownership boundary

Candidate chỉ được xem và thao tác các Candidate-side actions trên Application thuộc chính Candidate đó.

Candidate không được truy cập Application của Candidate khác.

---

## BR-42 — Administrative actor boundary

Company Manager có quyền Assign, đổi Assignee và Unassign non-terminal Application trong own Company như đã định nghĩa tại V10.

Quyền này không cấp Recruitment Pipeline authority hoặc quyền thay đổi Recruitment Team.

Platform Admin không được:

* Assign;
* Reassign;
* Unassign bằng assignment-management authority;
* Take over;
* chọn replacement Recruiter;
* cập nhật Recruitment Status;
* transfer Primary responsibility;
* remove Recruiter khỏi Recruitment Team;
* tự động workload balance.

Company Manager và Platform Admin không được trở thành Assigned Recruiter thông qua V10 nếu không đồng thời là một Recruiter hợp lệ theo business model hiện hành.

Platform Admin tiếp tục không có Application assignment-management hoặc pipeline authority. Automatic Unassign do User eligibility loss là system consequence, không phải Platform Admin chọn Assignee hoặc thực hiện Unassign. Platform Admin lock Company chỉ kích hoạt Company-lock freeze semantics của V10, không trực tiếp chọn Assignee hay mutate Application.

Generic Platform User lock/terminate cũng không cấp Platform Admin bất kỳ responsibility-transfer authority nào. Primary Recruiter hoặc Company Manager của đúng scope có thể Assign lại affected Application sau automatic Unassign.

---

## BR-43 — Kanban phản ánh Recruitment Status thật

Pipeline/Kanban của V10 phải phản ánh trực tiếp tám Recruitment Status:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`;
* `HIRED`;
* `REJECTED`;
* `WITHDRAWN`.

Không gộp:

* `INTERVIEW_SCHEDULED` và `INTERVIEW_COMPLETED` thành một trạng thái `INTERVIEW`;
* `HIRED`, `REJECTED`, `WITHDRAWN` thành một trạng thái `COMPLETED`.

Unassigned được thể hiện theo assignment state, không tạo thêm Recruitment Status.

---

## BR-44 — V10 chỉ xử lý Direct Application

Nguồn Application thuộc phạm vi V10 là `DIRECT_APPLICATION`.

Các Application từ Recruiter Invitation không thuộc V10.

---

## BR-45 — Interview statuses chỉ biểu diễn vị trí pipeline trong V10

`INTERVIEW_SCHEDULED` và `INTERVIEW_COMPLETED` trong V10 chỉ xác định Recruitment Status hiện tại của Application.

V10 không yêu cầu một Interview Schedule entity, lịch hẹn cụ thể hoặc Candidate response tương ứng.

---

## BR-46 — Platform User lifecycle và Recruiter membership lifecycle độc lập

Platform Admin quản lý `User.status` theo generic Platform User lifecycle của V1.

Company Manager quản lý `CompanyMember(RECRUITER).status` theo Recruiter membership lifecycle của V3/V6/V10.

Platform Admin chuyển User sang `LOCKED` hoặc `TERMINATED` không tự chuyển CompanyMember sang cùng trạng thái và không được coi là Company Manager initiated Recruiter lifecycle completion.

---

## BR-47 — Platform User lifecycle không bị responsibility block

Platform Admin được hoàn tất canonical User lock/terminate kể cả khi Recruiter đang giữ Primary, Supporting hoặc non-terminal Application responsibility.

Operation phải giữ nguyên V1 account transition, session revocation, identity retention và các account invariant hiện hữu. Active Recruiter Responsibility không tạo pre-handoff hoặc final-zero guard cho generic Platform User lifecycle; affected non-terminal Applications được automatic Unassign thay vì block lifecycle.

---

## BR-48 — Platform User lifecycle giữ Job-team state và Unassign non-terminal Applications

Platform Admin User lock/terminate không tự mutate:

* `CompanyMember.status`;
* Job Primary;
* Job Supporting Team;
* `Application.status`;
* `submittedCvSnapshot`.

Hệ thống phải đưa mọi non-terminal Application đang assign cho outgoing Recruiter về `UNASSIGNED`. Đây là business consequence bắt buộc của eligibility loss, không phải Platform Admin assignment authority.

Không auto reassign, tạo synthetic replacement, tự Reject/Withdraw Application hoặc thay Candidate, Job, source, `submittedCvSnapshot` và Recruitment Team. Terminal Application giữ final Assignee nếu đã có.

---

## BR-49 — Platform User eligibility loss freeze và stale-operation boundary

Ngay khi `User.status != ACTIVE`, Recruiter:

* không được tiếp tục Recruitment Pipeline;
* không được nhận Assign;
* không được nhận Reassign hoặc Take over mới;
* không được dựa vào stale Assignee reference để tiếp tục processing.

Nếu Platform User lifecycle và automatic Unassign hoàn tất trước, operation dựa trên eligibility hoặc Assignee cũ không được commit. Nếu Application mutation hợp lệ hoàn tất trước, mutation đó được giữ; Platform lifecycle vẫn có thể hoàn tất sau theo V1 và automatic Unassign phải áp dụng trên current non-terminal assignments của outgoing Recruiter.

---

## BR-50 — Responsibility resolution sau Platform User eligibility loss

Sau Platform User lock/terminate của một Recruiter, responsibility được tách thành hai dimension:

```text
active Job-team responsibility theo V6
→ Company Manager xử lý theo Job-team rules khi cần

non-terminal Application responsibility theo V10
→ hệ thống đã đưa về UNASSIGNED
```

Automatic Unassign không được filter bằng Job status. `PUBLISHED`, `CLOSED` và `EXPIRED` đều phải được xét nếu Application còn non-terminal và đang assign cho outgoing Recruiter.

Primary Recruiter hoặc Company Manager có thể Assign lại sau; Application replacement không bắt buộc để hoàn tất Platform User lifecycle hoặc Job-team recovery.

---

## BR-51 — Recovery Job-team responsibility cho Platform-ineligible outgoing Recruiter

Nếu outgoing Recruiter là Primary của active Job, Company Manager được chuyển Primary sang replacement hợp lệ theo Recruitment Team foundation dù outgoing User đã `LOCKED` hoặc `TERMINATED`.

Replacement phải cùng Company, có role Recruiter, có CompanyMember `ACTIVE`, User `ACTIVE`, Company operational và thỏa current Recruitment Team eligibility của transfer flow.

Nếu outgoing Recruiter là Supporting, Company Manager được remove outgoing Recruiter khỏi active Recruitment Team theo V6 sau khi affected non-terminal Applications trên Job đã về `UNASSIGNED`; không cần direct Application handoff hoặc outgoing User trở lại `ACTIVE` chỉ để transfer/remove.

Primary transfer vẫn là Job-team operation. Không được tạo `NONE Primary`, và V10 không redesign các V6 team rules ngoài việc thay direct Application handoff bằng Unassign.

---

## BR-52 — Automatic Unassign non-terminal Application responsibility

Khi Platform User của Recruiter chuyển sang `LOCKED` hoặc `TERMINATED`, hệ thống phải chuyển mọi non-terminal Application của Recruiter đó:

```text
ASSIGNED(A) → UNASSIGNED
```

Automatic Unassign giữ nguyên Recruitment Status, Candidate, Job, source, `submittedCvSnapshot` và Recruitment Team. Không yêu cầu target B, không tạo replacement và không phụ thuộc Job status.

Terminal Application giữ final Assignee, không bị rewrite và không block lifecycle/team recovery.

Quy tắc tương ứng cũng áp dụng khi current Assignee mất eligibility do CompanyMember lifecycle hoặc rời Recruitment Team theo `BR-28`.

---

## BR-53 — Assignment authority, tenant boundary và lifecycle non-synchronization

Company Manager chỉ được quản lý current Assignee trong Company mình quản lý và không có Recruitment Pipeline authority.

Mọi target Recruiter khác `NONE` phải thuộc đúng Company, đúng current Recruitment Team và thỏa current V10 eligibility. Company, Application, Job và target Recruiter phải được chứng minh từ current relationships; client-supplied identifiers không tự tạo authority.

Automatic Unassign không tự chuyển `CompanyMember.status` chỉ vì User đã `LOCKED` hoặc `TERMINATED`. Company Manager muốn lock/terminate membership sau đó phải dùng canonical CompanyMember lifecycle riêng.

Company lock tiếp tục là lifecycle riêng: Company lock action tự nó giữ assignments, không same-company reassign, không Unassign và freeze processing theo canonical V10 hiện tại. Automatic Unassign trong BR-50–BR-52 xuất phát từ eligibility-losing transition của một Recruiter riêng lẻ, không được suy diễn chỉ từ Company lock.

---

# 11. State Transitions

## 11.1. Recruitment Status transitions

| Hành động                              | Trước                 | Sau                   | Actor                        |
| -------------------------------------- | --------------------- | --------------------- | ---------------------------- |
| Bắt đầu Screening                      | `APPLIED`             | `SCREENING`           | Assigned Recruiter           |
| Reject tại Applied                     | `APPLIED`             | `REJECTED`            | Assigned Recruiter           |
| Withdraw                               | `APPLIED`             | `WITHDRAWN`           | Candidate sở hữu Application |
| Ghi nhận đã liên hệ                    | `SCREENING`           | `CONTACTED`           | Assigned Recruiter           |
| Reject tại Screening                   | `SCREENING`           | `REJECTED`            | Assigned Recruiter           |
| Chuyển sang bước phỏng vấn đã lên lịch | `CONTACTED`           | `INTERVIEW_SCHEDULED` | Assigned Recruiter           |
| Reject tại Contacted                   | `CONTACTED`           | `REJECTED`            | Assigned Recruiter           |
| Ghi nhận hoàn thành phỏng vấn          | `INTERVIEW_SCHEDULED` | `INTERVIEW_COMPLETED` | Assigned Recruiter           |
| Reject tại Interview Scheduled         | `INTERVIEW_SCHEDULED` | `REJECTED`            | Assigned Recruiter           |
| Ghi nhận tuyển                         | `INTERVIEW_COMPLETED` | `HIRED`               | Assigned Recruiter           |
| Reject sau phỏng vấn                   | `INTERVIEW_COMPLETED` | `REJECTED`            | Assigned Recruiter           |

Không có Recruitment Status transition nào khác thuộc V10.

## 11.2. Assignment transitions

| Hành động | Trước | Sau | Actor |
| --------- | ----- | --- | ----- |
| Assign | `UNASSIGNED` | `ASSIGNED(A)` | Primary Recruiter hoặc Company Manager |
| Reassign | `ASSIGNED(A)` | `ASSIGNED(B)` | Primary Recruiter hoặc Company Manager |
| Take over | `ASSIGNED(Supporting)` | `ASSIGNED(Primary)` | Primary Recruiter |
| Unassign | `ASSIGNED(A)` | `UNASSIGNED` | Primary Recruiter hoặc Company Manager |
| Automatic Unassign khi Assignee mất eligibility/rời team | `ASSIGNED(A)` | `UNASSIGNED` | Hệ thống |

Mọi transition trên chỉ áp dụng cho non-terminal Application. Assign/Reassign/Take over/Unassign không tự động tạo Recruitment Status transition.

---

# 12. Authorization và ownership boundary

| Hành động | Actor được phép | Resource / Scope | Điều kiện |
| --------- | --------------- | ---------------- | --------- |
| Xem Unassigned Application của Job | Primary Recruiter | Job mà actor đang là Primary | Cùng Job và đúng Company |
| Xem toàn bộ Application của Job | Primary Recruiter | Job mà actor đang là Primary | Cùng Job và đúng Company |
| Xem Application để quản lý Assignee | Company Manager | Application thuộc Company mình quản lý | Đúng owning Company |
| Assign | Primary Recruiter | Unassigned non-terminal Application của Managed Job | Target Recruiter hợp lệ |
| Reassign | Primary Recruiter | Assigned non-terminal Application của Managed Job | Target Recruiter hợp lệ |
| Unassign | Primary Recruiter | Assigned non-terminal Application của Managed Job | Target là `NONE` |
| Take over | Primary Recruiter | Non-terminal Application đang thuộc Supporting | Primary trở thành Assignee |
| Assign/Reassign/Unassign | Company Manager | Non-terminal Application thuộc Company mình quản lý | Target là `NONE` hoặc Recruiter hợp lệ |
| Recovery Primary responsibility sau Platform User lock/terminate | Company Manager | Active Job thuộc Company của mình | Replacement hợp lệ; không yêu cầu outgoing User `ACTIVE` |
| Recovery remove Supporting sau Platform User lock/terminate | Company Manager | Active Job thuộc Company của mình | Affected non-terminal Applications đã `UNASSIGNED`; không yêu cầu outgoing User `ACTIVE` |
| Automatic Unassign khi Assignee mất eligibility/rời team | Hệ thống | Non-terminal Application của outgoing Recruiter | Giữ nguyên Recruitment Status và business content |
| Cập nhật Recruitment Status | Assigned Recruiter | Application đang assign cho chính actor | Actor còn continuous eligibility và transition hợp lệ |
| Xem My Applications Recruiter | Recruiter | Application đang assign cho chính actor | Primary hoặc Supporting |
| Xem Application của Candidate | Candidate | Application thuộc chính Candidate | Không truy cập Application của Candidate khác |
| Withdraw | Candidate | Application thuộc chính Candidate | Application còn `APPLIED` |
| Replace Submitted CV | Candidate | Application thuộc chính Candidate | Giữ nguyên điều kiện V9 |
| Lock/terminate Platform User | Platform Admin | User thuộc canonical V1 account lifecycle | Không responsibility guard; automatic Unassign là system consequence |
| Assign/Reassign/Unassign/Status update | Platform Admin | Không có | Không được phép trong V10 |

Primary có quyền xem toàn bộ Application của Job nhưng không mặc nhiên có quyền trực tiếp thay Recruitment Status.

Supporting Recruiter chỉ được trực tiếp xử lý Application đang assign cho chính mình.

Company Manager có assignment-management authority nhưng không có pipeline-processing authority với tư cách Company Manager.

Platform Admin User lifecycle authority không bao gồm replacement selection, Application assignment management, Recruitment Team mutation hoặc Recruitment Status mutation. Primary Recruiter hoặc Company Manager của đúng scope có thể Assign lại sau automatic Unassign.

Authorization không được suy ra từ identifier do client tự khai báo nếu identifier đó mâu thuẫn với ownership và role thực tế.

---

# 13. Multi-tenant boundary

V10 có Company-level tenant boundary.

Canonical Company của một Application được xác định thông qua Job mà Application thuộc về.

```text
Authenticated Company Actor
        ↓
Company Membership hiện tại
        ↓
Job thuộc Company
        ↓
Application thuộc Job
        ↓
Authorized Company Scope
```

Các nguyên tắc:

1. Một Application thuộc tenant của Company sở hữu Job.
2. Primary Recruiter chỉ được Assign/Reassign/Unassign Application của Job thuộc Company phù hợp với membership của mình.
3. Assigned Recruiter phải thuộc cùng Company với Job.
4. Supporting Recruiter của Company khác không được làm Assignee.
5. Company Manager chỉ được Assign/Reassign/Unassign Application thuộc Company mình quản lý.
6. Recruiter không được dùng relationship với một Job của Company này để truy cập Application của Job thuộc Company khác.
7. Candidate ownership là user-scoped và độc lập với Company membership; Candidate chỉ xem Application của chính mình.
8. Company identity do client cung cấp không tự tạo ra quyền truy cập.
9. Platform Admin account lifecycle action không tạo Company-side recruitment authority.
10. Assignment management và lifecycle resolution phải resolve Company, Application, Job, outgoing Recruiter và target Recruiter từ current relationships trong cùng tenant.

Cross-tenant Assign, Reassign, Take over hoặc Unassign đều bị cấm.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn được bảo vệ trong V10:

1. Mỗi Candidate–Job có tối đa một Application.
2. Direct Application của V10 bắt đầu ở `APPLIED`.
3. Direct Application ban đầu là `UNASSIGNED`.
4. Recruitment Status và Assignment State là hai state dimensions độc lập.
5. Một Application có tối đa một Assigned Recruiter.
6. `UNASSIGNED` chỉ có nghĩa current Assignee là `NONE`, không phải Recruitment Status.
7. Assign không tự động chuyển `APPLIED → SCREENING` hoặc thay Recruitment Status hiện tại.
8. Supporting không có assignment-management authority.
9. Assigned Recruiter phải thỏa eligibility khi trực tiếp xử lý Application.
10. Recruiter mất eligibility không được tiếp tục pipeline.
11. Chỉ current Assigned Recruiter được trực tiếp cập nhật Recruitment Status.
12. Primary không được trực tiếp xử lý Application thuộc Supporting nếu chưa trở thành current Assignee.
13. Assign, Reassign, Take over và Unassign không thay đổi Recruitment Status.
14. Assignment management không thay Candidate, Job, source, `submittedCvSnapshot` hoặc Recruitment Team.
15. Mọi non-terminal Application có thể là `ASSIGNED` hoặc `UNASSIGNED`.
16. Chỉ non-terminal Application được Assign/Reassign/Take over/Unassign; terminal Application giữ final Assignment State.
17. Pipeline không được chuyển lùi.
18. Pipeline không được bỏ qua bước tiến bình thường.
19. `REJECTED` được phép từ các bước đánh giá đã định nghĩa.
20. `WITHDRAWN` chỉ thuộc Candidate-side flow.
21. `WITHDRAWN` chỉ được thực hiện từ `APPLIED`.
22. `HIRED`, `REJECTED`, `WITHDRAWN` là terminal.
23. Terminal Application không reopen.
24. Terminal Application không bị xóa chỉ vì đã kết thúc.
25. `submittedCvSnapshot` tiếp tục tồn tại khi Application kết thúc.
26. Job `CLOSED` không tự kết thúc Application đã tồn tại.
27. Job `EXPIRED` không tự kết thúc Application đã tồn tại.
28. Active Application responsibility có thể tồn tại sau khi Job đã `CLOSED` hoặc `EXPIRED`.
29. Job Status và Application Status là hai lifecycle độc lập.
30. Job đã có Application không được hard delete.
31. Application không được mất Job mà nó thuộc về.
32. Assignment management không tự thay đổi Recruitment Team.
33. Assignment-management authority không cấp pipeline authority cho Company Manager.
34. Current workload chỉ phản ánh non-terminal Applications đang được assign hiện tại.
35. Assign/Reassign/Take over/Unassign cập nhật current workload theo current Assignee; Unassigned Application không thuộc workload của Recruiter nào.
36. V10 không coi current workload là performance KPI.
37. Recruiter chỉ sử dụng `submittedCvSnapshot` của Application trong phạm vi xử lý Application.
38. Candidate chỉ xem Application của chính mình.
39. Candidate chỉ thấy `fullName`, `avatar`, `jobTitle` của Assigned Recruiter trong scope đã chốt; không expose email hoặc phone cá nhân.
40. Stale operation không được ghi đè Assignee, status hoặc snapshot mới hơn.
41. Application không được vừa `WITHDRAWN` vừa tiếp tục Recruitment Pipeline.
42. Cross-tenant Application assignment và processing bị cấm.
43. `INTERVIEW_SCHEDULED` và `INTERVIEW_COMPLETED` trong V10 không yêu cầu Interview Schedule entity.
44. Active Recruiter Responsibility là hợp của active Job-team responsibility và non-terminal assigned Application responsibility.
45. Non-terminal Application responsibility không phụ thuộc Job đang `PUBLISHED`, `CLOSED` hay `EXPIRED`.
46. Terminal Application không còn active responsibility cần quản lý và giữ final Assignee nếu đã có.
47. Application `UNASSIGNED` không được tiến pipeline; sau khi Assign lại, Recruiter tiếp tục từ Recruitment Status hiện tại.
48. Recruiter mất CompanyMember eligibility hoặc rời Recruitment Team phải được Unassign khỏi mọi affected non-terminal Application.
49. CompanyMember `LOCKED`/`TERMINATED` completion vẫn phải resolve active Job-team responsibility theo V6, nhưng Application responsibility có thể được resolve bằng Unassign mà không cần replacement.
50. Recruiter rời Recruitment Team không cần direct Application handoff; affected non-terminal Applications phải về `UNASSIGNED`.
51. Company lock giữ persisted assignment, freeze processing và không tạo Unassigned/synthetic replacement.
52. Assignment transition cạnh tranh với lifecycle/team completion không được khôi phục ineligible Assignee hoặc bỏ sót automatic Unassign.
53. Platform User lifecycle và CompanyMember Recruiter lifecycle là hai lifecycle độc lập.
54. Generic Platform User lock/terminate không bị block bởi Job/Application responsibility và không chạy CompanyMember final-zero guard.
55. Platform User lock/terminate giữ CompanyMember, Job team, Application status/content, thu hồi session theo V1 và automatic Unassign mọi affected non-terminal Application.
56. Outgoing Recruiter mất processing eligibility ngay khi User không còn `ACTIVE`; stale processing hoặc assignment dựa trên eligibility cũ phải fail.
57. Platform Admin không có assignment/pipeline authority; hệ thống Unassign và Primary/Company Manager có thể Assign lại sau.
58. Automatic Unassign Application responsibility không filter theo Job `PUBLISHED`, `CLOSED` hoặc `EXPIRED`.
59. Mọi target Recruiter khác `NONE` phải current eligible, cùng Company và thuộc current Recruitment Team của Job.
60. Terminal Application giữ final Assignee và không block lifecycle/team recovery.
61. Automatic Unassign không tự đồng bộ `CompanyMember.status` với `User.status`.
62. Company-lock freeze semantics không bị thay đổi bởi eligibility loss của một Recruiter riêng lẻ.

## 14.1. CompanyMember Recruiter lifecycle completion

Đối với Company Manager request `CompanyMember(RECRUITER).status → LOCKED | TERMINATED`, lifecycle completion phải xét toàn bộ Active Recruiter Responsibility:

```text
Active Recruiter Responsibility
=
active Job-team responsibility theo V6
UNION
non-terminal Application responsibility theo V10
```

Required business outcome:

1. resolve toàn bộ active responsibility;
2. thực hiện required Job/team transfer hoặc removal theo V6, bao gồm Primary replacement khi cần;
3. đưa mọi non-terminal Application đang assign cho outgoing Recruiter về `UNASSIGNED`;
4. chạy final guard trên current state;
5. chỉ hoàn tất lifecycle state khi:

```text
activeJobResponsibilityCount == 0
AND
nonTerminalAssignedApplicationCount == 0
```

Không có replacement Application Assignee không block lifecycle completion sau khi affected Applications đã `UNASSIGNED`. Nếu V6 yêu cầu Primary replacement mà không có replacement hợp lệ, hoặc active Job-team responsibility vẫn còn, lifecycle completion tiếp tục bị block để giữ invariant Job có đúng một Primary.

Boundary này không áp dụng cho Platform Admin request `User.status → LOCKED | TERMINATED`. Generic Platform User lifecycle được phép hoàn tất ngay theo V1; hệ thống automatic Unassign affected non-terminal Applications, còn Job-team recovery được Company Manager xử lý riêng theo V6.

## 14.2. Recruitment Team removal

Operation làm Recruiter chuyển khỏi Primary/Supporting sang `NONE` phải đưa mọi non-terminal Application đang assign cho Recruiter trên Job đó về `UNASSIGNED` trước hoặc cùng business completion của team removal. Không bắt buộc direct handoff sang replacement Application Assignee.

Primary transfer tiếp tục là Job-team operation theo V6 và Job không được có `NONE Primary`. Việc chỉ đổi Primary/Supporting position trong khi Recruiter vẫn thuộc team, cùng Company và fully eligible không tự tạo Application Unassign requirement.

## 14.3. Company lock

Xét riêng business consequence của Company lock action, khi Company mất operational state:

* toàn bộ Recruiter trong Company đồng thời mất processing eligibility;
* không tự reassign Application sang Recruiter khác trong cùng Company;
* không clear Assignee hoặc tạo synthetic `UNASSIGNED`;
* giữ current persisted assignment và freeze Application processing;
* không tạo synthetic replacement;
* nếu một canonical version sau này cho Company trở lại operational, eligibility được đánh giá lại từ current persisted Company/Job/team/Assignee relationships.

V10 không bổ sung Company reactivation transition và không trao Application authority cho Platform Admin thông qua Company lock. Nếu sau đó Platform User hoặc CompanyMember của một Recruiter có eligibility-losing transition riêng, automatic Unassign phát sinh từ transition riêng đó chứ không phải từ Company lock.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V10:

### 15.1. Assignment và Status History

Không triển khai:

* Assignment History.
* previous assignee history.
* status history.
* status timeline.
* Application activity timeline.
* audit timeline cho từng lần phân công hoặc thay status.

V10 chỉ giữ business view về current Assignee và current Recruitment Status.

### 15.2. Historical KPI và analytics

Không triển khai:

* historical workload;
* performance KPI;
* hire rate;
* reject rate;
* processing-time KPI;
* historical recruiter performance.

Current workload chỉ phản ánh trách nhiệm hiện tại.

### 15.3. Chat và communication module

Defer:

* Conversation.
* Message.
* Chat realtime.
* Recruitment notes.

Các capability này không được suy ra từ trạng thái `CONTACTED`.

### 15.4. Interview scheduling

Defer:

* Interview Schedule entity.
* thời gian/phòng/link phỏng vấn.
* Candidate confirmation.
* Candidate decline.
* reschedule.
* interview response lifecycle.

Trong V10, `INTERVIEW_SCHEDULED` và `INTERVIEW_COMPLETED` chỉ là Recruitment Status.

### 15.5. Notification

Defer:

* Notification persistence.
* Notification realtime.
* thông báo khi Assign/Reassign.
* thông báo khi status thay đổi.

### 15.6. Candidate Search và Job Invitation

Defer:

* Candidate Search.
* Recruiter Invitation.
* Accept/Reject Invitation.
* Application từ Invitation.
* source `RECRUITER_INVITATION`.

### 15.7. Job snapshot

V10 không bổ sung Job snapshot vào Application.

Nếu tương lai hệ thống cần lịch sử chính xác của Job tại thời điểm Apply, đó là requirement của version khác.

### 15.8. Kanban nâng cao

Không bắt buộc:

* Drag-and-drop.
* Kanban riêng theo Assignee.
* lane `Unassigned | Recruiter A | Recruiter B`.

V10 chỉ yêu cầu pipeline phản ánh Recruitment Status thật, có khả năng nhận biết Unassigned và lọc theo Assignee.

Không được tự implement các nội dung defer trên như requirement bắt buộc của V10.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V10.

Các quyết định về data representation, persistence, integration contract hoặc cơ chế bảo vệ concurrent operations không thuộc Product Specification này.

---

# 17. Definition of Business Completion

V10 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Direct Application và Unassigned flow được đáp ứng;
* `F02` — Assign mọi non-terminal Unassigned Application được đáp ứng;
* `F03` — Primary Reassign, Take over và Unassign được đáp ứng;
* `F04` — Company Manager assignment management được đáp ứng;
* `F05` — Recruitment Pipeline được đáp ứng;
* `F06` — Managed Jobs và Pipeline Workspace được đáp ứng;
* `F07` — Recruiter My Applications được đáp ứng;
* `F08` — Candidate My Applications được đáp ứng;
* `F09` — Application tiếp tục được xử lý sau Job `CLOSED`/`EXPIRED`;
* `F10` — Current Workload được đáp ứng;
* `F11` — Platform Admin User lifecycle independence, automatic Unassign và Job-team recovery boundary được đáp ứng;
* toàn bộ `BR-01` đến `BR-53` được đáp ứng;
* chỉ các Recruitment Status transition được định nghĩa mới được hỗ trợ;
* mọi non-terminal Recruitment Status đều có thể ở `ASSIGNED` hoặc `UNASSIGNED`;
* `NONE → Recruiter`, `Recruiter A → Recruiter B` và `Recruiter A → NONE` đều được hỗ trợ đúng authority;
* Unassign giữ nguyên Recruitment Status và toàn bộ Application business content;
* Unassigned Application không tiến pipeline và tiếp tục từ status hiện tại sau khi được Assign lại;
* continuous Assignee eligibility được bảo vệ;
* Primary, Supporting, Company Manager và Platform Admin giữ đúng authorization boundary;
* tenant boundary của Company được giữ;
* Candidate ownership boundary được giữ;
* Job đã có Application không bị hard delete;
* non-terminal Application không bị kết thúc hoặc mất khả năng tiếp tục xử lý chỉ vì Job đã `CLOSED` hoặc `EXPIRED`;
* Active Recruiter Responsibility được resolve trên cả active Job-team responsibility và non-terminal assigned Application responsibility;
* Recruiter mất CompanyMember eligibility hoặc rời Recruitment Team làm affected non-terminal Applications trở về `UNASSIGNED` mà không cần direct handoff;
* CompanyMember lifecycle completion vẫn resolve Job-team responsibility theo V6 và không tạo `NONE Primary`;
* final zero-responsibility guard chỉ áp dụng cho Company Manager initiated CompanyMember lifecycle, không block generic Platform User lifecycle;
* Platform Admin lock/terminate giữ CompanyMember/Job-team state, automatic Unassign non-terminal Applications và vẫn giữ V1 session/account invariants;
* processing dừng ngay khi outgoing User không còn `ACTIVE` và stale Application mutation không vượt qua eligibility loss/automatic Unassign đã hoàn tất;
* Company Manager có thể recovery Primary/Supporting theo V6, còn Primary hoặc Company Manager có thể Assign lại Application sau;
* automatic Unassign và khả năng Assign lại hoạt động độc lập với Job đang `PUBLISHED`, `CLOSED` hay `EXPIRED`;
* terminal Application giữ final Assignee và không block recovery;
* automatic Unassign không đồng bộ User lifecycle với CompanyMember lifecycle;
* Company lock action tự nó giữ assignment và freeze processing mà không reassign/unassign;
* Candidate rights từ V9 không bị phá;
* concurrent business operations không tạo stale overwrite;
* terminal Application không reopen;
* current workload không bị biến thành historical KPI;
* các nội dung đã defer không bị triển khai như requirement bắt buộc của V10;
* không xuất hiện behavior ngoài boundary của version.

Việc implementation hoạt động về mặt kỹ thuật không tự động đồng nghĩa với Business Completion nếu chưa đáp ứng đầy đủ business contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V10.

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
* cấu trúc request/response;
* persistence schema;
* index;
* data access strategy;
* cơ chế transaction cụ thể;
* cơ chế optimistic/pessimistic concurrency cụ thể;
* cấu trúc source code;
* framework;
* test framework.

Các quyết định kỹ thuật phải phục vụ các business truth đã định nghĩa trong tài liệu này.

Nếu data design hoặc implementation mâu thuẫn với tài liệu này, **Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
