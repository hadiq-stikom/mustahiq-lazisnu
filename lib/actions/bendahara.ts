'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase, requireBendahara } from '../supabase-server';

export async function tambahTransaksi(formData: FormData) {
  const user = await requireBendahara();
  const supabase = await createServerSupabase();

  const jenis = formData.get('jenis') as string;
  const tanggal = formData.get('tanggal') as string;
  const jumlah = parseFloat(formData.get('jumlah') as string);

  if (jenis === 'PEMASUKAN') {
    const sumber = formData.get('sumber') as string;
    const muzakki = formData.get('muzakki') as string;

    const { error } = await supabase.from('penerimaan').insert({
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      sumber,
      muzakki: muzakki || null,
      jumlah,
      keterangan: formData.get('keterangan') as string || null,
      petugas_id: user.id,
    });

    if (error) throw new Error(error.message);
  } else {
    const kategori = formData.get('kategori') as string;

    const { error } = await supabase.from('pengeluaran').insert({
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      kategori,
      deskripsi: formData.get('deskripsi') as string || null,
      jumlah,
      petugas_id: user.id,
    });

    if (error) throw new Error(error.message);
  }

  revalidatePath('/bendahara');
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function simpanSaldoBulanBendahara(bulan: string) {
  const user = await requireBendahara();
  const supabase = await createServerSupabase();

  const [tahun, bulanNum] = bulan.split('-').map(Number);

  const prevDate = new Date(tahun, bulanNum - 1, 1);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevBulan = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const { data: prevSaldo } = await supabase
    .from('saldo_bulanan')
    .select('saldo')
    .eq('bulan', prevBulan)
    .maybeSingle();

  const saldoAwal = prevSaldo?.saldo ?? 0;

  const tglAwal = `${bulan}-01`;
  const tglAkhirDate = new Date(tahun, bulanNum, 1);
  const tglAkhir = tglAkhirDate.toISOString().split('T')[0];

  const [penerimaanResult, distribusiResult, pengeluaranResult] = await Promise.all([
    supabase.from('penerimaan').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
    supabase.from('distribusi').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
    supabase.from('pengeluaran').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
  ]);

  const totalPenerimaan = (penerimaanResult.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
  const totalDistribusi = (distribusiResult.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
  const totalPengeluaran = (pengeluaranResult.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);

  const saldoAkhir = saldoAwal + totalPenerimaan - totalDistribusi - totalPengeluaran;

  const { error } = await supabase.from('saldo_bulanan').upsert(
    { bulan, saldo: saldoAkhir },
    { onConflict: 'bulan' }
  );

  if (error) throw new Error(error.message);
  revalidatePath('/bendahara');
  revalidatePath('/admin');

  return saldoAkhir;
}
