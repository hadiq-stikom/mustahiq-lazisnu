'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { bukaPeriodeDistribusi, resetPeriodeRt } from '@/lib/actions/admin';
import { formatRupiah } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from '@/components/Toast';
import type { RT, PeriodeDistribusi } from '@/lib/types';

export default function PerencanaanPage() {
  const [daftarRT, setDaftarRT] = useState<(RT & { jumlah_mustahiq: number })[]>([]);
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [loading, setLoading] = useState(true);

  const [rtDipilih, setRtDipilih] = useState<Set<number>>(new Set());
  const [rtTerpakaiCount, setRtTerpakaiCount] = useState(0);
  const [totalRTCount, setTotalRTCount] = useState(0);
  const [saldoSekarang, setSaldoSekarang] = useState(0);
  const [jumlahPerJiwa, setJumlahPerJiwa] = useState('');
  const [bentuk, setBentuk] = useState('TUNAI');

  const [menyimpan, setMenyimpan] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const closeToast = useCallback(() => setToast((prev) => ({ ...prev, show: false })), []);

  useEffect(() => {
    const load = async () => {
      const [rtsResult, mustahiqResult, periodesResult, periodeRtResult] = await Promise.all([
        supabase.from('daftar_rt').select('*').order('no_rt'),
        supabase.from('penerima_zakat').select('id, rt_id'),
        supabase.from('periode_distribusi').select('*').eq('status', 'AKTIF').order('created_at', { ascending: false }).limit(1),
        supabase.from('periode_rt').select('rt_id'),
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
      if (periodesResult.data && periodesResult.data.length > 0) {
        setPeriodeAktif(periodesResult.data[0]);
        setJumlahPerJiwa(periodesResult.data[0].jumlah_per_jiwa?.toString() || '');
        setBentuk(periodesResult.data[0].bentuk || 'TUNAI');
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
    };
    load();
  }, []);

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
      setToast({ show: true, message: 'Isi jumlah per jiwa.', type: 'error' });
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
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setMenyimpan(false);
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal', type: 'error' });
    }
  };

  const handleResetPutaran = async () => {
    try {
      await resetPeriodeRt();
      setConfirmReset(false);
      window.location.reload();
    } catch (err) {
      setConfirmReset(false);
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal', type: 'error' });
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Memuat...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900">Perencanaan Distribusi</h1>
      <p className="text-xs text-gray-500">Alat bantu rapat pengurus. Tentukan cakupan RT, nominal per jiwa, dan bentuk bantuan.</p>

      <div className={`p-4 rounded-xl border ${
        periodeAktif ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <p className="text-xs font-bold">
          {periodeAktif
            ? `✅ Periode Aktif: ${periodeAktif.nama}`
            : '⏸️ Belum ada periode aktif.'}
        </p>
        {periodeAktif && (
          <p className="text-[11px] text-gray-600 mt-1">
            @ Rp {Number(periodeAktif.jumlah_per_jiwa).toLocaleString('id-ID')} / jiwa {periodeAktif.bentuk !== 'TUNAI' ? `(${periodeAktif.bentuk})` : ''}
          </p>
        )}
      </div>

      {/* PUTARAN PENUH */}
      {!periodeAktif && daftarRT.length === 0 && totalRTCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-3">
          <p className="text-sm font-bold text-emerald-800">🎉 Semua RT sudah pernah mendapat distribusi. Putaran selesai!</p>
          <button onClick={() => setConfirmReset(true)}
            className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700">
            🔄 Mulai Putaran Baru
          </button>
        </div>
      )}

      {/* STEP 1: PILIH RT */}
      {!periodeAktif && daftarRT.length > 0 && (
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-900">1. Pilih Wilayah RT</h2>
        <p className="text-[10px] text-gray-400">{rtTerpakaiCount}/{totalRTCount} RT sudah pernah distribusi</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {daftarRT.map((rt) => {
            const checked = rtDipilih.has(rt.id);
            return (
              <button key={rt.id} onClick={() => toggleRT(rt.id)}
                className={`p-3 rounded-xl border text-left transition text-xs ${
                  checked ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}>
                <p className="font-bold text-gray-900">RT.{rt.no_rt}</p>
                <p className="text-gray-500 mt-0.5">{rt.nama_rt}</p>
                <p className="text-emerald-700 font-semibold mt-1">{rt.jumlah_mustahiq} Mustahiq</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">{rtDipilih.size} RT dipilih — <strong>{totalMustahiqTerpilih} total mustahiq</strong></p>
      </div>
      )}

      {/* STEP 2: TENTUKAN NOMINAL */}
      {daftarRT.length > 0 && (
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900">2. Tentukan Nominal & Bentuk Bantuan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Jumlah per Jiwa (Rp)</label>
            <input type="number" min="0" placeholder="0" value={jumlahPerJiwa}
              onChange={(e) => setJumlahPerJiwa(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Bentuk Bantuan</label>
            <select value={bentuk} onChange={(e) => setBentuk(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value="TUNAI">Tunai (Uang)</option>
              <option value="BARANG">Barang / Sembako</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>
        </div>

        {/* Dana tersedia dari saldo sekarang */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 mb-1">Dana Tersedia (dari saldo saat ini)</label>
          <p className="text-2xl font-bold text-gray-900">{formatRupiah(saldoSekarang)}</p>
        </div>

        {jumlahPerJiwa && parseFloat(jumlahPerJiwa) > 0 && totalMustahiqTerpilih > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs">
            <p className="text-gray-900 dark:text-gray-100">Estimasi total: <strong>{formatRupiah(parseFloat(jumlahPerJiwa) * totalMustahiqTerpilih)}</strong></p>
            <p className="text-gray-500 dark:text-gray-400">({totalMustahiqTerpilih} jiwa × {formatRupiah(parseFloat(jumlahPerJiwa))})</p>
          </div>
        )}

        {saldoSekarang > 0 && totalMustahiqTerpilih > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg p-3 text-xs">
            <p className="text-emerald-900 dark:text-emerald-100">
              Dana tersedia: <strong>{formatRupiah(saldoSekarang)}</strong>
              {estimasiPerJiwa > 0 && <span className="text-emerald-700 dark:text-emerald-300"> — estimasi @ {formatRupiah(estimasiPerJiwa)}/jiwa jika dibagi rata</span>}
            </p>
          </div>
        )}
      </div>
      )}

      {/* TOMBOL */}
      {!periodeAktif && daftarRT.length > 0 && (
        <button onClick={handleBukaPeriode}
          disabled={totalMustahiqTerpilih === 0 || !jumlahPerJiwa || menyimpan}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition">
          {menyimpan ? '⏳ Menyimpan...' : '🚀 Buka Periode Distribusi Baru'}
        </button>
      )}

      <ConfirmModal
        open={confirmReset}
        title="Mulai Putaran Baru"
        message="Semua RT akan tersedia lagi untuk dipilih. Data distribusi sebelumnya tetap tersimpan."
        confirmLabel="Mulai"
        cancelLabel="Batal"
        variant="primary"
        onConfirm={handleResetPutaran}
        onCancel={() => setConfirmReset(false)}
      />
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={closeToast} />
    </div>
  );
}
