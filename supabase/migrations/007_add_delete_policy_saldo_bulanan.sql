-- Migration: Menambahkan policy DELETE untuk saldo_bulanan
-- Agar admin & bendahara bisa menghapus data saldo yang tidak diperlukan

create policy "Authenticated bisa delete saldo_bulanan"
  on saldo_bulanan
  for delete
  using (auth.role() = 'authenticated');
