'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { formatRupiah } from '@/lib/utils';

interface MonthlyTrend {
  label: string;
  penerimaan: number;
  pengeluaran: number;
}

export default function FinancialTrendChart() {
  const [trendData, setTrendData] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrend = async () => {
      setLoading(true);
      const months: { year: number; month: number; label: string; bulanStr: string }[] = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        months.push({
          year: y,
          month: m,
          label: `${monthNames[m - 1]} ${y}`,
          bulanStr: `${y}-${String(m).padStart(2, '0')}`,
        });
      }

      const results = await Promise.all(
        months.map(async (m) => {
          const tglAwal = `${m.bulanStr}-01`;
          const nextDate = new Date(m.year, m.month, 1);
          const tglAkhir = nextDate.toISOString().split('T')[0];

          const [{ data: pData }, { data: oData }, { data: dData }] = await Promise.all([
            supabase.from('penerimaan').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
            supabase.from('pengeluaran').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
            supabase.from('distribusi').select('jumlah').gte('tanggal', tglAwal).lt('tanggal', tglAkhir),
          ]);

          const totalP = (pData ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
          const totalO = (oData ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
          const totalD = (dData ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);

          return {
            label: m.label,
            penerimaan: totalP,
            pengeluaran: totalO + totalD,
          };
        })
      );

      setTrendData(results);
      setLoading(false);
    };

    loadTrend();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </div>
    );
  }

  const maxVal = Math.max(1, ...trendData.flatMap((d) => [d.penerimaan, d.pengeluaran]));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h2 className="text-sm font-bold text-gray-900">📈 Trend Arus Kas (6 Bulan Terakhir)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Perbandingan Penerimaan (Hijau) vs Total Pengeluaran &amp; Distribusi (Merah)</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-3 h-3 bg-emerald-500 rounded-md inline-block" /> Pemasukan
          </span>
          <span className="flex items-center gap-1.5 text-red-600">
            <span className="w-3 h-3 bg-red-500 rounded-md inline-block" /> Pengeluaran
          </span>
        </div>
      </div>

      {/* CHART BARS */}
      <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-48 pt-4 pb-2 border-b border-gray-100">
        {trendData.map((d, i) => {
          const hP = Math.round((d.penerimaan / maxVal) * 100);
          const hO = Math.round((d.pengeluaran / maxVal) * 100);

          return (
            <div key={i} className="flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip on hover */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-20 shadow-lg">
                <p className="text-emerald-300 font-bold">Masuk: {formatRupiah(d.penerimaan)}</p>
                <p className="text-red-300 font-bold">Keluar: {formatRupiah(d.pengeluaran)}</p>
              </div>

              {/* Bars */}
              <div className="flex items-end gap-1 w-full justify-center h-full max-h-36">
                <div
                  className="w-3.5 sm:w-5 bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all duration-500"
                  style={{ height: `${Math.max(hP, 4)}%` }}
                />
                <div
                  className="w-3.5 sm:w-5 bg-red-500 hover:bg-red-600 rounded-t-lg transition-all duration-500"
                  style={{ height: `${Math.max(hO, 4)}%` }}
                />
              </div>

              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold mt-2 truncate w-full text-center">{d.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
