# V8 — Job Discovery Data Model

> **File:** `docs/data/versions/v8-job-discovery-data-model.md`
> **Vai trò:** Planning draft Persistence / Data Contract — chưa có implementation authority khi V8 `PENDING`
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v8-job-discovery.md`

> **Governance status:** V8 hiện `PENDING` theo `docs/product/roadmap.md` và
> `docs/PROJECT_STATUS.md`. Nội dung này chỉ trở thành canonical persistence
> contract cho implementation sau khi được review, approved và roadmap chuyển
> V8 ra khỏi `PENDING`.

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v8-job-discovery.md
```

Product Specification là authority đối với business behavior.

Data Contract V8 xác định:

* entity hiện hữu nào được Job Discovery sử dụng;
* field nào tham gia trực tiếp vào visibility, search, filter, sort và public detail;
* relationship và data ownership;
* index cần bổ sung cho các access pattern của V8;
* cách persisted state hiện hữu được ánh xạ thành effective visibility;
* persistence transition nào thuộc hoặc không thuộc V8;
* transaction / atomicity requirement;
* constraint nào được schema/database bảo vệ;
* constraint nào cần business/service context;
* multi-tenant data boundary;
* các field, collection và persistence abstraction chủ động không thêm.

V8 không được sử dụng Data Contract để:

* tạo Job lifecycle mới;
* tạo Company lifecycle mới;
* tạo Candidate–Job relationship;
* mở rộng actor hoặc quyền ngoài Product Specification;
* biến effective visibility thành persisted business state mới.

Nếu Data Contract mâu thuẫn với Product Specification, Product Specification phải được coi là authority và conflict phải được đưa trở lại Product layer thay vì tự reconcile.

---

## 2. Thay đổi so với version trước

V8 chủ yếu **đọc lại dữ liệu đã tồn tại**.

V8 không bổ sung business entity, business field hoặc relationship mới.

| Entity           | Trạng thái  | Thay đổi trong V8                                                                    |
| ---------------- | ----------- | ------------------------------------------------------------------------------------ |
| `Job`            | `UPDATED`   | Giữ nguyên fields/relationships; bổ sung index phục vụ discovery/filter/sort         |
| `Company`        | `UPDATED`   | Giữ nguyên fields/relationships; sử dụng `operationalStatus` trong public visibility |
| `Category`       | `UNCHANGED` | Giữ nguyên fields/relationship và index hierarchy canonical V4                        |
| `Location`       | `UNCHANGED` | Được sử dụng cho display/filter                                                      |
| `WorkMode`       | `UNCHANGED` | Được sử dụng cho display/filter                                                      |
| `EmploymentType` | `UNCHANGED` | Được sử dụng cho display/filter                                                      |
| `ExperienceLevel`| `UNCHANGED` | Được sử dụng cho display/filter                                                      |

### 2.1. Entity mới

Không có.

V8 không tạo:

```text
JobDiscovery
JobSearch
JobSearchResult
JobPublicProfile
CompanyPublicProfile
CandidateJob
JobView
SearchHistory
SavedJob
```

### 2.2. Entity được mở rộng

Không entity nào được mở rộng bằng business field hoặc relationship mới.

Các thay đổi persistence mới của V8 chỉ gồm index được định nghĩa trong tài liệu này.

### 2.3. Entity giữ nguyên nhưng được sử dụng

V8 đọc lại:

* `Job`;
* `Company`;
* `Category`;
* `Location`;
* `WorkMode`;
* `EmploymentType`;
* `ExperienceLevel`.

Các entity từ version trước như:

* `User`;
* `CompanyMember`;
* Candidate Profile;
* Candidate CV;

không cần relationship hoặc field mới để hỗ trợ V8.

V8 không thay đổi schema của chúng.

---

## 3. Collection / Entity tổng thể

Các persisted entity V8 sử dụng trực tiếp:

```text
Job
Company
Category
ExperienceLevel
```

Các fixed vocabulary V8 sử dụng trực tiếp:

```text
Location
EmploymentType
WorkMode
```

Tên collection vật lý tiếp tục kế thừa version trước.

V8 không rename hoặc tạo collection song song.

### Vai trò tổng quát

| Entity           | Responsibility trong V8                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `Job`            | Nguồn dữ liệu trung tâm của Job Discovery                              |
| `Company`        | Owner của Job; cung cấp public Company data và operational eligibility |
| `Category`       | Cung cấp Field/Position hierarchy và Category filter                   |
| `Location`       | Fixed vocabulary cho Location của Job và filter                        |
| `WorkMode`       | Fixed vocabulary cho Work mode của Job và filter                       |
| `EmploymentType` | Fixed vocabulary cho Employment type của Job và filter                 |
| `ExperienceLevel`| Cung cấp Experience requirement của Job và filter                      |

Location, EmploymentType và WorkMode không phải collection. Không tạo thêm
collection ngoài persisted entities trên chỉ để hỗ trợ search, filtering,
relevance hoặc public projection.

---

## 4. Quan hệ dữ liệu

### 4.1. Company → Job

**Cardinality**

```text
Company 1 ───── N Job
```

**Owner của relationship**

`Job`

**Reference**

```text
Job.companyId
```

**Required**

YES.

**Constraint**

* Mỗi Job thuộc đúng một Company.
* `companyId` không thay đổi ý nghĩa trong V8.
* Company sở hữu Job là canonical tenant owner của Job.
* Public visibility của Job phụ thuộc vào `Company.operationalStatus`.
* V8 không copy Company ownership sang field khác.

**Lifecycle**

Company lifecycle và Job lifecycle tiếp tục thuộc các version trước.

V8 không tự thay đổi:

```text
Job.status
Company.operationalStatus
```

để phản ánh public visibility.

---

### 4.2. Category FIELD → Category POSITION

**Cardinality**

```text
Category FIELD 1 ───── N Category POSITION
```

**Owner**

Category con.

**Reference**

```text
Category.parentCategoryId
```

**Constraint**

Đối với Category có:

```text
level = FIELD
```

thì:

```text
parentCategoryId = null
```

Đối với Category có:

```text
level = POSITION
```

thì `parentCategoryId` phải tham chiếu một Category có:

```text
level = FIELD
```

V8 không tạo hierarchy Category riêng.

---

### 4.3. Job → Category FIELD

**Cardinality**

```text
Job N ───── N Category FIELD
```

**Reference**

```text
Job.fieldCategoryIds[]
```

**Constraint**

Mỗi reference phải trỏ tới Category thuộc level:

```text
FIELD
```

V8 không thay đổi cardinality đã được Job contract trước đó định nghĩa.

---

### 4.4. Job → Category POSITION

**Cardinality**

```text
Job N ───── N Category POSITION
```

**Reference**

```text
Job.positionCategoryIds[]
```

**Constraint**

Mỗi reference phải trỏ tới Category thuộc level:

```text
POSITION
```

Mỗi Position của Job phải có `parentCategoryId` thuộc:

```text
Job.fieldCategoryIds[]
```

V8 sử dụng relationship này để bảo toàn semantics:

```text
Field
  └─ Position thuộc Field
```

V8 không persist lựa chọn filter của người dùng.

---

### 4.5. Job → Location

**Representation**

```text
Job.location
```

Mỗi completed Job có đúng một canonical Location literal theo Job contract
hiện hữu; Location không có collection hoặc ObjectId reference.

`REMOTE` không được biểu diễn bằng `Location`.

---

### 4.6. Job → WorkMode

**Representation**

```text
Job.workModes[]
```

Completed Job có một hoặc nhiều canonical WorkMode literals theo Job contract
hiện hữu; WorkMode không có collection hoặc ObjectId reference.

Work mode và Location là hai dimension độc lập.

---

### 4.7. Job → EmploymentType

**Representation**

```text
Job.employmentType
```

Mỗi completed Job có đúng một canonical EmploymentType literal; EmploymentType
không có collection hoặc ObjectId reference.

---

### 4.8. Job → ExperienceLevel

**Cardinality**

```text
ExperienceLevel 1 ───── 0..N Job
```

**Reference**

```text
Job.experienceLevelId
```

Mỗi completed Job có đúng một ExperienceLevel requirement chuẩn.

V8 không bổ sung trường số năm kinh nghiệm trực tiếp vào Job.

---

### 4.9. Candidate → Job

V8 **không tạo relationship persistence** giữa Candidate và Job.

Không tạo:

```text
Candidate ───── Job
```

chỉ vì Candidate:

* xem Job;
* search;
* filter;
* sort;
* mở Job detail.

Các hành vi này là read-only và không tạo persisted relationship.

---

## 5. Entity trung tâm

### 5.1. `Job`

#### 5.1.1. Responsibility

`Job` tiếp tục là canonical persistence entity của cơ hội tuyển dụng.

Trong V8, Job chịu trách nhiệm cung cấp dữ liệu cho:

* discovery eligibility;
* keyword search;
* filter;
* sort;
* Job list;
* Job detail;
* historical read-only detail.

`Job` không chịu trách nhiệm lưu:

* search state;
* relevance score;
* public/effective status riêng;
* Job view history;
* Saved Job;
* Candidate relationship;
* duplicated Company information.

---

### 5.1.2. Fields

Các field V8 trực tiếp sử dụng:

| Field                 | Type                 | Required khi persist | Default   | Constraint                           | Ý nghĩa trong V8                            |
| --------------------- | -------------------- | ------------------: | --------- | ------------------------------------ | ------------------------------------------- |
| `_id`                 | `ObjectId`           | YES                 | generated | unique                               | Định danh Job                               |
| `companyId`           | `ObjectId`           | YES                 | —         | immutable, ref `Company`             | Company sở hữu Job                          |
| `title`               | `String \| null`     | NO                  | `null`    | V5 DRAFT may be partial              | Display + keyword search                    |
| `jobDescription`      | `String \| null`     | NO                  | `null`    | V5 DRAFT may be partial              | Job detail + keyword search                 |
| `requiredSkills`      | `String[]`           | NO                  | `[]`      | V5 DRAFT may be partial              | Display + keyword search                    |
| `salaryText`          | `String \| null`     | NO                  | `null`    | V5 DRAFT may be partial              | Public salary information                   |
| `fieldCategoryIds`    | `ObjectId[]`         | NO                  | `[]`      | ref Category `FIELD`                 | Category filter                             |
| `positionCategoryIds` | `ObjectId[]`         | NO                  | `[]`      | ref Category `POSITION`              | Category filter                             |
| `location`            | `Location \| null`   | NO                  | `null`    | canonical fixed vocabulary            | Location filter                             |
| `employmentType`      | `EmploymentType\|null`| NO                 | `null`    | canonical fixed vocabulary            | Employment type filter                      |
| `workModes`           | `WorkMode[]`         | NO                  | `[]`      | canonical fixed vocabulary            | Work mode filter                            |
| `experienceLevelId`   | `ObjectId \| null`   | NO                  | `null`    | ref `ExperienceLevel`                | Experience filter                           |
| `applicationDeadline` | `Date \| null`       | NO                  | `null`    | V5 DRAFT may be partial              | Realtime expiry eligibility + expiring sort |
| `status`              | enum                 | YES                 | `DRAFT`   | canonical Job enum                   | Public lifecycle eligibility                |
| `publishedAt`         | `Date \| null`       | YES                 | `null`    | write-once by prior lifecycle         | `NEWEST` and prior-public evidence          |
| `createdAt`           | `Date`               | YES                 | automatic | —                                    | Metadata hiện hữu                           |
| `updatedAt`           | `Date`               | YES                 | automatic | —                                    | Metadata hiện hữu                           |

Requiredness, defaults, types and conditional completeness remain owned by the
canonical V5 Job contract. V8 reads only public-complete Jobs but must not
tighten the global schema merely because DRAFT remains intentionally partial.

Các field nội bộ đã tồn tại như:

```text
createdByCompanyMemberId
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds
```

phải tiếp tục được giữ theo các canonical data contract trước V8.

V8:

* không thay đổi chúng;
* không sử dụng chúng để xác định discovery eligibility;
* không làm chúng trở thành public Job data.

---

### 5.1.3. Enum `status`

V8 không thay đổi canonical Job enum:

```text
DRAFT
PENDING_APPROVAL
PUBLISHED
CLOSED
EXPIRED
```

V8 không thêm:

```text
CHANGES_REQUESTED
REJECTED
```

| Status             | Vai trò đối với V8                              |
| ------------------ | ----------------------------------------------- |
| `DRAFT`            | Không public                                    |
| `PENDING_APPROVAL` | Không public                                    |
| `PUBLISHED`        | Có thể discoverable tùy deadline và Company     |
| `CLOSED`           | Không discoverable; có thể historical read-only |
| `EXPIRED`          | Không discoverable; có thể historical read-only |

`DISCOVERABLE`, `HISTORICAL_READ_ONLY` và `INACCESSIBLE` **không phải persisted Job status**.

---

### 5.1.4. Indexes

V8 bổ sung các index phục vụ các access pattern đã xuất hiện trong Product Specification.

#### Discovery + Newest

```text
{ status: 1, publishedAt: -1 }
```

Tên canonical:

```text
job_discovery_newest_idx
```

Mục đích:

* lọc theo persisted Job state;
* hỗ trợ `NEWEST`.

---

#### Discovery + Expiring Soon

```text
{ status: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_expiring_idx
```

Mục đích:

* xác định Job còn deadline;
* hỗ trợ `EXPIRING_SOON`.

---

#### Field Category filter

```text
{ status: 1, fieldCategoryIds: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_field_category_idx
```

---

#### Position Category filter

```text
{ status: 1, positionCategoryIds: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_position_category_idx
```

---

#### Location filter

```text
{ status: 1, location: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_location_idx
```

---

#### Employment type filter

```text
{ status: 1, employmentType: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_employment_type_idx
```

---

#### Experience filter

```text
{ status: 1, experienceLevelId: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_experience_idx
```

---

#### Work mode filter

```text
{ status: 1, workModes: 1, applicationDeadline: 1 }
```

Tên canonical:

```text
job_discovery_work_mode_idx
```

---

### 5.1.5. Multikey index constraint

Các compound index V8 trên Job không được ghép nhiều array field song song trong cùng một compound key.

Ví dụ V8 không định nghĩa index dạng:

```text
{
  fieldCategoryIds: 1,
  positionCategoryIds: 1,
  workModes: 1
}
```

Mỗi compound filter index được định nghĩa độc lập để tránh yêu cầu persistence structure không phù hợp với các array relationship hiện hữu.

---

### 5.1.6. Search persistence

V8 không persist relevance.

Không thêm:

```text
relevanceScore
searchText
```

V8 cũng không duplicate:

```text
Company.name
```

vào Job để phục vụ search.

Canonical Product chỉ yêu cầu keyword được đối chiếu với:

```text
title
requiredSkills
Company.name
jobDescription
```

và business priority:

```text
title
>
requiredSkills
>
Company.name
>
jobDescription
```

Cách tính hoặc thực hiện relevance không thuộc persistence state của V8.

V8 không định nghĩa full-text/search-specific persisted structure mới.

---

### 5.1.7. Embedded documents

V8 không bổ sung embedded document mới vào `Job`.

Các embedded structure đã có từ version trước, nếu có, tiếp tục theo contract sở hữu của version đó.

---

### 5.1.8. Reference rules

| Field                   | Reference        | Required | Cardinality | Rule                                                 |
| ----------------------- | ---------------- | -------: | ----------- | ---------------------------------------------------- |
| `companyId`             | `Company`        |      YES | N → 1       | Company sở hữu Job                                   |
| `fieldCategoryIds[]`    | `Category`       |      YES | N ↔ N       | Reference phải là `FIELD`                            |
| `positionCategoryIds[]` | `Category`       |      YES | N ↔ N       | Reference phải là `POSITION` thuộc một Field của Job |
| `location`              | fixed `Location` | conditional | literal | Location chuẩn                                      |
| `employmentType`        | fixed `EmploymentType` | conditional | literal | Employment type chuẩn                         |
| `workModes[]`           | fixed `WorkMode` | conditional | literals | Work mode chuẩn                                      |
| `experienceLevelId`     | `ExperienceLevel`| conditional | N → 1 | ExperienceLevel chuẩn                                 |

V8 không tạo reference tới Candidate.

---

## 6. Company và Catalog entities

### 6.1. `Company`

#### Responsibility

Trong V8, `Company` chịu trách nhiệm:

* xác định owner của Job;
* cung cấp `operationalStatus`;
* cung cấp Company name cho keyword search;
* cung cấp public Company information.

V8 không chuyển hoặc duplicate các field này sang Job.

---

#### Fields V8 trực tiếp sử dụng

| Field               | Type       | Required | Constraint               | Ý nghĩa                    |
| ------------------- | ---------- | -------: | ------------------------ | -------------------------- |
| `_id`               | `ObjectId` |      YES | unique                   | Định danh Company          |
| `name`              | `String`   |      YES | kế thừa Company contract | Display + keyword search   |
| `logoUrl`           | `String`   |       NO | kế thừa                  | Public Company information |
| `bannerUrl`         | `String`   |       NO | kế thừa                  | Public Company information |
| `website`           | `String`   |       NO | kế thừa                  | Public Company information |
| `address`           | `String`   |       NO | kế thừa                  | Public Company information |
| `description`       | `String`   |       NO | kế thừa                  | Public Company information |
| `contactInfo`       | inherited  |       NO | kế thừa                  | Public Company information |
| `operationalStatus` | enum       |      YES | canonical Company enum   | Public visibility gate     |
| `createdAt`         | `Date`     |      YES | existing                 | Metadata                   |
| `updatedAt`         | `Date`     |      YES | existing                 | Metadata                   |

Các field Company nội bộ khác tiếp tục tồn tại theo canonical Company contract trước V8 và không được remove chỉ vì V8 không public chúng.

Ví dụ:

```text
approvalStatus
reviewedByUserId
reviewSnapshot
submittedAt
reviewedAt
activatedAt
businessRegistrationNumber
```

V8 không thay đổi requiredness, lifecycle hoặc semantics của các field này.

---

#### Enum `operationalStatus`

V8 sử dụng enum đã tồn tại:

```text
INACTIVE
ACTIVE
LOCKED
```

V8 chỉ coi:

```text
ACTIVE
```

là operational state cho phép public Job access.

V8 không tạo Company status mới.

---

#### Indexes

Không bắt buộc bổ sung index mới trên `Company.operationalStatus` chỉ để phản ánh business rule `ACTIVE`.

Lý do:

* `operationalStatus` là business visibility condition;
* Product Specification không quy định access plan cụ thể;
* Job đã giữ canonical `companyId`;
* `_id` của Company đã là canonical identity lookup.

Nếu một index tương đương trên `operationalStatus` đã tồn tại từ version trước, V8 giữ nguyên.

V8 không tạo duplicate Company data trong Job chỉ để tránh Company lookup.

---

#### Embedded documents

V8 không bổ sung Company embedded document mới.

Các Company snapshot/review embedded data hiện hữu không thuộc Job Discovery và không thay đổi.

---

### 6.2. `Category`

#### Responsibility

`Category` lưu hierarchy chuẩn:

```text
FIELD
  └─ POSITION
```

V8 sử dụng hierarchy này cho Category filter.

---

#### Fields

| Field              | Type       |    Required | Default   | Constraint           |
| ------------------ | ---------- | ----------: | --------- | -------------------- |
| `_id`              | `ObjectId` |         YES | generated | unique               |
| `parentCategoryId` | `ObjectId` | conditional | `null`    | ref `Category`       |
| `name`             | `String`   |         YES | —         | kế thừa              |
| `normalizedName`   | `String`   |         YES | —         | kế thừa              |
| `level`            | enum       |         YES | —         | `FIELD` / `POSITION` |

#### Enum

```text
FIELD
POSITION
```

#### Index

V8 không bổ sung Category index. Canonical V4 unique index
`{ parentCategoryId: 1, normalizedName: 1 }` tiếp tục là owner cho Position
lookup theo Field.

---

### 6.3. Fixed vocabulary `Location`

#### Responsibility

Location là fixed vocabulary canonical V4, lưu trực tiếp trên `Job.location`.
Không có Location collection, identity, lifecycle hay index riêng.

V8 không thêm Location đặc biệt cho `REMOTE`.

Không bổ sung index mới trong V8.

---

### 6.4. Fixed vocabulary `WorkMode`

#### Responsibility

WorkMode là fixed vocabulary canonical V4, lưu trực tiếp trên `Job.workModes[]`.
Các giá trị business V8 sử dụng gồm:

```text
ONSITE
HYBRID
REMOTE
```

Không có WorkMode collection, identity, lifecycle hay index riêng.

---

### 6.5. Fixed vocabulary `EmploymentType`

#### Responsibility

EmploymentType là fixed vocabulary canonical V4, lưu trực tiếp trên
`Job.employmentType`. Không có EmploymentType collection, identity, lifecycle
hay index riêng.

---

### 6.6. `ExperienceLevel`

#### Responsibility

`ExperienceLevel` là persisted fixed dataset canonical V4.

V8 không thêm số năm kinh nghiệm vào Job.

#### Fields

| Field  | Type       | Required | Constraint              |
| ------ | ---------- | -------: | ----------------------- |
| `_id`  | `ObjectId` |      YES | unique                  |
| `code` | `String`   |      YES | canonical V4 enum, unique, immutable |

V8 không thêm `name`, `minYears`, `maxYears` hay `isActive`, và không bổ sung
index mới ngoài canonical V4 index `{ code: 1 }` unique.

---

# 7. State Matrix

V8 có nhiều state dimension ảnh hưởng effective public visibility nhưng **không persist effective state riêng**.

Các dimension:

```text
Job.status
applicationDeadline so với current time
Company.operationalStatus
Job existence / prior publication
```

### 7.1. Effective visibility matrix

| Persisted Job state   | Deadline  | Company    | Prior public evidence | Effective V8 state     | Persist mới? |
| --------------------- | --------- | ---------- | --------------------- | ---------------------- | -----------: |
| `PUBLISHED`           | tương lai | `ACTIVE`   | `publishedAt != null` | `DISCOVERABLE`         |           NO |
| `PUBLISHED`           | đã qua    | `ACTIVE`   | `publishedAt != null` | `HISTORICAL_READ_ONLY` |           NO |
| `CLOSED`              | bất kỳ    | `ACTIVE`   | Job đã từng public    | `HISTORICAL_READ_ONLY` |           NO |
| `EXPIRED`             | bất kỳ    | `ACTIVE`   | Job đã từng public    | `HISTORICAL_READ_ONLY` |           NO |
| `DRAFT`               | bất kỳ    | bất kỳ     | —                     | `INACCESSIBLE`         |           NO |
| `PENDING_APPROVAL`    | bất kỳ    | bất kỳ     | —                     | `INACCESSIBLE`         |           NO |
| otherwise public Job  | bất kỳ    | `INACTIVE` | bất kỳ                | `INACCESSIBLE`         |           NO |
| otherwise public Job  | bất kỳ    | `LOCKED`   | bất kỳ                | `INACCESSIBLE`         |           NO |
| Job không còn tồn tại | —         | bất kỳ     | —                     | `INACCESSIBLE`         |           NO |

### 7.2. Effective state không được persist

Không tạo:

```text
effectiveStatus
publicStatus
isDiscoverable
isAcceptingApplications
```

Các giá trị:

```text
DISCOVERABLE
HISTORICAL_READ_ONLY
INACCESSIBLE
```

là projection từ canonical persisted data và current time.

Chúng không phải persisted state dimension.

---

### 7.3. Deadline là dynamic condition

Ví dụ persisted state:

```text
Job.status = PUBLISHED
Company.operationalStatus = ACTIVE
```

Tại thời điểm:

```text
now < applicationDeadline
```

effective state là:

```text
DISCOVERABLE
```

Khi thời gian đi qua deadline:

```text
now >= applicationDeadline
```

effective state trở thành:

```text
HISTORICAL_READ_ONLY
```

ngay cả khi database vẫn còn:

```text
Job.status = PUBLISHED
```

V8 không yêu cầu một write chỉ để effective visibility thay đổi.

---

# 8. Persistence Transitions

V8 không sở hữu business write transition mới.

Các transition persisted của:

* Job;
* Company;
* Catalog;

tiếp tục thuộc canonical contract của các version sở hữu lifecycle đó.

V8 chỉ **quan sát** persisted transition và thay đổi cách resource được đọc.

---

## 8.1. Job được publish bởi lifecycle trước V8

### Trigger business

Thuộc Job lifecycle trước V8.

### Persisted state liên quan

Sau khi canonical publish transition hoàn tất:

```text
Job.status = PUBLISHED
Job.publishedAt != null
```

V8 không thực hiện transition này.

### V8 interpretation

Nếu đồng thời:

```text
applicationDeadline > now
Company.operationalStatus = ACTIVE
```

thì effective V8 state:

```text
DISCOVERABLE
```

### Entity bị thay đổi bởi V8

Không có.

---

## 8.2. Deadline đi qua

### Trước

```text
Job.status = PUBLISHED
applicationDeadline > now
Company = ACTIVE
```

### Sau về mặt thời gian

```text
Job.status = PUBLISHED
applicationDeadline <= now
Company = ACTIVE
```

### Persisted mutation bắt buộc bởi V8

Không có.

### Effective visibility

```text
DISCOVERABLE
→
HISTORICAL_READ_ONLY
```

V8 không cần đợi persisted transition:

```text
PUBLISHED → EXPIRED
```

để ngừng hiển thị Job trong discovery.

---

## 8.3. Persisted `PUBLISHED → EXPIRED`

Nếu lifecycle trước V8 có workflow persist:

```text
Job.status = EXPIRED
```

V8 tiếp tục xem Job đó là:

```text
HISTORICAL_READ_ONLY
```

khi Company vẫn `ACTIVE`.

V8 không tạo hoặc sở hữu transition này.

---

## 8.4. Persisted `PUBLISHED → CLOSED`

Nếu Job được đóng theo canonical lifecycle trước V8:

```text
PUBLISHED
→
CLOSED
```

V8:

* loại Job khỏi discovery;
* vẫn cho historical read-only nếu Company `ACTIVE`.

Không có persisted field V8 nào được cập nhật.

---

## 8.5. Company rời `ACTIVE`

### Trước

```text
Company.operationalStatus = ACTIVE
```

Job có thể đang:

```text
DISCOVERABLE
```

hoặc:

```text
HISTORICAL_READ_ONLY
```

### Sau

Nếu Company trở thành:

```text
INACTIVE
```

hoặc:

```text
LOCKED
```

V8 effective state của các Job public thuộc Company trở thành:

```text
INACCESSIBLE
```

### Persisted mutation trên Job do V8

Không có.

V8 **không cascade**:

```text
Company not ACTIVE
→ mutate Job.status
```

Company state và Job state tiếp tục là hai persisted dimensions riêng biệt.

---

## 8.6. Company trở lại `ACTIVE`

Nếu Company lifecycle của version trước cho phép Company trở lại:

```text
ACTIVE
```

V8 tính lại effective visibility từ persisted Job state và current deadline.

V8 không lưu trạng thái visibility trước đó và không cần transition phục hồi riêng.

---

## 8.7. Job bị hard delete

Khi Job bị xóa theo canonical lifecycle trước V8:

```text
Job document không còn tồn tại
```

V8 không tạo tombstone hoặc historical copy để tiếp tục public Job.

---

# 9. Transaction / Atomicity Requirements

> V8 không bổ sung transaction/atomicity requirement mới.

Lý do:

* V8 là read-only;
* V8 không persist search/filter/sort state;
* effective visibility không được persist;
* V8 không cập nhật Job khi Company state thay đổi;
* V8 không tạo Candidate–Job relationship;
* V8 không tạo snapshot;
* không có cross-document write invariant mới do V8 sở hữu.

Các transaction/atomicity requirement của:

* Job lifecycle;
* Company lifecycle;
* Recruitment Team;
* Catalog management;

tiếp tục thuộc canonical data contract của version sở hữu các mutation đó.

V8 không nâng mức bảo đảm thành:

* distributed transaction;
* exactly-once processing;
* external side-effect atomicity;

vì V8 không có external side effect thuộc atomic completion.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema bảo vệ structural constraint đã tồn tại hoặc được Data Contract định nghĩa rõ.

| Constraint                                                 | Owner    | Lý do                     |
| ---------------------------------------------------------- | -------- | ------------------------- |
| `_id` unique                                               | Database | Identity                  |
| `Job.status` thuộc canonical enum                          | Schema   | Local enum validation     |
| `Company.operationalStatus` thuộc canonical enum           | Schema   | Local enum validation     |
| `Category.level` thuộc `FIELD/POSITION`                    | Schema   | Local enum validation     |
| Job requiredness/defaults và conditional completeness V5   | Schema + service | DRAFT được phép partial; V8 không siết schema |
| Required Company fields                                    | Schema   | Local document structure  |
| Required catalog fields                                    | Schema   | Local document structure  |
| `normalizedName` unique nơi catalog contract đã định nghĩa | Database | Uniqueness                |
| Reference field có đúng structural type                    | Schema   | Local field validation    |
| Array reference field có đúng array structure              | Schema   | Local document validation |
| Index được định nghĩa ở V8                                 | Database | Query/data-access support |

Schema/database không được tự quyết business visibility chỉ dựa trên một field riêng lẻ.

---

## 10.2. Service / business layer bảo vệ

Các constraint cần cross-document, actor, current time hoặc business context thuộc service/business layer.

| Constraint                                                              | Owner                   | Lý do                            |
| ----------------------------------------------------------------------- | ----------------------- | -------------------------------- |
| Job `DISCOVERABLE` iff `PUBLISHED` + deadline future + Company `ACTIVE` | Service                 | Cần Job + Company + current time |
| Job hết deadline phải bị loại dù status vẫn `PUBLISHED`                 | Service                 | Dynamic time rule                |
| Company không `ACTIVE` chặn public Job detail                           | Service                 | Cross-document visibility        |
| Historical Job chỉ public nếu Company `ACTIVE`                          | Service                 | Cross-document visibility        |
| Job phải từng thuộc public lifecycle để historical public access        | Service                 | Lifecycle context                |
| Category reference trong `fieldCategoryIds` phải là `FIELD`             | Service                 | Cần referenced entity state      |
| Category reference trong `positionCategoryIds` phải là `POSITION`       | Service                 | Cần referenced entity state      |
| Position phải thuộc một Field của cùng Job                              | Service                 | Cross-reference rule             |
| Search không bypass visibility                                          | Service                 | Business ordering                |
| Filter không bypass visibility                                          | Service                 | Business ordering                |
| Sort không bypass visibility                                            | Service                 | Business ordering                |
| Relevance priority `title > skills > Company > jobDescription`          | Service                 | Business relevance rule          |
| Recruiter được cross-Company public read                                | Service / authorization | Actor + public scope             |
| Company Manager không có V8 discovery capability                        | Authorization layer     | Product authorization            |
| Internal Job fields không public                                        | Service / projection    | Data exposure rule               |
| Internal Company fields không public                                    | Service / projection    | Data exposure rule               |

---

## 10.3. Constraint không được đẩy sai xuống schema

Schema không phải nơi xác định trực tiếp:

```text
isDiscoverable
```

bởi vì eligibility phụ thuộc:

```text
Job.status
+
applicationDeadline
+
current time
+
Company.operationalStatus
```

Tương tự, schema của Job không được copy:

```text
Company.operationalStatus
```

sang Job chỉ để localize visibility check.

---

# 11. Token / TTL Lifecycle

> V8 không bổ sung token/TTL persistence mới.

V8 không tạo:

* discovery token;
* search token;
* temporary Job access token;
* Job view session;
* expiring discovery artifact.

Application deadline là business field của Job, không phải TTL cleanup contract của V8.

Job hết application deadline không bị tự động delete bởi V8.

---

# 12. Multi-tenant Data Boundary

## 12.1. Canonical tenant key

Canonical tenant ownership của Job:

```text
Job.companyId
```

Company là tenant owner của Job.

V8 không thêm:

```text
tenantId
```

hoặc một Company ownership field song song.

---

## 12.2. Resource ownership

| Resource              | Tenant owner                           | Cách xác định              |
| --------------------- | -------------------------------------- | -------------------------- |
| `Job`                 | `Company`                              | `Job.companyId`            |
| Company internal data | `Company` / platform contract hiện hữu | canonical Company identity |
| `Category`            | Platform/global                        | Không thuộc một Company    |
| `Location`            | Platform/global                        | Không thuộc một Company    |
| `WorkMode`            | Platform/global                        | Không thuộc một Company    |
| `EmploymentType`      | Platform/global                        | Không thuộc một Company    |
| `ExperienceLevel`     | Platform/global                        | Không thuộc một Company    |

---

## 12.3. Public cross-tenant read

V8 cho phép:

```text
Guest
Candidate
Recruiter
Platform Admin
        ↓
public Job Discovery
        ↓
Job của Company A
Job của Company B
Job của Company C
```

nếu từng Job thỏa public visibility contract.

Đây là **public cross-tenant read**, không phải ownership transfer.

Đặc biệt:

```text
Recruiter của Company A
```

có thể đọc:

```text
Job public của Company B
```

cho mục đích Job Discovery.

---

## 12.4. Cross-tenant internal data bị cấm

Public cross-Company read không mở quyền đọc:

```text
createdByCompanyMemberId
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds
Recruitment Team
Company Manager
Recruiter list
approval internals
Application
pipeline
internal notes
internal metrics
```

Tenant ownership của dữ liệu này tiếp tục theo version sở hữu chúng.

---

## 12.5. `companyId` không phải authorization claim từ client

Canonical Company ownership được lấy từ:

```text
persisted Job.companyId
```

Không coi một `companyId` do client cung cấp là bằng chứng:

* Job thuộc Company đó;
* actor thuộc Company đó;
* actor được quyền đọc internal Company data.

Trong V8 không có mutation để client chọn Company owner của Job.

---

# 13. Snapshot / Historical Data

> V8 không bổ sung snapshot hoặc historical persistence mới.

### Historical read-only không đồng nghĩa snapshot

Khi V8 cho phép đọc Job:

```text
CLOSED
EXPIRED
PUBLISHED nhưng deadline đã qua
```

V8 đọc lại persisted Job hiện hữu.

Không tạo:

```text
HistoricalJob
JobPublicSnapshot
ClosedJobSnapshot
ExpiredJobSnapshot
CompanyPublicSnapshot
```

chỉ để phục vụ historical public detail.

### Company information

V8 tiếp tục sử dụng Company entity hiện hữu.

Không copy:

```text
companyName
companyLogo
companyDescription
```

vào Job.

Nếu version trước có snapshot riêng cho một business purpose khác, V8 không thay đổi lifecycle của snapshot đó.

---

# 14. Explicitly Excluded Persistence

V8 chủ động **KHÔNG thêm** các collection:

```text
JobDiscovery
JobSearch
JobSearchResult
JobPublicProfile
CompanyPublicProfile
CandidateJob
JobView
SearchHistory
SavedJob
HistoricalJob
JobPublicSnapshot
CompanyPublicSnapshot
```

V8 chủ động **KHÔNG thêm** vào `Job`:

```text
isPublished
isAcceptingApplications
isDiscoverable
effectiveStatus
publicStatus
relevanceScore
companyName
postedDate
searchText
wasPublic
deletedAt
isDeleted
```

Không thêm:

```text
status = DELETED
```

Không thêm Job status:

```text
CHANGES_REQUESTED
REJECTED
```

Không thêm vào User/Candidate:

```text
jobIds
viewedJobIds
searchHistory
```

Không thêm Candidate–Job relationship chỉ để chuẩn bị cho:

* Apply;
* Saved Jobs;
* Recommendation;
* View analytics.

Không thêm field chỉ để:

> "phòng version sau có thể cần".

---

## 14.1. Không persist derived values

Các giá trị sau được derive, không persist:

### Job còn nhận hồ sơ

```text
Job.status = PUBLISHED
AND
now < Job.applicationDeadline
AND
Company.operationalStatus = ACTIVE
```

### Posted date

```text
publishedAt
```

là persisted source cho business concept ngày đăng.

Không thêm:

```text
postedDate
```

### Relevance

Relevance được xác định tại thời điểm search.

Không persist:

```text
relevanceScore
```

### Company name của Job

Canonical source:

```text
Job.companyId
        ↓
Company.name
```

Không copy `companyName` vào Job.

---

## 14.2. Search-specific persistence chủ động không thêm

V8 không định nghĩa thêm:

* search collection;
* search result cache collection;
* persisted relevance;
* duplicated search document;
* denormalized Company name;
* `searchText`.

Data Contract V8 không yêu cầu full-text persistence structure riêng.

Search implementation phải tôn trọng Product Contract nhưng không được dùng nhu cầu search để tạo business state mới.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

V8 phải tiếp tục giữ:

* mỗi Job thuộc đúng một Company;
* Job lifecycle canonical trước V8;
* Company lifecycle canonical trước V8;
* Category hierarchy canonical;
* Location / WorkMode / EmploymentType fixed vocabulary và ExperienceLevel contract;
* đúng một Primary Recruiter theo Recruitment Team contract;
* Supporting Recruiter relationships;
* responsibility transfer invariants;
* Candidate Profile và CV invariants.

---

## 15.2. Persistence behavior phải giữ

V8 không thay đổi:

* Job creation persistence;
* Job approval persistence;
* Job publish persistence;
* Job close persistence;
* Job expire persistence;
* Job delete semantics;
* Company approval persistence;
* Company operational lifecycle;
* Recruiter responsibility fields;
* CandidateCV persistence.

---

## 15.3. Thay đổi được phép

V8 được phép:

* bổ sung index được định nghĩa trong Data Contract;
* sử dụng live Job/Company/catalog data cho discovery;
* derive effective visibility từ persisted data;
* sử dụng `publishedAt` cho sort `NEWEST`;
* sử dụng `applicationDeadline` cho eligibility và `EXPIRING_SOON`;
* sử dụng Company `operationalStatus` làm public visibility gate.

---

## 15.4. Thay đổi không được phép

V8 không được:

* thay đổi enum Job;
* thay đổi Company enum;
* thêm lifecycle state;
* đổi hard-delete semantics của Job thành soft delete;
* tạo duplicate Job;
* tạo public Job copy;
* persist effective visibility;
* mutate Job khi deadline đi qua chỉ vì Job Discovery cần ẩn Job;
* mutate Job khi Company bị lock/inactive chỉ vì Job Discovery cần chặn public access;
* tạo Candidate–Job relationship;
* sửa Recruitment Team fields;
* sửa Candidate CV schema.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng hoặc được xử lý theo owner đã xác định.

### PI-01 — Canonical Job ownership

```text
Job.companyId
```

là canonical Company owner của Job.

**Owner enforcement:** schema + service.

---

### PI-02 — Không duplicate Company ownership

Không tồn tại V8 ownership field song song như:

```text
tenantId
jobCompanyId
publicCompanyId
```

**Owner enforcement:** Data Contract / schema design.

---

### PI-03 — Job status không bị V8 mở rộng

Persisted Job status chỉ sử dụng canonical Job lifecycle enum.

**Owner enforcement:** schema.

---

### PI-04 — Effective visibility không persist

Không persisted state:

```text
DISCOVERABLE
HISTORICAL_READ_ONLY
INACCESSIBLE
```

trên Job hoặc Company.

**Owner enforcement:** schema design + service.

---

### PI-05 — Deadline không tạo persisted V8 state

Việc current time đi qua `applicationDeadline` không bắt buộc tạo write của V8.

**Owner enforcement:** service.

---

### PI-06 — Company status không cascade Job status trong V8

Nếu:

```text
Company.operationalStatus != ACTIVE
```

V8 không được tự persist:

```text
Job.status = CLOSED
```

hoặc:

```text
Job.status = EXPIRED
```

chỉ để đáp ứng public visibility.

**Owner enforcement:** service.

---

### PI-07 — Search không persist user interaction

Search không tạo:

```text
SearchHistory
JobView
CandidateJob
```

**Owner enforcement:** persistence design.

---

### PI-08 — Relevance không persist

Không tồn tại canonical persisted:

```text
Job.relevanceScore
```

**Owner enforcement:** schema design.

---

### PI-09 — Company name không duplicate trong Job

Canonical Company name vẫn nằm trên Company.

**Owner enforcement:** persistence design.

---

### PI-10 — Category level integrity

Mọi reference trong:

```text
Job.fieldCategoryIds[]
```

phải resolve thành Category level `FIELD`.

Mọi reference trong:

```text
Job.positionCategoryIds[]
```

phải resolve thành Category level `POSITION`.

**Owner enforcement:** service.

---

### PI-11 — Position-parent integrity

Với mỗi Position thuộc Job:

```text
position.parentCategoryId
```

phải thuộc:

```text
Job.fieldCategoryIds[]
```

**Owner enforcement:** service.

---

### PI-12 — Catalog dimensions không bị nhập nhằng

`Location` và `WorkMode` tiếp tục là hai entity/dimension độc lập.

`REMOTE` không tạo Location record đặc biệt chỉ cho V8.

**Owner enforcement:** data contract + service.

---

### PI-13 — Historical access không tạo historical copy

Historical read-only Job tiếp tục dựa trên canonical Job record hiện hữu.

**Owner enforcement:** persistence design.

---

### PI-14 — Hard delete không tạo tombstone V8

Nếu Job đã bị hard delete theo canonical lifecycle trước V8, V8 không tạo persisted surrogate để tiếp tục public.

**Owner enforcement:** persistence design.

---

### PI-15 — Internal recruitment fields vẫn tồn tại nhưng không public

Các field Recruitment Team hiện hữu trên Job không bị remove hoặc reinterpret bởi V8.

**Owner enforcement:** schema compatibility + service projection.

---

### PI-16 — Public cross-tenant read không thay đổi ownership

Recruiter hoặc actor khác đọc Job của Company khác không làm thay đổi:

```text
Job.companyId
```

và không tạo membership/ownership relationship mới.

**Owner enforcement:** service + persistence design.

---

# 17. Definition of Data Completion

V8 Data Contract được coi là hoàn thành khi:

* xác định rõ không có entity mới;
* xác định rõ không có business field mới;
* xác định rõ không có relationship mới;
* `Job`, `Company` và catalog responsibilities đã rõ;
* Job → Company ownership đã rõ;
* Category hierarchy đã rõ;
* Job → catalog reference rules đã rõ;
* các V8-relevant fields đã được xác định;
* persisted Job enum tiếp tục đúng với Product Specification;
* effective visibility được xác định là derived state, không persist;
* State Matrix đã phản ánh:

  * Job status;
  * deadline;
  * Company operational status;
* index phục vụ discovery/filter/sort đã được xác định;
* search-specific persistence chủ động không được thêm;
* persistence transitions của V8 đã được xác định là read-only/no new writes;
* xác định rõ deadline pass không yêu cầu V8 persistence transition;
* xác định rõ Company rời `ACTIVE` không cascade Job status;
* xác định rõ V8 không bổ sung transaction/atomicity requirement;
* constraint ownership giữa database/schema và service đã rõ;
* multi-tenant/data ownership đã rõ;
* public cross-tenant read đã rõ;
* không có snapshot/historical collection mới;
* Explicitly Excluded Persistence được giữ;
* compatibility với các version trước được giữ;
* toàn bộ persistence invariant có enforcement owner rõ ràng.

Data Completion không có nghĩa schema hoặc index đã được implementation.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự suy đoán business hoặc data architecture quan trọng.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V8 — Job Discovery.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entity;
* field;
* relationship;
* cardinality;
* enum persistence;
* indexes;
* reference rules;
* state representation;
* derived-state boundary;
* persistence transitions;
* transaction / atomicity requirements;
* persistence invariants;
* constraint ownership;
* multi-tenant data ownership;
* intentionally excluded persistence.

Tài liệu này không định nghĩa:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request body;
* response body;
* controller;
* route;
* middleware implementation;
* service function structure;
* database query cụ thể;
* search algorithm cụ thể;
* relevance formula cụ thể;
* source-code structure;
* frontend behavior;
* test framework.

Canonical layers:

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
        ↓
Tests
```

Thứ tự authority:

```text
Approved Product Specification
→ business truth

Approved Data Contract
→ persistence truth

Engineering Contracts
→ architecture truth

Implementation
→ actual behavior

Raw idea / macro database / diagram
→ input material only
```

Data Contract không được tạo business requirement mới.

Nếu một persistence decision tương lai cần behavior chưa tồn tại trong Product Specification, vấn đề phải được đưa trở lại Product layer để con người quyết định trước khi implementation.
