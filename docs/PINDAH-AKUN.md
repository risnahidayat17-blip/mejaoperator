# Pindah akun Supabase / ImageKit

Pembagian tugas penyimpanan:

| Data | Disimpan di |
| --- | --- |
| Semua data teks (siswa, GTK, surat, aset, nilai, keuangan, pengaturan) dan **alamat URL** berkas | **Supabase** (satu tabel `mo_app_store`, format JSON) |
| Foto surat masuk, logo, dan berkas dokumen (PDF, gambar, Word) | **ImageKit** |

Isi berkas tidak lagi masuk ke Supabase.

## A. Ganti akun Supabase

1. Buat proyek baru di supabase.com.
2. Buka **SQL Editor**, tempel isi `supabase/setup.sql` (atau salin dari aplikasi: *Koneksi Supabase > Skrip SQL Supabase*), klik **Run**. Skrip aman dijalankan berulang.
3. Salin **Project URL** dan **Publishable key** (Project Settings > API Keys).
4. Pilih salah satu:
   - **Tanpa build ulang** — di aplikasi: *Koneksi Supabase > Kredensial*, isi URL + key, **Simpan**. Berlaku untuk browser itu saja.
   - **Semua perangkat sekaligus** — ubah `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di `.env` (atau Secrets AI Studio), lalu build/deploy ulang.
5. Di perangkat operator: *Sinkronisasi Cloud > Unggah ke Cloud Sekarang* untuk memindahkan seluruh data ke akun baru.

Ingin awalan tabel lain (misal satu proyek untuk dua sekolah)? Isi **Awalan tabel** (atau `VITE_SUPABASE_TABLE_PREFIX`), lalu buat skripnya:

```
npm run sql -- --prefix=sd2_ --out=supabase/setup-sd2.sql
```

## B. Pasang / ganti akun ImageKit

1. Daftar di imagekit.io. Dari **Developer options** catat *Public Key*, *Private Key*, dan *URL endpoint*.
2. Pasang auth endpoint (gratis): ikuti petunjuk di bagian atas `imagekit/apps-script-auth.gs`.
   Private Key hanya disimpan di *Script Properties* Google, tidak pernah di aplikasi.
3. Isi di aplikasi (*Koneksi Supabase > ImageKit*) atau di `.env` (`VITE_IMAGEKIT_*`), lalu **Tes**.
4. Ganti akun ImageKit nanti = ulangi langkah 1–3 dengan akun baru. Berkas lama tetap terbuka dari URL lamanya selama akun lama aktif.

## C. Memindahkan berkas lama (dari mo_files) ke ImageKit

Di perangkat operator: *Koneksi Supabase > ImageKit > Migrasi ke ImageKit*. Tombol ini memindahkan berkas dokumen GTK, arsip absen,
foto surat masuk, dan logo, lalu menyimpan URL-nya. Aman diulang. Setelah semua berkas terbuka dari ImageKit, tabel lama boleh dihapus
(perintahnya ada di komentar bagian bawah skrip SQL).
