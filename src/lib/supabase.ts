/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';
import { CLOUD_DEFAULTS } from '../config/cloud.config';
import { buildSupabaseSql, getStoreTableName, sanitizeTablePrefix } from './sqlScript';

/** project ref = bagian pertama host, mis. abcd1234 dari https://abcd1234.supabase.co */
export function deriveProjectId(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  projectName: CLOUD_DEFAULTS.supabase.projectName,
  projectId: deriveProjectId(CLOUD_DEFAULTS.supabase.projectUrl),
  projectUrl: CLOUD_DEFAULTS.supabase.projectUrl,
  apiKey: CLOUD_DEFAULTS.supabase.apiKey,
  tablePrefix: sanitizeTablePrefix(CLOUD_DEFAULTS.supabase.tablePrefix),
  autoSync: true,
  lastSyncedAt: undefined,
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

function normalizeConfig(raw: Partial<SupabaseConfig>): SupabaseConfig {
  const merged = { ...DEFAULT_SUPABASE_CONFIG, ...raw };
  const projectUrl = cleanSupabaseUrl(merged.projectUrl || DEFAULT_SUPABASE_CONFIG.projectUrl);
  return {
    ...merged,
    projectUrl,
    projectId: deriveProjectId(projectUrl) || merged.projectId,
    tablePrefix: sanitizeTablePrefix(merged.tablePrefix),
  };
}

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-purge old dead demo url atau konfigurasi kosong agar perangkat lain otomatis ikut konfigurasi sekolah saat ini
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.projectUrl ||
        parsed.projectUrl.includes('qpjgokdxoevjjcrrazqh.supabase.co') ||
        !parsed.apiKey
      ) {
        localStorage.removeItem(STORAGE_KEY_CONFIG);
        return normalizeConfig({});
      }
      return normalizeConfig(parsed);
    }
  } catch (e) {
    console.warn('Failed to read Supabase config from storage:', e);
  }
  return normalizeConfig({});
}

export function saveSupabaseConfig(cfg: Partial<SupabaseConfig>): SupabaseConfig {
  const updated = normalizeConfig({ ...getSupabaseConfig(), ...cfg });
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  reinitializeSupabaseClient();
  return updated;
}

/** Hapus kredensial tersimpan di browser ini -> kembali ke nilai dari .env / cloud.config.ts. */
export function resetSupabaseConfig(): SupabaseConfig {
  try {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  } catch {}
  reinitializeSupabaseClient();
  return getSupabaseConfig();
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
 * Menguji koneksi langsung ke tabel penyimpanan aplikasi mo_app_store.
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
    const response = await fetch(`${url}/rest/v1/${getStoreTable()}?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
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
        message: `Server Supabase terjangkau dan key valid, tetapi tabel "${getStoreTable()}" belum dibuat. Buka tab "Skrip SQL Supabase", salin, lalu jalankan di SQL Editor Supabase.`,
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
    const isDefaultDemoUrl = url.includes('qpjgokdxoevjjcrrazqh.supabase.co');
    return {
      connected: false,
      latencyMs,
      message: isDefaultDemoUrl
        ? `Laptop/perangkat ini belum tersambung ke database sekolah Anda (masih menggunakan URL bawaan). Di laptop utama, buka menu Koneksi Supabase > Salin tautan pengaturan, lalu buka tautan tersebut di laptop ini. Atau buka tab Kredensial dan masukkan Project URL & Key Supabase sekolah Anda.`
        : `Tidak dapat menghubungi ${url}. Periksa koneksi internet, Project URL, dan pastikan proyek Supabase tidak sedang dijeda (paused). (${msg})`,
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
 * Tabel penyimpanan data (satu baris JSONB per modul). Namanya mengikuti awalan tabel di konfigurasi,
 * jadi berganti proyek / awalan tidak perlu mengubah kode.
 */
export function getStoreTable(): string {
  return getStoreTableName(getSupabaseConfig().tablePrefix);
}

/**
 * Hapus password dari data pengguna sebelum dikirim ke cloud,
 * supaya password operator/guru tidak tersimpan di database yang bisa dibaca publik.
 */
function sanitizeForCloud(key: string, val: unknown): unknown {
  if (Array.isArray(val) && /user/i.test(key)) {
    return val.map((u) => {
      if (u && typeof u === 'object') {
        const { password: _pw, passwordHash: _ph, passwordSalt: _ps, ...rest } = u as Record<string, unknown>;
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

    const { error } = await client.from(getStoreTable()).upsert(rows, { onConflict: 'id' });

    if (error) {
      if (isMissingTableError(error.code || '', error.message || '', 0)) {
        return {
          success: false,
          message: `Tabel "${getStoreTable()}" belum dibuat di Supabase. Jalankan skrip SQL di tab "Skrip SQL Supabase".`,
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
      .from(getStoreTable())
      .select('id, data, updated_at');

    if (error) {
      if (isMissingTableError(error.code || '', error.message || '', 0)) {
        return {
          success: false,
          data: null,
          message: `Tabel "${getStoreTable()}" belum ada di Supabase. Anda dapat membuat tabel dengan menyalin script SQL di tab Pengaturan.`,
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
    const { data, error } = await getSupabaseClient().from(getStoreTable()).select('id, updated_at');
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
      .from(getStoreTable())
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
      .from(getStoreTable())
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
 * Skrip SQL siap tempel untuk Supabase SQL Editor, mengikuti konfigurasi saat ini
 * (awalan tabel, nama proyek). Hanya tabel teks; berkas ada di ImageKit.
 */
export function generateSupabaseSQLScript(): string {
  const cfg = getSupabaseConfig();
  return buildSupabaseSql({
    tablePrefix: cfg.tablePrefix,
    projectName: cfg.projectName,
    projectId: cfg.projectId,
  });
}

/** Tautan langsung ke SQL Editor proyek yang sedang dipakai. */
export function getSqlEditorUrl(): string {
  const id = getSupabaseConfig().projectId;
  return id ? `https://supabase.com/dashboard/project/${id}/sql/new` : 'https://supabase.com/dashboard';
}
