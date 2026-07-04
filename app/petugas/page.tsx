'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { centangDistribusi } from '@/lib/actions/petugas';
import type { Mustahiq, RTGroup, PengajuanUpdate, PeriodeDistribusi } from '@/lib/types';

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

  // Tab: distribusi
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [distGrup, setDistGrup] = useState<RTGroup[]>([]);
  const [distSudah, setDistSudah] = useState<Set<number>>(new Set());
  const [distFilterRT, setDistFilterRT] = useState('semua');
  const [distDaftarRT, setDistDaftarRT] = useState<{ id: number; no_rt: number; nama_rt: string }[]>([]);

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

  const handleHapus = async (id: number) => {
    if (!confirm('Hapus data warga ini?')) return;
    const { error } = await supabase.from('penerima_zakat').delete().eq('id', id);
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
    if (!periodeAktif) return;
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
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-gray-50 text-gray-800">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Halaman Petugas</h1>
          <p className="text-xs text-gray-500">LAZISNU Desa Badean</p>
        </div>
        <button onClick={handleLogout}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">Logout</button>
      </div>

      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
        {([['mustahiq', '👥 Data Mustahiq'], ['distribusi', '🎯 Distribusi']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              tab === key ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}>{label}</button>
        ))}
      </div>

      {/* === TAB MUSTAHIQ === */}
      {tab === 'mustahiq' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
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

          <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
            <input type="text" placeholder="🔍 Cari mustahiq..." value={kataKunci} onChange={(e) => setKataKunci(e.target.value)}
              className="w-full sm:max-w-xs px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900" />
            <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
              className="w-full sm:w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900">
              <option value="semua">🌐 Semua RT</option>
              {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt}</option>))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-gray-400">Memuat...</div>
          ) : dataTergrup.length === 0 ? (
            <div className="text-center py-8 bg-white border border-gray-200 rounded-xl text-xs text-gray-400">Tidak ada data.</div>
          ) : (
            <div className="space-y-4">
              {dataTergrup.map((grup) => (
                <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-xs text-gray-800">RT.{grup.no_rt} &mdash; {grup.nama_rt}</h3>
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{grup.warga.length} Jiwa</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50/40 text-gray-400 uppercase text-[10px] tracking-wider">
                          <th className="p-2.5 w-10 text-center">No</th><th className="p-2.5">Nama</th>
                          <th className="p-2.5">Keterangan</th><th className="p-2.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {grup.warga.map((w, i) => (
                          <tr key={w.id} className="hover:bg-gray-50/50">
                            <td className="p-2.5 text-center text-gray-400">{i + 1}</td>
                            <td className="p-2.5">
                              {wargaDiedit === w.id ? (
                                <input type="text" value={editNama} onChange={(e) => setEditNama(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded w-full text-xs text-gray-900" />
                              ) : <span className="font-semibold text-gray-900">{w.nama}</span>}
                            </td>
                            <td className="p-2.5">
                              {wargaDiedit === w.id ? (
                                <input type="text" value={editKeterangan} onChange={(e) => setEditKeterangan(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded w-full text-xs text-gray-900" />
                              ) : <span className="text-gray-500">{w.keterangan || '-'}</span>}
                            </td>
                            <td className="p-2.5 text-center">
                              {wargaDiedit === w.id ? (
                                <div className="flex justify-center gap-1">
                                  <button onClick={() => handleSimpanEdit(w.id)}
                                    className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">Simpan</button>
                                  <button onClick={() => setWargaDiedit(null)}
                                    className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded text-[10px] font-medium">Batal</button>
                                </div>
                              ) : (
                                <div className="flex justify-center gap-1.5">
                                  <button onClick={() => { setWargaDiedit(w.id); setEditNama(w.nama); setEditKeterangan(w.keterangan || ''); }}
                                    className="text-emerald-700 hover:text-emerald-900 font-semibold">Ubah</button>
                                  <span className="text-gray-200">|</span>
                                  <button onClick={() => handleHapus(w.id)}
                                    className="text-red-600 hover:text-red-800 font-semibold">Hapus</button>
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
        <div className="space-y-6">
          {!periodeAktif ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <p className="text-xs text-amber-700 font-semibold">⏸️ Belum ada periode distribusi aktif.</p>
              <p className="text-xs text-amber-500 mt-1">Tunggu admin membuka periode baru.</p>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-emerald-800 font-semibold">✅ {periodeAktif.nama}</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    @ {periodeAktif.jumlah_per_jiwa ? `Rp ${Number(periodeAktif.jumlah_per_jiwa).toLocaleString('id-ID')} per jiwa` : 'Nominal belum ditentukan'}
                    {periodeAktif.bentuk !== 'TUNAI' ? ` (${periodeAktif.bentuk})` : ''}
                  </p>
                </div>
                <span className="text-xs text-emerald-700">{distSudah.size} / {distGrup.reduce((s, g) => s + g.warga.length, 0)} sudah</span>
              </div>

              {distDaftarRT.length > 0 && (
                <div className="flex gap-2">
                  <select value={distFilterRT} onChange={(e) => setDistFilterRT(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
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
                return (
                  <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-bold text-xs text-gray-800">RT.{grup.no_rt} &mdash; {grup.nama_rt}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{terdistribusi}/{totalRT}</span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${totalRT > 0 ? (terdistribusi / totalRT) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-gray-50/40 text-gray-400 uppercase text-[10px] tracking-wider">
                            <th className="p-2.5 w-10 text-center">No</th>
                            <th className="p-2.5">Nama</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {grup.warga.map((w, i) => {
                            const sudah = distSudah.has(w.id);
                            return (
                              <tr key={w.id} className={`${sudah ? 'bg-green-50/40' : ''} hover:bg-gray-50/30`}>
                                <td className="p-2.5 text-center text-gray-400">{i + 1}</td>
                                <td className="p-2.5 font-semibold text-gray-900">{w.nama}</td>
                                <td className="p-2.5">
                                  {sudah ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">✅ Sudah</span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-semibold">⏳ Belum</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button onClick={() => handleCentang(w.id)}
                                    className={`px-3 py-1 rounded text-[10px] font-bold transition ${
                                      sudah
                                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    }`}>
                                    {sudah ? 'Batal' : 'Centang'}
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
    </div>
  );
}
