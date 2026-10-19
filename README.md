# Vinh Làm Game

Trang studio trưng bày game web của Vinh, kèm trang quản trị riêng.

```
vinh-lam-game/
├── index.html            Trang cho khách: trang chủ, thể loại, trang game, chơi game, About, Ủng hộ, Liên hệ
├── admin.html            Trang quản trị (không có link nào từ trang chủ) → ten-mien/admin
├── schema.sql            Cấu trúc database Supabase + phân quyền (chạy lại thoải mái, không đụng dữ liệu)
├── seed.sql              Dữ liệu mẫu — chỉ dùng khi cài mới, database còn trống
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
2. **SQL Editor** → dán toàn bộ `schema.sql` → **Run**.
   - Chạy lại bao nhiêu lần cũng được. File này chỉ tạo hoặc bổ sung cấu trúc bảng và phân quyền, **không** thêm lại hay ghi đè game, banner, thể loại, tư liệu, tin nhắn anh đã tạo hoặc xoá trong admin.
   - **Cài mới** (database trống) và muốn có sẵn vài game mẫu: chạy thêm `seed.sql` một lần. File này chỉ thêm khi bảng còn trống, nên lỡ chạy lại cũng không sao. Database đang dùng thì **không cần** chạy `seed.sql`.
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
- **Slide** dùng tỉ lệ chuẩn **16:9 (1920 × 1080)**. Ảnh khác tỉ lệ vẫn hiện đủ, không bị cắt, phần trống có nền mờ của chính ảnh đó.
- **KV chính** chỉ làm ảnh đầu slide khi admin tick ô "Dùng KV chính làm ảnh đầu tiên của slide" (mặc định không tick). Không tick thì slide bắt đầu từ ảnh số 1.
- **Ảnh slide giới thiệu**:
  - Chọn hoặc **kéo thả nhiều ảnh cùng lúc**. Mỗi ảnh xử lý riêng, ảnh lỗi không làm hỏng ảnh khác. Có báo "Đã thêm 7/8 ảnh" kèm tên ảnh lỗi.
  - **Kéo từng ảnh để đổi vị trí**, hoặc dùng nút ‹ › trên điện thoại.
- **Bài viết giới thiệu**: trình soạn thảo có:
  - Tiêu đề H2/H3, đậm, nghiêng, gạch chân, danh sách, trích dẫn, đường kẻ, link.
  - Chèn ảnh: chọn file, kéo thả hoặc dán. Ảnh tự nén WebP.
  - Dán từ Word / Google Docs được, định dạng lạ và mã độc tự lọc bỏ.
- Mọi ô ảnh và video đều nhận **kéo thả file**.

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

## Tiêu chuẩn ảnh

| Dùng cho | Tỉ lệ | Kích thước chuẩn |
|---|---|---|
| Thumbnail (ô game ở thư viện) | 4:3 | 1200 × 900 |
| KV chính (dự phòng cho banner trang chủ) | 16:9 | 1920 × 1080 |
| Ảnh slide giới thiệu | 16:9 | 1920 × 1080 |
| Banner trang chủ | 21:8 | 2100 × 800 |
| Banner quảng cáo dưới thư viện | 6:1 | 1200 × 200 |

Ảnh tải lên được tự nén WebP theo kích thước trên. Ảnh slide khác tỉ lệ vẫn hiện đủ, không bị cắt.

## Kho tư liệu

Tab **Kho tư liệu** trong admin lưu ảnh, video, nội dung/caption và link để dành dùng sau.

- **Nhóm:** kho hiển thị theo nhóm (thẻ có ảnh bìa, số tư liệu, ngày cập nhật). Bấm vào nhóm để xem nội dung bên trong.
- **Lưu:**
  - Ở trang danh sách nhóm: gõ **Tên nhóm**, chọn danh mục, rồi kéo thả hoặc chọn nhiều ảnh, video. Nếu thả file trước khi đặt tên, file được giữ lại chờ; đặt tên rồi bấm **Tải lên**.
  - Bên trong một nhóm: kéo thả file vào là thêm thẳng vào nhóm đó.
  - Ảnh nén WebP 2560px; bỏ tick nếu muốn giữ ảnh gốc.
  - Nút **+ Nội dung / caption**, **+ Link để dành**, **+ Link video / YouTube** (trong form có ô **Nhóm**).
- **Sắp xếp nhóm:** **Đổi tên nhóm** (trùng tên nhóm có sẵn thì gộp lại), **Xoá nhóm** (xoá cả file trên B2), tick chọn từng tư liệu rồi **Chuyển nhóm**. Tư liệu tải lên trước khi có tính năng nhóm nằm ở **Chưa đặt nhóm**, tick chọn rồi chuyển vào nhóm.
- **Phân loại:** danh mục (có sẵn: KV & Banner, Ảnh game, Video, Bài viết & Caption, Logo & Thương hiệu, Link tham khảo; gõ thêm danh mục mới tuỳ ý), gắn với game, tag, ghi chú.
- **Tìm:** lọc theo loại, danh mục, game; ô tìm kiếm tìm trong tên nhóm, tên file, tag, nội dung, ghi chú.
- **Dùng:** nút **Chép link** / **Chép nội dung**. Mọi ô ảnh, ô slide và ô video trong form đều có nút **Từ tư liệu** để chọn thẳng từ kho; ô slide chọn được nhiều ảnh, theo thứ tự bấm. Hộp chọn có bộ lọc theo nhóm.
- Tư liệu chỉ quản trị viên xem được (bảng `assets` trong Supabase). File nằm trong thư mục `library/` trên B2. Xoá tư liệu thì xoá luôn file trên B2.

## Quảng cáo theo chiến dịch

Tab **Quảng cáo** quản lý banner của khách hàng ở hai vị trí: dưới thư viện (trang chủ) và dưới bài giới thiệu (trang game). Banner đầu trang chủ vẫn quản lý ở tab **Banner** (loại Quảng cáo).

- **Gói vị trí:** Toàn trang (trang chủ + mọi trang game) · Chỉ trang chủ · Mọi trang game · Trang của game chọn riêng. Ở trang của một game, quảng cáo mua riêng cho game đó được ưu tiên hơn quảng cáo toàn trang.
- **Thời gian:** ngày bắt đầu / kết thúc, hết hạn tự tắt. Nhiều quảng cáo cùng vị trí thì luân phiên theo **mức ưu tiên** (1–10).
- **Ảnh:** ảnh chính theo tỉ lệ ở tab Giao diện (mặc định 6:1, 1200 × 200); thêm **ảnh cho điện thoại** 3:1 (900 × 300) để banner không bị quá thấp trên điện thoại.
- **Ghi chú nội bộ** (giá, hợp đồng) chỉ quản trị viên đọc được, khách không thấy kể cả qua API.
- Dưới mỗi banner có dòng nhỏ **Liên hệ đặt quảng cáo**, dẫn về trang Liên hệ với nội dung điền sẵn đúng vị trí khách đang xem. Vị trí chưa có quảng cáo hiện ô chào bán (bật / tắt ở tab Giao diện).
- Nút **Báo cáo** ở mỗi quảng cáo chép số liệu (lượt hiển thị, người xem, lượt bấm, CTR) để gửi khách.
- Tên lớp CSS và thư mục ảnh không dùng chữ "ad" để trình chặn quảng cáo (AdBlock, uBlock…) không ẩn banner. Ảnh quảng cáo tải lên trước đây nằm trong thư mục `ads/` vẫn có thể bị chặn: hãy tải lại ảnh đó.

## Thống kê

Tab **Thống kê** (nhóm Khách hàng) cho số liệu 7 ngày / 30 ngày / 90 ngày / 1 năm:

- Khách truy cập (người khác nhau), lượt xem trang, lượt chơi game, người chơi, tỉ lệ khách dùng điện thoại.
- Biểu đồ theo ngày (khách / lượt xem / lượt chơi), có dạng bảng.
- Game được chơi nhiều nhất: lượt xem trang game, lượt chơi, người chơi, tỉ lệ bấm chơi.
- Quảng cáo: hiển thị, người xem, lượt bấm, CTR cho cả banner đầu trang và banner theo chiến dịch.
- Khách đến từ đâu (Google, Facebook, Zalo… hoặc truy cập trực tiếp).

Cách tính: mỗi trình duyệt có một mã ngẫu nhiên, không thu thông tin cá nhân. Một lượt hiển thị quảng cáo được tính khi banner hiện ít nhất một nửa trên màn hình, mỗi lần mở trang. Trình duyệt đã đăng nhập admin không bị tính. Dữ liệu lưu trong bảng `events`; mỗi sự kiện khoảng 150 byte, 100.000 sự kiện khoảng 15 MB. Muốn xoá dữ liệu cũ hơn 1 năm, chạy: `delete from events where at < now() - interval '1 year';`

## Cập nhật trực tiếp

Admin bấm **Lưu** thì trang khách đang mở tự cập nhật sau khoảng 1 giây, không cần tải lại (Supabase Realtime, đã bật trong `schema.sql`). Khách đang chơi game thì trang chờ đến khi họ rời trang chơi mới cập nhật, để không làm gián đoạn game. Nếu Realtime chưa bật, trang vẫn tự tải lại dữ liệu khi khách quay lại tab sau hơn 1 phút.

## Lưu ý

- Khi đã cấu hình Supabase mà trang không kết nối được (mạng lỗi, Supabase bảo trì), khách thấy thông báo "Trang đang được cập nhật" kèm nút tải lại. Trang **không** hiện dữ liệu mẫu.

- Trên máy tính, game được nhúng bằng iframe; nút "Toàn màn hình" phủ kín cửa sổ nếu trình duyệt không cho toàn màn hình thật. Trên điện thoại và máy tính bảng, nút "Chơi ngay" mở thẳng link game trong cùng tab (iPhone không cho iframe toàn màn hình, và chặn đăng nhập / lưu tiến độ của game trong iframe khác tên miền).
- Khung quảng cáo chưa có khách đặt dẫn về Liên hệ, điền sẵn nội dung đặt quảng cáo. Tin nhắn này có nhãn "Quảng cáo" trong admin.
- Không có Worker thì ảnh tải lên trong admin được nén và lưu thẳng vào database, nên chỉ hợp với ảnh nhỏ. Có Worker thì mọi ảnh và video đều lên B2.
- `wrangler.toml` chỉ chứa biến không bí mật. Key B2 và service_role key **không bao giờ** ghi vào file hay commit lên GitHub.
