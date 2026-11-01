# V17 — Rich Text Content Integration

> **File:** `docs/product/backend/versions/v17-rich-text-content-integration.md`
>
> **Vai trò:** Canonical Product Specification
>
> **Ngôn ngữ:** Tiếng Việt
>
> **Mục đích:** Xác định business/functional truth của Backend V17.

---

## 1. Mục tiêu

V17 mở rộng khả năng soạn thảo, lưu trữ và hiển thị nội dung có định dạng (Rich Text) cho ba miền nghiệp vụ hiện hữu của JOBHUB:

- Job Description;
- Generated CV;
- Company Description.

Sau khi V17 hoàn thành, hệ thống hỗ trợ nội dung Rich Text theo phạm vi định dạng tương ứng, đồng thời duy trì khả năng sử dụng plain text của các chức năng hiện tại.

V17 hướng tới ba kết quả chính:

1. Nội dung được soạn thảo có định dạng có thể được lưu, đọc lại và hiển thị nhất quán.
2. Các chức năng hiện hữu như Job Search, AI Kit, CV completeness, lifecycle và Harvard PDF tiếp tục hoạt động theo các yêu cầu nghiệp vụ đã được phê duyệt.
3. Dữ liệu cũ và các consumer chưa sử dụng Rich Text tiếp tục được hỗ trợ mà không bắt buộc chuyển đổi đồng loạt.

V17 là phiên bản mở rộng khả năng biểu diễn nội dung, không phải phiên bản thiết kế lại các nghiệp vụ Job, CV hoặc Company.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

- Hỗ trợ Rich Text Full Formatting cho Job Description.
- Hỗ trợ Rich Text Minimal Formatting cho một số trường nội dung của Generated CV.
- Hỗ trợ Rich Text Full Formatting cho Company Description.
- Lưu giữ hai biểu diễn HTML và plain text của nội dung Rich Text.
- Mở rộng khả năng tiếp nhận và trả về nội dung có định dạng tại các chức năng/API hiện hữu có liên quan.
- Hiển thị nội dung Rich Text an toàn, tương thích với dữ liệu plain text trước V17.
- Duy trì nội dung plain text phục vụ Job Search, AI Kit và các consumer hiện hữu.
- Hỗ trợ định dạng Minimal trong Harvard PDF của Generated CV.
- Bảo toàn tính nhất quán giữa Generated CV và snapshot được tạo sau khi V17 có hiệu lực.
- Bổ sung khả năng migration dữ liệu legacy theo hướng tương thích, không làm thay đổi nội dung nghiệp vụ gốc.
- Tích hợp Company Description vào Company Onboarding và các bề mặt hiển thị Company hiện hữu trong giai đoạn cuối của V17.

### 2.2. Ngoài phạm vi

- Xây dựng toàn bộ Job Create/Edit Form hoặc Generated CV Builder chưa tồn tại.
- Thay đổi các nghiệp vụ tạo, duyệt, publish, close hoặc quản lý Job.
- Thay đổi CV completeness, trạng thái hoặc lifecycle.
- Thay đổi Job Search/filter/relevance ranking.
- Thay đổi các AI use case, LLM prompts, AI schemas hoặc công thức scoring.
- Bổ sung LLM inference mới để xử lý Rich Text.
- Chuyển Uploaded CV PDF thành Generated CV Rich Text.
- Biến toàn bộ Generated CV thành một tài liệu HTML tự do.
- Thay đổi bố cục Harvard Template.
- Viết lại nội dung của application snapshot lịch sử.
- Thiết kế lại Company Onboarding, Company Approval hoặc phân quyền Company.

V17 không bổ sung chức năng ngoài phạm vi nêu trên.

---

## 3. Dependency với các version trước

V17 sử dụng và mở rộng các nghiệp vụ, dữ liệu và chức năng đã có:

- **Backend V05 — Job Approval Lifecycle:** Job content và các quy tắc quản lý vòng đời Job.
- **Backend V07 — Candidate Profile & CV Library:** Generated CV, cấu trúc nội dung CV, completeness và lifecycle.
- **Backend V08 — Job Discovery:** Tìm kiếm, lọc và xếp hạng Job.
- **Backend V09 — Candidate Direct Apply:** Application và CV snapshot tại thời điểm ứng tuyển.
- **Backend V15 — Job Invitation:** Invited CV snapshot tại Send và Submitted CV Snapshot được copy khi Accept.
- **Các version Company hiện hữu:** Company Profile, Onboarding và Approval.
- **Frontend Rich Text V04:** RichTextEditor, RichTextViewer và hai preset Full/Minimal.
- **AI-V01 đến AI-V06:** Các chức năng chuẩn hóa, matching, evaluation, recommendation và CV optimization.

Các hợp đồng nghiệp vụ đã được phê duyệt tiếp tục có hiệu lực.

V17 chỉ mở rộng khả năng biểu diễn và sử dụng nội dung; không thay thế những quy tắc nghiệp vụ đã được xác lập ở các version trước.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Rich Text Content

Nội dung văn bản có thể bao gồm các định dạng trình bày được hệ thống hỗ trợ.

Rich Text không làm thay đổi ý nghĩa nghiệp vụ của nội dung.

### 4.2. Full Formatting

Tập định dạng dành cho Job Description và Company Description.

Bao gồm các khả năng đã được chấp nhận ở Frontend V04: định dạng chữ, heading, danh sách, liên kết, căn lề, font, kích thước chữ, màu và highlight.

### 4.3. Minimal Formatting

Tập định dạng giới hạn dành cho Generated CV.

Bao gồm bold, italic, underline, danh sách và liên kết. Các thao tác chỉnh sửa như undo/redo tiếp tục được hỗ trợ.

Minimal Formatting phục vụ nội dung CV nằm trong cấu trúc Harvard Template, không cho phép tùy biến bố cục tổng thể.

### 4.4. HTML Representation

Biểu diễn nội dung Rich Text có lưu giữ thông tin định dạng.

HTML Representation chỉ chứa nội dung và định dạng thuộc phạm vi được hệ thống hỗ trợ.

### 4.5. Plain Text Representation

Biểu diễn văn bản không chứa markup định dạng HTML.

Plain text tiếp tục phục vụ các chức năng hiện hữu phụ thuộc vào văn bản thuần.

### 4.6. Legacy Content

Nội dung được tạo trước khi hỗ trợ Rich Text hoặc nội dung được cung cấp từ nguồn không có biểu diễn HTML.

Legacy Content vẫn là dữ liệu hợp lệ theo các quy tắc nghiệp vụ hiện hành.

### 4.7. Các chủ thể nghiệp vụ

- **Company Staff:** Người dùng có quyền thao tác Job hoặc Company theo các hợp đồng hiện hữu.
- **Candidate:** Người dùng có quyền quản lý Generated CV của mình.
- **Người xem nội dung:** Người dùng được phép xem Job, Company hoặc CV theo các quyền truy cập hiện hữu.
- **Hệ thống:** Thành phần xử lý, duy trì và cung cấp các biểu diễn nội dung.

V17 không bổ sung actor hoặc vai trò phân quyền mới.

---

## 5. Quan hệ nghiệp vụ chính

```text
Company
   |
   | 1 — N
   v
  Job
   |
   v
Job Description
   |
   +-- HTML Representation
   +-- Plain Text Representation


Candidate
   |
   | 1 — N
   v
Generated CV
   |
   v
Rich Text Fields
   |
   +-- HTML Representation
   +-- Plain Text Representation


Company
   |
   v
Company Description
   |
   +-- HTML Representation
   +-- Plain Text Representation
```

Mỗi nội dung Rich Text có một nội dung nghiệp vụ nhưng có thể tồn tại dưới hai biểu diễn khác nhau.

HTML phục vụ trình bày có định dạng. Plain text phục vụ các chức năng hiện hữu cần văn bản thuần.

Generated CV tiếp tục giữ cấu trúc các section và field theo V07.

Application snapshot tiếp tục gắn với nội dung CV tại thời điểm capture theo nghiệp vụ hiện hành.

V17 không bổ sung quan hệ sở hữu nghiệp vụ mới.

---

## 6. Trạng thái nghiệp vụ

V17 không định nghĩa trạng thái nghiệp vụ mới cho Job, Generated CV, Company hoặc Application.

Các trạng thái hiện hữu tiếp tục được sử dụng theo những version tương ứng.

Việc một nội dung có hoặc không có HTML Representation không cấu thành trạng thái nghiệp vụ mới.

---

## 7. Tổ hợp trạng thái hợp lệ

V17 không có state combination cần định nghĩa riêng.

Việc hỗ trợ Rich Text không tạo ra tổ hợp trạng thái mới giữa Job, Generated CV, Company hoặc Application.

Các tổ hợp trạng thái hợp lệ tiếp tục tuân theo contract của từng miền nghiệp vụ.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Người dùng thao tác nội dung
        |
        v
Sử dụng Rich Text hoặc plain text
        |
        v
Hệ thống tiếp nhận nội dung
        |
        v
Duy trì biểu diễn nội dung phù hợp
        |
        +-------------------------+
        |                         |
        v                         v
HTML Representation      Plain Text Representation
        |                         |
        v                         v
Hiển thị có định dạng     Consumer hiện hữu
        |                         |
        +------------+------------+
                     |
                     v
       Nội dung nhất quán trong hệ thống
```

Đối với nội dung legacy, hệ thống tiếp tục hỗ trợ đọc và hiển thị plain text.

Đối với Generated CV, Harvard PDF phản ánh các định dạng Minimal được hỗ trợ mà vẫn giữ bố cục Harvard.

Đối với Company Description, việc tích hợp vào Company Onboarding hiện hữu được thực hiện ở giai đoạn cuối, sau phần Job và Generated CV.

---

# 9. Functional Requirements

## F01 — Job Description Rich Text

### Actor

- Company Staff có quyền tạo hoặc cập nhật Job theo contract hiện hành.

### Mục tiêu

Cho phép Job Description sử dụng Full Formatting mà không làm thay đổi nghiệp vụ Job hoặc hoạt động của các chức năng phụ thuộc vào nội dung mô tả.

### Tiền điều kiện

- Actor có quyền thao tác Job.
- Job đang ở trạng thái được phép tạo hoặc chỉnh sửa nội dung theo lifecycle hiện hành.

### Luồng chính

1. Actor cung cấp Job Description có định dạng Full.
2. Hệ thống tiếp nhận nội dung và duy trì biểu diễn HTML hợp lệ.
3. Hệ thống duy trì biểu diễn plain text tương ứng.
4. Nội dung được cung cấp để đọc và hiển thị tại các chức năng Job có liên quan.
5. Các chức năng Search và AI tiếp tục sử dụng biểu diễn plain text.

### Kết quả

- Job Description có thể hiển thị với định dạng được hỗ trợ.
- Biểu diễn plain text được duy trì cho các consumer hiện hữu.
- Nội dung Job cũ không có HTML vẫn được sử dụng bình thường.
- Lifecycle và quy tắc truy cập Job không thay đổi.

### Trường hợp từ chối

- Actor không có quyền thao tác Job.
- Job không cho phép cập nhật nội dung theo trạng thái hiện hành.
- Nội dung không đáp ứng các quy tắc validation áp dụng cho Job.

### Business Rules liên quan

- `BR-01`
- `BR-02`
- `BR-03`
- `BR-04`
- `BR-05`
- `BR-08`

### Không thuộc chức năng này

- Xây dựng mới toàn bộ Job Form.
- Thay đổi Job Approval/Publish/Close.
- Thay đổi Job Search hoặc AI scoring.

---

## F02 — Generated CV Rich Text

### Actor

- Candidate sở hữu Generated CV.

### Mục tiêu

Cho phép các trường nội dung được chọn của Generated CV sử dụng Minimal Formatting, đồng thời giữ nguyên cấu trúc và nghiệp vụ của Generated CV.

### Tiền điều kiện

- Candidate có quyền thao tác Generated CV.
- CV đang ở trạng thái cho phép chỉnh sửa theo contract hiện hành.

### Luồng chính

1. Candidate chỉnh sửa nội dung tại những trường được hỗ trợ Rich Text.
2. Hệ thống tiếp nhận nội dung theo Minimal Formatting.
3. Hệ thống duy trì biểu diễn HTML và plain text tương ứng của từng trường.
4. Nội dung được đọc lại và hiển thị theo định dạng được hỗ trợ.
5. Các chức năng CV hiện hữu tiếp tục sử dụng dữ liệu theo contract đã được phê duyệt.

### Kết quả

Các trường được hỗ trợ Rich Text gồm:

- `professionalSummary`;
- `workExperiences[].description`;
- `projects[].description`.

Các field plain text hiện hữu tiếp tục được duy trì.

`workExperiences[].achievements[]` giữ cấu trúc mảng chuỗi hiện tại.

Các section và field còn lại của Generated CV không thay đổi phạm vi định dạng trong V17.

### Trường hợp từ chối

- Candidate không sở hữu CV.
- CV không ở trạng thái được phép chỉnh sửa.
- Nội dung sau khi chuẩn hóa định dạng không đáp ứng validation nghiệp vụ hiện hành.

### Business Rules liên quan

- `BR-01`
- `BR-02`
- `BR-03`
- `BR-06`
- `BR-07`
- `BR-08`

### Không thuộc chức năng này

- Chuyển toàn bộ Generated CV thành một HTML document.
- Thay đổi cấu trúc section của Harvard CV.
- Bổ sung Rich Text cho `achievements[]`.
- Thay đổi Uploaded CV PDF.
- Xây dựng toàn bộ CV Builder chưa có.

---

## F03 — Đọc và hiển thị nội dung Rich Text

### Actor

- Người dùng được phép xem Job, Generated CV hoặc Company theo các contract hiện hành.

### Mục tiêu

Cung cấp nội dung có định dạng cho những bề mặt hiển thị có liên quan, đồng thời bảo đảm nội dung legacy và plain text vẫn được đọc đúng.

### Tiền điều kiện

- Nội dung thuộc phạm vi truy cập hợp lệ của người xem.

### Luồng chính

1. Người dùng truy cập nội dung được phép xem.
2. Hệ thống cung cấp biểu diễn nội dung phù hợp.
3. Nếu có HTML hợp lệ, giao diện có thể hiển thị nội dung theo định dạng được hỗ trợ.
4. Nếu không có HTML, nội dung plain text được hiển thị như văn bản thông thường.
5. Các consumer chỉ cần plain text tiếp tục sử dụng biểu diễn plain text.

### Kết quả

- Nội dung Rich Text được hiển thị nhất quán với phạm vi định dạng tương ứng.
- Nội dung legacy tiếp tục đọc được.
- Nội dung plain text không bị diễn giải nhầm thành HTML.
- Các bề mặt hiển thị không làm phát sinh quyền truy cập mới.

### Trường hợp từ chối

- Người xem không có quyền truy cập nội dung theo contract hiện hành.

### Business Rules liên quan

- `BR-01`
- `BR-03`
- `BR-04`
- `BR-08`
- `BR-09`

### Không thuộc chức năng này

- Thiết kế lại các trang Job, CV hoặc Company.
- Thay đổi quyền xem dữ liệu.
- Bổ sung định dạng ngoài Full/Minimal đã được chấp nhận.

---

## F04 — Harvard PDF và CV Snapshot Compatibility

### Actor

- Candidate sử dụng chức năng preview/download Generated CV.
- Các actor được phép truy cập CV snapshot theo nghiệp vụ Application hiện hành.
- Các actor được phép truy cập invited CV snapshot theo nghiệp vụ Job Invitation V15 hiện hành.

### Mục tiêu

Bảo đảm nội dung Rich Text của Generated CV được thể hiện phù hợp trong Harvard PDF và được bảo toàn trong snapshot mới mà không ảnh hưởng dữ liệu lịch sử.

### Tiền điều kiện

- Generated CV hoặc CV snapshot được truy cập theo quyền và lifecycle hiện hành.

### Luồng chính

1. Generated CV có thể chứa các trường Rich Text thuộc phạm vi F02.
2. Khi preview/download PDF, hệ thống thể hiện các định dạng Minimal được hỗ trợ trong bố cục Harvard.
3. Nội dung CV không có HTML tiếp tục được thể hiện bằng plain text.
4. Khi tạo application snapshot mới, nội dung CV tại thời điểm capture được bảo toàn, bao gồm biểu diễn HTML nếu có.
5. Với Job Invitation, snapshot Generated CV tại Send bảo toàn HTML nếu có; khi Accept, Application sử dụng bản copy của snapshot đã khóa theo V15.
6. Snapshot lịch sử tiếp tục được đọc và sử dụng theo contract cũ.

### Kết quả

- Harvard PDF hỗ trợ bold, italic, underline, danh sách và thông tin liên kết ở mức phù hợp với template.
- Bố cục Harvard tiếp tục được duy trì.
- Không làm thay đổi nội dung nghiệp vụ của CV.
- Snapshot mới phản ánh nội dung tại thời điểm capture.
- Đường Send → Accept của Job Invitation bảo toàn HTML đã capture mà không đọc lại CV nguồn.
- Snapshot cũ không bị viết lại.

### Trường hợp từ chối

Áp dụng các điều kiện từ chối hiện hữu của chức năng CV preview/download và truy cập application snapshot.

### Business Rules liên quan

- `BR-06`
- `BR-07`
- `BR-08`

### Không thuộc chức năng này

- Tạo Harvard Template mới.
- Cho phép tùy chỉnh bố cục PDF tự do.
- Chuyển đổi lại toàn bộ snapshot lịch sử.
- Thay đổi quy trình ứng tuyển.

---

## F05 — Legacy Compatibility và Data Migration

### Actor

- Hệ thống.

### Mục tiêu

Duy trì khả năng sử dụng dữ liệu hiện hữu và hỗ trợ chuyển đổi dữ liệu legacy khi phù hợp, không làm thay đổi nội dung hoặc trạng thái nghiệp vụ gốc.

### Tiền điều kiện

- Dữ liệu thuộc phạm vi V17.
- Dữ liệu cần chuyển đổi đáp ứng điều kiện tương thích với lifecycle và các ràng buộc hiện hành.

### Luồng chính

1. Hệ thống nhận diện nội dung legacy chưa có biểu diễn HTML.
2. Nội dung legacy tiếp tục có thể được sử dụng dưới dạng plain text.
3. Hệ thống hỗ trợ xem trước phạm vi và ảnh hưởng của việc chuyển đổi.
4. Khi việc chuyển đổi được cho phép, hệ thống có thể bổ sung biểu diễn HTML tương ứng cho dữ liệu đủ điều kiện.
5. Nội dung plain text nghiệp vụ gốc được bảo toàn.
6. Dữ liệu không được chuyển đổi tiếp tục sử dụng bình thường.

### Kết quả

- Không bắt buộc toàn bộ dữ liệu cũ phải có HTML.
- Có khả năng migration theo hướng bổ sung và tương thích.
- Việc thực hiện lại migration không gây thay đổi nội dung nghiệp vụ ngoài ý muốn.
- Dữ liệu lịch sử thuộc phạm vi bất biến tiếp tục được giữ nguyên.

### Trường hợp từ chối

- Bản ghi không thuộc phạm vi chuyển đổi hợp lệ.
- Việc chuyển đổi xung đột với lifecycle hoặc quy tắc bảo toàn dữ liệu hiện hành.

### Business Rules liên quan

- `BR-01`
- `BR-07`
- `BR-10`

### Không thuộc chức năng này

- Viết lại hàng loạt Job content đã khóa.
- Chỉnh sửa application snapshot lịch sử.
- Thay đổi nội dung plain text gốc để phục vụ migration.
- Bắt buộc chuyển đổi mọi bản ghi trước khi hệ thống có thể sử dụng.

---

## F06 — Company Description Rich Text

### Actor

- Company Staff có quyền thao tác Company Profile theo contract hiện hành.
- Các actor được phép xem Company Description.

### Mục tiêu

Bổ sung Full Formatting cho Company Description trong Company Onboarding và các bề mặt hiển thị Company hiện hữu.

### Tiền điều kiện

- Company và Company Staff đáp ứng các điều kiện truy cập/chỉnh sửa hiện hành.

### Luồng chính

1. Company Staff cung cấp hoặc cập nhật Company Description có định dạng Full trong luồng hiện hữu.
2. Hệ thống duy trì biểu diễn HTML và plain text của nội dung.
3. Nội dung được đọc lại và hiển thị tại những bề mặt Company có liên quan.
4. Những bản ghi Company cũ không có HTML tiếp tục hiển thị plain text.
5. Company Onboarding và Approval tiếp tục tuân theo các quy tắc hiện hành.

### Kết quả

- Company Description hỗ trợ Full Formatting.
- Company Onboarding đang có được tích hợp trực tiếp.
- Các bề mặt xem Company Description có thể hiển thị nội dung có định dạng.
- Các quy tắc nghiệp vụ Company được giữ nguyên.

### Trường hợp từ chối

- Actor không có quyền cập nhật Company.
- Company không cho phép cập nhật nội dung theo quy tắc hiện hành.
- Nội dung không đáp ứng validation hiện hành.

### Business Rules liên quan

- `BR-01`
- `BR-02`
- `BR-03`
- `BR-08`
- `BR-09`

### Không thuộc chức năng này

- Thiết kế lại Company Onboarding.
- Thay đổi Company Approval.
- Thay đổi ownership hoặc multi-tenant boundary.
- Bổ sung quy trình Company mới.

---

# 10. Business Rules

## BR-01 — Dual Representation Compatibility

Nội dung thuộc phạm vi V17 có thể được duy trì dưới hai biểu diễn: HTML và plain text.

Plain text tiếp tục được hỗ trợ độc lập khi không có HTML.

Việc bổ sung Rich Text không làm mất khả năng sử dụng dữ liệu cũ hoặc các consumer hiện hữu.

## BR-02 — Content Representation Consistency

Khi người dùng cập nhật nội dung thông qua Rich Text, HTML hợp lệ và plain text tương ứng phải phản ánh cùng một nội dung có nghĩa.

Đối với cùng một trường nội dung:

- Nếu cập nhật bằng HTML, hệ thống duy trì plain text tương ứng từ nội dung HTML được chấp nhận.
- Nếu chỉ cập nhật bằng plain text, biểu diễn HTML cũ của trường đó không được tiếp tục đại diện cho nội dung đã thay đổi.
- Nếu trường không được cập nhật, các biểu diễn hiện hữu của trường đó được giữ nguyên.
- Nếu cùng một nội dung được cung cấp dưới cả hai biểu diễn, HTML được chấp nhận là nguồn xác định plain text tương ứng.

Các quy tắc trên không thay đổi quyền cập nhật hoặc lifecycle của resource.

## BR-03 — Supported Formatting Boundary

Job Description và Company Description sử dụng Full Formatting.

Generated CV chỉ sử dụng Minimal Formatting tại các trường được xác định trong F02.

Nội dung HTML được chấp nhận và hiển thị phải nằm trong phạm vi định dạng an toàn được hệ thống hỗ trợ.

Định dạng HTML ngoài preset được sanitize/normalize về phạm vi hỗ trợ; không từ chối nội dung chỉ vì định dạng đó không được hỗ trợ. Validation nghiệp vụ hiện hữu vẫn áp dụng cho nội dung sau chuẩn hóa.

Không bổ sung phạm vi định dạng mới hoặc quy tắc từ chối nghiệp vụ mới chỉ vì V17 hỗ trợ Rich Text.

## BR-04 — Existing Consumer Compatibility

Job Search, keyword filtering, relevance ranking và Vector Search tiếp tục sử dụng nội dung theo các contract đã được phê duyệt.

AI Kit tiếp tục nhận plain text và cấu trúc dữ liệu hiện hữu; HTML markup không trở thành nội dung đầu vào AI chỉ vì có Rich Text.

V17 không thay đổi AI scoring, prompts, structured output hoặc các quy tắc inference hiện hành.

Việc chuyển đổi biểu diễn nội dung không sử dụng LLM inference mới.

## BR-05 — Job Lifecycle Preservation

Rich Text không mở rộng quyền chỉnh sửa Job.

Quyền tạo/cập nhật nội dung, điều kiện submit, approval, publish và các trạng thái Job tiếp tục tuân theo lifecycle hiện hữu.

Không tự viết lại nội dung Job đã bị khóa để áp dụng định dạng mới.

## BR-06 — Generated CV Completeness Preservation

Generated CV tiếp tục tuân theo completeness và lifecycle hiện hữu.

Sự tồn tại của HTML markup không được coi là bằng chứng rằng trường nội dung có thông tin.

Completeness tiếp tục được xác định từ nội dung văn bản có nghĩa theo các quy tắc đã phê duyệt.

V17 không bổ sung điều kiện completeness mới.

## BR-07 — Harvard PDF và Snapshot Preservation

Harvard PDF phản ánh các định dạng Minimal được hỗ trợ mà vẫn giữ bố cục Harvard Template.

Nội dung Generated CV mới được capture vào application snapshot phải bảo toàn nội dung tại thời điểm capture, bao gồm HTML nếu có.

Với Job Invitation V15, invited CV snapshot tại Send bảo toàn nội dung HTML Generated CV nếu có; khi Accept, Application dùng bản copy của snapshot đó theo contract hiện hữu.

Application snapshot lịch sử không bị sửa đổi để áp dụng Rich Text.

Các cơ chế lưu và đọc snapshot đã có tiếp tục được duy trì.

## BR-08 — Existing Authorization and Ownership

Mọi thao tác đọc, tạo, cập nhật hoặc sử dụng nội dung tiếp tục chịu các quy tắc authorization, ownership và lifecycle hiện hành của Job, Generated CV và Company.

Rich Text không làm phát sinh quyền truy cập hoặc quyền chỉnh sửa mới.

## BR-09 — Safe Rendering and Legacy Display

HTML được hiển thị theo phạm vi định dạng an toàn được hệ thống hỗ trợ.

Plain text phải được hiển thị như văn bản, không bị suy diễn thành HTML từ các ký tự có trong nội dung.

Không có HTML không đồng nghĩa dữ liệu không hợp lệ hoặc bắt buộc migration.

## BR-10 — Non-destructive Migration

Migration của V17 nhằm bổ sung khả năng biểu diễn nội dung, không làm thay đổi dữ liệu nghiệp vụ gốc.

Migration phải hỗ trợ xem trước tác động và khả năng thực hiện lại an toàn.

Chỉ dữ liệu đủ điều kiện theo contract hiện hành mới thuộc phạm vi chuyển đổi.

Không tự động chuyển đổi hoặc viết lại các bản ghi lịch sử có ràng buộc bất biến.

---

# 11. State Transitions

V17 không định nghĩa state transition nghiệp vụ mới.

Các state transition của Job, Generated CV, Company và Application tiếp tục tuân theo Product Specification tương ứng.

Việc tạo, cập nhật hoặc thiếu HTML Representation không làm phát sinh state transition.

---

# 12. Authorization và ownership boundary

V17 kế thừa authorization và ownership boundary hiện hành.

| Hành động | Actor được phép | Resource / Scope | Điều kiện |
|---|---|---|---|
| Cập nhật Job Description | Company Staff có quyền | Job thuộc phạm vi được quản lý | Theo Job lifecycle hiện hành |
| Cập nhật Generated CV Rich Text | Candidate sở hữu CV | Generated CV của Candidate | Theo CV lifecycle hiện hành |
| Cập nhật Company Description | Company Staff có quyền | Company Profile thuộc phạm vi được quản lý | Theo Company contract hiện hành |
| Xem Rich Text | Actor có quyền xem | Job/CV/Company tương ứng | Theo visibility và quyền truy cập hiện hành |
| Truy cập CV snapshot | Actor có quyền theo Application contract | Snapshot tương ứng | Theo quyền truy cập và lifecycle hiện hành |

Không phát sinh actor hoặc ownership rule mới.

---

# 13. Multi-tenant boundary

V17 không bổ sung multi-tenant boundary mới.

Job và Company Description tiếp tục thuộc phạm vi Company theo contract hiện hành.

Quyền thao tác Company và Job được xác định từ quan hệ và quyền hợp lệ đã được hệ thống quản lý.

Không cho phép thay đổi hoặc xem nội dung của tenant khác ngoài các quyền truy cập đã được phê duyệt.

Generated CV tiếp tục thuộc Candidate sở hữu CV.

Việc có HTML Representation không ảnh hưởng cách xác định owner hoặc tenant.

---

# 14. Lifecycle invariants

Trong toàn bộ V17, các invariant sau phải được bảo toàn:

1. Job lifecycle, approval và visibility không thay đổi vì Rich Text.
2. Job Search/filter/relevance ranking tiếp tục tuân theo contract hiện hành.
3. AI Kit và Vector Search tiếp tục sử dụng dữ liệu ngữ nghĩa theo contract đã được phê duyệt, không nhận HTML markup như nội dung nghiệp vụ mới.
4. Generated CV giữ nguyên cấu trúc, completeness và lifecycle.
5. Harvard PDF giữ bố cục Harvard và hỗ trợ định dạng Minimal trong phạm vi V17.
6. Application snapshot lịch sử không bị viết lại.
7. Company Onboarding, Approval, ownership và multi-tenant boundary không thay đổi.
8. Nội dung legacy tiếp tục được đọc và sử dụng ngay cả khi không có HTML.
9. Cập nhật nội dung không để lại biểu diễn HTML lỗi thời khác với nội dung plain text tương ứng.
10. V17 không tạo thêm LLM inference hoặc thay đổi hành vi của các AI use case hiện có.

---

# 15. Các quyết định chủ động defer

Các nội dung sau được chủ động để ngoài V17:

- Xây dựng toàn bộ Job Form và Generated CV Builder chưa có.
- Rich Text cho `achievements[]` hoặc các trường Generated CV ngoài F02.
- Mở rộng Full Formatting cho Generated CV.
- Thay đổi Harvard Template hoặc bổ sung template CV mới.
- Rich Text cho Uploaded CV PDF.
- Thay đổi Job Search, AI scoring, recommendation hoặc các AI use case.
- Migration bắt buộc toàn bộ dữ liệu lịch sử.
- Thiết kế lại giao diện và quy trình Company Onboarding/Approval.

Những nội dung này có thể được đánh giá trong version khác khi có nhu cầu.

---

# 16. Các quyết định chưa chốt

Không còn business decision chưa chốt ảnh hưởng đến phạm vi chức năng của bản nháp V17.

Các chi tiết cần được xác định trong Data Contract và thiết kế kỹ thuật, bao gồm cấu trúc lưu biểu diễn HTML, giới hạn dữ liệu, quy tắc chuyển đổi HTML/plain text, phạm vi projection của các API hiện hữu và cách biểu diễn các định dạng Minimal trong Harvard PDF.

Những chi tiết này không được làm phát sinh yêu cầu nghiệp vụ mới ngoài phạm vi V17.

---

# 17. Definition of Business Completion

V17 được coi là hoàn thành về mặt nghiệp vụ khi:

- `F01` — Job Description hỗ trợ Rich Text Full trong phạm vi các chức năng/API hiện hữu được tích hợp.
- `F02` — Các trường Generated CV được chọn hỗ trợ Rich Text Minimal mà không thay đổi cấu trúc CV.
- `F03` — Nội dung Rich Text và legacy được đọc, cung cấp và hiển thị đúng tại các bề mặt thuộc phạm vi.
- `F04` — Harvard PDF phản ánh Minimal Formatting; snapshot mới bảo toàn nội dung và snapshot lịch sử không bị thay đổi.
- `F05` — Legacy compatibility và khả năng migration an toàn được đáp ứng.
- `F06` — Company Description được tích hợp vào Company Onboarding và các bề mặt Company hiện hữu.
- Toàn bộ `BR-01` đến `BR-10` được đáp ứng.
- Job Search và các quy tắc filter/ranking hiện hữu được bảo toàn.
- Các AI use case tiếp tục nhận dữ liệu theo contract hiện hữu.
- CV completeness, lifecycle và Harvard Template được bảo toàn.
- Authorization, ownership và multi-tenant boundary không thay đổi.
- Không phát sinh hành vi ngoài phạm vi V17.

Với những màn Job/CV chưa tồn tại, Business Completion của V17 được xác định theo khả năng hỗ trợ dữ liệu và các chức năng/API thuộc phạm vi, không phụ thuộc vào việc triển khai mới toàn bộ những màn hình đó.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu các yêu cầu nghiệp vụ trên chưa được đáp ứng.

---

# 18. Implementation Boundary

Tài liệu này là canonical business specification của Backend V17.

Tài liệu xác định:

```text
WHAT MUST HAPPEN
```

Không xác định:

```text
HOW IT IS IMPLEMENTED
```

Các chi tiết về API payload, schema persistence, validation implementation, HTML sanitization, conversion, PDF rendering, migration execution, cấu trúc code và kiểm thử thuộc các contract và giai đoạn kỹ thuật tương ứng.

Thứ tự authority:

```text
Product Specification V17
        |
        | Business Truth
        v
Data Contract V17
        |
        | Data & Persistence Truth
        v
Engineering Contracts
        |
        | Architecture Truth
        v
Implementation
```

Product Specification V17 là cơ sở xác định mục tiêu và phạm vi nghiệp vụ của phiên bản.

Các Product/Data Contract của những version trước tiếp tục giữ hiệu lực đối với những nghiệp vụ không được V17 thay đổi rõ ràng.
