# AI-V02 — Uploaded CV Normalization

> **File:** `docs/product/ai-kit/versions/v02-uploaded-cv-normalization.md`
> **Vai trò:** Canonical AI Product Specification
> **Phase:** JOBHUB AI Phase
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business truth, AI capability boundary và quality requirement cho việc chuyển Uploaded CV thành canonical `CVMatchProfile`.
> **Trạng thái:** `APPROVED`

---

# 1. Mục tiêu

AI-V02 bổ sung khả năng tiếp nhận nội dung Candidate CV được upload dưới dạng PDF và chuyển thành canonical `CVMatchProfile`, phục vụ các AI capability tiếp theo của JOBHUB.

**Actor hưởng lợi:** Candidate sở hữu Uploaded CV hợp lệ.

Khác với Generated CV đã có dữ liệu có cấu trúc, Uploaded CV chứa nội dung tài liệu không có cấu trúc nghiệp vụ được bảo đảm. Hệ thống trích xuất văn bản từ PDF để LLM diễn giải nội dung tài liệu; Backend cung cấp canonical CandidateCV metadata và hệ thống kết hợp hai phần một cách deterministic thành `CVMatchProfile`.

Sau khi AI-V02 hoàn thành, JOBHUB phải có khả năng:

- Tiếp nhận một Uploaded CV hợp lệ trong phạm vi được phép sử dụng.
- Trích xuất nội dung văn bản có sẵn từ tài liệu PDF.
- Diễn giải thông tin nghề nghiệp được thể hiện tường minh trong văn bản.
- Tạo canonical `CVMatchProfile` theo semantics thống nhất với AI-V01.
- Phân biệt dữ liệu có căn cứ, dữ liệu thiếu, mơ hồ và không xác định.
- Trả kết quả xử lý để các AI capability tiếp theo có thể sử dụng.

AI-V02 hoàn thiện một nguồn đầu vào bổ sung cho hệ thống AI, không bổ sung matching, scoring hoặc recommendation.

---

# 2. Phạm vi

## 2.1. Trong phạm vi

- Xử lý Uploaded Candidate CV dưới dạng PDF hợp lệ.
- Trích xuất nội dung văn bản có thể đọc được từ PDF.
- Sử dụng nội dung văn bản làm nguồn cho hoạt động diễn giải ngữ nghĩa.
- Trích xuất thông tin nghề nghiệp được thể hiện tường minh.
- LLM chỉ diễn giải nội dung PDF; kết hợp deterministic với canonical CandidateCV metadata do Backend cung cấp để tạo `CVMatchProfile`, không tạo capability AI trung gian độc lập.
- Tái sử dụng canonical semantics của `CVMatchProfile` từ AI-V01, cho phép khác biệt phù hợp với loại nguồn Uploaded CV.
- Bảo toàn thông tin có căn cứ, thông tin thiếu, không chắc chắn hoặc mâu thuẫn trong phạm vi output contract.
- Phân biệt kết quả xử lý hợp lệ với trường hợp không thể tạo output hợp lệ.
- Thực hiện xử lý khi một AI capability có yêu cầu sử dụng Uploaded CV.
- Chỉ giữ extracted text, kết quả diễn giải và profile trong phạm vi lần xử lý; không lưu hoặc cache để tái sử dụng.

## 2.2. Ngoài phạm vi

- OCR hoặc nhận diện chữ từ PDF chỉ chứa hình ảnh.
- Hỗ trợ các định dạng tài liệu ngoài PDF.
- Tự động diễn giải nội dung PDF ngay khi upload hoặc thay file.
- Persist hoặc cache extracted text, kết quả LLM hay `CVMatchProfile`.
- Suy diễn thêm qualification hoặc Candidate fact không được tài liệu thể hiện.
- Tạo một loại canonical CV profile độc lập với `CVMatchProfile`.
- Thay đổi deterministic normalization của AI-V01.
- CV–Job Matching và Scoring.
- Job recommendation hoặc ranking.
- Chatbot tư vấn chỉnh sửa CV.
- AI Agent tạo hoặc sửa Candidate CV.
- Tự động cập nhật nội dung Candidate CV gốc.
- Xác minh độc lập tính xác thực ngoài đời thực của thông tin trong CV.
- Tự động apply Job hoặc thực hiện quyết định tuyển dụng.

Các capability trên không được bổ sung ngầm khi triển khai AI-V02.

---

# 3. Dependency

## 3.1. Dependency với hệ thống JOBHUB

AI-V02 sử dụng các business concepts và capability đã tồn tại:

- Candidate.
- Candidate CV.
- Uploaded CV.
- Candidate CV ownership.
- Uploaded PDF validation.
- Uploaded CV storage và quyền truy xuất tài liệu.
- Authentication và Authorization.
- Candidate CV lifecycle.
- Các giới hạn và quy tắc hợp lệ của Uploaded CV đã được xác lập trong Backend Product Contract.

AI-V02 không thay đổi:

- Uploaded CV là tài nguyên thuộc Candidate CV hiện có.
- Quyền sở hữu và quyền truy cập CV.
- Quy trình upload, thay thế, preview hoặc download PDF.
- Nội dung PDF gốc.
- Candidate CV lifecycle.
- Các quy tắc hợp lệ của nguồn Uploaded CV.

## 3.2. Dependency với AI version trước

AI-V02 phụ thuộc vào AI-V01 — Job/CV Normalization.

Các khái niệm được tái sử dụng:

- `CVMatchProfile`.
- Canonical normalized input.
- Evidence và provenance.
- Missing information.
- Uncertainty.
- Declared claims.
- Các nguyên tắc phân biệt `READY` và `FAILED`.

AI-V01 chuẩn hóa Generated CV bằng dữ liệu có cấu trúc, không sử dụng diễn giải ngữ nghĩa từ LLM.

AI-V02 mở rộng nguồn tạo `CVMatchProfile` sang Uploaded CV thông qua diễn giải văn bản.

AI-V02 không được âm thầm thay đổi semantics hoặc hành vi chuẩn hóa đã được phê duyệt trong AI-V01.

---

# 4. Thuật ngữ và actor

| Thuật ngữ | Ý nghĩa |
|---|---|
| Candidate | Chủ thể sở hữu Candidate CV và hưởng lợi từ kết quả chuẩn hóa |
| Uploaded CV | Candidate CV có nội dung tài liệu được upload dưới dạng PDF |
| PDF text extraction | Khả năng lấy nội dung văn bản đã tồn tại trong PDF |
| Extracted Text | Văn bản thu được từ PDF, chưa có cấu trúc nghiệp vụ được bảo đảm |
| Semantic Extraction | Hoạt động AI diễn giải văn bản để nhận diện và tổ chức thông tin nghề nghiệp |
| Canonical CandidateCV metadata | Metadata của chính CV nguồn do Backend quản lý và cung cấp, tách biệt với nội dung PDF |
| CVMatchProfile | Canonical input profile dùng chung cho các AI capability tiếp theo |
| Evidence | Nội dung nguồn hỗ trợ một claim được ghi nhận |
| Unknown | Thông tin chưa thể xác định từ nguồn được phép |
| Uncertainty | Mức không chắc chắn của thông tin được ghi nhận |
| Canonical Profile | Biểu diễn đầu vào AI thống nhất, không phải bản thay thế Candidate CV gốc |

**Actors:**

- **JOBHUB System:** Thực hiện xử lý và tạo kết quả chuẩn hóa.
- **Candidate:** Chủ thể sở hữu Uploaded CV được phép sử dụng.

AI không phải chủ thể sở hữu CV hoặc authority xác minh Candidate facts.

---

# 5. AI Capability & Human Decision Boundary

| Hành động / quyết định | AI/JOBHUB System | Candidate |
|---|---|---|
| Trích xuất nội dung PDF được phép sử dụng | Có | |
| Diễn giải thông tin nghề nghiệp từ văn bản | Có | |
| Tạo `CVMatchProfile` | Có | |
| Nhận diện thông tin thiếu hoặc mơ hồ | Có | |
| Tự xác minh thông tin CV ngoài đời thực | Không | |
| Thay đổi Candidate CV gốc | Không | Không thuộc V02 |
| Publish hoặc thay trạng thái CV | Không | Theo workflow hiện có, ngoài V02 |
| Sử dụng CV trong AI capability tiếp theo | Theo quyền được cấp | Theo capability tương ứng |
| Quyết định tuyển dụng | Không | Không thuộc V02 |

AI-V02 không bổ sung quyền thực hiện side effect lên Candidate CV.

Một claim được trích xuất không mặc nhiên trở thành Candidate fact đã được xác minh độc lập.

---

# 6. Input & Trust Boundary

## 6.1. Input được phép

Các nguồn dữ liệu được phép cho AI-V02 là:

- Một Uploaded CV hợp lệ thuộc phạm vi sử dụng.
- Nội dung văn bản được trích xuất từ PDF của Uploaded CV đó.
- Canonical metadata hiện có của chính CandidateCV đó do Backend cung cấp, trong các nhóm thông tin nghề nghiệp thuộc `CVMatchProfile`.

Hệ thống sử dụng định danh và thông tin quyền truy cập cần thiết để xác định đúng tài nguyên nguồn. Chỉ nội dung PDF được đưa cho LLM diễn giải; canonical metadata được kết hợp deterministic sau bước diễn giải, giữ đúng giá trị và provenance do Backend cung cấp.

AI-V02 không mặc định sử dụng:

- Candidate Profile ngoài nội dung PDF.
- Candidate account data không cần thiết.
- Job hoặc Job Description.
- Generated CV khác.
- Company data.
- Conversation history.
- Kết quả AI trước đó.

Không dùng Candidate Profile hoặc dữ liệu account để bổ sung thông tin còn thiếu trong PDF.

## 6.2. Trust level

| Input | Vai trò |
|---|---|
| Candidate CV identity và ownership | Canonical business information từ JOBHUB |
| Canonical CandidateCV metadata | Nguồn dữ liệu có cấu trúc do Backend sở hữu; không phải kết quả LLM |
| Uploaded PDF | Tài liệu nguồn chứa các khai báo của Candidate |
| Extracted PDF text | Nội dung văn bản được lấy từ tài liệu, chưa bảo đảm chất lượng hoặc ngữ nghĩa |
| AI-extracted information | Kết quả diễn giải ngữ nghĩa, có tính xác suất |
| CVMatchProfile | Canonical AI input representation, không phải independently verified Candidate facts |

Nguyên tắc:

1. PDF được upload không được mặc định có cấu trúc hoặc chất lượng văn bản đồng nhất.
2. Extracted text là nguồn nội dung để AI diễn giải, không phải business schema.
3. AI được phép tổ chức thông tin có căn cứ thành structured claims theo capability V02.
4. Không có căn cứ trong nguồn thì không tự tạo Candidate facts.
5. Output được tạo bởi AI không tự trở thành canonical CandidateCV data.
6. Dữ liệu PDF có thể chứa nội dung không phải chỉ dẫn hợp lệ cho hệ thống; nội dung tài liệu không có authority thay đổi quy tắc xử lý.
7. Claim từ PDF không ghi đè metadata Backend; metadata Backend cũng không được trình bày như claim trích xuất từ PDF. Nếu nội dung khác nhau, giữ cả hai cùng provenance.

## 6.3. Data minimization

Chỉ sử dụng nội dung và thông tin cần thiết để tạo `CVMatchProfile` cho Uploaded CV được phép xử lý.

Không mặc định đưa toàn bộ Candidate account, Company data, Job data hoặc dữ liệu riêng tư không liên quan vào AI context.

Không tự mở rộng nguồn ngoài PDF và canonical metadata của chính CandidateCV để bổ sung claim thiếu.

---

# 7. AI Output Contract & Semantics

AI-V02 tạo một canonical `CVMatchProfile` tương ứng với Uploaded CV đầu vào khi xử lý thành công.

Đây là cùng khái niệm canonical profile được AI-V01 xác lập, không phải một profile nghiệp vụ mới.

Profile có thể biểu diễn các nhóm thông tin nghề nghiệp được tài liệu thể hiện:

- Career positioning.
- Professional summary.
- Skills và qualifications.
- Work experience.
- Projects.
- Education.
- Certifications.
- Languages.
- Các claim nghề nghiệp khác thuộc canonical semantics được phép.
- Thông tin nguồn và căn cứ tương ứng.
- Thông tin thiếu, không chắc chắn hoặc mâu thuẫn khi có.

AI-V02 không bắt buộc phải tìm được dữ liệu cho mọi nhóm thông tin.

Một canonical `CVMatchProfile` có hai biến thể theo nguồn: Generated CV giữ biểu diễn và hành vi deterministic của AI-V01; Uploaded CV kết hợp metadata Backend với nội dung PDF được LLM diễn giải. Phân biệt nguồn `GENERATED_CV` và `UPLOADED_CV` không được làm thay đổi ý nghĩa nghiệp vụ của cùng một claim.

Chi tiết cấu trúc dữ liệu, cách biểu diễn source và các trường dành riêng cho từng loại CV thuộc Data Contract.

## 7.1. Semantics

**CVMatchProfile**

`CVMatchProfile` là biểu diễn dữ liệu nghề nghiệp phục vụ các AI capability tiếp theo.

Với Uploaded CV:

- Nội dung tài liệu được LLM nhận diện từ văn bản PDF; canonical metadata của CandidateCV được đưa vào bằng phép kết hợp deterministic.
- Một structured claim phản ánh nội dung được nguồn thể hiện, không phải fact đã xác minh ngoài đời thực.
- AI được phép hiểu cách diễn đạt tự nhiên để đưa thông tin vào nhóm dữ liệu phù hợp.
- AI không được tự suy ra kinh nghiệm, kỹ năng hoặc qualification mới khi không có căn cứ tường minh.
- Các nhóm thông tin không xuất hiện hoặc không xác định được giữ ngữ nghĩa thiếu dữ liệu.
- Các claim mâu thuẫn không được tự biến thành một fact chắc chắn duy nhất.

Ví dụ:

PDF thể hiện Candidate đã sử dụng Node.js trong một dự án.

Kết quả có thể ghi nhận thông tin về Node.js có căn cứ từ dự án đó.

Kết quả không được tự khẳng định Candidate có ba năm kinh nghiệm Node.js chỉ từ thông tin trên.

**Canonical compatibility**

Generated CV và Uploaded CV có thể khác nhau về:

- Source representation.
- Cách nhận diện nội dung.
- Cách thể hiện provenance.
- Các thuộc tính chỉ có ý nghĩa với một loại nguồn.

Những khác biệt đó không được dẫn đến hai cách hiểu trái ngược cho cùng một thông tin nghề nghiệp.

**Output không biểu diễn:**

- Match score.
- Candidate–Job compatibility.
- Candidate ranking.
- Candidate quality rating.
- Xác suất tuyển dụng.
- Quyết định của Employer.

---

# 8. Scoring / Ranking Policy Boundary

> Version này không bổ sung scoring/ranking capability mới.

AI-V02 chỉ tạo dữ liệu đầu vào chuẩn cho các AI capability tiếp theo.

Việc thiếu hoặc không xác định được một qualification không tạo ra kết luận Candidate không phù hợp.

AI-V02 không áp dụng:

- Matching criteria.
- Scoring weights.
- Hard requirement evaluation.
- Job ranking.
- Candidate ranking.

Các policy này thuộc AI version được phê duyệt tương ứng.

---

# 9. Evidence, Unknown & Reliability Rules

## 9.1. Evidence

Một structured claim được AI-V02 ghi nhận phải được hỗ trợ bởi nội dung nguồn được phép.

AI có thể nhận diện một claim dù văn bản không trình bày theo biểu mẫu cố định.

Tuy nhiên:

- Không tạo claim nghề nghiệp không được tài liệu hỗ trợ.
- Không gán thời lượng hoặc mức độ thành thạo khi nguồn không thể hiện.
- Không tự thêm công nghệ, chứng chỉ, học vấn hoặc kinh nghiệm.
- Không coi một claim được Candidate ghi trong CV là thông tin đã được xác minh độc lập.

AI-V02 phải giữ khả năng nhận biết nguồn của các claim theo canonical semantics. Mức độ chi tiết của biểu diễn provenance được xác định ở Data Contract.

Các nguyên tắc diễn giải ở §9.1–9.5 là mục tiêu chất lượng LLM theo BR-AI-17
và BR-AI-22; chúng không thay thế các system-owned validation gates và không
cam kết mọi output hợp lệ về cấu trúc đều chính xác về ngữ nghĩa.

## 9.2. Unknown khác mismatch

Không tìm thấy một thông tin trong extracted text không đồng nghĩa Candidate không sở hữu thông tin đó.

Ví dụ:

PDF không đề cập AWS.

AI-V02 không được kết luận Candidate không biết AWS.

Thông tin thiếu được biểu diễn theo ngữ nghĩa thiếu dữ liệu của canonical profile, không biến thành negative assessment.

## 9.3. Uncertainty

AI-V02 phải xử lý phù hợp khi nội dung:

- Mơ hồ.
- Thiếu ngữ cảnh.
- Không đầy đủ.
- Có nhiều cách hiểu.
- Có các claim mâu thuẫn.
- Bị hạn chế bởi chất lượng văn bản trích xuất.

Thông tin không chắc chắn không được tự chuyển thành một khẳng định chắc chắn hơn evidence hỗ trợ.

Không yêu cầu AI-V02 phải giải quyết mọi mâu thuẫn có trong CV.

## 9.4. Hallucination

AI-V02 không được chủ động tạo:

- Skill không được thể hiện.
- Work experience không có căn cứ.
- Số năm kinh nghiệm suy đoán.
- Education hoặc certification không được thể hiện.
- Language proficiency cụ thể không được nguồn hỗ trợ.
- Career level hoặc seniority không có căn cứ.
- Candidate facts được suy ra chỉ để hoàn thiện profile.

Việc sử dụng AI để diễn giải văn bản không cấp authority để bổ sung Candidate facts.

## 9.5. Consistency

- Profile phải phản ánh nội dung nguồn trong giới hạn khả năng trích xuất và diễn giải của capability.
- Cùng một claim không được bị diễn giải thành các kết luận nghề nghiệp không tương thích nếu không có căn cứ.
- Claim mâu thuẫn có thể cùng tồn tại.
- Thông tin thiếu không được tự biến thành thông tin phủ định.
- Canonical semantics phải nhất quán với AI-V01.
- Output đúng cấu trúc không tự chứng minh độ chính xác ngữ nghĩa.

Không yêu cầu nội dung được AI tạo ra phải giống từng chữ giữa các lần xử lý.

---

# 10. Functional Requirements

## F01 — Chuẩn hóa Uploaded CV thành CVMatchProfile

### Actor

JOBHUB System; Candidate là chủ thể sở hữu Uploaded CV.

### Mục tiêu

Cho phép JOBHUB sử dụng Uploaded CV làm nguồn đầu vào chuẩn cho các AI capability tiếp theo, thông qua việc kết hợp canonical CandidateCV metadata với nội dung PDF đã được diễn giải thành `CVMatchProfile`.

### Input business

- Một Uploaded Candidate CV hợp lệ.
- Nội dung PDF hiện hành của Uploaded CV đó.
- Nội dung văn bản có thể trích xuất từ PDF.
- Canonical metadata hiện có của chính CandidateCV nguồn do Backend cung cấp.
- Thông tin định danh và quyền sử dụng nguồn cần thiết.

### Tiền điều kiện

- Uploaded CV tồn tại.
- Nguồn CV thuộc phạm vi được phép sử dụng.
- Việc truy cập tuân thủ authentication, authorization và ownership.
- PDF đáp ứng các điều kiện hợp lệ đã được Backend Product Contract xác lập.
- Capability được yêu cầu sử dụng Uploaded CV trong phạm vi AI hợp lệ.

### Luồng chính

1. Một AI capability yêu cầu sử dụng Uploaded CV hợp lệ.
2. JOBHUB xác định nguồn CV và quyền sử dụng.
3. Hệ thống trích xuất nội dung văn bản từ PDF.
4. Nội dung văn bản được sử dụng để thực hiện một hoạt động diễn giải ngữ nghĩa AI.
5. Backend cung cấp canonical metadata của đúng CandidateCV nguồn; LLM không tạo hoặc sửa metadata này.
6. Hệ thống kiểm tra kết quả diễn giải PDF rồi kết hợp deterministic với metadata Backend theo hợp đồng `CVMatchProfile`.
7. Hệ thống trả profile hợp lệ cho capability sử dụng trong lần xử lý hiện tại.

### Kết quả

- Có một `CVMatchProfile` tương ứng với Uploaded CV đã xử lý.
- Thông tin nghề nghiệp được biểu diễn theo canonical semantics.
- Không tự tạo Candidate facts không có căn cứ.
- Thông tin thiếu hoặc không xác định được không trở thành kết luận phủ định.
- Kết quả không thay đổi Candidate CV gốc.
- Extracted text, kết quả LLM và profile không được persist hoặc cache để tái sử dụng.
- Kết quả đủ điều kiện contract để capability tiếp theo sử dụng, không đồng nghĩa đã được xác minh chính xác tuyệt đối.

### Failure / Unknown behavior

- PDF không có văn bản có thể trích xuất: không được tạo profile giả hoặc claim không có nguồn.
- Không thể đọc hoặc trích xuất nội dung cần thiết: không trả một profile thành công giả tạo.
- AI không tạo được output đáp ứng hợp đồng: xử lý như thất bại của capability, không phải đánh giá tiêu cực về Candidate.
- Thông tin nghề nghiệp không được nguồn thể hiện: giữ ngữ nghĩa thiếu dữ liệu.
- Nội dung mơ hồ hoặc mâu thuẫn: không tự tạo kết luận chắc chắn để giải quyết.
- Văn bản có ít thông tin nghề nghiệp nhưng vẫn cho phép tạo profile hợp lệ: có thể trả `READY` với các nhóm thông tin thiếu được biểu diễn đúng; không áp dụng completeness threshold.
- Văn bản rỗng/không thể trích xuất, hoặc output không hợp lệ sau kiểm tra: không trả `READY` giả.

### Trường hợp từ chối

- CV không tồn tại.
- Input không phải Uploaded CV hợp lệ.
- Actor không có quyền sử dụng CV.
- File không thuộc loại được hỗ trợ.
- Yêu cầu vượt ngoài phạm vi capability.

### Business Rules liên quan

`BR-AI-15`, `BR-AI-16`, `BR-AI-17`, `BR-AI-18`, `BR-AI-19`, `BR-AI-20`, `BR-AI-21`, `BR-AI-22`.

Các nguyên tắc evidence, missing data, authorization, declared experience và conflict đã có trong AI-V01 tiếp tục được bảo toàn về semantics phù hợp.

### Không thuộc chức năng này

- Generated CV normalization.
- OCR.
- Matching hoặc scoring.
- CV review chatbot.
- Job recommendation.
- CV modification.
- AI Agent.
- Tự động xác minh thông tin nghề nghiệp ngoài nguồn.

---

# 11. AI Business Rules

## BR-AI-15 — Một canonical CVMatchProfile cho các nguồn CV

Uploaded CV và Generated CV sử dụng chung khái niệm canonical `CVMatchProfile`.

AI-V02 được phép mở rộng biểu diễn theo đặc điểm nguồn Uploaded CV nhưng không được âm thầm thay đổi semantics đã được AI-V01 phê duyệt.

Biến thể Generated CV giữ nguyên cấu trúc nguồn và deterministic normalization của V01. Biến thể Uploaded CV giữ riêng provenance của metadata Backend và claim từ PDF; không giả lập Uploaded CV thành Generated CV.

Không tạo một profile nghiệp vụ song song chỉ vì nguồn đầu vào là PDF.

## BR-AI-16 — Diễn giải PDF và kết hợp canonical output

LLM chỉ diễn giải văn bản trích xuất từ Uploaded PDF thành phần thông tin có căn cứ trong canonical output contract. Backend cung cấp metadata của đúng CandidateCV nguồn. Hệ thống kiểm tra và kết hợp hai phần một cách deterministic thành một `CVMatchProfile`.

AI-V02 không bổ sung một capability AI trung gian độc lập có output nghiệp vụ riêng trước khi tạo profile.

Cơ chế thực hiện và giới hạn gọi provider thuộc Engineering Contract.

## BR-AI-17 — Chỉ trích xuất claim được thể hiện tường minh

AI được phép hiểu ngôn ngữ tự nhiên và tổ chức thông tin vào các trường phù hợp.

Prompt phải hướng dẫn LLM chỉ trích xuất qualification, experience và các
career claim có căn cứ tường minh từ PDF; nội dung thiếu hoặc mơ hồ phải được
biểu diễn theo evidence, missing và uncertainty contract hiện hành. Việc hiểu
ngữ nghĩa không cấp quyền suy đoán để hoàn thiện hồ sơ.

Hệ thống phải kiểm tra nguồn, authorization, schema và cấu trúc evidence; giữ
canonical metadata, taxonomy identity và provenance theo đúng nguồn. Bước kết
hợp deterministic không được tự tạo hoặc biến đổi career claim không có trong
kết quả diễn giải hợp lệ. Các technical error và output không hợp lệ tiếp tục
được xử lý theo contract hiện hành.

LLM vẫn có thể diễn giải sai dù output hợp lệ về schema và evidence structure.
Semantic inaccuracy, kể cả unsupported claim, phải được ghi nhận trung thực
trong BR-AI-22 quality evaluation. BR-AI-17 không bảo đảm tuyệt đối mọi output
LLM đều không có unsupported claim và không tự tạo runtime rejection gate cho
output hợp lệ chỉ vì một semantic finding.

## BR-AI-18 — Missing và uncertainty không phải negative assessment

Thông tin không xuất hiện hoặc không xác định được phải giữ đúng ngữ nghĩa thiếu dữ liệu hoặc không chắc chắn.

Không được chuyển thông tin thiếu thành kết luận Candidate không có năng lực.

Không tự tạo giá trị nghề nghiệp chỉ để làm đầy output.

## BR-AI-19 — Bảo toàn claim mâu thuẫn có căn cứ

Các claim mâu thuẫn trong tài liệu không được tự hợp nhất thành một sự thật chắc chắn duy nhất.

AI-V02 không có authority xác minh độc lập để quyết định claim nào phản ánh thực tế ngoài đời.

Conflict không tự động trở thành kết luận về chất lượng Candidate.

## BR-AI-20 — Nguồn và canonical authority không được bị thay thế

Uploaded PDF là nguồn nội dung Candidate khai báo.

AI-extracted information không tự thay thế:

- Candidate CV identity.
- Ownership.
- Canonical business metadata.
- Candidate CV lifecycle.
- CandidateCV persisted content.

Canonical metadata có thể tham gia profile theo giá trị Backend cung cấp, với provenance riêng; LLM không được suy diễn, sửa hoặc ghi đè metadata đó từ PDF. Khác biệt giữa metadata và nội dung PDF được bảo toàn cùng nguồn tương ứng.

Việc mở rộng nguồn dữ liệu ngoài PDF phải được phê duyệt trước khi áp dụng.

## BR-AI-21 — Xử lý thất bại khác kết luận nghiệp vụ

Không thể trích xuất nội dung hoặc không thể tạo profile hợp lệ là thất bại xử lý.

Thất bại đó không đồng nghĩa:

- Candidate không có qualification.
- CV không phù hợp với một Job.
- Candidate có chất lượng thấp.

Không tạo kết quả đánh giá tiêu cực để thay thế lỗi xử lý.

## BR-AI-22 — Output contract không thay thế AI quality

Một output đáp ứng cấu trúc dữ liệu không tự động chứng minh rằng thông tin được trích xuất đầy đủ hoặc chính xác.

AI-V02 phải được đánh giá theo chất lượng diễn giải nghiệp vụ trên các nhóm Uploaded CV đại diện.

Không chấp nhận version chỉ dựa trên việc tạo được output đúng schema.

---

# 12. Agent / Side-effect Boundary

> Version này không cấp quyền mutation cho AI.

AI-V02 không cho phép AI:

- Sửa Uploaded PDF.
- Sửa Candidate CV gốc.
- Thay đổi Candidate CV metadata.
- Tạo hoặc sửa Candidate CV Draft.
- Publish CV.
- Apply Job.
- Thay đổi quyền truy cập tài nguyên.
- Thực hiện action thay Candidate hoặc Employer.

Canonical profile được tạo để phục vụ AI capability, không phải authorization để thay đổi Candidate business resource.

---

# 13. Resource Lifecycle & State Transitions

AI-V02 không thay đổi lifecycle của Uploaded Candidate CV.

Luồng xử lý về mặt nghiệp vụ:

```text
Uploaded CV hợp lệ
        ↓
Được AI capability yêu cầu sử dụng
        ↓
Trích xuất nội dung PDF
        ↓
LLM diễn giải PDF + Backend cung cấp metadata
        ↓
Kết hợp deterministic thành CVMatchProfile
        ↓
Trả kết quả xử lý
```

AI-V02 không tự tạo các trạng thái persisted mới cho Candidate CV.

Extracted text, kết quả diễn giải và profile chỉ tồn tại trong phạm vi lần xử lý; không persist hoặc cache để tái sử dụng. Lần xử lý sau phải đọc nguồn hiện hành và tạo kết quả mới.

### Kết quả xử lý

AI-V02 áp dụng semantics `READY` và `FAILED` của AI-V01:

| Kết quả | Ý nghĩa |
|---|---|
| `READY` | Đã tạo được canonical profile đáp ứng hợp đồng |
| `FAILED` | Không thể hoàn thành việc tạo canonical profile hợp lệ |

Không tự bổ sung trạng thái `BLOCKED`.

Profile hợp lệ có thể `READY` dù ít hoặc không có claim nghề nghiệp từ PDF; không đặt completeness threshold. PDF không có text có thể trích xuất hoặc xử lý không tạo được output hợp lệ là `FAILED`/lỗi xử lý theo trường hợp áp dụng, không phải đánh giá Candidate.

Không có persisted transition mới.

---

# 14. Authorization / Ownership / Tenant Boundary

AI-V02 phải tuân thủ quyền sử dụng Candidate CV đã được JOBHUB xác lập.

- Candidate chỉ được sử dụng Uploaded CV thuộc phạm vi được phép.
- Hệ thống phải xác định canonical identity của resource trước khi xử lý.
- Yêu cầu thông qua AI không được tạo đường truy cập mới tới PDF của Candidate khác.
- Dữ liệu của Candidate khác không được đưa vào context khi không có quyền.
- AI không được tự thay đổi ownership hoặc visibility của CV.
- Kết quả xử lý không được vượt qua resource isolation hiện có.

Quy trình quyền truy cập ở mức business:

```text
Authenticated Actor
        ↓
Backend resolves Candidate CV
        ↓
Authorization / Ownership
        ↓
Allowed Uploaded CV Content
        ↓
AI-V02
```

> Version này không bổ sung multi-tenant boundary mới.

---

# 15. Failure & Fallback Behavior

AI-V02 phải phân biệt business result và technical failure.

## Invalid input

Bao gồm:

- Uploaded CV không tồn tại.
- Actor không có quyền sử dụng.
- File không thuộc loại hỗ trợ.
- Nguồn không đáp ứng Product Contract.

Các trường hợp này không được biểu diễn thành kết quả đánh giá Candidate.

## Extraction failure

Bao gồm:

- Không đọc được nội dung PDF.
- PDF không có text layer có thể trích xuất.
- Không thể tạo nội dung văn bản để phục vụ capability.

Trong phạm vi V02, không tự thay thế extraction bằng OCR.

## AI processing failure

Bao gồm:

- Không tạo được output hợp lệ.
- Kết quả không đáp ứng hợp đồng đầu ra.
- Hoạt động diễn giải không hoàn tất.

Không coi response không hợp lệ là một `CVMatchProfile` thành công.

## Dependency failure

Khi một dependency cần thiết không khả dụng, capability có thể không hoàn tất.

Không được biến dependency failure thành kết luận về Candidate hoặc CV.

Chính sách retry/fallback kỹ thuật không được quyết định ngầm tại Product Spec.

## Insufficient evidence

Khi có thể xử lý dữ liệu nhưng nội dung thiếu hoặc mơ hồ, không được tự bổ sung claim.

Ít thông tin nghề nghiệp không làm profile hợp lệ mất điều kiện `READY`. Các nhóm thiếu được biểu diễn là missing/unknown; không đặt ngưỡng số claim hoặc độ đầy đủ.

Insufficient evidence không tự động là technical failure.

**Nguyên tắc bất biến:**

```text
AI processing failure
!=
negative Candidate assessment
```

---

# 16. AI Quality & Evaluation

AI-V02 phải được đánh giá theo chất lượng chuyển đổi Uploaded CV thành canonical `CVMatchProfile`.

Không chỉ kiểm tra:

- PDF có đọc được.
- AI trả response.
- Output đúng schema.

Các quality dimensions áp dụng:

| Dimension | Yêu cầu |
|---|---|
| Extraction usability | Văn bản lấy từ PDF phải đủ hữu ích cho quá trình diễn giải trong các case được hỗ trợ |
| Factuality | Không chủ động tạo claim ngoài căn cứ của tài liệu |
| Information coverage | Các nhóm thông tin nghề nghiệp có căn cứ phải được nhận diện với chất lượng chấp nhận được |
| Semantic accuracy | Thông tin được phân loại đúng ý nghĩa và ngữ cảnh |
| Missing-information handling | Thông tin thiếu không bị bịa hoặc chuyển thành kết luận phủ định |
| Uncertainty handling | Không tự khẳng định chắc chắn khi nội dung mơ hồ |
| Conflict handling | Không âm thầm biến các claim mâu thuẫn thành một fact duy nhất |
| Canonical compatibility | Profile giữ đúng semantics chung với V01 |
| Failure correctness | Trường hợp thất bại không bị báo là profile thành công |

Đánh giá chất lượng phải dựa trên nội dung nguồn và kết quả mong đợi được xác định độc lập, không chỉ dựa vào việc output có đúng cấu trúc.

## 16.1. Representative cases

Evaluation cần bao phủ tối thiểu các nhóm trường hợp:

1. PDF có text rõ ràng, bố cục đơn giản.
2. PDF nhiều trang.
3. PDF có bố cục nhiều cột hoặc section không theo thứ tự chuẩn.
4. PDF có nội dung nghề nghiệp phong phú.
5. PDF thiếu nhiều thông tin nghề nghiệp.
6. PDF có các thông tin mơ hồ.
7. PDF có claim mâu thuẫn.
8. PDF có thông tin không thể ánh xạ rõ sang nhóm canonical.
9. PDF có text nhưng nội dung khó diễn giải chính xác.
10. PDF chỉ chứa ảnh hoặc không có text có thể trích xuất.
11. Output AI không hợp lệ.
12. Resource không hợp lệ hoặc không được phép truy cập.

Các case có nhiều cách trình bày khác nhau cần được xem xét trong evaluation, không mặc định rằng một mẫu CV duy nhất đại diện cho toàn bộ Uploaded CV.

## 16.2. Acceptance

AI-V02 chỉ đạt AI quality khi:

- Functional Requirement thuộc phạm vi được đáp ứng.
- Các Business Rules về system-owned correctness, gồm source validation,
  authorization, schema/evidence-structure validation, canonical metadata,
  provenance, deterministic integrity và technical failures, được tuân thủ.
- Output giữ đúng canonical semantics.
- Những trường hợp failure quan trọng được xử lý đúng.
- BR-AI-22 benchmark được thực hiện với evidence và expected ledger độc lập
  cho hai PDF mới; coverage và semantic findings được ghi nhận trung thực.
- Product Owner đã xem xét tác động và chấp nhận rõ các semantic limitations
  còn lại nếu có.
- Không có known violation nghiêm trọng đối với system-owned trust,
  ownership hoặc lifecycle boundary.
- Capability ngoài phạm vi không bị triển khai ngầm.

Benchmark AI-V02 gồm ba PDF: Live Smoke #3 và hai CV tổng hợp hoàn toàn giả lập
(một CV Software Developer bố cục thông thường, một CV sparse/bố cục phức tạp).
Với hai PDF mới, expected claim ledger phải được lập độc lập từ PDF trước khi
xem output LLM. Evaluation Contract đánh giá thủ công, có evidence, theo ba
nhóm: System Correctness, Prompt & Extraction Quality, và Downstream Usability /
UX Tolerance. Ghi số claim đúng, thiếu, sai hoặc không có căn cứ để phân tích;
không đặt ngưỡng accuracy phần trăm bắt buộc.

Kết luận `PASS`/`LIMITATION`/`FAIL` là kết luận evaluation, không trực tiếp thay
đổi runtime `READY`/`FAILED`. Final Acceptance cần Product Owner xem xét findings
và chấp nhận rõ các semantic limitations còn lại sau khi xem xét tác động;
hoàn thành benchmark không tự động là Final Acceptance. Không bắt buộc mọi LLM
evaluation case đều semantic `PASS`, không đặt ngưỡng accuracy tùy ý và không
bổ sung semantic validator, completeness threshold hoặc runtime rejection gate
từ kết quả đánh giá này.

---

# 17. Lifecycle Invariants

Các invariant phải luôn đúng:

1. AI-V02 không thay đổi Candidate CV nguồn.
2. AI-V02 không bypass authorization hoặc ownership.
3. Chỉ Uploaded CV thuộc phạm vi được phép mới được sử dụng.
4. Output không tự trở thành canonical Candidate business fact.
5. Structured claims không được chủ động tạo ra khi thiếu căn cứ tường minh.
6. Missing information không tự trở thành mismatch.
7. Technical failure không trở thành negative Candidate assessment.
8. Các claim mâu thuẫn không được tự hợp nhất thành một fact chắc chắn duy nhất.
9. Không sử dụng OCR khi capability OCR chưa được phê duyệt.
10. `CVMatchProfile` giữ cùng semantics nghiệp vụ cốt lõi với AI-V01.
11. Hành vi normalization của Generated CV thuộc AI-V01 không bị thay đổi ngầm.
12. AI-V02 không thực hiện matching, scoring hoặc ranking.
13. AI-V02 không có quyền tự sửa, publish hoặc apply Candidate CV.
14. Output hợp lệ về cấu trúc không được mặc định là bảo đảm chính xác về ngữ nghĩa.

---

# 18. Các quyết định chủ động defer

Những capability được xem xét nhưng không thuộc AI-V02:

- OCR cho image-based PDF.
- Document vision.
- Hỗ trợ DOCX và các định dạng tài liệu khác.
- CV–Job Matching Engine.
- Match score và explanation.
- Job Recommendation.
- AI chatbot tư vấn CV.
- AI Agent sửa Candidate CV.
- Tự động tạo hoặc cập nhật Candidate CV từ nội dung PDF.
- Tự động cập nhật Candidate metadata theo dữ liệu AI trích xuất.
- Tự động xử lý PDF ngay khi upload hoặc thay file.
- Xác minh độc lập qualification, experience hoặc credential của Candidate.

Các capability trên chỉ được triển khai khi có Product authority phù hợp.

---

# 19. Quyết định baseline D1–D4

Bốn quyết định dưới đây đã được thống nhất cho phạm vi F01 và được Product Owner phê duyệt cùng Product Specification AI-V02. Phê duyệt Product/Data không tự xác nhận implementation hoặc Final Acceptance.

### D1 — Runtime-only, không persistence/cache

Extracted text, kết quả diễn giải và `CVMatchProfile` chỉ dùng trong một lần xử lý. Không lưu, cache hoặc tái sử dụng các kết quả đó giữa các lần gọi. Khi PDF hoặc metadata nguồn thay đổi, lần xử lý tiếp theo đọc nguồn hiện hành và tạo profile mới; V02 không đặt lifecycle invalidation cho artifact được lưu.

### D2 — Sparse profile hợp lệ có thể READY

PDF có text trích xuất được nhưng ít, thiếu hoặc khó diễn giải vẫn có thể tạo `READY` nếu output đáp ứng processing contract. LLM được hướng dẫn chỉ ghi thông tin có căn cứ; nhóm dữ liệu không xác định được giữ missing/unknown, kể cả khi không có claim nghề nghiệp nào được nhận diện. Không đặt completeness threshold hoặc số claim tối thiểu. PDF không có text trích xuất được, lỗi xử lý, hoặc output không hợp lệ không được báo `READY`. Semantic finding trên output hợp lệ được đánh giá theo BR-AI-17/§16, không tự đổi runtime status.

### D3 — Một canonical profile, hai biến thể theo nguồn

`CVMatchProfile` có cùng nhóm semantics nghề nghiệp và cùng ý nghĩa claim cho cả hai nguồn. Biến thể Generated CV giữ nguyên structured content, free text, presentation metadata và provenance theo V01; không thay đổi deterministic normalization. Biến thể Uploaded CV giữ canonical CandidateCV metadata riêng với nội dung PDF được diễn giải, evidence/provenance theo PDF và thông tin có căn cứ chưa ánh xạ được. Thuộc tính chỉ có ý nghĩa với một nguồn không bị giả lập ở nguồn còn lại. Data Contract quy định các nhóm dữ liệu; JSON shape cụ thể thuộc Engineering Contract.

### D4 — Backend metadata và diễn giải PDF

Backend cung cấp canonical metadata hiện có của chính CandidateCV được phép sử dụng; LLM chỉ nhận và diễn giải văn bản PDF. Hệ thống kết hợp deterministic metadata với phần thông tin từ PDF thành `CVMatchProfile`. Metadata Backend giữ nguyên giá trị và provenance, không bị claim từ PDF ghi đè; claim PDF không được gắn nhãn là canonical metadata. Khi hai nguồn khác nhau, giữ cả hai theo nguồn và không tự xác minh bên nào đúng. Phạm vi field và ràng buộc dữ liệu thuộc Data Contract; kỹ thuật kết hợp và kiểm tra thuộc Engineering Contract.

---

# 20. Definition of AI Business Completion

AI-V02 được coi là hoàn thành về mặt business khi:

- `F01` được đáp ứng.
- Các Business Rules áp dụng về system-owned correctness được đáp ứng; các
  semantic quality findings của LLM được đánh giá và quyết định theo §16.2.
- Uploaded CV hợp lệ có thể trở thành nguồn tạo canonical `CVMatchProfile`.
- Output giữ đúng semantics cốt lõi của AI-V01.
- Generated CV normalization của V01 không bị phá vỡ.
- Prompt hướng dẫn LLM chỉ trích xuất claim có căn cứ; deterministic processing
  không tự tạo hoặc biến đổi claim không có nguồn.
- Missing và uncertainty được xử lý đúng.
- Authorization và ownership luôn được bảo toàn.
- Failure behavior không biến lỗi xử lý thành đánh giá Candidate.
- BR-AI-22 benchmark có evidence, expected ledger và coverage theo §16.2;
  findings được ghi trung thực và Product Owner đã chấp nhận rõ các semantic
  limitations còn lại sau khi xem xét tác động.
- Không có behavior ngoài scope được tự động bổ sung.
- Các quyết định chặn implementation và acceptance đã được giải quyết.

Các kết quả sau không tự động chứng minh AI Business Completion:

```text
PDF được đọc thành công
```

```text
LLM trả response
```

```text
Response đúng JSON schema
```

```text
Unit test pass
```

```text
Một vài CV demo cho kết quả tốt
```

AI-V02 chỉ được kết luận hoàn thành khi các system-owned correctness gates đều
PASS, benchmark và quality review đáp ứng §16.2, và Product Owner đã quyết định
về các documented semantic limitations. Một LLM case semantic `FAIL` không tự
chặn Final Acceptance nếu các điều kiện đó được đáp ứng; output hợp lệ vẫn giữ
runtime status theo processing contract.

---

# 21. Implementation Boundary

Tài liệu này là:

```text
CANONICAL AI PRODUCT SPECIFICATION
```

Ở trạng thái hiện tại:

```text
APPROVED
```

Nó xác định:

```text
WHAT THE AI CAPABILITY MUST DO
```

```text
WHAT THE AI CAPABILITY MUST NOT DO
```

```text
WHAT ITS OUTPUT MEANS
```

```text
WHAT BUSINESS QUALITY IS REQUIRED
```

Tài liệu này không định nghĩa:

- LLM provider.
- Model.
- Prompt/system prompt.
- Provider-native structured output configuration.
- JSON Schema chi tiết.
- Temperature hoặc token limit.
- Thuật toán trích xuất PDF.
- PDF.js API hoặc cấu hình thư viện.
- Cơ chế gọi provider, retries và fallback kỹ thuật.
- Thuật toán validation.
- REST endpoint.
- HTTP method/status.
- Request/response schema.
- Controller/service/route.
- Queue/cache implementation.
- MongoDB/Mongoose implementation.
- `ai-kit` source structure.
- Frontend implementation.
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
        ├── Document Extraction
        ├── LLM
        └── Evaluation
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

Không phải version nào cũng cần tất cả Engineering Contracts.

Authority:

```text
Approved AI Product Spec
→ business / capability truth

Approved AI Data Contract
→ data / persistence truth

Approved AI Engineering Contracts
→ architecture / algorithm truth

Source code + tests + evaluations
→ implementation evidence
```

Nếu implementation, prompt, extraction logic hoặc AI behavior mâu thuẫn với Product Specification đã được phê duyệt:

```text
Product Specification
```

là authority đối với business behavior.

Implementation phải được điều chỉnh, hoặc Product Specification phải được con người chủ động cập nhật và phê duyệt lại.

Product Owner đã phê duyệt Product Specification AI-V02; trạng thái Product/Data được ghi trong AI Kit roadmap. Phê duyệt này không tự xác nhận implementation hoặc Final Acceptance.
