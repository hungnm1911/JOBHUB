# V9 — Candidate chủ động Apply và tạo Application

> **File:** `docs/product/versions/v9-candidate-direct-apply-application.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V9.

---

## 1. Mục tiêu

V9 bổ sung khả năng để Candidate chủ động ứng tuyển vào một Job đang còn nhận hồ sơ và lần đầu tiên tạo đối tượng `Application` trong hệ thống.

Sau khi V9 hoàn thành, hệ thống phải hỗ trợ được:

* Candidate đã đăng nhập chủ động Apply vào một Job hợp lệ;
* Candidate chọn một Candidate CV hợp lệ của chính mình để ứng tuyển;
* Candidate có thể upload CV mới theo nghiệp vụ V7, lưu vào My CVs rồi sử dụng CV đó để Apply;
* hệ thống tạo `Application` nguồn `DIRECT_APPLICATION`;
* Application mới bắt đầu tại trạng thái `APPLIED` và chưa có Assigned Recruiter;
* hệ thống giữ một `submittedCvSnapshot` độc lập với Candidate CV đang sống trong My CVs;
* Candidate có thể Replace Submitted CV khi Application còn `APPLIED` và Job vẫn còn nhận hồ sơ;
* Candidate có thể Withdraw Application khi Application còn `APPLIED`;
* hệ thống bảo đảm một Candidate và một Job có tối đa một Application trong toàn bộ vòng đời;
* V9 kế thừa nguyên vẹn hard-delete boundary của V5: Job chỉ được hard-delete
  khi còn `DRAFT` hoặc `PENDING_APPROVAL`; Direct Application chỉ được tạo cho
  Job `PUBLISHED` nên V9 không bổ sung deletion guard mới.

V9 chỉ xây dựng điểm vào của Candidate vào quy trình tuyển dụng.

Việc Recruiter tiếp nhận, phân công và xử lý Application trong pipeline không thuộc V9.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V9 bao gồm:

* Direct Apply của Candidate;
* kiểm tra điều kiện Job còn nhận hồ sơ;
* kiểm tra điều kiện Candidate CV được dùng để Apply;
* lựa chọn CV từ My CVs;
* sử dụng Default CV như lựa chọn được đề xuất sẵn;
* upload CV mới theo nghiệp vụ V7 rồi dùng CV đó để Apply;
* tạo Application;
* chống tạo Application trùng cho cùng Candidate–Job;
* tạo `submittedCvSnapshot`;
* bảo đảm snapshot độc lập với Candidate CV gốc;
* Replace Submitted CV;
* Withdraw Application;
* bảo vệ các thao tác Candidate trước thay đổi trạng thái cạnh tranh;
* giữ Application và snapshot sau Withdraw;
* giữ nguyên hard-delete boundary của Job đã được V5 xác lập;
* xác định authorization và ownership boundary cho các thao tác Candidate;
* xác định tenant context của Application thông qua Job và Company.

### 2.2. Ngoài phạm vi

V9 không triển khai:

* My Applications hoàn chỉnh;
* danh sách toàn bộ Application của Candidate;
* tìm kiếm hoặc lọc Application;
* timeline tuyển dụng;
* Recruiter Application workspace;
* assign Application;
* reassign Application;
* take over Application;
* assignment history;
* pipeline xử lý Application sau `APPLIED`;
* thao tác Recruiter chuyển Application sang `SCREENING`;
* status history đầy đủ;
* Candidate Search;
* Job Invitation;
* tạo Application từ Job Invitation;
* Job Invitation snapshot;
* Notification;
* realtime notification;
* Conversation;
* Message;
* Chat;
* Interview Schedule;
* Candidate Availability;
* Job snapshot trong Application;
* lịch sử các phiên bản Submitted CV;
* quyền đọc/xử lý Application chi tiết của từng loại Company Staff;
* cơ chế khôi phục Job đã bị xóa trước khi có Application;
* cơ chế cho phép Candidate Apply lại cùng Job sau Application cũ kết thúc.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V9 sử dụng và mở rộng các business contract đã có:

* **V1 — User và Authentication**

  * authenticated user;
  * Candidate identity;
  * account lifecycle và authorization nền tảng.

* **V2 — Company**

  * Company;
  * trạng thái hoạt động của Company;
  * Company là tenant nghiệp vụ độc lập.

* **V5 — Job và vòng đời Job**

  * Job;
  * Company sở hữu Job;
  * `PUBLISHED`;
  * `CLOSED`;
  * `EXPIRED`;
  * application deadline;
  * effective Job availability;
  * Job hard-delete của Company Manager.

* **V6 — Recruitment Team**

  * Primary Recruiter;
  * Supporting Recruiter;
  * Recruitment Team của Job.

* **V7 — Candidate Profile và CV library**

  * Candidate Profile;
  * CandidateCV;
  * Generated CV;
  * Uploaded CV;
  * `DRAFT`;
  * `ACTIVE`;
  * `PRIVATE`;
  * `PUBLIC`;
  * Default CV;
  * Archive CV;
  * My CVs.

* **V8 — Job Discovery**

  * Candidate và Guest xem Job;
  * Job public eligibility;
  * Company phải còn hoạt động để Job tiếp tục là cơ hội tuyển dụng hợp lệ.

V9 không thay đổi các invariant của version trước.

V9 kế thừa nguyên vẹn hard-delete boundary của V5:

* Job chỉ được hard-delete khi còn `DRAFT` hoặc `PENDING_APPROVAL`;
* từ `PUBLISHED` trở đi, Job không còn thuộc hard-delete states;
* Direct Application chỉ được tạo cho Job `PUBLISHED`.

Do đó V9 không bổ sung Application-existence deletion guard, soft delete hoặc
coordination mới giữa Direct Apply và Job hard-delete. Các quyền đóng Job và
các lifecycle transition khác của V5 tiếp tục giữ nguyên.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Candidate

User có vai trò Candidate.

Trong V9, Candidate là actor duy nhất được:

* Direct Apply;
* lựa chọn CV để Apply;
* Replace Submitted CV của Application của chính mình;
* Withdraw Application của chính mình.

### 4.2. Guest

Người chưa đăng nhập.

Guest tiếp tục có thể xem Job theo V8 nhưng không được tạo hoặc thay đổi Application.

### 4.3. Application

Đối tượng nghiệp vụ đại diện cho việc một Candidate tham gia quy trình tuyển dụng của một Job cụ thể.

Mỗi Application thuộc:

* đúng một Candidate;
* đúng một Job.

Trạng thái tuyển dụng thuộc về từng Application, không thuộc chung về Candidate.

Một Candidate có thể đồng thời có các Application ở các Job khác nhau với trạng thái khác nhau.

### 4.4. Direct Application

Application được tạo do Candidate chủ động Apply.

Nguồn nghiệp vụ:

`DIRECT_APPLICATION`

V9 chỉ tạo Application từ nguồn này.

### 4.5. CandidateCV

CV đang sống trong thư viện My CVs của Candidate theo V7.

CandidateCV và CV đã nộp vào Application là hai đối tượng có business meaning khác nhau.

### 4.6. Submitted CV Snapshot

Bản sao của CV mà Candidate hiện đang gửi cho một Application.

Khi Application mới được tạo, snapshot là bản sao CV tại thời điểm Candidate Apply.

Nếu Candidate thực hiện Replace Submitted CV thành công, snapshot mới trở thành Submitted CV hiện tại của Application.

V9 chỉ giữ một Submitted CV Snapshot hiện tại.

### 4.7. Job còn nhận hồ sơ

Một Job được coi là còn nhận hồ sơ khi đồng thời:

* Job vẫn tồn tại;
* Job đang `PUBLISHED`;
* application deadline chưa qua;
* Company sở hữu Job vẫn đang hoạt động.

### 4.8. Default CV

CandidateCV được Candidate chọn làm Default theo V7.

Default CV chỉ hỗ trợ preselection trong Apply flow.

Default CV không bắt buộc phải được sử dụng khi Candidate Apply.

### 4.9. Assigned Recruiter

Recruiter cụ thể đang được phân công xử lý một Application.

Direct Application trong V9 bắt đầu mà chưa có Assigned Recruiter.

Assigned Recruiter và Primary Recruiter của Job là hai khái niệm độc lập.

---

## 5. Quan hệ nghiệp vụ chính

### 5.1. Candidate và Application

```text
Candidate
   │
   │ 1 — 0..N
   ↓
Application
```

Mỗi Application thuộc đúng một Candidate.

Một Candidate có thể có nhiều Application ở các Job khác nhau.

### 5.2. Job và Application

```text
Job
   │
   │ 1 — 0..N
   ↓
Application
```

Một Job có thể nhận Application từ nhiều Candidate.

### 5.3. Candidate–Job uniqueness

```text
Candidate
   +
Job
   ↓
Tối đa 1 Application
```

Trong toàn bộ vòng đời:

> Một Candidate và một Job có tối đa một Application.

Quy tắc này không phụ thuộc:

* Submitted CV được sử dụng;
* trạng thái hiện tại của Application;
* Application đã kết thúc hay chưa;
* nguồn tạo Application hiện tại hoặc tương lai.

### 5.4. Application và Submitted CV Snapshot

```text
Application
   │
   │ 1 — 1 current
   ↓
Submitted CV Snapshot
```

Mỗi Application luôn có một Submitted CV Snapshot hiện tại sau khi được tạo thành công.

Snapshot không phải live view của CandidateCV.

### 5.5. CandidateCV và Submitted CV Snapshot

```text
CandidateCV
   │
   │ capture
   ↓
Submitted CV Snapshot
```

CandidateCV là nguồn để tạo snapshot.

Sau khi snapshot được tạo, hai dữ liệu có lifecycle độc lập.

Một CandidateCV có thể được dùng để Apply nhiều Job khác nhau.

### 5.6. Job và Company

```text
Application
   ↓
Job
   ↓
Company
```

Tenant context của Application được xác định thông qua Company sở hữu Job.

Application không tạo một Company ownership độc lập khỏi Job.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Application states được V9 trực tiếp sử dụng

Các trạng thái:

* `APPLIED`
* `WITHDRAWN`

| Trạng thái  | Ý nghĩa                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `APPLIED`   | Candidate đã ứng tuyển thành công và Application đang ở giai đoạn đầu của quy trình tuyển dụng. |
| `WITHDRAWN` | Candidate đã chủ động rút Application; đây là trạng thái kết thúc đối với Application đó.       |

### 6.2. Trạng thái downstream được V9 nhận biết

`SCREENING` là trạng thái downstream đầu tiên được V9 nhận biết để xác định Candidate không còn quyền Replace hoặc Withdraw.

`REJECTED` là trạng thái kết thúc downstream được V9 nhận biết trong quy tắc không cho Candidate tạo Application mới cho cùng Job.

V9 không triển khai transition sang `SCREENING` hoặc `REJECTED`.

Các trạng thái pipeline khác không thuộc phạm vi chức năng của V9.

### 6.3. CandidateCV states liên quan V9

V9 kế thừa lifecycle CandidateCV của V7.

Để được sử dụng cho Apply hoặc Replace Submitted CV, CandidateCV phải:

* `ACTIVE`;
* chưa bị Archive.

Generated CV ở `DRAFT` không được sử dụng để Apply hoặc Replace Submitted CV.

Visibility `PRIVATE` hoặc `PUBLIC` không ảnh hưởng eligibility của Direct Apply.

---

## 7. Tổ hợp trạng thái hợp lệ

Các tổ hợp sau xác định quyền Candidate đối với một Application:

| Application    | Job còn nhận hồ sơ | Replace Submitted CV | Withdraw        |
| -------------- | ------------------ | -------------------- | --------------- |
| `APPLIED`      | Có                 | Được phép            | Được phép       |
| `APPLIED`      | Không              | Không được phép      | Được phép       |
| Khác `APPLIED` | Có hoặc Không      | Không được phép      | Không được phép |

Trong bảng trên, “Job còn nhận hồ sơ” bao gồm điều kiện Company sở hữu Job vẫn đang hoạt động.

Việc Job không còn nhận hồ sơ không tự động làm Application hiện hữu bị xóa hoặc chuyển thành `WITHDRAWN`.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Candidate đã đăng nhập
  ↓
Candidate mở Job từ Job Discovery
  ↓
Candidate chọn Apply
  ↓
Hệ thống đề xuất Default CV hợp lệ nếu có
  ↓
Candidate:
- giữ Default CV
hoặc
- chọn CandidateCV khác
hoặc
- upload và lưu CandidateCV mới theo V7
  ↓
Candidate xác nhận Apply
  ↓
Kiểm tra Job còn nhận hồ sơ
  ↓
Kiểm tra CandidateCV thuộc Candidate
  ↓
Kiểm tra CandidateCV ACTIVE và chưa Archive
  ↓
Kiểm tra Candidate–Job chưa có Application
  ↓
Tạo Submitted CV Snapshot
  ↓
Tạo Direct Application ở APPLIED
  ↓
Application chờ xử lý ở version sau
```

Trong khi Application còn `APPLIED`:

```text
Nếu Job còn nhận hồ sơ
  ↓
Candidate có thể Replace Submitted CV
```

và:

```text
Application còn APPLIED
  ↓
Candidate có thể Withdraw
  ↓
WITHDRAWN
```

---

# 9. Functional Requirements

## F01 — Direct Apply và tạo Application

### Actor

* Candidate đã đăng nhập.

### Mục tiêu

Cho phép Candidate chủ động ứng tuyển vào một Job còn nhận hồ sơ và tạo Application tương ứng.

### Tiền điều kiện

* actor là Candidate đã authenticated;
* Job tồn tại;
* Job còn nhận hồ sơ;
* Candidate đã chọn một CandidateCV hợp lệ;
* Candidate và Job chưa có Application trước đó.

### Luồng chính

1. Candidate mở Apply flow của Job.
2. Candidate xác nhận CandidateCV muốn sử dụng.
3. Hệ thống xác định Candidate hiện tại từ authenticated identity.
4. Hệ thống kiểm tra Job còn nhận hồ sơ.
5. Hệ thống kiểm tra CandidateCV thuộc Candidate hiện tại.
6. Hệ thống kiểm tra CandidateCV đang `ACTIVE` và chưa Archive.
7. Hệ thống xác nhận Candidate–Job chưa có Application.
8. Hệ thống capture Submitted CV Snapshot.
9. Hệ thống tạo Direct Application.
10. Application bắt đầu tại `APPLIED`.
11. Application bắt đầu chưa có Assigned Recruiter.

### Kết quả

* tồn tại đúng một Application cho Candidate–Job;
* source của Application là `DIRECT_APPLICATION`;
* status là `APPLIED`;
* Application có Submitted CV Snapshot hiện tại;
* Application chưa có Assigned Recruiter;
* Recruitment Team của Job không thay đổi.

### Trường hợp từ chối

Từ chối nếu:

* actor không phải authenticated Candidate;
* Job không tồn tại;
* Job không còn `PUBLISHED`;
* application deadline đã qua;
* Company sở hữu Job không còn hoạt động;
* CandidateCV không thuộc Candidate;
* CandidateCV đang `DRAFT`;
* CandidateCV đã Archive;
* Candidate–Job đã có Application;
* một yêu cầu Apply cạnh tranh khác đã tạo Application cho cùng Candidate–Job trước.

### Business Rules liên quan

* `BR-01` – `BR-08`
* `BR-12` – `BR-24`
* `BR-36`
* `BR-43` – `BR-44`

### Không thuộc chức năng này

* assign Recruiter;
* pipeline processing;
* Notification;
* Job Invitation;
* Chat;
* Interview.

---

## F02 — Lựa chọn Candidate CV để Apply

### Actor

* Candidate đã đăng nhập.

### Mục tiêu

Cho phép Candidate quyết định CV nào của chính mình sẽ được gửi vào Application.

### Tiền điều kiện

* Candidate đang thực hiện Apply flow;
* CandidateCV được sử dụng phải tuân thủ eligibility của V9.

### Luồng chính

1. Nếu Candidate có Default CV hợp lệ, hệ thống đề xuất CV đó.
2. Candidate có thể giữ Default CV.
3. Candidate có thể chọn CandidateCV hợp lệ khác.
4. Candidate có thể upload CV mới.
5. CV upload mới phải được lưu thành CandidateCV hợp lệ trong My CVs theo V7.
6. Candidate xác nhận CandidateCV cuối cùng muốn sử dụng.

### Kết quả

* đúng một CandidateCV hợp lệ được chọn làm nguồn cho Submitted CV Snapshot;
* việc chọn CV không tự động tạo Application cho tới khi Candidate xác nhận Apply.

### Trường hợp từ chối

Không được sử dụng:

* CandidateCV của Candidate khác;
* Generated CV ở `DRAFT`;
* CandidateCV đã Archive;
* CV không còn hợp lệ theo lifecycle V7.

### Business Rules liên quan

* `BR-05` – `BR-11`

### Không thuộc chức năng này

* thay đổi lifecycle CandidateCV của V7;
* tự động Activate Generated Draft;
* temporary CV chỉ dành cho Application;
* Candidate Search eligibility.

---

## F03 — Submitted CV Snapshot

### Actor

* Candidate thông qua Apply hoặc Replace Submitted CV.

### Mục tiêu

Đảm bảo CV đang được gửi vào Application không tự động thay đổi theo CandidateCV đang sống trong My CVs.

### Tiền điều kiện

* có CandidateCV hợp lệ được sử dụng cho Apply hoặc Replace.

### Luồng chính

1. Hệ thống capture nội dung Candidate đang gửi.
2. Với Generated CV, snapshot phản ánh nội dung Generated CV và bản PDF tương ứng tại thời điểm capture.
3. Với Uploaded CV, snapshot phản ánh file PDF được Candidate gửi tại thời điểm capture.
4. Snapshot trở thành Submitted CV hiện tại của Application.
5. Mọi thay đổi sau đó trên CandidateCV gốc không tự động thay đổi snapshot.

### Kết quả

* Application có một Submitted CV Snapshot độc lập với CandidateCV gốc;
* snapshot phản ánh đúng submission hiện tại của Candidate;
* Recruiter-side processing tương lai dựa trên Submitted CV của Application, không dựa trên live CandidateCV.

### Trường hợp từ chối

Không được coi CandidateCV gốc là live Submitted CV của Application.

### Business Rules liên quan

* `BR-22` – `BR-27`

### Không thuộc chức năng này

* snapshot history;
* Job snapshot;
* lịch sử các CandidateCV version.

---

## F04 — Replace Submitted CV

### Actor

* Candidate sở hữu Application.

### Mục tiêu

Cho phép Candidate thay CV đang được nộp cho một Application khi Application vẫn ở giai đoạn `APPLIED` và Job vẫn còn nhận hồ sơ.

### Tiền điều kiện

* Application thuộc Candidate hiện tại;
* Application đang `APPLIED`;
* Job còn nhận hồ sơ;
* Candidate đã chọn CandidateCV mới hợp lệ.

### Luồng chính

1. Candidate chọn Replace Submitted CV.
2. Candidate chọn CandidateCV hợp lệ khác hoặc upload CandidateCV mới theo V7.
3. Hệ thống xác nhận Application vẫn thuộc Candidate.
4. Hệ thống xác nhận Application vẫn `APPLIED`.
5. Hệ thống xác nhận Job vẫn còn nhận hồ sơ.
6. Hệ thống xác nhận CandidateCV mới hợp lệ.
7. Hệ thống capture snapshot mới.
8. Snapshot mới thay thế Submitted CV Snapshot hiện tại.

### Kết quả

* Application vẫn là cùng một Application;
* Submitted CV hiện tại được thay bằng snapshot mới;
* Application vẫn giữ nguyên status;
* Candidate và Job không thay đổi;
* Application source không thay đổi;
* Assigned Recruiter không tự thay đổi;
* snapshot cũ không được giữ như một CV version history.

### Trường hợp từ chối

Từ chối nếu:

* Application không thuộc Candidate;
* Application không còn `APPLIED`;
* Job không còn nhận hồ sơ;
* Company không còn hoạt động;
* CandidateCV mới không hợp lệ;
* CandidateCV mới thuộc Candidate khác;
* một thao tác cạnh tranh đã thay đổi Application khiến request hiện tại trở thành stale.

### Business Rules liên quan

* `BR-05` – `BR-08`
* `BR-23` – `BR-31`
* `BR-36` – `BR-37`
* `BR-39`

### Không thuộc chức năng này

* tạo Application mới;
* lưu snapshot history;
* thay đổi pipeline state;
* tự assign Recruiter.

---

## F05 — Withdraw Application

### Actor

* Candidate sở hữu Application.

### Mục tiêu

Cho phép Candidate chủ động rút hồ sơ ứng tuyển khi Application vẫn đang `APPLIED`.

### Tiền điều kiện

* Application thuộc Candidate hiện tại;
* Application đang `APPLIED`.

Job không bắt buộc phải còn nhận hồ sơ.

### Luồng chính

1. Candidate chọn Withdraw Application.
2. Candidate xác nhận việc Withdraw.
3. Candidate có thể cung cấp lý do rút hồ sơ nhưng không bắt buộc.
4. Hệ thống xác nhận Application thuộc Candidate.
5. Hệ thống xác nhận Application vẫn đang `APPLIED`.
6. Application chuyển sang `WITHDRAWN`.

### Kết quả

* Application trở thành `WITHDRAWN`;
* Application không bị xóa;
* Submitted CV Snapshot không bị xóa;
* quan hệ Candidate–Application–Job được giữ;
* Candidate không được tiếp tục Replace Submitted CV;
* Candidate không được Withdraw lần nữa;
* Candidate không được tạo Application mới cho cùng Job trong MVP.

### Trường hợp từ chối

Từ chối nếu:

* Application không thuộc Candidate;
* Application không còn `APPLIED`;
* một thao tác cạnh tranh đã thay đổi Application trước.

### Business Rules liên quan

* `BR-03`
* `BR-12` – `BR-16`
* `BR-32` – `BR-39`
* `BR-42`

### Không thuộc chức năng này

* xóa Application;
* xóa Submitted CV Snapshot;
* tự động tạo Application mới;
* reapply cùng Job;
* Notification;
* Conversation handling.

---

# 10. Business Rules

## BR-01 — Chỉ authenticated Candidate được Direct Apply

Chỉ User đã đăng nhập với vai trò Candidate được tạo Direct Application.

Guest và các role khác không được Direct Apply thay Candidate.

---

## BR-02 — Candidate identity phải là authenticated identity

Candidate thực hiện Apply phải được xác định từ identity đã authenticated.

Candidate không được chọn hoặc khai báo tùy ý Candidate khác làm chủ Application.

---

## BR-03 — Candidate chỉ thao tác Application của chính mình

Candidate không được Replace hoặc Withdraw Application thuộc Candidate khác.

---

## BR-04 — Job phải còn nhận hồ sơ tại thời điểm Apply

Direct Apply chỉ được phép khi đồng thời:

* Job tồn tại;
* Job đang `PUBLISHED`;
* application deadline chưa qua;
* Company sở hữu Job đang hoạt động.

---

## BR-05 — Candidate chỉ được sử dụng CandidateCV của chính mình

CandidateCV dùng cho Apply hoặc Replace phải thuộc Candidate hiện tại.

---

## BR-06 — CandidateCV phải ACTIVE

CandidateCV dùng cho Apply hoặc Replace phải đang `ACTIVE`.

Generated CV ở `DRAFT` không được sử dụng để Apply hoặc Replace.

---

## BR-07 — CandidateCV đã Archive không được sử dụng cho submission mới

CandidateCV đã Archive không được:

* dùng cho Direct Apply mới;
* dùng làm CV mới trong Replace Submitted CV.

---

## BR-08 — Visibility không chặn Direct Apply

CandidateCV `PRIVATE` và `PUBLIC` đều có thể được sử dụng cho Direct Apply nếu thỏa các điều kiện eligibility khác.

`PRIVATE` không có nghĩa Candidate bị cấm chủ động gửi CV cho một Job.

---

## BR-09 — Upload trong Apply flow phải tạo CandidateCV thực sự

CV được upload trong Apply flow phải được lưu thành CandidateCV hợp lệ trong My CVs theo nghiệp vụ V7 trước khi được sử dụng để Apply.

V9 không có temporary application-only CV.

---

## BR-10 — Default CV chỉ là preselection

Nếu Candidate có Default CV hợp lệ, hệ thống có thể chọn sẵn CV đó trong Apply flow.

Default không tự động tạo Application và không bắt buộc Candidate phải sử dụng CV đó.

---

## BR-11 — Candidate được thay Default bằng CV khác

Candidate có thể:

* giữ Default CV;
* chọn CandidateCV khác;
* upload CandidateCV mới;

trước khi xác nhận Apply.

Nếu không có Default CV hợp lệ, Candidate phải tự chọn hoặc upload CV.

---

## BR-12 — Candidate–Job có tối đa một Application

Một Candidate và một Job có tối đa một Application trong toàn bộ vòng đời.

---

## BR-13 — Uniqueness không phụ thuộc CV

Candidate không được tạo Application thứ hai cho cùng Job chỉ vì sử dụng CandidateCV khác.

---

## BR-14 — Uniqueness không phụ thuộc Application state

Application cũ đã chuyển trạng thái hoặc đã kết thúc không làm Candidate có quyền tạo Application mới cho cùng Job.

---

## BR-15 — Không Apply lại sau WITHDRAWN hoặc REJECTED trong MVP

Candidate không được Direct Apply lại cùng Job sau khi Application trước đó đã `WITHDRAWN` hoặc `REJECTED`.

---

## BR-16 — Uniqueness áp dụng xuyên nguồn Application

Quy tắc Candidate–Job tối đa một Application phải tiếp tục đúng khi các nguồn Application khác được bổ sung trong tương lai.

Nguồn Application không tạo exception cho uniqueness.

---

## BR-17 — Concurrent Apply chỉ được tạo tối đa một Application

Nhiều yêu cầu Apply cạnh tranh cho cùng Candidate–Job không được tạo nhiều Application.

Chỉ một kết quả tạo Application được phép thành công.

---

## BR-18 — Direct Application bắt đầu tại APPLIED

Application nguồn `DIRECT_APPLICATION` bắt đầu tại trạng thái `APPLIED`.

---

## BR-19 — Direct Application bắt đầu chưa có Assigned Recruiter

Direct Application không tự động được assign cho:

* Primary Recruiter;
* Supporting Recruiter;
* người tạo Job;
* bất kỳ Recruiter nào khác.

---

## BR-20 — Direct Application không có Source Recruiter hoặc Source Invitation

Application được tạo bởi Direct Apply không phát sinh Source Recruiter hoặc Source Invitation.

---

## BR-21 — Apply không thay đổi Recruitment Team

Tạo Direct Application không thay đổi:

* Primary Recruiter của Job;
* Supporting Recruiter của Job;
* Recruitment Team membership.

---

## BR-22 — Apply phải tạo Submitted CV Snapshot

Mọi Direct Application được tạo thành công phải có Submitted CV Snapshot.

---

## BR-23 — CandidateCV và Submitted CV Snapshot là hai dữ liệu nghiệp vụ độc lập

Sau khi snapshot được capture, CandidateCV gốc không còn là live content của Application.

---

## BR-24 — Snapshot phải giữ integrity của submission hiện tại

Các thay đổi sau trên CandidateCV gốc không được tự động thay đổi Submitted CV Snapshot hiện tại:

* sửa Generated CV;
* rename CV;
* đổi metadata;
* đổi visibility;
* thay Uploaded PDF;
* Archive CV;
* đổi Default CV;
* thay Candidate Profile.

---

## BR-25 — Generated CV snapshot phản ánh nội dung và PDF tại thời điểm capture

Khi Candidate sử dụng Generated CV, snapshot phải phản ánh:

* nội dung Generated CV đang được Candidate gửi;
* bản PDF tương ứng tại thời điểm capture.

Việc Generated CV gốc thay đổi sau đó không được tự động thay đổi snapshot.

---

## BR-26 — Uploaded CV snapshot phản ánh PDF tại thời điểm capture

Khi Candidate sử dụng Uploaded CV, snapshot phải phản ánh file PDF được Candidate gửi tại thời điểm capture.

Việc Candidate thay file của CandidateCV gốc sau đó không được thay file trong Application.

---

## BR-27 — Mỗi Application chỉ giữ một Submitted CV Snapshot hiện tại

V9 chỉ duy trì một Submitted CV Snapshot hiện tại cho mỗi Application.

V9 không lưu danh sách lịch sử các snapshot cũ.

---

## BR-28 — Replace chỉ được thực hiện khi Application còn APPLIED

Candidate chỉ được Replace Submitted CV khi Application hiện tại vẫn ở `APPLIED`.

---

## BR-29 — Replace yêu cầu Job vẫn còn nhận hồ sơ

Replace Submitted CV chỉ được phép khi Job vẫn:

* tồn tại;
* `PUBLISHED`;
* chưa qua application deadline;
* thuộc Company đang hoạt động.

---

## BR-30 — Replace sử dụng cùng CV eligibility với Apply

CandidateCV mới dùng cho Replace phải:

* thuộc Candidate;
* `ACTIVE`;
* chưa Archive.

Visibility `PRIVATE` hoặc `PUBLIC` đều hợp lệ.

---

## BR-31 — Replace thay current submission, không thay Application identity

Replace Submitted CV:

* không tạo Application mới;
* không đổi Candidate;
* không đổi Job;
* không đổi source;
* không đổi Application status;
* không tự assign Recruiter.

Snapshot mới trở thành current Submitted CV Snapshot.

---

## BR-32 — Candidate chỉ được Withdraw khi Application còn APPLIED

Withdraw chỉ hợp lệ khi Application thuộc Candidate hiện tại và đang `APPLIED`.

---

## BR-33 — Withdraw không yêu cầu Job còn nhận hồ sơ

Nếu Application vẫn `APPLIED`, Candidate vẫn được Withdraw khi:

* Job đã `CLOSED`;
* Job đã hết hạn;
* Job không còn nhận Application mới;
* Company không còn ở trạng thái cho phép nhận submission mới.

---

## BR-34 — WITHDRAWN là trạng thái kết thúc

Sau khi Application trở thành `WITHDRAWN`:

* Candidate không được Replace Submitted CV;
* Candidate không được Withdraw lần nữa;
* Application không tiếp tục Candidate-side flow của V9;
* Candidate không được tạo Application mới cho cùng Job trong MVP.

---

## BR-35 — Withdraw không xóa Application hoặc Submitted CV

Withdraw chỉ kết thúc Application.

Application, Candidate relationship, Job relationship và Submitted CV Snapshot được giữ.

---

## BR-36 — Candidate action phải dựa trên state hiện tại

Việc frontend đang hiển thị một Application là `APPLIED` không đủ để cho phép Replace hoặc Withdraw.

Quyền thực hiện thao tác phải dựa trên state hiện tại của Application tại thời điểm thao tác được xử lý.

---

## BR-37 — Race giữa Replace và SCREENING chỉ cho phép kết quả tuần tự hợp lệ

Nếu Application chuyển khỏi `APPLIED` trước khi Replace thành công, Replace phải thất bại.

Nếu Replace thành công trước, Submitted CV mới trở thành current snapshot trước khi downstream processing tiếp tục.

Thao tác downstream không được ghi đè làm mất một Replace đã thành công.

---

## BR-38 — Race giữa Withdraw và SCREENING chỉ cho phép một transition thắng

Nếu Withdraw thành công trước:

`APPLIED → WITHDRAWN`

thì transition downstream dựa trên `APPLIED` phải thất bại.

Nếu Application rời `APPLIED` trước thì Withdraw phải thất bại.

Application không được vừa `WITHDRAWN` vừa tiếp tục pipeline từ cùng một trạng thái ban đầu.

---

## BR-39 — Race giữa Replace và Withdraw không được ghi đè stale state

Hai thao tác Replace và Withdraw xuất phát từ cùng một trạng thái Application quan sát được chỉ được một thao tác cạnh tranh thành công.

Nếu Replace thành công trước, request Withdraw cũ dựa trên trạng thái trước Replace không được tiếp tục như chưa có Replace.

Candidate có thể thực hiện thao tác mới sau khi nhận state mới nhất nếu Application vẫn đủ điều kiện.

---

## BR-40 — Kế thừa hard-delete boundary của V5

V9 không thay đổi quyền hard-delete Job.

Job chỉ được hard-delete theo lifecycle contract V5, tức khi còn `DRAFT` hoặc
`PENDING_APPROVAL`.

Direct Application chỉ được tạo cho Job `PUBLISHED`, do đó Application không
thể tồn tại trên Job đang còn eligible cho hard-delete.

---

## BR-41 — Application không bổ sung Job deletion behavior

V9 không thêm:

* Application-existence deletion guard;
* cascade delete Application;
* Job snapshot phục vụ hard-delete;
* Job soft-delete behavior.

Job deletion tiếp tục hoàn toàn theo canonical V5.

---

## BR-42 — Close hoặc Expire không xóa Application hiện hữu

Job chuyển sang `CLOSED` hoặc hết hạn không làm Application hiện hữu bị xóa.

Nếu Application vẫn `APPLIED`:

* Candidate không được Replace vì Job không còn nhận hồ sơ;
* Candidate vẫn được Withdraw.

---

## BR-43 — Application thuộc recruitment context của Company sở hữu Job

Application của một Job thuộc recruitment context của đúng Company sở hữu Job đó.

Company khác không được coi Application đó là resource của tenant mình.

---

## BR-44 — Job Primary Recruiter và Application Assigned Recruiter là hai khái niệm độc lập

Việc Job có Primary Recruiter không có nghĩa Direct Application mới tự động có Assigned Recruiter.

---

# 11. State Transitions

| Hành động               | Trước                                      | Sau         | Actor     |
| ----------------------- | ------------------------------------------ | ----------- | --------- |
| Direct Apply thành công | Chưa tồn tại Application cho Candidate–Job | `APPLIED`   | Candidate |
| Withdraw Application    | `APPLIED`                                  | `WITHDRAWN` | Candidate |

V9 không trực tiếp triển khai transition:

```text
APPLIED → SCREENING
```

hoặc các transition downstream khác.

V9 chỉ yêu cầu Candidate-side actions phải tôn trọng Application state hiện tại nếu những transition downstream đó đã xảy ra.

Không tồn tại transition trong V9:

```text
WITHDRAWN → APPLIED
```

Không tồn tại reapply transition tạo Application mới cho cùng Candidate–Job trong MVP.

Chỉ các transition được định nghĩa trong tài liệu này mới thuộc business contract trực tiếp của V9.

---

# 12. Authorization và ownership boundary

| Hành động                           | Actor được phép                    | Resource / Scope                | Điều kiện                         |
| ----------------------------------- | ---------------------------------- | ------------------------------- | --------------------------------- |
| Direct Apply                        | Authenticated Candidate            | Job được phép nhận Application  | Candidate thao tác cho chính mình |
| Chọn CandidateCV                    | Authenticated Candidate            | CandidateCV của chính Candidate | CV `ACTIVE`, chưa Archive         |
| Upload CV trong Apply flow          | Authenticated Candidate            | My CVs của chính Candidate      | Tuân thủ nghiệp vụ V7             |
| Replace Submitted CV                | Candidate sở hữu Application       | Application của chính Candidate | `APPLIED` và Job còn nhận hồ sơ   |
| Withdraw                            | Candidate sở hữu Application       | Application của chính Candidate | `APPLIED`                         |
| Hard-delete Job                     | Actor được V5 cho phép             | Job thuộc Company tương ứng     | Chỉ theo lifecycle contract V5    |

Guest không được:

* Direct Apply;
* Replace Submitted CV;
* Withdraw Application.

Candidate không được:

* Apply thay Candidate khác;
* sử dụng CandidateCV của Candidate khác;
* Replace Application của Candidate khác;
* Withdraw Application của Candidate khác.

Recruiter và Company Manager không được coi là Candidate chỉ vì có quyền đối với Job hoặc Company.

Quyền Candidate phải được xác định từ authenticated identity.

Dữ liệu định danh owner do client cung cấp không tạo ra quyền thao tác.

---

# 13. Multi-tenant boundary

Company tiếp tục là tenant nghiệp vụ.

Tenant context của Application được xác định theo:

```text
Application
  ↓
Job
  ↓
Company sở hữu Job
```

Candidate không cần là Company Member để Direct Apply.

Khi Candidate Apply vào Job của Company A:

```text
Application
→ thuộc recruitment context của Company A
```

Application không đồng thời trở thành resource của Company B.

V9 không cho phép:

* Company khác coi Application của Job Company A là resource của mình;
* client tự khai báo một Company khác để thay đổi tenant context của Application;
* việc chọn Company từ client làm thay đổi Company sở hữu Application.

V9 chưa định nghĩa chi tiết:

* Company Manager có quyền xem Application nào;
* Primary Recruiter có quyền xem Application nào;
* Supporting Recruiter có quyền xem Application nào;
* Assigned Recruiter có quyền xử lý Application như thế nào.

Các authorization rule Company-side đó thuộc version xử lý Application sau V9.

V9 chỉ khóa tenant ownership invariant:

> Application luôn thuộc recruitment context của Company sở hữu Job.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng sau mọi thao tác hợp lệ của V9:

1. Chỉ authenticated Candidate được tạo Direct Application.

2. Candidate chỉ được sử dụng CandidateCV thuộc chính mình.

3. Candidate chỉ được Replace hoặc Withdraw Application thuộc chính mình.

4. Direct Apply chỉ thành công khi Job còn nhận hồ sơ.

5. Job còn nhận hồ sơ yêu cầu Job `PUBLISHED`, chưa qua deadline và Company sở hữu Job đang hoạt động.

6. CandidateCV dùng cho Apply hoặc Replace phải `ACTIVE` và chưa Archive.

7. Generated CV `DRAFT` không được dùng cho Apply hoặc Replace.

8. `PRIVATE` không làm CandidateCV mất eligibility đối với Direct Apply.

9. Upload CV trong Apply flow phải tạo CandidateCV hợp lệ trong My CVs trước khi dùng.

10. Default CV chỉ là lựa chọn đề xuất, không phải CV bắt buộc.

11. Một Candidate và một Job có tối đa một Application trong toàn bộ vòng đời.

12. Concurrent Apply không được tạo nhiều Application cho cùng Candidate–Job.

13. Direct Application bắt đầu tại `APPLIED`.

14. Direct Application bắt đầu chưa có Assigned Recruiter.

15. Tạo Direct Application không thay đổi Recruitment Team.

16. Mọi Direct Application phải có Submitted CV Snapshot.

17. CandidateCV và Submitted CV Snapshot có lifecycle độc lập.

18. Thay đổi CandidateCV gốc không tự động thay đổi Submitted CV của Application.

19. Archive CandidateCV gốc không xóa Submitted CV của Application.

20. Mỗi Application chỉ có một Submitted CV Snapshot hiện tại trong V9.

21. Replace chỉ được thực hiện khi Application còn `APPLIED`.

22. Replace chỉ được thực hiện khi Job còn nhận hồ sơ.

23. Replace không tạo Application mới.

24. Replace không đổi Candidate, Job, source hoặc Application status.

25. Withdraw chỉ được thực hiện khi Application còn `APPLIED`.

26. Withdraw không phụ thuộc Job còn nhận hồ sơ.

27. `WITHDRAWN` là trạng thái kết thúc.

28. Withdraw không xóa Application.

29. Withdraw không xóa Submitted CV Snapshot.

30. Candidate không được Apply lại cùng Job sau `WITHDRAWN` hoặc `REJECTED` trong MVP.

31. Các thao tác cạnh tranh không được ghi đè một thao tác đã thành công dựa trên stale Application state.

32. V9 không thay đổi hard-delete boundary của V5; Direct Application chỉ được
    tạo cho Job đã ở `PUBLISHED`, ngoài các hard-delete states.

33. Job `CLOSED` hoặc hết hạn không làm Application hiện hữu bị xóa.

34. Job Primary Recruiter và Application Assigned Recruiter luôn là hai trách nhiệm nghiệp vụ khác nhau.

35. Application luôn thuộc recruitment context của Company sở hữu Job.

Các invariant trên áp dụng cho cả happy path và các trường hợp cạnh tranh.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V9.

### 15.1. Application processing

Defer:

* assign;
* reassign;
* take over;
* Primary Recruiter phân phối Application;
* Supporting Recruiter xử lý Application;
* Recruiter workspace;
* pipeline sau `APPLIED`;
* `APPLIED → SCREENING`;
* các downstream status transition;
* status history;
* assignment history.

### 15.2. My Applications

Defer:

* danh sách toàn bộ Application của Candidate;
* filter theo status;
* search theo Job hoặc Company;
* Application timeline;
* Application detail hoàn chỉnh;
* hiển thị Recruiter phụ trách;
* hiển thị Interview.

### 15.3. Job Invitation

Defer:

* Candidate Search;
* Job Invitation;
* Invitation lifecycle;
* Invitation snapshot;
* Accept Invitation;
* Reject Invitation;
* Revoke hoặc Invalidate Invitation;
* Application nguồn `RECRUITER_INVITATION`;
* Source Recruiter;
* tự assign sender khi Invitation được Accept.

Quy tắc Candidate–Job tối đa một Application vẫn phải được giữ khi module này được triển khai.

### 15.4. Communication và Interview

Defer:

* Conversation;
* Message;
* Chat;
* realtime;
* Candidate Availability;
* Interview Schedule;
* Conversation read-only behavior.

### 15.5. Notification

Defer:

* Candidate Apply success notification;
* New Application notification;
* Replace notification;
* Withdraw notification;
* realtime notification.

### 15.6. Snapshot enhancements

Defer:

* Submitted CV snapshot history;
* CV version history trong Application;
* restore snapshot cũ;
* audit danh sách mọi CV từng được Candidate submit cho cùng Application;
* Job snapshot.

V9 chỉ giữ current Submitted CV Snapshot.

### 15.7. Reapply

Defer:

* Apply lại sau `WITHDRAWN`;
* Apply lại sau `REJECTED`;
* tạo Application thứ hai cho cùng Candidate–Job;
* business rules cho reapplication.

### 15.8. Company-side Application authorization

Defer exact permission matrix cho:

* Company Manager;
* Primary Recruiter;
* Supporting Recruiter;
* Assigned Recruiter.

V9 chỉ xác định tenant ownership context, không định nghĩa Application processing authorization chi tiết.

Không được tự implement các nội dung defer trong V9.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V9.

Các quyết định business đã chốt bao gồm:

* CandidateCV dùng cho Apply/Replace phải `ACTIVE` và chưa Archive;
* Company sở hữu Job phải còn hoạt động để Job tiếp tục nhận Apply hoặc Replace;
* V9 kế thừa hard-delete boundary của V5 và không bổ sung deletion behavior;
* Submitted CV Snapshot là current submitted copy của Application;
* Apply tạo snapshot đầu tiên;
* Replace tạo snapshot mới và thay current snapshot;
* V9 không giữ snapshot history.

---

# 17. Definition of Business Completion

V9 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Direct Apply và tạo Application đã được đáp ứng;
* `F02` — lựa chọn Candidate CV để Apply đã được đáp ứng;
* `F03` — Submitted CV Snapshot đã được đáp ứng;
* `F04` — Replace Submitted CV đã được đáp ứng;
* `F05` — Withdraw Application đã được đáp ứng;
* toàn bộ `BR-01` – `BR-44` được giữ;
* Candidate–Job uniqueness luôn đúng;
* Direct Application luôn bắt đầu `APPLIED` và unassigned;
* CV eligibility luôn đúng;
* Job acceptance eligibility luôn đúng;
* Submitted CV độc lập với CandidateCV gốc;
* Replace chỉ hoạt động trong boundary đã định nghĩa;
* Withdraw chỉ hoạt động trong boundary đã định nghĩa;
* concurrency không tạo stale overwrite hoặc transition mâu thuẫn;
* hard-delete boundary của V5 được giữ nguyên, không có Application-based guard;
* authorization và ownership boundary được giữ;
* tenant boundary được giữ;
* các lifecycle invariant luôn đúng;
* các chức năng đã defer không bị implementation ngoài ý muốn;
* không xuất hiện behavior ngoài boundary của V9.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V9.

Tài liệu này định nghĩa:

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
* schema persistence;
* embedded hay referenced representation;
* index;
* optimistic locking implementation;
* transaction implementation;
* file storage implementation;
* source-code structure;
* test framework.

Các quyết định persistence và kỹ thuật phải được xây dựng từ business contract này.

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
        │ architecture truth
        ↓
Implementation
```

Nếu implementation, database design hoặc entity diagram mâu thuẫn với tài liệu này, **Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
