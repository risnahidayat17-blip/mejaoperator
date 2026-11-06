-- ============================================================
-- SKRIP SUPABASE UNTUK "Meja Operator"
-- Awalan tabel: "mo_"  ->  tabel mo_app_store
-- Aman dijalankan berulang (idempotent). Jalankan di Supabase > SQL Editor > Run.
--
-- Supabase hanya menyimpan TEKS (data aplikasi dalam format JSON).
-- Foto dan berkas dokumen disimpan di ImageKit.
--
-- PINDAH AKUN SUPABASE:
--   1. Buat proyek baru di supabase.com, buka SQL Editor, tempel & Run skrip ini.
--   2. Di aplikasi: Koneksi Supabase > Kredensial > isi Project URL + Publishable key > Simpan.
--   3. Tab Sinkronisasi Cloud > "Unggah ke Cloud Sekarang" (memindahkan semua data dari perangkat ini).
-- ============================================================

-- 1. Tabel penyimpanan data aplikasi (satu baris per modul data)
CREATE TABLE IF NOT EXISTS public.mo_app_store (
  id         TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Keamanan (Row Level Security)
ALTER TABLE public.mo_app_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mo_app_store_select" ON public.mo_app_store;
DROP POLICY IF EXISTS "mo_app_store_write"  ON public.mo_app_store;
-- Nama kebijakan versi lama (dibersihkan bila ada)
DROP POLICY IF EXISTS "Public Read All App Data"   ON public.mo_app_store;
DROP POLICY IF EXISTS "Public Upsert All App Data" ON public.mo_app_store;

CREATE POLICY "mo_app_store_select" ON public.mo_app_store
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mo_app_store_write" ON public.mo_app_store
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mo_app_store TO anon, authenticated;

-- 3. Muat ulang schema cache API agar tabel langsung terbaca
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- OPSIONAL - jalankan HANYA setelah tombol "Migrasi berkas lama ke ImageKit"
-- di aplikasi selesai dan semua berkas sudah terbuka dari ImageKit.
-- Tabel lama untuk isi berkas (base64) tidak dipakai lagi:
--
-- DROP TABLE IF EXISTS public.mo_files;
-- ------------------------------------------------------------
