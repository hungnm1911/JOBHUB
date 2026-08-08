# V3 — Quản lý nhân sự tuyển dụng của Company Data Model

> **File:** `docs/data/versions/v3-company-recruitment-staff-management-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v3-company-recruitment-staff-management.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v3-company-recruitment-staff-management.md
```

Product Specification là authority đối với business behavior.

Data Contract V3 xác định:

* dữ liệu cần persist để biểu diễn Company Staff;
* persistence representation của `COMPANY_MANAGER` và `RECRUITER`;
* quan hệ giữa `User`, `CompanyMember` và `Company`;
* dữ liệu cần persist khi tạo Recruiter;
* persistence representation của activation/password readiness;
* dữ liệu phục vụ lock, unlock và termination của Recruiter;
* persistence phục vụ password reset;
* session revocation requirement;
* tenant ownership;
* uniqueness;
* state validity;
* transaction/atomicity requirement;
* compatibility với dữ liệu V2;
* boundary giữa constraint do database/schema và service bảo vệ.

Tài liệu này không thay đổi hoặc mở rộng business behavior của Product Specification V3.

Macro database và entity diagram chỉ là input cho persistence design.

---

# 2. Thay đổi so với version trước

| Entity / Collection     | Trạng thái  | Mô tả                                                                                                               |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `users`                 | `UPDATED`   | Đổi platform role `COMPANY_MANAGER` thành `COMPANY_STAFF`; sử dụng `mustChangePassword` cho readiness của Recruiter |
| `companies`             | `UPDATED`   | Bỏ `managerUserId`; Company Manager được resolve qua `CompanyMember`                                                |
| `company_members`       | `NEW`       | Lưu Company membership, Company role và Company-level status                                                        |
| `auth_sessions`         | `UNCHANGED` | Tiếp tục lưu session của `User`; được sử dụng khi revoke session                                                    |
| `auth_tokens`           | `UPDATED`   | Bổ sung token type phục vụ Recruiter activation                                                                     |
| `CompanyReviewSnapshot` | `UNCHANGED` | Embedded document kế thừa từ V2                                                                                     |

## 2.1. Entity mới

* `company_members`

## 2.2. Entity được mở rộng hoặc thay đổi

* `users`
* `companies`
* `auth_tokens`

## 2.3. Entity giữ nguyên nhưng được sử dụng

* `auth_sessions`
* `CompanyReviewSnapshot`

V3 không tạo collection riêng cho Recruiter.

Recruiter được biểu diễn bởi:

```text
User
role = COMPANY_STAFF

+

CompanyMember
role = RECRUITER
```

---

# 3. Collection / Entity tổng thể

V3 sử dụng:

```text
users
companies
company_members
auth_sessions
auth_tokens
```

và embedded document kế thừa:

```text
CompanyReviewSnapshot
```

| Entity / Collection     | Responsibility                                                                  |
| ----------------------- | ------------------------------------------------------------------------------- |
| `users`                 | Danh tính, login credential, platform role, platform status, password readiness |
| `companies`             | Dữ liệu Company và lifecycle Company                                            |
| `company_members`       | Quan hệ User–Company, Company role, Company-level status, employee metadata     |
| `auth_sessions`         | Session của User                                                                |
| `auth_tokens`           | Temporary token phục vụ activation/password reset và các lifecycle đã tồn tại   |
| `CompanyReviewSnapshot` | Snapshot Company review kế thừa từ V2                                           |

Không tạo thêm collection ngoài danh sách trên nếu chưa có canonical requirement mới.

---

# 4. Quan hệ dữ liệu

## 4.1. User → CompanyMember

**Cardinality**

```text
User 1 ───── 0..1 CompanyMember
```

Ở cấp business:

```text
CANDIDATE
→ không có CompanyMember

PLATFORM_ADMIN
→ không có CompanyMember

COMPANY_STAFF
→ có đúng 1 CompanyMember
```

**Owner relationship**

`CompanyMember`

**Reference**

```text
CompanyMember.userId
```

**Constraint**

* `userId` bắt buộc;
* một `User` có tối đa một `CompanyMember`;
* referenced User của mọi `CompanyMember` phải có `role = COMPANY_STAFF`.

Database bảo vệ **tối đa một** membership bằng uniqueness.

Service + transaction bảo vệ invariant **COMPANY_STAFF phải có đúng một membership sau khi business operation commit**.

**Lifecycle**

V3 không cho phép:

* chuyển membership sang User khác;
* tạo membership thứ hai cho cùng User.

---

## 4.2. Company → CompanyMember

**Cardinality**

```text
Company 1 ───── 1..N CompanyMember
```

Một Company có:

```text
đúng 1 CompanyMember
role = COMPANY_MANAGER

và

0..N CompanyMember
role = RECRUITER
```

**Owner relationship**

`CompanyMember`

**Reference**

```text
CompanyMember.companyId
```

**Constraint**

* `companyId` bắt buộc;
* một CompanyMember chỉ thuộc một Company;
* V3 không cho phép chuyển Company của membership.

---

## 4.3. Company → Company Manager

Persistence representation:

```text
Company
   │
   │ companyId
   ↓
CompanyMember
role = COMPANY_MANAGER
   │
   │ userId
   ↓
User
role = COMPANY_STAFF
```

`Company` không giữ thêm một reference độc lập tới Company Manager.

Không tồn tại:

```text
Company.managerUserId
```

sau khi migration V3 hoàn tất.

---

## 4.4. Company → Recruiter

```text
Company 1
   │
   │ 0..N
   ↓
CompanyMember
role = RECRUITER
   │
   │ 1
   ↓
User
role = COMPANY_STAFF
```

Thông tin identity thuộc `User`.

Thông tin employment tại Company thuộc `CompanyMember`.

---

## 4.5. User → AuthSession

```text
User 1 ───── 0..N AuthSession
```

`AuthSession` thuộc User.

Không thêm direct relation:

```text
CompanyMember → AuthSession
```

---

## 4.6. User → AuthToken

```text
User 1 ───── 0..N AuthToken
```

Token activation và password reset thuộc User.

Không thuộc `CompanyMember`.

---

# 5. `users`

## 5.1. Responsibility

`users` chịu trách nhiệm persist:

* danh tính chung;
* email đăng nhập;
* password hash;
* platform account type;
* platform status;
* email verification state kế thừa;
* password readiness gate.

`users` không chịu trách nhiệm persist:

* Company mà User thuộc;
* Company role;
* employee code;
* job title;
* Company-level lock state.

---

## 5.2. Fields

| Field                | Type       | Required | Default   | Constraint      | Ý nghĩa                                  |
| -------------------- | ---------- | -------: | --------- | --------------- | ---------------------------------------- |
| `_id`                | `ObjectId` |      YES | generated | unique          | User identity                            |
| `fullName`           | `String`   |      YES | —         | —               | Họ tên                                   |
| `avatarUrl`          | `String`   |       NO | `null`    | —               | Avatar                                   |
| `dateOfBirth`        | `Date`     |       NO | `null`    | —               | Ngày sinh                                |
| `phoneNumber`        | `String`   |       NO | `null`    | —               | Số điện thoại                            |
| `email`              | `String`   |      YES | —         | unique          | Email đăng nhập                          |
| `passwordHash`       | `String`   |      YES | —         | credential hash | Password representation                  |
| `role`               | `String`   |      YES | —         | enum            | Platform account type                    |
| `status`             | `String`   |      YES | —         | enum            | Platform lifecycle                       |
| `emailVerifiedAt`    | `Date`     |       NO | `null`    | inherited       | Email verification data từ version trước |
| `mustChangePassword` | `Boolean`  |      YES | `false`   | —               | Password readiness gate                  |
| `createdAt`          | `Date`     |      YES | automatic | —               | Thời điểm tạo                            |
| `updatedAt`          | `Date`     |      YES | automatic | —               | Thời điểm cập nhật                       |

V3 không tái định nghĩa business semantics của `emailVerifiedAt`.

---

## 5.3. Enum

### `role`

```text
CANDIDATE
COMPANY_STAFF
PLATFORM_ADMIN
```

Không còn:

```text
COMPANY_MANAGER
```

trên `User.role`.

Không thêm:

```text
RECRUITER
```

vào `User.role`.

### `status`

```text
PENDING_ACTIVATION
ACTIVE
LOCKED
TERMINATED
```

V3 giữ nguyên enum platform status.

Với Recruiter:

```text
PENDING_ACTIVATION
```

không phải trạng thái khởi tạo hợp lệ.

---

## 5.4. Persistence representation khi tạo Recruiter

Sau khi F03 commit thành công:

```text
User.role = COMPANY_STAFF
User.status = ACTIVE
User.mustChangePassword = true
```

`passwordHash` vẫn phải có persisted value để giữ compatibility với contract User đã tồn tại.

Credential bootstrap này:

* không được cung cấp cho Company Manager;
* không được gửi cho Recruiter như credential đăng nhập;
* không phải flow đăng nhập của Recruiter;
* bị thay thế khi Recruiter hoàn tất activation và tự đặt mật khẩu.

Raw password không được persist.

`mustChangePassword = true` biểu diễn:

```text
Recruiter chưa hoàn tất activation/password setup
→ không business access
```

---

## 5.5. Indexes

| Index          | Loại   | Mục đích                     |
| -------------- | ------ | ---------------------------- |
| `{ email: 1 }` | Unique | Một email chỉ thuộc một User |

Không thêm index mới trên User chỉ để phục vụ V3 nếu chưa có query/business requirement tương ứng.

---

## 5.6. Embedded documents

> `User` không sử dụng embedded document mới trong V3.

---

# 6. `companies`

## 6.1. Responsibility

`companies` tiếp tục chịu trách nhiệm persist:

* Company profile;
* Company approval lifecycle;
* Company operational lifecycle;
* review metadata;
* activation metadata.

V3 không đưa membership hoặc Recruiter list trực tiếp vào Company.

---

## 6.2. Fields

| Field                        | Type       | Required | Default   | Ý nghĩa                      |
| ---------------------------- | ---------- | -------: | --------- | ---------------------------- |
| `_id`                        | `ObjectId` |      YES | generated | Company identity             |
| `name`                       | `String`   |      YES | —         | Tên Company                  |
| `reviewedByUserId`           | `ObjectId` |       NO | `null`    | Platform Admin review        |
| `logoUrl`                    | `String`   |       NO | `null`    | Logo                         |
| `bannerUrl`                  | `String`   |       NO | `null`    | Banner                       |
| `website`                    | `String`   |       NO | `null`    | Website                      |
| `address`                    | `String`   |       NO | `null`    | Địa chỉ                      |
| `description`                | `String`   |       NO | `null`    | Mô tả                        |
| `contactInfo`                | `String`   |       NO | `null`    | Contact information          |
| `businessRegistrationNumber` | `String`   |       NO | `null`    | Số đăng ký kinh doanh        |
| `approvalStatus`             | `String`   |      YES | inherited | Approval lifecycle           |
| `operationalStatus`          | `String`   |      YES | inherited | Operational lifecycle        |
| `submittedAt`                | `Date`     |       NO | `null`    | Thời điểm submit             |
| `reviewedAt`                 | `Date`     |       NO | `null`    | Thời điểm review             |
| `activatedAt`                | `Date`     |       NO | `null`    | Thời điểm Company activation |
| `createdAt`                  | `Date`     |      YES | automatic | Created timestamp            |
| `updatedAt`                  | `Date`     |      YES | automatic | Updated timestamp            |

### Field bị loại bỏ

```text
managerUserId
```

`managerUserId` phải được remove sau khi migration V2 → V3 hoàn tất và dữ liệu đã được xác minh.

---

## 6.3. Enum

Giữ nguyên từ V2.

### `approvalStatus`

```text
NOT_SUBMITTED
PENDING
APPROVED
REJECTED
```

### `operationalStatus`

```text
INACTIVE
ACTIVE
LOCKED
```

V3 không thêm Company state.

---

## 6.4. Embedded documents

`CompanyReviewSnapshot` tiếp tục là embedded document của Company theo contract V2.

V3:

* không sửa field của snapshot;
* không tạo snapshot mới;
* không thay đổi lifecycle snapshot.

---

## 6.5. Reference rules

| Field              | Reference | Required | Rule                                                              |
| ------------------ | --------- | -------: | ----------------------------------------------------------------- |
| `reviewedByUserId` | `User`    |       NO | Referenced User phải là Platform Admin theo business rule kế thừa |

V3 không thêm direct Company → Manager reference.

---

# 7. `company_members`

## 7.1. Responsibility

`company_members` là entity mới chịu trách nhiệm persist:

* User nào là Company Staff member;
* Company nào member thuộc về;
* Company role;
* Company-level lifecycle status;
* employee code;
* job title.

Entity này không chịu trách nhiệm persist:

* email login;
* password;
* platform status;
* refresh token;
* activation token;
* password reset token;
* Job role;
* Application responsibility.

---

## 7.2. Fields

| Field          | Type       |    Required | Default   | Constraint                    | Ý nghĩa             |
| -------------- | ---------- | ----------: | --------- | ----------------------------- | ------------------- |
| `_id`          | `ObjectId` |         YES | generated | unique                        | Membership identity |
| `userId`       | `ObjectId` |         YES | —         | ref `User`, unique, immutable | User của membership |
| `companyId`    | `ObjectId` |         YES | —         | ref `Company`, immutable      | Tenant owner        |
| `role`         | `String`   |         YES | —         | enum, immutable               | Company role        |
| `status`       | `String`   |         YES | `ACTIVE`  | enum                          | Company-level state |
| `employeeCode` | `String`   | Conditional | —         | required với Recruiter        | Mã nhân viên        |
| `jobTitle`     | `String`   | Conditional | —         | required với Recruiter        | Chức danh           |
| `createdAt`    | `Date`     |         YES | automatic | —                             | Created timestamp   |
| `updatedAt`    | `Date`     |         YES | automatic | —                             | Updated timestamp   |

### Conditional requirement

Nếu:

```text
role = RECRUITER
```

thì:

```text
employeeCode = REQUIRED
jobTitle = REQUIRED
```

Nếu:

```text
role = COMPANY_MANAGER
```

V3 không yêu cầu hai field trên.

---

## 7.3. Enum

### `role`

```text
COMPANY_MANAGER
RECRUITER
```

Không thêm:

```text
PRIMARY_RECRUITER
SUPPORTING_RECRUITER
```

### `status`

```text
ACTIVE
LOCKED
TERMINATED
```

Đối với `RECRUITER`, cả ba giá trị đều là persisted state hợp lệ.

Đối với `COMPANY_MANAGER`, V3 chỉ cho phép:

```text
ACTIVE
```

V3 không persist:

```text
COMPANY_MANAGER + LOCKED
COMPANY_MANAGER + TERMINATED
```

như state được tạo ra bởi V3.

---

## 7.4. Indexes

### Một User chỉ có một Company membership

```text
{ userId: 1 }
```

Loại:

```text
UNIQUE
```

Bảo vệ:

```text
User A → Company A
User A → Company B   ❌
```

và:

```text
User A → COMPANY_MANAGER
User A → RECRUITER   ❌
```

---

### Employee code unique trong Company

```text
{ companyId: 1, employeeCode: 1 }
```

Loại:

```text
UNIQUE
```

áp dụng cho membership có:

```text
role = RECRUITER
```

Bảo vệ:

```text
Company A / NV001
Company A / NV001   ❌

Company A / NV001
Company B / NV001   ✅
```

---

### Tối đa một Company Manager

```text
{ companyId: 1 }
```

Loại:

```text
UNIQUE PARTIAL
```

áp dụng khi:

```text
role = COMPANY_MANAGER
```

Database bảo vệ:

```text
một Company
→ tối đa một CompanyMember role COMPANY_MANAGER
```

Database không tự bảo đảm Company **luôn có đúng một** Company Manager.

Invariant “đúng một” thuộc service + transaction.

Index V3 **không** được thiết kế để cho phép lưu nhiều Company Manager lịch sử với trạng thái `TERMINATED`, vì Company Manager termination/replacement đã được defer khỏi V3.

---

### Lookup Recruiter theo tenant

```text
{ companyId: 1, role: 1, status: 1 }
```

Loại:

```text
COMPOUND
```

Mục đích:

* resolve membership theo Company;
* phục vụ danh sách Recruiter;
* phục vụ Company-role/status lookup.

---

## 7.5. Embedded documents

> `CompanyMember` không sử dụng embedded document trong V3.

---

## 7.6. Reference rules

| Field       | Reference | Required | Cardinality | Rule                          |
| ----------- | --------- | -------: | ----------- | ----------------------------- |
| `userId`    | `User`    |      YES | 1 → 1       | User phải là `COMPANY_STAFF`  |
| `companyId` | `Company` |      YES | N → 1       | Member thuộc đúng một Company |

Database bảo vệ cấu trúc reference.

Service bảo vệ business validity của referenced document.

---

# 8. `auth_sessions`

## 8.1. Responsibility

Tiếp tục lưu session của User theo contract authentication đã tồn tại.

V3 sử dụng collection này để bảo đảm session cũ không tiếp tục tạo quyền truy cập sau các security transition yêu cầu revocation.

---

## 8.2. Fields

Contract field giữ nguyên từ version trước, bao gồm các dữ liệu đã tồn tại như:

```text
userId
refreshTokenHash
expiresAt
createdAt
```

V3 không thêm:

```text
companyId
companyMemberId
role
```

vào `AuthSession`.

---

## 8.3. Relationship

```text
User 1 ───── 0..N AuthSession
```

Session thuộc User, không thuộc CompanyMember.

Khi V3 yêu cầu revoke toàn bộ session của Recruiter, scope revocation là:

```text
mọi AuthSession
của Recruiter User
```

---

# 9. `auth_tokens`

## 9.1. Responsibility

Tiếp tục persist temporary authentication/lifecycle token thuộc User.

V3 bổ sung persistence cần thiết cho Recruiter activation.

---

## 9.2. Fields

| Field       | Type       | Required | Constraint | Ý nghĩa                        |
| ----------- | ---------- | -------: | ---------- | ------------------------------ |
| `_id`       | `ObjectId` |      YES | unique     | Token record                   |
| `userId`    | `ObjectId` |      YES | ref `User` | Token owner                    |
| `type`      | `String`   |      YES | enum       | Token purpose                  |
| `tokenHash` | `String`   |      YES | unique     | Persisted token representation |
| `expiresAt` | `Date`     |      YES | —          | Expiration                     |
| `createdAt` | `Date`     |      YES | —          | Creation timestamp             |

Raw token không được persist.

---

## 9.3. Enum `type`

Giữ nguyên các type đã tồn tại:

```text
EMAIL_VERIFICATION
PASSWORD_RESET
COMPANY_APPROVAL_CONFIRMATION
```

V3 bổ sung:

```text
RECRUITER_ACTIVATION
```

### `RECRUITER_ACTIVATION`

Chỉ phục vụ:

```text
Recruiter vừa được CM tạo
→ mở activation link
→ tự đặt mật khẩu ban đầu
```

Không dùng type này cho:

* Candidate email verification;
* Company approval confirmation;
* password reset sau activation.

### `PASSWORD_RESET`

Tiếp tục được sử dụng cho:

* Recruiter tự forgot/reset password;
* Company Manager khởi tạo password reset cho Recruiter.

V3 không tạo một token type riêng chỉ vì password reset được khởi tạo bởi Company Manager.

---

## 9.4. Indexes

Giữ unique index:

```text
{ tokenHash: 1 }
```

Không thêm speculative index chỉ để hỗ trợ behavior chưa tồn tại trong Product Specification.

Expiration/cleanup mechanism của `AuthToken` tiếp tục theo contract authentication đã tồn tại.

V3 không thay đổi thời lượng token chung nếu Product Specification không định nghĩa giá trị mới.

---

# 10. State Matrix

## 10.1. Recruiter identity / membership state

| User.role       | User.status          | Member.role | Member.status                  | Hợp lệ persisted | Ý nghĩa                                              |
| --------------- | -------------------- | ----------- | ------------------------------ | ---------------- | ---------------------------------------------------- |
| `COMPANY_STAFF` | `ACTIVE`             | `RECRUITER` | `ACTIVE`                       | YES              | Recruiter bình thường hoặc đang chờ activation       |
| `COMPANY_STAFF` | `ACTIVE`             | `RECRUITER` | `LOCKED`                       | YES              | Company-level locked                                 |
| `COMPANY_STAFF` | `ACTIVE`             | `RECRUITER` | `TERMINATED`                   | YES              | Employment terminated                                |
| `COMPANY_STAFF` | `LOCKED`             | `RECRUITER` | `ACTIVE`                       | YES              | Platform lock cao hơn membership                     |
| `COMPANY_STAFF` | `LOCKED`             | `RECRUITER` | `LOCKED`                       | YES              | Hai lớp lock cùng tồn tại                            |
| `COMPANY_STAFF` | `LOCKED`             | `RECRUITER` | `TERMINATED`                   | YES              | Membership đã terminated, User cũng bị platform lock |
| `COMPANY_STAFF` | `TERMINATED`         | `RECRUITER` | bất kỳ persisted state hiện có | YES              | Platform termination không yêu cầu xóa membership    |
| `COMPANY_STAFF` | `PENDING_ACTIVATION` | `RECRUITER` | bất kỳ                         | NO               | `PENDING_ACTIVATION` không dùng cho Recruiter        |

---

## 10.2. Company Manager membership

| User.role       | Member.role       | Member.status | Hợp lệ trong V3 |
| --------------- | ----------------- | ------------- | --------------- |
| `COMPANY_STAFF` | `COMPANY_MANAGER` | `ACTIVE`      | YES             |
| `COMPANY_STAFF` | `COMPANY_MANAGER` | `LOCKED`      | NO              |
| `COMPANY_STAFF` | `COMPANY_MANAGER` | `TERMINATED`  | NO              |

Platform `User.status` của Company Manager vẫn độc lập và tiếp tục theo lifecycle của version trước.

---

## 10.3. Recruiter activation readiness

### Chưa hoàn tất activation

```text
User.role = COMPANY_STAFF
User.status = ACTIVE
User.mustChangePassword = true

CompanyMember.role = RECRUITER
CompanyMember.status = ACTIVE

RECRUITER_ACTIVATION token
= còn hợp lệ
```

Persisted state:

```text
VALID
```

Business access:

```text
DENIED
```

---

### Đã hoàn tất activation

```text
User.mustChangePassword = false
RECRUITER_ACTIVATION token = consumed / no longer usable
```

Persisted state:

```text
VALID
```

Business access tiếp tục phụ thuộc:

* User status;
* CompanyMember status;
* Company approval;
* Company operational status;
* role authorization.

---

# 11. Persistence Transitions

## 11.1. V2 Company Manager → V3 Company Staff

### Trigger

V3 data migration.

### Trước

```text
User.role = COMPANY_MANAGER

Company.managerUserId = User._id
```

### Sau

```text
User.role = COMPANY_STAFF

CompanyMember {
  userId = User._id
  companyId = Company._id
  role = COMPANY_MANAGER
  status = ACTIVE
}
```

Sau khi toàn bộ migration được xác minh:

```text
Company.managerUserId
→ removed
```

### Invariant

Company vẫn có đúng một Company Manager.

---

## 11.2. Tạo Recruiter

### Trigger business

`F03`

### Trước

```text
User(email) không tồn tại

CompanyMember(employeeCode trong tenant)
không tồn tại
```

### Sau

```text
User {
  role = COMPANY_STAFF
  status = ACTIVE
  mustChangePassword = true
  ...
}

CompanyMember {
  userId = User._id
  companyId = canonical Company
  role = RECRUITER
  status = ACTIVE
  employeeCode = required
  jobTitle = required
}
```

### Không được xuất hiện

```text
User Recruiter
nhưng không có CompanyMember
```

hoặc:

```text
CompanyMember RECRUITER
nhưng không có User
```

---

## 11.3. Chuẩn bị Recruiter activation

### Trigger business

`F04`

Sau khi Recruiter persisted thành công:

```text
AuthToken {
  userId = Recruiter User
  type = RECRUITER_ACTIVATION
  tokenHash
  expiresAt
}
```

Raw activation token chỉ tồn tại để delivery đến Recruiter và không được persist.

SMTP delivery không phải persisted state atomic với `User`, `CompanyMember` hoặc `AuthToken`.

---

## 11.4. Hoàn tất Recruiter activation

### Trigger business

`F05`

### Trước

```text
User.mustChangePassword = true

AuthToken.type = RECRUITER_ACTIVATION
AuthToken = valid
```

### Sau

```text
User.passwordHash = hash của password do Recruiter tự đặt
User.mustChangePassword = false

RECRUITER_ACTIVATION token
= consumed / no longer usable
```

### Không thay đổi

```text
CompanyMember.status
CompanyMember.role
CompanyMember.companyId
```

Activation không tự unlock bất kỳ platform/company state nào.

---

## 11.5. Password reset hoàn tất

Áp dụng cho:

* `F06` — Recruiter self reset;
* `F07` — CM khởi tạo reset cho Recruiter.

### Trước

```text
PASSWORD_RESET token = valid
```

### Sau

```text
User.passwordHash = new password hash
User.mustChangePassword = false

PASSWORD_RESET token
= consumed / no longer usable

old AuthSession
= revoked
```

### Không thay đổi

```text
CompanyMember.status
Company.operationalStatus
User.status
```

Password reset không phải unlock transition.

---

## 11.6. Lock Recruiter

### Trigger

`F11`

### Trước

```text
CompanyMember.role = RECRUITER
CompanyMember.status = ACTIVE
```

### Sau

```text
CompanyMember.status = LOCKED
old AuthSession = revoked
```

### Không thay đổi

```text
User.status
User identity
employeeCode
jobTitle
companyId
role
```

---

## 11.7. Unlock Recruiter

### Trigger

`F12`

### Trước

```text
CompanyMember.status = LOCKED
```

### Sau

```text
CompanyMember.status = ACTIVE
```

Không tạo lại hoặc restore session cũ.

---

## 11.8. Terminate Recruiter

### Trigger

`F13`

Hợp lệ từ:

```text
ACTIVE
→ TERMINATED

LOCKED
→ TERMINATED
```

### Sau

```text
CompanyMember.status = TERMINATED
old AuthSession = revoked
```

Không xóa:

```text
User
CompanyMember
email
employeeCode
jobTitle
```

Không giải phóng email để tái sử dụng.

---

# 12. Transaction / Atomicity Requirements

Transaction/atomicity trong section này chỉ áp dụng cho persisted state thuộc database của hệ thống.

Không suy diễn thành distributed transaction với SMTP hoặc external service.

---

## TX-01 — Tạo Recruiter

**Business source**

* `F03`
* `BR-10`

Trong cùng transaction:

1. tạo `User`;
2. tạo `CompanyMember(RECRUITER)` tương ứng.

Sau commit bắt buộc:

```text
Recruiter User tồn tại
AND
Recruiter CompanyMember tồn tại
```

Không được có:

```text
User tồn tại
AND
CompanyMember không tồn tại
```

hoặc ngược lại.

Activation token và email delivery thuộc bước sau của lifecycle và không được nâng thành distributed atomic completion của TX-01.

---

## TX-02 — Hoàn tất Recruiter activation

**Business source**

* `F05`
* `BR-11`
* `BR-13`

Trong cùng database transaction:

1. xác nhận activation token có thể consume;
2. thay `User.passwordHash`;
3. chuyển `mustChangePassword` sang `false`;
4. consume/invalidate activation token.

Sau commit:

```text
password mới có hiệu lực
AND
activation gate đã hoàn tất
AND
activation token không thể dùng lại
```

Không được có trạng thái:

```text
password đã đổi
nhưng activation token vẫn usable
```

---

## TX-03 — Password reset completion

**Business source**

* `F06`
* `F07`
* `BR-17`

Trong cùng database atomic workflow:

1. cập nhật `User.passwordHash`;
2. bảo đảm `mustChangePassword = false`;
3. consume password reset token;
4. revoke các `AuthSession` cũ của User.

Sau completion:

```text
new password
+
old reset token unusable
+
old sessions unusable
```

Không thay đổi Company-level lock state.

---

## TX-04 — Lock Recruiter

**Business source**

* `F11`
* `BR-16`
* `BR-17`

Trong cùng database atomic workflow:

1. `CompanyMember.status: ACTIVE → LOCKED`;
2. revoke toàn bộ `AuthSession` hiện có của Recruiter.

Không được commit partial state trong đó:

```text
CompanyMember = LOCKED
nhưng old session vẫn còn hiệu lực persisted
```

---

## TX-05 — Terminate Recruiter

**Business source**

* `F13`
* `BR-17`
* `BR-19`

Trong cùng database atomic workflow:

1. `CompanyMember.status → TERMINATED`;
2. revoke toàn bộ session cũ.

Không hard delete User hoặc CompanyMember.

---

## TX-06 — Company onboarding sau khi V3 tồn tại

Đây là persistence adaptation để giữ nguyên V2 business behavior.

Khi tạo mới Company + Company Manager sau V3, cùng transaction phải tạo:

```text
User
role = COMPANY_STAFF

Company

CompanyMember
role = COMPANY_MANAGER
status = ACTIVE
```

Không được commit:

```text
Company
nhưng không có Company Manager membership
```

hoặc:

```text
COMPANY_STAFF Company Manager
nhưng không có CompanyMember
```

---

## TX-07 — Migration Company Manager V2 → V3

Với mỗi cặp Company–CM cần migrate:

Trong cùng transaction:

1. tạo `CompanyMember(COMPANY_MANAGER)`;
2. đổi `User.role` từ `COMPANY_MANAGER` sang `COMPANY_STAFF`.

Chỉ sau khi toàn bộ migration đã được verify:

```text
Company.managerUserId
```

mới được remove.

Không cần một distributed transaction cho toàn bộ database migration.

Atomicity requirement áp dụng trên từng persistence unit cần bảo vệ invariant.

---

# 13. Constraint Ownership

## 13.1. Database / schema bảo vệ

| Constraint                             | Owner    | Lý do                       |
| -------------------------------------- | -------- | --------------------------- |
| `User.email` required                  | Schema   | Local field                 |
| `User.email` unique                    | Database | Unique index                |
| `User.role` thuộc enum                 | Schema   | Local enum                  |
| `User.status` thuộc enum               | Schema   | Local enum                  |
| `CompanyMember.userId` required        | Schema   | Local field                 |
| Một User tối đa một CompanyMember      | Database | Unique index                |
| `CompanyMember.companyId` required     | Schema   | Local field                 |
| `CompanyMember.role` thuộc enum        | Schema   | Local enum                  |
| `CompanyMember.status` thuộc enum      | Schema   | Local enum                  |
| Recruiter có `employeeCode`            | Schema   | Role và field cùng document |
| Recruiter có `jobTitle`                | Schema   | Role và field cùng document |
| Employee code unique trong Company     | Database | Compound unique constraint  |
| Tối đa một CM membership mỗi Company   | Database | Partial unique index        |
| CM membership chỉ có `ACTIVE` trong V3 | Schema   | Local role/status invariant |
| `AuthToken.type` thuộc enum            | Schema   | Local enum                  |
| `AuthToken.tokenHash` unique           | Database | Unique index                |
| `AuthToken.expiresAt` required         | Schema   | Local field                 |

Database chỉ bảo vệ **at most one** Company Manager.

Không thể chỉ bằng unique index bảo đảm **exactly one** Company Manager luôn tồn tại.

---

## 13.2. Service bảo vệ

| Constraint                                                    | Owner                 | Lý do                      |
| ------------------------------------------------------------- | --------------------- | -------------------------- |
| `CompanyMember.userId` phải trỏ tới `COMPANY_STAFF`           | Service               | Cross-document             |
| Candidate không được có CompanyMember                         | Service               | Cross-document             |
| Platform Admin không được có CompanyMember                    | Service               | Cross-document             |
| Recruiter không dùng `PENDING_ACTIVATION`                     | Service               | Cross-document role/status |
| CM thao tác phải thuộc Company hợp lệ                         | Service               | Cross-document             |
| Recruiter target phải cùng Company với CM                     | Service               | Tenant authorization       |
| Backend phải derive tenant từ CM membership                   | Service               | Authorization              |
| Company phải approved + active cho business access            | Service               | Cross-document             |
| User phải active cho business access                          | Service               | Cross-document             |
| `mustChangePassword=false` cho business access                | Service               | Authorization gate         |
| `ACTIVE → LOCKED` hợp lệ                                      | Service               | Business transition        |
| `LOCKED → ACTIVE` hợp lệ                                      | Service               | Business transition        |
| `ACTIVE → TERMINATED` hợp lệ                                  | Service               | Business transition        |
| `LOCKED → TERMINATED` hợp lệ                                  | Service               | Business transition        |
| `TERMINATED → *` bị cấm                                       | Service               | Terminal state             |
| Password reset không unlock membership                        | Service               | Cross-state behavior       |
| Company luôn có đúng một CM sau commit                        | Service + Transaction | Cross-document invariant   |
| COMPANY_STAFF luôn có membership sau relevant business commit | Service + Transaction | Cross-document invariant   |

---

# 14. Token / TTL Lifecycle

## 14.1. Recruiter activation token

| Thuộc tính      | Contract                          |
| --------------- | --------------------------------- |
| Type            | `RECRUITER_ACTIVATION`            |
| Owner           | Recruiter `User`                  |
| Mục đích        | Initial activation/password setup |
| Tạo             | Sau khi Recruiter được persist    |
| Expiration      | Có `expiresAt`                    |
| Consumption     | Single-use                        |
| Persistence     | Chỉ persist `tokenHash`           |
| Raw token       | Không persist                     |
| Sau consumption | Không được usable lại             |

Exact lifetime không được Product Specification V3 quy định.

V3 không tự định nghĩa một business duration mới.

---

## 14.2. Password reset token

```text
PASSWORD_RESET
```

được sử dụng cho:

* Recruiter self forgot/reset;
* CM-initiated reset.

Lifecycle cơ bản tiếp tục theo authentication contract từ version trước.

V3 bổ sung yêu cầu:

sau reset thành công:

```text
old sessions
→ unusable
```

Password reset không thay đổi CompanyMember status.

---

## 14.3. External delivery boundary

SMTP chỉ là external side effect để chuyển activation/reset link đến Recruiter.

Database atomicity không bao gồm:

```text
database commit
+
SMTP delivery
```

như một distributed transaction.

Không yêu cầu:

* exactly-once email delivery;
* distributed rollback nếu SMTP thất bại;
* transaction bao phủ external mail provider.

Ordering tối thiểu:

```text
persist token hợp lệ
↓
sau đó mới có thể dispatch link chứa raw token
```

Không gửi raw token trước khi persistence cần thiết tồn tại.

---

# 15. Multi-tenant Data Boundary

## 15.1. Canonical tenant key

```text
Company._id
```

---

## 15.2. Resource ownership

| Resource                   | Tenant owner    | Cách xác định                                   |
| -------------------------- | --------------- | ----------------------------------------------- |
| `CompanyMember`            | `Company`       | `CompanyMember.companyId`                       |
| Recruiter employment data  | `Company`       | `CompanyMember.companyId`                       |
| Company Manager membership | `Company`       | `CompanyMember.companyId`                       |
| `User`                     | Global identity | Không tenant-owned trực tiếp                    |
| `AuthSession`              | User            | Resolve Company thông qua CompanyMember khi cần |
| `AuthToken`                | User            | Không dùng làm tenant authorization source      |

---

## 15.3. Backend tenant resolution

```text
Authenticated User
        ↓
CompanyMember
role = COMPANY_MANAGER
        ↓
CompanyMember.companyId
        ↓
Canonical Company
        ↓
CompanyMember resources
cùng companyId
```

Không dùng:

```text
client.companyId
```

làm authorization source.

Client có gửi Company identifier cũng không làm thay đổi canonical tenant.

---

## 15.4. Cross-tenant reference

Không được tồn tại business operation tạo:

```text
CM của Company A
→ Recruiter CompanyMember của Company B
```

hoặc:

```text
CM Company A
→ tạo Recruiter với companyId = Company B
```

`CompanyMember.companyId` khi tạo Recruiter phải được derive từ authenticated Company Manager.

---

# 16. Snapshot / Historical Data

V3 không bổ sung snapshot collection/document mới.

`CompanyReviewSnapshot` tiếp tục theo V2 và không bị V3 thay đổi.

Recruiter historical identity được giữ bằng live persistent records:

```text
User
+
CompanyMember
```

kể cả khi:

```text
CompanyMember.status = TERMINATED
```

Không tạo thêm:

* Recruiter history snapshot;
* termination snapshot;
* employee metadata history;
* audit snapshot.

---

# 17. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V3:

```text
Recruiter
RecruiterProfile
RecruiterAccount
```

collection riêng.

Không thêm trên `User`:

```text
companyId
companyRole
recruiterStatus
employeeCode
jobTitle
```

Không thêm trên `Company`:

```text
managerUserId
managerMemberId
recruiterIds
memberIds
```

sau migration.

Không thêm vào `CompanyMember.role`:

```text
PRIMARY_RECRUITER
SUPPORTING_RECRUITER
RECRUITER_ADMIN
RECRUITER_LEADER
```

Không thêm state:

```text
PENDING_ACTIVATION
```

vào `CompanyMember.status`.

Không thêm:

* Job membership;
* recruitment team fields;
* Application ownership;
* Invitation ownership;
* primary/supporting role data;
* manager replacement history;
* terminated Company Manager history model;
* Recruiter transfer data;
* Recruiter update history;
* audit collection chỉ cho V3;
* password plaintext;
* raw activation token;
* raw password-reset token;
* SMTP delivery status chỉ để hỗ trợ theoretical failure handling;
* distributed transaction metadata;
* exactly-once mail delivery state;
* speculative external side-effect outbox nếu chưa có canonical requirement.

V3 cũng không thêm một field `activationStatus` riêng.

Activation readiness được biểu diễn bằng dữ liệu đã cần thiết:

```text
User.mustChangePassword
+
RECRUITER_ACTIVATION token lifecycle
```

Không tạo state dimension mới nếu Product Specification không yêu cầu.

---

# 18. Compatibility với version trước

## 18.1. Invariant phải giữ

* một email chỉ thuộc một User;
* Company và Company Manager là hai entity riêng;
* mỗi Company có đúng một Company Manager hiện tại;
* `PENDING_ACTIVATION` của CM giữ nguyên semantics;
* Company approval lifecycle giữ nguyên;
* Company operational lifecycle giữ nguyên;
* Platform-level lock/termination giữ nguyên semantics;
* CompanyReviewSnapshot giữ nguyên lifecycle;
* AuthSession vẫn thuộc User;
* AuthToken vẫn thuộc User.

---

## 18.2. Persistence behavior phải giữ

Sau Platform Admin approve Company:

```text
Company.approvalStatus = APPROVED
```

không tự suy diễn thành:

```text
Company.operationalStatus = ACTIVE
User CM.status = ACTIVE
```

Các transition activation Company tiếp tục theo V2.

V3 chỉ thay đổi cách persistence xác định ai là Company Manager.

---

## 18.3. Thay đổi được phép

```text
User.role:
COMPANY_MANAGER
→ COMPANY_STAFF
```

Bổ sung:

```text
CompanyMember
role = COMPANY_MANAGER
```

Bỏ:

```text
Company.managerUserId
```

Bổ sung token type:

```text
RECRUITER_ACTIVATION
```

để hỗ trợ Product Specification V3 mới.

---

## 18.4. Thay đổi không được phép

Không được:

* đổi semantics `PENDING_ACTIVATION`;
* gộp Company với Company Manager;
* thêm `RECRUITER` vào User platform role;
* giữ `managerUserId` như source of truth thứ hai;
* dùng Company-level status thay cho User platform status;
* dùng User platform status thay cho CompanyMember status;
* biến activation flow của Recruiter thành Company approval flow;
* sử dụng thiết kế password tạm cũ để override activation behavior đã được Product Spec chốt.

---

# 19. Persistence Invariants

Các invariant sau phải luôn đúng sau khi relevant database operation commit:

1. `User.email` là unique toàn hệ thống.
2. Mọi `CompanyMember.userId` tham chiếu tới một User tồn tại.
3. Mọi `CompanyMember.companyId` tham chiếu tới một Company tồn tại.
4. Một User có tối đa một CompanyMember.
5. Mọi Company Staff được tạo bởi các V3 workflow liên quan phải có đúng một CompanyMember sau commit.
6. Mọi CompanyMember phải thuộc User có `role = COMPANY_STAFF`.
7. Một CompanyMember chỉ thuộc một Company.
8. Một CompanyMember chỉ có một Company role.
9. Một Company có tối đa một persisted `COMPANY_MANAGER` membership.
10. Các workflow tạo/onboard Company phải bảo đảm Company có đúng một Company Manager sau commit.
11. Company Manager membership của V3 có `status = ACTIVE`.
12. Recruiter membership có thể là `ACTIVE`, `LOCKED` hoặc `TERMINATED`.
13. Recruiter không dùng `User.status = PENDING_ACTIVATION`.
14. Recruiter phải có `employeeCode`.
15. Recruiter phải có `jobTitle`.
16. Employee code không trùng trong cùng Company.
17. Recruiter mới có `mustChangePassword = true` cho tới activation completion.
18. Activation completion phải làm activation token không thể dùng lại.
19. Activation completion phải persist password mới trước khi Recruiter được coi là qua password gate.
20. Password reset completion không thay đổi CompanyMember status.
21. `ACTIVE → LOCKED` là hợp lệ với Recruiter.
22. `LOCKED → ACTIVE` là hợp lệ với Recruiter.
23. `ACTIVE → TERMINATED` là hợp lệ với Recruiter.
24. `LOCKED → TERMINATED` là hợp lệ với Recruiter.
25. `TERMINATED → ACTIVE` không hợp lệ.
26. `TERMINATED → LOCKED` không hợp lệ.
27. Lock và termination không hard-delete User.
28. Lock và termination không hard-delete CompanyMember.
29. Email của terminated User không được giải phóng.
30. Security transition yêu cầu revoke session không được để session cũ tiếp tục là persisted valid session sau atomic completion.
31. `AuthSession` thuộc User, không thuộc CompanyMember.
32. `AuthToken` thuộc User, không thuộc CompanyMember.
33. Raw credential và raw token không được persist.
34. Company tenant của Recruiter được xác định từ `CompanyMember.companyId`.
35. Client-supplied Company identifier không phải authorization source.
36. `Company.managerUserId` không còn tồn tại sau V3 migration hoàn tất.
37. Company Manager source of truth duy nhất là `CompanyMember`.
38. Không tồn tại Recruiter-specific collection.
39. Không persist Job/team/Application data như một phần của V3.
40. External SMTP delivery không thuộc database atomic completion trừ khi canonical contract sau này quy định khác.

---

# 20. Definition of Data Completion

Data Contract V3 được coi là hoàn thành khi:

* `users` đã phản ánh platform role `COMPANY_STAFF`;
* `company_members` đã được định nghĩa đầy đủ;
* `companies.managerUserId` đã có migration/removal contract;
* Recruiter employee fields đã có required/uniqueness contract;
* Company Manager uniqueness đã có enforcement rõ;
* activation persistence đã được xác định;
* `RECRUITER_ACTIVATION` token lifecycle đã rõ;
* password reset persistence đã rõ;
* session revocation persistence đã rõ;
* state matrix đã rõ;
* persistence transitions đã rõ;
* transaction/atomicity requirements đã rõ;
* constraint ownership giữa database/schema và service đã rõ;
* tenant ownership đã rõ;
* V2 compatibility đã rõ;
* migration V2 → V3 đã rõ;
* historical identity retention đã rõ;
* không có speculative field/collection ngoài requirement;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn.

Data Completion không đồng nghĩa schema đã được code.

Nó có nghĩa persistence contract đã đủ rõ để implementation không cần tự quyết định các vấn đề data architecture quan trọng của V3.

---

# 21. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V3.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entity;
* collection;
* field;
* embedded document;
* reference;
* cardinality;
* enum;
* index;
* uniqueness;
* token persistence;
* state representation;
* persistence transition;
* transaction/atomicity;
* data ownership;
* constraint ownership;
* migration;
* persistence invariant.

Tài liệu này không định nghĩa:

* REST endpoint;
* HTTP method;
* HTTP status;
* request/response body;
* controller;
* service function structure;
* route;
* middleware implementation;
* MongoDB query cụ thể;
* Mongoose API cụ thể;
* source-code structure;
* UI;
* frontend flow;
* test framework.

Boundary canonical:

```text
Product Specification
        │
        │ WHAT MUST HAPPEN
        ↓
Data Contract
        │
        │ WHAT MUST EXIST / PERSIST
        ↓
Engineering Contracts
        │
        │ HOW THE SYSTEM IS STRUCTURED
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

Raw idea / macro database / diagrams
→ input material only
```

Nếu macro database, entity diagram hoặc implementation hiện tại mâu thuẫn với Product Specification V3, chúng không được dùng để thay đổi business behavior.

Nếu persistence design trong tương lai cần một behavior chưa tồn tại trong Product Specification, vấn đề đó phải được đưa trở lại Product layer để được quyết định trước.
