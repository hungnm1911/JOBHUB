# AI-V02 BR-AI-22 — Đánh giá chất lượng, bước 1

**Trạng thái:** Đã đánh giá thủ công một PDF từ Live Smoke #3; **chưa đủ Final Acceptance**.

## Căn cứ và phạm vi

- Authority: [AI-V02 Product Specification, BR-AI-22 và §16](../../product/ai-kit/versions/v02-uploaded-cv-normalization.md), [AI-V02 Data Contract, §6.1–6.3](../../data/ai-kit/versions/ai-v02-uploaded-cv-normalization-data-model.md).
- Nguồn: PDF fixture hai trang đã dùng trong Live Smoke #3 (SHA-256 `920030d32ab5a62cbc7974da8374707adb7753c60760c45c74194bd2919cc6bd`), cùng `llm-extraction.json`, `cv-match-profile.json`, `diagnostic-summary.json` ở thư mục local bị ignore `ai-kit/.smoke-output/run-IkK4DG/`. Tài liệu này không chép PDF, text đầy đủ, URL hay dữ liệu nhận dạng cá nhân.
- Phương pháp: xem hai trang PDF gốc được render, trích xuất lại **cùng PDF** bằng `extractPdfTextFromBuffer` của PDF.js để tái dựng text mà smoke đã gửi cho LLM (2.513 ký tự, khớp `textLength` trong diagnostic), rồi đối chiếu thủ công từng nhóm trong full extraction và profile. Không gọi provider. Kỳ vọng nội dung được đối chiếu với PDF gốc, nhưng reviewer đã thấy output; chưa có bộ nhãn độc lập/blinded cho Final Acceptance. Đây là một lần chạy đã lưu, không đo tính ổn định giữa các lần chạy.
- Smoke cũ: một request, HTTP 200, Responses `completed`, JSON/schema/evidence-structure/composition pass, `READY`. Profile sao chép nguyên vẹn phần `pdfContent` của extraction, đồng thời giữ metadata tổng hợp của smoke ở provenance riêng. Metadata đó là synthetic, nên mẫu này không kiểm chứng Backend ownership/authorization.

## Kết quả theo nhóm career information

| Nhóm (`pdfContent`) | Quan sát so với PDF gốc và text PDF.js | Đánh giá mẫu này |
|---|---|---|
| `careerPositioning` (2) | Giữ claim sinh viên năm thứ tư và mục tiêu thực tập. Các câu nằm ở phần mục tiêu của PDF và có trong text PDF.js, dù dấu tiếng Việt bị tách bằng khoảng trắng. | Đúng nguồn; không xác minh tình trạng hiện tại ngoài CV. |
| `professionalSummary` (1) | Giữ tự mô tả về nền tảng phát triển web và mong muốn kinh nghiệm thực tế; diễn đạt là “cho biết”, không biến thành fact đã xác minh. | Đúng nguồn. |
| `skills` (5) | Có đủ năm dòng kỹ năng được liệt kê trực tiếp: ngôn ngữ lập trình, thư viện/công nghệ, cơ sở dữ liệu, công cụ, kỹ năng mềm. Ví dụ JavaScript/TypeScript và MongoDB/MySQL khớp nguồn. Công nghệ chỉ nêu trong dự án/việc làm vẫn ở các nhóm tương ứng. | Đạt coverage cho phần kỹ năng liệt kê; không gán thời lượng/thành thạo. |
| `workExperiences` (1) | Đúng một công việc, giữ kỳ làm việc và ba hoạt động có căn cứ, gồm ReactJS/Next.js/TypeScript, Tailwind CSS và SSR. PDF ghi vai trò `Font-end`; output sửa thành `Front-end` theo ngữ cảnh. | Nội dung chính đúng; sửa chính tả vai trò là một diễn giải vượt khỏi nguyên văn, cần xem là rủi ro độ trung thành chứ không phải fact độc lập đã được xác minh. |
| `projects` (2) | Giữ hai dự án, kỳ, mô tả chức năng và danh sách công nghệ tương ứng; `role: null` vì PDF không nêu vai trò. PDF.js đổi thứ tự đọc trong mỗi khối (số lượng/ngày trước tên), nhưng LLM vẫn gắn đúng ngày và công nghệ cho từng dự án. | Đúng ở mẫu này; layout là rủi ro cho PDF khác. |
| `educations` (1) | Giữ cơ sở đào tạo, chuyên ngành và kỳ học theo PDF; `degree: null` đúng vì không có bằng cấp được nêu. | Đúng nguồn. |
| `certifications` (1), `languages` (0) | PDF và PDF.js đều có dòng `TOEIC : [điểm số]`. Output tạo certification tên `TOEIC` nhưng bỏ **điểm số** khỏi giá trị có cấu trúc; điểm chỉ còn trong evidence. Dòng này là kết quả bài thi, không xác nhận đã cấp chứng chỉ. Không suy ra trình độ ngôn ngữ cụ thể là đúng. | **Chưa đạt coverage/semantic accuracy ở chi tiết này:** điểm không dùng được như claim có cấu trúc; phân vào chứng chỉ thiếu căn cứ rõ ràng. Không suy diễn proficiency là điểm đạt. |
| `otherCareerClaims` (1) | Giữ các tự mô tả về động lực/học hỏi/tư duy/quan tâm sản phẩm web với cách dẫn “tự mô tả”. | Đúng nguồn, không tự xác minh. |
| `unresolvedContent` (4) | Hai dòng `Số lượng: 1` xuất hiện trong hai khối dự án nhưng không giải thích rõ là số người, số dự án hay đại lượng khác; để unresolved là thận trọng. Hai nhãn website được giữ, không bịa URL. PDF gốc có hai link annotation chứa đích URL, nhưng text-layer PDF.js chỉ trả nhãn, không trả đích. | Xử lý uncertainty đúng với **text LLM nhận**; mất đích link là giới hạn ở bước PDF text extraction, không phải lỗi diễn giải LLM. |

Header liên hệ/địa điểm cá nhân trong PDF không bị đưa vào career claim; không có negative assessment, số năm kinh nghiệm hay qualification mới được bịa ra trong mẫu này. Không thấy conflict nội tại đủ rõ để kiểm tra BR-AI-19.

## 21 cảnh báo evidence mismatch

Diagnostic ghi 31 evidence excerpts; 10 khớp sau collapse whitespace hiện tại, 21 bị cảnh báo `EXCERPT_NOT_FOUND`. Đối chiếu cả 21 path với PDF render và text PDF.js cho thấy **21/21 đều cùng nội dung nguồn** khi bỏ khoảng trắng chèn giữa ký tự: 16 excerpt trên một dòng, 5 excerpt trải qua các dòng PDF.js. Ví dụ text PDF.js tách `Ngôn ng ữ   l ậ p trình` trong khi evidence viết `Ngôn ngữ lập trình`; mô tả dự án còn bị ngắt dòng. Không tìm thấy excerpt diễn đạt lại hoặc mismatch nội dung thực sự trong 21 cảnh báo này. Việc bỏ mọi khoảng trắng chỉ là phép kiểm tra thủ công kèm PDF trực quan, **không** đề xuất làm validator/gate vì có thể ghép nhầm các từ khác nhau. Các `value` được diễn đạt lại riêng với evidence và được đánh giá theo nghĩa ở bảng trên.

## Phân định lỗi và điều kiện nghiệm thu

- **PDF extraction:** toàn bộ chữ nghề nghiệp nhìn thấy trên hai trang có mặt trong text layer, nhưng tách nhiều ký tự tiếng Việt, ngắt dòng và đổi thứ tự đọc trong khối dự án. Đích URL của hai annotation không vào text. Đây là nguyên nhân của 21 cảnh báo lexical và giới hạn thông tin link.
- **LLM interpretation:** điểm TOEIC bị bỏ khỏi giá trị claim; gán kết quả thi vào nhóm certification và sửa `Font-end` thành `Front-end` là các quyết định diễn giải cần xem xét. Không quy các điểm này cho PDF.js vì text nguồn vẫn có điểm và cách viết vai trò.
- **Đạt trong mẫu:** xử lý được PDF hai trang có text và nội dung nghề nghiệp phong phú; phần lớn claim có căn cứ và gắn đúng nhóm/ngữ cảnh; missing/uncertainty không thành đánh giá tiêu cực; profile giữ hai provenance; failure và authorization không được thử bằng smoke này.
- **Chưa đạt/chưa chứng minh:** chi tiết TOEIC nêu trên; một mẫu không chứng minh information coverage, semantic accuracy, conflict/failure correctness và chất lượng trên nhóm PDF đại diện theo BR-AI-22/§16. `READY` và các gate cấu trúc không thay cho quality acceptance.

## Mẫu còn thiếu và bước tiếp theo

Mẫu hiện tại bao phủ text rõ, nhiều trang, thông tin phong phú và vài trường hợp chưa ánh xạ rõ. [Evaluation Contract](ai-v02-br-ai-22-evaluation-contract.md) tái sử dụng Smoke #3 cùng hai synthetic PDF có [expected ledger độc lập](ai-v02-br-ai-22-expected-ledger.md); [báo cáo ba case](ai-v02-br-ai-22-evaluation-report.md) tổng hợp findings. Contract chỉ ra `otherCareerClaims.value` có thể giữ nguyên tên bài thi và điểm theo schema hiện có; field điểm thi có kiểu riêng chỉ là lựa chọn mở rộng nếu consumer cần. Product Owner đã phê duyệt §16.2 cho review thủ công ba PDF, không có ngưỡng accuracy % bắt buộc. Quan sát một PDF và 21 lexical warnings không tạo ra ngưỡng chất lượng. AI-V02 vẫn **chưa đủ điều kiện kết luận Final Acceptance**.
