'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { centangDistribusi } from '@/lib/actions/petugas';
import type { Mustahiq, RTGroup, PengajuanUpdate, PeriodeDistribusi } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';
import PrintHeader from '@/components/PrintHeader';

type Tab = 'mustahiq' | 'distribusi';

export default function DasborPetugas() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mustahiq');

  // Tab: mustahiq
  const [dataTergrup, setDataTergrup] = useState<RTGroup[]>([]);
  const [daftarRT, setDaftarRT] = useState<{ id: number; no_rt: number; nama_rt: string }[]>([]);
  const [daftarUsulan, setDaftarUsulan] = useState<PengajuanUpdate[]>([]);
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState('semua');
  const [loading, setLoading] = useState(true);

  const [formRT, setFormRT] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [wargaDiedit, setWargaDiedit] = useState<number | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');
  const [confirmHapusId, setConfirmHapusId] = useState<number | null>(null);

  // Tab: distribusi
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [distGrup, setDistGrup] = useState<RTGroup[]>([]);
  const [distSudah, setDistSudah] = useState<Set<number>>(new Set());
  const [distFilterRT, setDistFilterRT] = useState('semua');
  const [distDaftarRT, setDistDaftarRT] = useState<{ id: number; no_rt: number; nama_rt: string }[]>([]);
  const [loadingCentang, setLoadingCentang] = useState<Set<number>>(new Set());

  // Initial load
  useEffect(() => {
    const load = async () => {
      const { data: rts } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true });
      const { data: usulans } = await supabase.from('pengajuan_update').select('*').eq('status', 'PENDING');
      if (rts) setDaftarRT(rts);
      if (usulans) setDaftarUsulan(usulans);
    };
    load();
  }, []);

  // Search mustahiq
  useEffect(() => {
    const muatDataWarga = async () => {
      setLoading(true);
      let query = supabase.from('penerima_zakat').select('id, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )');
      if (kataKunci.trim()) query = query.ilike('nama', `%${kataKunci}%`);
      if (rtTerpilih !== 'semua') query = query.eq('rt_id', parseInt(rtTerpilih));
      const { data, error } = await query.order('rt_id', { ascending: true });
      if (!error && data) {
        const mentah = data as unknown as Mustahiq[];
        const grup: Record<number, RTGroup> = {};
        mentah.forEach((w) => {
          if (!w.daftar_rt) return;
          if (!grup[w.rt_id]) grup[w.rt_id] = { rt_id: w.rt_id, no_rt: w.daftar_rt.no_rt, nama_rt: w.daftar_rt.nama_rt, warga: [] };
          grup[w.rt_id].warga.push(w);
        });
        setDataTergrup(Object.values(grup));
      }
      setLoading(false);
    };
    const t = setTimeout(muatDataWarga, 300);
    return () => clearTimeout(t);
  }, [kataKunci, rtTerpilih]);

  // Load distribusi data
  useEffect(() => {
    if (tab !== 'distribusi') return;
    const load = async () => {
      const { data: periodes } = await supabase.from('periode_distribusi').select('*').eq('status', 'AKTIF').limit(1);
      if (periodes && periodes.length > 0) {
        setPeriodeAktif(periodes[0]);
        const { data: dists } = await supabase.from('distribusi').select('*').eq('periode_id', periodes[0].id);
        if (dists) setDistSudah(new Set(dists.map((d) => d.mustahiq_id)));

        const { data: periodeRts } = await supabase
          .from('periode_rt')
          .select('rt_id, daftar_rt!inner(id, no_rt, nama_rt)')
          .eq('periode_id', periodes[0].id);

        if (periodeRts && periodeRts.length > 0) {
          const rtList = periodeRts.map((r: any) => r.daftar_rt);
          setDistDaftarRT(rtList);
          setDistFilterRT('semua');

          const rtIds = periodeRts.map((r: any) => r.rt_id);
          const { data: mustahiq } = await supabase
            .from('penerima_zakat')
            .select('id, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )')
            .in('rt_id', rtIds);
          if (mustahiq) {
            const mentah = mustahiq as unknown as Mustahiq[];
            const grup: Record<number, RTGroup> = {};
            mentah.forEach((w) => {
              if (!w.daftar_rt) return;
              if (!grup[w.rt_id]) grup[w.rt_id] = { rt_id: w.rt_id, no_rt: w.daftar_rt.no_rt, nama_rt: w.daftar_rt.nama_rt, warga: [] };
              grup[w.rt_id].warga.push(w);
            });
            setDistGrup(Object.values(grup));
          }
        } else {
          // Fallback: tampilkan semua mustahiq jika belum ada RT tersimpan
          const { data: allRts } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt');
          setDistDaftarRT(allRts ?? []);
          setDistFilterRT('semua');

          const { data: mustahiq } = await supabase
            .from('penerima_zakat')
            .select('id, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )');
          if (mustahiq) {
            const mentah = mustahiq as unknown as Mustahiq[];
            const grup: Record<number, RTGroup> = {};
            mentah.forEach((w) => {
              if (!w.daftar_rt) return;
              if (!grup[w.rt_id]) grup[w.rt_id] = { rt_id: w.rt_id, no_rt: w.daftar_rt.no_rt, nama_rt: w.daftar_rt.nama_rt, warga: [] };
              grup[w.rt_id].warga.push(w);
            });
            setDistGrup(Object.values(grup));
          }
        }
      } else {
        setPeriodeAktif(null);
        setDistSudah(new Set());
        setDistGrup([]);
        setDistDaftarRT([]);
      }
    };
    load();
  }, [tab]);

  // CRUD mustahiq
  const handleTambah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama) return alert('RT dan Nama wajib diisi.');
    const { error } = await supabase.from('penerima_zakat').insert([{ rt_id: parseInt(formRT), nama: formNama, keterangan: formKeterangan || null }]);
    if (!error) { setFormNama(''); setFormKeterangan(''); setFormRT(''); window.location.reload(); }
  };

  const handleSimpanEdit = async (id: number) => {
    const { error } = await supabase.from('penerima_zakat').update({ nama: editNama, keterangan: editKeterangan || null }).eq('id', id);
    if (!error) { setWargaDiedit(null); window.location.reload(); }
  };

  const handleHapusKonfirmasi = async () => {
    if (!confirmHapusId) return;
    const { error } = await supabase.from('penerima_zakat').delete().eq('id', confirmHapusId);
    setConfirmHapusId(null);
    if (!error) window.location.reload();
  };

  const handleApprove = async (u: PengajuanUpdate) => {
    if (u.penerima_id) {
      const { error } = await supabase.from('penerima_zakat').update({ nama: u.nama_baru, keterangan: u.keterangan_baru }).eq('id', u.penerima_id);
      if (error) return alert('Gagal update.');
    } else {
      const rtId = u.keterangan_baru?.match(/RT ID: (\d+)/);
      const idRt = rtId ? parseInt(rtId[1]) : null;
      if (!idRt) return alert('Informasi RT tidak valid.');
      const ket = u.keterangan_baru?.replace(/\[USULAN BARU - RT ID: \d+\]\s*/, '') || null;
      const { error } = await supabase.from('penerima_zakat').insert([{ rt_id: idRt, nama: u.nama_baru, keterangan: ket }]);
      if (error) return alert('Gagal insert.');
    }
    await supabase.from('pengajuan_update').update({ status: 'DISETUJUI' }).eq('id', u.id);
    window.location.reload();
  };

  const handleReject = async (id: number) => {
    await supabase.from('pengajuan_update').update({ status: 'DITOLAK' }).eq('id', id);
    window.location.reload();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    router.push('/login');
  };

  // Toggle centang distribusi
  const handleCentang = async (mustahiqId: number) => {
    if (!periodeAktif || loadingCentang.has(mustahiqId)) return;
    setLoadingCentang((prev) => new Set(prev).add(mustahiqId));
    try {
      await centangDistribusi(mustahiqId, periodeAktif.id);
      setDistSudah((prev) => {
        const next = new Set(prev);
        if (next.has(mustahiqId)) next.delete(mustahiqId);
        else next.add(mustahiqId);
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setLoadingCentang((prev) => {
        const next = new Set(prev);
        next.delete(mustahiqId);
        return next;
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-gray-50 text-gray-800">
      {/* KOP SURAT PRINT */}
      <PrintHeader
        title="Daftar Penerima Zakat Mal (Mustahiq)"
        subtitle="Sistem Informasi Pendataan Lapangan — Desa Badean"
      />

      {/* Header */}
      <div className="flex justify-between items-center pb-5 mb-6 border-b border-gray-200 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">🧑‍💼 Halaman Petugas</h1>
          <p className="text-xs text-gray-500 mt-0.5">LAZISNU Desa Badean</p>
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm no-print">
        {([['mustahiq', '👥 Data Mustahiq'], ['distribusi', '🎯 Distribusi']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              tab === key ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800'
            }`}>{label}</button>
        ))}
      </div>

      {/* === TAB MUSTAHIQ === */}
      {tab === 'mustahiq' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm no-print">
            <h2 className="text-xs font-bold text-gray-900 mb-3">➕ Daftarkan Warga Baru</h2>
            <form onSubmit={handleTambah} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <select required value={formRT} onChange={(e) => setFormRT(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
                <option value="">-- RT --</option>
                {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt}</option>))}
              </select>
              <input type="text" required placeholder="Nama" value={formNama} onChange={(e) => setFormNama(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
              <input type="text" placeholder="Keterangan" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
              <button type="submit"
                className="py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Simpan</button>
            </form>
          </div>

          {daftarUsulan.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-amber-800 font-bold text-xs mb-2">⚠️ {daftarUsulan.length} Usulan Masuk</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {daftarUsulan.map((u) => (
                  <div key={u.id} className="bg-white border border-amber-100 p-2 rounded-lg flex justify-between items-center text-xs">
                    <div><span className="font-bold text-emerald-700">{u.nama_baru}</span> <span className="text-gray-400 mx-1">|</span> <span className="text-gray-500 italic">{u.keterangan_baru || '-'}</span></div>
                    <div className="flex gap-1">
                      <button onClick={() => handleApprove(u)}
                        className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-semibold">Terima</button>
                      <button onClick={() => handleReject(u.id)}
                        className="px-2 py-0.5 bg-gray-400 text-white rounded text-[10px] font-semibold">Tolak</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 border border-gray-200 rounded-xl shadow-sm no-print">
            <input type="text" placeholder="🔍 Cari mustahiq..." value={kataKunci} onChange={(e) => setKataKunci(e.target.value)}
              className="w-full sm:max-w-xs px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900" />
            <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
              className="w-full sm:w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900">
              <option value="semua">🌐 Semua RT</option>
              {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt}</option>))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="skeleton h-4 w-28 mb-3" />
                  <div className="space-y-2">
                    {[1,2,3].map(j => <div key={j} className="skeleton h-3 w-full" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : dataTergrup.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm text-gray-400">Tidak ada data mustahiq.</p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in print:block print:columns-2 print:gap-3 print:space-y-3">
              {dataTergrup.map((grup) => (
                <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden print:break-inside-avoid-page print:mb-3 print:border-gray-300 print:shadow-none">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center print:py-1.5 print:bg-emerald-50">
                    <h3 className="font-bold text-xs text-emerald-900 print:text-xs">RT.{grup.no_rt} &mdash; {grup.nama_rt}</h3>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{grup.warga.length} Jiwa</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-100 print:bg-gray-100">
                          <th className="p-2.5 print:p-1 w-8 text-center">No</th>
                          <th className="p-2.5 print:p-1">Nama</th>
                          <th className="p-2.5 print:p-1">Keterangan</th>
                          <th className="p-2.5 text-center no-print">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                        {grup.warga.map((w, i) => (
                          <tr key={w.id} className="hover:bg-gray-50 transition">
                            <td className="p-2.5 print:p-1 text-center text-gray-400 font-medium">{i + 1}</td>
                            <td className="p-2.5 print:p-1 font-semibold text-gray-900 print:text-[11px]">{w.nama}</td>
                            <td className="p-2.5 print:p-1 text-gray-500 italic print:text-[10px]">{w.keterangan || '—'}</td>
                            <td className="p-2.5 text-center no-print">
                              {wargaDiedit === w.id ? (
                                <div className="flex justify-center gap-1.5">
                                  <button onClick={() => handleSimpanEdit(w.id)}
                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition">Simpan</button>
                                  <button onClick={() => setWargaDiedit(null)}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-[10px] font-medium hover:bg-gray-300 transition">Batal</button>
                                </div>
                              ) : (
                                <div className="flex justify-center gap-2">
                                  <button onClick={() => { setWargaDiedit(w.id); setEditNama(w.nama); setEditKeterangan(w.keterangan || ''); }}
                                    className="text-emerald-700 hover:text-emerald-900 font-bold text-[10px] transition">Edit</button>
                                  <span className="text-gray-200">|</span>
                                  <button onClick={() => setConfirmHapusId(w.id)}
                                    className="text-red-500 hover:text-red-700 font-bold text-[10px] transition">Hapus</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAB DISTRIBUSI === */}
      {tab === 'distribusi' && (
        <div className="space-y-4 animate-fade-in">
          {!periodeAktif ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">⏸️</p>
              <p className="text-sm text-amber-700 font-bold">Belum ada periode distribusi aktif.</p>
              <p className="text-xs text-amber-500 mt-1">Tunggu admin membuka periode baru.</p>
            </div>
          ) : (
            <>
              {/* Periode info + progress */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-extrabold text-emerald-900">🎯 {periodeAktif.nama}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {periodeAktif.jumlah_per_jiwa
                        ? `Rp ${Number(periodeAktif.jumlah_per_jiwa).toLocaleString('id-ID')} per jiwa`
                        : 'Nominal belum ditentukan'}
                      {periodeAktif.bentuk !== 'TUNAI' ? ` · ${periodeAktif.bentuk}` : ''}
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">
                    {distSudah.size} / {distGrup.reduce((s, g) => s + g.warga.length, 0)} Jiwa
                  </span>
                </div>
                {/* Global progress bar */}
                {distGrup.length > 0 && (() => {
                  const totalGlobal = distGrup.reduce((s, g) => s + g.warga.length, 0);
                  const pct = totalGlobal > 0 ? Math.round((distSudah.size / totalGlobal) * 100) : 0;
                  return (
                    <div>
                      <div className="h-2.5 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-1.5 font-semibold">{pct}% sudah menerima distribusi</p>
                    </div>
                  );
                })()}
              </div>

              {/* RT filter */}
              {distDaftarRT.length > 0 && (
                <div>
                  <select value={distFilterRT} onChange={(e) => setDistFilterRT(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
                    <option value="semua">📍 Semua RT</option>
                    {distDaftarRT.map((rt) => (
                      <option key={rt.id} value={rt.id}>RT.{rt.no_rt} — {rt.nama_rt}</option>
                    ))}
                  </select>
                </div>
              )}

              {distGrup
                .filter((g) => distFilterRT === 'semua' || g.rt_id === parseInt(distFilterRT))
                .map((grup) => {
                const totalRT = grup.warga.length;
                const terdistribusi = grup.warga.filter((w) => distSudah.has(w.id)).length;
                const pctRT = totalRT > 0 ? Math.round((terdistribusi / totalRT) * 100) : 0;
                return (
                  <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3.5 border-b border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-sm text-emerald-900">RT.{grup.no_rt} — {grup.nama_rt}</h3>
                        <span className="text-xs font-semibold text-gray-600">{terdistribusi}/{totalRT} ({pctRT}%)</span>
                      </div>
                      <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${pctRT}%` }} />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-100">
                            <th className="p-3 w-10 text-center">No</th>
                            <th className="p-3">Nama</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {grup.warga.map((w, i) => {
                            const sudah = distSudah.has(w.id);
                            return (
                              <tr key={w.id} className={`${sudah ? 'bg-emerald-50/40' : ''} hover:bg-gray-50 transition`}>
                                <td className="p-3 text-center text-gray-400 font-medium">{i + 1}</td>
                                <td className="p-3 font-semibold text-gray-900">{w.nama}</td>
                                <td className="p-3">
                                  {sudah ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">✓ Sudah</span>
                                  ) : (
                                    <span className="inline-flex px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-semibold">Belum</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <button onClick={() => handleCentang(w.id)}
                                    disabled={loadingCentang.has(w.id)}
                                    className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition active:scale-95 ${
                                      loadingCentang.has(w.id)
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : sudah
                                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                    }`}>
                                    {loadingCentang.has(w.id) ? '...' : (sudah ? '✕ Batal' : '✓ Centang')}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      {/* CONFIRMATION MODAL HAPUS */}
      <ConfirmModal
        open={confirmHapusId !== null}
        title="Hapus Data Mustahiq"
        message="Apakah Anda yakin ingin menghapus data warga ini?"
        confirmLabel="Hapus Data"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleHapusKonfirmasi}
        onCancel={() => setConfirmHapusId(null)}
      />

      {/* TANDA TANGAN CETAK */}
      <div className="hidden print:flex justify-between items-end pt-12 text-xs">
        <div className="text-center w-48">
          <p className="mb-16">Mengetahui,<br /><strong>Ketua LAZISNU Badean</strong></p>
          <p className="border-b border-gray-400 pb-1 font-bold">( ........................................ )</p>
        </div>
        <div className="text-center w-48">
          <p className="mb-16">Badean, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong>Petugas Pendataan</strong></p>
          <p className="border-b border-gray-400 pb-1 font-bold">( ........................................ )</p>
        </div>
      </div>
    </div>
  );
}
