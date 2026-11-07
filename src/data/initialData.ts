/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { siswaDapodik } from './siswaDapodik';
import { gtkDapodik } from './gtkDapodik';
import { User, SchoolConfig, Siswa, Guru, Aset, SuratMasuk, SuratKeluar, Mutasi, LetterTemplate, BmdItem, StikerConfig, Rombel, PosUjianConfig, JadwalUjianItem, PanitiaUjianItem, PengawasSilangItem } from '../types';

export const initialRombels: Rombel[] = [
  { id: 'rmb_1a', nama: '1 A', tingkat: '1', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 1 A' },
  { id: 'rmb_1b', nama: '1 B', tingkat: '1', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 1 B' },
  { id: 'rmb_2a', nama: '2 A', tingkat: '2', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 2 A' },
  { id: 'rmb_2b', nama: '2 B', tingkat: '2', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 2 B' },
  { id: 'rmb_3a', nama: '3 A', tingkat: '3', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 3 A' },
  { id: 'rmb_3b', nama: '3 B', tingkat: '3', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 3 B' },
  { id: 'rmb_3c', nama: '3 C', tingkat: '3', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 3 C' },
  { id: 'rmb_4a', nama: '4 A', tingkat: '4', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 4 A' },
  { id: 'rmb_4b', nama: '4 B', tingkat: '4', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 4 B' },
  { id: 'rmb_5a', nama: '5 A', tingkat: '5', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 5 A' },
  { id: 'rmb_5b', nama: '5 B', tingkat: '5', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 5 B' },
  { id: 'rmb_6a', nama: '6 A', tingkat: '6', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 6 A' },
  { id: 'rmb_6b', nama: '6 B', tingkat: '6', kurikulum: 'Kurikulum Merdeka', ruangan: 'Ruang Kelas 6 B' },
];

export const initialUsers: User[] = [
  {
    id: "u_operator",
    username: "operator",
    // Kata sandi bawaan disimpan sebagai hash (bukan teks). Operator wajib menggantinya setelah login pertama.
    passwordSalt: "bWVqYS1vcGVyYXRvci1kZQ==",
    passwordHash: "wNmYZMBzgCkXZRD+HHR7WZWK8Vr9rf/0jxdvlgsWDp0=",
    mustChangePassword: true,
    name: "Ahmad Fauzi, S.Kom",
    role: "operator",
    jabatan: "Operator Sekolah & Admin Dapodik",
    nip: "19890412 201902 1 003",
    email: "operator@sdn2cempaka.sch.id",
    phone: "0812-3456-7890"
  },
  {
    id: "u_guru",
    username: "guru",
    name: "ANNISA WIDYA GARINI",
    role: "guru",
    jabatan: "Guru Kelas",
    guruId: "g_01",
    nip: "19980702 202221 2 001",
    email: "anisawidyagarini@gmail.com",
    phone: "085161206105"
  },
  {
    id: "u_tendik",
    username: "tendik",
    name: "Risna Hidayat",
    role: "guru",
    jabatan: "Tenaga Administrasi",
    guruId: "t_03",
    nip: "19960731 202521 1 002"
  }
];

export const initialSchoolConfig: SchoolConfig = {
  namaSekolah: "SD Negeri 2 Cempaka",
  npsn: "20215452",
  alamat: "Jln. Raden Cempah No. 101",
  kepsek: "H. KAERUDIN, M.Pd.",
  nipKepsek: "19720904 199412 1 001",
  nss: "101021734018",
  statusSekolah: "a. Negeri Biasa",
  tahunBerdiri: "1975",
  desa: "Cempaka",
  kecamatan: "Talun",
  kabupaten: "Cirebon",
  propinsi: "Jawa Barat",
  bahasa: "Indonesia",
  tempatLaporan: "Talun",
  korwilJabatan: "Korwil Bidang Pendidikan",
  korwilNama: "KASMAR, S.Pd. MM.H.",
  korwilNip: "19710812 199903 1 006",
  namaOperator: "Ahmad Fauzi, S.Kom",
  nipOperator: "19890412 201902 1 003",
  emailOperator: "operator@sdn2cempaka.sch.id",
  emailOperator2: "risnahidayat17@admin.sd.belajar.id",
  tahunAjaran: "2026/2027",
  semester: "1",
  kkm: 70,
  kopInduk1: "PEMERINTAH KABUPATEN CIREBON",
  kopInduk2: "DINAS PENDIDIKAN",
  kopAlamat: "Jl. Raden Cempa No. 101 Desa Cempaka Kec. Talun Kab. Cirebon 45171",
  formatNoSurat: "421.2/{no:3}/SD/2026",
  noSuratMulai: 1,
  noSuratTahun: "2026",
  kelas: "1, 2, 3, 4, 5, 6",
  katUmum: "SK, SKP e-Kinerja, Surat Tugas, Sertifikat dan pelatihan",
  katPribadi: "Ijazah dan transkrip, KTP / KK / NPWP, Karpeg / BPJS / Taspen",
  mapel: "Pendidikan Agama, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPAS, Seni dan Budaya, PJOK, Bahasa Inggris, Muatan Lokal",
  logoPemda: "",
  logoSekolah: "",
  tataLetakLogo: "kiri_kedua",
  logoHeight: 85
};

export const initialGurus: Guru[] = gtkDapodik;

export const initialSiswas: Siswa[] = siswaDapodik;

export const initialSuratKeluar: SuratKeluar[] = [];

export const initialMutasi: Mutasi[] = [];

export const initialAsets: Aset[] = [
  {
    id: "ast_1",
    nama: "Tanah Pekarangan Sekolah SD Negeri 2 Cempaka",
    kode: "01.01.01.01.001",
    kategori: "KIB A - Tanah",
    jumlah: 1,
    kondisi: "Baik",
    lokasi: "Kompleks SD Negeri 2 Cempaka",
    tahunPerolehan: 1975,
    sumber: "APBD",
    harga: 85000000,
    keterangan: "Luas tanah 3.920 m2, sertifikat hak pakai Pemda"
  },
  {
    id: "ast_2",
    nama: "Gedung Ruang Kelas dan Kantor Guru",
    kode: "02.01.01.01.002",
    kategori: "KIB C - Gedung dan Bangunan",
    jumlah: 2,
    kondisi: "Baik",
    lokasi: "Kompleks Sekolah",
    tahunPerolehan: 1982,
    sumber: "APBN",
    harga: 280000000,
    keterangan: "Bangunan permanen terdiri atas 6 ruang kelas dan 1 ruang guru"
  },
  {
    id: "ast_3",
    nama: "Meja Siswa Kayu Jati Single",
    kode: "KIB-B-001",
    merk: "Lokal Cirebon",
    noRegister: "001-030",
    kategori: "KIB B - Peralatan dan Mesin",
    jumlah: 30,
    kondisi: "Baik",
    lokasi: "Ruang Kelas 4",
    tahunPerolehan: 2023,
    sumber: "BOS",
    harga: 350000,
    keterangan: "Meja kayu jati kokoh"
  },
  {
    id: "ast_4",
    nama: "Kursi Siswa Kayu Jati",
    kode: "KIB-B-002",
    merk: "Lokal Cirebon",
    noRegister: "001-030",
    kategori: "KIB B - Peralatan dan Mesin",
    jumlah: 30,
    kondisi: "Rusak ringan",
    lokasi: "Ruang Kelas 4",
    tahunPerolehan: 2023,
    sumber: "BOS",
    harga: 180000,
    keterangan: "Sebagian perlu perbaikan baut dan amplas ulang"
  },
  {
    id: "ast_5",
    nama: "Laptop Guru Chromebook ASUS C214",
    kode: "KIB-B-005",
    merk: "ASUS",
    noRegister: "CH-001-006",
    kategori: "KIB B - Peralatan dan Mesin",
    jumlah: 6,
    kondisi: "Baik",
    lokasi: "Ruang Guru & Laboratorium Komputer",
    tahunPerolehan: 2022,
    sumber: "BOS",
    harga: 6500000,
    keterangan: "Bantuan TIK Kemendikbudristek"
  }
];

export const initialSuratMasuk: SuratMasuk[] = [
  {
    id: "sm_1",
    noAgenda: "1",
    tglTerima: "2026-10-15",
    noSurat: "421.1/1280/Disdik/2026",
    tglSurat: "2026-10-12",
    sifat: "Penting",
    asal: "Dinas Pendidikan Kabupaten Cirebon",
    perihal: "Pelaksanaan Asesmen Nasional Berbasis Komputer (ANBK) Jenjang SD 2026",
    tujuan: "Kepala Sekolah",
    status: "Diproses",
    disposisi: "Teruskan ke Operator Sekolah untuk persiapan sarana Chromebook dan ruang lab TIK",
    keterangan: "Simulasi gladi bersih dijadwalkan tanggal 5-7 November 2026"
  },
  {
    id: "sm_2",
    noAgenda: "2",
    tglTerima: "2026-10-20",
    noSurat: "005/214/Korwil-Talun/2026",
    tglSurat: "2026-10-19",
    sifat: "Biasa",
    asal: "Korwil Bidang Pendidikan Kecamatan Talun",
    perihal: "Undangan Rapat Koordinasi Kepala Sekolah & Penyerahan Daftar 1 Bulan Oktober",
    tujuan: "Kepala Sekolah",
    status: "Selesai",
    disposisi: "Hadiri rapat pada hari Kamis, 29 Oktober 2026"
  }
];

export const initialLetterTemplates: LetterTemplate[] = [
  {
    id: "tmpl_1",
    judul: "Surat keterangan aktif siswa",
    kategori: "Kesiswaan",
    ukuranKertas: "A4",
    pembuka: "Yang bertanda tangan di bawah ini:",
    isi: "dengan ini menerangkan bahwa nama siswa tersebut di bawah ini, adalah benar Peserta Didik SD NEGERI 2 CEMPAKA KEC. TALUN yang saat ini aktif mengikuti kegiatan belajar mengajar pada Tahun Ajaran 2026/2027.",
    penutup: "Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.",
    sifat: "Biasa"
  },
  {
    id: "tmpl_2",
    judul: "Surat keterangan pindah siswa",
    kategori: "Kesiswaan",
    ukuranKertas: "Legal",
    pembuka: "Yang bertanda tangan di bawah ini, Kepala Sekolah Dasar Negeri 2 Cempaka Kecamatan Talun Kabupaten Cirebon, menerangkan bahwa:",
    isi: "Berdasarkan surat permohonan pindah sekolah dari orang tua/wali siswa, dengan ini menerangkan bahwa siswa tersebut di atas telah disetujui untuk pindah sekolah ke satuan pendidikan yang dituju.",
    penutup: "Demikian surat keterangan pindah sekolah ini dibuat untuk dapat dipergunakan sebagaimana mestinya.",
    sifat: "Biasa"
  },
  {
    id: "tmpl_3",
    judul: "Surat keterangan berkelakuan baik",
    kategori: "Kesiswaan",
    ukuranKertas: "A4",
    pembuka: "Yang bertanda tangan di bawah ini, Kepala Sekolah Dasar Negeri 2 Cempaka Kecamatan Talun Kabupaten Cirebon, menerangkan bahwa:",
    isi: "Selama menjadi peserta didik di sekolah kami, yang bersangkutan senantiasa mentaati tata tertib sekolah, berkelakuan baik, serta tidak pernah terlibat tindakan kriminal, asusila, maupun pelanggaran hukum.",
    penutup: "Surat keterangan ini diberikan atas permintaan yang bersangkutan untuk keperluan persyaratan pendaftaran / administrasi.",
    sifat: "Biasa"
  },
  {
    id: "tmpl_4",
    judul: "Surat tugas dinas / kegiatan",
    kategori: "Kepegawaian",
    ukuranKertas: "A4",
    pembuka: "Kepala Sekolah Dasar Negeri 2 Cempaka memberikan tugas kedinasan kepada:",
    isi: "Untuk menghadiri dan mengikuti kegiatan pembinaan / bimbingan teknis yang diselenggarakan oleh Dinas Pendidikan, dan segera melaporkan hasil pelaksanaan tugas kepada Kepala Sekolah.",
    penutup: "Demikian surat tugas ini dibuat agar dapat dilaksanakan dengan penuh tanggung jawab.",
    sifat: "Penting"
  },
  {
    id: "tmpl_5",
    judul: "Surat permohonan dinas",
    kategori: "Dinas / Umum",
    ukuranKertas: "A4",
    pembuka: "Sehubungan dengan agenda peningkatan mutu pembelajaran dan sarana prasarana satuan pendidikan, bersama ini kami sampaikan:",
    isi: "Kami mengajukan permohonan bantuan dan fasilitasi sarana penunjang kegiatan asesmen berbasis komputer serta pengadaan bahan ajar kurikulum.",
    penutup: "Atas perhatian, dukungan, dan kerja sama yang baik, kami ucapkan terima kasih.",
    sifat: "Penting"
  }
];

// Data BMD awal dari berkas Cetak_Stiker_Excel.xlsx (NPSN 20215452)
export const initialBmd: BmdItem[] = [
  { id: 'bmd_seed_1', kodeBarang: "1.3.2.05.01.04.003", idBarang: "10062847", namaBarang: "Rak Besi.", merkType: "Merk: Lokal / Type: Rak Buku Single", sumberDana: "BOS Reguler - TA. 2026 Bln.3" },
  { id: 'bmd_seed_2', kodeBarang: "1.3.2.05.01.04.004", idBarang: "10062848", namaBarang: "Rak Besi.", merkType: "Merk: Lokal / Type: Rak Buku Single", sumberDana: "BOS Reguler - TA. 2026 Bln.3" },
  { id: 'bmd_seed_3', kodeBarang: "1.3.2.05.01.04.005", idBarang: "10062849", namaBarang: "Rak Besi.", merkType: "Merk: Lokal / Type: Rak Buku Single", sumberDana: "BOS Reguler - TA. 2026 Bln.3" },
  { id: 'bmd_seed_4', kodeBarang: "1.3.2.05.01.04.006", idBarang: "10062850", namaBarang: "Rak Besi.", merkType: "Merk: Lokal / Type: Rak Buku Single", sumberDana: "BOS Reguler - TA. 2026 Bln.3" },
  { id: 'bmd_seed_5', kodeBarang: "1.3.2.05.02.01.034", idBarang: "12068124", namaBarang: "Focusing", merkType: "Merk : Lokal / Type : Kursi Siswa Kayu", sumberDana: "BOS Reguler - TA. 2026 Bln.3" },
  { id: 'bmd_seed_6', kodeBarang: "1.3.2.05.01.05.053", idBarang: "10071019", namaBarang: "Screen/Layar LCD Projector.", merkType: "Merk : LETAEC Type : LAYAR MOTORIZED", sumberDana: "BOS Reguler - TA. 2026 Bln.4" },
  { id: 'bmd_seed_7', kodeBarang: "1.3.2.05.02.04.006", idBarang: "10057941", namaBarang: "Kipas Angin", merkType: "Merk: GMC / Type: Kipas Angin Dinding", sumberDana: "BOS Reguler - TA. 2026 Bln.2" },
  { id: 'bmd_seed_8', kodeBarang: "1.3.2.05.02.04.006", idBarang: "10057941", namaBarang: "Kipas Angin", merkType: "Merk: GMC / Type: Kipas Angin Dinding", sumberDana: "BOS Reguler - TA. 2026 Bln.2" },
  { id: 'bmd_seed_9', kodeBarang: "1.3.2.05.02.04.006", idBarang: "10057941", namaBarang: "Kipas Angin", merkType: "Merk: GMC / Type: Kipas Angin Dinding", sumberDana: "BOS Reguler - TA. 2026 Bln.2" },
  { id: 'bmd_seed_10', kodeBarang: "1.3.2.05.02.04.006", idBarang: "10057941", namaBarang: "Kipas Angin", merkType: "Merk: GMC / Type: Kipas Angin Dinding", sumberDana: "BOS Reguler - TA. 2026 Bln.2" },
  { id: 'bmd_seed_11', kodeBarang: "1.3.2.05.02.04.006", idBarang: "10057941", namaBarang: "Kipas Angin", merkType: "Merk: GMC / Type: Kipas Angin Dinding", sumberDana: "BOS Reguler - TA. 2026 Bln.2" },
  { id: 'bmd_seed_12', kodeBarang: "1.3.2.05.02.04.006", idBarang: "10057941", namaBarang: "Kipas Angin", merkType: "Merk: GMC / Type: Kipas Angin Dinding", sumberDana: "BOS Reguler - TA. 2026 Bln.2" },
  { id: 'bmd_seed_13', kodeBarang: "1.3.2.10.02.04.002", idBarang: "10071020", namaBarang: "Router", merkType: "Merk : TP-LINK Type : TLWR840N 300 MBPS", sumberDana: "BOS Reguler - TA. 2026 Bln.4" },
  { id: 'bmd_seed_14', kodeBarang: "1.3.2.10.02.04.002", idBarang: "10071020", namaBarang: "Router", merkType: "Merk : TP-LINK Type : TLWR840N 300 MBPS", sumberDana: "BOS Reguler - TA. 2026 Bln.4" },
  { id: 'bmd_seed_15', kodeBarang: "1.3.2.10.02.04.002", idBarang: "10071020", namaBarang: "Router", merkType: "Merk : TP-LINK Type : TLWR840N 300 MBPS", sumberDana: "BOS Reguler - TA. 2026 Bln.4" },
];

export const initialStikerConfig: StikerConfig = {
  kodeSkpd: '1.01.01.002.0358',
  logo: 'pemda_bawaan',
};

export const initialPosUjianConfig: PosUjianConfig = {
  id: 'pos_cfg_default',
  namaUjian: 'Asesmen Sumatif Akhir Jenjang (ASAJ) / Ujian Sekolah',
  tahunPelajaran: '2025/2026',
  semester: '2 (Genap)',
  tingkatKelas: '6',
  tglMulai: '2026-05-18',
  tglSelesai: '2026-05-23',
  tempatUjian: 'SD Negeri 2 Cempaka',
  penanggungJawab: 'Caswila, S.Pd.SD',
  ketuaPanitia: 'Risna Hidayat, S.Pd.',
  sekretaris: 'Ii Kurniati, S.Pd.SD',
  bendahara: 'Hj. Siti Maryam, S.Pd.',
  jumlahRuang: 2,
  kapasitasPerRuang: 20,
  kodeSekolah: '02-12-01',
  noSkPanitia: '421.2/045/SD-02/V/2026',
  tglSkPanitia: '2026-05-02',
  catatan: 'Pelaksanaan ujian mengacu pada POS Asesmen Sumatif Akhir Jenjang Tingkat Sekolah Dasar Kabupaten Cirebon.',
  updatedAt: Date.now(),
};

export const initialJadwalUjian: JadwalUjianItem[] = [
  {
    id: 'jdw_1',
    hariTanggal: 'Senin, 18 Mei 2026',
    tanggal: '2026-05-18',
    jamKe: 1,
    waktu: '07.30 - 09.30 WIB',
    mataPelajaran: 'Pendidikan Agama dan Budi Pekerti',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '50 butir soal PG & Uraian',
  },
  {
    id: 'jdw_2',
    hariTanggal: 'Senin, 18 Mei 2026',
    tanggal: '2026-05-18',
    jamKe: 2,
    waktu: '10.00 - 11.30 WIB',
    mataPelajaran: 'Pendidikan Pancasila (PPKn)',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '40 butir soal',
  },
  {
    id: 'jdw_3',
    hariTanggal: 'Selasa, 19 Mei 2026',
    tanggal: '2026-05-19',
    jamKe: 1,
    waktu: '07.30 - 09.30 WIB',
    mataPelajaran: 'Bahasa Indonesia',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '45 butir soal & esai literasi',
  },
  {
    id: 'jdw_4',
    hariTanggal: 'Selasa, 19 Mei 2026',
    tanggal: '2026-05-19',
    jamKe: 2,
    waktu: '10.00 - 11.30 WIB',
    mataPelajaran: 'Seni Budaya dan Prakarya (SBdP)',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '35 butir soal teori & apresiasi seni',
  },
  {
    id: 'jdw_5',
    hariTanggal: 'Rabu, 20 Mei 2026',
    tanggal: '2026-05-20',
    jamKe: 1,
    waktu: '07.30 - 09.30 WIB',
    mataPelajaran: 'Matematika',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '35 butir soal numerasi & pemecahan masalah',
  },
  {
    id: 'jdw_6',
    hariTanggal: 'Rabu, 20 Mei 2026',
    tanggal: '2026-05-20',
    jamKe: 2,
    waktu: '10.00 - 11.30 WIB',
    mataPelajaran: 'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '40 butir soal',
  },
  {
    id: 'jdw_7',
    hariTanggal: 'Kamis, 21 Mei 2026',
    tanggal: '2026-05-21',
    jamKe: 1,
    waktu: '07.30 - 09.30 WIB',
    mataPelajaran: 'Ilmu Pengetahuan Alam (IPA)',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '40 butir soal saintifik',
  },
  {
    id: 'jdw_8',
    hariTanggal: 'Kamis, 21 Mei 2026',
    tanggal: '2026-05-21',
    jamKe: 2,
    waktu: '10.00 - 11.30 WIB',
    mataPelajaran: 'Bahasa Sunda / Daerah Cirebon (Mulok)',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '40 butir soal muatan lokal',
  },
  {
    id: 'jdw_9',
    hariTanggal: 'Jumat, 22 Mei 2026',
    tanggal: '2026-05-22',
    jamKe: 1,
    waktu: '07.30 - 09.30 WIB',
    mataPelajaran: 'Ilmu Pengetahuan Sosial (IPS)',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '40 butir soal',
  },
  {
    id: 'jdw_10',
    hariTanggal: 'Sabtu, 23 Mei 2026',
    tanggal: '2026-05-23',
    jamKe: 1,
    waktu: '07.30 - 09.00 WIB',
    mataPelajaran: 'Bahasa Inggris',
    ruangList: ['Ruang 01', 'Ruang 02'],
    keterangan: '40 butir soal',
  },
];

export const initialPanitiaUjian: PanitiaUjianItem[] = [
  {
    id: 'pnt_1',
    nama: 'Caswila, S.Pd.SD',
    nip: '196804121991031008',
    jabatanSekolah: 'Kepala Sekolah',
    jabatanPanitia: 'Penanggung Jawab',
    tugas: 'Bertanggung jawab penuh atas ketertiban, keamanan, dan kelancaran seluruh rangkaian Ujian Sekolah.',
  },
  {
    id: 'pnt_2',
    nama: 'Risna Hidayat, S.Pd.',
    nip: '198807152019031004',
    jabatanSekolah: 'Guru Kelas / Operator',
    jabatanPanitia: 'Ketua Panitia',
    tugas: 'Memimpin perencanaan teknis, koordinasi dengan pengawas silang dan dinas pendidikan, serta memonitor pelaksanaan harian.',
  },
  {
    id: 'pnt_3',
    nama: 'Ii Kurniati, S.Pd.SD',
    nip: '197505102008012009',
    jabatanSekolah: 'Guru Kelas 6',
    jabatanPanitia: 'Sekretaris',
    tugas: 'Menyiapkan berkas administrasi, berita acara, daftar hadir peserta dan pengawas, SK panitia, serta pelaporan kelulusan.',
  },
  {
    id: 'pnt_4',
    nama: 'Hj. Siti Maryam, S.Pd.',
    nip: '197203151996032003',
    jabatanSekolah: 'Guru PAI',
    jabatanPanitia: 'Bendahara',
    tugas: 'Mengelola anggaran belanja ATK, konsumsi, penggandaan naskah ujian, dan honorarium pengawas.',
  },
  {
    id: 'pnt_5',
    nama: 'Didi Suardi, S.Pd.',
    nip: '198109202014061002',
    jabatanSekolah: 'Guru PJOK',
    jabatanPanitia: 'Seksi Naskah & Penggandaan',
    tugas: 'Menjaga kerahasiaan naskah soal, menyusun amplop soal lembar jawaban per ruang, dan mendistribusikan ke pengawas ruang.',
  },
  {
    id: 'pnt_6',
    nama: 'Ahmad Fauzi, S.Pd.',
    nip: '198502142022211005',
    jabatanSekolah: 'Guru Kelas',
    jabatanPanitia: 'Seksi Pelaksana & Pengawasan',
    tugas: 'Mengatur alokasi ruang ujian, mengoordinasikan pengawas silang, dan membunyikan bel tanda waktu ujian.',
  },
  {
    id: 'pnt_7',
    nama: 'Neneng Hasanah, S.Pd.',
    nip: '199008222020122008',
    jabatanSekolah: 'Guru Kelas',
    jabatanPanitia: 'Seksi Konsumsi',
    tugas: 'Menyiapkan konsumsi rehat untuk seluruh panitia, pengawas silang ujian, dan tamu monitoring dinas.',
  },
  {
    id: 'pnt_8',
    nama: 'Maman Suparman',
    nip: '-',
    jabatanSekolah: 'Tenaga Kebersihan / Keamanan',
    jabatanPanitia: 'Seksi Perlengkapan & Keamanan',
    tugas: 'Menyiapkan meja kursi bernomor, memasang rambu ujian, tata tertib, denah ruang, dan menjaga ketertiban lingkungan ujian.',
  },
];

export const initialPengawasSilang: PengawasSilangItem[] = [
  {
    id: 'pgw_1',
    nama: 'Dra. Hj. Nurjanah, M.Pd.',
    nip: '196901041993072001',
    asalSekolah: 'SD Negeri 1 Cempaka',
    ruangTugas: 'Ruang 01',
    hariTanggal: 'Senin - Rabu, 18 - 20 Mei 2026',
    mataPelajaran: 'Pendidikan Agama, PPKn, Bahasa Indonesia, SBdP, Matematika, PJOK',
    sesi: 'Pagi (07.30 - 11.30 WIB)',
  },
  {
    id: 'pgw_2',
    nama: 'Sutisna, S.Pd.SD',
    nip: '197806122007011012',
    asalSekolah: 'SD Negeri 1 Talun',
    ruangTugas: 'Ruang 01',
    hariTanggal: 'Kamis - Sabtu, 21 - 23 Mei 2026',
    mataPelajaran: 'IPA, Mulok Bahasa Sunda, IPS, Bahasa Inggris',
    sesi: 'Pagi (07.30 - 11.30 WIB)',
  },
  {
    id: 'pgw_3',
    nama: 'Euis Ratnawati, S.Pd.',
    nip: '198203102010012015',
    asalSekolah: 'SD Negeri 3 Cempaka',
    ruangTugas: 'Ruang 02',
    hariTanggal: 'Senin - Rabu, 18 - 20 Mei 2026',
    mataPelajaran: 'Pendidikan Agama, PPKn, Bahasa Indonesia, SBdP, Matematika, PJOK',
    sesi: 'Pagi (07.30 - 11.30 WIB)',
  },
  {
    id: 'pgw_4',
    nama: 'Bambang Irawan, S.Pd.',
    nip: '198411052014031003',
    asalSekolah: 'SD Negeri 2 Kepongpongan',
    ruangTugas: 'Ruang 02',
    hariTanggal: 'Kamis - Sabtu, 21 - 23 Mei 2026',
    mataPelajaran: 'IPA, Mulok Bahasa Sunda, IPS, Bahasa Inggris',
    sesi: 'Pagi (07.30 - 11.30 WIB)',
  },
];

