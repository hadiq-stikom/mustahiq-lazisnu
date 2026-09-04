'use client';

import { useState } from 'react';
import Sidebar from '@/components/admin/Sidebar';
import BottomNav from '@/components/admin/BottomNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center gap-3 px-4 h-12">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
              aria-label="Buka menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm font-bold text-gray-900">LAZISNU Badean</h1>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 pb-24 lg:pb-6 overflow-auto">
          {children}
        </main>

        <BottomNav onOpenMenu={() => setSidebarOpen(true)} />
      </div>
    </div>
  );
}

