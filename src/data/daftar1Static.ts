/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data statis Daftar 1 (tanah, bangunan, perkakas) — diambil dari format
 * "DAFTAR 1 MARET 2026". Ubah nilai di sini bila kondisi sarana sekolah berubah.
 * Angka 0 / null ditampilkan sebagai "-".
 */

export type Num = number | null;

/** Jumlah "Bag" (di bawah nama kelas I–VI) pada tabel Banyak Murid. */
export const BAG_PER_KELAS = 2;

export const TANAH = [
  { label: 'Pemerintah', luas: 3920 as Num, persil: 42 as Num, tahun: '-', harga: 8000000 as Num },
  { label: 'Yayasan', luas: null as Num, persil: null as Num, tahun: '-', harga: null as Num },
  { label: 'Perseorangan', luas: null as Num, persil: null as Num, tahun: '-', harga: null as Num },
];

/** Bangunan ruangan: [bgn, rgn] per kondisi. */
type BR = [Num, Num];
export const BANGUNAN_RUANGAN: { label: string; baik: BR; sedang: BR; rusak: BR }[] = [
  { label: 'Pemerintah', baik: [2, 6], sedang: [null, null], rusak: [null, null] },
  { label: 'Yayasan', baik: [null, null], sedang: [null, null], rusak: [null, null] },
  { label: 'Perseorangan', baik: [null, null], sedang: [null, null], rusak: [null, null] },
];

/** Jenis/sifat bangunan: jumlah P / SP / DR, tahun pendirian P / SP / DR, harga. */
export const JENIS_BANGUNAN: {
  label: string;
  indent?: boolean;
  jml: [Num, Num, Num];
  thn: [string, string, string];
  harga: Num;
}[] = [
  { label: 'a. Bangunan Sekolah', jml: [2, null, null], thn: ['75/82', '-', '-'], harga: 8000000 },
  { label: 'b. Madrasah', jml: [null, null, null], thn: ['-', '-', '-'], harga: null },
  { label: 'c. Rumah Dinas', jml: [null, null, null], thn: ['-', '-', '-'], harga: null },
  { label: '1. Kepala Sekolah', indent: true, jml: [1, null, null], thn: ['1975', '-', '-'], harga: null },
  { label: '2. Guru', indent: true, jml: [1, null, null], thn: ['1982', '-', '-'], harga: null },
  { label: '3. Penjaga SD', indent: true, jml: [null, null, null], thn: ['-', '-', '-'], harga: null },
  { label: 'd. Lain-lain', jml: [null, null, null], thn: ['-', '-', '-'], harga: null },
];

export const AIR_BERSIH = 'PDAM';

/** Perkakas: baik / sedang / rusak. Isi teks (mis. "1 Set") tampil apa adanya. */
export const PERKAKAS: { label: string; baik: Num | string; sedang: Num | string; rusak: Num | string }[] = [
  { label: 'Bangku', baik: null, sedang: null, rusak: null },
  { label: 'Meja Murid', baik: 115, sedang: 70, rusak: null },
  { label: 'Kursi Murid', baik: 230, sedang: 152, rusak: null },
  { label: 'Kursi Guru', baik: 3, sedang: 4, rusak: null },
  { label: 'Lemari', baik: 3, sedang: 4, rusak: null },
  { label: 'Meja Guru', baik: 8, sedang: 4, rusak: null },
  { label: 'Papan Tulis', baik: 9, sedang: null, rusak: null },
  { label: 'Kursi Tamu', baik: '1 Set', sedang: null, rusak: null },
];
