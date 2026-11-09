/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Penyimpanan berkas (PDF / gambar scan / Word) yang terpisah dari data teks aplikasi.
 *
 * Alur simpan:
 *  1. Berkas ditulis ke IndexedDB perangkat (cache + antrean kirim ulang).
 *  2. Berkas diunggah ke ImageKit. Jika gagal (offline / ImageKit belum diatur), berkas tetap aman
 *     di perangkat dan dikirim ulang otomatis sampai berhasil.
 *  3. Supabase HANYA menyimpan referensi teks kecil {id, name, size, type, url, ikId, path}.
 *     Isi berkas tidak pernah masuk ke Supabase.
 */

import { getSupabaseClient, getSupabaseConfig } from './supabase';
import { getLegacyFilesTableName } from './sqlScript';
import {
  isImageKitReady,
  uploadToImageKit,
  deleteFromImageKit,
  dataUrlToBlob,
  subscribeImageKitConfig,
  ikDownloadUrl,
} from './imagekit';
import { compressCanvas, loadImageToCanvas, TARGET_BYTES } from './compress';
import type { FileRef } from '../types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (setelah kompresi gambar)

const DB_NAME = 'mo_files_db';
const STORE = 'files';

interface LocalFileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  pending: boolean; // true = belum terunggah ke ImageKit
  url?: string;
  ikId?: string;
  path?: string;
  /** Subfolder tujuan di ImageKit, dipakai saat kirim ulang. */
  folder?: string;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbPut(rec: LocalFileRecord): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet(id: string): Promise<LocalFileRecord | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as LocalFileRecord) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbPending(): Promise<LocalFileRecord[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const out: LocalFileRecord[] = [];
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const v = cur.value as LocalFileRecord;
          if (v.pending) out.push(v);
          cur.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve([]);
    }
  });
}

// ---------------------------------------------------------------------------
// Status sinkronisasi berkas (untuk indikator di UI)
// ---------------------------------------------------------------------------
let pendingCount = 0;
const listeners = new Set<() => void>();

export function subscribeFileSync(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getPendingFileCount(): number {
  return pendingCount;
}
function setPending(n: number): void {
  if (n === pendingCount) return;
  pendingCount = n;
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

// ---------------------------------------------------------------------------
// Cloud (ImageKit)
// ---------------------------------------------------------------------------
function cloudEnabled(): boolean {
  return isImageKitReady();
}

/** Dipanggil saat berkas yang tertunda akhirnya terunggah, agar referensi di data teks ikut diperbarui. */
type UploadedHandler = (fileId: string, patch: Pick<FileRef, 'url' | 'ikId' | 'path'>) => void;
let uploadedHandler: UploadedHandler | null = null;
export function setFileUploadedHandler(cb: UploadedHandler): void {
  uploadedHandler = cb;
}

/** Unggah satu rekaman ke ImageKit. Mengembalikan rekaman yang sudah berisi url, atau null bila gagal. */
async function uploadToCloud(rec: LocalFileRecord): Promise<LocalFileRecord | null> {
  if (!cloudEnabled()) return null;
  if (rec.url && rec.ikId) return { ...rec, pending: false };
  try {
    const res = await uploadToImageKit(dataUrlToBlob(rec.dataUrl), rec.name, { subfolder: rec.folder });
    return { ...rec, url: res.url, ikId: res.fileId, path: res.filePath, pending: false };
  } catch (e) {
    console.warn('Unggah ImageKit gagal:', e instanceof Error ? e.message : e);
    return null;
  }
}

let flushing = false;
/** Kirim ulang berkas yang belum terunggah. Aman dipanggil berulang. */
export async function flushPendingFiles(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const list = await idbPending();
    let left = list.length;
    for (const rec of list) {
      const done = await uploadToCloud(rec);
      if (done) {
        await idbPut(done);
        left--;
        try {
          uploadedHandler?.(done.id, { url: done.url, ikId: done.ikId, path: done.path });
        } catch {}
      }
    }
    setPending(left);
  } finally {
    flushing = false;
  }
}

let started = false;
export function startFileSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const run = () => {
    flushPendingFiles().catch(() => {});
  };
  run();
  setInterval(run, 20000);
  window.addEventListener('online', run);
  subscribeImageKitConfig(run); // begitu ImageKit diatur, antrean langsung dikirim
}

// ---------------------------------------------------------------------------
// API publik
// ---------------------------------------------------------------------------
export function newFileId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface PreparedFile extends FileRef {
  dataUrl: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Gagal membaca berkas.'));
    r.readAsDataURL(blob);
  });
}

async function compressImage(file: File): Promise<Blob> {
  const c = await loadImageToCanvas(file);
  const out = await compressCanvas(c, TARGET_BYTES);
  return new Blob([out.bytes as BlobPart], { type: 'image/jpeg' });
}

/**
 * Validasi + siapkan berkas pilihan pengguna. Gambar besar dikompres otomatis.
 * Melempar Error berisi pesan yang bisa langsung ditampilkan.
 */
export async function prepareFile(
  file: File,
  opts: { pdfOnly?: boolean; allowOffice?: boolean; maxBytes?: number } = {}
): Promise<PreparedFile> {
  const maxBytes = opts.maxBytes ?? MAX_FILE_BYTES;
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith('image/');
  if (opts.pdfOnly && !isPdf) throw new Error('Hanya berkas PDF yang diperbolehkan.');
  const isOffice = /\.(docx?|xlsx?)$/i.test(file.name);
  if (!isPdf && !isImage && !(opts.allowOffice && isOffice)) {
    throw new Error(
      opts.allowOffice
        ? 'Format berkas harus PDF, gambar (JPG/PNG), atau Word (.doc/.docx).'
        : 'Format berkas harus PDF atau gambar (JPG/PNG).'
    );
  }

  let blob: Blob = file;
  let name = file.name;
  let type = isPdf ? 'application/pdf' : file.type || 'application/octet-stream';
  if (isImage && file.size > TARGET_BYTES) {
    blob = await compressImage(file);
    type = 'image/jpeg';
    name = name.replace(/\.[^.]+$/, '') + '.jpg';
  }
  if (blob.size > maxBytes) {
    const fmt = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${Math.round(b / 1024)} KB`);
    throw new Error(
      `Ukuran berkas ${fmt(blob.size)} melebihi batas ${fmt(maxBytes)}. Kompres PDF terlebih dahulu (mis. lewat ilovepdf / smallpdf).`
    );
  }
  const dataUrl = await readAsDataUrl(blob);
  return { id: newFileId(), name, size: blob.size, type, dataUrl };
}

export interface SaveFileResult {
  ref: FileRef;
  /** true bila sudah terunggah ke ImageKit; false bila baru tersimpan di perangkat ini. */
  cloud: boolean;
}

export interface SaveFileOptions {
  /** Subfolder di ImageKit, mis. "gtk/g_123" atau "arsip-absen". */
  folder?: string;
}

/** Simpan berkas. Melempar Error jika berkas tidak bisa disimpan sama sekali. */
export async function saveFile(file: PreparedFile, opts: SaveFileOptions = {}): Promise<SaveFileResult> {
  const rec: LocalFileRecord = {
    id: file.id,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl: file.dataUrl,
    pending: true,
    folder: opts.folder,
  };

  const localOk = await idbPut(rec);
  const uploaded = await uploadToCloud(rec);

  if (!localOk && !uploaded) {
    throw new Error(
      cloudEnabled()
        ? 'Berkas tidak dapat disimpan: penyimpanan browser tidak tersedia (mode privat?) dan unggah ke ImageKit gagal. Coba lagi dengan koneksi internet aktif.'
        : 'Berkas tidak dapat disimpan: penyimpanan browser tidak tersedia dan ImageKit belum diatur. Hubungi operator.'
    );
  }
  if (uploaded && localOk) await idbPut(uploaded);
  if (!uploaded) setPending((await idbPending()).length);

  const done = uploaded || rec;
  const ref: FileRef = {
    id: rec.id,
    name: rec.name,
    size: rec.size,
    type: rec.type,
    ...(done.url ? { url: done.url, ikId: done.ikId, path: done.path } : {}),
  };
  return { ref, cloud: !!uploaded };
}

/** Berkas versi lama disimpan sebagai base64 di tabel Supabase `<prefix>files`. Hanya dibaca (untuk migrasi). */
async function readLegacySupabaseFile(id: string): Promise<LocalFileRecord | null> {
  try {
    const cfg = getSupabaseConfig();
    if (!cfg.apiKey || !cfg.projectUrl) return null;
    const { data, error } = await getSupabaseClient()
      .from(getLegacyFilesTableName(cfg.tablePrefix))
      .select('id,name,mime,size,data')
      .eq('id', id)
      .maybeSingle();
    if (error || !data || !data.data) return null;
    return { id: data.id, name: data.name, type: data.mime, size: data.size, dataUrl: data.data, pending: true };
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return readAsDataUrl(blob);
}

/** Ambil isi berkas (data URL): perangkat dulu, lalu ImageKit, lalu tabel lama. Null bila tidak ditemukan. */
export async function getFileDataUrl(ref: FileRef): Promise<string | null> {
  if (ref.dataUrl) return ref.dataUrl; // data lama yang belum dimigrasi
  const local = await idbGet(ref.id);
  if (local) return local.dataUrl;
  if (ref.url) {
    try {
      const res = await fetch(ref.url);
      if (res.ok) {
        const blob = await res.blob();
        const typed = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: ref.type || blob.type });
        const dataUrl = await blobToDataUrl(typed);
        await idbPut({
          id: ref.id,
          name: ref.name,
          type: ref.type || typed.type,
          size: ref.size,
          dataUrl,
          pending: false,
          url: ref.url,
          ikId: ref.ikId,
          path: ref.path,
        });
        return dataUrl;
      }
    } catch {}
  }
  const legacy = await readLegacySupabaseFile(ref.id);
  if (legacy) {
    await idbPut(legacy); // tetap pending=true -> ikut terunggah ke ImageKit bila sudah diatur
    return legacy.dataUrl;
  }
  return null;
}

/** Hapus berkas dari perangkat dan (bila auth endpoint mendukung) dari ImageKit. */
export async function deleteFile(target: FileRef | string | undefined): Promise<void> {
  if (!target) return;
  const ref = typeof target === 'string' ? ({ id: target } as FileRef) : target;
  if (!ref.id) return;
  const local = ref.ikId ? null : await idbGet(ref.id);
  const ikId = ref.ikId || local?.ikId;
  await idbDelete(ref.id);
  if (ikId) await deleteFromImageKit(ikId).catch(() => false);
}

/** Ubah data URL menjadi blob URL (agar PDF bisa dibuka di tab baru). */
export function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    return URL.createObjectURL(dataUrlToBlob(dataUrl));
  } catch {
    return null;
  }
}

/** Buka berkas di tab baru. Mengembalikan false bila berkas tidak ditemukan. */
export async function openFile(ref: FileRef): Promise<boolean> {
  if (ref.url) {
    window.open(ref.url, '_blank', 'noopener');
    return true;
  }
  const du = await getFileDataUrl(ref);
  if (!du) return false;
  const url = dataUrlToBlobUrl(du);
  if (!url) return false;
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return true;
}

/** Apakah salinan berkas sudah ada di perangkat ini (membukanya tidak memakai kuota internet). */
export async function hasLocalCopy(ref: FileRef): Promise<boolean> {
  return !!ref.dataUrl || !!(await idbGet(ref.id));
}

/**
 * Unduh berkas. Bila sudah ada salinan di perangkat, pakai itu (nol kuota). Jika tidak, unduh langsung
 * dari ImageKit sebagai "attachment" (tanpa memuat ke memori dan tanpa masalah CORS).
 */
export async function downloadFile(ref: FileRef): Promise<boolean> {
  const local = ref.dataUrl ? { dataUrl: ref.dataUrl } : await idbGet(ref.id);
  if (!local && ref.url) {
    const a = document.createElement('a');
    a.href = ikDownloadUrl(ref.url);
    a.download = ref.name || 'berkas';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }
  const du = local?.dataUrl || (await getFileDataUrl(ref));
  if (!du) return false;
  const url = dataUrlToBlobUrl(du);
  if (!url) return false;
  const a = document.createElement('a');
  a.href = url;
  a.download = ref.name || 'berkas';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/** Berkas lokal yang belum punya url ImageKit (untuk migrasi): kembalikan isinya bila ada di perangkat. */
export async function getLocalRecord(id: string): Promise<{ dataUrl: string; name: string; type: string } | null> {
  const r = await idbGet(id);
  return r ? { dataUrl: r.dataUrl, name: r.name, type: r.type } : null;
}
