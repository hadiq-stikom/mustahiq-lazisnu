-- Migration: Menambahkan kategori DISTRIBUSI ke tabel pengeluaran

alter table pengeluaran drop constraint if exists pengeluaran_kategori_check;

alter table pengeluaran add constraint pengeluaran_kategori_check
  check (kategori in ('DISTRIBUSI', 'ATK', 'PERLENGKAPAN_DISTRIBUSI', 'OPERASIONAL', 'TRANSPORTASI', 'LAINNYA'));
