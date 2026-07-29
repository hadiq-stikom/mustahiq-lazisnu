'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import type { Mustahiq, RTGroup } from '@/lib/types';
import PrintHeader from '@/components/PrintHeader';
import ConfirmModal from '@/components/ConfirmModal';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 5; // 5 RT groups per page

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

  const [confirmHapusId, setConfirmHapusId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadRT = async () => {
      const { data: rts } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true });
      if (rts) setDaftarRT(rts);
    };
    loadRT();
  }, []);

  const loadMustahiq = async () => {
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
      setPage(1);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(loadMustahiq, 300);
    return () => clearTimeout(t);
  }, [kataKunci, rtTerpilih]);

  const handleTambah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama) return alert('RT dan Nama wajib diisi.');
    const { error } = await supabase.from('penerima_zakat').insert([{ rt_id: parseInt(formRT), nama: formNama, keterangan: formKeterangan || null }]);
    if (!error) {
      setFormNama(''); setFormKeterangan(''); setFormRT('');
      loadMustahiq();
    }
  };

  const handleSimpanEdit = async (id: number) => {
    const { error } = await supabase.from('penerima_zakat').update({ nama: editNama, keterangan: editKeterangan || null }).eq('id', id);
    if (!error) {
      setWargaDiedit(null);
      loadMustahiq();
    }
  };

  const handleHapusKonfirmasi = async () => {
    if (!confirmHapusId) return;
    const { error } = await supabase.from('penerima_zakat').delete().eq('id', confirmHapusId);
    setConfirmHapusId(null);
    if (!error) loadMustahiq();
  };

  const totalMustahiqJiwa = dataTergrup.reduce((sum, g) => sum + g.warga.length, 0);

  // Pagination for RT groups
  const totalPages = Math.ceil(dataTergrup.length / PAGE_SIZE);
  const paginatedGrup = dataTergrup.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* KOP SURAT UNTUK PRINT */}
      <PrintHeader
        title="Daftar Penerima Zakat Mal (Mustahiq)"
        subtitle={`Total Mustahiq: ${totalMustahiqJiwa} Jiwa — Desa Badean`}
      />

      {/* HEADER UTAMA */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">👥 Data Mustahiq</h1>
          <p className="text-xs text-gray-500 mt-0.5">Kelola daftar warga penerima zakat mal Desa Badean</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.562 0-1.056-.419-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.1 48.1 0 0110.56 0m-10.56 0V3.375c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.656" />
          </svg>
          Cetak PDF / Print
        </button>
      </div>

      {/* FORM TAMBAH MUSTAHIQ */}
      <form onSubmit={handleTambah} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3 no-print">
        <h2 className="text-sm font-bold text-gray-900">➕ Daftarkan Mustahiq Baru</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">RT</label>
            <select required value={formRT} onChange={(e) => setFormRT(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition">
              <option value="">— Pilih RT —</option>
              {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt} — {rt.nama_rt}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Nama Lengkap</label>
            <input type="text" required placeholder="Contoh: Ahmad" value={formNama} onChange={(e) => setFormNama(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">Keterangan (opsional)</label>
            <input type="text" placeholder="Catatan kondisi" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
          </div>
          <button type="submit" className="py-2 px-5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm transition active:scale-95">
            Simpan Data
          </button>
        </div>
      </form>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-sm no-print">
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input type="text" placeholder="Cari nama mustahiq..." value={kataKunci} onChange={(e) => setKataKunci(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
        </div>
        <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
          className="sm:w-56 px-3 py-2 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition">
          <option value="semua">🌐 Semua RT ({totalMustahiqJiwa} Jiwa)</option>
          {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt} — {rt.nama_rt}</option>))}
        </select>
      </div>

      {/* DATA TABLE */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="skeleton h-4 w-28 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3].map(j => <div key={j} className="skeleton h-3 w-full" />)}
              </div>
            </div>
          ))}
        </div>
      ) : dataTergrup.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl text-xs text-gray-400">
          <p className="text-3xl mb-2">🔍</p>
          Data mustahiq tidak ditemukan.
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in print:block print:columns-2 print:gap-3 print:space-y-3">
          {paginatedGrup.map((grup) => (
            <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden print-avoid-break print:mb-3 print:border-gray-300 print:shadow-none">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center print-header-keep print:py-1.5 print:bg-emerald-50">
                <h3 className="font-bold text-sm text-emerald-900">RT.{grup.no_rt} &mdash; {grup.nama_rt}</h3>
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{grup.warga.length} Jiwa</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-100">
                      <th className="p-3 w-10 text-center">No</th>
                      <th className="p-3">Nama Lengkap</th>
                      <th className="p-3">Keterangan</th>
                      <th className="p-3 text-center no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {grup.warga.map((w, i) => (
                      <tr key={w.id} className="hover:bg-gray-50 transition">
                        <td className="p-3 text-center text-gray-400 font-medium">{i + 1}</td>
                        <td className="p-3">
                          {wargaDiedit === w.id ? (
                            <input type="text" value={editNama} onChange={(e) => setEditNama(e.target.value)}
                              className="px-2 py-1.5 border border-gray-300 rounded-lg w-full text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          ) : <span className="font-semibold text-gray-900">{w.nama}</span>}
                        </td>
                        <td className="p-3">
                          {wargaDiedit === w.id ? (
                            <input type="text" value={editKeterangan} onChange={(e) => setEditKeterangan(e.target.value)}
                              className="px-2 py-1.5 border border-gray-300 rounded-lg w-full text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          ) : <span className="text-gray-500 italic">{w.keterangan || '—'}</span>}
                        </td>
                        <td className="p-3 text-center no-print">
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

          {/* PAGINATION */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={dataTergrup.length}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* CONFIRMATION MODAL HAPUS */}
      <ConfirmModal
        open={confirmHapusId !== null}
        title="Hapus Data Mustahiq"
        message="Apakah Anda yakin ingin menghapus data warga ini dari daftar penerima zakat?"
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
