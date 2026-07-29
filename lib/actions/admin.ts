'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase, requireAdmin } from '../supabase-server';

export async function bukaPeriodeDistribusi(formData: FormData) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const nama = formData.get('nama') as string;
  const tanggal_buka = formData.get('tanggal_buka') as string;
  const jumlah_per_jiwa = parseFloat(formData.get('jumlah_per_jiwa') as string);
  const bentuk = (formData.get('bentuk') as string) || 'TUNAI';
  const rtIds: number[] = JSON.parse(formData.get('rt_ids') as string || '[]');

  const { data: periode, error } = await supabase.from('periode_distribusi').insert({
    nama,
    tanggal_buka: tanggal_buka || new Date().toISOString().split('T')[0],
    status: 'AKTIF',
    jumlah_per_jiwa: isNaN(jumlah_per_jiwa) ? null : jumlah_per_jiwa,
    bentuk,
  }).select('id').single();

  if (error) throw new Error(error.message);

  if (rtIds.length > 0 && periode) {
    const { error: rtError } = await supabase.from('periode_rt').insert(
      rtIds.map((rt_id) => ({ periode_id: periode.id, rt_id }))
    );
    if (rtError) throw new Error(rtError.message);
  }

  revalidatePath('/admin/perencanaan');
  revalidatePath('/admin/distribusi');
}

export async function resetPeriodeRt() {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from('periode_rt').delete().neq('id', 0);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/perencanaan');
}

export async function tutupPeriode(id: number) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('periode_distribusi')
    .update({ status: 'SELESAI', tanggal_tutup: new Date().toISOString().split('T')[0] })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/perencanaan');
  revalidatePath('/admin/distribusi');
}

export async function hapusPenerimaan(id: number) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from('penerimaan').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/penerimaan');
  revalidatePath('/admin');
}

export async function hapusDistribusi(id: number) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from('distribusi').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/distribusi');
  revalidatePath('/bendahara');
  revalidatePath('/');
}

export async function simpanSaldoBulanan(bulan: string) {
  await requireAdmin();
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
  revalidatePath('/admin');

  return saldoAkhir;
}

export async function tambahPengeluaran(formData: FormData) {
  const user = await requireAdmin();
  const supabase = await createServerSupabase();

  const tanggal = formData.get('tanggal') as string;
  const kategori = formData.get('kategori') as string;
  const deskripsi = formData.get('deskripsi') as string;
  const jumlah = parseFloat(formData.get('jumlah') as string);

  const { error } = await supabase.from('pengeluaran').insert({
    tanggal: tanggal || new Date().toISOString().split('T')[0],
    kategori,
    deskripsi: deskripsi || null,
    jumlah,
    petugas_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/admin/transaksi');
  revalidatePath('/admin');
}

export async function hapusPengeluaran(id: number) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase.from('pengeluaran').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/transaksi');
  revalidatePath('/admin');
}

export async function getLaporanSaldo(dariBulan: string, sampaiBulan: string) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  // Ambil saldo terakhir SEBELUM dariBulan untuk jadi saldo awal
  const { data: saldoSebelum } = await supabase
    .from('saldo_bulanan')
    .select('saldo, bulan')
    .lt('bulan', dariBulan)
    .order('bulan', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: saldoList } = await supabase
    .from('saldo_bulanan')
    .select('*')
    .gte('bulan', dariBulan)
    .lte('bulan', sampaiBulan)
    .order('bulan', { ascending: true });

  const savedMap = new Map((saldoList ?? []).map(s => [s.bulan, s.saldo]));

  // Generate semua bulan dalam range
  const semuaBulan: string[] = [];
  let [t, b] = dariBulan.split('-').map(Number);
  const [tSampai, bSampai] = sampaiBulan.split('-').map(Number);
  while (t < tSampai || (t === tSampai && b <= bSampai)) {
    semuaBulan.push(`${t}-${String(b).padStart(2, '0')}`);
    b++;
    if (b > 12) { b = 1; t++; }
  }

  let saldoBerjalan = saldoSebelum?.saldo ?? 0;
  const items: { bulan: string; penerimaan: number; distribusi: number; pengeluaran: number; saldo: number }[] = [];

  for (const bulan of semuaBulan) {
    const [tahun, bulanNum] = bulan.split('-').map(Number);
    const tglAwal = `${bulan}-01`;
    const tglAkhirDate = new Date(tahun, bulanNum, 1);
    const tglAkhir = tglAkhirDate.toISOString().split('T')[0];

    const [pR, dR, pngR] = await Promise.all([
      supabase.from('penerimaan').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
      supabase.from('distribusi').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
      supabase.from('pengeluaran').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
    ]);

    const pTot = (pR.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
    const dTot = (dR.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
    const pngTot = (pngR.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);

    saldoBerjalan = saldoBerjalan + pTot - dTot - pngTot;

    items.push({
      bulan,
      penerimaan: pTot,
      distribusi: dTot,
      pengeluaran: pngTot,
      saldo: savedMap.has(bulan) ? savedMap.get(bulan)! : saldoBerjalan,
    });
  }

  const totalPenerimaan = items.reduce((s, i) => s + i.penerimaan, 0);
  const totalDistribusi = items.reduce((s, i) => s + i.distribusi, 0);
  const totalPengeluaran = items.reduce((s, i) => s + i.pengeluaran, 0);
  const saldoAwal = saldoSebelum?.saldo ?? 0;
  const saldoAkhir = items.length > 0 ? items[items.length - 1].saldo : 0;

  return { items, totalPenerimaan, totalDistribusi, totalPengeluaran, saldoAwal, saldoAkhir };
}
