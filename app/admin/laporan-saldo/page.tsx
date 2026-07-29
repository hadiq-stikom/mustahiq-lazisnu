'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { getLaporanSaldo, simpanSaldoBulanan } from '@/lib/actions/admin';
import { formatRupiah } from '@/lib/utils';
import PrintHeader from '@/components/PrintHeader';
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
      {/* KOP SURAT UNTUK PRINT */}
      <PrintHeader
        title="Laporan Keuangan & Saldo Bulanan"
        subtitle={`Periode: ${formatBulanLabel(`${filterTahun}-${filterBulanMulai}`)} — ${formatBulanLabel(`${filterTahun}-${filterBulanSampai}`)}`}
      />

      {/* HEADER UTAMA */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">💳 Laporan Saldo Bulanan</h1>
          <p className="text-xs text-gray-500 mt-0.5">Rekapitulasi penerimaan, pengeluaran, dan saldo kas</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.562 0-1.056-.419-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.1 48.1 0 0110.56 0m-10.56 0V3.375c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.656" />
          </svg>
          Cetak PDF / Print
        </button>
      </div>

      {/* FILTER */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm no-print">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {tahunList.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dari Bulan</label>
            <select value={filterBulanMulai} onChange={(e) => setFilterBulanMulai(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sampai Bulan</label>
            <select value={filterBulanSampai} onChange={(e) => setFilterBulanSampai(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* SALDO KOSONG */}
      {saldoKosong.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-800">{saldoKosong.length} bulan belum memiliki saldo tersimpan</p>
              <p className="text-[10px] text-amber-600 mt-0.5">{saldoKosong.map(formatBulanLabel).join(', ')}</p>
            </div>
            <button onClick={handleIsiSemua} disabled={mengisi}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-[10px] font-bold hover:bg-amber-700 disabled:opacity-50 transition">
              {mengisi ? 'Mengisi...' : 'Isi Semua'}
            </button>
          </div>
        </div>
      )}

      {/* RINGKASAN JURNAL */}
      {laporan && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Saldo Awal</p>
            <p className="text-base sm:text-lg font-extrabold text-gray-900 mt-1">{formatRupiah(laporan.saldoAwal)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Penerimaan</p>
            <p className="text-base sm:text-lg font-extrabold text-emerald-600 mt-1">{formatRupiah(laporan.totalPenerimaan)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Distribusi</p>
            <p className="text-base sm:text-lg font-extrabold text-red-600 mt-1">{formatRupiah(laporan.totalDistribusi)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Pengeluaran</p>
            <p className="text-base sm:text-lg font-extrabold text-orange-600 mt-1">{formatRupiah(laporan.totalPengeluaran)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <p className="text-[10px] font-medium text-gray-500 uppercase">Saldo Akhir</p>
            <p className={`text-base sm:text-lg font-extrabold mt-1 ${laporan.saldoAkhir < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatRupiah(laporan.saldoAkhir)}
            </p>
          </div>
        </div>
      )}

      {/* TABEL JURNAL */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 font-bold text-sm text-gray-900 bg-gray-50">
          Jurnal Keuangan Per Bulan
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Memuat laporan...</div>
        ) : !laporan || laporan.items.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Belum ada data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-100">
                  <th className="p-3">No</th>
                  <th className="p-3">Bulan</th>
                  <th className="p-3 text-right">Penerimaan (Debit)</th>
                  <th className="p-3 text-right">Distribusi (Kredit)</th>
                  <th className="p-3 text-right">Pengeluaran (Kredit)</th>
                  <th className="p-3 text-right">Saldo</th>
                  <th className="p-3 text-center no-print">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {laporan.items.map((item, idx) => (
                  <tr key={item.bulan} className="hover:bg-gray-50 transition">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-semibold text-gray-900">{formatBulanLabel(item.bulan)}</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">{formatRupiah(item.penerimaan)}</td>
                    <td className="p-3 text-right text-red-600 font-bold">{formatRupiah(item.distribusi)}</td>
                    <td className="p-3 text-right text-orange-600 font-bold">{formatRupiah(item.pengeluaran)}</td>
                    <td className={`p-3 text-right font-extrabold ${item.saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatRupiah(item.saldo)}
                    </td>
                    <td className="p-3 text-center no-print">
                      {saldoKosong.includes(item.bulan) ? (
                        <button onClick={() => handleIsiBulan(item.bulan)}
                          className="text-blue-600 hover:text-blue-800 text-[10px] font-semibold">Simpan</button>
                      ) : item.bulan < bulanIni() ? (
                        <span className="text-emerald-600 text-[10px] font-semibold">✓ Tersimpan</span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">Berjalan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tanda Tangan Cetak */}
      <div className="hidden print:flex justify-between items-end pt-12 text-xs">
        <div className="text-center w-48">
          <p className="mb-16">Mengetahui,<br /><strong>Ketua LAZISNU Badean</strong></p>
          <p className="border-b border-gray-400 pb-1 font-bold">( ........................................ )</p>
        </div>
        <div className="text-center w-48">
          <p className="mb-16">Badean, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong>Bendahara</strong></p>
          <p className="border-b border-gray-400 pb-1 font-bold">( ........................................ )</p>
        </div>
      </div>
    </div>
  );
}
