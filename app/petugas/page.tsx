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
  const [tabUsulan, setTabUsulan] = useState<'BARU' | 'HAPUS'>('BARU');
  const [confirmApproveHapus, setConfirmApproveHapus] = useState<PengajuanUpdate | null>(null);
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState('semua');
  const [loading, setLoading] = useState(true);

  // Pisahkan daftar usulan baru vs usulan penghapusan
  const usulanBaruList = daftarUsulan.filter((u) => !u.penerima_id && !u.keterangan_baru?.startsWith('[USULAN HAPUS'));
  const usulanHapusList = daftarUsulan.filter((u) => !!u.penerima_id || u.keterangan_baru?.startsWith('[USULAN HAPUS'));

  // Struktur & Helper untuk mengelompokkan usulan per RT
  interface UsulanRTGroup {
    rt_id: number;
    no_rt: number;
    nama_rt: string;
    items: PengajuanUpdate[];
  }

  const kelompokkanUsulanPerRT = (list: PengajuanUpdate[], isHapus: boolean): UsulanRTGroup[] => {
    const map: Record<number, UsulanRTGroup> = {};

    list.forEach((u) => {
      let rtId = 0;
      if (isHapus) {
        const matchHapus = u.keterangan_baru?.match(/\[USULAN HAPUS(?: - RT ID:\s*(\d+))?\]/i);
        if (matchHapus && matchHapus[1]) {
          rtId = parseInt(matchHapus[1]);
        } else if (u.penerima_id) {
          for (const g of dataTergrup) {
            if (g.warga.some((w) => w.id === u.penerima_id)) {
              rtId = g.rt_id;
              break;
            }
          }
        }
      } else {
        const matchBaru = u.keterangan_baru?.match(/(?:\[USULAN BARU - RT ID:\s*|RT ID:\s*)(\d+)/i);
        if (matchBaru) {
          rtId = parseInt(matchBaru[1]);
        }
      }

      const rtObj = daftarRT.find((r) => r.id === rtId);
      const no_rt = rtObj ? rtObj.no_rt : 999;
      const nama_rt = rtObj ? rtObj.nama_rt : 'Wilayah Badean (Umum)';

      if (!map[rtId]) {
        map[rtId] = {
          rt_id: rtId,
          no_rt,
          nama_rt,
          items: [],
        };
      }
      map[rtId].items.push(u);
    });

    return Object.values(map).sort((a, b) => a.no_rt - b.no_rt);
  };

  const usulanBaruTergrup = kelompokkanUsulanPerRT(usulanBaruList, false);
  const usulanHapusTergrup = kelompokkanUsulanPerRT(usulanHapusList, true);

  // Otomatis arahkan tab jika salah satu jenis usulan kosong
  useEffect(() => {
    if (daftarUsulan.length > 0) {
      const hasBaru = daftarUsulan.some((u) => !u.penerima_id && !u.keterangan_baru?.startsWith('[USULAN HAPUS'));
      const hasHapus = daftarUsulan.some((u) => !!u.penerima_id || u.keterangan_baru?.startsWith('[USULAN HAPUS'));
      if (!hasBaru && hasHapus) {
        setTabUsulan('HAPUS');
      } else if (hasBaru && !hasHapus) {
        setTabUsulan('BARU');
      }
    }
  }, [daftarUsulan]);

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
      const { data, error } = await query.order('rt_id', { ascending: true }).order('nama', { ascending: true });
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
      if (u.keterangan_baru?.startsWith('[USULAN HAPUS')) {
        const { error } = await supabase.from('penerima_zakat').delete().eq('id', u.penerima_id);
        if (error) return alert('Gagal menghapus mustahiq.');
      } else {
        const { error } = await supabase.from('penerima_zakat').update({ nama: u.nama_baru, keterangan: u.keterangan_baru }).eq('id', u.penerima_id);
        if (error) return alert('Gagal update.');
      }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 sm:pb-5 sm:mb-6 border-b border-gray-200 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex items-center justify-center shrink-0">
            <img src="/logo2.png" alt="Logo LAZISNU" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-1.5 whitespace-nowrap">
              <span>🧑‍💼</span>
              <span>Halaman Petugas</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500 truncate">LAZISNU Desa Badean</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95 min-h-[38px] sm:min-h-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.562 0-1.056-.419-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.1 48.1 0 0110.56 0m-10.56 0V3.375c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.656" />
            </svg>
            <span>Cetak PDF</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 shadow-sm transition active:scale-95 min-h-[38px] sm:min-h-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Tabs (Sticky on Mobile) */}
      <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-md pt-1 pb-3 mb-4 no-print">
        <div className="flex gap-1.5 bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm">
          {([['mustahiq', '👥 Data Mustahiq'], ['distribusi', '🎯 Distribusi']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] ${
                tab === key ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800'
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {/* === TAB MUSTAHIQ === */}
      {tab === 'mustahiq' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm no-print">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900 mb-3">➕ Daftarkan Warga Baru</h2>
            <form onSubmit={handleTambah} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">RT</label>
                <select required value={formRT} onChange={(e) => setFormRT(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base sm:text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] sm:min-h-0">
                  <option value="">-- Pilih RT --</option>
                  {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt} {rt.nama_rt}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Nama Lengkap</label>
                <input type="text" required placeholder="Nama mustahiq" value={formNama} onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base sm:text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] sm:min-h-0" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Keterangan (opsional)</label>
                <input type="text" placeholder="Kondisi keluarga" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-base sm:text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] sm:min-h-0" />
              </div>
              <button type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition active:scale-95 min-h-[44px]">
                Simpan Warga
              </button>
            </form>
          </div>

          {daftarUsulan.length > 0 && (
            <div className="bg-white border-2 border-amber-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-bold">
                    📬
                  </span>
                  <div>
                    <h3 className="text-gray-900 font-bold text-xs sm:text-sm">
                      Verifikasi Usulan Warga
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Tinjau permohonan penambahan atau penghapusan data mustahiq
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                  {daftarUsulan.length} Usulan
                </span>
              </div>

              {/* SEGMENTED SUB-TABS */}
              <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setTabUsulan('BARU')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[40px] ${
                    tabUsulan === 'BARU'
                      ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/60'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span>➕ Warga Baru</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    tabUsulan === 'BARU' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {usulanBaruList.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTabUsulan('HAPUS')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[40px] ${
                    tabUsulan === 'HAPUS'
                      ? 'bg-white text-red-700 shadow-sm border border-gray-200/60'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span>🗑️ Usulan Hapus</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    tabUsulan === 'HAPUS' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {usulanHapusList.length}
                  </span>
                </button>
              </div>

              {/* LIST KONTEN TAB BARU (DIKELOMPOKKAN PER RT) */}
              {tabUsulan === 'BARU' && (
                <div className="space-y-3 max-h-80 sm:max-h-[28rem] overflow-y-auto pr-0.5">
                  {usulanBaruTergrup.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      Tidak ada usulan penambahan warga baru.
                    </div>
                  ) : (
                    usulanBaruTergrup.map((grup) => (
                      <div key={grup.rt_id} className="bg-white border border-emerald-200/90 rounded-2xl overflow-hidden shadow-xs">
                        {/* Header Grup RT */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-3.5 py-2.5 border-b border-emerald-100 flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-700 text-xs">📍</span>
                            <h4 className="font-bold text-xs sm:text-sm text-emerald-950">
                              RT.{grup.no_rt} &mdash; {grup.nama_rt}
                            </h4>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {grup.items.length} Usulan
                          </span>
                        </div>

                        {/* Daftar Calon Warga di RT Ini */}
                        <div className="p-2 sm:p-2.5 space-y-2">
                          {grup.items.map((u) => {
                            const catatan = u.keterangan_baru?.replace(/\[USULAN BARU - RT ID:\s*\d+\]\s*/i, '').trim() || '';

                            return (
                              <div key={u.id} className="bg-emerald-50/40 border border-emerald-100/90 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                  <div className="font-bold text-gray-900 text-sm sm:text-base">
                                    {u.nama_baru}
                                  </div>
                                  {catatan ? (
                                    <p className="text-xs text-gray-600 bg-white/80 p-2 rounded-lg border border-emerald-100">
                                      <span className="font-semibold text-emerald-800">Catatan pengusul: </span>
                                      {catatan}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-gray-400 italic">Tanpa keterangan tambahan</p>
                                  )}
                                </div>
                                <div className="flex gap-2 shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(u)}
                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs text-xs font-bold transition active:scale-95 flex items-center gap-1 min-h-[40px]"
                                  >
                                    <span>✓ Daftarkan Warga</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReject(u.id)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold transition active:scale-95 min-h-[40px]"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* LIST KONTEN TAB HAPUS (DIKELOMPOKKAN PER RT) */}
              {tabUsulan === 'HAPUS' && (
                <div className="space-y-3 max-h-80 sm:max-h-[28rem] overflow-y-auto pr-0.5">
                  {usulanHapusTergrup.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      Tidak ada usulan penghapusan mustahiq.
                    </div>
                  ) : (
                    usulanHapusTergrup.map((grup) => (
                      <div key={grup.rt_id} className="bg-white border border-red-200/90 rounded-2xl overflow-hidden shadow-xs">
                        {/* Header Grup RT */}
                        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-3.5 py-2.5 border-b border-red-100 flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-red-700 text-xs">📍</span>
                            <h4 className="font-bold text-xs sm:text-sm text-red-950">
                              RT.{grup.no_rt} &mdash; {grup.nama_rt}
                            </h4>
                          </div>
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {grup.items.length} Usulan Hapus
                          </span>
                        </div>

                        {/* Daftar Usulan Hapus di RT Ini */}
                        <div className="p-2 sm:p-2.5 space-y-2">
                          {grup.items.map((u) => {
                            const alasanHapus = u.keterangan_baru?.replace(/\[USULAN HAPUS(?: - RT ID:\s*\d+)?\]\s*/i, '').trim() || '';

                            return (
                              <div key={u.id} className="bg-red-50/40 border border-red-100/90 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                  <div className="font-bold text-gray-900 text-sm sm:text-base">
                                    {u.nama_baru}
                                  </div>
                                  <div className="p-2 bg-white/90 rounded-lg border border-red-100 text-xs text-red-900">
                                    <span className="font-semibold text-red-700">Alasan penghapusan: </span>
                                    <span>{alasanHapus || 'Tidak ada alasan yang dicantumkan'}</span>
                                  </div>
                                </div>
                                <div className="flex gap-2 shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmApproveHapus(u)}
                                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs text-xs font-bold transition active:scale-95 flex items-center gap-1 min-h-[40px]"
                                  >
                                    <span>🗑️ Setujui Hapus</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReject(u.id)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold transition active:scale-95 min-h-[40px]"
                                  >
                                    Tolak Hapus
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center bg-white p-3.5 sm:p-4 border border-gray-200 rounded-2xl shadow-sm no-print">
            <input type="text" placeholder="🔍 Cari nama mustahiq..." value={kataKunci} onChange={(e) => setKataKunci(e.target.value)}
              className="w-full sm:max-w-xs px-3 py-2 border border-gray-200 rounded-xl text-base sm:text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]" />
            <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-200 rounded-xl text-base sm:text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]">
              <option value="semua">🌐 Semua RT</option>
              {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt} {rt.nama_rt}</option>))}
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
                <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden print-avoid-break print:mb-3 print:border-gray-300 print:shadow-none">
                  {/* RT Header Banner */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 sm:px-5 py-3 border-b border-gray-200 flex justify-between items-center print:bg-emerald-50">
                    <h3 className="font-bold text-xs sm:text-sm text-emerald-900">RT.{grup.no_rt} &mdash; {grup.nama_rt}</h3>
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{grup.warga.length} Jiwa</span>
                  </div>

                  {/* ── MOBILE MUSTAHIQ CARD FEED ── */}
                  <div className="block md:hidden divide-y divide-gray-100 no-print">
                    {grup.warga.map((w, i) => (
                      <div key={w.id} className="p-3.5 hover:bg-gray-50/80 transition">
                        {wargaDiedit === w.id ? (
                          <div className="space-y-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                            <p className="text-xs font-bold text-blue-900">Edit Data Warga</p>
                            <input type="text" value={editNama} onChange={(e) => setEditNama(e.target.value)}
                              placeholder="Nama Lengkap"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-xs text-gray-900 bg-white" />
                            <input type="text" value={editKeterangan} onChange={(e) => setEditKeterangan(e.target.value)}
                              placeholder="Keterangan"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-xs text-gray-900 bg-white" />
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => handleSimpanEdit(w.id)}
                                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 min-h-[40px]">Simpan</button>
                              <button onClick={() => setWargaDiedit(null)}
                                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300 min-h-[40px]">Batal</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-900 text-sm">{w.nama}</h4>
                                <p className="text-xs text-gray-500 italic mt-0.5">{w.keterangan || 'Tanpa keterangan'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => { setWargaDiedit(w.id); setEditNama(w.nama); setEditKeterangan(w.keterangan || ''); }}
                                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition min-h-[36px]"
                              >
                                Edit
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => setConfirmHapusId(w.id)}
                                className="px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition min-h-[36px]"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ── DESKTOP & PRINT TABLE VIEW ── */}
                  <div className="hidden md:block print:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-100 print:bg-gray-100">
                          <th className="p-2.5 print:p-1 w-8 text-center">No</th>
                          <th className="p-2.5 print:p-1">Nama</th>
                          <th className="p-2.5 print:p-1">Keterangan</th>
                          <th className="p-2.5 text-center no-print w-24">Aksi</th>
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
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm sm:text-base font-extrabold text-emerald-900">🎯 {periodeAktif.nama}</p>
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
                    className="w-full sm:w-auto px-3.5 py-2.5 border border-gray-300 rounded-xl text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition font-medium min-h-[44px]">
                    <option value="semua">📍 Semua RT ({distGrup.reduce((s, g) => s + g.warga.length, 0)} Jiwa)</option>
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
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 sm:px-5 py-3 border-b border-gray-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <h3 className="font-bold text-xs sm:text-sm text-emerald-900">RT.{grup.no_rt} — {grup.nama_rt}</h3>
                        <span className="text-xs font-semibold text-emerald-800">{terdistribusi}/{totalRT} ({pctRT}%)</span>
                      </div>
                      <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${pctRT}%` }} />
                      </div>
                    </div>

                    {/* ── MOBILE CHECKLIST CARDS (Designed for Walking in the Field) ── */}
                    <div className="block md:hidden divide-y divide-gray-100 no-print">
                      {grup.warga.map((w, i) => {
                        const sudah = distSudah.has(w.id);
                        const isPending = loadingCentang.has(w.id);
                        return (
                          <div
                            key={w.id}
                            className={`p-3.5 transition-all ${
                              sudah ? 'bg-emerald-50/60' : 'bg-white hover:bg-gray-50/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs transition-colors ${
                                  sudah ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {sudah ? '✓' : (i + 1)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`font-bold text-sm leading-snug break-words ${sudah ? 'text-emerald-900 line-through opacity-80' : 'text-gray-900'}`}>
                                    {w.nama}
                                  </p>
                                  {w.keterangan && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{w.keterangan}</p>
                                  )}
                                </div>
                              </div>

                              {/* Big, thumb-friendly Action Button */}
                              <button
                                onClick={() => handleCentang(w.id)}
                                disabled={isPending}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 shrink-0 min-h-[42px] flex items-center justify-center gap-1.5 ${
                                  isPending
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : sudah
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-red-100 hover:text-red-700'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                }`}
                              >
                                {isPending ? (
                                  'Menyimpan...'
                                ) : sudah ? (
                                  <>
                                    <span className="text-emerald-700">✓ Sudah</span>
                                    <span className="text-[10px] text-gray-400 ml-0.5">(Batal)</span>
                                  </>
                                ) : (
                                  <>
                                    <span>Serahkan</span>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── DESKTOP TABLE VIEW ── */}
                    <div className="hidden md:block overflow-x-auto">
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

      {/* CONFIRMATION MODAL APPROVE USULAN HAPUS */}
      <ConfirmModal
        open={confirmApproveHapus !== null}
        title="Konfirmasi Hapus Mustahiq"
        message={
          confirmApproveHapus
            ? `Apakah Anda yakin ingin menyetujui usulan untuk menghapus "${confirmApproveHapus.nama_baru}" dari daftar mustahiq? Data warga ini akan dihapus secara permanen dari sistem.`
            : ''
        }
        confirmLabel="Ya, Hapus Data Ini"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={async () => {
          if (!confirmApproveHapus) return;
          const target = confirmApproveHapus;
          setConfirmApproveHapus(null);
          await handleApprove(target);
        }}
        onCancel={() => setConfirmApproveHapus(null)}
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
