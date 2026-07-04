'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { getLaporanSaldo, simpanSaldoBulanan } from '@/lib/actions/admin';
import { formatRupiah } from '@/lib/utils';
import type { SaldoBulanan } from '@/lib/types';

function formatBulanLabel(bulan: string): string {
  const [t, b] = bulan.split('-').map(Number);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${months[b - 1]} ${t}`;
}

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const tahunList = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

const bulanOptions = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
  { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

export default function LaporanSaldoPage() {
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear().toString());
  const [filterBulanMulai, setFilterBulanMulai] = useState('01');
  const [filterBulanSampai, setFilterBulanSampai] = useState('12');
  const [loading, setLoading] = useState(true);
  const [laporan, setLaporan] = useState<{
    items: { bulan: string; penerimaan: number; distribusi: number; pengeluaran: number; saldo: number }[];
    totalPenerimaan: number;
    totalDistribusi: number;
    totalPengeluaran: number;
    saldoAwal: number;
    saldoAkhir: number;
  } | null>(null);
  const [saldoKosong, setSaldoKosong] = useState<string[]>([]);
  const [mengisi, setMengisi] = useState(false);

  const loadLaporan = useCallback(async () => {
    setLoading(true);
    const dari = `${filterTahun}-${filterBulanMulai}`;
    const sampai = `${filterTahun}-${filterBulanSampai}`;

    const { data: existing } = await supabase
      .from('saldo_bulanan')
      .select('*')
      .gte('bulan', dari)
      .lte('bulan', sampai)
      .order('bulan', { ascending: true });

    const existingSet = new Set((existing ?? []).map(s => s.bulan));

    const semuaBulan: string[] = [];
    let [t, b] = dari.split('-').map(Number);
    const [tSampai, bSampai] = sampai.split('-').map(Number);
    while (t < tSampai || (t === tSampai && b <= bSampai)) {
      semuaBulan.push(`${t}-${String(b).padStart(2, '0')}`);
      b++;
      if (b > 12) { b = 1; t++; }
    }

    const kosong = semuaBulan.filter(b => !existingSet.has(b) && b < bulanIni());
    setSaldoKosong(kosong);

    try {
      const result = await getLaporanSaldo(dari, sampai);
      setLaporan(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [filterTahun, filterBulanMulai, filterBulanSampai]);

  useEffect(() => {
    loadLaporan();
  }, [loadLaporan]);

  const handleIsiSemua = async () => {
    setMengisi(true);
    for (const b of saldoKosong) {
      try { await simpanSaldoBulanan(b); } catch (e) { console.error(`Gagal isi saldo ${b}:`, e); }
    }
    setMengisi(false);
    loadLaporan();
  };

  const handleIsiBulan = async (bulan: string) => {
    try {
      await simpanSaldoBulanan(bulan);
      loadLaporan();
    } catch (e) {
      alert('Gagal: ' + (e instanceof Error ? e.message : ''));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-lg sm:text-xl font-bold text-gray-900">Laporan Saldo Bulanan</h1>

      {/* FILTER */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {tahunList.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dari Bulan</label>
            <select value={filterBulanMulai} onChange={(e) => setFilterBulanMulai(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sampai Bulan</label>
            <select value={filterBulanSampai} onChange={(e) => setFilterBulanSampai(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* SALDO KOSONG */}
      {saldoKosong.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-800">{saldoKosong.length} bulan belum memiliki saldo tersimpan</p>
              <p className="text-[10px] text-amber-600 mt-0.5">{saldoKosong.map(formatBulanLabel).join(', ')}</p>
            </div>
            <button onClick={handleIsiSemua} disabled={mengisi}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700 disabled:opacity-50">
              {mengisi ? 'Mengisi...' : 'Isi Semua'}
            </button>
          </div>
        </div>
      )}

      {/* RINGKASAN JURNAL */}
      {laporan && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Saldo Awal</p>
            <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{formatRupiah(laporan.saldoAwal)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Penerimaan</p>
            <p className="text-base sm:text-lg font-bold text-emerald-600 mt-1">{formatRupiah(laporan.totalPenerimaan)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Distribusi</p>
            <p className="text-base sm:text-lg font-bold text-red-600 mt-1">{formatRupiah(laporan.totalDistribusi)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Pengeluaran</p>
            <p className="text-base sm:text-lg font-bold text-orange-600 mt-1">{formatRupiah(laporan.totalPengeluaran)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Saldo Akhir</p>
            <p className={`text-base sm:text-lg font-bold mt-1 ${laporan.saldoAkhir < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatRupiah(laporan.saldoAkhir)}
            </p>
          </div>
        </div>
      )}

      {/* TABEL JURNAL */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-bold text-gray-900">Jurnal Keuangan Per Bulan</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Memuat...</div>
        ) : !laporan || laporan.items.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Belum ada data.</div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                    <th className="p-3">No</th>
                    <th className="p-3">Bulan</th>
                    <th className="p-3 text-right">Penerimaan (Debit)</th>
                    <th className="p-3 text-right">Distribusi (Kredit)</th>
                    <th className="p-3 text-right">Pengeluaran (Kredit)</th>
                    <th className="p-3 text-right">Saldo</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {laporan.items.map((item, idx) => (
                    <tr key={item.bulan} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-400">{idx + 1}</td>
                      <td className="p-3 font-semibold text-gray-900">{formatBulanLabel(item.bulan)}</td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">{formatRupiah(item.penerimaan)}</td>
                      <td className="p-3 text-right text-red-600 font-semibold">{formatRupiah(item.distribusi)}</td>
                      <td className="p-3 text-right text-orange-600 font-semibold">{formatRupiah(item.pengeluaran)}</td>
                      <td className={`p-3 text-right font-bold ${item.saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatRupiah(item.saldo)}
                      </td>
                      <td className="p-3 text-center">
                        {saldoKosong.includes(item.bulan) ? (
                          <button onClick={() => handleIsiBulan(item.bulan)}
                            className="text-blue-600 hover:text-blue-800 text-[10px] font-semibold">Simpan</button>
                        ) : item.bulan < bulanIni() ? (
                          <span className="text-green-600 text-[10px] font-semibold">Tersimpan</span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">Berjalan</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="sm:hidden divide-y divide-gray-100">
              {laporan.items.map((item) => (
                <div key={item.bulan} className="p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-900">{formatBulanLabel(item.bulan)}</span>
                    {saldoKosong.includes(item.bulan) ? (
                      <button onClick={() => handleIsiBulan(item.bulan)}
                        className="text-blue-600 text-[10px] font-semibold">Simpan</button>
                    ) : item.bulan < bulanIni() ? (
                      <span className="text-green-600 text-[10px] font-semibold">Tersimpan</span>
                    ) : (
                      <span className="text-gray-400 text-[10px]">Berjalan</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-gray-500">Penerimaan</span>
                      <p className="font-semibold text-emerald-600">{formatRupiah(item.penerimaan)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Distribusi</span>
                      <p className="font-semibold text-red-600">{formatRupiah(item.distribusi)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Pengeluaran</span>
                      <p className="font-semibold text-orange-600">{formatRupiah(item.pengeluaran)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Saldo</span>
                      <p className={`font-bold ${item.saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatRupiah(item.saldo)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
