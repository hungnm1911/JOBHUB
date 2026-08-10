# V5 — Job và vòng đời phê duyệt Job Data Model

> **File:** `docs/data/versions/v5-job-approval-lifecycle-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v5-job-approval-lifecycle.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v5-job-approval-lifecycle.md
```

Product Specification V5 là authority đối với business behavior.

Data Contract V5 xác định:

* dữ liệu Job nào cần được persist;
* collection chịu trách nhiệm lưu Job;
* representation của partial `DRAFT`;
* Company ownership;
* người tạo Job và current Primary Recruiter;
* nội dung tuyển dụng;
* quan hệ với Category và ExperienceLevel của V4;
* representation của Location, EmploymentType và WorkMode;
* representation của Job lifecycle state;
* persistence transition;
* hard-delete boundary trước publication;
* historical retention sau publication;
* indexes cần thiết cho ownership, authorization và lifecycle;
* transaction/atomicity requirement;
* constraint do database/schema bảo vệ;
* constraint do service bảo vệ;
* multi-tenant data boundary;
* các field/collection chủ động không thêm.

Tài liệu này không được:

* thay đổi business lifecycle của V5;
* tạo thêm Job state;
* mở rộng quyền actor;
* thêm Job Discovery;
* thêm Application;
* thêm Supporting Recruiter;
* thay đổi V4 catalog contract;
* biến fixed vocabulary của V4 thành collection.

Nếu implementation hoặc persistence design cũ mâu thuẫn với tài liệu này, Data Contract V5 là authority đối với persistence của V5, với điều kiện không mâu thuẫn Product Specification.

---

# 2. Thay đổi so với version trước

V5 bổ sung một persisted entity mới:

```text
jobs
```

V5 không tạo thêm catalog collection.

### 2.1. Tổng quan thay đổi

| Entity / Collection / Vocabulary | Trạng thái             | Mô tả                                                           |
| -------------------------------- | ---------------------- | --------------------------------------------------------------- |
| `jobs`                           | `NEW`                  | Lưu Job và lifecycle của Job                                    |
| `companies`                      | `UNCHANGED`            | Là tenant owner của Job                                         |
| `company_members`                | `UNCHANGED`            | Cung cấp creator, Primary Recruiter và Company Manager identity |
| `categories`                     | `UNCHANGED`            | Catalog động của V4, được Job tham chiếu                        |
| `experience_levels`              | `UNCHANGED`            | Fixed persisted dataset của V4, được Job tham chiếu             |
| `Location`                       | `UNCHANGED VOCABULARY` | Fixed vocabulary V4, lưu trực tiếp giá trị trên Job             |
| `EmploymentType`                 | `UNCHANGED VOCABULARY` | Fixed vocabulary V4, lưu trực tiếp giá trị trên Job             |
| `WorkMode`                       | `UNCHANGED VOCABULARY` | Fixed vocabulary V4, lưu trực tiếp các giá trị trên Job         |
| `users`                          | `UNCHANGED`            | Không bổ sung Job ownership trực tiếp                           |
| `auth_sessions`                  | `UNCHANGED`            | Không thay đổi                                                  |
| `auth_tokens`                    | `UNCHANGED`            | Không thay đổi                                                  |

### 2.2. Entity mới

```text
jobs
```

### 2.3. Entity được mở rộng

Không có collection V1–V4 nào cần thêm field để hỗ trợ V5.

Đặc biệt không thêm:

```text
Company.jobIds
CompanyMember.jobIds
User.jobIds
Category.jobIds
ExperienceLevel.jobIds
```

Job là owner của các reference cần thiết.

### 2.4. Entity giữ nguyên nhưng được sử dụng

V5 sử dụng:

```text
companies
company_members
categories
experience_levels
```

nhưng không thay đổi schema canonical của các collection này.

### 2.5. Override bắt buộc so với macro database / entity design cũ

Canonical V5 **không sử dụng** các phần persistence design thô sau:

```text
Experience collection mới
Location collection
EmploymentType collection
WorkMode collection

locationId -> Location
employmentTypeId -> EmploymentType
workModeIds[] -> WorkMode

Experience.minYears
Experience.maxYears
Experience.isActive
```

Thay vào đó:

```text
experienceLevelId
    -> reference tới experience_levels của V4

location
    -> canonical Location literal của V4

employmentType
    -> canonical EmploymentType literal của V4

workModes[]
    -> canonical WorkMode literals của V4
```

Macro design yêu cầu toàn bộ Job content ngay khi create cũng bị thay thế.

Canonical V5 phải hỗ trợ:

```text
create Job
→ persist partial DRAFT
→ hoàn thiện dần
→ validate completeness khi submit
```

Do đó các content field không được schema-level bắt buộc ngay từ lúc Job được tạo.

---

# 3. Collection / Entity tổng thể

Persisted collections V5 trực tiếp sử dụng:

```text
jobs
companies
company_members
categories
experience_levels
```

Fixed vocabulary:

```text
Location
EmploymentType
WorkMode
```

### 3.1. Responsibility

| Entity / Vocabulary | Responsibility                                           |
| ------------------- | -------------------------------------------------------- |
| `jobs`              | Lưu ownership, content, current Primary và Job lifecycle |
| `companies`         | Canonical Company identity và Company lifecycle          |
| `company_members`   | Company-scoped identity của Recruiter và Company Manager |
| `categories`        | Category `FIELD` / `POSITION` chuẩn của platform         |
| `experience_levels` | Tập ExperienceLevel cố định của platform                 |
| `Location`          | Tập Location literal hợp lệ                              |
| `EmploymentType`    | Tập EmploymentType literal hợp lệ                        |
| `WorkMode`          | Tập WorkMode literal hợp lệ                              |

Không tạo thêm collection ngoài danh sách trên cho V5.

---

# 4. Quan hệ dữ liệu

## 4.1. Company → Job

**Cardinality**

```text
Company 1 ───── 0..N Job
```

**Owner của relationship**

```text
Job
```

**Reference**

```text
Job.companyId
```

**Constraint**

* mọi Job có đúng một `companyId`;
* `companyId` được xác lập khi tạo Job;
* `companyId` không thay đổi;
* Company được xác định từ Company membership hợp lệ của Recruiter tạo Job;
* client không phải authority của `companyId`.

**Lifecycle**

Job vẫn giữ cùng `companyId` khi:

* Primary Recruiter thay đổi;
* Job `PUBLISHED`;
* Job `CLOSED`;
* Job `EXPIRED`;
* creator bị khóa/chấm dứt sau khi các responsibility đã được xử lý hợp lệ.

---

## 4.2. CompanyMember → Job: creator

**Cardinality**

```text
CompanyMember RECRUITER 1 ───── 0..N Job
```

**Reference**

```text
Job.createdByCompanyMemberId
```

**Constraint**

Tại thời điểm tạo:

```text
createdBy.role = RECRUITER
createdBy.companyId = Job.companyId
```

`createdByCompanyMemberId` được xác lập một lần và không thay đổi.

Creator là historical identity.

Creator không tự động trở thành authorization source sau khi không còn là current Primary.

---

## 4.3. CompanyMember → Job: Primary Recruiter

**Cardinality**

```text
CompanyMember RECRUITER 1 ───── 0..N Job

Job ───── exactly 1 current Primary Recruiter
```

**Reference**

```text
Job.primaryRecruiterCompanyMemberId
```

Khi Job được tạo:

```text
createdByCompanyMemberId
=
primaryRecruiterCompanyMemberId
```

Sau reassignment hợp lệ:

```text
createdByCompanyMemberId
= giữ nguyên

primaryRecruiterCompanyMemberId
= Recruiter mới
```

**Constraint**

Primary mới phải:

* tồn tại;
* là Recruiter;
* thuộc `Job.companyId`;
* đang hợp lệ để hoạt động tại thời điểm reassignment.

Primary reassignment chỉ được persist khi:

```text
Job.status = PUBLISHED
```

---

## 4.4. Category → Job

Job sử dụng cùng collection `categories` của V4 theo hai nhóm reference:

```text
Job.fieldCategoryIds[]
Job.positionCategoryIds[]
```

### FIELD

```text
Category FIELD N ───── N Job
```

Mọi Category trong:

```text
fieldCategoryIds[]
```

phải có:

```text
level = FIELD
```

### POSITION

```text
Category POSITION N ───── N Job
```

Mọi Category trong:

```text
positionCategoryIds[]
```

phải có:

```text
level = POSITION
```

Với mỗi POSITION:

```text
position.parentCategoryId
```

phải thuộc:

```text
Job.fieldCategoryIds[]
```

Không tạo join collection vì relationship không có persistence attribute riêng.

---

## 4.5. ExperienceLevel → Job

**Cardinality**

```text
ExperienceLevel 1 ───── 0..N Job
```

Mỗi Job đã hoàn thiện để submit có đúng một:

```text
experienceLevelId
```

Reference tới:

```text
experience_levels
```

V5 không lưu riêng:

```text
experienceYears
minExperienceYears
maxExperienceYears
```

và không tạo `Experience` collection mới.

---

## 4.6. Location → Job

Location là fixed vocabulary của V4.

Job lưu trực tiếp:

```text
location
```

Mỗi Job hoàn thiện có đúng một Location literal.

Không tạo:

```text
locationId
locations collection
```

Job có Work Mode `REMOTE` vẫn phải có `location`.

---

## 4.7. EmploymentType → Job

EmploymentType là fixed vocabulary V4.

Job lưu trực tiếp:

```text
employmentType
```

Mỗi Job hoàn thiện có đúng một EmploymentType.

Không tạo:

```text
employmentTypeId
employment_types collection
```

---

## 4.8. WorkMode → Job

WorkMode là fixed vocabulary V4.

Job lưu:

```text
workModes[]
```

Job hoàn thiện phải có ít nhất một WorkMode.

Các value trong array phải thuộc canonical WorkMode vocabulary V4.

Không tạo:

```text
workModeIds[]
work_modes collection
```

---

# 5. `jobs`

## 5.1. Responsibility

`jobs` chịu trách nhiệm persist:

* Company ownership;
* creator identity;
* current Primary Recruiter;
* Job content;
* Category selections;
* ExperienceLevel;
* Location;
* EmploymentType;
* Work Modes;
* application deadline;
* Job lifecycle status;
* publication timestamp;
* creation/update metadata.

`jobs` không chịu trách nhiệm lưu:

* Company profile snapshot;
* recruiter profile snapshot;
* Category definition;
* ExperienceLevel definition;
* Application;
* CV;
* Supporting Recruiter;
* approval request entity riêng;
* rejection history;
* audit history;
* Candidate Saved Job;
* Job Invitation.

---

## 5.2. Fields

| Field                             | Type               | Required khi persist | Default   | Constraint                        | Ý nghĩa                                     |
| --------------------------------- | ------------------ | -------------------: | --------- | --------------------------------- | ------------------------------------------- |
| `_id`                             | `ObjectId`         |                  YES | generated | unique                            | Định danh Job                               |
| `companyId`                       | `ObjectId`         |                  YES | —         | immutable, ref `Company`          | Tenant owner                                |
| `createdByCompanyMemberId`        | `ObjectId`         |                  YES | —         | immutable, ref `CompanyMember`    | Recruiter tạo Job                           |
| `primaryRecruiterCompanyMemberId` | `ObjectId`         |                  YES | —         | ref `CompanyMember`               | Current Primary Recruiter                   |
| `title`                           | `String \| null`   |                   NO | `null`    | trim; non-empty nếu có            | Tên Job                                     |
| `jobDescription`                  | `String \| null`   |                   NO | `null`    | trim; non-empty nếu có            | Job Description                             |
| `requiredSkills`                  | `String[]`         |                   NO | `[]`      | mỗi phần tử non-empty             | Kỹ năng yêu cầu                             |
| `salaryText`                      | `String \| null`   |                   NO | `null`    | trim; non-empty nếu có            | Thông tin lương                             |
| `fieldCategoryIds`                | `ObjectId[]`       |                   NO | `[]`      | distinct refs                     | Category FIELD                              |
| `positionCategoryIds`             | `ObjectId[]`       |                   NO | `[]`      | distinct refs                     | Category POSITION                           |
| `location`                        | `String \| null`   |                   NO | `null`    | canonical `Location` nếu có       | Location                                    |
| `employmentType`                  | `String \| null`   |                   NO | `null`    | canonical `EmploymentType` nếu có | Loại hình việc làm                          |
| `workModes`                       | `String[]`         |                   NO | `[]`      | canonical `WorkMode`, distinct    | Hình thức làm việc                          |
| `experienceLevelId`               | `ObjectId \| null` |                   NO | `null`    | ref `ExperienceLevel`             | Mức kinh nghiệm                             |
| `applicationDeadline`             | `Date \| null`     |                   NO | `null`    | valid Date nếu có                 | Hạn nhận hồ sơ                              |
| `status`                          | `String`           |                  YES | `DRAFT`   | enum `JOB_STATUS`                 | Persisted lifecycle state                   |
| `publishedAt`                     | `Date \| null`     |                  YES | `null`    | write-once khi publish            | Thời điểm Job được publish                  |
| `createdAt`                       | `Date`             |                  YES | automatic | —                                 | Thời điểm Job được tạo                      |
| `updatedAt`                       | `Date`             |                  YES | automatic | —                                 | Thời điểm persisted state gần nhất thay đổi |

### Conditional completeness

Các field content:

```text
title
jobDescription
requiredSkills
salaryText
fieldCategoryIds
positionCategoryIds
location
employmentType
workModes
experienceLevelId
applicationDeadline
```

được phép thiếu ở `DRAFT`.

Nhưng trước transition:

```text
DRAFT → PENDING_APPROVAL
```

service phải xác nhận toàn bộ content requirement đã đầy đủ.

Canonical persistence distinction:

```text
schema-required
≠
business-required-before-submit
```

---

## 5.3. Salary representation

Product Specification V5 chỉ yêu cầu:

```text
Job phải có thông tin lương
```

V5 chưa định nghĩa business semantics cho:

* currency;
* minimum salary;
* maximum salary;
* negotiable;
* payment period.

Do đó canonical V5 lưu tối thiểu:

```text
salaryText
```

Không suy diễn structured salary model trong V5.

Nếu version sau bổ sung salary filtering hoặc structured salary semantics, Data Contract version đó có thể mở rộng representation.

---

## 5.4. Enum

### `JOB_STATUS`

```text
DRAFT
PENDING_APPROVAL
PUBLISHED
CLOSED
EXPIRED
```

| Giá trị            | Ý nghĩa persistence                    |
| ------------------ | -------------------------------------- |
| `DRAFT`            | Job nội bộ, content có thể incomplete  |
| `PENDING_APPROVAL` | Job đã hoàn thiện và đang chờ CM xử lý |
| `PUBLISHED`        | Job đã được approve/publish            |
| `CLOSED`           | Job đã được đóng thủ công              |
| `EXPIRED`          | Job đã kết thúc do deadline            |

Không thêm:

```text
REJECTED
CHANGES_REQUESTED
DELETED
APPROVED
```

### V4 vocabularies

Các literal hợp lệ cho:

```text
location
employmentType
workModes[]
```

phải sử dụng **đúng canonical literal set của V4**.

V5 không duplicate hoặc redefine các enum set đó.

---

## 5.5. Indexes

### IDX-01 — Company + status

```text
{ companyId: 1, status: 1 }
```

**Mục đích**

Hỗ trợ:

* Company Manager xem các Job thuộc Company từ `PENDING_APPROVAL` trở đi;
* Recruiter xem `PUBLISHED` Job của Company;
* tenant-scoped lifecycle queries.

Không phải index dành cho Candidate Job Discovery.

---

### IDX-02 — Company + Primary Recruiter + status

```text
{
  companyId: 1,
  primaryRecruiterCompanyMemberId: 1,
  status: 1
}
```

**Mục đích**

Hỗ trợ:

* Recruiter xem các Job mình đang là Primary;
* kiểm tra outstanding Primary responsibility;
* kiểm tra điều kiện trước lock/terminate Recruiter;
* tenant-scoped Primary authorization.

---

### Index mặc định `_id`

```text
{ _id: 1 }
```

được sử dụng cho identity lookup.

Không cần thêm compound:

```text
{ companyId: 1, _id: 1 }
```

chỉ để lặp lại uniqueness đã có của `_id`.

Tenant authorization vẫn phải kiểm tra `companyId` ở service.

---

### Không thêm index V5 cho

```text
fieldCategoryIds
positionCategoryIds
location
employmentType
workModes
experienceLevelId
title
jobDescription
salaryText
```

chỉ để chuẩn bị cho Job Discovery/Search/Filter.

Các query pattern đó thuộc version Discovery sau.

Tương tự, V5 không bắt buộc index:

```text
{ status: 1, applicationDeadline: 1 }
```

chỉ để phục vụ một background expiration sweep cụ thể.

Nếu implementation chọn background sweep như optimization, index phục vụ optimization đó không trở thành canonical requirement của V5 trừ khi query contract sau yêu cầu.

---

## 5.6. Embedded documents

> `Job` không sử dụng embedded document mới trong V5.

Không embed:

* Company;
* creator;
* Primary Recruiter;
* Category;
* ExperienceLevel.

---

## 5.7. Reference rules

| Field                             | Reference         |    Required | Cardinality | Rule                        |
| --------------------------------- | ----------------- | ----------: | ----------- | --------------------------- |
| `companyId`                       | `Company`         |         YES | N → 1       | immutable tenant owner      |
| `createdByCompanyMemberId`        | `CompanyMember`   |         YES | N → 1       | immutable creator           |
| `primaryRecruiterCompanyMemberId` | `CompanyMember`   |         YES | N → 1       | exactly one current Primary |
| `fieldCategoryIds[]`              | `Category`        | conditional | N ↔ N       | mọi ref phải là `FIELD`     |
| `positionCategoryIds[]`           | `Category`        | conditional | N ↔ N       | mọi ref phải là `POSITION`  |
| `experienceLevelId`               | `ExperienceLevel` | conditional | N → 1       | đúng một khi Job complete   |

Database chỉ bảo vệ structural reference representation.

Sự tồn tại và business validity của referenced resource thuộc service responsibility.

---

# 6. V4 data dependencies

## 6.1. `categories`

V5 không thay đổi `categories`.

Job chỉ consume canonical Category identity.

V5 không thêm:

```text
Category.jobIds
Category.companyId
Category.jobCount
Category.usedByJobs
```

Category lifecycle tiếp tục theo V4.

---

## 6.2. `experience_levels`

V5 không tạo `Experience` collection.

Canonical source:

```text
experience_levels
```

Collection này tiếp tục là fixed dataset của V4.

V5 chỉ reference một ExperienceLevel trên mỗi completed Job.

Không bổ sung vào ExperienceLevel:

```text
minYears
maxYears
isActive
companyId
jobIds
```

---

## 6.3. Location

Location tiếp tục là fixed enum/vocabulary V4.

V5 lưu canonical literal trực tiếp trên Job.

Không tạo collection.

---

## 6.4. EmploymentType

EmploymentType tiếp tục là fixed enum/vocabulary V4.

V5 lưu canonical literal trực tiếp trên Job.

Không tạo collection.

---

## 6.5. WorkMode

WorkMode tiếp tục là fixed enum/vocabulary V4.

V5 lưu canonical literal trực tiếp trong `workModes[]`.

Không tạo collection.

---

# 7. State Matrix

V5 chỉ có một persisted lifecycle state dimension, nhưng persistence validity phụ thuộc vào content completeness và `publishedAt`.

| Persisted status   | Content complete | `publishedAt` | Content mutable | Hard-delete | Ý nghĩa                     |
| ------------------ | ---------------- | ------------- | --------------- | ----------- | --------------------------- |
| `DRAFT`            | MAYBE            | `null`        | YES             | YES         | Partial hoặc complete draft |
| `PENDING_APPROVAL` | YES              | `null`        | NO              | YES         | Frozen pre-publication Job  |
| `PUBLISHED`        | YES              | NOT NULL      | NO              | NO          | Job đã từng publish         |
| `CLOSED`           | YES              | NOT NULL      | NO              | NO          | Historical terminal Job     |
| `EXPIRED`          | YES              | NOT NULL      | NO              | NO          | Historical terminal Job     |

### 7.1. Deadline và persisted state

`applicationDeadline` là source of truth của expiration semantics.

Do đó persisted combination:

```text
status = PUBLISHED
applicationDeadline <= now
```

có thể tồn tại tạm thời nếu persisted state chưa được đồng bộ sang `EXPIRED`.

Combination trên:

* không phải business-active Job;
* không tạo state mới;
* không được coi là Job còn nhận hồ sơ;
* có thể được chuyển sang `EXPIRED` khi lifecycle processing xảy ra.

Business correctness không phụ thuộc hoàn toàn vào persisted `status`.

### 7.2. PENDING_APPROVAL quá deadline

Persisted state sau là hợp lệ:

```text
status = PENDING_APPROVAL
applicationDeadline <= now
```

vì deadline có thể hết trong lúc Job đang chờ xét duyệt.

Job đó:

* không được approve;
* không tự chuyển `EXPIRED`;
* tiếp tục `PENDING_APPROVAL` cho đến một transition hợp lệ khác như reject/delete.

---

# 8. Persistence Transitions

## 8.1. Create Job

**Business source**

* F01
* BR-01 → BR-08

### Trước

```text
Job không tồn tại
```

### Sau

```text
Job {
  companyId = resolved Company
  createdByCompanyMemberId = actor CompanyMember
  primaryRecruiterCompanyMemberId = actor CompanyMember

  status = DRAFT
  publishedAt = null

  content = partial hoặc complete
}
```

### Entity bị thay đổi

* `jobs`

### Entity không thay đổi

* `companies`
* `company_members`
* `categories`
* `experience_levels`

### Invariant

```text
createdByCompanyMemberId
=
primaryRecruiterCompanyMemberId
```

tại thời điểm tạo.

---

## 8.2. Edit DRAFT

### Trước

```text
status = DRAFT
```

### Sau

```text
status = DRAFT
content fields có thể thay đổi
```

### Entity bị thay đổi

* `jobs`

### Invariant

Không được thay:

```text
companyId
createdByCompanyMemberId
status
```

thông qua chức năng edit content.

`primaryRecruiterCompanyMemberId` cũng không được thay trong `DRAFT`.

---

## 8.3. Submit Job

**Transition**

```text
DRAFT → PENDING_APPROVAL
```

### Trước

Service phải xác nhận:

```text
status = DRAFT

title != null
jobDescription != null
requiredSkills non-empty
salaryText != null

fieldCategoryIds non-empty
positionCategoryIds non-empty

location != null
employmentType != null
workModes non-empty
experienceLevelId != null
applicationDeadline != null

applicationDeadline > now
```

và cross-document constraints hợp lệ.

### Sau

```text
status = PENDING_APPROVAL
publishedAt = null
```

Content không thay đổi bởi transition.

Từ thời điểm commit, Job content bị khóa.

### Entity bị thay đổi

* `jobs`

---

## 8.4. Approve + Publish

**Transition**

```text
PENDING_APPROVAL → PUBLISHED
```

### Trước

```text
status = PENDING_APPROVAL
publishedAt = null
```

Service revalidate:

* Company vẫn hợp lệ;
* Primary vẫn hợp lệ;
* Primary cùng Company;
* Category references vẫn hợp lệ;
* ExperienceLevel vẫn hợp lệ;
* fixed vocabulary values vẫn hợp lệ;
* deadline vẫn chưa kết thúc.

### Sau

```text
status = PUBLISHED
publishedAt = now
```

### Entity bị thay đổi

* `jobs`

### Invariant

Không được tồn tại persisted approval result:

```text
status = PUBLISHED
publishedAt = null
```

hoặc:

```text
status = PENDING_APPROVAL
publishedAt != null
```

---

## 8.5. Reject Job

**Transition**

```text
PENDING_APPROVAL
→ hard delete
```

### Trước

```text
status = PENDING_APPROVAL
```

### Sau

```text
Job document không còn tồn tại
```

### Entity bị thay đổi

* `jobs`

### Entity không thay đổi

* Company;
* CompanyMember;
* Category;
* ExperienceLevel;
* fixed vocabulary.

Không persist:

```text
REJECTED
rejectedAt
rejectedBy
rejectionReason
```

vì Product V5 không yêu cầu các dữ liệu đó.

---

## 8.6. Manual delete pre-publication

Áp dụng:

```text
DRAFT → hard delete

PENDING_APPROVAL → hard delete
```

Authorization phụ thuộc persisted lifecycle state:

```text
DRAFT
→ current Primary Recruiter của Job

PENDING_APPROVAL
→ Company Manager của Company owner
```

Company Manager không có hard-delete authority đối với DRAFT.

Recruiter không có hard-delete authority sau khi Job đã rời DRAFT.

Mọi operation vẫn phải giữ canonical tenant boundary.


Phần không tạo `DELETED`, `isDeleted`, `deletedAt` giữ nguyên.

---

## 8.7. Reassign Primary Recruiter

### Trước

```text
status = PUBLISHED
applicationDeadline > now
primaryRecruiterCompanyMemberId = A
```

### Sau

```text
status = PUBLISHED
primaryRecruiterCompanyMemberId = B
```

Không thay đổi:

```text
companyId
createdByCompanyMemberId
publishedAt
content
```

Primary mới phải thuộc cùng Company và là Recruiter hợp lệ.

Không persist history của Primary cũ trong V5.

---

## 8.8. Close Job

**Transition**

```text
PUBLISHED → CLOSED
```

### Trước

```text
status = PUBLISHED
applicationDeadline > now
```

### Sau

```text
status = CLOSED
publishedAt giữ nguyên
content giữ nguyên
primaryRecruiterCompanyMemberId giữ nguyên
```

Không hard-delete Job. Persisted `PUBLISHED` quá deadline không được đóng thành
`CLOSED`.

---

## 8.9. Expire Job

**Transition**

```text
PUBLISHED → EXPIRED
```

khi:

```text
now >= applicationDeadline
```

### Sau

```text
status = EXPIRED
publishedAt giữ nguyên
content giữ nguyên
primaryRecruiterCompanyMemberId giữ nguyên
```

Không hard-delete Job.

Persist transition sang `EXPIRED` không phải nguồn sự thật duy nhất của business expiration.

---

# 9. Transaction / Atomicity Requirements

## 9.1. Nguyên tắc chung

V5 **không bổ sung multi-document transaction requirement bắt buộc** cho Job lifecycle.

Các transition chính của V5 chỉ thay đổi một `Job` document.

Canonical atomicity requirement là:

> Không được persist partial state bên trong cùng một Job transition.

Các cross-document checks đối với:

* Company;
* CompanyMember;
* Category;
* ExperienceLevel;

là business validation trước transition, không mặc định biến toàn bộ workflow thành multi-document transaction.

Không nâng guarantee thành distributed transaction hoặc exactly-once behavior.

---

## TX-01 — Approve và publish

**Business source**

* F06
* BR-21
* BR-22

Trong cùng atomic persistence operation trên Job:

1. chuyển `status` từ `PENDING_APPROVAL` sang `PUBLISHED`;
2. gán `publishedAt = now`.

Sau commit phải đảm bảo:

```text
status = PUBLISHED
AND
publishedAt != null
```

Không được tồn tại partial state:

```text
status = PUBLISHED
publishedAt = null
```

Atomicity này có thể được đáp ứng bằng single-document atomic write.

**Không yêu cầu multi-document transaction.**

---

## TX-02 — State transition của Job

Các transition:

```text
DRAFT → PENDING_APPROVAL
PUBLISHED → CLOSED
PUBLISHED → EXPIRED
```

phải thay `status` atomically trên Job document.

Không được có persisted intermediate state ngoài canonical enum.

**Không yêu cầu multi-document transaction.**

---

## TX-03 — Primary reassignment

Primary reassignment chỉ thay:

```text
primaryRecruiterCompanyMemberId
```

trên chính Job đang `PUBLISHED`.

Việc cập nhật phải atomic đối với Job document.

Không yêu cầu:

* update creator;
* update Company;
* update Recruiter document;
* tạo history document;
* multi-document transaction.

---

## TX-04 — Hard delete

Reject hoặc manual delete pre-publication là physical deletion của một Job document.

Không có cascade write bắt buộc sang:

* Company;
* CompanyMember;
* Category;
* ExperienceLevel.

Không yêu cầu transaction nhiều document.


Authorization trước TX-04 phụ thuộc lifecycle state theo Product Contract:

* `DRAFT` manual delete: current Primary Recruiter;
* `PENDING_APPROVAL` manual delete/reject: Company Manager.

TX-04 không tự mở rộng actor authority.

---

## 9.2. Recruiter lock/terminate interaction

Trước khi persistence transition của Recruiter sang trạng thái bị khóa/chấm dứt được hoàn tất, service phải kiểm tra Job responsibility theo Product V5.

Blocking Job:

```text
primaryRecruiterCompanyMemberId = Recruiter

AND (
  status IN (DRAFT, PENDING_APPROVAL)
  OR (
    status = PUBLISHED
    AND applicationDeadline > now
  )
)
```

Không blocking:

```text
CLOSED
EXPIRED
persisted PUBLISHED với applicationDeadline <= now
  (effectively EXPIRED theo BR-30 / BR-31; không phụ thuộc materialize EXPIRED)
```

V5 không yêu cầu một multi-document transaction mới giữa:

```text
company_members
↔
jobs
```

chỉ để nâng guarantee cho mọi theoretical concurrency window.

Canonical requirement là business guard phải được thực hiện tại workflow lock/terminate.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

| Constraint                                             | Owner                      | Lý do                       |
| ------------------------------------------------------ | -------------------------- | --------------------------- |
| `_id` unique                                           | Database                   | Identity                    |
| `companyId` tồn tại về structure                       | Schema                     | Required local field        |
| `createdByCompanyMemberId` tồn tại về structure        | Schema                     | Required local field        |
| `primaryRecruiterCompanyMemberId` tồn tại về structure | Schema                     | Required local field        |
| `status` thuộc `JOB_STATUS`                            | Schema                     | Local enum                  |
| `companyId` immutable                                  | Schema / persistence layer | Local persistence invariant |
| `createdByCompanyMemberId` immutable                   | Schema / persistence layer | Historical invariant        |
| content string đúng type                               | Schema                     | Structural                  |
| array đúng type                                        | Schema                     | Structural                  |
| Category arrays không chứa duplicate ID                | Schema                     | Set representation          |
| `location` thuộc V4 vocabulary nếu khác null           | Schema                     | Fixed enum                  |
| `employmentType` thuộc V4 vocabulary nếu khác null     | Schema                     | Fixed enum                  |
| mọi `workModes[]` thuộc V4 vocabulary                  | Schema                     | Fixed enum                  |
| `workModes[]` không duplicate                          | Schema                     | Set representation          |
| `applicationDeadline` đúng Date nếu khác null          | Schema                     | Type                        |
| `publishedAt` đúng Date/null                           | Schema                     | Type                        |

Schema **không** được yêu cầu tất cả content field luôn non-null vì `DRAFT` được phép partial.

---

## 10.2. Service bảo vệ

| Constraint                                        | Owner   | Lý do                             |
| ------------------------------------------------- | ------- | --------------------------------- |
| actor có phải Recruiter không                     | Service | Authorization/business identity   |
| actor có phải CM không                            | Service | Authorization                     |
| Company của Job được resolve đúng                 | Service | Tenant context                    |
| client không tự chọn Company khác                 | Service | Tenant authorization              |
| Company đang hợp lệ                               | Service | Cross-document lifecycle          |
| creator là Recruiter cùng Company                 | Service | Cross-document                    |
| Primary là Recruiter cùng Company                 | Service | Cross-document                    |
| Primary đang hợp lệ                               | Service | Cross-document lifecycle          |
| chỉ Primary edit DRAFT                            | Service | Business authorization            |
| chỉ Primary submit                                | Service | Business authorization            |
| content đầy đủ trước submit                       | Service | Conditional business completeness |
| Category FIELD đúng level                         | Service | Cross-document                    |
| Category POSITION đúng level                      | Service | Cross-document                    |
| POSITION parent thuộc FIELD đã chọn               | Service | Cross-document                    |
| ExperienceLevel tồn tại trong canonical dataset   | Service | Cross-document                    |
| submit deadline còn hạn                           | Service | Business time rule                |
| approve deadline còn hạn                          | Service | Business time rule                |
| transition state hợp lệ                           | Service | Business lifecycle                |
| PENDING content immutable                         | Service | Lifecycle rule                    |
| post-submit content immutable                     | Service | Lifecycle rule                    |
| chỉ CM approve/reject                             | Service | Authorization                     |
| chỉ effectively `PUBLISHED` được reassign Primary | Service | Lifecycle + effective expiration  |
| Primary mới cùng Company và hợp lệ                | Service | Cross-document                    |
| close chỉ bởi Primary/CM trên effectively `PUBLISHED` | Service | Authorization + effective expiration |
| hard-delete chỉ pre-publication | Service | Historical boundary |
| `DRAFT` hard-delete chỉ bởi current Primary | Service | Responsibility + lifecycle authorization |
| `PENDING_APPROVAL` hard-delete chỉ bởi CM | Service | Role + lifecycle authorization |
| published Job không hard-delete                   | Service | Historical invariant              |
| expiration dùng deadline                          | Service | Effective-state rule              |
| public eligibility xét Company + deadline         | Service | Cross-document/business rule      |
| cross-tenant Job access bị cấm                    | Service | Tenant authorization              |
| Recruiter lock/terminate phải xét outstanding Job theo effective expiration | Service | Cross-collection business guard |
| Company Manager chỉ đọc Job từ `PENDING_APPROVAL` trở đi | Service | Authorization phụ thuộc role + Job lifecycle state |

---

## 10.3. Shared enforcement

Một số persisted invariant được bảo vệ ở nhiều lớp.

Ví dụ:

```text
status = PUBLISHED
→ publishedAt != null
```

được duy trì bởi:

* service transition rule;
* atomic persistence operation;
* document-level consistency validation nếu persistence implementation hỗ trợ phù hợp.

Data Contract không yêu cầu database tự thực hiện cross-document authorization.

---

# 11. Token / TTL Lifecycle

> V5 không bổ sung token/TTL persistence mới.

Không tạo:

```text
JobApprovalToken
JobPublishToken
JobExpirationToken
```

Không dùng TTL để delete Job hết hạn.

`EXPIRED` Job phải được giữ lại.

---

# 12. Multi-tenant Data Boundary

## 12.1. Canonical tenant key

Đối với Job:

```text
Job.companyId
```

là canonical tenant key.

---

## 12.2. Resource ownership

| Resource          | Tenant owner | Representation       |
| ----------------- | ------------ | -------------------- |
| `Job`             | `Company`    | `Job.companyId`      |
| `Category`        | Platform     | Không có `companyId` |
| `ExperienceLevel` | Platform     | Không có `companyId` |
| `Location`        | Platform     | Fixed vocabulary     |
| `EmploymentType`  | Platform     | Fixed vocabulary     |
| `WorkMode`        | Platform     | Fixed vocabulary     |

---

## 12.3. Tenant resolution khi Recruiter tạo Job

```text
Authenticated User
        ↓
trusted CompanyMember
        ↓
role = RECRUITER
        ↓
CompanyMember.companyId
        ↓
Job.companyId
```

`companyId` của Job không được lấy từ một client-supplied value như authority.

---

## 12.4. Tenant resolution khi thao tác Job

```text
Authenticated Actor
        ↓
trusted CompanyMember
        ↓
CompanyMember.companyId
        ↓
Job.companyId
        ↓
role / Primary responsibility
        ↓
authorized operation
```

Phải luôn bảo đảm:

```text
actorCompanyId = Job.companyId
```

trước Company-scoped operation.

---

## 12.5. Cross-tenant references bị cấm

Không được persist:

```text
Job.companyId = Company A

createdByCompanyMemberId -> Company B
```

hoặc:

```text
Job.companyId = Company A

primaryRecruiterCompanyMemberId -> Company B
```

Category và ExperienceLevel là platform-scoped nên không chịu same-tenant constraint.

---

## 12.6. Client-supplied identifiers

Các value như:

```text
companyId
primaryRecruiterCompanyMemberId
jobId
```

do client gửi lên không tự tạo authorization.

Đặc biệt:

```text
companyId
```

không được dùng để cho phép Recruiter tạo Job cho Company khác.

---

# 13. Snapshot / Historical Data

> V5 không bổ sung snapshot collection hoặc embedded snapshot mới.

Không tạo:

```text
JobSnapshot
CompanySnapshot
RecruiterSnapshot
CategorySnapshot
ExperienceSnapshot
```

### 13.1. Historical creator

Historical identity của creator được giữ bằng:

```text
createdByCompanyMemberId
```

Field này immutable.

V5 dựa trên prior-version invariant rằng CompanyMember identity cần thiết cho lịch sử không biến mất chỉ vì account/member lifecycle thay đổi.

### 13.2. Historical Job content

Sau submit:

```text
Job content
→ immutable
```

Sau publish:

```text
Job document
→ retained
```

Vì vậy V5 không cần duplicate một Job snapshot riêng chỉ để giữ chính nội dung Job.

### 13.3. Catalog history

V5 không snapshot Category/ExperienceLevel.

V5 tiếp tục dựa trên persistence contract V4 của canonical catalog identities.

### 13.4. Company data

Không snapshot Company profile vào Job.

Product V5 không yêu cầu historical Company profile copy trên mỗi Job.

---

# 14. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V5:

```text
- Experience collection
- Experience.minYears
- Experience.maxYears
- Experience.isActive

- locations collection
- employment_types collection
- work_modes collection

- Job.locationId
- Job.employmentTypeId
- Job.workModeIds

- Job.status = REJECTED
- Job.status = CHANGES_REQUESTED
- Job.status = DELETED
- Job.status = APPROVED

- Job.rejectedAt
- Job.rejectedBy
- Job.rejectionReason

- Job.deletedAt
- Job.isDeleted

- Job.closedAt
- Job.expiredAt

- Job.approvedByCompanyMemberId

- Job.supportingRecruiterIds
- Job.recruitmentTeam

- Job.companySnapshot
- Job.creatorSnapshot
- Job.primaryRecruiterSnapshot
- Job.categorySnapshot
- Job.experienceSnapshot

- Job.categoryText
- Job.locationText
- Job.employmentTypeText
- Job.workModeText
- Job.experienceText

- JobApprovalRequest collection
- JobApprovalHistory collection
- JobHistory collection
- JobAudit collection
- JobPrimaryHistory collection

- Application collection
- JobApplication relation
- CV snapshot
- Application snapshot

- Company.jobIds
- CompanyMember.jobIds
- Category.jobIds
- ExperienceLevel.jobIds
```

Không thêm:

* search denormalization;
* full-text search metadata;
* recommendation metadata;
* Candidate Discovery index;

chỉ để chuẩn bị cho version sau.

Nếu requirement xuất hiện sau, canonical Data Contract version tương ứng sẽ bổ sung.

---

# 15. Compatibility với version trước

## 15.1. V1–V3 invariants phải giữ

V5 không thay đổi:

* User identity;
* authentication lifecycle;
* Company identity;
* Company onboarding;
* CompanyMember identity;
* Recruiter role semantics;
* Company Manager role semantics.

Job reference tới CompanyMember không làm thay đổi bản chất của CompanyMember.

---

## 15.2. V4 Category phải giữ

`categories` tiếp tục là canonical persisted Category collection.

V5 không:

* duplicate Category vào Job;
* tạo Company Category;
* thay đổi Category hierarchy;
* tạo Category level thứ ba.

Job chỉ reference existing Category IDs.

---

## 15.3. V4 ExperienceLevel phải giữ

`experience_levels` tiếp tục là canonical static persisted dataset.

V5 không tạo alternative `Experience` model.

Job giữ:

```text
experienceLevelId
```

reference tới canonical V4 entity.

---

## 15.4. V4 fixed vocabulary phải giữ

Các canonical:

```text
Location
EmploymentType
WorkMode
```

tiếp tục là fixed enums/vocabularies.

V5 không reinterpret chúng thành reference collections.

---

## 15.5. Remote semantics phải giữ

```text
REMOTE
```

thuộc WorkMode.

Remote không phải Location.

Job Remote vẫn có canonical `location`.

---

## 15.6. Thay đổi được phép

V5 được phép bổ sung:

```text
jobs
```

và relationship từ Job tới các entity/vocabulary V1–V4 cần thiết.

---

## 15.7. Thay đổi không được phép

Không được âm thầm:

* thêm catalog company scope;
* đổi V4 fixed vocabulary thành collections;
* tạo Experience replacement;
* thay semantics Category;
* sửa Company/CompanyMember chỉ để tiện reverse lookup.

---

# 16. Persistence Invariants

Các invariant sau phải luôn được giữ ở canonical persisted state hoặc tại transition boundary tương ứng.

1. Mỗi Job có đúng một `companyId`.
2. `companyId` không thay đổi sau create.
3. Mỗi Job có đúng một `createdByCompanyMemberId`.
4. Creator không thay đổi.
5. Mỗi Job có đúng một current `primaryRecruiterCompanyMemberId`.
6. Khi create, creator = Primary.
7. Creator và Primary thuộc Company của Job tại thời điểm chúng được thiết lập cho responsibility tương ứng.
8. Job bắt đầu `DRAFT`.
9. `DRAFT` được phép partial.
10. Schema không được ép DRAFT complete.
11. Chỉ completed Job được persist transition sang `PENDING_APPROVAL`.
12. `PENDING_APPROVAL` có complete content.
13. `PENDING_APPROVAL.publishedAt = null`.
14. `PUBLISHED.publishedAt != null`.
15. `CLOSED.publishedAt != null`.
16. `EXPIRED.publishedAt != null`.
17. `publishedAt` chỉ được xác lập khi Job publish lần đầu.
18. `publishedAt` không thay đổi sau đó.
19. Content không thay đổi sau khi rời `DRAFT`.
20. Company ownership không thay đổi.
21. Category arrays không chứa duplicate IDs.
22. Mọi FIELD reference phải trỏ Category `FIELD`.
23. Mọi POSITION reference phải trỏ Category `POSITION`.
24. Parent của mỗi POSITION phải thuộc FIELD set của cùng Job.
25. Completed Job có đúng một Location.
26. Completed Job có đúng một EmploymentType.
27. Completed Job có ít nhất một WorkMode.
28. WorkModes không duplicate.
29. Completed Job có đúng một ExperienceLevel.
30. Reject không persist `REJECTED`.
31. Reject xóa Job document.
32. Manual pre-publication delete xóa Job document; `DRAFT` delete chỉ bởi
    current Primary Recruiter, còn `PENDING_APPROVAL` manual delete chỉ bởi
    Company Manager của tenant owner.
33. Published Job không bị hard-delete.
34. `CLOSED` được giữ.
35. `EXPIRED` được giữ.
36. Primary reassignment chỉ được persist trên `PUBLISHED`.
37. Primary reassignment không đổi creator.
38. Close không đổi published content.
39. Expire không đổi published content.
40. Persisted `PUBLISHED` quá deadline không được coi là business-active chỉ dựa vào `status`.
41. Cross-tenant CompanyMember reference không được chấp nhận.
42. Category và ExperienceLevel không bị cascade delete khi Job bị delete.
43. Fixed vocabulary không có Company ownership.
44. Supporting Recruiter không được persist trong V5.
45. Không tạo reverse `jobIds` chỉ để hỗ trợ lookup.
46. Recruiter có outstanding Primary responsibility trên Job `DRAFT`,
    `PENDING_APPROVAL`, hoặc effectively `PUBLISHED`
    (`status = PUBLISHED` và `applicationDeadline > now`) phải được xử lý theo
    Product lifecycle trước khi lock/terminate hoàn tất. Persisted `PUBLISHED`
    với `applicationDeadline <= now` không blocking.

### Enforcement owner

| Nhóm invariant                             | Owner chính                         |
| ------------------------------------------ | ----------------------------------- |
| Field type / enum / immutable local fields | Schema / Database                   |
| Partial DRAFT representation               | Schema + Service                    |
| Content completeness                       | Service                             |
| State transition legality                  | Service                             |
| Tenant ownership                           | Service                             |
| Cross-document roles/status                | Service                             |
| Approve + `publishedAt` consistency        | Service + single-document atomicity |
| Category hierarchy consistency             | Service                             |
| Historical retention                       | Service                             |
| Hard-delete boundary                       | Service                             |
| Effective expiration                       | Service                             |
| Recruiter outstanding responsibility       | Service                             |
| Single-document state mutation             | Atomic persistence operation        |

---

# 17. Definition of Data Completion

Data Contract V5 được coi là hoàn thành khi:

* `jobs` được xác định là persisted entity mới duy nhất của V5;
* V4 catalog persistence được giữ nguyên;
* partial `DRAFT` có canonical representation rõ ràng;
* mọi Job field đã có type/default/constraint rõ ràng;
* Company ownership đã rõ;
* creator và Primary semantics đã rõ;
* relationship tới Category đã rõ;
* relationship tới ExperienceLevel đã rõ;
* Location/EmploymentType/WorkMode representation đã rõ;
* `JOB_STATUS` phản ánh đúng Product V5;
* không có state ngoài Product Contract;
* indexes bắt buộc đã được xác định;
* không thêm discovery/search index speculative;
* state matrix đã rõ;
* persistence transitions đã rõ;
* approve + publish atomicity đã rõ;
* không có multi-document transaction requirement ngoài business need;
* schema/database vs service constraint ownership đã rõ;
* multi-tenant data boundary đã rõ;
* published historical retention đã rõ;
* hard-delete boundary đã rõ;
* snapshot boundary đã rõ;
* token/TTL boundary đã rõ;
* compatibility V1–V4 được giữ;
* mọi persistence invariant có enforcement owner;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn.

Data Completion không đồng nghĩa schema đã được code.

Nó có nghĩa implementation V5 có thể được xây mà không cần tự suy đoán:

* Job persistence architecture;
* partial Draft semantics;
* catalog representation;
* ownership;
* lifecycle persistence;
* atomicity;
* historical deletion boundary.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract của V5**.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE V5 PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* collection;
* field;
* field type;
* default;
* reference;
* enum representation;
* indexes;
* persistence state;
* persistence transition;
* hard-delete behavior;
* historical retention;
* atomicity requirement;
* constraint ownership;
* tenant ownership;
* explicitly excluded persistence.

Tài liệu này không định nghĩa:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* controller;
* service function;
* route;
* middleware implementation;
* database query cụ thể;
* ODM method cụ thể;
* source-code structure;
* UI flow;
* frontend component;
* test framework.

Canonical authority:

```text
Product Specification V5
        │
        │ business truth
        ↓
Data Contract V5
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture truth
        ↓
Implementation
        │
        │ actual code
        ↓
Tests
```

Thứ tự authority khi có mâu thuẫn:

```text
Approved Product Specification
→ business behavior

Approved Data Contract
→ persistence design

Approved previous-version canonical contracts
→ inherited invariants

Macro database / entity diagram
→ input only

Current source code
→ implementation evidence
```

Macro database hoặc source code hiện tại không được dùng để override Product V5 hoặc canonical persistence decisions của tài liệu này.
