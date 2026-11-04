/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pembuat skrip SQL Supabase. Murni fungsi (tanpa API browser) supaya bisa dipakai
 * di aplikasi maupun di terminal (`npm run sql`).
 *
 * Supabase hanya menyimpan TEKS: satu tabel key-value JSONB (`<prefix>app_store`).
 * Foto dan berkas (PDF, gambar, Word) disimpan di ImageKit, bukan di Supabase.
 */

export interface SqlScriptOptions {
  /** Awalan nama tabel, mis. "mo_" -> mo_app_store. Boleh kosong. */
  tablePrefix?: string;
  /** Nama proyek, hanya untuk komentar di kepala skrip. */
  projectName?: string;
  /** Project ref Supabase, hanya untuk komentar. */
  projectId?: string;
}

/** Hanya huruf kecil, angka, underscore; diawali huruf. Karakter lain dibuang agar aman dipakai sebagai nama tabel. */
export function sanitizeTablePrefix(raw: string | undefined): string {
  let p = String(raw ?? 'mo_').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (p && !/^[a-z]/.test(p)) p = 't' + p;
  return p;
}

export function getStoreTableName(prefix: string | undefined): string {
  return `${sanitizeTablePrefix(prefix)}app_store`;
}

/** Nama tabel berkas versi lama (isi berkas base64). Tidak dipakai lagi; hanya dibaca saat migrasi ke ImageKit. */
export function getLegacyFilesTableName(prefix: string | undefined): string {
  return `${sanitizeTablePrefix(prefix)}files`;
}

export function buildSupabaseSql(opts: SqlScriptOptions = {}): string {
  const prefix = sanitizeTablePrefix(opts.tablePrefix);
  const t = getStoreTableName(prefix);
  const legacy = getLegacyFilesTableName(prefix);
  const name = opts.projectName || 'Meja Operator';
  const ref = opts.projectId ? `-- Project ref : ${opts.projectId}\n` : '';

  return `-- ============================================================
-- SKRIP SUPABASE UNTUK "${name}"
${ref}-- Awalan tabel: "${prefix}"  ->  tabel ${t}
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
CREATE TABLE IF NOT EXISTS public.${t} (
  id         TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Keamanan (Row Level Security)
ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "${t}_select" ON public.${t};
DROP POLICY IF EXISTS "${t}_write"  ON public.${t};
-- Nama kebijakan versi lama (dibersihkan bila ada)
DROP POLICY IF EXISTS "Public Read All App Data"   ON public.${t};
DROP POLICY IF EXISTS "Public Upsert All App Data" ON public.${t};

CREATE POLICY "${t}_select" ON public.${t}
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "${t}_write" ON public.${t}
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.${t} TO anon, authenticated;

-- 3. Muat ulang schema cache API agar tabel langsung terbaca
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- OPSIONAL - jalankan HANYA setelah tombol "Migrasi berkas lama ke ImageKit"
-- di aplikasi selesai dan semua berkas sudah terbuka dari ImageKit.
-- Tabel lama untuk isi berkas (base64) tidak dipakai lagi:
--
-- DROP TABLE IF EXISTS public.${legacy};
-- ------------------------------------------------------------
`;
}
