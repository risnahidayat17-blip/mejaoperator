/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pembuat PDF kecil tanpa dependensi: satu halaman A4 per gambar JPEG hasil scan.
 * Bila ada hasil OCR, teks disisipkan tak terlihat di atas gambar sehingga PDF bisa dicari dan disalin
 * (sama seperti PDF "searchable" dari aplikasi scanner).
 */

export interface OcrLine {
  text: string;
  /** Koordinat piksel pada gambar halaman. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PdfPage {
  jpeg: Uint8Array;
  /** Ukuran piksel gambar. */
  w: number;
  h: number;
  lines?: OcrLine[];
}

export interface PdfMeta {
  title?: string;
  author?: string;
  subject?: string;
}

const A4_W = 595.28;
const A4_H = 841.89;

const enc = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

const num = (n: number) => (Math.round(n * 100) / 100).toString();

/** Teks untuk string PDF (WinAnsi): karakter di luar Latin-1 diganti "?". */
function pdfString(text: string): string {
  let o = '';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 0x28 || c === 0x29 || c === 0x5c) o += '\\' + ch;
    else if (c < 32) o += ' ';
    else if (c > 255) o += '?';
    else o += ch;
  }
  return o;
}

function asciiOnly(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, ' ');
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export function buildPdf(pages: PdfPage[], meta: PdfMeta = {}): Uint8Array {
  if (!pages.length) throw new Error('Tidak ada halaman untuk dijadikan PDF.');
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc(b) : b;
    chunks.push(bytes);
    pos += bytes.length;
  };
  const beginObj = (id: number) => {
    offsets[id] = pos;
    push(`${id} 0 obj\n`);
  };

  const hasText = pages.some((p) => p.lines && p.lines.length);
  // nomor objek: 1 Catalog, 2 Pages, 3 Font, 4 Info, lalu 3 objek per halaman (Page, Content, Image)
  const pageObj = (i: number) => 5 + i * 3;
  const total = 4 + pages.length * 3;

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  beginObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObj(2);
  push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>\nendobj\n`);

  beginObj(3);
  push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');

  beginObj(4);
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `D:${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
  push(
    `<< /Title (${asciiOnly(meta.title || 'Surat Masuk')}) /Author (${asciiOnly(meta.author || '')}) /Subject (${asciiOnly(
      meta.subject || ''
    )}) /Producer (Meja Operator) /CreationDate (${stamp}) >>\nendobj\n`
  );

  pages.forEach((pg, i) => {
    const landscape = pg.w > pg.h;
    const PW = landscape ? A4_H : A4_W;
    const PH = landscape ? A4_W : A4_H;
    const s = Math.min(PW / pg.w, PH / pg.h);
    const iw = pg.w * s;
    const ih = pg.h * s;
    const ox = (PW - iw) / 2;
    const oy = (PH - ih) / 2;

    let content = `q ${num(iw)} 0 0 ${num(ih)} ${num(ox)} ${num(oy)} cm /Im0 Do Q\n`;
    if (pg.lines && pg.lines.length) {
      content += 'BT\n3 Tr\n';
      for (const ln of pg.lines) {
        const text = (ln.text || '').trim();
        if (!text) continue;
        const lineH = Math.max(1, (ln.y1 - ln.y0) * s);
        const size = Math.max(4, Math.min(40, lineH * 0.85));
        const targetW = Math.max(1, (ln.x1 - ln.x0) * s);
        const natural = text.length * size * 0.52;
        const tz = Math.max(20, Math.min(400, (targetW / natural) * 100));
        const x = ox + ln.x0 * s;
        const y = oy + ih - ln.y1 * s + lineH * 0.2;
        content += `/F1 ${num(size)} Tf ${num(tz)} Tz 1 0 0 1 ${num(x)} ${num(y)} Tm (${pdfString(text)}) Tj\n`;
      }
      content += 'ET\n';
    }

    beginObj(pageObj(i));
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PW)} ${num(PH)}] /Resources << /XObject << /Im0 ${pageObj(i) + 2} 0 R >>${
        hasText ? ` /Font << /F1 3 0 R >>` : ''
      } >> /Contents ${pageObj(i) + 1} 0 R >>\nendobj\n`
    );

    const cbytes = enc(content);
    beginObj(pageObj(i) + 1);
    push(`<< /Length ${cbytes.length} >>\nstream\n`);
    push(cbytes);
    push('\nendstream\nendobj\n');

    beginObj(pageObj(i) + 2);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`
    );
    push(pg.jpeg);
    push('\nendstream\nendobj\n');
  });

  const xrefPos = pos;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= total; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Canvas -> JPEG bytes. */
export async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.8): Promise<Uint8Array> {
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (blob) return new Uint8Array(await blob.arrayBuffer());
  return dataUrlToBytes(canvas.toDataURL('image/jpeg', quality));
}
