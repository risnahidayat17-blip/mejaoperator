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

// Penulisan harus persis "import.meta.env.VITE_..." agar Vite menggantinya saat build.
const pick = (v: string | undefined, fallback: string): string => (v && v.trim() ? v.trim() : fallback);
const rawPrefix: string | undefined = import.meta.env.VITE_SUPABASE_TABLE_PREFIX;

export const CLOUD_DEFAULTS = {
  supabase: {
    projectName: pick(import.meta.env.VITE_SUPABASE_PROJECT_NAME, 'Meja Operator'),
    projectUrl: pick(import.meta.env.VITE_SUPABASE_URL, 'https://qzxngoadywzvjofqhwdw.supabase.co'),
    apiKey: pick(import.meta.env.VITE_SUPABASE_ANON_KEY, 'sb_publishable_qOF81vaSuV8nveIzMSG_xA_goU6WTIa'),
    /** Awalan tabel. Ubah bila satu proyek Supabase dipakai untuk beberapa aplikasi. */
    tablePrefix: rawPrefix !== undefined && rawPrefix !== '' ? rawPrefix : 'mo_',
  },
  imagekit: {
    publicKey: pick(import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY, ''),
    urlEndpoint: pick(import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT, 'https://ik.imagekit.io/xvfbvpj3a'),
    authEndpoint: pick(import.meta.env.VITE_IMAGEKIT_AUTH_ENDPOINT, ''),
    folder: pick(import.meta.env.VITE_IMAGEKIT_FOLDER, '/meja-operator'),
  },
} as const;
