# AI-V01 — Chuẩn hóa Job/CV thành Canonical Match Profiles Data Model

> **File:** `docs/data/ai-kit/versions/ai-v01-job-cv-normalization-data-model.md`
> **Vai trò:** Canonical AI Data Contract
> **Approval status:** `APPROVED`
> **Phase:** JOBHUB AI Phase
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/ai-kit/versions/v01-job-cv-normalization.md`

---

# 1. Mục đích

Tài liệu này xác định data ownership, persistence boundary và các ràng buộc dữ liệu cần thiết để thực hiện AI-V01 theo Canonical AI Product Specification.

AI-V01 tạo hai biểu diễn chuẩn:

- `JobMatchProfile`
- `CVMatchProfile`

Hai profile được tạo từ dữ liệu Job và Generated CV hiện có của JOBHUB.

**Persistence decision của V01:**

- Job và Candidate CV tiếp tục là canonical persisted sources.
- `JobMatchProfile` và `CVMatchProfile` là normalized AI representations chỉ tồn tại runtime.
- Không bổ sung persisted AI artifact, collection hoặc cache mới.
- Không quản lý profile history, revision, freshness hoặc invalidation.
- Không thay đổi persisted schema hoặc lifecycle của Job/Candidate CV.

Các profile được tạo và sử dụng trong phạm vi một lần xử lý; không tự cập nhật dữ liệu nguồn.

Tài liệu không định nghĩa matching/scoring behavior hoặc bất kỳ AI capability nào ngoài Product Specification.

# 2. Thay đổi so với version trước

AI-V01 là AI business version đầu tiên.

| Entity / Artifact | Classification | Trạng thái | Persistence |
|---|---|---|---|
| `Job` | `CANONICAL` | `UNCHANGED` | Persisted — hiện có |
| `CandidateCV` | `CANONICAL` | `UNCHANGED` | Persisted — hiện có |
| JOBHUB taxonomy/metadata | `CANONICAL` | `UNCHANGED` | Theo thiết kế hiện có |
| `JobMatchProfile` | `NORMALIZED_AI` | `NEW` | `RUNTIME_ONLY` |
| `CVMatchProfile` | `NORMALIZED_AI` | `NEW` | `RUNTIME_ONLY` |
| Semantic extraction result | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Consolidated evidence/claims | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Normalization result status | `RUNTIME_ONLY` | `NEW` | `RUNTIME_ONLY` |

Không có entity/artifact thuộc trạng thái `UPDATED`, `DEPRECATED` hoặc `REMOVED`.

Không có migration hoặc thay đổi collection hiện có.

# 3. Data Classification và Entity tổng thể

## 3.1. Canonical

**Job**

Là persisted business source của Job metadata, description và các thuộc tính tuyển dụng.

**CandidateCV**

Là persisted business source của Candidate CV.

V01 chỉ chuẩn hóa Generated CV; phần Uploaded CV source không thuộc phạm vi.

**JOBHUB taxonomies**

Các giá trị chuẩn về skills, category, experience level, employment type, work mode và các taxonomy liên quan tiếp tục sử dụng định nghĩa hiện có.

AI-V01 không sở hữu và không thay thế canonical business data.

## 3.2. Normalized AI

**JobMatchProfile**

Biểu diễn chuẩn của một Job được tạo từ canonical Job source và nội dung liên quan.

**CVMatchProfile**

Biểu diễn chuẩn của một Generated CV được tạo từ canonical CV source và nội dung liên quan.

Cả hai:

- Không phải canonical business source.
- Không tồn tại dưới dạng collection riêng trong V01.
- Không có lifecycle persistence độc lập.
- Không được ghi ngược vào Job/CandidateCV.

## 3.3. Derived

Các thông tin trung gian phục vụ chuẩn hóa:

- Semantic extraction result.
- Normalized qualifications/requirements.
- Consolidated claims.
- Evidence associations.
- Uncertainty/conflict information.

Tất cả chỉ tồn tại runtime trong V01.

## 3.4. AI Artifact

Không bổ sung persisted AI artifact.

V01 không tạo Match Result, Recommendation Result, Agent Proposal hoặc artifact có lifecycle độc lập.

## 3.5. Runtime-only

Các dữ liệu runtime bao gồm:

- Normalization input context.
- Extraction result.
- Consolidation result.
- `JobMatchProfile`.
- `CVMatchProfile`.
- Normalization result status (`READY` hoặc `FAILED`).
- Temporary processing information.

Không yêu cầu lưu các intermediate values sau khi hoàn thành xử lý.

# 4. Quan hệ dữ liệu

Quan hệ nguồn:

```text
Job (CANONICAL / PERSISTED)
            |
            | derives
            v
JobMatchProfile
(NORMALIZED_AI / RUNTIME_ONLY)


CandidateCV (CANONICAL / PERSISTED)
            |
            | derives
            v
CVMatchProfile
(NORMALIZED_AI / RUNTIME_ONLY)
```

| Relationship | Cardinality | Required | Ownership |
|---|---|---|---|
| Job → JobMatchProfile | Một source tạo tối đa một kết quả profile trong một lần xử lý | Có source Job hợp lệ | Job ownership hiện có |
| Generated CV → CVMatchProfile | Một source tạo tối đa một kết quả profile trong một lần xử lý | Có source CV hợp lệ | Candidate CV ownership hiện có |

Relationship là runtime source dependency, không phải persisted reference.

Không bổ sung foreign key, reference field hoặc collection để lưu quan hệ.

Một lần xử lý thất bại không tạo canonical profile thành công.

# 5. Entity / Artifact Definitions

AI-V01 không bổ sung persisted entity hoặc persisted AI artifact mới.

## 5.1. Responsibility

### Existing Job

Tiếp tục chịu trách nhiệm lưu canonical Job business data.

Không chịu trách nhiệm lưu:

- `JobMatchProfile`.
- AI-extracted requirements.
- Conflict/evidence representation riêng của AI-V01.
- Normalization status.

### Existing CandidateCV

Tiếp tục chịu trách nhiệm lưu canonical Candidate CV data theo contract hiện có.

Không chịu trách nhiệm lưu:

- `CVMatchProfile`.
- AI-extracted qualifications.
- Consolidated experience claims.
- AI normalization status.
- AI processing history.

## 5.2. Fields

**Không bổ sung persisted field mới.**

Không thêm:

- Profile reference.
- AI status.
- AI extraction result.
- Normalized qualifications.
- Conflict metadata.
- AI evidence arrays.
- Source revision metadata.
- Processing timestamp.

Các field hiện có của Job/CandidateCV giữ nguyên định nghĩa, kiểu dữ liệu và constraint.

## 5.3. Enum

Không bổ sung persisted enum mới.

Các business enum hiện có tiếp tục giữ nguyên semantics.

`READY` và `FAILED` là runtime result semantics, không phải trạng thái mới của Job hoặc CandidateCV.

`REQUIRED` và `OPTIONAL` thuộc normalized requirement semantics; không thêm persisted enum vào Job.

## 5.4. Indexes

Không bổ sung index mới.

Không thay đổi index hiện có.

V01 không có persistence query hoặc retrieval requirement mới cần index riêng.

## 5.5. Reference rules

Không bổ sung persisted reference mới.

Runtime profile phải được tạo từ đúng source Job hoặc Generated CV được phép sử dụng.

Các relationship và ownership hiện có của nguồn không thay đổi.

# 6. AI-derived Data Contract

## 6.1. CVMatchProfile

**Classification:** `NORMALIZED_AI`

**Source:** Một Generated CV hợp lệ.

**Persistence:** `RUNTIME_ONLY`

**Responsibility:**

Biểu diễn dữ liệu nghề nghiệp từ Generated CV theo canonical semantics của AI-V01.

Các nhóm thông tin được biểu diễn khi có dữ liệu:

- Career positioning.
- Professional summary.
- Skills.
- Work experience.
- Projects.
- Education.
- Certifications.
- Languages.
- Declared experience claims.
- Candidate preferences thuộc CV.
- Evidence và source associations.
- Residual information có căn cứ.
- Các claim mâu thuẫn cần được bảo toàn.

**Data constraints:**

1. Không có field nghề nghiệp nào bắt buộc phải có giá trị chỉ để đạt READY.
2. Field thiếu được biểu diễn rỗng theo loại dữ liệu tương ứng.
3. Không tự tạo Candidate fact không có căn cứ.
4. Claim mâu thuẫn không được ép thành một fact duy nhất.
5. Các claim được bảo toàn cùng evidence tương ứng.
6. Thông tin không ánh xạ được không bị ép sang taxonomy sai.
7. `hiddenSections` không đồng nghĩa với absence of qualification.
8. Profile hợp lệ không đồng nghĩa với Candidate có chất lượng hoặc mức độ phù hợp cao.

**Không chịu trách nhiệm:**

- Lưu Candidate CV.
- Thay đổi Candidate CV.
- Xác minh độc lập Candidate claims.
- Scoring hoặc matching.
- Profile version/history.

**Source thay đổi thì:**

V01 không duy trì bản persisted/cached profile để cần invalidation.

Lần xử lý khác, nếu có, là một lần tạo kết quả mới từ input được cung cấp; V01 không quản lý quan hệ phiên bản giữa các lần xử lý.

---

## 6.2. JobMatchProfile

**Classification:** `NORMALIZED_AI`

**Source:** Một Job hợp lệ.

**Persistence:** `RUNTIME_ONLY`

**Responsibility:**

Biểu diễn Job metadata và requirements theo canonical semantics của AI-V01.

Các nhóm thông tin được biểu diễn khi có dữ liệu:

- Job positioning.
- Job metadata.
- Required requirements.
- Optional requirements.
- Skills và qualifications.
- Experience requirements.
- Education/language requirements.
- Employment type.
- Work mode.
- Location/contextual information có liên quan.
- Evidence và source associations.
- Các claim mâu thuẫn cần được bảo toàn.

**Data constraints:**

1. Structured metadata hợp lệ không bị ghi đè âm thầm.
2. Job Description có thể bổ sung `workModes` và `employmentType` còn thiếu/trống khi có evidence và mapping hợp lệ.
3. REQUIRED được ưu tiên OPTIONAL nếu cùng requirement xuất hiện với cả hai priority.
4. Priority chưa xác định không được tự suy diễn.
5. Requirement không được tự tạo từ context không đủ căn cứ.
6. Field thiếu được biểu diễn rỗng.
7. Conflict ngoài các quy tắc ưu tiên đã phê duyệt được bảo toàn cùng nguồn.
8. Profile không chứa match score hoặc Candidate assessment.

**Không chịu trách nhiệm:**

- Lưu hoặc cập nhật Job.
- Thay đổi Job requirements nguồn.
- Tạo Job ranking.
- Scoring hoặc Candidate evaluation.
- Profile version/history.

**Source thay đổi thì:**

Không có persisted/cached profile cần làm mới hoặc invalidation trong V01.

---

## 6.3. AI Result

V01 chỉ có runtime normalization result.

Kết quả mang một trong hai trạng thái:

| Status | Ý nghĩa |
|---|---|
| `READY` | Có canonical profile hợp lệ |
| `FAILED` | Không thể hoàn tất quá trình chuẩn hóa thành công |

Không có `BLOCKED`.

`READY` không phụ thuộc vào độ đầy đủ của thông tin nghề nghiệp.

Kết quả FAILED không được biểu diễn thành negative business assessment.

**Persistence:** `RUNTIME_ONLY`

**Owner:** Không phát sinh persisted artifact ownership; quyền sử dụng kết quả vẫn bị giới hạn bởi quyền đối với source.

**Lifecycle:** Kết thúc cùng phạm vi xử lý/sử dụng runtime tương ứng.

Không lưu result history, processing log mang business data hoặc persisted normalization status trong V01.

# 7. Embedding / Vector Data

AI-V01 không bổ sung embedding/vector persistence.

Không bổ sung:

- Job embedding.
- CV embedding.
- Embedding collection.
- Vector search index.
- Vector metadata.
- Embedding version.
- Embedding freshness tracking.

Vector retrieval/search không thuộc AI-V01.

# 8. State Matrix

Không áp dụng.

V01 không có persisted AI artifact với nhiều state dimension.

`READY` và `FAILED` chỉ mô tả kết quả runtime.

Không tạo persisted status matrix hoặc business state machine mới.

# 9. Persistence Transitions

AI-V01 không bổ sung persistence transition.

### F01 — Job normalization

- **Before:** Job canonical data hiện có.
- **After:** Job canonical data không thay đổi.
- **Runtime result:** JobMatchProfile khi READY.
- **Persisted entities changed:** Không.

### F02 — Generated CV normalization

- **Before:** CandidateCV canonical data hiện có.
- **After:** CandidateCV canonical data không thay đổi.
- **Runtime result:** CVMatchProfile khi READY.
- **Persisted entities changed:** Không.

Không thêm transition cho:

- Profile creation persistence.
- Profile update.
- Profile invalidation.
- Profile regeneration.
- Profile deletion.

# 10. Transaction / Atomicity Requirements

AI-V01 không bổ sung transaction/atomicity requirement mới.

Lý do:

- Không tạo persisted AI entity.
- Không cập nhật Job/CandidateCV.
- Không có cross-document AI state cần commit đồng thời.
- Không có persisted result state transition.

Không yêu cầu distributed transaction hoặc exactly-once guarantee với external AI dependencies.

Các transaction invariant hiện có của JOBHUB tiếp tục giữ nguyên.

# 11. Constraint Ownership

## 11.1. Database / Schema

Database/schema hiện có tiếp tục bảo vệ:

- Job canonical field types và constraints.
- CandidateCV canonical field types và constraints.
- Existing enum validity.
- Existing references.
- Existing uniqueness và indexes.

AI-V01 không bổ sung schema/database constraint mới.

## 11.2. Service / Domain Boundary

Chịu trách nhiệm:

- Xác định nguồn Job/CV hợp lệ.
- Giữ Candidate CV ownership.
- Giữ Job visibility.
- Giữ authorization và tenant boundary.
- Không cho phép AI result ghi đè canonical source.
- Không để kết quả runtime được sử dụng vượt quyền đối với source.

## 11.3. AI Processing

Chịu trách nhiệm:

- Kiểm tra cấu trúc normalized profile.
- Bảo toàn source evidence.
- Áp dụng normalization/consolidation rules.
- Không tự tạo fact không có căn cứ.
- Bảo toàn các claim mâu thuẫn.
- Áp dụng REQUIRED-over-OPTIONAL.
- Không biến missing data thành processing failure.
- Không công bố READY khi không thể tạo output hợp lệ.

AI processing không tự xác lập authorization hoặc database ownership.

## 11.4. Transaction

Không có constraint mới thuộc transaction boundary trong V01.

# 12. Freshness và Provenance

## 12.1. Freshness / Invalidation

Không áp dụng persisted/cached freshness tracking.

V01 không lưu canonical AI profile qua các lần xử lý và không quản lý profile revision.

Không bổ sung:

- `sourceRevision`.
- `profileVersion`.
- `profileSchemaVersion` phục vụ persisted lifecycle.
- `staleAt`.
- `invalidatedAt`.
- Freshness status.
- Regeneration marker.

Không có dữ liệu AI persisted cần invalidation khi nguồn thay đổi.

## 12.2. Provenance

**Áp dụng ở runtime.**

Những claim được bảo toàn trong normalized profile phải giữ khả năng đối chiếu với thông tin nguồn tương ứng.

Provenance cần đủ để:

- Xác định một claim bắt nguồn từ nội dung Job/CV nào.
- Phân biệt structured metadata và extracted claim khi sự khác biệt có ý nghĩa.
- Bảo toàn các nguồn hỗ trợ một claim đã hợp nhất.
- Phân biệt các claim mâu thuẫn.
- Tránh diễn giải inferred information như independently verified fact.

Không bổ sung persisted provenance collection hoặc historical source tracking.

# 13. Ownership / Multi-tenant Data Boundary

| Dữ liệu | Ownership |
|---|---|
| Job canonical data | Theo ownership/Company boundary hiện có |
| CandidateCV canonical data | Candidate theo quy định JOBHUB |
| JobMatchProfile runtime | Kế thừa quyền sử dụng nguồn Job |
| CVMatchProfile runtime | Kế thừa quyền sử dụng nguồn CandidateCV |

V01 không tạo owner field mới.

Các nguyên tắc:

- Runtime profile không được làm lộ dữ liệu vượt quyền đối với nguồn.
- Candidate không được sử dụng CV của Candidate khác nếu không có quyền hợp lệ.
- Job private hoặc Company-private information vẫn chịu visibility/authorization hiện có.
- Không có cross-tenant access mới.
- Runtime source identifier không tự tạo authorization.

Version này không bổ sung multi-tenant data boundary mới.

# 14. Snapshot / Historical Data

AI-V01 không bổ sung snapshot/historical persistence mới.

Không lưu:

- Canonical profile snapshots.
- CV/Job source snapshots phục vụ AI.
- Extraction history.
- Normalization history.
- Claim revision history.
- Historical conflict resolution.
- Historical AI results.

Mỗi lần xử lý độc lập với history của các lần trước ở phạm vi AI-V01.

Không bổ sung source revision tracking phục vụ snapshot.

Các snapshot hoặc historical data thuộc nghiệp vụ Backend hiện có, nếu có, không bị V01 thay đổi.

# 15. Retention / TTL

AI-V01 không bổ sung retention/TTL requirement mới.

| Dữ liệu | Retention |
|---|---|
| Job canonical data | Theo contract JOBHUB hiện có |
| CandidateCV canonical data | Theo contract JOBHUB hiện có |
| JobMatchProfile | Runtime-only |
| CVMatchProfile | Runtime-only |
| Extraction/consolidation data | Runtime-only |
| Normalization result | Runtime-only |

Không tạo TTL index hoặc cleanup job mới.

Không yêu cầu lưu runtime intermediate data sau khi hoàn thành phạm vi xử lý.

# 16. Explicitly Excluded Persistence

AI-V01 chủ động không bổ sung các persisted entities, fields và mechanisms sau.

### Không bổ sung collections

- `job_match_profiles`.
- `cv_match_profiles`.
- AI normalization results.
- AI extraction results.
- AI evidence records.
- AI conflict records.
- AI processing history.
- AI embedding/vector collections.
- AI recommendation/matching artifacts.
- AI Agent state.

### Không bổ sung fields trên Job/CandidateCV

- `aiProfileId`.
- `aiNormalizationStatus`.
- `aiProcessedAt`.
- `aiProfileVersion`.
- `aiSourceRevision`.
- `aiStaleAt`.
- Persisted extracted claims.
- Persisted AI consolidation metadata.

### Không bổ sung persistence mechanisms

- AI profile cache.
- Persisted AI output history.
- AI profile invalidation lifecycle.
- Background profile synchronization state.
- Vector/search indexing.
- AI-specific TTL hoặc retention mechanism.
- Duplicate canonical Job/CV snapshots.

Không thêm persistence với lý do dự phòng cho AI version tương lai.

# 17. Compatibility với version trước

## 17.1. Invariant phải giữ

- Job tiếp tục là canonical source của Job data.
- CandidateCV tiếp tục là canonical source của CV data.
- Ownership và authorization không thay đổi.
- AI-generated information không tự trở thành canonical source.

## 17.2. Existing schema phải giữ

Giữ nguyên existing Job/CandidateCV schemas, fields, enums, indexes và relationships.

Không yêu cầu migration.

## 17.3. AI data contract phải giữ

Không có AI business version trước đó để yêu cầu backward compatibility.

## 17.4. Thay đổi được phép

- Tạo runtime normalized AI representations từ canonical source.
- Sử dụng các biểu diễn này trong phạm vi AI capability đã phê duyệt.
- Chuẩn hóa và hợp nhất thông tin mà không làm thay đổi nguồn persisted.

## 17.5. Thay đổi không được phép

- Ghi normalized AI data đè lên Job/CandidateCV.
- Thay đổi nguồn canonical chỉ để phù hợp AI representation.
- Tạo persisted AI profile/history/versioning ngoài V01.
- Tái diễn giải existing business enum/state thành AI-specific semantics.
- Sử dụng Uploaded CV source như đầu vào xử lý V01.

# 18. Persistence Invariants

| Invariant | Enforcement owner |
|---|---|
| Job/CandidateCV là canonical persisted sources | Existing database/schema + domain boundary |
| AI output không tự ghi vào canonical source | Domain boundary + AI processing |
| V01 không tạo persisted AI artifact | Persistence boundary |
| Normalized profile có source hợp lệ | Domain boundary + AI processing |
| Runtime profile không vượt authorization của source | Domain boundary |
| Không tạo fact không có evidence | AI processing |
| Field thiếu không bị tự bổ sung | AI processing |
| Claim mâu thuẫn được bảo toàn | AI processing |
| REQUIRED được ưu tiên OPTIONAL cho cùng requirement | AI processing |
| Structured metadata không bị ghi đè trái rule | AI processing |
| Không có BLOCKED | AI processing |
| FAILED không biến thành negative business result | AI processing |
| Không có profile history/revision/freshness persistence | Persistence boundary |
| Không tạo transaction/cross-document write mới | Persistence boundary |
| Không thêm vector/index/cache ngoài phạm vi | Persistence boundary |

Các invariant này không yêu cầu tạo schema/collection chỉ để lưu bằng chứng rằng invariant đã được thực thi.

# 19. Definition of AI Data Completion

AI-V01 Data Contract được xem là hoàn thành về mặt dữ liệu khi:

- Canonical source của Job và Generated CV được giữ nguyên.
- `JobMatchProfile` và `CVMatchProfile` được xác định là `NORMALIZED_AI`, `RUNTIME_ONLY`.
- Derived extraction/consolidation data được giới hạn trong runtime.
- Không có persisted AI entity/artifact mới.
- Existing Job/CandidateCV schemas không bị thay đổi.
- Relationship và source dependency đã rõ.
- Không bổ sung speculative fields hoặc indexes.
- Không có embedding/vector persistence.
- Không có persisted state machine hoặc persistence transitions mới.
- Không yêu cầu transaction/atomicity mới.
- Provenance cần thiết được bảo toàn trong runtime profile.
- Không có profile versioning, freshness hoặc historical persistence.
- Ownership/authorization giữ nguyên.
- Không có snapshot/history/TTL mới.
- Các persistence invariants có enforcement owner rõ ràng.
- Không có persistence capability ngoài Product Specification.

Không cần tạo mới collection hoặc migration để chứng minh AI-V01 Data Completion.

Việc AI có thể trả kết quả đúng cấu trúc không tự chứng minh đã tuân thủ đầy đủ Data Contract nếu source evidence, trust semantics hoặc ownership bị vi phạm.

# 20. Implementation Boundary

Tài liệu này là **CANONICAL AI PERSISTENCE / DATA CONTRACT** sau khi được phê duyệt.

Nó xác định:

- Những dữ liệu nào được sử dụng.
- Những dữ liệu nào persist hoặc chỉ tồn tại runtime.
- Nguồn canonical của normalized AI data.
- Data ownership và relationship.
- Persistence responsibility.
- Constraint ownership.
- Persistence invariants.
- Những persisted fields/entities không được bổ sung.

Tài liệu không định nghĩa:

- LLM provider hoặc model.
- Prompt hoặc structured extraction instructions.
- Scoring/matching logic.
- Retrieval/ranking algorithm.
- Embedding algorithm.
- API/HTTP contract.
- Controller/service structure.
- MongoDB queries.
- Mongoose methods.
- Frontend workflow.
- Test framework.

**Canonical hierarchy:**

```text
AI Product Specification
           |
           | Business / Capability Truth
           v
AI Data Contract
           |
           | Persistence / Data Truth
           v
AI Engineering Contracts
           |
           | Architecture / Algorithm Truth
           v
Implementation
           |
           v
Tests / Evaluation
```

**Authority:**

- Product Specification quyết định business behavior.
- Data Contract quyết định persistence truth.
- Engineering Contracts quyết định architecture/algorithm.
- Implementation và tests cung cấp bằng chứng thực thi.

Nếu một yêu cầu persistence làm thay đổi business behavior đã phê duyệt, phải đưa vấn đề trở lại Product Specification để được quyết định trước khi cập nhật Data Contract.

Data Contract không được tự bổ sung capability hoặc requirement mới ngoài AI-V01.
