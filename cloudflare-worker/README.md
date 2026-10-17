# Cloudflare Worker · Backblaze B2 (bucket private, không cần thẻ thanh toán)

Worker `vinhlamgame` (https://vinhlamgame.vinnielx.workers.dev) làm hai việc:

1. **Tải lên**: admin.html gửi file (đã nén WebP) tới Worker. Worker kiểm tra người gửi là quản trị viên qua Supabase, rồi đẩy file lên bucket B2 private. **Bucket không cần CORS.** Mỗi file tối đa khoảng 95 MB, theo giới hạn request của Cloudflare gói Free.
2. **Phát file cho khách**: Worker đọc file bằng chữ ký riêng và trả về tại `https://<worker>/media/<đường-dẫn>`. Video tua được (Range) và có cache.

```
TẢI LÊN   admin.html ─PUT /upload + token đăng nhập─▶ Worker ─is_admin()─▶ Supabase
                                                      Worker ─PUT có chữ ký─▶ B2 (private)
          admin.html ◀────────── link /media/… ────── Worker

XEM       index.html ─GET /media/banner/…webp─▶ Worker ─GET có chữ ký─▶ B2 (private)
                                            ◀── file + cache 1 năm ──
```

## Cách gắn: dán code trên Dashboard (không cần cài gì)

Dùng file **`worker-dashboard.js`**. File này đã gộp sẵn thư viện, không có dòng `import` nào.

1. Cloudflare Dashboard → **Workers & Pages → Create → Create Worker**, đặt tên `vinhlamgame` → **Deploy**.
2. **Edit code** → xoá hết code mẫu → dán toàn bộ `worker-dashboard.js` → **Deploy**.
3. **Settings → Variables and Secrets**: thêm các biến ở bảng bên dưới.
4. Mở `https://vinhlamgame.vinnielx.workers.dev/health`. Thấy `"ok": true` và `"missing": []` là đủ biến. Mục `mediaBase` cho biết link gốc của file.
5. `UPLOAD_WORKER_URL` trong `admin.html` đã điền sẵn `https://vinhlamgame.vinnielx.workers.dev`.

> `src/index.js` là bản gốc dễ đọc, dùng khi deploy bằng `wrangler` (xem cuối trang). Hai bản giống nhau về chức năng, chỉ chọn **một** cách.

## Biến

| Loại | Tên | Lấy ở đâu / ví dụ | Bắt buộc |
|---|---|---|---|
| Text | `B2_BUCKET` | B2 › Buckets › tên bucket (để **Private**) | Có |
| Text | `B2_ENDPOINT` | B2 › Buckets › **Endpoint**, bỏ `https://` · `s3.us-west-004.backblazeb2.com` | Có |
| Text | `B2_REGION` | Phần giữa của endpoint · `us-west-004` | Có |
| Text | `ALLOWED_ORIGINS` | Tên miền chạy admin, cách nhau dấu phẩy · `https://vinhlamgame.vercel.app` | Có |
| Text | `SUPABASE_URL` | Supabase › Project Settings › API › Project URL | Có |
| Text | `SUPABASE_ANON_KEY` | Supabase › Project Settings › API › anon public | Có |
| **Secret** | `B2_KEY_ID` | B2 › Application Keys › keyID | Có |
| **Secret** | `B2_APP_KEY` | B2 › Application Keys › applicationKey (chỉ hiện 1 lần) | Có |
| **Secret** | `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Project Settings › API › service_role | Không, chỉ để gửi email mời quản trị viên |
| Text | `MAX_UPLOAD_MB` | Giới hạn mỗi file, mặc định `95` (không đặt quá 95 trên gói Free) | Không |
| Text | `PRESIGN_EXPIRES` | Link tải lên hết hạn sau (giây), mặc định `900` | Không |
| Text | `MEDIA_CACHE_SECONDS` | Thời gian giữ cache file, mặc định `31536000` (1 năm) | Không |
| Text | `PUBLIC_BASE_URL` | **Bỏ trống.** Chỉ đặt khi có tên miền riêng trỏ vào Worker · `https://media.ten-mien.com/media` | Không |

**Application Key:** B2 › Application Keys › **Add a New Application Key** → chỉ chọn bucket `vinhlamgame-media` → quyền **Read and Write** → bỏ trống *File name prefix*.

## CORS của bucket B2: không cần

Trong B2 › Buckets › CORS Rules, để nguyên **"Do not share any files with any origin"**. Admin gửi file qua Worker, khách xem file cũng qua Worker, nên trình duyệt không bao giờ gọi thẳng B2.

Chỉ khi muốn dùng `/presign` (trình duyệt gửi thẳng lên B2 cho file trên 95 MB) mới cần luật CORS có `s3_put`. Luật này chỉ đặt được bằng B2 CLI với file `b2-cors-rules.json`:

```bash
pip install b2
b2 account authorize
b2 bucket update --cors-rules "$(cat b2-cors-rules.json)" vinhlamgame allPrivate
```

## Hạn mức miễn phí của B2 khi không có thẻ

Tài khoản chưa thêm thẻ chỉ dùng được trong hạn mức miễn phí. Vượt mức trong ngày, B2 tạm dừng đến hôm sau và Worker trả lỗi `503`, ảnh sẽ không hiện. Theo mặc định của B2:

- Dung lượng lưu: **10 GB**.
- **Class B** (mỗi lần đọc file): khoảng **2.500 lần mỗi ngày**.
- Băng thông tải xuống: khoảng **1 GB mỗi ngày**.

Kiểm tra hạn mức thực tế của tài khoản ở **B2 › Caps & Alerts**.

Worker đã giảm số lần đọc B2:
- Mỗi file có mã ngẫu nhiên trong tên, nên được gắn `Cache-Control: max-age=1 năm, immutable`. Trình duyệt của mỗi khách chỉ tải mỗi file **một lần**.
- Khi Worker chạy trên **tên miền riêng** (ví dụ `media.vinhlamgame.com` thêm vào Cloudflare, rồi Worker › Settings › Domains & Routes › Add Custom Domain), cache của Cloudflare cũng hoạt động: nhiều khách xem cùng một file chỉ tốn **một** lần đọc B2. Trên địa chỉ `workers.dev`, cache này không có tác dụng.

Lời khuyên để không chạm hạn mức:
- Ảnh nên nén WebP hoặc JPG, dưới 500 KB.
- Video banner dưới 5 MB. Video càng lớn thì trình duyệt càng chia nhiều lần đọc (Range).
- Video dài nên để trên YouTube, rồi dùng dạng banner "Video web (YouTube)".

## Endpoint

| Phương thức | Đường dẫn | Đăng nhập | Mô tả |
|---|---|---|---|
| GET/HEAD | `/media/<key>` | Không | Phát file cho khách. Hỗ trợ Range, cache 1 năm |
| GET | `/health` | Không | Kiểm tra cấu hình |
| POST | `/presign` | Có | Link gửi thẳng lên B2 (chỉ dùng khi bucket có CORS `s3_put`) |
| PUT | `/upload?filename=&folder=` | Có | **Admin dùng mặc định.** Gửi file qua Worker lên B2, tối đa ~95 MB |
| DELETE | `/file?key=` | Có | Xoá file trên B2 |
| POST | `/admin/invite` | Có | `{ email, redirectTo }` gửi email mời đặt mật khẩu |

Đường dẫn file luôn có dạng `banner|games|ads|donate|misc / images|videos / năm / tháng / ten-file-xxxxxxxx.đuôi`. Worker chỉ phát file đúng dạng này, nên không ai đọc được file khác trong bucket.

## Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân |
|---|---|
| `401` | Chưa đăng nhập hoặc phiên hết hạn, hãy đăng nhập lại admin |
| `403 Tài khoản này không phải quản trị viên` | Email chưa có trong tab Quản trị viên |
| Tải lên báo "Không kết nối được Worker" | `ALLOWED_ORIGINS` chưa có đúng tên miền admin (có `https://`, không có `/` cuối) |
| `415` / `413` | Loại file không hỗ trợ / file lớn hơn `MAX_UPLOAD_MB` |
| Ảnh không hiện, mở link `/media/…` thấy `502` | Sai `B2_ENDPOINT`, `B2_REGION` hoặc key không có quyền Read |
| Mở link `/media/…` thấy `503` | Hết hạn mức miễn phí trong ngày của B2 |

## Cách thay thế: deploy bằng wrangler

```bash
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APP_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # không bắt buộc
npx wrangler deploy
```

Biến thường sửa trong `wrangler.toml`.
