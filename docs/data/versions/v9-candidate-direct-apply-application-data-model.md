# V9 — Candidate chủ động Apply và tạo Application Data Model

> **File:** `docs/data/versions/v9-candidate-direct-apply-application-data-model.md`
> **Vai trò:** Canonical Persistence / Data Contract
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/versions/v9-candidate-direct-apply-application.md`

---

## 1. Mục đích

Tài liệu này định nghĩa canonical persistence/data contract để hỗ trợ:

```text
docs/product/versions/v9-candidate-direct-apply-application.md
```

Product Specification là authority đối với business behavior.

Tài liệu Data Model xác định:

* dữ liệu nào cần được persist;
* entity/collection nào chịu trách nhiệm lưu Application;
* Submitted CV Snapshot được biểu diễn và sở hữu như thế nào;
* relationship và ownership;
* field và constraint cần thiết;
* index cần thiết;
* representation của Application state;
* persistence transition;
* transaction / atomicity requirement;
* concurrency representation;
* boundary giữa constraint do database/schema bảo vệ và constraint do service bảo vệ;
* multi-tenant data ownership;
* persistence nào chủ động không được bổ sung trong V9.

Tài liệu này không được thay đổi hoặc mở rộng business behavior của Product Specification.

Macro database và entity diagram V9 chỉ là input cho persistence design.

Các lựa chọn trong macro/diagram không được tự trở thành canonical nếu:

* mâu thuẫn Product Specification;
* mâu thuẫn canonical contract của version trước;
* chỉ nhằm chuẩn bị speculative field/state cho version tương lai;
* không có persistence responsibility trong V9.

---

## 2. Thay đổi so với version trước

V9 lần đầu bổ sung persistence cho `Application` và Submitted CV Snapshot.

| Entity / Collection            | Trạng thái  | Mô tả                                                                                      |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| `applications`                 | `NEW`       | Lưu Direct Application, trạng thái V9 và current Submitted CV Snapshot                     |
| `SubmittedCvSnapshot_EMBEDDED` | `NEW`       | Embedded snapshot của CV hiện đang được nộp cho Application                                |
| `CvSnapshotPdfFile_EMBEDDED`   | `NEW`       | Metadata của PDF thuộc current Submitted CV Snapshot                                       |
| `users`                        | `UNCHANGED` | Dùng Candidate identity; không thêm Application reverse array hoặc Default CV field mới    |
| `candidate_cvs`                | `UNCHANGED` | Dùng CandidateCV V7 làm nguồn capture snapshot; V9 không thay lifecycle/schema CandidateCV |
| `jobs`                         | `UNCHANGED` | Dùng Job để xác định Application target và tenant; schema không cần field Application mới  |
| `companies`                    | `UNCHANGED` | Dùng operational state để kiểm tra Job còn nhận hồ sơ                                      |
| `company_members`              | `UNCHANGED` | V9 chưa persist Application assignment hoặc Source Recruiter                               |

### 2.1. Entity mới

* `applications`
* `SubmittedCvSnapshot_EMBEDDED`
* `CvSnapshotPdfFile_EMBEDDED`

### 2.2. Entity được mở rộng

Không có collection tồn tại từ V8 cần thêm field trong V9.

V9 không thay đổi business deletion boundary hoặc schema của `jobs`.

### 2.3. Entity giữ nguyên nhưng được sử dụng

* `users`
* `candidate_cvs`
* `jobs`
* `companies`

`company_members` tiếp tục tồn tại nhưng V9 không tạo Application relationship persistence tới CompanyMember.

### 2.4. Correction so với macro database / diagram

V9 không thêm hoặc sử dụng:

```text
User.defaultCandidateCvId
```

Default CV tiếp tục dùng representation canonical của V7:

```text
CandidateCV.isDefault
```

V9 cũng không predeclare field chỉ dành cho:

* Source Recruiter;
* Source Invitation;
* Application assignment;
* downstream pipeline.

Các persistence concern đó được defer cho version sở hữu nghiệp vụ tương ứng.

---

## 3. Collection / Entity tổng thể

V9 sử dụng:

```text
users
candidate_cvs
jobs
companies
applications
```

và hai embedded document mới:

```text
SubmittedCvSnapshot_EMBEDDED
CvSnapshotPdfFile_EMBEDDED
```

Vai trò:

| Entity / Collection            | Responsibility                                                    |
| ------------------------------ | ----------------------------------------------------------------- |
| `users`                        | Canonical Candidate identity                                      |
| `candidate_cvs`                | Live Candidate CV library từ V7; nguồn để capture snapshot        |
| `jobs`                         | Job mà Candidate ứng tuyển; nguồn Company tenant và Job lifecycle |
| `companies`                    | Canonical Company tenant và operational eligibility               |
| `applications`                 | Canonical persistence của Candidate–Job Application               |
| `SubmittedCvSnapshot_EMBEDDED` | Current Submitted CV của Application                              |
| `CvSnapshotPdfFile_EMBEDDED`   | PDF metadata của current Submitted CV                             |

Không tạo collection riêng cho Submitted CV Snapshot.

Không tạo collection riêng cho snapshot PDF metadata.

Không tạo collection khác ngoài danh sách trên chỉ để chuẩn bị cho version tương lai.

---

## 4. Quan hệ dữ liệu

### 4.1. User → Application

**Cardinality**

```text
User 1 ───── 0..N Application
```

**Owner**

`Application`

**Reference**

```text
Application.candidateUserId
```

**Constraint**

* required;
* mỗi Application thuộc đúng một Candidate;
* referenced User phải là Candidate hợp lệ theo Product Specification;
* một Candidate có thể có nhiều Application ở các Job khác nhau;
* Candidate–Job uniqueness được bảo vệ riêng.

**Lifecycle**

* Application không được chuyển sang Candidate khác;
* User mutation không tự động mutate Submitted CV Snapshot;
* không thêm `User.applicationIds[]`.

---

### 4.2. Job → Application

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
* Application thuộc đúng một Job;
* Application không được chuyển sang Job khác;
* Application chỉ được tạo khi Job đã `PUBLISHED`;
* theo lifecycle contract V5, Job từ `PUBLISHED` trở đi không còn thuộc
  hard-delete states.

**Lifecycle**

Job:

```text
PUBLISHED → CLOSED
```

hoặc effective expiration không xóa Application.

Không thêm:

```text
Job.applicationIds[]
```

Application được lookup theo reference từ phía `applications`.

---

### 4.3. CandidateCV → Submitted CV Snapshot

**Cardinality**

```text
CandidateCV 1 ───── 0..N SubmittedCvSnapshot
```

theo nghĩa một CandidateCV có thể làm nguồn submission cho nhiều Application khác nhau.

Tại một Application cụ thể:

```text
SubmittedCvSnapshot
→ đúng một source CandidateCV hiện tại
```

**Owner**

`Application.submittedCvSnapshot`

**Reference**

```text
submittedCvSnapshot.sourceCandidateCvId
```

**Constraint**

* source CandidateCV phải thuộc Candidate của Application;
* tại thời điểm Apply hoặc Replace, source CandidateCV phải `ACTIVE`;
* source CandidateCV phải chưa Archive;
* source reference chỉ thể hiện provenance;
* nội dung Recruiter-side tương lai sử dụng phải là snapshot, không phải live CandidateCV.

**Lifecycle**

Khi CandidateCV:

* edit;
* rename;
* đổi visibility;
* replace Uploaded PDF;
* Archive;
* đổi Default;

Submitted CV Snapshot hiện tại không tự động thay đổi.

Khi Replace Submitted CV:

```text
sourceCandidateCvId cũ
+
snapshot cũ
        ↓
được thay bằng
        ↓
sourceCandidateCvId mới
+
snapshot mới
```

Không tạo reverse array trên CandidateCV.

---

### 4.4. Application → SubmittedCvSnapshot

**Cardinality**

```text
Application 1 ───── 1 SubmittedCvSnapshot
```

**Owner**

`Application`

**Representation**

Embedded.

**Constraint**

* snapshot bắt buộc tồn tại trên mọi Application;
* snapshot không có lifecycle độc lập khỏi Application;
* mỗi Application chỉ có một current snapshot;
* Replace thay toàn bộ snapshot hiện tại.

---

### 4.5. Application → Company

Không tạo direct reference:

```text
Application.companyId
```

Canonical tenant được resolve:

```text
Application.jobId
        ↓
Job.companyId
        ↓
Company
```

Không duplicate Company ownership trong Application.

---

## 5. `applications`

### 5.1. Responsibility

`applications` chịu trách nhiệm persist:

* Candidate sở hữu Application;
* Job được ứng tuyển;
* nguồn tạo Application;
* Application state thuộc V9;
* current Submitted CV Snapshot;
* thời điểm Apply;
* thời điểm Withdraw;
* optional withdraw reason;
* revision dùng để bảo vệ stale concurrent mutation;
* timestamps của Application record.

`applications` không chịu trách nhiệm persist:

* live Candidate Profile;
* live CandidateCV content ngoài snapshot;
* Job snapshot;
* Company snapshot;
* Assigned Recruiter trong V9;
* Source Recruiter;
* Source Invitation;
* Recruitment Team;
* Application assignment history;
* status history;
* Conversation;
* Interview;
* Notification;
* snapshot version history.

---

### 5.2. Fields

| Field                 | Type                           | Required | Default                    | Constraint                           | Ý nghĩa                                  |
| --------------------- | ------------------------------ | -------- | -------------------------- | ------------------------------------ | ---------------------------------------- |
| `_id`                 | `ObjectId`                     | YES      | generated                  | unique                               | Định danh Application                    |
| `candidateUserId`     | `ObjectId`                     | YES      | —                          | reference `User`, immutable identity | Candidate sở hữu Application             |
| `jobId`               | `ObjectId`                     | YES      | —                          | reference `Job`, immutable identity  | Job mà Candidate ứng tuyển               |
| `source`              | `String enum`                  | YES      | `DIRECT_APPLICATION`       | chỉ giá trị V9 được định nghĩa       | Nguồn tạo Application                    |
| `status`              | `String enum`                  | YES      | `APPLIED`                  | state vocabulary V9                  | Trạng thái Application                   |
| `submittedCvSnapshot` | `SubmittedCvSnapshot_EMBEDDED` | YES      | —                          | exactly one current snapshot         | CV hiện đang được nộp                    |
| `appliedAt`           | `Date`                         | YES      | thời điểm Apply thành công | không thay đổi sau creation          | Business timestamp của Direct Apply      |
| `withdrawnAt`         | `Date`                         | NO       | `null`                     | chỉ non-null khi `WITHDRAWN`         | Thời điểm Withdraw                       |
| `withdrawReason`      | `String`                       | NO       | `null`                     | optional                             | Lý do Candidate rút Application          |
| `version`             | `Integer`                      | YES      | `0`                        | non-negative, monotonic              | Revision dùng cho stale-write protection |
| `createdAt`           | `Date`                         | YES      | automatic                  | —                                    | Thời điểm tạo persisted record           |
| `updatedAt`           | `Date`                         | YES      | automatic                  | —                                    | Thời điểm record được cập nhật           |

### Field không mutable về business identity

Sau khi Application được tạo:

```text
candidateUserId
jobId
source
appliedAt
```

không được thay đổi bởi V9.

---

### 5.3. Enum

#### `source`

V9 chỉ persist:

```text
DIRECT_APPLICATION
```

| Giá trị              | Ý nghĩa                                                   |
| -------------------- | --------------------------------------------------------- |
| `DIRECT_APPLICATION` | Application được Candidate chủ động tạo bằng Direct Apply |

Không thêm trong V9:

```text
RECRUITER_INVITATION
```

Nguồn đó thuộc version Job Invitation.

---

#### `status`

V9 persist các state mà V9 trực tiếp sở hữu:

```text
APPLIED
WITHDRAWN
```

| Giá trị     | Ý nghĩa                                                                |
| ----------- | ---------------------------------------------------------------------- |
| `APPLIED`   | Candidate đã Apply và Application vẫn ở Candidate-editable entry stage |
| `WITHDRAWN` | Candidate đã rút Application; terminal trong V9                        |

V9 không predeclare downstream pipeline states chỉ để chuẩn bị tương lai.

Khi version sở hữu downstream pipeline được triển khai, Data Contract của version đó chịu trách nhiệm mở rộng enum.

Candidate-side operation của V9 luôn dùng rule:

```text
status phải chính xác là APPLIED
```

do đó mọi downstream state được bổ sung trong version sau mặc nhiên khóa Replace/Withdraw nếu không còn `APPLIED`.

---

### 5.4. Indexes

#### Unique Candidate–Job

```text
{ candidateUserId: 1, jobId: 1 }
UNIQUE
```

Mục đích:

* bảo vệ `BR-12`;
* bảo vệ `BR-17`;
* bảo đảm tối đa một Application cho một Candidate–Job;
* uniqueness không phụ thuộc status;
* uniqueness không phụ thuộc CV;
* uniqueness không được bỏ khi Application `WITHDRAWN`.

Không sử dụng partial unique index theo status.

---

### 5.5. Embedded documents

`Application` chứa:

```text
submittedCvSnapshot {
  sourceCandidateCvId
  name
  sourceType
  generatedContent?
  pdfFile
  capturedAt
}
```

Snapshot:

* thuộc Application;
* không có collection riêng;
* được tạo khi Apply;
* được thay toàn bộ khi Replace;
* không có snapshot history trong V9.

---

### 5.6. Reference rules

| Field                                     | Reference     | Required | Cardinality | Rule                                                               |
| ----------------------------------------- | ------------- | -------- | ----------- | ------------------------------------------------------------------ |
| `candidateUserId`                         | `User`        | YES      | N → 1       | User phải là Candidate hiện tại                                    |
| `jobId`                                   | `Job`         | YES      | N → 1       | Job phải tồn tại; Apply yêu cầu Job còn nhận hồ sơ                 |
| `submittedCvSnapshot.sourceCandidateCvId` | `CandidateCV` | YES      | N → 1       | CandidateCV phải thuộc cùng Candidate và eligible tại capture time |

Database reference structure không tự chứng minh:

* User có role Candidate;
* Job đang `PUBLISHED`;
* deadline chưa qua;
* Company đang ACTIVE;
* CandidateCV đang `ACTIVE`;
* CandidateCV chưa Archive;
* CandidateCV thuộc đúng Candidate.

Các rule trên thuộc Service / transactional workflow khi cần.

---

## 6. `SubmittedCvSnapshot_EMBEDDED`

### 6.1. Responsibility

Embedded document này chịu trách nhiệm lưu current CV submission của một Application.

Snapshot phải đủ độc lập để thay đổi live CandidateCV sau capture không làm thay đổi hồ sơ đã nộp.

Snapshot chịu trách nhiệm lưu:

* provenance CandidateCV;
* tên CV tại thời điểm capture;
* source type;
* Generated structured content khi source là Generated;
* PDF hiện tại của submission;
* thời điểm capture.

Snapshot không chịu trách nhiệm lưu:

* live CandidateCV metadata sau capture;
* visibility hiện tại của CandidateCV;
* Default state hiện tại;
* Candidate Profile hiện tại;
* snapshot history;
* Job information.

---

### 6.2. Fields

| Field                 | Type                             | Required    | Default           | Constraint                                      | Ý nghĩa                                  |
| --------------------- | -------------------------------- | ----------- | ----------------- | ----------------------------------------------- | ---------------------------------------- |
| `sourceCandidateCvId` | `ObjectId`                       | YES         | —                 | reference `CandidateCV`                         | CandidateCV dùng để tạo current snapshot |
| `name`                | `String`                         | YES         | —                 | captured value                                  | Tên CV tại thời điểm capture             |
| `sourceType`          | `String enum`                    | YES         | —                 | `GENERATED` hoặc `UPLOADED`                     | Loại CandidateCV nguồn                   |
| `generatedContent`    | Generated CV structured snapshot | CONDITIONAL | —                 | required khi `GENERATED`, absent khi `UPLOADED` | Deep-copied Generated CV content         |
| `pdfFile`             | `CvSnapshotPdfFile_EMBEDDED`     | YES         | —                 | required                                        | PDF của submission hiện tại              |
| `capturedAt`          | `Date`                           | YES         | thời điểm capture | thay mới khi Replace                            | Thời điểm current snapshot được tạo      |

---

### 6.3. Enum `sourceType`

```text
GENERATED
UPLOADED
```

| Giá trị     | Ý nghĩa                                        |
| ----------- | ---------------------------------------------- |
| `GENERATED` | Snapshot được capture từ Generated CandidateCV |
| `UPLOADED`  | Snapshot được capture từ Uploaded CandidateCV  |

---

### 6.4. Generated content rule

Nếu:

```text
sourceType = GENERATED
```

thì:

```text
generatedContent = required
pdfFile = required
```

`generatedContent` phải là bản copy của structured Generated CV content tại thời điểm capture.

Việc cùng sử dụng shape dữ liệu của Generated CV V7 không tạo live relationship với CandidateCV.

Nếu:

```text
sourceType = UPLOADED
```

thì:

```text
generatedContent = absent
pdfFile = required
```

---

### 6.5. Snapshot mutation rule

Snapshot không được patch như live CandidateCV.

Apply:

```text
none
  ↓
SubmittedCvSnapshot #1
```

Replace:

```text
SubmittedCvSnapshot hiện tại
  ↓ replace toàn bộ
SubmittedCvSnapshot mới
```

Không giữ snapshot cũ trong Application.

---

### 6.6. Reference rules

`sourceCandidateCvId` là provenance reference.

Reference này không được dùng để hiển thị live CandidateCV thay cho snapshot.

Canonical read meaning:

```text
Application CV content
=
Application.submittedCvSnapshot
```

không phải:

```text
populate / resolve CandidateCV hiện tại
```

---

## 7. `CvSnapshotPdfFile_EMBEDDED`

### 7.1. Responsibility

Embedded document này lưu canonical metadata cần thiết để Application sử dụng PDF thuộc current Submitted CV Snapshot.

PDF representation phải bảo đảm:

```text
CandidateCV thay đổi hoặc Replace file
≠
Application PDF tự thay đổi
```

Exact storage mechanism không thuộc Data Contract.

---

### 7.2. Fields

| Field              | Type      | Required | Default | Constraint        | Ý nghĩa                            |
| ------------------ | --------- | -------- | ------- | ----------------- | ---------------------------------- |
| `storageKey`       | `String`  | YES      | —       | non-empty         | Canonical locator của snapshot PDF |
| `originalFileName` | `String`  | YES      | —       | non-empty         | Tên file tại capture time          |
| `mimeType`         | `String`  | YES      | —       | `application/pdf` | Loại file                          |
| `sizeBytes`        | `Integer` | YES      | —       | > 0               | Kích thước PDF                     |
| `pageCount`        | `Integer` | YES      | —       | > 0               | Số trang PDF                       |

### 7.3. File integrity

`storageKey` phải resolve tới PDF có lifecycle độc lập với mutable current file của CandidateCV.

Với Generated CV:

```text
PDF
=
bản render tương ứng với Generated content tại capturedAt
```

Với Uploaded CV:

```text
PDF
=
file Candidate submit tại capturedAt
```

Data Contract không bắt buộc implementation phải dùng:

* copy vật lý;
* storage bucket riêng;
* object versioning;
* immutable object key;
* retention reference counting;

miễn behavior cuối cùng bảo đảm PDF snapshot không bị thay đổi hoặc mất chỉ vì CandidateCV gốc thay đổi/Archive/replace file.

---

# 8. State Matrix

## 8.1. Application status × Withdraw fields

| `status`    | `withdrawnAt` | `withdrawReason` | Hợp lệ | Ý nghĩa                                               |
| ----------- | ------------- | ---------------- | ------ | ----------------------------------------------------- |
| `APPLIED`   | `null`        | `null`           | YES    | Application đang active ở entry stage                 |
| `APPLIED`   | non-null      | bất kỳ           | NO     | Không được có withdrawal timestamp khi chưa WITHDRAWN |
| `APPLIED`   | `null`        | non-null         | NO     | Không persist withdraw reason trước Withdraw          |
| `WITHDRAWN` | non-null      | `null`           | YES    | Withdraw không có lý do                               |
| `WITHDRAWN` | non-null      | non-null         | YES    | Withdraw có lý do                                     |
| `WITHDRAWN` | `null`        | bất kỳ           | NO     | WITHDRAWN phải ghi nhận thời điểm Withdraw            |

---

## 8.2. Snapshot source matrix

| `sourceType` | `generatedContent` | `pdfFile` | Hợp lệ |
| ------------ | ------------------ | --------- | ------ |
| `GENERATED`  | present            | present   | YES    |
| `GENERATED`  | absent             | present   | NO     |
| `GENERATED`  | present            | absent    | NO     |
| `UPLOADED`   | absent             | present   | YES    |
| `UPLOADED`   | present            | present   | NO     |
| `UPLOADED`   | bất kỳ             | absent    | NO     |

---

## 8.3. Source × initial status

V9 chỉ cho phép creation state:

| `source`             | Initial `status` | Hợp lệ |
| -------------------- | ---------------- | ------ |
| `DIRECT_APPLICATION` | `APPLIED`        | YES    |
| `DIRECT_APPLICATION` | `WITHDRAWN`      | NO     |

`WITHDRAWN` chỉ xuất hiện thông qua transition từ persisted `APPLIED`.

---

# 9. Persistence Transitions

## 9.1. PT-01 — Direct Apply

### Business source

* `F01`
* `F02`
* `F03`
* `BR-01` – `BR-27`

### Trước

```text
Candidate User tồn tại

Job tồn tại

Company của Job tồn tại

CandidateCV tồn tại

không tồn tại Application:
candidateUserId = Candidate
AND
jobId = Job
```

Service-level eligibility tại thời điểm Apply:

```text
User = authenticated Candidate

Job.status = PUBLISHED
deadline chưa qua
Company = ACTIVE

CandidateCV.candidateUserId = Candidate
CandidateCV.status = ACTIVE
CandidateCV chưa Archive
```

### Sau

Một `Application` mới:

```text
candidateUserId = Candidate
jobId = Job
source = DIRECT_APPLICATION
status = APPLIED

submittedCvSnapshot = captured snapshot

appliedAt = now

withdrawnAt = null
withdrawReason = null

version = 0
```

### Các entity bị thay đổi

* `applications`

### Các entity không thay đổi

* `users`
* `candidate_cvs`
* `jobs`
* `companies`
* `company_members`

Apply không mutate CandidateCV nguồn.

Apply không mutate Recruitment Team.

### Invariant cần giữ

```text
Candidate + Job <= 1 Application
```

```text
Application tồn tại
→ submittedCvSnapshot tồn tại
```

```text
Direct Application mới
→ status = APPLIED
```

---

## 9.2. PT-02 — Replace Submitted CV

### Business source

* `F04`
* `BR-25` – `BR-31`
* `BR-36`
* `BR-37`
* `BR-39`

### Trước

```text
Application.status = APPLIED
Application.candidateUserId = current Candidate
```

Job vẫn còn nhận hồ sơ.

CandidateCV mới:

```text
thuộc Candidate
status = ACTIVE
chưa Archive
```

Client mutation phải dựa trên revision hiện tại tương ứng.

### Sau

Cùng một Application:

```text
candidateUserId = unchanged
jobId = unchanged
source = unchanged
status = APPLIED
appliedAt = unchanged

submittedCvSnapshot
= snapshot mới

version
= version trước + 1

updatedAt
= now
```

### Các entity bị thay đổi

* `applications`

### Các entity không thay đổi

* CandidateCV cũ;
* CandidateCV mới;
* Job;
* Company;
* User.

### Invariant cần giữ

Replace không tạo Application mới.

Snapshot cũ không được persist thành snapshot history.

Nếu expected revision không còn current, Replace không được ghi đè persisted state mới hơn.

---

## 9.3. PT-03 — Withdraw Application

### Business source

* `F05`
* `BR-32` – `BR-39`

### Trước

```text
Application.candidateUserId = current Candidate
Application.status = APPLIED
Application.version = expected current version
```

Không yêu cầu:

```text
Job còn PUBLISHED
deadline chưa qua
Company còn ACTIVE
```

### Sau

```text
status = WITHDRAWN
withdrawnAt = now
withdrawReason = provided reason hoặc null

submittedCvSnapshot = unchanged
candidateUserId = unchanged
jobId = unchanged
source = unchanged
appliedAt = unchanged

version = version trước + 1
```

### Các entity bị thay đổi

* `applications`

### Các entity không thay đổi

* Job;
* Company;
* CandidateCV;
* User.

### Invariant cần giữ

```text
status = WITHDRAWN
→ withdrawnAt != null
```

Withdraw không xóa Application.

Withdraw không xóa snapshot.

---

# 10. Transaction / Atomicity Requirements

Transaction / atomicity tại đây áp dụng cho persisted state thuộc database của hệ thống.

V9 không yêu cầu distributed transaction hoặc exactly-once guarantee với external file storage.

---

## TX-01 — Candidate–Job unique Application creation

**Business source**

* `F01`
* `BR-12`
* `BR-17`

Application creation phải bảo đảm atomic uniqueness:

```text
Candidate + Job <= 1 Application
```

Nếu nhiều Direct Apply cạnh tranh:

```text
chỉ một Application insert được commit
```

Không được tồn tại intermediate/final persisted state:

```text
Application A
candidate = C
job = J

Application B
candidate = C
job = J
```

Unique Candidate–Job database constraint là enforcement bắt buộc.

Không yêu cầu multi-document transaction chỉ để tạo Application vì:

* Application và current snapshot được persist cùng một Application document;
* Apply không mutate User;
* Apply không mutate CandidateCV;
* Apply không mutate Job;
* Apply không mutate Company.

---

## TX-02 — Current snapshot replacement atomicity

**Business source**

* `F04`
* `BR-27`
* `BR-31`
* `BR-39`

Trong một atomic Application mutation:

1. current Submitted CV Snapshot được thay toàn bộ;
2. `version` được tăng;
3. `updatedAt` phản ánh mutation.

Không được xuất hiện persisted partial snapshot như:

```text
sourceCandidateCvId = CV mới
nhưng
pdfFile / generatedContent = snapshot cũ
```

Toàn bộ `submittedCvSnapshot` được coi là một replacement unit.

Nếu expected revision không còn current:

```text
không commit replacement
```

---

## TX-03 — Withdraw atomicity

**Business source**

* `F05`
* `BR-32` – `BR-39`

Trong một atomic Application mutation:

```text
status = WITHDRAWN
withdrawnAt = now
withdrawReason = reason hoặc null
version = version + 1
```

Không được xuất hiện:

```text
status = WITHDRAWN
AND
withdrawnAt = null
```

Không được xuất hiện:

```text
withdrawnAt != null
AND
status = APPLIED
```

---

## TX-04 — Replace / Withdraw stale-write exclusion

**Business source**

* `BR-36`
* `BR-39`

Replace và Withdraw dựa trên cùng một Application revision chỉ được một mutation commit.

Ví dụ:

```text
Application.version = N
```

Hai request cùng quan sát:

```text
version = N
status = APPLIED
```

Nếu Replace commit trước:

```text
version = N + 1
```

thì Withdraw cũ dựa trên `N` không được commit.

Nếu Withdraw commit trước:

```text
status = WITHDRAWN
version = N + 1
```

thì Replace cũ không được commit.

V9 không quy định mechanism cụ thể để thực hiện conditional mutation.

---

## 10.5. External PDF side effect boundary

Submitted CV Snapshot yêu cầu PDF hợp lệ tồn tại cho submission.

Trước khi Application hoặc replacement snapshot được commit, PDF snapshot tương ứng phải đã được chuẩn bị thành công để persisted snapshot không trỏ tới một file chưa từng tồn tại.

Tuy nhiên V9 không yêu cầu:

```text
database transaction
+
external file storage
=
distributed atomic transaction
```

Nếu external file preparation thành công nhưng database commit thất bại, việc xử lý external orphan artifact là engineering cleanup concern.

Data Contract không nâng yêu cầu đó thành exactly-once external side-effect guarantee.

---

# 11. Constraint Ownership

## 11.1. Database / schema bảo vệ

| Constraint                              | Owner    | Lý do                            |
| --------------------------------------- | -------- | -------------------------------- |
| `_id` unique                            | Database | Structural identity              |
| `candidateUserId` required              | Schema   | Local field requirement          |
| `jobId` required                        | Schema   | Local field requirement          |
| `source` thuộc V9 enum                  | Schema   | Local enum                       |
| `status` thuộc V9 enum                  | Schema   | Local enum                       |
| Candidate–Job unique                    | Database | Compound uniqueness              |
| `submittedCvSnapshot` required          | Schema   | Application local invariant      |
| `pdfFile` required                      | Schema   | Snapshot local invariant         |
| `sourceType` enum                       | Schema   | Snapshot local enum              |
| `GENERATED → generatedContent required` | Schema   | Local cross-field invariant      |
| `UPLOADED → generatedContent absent`    | Schema   | Local cross-field invariant      |
| `pdfFile.mimeType = application/pdf`    | Schema   | Local file metadata invariant    |
| `sizeBytes > 0`                         | Schema   | Local numeric invariant          |
| `pageCount > 0`                         | Schema   | Local numeric invariant          |
| `version >= 0`                          | Schema   | Local concurrency representation |
| `APPLIED → withdrawnAt = null`          | Schema   | Local state matrix               |
| `WITHDRAWN → withdrawnAt != null`       | Schema   | Local state matrix               |

Schema/database không tự chứng minh referenced resource có đúng business state hay ownership.

---

## 11.2. Service bảo vệ

| Constraint                                                 | Owner                             | Lý do                                |
| ---------------------------------------------------------- | --------------------------------- | ------------------------------------ |
| authenticated actor phải là Candidate                      | Service                           | Authentication/business role context |
| Candidate chỉ Apply cho chính mình                         | Service                           | Authorization                        |
| Candidate chỉ thao tác Application của mình                | Service                           | Ownership                            |
| referenced User phải là Candidate                          | Service                           | Cross-entity business rule           |
| Job phải tồn tại                                           | Service                           | Reference lifecycle                  |
| Job phải `PUBLISHED` khi Apply/Replace                     | Service                           | Cross-document state                 |
| deadline chưa qua khi Apply/Replace                        | Service                           | Business time rule                   |
| Company của Job phải ACTIVE khi Apply/Replace              | Service                           | Cross-document tenant state          |
| CandidateCV phải thuộc Candidate                           | Service                           | Cross-document ownership             |
| CandidateCV phải `ACTIVE`                                  | Service                           | Cross-document lifecycle             |
| CandidateCV chưa Archive                                   | Service                           | Cross-document lifecycle             |
| Default CV chỉ là preselection                             | Service/UI business flow          | Không phải persistence authorization |
| Replace chỉ khi Application `APPLIED`                      | Service + conditional persistence | State transition guard               |
| Withdraw chỉ khi Application `APPLIED`                     | Service + conditional persistence | State transition guard               |
| Replace yêu cầu Job còn nhận hồ sơ                         | Service                           | Cross-document business rule         |
| Withdraw không yêu cầu Job còn nhận hồ sơ                  | Service                           | Business exception                   |
| Application tenant được resolve từ Job → Company           | Service                           | Tenant boundary                      |
| snapshot content phải được capture từ CandidateCV hiện tại | Service                           | Snapshot creation                    |
| snapshot PDF không phụ thuộc mutable CandidateCV file      | Service / storage contract        | Cross-resource integrity             |

---

## 11.3. Database + Service phối hợp

### Candidate–Job uniqueness

Service có thể kiểm tra trước để trả business result phù hợp.

Database unique constraint là final persistence guarantee.

### Stale Replace / Withdraw

Service quyết định operation eligibility.

Persistence condition dựa trên current status/revision là final concurrency guard.

# 12. Token / TTL Lifecycle

> V9 không bổ sung token hoặc TTL persistence mới.

V9 không tạo:

* Apply token;
* Application access token;
* Replace token;
* Withdraw token;
* snapshot expiration token.

Application và Submitted CV Snapshot không tự hết hạn bằng TTL.

---

# 13. Multi-tenant Data Boundary

## 13.1. Canonical tenant key

Canonical tenant của Application không được lưu bằng một duplicate `companyId` trong Application.

Tenant được resolve:

```text
Application.jobId
        ↓
Job.companyId
        ↓
Company._id
```

Canonical tenant key cuối cùng:

```text
Job.companyId
```

---

## 13.2. Resource ownership

| Resource              | Tenant owner                        | Cách xác định                       |
| --------------------- | ----------------------------------- | ----------------------------------- |
| `Job`                 | `Company`                           | `Job.companyId`                     |
| `Application`         | `Company` recruitment context       | `Application.jobId → Job.companyId` |
| Submitted CV Snapshot | Cùng tenant context với Application | Owned bởi Application               |

CandidateCV không trở thành Company-owned resource chỉ vì Candidate đã Apply.

CandidateCV tiếp tục thuộc Candidate.

Company recruitment context chỉ sở hữu quyền đối với Submitted CV Snapshot thông qua Application theo authorization của version tương ứng.

---

## 13.3. Candidate ownership khác tenant ownership

Application có hai dimension cần phân biệt:

```text
Candidate ownership
→ candidateUserId
```

và:

```text
Company tenant context
→ jobId → companyId
```

Candidate ownership quyết định Candidate-side mutation của V9.

Company tenant context quyết định Application thuộc quy trình tuyển dụng của Company nào.

Không được trộn hai dimension.

---

## 13.4. Backend tenant resolution

```text
Application
   ↓ trusted jobId
Job
   ↓ canonical companyId
Company
   ↓
Application tenant scope
```

Client-supplied:

```text
companyId
tenantId
```

không được dùng để thay đổi tenant của Application.

V9 không persist `Application.companyId`, do đó không tồn tại hai nguồn Company ownership có thể lệch nhau.

---

## 13.5. Cross-tenant constraints

Không được tồn tại Application mà tenant được reinterpret thành Company khác với Company sở hữu Job.

Không tạo direct Company assignment trên Application.

Company-side exact read/write permission được defer, nhưng persistence ownership phải giữ:

```text
Application tenant
=
Job tenant
```

---

# 14. Snapshot / Historical Data

## 14.1. Submitted CV Snapshot

Snapshot được tạo khi:

```text
Direct Apply thành công
```

hoặc:

```text
Replace Submitted CV thành công
```

Snapshot chứa:

| Field                 | Source                             | Ý nghĩa                             |
| --------------------- | ---------------------------------- | ----------------------------------- |
| `sourceCandidateCvId` | CandidateCV identity               | Provenance của current submission   |
| `name`                | CandidateCV name                   | Tên CV tại capture time             |
| `sourceType`          | CandidateCV source type            | Generated hoặc Uploaded             |
| `generatedContent`    | Generated CandidateCV content      | Structured content tại capture time |
| `pdfFile`             | Generated render hoặc Uploaded PDF | PDF Candidate thực sự submit        |
| `capturedAt`          | Submission operation               | Thời điểm snapshot được capture     |

---

## 14.2. Lifecycle

### Khi Apply

```text
CandidateCV
   ↓ capture
SubmittedCvSnapshot #1
```

Snapshot #1 trở thành current Submitted CV.

### Khi CandidateCV gốc thay đổi

```text
CandidateCV thay đổi
≠
SubmittedCvSnapshot thay đổi
```

### Khi Replace

```text
Current Snapshot #1
        ↓ replace
Current Snapshot #2
```

Snapshot #1 không được giữ như application snapshot history.

---

## 14.3. Snapshot integrity

Các thao tác sau không mutate snapshot:

* edit Generated CV;
* rename CandidateCV;
* đổi CandidateCV metadata;
* đổi visibility;
* replace Uploaded PDF trong My CVs;
* Archive CandidateCV;
* đổi Default CV;
* thay Candidate Profile.

---

## 14.4. CandidateCV archive

Nếu CandidateCV được Archive sau khi Apply:

```text
CandidateCV
→ không còn usable cho submission mới
```

nhưng:

```text
Application.submittedCvSnapshot
→ vẫn tồn tại
→ vẫn usable như submitted record
```

Không cascade remove snapshot.

---

## 14.5. Snapshot history

V9 không lưu:

```text
previousSubmittedCvSnapshots[]
applicationCvVersions[]
snapshotHistory[]
currentSnapshotId
isCurrent
```

Current snapshot là snapshot duy nhất của Application.

---

## 14.6. Job historical data

V9 không tạo Job snapshot.

Application chỉ giữ:

```text
jobId
```

Application chỉ được tạo khi Job đã `PUBLISHED`. Theo lifecycle contract V5,
Job từ `PUBLISHED` trở đi không còn thuộc hard-delete states. V9 không thêm
Application-existence deletion guard hoặc duplicate Job history vào Application.

---

# 15. Explicitly Excluded Persistence

V9 chủ động **KHÔNG thêm**:

### Trên `users`

```text
defaultCandidateCvId
applicationIds[]
```

Default CV tiếp tục thuộc persistence contract V7.

---

### Trên `candidate_cvs`

```text
applicationIds[]
submittedApplicationIds[]
```

CandidateCV không sở hữu Application lifecycle.

---

### Trên `jobs`

```text
applicationIds[]
applicationCount
hasApplications
cannotDelete
deletedAt
```

V9 không cần persisted derived deletion state và không thay V5 hard delete thành
soft delete. Job deletion tiếp tục hoàn toàn theo lifecycle contract V5.

---

### Trên `applications`

Không thêm:

```text
companyId
assignedRecruiterCompanyMemberId
sourceRecruiterCompanyMemberId
sourceInvitationId
jobSnapshot
companySnapshot
statusHistory[]
assignmentHistory[]
submittedCvSnapshots[]
currentCvVersionId
```

V9 cũng không thêm speculative downstream pipeline fields chỉ vì version sau có thể cần.

---

### Collection không thêm

Không tạo:

```text
application_cv_versions
application_status_history
application_assignment_history
job_snapshots
job_invitations
conversations
messages
candidate_availabilities
interview_schedules
notifications
```

Các collection này không thuộc V9.

---

### Index không thêm

Không thêm speculative index cho:

* My Applications search;
* Recruiter workspace;
* pipeline status board;
* assignee lookup;
* Invitation source;
* Conversation;
* Interview;
* Notification.

Các query requirement đó chưa thuộc V9.

---

# 16. Compatibility với version trước

## 16.1. V7 CandidateCV invariant phải giữ

V9 không thay:

* CandidateCV ownership;
* Generated lifecycle;
* Uploaded lifecycle;
* `DRAFT ↔ ACTIVE`;
* Archive behavior;
* visibility;
* Default CV representation;
* Uploaded PDF validation rules.

V9 chỉ đọc CandidateCV eligibility và capture snapshot.

CandidateCV vẫn là live library object.

Submitted CV Snapshot là dữ liệu Application riêng.

---

## 16.2. V8 Job Discovery invariant phải giữ

V9 không thay:

* public Job discovery;
* Company public profile;
* Job content;
* Job sorting/filtering;
* Job visibility contract.

V9 chỉ sử dụng Job được tìm thấy như target cho Direct Apply.

---

## 16.3. V5 Job lifecycle invariant phải giữ

V9 không thêm Job state mới.

Tiếp tục giữ:

```text
DRAFT
PENDING_APPROVAL
PUBLISHED
CLOSED
EXPIRED
```

V9 không thay đổi deletion condition của V5:

```text
DRAFT hoặc PENDING_APPROVAL
→ có thể hard-delete theo authority V5

PUBLISHED, CLOSED hoặc EXPIRED
→ không thuộc hard-delete states
```

Direct Application chỉ được tạo cho Job `PUBLISHED`, nên V9 không cần
Application-existence guard hoặc Apply-vs-delete coordination.

---

## 16.4. V6 Recruitment Team invariant phải giữ

V9 không thay:

* Primary Recruiter;
* Supporting Recruiter;
* Recruitment Team relationship.

Direct Application creation không mutate Recruitment Team.

V9 không persist Assigned Recruiter.

---

## 16.5. Thay đổi được phép

V9 được phép:

* thêm `applications`;
* thêm Submitted CV Snapshot embedded representation;
* thêm Candidate–Job uniqueness;
* thêm persisted revision cho Application concurrency.

---

## 16.6. Thay đổi không được phép

Không được:

* thêm Default CV field mới lên User;
* thay CandidateCV live data bằng Application snapshot;
* mutate CandidateCV khi Apply;
* thêm soft-delete state cho Job;
* tự động assign Application;
* predeclare Invitation persistence;
* tạo Job snapshot;
* lưu snapshot history;
* thêm downstream pipeline persistence chỉ vì macro diagram có sẵn.

---

# 17. Persistence Invariants

Các invariant sau phải luôn đúng ở persisted state.

### PI-01 — Candidate–Job uniqueness

```text
Một candidateUserId + jobId
→ tối đa một Application
```

**Enforcement:** Database unique constraint.

---

### PI-02 — Application identity

```text
candidateUserId
jobId
source
appliedAt
```

không được thay đổi sau creation.

**Enforcement:** Schema + Service.

---

### PI-03 — Direct Application initial state

Mọi Application được tạo bởi V9:

```text
source = DIRECT_APPLICATION
status = APPLIED
```

**Enforcement:** Schema + creation workflow.

---

### PI-04 — Snapshot required

```text
Application tồn tại
→ submittedCvSnapshot tồn tại
```

**Enforcement:** Schema.

---

### PI-05 — Current snapshot only

```text
Application
→ đúng một current submittedCvSnapshot
```

Không có persisted snapshot history V9.

**Enforcement:** Schema + Service.

---

### PI-06 — Generated snapshot structure

```text
sourceType = GENERATED
→ generatedContent present
→ pdfFile present
```

**Enforcement:** Schema.

---

### PI-07 — Uploaded snapshot structure

```text
sourceType = UPLOADED
→ generatedContent absent
→ pdfFile present
```

**Enforcement:** Schema.

---

### PI-08 — Snapshot independence

Thay đổi CandidateCV sau capture không được tự động mutate snapshot.

**Enforcement:** Snapshot copy semantics + Service/storage contract.

---

### PI-09 — Archive independence

```text
CandidateCV archived
≠
Application snapshot removed
```

**Enforcement:** Service lifecycle boundary.

---

### PI-10 — APPLIED withdrawal fields

```text
status = APPLIED
→ withdrawnAt = null
→ withdrawReason = null
```

**Enforcement:** Schema.

---

### PI-11 — WITHDRAWN timestamp

```text
status = WITHDRAWN
→ withdrawnAt != null
```

**Enforcement:** Schema + atomic transition.

---

### PI-12 — Withdraw preserves snapshot

```text
APPLIED → WITHDRAWN
→ submittedCvSnapshot unchanged
```

**Enforcement:** Service + atomic update.

---

### PI-13 — Revision monotonicity

Mỗi Replace hoặc Withdraw thành công phải làm Application revision tiến lên.

```text
new version > previous version
```

Không mutation cạnh tranh nào được ghi đè một revision mới hơn bằng stale state.

**Enforcement:** Persistence conditional mutation.

---

### PI-14 — Job lifecycle compatibility

```text
Application.jobId
→ Job được tạo Application khi Job đã PUBLISHED

V5 lifecycle
→ PUBLISHED Job không thuộc hard-delete states
```

V9 không thêm Application-existence deletion guard.

**Enforcement:** V5 Job lifecycle + V9 Apply eligibility.

---

### PI-15 — Tenant consistency

```text
Application tenant
=
Application.jobId → Job.companyId
```

Không có persisted Company ownership thứ hai trên Application.

**Enforcement:** Data shape + Service.

---

### PI-16 — Candidate ownership

```text
Application.candidateUserId
```

là canonical Candidate owner của Application.

CandidateCV dùng cho current snapshot tại capture time phải thuộc cùng Candidate.

**Enforcement:** Service.

---

### PI-17 — No automatic assignment persistence

V9 Application không chứa persisted Assigned Recruiter relationship.

Direct Apply không tạo CompanyMember responsibility mới.

**Enforcement:** Data shape.

---

# 18. Definition of Data Completion

V9 Data Contract được coi là hoàn thành khi:

* `applications` được xác định rõ responsibility;
* Candidate–Job relationship được xác định;
* Candidate–Job uniqueness được bảo vệ;
* `SubmittedCvSnapshot_EMBEDDED` được định nghĩa;
* `CvSnapshotPdfFile_EMBEDDED` được định nghĩa;
* Generated và Uploaded snapshot matrix được khóa;
* snapshot độc lập live CandidateCV;
* current-snapshot-only behavior được khóa;
* Replace persistence transition được xác định;
* Withdraw persistence transition được xác định;
* Application revision contract được xác định;
* stale Replace/Withdraw behavior có persistence guard;
* compatibility với hard-delete boundary của V5 được giữ mà không thêm
  Application-based deletion behavior;
* database/schema constraints và service constraints được phân biệt;
* tenant ownership qua Job → Company được xác định;
* không thêm duplicate `companyId`;
* không thêm reverse Application arrays;
* không thêm `User.defaultCandidateCvId`;
* không thêm Assigned Recruiter trong V9;
* không thêm Source Recruiter hoặc Source Invitation;
* không thêm future pipeline state chỉ vì macro database đã dự kiến;
* không thêm Job snapshot;
* không thêm Submitted CV history;
* external PDF side-effect boundary không bị hiểu thành distributed transaction requirement;
* compatibility V5–V8 được giữ;
* toàn bộ Persistence Invariant có enforcement owner rõ ràng;
* Explicitly Excluded Persistence không bị implementation ngoài ý muốn.

Data Completion không đồng nghĩa với việc schema đã được code.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự suy đoán data architecture quan trọng hoặc tạo thêm business behavior.

---

# 19. Implementation Boundary

Tài liệu này là **canonical persistence/data contract** của V9.

Nó trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT THE PRODUCT CONTRACT
```

Tài liệu này được phép định nghĩa:

* entity / collection;
* field;
* embedded document;
* reference;
* relationship;
* cardinality;
* enum;
* index;
* uniqueness;
* snapshot;
* persistence state;
* persistence transition;
* transaction / atomicity requirement;
* revision/concurrency persistence;
* persistence invariant;
* ownership của constraint.

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
* database-driver method cụ thể;
* transaction API cụ thể;
* source-code structure;
* external storage provider implementation;
* UI behavior;
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

Engineering docs
→ architecture truth

PROJECT_STATUS
→ implementation snapshot

Source code + tests
→ actual implementation evidence

Raw idea / macro database / diagrams
→ input material only
```

Macro database hoặc entity diagram không được override Product Specification hoặc canonical Data Contract.

Nếu implementation cần persistence behavior chưa tồn tại trong Product Specification hoặc tài liệu này, vấn đề phải được đưa trở lại canonical layer tương ứng để được quyết định trước khi implementation.
