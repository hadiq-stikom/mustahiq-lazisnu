'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { tutupPeriode, hapusDistribusi } from '@/lib/actions/admin';
import { formatRupiah } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Toast from '@/components/Toast';
import type { PeriodeDistribusi, Mustahiq } from '@/lib/types';

export default function AdminDistribusiPage() {
  const [allPeriodes, setAllPeriodes] = useState<PeriodeDistribusi[]>([]);
  const [periodePilih, setPeriodePilih] = useState<number | null>(null);
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);

  const [dataPerRT, setDataPerRT] = useState<{ rt: string; total: number; sudah: number; nominal: number }[]>([]);
  const [mustahiqDetail, setMustahiqDetail] = useState<{ id: number; nama: string; rt: string; sudah: boolean; nominal: number; distId?: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDetail, setShowDetail] = useState(false);

  const [confirmTutup, setConfirmTutup] = useState(false);
  const [confirmHapus, setConfirmHapus] = useState<number | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const closeToast = useCallback(() => setToast((prev) => ({ ...prev, show: false })), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: periodes } = await supabase.from('periode_distribusi').select('*').order('created_at', { ascending: false });
      if (periodes) {
        setAllPeriodes(periodes);
        const aktif = periodes.find((p) => p.status === 'AKTIF');
        if (aktif) setPeriodeAktif(aktif);
        setPeriodePilih(-1);
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!periodePilih) return;
    const loadDetail = async () => {
      const isSemua = periodePilih === -1;

      const [distsResult, periodeRtsResult] = await Promise.all([
        isSemua
          ? supabase.from('distribusi').select('*')
          : supabase.from('distribusi').select('*').eq('periode_id', periodePilih),
        isSemua
          ? supabase.from('periode_rt').select('rt_id')
          : supabase.from('periode_rt').select('rt_id').eq('periode_id', periodePilih),
      ]);

      const dists = distsResult.data ?? [];
      const rtIds = [...new Set((periodeRtsResult.data ?? []).map((r: { rt_id: number }) => r.rt_id))];

      let mustahiqData;
      if (rtIds.length > 0) {
        const { data } = await supabase
          .from('penerima_zakat')
          .select('id, nama, rt_id, daftar_rt(no_rt, nama_rt)')
          .in('rt_id', rtIds);
        mustahiqData = data;
      } else {
        const { data } = await supabase
          .from('penerima_zakat')
          .select('id, nama, rt_id, daftar_rt(no_rt, nama_rt)');
        mustahiqData = data;
      }

      if (mustahiqData) {
        const mentah = mustahiqData as unknown as Mustahiq[];
        const distSet = new Set(dists.map((d) => d.mustahiq_id));
        const distNominal: Record<number, number> = {};
        const distIdMap: Record<number, number> = {};
        dists.forEach((d) => {
          distNominal[d.mustahiq_id] = (distNominal[d.mustahiq_id] || 0) + d.jumlah;
          if (!isSemua) distIdMap[d.mustahiq_id] = d.id;
        });

        const rtMap: Record<string, { total: number; sudah: number; nominal: number }> = {};
        mentah.forEach((m) => {
          const key = `RT.${m.daftar_rt?.no_rt}`;
          if (!rtMap[key]) rtMap[key] = { total: 0, sudah: 0, nominal: 0 };
          rtMap[key].total++;
          if (distSet.has(m.id)) {
            rtMap[key].sudah++;
            rtMap[key].nominal += distNominal[m.id] || 0;
          }
        });

        setDataPerRT(Object.entries(rtMap).map(([rt, v]) => ({ rt, ...v })));
        setMustahiqDetail(
          mentah.map((m) => ({
            id: m.id,
            nama: m.nama,
            rt: `RT.${m.daftar_rt?.no_rt}`,
            sudah: distSet.has(m.id),
            nominal: distNominal[m.id] || 0,
            distId: isSemua ? undefined : distIdMap[m.id],
          })).sort((a, b) => a.rt.localeCompare(b.rt) || a.nama.localeCompare(b.nama))
        );
      }
    };
    loadDetail();
  }, [periodePilih]);

  const handleTutup = async () => {
    if (!periodeAktif) return;
    setConfirmTutup(false);
    try {
      await tutupPeriode(periodeAktif.id);
      setToast({ show: true, message: 'Periode berhasil ditutup.', type: 'success' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal', type: 'error' });
    }
  };

  const handleHapusDist = async (distId: number) => {
    setConfirmHapus(null);
    try {
      await hapusDistribusi(distId);
      setToast({ show: true, message: 'Distribusi berhasil dihapus.', type: 'success' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Gagal', type: 'error' });
    }
  };

  const totalDist = mustahiqDetail.reduce((s, m) => s + m.nominal, 0);
  const totalSudah = mustahiqDetail.filter((m) => m.sudah).length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Distribusi Zakat</h1>

      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={closeToast} />

      {/* HEADER */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500">Periode:</label>
          <select value={periodePilih ?? ''} onChange={(e) => {
            const val = parseInt(e.target.value);
            setPeriodePilih(val || null);
            setShowDetail(false);
          }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
            <option value={-1}>Semua Periode (1 Putaran)</option>
            {allPeriodes.map((p) => (
              <option key={p.id} value={p.id}>{p.nama} ({p.status === 'AKTIF' ? 'Aktif' : 'Selesai'})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">{totalSudah} / {mustahiqDetail.length} mustahiq</span>
          <span className="text-gray-500">Tersalur: <strong className="text-gray-900">{formatRupiah(totalDist)}</strong></span>
          <button onClick={() => setShowDetail(!showDetail)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-[10px] font-semibold text-gray-700 hover:bg-gray-50">
            {showDetail ? 'Ringkasan' : 'Detail'}
          </button>
          {periodeAktif && periodePilih === periodeAktif.id && (
            <button onClick={() => setConfirmTutup(true)}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700">Tutup Periode</button>
          )}
        </div>
      </div>

      {/* RINGKASAN PER RT */}
      {!showDetail && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-900">Ringkasan per RT</div>
          {loading ? (
            <div className="p-6 text-center text-xs text-gray-400">Memuat...</div>
          ) : dataPerRT.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-400">Tidak ada data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                    <th className="p-3">RT</th><th className="p-3">Total</th><th className="p-3">Sudah</th>
                    <th className="p-3">%</th><th className="p-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dataPerRT.map((r) => (
                    <tr key={r.rt} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-900">{r.rt}</td>
                      <td className="p-3">{r.total}</td>
                      <td className="p-3">{r.sudah}</td>
                      <td className="p-3">{r.total > 0 ? Math.round((r.sudah / r.total) * 100) : 0}%</td>
                      <td className="p-3 text-right font-semibold text-gray-900">{formatRupiah(r.nominal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MUSTAHIQ */}
      {showDetail && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <span className="font-bold text-sm text-gray-900">Detail Mustahiq</span>
              {periodePilih !== -1 && <span className="text-xs text-gray-500">Klik Hapus untuk batalkan distribusi</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <th className="p-2.5">RT</th><th className="p-2.5">Nama</th>
                  <th className="p-2.5">Status</th><th className="p-2.5 text-right">Nominal</th>
                    {periodePilih !== -1 && <th className="p-2.5 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mustahiqDetail.map((m) => (
                  <tr key={m.id} className={`${m.sudah ? 'bg-green-50/30' : ''} hover:bg-gray-50`}>
                    <td className="p-2.5 text-gray-500">{m.rt}</td>
                    <td className="p-2.5 font-semibold text-gray-900">{m.nama}</td>
                    <td className="p-2.5">
                      {m.sudah
                        ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">✅ Sudah</span>
                        : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-semibold">⏳ Belum</span>}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-gray-900">{m.sudah ? formatRupiah(m.nominal) : '-'}</td>
                    {periodePilih !== -1 && (
                      <td className="p-2.5 text-center">
                        {m.distId && (
                          <button onClick={() => setConfirmHapus(m.distId!)}
                            className="text-red-600 hover:text-red-800 text-[10px] font-semibold">Hapus</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmTutup}
        title="Tutup Periode"
        message="Periode yang sudah ditutup tidak bisa dibuka kembali. Lanjutkan?"
        confirmLabel="Tutup"
        variant="danger"
        onConfirm={handleTutup}
        onCancel={() => setConfirmTutup(false)}
      />
      <ConfirmModal
        open={confirmHapus !== null}
        title="Hapus Distribusi"
        message="Hapus data distribusi ini?"
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={() => handleHapusDist(confirmHapus!)}
        onCancel={() => setConfirmHapus(null)}
      />
    </div>
  );
}
