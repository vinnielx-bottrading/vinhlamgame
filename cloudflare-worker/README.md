# Cloudflare Worker · tải hình / video lên Backblaze B2

Worker `vinhlamgame-media` nhận yêu cầu từ **admin.html**, kiểm tra người gọi là quản trị viên (qua Supabase), rồi cấp link tải file thẳng lên bucket B2. File không đi qua Worker nên không bị giới hạn 100 MB của Cloudflare.

```
admin.html ──(1) POST /presign + token đăng nhập──▶ Worker ──kiểm tra is_admin()──▶ Supabase
admin.html ◀─(2) uploadUrl có chữ ký, publicUrl────  Worker
admin.html ──(3) PUT file (có thanh tiến trình)─────────────────────────────────▶ Backblaze B2
admin.html ──(4) lưu publicUrl vào ô ảnh / video────────────────────────────────▶ Supabase
```

## Các file

| File | Nội dung |
|---|---|
| `src/index.js` | Code Worker |
| `wrangler.toml` | Tên Worker + biến không bí mật |
| `package.json` | Thư viện `aws4fetch` (ký request S3) và `wrangler` |
| `.dev.vars.example` | Mẫu biến bí mật khi chạy thử trên máy |
| `b2-cors-rules.json` | Luật CORS cho bucket để trình duyệt PUT được file |

## Biến cần chuẩn bị

### Biến thường (`wrangler.toml` › `[vars]`)

| Biến | Lấy ở đâu | Ví dụ |
|---|---|---|
| `B2_BUCKET` | B2 › Buckets › tên bucket | `vinhlamgame-media` |
| `B2_ENDPOINT` | B2 › Buckets › **Endpoint** (bỏ `https://`) | `s3.us-west-004.backblazeb2.com` |
| `B2_REGION` | Phần giữa của endpoint | `us-west-004` |
| `PUBLIC_BASE_URL` | Link công khai của bucket, xem mục bên dưới | `https://f004.backblazeb2.com/file/vinhlamgame-media` |
| `ALLOWED_ORIGINS` | Tên miền chạy admin.html, cách nhau dấu phẩy | `https://vinhlamgame.vercel.app` |
| `SUPABASE_URL` | Supabase › Project Settings › API › Project URL | `https://abcd.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase › Project Settings › API › anon public | `eyJ...` |
| `MAX_UPLOAD_MB` | Giới hạn mỗi file | `200` |
| `PRESIGN_EXPIRES` | Link tải lên hết hạn sau (giây) | `900` |

### Biến bí mật (đặt bằng `wrangler secret put`, không ghi vào file)

| Biến | Lấy ở đâu | Bắt buộc |
|---|---|---|
| `B2_KEY_ID` | B2 › Application Keys › keyID | Có |
| `B2_APP_KEY` | B2 › Application Keys › applicationKey (chỉ hiện 1 lần) | Có |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API › service_role | Không, chỉ để gửi email mời quản trị viên |

> Application Key nên tạo riêng cho bucket này, quyền **Read and Write**, chỉ cho bucket `vinhlamgame-media`.

### `PUBLIC_BASE_URL`

- **Cách nhanh:** bucket để **Public**, upload thử 1 file, mở chi tiết file trên B2 và lấy phần trước tên file của **Friendly URL**, ví dụ `https://f004.backblazeb2.com/file/vinhlamgame-media`.
- **Khuyên dùng:** trỏ tên miền riêng qua Cloudflare (ví dụ `media.vinhlamgame.com` CNAME tới `f004.backblazeb2.com`, bật proxy, thêm Transform Rule thêm tiền tố `/file/vinhlamgame-media`). Khi đó `PUBLIC_BASE_URL = https://media.vinhlamgame.com`. Tải xuống giữa B2 và Cloudflare miễn phí, có cache CDN.

## Triển khai

```bash
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APP_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # không bắt buộc
npx wrangler deploy
```

Wrangler in ra địa chỉ Worker, ví dụ `https://vinhlamgame-media.<tài-khoản>.workers.dev`. Mở `/health` để kiểm tra: `"ok": true` và `"missing": []` là đã đủ biến.

### Bật CORS cho bucket (bắt buộc để trình duyệt PUT thẳng lên B2)

Sửa `allowedOrigins` trong `b2-cors-rules.json` cho đúng tên miền của anh, rồi chạy bằng B2 CLI:

```bash
b2 account authorize            # dùng master key hoặc key có quyền writeBuckets
b2 bucket update --cors-rules "$(cat b2-cors-rules.json)" vinhlamgame-media allPublic
```

Hoặc trên web: B2 › Buckets › **CORS Rules** › *Share everything in this bucket with … one origin*, nhập tên miền, chọn **Both** (S3 + B2 native), bấm Update. Cách làm trên web không cho chọn phương thức PUT, nên dùng CLI là chắc chắn nhất.

### Gắn vào admin

Trong `admin.html`, phần `CONFIG` ở đầu file:

```js
UPLOAD_WORKER_URL: 'https://vinhlamgame-media.<tài-khoản>.workers.dev'
```

Các ô ảnh và video trong admin sẽ có thêm nút **Tải lên B2**. File được xếp theo thư mục:

```
banner/images/2026/10/ten-file-a1b2c3d4.jpg
banner/videos/2026/10/ten-file-9f8e7d6c.mp4
games/images/…   ads/images/…   donate/images/…   misc/…
```

## Endpoint

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra cấu hình (không cần đăng nhập) |
| POST | `/presign` | `{ filename, contentType, size, folder }` → `{ uploadUrl, headers, key, publicUrl }` |
| PUT | `/upload?filename=&folder=` | Tải qua Worker (dự phòng, tối đa ~100 MB) |
| DELETE | `/file?key=` | Xoá file trên B2 |
| POST | `/admin/invite` | `{ email, redirectTo }` gửi email mời đặt mật khẩu cho quản trị viên mới |

Mọi endpoint trừ `/health` cần header `Authorization: Bearer <access_token>` của phiên đăng nhập admin, và email phải có trong bảng `admins`.

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân |
|---|---|
| `401 Chưa đăng nhập` / `Phiên đăng nhập hết hạn` | Đăng nhập lại admin.html |
| `403 Tài khoản này không phải quản trị viên` | Email chưa có trong tab Quản trị viên |
| Upload báo lỗi mạng / CORS ngay khi bắt đầu | Bucket chưa có CORS rule cho tên miền admin |
| `415` | Loại file không được hỗ trợ |
| `413` | File lớn hơn `MAX_UPLOAD_MB` |
| Ảnh tải lên được nhưng không hiện | Bucket đang Private hoặc `PUBLIC_BASE_URL` sai |
