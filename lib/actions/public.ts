'use server';

import { createServerSupabase } from '../supabase-server';
import { hitungSaldoSekarang } from './saldo';

export async function getPublicStats() {
  const supabase = await createServerSupabase();

  // 1. Hitung Saldo
  const saldo = await hitungSaldoSekarang();

  // 2. Fetch data paralel
  const [
    { data: penerimaan },
    { data: distribusi },
    { data: periodeAktif },
    { data: rtsResult },
    { data: mustahiqResult },
    { data: allPeriodeRt },
  ] = await Promise.all([
    supabase.from('penerimaan').select('jumlah'),
    supabase.from('distribusi').select('jumlah'),
    supabase.from('periode_distribusi').select('*').eq('status', 'AKTIF').single(),
    supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true }),
    supabase.from('penerima_zakat').select('id, rt_id'),
    supabase.from('periode_rt').select('rt_id, periode_id')
  ]);

  const totalPenerimaan = (penerimaan ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
  const totalDistribusi = (distribusi ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);

  // 3. Proses RT & Mustahiq
  const daftarRT = rtsResult ?? [];
  const mustahiqCountPerRT: Record<number, number> = {};
  const mustahiqIdsPerRT: Record<number, number[]> = {};
  
  if (mustahiqResult) {
    mustahiqResult.forEach((m: { id: number; rt_id: number }) => {
      mustahiqCountPerRT[m.rt_id] = (mustahiqCountPerRT[m.rt_id] || 0) + 1;
      if (!mustahiqIdsPerRT[m.rt_id]) mustahiqIdsPerRT[m.rt_id] = [];
      mustahiqIdsPerRT[m.rt_id].push(m.id);
    });
  }

  // 4. Proses Periode Aktif
  let rtIdsPeriodeAktif: number[] = [];
  let distribusiPeriode: number[] = [];
  let totalMustahiqPeriode = 0;

  if (periodeAktif) {
    const [distsResult, periodeRtsResult] = await Promise.all([
      supabase.from('distribusi').select('mustahiq_id').eq('periode_id', periodeAktif.id),
      supabase.from('periode_rt').select('rt_id').eq('periode_id', periodeAktif.id),
    ]);
    if (distsResult.data) distribusiPeriode = distsResult.data.map((d) => d.mustahiq_id);
    
    rtIdsPeriodeAktif = [...new Set((periodeRtsResult.data ?? []).map((r: { rt_id: number }) => r.rt_id))];
    if (rtIdsPeriodeAktif.length > 0) {
      const { count } = await supabase.from('penerima_zakat').select('*', { count: 'exact', head: true }).in('rt_id', rtIdsPeriodeAktif);
      totalMustahiqPeriode = count ?? 0;
    }
  }

  // 5. Proses Putaran
  const rtIdsPutaran = (allPeriodeRt ?? []).map((r: { rt_id: number }) => r.rt_id);
  const periodeIdsPutaran = [...new Set((allPeriodeRt ?? []).map((r: { rt_id: number; periode_id: number }) => r.periode_id))];
  let distribusiPutaran: number[] = [];
  
  if (periodeIdsPutaran.length > 0) {
    const { data: allDists } = await supabase.from('distribusi').select('mustahiq_id').in('periode_id', periodeIdsPutaran);
    distribusiPutaran = (allDists ?? []).map((d) => d.mustahiq_id);
  }

  return {
    saldo,
    totalPenerimaan,
    totalDistribusi,
    daftarRT,
    mustahiqCountPerRT,
    mustahiqIdsPerRT,
    periodeAktif,
    rtIdsPeriodeAktif,
    distribusiPeriode,
    totalMustahiqPeriode,
    rtIdsPutaran,
    distribusiPutaran
  };
}
