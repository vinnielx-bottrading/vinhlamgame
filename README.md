# Vinh Làm Game

Trang studio trưng bày game web của Vinh, kèm trang quản trị riêng.

```
vinh-lam-game/
├── index.html            Trang cho khách: trang chủ, thể loại, trang game, chơi game, About, Ủng hộ, Liên hệ
├── admin.html            Trang quản trị (không có link nào từ trang chủ) → ten-mien/admin
├── schema.sql            Cấu trúc database Supabase + phân quyền
├── vercel.json           Cấu hình Vercel (/admin, chặn Google index admin)
├── robots.txt
├── .vercelignore         Không đưa schema.sql, README và thư mục Worker lên web
└── cloudflare-worker/    Worker tải hình / video lên Backblaze B2 (xem README riêng trong thư mục)
```

---

## 1. Deploy lên Vercel

1. Tạo repo GitHub, tải toàn bộ nội dung thư mục này lên (giữ `index.html` ở gốc repo).
2. vercel.com → **Add New → Project** → chọn repo → Framework Preset **Other** → **Deploy**.
3. Trang chủ: `https://<project>.vercel.app` · Quản trị: `https://<project>.vercel.app/admin`

Chưa kết nối Supabase thì site chạy **chế độ demo**: dữ liệu admin chỉ lưu trên trình duyệt đang dùng, và admin chưa yêu cầu đăng nhập.

---

## 2. Kết nối Supabase

1. Tạo project Supabase mới.
2. **SQL Editor** → dán toàn bộ `schema.sql` → **Run**. Chạy lại nhiều lần cũng không sao.
3. URL và key **đã điền sẵn** trong `CONFIG` ở đầu cả `index.html` và `admin.html`:

```js
const CONFIG = {
  SUPABASE_URL: 'https://yzyepdkzownfajvqmzbf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bFh-bM6FkvlbIDSDsfX4pA_B7wDMZ2k',   // publishable key, công khai được
  UPLOAD_WORKER_URL: 'https://vinhlamgame.vinnielx.workers.dev'        // chỉ có trong admin.html
};
```

4. Commit lên GitHub, Vercel tự deploy lại.

---

## 3. Đăng nhập quản trị

**Cơ chế:**
- Admin đăng nhập bằng **email và mật khẩu** (Supabase Auth).
- Chỉ email có trong bảng `admins` mới xem và sửa được dữ liệu. Việc kiểm tra nằm ở database, nên dù ai đó tự tạo được tài khoản cũng không làm gì được.
- **Chủ sở hữu duy nhất:** `vinnielx@gmail.com`. Tài khoản này không xoá và không hạ quyền được, và chỉ chủ sở hữu mới thêm hoặc xoá được quản trị viên khác.
- Quản trị viên được thêm sau sửa được toàn bộ nội dung, nhưng không quản lý được danh sách quản trị viên.

**Cài đặt một lần trong Supabase:**

| Bước | Nơi | Việc cần làm |
|---|---|---|
| a | Authentication → **Sign In / Providers** → Email | Tắt **Allow new users to sign up**. Giữ Email provider bật. |
| b | Authentication → **Users → Add user → Create new user** | Email `vinnielx@gmail.com`, đặt mật khẩu, tick **Auto Confirm User** |
| c | Authentication → **URL Configuration** | **Site URL**: `https://<project>.vercel.app` · **Redirect URLs**: thêm `https://<project>.vercel.app/admin` và `https://<project>.vercel.app/admin.html` |
| d | (khuyên dùng) Authentication → **Emails → SMTP Settings** | Cài SMTP riêng (Gmail, Resend, Brevo…). Email mặc định của Supabase bị giới hạn vài email mỗi giờ. |

**Trên trang admin:**
- **Đăng nhập**: email và mật khẩu.
- **Quên mật khẩu?**: nhận email chứa link. Bấm vào sẽ mở lại admin với form **Đặt mật khẩu**.
- **Tab Quản trị viên** (chỉ chủ sở hữu thao tác được):
  - Thêm email, kèm ghi chú.
  - Tick **Gửi email mời** để người đó nhận link đặt mật khẩu. Mục này cần Worker có `SUPABASE_SERVICE_ROLE_KEY`. Không có Worker thì tạo tài khoản ở Supabase › Add user.
  - **Xoá quyền**: người đó vẫn đăng nhập được nhưng không xem hay sửa được gì.

---

## 4. Hình / video trên Backblaze B2 (bucket private, qua Cloudflare Worker)

Toàn bộ code, biến và hướng dẫn nằm trong `cloudflare-worker/README.md`. Tóm tắt:

1. Tạo bucket B2 **Private** và một Application Key chỉ cho bucket đó (Read and Write). Không cần thẻ thanh toán.
2. Tạo Worker trên Cloudflare Dashboard, dán `cloudflare-worker/worker-dashboard.js`, rồi thêm biến ở Settings → Variables and Secrets.
3. **Không cần CORS** trên bucket: để "Do not share any files with any origin".
4. `UPLOAD_WORKER_URL` trong `admin.html` đã điền sẵn Worker `https://vinhlamgame.vinnielx.workers.dev`.

Ảnh được **tự nén WebP** trước khi gửi, mỗi file tối đa khoảng 95 MB. Mỗi ô ảnh có nút **Tải lên B2**, ô video có nút **Tải video lên B2**, kèm % tiến trình. Link file được điền tự động, dạng `https://<worker>.workers.dev/media/banner/images/2026/10/ten-file-a1b2c3d4.jpg`. Worker đọc file từ bucket private và phát cho khách xem.

B2 miễn phí có hạn mức theo ngày. Nên nén ảnh, giữ video banner nhỏ, và dùng YouTube cho video dài. Chi tiết trong README của Worker.

## 5. Giao diện admin

Tab công việc nằm **bên phải**, nội dung của tab đang chọn hiện **bên trái**. Trên điện thoại, dải tab chuyển lên trên cùng và cuộn ngang.

| Nhóm | Tab |
|---|---|
| Nội dung | Game · Banner · Thể loại |
| Khách hàng | Liên hệ (có số tin mới) |
| Cài đặt | Giao diện · Thông tin trang · Quản trị viên · Sao lưu |

---

## 6. Nội dung từng phần

**Trang game:**
- Bố cục: tiêu đề → 2 cột (slide ảnh/video bên trái; bài viết, cụm marketing có dấu tích và nút **Chơi ngay** bên phải) → video YouTube ở giữa (nếu có) → banner quảng cáo (nếu bật).
- Mỗi game có các nhóm: **Cơ bản** (tên, câu ngắn cho banner, thể loại, link chơi, trạng thái, nhãn Hot) · **Hình ảnh** (thumbnail 4:3, KV 16:10, ảnh slide, video ngắn) · **Bài viết** (giới thiệu, cụm marketing mỗi dòng một cụm) · **Video giới thiệu** (YouTube).

**Banner trang chủ:**
- Chỉ hiện hình hoặc video, tự trượt mờ dần, không có chữ.
- **Loại**:
  - *Giới thiệu game*: bấm vào mở trang game.
  - *Quảng cáo của khách hàng*: bấm vào mở website của khách trong tab mới, có nhãn "Quảng cáo" kèm tên nhà tài trợ.
- **Dạng**: hình ảnh 21:8 (2100 × 800, nhận cả GIF động), video ngắn .mp4/.webm, hoặc YouTube. Video tự chạy, không tiếng, lặp lại.
- **Thời gian riêng** (giây) cho từng banner, cùng **ngày bắt đầu / kết thúc** theo hợp đồng quảng cáo. Hết hạn thì banner tự ẩn.

**Ủng hộ:**
- Khách chọn 20.000 / 50.000 / 100.000 / 200.000 ₫ hoặc tự nhập số tiền. Mã VietQR có kèm số tiền được tạo ngay trên trang (Vietcombank 0111000182684).
- Mức tiền, nội dung chuyển khoản và ngân hàng sửa ở tab Thông tin trang.

**Liên hệ:**
- Khách điền họ tên, email, nội dung (bắt buộc) và số điện thoại (không bắt buộc).
- Admin xem ở tab Liên hệ: lọc theo trạng thái, chép email hoặc số điện thoại, đánh dấu đã liên hệ, xoá.
- Khách chỉ gửi được, không đọc được tin của người khác. Có chống spam bằng ô ẩn và giới hạn 30 giây giữa hai lần gửi.

**Tab Giao diện:**
- Tốc độ và chế độ tự trượt của banner.
- Lưới thư viện 2–5 game mỗi hàng, phân trang.
- Hiện số game cạnh tên thể loại.
- Banner quảng cáo dưới thư viện.

---

## Lưu ý

- Link chơi game được nhúng bằng iframe. Nếu game nào chặn nhúng, khách vẫn có nút "Mở tab mới".
- Không có Worker thì ảnh tải lên trong admin được nén và lưu thẳng vào database, nên chỉ hợp với ảnh nhỏ. Có Worker thì mọi ảnh và video đều lên B2.
- `wrangler.toml` chỉ chứa biến không bí mật. Key B2 và service_role key **không bao giờ** ghi vào file hay commit lên GitHub.
