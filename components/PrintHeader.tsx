'use client';

export default function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="hidden print:block mb-6 border-b-2 border-emerald-800 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo2.png" alt="Logo LAZISNU" className="h-16 w-auto object-contain shrink-0" />
          <div>
            <h1 className="text-xl font-black text-emerald-950 tracking-tight">LAZISNU DESA BADEAN</h1>
            <p className="text-xs text-gray-600 font-medium">Lembaga Amil Zakat, Infak, dan Sedekah Nahdlatul Ulama</p>
            <p className="text-[10px] text-gray-400">Desa Badean, Kab. Banyuwangi — Jawa Timur</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-800">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="text-[10px] text-gray-500">Dokumen Resmi Sistem Zakat</p>
        </div>
      </div>
      <div className="mt-4 pt-2 border-t border-emerald-100 flex justify-between items-end">
        <div>
          <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
