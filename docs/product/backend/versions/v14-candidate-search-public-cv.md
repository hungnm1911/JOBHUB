# V14 — Candidate Search trên CV PUBLIC

> **File:** `docs/product/versions/v14-candidate-search-public-cv.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V14.

---

## 1. Mục tiêu

V14 bổ sung năng lực để **Recruiter hợp lệ chủ động khám phá các Candidate CV được Candidate công khai cho hoạt động tuyển dụng**.

Sau khi V14 hoàn thành, hệ thống phải hỗ trợ được luồng:

```text
Recruiter hợp lệ
↓
Truy cập Candidate Search
↓
Xem các CV đủ điều kiện xuất hiện
↓
Lọc CV bằng metadata tuyển dụng
↓
Xem Preview một CV cụ thể
```

V14 là bước khám phá ứng viên.

V14 **không tạo quan hệ tuyển dụng chính thức** giữa Recruiter, Company và Candidate.

Việc một Recruiter tìm thấy hoặc Preview một CV không đồng nghĩa Candidate đã:

* ứng tuyển;
* nhận lời mời việc làm;
* đồng ý tham gia quy trình tuyển dụng;
* được tạo Application;
* được gán Recruiter;
* được mở Conversation.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V14 bao gồm:

* kiểm tra quyền sử dụng Candidate Search của Recruiter;
* tìm các Candidate CV đủ điều kiện;
* hiển thị kết quả theo từng CV cụ thể;
* hỗ trợ cả Generated CV và Uploaded CV theo lifecycle tương ứng;
* lọc theo:

  * Category;
  * Skill tags;
  * Experience;
  * Location;
  * Employment type;
  * Work mode;
* kết hợp nhiều filter;
* sắp xếp kết quả mặc định theo thời điểm CV cập nhật gần nhất;
* Preview một CV cụ thể;
* hiển thị nguyên nội dung của CV khi Preview;
* kiểm tra lại quyền và trạng thái hiện tại khi Search hoặc Preview;
* thu hồi khả năng Search/Preview khi Recruiter hoặc CV không còn đủ điều kiện.

### 2.2. Ngoài phạm vi

V14 không bao gồm:

* keyword search;
* full-text search trong nội dung CV hoặc PDF;
* tìm Candidate theo tên;
* tìm theo email;
* tìm theo số điện thoại;
* tìm theo LinkedIn, GitHub hoặc Portfolio;
* relevance ranking;
* AI matching giữa CV và Job;
* Candidate recommendation;
* lưu lịch sử tìm kiếm;
* lưu lượt xem CV;
* thống kê lượt xem;
* thông báo cho Candidate khi CV được xem;
* Download CV bởi Recruiter trong Candidate Search;
* Direct Message;
* Conversation trước khi có Application;
* chọn Job;
* Job Invitation;
* Invitation snapshot;
* Application;
* Source Recruiter;
* Assigned Recruiter;
* Notification phát sinh từ Candidate Search;
* realtime event phát sinh từ Candidate Search;
* public Internet link cho CV;
* sửa Candidate CV hoặc Candidate Profile;
* thay đổi lifecycle của các catalog hiện có.

Không suy diễn hoặc tự bổ sung chức năng ngoài phạm vi này.

---

## 3. Dependency với các version trước

V14 kế thừa các business concept và invariant đã tồn tại, bao gồm:

* Authentication và trạng thái `User`;
* Company và trạng thái hoạt động của Company;
* Company Member và Recruiter membership;
* Recruitment Team của Job;
* Primary Recruiter;
* Supporting Recruiter;
* Candidate Account;
* V07 — Candidate CV Library;
* lifecycle của Generated CV;
* lifecycle của Uploaded CV;
* `PUBLIC` / `PRIVATE`;
* Archive CV;
* Category catalog;
* Experience catalog;
* Location catalog;
* Employment Type catalog;
* Work Mode catalog;
* Skill tags của Candidate CV;
* Application snapshot của các version trước;
* invariant Chat thuộc Application.

V14 phải kế thừa lifecycle V07 của từng loại CV.

Đặc biệt:

```text
GENERATED
→ có lifecycle DRAFT / ACTIVE
```

trong khi:

```text
UPLOADED
→ không có yêu cầu DRAFT / ACTIVE tương ứng
```

V14 không được áp dụng điều kiện `ACTIVE` của Generated CV sang Uploaded CV.

Các giá trị Category, Experience, Location, Employment Type và Work Mode sử dụng **catalog canonical đã tồn tại từ các version trước**.

V14 không định nghĩa lại các bộ giá trị catalog riêng.

Version này không được làm thay đổi invariant của các version trước trừ khi tài liệu này ghi rõ.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Recruiter

Recruiter là người thực hiện Candidate Search.

Để sử dụng Candidate Search, Recruiter phải đồng thời:

* đã được xác thực;
* là Recruiter hợp lệ của Company;
* tài khoản còn hoạt động;
* membership trong Company còn hợp lệ;
* Company còn hoạt động;
* hiện đang là Primary hoặc Supporting của ít nhất một Job.

Primary và Supporting là quan hệ động theo từng Job.

Việc một tài khoản có vai trò Recruiter không tự động đủ để sử dụng Candidate Search nếu không còn tham gia Recruitment Team của bất kỳ Job nào.

### 4.2. Candidate

Candidate là chủ sở hữu Candidate CV.

Candidate không trực tiếp sử dụng Candidate Search.

Các hành động của Candidate đối với CV hoặc tài khoản có thể làm CV bắt đầu hoặc ngừng xuất hiện trong Candidate Search.

### 4.3. Candidate CV

Candidate CV là **đơn vị kết quả** của Candidate Search.

Một Candidate có thể có nhiều CV và mỗi CV được đánh giá độc lập.

Hai CV của cùng Candidate không được hợp nhất thành một hồ sơ tìm kiếm chung.

### 4.4. Generated CV

CV được tạo bằng chức năng tạo CV của hệ thống.

Generated CV kế thừa lifecycle V07, bao gồm `DRAFT` và `ACTIVE`.

### 4.5. Uploaded CV

CV do Candidate upload.

Uploaded CV không sử dụng điều kiện `DRAFT` / `ACTIVE` của Generated CV để xác định search eligibility.

### 4.6. Search-eligible CV

Một CV được gọi là **search-eligible** khi thỏa mãn toàn bộ điều kiện nghiệp vụ để xuất hiện trong Candidate Search tại thời điểm hiện tại.

Search eligibility là trạng thái **được suy ra từ dữ liệu hiện tại**, không phải một lifecycle mới của Candidate CV.

### 4.7. Preview

Preview là hành động Recruiter xem nội dung đầy đủ của **một CV cụ thể**.

Preview không cấp quyền xem Candidate Profile hoặc các CV khác của Candidate.

---

## 5. Quan hệ nghiệp vụ chính

Quan hệ nghiệp vụ của Candidate Search:

```text
Recruiter
   │
   │ thuộc Company
   ↓
Company
   │
   │ Recruiter tham gia ít nhất một Recruitment Team
   ↓
Job
```

Quan hệ trên dùng để xác định **quyền sử dụng Candidate Search**.

Candidate Search không yêu cầu Candidate CV thuộc Job đó.

Luồng dữ liệu được tìm kiếm:

```text
Candidate
   │
   │ sở hữu
   ↓
Candidate CV
   │
   ├── Category
   ├── Skill tags
   ├── Experience
   ├── Preferred Location
   ├── Employment Type
   └── Work Mode
```

Candidate CV không trở thành tài sản của Company chỉ vì được Search hoặc Preview.

Candidate Search không tạo quan hệ:

```text
Candidate CV
→ Job

Candidate CV
→ Company

Candidate CV
→ Recruiter

Candidate CV
→ Application
```

Job chỉ chứng minh Recruiter đang tham gia hoạt động tuyển dụng.

Job không phải ngữ cảnh bắt buộc của Candidate Search.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Recruiter Candidate Search Eligibility

V14 sử dụng hai trạng thái suy ra:

* `ELIGIBLE`
* `INELIGIBLE`

| Trạng thái   | Ý nghĩa                                                           |
| ------------ | ----------------------------------------------------------------- |
| `ELIGIBLE`   | Recruiter hiện thỏa mãn đầy đủ điều kiện sử dụng Candidate Search |
| `INELIGIBLE` | Recruiter thiếu ít nhất một điều kiện bắt buộc                    |

Recruiter chỉ ở trạng thái `ELIGIBLE` khi đồng thời:

```text
Recruiter hợp lệ
AND
tài khoản đang hoạt động
AND
Company membership hợp lệ
AND
Company đang hoạt động
AND
là Primary hoặc Supporting của ít nhất một Job
```

Không yêu cầu Job dùng để chứng minh quyền phải `PUBLISHED`, còn hạn nhận hồ sơ hoặc đang nhận Application.

### 6.2. Candidate CV Search Eligibility

V14 sử dụng hai trạng thái suy ra:

* `SEARCH_ELIGIBLE`
* `SEARCH_INELIGIBLE`

Đây không phải trạng thái được bổ sung vào lifecycle Candidate CV.

#### Generated CV

Generated CV chỉ `SEARCH_ELIGIBLE` khi:

```text
source = GENERATED
AND
status = ACTIVE
AND
visibility = PUBLIC
AND
chưa archive
AND
Candidate đang ACTIVE
AND
Candidate đã xác minh email
```

Generated CV:

```text
status = DRAFT
AND
visibility = PUBLIC
```

vẫn là:

```text
SEARCH_INELIGIBLE
```

`PUBLIC` không làm một Generated CV DRAFT trở thành effective-public trong Candidate Search.

#### Uploaded CV

Uploaded CV chỉ `SEARCH_ELIGIBLE` khi:

```text
source = UPLOADED
AND
visibility = PUBLIC
AND
chưa archive
AND
Candidate đang ACTIVE
AND
Candidate đã xác minh email
```

Uploaded CV không bị yêu cầu phải có:

```text
status = ACTIVE
```

V14 không được invent lifecycle `DRAFT/ACTIVE` cho Uploaded CV.

### 6.3. Visibility

V14 kế thừa:

* `PUBLIC`
* `PRIVATE`

`PUBLIC` có nghĩa CV có thể tham gia Candidate Search **nếu đồng thời đáp ứng các eligibility rule khác**.

`PRIVATE` luôn loại CV khỏi Candidate Search.

`PUBLIC` không có nghĩa CV được công khai trên Internet.

### 6.4. Archive

CV đã Archive không được tham gia Candidate Search.

V14 không bổ sung một lifecycle Delete hoặc Soft Delete riêng cho Candidate CV.

---

## 7. Tổ hợp trạng thái hợp lệ

Các tổ hợp quan trọng đối với Candidate Search:

| Loại CV     | Trạng thái CV | Visibility | Archive | Candidate đủ điều kiện | Kết quả             |
| ----------- | ------------- | ---------- | ------- | ---------------------- | ------------------- |
| `GENERATED` | `ACTIVE`      | `PUBLIC`   | Không   | Có                     | `SEARCH_ELIGIBLE`   |
| `GENERATED` | `DRAFT`       | `PUBLIC`   | Không   | Có                     | `SEARCH_INELIGIBLE` |
| `GENERATED` | Bất kỳ        | `PRIVATE`  | Không   | Có                     | `SEARCH_INELIGIBLE` |
| `UPLOADED`  | Không áp dụng | `PUBLIC`   | Không   | Có                     | `SEARCH_ELIGIBLE`   |
| `UPLOADED`  | Không áp dụng | `PRIVATE`  | Không   | Có                     | `SEARCH_INELIGIBLE` |
| Bất kỳ      | Bất kỳ        | Bất kỳ     | Có      | Có                     | `SEARCH_INELIGIBLE` |
| Bất kỳ      | Bất kỳ        | `PUBLIC`   | Không   | Không                  | `SEARCH_INELIGIBLE` |

Trong bảng trên, Candidate đủ điều kiện nghĩa là:

```text
Candidate Account đang ACTIVE
AND
Candidate đã xác minh email
```

---

## 8. Quy trình nghiệp vụ tổng thể

Luồng V14:

```text
Recruiter yêu cầu sử dụng Candidate Search
↓
Kiểm tra Recruiter hiện còn đủ điều kiện
↓
Xác định tập Candidate CV hiện đang search-eligible
↓
Áp dụng các filter Recruiter lựa chọn
↓
Sắp xếp kết quả
↓
Hiển thị từng CV như một kết quả độc lập
↓
Recruiter chọn một CV
↓
Kiểm tra lại quyền Recruiter và eligibility hiện tại của CV
↓
Preview nội dung CV
↓
Kết thúc boundary V14
```

V14 dừng tại Preview.

Không có transition từ Preview sang Application hoặc Conversation trong version này.

---

# 9. Functional Requirements

## F01 — Truy cập Candidate Search

### Actor

* Recruiter.

### Mục tiêu

Cho phép Recruiter đang thực sự tham gia hoạt động tuyển dụng sử dụng Candidate Search.

### Tiền điều kiện

Recruiter phải:

* được xác thực;
* có tư cách Recruiter hợp lệ;
* có tài khoản đang hoạt động;
* có Company membership hợp lệ;
* thuộc Company đang hoạt động;
* đang là Primary hoặc Supporting của ít nhất một Job.

### Luồng chính

1. Recruiter yêu cầu sử dụng Candidate Search.
2. Hệ thống xác định eligibility hiện tại của Recruiter.
3. Nếu toàn bộ điều kiện bắt buộc được thỏa mãn, Recruiter được phép sử dụng Candidate Search.
4. Quyền này tiếp tục được đánh giá theo trạng thái hiện tại trong các lần truy cập tiếp theo.

### Kết quả

Recruiter đủ điều kiện có thể:

* tải danh sách Candidate CV;
* áp dụng filter;
* Preview CV search-eligible.

### Trường hợp từ chối

Từ chối khi:

* chưa được xác thực;
* không phải Recruiter hợp lệ;
* tài khoản không còn hoạt động;
* Company membership không còn hợp lệ;
* Company không còn hoạt động;
* Recruiter không còn là Primary hoặc Supporting của bất kỳ Job nào.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-04`
* `BR-05`

### Không thuộc chức năng này

* chọn Job để Search Candidate;
* gửi Job Invitation;
* cấp quyền Candidate Search cho Company Manager;
* cấp quyền Candidate Search cho Platform Admin.

---

## F02 — Duyệt danh sách Candidate CV

### Actor

* Recruiter đang `ELIGIBLE`.

### Mục tiêu

Cho phép Recruiter xem các CV hiện đang đủ điều kiện tham gia Candidate Search.

### Tiền điều kiện

* Recruiter đang `ELIGIBLE`.

### Luồng chính

1. Xác định các Candidate CV hiện đang `SEARCH_ELIGIBLE`.
2. Mỗi Candidate CV được xử lý như một kết quả độc lập.
3. Một Candidate có nhiều CV đủ điều kiện có thể xuất hiện nhiều lần.
4. Hiển thị thông tin tóm tắt cần thiết của từng CV.

### Thông tin tóm tắt được phép hiển thị

Danh sách có thể hiển thị:

* họ tên Candidate;
* tên CV;
* Category;
* Skill tags;
* Experience;
* Preferred Location;
* Employment Type;
* Work Mode.

Các metadata tùy chọn chỉ hiển thị khi CV có dữ liệu tương ứng.

Danh sách không hiển thị đầy đủ nội dung CV.

Đặc biệt, email, số điện thoại và các thông tin liên hệ chi tiết không phải nội dung của Search Result card; các thông tin đó chỉ được xem khi Preview nếu Candidate đã đưa chúng vào CV.

### Kết quả

Recruiter nhận được danh sách theo từng CV cụ thể.

### Trường hợp từ chối hoặc loại khỏi kết quả

CV không xuất hiện nếu:

* `PRIVATE`;
* đã Archive;
* Candidate không còn ACTIVE;
* Candidate chưa đáp ứng email verification;
* Generated CV chưa `ACTIVE`;
* hoặc bất kỳ eligibility rule tương ứng với loại CV không được thỏa mãn.

Uploaded CV không bị loại chỉ vì không có `ACTIVE/DRAFT status`.

### Business Rules liên quan

* `BR-06`
* `BR-07`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-11`
* `BR-12`
* `BR-13`
* `BR-14`
* `BR-15`
* `BR-16`
* `BR-25`

### Không thuộc chức năng này

* Candidate Profile đầy đủ;
* thư viện CV đầy đủ của Candidate;
* Application history;
* Invitation history;
* Conversation hoặc Message;
* trạng thái tuyển dụng tổng quát của Candidate.

---

## F03 — Lọc Candidate CV theo metadata

### Actor

* Recruiter đang `ELIGIBLE`.

### Mục tiêu

Cho phép Recruiter thu hẹp tập Candidate CV bằng metadata tuyển dụng đã có.

### Tiền điều kiện

* Recruiter đang `ELIGIBLE`.
* Chỉ các CV `SEARCH_ELIGIBLE` mới được xét.

### Các nhóm filter

V14 có đúng sáu nhóm:

1. Category;
2. Skill tags;
3. Experience;
4. Location;
5. Employment Type;
6. Work Mode.

### Luồng chính

1. Recruiter có thể áp dụng không, một hoặc nhiều nhóm filter.
2. Các nhóm filter khác nhau kết hợp bằng `AND`.
3. Nhiều giá trị trong cùng một nhóm kết hợp bằng `OR`.
4. Nhóm filter không được chọn không làm CV bị loại.
5. Metadata của từng CV được đánh giá độc lập.

### Category

Category sử dụng Category catalog canonical đã tồn tại.

Một CV có một Category chính theo lifecycle Candidate CV.

Khi Recruiter chọn một Category ở level `FIELD`:

```text
FIELD được chọn
→ match các CV thuộc FIELD đó
→ bao gồm các POSITION con của FIELD đó
```

Khi Recruiter chọn một `POSITION`:

```text
POSITION được chọn
→ match CV thuộc POSITION đó
```

Nhiều Category được chọn trong cùng nhóm kết hợp bằng `OR`.

### Skill tags

CV match Skill filter khi có ít nhất một Skill tag trùng với các Skill được chọn.

Không yêu cầu CV phải chứa tất cả Skill được chọn.

### Experience

Experience sử dụng catalog Experience canonical đã có.

Nhiều giá trị Experience được chọn kết hợp bằng `OR`.

### Location

Location sử dụng catalog Location canonical đã có.

CV match khi có ít nhất một Preferred Location trùng với các Location được chọn.

### Employment Type

Employment Type sử dụng catalog Employment Type canonical đã có.

CV match khi có ít nhất một Employment Type mong muốn trùng với các giá trị được chọn.

### Work Mode

Work Mode sử dụng catalog Work Mode canonical đã có.

CV match khi có ít nhất một Work Mode mong muốn trùng với các giá trị được chọn.

### Metadata tùy chọn bị thiếu

Nếu Recruiter không lọc theo một metadata tùy chọn:

```text
CV thiếu metadata
→ không bị loại vì lý do đó
```

Nếu Recruiter áp dụng filter tương ứng:

```text
CV thiếu metadata
→ không match nhóm filter đó
```

Không được tự suy đoán metadata còn thiếu từ nội dung CV.

### Kết quả

Chỉ các CV:

```text
SEARCH_ELIGIBLE
AND
match tất cả nhóm filter đang áp dụng
```

được giữ lại.

### Business Rules liên quan

* `BR-17`
* `BR-18`
* `BR-19`
* `BR-20`
* `BR-21`
* `BR-22`
* `BR-23`

### Không thuộc chức năng này

* keyword search;
* full-text search;
* suy luận Skill từ mô tả Work Experience;
* suy luận Experience từ lịch sử làm việc;
* AI matching;
* relevance ranking.

---

## F04 — Sắp xếp Candidate Search

### Actor

* Recruiter đang `ELIGIBLE`.

### Mục tiêu

Đưa các CV vừa được cập nhật gần đây lên trước và duy trì thứ tự kết quả ổn định.

### Luồng chính

1. Kết quả mặc định được sắp xếp theo `updatedAt` gần nhất trước.
2. Khi nhiều CV có cùng thời điểm cập nhật, hệ thống phải duy trì một thứ tự phụ cố định và nhất quán.

### Kết quả

* CV mới cập nhật hơn xuất hiện trước.
* Cùng một tập dữ liệu không bị thay đổi thứ tự ngẫu nhiên.

### Business Rules liên quan

* `BR-24`

### Không thuộc chức năng này

* relevance score;
* Job-to-CV matching score;
* ranking theo hành vi Recruiter;
* paid ranking.

---

## F05 — Preview Candidate CV

### Actor

* Recruiter đang `ELIGIBLE`.

### Mục tiêu

Cho phép Recruiter xem đầy đủ nội dung của một Candidate CV hiện đang `SEARCH_ELIGIBLE`.

### Tiền điều kiện

Tại thời điểm Preview:

* Recruiter vẫn phải `ELIGIBLE`;
* CV vẫn phải `SEARCH_ELIGIBLE`.

### Luồng chính

1. Recruiter chọn một CV cụ thể.
2. Eligibility của Recruiter được đánh giá lại.
3. Eligibility hiện tại của CV được đánh giá lại.
4. Nếu cả hai vẫn hợp lệ, Recruiter được Preview CV.
5. Preview hiển thị nội dung hiện tại của chính CV đó.

### Nội dung Preview

Recruiter được xem nội dung Candidate đã đưa vào CV, bao gồm nếu có:

* họ tên;
* email liên hệ;
* số điện thoại;
* Location;
* LinkedIn;
* GitHub;
* Portfolio;
* Professional Summary;
* Education;
* Work Experience;
* Projects;
* Skills;
* Certificates;
* Languages;
* các phần nội dung hợp lệ khác của chính CV.

V14 không che email hoặc số điện thoại nếu các thông tin này nằm trong CV PUBLIC mà Candidate đã chủ động công bố.

Quyền này chỉ áp dụng với **CV đang được Preview**.

### Kết quả

Recruiter xem được nội dung đầy đủ của CV hiện tại.

### Trường hợp từ chối

Preview phải bị từ chối nếu tại thời điểm hiện tại:

* Recruiter không còn `ELIGIBLE`;
* CV chuyển sang `PRIVATE`;
* CV đã Archive;
* Candidate không còn ACTIVE;
* Candidate không còn đáp ứng email verification;
* Generated CV không còn đáp ứng điều kiện `ACTIVE`;
* hoặc CV không còn `SEARCH_ELIGIBLE` vì bất kỳ rule hợp lệ nào.

Việc CV từng xuất hiện trong danh sách không tạo quyền Preview vĩnh viễn.

Việc Recruiter biết định danh của CV không tạo quyền truy cập.

### Business Rules liên quan

* `BR-26`
* `BR-27`
* `BR-28`
* `BR-29`
* `BR-30`
* `BR-31`
* `BR-32`
* `BR-33`

### Không thuộc chức năng này

* Download;
* Candidate Profile;
* các CV khác của Candidate;
* Application;
* Invitation;
* Direct Message;
* Conversation.

---

## F06 — Giữ Candidate Search ở boundary chỉ đọc

### Actor

* Recruiter đang `ELIGIBLE`.

### Mục tiêu

Bảo đảm Candidate Search chỉ phục vụ khám phá và đánh giá CV, không tự tạo quan hệ tuyển dụng hoặc thay đổi dữ liệu Candidate.

### Luồng chính

Recruiter chỉ được:

```text
Read Candidate Search
Filter
Preview
```

Candidate Search không cho phép Recruiter sửa:

* nội dung CV;
* tên CV;
* visibility;
* Category;
* Skill tags;
* Experience;
* Location;
* Employment Type;
* Work Mode;
* trạng thái Archive;
* Candidate Profile;
* Candidate Account.

### Kết quả

Search hoặc Preview không tạo:

* snapshot mới;
* Application;
* Job Invitation;
* Source Recruiter;
* Assigned Recruiter;
* Conversation;
* Message;
* Notification;
* realtime event;
* view history.

### Business Rules liên quan

* `BR-34`
* `BR-35`
* `BR-36`
* `BR-37`
* `BR-38`

### Không thuộc chức năng này

Mọi hành động làm Candidate đi vào quy trình tuyển dụng chính thức.

---

# 10. Business Rules

## BR-01 — Candidate Search chỉ dành cho Recruiter hợp lệ

Chỉ Recruiter được xác thực và còn đủ điều kiện nghiệp vụ mới được sử dụng Candidate Search.

Candidate, Company Manager, Platform Admin và người dùng ẩn danh không có quyền sử dụng Candidate Search.

---

## BR-02 — Recruiter phải còn hoạt động trong Company

Recruiter phải đồng thời:

* có tài khoản đang hoạt động;
* có Recruiter membership hợp lệ;
* thuộc Company đang hoạt động.

Thiếu một trong các điều kiện trên làm Recruiter `INELIGIBLE`.

---

## BR-03 — Recruiter phải tham gia ít nhất một Recruitment Team

Recruiter phải hiện là:

* Primary Recruiter; hoặc
* Supporting Recruiter

của ít nhất một Job.

Job dùng để chứng minh quyền Candidate Search không bắt buộc phải:

* `PUBLISHED`;
* còn hạn;
* đang nhận Application.

---

## BR-04 — Quyền Candidate Search là quyền động

Eligibility của Recruiter phải phản ánh trạng thái hiện tại.

Việc Recruiter từng có quyền, từng mở Candidate Search hoặc vẫn còn phiên đăng nhập không tạo quyền vĩnh viễn.

---

## BR-05 — Quyền quản trị không thay thế quyền Recruiter

Company Manager và Platform Admin không được sử dụng Candidate Search chỉ dựa trên quyền quản trị của họ.

---

## BR-06 — Candidate Search độc lập với Job

Recruiter không cần chọn Job trước khi Search hoặc Preview Candidate CV.

Candidate Search không dùng một Job cụ thể để xác định CV nào phù hợp.

---

## BR-07 — Đơn vị kết quả là Candidate CV

Mỗi kết quả Candidate Search đại diện cho một Candidate CV cụ thể.

Không được biến Candidate thành đơn vị kết quả tổng hợp.

---

## BR-08 — Một Candidate có thể xuất hiện nhiều lần

Nếu một Candidate có nhiều CV cùng `SEARCH_ELIGIBLE`, mỗi CV có thể xuất hiện như một kết quả độc lập.

---

## BR-09 — Không trộn metadata giữa các CV

Category, Skill, Experience, Location, Employment Type, Work Mode và nội dung nghề nghiệp phải được đánh giá theo từng CV.

Không được lấy metadata từ CV A để bổ sung cho CV B của cùng Candidate.

---

## BR-10 — Search eligibility của Generated CV

Generated CV chỉ search-eligible khi:

```text
status = ACTIVE
AND
visibility = PUBLIC
AND
chưa Archive
AND
Candidate ACTIVE
AND
Candidate đã xác minh email
```

---

## BR-11 — Generated DRAFT/PUBLIC không effective-public

Generated CV có:

```text
status = DRAFT
AND
visibility = PUBLIC
```

không được xuất hiện hoặc Preview thông qua Candidate Search.

---

## BR-12 — Uploaded CV không có yêu cầu ACTIVE/DRAFT

Uploaded CV không chịu điều kiện `status = ACTIVE` của Generated CV.

Uploaded CV có thể search-eligible khi:

```text
visibility = PUBLIC
AND
chưa Archive
AND
Candidate ACTIVE
AND
Candidate đã xác minh email
```

---

## BR-13 — Candidate phải đủ điều kiện

Chỉ CV thuộc Candidate:

```text
Account ACTIVE
AND
đã xác minh email
```

mới được Candidate Search sử dụng.

---

## BR-14 — Archive loại CV khỏi Candidate Search

CV đã Archive không được:

* xuất hiện trong Search;
* match filter;
* Preview từ Candidate Search.

V14 không có lifecycle Soft Delete riêng cho Candidate CV.

---

## BR-15 — PUBLIC không phải public Internet

`PUBLIC` chỉ thể hiện Candidate đồng ý để CV cụ thể tham gia Candidate Search dành cho Recruiter hợp lệ.

`PUBLIC` không tự cấp:

* quyền truy cập ẩn danh;
* quyền xem Candidate Profile;
* quyền xem CV PRIVATE khác;
* quyền xem Application;
* quyền Chat;
* quyền Download.

---

## BR-16 — PRIVATE tuyệt đối không được Candidate Search truy cập

CV `PRIVATE` không được:

* xuất hiện;
* match filter;
* Preview;
* tiếp tục truy cập dựa trên kết quả cũ;
* tiếp tục truy cập chỉ vì Recruiter biết định danh CV.

---

## BR-17 — V14 có đúng sáu nhóm filter

Sáu nhóm gồm:

1. Category;
2. Skill tags;
3. Experience;
4. Location;
5. Employment Type;
6. Work Mode.

V14 không bổ sung keyword search.

---

## BR-18 — Filter sử dụng dữ liệu canonical đã tồn tại

Category, Experience, Location, Employment Type và Work Mode phải sử dụng catalog canonical kế thừa từ các version trước.

V14 không định nghĩa lại một bộ enum hoặc catalog song song.

Skill tags tiếp tục sử dụng metadata Skill của Candidate CV đã có.

---

## BR-19 — Category filter tôn trọng hierarchy

Khi chọn `FIELD`, Candidate Search phải match các CV thuộc FIELD đó, bao gồm các `POSITION` con của FIELD.

Khi chọn một `POSITION`, Candidate Search match POSITION đó.

Nhiều Category được chọn trong cùng nhóm kết hợp bằng `OR`.

---

## BR-20 — Skill filter sử dụng giao không rỗng

Khi Recruiter chọn nhiều Skill, CV match nếu có ít nhất một Skill chung.

Không yêu cầu CV phải có toàn bộ Skill được chọn.

---

## BR-21 — AND giữa nhóm, OR trong nhóm

Các nhóm filter đang được áp dụng kết hợp bằng `AND`.

Nhiều giá trị trong một nhóm kết hợp bằng `OR`.

---

## BR-22 — Metadata tùy chọn bị thiếu

Nếu một filter không được áp dụng, việc CV thiếu metadata tương ứng không tự loại CV.

Nếu filter được áp dụng, CV thiếu metadata tương ứng không match nhóm đó.

---

## BR-23 — Không suy đoán metadata

Candidate Search chỉ sử dụng metadata canonical của CV.

Không tự suy luận metadata còn thiếu từ Professional Summary, Work Experience, Project hoặc nội dung PDF.

---

## BR-24 — Thứ tự mặc định

Candidate Search sắp xếp CV theo:

```text
updatedAt gần nhất trước
```

Nếu nhiều CV có cùng thời điểm cập nhật, kết quả phải có một thứ tự phụ ổn định và nhất quán.

V14 không có relevance ranking.

---

## BR-25 — Search Result chỉ hiển thị thông tin tóm tắt

Search Result được phép hiển thị:

* họ tên Candidate;
* tên CV;
* Category;
* Skill tags;
* Experience;
* Preferred Location;
* Employment Type;
* Work Mode.

Thông tin liên hệ chi tiết và nội dung đầy đủ của CV chỉ thuộc Preview.

Danh sách không được mở rộng thành Candidate Profile.

---

## BR-26 — Preview được xem nguyên nội dung CV

Khi CV search-eligible, Recruiter được Preview toàn bộ nội dung Candidate đã đưa vào chính CV đó.

Thông tin liên hệ trong CV không bị che chỉ vì đó là email hoặc số điện thoại.

---

## BR-27 — Preview không mở rộng sang Candidate Profile

Quyền Preview một CV không cấp quyền xem:

* Candidate Profile đầy đủ;
* CV khác;
* Application;
* Invitation;
* Conversation;
* dữ liệu nội bộ khác của Candidate.

---

## BR-28 — Recruiter không được Download trong Candidate Search

V14 chỉ cung cấp Preview cho Recruiter.

Quy tắc này áp dụng cho cả Generated CV và Uploaded CV.

Quyền Download CV của chính Candidate trong Candidate CV Library không bị thay đổi.

---

## BR-29 — Preview sử dụng eligibility hiện tại

Mỗi lần Preview phải dựa trên trạng thái hiện tại của Recruiter, Candidate và CV.

Danh sách cũ không phải bằng chứng authorization.

---

## BR-30 — PUBLIC → PRIVATE thu hồi quyền Candidate Search

Khi CV chuyển:

```text
PUBLIC → PRIVATE
```

CV phải bị loại khỏi các lần Search tiếp theo và không được Preview tiếp từ Candidate Search.

---

## BR-31 — Archive thu hồi Candidate Search eligibility

Khi CV được Archive, CV không còn search-eligible kể từ lần đánh giá eligibility tiếp theo.

---

## BR-32 — Candidate mất eligibility làm các CV bị loại

Khi Candidate không còn ACTIVE hoặc không còn đáp ứng email verification, các CV của Candidate không còn search-eligible.

Điều này không xóa CV hoặc các business record lịch sử đã tồn tại.

---

## BR-33 — Recruiter mất eligibility thì mất quyền Search và Preview

Khi Recruiter:

* không còn hoạt động;
* membership không còn hợp lệ;
* Company không còn hoạt động;
* hoặc mất membership ở Job cuối cùng mà Recruiter là Primary/Supporting;

Recruiter trở thành `INELIGIBLE` và không được tiếp tục Search hoặc Preview.

---

## BR-34 — Candidate Search là read-only

Candidate Search không được thay đổi Candidate CV, Candidate Profile hoặc Candidate Account.

---

## BR-35 — Preview không tạo snapshot hoặc view history

Search hoặc Preview không tạo:

* Application CV snapshot;
* Invitation CV snapshot;
* lịch sử phiên bản CV Recruiter đã xem;
* view history;
* view count.

Recruiter luôn xem nội dung hiện tại của CV search-eligible.

---

## BR-36 — Candidate Search không tạo recruitment object

Search hoặc Preview không tạo:

* Job Invitation;
* Application;
* Source Recruiter;
* Assigned Recruiter;
* Conversation;
* Message.

---

## BR-37 — Candidate Search không tạo Notification hoặc realtime obligation

Các hành động Search, Filter hoặc Preview không tạo Notification cho Candidate hoặc Recruiter.

V14 không bổ sung realtime behavior cho Candidate Search.

---

## BR-38 — Candidate Search không thay đổi dữ liệu tuyển dụng đã tồn tại

Việc CV:

* chuyển `PRIVATE`;
* được Archive;
* hoặc không còn search-eligible

không làm thay đổi CV snapshot của Application đã tồn tại từ các version trước.

Candidate Search chỉ kiểm soát khả năng **khám phá và Preview CV gốc hiện tại**.

---

# 11. State Transitions

V14 không sở hữu một lifecycle persistence mới.

Các transition dưới đây thuộc domain đã tồn tại nhưng làm thay đổi **derived eligibility** của Candidate Search.

| Hành động / thay đổi                                                                 | Trước                       | Sau đối với V14                                          | Actor / nguồn               |
| ------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------- | --------------------------- |
| Generated CV được kích hoạt theo lifecycle V07, đồng thời đáp ứng các điều kiện khác | `SEARCH_INELIGIBLE`         | Có thể `SEARCH_ELIGIBLE`                                 | Candidate / lifecycle CV    |
| Generated CV còn `DRAFT` dù visibility là `PUBLIC`                                   | `SEARCH_INELIGIBLE`         | `SEARCH_INELIGIBLE`                                      | Lifecycle CV                |
| CV `PRIVATE → PUBLIC`                                                                | `SEARCH_INELIGIBLE`         | Có thể `SEARCH_ELIGIBLE` nếu các điều kiện khác thỏa mãn | Candidate                   |
| CV `PUBLIC → PRIVATE`                                                                | Có thể `SEARCH_ELIGIBLE`    | `SEARCH_INELIGIBLE`                                      | Candidate                   |
| CV chưa Archive → Archive                                                            | Có thể `SEARCH_ELIGIBLE`    | `SEARCH_INELIGIBLE`                                      | Candidate                   |
| Candidate ACTIVE → trạng thái không còn đủ điều kiện                                 | CV có thể `SEARCH_ELIGIBLE` | Các CV trở thành `SEARCH_INELIGIBLE`                     | Candidate Account lifecycle |
| Recruiter có membership Job cuối cùng → mất membership đó                            | `ELIGIBLE`                  | `INELIGIBLE`                                             | Recruitment Team lifecycle  |
| Recruiter đang hợp lệ → tài khoản/membership không còn hợp lệ                        | `ELIGIBLE`                  | `INELIGIBLE`                                             | Recruiter lifecycle         |
| Company đang hoạt động → không còn hoạt động                                         | `ELIGIBLE`                  | `INELIGIBLE`                                             | Company lifecycle           |

Uploaded CV không có transition `DRAFT → ACTIVE` trong V14.

V14 không bổ sung transition Delete hoặc Soft Delete cho Candidate CV.

---

# 12. Authorization và ownership boundary

| Hành động                     | Actor được phép                      | Resource / Scope         | Điều kiện                                                          |
| ----------------------------- | ------------------------------------ | ------------------------ | ------------------------------------------------------------------ |
| Truy cập Candidate Search     | Recruiter                            | Candidate Search         | Recruiter đang `ELIGIBLE`                                          |
| Xem danh sách                 | Recruiter                            | Tập CV `SEARCH_ELIGIBLE` | Recruiter đang `ELIGIBLE`                                          |
| Áp dụng filter                | Recruiter                            | Candidate Search result  | Recruiter đang `ELIGIBLE`                                          |
| Preview                       | Recruiter                            | Một Candidate CV cụ thể  | Recruiter `ELIGIBLE` và CV `SEARCH_ELIGIBLE` tại thời điểm Preview |
| Sửa Candidate CV              | Không actor nào qua Candidate Search | Candidate CV             | Không thuộc quyền Candidate Search                                 |
| Download qua Candidate Search | Không                                | Candidate CV             | Ngoài phạm vi                                                      |
| Xem Candidate Profile đầy đủ  | Không thông qua Candidate Search     | Candidate Profile        | Không được suy ra từ quyền Preview                                 |
| Chat với Candidate            | Không thông qua Candidate Search     | Conversation             | Candidate Search không tạo quyền Chat                              |

Candidate là chủ sở hữu Candidate CV.

Company hoặc Recruiter không trở thành owner của Candidate CV sau khi Search hoặc Preview.

Việc biết định danh Candidate hoặc CV không phải bằng chứng authorization.

---

# 13. Multi-tenant boundary

V14 có Company context đối với **authorization của Recruiter**, nhưng Candidate CV search-eligible không trở thành resource thuộc một Company cụ thể.

Quyền Recruiter được xác định từ Company membership thực tế của chính Recruiter:

```text
Recruiter
↓
Company membership hiện tại
↓
Recruitment Team của Job thuộc Company đó
↓
Candidate Search eligibility
```

Một Recruiter không được:

* sử dụng membership của Recruiter khác;
* sử dụng Recruitment Team của Company khác để tạo quyền;
* tự chọn một Company khác làm nguồn authorization.

Candidate Search sau khi được cấp quyền hoạt động trên tập Candidate CV `PUBLIC` đủ điều kiện của nền tảng, không chỉ trên Candidate đã từng tương tác với Company.

Việc Recruiter của Company A Preview một CV không:

* chuyển ownership CV sang Company A;
* tạo quan hệ Candidate–Company;
* ngăn Recruiter hợp lệ của Company B tìm cùng CV PUBLIC;
* cấp Company quyền xem các CV PRIVATE khác của Candidate.

V14 không bổ sung tenant ownership mới cho Candidate CV.

---

# 14. Lifecycle invariants

Các invariant sau luôn phải đúng:

1. Candidate Search chỉ dành cho Recruiter `ELIGIBLE`.
2. Recruiter phải là Primary hoặc Supporting của ít nhất một Job.
3. Job chứng minh quyền không bắt buộc phải `PUBLISHED`.
4. Candidate Search không yêu cầu chọn Job.
5. Candidate Search hoạt động độc lập với một Job cụ thể.
6. Đơn vị kết quả luôn là từng Candidate CV.
7. Một Candidate có thể có nhiều kết quả thông qua nhiều CV.
8. Metadata của nhiều CV không được trộn.
9. Generated và Uploaded CV có lifecycle eligibility khác nhau.
10. Generated CV chỉ search-eligible khi `ACTIVE`.
11. Generated `DRAFT/PUBLIC` không effective-public.
12. Uploaded CV không bị yêu cầu `ACTIVE`.
13. Mọi CV search-eligible phải `PUBLIC`.
14. Mọi CV Archive đều search-ineligible.
15. V14 không có Soft Delete lifecycle cho Candidate CV.
16. Candidate phải ACTIVE và đã xác minh email.
17. `PRIVATE` không được vượt qua bằng định danh CV hoặc dữ liệu cũ.
18. `PUBLIC` không đồng nghĩa public Internet.
19. V14 chỉ có sáu nhóm filter đã định nghĩa.
20. Catalog filter kế thừa catalog canonical hiện hữu.
21. Category `FIELD` match các `POSITION` con.
22. Các nhóm filter kết hợp bằng `AND`.
23. Các giá trị trong một nhóm kết hợp bằng `OR`.
24. Metadata optional không được tự suy đoán.
25. Search Result không phải Candidate Profile.
26. Contact detail đầy đủ chỉ thuộc Preview.
27. Preview chỉ áp dụng cho CV cụ thể đang search-eligible.
28. Preview luôn phản ánh trạng thái hiện tại.
29. Recruiter không có quyền Download qua Candidate Search.
30. Candidate Search chỉ đọc.
31. Search/Preview không tạo snapshot.
32. Search/Preview không tạo Application hoặc Invitation.
33. Search/Preview không tạo Conversation hoặc Message.
34. Search/Preview không tạo Notification hoặc realtime obligation.
35. Search/Preview không tạo view history.
36. Candidate Search không tạo một Recruitment Pipeline riêng.
37. Candidate Search không thay đổi Application snapshot đã tồn tại.
38. V14 kết thúc tại Search, Filter và Preview.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V14:

* keyword search;
* full-text search trong Candidate CV hoặc PDF;
* tìm theo tên, email hoặc số điện thoại;
* relevance ranking;
* AI matching giữa Candidate CV và Job;
* Candidate recommendation;
* Search history;
* Saved Search;
* view history;
* view count;
* Candidate notification khi CV được xem;
* Recruiter Download CV;
* Direct Message;
* Conversation trước Application;
* Job selection phục vụ headhunting;
* Job Invitation;
* Invitation snapshot;
* Source Recruiter;
* Application từ Recruiter Invitation;
* Notification hoặc realtime cho Candidate Search.

Các nghiệp vụ bắt đầu từ việc Recruiter chọn Job và mời Candidate thuộc boundary version sau.

Không được tự implement các nội dung defer trong V14.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V14.

Các lựa chọn về cách hiện thực không thuộc Product Specification và không được dùng để thay đổi business truth trong tài liệu này.

---

# 17. Definition of Business Completion

V14 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — quyền truy cập Candidate Search được đáp ứng;
* `F02` — danh sách chỉ chứa Candidate CV search-eligible;
* `F03` — sáu nhóm filter hoạt động đúng semantic đã chốt;
* `F04` — thứ tự mặc định ổn định và ưu tiên CV mới cập nhật;
* `F05` — Preview tuân thủ eligibility và privacy boundary;
* `F06` — Candidate Search giữ đúng boundary chỉ đọc;
* toàn bộ `BR-01` đến `BR-38` được đáp ứng;
* Generated và Uploaded CV không bị áp dụng sai cùng một lifecycle;
* `GENERATED/DRAFT/PUBLIC` không bị coi là effective-public;
* Uploaded CV không bị invent yêu cầu `ACTIVE`;
* Archive là lifecycle loại trừ duy nhất của Candidate CV được V14 sử dụng ngoài visibility;
* không xuất hiện Soft Delete lifecycle mới;
* Category hierarchy hoạt động đúng rule FIELD/POSITION;
* catalog được kế thừa thay vì định nghĩa lại;
* authorization được đánh giá theo trạng thái hiện tại;
* tenant boundary được giữ;
* CV `PRIVATE` không thể truy cập qua Candidate Search;
* Search Result không lộ toàn bộ nội dung CV;
* nội dung đầy đủ chỉ được mở trong Preview;
* Candidate Search không tạo recruitment object ngoài ý muốn;
* các chức năng đã defer không bị đưa vào V14;
* không xuất hiện behavior ngoài boundary đã chốt.

Việc chức năng chạy được không tự động đồng nghĩa với Business Completion nếu các business contract trên chưa được giữ đầy đủ.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification của V14**.

Tài liệu này định nghĩa:

```text
WHAT MUST HAPPEN
```

bao gồm:

* actor nào được phép;
* resource nào được nhìn thấy;
* CV nào search-eligible;
* filter phải có semantic gì;
* Preview được phép xem gì;
* khi nào quyền phải bị thu hồi;
* version kết thúc ở đâu.

Tài liệu này không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Các quyết định về cách hiện thực không được phép:

* bổ sung business state mới;
* thay đổi lifecycle kế thừa;
* biến lựa chọn kỹ thuật thành business requirement;
* mở rộng authorization;
* mở rộng dữ liệu được expose;
* hoặc đưa chức năng đã defer vào V14.

Nếu thiết kế dữ liệu hoặc implementation mâu thuẫn với tài liệu này, **Product Specification này là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
