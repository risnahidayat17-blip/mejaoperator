/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tautan pengaturan: operator menyalin satu tautan, guru/perangkat lain cukup membukanya
 * sekali, dan koneksi Supabase + ImageKit langsung terisi di browser mereka.
 * Hanya berisi kunci PUBLIK (publishable key, public key, URL). Private key tidak pernah ikut.
 */

import { getSupabaseConfig, saveSupabaseConfig } from './supabase';
import { getImageKitConfig, saveImageKitConfig } from './imagekit';
import { resetCloudSyncState } from './storage';

const PARAM = 'setup';

function toB64(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(s: string): any {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function buildSetupLink(): string {
  const sb = getSupabaseConfig();
  const ik = getImageKitConfig();
  const payload = {
    sb: { n: sb.projectName, u: sb.projectUrl, k: sb.apiKey, p: sb.tablePrefix },
    ik: { pk: ik.publicKey, ue: ik.urlEndpoint, ae: ik.authEndpoint, f: ik.folder },
  };
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PARAM, toB64(payload));
  return url.toString();
}

/**
 * Dipanggil sekali saat aplikasi dibuka. Bila URL berisi ?setup=..., terapkan pengaturan
 * (setelah konfirmasi) lalu bersihkan parameter dari alamat. Mengembalikan true bila diterapkan.
 */
export function applySetupFromUrl(): boolean {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(PARAM);
    if (!raw) return false;
    url.searchParams.delete(PARAM);
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);

    const d = fromB64(raw);
    if (!d?.sb?.u || !d?.sb?.k) return false;
    const host = (() => {
      try {
        return new URL(d.sb.u).hostname;
      } catch {
        return '';
      }
    })();
    if (!host) return false;

    saveSupabaseConfig({
      projectName: d.sb.n || 'Meja Operator',
      projectUrl: d.sb.u,
      apiKey: d.sb.k,
      tablePrefix: d.sb.p ?? 'mo_',
      autoSync: true,
    });
    if (d.ik) {
      saveImageKitConfig({
        publicKey: d.ik.pk || '',
        urlEndpoint: d.ik.ue || '',
        authEndpoint: d.ik.ae || '',
        folder: d.ik.f || '',
      });
    }
    resetCloudSyncState();
    try {
      localStorage.setItem('mo_setup_applied_toast', 'Koneksi database Supabase berhasil diterapkan dari tautan.');
    } catch {}
    return true;
  } catch {
    return false;
  }
}
