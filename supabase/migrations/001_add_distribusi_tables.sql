-- Migration: Menambahkan tabel untuk modul penerimaan dana & distribusi zakat

-- 1. TABEL PENERIMAAN DANA
create table if not exists penerimaan (
  id            bigint generated always as identity primary key,
  tanggal       date not null default current_date,
  sumber        varchar not null check (sumber in ('ZAKAT_MAL', 'SEDEKAH_INFAK')),
  muzakki       varchar,
  jumlah        decimal(14,2) not null,
  petugas_id    uuid references auth.users,
  keterangan    text,
  created_at    timestamptz default now()
);

alter table penerimaan enable row level security;

-- 2. TABEL PERIODE DISTRIBUSI
create table if not exists periode_distribusi (
  id            bigint generated always as identity primary key,
  nama          varchar not null,
  tanggal_buka  date not null,
  tanggal_tutup date,
  status        varchar default 'AKTIF' check (status in ('AKTIF', 'SELESAI')),
  created_at    timestamptz default now()
);

alter table periode_distribusi enable row level security;

-- 3. TABEL RIWAYAT DISTRIBUSI
create table if not exists distribusi (
  id            bigint generated always as identity primary key,
  periode_id    bigint not null references periode_distribusi on delete restrict,
  mustahiq_id   bigint not null references penerima_zakat on delete restrict,
  tanggal       date not null default current_date,
  jumlah        decimal(14,2) not null,
  bentuk        varchar default 'TUNAI' check (bentuk in ('TUNAI', 'BARANG', 'LAINNYA')),
  keterangan    text,
  petugas_id    uuid references auth.users,
  created_at    timestamptz default now(),
  unique(periode_id, mustahiq_id)
);

alter table distribusi enable row level security;

-- RLS: Izinkan akses baca untuk semua user (publik)
drop policy if exists "Publik bisa baca penerimaan" on penerimaan;
create policy "Publik bisa baca penerimaan" on penerimaan for select using (true);
drop policy if exists "Publik bisa baca periode_distribusi" on periode_distribusi;
create policy "Publik bisa baca periode_distribusi" on periode_distribusi for select using (true);
drop policy if exists "Publik bisa baca distribusi" on distribusi;
create policy "Publik bisa baca distribusi" on distribusi for select using (true);

-- RLS: Hanya petugas/admin yang bisa insert/update/delete (via authenticated + role check)
-- Catatan: Karena kita pakai server actions, kita bisa juga andalkan server-side auth.
-- Tapi untuk jaga-jaga, kita buat policy dasar.

-- Izinkan authenticated users (petugas/admin) untuk insert/update/delete
drop policy if exists "Authenticated bisa insert penerimaan" on penerimaan;
create policy "Authenticated bisa insert penerimaan" on penerimaan for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated bisa insert distribusi" on distribusi;
create policy "Authenticated bisa insert distribusi" on distribusi for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated bisa insert periode" on periode_distribusi;
create policy "Authenticated bisa insert periode" on periode_distribusi for insert with check (auth.role() = 'authenticated');
