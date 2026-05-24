-- Chạy trong Supabase SQL Editor (sau fix_players_paid_persist.sql)

-- Cột ngày trên bảng config (mỗi dòng = một buổi vote)
alter table public.config
  add column if not exists session_date date default current_date;

-- Gắn người chơi với buổi vote
alter table public.players
  add column if not exists session_id bigint;

update public.players
set session_id = 1
where session_id is null;

-- FK (bỏ qua nếu đã có)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'players_session_id_fkey'
  ) then
    alter table public.players
      add constraint players_session_id_fkey
      foreign key (session_id) references public.config(id) on delete cascade;
  end if;
end $$;

-- Quyền + RLS cho config (nhiều buổi)
grant select, insert, update, delete on table public.config to anon, authenticated;

alter table public.config enable row level security;

drop policy if exists "config_public_select" on public.config;
drop policy if exists "config_public_insert" on public.config;
drop policy if exists "config_public_update" on public.config;
drop policy if exists "config_public_delete" on public.config;

create policy "config_public_select"
  on public.config for select to anon, authenticated using (true);

create policy "config_public_insert"
  on public.config for insert to anon, authenticated with check (true);

create policy "config_public_update"
  on public.config for update to anon, authenticated using (true) with check (true);

create policy "config_public_delete"
  on public.config for delete to anon, authenticated using (true);

alter publication supabase_realtime add table public.config;
