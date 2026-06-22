"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

const SEARCH_DEBOUNCE_MS = 300;

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

export default function HalamanUtama() {
  const [dataTergrup, setDataTergrup] = useState<RTGroup[]>([]);
  const [daftarRT, setDaftarRT] = useState<RTDropdown[]>([]);
  const [kataKunci, setKataKunci] = useState('');
  const [rtTerpilih, setRtTerpilih] = useState<string>('semua'); // 'semua' atau ID RT spesifik
  const [loading, setLoading] = useState(true);

  // State untuk Modal Pengajuan Data Baru
  const [bukaModal, setBukaModal] = useState(false);
  const [formRT, setFormRT] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [pesanSukses, setPesanSukses] = useState('');

  // 1. Memuat daftar RT untuk filter dropdown dan form pengajuan
  useEffect(() => {
    const ambilDaftarRT = async () => {
      const { data } = await supabase
        .from('daftar_rt')
        .select('id, no_rt, nama_rt')
        .order('no_rt', { ascending: true });
      if (data) setDaftarRT(data);
    };
    ambilDaftarRT();
  }, []);

  // 2. Memuat data warga berdasarkan kata kunci pencarian DAN filter RT terpilih
  useEffect(() => {
    const ambilDataWarga = async () => {
      setLoading(true);
      let query = supabase
        .from('penerima_zakat')
        .select(`
          id, no_urut, nama, keterangan, rt_id,
          daftar_rt ( no_rt, nama_rt )
        `);

      // Filter berdasarkan nama jika kotak pencarian diisi
      if (kataKunci.trim() !== '') {
        query = query.ilike('nama', `%${kataKunci}%`);
      }

      // Filter berdasarkan RT jika pengguna memilih RT tertentu (bukan 'semua')
      if (rtTerpilih !== 'semua') {
        query = query.eq('rt_id', parseInt(rtTerpilih));
      }

      const { data, error } = await query
        .order('rt_id', { ascending: true })
        .order('no_urut', { ascending: true });

      if (!error && data) {
        const mentah = data as unknown as Warga[];
        
        // Logika mengelompokkan data warga per blok RT
        const grup: { [key: number]: RTGroup } = {};
        mentah.forEach((w) => {
          if (!w.daftar_rt) return;
          const rId = w.rt_id;
          if (!grup[rId]) {
            grup[rId] = {
              rt_id: rId,
              no_rt: w.daftar_rt.no_rt,
              nama_rt: w.daftar_rt.nama_rt,
              warga: [],
            };
          }
          grup[rId].warga.push(w);
        });

        setDataTergrup(Object.values(grup));
      }
      setLoading(false);
    };

    const penunda = setTimeout(() => {
      ambilDataWarga();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(penunda);
  }, [kataKunci, rtTerpilih]);

  // 3. Fungsi mengirim data usulan warga baru
  const kirimUsulanBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRT || !formNama) return alert('RT dan Nama wajib diisi.');

    const { error } = await supabase
      .from('pengajuan_update')
      .insert([
        {
          penerima_id: null, 
          nama_baru: formNama,
          keterangan_baru: `[USULAN BARU - RT ID: ${formRT}] ${formKeterangan}`.trim(),
          status: 'PENDING'
        }
      ]);

    if (!error) {
      setPesanSukses('Data warga baru berhasil diusulkan! Petugas akan segera memverifikasi.');
      setFormNama('');
      setFormKeterangan('');
      setFormRT('');
      setTimeout(() => {
        setBukaModal(false);
        setPesanSukses('');
      }, 3500);
    } else {
      alert('Gagal mengirimkan usulan.');
    }
  };
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 min-h-screen bg-gray-50 text-gray-800">
      {/* KEPALA APLIKASI */}
      <div className="text-center mb-8 bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-6 rounded-2xl shadow-md">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide">LAZISNU DESA BADEAN</h1>
        <p className="text-emerald-100 text-sm mt-1.5 font-medium">Sistem Informasi Transparansi Penerima Zakat Mal</p>
      </div>

      {/* BAR ALAT: CARI, FILTER RT, & TOMBOL USULAN */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center justify-between">
        
        {/* Kolom Cari Nama */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="🔍 Cari nama mustahiq..."
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900"
          />
        </div>

        {/* Dropdown Filter Tampilkan per RT / Keseluruhan */}
        <div className="w-full md:w-56">
          <select
            value={rtTerpilih}
            onChange={(e) => setRtTerpilih(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 font-medium"
          >
            <option value="semua">🌐 Semua RT (Keseluruhan)</option>
            {daftarRT.map((rt) => (
              <option key={rt.id} value={rt.id}>
                📍 RT.{rt.no_rt} {rt.nama_rt}
              </option>
            ))}
          </select>
        </div>

        {/* Tombol Ajukan Warga Baru */}
        <button
          onClick={() => setBukaModal(true)}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition flex items-center justify-center gap-1.5"
        >
          <span>➕</span> Usulkan Warga Baru
        </button>
      </div>

      {/* DAFTAR MUSTAHIQ BERDASARKAN RT */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Menyelaraskan data warga...</div>
      ) : dataTergrup.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl text-gray-500 text-sm shadow-sm">
          Data tidak ditemukan untuk pencarian atau RT tersebut.
        </div>
      ) : (
        <div className="space-y-6">
          {dataTergrup.map((grup) => (
            <div key={grup.rt_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              
              {/* HEADER GRUP RT */}
              <div className="bg-emerald-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-emerald-900 font-bold text-sm md:text-base flex items-center gap-2">
                  <span className="w-2 h-4 bg-emerald-600 rounded-sm inline-block"></span>
                  RT.{grup.no_rt} &mdash; KETUA: {grup.nama_rt}
                </h3>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                  {grup.warga.length} Jiwa
                </span>
              </div>

              {/* TABEL WARGA DI DALAM RT */}
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
                    {grup.warga.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-3 text-center font-medium text-gray-400">{w.no_urut}</td>
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

      {/* JENDELA POP-UP: FORMULIR AJUKAN WARGA BARU */}
      {bukaModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Usulkan Penerima Zakat Baru</h2>
            <p className="text-xs text-gray-500 mb-4">
              Silakan isi formulir untuk merekomendasikan warga Desa Badean yang berhak tetapi belum terdata.
            </p>

            {pesanSukses ? (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-xs border border-green-200 font-medium">
                {pesanSukses}
              </div>
            ) : (
              <form onSubmit={kirimUsulanBaru} className="space-y-4">
                {/* PILIHAN WILAYAH RT */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Wilayah RT Tempat Tinggal</label>
                  <select
                    required
                    value={formRT}
                    onChange={(e) => setFormRT(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                  >
                    <option value="">-- Pilih Wilayah RT --</option>
                    {daftarRT.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        RT.{rt.no_rt} {rt.nama_rt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* INPUT NAMA */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Nama Lengkap Warga</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Sulaiman"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                  />
                </div>

                {/* INPUT KETERANGAN */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Alasan / Keterangan Tambahan</label>
                  <textarea
                    placeholder="Contoh: Lansia sebatang kara / buruh serabutan"
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                  />
                </div>

                {/* BUTTON AKSI */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBukaModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm transition"
                  >
                    Kirim Usulan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
