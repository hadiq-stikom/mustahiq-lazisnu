import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function proxy(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // Ambil token dari cookie browser
  const token = request.cookies.get('sb-access-token')?.value;

  // Jika mencoba akses halaman rahasia tapi kuki kosong, lempar ke halaman login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verifikasi validitas token langsung ke Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const role = user.user_metadata?.role;

    // Aturan halaman Admin
    if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Aturan halaman Petugas
    if (request.nextUrl.pathname.startsWith('/petugas') && role !== 'petugas' && role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } catch (e) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/petugas/:path*', '/admin/:path*'],
};
