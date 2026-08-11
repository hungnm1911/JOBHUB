# V6 — Recruitment Team và chuyển giao trách nhiệm Data Model

> **File:** `docs/data/versions/v6-recruitment-team-responsibility-transfer-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v6-recruitment-team-responsibility-transfer.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v6-recruitment-team-responsibility-transfer.md
```

Product Specification V6 là authority đối với business behavior.

Data Contract này xác định:

* dữ liệu Recruitment Team nào cần được persist;
* entity/collection chịu trách nhiệm lưu Primary và Supporting Recruiter;
* relationship giữa Job, Company, CompanyMember và User;
* field bổ sung trong V6;
* constraint cấu trúc của Recruitment Team;
* index phục vụ lookup bắt buộc của V6;
* representation của Job state và team position;
* persistence transition khi team thay đổi;
* atomicity requirement của team mutation;
* persistence guard giữa Recruitment Team và lifecycle lock/terminate Recruiter;
* boundary giữa constraint do schema/database bảo vệ và constraint do service bảo vệ;
* multi-tenant/data ownership;
* historical persistence của team trên Job đã kết thúc;
* các field/collection chủ động không thêm.

Data Contract này không thay đổi hoặc mở rộng business behavior đã được Product Specification V6 định nghĩa.

---

## 2. Thay đổi so với version trước

V6 kế thừa persistence baseline của V5 và chỉ mở rộng dữ liệu Recruitment Team cần thiết.

| Entity / Collection | Trạng thái  | Mô tả                                                         |
| ------------------- | ----------- | ------------------------------------------------------------- |
| `jobs`              | `UPDATED`   | Bổ sung danh sách Supporting Recruiter                        |
| `company_members`   | `UNCHANGED` | Tiếp tục là identity/membership được Job tham chiếu           |
| `users`             | `UNCHANGED` | Tiếp tục cung cấp account status và `mustChangePassword`      |
| `companies`         | `UNCHANGED` | Tiếp tục cung cấp tenant ownership và Company lifecycle state |

### 2.1. Entity mới

Không có entity/collection mới.

V6 không tạo:

```text
recruitment_teams
job_recruitment_members
```

---

### 2.2. Entity được mở rộng

#### `jobs`

Bổ sung:

```text
supportingRecruiterCompanyMemberIds[]
```

Field Primary Recruiter đã tồn tại từ V5 tiếp tục được giữ nguyên.

Không di chuyển Primary sang một object hoặc collection mới.

---

### 2.3. Entity giữ nguyên nhưng được sử dụng

* `company_members`
* `users`
* `companies`

V6 không thay đổi schema các entity này chỉ để phục vụ Recruitment Team.

---

### 2.4. Điều chỉnh compatibility với V5

V6 giữ nguyên khả năng **partial persistence của Job `DRAFT`** từ V5.

Do đó:

```text
applicationDeadline
```

không được trở thành field global-required chỉ vì V6 sử dụng deadline để xác định effective expiration.

Canonical contract:

```text
DRAFT
→ applicationDeadline có thể chưa tồn tại

DRAFT → PENDING_APPROVAL
→ applicationDeadline bắt buộc phải tồn tại và hợp lệ
```

V6 không thay đổi completeness rule của V5.

---

## 3. Collection / Entity tổng thể

V6 sử dụng:

```text
jobs
company_members
users
companies
```

Vai trò:

| Entity / Collection | Responsibility                                                                    |
| ------------------- | --------------------------------------------------------------------------------- |
| `jobs`              | Lưu ownership của Job, creator history, Primary hiện tại và Supporting Recruiters |
| `company_members`   | Lưu membership của Company Manager/Recruiter trong Company                        |
| `users`             | Lưu account identity, account lifecycle state và mandatory password-change state  |
| `companies`         | Lưu tenant identity và Company lifecycle state                                    |

Không tạo thêm collection ngoài danh sách này cho requirement của V6.

Không tạo collection chỉ để chuẩn bị cho Application, Invitation hoặc team history ở version sau.

---

## 4. Quan hệ dữ liệu

### 4.1. Company → Job

**Cardinality**

```text
Company 1 ───── N Job
```

**Owner**

`Job`

**Reference**

```text
Job.companyId
```

**Constraint**

* mỗi Job thuộc đúng một Company;
* Company là tenant owner của Job;
* thay Primary hoặc Supporting không thay đổi `companyId`.

**Lifecycle**

Relationship tồn tại trong toàn bộ lifecycle của Job.

---

### 4.2. Company → CompanyMember

**Cardinality**

```text
Company 1 ───── N CompanyMember
```

**Owner**

`CompanyMember`

**Reference**

```text
CompanyMember.companyId
```

**Constraint**

CompanyMember được dùng làm Recruiter trong team phải thuộc cùng Company với Job.

---

### 4.3. User → CompanyMember

**Cardinality hiện tại**

```text
User 1 ───── 0..1 CompanyMember
```

**Owner**

`CompanyMember`

**Reference**

```text
CompanyMember.userId
```

V6 không thay đổi relationship này.

V6 cũng không sử dụng relationship này để tạo requirement mới về multi-company membership ngoài contract đã tồn tại trước V6.

---

### 4.4. Job → người tạo Job

**Cardinality**

```text
CompanyMember 1 ───── 0..N Job
```

**Owner**

`Job`

**Reference**

```text
Job.createdByCompanyMemberId
```

**Constraint**

* required;
* biểu diễn historical creator;
* không thay đổi khi Primary thay đổi;
* không bị xóa khỏi Job chỉ vì Recruiter sau đó bị lock hoặc terminate.

`createdByCompanyMemberId` không đồng nghĩa Recruiter đó hiện còn thuộc Recruitment Team.

---

### 4.5. Job → Primary Recruiter

**Cardinality**

```text
CompanyMember 1 ───── 0..N Job
```

Nhìn từ Job:

```text
Job N ───── 1 Primary CompanyMember
```

**Owner**

`Job`

**Reference**

```text
Job.primaryRecruiterCompanyMemberId
```

**Constraint**

* required;
* mỗi Job có đúng một Primary;
* Primary không được đồng thời xuất hiện trong Supporting;
* khi được giao active responsibility, CompanyMember phải là Recruiter hợp lệ cùng Company.

**Lifecycle**

Field không bị remove khi Job chuyển sang `CLOSED` hoặc `EXPIRED`.

Sau khi Job kết thúc, reference được giữ làm historical team information và không còn tự chứng minh operational eligibility.

---

### 4.6. Job → Supporting Recruiters

**Cardinality**

```text
Job N ───── N CompanyMember
```

**Owner**

`Job`

**Reference**

```text
Job.supportingRecruiterCompanyMemberIds[]
```

**Constraint**

* cardinality `0..N`;
* không duplicate;
* không chứa Primary hiện tại;
* mỗi active Supporting phải là Recruiter hợp lệ cùng Company khi được giao/tiếp tục responsibility.

**Lifecycle**

Field được giữ trên Job `CLOSED` hoặc `EXPIRED` để bảo toàn historical team information.

Historical reference không tự cấp active authorization.

---

## 5. `jobs`

### 5.1. Responsibility

Trong phạm vi V6, `jobs` chịu trách nhiệm lưu:

* Company sở hữu Job;
* historical creator;
* Primary Recruiter hiện tại hoặc historical Primary cuối cùng;
* Supporting Recruiters hiện tại hoặc historical Supporting cuối cùng;
* Job lifecycle state từ V5;
* application deadline dùng cho effective expiration.

`jobs` không chịu trách nhiệm lưu:

* User account state;
* CompanyMember state;
* Company lifecycle state;
* Application assignment;
* Invitation responsibility;
* team membership history;
* transfer history;
* custom permission của Supporting.

---

### 5.2. Fields

Các field liên quan trực tiếp đến V6:

| Field                                 | Type         |              Required | Default   | Constraint                          | Ý nghĩa                                                 |
| ------------------------------------- | ------------ | --------------------: | --------- | ----------------------------------- | ------------------------------------------------------- |
| `_id`                                 | `ObjectId`   |                   YES | generated | unique                              | Định danh Job                                           |
| `companyId`                           | `ObjectId`   |                   YES | —         | reference `Company`                 | Tenant owner                                            |
| `createdByCompanyMemberId`            | `ObjectId`   |                   YES | —         | reference `CompanyMember`           | Historical creator                                      |
| `primaryRecruiterCompanyMemberId`     | `ObjectId`   |                   YES | —         | reference `CompanyMember`           | Primary hiện tại / historical Primary trên Job kết thúc |
| `supportingRecruiterCompanyMemberIds` | `ObjectId[]` |                   YES | `[]`      | unique elements; không chứa Primary | Supporting Recruiters                                   |
| `status`                              | `String`     |                   YES | `DRAFT`   | Job enum từ V5                      | Persisted Job lifecycle state                           |
| `applicationDeadline`                 | `Date`       | NO ở schema tổng quát | —         | required trước submit theo V5       | Deadline và effective expiration                        |
| `createdAt`                           | `Date`       |                   YES | automatic | —                                   | Thời điểm tạo                                           |
| `updatedAt`                           | `Date`       |                   YES | automatic | —                                   | Thời điểm cập nhật                                      |

Các field nội dung Job khác của V5 giữ nguyên và không được thay đổi bởi V6.

---

### 5.3. Enum

#### `status`

V6 giữ nguyên enum của V5:

```text
DRAFT
PENDING_APPROVAL
PUBLISHED
CLOSED
EXPIRED
```

V6 không thêm:

```text
CHANGES_REQUESTED
REJECTED
```

Effective expiration không được biểu diễn bằng một state hoặc boolean V6 mới.

Nếu:

```text
status = PUBLISHED
AND
now >= applicationDeadline
```

service phải xử lý Job như đã expired đối với business decision của V6 dù persisted `status` chưa được chuyển thành `EXPIRED`.

---

### 5.4. Indexes

V6 bổ sung các index trực tiếp phục vụ việc tìm các Job mà Recruiter đang giữ responsibility, đặc biệt trước lock/terminate.

| Index                                                                           | Loại                | Mục đích                                               |
| ------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| `{ primaryRecruiterCompanyMemberId: 1, status: 1, applicationDeadline: 1 }`     | Compound            | Tìm Job chưa kết thúc nơi Recruiter đang là Primary    |
| `{ supportingRecruiterCompanyMemberIds: 1, status: 1, applicationDeadline: 1 }` | Compound / multikey | Tìm Job chưa kết thúc nơi Recruiter đang là Supporting |

Không tạo unique index trên:

```text
supportingRecruiterCompanyMemberIds
```

để cố bảo đảm các phần tử trong cùng một array không duplicate.

Uniqueness nội bộ của Supporting list là local-document constraint, không phải collection-level uniqueness.

Các index V5 khác tiếp tục giữ nguyên.

---

### 5.5. Embedded documents

> `Job` không bổ sung embedded document mới trong V6.

Recruitment Team không được bọc thành embedded object riêng chỉ để đổi cấu trúc V5.

---

### 5.6. Reference rules

| Field                                   | Reference       |             Required | Cardinality | Rule               |
| --------------------------------------- | --------------- | -------------------: | ----------- | ------------------ |
| `companyId`                             | `Company`       |                  YES | N → 1       | Tenant owner       |
| `createdByCompanyMemberId`              | `CompanyMember` |                  YES | N → 1       | Historical creator |
| `primaryRecruiterCompanyMemberId`       | `CompanyMember` |                  YES | N → 1       | Đúng một Primary   |
| `supportingRecruiterCompanyMemberIds[]` | `CompanyMember` | NO phần tử nếu empty | N ↔ N       | 0..N Supporting    |

Schema/reference type không đủ để chứng minh:

* referenced CompanyMember tồn tại;
* role là `RECRUITER`;
* cùng Company;
* đang `ACTIVE`;
* User đang `ACTIVE`;
* `mustChangePassword = false`;
* Company đang approved và operationally active.

Các constraint này thuộc service.

---

## 6. Các entity giữ nguyên nhưng liên quan trực tiếp

### 6.1. `company_members`

#### Responsibility V6 sử dụng

V6 sử dụng các field đã tồn tại:

```text
userId
companyId
role
status
```

Các giá trị business cần kiểm tra khi giao active responsibility:

```text
role = RECRUITER
status = ACTIVE
companyId = Job.companyId
```

#### Không bổ sung field

Không thêm:

```text
jobRole
recruitmentRole
isPrimaryRecruiter
isSupportingRecruiter
primaryJobIds
supportingJobIds
```

Team position được sở hữu bởi `Job`, không phải `CompanyMember`.

---

### 6.2. `users`

V6 sử dụng:

```text
status
mustChangePassword
```

Eligibility cần:

```text
status = ACTIVE
mustChangePassword = false
```

V6 không đưa Primary/Supporting vào account role.

Không sao chép `User.status` hoặc `mustChangePassword` sang Job.

---

### 6.3. `companies`

V6 sử dụng:

```text
approvalStatus
operationalStatus
```

Eligibility cần:

```text
approvalStatus = APPROVED
operationalStatus = ACTIVE
```

Không sao chép Company lifecycle state sang Job.

---

# 7. State Matrix

V6 có nhiều state dimension:

* persisted Job status;
* effective expiration;
* Recruitment Team references;
* operational eligibility của referenced Recruiter.

### 7.1. Job state và ý nghĩa team reference

| Persisted Job state | Deadline condition            | Primary / Supporting reference     | Ý nghĩa persistence                                                  |
| ------------------- | ----------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `DRAFT`             | Có thể chưa có deadline       | exactly 1 Primary, 0..N Supporting | Active Job; normal team mutation bị cấm, forced transfer được phép   |
| `PENDING_APPROVAL`  | Deadline phải tồn tại theo V5 | exactly 1 Primary, 0..N Supporting | Active Job; normal team mutation bị cấm, forced transfer được phép   |
| `PUBLISHED`         | `now < deadline`              | exactly 1 Primary, 0..N Supporting | Active Recruitment Team                                              |
| `PUBLISHED`         | `now >= deadline`             | exactly 1 Primary, 0..N Supporting | Effective expired; reference được xem như historical cho V6 mutation |
| `CLOSED`            | —                             | exactly 1 Primary, 0..N Supporting | Historical Recruitment Team                                          |
| `EXPIRED`           | —                             | exactly 1 Primary, 0..N Supporting | Historical Recruitment Team                                          |

V6 không yêu cầu xóa team references khi Job kết thúc.

---

### 7.2. Operational eligibility và historical reference

| Job                            | Recruiter state hiện tại               |   Reference được phép tồn tại? | Có thể nhận/tiếp tục active responsibility? |
| ------------------------------ | -------------------------------------- | -----------------------------: | ------------------------------------------: |
| Chưa kết thúc                  | Eligible                               |                            YES |                                         YES |
| Chưa kết thúc                  | `LOCKED` / `TERMINATED` sau completion | NO theo V6 lifecycle invariant |                                          NO |
| `CLOSED` / effective `EXPIRED` | Eligible                               |                            YES |             Không còn active responsibility |
| `CLOSED` / effective `EXPIRED` | `LOCKED` / `TERMINATED`                |                            YES |                                       Không |

Historical validity không phụ thuộc việc Recruiter hiện tại còn ACTIVE.

---

# 8. Persistence Transitions

## 8.1. Khởi tạo Recruitment Team khi tạo Job

### Trigger business

* `BR-07` — Người tạo Job là Primary mặc định;
* kế thừa business transition tạo Job từ V5.

### Trước

Không có Job.

### Sau

```text
Job
companyId = canonical Company
createdByCompanyMemberId = creator
primaryRecruiterCompanyMemberId = creator
supportingRecruiterCompanyMemberIds = []
status = DRAFT
applicationDeadline = optional
```

### Các entity bị thay đổi

* `jobs`

### Invariant cần giữ

* creator là Recruiter hợp lệ theo V5;
* creator và Primary ban đầu là cùng CompanyMember;
* exactly one Primary;
* Supporting empty lúc khởi tạo.

---

## 8.2. Thêm Supporting Recruiter

### Trigger business

`F02`

### Trước

```text
targetMemberId ∉ supportingRecruiterCompanyMemberIds
targetMemberId != primaryRecruiterCompanyMemberId
```

### Sau

```text
supportingRecruiterCompanyMemberIds
= previousSupportingIds + targetMemberId
```

### Entity bị thay đổi

* `jobs`

### Entity không thay đổi

* `users`
* `company_members`
* `companies`
* `createdByCompanyMemberId`
* `primaryRecruiterCompanyMemberId`
* Job content
* Job status

### Invariant cần giữ

* no duplicate;
* Primary không nằm trong Supporting;
* target cùng tenant;
* target đủ operational eligibility;
* Job effectively `PUBLISHED` trong normal flow.

---

## 8.3. Xóa Supporting Recruiter

### Trigger business

`F03`

### Trước

```text
targetMemberId ∈ supportingRecruiterCompanyMemberIds
```

### Sau

```text
targetMemberId ∉ supportingRecruiterCompanyMemberIds
```

### Entity bị thay đổi

* `jobs`

### Invariant cần giữ

* Primary không thay đổi;
* Recruiter chỉ rời team sau khi responsibility cần thiết đã được chuyển giao;
* historical creator/data không bị xóa.

V6 chưa có persistence object Application/Invitation nên không thêm cross-collection transition cho các responsibility này.

---

## 8.4. Thay Primary — giữ Primary cũ làm Supporting

### Trigger business

`F04`

### Trước

```text
primaryRecruiterCompanyMemberId = oldPrimary

newPrimary ∈ supportingRecruiterCompanyMemberIds
```

### Sau

```text
primaryRecruiterCompanyMemberId = newPrimary

supportingRecruiterCompanyMemberIds:
- remove newPrimary
- add oldPrimary
```

### Entity bị thay đổi

* `jobs`

### Invariant cần giữ

```text
exactly one Primary
Primary ∉ Supporting
Supporting unique
```

`createdByCompanyMemberId` không thay đổi.

---

## 8.5. Thay Primary — Primary cũ rời team

### Trigger business

`F04`

### Trước

```text
primaryRecruiterCompanyMemberId = oldPrimary

newPrimary ∈ supportingRecruiterCompanyMemberIds
```

### Sau

```text
primaryRecruiterCompanyMemberId = newPrimary

supportingRecruiterCompanyMemberIds:
- remove newPrimary
- do not add oldPrimary
```

### Invariant cần giữ

* exactly one Primary;
* old Primary không còn trong active team;
* old Primary không còn responsibility chưa chuyển giao;
* Primary mới không còn Supporting.

---

## 8.6. Forced transfer khi replacement đã là Supporting

### Trigger business

`F05`

### Trước

```text
oldPrimary = recruiter sắp bị LOCKED/TERMINATED
replacement ∈ supportingRecruiterCompanyMemberIds
```

### Sau

```text
primaryRecruiterCompanyMemberId = replacement

supportingRecruiterCompanyMemberIds:
- remove replacement
- oldPrimary không được thêm lại
```

### Invariant cần giữ

* replacement đủ eligibility;
* old Primary → `NONE`;
* old Primary không trở thành Supporting;
* Job vẫn có đúng một Primary.

---

## 8.7. Forced transfer khi replacement đang ở `NONE`

### Trigger business

`F05`, forced-transfer exception.

Business transition:

```text
NONE
→ SUPPORTING_RECRUITER
→ PRIMARY_RECRUITER
```

Persistence không bắt buộc phải commit một intermediate document riêng chỉ để biểu diễn bước `SUPPORTING_RECRUITER`.

Canonical persisted result có thể hoàn tất trực tiếp thành:

```text
primaryRecruiterCompanyMemberId = replacement

replacement ∉ supportingRecruiterCompanyMemberIds
oldPrimary ∉ supportingRecruiterCompanyMemberIds
```

miễn toàn bộ điều kiện nghiệp vụ của forced flow đã được kiểm tra và operation trên Job được hoàn tất atomically.

Điều này không thay đổi business rule rằng replacement được đưa qua Supporting trong forced-transfer flow; nó chỉ tránh yêu cầu một intermediate persisted state không cần thiết.

---

## 8.8. Forced removal của Supporting trước lock/terminate

### Trước

```text
recruiterId ∈ supportingRecruiterCompanyMemberIds
```

### Sau

```text
recruiterId ∉ supportingRecruiterCompanyMemberIds
```

Primary không thay đổi.

Operation có thể được thực hiện lần lượt trên từng Job chưa kết thúc mà Recruiter đang Supporting.

---

## 8.9. Unlock Recruiter

Unlock không thay đổi `jobs`.

Không có persistence transition tự động:

```text
NONE → previous team position
```

Team state sau forced transfer được giữ nguyên.

---

## 8.10. Job kết thúc

Khi Job trở thành:

```text
CLOSED
hoặc
EXPIRED
```

V6 giữ nguyên:

```text
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds[]
```

Các field này chuyển ý nghĩa từ active team reference sang historical team reference.

V6 không tạo team archive object hoặc snapshot riêng.

---

# 9. Transaction / Atomicity Requirements

## TX-01 — Atomicity của Recruitment Team mutation trên một Job

**Business source**

* `F02`
* `F03`
* `F04`
* `F05`
* `BR-02`
* `BR-04`
* `BR-22`

Mọi mutation làm thay đổi:

```text
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds
```

trên cùng một Job phải được hoàn tất như **một atomic persistence mutation của Job đó**.

Bao gồm:

* add Supporting;
* remove Supporting;
* replace Primary;
* swap old/new Primary;
* forced Primary transfer;
* forced Supporting removal.

Sau khi mutation hoàn tất phải đảm bảo:

```text
exactly one Primary
AND
Primary ∉ Supporting
AND
Supporting unique
```

Không được xuất hiện persisted intermediate state:

```text
Job không có Primary
```

hoặc:

```text
old Primary và new Primary cùng được biểu diễn là Primary
```

hoặc:

```text
new Primary vẫn đồng thời nằm trong Supporting
```

Vì Primary và Supporting được persist trong cùng `Job`, V6 **không yêu cầu multi-document transaction** cho riêng các mutation này.

---

## TX-02 — Concurrency boundary giữa team assignment và lock/terminate completion

**Business source**

* `F05`
* `BR-23`
* `BR-27`

Persistence phải bảo đảm không thể commit kết quả cuối:

```text
Recruiter = LOCKED/TERMINATED
AND
Recruiter vẫn là Primary/Supporting
của Job chưa kết thúc
```

Một operation:

```text
add/promote Recruiter vào active team
```

và operation:

```text
hoàn tất LOCKED/TERMINATED cho chính Recruiter đó
```

không được đồng thời commit theo cách tạo ra tổ hợp persistence không hợp lệ trên.

Data Contract yêu cầu **concurrency-safe serialization hoặc atomic guard tương đương** giữa hai loại mutation này.

Data Contract không quy định cơ chế implementation cụ thể.

---

## TX-03 — Forced transfer nhiều Job không yêu cầu all-or-nothing toàn cục

V6 **không yêu cầu** toàn bộ transfer trên tất cả Job của một Recruiter phải rollback cùng nhau nếu một Job xử lý thất bại.

Ví dụ:

```text
Job A transfer thành công
Job B transfer thất bại
```

có thể giữ kết quả hợp lệ của Job A, miễn:

```text
Recruiter chưa được hoàn tất LOCKED/TERMINATED
```

cho đến khi toàn bộ active responsibility còn lại được xử lý.

Lý do:

* từng Job sau transfer vẫn ở persisted state hợp lệ;
* Recruiter vẫn còn ACTIVE nên chưa xuất hiện invariant violation;
* Product V6 yêu cầu ordering trước lock/terminate, không yêu cầu global all-or-nothing transfer của mọi Job.

Không nâng guarantee thành một transaction chứa toàn bộ Job chỉ để loại bỏ mọi partial-progress window.

---

## TX-04 — Không mở rộng atomicity sang external side effect

V6 không bổ sung external side effect thuộc atomic completion.

Data Contract này không yêu cầu:

* distributed transaction;
* exactly-once guarantee với SMTP;
* exactly-once guarantee với Cloudinary;
* external event delivery transaction.

Nếu lifecycle lock/terminate từ version trước có persisted state khác, các invariant/atomicity đã được canonical Data Contract của version đó quy định tiếp tục được giữ.

V6 không tự định nghĩa lại chúng.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema chỉ bảo vệ constraint có đủ local context.

| Constraint                                     | Owner                       | Lý do                            |
| ---------------------------------------------- | --------------------------- | -------------------------------- |
| `companyId` có đúng type/reference shape       | Schema                      | Structural validation            |
| `createdByCompanyMemberId` required            | Schema                      | Local field requirement          |
| `primaryRecruiterCompanyMemberId` required     | Schema                      | Exactly one stored Primary field |
| Supporting là array reference                  | Schema                      | Structural validation            |
| Supporting elements không duplicate            | Schema                      | Local Job-document invariant     |
| Primary không xuất hiện trong Supporting       | Schema                      | Local Job-document invariant     |
| `status` thuộc enum V5                         | Schema                      | Local enum validation            |
| Supporting mặc định `[]`                       | Schema                      | Canonical representation         |
| `applicationDeadline` có đúng type nếu tồn tại | Schema                      | Structural validation            |
| Job team mutation giữ local invariants         | Schema + atomic persistence | Cùng Job document                |

`applicationDeadline` không được global-required ở schema vì V5 cho phép partial `DRAFT`.

---

## 10.2. Service bảo vệ

| Constraint                                                              | Owner                                    | Lý do                        |
| ----------------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| CompanyMember tồn tại                                                   | Service                                  | Cross-document               |
| CompanyMember.role = `RECRUITER`                                        | Service                                  | Business role                |
| CompanyMember.status = `ACTIVE` khi nhận/tiếp tục active responsibility | Service                                  | Cross-document lifecycle     |
| CompanyMember.companyId = Job.companyId                                 | Service                                  | Tenant invariant             |
| User tồn tại                                                            | Service                                  | Cross-document               |
| User.status = `ACTIVE`                                                  | Service                                  | Account lifecycle            |
| `mustChangePassword = false`                                            | Service                                  | Operational eligibility      |
| Company tồn tại                                                         | Service                                  | Cross-document               |
| Company.approvalStatus = `APPROVED`                                     | Service                                  | Business lifecycle           |
| Company.operationalStatus = `ACTIVE`                                    | Service                                  | Business lifecycle           |
| actor có quyền add/remove/reassign                                      | Service                                  | Authorization                |
| Job effectively `PUBLISHED` trong normal flow                           | Service                                  | Cần persisted state + clock  |
| Primary mới đang là Supporting trong normal flow                        | Service + atomic Job mutation            | Business transition          |
| Recruiter không còn responsibility trước khi rời team                   | Service                                  | Cross-resource business rule |
| lock/terminate chỉ hoàn tất khi không còn active team responsibility    | Service + concurrency/atomicity boundary | Cross-document invariant     |
| Supporting chỉ read-only                                                | Service                                  | Authorization                |
| cross-tenant action bị từ chối                                          | Service                                  | Cần trusted relationship     |
| `applicationDeadline` required trước submit                             | Service/V5 transition validation         | State-dependent completeness |

Không ép schema tự kiểm tra trạng thái User, CompanyMember hoặc Company vì Job document không sở hữu các nguồn sự thật này.

---

# 11. Token / TTL Lifecycle

> V6 không bổ sung token/TTL persistence mới.

Các token/session lifecycle từ version trước không bị thay đổi bởi Data Contract V6.

---

# 12. Multi-tenant Data Boundary

### Canonical tenant key

```text
Job.companyId
```

Company là tenant owner của Job và Recruitment Team.

---

### Resource ownership

| Resource                  | Tenant owner      | Cách xác định           |
| ------------------------- | ----------------- | ----------------------- |
| `Job`                     | `Company`         | `Job.companyId`         |
| Primary responsibility    | `Company` của Job | Qua Job chứa Primary    |
| Supporting responsibility | `Company` của Job | Qua Job chứa Supporting |

Recruitment Team không có tenant identity độc lập ngoài Job.

---

### Backend tenant resolution

```text
Authenticated User
        ↓
trusted User ↔ CompanyMember relationship
        ↓
CompanyMember.companyId
        ↓
canonical Company
        ↓
Job.companyId
        ↓
authorized Recruitment Team scope
```

Các persistence rule:

1. Primary phải thuộc cùng Company với Job.
2. Supporting phải thuộc cùng Company với Job.
3. Company Manager chỉ quản lý Job thuộc Company của mình.
4. `companyId` do client gửi lên không tự chứng minh tenant authorization.
5. Recruiter identifier do client gửi lên không tự chứng minh Recruiter thuộc đúng Company.
6. Thay Primary không thay `Job.companyId`.
7. Remove/terminate Recruiter không làm thay ownership của Job.
8. Cross-tenant team reference không được tồn tại trong canonical persisted state.

---

# 13. Snapshot / Historical Data

V6 không bổ sung snapshot collection hoặc historical document riêng.

Thay vào đó, Data Contract chọn giữ trực tiếp:

```text
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds[]
```

trên Job sau khi Job kết thúc.

### Historical semantics

Khi Job:

```text
CLOSED
EXPIRED
effective EXPIRED
```

team references không còn được hiểu là active operational eligibility.

Thay đổi sau đó của:

* User status;
* CompanyMember status;
* Recruiter employment/access status

không làm historical Job trở thành invalid.

### `createdBy`

`createdByCompanyMemberId` tiếp tục được giữ độc lập với team.

Một creator có thể:

* vẫn là Primary;
* trở thành Supporting;
* rời team;
* bị lock;
* bị terminate

mà historical creator identity không thay đổi.

---

# 14. Explicitly Excluded Persistence

V6 chủ động **không thêm**:

```text
recruitment_teams collection
job_recruitment_members collection
recruitment_team_history collection
responsibility_transfer_history collection
```

Không thêm vào `CompanyMember`:

```text
jobRole
recruitmentRole
isPrimaryRecruiter
isSupportingRecruiter
primaryJobIds
supportingJobIds
```

Không thêm vào `User`:

```text
isPrimaryRecruiter
isSupportingRecruiter
primaryJobIds
supportingJobIds
```

Không thêm metadata membership như:

```text
joinedAt
addedAt
addedBy
removedAt
removedBy
membershipStatus
teamPermission
```

Không thêm:

* Application assignment fields;
* Invitation responsibility fields;
* Source Recruiter fields;
* Candidate responsibility;
* Chat ownership;
* Interview ownership;
* workload counters;
* auto-restore team data;
* team-change notification persistence;
* speculative audit fields.

Không sao chép vào Job:

```text
User.status
CompanyMember.status
Company.approvalStatus
Company.operationalStatus
mustChangePassword
```

Các nguồn sự thật đó tiếp tục thuộc entity gốc.

Không thêm state:

```text
CHANGES_REQUESTED
REJECTED
TEAM_ACTIVE
TEAM_INACTIVE
TRANSFER_PENDING
```

chỉ để tiện implementation.

Không thêm field:

```text
isExpired
effectiveStatus
```

để duplicate effective expiration rule của V5.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

V6 phải tiếp tục giữ:

* mỗi Job thuộc đúng một Company;
* `createdBy` không thay đổi;
* người tạo Job là Primary mặc định;
* `DRAFT` hỗ trợ partial persistence;
* submit yêu cầu Job complete;
* Job lifecycle V5 không đổi;
* `PUBLISHED` sau deadline được xử lý effectively `EXPIRED`;
* reject không tạo persisted `REJECTED`;
* không có `CHANGES_REQUESTED`;
* Job published immutable theo V5;
* Company ownership không thay đổi khi Recruiter thay đổi.

---

## 15.2. Persistence behavior phải giữ

Các field V5:

```text
companyId
createdByCompanyMemberId
primaryRecruiterCompanyMemberId
status
applicationDeadline
```

tiếp tục giữ canonical meaning đã có.

Không đổi tên hoặc chuyển `primaryRecruiterCompanyMemberId` sang structure khác trong V6.

`applicationDeadline` giữ completeness rule của V5:

```text
DRAFT → optional
submit trở đi → required
```

---

## 15.3. Thay đổi được phép

V6 được phép:

* bổ sung `supportingRecruiterCompanyMemberIds`;
* bổ sung index phục vụ primary/supporting responsibility lookup;
* bổ sung local team constraints;
* bổ sung persistence transitions cho team;
* bổ sung concurrency invariant giữa team membership và Recruiter lock/terminate.

---

## 15.4. Thay đổi không được phép

V6 không được:

* thay Job lifecycle;
* thay creator;
* chuyển team ownership khỏi Job sang Recruiter;
* thêm role Primary/Supporting vào Company-level identity;
* biến Supporting thành owner của Job;
* làm `applicationDeadline` global-required;
* xóa Job/team history khi Recruiter rời Company;
* thêm future-version persistence chỉ để chuẩn bị trước.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở canonical persisted state.

1. Mỗi Job có đúng một `primaryRecruiterCompanyMemberId`.
2. `supportingRecruiterCompanyMemberIds` biểu diễn `0..N` Supporting.
3. Supporting list không duplicate.
4. Primary không xuất hiện trong Supporting list.
5. `createdByCompanyMemberId` độc lập với Primary hiện tại.
6. Thay Primary không thay `createdByCompanyMemberId`.
7. Thay Primary không thay `companyId`.
8. Team member được giao active responsibility phải thuộc cùng Company với Job.
9. Cross-tenant team reference không được tạo.
10. Normal team mutation chỉ được persist khi Job effectively `PUBLISHED`.
11. Persisted `PUBLISHED` đã qua deadline không cho phép normal team mutation.
12. Primary replacement không được commit trạng thái Job thiếu Primary.
13. Primary replacement không được commit trạng thái Primary đồng thời Supporting.
14. Historical team reference có thể tồn tại trên `CLOSED`/`EXPIRED` dù Recruiter hiện tại không còn ACTIVE.
15. Recruiter sau khi hoàn tất `LOCKED` hoặc `TERMINATED` không được còn là Primary/Supporting của Job chưa kết thúc.
16. Concurrent lock/terminate và team assignment không được cùng commit thành tổ hợp vi phạm invariant 15.
17. Unlock không thay đổi Job team references.
18. Job kết thúc không xóa team references chỉ để làm sạch membership.
19. `applicationDeadline` có thể absent trên `DRAFT`.
20. Job từ `PENDING_APPROVAL` trở đi phải có deadline hợp lệ theo V5.
21. V6 không persist Primary/Supporting role tại `User` hoặc `CompanyMember`.
22. V6 không persist duplicate lifecycle state của User/Company/CompanyMember trong Job.

### Enforcement owner

| Invariant group               | Enforcement                                     |
| ----------------------------- | ----------------------------------------------- |
| Type, required field, enum    | Schema                                          |
| Supporting unique             | Schema/local document validation                |
| Primary không nằm Supporting  | Schema/local document validation                |
| Atomic team mutation          | Persistence atomicity                           |
| Eligibility                   | Service                                         |
| Tenant relation               | Service                                         |
| Effective expiration          | Service                                         |
| Authorization                 | Service                                         |
| Lock/terminate vs active team | Service + concurrency-safe persistence boundary |
| Historical semantics          | Data Contract + service interpretation          |

---

# 17. Definition of Data Completion

Data Contract V6 được coi là hoàn thành khi:

* `jobs` được xác định là entity duy nhất cần mở rộng;
* `supportingRecruiterCompanyMemberIds` có contract rõ ràng;
* Primary và creator từ V5 giữ nguyên;
* `applicationDeadline` tiếp tục hỗ trợ partial `DRAFT`;
* relationship Job ↔ Primary ↔ Supporting đã rõ;
* không tạo RecruitmentTeam collection không cần thiết;
* operational eligibility tiếp tục lấy từ `User`, `CompanyMember`, `Company`;
* index Primary lookup đã được xác định;
* index Supporting lookup đã được xác định;
* State Matrix phân biệt active team và historical reference đã rõ;
* toàn bộ persistence transition của F02–F05 đã được xác định;
* team mutation trên một Job có atomicity contract rõ ràng;
* lock/terminate có concurrency boundary bảo vệ invariant;
* không nâng forced transfer nhiều Job thành global all-or-nothing nếu Product không yêu cầu;
* constraint ownership giữa schema/database và service đã rõ;
* multi-tenant boundary đã rõ;
* historical team persistence đã rõ;
* compatibility V5 được giữ;
* các persistence object đã defer không bị thêm ngoài ý muốn;
* mọi persistence invariant có enforcement owner.

Data Completion không đồng nghĩa schema hoặc code đã được implementation.

Nó có nghĩa implementation không cần tự suy đoán business hoặc persistence architecture quan trọng của V6.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract của V6**.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entities/collections;
* fields;
* references;
* relationships;
* cardinality;
* enums;
* indexes;
* structural constraint;
* persistence state;
* persistence transitions;
* atomicity requirements;
* persistence invariants;
* constraint ownership;
* historical persistence;
* tenant ownership.

Tài liệu này không định nghĩa:

* REST endpoints;
* HTTP methods;
* HTTP status codes;
* request body;
* response body;
* controllers;
* routes;
* middleware implementation;
* service function names;
* database query cụ thể;
* MongoDB query operator cụ thể;
* Mongoose method cụ thể;
* transaction API cụ thể;
* locking implementation cụ thể;
* source-code structure;
* frontend flow;
* test framework.

Canonical authority:

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

Nếu implementation hoặc macro database mâu thuẫn với canonical Product V6 hoặc Data Contract này:

```text
Approved Product Specification
→ authority đối với business behavior

Approved Data Contract
→ authority đối với persistence truth
```

Macro database và entity diagram tiếp tục chỉ là input material.
