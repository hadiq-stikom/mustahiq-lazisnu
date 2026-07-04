-- Migration: Tabel saldo bulanan untuk menyimpan saldo akhir tiap bulan
-- Digunakan agar perhitungan saldo tidak perlu menghitung dari awal setiap kali

create table if not exists saldo_bulanan (
  id     bigint generated always as identity primary key,
  bulan  varchar(7) not null unique,
  saldo  decimal(14,2) not null
);

alter table saldo_bulanan enable row level security;

create policy "Publik bisa baca saldo_bulanan"
  on saldo_bulanan for select using (true);

create policy "Authenticated bisa insert saldo_bulanan"
  on saldo_bulanan for insert with check (auth.role() = 'authenticated');

create policy "Authenticated bisa update saldo_bulanan"
  on saldo_bulanan for update using (auth.role() = 'authenticated');
