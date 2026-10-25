
# AI-V05 — Candidate Job Recommendation Data Model

> **Document:** `docs/data/ai-kit/versions/v05-candidate-job-recommendation.md`  
> **Vai trò:** Canonical AI Data Contract  
> **Phase:** JOBHUB AI Phase  
> **Ngôn ngữ:** Tiếng Việt  
> **Product authority:** [AI-V05 — Candidate Job Recommendation Product Specification](../../../product/ai-kit/versions/v05-candidate-job-recommendation.md)  
> **Trạng thái:** APPROVED — dựa trên các Product/Data Decisions đã được phê duyệt cho AI-V05

---

# 1. Mục đích

AI-V05 cung cấp khả năng đề xuất các Job phù hợp với Candidate dựa trên Default CV, kết hợp Vector Search, semantic assessment và Matching/Scoring Engine hiện có của AI-V03.

Data Contract này xác định:

- Nguồn dữ liệu canonical được AI-V05 sử dụng.
- Dữ liệu dẫn xuất cần lưu để phục vụ Vector Search.
- Dữ liệu chỉ tồn tại trong quá trình xử lý recommendation.
- Quan hệ giữa Candidate, CV, Job, Company và kết quả recommendation.
- Quy tắc ownership, freshness, visibility và compatibility với AI-V01/V02/V03.
- Ranh giới giữa Backend persistence và AI Kit computation.

**AI-V05 không tạo một hệ thống dữ liệu tuyển dụng độc lập.** Job, CandidateCV, Category, ExperienceLevel và các trạng thái nghiệp vụ tiếp tục sử dụng canonical Backend hiện hành.

Thay đổi persistence chính của AI-V05 là bổ sung biểu diễn văn bản ngữ nghĩa cho Job, phục vụ MongoDB Atlas Automated Embedding.

AI-V05 không yêu cầu lưu CV embedding, normalized profile, Match Score hoặc lịch sử recommendation.

---

# 2. Thay đổi so với version trước

| Entity / Artifact | Classification | Trạng thái | Persistence |
|---|---|---|---|
| `Job` | `CANONICAL` | `UPDATED` | Thêm dữ liệu dẫn xuất `embeddingText` |
| `CandidateCV` | `CANONICAL` | `UNCHANGED` | Giữ nguyên |
| `Company` | `CANONICAL` | `UNCHANGED` | Giữ nguyên |
| Category và ExperienceLevel | `CANONICAL` | `UNCHANGED` | Giữ nguyên |
| `JobMatchProfile` | `NORMALIZED_AI` | `UNCHANGED` | `RUNTIME_ONLY` |
| `CVMatchProfile` | `NORMALIZED_AI` | `UNCHANGED` | `RUNTIME_ONLY` |
| Job embedding representation | `DERIVED` | `NEW` | `embeddingText` trong Job |
| Atlas Vector Search Index | Search infrastructure | `NEW` | Atlas-managed |
| CV query representation | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Vector retrieval candidates | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Batch semantic assessment | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Recommendation result | `AI_ARTIFACT` | `NEW` | `RUNTIME_ONLY` |

`NEW` đối với runtime artifact không đồng nghĩa với việc tạo MongoDB collection.

Không có canonical entity nào bị `DEPRECATED` hoặc `REMOVED`.

AI-V05 không thay đổi Data Contract đã có của AI-V03 cho matching một cặp Job–CV.

---

# 3. Data Classification

## 3.1. CANONICAL

Các nguồn dữ liệu nghiệp vụ hiện hành:

- `User` — danh tính Candidate.
- `CandidateCV` — CV thuộc sở hữu Candidate, bao gồm Generated CV và Uploaded CV.
- `Job` — tin tuyển dụng cùng nội dung, metadata và lifecycle.
- `Company` — chủ sở hữu Job và trạng thái đủ điều kiện công khai.
- `Category` — hệ thống FIELD/POSITION canonical.
- `ExperienceLevel` — catalog cấp độ kinh nghiệm.
- Các giá trị EmploymentType, WorkMode và metadata Job/CV khác đã được Backend định nghĩa.

Backend tiếp tục là owner của những nguồn dữ liệu này.

## 3.2. NORMALIZED_AI

AI-V05 tái sử dụng:

- `JobMatchProfile` từ AI-V01.
- `CVMatchProfile` từ AI-V01/V02.

Các profile giữ nguyên:

- Source identity.
- Normalized value.
- Provenance và source path.
- Missing/uncertainty semantics.
- Readiness và validation contract hiện có.

AI-V05 không mở rộng hoặc sửa trực tiếp cấu trúc hai profile chỉ để phục vụ embedding.

## 3.3. DERIVED

Dữ liệu được tính từ nguồn canonical hoặc normalized profile:

- Job `embeddingText`.
- CV query text.
- Vector similarity result.
- Retrieval shortlist.
- Batch semantic assessment.
- Deterministic field assessment.
- Weighted Match Score.

Trong đó, chỉ Job `embeddingText` được persist theo AI-V05.

## 3.4. AI_ARTIFACT

Recommendation result trả về cho Candidate:

- Job đủ điều kiện hiển thị.
- Match Score cuối cùng.
- Lý do phù hợp được LLM tạo.
- Thứ tự recommendation.

Artifact này chỉ có giá trị trong lần xử lý hiện tại.

## 3.5. RUNTIME_ONLY

Những dữ liệu sau không được lưu thành entity:

- Default CV đã chọn trong request.
- `CVMatchProfile` và `JobMatchProfile`.
- CV query text.
- Danh sách Vector Search hits.
- Job shortlist.
- `jobKey` ánh xạ trong batch.
- LLM assessment và reason.
- Score calculation intermediates.
- Recommendation response.

---

# 4. Quan hệ dữ liệu

| Nguồn | Đích | Quan hệ | Ý nghĩa |
|---|---|---|---|
| Candidate User | CandidateCV | `1:N` | Candidate sở hữu các CV |
| Candidate User | Default CandidateCV | `0..1` | Có thể chưa thiết lập Default CV |
| Company | Job | `1:N` | Mỗi Job thuộc một Company |
| Job | Category FIELD/POSITION | Theo Backend contract | Phân loại ngành và vị trí |
| Job | ExperienceLevel | Theo Backend contract | Yêu cầu cấp độ kinh nghiệm |
| CandidateCV | Category/ExperienceLevel | Theo Backend contract | Thông tin nghề nghiệp của CV |
| Job | `embeddingText` | `0..1` | Biểu diễn tìm kiếm dẫn xuất của Job |
| Default CV | Retrieval request | `1:1` | Một request dùng một Default CV |
| Retrieval request | Job candidates | `1:N` | Tập Job được xem xét |
| Recommendation result | Job | `0..10` | Tối đa 10 Job đã xếp hạng |

Quan hệ Recruiter, Primary Recruiter, CompanyMember và Job tiếp tục được Backend quản lý.

AI-V05 không thay đổi ownership hoặc lifecycle của các quan hệ đó.

**Không có quan hệ persistence trực tiếp giữa CandidateCV và Job** được tạo ra chỉ vì hệ thống từng đề xuất Job cho CV đó.

---

# 5. Entity / Artifact Definitions

## 5.1. Job — canonical entity được mở rộng

### Responsibility

`Job` tiếp tục lưu toàn bộ dữ liệu nghiệp vụ tuyển dụng theo Backend hiện có.

AI-V05 bổ sung một trường dẫn xuất phục vụ semantic retrieval:

`embeddingText`

Trường này không thay thế Job Description, Required Skills, Category hoặc những canonical fields khác.

### Field Definition

| Field | Type | Required | Ownership | Ý nghĩa |
|---|---|---|---|---|
| `embeddingText` | `String` | Không bắt buộc trên mọi Job | Backend persistence; AI Kit xây dựng nội dung | Biểu diễn ngữ nghĩa tổng hợp của Job |

Các field canonical có liên quan tiếp tục giữ nguyên schema:

| Existing field | Vai trò trong AI-V05 |
|---|---|
| `_id` | Job identity |
| `companyId` | Tenant ownership và eligibility |
| `title` | Nguồn semantic content |
| `jobDescription` | Nguồn semantic content |
| `requiredSkills` | Nguồn semantic content |
| `fieldCategoryIds` | Nguồn taxonomy |
| `positionCategoryIds` | Nguồn taxonomy |
| `experienceLevelId` | Nguồn taxonomy |
| `status` | Visibility eligibility |
| `publishedAt` | Visibility eligibility |
| `applicationDeadline` | Visibility eligibility |
| `employmentType`, `workModes` | Dữ liệu phục vụ V03 scoring |
| `salary`, `location` | Canonical Job metadata, không tham gia ranking AI-V05 theo phạm vi đã thống nhất |

Các metadata khác của Job tiếp tục được bảo toàn.

### Constraints

- `embeddingText` là derived data, không được Candidate, Recruiter hoặc Manager chỉnh sửa trực tiếp như nội dung nghiệp vụ.
- Dữ liệu của trường phải được tạo từ JobMatchProfile tương ứng.
- Job DRAFT hoặc Job có dữ liệu chưa đủ để tạo representation có thể chưa có `embeddingText`.
- Khi sử dụng Job cho Vector Search, hệ thống cần có representation phù hợp với nội dung nguồn đang được sử dụng.
- Thiếu hoặc lỗi `embeddingText` không làm thay đổi tính hợp lệ của canonical Job.

Không bổ sung độ dài cố định, ngưỡng token hoặc định dạng chuỗi mang tính triển khai vào schema tại đây.

## 5.2. CandidateCV — unchanged

AI-V05 không bổ sung field persistence vào `CandidateCV`.

Các field hiện có được sử dụng gồm:

- `candidateUserId`
- `sourceType`
- `status`
- `isDefault`
- `archivedAt`
- Nội dung Generated CV hoặc Uploaded CV
- Category, ExperienceLevel và những metadata cần thiết

Default CV vẫn thuộc quyền quản lý của Backend CV Library.

Một Default CV hợp lệ cho request recommendation phải thuộc Candidate đang xác thực và đáp ứng điều kiện sử dụng CV hiện hành.

**CV `PRIVATE` không mặc nhiên bị loại khỏi recommendation của chính chủ sở hữu.**

AI-V05 không tự động chọn một CV khác khi Default CV không tồn tại.

## 5.3. Enum

AI-V05 không tạo business enum mới cho:

- Job status.
- CandidateCV status.
- CandidateCV source type.
- CandidateCV visibility.
- Category.
- ExperienceLevel.
- EmploymentType.
- WorkMode.

Tất cả tiếp tục sử dụng canonical values của Backend.

Các khái niệm `READY`, `FAILED` của normalization sử dụng contract hiện có; chúng không trở thành Job/CV persistence status mới.

AI-V05 không bổ sung enum persistence như `EMBEDDING_PENDING`, `EMBEDDING_READY` hoặc `RECOMMENDATION_COMPLETED`.

## 5.4. Indexes

### MongoDB Atlas Vector Search

AI-V05 sử dụng một Vector Search Index trên collection `jobs`.

Index có hai nhóm field:

| Index field | Chức năng |
|---|---|
| `embeddingText` | Automated text embedding và vector similarity retrieval |
| `status` | Structured eligibility pre-filter |
| `publishedAt` | Structured eligibility pre-filter |
| `applicationDeadline` | Structured eligibility pre-filter |
| `companyId` | Giới hạn vào các Company đủ điều kiện |

`embeddingText` được cấu hình qua cơ chế `autoEmbed` của Atlas.

Những field dùng để filter được cấu hình phù hợp với khả năng filter của Vector Search Index.

Atlas quản lý vector và cấu trúc index nội bộ. Backend không cần thêm trường chứa mảng vector vào document Job.

Tên index, phiên bản model embedding và thông số hạ tầng cụ thể được xác định tại bước triển khai trên cơ sở khả năng đã được P1 kiểm chứng.

Không tạo Vector Search Index riêng cho collection CandidateCV chỉ để phục vụ CV → Job recommendation.

### Existing indexes

Các MongoDB indexes về Job Discovery, CandidateCV Default và những nghiệp vụ khác tiếp tục được giữ nguyên.

AI-V05 không thay thế các index đó bằng Vector Search Index.

## 5.5. Reference Rules

- Mỗi Job giữ `companyId` canonical.
- FIELD/POSITION của Job phải giữ quan hệ taxonomy hợp lệ theo Backend.
- ExperienceLevel được tham chiếu qua catalog hiện có.
- Default CV phải thuộc Candidate đang gửi request.
- `jobKey` trong batch chỉ ánh xạ runtime đến Job ID canonical.
- Không dùng tên FIELD/POSITION đã đưa vào `embeddingText` để thay thế hoặc sửa canonical Category ID.

---

# 6. AI-Derived Data Contract

## 6.1. JobMatchProfile

| Property | Contract |
|---|---|
| Classification | `NORMALIZED_AI` |
| Persistence | `RUNTIME_ONLY` |
| Source | Canonical Job |
| Producer | AI-V01 |
| Consumer | Job text builder, AI-V05 scoring |
| Identity | `source.jobId` |
| Readiness | Theo AI-V01 |

Không lưu JobMatchProfile trong Job hoặc collection riêng.

## 6.2. CVMatchProfile

| Property | Contract |
|---|---|
| Classification | `NORMALIZED_AI` |
| Persistence | `RUNTIME_ONLY` |
| Source | CandidateCV |
| Producer | AI-V01 hoặc AI-V02 |
| Consumer | Query text builder, batch matching |
| Identity | `source.candidateCvId` |
| Readiness | Theo normalization contract hiện có |

Generated CV được chuẩn hóa theo luồng deterministic hiện hành.

Uploaded CV có thể cần semantic normalization bằng provider theo AI-V02 trước khi có READY profile.

AI-V05 không bổ sung normalized profile cache hoặc CV embedding cache.

## 6.3. CV Query Representation

| Property | Contract |
|---|---|
| Logical name | `queryText` |
| Type | String |
| Classification | `DERIVED` |
| Persistence | `RUNTIME_ONLY` |
| Source | READY CVMatchProfile |
| Purpose | Query-time semantic retrieval |

`queryText` được xây dựng bằng formatter deterministic.

Nó không phải canonical nội dung CV và không được lưu ngược vào CandidateCV.

## 6.4. Vector Retrieval Candidates

Một retrieval hit có thể mang thông tin runtime như:

- Job identity.
- Vector similarity score.
- Metadata cần thiết để kiểm tra visibility.
- Thứ tự retrieval.

Vector similarity score là tín hiệu dùng để lựa chọn Job candidates.

**Đây không phải Match Score của AI-V03 và không được trả về như phần trăm phù hợp giữa CV với Job.**

## 6.5. Batch Semantic Assessment

Một batch assessment nhận:

- Một READY CVMatchProfile.
- Nhiều READY JobMatchProfile.
- Source/evidence sets tương ứng từng Job.
- Runtime mapping `jobKey → jobId`.

Output logic cho mỗi Job gồm:

| Field | Type | Ý nghĩa |
|---|---|---|
| `jobKey` | String | Nhận diện Job trong batch |
| `requirementGroups` | Array | Semantic skills assessment tương thích V03 |
| `reason` | String | Giải thích định tính mức độ phù hợp |

Mỗi `requirementGroup` sử dụng các thành phần assessment đã được V03 định nghĩa, gồm requirement, priority, semantic score, evidence state và source references tương ứng.

`jobKey` là khóa do hệ thống sinh cho lần xử lý. Không dùng database ID làm định danh công khai trong prompt gửi provider.

Batch response phải có kết quả tương ứng với các Job đã gửi, không được có Job lạ hoặc Job bị lặp.

Việc kiểm tra source references và assessment diễn ra theo phạm vi từng Job, không dùng evidence của Job này để hợp thức hóa Job khác.

Batch assessment không trả final Match Score.

## 6.6. Recommendation Result

AI-V05 trả về danh sách recommendation được sắp xếp theo Match Score cuối cùng.

Mỗi item chứa tối thiểu các thành phần logic:

| Field | Type | Ý nghĩa |
|---|---|---|
| Job | Canonical public Job representation | Thông tin Job được phép hiển thị |
| Match Score | Number | Điểm cuối cùng do Backend/AI Kit scoring logic tính |
| Reason | String | Lý do phù hợp do LLM tạo |

Định dạng HTTP envelope và cách tái sử dụng Job response DTO thuộc bước API Data Contract/implementation, không yêu cầu tạo Job DTO riêng nếu Backend đã có representation thích hợp.

Danh sách có thứ tự, tối đa 10 Job.

Frontend có thể trình bày:

- 5 Job đầu: “Phù hợp với bạn nhất”.
- 5 Job tiếp: “Các công việc bạn nên thử”.

Hai nhóm trên là cách hiển thị cùng một danh sách, không phải hai tập dữ liệu được chấm điểm độc lập.

---

# 7. Embedding / Vector Data

## 7.1. Job embedding representation

`embeddingText` được tạo từ JobMatchProfile theo allowlist semantic fields đã thống nhất:

1. Job Title.
2. FIELD/POSITION dưới dạng tên có thể đọc được.
3. Required Skills.
4. Job Description.
5. ExperienceLevel dưới dạng nhãn mô tả phù hợp.

Formatter sử dụng giá trị đã normalize, không serialize toàn bộ profile.

Các wrapper như `sourcePath`, provenance, source ID và các metadata kỹ thuật không thuộc nội dung embedding.

Các giá trị null hoặc rỗng không được biến thành thông tin giả.

Thứ tự, cách trình bày và xử lý những nội dung trùng lặp thuộc deterministic formatter trong bước triển khai.

## 7.2. CV query representation

Query text được tạo từ READY CVMatchProfile của Default CV.

Các nguồn semantic phù hợp gồm:

- Category/target profession dưới dạng tên.
- Skill tags và nội dung kỹ năng.
- Professional Summary.
- Work Experience, gồm vai trò và thông tin công việc liên quan.
- Projects, gồm vai trò, công nghệ và nội dung chuyên môn.
- Education/Certifications khi có thông tin hữu ích và phù hợp.

Đây là allowlist về loại thông tin, không yêu cầu mọi CV phải có đầy đủ từng mục.

Không đưa trực tiếp vào query text các trường chuyên biệt sau:

- Email, số điện thoại, địa chỉ liên hệ.
- Professional links hoặc URL.
- Source path và provenance.
- Database identifiers.

Thông tin không liên quan đến mục đích matching cũng không được đưa vào query text.

Các trường free text cần được xử lý theo nguyên tắc hạn chế thông tin cá nhân trước khi đưa vào embedding. Việc phát hiện và loại bỏ thông tin liên hệ hoặc đường dẫn nằm trong free text là best-effort; không yêu cầu phát hiện tuyệt đối mọi dạng URL hoặc địa chỉ.

## 7.3. Metadata không nằm trong embedding baseline

Theo phạm vi AI-V05 đã thống nhất:

| Metadata | Vai trò |
|---|---|
| Salary | Canonical metadata; không tham gia AI-V05 ranking/filter |
| Location | Canonical metadata; không tham gia AI-V05 ranking/filter |
| EmploymentType | V03 scoring |
| WorkMode | V03 scoring |
| Category IDs | Canonical deterministic scoring |
| ExperienceLevel ID | Canonical deterministic scoring |
| Job status, deadline | Visibility eligibility |
| Company status | Visibility eligibility |

Một trường có thể hữu ích cho nghiệp vụ mà không nhất thiết phải trở thành token embedding.

## 7.4. Vector persistence

MongoDB Atlas Automated Embedding quản lý embedding vectors thông qua Search Index.

Không bổ sung vào Job:

- `embedding`
- `vector`
- `embeddingDimensions`
- Mảng số vector tương đương

Không bổ sung các trường này vào CandidateCV.

Query embedding của CV được tạo theo cơ chế query-time embedding, không phải một bản ghi vector được persist.

## 7.5. Index compatibility

Job representation và CV query representation phải sử dụng cách embedding tương thích khi thực hiện similarity retrieval.

Các lựa chọn về model, phiên bản và cấu hình index cần nhất quán khi triển khai và được xác minh ở focused integration verification.

Không khóa model hoặc vector dimension vào canonical MongoDB schema.

---

# 8. State Matrix

AI-V05 không tạo business lifecycle state mới.

Các trường hợp xử lý dữ liệu chính:

| Điều kiện | Data outcome |
|---|---|
| Không có Default CV | Business error; không tự chọn CV |
| Default CV không thuộc Candidate | Access/business error |
| Default CV không đủ điều kiện sử dụng | Error theo contract CV hiện hành |
| CV normalization không READY | Request error |
| Không có Job đủ điều kiện retrieval | Danh sách rỗng |
| Một Job bị loại trước batch assessment | Không đưa Job đó vào batch |
| Batch assessment hợp lệ | Tiếp tục V03 score calculation |
| Batch LLM lỗi, timeout hoặc output không hợp lệ | Request error; không trả partial recommendations |
| Có dưới 10 Job hợp lệ | Trả số Job thực tế |
| Có từ 10 Job hợp lệ trở lên | Trả tối đa 10 Job sau scoring và sorting |

Không định nghĩa state persistence `PARTIAL_SUCCESS` cho recommendation.

Nếu thiếu Default CV, việc người dùng lựa chọn Default CV và gọi lại API là trách nhiệm của Frontend.

---

# 9. Persistence Transitions

## 9.1. Job content changes

Khi các canonical fields được sử dụng để tạo `embeddingText` thay đổi, derived representation tương ứng cần được cập nhật.

Các tình huống liên quan gồm:

- Tạo Job.
- Chỉnh sửa nội dung Job.
- Thay đổi Title, Description, Skills, Category hoặc ExperienceLevel có ảnh hưởng đến representation.
- Job trở thành đối tượng đủ điều kiện tham gia recommendation.
- Backfill Job đã tồn tại.

AI-V05 cần tích hợp với các mutation owners của Job hiện hành.

**Không giả định rằng chỉ một Job service hoặc một endpoint có thể thay đổi toàn bộ các field liên quan.**

Trước triển khai, phải kiểm tra các đường ghi dữ liệu và ownership thực tế.

## 9.2. Job eligibility changes

Những thay đổi như:

- Job chuyển trạng thái.
- Hết application deadline.
- Company không còn `APPROVED/ACTIVE`.

có thể làm Job không còn đủ điều kiện được đề xuất.

Các điều kiện này được kiểm tra dựa trên canonical state tại thời điểm xử lý.

Không yêu cầu tái embedding chỉ vì một Job hết hạn hoặc Company thay đổi trạng thái khi semantic content của Job không đổi.

Không persist cờ `isDiscoverable`.

## 9.3. CandidateCV changes

Thay đổi nội dung CV hoặc thay đổi Default CV không tạo persistence transition mới của AI-V05.

Request kế tiếp đọc Default CV hiện tại và chuẩn hóa theo luồng đã có.

Không có CV embedding cần cập nhật hoặc xóa.

---

# 10. Transaction / Atomicity

AI-V05 không bổ sung một distributed transaction giữa:

- Backend canonical Job mutation.
- Job text representation.
- Atlas embedding/index update.

Lỗi khi tạo/cập nhật `embeddingText` không được mặc nhiên làm thất bại thao tác publish Job hợp lệ của nghiệp vụ Backend.

Derived representation và Search Index có thể cần thời gian để đồng bộ.

Backend chịu trách nhiệm có cơ chế cập nhật hoặc reconciliation phù hợp, ở mức đơn giản cần thiết cho dự án.

Data Contract không áp đặt queue, scheduler, worker hoặc cơ chế transaction cụ thể.

Với một recommendation request, batch assessment và final response có tính toàn vẹn ở cấp kết quả: không trả một phần recommendation nếu generative assessment thất bại.

---

# 11. Constraint Ownership

| Constraint | Owner |
|---|---|
| Job schema và canonical field validation | Backend Model/Service |
| Job lifecycle và publish eligibility | Backend Job domain |
| Company approval/active status | Backend Company domain |
| Job Discovery visibility | Backend visibility owner |
| CandidateCV ownership, status, Default | Backend CV Library |
| Category/ExperienceLevel resolution | Backend catalogs |
| Job/CV normalization | AI-V01/V02 |
| Deterministic embedding/query text builder | AI Kit |
| Derived Job text persistence | Backend |
| Atlas Vector Search Index | Backend/infrastructure integration |
| Batch semantic assessment validation | AI Kit |
| Deterministic and weighted scoring | AI-V03 scoring engine |
| HTTP authorization và response | Backend API |
| Chọn Default CV rồi retry | Frontend |

AI Kit không trở thành owner của canonical Job/CV mutations.

Backend không tự tái định nghĩa V03 scoring rubric trong một scorer riêng cho V05.

---

# 12. Freshness & Provenance

## 12.1. Provenance

`embeddingText` được dẫn xuất từ canonical Job thông qua JobMatchProfile.

Source identity của representation gắn với chính Job chứa trường đó.

`queryText` được dẫn xuất từ Default CV của request.

Các nguồn dữ liệu dùng để scoring vẫn giữ provenance theo AI-V01/V02/V03.

Không cần persist bản sao provenance wrapper vào `embeddingText`.

## 12.2. Freshness

Khi canonical semantic content của Job thay đổi, derived text cần phản ánh nội dung mới.

Atlas index có thể cập nhật bất đồng bộ sau khi document thay đổi.

Vì vậy:

- Không mặc định Vector Search Index đồng bộ tức thời với mọi mutation.
- Các Job được chọn để assessment phải được đọc và kiểm tra lại từ nguồn canonical hiện hành.
- Không dùng dữ liệu Job historical hoặc không còn discoverable chỉ vì chúng vẫn xuất hiện trong index.
- Không xem vector similarity của phiên bản cũ là bằng chứng rằng nội dung Job hiện tại phù hợp với CV.

Đối với dữ liệu đã seed, có thể dùng backfill/reconciliation để khởi tạo `embeddingText` cho các Job cần tham gia AI-V05.

Data Contract không yêu cầu tạo các persistence fields như:

- `embeddingVersion`
- `embeddingUpdatedAt`
- `embeddingStatus`
- `embeddingHash`

Nếu bước triển khai chứng minh cần thêm metadata để giải quyết một vấn đề freshness cụ thể, thay đổi đó phải được đánh giá riêng; không coi các field trên là yêu cầu ngầm của AI-V05.

---

# 13. Ownership / Multi-Tenant Boundary

## 13.1. Candidate boundary

- Chỉ Candidate đã xác thực mới được yêu cầu recommendation dựa trên CV của chính mình.
- Backend xác định Default CV từ dữ liệu thuộc Candidate đó.
- Candidate không được dùng ID của CV thuộc người khác để thực hiện recommendation.
- CV `PRIVATE` của chính Candidate có thể được sử dụng trong request cá nhân.
- CandidateCV và nội dung riêng tư không được đưa vào response của Candidate khác.

## 13.2. Company / Job boundary

Recommendation có thể tìm Job từ nhiều Company.

Mỗi Job phải thuộc Company đáp ứng điều kiện công khai hiện hành.

Việc xác định Company đủ điều kiện sử dụng canonical Company state, không suy luận từ vector score.

Vector Search Index có thể sử dụng `companyId` và những indexed Job metadata để giới hạn retrieval.

Sau retrieval, Backend tiếp tục dùng owner của Job Discovery visibility để xác nhận Job thực sự được phép hiển thị.

Không cho phép AI Kit hoặc LLM tự tuyên bố một Job là discoverable.

## 13.3. LLM boundary

Provider nhận lượng thông tin cần thiết để thực hiện batch semantic assessment và tạo reason.

Không gửi database identifiers khi có thể sử dụng runtime `jobKey`.

Không gửi nội dung liên hệ, URL hoặc provenance không cần thiết.

---

# 14. Snapshot / History

AI-V05 không tạo:

- Recommendation history collection.
- Saved ranking snapshot.
- Persisted Match Score theo Candidate–Job.
- Persisted LLM reason.
- Persisted batch assessment record.

Recommendation được tính tại thời điểm Candidate gửi request.

Việc Candidate từng nhìn thấy một Job không làm xuất hiện quan hệ canonical mới giữa Candidate và Job.

Application, saved jobs hoặc các hành động tương tác khác, nếu có, tiếp tục thuộc các nghiệp vụ Backend độc lập.

---

# 15. Retention / TTL

AI-V05 không định nghĩa retention policy hoặc TTL mới cho recommendation.

- `embeddingText` tồn tại cùng Job theo lifecycle và data retention hiện hành.
- Vector Index được Atlas duy trì dựa trên dữ liệu được index.
- Query text, batch assessment và recommendation result là runtime data.
- Không tạo collection tạm cần TTL.
- Không thay đổi chính sách archive/delete của Job, CandidateCV hoặc Company.

Việc reindex, backfill hoặc cleanup search infrastructure không đồng nghĩa với xóa canonical Job.

---

# 16. Explicitly Excluded Persistence

AI-V05 không persist các mục sau:

1. CV embedding vectors.
2. Job embedding vector arrays trong Job document.
3. `CVMatchProfile`.
4. `JobMatchProfile`.
5. CV query text.
6. Vector similarity score theo Candidate–Job.
7. LLM semantic assessment output.
8. LLM reason.
9. Final Match Score.
10. Recommendation result/history.
11. `jobKey` mapping.
12. Derived `isDiscoverable`.
13. Mức độ “phù hợp với bạn nhất” hoặc “nên thử” trên Job.
14. Recommendation lifecycle/status mới.
15. Seed-specific fields trong canonical schema.
16. Một bản sao Job/CV dành riêng cho recommendation.

Các dữ liệu trên có thể tồn tại trong memory trong quá trình xử lý khi cần thiết.

---

# 17. Compatibility với các version trước

## 17.1. AI-V01

AI-V05 tái sử dụng JobMatchProfile và Generated CVMatchProfile.

Không thay đổi:

- READY semantics.
- Source identity.
- Taxonomy resolution.
- Evidence/provenance.
- Missing-data rules.

`embeddingText` là biểu diễn mới được xây dựng từ profile, không phải field bổ sung bên trong V01 profile.

## 17.2. AI-V02

Uploaded CV tiếp tục sử dụng luồng chuẩn hóa hiện có.

AI-V05 không thay thế hoặc bỏ qua Uploaded CV semantic extraction.

Khi Uploaded CV chưa có READY profile, recommendation phải đi qua chuẩn hóa trước batch assessment.

## 17.3. AI-V03

AI-V05 tạo một batch matching request riêng.

Không thay đổi entry point nhận một Job–CV của V03.

Có thể tái sử dụng:

- Source builders.
- Requirement-group resolver.
- Semantic assessment rubric.
- Deterministic field scorer.
- Weighted Match Score calculator.

Các quy tắc score, weights và provenance của V03 tiếp tục có hiệu lực.

**Vector similarity không được thay thế V03 Match Score.**

## 17.4. AI-V04

AI-V05 không thay đổi CV evaluation/improvement contract của V04.

Việc kết hợp semantic assessment và natural-language reason trong một batch inference là capability của V05, không mở rộng ngầm output của V04.

## 17.5. Backend

Job Discovery, Job lifecycle, Company eligibility, CandidateCV Default và taxonomy tiếp tục sử dụng canonical Backend authority.

Không thay đổi public business states.

---

# 18. Persistence Invariants

| ID | Invariant | Enforcement owner |
|---|---|---|
| `INV-01` | Một recommendation request sử dụng Default CV thuộc Candidate đang xác thực | Backend |
| `INV-02` | AI-V05 không tự động thay Default CV khi không có Default | Backend |
| `INV-03` | CV normalization phải đáp ứng readiness contract trước khi matching | AI Kit/Backend |
| `INV-04` | `embeddingText` không thay thế canonical Job fields | Backend/AI Kit |
| `INV-05` | Job vector representation được tạo từ nguồn semantic được phép | AI Kit |
| `INV-06` | Không persist CV vectors hoặc recommendation result | Backend |
| `INV-07` | Job không discoverable không được xuất hiện trong final response | Backend visibility owner |
| `INV-08` | Không dùng Vector Score làm V03 Match Score | AI Kit |
| `INV-09` | Mỗi Job trong batch có identity/evidence scope riêng | AI Kit |
| `INV-10` | Final Match Score được tính bởi V03 scoring logic, không do LLM quyết định | AI Kit |
| `INV-11` | Mỗi Job recommendation trả về có reason hợp lệ từ batch assessment | AI Kit/Backend |
| `INV-12` | Batch assessment thất bại không tạo partial recommendation response | AI Kit/Backend |
| `INV-13` | Final response được sort theo Match Score và không quá 10 Job | Backend/AI Kit |
| `INV-14` | Job eligibility được xác định từ canonical state, không từ cờ persisted dẫn xuất | Backend |
| `INV-15` | Job embedding failure không tự làm thay đổi business lifecycle outcome của Job | Backend |

Không bổ sung ngưỡng similarity, ngưỡng Match Score, kích thước batch cố định hoặc giới hạn token cứng tại tầng Data Contract.

---

# 19. Definition of AI Data Completion

Data layer của AI-V05 được xem là đáp ứng contract khi:

### Canonical compatibility

- CandidateCV, Job, Company và catalogs tiếp tục tuân thủ schema/lifecycle hiện có.
- Default CV lookup sử dụng đúng ownership.
- Job visibility sử dụng đúng canonical Backend authority.

### Derived Job representation

- Backend hỗ trợ persisted `embeddingText` trên Job.
- Formatter tạo nội dung từ JobMatchProfile theo các semantic fields được phê duyệt.
- Các Job đủ điều kiện trong phạm vi dữ liệu triển khai có representation để tham gia Vector Search.
- Có đường cập nhật hoặc reconciliation khi nội dung nguồn thay đổi.
- Không biến embedding failure thành một business transition sai.

### Vector retrieval

- Atlas Vector Search Index sử dụng representation và filter fields phù hợp.
- CV query được tạo từ READY CVMatchProfile tại runtime.
- Retrieval trả Job identities để Backend tiếp tục kiểm tra visibility.
- Không tạo yêu cầu persisted CV vector.

### Batch assessment

- Batch result ánh xạ chính xác tới các Job được gửi.
- Semantic requirement groups tương thích V03.
- Reason được trả cho từng Job được assessment.
- Invalid batch output không đi tiếp tới final recommendation.

### Final recommendation

- Final score do V03 engine tính.
- Kết quả được sắp xếp và giới hạn tối đa 10 Job.
- Mỗi item có Job representation, Match Score và reason.
- Không trả Job không đủ điều kiện hiển thị.
- Không persist recommendation history.

### Verification boundary

Trong quá trình phát triển, ưu tiên focused tests cho:

- Formatter.
- Schema/provenance validation.
- Visibility integration.
- Batch mapping.
- Scoring compatibility.
- Data synchronization/backfill.

Live provider verification chỉ thực hiện tại các checkpoint thực sự cần thiết.

Không yêu cầu full gate hoặc provider calls lặp lại cho từng thay đổi nhỏ.

**Data completion không tự chứng minh retrieval quality hoặc recommendation quality.** Những tiêu chí đó cần được kiểm chứng riêng theo Product Acceptance của AI-V05.

---

# 20. Implementation Boundary

## 20.1. Data Contract cho phép

- Mở rộng Job persistence với `embeddingText`.
- Tạo deterministic Job/CV text formatters.
- Tạo một Atlas Vector Search Index phục vụ Job retrieval.
- Bổ sung backend orchestration cho derived text synchronization/backfill.
- Sử dụng canonical status/company fields để phục vụ retrieval filtering.
- Tạo các runtime artifacts cho batch assessment và recommendation.
- Tái sử dụng V03 scoring artifacts và source provenance.
- Thực hiện focused verification đối với những thay đổi trên.

## 20.2. Data Contract không quyết định

Các chi tiết triển khai sau không được khóa bởi tài liệu này:

- Tên Search Index.
- Embedding model cụ thể hoặc vector dimensions.
- Cách tổ chức modules và functions.
- Exact serialization template và kỹ thuật rút gọn text.
- Hard token budget.
- Retrieval Top K cố định.
- Shortlist/batch size cố định.
- Similarity threshold.
- Chunking strategy.
- Queue, worker, scheduler hoặc cơ chế đồng bộ cụ thể.
- HTTP endpoint path, DTO envelope và error code cụ thể.
- Provider adapter, prompt wording và parameter tuning.
- Công thức score mới.
- Chiến lược cache mới.
- Hệ thống đánh giá offline và ngưỡng Precision/Recall cụ thể.

Các vấn đề này được xử lý ở đúng tầng implementation/engineering hoặc trong quyết định Product riêng nếu chúng làm thay đổi observable behavior.

## 20.3. Ranh giới không được vượt qua

AI-V05 không được:

- Ghi đè canonical Job/CV data bằng kết quả LLM.
- Thay đổi V03 scoring formula mà không có authority.
- Sử dụng historical/private Job thay cho discoverable Job.
- Đưa thông tin riêng tư không cần thiết của Candidate vào embedding hoặc batch prompt.
- Persist Match Score và reason như một quan hệ Candidate–Job mới.
- Tạo thêm business state không có trong Product Specification.
- Bắt canonical Job publishing phải thành công embedding mới được hoàn tất.
- Trả kết quả Vector Search thay thế cho recommendation đã qua V03 scoring khi LLM thất bại.

---

**Kết luận Data Contract**

AI-V05 chỉ bổ sung persistence thiết yếu cho semantic retrieval ở phía Job thông qua `embeddingText` và Atlas Vector Search Index.

Phía CV được chuẩn hóa và tạo query embedding tại runtime. Batch semantic assessment, LLM reason, V03 Match Score và kết quả recommendation đều không được persist.

Canonical Backend tiếp tục quyết định quyền truy cập, Job visibility, Category, ExperienceLevel và lifecycle. AI Kit chịu trách nhiệm computation.

Thiết kế này đáp ứng hướng đã thống nhất cho AI-V05 mà không mở rộng schema, trạng thái nghiệp vụ hoặc các ràng buộc kỹ thuật vượt quá nhu cầu hiện tại.
