# AI-V04 — CV Evaluation & Improvement Data Model

> **File:** `docs/data/ai-kit/versions/v04-cv-evaluation-improvement.md`
> **Vai trò:** Canonical AI Persistence / Data Contract  
> **Phase:** JOBHUB AI Phase  
> **Ngôn ngữ:** Tiếng Việt  
> **Product authority:** `docs/product/ai-kit/versions/v04-cv-evaluation-improvement.md`

---

# 1. Mục đích

Tài liệu xác định những dữ liệu và data artifact cần thiết để thực hiện AI-V04 — CV Evaluation & Improvement.

V04 sử dụng dữ liệu Job/CV và các Match Profile hiện có để tạo kết quả đánh giá.

**V04 không yêu cầu persistence mới.** Kết quả đánh giá được tạo và trả về trong phạm vi request hiện tại.

Data Model này xác định:

- Nguồn dữ liệu được sử dụng.
- Classification của các data artifact.
- Quan hệ giữa Job, CV, Match Profile và Evaluation Result.
- Phạm vi dữ liệu runtime.
- Ownership và compatibility với các AI version trước.
- Những dữ liệu chủ động không lưu trữ.

Tài liệu không mở rộng capability ngoài AI-V04 Product Specification.

# 2. Thay đổi so với version trước

| Entity / Artifact | Classification | Trạng thái | Mô tả |
|---|---|---|---|
| `Job` | CANONICAL | UNCHANGED | Job được chọn để đánh giá |
| `CandidateCV` | CANONICAL | UNCHANGED | CV thuộc quyền Candidate |
| `JobMatchProfile` | NORMALIZED_AI | UNCHANGED | Dữ liệu Job chuẩn hóa |
| `CVMatchProfile` | NORMALIZED_AI | UNCHANGED | Dữ liệu CV chuẩn hóa |
| V03 Scoring Result | DERIVED | UNCHANGED | Năng lực chấm điểm được tái sử dụng |
| V04 Evaluation Context | RUNTIME_ONLY | NEW | Dữ liệu chuẩn bị cho đánh giá V04 |
| V04 Evaluation Result | AI_ARTIFACT | NEW | Kết quả đánh giá và cải thiện CV, không persist |

`NEW` ở đây biểu thị data abstraction mới của V04, không đồng nghĩa với việc tạo collection hoặc database entity.

V04 không yêu cầu thay đổi schema của Job, CandidateCV hoặc các Match Profile hiện có.

# 3. Data Classification và Entity tổng thể

## 3.1. Canonical

Nguồn dữ liệu nghiệp vụ:

- `Job`.
- `CandidateCV`.

V04 đọc dữ liệu canonical thông qua các capability hiện có của JOBHUB.

V04 không sở hữu và không thay đổi dữ liệu canonical.

## 3.2. Normalized AI

Các representation chuẩn hóa:

- `JobMatchProfile`.
- `CVMatchProfile`.

V04 sử dụng contract đã có từ V01/V02, không tạo một loại Match Profile mới.

## 3.3. Derived

Bao gồm kết quả matching/scoring được tính từ các Match Profile theo chính sách V03.

Derived scoring data không tự trở thành canonical business data.

## 3.4. AI Artifact

`V04EvaluationResult` là artifact kết quả đánh giá.

Artifact bao gồm điểm số, nhận xét và những gợi ý cải thiện CV.

Artifact này không có persisted lifecycle trong V04.

## 3.5. Runtime-only

Các dữ liệu tạm thời của V04 có thể gồm:

- Evaluation Context.
- Kết quả phân tích ngữ nghĩa.
- Thông tin scoring trung gian.
- Nhận xét và gợi ý trước khi tổng hợp response.

Những dữ liệu này chỉ phục vụ quá trình evaluation hiện tại.

# 4. Quan hệ dữ liệu

Luồng quan hệ logic:

```text
Job → JobMatchProfile
                     \
                      → V04 Evaluation Result
                     /
CandidateCV → CVMatchProfile
```

`V04EvaluationResult` phụ thuộc vào một cặp Job và Candidate CV.

| Quan hệ | Cardinality trong một lần đánh giá | Ownership |
|---|---|---|
| Job → JobMatchProfile | Một nguồn Job cho một profile đầu vào | Theo Job source |
| CandidateCV → CVMatchProfile | Một nguồn CV cho một profile đầu vào | Candidate |
| Job + CandidateCV → Evaluation Result | Một cặp nguồn cho một kết quả request | Candidate request |

Các quan hệ trên là quan hệ xử lý dữ liệu, không yêu cầu tạo database reference mới.

# 5. Entity / Artifact Definitions

## 5.1. Responsibility

V04 không bổ sung persisted entity.

Các entity hiện có tiếp tục chịu trách nhiệm lưu Job và Candidate CV theo contract riêng của chúng.

`V04EvaluationResult` chỉ chịu trách nhiệm biểu diễn kết quả của use case hiện tại, không lưu lịch sử hoặc thay thế canonical data.

## 5.2. Fields

Không có persisted field mới được yêu cầu.

Không bổ sung field V04 vào `Job`, `CandidateCV` hoặc các collection hiện có.

Các field runtime phục vụ evaluation được mô tả tại Mục 6.

## 5.3. Enum

V04 không bổ sung enum nghiệp vụ cần lưu trong database.

Những định danh cho scoring criterion, CV section hoặc loại feedback được xác định trong runtime contract và sử dụng lại các giá trị có sẵn khi phù hợp.

## 5.4. Indexes

V04 không yêu cầu database index mới.

Các truy vấn Job/CV tiếp tục sử dụng cơ chế hiện có của Backend.

## 5.5. Reference rules

V04 sử dụng:

- Job identifier để xác định Job.
- Candidate CV identifier để xác định CV.
- Những source reference sẵn có trong Match Profile khi cần liên kết feedback với nội dung CV.

Các identifier này không tự tạo quyền truy cập.

Không yêu cầu persisted foreign key mới.

# 6. AI-derived Data Contract

## 6.1. `CVMatchProfile`

**Source:** Candidate CV.

**Persistence:** Theo contract V01/V02 hiện hành; V04 không bổ sung persistence.

**Responsibility:**

- Cung cấp dữ liệu nghề nghiệp của Candidate đã được chuẩn hóa.
- Cung cấp thông tin phục vụ matching.
- Cung cấp các section cần thiết cho nhận xét và cải thiện CV.
- Giữ thông tin nguồn đã có để liên kết feedback khi khả thi.

V04 không sửa đổi CVMatchProfile hoặc ghi ngược kết quả góp ý vào profile.

Nếu Candidate CV thay đổi, evaluation tiếp theo sử dụng dữ liệu được chuẩn bị theo cơ chế normalization hiện hành.

## 6.2. `JobMatchProfile`

**Source:** Job.

**Persistence:** Theo contract V01 hiện hành; V04 không bổ sung persistence.

**Responsibility:**

- Cung cấp yêu cầu và thông tin nghề nghiệp của Job.
- Là nguồn đối chiếu cho Matching/Scoring.
- Cung cấp bối cảnh để AI nhận xét CV.

V04 không thay đổi JobMatchProfile.

Nếu Job thay đổi, evaluation tiếp theo sử dụng dữ liệu Job được chuẩn bị theo cơ chế hiện hành.

## 6.3. AI Result

**Artifact:** `V04EvaluationResult`.

**Persistence:** `RUNTIME_ONLY`.

**Owner:** Candidate thực hiện request.

**Source:** Một JobMatchProfile và một CVMatchProfile tương ứng.

Kết quả runtime có những nhóm dữ liệu chính:

| Nhóm dữ liệu | Nội dung | Nguồn |
|---|---|---|
| Source identity | Job và Candidate CV được đánh giá | Backend |
| Total Match Score | Điểm tổng thể | Scoring Engine |
| Field Reviews | Điểm và nhận xét của năm tiêu chí | Scoring Engine + AI |
| Overall Summary | Nhận xét tổng thể | AI |
| CV Improvements | Nhận xét và đề xuất cải thiện | AI |

**Field Reviews**

Gắn nhận xét với năm tiêu chí scoring hiện hành.

Điểm số thuộc Scoring Engine; nhận xét thuộc kết quả AI.

**CV Improvements**

Mỗi mục có thể chứa:

- CV section được đề cập.
- Tham chiếu phần tử cụ thể, nếu xác định được.
- Nội dung nhận xét.
- Gợi ý cải thiện, nếu có.
- Nội dung viết lại tham khảo, nếu có.
- Thông tin mức độ ưu tiên, nếu được sử dụng.

Không yêu cầu mỗi section đều xuất hiện trong kết quả.

Một số nội dung nhận xét có thể rỗng, và danh sách cải thiện có thể rỗng.

Nếu không thể liên kết đến phần tử cụ thể, feedback vẫn có thể được giữ ở cấp section.

Cấu trúc JSON, tên field và nullable representation cụ thể thuộc runtime/API contract trong giai đoạn Engineering.

# 7. Embedding / Vector Data

V04 không bổ sung embedding hoặc vector persistence.

Không tạo vector index, collection hoặc embedding artifact mới.

Nhu cầu retrieval/ranking phục vụ V05 được giải quyết trong phạm vi V05.

# 8. State Matrix

V04 không có persisted evaluation state.

Không cần State Matrix riêng.

Những trạng thái hoặc kết quả xử lý runtime không tạo thêm business lifecycle.

# 9. Persistence Transitions

V04 không tạo persistence transition.

Luồng xử lý:

1. Đọc dữ liệu nguồn được phép.
2. Chuẩn bị dữ liệu đánh giá.
3. Tạo kết quả scoring và feedback.
4. Trả kết quả cho Candidate.

Không có bước lưu Evaluation Result hoặc cập nhật Candidate CV.

# 10. Transaction / Atomicity Requirements

V04 không bổ sung database transaction requirement mới.

Use case không thực hiện business mutation.

Không cần transaction chỉ để tạo kết quả đánh giá runtime.

# 11. Constraint Ownership

## 11.1. Database / Schema

Các schema hiện có tiếp tục quản lý dữ liệu Job và Candidate CV.

V04 không thêm database constraint mới.

## 11.2. Service

Backend chịu trách nhiệm:

- Xác định Candidate từ authentication.
- Kiểm tra quyền sử dụng Candidate CV.
- Kiểm tra Job visibility.
- Chuẩn bị nguồn dữ liệu được phép.
- Chuyển kết quả xử lý thành HTTP response hoặc lỗi phù hợp.

## 11.3. AI Processing

AI Kit chịu trách nhiệm:

- Sử dụng Match Profile hợp lệ.
- Thực hiện đánh giá phục vụ scoring.
- Tạo nhận xét và góp ý.
- Cung cấp kết quả có cấu trúc phù hợp để tổng hợp response.

Các yêu cầu kỹ thuật cần thiết để tính score vẫn được giữ.

Nội dung nhận xét rỗng hoặc chưa hữu ích không mặc định khiến toàn bộ kết quả bị reject.

AI Processing không quyết định authorization.

# 12. Freshness và Provenance

V04 không lưu Evaluation Result nên không cần cơ chế freshness/invalidation riêng cho kết quả đã lưu.

Mỗi lần evaluation sử dụng dữ liệu nguồn được chuẩn bị cho request hiện tại.

V04 kế thừa cơ chế xử lý source và normalization của V01/V02.

Các source reference phục vụ feedback được sử dụng trong phạm vi kết quả hiện tại; không tạo hệ thống version hoặc provenance persistence mới.

# 13. Ownership / Multi-tenant Data Boundary

| Dữ liệu | Ownership |
|---|---|
| CandidateCV | Candidate |
| Job | Theo Job/visibility hiện hành |
| CVMatchProfile | Theo Candidate CV source |
| JobMatchProfile | Theo Job source |
| V04 Evaluation Result | Candidate thực hiện request |

V04 không cho phép Candidate sử dụng CV của người khác hoặc đọc Job không khả kiến.

Không bổ sung multi-tenant data boundary mới.

# 14. Snapshot / Historical Data

V04 không tạo snapshot hoặc lưu lịch sử evaluation.

Kết quả chỉ phản ánh cặp Job/CV được sử dụng trong lần đánh giá hiện tại.

Không lưu:

- Bản sao Job.
- Bản sao Candidate CV.
- Bản sao Match Profile cho lịch sử V04.
- Score history.
- Feedback history.

# 15. Retention / TTL

V04 không bổ sung persisted artifact nên không yêu cầu TTL hoặc cleanup policy mới.

Dữ liệu trung gian runtime được xử lý theo cơ chế thực thi hiện có.

# 16. Explicitly Excluded Persistence

V04 chủ động không bổ sung:

- Collection lưu Evaluation Result.
- Collection lưu CV Improvement.
- Match Score history.
- Bản sao Job hoặc Candidate CV.
- Prompt history và LLM response history như business artifact.
- Embedding/vector data.
- Cache hoặc snapshot phục vụ V05.
- Các field provider/model-specific trong database.
- Agent state hoặc CV editing state.

Không tạo persistence chỉ vì dữ liệu có thể hữu ích cho một AI version tương lai.

# 17. Compatibility với version trước

## 17.1. Invariant phải giữ

- Canonical Job/CV không bị thay đổi bởi evaluation.
- Matching/Scoring V03 giữ nguyên ý nghĩa nghiệp vụ.
- AI output không tự trở thành Candidate fact.

## 17.2. Existing schema phải giữ

Không yêu cầu thay đổi persisted schema của các entity hiện có.

## 17.3. AI data contract phải giữ

V04 sử dụng JobMatchProfile và CVMatchProfile theo contract đã có.

## 17.4. Thay đổi được phép

V04 được bổ sung runtime data abstraction để phục vụ nhận xét và cải thiện CV.

## 17.5. Thay đổi không được phép

V04 không được âm thầm thay đổi semantics hoặc persisted schema của các AI version trước.

# 18. Persistence Invariants

Các invariant áp dụng cho V04:

1. V04 không mutate Job hoặc Candidate CV.
2. AI-generated feedback không tự trở thành canonical business data.
3. Kết quả đánh giá phải gắn với đúng Job và Candidate CV của request.
4. Candidate ownership và Job visibility được Backend bảo đảm.
5. Technical failure không tạo persisted negative business result.
6. V04 không tạo persisted lifecycle ngoài Product Specification.

Enforcement owner:

- **Backend Service:** Identity, authorization và source selection.
- **AI Processing:** Structured evaluation và scoring-related validity.
- **Database:** Những constraint hiện có của nguồn canonical.

# 19. Definition of AI Data Completion

Data Contract V04 hoàn thành khi:

- Nguồn Job/CV được xác định.
- JobMatchProfile và CVMatchProfile được tái sử dụng phù hợp.
- Các dữ liệu runtime cần thiết cho evaluation được xác định.
- Evaluation Result có đủ thông tin nghiệp vụ để phục vụ HTTP use case.
- Không phát sinh database entity hoặc persistence ngoài phạm vi.
- Authorization/ownership được giữ.
- Compatibility với V01/V02/V03 được bảo đảm.
- Không có persistence requirement chưa được giải quyết làm cản trở implementation.

Data Completion không đồng nghĩa với việc toàn bộ HTTP use case hoặc AI evaluation đã được triển khai và kiểm chứng.

# 20. Implementation Boundary

Tài liệu này là **Canonical AI Persistence / Data Contract** cho V04.

Nó xác định dữ liệu nào được sử dụng, dữ liệu nào tồn tại runtime và những persistence boundary cần giữ.

Tài liệu không định nghĩa:

- LLM provider hoặc model.
- Prompt.
- Scoring algorithm.
- JSON Schema chi tiết của inference.
- HTTP route và status.
- Controller/service.
- Database query cụ thể.
- Frontend implementation.
- Test framework.

Các quyết định Engineering được thực hiện dựa trên Product Specification và Data Contract này.

**Nguyên tắc:** V04 không cần thay đổi database chỉ để cung cấp scoring, nhận xét và gợi ý cải thiện CV. Ưu tiên tái sử dụng dữ liệu cùng abstraction hiện có, giữ hệ thống đơn giản và đúng phạm vi đồ án JOBHUB.
