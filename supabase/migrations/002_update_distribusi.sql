-- Migration: Update periode_distribusi + tambah RLS untuk bendahara

alter table periode_distribusi add column if not exists jumlah_per_jiwa decimal(14,2);
alter table periode_distribusi add column if not exists bentuk varchar default 'TUNAI' check (bentuk in ('TUNAI', 'BARANG', 'LAINNYA'));

create index if not exists idx_distribusi_periode on distribusi(periode_id);
create index if not exists idx_distribusi_mustahiq on distribusi(mustahiq_id);

-- RLS untuk bendahara
drop policy if exists "bendahara bisa insert penerimaan" on penerimaan;
create policy "bendahara bisa insert penerimaan" on penerimaan for insert with check (auth.role() = 'authenticated');
