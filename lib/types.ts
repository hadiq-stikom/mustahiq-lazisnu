export interface RT {
  id: number;
  no_rt: number;
  nama_rt: string;
}

export interface Mustahiq {
  id: number;
  nama: string;
  keterangan: string | null;
  rt_id: number;
  daftar_rt: Pick<RT, 'no_rt' | 'nama_rt'>;
}

export interface MustahiqFlat {
  id: number;
  nama: string;
  keterangan: string | null;
  rt_id: number;
  no_rt: number;
  nama_rt: string;
}

export interface RTGroup {
  rt_id: number;
  no_rt: number;
  nama_rt: string;
  warga: Mustahiq[];
}

export interface Penerimaan {
  id: number;
  tanggal: string;
  sumber: 'ZAKAT_MAL' | 'SEDEKAH_INFAK';
  muzakki: string | null;
  jumlah: number;
  petugas_id: string | null;
  keterangan: string | null;
  created_at: string;
}

export interface PeriodeDistribusi {
  id: number;
  nama: string;
  tanggal_buka: string;
  tanggal_tutup: string | null;
  status: 'AKTIF' | 'SELESAI';
  jumlah_per_jiwa: number | null;
  bentuk: string;
  created_at: string;
}

export interface Distribusi {
  id: number;
  periode_id: number;
  mustahiq_id: number;
  tanggal: string;
  jumlah: number;
  bentuk: string;
  keterangan: string | null;
  petugas_id: string | null;
  created_at: string;
}

export interface DistribusiWithMustahiq extends Distribusi {
  mustahiq: MustahiqFlat;
}

export interface PengajuanUpdate {
  id: number;
  penerima_id: number | null;
  nama_baru: string;
  keterangan_baru: string | null;
  status: string;
}

export interface SaldoBulanan {
  id: number;
  bulan: string;
  saldo: number;
}

export interface Pengeluaran {
  id: number;
  tanggal: string;
  kategori: 'DISTRIBUSI' | 'ATK' | 'PERLENGKAPAN_DISTRIBUSI' | 'OPERASIONAL' | 'TRANSPORTASI' | 'LAINNYA';
  deskripsi: string | null;
  jumlah: number;
  petugas_id: string | null;
  created_at: string;
}

export interface LaporanSaldoItem {
  bulan: string;
  penerimaan: number;
  distribusi: number;
  pengeluaran: number;
  saldo: number;
}

export type SumberDana = 'ZAKAT_MAL' | 'SEDEKAH_INFAK';
export type KategoriPengeluaran = 'DISTRIBUSI' | 'ATK' | 'PERLENGKAPAN_DISTRIBUSI' | 'OPERASIONAL' | 'TRANSPORTASI' | 'LAINNYA';
export type JenisTransaksi = 'PEMASUKAN' | 'PENGELUARAN';
export type PeriodeStatus = 'AKTIF' | 'SELESAI';
