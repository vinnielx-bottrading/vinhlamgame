-- =====================================================================
-- Vinh Làm Game — chuyển tab Banner cũ sang cách quản lý mới. CHẠY MỘT LẦN, SAU schema.sql.
--   • Banner game cũ  → tick "Banner trang chủ" cho game đó. Nếu banner có ảnh riêng, ảnh đó thành KV chính
--     (KV cũ được cất vào Kho tư liệu, nhóm "KV cũ trước khi đổi", không mất).
--   • Banner quảng cáo cũ → thành quảng cáo trong tab Quảng cáo, vị trí "Banner trang chủ".
-- Chạy lại cũng không nhân đôi dữ liệu. Bảng banners được giữ nguyên để đối chiếu.
-- =====================================================================
begin;

-- 1. Cất KV cũ vào Kho tư liệu trước khi thay
insert into assets (id, kind, title, group_name, category, game_id, url, note, created_by)
select 'kv-old-' || g.id, 'image', g.title || ' – KV cũ', 'KV cũ trước khi đổi', 'KV & Banner', g.id, g.kv,
       'Tự lưu khi chuyển banner sang KV chính', 'migrate-hero'
from games g
join banners b on b.kind = 'game' and b.game_id = g.id and coalesce(b.image, '') <> ''
where coalesce(g.kv, '') <> '' and g.kv <> b.image
on conflict (id) do nothing;

-- 2. Game có banner đang bật → hiện trên banner trang chủ; ảnh banner (21:8) thành KV chính
update games g
set hero = true,
    kv = case when coalesce(b.image, '') <> '' then b.image else g.kv end
from (select distinct on (game_id) * from banners where kind = 'game' and active order by game_id, sort) b
where b.game_id = g.id;

-- 3. Banner quảng cáo cũ → quảng cáo vị trí Banner trang chủ
insert into ads (id, advertiser, title, link_url, placement, hero_on, hero_image, hero_video, hero_sort, start_at, end_at, active, note)
select 'banner-' || id, coalesce(nullif(sponsor, ''), title), title, link_url, 'none', true, image,
       case when media_type in ('video', 'youtube') then video_url else '' end,
       coalesce(sort, 99), coalesce(start_at, ''), coalesce(end_at, ''), active, 'Chuyển từ tab Banner cũ'
from banners where kind = 'ad'
on conflict (id) do nothing;

commit;

select 'Game trên banner trang chủ' as muc, count(*) from games where hero
union all select 'Quảng cáo trên banner trang chủ', count(*) from ads where hero_on;
