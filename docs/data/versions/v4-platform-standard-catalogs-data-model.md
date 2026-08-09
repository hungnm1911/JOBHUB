# V4 — Quản lý danh mục chuẩn của nền tảng Data Model

> **File:** `docs/data/versions/v4-platform-standard-catalogs-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v4-platform-standard-catalogs.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v4-platform-standard-catalogs.md
````

Product Specification là authority đối với business behavior.

Data Contract V4 xác định:

* dữ liệu chuẩn nào cần được persist;
* dữ liệu chuẩn nào chỉ tồn tại dưới dạng fixed vocabulary;
* collection chịu trách nhiệm lưu dữ liệu;
* field và constraint cần thiết;
* quan hệ giữa Category `FIELD` và `POSITION`;
* uniqueness của Category;
* representation của `ExperienceLevel`;
* representation của `Location`, `EmploymentType` và `WorkMode`;
* persistence transition;
* transaction / atomicity requirement;
* constraint nào do database/schema bảo vệ;
* constraint nào do service bảo vệ;
* multi-tenant/data ownership boundary;
* các field/collection chủ động không được thêm.

Tài liệu này không được thay đổi hoặc mở rộng business behavior đã được Product Specification định nghĩa.

---

## 2. Thay đổi so với version trước

V4 bổ sung hai persisted entity mới:

* `Category`;
* `ExperienceLevel`.

V4 đồng thời bổ sung ba fixed vocabulary:

* `Location`;
* `EmploymentType`;
* `WorkMode`.

Ba fixed vocabulary trên không được persist thành catalog collection trong V4.

### 2.1. Tổng quan thay đổi

| Entity / Data Vocabulary | Trạng thái       | Mô tả                                               |
| ------------------------ | ---------------- | --------------------------------------------------- |
| `categories`             | `NEW`            | Lưu Category `FIELD` và `POSITION`                  |
| `experience_levels`      | `NEW`            | Lưu tập ExperienceLevel cố định                     |
| `Location`               | `NEW VOCABULARY` | Fixed enum, không có collection                     |
| `EmploymentType`         | `NEW VOCABULARY` | Fixed enum, không có collection                     |
| `WorkMode`               | `NEW VOCABULARY` | Fixed enum, không có collection                     |
| `users`                  | `UNCHANGED`      | Tiếp tục cung cấp identity và role `PLATFORM_ADMIN` |
| `companies`              | `UNCHANGED`      | Không lưu catalog V4                                |
| `company_members`        | `UNCHANGED`      | Không bổ sung quyền quản lý catalog                 |
| `auth_sessions`          | `UNCHANGED`      | Không thay đổi                                      |
| `auth_tokens`            | `UNCHANGED`      | Không thay đổi                                      |

### 2.2. Entity mới

```text
categories
experience_levels
```

### 2.3. Entity được mở rộng

Không có entity V1–V3 nào được mở rộng schema trong V4.

### 2.4. Entity giữ nguyên nhưng được sử dụng

`users` tiếp tục là nguồn identity/role để xác định actor có phải:

```text
PLATFORM_ADMIN
```

hay không.

Không tạo relationship persistence từ `Category` tới `User`.

### 2.5. Khác biệt bắt buộc so với persistence design thô trước đó

Canonical V4 không sử dụng:

```text
Category.isActive
Location collection
EmploymentType collection
WorkMode collection
numeric experienceYears làm representation chuẩn của V4
```

Thay vào đó:

```text
Category
→ persisted collection
→ append-only
→ immutable

ExperienceLevel
→ persisted collection
→ fixed dataset

Location
→ fixed enum

EmploymentType
→ fixed enum

WorkMode
→ fixed enum
```

---

## 3. Collection / Entity tổng thể

Persisted collections mới của V4:

```text
categories
experience_levels
```

Fixed vocabulary không tạo collection:

```text
Location
EmploymentType
WorkMode
```

### 3.1. Responsibility

| Entity / Vocabulary | Responsibility                                              |
| ------------------- | ----------------------------------------------------------- |
| `categories`        | Lưu Category `FIELD` và `POSITION` dùng chung toàn platform |
| `experience_levels` | Lưu sáu ExperienceLevel cố định                             |
| `Location`          | Xác định tập Location chuẩn của platform gồm 63 tỉnh/thành theo canonical snapshot và FOREIGN.                      |
| `EmploymentType`    | Xác định tập loại hình công việc hợp lệ                     |
| `WorkMode`          | Xác định tập phương thức làm việc hợp lệ                    |

Không tạo thêm collection ngoài danh sách này nếu chưa có canonical requirement mới.

---

## 4. Quan hệ dữ liệu

V4 chỉ có một relationship persistence mới:

```text
Category FIELD 1 ───── 0..N Category POSITION
```

Không có relationship persistence giữa:

```text
Category ↔ Company
Category ↔ CompanyMember
Category ↔ User
ExperienceLevel ↔ Company
ExperienceLevel ↔ User
```

### 4.1. Category FIELD → Category POSITION

**Cardinality**

```text
Category FIELD 1 ───── 0..N Category POSITION
```

Một `FIELD` có thể chưa có POSITION.

Mỗi `POSITION` phải thuộc đúng một `FIELD`.

**Owner của relationship**

```text
Category POSITION
```

**Reference**

```text
Category.parentCategoryId
```

`POSITION` giữ reference tới `FIELD` cha.

`FIELD` không lưu danh sách child IDs.

**Constraint**

Đối với `FIELD`:

```text
level = FIELD
parentCategoryId = null
```

Đối với `POSITION`:

```text
level = POSITION
parentCategoryId = <Category FIELD đã tồn tại>
```

Không cho phép:

```text
FIELD → FIELD
POSITION → POSITION
POSITION → child
```

**Lifecycle**

Category là immutable và không thể bị xóa.

Vì vậy reference:

```text
POSITION.parentCategoryId → FIELD
```

không có lifecycle detach, reassignment hoặc dangling-reference hợp lệ.

---

## 5. Category

### 5.1. Responsibility

Collection:

```text
categories
```

chịu trách nhiệm lưu:

* Category `FIELD`;
* Category `POSITION`;
* tên hiển thị của Category;
* representation chuẩn hóa dùng cho uniqueness;
* level;
* parent của POSITION.

Collection này không chịu trách nhiệm lưu:

* tenant/company ownership;
* trạng thái active/inactive;
* delete state;
* category history;
* actor tạo Category;
* Job;
* CV;
* usage count;
* aliases;
* synonyms.

### 5.2. Fields

| Field              | Type               |    Required | Default   | Constraint                          | Ý nghĩa                               |
| ------------------ | ------------------ | ----------: | --------- | ----------------------------------- | ------------------------------------- |
| `_id`              | `ObjectId`         |         YES | generated | unique                              | Định danh Category                    |
| `name`             | `String`           |         YES | —         | non-empty, immutable                | Tên Category                          |
| `normalizedName`   | `String`           |         YES | —         | derived, immutable                  | Giá trị chuẩn hóa dùng cho uniqueness |
| `level`            | `String`           |         YES | —         | enum `FIELD`, `POSITION`; immutable | Cấp Category                          |
| `parentCategoryId` | `ObjectId \| null` | conditional | `null`    | self-reference; immutable           | FIELD cha của POSITION                |

Không có:

```text
isActive
status
deletedAt
disabledAt
updatedAt
companyId
createdBy
```

trong canonical V4.

### 5.3. Enum

#### `Category.level`

```text
FIELD
POSITION
```

| Giá trị    | Ý nghĩa                       |
| ---------- | ----------------------------- |
| `FIELD`    | Nghề hoặc lĩnh vực            |
| `POSITION` | Vị trí cụ thể thuộc một FIELD |

Không được thêm level thứ ba.

### 5.4. `normalizedName`

`normalizedName` tồn tại để tạo canonical comparison key cho uniqueness.

Canonical normalization của V4:

1. loại bỏ khoảng trắng thừa ở đầu và cuối;
2. gom nhiều khoảng trắng liên tiếp thành một khoảng trắng;
3. chuẩn hóa khác biệt chữ hoa/chữ thường.

Ví dụ:

```text
"Backend Developer"
" backend developer "
"Backend   Developer"
```

được xem là cùng một normalized representation.

V4 không định nghĩa synonym matching.

Ví dụ:

```text
"IT"
"Information Technology"
"Công nghệ thông tin"
```

không tự động được coi là cùng một Category chỉ vì có thể gần nghĩa về ngôn ngữ.

Việc quản lý synonym/alias không thuộc V4.

### 5.5. Indexes

#### Index 1 — Category uniqueness

```text
{ parentCategoryId: 1, normalizedName: 1 }
UNIQUE
```

Mục đích:

* FIELD có `parentCategoryId = null`, do đó tên FIELD unique toàn platform;
* POSITION unique trong cùng FIELD;
* POSITION cùng tên được phép tồn tại ở FIELD khác.

Ví dụ hợp lệ:

```text
IT
└── Project Manager

Marketing
└── Project Manager
```

Ví dụ không hợp lệ:

```text
IT
├── Backend Developer
└── Backend Developer
```

Index này đồng thời hỗ trợ lookup các POSITION theo `parentCategoryId`.

Ngoài index mặc định của `_id`, V4 không yêu cầu index speculative khác.

### 5.6. Embedded documents

> `Category` không sử dụng embedded document trong V4.

### 5.7. Reference rules

| Field              | Reference  |                  Required | Cardinality | Rule                                                |
| ------------------ | ---------- | ------------------------: | ----------- | --------------------------------------------------- |
| `parentCategoryId` | `Category` | FIELD: NO / POSITION: YES | N → 1       | Chỉ POSITION được có parent và parent phải là FIELD |

Database/schema có thể bảo vệ việc FIELD phải có `parentCategoryId = null` và POSITION phải có giá trị parent.

Việc referenced Category:

```text
tồn tại
AND level = FIELD
```

là cross-document validation và thuộc service responsibility.

---

## 6. ExperienceLevel

### 6.1. Responsibility

Collection:

```text
experience_levels
```

lưu tập mức kinh nghiệm chuẩn cố định của nền tảng.

ExperienceLevel là dữ liệu platform-wide.

ExperienceLevel không biểu diễn Work Experience chi tiết của Candidate.

Collection này không chịu trách nhiệm lưu:

* số năm chính xác của Candidate;
* min/max years;
* Work Experience;
* Company ownership;
* trạng thái active/inactive;
* Job requirement;
* matching logic.

### 6.2. Fields

| Field  | Type       | Required | Default   | Constraint              | Ý nghĩa                             |
| ------ | ---------- | -------: | --------- | ----------------------- | ----------------------------------- |
| `_id`  | `ObjectId` |      YES | generated | unique                  | Định danh persisted ExperienceLevel |
| `code` | `String`   |      YES | —         | enum, unique, immutable | Canonical ExperienceLevel           |

Không thêm:

```text
name
description
minYears
maxYears
isActive
status
companyId
```

trong V4.

### 6.3. Enum `code`

```text
NO_EXPERIENCE
UNDER_1_YEAR
ONE_TO_THREE_YEARS
THREE_TO_FIVE_YEARS
FIVE_TO_TEN_YEARS
OVER_TEN_YEARS
```

| Giá trị               | Ý nghĩa nghiệp vụ    |
| --------------------- | -------------------- |
| `NO_EXPERIENCE`       | Không có kinh nghiệm |
| `UNDER_1_YEAR`        | Dưới 1 năm           |
| `ONE_TO_THREE_YEARS`  | Từ 1 đến 3 năm       |
| `THREE_TO_FIVE_YEARS` | Từ 3 đến 5 năm       |
| `FIVE_TO_TEN_YEARS`   | Từ 5 đến 10 năm      |
| `OVER_TEN_YEARS`      | Trên 10 năm          |

Data Contract không tự diễn giải boundary toán học chi tiết của các khoảng để tạo matching logic.

Ví dụ các câu hỏi như:

```text
3 năm thuộc ONE_TO_THREE_YEARS
hay THREE_TO_FIVE_YEARS?
```

không được Data Contract V4 tự quyết nếu Product Contract chưa định nghĩa cách xử lý boundary cho matching.

Các enum label ở đây chỉ phản ánh đúng vocabulary đã được Product Specification chốt.

### 6.4. Canonical dataset

Persisted state chuẩn phải có đúng một document cho mỗi code:

```text
NO_EXPERIENCE
UNDER_1_YEAR
ONE_TO_THREE_YEARS
THREE_TO_FIVE_YEARS
FIVE_TO_TEN_YEARS
OVER_TEN_YEARS
```

Không có business operation runtime để:

```text
create
rename
update
delete
disable
reactivate
```

ExperienceLevel.

Cách dữ liệu cố định được khởi tạo thuộc implementation/deployment, không thuộc business workflow.

### 6.5. Indexes

```text
{ code: 1 }
UNIQUE
```

Mục đích:

* một canonical code chỉ tồn tại tối đa một lần;
* ngăn duplicate ExperienceLevel persisted state.

Ngoài `_id` index mặc định, không yêu cầu index khác trong V4.

### 6.6. Embedded documents

> `ExperienceLevel` không sử dụng embedded document.

### 6.7. Reference rules

V4 chưa có Job hoặc CV relationship.

Do đó V4 chưa định nghĩa:

```text
Job.experienceLevelId
CV.experienceLevelId
```

hoặc bất kỳ reference tương lai nào khác.

Việc entity nào reference ExperienceLevel và cardinality ra sao phải do Data Contract của version chứa entity đó quyết định.

---

## 6.8. Fixed Vocabulary — EmploymentType

`EmploymentType` không có collection riêng.

Canonical enum:

```text
FULL_TIME
PART_TIME
INTERNSHIP
CONTRACT
TEMPORARY
FREELANCE
SEASONAL
APPRENTICESHIP
```

Không actor nào được thay đổi tập này trong V4.

Không persist metadata riêng cho mỗi EmploymentType.

Không thêm:

```text
employment_types
EmploymentType._id
EmploymentType.isActive
EmploymentType.name
```

### 6.9. Fixed Vocabulary — WorkMode

`WorkMode` không có collection riêng.

Canonical enum:

```text
ONSITE
HYBRID
REMOTE
```

`REMOTE` chỉ thuộc WorkMode.

Không persist:

```text
work_modes
WorkMode._id
WorkMode.isActive
```

### 6.10. Fixed Vocabulary — Location

`Location` không có collection riêng.

Location được biểu diễn bằng fixed enum.

Canonical Location vocabulary gồm đúng:

- 63 đơn vị tỉnh/thành thuộc canonical Vietnam location snapshot;
- 1 special member `FOREIGN`, biểu diễn địa điểm làm việc ngoài Việt Nam.

Các tỉnh/thành trong tập này là platform-defined fixed vocabulary.
Tập này không tự động thay đổi theo các thay đổi địa giới hành chính
sau khi Data Contract V4 được khóa.

`FOREIGN`:

- không đại diện cho một quốc gia cụ thể;
- không tạo country hierarchy;
- không cho biết quốc gia nào;
- chỉ biểu diễn địa điểm làm việc nằm ngoài Việt Nam.

Không được có enum member đại diện cho:

- Remote;
- quận/huyện;
- phường/xã;
- địa chỉ chi tiết;
- quốc gia cụ thể.

### 6.11. Canonical Location member list

Canonical Location vocabulary của V4 gồm đúng 64 members:

- 63 tỉnh/thành thuộc canonical Vietnam location snapshot;
- 1 special member `FOREIGN`.

Canonical enum:

```
HA_NOI
HA_GIANG
CAO_BANG
BAC_KAN
TUYEN_QUANG
LAO_CAI
DIEN_BIEN
LAI_CHAU
SON_LA
YEN_BAI
HOA_BINH
THAI_NGUYEN
LANG_SON
QUANG_NINH
BAC_GIANG
PHU_THO
VINH_PHUC
BAC_NINH
HAI_DUONG
HAI_PHONG
HUNG_YEN
THAI_BINH
HA_NAM
NAM_DINH
NINH_BINH
THANH_HOA
NGHE_AN
HA_TINH
QUANG_BINH
QUANG_TRI
HUE
DA_NANG
QUANG_NAM
QUANG_NGAI
BINH_DINH
PHU_YEN
KHANH_HOA
NINH_THUAN
BINH_THUAN
KON_TUM
GIA_LAI
DAK_LAK
DAK_NONG
LAM_DONG
BINH_PHUOC
TAY_NINH
BINH_DUONG
DONG_NAI
BA_RIA_VUNG_TAU
HO_CHI_MINH
LONG_AN
TIEN_GIANG
BEN_TRE
TRA_VINH
VINH_LONG
DONG_THAP
AN_GIANG
KIEN_GIANG
CAN_THO
HAU_GIANG
SOC_TRANG
BAC_LIEU
CA_MAU
FOREIGN
```

Không implementation nào được:

- thêm Location member;
- xóa Location member;
- rename Location member;
- tự đồng bộ Location với thay đổi địa giới hành chính;
- thay `FOREIGN` bằng country-specific value

nếu Product/Data Contract của version tương ứng chưa thay đổi.

---

# 7. State Matrix

Version này không có nhiều state dimension cần State Matrix.

```text
Category.level
```

là classification:

```text
FIELD
POSITION
```

không phải lifecycle state.

`ExperienceLevel`, `EmploymentType`, `WorkMode` và `Location` cũng không có lifecycle state trong V4.

> Version này không cần State Matrix riêng.

---

# 8. Persistence Transitions

V4 chỉ có persistence transition đối với việc tạo Category.

Không có update/delete persistence transition cho Category.

---

## 8.1. Tạo Category FIELD

### Trigger business

```text
F01 — Thêm Category FIELD
```

### Trước

Không tồn tại Category có:

```text
parentCategoryId = null
normalizedName = requestedNormalizedName
```

### Sau

Một document mới tồn tại:

```text
Category
{
  name
  normalizedName
  level = FIELD
  parentCategoryId = null
}
```

### Entity bị thay đổi

```text
categories
```

### Entity không thay đổi

```text
users
companies
company_members
experience_levels
auth_sessions
auth_tokens
```

### Invariant cần giữ

* FIELD không có parent.
* FIELD unique toàn platform.
* Category vừa tạo là immutable.
* Không tạo tenant ownership.
* Không tạo lifecycle state.

---

## 8.2. Tạo Category POSITION

### Trigger business

```text
F02 — Thêm Category POSITION
```

### Trước

FIELD cha phải tồn tại:

```text
Category._id = requestedParentCategoryId
Category.level = FIELD
```

Và chưa tồn tại:

```text
Category
where
parentCategoryId = requestedParentCategoryId
AND
normalizedName = requestedNormalizedName
```

### Sau

Một document mới tồn tại:

```text
Category
{
  name
  normalizedName
  level = POSITION
  parentCategoryId = FIELD._id
}
```

### Entity bị thay đổi

```text
categories
```

### Entity không thay đổi

FIELD cha không bị update.

Các entity V1–V3 không bị update.

### Invariant cần giữ

* POSITION thuộc đúng một FIELD.
* parent phải tồn tại.
* parent phải là FIELD.
* POSITION unique trong FIELD.
* FIELD cha không bị mutate.
* POSITION sau khi tạo không được chuyển parent.

---

## 8.3. Transition chủ động không tồn tại

Canonical Data Contract không có persistence transition:

```text
Category rename
Category update
Category delete
Category deactivate
Category reactivate
FIELD → POSITION
POSITION → FIELD
POSITION(parent A) → POSITION(parent B)
```

Không implementation nào được tự tạo các transition trên.

---

# 9. Transaction / Atomicity Requirements

> V4 không bổ sung transaction/atomicity requirement mới.

### 9.1. Tạo FIELD

Tạo FIELD chỉ tạo một document Category.

Không có cross-document persisted state phải thay đổi atomically.

Uniqueness được bảo vệ bằng unique index.

### 9.2. Tạo POSITION

Tạo POSITION gồm:

1. xác nhận FIELD cha tồn tại và hợp lệ;
2. tạo một POSITION document.

FIELD cha là immutable và không thể bị xóa.

Do đó giữa thời điểm kiểm tra parent và tạo POSITION không tồn tại một business transition hợp lệ có thể:

```text
delete FIELD
change FIELD level
deactivate FIELD
```

làm parent mất validity.

Không cần transaction chỉ để bảo vệ theoretical failure window không tồn tại trong canonical lifecycle.

### 9.3. Concurrent duplicate creation

Hai request đồng thời tạo cùng Category không yêu cầu transaction riêng.

Canonical uniqueness phải được bảo vệ tại database bằng unique index.

Persisted state cuối cùng không được chứa duplicate Category.

### 9.4. ExperienceLevel initialization

Việc khởi tạo sáu ExperienceLevel cố định không phải business transition runtime.

Product/Data Contract không yêu cầu distributed transaction, exactly-once semantics hoặc atomic completion với external service.

V4 không có external side effect thuộc atomic completion.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

| Constraint                               | Owner    | Lý do                    |
| ---------------------------------------- | -------- | ------------------------ |
| Category `_id` unique                    | Database | Identity                 |
| `name` required                          | Schema   | Local field requirement  |
| `normalizedName` required                | Schema   | Local field requirement  |
| `level ∈ {FIELD, POSITION}`              | Schema   | Closed enum              |
| FIELD phải có `parentCategoryId = null`  | Schema   | Local document invariant |
| POSITION phải có `parentCategoryId`      | Schema   | Local document invariant |
| FIELD name unique platform-wide          | Database | Compound unique index    |
| POSITION name unique trong parent FIELD  | Database | Compound unique index    |
| `ExperienceLevel.code` required          | Schema   | Local field requirement  |
| ExperienceLevel code thuộc canonical set | Schema   | Closed enum              |
| `ExperienceLevel.code` unique            | Database | Unique index             |

Canonical compound uniqueness:

```text
(parentCategoryId, normalizedName)
```

được database bảo vệ để concurrency không tạo duplicate persisted state.

---

## 10.2. Service bảo vệ

| Constraint                                       | Owner            | Lý do                              |
| ------------------------------------------------ | ---------------- | ---------------------------------- |
| Actor tạo Category phải là Platform Admin        | Service          | Authorization business rule        |
| POSITION parent phải tồn tại                     | Service          | Cross-document validation          |
| POSITION parent phải có `level = FIELD`          | Service          | Cross-document business validation |
| Category không được update                       | Service          | Business lifecycle rule            |
| Category không được delete                       | Service          | Business lifecycle rule            |
| Category không được đổi parent                   | Service          | Business lifecycle rule            |
| Không actor nào quản trị ExperienceLevel runtime | Service boundary | Fixed dataset                      |
| Không actor nào quản trị WorkMode                | Service boundary | Fixed vocabulary                   |
| Không actor nào quản trị EmploymentType          | Service boundary | Fixed vocabulary                   |
| Không actor nào quản trị Location                | Service boundary | Fixed vocabulary                   |

### 10.3. Normalized Category identity

Persistence layer phải bảo đảm:

```text
normalizedName
```

luôn tương ứng với `name` theo canonical normalization.

Client không được coi là authority của `normalizedName`.

`normalizedName` là derived persistence value.

---

# 11. Token / TTL Lifecycle

> V4 không bổ sung token/TTL persistence mới.

V4 không thêm:

* token;
* temporary credential;
* TTL catalog record;
* expiring Category;
* expiring ExperienceLevel.

Các token/session đã tồn tại từ version trước giữ nguyên contract cũ.

---

# 12. Multi-tenant Data Boundary

Các resource mới của V4 thuộc:

```text
PLATFORM SCOPE
```

không thuộc Company tenant.

### 12.1. Canonical tenant key

Không có canonical tenant key cho:

```text
Category
ExperienceLevel
Location
EmploymentType
WorkMode
```

### 12.2. Resource ownership

| Resource        | Owner    |
| --------------- | -------- |
| Category        | Platform |
| ExperienceLevel | Platform |
| Location        | Platform |
| EmploymentType  | Platform |
| WorkMode        | Platform |

Không thêm:

```text
companyId
tenantId
companyMemberId
```

vào dữ liệu V4.

### 12.3. Authorization resolution cho Category creation

Business authorization:

```text
Authenticated User
        ↓
trusted User identity
        ↓
User.role
        ↓
PLATFORM_ADMIN
        ↓
Category creation authority
```

Không cần resolve Company.

Không sử dụng:

```text
companyId
tenantId
CompanyMember
```

để quyết định quyền tạo Category.

Client-supplied Company identifier không tạo authorization cho V4.

---

# 13. Snapshot / Historical Data

> V4 không bổ sung snapshot hoặc historical persistence mới.

Không tạo:

```text
CategoryHistory
CategorySnapshot
CatalogAudit
ExperienceLevelHistory
```

Category immutable giúp identity hiện tại không bị thay đổi bởi edit lifecycle vì edit lifecycle không tồn tại.

Việc snapshot Category vào Job, CV, Application hoặc entity tương lai không thuộc V4.

---

# 14. Explicitly Excluded Persistence

Chủ động KHÔNG thêm trong V4:

```text
- Category.isActive
- Category.status
- Category.deletedAt
- Category.disabledAt
- Category.updatedAt
- Category.companyId
- Category.createdBy
- Category.updatedBy

- CategoryHistory collection
- CategoryAudit collection
- CategoryAlias collection

- locations collection
- employment_types collection
- work_modes collection

- Location.isActive
- EmploymentType.isActive
- WorkMode.isActive

- Experience collection
- experienceYears
- ExperienceLevel.minYears
- ExperienceLevel.maxYears
- ExperienceLevel.isActive
- ExperienceLevel.companyId

- Job.categoryId
- Job.location
- Job.employmentType
- Job.workMode
- Job.experienceLevelId

- CV.categoryId
- CV.location
- CV.employmentType
- CV.workMode
- CV.experienceLevelId
```

Không thêm relationship tới Job/CV vì các entity đó chưa thuộc V4.

Không thêm field chỉ để:

```text
"phòng version sau có thể cần"
```

Nếu version sau cần persistence mới, Data Contract của version đó phải bổ sung.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

V4 phải giữ nguyên:

* User identity;
* User role model;
* Platform Admin là platform-level actor;
* Company lifecycle;
* CompanyMember lifecycle;
* Company Manager membership;
* Recruiter membership;
* authentication/session/token invariants;
* tenant isolation của Company-owned resource.

## 15.2. Persistence behavior phải giữ

Không thay đổi schema hoặc lifecycle của:

```text
users
companies
company_members
auth_sessions
auth_tokens
```

Không chuyển catalog V4 thành embedded data trong Company hoặc User.

## 15.3. Thay đổi được phép

V4 chỉ được:

* thêm `categories`;
* thêm `experience_levels`;
* bổ sung canonical fixed vocabularies:

  * Location;
  * EmploymentType;
  * WorkMode.

## 15.4. Thay đổi không được phép

Không được:

* thêm `companyId` vào Category;
* thêm catalog ownership vào CompanyMember;
* tạo role `CATALOG_MANAGER`;
* reinterpret Platform Admin thành Company member;
* thay đổi User lifecycle;
* thay đổi Company lifecycle;
* thay đổi Recruiter lifecycle.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở persisted state.

### Category

1. Mọi Category có đúng một `level`.

2. `level` chỉ có thể là:

```text
FIELD
POSITION
```

3. Nếu:

```text
level = FIELD
```

thì:

```text
parentCategoryId = null
```

4. Nếu:

```text
level = POSITION
```

thì:

```text
parentCategoryId != null
```

5. Parent của POSITION phải tồn tại.

6. Parent của POSITION phải có:

```text
level = FIELD
```

7. Không có Category level thứ ba.

8. Không có Category self-parent.

9. FIELD unique toàn platform theo canonical normalized identity.

10. POSITION unique trong cùng FIELD theo canonical normalized identity.

11. POSITION cùng tên được phép tồn tại dưới FIELD khác.

12. Category đã persist không có lifecycle update hợp lệ.

13. Category đã persist không có lifecycle delete hợp lệ.

14. Category không có tenant owner.

### ExperienceLevel

15. Mọi ExperienceLevel persisted phải có code thuộc:

```text
NO_EXPERIENCE
UNDER_1_YEAR
ONE_TO_THREE_YEARS
THREE_TO_FIVE_YEARS
FIVE_TO_TEN_YEARS
OVER_TEN_YEARS
```

16. Mỗi code tồn tại tối đa một document.

17. Canonical dataset phải chứa một document cho mỗi code đã chốt.

18. Không tồn tại runtime mutation lifecycle của ExperienceLevel.

19. ExperienceLevel không thuộc Company.

### Fixed vocabularies

20. EmploymentType chỉ gồm:

```text
FULL_TIME
PART_TIME
INTERNSHIP
CONTRACT
TEMPORARY
FREELANCE
SEASONAL
APPRENTICESHIP
```

21. WorkMode chỉ gồm:

```text
ONSITE
HYBRID
REMOTE
```

22. `REMOTE` không được xuất hiện như một Location.

23. Location chỉ được có một trong 64 canonical members đã định nghĩa.

24. Trong 64 members:
    - 63 members đại diện cho tỉnh/thành thuộc canonical Vietnam location snapshot;
    - `FOREIGN` đại diện cho địa điểm ngoài Việt Nam.

25. `FOREIGN` không đại diện cho một quốc gia cụ thể.

26. Location không có hierarchy persistence trong V4.

27. Location, EmploymentType và WorkMode không có collection riêng trong V4.

### Version boundary

26. Không tồn tại V4 reference tới Job hoặc CV.

27. Không tồn tại Company ownership trên dữ liệu chuẩn V4.

28. Không schema V1–V3 nào bị thay đổi bởi V4.

---

# 17. Definition of Data Completion

Data Contract V4 được coi là hoàn thành khi:

* `categories` đã có contract đầy đủ;
* `experience_levels` đã có contract đầy đủ;
* Category fields và relationship đã rõ;
* Category uniqueness được database bảo vệ;
* FIELD/POSITION structural rule đã rõ;
* cross-document parent validation có service owner;
* Category immutability có enforcement owner;
* ExperienceLevel fixed dataset được xác định;
* EmploymentType fixed enum được xác định;
* WorkMode fixed enum được xác định;
* Location fixed enum được xác định đầy đủ với đúng 64 canonical members;
* transaction/atomicity requirement đã được xác định;
* constraint ownership đã rõ;
* multi-tenant boundary đã rõ;
* compatibility với V1–V3 được giữ;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn.



---

# 18. Implementation Boundary

Tài liệu này là canonical persistence/data contract của V4.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này định nghĩa:

* collections;
* fields;
* references;
* relationships;
* cardinality;
* enums;
* indexes;
* uniqueness;
* persistence transitions;
* transaction/atomicity requirements;
* persistence invariants;
* constraint ownership;
* platform data ownership.

Tài liệu này không định nghĩa:

* REST endpoints;
* HTTP methods;
* HTTP status codes;
* request body;
* response body;
* controllers;
* routes;
* middleware implementation;
* service function structure;
* MongoDB query cụ thể;
* Mongoose method cụ thể;
* source-code structure;
* UI behavior;
* frontend flow;
* test framework;
* seed implementation;
* migration command.

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
        │
        │ ACTUAL CODE
        ↓
Tests
```

Thứ tự authority:

```text
Approved Product Spec
→ business truth

Approved Data Contract
→ persistence truth

Engineering Contracts
→ architecture truth

PROJECT_STATUS
→ implementation snapshot

Source code + tests
→ actual implementation evidence

Raw idea / macro database / diagrams
→ input material only
```

Nếu raw macro database hoặc entity diagram cũ mâu thuẫn với Product Specification hoặc Data Contract này, raw design không có authority để override canonical contract.
