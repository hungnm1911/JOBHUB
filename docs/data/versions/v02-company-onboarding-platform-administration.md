# V02 — Company onboarding và quản trị cấp nền tảng Data Model

> **File:** `docs/data/versions/v02-company-onboarding-platform-administration-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v02-company-onboarding-platform-administration.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v02-company-onboarding-platform-administration.md
```

Product Specification là authority đối với business behavior.

Macro database và entity diagram của V02 chỉ là input cho persistence design. Những điểm của các input đó mâu thuẫn với Product Specification không được giữ lại trong canonical data contract.

V02 Data Model xác định:

- dữ liệu cần persist cho Company onboarding;
- quan hệ `Company Manager ↔ Company`;
- representation của approval state và operational state;
- snapshot xét duyệt;
- confirmation token sau khi Platform Admin approve;
- transaction/atomicity cần thiết giữa `User`, `Company`, `AuthToken` và `AuthSession`;
- constraint do database/schema bảo vệ;
- constraint do service bảo vệ;
- tenant ownership từ `Company`;
- các persistence structure chủ động không thêm.

Tài liệu này không tạo business behavior mới ngoài Product Specification.

---

## 2. Thay đổi so với version trước

V02 kế thừa ba collection của V01 và bổ sung `companies`.

| Entity / Collection | Trạng thái | Mô tả |
| --- | --- | --- |
| `users` | `UPDATED` | Bổ sung `PENDING_ACTIVATION` vào account status để biểu diễn Company Manager đang onboarding. |
| `auth_sessions` | `UNCHANGED` | Giữ nguyên contract V01; được sử dụng khi Company Manager bị chuyển sang `TERMINATED`. |
| `auth_tokens` | `UPDATED` | Bổ sung loại `COMPANY_APPROVAL_CONFIRMATION`. |
| `companies` | `NEW` | Lưu Company profile, quan hệ với Company Manager, state, review snapshot và các mốc lifecycle của V02. |

### 2.1. Entity mới

- `Company` / collection `companies`.
- `CompanyReviewSnapshot` là embedded value object bên trong `Company`, không phải collection độc lập.

### 2.2. Entity được mở rộng

- `User`:
  - bổ sung `PENDING_ACTIVATION` vào enum `status`;
  - không thêm `companyId`.
- `AuthToken`:
  - bổ sung `COMPANY_APPROVAL_CONFIRMATION` vào enum `type`.

### 2.3. Entity giữ nguyên nhưng được sử dụng

- `AuthSession`.

V02 không thay đổi persistence contract của Candidate trong V01.

Đặc biệt, việc bổ sung `PENDING_ACTIVATION` không được làm thay đổi default/lifecycle V01 của Candidate. Company Manager trong F01 phải được persist rõ ràng với `status = PENDING_ACTIVATION`.

---

## 3. Collection / Entity tổng thể

V02 sử dụng đúng các collection:

```text
users
auth_sessions
auth_tokens
companies
```

Embedded structure:

```text
Company
└── reviewSnapshot : CompanyReviewSnapshot
```

Vai trò tổng quát:

| Entity / Collection | Responsibility |
| --- | --- |
| `users` | Identity, credentials, role và account status của Candidate, Company Manager, Platform Admin. |
| `auth_sessions` | Phiên đăng nhập theo V01 schema; được dùng cho normal ACTIVE authentication và cho limited onboarding authentication của Company Manager `PENDING_ACTIVATION`; dùng để revoke toàn bộ session khi Company Manager bị terminate. |
| `auth_tokens` | Token tạm thời của authentication; V02 bổ sung approval confirmation token cho Company Manager. |
| `companies` | Company profile, manager ownership, approval state, operational state, review snapshot và lifecycle timestamps. |
| `CompanyReviewSnapshot` | Bản chụp immutable của Company profile tại đúng thời điểm submit. |

Không tạo collection `company_review_snapshots`.

Entity diagram có thể biểu diễn `CompanyReviewSnapshot` như một box logic để mô tả cấu trúc, nhưng canonical persistence của V02 coi snapshot là embedded document thuộc `Company`.

Không tạo thêm collection ngoài danh sách trên nếu chưa có canonical requirement mới.

---

## 4. Quan hệ dữ liệu

```text
User(COMPANY_MANAGER) 1 ───── 1 Company

User(PLATFORM_ADMIN)  1 ───── N Company
                         review decision

User                   1 ───── N AuthSession

User                   1 ───── N AuthToken
```

### 4.1. Company Manager → Company

**Cardinality**

```text
User(COMPANY_MANAGER) 1 ───── 1 Company
```

**Owner của relationship**

`Company`.

**Reference**

```text
Company.managerUserId → User._id
```

**Constraint**

- `managerUserId` bắt buộc tồn tại trên mọi Company.
- `managerUserId` phải unique.
- User được reference phải có `role = COMPANY_MANAGER`.
- Một Company Manager không được có Company thứ hai.
- Một Company không có manager thứ hai.
- Không lưu reference ngược `User.companyId`.

**Lifecycle**

- Relationship được tạo cùng onboarding F01.
- Relationship không được thay đổi trong V02.
- Company không có lifecycle hợp lệ trong V02 nếu mất relationship này.

### 4.2. Platform Admin → Company review

**Cardinality**

```text
User(PLATFORM_ADMIN) 1 ───── N Company
```

**Reference**

```text
Company.reviewedByUserId → User._id
```

**Ý nghĩa**

Reference chỉ lưu Platform Admin đã đưa ra quyết định approve/reject hiện tại.

Reference này:

- không biểu diễn ownership;
- không biến Platform Admin thành Company Manager;
- không biến Platform Admin thành tenant member;
- không tạo quyền thực hiện nghiệp vụ tuyển dụng thay Company.

`reviewedByUserId` được phép `null` trước khi có quyết định review.

### 4.3. User → AuthSession

Giữ nguyên V01:

```text
User 1 ───── N AuthSession
```

Reference:

```text
AuthSession.userId → User._id
```

Khi Company Manager bị terminate bởi F10, toàn bộ `AuthSession` của User đó phải bị revoke theo invariant tài khoản của V01.

Company Manager `PENDING_ACTIVATION` được phép sở hữu `AuthSession` cho limited onboarding authentication theo Product `BR-21`. Việc tồn tại session đó không đồng nghĩa User đã `ACTIVE` hoặc đã có `emailVerifiedAt`.

### 4.4. User → AuthToken

Giữ quan hệ V01:

```text
User 1 ───── N AuthToken
```

Reference:

```text
AuthToken.userId → User._id
```

V02 sử dụng quan hệ này cho:

```text
COMPANY_APPROVAL_CONFIRMATION
```

Không thêm `companyId` vào `AuthToken`.

Company tương ứng được resolve thông qua relationship canonical:

```text
AuthToken.userId
        ↓
User(COMPANY_MANAGER)
        ↓
Company.managerUserId
        ↓
Company
```

---

# 5. `users`

## 5.1. Responsibility

`users` tiếp tục chịu trách nhiệm persistence cho:

- identity của User;
- credentials;
- role;
- account status;
- email verification state;
- các field User đã có từ V01.

V02 chỉ mở rộng account state để biểu diễn Company Manager chưa hoàn tất onboarding.

`users` không chịu trách nhiệm lưu:

- Company profile;
- Company approval state;
- Company operational state;
- tenant ownership bằng `companyId`;
- Company review snapshot;
- Company review history.

## 5.2. Fields

| Field | Type | Required | Default | Constraint | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | YES | generated | unique | Định danh User. |
| `fullName` | `String` | YES | — | V01 | Tên User. |
| `avatarUrl` | `String` | NO | `null` | V01 | Avatar User. |
| `dateOfBirth` | `Date` | NO | `null` | V01 | Ngày sinh. |
| `phoneNumber` | `String` | NO | `null` | V01 | Số điện thoại. |
| `email` | `String` | YES | — | unique | Định danh đăng nhập toàn hệ thống. |
| `passwordHash` | `String` | YES | — | V01 | Credential đã persist theo contract V01. |
| `role` | `String` | YES | — | enum | Vai trò User. |
| `status` | `String` | YES | V01 default | enum | Trạng thái account; V02 bổ sung `PENDING_ACTIVATION`. |
| `emailVerifiedAt` | `Date` | NO | `null` | — | Thời điểm email được xác minh; với Company Manager onboarding vẫn `null` cho đến F07/TX-03. |
| `mustChangePassword` | `Boolean` | YES | `false` | V01 | Giữ nguyên persistence field V01; V02 không tạo flow mới cho field này. |
| `createdAt` | `Date` | YES | automatic | — | Thời điểm tạo. |
| `updatedAt` | `Date` | YES | automatic | — | Thời điểm cập nhật. |

V02 không đổi default `User.status` toàn cục sang `PENDING_ACTIVATION`.

F01 phải persist Company Manager onboarding bằng giá trị explicit:

```text
role   = COMPANY_MANAGER
status = PENDING_ACTIVATION
```

Nhờ đó Candidate lifecycle V01 không bị thay đổi.

## 5.3. Enum

### `role`

Giữ nguyên V01:

```text
CANDIDATE
COMPANY_MANAGER
PLATFORM_ADMIN
```

### `status`

V02 canonical enum:

```text
PENDING_ACTIVATION
ACTIVE
LOCKED
TERMINATED
```

| Giá trị | Ý nghĩa liên quan V02 |
| --- | --- |
| `PENDING_ACTIVATION` | Company Manager đã được tạo nhưng onboarding Company chưa hoàn tất; được phép có limited onboarding authentication session theo Product `BR-21` khi credentials hợp lệ dù `emailVerifiedAt = null`. |
| `ACTIVE` | User active theo normal authentication contract V01. |
| `LOCKED` | Trạng thái V01, không phải trạng thái mà F10 dùng cho Company Manager. |
| `TERMINATED` | Quyền truy cập User đã bị chấm dứt; F10 chuyển Company Manager tới trạng thái này. |

## 5.4. Indexes

Giữ index V01:

| Index | Loại | Mục đích |
| --- | --- | --- |
| `{ email: 1 }` | Unique | Bảo vệ email login duy nhất toàn hệ thống. |

V02 không bổ sung index `companyId` trên `User` vì field đó không tồn tại.

## 5.5. Embedded documents

> `User` không bổ sung embedded document mới trong V02.

## 5.6. Reference rules

`User` không giữ reference tới `Company` trong V02.

Canonical direction của relationship là:

```text
Company.managerUserId → User._id
```

---

# 6. `auth_sessions`

## 6.1. Responsibility

Giữ nguyên schema/persistence contract V01.

`auth_sessions` lưu session của User và là persistence source dùng để revoke quyền truy cập theo session lifecycle.

Trong V02, cùng collection này được dùng để persist:

- session của normal ACTIVE authentication (V01);
- session của limited onboarding authentication cho Company Manager `PENDING_ACTIVATION` theo Product `BR-21`.

V02 **không** thêm field/enum riêng trên `AuthSession` để phân biệt hai context. Phân biệt authorization context là trách nhiệm service theo `User.role` + `User.status` và Product scope; persistence chỉ cần ghi nhận session thuộc User.

Tạo onboarding session:

- không đổi `User.status`;
- không set `User.emailVerifiedAt`;
- không làm User thành `ACTIVE`.

V02 cũng sử dụng collection này trong F10 khi Company Manager bị chuyển sang `TERMINATED` và toàn bộ session phải bị revoke.

## 6.2. Fields

| Field | Type | Required | Default | Constraint | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | YES | generated | unique | Định danh session. |
| `userId` | `ObjectId` | YES | — | ref `User` | User sở hữu session. |
| `refreshTokenHash` | `String` | YES | — | unique | Refresh credential persisted theo V01. |
| `expiresAt` | `Date` | YES | — | expiration | Hạn hiệu lực session. |
| `createdAt` | `Date` | YES | automatic | — | Thời điểm tạo session. |

## 6.3. Enum

> `AuthSession` không bổ sung enum mới trong V02.

## 6.4. Indexes

Giữ nguyên index contract V01:

| Index | Loại | Mục đích |
| --- | --- | --- |
| `{ refreshTokenHash: 1 }` | Unique | Bảo vệ refresh credential hash duy nhất. |
| `{ userId: 1 }` | Normal | Lookup/revoke toàn bộ session của một User. |
| `{ expiresAt: 1 }` | TTL | Cleanup session đã hết hạn. |

TTL cleanup không thay thế việc kiểm tra `expiresAt` khi xác định session hợp lệ.

## 6.5. Embedded documents

> Không có embedded document mới.

## 6.6. Reference rules

| Field | Reference | Required | Cardinality | Rule |
| --- | --- | --- | --- | --- |
| `userId` | `User` | YES | N → 1 | Session phải thuộc một User tồn tại theo contract V01. |

---

# 7. `auth_tokens`

## 7.1. Responsibility

Giữ persistence responsibilities của V01 đối với:

- `EMAIL_VERIFICATION`;
- `PASSWORD_RESET`.

V02 bổ sung:

- `COMPANY_APPROVAL_CONFIRMATION`.

`auth_tokens` không lưu:

- raw token;
- Company profile;
- Company state;
- `companyId`;
- email delivery status.

## 7.2. Fields

| Field | Type | Required | Default | Constraint | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | YES | generated | unique | Định danh token record. |
| `userId` | `ObjectId` | YES | — | ref `User` | User sở hữu token. |
| `type` | `String` | YES | — | enum | Loại token. |
| `tokenHash` | `String` | YES | — | unique | Giá trị token đã được persist theo dạng hash. |
| `expiresAt` | `Date` | YES | — | expiration | Hạn sử dụng. |
| `createdAt` | `Date` | YES | automatic | — | Thời điểm tạo token. |

## 7.3. Enum

### `type`

```text
EMAIL_VERIFICATION
PASSWORD_RESET
COMPANY_APPROVAL_CONFIRMATION
```

`COMPANY_APPROVAL_CONFIRMATION` là giá trị mới của V02.

## 7.4. Indexes

| Index | Loại | Mục đích |
| --- | --- | --- |
| `{ tokenHash: 1 }` | Unique | Bảo vệ token hash duy nhất. |
| `{ userId: 1, type: 1 }` | Compound | Lookup token theo owner và purpose. |
| `{ expiresAt: 1 }` | TTL | Cleanup token hết hạn. |

TTL chỉ là cleanup mechanism.

Business validity luôn phải kiểm tra `expiresAt` trước khi consume.

## 7.5. Embedded documents

> Không có embedded document mới.

## 7.6. Reference rules

| Field | Reference | Required | Cardinality | Rule |
| --- | --- | --- | --- | --- |
| `userId` | `User` | YES | N → 1 | Với `COMPANY_APPROVAL_CONFIRMATION`, User phải là Company Manager của Company đang `APPROVED + INACTIVE`. |

---

# 8. `companies`

## 8.1. Responsibility

`companies` là collection mới của V02.

Collection này chịu trách nhiệm persist:

- Company identity;
- Company profile;
- relationship 1–1 với Company Manager;
- Company approval state;
- Company operational state;
- review snapshot;
- current reviewer;
- lifecycle timestamps cần thiết;
- tenant identity thông qua `Company._id`.

Collection này không chịu trách nhiệm persist:

- Company credentials;
- Recruiter;
- CompanyMember;
- Job;
- Application;
- review history;
- lock history;
- rejection reason;
- manager replacement history;
- archive/delete lifecycle.

## 8.2. Fields

| Field | Type | Required | Default | Constraint | Ý nghĩa |
| --- | --- | --- | --- | --- | --- |
| `_id` | `ObjectId` | YES | generated | unique | Định danh Company và canonical tenant key. |
| `managerUserId` | `ObjectId` | YES | — | ref `User`, unique | Company Manager duy nhất của Company. |
| `name` | `String` | NO | `null` | required khi submit | Tên Company. |
| `logoUrl` | `String` | NO | `null` | — | Logo Company. |
| `bannerUrl` | `String` | NO | `null` | — | Banner Company. |
| `website` | `String` | NO | `null` | — | Website Company. |
| `address` | `String` | NO | `null` | — | Địa chỉ Company. |
| `description` | `String` | NO | `null` | — | Mô tả Company. |
| `contactInfo` | `String` | NO | `null` | — | Thông tin liên hệ. |
| `businessRegistrationNumber` | `String` | NO | `null` | required khi submit, unique khi có giá trị | Mã số doanh nghiệp. |
| `reviewSnapshot` | `CompanyReviewSnapshot` | NO | `null` | conditional, immutable sau submit | Snapshot hồ sơ dùng để xét duyệt. |
| `approvalStatus` | `String` | YES | `NOT_SUBMITTED` | enum | Trạng thái xét duyệt. |
| `operationalStatus` | `String` | YES | `INACTIVE` | enum | Trạng thái hoạt động. |
| `submittedAt` | `Date` | NO | `null` | conditional | Thời điểm Company được submit; đồng thời là thời điểm snapshot được chụp. |
| `reviewedByUserId` | `ObjectId` | NO | `null` | ref `User`, conditional | Platform Admin đưa ra quyết định approve/reject hiện tại. |
| `reviewedAt` | `Date` | NO | `null` | conditional | Thời điểm approve/reject. |
| `activatedAt` | `Date` | NO | `null` | conditional | Thời điểm Company lần đầu được active. |
| `createdAt` | `Date` | YES | automatic | — | Thời điểm tạo Company. |
| `updatedAt` | `Date` | YES | automatic | — | Thời điểm cập nhật Company. |

### Required theo lifecycle

`name` và `businessRegistrationNumber` không được đặt structural `required = true` cho toàn bộ lifecycle vì `NOT_SUBMITTED + INACTIVE` cho phép Company draft chưa hoàn chỉnh.

Tuy nhiên trước transition submit:

```text
name != null
businessRegistrationNumber != null
```

là bắt buộc.

Sau khi Company rời `NOT_SUBMITTED`, hai field này không được trở về `null`.

## 8.3. Enum

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

Không thêm:

```text
AWAITING_CM_CONFIRMATION
RESUBMITTED
ARCHIVED
DELETED
```

Trạng thái Admin đã approve nhưng CM chưa xác nhận được biểu diễn bằng:

```text
approvalStatus    = APPROVED
operationalStatus = INACTIVE
```

## 8.4. Indexes

| Index | Loại | Mục đích |
| --- | --- | --- |
| `{ managerUserId: 1 }` | Unique | Bảo vệ một User tối đa làm manager của một Company và hỗ trợ tenant resolution. |
| `{ businessRegistrationNumber: 1 }` | Unique partial | Bảo vệ mã số doanh nghiệp duy nhất đối với document đã có giá trị; cho phép Company draft chưa nhập mã. |
| `{ approvalStatus: 1 }` | Normal | Hỗ trợ phạm vi dữ liệu đăng ký Company mà Platform Admin cần xét duyệt. |

Không tạo unique index cho `name`.

Không tạo index `User.companyId` vì field đó không tồn tại.

## 8.5. Embedded documents

### `CompanyReviewSnapshot`

Canonical persistence:

```text
Company.reviewSnapshot {
  name
  logoUrl
  bannerUrl
  website
  address
  description
  contactInfo
  businessRegistrationNumber
}
```

Snapshot:

- thuộc trực tiếp một `Company`;
- không có lifecycle độc lập;
- không có `_id` riêng theo business contract;
- không có `createdAt` riêng;
- sử dụng `Company.submittedAt` làm thời điểm capture;
- chỉ được tạo tại transition F03;
- chỉ được tạo một lần trong V02;
- immutable sau khi được tạo;
- không được cập nhật khi live Company profile thay đổi sau activation;
- tồn tại cùng Company kể cả sau `REJECTED` hoặc `LOCKED`.

## 8.6. Reference rules

| Field | Reference | Required | Cardinality | Rule |
| --- | --- | --- | --- | --- |
| `managerUserId` | `User` | YES | 1 → 1 | User phải có `role = COMPANY_MANAGER`; relationship không thay đổi trong V02. |
| `reviewedByUserId` | `User` | NO | N → 1 | Khi có giá trị, User phải có `role = PLATFORM_ADMIN`. |

Database/reference structure không tự chứng minh role của referenced User.

Role validity thuộc service constraint.

---

# 9. State Matrix

Canonical persisted lifecycle phải đồng thời xét:

- `User.status` của Company Manager;
- `Company.approvalStatus`;
- `Company.operationalStatus`.

Chỉ sáu tổ hợp sau thuộc V02:

| Company Manager status | Approval | Operational | Hợp lệ | Persistence condition |
| --- | --- | --- | --- | --- |
| `PENDING_ACTIVATION` | `NOT_SUBMITTED` | `INACTIVE` | YES | `reviewSnapshot = null`, `submittedAt = null`, chưa có review decision. |
| `PENDING_ACTIVATION` | `PENDING` | `INACTIVE` | YES | `reviewSnapshot` tồn tại, `submittedAt` tồn tại, chưa có review decision. |
| `PENDING_ACTIVATION` | `REJECTED` | `INACTIVE` | YES | Snapshot/submission tồn tại; `reviewedByUserId` và `reviewedAt` tồn tại; `activatedAt = null`. |
| `PENDING_ACTIVATION` | `APPROVED` | `INACTIVE` | YES | Snapshot/submission/review tồn tại; `activatedAt = null`; đang chờ confirmation. |
| `ACTIVE` | `APPROVED` | `ACTIVE` | YES | Snapshot/submission/review/activation timestamps tồn tại. |
| `TERMINATED` | `APPROVED` | `LOCKED` | YES | Company đã từng active; `activatedAt` vẫn được giữ; Company Manager không còn active session hợp lệ. |

Các tổ hợp sau không thuộc persisted lifecycle V02:

```text
NOT_SUBMITTED + ACTIVE
NOT_SUBMITTED + LOCKED
PENDING + ACTIVE
PENDING + LOCKED
REJECTED + ACTIVE
REJECTED + LOCKED
APPROVED + ACTIVE với CM PENDING_ACTIVATION
APPROVED + INACTIVE với CM ACTIVE
APPROVED + LOCKED với CM ACTIVE
APPROVED + LOCKED với CM LOCKED
```

V02 không có:

```text
LOCKED → ACTIVE
REJECTED → PENDING
REJECTED → APPROVED
```

### 9.1. Local Company state constraints

Các pair Company hợp lệ:

```text
NOT_SUBMITTED + INACTIVE
PENDING       + INACTIVE
REJECTED      + INACTIVE
APPROVED      + INACTIVE
APPROVED      + ACTIVE
APPROVED      + LOCKED
```

### 9.2. Conditional data constraints

**`NOT_SUBMITTED + INACTIVE`**

```text
reviewSnapshot   = null
submittedAt      = null
reviewedByUserId = null
reviewedAt       = null
activatedAt      = null
```

**`PENDING + INACTIVE`**

```text
reviewSnapshot   != null
submittedAt      != null
reviewedByUserId = null
reviewedAt       = null
activatedAt      = null
```

**`REJECTED + INACTIVE`**

```text
reviewSnapshot   != null
submittedAt      != null
reviewedByUserId != null
reviewedAt       != null
activatedAt      = null
```

**`APPROVED + INACTIVE`**

```text
reviewSnapshot   != null
submittedAt      != null
reviewedByUserId != null
reviewedAt       != null
activatedAt      = null
```

**`APPROVED + ACTIVE`**

```text
reviewSnapshot   != null
submittedAt      != null
reviewedByUserId != null
reviewedAt       != null
activatedAt      != null
```

**`APPROVED + LOCKED`**

```text
reviewSnapshot   != null
submittedAt      != null
reviewedByUserId != null
reviewedAt       != null
activatedAt      != null
```

Timestamp ordering khi cùng tồn tại:

```text
submittedAt <= reviewedAt <= activatedAt
```

---

# 10. Persistence Transitions

## 10.1. PT-01 — Khởi tạo onboarding

### Business source

- `F01`
- `BR-01`
- `BR-02`
- `BR-04`

### Trước

```text
Không có User COMPANY_MANAGER của onboarding
Không có Company tương ứng
```

### Sau

```text
User
role   = COMPANY_MANAGER
status = PENDING_ACTIVATION

Company
managerUserId      = User._id
approvalStatus     = NOT_SUBMITTED
operationalStatus  = INACTIVE
reviewSnapshot     = null
submittedAt        = null
reviewedByUserId   = null
reviewedAt         = null
activatedAt        = null
```

### Entity thay đổi

- `users`
- `companies`

### Invariant

Không được persist Company Manager onboarding độc lập khỏi Company tương ứng.

---

## 10.2. PT-02 — Cập nhật Company draft

### Business source

- `F02`

### Trước

```text
Company = NOT_SUBMITTED + INACTIVE
```

### Sau

Các live profile field được cập nhật nhưng:

```text
approvalStatus    = NOT_SUBMITTED
operationalStatus = INACTIVE
reviewSnapshot    = null
submittedAt       = null
```

### Field có thể thay đổi

- `name`
- `logoUrl`
- `bannerUrl`
- `website`
- `address`
- `description`
- `contactInfo`
- `businessRegistrationNumber`

### Invariant

Relationship `managerUserId` không thay đổi.

---

## 10.3. PT-03 — Submit Company

### Business source

- `F03`
- `BR-05`
- `BR-06`
- `BR-07`
- `BR-08`

### Trước

```text
approvalStatus    = NOT_SUBMITTED
operationalStatus = INACTIVE
reviewSnapshot    = null
submittedAt       = null

name                       != null
businessRegistrationNumber != null
```

### Sau

```text
reviewSnapshot = copy của live Company profile tại thời điểm submit
submittedAt    = now
approvalStatus = PENDING

operationalStatus = INACTIVE
```

### Entity thay đổi

- `companies`

### Invariant

- snapshot và state `PENDING` phải xuất hiện cùng một atomic Company-document transition;
- snapshot chỉ được tạo một lần;
- từ thời điểm này Company profile không được sửa cho tới khi lifecycle cho phép F09.

---

## 10.4. PT-04 — Platform Admin approve

### Business source

- `F05`
- `BR-07`
- `BR-10`
- `BR-14`

### Trước

```text
Company
approvalStatus    = PENDING
operationalStatus = INACTIVE
reviewSnapshot    != null

User(CM)
status = PENDING_ACTIVATION
```

### Sau

```text
Company
approvalStatus     = APPROVED
operationalStatus  = INACTIVE
reviewedByUserId   = PlatformAdmin._id
reviewedAt         = now
activatedAt        = null

User(CM)
status = PENDING_ACTIVATION

AuthToken
type   = COMPANY_APPROVAL_CONFIRMATION
userId = Company.managerUserId
```

### Entity thay đổi

- `companies`
- `auth_tokens`

### Entity không thay đổi

- Company Manager `User.status`
- Company `operationalStatus`

### Invariant

Admin approve không được tạo persisted state `Company ACTIVE`.

---

## 10.5. PT-05 — Platform Admin reject

### Business source

- `F06`
- `BR-09`
- `BR-14`

### Trước

```text
Company = PENDING + INACTIVE
User(CM).status = PENDING_ACTIVATION
```

### Sau

```text
Company
approvalStatus     = REJECTED
operationalStatus  = INACTIVE
reviewedByUserId   = PlatformAdmin._id
reviewedAt         = now
activatedAt        = null

User(CM)
status = PENDING_ACTIVATION
```

### Entity thay đổi

- `companies`

### Invariant

- không tạo approval confirmation token;
- không xóa Company;
- không tạo rejection reason;
- không tạo path resubmit.

---

## 10.6. PT-06 — Consume approval confirmation và activate

### Business source

- `F07`
- `BR-10`
- `BR-11`

### Trước

```text
User(CM)
status = PENDING_ACTIVATION

Company
approvalStatus    = APPROVED
operationalStatus = INACTIVE
activatedAt       = null

AuthToken
type      = COMPANY_APPROVAL_CONFIRMATION
userId    = User._id
expiresAt > now
```

### Sau

```text
User(CM)
status          = ACTIVE
emailVerifiedAt = now

Company
approvalStatus    = APPROVED
operationalStatus = ACTIVE
activatedAt       = now

AuthToken vừa consume
→ không còn usable
```

### Entity thay đổi

- `users`
- `companies`
- `auth_tokens`

### Invariant

Không được tồn tại kết quả thành công:

```text
User ACTIVE + Company INACTIVE
```

hoặc:

```text
User PENDING_ACTIVATION + Company ACTIVE
```

---

## 10.7. PT-07 — Resend approval confirmation

### Business source

- `F08`
- `BR-12`

### Trước

```text
User(CM).status = PENDING_ACTIVATION

Company
approvalStatus    = APPROVED
operationalStatus = INACTIVE

confirmation trước đó đã hết hạn
```

### Sau

```text
User(CM).status không đổi
Company state không đổi

Có COMPANY_APPROVAL_CONFIRMATION mới còn hiệu lực
```

### Entity thay đổi

- `auth_tokens`

### Invariant

- token hết hạn cũ không được trở lại usable;
- resend không active Company;
- resend không thay đổi approval decision.

---

## 10.8. PT-08 — Cập nhật Company profile sau activation

### Business source

- `F09`
- `BR-13`

### Trước

```text
User(CM).status = ACTIVE
Company = APPROVED + ACTIVE
```

### Field được cập nhật

- `logoUrl`
- `bannerUrl`
- `website`
- `address`
- `description`
- `contactInfo`

### Field không được thay đổi

- `managerUserId`
- `name`
- `businessRegistrationNumber`
- `reviewSnapshot`
- `approvalStatus`
- `operationalStatus`
- `submittedAt`
- `reviewedByUserId`
- `reviewedAt`
- `activatedAt`

### Sau

```text
Company = APPROVED + ACTIVE
reviewSnapshot không đổi
```

---

## 10.9. PT-09 — Platform Admin khóa/chấm dứt Company

### Business source

- `F10`
- `BR-15`
- `BR-16`

### Trước

```text
User(CM).status = ACTIVE

Company
approvalStatus    = APPROVED
operationalStatus = ACTIVE
activatedAt       != null
```

### Sau

```text
User(CM)
status = TERMINATED

Company
approvalStatus    = APPROVED
operationalStatus = LOCKED

AuthSession của Company Manager
→ không còn session usable
```

### Entity thay đổi

- `users`
- `companies`
- `auth_sessions`

### Entity/data được giữ

- `Company.managerUserId`
- `Company.reviewSnapshot`
- `Company.submittedAt`
- `Company.reviewedByUserId`
- `Company.reviewedAt`
- `Company.activatedAt`
- Company profile
- User identity

### Invariant

Không có persistence transition:

```text
APPROVED + LOCKED → APPROVED + ACTIVE
```

trong V02.

---

# 11. Transaction / Atomicity Requirements

Chỉ các workflow cần bảo vệ cross-document invariant mới bắt buộc transaction.

Các update chỉ nằm trong một Company document phải atomic ở document level nhưng không bắt buộc multi-document transaction.

## TX-01 — Tạo Company Manager + Company

**Business source**

- `F01`
- `BR-02`
- `BR-04`

Trong cùng transaction:

1. tạo `User` với `role = COMPANY_MANAGER`;
2. persist `User.status = PENDING_ACTIVATION`;
3. tạo `Company`;
4. persist `Company.managerUserId = User._id`;
5. persist `Company = NOT_SUBMITTED + INACTIVE`.

Sau commit:

```text
User COMPANY_MANAGER tồn tại
↔
Company tương ứng tồn tại
```

Không được xuất hiện:

```text
User COMPANY_MANAGER onboarding tồn tại
nhưng
không có Company tương ứng
```

Nếu một bước bắt buộc thất bại:

```text
rollback toàn bộ TX-01
```

---

## TX-02 — Approve Company + tạo confirmation token

**Business source**

- `F05`
- `BR-10`

Trong cùng transaction:

1. xác nhận source state `PENDING + INACTIVE`;
2. persist `approvalStatus = APPROVED`;
3. persist `reviewedByUserId`;
4. persist `reviewedAt`;
5. tạo `AuthToken` loại `COMPANY_APPROVAL_CONFIRMATION` cho `managerUserId`.

Sau commit:

```text
Company = APPROVED + INACTIVE
+
tồn tại confirmation capability cho đúng Company Manager
```

Không thay đổi:

```text
User.status = PENDING_ACTIVATION
Company.operationalStatus = INACTIVE
```

Nếu persistence token thất bại, approval transition không được commit một phần.

---

## TX-03 — Activation Company Manager + Company + token consumption

**Business source**

- `F07`
- `BR-11`
- `BR-21`

Trong cùng transaction:

1. validate token còn hiệu lực và thuộc đúng Company Manager;
2. validate Company `APPROVED + INACTIVE`;
3. `User.status → ACTIVE`;
4. hoàn tất `User.emailVerifiedAt`;
5. `Company.operationalStatus → ACTIVE`;
6. `Company.activatedAt → now`;
7. consume/remove confirmation token.

Sau commit:

```text
User ACTIVE
AND
emailVerifiedAt != null
AND
Company APPROVED + ACTIVE
AND
confirmation token vừa dùng không còn usable
```

Sau activation, User không còn `PENDING_ACTIVATION` nên limited onboarding authentication không còn là authorization context hợp lệ cho User đó; normal ACTIVE authentication áp dụng.

Không được xuất hiện partial state:

```text
User ACTIVE
Company INACTIVE
```

hoặc:

```text
User PENDING_ACTIVATION
Company ACTIVE
```

hoặc:

```text
activation đã thành công
nhưng token cũ vẫn có thể consume lại
```

---

## TX-04 — Lock Company + terminate Company Manager + revoke sessions

**Business source**

- `F10`
- `BR-15`
- V01 account termination/session invariant.

Trong cùng transaction:

1. validate Company `APPROVED + ACTIVE`;
2. validate Company Manager `ACTIVE`;
3. `Company.operationalStatus → LOCKED`;
4. `User.status → TERMINATED`;
5. revoke toàn bộ `AuthSession` của Company Manager.

Sau commit:

```text
Company = APPROVED + LOCKED
User(CM) = TERMINATED
usable AuthSession của User = 0
```

Không được xuất hiện partial state:

```text
Company LOCKED
nhưng
User ACTIVE
```

hoặc:

```text
User TERMINATED
nhưng
Company ACTIVE
```

hoặc:

```text
User TERMINATED
nhưng
session cũ vẫn usable
```

---

## Atomicity không cần multi-document transaction riêng

### Submit Company

`reviewSnapshot`, `submittedAt` và `approvalStatus = PENDING` cùng nằm trong một Company document và phải được persist như một atomic document transition.

### Reject Company

`approvalStatus`, `reviewedByUserId` và `reviewedAt` cùng nằm trong một Company document.

### Update Company profile

F02/F09 chỉ thay đổi một Company document.

### Resend confirmation

Resend chỉ thay đổi token lifecycle và không thay đổi Company/User state. Data contract không bắt buộc multi-document transaction riêng.

---

# 12. Constraint Ownership

## 12.1. Database / schema bảo vệ

Database/schema bảo vệ các constraint có đủ local persistence context.

| Constraint | Owner | Cơ chế contract |
| --- | --- | --- |
| `User.email` unique | Database | Unique index. |
| `User.role` thuộc enum | Schema | Enum validation. |
| `User.status` thuộc enum | Schema | Enum validation. |
| `AuthToken.type` thuộc enum | Schema | Enum validation. |
| `AuthToken.tokenHash` unique | Database | Unique index. |
| `AuthToken.expiresAt` cleanup | Database | TTL index. |
| `AuthSession.refreshTokenHash` unique | Database | Unique index. |
| `AuthSession.expiresAt` cleanup | Database | TTL index. |
| Company phải có `managerUserId` | Schema | Required local field. |
| Một manager tối đa một Company | Database | Unique index trên `managerUserId`. |
| `businessRegistrationNumber` không trùng khi đã có giá trị | Database | Unique partial index. |
| Company approval enum | Schema | Enum validation. |
| Company operational enum | Schema | Enum validation. |
| Company local state pair hợp lệ | Schema | Local document state validation. |
| Snapshot/timestamp presence phù hợp Company state | Schema | Conditional local validation. |
| `submittedAt <= reviewedAt <= activatedAt` | Schema | Local timestamp validation khi các field cùng tồn tại. |

Unique index cho `businessRegistrationNumber` là canonical thay đổi so với macro database cũ.

Macro cũ không tạo index này vì business decision khi đó chưa chốt; Product Specification hiện đã chốt uniqueness nên canonical Data Model phải bảo vệ nó.

## 12.2. Service bảo vệ

Service chịu trách nhiệm cho constraint cần actor context, referenced document hoặc cross-document context.

| Constraint | Owner | Lý do |
| --- | --- | --- |
| `managerUserId` phải reference User role `COMPANY_MANAGER` | Service | Database reference không biết business role. |
| `reviewedByUserId` phải là `PLATFORM_ADMIN` | Service | Cần đọc referenced User. |
| F01 chỉ tạo Company Manager cùng Company | Service + TX-01 | Cross-document business invariant. |
| Company Manager không được là Candidate trong cùng account | Service | Role/business boundary. |
| `name` bắt buộc khi submit | Service | Draft `NOT_SUBMITTED` được phép chưa có giá trị. |
| `businessRegistrationNumber` bắt buộc khi submit | Service | Draft được phép chưa hoàn chỉnh. |
| Transition nguồn → đích hợp lệ | Service | Business lifecycle. |
| Company Manager chỉ thao tác Company của mình | Service | Cần authenticated actor + relationship. |
| Platform Admin-only approve/reject/lock | Service | Authorization. |
| Snapshot chỉ tạo một lần | Service + local schema | Cần lifecycle/current persisted state. |
| Snapshot immutable sau submit | Service | Không được thay đổi historical truth. |
| Company profile bị freeze sau submit | Service | Business mutability rule. |
| F09 chỉ sửa đúng allowed fields | Service | Authorization + lifecycle. |
| `name` và `businessRegistrationNumber` immutable sau activation | Service | Business rule. |
| Approval confirmation token thuộc đúng CM của Company | Service | Cross-document resolution. |
| Confirmation token phải còn hạn | Service | TTL cleanup không đủ để xác định validity. |
| Resend chỉ khi Company `APPROVED + INACTIVE` và token trước hết hạn | Service | Business state + token lifecycle. |
| Limited onboarding authentication chỉ cho CM `PENDING_ACTIVATION` theo Product `BR-21` | Service | Authorization context; không đổi schema `AuthSession`. |
| Tạo/duy trì onboarding session không set `ACTIVE` hoặc `emailVerifiedAt` | Service | Product `BR-21` + F07/TX-03 boundary. |
| Onboarding session không authorize flow dành cho User `ACTIVE` | Service | Scope tách biệt với normal ACTIVE authentication. |
| Company + User activation đồng bộ | Service + TX-03 | Cross-document invariant. |
| Company lock + User terminate + session revoke đồng bộ | Service + TX-04 | Cross-document invariant. |
| Tenant resolution từ authenticated User | Service | Authorization boundary. |
| Client-supplied Company identifier không tự tạo quyền | Service | Security/ownership boundary. |
| Không có cross-tenant access | Service | Cần actor + resource ownership context. |

Database/schema không được tự quyết business authorization.

---

# 13. Token / TTL Lifecycle

V02 giữ token lifecycle V01 và bổ sung một loại token.

| Type | Owner | Expiration | Consumption | Persistence |
| --- | --- | --- | --- | --- |
| `EMAIL_VERIFICATION` | `User` | V01 | one-time | V01 |
| `PASSWORD_RESET` | `User` | V01 | one-time | V01 |
| `COMPANY_APPROVAL_CONFIRMATION` | Company Manager `User` | Có `expiresAt`; giá trị TTL cụ thể không được Product V02 cố định | one-time | Chỉ persist token hash |

## 13.1. `COMPANY_APPROVAL_CONFIRMATION`

### Tạo token

Token chỉ được tạo khi Company đã chuyển hợp lệ tới:

```text
APPROVED + INACTIVE
```

Owner:

```text
AuthToken.userId = Company.managerUserId
```

Không thêm:

```text
AuthToken.companyId
```

### Validity

Một confirmation chỉ usable khi đồng thời:

```text
AuthToken.type = COMPANY_APPROVAL_CONFIRMATION
expiresAt > now
User.status = PENDING_ACTIVATION
Company.managerUserId = User._id
Company = APPROVED + INACTIVE
```

### Consumption

Khi consume thành công, token phải trở thành non-usable trong cùng TX-03.

### Resend

Resend chỉ áp dụng khi confirmation trước đã hết hạn.

Resend:

- không thay đổi Company state;
- không thay đổi User state;
- tạo confirmation capability mới;
- không làm token hết hạn cũ usable trở lại.

Service phải bảo đảm không có nhiều confirmation token còn usable đồng thời cho cùng Company Manager.

### TTL

TTL index được phép cleanup token hết hạn.

TTL deletion không phải business validity check vì cleanup có thể không xảy ra đúng thời điểm `expiresAt`.

### Email action delivery contract

Confirmation email phải dùng browser-clickable URL theo dạng:

```text
{APP_BASE_URL}/api/auth/confirm-company-approval?token={raw token đã URL-encode}
```

`APP_BASE_URL` phải là API origin mà browser truy cập được; không được cấu hình chỉ là bare frontend host khi frontend không proxy route này. Browser/email client thực hiện `GET` với token trên query string, và endpoint đó consume confirmation token theo PT-06. `POST` body-token endpoint vẫn được giữ cho API client tương thích.

Contract delivery này không tạo token type hoặc persisted field mới, không thay đổi single-use/TTL/transaction invariant của `COMPANY_APPROVAL_CONFIRMATION`, và không liên quan tới access JWT.

### TTL value

Product Specification không chốt số phút/giờ/ngày cụ thể.

Data Model chỉ yêu cầu:

```text
expiresAt phải tồn tại
```

Giá trị lifetime cụ thể thuộc configuration/implementation policy miễn không thay đổi business contract.

---

# 14. Multi-tenant Data Boundary

## 14.1. Canonical tenant key

```text
Company._id
```

Mỗi Company là một tenant độc lập.

Không sử dụng:

```text
User.companyId
```

làm canonical tenant relationship trong V02.

## 14.2. Resource ownership

Trong V02:

| Resource | Tenant owner | Cách xác định |
| --- | --- | --- |
| `Company` | chính `Company` | `_id` |
| Company profile | `Company` | nằm trong Company document |
| `CompanyReviewSnapshot` | `Company` | embedded trong Company |
| Company Manager relationship | `Company` | `Company.managerUserId` |

`User`, `AuthSession` và `AuthToken` là account/authentication persistence, không phải tenant-owned business resource.

Các collection nghiệp vụ doanh nghiệp được bổ sung ở version sau phải lưu ownership về Company theo data contract của version đó.

V02 không tạo trước những collection hoặc `companyId` field của version tương lai.

## 14.3. Backend tenant resolution contract

```text
Authenticated User
        ↓
User phải là COMPANY_MANAGER khi dùng Company tenant scope
        ↓
resolve Company có managerUserId = authenticated User
        ↓
Canonical Company._id
        ↓
scope mọi Company-owned resource theo tenant đó
```

Client-supplied:

```text
companyId
tenantId
resource.companyId
```

không tự tạo authorization.

## 14.4. Cross-tenant invariant

Không được tồn tại business operation thành công trong đó:

```text
Authenticated Company Manager thuộc Company A
```

thao tác resource có tenant owner:

```text
Company B
```

với:

```text
A != B
```

## 14.5. Platform Admin

Platform Admin có platform-level administration đối với các action Product Specification cho phép.

Điều đó không làm phát sinh persistence membership như:

```text
Company.adminUserId
Company.platformAdminMemberIds
User.companyId
```

---

# 15. Snapshot / Historical Data

## 15.1. `CompanyReviewSnapshot`

Snapshot được tạo khi:

```text
Company Manager thực hiện F03 Submit Company
```

### Snapshot source

```text
Company live profile tại đúng thời điểm submit
```

### Fields

| Snapshot field | Source | Ý nghĩa |
| --- | --- | --- |
| `name` | `Company.name` | Tên Company được submit. |
| `logoUrl` | `Company.logoUrl` | Logo tại thời điểm submit. |
| `bannerUrl` | `Company.bannerUrl` | Banner tại thời điểm submit. |
| `website` | `Company.website` | Website tại thời điểm submit. |
| `address` | `Company.address` | Địa chỉ tại thời điểm submit. |
| `description` | `Company.description` | Mô tả tại thời điểm submit. |
| `contactInfo` | `Company.contactInfo` | Thông tin liên hệ tại thời điểm submit. |
| `businessRegistrationNumber` | `Company.businessRegistrationNumber` | Mã số doanh nghiệp được submit. |

### Lifecycle

- `reviewSnapshot = null` trước submit.
- F03 tạo snapshot đúng một lần.
- `Company.submittedAt` là capture time.
- Snapshot immutable sau submit.
- Platform Admin approve/reject dựa trên snapshot.
- Snapshot không cập nhật theo live profile.
- Snapshot được giữ khi Company `REJECTED`.
- Snapshot được giữ khi Company `ACTIVE`.
- Snapshot được giữ khi Company `LOCKED`.
- V02 không có snapshot version.
- V02 không có snapshot history collection.

Nguyên tắc:

```text
reviewSnapshot != live Company profile
```

sau khi Company active và F09 cập nhật các profile field được phép.

---

# 16. Explicitly Excluded Persistence

V02 chủ động **không thêm**:

```text
User.companyId

Company email/password credentials

CompanyMember
Recruiter

CompanyRegistrationRequest
CompanyApprovalRequest

CompanyReviewHistory
CompanyLockHistory
CompanyManagerHistory

company_review_snapshots collection

reviewHistory
lockHistory

rejectionReason
lockReason
lockedAt
lockedByUserId

resubmissionCount
approvedSnapshotVersion

deletedAt
archivedAt

emailSentAt
emailDeliveryStatus

replacementManagerUserId
previousManagerUserId
managerHistory

unlockAt
unlockedAt
unlockedByUserId
reactivatedAt
```

Không thêm unique index cho:

```text
Company.name
```

Ngược lại, V02 **phải thêm** uniqueness protection cho:

```text
Company.businessRegistrationNumber
```

vì Product Specification đã chốt rule này.

Không thêm collection/field dành cho:

- nhiều lần submit;
- resubmit sau reject;
- re-review sau activation;
- unlock/reactivation;
- audit history;
- Company archive/delete;
- multi-manager;
- manager replacement;
- future recruitment entities.

Entity diagram cũ nếu biểu diễn `CompanyReviewSnapshot` như một collection độc lập phải được hiểu lại hoặc cập nhật theo canonical contract này: snapshot là embedded document, không có persistence identity độc lập.

---

# 17. Compatibility với version trước

## 17.1. Invariant V01 phải giữ

- `User.email` vẫn unique.
- Candidate lifecycle V01 không đổi.
- Candidate không bị tạo với `PENDING_ACTIVATION` chỉ vì V02 thêm state này.
- `ACTIVE`, `LOCKED`, `TERMINATED` giữ nguyên ý nghĩa V01 đối với normal ACTIVE authentication.
- Normal ACTIVE authentication vẫn chỉ dành cho User `ACTIVE` có email đã được xác thực; V02 không nới lỏng điều kiện này.
- V02 chốt exception riêng: Company Manager `PENDING_ACTIVATION` được phép có limited onboarding authentication session theo Product `BR-21` dù `emailVerifiedAt = null`; exception này không thay thế normal ACTIVE authentication.
- `TERMINATED` không đồng nghĩa hard delete User.
- Session/token expiration vẫn phải được kiểm tra theo V01.
- Session revocation vẫn làm session không usable.
- Authentication token vẫn không persist raw token.

## 17.2. Persistence behavior V01 phải giữ

`auth_sessions` giữ nguyên contract V01.

`auth_tokens` giữ toàn bộ behavior của:

```text
EMAIL_VERIFICATION
PASSWORD_RESET
```

V02 chỉ mở rộng enum bằng:

```text
COMPANY_APPROVAL_CONFIRMATION
```

## 17.3. Thay đổi được phép

### User

```text
status enum
+ PENDING_ACTIVATION
```

Giá trị này dành cho Company Manager onboarding.

### AuthToken

```text
type enum
+ COMPANY_APPROVAL_CONFIRMATION
```

### New collection

```text
companies
```

## 17.4. Thay đổi không được phép

- đổi Candidate registration sang `PENDING_ACTIVATION`;
- thay đổi Candidate authentication flow;
- thêm `User.companyId`;
- thay đổi schema/field semantics của `AuthSession` V01 (V02 được phép tái sử dụng cùng collection cho limited onboarding authentication theo Product `BR-21`, nhưng không thêm enum/field auth-context riêng);
- dùng Company lock để chuyển User sang `LOCKED`; canonical F10 yêu cầu `TERMINATED`;
- thêm Company unlock/reactivation;
- dùng data model cũ để khôi phục behavior đã bị Product Specification loại bỏ.

## 17.5. V01 termination invariant trong F10

V02 F10 chuyển Company Manager:

```text
ACTIVE → TERMINATED
```

Do đó persistence phải tiếp tục áp dụng invariant V01 đối với `TERMINATED`:

```text
toàn bộ AuthSession của User bị revoke
```

TX-04 bảo vệ cả V01 account invariant và V02 Company invariant.

---

# 18. Persistence Invariants

Các invariant sau phải luôn đúng ở persisted state.

| # | Invariant | Enforcement owner |
| --- | --- | --- |
| 1 | Mỗi Company luôn có `managerUserId`. | Schema |
| 2 | Một `managerUserId` chỉ xuất hiện trên tối đa một Company. | Database unique index |
| 3 | User được reference bởi `managerUserId` phải là `COMPANY_MANAGER`. | Service |
| 4 | Company Manager onboarding không tồn tại độc lập khỏi Company. | TX-01 |
| 5 | Không tồn tại `User.companyId` duplicate relationship. | Data contract / schema absence |
| 6 | `businessRegistrationNumber` unique giữa các Company khi có giá trị. | Database unique partial index |
| 7 | `name` và `businessRegistrationNumber` phải có trước submit. | Service |
| 8 | `NOT_SUBMITTED` không có review snapshot. | Schema + service |
| 9 | Submit tạo snapshot đúng một lần. | Service + atomic Company update |
| 10 | Snapshot không thay đổi sau submit. | Service |
| 11 | Company local state chỉ thuộc sáu pair canonical. | Schema + service |
| 12 | `PENDING`, `APPROVED`, `REJECTED` phải có snapshot và `submittedAt`. | Schema |
| 13 | `APPROVED`/`REJECTED` phải có current reviewer và `reviewedAt`. | Schema + service |
| 14 | Reviewer phải là `PLATFORM_ADMIN`. | Service |
| 15 | `APPROVED + INACTIVE` không có `activatedAt`. | Schema |
| 16 | `APPROVED + ACTIVE` và `APPROVED + LOCKED` phải có `activatedAt`. | Schema |
| 17 | Activation thành công phải đồng thời tạo `User ACTIVE + Company ACTIVE`. | TX-03 |
| 18 | Confirmation token đã consume không còn usable. | TX-03 |
| 19 | Resend không thay đổi User/Company state. | Service |
| 20 | Company `PENDING` không được sửa live profile. | Service |
| 21 | F09 không được sửa `name` hoặc `businessRegistrationNumber`. | Service |
| 22 | F09 không được sửa review snapshot hoặc state fields. | Service |
| 23 | Company Manager chỉ được thao tác tenant của chính mình. | Service |
| 24 | Client-supplied Company identifier không tạo authorization. | Service |
| 25 | Platform Admin review relation không tạo tenant membership. | Service / schema design |
| 26 | F10 phải tạo `Company LOCKED + User TERMINATED` cùng một result. | TX-04 |
| 27 | F10 phải revoke toàn bộ session của Company Manager. | TX-04 |
| 28 | Company `LOCKED` không có transition về `ACTIVE` trong V02. | Service |
| 29 | Lock không xóa Company, User hoặc snapshot. | Service |
| 30 | Relationship `managerUserId` không được thay đổi trong V02. | Service |
| 31 | Limited onboarding authentication không persist `ACTIVE` hoặc `emailVerifiedAt` cho CM onboarding. | Service |
| 32 | `emailVerifiedAt` của Company Manager onboarding chỉ được set trong TX-03/F07. | TX-03 |
| 33 | Phân biệt onboarding vs ACTIVE authorization context không yêu cầu schema `AuthSession` mới. | Service / Product `BR-21` |

---

# 19. Definition of Data Completion

Data contract V02 được coi là hoàn thành khi:

- `users` được mở rộng đúng với `PENDING_ACTIVATION`;
- Candidate persistence behavior V01 không bị thay đổi;
- `auth_sessions` được giữ nguyên schema V01, hỗ trợ cả normal ACTIVE sessions và limited onboarding sessions theo Product `BR-21`, và tham gia F10 session revocation;
- `auth_tokens` hỗ trợ `COMPANY_APPROVAL_CONFIRMATION`;
- `companies` được định nghĩa đầy đủ;
- relationship `Company.managerUserId → User._id` được bảo vệ;
- `businessRegistrationNumber` uniqueness được bảo vệ;
- review snapshot là embedded immutable persistence;
- state matrix chỉ cho phép lifecycle canonical;
- mọi persistence transition PT-01 đến PT-09 rõ ràng;
- TX-01 đến TX-04 bảo vệ các cross-document invariant;
- constraint ownership giữa database/schema và service rõ ràng;
- token/TTL lifecycle của approval confirmation rõ ràng;
- tenant key là `Company._id`;
- tenant resolution không dựa vào identifier do client tự khai báo;
- snapshot/historical behavior rõ ràng;
- Explicitly Excluded Persistence không bị thêm ngoài ý muốn;
- mọi persistence invariant có enforcement owner.

Data Completion không đồng nghĩa schema đã được code.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự suy đoán data architecture hoặc business invariant quan trọng.

---

# 20. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V02.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

- entities / collections;
- fields;
- embedded documents;
- references;
- relationships;
- cardinality;
- enums;
- indexes;
- uniqueness;
- TTL;
- snapshots;
- persistence state;
- persistence transitions;
- transaction / atomicity requirements;
- persistence invariants;
- ownership của constraint.

Tài liệu này không định nghĩa:

- REST endpoint;
- HTTP method;
- HTTP status code;
- request/response body;
- controller;
- route;
- middleware implementation;
- service function structure;
- MongoDB query cụ thể;
- Mongoose method cụ thể;
- source-code structure;
- UI behavior;
- frontend flow;
- test framework.

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

Macro database + diagrams
→ input material
```

Nếu macro database hoặc diagram cũ mâu thuẫn với Product Specification đã được phê duyệt, Product Specification thắng.

Đối với V02, canonical data contract này đã áp dụng các quyết định cuối cùng:

```text
businessRegistrationNumber = unique

Company LOCK
→ Company.operationalStatus = LOCKED
→ Company Manager User.status = TERMINATED
→ revoke toàn bộ session
→ không có unlock/reactivate trong V02
```

Không được khôi phục behavior cũ từ macro database hoặc entity diagram nếu behavior đó trái Product Specification.
