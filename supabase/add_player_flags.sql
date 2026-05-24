-- Chạy trong Supabase SQL Editor (một lần)
-- attended = điểm danh | paid = đã chuyển khoản (CK), lưu khi admin bấm tick
alter table public.players
  add column if not exists attended boolean not null default false,
  add column if not exists paid boolean not null default false;
