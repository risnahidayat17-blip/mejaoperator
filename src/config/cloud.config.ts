/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SATU-SATUNYA tempat nilai bawaan akun cloud (Supabase + ImageKit).
 *
 * Cara ganti akun (urut dari paling mudah):
 *  1. Lewat aplikasi (tanpa build ulang): menu Koneksi Supabase > tab Kredensial / ImageKit.
 *     Tersimpan di browser perangkat tersebut.
 *  2. Lewat file .env (berlaku untuk SEMUA perangkat setelah build/deploy ulang):
 *     isi VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_IMAGEKIT_* (lihat .env.example).
 *  3. Mengubah nilai cadangan di bawah ini (dipakai bila .env kosong).
 *
 * Hanya kunci PUBLIK yang boleh ada di sini. Private key ImageKit TIDAK PERNAH dimasukkan ke aplikasi.
 */

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};
const pick = (v: string | undefined, fallback: string): string => (v && v.trim() ? v.trim() : fallback);

export const CLOUD_DEFAULTS = {
  supabase: {
    projectName: pick(env.VITE_SUPABASE_PROJECT_NAME, 'Meja Operator'),
    projectUrl: pick(env.VITE_SUPABASE_URL, 'https://qpjgokdxoevjjcrrazqh.supabase.co'),
    apiKey: pick(env.VITE_SUPABASE_ANON_KEY, 'sb_publishable_LdhXxUBlwAM-QrrVaKTQTw_HNPrHSlc'),
    /** Awalan tabel. Ubah bila satu proyek Supabase dipakai untuk beberapa aplikasi. */
    tablePrefix: env.VITE_SUPABASE_TABLE_PREFIX !== undefined && env.VITE_SUPABASE_TABLE_PREFIX !== ''
      ? env.VITE_SUPABASE_TABLE_PREFIX
      : 'mo_',
  },
  imagekit: {
    publicKey: pick(env.VITE_IMAGEKIT_PUBLIC_KEY, ''),
    urlEndpoint: pick(env.VITE_IMAGEKIT_URL_ENDPOINT, ''),
    authEndpoint: pick(env.VITE_IMAGEKIT_AUTH_ENDPOINT, ''),
    folder: pick(env.VITE_IMAGEKIT_FOLDER, '/meja-operator'),
  },
} as const;
