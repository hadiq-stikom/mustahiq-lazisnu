'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { bukaPeriodeDistribusi, resetPeriodeRt, tutupPeriode } from '@/lib/actions/admin';
import { formatRupiah, formatTanggalSingkat } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from '@/components/Toast';
import type { RT, PeriodeDistribusi } from '@/lib/types';

export default function PerencanaanPage() {
  const [daftarRT, setDaftarRT] = useState<(RT & { jumlah_mustahiq: number })[]>([]);
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [semuaPeriode, setSemuaPeriode] = useState<PeriodeDistribusi[]>([]);
  const [loading, setLoading] = useState(true);

  // Active period stats
  const [activeStats, setActiveStats] = useState<{ totalMustahiq: number; sudahTerima: number; totalRupiah: number }>({
    totalMustahiq: 0,
    sudahTerima: 0,
    totalRupiah: 0,
  });

  const [rtDipilih, setRtDipilih] = useState<Set<number>>(new Set());
  const [rtTerpakaiCount, setRtTerpakaiCount] = useState(0);
  const [totalRTCount, setTotalRTCount] = useState(0);
  const [saldoSekarang, setSaldoSekarang] = useState(0);
  const [jumlahPerJiwa, setJumlahPerJiwa] = useState('');
  const [bentuk, setBentuk] = useState('TUNAI');

  const [menyimpan, setMenyimpan] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmTutup, setConfirmTutup] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const closeToast = useCallback(() => setToast((prev) => ({ ...prev, show: false })), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [rtsResult, mustahiqResult, periodesResult, periodeRtResult] = await Promise.all([
      supabase.from('daftar_rt').select('*').order('no_rt'),
      supabase.from('penerima_zakat').select('id, rt_id'),
      supabase.from('periode_distribusi').select('*').order('created_at', { ascending: false }),
      supabase.from('periode_rt').select('rt_id, periode_id'),
    ]);

    const rtTerpakai = new Set((periodeRtResult.data ?? []).map((r: { rt_id: number }) => r.rt_id));
    const totalRT = rtsResult.data?.length ?? 0;

    setRtTerpakaiCount(rtTerpakai.size);
    setTotalRTCount(totalRT);

    if (rtsResult.data && mustahiqResult.data) {
      const countMap: Record<number, number> = {};
      mustahiqResult.data.forEach((m) => { countMap[m.rt_id] = (countMap[m.rt_id] || 0) + 1; });
      setDaftarRT(rtsResult.data
        .filter((rt) => !rtTerpakai.has(rt.id))
        .map((rt) => ({ ...rt, jumlah_mustahiq: countMap[rt.id] || 0 })));
    }

    const allP = periodesResult.data ?? [];
    setSemuaPeriode(allP);

    const aktif = allP.find((p) => p.status === 'AKTIF') || null;
    setPeriodeAktif(aktif);

    if (aktif) {
      // Hitung progres periode aktif
      const [distsResult, activeRtResult] = await Promise.all([
        supabase.from('distribusi').select('jumlah, mustahiq_id').eq('periode_id', aktif.id),
        supabase.from('periode_rt').select('rt_id').eq('periode_id', aktif.id),
      ]);

      const dists = distsResult.data ?? [];
      const totalRupiah = dists.reduce((s, d) => s + (d.jumlah || 0), 0);
      const sudahTerima = new Set(dists.map((d) => d.mustahiq_id)).size;

      const rtIds = (activeRtResult.data ?? []).map((r: { rt_id: number }) => r.rt_id);
      let totalMustahiq = 0;
      if (rtIds.length > 0) {
        const { count } = await supabase.from('penerima_zakat').select('*', { count: 'exact', head: true }).in('rt_id', rtIds);
        totalMustahiq = count ?? 0;
      }

      setActiveStats({ totalMustahiq, sudahTerima, totalRupiah });
    }

    // Hitung saldo sekarang
    const now = new Date();
    const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const tglAwal = `${bulanIni}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const tglAkhir = nextMonth.toISOString().split('T')[0];

    const prevDate = new Date(now.getFullYear(), now.getMonth(), 1);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevBulan = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

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
    setSaldoSekarang(saldoAwal + totalPenerimaan - totalDistribusi - totalPengeluaran);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRT = (id: number) => {
    setRtDipilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalMustahiqTerpilih = useMemo(
    () => daftarRT.filter((rt) => rtDipilih.has(rt.id)).reduce((sum, rt) => sum + rt.jumlah_mustahiq, 0),
    [daftarRT, rtDipilih]
  );

  const estimasiPerJiwa = useMemo(() => {
    if (!saldoSekarang || totalMustahiqTerpilih === 0) return 0;
    return Math.floor(saldoSekarang / totalMustahiqTerpilih);
  }, [saldoSekarang, totalMustahiqTerpilih]);

  const handleBukaPeriode = async () => {
    if (totalMustahiqTerpilih === 0) {
      setToast({ show: true, message: 'Pilih minimal 1 RT.', type: 'error' });
      return;
    }
    if (!jumlahPerJiwa || parseFloat(jumlahPerJiwa) <= 0) {
      setToast({ show: true, message: 'Isi jumlah nominal per jiwa.', type: 'error' });
      return;
    }

    const namaPeriode = `Periode ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    const fd = new FormData();
    fd.set('nama', namaPeriode);
    fd.set('tanggal_buka', new Date().toISOString().split('T')[0]);
    fd.set('jumlah_per_jiwa', jumlahPerJiwa);
    fd.set('bentuk', bentuk);
    fd.set('rt_ids', JSON.stringify(Array.from(rtDipilih)));

    setMenyimpan(true);
    try {
      await bukaPeriodeDistribusi(fd);
      setToast({ show: true, message: 'Periode distribusi berhasil dibuka!', type: 'success' });
      setRtDipilih(new Set());
      setJumlahPerJiwa('');
      loadData();
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal', type: 'error' });
    } finally {
      setMenyimpan(false);
    }
  };

  const handleTutupPeriode = async () => {
    if (!periodeAktif) return;
    setConfirmTutup(false);
    setMenyimpan(true);
    try {
      await tutupPeriode(periodeAktif.id);
      setToast({ show: true, message: 'Periode berhasil ditutup!', type: 'success' });
      loadData();
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal menutup periode', type: 'error' });
    } finally {
      setMenyimpan(false);
    }
  };

  const handleResetPutaran = async () => {
    try {
      await resetPeriodeRt();
      setConfirmReset(false);
      loadData();
    } catch (err) {
      setConfirmReset(false);
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const activePct = activeStats.totalMustahiq > 0 ? Math.round((activeStats.sudahTerima / activeStats.totalMustahiq) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">📋 Periode Distribusi Zakat</h1>
        <p className="text-xs text-gray-500 mt-0.5">Kelola alokasi RT, nominal bantuan, serta buka dan tutup periode distribusi.</p>
      </div>

      {/* ── PERIODE AKTIF CARD ── */}
      {periodeAktif ? (
        <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-700/60 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  PERIODE AKTIF
                </span>
                <span className="text-xs text-emerald-200">
                  Dibuka {formatTanggalSingkat(periodeAktif.tanggal_buka)}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-white">{periodeAktif.nama}</h2>
            </div>
            <button
              onClick={() => setConfirmTutup(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tutup Periode Ini
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <p className="text-emerald-200 text-[10px] uppercase font-semibold">Nominal / Jiwa</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {periodeAktif.jumlah_per_jiwa ? formatRupiah(Number(periodeAktif.jumlah_per_jiwa)) : 'Belum set'}
              </p>
              <p className="text-[10px] text-emerald-300 mt-0.5">Bentuk: {periodeAktif.bentuk}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <p className="text-emerald-200 text-[10px] uppercase font-semibold">Progres Penyaluran</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {activeStats.sudahTerima} / {activeStats.totalMustahiq} Mustahiq
              </p>
              <div className="w-full h-1.5 bg-emerald-950 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${activePct}%` }} />
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/10">
              <p className="text-emerald-200 text-[10px] uppercase font-semibold">Total Tersalurkan</p>
              <p className="text-lg font-bold text-emerald-300 mt-0.5">
                {formatRupiah(activeStats.totalRupiah)}
              </p>
              <p className="text-[10px] text-emerald-200 mt-0.5">Oleh petugas di lapangan</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <div>
            <p className="font-bold">Belum Ada Periode Aktif</p>
            <p className="text-amber-700">Silakan pilih RT dan tentukan nominal di bawah untuk membuka periode distribusi baru.</p>
          </div>
        </div>
      )}

      {/* ── FORM BUKA PERIODE BARU (Hanya jika TIDAK ada periode aktif) ── */}
      {!periodeAktif && (
        <div className="space-y-5 animate-fade-in">
          {/* PUTARAN PENUH */}
          {daftarRT.length === 0 && totalRTCount > 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
              <p className="text-3xl">🎉</p>
              <p className="text-base font-extrabold text-emerald-900">Semua RT Sudah Pernah Mendapat Distribusi!</p>
              <p className="text-xs text-emerald-700">Putaran distribusi desa telah lengkap. Anda dapat memulai putaran baru agar semua RT dapat dipilih kembali.</p>
              <button onClick={() => setConfirmReset(true)}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition">
                🔄 Mulai Putaran Baru
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: PILIH RT */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-bold text-gray-900">1. Pilih Wilayah RT</h2>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
                    {rtTerpakaiCount}/{totalRTCount} RT sudah terjangkau
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {daftarRT.map((rt) => {
                    const checked = rtDipilih.has(rt.id);
                    return (
                      <button key={rt.id} onClick={() => toggleRT(rt.id)}
                        className={`p-3 rounded-xl border text-left transition text-xs ${
                          checked ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}>
                        <p className="font-bold text-gray-900">RT.{rt.no_rt}</p>
                        <p className="text-gray-500 mt-0.5 truncate">{rt.nama_rt}</p>
                        <p className="text-emerald-700 font-semibold mt-1">{rt.jumlah_mustahiq} Mustahiq</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  <strong className="text-emerald-700">{rtDipilih.size} RT</strong> dipilih — Total <strong>{totalMustahiqTerpilih} jiwa mustahiq</strong>
                </p>
              </div>

              {/* STEP 2: TENTUKAN NOMINAL */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-900">2. Tentukan Nominal &amp; Bentuk Bantuan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jumlah per Jiwa (Rp)</label>
                    <input type="number" min="0" placeholder="Contoh: 100000" value={jumlahPerJiwa}
                      onChange={(e) => setJumlahPerJiwa(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bentuk Bantuan</label>
                    <select value={bentuk} onChange={(e) => setBentuk(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                      <option value="TUNAI">Tunai (Uang)</option>
                      <option value="BARANG">Barang / Sembako</option>
                      <option value="LAINNYA">Lainnya</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                  <p className="text-gray-600">Saldo kas saat ini: <strong className="text-gray-900">{formatRupiah(saldoSekarang)}</strong></p>
                  {jumlahPerJiwa && parseFloat(jumlahPerJiwa) > 0 && totalMustahiqTerpilih > 0 && (
                    <p className="text-emerald-700 font-bold">
                      Estimasi anggaran: {formatRupiah(parseFloat(jumlahPerJiwa) * totalMustahiqTerpilih)}
                      <span className="text-gray-500 font-normal"> ({totalMustahiqTerpilih} jiwa × {formatRupiah(parseFloat(jumlahPerJiwa))})</span>
                    </p>
                  )}
                  {saldoSekarang > 0 && totalMustahiqTerpilih > 0 && estimasiPerJiwa > 0 && (
                    <p className="text-blue-700">
                      Ideal per jiwa jika dibagi rata dari saldo: {formatRupiah(estimasiPerJiwa)}/jiwa
                    </p>
                  )}
                </div>

                <button onClick={handleBukaPeriode}
                  disabled={totalMustahiqTerpilih === 0 || !jumlahPerJiwa || menyimpan}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-md shadow-emerald-200 transition active:scale-[.98]">
                  {menyimpan ? '⏳ Menyimpan...' : '🚀 Buka Periode Distribusi Baru'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── RIWAYAT PERIODE ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-sm font-bold text-gray-900">📜 Riwayat Periode Distribusi</h2>
          <span className="text-xs text-gray-500">{semuaPeriode.length} periode tercatat</span>
        </div>
        {semuaPeriode.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">Belum ada riwayat periode.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-100">
                  <th className="p-3">Nama Periode</th>
                  <th className="p-3">Tanggal Buka</th>
                  <th className="p-3">Tanggal Tutup</th>
                  <th className="p-3">Nominal / Jiwa</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {semuaPeriode.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-semibold text-gray-900">{p.nama}</td>
                    <td className="p-3 text-gray-600">{formatTanggalSingkat(p.tanggal_buka)}</td>
                    <td className="p-3 text-gray-600">{p.tanggal_tutup ? formatTanggalSingkat(p.tanggal_tutup) : '—'}</td>
                    <td className="p-3 font-semibold text-gray-800">
                      {p.jumlah_per_jiwa ? formatRupiah(Number(p.jumlah_per_jiwa)) : '—'}
                      <span className="text-[10px] text-gray-400 font-normal ml-1">({p.bentuk})</span>
                    </td>
                    <td className="p-3">
                      {p.status === 'AKTIF' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-semibold">
                          Selesai
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Tutup */}
      <ConfirmModal
        open={confirmTutup}
        title="Tutup Periode Distribusi"
        message="Apakah Anda yakin ingin menutup periode distribusi ini? Periode yang sudah ditutup tidak dapat dibuka kembali."
        confirmLabel="Tutup Periode"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleTutupPeriode}
        onCancel={() => setConfirmTutup(false)}
      />

      {/* Modal Konfirmasi Reset Putaran */}
      <ConfirmModal
        open={confirmReset}
        title="Mulai Putaran Baru"
        message="Semua RT akan tersedia kembali untuk dipilih. Data pencatatan distribusi sebelumnya tetap aman tersimpan."
        confirmLabel="Mulai Putaran Baru"
        cancelLabel="Batal"
        variant="primary"
        onConfirm={handleResetPutaran}
        onCancel={() => setConfirmReset(false)}
      />

      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={closeToast} />
    </div>
  );
}
