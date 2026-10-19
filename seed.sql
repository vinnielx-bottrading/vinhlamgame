-- =====================================================================
-- Vinh Làm Game — DỮ LIỆU MẪU (seed.sql)
-- Chỉ dùng khi CÀI MỚI: chạy schema.sql trước, rồi chạy file này MỘT lần.
-- An toàn khi lỡ chạy lại: mỗi phần chỉ thêm khi bảng tương ứng còn TRỐNG,
-- nên game / thể loại bạn đã xoá trong admin sẽ KHÔNG quay lại.
-- Database đang dùng (đã có dữ liệu) thì KHÔNG cần chạy file này.
-- =====================================================================

-- Thông tin trang: chỉ điền khi dòng cài đặt còn trống
update settings set data = jsonb_build_object(
  'studio_name', 'Vinh Làm Game',
  'tagline', 'Những trò chơi nhỏ làm bằng HTML5, chơi ngay trên trình duyệt.',
  'footer_text', 'Làm game nhỏ, chơi trên trình duyệt.',
  'bank_name', 'Vietcombank', 'bank_bin', '970436',
  'bank_account', '0111000182684', 'bank_holder', 'NGUYEN HOANG VINH',
  'donate_amounts', '20000, 50000, 100000, 200000', 'donate_memo', 'Ung ho Vinh Lam Game'
) where id = 1 and (data is null or data = '{}'::jsonb);

-- Thể loại mẫu: chỉ khi bảng genres chưa có dòng nào
insert into genres (id, name, slug, sort)
select * from (values
  ('g-phieu-luu', 'Phiêu lưu',  'phieu-luu',  1),
  ('g-platformer','Platformer', 'platformer', 2),
  ('g-hanh-dong', 'Hành động',  'hanh-dong',  3),
  ('g-casual',    'Casual',     'casual',     4),
  ('g-thieu-nhi', 'Thiếu nhi',  'thieu-nhi',  5)
) v(id, name, slug, sort)
where not exists (select 1 from genres);

-- Game mẫu: chỉ khi bảng games chưa có dòng nào
insert into games (id, slug, title, tagline, genre_ids, play_url, hot, sort)
select id, slug, title, tagline, genre_ids::jsonb, play_url, hot, sort from (values
  ('game-laj',     'hanh-tinh-laj',             'Hành Tinh LAJ',             'Một chuyến platformer tĩnh lặng trên hành tinh lạ.', '["g-platformer","g-phieu-luu"]', 'https://hanhtinhlaj.vercel.app',           true,  1),
  ('game-chu',     'chu-va-qua-trung-that-lac', 'Chu và Quả Trứng Thất Lạc', 'Cùng chú khủng long Chu đi tìm quả trứng bị lạc.',    '["g-phieu-luu","g-thieu-nhi"]',  'https://chuvaquatrungkhunglong.vercel.app', true,  2),
  ('game-monster', 'monster-breakout',          'Monster Breakout',          'Bắn súng sinh tồn: vượt từng cổng, diệt quái virus.', '["g-hanh-dong"]',                '',                                          true,  3)
) v(id, slug, title, tagline, genre_ids, play_url, hot, sort)
where not exists (select 1 from games);
