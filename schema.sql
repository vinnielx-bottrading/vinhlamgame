-- =====================================================================
-- Vinh Làm Game — Supabase schema
-- Chạy TOÀN BỘ file này trong Supabase › SQL Editor. Chạy lại nhiều lần không sao.
--
-- Quản trị viên:
--   • Chủ sở hữu (owner) mặc định: vinnielx@gmail.com — không xoá được.
--   • Chủ sở hữu thêm / bớt quản trị viên khác ở admin.html › tab "Quản trị viên".
--   • Chỉ email có trong bảng `admins` mới sửa được dữ liệu, dù có tài khoản đăng nhập.
-- =====================================================================

-- ---------- Quản trị viên ----------
create table if not exists admins (
  email      text primary key check (email = lower(email)),
  role       text not null default 'admin' check (role in ('owner','admin')),
  note       text default '',
  added_by   text default '',
  created_at timestamptz default now()
);

insert into admins (email, role, note, added_by)
values ('vinnielx@gmail.com', 'owner', 'Chủ sở hữu', 'system')
on conflict (email) do update set role = 'owner';

-- Kiểm tra người đang đăng nhập có phải quản trị viên không
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from admins where role = 'owner' and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_owner() to anon, authenticated;

-- Không cho xoá / hạ quyền chủ sở hữu
create or replace function public.protect_owner()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' then
    raise exception 'Không thể xoá chủ sở hữu';
  end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and (new.role <> 'owner' or new.email <> old.email) then
    raise exception 'Không thể thay đổi chủ sở hữu';
  end if;
  if tg_op = 'INSERT' and new.role = 'owner' and exists (select 1 from admins where role = 'owner' and email <> new.email) then
    raise exception 'Chỉ có một chủ sở hữu';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists admins_protect_owner on admins;
create trigger admins_protect_owner before insert or update or delete on admins
  for each row execute function public.protect_owner();

alter table admins enable row level security;
drop policy if exists "admins read"   on admins;
drop policy if exists "admins insert" on admins;
drop policy if exists "admins update" on admins;
drop policy if exists "admins delete" on admins;
create policy "admins read"   on admins for select using (public.is_admin());
-- Chỉ chủ sở hữu được thêm / sửa / xoá quản trị viên khác
create policy "admins insert" on admins for insert with check (public.is_owner() and role = 'admin');
create policy "admins update" on admins for update using (public.is_owner()) with check (public.is_owner());
create policy "admins delete" on admins for delete using (public.is_owner() and role <> 'owner');

-- ---------- Nội dung ----------
create table if not exists settings (
  id   int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table if not exists genres (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  slug        text unique not null,
  sort        int default 0,
  description text default '',
  show        boolean default true
);

create table if not exists games (
  id          text primary key default gen_random_uuid()::text,
  slug        text unique not null,
  title       text not null,
  tagline     text default '',
  description text default '',
  genre_ids   jsonb default '[]'::jsonb,
  cover       text default '',
  screenshots jsonb default '[]'::jsonb,
  play_url    text default '',
  status      text default 'published' check (status in ('published','draft')),
  hot         boolean default false,
  sort        int default 0,
  created_at  timestamptz default now()
);

create table if not exists banners (
  id        text primary key default gen_random_uuid()::text,
  title     text not null,
  game_id   text references games(id) on delete set null,
  image     text default '',
  link_url  text default '',
  active    boolean default true,
  sort      int default 0
);

-- Cột bổ sung (an toàn khi bảng đã có từ bản cũ)
alter table genres  add column if not exists description text default '';
alter table genres  add column if not exists show boolean default true;
alter table games   add column if not exists kv text default '';
alter table games   add column if not exists video_url text default '';
alter table games   add column if not exists youtube_url text default '';
alter table games   add column if not exists clip_url text default '';
alter table games   add column if not exists highlights text default '';
alter table games   add column if not exists released text default '';
alter table games   add column if not exists platforms text default '';
alter table games   add column if not exists controls text default '';
alter table games   add column if not exists controls_detail text default '';
alter table games   add column if not exists tips text default '';
alter table games   add column if not exists dev_notes text default '';
alter table games   add column if not exists play_time text default '';
alter table games   add column if not exists age text default '';
alter table games   add column if not exists language text default '';
alter table banners add column if not exists eyebrow text default '';
alter table banners add column if not exists subtitle text default '';
alter table banners add column if not exists cta_text text default '';
alter table banners add column if not exists kind text default 'game';
alter table banners add column if not exists media_type text default 'image';
alter table banners add column if not exists video_url text default '';
alter table banners add column if not exists sponsor text default '';
alter table banners add column if not exists start_at text default '';
alter table banners add column if not exists end_at text default '';
alter table banners add column if not exists duration int default 0;

alter table settings enable row level security;
alter table genres   enable row level security;
alter table games    enable row level security;
alter table banners  enable row level security;

-- Ai cũng xem được (game nháp chỉ quản trị viên thấy)
drop policy if exists "public read settings" on settings;
drop policy if exists "public read genres"   on genres;
drop policy if exists "public read banners"  on banners;
drop policy if exists "public read games"    on games;
create policy "public read settings" on settings for select using (true);
create policy "public read genres"   on genres   for select using (true);
create policy "public read banners"  on banners  for select using (true);
create policy "public read games"    on games    for select using (status = 'published' or public.is_admin());

-- Chỉ quản trị viên được thêm / sửa / xoá
drop policy if exists "admin write settings" on settings;
drop policy if exists "admin write genres"   on genres;
drop policy if exists "admin write games"    on games;
drop policy if exists "admin write banners"  on banners;
create policy "admin write settings" on settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write genres"   on genres   for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write games"    on games    for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write banners"  on banners  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Tin nhắn liên hệ ----------
-- Khách (chưa đăng nhập) chỉ được GỬI; chỉ quản trị viên xem / sửa / xoá.
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text default '',
  message    text not null,
  handled    boolean default false,
  created_at timestamptz default now()
);
alter table messages enable row level security;

drop policy if exists "public send messages"  on messages;
drop policy if exists "admin manage messages" on messages;
create policy "public send messages" on messages for insert
  with check (
    char_length(name) between 1 and 120
    and char_length(email) between 3 and 200
    and char_length(coalesce(phone, '')) <= 20
    and char_length(message) between 1 and 5000
    and handled = false
  );
create policy "admin manage messages" on messages for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Dữ liệu khởi đầu ----------
insert into settings (id, data) values (1, jsonb_build_object(
  'studio_name', 'Vinh Làm Game',
  'tagline', 'Những trò chơi nhỏ làm bằng HTML5, chơi ngay trên trình duyệt.',
  'footer_text', 'Làm game nhỏ, chơi trên trình duyệt.',
  'bank_name', 'Vietcombank', 'bank_bin', '970436',
  'bank_account', '0111000182684', 'bank_holder', 'NGUYEN HOANG VINH',
  'donate_amounts', '20000, 50000, 100000, 200000', 'donate_memo', 'Ung ho Vinh Lam Game'
)) on conflict (id) do nothing;

insert into genres (id, name, slug, sort) values
  ('g-phieu-luu', 'Phiêu lưu',  'phieu-luu',  1),
  ('g-platformer','Platformer', 'platformer', 2),
  ('g-hanh-dong', 'Hành động',  'hanh-dong',  3),
  ('g-casual',    'Casual',     'casual',     4),
  ('g-thieu-nhi', 'Thiếu nhi',  'thieu-nhi',  5)
on conflict (id) do nothing;

insert into games (id, slug, title, tagline, genre_ids, play_url, hot, sort) values
  ('game-laj',     'hanh-tinh-laj',             'Hành Tinh LAJ',             'Một chuyến platformer tĩnh lặng trên hành tinh lạ.', '["g-platformer","g-phieu-luu"]', 'https://hanhtinhlaj.vercel.app',           true,  1),
  ('game-chu',     'chu-va-qua-trung-that-lac', 'Chu và Quả Trứng Thất Lạc', 'Cùng chú khủng long Chu đi tìm quả trứng bị lạc.',    '["g-phieu-luu","g-thieu-nhi"]',  'https://chuvaquatrungkhunglong.vercel.app', true,  2),
  ('game-monster', 'monster-breakout',          'Monster Breakout',          'Bắn súng sinh tồn: vượt từng cổng, diệt quái virus.', '["g-hanh-dong"]',                '',                                          true,  3),
  ('game-mua',     'qua-mua-mua',               'Qua Mùa Mưa',               'Chạy xe máy về nhà qua bốn cửa của mùa mưa.',         '["g-casual"]',                   '',                                          false, 4)
on conflict (id) do nothing;
