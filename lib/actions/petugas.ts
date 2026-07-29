'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase, requirePetugasOrAdmin } from '../supabase-server';

export async function centangDistribusi(mustahiq_id: number, periode_id: number) {
  const user = await requirePetugasOrAdmin();
  const supabase = await createServerSupabase();

  // Cek apakah sudah ada distribusi untuk mustahiq ini di periode ini
  const { data: existing } = await supabase
    .from('distribusi')
    .select('id')
    .eq('periode_id', periode_id)
    .eq('mustahiq_id', mustahiq_id)
    .maybeSingle();

  if (existing) {
    // Hapus (batal centang)
    const { error } = await supabase.from('distribusi').delete().eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    // Ambil jumlah_per_jiwa dari periode
    const { data: periode } = await supabase
      .from('periode_distribusi')
      .select('jumlah_per_jiwa, bentuk')
      .eq('id', periode_id)
      .single();

    if (!periode) throw new Error('Periode tidak ditemukan');

    const { error } = await supabase.from('distribusi').insert({
      periode_id,
      mustahiq_id,
      tanggal: new Date().toISOString().split('T')[0],
      jumlah: periode.jumlah_per_jiwa || 0,
      bentuk: periode.bentuk,
      petugas_id: user.id,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath('/petugas');
  revalidatePath('/admin/distribusi');
  revalidatePath('/bendahara');
  revalidatePath('/');
}
