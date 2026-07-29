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
    const [showPass, setShowPass] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setPesanError('');

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setPesanError(error.message === 'Invalid login credentials'
                ? 'Email atau password salah.'
                : error.message
            );
            setLoading(false);
            return;
        }

        const role = data.user?.user_metadata?.role;

        if (role === 'admin') {
            router.push('/admin');
        } else if (role === 'petugas') {
            router.push('/petugas');
        } else if (role === 'bendahara') {
            router.push('/bendahara');
        } else {
            await supabase.auth.signOut();
            setPesanError('Akun Anda tidak memiliki hak akses sistem.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left panel — brand */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 flex-col items-center justify-center p-12 relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5" />
                <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute top-1/3 left-[-30px] w-32 h-32 rounded-full bg-emerald-600/40" />

                <div className="relative z-10 text-center text-white">
                    {/* Logo icon */}
                    <div className="w-28 h-28 mx-auto mb-6 bg-white rounded-3xl p-3 flex items-center justify-center shadow-xl border border-white/20">
                        <img src="/logo2.png" alt="Logo LAZISNU" className="w-full h-full object-contain" />
                    </div>

                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">LAZISNU</h1>
                    <p className="text-emerald-200 text-lg font-medium">Desa Badean</p>
                    <div className="w-12 h-0.5 bg-emerald-400 mx-auto my-4" />
                    <p className="text-emerald-300 text-sm leading-relaxed max-w-xs">
                        Sistem Informasi Transparansi<br />Pengelolaan Zakat Mal
                    </p>

                    <div className="mt-10 grid grid-cols-3 gap-4 text-center">
                        {[
                            { icon: '🕌', label: 'Amanah' },
                            { icon: '📊', label: 'Transparan' },
                            { icon: '🤝', label: 'Berdayaguna' },
                        ].map(item => (
                            <div key={item.label} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                                <p className="text-2xl mb-1">{item.icon}</p>
                                <p className="text-emerald-100 text-xs font-medium">{item.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
                {/* Mobile brand header */}
                <div className="lg:hidden flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center border border-gray-200 shadow-sm shrink-0">
                        <img src="/logo2.png" alt="Logo LAZISNU" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">LAZISNU Badean</p>
                        <p className="text-xs text-gray-500">Sistem Zakat Mal</p>
                    </div>
                </div>

                <div className="w-full max-w-sm animate-fade-in">
                    <div className="mb-6">
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Masuk Akun</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Khusus petugas lapangan &amp; admin</p>
                    </div>

                    {pesanError && (
                        <div className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl text-sm mb-4 font-medium flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            {pesanError}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Alamat Email</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                    </svg>
                                </span>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nama@email.com"
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kata Sandi</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </span>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showPass ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
                        >
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Memverifikasi...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                    </svg>
                                    Masuk Akun
                                </>
                            )}
                        </button>
                    </form>

                    <div className="text-center mt-6">
                        <button
                            onClick={() => router.push('/')}
                            className="text-xs text-gray-500 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium transition"
                        >
                            ← Kembali ke Halaman Warga
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
