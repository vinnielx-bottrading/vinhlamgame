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
| Nội dung | Game · Quảng cáo · Thể loại |
| Tư liệu | Kho tư liệu |
| Khách hàng | Thống kê · Liên hệ (có số tin mới) |
| Cài đặt | Giao diện · Thông tin trang · Quản trị viên · Sao lưu |

---

## 6. Nội dung từng phần

**Trang game (một template chung, mỗi game đổi một màu nhấn):**
- Từ trên xuống:
  1. Đầu trang: slide ảnh/video (vuốt được trên điện thoại) bên trái; nhãn, tên game, tên phụ, câu hook, mô tả ngắn, nút **Chơi ngay** và nút chia sẻ (Facebook, X, Instagram, Zalo, chép link) bên phải.
  2. Điểm nổi bật: tối đa 3 thẻ.
  3. Cách chơi: mặc định tắt.
  4. Câu chuyện (bài viết dài): mặc định tắt.
  5. Hình ảnh: tự lấy các ảnh có caption trong slide, bấm để xem lớn.
  6. Banner quảng cáo theo game.
  7. Dải kêu gọi chơi.
  8. Game khác của studio (ưu tiên cùng thể loại).
- Trên điện thoại: tên game và nút Chơi ngay lên trước slide; cuộn qua thì hiện thanh **Chơi ngay** dính đáy màn hình.
- Tick **Miễn phí** thì nút ghi "Chơi ngay · Miễn phí", bỏ tick thì chỉ "Chơi ngay". Chưa có link chơi thì hiện "Sắp ra mắt".
- Form sửa game trong admin xếp các khối đúng thứ tự trên trang (đánh số 1 → 7), có thanh đi nhanh và nút Lưu dính đáy.
- **Slide**: ảnh, video .mp4/.webm và link YouTube xếp chung một danh sách, kéo để đổi thứ tự, mỗi mục có ô caption. Video và link YouTube cũ của game tự gộp vào slide khi mở form sửa. Cụm marketing cũ tự chuyển thành thẻ Điểm nổi bật.
- Icon mạng xã hội lấy từ bộ Simple Icons (giấy phép CC0), nhúng sẵn trong trang. Instagram và Zalo không có link chia sẻ trên web: trên điện thoại mở bảng chia sẻ của máy, trên máy tính tự chép link.

**Banner trang chủ (hero):**
- Chỉ hiện hình hoặc video, tự trượt mờ dần, không có chữ.
- Gồm **KV chính của các game được bật cột "Banner trang chủ"** trong tab Game, cộng các **quảng cáo có vị trí Banner trang chủ** trong tab Quảng cáo. Số lượng không giới hạn, admin tự quyết. Thứ tự: cột Thứ tự của game và ô "Thứ tự trong banner trang chủ" của quảng cáo, xếp chung.
- Game bật nhưng chưa có KV chính thì không lên banner (danh sách game báo "Thiếu KV"). Không có slide nào thì ẩn hẳn khu vực banner.
- Không còn tự lấy game Hot. Nhãn **Hot** chỉ là tag nổi bật trên thẻ game trong thư viện.
- Slide quảng cáo bấm vào mở website của khách trong tab mới, có nhãn "Quảng cáo" kèm tên khách. Nhận ảnh 21:8 (cả GIF động), video .mp4 hoặc YouTube, chạy theo ngày bắt đầu / kết thúc.

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
- Ô chào bán khi vị trí quảng cáo còn trống, tỉ lệ banner ngang.

---

## Chuyển từ tab Banner cũ (chạy một lần)

Sau khi chạy lại `schema.sql`, chạy **`migrate-hero.sql`** một lần:
- Game đang có banner → được bật "Banner trang chủ". Nếu banner có ảnh riêng, ảnh đó thành KV chính; KV cũ được cất vào Kho tư liệu, nhóm "KV cũ trước khi đổi".
- Banner quảng cáo cũ → thành quảng cáo vị trí Banner trang chủ trong tab Quảng cáo.
- Bảng `banners` cũ giữ nguyên, không còn dùng.

## Tiêu chuẩn ảnh

| Dùng cho | Tỉ lệ | Kích thước chuẩn |
|---|---|---|
| ① KV chính = banner lớn trang chủ | 21:8 | 2100 × 800 |
| ② Thumbnail (ô game ở thư viện) | 4:3 | 1200 × 900 |
| ③ Ảnh slide (trang giới thiệu game) | 16:9 | 1920 × 1080 |
| Quảng cáo trên banner trang chủ | 21:8 | 2100 × 800 |
| Quảng cáo banner ngang | 6:1 (điện thoại 3:1) | 1200 × 200 (900 × 300) |

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

Tab **Quảng cáo** quản lý mọi quảng cáo của khách, mỗi khách một dòng. Hai vị trí, chọn một hoặc cả hai:

1. **Banner trang chủ (hero):** chạy chung với KV các game, ảnh 21:8 hoặc video.
2. **Banner ngang:** dưới thư viện (trang chủ) và dưới bài giới thiệu (trang game), theo gói bên dưới.

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
