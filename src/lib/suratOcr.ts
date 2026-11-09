/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Baca isi surat (OCR bahasa Indonesia) lalu ambil nomor surat, tanggal, perihal, pengirim, dan sifat.
 *
 * OCR memakai Tesseract.js yang dimuat dari CDN saat pertama kali dipakai (perlu internet; data bahasa
 * "ind" ±2 MB lalu disimpan di cache browser). Teks dibaca di perangkat, gambar tidak dikirim ke server.
 */

import type { OcrLine } from './pdfBuilder';

const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

export interface OcrResult {
  text: string;
  lines: OcrLine[];
}

export type OcrProgress = (info: { status: string; progress: number }) => void;

let scriptPromise: Promise<any> | null = null;
let workerPromise: Promise<any> | null = null;
let progressCb: OcrProgress | null = null;

function loadScript(): Promise<any> {
  const w = window as any;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_SRC;
    s.async = true;
    s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('Tesseract tidak termuat.')));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Pustaka baca teks (OCR) tidak dapat diunduh. Periksa koneksi internet lalu coba lagi.'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function getWorker(): Promise<any> {
  if (workerPromise) return workerPromise;
  workerPromise = loadScript()
    .then((T) =>
      T.createWorker('ind', 1, {
        logger: (m: { status: string; progress: number }) => progressCb?.({ status: m.status, progress: m.progress ?? 0 }),
      })
    )
    .catch((e) => {
      workerPromise = null;
      throw e;
    });
  return workerPromise;
}

export async function ocrCanvas(canvas: HTMLCanvasElement, onProgress?: OcrProgress): Promise<OcrResult> {
  progressCb = onProgress || null;
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  let rawLines: any[] = data.lines || [];
  if (!rawLines.length && Array.isArray(data.blocks)) {
    for (const b of data.blocks) for (const p of b.paragraphs || []) for (const l of p.lines || []) rawLines.push(l);
  }
  const lines: OcrLine[] = rawLines
    .map((l: any) => ({
      text: String(l.text || '').replace(/\s+/g, ' ').trim(),
      x0: l.bbox?.x0 ?? 0,
      y0: l.bbox?.y0 ?? 0,
      x1: l.bbox?.x1 ?? 0,
      y1: l.bbox?.y1 ?? 0,
    }))
    .filter((l: OcrLine) => l.text && l.x1 > l.x0 && l.y1 > l.y0);
  const text: string = data.text || lines.map((l) => l.text).join('\n');
  return { text, lines };
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch {
    /* abaikan */
  }
  workerPromise = null;
}

// ---------------------------------------------------------------------------
// Parser isi surat
// ---------------------------------------------------------------------------

export interface SuratFields {
  noSurat?: string;
  /** yyyy-mm-dd */
  tglSurat?: string;
  perihal?: string;
  asal?: string;
  sifat?: 'Biasa' | 'Penting' | 'Segera' | 'Rahasia';
}

const BULAN = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
const HARI = /\b(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad)\b/i;

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

function monthIndex(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return -1;
  const exact = BULAN.indexOf(w);
  if (exact >= 0) return exact;
  if (w === 'pebruari') return 1;
  const ABBR: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agu: 7, agt: 7, ags: 7, agust: 7, sep: 8, sept: 8, okt: 9, oct: 9, nov: 10, nop: 10, des: 11, dec: 11 };
  if (w in ABBR) return ABBR[w];
  if (w.length < 4) return -1;
  let best = -1;
  let bestD = 2;
  let tie = false;
  BULAN.forEach((m, i) => {
    const d = lev(w, m);
    if (d < bestD) {
      bestD = d;
      best = i;
      tie = false;
    } else if (d === bestD && d < 2) {
      tie = true;
    }
  });
  return bestD <= 1 && !tie ? best : -1;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function findDates(line: string): { iso: string; index: number }[] {
  const out: { iso: string; index: number }[] = [];
  const re = /(\d{1,2})\s*([A-Za-z]{3,10})\.?\s*,?\s*((?:19|20)\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const mi = monthIndex(m[2]);
    const day = parseInt(m[1], 10);
    if (mi >= 0 && day >= 1 && day <= 31) out.push({ iso: `${m[3]}-${pad2(mi + 1)}-${pad2(day)}`, index: m.index });
  }
  return out;
}

const ACRONYMS = new Set([
  'SD', 'SMP', 'SMA', 'SMK', 'MI', 'MTS', 'MA', 'TK', 'PAUD', 'UPTD', 'UPT', 'PGRI', 'KKG', 'K3S', 'KKKS', 'DKI', 'RI', 'RT', 'RW',
  'BOS', 'PKBM', 'LKP', 'DPRD', 'TNI', 'POLRI', 'BNN', 'BPJS', 'UNESCO', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII',
]);
const SMALL = new Set(['dan', 'di', 'dari', 'untuk', 'atau', 'yang', 'ke', 'pada', 'dengan']);

function titleCase(s: string): string {
  const words = s.trim().split(/\s+/);
  return words
    .map((w, i) => {
      if (w.includes('-') && !/\d/.test(w)) return w.split('-').map((p) => titleCase(p)).join('-');
      const up = w.toUpperCase();
      if (/\d/.test(w)) return w;
      if (ACRONYMS.has(up.replace(/[^A-Z0-9]/g, ''))) return up;
      const lower = w.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function isDateLine(l: string): boolean {
  if (findDates(l).length) return true;
  if (/^[A-Za-z .]{3,30},\s*\d/.test(l)) return true;
  const m = /^(?:\d{1,2}\s+)?([A-Za-z]{3,10})\s+(?:19|20)\d{2}$/.exec(l);
  return !!m && monthIndex(m[1]) >= 0;
}

const BODY_START = /^\W*(nomor|nomer|nornor|no\b|sifat|lampiran|hal\b|perihal|periha[il1]|yth|yang terhormat|kepada)/i;
const ADDRESS = /(\bjl\b|jalan|\btelp?\b|\btlp\b|\bfax\b|e-?mail|@|www\.|http|kode pos|\bkec\b\.?\s|\bdesa\b|\bblok\b|\bkp\.|\btelepon\b|\bwebsite\b)/i;
const ORG_WORD = /(pemerintah|dinas|kementerian|sekolah|\bsd\b|\bsmp\b|\bsma\b|\bsmk\b|universitas|badan|kantor|yayasan|puskesmas|korwil|\bkkg\b|\bk3s\b|pgri|komite|pengawas|kecamatan|cabang dinas|\bupt\b|\buptd\b|madrasah|polres|kodim|bank|panitia|kwartir|lembaga|pusat|balai|forum)/i;

function cleanLine(s: string): string {
  return s.replace(/^[^A-Za-z0-9(]+/, '').replace(/[^A-Za-z0-9).]+$/, '').replace(/\s+/g, ' ').trim();
}

function upperRatio(s: string): number {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters.length) return 0;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
}

function parseAsal(lines: string[]): string | undefined {
  const head: string[] = [];
  for (const l of lines.slice(0, 14)) {
    if (BODY_START.test(l)) break;
    head.push(l);
  }
  let kop = head.map(cleanLine).filter((l) => {
    const letters = l.replace(/[^A-Za-z]/g, '').length;
    return letters >= 6 && !ADDRESS.test(l) && !/\d{3,}/.test(l) && (upperRatio(l) >= 0.75 || ORG_WORD.test(l));
  });
  kop = kop.filter((l) => ORG_WORD.test(l) || upperRatio(l) >= 0.9).slice(0, 4);
  if (!kop.length) return undefined;

  const govIdx = kop.findIndex((l) => /^(pemerintah|pemda|republik|kementerian)/i.test(l));
  const gov = govIdx === 0 ? kop[0] : undefined;
  const rest = gov ? kop.slice(1) : kop;
  if (!rest.length) return titleCase(kop[0]);
  let asal = rest.slice(0, 2).join(' ');
  if (rest.length >= 2 && asal.length > 55) asal = rest[rest.length >= 2 ? 1 : 0];
  // lengkapi dengan nama daerah dari baris "PEMERINTAH KABUPATEN X" bila belum ada
  if (gov && !/(kabupaten|kab\.|kota|provinsi|prov\.)/i.test(asal)) {
    const mm = /(kabupaten|kota|provinsi)\s+(.+)$/i.exec(gov);
    if (mm) asal += ` ${mm[1]} ${mm[2]}`;
  }
  return titleCase(asal);
}

export function parseSurat(raw: string): SuratFields {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const res: SuratFields = {};

  // ---- Nomor surat
  const noRe = /^\W{0,3}(?:n[o0]m[o0e]r|nornor|no)\.?\s*[:;]\s*(.+)$/i;
  const noRe2 = /^\W{0,3}(?:nomor|nomer)\s+(\d.*)$/i;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const m = noRe.exec(lines[i]) || noRe2.exec(lines[i]);
    if (!m) continue;
    let v = m[1];
    const dates = findDates(v);
    if (dates.length) v = v.slice(0, dates[0].index).replace(/\s+[A-Za-z]+,?\s*$/, '');
    v = v.replace(/\s+(sifat|lampiran|hal|perihal)\b.*$/i, '');
    v = v.replace(/\s*\/\s*/g, '/').replace(/\s*\.\s*(?=\d)/g, '.').replace(/[\s,;:]+$/, '').trim();
    if (v && /[0-9]/.test(v)) {
      res.noSurat = v;
      break;
    }
  }
  if (!res.noSurat) {
    const m = /\b\d{1,4}(?:\.\d+)*\s*\/\s*[\w.\-]+(?:\s*\/\s*[\w.\-]+)+/.exec(raw);
    if (m) res.noSurat = m[0].replace(/\s*\/\s*/g, '/').trim();
  }

  // ---- Perihal
  const halRe = /^\W{0,3}(?:hal|perihal|periha[il1]|perlhal)\s*[:;]\s*(.*)$/i;
  const STOP = /^\W*(yth|yang terhormat|kepada|di\b|dengan hormat|lampiran|nomor|nomer|sifat|assalam|bersama ini|menindaklanjuti|sehubungan)/i;
  for (let i = 0; i < Math.min(lines.length, 45); i++) {
    const m = halRe.exec(lines[i]);
    if (!m) continue;
    const parts: string[] = [];
    let first = m[1].trim();
    let j = i + 1;
    if (!first && lines[j]) first = lines[j++];
    if (first) parts.push(first);
    while (parts.length < 3 && lines[j] && !STOP.test(lines[j]) && !halRe.test(lines[j]) && lines[j].length < 100 && !/[:]\s*\S/.test(lines[j]) && !/[.:;]$/.test(parts[parts.length - 1]) && !isDateLine(lines[j])) {
      parts.push(lines[j]);
      j++;
    }
    const v = parts.join(' ').replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
    if (v.length >= 3) {
      res.perihal = v;
      break;
    }
  }
  if (!res.perihal) {
    const t = lines.slice(0, 30).find((l) => /^(undangan|surat edaran|surat tugas|pengumuman|surat pemberitahuan|surat keterangan|surat permohonan)\b/i.test(l.replace(/^[^A-Za-z]+/, '')));
    if (t) res.perihal = titleCase(cleanLine(t));
  }

  // ---- Tanggal surat
  let bestScore = -1;
  lines.forEach((l, i) => {
    if (HARI.test(l) || /(hari\s*\/?\s*tanggal|\btgl\b|tanggal\s*:|pukul|waktu|\bjam\b)/i.test(l)) return;
    const ds = findDates(l);
    if (!ds.length) return;
    let score = 0;
    if (/^[A-Za-z .]{3,30},\s*\d/.test(l)) score += 3;
    if (/(nomor|nomer|no\.)/i.test(l)) score += 1;
    if (i < 12) score += 2;
    else if (i >= lines.length - 14) score += 1;
    if (score > bestScore) {
      bestScore = score;
      res.tglSurat = ds[0].iso;
    }
  });

  // ---- Sifat
  const sf = /sifat\s*[:;]\s*([A-Za-z ]{3,20})/i.exec(raw);
  const sfText = (sf ? sf[1] : lines.slice(0, 14).find((l) => /^(sangat\s+)?(segera|penting|rahasia)$/i.test(l.replace(/[^A-Za-z ]/g, '').trim())) || '').toLowerCase();
  if (/segera/.test(sfText)) res.sifat = 'Segera';
  else if (/rahasia/.test(sfText)) res.sifat = 'Rahasia';
  else if (/penting/.test(sfText)) res.sifat = 'Penting';
  else if (/biasa/.test(sfText)) res.sifat = 'Biasa';

  // ---- Asal (kop surat)
  res.asal = parseAsal(lines);

  return res;
}

/** Nama berkas PDF yang rapi: "Surat Masuk - 421.2-045-UPTD-2026 - Undangan Rapat.pdf". */
export function suggestPdfName(f: { noSurat?: string; perihal?: string; asal?: string }): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  const parts = ['Surat Masuk'];
  if (f.noSurat) parts.push(clean(f.noSurat).slice(0, 60));
  const t = f.perihal || f.asal;
  if (t) parts.push(clean(t).slice(0, 60));
  return clean(parts.join(' - ')) + '.pdf';
}
