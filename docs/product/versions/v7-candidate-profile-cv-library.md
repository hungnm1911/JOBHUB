Dưới đây là nội dung đã chuẩn hóa theo đúng cấu trúc **Canonical Product Specification** trong template bạn cung cấp: Product Spec chỉ định nghĩa business/functional truth và tách khỏi persistence/implementation.  Tôi dùng kết quả phân tích V7 trước đó làm nền cho Generated CV, Uploaded CV, ownership, archive/default và boundary với các version sau.    Những ambiguity trong tài liệu thô được thay bằng các business decision bạn vừa chốt.

---

# V7 — Candidate Profile và thư viện CV

> **File:** `docs/product/versions/v7-candidate-profile-cv-library.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V7 — Candidate Profile và thư viện CV.

---

## 1. Mục tiêu

V7 bổ sung khu vực dành cho Candidate để:

* quản lý thông tin Candidate Profile dựa trên thông tin cá nhân đã tồn tại của tài khoản;
* xây dựng và quản lý thư viện nhiều CV;
* tạo CV có cấu trúc bằng một Harvard Template cố định;
* upload CV PDF đã có;
* quản lý metadata, visibility, trạng thái hoàn thiện, CV mặc định, preview, download và archive;
* chuẩn bị Candidate CV làm nguồn dữ liệu độc lập cho các nghiệp vụ Application, Candidate Search và Job Invitation ở các version sau.

Sau V7, hệ thống phải xác định được:

```text
Candidate
├── Candidate Profile
└── My CVs
    └── 0..N Candidate CV
        ├── GENERATED
        └── UPLOADED
```

V7 chỉ quản lý **live Candidate CV trong thư viện của Candidate**.

V7 chưa triển khai Application, submitted CV snapshot, Candidate Search, Job Invitation hoặc quyền Recruiter sử dụng CV.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V7 bao gồm:

* Candidate xem và cập nhật Profile của chính mình bằng các thông tin cá nhân đã tồn tại;
* Candidate quản lý `0..N` CV trong My CVs;
* một Candidate CV có source type `GENERATED` hoặc `UPLOADED`;
* Generated CV sử dụng Harvard Builder với một template cố định;
* Generated CV có lifecycle `DRAFT` và `ACTIVE`;
* kiểm tra completeness của Generated CV;
* Candidate chủ động quyết định chuyển Generated CV từ `DRAFT` sang `ACTIVE`;
* Generated CV có thể quay lại `DRAFT` khi nội dung được lưu không còn đáp ứng completeness;
* Uploaded CV sử dụng PDF được Candidate cung cấp;
* kiểm tra điều kiện của Uploaded PDF;
* thay thế file của Uploaded CV;
* metadata chung cho Candidate CV;
* `PRIVATE` / `PUBLIC` visibility;
* preview CV;
* download CV khi đủ điều kiện;
* rename CV;
* đặt, thay đổi hoặc bỏ CV mặc định;
* archive CV khỏi thư viện;
* ownership và access boundary của Candidate CV.

### 2.2. Ngoài phạm vi

V7 không triển khai:

* Find Jobs;
* Saved Jobs;
* Direct Apply Job;
* Application;
* CV snapshot trong Application;
* Replace Submitted CV;
* Withdraw Application;
* My Applications;
* Candidate Search;
* Recruiter tìm hoặc xem CV `PUBLIC`;
* Job Invitation;
* Invitation snapshot;
* Accept hoặc Reject Invitation;
* Source Recruiter;
* Assigned Recruiter;
* Chat;
* Conversation;
* Interview Schedule;
* Notification;
* theo dõi hoặc thống kê lượt xem CV;
* public Internet CV link;
* Job recommendation dựa trên CV;
* CV version history;
* Uploaded file history;
* Duplicate CV;
* Restore CV đã archive;
* Hard delete CV;
* tự động đồng bộ Profile sang CV;
* nhiều Harvard Template;
* CV Builder dạng Canva hoặc trình soạn thảo tài liệu tự do;
* AI tự viết toàn bộ CV.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

### 3.1. V1 — Account và Authentication

V7 reuse Candidate identity và các thông tin cá nhân đã tồn tại trên tài khoản.

V7 không thay đổi:

* User role;
* account lifecycle;
* email verification;
* password lifecycle;
* session lifecycle;
* token lifecycle;
* lock/terminate behavior.

Candidate Profile của V7 không tạo một hệ thống Candidate identity riêng thay thế User.

### 3.2. V4 — Platform Standard Catalogs

V7 reuse các catalog chuẩn:

* Category;
* Location;
* ExperienceLevel;
* EmploymentType;
* WorkMode.

Category của CV có thể chọn một Category ở level:

```text
FIELD
hoặc
POSITION
```

Candidate không tự tạo Category và không nhập Category tự do.

`REMOTE` thuộc WorkMode theo V4, không phải Location.

V4 không có nghiệp vụ deactivate các catalog này; V7 không bổ sung lifecycle deactivate riêng cho catalog.

### 3.3. Company, Job và Recruitment Team

Candidate CV thuộc Candidate, không thuộc Company.

V7 không thay đổi:

* Company;
* Company Manager;
* Company Member;
* Recruiter lifecycle;
* Job lifecycle;
* Job ownership;
* Primary Recruiter;
* Supporting Recruiter;
* Recruitment Team;
* transfer responsibility.

V7 không trao thêm quyền trên Candidate CV cho Recruiter chỉ vì Recruiter đang tham gia một Recruitment Team.

Các invariant đã chốt ở các version trước tiếp tục được giữ nguyên trừ khi V7 ghi rõ khác.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Candidate

Người dùng sở hữu Candidate Profile và thư viện Candidate CV của chính mình.

Candidate là actor trực tiếp của các chức năng V7.

### 4.2. Candidate Profile

Khu vực hiển thị và cho phép Candidate quản lý các thông tin cá nhân đã tồn tại trên tài khoản.

V7 không bổ sung business field mới cho Candidate Profile.

Candidate Profile và Candidate CV là hai phạm vi nội dung độc lập.

### 4.3. My CVs

Thư viện quản lý toàn bộ Candidate CV còn hoạt động của Candidate.

Một Candidate có thể có:

```text
0..N Candidate CV
```

### 4.4. Candidate CV

Khái niệm nghiệp vụ chung đại diện cho một CV trong thư viện Candidate.

Candidate CV có đúng một source type:

```text
GENERATED
UPLOADED
```

### 4.5. Generated CV

Candidate CV được Candidate xây dựng bằng Harvard Builder của hệ thống.

Nội dung CV được tổ chức theo các section có cấu trúc.

### 4.6. Uploaded CV

Candidate CV sử dụng một file PDF đã được tạo bằng công cụ bên ngoài và được Candidate upload vào hệ thống.

Uploaded CV không được chỉnh sửa bằng Harvard Builder.

### 4.7. Harvard Builder

Công cụ xây Generated CV theo một Harvard Template cố định.

Builder là form nội dung có cấu trúc, không phải trình thiết kế tài liệu tự do.

### 4.8. Visibility

Ý định chia sẻ của Candidate đối với một CV:

```text
PRIVATE
PUBLIC
```

`PUBLIC` không đồng nghĩa với công khai trên Internet.

### 4.9. Default CV

Một Candidate CV được Candidate chủ động chọn làm CV mặc định.

Candidate không bắt buộc phải có Default CV.

### 4.10. Archived CV

CV đã được Candidate loại khỏi thư viện hoạt động.

Archive là terminal behavior của CV trong V7; V7 không hỗ trợ Restore hoặc Hard Delete.

---

## 5. Quan hệ nghiệp vụ chính

```text
Candidate
│
├── Candidate Profile
│
└── 0..N Candidate CV
        │
        ├── GENERATED
        │     └── Harvard structured content
        │
        └── UPLOADED
              └── Current valid PDF
```

Các quan hệ nghiệp vụ:

* một Candidate chỉ quản lý Profile của chính mình;
* một Candidate sở hữu `0..N` Candidate CV;
* mỗi Candidate CV thuộc đúng một Candidate;
* mỗi Candidate CV có đúng một source type;
* `sourceType` không thay đổi trong lifecycle của CV;
* Generated CV và Uploaded CV dùng chung các metadata của Candidate CV;
* nội dung CV và metadata CV là hai phạm vi độc lập;
* Candidate Profile và nội dung CV là hai phạm vi độc lập;
* Candidate có tối đa một Default CV tại một thời điểm.

Không có quan hệ ownership giữa Candidate CV và Company.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Candidate CV source type

Các loại:

* `GENERATED`
* `UPLOADED`

| Source type | Ý nghĩa                                               |
| ----------- | ----------------------------------------------------- |
| `GENERATED` | Nội dung được Candidate xây dựng bằng Harvard Builder |
| `UPLOADED`  | Nội dung chính là PDF hợp lệ do Candidate upload      |

Source type là bất biến sau khi CV được tạo.

---

### 6.2. Generated CV lifecycle

Generated CV có hai trạng thái:

* `DRAFT`
* `ACTIVE`

| Trạng thái | Ý nghĩa                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------- |
| `DRAFT`    | CV đang được Candidate xây dựng hoặc hiện không đáp ứng completeness để giữ trạng thái hoàn thiện |
| `ACTIVE`   | CV đã đáp ứng completeness và Candidate đã chủ động hoàn tất việc tạo CV                          |

`DRAFT` không tự động chuyển sang `ACTIVE` chỉ vì nội dung đã đầy đủ.

Candidate phải chủ động thực hiện quyết định hoàn tất CV.

Uploaded CV không sử dụng Draft lifecycle của Harvard Builder.

---

### 6.3. Visibility

Mỗi Candidate CV có:

* `PRIVATE`
* `PUBLIC`

| Visibility | Ý nghĩa                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `PRIVATE`  | Candidate không đồng ý cho CV tham gia Candidate Search trong tương lai                                                            |
| `PUBLIC`   | Candidate đồng ý để CV có thể trở thành eligible input cho Candidate Search ở version sau khi các điều kiện khác cũng được đáp ứng |

`PUBLIC` không có nghĩa:

* public Internet;
* public URL;
* anonymous access;
* mọi Company được xem;
* Recruiter trong V7 được tìm CV.

Generated CV `DRAFT` có thể lưu visibility `PUBLIC`, nhưng `PUBLIC` chưa có hiệu lực trong khi CV vẫn là `DRAFT`.

---

### 6.4. Archive condition

Candidate CV có thể:

```text
CV còn trong My CVs hoạt động
        ↓ Archive
CV đã archive
```

CV đã archive không quay lại thư viện trong V7.

---

### 6.5. Default condition

Candidate có thể ở một trong hai trạng thái nghiệp vụ:

```text
Default CV = NONE
```

hoặc:

```text
Default CV = một Candidate CV hợp lệ
```

Tại một thời điểm không được có nhiều hơn một Default CV.

---

## 7. Tổ hợp trạng thái hợp lệ

| Source                      | Lifecycle                       | Visibility | Archive      | Default       |
| --------------------------- | ------------------------------- | ---------- | ------------ | ------------- |
| `GENERATED`                 | `DRAFT`                         | `PRIVATE`  | Chưa archive | Không         |
| `GENERATED`                 | `DRAFT`                         | `PUBLIC`   | Chưa archive | Không         |
| `GENERATED`                 | `ACTIVE`                        | `PRIVATE`  | Chưa archive | Có hoặc không |
| `GENERATED`                 | `ACTIVE`                        | `PUBLIC`   | Chưa archive | Có hoặc không |
| `UPLOADED`                  | Không sử dụng Draft lifecycle   | `PRIVATE`  | Chưa archive | Có hoặc không |
| `UPLOADED`                  | Không sử dụng Draft lifecycle   | `PUBLIC`   | Chưa archive | Có hoặc không |
| `GENERATED` hoặc `UPLOADED` | Giữ thông tin lifecycle hiện có | Bất kỳ     | Đã archive   | Không         |

Các nguyên tắc:

* Generated `DRAFT` không được Default;
* Generated `DRAFT + PUBLIC` chỉ lưu visibility intent, không có effective-public behavior;
* Archived CV không được Default;
* Archived CV không còn usable cho nghiệp vụ mới;
* Uploaded CV chỉ xuất hiện trong thư viện sau khi file và metadata bắt buộc đã hợp lệ.

---

## 8. Quy trình nghiệp vụ tổng thể

### 8.1. Candidate Profile

```text
Candidate đăng nhập
        ↓
Xem Profile của chính mình
        ↓
Cập nhật thông tin cá nhân đã có
        ↓
Profile được cập nhật
```

Việc này không tự động thay đổi bất kỳ Candidate CV nào.

### 8.2. Generated CV

```text
Candidate chọn tạo Generated CV
        ↓
Nhập name + visibility + category
        ↓
Generated CV được tạo ở DRAFT
        ↓
Candidate nhập/chỉnh sửa nội dung
        ↓
Hệ thống đánh giá completeness
        ↓
┌─────────────────────┐
│ Chưa đủ completeness│
│ → tiếp tục DRAFT    │
└─────────────────────┘

┌─────────────────────┐
│ Đủ completeness     │
│ → có thể hoàn tất CV│
└─────────────────────┘
        ↓
Candidate chủ động chọn hoàn tất
        ↓
ACTIVE
```

Nếu Candidate chỉnh sửa một Generated CV `ACTIVE` và lưu nội dung khiến CV không còn đạt completeness:

```text
ACTIVE
  ↓
Nội dung không còn complete
  ↓
Candidate lưu thay đổi
  ↓
DRAFT
```

Sau đó CV tiếp tục theo lại vòng kiểm tra completeness trước khi có thể được Candidate chủ động đưa về `ACTIVE`.

### 8.3. Uploaded CV

```text
Candidate chọn Upload CV
        ↓
Chọn PDF
        ↓
PDF được kiểm tra
        ↓
Nhập metadata bắt buộc
        ↓
Thông tin hợp lệ
        ↓
CV được đưa vào My CVs
```

Không có Uploaded Draft workflow.

### 8.4. Quản lý CV

```text
Candidate CV
    ↓
rename / metadata / visibility
    ↓
preview / download khi đủ điều kiện
    ↓
set/unset default khi đủ điều kiện
    ↓
archive khi Candidate không muốn tiếp tục sử dụng
```

---

# 9. Functional Requirements

## F01 — Quản lý Candidate Profile

### Actor

* Candidate.

### Mục tiêu

Candidate xem và cập nhật thông tin cá nhân của chính mình mà không tạo một hồ sơ Candidate độc lập cạnh tranh với account identity đã có.

### Tiền điều kiện

* Actor là Candidate hợp lệ theo account/authentication lifecycle đã tồn tại.

### Luồng chính

1. Candidate truy cập Candidate Profile của chính mình.
2. Hệ thống cung cấp các thông tin cá nhân đã tồn tại cho Candidate.
3. Candidate chỉnh sửa các thông tin được phép cập nhật.
4. Thay đổi được áp dụng vào Candidate Profile.

### Phạm vi field của Candidate Profile

V7 reuse các field đã tồn tại trên User theo matrix sau:

| Field | Candidate được xem | Candidate được cập nhật trong F01 |
| --- | --- | --- |
| `fullName` | Có | Có |
| `avatarUrl` | Có | Có |
| `dateOfBirth` | Có | Có |
| `phoneNumber` | Có | Có |
| `email` | Có | Không |

`email` là account/login identity đã được V1 quản lý. F01 không tạo email-change
hoặc email-reverification lifecycle mới.

Các account/authentication field như `role`, `status`, `passwordHash`,
`emailVerifiedAt`, `mustChangePassword`, session và token data không phải
Candidate Profile-editable fields của F01.

### Kết quả

* Profile của Candidate được cập nhật.
* Candidate CV không tự động bị thay đổi.

### Trường hợp từ chối

* Candidate cố truy cập hoặc cập nhật Profile của Candidate khác.
* Actor không có quyền Candidate tương ứng.
* Candidate cố cập nhật `email` hoặc account/authentication field thông qua F01.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`

### Không thuộc chức năng này

* thêm Candidate Profile field mới;
* thay đổi email hoặc email-verification lifecycle;
* thay đổi role, account status, password, session hoặc token lifecycle;
* tự động copy Profile sang CV;
* tự động cập nhật CV khi Profile thay đổi.

---

## F02 — Quản lý thư viện My CVs

### Actor

* Candidate.

### Mục tiêu

Candidate quản lý tập hợp CV thuộc sở hữu của chính mình.

### Tiền điều kiện

* Actor là Candidate hợp lệ.

### Luồng chính

1. Candidate truy cập My CVs.
2. Hệ thống xác định các CV còn trong thư viện hoạt động của Candidate.
3. Candidate xem các CV và thông tin quản lý cần thiết của từng CV.
4. Candidate lựa chọn các chức năng phù hợp với loại và trạng thái của CV.

### Kết quả

Candidate có thể quản lý `0..N` Candidate CV của chính mình.

### Trường hợp từ chối

* Candidate cố truy cập CV thuộc Candidate khác.
* CV đã archive được sử dụng như CV còn hoạt động.

### Business Rules liên quan

* `BR-04`
* `BR-05`
* `BR-06`
* `BR-07`
* `BR-08`

### Không thuộc chức năng này

* xem thư viện CV của Candidate khác;
* Duplicate CV;
* Restore archived CV.

---

## F03 — Khởi tạo Generated CV Draft

### Actor

* Candidate.

### Mục tiêu

Candidate tạo một CV mới bằng Harvard Builder và có thể lưu tiến độ trước khi CV hoàn thiện.

### Tiền điều kiện

* Actor là Candidate hợp lệ.

### Luồng chính

1. Candidate chọn tạo Generated CV.
2. Candidate cung cấp tên CV.
3. Candidate chọn `PRIVATE` hoặc `PUBLIC`.
4. Candidate chọn đúng một Category.
5. Candidate có thể khai báo các metadata không bắt buộc.
6. Generated CV được tạo với source type `GENERATED`.
7. CV bắt đầu ở trạng thái `DRAFT`.
8. Candidate có thể tiếp tục nhập nội dung sau đó.

### Kết quả

* Generated CV `DRAFT` thuộc Candidate được tạo.
* CV xuất hiện trong My CVs.
* Việc tạo Draft không yêu cầu Generated content phải hoàn thiện.

### Trường hợp từ chối

Không hoàn tất khởi tạo Draft nếu thiếu một trong:

* name;
* visibility;
* category.

### Business Rules liên quan

* `BR-04`
* `BR-05`
* `BR-09`
* `BR-10`
* `BR-11`

### Không thuộc chức năng này

* tự động Activate CV;
* tạo Uploaded CV;
* Apply bằng Draft.

---

## F04 — Xây dựng và hoàn tất Generated CV

### Actor

* Candidate.

### Mục tiêu

Candidate xây nội dung Generated CV theo Harvard Template, biết được khi nào CV đủ completeness và chủ động quyết định hoàn tất CV.

### Tiền điều kiện

* Candidate sở hữu Generated CV;
* CV chưa archive.

### Luồng chính

1. Candidate chỉnh sửa nội dung Generated CV.
2. Candidate có thể thêm, sửa hoặc xóa các mục trong section.
3. Candidate có thể ẩn các section không sử dụng khi không làm vi phạm completeness.
4. Candidate có thể sắp xếp các mục trong giới hạn của Harvard Template.
5. Nội dung được giữ lại trong quá trình Candidate xây dựng CV.
6. Hệ thống đánh giá trạng thái completeness dựa trên các required content.
7. Nếu chưa complete, CV không được Candidate hoàn tất thành `ACTIVE`.
8. Nếu complete, Candidate được phép chủ động chọn hoàn tất CV.
9. Khi Candidate xác nhận hoàn tất và completeness vẫn hợp lệ, CV chuyển `DRAFT → ACTIVE`.

### Kết quả

CV có thể tiếp tục ở `DRAFT` hoặc chuyển thành `ACTIVE` tùy completeness và quyết định của Candidate.

### Chỉnh sửa CV ACTIVE

Candidate vẫn được chỉnh sửa Generated CV `ACTIVE`.

Nếu Candidate lưu nội dung mới khiến Generated CV không còn đáp ứng completeness:

```text
ACTIVE → DRAFT
```

CV phải đáp ứng completeness lại trước khi Candidate có thể chủ động chuyển về `ACTIVE`.

### Trường hợp từ chối

* Candidate cố Activate CV chưa complete;
* Candidate chỉnh sửa CV không thuộc sở hữu;
* Candidate chỉnh sửa CV đã archive.

### Business Rules liên quan

* `BR-12` đến `BR-21`.

### Không thuộc chức năng này

* free-layout CV Builder;
* nhiều template;
* AI-generated full CV;
* chỉnh sửa Uploaded PDF.

---

## F05 — Upload Candidate CV

### Actor

* Candidate.

### Mục tiêu

Candidate đưa một CV PDF đã có vào My CVs.

### Tiền điều kiện

* Actor là Candidate hợp lệ.

### Luồng chính

1. Candidate chọn một PDF.
2. File được kiểm tra theo điều kiện Uploaded CV.
3. Candidate cung cấp name.
4. Candidate chọn visibility.
5. Candidate chọn category.
6. Candidate có thể khai báo metadata không bắt buộc.
7. Khi file và metadata bắt buộc đều hợp lệ, Uploaded CV được đưa vào My CVs.

### Kết quả

* Candidate có một CV `UPLOADED` mới.
* Uploaded CV có thể được quản lý trong thư viện.
* Không tồn tại Uploaded Draft workflow.

### Trường hợp từ chối

* file không phải PDF hợp lệ;
* PDF có mật khẩu;
* PDF vượt quá 10 MB;
* PDF vượt quá 20 trang;
* thiếu name;
* thiếu visibility;
* thiếu category.

### Business Rules liên quan

* `BR-22`
* `BR-23`
* `BR-24`

### Không thuộc chức năng này

* upload Word/DOCX/Image/ZIP như Candidate CV;
* chỉnh PDF bằng Harvard Builder.

---

## F06 — Thay file Uploaded CV

### Actor

* Candidate.

### Mục tiêu

Candidate thay nội dung của Uploaded CV bằng một PDF mới mà không làm mất file hiện tại nếu file mới không hợp lệ.

### Tiền điều kiện

* Candidate sở hữu Uploaded CV;
* CV chưa archive.

### Luồng chính

1. Candidate chọn thay file.
2. Candidate cung cấp PDF mới.
3. PDF mới được kiểm tra theo cùng điều kiện của Uploaded CV.
4. Nếu PDF mới hợp lệ, nó trở thành file hiện tại của Uploaded CV.
5. Nếu PDF mới không hợp lệ, Uploaded CV tiếp tục sử dụng file cũ.

### Kết quả

Thao tác có đúng một trong hai kết quả:

```text
Replacement thành công
→ file mới trở thành current file
```

hoặc:

```text
Replacement thất bại
→ current file cũ giữ nguyên
```

### Trường hợp từ chối

* PDF mới vi phạm bất kỳ điều kiện Uploaded CV nào;
* Candidate không sở hữu CV;
* CV đã archive;
* source type không phải `UPLOADED`.

### Business Rules liên quan

* `BR-22`
* `BR-25`
* `BR-26`

### Không thuộc chức năng này

* Uploaded file history;
* rollback tới file cũ đã từng thay;
* thay file của Generated CV.

---

## F07 — Quản lý metadata, tên và visibility của CV

### Actor

* Candidate.

### Mục tiêu

Candidate quản lý thông tin định hướng và cách sử dụng một Candidate CV trong thư viện.

### Tiền điều kiện

* Candidate sở hữu CV;
* CV chưa archive.

### Luồng chính

Candidate có thể:

1. đổi tên CV;
2. đổi visibility giữa `PRIVATE` và `PUBLIC`;
3. đổi Category;
4. cập nhật ExperienceLevel;
5. cập nhật Preferred Locations;
6. cập nhật Skill tags;
7. cập nhật Employment Types;
8. cập nhật Work Modes.

### Kết quả

Metadata của Candidate CV được cập nhật mà không tự động sửa nội dung Generated CV hoặc Uploaded PDF.

### Trường hợp từ chối

* Candidate không sở hữu CV;
* CV đã archive;
* Category không thuộc catalog chuẩn;
* dữ liệu catalog được chọn không thuộc tập giá trị chuẩn đã có.

### Business Rules liên quan

* `BR-05`
* `BR-27` đến `BR-31`.

### Không thuộc chức năng này

* tự động viết lại Generated content từ metadata;
* tự động sửa Uploaded PDF;
* tự tạo Category;
* Skill Catalog riêng cho V7.

---

## F08 — Preview và Download CV

### Actor

* Candidate.

### Mục tiêu

Candidate kiểm tra và lấy nội dung CV của chính mình khi trạng thái cho phép.

### Tiền điều kiện

* Candidate sở hữu CV;
* CV chưa archive.

### Luồng chính

#### Generated CV

Candidate có thể Preview cả:

```text
DRAFT
ACTIVE
```

Generated `DRAFT` không được download PDF chính thức.

Generated `ACTIVE` được download PDF chính thức theo Harvard Template.

#### Uploaded CV

Candidate có thể:

* Preview PDF hiện tại;
* download PDF hiện tại đã hợp lệ.

### Kết quả

Candidate xem hoặc download CV theo capability của source type và lifecycle.

### Trường hợp từ chối

* Generated CV `DRAFT` yêu cầu download PDF chính thức;
* CV đã archive;
* Candidate không sở hữu CV.

### Business Rules liên quan

* `BR-32`
* `BR-33`
* `BR-34`

### Không thuộc chức năng này

* tạo public link;
* thay visibility khi download;
* coi Preview Draft là Activate.

---

## F09 — Quản lý Default CV

### Actor

* Candidate.

### Mục tiêu

Candidate tùy chọn xác định một CV ưu tiên trong thư viện.

### Tiền điều kiện

CV được đặt làm Default phải:

* thuộc Candidate;
* chưa archive;
* nếu là Generated CV thì phải `ACTIVE`;
* nếu là Uploaded CV thì phải là CV hợp lệ đang sử dụng được.

### Luồng chính

Candidate có thể:

1. đặt một CV hợp lệ làm Default;
2. chuyển Default từ CV hiện tại sang CV hợp lệ khác;
3. chủ động bỏ Default để quay về `Default CV = NONE`.

### Kết quả

Tại mọi thời điểm:

```text
số Default CV ∈ {0, 1}
```

### Trường hợp từ chối

* đặt Generated `DRAFT` làm Default;
* đặt archived CV làm Default;
* đặt CV của Candidate khác làm Default.

### Business Rules liên quan

* `BR-35`
* `BR-36`
* `BR-37`

### Không thuộc chức năng này

* tự động Apply bằng Default CV;
* tự động chọn Default CV;
* quy tắc đề xuất Default CV trên màn Apply.

---

## F10 — Archive CV

### Actor

* Candidate.

### Mục tiêu

Candidate loại một CV khỏi thư viện hoạt động mà không hard delete CV.

### Tiền điều kiện

* Candidate sở hữu CV;
* CV chưa archive.

### Luồng chính

1. Candidate chọn Archive/Delete khỏi My CVs.
2. CV được chuyển ra khỏi thư viện hoạt động.
3. Candidate không tiếp tục sử dụng CV đó như một CV còn hoạt động.
4. Nếu CV đang là Default, Candidate trở về trạng thái không có Default CV.

### Kết quả

CV đã archive:

* không còn trong My CVs hoạt động;
* không được chỉnh sửa;
* không được Preview hoặc Download thông qua thư viện hoạt động;
* không được Default;
* không được dùng cho nghiệp vụ mới;
* không đủ điều kiện cho Candidate Search mới trong tương lai.

### Trường hợp từ chối

* Candidate archive CV của Candidate khác;
* thực hiện hành động dành cho CV hoạt động trên một CV đã archive.

### Business Rules liên quan

* `BR-38`
* `BR-39`
* `BR-40`
* `BR-41`

### Không thuộc chức năng này

* Restore;
* Hard Delete;
* archive snapshot đã được tạo độc lập trong version sau.

---

# 10. Business Rules

## BR-01 — Candidate chỉ quản lý Profile của chính mình

Candidate không được xem hoặc cập nhật Candidate Profile của Candidate khác thông qua chức năng Profile V7.

---

## BR-02 — V7 không bổ sung Candidate Profile field mới

Candidate Profile V7 reuse các thông tin cá nhân đã tồn tại trên User.

Trong F01, Candidate được xem và cập nhật `fullName`, `avatarUrl`,
`dateOfBirth`, `phoneNumber`; Candidate được xem nhưng không được cập nhật
`email`.

F01 không thay đổi `role`, `status`, `passwordHash`, `emailVerifiedAt`,
`mustChangePassword`, session hoặc token data và không tạo email-change
lifecycle mới.

V7 không tạo thêm requirement đối với các field như bio, general skills hoặc candidate location riêng.

---

## BR-03 — Profile và Candidate CV độc lập

Thay đổi Candidate Profile không tự động thay đổi Generated CV hoặc Uploaded CV.

Ngược lại, chỉnh sửa Candidate CV không tự động cập nhật Candidate Profile.

V7 không có chức năng Profile-to-CV synchronization.

---

## BR-04 — Candidate sở hữu nhiều CV

Một Candidate có thể có:

```text
0..N Candidate CV
```

Mỗi Candidate CV thuộc đúng một Candidate.

---

## BR-05 — Một Candidate CV có metadata chung

Metadata bắt buộc:

```text
name
visibility
category
```

Metadata không bắt buộc:

```text
experienceLevel
preferredLocations[]
skillTags[]
employmentTypes[]
workModes[]
```

Generated CV và Uploaded CV tuân theo cùng business meaning của các metadata này.

---

## BR-06 — Mỗi CV có đúng một source type

Source type chỉ có:

```text
GENERATED
UPLOADED
```

Một CV không được đồng thời là cả hai.

Source type không thay đổi trong lifecycle của CV.

---

## BR-07 — Candidate CV không thuộc Company

Candidate CV là resource cá nhân của Candidate.

Company, Company Manager hoặc Recruitment Team không trở thành owner của Candidate CV.

---

## BR-08 — Archived CV không thuộc My CVs hoạt động

My CVs hoạt động chỉ bao gồm các CV chưa archive của Candidate.

---

## BR-09 — Generated Draft yêu cầu metadata bắt buộc

Generated CV chỉ hoàn tất bước khởi tạo `DRAFT` khi có đầy đủ:

```text
name
visibility
category
```

Generated content chưa cần complete tại thời điểm tạo Draft.

---

## BR-10 — Category của CV dùng Category Catalog chuẩn

Mỗi CV có đúng một main Category.

Category có thể thuộc level:

```text
FIELD
POSITION
```

Candidate không được nhập Category tự do hoặc tạo Category mới trong V7.

---

## BR-11 — Generated CV bắt đầu ở DRAFT

Generated CV được tạo với:

```text
sourceType = GENERATED
lifecycle = DRAFT
```

Việc tạo Draft không tự động tạo một CV `ACTIVE`.

---

## BR-12 — Generated CV sử dụng Harvard Template cố định

V7 chỉ cung cấp một Harvard Template cố định.

Candidate được quản lý nội dung qua các section có cấu trúc.

Builder không phải trình thiết kế layout tự do.

---

## BR-13 — Generated content độc lập với Profile

Thông tin cá nhân trong Generated CV là nội dung của chính CV.

Candidate phải chỉnh sửa trực tiếp CV khi muốn thay đổi nội dung này.

---

## BR-14 — Completeness bắt buộc của Generated CV

Generated CV chỉ đủ điều kiện được Candidate chuyển sang `ACTIVE` khi đồng thời có:

```text
fullName             REQUIRED
email                REQUIRED
phone                REQUIRED
professionalSummary  REQUIRED
education[]          REQUIRED, min 1 valid item
skills[]             REQUIRED, min 1
```

Các nhóm sau không bắt buộc để Activate:

```text
workExperiences[]
projects[]
certifications[]
languages[]
links[]
avatar
```

---

## BR-15 — Education item hợp lệ

Mỗi Education item được dùng để đáp ứng completeness phải có:

```text
institutionName  REQUIRED
degree           REQUIRED
fieldOfStudy     optional
startDate        optional
endDate          optional
```

Generated CV cần ít nhất một Education item hợp lệ.

---

## BR-16 — Skills section bắt buộc

Generated CV cần ít nhất một skill để đạt completeness.

Skills nằm trong Generated CV content không bắt buộc phải giống `skillTags` metadata.

---

## BR-17 — Certificate là structured content

`certifications[]` là optional.

Nếu Candidate thêm một Certificate record thì:

```text
name             REQUIRED
issuer           optional
issueDate        optional
expirationDate   optional
credentialId     optional
credentialUrl    optional
```

---

## BR-18 — Language là structured content

`languages[]` là optional.

Nếu Candidate thêm một Language record thì:

```text
name          REQUIRED
proficiency   REQUIRED
```

`proficiency` sử dụng tập giá trị:

```text
BEGINNER
INTERMEDIATE
ADVANCED
FLUENT
NATIVE
```

---

## BR-19 — Completeness phải được phản hồi trong quá trình xây CV

Trong quá trình Candidate nhập hoặc chỉnh sửa Generated CV, hệ thống phải xác định CV hiện:

```text
đủ điều kiện hoàn tất
hoặc
chưa đủ điều kiện hoàn tất
```

Mục đích là để Candidate biết khi nào có thể chủ động thực hiện hành động hoàn tất CV.

Đây không thay thế kiểm tra completeness khi transition thực sự xảy ra.

---

## BR-20 — Candidate chủ động Activate Generated CV

Generated CV không tự động chuyển sang `ACTIVE` khi vừa đạt completeness.

Transition:

```text
DRAFT → ACTIVE
```

chỉ xảy ra khi:

1. CV đang đáp ứng completeness;
2. Candidate chủ động quyết định hoàn tất CV.

---

## BR-21 — Generated ACTIVE có thể quay về DRAFT

Candidate được tiếp tục chỉnh sửa Generated CV `ACTIVE`.

Nếu Candidate lưu nội dung khiến CV không còn đạt completeness:

```text
ACTIVE → DRAFT
```

Sau đó Candidate phải làm CV complete lại và chủ động hoàn tất một lần nữa để trở về `ACTIVE`.

---

## BR-22 — Uploaded CV chỉ chấp nhận PDF hợp lệ

Uploaded CV chỉ chấp nhận file đồng thời đáp ứng:

1. là PDF hợp lệ;
2. không có password;
3. không vượt quá `10 MB`;
4. không vượt quá `20` trang.

Thiếu bất kỳ điều kiện nào thì file không được chấp nhận làm Uploaded CV.

---

## BR-23 — Uploaded CV không có Draft workflow

Uploaded CV chỉ được đưa vào My CVs sau khi đồng thời có:

```text
valid PDF
name
visibility
category
```

Candidate không lưu một Uploaded CV chưa hoàn tất dưới dạng Harvard `DRAFT`.

---

## BR-24 — Uploaded CV không được chỉnh bằng Harvard Builder

Candidate không được chỉnh sửa nội dung bên trong Uploaded PDF bằng Generated CV Builder.

Muốn thay nội dung Uploaded CV, Candidate phải cung cấp một PDF mới.

---

## BR-25 — Replace chỉ hoàn tất bằng file mới hợp lệ

File mới phải thỏa toàn bộ Uploaded PDF rules trước khi trở thành current file của CV.

---

## BR-26 — Replace thất bại phải giữ file cũ

Nếu replacement không hoàn tất hợp lệ:

```text
current PDF trước thao tác
=
current PDF sau thao tác
```

V7 không tạo Uploaded file history.

---

## BR-27 — Rename chỉ thay tên quản lý CV

Tên Candidate CV là tên hiển thị trong My CVs.

Rename không tự động:

* sửa nội dung Generated CV;
* sửa text bên trong Uploaded PDF;
* thay source type.

---

## BR-28 — Category cho phép FIELD hoặc POSITION

Main Category của Candidate CV có thể tham chiếu Category chuẩn ở level:

```text
FIELD
hoặc
POSITION
```

Không yêu cầu CV chỉ được gắn FIELD hoặc chỉ được gắn POSITION.

---

## BR-29 — Preferred Location chỉ biểu diễn địa điểm

`preferredLocations[]` sử dụng Location chuẩn của V4.

Preferred Location biểu diễn khu vực Candidate mong muốn làm việc và không phải địa chỉ nhà.

`REMOTE` không phải Preferred Location.

---

## BR-30 — REMOTE thuộc WorkMode

Nếu Candidate muốn thể hiện mong muốn làm việc từ xa, giá trị `REMOTE` được biểu diễn trong WorkMode theo V4.

---

## BR-31 — Metadata và CV content độc lập

Thay đổi:

```text
category
experienceLevel
preferredLocations
skillTags
employmentTypes
workModes
```

không tự động sửa:

* Generated structured content;
* Uploaded PDF;
* display location trong Generated CV;
* Work Experience content;
* Skills content.

---

## BR-32 — Cả hai source type đều hỗ trợ Preview

Generated CV Preview được tạo từ Generated content theo Harvard Template.

Uploaded CV Preview hiển thị current PDF.

Generated `DRAFT` được phép Preview.

---

## BR-33 — Preview Draft không thay đổi lifecycle

Preview Generated `DRAFT` không đồng nghĩa với:

* complete;
* `ACTIVE`;
* effective `PUBLIC`;
* official PDF;
* được dùng cho Apply.

---

## BR-34 — Download phụ thuộc source type và lifecycle

Generated CV chỉ được download official PDF khi `ACTIVE`.

Generated `DRAFT` không được download official PDF.

Uploaded CV được download current valid PDF.

Download không:

* tạo public link;
* thay visibility.

---

## BR-35 — Default CV là optional

Candidate có thể có:

```text
Default CV = NONE
```

V7 không bắt buộc Candidate phải chọn Default CV.

---

## BR-36 — Tối đa một Default CV

Tại một thời điểm:

```text
số Default CV <= 1
```

Candidate đặt CV khác làm Default thì kết quả cuối cùng vẫn chỉ có tối đa một Default CV.

---

## BR-37 — Candidate được chủ động Unset Default

Candidate có thể bỏ Default hiện tại mà không chọn CV thay thế.

Generated `DRAFT` và archived CV không được Default.

---

## BR-38 — Archive và Delete khỏi thư viện là cùng business operation

Trong V7, các cách gọi:

```text
Archive CV
Delete CV khỏi My CVs
Xóa CV khỏi thư viện
```

đều có nghĩa Candidate loại CV khỏi thư viện hoạt động.

---

## BR-39 — Archive không phải Hard Delete

V7 không có Hard Delete Candidate CV.

Archive không được định nghĩa là xóa vĩnh viễn business record của CV.

---

## BR-40 — Archived CV không còn usable

CV đã archive:

* không xuất hiện trong My CVs hoạt động;
* không được tiếp tục edit;
* không được Preview hoặc Download từ thư viện hoạt động;
* không được Default;
* không được dùng cho nghiệp vụ mới;
* không đủ điều kiện Candidate Search mới trong tương lai.

---

## BR-41 — Archive Default CV làm Default trở về NONE

Nếu Default CV bị archive:

```text
Default CV → NONE
```

Hệ thống không tự động chọn một CV khác thay thế.

V7 không hỗ trợ Restore archived CV.

---

## BR-42 — Candidate chỉ quản lý CV của chính mình

Candidate không được:

* xem My CVs của Candidate khác;
* chỉnh sửa CV của Candidate khác;
* thay file CV của Candidate khác;
* đổi metadata CV của Candidate khác;
* đặt CV của Candidate khác làm Default;
* archive CV của Candidate khác.

---

## BR-43 — PUBLIC không cấp quyền truy cập trong V7

Trong V7:

* Recruiter chưa được Candidate Search;
* Recruiter chưa được tự tìm CV `PUBLIC`;
* Company Manager không được tự do xem My CVs của Candidate;
* Platform Admin không được dùng CV để thực hiện nghiệp vụ tuyển dụng;
* anonymous user không được xem CV;
* người biết URL không mặc nhiên có quyền truy cập.

---

## BR-44 — Live Candidate CV độc lập với future snapshots

Candidate CV trong My CVs và CV snapshot của các nghiệp vụ tương lai là hai khái niệm độc lập.

Sau khi một snapshot hợp lệ tồn tại ở version tương lai, các thao tác sau trên live CV không được mặc nhiên làm thay đổi snapshot đó:

* edit Generated CV;
* replace Uploaded PDF;
* rename;
* đổi visibility;
* archive.

V7 không triển khai snapshot.

---

## BR-45 — PUBLIC chỉ là visibility intent cho Candidate Search tương lai

`PUBLIC` biểu diễn Candidate consent để CV có thể được xem xét cho Candidate Search ở version sau.

Generated `DRAFT`, `PRIVATE` CV và archived CV không được coi là Candidate Search eligible chỉ vì chúng tồn tại trong My CVs.

Quyền Recruiter, search behavior, filtering và ranking chưa thuộc V7.

---

## BR-46 — Catalog lifecycle không được mở rộng trong V7

V7 sử dụng các standard catalogs được V4 cung cấp.

Vì V4 không có catalog deactivation nghiệp vụ, V7 không bổ sung rule deactivate/reactivate catalog hoặc behavior phát sinh từ catalog deactivation.

---

# 11. State Transitions

| Hành động                                                   | Trước                        | Sau                      | Actor     |
| ----------------------------------------------------------- | ---------------------------- | ------------------------ | --------- |
| Tạo Generated CV                                            | Không tồn tại                | `GENERATED / DRAFT`      | Candidate |
| Hoàn tất Generated CV                                       | `GENERATED / DRAFT` complete | `GENERATED / ACTIVE`     | Candidate |
| Lưu Generated CV ACTIVE sau khi nội dung trở nên incomplete | `GENERATED / ACTIVE`         | `GENERATED / DRAFT`      | Candidate |
| Đổi visibility                                              | `PRIVATE`                    | `PUBLIC`                 | Candidate |
| Đổi visibility                                              | `PUBLIC`                     | `PRIVATE`                | Candidate |
| Tạo Uploaded CV hợp lệ                                      | Không tồn tại                | Uploaded CV trong My CVs | Candidate |
| Replace Uploaded PDF hợp lệ                                 | Current PDF A                | Current PDF B            | Candidate |
| Replace Uploaded PDF thất bại                               | Current PDF A                | Current PDF A            | Candidate |
| Đặt Default                                                 | `NONE` hoặc Default khác     | CV được chọn là Default  | Candidate |
| Unset Default                                               | Có Default                   | `NONE`                   | Candidate |
| Archive Default CV                                          | Có Default                   | `NONE` + CV archived     | Candidate |
| Archive CV không phải Default                               | CV trong My CVs              | CV archived              | Candidate |

Generated CV không có transition tự động:

```text
DRAFT → ACTIVE
```

chỉ vì completeness vừa đạt.

V7 không định nghĩa:

```text
ARCHIVED → active library
```

và không định nghĩa Hard Delete transition.

Chỉ các transition trong tài liệu này thuộc V7 business contract.

---

# 12. Authorization và ownership boundary

| Hành động             | Actor được phép | Resource / Scope            | Điều kiện                  |
| --------------------- | --------------- | --------------------------- | -------------------------- |
| Xem Profile           | Candidate       | Profile của chính mình      | Ownership hợp lệ           |
| Cập nhật Profile      | Candidate       | Profile của chính mình      | Ownership hợp lệ           |
| Xem My CVs            | Candidate       | CV của chính mình           | Ownership hợp lệ           |
| Tạo Generated CV      | Candidate       | Thư viện của chính mình     | Candidate hợp lệ           |
| Upload CV             | Candidate       | Thư viện của chính mình     | Candidate hợp lệ           |
| Edit Generated CV     | Candidate       | Generated CV của chính mình | Chưa archive               |
| Replace Uploaded file | Candidate       | Uploaded CV của chính mình  | Chưa archive               |
| Cập nhật metadata     | Candidate       | CV của chính mình           | Chưa archive               |
| Preview CV            | Candidate       | CV của chính mình           | Trạng thái cho phép        |
| Download CV           | Candidate       | CV của chính mình           | Trạng thái cho phép        |
| Set/Unset Default     | Candidate       | CV của chính mình           | CV được chọn phải eligible |
| Archive               | Candidate       | CV của chính mình           | Chưa archive               |
| Tìm PUBLIC CV         | Recruiter       | Candidate CV                | Không thuộc V7             |
| Xem tự do My CVs      | Company Manager | Candidate CV                | Không được phép trong V7   |
| Anonymous access      | Anonymous       | Candidate CV                | Không được phép            |

Ownership được xác định từ Candidate đã xác thực và Candidate sở hữu resource.

Client không được tự tạo quyền trên một CV chỉ bằng cách cung cấp identifier của CV hoặc của Candidate khác.

---

# 13. Multi-tenant boundary

> V7 không bổ sung multi-tenant Company boundary mới cho Candidate CV.

Candidate CV:

```text
thuộc Candidate
≠
thuộc Company
```

Company, Company Manager, Recruiter hoặc Recruitment Team không trở thành tenant/owner của Candidate CV trong V7.

Việc Recruiter thuộc một Company hoặc đang là Primary/Supporting của Job không tự tạo quyền truy cập Candidate CV.

V7 phải tiếp tục giữ Company tenant boundaries của các version trước nhưng không mở rộng chúng sang ownership của Candidate CV.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng:

1. Candidate Profile chỉ sử dụng phạm vi thông tin cá nhân đã có; V7 không thêm Profile field business mới.
2. Candidate chỉ quản lý Profile của chính mình.
3. Profile và Candidate CV độc lập.
4. Candidate có thể sở hữu `0..N` Candidate CV.
5. Mỗi Candidate CV thuộc đúng một Candidate.
6. Mỗi Candidate CV có đúng một source type.
7. Source type không thay đổi.
8. Chỉ có `GENERATED` và `UPLOADED`.
9. Generated và Uploaded dùng chung business metadata của Candidate CV.
10. Name, visibility và category luôn là metadata bắt buộc để hoàn tất khởi tạo CV.
11. Mỗi CV có đúng một main Category.
12. Main Category có thể là `FIELD` hoặc `POSITION`.
13. Candidate không tự tạo hoặc nhập Category tự do.
14. `REMOTE` thuộc WorkMode, không phải Preferred Location.
15. Metadata không tự động sửa CV content.
16. Generated content không tự động đồng bộ với Candidate Profile.
17. Generated CV có lifecycle `DRAFT` và `ACTIVE`.
18. Generated CV mới bắt đầu ở `DRAFT`.
19. Completeness không tự động Activate CV.
20. Candidate phải chủ động quyết định `DRAFT → ACTIVE`.
21. Generated CV chỉ được Activate khi đáp ứng exact completeness của V7.
22. Generated CV cần fullName, email, phone và professionalSummary.
23. Generated CV cần ít nhất một Education item hợp lệ.
24. Generated CV cần ít nhất một Skill.
25. Certificate item đã tồn tại phải có name.
26. Language item đã tồn tại phải có name và proficiency hợp lệ.
27. Generated `DRAFT` không được Default.
28. Generated `DRAFT` không được download official PDF.
29. Generated `DRAFT + PUBLIC` không có effective-public behavior.
30. Generated `ACTIVE` được tiếp tục chỉnh sửa.
31. Generated `ACTIVE` được lưu thành incomplete phải quay về `DRAFT`.
32. Uploaded CV không sử dụng Draft lifecycle.
33. Uploaded CV chỉ được hoàn tất với valid PDF và required metadata.
34. Uploaded CV không được chỉnh bằng Harvard Builder.
35. Generated CV không có Replace PDF operation.
36. Uploaded PDF phải hợp lệ, không password, tối đa 10 MB và tối đa 20 trang.
37. Replace Uploaded PDF thất bại phải giữ current PDF cũ.
38. V7 không có Uploaded file history.
39. Cả Generated và Uploaded CV đều hỗ trợ Preview theo capability của mình.
40. Candidate có thể không có Default CV.
41. Candidate có tối đa một Default CV.
42. Candidate được chủ động Unset Default.
43. Archived CV không được Default.
44. Archive Default CV phải đưa Candidate về Default `NONE`.
45. Archive không tự chọn Default CV thay thế.
46. Archive không phải Hard Delete.
47. Archived CV không Restore trong V7.
48. Archived CV không còn usable cho nghiệp vụ mới.
49. `PUBLIC` không tạo public Internet access.
50. Recruiter không được Candidate Search trong V7.
51. Candidate chỉ quản lý Candidate CV của chính mình.
52. Candidate CV không thuộc Company.
53. Live Candidate CV phải độc lập về business meaning với future submitted/invitation snapshot.
54. V7 không được triển khai trước Application, Candidate Search hoặc Job Invitation.
55. V7 không bổ sung catalog deactivation behavior.

Các invariant phải được giữ sau mọi transition hợp lệ, không chỉ happy path.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V7.

### 15.1. Application và submitted CV snapshot

Defer:

* Apply;
* Application creation;
* submitted CV snapshot;
* replace submitted CV;
* withdraw;
* My Applications;
* cách Default CV được dùng hoặc đề xuất khi Apply.

V7 chỉ chốt boundary rằng live Candidate CV và snapshot tương lai là độc lập.

### 15.2. Candidate Search

Defer:

* quyền Recruiter thực hiện search;
* exact Recruiter eligibility;
* query/search behavior;
* filters;
* ranking;
* CV search result;
* Recruiter CV preview.

V7 chỉ chuẩn bị visibility và metadata cần thiết.

### 15.3. Job Invitation

Defer:

* Job Invitation lifecycle;
* invitation snapshot;
* Source Recruiter;
* Assigned Recruiter;
* accept/reject/revoke/invalidate behavior.

### 15.4. CV enhancements

Defer:

* Duplicate;
* Restore;
* Hard Delete;
* CV version history;
* Uploaded file history;
* multiple Harvard Templates;
* free-layout Builder;
* Canva-like Builder;
* AI full-CV generation;
* public CV link;
* CV view analytics;
* Job recommendations dựa trên CV.

### 15.5. Profile-to-CV synchronization

V7 chủ động không có tự động đồng bộ Candidate Profile và CV.

Nếu Candidate muốn thay nội dung CV, Candidate phải sửa trực tiếp Generated CV hoặc thay Uploaded PDF.

Không được tự implement các nội dung defer trong V7.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V7.

Các quyết định về persistence representation, constraint placement, indexing, file storage hoặc implementation architecture không thuộc Product Specification và sẽ được xử lý ở Data Contract hoặc Engineering Contract tương ứng.

---

# 17. Definition of Business Completion

V7 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Candidate Profile được đáp ứng;
* `F02` — My CVs được đáp ứng;
* `F03` — Generated Draft creation được đáp ứng;
* `F04` — Harvard Builder, completeness và Generated lifecycle được đáp ứng;
* `F05` — Uploaded CV creation được đáp ứng;
* `F06` — Uploaded file replacement được đáp ứng;
* `F07` — metadata, rename và visibility management được đáp ứng;
* `F08` — Preview và Download được đáp ứng;
* `F09` — Default CV lifecycle được đáp ứng;
* `F10` — Archive CV được đáp ứng;
* toàn bộ `BR-01` đến `BR-46` được giữ;
* Generated CV state transitions đúng contract;
* visibility semantics đúng contract;
* ownership và authorization boundary được giữ;
* Candidate CV không bị biến thành Company-owned resource;
* Profile và CV không tự đồng bộ;
* Uploaded replacement không làm mất current valid PDF khi replacement thất bại;
* maximum-one-default invariant luôn đúng;
* archive không trở thành Hard Delete hoặc Restore;
* các future-version features không bị triển khai trước;
* implementation không tạo behavior ngoài boundary V7.

Code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V7.

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
* database schema representation;
* persistence/index strategy;
* transaction implementation;
* file-storage implementation;
* source-code structure;
* test framework;
* exact frontend component;
* exact button name hoặc visual design.

Các mô tả như Candidate “lưu bản nháp” hoặc “hoàn tất/tạo CV” trong business flow chỉ biểu diễn **ý định nghiệp vụ của Candidate**, không bắt buộc frontend phải sử dụng chính xác wording hoặc component tương ứng.

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

Nếu implementation hoặc data design mâu thuẫn với tài liệu này, **V7 Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
