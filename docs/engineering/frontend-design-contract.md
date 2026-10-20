# JOBHUB Design Contract v1

**Trạng thái:** APPROVED BASELINE — được người dùng phê duyệt ngày 2026-10-21.

## 1. Phạm vi và authority

Đây là canonical contract về thiết kế giao diện frontend JOBHUB, hợp nhất bản
nháp v1 và các bổ sung đã duyệt. Baseline áp dụng cho Authentication, Company
Onboarding/Preview/Submitted và Platform Admin Registration List/Detail; không
khẳng định source hiện tại đã tuân thủ hoặc đã được kiểm chứng bằng browser.

- **[Chuẩn]:** quy tắc thiết kế đã được duyệt, bắt buộc trong phạm vi thay đổi được giao.
- **[Đo]:** giá trị khởi điểm hoặc lựa chọn cần kiểm chứng bằng browser trước khi cố định; không phải token đã chốt.
- **[Ngoài scope]:** vấn đề Product/API hoặc quyết định riêng; không được tự giải quyết trong một design delta.

**[Chuẩn]** Giữ React + Tailwind CSS v4 + shadcn/ui và brand JOBHUB. GitHub
Primer Product UI là design reference, không phải implementation stack; không
chuyển sang Primer React hoặc sao chép toàn bộ giao diện GitHub.

Authority theo từng concern:

- [Backend Product Specifications](../product/backend/versions/) quyết định business behavior của các frontend surfaces trong phạm vi này.
- [Backend Data Contracts](../data/backend/versions/) quyết định persistence; backend implementation là API contract hiện tại.
- [Architecture](architecture.md), [Frontend Conventions](frontend-conventions.md) và [Frontend Sources of Truth](frontend-source-of-truth.md) quyết định architecture, ownership và dependency boundaries.
- Tài liệu này quyết định visual design; [Project Status](../project-status/index.md) ghi implementation/verification evidence.

**[Chuẩn]** Không dùng thiết kế để đổi yêu cầu nghiệp vụ, field semantics,
authorization, API hoặc state transitions. Nếu các authority xung đột, báo cáo
trước khi sửa behavior. Baseline được duyệt không tự cấp quyền triển khai toàn
bộ frontend; Company Preview pilot chờ yêu cầu triển khai riêng.

## 2. Design principles và anti-patterns

**[Chuẩn]**

1. **Tác vụ dẫn dắt giao diện:** title, dữ liệu cần đọc và next action nổi bật hơn nội dung giới thiệu.
2. **Hierarchy trước decoration:** ưu tiên thứ tự, spacing, typography và weight; màu bổ trợ ý nghĩa.
3. **Density theo công việc:** Auth/Onboarding dễ nhập liệu; Admin dễ quét, so sánh và thao tác.
4. **Brand có chủ đích:** giữ xanh/navy, logo, Lucide và giọng JOBHUB; không phủ brand lên mọi vùng dữ liệu.
5. **Một ngôn ngữ thiết kế:** cùng vai trò thông tin/tương tác dùng cùng treatment và canonical owner.
6. **Trình bày trung thực:** không biến dữ liệu chưa biết thành trạng thái chắc chắn hoặc đơn giản hóa sai nghĩa nghiệp vụ.

**[Chuẩn]** Tránh card nesting chỉ để nhóm nội dung; hero marketing lớn trước
form trên mobile; gradient/shadow/pill/icon mặc định; màu đỏ cho mọi trạng thái
chưa hoàn thành; thu nhỏ chữ hoặc cắt định danh để ép layout; và primitive
system song song. Nội dung thường không cần đồng thời nền, border và shadow.

Các nguyên tắc tập trung và responsive tham khảo [Primer Layout](https://primer.style/product/getting-started/foundations/layout/).

## 3. Design tokens

Các role dưới đây không mặc nhiên yêu cầu tạo CSS variables mới.

| Nhóm | [Chuẩn] | [Đo] |
| --- | --- | --- |
| Color | Canvas, surface, muted surface; text chính/phụ; border, focus; brand/action; information, success, warning, danger. Tái sử dụng semantic tokens | OKLCH, opacity, foreground/background pair và mức nổi bật navy |
| Typography | Role: page title, section title, body, label, caption. Dùng rem, line-height nhất quán; sentence case, văn bản dài căn trái | Font delivery: Inter hay system font; size/line-height/weight bên dưới |
| Spacing | Lưới cơ sở 4px; cùng quan hệ nội dung dùng cùng khoảng cách | Field gap 16px; section gap 24–32px; page gutter 16–32px |
| Radius | Ít cấp, phân biệt control/surface; pill chỉ cho nhãn phù hợp | Control 6px; surface 8–12px |
| Elevation | Border/nền/spacing cho nội dung thường; shadow diễn đạt lớp nổi | Shadow hiện có nào cần giữ hoặc giảm |

Thang typography khởi điểm **[Đo]**, px tương đương tại root 16px; chưa cố định:

| Role | Size / line-height | Weight |
| --- | --- | --- |
| Page title | 24 / 32 | 600 |
| Section title | 16 / 24 | 600 |
| Body, control, label | 14 / 20 | 400–500 |
| Văn bản đọc dài | 16 / 24 | 400 |
| Caption, metadata | 12 / 16 | 400–500 |

**[Chuẩn]** Không dùng caption cho dữ liệu chính/hướng dẫn quyết định hoặc 11px
làm mặc định. Heading semantics độc lập với kích thước hiển thị. Typography
tham khảo [Primer Typography](https://primer.style/product/getting-started/foundations/typography/);
color roles tham khảo [Primer Color usage](https://primer.style/product/getting-started/foundations/color-usage/).

## 4. Concrete UI decision rules

**[Chuẩn]** Tên pattern là lựa chọn presentation/semantics, không phải yêu cầu
cài hoặc tạo component cùng tên.

| Pattern | Khi dùng | Anti-pattern |
| --- | --- | --- |
| Section | Nhóm nội dung theo chủ đề trong cùng tác vụ, có heading. Mặc định cho pháp lý, liên hệ, giới thiệu, hình ảnh | Mỗi section đều có nền, border, shadow dù không độc lập |
| Card | Một entity, lựa chọn hoặc tác vụ có ý nghĩa độc lập, cần ranh giới riêng | Card chỉ vì có heading; card con cho từng field |
| Separator | Khi spacing chưa đủ rõ; border cho hàng, `hr` cho chuyển chủ đề thực sự | Đường kẻ sau mọi đoạn; nhiều treatment cho cùng ranh giới |
| List | Nhiều item, chủ yếu nhận diện/đọc tóm tắt/mở từng item; cấu trúc có thể khác nhau | Card grid chỉ để lấp viewport; list khi tác vụ chính cần so sánh theo cột |
| Table | Nhiều entity có cùng thuộc tính, cần so sánh hàng/cột; có column headers và associations | Table để layout form/hồ sơ đơn; cell chứa văn bản dài; tự thêm sort/pagination/bulk actions |
| Key–Value | Thuộc tính của một entity, nhất là Preview/Detail; ưu tiên `dl`/`dt`/`dd`; giá trị dài wrap | Mỗi cặp một card; ép dữ liệu vào các ô vuông bằng nhau |
| Status | Canonical state hoặc interaction state đã có; text bắt buộc, màu/icon bổ trợ | Badge hóa metadata; “sẵn sàng” như đã approve; gộp account/approval/operational state mất nghĩa |

**[Chuẩn]** Một entity bắt đầu bằng Sections + Key–Value. Nhiều entity chọn
List để mở từng item, Table để so sánh. Sau đó mới xét Card/Separator. Không tự
chuyển Admin List hiện tại sang Table nếu chưa thuộc delta được duyệt.

**[Đo]** Column widths, label lengths, row padding và ngưỡng chuyển layout cần
thử với dữ liệu dài/trống và viewport thực tế.

Reference: [Primer DataTable Usage](https://primer.style/product/components/data-table/guidelines/)
phân biệt table/list; [Primer Card](https://primer.style/product/components/card/)
phân biệt container thị giác với semantics của nội dung.

## 5. Component usage và extensibility

**[Chuẩn]** Tìm canonical owner/consumers trước. Ưu tiên: dùng component hiện có
→ điều chỉnh presentation tại owner → mở rộng owner → đề xuất shared component
mới. Không tạo shared abstraction chỉ vì JSX giống nhau; cần cùng trách nhiệm
và consumers cụ thể.

| Owner hiện có | Usage rule [Chuẩn] |
| --- | --- |
| `src/styles/globals.css` | Global tokens/base styles; không lặp raw colors thay token |
| `Button`, `Input` | shadcn/ui approach; ưu tiên size/variant; tránh override rải rác |
| Auth/company field wrappers | Label → control → hint/error; validation/orchestration thuộc feature |
| `PageHeader` | Tái sử dụng title/description/actions khi phù hợp |
| `CompanyProfileCard` | Shared presentation cho draft và snapshot; caller quyết định đúng nguồn dữ liệu |
| `RegistrationStageBadge` | Stage mapping thuộc feature; không đưa business statuses vào primitive |
| `CenteredState` | Trạng thái cấp trang, không dùng khối lớn cho feedback nhỏ |
| `SessionAccountCard` | Giữ chức năng; ưu tiên thị giác thấp hơn tác vụ chính |
| `FlashMessage`, Sonner | Giữ canonical owners và một Toaster; không tạo feedback renderer song song |

Các path `src/` ở trên thuộc `frontend/`; ownership chi tiết tiếp tục do
[Frontend Sources of Truth](frontend-source-of-truth.md) quản lý.

**[Chuẩn]** Feature-local component có thể tách trong scope triển khai đã duyệt
nếu làm rõ trách nhiệm và giữ ownership/behavior. Shared component mới hoặc
ownership change cần approval. Mở rộng shared owner phải kiểm tra consumers,
giữ compatibility; không đổi
default toàn ứng dụng cho nhu cầu riêng. Chi tiết quyền quyết định tại mục 9.

## 6. Layout, responsive và density

| Pattern | [Chuẩn] | [Đo] |
| --- | --- | --- |
| Authentication | Form là trọng tâm; brand ngắn, không đẩy form xuống xa trên mobile | Form width 400–480px |
| Onboarding | Tiến trình → heading → sections theo thứ tự nhập; hướng dẫn gần dữ liệu; giữ save/continue | Form width 640–760px |
| Review | Kiểm tra hồ sơ: định danh → thông tin → hình ảnh → hệ quả → confirmation/actions. Company Preview theo pilot mục 11 | Content width 960–1120px |
| Submitted/pending | Kết quả đã biết → điều cần hiểu/làm tiếp → trợ giúp phù hợp | Icon size, spacing |
| Admin List | Header → filters/search → dữ liệu; alignment phục vụ so sánh | Row padding, column widths |
| Admin Detail | Snapshot/manager dễ đọc; decision panel gắn với căn cứ xét duyệt | Rail 280–320px, ngưỡng xuống dưới |

**[Chuẩn]**

- Dùng breakpoints Tailwind hiện có; không sao chép breakpoint Primer. Chọn số cột theo không gian còn lại sau sidebar/rail/gutter.
- Khi thiếu chỗ: chuyển rail xuống, cho text wrap, giảm decoration trước khi giảm chữ. Không tự thêm sticky bar, drawer hoặc accordion.
- Giữ DOM/visual order nhất quán; mobile không mất dữ liệu/action được phép.
- Không cuộn ngang toàn trang. Vùng dữ liệu thật sự cần cuộn ngang phải giới hạn riêng và dùng được bằng keyboard.
- Mỗi vùng tác vụ có tối đa một primary action nổi trội; edit/back là secondary. Destructive action có nhãn rõ, giữ confirmation hiện có.
- Icon phục vụ nhận diện action/status; icon trang trí ẩn với assistive technology.

| Density | [Đo] |
| --- | --- |
| Auth/Onboarding | Controls khoảng 44px |
| Admin desktop | Controls 36–40px; row padding dọc 12–16px |
| Touch | Vùng tương tác mục tiêu khoảng 44×44px; icon có thể nhỏ hơn |
| Văn bản dài | Chiều dài dòng khoảng 60–80 ký tự |

**[Chuẩn]** Không dùng các giá trị thử này để ép nội dung vừa viewport.

## 7. Content, status, feedback và accessibility

**[Chuẩn]**

- Một `h1` mỗi màn hình; heading sections theo thứ bậc. Key–Value không cần card từng giá trị.
- Form có label hiển thị, hint ngắn, error cụ thể và accessible associations. Placeholder không thay label.
- Detail/Review xem được đầy đủ tên, mã số và dữ liệu quyết định. List chỉ truncate khi detail cung cấp đầy đủ.
- Phân biệt account, approval và operational state; nhãn tổng hợp giữ đúng canonical mapping. `INACTIVE` bình thường trong onboarding dùng neutral; danger cho lỗi, destructive action hoặc trạng thái cảnh báo tương ứng.
- Không dùng riêng màu để truyền đạt trạng thái. Không khẳng định trạng thái vượt dữ liệu hiện có.
- Field error gần field; feedback quan trọng gần action/section và tồn tại đủ để hiểu kết quả. Toast không là nơi duy nhất chứa thông tin thiết yếu.
- Giữ validation timing, disabled conditions, confirmation và transitions hiện có. Quy tắc presentation không tự cấp quyền sửa feedback lifecycle ngoài scope.
- Keyboard focus nhìn thấy; focus order theo reading order; hover không là cách duy nhất xem thông tin.
- Tabs có đúng keyboard/semantics; filter buttons không giả làm tabs. Đổi interaction pattern phải thuộc delta được duyệt.
- Contrast tối thiểu: text thường 4.5:1; text lớn và thông tin thị giác thiết yếu của controls 3:1 trên nền thực tế.

Form anatomy tham khảo [Primer Forms](https://primer.style/product/ui-patterns/forms/);
feedback prominence/location tham khảo [Primer Notification messaging](https://primer.style/product/ui-patterns/notification-messaging/).

## 8. Primer visual references và JOBHUB boundaries

Các reference sau là anatomy/examples để review, không phải xác nhận Primer có
sẵn workflow tương đương JOBHUB.

| Surface | Reference cụ thể | Học theo | Giữ riêng JOBHUB |
| --- | --- | --- | --- |
| Authentication | [Forms: FormControl anatomy, Structure](https://primer.style/product/ui-patterns/forms/) | Label/hint/error; vertical flow; secondary actions nhẹ | Brand, tiếng Việt, schemas, password toggle, registration/navigation |
| Onboarding | [Forms: Order/Grouping](https://primer.style/product/ui-patterns/forms/), [Feature onboarding: Proximity and proportion](https://primer.style/product/ui-patterns/feature-onboarding/) | Nhóm fields, hướng dẫn gần tác vụ, callout tương xứng | Steps, save draft, preview, limited onboarding context, activation |
| Preview | [PageLayout: Header/Content/Pane](https://primer.style/product/components/page-layout/), [Messaging: Warning](https://primer.style/product/ui-patterns/notification-messaging/) | Primary/secondary content, reading order, hệ quả gần action | Tám fields, company images, checkbox, submit semantics |
| Admin List | [DataTable: Anatomy/Usage/Best practices](https://primer.style/product/components/data-table/guidelines/) | Toolbar, định danh nổi hơn metadata, alignment, hạn chế cột | Filters/search/counts, data order, detail navigation |
| Admin Detail | [PageLayout: Content/Pane](https://primer.style/product/components/page-layout/), [Messaging](https://primer.style/product/ui-patterns/notification-messaging/) | Căn cứ quyết định là chính, decision/feedback rõ | Snapshot, manager, timestamps, approve/reject rules |

**[Chuẩn]** Feature onboarding Primer chủ yếu hướng dẫn khám phá tính năng:
chỉ vận dụng proximity/proportion, không tự thêm teaching bubble/tour/step.
DataTable reference không phê duyệt Table migration, sorting hay pagination.
Không sao chép Primer React/API, palette, breakpoint hoặc nhận diện GitHub.

**[Đo]** Tỷ lệ, màu và kích thước trong reference không phải thông số cố định
của JOBHUB.

## 9. Design Delta policy

**[Chuẩn]** Quyền tự quyết chỉ áp dụng trong scope triển khai đã được duyệt.
Không cần approval từng class nếu thay đổi nằm trong delta đó.

| Agent được tự quyết trong scope đã duyệt | Cần approval riêng |
| --- | --- |
| Áp dụng typography/spacing/color roles đã chốt; giảm decoration | Đổi brand palette, font delivery hoặc global token scale |
| Wrap text, sửa overflow, điều chỉnh responsive layout | Ẩn/bỏ dữ liệu; đổi interaction pattern; thêm sticky/collapsible patterns |
| Dùng variants/owners hiện có, điều chỉnh primary/secondary emphasis giữ chức năng | Thêm/xóa fields, actions, screens, steps hoặc confirmation |
| Điều chỉnh presentation; tách feature-local component giữ responsibility | Thêm shared component, package, primitive system hoặc layer |
| Mở rộng existing component tương thích consumers, trong scope | Ownership change; shared defaults/contracts ảnh hưởng consumers ngoài scope |
| Sửa markup/focus phù hợp interaction hiện có | Đổi validation, eligibility, disabled conditions, lưu dữ liệu, routes, API, snapshot hoặc transitions |

**[Chuẩn]** Đề xuất cần approval nêu owner đã kiểm tra, consumers, vì sao owner
hiện có chưa đủ và tác động. Thay đổi nghiệp vụ cần approved Product/API change
tương ứng; design approval không thay thế authority đó. Chưa đo không có nghĩa
agent được tự coi giá trị thử là token đã chốt: ghi browser evidence và trình
giá trị đề nghị cố định trong review của delta.

## 10. Product/API findings ngoài scope

**[Ngoài scope]** Theo [V02 frontend status](../project-status/frontend/v02-company-onboarding.md),
onboarding read có thể chỉ báo đã rời draft, không phân biệt chính xác
`PENDING`, `APPROVED`, `REJECTED`. Không tự tạo status endpoint, polling, suy
diễn state hoặc đổi flow để giải quyết bằng thiết kế.

**[Ngoài scope]** Eligibility của resend activation và trạng thái gửi email
phụ thuộc Product/API; không tự suy diễn từ cách trình bày. Thông tin approve
thành công nhưng email thất bại cần xử lý trong delta feedback được duyệt,
không mở rộng Company Preview pilot.

**[Chuẩn]** Giữ các ràng buộc từ [Product V02](../product/backend/versions/v02-company-onboarding-platform-administration.md)
và [Data V02](../data/backend/versions/v02-company-onboarding-platform-administration.md):
một lần submit/một snapshot; snapshot bất biến; freeze khi pending; reject kết
thúc onboarding; approve chưa đồng nghĩa active. Không bổ sung rejection
reason, resubmit, KYC, SLA hoặc business behavior mới.

## 11. Pilot reference: Company Preview / Submission

### 11.1. Phạm vi và existing elements cần giữ

**[Chuẩn]** Pilot phục vụ kiểm tra hồ sơ trước gửi, không mô phỏng public
company page. Presentation owners hiện có:
[CompanySubmissionReview](../../frontend/src/features/company-onboarding/components/CompanySubmissionReview.jsx)
và [CompanyProfileCard](../../frontend/src/components/common/CompanyProfileCard.jsx).

Giữ stepper và ý nghĩa các bước; title/instruction; approval/operational state;
đủ tám fields (`name`, `businessRegistrationNumber`, `website`, `address`,
`contactInfo`, `description`, `logoUrl`, `bannerUrl`); image fallback, URL và
website navigation hiện có. Giữ thông tin một lần gửi, chốt hồ sơ, freeze khi
pending, approve rồi xác nhận qua email, khả năng logout khi chờ; checkbox,
submit/edit, loading/disabled states và account controls.

### 11.2. Visual delta

| Existing treatment | Delta [Chuẩn] |
| --- | --- |
| Tên trên banner/gradient, truncate | Tên đầy đủ trên nền trung tính; logo nhỏ hỗ trợ nhận diện |
| Banner mở đầu nổi bật | Section hình ảnh; không đặt dữ liệu quyết định lên ảnh |
| Field có nền/radius riêng | Key–Value trong Sections; bỏ từng ô trang trí |
| Nhiều panel hướng dẫn/cảnh báo | Nhóm theo nghĩa; hệ quả gần confirmation/actions, next steps là nội dung phụ |
| “Chưa hoạt động” màu danger | Neutral treatment, giữ nghĩa |
| “Hồ sơ sẵn sàng” như chứng nhận | Giảm ưu tiên; không như đã verify/approve |
| Account panel cạnh tranh submit | Giữ chức năng, giảm prominence |

### 11.3. Desktop/mobile và content hierarchy

**[Chuẩn]** Một reading flow chính, không decision rail bên phải:

1. Stepper.
2. Một `h1` về kiểm tra/gửi, instruction ngắn và status.
3. Hồ sơ: tên đầy đủ, logo, mã số, liên hệ và mô tả.
4. Hình ảnh thương hiệu và URL tương ứng.
5. Hướng dẫn sau gửi.
6. Cảnh báo hệ quả → checkbox → actions.
7. Account controls ở mức phụ.

**[Chuẩn]** Desktop có thể đặt label/value cạnh nhau, chia cột các thuộc tính
ngắn khi vẫn dễ quét; address/description/URL dài đủ chiều rộng. Mobile đặt
label trên value, sections nối tiếp; actions có thể xếp dọc, DOM/visual order
thống nhất. Không thêm modal, sticky bar hoặc accordion.

### 11.4. Surfaces, typography và actions

**[Chuẩn]** Canvas trung tính, một content surface chính; heading/spacing/divider
phân biệt sections. Warning có semantic treatment, không chứa card con.
Tên/giá trị chính dùng foreground, muted cho labels/phụ chú phù hợp. Sentence
case; không uppercase labels, icon mọi field hoặc shadow lặp lại.

**[Chuẩn]** “Gửi xét duyệt” là primary duy nhất; “Quay lại chỉnh sửa” là
secondary. Warning/checkbox cùng vùng submit, không thêm confirmation mới.

**[Đo]** Chưa cố định container width, label/value ratio, số cột metadata, image
height, type sizes, spacing, radius hoặc control height. Thử giá trị mục 3/6 và
ghi evidence trước khi đề nghị cố định.

### 11.5. Business invariants

**[Chuẩn]** Đây là ranh giới bảo toàn, không phải định nghĩa Product/API mới:

- Preview đọc saved draft hiện có; không đổi nguồn hoặc tự tạo snapshot. Admin Detail vẫn dùng submitted snapshot.
- Giữ required fields, uniqueness, authorization/eligibility và validation semantics.
- Checkbox vẫn bắt buộc theo interaction hiện có; giữ disabled khi chưa xác nhận/đang submit và hành vi edit khi đang gửi.
- Giữ submit API/payload, error handling, callbacks, transitions; field rejection vẫn quay về form với error theo behavior hiện có.
- Edit không tự save/reset/biến đổi dữ liệu. Không thêm request, confirmation hoặc lần submit.
- Giữ một lần submit, snapshot bất biến, freeze khi pending, không resubmit; submit ≠ approve, approve ≠ active.
- Giữ account/session/logout behavior. Không đổi default presentation của shared consumers ngoài pilot; cần scope/approval riêng nếu ảnh hưởng họ.

### 11.6. Pilot visual acceptance

- [ ] **[Chuẩn]** Đủ fields; tên/mã số/URL dài đọc đầy đủ; description giữ xuống dòng; empty values không làm mất label.
- [ ] **[Chuẩn]** Dữ liệu quan trọng không đè lên ảnh; image missing/failed có fallback.
- [ ] **[Chuẩn]** Phân biệt rõ hồ sơ, hệ quả gửi và primary action không dựa riêng màu; không card từng field/cảnh báo lặp.
- [ ] **[Chuẩn]** Checkbox/actions dùng được bằng keyboard, focus không clipped; desktop/mobile giữ đủ data/actions, không page overflow ngang.
- [ ] **[Chuẩn]** Contrast đạt mục 7 trên nền thực tế; warning gắn với submit; baseline invariants không đổi.
- [ ] **[Đo]** Review 360/768/1024/1440px, quanh breakpoint và zoom 200%; đây là mốc thử, không phải breakpoint bắt buộc.
- [ ] **[Đo]** Ghi wrapping, reading width, image height và confirmation region trước khi chốt tokens.

## 12. Browser acceptance và evidence

**[Chuẩn]** Checklist sau áp dụng cho delta được giao; dùng dữ liệu thử nghiệm,
không approve/reject hồ sơ thật chỉ để xác minh giao diện.

- [ ] Kiểm tra viewport/zoom mục 11.6 và quanh các breakpoint thực tế; không overlap, clipping hoặc che focus/action.
- [ ] Auth/Onboarding có điểm bắt đầu nhập rõ, marketing không chiếm ưu tiên; Admin đọc được khi sidebar/rail cùng xuất hiện.
- [ ] Thử tên/email/URL dài, description nhiều đoạn, empty/missing/failed images; Preview/Detail đủ định danh/dữ liệu quyết định.
- [ ] Typography, spacing, status, primary/secondary actions nhất quán; không generic decoration lặp lại.
- [ ] Keyboard đi hết controls; focus rõ, tabs/filter đúng semantics; kiểm tra accessible names/associations ngoài screenshot.
- [ ] Đo contrast thực tế; status hiểu được khi không phân biệt màu.
- [ ] Thử các trạng thái hiện có trong scope: loading, empty, error, validation, submitting, confirmation, result. Không thêm state chỉ để hoàn thành checklist.
- [ ] Feedback quan trọng không chỉ nằm trong toast; không khẳng định state vượt dữ liệu.
- [ ] Không đổi fields/payloads/validation/eligibility/routes/snapshot/transitions.

**[Chuẩn]** Ghi screen, viewport/zoom, dữ liệu/trạng thái, kết quả và giá trị
thử; mục chưa kiểm tra phải ghi rõ. Review các shared consumers bị ảnh hưởng.
Browser evidence bổ sung, không thay gate frontend chính thức do
[Frontend Conventions](frontend-conventions.md#verification) quy định. Không
claim rendering/accessibility/integration đã pass chỉ từ lint/build.

**[Đo]** Khi chưa có evidence, thông số tiếp tục ở trạng thái cần kiểm chứng;
baseline approval không biến chúng thành fixed values hoặc browser-verified UI.
