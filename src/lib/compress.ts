/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Kompresi gambar adaptif: hasil JPEG dijamin (sebisa mungkin) tidak melebihi batas ukuran,
 * tetapi tetap setajam mungkin. Urutan prioritas:
 *   1. pertahankan resolusi setinggi mungkin dengan kualitas JPEG tidak di bawah `minQuality`,
 *   2. di dalam resolusi itu, pakai kualitas tertinggi yang masih muat (pencarian biner),
 *   3. baru bila tidak muat, resolusi diturunkan bertahap (bukan kualitas dibuat pecah).
 */

/** Batas ukuran berkas unggahan (200 KB). */
export const TARGET_BYTES = 200 * 1024;

export interface CompressedImage {
  bytes: Uint8Array;
  /** Ukuran piksel akhir. */
  w: number;
  h: number;
  quality: number;
}

export interface CompressOptions {
  /** Sisi terpanjang awal (piksel). Bawaan 1754 (A4 ±150 dpi). */
  startSide?: number;
  /** Kualitas JPEG terendah yang dipakai sebelum resolusi diturunkan. */
  minQuality?: number;
  maxQuality?: number;
}

const SIDES = [2000, 1754, 1600, 1450, 1300, 1150, 1000, 900, 800, 700, 600, 500, 400];

function encode(c: HTMLCanvasElement, q: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    c.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error('Gambar tidak dapat dikompres.'));
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      q
    );
  });
}

function drawScaled(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Perkecil canvas hingga sisi terpanjang = maxSide (latar putih; turun bertahap agar tetap tajam). */
export function resizeCanvas(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const long = Math.max(src.width, src.height);
  if (long <= maxSide) return src;
  const k = maxSide / long;
  const tw = src.width * k;
  const th = src.height * k;
  let cur = src;
  while (Math.max(cur.width, cur.height) * 0.5 > maxSide) cur = drawScaled(cur, cur.width * 0.5, cur.height * 0.5);
  return drawScaled(cur, tw, th);
}

/**
 * Kompres canvas menjadi JPEG <= `maxBytes`. Selalu mengembalikan hasil terbaik; bila benar-benar
 * tidak muat (gambar sangat rumit), hasil terkecil yang bisa dicapai dikembalikan.
 */
export async function compressCanvas(
  src: HTMLCanvasElement,
  maxBytes: number = TARGET_BYTES,
  opts: CompressOptions = {}
): Promise<CompressedImage> {
  const minQ = opts.minQuality ?? 0.6;
  const maxQ = opts.maxQuality ?? 0.92;
  const startSide = opts.startSide ?? 1754;
  const long = Math.max(src.width, src.height);
  const sides = Array.from(new Set([Math.min(long, startSide), ...SIDES.filter((s) => s < Math.min(long, startSide))]));

  let smallest: CompressedImage | null = null;
  for (const side of sides) {
    const c = resizeCanvas(src, side);
    const base = await encode(c, minQ);
    if (!smallest || base.length < smallest.bytes.length) smallest = { bytes: base, w: c.width, h: c.height, quality: minQ };
    if (base.length > maxBytes) continue;
    let best: CompressedImage = { bytes: base, w: c.width, h: c.height, quality: minQ };
    let lo = minQ;
    let hi = maxQ;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const b = await encode(c, mid);
      if (b.length <= maxBytes) {
        best = { bytes: b, w: c.width, h: c.height, quality: mid };
        lo = mid;
      } else hi = mid;
    }
    return best;
  }

  // Cadangan: kualitas diturunkan sedikit demi sedikit pada resolusi terkecil yang dicoba.
  const c = resizeCanvas(src, sides[sides.length - 1]);
  for (const q of [0.5, 0.42, 0.35]) {
    const b = await encode(c, q);
    if (b.length <= maxBytes) return { bytes: b, w: c.width, h: c.height, quality: q };
    if (!smallest || b.length < smallest.bytes.length) smallest = { bytes: b, w: c.width, h: c.height, quality: q };
  }
  return smallest!;
}

export function loadImageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Gambar tidak dapat diproses.'));
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
}

/** Byte JPEG -> data URL. */
export function jpegToDataUrl(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Gagal membaca gambar.'));
    r.readAsDataURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
  });
}

/** Berkas gambar apa pun -> data URL JPEG <= maxBytes. */
export async function compressImageFileToDataUrl(file: Blob, maxBytes: number = TARGET_BYTES): Promise<string> {
  const c = await loadImageToCanvas(file);
  const out = await compressCanvas(c, maxBytes);
  return jpegToDataUrl(out.bytes);
}
