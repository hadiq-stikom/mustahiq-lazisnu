-- Migration: Tabel pivot periode_distribusi <-> daftar_rt
-- Menyimpan RT mana saja yang dipilih admin untuk suatu periode distribusi

create table if not exists periode_rt (
  id         bigint generated always as identity primary key,
  periode_id bigint not null references periode_distribusi(id) on delete cascade,
  rt_id      bigint not null references daftar_rt(id) on delete cascade,
  unique(periode_id, rt_id)
);

alter table periode_rt enable row level security;

create policy "Publik bisa baca periode_rt"
  on periode_rt for select using (true);

create policy "Authenticated bisa insert periode_rt"
  on periode_rt for insert with check (auth.role() = 'authenticated');

create policy "Authenticated bisa delete periode_rt"
  on periode_rt for delete using (auth.role() = 'authenticated');
