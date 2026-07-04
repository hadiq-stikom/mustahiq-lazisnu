'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useEffect } from 'react';

const menu = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/perencanaan', label: 'Periode Distribusi', icon: '📋' },
  { href: '/admin/mustahiq', label: 'Data Mustahiq', icon: '👥' },
  { href: '/admin/transaksi', label: 'Transaksi', icon: '💰' },
  { href: '/admin/distribusi', label: 'Riwayat Distribusi', icon: '🎯' },
  { href: '/admin/laporan-saldo', label: 'Laporan Saldo', icon: '💳' },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    onClose();
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    router.push('/login');
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-emerald-900 text-white flex flex-col shrink-0
          transform transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-5 border-b border-emerald-800">
          <div>
            <h2 className="font-bold text-sm">LAZISNU Badean</h2>
            <p className="text-emerald-300 text-[10px] mt-0.5">Panel Admin</p>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {menu.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-emerald-700 text-white font-semibold'
                    : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-emerald-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-emerald-200 hover:bg-emerald-800 hover:text-white transition"
          >
            🚪 Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
