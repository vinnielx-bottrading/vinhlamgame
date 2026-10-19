-- =====================================================================
-- Vinh Làm Game — Supabase schema (CHỈ cấu trúc bảng + phân quyền)
-- Chạy TOÀN BỘ file này trong Supabase › SQL Editor. Chạy lại bao nhiêu lần cũng được:
-- file này KHÔNG thêm, sửa hay xoá game / banner / thể loại / tư liệu / tin nhắn của bạn.
-- Dữ liệu mẫu nằm riêng ở seed.sql (chỉ dùng khi cài mới, database còn trống).
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
alter table games   add column if not exists kv_in_slide boolean default false;
alter table games   add column if not exists hero boolean default false;   -- KV chính hiện trên banner trang chủ
-- Template trang game mới
alter table games   add column if not exists subtitle     text default '';
alter table games   add column if not exists summary      text default '';
alter table games   add column if not exists is_free      boolean default true;
alter table games   add column if not exists accent       text default '';
alter table games   add column if not exists features     jsonb default '[]'::jsonb;
alter table games   add column if not exists show_howto   boolean default false;
alter table games   add column if not exists howto        jsonb default '[]'::jsonb;
alter table games   add column if not exists touch_note   text default '';
alter table games   add column if not exists show_story   boolean default false;
alter table games   add column if not exists show_gallery boolean default true;
alter table games   add column if not exists cta_title    text default '';
alter table games   add column if not exists cta_sub      text default '';
alter table games   alter column kv_in_slide set default false;
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
alter table messages add column if not exists topic text default '';
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
    and coalesce(topic, '') in ('', 'ads')
  );
create policy "admin manage messages" on messages for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Dòng cài đặt duy nhất (bắt buộc có, không chứa dữ liệu mẫu) ----------
insert into settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ---------- Kho tư liệu (chỉ quản trị viên xem / sửa) ----------
create table if not exists assets (
  id         text primary key default gen_random_uuid()::text,
  kind       text not null default 'image' check (kind in ('image','video','text','link')),
  title      text not null default '',
  category   text default 'Chưa phân loại',
  game_id    text references games(id) on delete set null,
  tags       text default '',
  url        text default '',
  content    text default '',
  note       text default '',
  size       bigint,
  dims       text default '',
  mime       text default '',
  created_by text default '',
  created_at timestamptz default now()
);
alter table assets add column if not exists group_name text default '';
create index if not exists assets_created_idx on assets (created_at desc);
create index if not exists assets_group_idx on assets (group_name);
create index if not exists assets_category_idx on assets (category);
alter table assets enable row level security;
drop policy if exists "admin manage assets" on assets;
create policy "admin manage assets" on assets for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Quảng cáo theo chiến dịch (vị trí / game / thời gian) ----------
-- placement: all = toàn trang (trang chủ + mọi trang game) · home = trang chủ · games = mọi trang game · game = các game chọn trong game_ids
create table if not exists ads (
  id           text primary key default gen_random_uuid()::text,
  advertiser   text not null default '',
  title        text default '',
  image        text default '',
  image_mobile text default '',
  link_url     text default '',
  placement    text default 'all' check (placement in ('all','home','games','game')),
  game_ids     jsonb default '[]'::jsonb,
  start_at     text default '',
  end_at       text default '',
  active       boolean default true,
  weight       int default 1,
  note         text default '',
  created_at   timestamptz default now()
);
-- Vị trí banner lớn đầu trang chủ (hero) + gói 'none' (chỉ chạy hero)
alter table ads add column if not exists hero_on    boolean default false;
alter table ads add column if not exists hero_image text default '';
alter table ads add column if not exists hero_video text default '';
alter table ads add column if not exists hero_sort  int default 99;
alter table ads drop constraint if exists ads_placement_check;
alter table ads add constraint ads_placement_check check (placement in ('all','home','games','game','none'));
alter table ads enable row level security;
-- Khách chỉ đọc được các cột hiển thị; cột ghi chú (giá, hợp đồng) chỉ quản trị viên thấy
revoke all on ads from anon;
grant select (id, advertiser, title, image, image_mobile, link_url, placement, game_ids, start_at, end_at, active, weight, hero_on, hero_image, hero_video, hero_sort) on ads to anon;
grant select, insert, update, delete on ads to authenticated;
drop policy if exists "public read ads" on ads;
drop policy if exists "admin read ads"  on ads;
drop policy if exists "admin write ads" on ads;
create policy "public read ads" on ads for select to anon using (active);
create policy "admin read ads"  on ads for select to authenticated using (public.is_admin());
create policy "admin write ads" on ads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Thống kê lượt truy cập / lượt chơi / quảng cáo ----------
-- Khách chỉ GHI sự kiện (không đọc được). Quản trị viên xem qua hàm site_stats().
create table if not exists events (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  vid    text not null check (char_length(vid) between 6 and 40),
  type   text not null check (type in ('view','game_view','play','ad_view','ad_click')),
  ref    text default '' check (char_length(ref) <= 80),
  path   text default '' check (char_length(path) <= 200),
  device text default '' check (device in ('','mobile','desktop')),
  src    text default '' check (char_length(src) <= 120)
);
create index if not exists events_at_idx on events (at);
alter table events enable row level security;
drop policy if exists "public log events"   on events;
drop policy if exists "admin manage events" on events;
create policy "public log events" on events for insert to anon, authenticated
  with check (at between now() - interval '2 minutes' and now() + interval '2 minutes');
create policy "admin manage events" on events for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.site_stats(days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  n     int := least(greatest(coalesce(days, 30), 1), 400);
  d0    date := (now() at time zone 'Asia/Ho_Chi_Minh')::date - (n - 1);
  since timestamptz := d0::timestamp at time zone 'Asia/Ho_Chi_Minh';
begin
  if not public.is_admin() then raise exception 'Chỉ quản trị viên xem được thống kê'; end if;
  return jsonb_build_object(
    'days', n,
    'totals', (select jsonb_build_object(
        'visitors',   count(distinct vid),
        'views',      count(*) filter (where type = 'view'),
        'game_views', count(*) filter (where type = 'game_view'),
        'plays',      count(*) filter (where type = 'play'),
        'players',    count(distinct vid) filter (where type = 'play'),
        'ad_views',   count(*) filter (where type = 'ad_view'),
        'ad_clicks',  count(*) filter (where type = 'ad_click'),
        'mobile',     count(distinct vid) filter (where device = 'mobile'),
        'desktop',    count(distinct vid) filter (where device = 'desktop'))
      from events where at >= since),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.d, 'YYYY-MM-DD'), 'visitors', coalesce(x.v, 0), 'views', coalesce(x.pv, 0), 'plays', coalesce(x.p, 0)) order by g.d), '[]'::jsonb)
      from generate_series(d0, d0 + (n - 1), interval '1 day') as g(d)
      left join (select (at at time zone 'Asia/Ho_Chi_Minh')::date as d, count(distinct vid) v,
                        count(*) filter (where type = 'view') pv, count(*) filter (where type = 'play') p
                 from events where at >= since group by 1) x on x.d = g.d::date),
    'games', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'views', v, 'plays', p, 'players', pl) order by p desc, v desc), '[]'::jsonb)
      from (select ref, count(*) filter (where type = 'game_view') v, count(*) filter (where type = 'play') p,
                   count(distinct vid) filter (where type = 'play') pl
            from events where at >= since and type in ('game_view', 'play') and ref <> '' group by ref) t),
    'ads', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'views', v, 'clicks', c, 'reach', r) order by v desc), '[]'::jsonb)
      from (select ref, count(*) filter (where type = 'ad_view') v, count(*) filter (where type = 'ad_click') c,
                   count(distinct vid) filter (where type = 'ad_view') r
            from events where at >= since and type in ('ad_view', 'ad_click') and ref <> '' group by ref) t),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('src', src, 'visitors', v) order by v desc), '[]'::jsonb)
      from (select coalesce(nullif(src, ''), '(trực tiếp)') src, count(distinct vid) v
            from events where at >= since and type = 'view' group by 1 order by 2 desc limit 8) t)
  );
end $$;
revoke all on function public.site_stats(int) from public;
grant execute on function public.site_stats(int) to authenticated;

-- ---------- Cập nhật trực tiếp: bật Realtime cho các bảng trang khách đọc ----------
do $$
declare t text;
begin
  foreach t in array array['settings','genres','games','banners'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then
  raise notice 'Chưa có publication supabase_realtime (chỉ có trên Supabase) — bỏ qua.';
end $$;
