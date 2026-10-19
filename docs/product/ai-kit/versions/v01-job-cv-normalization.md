# AI-V01 — Chuẩn hóa Job/CV thành Canonical Match Profiles

> **File:** `docs/product/ai-kit/versions/v01-job-cv-normalization.md`
> **Vai trò:** Canonical AI Product Specification
> **Approval status:** `APPROVED`
> **Phase:** JOBHUB AI Phase
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business behavior, dữ liệu đầu vào được phép, ngữ nghĩa chuẩn hóa và chất lượng yêu cầu của AI-V01.

---

# 1. Mục tiêu

AI-V01 cung cấp khả năng chuẩn hóa dữ liệu Job và Candidate CV có cấu trúc của JOBHUB thành hai biểu diễn thống nhất:

- `JobMatchProfile`
- `CVMatchProfile`

Hai profile là đầu vào chuẩn phục vụ các capability AI ở những version tiếp theo, đặc biệt là CV–Job Matching.

AI-V01 sử dụng AI để hiểu nội dung ngôn ngữ tự nhiên và hỗ trợ trích xuất thông tin nghề nghiệp. JOBHUB chịu trách nhiệm hợp nhất kết quả với dữ liệu nguồn và bảo toàn ngữ nghĩa theo các Business Rules được phê duyệt.

Khi hoàn thành V01, hệ thống phải có khả năng:

- Chuẩn hóa dữ liệu Job thành `JobMatchProfile`.
- Chuẩn hóa Generated CV thành `CVMatchProfile`.
- Bảo toàn thông tin nghề nghiệp và evidence có trong nguồn hợp lệ.
- Xử lý dữ liệu thiếu bằng cách để trống các field tương ứng.
- Bảo toàn các claim mâu thuẫn mà không từ chối chuẩn hóa chỉ vì mâu thuẫn.
- Phân biệt các Job requirement bắt buộc và ưu tiên theo quy tắc đã chốt.
- Cung cấp kết quả chuẩn hóa có ngữ nghĩa nhất quán cho các version AI tiếp theo.

AI-V01 không thực hiện matching, scoring, ranking hoặc đánh giá chất lượng Candidate.

# 2. Phạm vi

## 2.1. Trong phạm vi

- Chuẩn hóa Job từ dữ liệu có cấu trúc và nội dung mô tả Job.
- Chuẩn hóa Generated CV từ dữ liệu có cấu trúc và nội dung nghề nghiệp.
- Trích xuất thông tin nghề nghiệp được thể hiện trong nội dung tự do.
- Chuẩn hóa các giá trị có thể ánh xạ về business taxonomy hiện có của JOBHUB.
- Bổ sung thông tin còn thiếu từ nội dung nguồn khi có căn cứ hợp lệ.
- Hợp nhất các thông tin tương đương mà không làm mất evidence.
- Bảo toàn các thông tin có căn cứ nhưng chưa ánh xạ được về taxonomy.
- Bảo toàn các claim mâu thuẫn cùng thông tin nguồn tương ứng.
- Phân biệt required và optional Job requirements.
- Bảo toàn declared claims, unknown và uncertainty.
- Trả về một canonical profile tương ứng với một đầu vào được xử lý.
- Phân biệt chuẩn hóa thành công và thất bại xử lý.

## 2.2. Ngoài phạm vi

- Toàn bộ quá trình tiếp nhận và xử lý Uploaded CV source.
- Xử lý PDF, OCR hoặc trích xuất nội dung từ tài liệu upload.
- Chuyển Uploaded CV thành `CVMatchProfile`.
- CV–Job Matching và Scoring.
- Match explanation và tư vấn cải thiện CV.
- Job recommendation và ranking.
- AI chatbot hoặc AI Agent.
- Tạo, sửa hoặc publish Candidate CV.
- Tự động apply Job.
- Employer-side Candidate ranking.
- Quyết định tuyển dụng.
- Quản lý lịch sử, phiên bản hoặc freshness của canonical profile.
- Đồng bộ hoặc tự động làm mới profile khi Job/CV nguồn thay đổi.

Các capability ngoài phạm vi không được bổ sung như một phần của AI-V01.

# 3. Dependency

## 3.1. Dependency với hệ thống JOBHUB

AI-V01 sử dụng các business concepts đã tồn tại:

- `Job`.
- `Job Description`.
- `Candidate`.
- `Candidate CV`.
- `Generated CV`.
- Structured Job/CV metadata.
- Job requirements.
- Skills, experience, education, languages, certifications và các thông tin nghề nghiệp liên quan.
- JOBHUB canonical taxonomies và controlled metadata.
- Authentication, authorization và resource ownership khi áp dụng.
- Job visibility và Company tenant boundary khi áp dụng.

AI-V01 không thay đổi ngữ nghĩa hoặc lifecycle của các resource nguồn.

Canonical profile là kết quả chuẩn hóa phục vụ capability AI, không phải một phiên bản thay thế của Job hoặc Candidate CV gốc.

## 3.2. Dependency với AI version trước

AI-V01 là business capability đầu tiên của AI Kit.

Version sử dụng nền tảng AI Kit hiện có nhưng không phụ thuộc vào một AI business capability trước đó.

Các version tiếp theo có thể sử dụng `JobMatchProfile` và `CVMatchProfile`, nhưng không được mặc định thay đổi semantics đã được xác lập bởi V01.

# 4. Thuật ngữ và actor

| Thuật ngữ | Ý nghĩa |
|---|---|
| Candidate | Người dùng có Candidate CV trong JOBHUB |
| Employer | Chủ thể tuyển dụng liên quan đến Job |
| AI System | Thành phần hỗ trợ hiểu và trích xuất ngữ nghĩa |
| Generated CV | CV được biểu diễn bằng dữ liệu có cấu trúc trong JOBHUB |
| JobMatchProfile | Biểu diễn chuẩn của một Job phục vụ các capability AI tiếp theo |
| CVMatchProfile | Biểu diễn chuẩn của một Candidate CV phục vụ các capability AI tiếp theo |
| Canonical Data | Dữ liệu đã được chuẩn hóa theo các quy tắc business của V01 |
| Evidence | Thông tin nguồn hỗ trợ một claim |
| Declared Claim | Thông tin được khai báo trong dữ liệu Job/CV |
| Unknown | Thông tin chưa xác định được từ nguồn được phép |
| Uncertainty | Mức thiếu chắc chắn của thông tin được ghi nhận |
| Conflict | Hai hoặc nhiều claim có ngữ nghĩa mâu thuẫn |
| Consolidation | Quá trình hợp nhất và chuẩn hóa thông tin từ các nguồn hợp lệ |
| READY | Kết quả chuẩn hóa thành công và có cấu trúc canonical hợp lệ |
| FAILED | Quá trình chuẩn hóa không hoàn tất thành công |

**Actors:**

- **JOBHUB System:** Thực hiện nghiệp vụ chuẩn hóa Job/CV.
- **Candidate:** Chủ thể sở hữu Candidate CV và hưởng lợi từ các capability sử dụng `CVMatchProfile`.
- **Employer:** Chủ thể cung cấp thông tin Job trong phạm vi nghiệp vụ JOBHUB.
- **AI System:** Hỗ trợ phân tích ngữ nghĩa, không phải authority quyết định tính đúng đắn tuyệt đối của dữ liệu.

# 5. AI Capability & Human Decision Boundary

| Hành động / quyết định | AI System | Authority |
|---|---|---|
| Hiểu nội dung Job Description | Được phép | JOBHUB Consolidation Rules |
| Hiểu nội dung Generated CV | Được phép | JOBHUB Consolidation Rules |
| Trích xuất thông tin nghề nghiệp | Được phép | JOBHUB Consolidation Rules |
| Đề xuất classification/normalization | Được phép | JOBHUB Business Rules |
| Tự xác minh Candidate claim ngoài đời thực | Không | Không thuộc V01 |
| Tự sửa dữ liệu Job/CV gốc | Không | Workflow JOBHUB hiện có |
| Tự công bố hoặc publish CV | Không | Candidate theo quyền hiện có |
| Chấm điểm mức độ phù hợp | Không | AI version sau |
| Quyết định tuyển dụng | Không | Employer |

AI được phép nhận diện, diễn giải và đề xuất thông tin từ nguồn.

AI không được tự tạo thông tin chưa có căn cứ hoặc tự quyết định business behavior ngoài các quy tắc đã được phê duyệt.

Việc một canonical profile chứa claim mâu thuẫn không đồng nghĩa với việc AI được phép xác nhận mọi claim đó là sự thật.

AI-V01 chủ động chấp nhận việc profile còn bất đồng về ngữ nghĩa, miễn các claim được bảo toàn đúng nguồn và kết quả chuẩn hóa hợp lệ.

# 6. Input & Trust Boundary

## 6.1. Input được phép

### Job

- Structured Job metadata.
- Job title.
- Job description.
- Job requirements.
- Skills và qualifications.
- Experience requirements.
- Education và language requirements khi có.
- Employment type.
- Work mode.
- Location và các thuộc tính nghề nghiệp liên quan khi có.
- Các nội dung mô tả bổ sung thuộc Job.

### Generated CV

- Structured CV metadata.
- Career positioning.
- Professional summary.
- Declared skills.
- Work experience.
- Projects.
- Education.
- Certifications.
- Languages.
- Declared experience claims.
- Candidate preferences được biểu diễn trong nguồn CV.
- Các nội dung nghề nghiệp bổ sung có trong CV.

AI-V01 chỉ sử dụng nguồn Job hoặc Generated CV hợp lệ thuộc capability hiện tại.

Uploaded CV source và nội dung được trích xuất từ tài liệu upload không thuộc phạm vi xử lý của V01.

## 6.2. Trust level

| Input | Vai trò |
|---|---|
| Structured Job metadata | Nguồn business metadata hiện có của Job |
| Job Description | Nguồn evidence cho thông tin và yêu cầu nghề nghiệp |
| Structured Generated CV | Nguồn claim của Candidate |
| CV free-text content | Nguồn evidence bổ sung cho claim nghề nghiệp |
| AI-extracted information | Thông tin trích xuất cần được hợp nhất theo Business Rules |
| Canonical profile | Kết quả chuẩn hóa, không phải xác minh sự thật ngoài đời |

Các nguyên tắc:

1. Structured metadata hợp lệ được bảo toàn.
2. AI-extracted information không tự động ghi đè dữ liệu nguồn.
3. Thông tin từ free text có thể bổ sung field còn trống nếu có căn cứ và thuộc phạm vi đã được phê duyệt.
4. Khi nguồn mâu thuẫn, hệ thống bảo toàn các claim tương ứng thay vì tự từ chối chuẩn hóa.
5. Riêng trường hợp cùng một Job requirement có cả REQUIRED và OPTIONAL, REQUIRED được ưu tiên.
6. Không có thông tin thì để field tương ứng rỗng.
7. Không được bịa thông tin để hoàn thiện profile.

Một Candidate claim xuất hiện trong CV có thể được ghi nhận là claim có nguồn, nhưng không mặc nhiên là fact đã được xác minh độc lập.

## 6.3. Data minimization

Chỉ sử dụng dữ liệu cần thiết từ Job/CV thuộc phạm vi xử lý.

Không mặc định sử dụng toàn bộ Candidate account, Company data hoặc dữ liệu người dùng khác.

AI không được tự mở rộng phạm vi input bằng các nguồn không được capability cho phép.

# 7. AI Output Contract & Semantics

AI-V01 tạo một trong hai loại canonical profile tương ứng với đầu vào:

- `JobMatchProfile`
- `CVMatchProfile`

Các profile chứa thông tin nghề nghiệp được chuẩn hóa cùng evidence và các claim liên quan khi có.

Không yêu cầu mọi field nghề nghiệp phải có dữ liệu.

## 7.1. Semantics

### JobMatchProfile

`JobMatchProfile` biểu diễn thông tin Job để các AI capability tiếp theo có thể sử dụng.

Các nhóm thông tin áp dụng khi có dữ liệu:

- Job positioning.
- Job metadata.
- Required requirements.
- Optional requirements.
- Skills và qualifications.
- Experience requirements.
- Employment type.
- Work mode.
- Education/language requirements.
- Các thông tin ngữ cảnh nghề nghiệp liên quan.
- Evidence và các claim được bảo toàn.

**Requirement priority:**

- `REQUIRED`: Yêu cầu bắt buộc được Job thể hiện.
- `OPTIONAL`: Yêu cầu ưu tiên/lợi thế được Job thể hiện.
- Nếu cùng một requirement được xác định đồng thời là REQUIRED và OPTIONAL, kết quả ưu tiên REQUIRED.
- Nếu không thể xác định priority từ nguồn, không tự suy diễn priority.

Thông tin Job chỉ mang tính mô tả hoặc bối cảnh không tự động trở thành yêu cầu bắt buộc.

### CVMatchProfile

`CVMatchProfile` biểu diễn các thông tin Candidate khai báo trong Generated CV và những thông tin nghề nghiệp có thể trích xuất hợp lệ từ nguồn.

Các nhóm thông tin áp dụng khi có dữ liệu:

- Career positioning.
- Professional summary.
- Skills và qualifications.
- Work experience.
- Projects.
- Education.
- Certifications.
- Languages.
- Declared experience claims.
- Candidate preferences thuộc CV.
- Evidence references.
- Các thông tin có căn cứ chưa ánh xạ được về taxonomy.
- Các claim có ngữ nghĩa mâu thuẫn.

**Claim semantics:**

- Skill được khai báo không mặc nhiên chứng minh số năm kinh nghiệm.
- Một project có sử dụng công nghệ không tự động chứng minh Candidate sử dụng công nghệ đó trong toàn bộ thời gian làm việc.
- Declared experience không tự động trở thành independently verified experience.
- Các claim mâu thuẫn có thể cùng tồn tại trong một profile.
- Information presence không đồng nghĩa với quality assessment.

### Missing / Conflict Semantics

- Field không có dữ liệu → rỗng.
- Field có một claim hợp lệ → ghi nhận claim.
- Field có nhiều claim mâu thuẫn → bảo toàn các claim cùng evidence.
- Field có thông tin chưa ánh xạ được → bảo toàn thông tin nguồn nếu có căn cứ.
- Không tạo giá trị mặc định mang ý nghĩa nghề nghiệp khi nguồn không cung cấp.

Canonical profile không phải kết luận Candidate phù hợp với Job nào.

# 8. Scoring / Ranking Policy Boundary

AI-V01 không bổ sung scoring hoặc ranking capability.

Version không được:

- Tính match score.
- Đánh giá Candidate đáp ứng hoặc không đáp ứng Job requirement.
- Xếp hạng Candidate hoặc Job.
- Tự áp dụng scoring weights.
- Tạo kết luận chất lượng tổng thể của Candidate.
- Tạo recommendation dựa trên mức độ phù hợp.

Các canonical profile chỉ cung cấp thông tin đầu vào.

Chính sách matching/scoring, bao gồm cách tính điểm khi dữ liệu thiếu hoặc mâu thuẫn, thuộc AI version sau.

# 9. Evidence, Unknown & Reliability Rules

## 9.1. Evidence

Một claim được ghi nhận phải có nguồn hợp lệ hỗ trợ.

Ví dụ:

- CV khai báo Node.js → được ghi nhận Candidate khai báo Node.js.
- CV nêu sử dụng Node.js trong project → được ghi nhận evidence từ project.
- Job mô tả yêu cầu 3 năm kinh nghiệm → được ghi nhận yêu cầu 3 năm.
- CV chỉ liệt kê Node.js → không được tự khẳng định có 3 năm kinh nghiệm Node.js.

Khi nhiều nguồn hỗ trợ cùng một claim, việc hợp nhất không được làm mất nguồn evidence có giá trị.

## 9.2. Unknown khác mismatch

Không có dữ liệu không đồng nghĩa với Candidate không đáp ứng requirement.

AI-V01 không tự tạo kết luận mismatch.

Nếu một thuộc tính không được nguồn cung cấp, field tương ứng được để rỗng.

Không bắt buộc tạo một giá trị `UNKNOWN` riêng cho mọi field bị thiếu.

## 9.3. Uncertainty

Các trường hợp uncertainty bao gồm:

- Thông tin mơ hồ.
- Claim thiếu căn cứ định lượng.
- Các nguồn có nội dung không thống nhất.
- Thông tin không thể ánh xạ chính xác về taxonomy.

AI-V01 được phép bảo toàn thông tin chưa chắc chắn hoặc mâu thuẫn mà không chặn toàn bộ profile.

Khi có nhiều claim mâu thuẫn, không được biến chúng thành một fact chắc chắn duy nhất nếu không có quy tắc business đã được phê duyệt.

## 9.4. Hallucination

AI-V01 không được tự tạo:

- Skills không có nguồn.
- Work experience không có nguồn.
- Số năm kinh nghiệm suy đoán.
- Education hoặc certifications không có căn cứ.
- Job requirements không được Job thể hiện.
- Employment metadata không có căn cứ.
- Candidate hoặc Company facts không thuộc nguồn hợp lệ.

Việc chấp nhận sai lệch ngữ nghĩa có giới hạn không cho phép AI bịa dữ liệu.

## 9.5. Consistency

- Canonical information phải truy nguyên được về nguồn hợp lệ.
- Thông tin tương đương có thể được hợp nhất.
- Các claim mâu thuẫn không phải được ép thành một fact duy nhất.
- REQUIRED được ưu tiên OPTIONAL khi cùng áp dụng cho một requirement.
- Field thiếu phải giữ ngữ nghĩa không có dữ liệu.
- Profile có dữ liệu thiếu hoặc mâu thuẫn vẫn có thể READY.
- Evidence và các claim đã bảo toàn không được diễn giải thành kết luận matching trong V01.

# 10. Functional Requirements

## F01 — Chuẩn hóa Job thành JobMatchProfile

### Actor

JOBHUB System.

### Mục tiêu

Chuẩn hóa dữ liệu Job thành `JobMatchProfile` phục vụ các AI capability tiếp theo.

### Input business

- Một Job hợp lệ.
- Structured Job metadata.
- Job Description và các nội dung nghề nghiệp liên quan khi có.

### Tiền điều kiện

- Job input thuộc phạm vi được phép sử dụng.
- Dữ liệu đầu vào đáp ứng các điều kiện hợp lệ của nguồn JOBHUB.

Không đặt yêu cầu Job phải có một số lượng tối thiểu các field nghề nghiệp mới được chuẩn hóa.

### Luồng chính

1. Hệ thống tiếp nhận một Job.
2. Xác định structured metadata và các nội dung nghề nghiệp được cung cấp.
3. AI hỗ trợ trích xuất thông tin có căn cứ từ free-text content.
4. Hệ thống hợp nhất thông tin trích xuất với dữ liệu nguồn theo Business Rules.
5. Các thông tin tương đương được chuẩn hóa và bảo toàn evidence.
6. Các claim mâu thuẫn được giữ lại khi không có quy tắc ưu tiên cụ thể.
7. Nếu cùng requirement có REQUIRED và OPTIONAL, hệ thống ưu tiên REQUIRED.
8. Những field không có thông tin được để rỗng.
9. Hệ thống tạo `JobMatchProfile` hợp lệ và trả kết quả xử lý.

### Kết quả

- Có một `JobMatchProfile` tương ứng với Job đầu vào.
- Dữ liệu được chuẩn hóa theo canonical semantics.
- Các thông tin có căn cứ được bảo toàn.
- Các field thiếu được để rỗng.
- Các conflict không tự động khiến profile thất bại.
- Kết quả READY nếu quá trình chuẩn hóa hoàn tất hợp lệ.

### Failure / Unknown behavior

- Thiếu field → để rỗng.
- Priority không xác định → không tự tạo priority.
- Claim mâu thuẫn → giữ các claim cùng nguồn.
- REQUIRED và OPTIONAL của cùng requirement → ưu tiên REQUIRED.
- Không có dữ liệu nghề nghiệp đáng kể → vẫn có thể READY nếu canonical output hợp lệ.
- Không thể hoàn thành chuẩn hóa → FAILED.

### Trường hợp từ chối

- Input không thuộc Job hợp lệ trong phạm vi xử lý.
- Việc sử dụng Job vi phạm authorization hoặc visibility rule.
- Input không đáp ứng điều kiện hợp lệ thiết yếu của nguồn.

### Business Rules liên quan

`BR-AI-01`, `BR-AI-02`, `BR-AI-03`, `BR-AI-04`, `BR-AI-06`, `BR-AI-07`, `BR-AI-08`, `BR-AI-09`, `BR-AI-10`, `BR-AI-13`, `BR-AI-14`.

### Không thuộc chức năng này

- Job–CV matching.
- Scoring hoặc ranking.
- Sửa dữ liệu Job gốc.
- Quyết định tuyển dụng.

---

## F02 — Chuẩn hóa Generated CV thành CVMatchProfile

### Actor

JOBHUB System; Candidate là chủ thể sở hữu CV.

### Mục tiêu

Chuẩn hóa Generated CV thành `CVMatchProfile`, bảo toàn các claim nghề nghiệp và evidence có trong dữ liệu nguồn.

### Input business

- Một Generated CV hợp lệ.
- Structured CV metadata.
- Skills, experience, projects, education, languages, certifications và các thông tin nghề nghiệp liên quan khi có.

### Tiền điều kiện

- CV input thuộc phạm vi Generated CV.
- Việc sử dụng CV đáp ứng authorization và ownership.
- Dữ liệu đầu vào đáp ứng điều kiện hợp lệ của nguồn JOBHUB.

Không đặt yêu cầu CV phải có số lượng skills, experience, projects hoặc qualifications tối thiểu.

### Luồng chính

1. Hệ thống tiếp nhận một Generated CV.
2. Xác định structured metadata và nội dung nghề nghiệp.
3. AI hỗ trợ trích xuất những thông tin cần hiểu ngữ nghĩa.
4. Hệ thống hợp nhất thông tin trích xuất với dữ liệu nguồn.
5. Các thông tin tương đương được chuẩn hóa và bảo toàn evidence.
6. Các claim kinh nghiệm và qualification được bảo toàn theo mức căn cứ của nguồn.
7. Các claim mâu thuẫn được giữ lại cùng nguồn tương ứng.
8. Thông tin có căn cứ nhưng chưa ánh xạ được về taxonomy được bảo toàn.
9. Những field thiếu được để rỗng.
10. Hệ thống tạo `CVMatchProfile` hợp lệ và trả kết quả xử lý.

### Kết quả

- Có một `CVMatchProfile` tương ứng với Generated CV đầu vào.
- Dữ liệu nghề nghiệp được chuẩn hóa theo canonical semantics.
- Evidence và declared claims được bảo toàn.
- Không tự bổ sung experience hoặc qualifications không có nguồn.
- Field thiếu được để rỗng.
- Conflict không tự động làm profile thất bại.
- Kết quả READY nếu quá trình chuẩn hóa hoàn tất hợp lệ.

### Failure / Unknown behavior

- Không có skill → field tương ứng rỗng.
- Không có experience → field tương ứng rỗng.
- Không có education hoặc qualifications → field tương ứng rỗng.
- Claim không đủ căn cứ định lượng → không tự gán số liệu.
- Nhiều claim mâu thuẫn → bảo toàn từng claim và nguồn.
- Không ánh xạ được một claim có căn cứ → bảo toàn thông tin nguồn.
- Không thể hoàn thành chuẩn hóa → FAILED.

### Trường hợp từ chối

- Input không phải Generated CV hợp lệ.
- CV không thuộc phạm vi được phép sử dụng.
- Việc sử dụng CV vi phạm authorization/ownership.
- Input không đáp ứng điều kiện hợp lệ thiết yếu của nguồn.

### Business Rules liên quan

`BR-AI-01`, `BR-AI-02`, `BR-AI-03`, `BR-AI-04`, `BR-AI-05`, `BR-AI-06`, `BR-AI-07`, `BR-AI-10`, `BR-AI-11`, `BR-AI-12`, `BR-AI-13`, `BR-AI-14`.

### Không thuộc chức năng này

- Uploaded CV/PDF processing.
- CV–Job matching/scoring.
- Tư vấn hoặc tự động chỉnh sửa CV.
- Tạo hoặc publish Candidate CV mới.
- Xác minh độc lập các claim ngoài đời thực.

# 11. AI Business Rules

## BR-AI-01 — Evidence trước canonical claim

Một claim được ghi nhận trong canonical profile phải có căn cứ từ nguồn hợp lệ.

Mức độ khẳng định của claim không được vượt quá evidence.

## BR-AI-02 — AI output không tự trở thành business truth

AI-extracted information không tự động trở thành canonical fact.

Thông tin được sử dụng sau khi áp dụng các quy tắc chuẩn hóa và hợp nhất đã phê duyệt.

## BR-AI-03 — Missing data không đồng nghĩa với mismatch

Khi nguồn không cung cấp một thông tin nghề nghiệp, field tương ứng được để rỗng.

Không suy diễn việc thiếu thông tin thành Candidate không có năng lực hoặc không đáp ứng Job.

Không đặt minimum completeness threshold cho Job/CV profile trong V01.

## BR-AI-04 — AI-V01 không đánh giá matching hoặc tuyển dụng

V01 không tính match score, không phân loại Candidate phù hợp/không phù hợp với Job và không thay Employer đưa ra quyết định tuyển dụng.

## BR-AI-05 — Không tạo Candidate fact không có căn cứ

Không được tự tạo skills, experience, education, certifications, language proficiency hoặc các qualification không được nguồn hỗ trợ.

Declared claims có thể được bảo toàn mà không cần xác minh độc lập, nhưng phải giữ đúng bản chất là thông tin nguồn khai báo.

## BR-AI-06 — Authorization và ownership không bị vượt qua

AI capability không tạo đường truy cập hoặc quyền sử dụng resource mới.

Các quy tắc authorization, ownership, Job visibility và tenant isolation hiện có tiếp tục được áp dụng.

## BR-AI-07 — Không âm thầm làm mất thông tin có căn cứ

Những thông tin nghề nghiệp hợp lệ thuộc phạm vi profile phải được xem xét và bảo toàn ngữ nghĩa.

Thông tin chưa có mapping phù hợp không được bị ép sang một giá trị sai chỉ để hoàn thiện canonical object.

Thông tin có thể được chuẩn hóa hoặc bảo toàn dưới dạng claim/nội dung bổ sung phù hợp.

## BR-AI-08 — Structured metadata và bổ sung thông tin Job

Structured Job metadata hợp lệ được bảo toàn, không bị AI inference âm thầm ghi đè.

Job Description có thể cung cấp thông tin bổ sung cho `workModes` và `employmentType` khi metadata tương ứng thiếu/trống, nội dung thể hiện rõ và có mapping hợp lệ vào miền giá trị của JOBHUB.

Khi có mâu thuẫn với metadata hiện có, bảo toàn thông tin nguồn thay vì âm thầm thay đổi canonical metadata.

Không coi conflict là lý do tự động từ chối chuẩn hóa.

## BR-AI-09 — REQUIRED được ưu tiên OPTIONAL

Job requirement được phân loại theo nội dung nguồn khi có căn cứ.

Nếu cùng một requirement được xác định đồng thời là REQUIRED và OPTIONAL, kết quả ưu tiên REQUIRED.

Không chuyển nội dung chỉ mang tính bối cảnh thành requirement bắt buộc.

Nếu không xác định được priority, không tự suy diễn. Thông tin nguồn vẫn được bảo toàn khi có giá trị.

Priority ambiguity không tự động khiến profile thất bại.

## BR-AI-10 — Consolidation phải bảo toàn evidence

Thông tin tương đương có thể được hợp nhất hoặc chuẩn hóa tên gọi.

Quá trình hợp nhất phải giữ các nguồn evidence có giá trị.

Không tạo thông tin mới chỉ từ việc kết hợp nhiều claim không đủ căn cứ.

## BR-AI-11 — Declared experience khác verified experience

Claim về kinh nghiệm phải được bảo toàn đúng mức căn cứ của nguồn.

Không mặc định suy ra số năm sử dụng một kỹ năng chỉ vì kỹ năng xuất hiện trong một vị trí công việc hoặc project.

Không tự nâng declared experience thành independently verified experience.

Các claim khác nhau về thời lượng kinh nghiệm được phép cùng tồn tại nếu nguồn cung cấp như vậy.

## BR-AI-12 — Bảo toàn thông tin không ánh xạ được

Thông tin có căn cứ nhưng không ánh xạ được về taxonomy phải được bảo toàn theo ngữ nghĩa nguồn.

Áp dụng với các trường hợp như:

- Language proficiency chi tiết, bao gồm B2 hoặc các mức không ánh xạ được.
- Career-related claims chưa có giá trị canonical tương ứng.
- Nội dung nghề nghiệp bổ sung có evidence.
- Thông tin CV được phân biệt về presentation, bao gồm hidden sections.

Hidden sections không được mặc định diễn giải là Candidate không sở hữu dữ liệu hoặc năng lực tương ứng.

## BR-AI-13 — Bảo toàn các claim mâu thuẫn

Khi nhiều nguồn cung cấp thông tin mâu thuẫn, V01 không tự chọn một claim làm sự thật duy nhất nếu không có quy tắc ưu tiên đã được phê duyệt.

Các claim được bảo toàn cùng nguồn tương ứng để capability sau có thể sử dụng.

Conflict không tự động khiến canonical profile thất bại.

Riêng requirement priority REQUIRED/OPTIONAL áp dụng `BR-AI-09`.

## BR-AI-14 — READY và FAILED

AI-V01 chỉ xác định hai kết quả xử lý:

- **READY:** Quá trình chuẩn hóa hoàn tất và canonical output hợp lệ.
- **FAILED:** Quá trình xử lý không hoàn tất thành công hoặc không thể tạo canonical output hợp lệ.

READY vẫn được áp dụng khi profile có:

- Field rỗng.
- Dữ liệu nghề nghiệp ít.
- Claim mâu thuẫn.
- Thông tin chưa ánh xạ được.
- Uncertainty được bảo toàn.

Không tồn tại trạng thái BLOCKED trong V01.

Input bị từ chối vì không hợp lệ hoặc không được phép sử dụng được xử lý theo quy tắc JOBHUB, không phải một kết quả đánh giá chất lượng profile.

# 12. Agent / Side-effect Boundary

AI-V01 không cấp quyền mutation cho AI.

Version không cho phép AI:

- Tạo hoặc sửa Job gốc.
- Sửa Generated CV gốc.
- Tạo hoặc sửa Candidate CV Draft.
- Publish CV.
- Apply Job.
- Thực hiện action thay Candidate hoặc Employer.
- Thay đổi quyền sở hữu hoặc quyền truy cập resource.

Việc tạo canonical profile không làm phát sinh quyền thay đổi business resource nguồn.

# 13. Resource Lifecycle & State Transitions

AI-V01 không bổ sung persisted business resource lifecycle mới.

Mỗi lần xử lý sử dụng một đầu vào Job hoặc Generated CV và tạo một kết quả canonical profile tương ứng khi thành công.

Không quản lý:

- Nhiều phiên bản của cùng profile.
- Profile revision history.
- Profile freshness.
- Profile invalidation.
- Reprocessing lifecycle do nguồn thay đổi.
- Đồng bộ profile với resource nguồn sau khi xử lý.

### Kết quả xử lý

| Kết quả | Điều kiện | Ý nghĩa |
|---|---|---|
| READY | Chuẩn hóa hoàn tất, output hợp lệ | Profile có thể được capability tiếp theo sử dụng |
| FAILED | Không hoàn tất được xử lý hợp lệ | Không có canonical profile thành công để sử dụng |

Không có BLOCKED.

Field thiếu hoặc claim mâu thuẫn không tạo thêm trạng thái.

READY/FAILED là semantics của kết quả xử lý, không mặc định yêu cầu một persisted state machine.

Không định nghĩa state transitions cho các resource Job/CV nguồn trong V01.

# 14. Authorization / Ownership / Tenant Boundary

AI-V01 tuân thủ authorization và ownership hiện có của JOBHUB.

- Candidate CV chỉ được sử dụng trong phạm vi quyền hợp lệ.
- AI không được tự truy cập Candidate CV của người dùng khác.
- Job chỉ được sử dụng theo Job visibility và quyền truy cập hiện có.
- Company-private information không tự trở thành nguồn AI context.
- Không phát sinh cross-user hoặc cross-tenant access mới.
- Canonical profile không thay đổi owner của Job hoặc CV.

V01 không bổ sung multi-tenant boundary mới.

# 15. Failure & Fallback Behavior

AI-V01 phân biệt input refusal, kết quả business và technical failure.

## Invalid input

Bao gồm:

- Input không phải loại resource được V01 hỗ trợ.
- Resource không hợp lệ theo quy định JOBHUB.
- Actor không có quyền sử dụng resource.

**Expected behavior:** Từ chối xử lý input không hợp lệ, không tạo canonical profile giả.

## Extraction failure

Không thể hoàn thành việc trích xuất thông tin cần thiết do sự cố xử lý.

**Expected behavior:** FAILED nếu không thể tạo canonical output hợp lệ.

Thiếu một field nghề nghiệp trong nguồn không phải extraction failure.

## AI processing failure

Không thể hoàn tất quá trình xử lý AI hoặc không thể tạo thông tin cần thiết dưới dạng hợp lệ.

**Expected behavior:** FAILED nếu toàn bộ quá trình chuẩn hóa không thể hoàn thành hợp lệ.

## Dependency failure

Một dependency cần thiết không khả dụng khiến quá trình chuẩn hóa không hoàn thành.

**Expected behavior:** FAILED, không trả một kết quả chuẩn hóa giả.

## Insufficient evidence

Nguồn không có đủ evidence cho một claim cụ thể.

**Expected behavior:**

- Không tạo claim không có căn cứ.
- Để field tương ứng rỗng nếu không có dữ liệu.
- Bảo toàn uncertainty khi có claim nhưng mức căn cứ chưa đầy đủ.
- Không tự động FAILED.
- Không tạo BLOCKED.

Một profile có thể READY dù chứa rất ít thông tin nghề nghiệp.

**Nguyên tắc:**

Missing information không đồng nghĩa với processing failure.

Conflicting claims không đồng nghĩa với processing failure.

Technical failure không được chuyển thành negative business assessment.

V01 không định nghĩa provider-specific fallback policy tại Product Spec.

# 16. AI Quality & Evaluation

AI-V01 được đánh giá theo khả năng chuẩn hóa dữ liệu và bảo toàn thông tin nguồn.

Các quality dimension áp dụng:

- Extraction correctness.
- Evidence alignment.
- Factuality.
- Canonical normalization consistency.
- Source information preservation.
- Required/optional classification.
- Missing-information handling.
- Conflict preservation.
- Hallucination prevention.
- Output semantics consistency.

V01 không đánh giá matching quality, ranking relevance hoặc recommendation usefulness.

## 16.1. Representative cases

Các nhóm case cần được kiểm chứng:

1. Job có đầy đủ structured metadata.
2. Job thiếu một hoặc nhiều metadata.
3. Job Description có thông tin bổ sung cho metadata trống.
4. Job Description mâu thuẫn với structured metadata.
5. Cùng Job requirement xuất hiện ở REQUIRED và OPTIONAL.
6. Requirement không thể xác định priority.
7. Job không có đủ thông tin nghề nghiệp chi tiết.
8. Generated CV có đầy đủ thông tin.
9. Generated CV thiếu skills, experience hoặc education.
10. Generated CV gần như không có dữ liệu nghề nghiệp.
11. CV có nhiều claim kinh nghiệm mâu thuẫn.
12. CV khai báo skill nhưng không có evidence về thời lượng sử dụng.
13. CV có language proficiency không ánh xạ được.
14. CV có hidden sections.
15. CV có thông tin nghề nghiệp có căn cứ nhưng không có mapping canonical.
16. Input không hợp lệ hoặc không được phép truy cập.
17. AI processing hoặc dependency failure.

## 16.2. Acceptance

AI-V01 đáp ứng yêu cầu business quality khi:

- F01/F02 tạo canonical profile hợp lệ với input được hỗ trợ.
- Field thiếu được để rỗng mà không tạo dữ liệu giả.
- Không có minimum information threshold được áp đặt ngoài điều kiện hợp lệ của nguồn và output.
- Các claim mâu thuẫn được bảo toàn đúng evidence.
- REQUIRED được ưu tiên OPTIONAL cho cùng requirement.
- Structured metadata không bị ghi đè trái quy tắc.
- Dữ liệu có căn cứ không bị âm thầm làm mất.
- Không có fabricated Candidate/Job facts.
- READY/FAILED được sử dụng đúng semantics.
- Không có BLOCKED hoặc trạng thái chặn do thiếu dữ liệu/mâu thuẫn.
- Authorization/ownership tiếp tục được tuân thủ.

Nếu một Evaluation Contract riêng xác định phép đo và threshold định lượng, các phép đo đó không được thay đổi business behavior đã xác lập tại Product Spec.

# 17. Lifecycle Invariants

1. Một lần xử lý Job hoặc Generated CV chỉ tạo một kết quả canonical profile tương ứng khi thành công.
2. AI output không tự động trở thành business truth.
3. Không tạo Job/Candidate fact không có căn cứ.
4. Missing data không được tự động diễn giải thành mismatch.
5. Field không có dữ liệu phải được để rỗng.
6. Không yêu cầu minimum completeness threshold đối với dữ liệu nghề nghiệp.
7. Các claim có căn cứ nhưng mâu thuẫn được phép cùng tồn tại.
8. Conflict không tự động chặn chuẩn hóa.
9. REQUIRED được ưu tiên OPTIONAL khi cùng áp dụng cho một Job requirement.
10. Structured metadata hợp lệ không bị âm thầm ghi đè.
11. Evidence có giá trị không bị mất ngoài ý muốn.
12. Thông tin không ánh xạ được không bị ép sang giá trị sai.
13. READY chỉ có nghĩa quá trình chuẩn hóa thành công, không phải Candidate/Job có chất lượng cao.
14. FAILED không được biến thành negative business assessment.
15. Không có BLOCKED.
16. Không tự thay đổi Job/CV nguồn.
17. Không bypass authorization, ownership hoặc tenant boundary.
18. Không thực hiện matching, scoring hoặc ranking trong V01.
19. Không xử lý Uploaded CV source trong V01.
20. Không quản lý profile versioning, freshness hoặc invalidation trong V01.

# 18. Các quyết định chủ động defer

Các capability sau được chủ động chuyển ra ngoài AI-V01:

- Toàn bộ Uploaded CV ingestion và source processing.
- PDF text extraction, OCR và các workflow tài liệu liên quan.
- Chuẩn hóa Uploaded CV source thành `CVMatchProfile`.
- CV–Job matching và scoring.
- Matching explanation.
- Job recommendation/ranking.
- Chatbot tư vấn chỉnh sửa CV.
- Agent tạo/sửa CV Draft.
- Autonomous business actions.
- Profile lifecycle versioning.
- Profile freshness/invalidation.
- Các yêu cầu đồng bộ hoặc tự động làm mới canonical profile.

Các capability này chỉ được triển khai khi có scope và business authority phù hợp ở version sau.

# 19. Các quyết định chưa chốt

Không còn business decision chưa chốt ảnh hưởng đến behavior của AI-V01 trong phạm vi đã xác lập.

Các nguyên tắc đã được quyết định:

- Uploaded CV source không thuộc V01.
- Không yêu cầu minimum information completeness.
- Field thiếu được để rỗng.
- Không quản lý profile versioning/freshness.
- Chỉ có READY và FAILED.
- Không có BLOCKED.
- Claim mâu thuẫn được bảo toàn thay vì chặn profile.
- REQUIRED được ưu tiên OPTIONAL cho cùng requirement.
- Không thay đổi các requirement ID đã tồn tại.

Việc đối chiếu và bảo toàn ID với repository là công việc quản lý tài liệu, không phải một business decision mới.

Các quyết định về data representation, kỹ thuật xử lý hoặc scoring của version sau không được tự đưa vào V01.

# 20. Definition of AI Business Completion

AI-V01 được coi là hoàn thành về mặt business khi:

- F01 và F02 được đáp ứng.
- Các Business Rules `BR-AI-01` đến `BR-AI-14` được đáp ứng.
- Job và Generated CV có thể tạo canonical profile hợp lệ theo scope.
- Input/trust boundary được giữ.
- AI/human authority boundary được giữ.
- Canonical output semantics đúng với Product Spec.
- Field thiếu, conflict và uncertainty được xử lý đúng.
- Evidence được bảo toàn.
- Không có hallucinated Candidate/Job facts được chấp nhận.
- REQUIRED/OPTIONAL priority tuân thủ business rule.
- READY/FAILED tuân thủ semantics đã chốt.
- Không phát sinh BLOCKED hoặc completeness gate ngoài phạm vi.
- Không có side effect trái phép.
- Authorization/ownership được giữ.
- Các representative cases và AI quality acceptance đạt yêu cầu.
- Những capability đã defer không bị triển khai như behavior của V01.

Các điều sau không tự chứng minh Business Completion:

- Có thể tạo một object đúng cấu trúc.
- AI trả về kết quả.
- Một vài dữ liệu mẫu chạy thành công.
- Một số kiểm thử kỹ thuật thành công.
- Có thể biểu diễn Job/CV nhưng làm mất evidence hoặc diễn giải sai business semantics.

# 21. Implementation Boundary

Tài liệu này là **CANONICAL AI PRODUCT SPECIFICATION** của AI-V01.

Nó xác lập:

- **WHAT:** Capability phải làm gì.
- **WHAT NOT:** Capability không được làm gì.
- **INPUT:** Nguồn thông tin được phép sử dụng.
- **OUTPUT:** Kết quả chuẩn hóa có ý nghĩa gì.
- **RULES:** Quy tắc business nào phải được tuân thủ.
- **QUALITY:** Những điều kiện nào chứng minh capability đúng về nghiệp vụ.

Tài liệu không xác lập:

- LLM provider hoặc model.
- Prompt, temperature hoặc token configuration.
- Structured-output JSON schema.
- Data persistence schema.
- API/HTTP contract.
- Controller/service/route.
- Matching/scoring algorithm.
- Retrieval hoặc ranking algorithm.
- Vector database.
- Document extraction implementation.
- Queue, cache hoặc cơ chế background processing.
- Database implementation.
- AI Kit source structure.
- Frontend implementation.
- Test framework.

**Canonical hierarchy:**

```text
AI Product Specification
          |
          | Business / Capability Truth
          v
AI Data Contract
          |
          | Data / Persistence Truth
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

Không phải AI version nào cũng cần toàn bộ Engineering Contracts.

**Authority:**

- Approved AI Product Specification là authority đối với business behavior.
- Approved AI Data Contract là authority đối với data/persistence semantics.
- Approved AI Engineering Contracts là authority đối với architecture/algorithm.
- Source code, tests và evaluations là implementation evidence.

Nếu implementation, AI extraction behavior hoặc consolidation behavior mâu thuẫn với Product Specification:

- Implementation phải được điều chỉnh để tuân thủ Product Specification; hoặc
- Product Specification phải được con người chủ động cập nhật và phê duyệt lại.

AI-V01 Product Specification không tự mở rộng quyền quyết định sang AI Data Contract hoặc các version AI tiếp theo.
