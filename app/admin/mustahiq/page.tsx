'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import type { Mustahiq, RTGroup } from '@/lib/types';

export default function AdminMustahiqPage() {
  const [dataTergrup, setDataTergrup] = useState<RTGroup[]>([]);
  const [daftarRT, setDaftarRT] = useState<{ id: number; no_rt: number; nama_rt: string }[]>([]);
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState('semua');
  const [loading, setLoading] = useState(true);

  const [formRT, setFormRT] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [wargaDiedit, setWargaDiedit] = useState<number | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKeterangan, setEditKeterangan] = useState('');

  useEffect(() => {
    const loadRT = async () => {
      const { data: rts } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true });
      if (rts) setDaftarRT(rts);
    };
    loadRT();
  }, []);

  useEffect(() => {
    const load = async () => {
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
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [kataKunci, rtTerpilih]);

  const handleTambah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama) return alert('RT dan Nama wajib.');
    const { error } = await supabase.from('penerima_zakat').insert([{ rt_id: parseInt(formRT), nama: formNama, keterangan: formKeterangan || null }]);
    if (!error) { setFormNama(''); setFormKeterangan(''); setFormRT(''); window.location.reload(); }
  };

  const handleSimpanEdit = async (id: number) => {
    const { error } = await supabase.from('penerima_zakat').update({ nama: editNama, keterangan: editKeterangan || null }).eq('id', id);
    if (!error) { setWargaDiedit(null); window.location.reload(); }
  };

  const handleHapus = async (id: number) => {
    if (!confirm('Hapus data ini?')) return;
    const { error } = await supabase.from('penerima_zakat').delete().eq('id', id);
    if (!error) window.location.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Data Mustahiq</h1>

      <form onSubmit={handleTambah} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <h2 className="text-xs font-bold text-gray-900 mb-3">➕ Tambah Mustahiq Baru</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <select required value={formRT} onChange={(e) => setFormRT(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900">
            <option value="">-- RT --</option>
            {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt}</option>))}
          </select>
          <input type="text" required placeholder="Nama" value={formNama} onChange={(e) => setFormNama(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
          <input type="text" placeholder="Keterangan" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900" />
          <button type="submit" className="py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Simpan</button>
        </div>
      </form>

      <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
        <input type="text" placeholder="🔍 Cari..." value={kataKunci} onChange={(e) => setKataKunci(e.target.value)}
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
  );
}
