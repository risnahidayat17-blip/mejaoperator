/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pustaka scan dokumen tanpa dependensi (hanya Canvas): deteksi tepi kertas, potong perspektif
 * (seperti CamScanner), dan filter hasil scan. Semua berjalan di perangkat, tidak ada data yang dikirim.
 */

export interface Pt {
  x: number;
  y: number;
}
/** Urutan: kiri-atas, kanan-atas, kanan-bawah, kiri-bawah. */
export type Quad = [Pt, Pt, Pt, Pt];
export type FilterMode = 'asli' | 'terang' | 'abu' | 'bw';

export interface DetectResult {
  quad: Quad;
  /** true bila tepi kertas benar-benar ditemukan (bukan bingkai cadangan). */
  found: boolean;
  /** 0..1 */
  confidence: number;
}

type Drawable = HTMLVideoElement | HTMLCanvasElement | ImageBitmap | HTMLImageElement;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export function polygonArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Urutkan 4 titik menjadi KA, KaA, KaB, KB (searah jarum jam, mulai dari kiri-atas). */
export function orderQuad(pts: Pt[]): Quad {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sorted = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // sorted searah jarum jam di layar (sumbu y ke bawah). Mulai dari titik dengan x+y terkecil.
  let start = 0;
  let best = Infinity;
  sorted.forEach((p, i) => {
    const v = p.x + p.y;
    if (v < best) {
      best = v;
      start = i;
    }
  });
  return [0, 1, 2, 3].map((k) => sorted[(start + k) % 4]) as Quad;
}

export function defaultQuad(w: number, h: number, inset = 0.04): Quad {
  const mx = w * inset;
  const my = h * inset;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}

export function quadsSimilar(a: Quad, b: Quad, tolPx: number): boolean {
  return a.every((p, i) => dist(p, b[i]) <= tolPx);
}

// ---------------------------------------------------------------------------
// Deteksi tepi kertas
// ---------------------------------------------------------------------------

function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = -1;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      thr = t;
    }
  }
  return thr;
}

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function lineIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(d) < 1e-9) return null;
  const pa = a1.x * a2.y - a1.y * a2.x;
  const pb = b1.x * b2.y - b1.y * b2.x;
  return {
    x: (pa * (b1.x - b2.x) - (a1.x - a2.x) * pb) / d,
    y: (pa * (b1.y - b2.y) - (a1.y - a2.y) * pb) / d,
  };
}

/** Sederhanakan poligon cembung menjadi 4 sudut: hapus sisi terpendek dengan memperpanjang sisi tetangganya. */
function reduceToQuad(hull: Pt[]): Pt[] | null {
  let poly = hull.slice();
  while (poly.length > 4) {
    const n = poly.length;
    const cx = poly.reduce((s, p) => s + p.x, 0) / n;
    const cy = poly.reduce((s, p) => s + p.y, 0) / n;
    const center = { x: cx, y: cy };
    let bestI = -1;
    let bestAdd = Infinity;
    let bestPt: Pt | null = null;
    for (let i = 0; i < n; i++) {
      const a = poly[(i - 1 + n) % n];
      const b = poly[i];
      const c = poly[(i + 1) % n];
      const d = poly[(i + 2) % n];
      const x = lineIntersect(a, b, c, d);
      if (!x) continue;
      // titik baru harus di luar sisi b-c (berlawanan dengan pusat)
      if (cross(b, c, x) * cross(b, c, center) >= 0) continue;
      const add = polygonArea([b, x, c]);
      if (add < bestAdd) {
        bestAdd = add;
        bestI = i;
        bestPt = x;
      }
    }
    if (bestI < 0 || !bestPt) return null;
    const next: Pt[] = [];
    const j = (bestI + 1) % n;
    for (let k = 0; k < n; k++) {
      if (k === j) continue;
      next.push(k === bestI ? bestPt : poly[k]);
    }
    poly = next;
  }
  return poly.length === 4 ? poly : null;
}

function isConvexQuad(q: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
    if (Math.abs(c) < 1e-6) return false;
    const s = c > 0 ? 1 : -1;
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

let _scratch: HTMLCanvasElement | null = null;

interface Grabbed {
  w: number;
  h: number;
  scale: number;
  rgba: Uint8ClampedArray;
}

/** Salin sumber ke canvas kecil (sisi terpanjang = `long`) dan ambil pikselnya. */
function grab(src: Drawable, srcW: number, srcH: number, long: number): Grabbed | null {
  const scale = Math.min(1, long / Math.max(srcW, srcH));
  const w = Math.max(16, Math.round(srcW * scale));
  const h = Math.max(16, Math.round(srcH * scale));
  const cv = _scratch || (_scratch = document.createElement('canvas'));
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
  return { w, h, scale: w / srcW, rgba: ctx.getImageData(0, 0, w, h).data };
}

function grayOf(rgba: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) g[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  return g;
}

function otsuOf(values: Float32Array, lo: number, hi: number): number {
  const hist = new Uint32Array(256);
  const k = 255 / Math.max(1e-6, hi - lo);
  for (let i = 0; i < values.length; i++) hist[Math.max(0, Math.min(255, Math.round((values[i] - lo) * k)))]++;
  return lo + otsu(hist, values.length) / k;
}

/** Komponen terhubung terbesar dari mask -> titik terluar tiap baris + luasnya. */
function largestBlob(mask: Uint8Array, w: number, h: number): { edge: Pt[]; area: number } | null {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestLabel = 0;
  let bestArea = 0;
  let cur = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i]) continue;
    cur++;
    let sp = 0;
    stack[sp++] = i;
    label[i] = cur;
    let area = 0;
    while (sp) {
      const idx = stack[--sp];
      area++;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0 && mask[idx - 1] && !label[idx - 1]) {
        label[idx - 1] = cur;
        stack[sp++] = idx - 1;
      }
      if (x < w - 1 && mask[idx + 1] && !label[idx + 1]) {
        label[idx + 1] = cur;
        stack[sp++] = idx + 1;
      }
      if (y > 0 && mask[idx - w] && !label[idx - w]) {
        label[idx - w] = cur;
        stack[sp++] = idx - w;
      }
      if (y < h - 1 && mask[idx + w] && !label[idx + w]) {
        label[idx + w] = cur;
        stack[sp++] = idx + w;
      }
    }
    if (area > bestArea) {
      bestArea = area;
      bestLabel = cur;
    }
  }
  if (!bestLabel) return null;
  const edge: Pt[] = [];
  for (let y = 0; y < h; y++) {
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] === bestLabel) {
        if (minX < 0) minX = x;
        maxX = x;
      }
    }
    if (minX >= 0) {
      edge.push({ x: minX, y });
      edge.push({ x: maxX + 1, y });
    }
  }
  return { edge, area: bestArea };
}

/** Besar gradien (Sobel) dari gambar abu-abu. */
function sobel(g: Float32Array, w: number, h: number): Float32Array {
  const m = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      const gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
      m[i] = Math.hypot(gx, gy) / 4;
    }
  }
  return m;
}

/** Seberapa banyak keliling quad benar-benar berada di tepi (gradien kuat). 0..1 */
function edgeSupport(q: Pt[], mag: Float32Array, w: number, h: number, thr: number): number {
  let hit = 0;
  let total = 0;
  const cx = q.reduce((s, p) => s + p.x, 0) / 4;
  const cy = q.reduce((s, p) => s + p.y, 0) / 4;
  for (let e = 0; e < 4; e++) {
    const a = q[e];
    const b = q[(e + 1) % 4];
    const len = dist(a, b);
    if (len < 4) continue;
    let nx = -(b.y - a.y) / len;
    let ny = (b.x - a.x) / len;
    if ((a.x - cx) * nx + (a.y - cy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const n = Math.ceil(len);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      // sisi yang menempel pada batas bingkai tidak punya tepi: jangan dihitung
      if (px < 2 || py < 2 || px > w - 3 || py > h - 3) continue;
      total++;
      let best = 0;
      for (let o = -2; o <= 2; o++) {
        const x = Math.round(px + nx * o);
        const y = Math.round(py + ny * o);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const v = mag[y * w + x];
        if (v > best) best = v;
      }
      if (best >= thr) hit++;
    }
  }
  return total ? hit / total : 0;
}

function quadFromBlob(edge: Pt[]): Pt[] | null {
  const hull = convexHull(edge);
  if (hull.length < 4) return null;
  const q = hull.length === 4 ? hull : reduceToQuad(hull);
  if (!q || !isConvexQuad(q)) return null;
  return orderQuad(q);
}

function quadValid(q: Quad, frameArea: number): boolean {
  if (polygonArea(q) < frameArea * 0.1) return false;
  for (let i = 0; i < 4; i++) {
    const ang = angleDeg(q[(i + 3) % 4], q[i], q[(i + 1) % 4]);
    if (ang < 50 || ang > 130) return false;
  }
  return true;
}

export interface DetectOptions {
  /** Sisi terpanjang gambar untuk penajaman sudut (makin besar makin presisi, makin lambat). Bawaan 960. */
  refineSide?: number;
}

/**
 * Cari 4 sudut kertas pada gambar/video. Koordinat hasil memakai ukuran asli sumber.
 *  1. Beberapa kandidat kertas dibuat dengan cara berbeda (kecerahan, kecerahan-dikurangi-warna, selisih
 *     warna dari latar) pada gambar kecil.
 *  2. Kandidat dinilai dari seberapa banyak kelilingnya berada di tepi nyata; yang terbaik dipilih.
 *  3. Sudut dipertajam: tiap sisi dicari tepinya pada resolusi lebih tinggi, digaris-lurus-kan (regresi dengan
 *     buang pencilan), lalu sudut = perpotongan garis. Hasilnya presisi sub-piksel.
 */
export function detectDocument(src: Drawable, srcW: number, srcH: number, opts: DetectOptions = {}): DetectResult {
  const fallback: DetectResult = { quad: defaultQuad(srcW, srcH), found: false, confidence: 0 };
  if (!srcW || !srcH) return fallback;
  const gr = grab(src, srcW, srcH, 320);
  if (!gr) return fallback;
  const { w, h, rgba } = gr;
  const N = w * h;
  const g0 = grayOf(rgba, N);
  const g = localMean(g0, w, h, 1);
  const chroma = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    chroma[i] = Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) - Math.min(rgba[p], rgba[p + 1], rgba[p + 2]);
  }
  const mag = sobel(g, w, h);
  let magSum = 0;
  for (let i = 0; i < N; i++) magSum += mag[i];
  const edgeThr = Math.max(7, (magSum / N) * 1.8);

  // warna latar = rata-rata pita tepi bingkai
  const bw = Math.max(2, Math.round(Math.min(w, h) * 0.05));
  let br = 0;
  let bg = 0;
  let bb = 0;
  let bc = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= bw && x < w - bw && y >= bw && y < h - bw) continue;
      const p = (y * w + x) * 4;
      br += rgba[p];
      bg += rgba[p + 1];
      bb += rgba[p + 2];
      bc++;
    }
  }
  br /= bc;
  bg /= bc;
  bb /= bc;

  const paper = new Float32Array(N);
  const away = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    paper[i] = g[i] - 0.6 * chroma[i];
    away[i] = Math.hypot(rgba[p] - br, rgba[p + 1] - bg, rgba[p + 2] - bb);
  }

  const frameArea = N;
  const tries: { v: Float32Array; lo: number; hi: number; bias: number[] }[] = [
    { v: g, lo: 0, hi: 255, bias: [0, 12, -12] },
    { v: paper, lo: -100, hi: 255, bias: [0, 12, -12] },
    { v: away, lo: 0, hi: 442, bias: [0, 10, -10] },
  ];

  const cands: { quad: Quad; score: number; support: number; area: number }[] = [];
  for (const t of tries) {
    const base = otsuOf(t.v, t.lo, t.hi);
    for (const bias of t.bias) {
      const thr = base + bias;
      const mask = new Uint8Array(N);
      for (let i = 0; i < N; i++) mask[i] = t.v[i] > thr ? 1 : 0;
      const blob = largestBlob(mask, w, h);
      if (!blob || blob.area < frameArea * 0.1 || blob.area > frameArea * 0.985) continue;
      const q = quadFromBlob(blob.edge);
      if (!q) continue;
      const quad = q as Quad;
      if (!quadValid(quad, frameArea)) continue;
      const qa = polygonArea(quad);
      const fill = Math.min(1, blob.area / qa);
      if (fill < 0.6) continue;
      const support = edgeSupport(quad, mag, w, h, edgeThr);
      const areaScore = Math.min(1, qa / (frameArea * 0.45));
      const score = support * 0.65 + fill * 0.15 + areaScore * 0.2;
      if (qa > frameArea * 0.985) continue;
      cands.push({ quad, score, support, area: qa });
    }
  }
  if (!cands.length) return fallback;
  // Pilih kandidat TERLUAR yang tepinya masih sama kuatnya (mencegah blok teks / lipatan dalam dianggap kertas).
  const topSupport = Math.max(...cands.map((c) => c.support));
  const pool = cands.filter((c) => c.support >= Math.max(0.55, topSupport - 0.1));
  if (!pool.length) return fallback;
  const best = pool.reduce((a, c) => (c.area > a.area ? c : a));
  if (best.score < 0.5) return fallback;

  const inv = 1 / gr.scale;
  let quad = best.quad.map((p) => ({ x: p.x * inv, y: p.y * inv })) as Quad;
  const refined = refineQuad(src, srcW, srcH, quad, opts.refineSide ?? 960);
  if (refined) quad = refined;
  quad = quad.map((p) => ({ x: clampN(p.x, 0, srcW), y: clampN(p.y, 0, srcH) })) as Quad;
  return { quad, found: true, confidence: Math.min(1, best.score) };
}

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function bilinear(g: Float32Array, w: number, h: number, x: number, y: number): number {
  const xx = clampN(x, 0, w - 1.001);
  const yy = clampN(y, 0, h - 1.001);
  const x0 = xx | 0;
  const y0 = yy | 0;
  const fx = xx - x0;
  const fy = yy - y0;
  const i = y0 * w + x0;
  return g[i] * (1 - fx) * (1 - fy) + g[i + 1] * fx * (1 - fy) + g[i + w] * (1 - fx) * fy + g[i + w + 1] * fx * fy;
}

interface Line {
  /** titik pada garis */
  px: number;
  py: number;
  /** arah (satuan) */
  dx: number;
  dy: number;
  /** jumlah titik tepi yang mendukung garis */
  support: number;
}

/** Regresi garis (kuadrat terkecil total) dengan pembuangan pencilan berulang. */
function fitLine(pts: Pt[], wts: number[]): Line | null {
  let use = pts.map((_, i) => i);
  let line: Line | null = null;
  for (let round = 0; round < 4; round++) {
    if (use.length < 5) return null;
    let sw = 0;
    let mx = 0;
    let my = 0;
    for (const i of use) {
      sw += wts[i];
      mx += pts[i].x * wts[i];
      my += pts[i].y * wts[i];
    }
    mx /= sw;
    my /= sw;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const i of use) {
      const dx = pts[i].x - mx;
      const dy = pts[i].y - my;
      sxx += wts[i] * dx * dx;
      syy += wts[i] * dy * dy;
      sxy += wts[i] * dx * dy;
    }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    line = { px: mx, py: my, dx: Math.cos(ang), dy: Math.sin(ang), support: use.length };
    const res = pts.map((p) => Math.abs((p.x - mx) * -line!.dy + (p.y - my) * line!.dx));
    const sorted = use.map((i) => res[i]).sort((a, b) => a - b);
    const med = sorted[(sorted.length / 2) | 0];
    const lim = Math.max(0.8, med * 2.5);
    const next = pts.map((_, i) => i).filter((i) => res[i] <= lim);
    if (next.length === use.length) break;
    use = next;
  }
  return line;
}

/**
 * Pertajam posisi 4 sudut: cari tepi kertas di sepanjang tiap sisi pada resolusi `side`, luruskan dengan regresi,
 * lalu hitung sudut sebagai perpotongan garis. Mengembalikan null bila tepi tidak cukup jelas.
 */
export function refineQuad(src: Drawable, srcW: number, srcH: number, quad: Quad, side = 960): Quad | null {
  const gr = grab(src, srcW, srcH, side);
  if (!gr) return null;
  const { w, h, scale } = gr;
  const g = localMean(grayOf(gr.rgba, w * h), w, h, 1);
  let q: Quad = quad.map((p) => ({ x: p.x * scale, y: p.y * scale })) as Quad;
  const diag = Math.hypot(w, h);
  const inset = 0.8; // geser sedikit ke dalam agar tepi/bayangan meja tidak ikut

  for (const bandFrac of [0.022, 0.008]) {
    const cx = q.reduce((s, p) => s + p.x, 0) / 4;
    const cy = q.reduce((s, p) => s + p.y, 0) / 4;
    const lines: (Line | null)[] = [];
    const outward: Pt[] = [];
    for (let e = 0; e < 4; e++) {
      const a = q[e];
      const b = q[(e + 1) % 4];
      const len = dist(a, b);
      let nx = -(b.y - a.y) / (len || 1);
      let ny = (b.x - a.x) / (len || 1);
      if ((a.x - cx) * nx + (a.y - cy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      outward.push({ x: nx, y: ny });
      const band = clampN(Math.min(len, diag) * bandFrac, 2.5, 14);
      const nPts = clampN(Math.round(len / 5), 12, 80);
      const pts: Pt[] = [];
      const wts: number[] = [];
      const strengths: number[] = [];
      for (let k = 0; k < nPts; k++) {
        const t = 0.08 + (0.84 * (k + 0.5)) / nPts;
        const bx = a.x + (b.x - a.x) * t;
        const by = a.y + (b.y - a.y) * t;
        const steps = Math.round(band * 4);
        const prof: number[] = [];
        for (let s = -steps; s <= steps; s++) {
          const o = s / 2;
          prof.push(bilinear(g, w, h, bx + nx * o, by + ny * o));
        }
        const vals: number[] = new Array(prof.length).fill(0);
        let bestS = -1;
        let bestV = 0;
        for (let s = 2; s < prof.length - 2; s++) {
          const d = (prof[s + 2] - prof[s - 2]) / 2; // keluar dari kertas terang->gelap = negatif
          const pos = (s - steps) / 2;
          const v = (d < 0 ? -d : d * 0.65) * (1 - (0.25 * Math.abs(pos)) / band);
          vals[s] = v;
          if (v > bestV) {
            bestV = v;
            bestS = s;
          }
        }
        if (bestS < 3) continue;
        // utamakan puncak tepi TERDEKAT dengan posisi awal (bukan yang terkuat) agar garis teks di dalam kertas tidak terpilih
        let near = bestS;
        for (let s = 3; s < prof.length - 3; s++) {
          if (vals[s] >= vals[s - 1] && vals[s] >= vals[s + 1] && vals[s] >= bestV * 0.5 && Math.abs(s - steps) < Math.abs(near - steps)) near = s;
        }
        bestS = near;
        bestV = vals[near];
        if (bestS > prof.length - 4) continue;
        // interpolasi parabola pada puncak gradien -> posisi sub-piksel
        let off = (bestS - steps) / 2;
        const vm = vals[bestS - 1];
        const vp = vals[bestS + 1];
        const den = vm - 2 * bestV + vp;
        if (den < -1e-6) off += clampN((0.5 * (vm - vp)) / den, -1, 1) * 0.5;
        pts.push({ x: bx + nx * off, y: by + ny * off });
        wts.push(1);
        strengths.push(bestV);
      }
      if (pts.length < 8) {
        lines.push(null);
        continue;
      }
      const med = [...strengths].sort((x, y) => x - y)[(strengths.length / 2) | 0];
      const keepIdx = strengths.map((v, i) => (v >= Math.max(2.5, med * 0.4) ? i : -1)).filter((i) => i >= 0);
      const ln = fitLine(
        keepIdx.map((i) => pts[i]),
        keepIdx.map((i) => wts[i])
      );
      lines.push(ln && ln.support >= Math.max(6, nPts * 0.3) ? ln : null);
    }
    if (lines.every((l) => !l)) return null;

    const next: Pt[] = [];
    for (let i = 0; i < 4; i++) {
      const l1 = lines[(i + 3) % 4];
      const l2 = lines[i];
      let c: Pt | null = null;
      if (l1 && l2) {
        const o1 = outward[(i + 3) % 4];
        const o2 = outward[i];
        const a1 = { x: l1.px - o1.x * inset, y: l1.py - o1.y * inset };
        const a2 = { x: l2.px - o2.x * inset, y: l2.py - o2.y * inset };
        c = lineIntersect(a1, { x: a1.x + l1.dx, y: a1.y + l1.dy }, a2, { x: a2.x + l2.dx, y: a2.y + l2.dy });
        if (c && Math.abs(Math.sin(Math.atan2(l1.dy, l1.dx) - Math.atan2(l2.dy, l2.dx))) < 0.35) c = null;
      }
      if (!c || dist(c, q[i]) > diag * 0.06) c = q[i];
      next.push(c);
    }
    if (!isConvexQuad(next)) break;
    q = next as Quad;
  }
  return q.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad;
}

// ---------------------------------------------------------------------------
// Potong perspektif
// ---------------------------------------------------------------------------

function solveHomography(dst: Pt[], src: Pt[]): number[] {
  // petakan titik tujuan (dst) ke titik sumber (src): [x y 1 0 0 0 -x*u -y*u | u] ...
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (!f) continue;
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row) => row[8]);
}

export function outputSizeForQuad(q: Quad, maxSide = 1754): { w: number; h: number } {
  let w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  w = Math.max(w, 32);
  h = Math.max(h, 32);
  const A4 = 1.41421;
  const r = h / w;
  if (Math.abs(r - A4) / A4 < 0.08) h = w * A4; // kertas A4 tegak
  else if (Math.abs(1 / r - A4) / A4 < 0.08) w = h * A4; // A4 mendatar
  const long = Math.max(w, h);
  const k = long > maxSide ? maxSide / long : 1;
  return { w: Math.max(32, Math.round(w * k)), h: Math.max(32, Math.round(h * k)) };
}

/** Luruskan area di dalam `quad` menjadi gambar persegi panjang (koreksi perspektif, interpolasi bilinear). */
export function warpToCanvas(src: HTMLCanvasElement, quad: Quad, maxSide = 1754): HTMLCanvasElement {
  const { w: W, h: H } = outputSizeForQuad(quad, maxSide);
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  const sw = src.width;
  const sh = src.height;
  const sd = sctx.getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(W, H);
  const o = od.data;
  const hm = solveHomography(
    [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H },
    ],
    quad
  );
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dn = hm[6] * px + hm[7] * py + 1;
      let u = (hm[0] * px + hm[1] * py + hm[2]) / dn - 0.5;
      let v = (hm[3] * px + hm[4] * py + hm[5]) / dn - 0.5;
      if (u < 0) u = 0;
      else if (u > sw - 1.001) u = sw - 1.001;
      if (v < 0) v = 0;
      else if (v > sh - 1.001) v = sh - 1.001;
      const x0 = u | 0;
      const y0 = v | 0;
      const fx = u - x0;
      const fy = v - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const oi = (y * W + x) * 4;
      o[oi] = sd[i00] * w00 + sd[i10] * w10 + sd[i01] * w01 + sd[i11] * w11;
      o[oi + 1] = sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11;
      o[oi + 2] = sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11;
      o[oi + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Filter (seperti "Magic Color", "Abu-abu", "Hitam Putih" di CamScanner)
// ---------------------------------------------------------------------------

/** Rata-rata abu-abu pada jendela persegi (radius r) memakai integral image. */
function localMean(gray: Float32Array, w: number, h: number, r: number): Float32Array {
  const iw = w + 1;
  const integ = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integ[(y + 1) * iw + (x + 1)] = integ[y * iw + (x + 1)] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s = integ[y1 * iw + x1] - integ[y0 * iw + x1] - integ[y1 * iw + x0] + integ[y0 * iw + x0];
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

export function applyFilter(src: HTMLCanvasElement, mode: FilterMode): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  if (mode === 'asli') {
    octx.drawImage(src, 0, 0);
    return out;
  }
  const img = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
  const d = img.data;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];

  if (mode === 'bw') {
    const m = localMean(gray, w, h, Math.max(10, Math.round(Math.max(w, h) / 40)));
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      const v = gray[i] < m[i] * 0.9 - 4 ? 0 : 255;
      d[p] = d[p + 1] = d[p + 2] = v;
      d[p + 3] = 255;
    }
  } else {
    const m = localMean(gray, w, h, Math.max(16, Math.round(Math.max(w, h) / 10)));
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      const k = Math.min(3, 246 / Math.max(m[i], 40));
      const stretch = (v: number) => {
        const t = (v * k - 38) * (255 / (236 - 38));
        return t < 0 ? 0 : t > 255 ? 255 : t;
      };
      if (mode === 'abu') {
        const v = stretch(gray[i]);
        d[p] = d[p + 1] = d[p + 2] = v;
      } else {
        d[p] = stretch(d[p]);
        d[p + 1] = stretch(d[p + 1]);
        d[p + 2] = stretch(d[p + 2]);
      }
      d[p + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

export function rotateCanvas(src: HTMLCanvasElement, deg: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement('canvas');
  const swap = deg !== 180;
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;
  const c = out.getContext('2d')!;
  c.translate(out.width / 2, out.height / 2);
  c.rotate((deg * Math.PI) / 180);
  c.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** Salin sumber apa pun ke canvas dengan sisi terpanjang dibatasi `maxSide`. */
export function toCanvas(src: Drawable, srcW: number, srcH: number, maxSide = 2600): HTMLCanvasElement {
  const k = Math.max(srcW, srcH) > maxSide ? maxSide / Math.max(srcW, srcH) : 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(srcW * k));
  c.height = Math.max(1, Math.round(srcH * k));
  c.getContext('2d', { willReadFrequently: true })!.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height);
  return c;
}

/** Muat berkas gambar (foto galeri) dengan orientasi EXIF yang benar. */
export async function loadImageFile(file: File, maxSide = 2600): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      const c = toCanvas(bmp, bmp.width, bmp.height, maxSide);
      bmp.close?.();
      return c;
    } catch {
      /* lanjut ke cara cadangan */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Gagal membaca gambar.'));
      im.src = url;
    });
    return toCanvas(img, img.naturalWidth, img.naturalHeight, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}
