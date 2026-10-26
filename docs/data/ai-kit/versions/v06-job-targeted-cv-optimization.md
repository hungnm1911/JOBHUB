# AI-V06 — Tối ưu CV theo Job và tạo Generated CV Draft — Data Model

> **File:** `docs/data/ai-kit/versions/v06-job-targeted-cv-optimization.md`\
> **Vai trò:** Canonical AI Persistence / Data Contract\
> **Phase:** JOBHUB AI Phase\
> **Ngôn ngữ:** Tiếng Việt\
> **Product authority:** `docs/product/ai-kit/versions/v06-job-targeted-cv-optimization.md`

---

# 1. Mục đích

Tài liệu này xác định Data Contract phục vụ AI-V06 — Tối ưu CV theo Job và tạo Generated CandidateCV Draft.

AI-V06 sử dụng Candidate CV, Job và kết quả AI Evaluation hiện có để tạo một Generated CandidateCV mới ở trạng thái `DRAFT`.

Data Contract xác định:

- dữ liệu nguồn được sử dụng;
- dữ liệu runtime cần thiết cho quá trình tối ưu;
- cấu trúc kết quả AI;
- cách kết hợp kết quả AI với nội dung CV nền;
- dữ liệu được persist trong CandidateCV;
- relationship, ownership và lifecycle;
- các constraint và persistence invariant phải giữ.

**Nguyên tắc chính:** AI-V06 tái sử dụng persistence model CandidateCV hiện hành. Version này không yêu cầu một collection hoặc persisted AI artifact riêng.

AI Product Specification là authority đối với business behavior. Data Contract không mở rộng capability đã được phê duyệt.

---

# 2. Thay đổi so với version trước

| Entity / Artifact | Classification | Trạng thái | Mô tả |
|---|---|---|---|
| `candidate_cvs` | `CANONICAL` | `UNCHANGED` | Lưu Generated Draft được tạo; không bổ sung schema field |
| `users` / Candidate Profile | `CANONICAL` | `UNCHANGED` | Nguồn thông tin cá nhân được phép tái sử dụng |
| `jobs` | `CANONICAL` | `UNCHANGED` | Target Job của yêu cầu tối ưu |
| `CVMatchProfile` | `NORMALIZED_AI` | `UNCHANGED` | Biểu diễn CV nghề nghiệp của AI-V01/V02 |
| `JobMatchProfile` | `NORMALIZED_AI` | `UNCHANGED` | Biểu diễn Job của AI-V01 |
| AI-V04 Evaluation Result | `RUNTIME_ONLY` | `UNCHANGED` | Context đánh giá và góp ý cải thiện |
| AI-V06 Generated Baseline | `RUNTIME_ONLY` | `NEW` | Nội dung Generated CV làm nền |
| AI-V06 Optimization Context | `RUNTIME_ONLY` | `NEW` | Context đầu vào của capability tối ưu |
| AI-V06 Optimization Result | `RUNTIME_ONLY` | `NEW` | Nội dung nghề nghiệp được AI đề xuất |
| Generated CandidateCV Draft mới | `CANONICAL` | `NEW` document | Bản ghi CandidateCV được tạo trong collection hiện có |

`UNCHANGED` có nghĩa schema và lifecycle contract hiện hành được giữ nguyên.

AI-V06 tạo document mới trong `candidate_cvs`, không tạo một loại entity mới.

Không có entity hoặc schema field thuộc trạng thái `UPDATED`, `DEPRECATED` hay `REMOVED`.

---

# 3. Data Classification và Entity tổng thể

## 3.1. Canonical

Các canonical source:

- CandidateCV nguồn;
- Candidate Profile thuộc `User`;
- Target Job;
- Generated CandidateCV Draft được tạo thành công.

CandidateCV Draft mới là business resource được lưu theo Backend V7.

Nội dung do AI đề xuất có thể trở thành nội dung của Draft sau khi Candidate yêu cầu tạo CV, nhưng không vì vậy được xem là thông tin nghề nghiệp đã xác minh độc lập.

## 3.2. Normalized AI

AI-V06 tái sử dụng:

- `CVMatchProfile`;
- `JobMatchProfile`.

Những abstraction này giữ semantics và source classification của các AI version trước.

AI-V06 không thêm field mới vào các profile này.

## 3.3. Derived

AI-V06 sử dụng nội dung được suy ra hoặc chuyển đổi từ dữ liệu nguồn, đặc biệt:

- nội dung nghề nghiệp được trích xuất từ Uploaded PDF;
- Generated baseline chuyển đổi từ Uploaded CV;
- nội dung nghề nghiệp do AI tối ưu.

Các representation này chỉ phục vụ xử lý hiện tại, không cần persistence riêng.

## 3.4. AI Artifact

AI-V06 Optimization Result là artifact của một lần xử lý AI.

Artifact này không có persisted lifecycle riêng.

Khi workflow thành công, nội dung phù hợp được kết hợp vào Generated CandidateCV Draft.

Không persist riêng Optimization Result như một hồ sơ AI độc lập.

## 3.5. Runtime-only

Các dữ liệu runtime gồm:

- Job/CV normalization result;
- AI-V04 Evaluation context;
- nội dung nghề nghiệp đọc từ CV;
- Generated baseline;
- dữ liệu bổ trợ từ Candidate Profile;
- context phục vụ tối ưu;
- phản hồi cấu trúc của AI-V06;
- kết quả kết hợp nội dung trước persistence.

Không tạo collection chỉ để lưu những object trung gian này.

---

# 4. Quan hệ dữ liệu

Các relationship chính:

| Quan hệ | Cardinality | Persistence | Ownership |
|---|---|---|---|
| Candidate → Source CandidateCV | 1:N | Hiện có | Candidate |
| Candidate → Generated Draft mới | 1:N | Hiện có | Candidate |
| Source CV → `CVMatchProfile` | 1:1 theo lần chuẩn hóa | Runtime | Theo Source CV |
| Target Job → `JobMatchProfile` | 1:1 theo lần chuẩn hóa | Runtime | Theo Job |
| Evaluation → AI-V06 Context | Theo yêu cầu | Runtime | Theo Candidate request |
| AI-V06 Result → Generated Draft | Theo yêu cầu thành công | Nội dung được persist trong Draft | Candidate |

AI-V06 tạo Generated Draft mới từ Source CV và Target Job đã được hệ thống xác định hợp lệ.

Source CV và Target Job là nguồn dữ liệu của quá trình xử lý, không bắt buộc trở thành persistent reference mới trong CandidateCV.

AI-V06 không bổ sung quan hệ persisted giữa Draft mới với:

- Source CV;
- Target Job;
- Evaluation Result;
- provider hoặc model;
- phiên tối ưu AI.

Các quan hệ này có thể được sử dụng trong runtime mà không phát sinh schema field mới.

---

# 5. Entity / Artifact Definitions

## 5.1. Responsibility

### `candidate_cvs`

`candidate_cvs` tiếp tục là canonical owner của CandidateCV.

Đối với AI-V06, collection này lưu:

- Generated CV Draft mới;
- metadata hợp lệ theo V7;
- toàn bộ `generatedContent` đã được kết hợp;
- ownership, trạng thái và thông tin lifecycle hiện hành.

Collection không chịu trách nhiệm lưu:

- prompt;
- phản hồi LLM gốc;
- lịch sử Evaluation;
- context tối ưu;
- source reference của V04;
- provider metadata riêng của AI-V06.

### `users`

`User` tiếp tục sở hữu dữ liệu Candidate Profile.

AI-V06 có thể đọc dữ liệu được phép để bổ sung thông tin cá nhân cho Generated Draft.

Không phát sinh mutation Candidate Profile.

### `jobs`

`Job` tiếp tục là canonical source của Target Job.

AI-V06 không thay đổi Job hoặc bổ sung persisted AI-V06 field cho Job.

---

## 5.2. Fields

### 5.2.1. CandidateCV document

AI-V06 sử dụng các field hiện có của V7.

| Field | Type | Required | Constraint / Giá trị AI-V06 | Ý nghĩa |
|---|---|---|---|---|
| `_id` | `ObjectId` | YES | Unique | Định danh Draft mới |
| `candidateUserId` | `ObjectId` | YES | Candidate đã xác thực | Owner |
| `name` | `String` | YES | Theo contract V7 | Tên CV |
| `sourceType` | Enum | YES | `GENERATED` | Loại CV mới |
| `status` | Enum | YES | `DRAFT` | Trạng thái ban đầu |
| `visibility` | Enum | YES | Giá trị hợp lệ theo V7 | Quyền hiển thị |
| `categoryId` | `ObjectId` | YES | Category hợp lệ | Metadata ngành/vị trí |
| `experienceLevelId` | `ObjectId \| null` | NO | Theo V7 | Cấp độ kinh nghiệm |
| `preferredLocations` | Array | NO | Theo V7 | Metadata địa điểm |
| `skillTags` | `String[]` | NO | Theo V7 | Skill metadata |
| `employmentTypes` | Enum[] | NO | Theo V7 | Loại hình làm việc |
| `workModes` | Enum[] | NO | Theo V7 | Hình thức làm việc |
| `generatedContent` | Object | YES với Generated | Nội dung đã kết hợp | Nội dung Harvard CV |
| `uploadedFile` | Object | NO | Không có trên Generated CV | File Uploaded |
| `isDefault` | Boolean | YES | `false` khi tạo | Trạng thái Default |
| `archivedAt` | `Date \| null` | NO | `null` khi tạo | Trạng thái archive |
| `createdAt` | Date | YES | Theo persistence hiện hành | Thời điểm tạo |
| `updatedAt` | Date | YES | Theo persistence hiện hành | Thời điểm cập nhật |

AI-V06 không định nghĩa lại các enum, reference hoặc constraint của metadata CandidateCV.

### 5.2.2. `generatedContent`

`generatedContent` sử dụng cấu trúc hiện có của Backend V7.

| Field | Type | Vai trò |
|---|---|---|
| `personalInfo` | Object | Thông tin cá nhân; Backend xử lý |
| `professionalSummary` | `String \| null` | Nội dung AI được phép chỉnh sửa |
| `skills` | `String[]` | Nội dung AI được phép chỉnh sửa |
| `workExperiences` | Object[] | Nội dung AI được phép chỉnh sửa |
| `projects` | Object[] | Nội dung AI được phép chỉnh sửa |
| `educations` | Object[] | Nội dung AI được phép chỉnh sửa |
| `certifications` | Object[] | Nội dung AI được phép chỉnh sửa |
| `languages` | Object[] | Nội dung AI được phép chỉnh sửa |
| `hiddenSections` | Enum[] | Cấu hình hiển thị; Backend giữ theo baseline phù hợp |

### 5.2.3. `personalInfo`

Các field hiện có:

| Field | Type | Nguồn |
|---|---|---|
| `fullName` | `String \| null` | Generated CV nguồn hoặc Candidate Profile |
| `email` | `String \| null` | Generated CV nguồn hoặc Candidate Profile |
| `phone` | `String \| null` | Generated CV nguồn hoặc Candidate Profile |
| `displayLocation` | `String \| null` | Dữ liệu nguồn phù hợp nếu có |
| `links` | `String[]` | Dữ liệu nguồn phù hợp nếu có |
| `avatarUrl` | `String \| null` | Generated CV nguồn hoặc Candidate Profile |

Với Generated Source CV, hệ thống ưu tiên giữ `personalInfo` hiện có của CV nguồn.

Với Uploaded Source CV, các trường tương ứng được bổ sung từ Candidate Profile khi có dữ liệu hợp lệ.

Không dùng `dateOfBirth` để tạo field mới trong `generatedContent`.

`personalInfo` không thuộc output chỉnh sửa nghề nghiệp của AI-V06.

### 5.2.4. Các item nghề nghiệp

Các nhóm array tiếp tục sử dụng field vocabulary hiện có:

| Group | Fields |
|---|---|
| `workExperiences` | `companyName`, `position`, `startDate`, `endDate`, `description`, `achievements` |
| `projects` | `name`, `role`, `technologies`, `description`, `projectUrl` |
| `educations` | `institutionName`, `degree`, `fieldOfStudy`, `startDate`, `endDate` |
| `certifications` | `name`, `issuer`, `issueDate`, `expirationDate`, `credentialId`, `credentialUrl` |
| `languages` | `name`, `proficiency` |

Các scalar nghề nghiệp có thể mang giá trị `null` nếu cấu trúc CandidateCV hiện hành cho phép.

Các mảng nội dung như `achievements` và `technologies` sử dụng danh sách chuỗi theo contract V7.

Date field được lưu theo kiểu `Date` hoặc `null` ở persistence layer.

AI-V06 không thêm public item ID, subdocument lifecycle hoặc field mới cho các nhóm trên.

---

## 5.3. Enum

AI-V06 tái sử dụng enum hiện hành:

| Field | Enum source |
|---|---|
| `sourceType` | Candidate CV Source Type |
| `status` | Candidate CV Status |
| `visibility` | Candidate CV Visibility |
| `languages[].proficiency` | CV Language Proficiency |
| `employmentTypes[]` | Employment Type |
| `workModes[]` | Work Mode |
| `hiddenSections[]` | Harvard CV Section |

Đối với Draft mới:

- `sourceType = GENERATED`;
- `status = DRAFT`;
- `isDefault = false`.

`languages[].proficiency` sử dụng các giá trị canonical hiện có:

- `BEGINNER`;
- `INTERMEDIATE`;
- `ADVANCED`;
- `FLUENT`;
- `NATIVE`;
- hoặc `null`.

AI-V06 không bổ sung enum nghiệp vụ mới.

---

## 5.4. Indexes

AI-V06 không yêu cầu index mới.

Các index hiện có của CandidateCV tiếp tục phục vụ:

- truy vấn theo Candidate owner;
- lọc CV chưa archive;
- bảo đảm quy tắc Default CV;
- các truy vấn visibility và Category hiện hành.

Không bổ sung index cho Target Job, Source CV hoặc Optimization Result khi các quan hệ này chưa có persistence requirement.

---

## 5.5. Reference rules

- `candidateUserId` tham chiếu Candidate owner.
- `categoryId` tham chiếu Category hợp lệ theo V7.
- `experienceLevelId` tham chiếu ExperienceLevel nếu có.
- Source CV và Target Job được resolve trong runtime theo quyền truy cập hiện hành.
- Optimization Result không có persisted reference riêng.

Identifier do client cung cấp không tự chứng minh ownership hoặc quyền truy cập.

---

# 6. AI-derived Data Contract

## 6.1. `CVMatchProfile`

**Source:** CandidateCV.

**Persistence:** `RUNTIME_ONLY`, theo contract AI-V01/V02 hiện hành.

`CVMatchProfile` có thể được tạo từ:

- Generated CV;
- Uploaded CV.

Hai nguồn có cùng mục tiêu biểu diễn nội dung nghề nghiệp cho AI nhưng vẫn giữ khác biệt về source shape và provenance.

AI-V06 không yêu cầu thay đổi `CVMatchProfile` để biến nó thành bản sao đầy đủ của Generated CV.

Đặc biệt, `CVMatchProfile` không phải nơi lưu toàn bộ thông tin quản lý CV hoặc thông tin cá nhân.

---

## 6.2. `JobMatchProfile`

**Source:** Target Job.

**Persistence:** Theo contract normalization hiện hành; AI-V06 không bổ sung persistence.

Responsibility:

- cung cấp nội dung Job đã chuẩn hóa;
- hỗ trợ AI hiểu yêu cầu tuyển dụng;
- giữ semantics do AI-V01 xác định.

AI-V06 không thay đổi cấu trúc hoặc source-of-truth của JobMatchProfile.

---

## 6.3. AI-V04 Evaluation Result

**Source:** Job/CV normalization result và capability Evaluation.

**Persistence:** `RUNTIME_ONLY`.

AI-V06 sử dụng Evaluation Result làm context, bao gồm những đánh giá và góp ý cải thiện phù hợp.

AI-V06 không yêu cầu:

- persist Evaluation Result;
- thêm evaluation history;
- thêm snapshot CV/Job vào Evaluation Result;
- thay đổi output contract của AI-V04.

Source reference trong V04 tiếp tục có ý nghĩa theo phạm vi request hiện hành, không trở thành định danh item bền vững cho AI-V06.

---

## 6.4. AI-V06 Generated Baseline

**Classification:** `RUNTIME_ONLY`.

**Responsibility:** Cung cấp cấu trúc Generated CV làm nền trước khi áp dụng nội dung AI-V06.

### Generated Source CV

Baseline sử dụng `generatedContent` hiện có của Source CV.

Các trường ngoài phạm vi AI chỉnh sửa được giữ từ dữ liệu nguồn phù hợp.

### Uploaded Source CV

Baseline được chuyển đổi best-effort từ nội dung nghề nghiệp đã trích xuất bởi AI-V02.

Do Uploaded PDF và Generated CV không có cùng cấu trúc, việc chuyển đổi có thể thiếu một số giá trị.

Các khác biệt tiêu biểu:

| Dữ liệu Uploaded | Generated baseline |
|---|---|
| Summary, skills | Chuyển sang nhóm tương ứng |
| Work Experiences | Chuyển các field phù hợp |
| Projects | Chuyển các field phù hợp |
| Educations | Chuyển các field phù hợp |
| Certifications | Chuyển các field phù hợp |
| Languages | Chuyển các field phù hợp |
| Period dạng văn bản | Không mặc định trở thành ngày chính xác |
| Proficiency diễn đạt tự do | Không mặc định trở thành enum canonical |
| PDF evidence | Không persist thành Generated CV field mới |
| Other/unresolved career claims | Có thể làm AI context; không tạo field Generated mới |

Những giá trị chưa ánh xạ được có thể giữ `null` hoặc danh sách rỗng tùy field.

Không yêu cầu bảo toàn toàn bộ nội dung PDF trong Generated Draft.

---

## 6.5. AI-V06 Optimization Context

**Classification:** `RUNTIME_ONLY`.

**Responsibility:** Tập hợp thông tin cần thiết cho lần tối ưu hiện tại.

Nhóm dữ liệu có thể gồm:

| Nhóm | Nguồn |
|---|---|
| Target Job context | Job / JobMatchProfile |
| CV career context | CVMatchProfile |
| Evaluation advice | AI-V04 |
| Baseline career content | Generated baseline |
| Source classification | Source CV |
| Relevant source evidence | Normalization hiện hành |

Optimization Context không phải persisted entity.

Không yêu cầu AI nhận toàn bộ Candidate Profile, CandidateCV management metadata hoặc thông tin cá nhân chỉ để tạo nội dung nghề nghiệp.

---

## 6.6. AI-V06 Optimization Result

**Classification:** `RUNTIME_ONLY`.

**Source:** AI-V06 capability.

**Responsibility:** Biểu diễn phần nội dung nghề nghiệp mà AI đề xuất thay đổi.

Optimization Result không phải một CandidateCV document hoàn chỉnh.

### Top-level fields

| Field | Data type | Required trong structured output | Ý nghĩa |
|---|---|---:|---|
| `professionalSummary` | `String \| null` | YES | Nội dung thay thế hoặc giữ baseline |
| `skills` | `String[] \| null` | YES | Danh sách thay thế hoặc giữ baseline |
| `workExperiences` | `Object[] \| null` | YES | Danh sách thay thế hoặc giữ baseline |
| `projects` | `Object[] \| null` | YES | Danh sách thay thế hoặc giữ baseline |
| `educations` | `Object[] \| null` | YES | Danh sách thay thế hoặc giữ baseline |
| `certifications` | `Object[] \| null` | YES | Danh sách thay thế hoặc giữ baseline |
| `languages` | `Object[] \| null` | YES | Danh sách thay thế hoặc giữ baseline |

Những field có trong schema được biểu diễn rõ ràng, kể cả khi không có thay đổi.

Các object item sử dụng field vocabulary tương ứng của Generated CV V7.

Những field con có thể thiếu thông tin sử dụng `null` khi phù hợp.

Không đưa `personalInfo`, `hiddenSections`, metadata quản lý hoặc lifecycle field vào Optimization Result.

### Change semantics

| Giá trị output | Ý nghĩa |
|---|---|
| Top-level section = `null` | Giữ section từ Generated baseline |
| Top-level section = array | Thay toàn bộ array tương ứng |
| Top-level section = `[]` | Thay bằng danh sách rỗng |
| Scalar field trong item = `null` | Giá trị item đó chưa có/không xác định |
| Các section đều `null` | Output hợp lệ, không có thay đổi nội dung nghề nghiệp; baseline vẫn được sử dụng |

Các phần tử trong array kết quả là những item của danh sách mới, không phải patch theo item ID hoặc index cũ.

AI-V06 không yêu cầu item-level diff, item-level identity hoặc operation log.

### Persistence

Optimization Result không được persist như một artifact độc lập.

Backend kết hợp nó với Generated baseline để hình thành `generatedContent` của CandidateCV mới.

Kết quả được tiếp nhận theo structured-output contract của capability.

Không bổ sung semantic rejection gate để kiểm tra lại mức độ hữu ích hoặc tính chính xác của nội dung AI sau khi output đã đáp ứng contract.

Các constraint thuộc CandidateCV V7 vẫn áp dụng cho dữ liệu được persist.

---

# 7. Embedding / Vector Data

> AI-V06 không bổ sung embedding/vector persistence.

AI-V06 không yêu cầu:

- vector embedding cho Source CV;
- vector embedding cho Generated Draft;
- vector index mới;
- retrieval collection mới;
- embedding lifecycle riêng.

Những capability vector/retrieval thuộc các version khác không bị thay đổi bởi Data Contract này.

---

# 8. State Matrix

AI-V06 không bổ sung persisted AI state riêng.

Generated Draft tiếp tục sử dụng state invariant của CandidateCV V7.

| `sourceType` | `status` | `isDefault` | Hợp lệ cho kết quả AI-V06 |
|---|---|---:|---:|
| `GENERATED` | `DRAFT` | `false` | YES |
| `GENERATED` | `DRAFT` | `true` | NO |
| `GENERATED` | `ACTIVE` | `false` hoặc `true` | Không phải trạng thái AI-V06 tự tạo |
| `UPLOADED` | `DRAFT` | Bất kỳ | NO |

AI-V06 không tự tạo Active CV.

Những state khác tiếp tục thuộc contract V7.

---

# 9. Persistence Transitions

## 9.1. Tạo Generated Draft từ yêu cầu AI-V06

**Business source:** Candidate yêu cầu tối ưu CV theo Job.

**Before:**

- Source CV tồn tại;
- Target Job hợp lệ;
- chưa có CandidateCV kết quả của yêu cầu thành công.

**After:**

- một Generated CandidateCV Draft mới được tạo;
- `generatedContent` chứa nội dung đã kết hợp;
- Source CV giữ nguyên;
- Target Job giữ nguyên;
- Candidate Profile giữ nguyên.

**Persisted entity thay đổi:** `candidate_cvs`.

Không persist Evaluation Result hoặc Optimization Result riêng.

## 9.2. Preview Generated Draft

Preview sử dụng Generated CV content hiện hành.

Không tạo hoặc thay đổi persisted AI artifact.

Không chuyển Draft thành Active.

## 9.3. Candidate tiếp tục chỉnh sửa Draft

Các thay đổi sau khi Draft được tạo thuộc workflow CandidateCV V7.

AI-V06 không định nghĩa lại quy tắc save, completeness, activation hoặc default CV.

---

# 10. Transaction / Atomicity Requirements

AI-V06 không bổ sung cross-document transaction requirement mới.

Kết quả thành công của workflow phải tương ứng với một Generated Draft có nội dung đã được kết hợp và lưu theo contract CandidateCV.

Việc tạo CV mới và lưu content có thể được tổ chức bằng các cơ chế persistence phù hợp với kiến trúc Backend.

Nếu thao tác không hoàn tất, hệ thống không được báo rằng Generated Draft đã được tạo thành công khi kết quả persistence chưa tương ứng.

Chi tiết kiểm soát partial write, retry hoặc recovery thuộc Engineering Contract.

Không tạo transaction chỉ để persist các runtime artifact vốn không cần lưu.

---

# 11. Constraint Ownership

## 11.1. Database / Schema

Backend V7 tiếp tục sở hữu:

- `sourceType` và `status` enum;
- Generated CV phải có `generatedContent`;
- Generated CV không có `uploadedFile`;
- Draft không được là Default;
- các field type và enum hiện hành;
- local document invariants;
- unique index liên quan đến Default CV.

AI-V06 không thay thế những constraint này.

## 11.2. Service

Backend service chịu trách nhiệm:

- xác thực Candidate;
- kiểm tra ownership Source CV;
- kiểm tra quyền sử dụng Target Job;
- đọc Candidate Profile đúng owner;
- cung cấp metadata hợp lệ;
- kết hợp Generated baseline với Optimization Result;
- lưu Generated Draft theo lifecycle V7;
- xác định kết quả persistence của action.

Service không dùng identifier do AI tạo làm bằng chứng ownership.

## 11.3. AI Processing

AI processing chịu trách nhiệm tạo Optimization Result theo expected structure.

Structured-output contract phải đủ rõ để biểu diễn:

- bảy nhóm nghề nghiệp;
- nhóm không thay đổi;
- nhóm được thay thế;
- nội dung item chưa xác định;
- enum và data type cần thiết cho Generated CV.

Output đúng contract được sử dụng cho bước kết hợp Draft.

Nếu toàn bộ inference không tạo được output hoàn tất và đúng contract, không có Optimization Result hợp lệ để kết hợp và không được biểu diễn yêu cầu như một kết quả thành công.

Không bổ sung semantic validation nhằm loại bỏ phản hồi hợp lệ vì đánh giá chất lượng nội dung, khả năng tăng điểm hoặc mức độ khác biệt so với CV nguồn.

AI processing không sở hữu authorization hoặc CandidateCV lifecycle decision.

---

# 12. Freshness và Provenance

AI-V06 không persist derived artifact hoặc cache mới cần vòng đời `FRESH`/`STALE`.

Các nguồn liên quan:

- Source CV;
- Target Job;
- Candidate Profile nếu được sử dụng;
- Evaluation context từ AI-V04.

Evaluation Result hiện hành là runtime-only.

AI-V06 không yêu cầu persisted source revision, snapshot hoặc historical provenance riêng.

Những dữ liệu dùng trong một lần tạo Draft cần được resolve trong phạm vi quyền truy cập của request đó.

Source reference của V04, đặc biệt với item dạng array của Generated CV, không được xem là persisted stable item identity.

Sau khi Generated Draft đã được tạo, việc Source CV hoặc Job thay đổi không tự động cập nhật Draft mới.

Generated Draft là business resource độc lập và tiếp tục tuân thủ lifecycle CandidateCV.

---

# 13. Ownership / Multi-tenant Data Boundary

| Artifact / Entity | Owner |
|---|---|
| Source CandidateCV | Candidate sở hữu CV |
| Candidate Profile | Candidate tương ứng |
| Target Job | Theo canonical Job ownership và visibility |
| AI-V04 Evaluation context | Candidate request hiện tại |
| AI-V06 Optimization Context | Candidate request hiện tại |
| AI-V06 Optimization Result | Candidate request hiện tại |
| Generated Draft mới | Candidate thực hiện yêu cầu |

AI-V06 không tạo persisted artifact có thể được truy cập cross-user ngoài CandidateCV contract hiện hành.

Backend xác định owner từ authenticated actor.

Không sử dụng Candidate Profile hoặc Source CV của người khác để tạo Draft.

> AI-V06 không bổ sung multi-tenant data boundary mới.

---

# 14. Snapshot / Historical Data

> AI-V06 không bổ sung snapshot/historical persistence mới.

Không lưu riêng:

- Source CV snapshot;
- Target Job snapshot;
- Evaluation snapshot;
- Optimization Result history;
- prompt/response history;
- CV item revision;
- AI optimization session history.

Generated Draft mới là một CandidateCV document độc lập.

Việc nó chứa nội dung được tạo từ dữ liệu nguồn tại thời điểm xử lý không đồng nghĩa hệ thống duy trì historical linkage hoặc đồng bộ với Source CV/Job.

Các cơ chế lịch sử hoặc versioning có thể được xem xét ở capability khác khi có Product requirement.

---

# 15. Retention / TTL

AI-V06 không tạo persisted AI artifact cần TTL.

| Dữ liệu | Retention | Cleanup |
|---|---|---|
| Optimization Context | Runtime request | Kết thúc xử lý |
| Optimization Result | Runtime request | Kết thúc xử lý |
| Generated Baseline | Runtime request | Kết thúc xử lý |
| Generated Draft | Theo CandidateCV V7 | Theo lifecycle CV hiện hành |

Không bổ sung TTL index hoặc cleanup job riêng.

---

# 16. Explicitly Excluded Persistence

AI-V06 chủ động không bổ sung:

- collection AI-V06 Optimization;
- collection Agent Proposal;
- collection Evaluation History;
- collection AI Session;
- lịch sử prompt;
- lịch sử provider response;
- bản sao Source CV phục vụ AI;
- bản sao Target Job;
- snapshot hồ sơ Candidate;
- persisted item-level diff;
- persisted AI-generated claim evidence;
- trường `optimizedForJobId` mới;
- trường `sourceCvId` mới chỉ phục vụ AI-V06;
- provider/model-specific field trên CandidateCV;
- embedding hoặc vector index mới;
- background job state riêng khi chưa có requirement;
- speculative metadata phục vụ use case tương lai.

Không thêm persistence chỉ để thuận tiện debug hoặc dự phòng các capability chưa thuộc AI-V06.

---

# 17. Compatibility với version trước

## 17.1. Invariant phải giữ

- CandidateCV ownership.
- Generated/Uploaded source-type invariant.
- Draft/Active lifecycle.
- Draft completeness behavior.
- Default CV invariant.
- Archived CV behavior.
- Job visibility và authorization.
- AI-V03/V04 score và evaluation semantics.

## 17.2. Existing schema phải giữ

Không yêu cầu thay đổi:

- CandidateCV schema;
- User/Candidate Profile schema;
- Job schema;
- Harvard Generated Content schema;
- Source Type / Status / Visibility enums.

## 17.3. AI data contract phải giữ

- `CVMatchProfile` và `JobMatchProfile` giữ semantics hiện hành.
- Generated CV normalization tiếp tục giữ nội dung nghề nghiệp theo contract AI-V01.
- Uploaded CV normalization giữ đặc điểm extraction của AI-V02.
- AI-V04 Evaluation Result không bị diễn giải thành persisted revision hoặc full Generated CV.

## 17.4. Thay đổi được phép

AI-V06 được bổ sung:

- runtime Optimization Context;
- runtime Generated Baseline;
- runtime Optimization Result;
- logic kết hợp nội dung;
- workflow tạo Generated CandidateCV Draft mới qua Backend.

Những bổ sung này không tạo business state mới.

## 17.5. Thay đổi không được phép

AI-V06 không được âm thầm:

- thay đổi Generated CV item schema;
- thay đổi enum hoặc completeness policy V7;
- thay đổi Source CV trong quá trình tạo Draft;
- thay đổi semantics Matching/Scoring;
- lưu Evaluation Result thành canonical Candidate fact;
- tự bổ sung persisted AI history hoặc source linkage ngoài Product Contract.

---

# 18. Persistence Invariants

| Invariant | Enforcement owner |
|---|---|
| Generated Draft mới thuộc đúng Candidate | Service + Database |
| Draft mới có `sourceType=GENERATED` | Service + Schema |
| Draft mới có `status=DRAFT` | Service + Schema |
| Draft mới không phải Default | Service + Schema |
| Generated CV có `generatedContent`, không có `uploadedFile` | Schema + Database |
| Source CV không bị sửa bởi AI-V06 | Service |
| Target Job không bị sửa bởi AI-V06 | Service |
| Optimization Result không persist thành artifact riêng | AI processing + Service |
| `personalInfo` và metadata ngoài quyền chỉnh sửa trực tiếp của AI | Service |
| Output AI được kết hợp theo change semantics của contract | Service |
| Output hợp lệ không bị chặn bởi semantic quality gate bổ sung | AI processing + Service |
| Technical failure không persist thành negative evaluation | AI processing + Service |
| Unauthorized source không được sử dụng | Service |
| Generated Draft được Preview theo V7 | Service |
| AI-V06 không tự Activate hoặc Apply Job | Service |
| Không phát sinh cross-user ownership | Service + Database |

AI-generated content được lưu trong CandidateCV Draft sau action được phép của Candidate.

Điều này không đồng nghĩa mọi claim nghề nghiệp bên trong đã được hệ thống xác minh là đúng.

Các invariant của V7 tiếp tục có hiệu lực mà không cần nhân bản toàn bộ constraint sang AI-V06.

---

# 19. Definition of AI Data Completion

AI-V06 Data Contract được coi là hoàn thành khi:

- canonical source của Job, CV và Candidate Profile đã rõ;
- Generated và Uploaded source được phân biệt;
- các runtime artifact có classification rõ;
- Generated baseline và Optimization Result có trách nhiệm rõ;
- structured output có semantics đủ để thực hiện việc kết hợp nội dung;
- persisted target là CandidateCV V7;
- không cần entity, collection hoặc schema field mới;
- owner của constraints được xác định;
- relationship và authorization được giữ;
- không cần embedding/vector persistence;
- không cần snapshot, history hoặc TTL mới;
- không tạo state transition mới ngoài V7;
- không thay đổi AI-V01–V04 Data Contract;
- không có speculative persistence ngoài phạm vi Product;
- persistence invariants có enforcement owner.

Data Completion không đồng nghĩa implementation đã hoàn tất.

Nó có nghĩa Data Contract đủ rõ để Engineering triển khai AI-V06 trên những canonical entity và abstraction đã tồn tại mà không phải tự mở rộng business capability.

---

# 20. Implementation Boundary

Tài liệu này là:

**CANONICAL AI PERSISTENCE / DATA CONTRACT**

Tài liệu xác định:

- dữ liệu nào cần tồn tại;
- dữ liệu nào chỉ tồn tại runtime;
- entity nào lưu Generated Draft;
- cấu trúc dữ liệu nghề nghiệp được sử dụng;
- relationship và ownership;
- semantics của dữ liệu thay đổi và giữ nguyên;
- state và persistence transition;
- constraint ownership;
- compatibility với AI version trước;
- những persistence artifact không được tự bổ sung.

Tài liệu này không định nghĩa:

- LLM provider hoặc model;
- prompt;
- temperature và token budget;
- provider-specific schema implementation;
- thuật toán chuyển đổi Uploaded CV;
- thuật toán kết hợp nội dung cụ thể;
- function calling hoặc Agent reasoning;
- REST endpoint;
- controller hoặc service implementation;
- transaction API cụ thể;
- MongoDB query hoặc Mongoose method;
- frontend component;
- test framework;
- chiến lược retry/fallback kỹ thuật.

## Canonical hierarchy

1. **AI Product Specification** — WHAT MUST HAPPEN.
2. **AI Data Contract** — WHAT MUST EXIST / PERSIST.
3. **AI Engineering Contracts** — HOW THE AI SYSTEM IS STRUCTURED.
4. **Implementation** — Backend, AI Kit, Frontend.
5. **Tests / Evaluation** — Implementation evidence.

## Authority

| Nguồn | Authority |
|---|---|
| Approved AI Product Spec | Business / capability truth |
| Approved AI Data Contract | Persistence / data truth |
| Approved Engineering Contracts | Architecture / algorithm truth |
| Source code và tests | Implementation evidence |

Nếu Engineering cần bổ sung một persistence field, business transition hoặc capability chưa được Product Specification cho phép, thay đổi đó phải được đánh giá lại theo đúng authority hierarchy.

**AI-V06 Data Contract hoàn thành mục tiêu khi kết quả tối ưu có cấu trúc được kết hợp với dữ liệu CV nguồn để tạo một Generated CandidateCV Draft hợp lệ theo V7, mà không cần mở rộng persistence model hoặc lifecycle của JOBHUB.**
