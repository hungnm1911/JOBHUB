# JOBHUB Frontend

Frontend React + Vite của JOBHUB, được tổ chức theo các ranh giới routing, state,
HTTP, realtime và UI riêng biệt.

## Chạy local

```sh
yarn
cp .env.example .env
yarn dev
```

Backend mặc định chạy tại `http://localhost:8000`. Các biến `VITE_*` là cấu hình
public được đóng gói vào client; không đặt secret trong các biến này.

## Scripts

- `yarn dev`: chạy Vite development server.
- `yarn build`: tạo production build.
- `yarn lint`: chạy ESLint.
- `yarn preview`: xem production build ở local.

## Cấu trúc chính

- `src/apis/client`: Axios client dùng chung và chuẩn hóa lỗi HTTP.
- `src/components/common`: component dùng chung ở cấp ứng dụng.
- `src/components/ui`: UI primitives theo quy ước shadcn/ui.
- `src/features/<feature>/components`: component chỉ thuộc một nghiệp vụ.
- `src/layouts`: layout dùng chung cho nested routes.
- `src/pages`: màn hình ánh xạ với URL.
- `src/routes`: router và route groups.
- `src/socket`: Socket.IO client dùng chung, không tự kết nối khi import.
- `src/store`: Redux Toolkit store và hooks dùng chung.
- `src/styles`: Tailwind CSS và theme tokens toàn ứng dụng.
- `src/validation`: validation provider, các schema tách file và React Hook Form resolver.

## Form validation

`src/validation/index.js` là public provider cho toàn ứng dụng. Validator dùng
chung và schema của từng form nằm trong các file chuyên biệt bên dưới
`src/validation/`, sau đó được import và export lại từ `index.js`. Component sử
dụng schema cùng `zodResolver` thông qua `@/validation` để tích hợp React Hook
Form. Xem quy ước chi tiết trong
[`frontend-conventions.md`](../docs/engineering/frontend-conventions.md#validation-boundaries).

Auth state, việc nối route guards vào route thực tế, refresh token và
feature-specific socket listeners sẽ được bổ sung khi có hợp đồng nghiệp
vụ/API tương ứng.
