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
  const [wargaHapus, setWargaHapus] = useState<Warga | null>(null);
  const [formRT, setFormRT] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formAlasanHapus, setFormAlasanHapus] = useState('');
  const [pesanSukses, setPesanSukses] = useState('');

  // Transparansi
  const [saldo, setSaldo] = useState(0);
  const [totalPenerimaan, setTotalPenerimaan] = useState(0);
  const [totalDistribusi, setTotalDistribusi] = useState(0);
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [distribusiPeriode, setDistribusiPeriode] = useState<Set<number>>(new Set());
  const [rtIdsPeriodeAktif, setRtIdsPeriodeAktif] = useState<Set<number>>(new Set());
  const [rtIdsPutaran, setRtIdsPutaran] = useState<Set<number>>(new Set());
  const [distribusiPutaran, setDistribusiPutaran] = useState<Set<number>>(new Set());
  const [totalMustahiqPeriode, setTotalMustahiqPeriode] = useState(0);
  const [mustahiqCountPerRT, setMustahiqCountPerRT] = useState<Record<number, number>>({});
  const [mustahiqIdsPerRT, setMustahiqIdsPerRT] = useState<Record<number, number[]>>({});
  const [showRingkasanPutaran, setShowRingkasanPutaran] = useState(false);

  useEffect(() => {
    const initData = async () => {
      setLoadingSaldo(true);
      try {
        const publicActions = await import('@/lib/actions/public');
        const data = await publicActions.getPublicStats();
        
        // 1. Saldo & Total
        setSaldo(data.saldo);
        setTotalPenerimaan(data.totalPenerimaan);
        setTotalDistribusi(data.totalDistribusi);
        
        // 2. Daftar RT & Mustahiq
        setDaftarRT(data.daftarRT);
        setMustahiqCountPerRT(data.mustahiqCountPerRT);
        setMustahiqIdsPerRT(data.mustahiqIdsPerRT);

        // 3. Periode Aktif
        if (data.periodeAktif) {
          setPeriodeAktif(data.periodeAktif);
          setDistribusiPeriode(new Set(data.distribusiPeriode));
          setRtIdsPeriodeAktif(new Set(data.rtIdsPeriodeAktif));
          setTotalMustahiqPeriode(data.totalMustahiqPeriode);
        }

        // 4. Putaran
        setRtIdsPutaran(new Set(data.rtIdsPutaran));
        setDistribusiPutaran(new Set(data.distribusiPutaran));

      } catch (e) {
        console.error(e);
      }
      setLoadingSaldo(false);
    };
    initData();
  }, []);

  useEffect(() => {
    const ambilDataWarga = async () => {
      setLoading(true);
      let query = supabase.from('penerima_zakat').select('id, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )');
      if (kataKunci.trim()) query = query.ilike('nama', `%${kataKunci}%`);
      if (rtTerpilih !== 'semua') query = query.eq('rt_id', parseInt(rtTerpilih));
      const { data, error } = await query.order('rt_id', { ascending: true }).order('nama', { ascending: true });
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

  const kirimUsulanHapus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaHapus || !formAlasanHapus) return alert('Alasan wajib diisi.');
    const { error } = await supabase.from('pengajuan_update').insert([
      { 
        penerima_id: wargaHapus.id, 
        nama_baru: wargaHapus.nama, 
        keterangan_baru: `[USULAN HAPUS - RT ID: ${wargaHapus.rt_id}] ${formAlasanHapus}`.trim(), 
        status: 'PENDING' 
      }
    ]);
    if (!error) {
      setPesanSukses('Usulan penghapusan berhasil dikirim!');
      setFormAlasanHapus('');
      setTimeout(() => { setWargaHapus(null); setPesanSukses(''); }, 3500);
    } else alert('Gagal mengirimkan usulan.');
  };

  const totalJiwa = dataTergrup.reduce((t, g) => t + g.warga.length, 0);
  const sudahTerimaTotal = periodeAktif ? Array.from(distribusiPeriode).length : 0;
  const saldoPct = totalPenerimaan > 0 ? Math.round((saldo / totalPenerimaan) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-background text-foreground transition-colors">
      {/* ── HERO HEADER ── */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white px-4 sm:px-6 pt-7 pb-14 sm:pt-10 sm:pb-16 relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-40px] w-40 sm:w-48 h-40 sm:h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-[-20px] left-[-20px] w-28 sm:w-32 h-28 sm:h-32 rounded-full bg-emerald-600/30 pointer-events-none" />

        <div className="relative z-10 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 bg-white rounded-2xl p-2 flex items-center justify-center shadow-xl border border-white/20">
            <img src="/logo2.png" alt="Logo LAZISNU" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">LAZISNU DESA BADEAN</h1>
          <p className="text-emerald-200 text-xs sm:text-sm mt-1 font-medium">Transparansi Pengelolaan Zakat Mal</p>
        </div>
      </div>

      <div className="px-3 sm:px-4 -mt-7 sm:-mt-8 mb-5 sm:mb-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {loadingSaldo ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-4 sm:p-5 shadow-sm sm:shadow-md animate-fade-in">
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">💰 Saldo Kas</p>
                <p className={`text-xl sm:text-2xl font-extrabold ${saldo < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {formatRupiah(saldo)}
                </p>
                <div className="mt-2 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.min(saldoPct, 100)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{saldoPct}% dari total penerimaan</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900 rounded-2xl p-4 sm:p-5 shadow-sm sm:shadow-md animate-fade-in">
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">📥 Total Penerimaan</p>
                <p className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-400">{formatRupiah(totalPenerimaan)}</p>
                <p className="text-[10px] text-gray-400 mt-2">Zakat Mal + Sedekah/Infak</p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-orange-100 dark:border-orange-900 rounded-2xl p-4 sm:p-5 shadow-sm sm:shadow-md animate-fade-in">
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">📤 Total Disalurkan</p>
                <p className="text-xl sm:text-2xl font-extrabold text-orange-600 dark:text-orange-400">{formatRupiah(totalDistribusi)}</p>
                <p className="text-[10px] text-gray-400 mt-2">Ke mustahiq terdaftar</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-12 space-y-4 sm:space-y-5">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border border-emerald-200 dark:border-emerald-900 rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">👥 Mustahiq Terdata</p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">{totalJiwa} <span className="text-sm font-medium">Jiwa</span></p>
            </div>
            <div className="text-3xl sm:text-4xl opacity-20">🕌</div>
          </div>
        </div>

        {periodeAktif && (
          <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 sm:p-5 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <span className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400">📅 {periodeAktif.nama}</span>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(periodeAktif.tanggal_buka).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full font-bold">AKTIF</span>
            </div>
            {totalMustahiqPeriode > 0 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-100 dark:border-emerald-900">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">Progres Distribusi Periode Ini</p>
                <ProgressBar value={sudahTerimaTotal} max={totalMustahiqPeriode} />
              </div>
            )}
          </div>
        )}

        {daftarRT.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            <button
              onClick={() => setShowRingkasanPutaran((v) => !v)}
              className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition min-h-[48px]"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">🗺️ Progres Putaran Distribusi</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                  {rtIdsPutaran.size} / {daftarRT.length} RT
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showRingkasanPutaran ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRingkasanPutaran && (
              <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto animate-fade-in">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[10px] sm:text-[11px] uppercase font-semibold tracking-wider">
                      <th className="p-2 sm:p-2.5">RT</th>
                      <th className="p-2 sm:p-2.5 text-center">Total</th>
                      <th className="p-2 sm:p-2.5 text-center text-emerald-600">Sudah ✓</th>
                      <th className="p-2 sm:p-2.5 text-center text-red-500">Belum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {daftarRT.map((rt) => {
                      const total = mustahiqCountPerRT[rt.id] ?? 0;
                      const ids = mustahiqIdsPerRT[rt.id] ?? [];
                      const sudah = ids.filter((id) => distribusiPutaran.has(id)).length;
                      const belum = total - sudah;
                      const dijadwalkan = rtIdsPutaran.has(rt.id);
                      return (
                        <tr key={rt.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${!dijadwalkan ? 'opacity-50' : ''}`}>
                          <td className="p-2 sm:p-2.5 font-semibold text-gray-900 dark:text-gray-100">
                            RT.{rt.no_rt}
                            <span className="ml-1 sm:ml-1.5 text-[10px] text-gray-400 font-normal">{rt.nama_rt}</span>
                          </td>
                          <td className="p-2 sm:p-2.5 text-center font-medium text-gray-500 dark:text-gray-400">{total}</td>
                          <td className="p-2 sm:p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {dijadwalkan ? sudah : '—'}
                          </td>
                          <td className="p-2 sm:p-2.5 text-center font-bold">
                            {dijadwalkan
                              ? <span className={belum === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>{belum}</span>
                              : <span className="text-gray-400 text-[10px] font-normal">Belum dijadwalkan</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <button onClick={() => setBukaModal(true)}
          className="w-full px-5 py-3.5 sm:py-3.5 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-md shadow-emerald-200/50 hover:bg-emerald-700 active:scale-[.98] transition-all flex items-center justify-center gap-2 min-h-[48px]">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Usulkan Warga Baru sebagai Mustahiq
        </button>

        <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input type="text" placeholder="Cari nama mustahiq..." value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 sm:py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base sm:text-sm text-gray-900 dark:text-gray-100 min-h-[44px]" />
          </div>
          <div className="w-full md:w-56">
            <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
              className="w-full px-3 py-2.5 sm:py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base sm:text-sm text-gray-900 dark:text-gray-100 font-medium min-h-[44px]">
              <option value="semua">🌐 Semua RT</option>
              {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt} {rt.nama_rt}</option>))}
            </select>
          </div>
        </div>

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
                {/* RT Header Banner */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="text-emerald-900 dark:text-emerald-200 font-bold text-sm flex items-center gap-2">
                    <span className="w-1.5 h-4 sm:h-5 bg-emerald-600 rounded-full inline-block" />
                    RT.{grup.no_rt} — {grup.nama_rt}
                  </h3>
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">{grup.warga.length} Jiwa</span>
                </div>

                {/* ── MOBILE CARD FEED (Phones < md) ── */}
                <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {grup.warga.map((w, i) => {
                    const sudah = distribusiPutaran.has(w.id);
                    return (
                      <div key={w.id} className="p-3.5 sm:p-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug break-words">
                                {w.nama}
                              </h4>
                              {w.keterangan ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                  {w.keterangan}
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-0.5">Tanpa keterangan</p>
                              )}
                            </div>
                          </div>

                          {(periodeAktif || distribusiPutaran.size > 0) && (
                            <div className="shrink-0 text-right">
                              {sudah ? (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-bold">
                                  ✓ Sudah
                                </span>
                              ) : (
                                <span className="inline-flex text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                                  Belum
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Action for Mobile Card */}
                        <div className="mt-2.5 pt-2 border-t border-gray-50 dark:border-gray-800/60 flex justify-end">
                          <button
                            onClick={() => setWargaHapus(w)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition active:scale-95 min-h-[38px]"
                            title="Usulkan Penghapusan (Tidak Layak/Meninggal)"
                          >
                            <svg className="w-3.5 h-3.5 text-red-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Usulkan Hapus</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── DESKTOP TABLE VIEW (Laptops/Tablets >= md) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 text-[11px] uppercase font-semibold tracking-wider">
                        <th className="p-3 w-12 text-center">No</th>
                        <th className="p-3">Nama Lengkap</th>
                        <th className="p-3">Keterangan</th>
                        {(periodeAktif || distribusiPutaran.size > 0) && <th className="p-3 text-center">Distribusi</th>}
                        <th className="p-3 text-center w-14">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {grup.warga.map((w, i) => (
                        <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                          <td className="p-3 text-center font-medium text-gray-400 dark:text-gray-500">{i + 1}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100 font-semibold">{w.nama}</td>
                          <td className="p-3 text-gray-500 dark:text-gray-400 italic text-xs">{w.keterangan || '—'}</td>
                          {(periodeAktif || distribusiPutaran.size > 0) && (
                            <td className="p-3 text-center">
                              {distribusiPutaran.has(w.id)
                                ? <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">✓ Sudah</span>
                                : <span className="inline-flex text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Belum</span>
                              }
                            </td>
                          )}
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => setWargaHapus(w)}
                              title="Usulkan Penghapusan (Tidak Layak/Meninggal)"
                              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
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

      {/* ── MODAL USULAN (NATIVE BOTTOM SHEET ON MOBILE) ── */}
      {bukaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-950 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 relative border-t sm:border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Usulkan Penerima Zakat Baru</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rekomendasikan warga yang berhak</p>
              </div>
              <button onClick={() => setBukaModal(false)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition">
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
                    className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 min-h-[44px]">
                    <option value="">— Pilih RT —</option>
                    {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt} — {rt.nama_rt}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Nama Lengkap</label>
                  <input type="text" required placeholder="Contoh: Ahmad Sulaiman" value={formNama} onChange={(e) => setFormNama(e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-base sm:text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Alasan / Keterangan</label>
                  <textarea placeholder="Contoh: Lansia sebatang kara" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-base sm:text-sm h-20 resize-none bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setBukaModal(false)}
                    className="w-full py-3 sm:py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold transition min-h-[44px]">Batal</button>
                  <button type="submit"
                    className="w-full py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200/50 transition active:scale-95 min-h-[44px]">Kirim Usulan</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL USULAN HAPUS (NATIVE BOTTOM SHEET ON MOBILE) ── */}
      {wargaHapus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-950 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 relative border-t sm:border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto">
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span className="text-red-500">❌</span> Usulkan Penghapusan
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Laporkan mustahiq yang sudah tidak layak / meninggal.</p>
              </div>
              <button onClick={() => setWargaHapus(null)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition">
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
              <form onSubmit={kirimUsulanHapus} className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nama Warga:</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{wargaHapus.nama}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5">Alasan Penghapusan</label>
                  <textarea required placeholder="Misal: Sudah meninggal, atau pindah kota..." value={formAlasanHapus} onChange={(e) => setFormAlasanHapus(e.target.value)} rows={3}
                    className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setWargaHapus(null)}
                    className="w-full py-3 sm:py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold transition min-h-[44px]">Batal</button>
                  <button type="submit"
                    className="w-full py-3 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md shadow-red-200/50 transition active:scale-95 min-h-[44px]">Kirim Usulan</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
