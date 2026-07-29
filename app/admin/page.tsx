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

function SkeletonCard({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl p-5 shadow-sm ${wide ? 'col-span-2' : ''}`}>
      <div className="skeleton h-3 w-20 mb-3" />
      <div className="skeleton h-8 w-36" />
    </div>
  );
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

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">📊 Dashboard Admin</h1>
          <p className="text-xs text-gray-500 mt-0.5">Ringkasan data LAZISNU Badean</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {periodeAktif && (
            <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full font-semibold">
              🎯 Periode: {periodeAktif}
            </span>
          )}
          {bulanYangPerluDisimpan && (
            <button
              onClick={handleSimpanSaldo}
              disabled={menyimpan}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full font-semibold transition disabled:opacity-60 shadow-sm"
            >
              {menyimpan ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Menyimpan...
                </>
              ) : (
                <>💾 Simpan Saldo {formatBulan(bulanYangPerluDisimpan)}</>
              )}
            </button>
          )}
          {!loading && !bulanYangPerluDisimpan && (
            <span className="flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full font-semibold">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              Saldo Tersimpan
            </span>
          )}
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SkeletonCard wide />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : stats && (
        <>
          {/* Row 1: Saldo besar + 3 pendukung */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Saldo Kas — wide / prominent */}
            <div className={`col-span-2 rounded-2xl p-5 shadow-md ${stats.saldo < 0 ? 'bg-red-600' : 'bg-gradient-to-br from-emerald-600 to-emerald-700'} text-white`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">💰 Saldo Kas Saat Ini</p>
              <p className="text-3xl font-extrabold mt-1">{formatRupiah(stats.saldo)}</p>
              <p className="text-xs text-white/60 mt-2">Berdasarkan saldo tersimpan + transaksi bulan ini</p>
            </div>

            {/* Total Penerimaan */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">📥 Total Penerimaan</p>
              <p className="text-xl font-extrabold text-gray-900 mt-1">{formatRupiah(stats.totalPenerimaan)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Semua waktu</p>
            </div>

            {/* Total Disalurkan */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">📤 Sudah Disalurkan</p>
              <p className="text-xl font-extrabold text-orange-600 mt-1">{formatRupiah(stats.totalDistribusi)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Distribusi ke mustahiq</p>
            </div>
          </div>

          {/* Row 2: 6 stats kecil */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Mustahiq', value: `${stats.totalMustahiq} Jiwa`, color: 'text-gray-900', icon: '👥' },
              { label: 'Wilayah RT', value: `${stats.totalRT} RT`, color: 'text-gray-900', icon: '🏘️' },
              { label: 'Total Pengeluaran', value: formatRupiah(stats.totalPengeluaran), color: 'text-red-600', icon: '💸' },
              { label: 'Distrib. Bulan Ini', value: formatRupiah(stats.distribusiBulanIni), color: 'text-orange-600', icon: '🎯' },
              { label: 'Keluar Bulan Ini', value: formatRupiah(stats.pengeluaranBulanIni), color: 'text-red-600', icon: '📤' },
              { label: 'Saldo Bersih Ini', value: formatRupiah(stats.saldo), color: stats.saldo < 0 ? 'text-red-600' : 'text-emerald-700', icon: '💡' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <p className="text-lg">{card.icon}</p>
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-1 leading-tight">{card.label}</p>
                <p className={`text-sm font-extrabold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── PENERIMAAN PER SUMBER ── */}
      {stats && stats.penerimaanPerSumber.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-4">📊 Penerimaan Per Sumber</h2>
          <div className="space-y-3">
            {stats.penerimaanPerSumber.map((s) => {
              const pct = stats.totalPenerimaan > 0 ? Math.round((s.total / stats.totalPenerimaan) * 100) : 0;
              return (
                <div key={s.sumber}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700 font-medium">
                      {s.sumber === 'ZAKAT_MAL' ? '🕌 Zakat Mal' : '🤲 Sedekah / Infak'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct}%</span>
                      <span className="text-sm font-bold text-gray-900">{formatRupiah(s.total)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
