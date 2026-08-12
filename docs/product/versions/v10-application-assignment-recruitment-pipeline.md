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

* Primary Recruiter phân công `Application` cho Recruiter hợp lệ trong Recruitment Team của Job;
* Primary Recruiter reassign hoặc take over `Application`;
* Company Manager thực hiện administrative forced reassignment khi cần handoff trách nhiệm;
* Assigned Recruiter xử lý `Application` qua Recruitment Pipeline;
* Candidate theo dõi các `Application` của chính mình;
* Recruiter theo dõi các `Application` đang được giao;
* Primary Recruiter theo dõi toàn bộ `Application` của các Job mình đang quản lý;
* các `Application` đã tồn tại tiếp tục được xử lý kể cả khi Job đã `CLOSED` hoặc `EXPIRED`;
* hệ thống theo dõi current workload của Recruiter theo các non-terminal `Application` hiện đang được giao.

V10 không tạo lại `Application` và không thay đổi bản chất của `submittedCvSnapshot` đã được xác định từ V9.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

* Tiếp nhận Direct Application từ V9.
* Trạng thái Unassigned của `Application`.
* Assign lần đầu.
* Reassign.
* Take over.
* Administrative forced reassignment bởi Company Manager.
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
* Kanban riêng theo Assignee.
* Drag-and-drop bắt buộc.
* Unassign Application.
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
* Take over;
* theo dõi pipeline;
* theo dõi current workload;
* không mặc nhiên là Assigned Recruiter của mọi Application.

### 4.4. Supporting Recruiter

Supporting Recruiter là Recruiter hiện đang thuộc Supporting Team của Job.

Supporting Recruiter:

* không được tự nhận Unassigned Application;
* không được phân Application cho Recruiter khác;
* chỉ trực tiếp xử lý Application khi chính mình là Assigned Recruiter hiện tại.

### 4.5. Assigned Recruiter

Assigned Recruiter là Recruiter hiện đang chịu trách nhiệm trực tiếp xử lý một `Application`.

Một Application có tối đa một Assigned Recruiter tại một thời điểm.

Assigned Recruiter phải là:

* Primary Recruiter của Job;

hoặc:

* Supporting Recruiter của Job.

### 4.6. Company Manager

Company Manager không trực tiếp thực hiện Recruitment Pipeline trong hoạt động tuyển dụng thông thường.

Company Manager được thực hiện administrative forced reassignment khi cần handoff trách nhiệm của một non-terminal Application.

Company Manager:

* không trở thành Assigned Recruiter thông qua administrative forced reassignment;
* không được thay đổi Recruitment Status của Application với tư cách Company Manager.

### 4.7. Platform Admin

Platform Admin không:

* Assign Application;
* Reassign Application;
* Take over Application;
* trực tiếp cập nhật Recruitment Status của Application.

### 4.8. Unassigned Application

Unassigned là trạng thái phân công của Application khi chưa có Assigned Recruiter.

Unassigned không phải Recruitment Status.

### 4.9. Current Workload

Current workload của Recruiter là tập hoặc số lượng non-terminal Applications hiện đang được assign trực tiếp cho Recruiter đó.

Current workload không phải performance KPI và không biểu diễn lịch sử trách nhiệm.

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

Assigned Recruiter của Application phải là Recruiter hợp lệ thuộc Recruitment Team hiện tại của chính Job đó.

Primary Recruiter của Job không tự động là Assigned Recruiter của mọi Application.

Supporting Recruiter thuộc team cũng không tự động có quyền trực tiếp xử lý mọi Application.

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
| `SCREENING`           | Assigned Recruiter đang xem xét hồ sơ                          |
| `CONTACTED`           | Candidate đã được phía tuyển dụng liên hệ                      |
| `INTERVIEW_SCHEDULED` | Application đang ở bước đã lên lịch phỏng vấn                  |
| `INTERVIEW_COMPLETED` | Application đã hoàn thành bước phỏng vấn                       |
| `HIRED`               | Candidate đã được ghi nhận tuyển cho Application này           |
| `REJECTED`            | Application đã bị phía tuyển dụng từ chối                      |
| `WITHDRAWN`           | Candidate đã chủ động rút Application                          |

`HIRED`, `REJECTED` và `WITHDRAWN` là terminal states.

### 6.2. Assignment State

Assignment có hai trạng thái nghiệp vụ:

* `UNASSIGNED`
* `ASSIGNED`

| Trạng thái   | Ý nghĩa                                                  |
| ------------ | -------------------------------------------------------- |
| `UNASSIGNED` | Application chưa có Recruiter trực tiếp chịu trách nhiệm |
| `ASSIGNED`   | Application có đúng một Assigned Recruiter hiện tại      |

`UNASSIGNED` không phải một giá trị của Recruitment Status.

---

## 7. Tổ hợp trạng thái hợp lệ

Recruitment Status và Assignment State là hai state dimensions độc lập nhưng không phải mọi tổ hợp đều hợp lệ.

| Recruitment Status    | Assignment State | Hợp lệ | Ý nghĩa                                                     |
| --------------------- | ---------------- | -----: | ----------------------------------------------------------- |
| `APPLIED`             | `UNASSIGNED`     |     Có | Direct Application mới hoặc Application chưa được phân công |
| `APPLIED`             | `ASSIGNED`       |     Có | Đã giao Recruiter nhưng chưa bắt đầu Screening              |
| `SCREENING`           | `ASSIGNED`       |     Có | Recruiter đã bắt đầu xử lý                                  |
| `CONTACTED`           | `ASSIGNED`       |     Có | Recruiter đang trực tiếp phụ trách                          |
| `INTERVIEW_SCHEDULED` | `ASSIGNED`       |     Có | Recruiter đang trực tiếp phụ trách                          |
| `INTERVIEW_COMPLETED` | `ASSIGNED`       |     Có | Recruiter đang trực tiếp phụ trách                          |
| `HIRED`               | `ASSIGNED`       |     Có | Application kết thúc và giữ Assignee cuối cùng              |
| `REJECTED`            | `ASSIGNED`       |     Có | Application kết thúc và giữ Assignee cuối cùng              |
| `WITHDRAWN`           | `UNASSIGNED`     |     Có | Candidate rút hồ sơ trước khi được assign                   |
| `WITHDRAWN`           | `ASSIGNED`       |     Có | Candidate rút hồ sơ sau khi assign nhưng trước Screening    |

Các tổ hợp sau không thuộc business lifecycle hợp lệ của V10:

* `SCREENING` + `UNASSIGNED`;
* `CONTACTED` + `UNASSIGNED`;
* `INTERVIEW_SCHEDULED` + `UNASSIGNED`;
* `INTERVIEW_COMPLETED` + `UNASSIGNED`;
* `HIRED` + `UNASSIGNED`;
* `REJECTED` + `UNASSIGNED`.

Việc một Application đang có Assigned Recruiter không tự động có nghĩa Recruiter đó còn operational eligibility để tiếp tục xử lý.

Quyền xử lý luôn phụ thuộc vào eligibility hiện tại.

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

Nếu cần đổi người chịu trách nhiệm:

```text
Primary Reassign
hoặc
Primary Take over
hoặc
Company Manager administrative forced reassignment
  ↓
Assigned Recruiter mới nhận trách nhiệm hiện tại
  ↓
Recruitment Status không thay đổi
```

Job chuyển sang `CLOSED` hoặc `EXPIRED` không làm dừng xử lý các Application đã tồn tại.

---

# 9. Functional Requirements

## F01 — Tiếp nhận Direct Application và Unassigned Applications

### Actor

* Candidate.
* Primary Recruiter.

### Mục tiêu

Tiếp nhận các Direct Application đã được tạo từ V9 làm đầu vào cho quá trình phân công và xử lý tuyển dụng của V10.

### Tiền điều kiện

* Application đã tồn tại từ V9.
* Application thuộc nguồn `DIRECT_APPLICATION`.
* Application bắt đầu ở `APPLIED`.
* Application mới chưa có Assigned Recruiter.

### Luồng chính

1. Candidate hoàn tất Direct Application trong V9.
2. Application tồn tại ở `APPLIED`.
3. Application chưa có Assigned Recruiter.
4. Application được xem là Unassigned.
5. Primary Recruiter của Job có thể xem Application trong phạm vi Managed Job tương ứng.
6. Primary có thể xem Candidate, CV snapshot và Recruitment Status của Application để thực hiện phân công.

### Kết quả

* Application tiếp tục là cùng Application đã tạo ở V9.
* Application vẫn giữ Candidate, Job, source và `submittedCvSnapshot`.
* Application chờ được Primary Recruiter phân công.

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

## F02 — Assign Application lần đầu

### Actor

* Primary Recruiter hiện tại của Job.

### Mục tiêu

Xác định Recruiter chịu trách nhiệm trực tiếp xử lý một Unassigned Application.

### Tiền điều kiện

* Actor là Primary Recruiter hiện tại của Job.
* Application chưa kết thúc.
* Application đang Unassigned.
* Assignee được chọn thỏa toàn bộ eligibility hiện tại.

### Luồng chính

1. Primary chọn một Unassigned Application của Job.
2. Primary chọn:

   * chính mình;
   * hoặc một Supporting Recruiter hợp lệ của Job.
3. Eligibility của Assignee được xác nhận tại thời điểm phân công.
4. Application được gắn với đúng một Assigned Recruiter.
5. Recruitment Status không thay đổi.

### Kết quả

* Application chuyển từ `UNASSIGNED` sang `ASSIGNED`.
* Application xuất hiện trong My Applications của Assigned Recruiter.
* Nếu đang `APPLIED`, Application vẫn là `APPLIED`.
* Assigned Recruiter có quyền trực tiếp xử lý Application khi còn đủ eligibility.

### Trường hợp từ chối

Không được Assign khi:

* actor không phải Primary hiện tại;
* Application đã có Assignee;
* Application đã ở terminal state;
* Assignee không thuộc đúng Company;
* Assignee không có role Recruiter;
* Assignee không phải Primary hoặc Supporting hiện tại của Job;
* Company Member của Assignee không ACTIVE;
* User của Assignee không ACTIVE;
* Company không hoạt động.

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
* Unassign.

---

## F03 — Reassign và Take over Application

### Actor

* Primary Recruiter hiện tại của Job.

### Mục tiêu

Chuyển trách nhiệm trực tiếp của một non-terminal Application từ Assigned Recruiter hiện tại sang Recruiter hợp lệ khác.

### Tiền điều kiện

* Application đang có Assigned Recruiter.
* Application chưa kết thúc.
* Actor là Primary hiện tại của Job.
* Assignee mới thỏa eligibility.

### Luồng chính — Reassign

1. Primary chọn Application đang có Assignee.
2. Primary chọn:

   * chính Primary;
   * hoặc Supporting Recruiter hợp lệ khác.
3. Assignee mới được xác nhận eligibility.
4. Trách nhiệm hiện tại chuyển trực tiếp từ Assignee cũ sang Assignee mới.
5. Recruitment Status được giữ nguyên.

### Luồng chính — Take over

1. Primary chọn Application đang do Supporting Recruiter xử lý.
2. Primary thực hiện Take over.
3. Primary trở thành Assigned Recruiter hiện tại.
4. Supporting cũ mất quyền trực tiếp xử lý Application.
5. Recruitment Status được giữ nguyên.

### Kết quả

* Application luôn có tối đa một Assignee.
* Application không quay về Unassigned.
* Assignee cũ không còn current responsibility.
* Assignee mới nhận current responsibility.
* Candidate, Job, source và CV snapshot không thay đổi.

### Trường hợp từ chối

* Application đã terminal.
* Actor không còn là Primary hiện tại.
* Assignee mới không hợp lệ.
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

* Unassign.
* Thay Recruitment Team.
* Thay status cùng với Reassign.
* Lưu Assignment History.

---

## F04 — Administrative Forced Reassignment

### Actor

* Company Manager của Company sở hữu Job.

### Mục tiêu

Cho phép Company Manager bảo đảm handoff trách nhiệm khi Assigned Recruiter của một non-terminal Application cần hoặc sắp mất operational eligibility.

### Tiền điều kiện

* Application thuộc Job của Company do Company Manager quản lý.
* Application chưa kết thúc.
* Có nhu cầu administrative handoff.
* Assignee mới là Recruiter hợp lệ của Recruitment Team hiện tại của Job.

### Luồng chính

1. Xác định non-terminal Application cần handoff.
2. Company Manager chọn Recruiter thay thế hợp lệ.
3. Current responsibility được chuyển trực tiếp sang Assignee mới.
4. Recruitment Status giữ nguyên.
5. Assignee mới tiếp tục xử lý Application theo quyền của Assigned Recruiter.

### Kết quả

* Application không quay về Unassigned.
* Company Manager không trở thành Assignee.
* Company Manager không có quyền cập nhật Recruitment Status vì đã thực hiện forced reassignment.
* Responsibility được handoff cho Recruiter hợp lệ.

### Trường hợp từ chối

* Application đã terminal.
* Application không thuộc Company của Company Manager.
* Assignee mới không hợp lệ.
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
* Không được bỏ qua bước tiến bình thường.
* Không được chuyển lùi.
* Terminal Application không được xử lý tiếp.

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
* Khi Reassign sang Recruiter khác, Application không còn thuộc current responsibility của Recruiter cũ.

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

Nếu Application chưa assign, Candidate được biết hồ sơ đang chờ người phụ trách.

Nếu Application đã assign, Candidate được xem:

* `fullName`;
* `avatar`;
* `jobTitle`;

của Assigned Recruiter hiện tại.

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
* Company Manager trong administrative handoff.

### Mục tiêu

Bảo đảm Application đã tồn tại tiếp tục có lifecycle độc lập kể cả khi Job đã `CLOSED` hoặc `EXPIRED`.

### Tiền điều kiện

* Application đã tồn tại trước đó.

### Luồng chính

Khi Job chuyển sang `CLOSED` hoặc `EXPIRED`:

* Application hiện có không tự động kết thúc;
* non-terminal Application vẫn có thể được Assign;
* non-terminal Application vẫn có thể được Reassign;
* Primary vẫn có thể Take over;
* Company Manager vẫn có thể thực hiện administrative forced reassignment khi cần handoff;
* Assigned Recruiter vẫn có thể tiếp tục Recruitment Pipeline nếu còn đủ eligibility;
* Application vẫn có thể kết thúc bằng `REJECTED` hoặc `HIRED`;
* Candidate vẫn có thể Withdraw nếu Application còn `APPLIED`.

### Kết quả

* Job Status và Application Status tiếp tục là hai lifecycle độc lập.
* Recruitment responsibility đối với non-terminal Application không tự động kết thúc cùng Job.
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

Khi Reassign hoặc Take over:

* Application rời current workload của Assignee cũ;
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

# 10. Business Rules

## BR-01 — V10 tiếp nhận Application từ V9

V10 xử lý `Application` đã được tạo bởi Direct Application của V9.

V10 không tạo lại Application khi bắt đầu quá trình phân công.

---

## BR-02 — Một Candidate–Job có tối đa một Application

V10 giữ nguyên invariant một Candidate chỉ có tối đa một Application cho cùng một Job.

---

## BR-03 — Recruitment Status và Assigned Recruiter độc lập

Recruitment Status biểu diễn vị trí của Application trong quá trình tuyển dụng.

Assigned Recruiter biểu diễn người đang chịu trách nhiệm trực tiếp.

Thay đổi một chiều không mặc nhiên thay đổi chiều còn lại.

---

## BR-04 — Một Application có tối đa một Assignee

Một Application có thể:

* chưa có Assigned Recruiter;
* hoặc có đúng một Assigned Recruiter hiện tại.

Không được có nhiều Assigned Recruiter đồng thời.

---

## BR-05 — Unassigned không phải Recruitment Status

Unassigned chỉ biểu diễn Application chưa có Assigned Recruiter.

Không tạo Recruitment Status `UNASSIGNED`.

---

## BR-06 — Chỉ Primary được Assign lần đầu

Trong luồng phân công thông thường, chỉ Primary Recruiter hiện tại của Job được Assign Unassigned Application.

Primary có thể assign cho:

* chính mình;
* Supporting Recruiter hợp lệ của Job.

---

## BR-07 — Eligibility của Assignee

Một Recruiter chỉ hợp lệ để trở thành Assigned Recruiter khi đồng thời:

* thuộc Company sở hữu Job;
* có role Recruiter;
* đang là Primary hoặc Supporting của Job;
* Company Membership đang ACTIVE;
* User đang ACTIVE;
* Company đang hoạt động.

---

## BR-08 — Continuous Assignee Eligibility

Eligibility không chỉ được yêu cầu tại thời điểm Assign/Reassign.

Assigned Recruiter phải tiếp tục thỏa eligibility tại thời điểm thực hiện mỗi hành động xử lý Application.

Recruiter đã mất eligibility không được tiếp tục Recruitment Pipeline chỉ vì vẫn đang được ghi nhận là Assignee.

---

## BR-09 — Supporting không tự nhận Application

Supporting Recruiter không được:

* tự nhận Unassigned Application;
* Assign Application cho chính mình;
* Assign Application cho Supporting Recruiter khác;
* giành Application đang thuộc Recruiter khác.

---

## BR-10 — Không có Unassign

Sau khi Application đã có Assignee, V10 không cho phép đưa Application trở lại Unassigned.

Responsibility chỉ được:

* giữ nguyên;
* hoặc chuyển trực tiếp sang Recruiter hợp lệ khác.

---

## BR-11 — Assign không thay đổi Application content hoặc Recruitment Status

Assign không được thay đổi:

* Candidate;
* Job;
* source;
* `submittedCvSnapshot`;
* Recruitment Status;
* Recruitment Team.

Assign một `APPLIED` Application phải giữ nguyên `APPLIED`.

---

## BR-12 — Primary được Reassign non-terminal Application

Primary Recruiter hiện tại được Reassign non-terminal Application từ Assignee hiện tại sang:

* chính Primary;
* hoặc Supporting Recruiter hợp lệ khác.

---

## BR-13 — Take over là trường hợp đặc biệt của Reassign

Take over chuyển responsibility của Application từ Supporting Recruiter hiện tại sang Primary Recruiter hiện tại.

Take over không thay đổi Recruitment Status.

---

## BR-14 — Reassign chỉ thay đổi current responsibility

Reassign không được thay đổi:

* Candidate;
* Job;
* source;
* `submittedCvSnapshot`;
* Recruitment Status.

---

## BR-15 — Company Manager có administrative forced reassignment

Company Manager được phép forced reassign non-terminal Application thuộc Company của mình khi cần administrative handoff trách nhiệm.

Quyền này không biến Company Manager thành Recruiter xử lý Application.

---

## BR-16 — Forced reassignment không cấp quyền pipeline cho Company Manager

Company Manager không được trực tiếp thực hiện Recruitment Status transition chỉ vì có quyền forced reassignment.

Sau handoff, quyền xử lý thuộc về Assigned Recruiter mới.

---

## BR-17 — Chỉ non-terminal Application được thay đổi Assignee

Assign, Reassign và Take over chỉ được thực hiện khi Application ở một trong các trạng thái:

* `APPLIED`;
* `SCREENING`;
* `CONTACTED`;
* `INTERVIEW_SCHEDULED`;
* `INTERVIEW_COMPLETED`.

Không được Assign/Reassign/Take over:

* `HIRED`;
* `REJECTED`;
* `WITHDRAWN`.

---

## BR-18 — Quyền trực tiếp xử lý thuộc về current Assignee

Chỉ Assigned Recruiter hiện tại và còn đủ eligibility được trực tiếp cập nhật Recruitment Status trong hoạt động tuyển dụng thông thường.

Application chưa có Assignee không được Recruiter cập nhật Recruitment Status.

---

## BR-19 — Primary không mặc nhiên có quyền xử lý Application của Supporting

Primary Recruiter được xem toàn bộ Application của Job.

Nếu Application đang do Supporting Recruiter xử lý, Primary không được trực tiếp thay Recruitment Status.

Primary phải Take over trước nếu muốn trở thành người trực tiếp xử lý.

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

Job đã `CLOSED` hoặc `EXPIRED` nhưng còn non-terminal Application vẫn còn recruitment responsibility.

Các Application đó vẫn phải có khả năng:

* Assign;
* Reassign;
* Take over;
* administrative forced reassignment;
* tiếp tục Recruitment Pipeline.

---

## BR-28 — Mất eligibility yêu cầu handoff trách nhiệm

Khi một Recruiter đang chịu trách nhiệm cho non-terminal Application cần mất hoặc đã mất operational eligibility:

* Recruiter đó không được tiếp tục xử lý;
* responsibility phải được handoff cho Recruiter hợp lệ khác trước khi Application có thể tiếp tục pipeline;
* các thao tác quản trị Recruiter/Recruitment Team không được coi Job `CLOSED` hoặc `EXPIRED` là lý do để bỏ qua active Application responsibility.

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
* forced reassignment;
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

---

## BR-34 — Reassign chuyển current workload

Khi một non-terminal Application được Reassign:

* Assignee cũ mất Application khỏi current workload;
* Assignee mới nhận Application vào current workload.

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

---

## BR-37 — Cạnh tranh khi Assign/Reassign

Assign lần đầu chỉ được thành công nếu Application vẫn đang Unassigned tại thời điểm việc phân công được quyết định.

Reassign chỉ được thành công nếu Application vẫn đang ở responsibility state mà hành động Reassign đang dựa vào.

Hai hành động cạnh tranh không được làm Application có nhiều Assignee hoặc làm assignment cũ ghi đè assignment mới.

---

## BR-38 — Reassign cạnh tranh với status update

Nếu Recruiter A đang cập nhật Recruitment Status đồng thời Primary Reassign Application từ A sang B:

* nếu Reassign sang B hoàn tất trước, A không còn quyền cập nhật status;
* nếu status update của A hoàn tất hợp lệ trước, status mới được giữ và Reassign có thể tiếp tục dựa trên state mới.

Không được để request dựa trên Assignee cũ ghi đè responsibility mới.

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

---

## BR-41 — Candidate ownership boundary

Candidate chỉ được xem và thao tác các Candidate-side actions trên Application thuộc chính Candidate đó.

Candidate không được truy cập Application của Candidate khác.

---

## BR-42 — Administrative actor boundary

Company Manager chỉ có quyền administrative forced reassignment đã được định nghĩa trong V10.

Platform Admin không được:

* Assign;
* Reassign;
* Take over;
* cập nhật Recruitment Status.

Company Manager và Platform Admin không được trở thành Assigned Recruiter thông qua V10 nếu không đồng thời là một Recruiter hợp lệ theo business model hiện hành.

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

| Hành động                          | Trước                  | Sau                 | Actor             |
| ---------------------------------- | ---------------------- | ------------------- | ----------------- |
| Assign lần đầu                     | `UNASSIGNED`           | `ASSIGNED(A)`       | Primary Recruiter |
| Reassign                           | `ASSIGNED(A)`          | `ASSIGNED(B)`       | Primary Recruiter |
| Take over                          | `ASSIGNED(Supporting)` | `ASSIGNED(Primary)` | Primary Recruiter |
| Administrative forced reassignment | `ASSIGNED(A)`          | `ASSIGNED(B)`       | Company Manager   |

Không có:

```text
ASSIGNED → UNASSIGNED
```

trong V10.

Assign/Reassign không tự động tạo Recruitment Status transition.

---

# 12. Authorization và ownership boundary

| Hành động                          | Actor được phép    | Resource / Scope                                | Điều kiện                                             |
| ---------------------------------- | ------------------ | ----------------------------------------------- | ----------------------------------------------------- |
| Xem Unassigned Application của Job | Primary Recruiter  | Job mà actor đang là Primary                    | Cùng Job và đúng Company                              |
| Xem toàn bộ Application của Job    | Primary Recruiter  | Job mà actor đang là Primary                    | Cùng Job và đúng Company                              |
| Assign lần đầu                     | Primary Recruiter  | Unassigned non-terminal Application của Job     | Assignee mới hợp lệ                                   |
| Reassign                           | Primary Recruiter  | Assigned non-terminal Application của Job       | Assignee mới hợp lệ                                   |
| Take over                          | Primary Recruiter  | Non-terminal Application đang thuộc Supporting  | Primary trở thành Assignee                            |
| Administrative forced reassignment | Company Manager    | Non-terminal Application thuộc Company của mình | Chỉ phục vụ administrative handoff; target hợp lệ     |
| Cập nhật Recruitment Status        | Assigned Recruiter | Application đang assign cho chính actor         | Actor còn continuous eligibility và transition hợp lệ |
| Xem My Applications Recruiter      | Recruiter          | Application đang assign cho chính actor         | Primary hoặc Supporting                               |
| Xem Application của Candidate      | Candidate          | Application thuộc chính Candidate               | Không truy cập Application của Candidate khác         |
| Withdraw                           | Candidate          | Application thuộc chính Candidate               | Application còn `APPLIED`                             |
| Replace Submitted CV               | Candidate          | Application thuộc chính Candidate               | Giữ nguyên điều kiện V9                               |
| Assign/Reassign/Status update      | Platform Admin     | Không có                                        | Không được phép trong V10                             |

Primary có quyền xem toàn bộ Application của Job nhưng không mặc nhiên có quyền trực tiếp thay Recruitment Status.

Supporting Recruiter chỉ được trực tiếp xử lý Application đang assign cho chính mình.

Company Manager có administrative handoff authority nhưng không có ordinary pipeline-processing authority.

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
2. Primary Recruiter chỉ được Assign/Reassign Application của Job thuộc Company phù hợp với membership của mình.
3. Assigned Recruiter phải thuộc cùng Company với Job.
4. Supporting Recruiter của Company khác không được làm Assignee.
5. Company Manager chỉ được administrative forced reassign Application thuộc Company mình quản lý.
6. Recruiter không được dùng relationship với một Job của Company này để truy cập Application của Job thuộc Company khác.
7. Candidate ownership là user-scoped và độc lập với Company membership; Candidate chỉ xem Application của chính mình.
8. Company identity do client cung cấp không tự tạo ra quyền truy cập.

Cross-tenant Assign, Reassign, Take over hoặc administrative forced reassignment đều bị cấm.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn được bảo vệ trong V10:

1. Mỗi Candidate–Job có tối đa một Application.
2. Direct Application của V10 bắt đầu ở `APPLIED`.
3. Direct Application ban đầu là Unassigned.
4. Recruitment Status và Assigned Recruiter là hai state dimensions độc lập.
5. Một Application có tối đa một Assigned Recruiter.
6. Unassigned không phải Recruitment Status.
7. Assign không tự động chuyển `APPLIED → SCREENING`.
8. Supporting không được tự nhận Unassigned Application.
9. Assigned Recruiter phải thỏa eligibility khi trực tiếp xử lý Application.
10. Recruiter mất eligibility không được tiếp tục pipeline.
11. Chỉ current Assigned Recruiter được trực tiếp cập nhật Recruitment Status.
12. Primary không được trực tiếp xử lý Application thuộc Supporting nếu chưa Take over.
13. Reassign và Take over không thay đổi Recruitment Status.
14. Reassign và Take over không thay Candidate, Job, source hoặc CV snapshot.
15. Application đã assign không quay lại Unassigned.
16. Chỉ non-terminal Application được Assign/Reassign/Take over.
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
32. Assign/Reassign không tự thay đổi Recruitment Team.
33. Administrative forced reassignment không cấp pipeline authority cho Company Manager.
34. Current workload chỉ phản ánh non-terminal Applications đang được assign hiện tại.
35. Reassign chuyển current workload từ Assignee cũ sang Assignee mới.
36. V10 không coi current workload là performance KPI.
37. Recruiter chỉ sử dụng `submittedCvSnapshot` của Application trong phạm vi xử lý Application.
38. Candidate chỉ xem Application của chính mình.
39. Candidate chỉ thấy `fullName`, `avatar`, `jobTitle` của Assigned Recruiter trong scope đã chốt; không expose email hoặc phone cá nhân.
40. Stale operation không được ghi đè Assignee, status hoặc snapshot mới hơn.
41. Application không được vừa `WITHDRAWN` vừa tiếp tục Recruitment Pipeline.
42. Cross-tenant Application assignment và processing bị cấm.
43. `INTERVIEW_SCHEDULED` và `INTERVIEW_COMPLETED` trong V10 không yêu cầu Interview Schedule entity.

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
* `F02` — Assign lần đầu được đáp ứng;
* `F03` — Reassign và Take over được đáp ứng;
* `F04` — Administrative Forced Reassignment được đáp ứng;
* `F05` — Recruitment Pipeline được đáp ứng;
* `F06` — Managed Jobs và Pipeline Workspace được đáp ứng;
* `F07` — Recruiter My Applications được đáp ứng;
* `F08` — Candidate My Applications được đáp ứng;
* `F09` — Application tiếp tục được xử lý sau Job `CLOSED`/`EXPIRED`;
* `F10` — Current Workload được đáp ứng;
* toàn bộ `BR-01` đến `BR-45` được đáp ứng;
* chỉ các Recruitment Status transition được định nghĩa mới được hỗ trợ;
* Assignment lifecycle không xuất hiện Unassign;
* continuous Assignee eligibility được bảo vệ;
* Primary, Supporting, Company Manager và Platform Admin giữ đúng authorization boundary;
* tenant boundary của Company được giữ;
* Candidate ownership boundary được giữ;
* Job đã có Application không bị hard delete;
* non-terminal Application không mất recruitment responsibility chỉ vì Job đã `CLOSED` hoặc `EXPIRED`;
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
