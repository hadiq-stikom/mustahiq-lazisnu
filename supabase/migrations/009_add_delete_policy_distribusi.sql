-- Migration: Menambahkan policy DELETE untuk tabel distribusi
-- Agar petugas bisa batal centang distribusi

drop policy if exists "Authenticated bisa delete distribusi" on distribusi;
create policy "Authenticated bisa delete distribusi"
  on distribusi for delete using (auth.role() = 'authenticated');
