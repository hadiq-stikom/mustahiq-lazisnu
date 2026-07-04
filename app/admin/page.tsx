'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { formatRupiah } from '@/lib/utils';
import { simpanSaldoBulanan } from '@/lib/actions/admin';

interface Stats {
  totalMustahiq: number;
  totalRT: number;
  totalPenerimaan: number;
  totalDistribusi: number;
  totalPengeluaran: number;
  saldo: number;
  penerimaanPerSumber: { sumber: string; total: number }[];
  distribusiBulanIni: number;
  pengeluaranBulanIni: number;
}

function formatBulan(bulan: string): string {
  const [t, b] = bulan.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${months[parseInt(b) - 1]} ${t}`;
}

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function bulanLalu(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodeAktif, setPeriodeAktif] = useState<string | null>(null);
  const [bulanYangPerluDisimpan, setBulanYangPerluDisimpan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const loadStats = useCallback(async () => {
    const bIni = bulanIni();

    const [
      { count: mustahiqCount },
      { count: rtCount },
      { data: penerimaan },
      { data: distribusi },
      { data: distribusiBulan },
      { data: periodes },
      { data: semuaSaldo },
      { data: penerimaanBulanIni },
      { data: distribusiBulanIniRaw },
      { data: pengeluaranBulanIniRaw },
      { data: semuaPengeluaran },
    ] = await Promise.all([
      supabase.from('penerima_zakat').select('*', { count: 'exact', head: true }),
      supabase.from('daftar_rt').select('*', { count: 'exact', head: true }),
      supabase.from('penerimaan').select('jumlah, sumber'),
      supabase.from('distribusi').select('jumlah'),
      supabase
        .from('distribusi')
        .select('jumlah')
        .gte('tanggal', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      supabase.from('periode_distribusi').select('nama').eq('status', 'AKTIF').limit(1),
      supabase.from('saldo_bulanan').select('bulan').order('bulan', { ascending: false }),
      supabase
        .from('penerimaan')
        .select('jumlah')
        .gte('tanggal', `${bIni}-01`)
        .lt('tanggal', `${parseInt(bIni.split('-')[0])}-${String(parseInt(bIni.split('-')[1]) + 1).padStart(2, '0')}-01`),
      supabase
        .from('distribusi')
        .select('jumlah')
        .gte('tanggal', `${bIni}-01`)
        .lt('tanggal', `${parseInt(bIni.split('-')[0])}-${String(parseInt(bIni.split('-')[1]) + 1).padStart(2, '0')}-01`),
      supabase
        .from('pengeluaran')
        .select('jumlah')
        .gte('tanggal', `${bIni}-01`)
        .lt('tanggal', `${parseInt(bIni.split('-')[0])}-${String(parseInt(bIni.split('-')[1]) + 1).padStart(2, '0')}-01`),
      supabase.from('pengeluaran').select('jumlah'),
    ]);

    const totalPenerimaan = (penerimaan ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
    const totalDistribusi = (distribusi ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);

    const dIni = (distribusiBulanIniRaw ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
    const pIni = (penerimaanBulanIni ?? []).reduce((s, r) => s + (r.jumlah || 0), 0);
    const pngIni = (pengeluaranBulanIniRaw ?? []).reduce((s: number, r: { jumlah: number }) => s + (r.jumlah || 0), 0);

    const savedSet = new Set((semuaSaldo ?? []).map(s => s.bulan));
    const savedSorted = (semuaSaldo ?? []).map(s => s.bulan).sort();
    const saldoTerakhir = savedSorted.length > 0 ? savedSorted[savedSorted.length - 1] : null;

    // Cari bulan yang paling awal belum tersimpan (sejak saldoTerakhir + 1 sampai bIni - 1)
    let perluDisimpan: string | null = null;
    if (saldoTerakhir) {
      let cursor = saldoTerakhir;
      while (cursor < bIni) {
        const [t, b] = cursor.split('-').map(Number);
        const next = new Date(t, b, 1);
        cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        if (cursor < bIni && !savedSet.has(cursor)) {
          perluDisimpan = cursor;
          break;
        }
      }
    }

    // Saldo sekarang: dari saldo terakhir + transaksi bulan ini
    const saldoTerakhirValue = saldoTerakhir
      ? (await supabase.from('saldo_bulanan').select('saldo').eq('bulan', saldoTerakhir).single()).data as { saldo: number } | null
      : null;
    const totalPengeluaran = (semuaPengeluaran ?? []).reduce((s: number, r: { jumlah: number }) => s + (r.jumlah || 0), 0);
    const saldoAwal = saldoTerakhirValue?.saldo ?? 0;
    const saldoSekarang = saldoAwal + pIni - dIni - pngIni;

    const sumberMap: Record<string, number> = {};
    (penerimaan ?? []).forEach((r) => {
      sumberMap[r.sumber] = (sumberMap[r.sumber] || 0) + (r.jumlah || 0);
    });

    if (periodes && periodes.length > 0) setPeriodeAktif(periodes[0].nama);
    setBulanYangPerluDisimpan(perluDisimpan);

    setStats({
      totalMustahiq: mustahiqCount ?? 0,
      totalRT: rtCount ?? 0,
      totalPenerimaan,
      totalDistribusi,
      totalPengeluaran,
      saldo: saldoSekarang,
      penerimaanPerSumber: Object.entries(sumberMap).map(([sumber, total]) => ({ sumber, total })),
      distribusiBulanIni: dIni,
      pengeluaranBulanIni: pngIni,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSimpanSaldo = async () => {
    if (!bulanYangPerluDisimpan) return;
    setMenyimpan(true);
    try {
      await simpanSaldoBulanan(bulanYangPerluDisimpan);
      setBulanYangPerluDisimpan(null);
      loadStats();
    } catch (e) {
      alert('Gagal menyimpan saldo: ' + (e instanceof Error ? e.message : ''));
    }
    setMenyimpan(false);
  };

  if (loading || !stats) {
    return <div className="text-sm text-gray-500">Memuat dashboard...</div>;
  }

  const cards = [
    { label: 'Total Mustahiq', value: stats.totalMustahiq.toString(), unit: 'Jiwa' },
    { label: 'Wilayah RT', value: stats.totalRT.toString(), unit: 'RT' },
    { label: 'Total Penerimaan', value: formatRupiah(stats.totalPenerimaan) },
    { label: 'Sudah Disalurkan', value: formatRupiah(stats.totalDistribusi) },
    { label: 'Total Pengeluaran', value: formatRupiah(stats.totalPengeluaran) },
    { label: 'Saldo Kas', value: formatRupiah(stats.saldo), warn: stats.saldo < 0 },
    { label: 'Distribusi Bulan Ini', value: formatRupiah(stats.distribusiBulanIni) },
    { label: 'Pengeluaran Bulan Ini', value: formatRupiah(stats.pengeluaranBulanIni) },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">Dashboard Admin</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {periodeAktif && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
              Periode Aktif: {periodeAktif}
            </span>
          )}
          {bulanYangPerluDisimpan && (
            <button
              onClick={handleSimpanSaldo}
              disabled={menyimpan}
              className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold hover:bg-blue-100 disabled:opacity-50"
            >
              {menyimpan ? 'Menyimpan...' : `Simpan Saldo ${formatBulan(bulanYangPerluDisimpan)}`}
            </button>
          )}
          {!bulanYangPerluDisimpan && (
            <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">
              Semua saldo tersimpan
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{card.label}</p>
            <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${card.warn ? 'text-red-600' : 'text-gray-900'}`}>
              {card.value}
            </p>
            {card.unit && <p className="text-[10px] sm:text-xs text-gray-400">{card.unit}</p>}
          </div>
        ))}
      </div>

      {stats.penerimaanPerSumber.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-3">Penerimaan Per Sumber</h2>
          <div className="space-y-3">
            {stats.penerimaanPerSumber.map((s) => (
              <div key={s.sumber} className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  {s.sumber === 'ZAKAT_MAL' ? 'Zakat Mal' : 'Sedekah / Infak'}
                </span>
                <span className="text-sm font-semibold text-gray-900">{formatRupiah(s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
