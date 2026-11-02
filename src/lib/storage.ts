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
  SuratMasuk,
  SuratKeluar,
  Mutasi,
  NilaiRecord,
  BerkasPenilaian,
  LaporanBulan,
  LetterTemplate,
  ArsipAbsen,
  KeuanganState,
} from '../types';
import {
  initialUsers,
  initialSchoolConfig,
  initialSiswas,
  initialGurus,
  initialAsets,
  initialSuratMasuk,
  initialSuratKeluar,
  initialMutasi,
  initialLetterTemplates,
} from '../data/initialData';
import {
  getSupabaseConfig,
  pushAllToSupabase,
  pullAllFromSupabase,
} from './supabase';

export const KEYS = {
  USERS: 'mo_users',
  CURRENT_USER: 'mo_current_user',
  CFG: 'mo_school_config',
  SISWA: 'mo_siswa',
  GURU: 'mo_guru',
  DOKGTK: 'mo_dokgtk',
  ASET: 'mo_aset',
  SURATMASUK: 'mo_suratmasuk',
  SURATKELUAR: 'mo_suratkeluar',
  MUTASI: 'mo_mutasi',
  NILAI: 'mo_nilai',
  BERKAS: 'mo_berkas',
  LAPORAN: 'mo_laporan',
  TEMPLATES: 'mo_letter_templates',
  ARSIPABSEN: 'mo_arsip_absen',
  KEUANGAN: 'mo_keuangan',
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
const SYNC_SKIP_KEYS = new Set<string>([KEYS.USERS, KEYS.CURRENT_USER]);
const pendingPushKeys = new Set<string>();
let pushTimer: any = null;
let pushing = false;

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

function scheduleCloudPush(key: string): void {
  if (SYNC_SKIP_KEYS.has(key)) return;
  const cfg = getSupabaseConfig();
  if (!cfg.autoSync || !cfg.apiKey || !cfg.projectUrl) return;
  pendingPushKeys.add(key);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushCloudPush, 1500);
}

async function flushCloudPush(): Promise<void> {
  if (pushing || pendingPushKeys.size === 0) return;
  pushing = true;
  const keys = Array.from(pendingPushKeys);
  try {
    const all = getAllExportableData();
    const payload: Record<string, unknown> = {};
    keys.forEach((k) => {
      if (k in all) payload[k] = all[k];
    });
    const res = await pushAllToSupabase(payload);
    if (res.success) {
      keys.forEach((k) => pendingPushKeys.delete(k));
    } else {
      console.warn('Auto-sync Supabase gagal, akan dicoba lagi:', res.message);
      pushTimer = setTimeout(flushCloudPush, 15000);
    }
  } catch (err) {
    console.warn('Auto-sync Supabase error:', err);
    pushTimer = setTimeout(flushCloudPush, 15000);
  } finally {
    pushing = false;
    if (pendingPushKeys.size > 0 && !pushTimer) pushTimer = setTimeout(flushCloudPush, 1500);
  }
}

let pulling = false;
/** Ambil perubahan dari cloud. Mengembalikan jumlah modul yang berubah. */
export async function syncFromCloud(): Promise<number> {
  const cfg = getSupabaseConfig();
  if (pulling || !cfg.autoSync || !cfg.apiKey || !cfg.projectUrl) return 0;
  pulling = true;
  try {
    const res = await pullAllFromSupabase(true);
    if (!res.success || !res.data) return 0;
    const validKeys = new Set<string>(Object.values(KEYS));
    let changed = 0;
    for (const [key, cloudVal] of Object.entries(res.data)) {
      if (!validKeys.has(key) || SYNC_SKIP_KEYS.has(key)) continue;
      if (pendingPushKeys.has(key)) continue; // perubahan lokal belum terkirim
      let localVal: unknown;
      try {
        const raw = localStorage.getItem(key);
        localVal = raw ? JSON.parse(raw) : undefined;
      } catch {
        localVal = undefined;
      }
      if (localVal !== undefined && stableStringify(localVal) === stableStringify(cloudVal)) continue;
      localStorage.setItem(key, JSON.stringify(cloudVal));
      changed++;
    }
    if (changed > 0) {
      notifyListeners();
      cloudListeners.forEach((cb) => {
        try {
          cb();
        } catch {}
      });
    }
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

export function setToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
    scheduleCloudPush(key);
    return true;
  } catch (err) {
    console.error('Storage write error:', err);
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
}

// User & Auth
export function getCurrentUser(): User | null {
  try {
    const val = sessionStorage.getItem(KEYS.CURRENT_USER);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  try {
    if (user) {
      sessionStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(KEYS.CURRENT_USER);
    }
  } catch {}
  notifyListeners();
}

export function loginOperator(password: string): { success: boolean; user?: User; message?: string } {
  const users = getFromStorage<User[]>(KEYS.USERS, initialUsers);
  const operatorUser = users.find((u) => u.role === 'operator') || initialUsers[0];
  if (password !== operatorUser.password) {
    return { success: false, message: 'Password operator tidak sesuai. Coba lagi.' };
  }
  const loggedIn: User = { ...operatorUser, lastLogin: Date.now() };
  setToStorage(KEYS.USERS, users.map((u) => (u.id === operatorUser.id ? loggedIn : u)));
  setCurrentUser(loggedIn);
  return { success: true, user: loggedIn };
}

export function loginGuru(selectedGuruId?: string): User {
  const gurus = getFromStorage<Guru[]>(KEYS.GURU, initialGurus);
  const selected = selectedGuruId ? gurus.find((g) => g.id === selectedGuruId) : undefined;
  const user: User = {
    id: selected ? `u_gtk_${selected.id}` : 'u_guru',
    username: 'guru',
    name: selected ? selected.nama : 'Guru / Tendik',
    role: 'guru',
    jabatan: selected?.jabatan,
    guruId: selected?.id,
    nip: selected?.nip,
    phone: selected?.telp,
    email: selected?.email,
    lastLogin: Date.now(),
  };
  setCurrentUser(user);
  return user;
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

export function saveSchoolConfig(config: SchoolConfig): void {
  setToStorage(KEYS.CFG, { ...config, updatedAt: Date.now() });
}

// Siswa
export function getSiswas(): Siswa[] {
  return getFromStorage<Siswa[]>(KEYS.SISWA, initialSiswas);
}

export function saveSiswa(siswa: Siswa): void {
  const list = getSiswas();
  const idx = list.findIndex((s) => s.id === siswa.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...siswa, updatedAt: now };
  } else {
    list.push({ ...siswa, createdAt: siswa.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.SISWA, list);
}

export function deleteSiswa(id: string): void {
  const filtered = getSiswas().filter((s) => s.id !== id);
  setToStorage(KEYS.SISWA, filtered);
}

// Guru
export function getGurus(): Guru[] {
  return getFromStorage<Guru[]>(KEYS.GURU, initialGurus);
}

export function saveGuru(guru: Guru): void {
  const list = getGurus();
  const idx = list.findIndex((g) => g.id === guru.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...guru, updatedAt: now };
  } else {
    list.push({ ...guru, createdAt: guru.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.GURU, list);
}

export function deleteGuru(id: string): void {
  const filtered = getGurus().filter((g) => g.id !== id);
  setToStorage(KEYS.GURU, filtered);
}

// Dokumen GTK
export function getDokumenGtks(): DokumenGtk[] {
  return getFromStorage<DokumenGtk[]>(KEYS.DOKGTK, []);
}

export function saveDokumenGtk(dok: DokumenGtk): void {
  const list = getDokumenGtks();
  const idx = list.findIndex((d) => d.id === dok.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...dok, updatedAt: now };
  } else {
    list.push({ ...dok, createdAt: dok.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.DOKGTK, list);
}

export function deleteDokumenGtk(id: string): void {
  const filtered = getDokumenGtks().filter((d) => d.id !== id);
  setToStorage(KEYS.DOKGTK, filtered);
}

// Aset
export function getAsets(): Aset[] {
  return getFromStorage<Aset[]>(KEYS.ASET, initialAsets);
}

export function saveAset(aset: Aset): void {
  const list = getAsets();
  const idx = list.findIndex((a) => a.id === aset.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...aset, updatedAt: now };
  } else {
    list.push({ ...aset, createdAt: aset.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.ASET, list);
}

export function deleteAset(id: string): void {
  const filtered = getAsets().filter((a) => a.id !== id);
  setToStorage(KEYS.ASET, filtered);
}

// Surat Masuk
export function getSuratMasuk(): SuratMasuk[] {
  return getFromStorage<SuratMasuk[]>(KEYS.SURATMASUK, initialSuratMasuk);
}

export function saveSuratMasuk(sm: SuratMasuk): void {
  const list = getSuratMasuk();
  const idx = list.findIndex((s) => s.id === sm.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...sm, updatedAt: now };
  } else {
    list.push({ ...sm, createdAt: sm.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.SURATMASUK, list);
}

export function deleteSuratMasuk(id: string): void {
  const filtered = getSuratMasuk().filter((s) => s.id !== id);
  setToStorage(KEYS.SURATMASUK, filtered);
}

// Surat Keluar
export function getSuratKeluar(): SuratKeluar[] {
  return getFromStorage<SuratKeluar[]>(KEYS.SURATKELUAR, initialSuratKeluar);
}

export function saveSuratKeluar(sk: SuratKeluar): void {
  const list = getSuratKeluar();
  const idx = list.findIndex((s) => s.id === sk.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...sk, updatedAt: now };
  } else {
    list.push({ ...sk, createdAt: sk.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.SURATKELUAR, list);
}

export function deleteSuratKeluar(id: string): void {
  const filtered = getSuratKeluar().filter((s) => s.id !== id);
  setToStorage(KEYS.SURATKELUAR, filtered);
}

// Mutasi
export function getMutasi(): Mutasi[] {
  return getFromStorage<Mutasi[]>(KEYS.MUTASI, initialMutasi);
}

export function saveMutasi(mutasi: Mutasi): void {
  const list = getMutasi();
  const idx = list.findIndex((m) => m.id === mutasi.id);
  const now = Date.now();
  if (idx >= 0) {
    list[idx] = { ...mutasi, updatedAt: now };
  } else {
    list.push({ ...mutasi, createdAt: mutasi.createdAt || now, updatedAt: now });
  }
  setToStorage(KEYS.MUTASI, list);
}

export function deleteMutasi(id: string): void {
  const filtered = getMutasi().filter((m) => m.id !== id);
  setToStorage(KEYS.MUTASI, filtered);
}

// Nilai
export function getNilaiRecords(): NilaiRecord[] {
  return getFromStorage<NilaiRecord[]>(KEYS.NILAI, []);
}

export function saveNilaiRecord(record: NilaiRecord): void {
  const list = getNilaiRecords();
  const idx = list.findIndex((n) => n.id === record.id);
  if (idx >= 0) {
    list[idx] = { ...record, updatedAt: Date.now() };
  } else {
    list.push({ ...record, updatedAt: Date.now() });
  }
  setToStorage(KEYS.NILAI, list);
}

// Letter Templates
export function getTemplates(): LetterTemplate[] {
  return getFromStorage<LetterTemplate[]>(KEYS.TEMPLATES, initialLetterTemplates);
}

export function saveTemplate(template: LetterTemplate): void {
  const list = getTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    list[idx] = { ...template, updatedAt: Date.now() };
  } else {
    list.push({ ...template, createdAt: Date.now(), updatedAt: Date.now() });
  }
  setToStorage(KEYS.TEMPLATES, list);
}

export function deleteTemplate(id: string): void {
  const filtered = getTemplates().filter((t) => t.id !== id);
  setToStorage(KEYS.TEMPLATES, filtered);
}

// Arsip Absen
export function getArsipAbsen(): ArsipAbsen[] {
  return getFromStorage<ArsipAbsen[]>(KEYS.ARSIPABSEN, []);
}

export function saveArsipAbsenList(list: ArsipAbsen[]): void {
  setToStorage(KEYS.ARSIPABSEN, list);
}

// Keuangan
const defaultKeuangan: KeuanganState = {
  settings: {
    bendaharaNama: "Dewi Anggraini, A.Md.",
    bendaharaNip: "19980422 202401 2 005",
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
