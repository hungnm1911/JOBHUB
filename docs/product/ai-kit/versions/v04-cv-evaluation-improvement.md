# AI-V04 — CV Evaluation & Improvement

> **File:** `docs/product/ai-kit/versions/v04-cv-evaluation-improvement.md`
> **Vai trò:** Canonical AI Product Specification  
> **Phase:** JOBHUB AI Phase  
> **Ngôn ngữ:** Tiếng Việt  
> **Mục đích:** Xác định hành vi nghiệp vụ của khả năng đánh giá và gợi ý cải thiện CV theo Job.

---

# 1. Mục tiêu

AI-V04 cho phép Candidate lựa chọn một CV và một Job để nhận kết quả đánh giá mức độ phù hợp.

Kết quả bao gồm:

- Điểm matching tổng thể.
- Nhận xét tổng quan.
- Điểm và nhận xét theo các tiêu chí scoring.
- Những nhận xét và gợi ý cải thiện nội dung CV.

V04 giúp Candidate hiểu CV phù hợp với Job ở mức nào và có thể cải thiện những gì trước khi ứng tuyển.

Đây là một use case HTTP hoàn chỉnh, không yêu cầu chatbot.

# 2. Phạm vi

## 2.1. Trong phạm vi

- Đánh giá một Candidate CV theo một Job được chọn.
- Tái sử dụng chính sách Matching/Scoring V03.
- Trả về điểm tổng thể và kết quả theo năm tiêu chí.
- Tạo nhận xét tổng thể và theo tiêu chí.
- Phân tích, góp ý và đề xuất cải thiện các CV section liên quan.
- Nhận xét cả những section không trực tiếp tham gia scoring.
- Hỗ trợ Generated CV và Uploaded PDF CV thông qua năng lực chuẩn hóa hiện có.
- Cung cấp kết quả qua endpoint HTTP riêng của V04.

## 2.2. Ngoài phạm vi

- Chatbot hoặc hội thoại bổ sung.
- Tự động sửa, lưu đè hoặc tạo phiên bản CV mới.
- Tự động apply Job.
- Quyết định tuyển dụng.
- Job Recommendation/Ranking thuộc V05.
- Thay đổi chính sách scoring V03.
- Lịch sử đánh giá, lưu snapshot hoặc cache kết quả đánh giá như một capability sản phẩm.

# 3. Dependency

## 3.1. Dependency với hệ thống JOBHUB

V04 sử dụng các capability hiện có:

- Candidate authentication và authorization.
- Candidate CV và ownership.
- Job và quy tắc visibility.
- Cơ chế xử lý lỗi HTTP tập trung của Backend.

## 3.2. Dependency với AI version trước

- **V01:** JobMatchProfile và CVMatchProfile.
- **V02:** Xử lý Uploaded PDF thành dữ liệu phục vụ AI.
- **V03:** Chính sách và năng lực Matching/Scoring.

V04 tái sử dụng những năng lực cần thiết của V03 nhưng có use case và HTTP response riêng.

Endpoint V03 tiếp tục độc lập và không phải là endpoint trung gian bắt buộc của V04.

# 4. Thuật ngữ và actor

| Thuật ngữ | Ý nghĩa |
|---|---|
| Candidate | Người yêu cầu đánh giá |
| Match Score | Điểm phù hợp theo chính sách V03 |
| Field Review | Nhận xét gắn với tiêu chí scoring |
| CV Improvement | Nhận xét hoặc đề xuất cải thiện CV |
| CV Section | Nhóm nội dung nghề nghiệp trong CV |
| Evidence | Thông tin hỗ trợ một nhận xét hoặc kết luận |

Actor chính của V04 là Candidate.

# 5. AI Capability & Human Decision Boundary

| Hành động | Hệ thống/AI | Candidate | Recruiter |
|---|---|---|---|
| Chấm điểm phù hợp | Có | | |
| Tạo nhận xét và gợi ý | Có | | |
| Quyết định chỉnh sửa CV | | Có | |
| Quyết định ứng tuyển | | Có | |
| Quyết định tuyển dụng | | | Có |

AI không thay Candidate hoặc Recruiter đưa ra quyết định.

Kết quả đánh giá chỉ có giá trị tham khảo trong quá trình chuẩn bị hồ sơ.

# 6. Input & Trust Boundary

## 6.1. Input được phép

V04 sử dụng:

- Job được chọn.
- Candidate CV được chọn.
- JobMatchProfile.
- CVMatchProfile.
- Các thông tin nghề nghiệp và evidence liên quan trong những profile này.
- Kết quả đánh giá theo chính sách scoring hiện hành.

## 6.2. Trust level

- Job canonical data là nguồn thông tin nghiệp vụ về Job.
- Candidate CV chứa những thông tin Candidate khai báo.
- Uploaded PDF extraction là nội dung được trích xuất và chuẩn hóa.
- LLM assessment và recommendations là kết quả AI, không tự trở thành canonical business truth.
- Match Score được xác định theo Scoring Policy của hệ thống.

## 6.3. Data minimization

Chỉ cung cấp cho AI những dữ liệu cần thiết để đánh giá và cải thiện CV theo Job.

Không mặc định sử dụng toàn bộ tài khoản Candidate, thông tin cá nhân không liên quan hoặc dữ liệu ngoài phạm vi đánh giá.

# 7. AI Output Contract & Semantics

Kết quả thành công của V04 có bốn nhóm thông tin:

**Total Match Score**

Điểm phù hợp tổng thể của CV đối với Job.

**Overall Summary**

Nhận xét tổng thể về mức độ phù hợp, điểm mạnh và hạn chế đáng chú ý.

**Field Reviews**

Điểm và nhận xét theo năm tiêu chí scoring hiện hành của V03.

**CV Improvements**

Các nhận xét và gợi ý cải thiện nội dung CV.

Mỗi CV Improvement nhắm đến một section có trong loại CV đang được đánh giá.
Nếu xác định được một phần tử CV đích duy nhất trong section đó, feedback có
thể gắn với phần tử ấy; nếu không, feedback ở cấp section. Evidence dùng để
hỗ trợ nhận xét có thể nằm ở phần tử hoặc section khác với phần tử đích. Khi
một nhận xét cần cải thiện nhiều phần tử đích, AI có thể giữ ở cấp section
hoặc tách thành các improvements riêng cho từng phần tử.

Feedback có thể là:

- Nhận xét ngắn.
- Gợi ý cải thiện.
- Đề xuất cách viết lại nội dung.

Không bắt buộc mọi feedback đều có nội dung viết lại.

## 7.1. Semantics

Match Score phản ánh mức độ phù hợp theo Matching Policy, không phản ánh xác suất được tuyển dụng.

Field Review giải thích mức độ phù hợp của một tiêu chí, không mặc định yêu cầu Candidate sửa CV.

CV Improvement nhằm cải thiện cách thể hiện nội dung và mức độ hữu ích của CV đối với Recruiter. Một cải thiện không nhất thiết làm tăng Match Score.

Kết quả hợp lệ có thể chứa nhận xét rỗng hoặc không có gợi ý cải thiện. Đây không tự động là technical failure.

# 8. Scoring / Ranking Policy Boundary

V04 giữ nguyên chính sách scoring V03 với năm tiêu chí:

1. Skills.
2. Career Category.
3. Experience Level.
4. Employment Type.
5. Work Mode.

V04 không bổ sung trọng số hoặc tiêu chí scoring mới.

Những phần như Education, Certifications, Projects và Work Experiences vẫn có thể được AI nhận xét, dù không trực tiếp được chấm điểm như một tiêu chí độc lập.

LLM không tự quyết định Total Match Score.

V04 không thực hiện Job Ranking.

# 9. Evidence, Unknown & Reliability Rules

## 9.1. Evidence

Nhận xét nên dựa trên những thông tin có trong dữ liệu Job và CV được cung cấp.

AI không được biến thông tin không có căn cứ thành kinh nghiệm, kỹ năng hoặc thành tích thực tế của Candidate.

## 9.2. Unknown khác mismatch

Thiếu thông tin trong CV không mặc định chứng minh Candidate không có năng lực tương ứng.

Việc đánh giá mismatch tuân theo semantics của Matching Policy V03.

## 9.3. Uncertainty

Khi dữ liệu thiếu, mơ hồ hoặc mâu thuẫn, AI nên thể hiện giới hạn của kết luận.

## 9.4. Hallucination

Gợi ý có thể khuyến khích Candidate bổ sung thông tin nếu họ thực sự có kinh nghiệm liên quan.

AI không được trình bày nội dung giả định như một sự thật đã được xác nhận.

Chất lượng này được kiểm soát chủ yếu qua đầu vào, prompt và evaluation, không yêu cầu thêm semantic rejection gate riêng cho phần nhận xét.

## 9.5. Consistency

Nhận xét nên phù hợp với evidence và kết quả scoring.

Không yêu cầu câu chữ phải cố định giữa các lần chạy.

# 10. Functional Requirements

## F01 — Candidate CV Evaluation & Improvement

### Actor

Candidate.

### Mục tiêu

Đánh giá một CV theo Job và nhận những gợi ý cải thiện phù hợp.

### Input business

- Job được chọn.
- Candidate CV được chọn.

### Tiền điều kiện

Candidate có quyền sử dụng CV và truy cập Job; dữ liệu cần thiết cho evaluation có thể được chuẩn bị.

### Luồng chính

1. Candidate chọn chức năng đánh giá CV từ Job.
2. Candidate chọn CV cần đánh giá.
3. Hệ thống kiểm tra quyền truy cập và chuẩn bị dữ liệu.
4. Hệ thống đánh giá mức độ phù hợp theo chính sách V03.
5. AI tạo nhận xét và gợi ý cải thiện.
6. Hệ thống tổng hợp và trả kết quả cho Candidate.

### Kết quả

Candidate nhận được:

- Total Match Score.
- Overall Summary.
- Năm Field Reviews.
- Các CV Improvements nếu có.

### Failure / Unknown behavior

Điểm thấp, dữ liệu ít hoặc không có gợi ý cải thiện không mặc định là failure.

Nếu request không hợp lệ, dependency không khả dụng hoặc quá trình AI/scoring không hoàn thành hợp lệ, hệ thống trả lỗi.

### Trường hợp từ chối

- Candidate không có quyền truy cập.
- CV hoặc Job không tồn tại hoặc không khả kiến.
- Input không phù hợp với capability.

### Business Rules liên quan

BR-AI-01 đến BR-AI-07.

### Không thuộc chức năng này

Chatbot, tự động sửa CV, tự động apply Job hoặc Job Ranking.

# 11. AI Business Rules

## BR-AI-01 — Authorization

V04 tuân thủ authentication, ownership và Job visibility hiện hành.

## BR-AI-02 — Scoring Policy

V04 tái sử dụng Scoring Policy V03. Nhận xét và gợi ý không tự làm thay đổi điểm số.

## BR-AI-03 — Evidence

AI không biến thông tin suy đoán thành Candidate fact.

## BR-AI-04 — Unknown

Thiếu evidence không mặc định đồng nghĩa với mismatch.

## BR-AI-05 — Business result và failure

Kết quả matching thấp không đồng nghĩa với lỗi xử lý; lỗi xử lý không được biểu diễn thành điểm matching thấp.

## BR-AI-06 — Improvement Scope

AI có thể nhận xét và góp ý các section không trực tiếp tham gia scoring.
Section đích của góp ý phải thuộc nội dung nghề nghiệp áp dụng cho loại CV
được chọn; không tạo feedback nhắm vào section chỉ có ở loại CV khác.

## BR-AI-07 — Candidate Control

AI chỉ đề xuất nội dung. Candidate quyết định việc chỉnh sửa và sử dụng CV.

# 12. Agent / Side-effect Boundary

V04 không cấp quyền mutation cho AI.

AI chỉ phân tích và trả kết quả; không tự sửa CV, thay đổi Job, publish hoặc apply.

Không bổ sung autonomous Agent.

# 13. Resource Lifecycle & State Transitions

V04 không yêu cầu persisted resource hoặc business lifecycle riêng cho kết quả đánh giá.

Candidate yêu cầu evaluation, hệ thống xử lý và trả kết quả.

Không bổ sung trạng thái business chỉ để phản ánh các bước xử lý kỹ thuật.

# 14. Authorization / Ownership / Tenant Boundary

- Candidate chỉ đánh giá CV mà mình được phép sử dụng.
- Job phải khả kiến với Candidate.
- Backend xác định identity và quyền truy cập.
- AI chỉ sử dụng dữ liệu trong phạm vi đã được phép.

V04 không bổ sung tenant boundary mới.

# 15. Failure & Fallback Behavior

**Invalid request:** Request hoặc tài nguyên không hợp lệ được xử lý bằng cơ chế lỗi chung.

**Dependency failure:** Không thể chuẩn bị dữ liệu cần thiết thì evaluation không tiếp tục với kết quả giả.

**AI processing failure:** Provider gặp lỗi, rate limit hoặc không trả được output có cấu trúc hợp lệ.

**Scoring failure:** Kết quả xử lý không đủ hợp lệ để tính Match Score theo chính sách hiện hành.

**Insufficient evidence:** Nếu Matching Policy vẫn cho phép tính điểm, dữ liệu ít hoặc chưa rõ không tự động là failure.

**Limited feedback quality:** Nhận xét rỗng, chung chung hoặc không có gợi ý viết lại không tự động khiến evaluation thất bại.

Không yêu cầu gọi thêm LLM để sửa nội dung nhận xét chưa tốt.

V04 sử dụng cơ chế xử lý lỗi tập trung của Backend.

# 16. AI Quality & Evaluation

Hai nhóm chất lượng chính cần được đánh giá:

**Matching quality**

- Giữ đúng ý nghĩa scoring V03.
- Không làm sai lệch điểm do bổ sung nhận xét và gợi ý.
- Xử lý những trường hợp thiếu hoặc mâu thuẫn thông tin phù hợp với Matching Policy.

**Feedback quality**

- Nhận xét liên quan đến Job và CV.
- Gợi ý có ích và thực tế.
- Có khả năng góp ý những section ngoài scoring.
- Hạn chế suy diễn thành tích hoặc kinh nghiệm không có căn cứ.

## 16.1. Representative cases

Các trường hợp đại diện:

- CV phù hợp cao.
- CV có nhiều điểm chưa phù hợp.
- CV thiếu thông tin.
- CV có thông tin mơ hồ hoặc mâu thuẫn.
- Projects hoặc Work Experiences cần cải thiện diễn đạt.
- Education hoặc Certifications chỉ cần nhận xét ngắn.
- Không có gợi ý cải thiện.
- Một số nhận xét rỗng.
- Request không hợp lệ.
- Provider hoặc output cấu trúc gặp lỗi.
- Các trường hợp đối chiếu scoring với V03.

## 16.2. Acceptance

V04 được chấp nhận khi use case hoạt động theo phạm vi đã định nghĩa, scoring V03 được bảo toàn, feedback đáp ứng mục tiêu sản phẩm ở các trường hợp đại diện và các boundary nghiệp vụ được giữ.

Evaluation có thể được điều chỉnh theo kết quả chạy thực tế mà không cần đưa ra những ngưỡng chất lượng tùy ý ngay trong Product Spec.

# 17. Lifecycle Invariants

1. V04 không tự thay đổi chính sách scoring V03.
2. LLM không quyết định điểm tổng.
3. AI output không tự trở thành canonical business data.
4. Authorization và ownership luôn được giữ.
5. V04 không tự động chỉnh sửa CV hoặc apply Job.
6. Technical failure không được biến thành Match Score thấp.
7. V04 không bổ sung chatbot.

**Ràng buộc AI của dự án:** V04 sử dụng một LLM inference cho việc đánh giá ngữ nghĩa và tạo feedback trong use case này. Uploaded PDF có thể đã sử dụng inference ở capability V02 trước đó. LLM sử dụng provider-native strict structured output theo quy ước AI Kit.

# 18. Các quyết định chủ động defer

- V05 Job Recommendation.
- Chatbot tư vấn CV.
- AI trực tiếp chỉnh sửa CV Draft.
- Tự động apply.
- Lưu và so sánh lịch sử đánh giá.
- Employer-side Candidate Ranking.

# 19. Các quyết định chưa chốt

Không còn business decision lớn cản trở triển khai phạm vi V04 đã thống nhất.

Các lựa chọn về JSON Schema, tham chiếu phần tử CV, prompt, HTTP mapping và tổ chức code thuộc Data Contract hoặc Engineering.

Những chi tiết đó được phép điều chỉnh trong quá trình triển khai, miễn không làm thay đổi hành vi sản phẩm đã xác định.

# 20. Definition of AI Business Completion

V04 hoàn thành về mặt business khi:

- Candidate có thể yêu cầu đánh giá CV theo Job qua HTTP.
- Hệ thống trả được điểm, nhận xét tổng thể và nhận xét theo tiêu chí.
- AI có thể tạo góp ý cải thiện CV, kể cả section ngoài scoring.
- Chính sách V03 được bảo toàn.
- Candidate giữ quyền quyết định việc chỉnh sửa CV.
- Authorization, failure behavior và phạm vi capability được giữ.
- Evaluation xác nhận chất lượng phù hợp với mục tiêu đồ án.

API chạy thành công hoặc output đúng schema chưa tự động chứng minh toàn bộ capability đạt yêu cầu.

# 21. Implementation Boundary

Product Spec xác định hành vi và giới hạn nghiệp vụ của AI-V04.

Các chi tiết sau không thuộc tài liệu này:

- LLM provider/model.
- Prompt cụ thể.
- Request/response JSON Schema.
- REST route và HTTP status cụ thể.
- Scoring implementation.
- Module/controller/service.
- Cơ chế cache, retry hoặc tối ưu hiệu năng.
- Frontend component.
- Test framework.

Data Contract và Engineering quyết định cách hiện thực dựa trên Product Spec.

**Nguyên tắc triển khai:** Xây dựng đúng một use case V04 hoàn chỉnh cho đồ án JOBHUB, tái sử dụng năng lực hiện có và giữ cấu trúc dễ bảo trì ở mức hợp lý. Không bổ sung kiến trúc production-scale hoặc những điều kiện kỹ thuật ngoài nhu cầu đã thống nhất.
