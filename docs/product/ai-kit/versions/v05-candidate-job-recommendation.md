# AI-V05 — Candidate Job Recommendation

> **Document:** `docs/product/ai-kit/versions/v05-candidate-job-recommendation.md`  
> **Vai trò:** Canonical AI Product Specification  
> **Trạng thái:** APPROVED — Product Decisions đã được phê duyệt  
> **Phase:** JOBHUB AI Phase  
> **Ngôn ngữ:** Tiếng Việt  
> **Mục đích:** Xác định business behavior, capability boundary, recommendation semantics và quality requirements của AI-V05.

# 1. Mục tiêu

AI-V05 bổ sung khả năng gợi ý công việc phù hợp với Candidate dựa trên Default CV của Candidate đó.

Candidate có thể yêu cầu JOBHUB tìm kiếm và đánh giá các Job phù hợp với năng lực nghề nghiệp được thể hiện trong CV.

Hệ thống trả về:

- Danh sách tối đa 10 Job được gợi ý.
- Match Score của từng Job theo chính sách Matching/Scoring AI-V03.
- Lý do giải thích mức độ phù hợp của CV với từng Job.
- Danh sách được sắp xếp theo Match Score giảm dần.

Capability hướng đến việc giúp Candidate khám phá những công việc có liên quan đến kỹ năng, kinh nghiệm và chuyên môn hiện có.

Recommendation mang tính tham khảo, không bảo đảm Candidate đáp ứng đầy đủ mọi yêu cầu tuyển dụng hoặc có khả năng được tuyển dụng.

# 2. Phạm vi

## 2.1. Trong phạm vi

AI-V05 bao gồm:

1. Cho phép Candidate đã xác thực yêu cầu Job Recommendation.
2. Tự động lựa chọn Default CV hợp lệ của Candidate.
3. Hỗ trợ Generated CV và Uploaded PDF CV thông qua các capability chuẩn hóa hiện có.
4. Sử dụng thông tin nghề nghiệp từ CV và Job để tìm những Job có mức độ tương đồng ngữ nghĩa cao.
5. Chỉ xem xét những Job đáp ứng điều kiện công khai của JOBHUB.
6. Lựa chọn một tập Job ứng viên để đánh giá matching.
7. Đánh giá semantic skills của nhiều Job với cùng một CV trong một batch.
8. Tái sử dụng chính sách Matching/Scoring của AI-V03.
9. Tạo lý do phù hợp cho từng Job được đánh giá.
10. Sắp xếp Job theo Match Score chính thức.
11. Trả về tối đa 10 Job cùng Match Score và lý do phù hợp.
12. Cung cấp capability qua Backend HTTP API.

AI-V05 được thực hiện theo yêu cầu của Candidate, không phải một hành động tự động thay mặt Candidate.

## 2.2. Ngoài phạm vi

AI-V05 không thực hiện:

- Tự động ứng tuyển Job.
- Tạo, chỉnh sửa hoặc publish Candidate CV.
- Thay đổi Default CV của Candidate.
- Tự động lựa chọn CV thay thế khi không có Default CV hợp lệ.
- Tư vấn chỉnh sửa CV thuộc AI-V04.
- Thay đổi chính sách Matching/Scoring AI-V03.
- Employer-side Candidate Recommendation hoặc Candidate Ranking.
- Quyết định tuyển dụng thay Employer.
- Sử dụng Location hoặc Salary làm yếu tố lọc/xếp hạng recommendation trong version này.
- Áp dụng ngưỡng Match Score tối thiểu để quyết định Job được gợi ý.
- Tạo lịch sử recommendation như một capability sản phẩm.
- Xây dựng cơ chế cache CV normalization/embedding riêng cho AI-V05.
- Xây dựng một capability hội thoại hoặc chatbot recommendation.
- Tạo thêm Candidate preference hoặc Career Goal từ dữ liệu không được khai báo.

AI-V05 không mở rộng quyền truy cập Job hoặc Candidate CV ngoài những quyền hiện có của JOBHUB.

# 3. Dependency

## 3.1. Dependency với hệ thống JOBHUB

AI-V05 sử dụng các business concepts và capability hiện có:

- Candidate.
- Authentication và Authorization.
- Candidate CV Library.
- Default Candidate CV.
- CV ownership.
- CV status và lifecycle.
- Job.
- Company.
- Job Discovery.
- Job visibility.
- Career Category, gồm FIELD và POSITION.
- ExperienceLevel.
- EmploymentType.
- WorkMode.
- Các quy tắc phân quyền và resource ownership hiện hành.

AI-V05 không định nghĩa lại điều kiện Job được công khai, trạng thái Company hoặc lifecycle của Candidate CV.

Các quy tắc đó tiếp tục thuộc Product/Data Contract của những Backend version tương ứng.

## 3.2. Dependency với AI version trước

| Version | Capability được tái sử dụng                                                      |
| ------- | -------------------------------------------------------------------------------- |
| AI-V01  | `JobMatchProfile`, Generated `CVMatchProfile` và deterministic normalization     |
| AI-V02  | Chuẩn hóa Uploaded PDF CV thành `CVMatchProfile`                                 |
| AI-V03  | Semantic skills rubric, deterministic field scoring và weighted Match Score      |
| AI-V04  | Kinh nghiệm tổ chức một inference trả semantic assessment cùng nội dung nhận xét |

AI-V05 là một use case độc lập.

AI-V05 không yêu cầu gọi HTTP endpoint AI-V03 hoặc AI-V04 để thực hiện recommendation.

Việc tái sử dụng AI-V03 không được làm thay đổi hành vi matching một cặp Job–CV hiện có.

# 4. Thuật ngữ và actor

| Thuật ngữ             | Ý nghĩa                                                          |
| --------------------- | ---------------------------------------------------------------- |
| Candidate             | Người sử dụng Job Recommendation                                 |
| Default CV            | Candidate CV được đánh dấu Default theo CV Library               |
| Job Recommendation    | Danh sách Job được gợi ý dựa trên CV                             |
| Retrieval             | Quá trình tìm những Job có nội dung nghề nghiệp liên quan đến CV |
| Vector Similarity     | Tín hiệu tương đồng ngữ nghĩa sử dụng trong retrieval            |
| Shortlist             | Tập Job được lựa chọn để thực hiện semantic matching             |
| Semantic Assessment   | Đánh giá ngữ nghĩa về khả năng đáp ứng yêu cầu kỹ năng của Job   |
| Match Score           | Điểm phù hợp chính thức theo Matching Policy AI-V03              |
| Recommendation Reason | Nhận xét giải thích mức độ phù hợp của CV với Job                |
| Evidence              | Dữ liệu CV/Job hỗ trợ một assessment hoặc nhận xét               |
| READY Profile         | Match Profile đáp ứng điều kiện normalization hiện hành          |

Actor chính của AI-V05 là Candidate.

AI-V05 không bổ sung actor có quyền quyết định tuyển dụng hoặc thực hiện mutation đối với Job/CV.

# 5. AI Capability & Human Decision Boundary

| Hành động / quyết định                      | Hệ thống/AI | Candidate | Employer |
| ------------------------------------------- | ----------- | --------- | -------- |
| Lựa chọn Default CV theo trạng thái hiện có | ✓           |           |          |
| Phân tích thông tin nghề nghiệp của CV      | ✓           |           |          |
| Tìm Job liên quan                           | ✓           |           |          |
| Đánh giá semantic skills                    | ✓           |           |          |
| Tính Match Score theo V03                   | ✓           |           |          |
| Tạo Recommendation Reason                   | ✓           |           |          |
| Sắp xếp Job Recommendation                  | ✓           |           |          |
| Chọn hoặc thay đổi Default CV               |             | ✓         |          |
| Quyết định xem Job nào                      |             | ✓         |          |
| Quyết định ứng tuyển                        |             | ✓         |          |
| Quyết định tuyển dụng                       |             |           | ✓        |

AI-V05 không được:

- Tự thay đổi Default CV.
- Tự ứng tuyển Job.
- Tự thay đổi nội dung CV.
- Tự tạo hoặc thay đổi Job.
- Đưa ra quyết định tuyển dụng.

Recommendation và Match Score là thông tin hỗ trợ Candidate, không phải quyết định thay Candidate hoặc Employer.

# 6. Input & Trust Boundary

## 6.1. Input được phép

AI-V05 sử dụng:

Candidate CV

- Default CV thuộc Candidate đang xác thực.
- Nội dung nghề nghiệp của CV.
- Category/Position được khai báo.
- Skills.
- Professional Summary.
- Work Experience.
- Projects.
- Education và Certifications có giá trị nghề nghiệp.
- Các metadata cần thiết cho chính sách matching hiện hành.

Job

- Job đủ điều kiện Job Discovery.
- Job Title.
- Career Category và Position.
- Required Skills.
- Job Description.
- ExperienceLevel.
- Những metadata được AI-V03 sử dụng để matching.

Business eligibility

- CV ownership và lifecycle.
- Job visibility.
- Company eligibility.
- Những dữ liệu canonical cần thiết để xác định resource được phép sử dụng.

AI-V05 không mặc định sử dụng toàn bộ Candidate Profile, account information hoặc những nguồn dữ liệu nằm ngoài phạm vi CV được chọn.

## 6.2. Trust level

| Nguồn                          | Trust boundary                                                     |
| ------------------------------ | ------------------------------------------------------------------ |
| Job canonical data             | Business truth về Job                                              |
| CandidateCV canonical metadata | Business truth về trạng thái và quyền sử dụng CV                   |
| Generated CV content           | Claim nghề nghiệp do Candidate khai báo                            |
| Uploaded PDF content           | Claim được trích xuất từ tài liệu                                  |
| Normalized Match Profile       | Biểu diễn chuẩn hóa theo V01/V02                                   |
| Semantic assessment            | Kết quả đánh giá AI, không phải canonical fact                     |
| Recommendation Reason          | Nhận xét AI, không phải canonical fact                             |
| Match Score                    | Kết quả tính theo chính sách V03, không phải quyết định tuyển dụng |

Nội dung trong CV không mặc định được xác minh là đúng sự thật.

Việc một profile đạt `READY` không có nghĩa mọi claim trong profile đều đầy đủ hoặc chắc chắn.

## 6.3. Data minimization

AI-V05 chỉ sử dụng những thông tin cần thiết để:

- Tìm Job có liên quan.
- Đánh giá mức độ phù hợp.
- Tạo lý do giải thích.

Không đưa vào semantic context những dữ liệu không phục vụ recommendation, chẳng hạn:

- Password hoặc authentication credentials.
- Thông tin liên hệ không cần thiết.
- Internal database identifiers.
- Provenance path mang tính kỹ thuật.
- Professional links không phục vụ matching.
- Account hoặc Company-private data ngoài phạm vi cho phép.

Thông tin cá nhân xuất hiện trong free text phải được hạn chế theo nguyên tắc data minimization trước khi sử dụng cho semantic retrieval.

AI-V05 không tạo thêm Candidate fact từ quá trình chuẩn bị dữ liệu.

# 7. AI Output Contract & Semantics

AI-V05 trả một danh sách Job Recommendation có thứ tự.

Mỗi Job Recommendation phải có:

1. Thông tin nhận diện Job để frontend hiển thị và điều hướng.
2. Match Score chính thức theo AI-V03.
3. Recommendation Reason do LLM tạo.

Danh sách được sắp xếp theo Match Score giảm dần.

Số lượng Job trả về tối đa là 10.

Nếu số Job hợp lệ ít hơn 10, hệ thống trả về số lượng thực tế.

## 7.1. Semantics

### Match Score

Match Score biểu diễn mức độ phù hợp giữa Default CV và Job theo Matching Policy AI-V03.

Match Score không phải:

- Xác suất được tuyển dụng.
- Xác suất vượt qua phỏng vấn.
- Đánh giá chất lượng tuyệt đối của Candidate.
- Quyết định tuyển dụng của Employer.
- Vector Similarity Score.

AI-V05 không tạo một công thức Match Score mới.

### Recommendation Ranking

Recommendation Ranking thể hiện thứ tự Match Score chính thức của những Job đã được đánh giá.

Job đứng đầu danh sách có Match Score cao nhất trong tập kết quả được đánh giá.

Điều đó không có nghĩa Job này tốt hơn tất cả Job đang tồn tại trong hệ thống về mọi tiêu chí.

### Recommendation Reason

Recommendation Reason là nhận xét ngắn giải thích mức độ phù hợp của CV với Job.

Reason phải hướng đến bức tranh matching tổng thể, không chỉ liệt kê các kỹ năng trùng nhau.

Tùy theo evidence, reason có thể đề cập:

- Kỹ năng phù hợp.
- Kinh nghiệm liên quan.
- Sự tương đồng về chuyên môn.
- Những yêu cầu Candidate chưa chứng minh được.
- Những khoảng cách đáng chú ý giữa CV và Job.

Reason không cần diễn giải công thức tính điểm hoặc nêu lại chính xác phần trăm Match Score.

Tuy nhiên, reason không được mâu thuẫn rõ ràng với kết quả matching và evidence được sử dụng.

### UX grouping

Frontend có thể trình bày:

- Năm Job đầu: Phù hợp với bạn nhất.
- Năm Job tiếp theo: Các công việc bạn nên thử.

Đây là cách trình bày của frontend.

Backend không cần tạo hai ranking policy riêng.

Nhóm “Các công việc bạn nên thử” không mặc định sử dụng một thuật toán Career Exploration độc lập.

# 8. Scoring / Ranking Policy Boundary

AI-V05 bổ sung Job Recommendation Ranking nhưng không thay đổi Matching/Scoring Policy AI-V03.

## 8.1. Retrieval và Matching là hai nhiệm vụ khác nhau

Retrieval xác định những Job có khả năng liên quan về ngữ nghĩa với Default CV.

Matching đánh giá mức độ phù hợp của từng cặp CV–Job theo AI-V03.

Vector Similarity không được sử dụng trực tiếp làm Match Score.

Thứ tự retrieval không phải thứ tự recommendation cuối cùng.

## 8.2. Matching Policy

AI-V05 tái sử dụng đầy đủ năm nhóm scoring của AI-V03:

- Skills.
- Career Category.
- ExperienceLevel.
- EmploymentType.
- WorkMode.

Trọng số, rubric, semantics và cách tổng hợp điểm tiếp tục do AI-V03 sở hữu.

AI-V05 không được tự thay đổi scoring weights hoặc tạo một công thức thay thế.

Những thành phần cần semantic assessment phải có kết quả đánh giá hợp lệ trước khi hoàn tất Match Score.

LLM không quyết định Match Score cuối cùng.

## 8.3. Recommendation selection

Hệ thống được phép sử dụng một bước retrieval để lựa chọn Job trước semantic assessment.

Việc lựa chọn Job phục vụ assessment không được trình bày như kết quả matching chính thức.

AI-V05 không áp dụng hard filter theo FIELD/POSITION của Default CV trong semantic retrieval baseline.

Những Job khác FIELD/POSITION vẫn có thể được xem xét khi có liên quan về năng lực nghề nghiệp.

Tuy nhiên, quan hệ Category chính thức vẫn được AI-V03 đánh giá theo taxonomy hiện hành.

## 8.4. Location và Salary

AI-V05 không sử dụng Location hoặc Salary để:

- Hard filter recommendation.
- Tính Match Score.
- Tạo một ranking policy bổ sung.

Những thông tin này vẫn có thể được cung cấp để frontend hiển thị theo dữ liệu Job hiện có.

EmploymentType và WorkMode tiếp tục được đánh giá theo chính sách V03.

## 8.5. Không có minimum Match Score

AI-V05 không đặt ngưỡng Match Score tối thiểu để loại Job khỏi danh sách recommendation.

Một Job có Match Score thấp vẫn có thể xuất hiện nếu thuộc nhóm kết quả được xếp hạng cao nhất trong tập đã đánh giá.

Recommendation Reason phải phản ánh trung thực mức độ phù hợp tương ứng.

# 9. Evidence, Unknown & Reliability Rules

## 9.1. Evidence

Semantic assessment và Recommendation Reason phải dựa trên thông tin có trong CV, Job hoặc các kết quả matching hợp lệ.

AI-V05 không được tự tạo:

- Kỹ năng Candidate chưa khai báo hoặc chưa có evidence.
- Số năm kinh nghiệm không được hỗ trợ.
- Project hoặc thành tựu chưa tồn tại.
- Certification không có evidence.
- Job requirement không tồn tại.
- Company fact không có nguồn hỗ trợ.

## 9.2. Unknown khác mismatch

Thiếu bằng chứng không tự động đồng nghĩa với Candidate không có kỹ năng.

Ví dụ:

CV không đề cập Redis không chứng minh Candidate hoàn toàn không biết Redis.

Việc xác định trạng thái evidence và ảnh hưởng lên Skills Score phải tuân theo rubric hiện hành của V03.

AI-V05 không định nghĩa lại quy tắc phân loại evidence.

## 9.3. Uncertainty

Khi dữ liệu:

- Thiếu.
- Mơ hồ.
- Mâu thuẫn.
- Không đủ chứng minh yêu cầu kỹ năng.

AI-V05 không được trình bày conclusion chắc chắn hơn evidence hỗ trợ.

Uploaded CV có thể mang uncertainty từ quá trình extraction/normalization; AI-V05 không được tự loại bỏ hoặc che giấu uncertainty đó.

## 9.4. Hallucination

Recommendation Reason không được biến suy luận thiếu evidence thành Candidate fact hoặc Job fact.

Reason có thể trình bày khoảng cách hoặc thông tin chưa được chứng minh, nhưng không được tự tạo nội dung nghề nghiệp mới.

## 9.5. Consistency

Các yêu cầu consistency:

- Reason phải gắn đúng Job.
- Reason phải dựa trên đúng Default CV đã sử dụng.
- Reason không được mâu thuẫn rõ ràng với semantic assessment.
- Reason không được diễn giải thiếu evidence thành mismatch chắc chắn.
- Match Score phải được tính theo V03.
- Ranking cuối cùng phải dựa trên Match Score chính thức.

Không yêu cầu natural-language reason phải giống hệt nhau giữa các lần inference.

# 10. Functional Requirements

## F01 — Default CV Resolution & Normalization

### Actor

Candidate đã xác thực.

### Mục tiêu

Xác định Default CV hợp lệ và chuẩn bị dữ liệu nghề nghiệp phục vụ recommendation.

### Input business

- Candidate identity từ authentication context.
- Default Candidate CV theo CV Library.

### Tiền điều kiện

- Candidate đã xác thực.
- Candidate có Default CV thuộc quyền sở hữu.
- Default CV ở trạng thái `ACTIVE` và đáp ứng điều kiện sử dụng hiện hành.

Default CV có thể là `PUBLIC` hoặc `PRIVATE`.

### Luồng chính

1. Candidate yêu cầu Job Recommendation.
2. Hệ thống xác định Candidate từ authentication context.
3. Hệ thống tìm Default CV thuộc Candidate.
4. Hệ thống kiểm tra ownership và CV lifecycle.
5. Generated CV được chuẩn hóa bằng capability V01.
6. Uploaded PDF CV được chuẩn hóa bằng capability V02.
7. Hệ thống sử dụng `CVMatchProfile READY` làm nguồn cho recommendation.

### Kết quả

Một CV Match Profile hợp lệ được sử dụng cho request hiện tại.

### Failure / Unknown behavior

- Không có Default CV: trả lỗi nghiệp vụ.
- Default CV không hợp lệ: trả lỗi nghiệp vụ.
- Normalization thất bại: trả lỗi.
- Không tạo được profile đáp ứng readiness hiện hành: trả lỗi.

Frontend chịu trách nhiệm hướng dẫn Candidate chọn Default CV và gửi lại request khi cần.

Backend không tự chọn CV thay thế.

### Trường hợp từ chối

- Candidate chưa xác thực.
- CV không thuộc Candidate.
- CV không đáp ứng điều kiện sử dụng hiện hành.

### Business Rules liên quan

`BR-AI-01`, `BR-AI-02`, `BR-AI-03`, `BR-AI-04`.

### Không thuộc chức năng này

- Tạo CV.
- Chỉnh sửa CV.
- Đặt Default CV.
- Tạo persisted normalization cache mới.

## F02 — Eligible Job Retrieval

### Actor

Candidate đã xác thực, thông qua recommendation request.

### Mục tiêu

Tìm một tập Job có nội dung nghề nghiệp liên quan đến Default CV và đáp ứng điều kiện Job Discovery.

### Input business

- Default `CVMatchProfile READY`.
- Job data thuộc phạm vi public Job Discovery.
- Những dữ liệu canonical cần thiết để xác định Job visibility.

### Tiền điều kiện

- F01 đã chuẩn bị được CV hợp lệ.
- Hệ thống có khả năng truy cập nguồn Job được phép sử dụng.

### Luồng chính

1. Hệ thống sử dụng dữ liệu nghề nghiệp trong CV làm nguồn truy vấn.
2. Hệ thống giới hạn phạm vi Job theo những điều kiện eligibility hiện hành.
3. Hệ thống tìm các Job có mức độ liên quan ngữ nghĩa cao.
4. Hệ thống xác minh visibility bằng business owner hiện có.
5. Hệ thống lựa chọn tập Job ứng viên để thực hiện matching.

### Kết quả

Một tập Job ứng viên hợp lệ để tiếp tục đánh giá.

### Failure / Unknown behavior

- Không có Job đủ điều kiện: trả danh sách recommendation rỗng.
- Một Job có dữ liệu không hợp lệ hoặc không thể chuẩn hóa riêng lẻ: bỏ qua Job đó.
- Không bắt buộc thực hiện truy vấn bổ sung để bù Job bị bỏ qua.
- Lỗi dependency khiến không thể xác định eligibility hoặc truy cập nguồn Job: trả lỗi hệ thống.

### Trường hợp từ chối

Job không đáp ứng visibility policy không được đưa vào recommendation.

Historical Job access của capability khác không tự tạo quyền recommendation cho Job đó.

### Business Rules liên quan

`BR-AI-05`, `BR-AI-06`, `BR-AI-07`, `BR-AI-08`.

### Không thuộc chức năng này

- Tính Match Score chính thức.
- Tạo Recommendation Reason.
- Áp dụng Location/Salary recommendation filter.
- Thay đổi Job visibility.

## F03 — Batch Semantic Assessment & Recommendation Reason

### Actor

Hệ thống AI-V05, phục vụ request của Candidate.

### Mục tiêu

Đánh giá semantic skills cho nhiều Job với cùng một Default CV và tạo Recommendation Reason cho từng Job.

### Input business

- Một `CVMatchProfile READY`.
- Tập `JobMatchProfile READY` được lựa chọn ở F02.
- Rubric semantic skills của AI-V03.
- Evidence và metadata cần thiết để giải thích matching.

### Tiền điều kiện

- CV profile hợp lệ.
- Các Job được đưa vào batch có profile hợp lệ.
- Các Job trong batch có danh tính riêng biệt và được ánh xạ đúng.

### Luồng chính

1. Hệ thống chuẩn bị context cần thiết từ một CV và tập Job.
2. Hệ thống thực hiện một batch generative inference.
3. AI đánh giá semantic skills theo rubric V03 cho từng Job.
4. AI tạo Recommendation Reason tương ứng.
5. Hệ thống kiểm tra tính đầy đủ và chính xác về cấu trúc, ánh xạ của kết quả.
6. Kết quả assessment được chuyển cho matching capability để tính điểm.

### Kết quả

Mỗi Job trong batch hợp lệ có:

- Semantic assessment theo V03.
- Recommendation Reason tương ứng.

### Failure / Unknown behavior

- Generative inference timeout hoặc thất bại: request thất bại.
- Output sai cấu trúc bắt buộc: request thất bại.
- Output thiếu assessment hoặc reason: request thất bại.
- Output không thể ánh xạ đúng về các Job đã yêu cầu: request thất bại.

Không sử dụng partial recommendation khi batch inference không hợp lệ.

Không thay thế semantic assessment bằng Vector Similarity hoặc điểm giả định.

### Trường hợp từ chối

- Job không thuộc tập được phép đánh giá.
- Profile không đáp ứng readiness.
- Kết quả inference không đáp ứng output contract bắt buộc.

### Business Rules liên quan

`BR-AI-09`, `BR-AI-10`, `BR-AI-11`, `BR-AI-12`.

### Không thuộc chức năng này

- Thay đổi scoring weights V03.
- Tự tính Match Score chính thức bằng LLM.
- Tạo CV Improvement.
- Tạo conversation hoặc chatbot.
- Thực hiện nhiều generative calls để đánh giá riêng từng Job.

## F04 — Weighted Scoring & Final Recommendation

### Actor

Candidate.

### Mục tiêu

Tạo danh sách Job Recommendation cuối cùng dựa trên Match Score chính thức và Recommendation Reason.

### Input business

- Tập Job đã được đánh giá.
- Semantic assessment hợp lệ.
- Các dữ liệu deterministic matching theo AI-V03.
- Recommendation Reason tương ứng với từng Job.

### Tiền điều kiện

- Batch assessment hoàn thành hợp lệ.
- Có đủ dữ liệu để áp dụng Matching Policy V03 cho từng Job được đánh giá.

### Luồng chính

1. Hệ thống tính các thành phần scoring theo V03.
2. Hệ thống tổng hợp Match Score chính thức cho từng Job.
3. Hệ thống sắp xếp các Job theo Match Score giảm dần.
4. Hệ thống lựa chọn tối đa 10 Job đứng đầu.
5. Mỗi Job được gắn với Recommendation Reason tương ứng.
6. Hệ thống trả danh sách có thứ tự cho Candidate.

### Kết quả

Danh sách tối đa 10 Job với:

- Thông tin Job cần thiết.
- Match Score.
- Recommendation Reason.

### Failure / Unknown behavior

- Không đủ Job để trả 10 kết quả: trả số lượng thực tế.
- Không áp dụng minimum Match Score threshold.
- Lỗi scoring hoặc assessment khiến kết quả không hợp lệ: trả lỗi, không tự tạo điểm thay thế.

### Trường hợp từ chối

Không trả về Job không còn đáp ứng điều kiện visibility tại thời điểm kết quả được xác nhận.

### Business Rules liên quan

`BR-AI-10`, `BR-AI-11`, `BR-AI-13`, `BR-AI-14`, `BR-AI-15`.

### Không thuộc chức năng này

- Tạo scoring policy mới.
- Áp dụng Job.
- Thay đổi CV.
- Tạo ranking riêng cho nhóm “Các công việc bạn nên thử”.

# 11. AI Business Rules

## BR-AI-01 — Default CV là nguồn CV duy nhất

AI-V05 sử dụng Default CV hợp lệ của Candidate đang xác thực.

Không tự chọn một CV khác theo thời gian cập nhật, trạng thái public hoặc mức độ đầy đủ nội dung.

## BR-AI-02 — Ownership và lifecycle của Default CV

Default CV phải thuộc Candidate và đáp ứng điều kiện sử dụng hiện hành, bao gồm trạng thái `ACTIVE`.

CV `PRIVATE` không bị loại chỉ vì visibility của CV, khi chính Candidate sở hữu yêu cầu recommendation.

## BR-AI-03 — Không tự thay đổi Default CV

AI-V05 không tạo, thay đổi hoặc tự chọn Default CV thay Candidate.

Khi không có Default CV hợp lệ, backend trả lỗi nghiệp vụ; frontend quản lý hành vi chọn CV và gửi lại request.

## BR-AI-04 — Generated và Uploaded CV sử dụng cùng matching semantics

Generated CV sử dụng normalization V01.

Uploaded PDF CV sử dụng normalization V02.

Sau khi tạo được `CVMatchProfile READY`, hai nguồn CV phải tuân theo cùng recommendation và scoring semantics.

## BR-AI-05 — Job Recommendation tuân thủ Job Discovery

Job được recommendation phải đáp ứng visibility policy của Job Discovery tại thời điểm kết quả được xác nhận.

AI-V05 không tự định nghĩa lại Job hoặc Company eligibility.

## BR-AI-06 — Historical access không cấp quyền recommendation

Quyền đọc Job lịch sử của capability khác không đồng nghĩa Job đó được phép xuất hiện trong recommendation.

## BR-AI-07 — Không hard filter theo Career Category

AI-V05 không mặc định loại Job chỉ vì FIELD/POSITION khác với Category của CV.

Career Category vẫn được đánh giá chính thức theo AI-V03.

## BR-AI-08 — Location và Salary không tham gia recommendation policy

Location và Salary không được dùng làm điều kiện hard filter hoặc yếu tố xếp hạng trong AI-V05.

Version này không bổ sung scoring cho hai yếu tố đó.

## BR-AI-09 — Semantic assessment theo V03

Semantic skills assessment trong AI-V05 phải giữ nguyên rubric và evidence semantics của V03.

Không định nghĩa lại tiêu chí Required/Preferred hoặc quy tắc scoring semantic skills.

## BR-AI-10 — V03 là authority của Match Score

Match Score cuối cùng phải được tính theo Matching/Scoring Policy AI-V03.

LLM không được quyết định, ghi đè hoặc thay đổi Match Score.

Vector Similarity không được trình bày thành Match Score.

## BR-AI-11 — Một batch generative assessment

Một recommendation request sử dụng một generative inference cho semantic assessment và Recommendation Reason của batch Job.

Ngoại lệ: Uploaded PDF CV có thể cần generative inference riêng của AI-V02 để chuẩn hóa đầu vào.

Giới hạn này không áp dụng cho embedding inference phục vụ semantic retrieval.

## BR-AI-12 — Assessment và Reason phải ánh xạ đúng Job

Kết quả batch phải đầy đủ về cấu trúc và ánh xạ chính xác giữa Job, semantic assessment và Recommendation Reason.

Không chấp nhận kết quả thiếu, trùng hoặc ánh xạ sai mà vẫn trình bày như recommendation hợp lệ.

## BR-AI-13 — Recommendation Reason bắt buộc do LLM tạo

Mỗi Job được trả về phải có Recommendation Reason do LLM tạo từ dữ liệu matching hợp lệ.

Không thay thế bằng text cố định của backend.

Reason phải giải thích mức độ phù hợp tổng thể, bao gồm các điểm tương đồng và khoảng cách quan trọng khi có evidence.

## BR-AI-14 — Ranking cuối theo Match Score

Danh sách recommendation cuối cùng được sắp xếp theo Match Score V03 giảm dần.

Retrieval ranking không thay thế thứ tự matching cuối cùng.

## BR-AI-15 — Tối đa 10 Job, không có minimum score

AI-V05 trả tối đa 10 Job.

Không loại Job chỉ vì Match Score thấp hơn một ngưỡng do AI-V05 tự đặt.

Nếu không đủ Job hợp lệ, trả về số lượng thực tế.

## BR-AI-16 — Job lỗi riêng lẻ trước inference

Một Job có dữ liệu không hợp lệ hoặc không thể chuẩn hóa riêng lẻ có thể bị bỏ qua trước batch inference.

AI-V05 không bắt buộc tìm Job khác để bù số lượng bị thiếu.

Lỗi dependency ảnh hưởng khả năng xử lý toàn request không được che giấu thành lỗi dữ liệu của một Job.

## BR-AI-17 — Batch inference failure không có partial fallback

Khi batch inference hoặc kết quả bắt buộc của batch không hợp lệ, request thất bại.

Không trả partial recommendation và không tạo Match Score thay thế.

## BR-AI-18 — Evidence trước conclusion

Recommendation Reason và semantic assessment không được tạo Candidate fact hoặc Job fact thiếu evidence.

Unknown và mismatch giữ nguyên semantics của V03.

## BR-AI-19 — Không có business mutation

AI-V05 không tự thay đổi CV, Job, Company, Application hoặc những business resource khác.

Recommendation không tạo quyền thực hiện action ngoài authorization hiện hành.

# 12. Agent / Side-effect Boundary

AI-V05 không bổ sung autonomous Agent.

Version này không cấp quyền mutation cho AI.

| Hành động                           | AI-V05 được phép |
| ----------------------------------- | ---------------- |
| Đọc Default CV hợp lệ trong request | Có               |
| Đọc Job thuộc phạm vi được phép     | Có               |
| Đánh giá matching                   | Có               |
| Tạo Recommendation Reason           | Có               |
| Trả Job Recommendation              | Có               |
| Tạo/sửa CV                          | Không            |
| Thay đổi Default CV                 | Không            |
| Publish Job                         | Không            |
| Apply Job                           | Không            |
| Thay đổi Company data               | Không            |
| Quyết định tuyển dụng               | Không            |

Các dữ liệu dẫn xuất phục vụ semantic retrieval, nếu cần duy trì bởi hệ thống, không tự trở thành mutation đối với business content hoặc lifecycle của Job/CV.

Quyền sở hữu và cơ chế duy trì dữ liệu dẫn xuất thuộc Data/Engineering Contract.

# 13. Resource Lifecycle & State Transitions

AI-V05 không bổ sung business resource lifecycle mới.

Version không thay đổi:

- Candidate CV lifecycle.
- Job lifecycle.
- Company lifecycle.
- Application lifecycle.

Recommendation là kết quả được tạo theo request.

AI-V05 không định nghĩa trạng thái persisted Recommendation mới hoặc recommendation history như một business capability.

Trạng thái nội bộ của quá trình xử lý, nếu có, không tự trở thành Product State.

Các thay đổi trạng thái Job hoặc Company phải tiếp tục tuân theo Backend Product Contract hiện hành.

# 14. Authorization / Ownership / Tenant Boundary

AI-V05 chỉ được sử dụng bởi Candidate có quyền yêu cầu capability.

Hệ thống phải:

1. Xác định Candidate từ authentication context.
2. Resolve Default CV theo Candidate ownership.
3. Kiểm tra CV lifecycle và điều kiện sử dụng.
4. Giới hạn tập Job theo public Job visibility.
5. Chỉ sử dụng dữ liệu thuộc phạm vi được phép.
6. Không trả về Company-private hoặc Candidate-private data của chủ thể khác.

Candidate không được dùng AI-V05 để truy cập CV của Candidate khác.

Một Job không discoverable không được xuất hiện trong kết quả chỉ vì hệ thống vẫn có khả năng đọc Job đó qua capability nội bộ khác.

AI-V05 không tạo multi-tenant boundary mới và không bypass những boundary hiện hành.

# 15. Failure & Fallback Behavior

AI-V05 phân biệt business outcome với technical failure.

| Tình huống                                  | Hành vi sản phẩm                   |
| ------------------------------------------- | ---------------------------------- |
| Candidate chưa xác thực hoặc không có quyền | Từ chối request                    |
| Không có Default CV                         | Trả lỗi nghiệp vụ                  |
| Default CV không hợp lệ                     | Trả lỗi nghiệp vụ                  |
| Generated CV normalization thất bại         | Trả lỗi                            |
| Uploaded CV normalization thất bại          | Trả lỗi                            |
| Không tạo được CVMatchProfile READY         | Trả lỗi                            |
| Không có Job discoverable                   | Trả danh sách rỗng                 |
| Một Job riêng lẻ không hợp lệ trước batch   | Bỏ qua Job, không bắt buộc bổ sung |
| Tập Job hợp lệ ít hơn số lượng mục tiêu     | Trả số lượng thực tế               |
| Semantic inference timeout                  | Trả lỗi request                    |
| Batch output sai cấu trúc hoặc ánh xạ       | Trả lỗi request                    |
| Thiếu semantic assessment hoặc reason       | Trả lỗi request                    |
| Dependency failure ảnh hưởng toàn request   | Trả lỗi hệ thống                   |
| Match Score thấp                            | Vẫn có thể trả recommendation      |

Nguyên tắc:

Technical failure không được chuyển thành Match Score thấp hoặc business mismatch.

AI-V05 không sử dụng:

- Vector Similarity làm điểm fallback.
- Semantic assessment giả định.
- Reason hardcode thay thế khi generative inference thất bại.
- Một CV khác thay Default CV.

Cơ chế retry sau khi Candidate thiết lập Default CV thuộc frontend.

Các mã lỗi HTTP cụ thể thuộc Data/API Contract và Backend error conventions.

# 16. AI Quality & Evaluation

AI-V05 cần được đánh giá về chất lượng recommendation, không chỉ khả năng trả response hợp lệ.

Các dimension áp dụng:

1. Retrieval relevance.
2. Recommendation ranking usefulness.
3. V03 scoring consistency.
4. Semantic skills assessment consistency.
5. Recommendation Reason factuality.
6. Evidence alignment.
7. Unknown/missing-information handling.
8. Job eligibility correctness.
9. Batch result completeness và identity mapping.

Không tự đặt một ngưỡng Match Score tối thiểu hoặc tỷ lệ precision/recall bắt buộc khi chưa có quyết định đánh giá tương ứng.

## 16.1. Representative cases

Evaluation cần bao phủ những nhóm tình huống đại diện:

### Input

- Default Generated CV hợp lệ.
- Default Uploaded PDF CV hợp lệ.
- Default CV `PRIVATE` thuộc Candidate.
- Candidate không có Default CV.
- Default CV không hợp lệ.
- CV có thông tin nghề nghiệp thiếu hoặc không chắc chắn.

### Retrieval

- CV và Job cùng POSITION.
- CV và Job khác POSITION nhưng cùng FIELD.
- CV và Job khác FIELD.
- Job có kỹ năng tương đồng nhưng yêu cầu công việc khác nhau.
- Job có yêu cầu khác biệt đáng kể về ExperienceLevel.
- Job không discoverable.
- Không có Job hợp lệ để recommendation.

### Matching

- Job có mức phù hợp cao.
- Job có mức phù hợp trung bình.
- Job có mức phù hợp thấp.
- Trường hợp thiếu evidence.
- Trường hợp có nhiều Job với Vector Similarity gần nhau nhưng Match Score khác nhau.

### Reason

- Reason phản ánh thế mạnh.
- Reason phản ánh khoảng cách.
- Reason không tạo Candidate fact hoặc Job fact mới.
- Reason phù hợp với assessment của đúng Job.
- Reason không diễn giải Match Score thấp thành mức phù hợp cao.

### Reliability

- Một Job không hợp lệ trước batch.
- Batch inference timeout.
- Batch output thiếu một Job.
- Batch output trùng hoặc sai ánh xạ.
- Batch output thiếu reason.
- Dependency failure.

## 16.2. Acceptance

AI-V05 đạt yêu cầu business quality khi:

- Các Functional Requirements được đáp ứng.
- Các Business Rules được giữ.
- Kết quả ranking cuối tuân theo Match Score V03.
- Không có Job không discoverable trong kết quả.
- Không có sai lệch nghiêm trọng về identity mapping giữa CV, Job, assessment và reason.
- Reason có tính hữu ích và nhất quán với evidence ở mức chấp nhận được cho demo.
- Không có hallucination nghiêm trọng làm sai lệch ý nghĩa recommendation.
- Failure behavior phù hợp Product Contract.
- Những limitation được phát hiện trong evaluation được ghi nhận trung thực.

AI-V05 không yêu cầu natural-language reason hoàn hảo tuyệt đối.

Các sai khác nhỏ về diễn đạt hoặc chất lượng ngữ nghĩa có thể được chấp nhận nếu không gây sai lệch nghiêm trọng về recommendation hoặc vi phạm các business boundary.

Việc định nghĩa test dataset, phương pháp đo, evidence và các tiêu chí đánh giá chi tiết hơn thuộc Evaluation Contract.

# 17. Lifecycle Invariants

Các invariant phải được giữ trong toàn bộ AI-V05:

1. Recommendation không tự trở thành Candidate hoặc Job canonical fact.
2. AI-V05 không bypass Candidate CV ownership.
3. Chỉ Default CV hợp lệ của Candidate được sử dụng.
4. AI-V05 không tự chọn hoặc thay đổi Default CV.
5. Job được trả về phải đáp ứng public visibility.
6. Historical access không tạo quyền recommendation cho Job.
7. Match Score được tính theo chính sách AI-V03.
8. Vector Similarity không thay thế Match Score.
9. LLM không tự quyết định điểm tổng.
10. Mỗi Recommendation Reason phải thuộc đúng Job.
11. Reason không tạo fact thiếu evidence.
12. Missing evidence không tự động đồng nghĩa với mismatch ngoài semantics V03.
13. Technical failure không được biến thành negative matching result.
14. Batch inference không hợp lệ không tạo partial recommendation.
15. AI-V05 không tự apply Job hoặc thay đổi Candidate CV.
16. Candidate và Company resource boundaries hiện có luôn được bảo toàn.

# 18. Các quyết định chủ động defer

Các capability sau không thuộc AI-V05:

- Employer-side Candidate Recommendation.
- Job → tìm Candidate bằng semantic retrieval.
- AI tự động ứng tuyển Job.
- AI tự tạo hoặc sửa CV.
- Chatbot tư vấn công việc.
- Recommendation dựa trên hội thoại hoặc lịch sử tương tác.
- Career Goal inference ngoài nguồn CV hợp lệ.
- Location/Salary preference ranking.
- Một thuật toán riêng cho nhóm “Các công việc bạn nên thử”.
- Minimum Match Score threshold.
- Recommendation history như một persisted product capability.
- Cache/persistence riêng cho CV embedding.
- Cache riêng cho Uploaded CV normalization.
- Các tối ưu phục vụ tải production lớn không cần thiết cho scope hiện tại.

Những capability đã defer không được tự triển khai chỉ vì có thể tái sử dụng hạ tầng AI-V05.

# 19. Các quyết định chưa chốt

Không còn AI/business decision chưa chốt ảnh hưởng đến phạm vi Product Specification AI-V05 đã thống nhất.

Các vấn đề sau thuộc thiết kế kỹ thuật hoặc evaluation, không phải Business Rule cần tự động chốt tại Product Spec:

- Kích thước retrieval candidate pool.
- Kích thước batch assessment.
- Chiến lược truy vấn và indexing cụ thể.
- Cách serialize dữ liệu thành embedding/query text.
- Giới hạn input/output token.
- Provider và embedding model.
- Cách đồng bộ dữ liệu retrieval khi Job thay đổi.
- Tên field, schema, index và persistence representation.
- API route, HTTP method, status code và response schema.
- Cách tổ chức source code và orchestration.
- Benchmark thực tế về retrieval quality, latency và context budget.

Các quyết định kỹ thuật này phải tuân theo Product Specification và được xác minh trước hoặc trong implementation phù hợp.

Chúng không được tự tạo business behavior mới hoặc thay đổi các Product Decisions đã chốt.

# 20. Definition of AI Business Completion

AI-V05 được coi là hoàn thành về mặt business khi:

1. Candidate có thể yêu cầu Job Recommendation bằng Default CV hợp lệ.
2. Generated CV và Uploaded PDF CV được hỗ trợ theo normalization semantics hiện hành.
3. Chỉ Job được phép discover mới xuất hiện trong recommendation.
4. Retrieval tìm được tập Job ứng viên phục vụ matching.
5. Batch semantic assessment cung cấp dữ liệu hợp lệ cho V03.
6. Match Score chính thức được tính theo V03, không phải từ Vector Similarity hoặc do LLM tự quyết định.
7. Mỗi Job trả về có Recommendation Reason do LLM tạo.
8. Danh sách có tối đa 10 Job, sắp xếp theo Match Score giảm dần.
9. Không áp dụng minimum score hoặc ranking preference ngoài scope.
10. Authorization và ownership được bảo toàn.
11. Các tình huống lỗi tuân theo Product Contract.
12. AI không thực hiện business mutation ngoài capability.
13. Evaluation cho thấy recommendation có chất lượng ngữ nghĩa chấp nhận được theo scope demo.
14. Những sai lệch, giới hạn và verification chưa thực hiện được báo cáo trung thực.

Những điều sau không tự động chứng minh AI-V05 hoàn thành:

- Vector Search Index đã tạo thành công.
- Embedding được tạo.
- API trả về danh sách Job.
- JSON đúng schema.
- LLM trả được reason.
- Focused tests pass.
- Một vài trường hợp demo trông hợp lý.

Business Completion đòi hỏi capability hoạt động đúng với các yêu cầu nghiệp vụ, boundary và chất lượng được xác định trong tài liệu này.

# 21. Implementation Boundary

Tài liệu này là:

CANONICAL AI PRODUCT SPECIFICATION — AI-V05

Tài liệu xác định:

- AI-V05 phải làm gì.
- AI-V05 không được làm gì.
- Dữ liệu nào được phép sử dụng.
- Kết quả recommendation có ý nghĩa gì.
- Quyền quyết định thuộc actor nào.
- Scoring và ranking phải tuân theo business authority nào.
- Chất lượng và failure behavior được kỳ vọng ra sao.

Tài liệu không quy định:

- LLM provider hoặc model.
- Embedding model.
- Prompt hoặc system prompt.
- Temperature.
- Token limit.
- Vector dimension.
- Vector database implementation.
- Retrieval hoặc reranking algorithm cụ thể.
- Kích thước Top K hoặc batch cố định.
- Công thức scoring mới.
- JSON Schema cụ thể.
- REST endpoint và HTTP status.
- MongoDB collection/field/index design.
- Cache, queue hoặc retry implementation.
- Backend controller/service structure.
- AI Kit module structure.
- Frontend component implementation.
- Test framework hoặc full verification command.

Thứ tự authority:

```
AI-V05 Product Specification
        ↓
AI-V05 Data Contract
        ↓
AI Engineering Contracts
        ↓
Backend / AI Kit Implementation
        ↓
Focused Tests / Evaluation / Acceptance
```

AI-V05 phải bảo toàn các Product/Data Contract hiện hành của Backend và AI-V01–V04.

Khi implementation hoặc technical design mâu thuẫn với Product Specification:

- Implementation phải được điều chỉnh; hoặc
- Product Specification phải được Product Owner chủ động xem xét và cập nhật.

Không được âm thầm thay đổi business behavior để phù hợp với một implementation thuận tiện hơn.

Kết thúc AI-V05 Product Specification.

Tài liệu trên giữ những quyết định đã thống nhất ở mức business, đồng thời cố ý không khóa các tham số thử nghiệm như K = 30, M = 12, giới hạn token hay cách cài Atlas. Những chi tiết đó sẽ được xử lý ở Data/Engineering Contract và cần evidence trước khi triển khai.
