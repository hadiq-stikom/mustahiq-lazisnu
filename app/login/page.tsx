"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function HalamanLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [pesanError, setPesanError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setPesanError('');

        // 1. Kirim permintaan autentikasi ke Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setPesanError(error.message === 'Invalid login credentials'
                ? 'Email atau password salah.'
                : error.message
            );
            setLoading(false);
            return;
        }

        // 🔥 PERBAIKAN UTAMA: Paksa tulis token ke Cookie Browser agar terbaca oleh proxy.ts
        const session = data.session;
        if (session) {
            document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax; Secure`;
        }

        // 2. Dapatkan metadata peran (role) akun tersebut
        const role = data.user?.user_metadata?.role;

        // 3. Alihkan halaman tujuan secara otomatis berdasarkan hak akses role
        if (role === 'admin') {
            router.push('/admin');
        } else if (role === 'petugas') {
            router.push('/petugas');
        } else {
            await supabase.auth.signOut();
            setPesanError('Akun Anda tidak memiliki hak akses sistem.');
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-md p-6 md:p-8">

                {/* Judul Form */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-emerald-800">Masuk Sistem LAZISNU</h2>
                    <p className="text-gray-500 text-xs mt-1">Khusus untuk Petugas Lapangan & Admin Desa</p>
                </div>

                {/* Notifikasi Error */}
                {pesanError && (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs mb-4 font-medium">
                        {pesanError}
                    </div>
                )}

                {/* Form Login */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Alamat Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@email.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Kata Sandi (Password)</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:bg-emerald-400"
                    >
                        {loading ? 'Memverifikasi...' : 'Masuk Akun'}
                    </button>
                </form>

                {/* Tombol Kembali ke Beranda Publik */}
                <div className="text-center mt-6">
                    <button
                        onClick={() => router.push('/')}
                        className="text-xs text-gray-500 hover:text-emerald-700 font-medium transition"
                    >
                        ← Kembali ke Halaman Utama Warga
                    </button>
                </div>

            </div>
        </div>
    );
}
