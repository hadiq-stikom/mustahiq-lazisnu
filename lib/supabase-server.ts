import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function getUserFromCookies() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireAdmin() {
  const user = await getUserFromCookies();
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Unauthorized: admin only');
  }
  return user;
}

export async function requireBendahara() {
  const user = await getUserFromCookies();
  const role = user?.user_metadata?.role;
  if (!user || (role !== 'admin' && role !== 'bendahara')) {
    throw new Error('Unauthorized: bendahara or admin only');
  }
  return user;
}

export async function requirePetugasOrAdmin() {
  const user = await getUserFromCookies();
  const role = user?.user_metadata?.role;
  if (!user || (role !== 'admin' && role !== 'petugas')) {
    throw new Error('Unauthorized');
  }
  return user;
}
