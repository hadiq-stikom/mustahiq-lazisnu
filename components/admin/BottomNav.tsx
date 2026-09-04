'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BottomNavProps {
  onOpenMenu: () => void;
}

const mainTabs = [
  { href: '/admin', label: 'Dasbor', icon: '📊' },
  { href: '/admin/perencanaan', label: 'Periode', icon: '📋' },
  { href: '/admin/mustahiq', label: 'Mustahiq', icon: '👥' },
  { href: '/admin/transaksi', label: 'Transaksi', icon: '💰' },
];

export default function BottomNav({ onOpenMenu }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi Bawah Ponsel"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 lg:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe"
    >
      <div className="grid grid-cols-5 h-14 items-center px-1">
        {mainTabs.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className={`text-lg transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-bold text-emerald-800' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 bg-emerald-600 rounded-full mt-0.5" />
              )}
            </Link>
          );
        })}

        {/* Menu Lainnya button (opens sidebar drawer) */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1 text-gray-500 hover:text-gray-800 rounded-xl transition-all"
          aria-label="Menu Lengkap"
        >
          <span className="text-lg">☰</span>
          <span className="text-[10px] font-medium tracking-tight text-gray-600">Lainnya</span>
        </button>
      </div>
    </nav>
  );
}
