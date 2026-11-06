/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { siswaDapodik } from './siswaDapodik';
import { gtkDapodik } from './gtkDapodik';
import { User, SchoolConfig, Siswa, Guru, Aset, SuratMasuk, SuratKeluar, Mutasi, LetterTemplate } from '../types';

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
