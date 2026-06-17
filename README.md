# ID Photo Management

Ứng dụng quản lý ảnh thẻ với web app React Vite, API Express, Supabase cho dữ liệu, Cloudinary cho lưu trữ ảnh, và Banana.dev là thành phần xử lý ảnh tùy chọn.

## Local setup

1. Cài Node.js và npm.
2. Cài dependencies theo package hiện có:

   ```sh
   npm install
   ```

3. Tạo file môi trường từ file mẫu:

   ```sh
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

4. Điền các biến Supabase, Cloudinary, và Banana.dev nếu dùng xử lý ảnh qua Banana.dev.

Không commit `.env`, `.env.local`, hoặc bất kỳ file nào chứa secret. Chỉ commit các file mẫu như `.env.example`.

## Cấu trúc repo

```text
.
├── apps/
│   ├── api/        # Express API
│   └── web/        # React Vite web app
├── docs/           # Tài liệu dự án
├── supabase/       # Migration và seed Supabase
├── package.json    # Package root
└── README.md
```

## Lệnh chạy dự kiến

Hiện tại root `package.json` chưa có script chạy API/web riêng. Khi các package tương ứng được bổ sung, lệnh dự kiến:

```sh
# API
cd apps/api
npm install
npm run dev
```

```sh
# Web
cd apps/web
npm install
npm run dev
```

API mặc định dùng `PORT=4000`. Web mặc định trỏ đến `http://localhost:4000/api/v1` qua `VITE_API_BASE_URL`.

## Kiến trúc

- React Vite cho giao diện web.
- Express cho backend API.
- Supabase cho database, auth/storage-related config nếu cần.
- Cloudinary cho quản lý và phân phối ảnh.
- Banana.dev optional cho pipeline xử lý ảnh bằng model bên ngoài.
