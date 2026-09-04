'use server';

import { createServerSupabase } from '../supabase-server';

/**
 * Menghitung saldo kas bulan ini berdasarkan saldo bulan lalu
 * ditambah pemasukan bulan ini dikurangi pengeluaran & distribusi bulan ini.
 * Dijalankan secara server-side agar akurat dan terhindar dari race condition.
 */
export async function hitungSaldoSekarang(tahunBulan?: string): Promise<number> {
  let dateToUse = new Date();
  if (tahunBulan) {
    const [year, month] = tahunBulan.split('-');
    dateToUse = new Date(parseInt(year), parseInt(month) - 1, 1);
  }

  const bulanIni = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
  const tglAwal = `${bulanIni}-01`;
  const nextMonth = new Date(dateToUse.getFullYear(), dateToUse.getMonth() + 1, 1);
  const tglAkhir = nextMonth.toISOString().split('T')[0];

  const prevDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevBulan = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const supabase = await createServerSupabase();

  const [prevSaldoResult, penerimaanResult, distribusiResult, pengeluaranResult] = await Promise.all([
    supabase.from('saldo_bulanan').select('saldo').eq('bulan', prevBulan).maybeSingle(),
    supabase.from('penerimaan').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
    supabase.from('distribusi').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
    supabase.from('pengeluaran').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
  ]);

  const saldoAwal = prevSaldoResult.data?.saldo ?? 0;
  const totalPenerimaan = (penerimaanResult.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
  const totalDistribusi = (distribusiResult.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
  const totalPengeluaran = (pengeluaranResult.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);

  return saldoAwal + totalPenerimaan - totalDistribusi - totalPengeluaran;
}

/**
 * Menyimpan saldo akhir bulan ke tabel saldo_bulanan.
 * Aman dari duplikasi karena menggunakan upsert.
 */
export async function simpanSaldoBulananAction(tahunBulan: string, saldoAkhir: number) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('saldo_bulanan')
    .upsert({ bulan: tahunBulan, saldo: saldoAkhir }, { onConflict: 'bulan' });

  if (error) {
    throw new Error(`Gagal menyimpan saldo bulanan: ${error.message}`);
  }
  return true;
}
