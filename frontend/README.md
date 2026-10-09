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
- `src/components/ui`: UI primitives theo quy ước shadcn/ui.
- `src/layouts`: layout dùng chung cho nested routes.
- `src/pages`: màn hình ánh xạ với URL.
- `src/routes`: router và route groups.
- `src/socket`: Socket.IO client dùng chung, không tự kết nối khi import.
- `src/store`: Redux Toolkit store và hooks dùng chung.
- `src/styles`: Tailwind CSS và theme tokens toàn ứng dụng.
- `src/validation`: Zod validators dùng chung và React Hook Form resolver.

## Form validation

```jsx
import { useForm } from 'react-hook-form'

import { validators, z, zodResolver } from '@/validation'

const formSchema = z.object({
  email: validators.email(),
  displayName: validators.requiredText(),
})

const form = useForm({
  resolver: zodResolver(formSchema),
})
```

Các schema chứa quy tắc nghiệp vụ nên nằm gần feature sở hữu chúng và có thể
kết hợp các validator dùng chung từ `@/validation`.

Auth state, route guards, refresh token và feature-specific socket listeners sẽ
được bổ sung khi có hợp đồng nghiệp vụ/API tương ứng.
