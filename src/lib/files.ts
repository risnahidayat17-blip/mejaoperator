/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Penyimpanan berkas (PDF / gambar scan) yang terpisah dari data teks aplikasi.
 *
 * Alur simpan:
 *  1. Berkas ditulis ke IndexedDB perangkat (kapasitas ratusan MB, bukan ~5 MB seperti localStorage).
 *  2. Berkas diunggah ke tabel Supabase `mo_files` supaya bisa dibuka dari perangkat lain.
 *     Jika unggah gagal (offline / tabel belum dibuat), berkas tetap aman di perangkat dan
 *     dikirim ulang otomatis sampai berhasil.
 *  3. Data dokumen (modul teks) hanya menyimpan referensi kecil {id, name, size, type}.
 */

import { getSupabaseClient, getSupabaseConfig } from './supabase';
import type { FileRef } from '../types';

export const FILE_TABLE = 'mo_files';
export const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB setelah kompresi

const DB_NAME = 'mo_files_db';
const STORE = 'files';

interface LocalFileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  pending: boolean; // true = belum terunggah ke cloud
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
// Cloud
// ---------------------------------------------------------------------------
function cloudEnabled(): boolean {
  const cfg = getSupabaseConfig();
  return !!(cfg.autoSync && cfg.apiKey && cfg.projectUrl);
}

async function uploadToCloud(rec: LocalFileRecord): Promise<boolean> {
  if (!cloudEnabled()) return false;
  try {
    const { error } = await getSupabaseClient()
      .from(FILE_TABLE)
      .upsert(
        {
          id: rec.id,
          name: rec.name,
          mime: rec.type,
          size: rec.size,
          data: rec.dataUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    return !error;
  } catch {
    return false;
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
      if (await uploadToCloud(rec)) {
        await idbPut({ ...rec, pending: false });
        left--;
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
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
      i.src = url;
    });
    const max = 1800;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gambar tidak dapat diproses.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Gambar tidak dapat dikompres.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
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
  if (isImage && file.size > 700 * 1024) {
    blob = await compressImage(file);
    type = 'image/jpeg';
    name = name.replace(/\.[^.]+$/, '') + '.jpg';
  }
  if (blob.size > maxBytes) {
    const mb = (blob.size / 1048576).toFixed(2);
    throw new Error(
      `Ukuran berkas ${mb} MB melebihi batas ${(maxBytes / 1048576).toFixed(0)} MB. Kompres PDF terlebih dahulu (mis. lewat ilovepdf / smallpdf).`
    );
  }
  const dataUrl = await readAsDataUrl(blob);
  return { id: newFileId(), name, size: blob.size, type, dataUrl };
}

export interface SaveFileResult {
  ref: FileRef;
  /** true bila sudah terunggah ke cloud; false bila baru tersimpan di perangkat ini. */
  cloud: boolean;
}

/** Simpan berkas. Melempar Error jika berkas tidak bisa disimpan sama sekali. */
export async function saveFile(file: PreparedFile): Promise<SaveFileResult> {
  const rec: LocalFileRecord = {
    id: file.id,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl: file.dataUrl,
    pending: true,
  };
  const ref: FileRef = { id: rec.id, name: rec.name, size: rec.size, type: rec.type };

  const localOk = await idbPut(rec);
  const cloudOk = await uploadToCloud(rec);

  if (!localOk && !cloudOk) {
    throw new Error(
      'Berkas tidak dapat disimpan: penyimpanan browser tidak tersedia (mode privat?) dan koneksi ke cloud gagal. Coba lagi dengan koneksi internet aktif.'
    );
  }
  if (cloudOk && localOk) await idbPut({ ...rec, pending: false });
  if (!cloudOk) {
    const left = (await idbPending()).length;
    setPending(left);
  }
  return { ref, cloud: cloudOk };
}

/** Ambil isi berkas (data URL): perangkat dulu, lalu cloud. Null bila tidak ditemukan. */
export async function getFileDataUrl(ref: FileRef): Promise<string | null> {
  if (ref.dataUrl) return ref.dataUrl; // data lama yang belum dimigrasi
  const local = await idbGet(ref.id);
  if (local) return local.dataUrl;
  if (!cloudEnabled()) return null;
  try {
    const { data, error } = await getSupabaseClient()
      .from(FILE_TABLE)
      .select('id,name,mime,size,data')
      .eq('id', ref.id)
      .maybeSingle();
    if (error || !data || !data.data) return null;
    await idbPut({
      id: data.id,
      name: data.name,
      type: data.mime,
      size: data.size,
      dataUrl: data.data,
      pending: false,
    });
    return data.data as string;
  } catch {
    return null;
  }
}

export async function deleteFile(id: string | undefined): Promise<void> {
  if (!id) return;
  await idbDelete(id);
  if (!cloudEnabled()) return;
  try {
    await getSupabaseClient().from(FILE_TABLE).delete().eq('id', id);
  } catch {}
}

/** Ubah data URL menjadi blob URL (agar PDF bisa dibuka di tab baru). */
export function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const [head, body] = dataUrl.split(',');
    const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime }));
  } catch {
    return null;
  }
}

/** Buka berkas di tab baru. Mengembalikan false bila berkas tidak ditemukan. */
export async function openFile(ref: FileRef): Promise<boolean> {
  const du = await getFileDataUrl(ref);
  if (!du) return false;
  const url = dataUrlToBlobUrl(du);
  if (!url) return false;
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return true;
}

export async function downloadFile(ref: FileRef): Promise<boolean> {
  const du = await getFileDataUrl(ref);
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
