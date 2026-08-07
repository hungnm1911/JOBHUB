# V02 — Company onboarding và quản trị cấp nền tảng

> **File:** `docs/product/versions/v02-company-onboarding-platform-administration.md`
> **Vai trò:** Canonical Product Specification
> **Ngôn ngữ:** Tiếng Việt
> **Mục đích:** Xác định business/functional truth của V02.

---

## 1. Mục tiêu

V02 bổ sung vòng đời onboarding Company và quyền quản trị Company ở cấp nền tảng.

Sau khi V02 hoàn thành, hệ thống phải:

- cho phép một Company Manager đăng ký đồng thời tài khoản đại diện và Company;
- duy trì quan hệ cố định `1 Company ↔ 1 Company Manager`;
- cho phép Company Manager hoàn thiện và gửi hồ sơ Company để xét duyệt;
- lưu giữ đúng nội dung hồ sơ đã được gửi làm căn cứ xét duyệt;
- cho phép Platform Admin xem, chấp thuận hoặc từ chối đăng ký Company;
- chỉ kích hoạt Company và Company Manager sau khi Company đã được chấp thuận và Company Manager xác nhận qua email;
- cho phép Company Manager tự yêu cầu gửi lại xác nhận chấp thuận khi xác nhận trước đó đã hết hạn;
- cho phép Company Manager quản lý hồ sơ Company trong phạm vi được phép sau khi Company hoạt động;
- cho phép Platform Admin chấm dứt khả năng hoạt động của một Company đã active;
- thiết lập tenant boundary để dữ liệu doanh nghiệp về sau luôn thuộc đúng Company.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

- Đăng ký Company Manager đồng thời với Company.
- Hoàn thiện hồ sơ Company trước khi gửi xét duyệt.
- Gửi hồ sơ Company để Platform Admin xét duyệt.
- Ghi nhận snapshot hồ sơ tại thời điểm gửi.
- Platform Admin xem danh sách và chi tiết đăng ký Company.
- Platform Admin chấp thuận Company.
- Platform Admin từ chối Company.
- Company Manager xác nhận chấp thuận qua email.
- Company Manager tự yêu cầu gửi lại xác nhận chấp thuận khi xác nhận cũ đã hết hạn.
- Kích hoạt đồng thời Company và tài khoản Company Manager.
- Company Manager xem và cập nhật hồ sơ Company đang hoạt động trong phạm vi được phép.
- Platform Admin khóa/chấm dứt hoạt động của Company đang active.
- Authorization theo quan hệ Company Manager — Company.
- Tenant boundary cho Company.

### 2.2. Ngoài phạm vi

- Company có nhiều Company Manager.
- Company Manager đại diện nhiều Company.
- Thay thế hoặc chuyển Company Manager của một Company.
- Company tồn tại trong trạng thái không có Company Manager.
- Gửi lại hồ sơ sau khi bị Platform Admin từ chối.
- Mở lại một đăng ký đã bị từ chối.
- Nhiều vòng xét duyệt hoặc nhiều version snapshot.
- Re-review hồ sơ Company sau khi Company đã active.
- Mở khóa/reactivate Company sau khi Company đã bị khóa theo F10.
- Tạo và quản lý Recruiter hoặc Company Member.
- Job, Job Approval, Recruitment Team.
- Candidate Profile, CV, Job Discovery.
- Application, Recruitment Pipeline.
- Conversation, Interview, Notification.
- Candidate Search, Job Invitation, Saved Jobs.
- Dashboard và thống kê tuyển dụng.
- Xóa hoặc archive Company.
- Lịch sử nhiều lần approve, reject, lock hoặc các audit workflow tương ứng.

Không suy diễn hoặc tự bổ sung các chức năng ngoài phạm vi đã được chốt.

---

## 3. Dependency với các version trước

V02 sử dụng và mở rộng các business concept đã có từ V01:

- `User`.
- Authentication và điều kiện được đăng nhập.
- Xác thực email.
- Trạng thái tài khoản `ACTIVE`, `LOCKED`, `TERMINATED`.
- Quy tắc tài khoản không còn `ACTIVE` thì không được đăng nhập.
- Quy tắc chấm dứt tài khoản không đồng nghĩa hard delete.

V02 bổ sung trạng thái `PENDING_ACTIVATION` cho Company Manager đang trong onboarding.

Đối với Company Manager, V02 thay đổi thời điểm được active:

```text
Đăng ký Company Manager + Company
        ↓
PENDING_ACTIVATION
        ↓
Platform Admin chấp thuận Company
        ↓
Company Manager xác nhận chấp thuận qua email
        ↓
Company Manager ACTIVE
+
Company ACTIVE
```

Company Manager không được active chỉ vì đã bắt đầu đăng ký.

Candidate flow của V01 không bị thay đổi bởi V02.

---

## 4. Thuật ngữ và chủ thể

### 4.1. Company Manager

Company Manager là User đại diện và quản lý một Company.

Company Manager:

- có credentials của User để đăng nhập;
- đăng ký đồng thời với Company;
- hoàn thiện và gửi hồ sơ Company;
- xác nhận chấp thuận sau khi Platform Admin approve;
- sau khi active, chỉ quản lý Company gắn với chính mình.

Company Manager không được sử dụng cùng tài khoản như Candidate.

### 4.2. Company

Company là thực thể doanh nghiệp độc lập với Company Manager.

Company:

- có hồ sơ doanh nghiệp riêng;
- có trạng thái xét duyệt riêng;
- có trạng thái hoạt động riêng;
- là tenant của dữ liệu doanh nghiệp;
- không có credentials đăng nhập riêng.

### 4.3. Platform Admin

Platform Admin là actor quản trị ở cấp nền tảng.

Platform Admin:

- không thuộc bất kỳ Company nào;
- được xem các đăng ký Company;
- được xem hồ sơ đã gửi để xét duyệt;
- được chấp thuận hoặc từ chối Company;
- được khóa/chấm dứt Company đang active.

Quyền quản trị cấp nền tảng không làm Platform Admin trở thành thành viên của Company.

---

## 5. Quan hệ nghiệp vụ chính

```text
Company Manager
      │
      │ 1 — 1
      ↓
   Company
```

Các invariant của quan hệ:

- một Company Manager gắn với đúng một Company;
- một Company gắn với đúng một Company Manager;
- Company Manager không đại diện đồng thời nhiều Company;
- Company không có nhiều Company Manager;
- Company không có credentials riêng;
- credentials của Company Manager được dùng để đại diện Company;
- không có workflow thay thế hoặc chuyển giao Company Manager;
- Company không có lifecycle hợp lệ trong V02 mà thiếu Company Manager.

Quan hệ `1 Company ↔ 1 Company Manager` là business design của V02, không phải quan hệ tạm thời để mở nhánh multi-manager trong version này.

---

## 6. Trạng thái nghiệp vụ

### 6.1. Trạng thái Company Manager liên quan V02

| Trạng thái | Ý nghĩa trong V02 |
| --- | --- |
| `PENDING_ACTIVATION` | Company Manager đang trong onboarding và chưa được phép đăng nhập như một tài khoản active. |
| `ACTIVE` | Company Manager đã hoàn tất onboarding và được phép đăng nhập nếu các điều kiện authentication khác của hệ thống vẫn hợp lệ. |
| `TERMINATED` | Quyền truy cập của Company Manager đã bị chấm dứt; không được đăng nhập. |

`LOCKED` vẫn là trạng thái tài khoản đã tồn tại từ V01, nhưng hành động khóa Company trong F10 của V02 chuyển Company Manager sang `TERMINATED`.

### 6.2. Trạng thái xét duyệt Company

| Trạng thái | Ý nghĩa |
| --- | --- |
| `NOT_SUBMITTED` | Company Manager đang hoàn thiện hồ sơ và chưa gửi Platform Admin. |
| `PENDING` | Hồ sơ đã được gửi và đang chờ Platform Admin quyết định. |
| `APPROVED` | Platform Admin đã chấp thuận Company. |
| `REJECTED` | Platform Admin đã từ chối Company; đây là trạng thái kết thúc của onboarding trong V02. |

### 6.3. Trạng thái hoạt động Company

| Trạng thái | Ý nghĩa |
| --- | --- |
| `INACTIVE` | Company chưa được phép hoạt động trên nền tảng. |
| `ACTIVE` | Company đang được phép hoạt động. |
| `LOCKED` | Company đã từng active nhưng đã bị Platform Admin chấm dứt khả năng hoạt động trong V02. |

Trạng thái xét duyệt và trạng thái hoạt động là hai khái niệm độc lập.

`APPROVED` không đồng nghĩa với `ACTIVE`.

---

## 7. Tổ hợp trạng thái hợp lệ

Các tổ hợp dưới đây định nghĩa lifecycle Company onboarding và quản trị Company của V02:

| Company Manager | Company approval | Company operational | Ý nghĩa |
| --- | --- | --- | --- |
| `PENDING_ACTIVATION` | `NOT_SUBMITTED` | `INACTIVE` | Đang hoàn thiện onboarding. |
| `PENDING_ACTIVATION` | `PENDING` | `INACTIVE` | Đã submit, đang chờ Platform Admin. |
| `PENDING_ACTIVATION` | `REJECTED` | `INACTIVE` | Đăng ký bị từ chối; onboarding kết thúc. |
| `PENDING_ACTIVATION` | `APPROVED` | `INACTIVE` | Admin đã approve, đang chờ Company Manager xác nhận. |
| `ACTIVE` | `APPROVED` | `ACTIVE` | Company và Company Manager đang hoạt động. |
| `TERMINATED` | `APPROVED` | `LOCKED` | Company bị khóa/chấm dứt hoạt động và Company Manager không còn quyền đăng nhập. |

Các tổ hợp khác không thuộc lifecycle Company của V02 và không được tự bổ sung thành transition mới.

---

## 8. Quy trình nghiệp vụ tổng thể

```text
Company Manager bắt đầu đăng ký
        ↓
Tạo onboarding Company Manager + Company
        ↓
Company Manager hoàn thiện hồ sơ Company
        ↓
Company Manager submit
        ↓
Hệ thống ghi nhận snapshot hồ sơ đã gửi
        ↓
Company → PENDING
        ↓
Platform Admin xem snapshot
        ↓
   ┌───────────────┴────────────────┐
   ↓                                ↓
Reject                           Approve
   ↓                                ↓
REJECTED                      APPROVED + INACTIVE
Terminal                             ↓
                            Gửi xác nhận chấp thuận
                                     ↓
                          Company Manager xác nhận
                                     ↓
                              Company ACTIVE
                                     +
                         Company Manager ACTIVE
                                     ↓
                         Quản lý Company đang hoạt động
                                     ↓
                    Platform Admin khóa/chấm dứt Company
                                     ↓
                              Company LOCKED
                                     +
                       Company Manager TERMINATED
```

---

# 9. Functional Requirements

## F01 — Khởi tạo onboarding Company Manager và Company

### Actor

- Người đăng ký Company Manager.

### Mục tiêu

Khởi tạo một onboarding trong đó tài khoản Company Manager và Company được tạo như hai đối tượng nghiệp vụ riêng nhưng bắt buộc gắn với nhau theo quan hệ `1 — 1`.

### Tiền điều kiện

- Người đăng ký chọn đăng ký với tư cách Company Manager.
- Các điều kiện tài khoản chung kế thừa từ V01 phải được thỏa mãn.

### Luồng chính

1. Người đăng ký cung cấp thông tin tài khoản Company Manager.
2. Hệ thống xác định tài khoản thuộc loại Company Manager.
3. Hệ thống khởi tạo Company tương ứng.
4. Hệ thống thiết lập quan hệ `1 Company Manager ↔ 1 Company`.
5. Company Manager bước vào trạng thái `PENDING_ACTIVATION`.
6. Company bắt đầu ở `NOT_SUBMITTED + INACTIVE`.
7. Company Manager tiếp tục hoàn thiện hồ sơ Company.

### Kết quả

- Company Manager và Company cùng tồn tại trong onboarding.
- Company Manager chưa được active.
- Company chưa được phép hoạt động.
- Company Manager chưa được sử dụng tài khoản như Candidate.

### Trường hợp từ chối

- Không cho phép hoàn tất onboarding Company Manager mà không có Company tương ứng.
- Không cho phép một Company Manager gắn với Company thứ hai.
- Không cho phép một Company gắn với Company Manager thứ hai.

### Business Rules liên quan

- `BR-01`
- `BR-02`
- `BR-03`
- `BR-04`

### Không thuộc chức năng này

- Xét duyệt Company.
- Kích hoạt Company.
- Tạo Recruiter.
- Tạo Job.

---

## F02 — Hoàn thiện hồ sơ Company trước khi submit

### Actor

- Company Manager của Company.

### Mục tiêu

Cho phép Company Manager hoàn thiện hồ sơ Company trước khi gửi xét duyệt.

### Tiền điều kiện

- Company thuộc Company Manager hiện tại.
- Company đang ở `NOT_SUBMITTED + INACTIVE`.

### Luồng chính

1. Company Manager nhập hoặc cập nhật thông tin hồ sơ Company.
2. Hệ thống ghi nhận hồ sơ hiện tại của Company.
3. Company Manager có thể tiếp tục cập nhật hồ sơ cho đến trước khi submit.

Các thông tin hồ sơ thuộc V02 gồm:

- tên Company;
- logo;
- banner;
- website;
- địa chỉ;
- mô tả;
- thông tin liên hệ;
- mã số doanh nghiệp.

### Kết quả

- Hồ sơ Company được cập nhật nhưng chưa được coi là hồ sơ đã gửi xét duyệt.

### Trường hợp từ chối

- Company Manager không được cập nhật Company của Company Manager khác.
- Sau khi Company đã ở `PENDING`, chức năng này không được dùng để sửa hồ sơ đang được xét duyệt.

### Business Rules liên quan

- `BR-02`
- `BR-05`
- `BR-08`
- `BR-17`
- `BR-18`

### Không thuộc chức năng này

- Submit hồ sơ.
- Chấp thuận hoặc từ chối hồ sơ.
- Thay đổi trạng thái xét duyệt hoặc trạng thái hoạt động.

---

## F03 — Submit Company để xét duyệt

### Actor

- Company Manager của Company.

### Mục tiêu

Gửi hồ sơ Company cho Platform Admin xét duyệt và cố định nội dung được dùng làm căn cứ quyết định.

### Tiền điều kiện

- Company đang ở `NOT_SUBMITTED + INACTIVE`.
- `name` đã có giá trị.
- `businessRegistrationNumber` đã có giá trị.
- `businessRegistrationNumber` chưa được sử dụng bởi Company khác.
- Company thuộc Company Manager hiện tại.

### Luồng chính

1. Company Manager yêu cầu submit Company.
2. Hệ thống kiểm tra các điều kiện bắt buộc.
3. Hệ thống ghi nhận snapshot của hồ sơ Company tại thời điểm submit.
4. Company chuyển sang `PENDING + INACTIVE`.
5. Hồ sơ đã submit trở thành nội dung Platform Admin dùng để xét duyệt.
6. Trong thời gian `PENDING`, Company Manager không được sửa hồ sơ Company.

### Kết quả

- Company có đúng một hồ sơ đã gửi để Platform Admin xét duyệt.
- Nội dung xét duyệt được cố định tại thời điểm submit.
- Company chưa active.

### Trường hợp từ chối

- Thiếu `name`.
- Thiếu `businessRegistrationNumber`.
- `businessRegistrationNumber` đã thuộc Company khác.
- Company không ở `NOT_SUBMITTED + INACTIVE`.
- Company không thuộc Company Manager hiện tại.
- Company đã từng submit trong lifecycle V02.

### Business Rules liên quan

- `BR-05`
- `BR-06`
- `BR-07`
- `BR-08`
- `BR-17`
- `BR-18`

### Không thuộc chức năng này

- Resubmit sau reject.
- Tạo snapshot version thứ hai.
- Chỉnh sửa snapshot sau submit.

---

## F04 — Platform Admin xem đăng ký Company

### Actor

- Platform Admin.

### Mục tiêu

Cho phép Platform Admin xem các Company đã gửi đăng ký và xem đúng nội dung được dùng làm căn cứ xét duyệt.

### Tiền điều kiện

- Actor là Platform Admin.

### Luồng chính

1. Platform Admin xem danh sách đăng ký Company.
2. Platform Admin nhận biết Company, Company Manager đại diện và trạng thái xét duyệt.
3. Platform Admin mở một đăng ký.
4. Hệ thống hiển thị thông tin Company Manager liên quan.
5. Hệ thống hiển thị snapshot hồ sơ đã được submit.
6. Platform Admin dùng snapshot đó làm căn cứ cho quyết định approve hoặc reject.

### Kết quả

- Platform Admin có đủ nội dung đã submit để đưa ra quyết định xét duyệt.
- Nội dung được xem để xét duyệt là snapshot của lần submit.

### Trường hợp từ chối

- Actor không phải Platform Admin thì không được sử dụng quyền xét duyệt cấp nền tảng.

### Business Rules liên quan

- `BR-07`
- `BR-14`
- `BR-19`

### Không thuộc chức năng này

- Chỉnh sửa hồ sơ Company thay Company Manager.
- Thực hiện nghiệp vụ tuyển dụng thay Company.

---

## F05 — Platform Admin chấp thuận Company

### Actor

- Platform Admin.

### Mục tiêu

Chấp thuận hồ sơ Company đã được submit nhưng chưa kích hoạt Company ngay.

### Tiền điều kiện

- Actor là Platform Admin.
- Company đang ở `PENDING + INACTIVE`.
- Platform Admin đưa ra quyết định dựa trên snapshot đã submit.

### Luồng chính

1. Platform Admin chấp thuận Company.
2. Company chuyển sang `APPROVED + INACTIVE`.
3. Company Manager vẫn ở `PENDING_ACTIVATION`.
4. Hệ thống gửi yêu cầu xác nhận chấp thuận qua email cho Company Manager.
5. Hệ thống chờ Company Manager xác nhận.

### Kết quả

- Company đã được Platform Admin chấp thuận.
- Company chưa active.
- Company Manager chưa active.

### Trường hợp từ chối

- Company không ở `PENDING + INACTIVE`.
- Actor không phải Platform Admin.

### Business Rules liên quan

- `BR-07`
- `BR-10`
- `BR-14`

### Không thuộc chức năng này

- Tự động kích hoạt Company ngay khi Platform Admin approve.
- Tự động kích hoạt Company Manager ngay khi Platform Admin approve.

---

## F06 — Platform Admin từ chối Company

### Actor

- Platform Admin.

### Mục tiêu

Kết thúc onboarding của một Company không được Platform Admin chấp thuận.

### Tiền điều kiện

- Actor là Platform Admin.
- Company đang ở `PENDING + INACTIVE`.
- Quyết định được đưa ra dựa trên snapshot đã submit.

### Luồng chính

1. Platform Admin từ chối Company.
2. Company chuyển sang `REJECTED + INACTIVE`.
3. Company Manager vẫn không được active.
4. Onboarding của Company kết thúc.

### Kết quả

- Company không được hoạt động.
- Company Manager không được active thông qua onboarding này.
- Không có transition resubmit trong V02.

### Trường hợp từ chối

- Company không ở `PENDING + INACTIVE`.
- Actor không phải Platform Admin.

### Business Rules liên quan

- `BR-07`
- `BR-09`
- `BR-14`

### Không thuộc chức năng này

- Nhập hoặc lưu rejection reason.
- Mở lại hồ sơ bị reject.
- Sửa và resubmit hồ sơ bị reject.

---

## F07 — Company Manager xác nhận chấp thuận và hoàn tất activation

### Actor

- Company Manager của Company đã được chấp thuận.

### Mục tiêu

Hoàn tất onboarding bằng việc xác nhận chấp thuận và kích hoạt đồng thời Company Manager cùng Company.

### Tiền điều kiện

- Company Manager đang ở `PENDING_ACTIVATION`.
- Company đang ở `APPROVED + INACTIVE`.
- Company Manager là người đại diện của Company đó.
- Yêu cầu xác nhận chấp thuận còn hợp lệ.

### Luồng chính

1. Company Manager nhận yêu cầu xác nhận chấp thuận qua email.
2. Company Manager thực hiện xác nhận.
3. Hệ thống kiểm tra Company vẫn đã được Platform Admin chấp thuận và chưa active.
4. Hệ thống xác nhận hành động thuộc đúng Company Manager.
5. Hệ thống ghi nhận Company Manager là `ACTIVE`.
6. Hệ thống ghi nhận Company là `APPROVED + ACTIVE`.
7. Bước xác nhận email cần thiết cho Company Manager trong onboarding được hoàn tất cùng hành động này.
8. Onboarding kết thúc thành công.

### Kết quả

- Company Manager active.
- Company active.
- Company Manager có thể đăng nhập theo các điều kiện authentication chung.
- Company Manager có thể đại diện cho Company của mình.

### Trường hợp từ chối

- Company chưa được approve.
- Company không còn `INACTIVE`.
- Company Manager không còn `PENDING_ACTIVATION`.
- Yêu cầu xác nhận không hợp lệ hoặc đã hết hạn.
- Người xác nhận không phải Company Manager tương ứng.

### Business Rules liên quan

- `BR-02`
- `BR-10`
- `BR-11`
- `BR-17`
- `BR-18`

### Không thuộc chức năng này

- Kích hoạt chỉ Company mà không kích hoạt Company Manager.
- Kích hoạt chỉ Company Manager mà không kích hoạt Company.
- Chuyển Company sang một Company Manager khác.

---

## F08 — Company Manager yêu cầu gửi lại xác nhận chấp thuận

### Actor

- Company Manager của Company đã được chấp thuận.

### Mục tiêu

Cho phép Company Manager tiếp tục onboarding khi yêu cầu xác nhận chấp thuận trước đó đã hết hạn.

### Tiền điều kiện

- Company Manager đang ở `PENDING_ACTIVATION`.
- Company đang ở `APPROVED + INACTIVE`.
- Yêu cầu xác nhận trước đó đã hết hạn.
- Company Manager là người đại diện của Company.

### Luồng chính

1. Company Manager yêu cầu gửi lại xác nhận chấp thuận.
2. Hệ thống kiểm tra Company vẫn ở trạng thái chờ xác nhận.
3. Hệ thống gửi lại một yêu cầu xác nhận chấp thuận cho Company Manager.
4. Company và Company Manager không thay đổi trạng thái chỉ vì hành động resend.

### Kết quả

- Company Manager có một khả năng xác nhận chấp thuận còn hiệu lực để tiếp tục F07.

### Trường hợp từ chối

- Company không ở `APPROVED + INACTIVE`.
- Company Manager không ở `PENDING_ACTIVATION`.
- Người yêu cầu không phải Company Manager của Company.

### Business Rules liên quan

- `BR-12`
- `BR-17`
- `BR-18`

### Không thuộc chức năng này

- Thay đổi quyết định approve.
- Tự động active Company.
- Resubmit Company.

---

## F09 — Company Manager xem và cập nhật hồ sơ Company đang active

### Actor

- Company Manager của Company.

### Mục tiêu

Cho phép Company Manager quản lý hồ sơ Company của mình sau khi onboarding hoàn tất.

### Tiền điều kiện

- Company Manager đang `ACTIVE`.
- Company đang `APPROVED + ACTIVE`.
- Company thuộc Company Manager hiện tại.

### Luồng chính

1. Company Manager xem hồ sơ Company của mình.
2. Company Manager có thể cập nhật:
   - logo;
   - banner;
   - website;
   - địa chỉ;
   - mô tả;
   - thông tin liên hệ.
3. Company Manager không được thay đổi:
   - tên Company;
   - mã số doanh nghiệp;
   - trạng thái xét duyệt;
   - trạng thái hoạt động.
4. Các cập nhật hồ sơ được phép không đưa Company trở lại quy trình xét duyệt.

### Kết quả

- Hồ sơ Company được cập nhật trong phạm vi cho phép.
- Company tiếp tục ở `APPROVED + ACTIVE`.

### Trường hợp từ chối

- Company Manager thao tác Company khác.
- Company không ở trạng thái được phép theo F09.
- Company Manager cố thay đổi tên Company.
- Company Manager cố thay đổi mã số doanh nghiệp.
- Company Manager cố thay đổi trạng thái do Platform Admin hoặc hệ thống quản lý.

### Business Rules liên quan

- `BR-13`
- `BR-17`
- `BR-18`

### Không thuộc chức năng này

- Re-review sau cập nhật.
- Đổi Company Manager.
- Thay đổi approval status hoặc operational status.

---

## F10 — Platform Admin khóa/chấm dứt Company

### Actor

- Platform Admin.

### Mục tiêu

Chấm dứt khả năng hoạt động của một Company đang active và đồng thời chấm dứt quyền đăng nhập của Company Manager đại diện.

### Tiền điều kiện

- Actor là Platform Admin.
- Company đang ở `APPROVED + ACTIVE`.
- Company Manager tương ứng đang `ACTIVE`.

### Luồng chính

1. Platform Admin thực hiện khóa Company.
2. Company chuyển từ `ACTIVE` sang `LOCKED`.
3. Company Manager chuyển từ `ACTIVE` sang `TERMINATED`.
4. Company không còn được coi là tenant đang hoạt động.
5. Company Manager không còn được đăng nhập.
6. Các hoạt động doanh nghiệp yêu cầu Company active phải bị chặn.
7. Company và dữ liệu đã tồn tại vẫn được giữ lại.

### Kết quả

- Company ở `APPROVED + LOCKED`.
- Company Manager ở `TERMINATED`.
- Company Manager không thể đăng nhập.
- Company không tiếp tục thực hiện hoạt động doanh nghiệp yêu cầu trạng thái active.
- V02 không có transition mở khóa/reactivate từ trạng thái này.

### Trường hợp từ chối

- Company chưa từng active.
- Company không ở `APPROVED + ACTIVE`.
- Actor không phải Platform Admin.

### Business Rules liên quan

- `BR-14`
- `BR-15`
- `BR-16`
- `BR-19`

### Không thuộc chức năng này

- Xóa Company.
- Xóa dữ liệu Company.
- Thay Company Manager.
- Mở khóa/reactivate Company.
- Khôi phục Company Manager từ `TERMINATED`.

---

# 10. Business Rules

## BR-01 — Company Manager và Company là hai thực thể riêng

Company Manager là User có credentials.

Company là thực thể doanh nghiệp có hồ sơ và lifecycle riêng.

Company không có credentials đăng nhập độc lập.

---

## BR-02 — Quan hệ `1 Company ↔ 1 Company Manager`

Một Company Manager chỉ đại diện đúng một Company.

Một Company chỉ có đúng một Company Manager.

Không có workflow multi-manager, manager replacement hoặc Company không có manager trong V02.

---

## BR-03 — Company Manager không phải Candidate

Tài khoản Company Manager không được sử dụng như tài khoản Candidate.

Company Manager không được chuyển sang Candidate để bỏ qua Company onboarding.

---

## BR-04 — Onboarding Company Manager và Company là một quy trình

Không được hoàn tất việc đăng ký Company Manager như một tài khoản hoạt động độc lập khỏi Company.

Company Manager chỉ được active sau khi Company đã được Platform Admin chấp thuận và Company Manager hoàn tất xác nhận chấp thuận.

---

## BR-05 — Điều kiện dữ liệu tối thiểu khi submit

Khi submit Company:

- `name` là bắt buộc;
- `businessRegistrationNumber` là bắt buộc;
- `name` không bắt buộc duy nhất;
- `businessRegistrationNumber` phải duy nhất giữa các Company.

---

## BR-06 — Một lần submit, một snapshot trong V02

Mỗi Company chỉ có một lần submit trong onboarding V02.

Lần submit tạo đúng một snapshot làm căn cứ xét duyệt.

V02 không có snapshot version hoặc vòng submit thứ hai.

---

## BR-07 — Platform Admin xét duyệt đúng snapshot đã submit

Platform Admin phải đưa ra quyết định approve/reject dựa trên nội dung Company đã gửi tại thời điểm submit.

Thay đổi dữ liệu ngoài nội dung đó không được tự thay đổi căn cứ xét duyệt.

---

## BR-08 — Hồ sơ bị freeze khi `PENDING`

Khi Company đã chuyển sang `PENDING`, Company Manager không được chỉnh sửa hồ sơ Company đang được xét duyệt.

---

## BR-09 — Reject là terminal trong V02

`REJECTED + INACTIVE` là trạng thái kết thúc của onboarding bị từ chối.

Không có:

- sửa rồi resubmit;
- reopen;
- tạo vòng review mới.

V02 không có nghiệp vụ rejection reason.

---

## BR-10 — Admin approve không đồng nghĩa Company active

Platform Admin approve chỉ đưa Company tới:

```text
APPROVED + INACTIVE
```

Company chỉ active sau khi Company Manager xác nhận chấp thuận.

---

## BR-11 — Activation của Company và Company Manager là một business action thống nhất

Khi Company Manager xác nhận chấp thuận thành công:

```text
Company Manager
PENDING_ACTIVATION → ACTIVE

Company
APPROVED + INACTIVE → APPROVED + ACTIVE
```

Không được xuất hiện kết quả thành công trong đó chỉ một phía đã active.

---

## BR-12 — Resend xác nhận chấp thuận

Nếu Company đã `APPROVED + INACTIVE` và yêu cầu xác nhận trước đó đã hết hạn, Company Manager tương ứng được quyền tự yêu cầu gửi lại xác nhận chấp thuận.

Resend không tự thay đổi trạng thái Company hoặc Company Manager.

---

## BR-13 — Ranh giới cập nhật hồ sơ Company sau activation

Khi Company đang active, Company Manager được cập nhật:

- logo;
- banner;
- website;
- địa chỉ;
- mô tả;
- thông tin liên hệ.

Company Manager không được thay đổi:

- `name`;
- `businessRegistrationNumber`.

Các thay đổi hồ sơ được phép không tạo một vòng xét duyệt mới trong V02.

---

## BR-14 — Quyền quản trị Company thuộc Platform Admin

Chỉ Platform Admin được:

- approve Company;
- reject Company;
- khóa/chấm dứt Company active.

Company Manager không được tự thay đổi approval state hoặc operational state.

---

## BR-15 — Khóa Company đồng thời terminate Company Manager

Khi Platform Admin khóa một Company đang active:

```text
Company
ACTIVE → LOCKED

Company Manager
ACTIVE → TERMINATED
```

Company Manager không còn được đăng nhập sau transition này.

---

## BR-16 — Khóa không xóa Company hoặc dữ liệu

Khóa Company không đồng nghĩa:

- hard delete Company;
- xóa Company Manager;
- xóa dữ liệu đã phát sinh;
- chuyển quyền sở hữu sang Platform Admin.

V02 không có transition unlock/reactivate từ trạng thái Company `LOCKED` của F10.

---

## BR-17 — Company là tenant của dữ liệu doanh nghiệp

Mỗi Company tạo một tenant boundary độc lập.

Company Manager chỉ được truy cập tài nguyên thuộc Company mà mình đại diện.

Company A không được truy cập dữ liệu nội bộ của Company B.

---

## BR-18 — Tenant authorization phải dựa trên quan hệ đã được hệ thống xác nhận

Quyền truy cập của Company Manager phải được xác định từ:

```text
Authenticated Company Manager
        ↓
Quan hệ Company Manager — Company
        ↓
Company hợp lệ
        ↓
Resource thuộc Company đó
```

Identifier Company do client cung cấp không tự tạo ra quyền truy cập.

Biết identifier của Company khác không tạo quyền truy cập tới Company đó.

---

## BR-19 — Platform Admin có quyền cấp nền tảng nhưng không trở thành thành viên Company

Platform Admin có thể quản trị nhiều Company theo quyền cấp nền tảng.

Quyền đó không làm Platform Admin:

- trở thành Company Manager;
- trở thành thành viên của Company;
- được thực hiện nghiệp vụ tuyển dụng thay Company;
- được chỉnh sửa hồ sơ Company thay Company Manager trong luồng thông thường.

---

## BR-20 — Approval state và operational state là hai state dimension độc lập

Approval state trả lời Company đã được Platform Admin quyết định như thế nào.

Operational state trả lời Company hiện có được phép hoạt động hay không.

Vì vậy:

```text
APPROVED + INACTIVE
```

là trạng thái hợp lệ và có nghĩa Platform Admin đã approve nhưng Company Manager chưa hoàn tất activation.

---

# 11. State Transitions

| Hành động | Trước | Sau | Actor |
| --- | --- | --- | --- |
| Khởi tạo onboarding | Chưa có onboarding V02 | CM `PENDING_ACTIVATION`; Company `NOT_SUBMITTED + INACTIVE` | Company Manager |
| Submit Company | CM `PENDING_ACTIVATION`; Company `NOT_SUBMITTED + INACTIVE` | CM `PENDING_ACTIVATION`; Company `PENDING + INACTIVE` | Company Manager |
| Reject Company | CM `PENDING_ACTIVATION`; Company `PENDING + INACTIVE` | CM `PENDING_ACTIVATION`; Company `REJECTED + INACTIVE` | Platform Admin |
| Approve Company | CM `PENDING_ACTIVATION`; Company `PENDING + INACTIVE` | CM `PENDING_ACTIVATION`; Company `APPROVED + INACTIVE` | Platform Admin |
| Xác nhận chấp thuận | CM `PENDING_ACTIVATION`; Company `APPROVED + INACTIVE` | CM `ACTIVE`; Company `APPROVED + ACTIVE` | Company Manager |
| Resend xác nhận đã hết hạn | CM `PENDING_ACTIVATION`; Company `APPROVED + INACTIVE` | Không đổi state | Company Manager |
| Cập nhật hồ sơ được phép | CM `ACTIVE`; Company `APPROVED + ACTIVE` | Không đổi state | Company Manager |
| Khóa/chấm dứt Company | CM `ACTIVE`; Company `APPROVED + ACTIVE` | CM `TERMINATED`; Company `APPROVED + LOCKED` | Platform Admin |

Chỉ các transition được định nghĩa trong tài liệu này mới thuộc business contract của V02.

Không tự bổ sung:

- `REJECTED → PENDING`;
- `REJECTED → ACTIVE`;
- `APPROVED + INACTIVE → LOCKED`;
- `LOCKED → ACTIVE`;
- thay đổi Company Manager;
- multi-manager transition.

---

# 12. Authorization và ownership boundary

| Hành động | Actor được phép | Resource / Scope | Điều kiện |
| --- | --- | --- | --- |
| Khởi tạo onboarding | Người đăng ký Company Manager | Company của onboarding đó | Quan hệ `1 — 1` được thiết lập trong cùng onboarding |
| Cập nhật hồ sơ trước submit | Company Manager | Company của chính mình | Company `NOT_SUBMITTED + INACTIVE` |
| Submit Company | Company Manager | Company của chính mình | Đủ điều kiện F03 |
| Xem danh sách/chi tiết đăng ký | Platform Admin | Company đăng ký ở cấp nền tảng | Actor là Platform Admin |
| Approve Company | Platform Admin | Company `PENDING + INACTIVE` | Xét duyệt đúng snapshot |
| Reject Company | Platform Admin | Company `PENDING + INACTIVE` | Xét duyệt đúng snapshot |
| Xác nhận chấp thuận | Company Manager | Company của chính mình | Company `APPROVED + INACTIVE` |
| Resend xác nhận | Company Manager | Company của chính mình | Company vẫn đang chờ xác nhận và xác nhận cũ đã hết hạn |
| Xem/cập nhật hồ sơ active | Company Manager | Company của chính mình | Chỉ các field F09 cho phép |
| Khóa/chấm dứt Company | Platform Admin | Company `APPROVED + ACTIVE` | Actor là Platform Admin |

Company Manager không được:

- quản lý Company khác;
- tự approve hoặc reject Company;
- tự active Company;
- tự thay đổi trạng thái Company;
- tự thay Company Manager;
- truy cập dữ liệu tenant khác.

Platform Admin không được coi là Company Manager hoặc member của Company chỉ vì có quyền quản trị cấp nền tảng.

---

# 13. Multi-tenant boundary

Trong V02, mỗi Company là một tenant độc lập.

Nguyên tắc:

```text
Authenticated Company Manager
        ↓
Hệ thống xác định Company gắn với Company Manager
        ↓
Canonical Company tenant
        ↓
Chỉ resource thuộc Company đó mới nằm trong authorized scope
```

Các rule bắt buộc:

- Company Manager chỉ truy cập Company mà mình đại diện.
- Company Manager của Company A không được truy cập resource nội bộ của Company B.
- Việc client gửi Company identifier không phải bằng chứng authorization.
- Mọi resource doanh nghiệp ở version sau phải xác định được Company sở hữu.
- Platform Admin có platform-level scope khi thực hiện chức năng quản trị đã được định nghĩa, nhưng không trở thành tenant member.
- Frontend ẩn hoặc hiển thị thao tác không thay thế authorization của hệ thống.

V02 chỉ thiết lập tenant boundary. Các resource tuyển dụng cụ thể được bổ sung ở version sau.

---

# 14. Lifecycle invariants

1. Company Manager và Company luôn là hai thực thể nghiệp vụ riêng.
2. Company không có credentials độc lập.
3. Một Company Manager chỉ gắn với một Company.
4. Một Company chỉ gắn với một Company Manager.
5. Company Manager không được dùng cùng tài khoản như Candidate.
6. Company Manager không được active độc lập khỏi Company onboarding.
7. Company chưa submit không có hồ sơ xét duyệt đã chốt.
8. Submit tạo một snapshot duy nhất trong lifecycle V02.
9. Company `PENDING` không được chỉnh sửa hồ sơ đang xét duyệt.
10. Platform Admin phải xét duyệt dựa trên snapshot đã submit.
11. Reject là terminal trong onboarding V02.
12. Admin approve không làm Company active ngay.
13. Company chỉ active sau khi Company Manager xác nhận chấp thuận.
14. Company Manager và Company phải cùng active sau một activation thành công.
15. `businessRegistrationNumber` là bắt buộc và duy nhất.
16. `name` là bắt buộc nhưng không cần duy nhất.
17. Sau khi Company active, Company Manager không được đổi `name` hoặc `businessRegistrationNumber`.
18. Cập nhật hồ sơ được phép sau activation không tạo re-review trong V02.
19. Company Manager chỉ được quản lý tenant của chính mình.
20. Identifier Company từ client không tự tạo quyền truy cập.
21. Platform Admin có platform-level administration nhưng không trở thành Company member.
22. Khi Company bị khóa theo F10, Company Manager phải ở `TERMINATED`.
23. Company `LOCKED` theo F10 không có transition reactivate trong V02.
24. Khóa Company không xóa Company hoặc dữ liệu đã tồn tại.

---

# 15. Các quyết định chủ động defer

Các nội dung đã được xem xét nhưng chủ động không thuộc V02:

- xóa hoặc archive Company;
- lưu lịch sử nhiều vòng approve/reject/lock;
- audit workflow riêng cho các quyết định quản trị;
- các nghiệp vụ Recruiter, Job, Application và toàn bộ recruitment lifecycle;
- các chính sách chi tiết về thời lượng hiệu lực của yêu cầu xác nhận chấp thuận, miễn là vẫn giữ business rule rằng yêu cầu hết hạn không được dùng và Company Manager có thể resend theo F08.

Các nội dung trên không được tự implement như business behavior của V02.

Việc thay Company Manager, multi-manager hoặc Company không có Manager không phải nhánh deferred của V02; chúng trái với invariant `1 Company ↔ 1 Company Manager` đã chốt.

---

# 16. Các quyết định chưa chốt

> Không còn business decision chưa chốt ảnh hưởng implementation của V02.

Không được dùng data design hoặc implementation hiện tại để tạo thêm business requirement ngoài tài liệu này.

---

# 17. Definition of Business Completion

V02 được coi là hoàn thành về mặt nghiệp vụ khi:

- `F01` — onboarding Company Manager và Company được đáp ứng;
- `F02` — hoàn thiện hồ sơ Company trước submit được đáp ứng;
- `F03` — submit và snapshot được đáp ứng;
- `F04` — Platform Admin xem đăng ký Company được đáp ứng;
- `F05` — Platform Admin approve được đáp ứng;
- `F06` — Platform Admin reject được đáp ứng;
- `F07` — Company Manager xác nhận và activation được đáp ứng;
- `F08` — resend xác nhận hết hạn được đáp ứng;
- `F09` — quản lý hồ sơ Company active được đáp ứng;
- `F10` — khóa/chấm dứt Company được đáp ứng;
- toàn bộ `BR-01` đến `BR-20` được giữ;
- chỉ các state combination và transition hợp lệ được phép tồn tại trong lifecycle V02;
- authorization boundary được giữ;
- tenant boundary được giữ;
- lifecycle invariants luôn đúng;
- các chức năng ngoài phạm vi và đã defer không bị bổ sung ngoài ý muốn;
- không xuất hiện behavior ngoài boundary của V02.

Việc implementation chạy hoặc test pass không tự động đồng nghĩa với Business Completion nếu behavior chưa đáp ứng đầy đủ contract này.

---

# 18. Implementation Boundary

Tài liệu này là canonical business specification của V02.

Tài liệu này định nghĩa:

```text
WHAT MUST HAPPEN
```

không định nghĩa:

```text
HOW IT IS IMPLEMENTED
```

Tài liệu này không quy định endpoint, HTTP contract, controller/service, middleware implementation, database query, persistence schema, source-code structure hoặc test framework.

Các artifact dữ liệu và engineering phải phục vụ business truth trong tài liệu này, không được tự tạo thêm hoặc thay đổi requirement.

Nếu data design hoặc implementation mâu thuẫn với tài liệu này, tài liệu này là authority đối với business behavior cho tới khi được con người cập nhật và phê duyệt lại.
