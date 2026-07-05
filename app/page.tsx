'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { formatRupiah } from '@/lib/utils';
import type { PeriodeDistribusi } from '@/lib/types';

const SEARCH_DEBOUNCE_MS = 300;

interface Warga {
  id: number;
  nama: string;
  keterangan: string | null;
  rt_id: number;
  daftar_rt: { no_rt: number; nama_rt: string };
}

interface RTGroup {
  rt_id: number;
  no_rt: number;
  nama_rt: string;
  warga: Warga[];
}

export default function HalamanUtama() {
  const [dataTergrup, setDataTergrup] = useState<RTGroup[]>([]);
  const [daftarRT, setDaftarRT] = useState<{ id: number; no_rt: number; nama_rt: string }[]>([]);
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState('semua');
  const [loading, setLoading] = useState(true);

  const [bukaModal, setBukaModal] = useState(false);
  const [formRT, setFormRT] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [pesanSukses, setPesanSukses] = useState('');

  // Transparansi
  const [totalPenerimaan, setTotalPenerimaan] = useState(0);
  const [periodeAktif, setPeriodeAktif] = useState<PeriodeDistribusi | null>(null);
  const [distribusiPeriode, setDistribusiPeriode] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadSaldo = async () => {
      const { data: p } = await supabase.from('penerimaan').select('jumlah');
      if (p) setTotalPenerimaan(p.reduce((s, r) => s + (r.jumlah || 0), 0));
    };
    loadSaldo();
  }, []);

  useEffect(() => {
    const loadPeriode = async () => {
      const { data } = await supabase.from('periode_distribusi').select('*').eq('status', 'AKTIF').single();
      if (data) {
        setPeriodeAktif(data);
        const { data: dists } = await supabase.from('distribusi').select('mustahiq_id').eq('periode_id', data.id);
        if (dists) setDistribusiPeriode(new Set(dists.map((d) => d.mustahiq_id)));
      }
    };
    loadPeriode();
  }, []);

  useEffect(() => {
    const ambilDaftarRT = async () => {
      const { data } = await supabase.from('daftar_rt').select('id, no_rt, nama_rt').order('no_rt', { ascending: true });
      if (data) setDaftarRT(data);
    };
    ambilDaftarRT();
  }, []);

  useEffect(() => {
    const ambilDataWarga = async () => {
      setLoading(true);
      let query = supabase.from('penerima_zakat').select('id, nama, keterangan, rt_id, daftar_rt ( no_rt, nama_rt )');
      if (kataKunci.trim()) query = query.ilike('nama', `%${kataKunci}%`);
      if (rtTerpilih !== 'semua') query = query.eq('rt_id', parseInt(rtTerpilih));
      const { data, error } = await query.order('rt_id', { ascending: true });
      if (!error && data) {
        const mentah = data as unknown as Warga[];
        const grup: { [key: number]: RTGroup } = {};
        mentah.forEach((w) => {
          if (!w.daftar_rt) return;
          if (!grup[w.rt_id]) grup[w.rt_id] = { rt_id: w.rt_id, no_rt: w.daftar_rt.no_rt, nama_rt: w.daftar_rt.nama_rt, warga: [] };
          grup[w.rt_id].warga.push(w);
        });
        setDataTergrup(Object.values(grup));
      }
      setLoading(false);
    };
    const penunda = setTimeout(ambilDataWarga, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(penunda);
  }, [kataKunci, rtTerpilih]);

  const kirimUsulanBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama) return alert('RT dan Nama wajib diisi.');
    const { error } = await supabase.from('pengajuan_update').insert([
      { penerima_id: null, nama_baru: formNama, keterangan_baru: `[USULAN BARU - RT ID: ${formRT}] ${formKeterangan}`.trim(), status: 'PENDING' }
    ]);
    if (!error) {
      setPesanSukses('Data warga baru berhasil diusulkan! Petugas akan segera memverifikasi.');
      setFormNama(''); setFormKeterangan(''); setFormRT('');
      setTimeout(() => { setBukaModal(false); setPesanSukses(''); }, 3500);
    } else alert('Gagal mengirimkan usulan.');
  };

  const totalJiwa = dataTergrup.reduce((t, g) => t + g.warga.length, 0);
  const resumePerRT = dataTergrup.map((grup) => ({
    ...grup,
    sudahTerima: grup.warga.filter((w) => distribusiPeriode.has(w.id)).length,
    belumTerima: grup.warga.filter((w) => !distribusiPeriode.has(w.id)).length,
  }));

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 min-h-screen bg-gray-50 text-gray-800">
      {/* HEADER */}
      <div className="text-center mb-6 bg-linear-to-r from-emerald-800 to-emerald-700 text-white p-6 rounded-2xl shadow-md">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide">LAZISNU DESA BADEAN</h1>
        <p className="text-emerald-100 text-sm mt-1 font-medium">Sistem Informasi Transparansi Penerima Zakat Mal</p>
      </div>

      {/* SALDO & TOTAL MUSTAHIQ */}
      <div className="mb-6">
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">💰 Saldo</p>
          <p className="text-lg font-bold text-emerald-700">{formatRupiah(totalPenerimaan)}</p>
        </div>
        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-sm font-bold text-emerald-800">📊 Total Mustahiq Terdata: {totalJiwa} Jiwa</p>
        </div>
      </div>

      {/* PERIODE & RESUME PER RT */}
      {periodeAktif && (
        <div className="mb-6 bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-blue-600 font-bold text-sm">📅 Periode: {periodeAktif.nama}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{new Date(periodeAktif.tanggal_buka).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50/70 text-gray-500 border-b border-gray-100 uppercase font-semibold text-[11px] tracking-wider">
                  <th className="p-2">RT</th>
                  <th className="p-2 text-center">Total Jiwa</th>
                  <th className="p-2 text-center text-green-600">Sudah Terima</th>
                  <th className="p-2 text-center text-red-500">Belum Terima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resumePerRT.map((grup) => (
                  <tr key={grup.rt_id} className="hover:bg-gray-50/50 transition">
                    <td className="p-2 font-semibold text-gray-900">RT.{grup.no_rt} {grup.nama_rt}</td>
                    <td className="p-2 text-center font-medium text-gray-500">{grup.warga.length}</td>
                    <td className="p-2 text-center font-semibold text-green-600">{grup.sudahTerima}</td>
                    <td className="p-2 text-center font-semibold text-red-500">{grup.belumTerima}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-6">
        <button onClick={() => setBukaModal(true)}
          className="w-full px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition flex items-center justify-center gap-1.5">
          ➕ Usulkan Warga Baru
        </button>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center justify-between">
        <div className="flex-1">
          <input type="text" placeholder="🔍 Cari nama mustahiq..." value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900" />
        </div>
        <div className="w-full md:w-56">
          <select value={rtTerpilih} onChange={(e) => setRtTerpilih(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 font-medium">
            <option value="semua">🌐 Semua RT</option>
            {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>📍 RT.{rt.no_rt} {rt.nama_rt}</option>))}
          </select>
        </div>
      </div>

      {/* DATA MUSTAHIQ */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Memuat data...</div>
      ) : dataTergrup.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl text-gray-500 text-sm shadow-sm">Data tidak ditemukan.</div>
      ) : (
        <div className="space-y-6">
          {dataTergrup.map((grup) => (
            <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-emerald-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-emerald-900 font-bold text-sm flex items-center gap-2">
                  <span className="w-2 h-4 bg-emerald-600 rounded-sm inline-block"></span>
                  RT.{grup.no_rt} &mdash; {grup.nama_rt}
                </h3>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">{grup.warga.length} Jiwa</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50/70 text-gray-500 border-b border-gray-100 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="p-3 w-16 text-center">No Urut</th>
                      <th className="p-3">Nama Lengkap</th>
                      <th className="p-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grup.warga.map((w, i) => (
                      <tr key={w.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-3 text-center font-medium text-gray-400">{i + 1}</td>
                        <td className="p-3 text-gray-900 font-semibold">{w.nama}</td>
                        <td className="p-3 text-gray-500 italic">{w.keterangan || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL USULAN */}
      {bukaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Usulkan Penerima Zakat Baru</h2>
            <p className="text-xs text-gray-500 mb-4">Rekomendasikan warga Desa Badean yang berhak tetapi belum terdata.</p>
            {pesanSukses ? (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-xs border border-green-200 font-medium">{pesanSukses}</div>
            ) : (
              <form onSubmit={kirimUsulanBaru} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Wilayah RT</label>
                  <select required value={formRT} onChange={(e) => setFormRT(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900">
                    <option value="">-- Pilih RT --</option>
                    {daftarRT.map((rt) => (<option key={rt.id} value={rt.id}>RT.{rt.no_rt} {rt.nama_rt}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Nama Lengkap</label>
                  <input type="text" required placeholder="Contoh: Ahmad Sulaiman" value={formNama} onChange={(e) => setFormNama(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Alasan / Keterangan</label>
                  <textarea placeholder="Contoh: Lansia sebatang kara" value={formKeterangan} onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setBukaModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Batal</button>
                  <button type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition">Kirim Usulan</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
