/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Aset, BmdItem } from '../types';

export interface ParsedSikatonRow {
  no?: number;
  npsn?: string;
  kodeSkpd?: string;
  namaSekolah?: string;
  kodeBarang: string;
  idBarang: string;
  namaBarang: string;
  merkType?: string;
  sumberDana?: string;
  tahunPerolehan?: number;
  jumlah: number;
  harga?: number;
  kondisi: 'Baik' | 'Rusak ringan' | 'Rusak berat';
  lokasi?: string;
  kategori: string;
  keterangan?: string;
}

export interface SikatonWorkbookSheet {
  name: string;
  rows: any[][];
  parsedCount: number;
}

export interface SikatonParseResult {
  sheetName: string;
  availableSheets: string[];
  totalRowsFound: number;
  detectedSkpd?: string;
  detectedSekolah?: string;
  detectedNpsn?: string;
  items: ParsedSikatonRow[];
}

// --- ZIP & XML decompressor untuk berkas Excel (.xlsx) tanpa library pihak ketiga ---

function readZipEntries(bytes: Uint8Array): Map<string, { method: number; csize: number; off: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Berkas bukan format .xlsx yang valid.');
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
  if (!ds) throw new Error('Browser ini belum mendukung dekompresi file .xlsx (DecompressionStream).');
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

export async function parseXlsxToSheets(buffer: ArrayBuffer): Promise<{ name: string; rows: any[][] }[]> {
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

// --- CSV / TSV Text Parser ---

export function parseDelimitedTextToRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const sample = clean.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8).join('\n');
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
        row.push(cur.trim());
        cur = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && clean[i + 1] === '\n') i++;
        row.push(cur.trim());
        cur = '';
        rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
  }
  if (cur !== '' || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

// --- Helpers pembersihan data & penentuan KIB ---

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseNumberFlexible(val: any): number {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  let str = cleanStr(val);
  if (!str) return 0;
  str = str.replace(/[^0-9.,-]/g, '');
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
  return isNaN(num) ? 0 : num;
}

function parseYearFlexible(val: any): number {
  if (typeof val === 'number') {
    if (val >= 1950 && val <= 2100) return Math.floor(val);
    if (val > 20000 && val < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(val) * 86400000);
      return d.getUTCFullYear();
    }
  }
  const str = cleanStr(val);
  const m = /\b(19\d{2}|20\d{2})\b/.exec(str);
  if (m) return parseInt(m[1], 10);
  return new Date().getFullYear();
}

function normalizeKondisi(val: any): 'Baik' | 'Rusak ringan' | 'Rusak berat' {
  const str = cleanStr(val).toLowerCase();
  if (str.includes('berat') || str === 'rb') return 'Rusak berat';
  if (str.includes('ringan') || str === 'rr') return 'Rusak ringan';
  return 'Baik';
}

export function detectKibCategory(kode: string, namaBarang = ''): string {
  const clean = kode.replace(/\s+/g, '');
  const lower = namaBarang.toLowerCase();

  if (/^(1\.3\.1|01\b)/.test(clean) || lower.includes('tanah') || lower.includes('lahan')) {
    return 'KIB A - Tanah';
  }
  if (/^(1\.3\.2|02\b)/.test(clean)) {
    return 'KIB B - Peralatan dan Mesin';
  }
  if (/^(1\.3\.3|03\b)/.test(clean) || lower.includes('gedung') || lower.includes('bangunan') || lower.includes('ruang kelas')) {
    return 'KIB C - Gedung dan Bangunan';
  }
  if (/^(1\.3\.4|04\b)/.test(clean) || lower.includes('jalan') || lower.includes('irigasi') || lower.includes('jaringan')) {
    return 'KIB D - Jalan, Irigasi, dan Jaringan';
  }
  if (/^(1\.3\.5|05\b)/.test(clean) || lower.includes('buku') || lower.includes('hewan') || lower.includes('tanaman')) {
    return 'KIB E - Aset Tetap Lainnya';
  }
  return 'KIB B - Peralatan dan Mesin';
}

// --- Deteksi Kolom & Header SIKATON ---

interface ColumnIndexes {
  no?: number;
  npsn?: number;
  kodeSkpd?: number;
  namaSekolah?: number;
  kodeBarang?: number;
  idBarang?: number;
  kdDanId?: number;
  namaBarang?: number;
  merkType?: number;
  sumberDana?: number;
  tahunPerolehan?: number;
  jumlah?: number;
  harga?: number;
  kondisi?: number;
  lokasi?: number;
  keterangan?: number;
}

function findHeaderRow(rows: any[][]): { headerRowIndex: number; mapping: ColumnIndexes } | null {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const texts = row.map((cell) => cleanStr(cell).toLowerCase());

    const hasKode = texts.some((t) => t.includes('kode barang') || t.includes('kd barang') || t === 'kode');
    const hasNama = texts.some((t) => t.includes('nama barang') || t.includes('uraian barang') || t === 'nama / jenis barang' || t === 'jenis barang');

    if (hasKode || hasNama) {
      const m: ColumnIndexes = {};
      texts.forEach((txt, idx) => {
        if (!txt) return;
        if (/^(no|no\.|nomor)$/.test(txt)) m.no = idx;
        else if (txt.includes('npsn')) m.npsn = idx;
        else if (txt.includes('kode skpd') || txt.includes('skpd')) m.kodeSkpd = idx;
        else if (txt.includes('nama sekolah') || txt.includes('unit kerja') || txt.includes('nama unit')) m.namaSekolah = idx;
        else if (txt.includes('kode barang') || txt.includes('kd barang') || txt === 'kode') m.kodeBarang = idx;
        else if (txt.includes('id barang') || txt.includes('no register') || txt.includes('register') || txt === 'id' || txt === 'no reg') m.idBarang = idx;
        else if (txt.includes('kd & id') || txt.includes('kode & id') || txt.includes('kode dan id')) m.kdDanId = idx;
        else if (txt.includes('nama barang') || txt.includes('uraian barang') || txt.includes('nama / jenis barang') || txt === 'nama barang') m.namaBarang = idx;
        else if (txt.includes('merk') || txt.includes('type') || txt.includes('tipe') || txt.includes('spesifikasi') || txt.includes('model')) m.merkType = idx;
        else if (txt.includes('sumber') || txt.includes('asal usul') || txt.includes('dana')) m.sumberDana = idx;
        else if (txt.includes('tahun') || txt.includes('thn') || txt.includes('perolehan')) m.tahunPerolehan = idx;
        else if (txt.includes('jumlah') || txt.includes('kuantitas') || txt.includes('unit') || txt.includes('vol') || txt.includes('banyak')) m.jumlah = idx;
        else if (txt.includes('harga') || txt.includes('nilai') || txt.includes('satuan')) m.harga = idx;
        else if (txt.includes('kondisi') || txt.includes('keadaan')) m.kondisi = idx;
        else if (txt.includes('lokasi') || txt.includes('ruang')) m.lokasi = idx;
        else if (txt.includes('keterangan') || txt.includes('ket')) m.keterangan = idx;
      });

      if (m.namaBarang !== undefined || m.kodeBarang !== undefined) {
        return { headerRowIndex: r, mapping: m };
      }
    }
  }
  return null;
}

/**
 * Parsing lembar data SIKATON dari baris-baris matriks (baik dari XLSX maupun CSV).
 */
export function parseSikatonRows(rows: any[][], sheetName = ''): SikatonParseResult {
  if (!rows || !rows.length) {
    return { sheetName, availableSheets: [], totalRowsFound: 0, items: [] };
  }

  let headerInfo = findHeaderRow(rows);
  let startIdx = 0;
  let map: ColumnIndexes = {};

  if (headerInfo) {
    startIdx = headerInfo.headerRowIndex + 1;
    map = headerInfo.mapping;
  } else {
    // Cek kemungkinan data mentah tanpa header: format DATA_BMD (>=10 kolom) atau 5 kolom
    const sample = rows.find((r) => r && r.length >= 5 && cleanStr(r[0]));
    if (sample && sample.length >= 10) {
      map = {
        no: 0,
        npsn: 1,
        kodeSkpd: 2,
        namaSekolah: 3,
        kodeBarang: 4,
        idBarang: 5,
        kdDanId: 6,
        namaBarang: 7,
        merkType: 8,
        sumberDana: 9,
      };
      startIdx = 0;
    } else if (sample && sample.length >= 5) {
      map = {
        kodeBarang: 0,
        idBarang: 1,
        namaBarang: 2,
        merkType: 3,
        sumberDana: 4,
      };
      startIdx = 0;
    }
  }

  const items: ParsedSikatonRow[] = [];
  let detectedSkpd = '';
  let detectedSekolah = '';
  let detectedNpsn = '';

  for (let r = startIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    let kode = cleanStr(map.kodeBarang !== undefined ? row[map.kodeBarang] : '');
    let id = cleanStr(map.idBarang !== undefined ? row[map.idBarang] : '');
    let nama = cleanStr(map.namaBarang !== undefined ? row[map.namaBarang] : '');
    let merk = cleanStr(map.merkType !== undefined ? row[map.merkType] : '');
    let sumber = cleanStr(map.sumberDana !== undefined ? row[map.sumberDana] : '');
    const skpd = cleanStr(map.kodeSkpd !== undefined ? row[map.kodeSkpd] : '');
    const sekolah = cleanStr(map.namaSekolah !== undefined ? row[map.namaSekolah] : '');
    const npsn = cleanStr(map.npsn !== undefined ? row[map.npsn] : '');
    const lokasi = cleanStr(map.lokasi !== undefined ? row[map.lokasi] : '');
    const keterangan = cleanStr(map.keterangan !== undefined ? row[map.keterangan] : '');

    if (skpd && !detectedSkpd) detectedSkpd = skpd;
    if (sekolah && !detectedSekolah) detectedSekolah = sekolah;
    if (npsn && !detectedNpsn) detectedNpsn = npsn;

    // Jika kolom KD & ID tersedia dan kode atau id kosong, coba pecah
    if ((!kode || !id) && map.kdDanId !== undefined) {
      const combined = cleanStr(row[map.kdDanId]);
      if (combined.includes('/') || combined.includes(' - ')) {
        const parts = combined.split(/\/|\s-\s/);
        if (!kode) kode = parts[0]?.trim() || '';
        if (!id) id = parts[1]?.trim() || '';
      }
    }

    // Lewati baris header berulang, total, atau baris kosong
    if (!nama && !kode) continue;
    if (/^(no|kode|uraian|jumlah|total|sub total|subtotal)\b/i.test(kode)) continue;
    if (/^(total|sub total|subtotal|jumlah total|rekapitulasi)\b/i.test(nama)) continue;

    // Jika nama ada tapi kode kosong, generate kode default
    if (!kode && nama) kode = '1.3.2.05.01';
    if (!id) id = String(items.length + 1).padStart(4, '0');

    const jumlah = map.jumlah !== undefined ? Math.max(1, Math.round(parseNumberFlexible(row[map.jumlah]))) : 1;
    const harga = map.harga !== undefined ? parseNumberFlexible(row[map.harga]) : 0;
    const tahunPerolehan = map.tahunPerolehan !== undefined ? parseYearFlexible(row[map.tahunPerolehan]) : new Date().getFullYear();
    const kondisi = map.kondisi !== undefined ? normalizeKondisi(row[map.kondisi]) : 'Baik';
    const kategori = detectKibCategory(kode, nama);

    items.push({
      no: items.length + 1,
      npsn: npsn || detectedNpsn || undefined,
      kodeSkpd: skpd || detectedSkpd || undefined,
      namaSekolah: sekolah || detectedSekolah || undefined,
      kodeBarang: kode,
      idBarang: id,
      namaBarang: nama,
      merkType: merk || undefined,
      sumberDana: sumber || 'BOS',
      tahunPerolehan,
      jumlah: jumlah || 1,
      harga: harga || 0,
      kondisi,
      lokasi: lokasi || 'Ruang Inventaris',
      kategori,
      keterangan: keterangan || undefined,
    });
  }

  return {
    sheetName,
    availableSheets: [sheetName],
    totalRowsFound: items.length,
    detectedSkpd,
    detectedSekolah,
    detectedNpsn,
    items,
  };
}

/**
 * Membaca berkas (ArrayBuffer / File / string) dan memilih sheet yang paling relevan.
 */
export async function parseSikatonFile(
  file: File
): Promise<{ result: SikatonParseResult; sheets: SikatonWorkbookSheet[] }> {
  const isXlsx = /\.xlsx?$/i.test(file.name);

  if (isXlsx) {
    const buffer = await file.arrayBuffer();
    const rawSheets = await parseXlsxToSheets(buffer);
    if (!rawSheets.length) {
      throw new Error('Berkas Excel kosong atau tidak memiliki lembar kerja (worksheet).');
    }

    const sheets: SikatonWorkbookSheet[] = rawSheets.map((s) => {
      const p = parseSikatonRows(s.rows, s.name);
      return {
        name: s.name,
        rows: s.rows,
        parsedCount: p.totalRowsFound,
      };
    });

    // Cari sheet terbaik: yang punya nama 'DATA_BMD', 'BMD', 'SIKATON', 'ASET', atau yang parsedCount paling banyak
    let best = sheets.find((s) => /data_?bmd|sikaton|aset|bmd/i.test(s.name) && s.parsedCount > 0);
    if (!best) {
      best = [...sheets].sort((a, b) => b.parsedCount - a.parsedCount)[0];
    }
    const chosenSheet = best || sheets[0];
    const parsed = parseSikatonRows(chosenSheet.rows, chosenSheet.name);
    parsed.availableSheets = sheets.map((s) => s.name);

    return { result: parsed, sheets };
  } else {
    // CSV / TSV
    const text = await file.text();
    const rows = parseDelimitedTextToRows(text);
    const parsed = parseSikatonRows(rows, file.name);
    return {
      result: parsed,
      sheets: [{ name: file.name, rows, parsedCount: parsed.totalRowsFound }],
    };
  }
}

/**
 * Konversi ParsedSikatonRow ke Aset[]
 */
export function convertToAsets(items: ParsedSikatonRow[]): Aset[] {
  const now = Date.now();
  return items.map((it, idx) => ({
    id: `ast_skt_${now}_${idx}`,
    nama: it.namaBarang,
    kode: it.kodeBarang,
    noRegister: it.idBarang,
    merk: it.merkType,
    kategori: it.kategori,
    jumlah: it.jumlah || 1,
    kondisi: it.kondisi,
    lokasi: it.lokasi || 'Ruang Inventaris',
    tahunPerolehan: it.tahunPerolehan || new Date().getFullYear(),
    sumber: it.sumberDana || 'BOS',
    harga: it.harga || 0,
    keterangan: it.keterangan || (it.idBarang ? `ID SIKATON: ${it.idBarang}` : undefined),
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Konversi ParsedSikatonRow ke BmdItem[]
 */
export function convertToBmdItems(items: ParsedSikatonRow[]): BmdItem[] {
  const now = Date.now();
  return items.map((it, idx) => ({
    id: `bmd_skt_${now}_${idx}`,
    kodeBarang: it.kodeBarang,
    idBarang: it.idBarang,
    namaBarang: it.namaBarang,
    merkType: it.merkType || '',
    sumberDana: it.sumberDana || 'BOS Reguler',
    createdAt: now,
    updatedAt: now,
  }));
}
