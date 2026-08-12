# V8 — Job Discovery

> **File:** `docs/product/versions/v8-job-discovery.md`
> **Vai trò:** Planning draft Product Specification — chưa có implementation authority khi V8 `PENDING`
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V8 — Job Discovery.

> **Governance status:** V8 hiện `PENDING` theo `docs/product/roadmap.md` và
> `docs/PROJECT_STATUS.md`. Nội dung này chỉ trở thành canonical Product
> Specification cho implementation sau khi được review, approved và roadmap
> chuyển V8 ra khỏi `PENDING`.

---

## 1. Mục tiêu

V8 bổ sung khả năng **Job Discovery**, cho phép các actor hợp lệ khám phá các cơ hội tuyển dụng đang được công khai trên nền tảng.

Sau khi V8 hoàn thành, hệ thống phải hỗ trợ:

* xem danh sách Job đang đủ điều kiện được công khai trong Job Discovery;
* tìm kiếm Job theo từ khóa;
* lọc Job theo các danh mục chuẩn;
* sắp xếp kết quả;
* xem chi tiết Job công khai;
* tiếp tục xem Job đã đóng hoặc hết hạn ở chế độ chỉ đọc khi Job vẫn đủ điều kiện public historical access;
* xem thông tin công khai của Company đăng tuyển.

V8 là nghiệp vụ **read-only**.

V8 không thay đổi Job lifecycle, Company lifecycle, Recruitment Team, Candidate Profile hoặc Candidate CV.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

* Job Discovery cho các actor được phép.
* Xem danh sách Job đang còn đủ điều kiện được khám phá.
* Tìm kiếm Job theo:

  * tên Job;
  * kỹ năng yêu cầu;
  * tên Company;
  * Job Description.
* Lọc Job theo:

  * Category;
  * Location;
  * Work mode;
  * Employment type;
  * Experience.
* Chọn nhiều giá trị trong cùng một nhóm filter.
* Chọn nhiều ngành và các vị trí tương ứng thuộc từng ngành.
* Kết hợp keyword với các bộ lọc.
* Sắp xếp theo:

  * Mới nhất;
  * Liên quan nhất;
  * Sắp hết hạn.
* Xem chi tiết Job công khai.
* Xem Job đã đóng hoặc hết hạn qua đường dẫn đã biết ở chế độ chỉ đọc khi Company vẫn `ACTIVE`.
* Xem thông tin Company công khai từ Job.
* Đánh giá khả năng xuất hiện của Job dựa trên:

  * Job lifecycle;
  * hạn nhận hồ sơ;
  * operational status của Company.

### 2.2. Ngoài phạm vi

V8 không triển khai:

* Apply Job.
* Chọn CV để Apply.
* Upload CV trong quá trình Apply.
* Tạo Application.
* Application snapshot.
* Submitted CV snapshot.
* Replace Submitted CV.
* Withdraw Application.
* My Applications.
* Saved Jobs.
* Candidate Search dành cho Recruiter.
* Recruiter xem Candidate CV `PUBLIC`.
* Job Invitation.
* Accept hoặc Reject Invitation.
* Chat.
* Interview Schedule.
* Notification.
* Job recommendation dựa trên Candidate Profile hoặc CV.
* Theo dõi lượt xem Job.
* Thống kê lượt xem Job.
* Bộ lọc ngày đăng.
* Bộ lọc mức lương.
* Sửa nội dung Job.
* Publish Job.
* Close Job.
* Expire Job.
* Delete Job.
* Quản lý Recruitment Team.
* Chuyển giao trách nhiệm Recruiter.
* Các nghiệp vụ quản trị Job nội bộ của Platform Admin.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V8 sử dụng các business concept đã tồn tại từ các version trước.

### User và Authentication

V8 kế thừa:

* `User`;
* authentication;
* role của User;
* trạng thái tài khoản.

V8 không thay đổi account lifecycle hoặc authentication lifecycle.

### Company

V8 kế thừa:

* `Company`;
* Company ownership;
* Company approval lifecycle;
* Company operational lifecycle;
* các thông tin Company đã tồn tại.

`Company.operationalStatus` tham gia trực tiếp vào public visibility của Job trong V8.

### Catalog

V8 sử dụng các catalog chuẩn đã tồn tại:

* Category;
* Location;
* Work mode;
* Employment type;
* Experience.

V8 không tạo catalog riêng cho Job Discovery.

### Job

V8 sử dụng Job đã được tạo và quản lý bởi business lifecycle của version trước.

V8 kế thừa:

* Company sở hữu Job;
* Job lifecycle;
* Job status;
* thời điểm publish;
* hạn nhận hồ sơ;
* nội dung tuyển dụng;
* Category;
* Location;
* Work mode;
* Employment type;
* Experience;
* thông tin lương theo contract Job hiện hữu.

V8 không thay đổi Job lifecycle hoặc thêm Job status mới.

### Recruitment Team

V8 không thay đổi:

* Primary Recruiter;
* Supporting Recruiter;
* responsibility transfer;
* các invariant Recruitment Team đã tồn tại.

Các thông tin Recruitment Team không phải dữ liệu công khai của Job Discovery.

### Candidate Profile và CV

V8 không thay đổi:

* Candidate Profile;
* CandidateCV;
* Generated CV;
* Uploaded CV;
* CV visibility;
* Default CV;
* Archive CV;
* lifecycle của Generated CV.

Candidate không cần có CV để sử dụng Job Discovery.

Version này không được làm thay đổi các invariant đã chốt của version trước, trừ khi tài liệu này ghi rõ thay đổi đã được phê duyệt.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Guest

Người dùng chưa đăng nhập.

Guest là actor hợp lệ của Job Discovery và được sử dụng các chức năng đọc công khai của V8.

### 4.2. Candidate

Người dùng có vai trò Candidate.

Candidate được sử dụng Job Discovery độc lập với Candidate Profile và Candidate CV.

V8 chưa trao cho Candidate khả năng Apply Job.

### 4.3. Recruiter

Recruiter thuộc Company Staff.

Recruiter được sử dụng Job Discovery để xem và nghiên cứu các cơ hội tuyển dụng đang công khai trên nền tảng, bao gồm Job của các Company khác.

Khả năng sử dụng Job Discovery không làm Recruiter trở thành Candidate và không tạo quyền Apply Job.

### 4.4. Company Manager

Company Manager thuộc Company Staff.

Company Manager không phải actor nghiệp vụ của Job Discovery trong V8.

Các nhu cầu của Company Manager tiếp tục được xử lý trong business context quản lý Company và các resource thuộc Company.

V8 không bổ sung capability Job Discovery riêng cho Company Manager.

### 4.5. Platform Admin

Platform Admin được sử dụng Job Discovery để quan sát các Job đang được công khai trên nền tảng.

Quyền truy cập Job Discovery của Platform Admin là quyền đọc trong boundary V8.

Các nghiệp vụ quản trị, kiểm soát hoặc xử lý Job ngoài phạm vi public Job Discovery không được định nghĩa bởi V8.

### 4.6. Discoverable Job

Một Job được coi là **Discoverable** khi đồng thời:

```text
Job.status = PUBLISHED
AND
thời điểm hiện tại chưa đến applicationDeadline
AND
Company.operationalStatus = ACTIVE
```

`Discoverable` là trạng thái hiệu lực phục vụ Job Discovery, không phải Job lifecycle status mới.

### 4.7. Historical Read-only Job

Job đã từng được công khai nhưng hiện không còn nhận hồ sơ do:

* Job đã `CLOSED`;
* Job đã `EXPIRED`;
* hoặc Job vẫn persisted là `PUBLISHED` nhưng hạn nhận hồ sơ đã qua;

và Company sở hữu Job vẫn `ACTIVE`.

Job này không còn thuộc tập Job Discovery nhưng vẫn có thể được xem trực tiếp ở chế độ chỉ đọc.

---

## 5. Quan hệ nghiệp vụ chính

### 5.1. Company và Job

```text
Company
   │
   │ 1 — N
   ↓
Job
```

Mỗi Job thuộc đúng một Company.

Một Company có thể có nhiều Job.

Trạng thái hoạt động của Company ảnh hưởng đến khả năng Job được công khai trong V8.

### 5.2. Job và Catalog

Job sử dụng các catalog chuẩn:

```text
Job
 ├─ Category
 ├─ Location
 ├─ Work mode
 ├─ Employment type
 └─ Experience
```

Các catalog này được sử dụng để hiển thị và lọc Job.

### 5.3. Category

Category có cấu trúc hai cấp:

```text
FIELD
  └─ POSITION
```

Một Position chỉ được sử dụng trong context của Field cha tương ứng.

### 5.4. User và Job

Guest, Candidate, Recruiter và Platform Admin chỉ đọc Job thông qua V8.

V8 không tạo quan hệ ownership giữa các actor này và Job.

V8 không tạo quan hệ Candidate–Job.

### 5.5. Recruiter và Company khác

Recruiter được phép đọc dữ liệu Job Discovery công khai của các Company khác.

Việc Recruiter thuộc một Company không giới hạn Job Discovery vào Company của chính Recruiter.

Phần này chỉ mô tả **quan hệ nghiệp vụ**.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Job lifecycle state được kế thừa

V8 không tạo Job state mới.

Các trạng thái Job được sử dụng theo canonical lifecycle của version trước:

* `DRAFT`
* `PENDING_APPROVAL`
* `PUBLISHED`
* `CLOSED`
* `EXPIRED`

V8 không bổ sung:

* `CHANGES_REQUESTED`
* `REJECTED`

### 6.2. Effective visibility state trong V8

V8 sử dụng ba trạng thái hiệu lực để xác định cách một Job được nhìn thấy trong Job Discovery.

| Effective state        | Ý nghĩa                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `DISCOVERABLE`         | Job xuất hiện trong list/search/filter và có public detail                                |
| `HISTORICAL_READ_ONLY` | Job không xuất hiện trong discovery mới nhưng public detail vẫn xem được ở chế độ chỉ đọc |
| `INACCESSIBLE`         | Job không được truy cập thông qua public Job Discovery                                    |

Các effective state này không thay thế hoặc thay đổi Job lifecycle status.

---

## 7. Tổ hợp trạng thái hợp lệ

| Job condition                    | Company condition      | Effective state trong V8 |
| -------------------------------- | ---------------------- | ------------------------ |
| `PUBLISHED`, chưa tới deadline   | `ACTIVE`               | `DISCOVERABLE`           |
| `PUBLISHED`, đã qua deadline     | `ACTIVE`               | `HISTORICAL_READ_ONLY`   |
| `CLOSED` và đã từng được public  | `ACTIVE`               | `HISTORICAL_READ_ONLY`   |
| `EXPIRED` và đã từng được public | `ACTIVE`               | `HISTORICAL_READ_ONLY`   |
| `DRAFT`                          | Bất kỳ                 | `INACCESSIBLE`           |
| `PENDING_APPROVAL`               | Bất kỳ                 | `INACCESSIBLE`           |
| Job otherwise public             | Company không `ACTIVE` | `INACCESSIBLE`           |
| Job đã bị xóa                    | Bất kỳ                 | `INACCESSIBLE`           |

Một Job persisted là `PUBLISHED` không mặc nhiên đồng nghĩa với `DISCOVERABLE`.

Deadline và trạng thái hoạt động hiện tại của Company phải đồng thời được xét.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Actor hợp lệ mở Job Discovery
        ↓
Xác định tập Job đủ điều kiện DISCOVERABLE
        ↓
Hiển thị Job theo thứ tự mặc định
        ↓
Actor có thể nhập keyword
        ↓
Actor có thể chọn các bộ lọc
        ↓
Keyword và filter được kết hợp
        ↓
Actor có thể chọn cách sắp xếp
        ↓
Actor mở Job
        ↓
Xem nội dung Job công khai
        ↓
Xem thông tin Company công khai
        ↓
Kết thúc boundary V8
```

Nếu Job đã từng public sau đó đóng hoặc hết hạn:

```text
Actor truy cập trực tiếp Job đã biết
        ↓
Company vẫn ACTIVE
        ↓
Job không còn nhận hồ sơ
        ↓
Hiển thị Job ở chế độ chỉ đọc
        ↓
Thể hiện rõ trạng thái không còn nhận hồ sơ
```

Nếu Company không còn `ACTIVE`:

```text
Job của Company
        ↓
Không còn xuất hiện trong Job Discovery
        ↓
Không còn truy cập được qua public Job detail của V8
```

---

# 9. Functional Requirements

## F01 — Truy cập Job Discovery

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor hợp lệ truy cập khu vực Job Discovery để khám phá các cơ hội tuyển dụng đang công khai.

### Tiền điều kiện

* Actor thuộc một trong các nhóm được V8 cho phép sử dụng Job Discovery.
* Không yêu cầu Candidate phải có Candidate Profile hoàn chỉnh hoặc CV.

### Luồng chính

1. Actor truy cập Job Discovery.
2. Hệ thống xác định các Job đủ điều kiện `DISCOVERABLE`.
3. Actor được sử dụng các chức năng đọc của V8.

### Kết quả

* Actor có thể tiếp tục xem danh sách, tìm kiếm, lọc, sắp xếp và xem Job.

### Trường hợp từ chối

* Authenticated Company Manager không phải actor của Job Discovery capability V8.
* Resource không đủ điều kiện public không được truy cập thông qua Job Discovery.

### Business Rules liên quan

* `BR-01`
* `BR-03`
* `BR-04`
* `BR-05`
* `BR-38`
* `BR-39`
* `BR-40`

### Không thuộc chức năng này

* Apply Job.
* Job administration.
* Company management.

---

## F02 — Xem danh sách Job

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor xem các cơ hội tuyển dụng đang thực sự còn hiệu lực và được phép công khai.

### Tiền điều kiện

Job phải đồng thời:

* có trạng thái `PUBLISHED`;
* chưa tới hạn nhận hồ sơ;
* thuộc Company có `operationalStatus = ACTIVE`.

### Luồng chính

1. Actor mở danh sách Job.
2. Hệ thống xác định tập Job `DISCOVERABLE`.
3. Hệ thống hiển thị các Job thuộc tập đó.
4. Nếu actor chưa chỉ định sort khác, áp dụng default sort theo các rule của V8.

### Kết quả

Danh sách có thể hiển thị các thông tin tuyển dụng công khai hiện hữu, bao gồm:

* tên Job;
* tên Company;
* logo Company;
* Category;
* Location;
* Work mode;
* Employment type;
* Experience;
* thông tin lương theo Job contract hiện hữu;
* ngày đăng;
* hạn nhận hồ sơ.

### Trường hợp từ chối

Không đưa vào danh sách:

* `DRAFT`;
* `PENDING_APPROVAL`;
* `CLOSED`;
* `EXPIRED`;
* `PUBLISHED` nhưng đã hết hạn;
* Job của Company không `ACTIVE`;
* Job đã bị xóa.

### Business Rules liên quan

* `BR-06`
* `BR-07`
* `BR-08`
* `BR-09`
* `BR-10`
* `BR-11`
* `BR-14`
* `BR-15`

### Không thuộc chức năng này

* Thay đổi dữ liệu Job.
* Apply Job.
* Saved Jobs.

---

## F03 — Tìm kiếm Job

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor tìm các Job `DISCOVERABLE` bằng từ khóa.

### Tiền điều kiện

* Search chỉ hoạt động trên tập Job đủ điều kiện `DISCOVERABLE`.

### Luồng chính

1. Actor nhập từ khóa.
2. Từ khóa được đối chiếu với:

   * tên Job;
   * kỹ năng yêu cầu;
   * tên Company;
   * Job Description.
3. Nếu đồng thời có filter, kết quả search phải tiếp tục thỏa mãn các filter đó.
4. Nếu actor không chỉ định sort, kết quả search được sắp theo `RELEVANCE`.

### Kết quả

* Chỉ Job `DISCOVERABLE` có nội dung phù hợp keyword mới được trả về.

### Trường hợp từ chối

Search không được làm xuất hiện:

* Job chưa public;
* Job đã đóng;
* Job đã hết hạn;
* Job của Company không `ACTIVE`;
* Job đã bị xóa.

### Business Rules liên quan

* `BR-16`
* `BR-17`
* `BR-25`
* `BR-31`
* `BR-33`

### Không thuộc chức năng này

* Định nghĩa công thức relevance score cụ thể.
* Job recommendation dựa trên Candidate Profile hoặc CV.

---

## F04 — Lọc Job

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor thu hẹp tập Job `DISCOVERABLE` theo các tiêu chí tuyển dụng chuẩn.

### Tiền điều kiện

* Filter chỉ áp dụng trên Job `DISCOVERABLE`.
* Filter sử dụng catalog chuẩn của hệ thống.

### Luồng chính

Actor có thể lọc theo:

1. Category.
2. Location.
3. Work mode.
4. Employment type.
5. Experience.

Đối với Category:

1. Actor có thể chọn nhiều Field.
2. Với mỗi Field đã chọn, actor có thể:

   * không chọn Position;
   * hoặc chọn một hay nhiều Position thuộc Field đó.
3. Không được coi Position thuộc Field khác là Position hợp lệ của Field đang xét.

Đối với các nhóm filter:

* nhiều giá trị trong cùng một nhóm sử dụng logic `OR`;
* các nhóm filter khác nhau sử dụng logic `AND`;
* keyword và filter sử dụng logic `AND`.

### Kết quả

* Chỉ các Job `DISCOVERABLE` thỏa mãn toàn bộ filter condition được hiển thị.

### Trường hợp từ chối

* Position không thuộc Field tương ứng không được coi là selection hợp lệ.
* Filter không được làm xuất hiện Job ngoài tập `DISCOVERABLE`.

### Business Rules liên quan

* `BR-18`
* `BR-19`
* `BR-20`
* `BR-21`
* `BR-22`
* `BR-23`
* `BR-24`
* `BR-25`
* `BR-26`
* `BR-27`

### Không thuộc chức năng này

* Bộ lọc ngày đăng.
* Bộ lọc mức lương.

---

## F05 — Sắp xếp kết quả

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor thay đổi thứ tự của tập kết quả Job Discovery.

### Tiền điều kiện

* Chỉ sắp xếp các Job đã vượt qua visibility, search và filter condition tương ứng.

### Luồng chính

Actor có thể chọn:

* `NEWEST`;
* `RELEVANCE`;
* `EXPIRING_SOON`.

Quy tắc mặc định:

* không có keyword và không chọn sort → `NEWEST`;
* có keyword và không chọn sort → `RELEVANCE`;
* yêu cầu `RELEVANCE` nhưng không có keyword → `NEWEST`.

### Kết quả

* `NEWEST` ưu tiên Job được publish gần nhất.
* `EXPIRING_SOON` ưu tiên Job còn hạn nhưng gần tới application deadline nhất.
* `RELEVANCE` ưu tiên mức độ khớp keyword theo business priority đã chốt.

### Trường hợp từ chối

* `RELEVANCE` không tạo một meaning riêng khi không có keyword.

### Business Rules liên quan

* `BR-28`
* `BR-29`
* `BR-30`
* `BR-31`
* `BR-32`
* `BR-33`
* `BR-34`

### Không thuộc chức năng này

* Công thức tính điểm relevance cụ thể.
* Quy tắc technical tie-break khi hai kết quả có mức ưu tiên tương đương.

---

## F06 — Xem chi tiết Job công khai

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor xem nội dung tuyển dụng công khai của một Job đủ điều kiện public.

### Tiền điều kiện

* Job thuộc một trạng thái visibility cho phép public detail.
* Company sở hữu Job phải `ACTIVE`.

### Luồng chính

1. Actor mở Job.
2. Hệ thống xác định public visibility hiện tại của Job.
3. Nếu Job `DISCOVERABLE`, hiển thị nội dung tuyển dụng công khai.

Thông tin có thể bao gồm:

* tên Job;
* tên Company;
* Job Description;
* kỹ năng yêu cầu;
* Category ngành;
* Category vị trí;
* Location;
* Work mode;
* Employment type;
* Experience;
* thông tin lương theo Job contract hiện hữu;
* ngày đăng;
* hạn nhận hồ sơ.

### Kết quả

* Actor xem được nội dung tuyển dụng công khai.
* Không có mutation đối với Job.

### Trường hợp từ chối

Không public:

* Job `DRAFT`;
* Job `PENDING_APPROVAL`;
* Job đã bị xóa;
* Job thuộc Company không `ACTIVE`.

### Business Rules liên quan

* `BR-12`
* `BR-13`
* `BR-14`
* `BR-15`
* `BR-35`

### Không thuộc chức năng này

* Recruitment Team.
* Application.
* Pipeline tuyển dụng.
* Internal notes.
* Job administration.

---

## F07 — Xem Job đã đóng hoặc hết hạn

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor tiếp tục đọc một Job đã từng public nhưng không còn nhận hồ sơ.

### Tiền điều kiện

Job thuộc một trong các trường hợp:

* `CLOSED`;
* `EXPIRED`;
* `PUBLISHED` nhưng application deadline đã qua;

và:

* Job đã thuộc public lifecycle trước đó;
* Company sở hữu Job vẫn `ACTIVE`.

### Luồng chính

1. Actor truy cập trực tiếp Job đã biết.
2. Hệ thống xác định Job không còn nhận hồ sơ.
3. Job không được đưa trở lại danh sách discovery.
4. Nội dung Job được hiển thị ở chế độ chỉ đọc.
5. Trạng thái phải thể hiện rõ Job đã đóng hoặc đã hết hạn tương ứng.

### Kết quả

* Actor vẫn có thể tham khảo nội dung tuyển dụng lịch sử.
* Job không được coi là đang nhận hồ sơ.

### Trường hợp từ chối

* Company không còn `ACTIVE`.
* Job chưa từng thuộc phạm vi public.
* Job đã bị xóa.

### Business Rules liên quan

* `BR-11`
* `BR-12`
* `BR-13`
* `BR-14`
* `BR-15`

### Không thuộc chức năng này

* Apply vào Job đã đóng hoặc hết hạn.
* Mở lại Job.
* Thay đổi Job lifecycle.

---

## F08 — Xem thông tin Company công khai

### Actor

* Guest.
* Candidate.
* Recruiter.
* Platform Admin.

### Mục tiêu

Cho phép actor xem thông tin công khai về Company đăng tuyển.

### Tiền điều kiện

* Company phải `ACTIVE`.
* Việc truy cập nằm trong context public của V8.

### Luồng chính

Actor có thể xem:

* tên Company;
* logo;
* banner;
* website;
* địa chỉ;
* mô tả Company;
* thông tin liên hệ.

### Kết quả

* Actor có thêm context về Company đăng tuyển.

### Trường hợp từ chối

* Company không `ACTIVE`.
* Dữ liệu Company thuộc phạm vi quản trị nội bộ.

### Business Rules liên quan

* `BR-08`
* `BR-13`
* `BR-36`
* `BR-37`
* `BR-40`

### Không thuộc chức năng này

* Company Manager information.
* Recruiter list.
* Company approval history.
* Internal dashboard.
* Internal recruitment metrics.
* Company administration.

---

# 10. Business Rules

## BR-01 — V8 là nghiệp vụ read-only

Mọi chức năng thuộc V8 chỉ đọc dữ liệu.

Search, filter, sort và view không được làm thay đổi Job, Company, Candidate hoặc các business entity khác.

---

## BR-02 — Không tạo Job Discovery business entity riêng

V8 sử dụng Job đã tồn tại từ version trước.

Job Discovery không tạo một loại Job hoặc đối tượng nghiệp vụ cạnh tranh với Job hiện hữu.

---

## BR-03 — Actor được sử dụng Job Discovery

Các actor được sử dụng Job Discovery gồm:

* Guest;
* Candidate;
* Recruiter;
* Platform Admin.

---

## BR-04 — Company Manager không phải actor của V8

V8 không bổ sung Job Discovery capability cho Company Manager khi request có
authenticated Company Manager context.

Điều này không thay đổi public access của Guest. Khi request không có
authenticated Company Manager context, hệ thống xử lý request theo Guest rules;
V8 không cố ngăn một người đã logout sử dụng public website.

Business capability của Company Manager tiếp tục nằm trong context quản lý Company.

---

## BR-05 — Candidate không cần CV để Discovery

Candidate không cần có Candidate CV, Default CV hoặc Candidate Profile hoàn chỉnh để:

* xem Job;
* search;
* filter;
* sort;
* xem Job detail;
* xem Company public information.

---

## BR-06 — Job phải `PUBLISHED` để Discoverable

Một Job chỉ có thể `DISCOVERABLE` khi Job có trạng thái `PUBLISHED`.

---

## BR-07 — Job phải còn hạn nhận hồ sơ

Một Job chỉ có thể `DISCOVERABLE` khi thời điểm hiện tại chưa tới application deadline.

Persisted `PUBLISHED` không đủ để kết luận Job còn nhận hồ sơ.

---

## BR-08 — Company phải `ACTIVE`

Một Job chỉ được public trong V8 khi Company sở hữu Job có `operationalStatus = ACTIVE`.

---

## BR-09 — Điều kiện Discoverable là đồng thời

Một Job chỉ là `DISCOVERABLE` khi đồng thời thỏa mãn:

```text
PUBLISHED
AND
chưa tới applicationDeadline
AND
Company ACTIVE
```

Không điều kiện nào trong ba điều kiện trên có thể thay thế điều kiện khác.

---

## BR-10 — Non-discoverable Job không xuất hiện trong kết quả mới

Job không đủ điều kiện `DISCOVERABLE` không được xuất hiện trong:

* danh sách Job mới;
* kết quả search mới;
* kết quả filter mới.

---

## BR-11 — Deadline có hiệu lực độc lập với persisted EXPIRED

Job `PUBLISHED` nhưng đã qua application deadline phải được xem là không còn nhận hồ sơ, kể cả khi Job chưa mang persisted state `EXPIRED`.

---

## BR-12 — Historical read-only access

Job đã từng public nhưng sau đó:

* `CLOSED`;
* `EXPIRED`;
* hoặc effectively expired do deadline đã qua;

có thể tiếp tục được xem trực tiếp ở chế độ chỉ đọc nếu Company vẫn `ACTIVE`.

Job đó không được xuất hiện trở lại trong discovery mới.

---

## BR-13 — Company không ACTIVE chặn toàn bộ public V8 access

Nếu Company không còn `ACTIVE`:

* Job của Company không xuất hiện trong list;
* không xuất hiện trong search;
* không xuất hiện trong filter;
* public Job detail của V8 không được truy cập;
* Company public information của V8 không được truy cập.

Rule này áp dụng kể cả khi Job vẫn `PUBLISHED` và còn deadline.

---

## BR-14 — Job chưa từng public không được public qua V8

`DRAFT` và `PENDING_APPROVAL` không được xem qua public Job Discovery.

V8 không thêm `CHANGES_REQUESTED` hoặc `REJECTED` vào Job lifecycle.

---

## BR-15 — Job đã bị xóa không còn thuộc V8

Job đã bị xóa theo business semantics của version trước không được:

* xuất hiện trong Job Discovery;
* mở lại qua public Job detail.

---

## BR-16 — Phạm vi keyword search

Keyword được đối chiếu với:

1. tên Job;
2. kỹ năng yêu cầu;
3. tên Company;
4. Job Description.

---

## BR-17 — Search không bypass visibility

Keyword search chỉ hoạt động trên tập Job `DISCOVERABLE`.

Search match không được làm một Job không public trở thành public.

---

## BR-18 — Các nhóm filter của V8

V8 hỗ trợ:

* Category;
* Location;
* Work mode;
* Employment type;
* Experience.

V8 không hỗ trợ:

* posted-date filter;
* salary filter.

---

## BR-19 — Category sử dụng catalog chuẩn

Category filter sử dụng cấu trúc Category chuẩn đã tồn tại:

```text
FIELD
  └─ POSITION
```

V8 không tạo Category riêng hoặc Category text tự do cho Job Discovery.

---

## BR-20 — Cho phép chọn nhiều Field

Actor có thể chọn nhiều Field trong cùng một lần filter.

Các Field được chọn là các alternative branch của Category filter.

---

## BR-21 — Position phải thuộc Field tương ứng

Với mỗi Field được chọn, actor có thể chọn một hoặc nhiều Position thuộc Field đó.

Position không thuộc Field tương ứng không được coi là selection hợp lệ của branch đó.

---

## BR-22 — Field không bắt buộc phải có Position

Một Field đã được chọn nhưng không có Position cụ thể vẫn là filter hợp lệ.

Trong trường hợp này, Job thuộc Field đó có thể match mà không bắt buộc phải thuộc một Position cụ thể đã chọn.

---

## BR-23 — OR trong cùng nhóm filter

Nhiều giá trị được chọn trong cùng một nhóm filter được kết hợp theo semantics `OR`.

Đối với Category, các Field branch được chọn cũng có semantics alternative giữa các branch.

---

## BR-24 — AND giữa các nhóm filter

Các nhóm filter khác nhau được kết hợp theo semantics `AND`.

Một Job phải thỏa mãn từng nhóm đang được sử dụng.

Nhóm không được chọn không hạn chế kết quả.

---

## BR-25 — Keyword và filter kết hợp bằng AND

Khi actor vừa nhập keyword vừa chọn filter:

```text
keyword match
AND
filter conditions
```

phải đồng thời đúng.

---

## BR-26 — Location và Work mode độc lập

Location và Work mode là hai business dimension độc lập.

Một Job có Location cụ thể vẫn có thể mang Work mode `REMOTE` nếu dữ liệu Job hợp lệ theo version trước.

---

## BR-27 — REMOTE không phải Location

`REMOTE` là Work mode.

V8 không coi `REMOTE` là một Location.

---

## BR-28 — Các cách sắp xếp

V8 hỗ trợ ba business sort:

* `NEWEST`;
* `RELEVANCE`;
* `EXPIRING_SOON`.

---

## BR-29 — NEWEST dựa trên thời điểm publish

`NEWEST` ưu tiên Job có thời điểm publish gần nhất.

Thời điểm Draft được tạo không phải business basis của sort `NEWEST`.

---

## BR-30 — EXPIRING_SOON dựa trên hạn nhận hồ sơ

`EXPIRING_SOON` ưu tiên Job còn nhận hồ sơ nhưng có application deadline gần nhất.

Job đã hết hạn không được đưa trở lại discovery chỉ để tham gia sort này.

---

## BR-31 — Business priority của RELEVANCE

Khi có keyword, mức độ liên quan phải ưu tiên các nhóm dữ liệu theo thứ tự:

```text
Tên Job
>
Kỹ năng yêu cầu
>
Tên Company
>
Job Description
```

V8 chỉ quy định thứ tự ưu tiên nghiệp vụ này.

---

## BR-32 — Default sort khi không có keyword

Nếu không có keyword và actor không chọn sort khác:

```text
NEWEST
```

là thứ tự mặc định.

---

## BR-33 — Default sort khi có keyword

Nếu có keyword và actor không chọn sort khác:

```text
RELEVANCE
```

là thứ tự mặc định.

---

## BR-34 — RELEVANCE không có keyword

Nếu `RELEVANCE` được yêu cầu nhưng không có keyword, effective sort là:

```text
NEWEST
```

---

## BR-35 — Job public projection không chứa dữ liệu nội bộ

Public Job Discovery không được công khai các thông tin nội bộ như:

* người tạo Job;
* Primary Recruiter;
* Supporting Recruiter;
* Recruitment Team;
* approval history;
* Application;
* recruitment pipeline;
* internal notes;
* internal recruiter assignment information.

---

## BR-36 — Company public information

Trong V8, thông tin Company được phép công khai gồm:

* tên;
* logo;
* banner;
* website;
* địa chỉ;
* mô tả;
* thông tin liên hệ.

---

## BR-37 — Company internal information không public

V8 không công khai:

* Company approval internals;
* review history;
* rejection information;
* Company Manager;
* Recruiter list;
* internal Recruitment Team information;
* Company dashboard;
* internal recruitment metrics.

---

## BR-38 — Recruiter Discovery không tạo Candidate capability

Recruiter được sử dụng Job Discovery để nghiên cứu thị trường.

Quyền này không làm Recruiter trở thành Candidate và không tạo quyền Apply Job.

---

## BR-39 — Platform Admin access không thay đổi boundary V8

Platform Admin được sử dụng Job Discovery để đọc các Job đang thuộc phạm vi public V8.

V8 không dùng quyền Platform Admin để mở rộng Job Discovery thành module quản trị hoặc mutation Job.

---

## BR-40 — Public discovery cho phép đọc cross-Company

Actor được phép sử dụng Job Discovery có thể đọc các Job public của nhiều Company khác nhau.

Recruiter không bị giới hạn chỉ xem Job thuộc Company của mình.

Việc đọc cross-Company chỉ áp dụng cho dữ liệu đã được V8 xác định là public.

---

## BR-41 — V8 không tạo quan hệ Candidate–Job

Các thao tác:

* xem Job;
* search;
* filter;
* sort;
* mở Job detail;

không tạo Candidate–Job relationship.

V8 không tạo business state cho:

* viewed Job;
* saved Job;
* search history;
* applied Job.

---

# 11. State Transitions

V8 không sở hữu Job lifecycle transition hoặc Company lifecycle transition mới.

Các thay đổi dưới đây chỉ mô tả **effective visibility của V8** khi state của version trước hoặc thời gian thay đổi.

| Nguyên nhân                                                 | Effective state trước                           | Effective state sau    | Actor gây transition trong V8                    |
| ----------------------------------------------------------- | ----------------------------------------------- | ---------------------- | ------------------------------------------------ |
| Job trở thành `PUBLISHED`, còn deadline và Company `ACTIVE` | `INACCESSIBLE`                                  | `DISCOVERABLE`         | Không có — lifecycle thuộc version trước         |
| Application deadline đi qua khi Company vẫn `ACTIVE`        | `DISCOVERABLE`                                  | `HISTORICAL_READ_ONLY` | Không có — phụ thuộc thời gian                   |
| Job được đóng theo lifecycle trước khi Company vẫn `ACTIVE` | `DISCOVERABLE`                                  | `HISTORICAL_READ_ONLY` | Không có — lifecycle thuộc version trước         |
| Job trở thành `EXPIRED` khi Company vẫn `ACTIVE`            | `DISCOVERABLE` hoặc trạng thái hết hạn hiệu lực | `HISTORICAL_READ_ONLY` | Không có — lifecycle thuộc version trước         |
| Company không còn `ACTIVE`                                  | `DISCOVERABLE` hoặc `HISTORICAL_READ_ONLY`      | `INACCESSIBLE`         | Không có — Company lifecycle thuộc version trước |
| Job bị xóa                                                  | Bất kỳ public effective state                   | `INACCESSIBLE`         | Không có — delete lifecycle thuộc version trước  |

Search, filter, sort và view **không tạo state transition**.

V8 không định nghĩa transition mới cho Job hoặc Company.

---

# 12. Authorization và ownership boundary

| Hành động                      | Actor được phép                             | Resource / Scope           | Điều kiện                                       |
| ------------------------------ | ------------------------------------------- | -------------------------- | ----------------------------------------------- |
| Mở Job Discovery               | Guest, Candidate, Recruiter, Platform Admin | Public Job Discovery       | Theo boundary V8                                |
| Xem Job list                   | Guest, Candidate, Recruiter, Platform Admin | Job `DISCOVERABLE`         | Job `PUBLISHED`, còn deadline, Company `ACTIVE` |
| Search Job                     | Guest, Candidate, Recruiter, Platform Admin | Job `DISCOVERABLE`         | Không bypass visibility                         |
| Filter Job                     | Guest, Candidate, Recruiter, Platform Admin | Job `DISCOVERABLE`         | Không bypass visibility                         |
| Sort Job                       | Guest, Candidate, Recruiter, Platform Admin | Tập kết quả hợp lệ         | Không thay đổi resource                         |
| Xem Job detail đang mở         | Guest, Candidate, Recruiter, Platform Admin | Job `DISCOVERABLE`         | Company `ACTIVE`                                |
| Xem Job historical read-only   | Guest, Candidate, Recruiter, Platform Admin | Job đã đóng/hết hạn        | Company `ACTIVE`                                |
| Xem Company public information | Guest, Candidate, Recruiter, Platform Admin | Public Company information | Company `ACTIVE`                                |
| Job Discovery capability riêng | Company Manager                             | Không thuộc V8             | V8 không định nghĩa capability này              |

Nguyên tắc authorization:

* Guest không cần account để sử dụng các chức năng public được V8 cho phép.
* Candidate không cần có CV để đọc Job.
* Recruiter có thể đọc public Job của Company khác.
* Platform Admin có quyền đọc Job Discovery nhưng V8 không mở rộng quyền đó thành Job administration.
* Company Manager không phải actor của Job Discovery trong version này.
* Không actor nào nhận được mutation permission đối với Job thông qua V8.

---

# 13. Multi-tenant boundary

Company là business boundary sở hữu Job.

```text
Company A
  └─ Job A1
  └─ Job A2

Company B
  └─ Job B1
```

V8 không thay đổi ownership này.

### Public cross-tenant read

Job Discovery là public/read-only surface.

Vì vậy Guest, Candidate, Recruiter và Platform Admin có thể đọc Job của nhiều Company khác nhau nếu Job thỏa mãn public visibility rules của V8.

Recruiter thuộc Company A vẫn có thể:

```text
xem Job public của Company B
```

để phục vụ Job Discovery và market research.

### Tenant isolation đối với dữ liệu nội bộ

Cross-Company public read không cho phép truy cập:

* Recruitment Team nội bộ;
* recruiter assignment;
* Company Manager;
* Recruiter list;
* approval internals;
* Application;
* pipeline;
* internal notes;
* internal Company metrics.

### Company operational boundary

Nếu Company không `ACTIVE`, các Job của Company đó không còn thuộc public surface của V8.

V8 không bổ sung ownership mới và không tạo mutation cross-tenant.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng đối với V8:

1. V8 luôn là read-only đối với Job, Company, Candidate và Recruitment Team.
2. V8 không tạo Job lifecycle state mới.
3. V8 không tạo một Job Discovery entity cạnh tranh với Job hiện hữu.
4. Một Job chỉ `DISCOVERABLE` khi `PUBLISHED`, còn deadline và Company `ACTIVE`.
5. Persisted `PUBLISHED` không đủ để khẳng định Job còn nhận hồ sơ.
6. Job `PUBLISHED` nhưng deadline đã qua không được xuất hiện trong discovery mới.
7. Job `CLOSED` hoặc `EXPIRED` không được xuất hiện trong discovery mới.
8. Job historical chỉ được public read-only khi Company vẫn `ACTIVE`.
9. Company không `ACTIVE` làm Job mất cả discovery visibility và public detail visibility trong V8.
10. `DRAFT` và `PENDING_APPROVAL` không được public qua V8.
11. Job đã bị xóa không được public lại qua V8.
12. Search không được bypass public eligibility.
13. Filter không được bypass public eligibility.
14. Sort không được bypass public eligibility.
15. Keyword và filter không làm thay đổi dữ liệu Job.
16. Category Position phải được hiểu trong context của Field cha tương ứng.
17. Location và Work mode luôn là hai dimension độc lập.
18. `REMOTE` không phải Location.
19. Candidate không cần CV để sử dụng V8.
20. Recruiter được Discovery access nhưng không nhận Candidate capability.
21. Platform Admin Discovery access không biến V8 thành Job administration.
22. Company Manager không nhận Job Discovery capability mới từ V8.
23. Public Job response không được leak Recruitment Team hoặc hiring internals.
24. Public Company information không được leak Company administration internals.
25. Job Discovery không tạo Candidate–Job relationship.
26. V8 không làm thay đổi invariant của các version trước.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng **chủ động không thuộc V8**:

* Saved Jobs.
* Apply Job.
* CV selection khi Apply.
* Upload CV khi Apply.
* Application creation.
* Submitted CV snapshot.
* Application snapshot.
* Replace Submitted CV.
* Withdraw Application.
* My Applications.
* Candidate Search.
* Recruiter access tới Candidate CV `PUBLIC`.
* Job Invitation.
* Accept/Reject Invitation.
* Chat.
* Interview Schedule.
* Notification.
* Job recommendation dựa trên Candidate Profile hoặc CV.
* Job view tracking.
* Job view analytics.
* Posted-date filter.
* Salary filter.
* Job editing.
* Job lifecycle mutation.
* Recruitment Team management.
* Administrative Job handling của Platform Admin.

Các nội dung trên có thể thuộc version sau hoặc thuộc module đã được version khác sở hữu.

Không được tự implement các nội dung này trong V8.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V8.

Các quyết định liên quan đến cách hiện thực hóa search, relevance calculation, data access, API hoặc technical optimization không thuộc Product Specification này và không được dùng để thay đổi business behavior đã chốt.

---

# 17. Definition of Business Completion

V8 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Truy cập Job Discovery đã được đáp ứng;
* `F02` — Xem danh sách Job đã được đáp ứng;
* `F03` — Tìm kiếm Job đã được đáp ứng;
* `F04` — Lọc Job đã được đáp ứng;
* `F05` — Sắp xếp kết quả đã được đáp ứng;
* `F06` — Xem chi tiết Job công khai đã được đáp ứng;
* `F07` — Xem Job đã đóng hoặc hết hạn đã được đáp ứng;
* `F08` — Xem thông tin Company công khai đã được đáp ứng;
* toàn bộ `BR-01` đến `BR-41` được đáp ứng;
* effective visibility rules luôn được giữ;
* authorization boundary được giữ;
* Company tenant boundary được giữ;
* public data không leak internal Company hoặc Recruitment Team data;
* lifecycle invariants luôn đúng;
* Job Discovery không tạo mutation;
* các chức năng đã defer không bị implementation ngoài ý muốn;
* không xuất hiện behavior ngoài boundary của V8.

Việc code chạy hoặc test pass **không tự động đồng nghĩa** với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là **canonical business specification** của V8 — Job Discovery.

Tài liệu này định nghĩa:

```text
WHAT MUST HAPPEN
```

không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Tài liệu này không quy định:

* REST endpoint;
* HTTP method;
* HTTP status code;
* request/response body;
* controller;
* service;
* route;
* middleware implementation;
* persistence implementation;
* database query;
* search engine;
* relevance scoring formula cụ thể;
* index;
* pagination mechanism;
* source-code structure;
* test framework.

Các quyết định đó thuộc các contract và bước thiết kế phía sau Product Specification.

```text
Product Specification
        │
        │ business truth
        ↓
Data Contract
        │
        │ persistence truth
        ↓
Engineering Contracts
        │
        │ architecture truth
        ↓
Implementation
```

Nếu implementation hoặc data design mâu thuẫn với tài liệu này, **Product Specification là authority đối với business behavior**, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
