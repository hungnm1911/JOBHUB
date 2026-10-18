# V14 — Candidate Search trên CV PUBLIC Data Model

> **File:** `docs/data/versions/v14-candidate-search-public-cv-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v14-candidate-search-public-cv.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v14-candidate-search-public-cv.md
```

Product Specification là authority đối với business behavior.

V14 là version Candidate Search **chỉ đọc**, chủ yếu sử dụng persisted state đã tồn tại từ các version trước.

Data Model này xác định:

* entity/collection nào được Candidate Search sử dụng;
* field nào là nguồn dữ liệu canonical;
* relationship và ownership;
* index phục vụ Search, Filter và authorization;
* cách biểu diễn eligibility dựa trên persisted state;
* state matrix liên quan `CandidateCV`;
* ảnh hưởng của các lifecycle transition đã tồn tại tới Candidate Search;
* transaction / atomicity requirement;
* constraint nào thuộc schema/database;
* constraint nào phải được service bảo vệ;
* multi-tenant/data ownership boundary;
* các field/collection chủ động không thêm.

V14 không được dùng Data Model để tạo thêm lifecycle hoặc business state chưa tồn tại trong Product Specification.

Đặc biệt:

```text
Archive
```

là lifecycle loại trừ CV đã tồn tại.

V14 **không bổ sung Soft Delete lifecycle** cho Candidate CV.

---

## 2. Thay đổi so với version trước

| Entity / Collection | Trạng thái  | Mô tả                                                                                                                                 |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CandidateCV`       | `UPDATED`   | Không thêm business field mới; bổ sung index phục vụ Candidate Search và giữ nguyên persistence representation canonical từ V7      |
| `Job`               | `UPDATED`   | Không thêm field; bổ sung index phục vụ xác định Recruiter đang là Primary/Supporting                                                 |
| `User`              | `UNCHANGED` | Dùng trạng thái account, email verification và role hiện có                                                                           |
| `CompanyMember`     | `UNCHANGED` | Dùng membership, role và trạng thái hiện có                                                                                           |
| `Company`           | `UNCHANGED` | Dùng trạng thái hoạt động hiện có                                                                                                     |
| `Category`          | `UNCHANGED` | Dùng catalog và hierarchy FIELD/POSITION hiện có                                                                                      |
| `ExperienceLevel`   | `UNCHANGED` | Dùng persisted fixed dataset hiện có                                                                                                  |
| Location vocabulary | `UNCHANGED` | Dùng fixed vocabulary hiện có; không tạo collection                                                                                   |
| EmploymentType vocabulary | `UNCHANGED` | Dùng fixed vocabulary hiện có; không tạo collection                                                                             |
| WorkMode vocabulary | `UNCHANGED` | Dùng fixed vocabulary hiện có; không tạo collection                                                                                   |

### 2.1. Entity mới

Không có.

V14 không tạo:

```text
CandidateSearch
CandidateSearchResult
CandidateSearchFilter
CandidateSearchPermission
CandidateSearchSession
CandidateCvView
CandidateCvViewHistory
```

Search result là dữ liệu đọc được derive từ persisted state hiện có.

Filter là dữ liệu tạm thời của một lần Search, không phải persisted entity.

### 2.2. Entity được mở rộng

#### `CandidateCV`

Chỉ mở rộng ở mức **index phục vụ Search**.

V14 không thêm field business mới vào `CandidateCV`.

Đặc biệt không thêm:

```text
deletedAt
searchEligible
candidateSearchEnabled
```

#### `Job`

Chỉ mở rộng ở mức index phục vụ xác định Recruitment Team membership.

Không thêm field Candidate Search vào `Job`.

### 2.3. Entity giữ nguyên nhưng được sử dụng

* `User`
* `CompanyMember`
* `Company`
* `Category`
* `ExperienceLevel`
* Location fixed vocabulary
* EmploymentType fixed vocabulary
* WorkMode fixed vocabulary

Không thay đổi schema của các entity này chỉ để phục vụ V14.

---

## 3. Collection / Entity tổng thể

V14 sử dụng:

```text
User
Company
CompanyMember
Job
CandidateCV
Category
ExperienceLevel
```

Location, EmploymentType và WorkMode tiếp tục là fixed vocabularies được
persist trực tiếp trên `CandidateCV`, không phải collection/entity riêng.

Vai trò:

| Entity / Collection | Responsibility trong V14                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `User`              | Xác định Candidate owner, trạng thái Candidate, email verification và trạng thái Recruiter account |
| `Company`           | Xác định Company của Recruiter còn hoạt động hay không                                             |
| `CompanyMember`     | Xác định Recruiter membership, role và Company của Recruiter                                       |
| `Job`               | Xác định Recruiter hiện là Primary hoặc Supporting của ít nhất một Job                             |
| `CandidateCV`       | Resource chính của Search, Filter và Preview                                                       |
| `Category`          | Metadata nghề nghiệp và hierarchy FIELD/POSITION                                                   |
| `ExperienceLevel`   | Metadata Experience theo persisted fixed dataset                                                   |
| Location vocabulary | Metadata Preferred Location persist trực tiếp trên CandidateCV                                      |
| EmploymentType vocabulary | Metadata Employment Type persist trực tiếp trên CandidateCV                                  |
| WorkMode vocabulary | Metadata Work Mode persist trực tiếp trên CandidateCV                                               |

V14 không tạo persisted representation riêng cho:

```text
Recruiter Search Eligibility
Candidate CV Search Eligibility
Search Result
Preview
```

Các khái niệm này được **derive tại thời điểm đọc** từ persisted state canonical.

---

## 4. Quan hệ dữ liệu

### 4.1. Candidate `User` → `CandidateCV`

**Cardinality**

```text
User (Candidate) 1 ───── 0..N CandidateCV
```

**Owner của relationship**

`CandidateCV`

**Reference**

```text
CandidateCV.candidateUserId
```

**Constraint**

* Candidate CV phải thuộc đúng một Candidate owner.
* Candidate Search không dùng `User.defaultCandidateCvId` để giới hạn kết quả.
* Nhiều CV của cùng Candidate có thể đồng thời tham gia Search.

**Lifecycle**

Reference owner không thay đổi do Search hoặc Preview.

---

### 4.2. `CandidateCV` → `Category`

**Cardinality**

```text
Category 1 ───── 0..N CandidateCV

CandidateCV ───── 1 Category
```

**Owner**

`CandidateCV`

**Reference**

```text
CandidateCV.categoryId
```

**Constraint**

Mỗi Candidate CV có một Category chính theo Candidate CV contract kế thừa.

Category hierarchy tiếp tục được xác định từ catalog canonical.

Một `FIELD` có thể có các `POSITION` con.

---

### 4.3. `CandidateCV` → `ExperienceLevel`

**Cardinality**

```text
CandidateCV ───── 0..1 ExperienceLevel

ExperienceLevel 1 ───── 0..N CandidateCV
```

**Owner**

`CandidateCV`

**Reference**

```text
CandidateCV.experienceLevelId
```

**Constraint**

`experienceLevelId` là metadata tùy chọn.

Không có ExperienceLevel không làm CV invalid.

---

### 4.4. Location metadata trên `CandidateCV`

**Owner**

`CandidateCV`

**Persistence field**

```text
CandidateCV.preferredLocations[]
```

Mỗi member thuộc Location fixed vocabulary canonical V4/V7.

Một Candidate CV có thể persist nhiều Preferred Location.

---

### 4.5. EmploymentType metadata trên `CandidateCV`

**Owner**

`CandidateCV`

**Persistence field**

```text
CandidateCV.employmentTypes[]
```

Mỗi member thuộc EmploymentType fixed vocabulary canonical V4/V7.

---

### 4.6. WorkMode metadata trên `CandidateCV`

**Owner**

`CandidateCV`

**Persistence field**

```text
CandidateCV.workModes[]
```

Mỗi member thuộc WorkMode fixed vocabulary canonical V4/V7.

---

### 4.7. Skill metadata

V14 tiếp tục sử dụng:

```text
CandidateCV.skillTags[]
```

Skill không được chuyển thành entity/reference mới trong V14.

---

### 4.8. Recruiter `User` → `CompanyMember`

**Cardinality**

Đối với Recruiter được xét trong V14:

```text
User
↓
CompanyMember
```

`CompanyMember` giữ relationship tới User và Company theo contract đã tồn tại.

Candidate Search phải resolve Company membership hiện tại từ relationship canonical này.

---

### 4.9. `CompanyMember` → `Company`

```text
Company
1
│
│ companyId
↓
N
CompanyMember
```

Company membership của Recruiter là nguồn xác định tenant authorization.

---

### 4.10. Recruitment Team → `Job`

Recruiter eligibility được derive từ:

```text
CompanyMember
    │
    ├── Primary của 0..N Job
    │
    └── Supporting của 0..N Job
```

Các field canonical đang được sử dụng:

```text
Job.primaryRecruiterCompanyMemberId
Job.supportingRecruiterCompanyMemberIds[]
```

Candidate Search không tạo relationship trực tiếp giữa `CandidateCV` và `Job`.

---

## 5. `CandidateCV`

### 5.1. Responsibility

`CandidateCV` chịu trách nhiệm persist:

* Candidate owner;
* Category chính;
* Preferred Location;
* Employment Type;
* Experience;
* Work Mode;
* Skill tags;
* tên CV;
* loại CV;
* Generated lifecycle state nếu là Generated CV;
* visibility;
* Archive state;
* nội dung/file representation kế thừa từ Candidate CV Library;
* timestamps.

`CandidateCV` không chịu trách nhiệm persist:

* Candidate Search eligibility;
* Recruiter Search permission;
* Company ownership;
* Job ownership;
* view history;
* invitation relationship;
* application relationship;
* conversation relationship;
* search history;
* search result.

---

### 5.2. Fields

| Field                | Type               | Required    | Default                              | Constraint                             | Ý nghĩa                     |
| -------------------- | ------------------ | ----------- | ------------------------------------ | -------------------------------------- | --------------------------- |
| `_id`                | `ObjectId`         | YES         | generated                            | unique                                 | Định danh CV                |
| `candidateUserId`    | `ObjectId`         | YES         | —                                    | reference `User`                       | Candidate owner             |
| `categoryId`         | `ObjectId`         | YES         | —                                    | reference `Category`                   | Category chính              |
| `preferredLocations` | `Location[]`       | NO          | empty collection theo contract trước | canonical fixed vocabulary members     | Preferred Locations         |
| `employmentTypes`    | `EmploymentType[]` | NO          | empty collection theo contract trước | canonical fixed vocabulary members     | Employment Types            |
| `experienceLevelId`  | `ObjectId`         | NO          | null/absent                          | reference `ExperienceLevel`            | Experience metadata         |
| `workModes`          | `WorkMode[]`       | NO          | empty collection theo contract trước | canonical fixed vocabulary members     | Work Modes                  |
| `name`               | `String`           | YES         | —                                    | Candidate CV invariant kế thừa         | Tên CV                      |
| `sourceType`         | `String`           | YES         | —                                    | `GENERATED` hoặc `UPLOADED`            | Loại CV                     |
| `status`             | `String`           | YES         | —                                    | source-specific semantics kế thừa V7   | Persistence status          |
| `visibility`         | `String`           | YES         | —                                    | `PRIVATE` hoặc `PUBLIC`                | Visibility                  |
| `skillTags`          | `String[]`         | NO          | empty collection theo contract trước | metadata hiện có                       | Skill metadata              |
| `archivedAt`         | `Date`             | NO          | `null`                               | null hoặc thời điểm Archive            | Archive state               |
| `uploadedFile`       | embedded           | CONDITIONAL | theo V07                             | giữ nguyên V07                         | Uploaded CV representation  |
| `generatedContent`   | embedded           | CONDITIONAL | theo V07                             | giữ nguyên V07                         | Generated CV representation |
| `createdAt`          | `Date`             | YES         | automatic                            | —                                      | Thời điểm tạo               |
| `updatedAt`          | `Date`             | YES         | automatic                            | —                                      | Thời điểm CV được cập nhật  |

V14 không định nghĩa lại cấu trúc bên trong:

```text
UploadedCvFile
GeneratedCvContent
CvPersonalInfo
CvEducation
CvWorkExperience
CvProject
```

Các embedded structure này tiếp tục kế thừa Candidate CV Data Contract trước V14.

---

### 5.3. Enum

#### `sourceType`

```text
GENERATED
UPLOADED
```

| Giá trị     | Ý nghĩa                            |
| ----------- | ---------------------------------- |
| `GENERATED` | CV được tạo bằng Generated CV flow |
| `UPLOADED`  | CV được Candidate upload           |

#### `status`

Giá trị:

```text
DRAFT
ACTIVE
```

| Giá trị  | Ý nghĩa                  |
| -------- | ------------------------ |
| `DRAFT`  | Generated CV chưa active |
| `ACTIVE` | Generated CV active      |

Persistence invariant:

```text
sourceType = GENERATED
→ status ∈ {DRAFT, ACTIVE}
```

```text
sourceType = UPLOADED
→ status = ACTIVE
```

`ACTIVE` trên Uploaded CV là persistence normalization kế thừa V7. Nó không
đại diện cho business lifecycle `DRAFT → ACTIVE` và không được dùng làm
Uploaded Candidate Search eligibility predicate.

#### `visibility`

```text
PRIVATE
PUBLIC
```

`PUBLIC` không tự đồng nghĩa search-eligible.

Search eligibility còn phụ thuộc source lifecycle, Archive state và Candidate owner state.

---

### 5.4. Indexes

Các index Candidate Search sử dụng một **local partial scope** chung:

```text
visibility = PUBLIC
AND
archivedAt = null
```

Partial scope trên chỉ là điều kiện index ở local `CandidateCV`.

Nó **không phải toàn bộ business Search Eligibility**.

Partial index không được dùng `status = ACTIVE` như shared business
Search Eligibility predicate. Generated CV cần điều kiện này; Uploaded CV phải
bỏ qua điều kiện business đó dù vẫn persist `status = ACTIVE` theo normalization
của V7.

Candidate ACTIVE và email verification cũng không được denormalize vào partial index CandidateCV.

#### Default sort

```text
{ updatedAt: -1, _id: -1 }
```

Mục đích:

* hỗ trợ sort `updatedAt` mới nhất trước;
* `_id` là stable technical tie-breaker.

#### Category

```text
{ categoryId: 1, updatedAt: -1, _id: -1 }
```

Mục đích:

* filter theo Category;
* duy trì default ordering.

#### Experience

```text
{ experienceLevelId: 1, updatedAt: -1, _id: -1 }
```

#### Skill

```text
{ skillTags: 1, updatedAt: -1, _id: -1 }
```

#### Preferred Location

```text
{ preferredLocations: 1, updatedAt: -1, _id: -1 }
```

#### Employment Type

```text
{ employmentTypes: 1, updatedAt: -1, _id: -1 }
```

#### Work Mode

```text
{ workModes: 1, updatedAt: -1, _id: -1 }
```

Các array metadata được index riêng.

V14 không yêu cầu một compound index kết hợp đồng thời nhiều array metadata.

---

### 5.5. Embedded documents

V14 không bổ sung embedded document mới.

Các embedded document của Generated và Uploaded CV giữ nguyên contract trước V14.

Preview đọc representation hiện tại của Candidate CV.

Không tạo embedded snapshot khi Preview.

---

### 5.6. Reference rules

| Field               | Reference        | Required | Cardinality | Rule                                |
| ------------------- | ---------------- | -------- | ----------- | ----------------------------------- |
| `candidateUserId`   | `User`           | YES      | N → 1       | User phải là Candidate owner hợp lệ |
| `categoryId`        | `Category`       | YES      | N → 1       | Category của riêng CV               |
| `experienceLevelId` | `ExperienceLevel`| NO       | N → 0..1    | Metadata tùy chọn                   |

`preferredLocations[]`, `employmentTypes[]` và `workModes[]` không phải
reference. Chúng persist trực tiếp các member thuộc fixed vocabularies
canonical V4/V7.

Không có reference:

```text
CandidateCV → Job
CandidateCV → Company
CandidateCV → Recruiter
```

---

## 6. Các entity hỗ trợ authorization và filter

### 6.1. `User`

V14 không thay đổi fields của `User`.

Các field V14 sử dụng:

| Field                  | Vai trò                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `_id`                  | User identity                                              |
| `role`                 | Phân biệt Candidate / Company Staff                        |
| `status`               | Account lifecycle                                          |
| `emailVerifiedAt`      | Candidate email verification                               |
| `defaultCandidateCvId` | Quan hệ CV mặc định kế thừa; không dùng để giới hạn Search |

Candidate Search không copy:

```text
User.status
User.emailVerifiedAt
```

sang `CandidateCV`.

---

### 6.2. `CompanyMember`

Không thay đổi schema.

Các field V14 sử dụng:

| Field       | Vai trò                       |
| ----------- | ----------------------------- |
| `_id`       | Company Member identity       |
| `userId`    | Liên kết Recruiter account    |
| `companyId` | Canonical tenant relationship |
| `role`      | Phải là `RECRUITER`           |
| `status`    | Membership phải đang hợp lệ   |

Không thêm:

```text
canSearchCandidates
candidateSearchEnabled
searchPermission
```

---

### 6.3. `Company`

Không thay đổi schema.

V14 sử dụng trạng thái hoạt động canonical của Company để xác định Recruiter eligibility.

Không copy Company state sang `CompanyMember`, `Job` hoặc `CandidateCV` cho Candidate Search.

---

### 6.4. `Job`

Không thêm field.

Các field V14 sử dụng:

| Field                                   | Vai trò                        |
| --------------------------------------- | ------------------------------ |
| `_id`                                   | Job identity                   |
| `companyId`                             | Tenant owner của Job           |
| `primaryRecruiterCompanyMemberId`       | Primary Recruiter hiện tại     |
| `supportingRecruiterCompanyMemberIds[]` | Supporting Recruiters hiện tại |

#### Index Primary membership

```text
{ companyId: 1, primaryRecruiterCompanyMemberId: 1 }
```

#### Index Supporting membership

```text
{ companyId: 1, supportingRecruiterCompanyMemberIds: 1 }
```

Hai index trên phục vụ việc xác định Recruiter hiện tham gia ít nhất một Recruitment Team trong canonical Company của mình.

Không thêm `Job.status` vào Candidate Search permission contract.

---

### 6.5. `Category`

Không thay đổi schema.

V14 kế thừa các field hierarchy hiện có, bao gồm concept:

```text
level = FIELD | POSITION
parentCategoryId
```

Candidate Search không tạo flattened Category copy trong CandidateCV.

Nếu Recruiter chọn `FIELD`, service resolve các `POSITION` con từ canonical Category hierarchy.

---

### 6.6. `ExperienceLevel`

Không thay đổi schema.

CandidateCV giữ `experienceLevelId` reference tới persisted fixed dataset
ExperienceLevel canonical V4/V7.

---

### 6.7. `Location`

Không có schema/collection Location.

CandidateCV persist trực tiếp nhiều member Location fixed vocabulary trong
`preferredLocations[]`.

---

### 6.8. `EmploymentType`

Không có schema/collection EmploymentType.

CandidateCV persist trực tiếp nhiều member EmploymentType fixed vocabulary
trong `employmentTypes[]`.

---

### 6.9. `WorkMode`

Không có schema/collection WorkMode.

CandidateCV persist trực tiếp nhiều member WorkMode fixed vocabulary trong
`workModes[]`.

---

# 7. State Matrix

State Matrix dưới đây mô tả persisted state hợp lệ của CandidateCV và local Candidate Search eligibility.

`Candidate` eligibility vẫn phải được kiểm tra riêng từ `User`.

| `sourceType` | `status` | `visibility` | `archivedAt` | Persisted state hợp lệ | Local Search eligibility |
| ------------ | -------- | ------------ | ------------ | ---------------------- | ------------------------ |
| `GENERATED`  | `ACTIVE` | `PUBLIC`     | `null`       | YES                    | Eligible về phía CV      |
| `GENERATED`  | `DRAFT`  | `PUBLIC`     | `null`       | YES                    | NO                       |
| `GENERATED`  | `ACTIVE` | `PRIVATE`    | `null`       | YES                    | NO                       |
| `GENERATED`  | `DRAFT`  | `PRIVATE`    | `null`       | YES                    | NO                       |
| `GENERATED`  | `ACTIVE` | bất kỳ       | có giá trị   | YES                    | NO                       |
| `GENERATED`  | `DRAFT`  | bất kỳ       | có giá trị   | YES                    | NO                       |
| `UPLOADED`   | `ACTIVE` | `PUBLIC`     | `null`       | YES                    | Eligible về phía CV      |
| `UPLOADED`   | `ACTIVE` | `PRIVATE`    | `null`       | YES                    | NO                       |
| `UPLOADED`   | `ACTIVE` | bất kỳ       | có giá trị   | YES                    | NO                       |
| `UPLOADED`   | `DRAFT`  | bất kỳ       | bất kỳ       | NO                     | NO                       |

Trong các dòng Uploaded, persisted `status = ACTIVE` chỉ là normalization kế
thừa V7. Local Search eligibility của Uploaded được xác định từ `sourceType`,
`visibility` và `archivedAt`; service không dùng `status` làm eligibility
predicate cho Uploaded.

Local Search eligibility chưa đủ để CV thực sự xuất hiện.

CV cuối cùng chỉ search-eligible khi:

```text
Local CandidateCV eligibility
AND
Candidate User.status = ACTIVE
AND
Candidate User.emailVerifiedAt có giá trị
```

Không persist:

```text
SEARCH_ELIGIBLE
SEARCH_INELIGIBLE
```

dưới dạng field.

---

# 8. Persistence Transitions

V14 không tạo business mutation mới.

Các transition dưới đây được sở hữu bởi lifecycle trước V14 nhưng làm thay đổi dữ liệu mà Candidate Search đọc.

---

## 8.1. Generated CV `DRAFT → ACTIVE`

### Trigger business

Candidate CV lifecycle kế thừa V07.

### Trước

```text
CandidateCV.sourceType = GENERATED
CandidateCV.status = DRAFT
```

### Sau

```text
CandidateCV.sourceType = GENERATED
CandidateCV.status = ACTIVE
```

Nếu đồng thời:

```text
visibility = PUBLIC
archivedAt = null
Candidate ACTIVE
Candidate verified
```

CV có thể trở thành search-eligible.

### Entity bị thay đổi

* `CandidateCV`

### V14 không persist

* Search eligibility;
* Search result;
* search event.

---

## 8.2. CV `PRIVATE → PUBLIC`

### Trước

```text
CandidateCV.visibility = PRIVATE
```

### Sau

```text
CandidateCV.visibility = PUBLIC
```

Việc CV có trở thành search-eligible hay không được derive theo source-specific lifecycle.

`PUBLIC` không tự đủ.

---

## 8.3. CV `PUBLIC → PRIVATE`

### Sau

```text
CandidateCV.visibility = PRIVATE
```

Không cần update:

* Search index entity riêng;
* Candidate Search result;
* view record;
* Recruiter permission record.

Các request tiếp theo derive CV là search-ineligible từ current state.

---

## 8.4. Archive Candidate CV

### Trước

```text
CandidateCV.archivedAt = null
```

### Sau

```text
CandidateCV.archivedAt = thời điểm Archive
```

CV không còn tham gia Candidate Search.

Không có transition:

```text
not deleted
→ deleted
```

trong V14.

---

## 8.5. Candidate account mất eligibility

Ví dụ persisted source state thay đổi:

```text
User.status
```

hoặc email verification state không còn đáp ứng canonical Product Contract.

CandidateCV không bị rewrite.

Không copy trạng thái Candidate vào từng CV.

Search eligibility được derive lại khi đọc.

---

## 8.6. Recruiter mất Job membership cuối cùng

Recruitment Team transition ở version trước cập nhật:

```text
Job.primaryRecruiterCompanyMemberId
```

hoặc:

```text
Job.supportingRecruiterCompanyMemberIds[]
```

V14 không persist:

```text
Recruiter.canSearchCandidates = false
```

Eligibility được derive từ current Recruitment Team state.

---

## 8.7. Recruiter / Company mất eligibility

Các lifecycle transition trước V14 có thể thay đổi:

```text
User.status
CompanyMember.status
Company.operationalStatus
```

Candidate Search không tạo derived permission record.

---

## 8.8. Search / Filter / Preview

### Trước

Persisted state hiện tại.

### Sau

```text
Persisted state không thay đổi
```

Search, Filter và Preview không mutate database.

Không tạo:

* snapshot;
* search history;
* view history;
* view count;
* Notification;
* Invitation;
* Application.

---

# 9. Transaction / Atomicity Requirements

> V14 không bổ sung transaction/atomicity requirement mới.

Lý do:

* Candidate Search là read-only;
* Search không tạo persisted entity mới;
* Filter không tạo persisted entity mới;
* Preview không tạo persisted entity mới;
* không có cross-document business mutation mới thuộc V14;
* không có partial persisted state mới cần rollback.

Các lifecycle mutation của:

* Candidate CV;
* Candidate User;
* Recruiter;
* Company Member;
* Company;
* Recruitment Team;

tiếp tục sử dụng transaction/atomicity contract của version sở hữu transition đó.

V14 không nâng mức bảo đảm của các transition trước chỉ vì Candidate Search đọc dữ liệu của chúng.

Việc kiểm tra eligibility từ nhiều persisted resource không tự tạo requirement phải dùng distributed transaction hoặc exactly-once mechanism.

V14 không có external side effect thuộc atomic completion.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema chỉ bảo vệ các constraint local mà persisted document có đủ context để xác định.

| Constraint                                           | Owner                   | Lý do                        |
| ---------------------------------------------------- | ----------------------- | ---------------------------- |
| `CandidateCV.sourceType` thuộc `GENERATED/UPLOADED`  | Schema                  | Local enum                   |
| `CandidateCV.visibility` thuộc `PRIVATE/PUBLIC`      | Schema                  | Local enum                   |
| `CandidateCV.status` thuộc `DRAFT/ACTIVE`             | Schema                  | Local enum                   |
| `GENERATED` phải có Generated lifecycle state hợp lệ | Schema/local validation | Cùng CandidateCV document    |
| `UPLOADED` phải persist `status = ACTIVE`            | Schema/local validation | Persistence normalization V7 |
| `archivedAt` là Date hoặc null                       | Schema                  | Local type                   |
| Reference field có đúng type                         | Schema                  | Structural constraint        |
| Field array có đúng structural type                  | Schema                  | Structural constraint        |
| Index Candidate Search                               | Database                | Query support                |
| Index Recruitment Team membership                    | Database                | Authorization lookup support |

Database không tự xác định Candidate Search business eligibility toàn phần.

---

## 10.2. Service bảo vệ

| Constraint                                                        | Owner                         | Lý do                         |
| ----------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| Candidate owner phải là Candidate                                 | Service                       | Cần đọc `User`                |
| Candidate phải `ACTIVE`                                           | Service                       | Cross-document                |
| Candidate phải verified email                                     | Service                       | Cross-document                |
| Recruiter account phải hoạt động                                  | Service                       | Authorization                 |
| CompanyMember phải là Recruiter hợp lệ                            | Service                       | Cross-document authorization  |
| CompanyMember phải active/hợp lệ                                  | Service                       | Cross-document                |
| Company phải hoạt động                                            | Service                       | Cross-document                |
| Recruiter phải Primary/Supporting của ít nhất một Job             | Service                       | Cross-document                |
| Job membership phải thuộc canonical Company của Recruiter         | Service                       | Tenant boundary               |
| Generated search eligibility phải yêu cầu `ACTIVE`                | Service                       | Business eligibility          |
| Uploaded search eligibility không được yêu cầu Generated `status` | Service                       | Product lifecycle distinction |
| CV phải `PUBLIC` và chưa Archive                                  | Service                       | Business eligibility          |
| FIELD filter phải bao gồm POSITION con                            | Service                       | Category hierarchy            |
| AND giữa các filter group                                         | Service                       | Functional rule               |
| OR trong cùng filter group                                        | Service                       | Functional rule               |
| Missing optional metadata không match khi group đó được filter    | Service                       | Functional rule               |
| Không suy đoán metadata từ CV content                             | Service                       | Functional rule               |
| Preview phải re-check eligibility hiện tại                        | Service                       | Authorization                 |
| Không Preview CV PRIVATE/archived/ineligible                      | Service                       | Authorization                 |
| Candidate Search không được Download                              | Service / authorization layer | Product boundary              |

Không persist một boolean chỉ để thay thế các cross-document rule trên.

---

# 11. Token / TTL Lifecycle

> V14 không bổ sung token/TTL persistence mới.

Candidate Search không tạo:

* access token riêng;
* preview token persisted riêng;
* search session token;
* temporary invitation token.

Nếu cơ chế Preview của loại file hiện có sử dụng technical temporary delivery mechanism, cơ chế đó không làm phát sinh business token lifecycle mới trong V14 trừ khi một canonical contract khác quy định.

---

# 12. Multi-tenant Data Boundary

V14 liên quan Company đối với **Recruiter authorization**, nhưng Candidate CV không thuộc tenant Company.

### Canonical tenant key

Tenant của Recruiter được resolve từ:

```text
Authenticated Recruiter User
↓
CompanyMember.userId
↓
CompanyMember.companyId
↓
Company
```

Canonical Company identity là Company được resolve từ persisted membership đáng tin cậy.

Không sử dụng một `companyId` tùy ý làm authorization source.

---

### Resource ownership

| Resource         | Owner / Tenant owner                         | Cách xác định                      |
| ---------------- | -------------------------------------------- | ---------------------------------- |
| `CandidateCV`    | Candidate `User`, không thuộc Company tenant | `candidateUserId`                  |
| `CompanyMember`  | Company                                      | `companyId`                        |
| `Job`            | Company                                      | canonical Job company relationship |
| `Category`       | Platform catalog                             | global catalog                     |
| `ExperienceLevel`| Platform fixed dataset                       | global persisted dataset           |

Location, EmploymentType và WorkMode là fixed vocabularies canonical V4/V7,
không phải resource/tenant-owned collection.

CandidateCV không có:

```text
companyId
tenantId
recruiterId
```

---

### Recruiter authorization resolution

```text
Authenticated User
↓
resolve active Recruiter CompanyMember
↓
resolve canonical Company
↓
verify Company eligibility
↓
verify Primary/Supporting membership trên ít nhất một Job của Company
↓
Recruiter Candidate Search eligibility
```

Sau khi Recruiter đủ điều kiện, Candidate Search đọc platform-wide pool của các Candidate CV search-eligible.

CV PUBLIC không bị partition theo Company.

Recruiter hợp lệ của hai Company khác nhau có thể cùng tìm thấy một Candidate CV PUBLIC nếu cả hai đều đủ eligibility riêng.

Search hoặc Preview không tạo Company ownership trên CV.

---

# 13. Snapshot / Historical Data

> V14 không bổ sung snapshot hoặc historical persistence mới.

Search và Preview luôn đọc current Candidate CV.

Không tạo:

```text
CandidateSearchSnapshot
CandidateCvPreviewSnapshot
CandidateCvViewHistory
```

Application snapshot đã tồn tại từ version trước giữ nguyên lifecycle riêng.

Nếu Candidate CV gốc sau này:

* đổi `PUBLIC → PRIVATE`;
* được Archive;
* thay đổi content;

các historical Application snapshot đã tồn tại không bị thay đổi bởi V14.

Nguyên tắc:

```text
Application submitted CV snapshot
!=
current CandidateCV
```

Candidate Search không rewrite historical snapshot.

---

# 14. Explicitly Excluded Persistence

V14 chủ động **KHÔNG thêm**:

```text
CandidateCV.deletedAt
CandidateCV.jobId
CandidateCV.companyId
CandidateCV.recruiterCompanyMemberId
CandidateCV.viewedByRecruiterIds
CandidateCV.viewedByCompanyIds
CandidateCV.invitationId
CandidateCV.applicationId
CandidateCV.conversationId
CandidateCV.searchEligible
```

Không thêm vào `Job`, `CompanyMember` hoặc `User`:

```text
candidateSearchEnabled
canSearchCandidates
searchPermission
```

Không thêm collection:

```text
CandidateSearch
CandidateSearchResult
CandidateSearchFilter
CandidateSearchPermission
CandidateSearchSession
CandidateSearchHistory
CandidateCvView
CandidateCvViewHistory
```

Không thêm:

```text
Skill
```

chỉ để thay `CandidateCV.skillTags`.

Không denormalize vào `CandidateCV`:

```text
candidateStatus
candidateEmailVerified
companyId
recruiterEligibility
```

Không thêm persistence cho:

* keyword search;
* full-text index chỉ để implement requirement chưa có;
* relevance score;
* AI matching;
* Saved Search;
* view count;
* search analytics;
* Candidate notification;
* Preview snapshot;
* Job Invitation;
* Source Recruiter;
* Application;
* Conversation;
* Notification;
* realtime state.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

V14 phải giữ Candidate CV lifecycle trước đó.

Đặc biệt:

```text
GENERATED
→ DRAFT / ACTIVE lifecycle
```

```text
UPLOADED
→ không có GENERATED DRAFT / ACTIVE lifecycle
→ persist status = ACTIVE như normalization kế thừa V7
```

Persisted `ACTIVE` của Uploaded không có Generated lifecycle meaning và không
được dùng làm Uploaded search-eligibility predicate.

---

## 15.2. Persistence behavior phải giữ

* Candidate vẫn sở hữu nhiều CV.
* `defaultCandidateCvId` tiếp tục có semantics cũ.
* Archive tiếp tục là Archive.
* Visibility tiếp tục là `PUBLIC/PRIVATE`.
* Generated content giữ representation trước.
* Uploaded file giữ representation trước.
* ExperienceLevel giữ reference trước.
* Location/EmploymentType/WorkMode giữ fixed-vocabulary representation trước.
* Skill tags giữ dạng metadata hiện có.
* Application snapshot giữ historical truth riêng.
* Recruitment Team tiếp tục là nguồn Primary/Supporting canonical.

---

## 15.3. Thay đổi được phép

V14 được phép:

* bổ sung CandidateCV indexes cho Search/Filter;
* bổ sung Job indexes cho Recruitment Team membership lookup;
* làm rõ source-specific semantics của `CandidateCV.status` mà không đổi representation V7;
* sử dụng existing Category hierarchy cho filter FIELD/POSITION.

---

## 15.4. Thay đổi không được phép

V14 không được:

* thêm Soft Delete lifecycle;
* thêm `deletedAt`;
* dùng persisted `status = ACTIVE` làm Uploaded search-eligibility predicate;
* biến `PUBLIC ⇒ ACTIVE`;
* thêm Company ownership cho CandidateCV;
* thêm Job relationship cho CandidateCV;
* persist Search eligibility;
* persist Recruiter Search permission;
* thay đổi Application snapshot;
* tạo Invitation/Application từ Search hoặc Preview.

---

# 16. Persistence Invariants

| #  | Persistence invariant                                                                       | Enforcement owner             |
| -- | ------------------------------------------------------------------------------------------- | ----------------------------- |
| 1  | Mỗi CandidateCV có một Candidate owner                                                      | Schema + Service              |
| 2  | `sourceType` chỉ là `GENERATED` hoặc `UPLOADED`                                             | Schema                        |
| 3  | `GENERATED` sử dụng `DRAFT/ACTIVE` lifecycle                                                | Schema + Service              |
| 4  | `UPLOADED` persist `status = ACTIVE` như normalization V7, không có Generated lifecycle      | Schema/local validation       |
| 5  | `GENERATED/DRAFT/PUBLIC` là persisted state hợp lệ nhưng không search-eligible              | Service                       |
| 6  | Uploaded eligibility không dùng persisted status ACTIVE làm business predicate              | Service                       |
| 7  | CV Archive không search-eligible                                                            | Service                       |
| 8  | CV PRIVATE không search-eligible                                                            | Service                       |
| 9  | Candidate status/email verification không được denormalize để thay thế canonical User state | Data Contract + Service       |
| 10 | Search eligibility không được persist thành field                                           | Data Contract                 |
| 11 | Recruiter Search permission không được persist thành boolean quyền                          | Data Contract + Service       |
| 12 | CandidateCV không thuộc Company tenant                                                      | Data Contract                 |
| 13 | CandidateCV không có direct Job/Recruiter ownership reference                               | Data Contract                 |
| 14 | Một Candidate có thể có nhiều CandidateCV cùng search-eligible                              | Service                       |
| 15 | Filter metadata luôn thuộc từng CandidateCV riêng                                           | Service                       |
| 16 | FIELD/POSITION hierarchy được resolve từ canonical Category data                            | Service                       |
| 17 | Search/Preview không tạo persisted state mới                                                | Service                       |
| 18 | Preview không tạo snapshot/history                                                          | Data Contract + Service       |
| 19 | Application historical snapshot không thay đổi khi CandidateCV thay đổi                     | Existing Application contract |
| 20 | V14 không có `deletedAt` trên CandidateCV                                                   | Schema/Data Contract          |

---

# 17. Definition of Data Completion

V14 Data Contract được coi là hoàn thành khi:

* không có collection mới ngoài requirement;
* CandidateCV fields phản ánh đúng lifecycle Product Spec;
* Generated và Uploaded CV được phân biệt đúng về persistence state;
* Uploaded CV giữ persisted `status = ACTIVE` từ V7 nhưng eligibility không phụ thuộc status;
* `deletedAt` không được thêm;
* CandidateCV ownership được xác định;
* CandidateCV metadata relationships được xác định;
* Candidate Search indexes được xác định;
* Job authorization indexes được xác định;
* eligibility được xác định là derived state, không persisted state;
* Category hierarchy được reuse;
* State Matrix phản ánh đúng Generated/Uploaded distinction;
* Search/Filter/Preview không tạo persistence mutation;
* không có transaction requirement mới ngoài business need;
* schema/database constraint và service constraint được phân biệt;
* Company tenant boundary cho Recruiter authorization được xác định;
* CandidateCV được giữ ngoài Company ownership;
* không có Preview snapshot hoặc view history;
* compatibility với Candidate CV Library và Application snapshot được giữ;
* toàn bộ Explicitly Excluded Persistence không bị thêm ngoài ý muốn.

Data Completion không có nghĩa schema hoặc index đã được code.

Nó có nghĩa persistence contract đủ rõ để implementation không phải tự suy đoán lifecycle hoặc data ownership quan trọng.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract của V14**.

Nó định nghĩa:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT V14 PRODUCT CONTRACT
```

Bao gồm:

* entity/collection;
* field responsibility;
* conditional persisted state;
* reference;
* relationship;
* cardinality;
* index;
* derived state boundary;
* persistence transition;
* transaction boundary;
* data ownership;
* tenant relationship;
* persistence invariant;
* explicitly excluded persistence.

Tài liệu này không định nghĩa:

* REST endpoint;
* HTTP method;
* status code;
* request/response DTO;
* controller;
* route;
* middleware implementation;
* service function structure;
* database query cụ thể;
* aggregation cụ thể;
* source-code structure;
* frontend behavior;
* test framework.

Thứ tự authority:

```text
Approved V14 Product Specification
        │
        │ business truth
        ↓
V14 Data Contract
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture truth
        ↓
Implementation
```

Macro database và entity diagram là input thiết kế.

Nếu macro hoặc diagram chứa giả thuyết như:

```text
CandidateCV.deletedAt
```

hoặc giả định mọi CandidateCV dùng chung business lifecycle
`DRAFT/ACTIVE`

thì giả thuyết đó không được đưa vào implementation khi nó trái Product Specification và Data Contract canonical này.
