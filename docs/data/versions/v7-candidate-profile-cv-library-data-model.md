# V7 — Candidate Profile và thư viện CV Data Model

> **File:** `docs/data/versions/v7-candidate-profile-cv-library-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v7-candidate-profile-cv-library.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v7-candidate-profile-cv-library.md
```

Product Specification là authority đối với business behavior.

Data Contract V7 xác định:

* dữ liệu Candidate CV nào cần được persist;
* cách Generated CV và Uploaded CV cùng được biểu diễn;
* relationship giữa Candidate CV với Candidate và standard data của V4;
* representation của `DRAFT`, `ACTIVE`, visibility, archive và default;
* structured content cần persist cho Harvard Generated CV;
* metadata cần persist cho Uploaded PDF;
* uniqueness của Default CV;
* persistence transition;
* atomicity requirement;
* boundary giữa database/schema và service;
* ownership của Candidate CV;
* compatibility với V1–V6;
* các persistence structure chủ động không thêm.

Data Contract này không thay đổi business behavior của Product V7.

---

# 2. Thay đổi so với version trước

V7 bổ sung persistence cho Candidate CV nhưng không sửa các persistence model của Company, Job hoặc Recruitment Team.

## 2.1. Tổng quan thay đổi

| Entity / Vocabulary  | Trạng thái             | Mô tả                                                          |
| -------------------- | ---------------------- | -------------------------------------------------------------- |
| `candidate_cvs`      | `NEW`                  | Canonical collection lưu cả Generated và Uploaded Candidate CV |
| `GeneratedCvContent` | `NEW EMBEDDED`         | Structured Harvard content của Generated CV                    |
| `CvPersonalInfo`     | `NEW EMBEDDED`         | Thông tin cá nhân nằm trong Generated CV                       |
| `CvEducation`        | `NEW EMBEDDED`         | Education item                                                 |
| `CvWorkExperience`   | `NEW EMBEDDED`         | Work Experience item                                           |
| `CvProject`          | `NEW EMBEDDED`         | Project item                                                   |
| `CvCertification`    | `NEW EMBEDDED`         | Certification item                                             |
| `CvLanguage`         | `NEW EMBEDDED`         | Language item                                                  |
| `UploadedCvFile`     | `NEW EMBEDDED`         | Metadata của current Uploaded PDF                              |
| `users`              | `UNCHANGED`            | Candidate Profile tiếp tục reuse User                          |
| `categories`         | `UNCHANGED`            | V7 reference Category chuẩn V4                                 |
| `experience_levels`  | `UNCHANGED`            | V7 reference ExperienceLevel chuẩn V4                          |
| `Location`           | `UNCHANGED VOCABULARY` | Fixed vocabulary V4, lưu trực tiếp trên CandidateCV            |
| `EmploymentType`     | `UNCHANGED VOCABULARY` | Fixed vocabulary V4, lưu trực tiếp trên CandidateCV            |
| `WorkMode`           | `UNCHANGED VOCABULARY` | Fixed vocabulary V4, lưu trực tiếp trên CandidateCV            |
| `companies`          | `UNCHANGED`            | Không tham gia ownership của Candidate CV                      |
| `company_members`    | `UNCHANGED`            | Không tham gia Candidate CV                                    |
| `jobs`               | `UNCHANGED`            | Không tham gia Candidate CV                                    |
| `auth_sessions`      | `UNCHANGED`            | Không thay authentication/session contract                     |
| `auth_tokens`        | `UNCHANGED`            | Không thêm token V7                                            |

Canonical V4 đã xác định `Category` và `ExperienceLevel` là persisted entities, trong khi `Location`, `EmploymentType` và `WorkMode` là fixed vocabularies không có collection riêng. V7 phải tiếp tục representation đó.

---

## 2.2. Entity mới

Chỉ bổ sung một root collection nghiệp vụ:

```text
candidate_cvs
```

Generated CV và Uploaded CV không được tách thành hai collection độc lập.

---

## 2.3. Entity được mở rộng

Không có collection V1–V6 nào phải mở rộng schema để phục vụ V7.

Đặc biệt:

```text
users
```

không thêm field Candidate Profile mới.

---

## 2.4. Entity giữ nguyên nhưng được sử dụng

V7 reuse:

```text
users
categories
experience_levels
```

và fixed vocabularies:

```text
Location
EmploymentType
WorkMode
```

Không thay đổi canonical meaning hoặc lifecycle của các dữ liệu này.

Đối với `F01`, Candidate Profile tiếp tục dùng trực tiếp các field hiện có
trên `users` theo Product V7:

| User field | F01 read | F01 write | Persistence effect |
| --- | --- | --- | --- |
| `fullName` | YES | YES | Update field hiện có trên User |
| `avatarUrl` | YES | YES | Update field hiện có trên User |
| `dateOfBirth` | YES | YES | Update field hiện có trên User |
| `phoneNumber` | YES | YES | Update field hiện có trên User |
| `email` | YES | NO | Giữ nguyên account/login identity V1 |

Các field `role`, `status`, `passwordHash`, `emailVerifiedAt`,
`mustChangePassword`, cùng AuthSession/AuthToken data không được F01 mutate.

F01 không cần CandidateProfile collection, User schema migration, index mới
hoặc multi-document transaction. Profile update là mutation trên đúng một User
document hiện hữu và không tự động mutate CandidateCV.

---

## 2.5. Corrections bắt buộc so với macro design ban đầu

Canonical Data Contract V7 chủ động sửa ba điểm của macro design:

### Standard data representation

Không sử dụng:

```text
preferredLocationIds → Location collection
employmentTypeIds → EmploymentType collection
workModeIds → WorkMode collection
experienceId → Experience collection
```

Canonical representation là:

```text
categoryId
→ Category reference

experienceLevelId
→ ExperienceLevel reference

preferredLocations[]
→ Location fixed vocabulary

employmentTypes[]
→ EmploymentType fixed vocabulary

workModes[]
→ WorkMode fixed vocabulary
```

`REMOTE` chỉ thuộc `WorkMode`, đúng contract V4. Canonical V4 không persist collection riêng cho Location/EmploymentType/WorkMode.

### Generated completeness

Không sử dụng rule cũ:

```text
minimum personal info
+
one arbitrary content section
```

V7 dùng exact completeness do Product V7 đã chốt.

### Generated content structure

Không sử dụng structure cũ:

```text
technicalSkills[]
tools[]
softSkills[]
certificates string[]
languages string[]
```

Canonical V7 sử dụng:

```text
skills[]
certifications[] structured
languages[] structured
```

cùng fixed Generated form đã được Product V7 phê duyệt.

---

# 3. Collection / Entity tổng thể

Persisted root collections V7 trực tiếp sử dụng:

```text
users
categories
experience_levels
candidate_cvs
```

Trong đó chỉ có:

```text
candidate_cvs
```

là collection mới của V7.

Fixed vocabularies được reuse:

```text
Location
EmploymentType
WorkMode
```

Embedded structures:

```text
GeneratedCvContent
├── CvPersonalInfo
├── CvEducation[]
├── CvWorkExperience[]
├── CvProject[]
├── CvCertification[]
└── CvLanguage[]

UploadedCvFile
```

## 3.1. Responsibility

| Entity / Structure   | Responsibility                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `users`              | Candidate identity và Candidate Profile data đã có                                              |
| `categories`         | Standard Category `FIELD` / `POSITION`                                                          |
| `experience_levels`  | Standard ExperienceLevel dataset                                                                |
| `candidate_cvs`      | Ownership, metadata, source, lifecycle, visibility, default, archive và source-specific content |
| `GeneratedCvContent` | Structured source-of-truth của Generated CV                                                     |
| `UploadedCvFile`     | Metadata của current valid Uploaded PDF                                                         |
| `Location`           | Preferred Location vocabulary                                                                   |
| `EmploymentType`     | Desired EmploymentType vocabulary                                                               |
| `WorkMode`           | Desired WorkMode vocabulary                                                                     |

Không tạo collection chỉ để một embedded structure có tên riêng.

---

# 4. Quan hệ dữ liệu

Canonical persistence relationships:

```text
User 1 ───────── 0..N CandidateCV

Category 1 ───── 0..N CandidateCV

ExperienceLevel 1 ───── 0..N CandidateCV
                           ^
                           |
                         0..1
                         per CV
```

Ngoài ra:

```text
CandidateCV 1 ───── 0..1 GeneratedCvContent

CandidateCV 1 ───── 0..1 UploadedCvFile
```

`Location`, `EmploymentType` và `WorkMode` không tạo reference relationship vì chúng là fixed vocabularies.

---

## 4.1. User → CandidateCV

### Cardinality

```text
User 1 ───── 0..N CandidateCV
```

### Owner của relationship

```text
CandidateCV
```

### Reference

```text
CandidateCV.candidateUserId
```

### Constraint

Mỗi CandidateCV:

* có đúng một `candidateUserId`;
* referenced User phải tồn tại;
* referenced User phải là Candidate;
* ownership không được chuyển sang Candidate khác trong V7.

Không lưu reverse relationship:

```text
User.cvIds[]
```

### Lifecycle

User có thể tồn tại mà chưa có CV.

CandidateCV không trở thành Company resource khi Candidate tham gia bất kỳ nghiệp vụ tuyển dụng nào sau này.

---

## 4.2. Category → CandidateCV

### Cardinality

```text
Category 1 ───── 0..N CandidateCV
```

Mỗi CandidateCV:

```text
exactly 1 Category
```

### Reference

```text
CandidateCV.categoryId
```

### Constraint

Category:

* phải tồn tại;
* phải là canonical Category của V4;
* có thể có `level = FIELD`;
* hoặc `level = POSITION`.

Không copy:

```text
categoryName
categoryLevel
```

vào CandidateCV chỉ để thay thế canonical reference.

Category immutable lifecycle của V4 tiếp tục được giữ.

---

## 4.3. ExperienceLevel → CandidateCV

### Cardinality

```text
CandidateCV N ───── 0..1 ExperienceLevel
```

### Reference

```text
CandidateCV.experienceLevelId
```

`null` biểu diễn Candidate không khai báo ExperienceLevel.

Không tạo:

```text
Experience
experienceYears
minExperienceYears
maxExperienceYears
```

trong V7.

`experience_levels` của V4 là persisted fixed dataset.

---

## 4.4. Location trên CandidateCV

Không có `Location` collection relationship.

Persist trực tiếp:

```text
CandidateCV.preferredLocations[]
```

Mỗi member phải thuộc canonical fixed vocabulary `Location` của V4.

Có thể có:

```text
0..N
```

Preferred Locations.

Không dùng:

```text
preferredLocationIds
locationId
currentLocationId
address
```

để biểu diễn metadata này.

`REMOTE` không phải Location.

---

## 4.5. EmploymentType trên CandidateCV

Persist trực tiếp:

```text
CandidateCV.employmentTypes[]
```

Mỗi member phải thuộc canonical fixed vocabulary `EmploymentType`.

Không tạo:

```text
employmentTypeIds
employment_types collection
```

---

## 4.6. WorkMode trên CandidateCV

Persist trực tiếp:

```text
CandidateCV.workModes[]
```

Mỗi member phải thuộc canonical fixed vocabulary `WorkMode`.

Bao gồm canonical value:

```text
REMOTE
```

Không tạo:

```text
workModeIds
work_modes collection
```

---

## 4.7. CandidateCV → GeneratedCvContent

Cardinality:

```text
CandidateCV 1 ───── 0..1 GeneratedCvContent
```

Canonical XOR rule:

```text
sourceType = GENERATED
→ generatedContent tồn tại
→ uploadedFile không tồn tại
```

GeneratedCvContent:

* thuộc lifecycle của parent CandidateCV;
* không có ownership riêng;
* không phải Candidate CV thứ hai;
* không tồn tại độc lập.

---

## 4.8. CandidateCV → UploadedCvFile

Cardinality:

```text
CandidateCV 1 ───── 0..1 UploadedCvFile
```

Canonical XOR rule:

```text
sourceType = UPLOADED
→ uploadedFile tồn tại
→ generatedContent không tồn tại
```

UploadedCvFile chỉ biểu diễn **current PDF**.

Không có history relationship.

Macro database ban đầu cũng xác định file không phải entity nghiệp vụ riêng và không cần `CvFile` collection.

---

# 5. CandidateCV

## 5.1. Responsibility

`CandidateCV` chịu trách nhiệm lưu:

* Candidate owner;
* tên quản lý;
* source type;
* canonical persistence status;
* visibility;
* Category;
* ExperienceLevel optional;
* Preferred Locations;
* Skill tags;
* desired Employment Types;
* desired Work Modes;
* default designation;
* archive state;
* Generated content hoặc Uploaded file metadata;
* timestamps.

CandidateCV không chịu trách nhiệm lưu:

* Candidate authentication;
* Candidate Profile duplicate;
* Company;
* Recruitment Team;
* Job;
* Application;
* submitted CV snapshot;
* Invitation snapshot;
* Candidate Search state;
* Recruiter access state;
* public Internet access;
* CV view analytics.

---

## 5.2. Fields

| Field                | Type               |    Required | Default   | Constraint                             | Ý nghĩa                               |
| -------------------- | ------------------ | ----------: | --------- | -------------------------------------- | ------------------------------------- |
| `_id`                | `ObjectId`         |         YES | generated | unique                                 | CandidateCV identity                  |
| `candidateUserId`    | `ObjectId`         |         YES | —         | ref User, immutable ownership          | Candidate sở hữu CV                   |
| `name`               | `String`           |         YES | —         | non-null                               | Tên quản lý trong My CVs              |
| `sourceType`         | `String`           |         YES | —         | enum, immutable                        | `GENERATED` hoặc `UPLOADED`           |
| `status`             | `String`           |         YES | —         | enum                                   | Persistence lifecycle                 |
| `visibility`         | `String`           |         YES | —         | enum                                   | Candidate-selected visibility         |
| `categoryId`         | `ObjectId`         |         YES | —         | ref Category                           | Main Category                         |
| `experienceLevelId`  | `ObjectId`         |          NO | `null`    | ref ExperienceLevel                    | Experience metadata                   |
| `preferredLocations` | `Location[]`       |          NO | `[]`      | fixed vocabulary members               | Địa điểm mong muốn                    |
| `skillTags`          | `String[]`         |          NO | `[]`      | —                                      | Metadata skill tags                   |
| `employmentTypes`    | `EmploymentType[]` |          NO | `[]`      | fixed vocabulary members               | Loại hình làm việc mong muốn          |
| `workModes`          | `WorkMode[]`       |          NO | `[]`      | fixed vocabulary members               | Work mode mong muốn                   |
| `isDefault`          | `Boolean`          |         YES | `false`   | max one eligible default per Candidate | Default designation                   |
| `generatedContent`   | embedded           | conditional | —         | GENERATED only                         | Harvard structured content            |
| `uploadedFile`       | embedded           | conditional | —         | UPLOADED only                          | Current valid PDF metadata            |
| `archivedAt`         | `Date`             |          NO | `null`    | terminal in V7                         | CV còn trong active library hay không |
| `createdAt`          | `Date`             |         YES | automatic | —                                      | Thời điểm tạo                         |
| `updatedAt`          | `Date`             |         YES | automatic | —                                      | Thời điểm cập nhật                    |

---

## 5.3. Enum

### `sourceType`

```text
GENERATED
UPLOADED
```

`sourceType` immutable.

Không tồn tại transition:

```text
GENERATED → UPLOADED
UPLOADED  → GENERATED
```

---

### `status`

```text
DRAFT
ACTIVE
```

Với Generated CV:

```text
DRAFT ⇄ ACTIVE
```

theo Product V7.

Với Uploaded CV:

```text
create → ACTIVE
```

`ACTIVE` trên Uploaded CV là **persistence normalization để CandidateCV dùng chung representation**, không tạo thêm Uploaded lifecycle business mới.

Không tồn tại:

```text
UPLOADED + DRAFT
```

---

### `visibility`

```text
PRIVATE
PUBLIC
```

`visibility = PUBLIC` không phải effective-public state.

Không persist:

```text
effectiveVisibility
isPubliclyAccessible
isSearchable
isPublished
```

Effective eligibility được suy ra bởi nghiệp vụ tương ứng khi version đó tồn tại.

---

## 5.4. Archive representation

Archive được biểu diễn bởi:

```text
archivedAt = null
→ CV còn trong My CVs hoạt động
```

```text
archivedAt != null
→ CV đã archive
```

Không thêm:

```text
status = ARCHIVED
```

vì:

```text
status
→ content/usability lifecycle

archivedAt
→ library membership lifecycle
```

là hai dimension độc lập.

---

## 5.5. Default representation

Default được lưu:

```text
CandidateCV.isDefault
```

Không lưu:

```text
User.defaultCandidateCvId
```

Canonical relation:

```text
Candidate
└── 0..1 active Default CandidateCV
```

Điều này chủ động resolve khác biệt giữa macro database và SVG.

SVG field:

```text
User.defaultCandidateCvId
```

không được đưa vào canonical V7.

---

## 5.6. Indexes

### Ownership / active library

```text
{ candidateUserId: 1, archivedAt: 1 }
```

**Loại:** Compound.

**Mục đích:**

* resolve My CVs của Candidate;
* enforce ownership-scoped lookup;
* phân biệt active library với archived CV.

---

### Maximum-one Default CV

Conceptual partial unique constraint:

```text
UNIQUE(candidateUserId)
WHERE
  isDefault = true
  AND archivedAt = null
```

Mục đích:

```text
mỗi Candidate có tối đa một Default CV đang hoạt động
```

Không dùng application-only check để thay thế database uniqueness vì concurrent Default selection có thể phá invariant.

---

### Không thêm index Candidate Search

V7 không thêm speculative indexes kiểu:

```text
visibility + categoryId
visibility + skills
status + categoryId
preferredLocations
```

chỉ để chuẩn bị Candidate Search.

Candidate Search thuộc version sau.

---

## 5.7. Reference rules

| Field               | Reference       | Required | Cardinality | Rule                                   |
| ------------------- | --------------- | -------: | ----------- | -------------------------------------- |
| `candidateUserId`   | User            |      YES | N → 1       | User phải là Candidate                 |
| `categoryId`        | Category        |      YES | N → 1       | FIELD hoặc POSITION đều hợp lệ         |
| `experienceLevelId` | ExperienceLevel |       NO | N → 0..1    | Phải thuộc canonical V4 dataset nếu có |

Location/EmploymentType/WorkMode không phải references.

---

# 6. GeneratedCvContent

## 6.1. Responsibility

`GeneratedCvContent` là structured source-of-truth để:

* autosave Generated CV;
* render Harvard Preview;
* đánh giá completeness;
* render official PDF khi `ACTIVE`.

Không phải:

* Candidate Profile;
* snapshot;
* Generated PDF history;
* independent collection.

---

## 6.2. Structure

```text
GeneratedCvContent
├── personalInfo
│   ├── fullName
│   ├── email
│   ├── phone
│   ├── displayLocation
│   ├── links[]
│   └── avatarUrl
│
├── professionalSummary
├── educations[]
├── skills[]
├── workExperiences[]
├── projects[]
├── certifications[]
├── languages[]
└── hiddenSections[]
```

Các content fields phải cho phép partial persistence khi parent CV là `DRAFT`.

Vì vậy exact Active completeness **không được triển khai bằng global schema-required trên toàn bộ Generated content**.

---

## 6.3. CvPersonalInfo

```text
CvPersonalInfo {
  fullName
  email
  phone
  displayLocation
  links[]
  avatarUrl
}
```

| Field             | Type     | Required ở storage | Required để ACTIVE |
| ----------------- | -------- | -----------------: | -----------------: |
| `fullName`        | String   |                 NO |                YES |
| `email`           | String   |                 NO |                YES |
| `phone`           | String   |                 NO |                YES |
| `displayLocation` | String   |                 NO |                 NO |
| `links`           | String[] |                 NO |                 NO |
| `avatarUrl`       | String   |                 NO |                 NO |

Việc User Profile thay đổi không cập nhật `CvPersonalInfo`.

Ví dụ:

```text
User.phoneNumber thay đổi
≠
GeneratedCvContent.personalInfo.phone thay đổi
```

---

## 6.4. `professionalSummary`

```text
professionalSummary: String
```

Storage:

```text
optional trong DRAFT
```

Completeness:

```text
required trong ACTIVE
```

---

## 6.5. CvEducation

```text
CvEducation {
  institutionName
  degree
  fieldOfStudy
  startDate
  endDate
}
```

| Field             | Type   | Required ở DRAFT | Required cho valid ACTIVE item |
| ----------------- | ------ | ---------------: | -----------------------------: |
| `institutionName` | String |               NO |                            YES |
| `degree`          | String |               NO |                            YES |
| `fieldOfStudy`    | String |               NO |                             NO |
| `startDate`       | Date   |               NO |                             NO |
| `endDate`         | Date   |               NO |                             NO |

Generated CV `ACTIVE` phải có:

```text
educations.length >= 1
```

và ít nhất một Education item hợp lệ.

DRAFT được phép persist item đang nhập dở.

---

## 6.6. Skills

Canonical V7 sử dụng:

```text
skills: String[]
```

Không sử dụng canonical structure cũ:

```text
technicalSkills[]
tools[]
softSkills[]
```

Generated CV `ACTIVE` phải có:

```text
skills.length >= 1
```

`skills[]` là CV content.

Nó độc lập với:

```text
CandidateCV.skillTags[]
```

---

## 6.7. CvWorkExperience

```text
CvWorkExperience {
  companyName
  position
  startDate
  endDate
  description
  achievements[]
}
```

Các field này không được V7 dùng làm Activate requirement.

Không tự thêm minimum count cho:

```text
workExperiences[]
```

V7 cho phép:

```text
workExperiences = []
```

trên một Generated CV `ACTIVE`.

---

## 6.8. CvProject

```text
CvProject {
  name
  role
  technologies[]
  description
  projectUrl
}
```

`projects[]` optional.

Không có minimum item count phục vụ activation.

Không tạo Project collection riêng.

---

## 6.9. CvCertification

Canonical structure:

```text
CvCertification {
  name
  issuer
  issueDate
  expirationDate
  credentialId
  credentialUrl
}
```

| Field            | Type   | Required ở DRAFT | Required cho valid record |
| ---------------- | ------ | ---------------: | ------------------------: |
| `name`           | String |               NO |                       YES |
| `issuer`         | String |               NO |                        NO |
| `issueDate`      | Date   |               NO |                        NO |
| `expirationDate` | Date   |               NO |                        NO |
| `credentialId`   | String |               NO |                        NO |
| `credentialUrl`  | String |               NO |                        NO |

`certifications[]` optional.

DRAFT có thể persist item chưa hoàn thiện trong quá trình chỉnh sửa.

Một Generated CV không được persist ở `ACTIVE` với Certification item đang tồn tại nhưng vi phạm required item structure của Product V7.

---

## 6.10. CvLanguage

```text
CvLanguage {
  name
  proficiency
}
```

### `proficiency`

```text
BEGINNER
INTERMEDIATE
ADVANCED
FLUENT
NATIVE
```

| Field         | Required ở DRAFT | Required cho valid record |
| ------------- | ---------------: | ------------------------: |
| `name`        |               NO |                       YES |
| `proficiency` |               NO |                       YES |

`languages[]` optional.

---

## 6.11. `hiddenSections`

```text
hiddenSections: String[]
```

Field này lưu các Harvard section đang được Candidate chọn ẩn.

Các member phải tương ứng với section hợp lệ của fixed Harvard Template, không phải user-defined arbitrary section name.

`hiddenSections` không được dùng để bypass Active completeness.

Ví dụ việc ẩn một required section không làm:

```text
incomplete content
→ complete content
```

---

## 6.12. Item order

Thứ tự của:

```text
educations[]
workExperiences[]
projects[]
certifications[]
languages[]
skills[]
```

là persisted presentation order trong Harvard Builder.

Không cần thêm global order collection hoặc CV layout entity.

---

## 6.13. Embedded lifecycle

Tất cả embedded items:

* thuộc CandidateCV;
* không tồn tại độc lập;
* không có owner riêng;
* không có lifecycle độc lập;
* không tạo cross-document relationship.

V7 không yêu cầu stable public identifier cho từng embedded item.

---

# 7. UploadedCvFile

## 7.1. Responsibility

`UploadedCvFile` lưu metadata cần thiết để CandidateCV xác định current valid Uploaded PDF.

Chỉ lưu **một current file**.

Không lưu historical files.

---

## 7.2. Fields

```text
UploadedCvFile {
  storageKey
  originalFileName
  mimeType
  sizeBytes
  pageCount
  uploadedAt
}
```

| Field              | Type    | Required | Constraint                 |
| ------------------ | ------- | -------: | -------------------------- |
| `storageKey`       | String  |      YES | Internal storage locator   |
| `originalFileName` | String  |      YES | —                          |
| `mimeType`         | String  |      YES | PDF                        |
| `sizeBytes`        | Integer |      YES | metadata của validated PDF |
| `pageCount`        | Integer |      YES | metadata của validated PDF |
| `uploadedAt`       | Date    |      YES | —                          |

Macro database cũng xác định một Uploaded CV chỉ lưu current uploaded file, không có `previousFiles` hoặc `fileHistory`.

---

## 7.3. File validity

Trước khi UploadedCvFile trở thành canonical persisted current file, hệ thống phải xác nhận:

```text
actual valid PDF
AND not password-protected
AND size <= 10 MB
AND pageCount <= 20
```

`mimeType` do client gửi không phải bằng chứng đủ để xác nhận actual PDF.

`sizeBytes` và `pageCount` persisted phải phản ánh file đã được hệ thống kiểm tra, không phải metadata mà client tự khai.

Macro business source cũng xác định bốn điều kiện PDF này.

---

## 7.4. Storage key

Canonical persisted locator là:

```text
storageKey
```

Data Contract không yêu cầu persist một public URL cố định.

Không persist:

```text
publicCvUrl
publicDownloadUrl
```

vì Product V7 không có public Internet CV.

---

# 8. State Matrix

V7 có nhiều state dimensions độc lập:

```text
sourceType
status
visibility
archivedAt
isDefault
source-specific payload
```

## 8.1. Canonical matrix

| Source    | Status | Archive  | Default | Payload                   | Hợp lệ |
| --------- | ------ | -------- | ------- | ------------------------- | ------ |
| GENERATED | DRAFT  | active   | false   | generatedContent          | YES    |
| GENERATED | DRAFT  | active   | true    | generatedContent          | NO     |
| GENERATED | ACTIVE | active   | false   | complete generatedContent | YES    |
| GENERATED | ACTIVE | active   | true    | complete generatedContent | YES    |
| GENERATED | DRAFT  | archived | false   | generatedContent          | YES    |
| GENERATED | ACTIVE | archived | false   | generatedContent          | YES    |
| GENERATED | any    | archived | true    | generatedContent          | NO     |
| UPLOADED  | ACTIVE | active   | false   | valid uploadedFile        | YES    |
| UPLOADED  | ACTIVE | active   | true    | valid uploadedFile        | YES    |
| UPLOADED  | ACTIVE | archived | false   | uploadedFile              | YES    |
| UPLOADED  | DRAFT  | any      | any     | uploadedFile              | **NO** |
| UPLOADED  | any    | any      | any     | generatedContent          | **NO** |
| GENERATED | any    | any      | any     | uploadedFile              | **NO** |

Visibility:

```text
PRIVATE
PUBLIC
```

đều được phép ở mọi Generated `DRAFT`/`ACTIVE` và Uploaded `ACTIVE` state.

Nhưng:

```text
DRAFT + PUBLIC
```

không tạo effective-public behavior.

---

## 8.2. Derived effective-public eligibility

Không persist field riêng.

Với Generated CV, local V7 prerequisite tối thiểu để sau này có thể được một version khác xem xét là:

```text
status = ACTIVE
AND visibility = PUBLIC
AND archivedAt = null
```

Với Uploaded CV, current valid Uploaded CV phải:

```text
status = ACTIVE
AND visibility = PUBLIC
AND archivedAt = null
```

Quyền Recruiter và Candidate Search conditions khác không thuộc V7.

---

# 9. Persistence Transitions

## 9.1. Tạo Generated CV Draft

### Trigger business

`F03`, `BR-09`–`BR-11`

### Trước

```text
CandidateCV chưa tồn tại
```

### Sau

```text
candidateUserId = current Candidate
name = required value
sourceType = GENERATED
status = DRAFT
visibility = PRIVATE | PUBLIC
categoryId = valid Category
experienceLevelId = optional
preferredLocations = [...]
skillTags = [...]
employmentTypes = [...]
workModes = [...]
isDefault = false
generatedContent = empty/partial structured content
uploadedFile = absent
archivedAt = null
```

### Invariant

Không cần Generated content complete để tạo Draft.

---

## 9.2. Save Generated Draft

### Trước

```text
sourceType = GENERATED
status = DRAFT
archivedAt = null
```

### Sau

Structured content được cập nhật.

Nếu vẫn incomplete:

```text
status = DRAFT
```

Nếu đã complete:

```text
status vẫn = DRAFT
```

cho đến khi Candidate thực hiện explicit activation.

Không có auto:

```text
DRAFT → ACTIVE
```

chỉ vì autosave làm content complete.

---

## 9.3. Activate Generated CV

### Trigger

`F04`, `BR-14`–`BR-20`

### Trước

```text
sourceType = GENERATED
status = DRAFT
archivedAt = null
```

Current content phải đồng thời thỏa exact Generated completeness của Product V7:

```text
personalInfo.fullName present
personalInfo.email present
personalInfo.phone present
professionalSummary present
>= 1 valid Education
>= 1 Skill
```

Với Education item dùng để satisfy minimum:

```text
institutionName present
AND
degree present
```

Incomplete Education / WorkExperience / Project items được phép tồn tại trong content
và **không** tự làm fail completeness chỉ vì chúng đang nhập dở, miễn là exact
minimum ở trên vẫn đạt.

Nếu Certification item tồn tại, record đó phải có `name` để current content được
coi là activation-ready.

Nếu Language item tồn tại, record đó phải có `name` và `proficiency` thuộc
canonical enum để current content được coi là activation-ready.

Không diễn giải completeness thành yêu cầu mọi structured record đang tồn tại
(Education/WorkExperience/Project/…) đều phải complete.

### Sau

```text
status = ACTIVE
```

Các field khác không tự động thay đổi.

Visibility có thể vẫn:

```text
PRIVATE
hoặc
PUBLIC
```

### Atomicity

Validation và commit không được cho phép persisted state:

```text
status = ACTIVE
+
current generatedContent incomplete
```

Nếu content thay đổi đồng thời trong lúc activation được quyết định, transition chỉ được commit nếu **current state dùng để commit** vẫn đáp ứng completeness.

Data Contract không quy định optimistic locking, revision field hay query cụ thể; implementation chỉ phải giữ invariant.

---

## 9.4. Edit Generated ACTIVE nhưng vẫn complete

### Trước

```text
status = ACTIVE
```

### Sau

```text
generatedContent = updated complete content
status = ACTIVE
```

Nếu CV đang Default:

```text
isDefault
```

không cần thay đổi.

---

## 9.5. Edit Generated ACTIVE thành incomplete

### Trước

```text
sourceType = GENERATED
status = ACTIVE
archivedAt = null
```

### Sau

```text
generatedContent = updated incomplete content
status = DRAFT
isDefault = false
```

Nếu trước đó:

```text
isDefault = true
```

thì việc:

```text
status ACTIVE → DRAFT
```

và:

```text
isDefault true → false
```

phải là cùng một atomic persisted change.

Không được commit:

```text
status = DRAFT
isDefault = true
```

---

## 9.6. Tạo Uploaded CV

### Trigger

`F05`, `BR-22`–`BR-24`

File được kiểm tra trước khi CandidateCV được hoàn tất.

### Sau

```text
sourceType = UPLOADED
status = ACTIVE
uploadedFile = validated current PDF metadata
generatedContent = absent
isDefault = false
archivedAt = null
```

với required common metadata:

```text
name
visibility
categoryId
```

Uploaded CV không có intermediate persisted `DRAFT`.

---

## 9.7. Replace Uploaded PDF

### Trigger

`F06`

### Trước

```text
uploadedFile = file A
```

File B được cung cấp và kiểm tra.

### Nếu B không hợp lệ

Persisted state:

```text
uploadedFile = file A
```

không thay đổi.

### Nếu B hợp lệ và replacement commit

```text
uploadedFile = file B
```

Toàn bộ metadata current-file phải được thay cùng nhau.

Không được xuất hiện persisted combination:

```text
storageKey từ B
pageCount từ A
sizeBytes từ A
```

---

## 9.8. Rename / metadata update / visibility change

### Các field được thay đổi độc lập

Có thể cập nhật:

```text
name
visibility
categoryId
experienceLevelId
preferredLocations
skillTags
employmentTypes
workModes
```

khi CV chưa archive.

Không tự động thay đổi:

```text
generatedContent
uploadedFile
sourceType
```

Metadata update không đồng bộ Generated content.

---

## 9.9. Set Default khi chưa có Default

### Trước

```text
Target CV:
isDefault = false
status = ACTIVE
archivedAt = null
```

### Sau

```text
Target CV:
isDefault = true
```

Database uniqueness phải tiếp tục giữ maximum-one invariant.

---

## 9.10. Switch Default

### Trước

```text
CV A.isDefault = true
CV B.isDefault = false
```

### Sau

```text
CV A.isDefault = false
CV B.isDefault = true
```

Target B phải eligible.

Transition này là cross-document operation và thuộc `TX-01`.

---

## 9.11. Unset Default

### Trước

```text
CV A.isDefault = true
```

### Sau

```text
CV A.isDefault = false
```

Không tự chọn CV khác.

---

## 9.12. Archive CV

### Trước

```text
archivedAt = null
```

### Sau

```text
archivedAt = now
isDefault = false
```

Giữ nguyên:

```text
sourceType
status
visibility
categoryId
metadata
generatedContent / uploadedFile
```

Archive không tạo:

```text
status = ARCHIVED
```

và không hard delete document.

---

# 10. Transaction / Atomicity Requirements

V7 không yêu cầu transaction mặc định cho mọi operation.

Phần lớn Candidate CV state nằm trong một `CandidateCV` document và phải dùng atomic single-document mutation khi nhiều field của cùng CV phải thay đổi cùng nhau.

---

## TX-01 — Switch Default CV

### Business source

* `F09`
* `BR-35`
* `BR-36`
* `BR-37`

Áp dụng khi Candidate đang có CV A làm Default và chọn CV B làm Default.

Trong cùng transaction:

1. xác nhận target CV B thuộc Candidate;
2. xác nhận B chưa archive;
3. xác nhận B eligible làm Default;
4. clear Default trên A;
5. set Default trên B.

Sau commit:

```text
A.isDefault = false
B.isDefault = true
```

Không được coi operation switch thành công với partial state:

```text
A.isDefault = false
B.isDefault = false
```

do bước set B thất bại giữa operation.

Nếu bất kỳ bước bắt buộc nào thất bại:

```text
rollback toàn bộ switch
```

Database partial unique constraint tiếp tục bảo vệ concurrent attempts.

---

## 10.2. Atomic single-document requirements

Không cần multi-document transaction nhưng phải atomic trong cùng CandidateCV đối với:

### ACTIVE → DRAFT

```text
status = DRAFT
isDefault = false
generatedContent = new content
```

nếu edit làm Generated CV incomplete.

### Archive

```text
archivedAt = now
isDefault = false
```

### Uploaded replacement

```text
uploadedFile
```

phải được thay như một current-file value thống nhất.

### Activation

Không được commit `ACTIVE` nếu current content được commit không complete.

---

## 10.3. External file storage boundary

Uploaded PDF storage là external side effect đối với persisted database state.

Canonical ordering:

```text
new file available
↓
new file validated
↓
CandidateCV.uploadedFile persistence succeeds
↓
old external file may be cleaned up
```

Nếu validation hoặc persistence update thất bại:

```text
CandidateCV.uploadedFile cũ
```

phải giữ nguyên.

Việc cleanup:

* orphan temporary file;
* old external artifact;
* retry external deletion;

không nằm trong database transaction requirement của V7.

V7 **không yêu cầu distributed transaction hoặc exactly-once semantics giữa database và file storage**.

Nếu persistence đã chuyển current metadata sang file mới nhưng external cleanup của file cũ thất bại, CandidateCV business state vẫn được coi là đã chuyển sang file mới; leftover storage artifact là technical cleanup concern.

Macro database ban đầu cũng chọn ordering cập nhật CandidateCV trước khi cleanup file cũ.

---

## 10.4. Generated PDF

V7 không yêu cầu persist Generated official PDF như một stateful artifact.

Canonical source-of-truth là:

```text
GeneratedCvContent
```

Official PDF có thể được render từ content `ACTIVE`.

Không có transaction giữa Generated content và một persisted Generated PDF trong V7.

---

# 11. Constraint Ownership

## 11.1. Database / schema bảo vệ

| Constraint                                                 | Owner                      | Lý do                       |
| ---------------------------------------------------------- | -------------------------- | --------------------------- |
| `candidateUserId` required                                 | Schema                     | Structural                  |
| `name` required                                            | Schema                     | Common required metadata    |
| `sourceType` enum                                          | Schema                     | Local vocabulary            |
| `status` enum                                              | Schema                     | Local state                 |
| `visibility` enum                                          | Schema                     | Local vocabulary            |
| `categoryId` required                                      | Schema                     | Common required metadata    |
| `preferredLocations[]` member thuộc Location vocabulary    | Schema/data validation     | Fixed vocabulary            |
| `employmentTypes[]` member thuộc EmploymentType vocabulary | Schema/data validation     | Fixed vocabulary            |
| `workModes[]` member thuộc WorkMode vocabulary             | Schema/data validation     | Fixed vocabulary            |
| Language proficiency enum                                  | Schema                     | Local vocabulary            |
| `sourceType = UPLOADED → status = ACTIVE`                  | Schema/local validation    | Same-document state rule    |
| GENERATED/UPLOADED payload XOR                             | Schema/local validation    | Same-document structure     |
| `status = DRAFT → isDefault = false`                       | Schema/local validation    | Same-document invariant     |
| `archivedAt != null → isDefault = false`                   | Schema/local validation    | Same-document invariant     |
| `isDefault = true → status = ACTIVE`                       | Schema/local validation    | Same-document invariant     |
| `isDefault = true → archivedAt = null`                     | Schema/local validation    | Same-document invariant     |
| Max one Default active CV per Candidate                    | Database unique constraint | Concurrency-safe uniqueness |

Database/schema không phải owner của:

```text
referenced User.role
actual PDF validity
Candidate authorization
Generated completeness transition
```

nếu cần cross-document hoặc external context.

---

## 11.2. Service bảo vệ

| Constraint                                           | Owner                   | Lý do                        |
| ---------------------------------------------------- | ----------------------- | ---------------------------- |
| `candidateUserId` phải reference User tồn tại        | Service                 | Cross-document               |
| User owner phải là Candidate                         | Service                 | Cross-document role          |
| Candidate chỉ thao tác CV của mình                   | Service                 | Authorization                |
| Category phải tồn tại                                | Service                 | Cross-document reference     |
| Category FIELD/POSITION đều được chấp nhận           | Service                 | Product rule                 |
| ExperienceLevel phải tồn tại nếu được chọn           | Service                 | Cross-document               |
| Không mutate archived CV                             | Service                 | Lifecycle                    |
| `sourceType` không được đổi                          | Service + schema        | Lifecycle                    |
| DRAFT → ACTIVE chỉ khi exact completeness pass       | Service                 | Business transition          |
| Candidate phải explicit activate                     | Service                 | Business ordering            |
| ACTIVE edit incomplete → DRAFT                       | Service                 | Business lifecycle           |
| Invalidating ACTIVE Default phải clear Default       | Service + atomic write  | Cross-field lifecycle        |
| Actual file là PDF                                   | Service/file validation | Không xác định chỉ từ schema |
| PDF không password                                   | Service/file validation | File-level                   |
| PDF <= 10 MB                                         | Service/file validation | File-level                   |
| PDF <= 20 pages                                      | Service/file validation | File-level                   |
| Uploaded metadata phải được derive từ validated file | Service                 | Client không phải authority  |
| Target Default phải thuộc Candidate                  | Service                 | Ownership                    |
| Target Default phải eligible                         | Service                 | Business                     |
| Archive terminal trong V7                            | Service                 | Lifecycle                    |
| PUBLIC không tạo public access                       | Service/access boundary | Business authorization       |
| Profile update không sync CV                         | Service boundary        | Product invariant            |

---

## 11.3. Exact Generated completeness owner

`status = ACTIVE` chỉ hợp lệ khi current Generated content thỏa:

```text
personalInfo.fullName present
AND
personalInfo.email present
AND
personalInfo.phone present
AND
professionalSummary present
AND
>= 1 valid Education
AND
>= 1 Skill
```

Với Education item dùng để satisfy minimum:

```text
institutionName present
AND
degree present
```

Nếu Certification item tồn tại:

```text
name present
```

Nếu Language item tồn tại:

```text
name present
AND
proficiency thuộc canonical enum
```

Schema phải cho phép DRAFT incomplete.

Vì vậy:

```text
DRAFT partial persistence
```

và:

```text
ACTIVE completeness
```

không được conflated thành cùng một global required-field policy.

---

# 12. Token / TTL Lifecycle

> V7 không bổ sung token/TTL persistence mới.

Không thêm:

```text
CV access token
public CV token
CV share token
temporary Candidate Search token
```

Auth tokens/sessions từ version trước giữ nguyên contract.

Temporary storage artifacts trong quá trình upload không phải Product token lifecycle và không tạo canonical token collection V7.

---

# 13. Multi-tenant Data Boundary

V7 không bổ sung Company tenant ownership cho Candidate CV.

Canonical ownership key:

```text
candidateUserId
```

không phải:

```text
companyId
tenantId
companyMemberId
```

---

## 13.1. Resource ownership

| Resource               | Owner               |
| ---------------------- | ------------------- |
| Candidate Profile data | Candidate User      |
| CandidateCV            | Candidate User      |
| GeneratedCvContent     | Parent CandidateCV  |
| UploadedCvFile         | Parent CandidateCV  |
| Category               | Platform            |
| ExperienceLevel        | Platform            |
| Location               | Platform vocabulary |
| EmploymentType         | Platform vocabulary |
| WorkMode               | Platform vocabulary |

Standard V4 data thuộc platform scope, không thuộc từng Company.

---

## 13.2. CandidateCV authorization resolution

Canonical resolution:

```text
Authenticated Candidate User
        ↓
trusted User identity
        ↓
CandidateCV.candidateUserId
        ↓
authorized CandidateCV scope
```

Không sử dụng client-provided:

```text
candidateUserId
ownerId
companyId
```

như bằng chứng authorization.

---

## 13.3. Không có Company relation

Không tồn tại canonical V7 relationship:

```text
CandidateCV → Company
CandidateCV → CompanyMember
CandidateCV → Recruiter
CandidateCV → Job
```

Recruiter đang là Primary hoặc Supporting không tạo quyền CandidateCV trong V7.

---

# 14. Snapshot / Historical Data

> V7 không bổ sung snapshot hoặc historical persistence mới.

Không tạo:

```text
SubmittedCvSnapshot
InvitationCvSnapshot
CandidateCvSnapshot
CandidateCvHistory
CandidateCvVersion
UploadedFileHistory
```

Canonical invariant để version sau kế thừa:

```text
future snapshot != live CandidateCV
```

V7 CandidateCV không được thiết kế như một object mà future Application bắt buộc phải đọc live để giữ historical truth.

Tuy nhiên:

* snapshot creation;
* snapshot fields;
* snapshot immutability;
* snapshot retention;

đều thuộc version tương lai.

---

## 14.1. Archive không phải history

`archivedAt` chỉ biểu diễn CandidateCV đã rời active library.

Nó không tạo audit/history feature.

---

# 15. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V7:

```text
CandidateProfile collection
```

Candidate Profile reuse `User`.

Không thêm:

```text
User.cvIds[]
User.defaultCandidateCvId
```

Default được canonical hóa bằng:

```text
CandidateCV.isDefault
```

Không thêm separate collections:

```text
GeneratedCV
UploadedCV
CvFile
CvEducation
CvWorkExperience
CvProject
CvCertification
CvLanguage
```

Các content records thuộc GeneratedCvContent.

Không thêm:

```text
Experience collection
Location collection
EmploymentType collection
WorkMode collection
```

do conflict canonical V4.

Không thêm Skill system:

```text
Skill
SkillTag
CandidateCvSkill
```

`skillTags` là string metadata.

Không thêm derived-state fields:

```text
effectiveVisibility
isSearchable
isPublished
isPubliclyAccessible
```

Không thêm lifecycle field:

```text
status = ARCHIVED
```

Archive dùng `archivedAt`.

Không thêm:

```text
deletedAt
hardDeletedAt
restoredAt
```

cho V7 lifecycle.

Không thêm:

```text
uploadedFileVersions[]
previousFiles[]
fileHistory[]
```

Không thêm:

```text
generatedPdfUrl
generatedPdfHistory
generatedPdfVersion
```

làm canonical V7 state.

Không thêm:

```text
publicCvUrl
shareToken
publicAccessToken
```

Không thêm future references:

```text
applicationId
submittedCvSnapshotId
jobInvitationId
jobId
assignedRecruiterId
companyId
companyMemberId
```

Không thêm future Candidate Search indexes chỉ để chuẩn bị trước.

Không thêm:

```text
viewCount
searchScore
rankingScore
lastViewedAt
recruiterViewHistory
```

Không thêm CV duplicate/version/restore persistence.

Mỗi field hoặc collection trên chỉ được bổ sung khi canonical Product/Data Contract của version sở hữu nghiệp vụ đó yêu cầu.

---

# 16. Compatibility với version trước

## 16.1. V1 — User / Authentication

Phải giữ:

* canonical User identity;
* Candidate role;
* account lifecycle;
* email verification;
* password lifecycle;
* session lifecycle;
* token lifecycle.

V7 không thêm required User field mới.

Candidate Profile sử dụng existing User data.

F01 chỉ cho phép Candidate cập nhật các User field hiện có `fullName`,
`avatarUrl`, `dateOfBirth`, `phoneNumber`. `email` chỉ được đọc trong F01;
email change, email reverification và toàn bộ account/authentication lifecycle
tiếp tục thuộc authority của version sở hữu nghiệp vụ đó.

---

## 16.2. V2 — Company

V7 không thay:

```text
Company
Company lifecycle
Company ownership
Company approval
```

CandidateCV không reference Company.

---

## 16.3. V3 — CompanyMember / Recruiter

V7 không thay:

```text
CompanyMember
COMPANY_MANAGER
RECRUITER
Recruiter lifecycle
LOCK
UNLOCK
TERMINATE
```

CandidateCV không reference CompanyMember.

---

## 16.4. V4 — Standard Catalogs

V7 phải giữ canonical V4 representation.

Persisted:

```text
Category
ExperienceLevel
```

Fixed vocabulary:

```text
Location
EmploymentType
WorkMode
```

Không tạo duplicate catalog representation.

Không thêm deactivate/reactivate behavior.

V4 đã chủ động loại `Category.isActive` và xác định Location/EmploymentType/WorkMode không có collection riêng.

`Category` vẫn:

```text
FIELD
POSITION
```

và CandidateCV được reference một Category ở một trong hai level.

---

## 16.5. V5 — Job

V7 không thay:

* Job schema;
* Job Category representation;
* Job lifecycle;
* Job ownership;
* publication/expiration semantics.

Candidate CV không nằm trong Job.

---

## 16.6. V6 — Recruitment Team

V7 không thay:

* Primary;
* Supporting;
* team membership;
* responsibility transfer;
* Recruiter lifecycle integration.

CandidateCV không reference Recruitment Team.

V6 cũng đã chủ động defer CV snapshot, Candidate Search và Application sang version sau.

---

## 16.7. Thay đổi được phép

V7 được phép:

* thêm `candidate_cvs`;
* thêm Generated embedded structures;
* thêm Uploaded file embedded structure;
* reference Category;
* reference ExperienceLevel;
* persist V4 fixed vocabulary values trên CandidateCV;
* bổ sung V7-specific indexes và uniqueness;
* bổ sung lifecycle transitions của CandidateCV.

---

## 16.8. Thay đổi không được phép

V7 không được:

* sửa User schema chỉ để tạo Candidate Profile;
* thêm User default CV reference;
* tạo Company ownership cho CandidateCV;
* tạo duplicate standard catalogs;
* reinterpret V4 vocabulary;
* thêm Application/Snapshot/Invitation;
* thay Job lifecycle;
* thay Recruitment Team;
* thêm Candidate Search behavior;
* thêm future persistence speculative.

---

# 17. Persistence Invariants

Các invariant sau phải luôn đúng ở canonical persisted state.

### Ownership

1. Mỗi CandidateCV có đúng một `candidateUserId`.
2. Owner phải là User Candidate hợp lệ theo business operation thực hiện.
3. CandidateCV không có Company owner.
4. CandidateCV ownership không transfer trong V7.

### Source

5. `sourceType` chỉ là `GENERATED` hoặc `UPLOADED`.
6. `sourceType` immutable.
7. GENERATED không có `uploadedFile`.
8. UPLOADED không có `generatedContent`.
9. UPLOADED luôn persist với `status = ACTIVE`.
10. UPLOADED không tồn tại ở `DRAFT`.

### Common metadata

11. Mọi CandidateCV có `name`.
12. Mọi CandidateCV có `visibility`.
13. Mọi CandidateCV có đúng một `categoryId`.
14. Category reference phải resolve canonical Category.
15. Category `FIELD` và `POSITION` đều hợp lệ.
16. ExperienceLevel optional.
17. Nếu có `experienceLevelId`, reference phải resolve canonical ExperienceLevel.
18. Preferred Locations chỉ lưu V4 Location values.
19. `REMOTE` không được lưu trong `preferredLocations`.
20. `REMOTE` có thể tồn tại trong `workModes`.
21. Employment types chỉ dùng V4 EmploymentType values.
22. Work modes chỉ dùng V4 WorkMode values.

### Generated lifecycle

23. Generated mới bắt đầu `DRAFT`.
24. Generated Draft được partial content persistence.
25. Generated Draft có thể `visibility = PUBLIC`.
26. Generated Draft không được `isDefault = true`.
27. `ACTIVE` Generated content phải complete.
28. Completeness yêu cầu fullName.
29. Completeness yêu cầu email.
30. Completeness yêu cầu phone.
31. Completeness yêu cầu professionalSummary.
32. Completeness yêu cầu ít nhất một valid Education.
33. Completeness yêu cầu ít nhất một Skill.
34. Valid Education dùng cho completeness phải có institutionName + degree.
35. Certification record đã tồn tại trong valid Active content phải có name.
36. Language record đã tồn tại trong valid Active content phải có name + valid proficiency.
37. Candidate explicit activation mới được `DRAFT → ACTIVE`.
38. Complete Draft không tự động trở thành ACTIVE.
39. ACTIVE edit thành incomplete phải commit `DRAFT`.
40. Nếu CV đó là Default, ACTIVE→DRAFT phải đồng thời clear Default.

### Visibility

41. Visibility chỉ `PRIVATE` hoặc `PUBLIC`.
42. `PUBLIC` không tạo public URL.
43. `PUBLIC` không tạo anonymous access.
44. Không persist effective-public field.
45. Candidate Search eligibility đầy đủ không thuộc V7.

### Uploaded

46. Uploaded current file phải là validated PDF.
47. Uploaded PDF không password.
48. Uploaded PDF không vượt 10 MB.
49. Uploaded PDF không vượt 20 trang.
50. CandidateCV chỉ giữ một current UploadedCvFile.
51. Replacement thất bại không thay current persisted file metadata.
52. Replacement thành công thay toàn bộ current metadata như một unit.
53. Không có Uploaded file history V7.

### Default

54. Candidate được phép không có Default.
55. Một Candidate có tối đa một active Default CV.
56. `isDefault = true → status = ACTIVE`.
57. `isDefault = true → archivedAt = null`.
58. `DRAFT → isDefault = false`.
59. Archived CV không được Default.
60. Switch Default phải giữ maximum-one invariant trong concurrent execution.
61. Unset Default không tự chọn CV mới.

### Archive

62. `archivedAt = null` biểu diễn active library.
63. `archivedAt != null` biểu diễn archived CV.
64. Archive không đổi source type.
65. Archive không hard delete CandidateCV.
66. Archive không tạo `ARCHIVED` status.
67. Archive phải clear `isDefault`.
68. V7 không có `archived → active` transition.
69. Archived content/file metadata được giữ.
70. Archived CV không còn usable qua active-library operations.

### Profile independence

71. User Profile mutation không tự động mutate Generated content.
72. Generated CV mutation không tự động mutate User Profile.
73. Uploaded PDF replacement không mutate Candidate Profile.

### Version boundary

74. Không có V7 CandidateCV → Application relationship.
75. Không có V7 CandidateCV → Invitation relationship.
76. Không có V7 CandidateCV → Job relationship.
77. Không có V7 CandidateCV → Recruiter relationship.
78. Không có V7 CandidateCV → Company relationship.
79. V7 không persist submitted CV snapshot.
80. V7 không persist Candidate Search state.
81. V7 không thay canonical persistence contracts V1–V6 ngoài references reuse được nêu rõ.

---

# 18. Definition of Data Completion

Data Contract V7 được coi là hoàn thành khi:

* `candidate_cvs` có canonical responsibility rõ ràng;
* Generated và Uploaded dùng chung CandidateCV;
* `sourceType` XOR rule được khóa;
* `users` được giữ nguyên;
* Candidate Profile không tạo persistence source thứ hai;
* Category reference đúng canonical V4;
* ExperienceLevel reference đúng canonical V4;
* Location/EmploymentType/WorkMode dùng fixed vocabulary đúng canonical V4;
* không tạo các collection catalog trái V4;
* GeneratedCvContent phản ánh fixed form cuối cùng của Product V7;
* `skills[]` thay thế structure technical/tools/soft cũ;
* Certification có structured record;
* Language có structured record và canonical proficiency;
* exact `DRAFT → ACTIVE` completeness đã được xác định;
* `ACTIVE → DRAFT` persistence behavior đã được xác định;
* Uploaded file validation representation đã rõ;
* replace-file invariant đã rõ;
* archive representation đã rõ;
* Default CV representation đã rõ;
* maximum-one Default uniqueness đã rõ;
* `TX-01` bảo vệ Default switch;
* single-document atomic transitions đã rõ;
* database/service constraint ownership đã rõ;
* external file storage không bị suy diễn thành distributed transaction requirement;
* ownership Candidate boundary đã rõ;
* Company multi-tenant persistence không bị kéo vào CandidateCV;
* snapshot/historical boundary đã rõ;
* compatibility V1–V6 được giữ;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn.

Data Completion không có nghĩa schema đã được code.

Nó có nghĩa implementation V7 có thể bắt đầu mà không phải tự quyết thêm persistence architecture quan trọng hoặc tự reinterpret business requirement.

---

# 19. Implementation Boundary

Tài liệu này là **canonical persistence/data contract của V7**.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Data Contract được phép định nghĩa:

* entities;
* collection;
* fields;
* embedded documents;
* references;
* fixed vocabulary representation;
* cardinality;
* enums;
* indexes;
* uniqueness;
* persisted state;
* transitions;
* transaction requirements;
* persistence invariants;
* constraint ownership.

Data Contract không định nghĩa:

* REST endpoint;
* HTTP method;
* HTTP status;
* request/response body;
* route;
* controller;
* service function layout;
* middleware implementation;
* MongoDB query cụ thể;
* Mongoose method;
* frontend component;
* UI state management;
* exact autosave mechanism;
* Cloudinary API flow;
* signed URL implementation;
* temporary-file cleanup implementation;
* test framework.

Canonical authority:

```text
Approved Product V7
        │
        │ business truth
        ↓
Approved Data V7
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture truth
        ↓
Implementation
```

Macro database và entity diagram chỉ là input material.

Sau Data Contract này, các điểm cũ trong macro/diagram sau **không còn authority**:

```text
Experience collection
Location reference collection
EmploymentType reference collection
WorkMode reference collection

User.defaultCandidateCvId

technicalSkills[]
tools[]
softSkills[]

certificates string[]
languages string[]

"minimum personal info + one arbitrary section"
làm DRAFT → ACTIVE condition
```

Canonical V7 thay chúng bằng contract trong tài liệu này.
