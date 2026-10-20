# JOBHUB Frontend

Frontend của JOBHUB là ứng dụng React chạy trên Vite, cung cấp nền tảng kỹ thuật cho các trải nghiệm Candidate, Recruiter, Company Manager và Platform Admin.

Ứng dụng hiện có routing, Redux, HTTP client, authentication lifecycle, Socket.IO client, validation, Tailwind CSS, shadcn/ui và hệ thống toast dùng chung. Phạm vi hiện tại vẫn là frontend foundation: chỉ có trang mẫu công khai tại `/`, chưa có màn hình đăng nhập/đăng xuất hoặc màn hình nghiệp vụ hoàn chỉnh.

> [!IMPORTANT]
> README này mô tả cách chạy và kiến trúc frontend hiện có. Yêu cầu nghiệp vụ chính thức nằm trong [`docs/product/backend/versions/`](../docs/product/backend/versions/), API thực tế do backend routes/controllers quyết định, và trạng thái triển khai được tra cứu từ [Project Status](../docs/project-status/index.md). Không suy ra một màn hình hoặc workflow frontend chỉ từ việc backend đã có endpoint tương ứng.

## Mục lục

- [Trạng thái hiện tại](#trạng-thái-hiện-tại)
- [Năng lực đã có](#năng-lực-đã-có)
- [Phạm vi chưa triển khai](#phạm-vi-chưa-triển-khai)
- [Công nghệ](#công-nghệ)
- [Kiến trúc](#kiến-trúc)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt và chạy local](#cài-đặt-và-chạy-local)
- [Biến môi trường](#biến-môi-trường)
- [Các script](#các-script)
- [Route và API hiện có](#route-và-api-hiện-có)
- [Authentication lifecycle](#authentication-lifecycle)
- [HTTP client và xử lý lỗi](#http-client-và-xử-lý-lỗi)
- [Realtime với Socket.IO](#realtime-với-socketio)
- [Routing và route guard](#routing-và-route-guard)
- [Redux và trạng thái ứng dụng](#redux-và-trạng-thái-ứng-dụng)
- [Form và validation](#form-và-validation)
- [UI, styling và toast](#ui-styling-và-toast)
- [Quy ước phát triển](#quy-ước-phát-triển)
- [Kiểm thử và kiểm tra chất lượng](#kiểm-thử-và-kiểm-tra-chất-lượng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Build và triển khai production](#build-và-triển-khai-production)
- [Giới hạn và mismatch đã biết](#giới-hạn-và-mismatch-đã-biết)
- [Tài liệu nguồn chuẩn](#tài-liệu-nguồn-chuẩn)

## Trạng thái hiện tại

Theo [Frontend V1 Authentication Foundation Project Status](../docs/project-status/frontend/v01-authentication-foundation.md), nền tảng frontend và hạ tầng vòng đời xác thực V1 là `IMPLEMENTED AND VERIFIED`.

| Phạm vi | Trạng thái |
| --- | --- |
| React/Vite foundation, Tailwind CSS v4 và alias `@` | Đã triển khai và xác minh |
| Redux Toolkit provider/store | Đã triển khai và xác minh |
| Browser router, nested layout và trang mẫu `/` | Đã triển khai và xác minh |
| Axios client, chuẩn hóa lỗi và request tracing | Đã triển khai và xác minh |
| Authentication storage, refresh, retry và bootstrap | Đã triển khai và xác minh |
| Socket.IO client lazy và đồng bộ access token | Đã triển khai và xác minh |
| React Hook Form/Zod provider | Đã tích hợp; chưa có form nghiệp vụ cụ thể |
| Route guards | Đã có component; chưa gắn vào route cụ thể |
| Login/logout UI | Chưa có màn hình được phê duyệt |
| Feature-specific realtime listeners | Chưa triển khai |
| Role-specific layouts và màn hình nghiệp vụ | Chưa triển khai |

`docs/project-status/index.md` hiện chỉ ánh xạ một status leaf cho frontend V1. Trạng thái backend V1–V15 không tự động trở thành trạng thái triển khai frontend.

## Năng lực đã có

- Một React root, một Redux `Provider` và một Redux store.
- Một browser router với route group công khai, `RootLayout` và `HomePage`.
- `ProtectedRoute`, `GuestRoute` và `RoleRoute` đọc auth state đã resolve.
- Một Axios instance dùng chung với base URL, timeout, auth interceptor và `ApiError` chuẩn hóa.
- Authentication manager điều phối login, logout, reload bootstrap, refresh single-flight, localStorage, Redux và Socket.IO.
- Một Socket.IO client lazy, chỉ kết nối khi authentication workflow cần.
- Event constants thống nhất với backend: `notification`, `message`, `conversationState`.
- Validation provider dùng Zod, React Hook Form resolver và reusable validators.
- Tailwind CSS v4, theme tokens, shadcn/ui conventions, `cn()` helper và Button primitive.
- Một Sonner `<Toaster />` với cấu hình ứng dụng tập trung.
- Focused Node tests cho authentication interceptors và authentication manager.

## Phạm vi chưa triển khai

Frontend hiện chưa có:

- Trang đăng ký, xác minh email, đăng nhập, quên/đặt lại mật khẩu hoặc đăng xuất.
- Route protected/guest/role cụ thể và đích redirect được sản phẩm phê duyệt.
- Dashboard hoặc application shell riêng cho Candidate, Recruiter, Company Manager hay Platform Admin.
- UI cho Company, Recruiter, Job, CV, Application, Pipeline, Chat, Interview, Notification, Candidate Search hoặc Job Invitation.
- Resource API module ngoài `authentication.api.js`.
- Feature listener cho các sự kiện Socket.IO.
- Dark theme hoàn chỉnh.
- Browser-oriented test harness, end-to-end test hoặc deterministic frontend architecture verifier.

Các phần này chỉ được thêm khi có Product Specification, API contract và screen/route scope được phê duyệt; thư mục scaffold hoặc backend endpoint không phải bằng chứng rằng UI tương ứng đã tồn tại.

## Công nghệ

| Nhóm | Công nghệ |
| --- | --- |
| UI runtime | React 19, React DOM |
| Build/dev server | Vite 8 |
| Routing | React Router DOM 7 |
| Global state | Redux Toolkit, React Redux |
| HTTP | Axios |
| Realtime | Socket.IO Client |
| Form | React Hook Form |
| Validation | Zod, `@hookform/resolvers` |
| Styling | Tailwind CSS 4, `tw-animate-css` |
| UI primitives | shadcn/ui conventions, Radix Slot, class-variance-authority |
| Icons | Lucide React |
| Toast | Sonner |
| Chất lượng mã | ESLint, Vite production build, focused Node tests |

## Kiến trúc

Luồng phụ thuộc chính:

```text
main -> application providers -> App -> authentication bootstrap -> router
router -> route groups -> guards/layouts/pages
layouts -> common components + Outlet
pages -> feature components + common components + UI primitives
features -> API modules / socket facade / store hooks / validation
store composition -> feature-owned reducers
UI primitives -> lib integration helpers
```

Các canonical owner quan trọng:

- `src/main.jsx`: global stylesheet, React root và Redux `Provider`.
- `src/App.jsx`: authentication bootstrap, `RouterProvider` và Sonner `<Toaster />` duy nhất.
- `src/routes/index.jsx`: browser router duy nhất.
- `src/apis/client/`: Axios instance, interceptor và error normalization duy nhất.
- `src/socket/index.js`: Socket.IO client và connection lifecycle duy nhất.
- `src/store/store.js`: Redux store và reducer registration duy nhất.
- `src/utils/constant.js`: project constants và nơi duy nhất đọc `import.meta.env`/`VITE_*`.
- `src/validation/index.js`: public validation provider của ứng dụng.
- `src/features/<feature>/`: workflow, state, hook và component thuộc một nghiệp vụ.
- `src/styles/globals.css`: global CSS, Tailwind v4 integration và theme tokens.

Không tạo thêm router, store, Axios client, Socket.IO client, Toaster hoặc module đọc `VITE_*` song song.

## Yêu cầu hệ thống

- Node.js `^20.19.0` hoặc `>=22.12.0` theo yêu cầu của Vite 8 trong lockfile hiện tại.
- Yarn Classic 1.x; repository hiện dùng `yarn.lock` v1.
- Trình duyệt hiện đại hỗ trợ ES modules và Web Storage.
- JOBHUB backend nếu cần thử authentication, HTTP hoặc Socket.IO; mặc định backend ở `http://localhost:8000`.
- Backend phải cho phép frontend origin trong `CORS_ALLOWED_ORIGINS`; Vite mặc định chạy ở `http://localhost:5173`.

## Cài đặt và chạy local

### 1. Cài dependency

Từ thư mục repository:

```bash
cd frontend
yarn install --frozen-lockfile
```

### 2. Tạo cấu hình local

```bash
cp .env.example .env
```

Mẫu mặc định kết nối frontend với backend local:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
VITE_SOCKET_URL=http://localhost:8000
```

### 3. Cho phép frontend origin ở backend

Trong `backend/.env`:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Nếu có nhiều origin, phân cách chúng bằng dấu phẩy.

### 4. Chạy development server

```bash
yarn dev
```

Vite mặc định phục vụ ứng dụng tại:

```text
http://localhost:5173
```

Route hiện có:

```text
http://localhost:5173/
```

Frontend không cấu hình Vite proxy. Với `.env.example`, request HTTP đi trực tiếp đến backend ở port `8000` và Socket.IO dùng cùng backend origin.

## Biến môi trường

| Biến | Default trong code | Giá trị `.env.example` | Mục đích |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | `http://localhost:8000/api` | Base URL cho Axios client |
| `VITE_SOCKET_URL` | `window.location.origin` | `http://localhost:8000` | URL cho Socket.IO client |

`src/utils/constant.js` là nơi duy nhất đọc hai biến này và chuyển chúng thành `API_CONFIG`/`SOCKET_CONFIG`.

> [!WARNING]
> Mọi biến `VITE_*` đều được Vite đóng gói vào JavaScript gửi xuống trình duyệt. Không đặt JWT secret, database URI, SMTP password, Cloudinary secret hoặc bất kỳ credential riêng tư nào trong frontend environment variables.

Sau khi thay đổi `.env`, khởi động lại Vite dev server. Với production, các giá trị này phải được cung cấp tại thời điểm build, trừ khi deployment có một runtime-config mechanism riêng được phê duyệt sau này.

## Các script

Chạy từ thư mục `frontend/`:

| Lệnh | Mô tả |
| --- | --- |
| `yarn dev` | Chạy Vite development server |
| `yarn build` | Tạo production bundle trong `dist/` |
| `yarn preview` | Preview bundle đã build ở local; không phải production server |
| `yarn lint` | Chạy ESLint cho JavaScript/JSX |
| `yarn test:auth` | Chạy focused authentication Node tests |
| `yarn verify:agent` | Chạy `test:auth`, ESLint và production build |

## Route và API hiện có

### Browser route

| Path | Loại | Layout/Page | Trạng thái |
| --- | --- | --- | --- |
| `/` | Public index route | `RootLayout` → `HomePage` | Trang foundation mẫu đang chạy |

Không có route login/logout, protected route hoặc role route cụ thể. Ba guard component chỉ là infrastructure sẵn sàng cho route đã được phê duyệt sau này.

### Backend endpoint đang được frontend khai báo

`src/apis/authentication.api.js` hiện là resource API module duy nhất:

| Method | Endpoint | Chính sách client | Mục đích |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Public, không gắn Bearer token | Đăng nhập |
| `POST` | `/auth/refresh` | Public, gửi refresh credential trong body | Cấp access token mới |
| `POST` | `/auth/logout` | `requiresAuthentication: true` | Thu hồi session hiện tại |

Các path trên được ghép với `VITE_API_BASE_URL`. Với cấu hình local mặc định, URL đầy đủ lần lượt bắt đầu bằng `http://localhost:8000/api`.

Việc có API function không đồng nghĩa đã có form hoặc màn hình gọi function đó. Hiện authentication service cung cấp workflow, nhưng repository chưa có login/logout UI.

## Authentication lifecycle

### Nguồn sở hữu

| Trách nhiệm | Owner |
| --- | --- |
| Persist credential/session | `features/authentication/services/authentication-storage.js` |
| Điều phối lifecycle | `features/authentication/services/authentication-manager.js` |
| Kết nối owner với API/store/socket | `features/authentication/services/authentication.service.js` |
| UI-facing state/selectors | `features/authentication/slice.js` |
| Khởi tạo khi app mount | `features/authentication/components/AuthenticationBootstrap.jsx` |
| HTTP attach/refresh/retry | `apis/client/authentication-interceptors.js` |

Authentication được lưu trong một localStorage record duy nhất:

```text
jobhub.authentication
```

Record hiện chứa `accessToken`, `refreshToken`, `user` và `session`. Không đọc/ghi key này trực tiếp từ page hoặc component; mọi truy cập phải qua authentication storage/service owner.

### Khởi động lại trang

```text
App mount
  -> AuthenticationBootstrap
  -> đọc localStorage
  -> không có refresh credential: chuyển sang unauthenticated
  -> có refresh credential: gọi /auth/refresh trước khi hydrate authenticated state
  -> refresh thành công: cập nhật access token, Redux và kết nối Socket.IO
  -> credential không hợp lệ: xóa storage, Redux auth state và ngắt socket
  -> lỗi hạ tầng tạm thời: giữ credential, chuyển temporarilyUnavailable để có thể retry
```

### Đăng nhập

`login(credentials)`:

1. Gọi `/auth/login` như public request.
2. Lưu authentication record.
3. Cập nhật Redux sang `authenticated`.
4. Kết nối Socket.IO bằng access token.
5. Trả kết quả cho UI caller.

### Refresh và retry

- Chỉ request có `requiresAuthentication: true` mới được gắn `Authorization: Bearer ...`.
- Một protected request nhận `401` được refresh và retry tối đa một lần.
- Nhiều request cùng gặp `401` dùng chung một refresh promise (single-flight).
- Public `401` và protected `403` không kích hoạt refresh.
- Refresh cũ không được ghi đè một login/session mới hơn.
- Khi refresh thành công, access token trong storage và Socket.IO handshake được cập nhật.

### Đăng xuất

`logout()` gọi backend bằng protected request. Dù backend logout thành công hay lỗi, frontend vẫn xóa authentication local, cập nhật Redux về unauthenticated và ngắt Socket.IO trong `finally`.

Route guards và client state chỉ cải thiện trải nghiệm điều hướng. Backend authentication/authorization mới là ranh giới bảo mật có thẩm quyền.

## HTTP client và xử lý lỗi

Axios client dùng chung nằm tại `src/apis/client/index.js`:

- Base URL: `API_CONFIG.BASE_URL`.
- Timeout: 15 giây. Riêng các request mà backend gửi email trước khi phản hồi (đăng ký ứng viên, quên mật khẩu) dùng `API_CONFIG.EMAIL_DELIVERY_TIMEOUT_MS` (60 giây).
- Tự thêm `Accept: application/json`.
- Chỉ thêm Bearer token khi API call opt in bằng `requiresAuthentication: true`.
- Điều phối refresh/retry qua authentication adapter.
- Chuẩn hóa lỗi trước khi trả về feature/UI.

`ApiError` cung cấp:

| Thuộc tính | Nguồn |
| --- | --- |
| `message` | `error.message` từ backend hoặc fallback client |
| `status` | HTTP status |
| `code` | Backend/client error code nếu có |
| `details` | `error.details` hoặc danh sách lỗi tương thích |
| `requestId` | Header backend `X-Request-Id` |
| `cause` | Axios/original error |

Trong development, failed request được log một lần theo dạng:

```text
[API] METHOD url -> status: message
```

Log có status, code, request ID, details, params, backend development stack và cause; request body bị loại bỏ để tránh log credential. Production build không log API error theo cơ chế này.

Component/feature quyết định cách trình bày lỗi, thường dùng `ApiError.message`. Không parse Axios internals hoặc thêm `console.error` trùng với HTTP client.

## Realtime với Socket.IO

`src/socket/index.js` tạo một Socket.IO client với `autoConnect: false`.

Lifecycle hiện tại:

- Login/bootstrap thành công: kết nối với `auth.accessToken`.
- Access token refresh: cập nhật handshake credential; nếu đang kết nối thì reconnect.
- Logout hoặc invalid session: disconnect và xóa socket auth object.

Event constants đã đồng bộ với backend:

| Constant | Event name | Ý nghĩa vận chuyển |
| --- | --- | --- |
| `REALTIME_EVENT.NOTIFICATION` | `notification` | Notification mới/vừa materialize |
| `REALTIME_EVENT.MESSAGE` | `message` | Message thuộc Application Conversation |
| `REALTIME_EVENT.CONVERSATION_STATE` | `conversationState` | Thay đổi mode của Conversation |

Chưa có feature-specific listener/subscription. Khi được triển khai, listener phải nằm trong feature sở hữu và unsubscribe khi không còn cần thiết; không đưa nghiệp vụ Notification/Chat vào socket facade.

Realtime chỉ là tín hiệu để cập nhật kịp thời, không phải durable source of truth. Feature phải resync qua HTTP khi cần phục hồi state sau reconnect hoặc bỏ lỡ event.

## Routing và route guard

- `src/routes/index.jsx` tạo browser router duy nhất.
- `src/routes/public.routes.jsx` khai báo route group công khai.
- `RootLayout` chứa `AppHeader` và `Outlet`.
- `HomePage` là complete screen hiện tại cho `/`.

Ba guard dùng auth state từ Redux:

| Guard | Hành vi |
| --- | --- |
| `ProtectedRoute` | Chờ auth resolve; redirect User chưa authenticated |
| `GuestRoute` | Chờ auth resolve; redirect User đã authenticated |
| `RoleRoute` | Chờ auth resolve; kiểm tra `user.role` trong `allowedRoles` |

Guard nhận `redirectTo` và `fallback` từ route declaration; chúng không hard-code đích điều hướng, gọi API hoặc tự decode quyền. Hiện chưa có route nào mount các guard này.

## Redux và trạng thái ứng dụng

Store chỉ đăng ký reducer `authentication`. Token không dùng Redux làm source of truth; credential persistence thuộc authentication storage.

Các trạng thái authentication hiện có:

| Trạng thái | Ý nghĩa |
| --- | --- |
| `idle` | Chưa bắt đầu restore |
| `restoring` | Đang refresh/khôi phục session |
| `authenticated` | Đã có session hợp lệ |
| `unauthenticated` | Không có session hợp lệ |
| `temporarilyUnavailable` | Có credential nhưng restore thất bại do hạ tầng tạm thời |

Shared hooks là `useAppDispatch` và `useAppSelector` trong `src/store/hooks.js`. Reducer mới phải nằm cạnh feature sở hữu và chỉ được đăng ký tại store trung tâm khi state thực sự cần đi qua component/route boundary.

## Form và validation

`src/validation/index.js` là public provider duy nhất, hiện export:

- `z` từ Zod.
- `zodResolver` cho React Hook Form.
- `validators.requiredText()`.
- `validators.email()`.

Khi có form được phê duyệt:

```text
src/validation/index.js          -> public provider
src/validation/*.validators.js   -> reusable validator factories
src/validation/*.schema.js       -> form/payload schemas
feature component                -> React Hook Form wiring + error presentation
backend                          -> business/authorization/persistence authority
```

Ví dụ cách dùng dự kiến:

```jsx
import { useForm } from 'react-hook-form'

import { loginSchema, zodResolver } from '@/validation'

function LoginForm() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
  })

  // Submit validated values through the authentication feature.
}
```

`loginSchema` trong ví dụ chưa tồn tại; schema thực chỉ được thêm khi form và API contract tương ứng được phê duyệt.

Client validation giúp phản hồi sớm nhưng không xác nhận authorization, session validity, concurrency hoặc business transition. Backend response vẫn là kết quả có thẩm quyền.

## UI, styling và toast

### Tailwind CSS và theme

- Tailwind CSS v4 tích hợp qua `@tailwindcss/vite` và CSS imports.
- Không có `tailwind.config.js` hoặc PostCSS setup kiểu Tailwind v3.
- `src/styles/globals.css` sở hữu CSS variables, `@theme inline` và base styles.
- Theme hiện khai báo light color scheme; dark variant có hook CSS nhưng dark theme hoàn chỉnh chưa được triển khai.
- Dùng theme token thay vì lặp raw color trong component.

### UI component levels

```text
components/ui/                  -> primitive trung lập nghiệp vụ
components/common/              -> presentation dùng chung cấp ứng dụng
features/<feature>/components/  -> UI chỉ thuộc một feature
layouts/                        -> structural frame + Outlet
pages/                          -> complete URL-mapped screen
```

Primitive hiện có là `Button`; common component hiện có là `AppHeader`. `cn()` trong `src/lib/utils.js` là helper ghép class theo convention của shadcn/ui.

### Toast phản hồi thao tác

`App.jsx` mount đúng một `<Toaster />`. Defaults nằm trong `TOASTER_CONFIG`:

- Góc trên bên phải, light theme và rich colors.
- Có nút đóng, duration 4 giây, tối đa ba toast hiển thị.
- Offset 24 px desktop và 16 px mobile.
- Vietnamese accessible labels.
- Neutral toast dùng theme tokens và font của ứng dụng.

Component hoặc feature hook gọi Sonner trực tiếp:

```jsx
import { toast } from 'sonner'

toast.success('Đã lưu thay đổi')
toast.error(error.message)
```

Không tạo Toaster thứ hai, wrapper hoặc style riêng nếu chưa có quy tắc lặp thực sự. API modules, HTTP/socket clients, Redux slices và validation modules không được trigger toast.

Toast là phản hồi tạm thời, không phải persisted JOBHUB Notification và không thay thế Notification inbox/read state/realtime workflow.

## Quy ước phát triển

### Đặt tên file

- Component, page, layout và guard: `PascalCase.jsx`.
- Route group: `<name>.routes.jsx`.
- Resource API: `<name>.api.js`.
- Form schema: `<scope>.schema.js`.
- Reusable validators: `<scope>.validators.js`.
- General JavaScript module: tên mô tả bằng lowercase/kebab-case.
- `index.js`/`index.jsx` chỉ dùng cho public facade hoặc composition entry point thật.

### Import

- Dùng alias `@` cho import qua các area; `@` ánh xạ đến `src/`.
- Dùng relative import cho các sibling trong cùng local module boundary.
- Không tạo circular dependency.
- Không import feature internals từ một feature khác; cần public interface hoặc owner cao hơn.

### Ownership

- Page compose feature; không sở hữu toàn bộ workflow nghiệp vụ.
- Layout không gọi business API.
- Common/UI component không biết endpoint, role hoặc lifecycle state.
- API module chỉ làm transport; không toast, navigate hoặc chứa Redux reducer.
- Feature service điều phối client workflow nhưng không định nghĩa lại nghiệp vụ backend.
- Route guard và client validation không phải security control.
- Chỉ thêm folder/layer/component khi có consumer thật; scaffold rỗng không chứng minh chức năng.

## Kiểm thử và kiểm tra chất lượng

### Focused authentication tests

```bash
yarn test:auth
```

Suite hiện có 11 test, bao phủ:

- Chỉ protected request mới gắn access token.
- Protected `401` refresh và retry đúng một lần.
- Public `401`/protected `403` không refresh.
- Các caller refresh đồng thời dùng chung một operation.
- Refresh cũ không ghi đè login mới.
- Invalid refresh xóa storage/state/socket đúng một lần.
- Lỗi hạ tầng giữ credential và cho phép retry.
- Bootstrap refresh trước khi hydrate.
- Login đồng bộ persistence, Redux và realtime.
- Logout luôn cleanup local state.

### Cổng xác minh chung

Trước khi hoàn tất thay đổi frontend material:

```bash
yarn verify:agent
```

Cổng chạy tuần tự:

1. `yarn test:auth`.
2. `yarn lint`.
3. `yarn build`.

Gate này chứng minh focused authentication behavior, lint, module resolution và bundling. Nó không chứng minh rendering, accessibility, mọi business behavior, tích hợp với backend đang chạy hoặc end-to-end flow. Browser/manual smoke check phải được báo cáo riêng nếu thực sự đã chạy.

## Cấu trúc thư mục

```text
frontend/
├── index.html                       # HTML entry, language và metadata
├── components.json                  # shadcn/ui conventions và aliases
├── eslint.config.js                 # ESLint flat config
├── jsconfig.json                    # Editor/tooling alias mirror
├── vite.config.js                   # React, Tailwind v4 và runtime alias
├── .env.example                     # Public browser configuration mẫu
├── package.json
├── yarn.lock
├── public/                          # Static assets
├── test/
│   └── authentication/              # Focused dependency-free Node tests
└── src/
    ├── main.jsx                     # React root + Redux Provider
    ├── App.jsx                      # Auth bootstrap + router + Toaster
    ├── apis/
    │   ├── authentication.api.js    # Login/refresh/logout transport
    │   └── client/                  # Axios, interceptor và ApiError
    ├── components/
    │   ├── common/                  # Shared application presentation
    │   └── ui/                      # Domain-neutral UI primitives
    ├── features/
    │   └── authentication/
    │       ├── components/          # Authentication bootstrap
    │       ├── services/            # Manager, storage và composition
    │       └── slice.js             # Auth UI state/selectors
    ├── layouts/                     # Shared structural frames
    ├── lib/                         # External-library integration helpers
    ├── pages/                       # URL-mapped screens
    ├── routes/                      # Router, route groups và guards
    ├── socket/                      # Shared lazy Socket.IO client
    ├── store/                       # Redux store và shared hooks
    ├── styles/                      # Global CSS và theme tokens
    ├── utils/                       # Constants và pure shared helpers
    └── validation/                  # Provider, validators và schemas
```

## Build và triển khai production

Tạo bundle:

```bash
yarn build
```

Output nằm trong `frontend/dist/`.

Khi triển khai:

- Cung cấp `VITE_API_BASE_URL` và `VITE_SOCKET_URL` đúng tại thời điểm build.
- Serve `dist/` bằng static hosting/CDN hoặc web server production; không dùng `yarn preview` làm production server.
- Cấu hình SPA fallback về `index.html` cho browser routes trong tương lai.
- Dùng HTTPS cho frontend, backend HTTP API và Socket.IO.
- Thêm frontend production origin vào backend `CORS_ALLOWED_ORIGINS`.
- Đảm bảo reverse proxy/CDN không làm mất WebSocket/Socket.IO upgrade khi dùng cùng domain gateway.
- Không cache `index.html` quá lâu nếu cần phát hành config/bundle mới; hashed assets có thể cache dài hạn.
- Thực hiện smoke check trang `/`, request đến backend, auth refresh và Socket.IO trên môi trường thật.

## Giới hạn và mismatch đã biết

Theo [Frontend Sources of Truth](../docs/engineering/frontend-source-of-truth.md):

- `src/features/authentication/utils.js` là placeholder chỉ có comment, không phải implemented behavior.
- `src/components/ui/button.jsx` dùng tên lowercase theo output shadcn/ui, trong khi convention chung yêu cầu component filename PascalCase; quyết định exception/rename chưa được chốt.
- `components.json` có alias `@/hooks`, nhưng `src/hooks/` chưa tồn tại và chưa có canonical owner cho shared hooks.
- Chưa có quyết định về server-state library; không tự thêm một library/layer mới.
- Chưa có browser test harness hoặc deterministic architecture check trong frontend gate.

Không sao chép mismatch này thành pattern mới hoặc tự sửa ngoài phạm vi task liên quan.

## Tài liệu nguồn chuẩn

| Cần biết | Tài liệu |
| --- | --- |
| Trạng thái triển khai frontend | [Frontend V1 Authentication Foundation Status](../docs/project-status/frontend/v01-authentication-foundation.md) |
| Bản đồ status toàn repository | [Project Status](../docs/project-status/index.md) |
| Kiến trúc hiện tại và target | [Architecture](../docs/engineering/architecture.md) |
| Quy ước layer, validation, styling và verification | [Frontend Engineering Conventions](../docs/engineering/frontend-conventions.md) |
| Canonical owner và mismatch | [Frontend Sources of Truth](../docs/engineering/frontend-source-of-truth.md) |
| Yêu cầu nghiệp vụ từng phiên bản | [`docs/product/backend/versions/`](../docs/product/backend/versions/) |
| Backend runtime và API hiện tại | [Backend README](../backend/README.md) |

Khi các nguồn khác nhau mâu thuẫn: Product Specification quyết định nghiệp vụ; backend implementation quyết định API path/payload/response hiện tại; data contract quyết định persistence; engineering docs quyết định kiến trúc và owner; Project Status ghi nhận mức triển khai và bằng chứng xác minh.

## Giấy phép

Frontend thuộc repository JOBHUB và sử dụng các điều khoản giấy phép của dự án.
