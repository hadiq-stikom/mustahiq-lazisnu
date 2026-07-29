import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const role = user?.user_metadata?.role;

  // Jika belum login & mencoba mengakses route terproteksi
  if (!user && (pathname.startsWith('/admin') || pathname.startsWith('/bendahara') || pathname.startsWith('/petugas'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Jika sudah login & mencoba membuka /login, alihkan ke dashboard role masing-masing
  if (user && pathname === '/login') {
    if (role === 'admin') return NextResponse.redirect(new URL('/admin', request.url));
    if (role === 'bendahara') return NextResponse.redirect(new URL('/bendahara', request.url));
    if (role === 'petugas') return NextResponse.redirect(new URL('/petugas', request.url));
  }

  // Hak Akses Role
  if (user) {
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const target = role === 'bendahara' ? '/bendahara' : role === 'petugas' ? '/petugas' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (pathname.startsWith('/bendahara') && role !== 'admin' && role !== 'bendahara') {
      const target = role === 'petugas' ? '/petugas' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (pathname.startsWith('/petugas') && role !== 'admin' && role !== 'petugas') {
      const target = role === 'bendahara' ? '/bendahara' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/login', '/petugas/:path*', '/admin/:path*', '/bendahara/:path*'],
};
