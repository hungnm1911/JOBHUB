# AI-V01 — Deterministic Input Normalization cho Job/Generated CV

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

Hai profile là nền tảng dữ liệu đầu vào chung cho các AI capability sau, không giới hạn ở CV–Job Matching. Tên `JobMatchProfile` và `CVMatchProfile` được giữ để bảo toàn định danh hiện có; chúng không mang semantics đánh giá matching.

AI-V01 thực hiện deterministic input normalization: cùng input và cùng quy tắc chuẩn hóa phải cho cùng kết quả dữ liệu. V01 không sử dụng LLM extraction, không diễn giải ngữ nghĩa free text để tạo claim, phân loại requirement hoặc điền structured field còn thiếu. Structured data, free text và provenance được bảo toàn từ nguồn hợp lệ theo các Business Rules đã phê duyệt.

Định hướng này được Product Owner phê duyệt, thay thế semantics LLM extraction/consolidation trước đây của AI-V01. Nó không phê duyệt thêm capability AI #1/#2/#3 hoặc thay đổi authority của nguồn.

Khi hoàn thành V01, hệ thống phải có khả năng:

- Chuẩn hóa dữ liệu Job thành `JobMatchProfile`.
- Chuẩn hóa Generated CV thành `CVMatchProfile`.
- Bảo toàn thông tin nghề nghiệp và evidence có trong nguồn hợp lệ.
- Xử lý dữ liệu thiếu bằng cách để trống các field tương ứng.
- Bảo toàn các claim mâu thuẫn mà không từ chối chuẩn hóa chỉ vì mâu thuẫn.
- Bảo toàn requirement và priority đã được nguồn cung cấp tường minh; không suy diễn priority từ free text.
- Cung cấp kết quả chuẩn hóa có ngữ nghĩa nhất quán cho các version AI tiếp theo.

AI-V01 không thực hiện matching, scoring, ranking hoặc đánh giá chất lượng Candidate.

# 2. Phạm vi

## 2.1. Trong phạm vi

- Chuẩn hóa deterministic dữ liệu một Job hoặc một Generated CV hợp lệ.
- Bảo toàn structured metadata và structured content theo semantics nguồn JOBHUB.
- Bảo toàn nguyên nội dung free text trong phạm vi nghề nghiệp được phép, gắn với nguồn tương ứng.
- Sử dụng taxonomy/controlled metadata hiện có khi nguồn đã cung cấp giá trị hoặc định danh tương ứng; không tự thiết lập taxonomy hay mapping ngữ nghĩa mới.
- Bảo toàn provenance của structured data, free text và các claim nguồn khai báo.
- Chỉ hợp nhất khi tính đồng nhất đã được xác định từ dữ liệu có cấu trúc hoặc quy tắc deterministic được phê duyệt; không suy đoán các cách diễn đạt là tương đương.
- Bảo toàn dữ liệu chưa ánh xạ được, các giá trị khác nhau, mơ hồ hoặc mâu thuẫn; không bắt buộc phát hiện hay phân loại conflict trong free text.
- Bảo toàn requirement priority tường minh và áp dụng REQUIRED-over-OPTIONAL trong phạm vi `BR-AI-09`.
- Để rỗng structured field không được nguồn cung cấp; không dùng free text để lấp field trống.
- Trả về một profile runtime-only tương ứng với một đầu vào khi thành công, phân biệt READY và FAILED.

## 2.2. Ngoài phạm vi

- LLM extraction, semantic enrichment hoặc suy diễn structured claims từ free text.
- Tự nhận diện requirement, priority, skill, thời lượng kinh nghiệm hoặc conflict bằng cách diễn giải free text.
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
| Deterministic input normalization | Chuẩn hóa đầu vào theo quy tắc xác định, không dùng LLM hoặc suy diễn ngữ nghĩa free text |
| Generated CV | CV được biểu diễn bằng dữ liệu có cấu trúc trong JOBHUB |
| JobMatchProfile | Biểu diễn chuẩn của một Job phục vụ các capability AI tiếp theo |
| CVMatchProfile | Biểu diễn chuẩn của một Candidate CV phục vụ các capability AI tiếp theo |
| Canonical Data | Biểu diễn đầu vào thống nhất theo quy tắc V01; không thay thế canonical Job/CandidateCV source |
| Evidence | Thông tin nguồn hỗ trợ một claim |
| Declared Claim | Thông tin được khai báo trong dữ liệu Job/CV |
| Unknown | Thông tin chưa xác định được từ nguồn được phép |
| Uncertainty | Mức thiếu chắc chắn của thông tin được ghi nhận |
| Conflict | Hai hoặc nhiều claim có ngữ nghĩa mâu thuẫn |
| Consolidation | Hợp nhất deterministic dữ liệu có căn cứ đồng nhất tường minh, bảo toàn các nguồn; không semantic extraction |
| Free text | Nội dung văn bản nguồn được giữ để capability sau sử dụng, không tự trở thành structured claim |
| Provenance | Khả năng truy nguyên dữ liệu/claim/nội dung về source và vị trí hoặc thành phần nguồn tương ứng |
| READY | Kết quả chuẩn hóa thành công và có cấu trúc canonical hợp lệ |
| FAILED | Quá trình chuẩn hóa không hoàn tất thành công |

**Actors:**

- **JOBHUB System:** Thực hiện nghiệp vụ chuẩn hóa Job/CV.
- **Candidate:** Chủ thể sở hữu Candidate CV và hưởng lợi từ các capability sử dụng `CVMatchProfile`.
- **Employer:** Chủ thể cung cấp thông tin Job trong phạm vi nghiệp vụ JOBHUB.
- V01 không có actor LLM tham gia normalization; JOBHUB System không xác minh sự thật ngoài đời từ dữ liệu nguồn.

# 5. AI Capability & Human Decision Boundary

| Hành động / quyết định | AI-V01 | Authority |
|---|---|---|
| Chuẩn hóa structured data theo semantics nguồn | Deterministic | JOBHUB source contracts và Business Rules V01 |
| Bảo toàn free text và provenance | Có | Nguồn Job/Generated CV hợp lệ |
| Dùng LLM hiểu, trích xuất hoặc phân loại nội dung | Không | Ngoài phạm vi V01 |
| Điền metadata còn thiếu bằng diễn giải free text | Không | Ngoài phạm vi V01 |
| Tự xác minh Candidate claim ngoài đời thực | Không | Không thuộc V01 |
| Tự sửa dữ liệu Job/CV gốc | Không | Workflow JOBHUB hiện có |
| Tự công bố hoặc publish CV | Không | Candidate theo quyền hiện có |
| Chấm điểm mức độ phù hợp | Không | AI version sau |
| Quyết định tuyển dụng | Không | Employer |

Profile chứa dữ liệu nguồn và declared claims, không xác nhận chúng là sự thật độc lập. Dữ liệu thiếu, mơ hồ hoặc mâu thuẫn được bảo toàn mà không tự chặn chuẩn hóa. Việc diễn giải ngữ nghĩa nội dung được để cho capability sau có authority phù hợp; V01 không xác lập behavior của capability đó.

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
| Free text được bảo toàn | Nội dung nguồn, chưa được V01 diễn giải thành structured claim |
| Canonical profile | Kết quả chuẩn hóa, không phải xác minh sự thật ngoài đời |

Các nguyên tắc:

1. Structured metadata và structured content hợp lệ được bảo toàn theo semantics nguồn.
2. Free text giữ nội dung và provenance; không ghi đè hoặc bổ sung structured field bằng diễn giải văn bản.
3. Giá trị/taxonomy có cấu trúc chỉ được chuẩn hóa theo quy tắc xác định đã được phê duyệt.
4. Các giá trị khác nhau hoặc mâu thuẫn được bảo toàn cùng nguồn; không cần semantic conflict detection trên free text.
5. REQUIRED-over-OPTIONAL chỉ áp dụng trong điều kiện tường minh của `BR-AI-09`.
6. Không có structured data cho field thì để rỗng, kể cả khi free text có nội dung liên quan.
7. Không tạo claim mới hoặc bịa thông tin để hoàn thiện profile.

Một Candidate claim xuất hiện trong CV có thể được ghi nhận là claim có nguồn, nhưng không mặc nhiên là fact đã được xác minh độc lập.

## 6.3. Data minimization

Chỉ sử dụng dữ liệu cần thiết từ Job/CV thuộc phạm vi xử lý.

Không mặc định sử dụng toàn bộ Candidate account, Company data hoặc dữ liệu người dùng khác.

AI không được tự mở rộng phạm vi input bằng các nguồn không được capability cho phép.

# 7. AI Output Contract & Semantics

AI-V01 tạo một trong hai loại canonical profile tương ứng với đầu vào:

- `JobMatchProfile`
- `CVMatchProfile`

Các profile chứa structured data được chuẩn hóa deterministic, free text được bảo toàn và provenance tương ứng. Provenance phải cho phép đối chiếu cả structured data lẫn free text về source và field/section/item tương ứng; không buộc một JSON Shape hoặc cơ chế pointer cụ thể. Một nội dung chỉ có trong free text vẫn tồn tại dưới dạng nội dung nguồn, không bắt buộc và không được tự chuyển thành structured claim. Các nhóm thông tin dưới đây là semantics dữ liệu khi nguồn cung cấp, không phải JSON Shape hoặc yêu cầu extraction.

Không yêu cầu mọi field nghề nghiệp phải có dữ liệu.

## 7.1. Semantics

### JobMatchProfile

`JobMatchProfile` biểu diễn thông tin Job để các AI capability tiếp theo có thể sử dụng.

Các nhóm thông tin áp dụng khi có dữ liệu:

- Job positioning.
- Job metadata.
- Requirements và priority REQUIRED/OPTIONAL khi nguồn cung cấp tường minh.
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
- Chỉ áp dụng REQUIRED-over-OPTIONAL khi cùng requirement có định danh/quan hệ đồng nhất và priority tường minh trong dữ liệu nguồn theo `BR-AI-09`.
- Không đọc hiểu free text để xác định requirement hoặc priority; chưa có priority tường minh thì giữ nội dung nguồn, không tự gán priority.

Thông tin Job chỉ mang tính mô tả hoặc bối cảnh không tự động trở thành yêu cầu bắt buộc.

### CVMatchProfile

`CVMatchProfile` biểu diễn structured metadata, structured Generated CV content và free text Candidate đã khai báo, bảo toàn ngữ cảnh nguồn. Không trích xuất thêm skills, qualifications, số năm kinh nghiệm hoặc claim khác bằng diễn giải văn bản.

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

- Structured field không được nguồn cung cấp → rỗng; nội dung liên quan chỉ có trong free text vẫn được giữ riêng theo ngữ cảnh nguồn.
- Field có một claim hợp lệ → ghi nhận claim.
- Field có nhiều giá trị/claim mâu thuẫn → bảo toàn cùng evidence; free text được giữ ngay cả khi V01 không nhận diện conflict.
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

- CV khai báo Node.js trong structured skills → giữ declared skill và provenance; nếu chỉ xuất hiện trong free text thì giữ văn bản, không tự tạo structured skill.
- CV nêu sử dụng Node.js trong mô tả project → giữ nguyên nội dung trong ngữ cảnh project và provenance, không tự tạo claim thời lượng hoặc qualification.
- Job mô tả “yêu cầu 3 năm kinh nghiệm” trong free text → giữ nguyên nội dung và nguồn; không tự tạo structured minimum-experience claim.
- Nguồn đã có dữ liệu kinh nghiệm có cấu trúc → bảo toàn giá trị và provenance theo semantics nguồn.
- CV chỉ liệt kê Node.js → không được tự khẳng định có 3 năm kinh nghiệm Node.js.

Khi dữ liệu nguồn tường minh xác định cùng một claim, việc hợp nhất deterministic không được làm mất nguồn evidence có giá trị. Không suy ra claim tương đương từ cách diễn đạt free text.

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

Bảo toàn nội dung nguồn không cho phép normalization diễn giải lại hoặc tạo dữ liệu mới từ free text.

## 9.5. Consistency

- Canonical information phải truy nguyên được về nguồn hợp lệ.
- Chỉ hợp nhất khi tính đồng nhất tường minh từ structured data hoặc quy tắc deterministic đã phê duyệt; giữ mọi provenance liên quan.
- Các claim mâu thuẫn không phải được ép thành một fact duy nhất.
- REQUIRED được ưu tiên OPTIONAL trong điều kiện tường minh của `BR-AI-09`.
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

Không đặt yêu cầu Job phải có một số lượng tối thiểu các field nghề nghiệp mới được chuẩn hóa. Structured skills/requirements được nguồn cung cấp vẫn phải được giữ ngay cả khi Job Description không nhắc lại; không yêu cầu evidence từ free text để chấp nhận dữ liệu có cấu trúc hợp lệ.

### Luồng chính

1. Hệ thống tiếp nhận một Job hợp lệ trong phạm vi được phép.
2. Xác định structured metadata, structured requirements khi có và các nội dung free text nguồn.
3. Chuẩn hóa deterministic structured data theo semantics nguồn và quy tắc đã phê duyệt; không gọi LLM.
4. Bảo toàn free text cùng provenance; không trích xuất requirement hoặc điền metadata từ văn bản.
5. Nếu dữ liệu tường minh đủ điều kiện `BR-AI-09`, áp dụng REQUIRED-over-OPTIONAL và giữ evidence; không tự nhận diện requirement tương đương.
6. Bảo toàn các giá trị khác nhau hoặc mâu thuẫn cùng nguồn; field không có structured data được để rỗng.
7. Tạo một `JobMatchProfile` runtime-only hợp lệ và trả kết quả xử lý.

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
- REQUIRED và OPTIONAL có căn cứ đồng nhất tường minh → ưu tiên REQUIRED theo `BR-AI-09`; free text đơn thuần được bảo toàn mà không tự phân loại.
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

1. Hệ thống tiếp nhận một Generated CV hợp lệ trong phạm vi được phép.
2. Xác định structured metadata, structured content và free text theo section/item nguồn.
3. Chuẩn hóa deterministic dữ liệu có cấu trúc theo semantics nguồn; không gọi LLM.
4. Giữ nội dung free text, declared claims, thứ tự và ngữ cảnh section/item có ý nghĩa, cùng provenance; bảo toàn presentation metadata như hidden sections.
5. Không suy diễn skills, qualifications, số năm kinh nghiệm hoặc taxonomy từ free text.
6. Bảo toàn giá trị/claim khác nhau, thông tin chưa ánh xạ được và nguồn tương ứng, không bắt buộc semantic conflict detection.
7. Field không có structured data được để rỗng.
8. Tạo một `CVMatchProfile` runtime-only hợp lệ và trả kết quả xử lý.

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

## BR-AI-02 — Normalized output không tự trở thành business truth

Profile là biểu diễn deterministic của dữ liệu nguồn, không phải kết quả xác minh độc lập. Free text được bảo toàn không tự trở thành structured fact. V01 không có LLM-extracted information hoặc semantic enrichment stage.

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

## BR-AI-08 — Structured metadata và free text Job

Structured Job metadata hợp lệ được bảo toàn theo semantics nguồn. Field `workModes`, `employmentType` hoặc metadata khác thiếu/trống phải giữ rỗng; không bổ sung từ Job Description bằng LLM hoặc heuristic diễn giải ngữ nghĩa.

Job Description và nội dung nghề nghiệp liên quan được giữ cùng provenance. Khi văn bản khác với metadata, không ghi đè hoặc bỏ nguồn nào; không yêu cầu V01 phát hiện/phân loại mâu thuẫn ngữ nghĩa để bảo toàn dữ liệu. Conflict không tự động khiến normalization thất bại.

## BR-AI-09 — REQUIRED được ưu tiên OPTIONAL khi nguồn tường minh

Chỉ áp dụng khi dữ liệu nguồn có cấu trúc hoặc quy tắc deterministic đã phê duyệt xác định tường minh cùng một requirement và cung cấp cả REQUIRED lẫn OPTIONAL. Khi đó kết quả ưu tiên REQUIRED nhưng giữ các nguồn/priority ban đầu để truy nguyên.

V01 không dùng LLM hoặc heuristic diễn giải free text để nhận diện requirement, quyết định hai câu tương đương hay phân loại priority. Không tạo taxonomy/mapping/priority rule mới. Khi nguồn chỉ có văn bản hoặc chưa có priority tường minh, bảo toàn nội dung và provenance; không tự gán priority và không tự động FAILED.

## BR-AI-10 — Consolidation phải bảo toàn evidence

Chỉ hợp nhất dữ liệu có tính đồng nhất tường minh hoặc chuẩn hóa theo quy tắc deterministic đã phê duyệt. Không tự thiết lập quan hệ tương đương, alias hoặc mapping ngữ nghĩa từ free text.

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

Các giá trị/claim và free text được bảo toàn cùng nguồn tương ứng để capability sau có thể sử dụng. V01 không bắt buộc nhận diện hoặc gắn nhãn conflict ngữ nghĩa trong free text.

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

## Normalization failure

Không thể hoàn thành deterministic normalization, bảo toàn dữ liệu/provenance bắt buộc hoặc tạo output hợp lệ.

**Expected behavior:** FAILED, không trả profile giả hoặc âm thầm bỏ dữ liệu để đạt READY.

Structured field thiếu, free text chưa được diễn giải hoặc conflict chưa được phân loại không phải processing failure. Không có LLM extraction/AI processing failure hoặc provider fallback trong luồng V01.

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

V01 không gọi LLM nên không phụ thuộc provider availability hoặc provider fallback để chuẩn hóa. Nền tảng provider/document extraction hiện có của AI Kit không bị thay đổi bởi specification này.

# 16. AI Quality & Evaluation

AI-V01 được đánh giá theo khả năng chuẩn hóa dữ liệu và bảo toàn thông tin nguồn.

Các quality dimension áp dụng:

- Deterministic normalization correctness và tính lặp lại của kết quả với cùng input/quy tắc.
- Bảo toàn structured data, nguyên nội dung free text và provenance.
- Không gọi LLM hoặc suy diễn structured claims từ free text.
- Evidence alignment.
- Factuality.
- Canonical normalization consistency.
- Source information preservation.
- Bảo toàn priority tường minh và áp dụng `BR-AI-09` đúng phạm vi.
- Missing-information handling.
- Conflict preservation.
- Hallucination prevention.
- Output semantics consistency.

V01 không đánh giá matching quality, ranking relevance hoặc recommendation usefulness.

## 16.1. Representative cases

Các nhóm case cần được kiểm chứng:

1. Job có đầy đủ structured metadata.
2. Job thiếu một hoặc nhiều metadata.
3. Job Description có nội dung liên quan metadata trống: metadata vẫn rỗng, free text/provenance được giữ.
4. Job Description khác/mâu thuẫn structured metadata: giữ cả hai nguồn, không ghi đè, không bắt buộc semantic conflict detection.
5. Cùng requirement có định danh/quan hệ đồng nhất và REQUIRED/OPTIONAL tường minh: ưu tiên REQUIRED, giữ provenance cả hai.
6. Requirement/priority chỉ thể hiện trong free text: giữ nội dung, không tự phân loại hoặc suy ra requirement tương đương.
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
17. Normalization hoặc dependency cần thiết thất bại; provider LLM không tham gia luồng.
18. Cùng input/quy tắc cho cùng kết quả dữ liệu; không có claim hoặc mapping mới từ diễn giải văn bản.
19. Structured data và free text có thông tin trùng nhau: không tự semantic deduplication, không mất provenance.

## 16.2. Acceptance

AI-V01 đáp ứng yêu cầu business quality khi:

- F01/F02 tạo profile runtime-only hợp lệ bằng deterministic normalization với input được hỗ trợ; cùng input/quy tắc cho cùng kết quả dữ liệu.
- Structured data, nguyên nội dung free text và provenance được bảo toàn; không LLM extraction hoặc semantic enrichment.
- Nội dung chỉ có trong free text không tự điền structured field hoặc tạo structured claim.
- Field thiếu được để rỗng mà không tạo dữ liệu giả.
- Không có minimum information threshold được áp đặt ngoài điều kiện hợp lệ của nguồn và output.
- Các claim mâu thuẫn được bảo toàn đúng evidence.
- REQUIRED được ưu tiên OPTIONAL chỉ trong điều kiện tường minh của `BR-AI-09`.
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
9. REQUIRED được ưu tiên OPTIONAL chỉ trong điều kiện tường minh của `BR-AI-09`.
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
21. Normalization deterministic, không gọi LLM hoặc suy diễn structured claims từ free text.
22. Structured data, free text và provenance được bảo toàn trong runtime để làm nền tảng chung cho capability sau.

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
- REQUIRED được ưu tiên OPTIONAL chỉ trong điều kiện tường minh của `BR-AI-09`.
- Không thay đổi các requirement ID đã tồn tại.
- Deterministic input normalization, không LLM extraction hoặc semantic enrichment.
- Bảo toàn structured data, free text và provenance trong runtime.
- Không điền structured metadata từ free text; không tự nhận diện requirement/priority/conflict bằng diễn giải văn bản.

Việc đối chiếu và bảo toàn ID với repository là công việc quản lý tài liệu, không phải một business decision mới.

Các quyết định về data representation, kỹ thuật xử lý hoặc scoring của version sau không được tự đưa vào V01.

# 20. Definition of AI Business Completion

AI-V01 được coi là hoàn thành về mặt business khi:

- F01 và F02 được đáp ứng.
- Các Business Rules `BR-AI-01` đến `BR-AI-14` được đáp ứng.
- Job và Generated CV có thể tạo canonical profile hợp lệ theo scope.
- Input/trust boundary được giữ.
- JOBHUB/human authority boundary được giữ.
- Canonical output semantics đúng với Product Spec.
- Field thiếu, conflict và uncertainty được xử lý đúng.
- Evidence được bảo toàn.
- Không có hallucinated Candidate/Job facts được chấp nhận.
- REQUIRED/OPTIONAL priority tuân thủ `BR-AI-09`, không suy diễn priority từ free text.
- Cùng input/quy tắc cho cùng kết quả dữ liệu; không có LLM extraction stage.
- Structured data, nguyên nội dung free text và provenance được bảo toàn cho các capability sau.
- READY/FAILED tuân thủ semantics đã chốt.
- Không phát sinh BLOCKED hoặc completeness gate ngoài phạm vi.
- Không có side effect trái phép.
- Authorization/ownership được giữ.
- Các representative cases và AI quality acceptance đạt yêu cầu.
- Những capability đã defer không bị triển khai như behavior của V01.

Các điều sau không tự chứng minh Business Completion:

- Có thể tạo một object đúng cấu trúc.
- Một LLM trả về kết quả extraction của thiết kế cũ.
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

`ai-kit/v01-contract.json`, contract loader và LLM extraction stage của thiết kế trước đã được retire; chúng không phải Product/Data authority và không tạo yêu cầu tương thích ngược. Specification này không định nghĩa JSON Shape hoặc public API kỹ thuật. [AI Kit Engineering Contracts](../../../engineering/ai-kit-conventions.md#composition-and-backend-integration) xác định factory `createAiKit` expose F01/F02 qua `normalizeJob` và `normalizeGeneratedCv`; runtime shapes do các normalizer owners sở hữu. Bằng chứng kiểm thử extraction cũ không chứng minh hoàn thành deterministic normalization; trạng thái triển khai và acceptance được ghi tại [AI Kit project status](../../../project-status/ai-kit/foundation.md).

Nếu implementation, extraction behavior cũ hoặc consolidation behavior mâu thuẫn với Product Specification:

- Implementation phải được điều chỉnh để tuân thủ Product Specification; hoặc
- Product Specification phải được con người chủ động cập nhật và phê duyệt lại.

AI-V01 Product Specification không tự mở rộng quyền quyết định sang AI Data Contract hoặc các version AI tiếp theo.
