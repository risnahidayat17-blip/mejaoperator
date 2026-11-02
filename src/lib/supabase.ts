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
 * Test connectivity to the Supabase endpoint
 */
export async function testSupabaseConnection(overrideConfig?: Partial<SupabaseConfig>): Promise<{
  connected: boolean;
  latencyMs: number;
  message: string;
  statusCode?: number;
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
    // Ping the Supabase REST root endpoint or schema endpoint with publishable key
    const endpoint = `${url}/rest/v1/`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    });
    const latencyMs = Math.round(performance.now() - startTime);

    if (response.ok || response.status === 200 || response.status === 404 || response.status === 401) {
      if (response.status === 401) {
        return {
          connected: false,
          latencyMs,
          statusCode: 401,
          message: 'Server Supabase terjangkau, namun Public API Key tidak valid / kadaluarsa.',
        };
      }
      return {
        connected: true,
        latencyMs,
        statusCode: response.status,
        message: `Terhubung ke Supabase (${config.projectName || 'Meja Operator'}) \u2014 Latensi: ${latencyMs} ms`,
      };
    }

    return {
      connected: false,
      latencyMs,
      statusCode: response.status,
      message: `Menerima status HTTP ${response.status} dari server Supabase (${response.statusText}).`,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      latencyMs,
      message: `Gagal terhubung ke ${url}. Pastikan koneksi internet aktif atau periksa Project URL. (${msg})`,
    };
  }
}

/**
 * Universal Unified Table name used for seamless synchronization
 * (Single JSONB key-value row per data module, requiring zero complex schema migrations)
 */
export const UNIFIED_TABLE_NAME = 'mo_app_store';

/**
 * Sync entire local state into Supabase cloud
 */
export async function pushAllToSupabase(payload: Record<string, unknown>): Promise<{
  success: boolean;
  message: string;
  count: number;
}> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  try {
    // We attempt upserting each key into UNIFIED_TABLE_NAME:
    // table schema: id (text primary key), data (jsonb), updated_at (timestamptz)
    let syncedModules = 0;
    const entries = Object.entries(payload);

    for (const [key, val] of entries) {
      const { error } = await client
        .from(UNIFIED_TABLE_NAME)
        .upsert({
          id: key,
          data: val,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        // If the table doesn't exist yet, we catch it and inform the user
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return {
            success: false,
            message: `Tabel "${UNIFIED_TABLE_NAME}" belum dibuat di Supabase. Silakan jalankan script SQL migrasi di tab Pengaturan Supabase.`,
            count: 0
          };
        }
        throw error;
      }
      syncedModules++;
    }

    saveSupabaseConfig({ lastSyncedAt: Date.now() });

    return {
      success: true,
      message: `Berhasil mengunggah ${syncedModules} modul data ke database Supabase Cloud.`,
      count: syncedModules,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
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
export async function pullAllFromSupabase(): Promise<{
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
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
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
      result[row.id] = row.data;
    }

    saveSupabaseConfig({ lastSyncedAt: Date.now() });

    return {
      success: true,
      data: result,
      message: `Berhasil mengambil ${data.length} modul data dari Supabase Cloud.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: null,
      message: `Gagal mengunduh dari Supabase: ${msg}`,
    };
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

-- Izinkan read & write untuk pengguna anonim dengan API Key public
CREATE POLICY "Public Read All App Data" ON public.mo_app_store
  FOR SELECT USING (true);

CREATE POLICY "Public Upsert All App Data" ON public.mo_app_store
  FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "Public Read Surat Keluar" ON public.surat_keluar FOR SELECT USING (true);
CREATE POLICY "Public Write Surat Keluar" ON public.surat_keluar FOR ALL USING (true) WITH CHECK (true);

-- Selesai! Klik "Run" di SQL Editor Supabase Anda.
`;
}
