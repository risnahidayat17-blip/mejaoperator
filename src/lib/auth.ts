/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Penyimpanan kata sandi sebagai hash (PBKDF2-SHA256 + salt acak). Kata sandi asli tidak pernah
 * disimpan atau ditampilkan. Catatan: ini melindungi dari "terlihat" di layar/penyimpanan browser,
 * tetapi aplikasi ini berjalan sepenuhnya di browser, jadi bukan pengganti login server.
 */

const ITER = 100000;
const KEY_BYTES = 32;

export const MIN_PASSWORD_LENGTH = 8;
/** Password guru/tendik dibuat oleh operator, jadi cukup 6 karakter agar mudah diingat. */
export const MIN_GURU_PASSWORD_LENGTH = 6;

const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Peramban tidak mendukung enkripsi (butuh alamat https). Buka aplikasi lewat https.');
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations: ITER }, key, KEY_BYTES * 8);
  return b64(bits);
}

export async function hashPassword(password: string): Promise<{ passwordSalt: string; passwordHash: string }> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return { passwordSalt: b64(salt), passwordHash: await derive(password, salt) };
}

export async function verifyPassword(password: string, passwordSalt?: string, passwordHash?: string): Promise<boolean> {
  if (!passwordSalt || !passwordHash) return false;
  const h = await derive(password, fromB64(passwordSalt));
  if (h.length !== passwordHash.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ passwordHash.charCodeAt(i);
  return diff === 0;
}
