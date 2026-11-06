/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  SchoolConfig,
  Siswa,
  Guru,
  DokumenGtk,
  Aset,
  BmdItem,
  StikerConfig,
  SuratMasuk,
  SuratKeluar,
  Mutasi,
  NilaiRecord,
  BerkasPenilaian,
  LaporanBulan,
  LetterTemplate,
  ArsipAbsen,
  KeuanganState,
  WorkActivity,
} from '../types';
import {
  initialUsers,
  initialSchoolConfig,
  initialSiswas,
  initialGurus,
  initialAsets,
  initialBmd,
  initialStikerConfig,
  initialSuratMasuk,
  initialSuratKeluar,
  initialMutasi,
  initialLetterTemplates,
} from '../data/initialData';
import {
  getSupabaseConfig,
  fetchRemoteMeta,
  fetchRemoteRows,
  upsertRemoteRows,
} from './supabase';
import { saveFile, deleteFile, newRecordId, getFileDataUrl, setFileUploadedHandler } from './files';
import { hashPassword, verifyPassword } from './auth';
import { isImageKitReady, uploadToImageKit, uploadDataUrlToImageKit, dataUrlToBlob } from './imagekit';

export const KEYS = {
  USERS: 'mo_users',
  CURRENT_USER: 'mo_current_user',
  CFG: 'mo_school_config',
  SISWA: 'mo_siswa',
  GURU: 'mo_guru',
  DOKGTK: 'mo_dokgtk',
  ASET: 'mo_aset',
  BMD: 'mo_bmd',
  STIKER: 'mo_stiker_cfg',
  SURATMASUK: 'mo_suratmasuk',
  SURATKELUAR: 'mo_suratkeluar',
  MUTASI: 'mo_mutasi',
  NILAI: 'mo_nilai',
  BERKAS: 'mo_berkas',
  LAPORAN: 'mo_laporan',
  TEMPLATES: 'mo_letter_templates',
  ARSIPABSEN: 'mo_arsip_absen',
  KEUANGAN: 'mo_keuangan',
  ACTIVITIES: 'mo_activities',
};

const listeners = new Set<() => void>();

export function subscribeToStorage(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Storage listener error:', e);
    }
  });
}

export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ---------------------------------------------------------------------------
// Sinkronisasi Supabase dua arah (per modul data)
// - Setiap perubahan lokal hanya mengunggah modul yang berubah (bukan semuanya),
//   sehingga perubahan guru tidak menimpa modul milik operator.
// - Perubahan dari perangkat lain diambil otomatis (saat dibuka, tiap 15 detik,
//   dan saat jendela kembali aktif).
// ---------------------------------------------------------------------------
const SYNC_SKIP_KEYS = new Set<string>([KEYS.CURRENT_USER]);
const TOMB_PREFIX = 'del:';
const TOMB_LS_KEY = 'mo_tombstones';
const TOMB_TTL_MS = 120 * 24 * 3600 * 1000;
const pendingPushKeys = new Set<string>();
const replaceKeys = new Set<string>(); // modul yang harus MENGGANTI isi cloud (bukan digabung)
const lastSeen: Record<string, string> = {};
let pushTimer: any = null;
let pushing = false;

type Tombs = Record<string, number>;
type AnyItem = { id: string; updatedAt?: number } & Record<string, unknown>;

const cloudListeners = new Set<() => void>();
export function subscribeToCloudChanges(cb: () => void): () => void {
  cloudListeners.add(cb);
  return () => {
    cloudListeners.delete(cb);
  };
}

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return (
      '{' +
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableStringify(o[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v);
}

function isItemArray(v: unknown): v is AnyItem[] {
  return Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as AnyItem).id === 'string');
}

// --- Penanda hapus (tombstone) agar penghapusan di satu perangkat ikut ke perangkat lain ---
function readAllTombs(): Record<string, Tombs> {
  try {
    return JSON.parse(localStorage.getItem(TOMB_LS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function writeAllTombs(all: Record<string, Tombs>): void {
  try {
    localStorage.setItem(TOMB_LS_KEY, JSON.stringify(all));
  } catch {}
}
function mergeTombs(a: Tombs, b: Tombs): Tombs {
  const out: Tombs = { ...a };
  const cutoff = Date.now() - TOMB_TTL_MS;
  for (const [id, ts] of Object.entries(b || {})) {
    if (typeof ts === 'number' && (out[id] === undefined || ts > out[id])) out[id] = ts;
  }
  for (const id of Object.keys(out)) if (out[id] < cutoff) delete out[id];
  return out;
}
function recordDeletions(key: string, oldRaw: string | null, next: unknown): void {
  if (!oldRaw || !isItemArray(next)) return;
  try {
    const old = JSON.parse(oldRaw);
    if (!isItemArray(old)) return;
    const keep = new Set(next.map((x) => x.id));
    const removed = old.filter((x) => !keep.has(x.id)).map((x) => x.id);
    if (removed.length === 0) return;
    const all = readAllTombs();
    const now = Date.now();
    const cur = all[key] || {};
    removed.forEach((id) => (cur[id] = now));
    all[key] = mergeTombs(cur, {});
    writeAllTombs(all);
  } catch {}
}

/** Gabungkan daftar cloud dan lokal per id: yang updatedAt-nya lebih baru menang; yang dihapus tidak muncul lagi. */
function mergeLists(remote: AnyItem[], local: AnyItem[], tombs: Tombs): AnyItem[] {
  const map = new Map<string, AnyItem>();
  const order: string[] = [];
  for (const r of remote) {
    if (!map.has(r.id)) order.push(r.id);
    map.set(r.id, r);
  }
  for (const l of local) {
    const r = map.get(l.id);
    if (!r) {
      map.set(l.id, l);
      order.push(l.id);
    } else if ((l.updatedAt || 0) >= (r.updatedAt || 0)) {
      map.set(l.id, l);
    }
  }
  return order
    .map((id) => map.get(id)!)
    .filter((x) => {
      const t = tombs[x.id];
      return !(t !== undefined && t >= (x.updatedAt || 0));
    });
}

function readLocal(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function scheduleCloudPush(key: string): void {
  if (SYNC_SKIP_KEYS.has(key)) return;
  const cfg = getSupabaseConfig();
  if (!cfg.autoSync || !cfg.apiKey || !cfg.projectUrl) return;
  pendingPushKeys.add(key);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushCloudPush, 1200);
}

function notifyCloud(): void {
  notifyListeners();
  cloudListeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

async function pushOneKey(key: string): Promise<boolean> {
  const local = readLocal(key);
  if (local === undefined) return true;

  if (key === KEYS.USERS && Array.isArray(local)) {
    const sanitized = (local as User[]).map((u) => {
      const { password: _p, passwordHash: _h, passwordSalt: _s, ...rest } = u;
      return rest;
    });
    return upsertRemoteRows([{ id: key, data: sanitized }]);
  }

  if (!isItemArray(local)) {
    return upsertRemoteRows([{ id: key, data: local }]);
  }

  const localTombs = readAllTombs()[key] || {};
  const remote = await fetchRemoteRows([key, TOMB_PREFIX + key]);
  if (remote === null) return false;
  const remoteArr = isItemArray(remote[key]?.data) ? (remote[key].data as AnyItem[]) : [];
  const remoteTombs = (remote[TOMB_PREFIX + key]?.data as Tombs) || {};

  let tombs = mergeTombs(remoteTombs, localTombs);
  let merged: AnyItem[];
  if (replaceKeys.has(key)) {
    // Ganti total: semua id di cloud yang tidak ada di lokal dianggap dihapus.
    const keep = new Set(local.map((x) => x.id));
    const extra: Tombs = {};
    const now = Date.now();
    remoteArr.forEach((x) => {
      if (!keep.has(x.id)) extra[x.id] = now;
    });
    tombs = mergeTombs(tombs, extra);
    merged = mergeLists([], local, tombs);
  } else {
    merged = mergeLists(remoteArr, local, tombs);
  }

  const ok = await upsertRemoteRows([
    { id: key, data: merged },
    { id: TOMB_PREFIX + key, data: tombs },
  ]);
  if (!ok) return false;
  replaceKeys.delete(key);

  const all = readAllTombs();
  all[key] = tombs;
  writeAllTombs(all);
  if (stableStringify(merged) !== stableStringify(local)) {
    try {
      localStorage.setItem(key, JSON.stringify(merged));
      notifyCloud();
    } catch {}
  }
  return true;
}

async function flushCloudPush(): Promise<void> {
  pushTimer = null;
  if (pushing || pendingPushKeys.size === 0) return;
  pushing = true;
  const keys = Array.from(pendingPushKeys);
  let failed = false;
  try {
    for (const k of keys) {
      pendingPushKeys.delete(k); // perubahan baru saat proses berjalan akan masuk lagi lewat scheduleCloudPush
      let ok = false;
      try {
        ok = await pushOneKey(k);
      } catch {
        ok = false;
      }
      if (!ok) {
        pendingPushKeys.add(k);
        failed = true;
      }
    }
  } finally {
    pushing = false;
    if (failed) {
      console.warn('Auto-sync Supabase gagal, akan dicoba lagi.');
      pushTimer = setTimeout(flushCloudPush, 10000);
    } else if (pendingPushKeys.size > 0) {
      pushTimer = setTimeout(flushCloudPush, 1200);
    }
  }
}

let pulling = false;
/** Ambil perubahan dari cloud dan GABUNGKAN dengan data lokal. Mengembalikan jumlah modul yang berubah. */
export async function syncFromCloud(): Promise<number> {
  const cfg = getSupabaseConfig();
  if (pulling || !cfg.autoSync || !cfg.apiKey || !cfg.projectUrl) return 0;
  pulling = true;
  try {
    const meta = await fetchRemoteMeta();
    if (!meta) return 0;
    const validKeys = new Set<string>(Object.values(KEYS));
    const changedKeys = Object.keys(meta).filter(
      (id) => validKeys.has(id) && !SYNC_SKIP_KEYS.has(id) && (lastSeen[id] !== meta[id] || lastSeen[TOMB_PREFIX + id] !== meta[TOMB_PREFIX + id])
    );
    if (changedKeys.length === 0) return 0;
    const ids = changedKeys.flatMap((k) => (meta[TOMB_PREFIX + k] ? [k, TOMB_PREFIX + k] : [k]));
    const rows = await fetchRemoteRows(ids);
    if (!rows) return 0;

    let changed = 0;
    for (const key of changedKeys) {
      const row = rows[key];
      if (!row) continue;
      const localVal = readLocal(key);
      if (key === KEYS.USERS && Array.isArray(row.data)) {
        mergeRemoteUsers(row.data as User[]);
        changed++;
        lastSeen[key] = meta[key];
        continue;
      }
      if (isItemArray(row.data) && (localVal === undefined || isItemArray(localVal))) {
        const remoteTombs = (rows[TOMB_PREFIX + key]?.data as Tombs) || {};
        const all = readAllTombs();
        const tombs = mergeTombs(remoteTombs, all[key] || {});
        const merged = mergeLists(row.data, (localVal as AnyItem[]) || [], tombs);
        all[key] = tombs;
        writeAllTombs(all);
        if (localVal === undefined || stableStringify(merged) !== stableStringify(localVal)) {
          localStorage.setItem(key, JSON.stringify(merged));
          changed++;
        }
        // Jika lokal punya data yang belum ada / lebih baru dari cloud, kirim balik.
        if (stableStringify(merged) !== stableStringify(row.data)) scheduleCloudPush(key);
      } else {
        if (pendingPushKeys.has(key)) continue; // perubahan lokal belum terkirim
        if (localVal !== undefined && stableStringify(localVal) === stableStringify(row.data)) {
          // sama
        } else {
          localStorage.setItem(key, JSON.stringify(row.data));
          changed++;
          if (key === KEYS.CFG && (row.data as SchoolConfig)?.namaOperator) {
            syncLocalOperatorsFromConfig(row.data as SchoolConfig);
          }
        }
      }
      lastSeen[key] = meta[key];
      if (meta[TOMB_PREFIX + key]) lastSeen[TOMB_PREFIX + key] = meta[TOMB_PREFIX + key];
    }
    if (changed > 0) notifyCloud();
    return changed;
  } finally {
    pulling = false;
  }
}

let cloudPollingStarted = false;
export function startCloudPolling(): void {
  if (cloudPollingStarted || typeof window === 'undefined') return;
  cloudPollingStarted = true;
  const run = () => {
    syncFromCloud().catch(() => {});
  };
  run();
  setInterval(run, 15000);
  window.addEventListener('focus', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
}

/** Dipanggil UI (lewat App) ketika penyimpanan lokal gagal, supaya pengguna tahu. */
export const STORAGE_ERROR_EVENT = 'mo-storage-error';

export function setToStorage<T>(key: string, value: T): boolean {
  try {
    let oldRaw: string | null = null;
    if (Array.isArray(value)) {
      try {
        oldRaw = localStorage.getItem(key);
      } catch {}
    }
    localStorage.setItem(key, JSON.stringify(value));
    if (oldRaw) recordDeletions(key, oldRaw, value);
    notifyListeners();
    scheduleCloudPush(key);
    return true;
  } catch (err) {
    console.error('Storage write error:', err);
    try {
      window.dispatchEvent(
        new CustomEvent(STORAGE_ERROR_EVENT, {
          detail: 'Penyimpanan di browser penuh atau tidak tersedia. Data TIDAK tersimpan. Hubungi operator.',
        })
      );
    } catch {}
    return false;
  }
}

export function initStorageDefaults(): void {
  if (!localStorage.getItem(KEYS.USERS)) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(initialUsers));
  }
  if (!localStorage.getItem(KEYS.CFG)) {
    localStorage.setItem(KEYS.CFG, JSON.stringify(initialSchoolConfig));
  }
  if (!localStorage.getItem(KEYS.SISWA)) {
    localStorage.setItem(KEYS.SISWA, JSON.stringify(initialSiswas));
  }
  if (!localStorage.getItem(KEYS.GURU)) {
    localStorage.setItem(KEYS.GURU, JSON.stringify(initialGurus));
  }
  if (!localStorage.getItem(KEYS.ASET)) {
    localStorage.setItem(KEYS.ASET, JSON.stringify(initialAsets));
  }
  if (!localStorage.getItem(KEYS.BMD)) {
    localStorage.setItem(KEYS.BMD, JSON.stringify(initialBmd));
  }
  if (!localStorage.getItem(KEYS.SURATMASUK)) {
    localStorage.setItem(KEYS.SURATMASUK, JSON.stringify(initialSuratMasuk));
  }
  if (!localStorage.getItem(KEYS.SURATKELUAR)) {
    localStorage.setItem(KEYS.SURATKELUAR, JSON.stringify(initialSuratKeluar));
  }
  if (!localStorage.getItem(KEYS.MUTASI)) {
    localStorage.setItem(KEYS.MUTASI, JSON.stringify(initialMutasi));
  }
  if (!localStorage.getItem(KEYS.TEMPLATES)) {
    localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(initialLetterTemplates));
  }
  // Riwayat pengerjaan hanya mencatat kegiatan yang benar-benar dikerjakan di aplikasi
  if (!localStorage.getItem('mo_activities_cleaned_v2')) {
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify([]));
    localStorage.setItem('mo_activities_cleaned_v2', '1');
  } else if (!localStorage.getItem(KEYS.ACTIVITIES)) {
    localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify([]));
  }
  // Pastikan nama operator selalu konsisten antara konfigurasi sekolah dan akun pengguna
  try {
    const cfg = getSchoolConfig();
    const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
    const op = users.find((u) => u.role === 'operator');
    const canonicalName = cfg.namaOperator || op?.name;
    if (canonicalName) {
      let userUpdated = false;
      const updatedUsers = users.map((u) => {
        if (u.role === 'operator' && u.name !== canonicalName) {
          userUpdated = true;
          return { ...u, name: canonicalName };
        }
        return u;
      });
      if (userUpdated) {
        localStorage.setItem(KEYS.USERS, JSON.stringify(updatedUsers));
      }
      if (!cfg.namaOperator && canonicalName) {
        saveSchoolConfig({ ...cfg, namaOperator: canonicalName });
      }
    }
  } catch {}
  migrateDapodikSeed();
}

/**
 * Migrasi sekali jalan: mengganti data contoh bawaan lama (id s_1.., g_rudi, dst.)
 * dengan data Dapodik SD Negeri 2 Cempaka. Data yang sudah diubah/ditambah operator
 * (id tidak cocok dengan data contoh) tidak disentuh.
 */
function migrateDapodikSeed(): void {
  const FLAG = 'mo_dapodik_seed_v1';
  try {
    if (localStorage.getItem(FLAG)) return;
    const isSample = (key: string, re: RegExp): boolean => {
      const raw = localStorage.getItem(key);
      if (!raw) return true;
      const list = JSON.parse(raw) as Array<{ id: string }>;
      return Array.isArray(list) && list.every((x) => re.test(String(x.id)));
    };
    if (isSample(KEYS.SISWA, /^s_\d{1,2}$/)) {
      setToStorage(KEYS.SISWA, initialSiswas);
      if (isSample(KEYS.MUTASI, /^mut_\d+$/)) localStorage.setItem(KEYS.MUTASI, JSON.stringify(initialMutasi));
      if (isSample(KEYS.SURATKELUAR, /^sk_\d+$/)) localStorage.setItem(KEYS.SURATKELUAR, JSON.stringify(initialSuratKeluar));
    }
    if (isSample(KEYS.GURU, /^g_[a-z]+$/)) {
      setToStorage(KEYS.GURU, initialGurus);
    }
    localStorage.setItem(FLAG, '1');
  } catch (e) {
    console.error('Migrasi data Dapodik gagal:', e);
  }
}

// User & Auth
export function getCurrentUser(): User | null {
  try {
    const val = sessionStorage.getItem(KEYS.CURRENT_USER);
    if (!val) return null;
    const u: User = JSON.parse(val);
    if (u.role === 'operator') {
      const cfg = getSchoolConfig();
      const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
      const op = users.find((x) => x.role === 'operator');
      const canonicalName = cfg.namaOperator || op?.name;
      if (canonicalName && u.name !== canonicalName) {
        u.name = canonicalName;
      }
      if (cfg.emailOperator && !u.email) u.email = cfg.emailOperator;
      if (cfg.emailOperator2 && !u.email2) u.email2 = cfg.emailOperator2;
      if (cfg.nipOperator && !u.nip) u.nip = cfg.nipOperator;
    }
    return u;
  } catch {
    return null;
  }
}

/** Salinan pengguna tanpa hash/kata sandi, aman disimpan di sesi dan dipakai di tampilan. */
export function toPublicUser(u: User): User {
  const { password: _p, passwordHash: _h, passwordSalt: _s, ...rest } = u;
  return rest;
}

export function setCurrentUser(user: User | null): void {
  try {
    if (user) {
      sessionStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(toPublicUser(user)));
    } else {
      sessionStorage.removeItem(KEYS.CURRENT_USER);
    }
  } catch {}
  notifyListeners();
}

/**
 * Menyelaraskan nama dan identitas operator ke seluruh akun operator di database pengguna
 * serta menyimpannya ke konfigurasi sekolah agar tersinkronisasi ke Supabase Cloud (semua email/browser/perangkat).
 */
export function syncAllOperatorAccounts(
  name: string,
  email1?: string,
  email2?: string,
  nip?: string,
  phone?: string
): void {
  const cleanName = name.trim();
  if (!cleanName) return;

  const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
  let changed = false;
  const now = Date.now();

  const e1 = email1 !== undefined ? email1.trim() : undefined;
  const e2 = email2 !== undefined ? email2.trim() : undefined;
  const cleanNip = nip !== undefined ? nip.trim() : undefined;
  const cleanPhone = phone !== undefined ? phone.trim() : undefined;

  const updatedUsers = users.map((u) => {
    if (u.role === 'operator') {
      changed = true;
      return {
        ...u,
        name: cleanName,
        email: e1 !== undefined ? (e1 || undefined) : u.email,
        email2: e2 !== undefined ? (e2 || undefined) : u.email2,
        nip: cleanNip !== undefined ? (cleanNip || undefined) : u.nip,
        phone: cleanPhone !== undefined ? (cleanPhone || undefined) : u.phone,
        updatedAt: now,
      };
    }
    const uEmail = u.email?.toLowerCase();
    const uEmail2 = u.email2?.toLowerCase();
    const matchE1 = e1 && (uEmail === e1.toLowerCase() || uEmail2 === e1.toLowerCase());
    const matchE2 = e2 && (uEmail === e2.toLowerCase() || uEmail2 === e2.toLowerCase());
    if (matchE1 || matchE2) {
      changed = true;
      return {
        ...u,
        name: cleanName,
        updatedAt: now,
      };
    }
    return u;
  });

  if (changed) {
    setToStorage(KEYS.USERS, updatedUsers);
  }

  const cur = getCurrentUser();
  if (cur && cur.role === 'operator') {
    const updatedCur: User = {
      ...cur,
      name: cleanName,
      email: e1 !== undefined ? (e1 || undefined) : cur.email,
      email2: e2 !== undefined ? (e2 || undefined) : cur.email2,
      nip: cleanNip !== undefined ? (cleanNip || undefined) : cur.nip,
      phone: cleanPhone !== undefined ? (cleanPhone || undefined) : cur.phone,
    };
    sessionStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(toPublicUser(updatedCur)));
  }

  const cfg = getSchoolConfig();
  if (
    cfg.namaOperator !== cleanName ||
    (e1 !== undefined && cfg.emailOperator !== e1) ||
    (e2 !== undefined && cfg.emailOperator2 !== e2) ||
    (cleanNip !== undefined && cfg.nipOperator !== cleanNip)
  ) {
    saveSchoolConfig({
      ...cfg,
      namaOperator: cleanName,
      emailOperator: e1 !== undefined ? e1 : cfg.emailOperator,
      emailOperator2: e2 !== undefined ? e2 : cfg.emailOperator2,
      nipOperator: cleanNip !== undefined ? cleanNip : cfg.nipOperator,
    });
  }
  notifyListeners();
}

/**
 * Menyelaraskan operator lokal dari SchoolConfig yang baru ditarik dari cloud.
 */
export function syncLocalOperatorsFromConfig(cfg: SchoolConfig): void {
  const name = cfg.namaOperator?.trim();
  if (!name) return;

  const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
  let userUpdated = false;
  const now = Date.now();

  const updatedUsers = users.map((u) => {
    if (u.role === 'operator') {
      if (
        u.name !== name ||
        (cfg.emailOperator && u.email !== cfg.emailOperator) ||
        (cfg.emailOperator2 && u.email2 !== cfg.emailOperator2)
      ) {
        userUpdated = true;
        return {
          ...u,
          name,
          email: cfg.emailOperator || u.email,
          email2: cfg.emailOperator2 || u.email2,
          nip: cfg.nipOperator || u.nip,
          updatedAt: now,
        };
      }
    }
    return u;
  });

  if (userUpdated) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(updatedUsers));
  }

  const cur = getCurrentUser();
  if (cur && cur.role === 'operator' && cur.name !== name) {
    sessionStorage.setItem(
      KEYS.CURRENT_USER,
      JSON.stringify(
        toPublicUser({
          ...cur,
          name,
          email: cfg.emailOperator || cur.email,
          email2: cfg.emailOperator2 || cur.email2,
          nip: cfg.nipOperator || cur.nip,
        })
      )
    );
  }
  notifyListeners();
}

/**
 * Menggabungkan profil pengguna dari cloud ke penyimpanan lokal tanpa menghapus hash kata sandi lokal.
 */
export function mergeRemoteUsers(remoteUsers: User[]): void {
  if (!Array.isArray(remoteUsers) || remoteUsers.length === 0) return;
  const localUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
  let changed = false;

  const remoteOp = remoteUsers.find((u) => u.role === 'operator');
  const canonicalOpName = remoteOp?.name?.trim();

  const merged = localUsers.map((local) => {
    const remote =
      remoteUsers.find((r) => r.id === local.id) ||
      remoteUsers.find((r) => r.username.toLowerCase() === local.username.toLowerCase()) ||
      (local.role === 'operator' ? remoteOp : undefined);

    if (!remote) return local;

    const nextName = local.role === 'operator' && canonicalOpName ? canonicalOpName : (remote.name || local.name);
    const updated = {
      ...local,
      name: nextName,
      email: remote.email || local.email,
      email2: remote.email2 || local.email2,
      phone: remote.phone || local.phone,
      nip: remote.nip || local.nip,
      jabatan: remote.jabatan || local.jabatan,
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
    };
    if (JSON.stringify(updated) !== JSON.stringify(local)) {
      changed = true;
    }
    return updated;
  });

  for (const r of remoteUsers) {
    if (!merged.some((m) => m.id === r.id || m.username.toLowerCase() === r.username.toLowerCase())) {
      merged.push({
        ...r,
        name: r.role === 'operator' && canonicalOpName ? canonicalOpName : r.name,
      });
      changed = true;
    }
  }

  if (changed) {
    localStorage.setItem(KEYS.USERS, JSON.stringify(merged));
    const cur = getCurrentUser();
    if (cur && cur.role === 'operator' && canonicalOpName && cur.name !== canonicalOpName) {
      sessionStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(toPublicUser({ ...cur, name: canonicalOpName })));
    }
    notifyListeners();
  }
}

/**
 * Migrasi sekali jalan: kata sandi teks di data lama diubah menjadi hash lalu dihapus dari penyimpanan.
 * Akun guru tidak memakai kata sandi, jadi kolomnya dibuang.
 */
export async function migratePasswords(): Promise<void> {
  try {
    const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
    if (!users.some((u) => u.password !== undefined)) return;
    const out: User[] = [];
    for (const u of users) {
      const { password, ...rest } = u;
      if (u.role === 'operator' && password && !u.passwordHash) {
        const h = await hashPassword(password);
        // Bila ternyata masih kata sandi bawaan (dicek lewat hash), operator diminta menggantinya.
        const def = initialUsers.find((x) => x.role === 'operator');
        const isDefault = await verifyPassword(password, def?.passwordSalt, def?.passwordHash);
        out.push({ ...rest, ...h, mustChangePassword: isDefault ? true : u.mustChangePassword });
      } else {
        out.push(rest);
      }
    }
    localStorage.setItem(KEYS.USERS, JSON.stringify(out));
    notifyListeners();
  } catch (e) {
    console.error('Migrasi kata sandi gagal:', e);
  }
}

export async function loginOperator(password: string): Promise<{ success: boolean; user?: User; message?: string }> {
  const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
  const operatorUser = users.find((u) => u.role === 'operator') || initialUsers[0];
  let ok = false;
  try {
    // Data lama yang belum sempat dimigrasi: bandingkan lalu ubah jadi hash.
    if (!operatorUser.passwordHash && operatorUser.password !== undefined) {
      ok = operatorUser.password === password;
      if (ok) await migratePasswords();
    } else {
      ok = await verifyPassword(password, operatorUser.passwordSalt, operatorUser.passwordHash);
    }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Verifikasi password gagal.' };
  }
  if (!ok) {
    return { success: false, message: 'Password operator tidak sesuai. Coba lagi.' };
  }
  const fresh = getFromStorage<User[]>(KEYS.USERS, initialUsers);
  const stored = fresh.find((u) => u.id === operatorUser.id) || operatorUser;
  const cfg = getSchoolConfig();
  const canonicalName = cfg.namaOperator || stored.name;
  const loggedIn: User = {
    ...stored,
    name: canonicalName,
    email: stored.email || cfg.emailOperator,
    email2: stored.email2 || cfg.emailOperator2,
    nip: stored.nip || cfg.nipOperator,
    lastLogin: Date.now(),
  };
  setToStorage(
    KEYS.USERS,
    fresh.map((u) =>
      u.id === operatorUser.id ? loggedIn : u.role === 'operator' ? { ...u, name: canonicalName } : u
    )
  );
  const publicUser = toPublicUser(loggedIn);
  setCurrentUser(publicUser);
  return { success: true, user: publicUser };
}

export function guruHasPassword(g?: Guru | null): boolean {
  return !!(g && g.passwordHash && g.passwordSalt);
}

const GURU_LOCK_KEY = 'mo_guru_login_lock';
const GURU_MAX_TRIES = 5;
const GURU_LOCK_MS = 60_000;

function readGuruLocks(): Record<string, { n: number; until: number }> {
  try {
    return JSON.parse(localStorage.getItem(GURU_LOCK_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeGuruLocks(v: Record<string, { n: number; until: number }>): void {
  try {
    localStorage.setItem(GURU_LOCK_KEY, JSON.stringify(v));
  } catch {}
}

/** Masuk sebagai guru/tendik: wajib memilih nama dan memasukkan password yang diatur operator. */
export async function loginGuru(
  selectedGuruId: string | undefined,
  password: string
): Promise<{ success: boolean; user?: User; message?: string }> {
  const gurus = getFromStorage<Guru[]>(KEYS.GURU, initialGurus);
  const selected = selectedGuruId ? gurus.find((g) => g.id === selectedGuruId) : undefined;
  if (!selected || selected.status === 'Nonaktif') {
    return { success: false, message: 'Pilih nama guru / tendik terlebih dahulu.' };
  }
  if (!guruHasPassword(selected)) {
    return { success: false, message: 'Password akun ini belum dibuat. Minta operator sekolah untuk mengaturnya.' };
  }
  const locks = readGuruLocks();
  const lock = locks[selected.id];
  if (lock && lock.until > Date.now()) {
    const sec = Math.ceil((lock.until - Date.now()) / 1000);
    return { success: false, message: `Terlalu banyak percobaan salah. Coba lagi dalam ${sec} detik.` };
  }
  let ok = false;
  try {
    ok = await verifyPassword(password, selected.passwordSalt, selected.passwordHash);
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Verifikasi password gagal.' };
  }
  if (!ok) {
    const n = (lock && lock.until <= Date.now() && lock.n >= GURU_MAX_TRIES ? 0 : lock?.n || 0) + 1;
    locks[selected.id] = n >= GURU_MAX_TRIES ? { n, until: Date.now() + GURU_LOCK_MS } : { n, until: 0 };
    writeGuruLocks(locks);
    return {
      success: false,
      message:
        n >= GURU_MAX_TRIES
          ? 'Terlalu banyak percobaan salah. Coba lagi dalam 1 menit.'
          : 'Password tidak sesuai. Coba lagi.',
    };
  }
  delete locks[selected.id];
  writeGuruLocks(locks);
  const user: User = {
    id: `u_gtk_${selected.id}`,
    username: 'guru',
    name: selected.nama,
    role: 'guru',
    jabatan: selected.jabatan,
    guruId: selected.id,
    nip: selected.nip,
    phone: selected.telp,
    email: selected.email,
    lastLogin: Date.now(),
  };
  setCurrentUser(user);
  return { success: true, user };
}

/** Atur / ganti password login seorang guru. Hanya operator yang boleh. */
export async function setGuruPassword(guruId: string, password: string): Promise<void> {
  if (getCurrentUser()?.role !== 'operator') {
    throw new Error('Hanya operator yang dapat mengatur password guru.');
  }
  const list = getGurus();
  const target = list.find((g) => g.id === guruId);
  if (!target) throw new Error('Data guru tidak ditemukan.');
  const h = await hashPassword(password);
  const now = Date.now();
  setToStorage(
    KEYS.GURU,
    list.map((g) => (g.id === guruId ? { ...g, ...h, passwordUpdatedAt: now, updatedAt: now } : g))
  );
  const locks = readGuruLocks();
  delete locks[guruId];
  writeGuruLocks(locks);
  recordActivity('Guru & Tendik', `Atur password login: ${target.nama}`, false, 'update');
}

/** Hapus password guru (akun itu tidak bisa masuk sampai operator membuat password baru). */
export function clearGuruPassword(guruId: string): void {
  if (getCurrentUser()?.role !== 'operator') return;
  const list = getGurus();
  const target = list.find((g) => g.id === guruId);
  if (!target) return;
  const now = Date.now();
  setToStorage(
    KEYS.GURU,
    list.map((g) => {
      if (g.id !== guruId) return g;
      const { passwordHash: _h, passwordSalt: _s, passwordUpdatedAt: _u, ...rest } = g;
      return { ...rest, updatedAt: now };
    })
  );
  recordActivity('Guru & Tendik', `Hapus password login: ${target.nama}`, false, 'update');
}

export function logout(): void {
  setCurrentUser(null);
}

// School Config
export function getSchoolConfig(): SchoolConfig {
  const cfg = getFromStorage<SchoolConfig>(KEYS.CFG, initialSchoolConfig);
  if (!cfg.tataLetakLogo) cfg.tataLetakLogo = 'kiri_kedua';
  if (cfg.logo && !cfg.logoPemda && !cfg.logoSekolah) {
    cfg.logoPemda = cfg.logo;
  }
  return cfg;
}

export function getActivities(): WorkActivity[] {
  return getFromStorage<WorkActivity[]>(KEYS.ACTIVITIES, []);
}

export function recordActivity(
  module: string,
  label: string,
  baru: boolean,
  action: 'create' | 'update' | 'delete' = baru ? 'create' : 'update'
): void {
  try {
    const list = getActivities();
    const item: WorkActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      module,
      label,
      ts: Date.now(),
      baru,
      action,
    };
    const updated = [item, ...list].slice(0, 200);
    setToStorage(KEYS.ACTIVITIES, updated);
  } catch (e) {
    console.error('Gagal mencatat aktivitas:', e);
  }
}

export function clearActivities(): void {
  setToStorage(KEYS.ACTIVITIES, []);
}

export function saveSchoolConfig(config: SchoolConfig): void {
  setToStorage(KEYS.CFG, { ...config, updatedAt: Date.now() });
  recordActivity('Pengaturan', `Perbarui identitas & profil sekolah (${config.namaSekolah || 'Sekolah'})`, false, 'update');
}

// Siswa
export function getSiswas(): Siswa[] {
  return getFromStorage<Siswa[]>(KEYS.SISWA, initialSiswas);
}

export function saveSiswa(siswa: Siswa): void {
  const list = getSiswas();
  const idx = list.findIndex((s) => s.id === siswa.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...siswa, updatedAt: now };
  } else {
    list.push({ ...siswa, createdAt: siswa.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.SISWA, list);
  recordActivity(
    'Siswa',
    isNew ? `Tambah siswa: ${siswa.nama} (Kelas ${siswa.kelas})` : `Perbarui data siswa: ${siswa.nama}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteSiswa(id: string): void {
  const target = getSiswas().find((s) => s.id === id);
  const filtered = getSiswas().filter((s) => s.id !== id);
  setToStorage(KEYS.SISWA, filtered);
  recordActivity('Siswa', `Hapus data siswa: ${target?.nama || 'Siswa'}`, false, 'delete');
}

// Guru
export function getGurus(): Guru[] {
  return getFromStorage<Guru[]>(KEYS.GURU, initialGurus);
}

export function saveGuru(guru: Guru): void {
  const list = getGurus();
  const idx = list.findIndex((g) => g.id === guru.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...guru, updatedAt: now };
  } else {
    list.push({ ...guru, createdAt: guru.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.GURU, list);
  recordActivity(
    'Guru & Tendik',
    isNew ? `Tambah GTK baru: ${guru.nama}` : `Perbarui data GTK: ${guru.nama}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteGuru(id: string): void {
  const target = getGurus().find((g) => g.id === id);
  const filtered = getGurus().filter((g) => g.id !== id);
  setToStorage(KEYS.GURU, filtered);
  recordActivity('Guru & Tendik', `Hapus data GTK: ${target?.nama || 'GTK'}`, false, 'delete');
}

// Dokumen GTK
export function getDokumenGtks(): DokumenGtk[] {
  return getFromStorage<DokumenGtk[]>(KEYS.DOKGTK, []);
}

export function saveDokumenGtk(dok: DokumenGtk): boolean {
  const list = getDokumenGtks();
  const idx = list.findIndex((d) => d.id === dok.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...dok, updatedAt: now };
  } else {
    list.push({ ...dok, createdAt: dok.createdAt || now, updatedAt: now });
  }
  const ok = setToStorage(KEYS.DOKGTK, list);
  if (ok) {
    recordActivity(
      'Dokumen GTK',
      isNew ? `Unggah berkas GTK: ${dok.judul}` : `Perbarui berkas GTK: ${dok.judul}`,
      isNew,
      isNew ? 'create' : 'update'
    );
  }
  return ok;
}

export function deleteDokumenGtk(id: string): void {
  const all = getDokumenGtks();
  const target = all.find((d) => d.id === id);
  const filtered = all.filter((d) => d.id !== id);
  if (setToStorage(KEYS.DOKGTK, filtered)) {
    if (target?.file?.id) {
      deleteFile(target.file).catch(() => {});
    }
    recordActivity('Dokumen GTK', `Hapus berkas GTK: ${target?.judul || 'Dokumen'}`, false, 'delete');
  }
}

// Aset
export function getAsets(): Aset[] {
  return getFromStorage<Aset[]>(KEYS.ASET, initialAsets);
}

export function saveAset(aset: Aset): void {
  const list = getAsets();
  const idx = list.findIndex((a) => a.id === aset.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...aset, updatedAt: now };
  } else {
    list.push({ ...aset, createdAt: aset.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.ASET, list);
  recordActivity(
    'Aset',
    isNew ? `Tambah sarpras baru: ${aset.nama}` : `Perbarui data sarpras: ${aset.nama}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteAset(id: string): void {
  const target = getAsets().find((a) => a.id === id);
  const filtered = getAsets().filter((a) => a.id !== id);
  setToStorage(KEYS.ASET, filtered);
  recordActivity('Aset', `Hapus sarpras: ${target?.nama || 'Aset'}`, false, 'delete');
}

// BMD & stiker inventaris
export function getBmdItems(): BmdItem[] {
  return getFromStorage<BmdItem[]>(KEYS.BMD, initialBmd);
}

/** Ganti seluruh daftar BMD (dipakai simpan/ubah/hapus/impor massal). */
export function saveBmdItems(list: BmdItem[], activity?: string): void {
  const now = Date.now();
  setToStorage(KEYS.BMD, list.map((b) => ({ ...b, createdAt: b.createdAt || now, updatedAt: b.updatedAt || now })));
  recordActivity('Aset', activity || `Perbarui data BMD stiker (${list.length} barang)`, false, 'update');
}

export function getStikerConfig(): StikerConfig {
  return { ...initialStikerConfig, ...getFromStorage<Partial<StikerConfig>>(KEYS.STIKER, {}) };
}

export function saveStikerConfig(cfg: StikerConfig): void {
  setToStorage(KEYS.STIKER, cfg);
}

// Surat Masuk
export function getSuratMasuk(): SuratMasuk[] {
  return getFromStorage<SuratMasuk[]>(KEYS.SURATMASUK, initialSuratMasuk);
}

export function saveSuratMasuk(sm: SuratMasuk): void {
  const list = getSuratMasuk();
  const idx = list.findIndex((s) => s.id === sm.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...sm, updatedAt: now };
  } else {
    list.push({ ...sm, createdAt: sm.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.SURATMASUK, list);
  recordActivity(
    'Surat Masuk',
    isNew ? `Catat surat masuk: ${sm.perihal || sm.noSurat || 'Surat'}` : `Perbarui surat masuk: ${sm.perihal || sm.noSurat || 'Surat'}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteSuratMasuk(id: string): void {
  const target = getSuratMasuk().find((s) => s.id === id);
  const filtered = getSuratMasuk().filter((s) => s.id !== id);
  setToStorage(KEYS.SURATMASUK, filtered);
  recordActivity('Surat Masuk', `Hapus surat masuk: ${target?.perihal || target?.noSurat || 'Surat'}`, false, 'delete');
}

// Surat Keluar
export function getSuratKeluar(): SuratKeluar[] {
  return getFromStorage<SuratKeluar[]>(KEYS.SURATKELUAR, initialSuratKeluar);
}

export function saveSuratKeluar(sk: SuratKeluar): void {
  const list = getSuratKeluar();
  const idx = list.findIndex((s) => s.id === sk.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...sk, updatedAt: now };
  } else {
    list.push({ ...sk, createdAt: sk.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.SURATKELUAR, list);
  recordActivity(
    'Surat Keluar',
    isNew ? `Buat surat keluar: ${sk.perihal || sk.noSurat || 'Surat'}` : `Perbarui surat keluar: ${sk.perihal || sk.noSurat || 'Surat'}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteSuratKeluar(id: string): void {
  const target = getSuratKeluar().find((s) => s.id === id);
  const filtered = getSuratKeluar().filter((s) => s.id !== id);
  setToStorage(KEYS.SURATKELUAR, filtered);
  recordActivity('Surat Keluar', `Hapus surat keluar: ${target?.perihal || target?.noSurat || 'Surat'}`, false, 'delete');
}

// Mutasi
export function getMutasi(): Mutasi[] {
  return getFromStorage<Mutasi[]>(KEYS.MUTASI, initialMutasi);
}

export function saveMutasi(mutasi: Mutasi): void {
  const list = getMutasi();
  const idx = list.findIndex((m) => m.id === mutasi.id);
  const now = Date.now();
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...mutasi, updatedAt: now };
  } else {
    list.push({ ...mutasi, createdAt: mutasi.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.MUTASI, list);
  recordActivity(
    'Mutasi',
    isNew ? `Catat mutasi siswa (${mutasi.jenis}): ${mutasi.nama}` : `Perbarui data mutasi: ${mutasi.nama}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteMutasi(id: string): void {
  const target = getMutasi().find((m) => m.id === id);
  const filtered = getMutasi().filter((m) => m.id !== id);
  setToStorage(KEYS.MUTASI, filtered);
  recordActivity('Mutasi', `Hapus catatan mutasi: ${target?.nama || 'Siswa'}`, false, 'delete');
}

// Nilai
export function getNilaiRecords(): NilaiRecord[] {
  return getFromStorage<NilaiRecord[]>(KEYS.NILAI, []);
}

export function saveNilaiRecord(record: NilaiRecord): void {
  const list = getNilaiRecords();
  const idx = list.findIndex((n) => n.id === record.id);
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...record, updatedAt: Date.now() };
  } else {
    list.push({ ...record, updatedAt: Date.now() });
  }
  setToStorage(KEYS.NILAI, list);
  recordActivity(
    'Penilaian',
    `Simpan penilaian kelas ${record.kelas} (${record.ta} Smt ${record.smt})`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

// Letter Templates
export function getTemplates(): LetterTemplate[] {
  return getFromStorage<LetterTemplate[]>(KEYS.TEMPLATES, initialLetterTemplates);
}

export function saveTemplate(template: LetterTemplate): void {
  const list = getTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const isNew = idx < 0;
  if (idx >= 0) {
    list[idx] = { ...template, updatedAt: Date.now() };
  } else {
    list.push({ ...template, createdAt: Date.now(), updatedAt: Date.now() });
  }
  setToStorage(KEYS.TEMPLATES, list);
  recordActivity(
    'Format Surat',
    isNew ? `Tambah format surat: ${template.judul}` : `Perbarui format surat: ${template.judul}`,
    isNew,
    isNew ? 'create' : 'update'
  );
}

export function deleteTemplate(id: string): void {
  const target = getTemplates().find((t) => t.id === id);
  const filtered = getTemplates().filter((t) => t.id !== id);
  setToStorage(KEYS.TEMPLATES, filtered);
  recordActivity('Format Surat', `Hapus format surat: ${target?.judul || 'Template'}`, false, 'delete');
}

// Arsip Absen
export function getArsipAbsen(): ArsipAbsen[] {
  return getFromStorage<ArsipAbsen[]>(KEYS.ARSIPABSEN, []);
}

export function saveArsipAbsenList(list: ArsipAbsen[]): boolean {
  const ok = setToStorage(KEYS.ARSIPABSEN, list);
  if (ok) {
    recordActivity('Arsip Absen', `Perbarui arsip absensi siswa (${list.length} arsip)`, false, 'update');
  }
  return ok;
}

// Keuangan
const defaultKeuangan: KeuanganState = {
  settings: {
    bendaharaNama: "Lati Acih",
    bendaharaNip: "19690723 200501 2 008",
    sumberDana: "Dana BOSP Reguler",
    kota: "Cirebon",
    prefix: "BOSP"
  },
  bku: [],
  edits: {},
  fileName: undefined,
};

export function getKeuangan(): KeuanganState {
  const saved = getFromStorage<KeuanganState | null>(KEYS.KEUANGAN, null);
  return {
    settings: { ...defaultKeuangan.settings, ...saved?.settings },
    bku: Array.isArray(saved?.bku) ? saved.bku : [],
    edits: saved?.edits && typeof saved.edits === 'object' ? saved.edits : {},
    fileName: saved?.fileName,
  };
}

export function saveKeuangan(keuangan: KeuanganState): void {
  setToStorage(KEYS.KEUANGAN, keuangan);
  recordActivity('Keuangan', `Simpan pemutakhiran BKU & Kwitansi (${keuangan.bku?.length || 0} transaksi)`, false, 'update');
}

// Backup & Export / Import
export function getAllExportableData(): Record<string, unknown> {
  return {
    [KEYS.CFG]: getSchoolConfig(),
    [KEYS.USERS]: getFromStorage(KEYS.USERS, initialUsers),
    [KEYS.SISWA]: getSiswas(),
    [KEYS.GURU]: getGurus(),
    [KEYS.DOKGTK]: getDokumenGtks(),
    [KEYS.ASET]: getAsets(),
    [KEYS.BMD]: getBmdItems(),
    [KEYS.STIKER]: getStikerConfig(),
    [KEYS.SURATMASUK]: getSuratMasuk(),
    [KEYS.SURATKELUAR]: getSuratKeluar(),
    [KEYS.MUTASI]: getMutasi(),
    [KEYS.NILAI]: getNilaiRecords(),
    [KEYS.BERKAS]: getFromStorage(KEYS.BERKAS, []),
    [KEYS.LAPORAN]: getFromStorage(KEYS.LAPORAN, []),
    [KEYS.TEMPLATES]: getTemplates(),
    [KEYS.ARSIPABSEN]: getArsipAbsen(),
    [KEYS.KEUANGAN]: getKeuangan(),
  };
}

export function downloadBackupJSON(): string {
  const backup = {
    _format: "meja-operator-backup",
    _version: 2,
    _exportedAt: new Date().toISOString(),
    _supabaseProject: getSupabaseConfig().projectId,
    data: getAllExportableData(),
  };
  const fileName = `Cadangan_Meja_Operator_${new Date().toISOString().split("T")[0]}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

export function restoreBackupJSON(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json || !json.data) {
          throw new Error("Format berkas cadangan tidak dikenali.");
        }
        let count = 0;
        Object.entries(json.data).forEach(([key, val]) => {
          localStorage.setItem(key, JSON.stringify(val));
          count++;
        });
        notifyListeners();
        resolve(count);
      } catch (err: any) {
        reject(new Error(err.message || "Gagal membaca berkas cadangan JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.readAsText(file);
  });
}

export function resetToDefaults(): void {
  localStorage.setItem(KEYS.USERS, JSON.stringify(initialUsers));
  localStorage.setItem(KEYS.CFG, JSON.stringify(initialSchoolConfig));
  localStorage.setItem(KEYS.SISWA, JSON.stringify(initialSiswas));
  localStorage.setItem(KEYS.GURU, JSON.stringify(initialGurus));
  localStorage.setItem(KEYS.ASET, JSON.stringify(initialAsets));
  localStorage.setItem(KEYS.BMD, JSON.stringify(initialBmd));
  localStorage.removeItem(KEYS.STIKER);
  localStorage.setItem(KEYS.SURATMASUK, JSON.stringify(initialSuratMasuk));
  localStorage.setItem(KEYS.SURATKELUAR, JSON.stringify(initialSuratKeluar));
  localStorage.setItem(KEYS.MUTASI, JSON.stringify(initialMutasi));
  localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(initialLetterTemplates));
  localStorage.removeItem(KEYS.DOKGTK);
  localStorage.removeItem(KEYS.NILAI);
  localStorage.removeItem(KEYS.BERKAS);
  localStorage.removeItem(KEYS.LAPORAN);
  localStorage.removeItem(KEYS.ARSIPABSEN);
  localStorage.removeItem(KEYS.KEUANGAN);
  notifyListeners();
}

/**
 * Ganti seluruh data siswa dan GTK dengan data Dapodik bawaan aplikasi.
 * Dikirim juga ke Supabase bila sinkronisasi otomatis aktif, supaya tidak tertimpa data lama dari cloud.
 */
export function loadDapodikData(): { siswa: number; gtk: number } {
  const now = Date.now();
  const stamp = <T extends { id: string }>(list: T[]) => list.map((x) => ({ ...x, updatedAt: now }));
  // Mode "ganti total": data lama di cloud yang tidak ada di daftar Dapodik ikut dihapus.
  replaceKeys.add(KEYS.SISWA);
  replaceKeys.add(KEYS.GURU);
  setToStorage(KEYS.SISWA, stamp(initialSiswas));
  // Password guru yang sudah diatur operator tetap dipertahankan (dicocokkan lewat id).
  const oldAuth = new Map(getGurus().map((g) => [g.id, g]));
  setToStorage(
    KEYS.GURU,
    stamp(initialGurus).map((g) => {
      const o = oldAuth.get(g.id);
      return o && o.passwordHash && o.passwordSalt
        ? { ...g, passwordHash: o.passwordHash, passwordSalt: o.passwordSalt, passwordUpdatedAt: o.passwordUpdatedAt }
        : g;
    })
  );
  try {
    localStorage.setItem('mo_dapodik_seed_v1', '1');
  } catch {}
  recordActivity(
    'Dapodik',
    `Muat data Dapodik (${initialSiswas.length} siswa, ${initialGurus.length} GTK)`,
    true,
    'create'
  );
  return { siswa: initialSiswas.length, gtk: initialGurus.length };
}

/**
 * Migrasi berkas lama: dulu isi berkas (base64) disimpan langsung di dalam data dokumen,
 * yang memenuhi penyimpanan browser. Pindahkan ke penyimpanan berkas dan sisakan referensinya saja.
 */
export async function migrateLegacyFiles(): Promise<number> {
  let moved = 0;
  const strip = async <T extends { file?: { id?: string; name: string; size: number; type?: string; dataUrl?: string } }>(
    key: string,
    list: T[]
  ): Promise<void> => {
    let dirty = false;
    const out: T[] = [];
    for (const item of list) {
      const f = item.file;
      if (f && f.dataUrl) {
        try {
          const id = f.id || newRecordId('f');
          const type = /data:([^;]+)/.exec(f.dataUrl)?.[1] || f.type || 'application/octet-stream';
          const res = await saveFile({ id, name: f.name, size: f.size, type, dataUrl: f.dataUrl });
          out.push({ ...item, file: res.ref, updatedAt: Date.now() });
          dirty = true;
          moved++;
          continue;
        } catch {
          // biarkan apa adanya, coba lagi pada pembukaan berikutnya
        }
      }
      out.push(item);
    }
    if (dirty) setToStorage(key, out);
  };
  await strip(KEYS.ARSIPABSEN, getArsipAbsen() as any[]);
  await strip(KEYS.DOKGTK, getDokumenGtks() as any[]);
  return moved;
}

/**
 * Panggil setelah akun Supabase / awalan tabel diganti: lupakan status sinkron proyek lama
 * dan tandai semua modul untuk dikirim ke proyek baru.
 */
export function resetCloudSyncState(pushAll = false): void {
  for (const k of Object.keys(lastSeen)) delete lastSeen[k];
  pendingPushKeys.clear();
  if (pushAll) {
    const keys = Object.values(KEYS).filter((k) => !SYNC_SKIP_KEYS.has(k) && localStorage.getItem(k) !== null);
    keys.forEach((k) => scheduleCloudPush(k));
  }
}

// ---------------------------------------------------------------------------
// Berkas & foto -> ImageKit
// ---------------------------------------------------------------------------

type RefPatch = Pick<FileRefLike, 'url' | 'ikId' | 'path'>;
interface FileRefLike {
  id: string;
  url?: string;
  ikId?: string;
  path?: string;
}

/** Saat berkas tertunda akhirnya terunggah, perbarui referensinya di data teks (dokumen GTK & arsip absen). */
function patchFileRef(fileId: string, patch: RefPatch): void {
  const apply = <T extends { id: string; file?: FileRefLike }>(key: string, list: T[]): void => {
    let dirty = false;
    const out = list.map((it) => {
      if (it.file && it.file.id === fileId && !it.file.url) {
        dirty = true;
        return { ...it, file: { ...it.file, ...patch }, updatedAt: Date.now() };
      }
      return it;
    });
    if (dirty) setToStorage(key, out);
  };
  apply(KEYS.DOKGTK, getDokumenGtks() as any[]);
  apply(KEYS.ARSIPABSEN, getArsipAbsen() as any[]);
}
setFileUploadedHandler(patchFileRef);

export interface MigrateResult {
  moved: number;
  failed: number;
  skipped: number;
}

/**
 * Pindahkan semua berkas & foto lama ke ImageKit, lalu simpan hanya URL-nya di data teks:
 *  - berkas dokumen GTK dan arsip absen (dari perangkat ini atau dari tabel Supabase lama `<prefix>files`)
 *  - foto bukti surat masuk dan logo yang masih berupa data base64 di dalam data teks
 * Aman diulang: yang sudah punya URL dilewati.
 */
export async function migrateFilesToImageKit(onProgress?: (msg: string) => void): Promise<MigrateResult> {
  const res: MigrateResult = { moved: 0, failed: 0, skipped: 0 };
  if (!isImageKitReady()) throw new Error('ImageKit belum diatur.');

  // 1. Berkas dokumen
  const fileJobs: Array<{ key: string; id: string; file: any; folder: string }> = [];
  for (const d of getDokumenGtks()) if (d.file && !d.file.url) fileJobs.push({ key: KEYS.DOKGTK, id: d.id, file: d.file, folder: `gtk/${d.guruId}` });
  for (const a of getArsipAbsen()) if (a.file && !a.file.url) fileJobs.push({ key: KEYS.ARSIPABSEN, id: a.id, file: a.file, folder: 'arsip-absen' });

  const patches: Record<string, Record<string, any>> = { [KEYS.DOKGTK]: {}, [KEYS.ARSIPABSEN]: {} };
  let n = 0;
  for (const job of fileJobs) {
    n++;
    onProgress?.(`Berkas ${n}/${fileJobs.length}: ${job.file.name}`);
    try {
      const du = await getFileDataUrl(job.file);
      if (!du) {
        res.skipped++;
        continue;
      }
      const up = await uploadToImageKit(dataUrlToBlob(du), job.file.name, { subfolder: job.folder });
      patches[job.key][job.id] = { url: up.url, ikId: up.fileId, path: up.filePath };
      res.moved++;
    } catch {
      res.failed++;
    }
  }
  const applyFilePatches = <T extends { id: string; file?: any }>(key: string, list: T[]): void => {
    const p = patches[key];
    if (!Object.keys(p).length) return;
    setToStorage(key, list.map((it) => (p[it.id] && it.file ? { ...it, file: { ...it.file, ...p[it.id] }, updatedAt: Date.now() } : it)));
  };
  applyFilePatches(KEYS.DOKGTK, getDokumenGtks() as any[]);
  applyFilePatches(KEYS.ARSIPABSEN, getArsipAbsen() as any[]);

  // 2. Foto bukti surat masuk (base64 -> URL)
  const fotoPatch: Record<string, string> = {};
  const suratList = getSuratMasuk().filter((s) => s.fotoSurat && s.fotoSurat.startsWith('data:'));
  n = 0;
  for (const sm of suratList) {
    n++;
    onProgress?.(`Foto surat masuk ${n}/${suratList.length}`);
    try {
      const up = await uploadDataUrlToImageKit(sm.fotoSurat!, `surat-masuk-${sm.id}`, { subfolder: 'surat-masuk' });
      fotoPatch[sm.id] = up.url;
      res.moved++;
    } catch {
      res.failed++;
    }
  }
  if (Object.keys(fotoPatch).length) {
    setToStorage(
      KEYS.SURATMASUK,
      getSuratMasuk().map((s) => (fotoPatch[s.id] ? { ...s, fotoSurat: fotoPatch[s.id], updatedAt: Date.now() } : s))
    );
  }

  // 3. Logo sekolah / pemda
  const cfg = getSchoolConfig();
  const logoFields = ['logoPemda', 'logoSekolah', 'logo'] as const;
  const next: Record<string, string> = {};
  for (const f of logoFields) {
    const v = (cfg as any)[f] as string | undefined;
    if (v && v.startsWith('data:')) {
      onProgress?.(`Logo ${f}`);
      try {
        next[f] = (await uploadDataUrlToImageKit(v, `logo-${f}`, { subfolder: 'logo' })).url;
        res.moved++;
      } catch {
        res.failed++;
      }
    }
  }
  if (Object.keys(next).length) saveSchoolConfig({ ...getSchoolConfig(), ...next });

  return res;
}

// ---------------------------------------------------------------------------
// Rombel kelas (hanya operator yang boleh menambah / menghapus)
// ---------------------------------------------------------------------------
const DEFAULT_KELAS = '1, 2, 3, 4, 5, 6';

export function getKelasList(cfg: SchoolConfig = getSchoolConfig()): string[] {
  return (cfg.kelas || DEFAULT_KELAS)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function sortKelas(list: string[]): string[] {
  return [...list].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
}

export interface RombelResult {
  ok: boolean;
  message: string;
  value?: string;
}

function isOperatorNow(): boolean {
  return getCurrentUser()?.role === 'operator';
}

export function addRombel(raw: string): RombelResult {
  if (!isOperatorNow()) return { ok: false, message: 'Hanya operator yang dapat menambah rombel kelas.' };
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, message: 'Nama rombel kelas belum diisi.' };
  if (name.length > 12) return { ok: false, message: 'Nama rombel maksimal 12 karakter (contoh: 1A, 4B).' };
  if (/[,;]/.test(name)) return { ok: false, message: 'Nama rombel tidak boleh mengandung koma.' };
  const cfg = getSchoolConfig();
  const list = getKelasList(cfg);
  if (list.some((k) => k.toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: `Rombel "${name}" sudah ada.` };
  }
  const value = sortKelas([...list, name]).join(', ');
  saveSchoolConfig({ ...cfg, kelas: value });
  return { ok: true, message: `Rombel "${name}" ditambahkan.`, value };
}

export function removeRombel(name: string): RombelResult {
  if (!isOperatorNow()) return { ok: false, message: 'Hanya operator yang dapat menghapus rombel kelas.' };
  const cfg = getSchoolConfig();
  const list = getKelasList(cfg);
  if (!list.includes(name)) return { ok: false, message: `Rombel "${name}" tidak ditemukan.` };
  if (list.length <= 1) return { ok: false, message: 'Minimal harus ada satu kelas.' };
  const siswaAktif = getSiswas().filter((s) => s.kelas === name && s.status === 'Aktif').length;
  if (siswaAktif > 0) {
    return { ok: false, message: `Rombel "${name}" masih berisi ${siswaAktif} siswa aktif. Pindahkan siswanya ke rombel lain dulu.` };
  }
  const arsip = getArsipAbsen().filter((a) => a.kelas === name).length;
  if (arsip > 0) {
    return { ok: false, message: `Rombel "${name}" masih punya ${arsip} arsip absensi. Ubah kelas arsipnya dulu atau hapus arsipnya.` };
  }
  const value = list.filter((k) => k !== name).join(', ');
  saveSchoolConfig({ ...cfg, kelas: value });
  return { ok: true, message: `Rombel "${name}" dihapus.`, value };
}
