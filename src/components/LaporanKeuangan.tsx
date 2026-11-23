/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { SchoolConfig, KeuanganState, KeuanganEditRow, SpjDocType } from '../types';
import { getKeuangan, saveKeuangan, subscribeToStorage } from '../lib/storage';
import { triggerGooglePrint, printDomElement } from '../lib/print';
import {
  SPJ_DOC_TABS,
  SPJ_KATEGORI_META,
  DOC_ICON_MAP,
  SpjDocSheet,
  SpjDocEditor,
  computeSpjValues,
  detectSpjKategori,
  getAllowedDocTabs,
  getBundleDocsForKategori,
  SPJ_A4_PRINT_OPTIONS,
} from './SpjKeuanganDocs';
import { BukuPembantuPajak } from './BukuPembantuPajak';
import { resolveBkuTax } from '../lib/pajakBku';
import {
  Upload,
  Printer,
  Search,
  Eye,
  EyeOff,
  Palette,
  Layers,
  FileSpreadsheet,
  ReceiptText,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface LaporanKeuanganProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const MONTH_ALIAS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
  jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

function formatTglIndo(tglStr?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tglStr || '');
  return m ? `${parseInt(m[3], 10)} ${MONTH_NAMES[parseInt(m[2], 10) - 1]} ${m[1]}` : tglStr || '';
}

function formatRupiah(val: number): string {
  return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

function terbilangAngka(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilangAngka(n - 10) + ' belas';
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilangAngka(n % 10) : '');
  if (n < 200) return 'seratus' + (n - 100 ? ' ' + terbilangAngka(n - 100) : '');
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilangAngka(n % 100) : '');
  if (n < 2000) return 'seribu' + (n - 1000 ? ' ' + terbilangAngka(n - 1000) : '');
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilangAngka(n % 1000) : '');
  if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 ? ' ' + terbilangAngka(n % 1000000) : '');
  if (n < 1000000000000) return terbilangAngka(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 ? ' ' + terbilangAngka(n % 1000000000) : '');
  return terbilangAngka(Math.floor(n / 1000000000000)) + ' triliun' + (n % 1000000000000 ? ' ' + terbilangAngka(n % 1000000000000) : '');
}

function terbilang(n: number): string {
  const rounded = Math.round(Math.abs(n || 0));
  const kata = rounded === 0 ? 'nol' : terbilangAngka(rounded);
  return kata.replace(/\b\w/g, (c) => c.toUpperCase()) + ' Rupiah';
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  let str = String(val ?? '').trim();
  if (!str) return 0;
  const isNegative = /^\(.*\)$/.test(str) || /^-/.test(str);
  str = str.replace(/[^0-9.,]/g, '');
  if (!str) return 0;
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    const decSep = lastDot > lastComma ? '.' : ',';
    const thouSep = decSep === '.' ? ',' : '.';
    str = str.split(thouSep).join('').replace(decSep, '.');
  } else if (lastComma > -1) {
    const parts = str.split(',');
    str = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join('') : parts.join('.');
  } else if (lastDot > -1) {
    const parts = str.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      str = parts.join('');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : isNegative ? -num : num;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const makeDate = (y: number, m: number, d: number) =>
  y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad2(m)}-${pad2(d)}` : '';

function parseDate(val: any): string {
  if (typeof val === 'number') {
    if (val > 20000 && val < 80000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(val) * 86400000);
      return makeDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
    }
    return '';
  }
  const str = String(val ?? '').trim();
  if (!str) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
  if (m) return makeDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(str);
  if (m) return makeDate(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/.exec(str);
  if (m) {
    const mNum = MONTH_ALIAS[m[2].toLowerCase().slice(0, 3)];
    if (mNum) return makeDate(+m[3], mNum, +m[1]);
  }
  return '';
}

function parseDelimitedText(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const sample = clean.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6).join('\n');
  const countChar = (c: string) => sample.split(c).length - 1;
  const candidates: [string, number][] = [
    ['\t', countChar('\t')],
    [';', countChar(';')],
    [',', countChar(',')],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  const delimiter = candidates[0][1] > 0 ? candidates[0][0] : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) {
        row.push(cur);
        cur = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && clean[i + 1] === '\n') i++;
        row.push(cur);
        cur = '';
        rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// Simple ZIP & XML Parser for XLSX files
function readZipEntries(bytes: Uint8Array): Map<string, { method: number; csize: number; off: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('File bukan .xlsx yang valid. Simpan BKU sebagai .xlsx atau .csv.');
  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const map = new Map<string, { method: number; csize: number; off: number }>();
  for (let i = 0; i < total && view.getUint32(p, true) === 0x02014b50; i++) {
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const nlen = view.getUint16(p + 28, true);
    const elen = view.getUint16(p + 30, true);
    const clen = view.getUint16(p + 32, true);
    const off = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    map.set(name, { method, csize, off });
    p += 46 + nlen + elen + clen;
  }
  return map;
}

async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = (globalThis as any).DecompressionStream;
  if (!ds) throw new Error('Browser ini belum mendukung dekompresi .xlsx. Gunakan format .csv.');
  const stream = new Blob([compressed as any]).stream().pipeThrough(new ds('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipText(
  bytes: Uint8Array,
  entries: Map<string, { method: number; csize: number; off: number }>,
  path: string
): Promise<string | null> {
  const entry = entries.get(path);
  if (!entry) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fileStart = entry.off + 30 + view.getUint16(entry.off + 26, true) + view.getUint16(entry.off + 28, true);
  const data = bytes.subarray(fileStart, fileStart + entry.csize);
  const decompressed = entry.method === 0 ? data : await decompressDeflateRaw(data);
  return new TextDecoder().decode(decompressed);
}

const colToIdx = (col: string): number => {
  const m = /^([A-Z]+)/.exec(col);
  if (!m) return 0;
  let idx = 0;
  for (const ch of m[1]) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
};

async function parseXlsxSheets(buffer: ArrayBuffer): Promise<{ name: string; rows: any[][] }[]> {
  const bytes = new Uint8Array(buffer);
  const entries = readZipEntries(bytes);
  const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  const sharedStrings: string[] = [];
  const sstXml = await readZipText(bytes, entries, 'xl/sharedStrings.xml');
  if (sstXml) {
    const doc = parseXml(sstXml);
    Array.from(doc.getElementsByTagName('si')).forEach((si) => {
      sharedStrings.push(
        Array.from(si.getElementsByTagName('t'))
          .map((t) => t.textContent || '')
          .join('')
      );
    });
  }

  const sheets: { name: string; path: string }[] = [];
  const wbXml = await readZipText(bytes, entries, 'xl/workbook.xml');
  const relsXml = await readZipText(bytes, entries, 'xl/_rels/workbook.xml.rels');
  if (wbXml && relsXml) {
    const relsMap = new Map<string, string>();
    Array.from(parseXml(relsXml).getElementsByTagName('Relationship')).forEach((r) => {
      relsMap.set(r.getAttribute('Id') || '', r.getAttribute('Target') || '');
    });
    Array.from(parseXml(wbXml).getElementsByTagName('sheet')).forEach((s) => {
      let target = relsMap.get(s.getAttribute('r:id') || '') || '';
      target = target.replace(/^\//, '');
      if (target && !target.startsWith('xl/')) target = 'xl/' + target;
      if (target) sheets.push({ name: s.getAttribute('name') || target, path: target });
    });
  }

  if (!sheets.length) {
    Array.from(entries.keys())
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .sort()
      .forEach((k) => sheets.push({ name: k, path: k }));
  }

  const result: { name: string; rows: any[][] }[] = [];
  for (const s of sheets) {
    const sheetXml = await readZipText(bytes, entries, s.path);
    if (!sheetXml) continue;
    const doc = parseXml(sheetXml);
    const rowsArr: any[][] = [];
    Array.from(doc.getElementsByTagName('row')).forEach((rowEl) => {
      const row: any[] = [];
      Array.from(rowEl.getElementsByTagName('c')).forEach((c) => {
        const cRef = colToIdx(c.getAttribute('r') || '');
        const t = c.getAttribute('t');
        const vEl = c.getElementsByTagName('v')[0]?.textContent ?? '';
        let val: any = '';
        if (t === 's') val = sharedStrings[parseInt(vEl, 10)] ?? '';
        else if (t === 'inlineStr') {
          val = Array.from(c.getElementsByTagName('t'))
            .map((tEl) => tEl.textContent || '')
            .join('');
        } else if (t === 'str' || t === 'e') val = vEl;
        else if (t === 'b') val = vEl === '1' ? 'TRUE' : 'FALSE';
        else if (vEl !== '') val = Number(vEl);
        row[cRef] = val;
      });
      const rNum = parseInt(rowEl.getAttribute('r') || '', 10);
      if (isNaN(rNum)) rowsArr.push(row);
      else rowsArr[rNum - 1] = row;
    });
    result.push({ name: s.name, rows: Array.from(rowsArr, (r) => r || []) });
  }
  return result;
}

const HEADER_PATTERNS: [string, RegExp][] = [
  ['tgl', /\b(tanggal|tgl)\b/],
  ['noBukti', /\b(bukti|kwitansi|nota)\b/],
  ['kodeRek', /kode rekening|kode rek|kode akun|rekening/],
  ['uraian', /uraian|keterangan|deskripsi/],
  ['pengeluaran', /pengeluaran|kredit|keluar|realisasi/],
];

const normHeader = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function findBkuColumns(rows: any[][]): { idx: number; map: Record<string, number> } | null {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const map: Record<string, number> = {};
    (rows[r] || []).forEach((cell: any, cIdx: number) => {
      const txt = normHeader(cell);
      if (txt) {
        for (const [key, rx] of HEADER_PATTERNS) {
          if (map[key] === undefined && rx.test(txt)) {
            map[key] = cIdx;
            break;
          }
        }
      }
    });
    if (map.uraian !== undefined && map.pengeluaran !== undefined) {
      return { idx: r, map };
    }
  }
  return null;
}

function parseBkuTable(rows: any[][]) {
  const match = findBkuColumns(rows);
  if (!match) return null;
  const { idx, map } = match;
  const cell = (row: any[], key: string) =>
    map[key] === undefined ? '' : row[map[key]] ?? '';

  const records: any[] = [];
  const counts = new Map<string, number>();

  for (let r = idx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const uraian = String(cell(row, 'uraian')).replace(/\s+/g, ' ').trim();
    const tgl = parseDate(cell(row, 'tgl'));
    const pengeluaran = Math.abs(parseNumber(cell(row, 'pengeluaran')));

    if (pengeluaran <= 0 || !uraian || (!tgl && /^(jumlah|total|saldo)\b/i.test(uraian))) {
      continue;
    }

    const noBukti = String(cell(row, 'noBukti')).trim();
    const baseId = `${tgl}|${noBukti}|${pengeluaran}|${uraian.slice(0, 24)}`;
    const c = (counts.get(baseId) || 0) + 1;
    counts.set(baseId, c);
    const id = c > 1 ? `${baseId}#${c}` : baseId;

    records.push({
      id,
      tgl,
      noBukti,
      uraian,
      pengeluaran,
      kodeRek: String(cell(row, 'kodeRek')).trim(),
    });
  }
  return records;
}

interface PdfTextItem {
  x: number;
  y: number;
  w: number;
  s: string;
}

interface PdfColDef {
  name: string;
  xMid: number;
  boundLeft: number;
  boundRight: number;
}

const PDF_ALL_COL_PATTERNS: [string, RegExp][] = [
  ['tgl', /\b(tanggal|tgl)\b/],
  ['kodeRek', /kode rekening|kode rek|kode akun|\brekening\b/],
  ['noBku', /\bno bku\b/],
  ['noBukti', /\b(no bukti|bukti|kwitansi|nota)\b/],
  ['uraian', /uraian|keterangan|deskripsi/],
  ['penerimaan', /penerimaan|debet|debit|masuk/],
  ['pengeluaran', /pengeluaran|kredit|keluar|realisasi/],
  ['saldo', /\bsaldo\b/],
  ['no', /^no$/],
];

function groupPdfItemsByY(items: PdfTextItem[], yTol = 4): { y: number; items: PdfTextItem[] }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= yTol) {
      last.items.push(it);
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  for (const ln of lines) ln.items.sort((a, b) => a.x - b.x);
  return lines;
}

function detectPdfHeaderColumns(items: PdfTextItem[]): { cols: PdfColDef[]; headerBottomY: number } | null {
  const bands = groupPdfItemsByY(items, 4.5);
  for (let i = 0; i < Math.min(bands.length, 40); i++) {
    // Merge up to 3 closely stacked header lines (e.g., "Kode\nRekening", "No.\nBukti")
    const bandItems: PdfTextItem[] = [...bands[i].items];
    let minY = bands[i].y;
    for (let j = i + 1; j < Math.min(bands.length, i + 4); j++) {
      if (bands[i].y - bands[j].y <= 18) {
        bandItems.push(...bands[j].items);
        minY = Math.min(minY, bands[j].y);
      } else {
        break;
      }
    }

    const joined = normHeader(bandItems.map((b) => b.s).join(' '));
    if (!(/uraian|keterangan|deskripsi/.test(joined) && /pengeluaran|kredit|keluar|realisasi/.test(joined))) {
      continue;
    }

    // Group horizontally overlapping items inside the header band into column header labels
    const xClusters: { xMin: number; xMax: number; parts: PdfTextItem[] }[] = [];
    const sorted = [...bandItems].sort((a, b) => a.x - b.x);
    for (const it of sorted) {
      const itRight = it.x + Math.max(8, it.w);
      const match = xClusters.find(
        (c) => Math.max(c.xMin, it.x) <= Math.min(c.xMax, itRight) + 6
      );
      if (match) {
        match.parts.push(it);
        match.xMin = Math.min(match.xMin, it.x);
        match.xMax = Math.max(match.xMax, itRight);
      } else {
        xClusters.push({ xMin: it.x, xMax: itRight, parts: [it] });
      }
    }

    const colsRaw: { name: string; xMid: number; xMin: number; xMax: number }[] = [];
    const usedNames = new Set<string>();
    for (const c of xClusters) {
      c.parts.sort((a, b) => b.y - a.y || a.x - b.x);
      const label = normHeader(c.parts.map((p) => p.s).join(' '));
      for (const [colName, rx] of PDF_ALL_COL_PATTERNS) {
        if (!usedNames.has(colName) && rx.test(label)) {
          usedNames.add(colName);
          colsRaw.push({
            name: colName,
            xMid: (c.xMin + c.xMax) / 2,
            xMin: c.xMin,
            xMax: c.xMax,
          });
          break;
        }
      }
    }

    if (colsRaw.some((c) => c.name === 'uraian') && colsRaw.some((c) => c.name === 'pengeluaran')) {
      colsRaw.sort((a, b) => a.xMid - b.xMid);
      const cols: PdfColDef[] = colsRaw.map((c, idx) => {
        const prev = colsRaw[idx - 1];
        const next = colsRaw[idx + 1];
        const boundLeft = prev ? (prev.xMid + c.xMid) / 2 : -Infinity;
        const boundRight = next ? (c.xMid + next.xMid) / 2 : Infinity;
        return { name: c.name, xMid: c.xMid, boundLeft, boundRight };
      });
      return { cols, headerBottomY: minY };
    }
  }
  return null;
}

const PDF_DATE_CELL_RX = /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})$/;
const PDF_NUM_TOKEN_RX = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/;
const PDF_FOOTER_RX = /^(kas di bendahara|mengetahui\s*:?|kepala\b|bendahara\b|jumlah seluruh|total seluruh|disetujui|#\s*seratus|a\.\s*tunai|b\.\s*bank|c\.\s*pajak)/i;

async function parsePdfBkuRows(buffer: ArrayBuffer): Promise<any[][]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const headerNames = ['Tanggal', 'No. Bukti', 'Kode Rekening', 'Uraian', 'Pengeluaran'];
  const outRows: any[][] = [headerNames];
  let activeCols: PdfColDef[] | null = null;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const raw of tc.items as any[]) {
      const s = String(raw?.str ?? '');
      if (!s.trim()) continue;
      items.push({
        x: Number(raw.transform?.[4] ?? 0),
        y: Number(raw.transform?.[5] ?? 0),
        w: Number(raw.width ?? 0),
        s,
      });
    }
    if (!items.length) continue;

    const detected = detectPdfHeaderColumns(items);
    if (detected) activeCols = detected.cols.map((c) => ({ ...c }));
    if (!activeCols) continue;

    const bodyStartY = detected ? detected.headerBottomY - 4 : Infinity;
    const bodyItems = items.filter((it) => it.y < bodyStartY);
    const lines = groupPdfItemsByY(bodyItems, 4.5);

    // Stop before footer block on this page
    const validLines: { y: number; items: PdfTextItem[] }[] = [];
    for (const ln of lines) {
      const fullLineText = ln.items.map((i) => i.s).join(' ').trim();
      if (/^\d+\/\d+$/.test(fullLineText) && ln.y < 40) continue; // page number like "1/1"
      if (PDF_FOOTER_RX.test(fullLineText)) break;
      validLines.push(ln);
    }

    // Calibrate left boundary of wide centered 'uraian' column from actual wrapped/long description items
    const uraianIdx = activeCols.findIndex((c) => c.name === 'uraian');
    if (uraianIdx > 0) {
      const uCol = activeCols[uraianIdx];
      const prevCol = activeCols[uraianIdx - 1];
      let inferredLeft = uCol.boundLeft;
      for (const ln of validLines) {
        for (const it of ln.items) {
          const mid = it.x + it.w / 2;
          if (mid >= uCol.boundLeft && mid < uCol.boundRight && it.x > prevCol.xMid + 12) {
            inferredLeft = Math.min(inferredLeft, it.x);
          }
        }
      }
      if (inferredLeft < uCol.boundLeft && inferredLeft > prevCol.xMid + 12) {
        uCol.boundLeft = inferredLeft - 4;
        prevCol.boundRight = uCol.boundLeft;
      }
    }

    const findColIdx = (it: PdfTextItem): number => {
      if (!activeCols) return -1;
      const tokens = it.s.trim().split(/\s+/);
      const isMergedNums = tokens.length >= 2 && tokens.every((t) => PDF_NUM_TOKEN_RX.test(t));
      const probeX = isMergedNums ? it.x + 2 : it.x + it.w / 2;
      for (let idx = 0; idx < activeCols.length; idx++) {
        if (probeX >= activeCols[idx].boundLeft && probeX < activeCols[idx].boundRight) {
          return idx;
        }
      }
      // Nearest fallback
      let bestIdx = 0;
      let bestDist = Infinity;
      activeCols.forEach((c, idx) => {
        const d = Math.abs(probeX - c.xMid);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      return bestIdx;
    };

    // Find row anchors: lines with a date or a numeric amount in Penerimaan/Pengeluaran or "Saldo Awal"
    const anchorIndices: number[] = [];
    validLines.forEach((ln, idx) => {
      let hasDate = false;
      let hasAmount = false;
      for (const it of ln.items) {
        const colIdx = findColIdx(it);
        const colName = activeCols?.[colIdx]?.name || '';
        const txt = it.s.trim();
        if (colName === 'tgl' && PDF_DATE_CELL_RX.test(txt)) hasDate = true;
        if ((colName === 'pengeluaran' || colName === 'penerimaan') && /\d/.test(txt)) hasAmount = true;
      }
      if (hasDate || hasAmount) anchorIndices.push(idx);
    });

    if (!anchorIndices.length) continue;

    // Group lines around each anchor using Y midpoints between consecutive anchors
    const buckets: { y: number; items: PdfTextItem[] }[][] = anchorIndices.map(() => []);
    for (let li = 0; li < validLines.length; li++) {
      const ly = validLines[li].y;
      let bestA = 0;
      let bestDist = Infinity;
      for (let ai = 0; ai < anchorIndices.length; ai++) {
        const ay = validLines[anchorIndices[ai]].y;
        const d = Math.abs(ly - ay);
        if (d < bestDist) {
          bestDist = d;
          bestA = ai;
        }
      }
      buckets[bestA].push(validLines[li]);
    }

    for (const bucket of buckets) {
      bucket.sort((a, b) => b.y - a.y);
      const cellMap: Record<string, string[]> = {};
      for (const ln of bucket) {
        for (const it of ln.items) {
          const startIdx = findColIdx(it);
          if (startIdx < 0 || !activeCols) continue;
          const tokens = it.s.trim().split(/\s+/);
          const isMergedNums = tokens.length >= 2 && tokens.every((t) => PDF_NUM_TOKEN_RX.test(t));
          if (isMergedNums) {
            tokens.forEach((tok, offset) => {
              const targetCol = activeCols![startIdx + offset];
              if (targetCol) {
                (cellMap[targetCol.name] ||= []).push(tok);
              }
            });
          } else {
            const colName = activeCols[startIdx].name;
            (cellMap[colName] ||= []).push(it.s.trim());
          }
        }
      }

      const tglStr = (cellMap.tgl || []).join(' ').trim();
      const noBuktiStr = (cellMap.noBukti || cellMap.noBku || []).join(' ').trim();
      const kodeRekStr = (cellMap.kodeRek || []).join(' ').trim();
      const uraianStr = (cellMap.uraian || []).join(' ').replace(/\s+/g, ' ').trim();
      const pengeluaranStr = (cellMap.pengeluaran || []).join(' ').trim();

      if (uraianStr || pengeluaranStr) {
        outRows.push([tglStr, noBuktiStr, kodeRekStr, uraianStr, pengeluaranStr]);
      }
    }
  }

  return outRows;
}

async function parseBkuFile(file: File) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xls')) {
    throw new Error('Format .xls lama belum didukung. Simpan ulang BKU sebagai .xlsx, .csv, atau .pdf.');
  }

  let sheetsRows: any[][][];
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    sheetsRows = [await parsePdfBkuRows(await file.arrayBuffer())];
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    sheetsRows = (await parseXlsxSheets(await file.arrayBuffer())).map((s) => s.rows);
  } else {
    sheetsRows = [parseDelimitedText(await file.text())];
  }

  for (const rows of sheetsRows) {
    const res = parseBkuTable(rows);
    if (res) {
      if (!res.length) {
        throw new Error('Kolom BKU terbaca, tetapi tidak ada baris transaksi pengeluaran.');
      }
      return res;
    }
  }
  throw new Error('Kolom BKU tidak dikenali. Pastikan file memiliki kolom Uraian dan Pengeluaran.');
}

// Guilloche-style security artwork (pure SVG, units in mm) for the pre-printed kwitansi look
const rosette = (
  keyPrefix: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  stroke: string,
  w = 0.1,
) =>
  Array.from({ length: n }, (_, i) => (
    <ellipse
      key={`${keyPrefix}${i}`}
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      transform={`rotate(${(i * 180) / n} ${cx} ${cy})`}
      fill="none"
      stroke={stroke}
      strokeWidth={w}
    />
  ));

type KwitansiSizeKey = 'kecil' | 'sedang';
type KwitansiColorKey = 'biru' | 'hijau' | 'kuning' | 'merah' | 'ungu' | 'abu';

interface KwitansiPalette {
  id: KwitansiColorKey;
  label: string;
  swatch: string;
  ink: string;
  bgOuter: string;
  bgInner: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  medallion: string;
  stubBorder: string;
}

const KWITANSI_SIZES: Record<
  KwitansiSizeKey,
  { id: KwitansiSizeKey; label: string; mmLabel: string; widthMm: number; heightMm: number; stubMm: number }
> = {
  kecil: {
    id: 'kecil',
    label: 'Kecil (7,5 × 21,5 cm)',
    mmLabel: '75 × 215 mm',
    widthMm: 215,
    heightMm: 75,
    stubMm: 34,
  },
  sedang: {
    id: 'sedang',
    label: 'Sedang (7,6 × 18 cm)',
    mmLabel: '76 × 180 mm',
    widthMm: 180,
    heightMm: 76,
    stubMm: 32,
  },
};

const KWITANSI_COLORS: Record<KwitansiColorKey, KwitansiPalette> = {
  biru: {
    id: 'biru',
    label: 'Biru Klasik',
    swatch: '#5aa9d4',
    ink: '#0b2a4a',
    bgOuter: '#8ccbec',
    bgInner: '#bfe5f6',
    accent: '#5aa9d4',
    accentSoft: '#6db4da',
    accentDeep: '#4f9fcf',
    medallion: '#d6f0fb',
    stubBorder: '#3b5775',
  },
  hijau: {
    id: 'hijau',
    label: 'Hijau Zamrud',
    swatch: '#3da57e',
    ink: '#0c3b2e',
    bgOuter: '#86d3b4',
    bgInner: '#c3eedb',
    accent: '#3da57e',
    accentSoft: '#52b891',
    accentDeep: '#2f8e6a',
    medallion: '#dcf7ea',
    stubBorder: '#1d5947',
  },
  kuning: {
    id: 'kuning',
    label: 'Kuning Krem',
    swatch: '#d4a83b',
    ink: '#4a3208',
    bgOuter: '#ecd38a',
    bgInner: '#faedc2',
    accent: '#c49b36',
    accentSoft: '#d1aa47',
    accentDeep: '#ab8324',
    medallion: '#fdf6dc',
    stubBorder: '#6b4d16',
  },
  merah: {
    id: 'merah',
    label: 'Merah Rose',
    swatch: '#cf617d',
    ink: '#521327',
    bgOuter: '#eb9eb0',
    bgInner: '#fbd4de',
    accent: '#c95d79',
    accentSoft: '#d6748e',
    accentDeep: '#b34763',
    medallion: '#fde6ec',
    stubBorder: '#6e2239',
  },
  ungu: {
    id: 'ungu',
    label: 'Ungu Elegan',
    swatch: '#8368d1',
    ink: '#2b1754',
    bgOuter: '#b7a4ea',
    bgInner: '#dfd5fb',
    accent: '#7c63c9',
    accentSoft: '#9078d9',
    accentDeep: '#664db3',
    medallion: '#eee9fd',
    stubBorder: '#432b7a',
  },
  abu: {
    id: 'abu',
    label: 'Abu Netral',
    swatch: '#78889b',
    ink: '#1e293b',
    bgOuter: '#cbd5e1',
    bgInner: '#e9eef5',
    accent: '#7a8ba0',
    accentSoft: '#94a3b8',
    accentDeep: '#64748b',
    medallion: '#f1f5f9',
    stubBorder: '#334155',
  },
};

const MM_TO_PX_96DPI = 96 / 25.4;

const KwitansiBodyArt: React.FC<{
  width: number;
  height: number;
  palette: KwitansiPalette;
}> = ({ width: W, height: H, palette }) => {
  const uid = useId().replace(/:/g, '');
  const bgId = `kwBg-${uid}`;
  const diamondId = `kwDiamond-${uid}`;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <svg className="kw-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.bgOuter} />
          <stop offset="0.5" stopColor={palette.bgInner} />
          <stop offset="1" stopColor={palette.bgOuter} />
        </linearGradient>
        <pattern id={diamondId} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
          <path d="M0.8 0 L1.6 0.8 L0.8 1.6 L0 0.8 Z" fill="none" stroke="#ffffff" strokeWidth="0.18" />
          <circle cx="0.8" cy="0.8" r="0.2" fill={palette.accent} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${bgId})`} />
      <rect x="0" y="0" width={W} height="2.4" fill={`url(#${diamondId})`} />
      <rect x="0" y={H - 2.4} width={W} height="2.4" fill={`url(#${diamondId})`} />
      <rect x="0" y="0" width="2.4" height={H} fill={`url(#${diamondId})`} />
      <rect x={W - 2.4} y="0" width="2.4" height={H} fill={`url(#${diamondId})`} />
      <rect x="2.4" y="2.4" width={W - 4.8} height={H - 4.8} fill="none" stroke={palette.accent} strokeWidth="0.15" />

      <g opacity="0.85">
        {rosette('a', cx, cy, Math.min(58, W * 0.36), 13, 36, '#ffffff', 0.11)}
        {rosette('b', cx, cy, Math.min(44, W * 0.28), 19, 30, palette.accentSoft, 0.08)}
        {rosette('c', cx, cy, 21, 21, 24, '#ffffff', 0.11)}
        {rosette('d', cx, cy, 11, 11, 18, palette.accentDeep, 0.09)}
        <circle cx={cx} cy={cy} r="4.5" fill={palette.medallion} stroke={palette.accentDeep} strokeWidth="0.15" />
      </g>
      {[W * 0.14, W * 0.86].map((x) => (
        <g key={x} opacity="0.8">
          {rosette(`s${x}a`, x, cy + 2, 12, 12, 22, '#ffffff', 0.11)}
          {rosette(`s${x}b`, x, cy + 2, 8, 8, 16, palette.accent, 0.09)}
          <circle cx={x} cy={cy + 2} r="2.6" fill={palette.medallion} stroke={palette.accentDeep} strokeWidth="0.15" />
        </g>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={`w${i}`}
          d={`M2.4 ${14 + i * 0.7} C ${W * 0.25} ${10 + i}, ${W * 0.75} ${18 + i}, ${W - 2.4} ${14 + i * 0.7}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.08"
          opacity="0.5"
        />
      ))}
    </svg>
  );
};

const KwitansiStubArt: React.FC<{
  width: number;
  height: number;
  palette: KwitansiPalette;
}> = ({ width: W, height: H, palette }) => {
  const uid = useId().replace(/:/g, '');
  const stubBgId = `kwStubBg-${uid}`;
  return (
    <svg className="kw-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={stubBgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.bgOuter} />
          <stop offset="0.5" stopColor={palette.bgInner} />
          <stop offset="1" stopColor={palette.bgOuter} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${stubBgId})`} />
      <rect x="0.8" y="0.8" width={W - 1.6} height={H - 1.6} fill="none" stroke={palette.stubBorder} strokeWidth="0.6" />
      <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke={palette.stubBorder} strokeWidth="0.2" strokeDasharray="0.5 0.5" />
      <path
        d={`M4 8 Q${W / 2} 2 ${W - 4} 8 Q${W - 8} 16 ${W - 4} 24 L${W - 4} ${H - 24} Q${W - 8} ${H - 16} ${W - 4} ${H - 8} Q${W / 2} ${H - 2} 4 ${H - 8} Q8 ${H - 16} 4 ${H - 24} L4 24 Q8 16 4 8 Z`}
        fill={palette.medallion}
        fillOpacity="0.55"
        stroke="#ffffff"
        strokeWidth="0.4"
      />
      <g opacity="0.85">
        {rosette('m', W / 2, 12, 6.5, 6.5, 20, '#ffffff', 0.11)}
        {rosette('n', W / 2, 12, 4.3, 4.3, 14, palette.accentDeep, 0.09)}
        <circle cx={W / 2} cy="12" r="1.8" fill={palette.bgOuter} stroke={palette.accentDeep} strokeWidth="0.15" />
      </g>
    </svg>
  );
};

// Single Kwitansi Preview & Print Component
const KwitansiView: React.FC<{
  config: SchoolConfig;
  settings: KeuanganState['settings'];
  row: KeuanganState['bku'][0];
  v: { noKw: string; tgl: string; penerima: string; untuk: string; kodeRek: string };
  sizeKey: KwitansiSizeKey;
  colorKey: KwitansiColorKey;
  showArt: boolean;
}> = ({ config, settings, row, v, sizeKey, colorKey, showArt }) => {
  const formattedAmt = Math.round(row.pengeluaran).toLocaleString('id-ID');
  const needsMaterai = row.pengeluaran >= 5000000;
  const sizeSpec = KWITANSI_SIZES[sizeKey];
  const palette = KWITANSI_COLORS[colorKey] || KWITANSI_COLORS.biru;
  const innerH = sizeSpec.heightMm - 6; // minus 3mm top & 3mm bottom padding
  const bodyW = sizeSpec.widthMm - 6 - 2.5 - sizeSpec.stubMm;

  return (
    <div
      className={`kw-sheet kw-sheet--${sizeKey} ${!showArt ? 'kw-sheet--no-art' : ''}`}
      style={{ '--kw-ink': palette.ink } as React.CSSProperties}
    >
      <div className="kw-paper">
        {/* Left box (matsir) with Kepala Sekolah signature */}
        <div className="kw-stub">
          {showArt && <KwitansiStubArt width={sizeSpec.stubMm} height={innerH} palette={palette} />}
          <div className="kw-stub-sign">
            <div>Mengetahui,</div>
            <div>Kepala Sekolah</div>
            <div className="kw-gap" />
            <div className="kw-name">{config.kepsek}</div>
            <div className="kw-nip">NIP. {config.nipKepsek || '-'}</div>
          </div>
        </div>

        {/* Main body */}
        <div className="kw-body">
          {showArt && <KwitansiBodyArt width={bodyW} height={innerH} palette={palette} />}
          <div className="kw-content">
            <div className="kw-head">
              <div className="kw-noline">
                <span className="kw-label">No.</span>
                <span className="kw-fill">{v.noKw}</span>
              </div>
              <div className="kw-koderek">Kode Rekening : {v.kodeRek || '..................'}</div>
            </div>

            <div className="kw-row">
              <div className="kw-label kw-l">Telah terima dari</div>
              <div className="kw-fill kw-v">
                Bendahara {settings.sumberDana} {config.namaSekolah}
              </div>
            </div>

            <div className="kw-row">
              <div className="kw-label kw-l">Uang sejumlah</div>
              <div className="kw-fill kw-v kw-terbilang">{terbilang(row.pengeluaran)}</div>
            </div>

            <div className="kw-row kw-row-top">
              <div className="kw-label kw-l">Untuk pembayaran</div>
              <div className="kw-ruled">{v.untuk}</div>
            </div>

            <div className="kw-mid">
              <div className="kw-rp">
                <span className="kw-label">Rp.</span>
                <span className="kw-amtbox">
                  <span>{formattedAmt},-</span>
                </span>
              </div>
            </div>

            <div className="kw-sign">
              <div>
                <div>Setuju dibayar,</div>
                <div>Bendahara</div>
                <div className="kw-gap" />
                <div className="kw-name">{settings.bendaharaNama}</div>
                <div className="kw-nip">NIP. {settings.bendaharaNip || '-'}</div>
              </div>

              <div>
                <div>
                  {settings.kota}
                  {v.tgl ? `, ${formatTglIndo(v.tgl)}` : ', ........................'}
                </div>
                <div>Yang menerima,</div>
                <div className="kw-gap">
                  {needsMaterai && <div className="kw-materai">Meterai Rp10.000</div>}
                </div>
                <div className="kw-name">{v.penerima || ' '}</div>
                <div className="kw-nip">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LaporanKeuangan: React.FC<LaporanKeuanganProps> = ({ role, config, onToast }) => {
  if (role !== 'operator') {
    return (
      <div className="bg-white p-8 rounded-xl border border-[#D3DDD9] text-center">
        <p className="text-xs text-rose-700 font-semibold">
          Akses ditolak. Modul Laporan Keuangan hanya dapat dibuka oleh Operator.
        </p>
      </div>
    );
  }

  const [state, setState] = useState<KeuanganState>(() => getKeuangan());
  const [activeMenu, setActiveMenu] = useState<'spj' | 'import_bku' | 'buku_pajak'>('spj');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [activeDoc, setActiveDoc] = useState<SpjDocType>('kwitansi');
  const [printBundleMode, setPrintBundleMode] = useState(false);

  // Manual BKU transaction input state inside Import BKU menu
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTgl, setManualTgl] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualNoBukti, setManualNoBukti] = useState('');
  const [manualKodeRek, setManualKodeRek] = useState('');
  const [manualUraian, setManualUraian] = useState('');
  const [manualPengeluaran, setManualPengeluaran] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const spjPrintSourceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeToStorage(() => setState(getKeuangan()));
  }, []);

  const saveState = (newState: KeuanganState) => {
    setState(newState);
    saveKeuangan(newState);
  };

  const bku = state.bku;
  const hasData = bku.length > 0;
  const selectedRow = bku.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    if (!selectedRow && bku.length) {
      setSelectedId(bku[0].id);
    }
  }, [bku, selectedRow]);

  const sizeKey: KwitansiSizeKey =
    state.settings.ukuranKwitansi === 'sedang' ? 'sedang' : 'kecil';
  const colorKey: KwitansiColorKey =
    state.settings.warnaKwitansi && state.settings.warnaKwitansi in KWITANSI_COLORS
      ? state.settings.warnaKwitansi
      : 'biru';
  const showPreviewArt = state.settings.previewGambar !== false;
  const showPrintArt = state.settings.printGambar === true;

  const activeSize = KWITANSI_SIZES[sizeKey];
  const isKwitansiDoc = activeDoc === 'kwitansi';
  const naturalWidth = (isKwitansiDoc ? activeSize.widthMm : 210) * MM_TO_PX_96DPI;
  const naturalHeight = (isKwitansiDoc ? activeSize.heightMm : 297) * MM_TO_PX_96DPI;

  // Adjust preview scaling dynamically to active sheet dimensions
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => {
      const containerWidth = Math.max(120, el.clientWidth - 16);
      setPreviewScale(Math.min(1, Math.max(0.28, containerWidth / naturalWidth)));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData, naturalWidth, activeDoc, activeMenu]);

  const getComputedRowValues = (row: KeuanganState['bku'][0], index: number) => {
    const edit = state.edits[row.id] || {};
    return {
      noKw: edit.noKw ?? `BKU-${String(parseInt(row.noBukti.match(/(\d+)\s*$/)?.[1] ?? '', 10) || index + 1).padStart(3, '0')}`,
      tgl: edit.tgl ?? row.tgl,
      penerima: edit.penerima ?? '',
      untuk: edit.untuk ?? row.uraian,
      kodeRek: edit.kodeRek ?? row.kodeRek ?? '',
    };
  };

  const updateRowEdit = (rowId: string, patch: Partial<KeuanganEditRow>) => {
    saveState({
      ...state,
      edits: {
        ...state.edits,
        [rowId]: {
          ...state.edits[rowId],
          ...patch,
        },
      },
    });
  };

  const updateSettings = (patch: Partial<KeuanganState['settings']>) => {
    saveState({
      ...state,
      settings: {
        ...state.settings,
        ...patch,
      },
    });
  };

  const handlePatchAllEdits = (nextEdits: KeuanganState['edits']) => {
    saveState({
      ...state,
      edits: nextEdits,
    });
  };

  const handleFileUpload = async (file?: File) => {
    if (!file) return;
    try {
      const records = await parseBkuFile(file);
      saveState({
        ...state,
        bku: records,
        fileName: file.name,
      });
      setCheckedIds(new Set());
      setSelectedId(records[0]?.id || null);
      const taxableCount = records.filter((r) => {
        const tax = resolveBkuTax(r, state.edits[r.id], state.settings);
        return tax.ppn + tax.pph > 0;
      }).length;
      onToast(`${records.length} data BKU dimuat (${taxableCount} transaksi terpotong pajak otomatis).`);
    } catch (err: any) {
      onToast(err?.message || 'Gagal membaca file BKU.', true);
    }
  };

  const handleAddManualBku = (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = Math.max(0, Math.round(Number(manualPengeluaran) || 0));
    if (!manualUraian.trim() || nominal <= 0) {
      onToast('Uraian transaksi dan nominal pengeluaran wajib diisi.', true);
      return;
    }
    const newRow: KeuanganState['bku'][0] = {
      id: `bku-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      tgl: manualTgl || new Date().toISOString().slice(0, 10),
      noBukti: manualNoBukti.trim() || `BKU-${String(state.bku.length + 1).padStart(3, '0')}`,
      uraian: manualUraian.trim(),
      pengeluaran: nominal,
      kodeRek: manualKodeRek.trim() || undefined,
    };
    const nextBku = [...state.bku, newRow];
    saveState({
      ...state,
      bku: nextBku,
      fileName: state.fileName || 'Input Manual BKU',
    });
    setSelectedId(newRow.id);
    setManualNoBukti('');
    setManualKodeRek('');
    setManualUraian('');
    setManualPengeluaran('');
    setShowManualForm(false);
    const autoTax = resolveBkuTax(newRow, undefined, state.settings);
    const totalTax = autoTax.ppn + autoTax.pph;
    onToast(
      totalTax > 0
        ? `Transaksi ditambahkan (Potong pajak otomatis: ${formatRupiah(totalTax)}).`
        : 'Transaksi BKU ditambahkan (Non-pajak).'
    );
  };

  const handleDeleteBkuRow = (rowId: string) => {
    if (confirmDeleteRowId !== rowId) {
      setConfirmDeleteRowId(rowId);
      setTimeout(() => {
        setConfirmDeleteRowId((prev) => (prev === rowId ? null : prev));
      }, 3500);
      return;
    }
    const nextBku = state.bku.filter((r) => r.id !== rowId);
    const nextEdits = { ...state.edits };
    delete nextEdits[rowId];
    saveState({
      ...state,
      bku: nextBku,
      edits: nextEdits,
    });
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
    if (selectedId === rowId) {
      setSelectedId(nextBku[0]?.id || null);
    }
    setConfirmDeleteRowId(null);
    onToast('Baris BKU dihapus.');
  };

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    saveState({
      ...state,
      bku: [],
      edits: {},
      fileName: undefined,
    });
    setCheckedIds(new Set());
    setSelectedId(null);
    setConfirmClear(false);
  };

  const filteredBku = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return bku;
    return bku.filter((r) => `${r.uraian} ${r.noBukti} ${r.kodeRek || ''}`.toLowerCase().includes(q));
  }, [bku, searchFilter]);

  const bkuTaxTotals = useMemo(() => {
    let totalBruto = 0;
    let totalPpn = 0;
    let totalPph = 0;
    let taxableCount = 0;
    bku.forEach((r) => {
      const tax = resolveBkuTax(r, state.edits[r.id], state.settings);
      totalBruto += r.pengeluaran;
      totalPpn += tax.ppn;
      totalPph += tax.pph;
      if (tax.ppn + tax.pph > 0) taxableCount += 1;
    });
    const totalPajak = totalPpn + totalPph;
    return {
      totalBruto,
      totalPpn,
      totalPph,
      totalPajak,
      totalNetto: Math.max(0, totalBruto - totalPajak),
      taxableCount,
    };
  }, [bku, state.edits, state.settings]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllChecked = filteredBku.length > 0 && filteredBku.every((r) => checkedIds.has(r.id));
  const toggleSelectAll = () => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      filteredBku.forEach((r) => {
        if (isAllChecked) next.delete(r.id);
        else next.add(r.id);
      });
      return next;
    });
  };

  const printItems = checkedIds.size > 0 ? bku.filter((r) => checkedIds.has(r.id)) : selectedRow ? [selectedRow] : [];

  const handlePrint = async () => {
    if (!printItems.length) {
      onToast('Pilih transaksi BKU yang akan dicetak.', true);
      return;
    }
    if (activeDoc === 'kwitansi') {
      triggerGooglePrint({
        pageCss: `@page{size:${activeSize.widthMm}mm ${activeSize.heightMm}mm;margin:0}`,
        bodyClass: 'printing-kwitansi',
        targetRoot: document.getElementById('kw-print-root') || document.body,
      });
      return;
    }
    setPrintBundleMode(false);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await printDomElement(spjPrintSourceRef.current, SPJ_A4_PRINT_OPTIONS);
  };

  const handlePrintBundleSpj = async () => {
    if (!printItems.length) {
      onToast('Pilih transaksi BKU yang akan dicetak.', true);
      return;
    }
    setPrintBundleMode(true);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await printDomElement(spjPrintSourceRef.current, {
      ...SPJ_A4_PRINT_OPTIONS,
      onCleanup: () => setPrintBundleMode(false),
    });
  };

  const selectedIndex = selectedRow ? bku.findIndex((r) => r.id === selectedRow.id) : -1;
  const computedSelected = selectedRow ? getComputedRowValues(selectedRow, selectedIndex) : null;
  const computedSpjSelected = selectedRow
    ? computeSpjValues(selectedRow, selectedIndex, state.edits[selectedRow.id], state.settings, config)
    : null;
  const allowedTabs = computedSpjSelected
    ? getAllowedDocTabs(computedSpjSelected.kategori)
    : SPJ_DOC_TABS;
  const activeTabMeta = allowedTabs.find((t) => t.id === activeDoc) || allowedTabs[0];

  useEffect(() => {
    if (!computedSpjSelected) return;
    const allowed = getAllowedDocTabs(computedSpjSelected.kategori);
    if (!allowed.some((t) => t.id === activeDoc)) {
      setActiveDoc(computedSpjSelected.kategori === 'barang_jasa' ? 'nota_pesanan' : 'tanda_terima_honor');
    }
  }, [computedSpjSelected?.kategori, activeDoc]);

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">Laporan Keuangan &amp; SPJ BKU BOS</h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Import BKU (Excel/CSV/PDF), kelola Kwitansi &amp; SPJ A4, serta Buku Pembantu Pajak otomatis (PPN, PPh Ps. 21/22/23).
          </p>
        </div>

        {hasData && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#566A6E]">
              {state.fileName || 'Data BKU'} &middot; {bku.length} transaksi &middot; {bkuTaxTotals.taxableCount} kena pajak
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#D3DDD9] text-[#13262A] cursor-pointer hover:bg-gray-50"
            >
              Ganti BKU
            </button>
            <button
              type="button"
              onClick={handleClearData}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#D3DDD9] text-rose-700 cursor-pointer hover:bg-rose-50"
            >
              {confirmClear ? 'Klik lagi untuk hapus' : 'Hapus'}
            </button>
          </div>
        )}
      </div>

      {/* Sub-Navigation Menu Bar Inside Laporan Keuangan */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#D3DDD9] rounded-xl p-1.5">
        <button
          type="button"
          onClick={() => setActiveMenu('spj')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeMenu === 'spj'
              ? 'bg-[#0B6B58] text-white shadow-xs'
              : 'text-[#566A6E] hover:text-[#13262A] hover:bg-[#F4F7F5]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Kwitansi &amp; SPJ BKU</span>
          {bku.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                activeMenu === 'spj' ? 'bg-white/20 text-white' : 'bg-[#E8EFEC] text-[#0B6B58]'
              }`}
            >
              {bku.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMenu('import_bku')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeMenu === 'import_bku'
              ? 'bg-[#0B6B58] text-white shadow-xs'
              : 'text-[#566A6E] hover:text-[#13262A] hover:bg-[#F4F7F5]'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Import BKU</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMenu('buku_pajak')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeMenu === 'buku_pajak'
              ? 'bg-[#0B6B58] text-white shadow-xs'
              : 'text-[#566A6E] hover:text-[#13262A] hover:bg-[#F4F7F5]'
          }`}
        >
          <ReceiptText className="w-3.5 h-3.5" />
          <span>Buku Pembantu Pajak</span>
          {bkuTaxTotals.totalPajak > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                activeMenu === 'buku_pajak' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {bkuTaxTotals.taxableCount}
            </span>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv,.tsv,.txt,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFileUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* MENU 3: BUKU PEMBANTU PAJAK */}
      {activeMenu === 'buku_pajak' && (
        <BukuPembantuPajak
          config={config}
          state={state}
          onUpdateRowEdit={updateRowEdit}
          onPatchAllEdits={handlePatchAllEdits}
          onUpdateSettings={updateSettings}
          onOpenInSpj={(rowId) => {
            setSelectedId(rowId);
            setActiveDoc('model_a2');
            setActiveMenu('spj');
          }}
          onGoToImport={() => setActiveMenu('import_bku')}
          onToast={onToast}
        />
      )}

      {/* MENU 2: IMPORT BKU */}
      {activeMenu === 'import_bku' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileUpload(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`lg:col-span-2 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                isDragging ? 'border-[#0B6B58] bg-[#E8EFEC]' : 'border-[#D3DDD9] bg-white hover:border-[#0B6B58]'
              }`}
            >
              <Upload className="w-9 h-9 mx-auto text-[#0B6B58]" />
              <h3 className="font-bold text-sm text-[#13262A] mt-2">
                {hasData ? 'Ganti / Import Ulang Buku Kas Umum (BKU)' : 'Import Buku Kas Umum (BKU)'}
              </h3>
              <p className="text-xs text-[#566A6E] mt-1">
                Klik atau seret file <b>.xlsx / .xlsm / .csv / .pdf</b> (ARKAS BOSP) ke sini
              </p>
              <p className="text-[11px] text-[#566A6E] mt-2">
                Kolom dibaca otomatis: <b>Tanggal</b> &middot; <b>Kode Rekening</b> &middot; <b>No. Bukti</b> &middot; <b>Uraian</b> &middot; <b>Pengeluaran</b> &rarr; Potong Pajak Otomatis di Buku Pembantu Pajak
              </p>
            </div>

            <div className="bg-white border border-[#D3DDD9] rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-[#13262A]">Ringkasan Data BKU</div>
                <div className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#566A6E]">Sumber File</span>
                    <span className="font-semibold text-[#13262A] truncate max-w-[160px]">{state.fileName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#566A6E]">Total Transaksi</span>
                    <span className="font-bold font-mono text-[#13262A]">{bku.length} baris</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#566A6E]">Belanja Bruto</span>
                    <span className="font-bold font-mono text-[#13262A]">{formatRupiah(bkuTaxTotals.totalBruto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#566A6E]">Potong Pajak Otomatis</span>
                    <span className="font-bold font-mono text-amber-700">{formatRupiah(bkuTaxTotals.totalPajak)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#E4EBE8] pt-1.5">
                    <span className="text-[#566A6E]">Netto Dibayarkan</span>
                    <span className="font-bold font-mono text-[#0B6B58]">{formatRupiah(bkuTaxTotals.totalNetto)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualForm((v) => !v)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#0B6B58] text-[#0B6B58] hover:bg-emerald-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Manual
                </button>
                {hasData && (
                  <button
                    type="button"
                    onClick={() => setActiveMenu('buku_pajak')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0B6B58] text-white hover:bg-[#095747] cursor-pointer"
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    Buku Pajak
                  </button>
                )}
              </div>
            </div>
          </div>

          {showManualForm && (
            <form
              onSubmit={handleAddManualBku}
              className="bg-white border border-[#D3DDD9] rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end text-xs"
            >
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal</label>
                <input
                  type="date"
                  value={manualTgl}
                  onChange={(e) => setManualTgl(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">No. Bukti</label>
                <input
                  value={manualNoBukti}
                  onChange={(e) => setManualNoBukti(e.target.value)}
                  placeholder="BPU01 / Kwitansi"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kode Rekening</label>
                <input
                  value={manualKodeRek}
                  onChange={(e) => setManualKodeRek(e.target.value)}
                  placeholder="5.1.02.01.0001"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Uraian Transaksi</label>
                <input
                  value={manualUraian}
                  onChange={(e) => setManualUraian(e.target.value)}
                  placeholder="Contoh: Belanja ATK / Honor Pelatih / Konsumsi Rapat..."
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Pengeluaran (Rp)</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={manualPengeluaran}
                    onChange={(e) => setManualPengeluaran(e.target.value)}
                    placeholder="2500000"
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#0B6B58] text-white font-semibold rounded-lg hover:bg-[#095747] cursor-pointer whitespace-nowrap"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </form>
          )}

          {hasData && (
            <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#D3DDD9] flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#13262A]">
                  Daftar Transaksi BKU Terimport ({filteredBku.length} dari {bku.length} baris)
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#566A6E]" />
                  <input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari uraian, kode rek, bukti..."
                    className="w-full pl-8 pr-3 py-1 text-xs border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F4F7F5] border-b border-[#D3DDD9] text-[11px] text-[#13262A]">
                      <th className="px-3 py-2 text-left font-bold">No</th>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Tanggal</th>
                      <th className="px-3 py-2 text-left font-bold whitespace-nowrap">No. Bukti</th>
                      <th className="px-3 py-2 text-left font-bold">Uraian</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Bruto BKU</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Potong Pajak</th>
                      <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Netto</th>
                      <th className="px-3 py-2 text-center font-bold whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEFED]">
                    {filteredBku.map((r, idx) => {
                      const edit = state.edits[r.id];
                      const tax = resolveBkuTax(r, edit, state.settings);
                      const rowTaxTotal = tax.ppn + tax.pph;
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/80">
                          <td className="px-3 py-2 text-[#566A6E] font-mono">{idx + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.tgl ? formatTglIndo(r.tgl) : '-'}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{r.noBukti || '-'}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-[#13262A]">{r.uraian}</div>
                            {r.kodeRek && (
                              <span className="text-[10px] font-mono text-[#566A6E]">Rek: {r.kodeRek}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[#13262A] whitespace-nowrap">
                            {formatRupiah(r.pengeluaran)}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {rowTaxTotal > 0 ? (
                              <div>
                                <div className="font-mono font-semibold text-amber-800">{formatRupiah(rowTaxTotal)}</div>
                                <div className="text-[10px] text-[#566A6E]">{tax.skemaLabel}</div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#8EA09B]">Bebas</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-[#0B6B58] whitespace-nowrap">
                            {formatRupiah(tax.netto)}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(r.id);
                                  setActiveMenu('spj');
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#D3DDD9] text-[11px] font-semibold text-[#0B6B58] hover:bg-emerald-50 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                SPJ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBkuRow(r.id)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                                  confirmDeleteRowId === r.id
                                    ? 'border-rose-500 bg-rose-600 text-white'
                                    : 'border-[#D3DDD9] text-rose-700 hover:bg-rose-50'
                                }`}
                                title="Hapus baris BKU"
                              >
                                <Trash2 className="w-3 h-3" />
                                {confirmDeleteRowId === r.id ? 'Yakin?' : ''}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MENU 1: KWITANSI & SPJ BKU - Upload Box if Empty */}
      {activeMenu === 'spj' && !hasData && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileUpload(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
            isDragging ? 'border-[#0B6B58] bg-[#E8EFEC]' : 'border-[#D3DDD9] bg-white hover:border-[#0B6B58]'
          }`}
        >
          <Upload className="w-10 h-10 mx-auto text-[#0B6B58]" />
          <h3 className="font-bold text-sm text-[#13262A] mt-2">Import Buku Kas Umum (BKU)</h3>
          <p className="text-xs text-[#566A6E] mt-1">Klik atau seret file .xlsx / .csv / .pdf ke sini</p>
          <p className="text-[11px] text-[#566A6E] mt-3">
            Kolom yang otomatis dibaca: <b>Tanggal</b> &middot; <b>No. Bukti</b> &middot; <b>Uraian</b> &middot; <b>Pengeluaran</b>
          </p>
        </div>
      )}

      {/* MENU 1: Main Content Layout */}
      {activeMenu === 'spj' && hasData && selectedRow && computedSelected && (
        <div className="kw-layout">
          {/* Left: Transaction list */}
          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden self-start">
            <div className="p-3 border-b border-[#D3DDD9] space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#566A6E]" />
                <input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Cari uraian atau no. bukti..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white focus:outline-none focus:border-[#0B6B58]"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] font-semibold text-[#566A6E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={toggleSelectAll}
                  className="accent-[#0B6B58]"
                />
                Pilih semua ({filteredBku.length})
              </label>
            </div>

            <div className="kw-list divide-y divide-gray-100">
              {filteredBku.map((r) => {
                const kat = state.edits[r.id]?.kategoriSpj ?? detectSpjKategori(state.edits[r.id]?.untuk ?? r.uraian, state.edits[r.id]?.kodeRek ?? r.kodeRek);
                const katMeta = SPJ_KATEGORI_META[kat];
                const tax = resolveBkuTax(r, state.edits[r.id], state.settings);
                const rowTaxTotal = tax.ppn + tax.pph;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`flex gap-2.5 px-3 py-2.5 cursor-pointer transition ${
                      r.id === selectedId ? 'bg-[#E8EFEC]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleCheck(r.id)}
                      className="mt-0.5 accent-[#0B6B58]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-[#566A6E]">
                        {r.tgl ? formatTglIndo(r.tgl) : 'Tanpa tanggal'}
                        {r.noBukti ? ` \xB7 ${r.noBukti}` : ''}
                      </div>
                      <div className="text-xs font-semibold text-[#13262A] leading-snug line-clamp-2">
                        {r.uraian}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-xs font-mono font-bold text-[#0B6B58]">
                          {formatRupiah(r.pengeluaran)}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${katMeta.badgeCls}`}>
                          {katMeta.shortLabel}
                        </span>
                      </div>
                      {rowTaxTotal > 0 && (
                        <div className="text-[10px] text-amber-800 font-medium mt-0.5">
                          Potong Pajak ({tax.skemaLabel}): {formatRupiah(rowTaxTotal)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredBku.length === 0 && (
                <div className="p-6 text-center text-xs text-[#566A6E]">Tidak ada hasil.</div>
              )}
            </div>
          </div>

          {/* Right: Live Preview & Editor */}
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-4 min-w-0">
            {/* Document Type Switcher Bar (Filtered by Transaction Category) */}
            <div className="flex items-center gap-1.5 flex-wrap pb-3 mb-3 border-b border-[#E4EBE8]">
              {allowedTabs.map((tab) => {
                const isActive = activeDoc === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDoc(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0B6B58] border-[#0B6B58] text-white shadow-xs'
                        : 'bg-[#F8FAF9] border-[#D3DDD9] text-[#566A6E] hover:bg-white hover:text-[#13262A]'
                    }`}
                  >
                    {DOC_ICON_MAP[tab.id]}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              {computedSpjSelected && (
                <span
                  className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                    SPJ_KATEGORI_META[computedSpjSelected.kategori].badgeCls
                  }`}
                >
                  {SPJ_KATEGORI_META[computedSpjSelected.kategori].label}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-[#13262A]">
                  {activeTabMeta.label} &middot; {selectedIndex + 1} dari {bku.length}
                </span>
                <span className="text-[11px] font-medium text-[#566A6E] bg-[#F1F4F2] px-2 py-0.5 rounded-md whitespace-nowrap">
                  {isKwitansiDoc ? activeSize.mmLabel : activeTabMeta.paperLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isKwitansiDoc && (
                  <button
                    type="button"
                    onClick={handlePrintBundleSpj}
                    title={
                      computedSpjSelected
                        ? SPJ_KATEGORI_META[computedSpjSelected.kategori].desc
                        : 'Cetak seluruh dokumen SPJ A4 sesuai kategori transaksi'
                    }
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-[#0B6B58] text-[#0B6B58] hover:bg-emerald-50 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Cetak Paket SPJ A4
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white cursor-pointer shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {checkedIds.size > 0
                    ? `Cetak ${checkedIds.size} terpilih`
                    : `Cetak ${activeTabMeta.shortLabel} Ini`}
                </button>
              </div>
            </div>

            {/* Pengaturan Ukuran, Warna & Gambar Preview / Print (khusus Kwitansi BOS) */}
            {isKwitansiDoc && (
              <div className="mb-3 p-3 rounded-xl bg-[#F8FAF9] border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Pilihan Ukuran */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#566A6E]">Ukuran:</span>
                  <div className="inline-flex rounded-lg border border-[#D3DDD9] bg-white p-0.5">
                    {(Object.keys(KWITANSI_SIZES) as KwitansiSizeKey[]).map((key) => {
                      const spec = KWITANSI_SIZES[key];
                      const active = sizeKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateSettings({ ukuranKwitansi: key })}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#0B6B58] text-white shadow-xs'
                              : 'text-[#566A6E] hover:text-[#13262A]'
                          }`}
                        >
                          {spec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pilihan Warna Kwitansi */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-[#566A6E] flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-[#0B6B58]" />
                    Warna:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(Object.keys(KWITANSI_COLORS) as KwitansiColorKey[]).map((key) => {
                      const p = KWITANSI_COLORS[key];
                      const active = colorKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          title={p.label}
                          onClick={() => updateSettings({ warnaKwitansi: key })}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-white border-[#0B6B58] text-[#13262A] ring-1 ring-[#0B6B58]/30 shadow-xs'
                              : 'bg-white/70 border-[#D3DDD9] text-[#566A6E] hover:bg-white'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: p.swatch }}
                          />
                          <span>{p.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggle Gambar di Preview & Saat Print */}
                <div className="flex items-center gap-2 flex-wrap w-full pt-2 border-t border-[#E4EBE8]">
                  <span className="text-[11px] font-semibold text-[#566A6E]">Gambar Kwitansi:</span>
                  <button
                    type="button"
                    onClick={() => updateSettings({ previewGambar: !showPreviewArt })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                      showPreviewArt
                        ? 'bg-emerald-50 border-[#0B6B58]/40 text-[#0B6B58]'
                        : 'bg-white border-[#D3DDD9] text-[#566A6E]'
                    }`}
                  >
                    {showPreviewArt ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    Preview: {showPreviewArt ? 'Dengan Gambar' : 'Tanpa Gambar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSettings({ printGambar: !showPrintArt })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                      showPrintArt
                        ? 'bg-emerald-50 border-[#0B6B58]/40 text-[#0B6B58]'
                        : 'bg-white border-[#D3DDD9] text-[#566A6E]'
                    }`}
                  >
                    {showPrintArt ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    Saat Print: {showPrintArt ? 'Ikut Gambar' : 'Tanpa Gambar (Blangko)'}
                  </button>

                  <span className="text-[11px] text-[#566A6E] ml-auto">
                    {showPrintArt
                      ? 'Cetak penuh dengan gambar & warna latar (kertas polos).'
                      : 'Print hanya mencetak teks & kolom (gambar hanya tampil di preview).'}
                  </span>
                </div>
              </div>
            )}

            {/* Scaled Sheet Container */}
            <div ref={previewContainerRef} className="w-full bg-[#F1F4F2] rounded-lg overflow-hidden p-2 border border-[#E2E8E5]">
              {isKwitansiDoc ? (
                <div
                  className="shadow-sm"
                  style={{ width: naturalWidth * previewScale, height: naturalHeight * previewScale, margin: '0 auto' }}
                >
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: naturalWidth }}>
                    <KwitansiView
                      config={config}
                      settings={state.settings}
                      row={selectedRow}
                      v={computedSelected}
                      sizeKey={sizeKey}
                      colorKey={colorKey}
                      showArt={showPreviewArt}
                    />
                  </div>
                </div>
              ) : (
                computedSpjSelected && (
                  <div
                    className="shadow-sm bg-white"
                    style={{
                      width: naturalWidth * previewScale,
                      minHeight: naturalHeight * previewScale,
                      margin: '0 auto',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        zoom: previewScale,
                        width: naturalWidth,
                      }}
                    >
                      <SpjDocSheet
                        docType={activeDoc}
                        config={config}
                        settings={state.settings}
                        row={selectedRow}
                        v={computedSpjSelected}
                      />
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Unified BKU-Connected Form Inputs */}
            {computedSpjSelected && (
              <SpjDocEditor
                docType={activeDoc}
                row={selectedRow}
                v={computedSpjSelected}
                edit={state.edits[selectedRow.id] || {}}
                onPatch={(patch) => updateRowEdit(selectedRow.id, patch)}
                onToast={onToast}
              />
            )}

            {/* Collapsible Global Settings */}
            <details className="mt-4 text-xs">
              <summary className="font-semibold text-[#0B6B58] cursor-pointer">
                Pengaturan Bendahara, Pemda &amp; Sumber Dana
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 p-3 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nama Bendahara</label>
                  <input
                    value={state.settings.bendaharaNama}
                    onChange={(e) => updateSettings({ bendaharaNama: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NIP Bendahara</label>
                  <input
                    value={state.settings.bendaharaNip}
                    onChange={(e) => updateSettings({ bendaharaNip: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Sumber Dana</label>
                  <input
                    value={state.settings.sumberDana}
                    onChange={(e) => updateSettings({ sumberDana: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kota / Tempat Surat</label>
                  <input
                    value={state.settings.kota}
                    onChange={(e) => updateSettings({ kota: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Prefix Penomoran SPJ</label>
                  <input
                    value={state.settings.prefix}
                    onChange={(e) => updateSettings({ prefix: e.target.value })}
                    placeholder="BOSP"
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tahun Anggaran (Opsional)</label>
                  <input
                    value={state.settings.tahunAnggaran ?? ''}
                    onChange={(e) => updateSettings({ tahunAnggaran: e.target.value })}
                    placeholder="Otomatis dari tanggal BKU"
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Hidden offscreen A4 SPJ print source cloned by printDomElement */}
      <div className="hidden" aria-hidden="true">
        <div ref={spjPrintSourceRef}>
          {(printBundleMode || activeDoc !== 'kwitansi') &&
            printItems.flatMap((r) => {
              const idx = bku.findIndex((item) => item.id === r.id);
              const v = computeSpjValues(r, idx, state.edits[r.id], state.settings, config);
              const docsToRender: Exclude<SpjDocType, 'kwitansi'>[] = printBundleMode
                ? getBundleDocsForKategori(v.kategori)
                : v.kategori !== 'barang_jasa' && (activeDoc === 'nota_pesanan' || activeDoc === 'bast' || activeDoc === 'invoice')
                  ? []
                  : activeDoc === 'kwitansi'
                    ? []
                    : [activeDoc];
              return docsToRender.map((doc) => (
                <SpjDocSheet
                  key={`${r.id}-${doc}`}
                  docType={doc}
                  config={config}
                  settings={state.settings}
                  row={r}
                  v={v}
                />
              ));
            })}
        </div>
      </div>

      {/* Kwitansi Printing Portal */}
      {createPortal(
        <div id="kw-print-root">
          {printItems.map((r) => (
            <KwitansiView
              key={r.id}
              config={config}
              settings={state.settings}
              row={r}
              v={getComputedRowValues(r, bku.findIndex((item) => item.id === r.id))}
              sizeKey={sizeKey}
              colorKey={colorKey}
              showArt={showPrintArt}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
