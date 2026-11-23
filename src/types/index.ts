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
  logoPemdaHeight?: number;
  logoSekolahHeight?: number;
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

export interface SppdData {
  pejabatPerintah: string;
  pegawaiNama: string;
  pegawaiNip?: string;
  pegawaiJabatanPangkat: string;
  dari: string;
  ke: string;
  lamaHari: string;
  tanggalPerjalanan: string;
  lumpsum: string;
  maksud: string;
  bebanBiaya: string;
  keterangan: string;
}

export interface PindahData {
  nssSekolah?: string;
  siswaNama: string;
  ttl: string;
  nisn: string;
  kelas: string;
  jenisKelamin: string;
  alamatSiswa: string;
  ortuNama: string;
  ortuAlamat: string;
  sekolahTujuan: string;
  alasanPindah: string;
}

export interface SuratTugasData {
  pemberiNama: string;
  pemberiNip: string;
  pemberiPangkat: string;
  pemberiJabatan: string;
  pemberiUnitKerja: string;
  pegawaiNama: string;
  pegawaiNip: string;
  pegawaiJabatan: string;
  pegawaiUnitKerja: string;
  untukUraian: string;
  hariTanggal: string;
  waktu: string;
  tempat: string;
  penutup: string;
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
  sppdData?: SppdData;
  pindahData?: PindahData;
  tugasData?: SuratTugasData;
  lampiranPdf?: string;
  lampiranPdfName?: string;
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

export interface ArsipLaporan {
  id: string;
  judul: string;
  kategori: string;
  periode: string;
  tanggal: string;
  tahunAjaran: string;
  nomor?: string;
  keterangan?: string;
  file: FileRef;
  uploadedBy?: string;
  uploadedById?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type SpjDocType =
  | 'kwitansi'
  | 'nota_pesanan'
  | 'bast'
  | 'model_a2'
  | 'tanda_terima_honor'
  | 'dokumentasi'
  | 'invoice';

export type SpjKategori = 'barang_jasa' | 'honor' | 'lembur' | 'sppd';

export interface SpjItemRow {
  nama: string;
  vol: string;
  satuan: string;
  harga: number;
}

export interface SpjHonorRow {
  nama: string;
  jabatan: string;
  vol: string;
  satuanHonor: number;
  pph: number;
}

export interface SpjFotoItem {
  url: string;
  caption?: string;
}

export type SpjPajakSkema =
  | 'auto'
  | 'ppn_pph22'
  | 'ppn_pph23'
  | 'pph21'
  | 'pph23'
  | 'ppn_only'
  | 'bebas';

export interface KeuanganEditRow {
  kategoriSpj?: SpjKategori;
  noKw?: string;
  tgl?: string;
  penerima?: string;
  alamatPenerima?: string;
  npwpPenerima?: string;
  telpPenerima?: string;
  jabatanPenerima?: string;
  untuk?: string;
  kodeRek?: string;
  pelaksanaNama?: string;
  pelaksanaNip?: string;
  // Rincian barang/jasa bersama (Nota Pesanan, BAST, Invoice)
  items?: SpjItemRow[];
  // Nota Pesanan
  noPesanan?: string;
  tglPesanan?: string;
  batasWaktu?: string;
  catatanPesanan?: string;
  // BAST
  noBast?: string;
  tglBast?: string;
  catatanBast?: string;
  // Model A2 & Pajak Otomatis / Buku Pembantu Pajak
  noA2?: string;
  tglA2?: string;
  kodeKegiatan?: string;
  ppn?: number;
  pph?: number;
  jenisPph?: string;
  pajakManual?: boolean;
  pajakSkema?: SpjPajakSkema;
  pajakHasNpwp?: boolean;
  tarifPph21?: number;
  pajakDisetor?: boolean;
  pajakTglSetor?: string;
  pajakNtpn?: string;
  // Tanda Terima Honor
  noHonor?: string;
  tglHonor?: string;
  honorJudul?: string;
  honorRows?: SpjHonorRow[];
  // Dokumentasi Kegiatan
  dokJudul?: string;
  dokTanggal?: string;
  dokTempat?: string;
  dokPelaksana?: string;
  dokCatatan?: string;
  dokFoto?: SpjFotoItem[];
  // Invoice
  noInvoice?: string;
  tglInvoice?: string;
  jatuhTempo?: string;
  metodeBayar?: string;
  ppnInvoice?: number;
  statusInvoice?: string;
}

export interface KeuanganState {
  settings: {
    bendaharaNama: string;
    bendaharaNip: string;
    sumberDana: string;
    kota: string;
    prefix: string;
    pemdaTitle?: string;
    tahunAnggaran?: string;
    ukuranKwitansi?: 'kecil' | 'sedang';
    warnaKwitansi?: 'biru' | 'hijau' | 'kuning' | 'merah' | 'ungu' | 'abu';
    previewGambar?: boolean;
    printGambar?: boolean;
    pajakOtomatis?: boolean;
    tarifPpn?: number;
    tarifPph21Default?: number;
    defaultNpwp?: boolean;
  };
  bku: Array<{
    id: string;
    tgl: string;
    noBukti: string;
    uraian: string;
    pengeluaran: number;
    kodeRek?: string;
  }>;
  edits: Record<string, KeuanganEditRow>;
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

export interface PpdbParticipant {
  id: string;
  // A. Keterangan Anak
  nama_lengkap: string;
  nama_panggilan: string;
  jenis_kelamin: string;
  tanggal_lahir: string;
  tempat_lahir: string;
  agama: string;
  kewarganegaraan: string;
  anak_nomor_ke: string;
  saudara_kandung: string;
  saudara_tiri: string;
  saudara_angkat: string;
  bahasa_sehari_hari: string;
  berat_badan: string;
  tinggi_badan: string;
  golongan_darah: string;
  penyakit: string;
  alamat: string;
  alamat_2: string;
  tempat_tinggal: string;
  jarak_sekolah: string;
  // B. Keterangan Orang Tua/Wali
  nama_ayah: string;
  nama_ibu: string;
  pendidikan_ayah: string;
  pendidikan_ibu: string;
  pekerjaan_orangtua: string;
  nama_wali: string;
  pendidikan_wali: string;
  hubungan_wali: string;
  pekerjaan_wali: string;
  // C. Asal Mula Anak
  status_masuk: string;
  asal_anak: string;
  nama_tk: string;
  sttb: string;
  lama_belajar: string;
  sekolah_asal: string;
  sekolah_asal_lokasi: string;
  tanggal_pindahan: string;
  dari_kelas: string;
  tanggal_diterima: string;
  kelas_diterima: string;
  tanggal_surat: string;
  createdAt?: number;
  updatedAt?: number;
}


