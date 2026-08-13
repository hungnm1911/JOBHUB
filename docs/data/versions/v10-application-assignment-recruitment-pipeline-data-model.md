# V10 — Phân công Application và Recruitment Pipeline Data Model

> **File:** `docs/data/versions/v10-application-assignment-recruitment-pipeline-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v10-application-assignment-recruitment-pipeline.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v10-application-assignment-recruitment-pipeline.md
```

Product Specification là authority đối với business behavior.

Data Contract này xác định:

* entity/collection nào được V10 sử dụng;
* field nào cần persist;
* field nào được thay đổi hoặc giữ nguyên;
* relationship và ownership;
* representation của Recruitment Status và Assignment State;
* index cần thiết;
* persistence transition;
* concurrency/atomicity requirement;
* constraint nào thuộc schema/database;
* constraint nào cần business context và thuộc service;
* multi-tenant data boundary;
* lifecycle của `submittedCvSnapshot`;
* derivation và lifecycle coordination của non-terminal Application responsibility;
* boundary giữa CompanyMember Recruiter lifecycle và generic Platform User
  lifecycle/recovery;
* các field/collection chủ động không thêm.

V10 không được dùng persistence design để tạo thêm business behavior ngoài Product Specification.

Nếu implementation hoặc persistence design cần một behavior chưa tồn tại trong Product Specification, vấn đề đó phải được đưa trở lại Product layer thay vì tự suy diễn tại Data Contract.

Transaction/atomicity trong tài liệu này chỉ áp dụng cho persisted state thuộc database của hệ thống.

V10 không suy diễn các requirement này thành distributed transaction hoặc exactly-once guarantee với external service.

---

# 2. Thay đổi so với version trước

V10 tiếp tục sử dụng persistence foundation của V9.

Không tạo collection nghiệp vụ mới.

| Entity / Collection                                | Trạng thái  | Mô tả                                                                                                                                                          |
| -------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Application` / `applications`                     | `UPDATED`   | Thêm current Assignee, kích hoạt assignment, reassignment, take over và Recruitment Pipeline; bổ sung persistence constraints/index phục vụ V10              |
| `Job` / `jobs`                                     | `UPDATED`   | Không thêm business field; bổ sung persistence access path cho Managed Jobs, giữ Job retention theo lifecycle V5                                               |
| `CompanyMember` / `company_members`                | `UNCHANGED` | Dùng để resolve Primary, Supporting, Assigned Recruiter, role, membership status và `jobTitle`                                                                 |
| `User` / `users`                                   | `UNCHANGED` | Dùng để resolve Candidate, Recruiter account status, `fullName` và `avatarUrl`                                                                                 |
| `Company` / `companies`                            | `UNCHANGED` | Dùng để resolve tenant owner và Company operational eligibility                                                                                                |
| `SubmittedCvSnapshot` embedded trong `Application` | `UNCHANGED` | Giữ nguyên contract từ V9; V10 không tạo lại hoặc thay cấu trúc snapshot                                                                                       |

## 2.1. Entity mới

Không có.

## 2.2. Entity được mở rộng

### `Application`

V9 persisted `Application` chưa có:

```text
assignedRecruiterCompanyMemberId
sourceRecruiterCompanyMemberId
```

V10 thêm đúng một business field:

* `assignedRecruiterCompanyMemberId`.

V10 sử dụng các field V9 đã tồn tại:

* `status`;
* `version`;
* `jobId`;
* `candidateUserId`;
* `submittedCvSnapshot`;
* timestamps và các field V9 liên quan.

V10 mở rộng persistence behavior của `Application` bằng:

* Recruitment Status transitions;
* assignment transitions;
* state combination constraints;
* concurrency protection;
* indexes phục vụ Managed Jobs, My Applications, Pipeline và current workload.

### `Job`

Không thêm field mới.

V10 bổ sung data constraint:

```text
Job đã có ít nhất một Application
→ không được hard delete.
```

V10 cũng yêu cầu access path để resolve các Job mà Recruiter hiện đang là Primary.

## 2.3. Entity giữ nguyên nhưng được sử dụng

* `CompanyMember`.
* `User`.
* `Company`.
* `SubmittedCvSnapshot`.

Không thay đổi schema của các entity này chỉ để phục vụ V10 nếu dữ liệu cần thiết đã tồn tại.

---

# 3. Collection / Entity tổng thể

V10 sử dụng:

```text
applications
jobs
company_members
users
companies
```

và embedded document:

```text
Application.submittedCvSnapshot
```

Vai trò:

| Entity / Collection   | Responsibility trong V10                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Application`         | Persist Recruitment Status hiện tại, current Assignee, Candidate, Job, source, CV snapshot và concurrency version |
| `Job`                 | Persist Company owner và Recruitment Team hiện tại dùng để resolve authorization/eligibility                      |
| `CompanyMember`       | Persist company membership, company-scoped role, status và recruiter metadata                                     |
| `User`                | Persist account identity, account lifecycle và user-facing profile data                                           |
| `Company`             | Persist canonical tenant và operational status                                                                    |
| `SubmittedCvSnapshot` | Persist CV snapshot thuộc Application, kế thừa từ V9                                                              |

Không tạo persistence entity riêng cho:

```text
Managed Jobs
My Applications
Unassigned
Pipeline
Kanban
Current Workload
```

Các khái niệm trên là projections/query views từ persisted data hiện có.

---

# 4. Quan hệ dữ liệu

## 4.1. Candidate → Application

**Cardinality**

```text
User(Candidate) 1 ───── 0..N Application
```

**Owner của reference**

`Application`

**Reference**

```text
Application.candidateUserId
```

**Constraint**

* required;
* mỗi Application thuộc đúng một Candidate;
* không thay đổi sau khi Application được tạo;
* kết hợp với `jobId` phải unique.

**Lifecycle**

Candidate reference được giữ trong toàn bộ lifecycle của Application, kể cả khi Application terminal.

---

## 4.2. Job → Application

**Cardinality**

```text
Job 1 ───── 0..N Application
```

**Owner**

`Application`

**Reference**

```text
Application.jobId
```

**Constraint**

* required;
* immutable sau khi Application được tạo;
* Job được reference phải tồn tại;
* một Job có thể có nhiều Application.

**Lifecycle**

Job không được hard delete sau khi có ít nhất một Application reference.

Không:

```text
Application.jobId = null
```

Không cascade delete Application khi xóa Job.

---

## 4.3. Assigned Recruiter → Application

**Cardinality**

```text
CompanyMember 1 ───── 0..N Application
```

Ở phía Application:

```text
Application
└── 0..1 assignedRecruiterCompanyMemberId
```

**Owner**

`Application`

**Reference**

```text
Application.assignedRecruiterCompanyMemberId
```

**Constraint cấu trúc**

* optional;
* scalar reference;
* không có mảng nhiều Assignee.

**Business validity**

Reference chỉ được tạo/chuyển sang CompanyMember đáp ứng Assignee eligibility theo Product Specification.

Assigned Recruiter phải được resolve thông qua `CompanyMember`, không phải chỉ thông qua `User`.

**Active Application responsibility**

```text
Application.assignedRecruiterCompanyMemberId = recruiterId
AND
Application.status NOT IN { HIRED, REJECTED, WITHDRAWN }
```

Không thêm điều kiện:

```text
Job.status = PUBLISHED
```

Vì vậy Application thuộc Job `CLOSED` hoặc `EXPIRED` vẫn là active Application responsibility khi còn non-terminal và assigned.

---

## 4.4. Job → Primary Recruiter

**Reference**

```text
Job.primaryRecruiterCompanyMemberId
```

Dùng để:

* xác định Primary hiện tại;
* xác định quyền Assign/Reassign/Take over;
* xác định Managed Jobs.

Primary không được sao chép vào Application bằng một field riêng.

---

## 4.5. Job → Supporting Recruiters

**Reference**

```text
Job.supportingRecruiterCompanyMemberIds[]
```

Supporting Team tiếp tục thuộc `Job`.

Application không lưu bản sao danh sách Supporting Recruiters.

Khi kiểm tra Assignee eligibility, target CompanyMember phải là:

```text
Job.primaryRecruiterCompanyMemberId
```

hoặc nằm trong:

```text
Job.supportingRecruiterCompanyMemberIds[]
```

---

## 4.6. Company → Job

**Reference**

```text
Job.companyId
```

Company tenant của Application được resolve:

```text
Application.jobId
        ↓
Job.companyId
        ↓
Company
```

Application không thêm duplicate field `companyId`.

---

## 4.7. Company → CompanyMember

**Reference**

```text
CompanyMember.companyId
```

Assignee phải thuộc cùng Company với Job:

```text
CompanyMember.companyId
=
Job.companyId
```

---

## 4.8. User → CompanyMember

**Reference**

```text
CompanyMember.userId
```

V10 dùng relationship này để resolve:

* User status của Recruiter;
* `fullName`;
* `avatarUrl`.

Candidate-visible recruiter data được resolve từ live references:

```text
Application.assignedRecruiterCompanyMemberId
        ↓
CompanyMember
        ├── jobTitle
        └── userId
              ↓
             User
             ├── fullName
             └── avatarUrl
```

V10 không thêm snapshot hoặc duplicate các field trên vào Application.

---

# 5. Application

## 5.1. Responsibility

`Application` chịu trách nhiệm persist:

* source hiện tại;
* Recruitment Status hiện tại;
* thời điểm apply;
* dữ liệu Withdraw thuộc V9;
* current Assigned Recruiter;
* source Recruiter nếu source cần;
* Job;
* Candidate;
* `submittedCvSnapshot`;
* concurrency version;
* timestamps.

`assignedRecruiterCompanyMemberId` là current responsibility reference duy nhất. Active Application responsibility và current workload đều được derive từ reference này cùng current non-terminal status; không persist counter hoặc eligibility decision.

`Application` không chịu trách nhiệm persist:

* Recruitment Team;
* Company duplicate;
* assignment history;
* status history;
* historical workload;
* KPI;
* Job snapshot;
* Assignee profile snapshot;
* Interview Schedule;
* Conversation;
* Notification.

---

## 5.2. Fields

| Field                              | Type                 | Required | Default              | Constraint                      | Ý nghĩa                                                      |
| ---------------------------------- | -------------------- | -------: | -------------------- | ------------------------------- | ------------------------------------------------------------ |
| `_id`                              | identifier           |      YES | generated            | unique                          | Định danh Application                                        |
| `source`                           | enum                 |      YES | `DIRECT_APPLICATION` | immutable                       | Nguồn tạo Application                                        |
| `status`                           | enum                 |      YES | `APPLIED`            | thuộc V10 status enum           | Recruitment Status hiện tại                                  |
| `appliedAt`                        | datetime             |      YES | thời điểm tạo        | immutable                       | Thời điểm Candidate apply                                    |
| `withdrawnAt`                      | datetime / null      |       NO | `null`               | contract kế thừa V9             | Thời điểm Withdraw nếu có                                    |
| `withdrawReason`                   | string / null        |       NO | `null`               | contract kế thừa V9             | Lý do Withdraw nếu V9 cho phép                               |
| `assignedRecruiterCompanyMemberId` | identifier / null    |       NO | `null`               | reference `CompanyMember`       | Current Assigned Recruiter                                   |
| `jobId`                            | identifier           |      YES | —                    | immutable reference `Job`       | Job của Application                                          |
| `candidateUserId`                  | identifier           |      YES | —                    | immutable reference `User`      | Candidate sở hữu Application                                 |
| `submittedCvSnapshot`              | embedded document    |      YES | —                    | V9 snapshot contract            | CV snapshot hiện tại đã nộp                                  |
| `version`                          | non-negative integer |      YES | `0`                  | monotonic concurrency token     | Chống stale write trên Application                           |
| `createdAt`                        | datetime             |      YES | automatic            | —                               | Thời điểm tạo persisted record                               |
| `updatedAt`                        | datetime             |      YES | automatic            | cập nhật khi Application mutate | Thời điểm cập nhật Application gần nhất                      |

V10 không thêm:

```text
companyId
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds
previousAssigneeId
assignedFrom
assignedUntil
assignmentHistory
statusHistory
statusTimeline
jobSnapshot
```

---

## 5.3. Enum

### `source`

Trong phạm vi V10:

```text
DIRECT_APPLICATION
```

Không bổ sung source Invitation trong V10.

### `status`

```text
APPLIED
SCREENING
CONTACTED
INTERVIEW_SCHEDULED
INTERVIEW_COMPLETED
HIRED
REJECTED
WITHDRAWN
```

| Giá trị               | Persistence meaning                                 |
| --------------------- | --------------------------------------------------- |
| `APPLIED`             | Hồ sơ đã tồn tại và chưa bắt đầu Screening          |
| `SCREENING`           | Current Application đang ở bước Screening           |
| `CONTACTED`           | Current Application đang ở bước Contacted           |
| `INTERVIEW_SCHEDULED` | Current Application đang ở bước Interview Scheduled |
| `INTERVIEW_COMPLETED` | Current Application đang ở bước Interview Completed |
| `HIRED`               | Terminal — hired                                    |
| `REJECTED`            | Terminal — rejected                                 |
| `WITHDRAWN`           | Terminal — Candidate withdrawn                      |

Không thêm:

```text
UNASSIGNED
INTERVIEW
COMPLETED
```

vào `Application.status`.

---

## 5.4. Indexes

### IDX-A01 — Candidate–Job uniqueness

```text
{ candidateUserId: 1, jobId: 1 }
UNIQUE
```

Mục đích:

* bảo vệ một Candidate–Job có tối đa một Application;
* kế thừa invariant V9.

### IDX-A02 — Job Pipeline

```text
{ jobId: 1, status: 1 }
```

Mục đích:

* Pipeline/Kanban theo Job;
* số Application theo Recruitment Status;
* lookup Application của Job.

### IDX-A03 — Job + Assignee

```text
{ jobId: 1, assignedRecruiterCompanyMemberId: 1 }
```

Mục đích:

* Unassigned Applications của Job;
* filter theo Assignee trong Managed Job;
* kiểm tra responsibility của Recruiter trên Job.

`assignedRecruiterCompanyMemberId = null` biểu diễn Unassigned.

### IDX-A04 — Recruiter My Applications / Current Workload

```text
{ assignedRecruiterCompanyMemberId: 1, status: 1 }
```

Mục đích:

* My Applications của Recruiter;
* current workload theo non-terminal status;
* lookup Applications hiện đang assign cho một Recruiter.
* resolve non-terminal Application responsibility cho lifecycle/team handoff và final guard.

### IDX-A05 — Candidate My Applications

```text
{ candidateUserId: 1, status: 1 }
```

Mục đích:

* Candidate My Applications;
* filter theo Recruitment Status;
* bảo vệ ownership-scoped lookup.

V10 không thêm index cho:

* Assignment History;
* Status History;
* historical KPI;
* future Invitation source.

Các field `updatedAt` có thể được sử dụng trong projection/sorting implementation, nhưng Product Specification không định nghĩa một canonical sort order nên V10 Data Contract không tạo business guarantee về thứ tự danh sách.

---

## 5.5. Embedded document

### `submittedCvSnapshot`

```text
Application
└── submittedCvSnapshot
```

Owner:

```text
Application
```

V10 không thay đổi cấu trúc snapshot đã được V9 định nghĩa.

Persistence rules:

* mỗi Application có đúng một current `submittedCvSnapshot`;
* Assign không thay snapshot;
* Reassign không thay snapshot;
* Take over không thay snapshot;
* forced reassignment không thay snapshot;
* Recruitment Status transition không thay snapshot;
* terminal transition không xóa snapshot.

Candidate Replace Submitted CV tiếp tục được phép thay snapshot duy nhất theo contract V9 khi:

* Application còn `APPLIED`;
* Job còn nhận hồ sơ;
* các điều kiện V9 khác được thỏa.

V10 không tạo snapshot history.

---

## 5.6. Reference rules

| Field                              | Reference       | Required | Cardinality | Rule                                                   |
| ---------------------------------- | --------------- | -------: | ----------- | ------------------------------------------------------ |
| `candidateUserId`                  | `User`          |      YES | N → 1       | Candidate owner; immutable                             |
| `jobId`                            | `Job`           |      YES | N → 1       | Job owner context; immutable                           |
| `assignedRecruiterCompanyMemberId` | `CompanyMember` |       NO | N → 0..1    | Current Assignee                                       |

Database/schema chỉ bảo vệ structural validity của field/reference representation.

Việc referenced `CompanyMember` có:

* đúng Company;
* role `RECRUITER`;
* ACTIVE;
* nằm trong Recruitment Team;
* User ACTIVE;

hay không cần cross-document context và thuộc service constraint.

---

# 6. Các entity liên quan giữ nguyên

## 6.1. Job

### Responsibility trong V10

V10 sử dụng:

```text
Job._id
Job.companyId
Job.primaryRecruiterCompanyMemberId
Job.supportingRecruiterCompanyMemberIds
Job.status
```

V10 không thêm Assignee vào `Job`.

Assignee thuộc từng Application.

### Index bổ sung

```text
{ primaryRecruiterCompanyMemberId: 1 }
```

Mục đích:

* Managed Jobs;
* resolve các Job mà Recruiter hiện đang là Primary.

Không tạo Job status/index mới chỉ để phục vụ Application Pipeline.

### Hard-delete lifecycle

V10 giữ Job retention theo canonical lifecycle V5:

```text
DRAFT / PENDING_APPROVAL
→ có thể hard delete
→ chưa thể có Direct Application

PUBLISHED / CLOSED / EXPIRED
→ có thể có Application
→ không được hard delete
```

V10 không bổ sung Application-existence delete guard hoặc cross-collection
transaction chỉ để diễn đạt lại invariant lifecycle này. Không cascade delete
Application và không set `Application.jobId = null`.

---

## 6.2. CompanyMember

V10 sử dụng các field hiện có liên quan:

```text
_id
userId
companyId
role
status
jobTitle
```

Eligibility target cho Assign/Reassign yêu cầu:

```text
role = RECRUITER
status = ACTIVE
```

và phải thuộc đúng Recruitment Team của Job.

`jobTitle` được sử dụng làm recruiter metadata cho Candidate-facing projection.

V10 không thêm:

```text
currentApplicationIds
assignedApplicationIds
workload
kpi
```

Current workload được derive từ `Application`.

---

## 6.3. User

V10 sử dụng:

```text
_id
status
fullName
avatarUrl
```

Đối với Assigned Recruiter:

```text
User.status = ACTIVE
```

là một phần của operational eligibility.

Platform Admin `User.status → LOCKED | TERMINATED` giữ nguyên
`CompanyMember`, Job Recruitment Team và Application responsibility references.
Đây không phải CompanyMember Recruiter lifecycle, không tạo persistence field
mới, và không chạy final zero-responsibility guard. User lifecycle đã commit
làm Recruiter mất processing/target eligibility; Company Manager recovery sau
đó tiếp tục derive từ current persisted relationships.

Candidate-facing Assignee projection dùng:

```text
User.fullName
User.avatarUrl
CompanyMember.jobTitle
```

Không duplicate các field này vào Application.

---

## 6.4. Company

V10 sử dụng:

```text
_id
operationalStatus
```

Company phải ở trạng thái operational cho phép Recruiter xử lý Application theo Product Specification.

V10 không thêm Application list hoặc current workload vào Company.

Khi Company không operational, current assignment reference trên Application được giữ. V10 không persist synthetic replacement, synthetic Unassigned hoặc một eligibility result trên Application.

---

# 7. State Matrix

V10 có hai state dimensions trên Application:

1. `status`;
2. assignment state được derive từ `assignedRecruiterCompanyMemberId`.

```text
assignedRecruiterCompanyMemberId = null
→ UNASSIGNED

assignedRecruiterCompanyMemberId != null
→ ASSIGNED
```

## 7.1. Persisted State Matrix

| `status`              | Assignee | Hợp lệ | Ý nghĩa                                             |
| --------------------- | -------- | -----: | --------------------------------------------------- |
| `APPLIED`             | `null`   |    YES | Direct Application chưa được phân công              |
| `APPLIED`             | non-null |    YES | Đã assign nhưng chưa Screening                      |
| `SCREENING`           | `null`   |     NO | Không được tồn tại                                  |
| `SCREENING`           | non-null |    YES | Assignee đang xử lý                                 |
| `CONTACTED`           | `null`   |     NO | Không được tồn tại                                  |
| `CONTACTED`           | non-null |    YES | Assignee đang xử lý                                 |
| `INTERVIEW_SCHEDULED` | `null`   |     NO | Không được tồn tại                                  |
| `INTERVIEW_SCHEDULED` | non-null |    YES | Assignee đang xử lý                                 |
| `INTERVIEW_COMPLETED` | `null`   |     NO | Không được tồn tại                                  |
| `INTERVIEW_COMPLETED` | non-null |    YES | Assignee đang xử lý                                 |
| `HIRED`               | `null`   |     NO | Không được tồn tại                                  |
| `HIRED`               | non-null |    YES | Terminal; giữ Assignee cuối                         |
| `REJECTED`            | `null`   |     NO | Không được tồn tại                                  |
| `REJECTED`            | non-null |    YES | Terminal; giữ Assignee cuối                         |
| `WITHDRAWN`           | `null`   |    YES | Candidate Withdraw trước khi assign                 |
| `WITHDRAWN`           | non-null |    YES | Candidate Withdraw sau assign nhưng trước Screening |

Các state combination `NO` không được persist.

---

## 7.2. Operational Eligibility không phải field của Application

V10 không thêm:

```text
assigneeEligible
assigneeActive
processingAllowed
```

vào Application.

Operational eligibility được derive tại thời điểm action từ:

```text
Application
  ↓
Job
  ├── Company
  ├── Primary Recruiter
  └── Supporting Recruiters

Application.assignedRecruiterCompanyMemberId
  ↓
CompanyMember
  ↓
User
```

Ba trường hợp:

| Assignment | Eligibility hiện tại | Processing                                                                                       |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| Unassigned | —                    | Không Recruiter nào được xử lý                                                                   |
| Assigned   | eligible             | Current Assignee được xử lý theo transition hợp lệ                                               |
| Assigned   | ineligible           | Reference có thể vẫn tồn tại; Assignee không được xử lý; cần handoff trước khi pipeline tiếp tục |

Việc Assignee mất eligibility không tự động:

```text
assignedRecruiterCompanyMemberId = null
```

vì V10 không có Unassign.

Active responsibility derivation cũng không phụ thuộc Job status:

```text
assignedRecruiterCompanyMemberId = recruiterId
AND
status IN {
  APPLIED,
  SCREENING,
  CONTACTED,
  INTERVIEW_SCHEDULED,
  INTERVIEW_COMPLETED
}
```

Terminal Application giữ Assignee cuối cùng nếu có nhưng không còn được tính là active responsibility.

---

# 8. Persistence Transitions

## 8.1. Assign lần đầu

### Trigger business

`F02`, `BR-06`–`BR-11`.

### Trước

```text
Application.status = non-terminal
Application.assignedRecruiterCompanyMemberId = null
Application.version = V
```

Target CompanyMember hiện đang eligible.

### Sau

```text
Application.assignedRecruiterCompanyMemberId = targetCompanyMemberId
Application.status = giữ nguyên
Application.version = V + 1
Application.updatedAt = now
```

### Entity thay đổi

* `Application`.

### Entity không thay đổi

* `Job`.
* `CompanyMember`.
* `User`.
* `Company`.
* `submittedCvSnapshot`.

### Invariant

* Application có đúng một Assignee sau Assign.
* Status không thay đổi.
* Candidate/Job/source/snapshot không thay đổi.
* Assign stale dựa trên `UNASSIGNED` cũ không được overwrite Assign đã commit trước.

---

## 8.2. Reassign

### Trigger

`F03`, `BR-12`, `BR-14`.

### Trước

```text
Application.assignedRecruiterCompanyMemberId = A
Application.status = non-terminal
Application.version = V
```

### Sau

```text
Application.assignedRecruiterCompanyMemberId = B
Application.status = giữ nguyên
Application.version = V + 1
Application.updatedAt = now
```

### Invariant

* `A → null → B` không được persist như một intermediate business state;
* Application chuyển trực tiếp `A → B`;
* snapshot không thay đổi;
* stale write của A không được ghi đè B.

---

## 8.3. Take over

Persistence representation của Take over giống Reassign:

### Trước

```text
assignedRecruiterCompanyMemberId = Supporting A
```

### Sau

```text
assignedRecruiterCompanyMemberId = current Primary
```

Không thêm field:

```text
takenOver
takeoverAt
previousAssignee
```

Recruitment Status giữ nguyên.

---

## 8.4. Administrative Forced Reassignment

Persistence representation:

```text
assignedRecruiterCompanyMemberId = A
↓
assignedRecruiterCompanyMemberId = B
```

với B là target Recruiter hợp lệ.

Operation chỉ được authorize trong một trong hai trusted context:

* recovery handoff: A đã mất current eligibility;
* pre-lifecycle handoff: A vẫn eligible nhưng là subject của verified lifecycle/team operation sắp làm A mất eligibility.

Pre-lifecycle handoff không yêu cầu persist A thành ineligible trước và không thêm `lifecycleOperationId` trên Application. Trusted lifecycle/team operation context thuộc action coordination boundary, không phải business field mới.

Không persist Company Manager làm Assignee.

Không thêm:

```text
forced = true
forcedBy
forcedReason
assignmentType
```

vì V10 không lưu Assignment History hoặc audit history như một business capability.

Việc authorization actor là Company Manager được kiểm tra tại action boundary, không được suy ra từ persisted Assignee field.

Không được dùng transition này cho arbitrary workload balancing hoặc để cấp normal First Assign/Reassign/Take over authority cho Company Manager.

---

## 8.5. `APPLIED → SCREENING`

### Trước

```text
status = APPLIED
assignedRecruiterCompanyMemberId = A
version = V
```

A phải là current Assignee và còn eligible.

### Sau

```text
status = SCREENING
assignedRecruiterCompanyMemberId = A
version = V + 1
updatedAt = now
```

`submittedCvSnapshot` giữ nguyên.

Sau transition này, Candidate-side Replace/Withdraw không còn hợp lệ.

---

## 8.6. Pipeline forward transitions

Persistence pattern:

```text
SCREENING
→ CONTACTED

CONTACTED
→ INTERVIEW_SCHEDULED

INTERVIEW_SCHEDULED
→ INTERVIEW_COMPLETED

INTERVIEW_COMPLETED
→ HIRED
```

Mỗi transition:

```text
status = targetStatus
assignedRecruiterCompanyMemberId = giữ nguyên
version = version + 1
updatedAt = now
```

Không tạo:

```text
statusHistory[]
changedBy
changedAtPerState
interview entity
```

---

## 8.7. Transition sang `REJECTED`

Cho phép từ:

```text
APPLIED
SCREENING
CONTACTED
INTERVIEW_SCHEDULED
INTERVIEW_COMPLETED
```

Sau:

```text
status = REJECTED
assignedRecruiterCompanyMemberId = giữ nguyên
version = version + 1
updatedAt = now
```

Không thêm:

```text
rejectedAt
rejectedBy
rejectionHistory
```

trừ khi một version khác sau này định nghĩa requirement mới.

---

## 8.8. Candidate Withdraw — compatibility với V9

### Trước

```text
status = APPLIED
assignedRecruiterCompanyMemberId = null hoặc A
version = V
```

### Sau

```text
status = WITHDRAWN
assignedRecruiterCompanyMemberId = giữ nguyên
withdrawnAt = theo contract V9
withdrawReason = theo contract V9
version = V + 1
updatedAt = now
```

Không tự clear Assignee khi Withdraw.

Nếu Application đã assign, Assignee cuối cùng được giữ trên terminal Application.

---

## 8.9. Replace Submitted CV — compatibility với V9

### Trước

```text
status = APPLIED
Job còn nhận hồ sơ
submittedCvSnapshot = Snapshot A
version = V
```

### Sau

```text
status = APPLIED
assignedRecruiterCompanyMemberId = giữ nguyên
submittedCvSnapshot = Snapshot B
version = V + 1
updatedAt = now
```

V10 không tạo snapshot history.

Replace và `APPLIED → SCREENING` phải cạnh tranh trên cùng current Application state.

---

## 8.10. Assignee mất operational eligibility

Eligibility loss không tự tạo Application transition.

### Trước

```text
Application.status = non-terminal
Application.assignedRecruiterCompanyMemberId = A
A = eligible
```

### Sau eligibility change

Có thể tồn tại:

```text
Application.status = non-terminal
Application.assignedRecruiterCompanyMemberId = A
A = no longer eligible
```

Application reference không bị tự động xóa.

Persistence consequence:

```text
A không được commit pipeline transition mới.
```

Application chỉ tiếp tục pipeline sau khi:

```text
A → B
```

và B là eligible Assignee.

Nếu Company toàn bộ không operational, không có Assignee trong Company đáp ứng eligibility; V10 không tự mutate Application sang trạng thái khác chỉ để giải quyết trường hợp này.

Company lock special case:

```text
Company operational → non-operational
Application.assignedRecruiterCompanyMemberId = giữ nguyên
Application.status = giữ nguyên
```

Không auto reassign sang Recruiter khác trong cùng Company, không persist `null`, không tạo synthetic replacement và không mutate workload counter. Application processing bị freeze. Nếu một canonical version sau này cho Company operational trở lại, eligibility được derive lại từ current Company/Job/team/Assignee relationships; V10 không tạo Company reactivation transition.

---

## 8.11. Job `CLOSED` / `EXPIRED`

Job lifecycle transition không tự mutate Application.

Ví dụ:

### Trước

```text
Job.status = PUBLISHED
Application.status = SCREENING
```

### Sau

```text
Job.status = CLOSED hoặc EXPIRED
Application.status = SCREENING
Application.assignedRecruiterCompanyMemberId = giữ nguyên
```

Application vẫn có thể tiếp tục các transition V10 hợp lệ.

Nếu Application còn non-terminal và assigned, Application vẫn được tính là active Application responsibility và current workload dù Job đã `CLOSED` hoặc `EXPIRED`.

Không:

```text
auto REJECT
auto WITHDRAW
auto delete Application
```

---

## 8.12. Job retention compatibility

V10 không mutate `Application` khi Job `CLOSED` hoặc `EXPIRED` và không bổ
sung hard-delete workflow. Direct Application chỉ được tạo trên Job đủ điều
kiện `PUBLISHED` theo V9; Job đã `PUBLISHED`, `CLOSED` hoặc `EXPIRED` được giữ
theo lifecycle V5.

---

## 8.13. CompanyMember Recruiter lifecycle và Recruitment Team handoff

V10 mở rộng responsibility lookup của lifecycle/team operation mà không thay schema V6:

```text
Active Recruiter Responsibility
=
active Job-team responsibility theo V6
UNION
non-terminal Application responsibility theo V10
```

Trước khi Company Manager commit `CompanyMember(RECRUITER).status` thành
`LOCKED`/`TERMINATED`, required Application handoff dùng direct mutation `A → B`
và giữ nguyên status, Candidate, Job, source cùng `submittedCvSnapshot`.

Trước khi Recruiter bị remove khỏi Recruitment Team của một Job, mọi non-terminal Application của Job đang trỏ tới Recruiter phải được handoff. Thay đổi Primary/Supporting mà Recruiter vẫn thuộc team và vẫn fully eligible không tự mutate Application.

Final lifecycle completion guard phải đọc current persisted outcome:

```text
activeJobResponsibilityCount == 0
AND
nonTerminalAssignedApplicationCount == 0
```

Không persist các count này làm source of truth.

---

## 8.14. Platform User eligibility loss và Company recovery

Generic Platform Admin lifecycle chỉ mutate canonical `User.status` và revoke
session theo V1. Nó không mutate `CompanyMember.status`, Job Primary/Supporting,
Application Assignee/Status hoặc `submittedCvSnapshot`; không persist recovery
flag, queue, history, counter hay replacement record.

Khi `User.status != ACTIVE`, persisted responsibility reference được giữ nhưng
không còn processing authority. Application First Assign/Reassign/handoff/
Pipeline và Job-team operation trao Primary/Supporting responsibility phải dùng
current User eligibility tại commit boundary. Nếu User lifecycle commit trước,
stale operation không được commit; nếu responsibility mutation commit trước,
mutation được giữ và User lifecycle vẫn có thể hoàn tất sau.

Company Manager recovery dùng các current references đã tồn tại:

```text
active Job-team responsibility theo V6
UNION
non-terminal Application responsibility theo V10
```

Recovery không đồng bộ `User.status` với `CompanyMember.status`, không tạo
global all-or-nothing transaction và không thay đổi Company-lock freeze
semantics.

---

# 9. Transaction / Atomicity Requirements

Không dùng transaction mặc định cho mọi operation.

Các mutation chỉ trên một `Application` có thể được bảo vệ bằng atomic conditional mutation trên chính Application, miễn là đáp ứng đầy đủ outcome của Data Contract.

---

## TX-01 — Application stale-write protection

**Business source**

* `BR-36`
* `BR-37`
* `BR-38`
* `BR-39`

Các operation cạnh tranh trên cùng Application bao gồm:

* Assign;
* Reassign;
* Take over;
* administrative forced reassignment;
* Recruitment Status update;
* V9 Replace Submitted CV;
* V9 Withdraw.

Mỗi mutation phải dựa trên expected current persisted state, bao gồm các dimension liên quan như:

```text
version
current status
current assignee
```

tùy operation.

Sau một mutation thành công:

```text
version = previousVersion + 1
```

Một mutation dựa trên version/state cũ phải thất bại thay vì overwrite dữ liệu đã commit sau đó.

### Required outcome

Nếu Reassign `A → B` commit trước:

```text
A không được commit status update dựa trên assignment cũ.
```

Nếu Withdraw commit trước:

```text
WITHDRAWN
```

không được bị overwrite bởi stale `APPLIED → SCREENING`.

Nếu Replace CV commit trước:

```text
Snapshot B
```

không được bị stale Screening write làm quay lại Snapshot A.

### Atomicity scope

Single Application persisted state.

TX-01 không tự yêu cầu transaction đa collection nếu single-document atomic conditional mutation đã bảo đảm outcome trên.

---

## TX-02 — Eligibility change vs responsibility operation

**Business source**

* `BR-07`
* `BR-08`
* `BR-18`
* `BR-28`
* `BR-36`
* `BR-37`
* `BR-38`

Các operation phải phối hợp tại boundary này gồm:

* First Assign;
* Reassign/Take over;
* administrative recovery handoff;
* administrative pre-lifecycle handoff;
* Recruitment Status update;
* Job-team operation trao Primary hoặc Supporting responsibility;
* lifecycle/team operation làm Recruiter mất eligibility;
* final `LOCKED`/`TERMINATED` completion.

Application operation phải dùng current Application state và current eligibility. Lifecycle completion phải dùng current active-responsibility state.

Eligibility phụ thuộc vào:

```text
Application
Job
CompanyMember
User
Company
```

Required persisted outcomes:

### Trường hợp lifecycle/team eligibility loss commit trước

Nếu lifecycle/team operation đã commit làm Recruiter mất eligibility:

```text
First Assign/Reassign/handoff vào Recruiter đó
→ không được commit
```

Pipeline mutation của Recruiter đó cũng không được commit dựa trên eligibility cũ.

### Trường hợp CompanyMember lifecycle responsibility commit trước

Nếu First Assign/Reassign vào Recruiter commit trước lifecycle completion:

```text
final lifecycle guard
→ phải nhìn thấy non-terminal responsibility mới
→ không được commit LOCKED/TERMINATED
```

Lifecycle completion chỉ tiếp tục sau khi responsibility mới được handoff hoặc trở thành terminal theo một transition hợp lệ.

### Trường hợp generic Platform User lifecycle

Platform User lifecycle không dùng CompanyMember final guard. Nếu Platform
`User` lifecycle commit trước, stale Application hoặc Job-team responsibility
operation vào User đó không được commit. Nếu Application hoặc Job-team
responsibility mutation hợp lệ commit trước, persisted mutation được giữ và
Platform User lifecycle vẫn có thể commit sau; reference được giữ nhưng User đã
mất processing eligibility.

### Recovery và pre-lifecycle handoff

Recovery handoff dùng current ineligible Assignee.

Pre-lifecycle handoff được phép khi current Assignee vẫn eligible nhưng là subject của chính verified eligibility-losing lifecycle/team operation. Không được buộc operation phải persist eligibility loss trước rồi mới cho handoff; cũng không được dùng pre-lifecycle context như arbitrary workload-balancing authority.

### Stale-state boundary

Stale eligibility, stale Assignee hoặc stale Application version không được ghi đè current state. Final lifecycle guard không được dựa trên một count/snapshot cũ nếu assignment hoặc handoff đã commit sau snapshot đó.

Data Contract chỉ yêu cầu coordination/persisted outcome này. Nó không bắt buộc MongoDB primitive, lock strategy, transaction architecture hoặc một `lifecycleOperationId` persisted trên Application.

---

## TX-03 — Reassign/Take over/Forced Reassign là một assignment transition

Assignment transition:

```text
A → B
```

phải atomic đối với persisted Application.

Không được xuất hiện committed business state trung gian:

```text
assignedRecruiterCompanyMemberId = null
```

giữa A và B.

Không cần mutate:

* Recruiter record;
* Job team;
* User;
* Company;

chỉ để biểu diễn assignment transition.

---

## TX-04 — Job retention không bổ sung transaction mới

**Business source**

* `BR-29`

V10 giữ invariant Job đã có Application không bị hard delete bằng canonical
Job lifecycle V5:

```text
DRAFT / PENDING_APPROVAL
→ có thể hard delete
→ chưa thể có Direct Application

PUBLISHED / CLOSED / EXPIRED
→ có thể có Application
→ không được hard delete
```

V10 không yêu cầu cross-collection transaction giữa Application creation và
Job delete chỉ để bổ sung guarantee đã được lifecycle này bảo vệ. Existence
guard, nếu có sau này như defense-in-depth, không phải canonical requirement
của V10.

---

## TX-05 — Multi-Application administrative handoff

V10 không bổ sung requirement:

```text
mọi Application của một Recruiter
phải được reassign trong một global all-or-nothing transaction
```

Mỗi Reassign/Forced Reassign được bảo vệ atomic trên từng Application theo TX-01/TX-03.

Nếu một Recruiter có nhiều non-terminal Applications cần handoff, mỗi Application có thể hoàn tất responsibility transition độc lập.

Điều này cũng áp dụng khi cùng lifecycle request cần transfer nhiều Job và Application. Ví dụ transfer của Job/Application A và B đã commit nhưng C thất bại thì A/B có thể được giữ; không yêu cầu distributed/global rollback.

Tuy nhiên, bất kỳ Application nào chưa handoff và đang trỏ tới một Assignee không còn eligible:

```text
không được tiếp tục Recruitment Pipeline
```

cho tới khi có eligible Assignee.

Đối với Company Manager initiated CompanyMember Recruiter
`LOCKED`/`TERMINATED`, partial progress không cho phép lifecycle completion
commit sớm. Final current-state guard bắt buộc:

```text
activeJobResponsibilityCount == 0
AND
nonTerminalAssignedApplicationCount == 0
```

Nếu còn bất kỳ active responsibility nào, lifecycle completion bị block dù các handoff khác đã thành công.

Không nâng mức guarantee thành global transaction và không persist workload/active-responsibility counter làm canonical state.

---

# 10. Constraint Ownership

## 10.1. Database / schema bảo vệ

Database/schema chịu trách nhiệm với các constraint có đủ local persistence context.

| Constraint                                                                     | Owner           | Lý do                                                     |
| ------------------------------------------------------------------------------ | --------------- | --------------------------------------------------------- |
| `Application._id` unique                                                       | Database        | Identity                                                  |
| `candidateUserId + jobId` unique                                               | Database        | Compound uniqueness                                       |
| `Application.source` thuộc enum                                                | Schema/database | Local enum                                                |
| `Application.status` thuộc enum                                                | Schema/database | Local enum                                                |
| `candidateUserId` required                                                     | Schema/database | Structural                                                |
| `jobId` required                                                               | Schema/database | Structural                                                |
| `submittedCvSnapshot` required                                                 | Schema/database | Structural                                                |
| `assignedRecruiterCompanyMemberId` là scalar nullable reference representation | Schema/database | Local structure                                           |
| `candidateUserId` immutable                                                    | Schema          | Local field lifecycle                                     |
| `jobId` immutable                                                              | Schema          | Local field lifecycle                                     |
| `source` immutable                                                             | Schema          | Local field lifecycle                                     |
| `version` là concurrency token hợp lệ                                          | Schema/database | Local concurrency metadata                                |
| Invalid local `status + assignee-nullability` combination không được persist   | Schema/database | Cả hai state dimension nằm trên cùng Application document |

Đặc biệt state matrix local phải ngăn persisted state như:

```text
status = SCREENING
assignedRecruiterCompanyMemberId = null
```

hoặc:

```text
status = HIRED
assignedRecruiterCompanyMemberId = null
```

---

## 10.2. Service bảo vệ

Các constraint cần business hoặc cross-document context thuộc service.

| Constraint                                                        | Owner              | Lý do                               |
| ----------------------------------------------------------------- | ------------------ | ----------------------------------- |
| Actor hiện tại có phải Primary của đúng Job không                 | Service            | Cross-resource authorization        |
| Target có role `RECRUITER` không                                  | Service            | Cross-document business eligibility |
| Target có cùng Company với Job không                              | Service            | Tenant boundary                     |
| Target có nằm trong Primary/Supporting Team không                 | Service            | Cross-document team membership      |
| CompanyMember target có ACTIVE không                              | Service            | Cross-document lifecycle            |
| User của target có ACTIVE không                                   | Service            | Cross-document lifecycle            |
| Company có operational không                                      | Service            | Cross-document lifecycle            |
| Current Assignee còn eligible tại thời điểm processing không      | Service + TX-02    | Continuous eligibility              |
| Transition status có hợp lệ không                                 | Service            | Business state machine              |
| Actor có phải current Assignee không                              | Service            | Authorization + current state       |
| Supporting có được tự Assign không                                | Service            | Business authorization              |
| Primary phải Take over trước khi xử lý Application của Supporting | Service            | Business authorization              |
| Không Unassign sau khi đã Assign                                  | Service            | Transition cần previous state       |
| Terminal Application không reopen                                 | Service            | Lifecycle rule                      |
| Reassign chỉ áp dụng non-terminal                                 | Service            | Lifecycle rule                      |
| Candidate chỉ truy cập Application của chính mình                 | Service            | Ownership                           |
| Company Manager chỉ forced reassign trong own Company             | Service            | Tenant + authorization              |
| Forced reassign chỉ là recovery hoặc verified pre-lifecycle handoff | Service + trusted lifecycle/team context | Administrative authority boundary |
| Platform Admin không Assign/Reassign/Pipeline hoặc Job-team recovery mutation | Service | Authorization |
| Job retention sau Direct Application                               | Job lifecycle V5   | V5 lifecycle invariant               |
| V10 mutation không được thay snapshot ngoài Replace của V9        | Service            | Workflow ownership                  |
| Current workload chỉ dựa trên current non-terminal assignment     | Service/read model | Derived business projection         |
| Active Application responsibility không lọc theo Job status       | Service/read model | V10 lifecycle derivation            |
| Team removal chỉ commit sau required Application handoff          | Service + TX-02    | Cross-resource responsibility guard |
| CompanyMember Recruiter lifecycle final guard thấy current Job/Application responsibility | Service + TX-02/TX-05 | Cross-resource lifecycle invariant |
| Platform User lifecycle giữ responsibility references nhưng làm User mất eligibility | Service + TX-02 | V1/V10 lifecycle boundary |
| Company lock giữ assignment và freeze processing                  | Service            | Company-wide eligibility boundary   |

---

## 10.3. Constraint cần phối hợp nhiều lớp

### Stale Application mutation

Owner:

```text
Schema/database concurrency token
+
Service conditional state check
+
TX-01
```

### Assignee eligibility race

Owner:

```text
Service cross-document validation
+
TX-02 coordination
```

### CompanyMember Recruiter lifecycle final guard

Owner:

```text
Service current active-responsibility lookup
+
TX-02 ordering
+
TX-05 partial-progress boundary
```

Guard result được derive, không persist thành counter trên Recruiter/Application.

### Platform User lifecycle/recovery boundary

Owner:

```text
Platform User lifecycle
+
Service current-persisted-relationship recovery
+
TX-02 eligibility coordination
```

Generic Platform User lifecycle không đọc/ghi derived zero-responsibility count;
recovery không thêm persistence state.

# 11. Token / TTL Lifecycle

> V10 không bổ sung token/TTL persistence mới.

V10 không tạo:

* invitation token;
* interview token;
* notification TTL;
* temporary assignment token.

---

# 12. Multi-tenant Data Boundary

## 12.1. Canonical tenant key

Canonical tenant của Company-side Application processing được resolve qua:

```text
Application.jobId
        ↓
Job.companyId
```

`Application` không duplicate `companyId`.

---

## 12.2. Resource ownership

| Resource                        | Tenant owner                        | Cách xác định                                     |
| ------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `Job`                           | `Company`                           | `Job.companyId`                                   |
| `Application`                   | `Company` ở Company-side processing | `Application.jobId → Job.companyId`               |
| `CompanyMember`                 | `Company`                           | `CompanyMember.companyId`                         |
| Recruitment Team                | `Company` của Job                   | Primary/Supporting refs trên Job                  |
| Assigned Recruiter relationship | `Company` của Job                   | Target member phải có `companyId = Job.companyId` |

Candidate ownership là user-scoped:

```text
Application.candidateUserId
```

và độc lập với Company membership.

---

## 12.3. Backend tenant resolution

```text
Authenticated Company Actor
        ↓
trusted CompanyMember relationship
        ↓
Company
        ↓
Job.companyId
        ↓
Application.jobId
        ↓
authorized resource
```

Không được dùng client-supplied `companyId` làm bằng chứng authorization.

---

## 12.4. Cross-tenant constraints

Không được persist assignment:

```text
Application → Assignee
```

nếu:

```text
Assignee.companyId != Job.companyId
```

Không được forced reassign Application sang CompanyMember thuộc Company khác.

Không được dùng Recruiter membership ở Company A để xử lý Application thuộc Job của Company B.

---

# 13. Snapshot / Historical Data

## 13.1. `submittedCvSnapshot`

V10 tái sử dụng snapshot V9.

```text
Application
└── submittedCvSnapshot
```

Snapshot:

* thuộc Application;
* không tồn tại độc lập;
* không bị Assign/Reassign/Take over thay đổi;
* không bị Recruitment Pipeline mutation thay đổi;
* không bị xóa khi Application terminal.

Replace Submitted CV tiếp tục là workflow V9 duy nhất trong phạm vi hiện tại có thể thay current snapshot khi đủ điều kiện.

---

## 13.2. Không có Job snapshot

V10 không persist:

```text
jobSnapshot
jobTitleSnapshot
companyNameSnapshot
locationSnapshot
salarySnapshot
jobDescriptionSnapshot
```

Application tiếp tục giữ live reference tới Job.

Hệ quả persistence:

```text
Job đã có Application
→ Job phải tiếp tục tồn tại.
```

---

## 13.3. Không có Assignment snapshot/history

Không persist:

```text
previousAssigneeId
assignmentHistory[]
assignedFrom
assignedUntil
forcedBy
takeOverHistory
```

Application chỉ persist current Assignee.

---

## 13.4. Không có Status history

Không persist:

```text
statusHistory[]
statusTimeline[]
fromStatus
toStatus
changedBy
changedAtPerTransition
```

Application chỉ persist current Recruitment Status.

---

## 13.5. Không có Assignee profile snapshot

Không copy vào Application:

```text
assigneeFullName
assigneeAvatar
assigneeJobTitle
assigneeEmail
assigneePhone
```

Candidate-visible Assignee information được resolve từ current references:

```text
CompanyMember.jobTitle
User.fullName
User.avatarUrl
```

V10 không yêu cầu historical fidelity của Assignee profile.

---

# 14. Explicitly Excluded Persistence

Chủ động **KHÔNG thêm** trong V10:

```text
AssignmentHistory
StatusHistory
ApplicationTimeline
ActivityHistory
RecruiterApplication
ManagedJob
ApplicationPipeline
PipelineColumn
KanbanCard
RecruiterKpi
InterviewSchedule
Conversation
Message
Notification
JobInvitation
jobSnapshot
assigneeSnapshot
```

Không thêm vào `Application`:

```text
companyId
primaryRecruiterCompanyMemberId
supportingRecruiterCompanyMemberIds
previousAssigneeId
assignmentHistory
handoffHistory
statusHistory
statusTimeline
assignedFrom
assignedUntil
rejectedAt
rejectedBy
hiredAt
hiredBy
forcedBy
forcedReason
takeOverAt
currentWorkload
activeResponsibilityCount
nonTerminalAssignedApplicationCount
assigneeEligible
processingAllowed
lifecycleOperationId
jobSnapshot
```

Không thêm vào `CompanyMember`:

```text
currentApplicationIds
assignedApplicationIds
workload
kpi
activeResponsibilityCount
```

Không thêm vào `Job`:

```text
applicationIds
assigneeIds
applicationPipeline
```

Không thêm status:

```text
UNASSIGNED
INTERVIEW
COMPLETED
```

Không thêm future source:

```text
RECRUITER_INVITATION
```

trong V10 chỉ để chuẩn bị trước cho version sau.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ từ V9

1. Một Candidate–Job có tối đa một Application.
2. Direct Application bắt đầu `APPLIED`.
3. Direct Application bắt đầu với Assignee null.
4. Candidate và Job của Application không thay đổi.
5. `source` không thay đổi.
6. `submittedCvSnapshot` thuộc Application.
7. Candidate Replace chỉ theo điều kiện V9.
8. Candidate Withdraw chỉ từ `APPLIED`.
9. `WITHDRAWN` là terminal.
10. Từ `SCREENING`, Replace/Withdraw không còn hợp lệ.

---

## 15.2. Persistence behavior phải giữ từ V6

Recruitment Team tiếp tục được persist trên Job:

```text
1 Primary
0..N Supporting
```

V10 assignment không:

* thêm Supporting;
* remove Supporting;
* thay Primary;
* thay team membership.

V10 chỉ dùng current Recruitment Team làm source of truth cho Assignee eligibility.

Active Recruiter Responsibility từ V10 là hợp của:

```text
active Job-team responsibility theo V6
UNION
non-terminal Application responsibility theo V10
```

Active Application responsibility phải được tính đến khi lifecycle/team operation ảnh hưởng khả năng tiếp tục xử lý Application, kể cả Application thuộc Job `CLOSED`/`EXPIRED`. Đây là V10 integration của responsibility mà V6 đã defer; không reinterpret historical Job-team reference trên Job đã kết thúc thành active Job-team responsibility.

Team removal phải handoff non-terminal Application responsibility trước khi Recruiter rời team. Recruiter lock/terminate phải pass final zero guard trên cả hai responsibility dimension.

---

## 15.3. Persistence behavior phải giữ từ V7

V10 không thay đổi CandidateCV library.

Recruiter xử lý:

```text
Application.submittedCvSnapshot
```

không được từ Application access tự do các CandidateCV khác.

---

## 15.4. Job compatibility

Job lifecycle vẫn độc lập với Application lifecycle.

`CLOSED` / `EXPIRED` không mutate Application status.

`CLOSED` / `EXPIRED` cũng không loại non-terminal assigned Application khỏi active responsibility hoặc current workload derivation.

Thay đổi được V10 bổ sung:

```text
Job có Application
→ không được hard delete.
```

---

## 15.5. Thay đổi không được phép

V10 không được:

* reinterpret `WITHDRAWN`;
* reset Application về `APPLIED`;
* thay Candidate;
* thay Job;
* tạo Job snapshot;
* tạo status history;
* tự clear Assignee khi terminal;
* rewrite final Assignee của terminal Application khi Recruiter mất eligibility;
* thay Recruitment Team thông qua Assign/Reassign;
* cascade delete Application cùng Job.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở committed persisted state.

## PI-01 — Candidate–Job uniqueness

```text
(candidateUserId, jobId)
```

unique trên Application.

**Owner:** Database unique constraint.

---

## PI-02 — Job reference bắt buộc

Mọi Application phải có một `jobId` hợp lệ.

Application không được persist với `jobId = null`.

**Owner:** Schema + canonical Job lifecycle V5.

---

## PI-03 — Candidate reference bắt buộc

Mọi Application phải có `candidateUserId`.

**Owner:** Schema/database.

---

## PI-04 — Một current Assignee tối đa

Application chỉ có một scalar:

```text
assignedRecruiterCompanyMemberId
```

Không persist nhiều current Assignee.

**Owner:** Schema structure.

---

## PI-05 — Unassigned representation

```text
assignedRecruiterCompanyMemberId absent hoặc null
```

là Unassigned trên legacy V9 records; V10 writes có thể chuẩn hóa Unassigned
thành `null`.

Không persist `status = UNASSIGNED`.

**Owner:** Schema + service.

---

## PI-06 — Status enum

`status` chỉ thuộc tám V10 states.

**Owner:** Schema/database.

---

## PI-07 — Status/assignment matrix

Không persist:

```text
SCREENING + null assignee
CONTACTED + null assignee
INTERVIEW_SCHEDULED + null assignee
INTERVIEW_COMPLETED + null assignee
HIRED + null assignee
REJECTED + null assignee
```

**Owner:** Schema/database local state validation.

---

## PI-08 — Assignment không mutate immutable Application identity

Assign/Reassign/Take over/Forced Reassign không thay:

```text
candidateUserId
jobId
source
submittedCvSnapshot
```

**Owner:** Schema immutability + service workflow.

---

## PI-09 — Pipeline mutation không mutate Assignee hoặc snapshot

Status transition thông thường không tự thay:

```text
assignedRecruiterCompanyMemberId
submittedCvSnapshot
```

**Owner:** Service + atomic Application write.

---

## PI-10 — No Unassign

Sau khi một non-terminal Application đã được assign:

```text
A
```

normal responsibility transition chỉ được:

```text
A → B
```

không:

```text
A → null
```

**Owner:** Service.

---

## PI-11 — Terminal status immutable

`HIRED`, `REJECTED`, `WITHDRAWN` không được transition sang status khác.

**Owner:** Service transition validation.

---

## PI-12 — Terminal Assignee retention

Nếu terminal Application có Assignee trước khi kết thúc:

```text
assignedRecruiterCompanyMemberId
```

được giữ.

**Owner:** Service transition contract.

---

## PI-13 — Snapshot retention

Terminal Application vẫn giữ `submittedCvSnapshot`.

**Owner:** Schema required + service.

---

## PI-14 — Continuous eligibility

Một Assigned Recruiter chỉ được commit processing action nếu eligibility hiện tại hợp lệ.

Persisted Assignee reference có thể tạm thời trỏ tới Recruiter đã mất eligibility, nhưng reference đó không cấp processing authority.

Eligibility được derive từ same Company, current Job team, Recruiter role, CompanyMember `ACTIVE`, User `ACTIVE` và Company operational; không persist `assigneeEligible` hoặc `processingAllowed`.

**Owner:** Service + TX-02.

---

## PI-15 — Same-company assignment

Mọi successful Assign/Reassign phải thỏa:

```text
Assignee.companyId = Job.companyId
```

**Owner:** Service.

---

## PI-16 — Recruitment Team eligibility

Successful Assignee phải là current:

```text
Primary
OR
Supporting
```

của Job.

**Owner:** Service.

---

## PI-17 — Assignee operational eligibility

Successful Application processing cần:

```text
CompanyMember.role = RECRUITER
CompanyMember.status = ACTIVE
User.status = ACTIVE
Company operational
```

và current team membership.

Stored assignment không thay thế bất kỳ điều kiện nào trong tập trên.

**Owner:** Service + TX-02.

---

## PI-18 — Stale mutation không overwrite

Mutation sử dụng Application state/version cũ không được overwrite mutation đã commit mới hơn.

**Owner:** concurrency token + service conditional write + TX-01.

---

## PI-19 — Replace/Screening race

Không được persist kết quả làm mất snapshot Replace đã commit trước.

**Owner:** TX-01.

---

## PI-20 — Withdraw/Screening race

Không được persist Application vừa:

```text
WITHDRAWN
```

vừa tiếp tục sang pipeline state.

**Owner:** TX-01.

---

## PI-21 — Current workload không persist riêng

Current workload được derive từ:

```text
assignedRecruiterCompanyMemberId = recruiter
AND
status IN {
  APPLIED,
  SCREENING,
  CONTACTED,
  INTERVIEW_SCHEDULED,
  INTERVIEW_COMPLETED
}
```

Không thêm `Job.status = PUBLISHED`. Application trên Job `CLOSED`/`EXPIRED` vẫn thuộc current workload nếu thỏa expression trên.

Không có persisted workload counter là canonical source of truth.

**Owner:** derived data contract.

---

## PI-22 — Active Application responsibility

Non-terminal Application responsibility dùng cùng canonical derivation với PI-21:

```text
assignedRecruiterCompanyMemberId = recruiterId
AND
status NOT IN { HIRED, REJECTED, WITHDRAWN }
```

Job status không tham gia expression. Terminal Assignee reference là historical association, không phải active responsibility.

**Owner:** Service/read model + lifecycle coordination.

---

## PI-23 — Administrative handoff context

Administrative `A → B` chỉ được commit cho recovery handoff hoặc verified pre-lifecycle handoff. B phải current eligible; A không cần persist ineligible trước trong pre-lifecycle flow.

Không persist `A → null → B`, `lifecycleOperationId`, handoff history hoặc synthetic Unassigned.

**Owner:** Service authorization + TX-01/TX-02/TX-03.

---

## PI-24 — CompanyMember Recruiter lifecycle final guard

Company Manager initiated `CompanyMember(RECRUITER).status → LOCKED | TERMINATED`
chỉ được commit khi current state thỏa:

```text
activeJobResponsibilityCount == 0
AND
nonTerminalAssignedApplicationCount == 0
```

Các count được derive tại guard, không persist. Assignment commit trước guard phải
được nhìn thấy; CompanyMember lifecycle commit trước làm target ineligible phải
ngăn assignment mới. Guard này không áp dụng cho generic Platform
`User.status → LOCKED | TERMINATED`.

**Owner:** Service + TX-02/TX-05.

---

## PI-25 — Company lock giữ assignment

Company mất operational state không tự mutate Application status/Assignee, không auto reassign trong cùng Company và không tạo synthetic Unassigned/replacement. Processing bị freeze trong khi Company non-operational.

**Owner:** Service + Company lifecycle boundary.

---

## PI-26 — Platform User lifecycle giữ responsibility references

Platform `User.status → LOCKED | TERMINATED` không mutate
`CompanyMember.status`, Job Primary/Supporting, Application Assignee/Status hay
`submittedCvSnapshot`; session/account persistence tiếp tục theo V1. Persisted
reference tới outgoing Recruiter không cấp processing authority sau khi User mất
`ACTIVE`.

Company Manager recovery derive từ current Job-team và non-terminal Application
references, không persist recovery state/counter/history và không đồng bộ
CompanyMember lifecycle.

**Owner:** Platform User lifecycle service + responsibility services + TX-02.

---

# 17. Definition of Data Completion

V10 Data Contract được coi là hoàn thành khi:

* không có collection mới ngoài các entity hiện hữu cần thiết;
* `Application` field contract đã được xác định;
* V10 Recruitment Status enum đã được xác định;
* Assignment State được biểu diễn rõ bằng nullable Assignee;
* Candidate–Job uniqueness tiếp tục được bảo vệ;
* relationship Candidate–Application, Job–Application và Assignee–Application đã rõ;
* live recruiter metadata được resolve qua `CompanyMember` và `User`;
* không duplicate Company/Recruitment Team vào Application;
* index phục vụ Pipeline, Unassigned, My Applications, Managed Jobs và current workload đã được xác định;
* State Matrix đã khóa các combination được phép persist;
* Assign/Reassign/Take over/Forced Reassign persistence transition đã rõ;
* Recruitment Pipeline persistence transitions đã rõ;
* V9 Replace/Withdraw compatibility đã rõ;
* Job `CLOSED`/`EXPIRED` không làm Application mutate ngoài ý muốn;
* Job retention tiếp tục theo canonical lifecycle V5, không thêm Apply/Delete transaction;
* continuous eligibility và eligibility race đã có consistency requirement;
* Active Recruiter Responsibility đã được định nghĩa là union của Job-team và non-terminal Application responsibility;
* Application responsibility/current workload derivation không lọc `Job.status`;
* recovery và pre-lifecycle handoff đã có authority/persistence boundary rõ;
* CompanyMember Recruiter lifecycle final zero guard và partial-progress semantics đã rõ;
* Platform User lifecycle/recovery giữ responsibility references, không đồng bộ lifecycle và có stale-operation boundary rõ;
* Team removal không được bỏ lại non-terminal Application responsibility;
* Company lock giữ assignment, không reassign/unassign và freeze processing;
* stale mutation protection đã rõ;
* constraint ownership giữa schema/database và service đã rõ;
* Company tenant boundary đã rõ;
* `submittedCvSnapshot` compatibility được giữ;
* không thêm Job snapshot;
* không thêm Assignment/Status History;
* không persist current workload/KPI riêng;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn;
* không có data design nào thay đổi business behavior của Product Specification.

Data Completion không đồng nghĩa schema/code đã được implementation.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự quyết định các data invariant quan trọng của V10.

---

# 18. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V10.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE V10 PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entities/collections;
* fields;
* references;
* embedded documents;
* relationships;
* cardinality;
* enums;
* indexes;
* uniqueness;
* persistence state;
* State Matrix;
* persistence transitions;
* transaction/atomicity requirements;
* persistence invariants;
* ownership của constraint.

Tài liệu này không định nghĩa:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* controller;
* route;
* middleware implementation;
* service function structure;
* MongoDB query cụ thể;
* Mongoose method cụ thể;
* source-code structure;
* frontend component;
* UI interaction detail;
* test framework.

Canonical authority:

```text
Approved Product Specification
        │
        │ business truth
        ↓
Approved Data Contract
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture / implementation strategy
        ↓
Source Code + Tests
```

Macro database và entity diagram chỉ là persistence-design input.

Nếu macro database, diagram hoặc implementation mâu thuẫn với Product Specification:

```text
Product Specification wins for business behavior.
```

Nếu implementation mâu thuẫn với Data Contract nhưng không có Product decision mới:

```text
Data Contract wins for persistence truth.
```

Không được dùng Data Contract để tạo thêm business requirement chưa được Product Specification phê duyệt.
