-- Chạy TOÀN BỘ file này trong Supabase → SQL Editor → Run
-- Sửa lỗi tick CK / điểm danh mất sau khi reload trang

-- 1) Thêm cột (nếu chưa có)
alter table public.players
  add column if not exists attended boolean not null default false,
  add column if not exists paid boolean not null default false;

-- 2) Quyền cho app (anon key)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.players to anon, authenticated;

-- 3) RLS — cho phép đọc/ghi (app không đăng nhập Supabase Auth)
alter table public.players enable row level security;

drop policy if exists "players_public_select" on public.players;
drop policy if exists "players_public_insert" on public.players;
drop policy if exists "players_public_update" on public.players;
drop policy if exists "players_public_delete" on public.players;

create policy "players_public_select"
  on public.players for select
  to anon, authenticated
  using (true);

create policy "players_public_insert"
  on public.players for insert
  to anon, authenticated
  with check (true);

create policy "players_public_update"
  on public.players for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "players_public_delete"
  on public.players for delete
  to anon, authenticated
  using (true);

-- 4) Bật realtime (tùy chọn, giúp đồng bộ nhiều máy)
-- Nếu báo lỗi "already member of publication" thì bỏ qua dòng dưới
alter publication supabase_realtime add table public.players;
