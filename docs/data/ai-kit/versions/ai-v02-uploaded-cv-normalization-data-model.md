# AI-V02 — Uploaded CV Normalization Data Model

> **File:** `docs/data/ai-kit/versions/ai-v02-uploaded-cv-normalization-data-model.md`
> **Vai trò:** Canonical AI Persistence / Data Contract
> **Phase:** JOBHUB AI Phase
> **Ngôn ngữ:** Tiếng Việt
> **Product authority:** `docs/product/ai-kit/versions/v02-uploaded-cv-normalization.md`
> **Trạng thái:** `APPROVED`

---

# 1. Mục đích

Tài liệu này xác định Data Contract phục vụ AI-V02 — Uploaded CV Normalization.

AI-V02 cho phép JOBHUB chuyển nội dung Uploaded Candidate CV dạng PDF thành canonical `CVMatchProfile`, sử dụng làm đầu vào cho các AI capability tiếp theo.

AI Product Specification là authority đối với business behavior. Data Contract này xác định:

- Canonical source của Uploaded CV.
- Các data abstraction được sử dụng.
- Quan hệ giữa Uploaded CV và `CVMatchProfile`.
- Ranh giới giữa extracted text và normalized AI data.
- Ownership và source identity.
- Data invariants.
- Compatibility với AI-V01.
- Quyết định runtime-only, không persistence/cache trong V02.

Tài liệu không định nghĩa JSON shape chi tiết, prompt, provider configuration hoặc thuật toán xử lý PDF.

Data Contract không tự mở rộng capability ngoài Product Specification AI-V02.

---

# 2. Thay đổi so với version trước

| Entity / Artifact | Classification | Trạng thái | Mô tả |
|---|---|---|---|
| `CandidateCV` | CANONICAL | UNCHANGED | Canonical Candidate CV, bao gồm Uploaded CV |
| Uploaded PDF | CANONICAL SOURCE | UNCHANGED | Tài liệu nguồn được quản lý theo hợp đồng Backend hiện có |
| Canonical CandidateCV metadata | CANONICAL | UNCHANGED | Backend cung cấp metadata của đúng CV nguồn để kết hợp deterministic |
| Extracted PDF Text | RUNTIME_ONLY | NEW | Văn bản trung gian được trích xuất từ PDF |
| `CVMatchProfile` | NORMALIZED_AI | UPDATED | Mở rộng khả năng biểu diễn Uploaded CV, giữ canonical semantics V01 |
| AI Processing Result | RUNTIME_ONLY | UPDATED | Kết quả xử lý profile với semantics thống nhất |

`UPDATED` đối với `CVMatchProfile` chỉ thể hiện biến thể Uploaded CV bổ sung cho cùng canonical profile; biến thể Generated CV và semantics V01 giữ nguyên.

Không phê duyệt entity hoặc collection mới tại baseline này.

Không thay đổi canonical CandidateCV schema.

---

# 3. Data Classification và Entity tổng thể

## 3.1. Canonical

Nguồn business data chính:

- CandidateCV.
- Canonical metadata của CandidateCV nguồn.
- Uploaded CV.
- Uploaded PDF của CandidateCV.

Canonical ownership, source identity và lifecycle tiếp tục do JOBHUB Backend quản lý.

AI-V02 không sở hữu hoặc thay đổi canonical source.

## 3.2. Normalized AI

`CVMatchProfile` là canonical normalized AI representation.

AI-V02 sử dụng cùng khái niệm `CVMatchProfile` đã được xác lập trong AI-V01.

Profile có thể được tạo từ:

- Generated CV thông qua AI-V01.
- Uploaded CV thông qua AI-V02.

Hai nguồn có phương thức chuẩn hóa khác nhau nhưng phải giữ ý nghĩa nghiệp vụ thống nhất.

## 3.3. Derived

Nội dung nghề nghiệp được AI diễn giải từ extracted PDF text là thông tin derived từ Uploaded CV.

Các claim được ghi nhận không tự trở thành independently verified Candidate facts.

Không phê duyệt một persisted derived entity riêng trong baseline này.

## 3.4. AI Artifact

AI-V02 không tạo Match Result, Recommendation Result hoặc Agent Proposal.

Không có persisted AI artifact mới được phê duyệt.

## 3.5. Runtime-only

Dữ liệu phục vụ hoạt động xử lý bao gồm:

- Nội dung văn bản trích xuất từ PDF.
- Context cần thiết cho semantic extraction.
- Kết quả xử lý trong phạm vi lần thực hiện.

Extracted text, kết quả diễn giải và profile chỉ tồn tại trong lần xử lý; không persist, cache hoặc tái sử dụng giữa các lần gọi.

Nguyên tắc:

```text
AI-generated data
!=
canonical business data
```

Không tạo database collection chỉ vì một object tồn tại trong quá trình xử lý.

---

# 4. Quan hệ dữ liệu

Quan hệ logic:

```text
CandidateCV
    ├── canonical metadata ──────────────────────┐
    └── Uploaded PDF                             │
             │                                   │
             │ extraction                        │
             ▼                                   │
       Extracted Text                            │
             │                                   │
             │ LLM diễn giải PDF                 │
             ▼                                   │
       PDF-derived claims ── deterministic merge ┘
                              │
                              ▼
                        CVMatchProfile
```

Quan hệ nguồn:

| Dữ liệu | Source | Ownership |
|---|---|---|
| Uploaded PDF | CandidateCV | Theo CandidateCV |
| Canonical metadata | CandidateCV | Backend |
| Extracted Text | Uploaded PDF | Kế thừa quyền sử dụng source |
| CVMatchProfile | Uploaded CV | Kế thừa quyền sử dụng source |
| Processing Result | Một lần xử lý Uploaded CV | Theo source và capability được phép |

Một lần xử lý thành công tạo kết quả tương ứng với một Uploaded CV cụ thể.

Quan hệ này chỉ tồn tại trong lần xử lý, không lưu bằng persistent references.

Không bổ sung ownership hoặc authorization relationship mới.

---

# 5. Entity / Artifact Definitions

AI-V02 không yêu cầu sửa persisted entity hiện có tại baseline.

## 5.1. Responsibility

**CandidateCV**

Tiếp tục quản lý:

- Candidate CV identity.
- Uploaded file reference.
- Canonical metadata hiện có.
- Ownership.
- Existing lifecycle.

Không chịu trách nhiệm lưu AI-generated claims nếu chưa có Product/Data authority tương ứng.

**Uploaded PDF**

Là tài liệu nguồn của Uploaded CV, được quản lý theo Backend Product Contract hiện tại.

AI-V02 không thay đổi hoặc thay thế nội dung file nguồn.

**CVMatchProfile**

Là normalized AI representation phục vụ các AI capability tiếp theo.

Không phải CandidateCV replacement hoặc persisted Candidate business truth.

## 5.2. Fields

Không bổ sung persisted field mới trong CandidateCV tại baseline này.

Không yêu cầu thêm:

- AI extraction status.
- Normalized profile.
- Extracted text.
- AI-generated skills.
- AI-generated experience.
- Processing history.
- Profile revision.

Các trường trên không bị phê duyệt chỉ vì có thể hữu ích cho implementation.

`CVMatchProfile` runtime dùng chung canonical semantics và phân biệt biến thể Generated/Uploaded theo source. Shape JSON chi tiết thuộc Engineering Contract; Data Contract này chốt source/provenance và các nhóm field cần bảo toàn tại §6.1.

## 5.3. Enum

Không bổ sung persisted business enum mới.

`READY` và `FAILED` áp dụng theo semantics runtime result của AI-V01.

Không tự bổ sung `BLOCKED` hoặc trạng thái CandidateCV mới.

## 5.4. Indexes

Không bổ sung index mới.

Không có persistence query hoặc retrieval requirement mới được phê duyệt.

## 5.5. Reference rules

- `CVMatchProfile` phải gắn với đúng CandidateCV nguồn.
- Nguồn Uploaded CV phải được xác định hợp lệ.
- Source identity không được do AI tự sáng tạo.
- Kết quả không được gắn sang CV khác.
- Ownership và authorization của source tiếp tục áp dụng.

Không yêu cầu persisted foreign key hoặc reference mới.

---

# 6. AI-derived Data Contract

## 6.1. `CVMatchProfile`

**Classification:** `NORMALIZED_AI`

**Source:** Generated Candidate CV theo V01 hoặc Uploaded Candidate CV hợp lệ theo V02.

**Persistence:** `RUNTIME_ONLY`; không persist, cache hoặc tái sử dụng giữa các lần xử lý.

### Responsibility

`CVMatchProfile` biểu diễn thông tin nghề nghiệp theo canonical semantics chung. Với Uploaded CV, profile kết hợp canonical CandidateCV metadata và thông tin được trích xuất, diễn giải từ PDF.

Các nhóm semantics dùng chung với AI-V01 bao gồm:

- Career positioning.
- Professional summary.
- Skills.
- Work experience.
- Projects.
- Education.
- Certifications.
- Languages.
- Canonical CandidateCV metadata có ý nghĩa nghề nghiệp, theo source Backend.
- Các career-related claims thuộc canonical scope.
- Source associations và evidence.
- Missing, uncertainty và conflicting claims khi áp dụng.

Không yêu cầu mọi nhóm thông tin phải có dữ liệu.

### Source-specific representation

`CVMatchProfile` phải phân biệt được Generated CV và Uploaded CV.

Biến thể Generated CV tiếp tục giữ structured content, free text, presentation metadata và provenance theo V01; deterministic normalization không đổi.

Biến thể Uploaded CV gồm hai phần có provenance riêng:

- Canonical CandidateCV metadata do Backend cung cấp: `categoryId`, `experienceLevelId` (nếu có), `preferredLocations[]`, `skillTags[]`, `employmentTypes[]`, `workModes[]`; giữ giá trị và taxonomy identity theo Backend, không suy diễn từ PDF. `name`, ownership, lifecycle, visibility và file metadata chỉ phục vụ quản lý/kiểm tra nguồn, không trở thành claim nghề nghiệp.
- Nội dung nghề nghiệp được LLM diễn giải từ văn bản PDF, gồm claim có evidence, nội dung còn mơ hồ hoặc chưa ánh xạ được, và provenance chỉ tới PDF/đoạn văn bản nguồn phù hợp; không giả lập structured Generated CV field hoặc presentation metadata của V01.

Hệ thống kết hợp hai phần một cách deterministic. Nếu metadata và PDF khác nhau, giữ cả hai cùng nguồn; không ghi đè, giả lập provenance, tự gộp thành một fact hoặc tự xác minh bên nào đúng.

Các thuộc tính chỉ có ý nghĩa với Generated CV không được tự giả lập thành dữ liệu có nguồn của Uploaded CV.

Source và provenance phải phản ánh đúng loại nguồn.

Không yêu cầu cả hai loại CV có cách tham chiếu nguồn giống hệt nhau.

### Data constraints

1. Profile phải thuộc đúng CandidateCV nguồn.
2. Structured claims phải phản ánh thông tin được nguồn thể hiện tường minh.
3. Không tự tạo qualification không có căn cứ.
4. Missing information không đồng nghĩa với mismatch.
5. Không biến conflicting claims thành một fact duy nhất không có căn cứ.
6. Không tự tạo canonical taxonomy identity.
7. Không thay đổi CandidateCV metadata hoặc persisted content.
8. Output đúng cấu trúc không đồng nghĩa đã được xác minh chính xác về ngữ nghĩa.
9. Không bắt buộc đầy đủ tất cả nhóm thông tin nghề nghiệp để biểu diễn một profile.
10. Không tạo một canonical profile nghiệp vụ khác với V01.
11. Backend metadata chỉ lấy từ cùng CandidateCV đã được xác thực/ủy quyền; LLM không tạo, sửa hoặc xác nhận metadata.
12. Sparse profile vẫn có thể `READY` nếu output hợp lệ; không yêu cầu số claim hay độ đầy đủ tối thiểu.

### Không chịu trách nhiệm

- Persist CandidateCV.
- Cập nhật Uploaded PDF.
- Xác minh Candidate facts ngoài đời thực.
- Matching hoặc scoring.
- Job recommendation.
- Profile history hoặc version management khi chưa được phê duyệt.

### Source thay đổi thì

Kết quả đã được tạo từ nội dung PDF trước đó không tự đại diện cho PDF mới.

V02 không lưu hoặc tái sử dụng profile. Lần xử lý tiếp theo đọc PDF và metadata hiện hành rồi tạo profile mới; không có persisted freshness/invalidation lifecycle.

---

## 6.2. Extracted PDF Text

**Classification:** `RUNTIME_ONLY`.

**Source:** Uploaded PDF.

### Responsibility

Cung cấp nội dung văn bản có thể đọc được từ PDF để phục vụ semantic extraction.

Extracted Text:

- Không phải canonical CandidateCV data.
- Không phải `CVMatchProfile`.
- Không mặc nhiên có cấu trúc nghề nghiệp.
- Không bảo đảm mọi nội dung trực quan trong PDF đã được trích xuất chính xác.

### Data constraints

- Phải tương ứng với đúng PDF nguồn.
- Không tự bổ sung nội dung nghề nghiệp.
- Không tự chuyển đổi thông tin thành Candidate facts.
- Không được coi văn bản rỗng là một CV đã được chuẩn hóa thành công.

### Source thay đổi thì

Extracted Text từ PDF cũ không được tự đại diện cho PDF mới.

Không tạo persisted extraction artifact hoặc cache.

---

## 6.3. AI Result

AI-V02 tạo kết quả xử lý `CVMatchProfile`.

Kết quả thành công phải chứa một profile đáp ứng canonical output contract.

Kết quả áp dụng semantics của V01:

| Status | Ý nghĩa |
|---|---|
| `READY` | Canonical profile được tạo hợp lệ, kể cả khi sparse hoặc không nhận diện được claim nghề nghiệp từ PDF có text |
| `FAILED` | Quá trình xử lý không tạo được canonical profile hợp lệ |

Không bổ sung trạng thái `BLOCKED`.

Không có persisted processing history được phê duyệt.

Không đặt completeness threshold. PDF không có text trích xuất được hoặc xử lý không tạo được output hợp lệ không được báo `READY`; input bị từ chối theo quy tắc JOBHUB không phải đánh giá Candidate.

---

# 7. Embedding / Vector Data

> Version này không bổ sung embedding/vector persistence.

AI-V02 không tạo:

- CV embedding.
- Job embedding.
- Vector index.
- Vector search representation.
- Retrieval artifact.

Embedding và vector retrieval thuộc các AI capability sau.

---

# 8. State Matrix

> Version này không cần State Matrix riêng.

Không có persisted AI artifact lifecycle mới được phê duyệt.

Các kết quả runtime không tự tạo trạng thái cho CandidateCV.

---

# 9. Persistence Transitions

AI-V02 không bổ sung persistence transition mới tại baseline.

Quy trình xử lý Uploaded CV không tự thay đổi:

- CandidateCV status.
- Uploaded file reference.
- Ownership.
- Canonical metadata.
- CandidateCV lifecycle.

Nếu một Uploaded PDF được thay thế, Backend tiếp tục áp dụng lifecycle hiện có.

Mọi cơ chế làm mới hoặc vô hiệu hóa persisted AI result trong tương lai phải được phê duyệt riêng.

Không tạo transition mới chỉ từ nhu cầu kỹ thuật của pipeline.

---

# 10. Transaction / Atomicity Requirements

> Version này không bổ sung transaction/atomicity requirement mới.

AI-V02 không yêu cầu cập nhật nhiều canonical resource đồng thời.

Không có persisted AI write operation mới được phê duyệt cần transaction riêng.

Nếu sau này bổ sung persistence, các yêu cầu atomicity sẽ được xem xét dựa trên invariant thực tế.

---

# 11. Constraint Ownership

## 11.1. Database / Schema

JOBHUB Backend tiếp tục sở hữu:

- CandidateCV persisted schema.
- Uploaded file metadata.
- Canonical identity.
- Existing field constraints.
- Existing lifecycle constraints.

AI-V02 không thay thế database validation hoặc ownership của Backend.

Không bổ sung persisted schema constraint mới.

## 11.2. Service

JOBHUB Backend chịu trách nhiệm:

- Xác định đúng CandidateCV.
- Kiểm tra authorization và ownership.
- Xác định Uploaded PDF được phép sử dụng.
- Cung cấp canonical metadata của đúng CandidateCV nguồn theo Backend Data Contract V7; không đưa metadata cho LLM diễn giải như nội dung PDF.
- Bảo đảm nguồn dữ liệu thuộc phạm vi hợp lệ.
- Không ghi AI output vào canonical resource khi chưa có authority.

## 11.3. AI Processing

AI processing chịu trách nhiệm:

- LLM chỉ diễn giải extracted PDF text thành nội dung có căn cứ; hệ thống kết hợp deterministic với metadata Backend để tạo normalized representation theo Product Contract.
- Đáp ứng output contract được áp dụng.
- Không coi invalid output là usable `CVMatchProfile`.
- Phân biệt dữ liệu nguồn và thông tin được AI diễn giải.
- Không tự quyết định authorization.
- Không biến AI-generated claims thành canonical business data.

Provider-level output constraint và các bước kiểm tra output thuộc Engineering Contract.

---

# 12. Freshness và Provenance

V02 xử lý runtime-only; không persist hoặc cache derived data.

Vì vậy, không định nghĩa các trạng thái persisted `FRESH`, `STALE` hoặc `INVALID`.

### Source provenance

Mỗi `CVMatchProfile` phải nhận diện đúng Uploaded CV nguồn.

Metadata Backend và nội dung PDF giữ provenance riêng. Những thông tin có nguồn từ PDF không được giả lập là canonical metadata hoặc dữ liệu Generated CV có cấu trúc.

Provenance phải giữ được ý nghĩa truy nguyên nguồn phù hợp với canonical semantics.

### Nếu version sau bổ sung persistence

Trước khi lưu hoặc tái sử dụng kết quả, phải xác định:

- Source identity.
- Source revision hoặc equivalent identity nếu cần.
- Điều kiện kết quả còn đại diện cho PDF hiện hành.
- Hành vi khi PDF thay đổi.
- Chính sách regeneration hoặc invalidation.

Không tự thêm version metadata khi chưa có lifecycle requirement tương ứng.

---

# 13. Ownership / Multi-tenant Data Boundary

| Artifact | Owner / Boundary |
|---|---|
| CandidateCV | Candidate theo Backend ownership |
| Uploaded PDF | Theo CandidateCV |
| Extracted Text | Kế thừa quyền sử dụng Uploaded CV |
| CVMatchProfile | Kế thừa quyền sử dụng Uploaded CV |
| AI Processing Result | Theo source và capability được phép |

Các invariant:

- Candidate không được truy cập dữ liệu của Candidate khác ngoài quyền hiện có.
- AI processing không tạo authorization path mới.
- Không dùng client-supplied identifier làm bằng chứng sở hữu.
- Derived data không được tách khỏi source ownership.
- Không tự mở rộng nguồn dữ liệu sang Candidate/Company khác.

> Version này không bổ sung multi-tenant data boundary mới.

---

# 14. Snapshot / Historical Data

> Version này không bổ sung snapshot/historical persistence mới.

AI-V02 không yêu cầu lưu:

- Historical `CVMatchProfile`.
- Historical extracted PDF text.
- Historical LLM response.
- Processing result history.
- Profile revision history.

V02 không lưu hoặc tái sử dụng kết quả giữa các lần xử lý.

Nếu sau này xuất hiện historical artifact, phải xác định rõ mối quan hệ giữa artifact đó và phiên bản PDF đã xử lý.

Không mặc định snapshot toàn bộ PDF hoặc CandidateCV.

---

# 15. Retention / TTL

> Version này không bổ sung retention/TTL requirement mới.

Không có persisted AI artifact mới được phê duyệt để yêu cầu retention policy riêng.

Không tự tạo TTL, cleanup policy hoặc data retention period chỉ vì extraction được thực hiện.

Nếu persistence hoặc cache được bổ sung, retention và cleanup phải được xác định theo lifecycle đã phê duyệt.

---

# 16. Explicitly Excluded Persistence

Baseline này không phê duyệt thêm:

- Collection riêng cho extracted PDF text.
- Collection riêng cho Uploaded CV normalized profile.
- Lưu toàn bộ prompt history.
- Lưu toàn bộ LLM response history.
- Duplicate Uploaded PDF.
- Duplicate CandidateCV.
- Persisted AI processing state mới.
- Embedding hoặc vector index.
- Speculative AI metadata.
- Agent state hoặc recommendation history.

Danh sách này xác định những persistence change ngoài phạm vi V02. Version sau cần Product/Data authority riêng nếu muốn thêm.

Không thêm persistence chỉ để chuẩn bị cho các AI capability tương lai.

---

# 17. Compatibility với version trước

## 17.1. Invariant phải giữ

- Một canonical `CVMatchProfile` dùng chung về semantics.
- Generated/Uploaded là hai biến thể theo nguồn; V01 giữ nguyên biểu diễn và deterministic normalization.
- Metadata Backend và claim PDF có provenance riêng, được kết hợp deterministic.
- Không tự tạo Candidate facts không có căn cứ.
- Missing information không phải mismatch.
- AI output không tự trở thành canonical business truth.
- Authorization và ownership không bị vượt qua.
- Normalized profile không phải matching result.

## 17.2. Existing schema phải giữ

- CandidateCV canonical schema.
- Generated CV source representation.
- Uploaded CV storage representation.
- Existing Backend ownership và lifecycle constraints.

Không sửa existing persisted schema nếu không có requirement được phê duyệt.

## 17.3. AI data contract phải giữ

AI-V01 tiếp tục hỗ trợ:

```text
Generated CV
    ↓
Deterministic Normalization
    ↓
CVMatchProfile
```

V02 bổ sung:

```text
Uploaded CV → Backend canonical metadata ───────────┐
Uploaded PDF → Extracted Text → LLM PDF claims ─────┤
                                  deterministic merge ↓
                                      CVMatchProfile
```

Hai luồng phải giữ thống nhất về canonical meaning.

AI-V02 không yêu cầu Generated CV đi qua semantic extraction.

## 17.4. Thay đổi được phép

- Mở rộng nguồn tạo `CVMatchProfile`.
- Phân biệt biến thể Generated CV và Uploaded CV trong cùng canonical profile.
- Bổ sung cách biểu diễn provenance phù hợp với Uploaded PDF.
- Kết hợp canonical CandidateCV metadata do Backend cung cấp với claim PDF bằng quy tắc deterministic, không áp đặt cấu trúc Generated CV lên Uploaded CV.

JSON shape và validation cụ thể thuộc Engineering Contract trước implementation; source/provenance và semantics đã được chốt ở đây.

## 17.5. Thay đổi không được phép

- Thay thế canonical `CVMatchProfile` bằng profile nghiệp vụ độc lập.
- Ép Uploaded CV thành Generated CV giả.
- Thay đổi deterministic semantics của V01.
- Làm mất nghĩa nguồn của các claim.
- Tự sửa canonical CandidateCV data.
- Ngầm thêm persisted AI artifact.
- Dùng LLM để tạo hoặc sửa canonical CandidateCV metadata.
- Cache/tái sử dụng extracted text, kết quả LLM hoặc profile trong V02.

AI-V02 không được âm thầm reinterpret kết quả đã được xác lập bởi AI-V01.

---

# 18. Persistence Invariants

Các invariant bắt buộc:

| Invariant | Enforcement Owner |
|---|---|
| AI output không tự trở thành canonical CandidateCV data | Backend Service |
| CVMatchProfile phải gắn đúng CV nguồn | Backend Service / AI Processing |
| Authorization và ownership phải hợp lệ | Backend Service |
| Extracted text không tự trở thành structured business truth | AI Processing |
| Invalid output không được coi là usable profile | AI Processing |
| AI không được tự tạo canonical source identity | Backend Service / AI Processing |
| Không thay đổi Uploaded PDF nguồn | Backend Service |
| Không thay đổi Generated CV semantics V01 | AI Processing / Contract Verification |
| Technical failure không trở thành negative business result | Backend Service / AI Processing |
| Không persist/cache/reuse artifact runtime V02 | Backend Service / AI Processing |

Nếu persistence được bổ sung về sau:

- Derived data phải có source rõ ràng.
- Không sử dụng stale data như fresh.
- Ownership phải được bảo toàn.
- Không tạo historical artifact không có lifecycle.
- Cache không trở thành canonical source of truth.

Các invariant có điều kiện này chỉ phát sinh enforcement cụ thể khi persistence được phê duyệt.

---

# 19. Definition of AI Data Completion

AI-V02 Data Contract được coi là hoàn thành khi:

- Canonical Uploaded CV source được xác định.
- Các dữ liệu normalized và runtime được phân loại rõ.
- `CVMatchProfile` giữ canonical semantics của V01.
- Hai biến thể theo nguồn và provenance của từng phần được xác định.
- Output không gắn sai CandidateCV.
- Ownership và authorization boundary được giữ.
- Không có schema, entity hoặc persistence speculative.
- Data constraints và enforcement owner được xác định.
- Runtime-only, không persistence/cache/reuse được giữ trong V02.
- Không cần persisted freshness/invalidation lifecycle cho V02.
- Compatibility với V01 được xác nhận.
- Không có hành vi ngoài Product Contract.

Data Completion không có nghĩa:

```text
LLM đã chạy được
```

```text
JSON Schema đã được implement
```

```text
PDF.js đã extract thành công
```

```text
Unit test đã pass
```

Data Completion có nghĩa:

```text
Data responsibility và source boundary
đủ rõ để implementation không phải
tự quyết định các data architecture
quan trọng.
```

**Data Contract AI-V02 đã được Product Owner phê duyệt.** D1–D4 đã được đồng bộ; Engineering Contract và kế hoạch đánh giá vẫn thuộc các bước riêng trước implementation. Phê duyệt Product/Data không tự xác nhận implementation hoặc Final Acceptance.

---

# 20. Implementation Boundary

Tài liệu này là:

```text
CANONICAL AI PERSISTENCE / DATA CONTRACT
```

Ở trạng thái hiện tại:

```text
APPROVED
```

Tài liệu xác định:

```text
WHAT DATA IS REQUIRED
```

```text
WHICH SOURCE OWNS THE DATA
```

```text
WHAT MUST REMAIN CANONICAL
```

```text
WHAT MAY BE NORMALIZED OR DERIVED
```

```text
WHAT MUST NOT BE PERSISTED
WITHOUT APPROVAL
```

Tài liệu không định nghĩa:

- LLM provider hoặc model.
- Prompt.
- Strict Structured Output configuration.
- JSON Schema chi tiết.
- PDF extraction algorithm.
- Semantic extraction algorithm.
- Runtime validation implementation.
- REST endpoint.
- Controller hoặc service structure.
- Queue/worker implementation.
- MongoDB query.
- Mongoose methods.
- Frontend workflow.
- Test framework.

Canonical hierarchy:

```text
AI Product Specification
        │
        │ business / capability truth
        ▼
AI Data Contract
        │
        │ data / persistence truth
        ▼
AI Engineering Contracts
        │
        │ architecture / algorithm truth
        ▼
Implementation
        │
        ├── backend
        ├── ai-kit
        └── frontend
        ▼
Tests / Evaluation
```

Authority:

```text
Approved AI Product Spec
→ business / capability truth

Approved AI Data Contract
→ data / persistence truth

Approved AI Engineering Contracts
→ architecture / algorithm truth

Source code + tests
→ implementation evidence
```

Nếu cần bổ sung business behavior chưa được phê duyệt:

```text
Return to Product layer
        ↓
Human decision
        ↓
Update Data Contract
```

Data Contract không được tự mở rộng phạm vi hoặc tạo business behavior ngoài Product Specification.
