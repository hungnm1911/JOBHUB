# V17 — Rich Text Content Integration Data Model

> **File:** `docs/data/backend/versions/v17-rich-text-content-integration-data-model.md`
>
> **Vai trò:** Canonical Persistence / Data Contract
>
> **Ngôn ngữ:** Tiếng Việt
>
> **Product authority:** `docs/product/backend/versions/v17-rich-text-content-integration.md`

---

## 1. Mục đích

Tài liệu này định nghĩa persistence/data contract để hỗ trợ Backend V17 — Rich Text Content Integration.

V17 mở rộng khả năng lưu trữ nội dung có định dạng cho:

- Job Description — Full Formatting;
- Generated CV — Minimal Formatting;
- Company Description — Full Formatting.

Mục tiêu dữ liệu:

1. Duy trì hai biểu diễn HTML và plain text cho nội dung thuộc phạm vi Rich Text.
2. Giữ nguyên các trường plain text hiện hữu để duy trì compatibility với Search, AI Kit và những consumer khác.
3. Không thay đổi cấu trúc nghiệp vụ, ownership hoặc lifecycle của Job, Generated CV, Company, Application và JobInvitation.
4. Hỗ trợ dữ liệu legacy, snapshot và migration theo phạm vi Product V17.
5. Không yêu cầu LLM inference để chuyển đổi hoặc duy trì các biểu diễn nội dung.

Product Specification V17 là authority đối với business behavior.

Data Model V17 xác định các field, embedded documents, persistence transitions, constraint ownership, snapshot compatibility và persistence invariants cần thiết để đáp ứng Product V17.

Tài liệu này không định nghĩa API, giao diện hoặc cách tổ chức implementation.

---

## 2. Thay đổi so với version trước

| Entity / Collection | Trạng thái | Mô tả |
|---|---|---|
| `Job` / `jobs` | `UPDATED` | Bổ sung HTML Representation cho Job Description |
| `CandidateCV` | `UPDATED` | Bổ sung HTML Representation cho ba nhóm nội dung Generated CV |
| `Company` / `companies` | `UPDATED` | Bổ sung HTML Representation cho Company Description và nội dung review mới khi cần |
| `Application` / `applications` | `UPDATED` | Snapshot Generated CV mới có khả năng giữ nội dung HTML |
| `JobInvitation` / `jobinvitations` | `UPDATED` | Invited CV snapshot mới giữ HTML Generated CV tại Send theo V15; Application copy snapshot này khi Accept |
| Uploaded CV file | `UNCHANGED` | Tiếp tục sử dụng PDF theo contract hiện hành |
| AI Kit profiles và dữ liệu đầu vào AI | `UNCHANGED` | Tiếp tục sử dụng các trường plain text và cấu trúc hiện tại |

### 2.1. Entity mới

Không bổ sung entity hoặc collection mới.

Các biểu diễn HTML được lưu cùng resource nghiệp vụ hiện hữu.

### 2.2. Entity được mở rộng

- `Job`
- `CandidateCV`
- `Company`
- `Application`, thông qua embedded Generated CV snapshot.
- `JobInvitation`, thông qua embedded invited CV snapshot Generated CV hiện hữu.

### 2.3. Entity giữ nguyên nhưng được sử dụng

Các entity về User, CompanyMember, Uploaded CV và những reference liên quan tiếp tục có vai trò theo contract hiện hành.

V17 không thay đổi các relationship này.

---

## 3. Collection / Entity tổng thể

```text
jobs
candidatecvs
companies
applications
jobinvitations
```

| Entity | Responsibility trong V17 |
|---|---|
| `Job` | Lưu Job Description dưới dạng plain text và HTML |
| `CandidateCV` | Lưu nội dung Generated CV có cấu trúc, với HTML tùy chọn tại các trường được hỗ trợ |
| `Company` | Lưu Company Description, cùng nội dung được capture cho review theo lifecycle hiện hành |
| `Application` | Bảo toàn Generated CV snapshot và PDF tại thời điểm capture |
| `JobInvitation` | Bảo toàn invited CV snapshot và PDF tại Send theo V15; snapshot được copy vào Application khi Accept |

Các biểu diễn HTML không có lifecycle hoặc ownership độc lập với resource chứa chúng.

Không tạo collection riêng cho Rich Text, nội dung HTML hoặc lịch sử định dạng.

---

## 4. Quan hệ dữ liệu

V17 không bổ sung relationship mới.

Các quan hệ hiện hữu tiếp tục áp dụng:

```text
Company 1 ───── N Job

Candidate User 1 ───── N CandidateCV

CandidateCV 1 ───── N Application CV Snapshot
                     (source reference)

CandidateCV 1 ───── N JobInvitation Invited CV Snapshot
                     (source reference; copy vào Application khi Accept theo V15)

Company 1 ───── 0..1 Review Snapshot
                   (embedded theo lifecycle)
```

### 4.1. Company → Job

**Owner:** `Job`

**Reference:** `Job.companyId`

**Cardinality:** Một Company có thể sở hữu nhiều Job.

**Constraint:** Quyền truy cập và cập nhật Job tiếp tục được xác định theo quan hệ Company và các quy tắc hiện hành.

**Lifecycle:** HTML Representation đi theo lifecycle của Job.

### 4.2. Candidate → CandidateCV

**Owner:** `CandidateCV`

**Reference:** `CandidateCV.candidateUserId`

**Cardinality:** Một Candidate có thể sở hữu nhiều CV.

**Constraint:** Rich Text chỉ áp dụng cho Generated CV và những trường được Product V17 xác định.

**Lifecycle:** Các trường HTML đi theo Generated CV, không có trạng thái độc lập.

### 4.3. CandidateCV → Application CV Snapshot

**Owner:** `Application`

**Reference:** `submittedCvSnapshot.sourceCandidateCvId`

Application lưu bản sao nội dung CV theo contract snapshot hiện hữu.

Snapshot không phải live reference tới `CandidateCV.generatedContent`.

Việc cập nhật CandidateCV sau thời điểm capture không làm thay đổi snapshot đã tạo.

Với Application nguồn Job Invitation V15, `submittedCvSnapshot` được copy từ invited snapshot đã khóa tại Send, không capture lại CandidateCV. HTML Generated CV nếu có đi cùng nội dung được copy; snapshot lịch sử không bị viết lại.

### 4.4. CandidateCV → JobInvitation Invited CV Snapshot

**Owner:** `JobInvitation`

**Reference:** `invitedCvSnapshot.sourceCandidateCvId`

Snapshot tại Send giữ Generated CV content, gồm HTML nếu có, theo V15. Snapshot đã tạo immutable; khi Accept, Application dùng bản copy của snapshot này.

### 4.5. Company → Review Snapshot

**Owner:** `Company`

**Embedded document:** `Company.reviewSnapshot`

Review Snapshot tiếp tục được tạo và sử dụng theo Company Approval lifecycle hiện hữu.

V17 chỉ mở rộng khả năng biểu diễn Company Description trong snapshot mới, không bổ sung quan hệ hoặc quy trình review khác.

---

## 5. Job và CandidateCV

### 5.1. Job — Responsibility

`Job` tiếp tục là owner của Job Description.

V17 bổ sung biểu diễn HTML cho nội dung mô tả, trong khi trường plain text hiện hữu tiếp tục phục vụ các consumer nghiệp vụ.

### 5.2. Job — Fields

| Field | Type | Required | Default | Constraint | Ý nghĩa |
|---|---|---|---|---|---|
| `jobDescription` | `String \| null` | Theo contract hiện hành | `null` | Plain text; giữ validation Job hiện hữu | Nội dung dùng cho Search, AI và consumer cũ |
| `jobDescriptionHtml` | `String \| null` | NO | `null` | Full Formatting, HTML hợp lệ thuộc phạm vi V17 | Nội dung có định dạng |

Các trường Job khác giữ nguyên.

**Representation contract:**

```text
Job
├── jobDescription
│   └── Plain text
└── jobDescriptionHtml
    └── Full Rich Text HTML | null
```

Quy tắc dữ liệu:

- `jobDescriptionHtml = null` hoặc vắng mặt không làm `jobDescription` mất tính hợp lệ.
- Khi nội dung được cập nhật bằng HTML, plain text tương ứng được xác định từ nội dung HTML đã được chấp nhận.
- HTML không được chứa định dạng vượt khỏi Full Formatting được hỗ trợ.
- HTML không trở thành nguồn tìm kiếm hoặc embedding độc lập.

### 5.3. Job — Enum

Không bổ sung enum mới.

Job status, employment type và các enum khác tiếp tục theo contract hiện hành.

Full Formatting là chính sách biểu diễn nội dung, không phải trạng thái nghiệp vụ của Job.

### 5.4. Job — Indexes

Không bổ sung index cho `jobDescriptionHtml`.

Các index Job Search, discovery, lifecycle và ownership hiện hữu được giữ nguyên.

`jobDescription` tiếp tục là nguồn văn bản cho những điều kiện tìm kiếm đang sử dụng trường này.

### 5.5. Job — Embedded documents

Không bổ sung embedded document mới cho Rich Text.

Hai biểu diễn nội dung là các field của cùng Job document.

### 5.6. Job — Reference rules

Không thay đổi reference rules của Job.

`companyId` và các reference phục vụ quản lý Job tiếp tục theo contract đã phê duyệt.

---

### 5.7. CandidateCV — Responsibility

`CandidateCV` tiếp tục lưu Generated CV dưới cấu trúc `generatedContent`.

V17 chỉ mở rộng một số field text bằng biểu diễn HTML tùy chọn.

Không tạo một HTML document đại diện cho toàn bộ Generated CV.

### 5.8. CandidateCV — Fields

Các field được mở rộng nằm trong `generatedContent`.

| Field | Type | Required | Default | Constraint |
|---|---|---|---|---|
| `professionalSummary` | `String \| null` | Theo contract V07 | `null` | Plain text hiện hữu |
| `professionalSummaryHtml` | `String \| null` | NO | `null` | Minimal Formatting |
| `workExperiences[].description` | `String \| null` | Theo contract V07 | `null` | Plain text hiện hữu |
| `workExperiences[].descriptionHtml` | `String \| null` | NO | `null` | Minimal Formatting |
| `projects[].description` | `String \| null` | Theo contract V07 | `null` | Plain text hiện hữu |
| `projects[].descriptionHtml` | `String \| null` | NO | `null` | Minimal Formatting |
| `workExperiences[].achievements` | `String[]` | Theo contract V07 | `[]` | Không thay đổi |

Các field HTML là tùy chọn và chỉ áp dụng khi `sourceType = GENERATED`.

Uploaded CV không sử dụng `generatedContent`.

### 5.9. CandidateCV — Embedded documents

V17 mở rộng các embedded documents hiện hữu:

```text
CandidateCV
└── generatedContent
    ├── professionalSummary
    ├── professionalSummaryHtml
    │
    ├── workExperiences[]
    │   ├── companyName
    │   ├── position
    │   ├── description
    │   ├── descriptionHtml
    │   └── achievements[]
    │
    ├── projects[]
    │   ├── name
    │   ├── description
    │   └── descriptionHtml
    │
    └── Other existing fields
```

**Owner:** `CandidateCV`

**Lifecycle:** Theo Generated CV hiện hữu.

HTML của Work Experience hoặc Project nằm trực tiếp trong embedded item tương ứng.

Không tạo mảng HTML song song theo vị trí phần tử.

Các embedded documents vẫn không tồn tại độc lập với CandidateCV.

### 5.10. CandidateCV — Enum

Không bổ sung enum mới.

Các enum `sourceType`, CV status, hidden sections và những giá trị liên quan giữ nguyên.

Minimal Formatting không phải một giá trị lifecycle hoặc `sourceType` mới.

### 5.11. CandidateCV — Indexes

Không bổ sung index cho các field HTML.

Các index phục vụ ownership, Default CV, danh sách CV và các chức năng hiện hữu tiếp tục giữ nguyên.

### 5.12. CandidateCV — Reference rules

Không thay đổi `candidateUserId` hoặc các reference liên quan.

Việc có HTML không làm thay đổi ownership, Default CV, archive hoặc những quy tắc lifecycle khác.

---

## 6. Company, Application và JobInvitation

### 6.1. Company — Responsibility

`Company` tiếp tục là owner của Company Description.

V17 bổ sung khả năng lưu HTML Full Formatting, đồng thời bảo toàn trường plain text hiện hữu.

### 6.2. Company — Fields

| Field | Type | Required | Default | Constraint | Ý nghĩa |
|---|---|---|---|---|---|
| `description` | `String \| null` | Theo contract hiện hành | `null` | Plain text | Company Description cho consumer cũ |
| `descriptionHtml` | `String \| null` | NO | `null` | Full Formatting | Company Description có định dạng |

Các field Company khác giữ nguyên.

### 6.3. Company — Review Snapshot

Company hiện có embedded document `reviewSnapshot`, trong đó có `description`.

Để nội dung Company được capture sau khi tích hợp V17 có thể giữ định dạng, mở rộng snapshot bằng trường tùy chọn:

| Field | Type | Required | Default | Ý nghĩa |
|---|---|---|---|---|
| `reviewSnapshot.description` | `String \| null` | Theo contract hiện hành | `null` | Plain text được capture |
| `reviewSnapshot.descriptionHtml` | `String \| null` | NO | `null` | HTML của Description được capture, nếu có |

Quy tắc:

- Snapshot mới phản ánh biểu diễn nội dung tại thời điểm capture.
- Snapshot không có HTML tiếp tục được đọc bằng plain text.
- Các snapshot lịch sử không bị viết lại chỉ để thêm định dạng.
- Company Approval lifecycle không thay đổi.

Không mở rộng các field khác của Company Review Snapshot trong V17.

### 6.4. Company — Enum và Indexes

Không bổ sung enum hoặc index mới.

Approval status, operational status, uniqueness và các index hiện hữu giữ nguyên.

### 6.5. Company — Reference rules

Không thay đổi các reference và quan hệ CompanyMember/User hiện hữu.

HTML của Company Description không làm thay đổi tenant ownership.

---

### 6.6. Application — Responsibility

`Application` tiếp tục sở hữu `submittedCvSnapshot` theo contract V09.

V17 cho phép snapshot Generated CV được tạo mới lưu lại các HTML field đã có trong `generatedContent`.

### 6.7. Application — Fields

Không bổ sung field HTML độc lập ở Application root.

`submittedCvSnapshot.generatedContent` tiếp tục sử dụng cấu trúc Generated CV tương ứng.

Với snapshot Generated CV mới, cấu trúc này có thể chứa:

- `professionalSummaryHtml`;
- `workExperiences[].descriptionHtml`;
- `projects[].descriptionHtml`.

Các trường plain text hiện hữu tiếp tục được copy.

`submittedCvSnapshot.pdfFile` và `capturedAt` giữ contract hiện tại.

### 6.8. Application — Embedded documents

```text
Application
└── submittedCvSnapshot
    ├── sourceCandidateCvId
    ├── name
    ├── sourceType
    ├── generatedContent
    │   ├── Plain text fields
    │   └── Optional Minimal HTML fields
    ├── pdfFile
    └── capturedAt
```

Đối với Uploaded CV, snapshot tiếp tục lưu dữ liệu PDF theo contract hiện hữu.

Không bổ sung HTML cho Uploaded CV snapshot.

### 6.9. Application — Enum, Indexes và References

Không bổ sung enum hoặc index mới.

Các Application status, assignment, ownership và reference rules tiếp tục theo contract V09 và các version liên quan.

### 6.10. JobInvitation — Invited CV Snapshot

`JobInvitation.invitedCvSnapshot.generatedContent` sử dụng cấu trúc Generated CV snapshot hiện hữu theo V15. Snapshot mới tại Send giữ các HTML field tùy chọn nêu ở §6.7 nếu CV nguồn có HTML; `pdfFile` và `capturedAt` giữ contract V15.

Không bổ sung field ở JobInvitation root, snapshot type, quyền truy cập hoặc lifecycle mới. Snapshot đã tạo vẫn immutable và Application tiếp tục copy snapshot đó khi Accept.

---

# 7. State Matrix

V17 không bổ sung state dimension nghiệp vụ mới.

HTML Representation không tạo ra trạng thái Job, CV, Company hoặc Application riêng.

Các trạng thái lifecycle và state matrix đã được phê duyệt tiếp tục có hiệu lực.

Version này không cần State Matrix riêng.

---

# 8. Persistence Transitions

Phần này mô tả các thay đổi dữ liệu khi một thao tác nghiệp vụ hợp lệ xảy ra. Không bổ sung business transition mới.

## 8.1. Tạo hoặc cập nhật nội dung bằng HTML

**Business source:**

- `F01`, `F02`, `F06`
- `BR-01`, `BR-02`, `BR-03`

### Trước

```text
plainText = existing value | null
html = existing value | null
```

### Sau

```text
html = accepted sanitized HTML | null
plainText = text representation of accepted HTML
```

Hai biểu diễn phản ánh cùng nội dung.

Việc có HTML không vượt qua validation hoặc lifecycle hiện hành của resource.

### Entity bị thay đổi

Tùy nội dung được cập nhật:

- `Job`;
- `CandidateCV`;
- `Company`.

### Entity không thay đổi

Những resource không thuộc thao tác và các historical snapshot đã tạo.

### Invariant

Không tồn tại hai biểu diễn cùng được coi là hiện hành nhưng thể hiện hai nội dung khác nhau do một lần cập nhật Rich Text.

---

## 8.2. Cập nhật nội dung bằng plain text

**Business source:**

- `F01`, `F02`, `F06`
- `BR-01`, `BR-02`

### Trước

```text
plainText = existing value
html = existing value | null
```

### Sau

```text
plainText = accepted plain text
html = null
```

Quy tắc này chỉ áp dụng đối với field được cập nhật bằng plain text.

Không xóa HTML của những field không thuộc thao tác cập nhật.

Những quy tắc validation hiện hữu tiếp tục áp dụng.

---

## 8.3. Cập nhật một phần nội dung

**Business source:**

- `BR-02`

Nếu một field không thuộc phạm vi thay đổi của thao tác cập nhật, cả biểu diễn HTML và plain text của field đó được giữ nguyên.

Đối với Generated CV, quy tắc này áp dụng tại trường nội dung của embedded item tương ứng, theo semantics cập nhật đã có của CV.

Việc thay đổi một Work Experience hoặc Project không làm mất biểu diễn HTML của item khác ngoài phạm vi cập nhật.

---

## 8.4. Capture Generated CV Snapshot

**Business source:**

- `F04`
- `BR-07`

### Trước

Generated CV chứa nội dung plain text và có thể có các HTML field được V17 hỗ trợ.

### Sau

Application snapshot mới bảo toàn:

- Generated CV content tại thời điểm capture;
- HTML Representation tương ứng nếu có;
- PDF snapshot theo contract hiện hữu.

Với Job Invitation, invited CV snapshot mới tại Send bảo toàn cùng nội dung Generated CV và HTML nếu có. Khi Accept, Application copy invited snapshot đã khóa theo V15, không recapture CV nguồn.

PDF của Generated CV phản ánh Minimal Formatting trong bố cục Harvard.

Snapshot đã tạo không đồng bộ ngược với CandidateCV khi CV nguồn thay đổi.

---

## 8.5. Capture Company Review Snapshot

**Business source:**

- `F06`
- `BR-02`, `BR-09`

Khi Company Review Snapshot được tạo theo quy trình hiện hữu, bản snapshot mới có thể mang cả `description` và `descriptionHtml` nếu nội dung nguồn có HTML.

Không thay đổi thời điểm capture, điều kiện review hoặc lifecycle đã được định nghĩa trước V17.

---

## 8.6. Legacy Migration

**Business source:**

- `F05`
- `BR-10`

### Trước

```text
plainText = existing value
html = null | absent
```

### Sau, đối với bản ghi đủ điều kiện

```text
plainText = unchanged
html = compatible representation | null
```

Migration:

- Không thay đổi nội dung plain text nghiệp vụ gốc.
- Không làm thay đổi lifecycle hoặc ownership.
- Không yêu cầu mọi bản ghi phải được backfill.
- Không viết lại historical snapshot.
- Không tự chuyển đổi nội dung Job thuộc phạm vi bất biến.
- Có khả năng xem trước tác động và thực hiện lại an toàn.

Các bản ghi không được chuyển đổi tiếp tục giữ nguyên.

---

# 9. Transaction / Atomicity Requirements

V17 yêu cầu tính nhất quán của hai biểu diễn nội dung, nhưng không bổ sung workflow cross-document mới.

### 9.1. Đồng bộ trong cùng document

Khi một nội dung Rich Text được cập nhật, những field HTML và plain text tương ứng phải trở thành dữ liệu hiện hành cùng nhau.

Không được có persisted state sau thao tác thành công trong đó:

```text
HTML = nội dung mới
Plain text = nội dung cũ
```

Yêu cầu này áp dụng ở phạm vi document chứa nội dung.

Không cần transaction cross-document chỉ vì một trường được bổ sung HTML.

### 9.2. Snapshot

Việc capture Application snapshot và PDF tiếp tục tuân theo các yêu cầu nhất quán đã có.

V17 không bổ sung transaction hoặc thay đổi thứ tự nghiệp vụ của quá trình apply/snapshot.

### 9.3. Migration

Migration phải tránh trạng thái dữ liệu không nhất quán đối với từng bản ghi được chuyển đổi.

Không yêu cầu một transaction bao trùm toàn bộ migration.

**Kết luận:** V17 không bổ sung transaction cross-document mới.

---

# 10. Constraint Ownership

## 10.1. Database / Schema bảo vệ

| Constraint | Owner | Lý do |
|---|---|---|
| Các HTML field có kiểu `String \| null` | Schema | Structural validity |
| HTML field nằm đúng Job/CV/Company structure | Schema | Field structure |
| Các field legacy giữ kiểu dữ liệu hiện hữu | Schema | Backward compatibility |
| Generated CV vẫn tuân theo source-type structure hiện hành | Schema/Database | Local document invariant |
| Application snapshot giữ structure đã phê duyệt | Schema/Database | Snapshot structure |
| Các enum và reference type hiện hữu | Schema/Database | Contract trước V17 |

V17 không bổ sung database constraint mới cho định dạng font, màu, heading hoặc danh sách.

## 10.2. Service bảo vệ

| Constraint | Owner | Lý do |
|---|---|---|
| HTML thuộc tập định dạng được hỗ trợ | Service | Cần kiểm tra và chuẩn hóa nội dung |
| Plain text tương ứng với HTML được chấp nhận | Service | Cần chuyển đổi nội dung |
| Nội dung Rich Text rỗng được đánh giá theo validation hiện hành | Service | Cần phân biệt markup và nội dung thực |
| Client chỉ cập nhật plain text thì HTML cũ của field đó không còn là biểu diễn hiện hành | Service | Representation consistency |
| Partial update giữ nguyên field không được sửa | Service | Update semantics |
| Job lifecycle và Company ownership | Service | Business authorization |
| Generated CV ownership, completeness và lifecycle | Service | Business authorization/validation |
| Snapshot bảo toàn nội dung tại thời điểm capture | Service | Historical consistency |
| Migration chỉ tác động dữ liệu đủ điều kiện | Service/Migration boundary | Lifecycle và historical protection |

### 10.3. Phạm vi HTML hợp lệ

HTML Representation chỉ được duy trì với những thành phần định dạng thuộc preset tương ứng:

- Full: Job và Company;
- Minimal: Generated CV.

Các markup, attribute, style hoặc URL ngoài phạm vi được hỗ trợ không trở thành định dạng có thẩm quyền trong persisted HTML.

Nội dung sau chuẩn hóa là cơ sở để xác định plain text tương ứng.

V17 không bổ sung quy tắc từ chối nghiệp vụ mới chỉ vì một nội dung chứa markup không được hỗ trợ. Các yêu cầu bắt buộc về nội dung vẫn tuân theo validation của resource tương ứng.

### 10.4. Empty content

HTML không có nội dung văn bản thực không được xem là nội dung đầy đủ chỉ vì tồn tại thẻ markup.

Nội dung rỗng được biểu diễn theo quy ước null/empty và validation phù hợp của từng field.

V17 không làm thay đổi điều kiện bắt buộc hoặc completeness đã được Product phê duyệt.

### 10.5. Giới hạn dữ liệu

HTML Representation phải tuân theo các giới hạn tiếp nhận và lưu trữ phù hợp với resource hiện hữu.

V17 không tự tạo ngưỡng độ dài nghiệp vụ mới cho Job, CV hoặc Company.

Giới hạn kỹ thuật cụ thể phải tương thích với phạm vi Full/Minimal và các contract validation liên quan.

---

# 11. Token / TTL Lifecycle

V17 không bổ sung token, session, temporary credential hoặc TTL persistence mới.

Các cơ chế token và lưu trữ tạm của những version khác không thay đổi.

---

# 12. Multi-tenant Data Boundary

V17 giữ nguyên multi-tenant data boundary hiện hữu.

### 12.1. Canonical tenant key

Đối với Job:

```text
Job.companyId
```

Đối với Company Description, resource thuộc chính Company đang được thao tác.

Generated CV tiếp tục thuộc Candidate thông qua:

```text
CandidateCV.candidateUserId
```

### 12.2. Resource ownership

| Resource | Owner | Cách xác định |
|---|---|---|
| Job Description HTML | Company của Job | `Job.companyId` |
| Company Description HTML | Company | Company resource hiện hữu |
| Generated CV HTML | Candidate | `CandidateCV.candidateUserId` |
| Application CV Snapshot | Application | Ownership và visibility theo contract Application |
| Job Invitation Invited CV Snapshot | JobInvitation | Ownership và visibility theo contract V15 |

### 12.3. Backend tenant resolution

Quyền truy cập tiếp tục dựa trên authenticated identity và các quan hệ CompanyMember/Company hợp lệ đã được hệ thống quản lý.

HTML Representation không chứa hoặc tạo authorization source mới.

Không phát sinh quyền truy cập cross-tenant khi bổ sung HTML.

---

# 13. Snapshot / Historical Data

## 13.1. Application — Submitted CV Snapshot

Application snapshot được capture từ CandidateCV theo lifecycle hiện hữu hoặc được copy từ invited snapshot đã khóa khi Accept theo V15.

### Snapshot Generated CV mới

Bảng dưới mô tả capture trực tiếp từ CandidateCV; Application nguồn Job Invitation sử dụng snapshot theo §13.2.

| Field | Source | Ý nghĩa |
|---|---|---|
| `generatedContent.professionalSummary` | CandidateCV | Plain text summary |
| `generatedContent.professionalSummaryHtml` | CandidateCV | Optional Minimal HTML |
| `generatedContent.workExperiences[]` | CandidateCV | Work Experience content, gồm HTML nếu có |
| `generatedContent.projects[]` | CandidateCV | Project content, gồm HTML nếu có |
| `pdfFile` | Generated snapshot PDF | PDF tại thời điểm capture |
| `capturedAt` | Capture lifecycle | Thời điểm capture |

Các field khác của `generatedContent` tiếp tục được copy theo contract hiện hữu.

### Lifecycle

- Snapshot là bản sao tại thời điểm capture.
- Không cập nhật snapshot khi CandidateCV thay đổi sau đó.
- Không bổ sung HTML vào snapshot lịch sử đã tồn tại.
- Không thay đổi quyền xem hoặc thời hạn tồn tại của snapshot.
- Uploaded CV snapshot không thay đổi cấu trúc.

## 13.2. JobInvitation — Invited CV Snapshot

Theo V15, invited snapshot mới được capture tại successful Send và immutable sau đó. Nếu Generated CV nguồn có HTML thuộc phạm vi V17, snapshot giữ HTML cùng plain text và PDF tại thời điểm Send.

Với Application nguồn Job Invitation, snapshot tại Accept là bản copy của `JobInvitation.invitedCvSnapshot` đã khóa. Không recapture CV nguồn hoặc bổ sung HTML vào invited snapshot hay Application snapshot lịch sử.

## 13.3. Company — Review Snapshot

Review Snapshot tiếp tục được tạo theo Company Approval lifecycle.

Snapshot mới có thể lưu `descriptionHtml` cùng `description` nếu nội dung nguồn có HTML.

Các snapshot đã tồn tại trước V17 tiếp tục hợp lệ.

V17 không thay đổi approval status, thời điểm submit/review hoặc các quy tắc snapshot của version trước.

## 13.4. Job Content lịch sử

Job Description thuộc lifecycle và các ràng buộc nội dung đã được V05 định nghĩa.

V17 không bổ sung một Job snapshot mới.

Việc migration hoặc hỗ trợ HTML không tự cho phép cập nhật Job content đã bị khóa.

---

# 14. Explicitly Excluded Persistence

V17 chủ động không bổ sung:

- Rich Text collection độc lập.
- HTML document đại diện cho toàn bộ Generated CV.
- HTML cho Uploaded CV.
- HTML cho `achievements[]`.
- Mảng HTML song song với `workExperiences[]` hoặc `projects[]`.
- HTML cho các Generated CV field ngoài phạm vi F02.
- Embedding hoặc vector index riêng cho HTML.
- Rich Text status/enum riêng.
- History hoặc audit collection chỉ để theo dõi định dạng.
- Snapshot mới ngoài các snapshot hiện hữu cần mở rộng.
- Speculative metadata, version field hoặc migration status field.
- Token hoặc TTL mới.

Không thêm field, collection hoặc index chỉ để phục vụ nhu cầu tương lai chưa được Product V17 phê duyệt.

---

# 15. Compatibility với version trước

## 15.1. Invariant phải giữ

- Job lifecycle và Job content restrictions.
- Job Search, keyword filtering và relevance ranking.
- AI normalization, matching, evaluation, recommendation và optimization theo contract hiện hữu.
- Vector embedding tiếp tục sử dụng nội dung ngữ nghĩa thay vì HTML markup.
- Generated CV completeness và lifecycle.
- Harvard CV structure.
- Company Approval và ownership.
- Application snapshot historical truth.
- Job Invitation invited snapshot historical truth và bản copy sang Application khi Accept.

## 15.2. Persistence behavior phải giữ

Các field plain text hiện hữu tiếp tục tồn tại và được sử dụng theo các contract trước V17.

Legacy records không có HTML vẫn hợp lệ.

Những bản ghi lịch sử không bị buộc phải chuyển đổi trước khi được đọc hoặc sử dụng.

**C04 — việc cần kiểm tra trong slice Generated CV:** projection đầu vào AI Kit hiện hữu phải tiếp tục chỉ chuyển plain text và cấu trúc AI đã phê duyệt khi Generated CV có thêm HTML. Đây là implementation gap theo Product V17 BR-04, không bổ sung data rule hoặc AI schema mới.

Không thay đổi Job Search indexes hoặc dữ liệu plain text cũ chỉ vì bổ sung HTML.

## 15.3. Thay đổi được phép

- Bổ sung HTML field tùy chọn cho nội dung được Product V17 cho phép.
- Duy trì plain text tương ứng khi cập nhật bằng HTML.
- Bổ sung HTML vào snapshot được tạo mới trong phạm vi V17.
- Backfill HTML cho bản ghi legacy đủ điều kiện mà không làm thay đổi plain text gốc.
- Sử dụng HTML để hiển thị và tạo Harvard PDF có định dạng.

## 15.4. Thay đổi không được phép

- Thay thế `jobDescription` bằng HTML.
- Thay thế nội dung plain text Generated CV bằng markup.
- Đưa HTML tags/styles trực tiếp vào AI inputs hoặc embedding text.
- Viết lại snapshot lịch sử.
- Thay đổi nội dung Job bị khóa.
- Tự diễn giải một chuỗi plain text cũ thành HTML chỉ dựa trên ký tự trong chuỗi.
- Thay đổi validation nghiệp vụ hoặc lifecycle ngoài phạm vi Product V17.

---

# 16. Persistence Invariants

Các invariant sau phải luôn đúng ở persisted state:

1. HTML Representation là tùy chọn; plain text hiện hữu tiếp tục được hỗ trợ.
2. Sau một lần ghi Rich Text thành công, HTML và plain text của field được cập nhật phải tương ứng về nội dung.
3. Khi một field được cập nhật chỉ bằng plain text, HTML cũ không được tiếp tục đại diện cho nội dung mới.
4. Field không thuộc phạm vi cập nhật không bị mất HTML ngoài ý muốn.
5. Job Search tiếp tục sử dụng `jobDescription` plain text.
6. AI Kit và Vector Search tiếp tục sử dụng dữ liệu nguồn theo contract cũ, không nhận markup mới.
7. Generated CV giữ cấu trúc `generatedContent`; HTML chỉ tồn tại ở các field được hỗ trợ.
8. Generated CV completeness không được thỏa mãn chỉ nhờ markup rỗng.
9. Snapshot mới bảo toàn nội dung tại thời điểm capture; snapshot lịch sử không bị thay đổi.
10. Company Description không tạo ownership hoặc approval state mới.
11. Migration không tự ý thay đổi plain text nghiệp vụ gốc, lifecycle hoặc historical truth.
12. Nội dung có HTML không làm thay đổi quyền truy cập resource.

**Enforcement ownership:**

- Schema/Database: field types, embedded structure, các invariant cục bộ đã có.
- Service: content consistency, validation, authorization, lifecycle và snapshot.
- Migration boundary: điều kiện chuyển đổi và bảo toàn dữ liệu gốc.
- Các cơ chế atomicity hiện hữu: bảo vệ dữ liệu trong những workflow đã yêu cầu.

---

# 17. Definition of Data Completion

Data Contract V17 được coi là đáp ứng Product V17 khi:

- `Job` có khả năng lưu HTML Full đồng thời giữ plain text cũ.
- `CandidateCV.generatedContent` có HTML Minimal tại đúng các field được phê duyệt.
- `Company` có khả năng lưu HTML Full, bao gồm dữ liệu cần thiết tại Company Review Snapshot mới.
- `Application.submittedCvSnapshot` có thể bảo toàn HTML của Generated CV mới.
- Invited CV snapshot mới tại Job Invitation Send bảo toàn HTML Generated CV nếu có, và Application giữ nguyên nội dung đó khi Accept theo V15.
- Legacy records không có HTML tiếp tục hợp lệ.
- Các biểu diễn HTML/plain text được duy trì nhất quán khi tạo hoặc cập nhật.
- Các quyền và lifecycle hiện hữu tiếp tục được bảo toàn.
- Không có index, collection, enum hoặc state mới ngoài requirement.
- Không có transaction cross-document mới không cần thiết.
- Job Search và AI consumers tiếp tục sử dụng dữ liệu plain text theo contract hiện hữu.
- Generated CV completeness được đánh giá trên nội dung thực, không dựa vào HTML markup.
- Harvard PDF có thể sử dụng Minimal Formatting mà không thay đổi cấu trúc Generated CV.
- Migration có khả năng xem trước tác động, thực hiện lại an toàn và không phá historical truth.
- Snapshot lịch sử và Job content bị khóa không bị viết lại.
- Constraint ownership giữa schema/database và service rõ ràng.
- Toàn bộ persistence invariants được giữ.

Data Completion không đồng nghĩa với việc schema đã được implement.

Nó có nghĩa persistence contract đã đủ rõ để implementation không phải tự đưa ra quyết định về cấu trúc dữ liệu hoặc business behavior.

---

# 18. Implementation Boundary

Tài liệu này là canonical persistence/data contract của Backend V17.

Tài liệu trả lời:

```text
WHAT MUST EXIST / PERSIST
TO SUPPORT PRODUCT V17
```

Tài liệu được phép xác định:

- Entities/collections;
- field types và optionality;
- embedded documents;
- relationships và references;
- ownership;
- indexes;
- persistence transitions;
- atomicity requirements;
- historical snapshots;
- compatibility;
- persistence invariants;
- constraint ownership.

Tài liệu không định nghĩa:

- REST endpoints;
- HTTP methods/status codes;
- request/response payload cụ thể;
- controllers hoặc services;
- framework hoặc thư viện chuyển đổi HTML;
- MongoDB queries;
- Mongoose methods;
- frontend flows;
- PDF renderer implementation;
- migration scripts hoặc execution commands;
- test framework.

Authority:

```text
Product Specification V17
        |
        | WHAT MUST HAPPEN
        v
Data Contract V17
        |
        | WHAT MUST EXIST / PERSIST
        v
Engineering Contracts
        |
        | HOW THE SYSTEM IS STRUCTURED
        v
Implementation
        |
        | ACTUAL CODE
        v
Tests
```

Nếu implementation hoặc persistence design yêu cầu thay đổi business behavior chưa được Product V17 phê duyệt, vấn đề phải được đưa trở lại Product layer để quyết định.

Các Product/Data Contract trước V17 tiếp tục giữ hiệu lực đối với những nội dung không được V17 mở rộng rõ ràng.
