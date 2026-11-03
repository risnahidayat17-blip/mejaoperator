/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, SupabaseSyncStatus } from '../types';

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  projectName: "Meja Operator",
  projectId: "qpjgokdxoevjjcrrazqh",
  projectUrl: "https://qpjgokdxoevjjcrrazqh.supabase.co",
  apiKey: "sb_publishable_LdhXxUBlwAM-QrrVaKTQTw_HNPrHSlc",
  autoSync: true,
  lastSyncedAt: undefined
};

const STORAGE_KEY_CONFIG = 'mo_supabase_config';
const STORAGE_KEY_SYNC_STATE = 'mo_supabase_sync_state';

// Clean the URL: strip /rest/v1 or trailing slashes
export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/\/rest\/v1\/?$/, '');
  url = url.replace(/\/+$/, '');
  return url;
}

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_SUPABASE_CONFIG,
        ...parsed,
        projectUrl: cleanSupabaseUrl(parsed.projectUrl || DEFAULT_SUPABASE_CONFIG.projectUrl),
      };
    }
  } catch (e) {
    console.warn('Failed to read Supabase config from storage:', e);
  }
  return {
    ...DEFAULT_SUPABASE_CONFIG,
    projectUrl: cleanSupabaseUrl(DEFAULT_SUPABASE_CONFIG.projectUrl),
  };
}

export function saveSupabaseConfig(cfg: Partial<SupabaseConfig>): SupabaseConfig {
  const current = getSupabaseConfig();
  const updated: SupabaseConfig = {
    ...current,
    ...cfg,
    projectUrl: cleanSupabaseUrl(cfg.projectUrl || current.projectUrl),
  };
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  reinitializeSupabaseClient();
  return updated;
}

// Global Supabase client instance
let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    const config = getSupabaseConfig();
    supabaseClientInstance = createClient(config.projectUrl, config.apiKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseClientInstance;
}

export function reinitializeSupabaseClient(): SupabaseClient {
  const config = getSupabaseConfig();
  supabaseClientInstance = createClient(config.projectUrl, config.apiKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return supabaseClientInstance;
}

/**
 * Test connectivity to Supabase.
 * Catatan: key baru "sb_publishable_..." TIDAK boleh membaca root /rest/v1/ (OpenAPI schema),
 * jadi tes dilakukan langsung ke tabel penyimpanan aplikasi. Key juga hanya dikirim lewat
 * header "apikey" (bukan Bearer), karena bukan JWT.
 */
export async function testSupabaseConnection(overrideConfig?: Partial<SupabaseConfig>): Promise<{
  connected: boolean;
  latencyMs: number;
  message: string;
  statusCode?: number;
  tableReady?: boolean;
}> {
  const config = overrideConfig ? { ...getSupabaseConfig(), ...overrideConfig } : getSupabaseConfig();
  const url = cleanSupabaseUrl(config.projectUrl);
  const key = config.apiKey;

  if (!url || !key) {
    return {
      connected: false,
      latencyMs: 0,
      message: 'Project URL atau Public API Key belum diisi.',
    };
  }

  const startTime = performance.now();
  try {
    const response = await fetch(`${url}/rest/v1/${UNIFIED_TABLE_NAME}?select=id&limit=1`, {
      method: 'GET',
      headers: { apikey: key, Accept: 'application/json' },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    let body: { code?: string; message?: string } = {};
    try {
      body = await response.json();
    } catch {
      /* body bukan JSON */
    }
    const code = body?.code || '';
    const detail = body?.message || response.statusText;

    if (response.ok) {
      return {
        connected: true,
        tableReady: true,
        latencyMs,
        statusCode: response.status,
        message: `Terhubung ke Supabase (${config.projectName || 'Meja Operator'}) \u2014 Latensi: ${latencyMs} ms`,
      };
    }

    if (isMissingTableError(code, detail, response.status)) {
      return {
        connected: true,
        tableReady: false,
        latencyMs,
        statusCode: response.status,
        message: `Server Supabase terjangkau dan key valid, tetapi tabel "${UNIFIED_TABLE_NAME}" belum dibuat. Buka tab "Skrip SQL Supabase", salin, lalu jalankan di SQL Editor Supabase.`,
      };
    }

    if (code === '42501' || /row-level security|permission denied/i.test(detail)) {
      return {
        connected: true,
        tableReady: false,
        latencyMs,
        statusCode: response.status,
        message: 'Server terjangkau, tetapi akses tabel ditolak (RLS). Jalankan ulang skrip SQL di tab "Skrip SQL Supabase" agar policy akses dibuat.',
      };
    }

    if (response.status === 401 || response.status === 403 || /api key|jwt/i.test(detail)) {
      return {
        connected: false,
        latencyMs,
        statusCode: response.status,
        message: `Public API Key ditolak Supabase (${detail}). Salin ulang key "Publishable" dari Supabase \u2192 Project Settings \u2192 API Keys.`,
      };
    }

    return {
      connected: false,
      latencyMs,
      statusCode: response.status,
      message: `Supabase membalas HTTP ${response.status}: ${detail}`,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      latencyMs,
      message: `Tidak dapat menghubungi ${url}. Periksa koneksi internet, Project URL, dan pastikan proyek Supabase tidak sedang dijeda (paused). (${msg})`,
    };
  }
}

function isMissingTableError(code: string, message: string, status: number): boolean {
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    status === 404 ||
    /does not exist|could not find the table|schema cache/i.test(message || '')
  );
}

/**
 * Universal Unified Table name used for seamless synchronization
 * (Single JSONB key-value row per data module, requiring zero complex schema migrations)
 */
export const UNIFIED_TABLE_NAME = 'mo_app_store';

/**
 * Hapus password dari data pengguna sebelum dikirim ke cloud,
 * supaya password operator/guru tidak tersimpan di database yang bisa dibaca publik.
 */
function sanitizeForCloud(key: string, val: unknown): unknown {
  if (Array.isArray(val) && /user/i.test(key)) {
    return val.map((u) => {
      if (u && typeof u === 'object') {
        const { password: _pw, ...rest } = u as Record<string, unknown>;
        return rest;
      }
      return u;
    });
  }
  return val;
}

/** Kunci penyimpanan akun pengguna: tidak ikut ditimpa saat unduh dari cloud. */
function isUserKey(key: string): boolean {
  return /user/i.test(key);
}

/**
 * Sync entire local state into Supabase cloud
 */
export async function pushAllToSupabase(payload: Record<string, unknown>): Promise<{
  success: boolean;
  message: string;
  count: number;
}> {
  const client = getSupabaseClient();

  try {
    const now = new Date().toISOString();
    const rows = Object.entries(payload).map(([key, val]) => ({
      id: key,
      data: sanitizeForCloud(key, val),
      updated_at: now,
    }));

    const { error } = await client.from(UNIFIED_TABLE_NAME).upsert(rows, { onConflict: 'id' });

    if (error) {
      if (isMissingTableError(error.code || '', error.message || '', 0)) {
        return {
          success: false,
          message: `Tabel "${UNIFIED_TABLE_NAME}" belum dibuat di Supabase. Jalankan skrip SQL di tab "Skrip SQL Supabase".`,
          count: 0,
        };
      }
      if (error.code === '42501') {
        return {
          success: false,
          message: 'Akses tulis ditolak (RLS). Jalankan ulang skrip SQL di tab "Skrip SQL Supabase".',
          count: 0,
        };
      }
      throw error;
    }

    saveSupabaseConfig({ lastSyncedAt: Date.now() });

    return {
      success: true,
      message: `Berhasil mengunggah ${rows.length} modul data ke database Supabase Cloud.`,
      count: rows.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || String(err);
    return {
      success: false,
      message: `Gagal sinkronisasi ke Supabase: ${msg}`,
      count: 0,
    };
  }
}

/**
 * Pull all records from Supabase cloud into local storage
 */
export async function pullAllFromSupabase(quiet = false): Promise<{
  success: boolean;
  data: Record<string, unknown> | null;
  message: string;
}> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from(UNIFIED_TABLE_NAME)
      .select('id, data, updated_at');

    if (error) {
      if (isMissingTableError(error.code || '', error.message || '', 0)) {
        return {
          success: false,
          data: null,
          message: `Tabel "${UNIFIED_TABLE_NAME}" belum ada di Supabase. Anda dapat membuat tabel dengan menyalin script SQL di tab Pengaturan.`,
        };
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        data: {},
        message: 'Tabel Supabase masih kosong. Anda dapat mengunggah data lokal saat ini ke cloud.',
      };
    }

    const result: Record<string, unknown> = {};
    for (const row of data) {
      if (isUserKey(row.id)) continue; // akun & password tetap lokal
      result[row.id] = row.data;
    }

    if (!quiet) saveSupabaseConfig({ lastSyncedAt: Date.now() });

    return {
      success: true,
      data: result,
      message: `Berhasil mengambil ${data.length} modul data dari Supabase Cloud.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || String(err);
    return {
      success: false,
      data: null,
      message: `Gagal mengunduh dari Supabase: ${msg}`,
    };
  }
}

/** Ambil daftar modul di cloud beserta waktu ubahnya (ringan, tanpa isi data). */
export async function fetchRemoteMeta(): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await getSupabaseClient().from(UNIFIED_TABLE_NAME).select('id, updated_at');
    if (error || !data) return null;
    const out: Record<string, string> = {};
    for (const r of data) out[r.id] = String(r.updated_at);
    return out;
  } catch {
    return null;
  }
}

/** Ambil isi beberapa modul sekaligus. Mengembalikan { id: { data, updated_at } }. */
export async function fetchRemoteRows(
  ids: string[]
): Promise<Record<string, { data: unknown; updated_at: string }> | null> {
  if (ids.length === 0) return {};
  try {
    const { data, error } = await getSupabaseClient()
      .from(UNIFIED_TABLE_NAME)
      .select('id, data, updated_at')
      .in('id', ids);
    if (error || !data) return null;
    const out: Record<string, { data: unknown; updated_at: string }> = {};
    for (const r of data) out[r.id] = { data: r.data, updated_at: String(r.updated_at) };
    return out;
  } catch {
    return null;
  }
}

/** Tulis beberapa modul sekaligus. */
export async function upsertRemoteRows(rows: Array<{ id: string; data: unknown }>): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const now = new Date().toISOString();
    const { error } = await getSupabaseClient()
      .from(UNIFIED_TABLE_NAME)
      .upsert(
        rows.map((r) => ({ id: r.id, data: sanitizeForCloud(r.id, r.data), updated_at: now })),
        { onConflict: 'id' }
      );
    if (error) return false;
    saveSupabaseConfig({ lastSyncedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates ready-to-run PostgreSQL DDL for Supabase SQL Editor
 */
export function generateSupabaseSQLScript(): string {
  return `-- ============================================================
-- SKRIP MIGRASI SUPABASE UNTUK PROYEK "Meja Operator"
-- Proyek ID: qpjgokdxoevjjcrrazqh
-- ============================================================

-- 1. Tabel Utama Sinkronisasi Aplikasi (JSONB Data Store)
CREATE TABLE IF NOT EXISTS public.mo_app_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.mo_app_store ENABLE ROW LEVEL SECURITY;

-- Izinkan read & write untuk key publishable (aman dijalankan berulang)
DROP POLICY IF EXISTS "Public Read All App Data" ON public.mo_app_store;
DROP POLICY IF EXISTS "Public Upsert All App Data" ON public.mo_app_store;
CREATE POLICY "Public Read All App Data" ON public.mo_app_store
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Upsert All App Data" ON public.mo_app_store
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mo_app_store TO anon, authenticated;

-- 1b. Tabel Berkas (PDF absen, dokumen GTK). WAJIB agar berkas bisa dibuka dari perangkat lain.
CREATE TABLE IF NOT EXISTS public.mo_files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  data TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.mo_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public All Files" ON public.mo_files;
CREATE POLICY "Public All Files" ON public.mo_files
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mo_files TO anon, authenticated;

-- 2. Optional: Tabel Relasional Siswa (Untuk Query SQL Lanjutan)
CREATE TABLE IF NOT EXISTS public.siswa (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  nis TEXT,
  nisn TEXT,
  jk TEXT DEFAULT 'L',
  kelas TEXT NOT NULL,
  status TEXT DEFAULT 'Aktif',
  tahun_masuk INTEGER,
  alamat TEXT,
  nama_ayah TEXT,
  nama_ibu TEXT,
  telp_ortu TEXT,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Siswa" ON public.siswa;
DROP POLICY IF EXISTS "Public Write Siswa" ON public.siswa;
CREATE POLICY "Public Read Siswa" ON public.siswa FOR SELECT USING (true);
CREATE POLICY "Public Write Siswa" ON public.siswa FOR ALL USING (true) WITH CHECK (true);

-- 3. Optional: Tabel Relasional Guru & Tendik (GTK)
CREATE TABLE IF NOT EXISTS public.guru (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  nip TEXT,
  nuptk TEXT,
  jk TEXT DEFAULT 'L',
  jabatan TEXT NOT NULL,
  status_peg TEXT DEFAULT 'PNS',
  mengampu TEXT,
  pendidikan TEXT,
  status TEXT DEFAULT 'Aktif',
  telp TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.guru ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Guru" ON public.guru;
DROP POLICY IF EXISTS "Public Write Guru" ON public.guru;
CREATE POLICY "Public Read Guru" ON public.guru FOR SELECT USING (true);
CREATE POLICY "Public Write Guru" ON public.guru FOR ALL USING (true) WITH CHECK (true);

-- 4. Optional: Tabel Surat Keluar & Surat Masuk
CREATE TABLE IF NOT EXISTS public.surat_keluar (
  id TEXT PRIMARY KEY,
  no_agenda TEXT,
  no_surat TEXT NOT NULL,
  tgl_surat DATE,
  jenis TEXT,
  perihal TEXT NOT NULL,
  penandatangan TEXT,
  isi TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.surat_keluar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Surat Keluar" ON public.surat_keluar;
DROP POLICY IF EXISTS "Public Write Surat Keluar" ON public.surat_keluar;
CREATE POLICY "Public Read Surat Keluar" ON public.surat_keluar FOR SELECT USING (true);
CREATE POLICY "Public Write Surat Keluar" ON public.surat_keluar FOR ALL USING (true) WITH CHECK (true);

-- Muat ulang schema cache API agar tabel langsung terbaca
NOTIFY pgrst, 'reload schema';

-- Selesai! Klik "Run" di SQL Editor Supabase Anda.
`;
}
