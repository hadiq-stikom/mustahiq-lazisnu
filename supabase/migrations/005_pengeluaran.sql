-- Migration: Tabel pengeluaran untuk mencatat pengeluaran operasional selain distribusi
-- Kategori: ATK, PERLENGKAPAN_DISTRIBUSI, OPERASIONAL, TRANSPORTASI, LAINNYA

create table if not exists pengeluaran (
  id         bigint generated always as identity primary key,
  tanggal    date not null default current_date,
  kategori   varchar not null check (kategori in ('DISTRIBUSI', 'ATK', 'PERLENGKAPAN_DISTRIBUSI', 'OPERASIONAL', 'TRANSPORTASI', 'LAINNYA')),
  deskripsi  text,
  jumlah     decimal(14,2) not null,
  petugas_id uuid references auth.users,
  created_at timestamptz default now()
);

alter table pengeluaran enable row level security;

create policy "Publik bisa baca pengeluaran"
  on pengeluaran for select using (true);

create policy "Authenticated bisa insert pengeluaran"
  on pengeluaran for insert with check (auth.role() = 'authenticated');

create policy "Authenticated bisa delete pengeluaran"
  on pengeluaran for delete using (auth.role() = 'authenticated');
