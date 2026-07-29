'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { formatRupiah } from '@/lib/utils';
import type { PeriodeDistribusi } from '@/lib/types';

const SEARCH_DEBOUNCE_MS = 300;

interface Warga {
  id: number;
  nama: string;
  keterangan: string | null;
  rt_id: number;
  daftar_rt: { no_rt: number; nama_rt: string };
}

interface RTGroup {
  rt_id: number;
  no_rt: number;
  nama_rt: string;
  warga: Warga[];
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
      <div className="skeleton h-3 w-24 mb-3" />
      <div className="skeleton h-6 w-36" />
    </div>
  );
}

function ProgressBar({ value, max, color = 'emerald' }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{value} dari {max} mustahiq</span>
        <span className={`font-bold text-${color}-600`}>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function HalamanUtama() {
  const [dataTergrup, setDataTergrup] = useState<RTGroup[]>([]);
  const [daftarRT, setDaftarRT] = useState<{ id: number; no_rt: number; nama_rt: string }[]>([]);
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState('semua');
  const [loading, setLoading] = useState(true);
  const [loadingSaldo, setLoadingSaldo] = useState(true);

  const [bukaModal, setBukaModal] = useState(false);
  const [formRT, setFormRT] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [pesanSukses, setPesanSukses] = useState('');

  // Transparansi
  const [saldo, setSaldo] = useState(0);
  const [totalPenerimaan, setTotalPenerimaan] = useState(0);
  const [totalDistribusi, setTotalDistribusi] = useState(0);
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [distribusiPeriode, setDistribusiPeriode] = useState<Set<number>>(new Set());
  const [totalMustahiqPeriode, setTotalMustahiqPeriode] = useState(0);

  useEffect(() => {
    const loadSaldo = async () => {
      setLoadingSaldo(true);
      const [penerimaan, distribusi, pengeluaran] = await Promise.all([
        supabase.from('penerimaan').select('jumlah'),
        supabase.from('distribusi').select('jumlah'),
        supabase.from('pengeluaran').select('jumlah'),
      ]);
      const totalP = (penerimaan.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
      const totalD = (distribusi.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
      const totalPeng = (pengeluaran.data ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
      setSaldo(totalP - totalD - totalPeng);
      setTotalPenerimaan(totalP);
      setTotalDistribusi(totalD);
      setLoadingSaldo(false);
    };
    loadSaldo();
  }, []);

  useEffect(() => {
    const loadPeriode = async () => {
      const { data } = await supabase.from('periode_distribusi').select('*').eq('status', 'AKTIF').single();
      if (data) {
        setPeriodeAktif(data);
        const [distsResult, periodeRtsResult] = await Promise.all([
          supabase.from('distribusi').select('mustahiq_id').eq('periode_id', data.id),
          supabase.from('periode_rt').select('rt_id'),
        ]);
        if (distsResult.data) setDistribusiPeriode(new Set(distsResult.data.map((d) => d.mustahiq_id)));

        // hitung total mustahiq dalam periode ini
        const rtIds = [...new Set((periodeRtsResult.data ?? []).map((r: { rt_id: number }) => r.rt_id))];
        if (rtIds.length > 0) {
          const { count } = await supabase.from('penerima_zakat').select('*', { count: 'exact', head: true }).in('rt_id', rtIds);
          setTotalMustahiqPeriode(count ?? 0);
        }
      }
    };
    loadPeriode();
  }, []);

  useEffect(() => {
    const ambilDaftarRT = async () => {
      const { data } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true });
      if (data) setDaftarRT(data);
    };
    ambilDaftarRT();
  }, []);

  useEffect(() => {
    const ambilDataWarga = async () => {
      setLoading(true);
      let query = supabase.from('penerima_zakat').select('id, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )');
      if (kataKunci.trim()) query = query.ilike('nama', `%${kataKunci}%`);
      if (rtTerpilih !== 'semua') query = query.eq('rt_id', parseInt(rtTerpilih));
      const { data, error } = await query.order('rt_id', { ascending: true });
      if (!error && data) {
        const mentah = data as unknown as Warga[];
        const grup: { [key: number]: RTGroup } = {};
        mentah.forEach((w) => {
          if (!w.daftar_rt) return;
          if (!grup[w.rt_id]) grup[w.rt_id] = { rt_id: w.rt_id, no_rt: w.daftar_rt.no_rt, nama_rt: w.daftar_rt.nama_rt, warga: [] };
          grup[w.rt_id].warga.push(w);
        });
        setDataTergrup(Object.values(grup));
      }
      setLoading(false);
    };
    const penunda = setTimeout(ambilDataWarga, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(penunda);
  }, [kataKunci, rtTerpilih]);

  const kirimUsulanBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama) return alert('RT dan Nama wajib diisi.');
    const { error } = await supabase.from('pengajuan_update').insert([
      { penerima_id: null, nama_baru: formNama, keterangan_baru: `[USULAN BARU - RT ID: ${formRT}] ${formKeterangan}`.trim(), status: 'PENDING' }
    ]);
    if (!error) {
      setPesanSukses('Data warga baru berhasil diusulkan! Petugas akan segera memverifikasi.');
      setFormNama(''); setFormKeterangan(''); setFormRT('');
      setTimeout(() => { setBukaModal(false); setPesanSukses(''); }, 3500);
    } else alert('Gagal mengirimkan usulan.');
  };

  const totalJiwa = dataTergrup.reduce((t, g) => t + g.warga.length, 0);
  const sudahTerimaTotal = periodeAktif ? Array.from(distribusiPeriode).length : 0;
  const resumePerRT = dataTergrup.map((grup) => ({
    ...grup,
    sudahTerima: grup.warga.filter((w) => distribusiPeriode.has(w.id)).length,
    belumTerima: grup.warga.filter((w) => !distribusiPeriode.has(w.id)).length,
  }));

  const saldoPct = totalPenerimaan > 0 ? Math.round((saldo / totalPenerimaan) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-background text-foreground transition-colors">
      {/* ── HERO HEADER ── */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white px-6 pt-10 pb-16 relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 rounded-full bg-emerald-600/30" />

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl p-2 flex items-center justify-center shadow-xl border border-white/20">
            <img src="/logo2.png" alt="Logo LAZISNU" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">LAZISNU DESA BADEAN</h1>
          <p className="text-emerald-200 text-sm mt-1.5 font-medium">Transparansi Pengelolaan Zakat Mal</p>
        </div>
      </div>

      {/* ── STATS CARDS (overlap hero) ── */}
      <div className="px-4 -mt-8 mb-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Saldo Kas */}
          {loadingSaldo ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-5 shadow-md animate-fade-in">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">💰 Saldo Kas</p>
                <p className={`text-xl font-extrabold ${saldo < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {formatRupiah(saldo)}
                </p>
                <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(saldoPct, 100)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{saldoPct}% dari total penerimaan</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-2xl p-5 shadow-md animate-fade-in">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">📥 Total Penerimaan</p>
                <p className="text-xl font-extrabold text-blue-700 dark:text-blue-400">{formatRupiah(totalPenerimaan)}</p>
                <p className="text-[10px] text-gray-400 mt-2">Zakat Mal + Sedekah/Infak</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-orange-100 dark:border-orange-900 rounded-2xl p-5 shadow-md animate-fade-in">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">📤 Total Disalurkan</p>
                <p className="text-xl font-extrabold text-orange-600 dark:text-orange-400">{formatRupiah(totalDistribusi)}</p>
                <p className="text-[10px] text-gray-400 mt-2">Ke mustahiq terdaftar</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-10 space-y-5">
        {/* ── Total Mustahiq ── */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border border-emerald-200 dark:border-emerald-900 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">👥 Mustahiq Terdata</p>
              <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">{totalJiwa} <span className="text-sm font-medium">Jiwa</span></p>
            </div>
            <div className="text-4xl opacity-20">🕌</div>
          </div>
        </div>

        {/* ── Periode Distribusi ── */}
        {periodeAktif && (
          <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900 rounded-2xl p-5 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">📅 {periodeAktif.nama}</span>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(periodeAktif.tanggal_buka).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold">AKTIF</span>
            </div>

            {/* Progress bar distribusi */}
            {totalMustahiqPeriode > 0 && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">Progres Distribusi</p>
                <ProgressBar value={sudahTerimaTotal} max={totalMustahiqPeriode} />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[11px] uppercase font-semibold tracking-wider">
                    <th className="p-2.5">RT</th>
                    <th className="p-2.5 text-center">Total</th>
                    <th className="p-2.5 text-center text-emerald-600">Sudah ✓</th>
                    <th className="p-2.5 text-center text-red-500">Belum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {resumePerRT.map((grup) => (
                    <tr key={grup.rt_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="p-2.5 font-semibold text-gray-900 dark:text-gray-100">RT.{grup.no_rt}</td>
                      <td className="p-2.5 text-center font-medium text-gray-500 dark:text-gray-400">{grup.warga.length}</td>
                      <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{grup.sudahTerima}</td>
                      <td className="p-2.5 text-center font-bold text-red-500 dark:text-red-400">{grup.belumTerima}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tombol Usulan ── */}
        <button onClick={() => setBukaModal(true)}
          className="w-full px-5 py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-md shadow-emerald-200 hover:bg-emerald-700 active:scale-[.98] transition-all flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Usulkan Warga Baru sebagai Mustahiq
        </button>

        {/* ── Controls ── */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input type="text" placeholder="Cari nama mustahiq..." value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 dark:text-gray-100" />
          </div>
          <div className="w-full md:w-52">
            <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 dark:text-gray-100 font-medium">
              <option value="semua">🌐 Semua RT</option>
              {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt} {rt.nama_rt}</option>))}
            </select>
          </div>
        </div>

        {/* ── Data Mustahiq ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                <div className="skeleton h-4 w-28 mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3].map(j => <div key={j} className="skeleton h-3 w-full" />)}
                </div>
              </div>
            ))}
          </div>
        ) : dataTergrup.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-gray-400 text-sm shadow-sm">
            <p className="text-3xl mb-3">🔍</p>
            <p>Data tidak ditemukan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dataTergrup.map((grup) => (
              <div key={grup.rt_id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="text-emerald-900 dark:text-emerald-200 font-bold text-sm flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-emerald-600 rounded-full inline-block" />
                    RT.{grup.no_rt} — {grup.nama_rt}
                  </h3>
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">{grup.warga.length} Jiwa</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[11px] uppercase font-semibold tracking-wider">
                        <th className="p-3 w-12 text-center">No</th>
                        <th className="p-3">Nama Lengkap</th>
                        <th className="p-3">Keterangan</th>
                        {periodeAktif && <th className="p-3 text-center">Distribusi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {grup.warga.map((w, i) => (
                        <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                          <td className="p-3 text-center font-medium text-gray-400 dark:text-gray-500">{i + 1}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">{w.nama}</td>
                          <td className="p-3 text-gray-500 dark:text-gray-400 italic text-xs">{w.keterangan || '—'}</td>
                          {periodeAktif && (
                            <td className="p-3 text-center">
                              {distribusiPeriode.has(w.id)
                                ? <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">✓ Sudah</span>
                                : <span className="inline-flex text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Belum</span>
                              }
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL USULAN ── */}
      {bukaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100 dark:border-gray-800 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Usulkan Penerima Zakat Baru</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rekomendasikan warga yang berhak</p>
              </div>
              <button onClick={() => setBukaModal(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {pesanSukses ? (
              <div className="p-4 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-xl text-sm border border-green-200 dark:border-green-900 font-medium flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {pesanSukses}
              </div>
            ) : (
              <form onSubmit={kirimUsulanBaru} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Wilayah RT</label>
                  <select required value={formRT} onChange={(e) => setFormRT(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100">
                    <option value="">— Pilih RT —</option>
                    {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt} — {rt.nama_rt}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Nama Lengkap</label>
                  <input type="text" required placeholder="Contoh: Ahmad Sulaiman" value={formNama} onChange={(e) => setFormNama(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Alasan / Keterangan</label>
                  <textarea placeholder="Contoh: Lansia sebatang kara" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm h-20 resize-none bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setBukaModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    Batal
                  </button>
                  <button type="submit"
                    className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition active:scale-95">
                    Kirim Usulan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
