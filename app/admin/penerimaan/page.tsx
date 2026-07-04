'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { hapusPenerimaan } from '@/lib/actions/admin';
import { formatRupiah, formatTanggalSingkat } from '@/lib/utils';
import type { Penerimaan } from '@/lib/types';

export default function AdminPenerimaanPage() {
  const [data, setData] = useState<Penerimaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: d } = await supabase.from('penerimaan').select('*').order('created_at', { ascending: false });
      if (d) setData(d);
      setLoading(false);
    };
    load();
  }, []);

  const handleHapus = async (id: number) => {
    if (!confirm('Hapus penerimaan ini?')) return;
    try {
      await hapusPenerimaan(id);
      setData(data.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal');
    }
  };

  const total = data.reduce((s, r) => s + r.jumlah, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Riwayat Penerimaan</h1>
      <p className="text-xs text-gray-500">Data penerimaan dana dari bendahara. Hanya bisa dihapus oleh admin.</p>

      {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-900">Riwayat Penerimaan</span>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
            Total: {formatRupiah(total)}
          </span>
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-gray-400">Memuat...</div>
        ) : data.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">Belum ada data penerimaan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                  <th className="p-3">Tanggal</th><th className="p-3">Sumber</th><th className="p-3">Muzakki</th>
                  <th className="p-3 text-right">Jumlah</th><th className="p-3">Keterangan</th><th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-900">{formatTanggalSingkat(r.tanggal)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.sumber === 'ZAKAT_MAL' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>{r.sumber === 'ZAKAT_MAL' ? 'Zakat' : 'Sedekah'}</span>
                    </td>
                    <td className="p-3 text-gray-700">{r.muzakki || '-'}</td>
                    <td className="p-3 text-right font-semibold text-gray-900">{formatRupiah(r.jumlah)}</td>
                    <td className="p-3 text-gray-500 italic">{r.keterangan || '-'}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleHapus(r.id)}
                        className="text-red-600 hover:text-red-800 text-[10px] font-semibold">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
