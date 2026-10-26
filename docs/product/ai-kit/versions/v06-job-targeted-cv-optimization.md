# AI-V06 — Tối ưu CV theo Job và tạo Generated CV Draft

> **File:** `docs/product/ai-kit/versions/v06-job-targeted-cv-optimization.md`\
> **Vai trò:** Canonical AI Product Specification\
> **Phase:** JOBHUB AI Phase\
> **Ngôn ngữ:** Tiếng Việt\
> **Mục đích:** Xác định business truth, AI capability boundary và quality requirement của AI-V06.

---

# 1. Mục tiêu

AI-V06 cho phép Candidate tạo một phiên bản CV được tối ưu theo một Job cụ thể, dựa trên CV hiện có và kết quả phân tích, đánh giá AI trước đó.

Sau khi xem kết quả đánh giá CV với Job, Candidate có thể yêu cầu hệ thống tạo một **Generated CandidateCV Draft mới** chứa nội dung nghề nghiệp đã được AI điều chỉnh.

Capability hướng đến:

- tận dụng kết quả đánh giá và góp ý cải thiện đã có;
- điều chỉnh nội dung CV theo yêu cầu của Job;
- hỗ trợ cả Generated CV và Uploaded CV làm nguồn;
- chuyển kết quả thành CV Draft có cấu trúc, có thể Preview và tiếp tục chỉnh sửa;
- giữ Candidate là người quyết định việc sử dụng CV.

AI-V06 không thay thế Matching/Scoring và không cam kết CV sau tối ưu sẽ đạt điểm cao hơn hoặc bảo đảm kết quả tuyển dụng.

---

# 2. Phạm vi

## 2.1. Trong phạm vi

AI-V06 bao gồm:

- tiếp nhận yêu cầu tạo CV tối ưu sau luồng phân tích, đánh giá CV với Job;
- sử dụng một Candidate CV và một Job được chọn;
- sử dụng kết quả đánh giá, góp ý cải thiện từ AI-V04 làm context;
- hỗ trợ Generated CV, bao gồm Generated Draft, và Uploaded CV làm nguồn;
- tạo nội dung CV nghề nghiệp được tối ưu theo Job;
- tạo một Generated CandidateCV mới với trạng thái `DRAFT`;
- tái sử dụng dữ liệu nguồn phù hợp để hoàn thiện nội dung Draft;
- hỗ trợ chuyển đổi best-effort từ Uploaded CV sang Generated Draft;
- cho phép Preview Draft theo khả năng hiện có của JOBHUB;
- cho phép Candidate tiếp tục sử dụng quy trình quản lý, chỉnh sửa CV hiện hành.

AI-V06 được phép đề xuất thay đổi trong bảy nhóm nội dung nghề nghiệp:

1. Professional Summary.
2. Skills.
3. Work Experiences.
4. Projects.
5. Educations.
6. Certifications.
7. Languages.

Trong các nhóm này, nội dung có thể được viết lại, bổ sung, lược bỏ hoặc sắp xếp lại để phù hợp hơn với Job.

## 2.2. Ngoài phạm vi

AI-V06 không bao gồm:

- chỉnh sửa trực tiếp CV nguồn;
- chỉnh sửa nội dung tệp Uploaded PDF gốc;
- tự động chuyển CV Draft thành Active;
- tự động đặt CV làm Default;
- tự động Apply Job;
- tự động Publish hoặc thay đổi quyền hiển thị của CV nguồn;
- thay thế hoặc thay đổi chính sách Matching/Scoring hiện hành;
- quy trình Agent tự chủ thực hiện nhiều hành động ngoài yêu cầu tạo Draft;
- hội thoại chỉnh sửa CV nhiều lượt;
- thiết kế lại Harvard PDF Template;
- bảo đảm kết quả tối ưu có Match Score cao hơn kết quả ban đầu.

Các capability ngoài phạm vi không được xem là điều kiện cần để hoàn thành AI-V06.

---

# 3. Dependency

## 3.1. Dependency với hệ thống JOBHUB

AI-V06 sử dụng các business concept đã tồn tại:

- `User` với vai trò Candidate;
- Candidate Profile;
- CandidateCV;
- Generated CV;
- Uploaded CV;
- CandidateCV Draft và Active;
- Job;
- Job visibility;
- CV ownership và authorization;
- Generated CV content;
- CV completeness và activation lifecycle;
- Harvard PDF Preview.

AI-V06 phải tương thích với các quy tắc quản lý CandidateCV đã được Backend V7 xác định.

Việc tạo Draft không thay đổi lifecycle của CV nguồn.

## 3.2. Dependency với AI version trước

| AI version | Capability được tái sử dụng |
|---|---|
| AI-V01 | Chuẩn hóa Job và Generated CV thành profile dùng chung |
| AI-V02 | Đọc và chuẩn hóa nội dung Uploaded CV |
| AI-V03 | Matching/Scoring giữa Candidate CV và Job |
| AI-V04 | Đánh giá, nhận xét và đề xuất cải thiện CV theo Job |

AI-V06 sử dụng các kết quả này làm dữ liệu và context cho việc tối ưu CV.

AI-V06 không định nghĩa lại ý nghĩa của `JobMatchProfile`, `CVMatchProfile`, Match Score hoặc kết quả AI-V04.

Kết quả AI-V04 là nguồn góp ý cải thiện, không phải nội dung CV hoàn chỉnh để sao chép trực tiếp.

---

# 4. Thuật ngữ và actor

| Thuật ngữ | Ý nghĩa |
|---|---|
| Candidate | Người sở hữu CV và yêu cầu tối ưu |
| Source CV | CandidateCV được chọn làm nguồn tạo Draft |
| Target Job | Job được chọn làm mục tiêu tối ưu |
| CV Evaluation | Kết quả phân tích, đánh giá và góp ý cải thiện từ AI-V04 |
| CV Optimization | Điều chỉnh nội dung nghề nghiệp của CV theo Target Job |
| Generated CV Draft | CandidateCV mới, có nội dung Harvard Builder và trạng thái `DRAFT` |
| Baseline Content | Nội dung Generated CV làm nền trước khi kết hợp kết quả AI |
| AI-generated Content | Nội dung nghề nghiệp do AI tạo hoặc điều chỉnh |
| Preview | Bản xem trước CV Draft để Candidate kiểm tra |

AI-V06 là capability tạo Draft theo yêu cầu của Candidate. Thuật ngữ Agent, nếu được sử dụng trong tài liệu liên quan, không mặc định trao quyền tự chủ ngoài capability này.

---

# 5. AI Capability & Human Decision Boundary

| Hành động / quyết định | AI System | Candidate |
|---|---:|---:|
| Phân tích mức độ phù hợp CV–Job | Qua AI-V03/V04 | Yêu cầu |
| Đề xuất cải thiện nội dung CV | ✓ | Xem xét |
| Tối ưu nội dung nghề nghiệp theo Job | ✓ | Yêu cầu |
| Tạo Generated CV Draft mới | Thực hiện trong workflow được phép | Khởi tạo yêu cầu |
| Xem và kiểm tra Draft | | ✓ |
| Chỉnh sửa Draft sau khi tạo | | ✓ |
| Quyết định Activate Draft | | ✓ |
| Quyết định sử dụng CV để Apply Job | | ✓ |

AI chỉ được tạo Draft trong phạm vi yêu cầu tối ưu do Candidate chủ động thực hiện.

Nội dung AI sinh ra là nội dung được đề xuất cho CV Draft, không phải sự xác nhận độc lập rằng mọi thông tin nghề nghiệp đều chính xác.

Việc tạo Draft không đồng nghĩa Candidate đã chấp nhận CV đó làm CV chính thức.

---

# 6. Input & Trust Boundary

## 6.1. Input được phép

AI-V06 được sử dụng các nguồn dữ liệu phù hợp với yêu cầu hiện tại:

- Target Job và nội dung yêu cầu tuyển dụng;
- Source CV do Candidate chọn;
- `JobMatchProfile` và `CVMatchProfile` tương ứng;
- nội dung nghề nghiệp đã chuẩn hóa;
- kết quả Matching/Scoring và Evaluation liên quan;
- các nhận xét, đề xuất cải thiện từ AI-V04;
- nội dung CandidateCV gốc cần thiết để dựng Generated Draft;
- Candidate Profile trong phạm vi được phép dùng để bổ sung thông tin cá nhân cho Draft.

Các trường không cần AI viết lại có thể được hệ thống xử lý từ nguồn dữ liệu tương ứng.

## 6.2. Trust level

| Nguồn | Vai trò |
|---|---|
| Job canonical data | Nguồn thông tin nghiệp vụ về Target Job |
| Generated CV content | Nội dung CV hiện có do Candidate quản lý |
| Uploaded PDF | Tài liệu CV nguồn do Candidate cung cấp |
| AI-V02 extracted content | Diễn giải có cấu trúc từ Uploaded PDF |
| AI-V04 Evaluation | Kết quả đánh giá và góp ý cải thiện |
| Candidate Profile | Nguồn bổ trợ thông tin cá nhân được phép tái sử dụng |
| AI-V06 output | Nội dung tối ưu được đề xuất cho Generated Draft |

Kết quả trích xuất PDF và nhận xét AI có thể chứa thiếu sót hoặc suy luận chưa chính xác.

AI-V06 có thể sử dụng những nguồn này để tạo Draft nhưng không biến chúng thành bằng chứng xác thực độc lập về Candidate.

## 6.3. Data minimization

AI chỉ cần tiếp nhận dữ liệu phục vụ việc tối ưu nội dung nghề nghiệp.

Thông tin định danh cá nhân, thông tin quản lý CV và những dữ liệu cố định không cần được AI tái tạo nếu Backend có thể lấy từ nguồn hợp lệ.

AI-V06 không mặc định sử dụng toàn bộ tài khoản Candidate, dữ liệu Company hoặc lịch sử tương tác khác.

---

# 7. AI Output Contract & Semantics

Kết quả nghiệp vụ của AI-V06 là một **Generated CandidateCV Draft mới** được tạo từ:

- nội dung nền của Source CV;
- nội dung nghề nghiệp được AI tối ưu;
- thông tin cố định và metadata phù hợp do Backend xử lý.

Draft sử dụng cấu trúc Generated CV hiện hành của JOBHUB và có thể được Preview.

Nội dung AI được phép điều chỉnh thuộc bảy nhóm nghề nghiệp đã xác định tại Section 2.1.

Các nội dung ngoài phạm vi chỉnh sửa của AI được lấy từ nguồn hệ thống phù hợp hoặc giữ theo baseline.

AI không cần xuất lại toàn bộ những trường không được giao chỉnh sửa.

## 7.1. Semantics

**Tối ưu theo Job** có nghĩa nội dung CV được điều chỉnh với mục tiêu thể hiện mức độ liên quan đến Target Job rõ ràng và hữu ích hơn.

Tối ưu không đồng nghĩa:

- Candidate chắc chắn đáp ứng mọi yêu cầu Job;
- CV mới chắc chắn đạt Match Score cao hơn;
- mọi đề xuất của AI đều là sự thật đã được xác minh;
- Candidate bắt buộc sử dụng nội dung mới.

**Ngữ nghĩa thay đổi nội dung:**

- Nhóm nội dung không được AI đề xuất thay đổi sẽ giữ theo baseline.
- Nhóm nội dung được AI cung cấp bản thay thế sẽ sử dụng nội dung mới.
- AI có thể thay đổi thứ tự, số lượng hoặc nội dung các mục trong nhóm được phép chỉnh sửa.
- Một nhóm được thay thế bằng danh sách rỗng có nghĩa không giữ các mục cũ của nhóm đó.
- Những giá trị chưa xác định trong nội dung được tạo mới không tự động trở thành giá trị đã được chứng minh.

Nếu AI trả kết quả hợp lệ nhưng không đề xuất thay đổi nội dung nào, hệ thống vẫn có thể hoàn thành việc tạo Draft từ baseline.

Chi tiết biểu diễn các trường thay đổi, không thay đổi hoặc chưa xác định thuộc AI Data Contract.

---

# 8. Scoring / Ranking Policy Boundary

> AI-V06 không bổ sung scoring hoặc ranking capability mới.

Match Score và kết quả đánh giá được cung cấp bởi các capability trước đó.

AI-V06 có thể sử dụng những kết quả này để định hướng tối ưu CV nhưng không tự sửa điểm, định nghĩa công thức tính điểm mới hoặc cam kết mức tăng điểm sau tối ưu.

Việc đánh giá lại Generated Draft, nếu Candidate thực hiện, thuộc workflow Matching/Evaluation tương ứng.

---

# 9. Evidence, Unknown & Reliability Rules

## 9.1. Evidence

AI-V06 được định hướng sử dụng nội dung nghề nghiệp từ Source CV, Target Job và kết quả Evaluation để xây dựng nội dung tối ưu.

Những thông tin có căn cứ rõ ràng nên được ưu tiên khi viết lại CV.

AI không được xem kết quả Evaluation hoặc nội dung tự sinh là bằng chứng độc lập xác nhận một Candidate fact.

## 9.2. Unknown khác mismatch

Thông tin không xuất hiện trong CV không mặc định có nghĩa Candidate không có năng lực tương ứng.

AI có thể thể hiện những thông tin đã biết, điều chỉnh cách diễn đạt hoặc để trống những nội dung chưa đủ dữ liệu.

AI-V06 không phải capability xác minh toàn bộ năng lực thực tế của Candidate.

## 9.3. Uncertainty

Khi nội dung nguồn thiếu, mơ hồ hoặc không đầy đủ, AI được hướng dẫn hạn chế đưa ra khẳng định vượt quá thông tin sẵn có.

Đối với Uploaded CV, những thông tin không chuyển đổi được sang cấu trúc Generated CV có thể được giữ ở trạng thái chưa có giá trị phù hợp.

Thiếu thông tin không nhất thiết làm Draft không thể được tạo hoặc Preview.

## 9.4. Hallucination

AI được định hướng hạn chế tự tạo kinh nghiệm, kỹ năng, bằng cấp, chứng chỉ hoặc thành tích không có căn cứ trong dữ liệu nguồn.

Đây là yêu cầu về chất lượng nội dung và cách định hướng AI, **không tạo thêm một semantic rejection gate** cho kết quả đã đáp ứng output contract.

Candidate có thể kiểm tra và chỉnh sửa Generated Draft trước khi sử dụng.

## 9.5. Consistency

Nội dung tối ưu nên phù hợp với Target Job, thông tin nguồn và định hướng cải thiện của AI-V04.

Không yêu cầu AI phải giữ nguyên câu chữ, thứ tự hoặc số lượng mục nghề nghiệp trong Source CV.

Không yêu cầu kết quả giữa các lần chạy phải giống nhau.

Việc chấp nhận kết quả có cấu trúc hợp lệ không đồng nghĩa hệ thống bảo đảm mọi nhận xét hoặc cách diễn đạt AI đều chính xác về mặt ngữ nghĩa.

---

# 10. Functional Requirements

## F01 — Khởi tạo yêu cầu tối ưu CV theo Job

### Actor

- Candidate.

### Mục tiêu

Candidate có thể yêu cầu tạo CV tối ưu cho một Job sau khi đã nhận kết quả phân tích và đánh giá CV.

### Input business

- Target Job;
- Source CV được chọn;
- kết quả AI Evaluation liên quan.

### Tiền điều kiện

- Candidate được xác thực;
- Candidate có quyền sử dụng Source CV;
- Target Job hợp lệ theo quyền truy cập hiện hành;
- các dữ liệu cần thiết cho capability có thể được hệ thống xử lý.

### Luồng chính

1. Candidate truy cập luồng phân tích AI của Job.
2. Candidate chọn CV để phân tích.
3. Hệ thống cung cấp kết quả Matching/Evaluation theo các capability hiện hành.
4. Candidate chọn yêu cầu tạo CV Draft tối ưu.
5. Hệ thống tiếp nhận Source CV, Target Job và context đánh giá liên quan để thực hiện AI-V06.

### Kết quả

Một yêu cầu tạo Generated CV Draft theo Job được thực hiện trong phạm vi Candidate đã lựa chọn.

### Failure / Unknown behavior

Nếu dữ liệu đầu vào không khả dụng, hệ thống trả thông báo phù hợp với nguyên nhân.

### Trường hợp từ chối

- Candidate không có quyền sử dụng Source CV;
- Job hoặc CV không hợp lệ;
- yêu cầu nằm ngoài capability.

### Business Rules liên quan

- `BR-AI-01`
- `BR-AI-02`
- `BR-AI-08`

### Không thuộc chức năng này

- sửa CV nguồn;
- Apply Job;
- tự động Activate CV.

---

## F02 — Chuẩn bị nội dung nền cho Generated Draft

### Actor

- AI System / JOBHUB Backend, theo yêu cầu của Candidate.

### Mục tiêu

Chuẩn bị nội dung nền phù hợp để AI-V06 có thể tạo Generated Draft từ cả hai loại Source CV.

### Input business

- Source CV;
- nội dung nghề nghiệp đã chuẩn hóa;
- dữ liệu Candidate và CV nguồn được phép tái sử dụng.

### Tiền điều kiện

Source CV được hệ thống đọc và xử lý trong phạm vi quyền của Candidate.

### Luồng chính

1. Hệ thống xác định loại Source CV.
2. Với Generated CV, hệ thống sử dụng nội dung Generated hiện có làm baseline.
3. Với Uploaded CV, hệ thống chuyển đổi nội dung nghề nghiệp đã trích xuất thành baseline Generated theo khả năng dữ liệu hiện có.
4. Hệ thống bổ sung những trường cố định có nguồn hợp lệ.
5. Nội dung nền được sử dụng để kết hợp với kết quả tối ưu của AI.

### Kết quả

Có nội dung Generated baseline phù hợp để tạo Draft, kể cả khi chưa đầy đủ.

### Failure / Unknown behavior

Với Uploaded CV, những giá trị chưa xác định hoặc không ánh xạ được có thể để trống.

Không yêu cầu khôi phục đầy đủ mọi chi tiết của PDF nguồn.

### Trường hợp từ chối

- không thể truy cập Source CV hợp lệ;
- tài liệu hoặc dữ liệu nguồn không thể xử lý bằng capability hiện có.

### Business Rules liên quan

- `BR-AI-03`
- `BR-AI-04`
- `BR-AI-05`

### Không thuộc chức năng này

- chỉnh sửa Uploaded PDF;
- tạo định dạng CV mới;
- xác minh độc lập mọi claim nghề nghiệp.

---

## F03 — Tối ưu nội dung và tạo Generated CV Draft

### Actor

- AI System / JOBHUB Backend, theo yêu cầu của Candidate.

### Mục tiêu

Tạo một Generated CV Draft mới có nội dung nghề nghiệp được tối ưu theo Target Job.

### Input business

- Target Job;
- nội dung nghề nghiệp từ Source CV;
- Generated baseline;
- kết quả AI-V04 Evaluation;
- thông tin cần thiết để tạo CandidateCV mới.

### Tiền điều kiện

- F01 và các dữ liệu cần thiết của F02 khả dụng;
- Candidate có quyền thực hiện hành động tạo CV.

### Luồng chính

1. AI tiếp nhận context nghề nghiệp, Job và góp ý cải thiện.
2. AI tạo nội dung tối ưu cho những nhóm nội dung được phép chỉnh sửa.
3. Hệ thống tiếp nhận kết quả phù hợp output contract.
4. Hệ thống kết hợp nội dung AI với Generated baseline và những trường cố định.
5. Hệ thống tạo một CandidateCV mới thuộc loại Generated với trạng thái Draft.

### Kết quả

- Một Generated CV Draft mới được lưu;
- Source CV không bị thay đổi;
- Draft có thể chưa hoàn chỉnh theo quy tắc completeness hiện hành.

### Failure / Unknown behavior

- Nếu một provider không tạo được output hoàn tất và đúng contract do lỗi xử lý AI hoặc giới hạn provider, hệ thống thực hiện provider fallback.
- Nếu không có kết quả AI hợp lệ từ các provider khả dụng, hệ thống thông báo lỗi xử lý AI và không tạo kết quả thành công giả.
- Nếu kết quả AI hợp lệ nhưng không có nội dung thay đổi, hệ thống vẫn tạo Draft từ baseline.
- Lỗi lưu trữ là lỗi thực hiện action, không phải đánh giá tiêu cực về Candidate.

### Trường hợp từ chối

- hành động không được Candidate cho phép;
- vi phạm quyền truy cập;
- dữ liệu nguồn hoặc dependency bắt buộc không khả dụng;
- không thể tạo resource theo lifecycle hợp lệ.

### Business Rules liên quan

- `BR-AI-01`
- `BR-AI-03`
- `BR-AI-06`
- `BR-AI-07`
- `BR-AI-09`

### Không thuộc chức năng này

- tự động Activate hoặc Publish CV;
- cập nhật trực tiếp Source CV;
- tạo Match Score mới.

---

## F04 — Preview và tiếp tục quản lý Generated Draft

### Actor

- Candidate.

### Mục tiêu

Candidate có thể xem nội dung CV vừa được AI tạo và tiếp tục làm việc với CV Draft.

### Input business

- Generated CV Draft đã được tạo thành công.

### Tiền điều kiện

- Draft tồn tại;
- Candidate có quyền truy cập Draft.

### Luồng chính

1. Hệ thống cung cấp Generated Draft vừa tạo.
2. Candidate mở Preview.
3. Hệ thống hiển thị CV theo khả năng Preview Generated CV hiện hành.
4. Candidate xem xét nội dung và có thể tiếp tục chỉnh sửa bằng workflow quản lý CV.

### Kết quả

Candidate có thể kiểm tra bản CV mới trước khi quyết định sử dụng.

### Failure / Unknown behavior

Preview hoặc các thao tác tiếp theo có thể báo lỗi theo cơ chế hiện hành của Backend.

Draft chưa complete vẫn có thể Preview theo quy định của V7.

### Trường hợp từ chối

- Candidate không có quyền với Draft;
- Draft không tồn tại hoặc không còn khả dụng.

### Business Rules liên quan

- `BR-AI-02`
- `BR-AI-08`
- `BR-AI-10`

### Không thuộc chức năng này

- tự động chấp nhận nội dung thay Candidate;
- tự động Activate, đặt Default hoặc Apply Job.

---

# 11. AI Business Rules

## BR-AI-01 — Tối ưu theo một Target Job

Mỗi yêu cầu AI-V06 hướng đến một Job cụ thể và một Source CV được Candidate chọn.

Kết quả Matching/Evaluation liên quan được dùng làm context cải thiện, không thay thế dữ liệu CV và Job.

---

## BR-AI-02 — Authorization vẫn áp dụng

AI-V06 chỉ sử dụng những CV và Job mà Candidate được phép truy cập trong workflow hiện hành.

AI không tạo đường truy cập vượt qua ownership hoặc authorization.

---

## BR-AI-03 — Đầu ra là Generated Draft mới

AI-V06 tạo CandidateCV mới thuộc loại Generated, trạng thái `DRAFT`.

Source CV được giữ nguyên.

Draft không bắt buộc complete ngay khi được tạo.

---

## BR-AI-04 — Tái sử dụng dữ liệu nguồn

Generated baseline được hình thành từ dữ liệu nguồn hợp lệ.

Các trường ngoài phạm vi AI chỉnh sửa được hệ thống tái sử dụng hoặc bổ sung theo nguồn tương ứng, không yêu cầu AI tái tạo.

Đối với Generated CV, nội dung cá nhân và các trường cố định phù hợp được giữ từ CV nguồn.

---

## BR-AI-05 — Uploaded CV được chuyển đổi best-effort

Uploaded CV có thể được sử dụng làm Source CV để tạo Generated Draft.

Hệ thống khai thác nội dung nghề nghiệp đã được chuẩn hóa và chuyển đổi trong phạm vi cấu trúc Generated CV hỗ trợ.

Thông tin cá nhân phù hợp như họ tên, email, số điện thoại và ảnh đại diện được bổ sung từ Candidate Profile có quyền truy cập.

Những thông tin không có nguồn phù hợp hoặc không thể chuyển đổi không bắt buộc phải được tạo ra.

---

## BR-AI-06 — Giới hạn nhóm nội dung AI chỉnh sửa

AI-V06 chỉ thực hiện thay đổi nội dung trong bảy nhóm nghề nghiệp quy định tại Section 2.1.

AI không trực tiếp quyết định các trường quản lý, định danh, ownership, trạng thái, visibility, default CV hoặc metadata hệ thống.

Việc thêm, xóa, viết lại hoặc sắp xếp lại mục bên trong nhóm được phép chỉnh sửa thuộc phạm vi capability.

---

## BR-AI-07 — Chấp nhận output hợp lệ

Kết quả AI đã hoàn tất và đáp ứng output contract có cấu trúc của AI-V06 được chấp nhận để hình thành nội dung Draft, kể cả khi tất cả nhóm nội dung được phép chỉnh sửa đều là `null`.

Không áp dụng thêm semantic rejection gate nhằm bác bỏ nội dung chỉ vì đánh giá chủ quan về chất lượng viết lại, mức độ thay đổi hoặc khả năng tăng Match Score.

AI được định hướng tạo nội dung hữu ích và bám dữ liệu nguồn; việc kiểm tra nội dung cuối cùng thuộc Candidate.

---

## BR-AI-08 — Candidate chủ động yêu cầu action

Việc tạo Draft là side effect được phép sau yêu cầu rõ ràng của Candidate.

AI-V06 không tự kích hoạt việc tạo Draft chỉ vì quá trình Matching/Evaluation đã hoàn thành.

---

## BR-AI-09 — Technical failure khác business result

Nếu các provider khả dụng đều không tạo được kết quả hoàn tất và hợp lệ, yêu cầu thất bại về xử lý AI. Dependency không tạo được kết quả hợp lệ cũng là lỗi xử lý kỹ thuật.

Lỗi này không được biểu diễn thành Match Score thấp, đánh giá CV kém hoặc một kết quả tối ưu thành công giả định.

---

## BR-AI-10 — Giữ lifecycle hiện hành

AI-V06 không tự Activate, đặt Default, Publish hoặc Apply Job.

Generated Draft tiếp tục tuân thủ quy trình quản lý CandidateCV hiện hành.

---

# 12. Agent / Side-effect Boundary

AI-V06 được phép tạo một Generated Draft theo yêu cầu của Candidate, nhưng không được tự thực hiện các action quản lý CV khác.

| Action | AI-V06 được phép | Candidate confirmation |
|---|---:|---:|
| Đọc Source CV hợp lệ | ✓ | Thông qua yêu cầu |
| Đọc Target Job hợp lệ | ✓ | Thông qua yêu cầu |
| Sử dụng Evaluation context | ✓ | Thông qua workflow |
| Tạo nội dung CV tối ưu | ✓ | Thông qua yêu cầu |
| Tạo Generated Draft mới | ✓ | Candidate chủ động yêu cầu |
| Preview Draft | Hệ thống hỗ trợ | Candidate lựa chọn |
| Chỉnh sửa Source CV | ✗ | — |
| Activate Draft | ✗ | Candidate thực hiện riêng |
| Đặt Default CV | ✗ | Candidate thực hiện riêng |
| Archive hoặc xóa CV | ✗ | — |
| Apply Job | ✗ | Candidate thực hiện riêng |

Side effect của AI-V06 giới hạn ở việc tạo Generated Draft mới.

Một thao tác được Backend hỗ trợ không mặc định trở thành action được AI-V06 phép thực hiện.

---

# 13. Resource Lifecycle & State Transitions

AI-V06 tạo CandidateCV mới nhưng không định nghĩa một lifecycle CV độc lập.

Luồng nghiệp vụ:

1. Candidate nhận kết quả CV Evaluation.
2. Candidate yêu cầu tạo Draft tối ưu theo Job.
3. AI-V06 xử lý dữ liệu và tạo nội dung Generated CV.
4. Hệ thống tạo CandidateCV mới với trạng thái `DRAFT`.
5. Candidate Preview và tiếp tục sử dụng workflow CandidateCV hiện hành.

| Hành động | Trước | Sau | Actor |
|---|---|---|---|
| Yêu cầu tối ưu | Source CV tồn tại | Source CV giữ nguyên | Candidate |
| Tạo CV mới | Chưa có CV kết quả | Generated CV `DRAFT` | AI-V06 qua Backend |
| Preview | Generated CV `DRAFT` | Vẫn là `DRAFT` | Candidate |
| Chỉnh sửa Draft | Generated CV `DRAFT` | Theo lifecycle V7 | Candidate |
| Activate | Generated CV `DRAFT` đủ điều kiện | Theo lifecycle V7 | Candidate, ngoài AI-V06 |

AI-V06 không bổ sung trạng thái persisted riêng cho tiến trình tối ưu.

Việc tạo Draft không yêu cầu CV có completeness đầy đủ.

---

# 14. Authorization / Ownership / Tenant Boundary

Candidate chỉ được yêu cầu AI-V06 sử dụng Source CV thuộc quyền quản lý hợp lệ của mình.

Target Job phải được hệ thống cung cấp theo quyền truy cập và visibility hiện hành.

Backend chịu trách nhiệm xác định Candidate, Source CV, Job và những dữ liệu bổ trợ được phép sử dụng.

AI-V06 không được:

- truy cập CV của Candidate khác thông qua identifier không có quyền;
- dùng Candidate Profile của người khác để bổ sung nội dung;
- thay đổi ownership của CV nguồn;
- tạo Draft dưới quyền sở hữu của Candidate khác;
- sử dụng dữ liệu Company hoặc Job ngoài phạm vi truy cập hợp lệ.

Generated Draft mới thuộc quyền quản lý của Candidate đã thực hiện yêu cầu.

> AI-V06 không bổ sung multi-tenant boundary mới.

---

# 15. Failure & Fallback Behavior

AI-V06 phân biệt lỗi xử lý với kết quả nghiệp vụ.

## Invalid input

Nếu Candidate không có quyền truy cập hoặc Job/CV không hợp lệ, hệ thống không thực hiện tạo Draft từ resource đó.

## Extraction failure

Với Uploaded CV, nếu dữ liệu nghề nghiệp không thể được xử lý bằng capability hiện có, hệ thống có thể không đủ đầu vào để tạo Draft.

Nếu nội dung được xử lý thành công nhưng thiếu một số trường, hệ thống sử dụng phần dữ liệu khả dụng theo nguyên tắc best-effort.

Thiếu một số thông tin nghề nghiệp không tự động đồng nghĩa với thất bại toàn bộ capability.

## AI processing failure

Bao gồm các tình huống như:

- provider không khả dụng;
- lỗi mạng hoặc kết nối;
- lỗi xử lý từ provider;
- giới hạn thực thi khiến phản hồi không hoàn tất;
- kết quả không đáp ứng output contract.

Khi một provider không tạo được phản hồi hoàn tất và đúng output contract, hệ thống thực hiện provider fallback theo chính sách AI-V06.

Nếu không có provider nào tạo được kết quả hợp lệ, yêu cầu được xem là thất bại về xử lý AI; hệ thống không tạo kết quả tối ưu thành công giả.

## Dependency failure

Nếu Backend hoặc dependency cần thiết không thể đọc, xử lý hoặc lưu dữ liệu hợp lệ, hệ thống thông báo lỗi tương ứng.

Kết quả AI hợp lệ không được dùng để bỏ qua các quyền truy cập hoặc lifecycle invariant của CandidateCV.

## Insufficient evidence

Nội dung CV chưa đầy đủ hoặc thiếu một số thông tin nghề nghiệp không tự động là lỗi provider.

AI-V06 có thể tạo Generated Draft chưa complete từ dữ liệu khả dụng.

**Nguyên tắc chấp nhận:** Một phản hồi AI đã hoàn tất và đáp ứng output contract được dùng để tạo nội dung Draft, không bị từ chối bởi một lớp đánh giá lại chất lượng ngữ nghĩa.

---

# 16. AI Quality & Evaluation

AI-V06 được đánh giá theo khả năng tạo Generated Draft hữu ích, đúng phạm vi và sử dụng được trong JOBHUB.

Các dimension áp dụng:

- **Job relevance:** nội dung tối ưu có liên quan đến Target Job;
- **Content usefulness:** cách diễn đạt hoặc tổ chức nội dung có giá trị đối với CV;
- **Source alignment:** nội dung có mức độ phù hợp với thông tin nguồn;
- **Generated structure:** kết quả hình thành được nội dung Generated CV;
- **Uploaded conversion usefulness:** Generated Draft từ Uploaded CV sử dụng được dù có dữ liệu thiếu;
- **Action correctness:** tạo Draft mới, không sửa CV nguồn;
- **Lifecycle compatibility:** Draft có thể được Preview và tiếp tục quản lý;
- **Failure behavior:** phân biệt kết quả hợp lệ với lỗi xử lý kỹ thuật.

Quality evaluation được sử dụng để đánh giá và cải thiện capability, không tự động trở thành một semantic rejection gate trong runtime.

## 16.1. Representative cases

Các nhóm trường hợp tiêu biểu:

1. Generated CV có dữ liệu nghề nghiệp tương đối đầy đủ.
2. Generated Draft chưa complete.
3. Uploaded CV có nội dung nghề nghiệp trích xuất được.
4. Uploaded CV có dữ liệu thiếu hoặc không ánh xạ hoàn toàn sang Generated.
5. Job có yêu cầu phù hợp rõ ràng với Source CV.
6. Job có yêu cầu chưa được thể hiện trong Source CV.
7. AI đề xuất thay đổi ở nhiều nhóm nghề nghiệp.
8. AI chỉ thay đổi một số nhóm nghề nghiệp.
9. AI trả kết quả hợp lệ nhưng không đề xuất thay đổi.
10. AI thay đổi thứ tự hoặc số lượng các mục nghề nghiệp.
11. Provider không tạo được output hợp lệ.
12. Source CV hoặc Job không hợp lệ về quyền truy cập.
13. Draft tạo thành công nhưng chưa đạt completeness.

Không yêu cầu mọi case có kết quả diễn đạt giống nhau giữa các lần thực thi.

## 16.2. Acceptance

AI-V06 đạt yêu cầu business khi:

- thực hiện được luồng tối ưu CV theo Job đã xác định;
- hỗ trợ cả Generated và Uploaded CV theo phạm vi đã duyệt;
- tạo được Generated Draft mới từ output AI hợp lệ;
- giữ nguyên Source CV;
- bảo đảm chỉ những action được phép xảy ra;
- giữ quyền truy cập và lifecycle CandidateCV;
- hỗ trợ Preview Draft chưa complete;
- xử lý technical failure phù hợp;
- có evaluation đại diện cho những tình huống quan trọng.

Evaluation cần xem xét tính hữu ích và chất lượng nội dung thực tế.

Không thiết lập sẵn một ngưỡng tăng Match Score, mức độ thay đổi văn bản hoặc tỷ lệ bảo toàn từng claim làm điều kiện chấp nhận runtime.

Các tiêu chí đánh giá chi tiết có thể được xác định tại Evaluation Contract.

---

# 17. Lifecycle Invariants

Các invariant của AI-V06:

1. Source CV không bị AI-V06 chỉnh sửa.
2. Kết quả thành công tạo một Generated CandidateCV mới ở trạng thái `DRAFT`.
3. Generated Draft được phép chưa complete.
4. Candidate là chủ sở hữu của Draft được tạo theo yêu cầu của mình.
5. AI-V06 không vượt qua authorization và ownership hiện hành.
6. AI chỉ được thay đổi bảy nhóm nội dung nghề nghiệp thuộc scope.
7. Các trường hệ thống và thông tin cố định không do AI tự quyết định.
8. Uploaded CV không bị chỉnh sửa trực tiếp.
9. AI-V06 không tự Activate, đặt Default, Publish hoặc Apply Job.
10. Preview không tự làm thay đổi trạng thái Draft.
11. Output AI hợp lệ không bị bác bỏ bởi một semantic quality gate bổ sung.
12. Technical failure không được biểu diễn thành kết quả đánh giá Candidate tiêu cực.
13. AI-V06 không làm thay đổi Matching/Scoring Policy của các version trước.

Những invariant này áp dụng trong toàn bộ workflow tạo Draft, không tạo thêm lifecycle riêng cho AI-V06.

---

# 18. Các quyết định chủ động defer

Các capability sau không thuộc AI-V06:

- hội thoại nhiều lượt để chỉnh sửa CV;
- Agent tự chủ lựa chọn và thực hiện chuỗi hành động quản lý CV;
- chỉnh sửa trực tiếp Uploaded PDF;
- tự động thay đổi CV nguồn;
- tự động Activate hoặc đặt Default;
- tự động Apply Job;
- tự động chạy lại Matching/Scoring rồi điều chỉnh CV liên tục;
- tối ưu CV đồng thời cho nhiều Job;
- bổ sung CV template hoặc PDF renderer mới;
- duy trì lịch sử phiên bản nội dung tối ưu riêng cho AI-V06;
- bảo đảm tăng Match Score theo một ngưỡng cụ thể;
- cơ chế xác minh độc lập toàn bộ Candidate claim do AI viết.

Việc defer không ngăn các capability này được xem xét ở version sau.

---

# 19. Các quyết định chưa chốt

> Không còn AI/business decision chưa chốt ảnh hưởng đến phạm vi chức năng của AI-V06 đã thống nhất.

Những chi tiết cần thiết để triển khai nhưng không làm thay đổi business behavior đã chốt sẽ được làm rõ tại các contract và giai đoạn tương ứng, bao gồm:

- cách biểu diễn dữ liệu tối ưu có cấu trúc;
- ánh xạ Generated baseline và nội dung AI;
- cách truyền Evaluation context giữa các capability;
- nguồn và cách xác định metadata của Generated Draft trong giới hạn V7;
- xử lý kỹ thuật giữa các provider;
- tổ chức Backend–AI Kit;
- kiểm thử và evaluation implementation.

Các quyết định kỹ thuật không được tự mở rộng capability hoặc thay đổi Product Contract này.

---

# 20. Definition of AI Business Completion

AI-V06 được xem là hoàn thành về mặt business khi:

- F01–F04 được thực hiện đúng;
- các Business Rules được giữ;
- Candidate có thể tạo Generated Draft theo một Job đã chọn;
- cả Generated và Uploaded CV đều được hỗ trợ trong phạm vi đã duyệt;
- kết quả AI hợp lệ có thể hình thành Generated Draft;
- Source CV không thay đổi;
- Draft chưa complete vẫn có thể được Preview;
- Candidate tiếp tục kiểm soát lifecycle CV;
- authorization và ownership được giữ;
- failure/fallback behavior hoạt động phù hợp;
- quality evaluation cho thấy capability đáp ứng mục tiêu sử dụng;
- không có capability ngoài scope bị triển khai như một phần bắt buộc của AI-V06.

Các điều sau không tự động đủ để kết luận business completion:

- AI provider trả response thành công;
- response đúng schema nhưng workflow không tạo được Draft;
- Draft được tạo nhưng không thể sử dụng trong workflow CandidateCV;
- unit test pass nhưng action vượt ngoài phạm vi được phép;
- chỉ thử một trường hợp demo thành công.

AI-V06 không bắt buộc chứng minh CV sau tối ưu luôn tốt hơn bằng một mức điểm số cố định.

---

# 21. Implementation Boundary

Tài liệu này là:

**CANONICAL AI PRODUCT SPECIFICATION**

Tài liệu định nghĩa:

- AI-V06 phải cung cấp capability nghiệp vụ nào;
- dữ liệu và nguồn thông tin được phép sử dụng;
- AI được phép thay đổi phần nào của CandidateCV;
- hành động nào Candidate phải chủ động yêu cầu;
- Generated Draft có ý nghĩa và lifecycle như thế nào;
- những giới hạn nào không được vượt qua;
- behavior nào được xem là thành công hoặc thất bại về business;
- những yêu cầu chất lượng nào cần được đánh giá.

Tài liệu này **không định nghĩa**:

- LLM provider hoặc model cụ thể;
- prompt hoặc system prompt;
- temperature, token limit hoặc timeout;
- JSON Schema chi tiết;
- cách biểu diễn nullable fields;
- merge algorithm;
- function-calling implementation;
- Agent reasoning strategy;
- REST endpoint và HTTP method;
- controller, service hoặc route;
- cấu trúc source code Backend/AI Kit;
- MongoDB/Mongoose schema;
- chiến lược transaction, retry hoặc cache;
- frontend component;
- test framework;
- các ngưỡng kỹ thuật nội bộ.

Các quy tắc biểu diễn dữ liệu, tích hợp và thuật toán phải được xác định ở tầng contract phù hợp mà không thay đổi business semantics của AI-V06.

## Canonical hierarchy

1. **AI Product Specification** — Business và capability truth.
2. **AI Data Contract** — Data shape, semantics và persistence boundary.
3. **AI Engineering Contracts** — Kiến trúc, tích hợp, LLM và Agent behavior.
4. **Implementation** — Backend, AI Kit và Frontend.
5. **Tests / Evaluation** — Bằng chứng implementation và business quality.

Không phải mọi capability đều cần đầy đủ các Engineering Contract độc lập.

## Authority

| Nguồn | Authority |
|---|---|
| Approved AI Product Spec | Business và capability behavior |
| Approved AI Data Contract | Data và persistence semantics |
| Approved Engineering Contracts | Kiến trúc và algorithm |
| Source code, tests, evaluation | Implementation evidence |

Nếu implementation hoặc hành vi AI mâu thuẫn với Product Specification, business behavior phải tuân theo Product Specification.

Implementation cần được điều chỉnh hoặc Product Specification phải được con người chủ động cập nhật và phê duyệt lại.

**AI-V06 hoàn thành khi Candidate có thể sử dụng kết quả phân tích CV theo Job để tạo một Generated CV Draft mới, xem trước và tiếp tục quản lý CV đó trong JOBHUB, với những giới hạn nghiệp vụ đã xác định ở tài liệu này.**
