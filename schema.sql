-- Vinh Làm Game — Supabase schema
-- Chạy toàn bộ file này trong SQL Editor của project Supabase.
-- Sau đó: Authentication > Users > tạo 1 tài khoản admin, và TẮT "Allow new users to sign up".
-- Đổi 'ADMIN_EMAIL@example.com' bên dưới thành email tài khoản admin đó.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table if not exists genres (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text unique not null,
  sort int default 0,
  description text default '',
  show boolean default true
);
alter table genres add column if not exists description text default '';
alter table genres add column if not exists show boolean default true;

create table if not exists games (
  id text primary key default gen_random_uuid()::text,
  slug text unique not null,
  title text not null,
  tagline text default '',
  description text default '',
  genre_ids jsonb default '[]'::jsonb,
  cover text default '',
  screenshots jsonb default '[]'::jsonb,
  play_url text default '',
  released text default '',
  platforms text default '',
  controls text default '',
  status text default 'published' check (status in ('published','draft')),
  hot boolean default false,
  sort int default 0,
  kv text default '',
  video_url text default '',
  highlights text default '',
  controls_detail text default '',
  tips text default '',
  dev_notes text default '',
  play_time text default '',
  age text default '',
  language text default '',
  created_at timestamptz default now()
);

-- Nếu bảng games đã tạo từ bản schema cũ, các dòng sau bổ sung cột mới (chạy lại không sao)
alter table games add column if not exists kv text default '';
alter table games add column if not exists video_url text default '';
alter table games add column if not exists highlights text default '';
alter table games add column if not exists controls_detail text default '';
alter table games add column if not exists tips text default '';
alter table games add column if not exists dev_notes text default '';
alter table games add column if not exists play_time text default '';
alter table games add column if not exists age text default '';
alter table games add column if not exists language text default '';
alter table games add column if not exists youtube_url text default '';
alter table games add column if not exists clip_url text default '';
alter table banners add column if not exists kind text default 'game';
alter table banners add column if not exists media_type text default 'image';
alter table banners add column if not exists video_url text default '';
alter table banners add column if not exists sponsor text default '';
alter table banners add column if not exists start_at text default '';
alter table banners add column if not exists end_at text default '';
alter table banners add column if not exists duration int default 0;

create table if not exists banners (
  id text primary key default gen_random_uuid()::text,
  eyebrow text default '',
  title text not null,
  subtitle text default '',
  game_id text references games(id) on delete set null,
  image text default '',
  cta_text text default '',
  link_url text default '',
  active boolean default true,
  sort int default 0
);

alter table settings enable row level security;
alter table genres   enable row level security;
alter table games    enable row level security;
alter table banners  enable row level security;

-- Ai cũng xem được (game nháp chỉ admin thấy)
drop policy if exists "public read settings" on settings;
create policy "public read settings" on settings for select using (true);
drop policy if exists "public read genres" on genres;
create policy "public read genres"   on genres   for select using (true);
drop policy if exists "public read banners" on banners;
create policy "public read banners"  on banners  for select using (true);
drop policy if exists "public read games" on games;
create policy "public read games"    on games    for select
  using (status = 'published' or (auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com');

-- Chỉ admin được thêm / sửa / xoá
drop policy if exists "admin write settings" on settings;
create policy "admin write settings" on settings for all
  using ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com')
  with check ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com');
drop policy if exists "admin write genres" on genres;
create policy "admin write genres" on genres for all
  using ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com')
  with check ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com');
drop policy if exists "admin write games" on games;
create policy "admin write games" on games for all
  using ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com')
  with check ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com');
drop policy if exists "admin write banners" on banners;
create policy "admin write banners" on banners for all
  using ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com')
  with check ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com');

-- Dữ liệu khởi đầu
insert into settings (id, data) values (1, jsonb_build_object(
  'studio_name','Vinh Làm Game',
  'tagline','Những trò chơi nhỏ làm bằng HTML5, chơi ngay trên trình duyệt.',
  'footer_text','Làm game nhỏ, chơi trên trình duyệt.'
)) on conflict (id) do nothing;

insert into genres (id, name, slug, sort) values
  ('g-phieu-luu','Phiêu lưu','phieu-luu',1),
  ('g-platformer','Platformer','platformer',2),
  ('g-hanh-dong','Hành động','hanh-dong',3),
  ('g-casual','Casual','casual',4),
  ('g-thieu-nhi','Thiếu nhi','thieu-nhi',5)
on conflict (id) do nothing;

insert into games (id, slug, title, tagline, genre_ids, play_url, released, platforms, hot, sort) values
  ('game-laj','hanh-tinh-laj','Hành Tinh LAJ','Một chuyến platformer tĩnh lặng trên hành tinh lạ.','["g-platformer","g-phieu-luu"]','https://hanhtinhlaj.vercel.app','2026','Web',true,1),
  ('game-chu','chu-va-qua-trung-that-lac','Chu và Quả Trứng Thất Lạc','Cùng chú khủng long Chu đi tìm quả trứng bị lạc.','["g-phieu-luu","g-thieu-nhi"]','https://chuvaquatrungkhunglong.vercel.app','2026','Web',true,2),
  ('game-monster','monster-breakout','Monster Breakout','Bắn súng sinh tồn: vượt từng cổng, diệt quái virus.','["g-hanh-dong"]','','2026','Web · Mobile',true,3),
  ('game-mua','qua-mua-mua','Qua Mùa Mưa','Chạy xe máy về nhà qua bốn cửa của mùa mưa.','["g-casual"]','','2026','Web',false,4)
on conflict (id) do nothing;

-- ===== Tin nhắn liên hệ =====
-- Khách (chưa đăng nhập) chỉ được GỬI; chỉ admin được xem / sửa / xoá.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text default '',
  message text not null,
  handled boolean default false,
  created_at timestamptz default now()
);
alter table messages enable row level security;

drop policy if exists "public send messages" on messages;
create policy "public send messages" on messages for insert
  with check (
    char_length(name) between 1 and 120
    and char_length(email) between 3 and 200
    and char_length(coalesce(phone, '')) <= 20
    and char_length(message) between 1 and 5000
    and handled = false
  );

drop policy if exists "admin manage messages" on messages;
create policy "admin manage messages" on messages for all
  using ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com')
  with check ((auth.jwt() ->> 'email') = 'ADMIN_EMAIL@example.com');
