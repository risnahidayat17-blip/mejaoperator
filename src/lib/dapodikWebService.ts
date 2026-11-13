/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Guru, Siswa } from '../types';
import {
  parseDapodikDate,
  parseDapodikJk,
  parseDapodikNisn,
  extractKelasAngka,
} from './dapodikSiswaImport';

export interface DapodikWsConfig {
  baseUrl: string;
  bridgeUrl: string;
  useBridge: boolean;
  npsn: string;
  token: string;
  lastSyncAt?: number;
  lastSchoolName?: string;
  lastGtkCount?: number;
  lastSiswaCount?: number;
}

export type DapodikEndpoint =
  | 'getSekolah'
  | 'getGtk'
  | 'getPesertaDidik'
  | 'getRombonganBelajar';

export interface DapodikSekolahInfo {
  nama?: string;
  npsn?: string;
  nss?: string;
  alamat?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  kepalaSekolah?: string;
}

export interface DapodikJsonParseResult {
  kind: 'gtk' | 'siswa' | 'sekolah' | 'unknown';
  gurus: Guru[];
  siswas: Siswa[];
  sekolah?: DapodikSekolahInfo;
}

function cleanStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/\uFEFF/g, '').trim();
  if (s === 'null' || s === 'undefined' || s === '-') return '';
  return s;
}

export function normalizeWsBaseUrl(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '');
  u = u.replace(/\/WebService$/i, '');
  if (u && !/^https?:\/\//i.test(u)) {
    u = 'http://' + u;
  }
  return u || 'http://localhost:5774';
}

export function extractDapodikRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.rows && typeof payload.rows === 'object') return [payload.rows];
  if (typeof payload === 'object' && (payload.npsn || payload.ptk_id || payload.peserta_didik_id || payload.nama)) {
    return [payload];
  }
  return [];
}

export async function fetchDapodikEndpoint(
  cfg: DapodikWsConfig,
  endpoint: DapodikEndpoint
): Promise<any> {
  const npsn = (cfg.npsn || '').trim();
  const token = (cfg.token || '').trim();
  if (!npsn) {
    throw new Error('NPSN wajib diisi sebelum mengambil data dari Dapodik.');
  }
  if (!token) {
    throw new Error('Token Web Service Dapodik wajib diisi.');
  }

  const rootUrl = normalizeWsBaseUrl(cfg.useBridge ? cfg.bridgeUrl : cfg.baseUrl);
  const url = `${rootUrl}/WebService/${endpoint}?npsn=${encodeURIComponent(npsn)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: ctrl.signal,
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Token Web Service ditolak oleh Dapodik (HTTP ${res.status}). Periksa kembali Token pada menu Pengaturan > Web Service di Aplikasi Dapodik.`
      );
    }
    if (res.status === 404) {
      throw new Error(
        `Endpoint ${endpoint} tidak ditemukan (HTTP 404). Pastikan URL Dapodik benar (bawaan: http://localhost:5774).`
      );
    }
    if (!res.ok) {
      const serverMsg = json?.message || json?.error || text.slice(0, 140);
      throw new Error(`Dapodik merespons HTTP ${res.status}${serverMsg ? `: ${serverMsg}` : ''}`);
    }

    if (!json) {
      throw new Error('Respons Dapodik bukan format JSON yang valid.');
    }
    if (json.success === false || (json.message && !json.rows && !Array.isArray(json))) {
      throw new Error(json.message || 'Web Service Dapodik mengembalikan pesan gagal.');
    }

    return json;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(
        `Koneksi ke ${rootUrl} melebihi batas waktu (15 detik). Pastikan Aplikasi Dapodik terbuka dan port aktif.`
      );
    }
    const msg = String(err?.message || '');
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
      if (cfg.useBridge) {
        throw new Error(
          `Tidak dapat terhubung ke Bridge Lokal (${rootUrl}). Pastikan file "Dapodik_Bridge_Lokal.bat" sudah dijalankan di laptop Dapodik dan Aplikasi Dapodik sedang aktif.`
        );
      }
      throw new Error(
        `Gagal mengakses ${rootUrl} langsung dari browser (terblokir CORS / HTTPS atau Dapodik tidak berjalan di perangkat ini). Aktifkan mode "Bridge Lokal CORS (Port 5775)" dan jalankan script bridge, atau tempel hasil JSON secara manual.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeStatusPeg(rawStatus: string): string {
  const s = rawStatus.trim();
  const up = s.toUpperCase();
  if (!s) return 'GTT / Honorer';
  if (up.includes('PPPK') || up.includes('P3K')) return 'PPPK';
  if (up.includes('PNS')) return 'PNS';
  if (up.includes('HONOR') || up.includes('GTT') || up.includes('PTT')) return 'GTT / Honorer';
  return s;
}

function inferJenisGtk(jabatan: string): 'Guru' | 'Tendik' {
  const low = jabatan.toLowerCase();
  if (
    low.includes('tendik') ||
    low.includes('tenaga administrasi') ||
    low.includes('tata usaha') ||
    /\btas\b/.test(low) ||
    low.includes('operator') ||
    low.includes('pustaka') ||
    low.includes('penjaga') ||
    low.includes('kebersihan') ||
    low.includes('satpam') ||
    low.includes('keamanan') ||
    low.includes('laboran') ||
    low.includes('pesuruh')
  ) {
    return 'Tendik';
  }
  return 'Guru';
}

export function mapDapodikSekolahInfo(payload: any): DapodikSekolahInfo | undefined {
  const rows = extractDapodikRows(payload);
  const r = rows[0];
  if (!r || typeof r !== 'object') return undefined;
  return {
    nama: cleanStr(r.nama || r.nama_sekolah),
    npsn: cleanStr(r.npsn),
    nss: cleanStr(r.nss),
    alamat: cleanStr(r.alamat_jalan || r.alamat),
    kecamatan: cleanStr(r.kecamatan),
    kabupaten: cleanStr(r.kabupaten_kota || r.kabupaten),
    provinsi: cleanStr(r.provinsi),
    kepalaSekolah: cleanStr(r.kepala_sekolah || r.nama_kepsek),
  };
}

export function mapDapodikGtkToGurus(rows: any[]): Guru[] {
  const now = Date.now();
  const dedup = new Map<string, Guru>();

  rows.forEach((r, idx) => {
    if (!r || typeof r !== 'object') return;
    const rawNama = cleanStr(r.nama || r.nama_ptk);
    if (!rawNama) return;

    const nama = rawNama.toUpperCase();
    const nip = cleanStr(r.nip).replace(/\s+/g, '');
    const nuptk = cleanStr(r.nuptk).replace(/[^0-9]/g, '');
    const ptkId = cleanStr(r.ptk_id);
    const jabatan =
      cleanStr(r.jabatan_ptk_id_str) ||
      cleanStr(r.jenis_ptk_id_str) ||
      cleanStr(r.jabatan) ||
      'Guru';

    const statusPeg = normalizeStatusPeg(
      cleanStr(r.status_kepegawaian_id_str || r.status_kepegawaian)
    );

    const g: Guru = {
      id: ptkId ? `dap_${ptkId.slice(0, 12)}` : `g_dap_${now}_${idx}`,
      nama,
      nip: nip || undefined,
      nuptk: nuptk || undefined,
      jk: parseDapodikJk(r.jenis_kelamin),
      tempatLahir: cleanStr(r.tempat_lahir) || undefined,
      tglLahir: parseDapodikDate(r.tanggal_lahir),
      jabatan,
      jenisGtk: inferJenisGtk(jabatan),
      statusPeg,
      mengampu:
        cleanStr(r.bidang_studi_terakhir) ||
        cleanStr(r.mengajar) ||
        cleanStr(r.mata_pelajaran) ||
        undefined,
      pendidikan: cleanStr(r.pendidikan_terakhir) || undefined,
      tmt: parseDapodikDate(r.tmt_pengangkatan),
      skNomor: cleanStr(r.nomor_sk_pengangkatan) || undefined,
      skTanggal: parseDapodikDate(r.tanggal_sk_pengangkatan || r.tmt_pengangkatan),
      golongan: cleanStr(r.pangkat_golongan_id_str) || undefined,
      tmtGol: parseDapodikDate(r.tmt_pns),
      agama: cleanStr(r.agama_id_str) || undefined,
      telp: cleanStr(r.no_hp || r.no_telepon_hp || r.nomor_telepon) || undefined,
      email: cleanStr(r.email) || undefined,
      alamat: cleanStr(r.alamat_jalan || r.alamat) || undefined,
      status: 'Aktif',
      createdAt: now,
      updatedAt: now,
    };

    const dedupKey = ptkId || nuptk || nip || nama;
    const prev = dedup.get(dedupKey);
    if (!prev) {
      dedup.set(dedupKey, g);
    } else {
      dedup.set(dedupKey, {
        ...prev,
        nip: prev.nip || g.nip,
        nuptk: prev.nuptk || g.nuptk,
        mengampu: prev.mengampu || g.mengampu,
        pendidikan: prev.pendidikan || g.pendidikan,
        golongan: prev.golongan || g.golongan,
        telp: prev.telp || g.telp,
        email: prev.email || g.email,
      });
    }
  });

  return Array.from(dedup.values());
}

export function buildRombelMap(rows: any[]): Map<string, { nama: string; tingkat: string }> {
  const map = new Map<string, { nama: string; tingkat: string }>();
  for (const r of rows || []) {
    if (!r || typeof r !== 'object') continue;
    const id = cleanStr(r.rombongan_belajar_id);
    const nama = cleanStr(r.nama || r.nama_rombel);
    const tingkatRaw = cleanStr(r.tingkat_pendidikan_id_str || r.tingkat_pendidikan_id);
    if (id && nama) {
      map.set(id, { nama, tingkat: extractKelasAngka(tingkatRaw || nama) });
    }
  }
  return map;
}

export function mapDapodikPdToSiswas(
  rows: any[],
  rombelMap?: Map<string, { nama: string; tingkat: string }>
): Siswa[] {
  const now = Date.now();
  const dedup = new Map<string, Siswa>();

  rows.forEach((r, idx) => {
    if (!r || typeof r !== 'object') return;
    const nama = cleanStr(r.nama || r.nama_pd);
    if (!nama) return;

    const pdId = cleanStr(r.peserta_didik_id);
    const nisn = parseDapodikNisn(r.nisn);
    const nis = cleanStr(r.nipd || r.nis);
    const rId = cleanStr(r.rombongan_belajar_id);
    const rombelInfo = rId ? rombelMap?.get(rId) : undefined;
    const rawRombel = cleanStr(r.nama_rombel || r.rombel) || rombelInfo?.nama || '';
    const rawTingkat =
      cleanStr(r.tingkat_pendidikan_id_str) ||
      cleanStr(r.tingkat_pendidikan_id) ||
      rombelInfo?.tingkat ||
      rawRombel;
    const kelas = extractKelasAngka(rawTingkat || rawRombel || '1');

    const alamatParts = [
      cleanStr(r.alamat_jalan || r.alamat),
      cleanStr(r.nama_dusun),
      cleanStr(r.desa_kelurahan),
      cleanStr(r.kecamatan),
    ].filter(Boolean);

    const tglMasuk = parseDapodikDate(r.tanggal_masuk_sekolah);
    const tahunMasuk = tglMasuk ? parseInt(tglMasuk.slice(0, 4), 10) : undefined;

    const s: Siswa = {
      id: pdId ? `pd_${pdId.slice(0, 12)}` : `s_dap_${now}_${idx}`,
      nama,
      nis: nis || undefined,
      nisn,
      jk: parseDapodikJk(r.jenis_kelamin),
      agama: cleanStr(r.agama_id_str) || 'Islam',
      warga: 'WNI',
      tempatLahir: cleanStr(r.tempat_lahir) || undefined,
      tglLahir: parseDapodikDate(r.tanggal_lahir),
      kelas,
      rombel: rawRombel || undefined,
      status: 'Aktif',
      tahunMasuk: tahunMasuk && !isNaN(tahunMasuk) ? tahunMasuk : undefined,
      alamat: alamatParts.length ? alamatParts.join(', ') : undefined,
      namaAyah: cleanStr(r.nama_ayah) || undefined,
      namaIbu: cleanStr(r.nama_ibu) || undefined,
      telpOrtu: cleanStr(r.nomor_telepon_seluler || r.no_hp || r.no_telepon_rumah) || undefined,
      catatan: rawRombel ? `Rombel ${rawRombel}` : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const dedupKey = pdId || nisn || nis || `${nama.toLowerCase()}|${s.tglLahir || ''}`;
    if (!dedup.has(dedupKey)) {
      dedup.set(dedupKey, s);
    }
  });

  return Array.from(dedup.values());
}

export function parseDapodikRawJson(rawText: string): DapodikJsonParseResult {
  const parsed = JSON.parse(rawText);
  const rows = extractDapodikRows(parsed);
  if (!rows.length) {
    return { kind: 'unknown', gurus: [], siswas: [] };
  }

  const sample = rows.find((x) => x && typeof x === 'object') || {};
  const isGtk =
    'ptk_id' in sample ||
    'nuptk' in sample ||
    'jenis_ptk_id_str' in sample ||
    'jabatan_ptk_id_str' in sample ||
    'status_kepegawaian_id_str' in sample;
  const isSiswa =
    'peserta_didik_id' in sample ||
    'nisn' in sample ||
    'nipd' in sample ||
    'nama_rombel' in sample ||
    'tingkat_pendidikan_id_str' in sample;
  const isSekolah = 'npsn' in sample && ('kepala_sekolah' in sample || 'alamat_jalan' in sample) && !isGtk && !isSiswa;

  if (isGtk) {
    return { kind: 'gtk', gurus: mapDapodikGtkToGurus(rows), siswas: [] };
  }
  if (isSiswa) {
    return { kind: 'siswa', gurus: [], siswas: mapDapodikPdToSiswas(rows) };
  }
  if (isSekolah) {
    return { kind: 'sekolah', gurus: [], siswas: [], sekolah: mapDapodikSekolahInfo(parsed) };
  }
  return { kind: 'unknown', gurus: [], siswas: [] };
}

/**
 * Menghasilkan file .bat ringan untuk Windows (menggunakan PowerShell bawaan Windows 10/11,
 * tanpa perlu menginstal Node.js/Python) yang meneruskan permintaan browser ke Web Service
 * Dapodik (127.0.0.1:5774) dengan header CORS lengkap.
 */
export function generateWindowsBridgeBat(dapodikPort = 5774, bridgePort = 5775): string {
  const psScript = [
    `$ErrorActionPreference = 'Stop'`,
    `$listener = New-Object System.Net.HttpListener`,
    `$listener.Prefixes.Add('http://localhost:${bridgePort}/')`,
    `$listener.Prefixes.Add('http://127.0.0.1:${bridgePort}/')`,
    `$listener.Start()`,
    `Write-Host '=======================================================' -ForegroundColor Cyan`,
    `Write-Host '  BRIDGE LOKAL DAPODIK -> MEJA OPERATOR AKTIF' -ForegroundColor Green`,
    `Write-Host '  Bridge Port : http://localhost:${bridgePort}' -ForegroundColor White`,
    `Write-Host '  Target      : http://127.0.0.1:${dapodikPort}' -ForegroundColor White`,
    `Write-Host '  Biarkan jendela ini terbuka selama proses tarik data.' -ForegroundColor Yellow`,
    `Write-Host '=======================================================' -ForegroundColor Cyan`,
    `while ($listener.IsListening) {`,
    `  $ctx = $listener.GetContext()`,
    `  $req = $ctx.Request`,
    `  $res = $ctx.Response`,
    `  $res.Headers.Add('Access-Control-Allow-Origin', '*')`,
    `  $res.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')`,
    `  $res.Headers.Add('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Requested-With')`,
    `  $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')`,
    `  if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; try { $res.Close() } catch {}; continue }`,
    `  try {`,
    `    $target = 'http://127.0.0.1:${dapodikPort}' + $req.RawUrl`,
    `    $wc = New-Object System.Net.WebClient`,
    `    $wc.Encoding = [System.Text.Encoding]::UTF8`,
    `    $auth = $req.Headers['Authorization']`,
    `    if ($auth) { $wc.Headers.Add('Authorization', $auth) }`,
    `    $body = $wc.DownloadString($target)`,
    `    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)`,
    `    $res.StatusCode = 200`,
    `    $res.ContentType = 'application/json; charset=utf-8'`,
    `    $res.ContentLength64 = $bytes.Length`,
    `    $res.OutputStream.Write($bytes, 0, $bytes.Length)`,
    `    Write-Host ('[OK] ' + $req.RawUrl) -ForegroundColor Green`,
    `  } catch {`,
    `    $code = 502`,
    `    $msg = $_.Exception.Message`,
    `    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }`,
    `    $safeMsg = $msg -replace '[\\r\\n]+', ' ' -replace '\\\\', '\\\\\\\\' -replace '"', '\\"'`,
    `    $errJson = '{"success":false,"message":"' + $safeMsg + '"}'`,
    `    $bytes = [System.Text.Encoding]::UTF8.GetBytes($errJson)`,
    `    $res.StatusCode = $code`,
    `    $res.ContentType = 'application/json; charset=utf-8'`,
    `    $res.ContentLength64 = $bytes.Length`,
    `    $res.OutputStream.Write($bytes, 0, $bytes.Length)`,
    `    Write-Host ('[ERR ' + $code + '] ' + $req.RawUrl + ' -> ' + $msg) -ForegroundColor Red`,
    `  } finally { try { $res.Close() } catch {} }`,
    `}`,
  ].join('\n');

  const utf16 = new Uint8Array(psScript.length * 2);
  for (let i = 0; i < psScript.length; i++) {
    const code = psScript.charCodeAt(i);
    utf16[i * 2] = code & 0xff;
    utf16[i * 2 + 1] = code >> 8;
  }
  let bin = '';
  for (let i = 0; i < utf16.length; i++) {
    bin += String.fromCharCode(utf16[i]);
  }
  const encoded = btoa(bin);

  return [
    '@echo off',
    'title Bridge Lokal Dapodik - Meja Operator',
    `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
    'pause',
    '',
  ].join('\r\n');
}
