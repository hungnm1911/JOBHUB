
# AI-V03 — Job–CV Matching & Weighted Scoring

> **Đường dẫn:** `docs/product/ai-kit/versions/v03-job-cv-matching-scoring.md`\
> **Vai trò:** Canonical AI Product Specification  
> **Phase:** JOBHUB AI Phase  
> **Trạng thái:** `APPROVED`\
> **Ngôn ngữ:** Tiếng Việt

---

# 1. Mục tiêu

AI-V03 bổ sung khả năng đánh giá mức độ phù hợp giữa một Job và một Candidate CV trong JOBHUB.

Candidate có thể lựa chọn CV thuộc phạm vi được phép sử dụng và yêu cầu hệ thống đánh giá CV đó với một Job mà Candidate được quyền truy cập.

Hệ thống sử dụng `JobMatchProfile` và `CVMatchProfile` đã được chuẩn hóa, kết hợp đánh giá ngữ nghĩa bằng LLM với các quy tắc chấm điểm xác định để tạo Match Score.

Kết quả cho biết:

- Mức độ phù hợp tổng thể của CV với Job.
- Điểm của các nhóm tiêu chí đánh giá.
- Trọng số và mức đóng góp của từng nhóm vào tổng điểm.

Match Score phục vụ việc tham khảo mức độ phù hợp, không phải kết luận về năng lực tuyệt đối hoặc quyết định tuyển dụng.

---

# 2. Phạm vi

## 2.1. Trong phạm vi

AI-V03 bao gồm:

1. Tiếp nhận một cặp `JobMatchProfile` và `CVMatchProfile` hợp lệ.
2. Đánh giá ngữ nghĩa đối với các yêu cầu kỹ năng.
3. Phân biệt kỹ năng Required, Preferred và chưa xác định priority.
4. Chấm điểm Career Category theo taxonomy.
5. Chấm điểm Experience Level theo các mức chuẩn.
6. Đánh giá tương thích Employment Type và Work Mode.
7. Tổng hợp các điểm thành một Match Score duy nhất.
8. Trả kết quả đánh giá cùng breakdown của các tiêu chí.

AI-V03 hỗ trợ các `CVMatchProfile` được tạo từ:

- Generated CV — AI-V01.
- Uploaded PDF CV — AI-V02.

## 2.2. Ngoài phạm vi

AI-V03 là matching capability đánh giá một cặp Job–CV và có thể được tái sử dụng bởi các use case khác.

AI-V03 không thực hiện:

- Tự động sửa hoặc tạo CV.
- CV Improvement (AI-V04), bao gồm gợi ý chi tiết cách chỉnh sửa CV.
- Chatbot tư vấn Candidate.
- Job Recommendation (AI-V05) hoặc ranking nhiều Job.
- Employer-side Candidate Ranking.
- Tự động ứng tuyển.
- Quyết định tuyển dụng hoặc loại Candidate.
- Xác minh độc lập tính trung thực của CV.
- Tạo kỹ năng hoặc kinh nghiệm không có evidence.
- Thay đổi Job/CV hoặc dữ liệu nghiệp vụ gốc.
- Lưu lịch sử Matching hoặc tạo persisted resource mới.
- Tạo embedding, vector retrieval hoặc hệ thống ranking nhiều tầng.

Các capability này có thể được xem xét ở version sau, không thuộc AI-V03.

---

# 3. Dependency

## 3.1. Dependency với JOBHUB

AI-V03 sử dụng các khái niệm và quyền truy cập đã tồn tại:

- Candidate.
- Candidate CV.
- Job.
- Career Category.
- Experience Level.
- Employment Type.
- Work Mode.
- Candidate CV ownership.
- Job visibility.
- Authentication và authorization.

AI-V03 không tạo quy tắc ownership hoặc visibility độc lập.

## 3.2. Dependency với AI-V01/V02

**AI-V01** cung cấp:

- `JobMatchProfile`.
- `CVMatchProfile` của Generated CV.
- Structured metadata.
- Free text.
- Evidence và provenance đã được bảo toàn.

**AI-V02** cung cấp:

- `CVMatchProfile` của Uploaded CV.
- Metadata của Candidate CV.
- Các claim được trích xuất từ PDF.
- Evidence và uncertainty tương ứng.

AI-V03 không thay đổi dữ liệu hoặc semantics của hai version này.

---

# 4. Thuật ngữ và Actor

| Thuật ngữ | Ý nghĩa |
|---|---|
| Candidate | Người yêu cầu đánh giá CV của mình |
| JOBHUB System | Thành phần thực hiện capability và áp dụng business rules |
| Match Score | Điểm thể hiện mức độ phù hợp giữa một Job và một CV |
| Field Score | Điểm của một nhóm tiêu chí, trong khoảng 0–100 |
| Weighted Contribution | Mức đóng góp của một Field Score vào Match Score |
| Required Skill | Kỹ năng được Job xác định là yêu cầu |
| Preferred Skill | Kỹ năng được Job thể hiện là ưu tiên |
| Unspecified Priority | Kỹ năng không xác định được mức độ ưu tiên |
| Evidence | Thông tin nguồn hỗ trợ đánh giá |
| Semantic Assessment | Đánh giá mức độ đáp ứng yêu cầu nghề nghiệp bằng ngữ nghĩa |
| Missing | Không có dữ liệu hoặc evidence cần thiết để xác định mức độ phù hợp |
| Mismatch | Có căn cứ cho thấy thông tin hai phía không đáp ứng quan hệ matching đang xét |

---

# 5. AI Capability & Human Decision Boundary

| Hành động / quyết định | Authority |
|---|---|
| Lựa chọn CV để đánh giá | Candidate |
| Lựa chọn Job trong phạm vi được truy cập | Candidate |
| Xác định quyền sử dụng dữ liệu | JOBHUB |
| Đánh giá tương đương ngữ nghĩa Skills | LLM theo rubric được phê duyệt |
| Quy định thang điểm và trọng số | JOBHUB Product Policy |
| Tính điểm các tiêu chí deterministic | JOBHUB System |
| Tính Match Score cuối cùng | JOBHUB System |
| Quyết định ứng tuyển | Candidate |
| Quyết định tuyển dụng | Employer |

LLM được phép đánh giá ngữ nghĩa nhưng không được tự thay đổi trọng số, công thức hoặc các quy tắc chấm điểm đã được phê duyệt.

Match Result hoàn chỉnh cần cả Semantic Skills Assessment do LLM tạo và phần deterministic scoring do JOBHUB System thực hiện. Phần deterministic không tự thay thế đánh giá ngữ nghĩa của LLM.

Match Score không tạo ra quyết định tuyển dụng tự động.

---

# 6. Input & Trust Boundary

## 6.1. Input được phép

AI-V03 sử dụng:

- Một `JobMatchProfile` hợp lệ.
- Một `CVMatchProfile` hợp lệ.
- Structured metadata thuộc hai profile.
- Job Description và các nội dung nghề nghiệp được bảo toàn.
- Skills, Experience, Projects và nội dung nghề nghiệp từ CV.
- Evidence và provenance nằm trong phạm vi hai profile.

Không mặc định sử dụng dữ liệu khác ngoài các input đã được cho phép.

## 6.2. Trust Level

| Nguồn | Vai trò |
|---|---|
| Structured Job metadata | Dữ liệu khai báo của Job |
| Job Description | Nguồn ngữ nghĩa bổ sung của Job |
| Structured CV metadata | Dữ liệu Candidate khai báo |
| Generated CV content | Nội dung và claim của Candidate |
| Uploaded CV extracted content | Claim được trích xuất từ PDF |
| LLM assessment | Nhận định ngữ nghĩa phục vụ Matching |
| Deterministic scoring result | Kết quả tính điểm theo Product Policy |

Thông tin khai báo trong CV không mặc nhiên là sự thật đã được kiểm chứng độc lập.

LLM assessment không tự trở thành canonical Job/CV data.

## 6.3. Data Minimization

AI-V03 chỉ sử dụng dữ liệu cần thiết từ hai profile.

Không mặc định đưa toàn bộ Candidate account, Company data hoặc các CV khác vào context.

---

# 7. AI Output Contract & Semantics

Kết quả nghiệp vụ AI-V03 bao gồm:

1. Một Match Score tổng thể trong khoảng 0–100.
2. Field Score cho năm nhóm tiêu chí.
3. Trọng số tương ứng.
4. Mức đóng góp của từng Field Score vào tổng điểm.

Năm nhóm tiêu chí:

- Skills.
- Career Category.
- Experience Level.
- Employment Type.
- Work Mode.

AI-V03 không bắt buộc trả về gợi ý chỉnh sửa CV hoặc báo cáo tư vấn chi tiết.

Data Contract xác định logical semantics và minimum output của dữ liệu AI-V03; JSON Schema cụ thể cho structured output của LLM thuộc Engineering Contract.

## 7.1. Semantics

Match Score biểu diễn mức độ phù hợp của một cặp Job–CV theo Matching Policy AI-V03.

Match Score không biểu diễn:

- Xác suất được tuyển dụng.
- Xác suất vượt qua phỏng vấn.
- Năng lực tuyệt đối của Candidate.
- Chất lượng tuyệt đối của Job.
- Quyết định chấp nhận hoặc từ chối Candidate.

Điểm 0 của một tiêu chí có thể xuất phát từ thiếu evidence, không tương thích hoặc thiếu metadata.

Điểm 0 không mặc nhiên chứng minh Candidate không sở hữu năng lực tương ứng.

---

# 8. Scoring Policy

## 8.1. Nguyên tắc tổng quát

AI-V03 sử dụng một Match Score duy nhất dựa trên năm Field Score.

Mỗi Field Score nằm trong khoảng 0–100.

| Field | Trọng số |
|---|---:|
| Skills | 40% |
| Career Category | 25% |
| Experience Level | 25% |
| Employment Type | 5% |
| Work Mode | 5% |
| **Tổng** | **100%** |

Match Score bằng tổng điểm đóng góp có trọng số của năm field.

Các trọng số được giữ cố định trong AI-V03.

Một field nhận 0 điểm không tự động khiến Match Score tổng bằng 0.

Không có hard gate dựa trên một Field Score riêng lẻ.

## 8.2. Skills Matching

### 8.2.1. Semantic Assessment

LLM đánh giá mức độ đáp ứng từng yêu cầu kỹ năng của Job dựa trên evidence trong CV.

Đánh giá sử dụng thang điểm cố định:

| Điểm | Mức độ phù hợp |
|---|---|
| 100 | Đáp ứng đầy đủ hoặc tương đương thực chất |
| 90 | Gần như tương đương hoàn toàn |
| 80 | Phù hợp rất cao |
| 70 | Phù hợp cao nhưng còn thiếu một phần |
| 60 | Tương đồng đáng kể, còn khoảng cách cần bổ sung |
| 50 | Đáp ứng một phần đáng kể |
| 40 | Có nền tảng liên quan nhưng còn thiếu nhiều phần quan trọng |
| 30 | Có kỹ năng chuyển giao được một phần |
| 20 | Liên quan yếu |
| 10 | Liên quan rất hạn chế |
| 0 | Không có evidence phù hợp hoặc không đáp ứng yêu cầu theo evidence |

LLM chỉ được chọn một trong các mức điểm trên cho từng kỹ năng.

Việc đánh giá dựa trên ngữ nghĩa và evidence, không yêu cầu tên kỹ năng phải giống nhau tuyệt đối.

### 8.2.2. Skill Priority

Các kỹ năng được phân thành:

| Priority | Nguồn xác định | Nhóm tính điểm |
|---|---|---|
| Required | `requiredSkills` hoặc JD thể hiện rõ yêu cầu bắt buộc | Required |
| Preferred | JD thể hiện rõ tính ưu tiên | Nhóm thấp |
| Unspecified | JD có kỹ năng nhưng không xác định rõ priority | Nhóm thấp |

Nếu cùng một requirement được xác định là Required và Preferred, Required được ưu tiên.

Một requirement không được tính trùng chỉ vì xuất hiện ở nhiều vị trí trong nguồn.

### 8.2.3. Trọng số Skills

Khi cả hai nhóm có dữ liệu:

- Required: 80%.
- Nhóm Preferred/Unspecified: 20%.

Điểm của mỗi nhóm được tổng hợp từ điểm các kỹ năng thuộc nhóm đó.

Khi một nhóm rỗng:

| Required | Nhóm thấp | Quy tắc |
|---|---|---|
| Có | Có | Required 80%, nhóm thấp 20% |
| Có | Không | Required chiếm 100% |
| Không | Có | Nhóm thấp chiếm 100% |
| Không | Không | Skills Score = 0 |

Số lượng kỹ năng Preferred/Unspecified không được làm tăng tỷ trọng của nhóm đó vượt mức đã quy định khi cả hai nhóm cùng tồn tại.

Một kỹ năng được tính điểm một lần, không cộng điểm vì có nhiều evidence lặp lại.

## 8.3. Career Category Matching

Career Category được đánh giá theo quan hệ taxonomy FIELD → POSITION.

| Quan hệ Job–CV | Category Score |
|---|---:|
| CV POSITION trùng POSITION của Job | 100 |
| CV khai báo FIELD trùng FIELD của Job | 70 |
| CV POSITION khác Job nhưng cùng FIELD | 50 |
| FIELD không liên quan | 0 |

Khi Job có nhiều Category, sử dụng quan hệ có điểm phù hợp cao nhất.

Không cộng dồn điểm theo số lượng Category.

Career Category Score dựa trên taxonomy, không sử dụng LLM để tự suy diễn quan hệ nghề nghiệp ngoài taxonomy đã có.

## 8.4. Experience Level Matching

Experience được đánh giá theo thứ tự sáu Experience Level chuẩn của JOBHUB:

1. `NO_EXPERIENCE`
2. `UNDER_1_YEAR`
3. `ONE_TO_THREE_YEARS`
4. `THREE_TO_FIVE_YEARS`
5. `FIVE_TO_TEN_YEARS`
6. `OVER_TEN_YEARS`

Khoảng cách được tính theo số bậc giữa hai level, không suy diễn số năm chính xác.

| Quan hệ CV so với Job | Experience Score |
|---|---:|
| Thấp hơn Job | 0 |
| Bằng Job | 100 |
| Cao hơn 1 bậc | 75 |
| Cao hơn 2 bậc | 40 |
| Cao hơn 3 bậc | 15 |
| Cao hơn từ 4 bậc | 0 |
| CV không khai báo Experience Level | 0 |

Experience Level được đánh giá từ metadata chuẩn hóa.

AI-V03 không sử dụng LLM để tự thay thế Experience Level đã khai báo bằng số năm suy đoán từ nội dung CV.

## 8.5. Employment Type Matching

Employment Type sử dụng quan hệ tương thích theo lựa chọn.

- Job Employment Type thuộc danh sách Candidate chấp nhận → 100.
- Không có lựa chọn trùng → 0.
- Candidate chưa khai báo Employment Type → 0.
- Job không cung cấp Employment Type → 0.

Không sử dụng điểm tương đồng một phần.

## 8.6. Work Mode Matching

Work Mode sử dụng quan hệ OR.

- Hai phía có ít nhất một Work Mode trùng → 100.
- Không có Work Mode trùng → 0.
- Candidate chưa khai báo Work Mode → 0.
- Job không cung cấp Work Mode → 0.

Candidate không bắt buộc phải chấp nhận tất cả Work Mode mà Job cung cấp.

Các Work Mode khác mã canonical không mặc nhiên được coi là tương đương.

## 8.7. Missing Data

AI-V03 không đặt completeness threshold đối với các profile đã `READY`.

Khi một field không có đủ dữ liệu để xác định mức độ phù hợp, field đó nhận 0 điểm theo chính sách AI-V03.

Không tự thưởng 100 điểm cho field thiếu dữ liệu.

Không tự điều chỉnh trọng số tổng để loại field thiếu dữ liệu khỏi phép tính.

Missing evidence không đồng nghĩa với Candidate không có năng lực hoặc không phù hợp trong thực tế.

---

# 9. Evidence, Unknown & Reliability Rules

## 9.1. Evidence

Đánh giá Skills phải dựa trên thông tin được hỗ trợ bởi nguồn Job và CV.

LLM có thể sử dụng các claim nghề nghiệp nằm trong CVMatchProfile, bao gồm nội dung skills, experience và projects khi phù hợp.

Một claim không được mở rộng thành năng lực, thời lượng hoặc chứng chỉ không có evidence.

## 9.2. Unknown khác Mismatch

Hệ thống phải giữ khác biệt về ngữ nghĩa giữa:

- Không tìm thấy evidence.
- Có evidence nhưng không đáp ứng yêu cầu.
- Có evidence mâu thuẫn không thể giải quyết.

Các trường hợp này có thể cùng nhận 0 điểm nhưng không được trình bày như cùng một kết luận về Candidate.

## 9.3. Conflict

Khi các evidence liên quan đến cùng một kỹ năng mâu thuẫn:

- LLM phải xem xét thông tin liên quan.
- Không mặc định lựa chọn evidence có lợi nhất.
- Nếu mâu thuẫn không thể giải quyết, kỹ năng tương ứng nhận 0 điểm.
- Không làm thất bại toàn bộ Matching.
- Không tự sửa hoặc loại bỏ dữ liệu gốc.

## 9.4. Hallucination

LLM không được tự tạo:

- Kỹ năng Candidate chưa chứng minh.
- Số năm kinh nghiệm không có căn cứ.
- Job requirement không xuất hiện trong nguồn.
- Priority không được nguồn hoặc quy tắc đã phê duyệt hỗ trợ.
- Candidate fact hoặc Job fact mới.

## 9.5. Consistency

Kết quả ngữ nghĩa phải tuân thủ rubric đã phê duyệt.

Kết quả tính điểm cuối cùng phải tuân thủ các trọng số và quy tắc xác định.

LLM không được tự sửa Match Score tổng hoặc các điểm deterministic.

---

# 10. Functional Requirements

## F01 — Tiếp nhận Job–CV Matching Input

### Actor

Candidate và JOBHUB System.

### Mục tiêu

Tiếp nhận một Job và một CV được phép sử dụng để thực hiện Matching.

### Input business

- Một Job trong phạm vi Candidate được quyền truy cập.
- Một Candidate CV thuộc phạm vi Candidate được phép sử dụng.
- `JobMatchProfile` và `CVMatchProfile` tương ứng.

### Tiền điều kiện

- Resource tồn tại.
- Quyền sử dụng Job/CV hợp lệ.
- Các profile đầu vào đã được chuẩn hóa hợp lệ.

Không yêu cầu profile phải có đầy đủ mọi field nghề nghiệp.

### Luồng chính

1. Candidate yêu cầu Matching.
2. JOBHUB xác định Job và CV thuộc phạm vi được phép.
3. Hệ thống nhận các profile chuẩn hóa tương ứng.
4. Chuyển dữ liệu hợp lệ sang capability đánh giá.

### Kết quả

Có một cặp profile hợp lệ để thực hiện Matching.

### Failure / Unknown behavior

Profile thiếu dữ liệu nghề nghiệp vẫn được tiếp nhận nếu đã `READY`.

Resource không hợp lệ hoặc không được phép sử dụng tuân theo quy tắc từ chối của JOBHUB.

### Business Rules liên quan

`BR-AI-23`, `BR-AI-24`.

### Không thuộc chức năng này

Thay đổi Job/CV, cấp quyền mới hoặc tự tạo dữ liệu nghề nghiệp.

---

## F02 — Semantic Skills Assessment

### Actor

JOBHUB System.

### Mục tiêu

Đánh giá mức độ đáp ứng các kỹ năng Job yêu cầu bằng ngữ nghĩa.

### Input business

- Job requirements và Job Description từ `JobMatchProfile`.
- Skills và evidence từ `CVMatchProfile`.
- Scoring rubric đã phê duyệt.

### Luồng chính

1. Hệ thống cung cấp các thông tin cần thiết cho LLM.
2. LLM nhận diện các yêu cầu kỹ năng và priority trong phạm vi nguồn cho phép.
3. LLM đối chiếu yêu cầu với evidence của Candidate.
4. LLM trả kết quả đánh giá theo thang điểm cố định.
5. Hệ thống tiếp nhận kết quả có cấu trúc phục vụ tổng hợp điểm.

Toàn bộ Semantic Assessment của một lần Matching sử dụng một LLM inference.

### Kết quả

Có kết quả đánh giá ngữ nghĩa của các yêu cầu Skills.

### Failure / Unknown behavior

- Không có evidence phù hợp → kỹ năng nhận 0.
- Evidence mâu thuẫn không giải quyết được → kỹ năng nhận 0.
- Không có kỹ năng để đánh giá → Skills Score bằng 0.
- LLM không hoàn thành được kết quả hợp lệ → lỗi xử lý AI, không chuyển thành Match Score 0.

### Business Rules liên quan

`BR-AI-25` đến `BR-AI-28`, `BR-AI-33`.

### Không thuộc chức năng này

Tự quyết định trọng số, chấm Category/Experience hoặc quyết định Match Score tổng.

---

## F03 — Deterministic Field Assessment

### Actor

JOBHUB System.

### Mục tiêu

Đánh giá các field có quy tắc xác định.

### Input business

Metadata từ `JobMatchProfile` và `CVMatchProfile`.

### Luồng chính

Hệ thống xác định điểm của:

1. Career Category.
2. Experience Level.
3. Employment Type.
4. Work Mode.

Mỗi field sử dụng bảng điểm tương ứng đã được phê duyệt.

### Kết quả

Có Field Score cho bốn tiêu chí trên.

### Failure / Unknown behavior

Thiếu dữ liệu hợp lệ để đánh giá một field không làm thất bại toàn bộ Matching; field tương ứng nhận 0 điểm.

### Business Rules liên quan

`BR-AI-29`, `BR-AI-30`, `BR-AI-31`.

### Không thuộc chức năng này

LLM tự thay đổi taxonomy hoặc suy đoán metadata mới.

---

## F04 — Tổng hợp Match Score

### Actor

JOBHUB System.

### Mục tiêu

Tạo một Match Score tổng thể từ các Field Score.

### Luồng chính

1. Tiếp nhận Semantic Skills Assessment.
2. Tính Skills Score theo priority weighting.
3. Tiếp nhận các deterministic Field Score.
4. Áp dụng bộ trọng số tổng.
5. Tạo Match Score.
6. Trả Match Score và breakdown.

### Kết quả

Có một kết quả Matching trong khoảng 0–100.

### Failure / Unknown behavior

Một field nhận 0 không làm thất bại toàn bộ phép tính.

Technical failure không được chuyển thành kết luận Matching Score bằng 0.

### Business Rules liên quan

`BR-AI-28`, `BR-AI-32`, `BR-AI-34`.

### Không thuộc chức năng này

Ranking nhiều CV, gợi ý chỉnh sửa hoặc quyết định tuyển dụng.

---

# 11. AI Business Rules

## BR-AI-23 — Input và quyền sử dụng

AI-V03 chỉ sử dụng Job/CV thuộc phạm vi được JOBHUB cho phép.

Không tạo visibility hoặc ownership policy mới.

## BR-AI-24 — Không đặt completeness gate mới

Profile `READY` được phép tham gia Matching dù thiếu thông tin nghề nghiệp.

Thiếu field không tự khiến toàn bộ Matching thất bại.

## BR-AI-25 — Một Semantic Inference

Mỗi lần thực hiện AI-V03 Matching sử dụng một lượt suy luận LLM cho Semantic Assessment.

Không gọi LLM riêng cho từng kỹ năng hoặc từng field.

Kết quả LLM phải tuân theo structured-output contract do hệ thống xác định, sử dụng khả năng ràng buộc output của provider.

## BR-AI-26 — Skill Priority

Structured `requiredSkills` thuộc nhóm Required.

Priority từ JD được xác định theo ngữ nghĩa nguồn và rubric đã phê duyệt.

Priority không xác định thuộc nhóm trọng số thấp nhưng phải giữ đúng ngữ nghĩa chưa xác định.

Required được ưu tiên khi cùng requirement có priority mâu thuẫn.

Không tính trùng cùng một requirement.

## BR-AI-27 — Skill Scoring Rubric

Mỗi yêu cầu Skills được đánh giá theo một trong 11 mốc từ 0 đến 100, bước 10.

Đánh giá phải dựa trên evidence và quan hệ ngữ nghĩa.

Không cộng điểm theo số lần một kỹ năng được nhắc lại.

## BR-AI-28 — Skills Group Weighting

Điểm của mỗi nhóm là trung bình cộng các requirement scores trong nhóm. Mỗi requirement đã hợp nhất ngữ nghĩa chỉ được tính một lần; các requirement trong cùng nhóm có trọng số ngang nhau.

Required chiếm 80%, nhóm thấp chiếm 20% khi cả hai nhóm có dữ liệu.

Khi chỉ một nhóm có dữ liệu, nhóm đó chiếm toàn bộ Skills Score.

Khi không có nhóm nào có dữ liệu, Skills Score bằng 0.

## BR-AI-29 — Career Category Scoring

Career Category sử dụng các mức 100/70/50/0 theo quan hệ FIELD/POSITION đã định nghĩa.

Khi Job có nhiều Category, chọn quan hệ phù hợp cao nhất.

Không cộng dồn điểm Category.

## BR-AI-30 — Experience Level Scoring

Experience được đánh giá theo thứ tự level chuẩn.

CV thấp hơn Job nhận 0; bằng Job nhận 100; cao hơn nhận điểm giảm dần theo bảng đã phê duyệt.

Không suy đoán số năm chính xác hoặc thay thế level khai báo bằng diễn giải LLM.

## BR-AI-31 — Employment và Work Mode Compatibility

Employment Type đạt 100 khi Job type nằm trong tập Candidate chấp nhận.

Work Mode đạt 100 khi hai bên có ít nhất một lựa chọn trùng.

Không có lựa chọn tương thích hoặc thiếu thông tin cần thiết thì field tương ứng nhận 0.

## BR-AI-32 — Weighted Match Score

AI-V03 sử dụng trọng số:

- Skills: 40%.
- Career Category: 25%.
- Experience Level: 25%.
- Employment Type: 5%.
- Work Mode: 5%.

Mọi field đều tham gia tổng điểm.

Không tự renormalize trọng số tổng khi thiếu dữ liệu.

Không có quy tắc loại trực tiếp dựa trên một Field Score bằng 0.

## BR-AI-33 — Missing, Evidence và Conflict

Không có evidence không đồng nghĩa với không có năng lực.

LLM không được tạo evidence hoặc chọn một claim mâu thuẫn làm sự thật chắc chắn khi không có căn cứ.

Mâu thuẫn không thể giải quyết của một kỹ năng làm kỹ năng đó nhận 0 điểm, không khiến toàn bộ Matching thất bại.

## BR-AI-34 — Output và Technical Failure

Match Score tổng được xác định bởi chính sách tính điểm của hệ thống, không do LLM tự quyết định.

Thiếu dữ liệu nghề nghiệp là tình huống đánh giá, không phải technical failure.

Provider hoặc quá trình xử lý AI không tạo được kết quả hợp lệ thì không được trả Match Score 0 như một kết luận nghiệp vụ.

---

# 12. Agent / Side-effect Boundary

AI-V03 không cấp quyền mutation cho AI.

AI-V03 không được:

- Tạo hoặc sửa CV.
- Sửa Job.
- Thay đổi Candidate preferences.
- Tự ứng tuyển.
- Tự publish CV.
- Tạo Candidate fact mới.
- Thay đổi quyền truy cập dữ liệu.

Capability chỉ thực hiện đánh giá Matching.

---

# 13. Resource Lifecycle & State Transitions

AI-V03 không tạo persisted business resource hoặc lifecycle mới.

AI-V03 sử dụng các profile runtime từ AI-V01/V02 để thực hiện đánh giá và trả kết quả.

Không tạo trạng thái Job/CV mới do hoạt động Matching.

Không thay đổi lifecycle hiện có của Job hoặc Candidate CV.

---

# 14. Authorization / Ownership / Tenant Boundary

Candidate chỉ được sử dụng CV thuộc phạm vi đã được JOBHUB cho phép.

Job được sử dụng làm context phải thuộc phạm vi Candidate được quyền truy cập theo cơ chế Backend hiện có.

AI-V03 không tự bổ sung điều kiện Job bắt buộc phải `PUBLISHED` nếu điều kiện đó không thuộc authorization/visibility policy hiện hành.

Không được dùng AI capability để truy cập CV của Candidate khác hoặc Job nằm ngoài phạm vi được phép.

AI-V03 không bổ sung tenant boundary mới.

---

# 15. Failure & Fallback Behavior

## Invalid input

Resource không tồn tại, không hợp lệ hoặc không được phép sử dụng được xử lý theo quy tắc JOBHUB hiện có.

AI-V03 không có trách nhiệm sửa input hoặc vượt qua các điều kiện từ chối của version trước.

## AI processing failure

Nếu Semantic Assessment không tạo được kết quả hợp lệ, hệ thống không được tự thay bằng một Match Score giả định.

## Dependency failure

Dependency cần thiết không khả dụng được phân biệt với kết quả Matching thấp.

## Insufficient evidence

Nếu các profile đã hợp lệ nhưng thiếu thông tin nghề nghiệp:

- Không FAILED toàn bộ Matching chỉ vì thiếu nội dung.
- Tiêu chí thiếu căn cứ nhận điểm theo missing-data policy.
- Không suy diễn thêm năng lực hoặc Job requirement để làm đầy dữ liệu.

AI-V03 không thiết lập thêm completeness gate hoặc cơ chế fallback phức tạp cho dữ liệu sparse.

---

# 16. AI Quality & Evaluation

AI-V03 phải được đánh giá cả về tính đúng đắn của công thức và chất lượng Semantic Skills Assessment.

Các nội dung đánh giá chính:

1. Tính đúng đắn của trọng số tổng.
2. Tính đúng đắn của các bảng điểm deterministic.
3. Khả năng phân biệt Required/Preferred/Unspecified.
4. Mức độ hợp lý của Skill Semantic Assessment.
5. Evidence alignment.
6. Xử lý missing và conflict.
7. Khả năng hoàn thành Matching trong một Semantic Inference.
8. Phân biệt technical failure với Match Score thấp.

Không yêu cầu runtime đạt mức chính xác ngữ nghĩa tuyệt đối.

Strict structured output là điều kiện về hình dạng kết quả, không phải bằng chứng đầy đủ về chất lượng ngữ nghĩa.

## 16.1. Representative Cases

| Nhóm trường hợp | Kỳ vọng |
|---|---|
| Job/CV phù hợp hoàn toàn | Các field tương ứng đạt điểm tối đa |
| CV thiếu một Required Skill | Skill đó nhận 0; tổng vẫn được tính |
| Chỉ có Preferred Skills | Nhóm thấp chiếm toàn bộ Skills Score |
| Không có skill requirement | Skills Score = 0 |
| Skill xuất hiện trùng trong JD/metadata | Không cộng điểm trùng |
| CV có kỹ năng tương đương về ngữ nghĩa | LLM chấm theo rubric |
| CV không có evidence | Không tự tạo evidence |
| Category cùng FIELD khác POSITION | Category Score = 50 |
| Experience thấp hơn Job | Experience Score = 0 |
| Experience cao hơn nhiều bậc | Điểm giảm theo bảng |
| Work Mode có một lựa chọn trùng | Work Mode Score = 100 |
| Profile READY nhưng sparse | Tiếp tục Matching |
| Một skill có conflict chưa giải quyết | Skill nhận 0; không FAILED toàn bộ |
| Provider không tạo được assessment hợp lệ | Technical failure, không trả Match Score giả |

## 16.2. Acceptance

AI-V03 đạt yêu cầu business khi:

- Các bảng điểm và trọng số đã phê duyệt được áp dụng đúng.
- Kết quả Skills tuân thủ rubric và có cơ sở từ nguồn.
- Các trường hợp missing/conflict được xử lý đúng.
- Không xuất hiện hard gate ngoài phạm vi đã thống nhất.
- Technical failure không biến thành kết luận Candidate kém phù hợp.
- Không có mutation hoặc truy cập vượt quyền.
- Evaluation đại diện xác nhận chất lượng phù hợp với phạm vi demo của JOBHUB.

Không áp đặt threshold độ chính xác hoặc cơ chế đánh giá production-scale mới trong Product Specification này.

---

# 17. Lifecycle Invariants

1. AI-V03 không thay đổi dữ liệu Job/CV gốc.
2. AI-V03 không mở rộng authorization.
3. AI-V03 không tạo Candidate fact không có evidence.
4. LLM không quyết định Match Score tổng.
5. Các trọng số luôn tuân thủ Product Policy.
6. Field thiếu dữ liệu không tạo completeness failure mới.
7. Một field nhận 0 không tự loại Candidate khỏi Matching.
8. Technical failure không bị diễn giải thành Match Score 0.
9. Một requirement không được nhận thêm điểm chỉ vì xuất hiện nhiều lần.
10. Kết quả Matching không phải quyết định tuyển dụng.

---

# 18. Các quyết định chủ động defer

Các nội dung sau không thuộc AI-V03:

- CV Improvement (AI-V04), bao gồm gợi ý chỉnh sửa CV dựa trên Match Score.
- Chatbot tư vấn cải thiện CV.
- Tự tạo hoặc chỉnh sửa CV Draft.
- Job Recommendation (AI-V05) và retrieval/ranking nhiều Job.
- Employer-side Candidate Ranking.
- Lưu lịch sử hoặc versioning Match Score.
- Cá nhân hóa trọng số theo Candidate hoặc Employer.
- Cơ chế điều chỉnh trọng số tự động từ dữ liệu tuyển dụng.
- Các mô hình đánh giá chuyên sâu khác ngoài năm field đã chốt.
- Hệ thống xác minh độc lập năng lực thực tế của Candidate.

Việc mở rộng trong tương lai không được mặc nhiên thay đổi semantics của AI-V03.

---

# 19. Các quyết định chưa chốt

Không còn Product Decision cốt lõi nào chưa chốt về:

- Năm nhóm tiêu chí Matching.
- Thang điểm Skills.
- Phân nhóm Skills.
- Career Category Scoring.
- Experience Level Scoring.
- Employment/Work Mode Compatibility.
- Missing/conflict policy.
- Bộ trọng số tổng.
- Ranh giới LLM và deterministic scoring.

Các nội dung nằm ngoài Product Specification:

- Data Contract và structured-output schema cụ thể.
- Thiết kế engineering cho Matching/Scoring.
- Prompt và rubric diễn đạt cho model.
- Test fixtures và Evaluation Contract chi tiết.
- Cách trình bày kết quả trên giao diện.

Những nội dung này không được tự tạo business behavior mới ngoài Product Specification đã được phê duyệt.

---

# 20. Definition of AI Business Completion

AI-V03 hoàn thành về mặt business khi:

1. Candidate có thể yêu cầu Matching trên một cặp Job/CV hợp lệ và được phép sử dụng.
2. AI-V03 đánh giá Skills trong một Semantic Inference.
3. Hệ thống tính đúng các Field Score deterministic.
4. Skills Score tuân thủ Required/nhóm thấp weighting.
5. Match Score tuân thủ trọng số tổng đã phê duyệt.
6. Profile sparse không bị từ chối chỉ vì thiếu thông tin nghề nghiệp.
7. Missing và conflict không bị diễn giải sai thành kết luận năng lực.
8. Technical failure được phân biệt với Match Score thấp.
9. Authorization và ownership hiện có được giữ nguyên.
10. Không có behavior ngoài scope.
11. Evaluation đại diện đạt yêu cầu acceptance của version.

Một response đúng schema hoặc một lần demo thành công không tự động chứng minh AI-V03 đã đạt chất lượng nghiệp vụ.

---

# 21. Implementation Boundary

Đây là Product Specification của AI-V03.

Tài liệu xác định:

- Capability AI-V03 phải cung cấp.
- Ngữ nghĩa của Matching Score.
- Các tiêu chí và trọng số nghiệp vụ.
- Quy tắc Required/Preferred/Unspecified.
- Missing/conflict behavior.
- Human decision boundary.
- Authorization và side-effect boundary.
- Acceptance ở mức nghiệp vụ.

Tài liệu không xác định:

- LLM provider hoặc model.
- Prompt cụ thể.
- JSON Schema.
- REST endpoint.
- Controller/service.
- Persistence model.
- Cách triển khai thuật toán hoặc cấu trúc mã nguồn.
- UI component.
- Test framework.
- Deployment hoặc infrastructure.

Các quyết định kỹ thuật được triển khai trong Data Contract và Engineering Contracts tương ứng, theo Product Specification đã được phê duyệt.

**AI-V03 không được tự mở rộng scope chỉ để cải thiện chất lượng Matching hoặc chuẩn bị cho các use case tương lai.**
