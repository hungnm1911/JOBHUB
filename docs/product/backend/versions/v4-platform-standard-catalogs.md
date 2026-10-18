# V4 — Quản lý danh mục chuẩn của nền tảng

> **File:** `docs/product/versions/v4-platform-standard-catalogs.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V4 — Quản lý danh mục chuẩn của nền tảng.

---

## 1. Mục tiêu

V4 thiết lập hệ thống dữ liệu chuẩn dùng chung ở cấp nền tảng cho các nghiệp vụ tuyển dụng.

Sau khi V4 hoàn thành, nền tảng phải có:

- hệ thống `Category` chuẩn gồm đúng hai cấp: nghề/lĩnh vực và vị trí;
- khả năng để Platform Admin bổ sung Category mới;
- tập `Location` chuẩn cố định gồm 63 tỉnh/thành theo canonical Vietnam
  location snapshot và một special member `FOREIGN`;
- tập `EmploymentType` cố định;
- tập `WorkMode` cố định;
- tập `ExperienceLevel` cố định.

Các dữ liệu chuẩn của V4 được dùng chung trên toàn nền tảng, không thuộc riêng một Company.

V4 chỉ thiết lập và quản lý dữ liệu chuẩn.

Việc Job, CV, tìm kiếm hoặc các nghiệp vụ tuyển dụng khác sử dụng các dữ liệu này như thế nào thuộc các version tương ứng.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V4 bao gồm:

- xác lập `Category` là danh mục chuẩn cấp nền tảng;
- xác lập cấu trúc Category gồm đúng hai cấp:
  - `FIELD`;
  - `POSITION`;
- cho phép Platform Admin thêm Category `FIELD`;
- cho phép Platform Admin thêm Category `POSITION` vào một `FIELD` đã tồn tại;
- bảo đảm Category sau khi được tạo là bất biến;
- xác lập quy tắc uniqueness của Category;
- xác lập `Location` là tập giá trị chuẩn cố định gồm 63 tỉnh/thành theo
  canonical Vietnam location snapshot và `FOREIGN`;
- xác lập `EmploymentType` là tập giá trị chuẩn cố định;
- xác lập `WorkMode` là tập giá trị chuẩn cố định;
- xác lập `ExperienceLevel` là tập giá trị chuẩn cố định;
- xác lập các dữ liệu V4 là dữ liệu dùng chung toàn nền tảng;
- ngăn Company Manager, Recruiter và Candidate tự tạo Category.

### 2.2. Ngoài phạm vi

V4 không bao gồm:

- sửa Category đã tồn tại;
- đổi tên Category;
- đổi level của Category;
- chuyển `POSITION` sang `FIELD` khác;
- xóa Category;
- disable/deactivate Category;
- reactivate Category;
- quản trị động `Location`;
- quản trị động `EmploymentType`;
- quản trị động `WorkMode`;
- quản trị động `ExperienceLevel`;
- tạo Job;
- cập nhật Job;
- Candidate Profile;
- tạo hoặc upload CV;
- quy tắc Job chọn Category nào;
- quy tắc CV chọn Category nào;
- số lượng Category trên Job hoặc CV;
- số lượng Location trên Job hoặc CV;
- số lượng EmploymentType trên Job hoặc CV;
- số lượng WorkMode trên Job hoặc CV;
- số lượng ExperienceLevel trên Job hoặc CV;
- tìm kiếm Job;
- Candidate Search;
- matching Job và CV;
- Application;
- snapshot dữ liệu chuẩn;
- quy trình thay đổi hoặc version hóa các bộ giá trị cố định.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V4 sử dụng các capability đã tồn tại từ các version trước:

- `User`;
- Authentication;
- `AuthSession`;
- `AuthToken`;
- role `PLATFORM_ADMIN`;
- `Company`;
- `CompanyMember`;
- role `COMPANY_MANAGER`;
- role `RECRUITER`.

V4 không tạo loại User mới.

Platform Admin tiếp tục được nhận diện bằng role cấp nền tảng đã tồn tại.

V4 không thay đổi:

- lifecycle của User;
- authentication;
- session;
- token;
- Company;
- lifecycle của Company;
- CompanyMember;
- lifecycle của CompanyMember;
- quyền và lifecycle của Company Manager;
- quyền và lifecycle của Recruiter.

V4 không được làm thay đổi các invariant đã chốt của V1, V2 và V3, trừ khi tài liệu này ghi rõ thay đổi đã được phê duyệt.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Platform Admin

Platform Admin là actor quản trị dữ liệu chuẩn cấp nền tảng.

Trong V4, Platform Admin là actor duy nhất được phép bổ sung Category mới.

Platform Admin không thuộc Company để thực hiện quyền này.

### 4.2. Category

`Category` biểu diễn nghề/lĩnh vực và các vị trí cụ thể thuộc nghề/lĩnh vực đó.

Category có đúng hai level nghiệp vụ:

```text
FIELD
└── POSITION
````

Trong đó:

* `FIELD` biểu diễn nghề hoặc lĩnh vực;
* `POSITION` biểu diễn vị trí cụ thể thuộc một `FIELD`.

Cả `FIELD` và `POSITION` đều là Category.

### 4.3. Category FIELD

`FIELD` là Category cấp thứ nhất.

Ví dụ về mặt nghiệp vụ:

```text
IT
Marketing
Finance
```

`FIELD` không thuộc Category cha nào.

### 4.4. Category POSITION

`POSITION` là Category cấp thứ hai.

Mỗi `POSITION` bắt buộc thuộc đúng một `FIELD`.

Ví dụ:

```text
IT
├── Backend Developer
├── Frontend Developer
└── DevOps
```

### 4.5. Location

`Location` là dữ liệu chuẩn dùng để biểu diễn địa điểm làm việc theo tập cố
định của nền tảng.

Tập Location gồm:

* 63 tỉnh/thành theo canonical Vietnam location snapshot;
* một special member `FOREIGN`, biểu diễn địa điểm làm việc ngoài Việt Nam.

Canonical snapshot này không tự động thay đổi theo các thay đổi địa giới hành
chính sau khi V4 được khóa.

`FOREIGN` không đại diện cho một quốc gia cụ thể và không tạo country
hierarchy.

Location trong V4 không biểu diễn:

* quận/huyện;
* phường/xã;
* địa chỉ chi tiết;
* địa chỉ cư trú;
* Remote.

Location là tập giá trị cố định của nền tảng.

### 4.6. EmploymentType

`EmploymentType` biểu diễn loại hình công việc hoặc quan hệ làm việc.

Tập giá trị cố định:

```text
EmploymentType
├── FULL_TIME
├── PART_TIME
├── INTERNSHIP
├── CONTRACT
├── TEMPORARY
├── FREELANCE
├── SEASONAL
└── APPRENTICESHIP
```

### 4.7. WorkMode

`WorkMode` biểu diễn phương thức làm việc.

Tập giá trị cố định:

```text
WorkMode
├── ONSITE
├── HYBRID
└── REMOTE
```

`REMOTE` thuộc WorkMode và không phải Location.

### 4.8. ExperienceLevel

`ExperienceLevel` biểu diễn mức kinh nghiệm chuẩn được sử dụng trên nền tảng.

Tập giá trị cố định:

```text
ExperienceLevel
├── NO_EXPERIENCE
├── UNDER_1_YEAR
├── ONE_TO_THREE_YEARS
├── THREE_TO_FIVE_YEARS
├── FIVE_TO_TEN_YEARS
└── OVER_TEN_YEARS
```

ExperienceLevel là metadata phân loại mức kinh nghiệm.

ExperienceLevel không đồng nhất với phần Work Experience chi tiết có thể xuất hiện trong CV ở version sau.

### 4.9. Company Manager

Company Manager không có quyền tạo hoặc quản trị Category cấp nền tảng.

### 4.10. Recruiter

Recruiter không có quyền tự tạo Category trong quá trình thực hiện các nghiệp vụ tuyển dụng.

### 4.11. Candidate

Candidate không có quyền tự tạo Category khi sử dụng các nghiệp vụ liên quan CV hoặc hồ sơ ở version sau.

---

## 5. Quan hệ nghiệp vụ chính

### 5.1. Quan hệ giữa Category FIELD và POSITION

Quan hệ nghiệp vụ:

```text
Category FIELD
      │
      │ 1
      │
      │ chứa
      │
      │ 0..N
      ↓
Category POSITION
```

Chiều ngược lại:

```text
Category POSITION
      │
      │ thuộc đúng 1
      ↓
Category FIELD
```

Một `FIELD` có thể tồn tại mà chưa có `POSITION`.

Một `POSITION` không được tồn tại nếu không thuộc một `FIELD`.

Không tồn tại cấp Category thứ ba.

Không tồn tại quan hệ:

```text
POSITION
└── POSITION
```

hoặc:

```text
FIELD
└── FIELD
```

### 5.2. Quan hệ giữa dữ liệu chuẩn và Company

Các dữ liệu V4 thuộc cấp nền tảng:

```text
Platform
├── Category
├── Location
├── EmploymentType
├── WorkMode
└── ExperienceLevel
```

Các Company sử dụng chung cùng một hệ thống dữ liệu chuẩn.

Không tồn tại:

```text
Company A Category
Company B Category
Company C Category
```

trong phạm vi V4.

### 5.3. Quan hệ giữa Location và WorkMode

Location và WorkMode là hai khái niệm nghiệp vụ độc lập.

```text
Location
→ công việc gắn với tỉnh/thành nào hoặc ở ngoài Việt Nam

WorkMode
→ công việc được thực hiện theo phương thức nào
```

`REMOTE` chỉ thuộc WorkMode.

Remote không được biểu diễn như một Location.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Category

Category không có lifecycle state có thể thay đổi sau khi được tạo.

Category không có các trạng thái nghiệp vụ như:

* `ACTIVE`;
* `INACTIVE`;
* `DISABLED`;
* `DELETED`.

Sau khi Category được tạo hợp lệ, Category tiếp tục tồn tại dưới chính identity và cấu trúc nghiệp vụ đã được xác lập tại thời điểm tạo.

`FIELD` và `POSITION` là level/type của Category, không phải lifecycle state.

### 6.2. Location, EmploymentType, WorkMode và ExperienceLevel

Các tập giá trị này là dữ liệu chuẩn cố định.

Chúng không có lifecycle state quản trị trong V4.

---

## 7. Tổ hợp trạng thái hợp lệ

> Version này không có state combination cần định nghĩa riêng.

`FIELD` và `POSITION` là hai loại Category khác nhau chứ không phải hai state dimension độc lập.

---

## 8. Quy trình nghiệp vụ tổng thể

### 8.1. Category FIELD

```text
Platform Admin
      ↓
Yêu cầu bổ sung FIELD mới
      ↓
Kiểm tra Category theo business rules V4
      ↓
FIELD mới được bổ sung vào danh mục chuẩn
      ↓
FIELD tồn tại bất biến
```

### 8.2. Category POSITION

```text
Platform Admin
      ↓
Chọn FIELD đã tồn tại
      ↓
Yêu cầu bổ sung POSITION mới
      ↓
Kiểm tra cấu trúc và uniqueness
      ↓
POSITION được bổ sung dưới FIELD
      ↓
POSITION tồn tại bất biến
```

### 8.3. Các bộ giá trị cố định

```text
Platform Standard Data
      ↓
Location
EmploymentType
WorkMode
ExperienceLevel
      ↓
Được sử dụng như các tập giá trị chuẩn cố định
```

Các actor không có workflow thêm, sửa hoặc xóa các tập giá trị cố định này trong V4.

---

# 9. Functional Requirements

## F01 — Thêm Category FIELD

### Actor

* Platform Admin.

### Mục tiêu

Platform Admin bổ sung một nghề hoặc lĩnh vực mới vào danh mục Category chuẩn của nền tảng.

### Tiền điều kiện

* Actor là Platform Admin hợp lệ.
* FIELD cần tạo chưa tồn tại theo quy tắc uniqueness của V4.

### Luồng chính

1. Platform Admin yêu cầu bổ sung một Category cấp `FIELD`.
2. Hệ thống xác định Category mới là `FIELD`.
3. Hệ thống kiểm tra uniqueness của FIELD trên toàn nền tảng.
4. Nếu hợp lệ, FIELD mới được bổ sung vào danh mục Category chuẩn.
5. FIELD mới trở thành Category bất biến của nền tảng.

### Kết quả

* Một Category `FIELD` mới tồn tại ở cấp nền tảng.
* FIELD không có Category cha.
* FIELD có thể được sử dụng làm Category cha cho các POSITION được tạo sau đó.
* FIELD không thể bị sửa hoặc xóa sau khi được tạo.

### Trường hợp từ chối

* Actor không phải Platform Admin.
* FIELD trùng với một FIELD đã tồn tại.
* Yêu cầu tạo FIELD như một Category con.
* Yêu cầu tạo Category làm phát sinh level thứ ba.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-03`
* `BR-05`
* `BR-06`
* `BR-07`
* `BR-08`
* `BR-09`
* `BR-18`

### Không thuộc chức năng này

* sửa FIELD;
* đổi tên FIELD;
* xóa FIELD;
* disable FIELD;
* chuyển FIELD thành POSITION.

---

## F02 — Thêm Category POSITION

### Actor

* Platform Admin.

### Mục tiêu

Platform Admin bổ sung một vị trí mới vào một Category FIELD đã tồn tại.

### Tiền điều kiện

* Actor là Platform Admin hợp lệ.
* FIELD cha đã tồn tại.
* POSITION cần tạo chưa tồn tại trong FIELD đó theo quy tắc uniqueness của V4.

### Luồng chính

1. Platform Admin xác định FIELD cha.
2. Platform Admin yêu cầu bổ sung POSITION mới dưới FIELD đó.
3. Hệ thống xác nhận Category cha là `FIELD`.
4. Hệ thống kiểm tra uniqueness của POSITION trong FIELD cha.
5. Nếu hợp lệ, POSITION được bổ sung dưới FIELD.
6. POSITION mới trở thành Category bất biến của nền tảng.

### Kết quả

* Một Category `POSITION` mới tồn tại.
* POSITION thuộc đúng một FIELD.
* POSITION không thể đổi FIELD sau khi được tạo.
* POSITION không thể bị sửa hoặc xóa sau khi được tạo.

### Trường hợp từ chối

* Actor không phải Platform Admin.
* FIELD cha không tồn tại.
* Category cha không phải FIELD.
* POSITION trùng với POSITION đã tồn tại trong cùng FIELD.
* Yêu cầu tạo POSITION không có FIELD cha.
* Yêu cầu làm phát sinh Category cấp thứ ba.

### Business Rules liên quan

* `BR-01`
* `BR-02`
* `BR-04`
* `BR-05`
* `BR-06`
* `BR-07`
* `BR-08`
* `BR-10`
* `BR-18`

### Không thuộc chức năng này

* đổi tên POSITION;
* chuyển POSITION sang FIELD khác;
* đổi POSITION thành FIELD;
* xóa POSITION;
* disable POSITION.

---

## F03 — Cung cấp Location chuẩn của nền tảng

### Actor

* Hệ thống.

### Mục tiêu

Nền tảng có một tập Location chuẩn thống nhất cho các nghiệp vụ sử dụng Location.

### Tiền điều kiện

* Không có.

### Luồng chính

1. Nền tảng xác lập Location là tập giá trị cố định.
2. Mỗi Location đại diện cho một trong 63 tỉnh/thành thuộc canonical Vietnam
   location snapshot hoặc special member `FOREIGN`.
3. Nền tảng không coi Remote là Location.
4. Nền tảng không cho actor tự mở rộng tập Location trong V4.

### Kết quả

* Location có một định nghĩa nghiệp vụ thống nhất trên toàn nền tảng.
* Location không thuộc riêng Company nào.

### Trường hợp từ chối

Một giá trị không được coi là Location hợp lệ của V4 nếu nó biểu diễn:

* Remote;
* một quốc gia cụ thể;
* quận/huyện;
* phường/xã;
* địa chỉ chi tiết.

### Business Rules liên quan

* `BR-01`
* `BR-11`
* `BR-12`
* `BR-17`

### Không thuộc chức năng này

* Platform Admin thêm Location;
* sửa Location;
* xóa Location;
* phân cấp Location;
* địa chỉ chi tiết.

---

## F04 — Cung cấp EmploymentType chuẩn của nền tảng

### Actor

* Hệ thống.

### Mục tiêu

Nền tảng sử dụng một tập EmploymentType cố định và thống nhất.

### Tiền điều kiện

* Không có.

### Luồng chính

1. Nền tảng xác lập tập EmploymentType cố định.
2. Các giá trị thuộc tập EmploymentType được coi là giá trị chuẩn.
3. Không actor nào được bổ sung, sửa hoặc xóa EmploymentType trong V4.

### Kết quả

Tập EmploymentType chuẩn gồm:

```text
FULL_TIME
PART_TIME
INTERNSHIP
CONTRACT
TEMPORARY
FREELANCE
SEASONAL
APPRENTICESHIP
```

### Trường hợp từ chối

* Giá trị ngoài tập EmploymentType đã chốt không được coi là EmploymentType hợp lệ của V4.
* Actor yêu cầu thêm, sửa hoặc xóa EmploymentType.

### Business Rules liên quan

* `BR-01`
* `BR-13`
* `BR-17`

### Không thuộc chức năng này

* quản trị động EmploymentType;
* EmploymentType riêng theo Company;
* quy tắc Job hoặc CV chọn một hay nhiều EmploymentType.

---

## F05 — Cung cấp WorkMode chuẩn của nền tảng

### Actor

* Hệ thống.

### Mục tiêu

Nền tảng sử dụng một tập WorkMode cố định và thống nhất.

### Tiền điều kiện

* Không có.

### Luồng chính

1. Nền tảng xác lập tập WorkMode cố định.
2. Các giá trị thuộc tập WorkMode được coi là giá trị chuẩn.
3. `REMOTE` được xác định là WorkMode.
4. Không actor nào được bổ sung, sửa hoặc xóa WorkMode trong V4.

### Kết quả

Tập WorkMode chuẩn gồm:

```text
ONSITE
HYBRID
REMOTE
```

### Trường hợp từ chối

* Giá trị ngoài tập WorkMode đã chốt không được coi là WorkMode hợp lệ của V4.
* Actor yêu cầu thêm, sửa hoặc xóa WorkMode.
* Remote được sử dụng như một Location.

### Business Rules liên quan

* `BR-01`
* `BR-12`
* `BR-14`
* `BR-17`

### Không thuộc chức năng này

* quản trị động WorkMode;
* WorkMode riêng theo Company;
* quy tắc Job hoặc CV chọn một hay nhiều WorkMode.

---

## F06 — Cung cấp ExperienceLevel chuẩn của nền tảng

### Actor

* Hệ thống.

### Mục tiêu

Nền tảng sử dụng một tập ExperienceLevel cố định để chuẩn hóa mức kinh nghiệm.

### Tiền điều kiện

* Không có.

### Luồng chính

1. Nền tảng xác lập tập ExperienceLevel cố định.
2. Mỗi giá trị biểu diễn một mức kinh nghiệm chuẩn.
3. Không actor nào được bổ sung, sửa hoặc xóa ExperienceLevel trong V4.

### Kết quả

Tập ExperienceLevel chuẩn gồm:

```text
NO_EXPERIENCE
UNDER_1_YEAR
ONE_TO_THREE_YEARS
THREE_TO_FIVE_YEARS
FIVE_TO_TEN_YEARS
OVER_TEN_YEARS
```

### Trường hợp từ chối

* Giá trị ngoài tập ExperienceLevel đã chốt không được coi là ExperienceLevel hợp lệ của V4.
* Actor yêu cầu thêm, sửa hoặc xóa ExperienceLevel.

### Business Rules liên quan

* `BR-01`
* `BR-15`
* `BR-16`
* `BR-17`

### Không thuộc chức năng này

* quản trị động ExperienceLevel;
* tính ExperienceLevel từ Work Experience;
* kiểm chứng kinh nghiệm của Candidate;
* matching ExperienceLevel giữa Job và CV;
* quy tắc Job hoặc CV chọn ExperienceLevel.

---

# 10. Business Rules

## BR-01 — Dữ liệu chuẩn thuộc cấp nền tảng

`Category`, `Location`, `EmploymentType`, `WorkMode` và `ExperienceLevel` là dữ liệu chuẩn dùng chung cấp nền tảng.

Không nhóm dữ liệu nào trong V4 thuộc riêng một Company.

---

## BR-02 — Category có đúng hai level

Category chỉ có hai level nghiệp vụ:

```text
FIELD
POSITION
```

Không tồn tại level thứ ba trong V4.

---

## BR-03 — FIELD là Category cấp gốc

Category `FIELD`:

* biểu diễn nghề hoặc lĩnh vực;
* không thuộc Category cha;
* có thể chứa từ 0 đến nhiều POSITION.

---

## BR-04 — POSITION bắt buộc thuộc FIELD

Mỗi Category `POSITION`:

* biểu diễn một vị trí cụ thể;
* bắt buộc thuộc đúng một Category `FIELD`;
* không được tồn tại độc lập;
* không được thuộc một POSITION khác.

---

## BR-05 — Không được tạo hierarchy sâu hơn hai cấp

Cấu trúc duy nhất được phép là:

```text
FIELD
└── POSITION
```

Các cấu trúc sau không hợp lệ:

```text
FIELD
└── FIELD
```

```text
POSITION
└── POSITION
```

```text
FIELD
└── POSITION
    └── Category khác
```

---

## BR-06 — Category không được tạo từ text tự do của nghiệp vụ sử dụng

Category phải tồn tại trước như dữ liệu chuẩn của nền tảng.

Các nghiệp vụ Job, CV hoặc nghiệp vụ khác ở version sau không được tự tạo Category mới thông qua text do Company Manager, Recruiter hoặc Candidate nhập.

---

## BR-07 — Chỉ Platform Admin được thêm Category

Platform Admin là actor duy nhất được phép:

* thêm FIELD;
* thêm POSITION.

Company Manager, Recruiter và Candidate không được tạo Category.

---

## BR-08 — Category bất biến sau khi tạo

Sau khi Category được tạo hợp lệ, không actor nào được:

* đổi tên Category;
* sửa Category;
* đổi level;
* chuyển POSITION sang FIELD khác;
* xóa Category;
* disable Category;
* deactivate Category;
* reactivate Category.

Category là dữ liệu append-only trong phạm vi V4.

---

## BR-09 — FIELD unique toàn nền tảng

Hai Category `FIELD` không được biểu diễn cùng một FIELD trong hệ thống.

Uniqueness của FIELD áp dụng trên toàn platform, không theo Company.

---

## BR-10 — POSITION unique trong FIELD

Trong cùng một FIELD, không được tồn tại hai POSITION biểu diễn cùng một vị trí.

Cùng một tên POSITION có thể tồn tại ở các FIELD khác nhau.

Ví dụ hợp lệ:

```text
IT
└── Project Manager

Marketing
└── Project Manager
```

---

## BR-11 — Location là canonical snapshot cố định của nền tảng

Location trong V4 gồm đúng:

* 63 tỉnh/thành theo canonical Vietnam location snapshot;
* một special member `FOREIGN`, biểu diễn địa điểm làm việc ngoài Việt Nam.

Tập Location không tự động thay đổi theo các thay đổi địa giới hành chính sau
khi V4 được khóa.

`FOREIGN` không đại diện cho một quốc gia cụ thể.

Không mở rộng Location thành hierarchy:

```text
Country
Province
District
Ward
```

Location không biểu diễn địa chỉ chi tiết.

---

## BR-12 — Remote không phải Location

`REMOTE` không phải Location.

`REMOTE` chỉ thuộc WorkMode.

Location và WorkMode là hai khái niệm nghiệp vụ độc lập.

---

## BR-13 — EmploymentType là tập giá trị cố định

EmploymentType chỉ gồm:

```text
FULL_TIME
PART_TIME
INTERNSHIP
CONTRACT
TEMPORARY
FREELANCE
SEASONAL
APPRENTICESHIP
```

Không actor nào được thêm, sửa hoặc xóa giá trị khỏi tập này trong V4.

---

## BR-14 — WorkMode là tập giá trị cố định

WorkMode chỉ gồm:

```text
ONSITE
HYBRID
REMOTE
```

Không actor nào được thêm, sửa hoặc xóa giá trị khỏi tập này trong V4.

---

## BR-15 — ExperienceLevel là tập giá trị cố định

ExperienceLevel chỉ gồm:

```text
NO_EXPERIENCE
UNDER_1_YEAR
ONE_TO_THREE_YEARS
THREE_TO_FIVE_YEARS
FIVE_TO_TEN_YEARS
OVER_TEN_YEARS
```

Không actor nào được thêm, sửa hoặc xóa giá trị khỏi tập này trong V4.

---

## BR-16 — ExperienceLevel khác Work Experience chi tiết

ExperienceLevel là metadata chuẩn hóa mức kinh nghiệm.

ExperienceLevel không phải phần lịch sử làm việc chi tiết của Candidate.

Các dữ liệu như:

* công ty đã làm việc;
* vị trí;
* thời gian làm việc;
* mô tả công việc;
* thành tựu;

không thuộc ExperienceLevel của V4.

---

## BR-17 — Các bộ giá trị cố định không có nghiệp vụ quản trị động

Các nhóm sau là dữ liệu cố định:

* Location;
* EmploymentType;
* WorkMode;
* ExperienceLevel.

Trong V4 không có nghiệp vụ:

```text
create
update
delete
disable
reactivate
```

đối với các tập giá trị này.

---

## BR-18 — Category không phải dữ liệu multi-tenant

Category thuộc cấp nền tảng.

Không tồn tại Category riêng của từng Company.

Việc một Platform Admin tạo Category làm Category đó thuộc danh mục chung của platform, không thuộc một tenant cụ thể.

---

## BR-19 — Không mở rộng quyền quản lý danh mục cho CompanyMember

V4 không bổ sung role quản lý catalog vào CompanyMember.

`COMPANY_MANAGER` và `RECRUITER` không có quyền quản trị Category cấp nền tảng.

---

## BR-20 — Dữ liệu chuẩn V4 phải có một ý nghĩa thống nhất trên toàn nền tảng

Một giá trị thuộc:

* Category;
* Location;
* EmploymentType;
* WorkMode;
* ExperienceLevel;

có cùng ý nghĩa nghiệp vụ bất kể Company hoặc actor nào sử dụng nó ở các version sau.

---

# 11. State Transitions

Category không có lifecycle state mutable.

Các transition duy nhất thuộc business contract V4 là creation transition:

| Hành động     | Trước                             | Sau                                  | Actor          |
| ------------- | --------------------------------- | ------------------------------------ | -------------- |
| Thêm FIELD    | FIELD chưa tồn tại                | FIELD tồn tại bất biến               | Platform Admin |
| Thêm POSITION | POSITION chưa tồn tại trong FIELD | POSITION tồn tại bất biến dưới FIELD | Platform Admin |

Không có transition:

```text
ACTIVE → INACTIVE
INACTIVE → ACTIVE
EXISTING → DELETED
FIELD → POSITION
POSITION → FIELD
POSITION(Field A) → POSITION(Field B)
```

Location, EmploymentType, WorkMode và ExperienceLevel không có state transition quản trị trong V4.

Chỉ các transition được định nghĩa trong tài liệu này mới thuộc business contract của V4.

---

# 12. Authorization và ownership boundary

| Hành động                       | Actor được phép | Resource / Scope                | Điều kiện                                            |
| ------------------------------- | --------------- | ------------------------------- | ---------------------------------------------------- |
| Thêm Category FIELD             | Platform Admin  | Danh mục Category toàn nền tảng | FIELD hợp lệ và không trùng                          |
| Thêm Category POSITION          | Platform Admin  | Danh mục Category toàn nền tảng | FIELD cha hợp lệ và POSITION không trùng trong FIELD |
| Sửa Category                    | Không actor nào | Category                        | Bị cấm trong V4                                      |
| Xóa Category                    | Không actor nào | Category                        | Bị cấm trong V4                                      |
| Chuyển POSITION sang FIELD khác | Không actor nào | Category POSITION               | Bị cấm trong V4                                      |
| Thêm/sửa/xóa Location           | Không actor nào | Location                        | Location là tập cố định                              |
| Thêm/sửa/xóa EmploymentType     | Không actor nào | EmploymentType                  | EmploymentType là tập cố định                        |
| Thêm/sửa/xóa WorkMode           | Không actor nào | WorkMode                        | WorkMode là tập cố định                              |
| Thêm/sửa/xóa ExperienceLevel    | Không actor nào | ExperienceLevel                 | ExperienceLevel là tập cố định                       |

Company Manager không được tạo Category.

Recruiter không được tạo Category.

Candidate không được tạo Category.

Platform Admin thực hiện quyền ở scope toàn nền tảng, không dựa trên membership của bất kỳ Company nào.

---

# 13. Multi-tenant boundary

V4 không tạo catalog theo tenant.

Các dữ liệu:

```text
Category
Location
EmploymentType
WorkMode
ExperienceLevel
```

thuộc platform scope.

Mô hình nghiệp vụ:

```text
Platform
        ↓
Standard Data
        ↓
┌───────────────┬───────────────┬───────────────┐
Company A       Company B       Company C
```

Các Company sử dụng chung dữ liệu chuẩn.

Không tồn tại:

```text
Company A
└── Category A

Company B
└── Category B
```

Platform Admin không cần trở thành CompanyMember của một Company để quản trị Category.

V4 không bổ sung multi-tenant boundary mới cho User, Company hoặc CompanyMember.

---

# 14. Lifecycle invariants

Các invariant sau phải luôn đúng:

1. `Category`, `Location`, `EmploymentType`, `WorkMode` và `ExperienceLevel` là dữ liệu chuẩn cấp nền tảng.

2. Không dữ liệu chuẩn nào của V4 thuộc riêng một Company.

3. Category có đúng hai level: `FIELD` và `POSITION`.

4. `FIELD` không có Category cha.

5. `POSITION` bắt buộc thuộc đúng một `FIELD`.

6. `POSITION` không được làm parent của Category khác.

7. Không tồn tại Category level thứ ba.

8. FIELD phải unique trên toàn nền tảng.

9. POSITION phải unique trong FIELD của nó.

10. Cùng tên POSITION có thể tồn tại trong các FIELD khác nhau.

11. Chỉ Platform Admin được thêm Category.

12. Category sau khi tạo không được sửa.

13. Category sau khi tạo không được xóa.

14. Category sau khi tạo không được deactivate hoặc reactivate.

15. POSITION sau khi tạo không được chuyển sang FIELD khác.

16. Category không được tự phát sinh từ text do Company Manager, Recruiter hoặc Candidate nhập trong các nghiệp vụ sử dụng Category.

17. Location gồm đúng 63 tỉnh/thành theo canonical Vietnam location snapshot
    và special member `FOREIGN` trong phạm vi V4.

18. Remote không phải Location.

19. `REMOTE` chỉ thuộc WorkMode.

20. Location và WorkMode là hai khái niệm nghiệp vụ độc lập.

21. EmploymentType luôn thuộc tập:

```text
FULL_TIME
PART_TIME
INTERNSHIP
CONTRACT
TEMPORARY
FREELANCE
SEASONAL
APPRENTICESHIP
```

22. WorkMode luôn thuộc tập:

```text
ONSITE
HYBRID
REMOTE
```

23. ExperienceLevel luôn thuộc tập:

```text
NO_EXPERIENCE
UNDER_1_YEAR
ONE_TO_THREE_YEARS
THREE_TO_FIVE_YEARS
FIVE_TO_TEN_YEARS
OVER_TEN_YEARS
```

24. Location, EmploymentType, WorkMode và ExperienceLevel không có nghiệp vụ quản trị động trong V4.

25. ExperienceLevel là metadata mức kinh nghiệm và không đồng nhất với Work Experience chi tiết.

26. V4 không thay đổi lifecycle của User, Company hoặc CompanyMember.

27. V4 không tạo role quản lý danh mục mới cho CompanyMember.

28. Không Company Manager, Recruiter hoặc Candidate nào được quản trị Category cấp nền tảng.

---

# 15. Các quyết định chủ động defer

Các nội dung sau đã được xem xét nhưng chủ động không thuộc V4.

## 15.1. Job sử dụng dữ liệu chuẩn

Defer sang version Job:

* Job sử dụng FIELD hay POSITION;
* Job có bắt buộc Category hay không;
* Job có một hay nhiều Category;
* Job có một hay nhiều Location;
* Job có một hay nhiều EmploymentType;
* Job có một hay nhiều WorkMode;
* Job sử dụng ExperienceLevel như thế nào;
* các combination giữa Location và WorkMode trên Job.

## 15.2. CV sử dụng dữ liệu chuẩn

Defer sang version CV:

* CV sử dụng FIELD hay POSITION;
* Category có bắt buộc trên CV hay không;
* CV có một hay nhiều Category;
* Preferred Location;
* Preferred EmploymentType;
* Preferred WorkMode;
* ExperienceLevel của CV;
* cách Candidate xác định ExperienceLevel;
* quan hệ giữa ExperienceLevel và Work Experience chi tiết.

## 15.3. Search và matching

Không thuộc V4:

* Find Jobs;
* filter Job;
* Candidate Search;
* filter CV;
* matching Job và CV;
* ranking;
* scoring.

## 15.4. Thay đổi các tập giá trị cố định

V4 không định nghĩa workflow thay đổi:

* Location;
* EmploymentType;
* WorkMode;
* ExperienceLevel.

Nếu tương lai cần thay đổi các tập này, requirement đó phải được một version sau xác lập rõ.

## 15.5. Cách biểu diễn kỹ thuật

V4 không quyết định cách lưu trữ hoặc biểu diễn kỹ thuật cho:

* Category;
* Location;
* EmploymentType;
* WorkMode;
* ExperienceLevel.

Các quyết định đó thuộc Data Contract hoặc Engineering Contract tương ứng.

Không được sử dụng lựa chọn persistence để tự tạo thêm business behavior cho V4.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V4.

Các quyết định về persistence, representation, validation implementation hoặc architecture không phải business decision của Product Specification này.

---

# 17. Definition of Business Completion

V4 được coi là hoàn thành về mặt nghiệp vụ khi:

* `F01` — Platform Admin có thể thêm Category FIELD hợp lệ;
* `F02` — Platform Admin có thể thêm Category POSITION hợp lệ;
* `F03` — Location tuân thủ định nghĩa chuẩn đã chốt;
* `F04` — EmploymentType chỉ sử dụng tập giá trị cố định đã chốt;
* `F05` — WorkMode chỉ sử dụng tập giá trị cố định đã chốt;
* `F06` — ExperienceLevel chỉ sử dụng tập giá trị cố định đã chốt;
* toàn bộ `BR-xx` được đáp ứng;
* Category chỉ có cấu trúc `FIELD → POSITION`;
* Category uniqueness được giữ;
* Category sau khi tạo là bất biến;
* không tồn tại edit/delete/deactivate/reactivate Category ngoài ý muốn;
* authorization của Platform Admin được giữ;
* Company Manager, Recruiter và Candidate không thể tự tạo Category;
* tenant boundary được giữ;
* dữ liệu chuẩn không bị biến thành dữ liệu riêng theo Company;
* các tập giá trị cố định không bị biến thành catalog quản trị động;
* các chức năng đã defer không bị implementation ngoài ý muốn;
* không xuất hiện behavior ngoài boundary của V4.

Việc code chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu implementation chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là canonical business specification của V4.

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
* database query;
* MongoDB/Mongoose implementation;
* collection;
* schema;
* enum implementation;
* index;
* seed mechanism;
* persistence reference;
* transaction implementation;
* source-code structure;
* test framework.

Các quyết định đó thuộc các contract tương ứng:

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

Nếu implementation hoặc data design mâu thuẫn với tài liệu này, Product Specification là authority đối với business behavior, trừ khi Product Specification được con người cập nhật và phê duyệt lại.
