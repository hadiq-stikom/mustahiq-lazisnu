'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase, requireBendahara } from '../supabase-server';

export async function tambahTransaksi(formData: FormData) {
  const user = await requireBendahara();
  const supabase = await createServerSupabase();

  const jenis = formData.get('jenis') as string;
  const tanggal = formData.get('tanggal') as string;
  const jumlah = parseFloat(formData.get('jumlah') as string);

  if (jenis === 'PEMASUKAN') {
    const sumber = formData.get('sumber') as string;
    const muzakki = formData.get('muzakki') as string;

    const { error } = await supabase.from('penerimaan').insert({
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      sumber,
      muzakki: muzakki || null,
      jumlah,
      keterangan: formData.get('keterangan') as string || null,
      petugas_id: user.id,
    });

    if (error) throw new Error(error.message);
  } else {
    const kategori = formData.get('kategori') as string;

    const { error } = await supabase.from('pengeluaran').insert({
      tanggal: tanggal || new Date().toISOString().split('T')[0],
      kategori,
      deskripsi: formData.get('deskripsi') as string || null,
      jumlah,
      petugas_id: user.id,
    });

    if (error) throw new Error(error.message);
  }

  revalidatePath('/bendahara');
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function hapusTransaksiBendahara(id: number, jenis: 'penerimaan' | 'pengeluaran') {
  await requireBendahara();
  const supabase = await createServerSupabase();

  if (jenis === 'penerimaan') {
    const { error } = await supabase.from('penerimaan').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('pengeluaran').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/bendahara');
  revalidatePath('/admin');
  revalidatePath('/');
}

export async function simpanSaldoBulanBendahara(bulan: string) {
  await requireBendahara();
  const { hitungSaldoSekarang, simpanSaldoBulananAction } = await import('./saldo');
  
  const saldoAkhir = await hitungSaldoSekarang(bulan);
  await simpanSaldoBulananAction(bulan, saldoAkhir);

  revalidatePath('/bendahara');
  revalidatePath('/admin');

  return saldoAkhir;
}
