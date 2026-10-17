# Vinh Làm Game

Trang studio trưng bày game web của Vinh.

| File | Dùng cho |
|---|---|
| `index.html` | Trang công khai cho khách: trang chủ, thể loại, trang game, trang chơi, About, Ủng hộ |
| `admin.html` | Trang quản trị riêng (không có link từ trang chủ). Truy cập: `ten-mien/admin` |
| `schema.sql` | Cấu trúc database Supabase |
| `vercel.json`, `robots.txt` | Cấu hình Vercel, chặn Google index trang admin |

## Deploy lên Vercel

1. Tạo repo GitHub mới, tải toàn bộ các file trong thư mục này lên (giữ `index.html` ở gốc repo).
2. Vào vercel.com → **Add New → Project** → chọn repo → Framework Preset: **Other** → **Deploy**.
3. Trang chủ: `https://<ten-project>.vercel.app` · Quản trị: `https://<ten-project>.vercel.app/admin`

## Kết nối Supabase (để admin cập nhật cho mọi khách thấy)

Khi chưa điền Supabase, site chạy chế độ demo: dữ liệu admin chỉ lưu trên trình duyệt đang dùng.

1. Tạo project Supabase mới.
2. Mở `schema.sql`, thay `ADMIN_EMAIL@example.com` bằng email admin, rồi chạy toàn bộ trong **SQL Editor**.
3. **Authentication → Users → Add user**: tạo tài khoản admin với đúng email trên.
4. **Authentication → Sign In / Providers**: tắt **Allow new users to sign up**.
5. **Project Settings → API**: copy **Project URL** và **anon public key**, dán vào `CONFIG` ở đầu **cả hai** file `index.html` và `admin.html`:

```js
const CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...'
};
```

6. Commit lên GitHub, Vercel tự deploy lại.

## Nội dung trang game

Bố cục: tiêu đề game → 2 cột (slide ảnh/video | bài viết + cụm marketing có dấu tích + nút Chơi ngay) → video YouTube ở giữa (nếu có) → banner quảng cáo (nếu bật).

Trong admin, mỗi game có:

- **Cơ bản**: tên, câu giới thiệu ngắn (dùng cho banner), thể loại, link chơi, trạng thái, nhãn Hot.
- **Hình ảnh**: thumbnail 4:3 (ô game ở thư viện), KV 16:10 (ảnh đầu slide), ảnh slide thêm, video ngắn .mp4/.webm/.gif trong slide.
- **Bài viết**: bài giới thiệu, cụm từ marketing (mỗi dòng một cụm).
- **Video giới thiệu**: link YouTube. Để trống thì ẩn.

## Banner trang chủ

Banner chỉ hiện hình hoặc video, tự trượt mờ dần, không có chữ. Mỗi banner trong admin có:

- **Loại**: *Giới thiệu game* (bấm vào mở trang game) hoặc *Quảng cáo của khách hàng* (bấm vào mở website của khách trong tab mới, có nhãn "Quảng cáo" kèm tên nhà tài trợ).
- **Dạng**: hình ảnh 21:8 (2100 × 800), video ngắn .mp4/.webm, hoặc video YouTube. Video tự chạy, không tiếng, lặp lại.
- **Thời gian riêng** (giây) cho từng banner, **ngày bắt đầu / kết thúc** để chạy theo hợp đồng quảng cáo. Hết hạn thì banner tự ẩn.

## Ủng hộ

Khách chọn 20.000 / 50.000 / 100.000 / 200.000 ₫ hoặc tự nhập số tiền. Mã VietQR có kèm số tiền và nội dung được tạo ngay trên trang, quét bằng mọi app ngân hàng. Các mức tiền, nội dung chuyển khoản và số tài khoản sửa ở tab Thông tin trang.

## Liên hệ

Khách gửi lời nhắn ở trang **Liên hệ** (họ tên, email, nội dung bắt buộc; số điện thoại không bắt buộc). Admin xem ở tab **Liên hệ**: lọc Chưa liên hệ / Đã liên hệ, chép email hoặc số điện thoại, đánh dấu đã liên hệ, xoá. Tab hiện số tin nhắn mới.

Tin nhắn lưu ở bảng `messages` trên Supabase: khách chỉ gửi được, không đọc được tin của người khác. Form có chống spam cơ bản (ô ẩn và giới hạn 30 giây giữa 2 lần gửi).

## Tab Giao diện trong admin

- **Banner trang chủ**: bật/tắt tự trượt, thời gian mỗi banner (giây).
- **Thư viện game**: số game mỗi hàng (2–5), số hàng mỗi trang, bật/tắt phân trang.
- **Thể loại**: hiện/ẩn số game trong menu. Từng thể loại có mô tả riêng và nút ẩn/hiện ở tab Thể loại.
- **Banner quảng cáo** dưới thư viện: bật/tắt, tỉ lệ, ảnh, link. Chưa có ảnh thì hiện ô chào bán quảng cáo.

Nếu đã chạy `schema.sql` bản cũ, chạy lại bản mới (an toàn, chỉ bổ sung cột).

## Lưu ý

- Link chơi game được nhúng bằng iframe. Game deploy trên Vercel/GitHub Pages nhúng được bình thường; nếu game nào chặn nhúng, khách vẫn có nút "Mở trong tab mới".
- Ảnh tải lên trong admin được nén và lưu thẳng vào database. Với ảnh lớn hoặc nhiều ảnh, nên dán link ảnh (ví dụ ảnh để trong repo GitHub) thay vì tải lên.
