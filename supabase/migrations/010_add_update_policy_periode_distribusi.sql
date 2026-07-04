-- Migration: Menambahkan policy UPDATE untuk periode_distribusi
-- Agar admin bisa menutup periode (update status jadi SELESAI)

drop policy if exists "Authenticated bisa update periode_distribusi" on periode_distribusi;
create policy "Authenticated bisa update periode_distribusi"
  on periode_distribusi
  for update
  using (auth.role() = 'authenticated');
