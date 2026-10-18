# V6 — Recruitment Team và chuyển giao trách nhiệm

> **File:** `docs/product/versions/v6-recruitment-team-responsibility-transfer.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V6.

---

## 1. Mục tiêu

V6 bổ sung **Recruitment Team theo từng Job** và cơ chế **chuyển giao trách nhiệm Recruiter**.

Sau khi V6 hoàn thành, hệ thống phải xác định và thực hiện được:

* ai đang là `Primary Recruiter` chịu trách nhiệm chính cho từng Job;
* ai đang là `Supporting Recruiter` hỗ trợ từng Job;
* quyền xem và quản lý Recruitment Team của Company Manager, Primary Recruiter và Supporting Recruiter;
* việc thêm hoặc xóa Supporting Recruiter;
* việc thay Primary Recruiter;
* việc giữ Primary cũ làm Supporting hoặc cho Primary cũ rời team;
* việc chuyển giao trách nhiệm trước khi Recruiter bị khóa hoặc chấm dứt quyền truy cập;
* việc bảo đảm các Job chưa kết thúc không bị bỏ lại với Primary Recruiter không còn đủ điều kiện hoạt động.

V6 không thay đổi Job lifecycle đã được chốt ở V5.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V6 bao gồm:

* Recruitment Team riêng cho từng Job;
* đúng một Primary Recruiter trên mỗi Job;
* từ 0 đến nhiều Supporting Recruiter trên mỗi Job;
* xác định một Recruiter là Primary, Supporting hoặc không tham gia trên từng Job;
* xem Recruitment Team;
* thêm Supporting Recruiter;
* xóa Supporting Recruiter;
* thay Primary Recruiter;
* quyết định vị trí của Primary cũ sau khi thay Primary;
* kiểm tra eligibility của Recruiter khi nhận hoặc tiếp tục active responsibility;
* giới hạn team theo Company sở hữu Job;
* chuyển giao bắt buộc trước khi Recruiter bị `LOCKED` hoặc `TERMINATED`;
* xử lý trường hợp không có Recruiter hợp lệ để thay thế Primary;
* hành vi của Recruitment Team sau khi Recruiter được unlock;
* phân biệt active responsibility với historical information trên Job đã kết thúc;
* đặt invariant nền tảng để các version sau chỉ giao trách nhiệm thuộc Job cho Primary hoặc Supporting của đúng Job.

### 2.2. Ngoài phạm vi

V6 không bao gồm:

* Application;
* Application Assignee;
* assign hoặc reassign Application;
* lịch sử phân công Application;
* Application Pipeline;
* CV snapshot;
* Candidate Search;
* Job Invitation;
* trạng thái và lifecycle của Job Invitation;
* Source Recruiter;
* sourcing credit;
* Conversation;
* Chat;
* ghi chú nghiệp vụ;
* Interview Schedule;
* Notification;
* workload tracking;
* quyền xem hoặc xử lý Candidate cụ thể;
* custom permission riêng cho từng Supporting Recruiter;
* Recruitment Team audit history như một product feature;
* tự động cân bằng hoặc phân phối workload giữa Recruiter.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V6 kế thừa các business concept và invariant đã tồn tại trước đó.

### V1 — Account và Authentication lifecycle

V6 sử dụng trạng thái và khả năng hoạt động của `User`, bao gồm việc tài khoản phải ở trạng thái cho phép hoạt động.

V6 không thay đổi authentication lifecycle.

### V2 — Company lifecycle

V6 sử dụng trạng thái approval và operational status của Company để xác định Company có đang ở trạng thái hợp lệ để vận hành Recruitment Team hay không.

V6 không thay đổi Company lifecycle.

### V3 — Quản lý nhân sự tuyển dụng của Company

V6 sử dụng:

* Company Manager;
* Recruiter;
* Company membership;
* trạng thái Recruiter;
* lock;
* unlock;
* terminate;
* mandatory password change.

V6 bổ sung yêu cầu chuyển giao responsibility trước khi hoàn tất lock hoặc terminate đối với Recruiter đang tham gia các Job chưa kết thúc.

### V5 — Job và vòng đời phê duyệt Job

V5 là baseline trực tiếp của V6.

V6 giữ nguyên:

* người tạo Job trở thành Primary Recruiter mặc định;
* `createdBy` là thông tin người tạo Job;
* Job lifecycle:

  * `DRAFT`;
  * `PENDING_APPROVAL`;
  * `PUBLISHED`;
  * `CLOSED`;
  * `EXPIRED`;
* không tồn tại `CHANGES_REQUESTED`;
* reject không tạo persisted state `REJECTED` mà làm Job bị xóa hoàn toàn;
* Job đã publish không được chỉnh sửa nội dung;
* quyền approve/reject/publish/close/delete đã được V5 xác định;
* application deadline là nguồn sự thật để xác định Job đã hết hạn về mặt nghiệp vụ;
* Job và dữ liệu tuyển dụng thuộc Company, không thuộc cá nhân Recruiter.

V6 không được làm thay đổi các invariant của V5 trừ những phần V5 đã chủ động dành cho Recruitment Team và chuyển giao trách nhiệm.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Recruitment Team

Recruitment Team là tập hợp Recruiter đang giữ responsibility trên một Job.

Mỗi Recruitment Team gồm:

```text
đúng 1 Primary Recruiter
+
0..N Supporting Recruiter
```

Recruitment Team thuộc từng Job cụ thể.

Recruitment Team không phải một cơ cấu chức danh chung trên toàn Company.

---

### 4.2. Primary Recruiter

Primary Recruiter là Recruiter đang chịu trách nhiệm chính hiện tại đối với một Job.

Primary Recruiter là responsibility theo từng Job, không phải role cố định của tài khoản hoặc Company Member.

Một Recruiter có thể là Primary của nhiều Job khác nhau.

---

### 4.3. Supporting Recruiter

Supporting Recruiter là Recruiter đang tham gia hỗ trợ một Job.

Một Job có thể không có Supporting Recruiter hoặc có nhiều Supporting Recruiter.

Supporting Recruiter là responsibility theo từng Job, không phải role cố định ở cấp Company.

---

### 4.4. Company Manager

Company Manager là chủ thể có quyền quản lý Recruitment Team của các Job thuộc Company mình.

Company Manager không trở thành Primary hoặc Supporting Recruiter chỉ vì đang quản lý Company.

---

### 4.5. Recruiter ngoài team

Recruiter ngoài team là Recruiter của Company nhưng trên Job cụ thể đang không giữ vị trí Primary hoặc Supporting.

Recruiter ngoài team có thể trở thành Supporting khi thỏa mãn đầy đủ các điều kiện nghiệp vụ.

---

### 4.6. Active responsibility

Active responsibility là responsibility cần được Recruiter tiếp tục thực hiện trên một Job chưa kết thúc.

V6 phân biệt active responsibility với thông tin lịch sử về người từng tham gia Job.

---

### 4.7. Operational eligibility

Operational eligibility là tập điều kiện một Recruiter phải thỏa mãn để:

* được giao responsibility mới;
* được thêm vào active Recruitment Team;
* được chuyển thành Primary;
* tiếp tục vận hành responsibility trên Job chưa kết thúc.

Operational eligibility không phải hard invariant bắt buộc mọi historical reference trên Job đã kết thúc phải luôn trỏ tới Recruiter đang ACTIVE.

---

## 5. Quan hệ nghiệp vụ chính

```text
Company
   │
   │ sở hữu
   ↓
Job
   │
   ├── đúng 1 Primary Recruiter
   │
   └── 0..N Supporting Recruiter
```

Một Recruiter có thể có responsibility khác nhau trên các Job khác nhau:

```text
Recruiter A
├── Job 1 → PRIMARY_RECRUITER
├── Job 2 → SUPPORTING_RECRUITER
└── Job 3 → NONE
```

Trên cùng một Job:

```text
Recruiter
   ↓
PRIMARY_RECRUITER
hoặc
SUPPORTING_RECRUITER
hoặc
NONE
```

Một Recruiter không được đồng thời là Primary và Supporting của cùng Job.

`createdBy` và Primary Recruiter hiện tại là hai khái niệm độc lập:

```text
createdBy
= người tạo Job trong lịch sử

Primary Recruiter
= người đang chịu trách nhiệm chính hiện tại
```

Thay Primary không thay đổi người tạo Job.

Phần này chỉ mô tả quan hệ nghiệp vụ.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Job lifecycle được V6 sử dụng

V6 kế thừa các trạng thái Job từ V5:

| Trạng thái         | Ý nghĩa liên quan đến V6                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `DRAFT`            | Job chưa submit; normal team management không được thực hiện, nhưng có thể cần forced transfer trước lock/terminate |
| `PENDING_APPROVAL` | Job đang chờ CM duyệt; normal team management không được thực hiện, nhưng có thể cần forced transfer                |
| `PUBLISHED`        | Job đã publish; được normal team management nếu chưa hết hạn                                                        |
| `CLOSED`           | Job đã kết thúc do được đóng                                                                                        |
| `EXPIRED`          | Job đã kết thúc do hết application deadline                                                                         |

V6 không bổ sung:

* `CHANGES_REQUESTED`;
* persisted state `REJECTED`.

### Effective `PUBLISHED`

Đối với V6, Job chỉ được coi là đang `PUBLISHED` để tiếp tục normal team management khi:

```text
Job.status = PUBLISHED
AND
thời điểm hiện tại < applicationDeadline
```

Nếu persisted status vẫn là `PUBLISHED` nhưng thời điểm hiện tại đã đạt hoặc vượt `applicationDeadline`, Job phải được xử lý như đã `EXPIRED` đối với các nghiệp vụ V6.

---

### 6.2. Recruitment Team position

Đối với một Recruiter trên một Job:

| Trạng thái             | Ý nghĩa                                           |
| ---------------------- | ------------------------------------------------- |
| `PRIMARY_RECRUITER`    | Recruiter đang chịu trách nhiệm chính             |
| `SUPPORTING_RECRUITER` | Recruiter đang hỗ trợ Job                         |
| `NONE`                 | Recruiter không tham gia Recruitment Team của Job |

Các trạng thái này chỉ có ý nghĩa theo từng Job.

---

## 7. Tổ hợp trạng thái hợp lệ

### 7.1. Job state và loại team operation

| Job state                                  | Normal team management | Forced transfer trước lock/terminate |
| ------------------------------------------ | ---------------------: | -----------------------------------: |
| `DRAFT`                                    |                  Không |                                   Có |
| `PENDING_APPROVAL`                         |                  Không |                                   Có |
| `PUBLISHED` và chưa đến deadline           |                     Có |                                   Có |
| `PUBLISHED` nhưng đã đến hoặc qua deadline |                  Không |                                Không |
| `CLOSED`                                   |                  Không |                                Không |
| `EXPIRED`                                  |                  Không |                                Không |

Normal team management gồm:

* thêm Supporting;
* xóa Supporting;
* thay Primary;
* quyết định Primary cũ ở lại Supporting hay rời team.

Forced transfer là ngoại lệ chỉ phục vụ việc bảo đảm Recruiter sắp bị lock hoặc terminate không còn active responsibility trên các Job chưa kết thúc.

---

### 7.2. Recruitment Team position

Các tổ hợp hợp lệ trên cùng một Job:

| Primary                                          | Supporting                    | Hợp lệ |
| ------------------------------------------------ | ----------------------------- | -----: |
| Một Recruiter                                    | Không có Supporting           |     Có |
| Một Recruiter                                    | Một hoặc nhiều Recruiter khác |     Có |
| Không có Primary                                 | Bất kỳ                        |  Không |
| Nhiều Primary                                    | Bất kỳ                        |  Không |
| Một Recruiter đồng thời là Primary và Supporting | Có                            |  Không |
| Một Supporting xuất hiện nhiều lần               | Có                            |  Không |

---

## 8. Quy trình nghiệp vụ tổng thể

### 8.1. Khởi tạo

```text
Recruiter tạo Job
        ↓
Recruiter đó trở thành Primary mặc định
        ↓
Recruitment Team có:
1 Primary
0 Supporting
```

---

### 8.2. Normal team management

```text
Job effectively PUBLISHED
        ↓
CM hoặc Primary quản lý Supporting
        ↓
CM có thể thay Primary
        ↓
Recruitment Team tiếp tục có đúng một Primary
```

---

### 8.3. Chuyển giao trước lock/terminate

```text
CM yêu cầu lock/terminate Recruiter
        ↓
Xác định các Job chưa kết thúc Recruiter đang tham gia
        ↓
Xử lý các Job Recruiter đang là Primary
        ↓
Xử lý các Job Recruiter đang là Supporting
        ↓
Chuyển giao toàn bộ active responsibility cần thiết
        ↓
Recruiter rời active Recruitment Team
        ↓
Mới được hoàn tất lock/terminate
```

---

# 9. Functional Requirements

## F01 — Xem Recruitment Team của Job

### Actor

* Company Manager;
* Primary Recruiter;
* Supporting Recruiter.

### Mục tiêu

Cho phép actor hợp lệ xác định Primary Recruiter và các Supporting Recruiter của Job mà actor có quyền xem Recruitment Team.

### Tiền điều kiện

* Job tồn tại;
* actor có quan hệ nghiệp vụ hợp lệ với Job.

### Luồng chính

1. Actor yêu cầu xem Recruitment Team của Job.
2. Hệ thống xác định Company sở hữu Job và quan hệ của actor với Job.
3. Nếu actor là Company Manager của Company sở hữu Job, actor được xem team.
4. Nếu actor là Primary Recruiter hiện tại, actor được xem team.
5. Nếu actor là Supporting Recruiter hiện tại, actor được xem team ở chế độ read-only.
6. Hệ thống cung cấp Primary hiện tại và danh sách Supporting hiện tại.

### Kết quả

Actor xác định được:

* Primary Recruiter hiện tại;
* các Supporting Recruiter hiện tại.

Việc xem team không tự tạo hoặc thay đổi responsibility.

### Trường hợp từ chối

V6 không cấp quyền xem Recruitment Team dựa chỉ trên identifier do client cung cấp nếu actor không có quan hệ nghiệp vụ hợp lệ với Job.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-04`
* `BR-05`
* `BR-14`
* `BR-15`
* `BR-16`
* `BR-32`

### Không thuộc chức năng này

* quyền xem Application;
* quyền xem Candidate;
* quyền xem Chat;
* quyền xem Interview;
* quyền chỉnh sửa Recruitment Team.

---

## F02 — Thêm Supporting Recruiter

### Actor

* Company Manager;
* Primary Recruiter hiện tại.

### Mục tiêu

Thêm một Recruiter hợp lệ của cùng Company vào Recruitment Team của một Job với vị trí Supporting Recruiter.

### Tiền điều kiện

* Job đang effectively `PUBLISHED`;
* Job chưa hết application deadline;
* Company đang ở trạng thái cho phép hoạt động;
* actor có quyền quản lý Supporting trên Job;
* Recruiter được chọn thỏa mãn operational eligibility.

### Luồng chính

1. Actor chọn Recruiter cần thêm vào Job.
2. Hệ thống xác định Company sở hữu Job.
3. Hệ thống xác định quyền của actor trên Job.
4. Hệ thống xác nhận Recruiter được chọn:

   * là Recruiter;
   * thuộc cùng Company với Job;
   * đang đủ operational eligibility;
   * không phải Primary hiện tại;
   * chưa là Supporting của Job.
5. Recruiter chuyển từ `NONE` thành `SUPPORTING_RECRUITER`.

### Kết quả

* Recruitment Team có thêm Supporting Recruiter;
* Primary hiện tại không thay đổi;
* `createdBy` không thay đổi;
* Company của Job không thay đổi;
* nội dung Job không thay đổi;
* trạng thái Job không thay đổi.

### Trường hợp từ chối

Từ chối nếu:

* Job không effectively `PUBLISHED`;
* Job đã hết hạn;
* actor không có quyền;
* Recruiter thuộc Company khác;
* đối tượng không phải Recruiter;
* Recruiter không còn operational eligibility;
* Recruiter đang là Primary;
* Recruiter đã là Supporting;
* actor cố thêm Company Manager, Platform Admin hoặc Candidate vào Recruitment Team.

### Business Rules liên quan

* `BR-04`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-12`
* `BR-13`
* `BR-14`
* `BR-15`
* `BR-17`
* `BR-32`

### Không thuộc chức năng này

* promote Recruiter thành Primary;
* giao Application;
* giao Candidate;
* cấp custom permission cho Supporting.

---

## F03 — Xóa Supporting Recruiter

### Actor

* Company Manager;
* Primary Recruiter hiện tại.

### Mục tiêu

Cho phép Supporting Recruiter rời Recruitment Team khi không còn active responsibility cần chuyển giao.

### Tiền điều kiện

* Job đang effectively `PUBLISHED` trong normal flow;
* actor có quyền quản lý Supporting trên Job;
* Recruiter cần xóa hiện đang là Supporting.

### Luồng chính

1. Actor chọn Supporting cần xóa.
2. Hệ thống xác định quyền của actor.
3. Hệ thống xác định Supporting còn active responsibility chưa chuyển giao hay không.
4. Nếu còn responsibility, Supporting chưa được phép rời team.
5. Sau khi toàn bộ responsibility cần thiết đã được chuyển giao, Supporting chuyển:
   `SUPPORTING_RECRUITER → NONE`.

### Kết quả

* Recruiter không còn là Supporting của Job;
* Primary không thay đổi;
* `createdBy` không thay đổi;
* Company, nội dung và trạng thái Job không thay đổi;
* dữ liệu lịch sử đã phát sinh không bị xóa.

### Trường hợp từ chối

Từ chối nếu:

* actor không có quyền;
* Job không đáp ứng điều kiện normal team management;
* Recruiter không phải Supporting hiện tại;
* Recruiter vẫn còn responsibility chưa được chuyển giao.

### Business Rules liên quan

* `BR-12`
* `BR-13`
* `BR-14`
* `BR-15`
* `BR-18`
* `BR-32`

### Không thuộc chức năng này

V6 chưa xác định responsibility cụ thể từ:

* Application;
* Invitation;
* Chat;
* Interview.

Các version sở hữu các object đó phải bổ sung kiểm tra responsibility tương ứng.

---

## F04 — Thay Primary Recruiter

### Actor

* Company Manager.

### Mục tiêu

Chuyển responsibility chính của một Job từ Primary hiện tại sang một Supporting Recruiter hợp lệ.

### Tiền điều kiện

Trong normal flow:

* Job đang effectively `PUBLISHED`;
* actor là Company Manager của Company sở hữu Job;
* Primary mới đang là Supporting Recruiter của chính Job;
* Primary mới thỏa mãn operational eligibility.

### Luồng chính

1. Company Manager chọn Supporting cần trở thành Primary mới.
2. Hệ thống xác nhận Supporting đó hợp lệ và thuộc đúng Job.
3. Company Manager quyết định kết quả của Primary cũ:

   * giữ lại làm Supporting; hoặc
   * cho rời Recruitment Team.
4. Primary mới chuyển:
   `SUPPORTING_RECRUITER → PRIMARY_RECRUITER`.
5. Nếu giữ Primary cũ:
   `PRIMARY_RECRUITER → SUPPORTING_RECRUITER`.
6. Nếu Primary cũ rời team:

   * hệ thống phải xác nhận Primary cũ không còn responsibility chưa chuyển giao;
   * sau đó:
     `PRIMARY_RECRUITER → NONE`.
7. Sau operation, Job vẫn có đúng một Primary.

### Kết quả

* Primary mới trở thành người chịu trách nhiệm chính;
* Primary mới không còn đồng thời là Supporting;
* Primary cũ mất vị trí Primary;
* `createdBy` không thay đổi;
* Company không thay đổi;
* Job content không thay đổi;
* Job status không thay đổi.

### Trường hợp từ chối

Từ chối nếu:

* actor không phải Company Manager hợp lệ;
* Job không effectively `PUBLISHED` trong normal flow;
* Primary mới không phải Supporting hiện tại của Job;
* Primary mới không đủ operational eligibility;
* Primary mới thuộc Company khác;
* việc cho Primary cũ rời team sẽ để lại responsibility chưa chuyển giao.

### Business Rules liên quan

* `BR-02`
* `BR-04`
* `BR-06`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-12`
* `BR-13`
* `BR-19`
* `BR-20`
* `BR-21`
* `BR-22`

### Không thuộc chức năng này

* Primary tự chọn người kế nhiệm;
* Supporting tự promote;
* chọn trực tiếp Recruiter ngoài team làm Primary trong normal flow.

---

## F05 — Chuyển giao bắt buộc trước khi lock hoặc terminate Recruiter

### Actor

* Company Manager.

### Mục tiêu

Bảo đảm Recruiter không bị lock hoặc terminate trong khi vẫn giữ active responsibility trên Job chưa kết thúc.

### Tiền điều kiện

* Company Manager có quyền quản lý Recruiter;
* Recruiter đang được yêu cầu lock hoặc terminate.

### Luồng chính

1. Company Manager yêu cầu lock hoặc terminate Recruiter.
2. Hệ thống xác định các Job chưa kết thúc mà Recruiter đang tham gia.
3. Nhóm Job chưa kết thúc gồm:

   * `DRAFT`;
   * `PENDING_APPROVAL`;
   * `PUBLISHED` và chưa hết hạn.
4. Với từng Job mà Recruiter đang là Primary:

   * phải xác định Primary thay thế hợp lệ;
   * Primary mới phải là Supporting hợp lệ của Job;
   * nếu chưa có Supporting phù hợp, Company Manager được đưa một Recruiter hợp lệ cùng Company vào làm Supporting trong chính forced transfer flow;
   * Supporting mới được chuyển thành Primary;
   * Primary cũ chuyển thành `NONE`;
   * Primary cũ không được giữ lại làm Supporting.
5. Với từng Job mà Recruiter đang là Supporting:

   * xác định responsibility chưa chuyển giao;
   * chuyển giao responsibility nếu có;
   * Supporting chuyển thành `NONE`.
6. Hệ thống xác nhận Recruiter không còn active responsibility cần chuyển giao trên bất kỳ Job chưa kết thúc nào.
7. Sau đó lifecycle lock hoặc terminate mới được phép hoàn tất.

### Kết quả

Sau khi lock hoặc terminate hoàn tất:

* Recruiter không còn là Primary của bất kỳ Job chưa kết thúc nào;
* Recruiter không còn là Supporting của bất kỳ Job chưa kết thúc nào;
* các Job chưa kết thúc vẫn giữ đúng một Primary Recruiter hợp lệ;
* historical identity và dữ liệu nghiệp vụ đã phát sinh không bị xóa.

### Trường hợp từ chối

Nếu Recruiter đang là Primary của ít nhất một Job chưa kết thúc nhưng Company không có bất kỳ Recruiter hợp lệ nào có thể thay thế:

```text
lock/terminate
→ phải bị từ chối
```

Không được:

* để Job không có Primary;
* gán Company Manager làm Primary;
* chọn Recruiter không đủ eligibility;
* hoàn tất lock/terminate rồi để Recruiter đó tiếp tục là active Primary.

### Business Rules liên quan

* `BR-02`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-18`
* `BR-20`
* `BR-22`
* `BR-23`
* `BR-24`
* `BR-25`
* `BR-26`
* `BR-27`
* `BR-28`
* `BR-30`
* `BR-32`

### Không thuộc chức năng này

* định nghĩa Application responsibility;
* định nghĩa Invitation responsibility;
* assignment/reassignment Application;
* notification khi transfer;
* lưu audit history của từng lần transfer.

---

# 10. Business Rules

## BR-01 — Recruitment Team thuộc từng Job

Recruitment Team được xác định riêng cho từng Job.

Primary và Supporting không phải vị trí chung trên toàn Company.

---

## BR-02 — Mỗi Job luôn có đúng một Primary Recruiter

Một Job tồn tại không được rơi vào trạng thái:

* không có Primary Recruiter;
* có nhiều hơn một Primary Recruiter.

---

## BR-03 — Supporting Recruiter có cardinality 0..N

Một Job có thể:

* không có Supporting Recruiter;
* có một Supporting Recruiter;
* có nhiều Supporting Recruiter.

---

## BR-04 — Một Recruiter chỉ giữ một team position trên cùng Job

Trên cùng một Job, một Recruiter chỉ được là:

* `PRIMARY_RECRUITER`; hoặc
* `SUPPORTING_RECRUITER`; hoặc
* `NONE`.

Primary không được đồng thời nằm trong Supporting.

Một Supporting không được xuất hiện trùng lặp trên cùng Job.

---

## BR-05 — Primary và Supporting không phải Company-level role

Primary và Supporting chỉ biểu diễn responsibility theo từng Job.

Không tồn tại business requirement làm cho một Recruiter trở thành:

* Recruiter Leader;
* Senior Recruiter;
* Recruiter Manager;
* Recruiter có quyền cao hơn toàn bộ Recruiter khác trên Company

chỉ vì đang là Primary của một hoặc nhiều Job.

---

## BR-06 — `createdBy` độc lập với Primary hiện tại

`createdBy` biểu diễn người tạo Job trong lịch sử.

Primary Recruiter biểu diễn người chịu trách nhiệm chính hiện tại.

Thay Primary không làm thay đổi `createdBy`.

---

## BR-07 — Người tạo Job là Primary mặc định

Khi Recruiter tạo Job, Recruiter đó trở thành Primary mặc định.

Đây là ngoại lệ duy nhất đối với quy tắc Primary mới phải đang là Supporting.

---

## BR-08 — Eligibility là operational eligibility

Một Recruiter phải đủ operational eligibility khi:

* được thêm vào active Recruitment Team;
* được chuyển thành Primary;
* nhận responsibility mới;
* tiếp tục active responsibility trên Job chưa kết thúc.

Quy tắc này không được hiểu thành yêu cầu phải xóa mọi historical association khi Recruiter sau đó không còn ACTIVE.

---

## BR-09 — Recruiter trong team phải cùng Company với Job

Primary và Supporting của Job phải thuộc Company sở hữu Job.

Không được tạo Recruitment Team cross-tenant.

---

## BR-10 — Điều kiện operational eligibility

Recruiter được giao hoặc tiếp tục active responsibility phải đồng thời thỏa mãn:

* identity Recruiter hợp lệ;
* Company membership hợp lệ;
* có role Recruiter;
* User đang ở trạng thái cho phép hoạt động;
* Company membership đang ở trạng thái cho phép hoạt động;
* không bị khóa;
* chưa bị chấm dứt quyền truy cập;
* đã hoàn thành mandatory password change;
* thuộc cùng Company với Job;
* Company sở hữu Job đã được phê duyệt và đang ở trạng thái hoạt động hợp lệ.

---

## BR-11 — Ineligibility về sau không làm mất giá trị lịch sử của Job đã kết thúc

Nếu Recruiter sau này bị khóa hoặc chấm dứt:

* dữ liệu Job lịch sử không vì vậy trở thành không hợp lệ;
* V6 không yêu cầu xóa historical identity hoặc historical team information khỏi Job đã kết thúc.

Việc biểu diễn historical information cụ thể thuộc Data Contract.

---

## BR-12 — Normal team management chỉ áp dụng trên Job effectively PUBLISHED

Các thao tác normal team management chỉ được thực hiện khi Job:

```text
status = PUBLISHED
AND
current time < applicationDeadline
```

---

## BR-13 — Deadline quyết định effective expiration

Persisted `PUBLISHED` không đủ để tiếp tục normal team management.

Nếu:

```text
current time >= applicationDeadline
```

Job phải được xử lý như đã `EXPIRED` đối với các nghiệp vụ V6.

---

## BR-14 — Quyền của Company Manager

Company Manager của Company sở hữu Job được:

* xem Recruitment Team;
* thêm Supporting;
* xóa Supporting khi hợp lệ;
* thay Primary;
* quyết định Primary cũ ở lại Supporting hay rời team;
* thực hiện forced transfer trước lock/terminate.

Company Manager không trở thành Primary hoặc Supporting chỉ vì có quyền quản lý team.

---

## BR-15 — Quyền của Primary Recruiter

Primary Recruiter được:

* xem Recruitment Team của Job mình đang là Primary;
* thêm Supporting hợp lệ;
* xóa Supporting hợp lệ.

Primary không được:

* tự thay mình;
* promote Supporting thành Primary;
* tự chọn Primary kế nhiệm.

---

## BR-16 — Supporting có quyền xem team nhưng không quản lý team

Supporting Recruiter được xem:

* Primary hiện tại;
* các Supporting Recruiter khác

của Job mình đang tham gia.

Supporting không được:

* thêm Supporting;
* xóa Supporting;
* thay Primary;
* tự promote;
* tự thay đổi vị trí của mình.

---

## BR-17 — Điều kiện thêm Supporting

Một Recruiter chỉ được thêm làm Supporting khi:

* Job đáp ứng điều kiện normal team management;
* actor có quyền;
* Recruiter thỏa operational eligibility;
* Recruiter cùng Company;
* Recruiter chưa phải Primary;
* Recruiter chưa là Supporting.

---

## BR-18 — Không được cho thành viên rời team khi còn responsibility chưa chuyển giao

Một Primary hoặc Supporting chỉ được chuyển sang `NONE` sau khi toàn bộ active responsibility cần thiết đã được chuyển giao.

V6 chưa định nghĩa responsibility cụ thể của Application hoặc Invitation.

---

## BR-19 — Chỉ Company Manager được thay Primary

Primary hiện tại không được tự thay mình.

Supporting không được tự promote thành Primary.

---

## BR-20 — Primary mới phải đang là Supporting

Trong việc thay Primary sau khi Job đã được tạo, Primary mới phải đang là Supporting Recruiter của chính Job đó.

Normal flow không cho phép:

```text
NONE → PRIMARY_RECRUITER
```

trực tiếp.

---

## BR-21 — Primary cũ phải có kết quả xác định khi thay Primary

Khi Primary mới được xác lập, Primary cũ phải đồng thời:

* trở thành Supporting; hoặc
* rời Recruitment Team.

Không được để Primary cũ tiếp tục là Primary.

---

## BR-22 — Thay Primary là một business operation thống nhất

Trong quá trình thay Primary không được xuất hiện kết quả nghiệp vụ quan sát được khiến Job:

* không có Primary; hoặc
* có nhiều Primary.

Sau operation phải có đúng một Primary.

---

## BR-23 — Chuyển giao phải hoàn tất trước lock/terminate

Recruiter không được hoàn tất chuyển sang `LOCKED` hoặc `TERMINATED` nếu vẫn còn active responsibility trên Job chưa kết thúc.

---

## BR-24 — Định nghĩa Job chưa kết thúc cho forced transfer

Trong V6, Job chưa kết thúc gồm:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `PUBLISHED` và chưa hết application deadline.

Không gồm:

* `CLOSED`;
* `EXPIRED`;
* Job đã bị reject và xóa.

---

## BR-25 — Forced transfer là ngoại lệ đối với normal team management

Trong forced transfer trước lock/terminate, Company Manager được thực hiện các bước cần thiết để tạo replacement trên:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `PUBLISHED` chưa hết hạn.

Nếu Job chưa có Supporting phù hợp:

```text
Recruiter hợp lệ
NONE
↓
SUPPORTING_RECRUITER
↓
PRIMARY_RECRUITER
```

được phép trong chính forced transfer flow.

Quy tắc này không mở quyền normal team management trên `DRAFT` hoặc `PENDING_APPROVAL`.

---

## BR-26 — Primary sắp bị lock/terminate phải rời active team

Khi forced transfer phục vụ lock hoặc terminate:

```text
Primary cũ
PRIMARY_RECRUITER
→
NONE
```

Primary cũ không được giữ lại làm Supporting.

---

## BR-27 — Không có replacement thì không được lock/terminate Primary

Nếu Recruiter đang là Primary của Job chưa kết thúc và Company không có Recruiter hợp lệ để thay thế, yêu cầu lock hoặc terminate phải bị từ chối.

Invariant "mỗi Job có đúng một Primary" không được phá để hoàn tất account lifecycle.

---

## BR-28 — Supporting sắp bị lock/terminate phải rời active team

Với mỗi Job chưa kết thúc nơi Recruiter đang là Supporting:

1. responsibility chưa chuyển giao phải được xử lý;
2. Recruiter phải rời vị trí Supporting;
3. sau đó mới được hoàn tất lock hoặc terminate.

---

## BR-29 — Unlock không tự động khôi phục Recruitment Team

Khi Recruiter được unlock:

* các team position trước lock không tự động được restore;
* Primary mới được xác lập trong forced transfer tiếp tục là Primary;
* Recruiter vừa unlock tiếp tục ở `NONE` trên các Job mà mình đã rời.

Recruiter chỉ trở lại Recruitment Team khi được thêm lại theo các rule nghiệp vụ hiện hành.

Unlock khôi phục khả năng được giao responsibility, không khôi phục responsibility cũ.

---

## BR-30 — Job đã kết thúc không nhận responsibility mới

`CLOSED` và `EXPIRED` không được:

* thêm Supporting mới;
* thay Primary theo normal team management;
* nhận responsibility mới.

Các Job này không thuộc nhóm active team cần forced transfer khi Recruiter sau đó bị lock hoặc terminate.

---

## BR-31 — Supporting không thừa hưởng quyền Job của Primary

Việc trở thành Supporting không mặc nhiên trao các quyền của Primary đã được V5 xác định.

Supporting không mặc nhiên được:

* chỉnh sửa Job;
* submit Job;
* approve;
* reject;
* publish;
* close;
* delete Job;
* thay Primary.

V6 không thay đổi authorization của Job lifecycle từ V5.

---

## BR-32 — Recruitment Team và dữ liệu tuyển dụng thuộc Company

Job và Recruitment Team thuộc Company sở hữu Job.

Khi Recruiter:

* rời team;
* bị lock;
* bị terminate

không được vì vậy làm mất:

* Job;
* người tạo Job;
* dữ liệu lịch sử;
* dữ liệu tuyển dụng đã phát sinh thuộc Company.

---

## BR-33 — Responsibility của version sau phải bị giới hạn bởi Recruitment Team

Khi các version sau bổ sung responsibility cụ thể thuộc một Job, responsibility đó chỉ được giao cho Recruiter hợp lệ đang là:

* Primary Recruiter; hoặc
* Supporting Recruiter

của chính Job đó.

V6 không định nghĩa loại responsibility cụ thể hoặc workflow assignment của các version sau.

---

# 11. State Transitions

## 11.1. Recruitment Team position transitions

| Hành động                               | Trước                  | Sau                    | Actor             |
| --------------------------------------- | ---------------------- | ---------------------- | ----------------- |
| Tạo Job                                 | `NONE`                 | `PRIMARY_RECRUITER`    | Recruiter tạo Job |
| Thêm Supporting                         | `NONE`                 | `SUPPORTING_RECRUITER` | CM hoặc Primary   |
| Xóa Supporting                          | `SUPPORTING_RECRUITER` | `NONE`                 | CM hoặc Primary   |
| Promote thành Primary                   | `SUPPORTING_RECRUITER` | `PRIMARY_RECRUITER`    | CM                |
| Giữ Primary cũ                          | `PRIMARY_RECRUITER`    | `SUPPORTING_RECRUITER` | CM                |
| Cho Primary cũ rời team                 | `PRIMARY_RECRUITER`    | `NONE`                 | CM                |
| Forced transfer replacement preparation | `NONE`                 | `SUPPORTING_RECRUITER` | CM                |
| Forced transfer promote replacement     | `SUPPORTING_RECRUITER` | `PRIMARY_RECRUITER`    | CM                |
| Forced transfer Primary cũ              | `PRIMARY_RECRUITER`    | `NONE`                 | CM                |
| Forced transfer Supporting              | `SUPPORTING_RECRUITER` | `NONE`                 | CM                |

Transition:

```text
NONE → PRIMARY_RECRUITER
```

chỉ được trực tiếp xảy ra khi người tạo Job trở thành Primary mặc định.

Trong mọi replacement sau đó, Primary mới phải đi qua `SUPPORTING_RECRUITER`.

---

## 11.2. Unlock

Unlock không tạo Recruitment Team transition tự động.

```text
LOCKED Recruiter
→ được unlock
→ team position giữ nguyên trạng thái sau forced transfer
```

Không có transition tự động:

```text
NONE → vị trí trước khi lock
```

---

## 11.3. Job state

Các team operation của V6 không tự thay đổi Job lifecycle state.

V6 không bổ sung Job state transition mới.

---

# 12. Authorization và ownership boundary

| Hành động                            | Actor được phép | Resource / Scope                    | Điều kiện                               |
| ------------------------------------ | --------------- | ----------------------------------- | --------------------------------------- |
| Xem Recruitment Team                 | Company Manager | Job thuộc Company mình              | Quan hệ Company hợp lệ                  |
| Xem Recruitment Team                 | Primary         | Job mình đang là Primary            | Primary hiện tại                        |
| Xem Recruitment Team                 | Supporting      | Job mình đang Supporting            | Read-only                               |
| Thêm Supporting                      | Company Manager | Job thuộc Company mình              | Normal eligibility                      |
| Thêm Supporting                      | Primary         | Job mình đang Primary               | Normal eligibility                      |
| Xóa Supporting                       | Company Manager | Job thuộc Company mình              | Không còn responsibility chưa transfer  |
| Xóa Supporting                       | Primary         | Job mình đang Primary               | Không còn responsibility chưa transfer  |
| Thay Primary                         | Company Manager | Job thuộc Company mình              | Primary mới đang Supporting và eligible |
| Forced transfer trước lock/terminate | Company Manager | Recruiter và Job thuộc Company mình | Phải giữ toàn bộ invariant V6           |
| Tự thay Primary                      | Primary         | —                                   | Không được phép                         |
| Quản lý team                         | Supporting      | —                                   | Không được phép                         |

Authorization phải được xác định từ quan hệ nghiệp vụ đáng tin cậy.

Identifier do client cung cấp không tự chứng minh:

* Company ownership;
* Recruiter membership;
* Primary position;
* Supporting position;
* quyền quản lý team.

V6 không trao quyền Recruitment Team cho Platform Admin hoặc Candidate.

---

# 13. Multi-tenant boundary

Trong V6, **Company là tenant boundary của Recruitment Team**.

Luồng xác định scope nghiệp vụ:

```text
Authenticated actor
        ↓
Quan hệ Company hợp lệ của actor
        ↓
Company sở hữu Job
        ↓
Recruitment Team của Job
```

Các nguyên tắc:

1. Mỗi Job thuộc một Company.
2. Recruitment Team của Job chỉ chứa Recruiter thuộc cùng Company với Job.
3. Company Manager chỉ quản lý Recruitment Team của Job thuộc Company mình.
4. Primary chỉ quản lý Supporting của Job mà mình đang là Primary.
5. Supporting chỉ có quyền read-only trên team của Job mình đang tham gia.
6. Recruiter của Company A không được trở thành Primary hoặc Supporting của Job thuộc Company B.
7. Company identity hoặc ownership do client gửi lên không tự tạo authorization.
8. Việc chuyển Primary không làm thay đổi Company sở hữu Job.
9. Recruiter rời team không làm thay đổi ownership của dữ liệu tuyển dụng.

Cross-tenant Recruitment Team bị cấm.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng trong toàn bộ V6:

1. Mỗi Job có đúng một Primary Recruiter.
2. Một Job có từ 0 đến nhiều Supporting Recruiter.
3. Primary và Supporting là responsibility theo từng Job.
4. Primary và Supporting không phải role cố định của User hoặc Company membership.
5. Một Recruiter có thể có responsibility khác nhau trên các Job khác nhau.
6. Một Recruiter không được đồng thời là Primary và Supporting của cùng Job.
7. Supporting không được trùng lặp trên cùng Job.
8. Người tạo Job là Primary mặc định khi Job được tạo.
9. `createdBy` không thay đổi khi Primary thay đổi.
10. Primary mới trong replacement phải đang là Supporting của Job.
11. Primary mới phải rời vị trí Supporting khi trở thành Primary.
12. Sau replacement, Primary cũ phải trở thành Supporting hoặc `NONE`.
13. Không được để Job không có Primary.
14. Không được để Job có nhiều Primary.
15. Thành viên nhận hoặc tiếp tục active responsibility phải đủ operational eligibility.
16. Active Recruitment Team không được chứa Recruiter cross-tenant.
17. Normal team management chỉ được thực hiện trên Job effectively `PUBLISHED`.
18. Job persisted `PUBLISHED` nhưng đã tới deadline phải được xử lý như `EXPIRED`.
19. Không được cho thành viên rời team khi còn responsibility chưa chuyển giao.
20. Recruiter sắp bị lock hoặc terminate phải được xử lý active responsibility trước.
21. Forced transfer áp dụng cho mọi Job chưa kết thúc.
22. Primary sắp bị lock hoặc terminate không được giữ lại làm Supporting.
23. Supporting sắp bị lock hoặc terminate không được tiếp tục thuộc active team.
24. Không có Primary replacement hợp lệ thì không được hoàn tất lock/terminate.
25. Unlock không tự restore các team position trước đó.
26. `CLOSED` và `EXPIRED` không nhận responsibility mới.
27. Ineligibility phát sinh sau khi Job kết thúc không làm mất giá trị lịch sử của Job.
28. Rời team, lock hoặc terminate Recruiter không được xóa Job hoặc dữ liệu lịch sử thuộc Company.
29. Supporting không tự động nhận các quyền Job lifecycle của Primary.
30. V6 không thay đổi Job lifecycle của V5.
31. Các version sau chỉ được giao responsibility thuộc Job cho Primary hoặc Supporting hợp lệ của đúng Job.

Các invariant này phải được giữ sau mọi state transition hợp lệ, không chỉ trên happy path.

---

# 15. Các quyết định chủ động defer

Các nội dung đã được xem xét nhưng chủ động không thuộc V6:

* Application;
* Application Assignment;
* Application reassignment;
* Assignment History;
* Application Pipeline;
* CV snapshot;
* Candidate Search;
* Job Invitation;
* Invitation lifecycle;
* Source Recruiter;
* sourcing credit;
* Chat;
* Conversation;
* Interview Schedule;
* Notification;
* workload tracking;
* quyền xử lý Candidate cụ thể;
* định nghĩa cụ thể responsibility phát sinh từ Application;
* định nghĩa cụ thể responsibility phát sinh từ Invitation;
* custom permission riêng cho từng Supporting Recruiter;
* tự động restore team position sau unlock;
* tự động phân phối workload;
* Recruitment Team audit/history như một product feature;
* notification hoặc email khi team thay đổi.

Các version sau có thể bổ sung các nội dung trên nhưng phải tuân thủ invariant của V6.

Không được tự implement các nội dung đã defer trong V6.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V6.

Các quyết định về persistence, data structure, transaction strategy, index, API hoặc code organization không thuộc Product Specification và được quyết định ở các bước canonical tiếp theo.

---

# 17. Definition of Business Completion

V6 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — xem Recruitment Team đã được đáp ứng;
* `F02` — thêm Supporting Recruiter đã được đáp ứng;
* `F03` — xóa Supporting Recruiter đã được đáp ứng;
* `F04` — thay Primary Recruiter đã được đáp ứng;
* `F05` — forced transfer trước lock/terminate đã được đáp ứng;
* toàn bộ `BR-01` đến `BR-33` được giữ;
* mỗi Job luôn có đúng một Primary;
* không tồn tại Recruiter vừa Primary vừa Supporting trên cùng Job;
* normal team management chỉ hoạt động trên Job effectively `PUBLISHED`;
* Company Manager, Primary và Supporting chỉ có đúng quyền đã được định nghĩa;
* cross-tenant Recruitment Team bị ngăn chặn;
* Recruiter không được rời active team khi vẫn còn responsibility chưa transfer;
* Recruiter không được lock/terminate trong khi vẫn giữ active responsibility;
* lock/terminate bị từ chối khi không thể bảo đảm Primary replacement;
* unlock không tự restore responsibility cũ;
* Job `CLOSED` hoặc `EXPIRED` không nhận responsibility mới;
* V5 Job lifecycle và Job authorization không bị thay đổi;
* các chức năng đã defer không bị implementation ngoài ý muốn;
* không xuất hiện behavior ngoài boundary của V6.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification của V6**.

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
* persistence structure;
* MongoDB/Mongoose implementation;
* collection hoặc embedded structure;
* index;
* transaction implementation;
* concurrency mechanism cụ thể;
* source-code structure;
* test framework.

Các quyết định đó thuộc các tầng canonical tiếp theo:

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

Nếu implementation hoặc data design mâu thuẫn với tài liệu này, **Product Specification V6 là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
