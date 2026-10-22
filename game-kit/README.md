# Bộ gắn cho từng game (game-kit)

Gắn 3 thứ dưới đây vào **mỗi game** (repo riêng của game, không phải repo vinhlamgame).

## 1. Đoạn code Vinh Làm Game (bắt buộc)

Thêm vào cuối `<body>` của game. Đổi `data-game` thành slug của game trên vinhlamgame (xem ở admin › Game › Xuất bản › Đường dẫn):

```html
<script src="https://vinhlamgame.vercel.app/vlg.js" data-game="dapa-dap-pha" defer></script>
```

Đoạn code tự làm:
- Thêm nút nhỏ **← Vinh Làm Game** ở góc màn hình, mờ dần sau 4 giây. Đổi góc bằng `data-pos="tr"` (`tl`, `tr`, `bl`, `br`) nếu đè nút của game. Tắt bằng `data-back="off"`.
- Trên điện thoại (chưa thêm ra màn hình chính): hiện hướng dẫn thêm game ra màn hình chính. Trên Android Chrome, nếu game có manifest (mục 2), hướng dẫn có nút cài một chạm. Bấm "Để sau" thì 3 ngày sau mới nhắc lại. Tắt bằng `data-install="off"`.
- Khi game chạy trong khung của vinhlamgame (chế độ rạp chiếu trên máy tính), không hiện gì.

Gọi trong code game:
- `VLG.more()` ở màn hình thắng / thua: hiện thẻ "Chơi game khác · Chia sẻ · Ủng hộ studio".
- `VLG.install()` nếu muốn có nút "Cài ra màn hình chính" trong menu game.

## 2. Manifest (nên có)

Để khi mở từ màn hình chính, game chạy **toàn màn hình, xoay ngang**, có biểu tượng đẹp:

1. Chép `manifest.json` vào thư mục gốc của game, sửa `name`, `short_name`, `orientation` (`landscape` ngang / `portrait` dọc).
2. Thêm 2 ảnh vuông `icon-192.png` và `icon-512.png` (PNG, nền đặc, chủ thể ở giữa).
3. Thêm vào `<head>`:

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#6B1A2D">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="icon-512.png">
```

## 3. Màn hình thắng / thua

Gọi `VLG.more()` sau khi hiện kết quả, hoặc gắn vào một nút "Chơi game khác".
