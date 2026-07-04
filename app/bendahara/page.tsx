'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { tambahTransaksi, simpanSaldoBulanBendahara } from '@/lib/actions/bendahara';
import { formatRupiah, formatTanggalSingkat, formatNamaBulan } from '@/lib/utils';

interface TransaksiItem {
  id: string;
  tanggal: string;
  jenis: 'PEMASUKAN' | 'PENGELUARAN';
  label: string;
  jumlah: number;
  keterangan: string | null;
}

const bulanOptions = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
  { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

export default function BendaharaPage() {
  const router = useRouter();
  const [data, setData] = useState<TransaksiItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [jenis, setJenis] = useState<'PEMASUKAN' | 'PENGELUARAN'>('PEMASUKAN');
  const [formTanggal, setFormTanggal] = useState('');
  const [formSumber, setFormSumber] = useState('ZAKAT_MAL');
  const [formKategori, setFormKategori] = useState('ATK');
  const [formMuzakki, setFormMuzakki] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formKet, setFormKet] = useState('');
  const [formJumlah, setFormJumlah] = useState('');
  const [error, setError] = useState('');

  // Saldo
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [saldoSudahDisimpan, setSaldoSudahDisimpan] = useState(false);
  const [saldoTersimpan, setSaldoTersimpan] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Filter bulan
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear().toString());
  const [filterBulan, setFilterBulan] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  const loadData = async () => {
    setLoading(true);
    const [penerimaan, pengeluaran] = await Promise.all([
      supabase.from('penerimaan').select('*').order('created_at', { ascending: false }),
      supabase.from('pengeluaran').select('*').order('created_at', { ascending: false }),
    ]);

    const items: TransaksiItem[] = [
      ...(penerimaan.data ?? []).map((r) => ({
        id: `p-${r.id}`,
        tanggal: r.tanggal,
        jenis: 'PEMASUKAN' as const,
        label: r.sumber === 'ZAKAT_MAL' ? 'Zakat Mal' : 'Sedekah / Infak',
        jumlah: r.jumlah,
        keterangan: r.muzakki ? `${r.muzakki}${r.keterangan ? ` - ${r.keterangan}` : ''}` : r.keterangan,
      })),
      ...(pengeluaran.data ?? []).map((r) => ({
        id: `o-${r.id}`,
        tanggal: r.tanggal,
        jenis: 'PENGELUARAN' as const,
        label: r.kategori.replace(/_/g, ' '),
        jumlah: r.jumlah,
        keterangan: r.deskripsi,
      })),
    ].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.id.localeCompare(b.id));

    setData(items);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loadSaldo = async () => {
      const bulan = `${filterTahun}-${filterBulan}`;

      const prevDate = new Date(parseInt(filterTahun), parseInt(filterBulan) - 1, 1);
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevBulan = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const [prevResult, currResult] = await Promise.all([
        supabase.from('saldo_bulanan').select('saldo').eq('bulan', prevBulan).maybeSingle(),
        supabase.from('saldo_bulanan').select('saldo').eq('bulan', bulan).maybeSingle(),
      ]);

      setSaldoAwal(prevResult.data?.saldo ?? 0);
      setSaldoSudahDisimpan(!!currResult.data);
      setSaldoTersimpan(currResult.data?.saldo ?? 0);
    };
    loadSaldo();
  }, [filterTahun, filterBulan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formJumlah || parseFloat(formJumlah) <= 0) return alert('Jumlah harus diisi.');

    const fd = new FormData();
    fd.set('jenis', jenis);
    fd.set('tanggal', formTanggal);
    fd.set('jumlah', formJumlah);

    if (jenis === 'PEMASUKAN') {
      fd.set('sumber', formSumber);
      fd.set('muzakki', formMuzakki);
      fd.set('keterangan', formKet);
    } else {
      fd.set('kategori', formKategori);
      fd.set('deskripsi', formDeskripsi);
    }

    try {
      await tambahTransaksi(fd);
      setFormTanggal(''); setFormJumlah(''); setFormMuzakki(''); setFormKet(''); setFormDeskripsi('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    router.push('/login');
  };

  const bulanFilter = `${filterTahun}-${filterBulan}`;
  const dataFiltered = data.filter((d) => d.tanggal.startsWith(bulanFilter));
  const totalPemasukan = dataFiltered.filter((d) => d.jenis === 'PEMASUKAN').reduce((s, r) => s + r.jumlah, 0);
  const totalPengeluaran = dataFiltered.filter((d) => d.jenis === 'PENGELUARAN').reduce((s, r) => s + r.jumlah, 0);

  const tahunList = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

  const now = new Date();
  const isBulanBerjalan = filterTahun === now.getFullYear().toString() && filterBulan === String(now.getMonth() + 1).padStart(2, '0');
  const saldoSaatIni = saldoAwal + totalPemasukan - totalPengeluaran;
  const saldoBerbeda = saldoTersimpan !== saldoSaatIni;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Bendahara</h1>
          <p className="text-xs text-gray-500">Pencatatan Transaksi LAZISNU Badean</p>
        </div>
        <button onClick={handleLogout}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">Logout</button>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-gray-900">📝 Catat Transaksi Baru</h2>

        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          <button type="button" onClick={() => setJenis('PEMASUKAN')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${jenis === 'PEMASUKAN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>
            💰 Pemasukan
          </button>
          <button type="button" onClick={() => setJenis('PENGELUARAN')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${jenis === 'PENGELUARAN' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'}`}>
            🏷️ Pengeluaran
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Tanggal</label>
            <input type="date" value={formTanggal} onChange={(e) => setFormTanggal(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
          </div>
          {jenis === 'PEMASUKAN' ? (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Sumber</label>
                <select value={formSumber} onChange={(e) => setFormSumber(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
                  <option value="ZAKAT_MAL">Zakat Mal</option>
                  <option value="SEDEKAH_INFAK">Sedekah / Infak</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Muzakki (opsional)</label>
                <input type="text" placeholder="Nama" value={formMuzakki} onChange={(e) => setFormMuzakki(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Kategori</label>
                <select value={formKategori} onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
                  <option value="DISTRIBUSI">Distribusi</option>
                  <option value="ATK">ATK</option>
                  <option value="PERLENGKAPAN_DISTRIBUSI">Perlengkapan Distribusi</option>
                  <option value="OPERASIONAL">Operasional</option>
                  <option value="TRANSPORTASI">Transportasi</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">Deskripsi</label>
                <input type="text" placeholder="Mis: Beli buku & pulpen" value={formDeskripsi} onChange={(e) => setFormDeskripsi(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
              </div>
            </>
          )}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Jumlah (Rp)</label>
            <input type="number" required min="1" placeholder="0" value={formJumlah} onChange={(e) => setFormJumlah(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
          </div>
        </div>

        {jenis === 'PEMASUKAN' && (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Keterangan</label>
            <input type="text" placeholder="Opsional" value={formKet} onChange={(e) => setFormKet(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
          </div>
        )}

        <button type="submit"
          className={`w-full sm:w-auto py-1.5 px-6 text-white rounded-lg text-xs font-bold ${jenis === 'PEMASUKAN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
          Simpan
        </button>
      </form>

      {/* FILTER BULAN */}
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
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bulan</label>
            <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}
              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* RINGKASAN SALDO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Saldo Awal</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatRupiah(saldoAwal)}</p>
          <p className="text-[10px] text-gray-400">{formatNamaBulan(filterBulan)} {filterTahun}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pemasukan</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatRupiah(totalPemasukan)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pengeluaran</p>
          <p className="text-lg font-bold text-red-600 mt-1">{formatRupiah(totalPengeluaran)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Saldo Saat Ini</p>
          <p className={`text-lg font-bold mt-1 ${saldoSaatIni < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatRupiah(saldoSaatIni)}
          </p>
          {(() => {
            if (!saldoSudahDisimpan) {
              return (
                <button onClick={async () => {
                  setIsSaving(true);
                  try {
                    await simpanSaldoBulanBendahara(`${filterTahun}-${filterBulan}`);
                    setSaldoSudahDisimpan(true);
                    setSaldoTersimpan(saldoSaatIni);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Gagal menyimpan saldo');
                  } finally {
                    setIsSaving(false);
                  }
                }} disabled={isSaving}
                  className="mt-2 w-full py-1.5 px-3 bg-blue-600 text-white rounded-lg text-[10px] font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {isSaving ? 'Menyimpan...' : `Simpan Saldo ${formatNamaBulan(filterBulan)}`}
                </button>
              );
            }
            if (isBulanBerjalan && saldoBerbeda) {
              return (
                <button onClick={async () => {
                  setIsSaving(true);
                  try {
                    await simpanSaldoBulanBendahara(`${filterTahun}-${filterBulan}`);
                    setSaldoTersimpan(saldoSaatIni);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Gagal menyimpan saldo');
                  } finally {
                    setIsSaving(false);
                  }
                }} disabled={isSaving}
                  className="mt-2 w-full py-1.5 px-3 bg-amber-500 text-white rounded-lg text-[10px] font-semibold hover:bg-amber-600 disabled:opacity-50">
                  {isSaving ? 'Menyimpan...' : `Update Saldo ${formatNamaBulan(filterBulan)}`}
                </button>
              );
            }
            return <p className="mt-2 text-[10px] text-emerald-600 font-semibold">✓ Tersimpan</p>;
          })()}
        </div>
      </div>

      {/* RIWAYAT TRANSAKSI */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-900">Riwayat Transaksi</span>
          <span className="text-[10px] text-gray-400">{dataFiltered.length} transaksi</span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Memuat...</div>
        ) : dataFiltered.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Belum ada data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Jenis</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataFiltered.map((item) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
