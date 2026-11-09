/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  /** Hanya untuk data lama; dimigrasikan menjadi hash lalu dihapus. Jangan dipakai/ditampilkan. */
  password?: string;
  passwordSalt?: string;
  passwordHash?: string;
  /** true bila masih memakai kata sandi bawaan: operator diminta menggantinya. */
  mustChangePassword?: boolean;
  name: string;
  role: 'operator' | 'guru';
  jabatan?: string;
  guruId?: string;
  nip?: string;
  email?: string;
  email2?: string;
  phone?: string;
  lastLogin?: number;
  updatedAt?: number;
}

export interface SchoolConfig {
  namaSekolah: string;
  npsn: string;
  alamat: string;
  kepsek: string;
  nipKepsek: string;
  nss?: string;
  statusSekolah?: string;
  tahunBerdiri?: string;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  propinsi?: string;
  bahasa?: string;
  tempatLaporan?: string;
  korwilJabatan?: string;
  korwilNama?: string;
  korwilNip?: string;
  tahunAjaran: string;
  semester: string;
  kkm: number;
  kopInduk1?: string;
  kopInduk2?: string;
  kopAlamat?: string;
  formatNoSurat?: string;
  noSuratMulai?: number;
  noSuratTahun?: string;
  kelas?: string;
  katUmum?: string;
  katPribadi?: string;
  mapel?: string;
  logo?: string;
  logoPemda?: string;
  logoSekolah?: string;
  tataLetakLogo?: 'kiri_kedua' | 'kiri_kanan' | 'kiri_pemda_saja' | 'kiri_sekolah_saja';
  logoHeight?: number;
  namaOperator?: string;
  nipOperator?: string;
  emailOperator?: string;
  emailOperator2?: string;
  updatedAt?: number;
}

export interface Siswa {
  id: string;
  nama: string;
  nis?: string;
  nisn?: string;
  jk: 'L' | 'P';
  agama?: string;
  warga?: string;
  tempatLahir?: string;
  tglLahir?: string;
  kelas: string;
  rombel?: string;
  status: 'Aktif' | 'Mutasi' | 'Lulus' | 'Keluar';
  tahunMasuk?: number;
  alamat?: string;
  namaAyah?: string;
  namaIbu?: string;
  telpOrtu?: string;
  catatan?: string;
  tglMutasi?: string;
  tujuanMutasi?: string;
  alasanMutasi?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Rombel {
  id: string;
  nama: string; // contoh: "1 A", "1 B", "6 B"
  tingkat: string; // "1", "2", "3", "4", "5", "6"
  waliKelasId?: string;
  waliKelasNama?: string;
  kurikulum?: string; // e.g. "Kurikulum Merdeka", "Kurikulum 2013"
  ruangan?: string; // e.g. "Ruang Kelas 1 A"
  catatan?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Guru {
  id: string;
  nama: string;
  nip?: string;
  nuptk?: string;
  jk: 'L' | 'P';
  tempatLahir?: string;
  tglLahir?: string;
  jabatan: string;
  statusPeg: 'PNS' | 'PPPK' | 'GTT / Honorer' | string;
  mengampu?: string;
  pendidikan?: string;
  tmt?: string;
  karpeg?: string;
  agama?: string;
  kawin?: string;
  anak?: number;
  ijazah?: string;
  masaTahun?: number;
  masaBulan?: number;
  masaPer?: string;
  skTanggal?: string;
  skNomor?: string;
  golongan?: string;
  tmtGol?: string;
  gaji?: number;
  ketLaporan?: string;
  status: 'Aktif' | 'Nonaktif';
  telp?: string;
  email?: string;
  alamat?: string;
  jenisGtk?: 'Guru' | 'Tendik';
  /** Hash password login guru/tendik. Hanya operator yang dapat membuat/mengubahnya. */
  passwordSalt?: string;
  passwordHash?: string;
  passwordUpdatedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Referensi berkas. Isi berkas TIDAK disimpan di Supabase: berkas ada di ImageKit
 * (url/ikId/path) dan di cache IndexedDB perangkat. Supabase hanya menyimpan referensi teks ini.
 */
export interface FileRef {
  id: string;
  name: string;
  size: number;
  type?: string;
  /** URL publik berkas di ImageKit (ada setelah unggah berhasil). */
  url?: string;
  /** fileId ImageKit, dipakai untuk menghapus berkas. */
  ikId?: string;
  /** Path berkas di ImageKit, mis. /meja-operator/gtk/abc.pdf */
  path?: string;
  /** Hanya ada pada data lama / berkas yang baru dipilih (di memori); dibuang saat disimpan. */
  dataUrl?: string;
}

export interface DokumenGtk {
  id: string;
  guruId: string;
  kategori: string;
  judul: string;
  nomor?: string;
  tanggal?: string;
  tahunAjaran?: string;
  penerbit?: string;
  keterangan?: string;
  file?: FileRef;
  isPribadi?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Aset {
  id: string;
  nama: string;
  kode?: string;
  merk?: string;
  noRegister?: string;
  kategori: string;
  jumlah: number;
  kondisi: 'Baik' | 'Rusak ringan' | 'Rusak berat';
  lokasi?: string;
  tahunPerolehan?: number;
  sumber?: string;
  harga?: number;
  keterangan?: string;
  createdAt?: number;
  updatedAt?: number;
}

/** Barang Milik Daerah (BMD) untuk cetak stiker inventaris (data SIKATON). */
export interface BmdItem {
  id: string;
  kodeBarang: string;
  idBarang: string;
  namaBarang: string;
  merkType?: string;
  sumberDana?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface StikerConfig {
  kodeSkpd: string;
  /** Teks nama sekolah di bagian bawah stiker. Kosong = otomatis dari profil sekolah. */
  namaSekolahStiker?: string;
  logo: 'pemda_bawaan' | 'pemda_profil' | 'sekolah' | 'tanpa';
}

export interface SuratMasuk {
  id: string;
  noAgenda: string;
  tglTerima: string;
  noSurat?: string;
  tglSurat?: string;
  sifat?: string;
  asal: string;
  perihal: string;
  tujuan?: string;
  status: 'Baru' | 'Diproses' | 'Selesai';
  disposisi?: string;
  keterangan?: string;
  fotoSurat?: string;
  /** PDF hasil scan kamera (URL ImageKit, atau data URL bila ImageKit belum diatur). */
  filePdf?: string;
  filePdfName?: string;
  jumlahHalaman?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface SuratKeluar {
  id: string;
  noAgenda: string;
  tglSurat: string;
  noSurat: string;
  jenis: string;
  siswaId?: string;
  sifat?: string;
  tempat?: string;
  perihal: string;
  tujuan?: string;
  pembuka?: string;
  isi: string;
  penutup?: string;
  penandatangan: string;
  nipTtd?: string;
  jabatanTtd?: string;
  kop: string;
  ukuranKertas?: 'A4' | 'Legal';
  /** 'kustom' = isi surat bebas (diketik / diimpor dari Word) dan disimpan sebagai HTML di isiHtml. */
  mode?: 'standar' | 'kustom';
  isiHtml?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Mutasi {
  id: string;
  siswaId?: string;
  nama: string;
  kelas: string;
  jenis: 'Masuk (pindahan)' | 'Keluar (pindah)' | 'Lulus' | 'Keluar lainnya';
  tanggal: string;
  tujuan?: string;
  asal?: string;
  noSurat?: string;
  alasan?: string;
  suratId?: string;
  otomatis?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface NilaiRecord {
  id: string;
  siswaId: string;
  kelas: string;
  ta: string;
  smt: string;
  nilai: Record<string, number>;
  updatedAt?: number;
}

export interface BerkasPenilaian {
  id: string;
  judul: string;
  jenis: string;
  kelas: string;
  semester: string;
  tahunAjaran: string;
  keterangan?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface TanahItem {
  label: string;
  luas: number | null;
  persil: number | null;
  tahun: string;
  harga: number | null;
}

export interface BangunanRuanganItem {
  label: string;
  baik: [number | null, number | null];
  sedang: [number | null, number | null];
  rusak: [number | null, number | null];
}

export interface JenisBangunanItem {
  label: string;
  indent?: boolean;
  jml: [number | null, number | null, number | null];
  thn: [string, string, string];
  harga: number | null;
}

export interface PerkakasItem {
  label: string;
  baik: number | string | null;
  sedang: number | string | null;
  rusak: number | string | null;
}

export interface LaporanBulan {
  id: string; // format: YYYY-MM
  murid?: {
    sakit?: number;
    izin?: number;
    alpa?: number;
  };
  absen?: Record<string, { s?: number; i?: number; a?: number }>;
  sarana?: {
    tanah?: TanahItem[];
    bangunanRuangan?: BangunanRuanganItem[];
    jenisBangunan?: JenisBangunanItem[];
    perkakas?: PerkakasItem[];
    airBersih?: string;
    sewaPerbulan?: string;
    menumpang?: string;
    bagPerKelas?: number;
  };
  muridOverrides?: {
    inI?: { L: number; P: number }[];
    outI?: { L: number; P: number }[];
    yblI?: { L: number; P: number }[];
    iniI?: { L: number; P: number }[];
    kelasPembangunan?: number | string;
  };
  guruOverrides?: Record<string, Partial<Guru>>;
  pengesahan?: {
    tempatLaporan?: string;
    tglLaporan?: string;
    korwilJabatan?: string;
    korwilNama?: string;
    korwilNip?: string;
    kepsek?: string;
    nipKepsek?: string;
    tahunBerdiri?: string;
    statusSekolah?: string;
    bahasa?: string;
  };
  updatedAt?: number;
}

export interface LetterTemplate {
  id: string;
  judul: string;
  kategori: string;
  ukuranKertas: 'A4' | 'Legal';
  pembuka?: string;
  isi: string;
  penutup?: string;
  sifat?: string;
  /** Template kustom (dari Word / ketik bebas): isi berformat HTML. */
  isiHtml?: string;
  sumber?: 'word' | 'kustom';
  createdAt?: number;
  updatedAt?: number;
}

export interface ArsipAbsen {
  id: string;
  kelas: string;
  tahunAjaran: string;
  periode: string;
  keterangan?: string;
  file: FileRef;
  uploadedBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface KeuanganState {
  settings: {
    bendaharaNama: string;
    bendaharaNip: string;
    sumberDana: string;
    kota: string;
    prefix: string;
  };
  bku: Array<{
    id: string;
    tgl: string;
    noBukti: string;
    uraian: string;
    pengeluaran: number;
    kodeRek?: string;
  }>;
  edits: Record<string, {
    noKw?: string;
    tgl?: string;
    penerima?: string;
    untuk?: string;
    kodeRek?: string;
  }>;
  fileName?: string;
}

export interface SupabaseConfig {
  projectName: string;
  /** Diturunkan otomatis dari Project URL (bagian sebelum .supabase.co). */
  projectId: string;
  projectUrl: string;
  apiKey: string;
  /** Awalan nama tabel di database, mis. "mo_" -> tabel mo_app_store. */
  tablePrefix: string;
  autoSync: boolean;
  lastSyncedAt?: number;
}

export interface ImageKitConfig {
  /** Public Key dari ImageKit Dashboard > Developer options. */
  publicKey: string;
  /** URL endpoint, mis. https://ik.imagekit.io/idAnda (opsional, hanya untuk info/uji). */
  urlEndpoint: string;
  /** URL endpoint autentikasi yang mengembalikan {token, expire, signature} (private key tidak pernah di browser). */
  authEndpoint: string;
  /** Folder induk di ImageKit, mis. /meja-operator */
  folder: string;
}

export interface SupabaseSyncStatus {
  connected: boolean;
  status: 'idle' | 'checking' | 'syncing' | 'synced' | 'error';
  message: string;
  latencyMs?: number;
  lastSyncedAt?: number;
  tablesStatus?: Record<string, boolean>;
}

export interface WorkActivity {
  id: string;
  module: string;
  label: string;
  ts: number;
  baru: boolean;
  action?: 'create' | 'update' | 'delete';
  userNama?: string;
  userRole?: string;
}

export interface SkemaDudukConfig {
  format: 'ular' | 'grid' | 'zigzag' | 'u_shape' | 'baris_ganda';
  jumlahKolom: number; // 2, 3, 4, 5
  kapasitasMeja: number; // 10, 16, 20, 24
  labelMeja: string; // "MEJA" atau "NO"
}

export interface PosUjianConfig {
  id: string;
  namaUjian: string;
  tahunPelajaran: string;
  semester: string;
  tingkatKelas: string;
  tglMulai: string;
  tglSelesai: string;
  tempatUjian: string;
  ketuaPanitia: string;
  sekretaris: string;
  bendahara: string;
  penanggungJawab: string;
  jumlahRuang: number;
  kapasitasPerRuang: number;
  kodeSekolah: string;
  noSkPanitia?: string;
  tglSkPanitia?: string;
  catatan?: string;
  skemaDuduk?: SkemaDudukConfig;
  updatedAt?: number;
}

export interface JadwalUjianItem {
  id: string;
  hariTanggal: string;
  tanggal: string;
  jamKe: number;
  waktu: string;
  mataPelajaran: string;
  ruangList?: string[];
  keterangan?: string;
}

export interface RambuUjianItem {
  id: string;
  judul: string;
  subjudul: string;
  pesanPoin: string[];
  keteranganTambahan?: string;
  warnaTema: 'merah' | 'amber' | 'hijau' | 'biru' | 'hitam';
  ikon: 'VolumeX' | 'AlertTriangle' | 'FileText' | 'School' | 'ShieldAlert' | 'BellOff';
  catatanKaki?: string;
  kategori?: string;
  createdAt?: number;
}

export interface PesertaUjian {
  id: string;
  siswaId?: string;
  nomorPeserta: string;
  nisn: string;
  nis: string;
  nama: string;
  jk: 'L' | 'P';
  tempatLahir?: string;
  tglLahir?: string;
  kelas: string;
  rombel?: string;
  ruang: string;
  nomorMeja: number;
  fotoUrl?: string;
}

export interface PanitiaUjianItem {
  id: string;
  guruId?: string;
  nama: string;
  nip?: string;
  jabatanSekolah: string;
  jabatanPanitia: string;
  tugas?: string;
  noHp?: string;
}

export interface PengawasSilangItem {
  id: string;
  nama: string;
  nip?: string;
  asalSekolah: string;
  ruangTugas: string;
  hariTanggal?: string;
  mataPelajaran?: string;
  sesi?: string;
  noHp?: string;
  hariKe?: number; // 1 s.d. 6
  peran?: string;  // 'Pengawas 1' | 'Pengawas 2' | 'Pengawas Cadangan'
  guruId?: string;
}

