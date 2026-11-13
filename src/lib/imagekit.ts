/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Klien ImageKit untuk foto dan berkas dokumen (Supabase hanya menyimpan teks).
 *
 * Unggah dari browser butuh tanda tangan (signature) yang dibuat dengan PRIVATE KEY.
 * Private key tidak boleh ada di aplikasi, jadi aplikasi memanggil "auth endpoint" milik sendiri
 * (contoh siap pakai: imagekit/apps-script-auth.gs, gratis di Google Apps Script) yang membalas
 *   GET <authEndpoint>            -> { token, expire, signature }
 *   GET <authEndpoint>?action=delete&fileId=XXX  -> { ok: true }   (opsional, untuk hapus berkas)
 * Endpoint apa pun yang membalas format itu bisa dipakai (Cloudflare Worker, Vercel, dll).
 */

import type { ImageKitConfig } from '../types';
import { CLOUD_DEFAULTS } from '../config/cloud.config';

const STORAGE_KEY = 'mo_imagekit_config';
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

export const DEFAULT_IMAGEKIT_CONFIG: ImageKitConfig = {
  publicKey: CLOUD_DEFAULTS.imagekit.publicKey,
  urlEndpoint: CLOUD_DEFAULTS.imagekit.urlEndpoint,
  authEndpoint: CLOUD_DEFAULTS.imagekit.authEndpoint,
  folder: CLOUD_DEFAULTS.imagekit.folder,
};

function normalizeFolder(f: string | undefined): string {
  const v = String(f ?? '').trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  if (!v) return '';
  return v.startsWith('/') ? v : '/' + v;
}

function normalize(raw: Partial<ImageKitConfig>): ImageKitConfig {
  const m = { ...DEFAULT_IMAGEKIT_CONFIG, ...raw };
  return {
    publicKey: String(m.publicKey || '').trim(),
    urlEndpoint: String(m.urlEndpoint || '').trim().replace(/\/+$/, ''),
    authEndpoint: String(m.authEndpoint || '').trim(),
    folder: normalizeFolder(m.folder),
  };
}

export function getImageKitConfig(): ImageKitConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Jika config tersimpan masih kosong atau belum ada authEndpoint, bersihkan agar memakai CLOUD_DEFAULTS yang sudah terkonfigurasi
      if (!parsed || !parsed.publicKey || !parsed.authEndpoint) {
        localStorage.removeItem(STORAGE_KEY);
        return normalize({});
      }
      const norm = normalize(parsed);
      // Jika masih menyimpan urlEndpoint akar akun lama (mis. tanpa /OPS) untuk akun bawaan yang sama, selaraskan dengan bawaan
      if (
        norm.publicKey === DEFAULT_IMAGEKIT_CONFIG.publicKey &&
        DEFAULT_IMAGEKIT_CONFIG.urlEndpoint &&
        (!norm.urlEndpoint || DEFAULT_IMAGEKIT_CONFIG.urlEndpoint.startsWith(norm.urlEndpoint + '/'))
      ) {
        return {
          ...norm,
          urlEndpoint: DEFAULT_IMAGEKIT_CONFIG.urlEndpoint,
          folder: norm.folder || DEFAULT_IMAGEKIT_CONFIG.folder,
        };
      }
      return norm;
    }
  } catch {}
  return normalize({});
}

export function saveImageKitConfig(cfg: Partial<ImageKitConfig>): ImageKitConfig {
  const updated = normalize({ ...getImageKitConfig(), ...cfg });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  notify();
  return updated;
}

/** Hapus pengaturan tersimpan di browser ini -> kembali ke nilai dari .env / cloud.config.ts. */
export function resetImageKitConfig(): ImageKitConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  notify();
  return getImageKitConfig();
}

/** ImageKit siap dipakai bila public key dan auth endpoint sudah diisi. */
export function isImageKitReady(cfg: ImageKitConfig = getImageKitConfig()): boolean {
  return !!(cfg.publicKey && cfg.authEndpoint);
}

const listeners = new Set<() => void>();
export function subscribeImageKitConfig(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function notify(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

// ---------------------------------------------------------------------------

interface AuthParams {
  token: string;
  expire: number;
  signature: string;
}

function withQuery(url: string, query: string): string {
  return url + (url.includes('?') ? '&' : '?') + query;
}

async function fetchAuth(cfg: ImageKitConfig): Promise<AuthParams> {
  let res: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(withQuery(cfg.authEndpoint, 'action=auth'), { method: 'GET', cache: 'no-store' });
      if (res.ok || res.status < 500) break;
    } catch (e) {
      lastErr = e;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
  }
  if (!res) {
    throw new Error(
      lastErr instanceof Error && lastErr.message
        ? `Auth endpoint ImageKit tidak dapat dihubungi (${lastErr.message}).`
        : 'Auth endpoint ImageKit tidak dapat dihubungi. Periksa internet dan alamat Auth Endpoint.'
    );
  }
  if (!res.ok) throw new Error(`Auth endpoint ImageKit membalas HTTP ${res.status}.`);
  let body: Partial<AuthParams> & { error?: string };
  try {
    body = await res.json();
  } catch {
    throw new Error('Auth endpoint ImageKit tidak membalas JSON. Pastikan skrip sudah di-deploy sebagai Web App (akses: Anyone).');
  }
  if (body.error) throw new Error(`Auth endpoint ImageKit: ${body.error}`);
  if (!body.token || !body.signature || !body.expire) {
    throw new Error('Balasan auth endpoint harus berisi token, expire, dan signature.');
  }
  return { token: body.token, expire: Number(body.expire), signature: body.signature };
}

export interface ImageKitUploadResult {
  url: string;
  fileId: string;
  filePath: string;
  name: string;
  size: number;
}

/** Subfolder dibersihkan: tanpa "..", tanpa karakter aneh. */
function cleanSubfolder(sub: string | undefined): string {
  return String(sub || '')
    .split('/')
    .map((p) => p.trim().replace(/[^a-zA-Z0-9._-]/g, '_'))
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/');
}

export interface UploadOptions {
  /** Subfolder di bawah folder induk, mis. "gtk/g_123". */
  subfolder?: string;
  tags?: string[];
}

export async function uploadToImageKit(
  blob: Blob,
  fileName: string,
  opts: UploadOptions = {}
): Promise<ImageKitUploadResult> {
  const cfg = getImageKitConfig();
  if (!isImageKitReady(cfg)) throw new Error('ImageKit belum diatur (Public Key / Auth Endpoint kosong).');
  const auth = await fetchAuth(cfg);

  const sub = cleanSubfolder(opts.subfolder);
  const folder = normalizeFolder([cfg.folder, sub].filter(Boolean).join('/')) || '/';

  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('fileName', fileName);
  form.append('publicKey', cfg.publicKey);
  form.append('signature', auth.signature);
  form.append('expire', String(auth.expire));
  form.append('token', auth.token);
  form.append('folder', folder);
  form.append('useUniqueFileName', 'true');
  if (opts.tags?.length) form.append('tags', opts.tags.join(','));

  let res: Response;
  try {
    res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
  } catch {
    throw new Error('Tidak dapat menghubungi ImageKit. Periksa koneksi internet.');
  }
  let body: { url?: string; fileId?: string; filePath?: string; name?: string; size?: number; message?: string } = {};
  try {
    body = await res.json();
  } catch {}
  if (!res.ok || !body.url || !body.fileId) {
    throw new Error(`Unggah ke ImageKit gagal${body.message ? `: ${body.message}` : ` (HTTP ${res.status})`}`);
  }
  const fp = body.filePath ? (body.filePath.startsWith('/') ? body.filePath : '/' + body.filePath) : '';
  const rawUrl = fp && cfg.urlEndpoint ? `${cfg.urlEndpoint.replace(/\/+$/, '')}${fp}` : body.url;
  const finalUrl = resolveImageKitUrl(rawUrl, fp);
  return {
    url: finalUrl,
    fileId: body.fileId,
    filePath: fp || body.filePath || '',
    name: body.name || fileName,
    size: body.size ?? blob.size,
  };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  if (/;base64/i.test(head)) {
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

export function extForMime(mime: string): string {
  if (/svg/.test(mime)) return 'svg';
  if (/png/.test(mime)) return 'png';
  if (/webp/.test(mime)) return 'webp';
  if (/pdf/.test(mime)) return 'pdf';
  return 'jpg';
}

/** Unggah gambar berbentuk data URL (logo, foto surat) dan kembalikan URL ImageKit. */
export async function uploadDataUrlToImageKit(
  dataUrl: string,
  baseName: string,
  opts: UploadOptions = {}
): Promise<ImageKitUploadResult> {
  const blob = dataUrlToBlob(dataUrl);
  return uploadToImageKit(blob, `${baseName}.${extForMime(blob.type)}`, opts);
}

/** Hapus berkas di ImageKit lewat auth endpoint (butuh private key, jadi tidak bisa langsung dari browser). */
export async function deleteFromImageKit(fileId: string | undefined): Promise<boolean> {
  const cfg = getImageKitConfig();
  if (!fileId || !isImageKitReady(cfg)) return false;
  try {
    const res = await fetch(withQuery(cfg.authEndpoint, `action=delete&fileId=${encodeURIComponent(fileId)}`), {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({}));
    return body?.ok === true;
  } catch {
    return false;
  }
}

export interface ImageKitTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

/** Uji: pastikan Public Key terisi dan auth endpoint membalas token/expire/signature yang valid. */
export async function testImageKitConnection(override?: Partial<ImageKitConfig>): Promise<ImageKitTestResult> {
  const cfg = normalize({ ...getImageKitConfig(), ...override });
  if (!cfg.publicKey) return { ok: false, latencyMs: 0, message: 'Public Key ImageKit belum diisi.' };
  if (!cfg.authEndpoint) return { ok: false, latencyMs: 0, message: 'Auth Endpoint belum diisi (lihat imagekit/apps-script-auth.gs).' };
  const t0 = performance.now();
  try {
    await fetchAuth(cfg);
    const latencyMs = Math.round(performance.now() - t0);
    return { ok: true, latencyMs, message: `Auth endpoint ImageKit berfungsi — ${latencyMs} ms. Unggah berkas siap dipakai.` };
  } catch (e) {
    return { ok: false, latencyMs: Math.round(performance.now() - t0), message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Menyelaraskan URL berkas ImageKit dengan URL Endpoint saat ini.
 * Jika URL Endpoint memiliki akhiran folder (mis. https://ik.imagekit.io/xvfbvpj3a/OPS)
 * dan filePath juga diawali akhiran tersebut (/OPS/...), ImageKit mengembalikan body.url
 * dengan satu /OPS sehingga saat diakses membalas 404. Fungsi ini memastikan URL selalu memakai
 * endpoint lengkap + filePath (/OPS/OPS/...) agar bisa dibuka dari perangkat/akun mana pun.
 */
export function resolveImageKitUrl(url: string | undefined, path?: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const qIdx = url.indexOf('?');
  const base = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const query = qIdx >= 0 ? url.slice(qIdx) : '';

  const candidates = Array.from(
    new Set(
      [getImageKitConfig().urlEndpoint, DEFAULT_IMAGEKIT_CONFIG.urlEndpoint]
        .map((ep) => String(ep || '').trim().replace(/\/+$/, ''))
        .filter(Boolean)
    )
  );

  for (const ep of candidates) {
    try {
      const parsed = new URL(ep);
      const parts = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
      if (parts.length < 2) continue;

      const accountBase = `${parsed.origin}/${parts[0]}`;
      const epSuffix = `/${parts.slice(1).join('/')}`;
      const fullEp = `${parsed.origin}/${parts.join('/')}`;

      if (base.startsWith(`${fullEp}${epSuffix}/`)) {
        return url;
      }

      if (path) {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        if (cleanPath.startsWith(`${epSuffix}/`) && base.startsWith(`${accountBase}/`)) {
          return `${fullEp}${cleanPath}${query}`;
        }
      }

      if (
        base.startsWith(`${fullEp}/`) &&
        !base.startsWith(`${fullEp}${epSuffix}/`) &&
        !base.startsWith(`${fullEp}/meja-operator/`)
      ) {
        const rest = base.slice(fullEp.length);
        return `${fullEp}${epSuffix}${rest}${query}`;
      }
    } catch {}
  }

  return url;
}

/** Apakah URL ini milik ImageKit (domain imagekit.io atau URL endpoint sendiri). */
function isImageKitUrl(url: string): boolean {
  if (/^https?:\/\/[^/]*imagekit\.io\//i.test(url)) return true;
  const ep = getImageKitConfig().urlEndpoint;
  return !!ep && url.startsWith(ep);
}

/**
 * Versi gambar yang sudah diperkecil oleh ImageKit (lebar maks. `width` px, kualitas 75, format otomatis).
 * Dipakai untuk pratinjau/thumbnail agar hemat kuota; berkas asli hanya diunduh saat diminta.
 * URL non-ImageKit, data URL, SVG, dan PDF dikembalikan apa adanya.
 */
export function ikResize(url: string | undefined, width: number): string {
  const resolved = resolveImageKitUrl(url);
  if (!resolved || resolved.startsWith('data:') || !isImageKitUrl(resolved)) return resolved || '';
  if (/\.(svg|pdf)(\?|$)/i.test(resolved) || /[?&]tr=/.test(resolved)) return resolved;
  return resolved + (resolved.includes('?') ? '&' : '?') + `tr=w-${Math.round(width)},q-75,f-auto`;
}

/** URL unduh langsung: ImageKit membalas dengan header "attachment" sehingga browser langsung menyimpan berkas. */
export function ikDownloadUrl(url: string): string {
  const resolved = resolveImageKitUrl(url);
  return isImageKitUrl(resolved) ? resolved + (resolved.includes('?') ? '&' : '?') + 'ik-attachment=true' : resolved;
}
