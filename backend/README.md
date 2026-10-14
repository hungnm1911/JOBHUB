# JOBHUB Backend

Backend của JOBHUB là REST API và hệ thống phân phối realtime cho nền tảng tuyển dụng, được xây dựng bằng Node.js, Express, MongoDB/Mongoose và Socket.IO.

Hệ thống hiện hỗ trợ vòng đời tài khoản, Company và nhân sự tuyển dụng; danh mục dùng chung; Job và đội ngũ tuyển dụng; hồ sơ/CV ứng viên; tìm kiếm việc và CV công khai; Application, pipeline, chat, lịch phỏng vấn, thông báo và Job Invitation.

> [!IMPORTANT]
> README này là tài liệu vận hành và định hướng kỹ thuật. Yêu cầu nghiệp vụ chính thức nằm trong [`docs/product/versions/`](../docs/product/versions/), hợp đồng dữ liệu nằm trong [`docs/data/versions/`](../docs/data/versions/), còn trạng thái triển khai mới nhất được tra cứu từ [Project Status](../docs/project-status/index.md). Việc một endpoint đã có trong mã nguồn không đồng nghĩa toàn bộ phiên bản sản phẩm chứa endpoint đó đã hoàn tất nghiệm thu.

## Mục lục

- [Trạng thái hiện tại](#trạng-thái-hiện-tại)
- [Chức năng chính](#chức-năng-chính)
- [Công nghệ](#công-nghệ)
- [Kiến trúc](#kiến-trúc)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt và chạy local](#cài-đặt-và-chạy-local)
- [Biến môi trường](#biến-môi-trường)
- [Các script](#các-script)
- [Quy ước API](#quy-ước-api)
- [Danh mục endpoint](#danh-mục-endpoint)
- [Realtime với Socket.IO](#realtime-với-socketio)
- [Upload và lưu trữ tệp](#upload-và-lưu-trữ-tệp)
- [Migration dữ liệu](#migration-dữ-liệu)
- [Logging và xử lý lỗi](#logging-và-xử-lý-lỗi)
- [Kiểm thử và kiểm tra chất lượng](#kiểm-thử-và-kiểm-tra-chất-lượng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Triển khai production](#triển-khai-production)
- [Tài liệu nguồn chuẩn](#tài-liệu-nguồn-chuẩn)

## Trạng thái hiện tại

Theo [Product Roadmap](../docs/product/roadmap.md):

| Phiên bản | Phạm vi | Trạng thái |
| --- | --- | --- |
| V1 | Tài khoản và vòng đời xác thực | `COMPLETED AND VERIFIED` |
| V2 | Company onboarding và quản trị cấp nền tảng | `IN PROGRESS` |
| V3 | Quản lý nhân sự tuyển dụng của Company | `COMPLETED AND VERIFIED` |
| V4 | Danh mục chuẩn của nền tảng | `COMPLETED AND VERIFIED` |
| V4.1 | Danh mục địa giới hành chính Việt Nam hai cấp | `COMPLETED / ACCEPTED` |
| V4.2 | Structured Salary, metadata catalog và tìm kiếm kỹ năng | `COMPLETED / ACCEPTED` |
| V5 | Job và vòng đời phê duyệt Job | `COMPLETED AND VERIFIED` |
| V6 | Recruitment Team và chuyển giao trách nhiệm | `COMPLETED AND VERIFIED` |
| V7 | Candidate Profile và thư viện CV | `COMPLETED AND VERIFIED` |
| V8 | Job Discovery | `IN PROGRESS` |
| V9 | Candidate chủ động Apply và tạo Application | `COMPLETED AND VERIFIED` |
| V10 | Phân công Application và Recruitment Pipeline | `COMPLETED AND VERIFIED` |
| V11 | Conversation và Chat thuộc Application | `COMPLETED AND VERIFIED` |
| V12 | Interview Schedule | `IN PROGRESS` |
| V13 | Notification và phân phối realtime | `IN PROGRESS` |
| V14 | Candidate Search trên CV `PUBLIC` | `COMPLETED AND VERIFIED` |
| V15 | Job Invitation và nhánh Recruiter săn ứng viên | `COMPLETED AND VERIFIED` |
| V16–V17 | Saved Jobs; dashboard, thống kê và giám sát | `PLANNED` |

Các trạng thái `IN PROGRESS` phản ánh việc một phần lớn chức năng có thể đã hiện diện nhưng cổng nghiệm thu cuối hoặc phạm vi còn lại chưa đóng. Xem từng status leaf từ [điểm vào Project Status](../docs/project-status/index.md) trước khi dựa vào một năng lực cho production.

## Chức năng chính

- Đăng ký Candidate và Company Manager; xác minh email, đăng nhập, refresh, đăng xuất, quên/đặt lại mật khẩu và kích hoạt Recruiter.
- Onboarding Company, gửi hồ sơ duyệt, xác nhận phê duyệt; Platform Admin duyệt/từ chối/khóa Company và quản lý vòng đời tài khoản.
- Company Manager tạo, xem, khóa, mở khóa, chấm dứt Recruiter và khởi tạo đặt lại mật khẩu.
- Danh mục Field/Position, Experience Level và địa giới Việt Nam theo Province Open API v1.
- Tạo, sửa, gửi duyệt, phê duyệt, từ chối, đóng/xóa Job; quản lý Primary/Supporting Recruiter và chuyển giao trách nhiệm.
- Job Discovery công khai với lọc/sắp xếp; Structured Salary và location hai cấp.
- Candidate Profile; CV generated/uploaded; preview/download; trạng thái, visibility, default CV và archive.
- Candidate Search trên CV `PUBLIC` dành cho Recruiter đủ quyền.
- Direct Apply, snapshot CV đã nộp, thay CV, rút Application và danh sách Application của Candidate.
- Phân công/reassign/unassign Application, Recruitment Pipeline và workspace của Recruiter.
- Conversation/Message gắn với Application, lịch sử chat và fan-out Message realtime.
- Candidate Availability, đề xuất lịch phỏng vấn, confirm/decline/cancel và các quy tắc đồng thời liên quan.
- Notification bền vững, unread count/open, recovery worker và fan-out realtime best-effort.
- Recruiter gửi/quản lý/revoke Job Invitation; Candidate xem/reject/accept; worker vật chất hóa hết hạn.
- Request tracing, error handler tập trung, graceful shutdown và kiểm tra hạ tầng lúc khởi động.

## Công nghệ

| Nhóm | Công nghệ |
| --- | --- |
| Runtime | Node.js, JavaScript ES Modules |
| HTTP | Express 5, CORS |
| Database | MongoDB, Mongoose 9 |
| Realtime | Socket.IO 4 |
| Xác thực | JWT, refresh credential theo session, bcryptjs |
| Validation | Zod, middleware theo route, invariant tại service/model |
| File/PDF | Multer, `file-type`, Cloudinary, `pdf-lib`, Fontkit |
| Email | Nodemailer/SMTP |
| Kiểm thử | Vitest, Supertest, MongoDB Memory Server |
| Chất lượng mã | ESLint, architecture verifier riêng của repository |

## Kiến trúc

Backend tuân theo một chiều phụ thuộc chính:

```text
route -> middleware -> controller -> service -> model/database
                                      |
                                      +-> config/client/utility được phê duyệt

entry point -> worker -> service -> model/database
entry point -> Socket.IO facade
service sau khi commit -> Socket.IO facade (best-effort)
```

Các owner quan trọng:

- `index.js`: khởi động/dừng tiến trình, kiểm tra hạ tầng, HTTP server, Socket.IO và worker.
- `src/app.js`: tạo Express app, middleware toàn cục, root router, 404 và error handler cuối cùng.
- `src/routes/index.js`: mount toàn bộ feature router dưới `/api`.
- `src/controllers/`: biên HTTP; đọc input, gọi service và tạo response.
- `src/services/`: workflow và validation nghiệp vụ; làm việc trực tiếp với model theo kiến trúc hiện tại.
- `src/models/`: schema/model Mongoose và invariant persistence.
- `src/sockets/`: xác thực kết nối, room theo User và payload realtime.
- `src/workers/`: lịch chạy Notification recovery và Job Invitation expiration.

Repository hiện không dùng repository layer. Quy tắc chi tiết nằm trong [Backend Engineering Conventions](../docs/engineering/backend-conventions.md) và [Architecture](../docs/engineering/architecture.md).

### Trình tự khởi động

1. Nạp và kiểm tra biến môi trường từ `src/config/index.js`.
2. Kết nối MongoDB.
3. Kiểm tra/khởi tạo các collection và index được phép; riêng strict Salary guard chỉ được kiểm tra, không tự áp dụng.
4. Kiểm tra kết nối Cloudinary.
5. Mở HTTP server.
6. Gắn Socket.IO vào cùng HTTP server.
7. Khởi động Notification recovery worker và Job Invitation expiration worker.

Nếu một bước bắt buộc thất bại, tiến trình sẽ dừng thay vì phục vụ trong trạng thái thiếu hạ tầng.

## Yêu cầu hệ thống

- Node.js `>= 20.19.0` (Mongoose 9 trong lockfile yêu cầu mức này).
- npm, sử dụng cùng `package-lock.json` đã commit.
- MongoDB chạy dưới dạng replica set, kể cả local, vì các workflow nghiệp vụ sử dụng multi-document transaction.
- Tài khoản Cloudinary hợp lệ.
- SMTP server/tài khoản gửi email.
- Truy cập `https://provinces.open-api.vn/api/v1/` cho các thao tác dùng danh mục Location V4.1.

## Cài đặt và chạy local

### 1. Cài dependency

Từ thư mục repository:

```bash
cd backend
npm ci
```

### 2. Tạo file cấu hình

```bash
cp .env.example .env
```

Điền đầy đủ các biến bắt buộc trong `.env`. Không commit file này hoặc bất kỳ secret thật nào.

### 3. Chuẩn bị MongoDB

`MONGODB_URI` phải trỏ đến MongoDB replica set. Ví dụ hình thức URI local:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/jobhub?replicaSet=rs0
```

Với database hoàn toàn mới, phải áp dụng strict Structured Salary guard trước lần khởi động backend đầu tiên:

```bash
node scripts/run-migration.js v42-legacy-salary-cutover --preflight
node scripts/run-migration.js v42-legacy-salary-cutover
```

Khởi tạo bộ Experience Level chuẩn nếu database chưa có:

```bash
node scripts/run-migration.js v4-experience-level-dataset
```

Migration không chạy ngầm khi server khởi động. Với database đã có dữ liệu, đọc kỹ [phần Migration dữ liệu](#migration-dữ-liệu) và status/data contract tương ứng trước khi chạy.

### 4. Chạy server

Chế độ development, tự reload khi mã nguồn thay đổi:

```bash
npm run dev
```

Hoặc chạy trực tiếp:

```bash
npm start
```

Mặc định HTTP API và Socket.IO cùng phục vụ tại `http://localhost:8000`; REST API có prefix `/api`.

### 5. Kiểm tra nhanh

```bash
curl http://localhost:8000/api/
```

Response mẫu:

```json
{
  "success": true,
  "message": "Hello World",
  "timestamp": 1775472000000
}
```

## Biến môi trường

### Biến bắt buộc

Các biến dưới đây đang được `src/config/index.js` yêu cầu phải có giá trị không rỗng:

| Biến | Ý nghĩa | Giá trị local gợi ý |
| --- | --- | --- |
| `NODE_ENV` | Môi trường chạy | `development` |
| `PORT` | Cổng HTTP/Socket.IO | `8000` |
| `MONGODB_URI` | URI MongoDB | URI replica set local hoặc Atlas |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | Timeout chọn MongoDB server | `10000` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | giá trị từ Cloudinary |
| `CLOUDINARY_API_KEY` | Cloudinary API key | secret cấu hình |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | secret cấu hình |
| `BYTES_PER_MEGABYTE` | Hệ số đổi MB sang byte | `1048576` |
| `MAX_FILE_SIZE_MB` | Giới hạn upload chung | `10` |
| `JWT_SECRET` | Secret ký access token | chuỗi ngẫu nhiên dài |
| `JWT_EXPIRES_IN` | TTL access token | `15m` |
| `JWT_ALGORITHM` | Thuật toán JWT | `HS256` |
| `JWT_INVITE_SECRET` | Secret cho invite/activation token | secret khác `JWT_SECRET` |
| `JWT_INVITE_EXPIRES_IN` | TTL invite token | `24h` |
| `BCRYPT_SALT_ROUNDS` | Cost của bcrypt | `10` |
| `ADMIN_EMAIL` | Email Platform Admin cấu hình | email hợp lệ |
| `ADMIN_PASSWORD` | Mật khẩu Platform Admin cấu hình | secret mạnh |
| `SMTP_HOST` | SMTP host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Dùng TLS trực tiếp | `false` với port 587 |
| `SMTP_USER` | SMTP username | tài khoản SMTP |
| `SMTP_PASS` | SMTP password/app password | secret SMTP |
| `MAIL_FROM_NAME` | Tên người gửi | `JobHub Admin` |

> [!NOTE]
> `ADMIN_EMAIL` và `ADMIN_PASSWORD` hiện là cấu hình bắt buộc, nhưng seed scaffolding không tự tạo tài khoản admin khi server chạy. Việc provision tài khoản phải theo quy trình vận hành riêng; không đưa credential vào tài liệu hoặc mã nguồn.

### Biến tùy chọn có default

| Biến | Default | Ý nghĩa |
| --- | --- | --- |
| `APP_BASE_URL` | `http://localhost:8000` | Origin API dùng để tạo link trong email; không thêm `/api` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Danh sách origin frontend, phân cách bằng dấu phẩy |
| `EMAIL_VERIFICATION_EXPIRES_IN_MS` | `86400000` | TTL xác minh email |
| `PASSWORD_RESET_EXPIRES_IN_MS` | `3600000` | TTL đặt lại mật khẩu |
| `COMPANY_APPROVAL_CONFIRMATION_EXPIRES_IN_MS` | `86400000` | TTL xác nhận phê duyệt Company |
| `AUTH_SESSION_EXPIRES_IN_MS` | `604800000` | TTL AuthSession |
| `NOTIFICATION_RECOVERY_INTERVAL_MS` | `60000` | Chu kỳ recovery Notification |
| `NOTIFICATION_RECOVERY_BATCH_SIZE` | `100` | Kích thước batch recovery |
| `JOB_INVITATION_EXPIRATION_INTERVAL_MS` | `60000` | Chu kỳ vật chất hóa Invitation hết hạn |
| `LOG_LEVEL` | `debug` ở development, `info` ở môi trường khác | `silent`, `error`, `warn`, `info` hoặc `debug` |

`CORS_ALLOWED_ORIGINS` chỉ nhận HTTP(S) origin, không có path/query/credential. Ví dụ:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://jobhub.example.com
```

## Các script

Chạy từ thư mục `backend/`:

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy bằng Nodemon và reload khi file thay đổi |
| `npm start` | Chạy production entry point bằng Node.js |
| `npm run lint` | Chạy ESLint |
| `npm run lint:fix` | Tự sửa các lỗi ESLint được hỗ trợ |
| `npm test` | Chạy toàn bộ test một lần bằng Vitest |
| `npm run test:watch` | Chạy Vitest ở watch mode |
| `npm run verify:architecture` | Kiểm tra các ràng buộc kiến trúc xác định |
| `npm run verify:agent` | Cổng backend chung: lint + architecture + toàn bộ test |

## Quy ước API

### Base URL

```text
http://localhost:8000/api
```

### Xác thực HTTP

Các route được bảo vệ dùng access token trong header:

```http
Authorization: Bearer <access-token>
```

`POST /api/auth/login` trả về access token, refresh token và thông tin session. Refresh token được gửi trong JSON body đến `POST /api/auth/refresh`; server lưu hash của refresh credential và access token được ràng buộc với session. `POST /api/auth/logout` yêu cầu access token hiện tại.

Ngoài xác thực, từng route còn kiểm tra role, trạng thái User, Company, CompanyMember, quyền trên Job/Application và các điều kiện nghiệp vụ tại thời điểm commit.

### Request ID

Mỗi response có header:

```http
X-Request-Id: <request-id>
```

Giá trị này liên kết response với access log và error log tương ứng. Frontend được phép đọc header qua CORS.

### Lỗi

Lỗi có dạng thống nhất:

```json
{
  "error": {
    "message": "Route not found",
    "details": {}
  }
}
```

`details` chỉ xuất hiện khi lỗi có dữ liệu chi tiết. Stack trace chỉ được trả về ngoài production. Các lỗi upload quá kích thước trả `413`; loại tệp không hỗ trợ thường trả `415`; route không tồn tại trả `404`.

## Danh mục endpoint

Danh sách dưới đây phản ánh router hiện tại. Request body, query, state transition và authorization chi tiết phải theo Product Specification/Data Contract của phiên bản tương ứng và các validator trong mã nguồn.

Ký hiệu quyền:

- **Public**: không bắt buộc access token.
- **Authenticated**: User hợp lệ với AuthSession đang hoạt động.
- **Candidate**, **Recruiter**, **Company Manager**, **Company Staff**, **Platform Admin**: ngoài xác thực còn phải vượt qua boundary tương ứng.

### Hệ thống và danh mục công khai

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/` | Public | Kiểm tra nhanh API |
| `GET` | `/api/categories/fields` | Public | Danh sách Field Category |
| `GET` | `/api/categories/fields/:fieldId/positions` | Public | Position thuộc Field |
| `GET` | `/api/experience-levels` | Public | Danh sách Experience Level chuẩn |
| `GET` | `/api/locations/provinces` | Public | Danh sách Province |
| `GET` | `/api/locations/provinces/:provinceCode/district-level-units` | Public | Đơn vị cấp District của Province |

### Xác thực và vòng đời tài khoản

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register/candidate` | Public | Đăng ký Candidate |
| `POST` | `/api/auth/register/company-manager` | Public | Đăng ký Company Manager và Company draft |
| `GET`, `POST` | `/api/auth/verify-email` | Public + token một lần | Xác minh email |
| `GET`, `POST` | `/api/auth/confirm-company-approval` | Public + token một lần | Xác nhận Company đã được duyệt |
| `POST` | `/api/auth/login` | Public | Đăng nhập và tạo AuthSession |
| `POST` | `/api/auth/refresh` | Refresh credential | Cấp access token mới trên cùng session |
| `POST` | `/api/auth/logout` | Authenticated | Thu hồi session hiện tại |
| `POST` | `/api/auth/forgot-password` | Public | Gửi luồng quên mật khẩu |
| `GET` | `/api/auth/reset-password` | Public + token một lần | Kiểm tra link đặt lại mật khẩu |
| `POST` | `/api/auth/reset-password` | Public + token một lần | Đặt mật khẩu mới |
| `GET` | `/api/auth/activate-recruiter` | Public + invite token | Kiểm tra link kích hoạt Recruiter |
| `POST` | `/api/auth/activate-recruiter` | Public + invite token | Kích hoạt Recruiter và đặt mật khẩu |

### Company self-service và Recruiter management

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/company` | Company self-service | Xem Company sở hữu |
| `PATCH` | `/api/company` | Company self-service | Cập nhật Company theo trạng thái onboarding/active |
| `POST` | `/api/company/submit` | Onboarding Company Manager | Gửi Company để duyệt |
| `POST` | `/api/company/resend-approval-confirmation` | Onboarding Company Manager | Gửi lại email xác nhận phê duyệt |
| `GET` | `/api/company/recruiters` | Company Manager | Danh sách Recruiter |
| `POST` | `/api/company/recruiters` | Company Manager | Tạo Recruiter |
| `GET` | `/api/company/recruiters/:recruiterId` | Company Manager | Chi tiết Recruiter |
| `POST` | `/api/company/recruiters/:recruiterId/password-reset` | Company Manager | Khởi tạo đặt lại mật khẩu |
| `POST` | `/api/company/recruiters/:recruiterId/lock` | Company Manager | Khóa Recruiter, kèm chuyển giao bắt buộc nếu có |
| `POST` | `/api/company/recruiters/:recruiterId/unlock` | Company Manager | Mở khóa Recruiter |
| `POST` | `/api/company/recruiters/:recruiterId/terminate` | Company Manager | Chấm dứt Recruiter, kèm chuyển giao bắt buộc nếu có |

### Platform Admin

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `POST` | `/api/platform-admin/categories/fields` | Platform Admin | Tạo Field Category |
| `POST` | `/api/platform-admin/categories/fields/:fieldId/positions` | Platform Admin | Tạo Position Category |
| `POST` | `/api/platform-admin/accounts/:userId/lock` | Platform Admin | Khóa tài khoản |
| `POST` | `/api/platform-admin/accounts/:userId/terminate` | Platform Admin | Chấm dứt tài khoản |
| `GET` | `/api/platform-admin/company-registrations` | Platform Admin | Danh sách hồ sơ Company |
| `GET` | `/api/platform-admin/company-registrations/:companyId` | Platform Admin | Chi tiết hồ sơ Company |
| `POST` | `/api/platform-admin/company-registrations/:companyId/approve` | Platform Admin | Duyệt hồ sơ Company |
| `POST` | `/api/platform-admin/company-registrations/:companyId/reject` | Platform Admin | Từ chối hồ sơ Company |
| `POST` | `/api/platform-admin/companies/:companyId/lock` | Platform Admin | Khóa Company đang hoạt động |

### Candidate Profile và thư viện CV

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/candidate/profile` | Candidate | Xem profile của chính mình |
| `PATCH` | `/api/candidate/profile` | Candidate | Cập nhật profile |
| `GET` | `/api/candidate/cvs` | Candidate | Danh sách CV đang hoạt động |
| `POST` | `/api/candidate/cvs` | Candidate | Tạo Generated CV draft |
| `POST` | `/api/candidate/cvs/uploaded` | Candidate | Tạo Uploaded CV từ PDF |
| `GET` | `/api/candidate/cvs/:cvId` | Candidate | Chi tiết CV của mình |
| `PATCH` | `/api/candidate/cvs/:cvId` | Candidate | Cập nhật metadata/visibility |
| `PUT` | `/api/candidate/cvs/:cvId/generated-content` | Candidate | Lưu nội dung Generated CV |
| `PUT` | `/api/candidate/cvs/:cvId/uploaded-file` | Candidate | Thay PDF của Uploaded CV |
| `POST` | `/api/candidate/cvs/:cvId/activate` | Candidate | Kích hoạt Generated CV |
| `GET` | `/api/candidate/cvs/:cvId/preview` | Candidate | Preview CV |
| `GET` | `/api/candidate/cvs/:cvId/download` | Candidate | Download CV |
| `PUT` | `/api/candidate/cvs/:cvId/default` | Candidate | Đặt CV mặc định |
| `DELETE` | `/api/candidate/cvs/:cvId/default` | Candidate | Bỏ CV mặc định |
| `DELETE` | `/api/candidate/cvs/:cvId` | Candidate | Archive CV |

### Job Discovery và Candidate Search

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/job-discovery/jobs` | Public, hỗ trợ auth tùy chọn | Tìm/danh sách Job công khai |
| `GET` | `/api/job-discovery/jobs/:jobId` | Public, hỗ trợ auth tùy chọn | Chi tiết Job công khai |
| `GET` | `/api/job-discovery/companies/:companyId` | Public, hỗ trợ auth tùy chọn | Company profile công khai |
| `GET` | `/api/jobs/candidate-search/cvs` | Recruiter đủ quyền | Tìm Candidate CV `PUBLIC` |
| `GET` | `/api/jobs/candidate-search/cvs/:cvId/preview` | Recruiter đủ quyền | Preview CV đủ điều kiện tìm kiếm |

### Candidate Application, Interview và Invitation

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `POST` | `/api/candidate/applications` | Candidate | Direct Apply vào Job |
| `GET` | `/api/candidate/applications` | Candidate | Danh sách Application của mình |
| `GET` | `/api/candidate/applications/:applicationId` | Candidate | Chi tiết Application |
| `PUT` | `/api/candidate/applications/:applicationId/submitted-cv` | Candidate | Thay submitted CV snapshot |
| `GET` | `/api/candidate/applications/:applicationId/submitted-cv/preview` | Candidate | Preview submitted CV |
| `GET` | `/api/candidate/applications/:applicationId/submitted-cv/download` | Candidate | Download submitted CV |
| `POST` | `/api/candidate/applications/:applicationId/withdraw` | Candidate | Rút Application |
| `POST` | `/api/candidate/applications/:applicationId/availability` | Candidate | Gửi Availability lần đầu |
| `PUT` | `/api/candidate/applications/:applicationId/availability` | Candidate | Sửa Availability hợp lệ |
| `POST` | `/api/candidate/applications/:applicationId/interview-proposals/:interviewScheduleId/confirm` | Candidate | Xác nhận lịch phỏng vấn |
| `POST` | `/api/candidate/applications/:applicationId/interview-proposals/:interviewScheduleId/decline` | Candidate | Từ chối lịch phỏng vấn |
| `GET` | `/api/candidate/applications/:applicationId/conversation` | Candidate | Đọc Conversation/Message |
| `POST` | `/api/candidate/applications/:applicationId/conversation/messages` | Candidate | Gửi Message |
| `GET` | `/api/candidate/invitations` | Candidate | Danh sách Job Invitation |
| `GET` | `/api/candidate/invitations/:invitationId` | Candidate | Chi tiết Job Invitation |
| `POST` | `/api/candidate/invitations/:invitationId/reject` | Candidate | Từ chối Invitation |
| `POST` | `/api/candidate/invitations/:invitationId/accept` | Candidate | Chấp nhận Invitation và tạo Application |

### Job, Recruitment Team và Pipeline

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/jobs` | Company Staff | Danh sách Job nội bộ |
| `POST` | `/api/jobs` | Recruiter | Tạo Job `DRAFT` |
| `GET` | `/api/jobs/managed` | Recruiter | Job Recruiter đang quản lý |
| `GET` | `/api/jobs/my-applications` | Recruiter | Application được phân công cho mình |
| `GET` | `/api/jobs/my-applications/:applicationId` | Recruiter | Chi tiết Application được phân công |
| `GET` | `/api/jobs/my-applications/:applicationId/submitted-cv/preview` | Recruiter | Preview submitted CV |
| `GET` | `/api/jobs/my-applications/:applicationId/submitted-cv/download` | Recruiter | Download submitted CV |
| `GET` | `/api/jobs/my-applications/:applicationId/conversation` | Recruiter có quyền lịch sử chat | Đọc Conversation/Message |
| `POST` | `/api/jobs/my-applications/:applicationId/conversation/messages` | Recruiter | Gửi Message |
| `GET` | `/api/jobs/:jobId` | Company Staff | Chi tiết Job nội bộ |
| `PATCH` | `/api/jobs/:jobId` | Recruiter | Sửa Job `DRAFT` |
| `DELETE` | `/api/jobs/:jobId` | Company Staff đủ quyền | Xóa Job trước khi publish |
| `POST` | `/api/jobs/:jobId/submit` | Recruiter | Gửi Job để duyệt |
| `POST` | `/api/jobs/:jobId/approve` | Company Manager | Duyệt và publish Job |
| `POST` | `/api/jobs/:jobId/reject` | Company Manager | Từ chối Job đang chờ duyệt |
| `POST` | `/api/jobs/:jobId/close` | Company Staff đủ quyền | Đóng Job đã publish |
| `POST` | `/api/jobs/:jobId/reassign-primary` | Company Manager | Reassign Primary theo lifecycle Job |
| `GET` | `/api/jobs/:jobId/team` | Company Staff | Xem Recruitment Team |
| `POST` | `/api/jobs/:jobId/team/supporting` | Company Staff đủ quyền | Thêm Supporting Recruiter |
| `DELETE` | `/api/jobs/:jobId/team/supporting/:companyMemberId` | Company Staff đủ quyền | Xóa Supporting Recruiter |
| `POST` | `/api/jobs/:jobId/team/replace-primary` | Company Manager | Thay Primary Recruiter |
| `GET` | `/api/jobs/:jobId/applications` | Company Staff đủ quyền | Danh sách Application của Job |
| `GET` | `/api/jobs/:jobId/workspace` | Recruiter | Pipeline workspace của Job |
| `GET` | `/api/jobs/:jobId/applications/:applicationId/submitted-cv/preview` | Recruiter đủ quyền | Preview submitted CV theo Job |
| `GET` | `/api/jobs/:jobId/applications/:applicationId/submitted-cv/download` | Recruiter đủ quyền | Download submitted CV theo Job |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/assign` | Company Staff đủ quyền | Assign Application đang unassigned |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/reassign` | Company Staff đủ quyền | Reassign/Take over Application |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/unassign` | Company Staff đủ quyền | Unassign Application |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/force-reassign` | Company Manager | Forced reassign tương thích |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/pipeline` | Recruiter | Chuyển Recruitment Status |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/interview-proposals` | Recruiter | Tạo đề xuất lịch phỏng vấn đầu tiên |
| `POST` | `/api/jobs/:jobId/applications/:applicationId/interview-proposals/:interviewScheduleId/cancel` | Recruiter | Hủy đề xuất lịch phỏng vấn |
| `POST` | `/api/jobs/:jobId/invitations` | Recruiter đủ quyền | Gửi Job Invitation |
| `GET` | `/api/jobs/:jobId/invitations` | Primary Recruiter | Danh sách Invitation của Job |
| `GET` | `/api/jobs/:jobId/invitations/:invitationId` | Primary Recruiter | Chi tiết Invitation |
| `POST` | `/api/jobs/:jobId/invitations/:invitationId/revoke` | Primary Recruiter | Thu hồi Invitation |

### Notification

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/notifications` | Authenticated | Danh sách Notification của User hiện tại |
| `GET` | `/api/notifications/unread-count` | Authenticated | Số Notification chưa đọc |
| `GET` | `/api/notifications/:notificationId` | Authenticated | Chi tiết Notification thuộc User |
| `POST` | `/api/notifications/:notificationId/open` | Authenticated | Đánh dấu Notification đã mở |

### Route chỉ có ngoài production

Các route sau không được mount khi `NODE_ENV=production`:

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/files/test-upload` | Upload thử image/PDF lên Cloudinary |
| `DELETE` | `/api/files/test-delete` | Xóa thử Cloudinary asset |
| `GET` | `/api/auth-access-probe/protected` | Probe access authentication |
| `GET` | `/api/company-staff-access-probe/business` | Probe quyền Company Staff |
| `GET` | `/api/company-staff-access-probe/recruiter-management` | Probe quyền Company Manager |
| `GET` | `/api/company-staff-access-probe/candidate-search` | Probe quyền Candidate Search của Recruiter |

## Realtime với Socket.IO

Socket.IO dùng cùng origin/port với HTTP server. Kết nối phải cung cấp access token hợp lệ; server chấp nhận `auth.accessToken`, `auth.token` hoặc header `Authorization: Bearer ...`.

Ví dụ client:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
  auth: {
    accessToken,
  },
});

socket.on("notification", ({ notification }) => {
  // Đồng bộ inbox hoặc cập nhật UI.
});

socket.on("message", ({ message, conversationId, applicationId }) => {
  // Cập nhật Conversation hiện tại.
});

socket.on("conversationState", ({ conversationId, applicationId, mode }) => {
  // Cập nhật quyền đọc/ghi của Conversation.
});
```

Server đưa mọi connection của cùng một User vào room riêng theo User. Realtime là best-effort, không đảm bảo exactly-once và không thay thế dữ liệu bền vững. Client phải dùng HTTP để đồng bộ lại Notification/Conversation sau khi reconnect hoặc bỏ lỡ event.

`CORS_ALLOWED_ORIGINS` được áp dụng cho cả Express và Socket.IO. Request không có `Origin` được xem là non-browser client.

## Upload và lưu trữ tệp

- File được lưu trên Cloudinary; backend kiểm tra kết nối Cloudinary trước khi mở HTTP server.
- Upload thử hỗ trợ JPEG, PNG, WebP và PDF; loại tệp được kiểm tra từ nội dung thay vì chỉ tin MIME type do client gửi.
- Candidate Uploaded CV chỉ nhận PDF, được kiểm tra magic bytes, mật khẩu, kích thước tối đa chính xác 10 MB và tối đa 20 trang theo contract V7.
- Artifact CV riêng tư dùng Cloudinary authenticated delivery; backend không lưu public URL lâu dài cho nội dung bị giới hạn.
- Generated CV được render PDF bằng `pdf-lib` và font Noto Serif kèm theo repository.

Ví dụ upload thử ngoài production:

```bash
curl -X POST \
  -F "file=@/path/to/file.pdf" \
  http://localhost:8000/api/files/test-upload
```

Response trả về `publicId`, `resourceType` và `deliveryType`; dùng đúng các giá trị đó khi xóa:

```bash
curl -X DELETE \
  -H "Content-Type: application/json" \
  -d '{
    "publicId": "cloudinary-public-id",
    "resourceType": "image",
    "deliveryType": "upload"
  }' \
  http://localhost:8000/api/files/test-delete
```

## Migration dữ liệu

Migration được gọi tường minh qua:

```bash
node scripts/run-migration.js <migration-name> [--preflight]
```

Các migration hiện có:

| Tên | Mục đích chính | Có preflight đọc-only |
| --- | --- | --- |
| `v3-tx07-company-manager-to-company-staff` | Cutover Company Manager/CompanyMember V3 | Không |
| `v4-experience-level-dataset` | Khởi tạo dataset Experience Level chuẩn | Không |
| `v41-legacy-location-cutover` | Chuyển Location legacy sang Province/District V4.1 | Có |
| `v42-legacy-salary-cutover` | Chuyển Salary legacy và áp strict Salary guard V4.2 | Có |
| `v6-supporting-recruiter-backfill` | Backfill Recruitment Team V6 | Không |

> [!WARNING]
> Không chạy migration lịch sử một cách máy móc trên database đang có dữ liệu. Hãy backup, đọc Product/Data Contract và status leaf tương ứng, chạy `--preflight` khi được hỗ trợ, xử lý toàn bộ blocker rồi mới chạy migration ghi. Runner tự gọi `verify` nếu migration cung cấp hàm này.

`v42-legacy-salary-cutover` là ngoại lệ vận hành quan trọng: database mới cũng phải chạy migration này một lần để áp collection validator trước lần startup đầu tiên. Startup chỉ kiểm tra guard và sẽ fail closed nếu guard chưa được áp dụng.

## Logging và xử lý lỗi

- `src/utils/logger.js` là logger ứng dụng duy nhất.
- Development dùng output dễ đọc/có màu; production xuất một JSON object trên mỗi dòng.
- `src/middlewares/request-logger.js` chạy đầu tiên, gán request ID và ghi access log không chứa query string.
- Lỗi 5xx được log ở mức `error`; request 4xx bị từ chối được log ở mức `debug`.
- MongoDB, Cloudinary, bootstrap, worker, realtime fan-out và recovery đều dùng cùng logger.
- `SIGINT`/`SIGTERM` kích hoạt graceful shutdown: đóng Socket.IO, HTTP server, worker và MongoDB; timeout cưỡng bức hiện là 10 giây.

Không log access token, refresh token, mật khẩu, SMTP credential, Cloudinary secret hoặc nội dung nhạy cảm từ CV/Application.

## Kiểm thử và kiểm tra chất lượng

Trong quá trình phát triển, có thể chạy test tập trung:

```bash
npm test -- test/<khu-vuc>/<ten-file>.test.js
```

Trước khi hoàn tất thay đổi backend material, chạy cổng chính thức:

```bash
npm run verify:agent
```

Cổng này chạy tuần tự:

1. ESLint.
2. Kiểm tra kiến trúc xác định.
3. Toàn bộ Vitest suite.

Test tích hợp dùng MongoDB Memory Server replica set để kiểm tra transaction và rollback. Việc test pass không tự chứng minh MongoDB Atlas, Cloudinary, SMTP, Province Open API hoặc hạ tầng production thật đang hoạt động; các smoke/integration check bên ngoài phải được báo cáo riêng.

## Cấu trúc thư mục

```text
backend/
├── index.js                         # Entry point và lifecycle tiến trình
├── scripts/
│   ├── run-migration.js             # Runner migration tường minh
│   └── verify-architecture.js       # Cổng kiểm tra kiến trúc
├── src/
│   ├── app.js                       # Express app và thứ tự middleware
│   ├── config/                      # Config chuẩn hóa, MongoDB, Cloudinary, SMTP
│   ├── constants/                   # Enum và mapping dùng chung
│   ├── controllers/                 # HTTP handlers
│   ├── database/
│   │   ├── migrations/              # Migration có phiên bản
│   │   └── seeds/                   # Seed scaffolding
│   ├── middlewares/                 # Auth, authorization, validation, upload, lỗi
│   ├── models/                      # Mongoose schema/model/invariant
│   ├── routes/                      # Root router và feature router
│   ├── services/                    # Workflow nghiệp vụ và tích hợp hạ tầng
│   ├── sockets/                     # Socket.IO server, event và facade
│   ├── utils/                       # Helper tổng quát, logger, JWT, password
│   └── workers/                     # Notification và Invitation workers
├── test/                            # Unit/integration/acceptance tests
├── assets/fonts/                    # Font dùng render Generated CV
├── .env.example                     # Mẫu biến môi trường
├── eslint.config.js
├── vitest.config.js
├── package.json
└── package-lock.json
```

## Triển khai production

- Đặt `NODE_ENV=production` để tắt route probe/test file và ẩn stack trace khỏi response.
- Dùng secret manager của nền tảng triển khai; không đóng gói `.env` hoặc credential vào image/source control.
- Chạy MongoDB replica set/Atlas và thực hiện migration/cutover bắt buộc trước khi deploy phiên bản mã nguồn phụ thuộc vào chúng.
- Đảm bảo collection validator/index readiness; startup sẽ fail closed với một số invariant bắt buộc.
- Cấu hình chính xác `APP_BASE_URL` và `CORS_ALLOWED_ORIGINS` cho domain HTTPS thật.
- Chạy sau reverse proxy HTTPS và process/container supervisor có hỗ trợ `SIGTERM` cùng thời gian graceful shutdown phù hợp.
- Cho phép outbound đến MongoDB, Cloudinary, SMTP và Province Open API v1.
- Thu thập JSON logs và giữ `X-Request-Id` xuyên qua reverse proxy để truy vết.
- Worker hiện chạy trong mỗi process ứng dụng. Chúng được thiết kế non-overlapping trong một process và chịu được chạy song song giữa nhiều process, nhưng không phải scheduler exactly-once phân tán.
- Thực hiện smoke test thực tế cho HTTP, Socket.IO, email và file storage sau deploy; `npm run verify:agent` không thay thế kiểm tra hạ tầng.

## Tài liệu nguồn chuẩn

Đọc theo mục đích:

| Cần biết | Tài liệu |
| --- | --- |
| Roadmap và trạng thái cấp cao | [Product Roadmap](../docs/product/roadmap.md) |
| Bản đồ trạng thái triển khai/verification | [Project Status](../docs/project-status/index.md) |
| Yêu cầu nghiệp vụ từng phiên bản | [`docs/product/versions/`](../docs/product/versions/) |
| Hợp đồng persistence từng phiên bản | [`docs/data/versions/`](../docs/data/versions/) |
| Kiến trúc toàn hệ thống | [Architecture](../docs/engineering/architecture.md) |
| Quy ước backend | [Backend Engineering Conventions](../docs/engineering/backend-conventions.md) |
| Canonical owner và mismatch đã biết | [Engineering Source of Truth](../docs/engineering/source-of-truth.md) |
| Trạng thái vận hành backend | [Platform and Operations](../docs/project-status/backend/platform-and-operations.md) |

Khi tài liệu mâu thuẫn, không tự suy diễn: Product Specification quyết định nghiệp vụ, Data Contract quyết định persistence, Engineering docs quyết định kiến trúc/owner, còn Project Status chỉ ghi nhận tình trạng triển khai và bằng chứng verification.

## Giấy phép

Dự án sử dụng giấy phép MIT theo khai báo trong `package.json`.
