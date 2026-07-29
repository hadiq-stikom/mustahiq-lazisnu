'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { tambahTransaksi, simpanSaldoBulanBendahara, hapusTransaksiBendahara } from '@/lib/actions/bendahara';
import { formatRupiah, formatTanggalSingkat, formatNamaBulan } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Pagination from '@/components/Pagination';
import PrintHeader from '@/components/PrintHeader';

interface TransaksiItem {
  id: string;
  asliId: number;
  tabel: 'penerimaan' | 'pengeluaran' | 'distribusi';
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

const PAGE_SIZE = 15;

function Spinner({ size = 4 }: { size?: number }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin-slow`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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
  const [submitting, setSubmitting] = useState(false);

  // Saldo
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [saldoSudahDisimpan, setSaldoSudahDisimpan] = useState(false);
  const [saldoTersimpan, setSaldoTersimpan] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Filter & Pagination
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear().toString());
  const [filterBulan, setFilterBulan] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [page, setPage] = useState(1);
  const [confirmHapusItem, setConfirmHapusItem] = useState<TransaksiItem | null>(null);

  const loadData = async () => {
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
        tabel: 'penerimaan' as const,
        tanggal: r.tanggal,
        jenis: 'PEMASUKAN' as const,
        label: r.sumber === 'ZAKAT_MAL' ? 'Zakat Mal' : 'Sedekah / Infak',
        jumlah: r.jumlah,
        keterangan: r.muzakki ? `${r.muzakki}${r.keterangan ? ` - ${r.keterangan}` : ''}` : r.keterangan,
      })),
      ...(pengeluaran.data ?? []).map((r) => ({
        id: `o-${r.id}`,
        asliId: r.id,
        tabel: 'pengeluaran' as const,
        tanggal: r.tanggal,
        jenis: 'PENGELUARAN' as const,
        label: r.kategori.replace(/_/g, ' '),
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
          tabel: 'distribusi' as const,
          tanggal: r.tanggal,
          jenis: 'PENGELUARAN' as const,
          label: periodeNama ? `Distribusi (${periodeNama})` : 'Distribusi Zakat',
          jumlah: r.jumlah,
          keterangan: ket || null,
        };
      }),
    ].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.id.localeCompare(b.id));

    setData(items);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
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
    setSubmitting(true);

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
    } finally {
      setSubmitting(false);
    }
  };

  const handleEksekusiHapus = async () => {
    if (!confirmHapusItem) return;
    const item = confirmHapusItem;
    setConfirmHapusItem(null);
    try {
      if (item.tabel === 'penerimaan' || item.tabel === 'pengeluaran') {
        await hapusTransaksiBendahara(item.asliId, item.tabel);
      }
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
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

  const totalPages = Math.ceil(dataFiltered.length / PAGE_SIZE);
  const paginatedData = dataFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tahunList = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

  const now = new Date();
  const isBulanBerjalan = filterTahun === now.getFullYear().toString() && filterBulan === String(now.getMonth() + 1).padStart(2, '0');
  const saldoSaatIni = saldoAwal + totalPemasukan - totalPengeluaran;
  const saldoBerbeda = saldoTersimpan !== saldoSaatIni;

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* KOP SURAT PRINT */}
      <PrintHeader
        title="Laporan Keuangan Bendahara"
        subtitle={`Periode: ${formatNamaBulan(filterBulan)} ${filterTahun}`}
      />

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">💼 Bendahara</h1>
          <p className="text-xs text-gray-500 mt-0.5">Pencatatan Keuangan LAZISNU Badean</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.562 0-1.056-.419-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.1 48.1 0 0110.56 0m-10.56 0V3.375c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.656" />
            </svg>
            Cetak PDF
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-center gap-2 no-print">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* ── FORM TRANSAKSI ── */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 no-print">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">📝 Catat Transaksi Baru</h2>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button type="button" onClick={() => setJenis('PEMASUKAN')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${jenis === 'PEMASUKAN' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              💰 Pemasukan
            </button>
            <button type="button" onClick={() => setJenis('PENGELUARAN')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${jenis === 'PENGELUARAN' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              🏷️ Pengeluaran
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal</label>
            <input type="date" value={formTanggal} onChange={(e) => setFormTanggal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
          {jenis === 'PEMASUKAN' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sumber</label>
                <select value={formSumber} onChange={(e) => setFormSumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                  <option value="ZAKAT_MAL">Zakat Mal</option>
                  <option value="SEDEKAH_INFAK">Sedekah / Infak</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Muzakki (opsional)</label>
                <input type="text" placeholder="Nama muzakki" value={formMuzakki} onChange={(e) => setFormMuzakki(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Kategori</label>
                <select value={formKategori} onChange={(e) => setFormKategori(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                  <option value="ATK">ATK</option>
                  <option value="PERLENGKAPAN_DISTRIBUSI">Perlengkapan Distribusi</option>
                  <option value="OPERASIONAL">Operasional</option>
                  <option value="TRANSPORTASI">Transportasi</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Deskripsi</label>
                <input type="text" placeholder="Mis: Beli buku &amp; pulpen" value={formDeskripsi} onChange={(e) => setFormDeskripsi(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jumlah (Rp)</label>
            <input type="number" required min="1" placeholder="0" value={formJumlah} onChange={(e) => setFormJumlah(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
        </div>

        {jenis === 'PEMASUKAN' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Keterangan (opsional)</label>
            <input type="text" placeholder="Catatan tambahan" value={formKet} onChange={(e) => setFormKet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={submitting}
            className={`flex items-center gap-2 py-2 px-6 text-white rounded-xl text-sm font-bold transition disabled:opacity-60 ${jenis === 'PEMASUKAN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {submitting ? <><Spinner /> Menyimpan...</> : 'Simpan Transaksi'}
          </button>
        </div>
      </form>

      {/* ── FILTER BULAN ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm no-print">
        <p className="text-xs font-bold text-gray-700 mb-3">🗓️ Filter Periode</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tahun</label>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {tahunList.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bulan</label>
            <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              {bulanOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div className="flex-1 hidden sm:block" />
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Periode aktif</p>
            <p className="text-sm font-bold text-gray-800">{formatNamaBulan(filterBulan)} {filterTahun}</p>
          </div>
        </div>
      </div>

      {/* ── RINGKASAN SALDO ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Saldo Awal</p>
          <p className="text-base font-extrabold text-gray-900 mt-1">{formatRupiah(saldoAwal)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{formatNamaBulan(filterBulan)} {filterTahun}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Pemasukan</p>
          <p className="text-base font-extrabold text-emerald-700 mt-1">{formatRupiah(totalPemasukan)}</p>
          <p className="text-[10px] text-emerald-400 mt-0.5">Bulan ini</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Pengeluaran</p>
          <p className="text-base font-extrabold text-red-700 mt-1">{formatRupiah(totalPengeluaran)}</p>
          <p className="text-[10px] text-red-400 mt-0.5">Termasuk distribusi</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-sm border ${saldoSaatIni < 0 ? 'bg-red-50 border-red-300' : 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${saldoSaatIni < 0 ? 'text-red-600' : 'text-emerald-100'}`}>Saldo Saat Ini</p>
          <p className={`text-base font-extrabold mt-1 ${saldoSaatIni < 0 ? 'text-red-700' : 'text-white'}`}>
            {formatRupiah(saldoSaatIni)}
          </p>
          <div className="no-print">
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
                    className="mt-2 w-full py-1.5 px-3 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-semibold disabled:opacity-50 transition flex items-center justify-center gap-1.5">
                    {isSaving ? <><Spinner size={3} /> Menyimpan...</> : `💾 Simpan ${formatNamaBulan(filterBulan)}`}
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
                    className="mt-2 w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-semibold disabled:opacity-50 transition flex items-center justify-center gap-1.5">
                    {isSaving ? <><Spinner size={3} /> Menyimpan...</> : `🔄 Update ${formatNamaBulan(filterBulan)}`}
                  </button>
                );
              }
              return (
                <p className={`mt-2 text-[10px] font-semibold flex items-center gap-1 ${saldoSaatIni < 0 ? 'text-red-600' : 'text-emerald-100'}`}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                  Tersimpan
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── RIWAYAT TRANSAKSI ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">📋 Riwayat Transaksi</span>
            <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{dataFiltered.length}</span>
          </div>
          <p className="text-xs text-gray-500">{formatNamaBulan(filterBulan)} {filterTahun}</p>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-14 rounded-full" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-4 w-24" />
              </div>
            ))}
          </div>
        ) : dataFiltered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-gray-400">Belum ada transaksi di bulan ini.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-100">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Jenis</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 text-right">Jumlah</th>
                    <th className="p-3 text-center no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="p-3 text-gray-700 whitespace-nowrap font-medium">{formatTanggalSingkat(item.tanggal)}</td>
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
                      <td className={`p-3 text-right font-bold ${item.jenis === 'PEMASUKAN' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {item.jenis === 'PEMASUKAN' ? '+' : '−'}{formatRupiah(item.jumlah)}
                      </td>
                      <td className="p-3 text-center no-print">
                        {item.tabel !== 'distribusi' ? (
                          <button
                            onClick={() => setConfirmHapusItem(item)}
                            className="text-red-500 hover:text-red-700 text-[10px] font-bold transition"
                          >
                            Hapus
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={dataFiltered.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {/* CONFIRMATION MODAL HAPUS */}
      <ConfirmModal
        open={confirmHapusItem !== null}
        title="Hapus Transaksi Keuangan"
        message={`Apakah Anda yakin ingin menghapus data ${confirmHapusItem?.label || 'transaksi'} senilai ${confirmHapusItem ? formatRupiah(confirmHapusItem.jumlah) : ''}?`}
        confirmLabel="Hapus Transaksi"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleEksekusiHapus}
        onCancel={() => setConfirmHapusItem(null)}
      />

      {/* TANDA TANGAN CETAK */}
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
