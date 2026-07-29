'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { hapusPenerimaan, hapusPengeluaran, hapusDistribusi } from '@/lib/actions/admin';
import { formatRupiah, formatTanggalSingkat } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Pagination from '@/components/Pagination';

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

const PAGE_SIZE = 15;

export default function AdminTransaksiPage() {
  const [data, setData] = useState<TransaksiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterJenis, setFilterJenis] = useState<'ALL' | 'PEMASUKAN' | 'PENGELUARAN'>('ALL');
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear().toString());
  const [filterBulanMulai, setFilterBulanMulai] = useState('01');
  const [filterBulanSampai, setFilterBulanSampai] = useState('12');

  const [confirmHapusItem, setConfirmHapusItem] = useState<TransaksiItem | null>(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [penerimaan, pengeluaran, distribusi] = await Promise.all([
      supabase.from('penerimaan').select('*').order('created_at', { ascending: false }),
      supabase.from('pengeluaran').select('*').order('created_at', { ascending: false }),
      supabase.from('distribusi').select('*, periode_distribusi(nama), penerima_zakat(nama)').order('created_at', { ascending: false }),
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
      ...(distribusi.data ?? []).map((r) => {
        const periodeNama = (r.periode_distribusi as { nama: string } | null)?.nama;
        const mustahiqNama = (r.penerima_zakat as { nama: string } | null)?.nama;
        let ket = r.keterangan || '';
        if (mustahiqNama) {
          ket = ket ? `${mustahiqNama} - ${ket}` : mustahiqNama;
        }
        return {
          id: `d-${r.id}`,
          asliId: r.id,
          tabel: 'distribusi',
          tanggal: r.tanggal,
          jenis: 'PENGELUARAN' as const,
          label: periodeNama ? `Distribusi (${periodeNama})` : 'Distribusi',
          jumlah: r.jumlah,
          keterangan: ket || null,
        };
      }),
    ].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.id.localeCompare(b.id));

    setData(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [filterJenis, filterTahun, filterBulanMulai, filterBulanSampai]);

  const filterDari = `${filterTahun}-${filterBulanMulai}`;
  const filterSampai = `${filterTahun}-${filterBulanSampai}`;

  const filtered = data.filter((item) => {
    if (filterJenis !== 'ALL' && item.jenis !== filterJenis) return false;
    const bulanItem = item.tanggal.slice(0, 7);
    return bulanItem >= filterDari && bulanItem <= filterSampai;
  });

  const totalPemasukan = filtered.filter((d) => d.jenis === 'PEMASUKAN').reduce((s, r) => s + r.jumlah, 0);
  const totalPengeluaran = filtered.filter((d) => d.jenis === 'PENGELUARAN').reduce((s, r) => s + r.jumlah, 0);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEksekusiHapus = async () => {
    if (!confirmHapusItem) return;
    const item = confirmHapusItem;
    setConfirmHapusItem(null);
    setError('');
    try {
      if (item.tabel === 'penerimaan') {
        await hapusPenerimaan(item.asliId);
      } else if (item.tabel === 'distribusi') {
        await hapusDistribusi(item.asliId);
      } else {
        await hapusPengeluaran(item.asliId);
      }
      setData(data.filter((d) => d.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  const tahunList = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">💰 Transaksi Keuangan</h1>
        <p className="text-xs text-gray-500 mt-0.5">Kelola dan tinjau seluruh riwayat mutasi kas</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* FILTER */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {tahunList.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dari Bulan</label>
            <select value={filterBulanMulai} onChange={(e) => setFilterBulanMulai(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sampai Bulan</label>
            <select value={filterBulanSampai} onChange={(e) => setFilterBulanSampai(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Jenis Mutasi</label>
            <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value as typeof filterJenis)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold transition">
              <option value="ALL">Semua Mutasi</option>
              <option value="PEMASUKAN">💰 Pemasukan</option>
              <option value="PENGELUARAN">🏷️ Pengeluaran</option>
            </select>
          </div>
        </div>
      </div>

      {/* RINGKASAN */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Total Pemasukan</p>
          <p className="text-lg font-extrabold text-emerald-800 mt-1">{formatRupiah(totalPemasukan)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Total Pengeluaran</p>
          <p className="text-lg font-extrabold text-red-800 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Saldo Bersih Periode Ini</p>
          <p className={`text-lg font-extrabold mt-1 ${totalPemasukan - totalPengeluaran < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatRupiah(totalPemasukan - totalPengeluaran)}
          </p>
        </div>
      </div>

      {/* TABEL */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <span className="text-sm font-bold text-gray-900">Riwayat Mutasi Transaksi</span>
          <span className="text-xs text-gray-500 font-medium">{filtered.length} transaksi</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Memuat transaksi...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-gray-400">Belum ada transaksi pada periode ini.</div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-100">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Jenis</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Jumlah</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                {/* Screen View Body */}
                <tbody className="divide-y divide-gray-100 print:hidden">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="p-3 text-gray-700 font-medium whitespace-nowrap">{formatTanggalSingkat(item.tanggal)}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.jenis === 'PEMASUKAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.jenis === 'PEMASUKAN' ? '↑ Masuk' : '↓ Keluar'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">
                        <span className="font-semibold">{item.label}</span>
                        {item.keterangan && <span className="text-gray-400 ml-1">— {item.keterangan}</span>}
                      </td>
                      <td className={`p-3 text-right font-extrabold ${item.jenis === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.jenis === 'PEMASUKAN' ? '+' : '−'}{formatRupiah(item.jumlah)}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => setConfirmHapusItem(item)}
                          className="text-red-500 hover:text-red-700 text-[10px] font-bold transition">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Print View Body (ALL Items Filtered - Urut Kronologis Tgl 1 -> 31) */}
                <tbody className="divide-y divide-gray-200 hidden print:table-row-group">
                  {[...filtered].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map((item) => (
                    <tr key={`print-${item.id}`}>
                      <td className="p-2 text-gray-700 font-medium whitespace-nowrap">{formatTanggalSingkat(item.tanggal)}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.jenis === 'PEMASUKAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.jenis === 'PEMASUKAN' ? '↑ Masuk' : '↓ Keluar'}
                        </span>
                      </td>
                      <td className="p-2 text-gray-700">
                        <span className="font-semibold">{item.label}</span>
                        {item.keterangan && <span className="text-gray-400 ml-1">— {item.keterangan}</span>}
                      </td>
                      <td className={`p-2 text-right font-bold ${item.jenis === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.jenis === 'PEMASUKAN' ? '+' : '−'}{formatRupiah(item.jumlah)}
                      </td>
                      <td className="p-2 text-center no-print">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="sm:hidden divide-y divide-gray-100">
              {paginatedItems.map((item) => (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.jenis === 'PEMASUKAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>{item.jenis === 'PEMASUKAN' ? 'Masuk' : 'Keluar'}</span>
                        <span className="text-[11px] text-gray-500">{formatTanggalSingkat(item.tanggal)}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{item.label}</p>
                      {item.keterangan && <p className="text-[11px] text-gray-400">{item.keterangan}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${item.jenis === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.jenis === 'PEMASUKAN' ? '+' : '−'}{formatRupiah(item.jumlah)}
                      </p>
                      <button onClick={() => setConfirmHapusItem(item)}
                        className="text-red-500 text-[10px] font-bold mt-1">Hapus</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* PAGINATION */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* CONFIRMATION MODAL HAPUS */}
      <ConfirmModal
        open={confirmHapusItem !== null}
        title="Hapus Transaksi"
        message={`Apakah Anda yakin ingin menghapus data ${confirmHapusItem?.label || 'transaksi'} senilai ${confirmHapusItem ? formatRupiah(confirmHapusItem.jumlah) : ''}?`}
        confirmLabel="Hapus Transaksi"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleEksekusiHapus}
        onCancel={() => setConfirmHapusItem(null)}
      />
    </div>
  );
}
