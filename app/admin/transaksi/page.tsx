'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { hapusPenerimaan } from '@/lib/actions/admin';
import { hapusPengeluaran } from '@/lib/actions/admin';
import { formatRupiah, formatTanggalSingkat } from '@/lib/utils';

interface TransaksiItem {
  id: string;
  asliId: number;
  tabel: string;
  tanggal: string;
  jenis: 'PEMASUKAN' | 'PENGELUARAN';
  label: string;
  jumlah: number;
  keterangan: string | null;
}

const LABEL_KATEGORI: Record<string, string> = {
  DISTRIBUSI: 'Distribusi',
  ATK: 'ATK',
  PERLENGKAPAN_DISTRIBUSI: 'Perlengkapan Distribusi',
  OPERASIONAL: 'Operasional',
  TRANSPORTASI: 'Transportasi',
  LAINNYA: 'Lainnya',
};

const bulanOptions = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
  { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

export default function AdminTransaksiPage() {
  const [data, setData] = useState<TransaksiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterJenis, setFilterJenis] = useState<'ALL' | 'PEMASUKAN' | 'PENGELUARAN'>('ALL');
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear().toString());
  const [filterBulanMulai, setFilterBulanMulai] = useState('01');
  const [filterBulanSampai, setFilterBulanSampai] = useState('12');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [penerimaan, pengeluaran] = await Promise.all([
      supabase.from('penerimaan').select('*').order('created_at', { ascending: false }),
      supabase.from('pengeluaran').select('*').order('created_at', { ascending: false }),
    ]);

    const items: TransaksiItem[] = [
      ...(penerimaan.data ?? []).map((r) => ({
        id: `p-${r.id}`,
        asliId: r.id,
        tabel: 'penerimaan',
        tanggal: r.tanggal,
        jenis: 'PEMASUKAN' as const,
        label: r.sumber === 'ZAKAT_MAL' ? 'Zakat Mal' : 'Sedekah / Infak',
        jumlah: r.jumlah,
        keterangan: r.muzakki ? `${r.muzakki}${r.keterangan ? ` - ${r.keterangan}` : ''}` : r.keterangan,
      })),
      ...(pengeluaran.data ?? []).map((r) => ({
        id: `o-${r.id}`,
        asliId: r.id,
        tabel: 'pengeluaran',
        tanggal: r.tanggal,
        jenis: 'PENGELUARAN' as const,
        label: LABEL_KATEGORI[r.kategori] || r.kategori,
        jumlah: r.jumlah,
        keterangan: r.deskripsi,
      })),
    ].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.id.localeCompare(b.id));

    setData(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filterDari = `${filterTahun}-${filterBulanMulai}`;
  const filterSampai = `${filterTahun}-${filterBulanSampai}`;

  const filtered = data.filter((item) => {
    if (filterJenis !== 'ALL' && item.jenis !== filterJenis) return false;
    const bulanItem = item.tanggal.slice(0, 7);
    return bulanItem >= filterDari && bulanItem <= filterSampai;
  });

  const totalPemasukan = filtered.filter((d) => d.jenis === 'PEMASUKAN').reduce((s, r) => s + r.jumlah, 0);
  const totalPengeluaran = filtered.filter((d) => d.jenis === 'PENGELUARAN').reduce((s, r) => s + r.jumlah, 0);

  const handleHapus = async (item: TransaksiItem) => {
    if (!confirm(`Hapus ${item.jenis === 'PEMASUKAN' ? 'penerimaan' : 'pengeluaran'} ini?`)) return;
    setError('');
    try {
      if (item.tabel === 'penerimaan') {
        await hapusPenerimaan(item.asliId);
      } else {
        await hapusPengeluaran(item.asliId);
      }
      setData(data.filter((d) => d.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal');
    }
  };

  const tahunList = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-lg sm:text-xl font-bold text-gray-900">Transaksi Keuangan</h1>

      {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">{error}</div>}

      {/* FILTER */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {tahunList.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dari Bulan</label>
            <select value={filterBulanMulai} onChange={(e) => setFilterBulanMulai(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sampai Bulan</label>
            <select value={filterBulanSampai} onChange={(e) => setFilterBulanSampai(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Jenis</label>
            <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value as typeof filterJenis)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              <option value="ALL">Semua</option>
              <option value="PEMASUKAN">Pemasukan</option>
              <option value="PENGELUARAN">Pengeluaran</option>
            </select>
          </div>
        </div>
      </div>

      {/* RINGKASAN */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-medium text-gray-500 uppercase">Total Pemasukan</p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 mt-1">{formatRupiah(totalPemasukan)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-medium text-gray-500 uppercase">Total Pengeluaran</p>
          <p className="text-base sm:text-lg font-bold text-red-600 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-medium text-gray-500 uppercase">Saldo Bersih</p>
          <p className={`text-base sm:text-lg font-bold mt-1 ${totalPemasukan - totalPengeluaran < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatRupiah(totalPemasukan - totalPengeluaran)}
          </p>
        </div>
      </div>

      {/* TABEL */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-bold text-gray-900">Riwayat Transaksi</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Belum ada data.</div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Jenis</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Jumlah</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-900 whitespace-nowrap">{formatTanggalSingkat(item.tanggal)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.jenis === 'PEMASUKAN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {item.jenis === 'PEMASUKAN' ? 'Masuk' : 'Keluar'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">
                        <span className="font-semibold">{item.label}</span>
                        {item.keterangan && <span className="text-gray-400"> — {item.keterangan}</span>}
                      </td>
                      <td className={`p-3 text-right font-semibold ${item.jenis === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.jenis === 'PEMASUKAN' ? '+' : '-'}{formatRupiah(item.jumlah)}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleHapus(item)}
                          className="text-red-600 hover:text-red-800 text-[10px] font-semibold">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filtered.map((item) => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.jenis === 'PEMASUKAN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>{item.jenis === 'PEMASUKAN' ? 'Masuk' : 'Keluar'}</span>
                        <span className="text-[11px] text-gray-500">{formatTanggalSingkat(item.tanggal)}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{item.label}</p>
                      {item.keterangan && <p className="text-[11px] text-gray-400">{item.keterangan}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${item.jenis === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.jenis === 'PEMASUKAN' ? '+' : '-'}{formatRupiah(item.jumlah)}
                      </p>
                      <button onClick={() => handleHapus(item)}
                        className="text-red-600 text-[10px] font-semibold mt-1">Hapus</button>
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
