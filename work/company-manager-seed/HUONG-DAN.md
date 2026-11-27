# Dữ liệu Company Manager — An Phúc

Database development: `jobhub`. Công ty: **Công ty Cổ phần Giải pháp An Phúc**.

Đăng nhập: **anh.nguyen@anphuc.example**. Mật khẩu và activation links chỉ lưu trong manifest riêng `.seed-manifests/company-manager-anphuc.json` (đã gitignore, quyền 0600), không đưa vào Git.

Mỗi nhóm có 3 Recruiter hoặc 3 Job. Seed không gửi email, không thay đổi tài khoản hay catalog sẵn có. Tên và thông tin liên hệ là dữ liệu giả lập.

## Recruiter

| Tình huống | Tên |
|---|---|
| Đang hoạt động; Primary/Supporting để quản lý team và phân công | Trần Quốc Huy · Lê Thu Hà · Phạm Hoàng Nam |
| Đang hoạt động, chưa có trách nhiệm; thêm vào team, nhận bàn giao hoặc khóa trực tiếp | Đặng Ngọc Mai · Võ Minh Khang · Nguyễn Thảo Vy |
| Chưa thiết lập mật khẩu; activation link còn hạn, gửi lại kích hoạt | Bùi Quỳnh Anh · Dương Thanh Tùng · Hoàng Bảo Trâm |
| Chưa thiết lập mật khẩu; link kích hoạt đã hết hạn, gửi lại kích hoạt | Lâm Gia Hân · Phan Đức Anh · Trịnh Khánh Linh |
| Bị khóa tại công ty; có thể mở khóa membership | Ngô Hải Đăng · Đỗ Phương Nhi · Mai Tuấn Kiệt |
| Đã chấm dứt membership; chỉ xem lịch sử | Hồ Thanh Phong · Huỳnh Bích Ngọc · Vũ Đức Minh |
| User bị khóa ở nền tảng, membership vẫn ACTIVE; có Job cần khôi phục Primary | Lý Minh Châu · Tạ Quang Huy · Trương Ngọc Ánh |
| User bị chấm dứt ở nền tảng; có Job cần khôi phục Primary | Đào Thành Đạt · Cao Mỹ Duyên · Tô Anh Tuấn |
| Bàn giao trước khi khóa: Primary của DRAFT, PENDING_APPROVAL và PUBLISHED | Nguyễn Quang Vinh · Phạm Hà My · Lê Hữu Phúc |
| Bàn giao trước khi chấm dứt: Primary của DRAFT, PENDING_APPROVAL và PUBLISHED | Trần Bảo Ngân · Đặng Nhật Minh · Võ Thu Trang |
| Chỉ là Supporting trên Job đang tuyển, có hồ sơ được giao; khóa để kiểm tra gỡ team và Unassign | Phan Ngọc Diệp · Bùi Anh Dũng · Hoàng Yến Nhi |
| Chỉ có team/hồ sơ terminal trên Job đã đóng; khóa không làm mất lịch sử | Đỗ Gia Bảo · Lâm Thùy Dương · Ngô Quốc Khánh |

## Job

| Tình huống | Ba Job |
|---|---|
| Duyệt và đăng | Frontend Engineer (React) – Cổng dịch vụ khách hàng (`62e49f20413688971b5d4bf5`)<br>Backend Developer (Node.js) – Cổng dịch vụ khách hàng (`496504bc746d8b164b2c5aa0`)<br>Data Engineer (Python, SQL) – Cổng dịch vụ khách hàng (`6c9b334389ce6717f6baae1c`) |
| Từ chối và xóa | Frontend Engineer (React) – Giải pháp đặt lịch trực tuyến (`5218c7963196c53ff7aa3c93`)<br>Backend Developer (Node.js) – Giải pháp đặt lịch trực tuyến (`1674a4da3e904bdea7c45f89`)<br>Data Engineer (Python, SQL) – Giải pháp đặt lịch trực tuyến (`bcc2b6924275ac9c84b05d52`) |
| Thêm/gỡ Supporting, thay Primary, phân công đầy đủ trạng thái | Frontend Engineer (React) – Nền tảng bán lẻ đa kênh (`12efe32fc02544d9aaf853b6`)<br>Backend Developer (Node.js) – Nền tảng bán lẻ đa kênh (`ceeafab1d1d45ad50d831699`)<br>Data Engineer (Python, SQL) – Nền tảng bán lẻ đa kênh (`afa15b9fe2e52928ff2f6ee6`) |
| Đóng Job đang tuyển; chưa có hồ sơ | Frontend Engineer (React) – Hệ thống quản lý đơn hàng (`93f72c88f6130ea5eba82d9a`)<br>Backend Developer (Node.js) – Hệ thống quản lý đơn hàng (`a5ff17d5ea4afcf07834b3d1`)<br>Data Engineer (Python, SQL) – Hệ thống quản lý đơn hàng (`833b001c154f0e8b5a7c41a5`) |
| Đã đóng; team chỉ đọc nhưng vẫn phân công hồ sơ non-terminal | Frontend Engineer (React) – Cổng đối tác vận chuyển (`71aa6a683e4012dfd3387ee7`)<br>Backend Developer (Node.js) – Cổng đối tác vận chuyển (`c81579095e1668277d752cab`)<br>Data Engineer (Python, SQL) – Cổng đối tác vận chuyển (`8cfe33d966faecc44085e9ba`) |
| Đã hết hạn; team chỉ đọc nhưng vẫn phân công hồ sơ non-terminal | Frontend Engineer (React) – Kho dữ liệu vận hành (`7f4607f01a24a045ff8980d7`)<br>Backend Developer (Node.js) – Kho dữ liệu vận hành (`b8eadcc2a8713e2cddf5a7c3`)<br>Data Engineer (Python, SQL) – Kho dữ liệu vận hành (`ad82aeec33d866ce0225caa2`) |
| Persisted PUBLISHED nhưng deadline đã qua; badge Hết hạn và team chỉ đọc | Frontend Engineer (React) – Ứng dụng chăm sóc khách hàng (`ce9f1ec28b3dd85406f75c63`)<br>Backend Developer (Node.js) – Ứng dụng chăm sóc khách hàng (`87559e33c9c57ad787db39e9`)<br>Data Engineer (Python, SQL) – Ứng dụng chăm sóc khách hàng (`fea4644b610ffdf83330162d`) |
| Team và Assignee lịch sử; không sửa hồ sơ terminal | Frontend Engineer (React) – Hệ thống thanh toán nội bộ (`a0c569261381e48f6b7cf137`)<br>Backend Developer (Node.js) – Hệ thống thanh toán nội bộ (`242a80c62c4fdf0a9c4525c2`)<br>Data Engineer (Python, SQL) – Hệ thống thanh toán nội bộ (`0deb167977dc478f7a35f6f9`) |
| Thay Primary khi User cũ bị Platform lock; hồ sơ đã Unassign | Frontend Engineer (React) – Dịch vụ kết nối đại lý (`3c8fb97eb2971992e26ac674`)<br>Backend Developer (Node.js) – Dịch vụ kết nối đại lý (`6139f4e97037087fb4dad27f`)<br>Data Engineer (Python, SQL) – Dịch vụ kết nối đại lý (`3c19283e4bc1353eb59eef5b`) |
| Thay Primary khi User cũ bị Platform terminate; hồ sơ đã Unassign | Frontend Engineer (React) – Nền tảng quản lý hợp đồng (`757e98adbc0d38b2969cb347`)<br>Backend Developer (Node.js) – Nền tảng quản lý hợp đồng (`381f7e03766a8d01743d5d70`)<br>Data Engineer (Python, SQL) – Nền tảng quản lý hợp đồng (`f96d2e232b22dfb74de30cc5`) |
| Job nháp xuất hiện bằng ID trong bàn giao, không lộ nội dung cho CM | Frontend Engineer (React) – Ứng dụng quản lý chi phí (`d31ec39dc4cd40b87ae7e9a1`)<br>Backend Developer (Node.js) – Ứng dụng quản lý chi phí (`3edd56378c256e95644624d7`)<br>Data Engineer (Python, SQL) – Ứng dụng quản lý chi phí (`a472826ffbe18076e398f9ed`) |
| Bàn giao Job chờ duyệt trước khi khóa Recruiter | Frontend Engineer (React) – Cổng tuyển dụng nội bộ (`9c1cb2c4027def54076a4fbc`)<br>Backend Developer (Node.js) – Cổng tuyển dụng nội bộ (`60c01e499f765f5f911c49bc`)<br>Data Engineer (Python, SQL) – Cổng tuyển dụng nội bộ (`b29a1aaf0cc02ae4b3ab86de`) |
| Bàn giao Job đang tuyển và Unassign hồ sơ trước khi khóa Recruiter | Frontend Engineer (React) – Hệ thống quản lý nhà cung cấp (`596cb297d612b8347bbf490c`)<br>Backend Developer (Node.js) – Hệ thống quản lý nhà cung cấp (`a6eb57aa305eb975474f1694`)<br>Data Engineer (Python, SQL) – Hệ thống quản lý nhà cung cấp (`9896a87cb6f1bcaa459f3bf7`) |
| Job nháp trong bàn giao chấm dứt Recruiter | Frontend Engineer (React) – Dịch vụ tra cứu giao dịch (`283096c55e84a5c24c335bcc`)<br>Backend Developer (Node.js) – Dịch vụ tra cứu giao dịch (`1b580c57afd210976ae1299e`)<br>Data Engineer (Python, SQL) – Dịch vụ tra cứu giao dịch (`791765c7fa2b1cb7926b0917`) |
| Bàn giao Job chờ duyệt trước khi chấm dứt Recruiter | Frontend Engineer (React) – Nền tảng học trực tuyến (`e87603145f985075d414962c`)<br>Backend Developer (Node.js) – Nền tảng học trực tuyến (`6167384bb7e892bfde8dd9be`)<br>Data Engineer (Python, SQL) – Nền tảng học trực tuyến (`c8a50fd639f436ee7e3e34ea`) |
| Bàn giao Job đang tuyển và Unassign hồ sơ trước khi chấm dứt Recruiter | Frontend Engineer (React) – Ứng dụng quản lý bảo hành (`6d5cd4d4ef5dea0cd343023a`)<br>Backend Developer (Node.js) – Ứng dụng quản lý bảo hành (`54cebe9ecba962c56f22e4b8`)<br>Data Engineer (Python, SQL) – Ứng dụng quản lý bảo hành (`fac01f6210d29c7a77067a54`) |

## Hồ sơ và thứ tự thao tác

- Trong từng Job thuộc nhóm phân công có đủ APPLIED, SCREENING, CONTACTED, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED ở cả hai trạng thái có/chưa có Assignee; HIRED, REJECTED, WITHDRAWN để thử trạng thái chỉ đọc. Mỗi Candidate chỉ có một Application/Job. CV có PDF thật, snapshot thuộc đúng Candidate; không sửa CV của người dùng sẵn có.
- Thử thêm Supporting trước, sau đó thay Primary bằng Supporting hiện tại; có thể giữ hoặc bỏ Primary cũ. Nhóm “chưa có trách nhiệm” có sẵn người nhận mới.
- Hai nhóm bàn giao có mỗi người 3 Job: nháp, chờ duyệt và đang tuyển. Cần chọn đủ replacement cho tất cả ID. Với DRAFT, CM chỉ thấy ID/trạng thái trong preview; không được đọc tiêu đề/nội dung. Sau bàn giao, hồ sơ non-terminal của người rời team trở về Unassigned.
- Nhóm Platform lock/terminate vẫn giữ membership ACTIVE và team history; hồ sơ non-terminal đã Unassign. CM không mở khóa User ở nền tảng nhưng có thể khôi phục Primary qua team.
- Job CLOSED/EXPIRED và PUBLISHED đã quá deadline vẫn cho phân công non-terminal; team chỉ đọc. Hồ sơ terminal không có action phân công.
- Homepage: số chờ duyệt ban đầu 12; persisted PUBLISHED 21, trong đó 3 Job quá deadline. CM không thấy 6 DRAFT trong danh sách Job.
- Kiểm tra search, sort, phân trang bằng 36 Recruiter, 42 Job CM nhìn thấy, và danh sách hồ sơ. Thử sửa employeeCode trùng mã AP1001; thử tạo Recruiter trùng email của người có sẵn để kiểm tra lỗi. Các form rỗng có thể kiểm tra trực tiếp trên FE.
- Để kiểm tra 409 dữ liệu cũ: mở cùng hồ sơ/Job ở hai tab, đổi phân công ở tab thứ nhất rồi thao tác từ tab thứ hai. Lỗi mạng, SMTP/Cloudinary và tenant từ chối cần thao tác thực tế, không thể tạo thành một trạng thái dữ liệu cố định.
- Email dùng miền .example: activation link seed có trong manifest, nhưng việc nhận email resend/reset/tạo Recruiter cần địa chỉ hộp thư thật do bạn nhập. Seed không tự gửi mail đến người khác. Link activation hết hạn có thể đã bị MongoDB TTL xóa; khi đó UI vẫn hiện chờ kích hoạt và resend vẫn là luồng cần thử.
- Thử cập nhật hồ sơ công ty, mô tả rich text, logo/banner bằng ảnh của bạn; tên và mã số doanh nghiệp ở chế độ chỉ đọc. Chưa seed ảnh thương hiệu nên có thể thử trạng thái chưa có ảnh và upload mới.

## Chạy lại

Từ `backend/`:

```sh
node ../work/company-manager-seed/seed.mjs --dry-run
node ../work/company-manager-seed/seed.mjs --verify
```

`--apply` chỉ tạo bộ dữ liệu lần đầu trong transaction. Khi manifest đã applied, chỉ đọc kiểm tra, không reset tiến trình bạn đang test. Không có lệnh xóa/reset tự động.

Số lượng lúc khởi tạo: 50 User, 1 Company, 37 CompanyMember, 48 Job, 13 CandidateCV, 261 Application, 93 CandidateAvailability, 93 InterviewSchedule, 6 AuthToken.
