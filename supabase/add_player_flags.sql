-- Chạy trong Supabase SQL Editor (một lần)
alter table public.players
  add column if not exists attended boolean not null default false,
  add column if not exists paid boolean not null default false;
