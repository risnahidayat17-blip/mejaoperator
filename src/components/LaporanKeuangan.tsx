/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SchoolConfig, KeuanganState } from '../types';
import { getKeuangan, saveKeuangan, subscribeToStorage } from '../lib/storage';
import {
  Upload,
  Printer,
  Search,
} from 'lucide-react';

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
    });
  }
  return records;
}

async function parseBkuFile(file: File) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xls')) {
    throw new Error('Format .xls lama belum didukung. Simpan ulang BKU sebagai .xlsx atau .csv.');
  }

  let sheetsRows: any[][][];
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
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

// Single Kwitansi Preview Component
const KwitansiView: React.FC<{
  config: SchoolConfig;
  settings: KeuanganState['settings'];
  row: KeuanganState['bku'][0];
  v: { noKw: string; tgl: string; penerima: string; untuk: string };
}> = ({ config, settings, row, v }) => {
  const logos = [config.logoPemda || config.logo, config.logoSekolah].filter(Boolean);
  const logoWidth = logos.length * 15;
  const formattedAmt = Math.round(row.pengeluaran).toLocaleString('id-ID');
  const needsMaterai = row.pengeluaran >= 5000000;

  return (
    <div className="kw-sheet">
      <div className="kw-frame">
        {/* Kop */}
        <div className="kw-kop">
          <div className="kw-side" style={{ width: `${logoWidth}mm` }}>
            {logos.map((src, i) => (
              <img key={i} src={src} alt="" className="kw-logo" />
            ))}
          </div>
          <div className="kw-kop-text">
            <div className="kw-k1">{config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}</div>
            <div className="kw-k1">{config.kopInduk2 || 'DINAS PENDIDIKAN'}</div>
            <div className="kw-k2">{(config.namaSekolah || 'SEKOLAH DASAR NEGERI 2 CEMPAKA').toUpperCase()}</div>
            <div className="kw-k3">{config.kopAlamat || config.alamat}</div>
          </div>
          <div style={{ width: `${logoWidth}mm` }} />
        </div>

        {/* Title */}
        <div className="kw-title">KWITANSI</div>
        <div className="kw-no">No. : {v.noKw}</div>

        {/* Rows */}
        <div className="kw-row">
          <div className="kw-l">Sudah terima dari</div>
          <div className="kw-c">:</div>
          <div className="kw-v">
            Bendahara {settings.sumberDana} {config.namaSekolah}
          </div>
        </div>

        <div className="kw-row">
          <div className="kw-l">Uang sejumlah</div>
          <div className="kw-c">:</div>
          <div className="kw-v">
            <span className="kw-terbilang"># {terbilang(row.pengeluaran)} #</span>
          </div>
        </div>

        <div className="kw-row">
          <div className="kw-l">Untuk pembayaran</div>
          <div className="kw-c">:</div>
          <div className="kw-v">{v.untuk}</div>
        </div>

        {/* Mid */}
        <div className="kw-mid">
          <div className="kw-amtbox">Rp {formattedAmt},-</div>
          <div className="kw-date">
            {settings.kota}
            {v.tgl ? `, ${formatTglIndo(v.tgl)}` : ', ........................'}
          </div>
        </div>

        {/* Signatures */}
        <div className="kw-sign">
          <div>
            <div>Setuju dibayar,</div>
            <div>Kepala Sekolah</div>
            <div className="kw-gap" />
            <div className="kw-name">{config.kepsek}</div>
            <div className="kw-nip">NIP. {config.nipKepsek || '-'}</div>
          </div>

          <div>
            <div>Lunas dibayar,</div>
            <div>Bendahara</div>
            <div className="kw-gap" />
            <div className="kw-name">{settings.bendaharaNama}</div>
            <div className="kw-nip">NIP. {settings.bendaharaNip || '-'}</div>
          </div>

          <div>
            <div>Yang menerima,</div>
            <div>&nbsp;</div>
            <div className="kw-gap">
              {needsMaterai && <div className="kw-materai">Meterai Rp10.000</div>}
            </div>
            <div className="kw-name">{v.penerima || '\u00A0'}</div>
            <div className="kw-nip">&nbsp;</div>
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

  const [state, setState] = useState<KeuanganState>(getKeuangan());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  // Adjust preview scaling
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const update = () => {
      const containerWidth = el.clientWidth;
      const naturalWidth = 793.7; // 210mm in px at 96dpi
      setPreviewScale(Math.min(1, Math.max(0.3, containerWidth / naturalWidth)));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  const getComputedRowValues = (row: KeuanganState['bku'][0], index: number) => {
    const edit = state.edits[row.id] || {};
    return {
      noKw: edit.noKw ?? (row.noBukti || `${state.settings.prefix}/${String(index + 1).padStart(3, '0')}`),
      tgl: edit.tgl ?? row.tgl,
      penerima: edit.penerima ?? '',
      untuk: edit.untuk ?? row.uraian,
    };
  };

  const updateRowEdit = (rowId: string, patch: Partial<{ noKw: string; tgl: string; penerima: string; untuk: string }>) => {
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
      onToast(`${records.length} data pengeluaran dari BKU siap dibuat kwitansi.`);
    } catch (err: any) {
      onToast(err?.message || 'Gagal membaca file BKU.', true);
    }
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
    return bku.filter((r) => `${r.uraian} ${r.noBukti}`.toLowerCase().includes(q));
  }, [bku, searchFilter]);

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

  const handlePrint = () => {
    if (!printItems.length) {
      onToast('Pilih kwitansi yang akan dicetak.', true);
      return;
    }
    const styleEl = document.createElement('style');
    styleEl.textContent = '@page{size:210mm 148mm;margin:0}';
    document.head.appendChild(styleEl);
    document.body.classList.add('printing-kwitansi');

    const cleanUp = () => {
      document.body.classList.remove('printing-kwitansi');
      styleEl.remove();
      window.removeEventListener('afterprint', cleanUp);
    };
    window.addEventListener('afterprint', cleanUp);
    setTimeout(() => window.print(), 60);
  };

  const selectedIndex = selectedRow ? bku.findIndex((r) => r.id === selectedRow.id) : -1;
  const computedSelected = selectedRow ? getComputedRowValues(selectedRow, selectedIndex) : null;

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">Laporan Keuangan & Kwitansi BOS</h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Import buku kas umum (BKU), konversi otomatis ke kwitansi standar BOS, dan cetak massal.
          </p>
        </div>

        {hasData && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#566A6E]">
              {state.fileName} &middot; {bku.length} kwitansi
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          handleFileUpload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Upload Box if Empty */}
      {!hasData && (
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
          <p className="text-xs text-[#566A6E] mt-1">Klik atau seret file .xlsx / .csv ke sini</p>
          <p className="text-[11px] text-[#566A6E] mt-3">
            Kolom yang otomatis dibaca: <b>Tanggal</b> &middot; <b>No. Bukti</b> &middot; <b>Uraian</b> &middot; <b>Pengeluaran</b>
          </p>
        </div>
      )}

      {/* Main Content Layout */}
      {hasData && selectedRow && computedSelected && (
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
              {filteredBku.map((r) => (
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
                    <div className="text-xs font-mono font-bold text-[#0B6B58] mt-0.5">
                      {formatRupiah(r.pengeluaran)}
                    </div>
                  </div>
                </div>
              ))}
              {filteredBku.length === 0 && (
                <div className="p-6 text-center text-xs text-[#566A6E]">Tidak ada hasil.</div>
              )}
            </div>
          </div>

          {/* Right: Live Preview & Editor */}
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-4 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="font-bold text-sm text-[#13262A]">
                Preview Kwitansi &middot; {selectedIndex + 1} dari {bku.length}
              </span>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                {checkedIds.size > 0 ? `Cetak ${checkedIds.size} terpilih` : 'Cetak Kwitansi Ini'}
              </button>
            </div>

            {/* Scaled Sheet Container */}
            <div ref={previewContainerRef} className="w-full bg-[#F1F4F2] rounded-lg overflow-hidden p-2">
              <div style={{ width: 793.7 * previewScale, height: 555.6 * previewScale, margin: '0 auto' }}>
                <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: 793.7 }}>
                  <KwitansiView config={config} settings={state.settings} row={selectedRow} v={computedSelected} />
                </div>
              </div>
            </div>

            {/* Row Form Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">No. Kwitansi</label>
                <input
                  value={computedSelected.noKw}
                  onChange={(e) => updateRowEdit(selectedRow.id, { noKw: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Kwitansi</label>
                <input
                  type="date"
                  value={computedSelected.tgl}
                  onChange={(e) => updateRowEdit(selectedRow.id, { tgl: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Penerima (Toko / Orang)</label>
                <input
                  value={computedSelected.penerima}
                  onChange={(e) => updateRowEdit(selectedRow.id, { penerima: e.target.value })}
                  placeholder="Nama toko / penerima uang"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Untuk Pembayaran</label>
                <textarea
                  value={computedSelected.untuk}
                  onChange={(e) => updateRowEdit(selectedRow.id, { untuk: e.target.value })}
                  rows={2}
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Collapsible Global Settings */}
            <details className="mt-3 text-xs">
              <summary className="font-semibold text-[#0B6B58] cursor-pointer">
                Pengaturan Bendahara & Sumber Dana
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9]">
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
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kota / Tempat Kwitansi</label>
                  <input
                    value={state.settings.kota}
                    onChange={(e) => updateSettings({ kota: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Printing Portal */}
      {createPortal(
        <div id="kw-print-root">
          {printItems.map((r) => (
            <KwitansiView
              key={r.id}
              config={config}
              settings={state.settings}
              row={r}
              v={getComputedRowValues(r, bku.findIndex((item) => item.id === r.id))}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
