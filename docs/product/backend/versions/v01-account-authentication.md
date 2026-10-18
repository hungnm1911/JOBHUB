# V1 — Tài khoản và vòng đời xác thực

## 1. Mục tiêu

V1 xây dựng nền tảng tài khoản và xác thực chung của hệ thống JOBHUB.

V1 chịu trách nhiệm cho:

- Tạo tài khoản Candidate.
- Xác thực email tài khoản.
- Đăng nhập.
- Đăng xuất.
- Duy trì phiên đăng nhập.
- Làm mới quyền truy cập khi phiên còn hợp lệ.
- Quên mật khẩu.
- Reset mật khẩu.
- Thu hồi phiên đăng nhập khi xảy ra các sự kiện bảo mật.
- Platform Admin quản lý trạng thái tài khoản ở cấp nền tảng.

V1 chỉ tập trung vào tài khoản và vòng đời xác thực.

Các nghiệp vụ liên quan đến Company, Recruiter, Candidate Profile, CV, Job và tuyển dụng không thuộc phạm vi V1.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

V1 bao gồm:

- Candidate tự đăng ký tài khoản.
- Xác thực email.
- Đăng nhập.
- Cấp quyền truy cập có thời hạn.
- Tạo và duy trì phiên đăng nhập.
- Làm mới quyền truy cập từ phiên còn hợp lệ.
- Đăng xuất phiên hiện tại.
- Quên mật khẩu.
- Reset mật khẩu.
- Thu hồi phiên đăng nhập.
- Platform Admin khóa tài khoản.
- Platform Admin chấm dứt tài khoản.

### 2.2. Ngoài phạm vi

V1 không bao gồm:

- Đăng ký Company.
- Đăng ký Company Manager cùng Company.
- Quản lý Company.
- Quản lý Recruiter.
- Bắt buộc Recruiter đổi mật khẩu lần đầu.
- Candidate Profile.
- CV.
- Job.
- Job Approval.
- Recruitment Team.
- Job Discovery.
- Application.
- Recruitment Pipeline.
- Conversation.
- Interview.
- Notification.
- Candidate Search.
- Job Invitation.
- Saved Jobs.
- Dashboard, thống kê và giám sát.

---

## 3. Actors

### 3.1. Candidate

Candidate là người dùng tìm việc.

Trong V1, Candidate có thể:

- Tự đăng ký tài khoản.
- Xác thực email.
- Đăng nhập.
- Đăng xuất.
- Quên mật khẩu.
- Reset mật khẩu.

### 3.2. Company Manager

Company Manager là loại tài khoản quản lý Company.

Company Manager vẫn là loại tài khoản có khả năng tự đăng ký trong hệ thống.

Tuy nhiên Company Manager không đăng ký tài khoản độc lập.

Việc tạo tài khoản Company Manager diễn ra đồng thời với việc đăng ký Company và thuộc boundary của Company Onboarding ở version sau.

Trong V1 chỉ xác định rằng:

- Hệ thống có loại tài khoản Company Manager.
- Company Manager sử dụng chung cơ chế xác thực của hệ thống.
- Company Manager sử dụng cơ chế xác thực email chung.
- V1 không cung cấp chức năng đăng ký Company Manager độc lập.

### 3.3. Platform Admin

Platform Admin là tài khoản quản trị cấp nền tảng.

Trong V1, Platform Admin có quyền:

- Quản lý trạng thái tài khoản trong phạm vi các chức năng được định nghĩa ở V1.
- Khóa tài khoản.
- Chấm dứt quyền truy cập của tài khoản.

---

## 4. Trạng thái tài khoản

Tài khoản có ba trạng thái:

- `ACTIVE`
- `LOCKED`
- `TERMINATED`

### 4.1. ACTIVE

Tài khoản đang hoạt động bình thường.

Tài khoản `ACTIVE` có thể sử dụng các chức năng yêu cầu đăng nhập nếu đồng thời đã xác thực email.

### 4.2. LOCKED

Tài khoản đang bị khóa.

Tài khoản `LOCKED`:

- Không được đăng nhập.
- Không được tiếp tục sử dụng các phiên đăng nhập hiện có.

`LOCKED` thể hiện việc tài khoản hiện không được phép truy cập hệ thống.

### 4.3. TERMINATED

Quyền truy cập của tài khoản đã bị chấm dứt.

Tài khoản `TERMINATED`:

- Không được đăng nhập.
- Không được tiếp tục sử dụng phiên đăng nhập cũ.

Việc chấm dứt tài khoản không đồng nghĩa với việc xóa toàn bộ thông tin tài khoản khỏi hệ thống.

---

## 5. Xác thực email và trạng thái tài khoản

Xác thực email và trạng thái tài khoản là hai vấn đề nghiệp vụ độc lập.

Xác thực email trả lời câu hỏi:

> Email của tài khoản đã được xác minh hay chưa?

Trạng thái tài khoản trả lời câu hỏi:

> Tài khoản hiện có được phép hoạt động trên hệ thống hay không?

Vì vậy một tài khoản có thể:

- Đã xác thực email và đang `ACTIVE`.
- Đã xác thực email nhưng đang `LOCKED`.
- Đã xác thực email nhưng đã `TERMINATED`.
- Chưa xác thực email nhưng chưa bị khóa hoặc chấm dứt.

Việc đã xác thực email không đảm bảo tài khoản luôn được phép truy cập hệ thống.

---

## 6. Điều kiện được đăng nhập

Một User chỉ được phép đăng nhập khi đồng thời thỏa mãn:

1. Thông tin đăng nhập hợp lệ.
2. Email đã được xác thực.
3. Tài khoản đang ở trạng thái `ACTIVE`.

Nếu một trong các điều kiện trên không được thỏa mãn, hệ thống từ chối đăng nhập.

---

# 7. Functional Requirements

## F01 — Candidate đăng ký tài khoản

### Actor

Candidate.

### Mục tiêu

Cho phép Candidate tự tạo tài khoản để sử dụng hệ thống.

### Tiền điều kiện

Candidate chưa có tài khoản sử dụng email đăng ký đó.

### Luồng chính

1. Candidate nhập thông tin đăng ký.
2. Hệ thống kiểm tra dữ liệu đăng ký.
3. Hệ thống kiểm tra email chưa được sử dụng.
4. Hệ thống tạo tài khoản Candidate.
5. Tài khoản được ghi nhận là chưa xác thực email.
6. Hệ thống khởi tạo quy trình xác thực email.
7. Hệ thống gửi thông tin xác thực tới email của Candidate.

### Kết quả

Candidate có tài khoản trên hệ thống.

Candidate chưa được đăng nhập cho đến khi hoàn tất xác thực email.

### Business Rules

- Candidate được tự đăng ký.
- Candidate luôn được tạo với vai trò Candidate.
- Candidate không được tự lựa chọn vai trò tài khoản.
- Email dùng để đăng nhập phải là duy nhất.
- Tài khoản mới phải thực hiện xác thực email.
- Đăng ký thành công không đồng nghĩa với việc đã đăng nhập.

### Registration input

Candidate registration accepts:

- `fullName`
- `email`
- `password`

The registration flow does not accept `avatarUrl`, `dateOfBirth`, or
`phoneNumber` as registration input in V1.

Candidate must not supply or select the account role.

The system always creates a self-registered Candidate with role:

`CANDIDATE`

### Password policy

For Candidate registration and Password Reset in V1:

- password length must be from 8 to 64 characters;
- no uppercase-letter requirement is imposed;
- no lowercase-letter requirement is imposed;
- no numeric-character requirement is imposed;
- no special-character requirement is imposed;
- password whitespace must not be silently trimmed or transformed.

The same password policy applies to F01 Candidate Registration and
F09 Password Reset.

---

## F02 — Xác thực email

### Actor

Candidate.

Cơ chế xác thực email này được thiết kế dùng chung để Company Manager có thể sử dụng khi nghiệp vụ đăng ký Company Manager được triển khai ở version sau.

### Mục tiêu

Xác minh rằng người sở hữu tài khoản có quyền kiểm soát địa chỉ email đã đăng ký.

### Tiền điều kiện

- User đã có tài khoản.
- Email chưa được xác thực.
- User có yêu cầu xác thực hợp lệ.

### Luồng chính

1. User nhận thông tin xác thực qua email.
2. User thực hiện xác thực.
3. Hệ thống kiểm tra yêu cầu xác thực.
4. Hệ thống kiểm tra yêu cầu còn thời hạn.
5. Nếu hợp lệ, hệ thống ghi nhận email đã được xác thực.
6. Yêu cầu xác thực vừa sử dụng không được sử dụng lại.

### Kết quả

Tài khoản được ghi nhận là đã xác thực email.

Nếu tài khoản đồng thời đang `ACTIVE` thì tài khoản đủ điều kiện về trạng thái để thực hiện đăng nhập.

### Business Rules

- Yêu cầu xác thực email có thời hạn.
- Yêu cầu xác thực chỉ được sử dụng một lần.
- Yêu cầu đã hết hạn không được chấp nhận.
- Yêu cầu không hợp lệ không được chấp nhận.
- Xác thực email không làm thay đổi trạng thái `LOCKED` hoặc `TERMINATED`.
- If the account email is already verified, the verification request is rejected
and no account state is changed.

---

## F03 — Đăng nhập

### Actor

User có tài khoản.

### Mục tiêu

Xác thực danh tính của User và bắt đầu một phiên đăng nhập mới.

### Tiền điều kiện

User đã có tài khoản.

### Luồng chính

1. User cung cấp thông tin đăng nhập.
2. Hệ thống xác định tài khoản tương ứng.
3. Hệ thống kiểm tra thông tin xác thực.
4. Hệ thống kiểm tra email đã được xác thực.
5. Hệ thống kiểm tra tài khoản đang `ACTIVE`.
6. Nếu tất cả điều kiện hợp lệ, hệ thống tạo phiên đăng nhập.
7. Hệ thống cấp thông tin xác thực cần thiết để User sử dụng hệ thống.

### Kết quả

Một phiên đăng nhập mới được tạo.

User có thể truy cập các chức năng được phép theo vai trò của mình.

### Trường hợp từ chối

Đăng nhập bị từ chối nếu:

- Không tồn tại tài khoản tương ứng.
- Thông tin xác thực không đúng.
- Email chưa được xác thực.
- Tài khoản đang `LOCKED`.
- Tài khoản đã `TERMINATED`.

### Business Rules

- Chỉ tài khoản `ACTIVE` và đã xác thực email được đăng nhập.
- Mỗi lần đăng nhập thành công tạo ra một phiên đăng nhập riêng.
- Một User có thể có nhiều phiên đăng nhập tồn tại đồng thời.

---

## F04 — Quản lý quyền truy cập ngắn hạn

### Actor

System.

### Mục tiêu

Cho phép một User đã đăng nhập chứng minh trạng thái xác thực khi sử dụng các chức năng được bảo vệ của hệ thống.

Sau khi đăng nhập thành công, hệ thống cấp quyền truy cập có thời hạn.

### Business Rules

Quyền truy cập:

- Thuộc về một User cụ thể.
- Gắn với một phiên đăng nhập cụ thể.
- Có thời gian hiệu lực giới hạn.
- Chỉ có giá trị khi phiên đăng nhập tương ứng vẫn còn hợp lệ.
- Không được coi là hợp lệ nếu phiên đăng nhập tương ứng đã bị thu hồi.

Quy tắc này áp dụng ngay cả khi bản thân quyền truy cập chưa hết thời hạn.

---

## F05 — Duy trì phiên đăng nhập

### Actor

System.

### Mục tiêu

Cho phép User tiếp tục phiên đăng nhập mà không phải nhập lại email và mật khẩu mỗi khi quyền truy cập ngắn hạn hết hạn.

Khi User đăng nhập thành công, hệ thống tạo một phiên đăng nhập.

### Business Rules

Một phiên đăng nhập:

- Thuộc về một User.
- Có thời hạn.
- Có thể được sử dụng để cấp lại quyền truy cập.
- Có thể bị thu hồi.
- Không còn giá trị sau khi hết hạn hoặc bị thu hồi.

---

## F06 — Làm mới quyền truy cập

### Actor

User đang có phiên đăng nhập hợp lệ.

### Mục tiêu

Cho phép User nhận quyền truy cập mới khi quyền truy cập hiện tại hết hạn nhưng phiên đăng nhập vẫn còn hiệu lực.

### Luồng chính

1. User yêu cầu làm mới quyền truy cập.
2. Hệ thống xác định phiên đăng nhập.
3. Hệ thống kiểm tra phiên còn tồn tại.
4. Hệ thống kiểm tra phiên chưa hết hạn.
5. Hệ thống kiểm tra phiên thuộc đúng User.
6. Hệ thống kiểm tra tài khoản vẫn tồn tại.
7. Hệ thống kiểm tra tài khoản vẫn `ACTIVE`.
8. Nếu hợp lệ, hệ thống cấp quyền truy cập mới.

### Trường hợp từ chối

Không cấp quyền truy cập mới nếu:

- Phiên không tồn tại.
- Phiên đã hết hạn.
- Phiên đã bị thu hồi.
- Thông tin phiên không hợp lệ.
- Tài khoản không tồn tại.
- Tài khoản không còn `ACTIVE`.

---

## F07 — Đăng xuất

### Actor

User đang đăng nhập.

### Mục tiêu

Cho phép User chủ động kết thúc phiên đăng nhập hiện tại.

### Luồng chính

1. User thực hiện đăng xuất.
2. Hệ thống xác định phiên đăng nhập hiện tại.
3. Hệ thống thu hồi phiên đó.
4. Phiên hiện tại không còn được sử dụng để tiếp tục truy cập hệ thống.

### Kết quả

User đã đăng xuất khỏi phiên hiện tại.

Muốn sử dụng lại hệ thống với phiên mới, User phải thực hiện đăng nhập lại.

### Business Rules

- Logout chỉ tác động tới phiên hiện tại.
- Logout không làm thay đổi trạng thái tài khoản.
- Logout không xóa tài khoản.
- Logout không tự động đăng xuất các phiên khác của cùng User.
- Phiên đã logout không được sử dụng để làm mới quyền truy cập.
- Quyền truy cập thuộc phiên đã logout không được tiếp tục chấp nhận.

---

## F08 — Quên mật khẩu

### Actor

Candidate trong phạm vi V1.

### Mục tiêu

Cho phép User bắt đầu quy trình khôi phục quyền truy cập khi quên mật khẩu.

### Luồng chính

1. User cung cấp email tài khoản.
2. Hệ thống xác định tài khoản tương ứng.
3. Hệ thống khởi tạo yêu cầu reset mật khẩu.
4. Nếu trước đó tồn tại yêu cầu reset mật khẩu chưa hoàn tất, yêu cầu cũ không còn được sử dụng.
5. Hệ thống gửi thông tin reset mật khẩu tới email của User.

### Kết quả

User nhận được khả năng thực hiện bước Reset Password.

### Business Rules

- Yêu cầu reset mật khẩu có thời hạn.
- Yêu cầu reset chỉ được sử dụng một lần.
- Một yêu cầu reset mới thay thế khả năng sử dụng yêu cầu reset cũ theo thiết kế V1.
- If the submitted email does not belong to an existing account, the externally
visible result must be indistinguishable from a valid forgot-password request.
- No password-reset token is created and no email is sent for a nonexistent account.

---

## F09 — Reset mật khẩu

### Actor

User có yêu cầu Reset Password hợp lệ.

### Mục tiêu

Cho phép User thiết lập mật khẩu mới.

### Tiền điều kiện

User có yêu cầu Reset Password:

- Hợp lệ.
- Chưa được sử dụng.
- Chưa hết hạn.

### Luồng chính

1. User gửi yêu cầu reset mật khẩu.
2. Hệ thống kiểm tra tính hợp lệ.
3. Hệ thống kiểm tra thời hạn.
4. User cung cấp mật khẩu mới.
5. Hệ thống cập nhật mật khẩu.
6. Yêu cầu Reset Password được kết thúc và không được sử dụng lại.
7. Hệ thống thu hồi toàn bộ phiên đăng nhập hiện tại của User.

### Kết quả

- Mật khẩu mới có hiệu lực.
- Các phiên đăng nhập trước đó không còn giá trị.
- User phải đăng nhập lại bằng mật khẩu mới.

### Business Rules

Reset Password luôn làm mất hiệu lực toàn bộ các phiên đăng nhập đang tồn tại của User.

### Password policy

For Candidate registration and Password Reset in V1:

- password length must be from 8 to 64 characters;
- no uppercase-letter requirement is imposed;
- no lowercase-letter requirement is imposed;
- no numeric-character requirement is imposed;
- no special-character requirement is imposed;
- password whitespace must not be silently trimmed or transformed.

The same password policy applies to F01 Candidate Registration and
F09 Password Reset.

---

## F10 — Platform Admin khóa tài khoản

### Actor

Platform Admin.

### Mục tiêu

Cho phép Platform Admin ngăn một tài khoản tiếp tục truy cập hệ thống.

### Luồng chính

1. Platform Admin lựa chọn tài khoản.
2. Platform Admin thực hiện khóa tài khoản.
3. Hệ thống chuyển tài khoản sang `LOCKED`.
4. Hệ thống thu hồi toàn bộ phiên đăng nhập của tài khoản.

### Kết quả

Tài khoản:

- Không thể đăng nhập mới.
- Không thể tiếp tục sử dụng các phiên đăng nhập trước đó.

### Business Rules

- Khóa tài khoản không xóa tài khoản.
- Thông tin tài khoản vẫn được giữ lại.
- Việc khóa tài khoản không thay đổi trạng thái xác thực email.
- Tất cả phiên hiện tại phải bị thu hồi khi account bị khóa.

---

## F11 — Platform Admin chấm dứt tài khoản

### Actor

Platform Admin.

### Mục tiêu

Chấm dứt quyền truy cập của một tài khoản trên nền tảng.

### Luồng chính

1. Platform Admin lựa chọn tài khoản.
2. Platform Admin thực hiện chấm dứt.
3. Hệ thống chuyển tài khoản sang `TERMINATED`.
4. Hệ thống thu hồi toàn bộ phiên đăng nhập của tài khoản.

### Kết quả

Tài khoản không còn được phép truy cập hệ thống.

### Business Rules

- `TERMINATED` không đồng nghĩa với hard delete tài khoản.
- Dữ liệu định danh của tài khoản vẫn được giữ lại.
- Tài khoản `TERMINATED` không được đăng nhập.
- Tất cả phiên hiện tại phải bị thu hồi.
- terminate:
- chỉ target CANDIDATE / COMPANY_MANAGER
- giữ nguyên emailVerifiedAt
- không hard delete User
- revoke ALL AuthSession của target
- không tạo session/token mới
- không unlock/reactivate

---

# 8. Session Lifecycle Invariants

Một User có thể có nhiều phiên đăng nhập đồng thời.

Mỗi lần đăng nhập thành công tạo một phiên riêng và các phiên của cùng một User độc lập với nhau.

Phạm vi thu hồi phiên theo từng sự kiện:

| Sự kiện | Phạm vi thu hồi |
| --- | --- |
| Logout | Chỉ phiên hiện tại |
| Reset Password | Tất cả phiên của User |
| Account `LOCKED` | Tất cả phiên của User |
| Account `TERMINATED` | Tất cả phiên của User |

Khi một phiên bị thu hồi:

- Phiên không được tiếp tục sử dụng.
- Không được làm mới quyền truy cập từ phiên đó.
- Quyền truy cập gắn với phiên đó không được tiếp tục chấp nhận.

---

# 9. Email Verification Lifecycle

Luồng nghiệp vụ tổng quát:

```text
Account created
      ↓
Email chưa xác thực
      ↓
Gửi yêu cầu xác thực
      ↓
User thực hiện xác thực
      ↓
Kiểm tra hợp lệ
      ↓
Email được xác thực
````

Yêu cầu xác thực email:

1. Có thời hạn.
2. Chỉ được sử dụng một lần.
3. Không còn giá trị sau khi đã sử dụng thành công.
4. Yêu cầu hết hạn không được chấp nhận.
5. Yêu cầu không hợp lệ không được chấp nhận.
6. Xác thực email không làm thay đổi trạng thái `LOCKED` hoặc `TERMINATED`.

---

# 10. Password Reset Lifecycle

Luồng nghiệp vụ tổng quát:

Forgot Password
      ↓
Khởi tạo yêu cầu reset
      ↓
Gửi email
      ↓
User mở yêu cầu
      ↓
Kiểm tra hợp lệ
      ↓
Nhập mật khẩu mới
      ↓
Reset Password
      ↓
Thu hồi toàn bộ phiên
      ↓
Đăng nhập lại


Các invariant:

* Yêu cầu Reset Password có thời hạn.
* Yêu cầu Reset Password chỉ được sử dụng một lần.
* Một yêu cầu reset mới làm mất khả năng sử dụng yêu cầu reset cũ chưa hoàn tất.
* Reset Password thành công làm mất hiệu lực toàn bộ phiên đang tồn tại của User.
* User phải đăng nhập lại bằng mật khẩu mới.

---

# 11. Business Rules tổng hợp

## BR-01 — Email đăng nhập

Mỗi tài khoản sử dụng một email làm định danh đăng nhập.

Email đăng nhập phải duy nhất trong hệ thống.

## BR-02 — Candidate tự đăng ký

Candidate được phép tự tạo tài khoản.

Candidate không được tự lựa chọn role khi đăng ký.

## BR-03 — Company Manager Registration

Company Manager được tự đăng ký trong hệ thống nhưng phải đăng ký cùng Company.

Luồng này không thuộc V1.

## BR-04 — Email Verification

Candidate phải xác thực email trước khi đăng nhập.

Cơ chế Email Verification được thiết kế dùng chung để Company Manager có thể sử dụng ở version sau.

## BR-05 — Email Verification độc lập với Account Status

Email đã được xác thực không có nghĩa tài khoản luôn `ACTIVE`.

Account có thể đã verify email nhưng đang `LOCKED` hoặc `TERMINATED`.

## BR-06 — Điều kiện Login

User chỉ được login khi:

```text
Email đã xác thực
AND
Account ACTIVE
AND
Thông tin đăng nhập hợp lệ
```

## BR-07 — Mỗi lần Login tạo một phiên

Mỗi lần đăng nhập thành công tạo một phiên đăng nhập mới.

Các phiên của cùng một User độc lập với nhau.

## BR-08 — Phiên có thời hạn

Mỗi phiên đăng nhập có thời hạn hiệu lực.

Phiên hết hạn không được tiếp tục sử dụng.

## BR-09 — Logout

Logout chỉ thu hồi phiên hiện tại.

Các phiên khác của User không bị ảnh hưởng.

## BR-10 — Reset Password

Reset Password thu hồi toàn bộ phiên của User.

## BR-11 — Lock Account

Khi tài khoản bị `LOCKED`, toàn bộ phiên của User bị thu hồi.

## BR-12 — Terminate Account

Khi tài khoản bị `TERMINATED`, toàn bộ phiên của User bị thu hồi.

## BR-13 — Phiên bị thu hồi

Khi một phiên đã bị thu hồi, mọi quyền truy cập gắn với phiên đó không được tiếp tục chấp nhận.

## BR-14 — Token/yêu cầu dùng một lần

Yêu cầu Email Verification và Password Reset:

* Có thời hạn.
* Chỉ sử dụng được một lần.
* Không được sử dụng sau khi đã hoàn thành thành công.

## BR-15 — Không hard delete khi quản lý trạng thái

`LOCKED` và `TERMINATED` chỉ thay đổi khả năng truy cập của tài khoản.

Không xóa tài khoản chỉ vì account bị khóa hoặc chấm dứt.

## BR-16 — mustChangePassword

Không có business flow bắt buộc đổi mật khẩu trong V1.

Nghiệp vụ này chỉ được áp dụng khi các version sau phát sinh loại tài khoản cần mật khẩu ban đầu hoặc mật khẩu tạm thời.

Candidate tự đăng ký trong V1 không thuộc luồng bắt buộc đổi mật khẩu.

---

# 12. Boundary với Company Manager

Company Manager được tự đăng ký trong hệ thống.

Tuy nhiên Company Manager phải đăng ký đồng thời với Company.

Luồng tổng quát thuộc version Company Onboarding:

```text
Company Manager
       ↓
Đăng ký Company
       +
Đăng ký tài khoản CM
       ↓
Tạo quan hệ CM với Company
       ↓
Tiếp tục vòng đời Company Onboarding
```

Vì vậy V1 không cung cấp nghiệp vụ:

```text
Company Manager đăng ký một tài khoản độc lập
```

V1 chỉ cung cấp nền tảng tài khoản và cơ chế xác thực dùng chung để Company Manager có thể sử dụng khi luồng Company Onboarding được triển khai.

---

# 13. Boundary của mustChangePassword

V1 không có chức năng bắt buộc User đổi mật khẩu sau khi đăng nhập.

Nghiệp vụ này được dành cho các version sau khi xuất hiện các trường hợp sử dụng mật khẩu ban đầu hoặc mật khẩu tạm thời.

Candidate tự đăng ký trong V1 không thuộc luồng bắt buộc đổi mật khẩu.

---

# 14. Danh sách chức năng V1

| ID  | Chức năng                              | Actor chính    |
| --- | -------------------------------------- | -------------- |
| F01 | Candidate đăng ký tài khoản            | Candidate      |
| F02 | Xác thực email                         | Candidate      |
| F03 | Đăng nhập                              | User           |
| F04 | Cấp quyền truy cập cho phiên đăng nhập | System         |
| F05 | Duy trì phiên đăng nhập                | System         |
| F06 | Làm mới quyền truy cập                 | User           |
| F07 | Đăng xuất                              | User           |
| F08 | Quên mật khẩu                          | Candidate      |
| F09 | Reset mật khẩu                         | User           |
| F10 | Khóa tài khoản                         | Platform Admin |
| F11 | Chấm dứt tài khoản                     | Platform Admin |

---

# 15. Definition of V1 Business Completion

V1 được coi là hoàn thành về mặt nghiệp vụ khi hệ thống hỗ trợ đầy đủ vòng đời:

```text
Candidate Register
        ↓
Verify Email
        ↓
Login
        ↓
Maintain Session
        ↓
Refresh Access
        ↓
Logout
```

đồng thời hỗ trợ quy trình:

```text
Forgot Password
        ↓
Reset Password
        ↓
Revoke All Sessions
```

và quản trị cấp nền tảng:

```text
Platform Admin
├── Lock Account
└── Terminate Account
        ↓
Revoke All Sessions
```

V1 không xử lý bất kỳ nghiệp vụ tuyển dụng nào.

Company Manager tồn tại như một loại tài khoản của hệ thống nhưng việc tạo tài khoản Company Manager được thực hiện cùng Company trong version Company Onboarding tiếp theo.

---

# 16. Implementation Boundary

Tài liệu này là canonical business/functional specification của V1.

Tài liệu này không quy định:

* REST endpoint.
* HTTP method.
* Request/response schema.
* Controller.
* Service.
* Route.
* Middleware implementation.
* Mongoose schema.
* MongoDB collection implementation.
* JWT payload.
* Token hashing implementation.
* Database query.
* Source-code structure.
* Test implementation.

Các quyết định kỹ thuật và persistence phải được mô tả trong tài liệu engineering/data riêng và không được phép thay đổi business rules của tài liệu này.

```

Có **một chi tiết tôi chủ động giữ nguyên thay vì “sửa cho đẹp”**: F08 vẫn ghi actor là **Candidate trong phạm vi V1**, vì source của bạn quy định chính xác như vậy, dù nội dung flow dùng từ tổng quát `User`. :contentReference[oaicite:3]{index=3}

Tương tự, tôi **không thêm Unlock Account**, resend verification, logout-all, change password, rate limit, password policy hay bất kỳ chức năng “thường nên có” nào, vì chúng không nằm trong V1 đã chốt. Đó chính là nguyên tắc ta muốn Cursor/Codex tuân thủ sau này: **canonical requirement nói gì thì implement cái đó, không tự hoàn thiện sản phẩm theo suy đoán của agent**. 
```
