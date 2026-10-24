# AI-V03 — Job–CV Matching & Scoring Data Model

> **Đường dẫn:** `docs/data/ai-kit/versions/v03-job-cv-matching-scoring.md`\
> **Vai trò:** AI Data Contract  
> **Phase:** JOBHUB AI Phase  
> **Ngôn ngữ:** Tiếng Việt  
> **Product authority:** `docs/product/ai-kit/versions/v03-job-cv-matching-scoring.md`  
> **Trạng thái:** `APPROVED`

---

# 1. Mục đích

Tài liệu xác định data ownership, runtime data contract và persistence boundary cho AI-V03 — Job–CV Matching & Scoring.

AI-V03 đánh giá mức độ phù hợp giữa một Job và một Candidate CV thông qua:

- `JobMatchProfile` được cung cấp theo AI-V01.
- `CVMatchProfile` được cung cấp theo AI-V01 hoặc AI-V02.
- Semantic Skills Assessment từ một lần LLM inference.
- Các đánh giá deterministic và phép tổng hợp điểm theo Product Specification AI-V03.

**Persistence decision của AI-V03:**

- Không bổ sung collection hoặc persisted entity.
- Không thay đổi schema của Job hoặc CandidateCV.
- Không persist `JobMatchProfile` hoặc `CVMatchProfile`.
- Không persist Match Result, điểm số, chi tiết đánh giá hoặc LLM output.
- Không bổ sung cache, embedding hoặc vector index.
- Không bổ sung lịch sử, revision hoặc freshness lifecycle cho kết quả matching.

Kết quả AI-V03 chỉ tồn tại trong phạm vi lần xử lý và được trả về cho capability gọi nó.

Tài liệu không định nghĩa lại công thức chấm điểm đã thuộc Product Specification.

---

# 2. Thay đổi so với version trước

| Entity / Artifact | Classification | Trạng thái | Persistence |
|---|---|---|---|
| `Job` | `CANONICAL` | `UNCHANGED` | Persisted hiện có |
| `CandidateCV` | `CANONICAL` | `UNCHANGED` | Persisted hiện có |
| Career taxonomy và metadata catalogs | `CANONICAL` | `UNCHANGED` | Theo Backend hiện có |
| `JobMatchProfile` | `NORMALIZED_AI` | `UNCHANGED` | `RUNTIME_ONLY` |
| `CVMatchProfile` | `NORMALIZED_AI` | `UNCHANGED` | `RUNTIME_ONLY` |
| Skills Assessment | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Deterministic Field Assessment | `DERIVED` | `NEW` | `RUNTIME_ONLY` |
| Match Result | `AI_ARTIFACT` | `NEW` | `RUNTIME_ONLY` |

`NEW` thể hiện một runtime abstraction được AI-V03 sử dụng, không đồng nghĩa với việc tạo database entity.

AI-V03 không thay đổi hoặc mở rộng schema của hai normalized profiles.

Không có persisted entity thuộc trạng thái `UPDATED`, `DEPRECATED` hoặc `REMOVED`.

---

# 3. Data Classification và Entity tổng thể

## 3.1. Canonical

Các nguồn business truth hiện có:

- Job.
- CandidateCV, bao gồm Generated CV và Uploaded CV.
- Career Category.
- Experience Level.
- Employment Type.
- Work Mode.

Ownership, lifecycle và visibility của các nguồn trên tiếp tục thuộc JOBHUB Backend.

AI-V03 không sở hữu hoặc thay đổi canonical business data.

## 3.2. Normalized AI

AI-V03 sử dụng trực tiếp:

- `JobMatchProfile`.
- `CVMatchProfile`.

Hai profile giữ nguyên cấu trúc, provenance, missing data và source semantics đã được định nghĩa trong AI-V01/V02.

Một profile `READY` có thể chứa field rỗng. AI-V03 không bổ sung completeness requirement mới.

## 3.3. Derived

Dữ liệu derived trong một lần matching gồm:

- Các skill requirement được nhận diện từ Job profile.
- Priority của từng requirement.
- Semantic assessment cho từng skill requirement.
- Điểm cho các field deterministic.
- Điểm nhóm Skills.
- Điểm tổng hợp theo trọng số.

Các giá trị derived không tự trở thành dữ liệu canonical của Job hoặc Candidate.

## 3.4. AI Artifact

**Match Result** là kết quả đánh giá một cặp Job–CV.

Trong AI-V03, Match Result không có persistence lifecycle riêng.

Nó không phải:

- Candidate qualification được xác minh độc lập.
- Kết luận tuyển dụng.
- Kết quả xếp hạng nhiều Job.
- Recommendation Result.
- Đề xuất sửa CV.
- Một bản sao của Job hoặc CandidateCV.

## 3.5. Runtime-only

Toàn bộ dữ liệu xử lý riêng của AI-V03 là runtime-only.

Không tạo collection chỉ vì một object có tên hoặc cấu trúc riêng trong implementation.

---

# 4. Quan hệ dữ liệu

Quan hệ logic:

```text
Job
 └── JobMatchProfile ────────┐
                             │
                             ├── Match Assessment
                             │         │
CandidateCV                  │         ▼
 └── CVMatchProfile ─────────┘    Match Result
```

| Relationship | Cardinality | Persistence |
|---|---|---|
| Job → JobMatchProfile | Một source Job cho một kết quả normalization trong lần xử lý | Runtime-only |
| CandidateCV → CVMatchProfile | Một source CV cho một kết quả normalization trong lần xử lý | Runtime-only |
| JobMatchProfile + CVMatchProfile → Match Result | Một cặp profile cho một lần đánh giá | Runtime-only |

Một Candidate có thể sử dụng nhiều CV hợp lệ để đánh giá cùng một Job, nhưng mỗi lần đánh giá xác định rõ **một Job và một CV cụ thể**.

Không tạo foreign key hoặc persisted reference mới cho các quan hệ này.

---

# 5. Entity / Artifact Definitions

## 5.1. Responsibility

### Job

Tiếp tục lưu dữ liệu tuyển dụng theo Backend contract hiện có.

Không chịu trách nhiệm lưu:

- Matching Score.
- Skills Assessment.
- CV assessment.
- Matching history.

### CandidateCV

Tiếp tục lưu nội dung CV, metadata và ownership theo Backend contract hiện có.

Không chịu trách nhiệm lưu:

- Job matching score.
- Kết quả phân tích semantic của AI-V03.
- Điểm từng tiêu chí.
- Matching history.

### Match Result

Chịu trách nhiệm biểu diễn kết quả đánh giá một cặp Job–CV trong lần xử lý hiện tại.

Không sở hữu và không thay thế dữ liệu của hai nguồn.

## 5.2. Persisted Fields

**AI-V03 không bổ sung persisted field mới.**

Không thêm vào Job hoặc CandidateCV các field như:

- `matchScore`
- `skillsScore`
- `categoryScore`
- `experienceScore`
- `matchingStatus`
- `matchingHistory`
- `lastMatchedAt`
- `matchingPolicyVersion`

Các tên trên chỉ là ví dụ về persistence không được phê duyệt, không phải schema bắt buộc.

## 5.3. Enum

Không bổ sung persisted business enum.

AI-V03 sử dụng các giá trị canonical hiện có cho Category, Experience Level, Employment Type và Work Mode.

Các nhãn `REQUIRED`, `PREFERRED` và `UNSPECIFIED` được dùng trong runtime Skills Assessment để phân biệt priority.

Không thêm priority field vào canonical Job hoặc `JobMatchProfile`.

## 5.4. Indexes

Không bổ sung index mới.

Không yêu cầu search index hoặc vector index.

## 5.5. Reference Rules

- Match Result phải gắn với đúng Job và CandidateCV đã được Backend cho phép sử dụng.
- LLM không được tự tạo hoặc thay đổi source identity.
- Không được gán đánh giá của CV này sang CV khác.
- Không được coi client-supplied ID là bằng chứng đã được authorization.
- Không bổ sung persisted reference.

---

# 6. AI-derived Data Contract

## 6.1. `JobMatchProfile`

**Classification:** `NORMALIZED_AI`  
**Persistence:** `RUNTIME_ONLY`  
**Source:** Job hợp lệ theo AI-V01.

AI-V03 sử dụng các nhóm dữ liệu đã có trong profile, đặc biệt:

- Job identity.
- Career Category và taxonomy metadata.
- Experience Level.
- Employment Type.
- Work Modes.
- Structured required skills.
- Job Description và các free-text requirement.
- Source associations/provenance.

AI-V03 có thể diễn giải ngữ nghĩa Job Description khi thực hiện matching.

Việc diễn giải đó **không thay đổi `JobMatchProfile`**, không ghi ngược vào Job và không trở thành dữ liệu normalization mới của V01.

## 6.2. `CVMatchProfile`

**Classification:** `NORMALIZED_AI`  
**Persistence:** `RUNTIME_ONLY`  
**Source:** Generated CV hoặc Uploaded CV hợp lệ.

Các nhóm dữ liệu được sử dụng gồm:

- CandidateCV identity.
- Career Category.
- Experience Level.
- Skills metadata.
- Skills và qualification trong nội dung CV.
- Employment Types.
- Work Modes.
- Các phần nội dung nghề nghiệp liên quan.
- Evidence, uncertainty và provenance khi có.

Generated CV và Uploaded CV có thể có cách biểu diễn evidence khác nhau.

AI-V03 không bắt buộc hai nguồn phải có lượng thông tin tương đương.

Không bổ sung field vào `CVMatchProfile` chỉ để phục vụ tính điểm V03.

## 6.3. Skills Assessment

**Classification:** `DERIVED`  
**Persistence:** `RUNTIME_ONLY`.

Skills Assessment chứa thông tin cần thiết để xác định và tổng hợp mức độ phù hợp về kỹ năng.

Semantic Skills Assessment do LLM tạo là đầu vào cần thiết để tổng hợp Skills Score và Match Score trong Matching thực tế. Có thể unit test phép tính với mock assessment, nhưng Matching thực tế vẫn cần LLM inference.

### Logical data

| Field / Group | Ý nghĩa |
|---|---|
| Requirement | Một yêu cầu kỹ năng của Job được xác định trong lần đánh giá |
| Priority | `REQUIRED`, `PREFERRED` hoặc `UNSPECIFIED` |
| Semantic score | Điểm tương thích của Candidate với requirement |
| Source association | Nguồn Job/CV được dùng để đánh giá, khi có |
| Required group score | Điểm nhóm Required |
| Lower-priority group score | Điểm nhóm Preferred và Unspecified |
| Skills score | Điểm Skills sau khi tổng hợp hai nhóm |

Đây là **logical contract**, chưa phải JSON Schema cuối cùng của LLM.

### Data semantics

- Một requirement tương đương được tính một lần sau khi hợp nhất trùng lặp.
- Nếu requirement xuất hiện với nhiều priority, `REQUIRED` có quyền ưu tiên theo Product Decision.
- `PREFERRED` và `UNSPECIFIED` được giữ phân biệt về ngữ nghĩa nhưng cùng thuộc nhóm tỷ trọng thấp hơn.
- Một requirement có nhiều CV evidence không được nhân số lần tính điểm.
- Điểm semantic của từng requirement thuộc thang `0, 10, 20, ..., 100`.
- Evidence không tồn tại hoặc không đủ để xác nhận có thể dẫn đến điểm 0 mà không làm toàn bộ matching thất bại.

### Group semantics

Nếu cả hai nhóm có requirement:

- Required chiếm 80% Skills Score.
- Lower-priority chiếm 20% Skills Score.

Nếu chỉ một nhóm có requirement, nhóm đó chiếm 100% Skills Score.

Nếu cả hai nhóm rỗng, Skills Score bằng 0.

Các phép tổng hợp được thực hiện theo Product Specification, không do LLM tự điều chỉnh.

## 6.4. Deterministic Field Assessment

**Classification:** `DERIVED`  
**Persistence:** `RUNTIME_ONLY`.

Bốn field được đánh giá deterministic:

| Field | Dữ liệu nguồn | Result |
|---|---|---|
| Career Category | Canonical category identity và quan hệ FIELD–POSITION | Category Score |
| Experience | Canonical Experience Level | Experience Score |
| Employment Type | Job employment type và Candidate acceptable types | Employment Type Score |
| Work Mode | Job work modes và Candidate acceptable modes | Work Mode Score |

Các field này sử dụng bảng đánh giá đã phê duyệt ở Product Specification.

LLM không sở hữu điểm của bốn field trên.

AI-V03 không tạo taxonomy identity mới hoặc thay đổi metadata nguồn.

## 6.5. Match Result

**Classification:** `AI_ARTIFACT`  
**Persistence:** `RUNTIME_ONLY`.

### Minimum logical output

| Field / Group | Type logic | Required | Ý nghĩa |
|---|---|---|---|
| Job identity | Source reference | YES | Job được đánh giá |
| CandidateCV identity | Source reference | YES | CV được đánh giá |
| Match Score | Number, 0–100 | YES | Điểm phù hợp tổng hợp |
| Skills Score | Number, 0–100 | YES | Điểm Skills |
| Category Score | Number, 0–100 | YES | Điểm Career Category |
| Experience Score | Number, 0–100 | YES | Điểm Experience |
| Employment Type Score | Number, 0–100 | YES | Điểm Employment Type |
| Work Mode Score | Number, 0–100 | YES | Điểm Work Mode |
| Weights / contributions | Runtime breakdown | YES | Căn cứ tính điểm tổng |

Các điểm field phải cho phép xác định đóng góp của từng field vào Match Score.

### Trọng số tổng

| Field | Weight |
|---|---:|
| Skills | 40% |
| Career Category | 25% |
| Experience | 25% |
| Employment Type | 5% |
| Work Mode | 5% |
| **Total** | **100%** |

Tất cả năm field đều tham gia tổng điểm.

Không phân phối lại trọng số khi một field thiếu dữ liệu.

### Output boundary

Match Result V03 chỉ cần phục vụ đánh giá điểm và phân rã điểm.

Thông tin đánh giá từng skill có thể được giữ trong runtime assessment để phục vụ tính điểm và kiểm tra kết quả. Không bắt buộc biến toàn bộ assessment trung gian thành public response.

AI-V03 chưa yêu cầu:

- CV improvement suggestions.
- Explanation dài cho từng field.
- Rewrite proposal.
- Ranking nhiều Job.
- Historical comparison.

Các capability sau có thể sử dụng thêm thông tin từ cùng profile và mở rộng result contract, nhưng V03 không thiết kế trước toàn bộ shape đó.

---

# 7. Embedding / Vector Data

AI-V03 không bổ sung embedding hoặc vector persistence.

Không yêu cầu:

- Job embedding.
- CV embedding.
- Vector database.
- Vector index.
- Semantic retrieval collection.

Một lần đánh giá Job–CV không cần tạo dữ liệu embedding để persist.

Vector retrieval cho Job Recommendation là phạm vi version khác.

---

# 8. State Matrix

AI-V03 không cần persisted State Matrix riêng.

Các profile đầu vào sử dụng runtime readiness semantics hiện có của AI-V01/V02.

| Input condition | Matching behavior |
|---|---|
| Cả hai profile hợp lệ, `READY` | Có thể thực hiện matching |
| `READY` nhưng một số field rỗng | Vẫn thực hiện matching |
| Nguồn không hợp lệ hoặc không được phép sử dụng | Không có input hợp lệ để matching |
| Normalization không tạo được profile hợp lệ | Không thực hiện matching trên profile đó |
| LLM/provider không tạo được kết quả hợp lệ về cấu trúc | Không có Match Result hoàn chỉnh |

Không bổ sung `BLOCKED`, `LOW_QUALITY` hoặc trạng thái persisted mới.

Một field score bằng 0 không phải processing failure.

---

# 9. Persistence Transitions

AI-V03 không tạo persistence transition mới.

Trong một lần đánh giá:

1. Backend cung cấp cặp source hợp lệ.
2. Hệ thống sử dụng hai normalized profiles.
3. AI-V03 tạo runtime assessment.
4. Match Result được trả về cho bên gọi.

Không có bước ghi điểm vào Job hoặc CandidateCV.

Nếu Job hoặc CV thay đổi ở lần sử dụng sau, kết quả matching mới được đánh giá từ input mới được cung cấp.

Không duy trì hoặc cập nhật Match Result cũ vì V03 không persist nó.

---

# 10. Transaction / Atomicity Requirements

AI-V03 không bổ sung transaction hoặc cross-document atomicity requirement.

Một lần matching không thực hiện business mutation đối với Job hoặc CandidateCV.

Không có nhiều persisted write cần commit hoặc rollback cùng nhau.

---

# 11. Constraint Ownership

## 11.1. Database / Schema

Backend tiếp tục sở hữu:

- Canonical Job/CandidateCV schema.
- Source identity.
- Ownership.
- Catalog references.
- Existing data constraints.

AI-V03 không thêm database constraint mới.

## 11.2. Backend / Calling Service

Backend hoặc calling capability chịu trách nhiệm:

- Xác định Candidate.
- Xác định CandidateCV được phép sử dụng.
- Xác định Job được phép truy cập.
- Cung cấp đúng cặp nguồn/profile.
- Không chuyển dữ liệu từ nguồn không được phép sang AI-V03.

## 11.3. Normalization

AI-V01/V02 tiếp tục chịu trách nhiệm tạo profile theo contract của từng version.

AI-V03 không sửa dữ liệu normalization để đáp ứng yêu cầu chấm điểm.

## 11.4. AI-V03 Processing

AI-V03 chịu trách nhiệm:

- Sử dụng đúng cặp profile.
- Tạo semantic Skills Assessment trong một inference.
- Áp dụng các bảng điểm deterministic.
- Tổng hợp điểm theo policy cố định.
- Tạo Match Result có cấu trúc hợp lệ.

Provider-native structured output ràng buộc hình dạng dữ liệu LLM trả về.

Nó không tự chứng minh semantic assessment chính xác. Semantic quality được đánh giá qua evaluation, không mặc nhiên chuyển thành một runtime failure gate mới.

---

# 12. Freshness và Provenance

AI-V03 không có persisted/cached derived data nên không bổ sung cơ chế:

- `FRESH`
- `STALE`
- `INVALID`
- Regeneration scheduling
- Background invalidation

Trong phạm vi một lần xử lý:

- Job profile phải tương ứng với Job nguồn.
- CV profile phải tương ứng với CandidateCV nguồn.
- Match Result phải giữ đúng source identity của cặp được đánh giá.
- Semantic assessment không được giả mạo nguồn Job/CV.

Không yêu cầu thêm `matchingPolicyVersion`, `profileRevision` hoặc `modelVersion` vào persistence của AI-V03.

Nếu version sau phê duyệt lưu lịch sử matching, provenance/versioning phục vụ lịch sử sẽ được thiết kế tại version đó.

---

# 13. Ownership / Multi-tenant Data Boundary

| Data / Artifact | Ownership boundary |
|---|---|
| Job | Theo Backend Job ownership và visibility hiện có |
| CandidateCV | Theo CandidateCV ownership hiện có |
| JobMatchProfile | Kế thừa quyền sử dụng Job nguồn |
| CVMatchProfile | Kế thừa quyền sử dụng CandidateCV nguồn |
| Skills Assessment | Theo cặp nguồn được phép sử dụng |
| Match Result | Theo ngữ cảnh Candidate thực hiện matching |

Nguyên tắc:

- Candidate chỉ sử dụng CandidateCV mà họ được phép cung cấp cho capability này.
- Job được đánh giá phải thuộc phạm vi Candidate được phép truy cập.
- AI-V03 không mở quyền truy cập dữ liệu mới.
- Candidate A không được sử dụng CV riêng của Candidate B chỉ bằng cách cung cấp ID.
- AI processing không tự xác định hoặc mở rộng authorization.

Không bổ sung persisted owner field hoặc tenant field mới.

---

# 14. Snapshot / Historical Data

AI-V03 không bổ sung snapshot/historical persistence.

Không lưu:

- Snapshot Job.
- Snapshot CandidateCV.
- Match Result history.
- Bản sao LLM assessment.
- Matching policy history.
- Historical score comparison.

Match Result phản ánh input được sử dụng trong lần đánh giá đó.

Nó không được xem là historical artifact có thể tra cứu lại sau khi request hoàn tất.

---

# 15. Retention / TTL

AI-V03 không bổ sung retention hoặc TTL requirement.

Vì không persist Match Result hoặc intermediate assessment nên không cần:

- TTL index.
- Cleanup job.
- Expiration timestamp.
- Matching history retention policy.

Không thiết kế retention cho các artifact chưa được phê duyệt tồn tại.

---

# 16. Explicitly Excluded Persistence

AI-V03 chủ động **không bổ sung**:

- `MatchResult` collection.
- Skills Assessment collection.
- Score fields trong Job/CandidateCV.
- Persisted normalized profiles.
- LLM request/response history.
- Prompt history.
- Per-field scoring history.
- Matching revision/version history.
- Cache layer.
- Embedding hoặc vector store.
- Recommendation history.
- CV improvement proposal.
- Agent action/state.
- Speculative metadata phục vụ version tương lai.

Không thêm dữ liệu persisted chỉ vì có thể hữu ích cho CV Improvement hoặc Job Recommendation sau này.

---

# 17. Compatibility với version trước

## 17.1. Invariants phải giữ

- AI-V01 tiếp tục deterministic normalization.
- AI-V02 tiếp tục Uploaded CV normalization theo contract đã duyệt.
- Hai nguồn CV sử dụng cùng canonical `CVMatchProfile` semantics.
- Sparse profile vẫn có thể `READY`.
- Evidence/provenance và uncertainty hiện có không bị diễn giải lại trong normalization.
- AI-generated claim không trở thành canonical business truth.

## 17.2. Existing Schema phải giữ

Không thay đổi schema của:

- Job.
- CandidateCV.
- Career Category.
- Experience Level.
- Employment Type.
- Work Mode.

## 17.3. AI Data Contract phải giữ

`JobMatchProfile` và `CVMatchProfile` tiếp tục là runtime-only normalized representations.

AI-V03 chỉ tiêu thụ các profile này.

Scoring logic tiêu thụ Semantic Skills Assessment theo logical contract, không gắn chặt với toàn bộ provider-specific output của AI-V03. Version sau có thể cung cấp assessment tương thích để sử dụng lại scoring logic mà không cần dùng lại nguyên prompt hoặc JSON output của AI-V03.

## 17.4. Thay đổi được phép

AI-V03 được phép tạo derived assessment riêng trong runtime để phục vụ matching.

Semantic interpretation trong V03 không biến thành trách nhiệm mới của V01/V02.

## 17.5. Thay đổi không được phép

AI-V03 không được:

- Ghi đè normalized profile.
- Tạo canonical skill/category fact mới.
- Thay đổi CandidateCV.
- Thay đổi Job.
- Ghi kết quả matching vào source entity khi chưa có authority.
- Đưa completeness gate mới vào V01/V02.

---

# 18. Persistence Invariants

| ID | Invariant | Enforcement owner |
|---|---|---|
| DI-01 | Job và CandidateCV vẫn là canonical sources | Backend / Schema |
| DI-02 | AI-V03 không tạo persisted entity hoặc field mới | Data Contract / Implementation |
| DI-03 | Hai normalized profiles chỉ tồn tại runtime | Normalization / AI processing |
| DI-04 | Match Result phải gắn với đúng cặp Job–CV | Backend / AI processing |
| DI-05 | Matching không được vượt quyền sử dụng Job/CV | Backend |
| DI-06 | AI-derived assessment không ghi ngược vào canonical sources | AI processing |
| DI-07 | Missing field được đánh giá theo Product policy, không tự thành processing failure | AI processing |
| DI-08 | Điểm deterministic và weighted aggregate không do LLM quyết định | AI processing |
| DI-09 | Technical failure không được biểu diễn thành Match Score 0 | AI processing |
| DI-10 | Result không hoàn chỉnh về cấu trúc không được coi là Match Result thành công | AI processing |
| DI-11 | AI-V03 không thay đổi contract đã phê duyệt của V01/V02 | AI Kit |

Các invariant trên chỉ phục vụ ranh giới dữ liệu và tính nhất quán của capability hiện tại.

Chúng không đặt thêm accuracy threshold, confidence threshold, completeness threshold hoặc semantic rejection gate.

---

# 19. Definition of AI Data Completion

AI-V03 Data Contract được coi là hoàn thành khi:

- Canonical Job/CandidateCV sources đã rõ.
- Runtime input là `JobMatchProfile` và `CVMatchProfile`.
- Derived assessment và Match Result đã được phân loại.
- Runtime-only persistence decision đã rõ.
- Không có persisted entity, field hoặc index mới ngoài scope.
- Source identity và ownership boundary đã rõ.
- Minimum Match Result semantics đã rõ.
- Skills Assessment và deterministic assessment có trách nhiệm tách biệt.
- Không có freshness, snapshot, TTL hay transaction requirement mới.
- Compatibility với AI-V01/V02 được giữ.
- Không cần tự đưa ra business decision mới trong implementation để quyết định có lưu kết quả hay không.

**Data Completion không đồng nghĩa với implementation hoặc test đã hoàn thành.**

---

# 20. Implementation Boundary

Tài liệu này là:

**AI-V03 Data Contract — WHAT DATA EXISTS AND WHAT PERSISTS**

Tài liệu xác định:

- Source ownership.
- Data classification.
- Runtime/persistence boundary.
- Runtime artifact responsibility.
- Logical output groups.
- Source identity và relationship.
- Compatibility.
- Data invariants.

Tài liệu không quyết định:

- LLM provider/model.
- Prompt cụ thể.
- Provider-native JSON Schema cụ thể.
- Code architecture.
- Scoring function implementation.
- API endpoint.
- Controller/service boundaries.
- Test framework.
- Evaluation dataset.
- Retry strategy.
- Logging/observability infrastructure.

Những nội dung đó thuộc Engineering Contract và implementation, trong phạm vi Product Specification đã phê duyệt.

Nếu Engineering phát hiện cần lưu dữ liệu mới hoặc bổ sung một capability ngoài scope, vấn đề phải được đưa trở lại Product/Data Contract để quyết định.

**Không tự mở rộng AI-V03 nhằm chuẩn bị trước cho các version sau.**

---

**Trạng thái tài liệu: `APPROVED`**

