/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Siswa } from '../types';
import { parseXlsxToSheets, parseDelimitedTextToRows } from './sikatonImport';

export interface DapodikWorkbookSheet {
  name: string;
  rows: any[][];
  parsedCount: number;
}

export interface DapodikSiswaParseResult {
  sheetName: string;
  availableSheets: string[];
  totalRowsFound: number;
  totalLakiLaki: number;
  totalPerempuan: number;
  byKelas: Record<string, number>;
  rombelList: string[];
  detectedSekolah?: string;
  detectedNpsn?: string;
  items: Siswa[];
}

// Indonesian month names for date parsing
const INDO_MONTHS: Record<string, string> = {
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08',
  september: '09', sep: '09',
  oktober: '10', okt: '10',
  november: '11', nov: '11',
  desember: '12', des: '12',
};

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\uFEFF/g, '').trim();
}

/**
 * Normalisasi tanggal dari berbagai format Dapodik:
 * - Excel Serial Number (e.g. 41822 -> 2014-07-02)
 * - ISO string: 2014-07-02
 * - Format garis miring/strip: 02/07/2014 atau 02-07-2014
 * - Format teks Indonesia: 2 Juli 2014
 */
export function parseDapodikDate(val: any): string | undefined {
  if (val === null || val === undefined || val === '') return undefined;

  // 1. Excel serial number
  if (typeof val === 'number' && val > 5000 && val < 65000) {
    const utcDays = Math.round(val - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const str = cleanStr(val);
  if (!str) return undefined;

  // If numeric string like "41822"
  if (/^\d{5}$/.test(str)) {
    const num = Number(str);
    if (num > 5000 && num < 65000) {
      const utcDays = Math.round(num - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  // ISO: YYYY-MM-DD
  const mIso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(str);
  if (mIso) {
    const y = mIso[1];
    const m = mIso[2].padStart(2, '0');
    const d = mIso[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Indonesian / standard DD-MM-YYYY or DD/MM/YYYY
  const mDd = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(str);
  if (mDd) {
    const d = mDd[1].padStart(2, '0');
    const m = mDd[2].padStart(2, '0');
    const y = mDd[3];
    return `${y}-${m}-${d}`;
  }

  // Textual: 2 Juli 2014
  const mText = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(str);
  if (mText) {
    const d = mText[1].padStart(2, '0');
    const monthKey = mText[2].toLowerCase();
    const mm = INDO_MONTHS[monthKey];
    const y = mText[3];
    if (mm) return `${y}-${mm}-${d}`;
  }

  return str;
}

/**
 * Normalisasi Jenis Kelamin (L/P)
 */
export function parseDapodikJk(val: any): 'L' | 'P' {
  const s = cleanStr(val).toUpperCase();
  if (s.startsWith('P') || s.includes('PEREMPUAN') || s.includes('WANITA') || s === '2') {
    return 'P';
  }
  return 'L';
}

/**
 * Normalisasi NISN (10 digit di Indonesia)
 */
export function parseDapodikNisn(val: any): string | undefined {
  if (!val && val !== 0) return undefined;
  const digits = String(val).replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  // Jika 9 digit karena angka 0 di depan hilang dari Excel, pad menjadi 10 digit
  if (digits.length === 9) return '0' + digits;
  return digits;
}

/**
 * Ekstraksi tingkat kelas (1 - 6) dari nama rombel / tingkat
 */
export function extractKelasAngka(rombelStr: string): string {
  const s = rombelStr.toUpperCase().trim();
  // Roman numerals
  if (/\bVI\b/.test(s) || s === '6') return '6';
  if (/\bIV\b/.test(s) || s === '4') return '4';
  if (/\bV\b/.test(s) || s === '5') return '5';
  if (/\bIII\b/.test(s) || s === '3') return '3';
  if (/\bII\b/.test(s) || s === '2') return '2';
  if (/\bI\b/.test(s) || s === '1') return '1';

  // Numbers 1-6
  const m = /\b([1-6])\b/.exec(s);
  if (m) return m[1];
  const mAny = /([1-6])/.exec(s);
  if (mAny) return mAny[1];

  return '1';
}

/**
 * Parser tabel HTML jika berkas adalah .xls berbasis HTML dari web Dapodik
 */
function parseHtmlTableToRows(htmlText: string): string[][] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));
    if (!tables.length) return [];
    // Pilih tabel yang paling banyak barisnya
    let bestTable = tables[0];
    for (const t of tables) {
      if (t.querySelectorAll('tr').length > bestTable.querySelectorAll('tr').length) {
        bestTable = t;
      }
    }
    const rows: string[][] = [];
    bestTable.querySelectorAll('tr').forEach((tr) => {
      const row: string[] = [];
      tr.querySelectorAll('th, td').forEach((cell) => {
        row.push((cell.textContent || '').trim());
      });
      if (row.some((c) => c !== '')) rows.push(row);
    });
    return rows;
  } catch {
    return [];
  }
}

/**
 * Identifikasi kolom dari baris header Dapodik
 */
interface ColumnIndices {
  headerRowIndex: number;
  nama: number;
  nis: number;
  nisn: number;
  jk: number;
  tempatLahir: number;
  tglLahir: number;
  nik: number;
  agama: number;
  rombel: number;
  tingkat: number;
  jalan: number;
  rt: number;
  rw: number;
  dusun: number;
  kelurahan: number;
  kecamatan: number;
  kodePos: number;
  alamatGabung: number;
  namaAyah: number;
  namaIbu: number;
  namaWali: number;
  telpOrtu: number;
  tahunMasuk: number;
  status: number;
  catatan: number;
}

function findHeaderRowAndColumns(rows: any[][]): ColumnIndices | null {
  const norm = (s: any) => cleanStr(s).toLowerCase().replace(/[^a-z0-9]/g, ' ');

  let bestRowIdx = -1;
  let bestScore = -1;

  // Cek 25 baris pertama untuk mencari baris header
  const maxCheck = Math.min(rows.length, 25);
  for (let r = 0; r < maxCheck; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    let score = 0;
    const texts = row.map(norm);
    texts.forEach((txt) => {
      if (txt.includes('nama') || txt.includes('peserta didik')) score += 3;
      if (txt.includes('nipd') || txt.includes('nis')) score += 3;
      if (txt.includes('nisn')) score += 3;
      if (txt === 'jk' || txt.includes('jenis kelamin') || txt === 'l p') score += 3;
      if (txt.includes('tempat lahir') || txt.includes('tmp lahir')) score += 2;
      if (txt.includes('tanggal lahir') || txt.includes('tgl lahir')) score += 2;
      if (txt.includes('rombel') || txt.includes('rombongan')) score += 2;
      if (txt.includes('ibu') || txt.includes('ayah')) score += 2;
      if (txt.includes('nik')) score += 1;
      if (txt.includes('alamat')) score += 1;
    });

    if (score > bestScore && score >= 5) {
      bestScore = score;
      bestRowIdx = r;
    }
  }

  if (bestRowIdx < 0) return null;

  const headerRow = rows[bestRowIdx].map(norm);

  const idxs: ColumnIndices = {
    headerRowIndex: bestRowIdx,
    nama: -1,
    nis: -1,
    nisn: -1,
    jk: -1,
    tempatLahir: -1,
    tglLahir: -1,
    nik: -1,
    agama: -1,
    rombel: -1,
    tingkat: -1,
    jalan: -1,
    rt: -1,
    rw: -1,
    dusun: -1,
    kelurahan: -1,
    kecamatan: -1,
    kodePos: -1,
    alamatGabung: -1,
    namaAyah: -1,
    namaIbu: -1,
    namaWali: -1,
    telpOrtu: -1,
    tahunMasuk: -1,
    status: -1,
    catatan: -1,
  };

  headerRow.forEach((col, cIdx) => {
    // Nama Siswa
    if (idxs.nama < 0 && col.includes('nama')) {
      if (
        !col.includes('ayah') &&
        !col.includes('ibu') &&
        !col.includes('wali') &&
        !col.includes('sekolah') &&
        !col.includes('kepsek')
      ) {
        idxs.nama = cIdx;
      }
    } else if (idxs.nama < 0 && (col === 'peserta didik' || col.includes('nama lengkap'))) {
      idxs.nama = cIdx;
    }

    // NISN
    if (col.includes('nisn')) {
      idxs.nisn = cIdx;
    }
    // NIS / NIPD
    else if (
      idxs.nis < 0 &&
      (col.includes('nipd') ||
        col === 'nis' ||
        col.includes('no induk') ||
        col.includes('nomor induk') ||
        col === 'nis nipd')
    ) {
      idxs.nis = cIdx;
    }

    // JK
    if (col === 'jk' || col.includes('jenis kelamin') || col === 'l p' || col === 'sex') {
      idxs.jk = cIdx;
    }

    // Tempat Lahir
    if (col.includes('tempat lahir') || col.includes('tmp lahir') || col.includes('kota lahir')) {
      idxs.tempatLahir = cIdx;
    }

    // Tanggal Lahir
    if (
      col.includes('tanggal lahir') ||
      col.includes('tgl lahir') ||
      col.includes('lahir tgl') ||
      col.includes('tgl_lahir') ||
      col === 'tgl lahir'
    ) {
      idxs.tglLahir = cIdx;
    }

    // NIK
    if (col === 'nik' || col === 'no ktp' || col.includes('nik siswa')) {
      idxs.nik = cIdx;
    }

    // Agama
    if (col.includes('agama') || col.includes('kepercayaan')) {
      idxs.agama = cIdx;
    }

    // Rombel / Tingkat
    if (col.includes('rombel') || col.includes('rombongan belajar')) {
      idxs.rombel = cIdx;
    } else if (idxs.tingkat < 0 && (col.includes('tingkat') || col === 'kelas')) {
      idxs.tingkat = cIdx;
    }

    // Alamat components
    if (col.includes('alamat') || col.includes('jalan')) {
      if (col.includes('jalan')) idxs.jalan = cIdx;
      else idxs.alamatGabung = cIdx;
    }
    if (col === 'rt') idxs.rt = cIdx;
    if (col === 'rw') idxs.rw = cIdx;
    if (col.includes('dusun') || col.includes('blok') || col.includes('kampung')) idxs.dusun = cIdx;
    if (col.includes('kelurahan') || col.includes('desa')) idxs.kelurahan = cIdx;
    if (col.includes('kecamatan')) idxs.kecamatan = cIdx;
    if (col.includes('kode pos')) idxs.kodePos = cIdx;

    // Orang Tua
    if (col.includes('ayah')) {
      if (idxs.namaAyah < 0 && !col.includes('nik') && !col.includes('pekerjaan') && !col.includes('penghasilan')) {
        idxs.namaAyah = cIdx;
      }
    }
    if (col.includes('ibu')) {
      if (idxs.namaIbu < 0 && !col.includes('nik') && !col.includes('pekerjaan') && !col.includes('penghasilan')) {
        idxs.namaIbu = cIdx;
      }
    }
    if (col.includes('wali')) {
      if (idxs.namaWali < 0 && !col.includes('nik') && !col.includes('pekerjaan') && !col.includes('penghasilan')) {
        idxs.namaWali = cIdx;
      }
    }

    // HP / Telepon
    if (col.includes('hp') || col.includes('telepon') || col.includes('telp') || col.includes('kontak')) {
      if (idxs.telpOrtu < 0) idxs.telpOrtu = cIdx;
    }

    // Tahun Masuk
    if (col.includes('tahun masuk') || col.includes('tgl masuk') || col.includes('tanggal masuk')) {
      idxs.tahunMasuk = cIdx;
    }

    // Status
    if (col.includes('status') || col.includes('keaktifan')) {
      idxs.status = cIdx;
    }

    // Catatan / Kebutuhan
    if (col.includes('kebutuhan khusus') || col.includes('catatan') || col.includes('keterangan')) {
      idxs.catatan = cIdx;
    }
  });

  // Fallback: jika rombel belum ketemu tapi tingkat ada
  if (idxs.rombel < 0 && idxs.tingkat >= 0) {
    idxs.rombel = idxs.tingkat;
  }

  return idxs;
}

/**
 * Parsing data baris menjadi Siswa[]
 */
export function parseDapodikSiswaRows(rows: any[][], sheetName = 'Data Siswa'): DapodikSiswaParseResult {
  const result: DapodikSiswaParseResult = {
    sheetName,
    availableSheets: [sheetName],
    totalRowsFound: 0,
    totalLakiLaki: 0,
    totalPerempuan: 0,
    byKelas: {},
    rombelList: [],
    items: [],
  };

  if (!rows || rows.length < 2) return result;

  // Metadata deteksi sekolah / npsn di baris 0-5
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const line = rows[r].map(cleanStr).join(' ');
    const mSekolah = /(?:sekolah|sd|smp|sma|smk)\s*:\s*([^|;\n,]+)/i.exec(line);
    if (mSekolah && !result.detectedSekolah) result.detectedSekolah = mSekolah[1].trim();
    const mNpsn = /npsn\s*:\s*(\d{8})/i.exec(line);
    if (mNpsn && !result.detectedNpsn) result.detectedNpsn = mNpsn[1].trim();
  }

  const cols = findHeaderRowAndColumns(rows);
  if (!cols || cols.nama < 0) {
    // Tidak ketemu header yang valid
    return result;
  }

  const rombelSet = new Set<string>();
  const curYear = new Date().getFullYear();

  for (let r = cols.headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    const rawNama = cleanStr(row[cols.nama]);
    if (!rawNama) continue;

    // Abaikan baris ringkasan/total
    const low = rawNama.toLowerCase();
    if (
      low === 'total' ||
      low.startsWith('jumlah') ||
      low.startsWith('keterangan') ||
      low.startsWith('catatan') ||
      low.includes('mengetahui')
    ) {
      continue;
    }

    // NISN & NIS
    const nisn = cols.nisn >= 0 ? parseDapodikNisn(row[cols.nisn]) : undefined;
    let nis = cols.nis >= 0 ? cleanStr(row[cols.nis]) : undefined;
    if (nis && !nis.replace(/[^0-9]/g, '')) nis = undefined;

    // JK
    const jk = cols.jk >= 0 ? parseDapodikJk(row[cols.jk]) : 'L';

    // Tanggal Lahir
    const tglLahir = cols.tglLahir >= 0 ? parseDapodikDate(row[cols.tglLahir]) : undefined;
    const tempatLahir = cols.tempatLahir >= 0 ? cleanStr(row[cols.tempatLahir]) || undefined : undefined;

    // Agama
    let agama = cols.agama >= 0 ? cleanStr(row[cols.agama]) : 'Islam';
    if (!agama) agama = 'Islam';

    // Rombel & Kelas
    const rawRombel = cols.rombel >= 0 ? cleanStr(row[cols.rombel]) : '';
    const rawTingkat = cols.tingkat >= 0 ? cleanStr(row[cols.tingkat]) : '';
    const rombelSource = rawRombel || rawTingkat || sheetName;
    const kelas = extractKelasAngka(rombelSource);
    if (rawRombel) rombelSet.add(rawRombel);

    // Alamat lengkap
    let alamat: string | undefined;
    const jalan = cols.jalan >= 0 ? cleanStr(row[cols.jalan]) : '';
    const rt = cols.rt >= 0 ? cleanStr(row[cols.rt]) : '';
    const rw = cols.rw >= 0 ? cleanStr(row[cols.rw]) : '';
    const dusun = cols.dusun >= 0 ? cleanStr(row[cols.dusun]) : '';
    const desa = cols.kelurahan >= 0 ? cleanStr(row[cols.kelurahan]) : '';
    const kec = cols.kecamatan >= 0 ? cleanStr(row[cols.kecamatan]) : '';
    const kodePos = cols.kodePos >= 0 ? cleanStr(row[cols.kodePos]) : '';
    const gabung = cols.alamatGabung >= 0 ? cleanStr(row[cols.alamatGabung]) : '';

    if (jalan || rt || rw || dusun || desa || kec) {
      const parts: string[] = [];
      if (jalan) parts.push(jalan);
      if (rt || rw) parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
      if (dusun) parts.push(`Blok ${dusun}`);
      if (desa) parts.push(desa.toLowerCase().startsWith('desa') ? desa : `Desa ${desa}`);
      if (kec) parts.push(kec.toLowerCase().startsWith('kec') ? kec : `Kec. ${kec}`);
      if (kodePos) parts.push(kodePos);
      alamat = parts.filter(Boolean).join(', ');
    } else if (gabung) {
      alamat = gabung;
    }

    // Orang Tua & Kontak
    const namaAyah = cols.namaAyah >= 0 ? cleanStr(row[cols.namaAyah]) || undefined : undefined;
    const namaIbu = cols.namaIbu >= 0 ? cleanStr(row[cols.namaIbu]) || undefined : undefined;
    const namaWali = cols.namaWali >= 0 ? cleanStr(row[cols.namaWali]) || undefined : undefined;
    const rawHp = cols.telpOrtu >= 0 ? cleanStr(row[cols.telpOrtu]) : '';
    const telpOrtu = rawHp ? rawHp.replace(/[^0-9+]/g, '') : undefined;

    // Catatan Rombel
    let catatanParts: string[] = [];
    if (rawRombel) {
      catatanParts.push(rawRombel.toLowerCase().startsWith('rombel') ? rawRombel : `Rombel ${rawRombel}`);
    }
    if (cols.catatan >= 0) {
      const extra = cleanStr(row[cols.catatan]);
      if (extra && extra !== '-' && !catatanParts.includes(extra)) catatanParts.push(extra);
    }
    const catatan = catatanParts.length ? catatanParts.join(' | ') : undefined;

    // Tahun Masuk
    let tahunMasuk: number | undefined;
    if (cols.tahunMasuk >= 0) {
      const t = cleanStr(row[cols.tahunMasuk]);
      const mY = /(20\d\d|19\d\d)/.exec(t);
      if (mY) tahunMasuk = Number(mY[1]);
    }
    if (!tahunMasuk && nis) {
      // Misal 212201001 -> 2021
      const mNis = /^(\d{2})(\d{2})/.exec(nis);
      if (mNis) {
        const yPrefix = Number(mNis[1]);
        if (yPrefix >= 15 && yPrefix <= 35) tahunMasuk = 2000 + yPrefix;
      }
    }
    if (!tahunMasuk) {
      // Estimasi dari kelas saat ini (misal Kelas 6 -> masuk 5 tahun lalu)
      const kNum = Number(kelas) || 1;
      tahunMasuk = curYear - (kNum - 1);
    }

    // Status siswa
    let status: 'Aktif' | 'Mutasi' | 'Lulus' | 'Keluar' = 'Aktif';
    if (cols.status >= 0) {
      const st = cleanStr(row[cols.status]).toLowerCase();
      if (st.includes('mutasi') || st.includes('pindah')) status = 'Mutasi';
      else if (st.includes('lulus')) status = 'Lulus';
      else if (st.includes('keluar') || st.includes('do') || st.includes('drop')) status = 'Keluar';
    }

    const siswa: Siswa = {
      id: `s_dpk_${Date.now()}_${result.items.length + 1}`,
      nama: rawNama.toUpperCase(),
      nis,
      nisn,
      jk,
      agama,
      warga: 'Indonesia',
      tempatLahir,
      tglLahir,
      kelas,
      status,
      tahunMasuk,
      alamat,
      namaAyah: namaAyah || (namaWali ? `(Wali) ${namaWali}` : undefined),
      namaIbu,
      telpOrtu,
      catatan,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    result.items.push(siswa);

    // Hitung statistik
    if (jk === 'L') result.totalLakiLaki++;
    else result.totalPerempuan++;

    result.byKelas[kelas] = (result.byKelas[kelas] || 0) + 1;
  }

  result.totalRowsFound = result.items.length;
  result.rombelList = Array.from(rombelSet).sort();

  return result;
}

/**
 * Membaca berkas Dapodik (.xlsx, .xls, .csv, .tsv, .txt)
 */
export async function parseDapodikSiswaFile(
  file: File
): Promise<{ result: DapodikSiswaParseResult; sheets: DapodikWorkbookSheet[] }> {
  const isXlsxExt = /\.xlsx$/i.test(file.name);
  const isXlsExt = /\.xls$/i.test(file.name);

  if (isXlsxExt || isXlsExt) {
    try {
      const buffer = await file.arrayBuffer();
      const rawSheets = await parseXlsxToSheets(buffer);
      if (rawSheets && rawSheets.length > 0) {
        const sheets: DapodikWorkbookSheet[] = rawSheets.map((s) => {
          const parsed = parseDapodikSiswaRows(s.rows, s.name);
          return {
            name: s.name,
            rows: s.rows,
            parsedCount: parsed.totalRowsFound,
          };
        });

        // Pilih sheet dengan jumlah data siswa terbanyak atau nama yang mengandung "peserta didik" / "pd" / "siswa"
        let best = sheets.find(
          (s) => /(peserta\s*didik|pd|siswa|daftar|data)/i.test(s.name) && s.parsedCount > 0
        );
        if (!best) {
          best = [...sheets].sort((a, b) => b.parsedCount - a.parsedCount)[0];
        }
        const chosen = best || sheets[0];
        const parsedResult = parseDapodikSiswaRows(chosen.rows, chosen.name);
        parsedResult.availableSheets = sheets.map((s) => s.name);
        return { result: parsedResult, sheets };
      }
    } catch (xlsxErr) {
      console.warn('Gagal membaca via XLSX parser, mencoba fallback text/HTML:', xlsxErr);
    }

    // Fallback: Beberapa web Dapodik mengunduh berkas HTML table dengan ekstensi .xls
    const text = await file.text();
    if (text.includes('<table') || text.includes('<tr')) {
      const htmlRows = parseHtmlTableToRows(text);
      const parsed = parseDapodikSiswaRows(htmlRows, file.name);
      return {
        result: parsed,
        sheets: [{ name: file.name, rows: htmlRows, parsedCount: parsed.totalRowsFound }],
      };
    } else {
      const csvRows = parseDelimitedTextToRows(text);
      const parsed = parseDapodikSiswaRows(csvRows, file.name);
      return {
        result: parsed,
        sheets: [{ name: file.name, rows: csvRows, parsedCount: parsed.totalRowsFound }],
      };
    }
  } else {
    // CSV / TSV / TXT
    const text = await file.text();
    let rows: string[][];
    if (text.includes('<table') || text.includes('<tr')) {
      rows = parseHtmlTableToRows(text);
    } else {
      rows = parseDelimitedTextToRows(text);
    }
    const parsed = parseDapodikSiswaRows(rows, file.name);
    return {
      result: parsed,
      sheets: [{ name: file.name, rows, parsedCount: parsed.totalRowsFound }],
    };
  }
}

/**
 * Menggabungkan semua lembar (sheets) jika berkas Dapodik dipisah per rombel/kelas
 */
export function combineAllSheetsDapodik(sheets: DapodikWorkbookSheet[]): DapodikSiswaParseResult {
  const combinedItems: Siswa[] = [];
  const byKelas: Record<string, number> = {};
  const rombelSet = new Set<string>();
  let totalL = 0;
  let totalP = 0;

  sheets.forEach((s) => {
    const res = parseDapodikSiswaRows(s.rows, s.name);
    res.items.forEach((item) => {
      combinedItems.push(item);
      if (item.jk === 'L') totalL++;
      else totalP++;
      byKelas[item.kelas] = (byKelas[item.kelas] || 0) + 1;
    });
    res.rombelList.forEach((r) => rombelSet.add(r));
  });

  return {
    sheetName: 'Semua Sheet Digabung',
    availableSheets: sheets.map((s) => s.name),
    totalRowsFound: combinedItems.length,
    totalLakiLaki: totalL,
    totalPerempuan: totalP,
    byKelas,
    rombelList: Array.from(rombelSet).sort(),
    items: combinedItems,
  };
}
