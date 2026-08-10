# V3 — Quản lý nhân sự tuyển dụng của Company

> **File:** `docs/product/versions/v3-company-recruitment-staff-management.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V3.

---

## 1. Mục tiêu

V3 bổ sung khả năng để **Company Manager quản lý các tài khoản Recruiter thuộc Company của mình**.

Sau khi V3 hoàn thành, hệ thống phải:

* phân biệt Company Manager và Recruiter ở cấp Company;
* cho phép Company Manager tạo tài khoản Recruiter;
* gửi email kích hoạt trực tiếp cho Recruiter mới;
* yêu cầu Recruiter thiết lập mật khẩu trước khi được sử dụng các chức năng nghiệp vụ;
* cho phép Company Manager xem danh sách và thông tin Recruiter;
* cho phép Company Manager khóa, mở khóa, reset mật khẩu và chấm dứt Recruiter;
* bảo đảm Company Manager chỉ quản lý Recruiter thuộc chính Company của mình;
* bảo đảm khóa ở cấp nền tảng hoặc khóa Company luôn có hiệu lực cao hơn quyền quản lý của Company Manager;
* giữ lại danh tính và quan hệ lịch sử của Recruiter sau khi bị khóa hoặc chấm dứt;
* giữ nguyên các invariant của V2 về Company và Company Manager, ngoại trừ thay đổi đã được V3 chủ động định nghĩa về mô hình vai trò.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V3 bao gồm:

* mô hình `COMPANY_STAFF` ở cấp nền tảng;
* vai trò `COMPANY_MANAGER` và `RECRUITER` ở cấp Company;
* quan hệ giữa Company Staff và Company;
* tạo Recruiter bởi Company Manager;
* gửi activation email cho Recruiter mới;
* thiết lập mật khẩu ban đầu qua activation flow;
* chặn business access trước khi Recruiter hoàn tất thiết lập mật khẩu;
* Recruiter tự quên/reset mật khẩu;
* Company Manager yêu cầu reset mật khẩu Recruiter;
* xem danh sách Recruiter;
* xem thông tin và trạng thái Recruiter;
* khóa Recruiter;
* mở khóa Recruiter;
* chấm dứt Recruiter;
* thu hồi quyền truy cập khi tài khoản hoặc Company không còn hợp lệ;
* giữ lại lịch sử Recruiter;
* bảo toàn nghiệp vụ Company Manager đã tồn tại từ V2 khi chuyển sang mô hình Company Staff.

### 2.2. Ngoài phạm vi

V3 không bao gồm:

* Company Manager cập nhật thông tin Recruiter sau khi Recruiter đã được tạo;
* Recruiter tự đăng ký;
* Recruiter tự chọn Company;
* Recruiter chuyển từ Company này sang Company khác;
* chuyển Recruiter thành Company Manager;
* chuyển Recruiter thành Candidate;
* Company Manager sử dụng tài khoản của mình như một Recruiter;
* thay thế hoặc chuyển giao Company Manager;
* khóa hoặc chấm dứt `CompanyMember` mang vai trò `COMPANY_MANAGER`;
* Job;
* Recruitment Team;
* Primary Recruiter;
* Supporting Recruiter;
* Application;
* Assigned Recruiter;
* Invitation;
* chuyển Primary Recruiter;
* reassign Application;
* xóa Recruiter khỏi Recruitment Team;
* chuyển giao công việc trước khi khóa hoặc chấm dứt Recruiter;
* xử lý ảnh hưởng của Recruiter bị khóa/chấm dứt đối với Job, Application hoặc Invitation;
* phân cấp Recruiter như Senior Recruiter, Recruiter Lead hoặc Recruiter Admin.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V3 phụ thuộc vào các business capability đã tồn tại trước đó:

* V1 — `User`;
* V1 — đăng nhập bằng email;
* V1 — authentication lifecycle;
* V1 — session lifecycle;
* V1 — forgot/reset password;
* V1 — khóa và chấm dứt tài khoản ở cấp nền tảng;
* V2 — `Company`;
* V2 — Company Manager;
* V2 — Company onboarding;
* V2 — Company approval;
* V2 — Company operational status;
* V2 — `PENDING_ACTIVATION` của Company Manager;
* V2 — Platform Admin quản trị Company.

V3 không thay đổi ý nghĩa của `PENDING_ACTIVATION`.

`PENDING_ACTIVATION` tiếp tục chỉ phục vụ Company Manager đang trong quá trình onboarding Company theo V2.

Recruiter không sử dụng `PENDING_ACTIVATION` chỉ vì được Company Manager tạo.

V3 thay đổi mô hình vai trò của Company Manager như sau:

```text
Trước V3

User
└── COMPANY_MANAGER
```

trở thành:

```text
Từ V3

User
└── COMPANY_STAFF
        │
        ↓
Company Membership
└── COMPANY_MANAGER
```

Việc thay đổi này không làm thay đổi vai trò nghiệp vụ của Company Manager trong V2.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Company Staff

Company Staff là loại tài khoản cấp nền tảng dành cho người dùng làm việc trong một Company.

Trong V3:

```text
COMPANY_STAFF
├── COMPANY_MANAGER
└── RECRUITER
```

`COMPANY_STAFF` không tự xác định người dùng là Company Manager hay Recruiter.

Vai trò cụ thể được xác định từ tư cách thành viên của người dùng trong Company.

---

### 4.2. Company Manager

Company Manager là Company Staff có vai trò `COMPANY_MANAGER` trong Company.

Company Manager:

* đại diện và quản lý Company;
* quản lý tài khoản Recruiter của chính Company;
* không phải Recruiter;
* không sử dụng tài khoản Company Manager để thực hiện nghiệp vụ dành riêng cho Recruiter.

Trong phạm vi V3, mỗi Company có đúng một Company Manager hiện tại.

---

### 4.3. Recruiter

Recruiter là Company Staff có vai trò `RECRUITER` trong Company.

Recruiter:

* không tự đăng ký;
* được Company Manager của Company tạo;
* thuộc đúng một Company;
* không có quyền quản lý tài khoản Recruiter khác chỉ vì bản thân là Recruiter;
* không được sử dụng business functions cho tới khi hoàn tất việc thiết lập mật khẩu ban đầu.

---

### 4.4. Platform Admin

Platform Admin là actor quản trị cấp nền tảng.

Các quyết định khóa hoặc chấm dứt User ở cấp nền tảng và khóa Company có hiệu lực cao hơn trạng thái thành viên cấp Company.

Company Manager không được vượt qua các quyết định quản trị này.

---

### 4.5. Company Membership

Company Membership biểu diễn tư cách của một Company Staff trong một Company.

Nó xác định:

* người dùng thuộc Company nào;
* người dùng là `COMPANY_MANAGER` hay `RECRUITER`;
* tư cách thành viên hiện đang `ACTIVE`, `LOCKED` hay `TERMINATED`.

---

## 5. Quan hệ nghiệp vụ chính

### 5.1. Company Staff và Company

```text
Company Staff
      │
      │ đúng 1 membership
      ↓
Company Membership
      │
      │ thuộc đúng 1
      ↓
Company
```

Một Company Staff:

* thuộc đúng một Company;
* chỉ có một vai trò cấp Company;
* không đồng thời là Company Manager và Recruiter.

---

### 5.2. Company và Company Manager

```text
Company
   │
   │ đúng 1 current manager
   ↓
Company Membership
role = COMPANY_MANAGER
   │
   ↓
Company Staff
```

Company và Company Manager là hai đối tượng nghiệp vụ riêng biệt.

Company vẫn tồn tại độc lập với danh tính người dùng của Company Manager.

Tư cách `COMPANY_MANAGER` được xác định duy nhất từ Company Membership.

---

### 5.3. Company và Recruiter

```text
Company
   │
   │ 0..N
   ↓
Company Membership
role = RECRUITER
   │
   ↓
Company Staff
```

Một Company có thể có không hoặc nhiều Recruiter.

Mỗi Recruiter chỉ thuộc một Company.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Trạng thái User cấp nền tảng

Các trạng thái kế thừa:

* `PENDING_ACTIVATION`
* `ACTIVE`
* `LOCKED`
* `TERMINATED`

| Trạng thái           | Ý nghĩa                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `PENDING_ACTIVATION` | Chỉ dùng cho Company Manager đang hoàn tất onboarding Company theo V2 |
| `ACTIVE`             | Danh tính người dùng không bị hạn chế ở cấp nền tảng                  |
| `LOCKED`             | Tài khoản bị khóa tạm thời ở cấp nền tảng                             |
| `TERMINATED`         | Tài khoản bị chấm dứt vĩnh viễn ở cấp nền tảng                        |

Recruiter không sử dụng `PENDING_ACTIVATION` như trạng thái khởi tạo của V3.

---

### 6.2. Trạng thái Company Membership

Các trạng thái:

* `ACTIVE`
* `LOCKED`
* `TERMINATED`

| Trạng thái   | Ý nghĩa                                                |
| ------------ | ------------------------------------------------------ |
| `ACTIVE`     | Thành viên đang có tư cách hoạt động tại Company       |
| `LOCKED`     | Quyền hoạt động của thành viên tại Company bị tạm khóa |
| `TERMINATED` | Quan hệ làm việc tại Company đã bị chấm dứt vĩnh viễn  |

Đối với Recruiter:

* `LOCKED` có thể quay lại `ACTIVE`;
* `TERMINATED` là terminal state.

Đối với Company Manager:

* V3 không cung cấp nghiệp vụ chuyển Company Membership của Company Manager sang `LOCKED`;
* V3 không cung cấp nghiệp vụ chuyển Company Membership của Company Manager sang `TERMINATED`.

---

### 6.3. Trạng thái sẵn sàng sử dụng tài khoản Recruiter

Ngoài các lifecycle status trên, Recruiter còn có điều kiện về việc thiết lập mật khẩu.

Có hai điều kiện nghiệp vụ:

1. **Chưa hoàn tất thiết lập mật khẩu**

   * Recruiter chưa được sử dụng business functions.

2. **Đã hoàn tất thiết lập mật khẩu**

   * Recruiter có thể sử dụng business functions nếu tất cả điều kiện authorization khác cũng hợp lệ.

Đây là điều kiện về business access, không thay thế `User.status` hoặc Company Membership status.

---

## 7. Tổ hợp trạng thái hợp lệ

Quyền thực hiện business functions của Company Staff chỉ tồn tại khi đồng thời:

| User         | Company Membership | Company                                    | Thiết lập mật khẩu | Business access          |
| ------------ | ------------------ | ------------------------------------------ | ------------------ | ------------------------ |
| `ACTIVE`     | `ACTIVE`           | Approved và `ACTIVE`                       | Hoàn tất           | Được xét quyền theo role |
| `ACTIVE`     | `ACTIVE`           | Approved và `ACTIVE`                       | Chưa hoàn tất      | Không                    |
| `ACTIVE`     | `LOCKED`           | Approved và `ACTIVE`                       | Bất kỳ             | Không                    |
| `ACTIVE`     | `TERMINATED`       | Bất kỳ                                     | Bất kỳ             | Không                    |
| `LOCKED`     | Bất kỳ             | Bất kỳ                                     | Bất kỳ             | Không                    |
| `TERMINATED` | Bất kỳ             | Bất kỳ                                     | Bất kỳ             | Không                    |
| Bất kỳ       | Bất kỳ             | Company `LOCKED`                           | Bất kỳ             | Không                    |
| Bất kỳ       | Bất kỳ             | Company chưa ở trạng thái hoạt động hợp lệ | Bất kỳ             | Không                    |

Đối với Company Manager còn đang ở `PENDING_ACTIVATION`, quyền của họ tiếp tục tuân theo onboarding V2 và chưa được sử dụng các chức năng quản lý Recruiter của V3.

Các tổ hợp trạng thái của Company không được V3 định nghĩa lại; V3 sử dụng business truth đã được V2 thiết lập.

---

## 8. Quy trình nghiệp vụ tổng thể

### 8.1. Khởi tạo Recruiter

```text
Company Manager hợp lệ
        ↓
Nhập thông tin Recruiter
        ↓
Hệ thống xác định Company của Company Manager
        ↓
Kiểm tra dữ liệu và tính duy nhất
        ↓
Tạo danh tính Recruiter
+
Tạo tư cách thành viên RECRUITER
        ↓
Gửi activation email trực tiếp đến Recruiter
        ↓
Recruiter mở activation link
        ↓
Recruiter thiết lập mật khẩu
        ↓
Hoàn tất activation
        ↓
Recruiter có thể sử dụng business functions
nếu các điều kiện authorization khác đều hợp lệ
```

Recruiter không thể đăng nhập và sử dụng business functions bằng một mật khẩu do Company Manager cung cấp.

Company Manager không tham gia vào việc lựa chọn hoặc biết mật khẩu của Recruiter.

---

### 8.2. Lifecycle Company-level của Recruiter

```text
              lock
ACTIVE ─────────────────→ LOCKED
  ↑                         │
  └──────── unlock ─────────┘
  │                         │
  │ terminate               │ terminate
  ↓                         ↓
TERMINATED ←────────────────┘
```

`TERMINATED` không có transition quay lại.

---

# 9. Functional Requirements

## F01 — Xác định vai trò của Company Staff

### Actor

* System

### Mục tiêu

Xác định một Company Staff là Company Manager hay Recruiter trong Company.

### Tiền điều kiện

* User thuộc loại Company Staff.
* User có tư cách thành viên Company hợp lệ.

### Luồng chính

1. Hệ thống xác định tư cách thành viên của User.
2. Hệ thống xác định Company tương ứng.
3. Hệ thống đọc vai trò cấp Company.
4. Hệ thống sử dụng vai trò này khi xét quyền nghiệp vụ.

### Kết quả

User được xác định là một trong:

* `COMPANY_MANAGER`;
* `RECRUITER`.

### Trường hợp từ chối

Không được coi một User là Company Manager hoặc Recruiter chỉ dựa trên dữ liệu do client tự khai báo.

### Business Rules liên quan

* `BR-02`
* `BR-03`
* `BR-04`
* `BR-27`

### Không thuộc chức năng này

* Primary Recruiter;
* Supporting Recruiter;
* role cấp Job.

---

## F02 — Xác định Company hiện tại của Company Manager

### Actor

* Company Manager
* System

### Mục tiêu

Xác định Company mà Company Manager được phép quản lý.

### Tiền điều kiện

* User là Company Staff.
* User có vai trò `COMPANY_MANAGER`.

### Luồng chính

1. Company Manager thực hiện một hành động quản lý Recruiter.
2. Hệ thống xác định Company từ tư cách thành viên của Company Manager.
3. Company đã xác định trở thành tenant scope của hành động.

### Kết quả

Mọi thao tác quản lý Recruiter của Company Manager bị giới hạn trong Company đó.

### Trường hợp từ chối

* không xác định được Company hợp lệ;
* Company Manager cố thao tác Recruiter thuộc Company khác.

### Business Rules liên quan

* `BR-03`
* `BR-06`
* `BR-07`

### Không thuộc chức năng này

* chọn Company tùy ý;
* chuyển Company;
* quản lý nhiều Company bằng cùng một Company Staff account.

---

## F03 — Company Manager tạo Recruiter

### Actor

* Company Manager

### Mục tiêu

Tạo một Recruiter mới cho Company của mình.

### Tiền điều kiện

Company Manager phải đồng thời:

* có User đang `ACTIVE`;
* có Company Membership đang `ACTIVE`;
* có role `COMPANY_MANAGER`;
* thuộc Company đã được approve;
* thuộc Company đang `ACTIVE`.

### Luồng chính

1. Company Manager cung cấp:

   * họ tên;
   * email công việc;
   * mã nhân viên;
   * chức danh.
2. Hệ thống xác định Company từ Company Manager hiện tại.
3. Hệ thống kiểm tra email chưa thuộc User nào trong hệ thống.
4. Hệ thống kiểm tra mã nhân viên chưa được sử dụng trong cùng Company.
5. Hệ thống tạo Recruiter và tư cách thành viên `RECRUITER`.
6. Hệ thống bắt đầu activation flow cho Recruiter.

### Kết quả

* Recruiter tồn tại như Company Staff của đúng Company.
* Recruiter có role `RECRUITER`.
* Recruiter chưa được sử dụng business functions cho tới khi hoàn tất activation/password setup.

### Trường hợp từ chối

* Company Manager không hợp lệ;
* Company không hợp lệ;
* email đã tồn tại;
* mã nhân viên bị trùng trong Company;
* thiếu một trong các trường bắt buộc;
* mục tiêu thuộc Company khác.

### Business Rules liên quan

* `BR-01`
* `BR-05`
* `BR-06`
* `BR-07`
* `BR-08`
* `BR-09`
* `BR-10`

### Không thuộc chức năng này

* Company Manager nhập mật khẩu cho Recruiter;
* Company Manager chọn Company khác;
* Recruiter tự đăng ký.

---

## F04 — Gửi activation email cho Recruiter mới

### Actor

* System
* Recruiter

### Mục tiêu

Trao quyền thiết lập mật khẩu ban đầu trực tiếp cho Recruiter.

### Tiền điều kiện

* Recruiter vừa được tạo thành công.
* Recruiter có email hợp lệ.

### Luồng chính

1. Hệ thống gửi activation email đến email của Recruiter.
2. Email cung cấp activation link dành cho Recruiter, hoạt động khi email client/browser thực hiện `GET` với activation token trên query string.
3. Recruiter sử dụng link để mở form và tiếp tục luồng thiết lập mật khẩu.

### Kết quả

Recruiter có khả năng tự thiết lập mật khẩu mà Company Manager không cần và không được biết mật khẩu.

### Trường hợp từ chối

Activation không hợp lệ hoặc không còn được chấp nhận thì không được dùng để thiết lập mật khẩu.

### Business Rules liên quan

* `BR-11`
* `BR-12`
* `BR-13`

### Không thuộc chức năng này

* gửi mật khẩu gốc cho Company Manager;
* cho Company Manager đặt mật khẩu;
* cho Recruiter sử dụng business functions trước khi hoàn tất thiết lập mật khẩu.

---

## F05 — Recruiter hoàn tất activation và thiết lập mật khẩu

### Actor

* Recruiter

### Mục tiêu

Thiết lập mật khẩu của chính Recruiter và hoàn tất điều kiện truy cập ban đầu.

### Tiền điều kiện

* Recruiter đã được Company Manager tạo.
* Recruiter có activation hợp lệ.
* Recruiter chưa hoàn tất thiết lập mật khẩu ban đầu.

### Luồng chính

1. Recruiter mở activation link.
2. Hệ thống trả form thiết lập mật khẩu; việc mở link không tự consume activation token.
3. Recruiter tự chọn mật khẩu và submit form.
4. Hệ thống ghi nhận việc thiết lập mật khẩu đã hoàn tất.
5. Recruiter không còn bị chặn bởi điều kiện activation/password setup.

### Kết quả

Recruiter có thể sử dụng business functions nếu:

* User hợp lệ;
* Company Membership hợp lệ;
* Company hợp lệ;
* role cho phép hành động tương ứng.

### Trường hợp từ chối

* activation không hợp lệ;
* User bị khóa hoặc chấm dứt;
* Company hoặc Company Membership không cho phép tiếp tục truy cập.

### Business Rules liên quan

* `BR-11`
* `BR-12`
* `BR-13`

### Không thuộc chức năng này

* mở khóa Recruiter;
* mở khóa User;
* mở khóa Company.

---

## F06 — Recruiter tự quên/reset mật khẩu

### Actor

* Recruiter

### Mục tiêu

Cho phép Recruiter tự thiết lập mật khẩu mới khi không còn sử dụng được mật khẩu hiện tại.

### Tiền điều kiện

* Recruiter có tài khoản hợp lệ để sử dụng password reset lifecycle.

### Luồng chính

1. Recruiter yêu cầu reset mật khẩu.
2. Recruiter mở reset link từ email để vào form đặt lại mật khẩu.
3. Recruiter hoàn tất flow xác nhận hợp lệ và tự chọn mật khẩu mới.
4. Các phiên đăng nhập cũ của Recruiter bị thu hồi.
5. Mật khẩu mới trở thành mật khẩu hiện tại.

### Kết quả

Recruiter có thể đăng nhập lại nếu các điều kiện authorization khác đều hợp lệ.

### Trường hợp từ chối

Password reset không được:

* mở khóa Company Membership;
* khôi phục Company Membership đã `TERMINATED`;
* bỏ khóa User;
* bỏ khóa Company.

### Business Rules liên quan

* `BR-14`
* `BR-17`
* `BR-22`

### Không thuộc chức năng này

* Company-level unlock;
* platform-level unlock;
* phục hồi Recruiter đã terminated.

---

## F07 — Company Manager yêu cầu reset mật khẩu Recruiter

### Actor

* Company Manager
* Recruiter

### Mục tiêu

Cho phép Company Manager buộc Recruiter thiết lập lại mật khẩu mà Company Manager không được biết mật khẩu mới.

### Tiền điều kiện

* Company Manager hợp lệ;
* Recruiter thuộc cùng Company;
* đối tượng là Recruiter;
* Recruiter chưa bị `TERMINATED`.

### Luồng chính

1. Company Manager yêu cầu reset mật khẩu của Recruiter.
2. Hệ thống xác nhận Company Manager có quyền đối với Recruiter đó.
3. Hệ thống bắt đầu quá trình đặt lại mật khẩu cho Recruiter.
4. Recruiter tự thiết lập mật khẩu mới.
5. Các phiên đăng nhập cũ bị thu hồi.

### Kết quả

* Company Manager không biết mật khẩu mới.
* Recruiter sử dụng mật khẩu mới sau khi hoàn tất reset.
* trạng thái khóa của Recruiter không tự thay đổi.

### Trường hợp từ chối

* cross-company;
* mục tiêu không phải Recruiter;
* Recruiter đã `TERMINATED`;
* Company Manager không đủ điều kiện quản lý.

### Business Rules liên quan

* `BR-06`
* `BR-07`
* `BR-12`
* `BR-15`
* `BR-17`

### Không thuộc chức năng này

* unlock Recruiter;
* restore Recruiter đã terminated;
* bỏ platform lock;
* cho Company Manager chọn hoặc xem mật khẩu mới.

---

## F08 — Xem danh sách Recruiter

### Actor

* Company Manager

### Mục tiêu

Xem các Recruiter thuộc Company mà mình quản lý.

### Tiền điều kiện

* Company Manager có quyền quản lý Recruiter.

### Luồng chính

1. Hệ thống xác định Company của Company Manager.
2. Hệ thống xác định các Company Member có role `RECRUITER` thuộc Company đó.
3. Hệ thống cung cấp thông tin phục vụ việc quản lý Recruiter.

### Kết quả

Company Manager chỉ nhìn thấy Recruiter thuộc tenant của mình.

### Trường hợp từ chối

* Company Manager không hợp lệ;
* cố truy cập Recruiter Company khác.

### Business Rules liên quan

* `BR-06`
* `BR-07`
* `BR-23`

### Không thuộc chức năng này

* Recruiter Company khác;
* Candidate;
* Platform Admin;
* Company Manager khác.

---

## F09 — Xem thông tin Recruiter

### Actor

* Company Manager

### Mục tiêu

Xem thông tin quản lý của một Recruiter thuộc Company.

### Tiền điều kiện

* Recruiter thuộc cùng Company với Company Manager.

### Luồng chính

Company Manager có thể xem các thông tin đã được V3 chốt, bao gồm:

* họ tên;
* email;
* mã nhân viên;
* chức danh;
* trạng thái liên quan tới việc quản lý tài khoản.

### Kết quả

Company Manager có đủ thông tin để thực hiện các chức năng quản trị Recruiter trong V3.

### Trường hợp từ chối

* Recruiter thuộc Company khác;
* mục tiêu không phải Recruiter.

### Business Rules liên quan

* `BR-06`
* `BR-07`
* `BR-29`

### Không thuộc chức năng này

* sửa thông tin Recruiter;
* xem mật khẩu;
* xem bất kỳ dạng thông tin mật khẩu nào.

---

### F10 — Không sử dụng trong V3

`F10` trước đây được dự kiến cho chức năng **Company Manager cập nhật Recruiter**.

Chức năng này đã được chủ động loại khỏi V3.

Mã `F10` không được tái sử dụng cho chức năng khác nhằm giữ ổn định numbering của specification.

---

## F11 — Khóa Recruiter

### Actor

* Company Manager

### Mục tiêu

Tạm thời ngăn Recruiter sử dụng quyền hoạt động tại Company.

### Tiền điều kiện

* Company Manager hợp lệ;
* Recruiter thuộc cùng Company;
* đối tượng có role `RECRUITER`;
* Recruiter chưa `TERMINATED`.

### Luồng chính

1. Company Manager yêu cầu khóa Recruiter.
2. Hệ thống xác nhận authorization và tenant boundary.
3. Recruiter chuyển sang `LOCKED` ở cấp Company Membership.
4. Các phiên đăng nhập cũ của Recruiter bị thu hồi.
5. Recruiter mất business access.

### Kết quả

Recruiter bị khóa tạm thời nhưng danh tính và lịch sử vẫn được giữ.

### Trường hợp từ chối

* cross-company;
* đối tượng không phải Recruiter;
* Recruiter đã `TERMINATED`;
* Company Manager không hợp lệ.

### Business Rules liên quan

* `BR-16`
* `BR-17`
* `BR-21`

### Không thuộc chức năng này

* platform-level lock;
* terminate;
* chuyển giao Job/Application.

---

## F12 — Mở khóa Recruiter

### Actor

* Company Manager

### Mục tiêu

Cho phép một Recruiter đang bị khóa cấp Company trở lại trạng thái `ACTIVE`.

### Tiền điều kiện

* Recruiter đang `LOCKED`;
* cùng Company;
* User không bị platform-level restriction ngăn truy cập;
* Company đang hợp lệ;
* Company Manager đủ quyền.

### Luồng chính

1. Company Manager yêu cầu mở khóa.
2. Hệ thống kiểm tra điều kiện.
3. Company Membership chuyển `LOCKED → ACTIVE`.

### Kết quả

Recruiter có thể đăng nhập lại và sử dụng business functions nếu mọi điều kiện access khác đều hợp lệ.

Các phiên đăng nhập cũ không được phục hồi.

### Trường hợp từ chối

* Recruiter `TERMINATED`;
* User đang bị platform lock hoặc terminated;
* Company không hợp lệ;
* cross-company.

### Business Rules liên quan

* `BR-18`
* `BR-22`
* `BR-23`

### Không thuộc chức năng này

* phục hồi session cũ;
* phục hồi terminated Recruiter;
* bỏ platform lock;
* bỏ Company lock.

---

## F13 — Chấm dứt Recruiter

### Actor

* Company Manager

### Mục tiêu

Chấm dứt vĩnh viễn tư cách Recruiter tại Company.

### Tiền điều kiện

Recruiter đang ở một trong hai trạng thái:

* `ACTIVE`; hoặc
* `LOCKED`.

### Luồng chính

1. Company Manager yêu cầu chấm dứt Recruiter.
2. Hệ thống kiểm tra authorization và tenant boundary.
3. Company Membership chuyển sang `TERMINATED`.
4. Các phiên đăng nhập cũ bị thu hồi.
5. Recruiter mất quyền hoạt động tại Company vĩnh viễn.

### Kết quả

* Recruiter không thể được mở lại;
* danh tính và lịch sử vẫn được giữ;
* email không được giải phóng để tạo một User khác.

### Trường hợp từ chối

* Recruiter đã `TERMINATED`;
* cross-company;
* đối tượng không phải Recruiter;
* Company Manager không đủ quyền.

### Business Rules liên quan

* `BR-19`
* `BR-20`
* `BR-21`

### Không thuộc chức năng này

* chuyển Recruiter sang Company khác;
* chuyển Recruiter thành CM;
* chuyển giao Job/Application;
* tạo lại Recruiter bằng email cũ.

---

## F14 — Xác định quyền truy cập thực tế của Company Staff

### Actor

* System

### Mục tiêu

Đảm bảo Company Staff chỉ được thực hiện business function khi tất cả các lớp quyền đều hợp lệ.

### Tiền điều kiện

* request yêu cầu một business capability của Company Staff.

### Luồng chính

Hệ thống xét đồng thời:

1. trạng thái User;
2. trạng thái Company Membership;
3. trạng thái Company;
4. trạng thái approval của Company;
5. việc hoàn tất thiết lập mật khẩu nếu có yêu cầu;
6. role cấp Company;
7. quyền cụ thể của chức năng.

### Kết quả

Chỉ actor đáp ứng toàn bộ điều kiện mới được thực hiện hành động.

### Trường hợp từ chối

Chỉ cần một lớp bắt buộc không hợp lệ thì business access bị từ chối.

### Business Rules liên quan

* `BR-13`
* `BR-22`
* `BR-23`
* `BR-24`

---

## F15 — Tôn trọng quyền quản trị cấp nền tảng

### Actor

* Platform Admin
* System
* Company Manager

### Mục tiêu

Bảo đảm quyền Company-level không vượt qua restriction cấp nền tảng hoặc Company.

### Tiền điều kiện

Có restriction cấp nền tảng hoặc Company.

### Luồng chính

Hệ thống ưu tiên restriction ở lớp cao hơn khi tính business access.

### Kết quả

Ví dụ:

```text
Company Membership = ACTIVE
User = LOCKED
→ không truy cập

Company Membership = ACTIVE
Company = LOCKED
→ không truy cập
```

Company Manager không thể loại bỏ restriction thuộc quyền Platform Admin.

### Business Rules liên quan

* `BR-22`
* `BR-23`

---

## F16 — Giữ danh tính và lịch sử Recruiter

### Actor

* System

### Mục tiêu

Không làm mất dấu Recruiter sau khi bị khóa hoặc chấm dứt.

### Tiền điều kiện

Recruiter đã từng thuộc Company.

### Luồng chính

Khi Recruiter bị khóa hoặc chấm dứt:

* danh tính người dùng vẫn được giữ;
* quan hệ lịch sử với Company vẫn được giữ;
* họ tên, employee code và job title lịch sử không bị mất chỉ vì lifecycle state thay đổi.

### Kết quả

Các version sau có thể tiếp tục tham chiếu đúng Recruiter lịch sử.

### Business Rules liên quan

* `BR-20`
* `BR-21`

### Không thuộc chức năng này

* Job history;
* Application history;
* assignment history.

---

## F17 — Bảo toàn nghiệp vụ V2 khi áp dụng mô hình Company Staff

### Actor

* System

### Mục tiêu

Cho phép mô hình Company Staff của V3 được áp dụng mà không thay đổi business semantics của Company Manager trong V2.

### Tiền điều kiện

* Company và Company Manager đã tồn tại theo business contract V2.

### Luồng nghiệp vụ

Sau V3:

```text
Company Manager
=
User loại COMPANY_STAFF
+
Company Membership role COMPANY_MANAGER
```

### Kết quả

* Company vẫn có đúng một Company Manager hiện tại;
* Company và Company Manager vẫn là hai thực thể nghiệp vụ riêng;
* `PENDING_ACTIVATION` tiếp tục giữ nguyên ý nghĩa của V2;
* approval và activation flow của Company không bị V3 định nghĩa lại.

### Business Rules liên quan

* `BR-02`
* `BR-04`
* `BR-26`
* `BR-27`
* `BR-28`

---

# 10. Business Rules

## BR-01 — Email là định danh đăng nhập duy nhất

Mọi User đăng nhập bằng email.

Một email chỉ được thuộc một User trong toàn hệ thống.

---

## BR-02 — Phân tách platform account type và Company role

Company Manager và Recruiter đều là Company Staff ở cấp nền tảng.

Vai trò `COMPANY_MANAGER` hoặc `RECRUITER` được xác định ở cấp Company Membership.

---

## BR-03 — Một Company Staff chỉ thuộc một Company

Một Company Staff:

* thuộc đúng một Company;
* chỉ có một Company Membership hiện tại;
* chỉ có một role cấp Company.

---

## BR-04 — Một Company chỉ có một Company Manager hiện tại

Trong phạm vi V3, mỗi Company phải có đúng một Company Manager hiện tại.

Một Company có thể có nhiều Recruiter.

---

## BR-05 — Recruiter không self-register

Recruiter chỉ được tạo bởi Company Manager hợp lệ.

Recruiter không tự chọn Company.

---

## BR-06 — Điều kiện Company Manager quản lý Recruiter

Company Manager chỉ được thực hiện các chức năng quản lý Recruiter khi:

```text
User hợp lệ
AND
Company Membership hợp lệ
AND
role = COMPANY_MANAGER
AND
Company đã được approve
AND
Company đang hoạt động
```

---

## BR-07 — Company được xác định từ Company Manager

Tenant của thao tác quản lý Recruiter phải được xác định từ Company Membership của authenticated Company Manager.

Company Manager không được dùng một Company identifier tùy ý để mở rộng phạm vi quản lý.

---

## BR-08 — Dữ liệu bắt buộc khi tạo Recruiter

Khi tạo Recruiter, các thông tin sau là bắt buộc:

* họ tên;
* email công việc;
* employee code;
* job title.

---

## BR-09 — Employee code duy nhất trong Company

Employee code của Recruiter không được trùng với employee code đã tồn tại trong cùng Company.

Không yêu cầu employee code unique giữa các Company khác nhau.

---

## BR-10 — Tạo Recruiter là một business outcome thống nhất

Không được tồn tại kết quả nghiệp vụ trong đó:

* có tài khoản Recruiter nhưng không có tư cách thành viên Company tương ứng; hoặc
* có tư cách Recruiter nhưng không có danh tính User tương ứng.

Tạo Recruiter chỉ được coi là thành công khi toàn bộ kết quả nghiệp vụ cần thiết cùng tồn tại nhất quán.

---

## BR-11 — Recruiter mới phải hoàn tất activation

Sau khi Recruiter được tạo:

1. hệ thống gửi activation email trực tiếp tới Recruiter;
2. Recruiter sử dụng activation link;
3. Recruiter tự thiết lập mật khẩu;
4. chỉ sau khi hoàn tất quá trình này Recruiter mới vượt qua activation/password gate.

---

## BR-12 — Company Manager không được biết mật khẩu Recruiter

Company Manager:

* không chọn mật khẩu cho Recruiter;
* không nhận mật khẩu của Recruiter;
* không xem mật khẩu Recruiter;
* không được biết mật khẩu được thiết lập trong activation hoặc reset flow.

---

## BR-13 — Chưa thiết lập mật khẩu thì không có business access

Recruiter chưa hoàn tất việc thiết lập mật khẩu bắt buộc không được sử dụng business functions.

---

## BR-14 — Self password reset không thay đổi authorization state

Recruiter tự reset mật khẩu không được:

* mở khóa Company Membership;
* phục hồi terminated membership;
* bỏ platform lock;
* bỏ Company lock.

---

## BR-15 — Company Manager reset password không phải unlock

Company Manager yêu cầu reset mật khẩu Recruiter không đồng nghĩa với:

* mở khóa Recruiter;
* khôi phục Recruiter đã terminated;
* bỏ platform lock;
* bỏ Company lock.

---

## BR-16 — Company-level lock là tạm thời

`LOCKED` ở Company Membership là trạng thái có thể quay lại `ACTIVE`.

Recruiter không được tự mở khóa.

---

## BR-17 — Các sự kiện bảo mật phải vô hiệu hóa phiên cũ

Khi password reset, lock hoặc termination làm thay đổi quyền sử dụng tài khoản, các phiên đăng nhập cũ của Recruiter không được tiếp tục tạo ra quyền truy cập hợp lệ.

---

## BR-18 — Unlock không phục hồi session cũ

`LOCKED → ACTIVE` chỉ phục hồi tư cách thành viên.

Nó không phục hồi các phiên đăng nhập đã bị thu hồi trước đó.

---

## BR-19 — Termination là vĩnh viễn

Recruiter có thể chuyển:

```text
ACTIVE → TERMINATED
LOCKED → TERMINATED
```

Sau khi `TERMINATED`:

* không được chuyển lại `ACTIVE`;
* không được chuyển lại `LOCKED`;
* không được phục hồi bằng password reset.

---

## BR-20 — Email của terminated User không được tái sử dụng

Email đã thuộc một User bị terminated vẫn thuộc danh tính đó.

Không được dùng cùng email để tạo một User mới.

---

## BR-21 — Không xóa danh tính Recruiter vì lifecycle state

Lock hoặc terminate không được làm mất:

* danh tính Recruiter;
* tư cách lịch sử tại Company;
* thông tin lịch sử cần để nhận diện Recruiter.

---

## BR-22 — Restriction cấp nền tảng có ưu tiên cao hơn Company-level permission

Company Manager không thể:

* mở khóa User bị khóa ở cấp nền tảng;
* phục hồi User bị terminated ở cấp nền tảng;
* vượt qua quyết định quản trị của Platform Admin.

---

## BR-23 — Company không hợp lệ thì Company Staff không có business access

Nếu Company không ở trạng thái cho phép hoạt động, Company Staff của Company đó không được thực hiện business functions dù Company Membership của họ đang `ACTIVE`.

---

## BR-24 — Recruiter ngang nhau ở cấp Company

V3 không định nghĩa:

* Senior Recruiter;
* Recruiter Leader;
* Recruiter Admin;
* Recruiter Manager.

Một Recruiter không có quyền quản lý Recruiter khác chỉ vì role `RECRUITER`.

---

## BR-25 — Không chuyển đổi role hoặc Company trong V3

V3 không cho phép:

* Recruiter chuyển sang Company khác;
* Recruiter đổi thành Company Manager;
* Recruiter đổi thành Candidate;
* Company Manager đồng thời sử dụng cùng tài khoản như Recruiter.

---

## BR-26 — Không quản lý lifecycle Company Manager Membership trong V3

Company Membership có role `COMPANY_MANAGER` không được chuyển sang `LOCKED` hoặc `TERMINATED` bằng nghiệp vụ của V3.

Replacement hoặc termination của Company Manager được defer.

---

## BR-27 — Company Membership là nguồn xác định Company Manager

Tư cách `COMPANY_MANAGER` được xác định từ Company Membership.

Không được tồn tại một business source of truth độc lập khác có khả năng đưa ra một Company Manager khác cho cùng Company.

---

## BR-28 — Giữ nguyên ý nghĩa PENDING_ACTIVATION của V2

`PENDING_ACTIVATION` tiếp tục chỉ phục vụ Company Manager đang trong onboarding Company.

Recruiter không dùng trạng thái này chỉ vì chưa hoàn tất activation/password setup của V3.

---

## BR-29 — Company Manager không cập nhật Recruiter trong V3

Sau khi Recruiter được tạo, V3 không cung cấp chức năng để Company Manager sửa:

* họ tên;
* email;
* employee code;
* job title.

---

# 11. State Transitions

## 11.1. Recruiter Company Membership

| Hành động          | Trước         | Sau          | Actor           |
| ------------------ | ------------- | ------------ | --------------- |
| Tạo Recruiter      | Không tồn tại | `ACTIVE`     | Company Manager |
| Khóa Recruiter     | `ACTIVE`      | `LOCKED`     | Company Manager |
| Mở khóa Recruiter  | `LOCKED`      | `ACTIVE`     | Company Manager |
| Chấm dứt Recruiter | `ACTIVE`      | `TERMINATED` | Company Manager |
| Chấm dứt Recruiter | `LOCKED`      | `TERMINATED` | Company Manager |

Không hợp lệ:

```text
TERMINATED → ACTIVE
TERMINATED → LOCKED
```

---

## 11.2. Activation/password readiness

```text
Recruiter vừa được tạo
        ↓
Chưa hoàn tất thiết lập mật khẩu
        ↓ activation
Recruiter tự thiết lập mật khẩu
        ↓
Đã hoàn tất thiết lập mật khẩu
```

Chưa hoàn tất bước này thì không có business access.

---

## 11.3. Company Manager Membership

V3 không bổ sung transition:

```text
COMPANY_MANAGER ACTIVE → LOCKED
COMPANY_MANAGER ACTIVE → TERMINATED
```

Các nghiệp vụ thay thế hoặc kết thúc Company Manager được defer.

Chỉ các transition được định nghĩa trong tài liệu này mới thuộc business contract của V3.

---

# 12. Authorization và ownership boundary

| Hành động                | Actor được phép | Resource / Scope         | Điều kiện                    |
| ------------------------ | --------------- | ------------------------ | ---------------------------- |
| Tạo Recruiter            | Company Manager | Company của chính CM     | CM và Company hợp lệ         |
| Xem danh sách Recruiter  | Company Manager | Recruiter cùng Company   | CM và Company hợp lệ         |
| Xem Recruiter            | Company Manager | Recruiter cùng Company   | Same-company                 |
| Reset password Recruiter | Company Manager | Recruiter cùng Company   | Recruiter chưa terminated    |
| Lock Recruiter           | Company Manager | Recruiter cùng Company   | Recruiter chưa terminated    |
| Unlock Recruiter         | Company Manager | Recruiter cùng Company   | Recruiter đang locked        |
| Terminate Recruiter      | Company Manager | Recruiter cùng Company   | Recruiter active hoặc locked |
| Activation               | Recruiter       | Chính tài khoản của mình | Activation hợp lệ            |
| Forgot/reset password    | Recruiter       | Chính tài khoản của mình | Flow xác nhận hợp lệ         |
| Quản lý Recruiter khác   | Recruiter       | —                        | Không được phép              |
| Override platform lock   | Company Manager | User                     | Không được phép              |
| Override Company lock    | Company Manager | Company                  | Không được phép              |

Company Manager không được thao tác Recruiter của Company khác.

Recruiter không được quản lý tài khoản Recruiter khác.

Authorization phải dựa trên quan hệ business đã được hệ thống xác định, không dựa vào việc client tự khai báo rằng actor thuộc Company nào.

---

# 13. Multi-tenant boundary

Tenant của V3 là `Company`.

Quan hệ tenant được xác định:

```text
Authenticated Company Manager
        ↓
Company Membership
        ↓
Canonical Company
        ↓
Recruiters thuộc Company đó
```

Các invariant tenant:

1. Company Manager chỉ quản lý Recruiter thuộc chính Company của mình.
2. Recruiter chỉ thuộc một Company.
3. Company Manager không được tạo Recruiter cho Company khác.
4. Company Manager không được xem hoặc quản lý Recruiter của Company khác.
5. Recruiter không tự chọn Company.
6. Client-provided Company identifier không tạo ra authorization.
7. Cross-company Recruiter management bị cấm.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng trong toàn bộ V3:

1. Mọi User đăng nhập bằng email.
2. Một email chỉ thuộc một User trong toàn hệ thống.
3. Một User chỉ có một platform account type.
4. Company Manager và Recruiter đều thuộc loại Company Staff ở cấp nền tảng.
5. Company role được xác định từ Company Membership.
6. Một Company Staff chỉ thuộc một Company.
7. Một Company Staff chỉ có một Company role.
8. Một Company có đúng một Company Manager hiện tại.
9. Một Company có thể có nhiều Recruiter.
10. Company và Company Manager là hai business entities riêng.
11. Recruiter không tự đăng ký.
12. Recruiter không tự chọn Company.
13. Company của thao tác quản lý phải được xác định từ Company Manager đã xác thực.
14. Recruiter không chuyển Company trong V3.
15. Recruiter không chuyển thành Company Manager hoặc Candidate trong V3.
16. Company Manager và Recruiter không dùng chung một account để thực hiện cả hai role.
17. Recruiter chỉ được tạo khi Company Manager và Company đủ điều kiện quản lý nhân sự.
18. `employeeCode` là bắt buộc.
19. `jobTitle` là bắt buộc.
20. Employee code phải unique trong cùng Company.
21. Recruiter mới phải nhận activation email.
22. Recruiter phải tự thiết lập mật khẩu trước khi có business access.
23. Company Manager không được biết hoặc chọn mật khẩu Recruiter.
24. Password reset không tự unlock Recruiter.
25. Company-level lock là reversible.
26. Termination là irreversible.
27. `ACTIVE → TERMINATED` hợp lệ.
28. `LOCKED → TERMINATED` hợp lệ.
29. Các phiên cũ không được tự phục hồi sau unlock.
30. Restriction cấp nền tảng không thể bị Company Manager override.
31. Company bị khóa thì Company Staff không có business access.
32. Recruiter bị khóa hoặc terminated vẫn giữ danh tính và lịch sử.
33. Email của terminated User không được tái sử dụng.
34. Recruiter ngang nhau ở cấp Company.
35. Primary và Supporting Recruiter không thuộc V3.
36. Company Manager Membership không có lock/terminate lifecycle trong V3.
37. Company Membership là nguồn business truth duy nhất xác định Company Manager.
38. `PENDING_ACTIVATION` giữ nguyên semantics của Company Manager onboarding từ V2.
39. Recruiter không sử dụng `PENDING_ACTIVATION` chỉ vì chưa hoàn tất thiết lập mật khẩu.
40. Company Manager không được cập nhật thông tin Recruiter trong V3.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V3:

* Company Manager cập nhật thông tin Recruiter;
* thay thế Company Manager;
* chấm dứt Company Manager Membership;
* transfer Company Manager;
* Recruiter chuyển Company;
* Recruiter promotion thành Company Manager;
* phân cấp Recruiter ở Company level;
* Job;
* Recruitment Team;
* Primary Recruiter;
* Supporting Recruiter;
* Application;
* Application assignment;
* Invitation;
* chuyển Primary;
* reassign Application;
* chuyển giao responsibility trước khi Recruiter bị lock hoặc terminated;
* xử lý ảnh hưởng của Recruiter lifecycle đối với Job/Application/Invitation.

Các nội dung trên có thể được định nghĩa ở version sau nếu có quyết định sản phẩm tương ứng.

Không được tự implement các nội dung này như một phần của V3.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V3.

Các lựa chọn về persistence, API contract, token representation, delivery mechanism chi tiết, indexing hoặc architecture không phải business decision của tài liệu này.

---

# 17. Definition of Business Completion

V3 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` đến `F09` được đáp ứng;
* `F10` không được implementation trong V3;
* `F11` đến `F17` được đáp ứng;
* toàn bộ `BR-01` đến `BR-29` được giữ;
* Recruiter chỉ được tạo bởi Company Manager hợp lệ;
* activation/password setup hoạt động đúng business flow đã chốt;
* Recruiter chưa thiết lập mật khẩu không có business access;
* Company Manager chỉ quản lý Recruiter cùng Company;
* lock/unlock/terminate tuân thủ state machine;
* cả `ACTIVE → TERMINATED` và `LOCKED → TERMINATED` được hỗ trợ;
* `TERMINATED` không thể được phục hồi;
* restriction cấp nền tảng và Company không thể bị Company Manager bypass;
* session cũ không tạo ra quyền truy cập sau các sự kiện thu hồi quyền;
* danh tính và lịch sử Recruiter không bị mất sau termination;
* V2 Company/Company Manager lifecycle tiếp tục giữ nguyên semantics;
* các nội dung đã defer không bị implementation ngoài ý muốn;
* không xuất hiện behavior ngoài boundary của V3.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V3.

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
* MongoDB/Mongoose representation;
* cách lưu trạng thái activation;
* cách lưu Company Membership;
* token format;
* cách tạo hoặc xác thực activation token;
* cách triển khai session revocation;
* transaction implementation;
* index;
* source-code structure;
* test framework.

Luồng authority:

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

Nếu data design, diagram hoặc implementation mâu thuẫn với tài liệu này, **Product Specification V3 là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
