# V5 — Job và vòng đời phê duyệt Job

> **File:** `docs/product/versions/v5-job-approval-lifecycle.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V5 — Job và vòng đời phê duyệt Job.

---

## 1. Mục tiêu

V5 bổ sung khái niệm **Job tuyển dụng thuộc Company** và xác định vòng đời nghiệp vụ của Job từ khi được Recruiter tạo cho đến khi được Company Manager xét duyệt, công khai và kết thúc.

Sau khi V5 hoàn thành, hệ thống phải xác định và thực hiện được:

* Recruiter tạo Job dưới dạng `DRAFT`;
* Recruiter hoàn thiện Job trước khi gửi duyệt;
* Primary Recruiter gửi Job cho Company Manager xét duyệt;
* Company Manager approve hoặc reject Job;
* approve đồng thời làm Job được publish;
* Job đã publish có thể được đóng thủ công hoặc tự hết hạn;
* Company Manager có thể thay Primary Recruiter của Job đang `PUBLISHED`;
* hệ thống xác định chính xác Job nào còn là cơ hội tuyển dụng công khai;
* Job đã từng được publish được giữ lại làm dữ liệu lịch sử của Company;
* mọi thao tác Job phải tuân thủ Company ownership và tenant isolation.

V5 chỉ thiết lập **Job lifecycle và approval lifecycle**.

V5 không triển khai toàn bộ Job Discovery, Application hoặc quy trình tuyển dụng Candidate.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V5 bao gồm:

* tạo Job bởi Recruiter;
* lưu Job chưa hoàn thiện ở trạng thái `DRAFT`;
* chỉnh sửa Job trong `DRAFT`;
* xác định nội dung bắt buộc trước khi gửi duyệt;
* sử dụng các dữ liệu chuẩn của nền tảng cho Job;
* phân biệt người tạo Job và Primary Recruiter hiện tại;
* gửi Job từ `DRAFT` sang `PENDING_APPROVAL`;
* khóa nội dung Job trong quá trình xét duyệt;
* Company Manager xem và xét duyệt Job;
* approve Job và publish ngay lập tức;
* reject Job đang chờ duyệt;
* tính bất biến của nội dung Job sau publish;
* thay Primary Recruiter khi Job đang `PUBLISHED`;
* đóng Job thủ công;
* xác định Job hết hạn theo hạn nhận hồ sơ;
* xác định điều kiện Job còn được coi là cơ hội tuyển dụng công khai;
* quyền xem Job nội bộ của Recruiter và Company Manager;
* xóa hoàn toàn Job chưa từng được publish trong các trường hợp được phép;
* bảo toàn Job đã từng được publish;
* authorization theo Company;
* multi-tenant isolation giữa các Company;
* ràng buộc giữa lifecycle Job và việc khóa/chấm dứt Recruiter đang còn trách nhiệm trên Job.

### 2.2. Ngoài phạm vi

V5 không bao gồm:

* Supporting Recruiter;
* team nhiều Recruiter trên một Job;
* tự động chuyển Primary cũ thành Supporting Recruiter;
* Application;
* tạo Application khi Candidate apply;
* CV snapshot;
* Job snapshot trong Application;
* assign hoặc reassign Application;
* recruitment pipeline;
* Candidate Search;
* Job Invitation;
* Chat;
* Interview Schedule;
* Saved Jobs;
* Job recommendation;
* Job Discovery hoàn chỉnh;
* search/filter/sort Job cho Candidate;
* gia hạn Job;
* mở lại Job đã `CLOSED`;
* mở lại Job đã `EXPIRED`;
* chỉnh sửa nội dung Job sau publish;
* gửi lại Job đã bị reject;
* tạo catalog riêng cho từng Company.

V5 chỉ định nghĩa **điều kiện business để một Job được coi là công khai và còn hiệu lực**. Các version Job Discovery hoặc Application sau phải sử dụng invariant này.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V5 sử dụng các khái niệm đã tồn tại từ các version trước:

* V1 — `User` và authentication lifecycle;
* V2 — `Company` và Company onboarding;
* V2 — Company activation/status;
* V3 — `CompanyMember`;
* V3 — Company Manager;
* V3 — Recruiter;
* V3 — Recruiter lifecycle;
* V4 — Category;
* V4 — Location;
* V4 — Employment Type;
* V4 — Work Mode;
* V4 — Experience.

V5 không thay đổi bản chất của:

* User identity;
* authentication;
* Company ownership;
* Company onboarding;
* Company Manager;
* Recruiter;
* nguyên tắc Recruiter thuộc Company;
* quyền Platform Admin quản lý catalog chuẩn.

V5 bổ sung Job như một tài nguyên tuyển dụng mới thuộc Company.

Nếu một Recruiter đang chịu trách nhiệm trên Job chưa kết thúc, lifecycle Recruiter phải tiếp tục bảo toàn trách nhiệm đó theo các rule của V5 trước khi Recruiter có thể bị khóa hoặc chấm dứt.

V5 không được làm thay đổi các invariant đã chốt của version trước, ngoại trừ những ràng buộc mới phát sinh trực tiếp do Recruiter trở thành Primary Recruiter của Job.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Job

Job là một cơ hội tuyển dụng thuộc một Company.

Job không thuộc sở hữu cá nhân của Recruiter tạo Job.

Job có lifecycle riêng từ `DRAFT` đến khi được publish và kết thúc.

### 4.2. Recruiter

Recruiter là Company Member có vai trò tuyển dụng.

Chỉ Recruiter được tạo Job.

Recruiter tạo Job trở thành:

* người tạo Job;
* Primary Recruiter ban đầu của Job.

Recruiter không được:

* tự approve Job;
* tự publish Job;
* chỉnh sửa Job sau khi đã submit;
* thay Primary Recruiter;
* hard-delete Job sau khi Job đã rời `DRAFT`;
* tạo catalog riêng trong quá trình tạo Job.

Current Primary Recruiter được hard-delete Job mình phụ trách khi Job vẫn đang
ở `DRAFT`.

### 4.3. Primary Recruiter

Primary Recruiter là Recruiter đang chịu trách nhiệm chính đối với một Job.

Mỗi Job có đúng một Primary Recruiter.

Primary Recruiter không phải role cố định của tài khoản mà là trách nhiệm trên từng Job.

### 4.4. Người tạo Job

Người tạo Job là Recruiter thực hiện hành vi tạo Job ban đầu.

Đây là thông tin lịch sử.

Người tạo Job và Primary Recruiter hiện tại là hai khái niệm độc lập.

Sau khi Primary Recruiter được thay đổi:

```text
Người tạo Job
≠
Primary Recruiter hiện tại
```

có thể trở thành một trạng thái hợp lệ.

### 4.5. Company Manager

Company Manager là actor có authority xét duyệt Job của Company mình.

Company Manager được:

* xem các Job thuộc Company mình từ `PENDING_APPROVAL` trở đi;
* xem nội dung Job trong phạm vi được phép xem;
* xem người tạo Job;
* xem Primary Recruiter hiện tại;
* approve Job;
* reject Job `PENDING_APPROVAL`;
* hard-delete Job `PENDING_APPROVAL` khi business rule cho phép;
* thay Primary Recruiter khi Job đang `PUBLISHED`;
* đóng Job đang `PUBLISHED`;
* xóa hoàn toàn Job chưa từng được publish khi business rule cho phép.

Company Manager không được xem Job `DRAFT`.

Company Manager không được xem hoặc hard-delete Job `DRAFT`.

Company Manager không được chỉnh sửa nội dung tuyển dụng thay Recruiter.

### 4.6. Platform Admin

Platform Admin không trực tiếp tham gia lifecycle Job.

Platform Admin không:

* tạo Job cho Company;
* approve Job thay Company Manager;
* publish Job;
* đóng Job trong hoạt động tuyển dụng thông thường.

Platform Admin tiếp tục quản lý dữ liệu chuẩn của nền tảng theo các version trước.

### 4.7. Candidate

Candidate không tham gia lifecycle xét duyệt Job.

V5 chỉ xác định điều kiện business để một Job có thể được coi là cơ hội tuyển dụng công khai đối với Candidate.

Job Discovery và Application không thuộc V5.

---

## 5. Quan hệ nghiệp vụ chính

### 5.1. Company — Job

```text
Company
   │
   │ 1 — N
   ↓
 Job
```

Một Company có thể có nhiều Job.

Mỗi Job thuộc đúng một Company.

Company ownership của Job không thay đổi trong lifecycle.

### 5.2. Recruiter — Job

Khi tạo Job:

```text
Recruiter tạo Job
      │
      ├── trở thành người tạo Job
      │
      └── trở thành Primary Recruiter ban đầu
```

Người tạo Job được giữ như thông tin lịch sử.

Primary Recruiter thể hiện trách nhiệm vận hành hiện tại.

### 5.3. Job — Primary Recruiter

```text
Job
 │
 │ exactly 1
 ↓
Primary Recruiter
```

Primary Recruiter phải:

* là Recruiter hợp lệ;
* thuộc cùng Company với Job;
* còn đủ điều kiện hoạt động khi thực hiện các nghiệp vụ yêu cầu Primary hợp lệ.

### 5.4. Job — Catalog chuẩn

Job sử dụng dữ liệu chuẩn của nền tảng:

* Category;
* Location;
* Employment Type;
* Work Mode;
* Experience.

Job không tạo catalog riêng cho Company và không thay đổi semantics của các catalog đã được xác định ở V4.

Phần này chỉ mô tả quan hệ nghiệp vụ.

Không quy định cách lưu trữ hoặc biểu diễn persistence.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Job lifecycle

Các trạng thái Job trong V5:

* `DRAFT`
* `PENDING_APPROVAL`
* `PUBLISHED`
* `CLOSED`
* `EXPIRED`

| Trạng thái         | Ý nghĩa                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| `DRAFT`            | Job đang được Primary Recruiter chuẩn bị và có thể chưa hoàn thiện đầy đủ              |
| `PENDING_APPROVAL` | Job đã được Primary Recruiter gửi cho Company Manager xét duyệt và nội dung đã bị khóa |
| `PUBLISHED`        | Job đã được Company Manager approve và trở thành Job công khai của Company             |
| `CLOSED`           | Job đã được đóng thủ công trước hoặc trong thời gian tuyển dụng                        |
| `EXPIRED`          | Job đã kết thúc do đạt hạn nhận hồ sơ                                                  |

### 6.2. Các khái niệm không phải trạng thái

V5 không có persisted state:

* `REJECTED`
* `CHANGES_REQUESTED`
* `DELETED`

Reject làm Job bị xóa hoàn toàn.

Delete biểu diễn việc Job không còn tồn tại, không phải một state của Job.

---

## 7. Tổ hợp trạng thái hợp lệ

V5 chỉ có một state dimension chính đối với Job.

> Version này không có state combination cần định nghĩa riêng.

Các quyền và eligibility có thể phụ thuộc thêm vào:

* Company;
* current Primary Recruiter;
* thời điểm hiện tại;
* hạn nhận hồ sơ;

nhưng các yếu tố đó không tạo thêm state dimension độc lập cho Job trong Product Specification.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Recruiter tạo Job
        ↓
      DRAFT
        │
        │ hoàn thiện nội dung
        │
        │ Primary submit
        ↓
PENDING_APPROVAL
        │
        ├── CM reject
        │       ↓
        │   Job bị xóa
        │
        └── CM approve
                ↓
            PUBLISHED
                │
                ├── Primary / CM đóng
                │       ↓
                │     CLOSED
                │
                └── đạt deadline
                        ↓
                      EXPIRED
```

Sau khi Job đã chuyển sang `PUBLISHED`:

* nội dung tuyển dụng không được chỉnh sửa;
* Job không được hard-delete;
* Job được giữ lại làm dữ liệu lịch sử;
* Primary Recruiter có thể được Company Manager thay đổi;
* Job có thể kết thúc bằng `CLOSED` hoặc `EXPIRED`.

Không có lifecycle:

```text
PENDING_APPROVAL → CHANGES_REQUESTED
```

Không có:

```text
REJECTED → DRAFT
```

Không có:

```text
CLOSED → PUBLISHED
```

Không có:

```text
EXPIRED → PUBLISHED
```

---

# 9. Functional Requirements

## F01 — Recruiter tạo Job Draft

### Actor

* Recruiter

### Mục tiêu

Recruiter tạo một Job tuyển dụng mới cho Company mà mình thuộc.

### Tiền điều kiện

* actor là Recruiter hợp lệ của một Company;
* Company của Recruiter là Company sở hữu Job.

### Luồng chính

1. Recruiter bắt đầu tạo Job.
2. Hệ thống xác định Company từ membership hợp lệ của Recruiter.
3. Job được tạo ở trạng thái `DRAFT`.
4. Recruiter tạo Job trở thành người tạo Job.
5. Recruiter tạo Job đồng thời trở thành Primary Recruiter ban đầu.
6. Job có thể được lưu khi chưa hoàn thiện toàn bộ nội dung bắt buộc cho bước submit.

### Kết quả

* Job tồn tại ở `DRAFT`;
* Job thuộc đúng một Company;
* người tạo Job đã được xác lập;
* Primary Recruiter ban đầu đã được xác lập.

### Trường hợp từ chối

* actor không phải Recruiter hợp lệ;
* actor cố tạo Job cho Company khác;
* không xác định được Company hợp lệ của Recruiter.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-04`
* `BR-05`
* `BR-06`
* `BR-08`
* `BR-38`

### Không thuộc chức năng này

* submit Job;
* approve;
* publish;
* Application.

---

## F02 — Primary Recruiter chỉnh sửa Job Draft

### Actor

* Primary Recruiter

### Mục tiêu

Primary Recruiter hoàn thiện nội dung Job trước khi gửi Company Manager xét duyệt.

### Tiền điều kiện

* Job đang ở `DRAFT`;
* actor là current Primary Recruiter của Job;
* actor thuộc cùng Company với Job.

### Luồng chính

1. Primary Recruiter mở Job `DRAFT`.
2. Primary Recruiter bổ sung hoặc chỉnh sửa nội dung tuyển dụng.
3. Job tiếp tục ở trạng thái `DRAFT` cho đến khi được submit.

### Kết quả

* nội dung DRAFT được cập nhật;
* Job vẫn chưa công khai;
* Job vẫn có thể chưa hoàn thiện nếu chưa được submit.

### Trường hợp từ chối

* Job không còn ở `DRAFT`;
* actor không phải Primary Recruiter;
* actor không thuộc Company của Job.

### Business Rules liên quan

* `BR-08`
* `BR-09`
* `BR-38`

### Không thuộc chức năng này

* chỉnh sửa `PENDING_APPROVAL`;
* chỉnh sửa Job đã publish.

---

## F03 — Xem Job nội bộ theo quyền

### Actor

* Recruiter
* Company Manager

### Mục tiêu

Cho phép actor xem Job trong phạm vi Company và responsibility được V5 cấp quyền.

### Tiền điều kiện

* actor thuộc đúng Company của Job;
* actor có quyền xem tương ứng.

### Luồng chính

Đối với Recruiter:

1. Recruiter được xem Job ở mọi trạng thái nếu mình đang là Primary Recruiter của Job.
2. Recruiter được xem các Job `PUBLISHED` thuộc Company mình dù không phải Primary Recruiter.
3. Recruiter không được xem DRAFT của Recruiter khác.
4. V5 không cấp thêm quyền xem Job nội bộ khác ngoài các scope trên.

Đối với Company Manager:

1. Company Manager được xem Job thuộc Company mình khi Job đang ở `PENDING_APPROVAL`, `PUBLISHED`, `CLOSED` hoặc `EXPIRED`.
2. Company Manager không được xem Job `DRAFT`.
3. Trong phạm vi Job được phép xem, Company Manager được xem nội dung, trạng thái, người tạo Job và Primary Recruiter hiện tại.

### Kết quả

Actor chỉ tiếp cận các Job thuộc đúng authorization scope của mình.

### Trường hợp từ chối

* Job thuộc Company khác;
* Recruiter không thuộc một scope xem được V5 cấp;
* actor chỉ biết định danh Job nhưng không có quyền trên Job.

### Business Rules liên quan

* `BR-36`
* `BR-37`
* `BR-38`

### Không thuộc chức năng này

* Candidate Job Discovery.

---

## F04 — Primary Recruiter gửi Job duyệt

### Actor

* Primary Recruiter

### Mục tiêu

Gửi một Job đã hoàn thiện cho Company Manager xét duyệt.

### Tiền điều kiện

* Job đang ở `DRAFT`;
* actor là current Primary Recruiter;
* Primary Recruiter hợp lệ;
* Company đang hoạt động;
* Job có đầy đủ nội dung bắt buộc;
* các catalog được sử dụng còn hợp lệ;
* hạn nhận hồ sơ chưa kết thúc.

### Luồng chính

1. Primary Recruiter yêu cầu gửi Job duyệt.
2. Hệ thống kiểm tra ownership và Primary responsibility.
3. Hệ thống kiểm tra toàn bộ nội dung bắt buộc.
4. Hệ thống kiểm tra catalog và Category consistency.
5. Hệ thống kiểm tra hạn nhận hồ sơ.
6. Job chuyển sang `PENDING_APPROVAL`.
7. Nội dung Job bị khóa.

### Kết quả

```text
DRAFT → PENDING_APPROVAL
```

Job chờ Company Manager xét duyệt.

### Trường hợp từ chối

* Job không ở `DRAFT`;
* actor không phải Primary Recruiter;
* Job thiếu nội dung bắt buộc;
* Company không còn hợp lệ;
* Primary Recruiter không còn hợp lệ;
* catalog không còn hợp lệ;
* Category không nhất quán;
* hạn nhận hồ sơ đã kết thúc.

### Business Rules liên quan

* `BR-10`
* `BR-11`
* `BR-12`
* `BR-13`
* `BR-14`
* `BR-15`
* `BR-16`
* `BR-17`
* `BR-18`
* `BR-19`

### Không thuộc chức năng này

* approve;
* publish riêng biệt;
* yêu cầu Recruiter chỉnh sửa rồi gửi lại.

---

## F05 — Company Manager xét duyệt Job

### Actor

* Company Manager

### Mục tiêu

Company Manager đánh giá Job đã được Primary Recruiter submit.

### Tiền điều kiện

* Job đang ở `PENDING_APPROVAL`;
* Company Manager thuộc Company sở hữu Job.

### Luồng chính

1. Company Manager xem nội dung Job đã submit.
2. Company Manager xem người tạo Job.
3. Company Manager xem Primary Recruiter.
4. Company Manager lựa chọn một trong hai kết quả:

   * approve;
   * reject.

### Kết quả

Job tiếp tục sang F06 hoặc F07.

### Trường hợp từ chối

* Job thuộc Company khác;
* Job không còn ở `PENDING_APPROVAL`.

### Business Rules liên quan

* `BR-19`
* `BR-20`
* `BR-38`

### Không thuộc chức năng này

* Company Manager chỉnh sửa nội dung Job;
* yêu cầu chỉnh sửa;
* approve nhưng chưa publish.

---

## F06 — Company Manager approve và publish Job

### Actor

* Company Manager

### Mục tiêu

Phê duyệt một Job và đưa Job trở thành cơ hội tuyển dụng công khai của Company.

### Tiền điều kiện

* Job đang `PENDING_APPROVAL`;
* Company Manager thuộc đúng Company;
* Company còn hoạt động;
* Job có đúng một Primary Recruiter hợp lệ;
* Primary Recruiter thuộc cùng Company;
* các catalog Job sử dụng còn hợp lệ;
* hạn nhận hồ sơ chưa kết thúc.

### Luồng chính

1. Company Manager approve Job.
2. Các điều kiện publish được kiểm tra lại.
3. Job chuyển trực tiếp sang `PUBLISHED`.
4. Thời điểm publish được xác lập.
5. Job trở thành Job đã từng được công khai của Company.
6. Nội dung tuyển dụng tiếp tục bị khóa vĩnh viễn trong lifecycle V5.

### Kết quả

```text
PENDING_APPROVAL → PUBLISHED
```

Approve và publish là cùng một business event.

### Trường hợp từ chối

* Job không còn `PENDING_APPROVAL`;
* Company Manager thuộc Company khác;
* Company không còn hợp lệ;
* Primary Recruiter không còn hợp lệ;
* catalog không còn hợp lệ;
* deadline đã kết thúc.

### Business Rules liên quan

* `BR-20`
* `BR-21`
* `BR-22`
* `BR-24`
* `BR-32`

### Không thuộc chức năng này

* publish riêng sau approve;
* chỉnh sửa Job sau approve.

---

## F07 — Company Manager reject Job

### Actor

* Company Manager

### Mục tiêu

Từ chối một Job đang chờ duyệt và kết thúc lifecycle của Job đó.

### Tiền điều kiện

* Job đang `PENDING_APPROVAL`;
* Company Manager thuộc đúng Company.

### Luồng chính

1. Company Manager reject Job.
2. Job không được publish.
3. Job bị xóa hoàn toàn.
4. Job không chuyển sang một trạng thái `REJECTED`.

### Kết quả

```text
PENDING_APPROVAL → Job không còn tồn tại
```

Recruiter muốn tiếp tục tuyển dụng phải tạo một Job mới.

### Trường hợp từ chối

* Job không ở `PENDING_APPROVAL`;
* Company Manager thuộc Company khác.

### Business Rules liên quan

* `BR-20`
* `BR-23`
* `BR-38`

### Không thuộc chức năng này

* `REJECTED → DRAFT`;
* chỉnh sửa rồi resubmit;
* `CHANGES_REQUESTED`.

---

## F08 — Company Manager thay Primary Recruiter

### Actor

* Company Manager

### Mục tiêu

Chuyển trách nhiệm vận hành một Job đã publish sang Recruiter khác trong cùng Company.

### Tiền điều kiện

* Job đang `PUBLISHED`;
* Company Manager thuộc Company của Job;
* Primary mới là Recruiter hợp lệ;
* Primary mới thuộc cùng Company với Job.

### Luồng chính

1. Company Manager chọn Recruiter mới.
2. Hệ thống xác nhận Recruiter mới hợp lệ và thuộc cùng Company.
3. Primary responsibility được chuyển sang Recruiter mới.
4. Người tạo Job không thay đổi.
5. Job vẫn ở `PUBLISHED`.

### Kết quả

```text
createdBy = giữ nguyên
current Primary = Recruiter mới
```

### Trường hợp từ chối

* Job không ở `PUBLISHED`;
* Recruiter mới không hợp lệ;
* Recruiter mới thuộc Company khác;
* actor không phải Company Manager của Company sở hữu Job.

### Business Rules liên quan

* `BR-05`
* `BR-06`
* `BR-26`
* `BR-27`
* `BR-38`

### Không thuộc chức năng này

* Supporting Recruiter;
* team nhiều Recruiter;
* thay Primary ở `DRAFT`;
* thay Primary ở `PENDING_APPROVAL`;
* thay Primary ở `CLOSED`;
* thay Primary ở `EXPIRED`.

---

## F09 — Đóng Job thủ công

### Actor

* current Primary Recruiter
* Company Manager

### Mục tiêu

Kết thúc việc tuyển dụng của một Job đang publish trước khi Job tự hết hạn.

### Tiền điều kiện

* Job đang `PUBLISHED`;
* actor là current Primary Recruiter hoặc Company Manager của Company sở hữu Job.

### Luồng chính

1. Actor yêu cầu đóng Job.
2. Job chuyển sang `CLOSED`.
3. Job không còn được coi là Job đang tuyển.
4. Job vẫn được giữ lại.

### Kết quả

```text
PUBLISHED → CLOSED
```

### Trường hợp từ chối

* Job không đang `PUBLISHED`;
* Recruiter không phải current Primary;
* actor thuộc Company khác.

### Business Rules liên quan

* `BR-28`
* `BR-29`
* `BR-32`
* `BR-38`

### Không thuộc chức năng này

* mở lại Job;
* xóa Job sau khi đã publish.

---

## F10 — Job hết hạn

### Actor

* Hệ thống theo thời gian nghiệp vụ

### Mục tiêu

Bảo đảm Job không tiếp tục được coi là đang tuyển sau khi đạt hạn nhận hồ sơ.

### Tiền điều kiện

* Job đang có effective state `PUBLISHED`;
* thời điểm hiện tại đã đạt hoặc vượt hạn nhận hồ sơ.

### Luồng chính

1. Hệ thống so sánh thời điểm hiện tại với hạn nhận hồ sơ.
2. Khi deadline đã đạt, Job được coi là `EXPIRED`.
3. Job không còn là cơ hội đang tuyển.
4. Job vẫn được giữ lại làm lịch sử.

### Kết quả

```text
PUBLISHED → EXPIRED
```

### Trường hợp từ chối

Không áp dụng transition EXPIRED cho Job chưa từng `PUBLISHED`.

### Business Rules liên quan

* `BR-30`
* `BR-31`
* `BR-32`

### Không thuộc chức năng này

* gia hạn Job;
* mở lại Job.

---

## F11 — Xác định Job công khai và còn hiệu lực

### Actor

* Hệ thống
* Candidate là consumer của rule ở các version sử dụng Job công khai

### Mục tiêu

Xác định Job nào đủ điều kiện được coi là cơ hội tuyển dụng công khai.

### Tiền điều kiện

Job tồn tại và thuộc một Company.

### Luồng chính

Một Job chỉ được coi là cơ hội tuyển dụng công khai khi đồng thời:

1. effective state của Job là `PUBLISHED`;
2. thời điểm hiện tại chưa đạt hạn nhận hồ sơ;
3. Company sở hữu Job vẫn đang hoạt động.

### Kết quả

Job đủ điều kiện hoặc không đủ điều kiện để được các chức năng public của hệ thống sử dụng.

### Trường hợp từ chối

Job không được coi là cơ hội công khai nếu:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `CLOSED`;
* `EXPIRED`;
* đã bị xóa;
* deadline đã kết thúc;
* Company không còn hoạt động hợp lệ.

### Business Rules liên quan

* `BR-30`
* `BR-31`
* `BR-35`
* `BR-40`

### Không thuộc chức năng này

* search;
* filtering;
* sorting;
* recommendation;
* Application creation.

---

## F12 — Hard-delete Job trước publication theo lifecycle authority

### Actor

* Primary Recruiter
* Company Manager

### Mục tiêu

Loại bỏ hoàn toàn một Job nội bộ chưa từng trở thành Job công khai.

### Tiền điều kiện

* Job thuộc Company của Company Manager;
* Job chưa từng được publish;
* actor thuộc đúng Company của Job;
* nếu Job đang `DRAFT`, actor phải là current Primary Recruiter;
* nếu Job đang `PENDING_APPROVAL`, actor phải là Company Manager của Company sở hữu Job.

### Luồng chính

1. Actor yêu cầu hard-delete Job.
2. Hệ thống xác định tenant, lifecycle state và actor authority.
3. Nếu Job đang `DRAFT`, chỉ current Primary Recruiter được phép tiếp tục.
4. Nếu Job đang `PENDING_APPROVAL`, chỉ Company Manager của Company sở hữu Job
   được phép tiếp tục.
5. Job bị xóa hoàn toàn.
6. Job không còn tham gia bất kỳ business operation nào.

### Trường hợp từ chối

* Company Manager cố hard-delete `DRAFT`;
* Recruiter không phải current Primary cố hard-delete `DRAFT`;
* Recruiter cố hard-delete `PENDING_APPROVAL`;
* actor thuộc Company khác;
* Job đang `PUBLISHED`, `CLOSED` hoặc `EXPIRED`;
* historical creator/former Primary không còn current authority.

### Kết quả

Job không còn tồn tại.

Trong V5, quyền hard-delete chủ động chỉ áp dụng cho Job chưa từng được publish, gồm:

* `DRAFT`;
* `PENDING_APPROVAL`.

Reject trong F07 là một business outcome riêng của `PENDING_APPROVAL` nhưng cũng dẫn đến hard-delete.

### Trường hợp từ chối

* Job đã từng được publish;
* actor thuộc Company khác;
* actor là Recruiter.

### Business Rules liên quan

* `BR-32`
* `BR-33`
* `BR-34`
* `BR-38`

### Không thuộc chức năng này

* hard-delete `PUBLISHED`;
* hard-delete `CLOSED`;
* hard-delete `EXPIRED`.

---

# 10. Business Rules

## BR-01 — Chỉ Recruiter được tạo Job

Company Manager, Platform Admin và Candidate không tạo Job bằng vai trò của họ.

---

## BR-02 — Mỗi Job thuộc đúng một Company

Job là dữ liệu tuyển dụng của Company.

Job không phải tài nguyên thuộc sở hữu cá nhân của Recruiter.

---

## BR-03 — Company của Job không do Recruiter tùy ý lựa chọn

Company của Job phải được xác định từ Company membership hợp lệ của Recruiter tạo Job.

Recruiter không được dùng thao tác tạo Job để tạo Job cho Company khác.

---

## BR-04 — Trạng thái và trách nhiệm ban đầu

Khi Job được tạo:

```text
status = DRAFT
người tạo = Recruiter tạo Job
Primary Recruiter = Recruiter tạo Job
```

---

## BR-05 — Người tạo Job là lịch sử bất biến

Người tạo Job được xác lập một lần.

Việc thay Primary Recruiter không làm thay đổi người tạo Job.

---

## BR-06 — Job luôn có đúng một Primary Recruiter

V5 không cho phép Job không có Primary Recruiter hoặc có nhiều Primary Recruiter đồng thời.

---

## BR-07 — Primary Recruiter phải hợp lệ

Khi một nghiệp vụ yêu cầu Primary Recruiter hợp lệ, Primary phải:

* là Recruiter;
* thuộc cùng Company với Job;
* còn đủ điều kiện hoạt động.

---

## BR-08 — DRAFT được phép chưa hoàn thiện

Một Job có thể tồn tại ở `DRAFT` dù chưa có đầy đủ toàn bộ nội dung cần thiết để submit.

Việc nội dung bắt buộc chưa đầy đủ chỉ ngăn transition sang `PENDING_APPROVAL`.

---

## BR-09 — Chỉ Primary Recruiter được chỉnh sửa DRAFT

Recruiter khác trong Company không được chỉnh sửa DRAFT.

Company Manager không chỉnh sửa nội dung Job thay Recruiter.

---

## BR-10 — Nội dung bắt buộc trước khi submit

Trước khi rời `DRAFT`, Job phải có đầy đủ:

* tên Job hoặc vị trí tuyển dụng;
* Job Description;
* kỹ năng yêu cầu;
* thông tin lương;
* hạn nhận hồ sơ;
* Category bắt buộc;
* Location;
* Employment Type;
* Work Mode;
* Experience.

---

## BR-11 — Category của Job

Job phải có:

* ít nhất một Category cấp nghề/lĩnh vực;
* ít nhất một Category cấp vị trí.

Job được phép sử dụng nhiều Category.

Mỗi Category vị trí phải thuộc một trong các Category nghề/lĩnh vực đã được chọn cho cùng Job.

---

## BR-12 — Location và Work Mode độc lập

Job có đúng một Location.

Remote không phải Location.

Job có Work Mode Remote vẫn phải có Location.

---

## BR-13 — Employment Type

Mỗi Job có đúng một Employment Type.

---

## BR-14 — Work Mode

Mỗi Job có ít nhất một Work Mode và có thể có nhiều Work Mode.

---

## BR-15 — Experience

Mỗi Job chọn đúng một Experience level chuẩn.

Experience được sử dụng như metadata kinh nghiệm theo semantics của catalog chuẩn.

---

## BR-16 — Job chỉ sử dụng catalog chuẩn

Recruiter không được:

* tạo Category mới khi tạo Job;
* tạo Location riêng;
* tạo Employment Type riêng;
* tạo Work Mode riêng;
* tạo Experience riêng cho Company;
* thay thế catalog chuẩn bằng giá trị tự do có semantics khác.

---

## BR-17 — Hạn nhận hồ sơ phải còn hiệu lực

Tại thời điểm submit và tại thời điểm approve:

```text
thời điểm hiện tại < hạn nhận hồ sơ
```

phải đúng.

---

## BR-18 — Chỉ Primary Recruiter được submit

Chỉ current Primary Recruiter của Job được thực hiện:

```text
DRAFT → PENDING_APPROVAL
```

---

## BR-19 — PENDING_APPROVAL khóa nội dung

Khi Job ở `PENDING_APPROVAL`, nội dung tuyển dụng không được chỉnh sửa.

Company Manager phải xét duyệt đúng nội dung mà Primary Recruiter đã submit.

---

## BR-20 — Approval authority thuộc Company Manager

Chỉ Company Manager thuộc Company sở hữu Job được:

* approve;
* reject.

Recruiter không tự approve hoặc tự publish Job.

---

## BR-21 — Approve đồng thời là publish

Không tồn tại business step:

```text
APPROVED → PUBLISHED
```

Approve trực tiếp tạo transition:

```text
PENDING_APPROVAL → PUBLISHED
```

Thời điểm approve đồng thời là thời điểm Job được publish.

---

## BR-22 — Điều kiện publish phải được kiểm tra lại

Ngay trước approve, các điều kiện có thể thay đổi từ lúc submit phải vẫn còn hợp lệ, bao gồm:

* Company;
* Primary Recruiter;
* quan hệ Primary với Company;
* catalog được sử dụng;
* hạn nhận hồ sơ.

---

## BR-23 — Reject kết thúc Job bằng hard-delete

Reject chỉ áp dụng cho `PENDING_APPROVAL`.

Sau reject:

* Job bị xóa hoàn toàn;
* không tồn tại persisted state `REJECTED`;
* không được sửa;
* không được resubmit;
* muốn tiếp tục tuyển dụng phải tạo Job mới.

---

## BR-24 — Nội dung Job bất biến sau publish

Sau khi Job chuyển sang `PUBLISHED`, nội dung tuyển dụng đã được duyệt không được chỉnh sửa.

Bao gồm các nội dung business như:

* tên Job;
* Job Description;
* kỹ năng;
* Category;
* Location;
* Employment Type;
* Work Mode;
* Experience;
* thông tin lương;
* hạn nhận hồ sơ;
* Company sở hữu Job.

---

## BR-25 — Thay đổi điều kiện tuyển dụng cần Job mới

Nếu Company muốn thay đổi nội dung tuyển dụng sau khi Job đã publish:

```text
Job cũ kết thúc theo lifecycle hợp lệ
        ↓
Tạo Job mới
        ↓
Submit và approve lại
```

Không chỉnh sửa Job đã publish để thay đổi điều kiện tuyển dụng.

---

## BR-26 — Chỉ PUBLISHED được thay Primary Recruiter

Company Manager chỉ được thay Primary Recruiter khi Job đang `PUBLISHED`.

Không thay Primary trong:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `CLOSED`;
* `EXPIRED`.

---

## BR-27 — Thay Primary không thay người tạo Job

Sau khi thay Primary:

```text
createdBy = giữ nguyên
Primary Recruiter = Recruiter mới
```

Primary mới phải là Recruiter hợp lệ thuộc cùng Company.

---

## BR-28 — Quyền đóng Job

Job `PUBLISHED` chỉ được đóng bởi:

* current Primary Recruiter;
* Company Manager thuộc Company sở hữu Job.

Recruiter khác trong Company không mặc nhiên có quyền đóng Job.

---

## BR-29 — CLOSED là terminal state trong V5

Đóng thủ công tạo transition:

```text
PUBLISHED → CLOSED
```

V5 không hỗ trợ mở lại Job `CLOSED`.

---

## BR-30 — Deadline là nguồn sự thật của expiration

Một Job đang `PUBLISHED` được coi là hết hạn khi:

```text
thời điểm hiện tại >= hạn nhận hồ sơ
```

Kết quả business là `EXPIRED`.

---

## BR-31 — Business behavior phải sử dụng effective expiration

Không được coi Job vẫn đang tuyển chỉ vì trạng thái được quan sát chưa phản ánh kịp thời deadline.

Mọi business behavior phụ thuộc việc Job còn hiệu lực phải đồng thời xét hạn nhận hồ sơ.

---

## BR-32 — Publication tạo historical boundary

Một Job đã từng chuyển sang `PUBLISHED` phải được giữ lại.

Không hard-delete:

* `PUBLISHED`;
* `CLOSED`;
* `EXPIRED`.

`CLOSED` và `EXPIRED` là historical terminal states của Job trong V5.

---

## BR-33 — Hard-delete trước publication theo lifecycle authority

Hard-delete chỉ áp dụng trước publication.

Khi Job đang `DRAFT`:

* chỉ current Primary Recruiter được hard-delete;
* Company Manager không được hard-delete;
* Recruiter khác không được hard-delete.

Khi Job đang `PENDING_APPROVAL`:

* chỉ Company Manager thuộc Company sở hữu Job được manual hard-delete;
* Recruiter không được hard-delete.

Reject là trường hợp riêng của `PENDING_APPROVAL` do Company Manager thực hiện
và cũng dẫn đến hard-delete.

Không hard-delete `PUBLISHED`, `CLOSED` hoặc `EXPIRED`.

---

## BR-34 — Primary Recruiter chỉ hard-delete DRAFT mình phụ trách

Current Primary Recruiter được hard-delete Job khi và chỉ khi Job đang `DRAFT`.

Recruiter không được hard-delete:

* DRAFT của Recruiter khác;
* `PENDING_APPROVAL`;
* `PUBLISHED`;
* `CLOSED`;
* `EXPIRED`.

Historical creator hoặc former Primary association không tự tạo hard-delete
authority.

---

## BR-35 — Điều kiện Job công khai

Một Job chỉ được coi là cơ hội tuyển dụng công khai khi đồng thời:

```text
effective state = PUBLISHED
AND thời điểm hiện tại < hạn nhận hồ sơ
AND Company đang hoạt động
```

---

## BR-36 — Recruiter visibility

Recruiter được xem:

1. Job ở mọi trạng thái mà Recruiter hiện đang là Primary Recruiter;
2. mọi Job `PUBLISHED` thuộc Company của Recruiter.

Recruiter không được xem DRAFT của Recruiter khác.

V5 không cấp thêm visibility ngoài các scope trên.

---

## BR-37 — Company Manager visibility

Company Manager được xem Job thuộc Company mình khi Job đang ở một trong các trạng thái:

* `PENDING_APPROVAL`;
* `PUBLISHED`;
* `CLOSED`;
* `EXPIRED`.

Company Manager không được xem Job `DRAFT`.

Đối với Job thuộc scope được phép xem, Company Manager được xem:

* nội dung;
* trạng thái;
* người tạo;
* current Primary Recruiter.

---

## BR-38 — Cross-tenant access bị cấm

Recruiter và Company Manager không được thao tác Job của Company khác.

Biết định danh Job không tạo ra quyền truy cập.

Company identity hoặc resource identifier do caller cung cấp không được tự tạo ra business authorization.

---

## BR-39 — Platform Admin không vận hành Job

Platform Admin không trực tiếp:

* tạo;
* approve;
* publish;
* close;
* reassign Primary;

trong lifecycle tuyển dụng thông thường của V5.

---

## BR-40 — Candidate không được tiếp cận Job nội bộ

Candidate không được coi các Job sau là cơ hội tuyển dụng công khai:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `CLOSED`;
* `EXPIRED`.

Job đã bị xóa cũng không còn khả năng tham gia nghiệp vụ public.

---

## BR-41 — Recruiter phải bàn giao trách nhiệm trước khi bị khóa hoặc chấm dứt

Không được hoàn tất việc khóa hoặc chấm dứt một Recruiter khi Recruiter đó vẫn đang là Primary của Job chưa kết thúc.

Việc chuyển Primary chỉ được thực hiện khi Job `PUBLISHED`.

Do đó, nếu Recruiter còn Job `DRAFT` hoặc `PENDING_APPROVAL`, các Job đó phải đi đến một kết quả lifecycle hợp lệ trước khi việc khóa/chấm dứt Recruiter có thể hoàn tất.

Job `CLOSED` hoặc `EXPIRED` không còn tạo ra trách nhiệm vận hành cần bàn giao.

---

## BR-42 — Supporting Recruiter không tồn tại trong V5

V5 chỉ có một Primary Recruiter trên mỗi Job.

Không tự tạo mô hình team tạm thời để chuẩn bị cho version sau.

---

## BR-43 — Historical association không tự tạo authorization

Việc một Recruiter:

* là người tạo Job;
* từng là Primary Recruiter;

không tự động cấp quyền hiện tại ngoài những quyền visibility hoặc operation được V5 định nghĩa rõ.

---

# 11. State Transitions

| Hành động                           | Trước              | Sau                | Actor / Trigger                     |
| ----------------------------------- | ------------------ | ------------------ | ----------------------------------- |
| Tạo Job                             | Không tồn tại      | `DRAFT`            | Recruiter                           |
| Submit duyệt                        | `DRAFT`            | `PENDING_APPROVAL` | Primary Recruiter                   |
| Approve + publish                   | `PENDING_APPROVAL` | `PUBLISHED`        | Company Manager                     |
| Reject                              | `PENDING_APPROVAL` | Không tồn tại      | Company Manager                     |
| Xóa DRAFT | `DRAFT` | Không tồn tại | Primary Recruiter |
| Xóa Job chưa publish đang chờ duyệt | `PENDING_APPROVAL` | Không tồn tại      | Company Manager                     |
| Thay Primary                        | `PUBLISHED`        | `PUBLISHED`        | Company Manager                     |
| Đóng Job                            | `PUBLISHED`        | `CLOSED`           | Primary Recruiter / Company Manager |
| Đạt hạn nhận hồ sơ                  | `PUBLISHED`        | `EXPIRED`          | Thời gian nghiệp vụ                 |

Không có transition:

```text
PENDING_APPROVAL → CHANGES_REQUESTED
REJECTED → DRAFT
PUBLISHED → DRAFT
CLOSED → PUBLISHED
EXPIRED → PUBLISHED
```

Không có edit transition sau publication.

Chỉ các transition được định nghĩa trong tài liệu này thuộc business contract của V5.

---

# 12. Authorization và ownership boundary

| Hành động                       | Actor được phép          | Resource / Scope            | Điều kiện                       |
| ------------------------------- | ------------------------ | --------------------------- | ------------------------------- |
| Tạo Job                         | Recruiter                | Company của chính Recruiter | Recruiter hợp lệ                |
| Xem Job mình là Primary         | Primary Recruiter        | Job thuộc cùng Company      | Mọi state còn tồn tại           |
| Xem Job `PUBLISHED` của Company | Recruiter                | Company mình                | Job `PUBLISHED`                 |
| Xem Job Company từ `PENDING_APPROVAL` trở đi | Company Manager | Company mình | `PENDING_APPROVAL`, `PUBLISHED`, `CLOSED`, `EXPIRED` |
| Sửa DRAFT                       | Primary Recruiter        | Job mình phụ trách          | `DRAFT`                         |
| Submit                          | Primary Recruiter        | Job mình phụ trách          | `DRAFT` và đủ điều kiện         |
| Approve                         | Company Manager          | Job Company mình            | `PENDING_APPROVAL`              |
| Reject                          | Company Manager          | Job Company mình            | `PENDING_APPROVAL`              |
| Thay Primary                    | Company Manager          | Job Company mình            | `PUBLISHED`                     |
| Close                           | Primary Recruiter        | Job mình phụ trách          | `PUBLISHED`                     |
| Close                           | Company Manager          | Job Company mình            | `PUBLISHED`                     |
| Hard-delete DRAFT | Primary Recruiter | Job mình phụ trách | `DRAFT` |
| Hard-delete pending Job | Company Manager | Job Company mình | `PENDING_APPROVAL` |
| Hard-delete Job đã publish | Không actor nào trong V5 | — | Bị cấm |

Các quyền được xác định từ:

* authenticated actor;
* Company membership;
* actor role;
* Job ownership;
* current Primary responsibility;
* Job lifecycle state.

Không coi identifier do caller cung cấp là bằng chứng quyền truy cập.

---

# 13. Multi-tenant boundary

Company là tenant boundary của Job.

Quy trình business:

```text
Authenticated Actor
        ↓
Company Membership
        ↓
Canonical Company
        ↓
Job thuộc Company
        ↓
Authorization theo role + responsibility
```

Các invariant tenant:

1. Mỗi Job thuộc đúng một Company.
2. Recruiter chỉ tạo Job cho Company mình.
3. Primary Recruiter phải thuộc cùng Company với Job.
4. Primary mới khi reassignment phải thuộc cùng Company.
5. Company Manager chỉ thao tác Job thuộc Company mình.
6. Recruiter không được thao tác Job Company khác.
7. Job không đổi Company trong lifecycle.
8. Biết `Job` identifier không đủ để truy cập Job.
9. Dữ liệu do caller cung cấp không được tự thay đổi tenant ownership.

Catalog chuẩn của V4 không phải dữ liệu riêng của một Company.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng trong V5:

1. Chỉ Recruiter được tạo Job.
2. Mỗi Job thuộc đúng một Company.
3. Company ownership không thay đổi trong lifecycle.
4. Job bắt đầu ở `DRAFT`.
5. DRAFT được phép chưa hoàn thiện.
6. Recruiter tạo Job trở thành người tạo và Primary Recruiter ban đầu.
7. Người tạo Job là historical identity bất biến.
8. Mỗi Job có đúng một Primary Recruiter.
9. Primary Recruiter phải thuộc cùng Company với Job.
10. Chỉ Primary Recruiter được chỉnh sửa DRAFT.
11. Chỉ Primary Recruiter được submit.
12. Job phải hoàn thiện toàn bộ nội dung bắt buộc trước submit.
13. Job phải sử dụng catalog chuẩn của nền tảng.
14. Category position phải nhất quán với Category field đã chọn.
15. Job có đúng một Location.
16. Remote không phải Location.
17. Job có đúng một Employment Type.
18. Job có ít nhất một Work Mode.
19. Job có đúng một Experience level.
20. `PENDING_APPROVAL` không được chỉnh sửa nội dung.
21. Chỉ Company Manager của đúng Company được approve/reject.
22. Approve đồng thời là publish.
23. Recruiter không tự publish.
24. Reject không tạo persisted `REJECTED`.
25. Reject kết thúc Job bằng hard-delete.
26. Job bị reject không được resubmit.
27. Nội dung Job không được chỉnh sửa sau publish.
28. Chỉ `PUBLISHED` được thay Primary Recruiter.
29. Chỉ Company Manager được thay Primary.
30. Thay Primary không thay người tạo Job.
31. Primary mới phải là Recruiter hợp lệ cùng Company.
32. Primary Recruiter hoặc Company Manager mới được đóng Job `PUBLISHED`.
33. `CLOSED` không được mở lại trong V5.
34. Deadline là nguồn sự thật của expiration.
35. Job đạt deadline không còn được coi là `PUBLISHED` hiệu lực.
36. `EXPIRED` không được mở lại trong V5.
37. Job đã từng publish không được hard-delete.
38. `CLOSED` và `EXPIRED` được giữ lại.
39. Recruiter không hard-delete Job.
40. Candidate chỉ có thể được tiếp cận Job đáp ứng public eligibility.
41. Company phải đang hoạt động để Job được coi là cơ hội công khai.
42. Job thuộc Company, không thuộc cá nhân Recruiter.
43. Cross-tenant Job access bị cấm.
44. Supporting Recruiter chưa tồn tại trong V5.
45. Recruiter còn trách nhiệm Primary trên Job chưa kết thúc không được bị khóa/chấm dứt trước khi trách nhiệm đó được giải quyết hợp lệ.

---

# 15. Các quyết định chủ động defer

Các nội dung đã được xem xét nhưng chủ động không thuộc V5:

* Supporting Recruiter;
* recruitment team;
* Primary cũ trở thành Supporting;
* Application;
* Candidate Apply persistence;
* CV snapshot;
* Job snapshot trong Application;
* Application assignment;
* recruitment pipeline;
* Candidate Search;
* Job Invitation;
* Chat;
* Interview Schedule;
* Saved Jobs;
* Job Discovery hoàn chỉnh;
* search/filter/sort/recommendation Job;
* gia hạn deadline;
* reopen `CLOSED`;
* reopen `EXPIRED`;
* edit Job sau publish;
* resubmit Job sau reject;
* cấu trúc business chi tiết hơn cho salary ngoài requirement “Job phải có thông tin lương”.

Các version sau được phép bổ sung nghiệp vụ mới xung quanh Job nhưng không được làm mất các invariant lịch sử của Job đã được V5 xác lập nếu không có quyết định product mới.

Không được tự implement các chức năng đã defer chỉ để chuẩn bị cho version tương lai.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V5.

Các lựa chọn về cách biểu diễn, lưu trữ hoặc triển khai không phải business decision của tài liệu này và được quyết định ở các contract tiếp theo.

---

# 17. Definition of Business Completion

V5 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Recruiter tạo Job Draft đã được đáp ứng;
* `F02` — chỉnh sửa Job Draft đã được đáp ứng;
* `F03` — quyền xem Job nội bộ đã được đáp ứng;
* `F04` — submit Job duyệt đã được đáp ứng;
* `F05` — Company Manager xét duyệt Job đã được đáp ứng;
* `F06` — approve và publish đã được đáp ứng;
* `F07` — reject Job đã được đáp ứng;
* `F08` — thay Primary Recruiter đã được đáp ứng;
* `F09` — đóng Job thủ công đã được đáp ứng;
* `F10` — expiration đã được đáp ứng;
* `F11` — public eligibility đã được đáp ứng;
* `F12` — xóa Job pre-publication đã được đáp ứng;
* toàn bộ `BR-01` đến `BR-43` được bảo toàn;
* toàn bộ state transition hợp lệ được hỗ trợ;
* không xuất hiện transition ngoài business contract;
* authorization boundary được giữ;
* Company tenant boundary được giữ;
* partial DRAFT được hỗ trợ;
* PENDING content luôn được khóa;
* published content luôn bất biến;
* Job đã từng publish không bị hard-delete;
* expiration luôn sử dụng deadline như source of truth;
* lifecycle Recruiter không làm mất Primary responsibility chưa được giải quyết;
* các nội dung đã defer không bị triển khai ngoài ý muốn;
* không xuất hiện behavior ngoài phạm vi V5.

Việc một implementation hoạt động về mặt kỹ thuật không tự động đồng nghĩa với Business Completion nếu behavior thực tế không đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification của V5**.

Tài liệu này định nghĩa:

```text
WHAT MUST HAPPEN
```

bao gồm:

* business behavior;
* actors;
* permissions;
* lifecycle;
* states;
* transitions;
* business validations;
* ownership;
* tenant boundary;
* invariants;
* version boundary.

Tài liệu này không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Các quyết định về:

* interface kỹ thuật;
* transport;
* persistence structure;
* transaction mechanism;
* architecture;
* source-code organization;
* framework;
* testing technology;

không thuộc Product Specification này.

Luồng authority của dự án là:

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

Nếu Data Contract hoặc implementation mâu thuẫn với tài liệu này về business behavior, **Product Specification V5 là authority**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
