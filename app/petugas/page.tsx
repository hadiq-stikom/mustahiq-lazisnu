"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

const SEARCH_DEBOUNCE_MS = 300;

interface Usulan {
  id: number;
  penerima_id: number | null;
  nama_baru: string;
  keterangan_baru: string | null;
  status: string;
}

interface Warga {
  id: number;
  no_urut: number;
  nama: string;
  keterangan: string | null;
  rt_id: number;
  daftar_rt: {
    no_rt: number;
    nama_rt: string;
  };
}

interface RTGroup {
  rt_id: number;
  no_rt: number;
  nama_rt: string;
  warga: Warga[];
}

interface RTDropdown {
  id: number;
  no_rt: number;
  nama_rt: string;
}

export default function DasborPetugas() {
  const router = useRouter();
  
  // State manajemen data
  const [dataTergrup, setDataTergrup] = useState<RTGroup[]>([]);
  const [daftarRT, setDaftarRT] = useState<RTDropdown[]>([]);
  const [daftarUsulan, setDaftarUsulan] = useState<Usulan[]>([]);
  
  // State filter kontrol
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState<string>('semua');
  const [loading, setLoading] = useState(true);

  // State tambah data warga baru langsung
  const [formRT, setFormRT] = useState('');
  const [formNoUrut, setFormNoUrut] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');

  // State edit inline data warga lama
  const [wargaDiedit, setWargaDiedit] = useState<number | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');

  // 1. Sinkronisasi Awal: Mengambil daftar wilayah RT dan pengajuan usulan pending
  const muatDataAwal = async () => {
    const { data: rts } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true });
    const { data: usulans } = await supabase.from('pengajuan_update').select('id, penerima_id, nama_baru, keterangan_baru, status').eq('status', 'PENDING');
    
    if (rts) setDaftarRT(rts);
    if (usulans) setDaftarUsulan(usulans);
  };

  useEffect(() => {
    muatDataAwal();
  }, []);

  // 2. Sinkronisasi Utama: Mengambil data mustahiq dengan filter pencarian dan grup RT
  const muatDataWarga = async () => {
    setLoading(true);
    let query = supabase.from('penerima_zakat').select(`id, no_urut, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )`);

    if (kataKunci.trim() !== '') query = query.ilike('nama', `%${kataKunci}%`);
    if (rtTerpilih !== 'semua') query = query.eq('rt_id', parseInt(rtTerpilih));

    const { data, error } = await query.order('rt_id', { ascending: true }).order('no_urut', { ascending: true });

    if (!error && data) {
      const mentah = data as unknown as Warga[];
      const grup: { [key: number]: RTGroup } = {};
      mentah.forEach((w) => {
        if (!w.daftar_rt) return;
        const rId = w.rt_id;
        if (!grup[rId]) {
          grup[rId] = { rt_id: rId, no_rt: w.daftar_rt.no_rt, nama_rt: w.daftar_rt.nama_rt, warga: [] };
        }
        grup[rId].warga.push(w);
      });
      setDataTergrup(Object.values(grup));
    }
    setLoading(false);
  };

  useEffect(() => {
    const penunda = setTimeout(() => { muatDataWarga(); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(penunda);
  }, [kataKunci, rtTerpilih]);

  // 3. OPERASI CRUD: TAMBAH DATA WARGA BARU
  const handleTambahWarga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama || !formNoUrut) return alert('RT, Nomor Urut, dan Nama wajib diisi.');

    const { error } = await supabase.from('penerima_zakat').insert([
      { rt_id: parseInt(formRT), no_urut: parseInt(formNoUrut), nama: formNama, keterangan: formKeterangan || null }
    ]);

    if (!error) {
      setFormNama(''); setFormKeterangan(''); setFormNoUrut('');
      alert('Data warga berhasil didaftarkan!');
      muatDataWarga();
    }
  };

  // 4. OPERASI CRUD: SIMPAN EDIT DATA WARGA
  const handleSimpanEdit = async (idWarga: number) => {
    const { error } = await supabase.from('penerima_zakat').update({ nama: editNama, keterangan: editKeterangan || null }).eq('id', idWarga);
    if (!error) { setWargaDiedit(null); muatDataWarga(); }
  };

  // 5. OPERASI CRUD: HAPUS DATA WARGA
  const handleHapusWarga = async (idWarga: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data warga ini secara permanen?')) return;
    const { error } = await supabase.from('penerima_zakat').delete().eq('id', idWarga);
    if (!error) muatDataWarga();
  };

  // 6. VERIFIKASI USULAN: APPROVE & REJECT
  const handleApprove = async (u: Usulan) => {
    if (u.penerima_id) {
      await supabase.from('penerima_zakat').update({ nama: u.nama_baru, keterangan: u.keterangan_baru }).eq('id', u.penerima_id);
    }
    await supabase.from('pengajuan_update').update({ status: 'DISETUJUI' }).eq('id', u.id);
    muatDataAwal(); muatDataWarga();
  };

  const handleReject = async (idUsulan: number) => {
    await supabase.from('pengajuan_update').update({ status: 'DITOLAK' }) .eq('id', idUsulan);
    muatDataAwal();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    router.push('/login');
  };
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-gray-50 text-gray-800">
      
      {/* NAVBAR ATAS */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Halaman Kerja Petugas</h1>
          <p className="text-xs text-gray-500">LAZISNU Desa Badean (Mode Pengelolaan CRUD)</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
        >
          Keluar (Logout)
        </button>
      </div>

      <div className="space-y-8">
        
        {/* FORMULIR: TAMBAH WARGA BARU LANGSUNG */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
            <span>➕</span> Daftarkan Warga Penerima Baru (Data Mandiri)
          </h2>
          <form onSubmit={handleTambahWarga} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">Wilayah RT</label>
              <select
                required
                value={formRT}
                onChange={(e) => setFormRT(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900"
              >
                <option value="">-- Pilih RT --</option>
                {daftarRT.map((rt) => (
                  <option key={rt.id} value={rt.id}>RT.{rt.no_rt} {rt.nama_rt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">No Urut RT</label>
              <input
                type="number"
                required
                placeholder="Contoh: 23"
                value={formNoUrut}
                onChange={(e) => setFormNoUrut(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                placeholder="Nama warga"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">Keterangan (Opsional)</label>
              <input
                type="text"
                placeholder="Misal: P.Hasan"
                value={formKeterangan}
                onChange={(e) => setFormKeterangan(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
              >
                Simpan Data
              </button>
            </div>
          </form>
        </div>

        {/* NOTIFIKASI: ANTRIAN USULAN WARGA PENDING */}
        {daftarUsulan.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-amber-800 font-bold text-xs mb-2 flex items-center gap-1">
              <span>⚠️</span> Ada {daftarUsulan.length} Usulan Masuk dari Warga (Belum Diverifikasi)
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {daftarUsulan.map((u) => (
                <div key={u.id} className="bg-white border border-amber-100 p-2.5 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <span className="text-emerald-700 font-bold">{u.nama_baru}</span>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="text-gray-500 italic">{u.keterangan_baru || 'Tanpa keterangan'}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleApprove(u)} className="px-2 py-0.5 bg-emerald-600 text-white rounded font-semibold text-[10px]">Terima</button>
                    <button onClick={() => handleReject(u.id)} className="px-2 py-0.5 bg-gray-400 text-white rounded font-semibold text-[10px]">Tolak</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* CONTROLS: BAR PENCARIAN DAN DROPDOWN FILTER RT */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="🔍 Cari nama mustahiq..."
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={rtTerpilih}
              onChange={(e) => setRtTerpilih(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="semua">🌐 Semua RT (Keseluruhan)</option>
              {daftarRT.map((rt) => (
                <option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt} {rt.nama_rt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* MAIN DATA: TABEL YANG DIKELOMPOKKAN PER RT */}
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-xs">Menyelaraskan data...</div>
        ) : dataTergrup.length === 0 ? (
          <div className="text-center py-8 bg-white border border-gray-200 rounded-xl text-gray-400 text-xs shadow-sm">
            Tidak ada data warga yang cocok.
          </div>
        ) : (
          <div className="space-y-6">
            {dataTergrup.map((grup) => (
              <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                
                {/* Header RT */}
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center text-xs">
                  <h3 className="font-bold text-gray-800">
                    RT.{grup.no_rt} &mdash; KETUA: {grup.nama_rt}
                  </h3>
                  <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                    {grup.warga.length} Jiwa
                  </span>
                </div>

                {/* Baris Daftar Warga */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50/40 text-gray-400 border-b border-gray-100 uppercase text-[10px] tracking-wider">
                        <th className="p-2.5 w-12 text-center">No</th>
                        <th className="p-2.5 w-1/3">Nama Lengkap</th>
                        <th className="p-2.5 w-1/3">Keterangan</th>
                        <th className="p-2.5 text-center">Manajemen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grup.warga.map((w , i) => (
                        <tr key={w.id} className="hover:bg-gray-50/50 transition">
                          <td className="p-2.5 text-center font-medium text-gray-400">{i + 1}</td>
                          
                          {/* SUNTING INLINE: NAMA */}
                          <td className="p-2.5">
                            {wargaDiedit === w.id ? (
                              <input
                                type="text"
                                value={editNama}
                                onChange={(e) => setEditNama(e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded w-full text-gray-900 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                            ) : (
                              <span className="font-semibold text-gray-900">{w.nama}</span>
                            )}
                          </td>

                          {/* SUNTING INLINE: KETERANGAN */}
                          <td className="p-2.5">
                            {wargaDiedit === w.id ? (
                              <input
                                type="text"
                                value={editKeterangan}
                                onChange={(e) => setEditKeterangan(e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded w-full text-gray-900 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                            ) : (
                              <span className="text-gray-500">{w.keterangan || '-'}</span>
                            )}
                          </td>

                          {/* KONTROL EDIT & HAPUS */}
                          <td className="p-2.5 text-center">
                            {wargaDiedit === w.id ? (
                              <div className="flex justify-center gap-1">
                                <button onClick={() => handleSimpanEdit(w.id)} className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">Simpan</button>
                                <button onClick={() => setWargaDiedit(null)} className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded text-[10px] font-medium">Batal</button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setWargaDiedit(w.id);
                                    setEditNama(w.nama);
                                    setEditKeterangan(w.keterangan || '');
                                  }}
                                  className="text-emerald-700 hover:text-emerald-900 font-semibold"
                                >
                                  Ubah
                                </button>
                                <span className="text-gray-200">|</span>
                                <button
                                  onClick={() => handleHapusWarga(w.id)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
                                >
                                  Hapus
                                </button>
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
    </div>
  );
}
