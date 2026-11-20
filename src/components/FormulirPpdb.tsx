/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { PpdbParticipant, SchoolConfig, Siswa } from '../types';
import {
  getPpdbParticipants,
  savePpdbParticipantsList,
  getPpdbSheetUrl,
  savePpdbSheetUrl,
  getSiswas,
  saveSiswa,
  subscribeToStorage,
  subscribeToCloudChanges,
} from '../lib/storage';
import { printDomElement } from '../lib/print';
import { formatGelarInText } from '../lib/eyd';
import {
  Printer,
  Users,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  Link2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Lock,
  Check,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';

interface FormulirPpdbProps {
  config: SchoolConfig;
  role: 'operator' | 'guru';
  onToast: (msg: string, isError?: boolean) => void;
}

type FieldKey = keyof Omit<PpdbParticipant, 'id' | 'createdAt' | 'updatedAt'>;

interface FieldDef {
  group?: string;
  name?: FieldKey;
  label?: string;
  type?: 'text' | 'date' | 'select';
  options?: string[];
}

const FIELD_DEFS: FieldDef[] = [
  { group: 'A. Keterangan Anak' },
  { name: 'nama_lengkap', label: 'Nama Lengkap', type: 'text' },
  { name: 'nama_panggilan', label: 'Nama Panggilan', type: 'text' },
  { name: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: ['Laki-laki', 'Perempuan'] },
  { name: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
  { name: 'tempat_lahir', label: 'Tempat Lahir', type: 'text' },
  { name: 'agama', label: 'Agama', type: 'text' },
  { name: 'kewarganegaraan', label: 'Kewarganegaraan', type: 'select', options: ['WNI', 'WNA', 'WNI Keturunan'] },
  { name: 'anak_nomor_ke', label: 'Anak Nomor ke (dari satu ibu)', type: 'text' },
  { name: 'saudara_kandung', label: 'Banyaknya Saudara Kandung', type: 'text' },
  { name: 'saudara_tiri', label: 'Banyaknya Saudara Tiri', type: 'text' },
  { name: 'saudara_angkat', label: 'Banyaknya Saudara Angkat', type: 'text' },
  { name: 'bahasa_sehari_hari', label: 'Bahasa Sehari-hari', type: 'text' },
  { name: 'berat_badan', label: 'Berat Badan (Kg)', type: 'text' },
  { name: 'tinggi_badan', label: 'Tinggi Badan (Cm)', type: 'text' },
  { name: 'golongan_darah', label: 'Golongan Darah', type: 'select', options: ['A', 'B', 'AB', 'O'] },
  { name: 'penyakit', label: 'Penyakit yang Pernah Diderita', type: 'text' },
  { name: 'alamat', label: 'Alamat (baris 1)', type: 'text' },
  { name: 'alamat_2', label: 'Alamat (baris 2) / No. Telepon', type: 'text' },
  { name: 'tempat_tinggal', label: 'Bertempat Tinggal Pada', type: 'select', options: ['Orang tua', 'Menumpang', 'Asrama'] },
  { name: 'jarak_sekolah', label: 'Jarak Tempat Tinggal dengan Sekolah', type: 'text' },

  { group: 'B. Keterangan Orang Tua/Wali' },
  { name: 'nama_ayah', label: 'Nama Ayah Kandung', type: 'text' },
  { name: 'nama_ibu', label: 'Nama Ibu Kandung', type: 'text' },
  { name: 'pendidikan_ayah', label: 'Pendidikan Tertinggi Ayah', type: 'text' },
  { name: 'pendidikan_ibu', label: 'Pendidikan Tertinggi Ibu', type: 'text' },
  { name: 'pekerjaan_orangtua', label: 'Pekerjaan Orang Tua', type: 'text' },
  { name: 'nama_wali', label: 'Nama Wali Murid (jika ada)', type: 'text' },
  { name: 'pendidikan_wali', label: 'Pendidikan Tertinggi Wali', type: 'text' },
  { name: 'hubungan_wali', label: 'Hubungan Wali Terhadap Anak', type: 'text' },
  { name: 'pekerjaan_wali', label: 'Pekerjaan/Jabatan Wali', type: 'text' },

  { group: 'C. Asal Mula Anak' },
  { name: 'status_masuk', label: 'Masuk Sekolah Sebagai', type: 'select', options: ['Murid baru kelas I', 'Pindahan'] },
  { name: 'asal_anak', label: 'a. Asal Anak', type: 'select', options: ['Rumah tangga', 'Taman kanak-kanak'] },
  { name: 'nama_tk', label: 'b. Nama Taman Kanak-kanak', type: 'text' },
  { name: 'sttb', label: 'c. Tahun dan Nomor STTB', type: 'text' },
  { name: 'lama_belajar', label: 'd. Lama Belajar (tahun)', type: 'text' },
  { name: 'sekolah_asal', label: 'Nama Sekolah Asal (jika pindahan)', type: 'text' },
  { name: 'sekolah_asal_lokasi', label: 'Lokasi Sekolah Asal', type: 'text' },
  { name: 'tanggal_pindahan', label: 'Tanggal Pindahan', type: 'date' },
  { name: 'dari_kelas', label: 'Pindahan dari Kelas', type: 'text' },
  { name: 'tanggal_diterima', label: 'Tanggal Diterima di Sekolah Ini', type: 'date' },
  { name: 'kelas_diterima', label: 'Diterima di Kelas', type: 'text' },
  { name: 'tanggal_surat', label: 'Tanggal Surat (untuk tanda tangan)', type: 'text' },
];

const DATA_FIELDS = FIELD_DEFS.filter((f): f is Required<Pick<FieldDef, 'name' | 'label' | 'type'>> & { options?: string[] } =>
  Boolean(f.name)
);
const FIELD_NAMES: FieldKey[] = DATA_FIELDS.map((f) => f.name);

const GROUPED_FIELDS = (() => {
  const groups: { group: string; fields: typeof DATA_FIELDS }[] = [];
  let cur: { group: string; fields: typeof DATA_FIELDS } | null = null;
  for (const f of FIELD_DEFS) {
    if (f.group) {
      cur = { group: f.group, fields: [] };
      groups.push(cur);
    } else if (cur && f.name) {
      cur.fields.push(f as (typeof DATA_FIELDS)[number]);
    }
  }
  return groups;
})();

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const KEEP_UPPERCASE = ['WNI', 'WNA'];
const FULL_UPPERCASE_FIELDS = new Set<FieldKey>(['nama_lengkap', 'nama_ayah', 'nama_ibu']);
const DATE_FIELDS = new Set<FieldKey>(DATA_FIELDS.filter((f) => f.type === 'date').map((f) => f.name));

function emptyParticipant(): PpdbParticipant {
  const now = Date.now();
  return {
    id: `ppdb_${now}_${Math.random().toString(36).slice(2, 7)}`,
    nama_lengkap: '',
    nama_panggilan: '',
    jenis_kelamin: '',
    tanggal_lahir: '',
    tempat_lahir: '',
    agama: '',
    kewarganegaraan: '',
    anak_nomor_ke: '',
    saudara_kandung: '',
    saudara_tiri: '',
    saudara_angkat: '',
    bahasa_sehari_hari: '',
    berat_badan: '',
    tinggi_badan: '',
    golongan_darah: '',
    penyakit: '',
    alamat: '',
    alamat_2: '',
    tempat_tinggal: '',
    jarak_sekolah: '',
    nama_ayah: '',
    nama_ibu: '',
    pendidikan_ayah: '',
    pendidikan_ibu: '',
    pekerjaan_orangtua: '',
    nama_wali: '',
    pendidikan_wali: '',
    hubungan_wali: '',
    pekerjaan_wali: '',
    status_masuk: '',
    asal_anak: '',
    nama_tk: '',
    sttb: '',
    lama_belajar: '',
    sekolah_asal: '',
    sekolah_asal_lokasi: '',
    tanggal_pindahan: '',
    dari_kelas: '',
    tanggal_diterima: '',
    kelas_diterima: '',
    tanggal_surat: '',
    createdAt: now,
    updatedAt: now,
  };
}

function formatDateLong(v: string): string {
  if (!v) return '';
  const trimmed = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const day = parseInt(iso[3], 10);
    const month = NAMA_BULAN[parseInt(iso[2], 10) - 1] || iso[2];
    return `${day} ${month} ${iso[1]}`;
  }
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = NAMA_BULAN[parseInt(dmy[2], 10) - 1] || dmy[2];
    return `${day} ${month} ${dmy[3]}`;
  }
  return trimmed;
}

function toTitleCase(v: string): string {
  const s = String(v ?? '');
  if (!s.trim()) return s;
  const lower = s.toLowerCase();
  return lower.replace(/[a-zà-ÿ]+/g, (w) => {
    const upper = w.toUpperCase();
    if (KEEP_UPPERCASE.includes(upper)) return upper;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

function formatFieldDisplay(name: FieldKey, value?: string): string {
  const v = value ?? '';
  if (!v) return '';
  if (DATE_FIELDS.has(name)) return formatDateLong(v);
  if (FULL_UPPERCASE_FIELDS.has(name)) return String(v).toUpperCase();
  return toTitleCase(v);
}

function normalizeImportedDate(val: unknown): string {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(s)) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
}

export const FormulirPpdb: React.FC<FormulirPpdbProps> = ({ config, onToast }) => {
  const [participants, setParticipants] = useState<PpdbParticipant[]>(() => getPpdbParticipants());
  const [currentIndex, setCurrentIndex] = useState<number>(() => (getPpdbParticipants().length > 0 ? 0 : -1));
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [deleteTargetIdx, setDeleteTargetIdx] = useState<number | null>(null);

  const [sheetUrl, setSheetUrl] = useState<string>(() => getPpdbSheetUrl());
  const [sheetUrlDraft, setSheetUrlDraft] = useState<string>(() => getPpdbSheetUrl());
  const [syncStatus, setSyncStatus] = useState<string>(() =>
    getPpdbSheetUrl() ? 'Terhubung ke Google Sheet' : 'Mode lokal & Supabase Cloud'
  );
  const [isPullingSheet, setIsPullingSheet] = useState(false);

  const singlePrintRef = useRef<HTMLDivElement>(null);
  const allPrintRef = useRef<HTMLDivElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const tableTbodyRef = useRef<HTMLTableSectionElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const refresh = () => {
      const next = getPpdbParticipants();
      setParticipants(next);
      setCurrentIndex((prev) => {
        if (next.length === 0) return -1;
        if (prev < 0) return 0;
        if (prev >= next.length) return next.length - 1;
        return prev;
      });
    };
    const u1 = subscribeToStorage(refresh);
    const u2 = subscribeToCloudChanges(refresh);
    return () => {
      u1();
      u2();
    };
  }, []);

  const currentParticipant: PpdbParticipant | null =
    currentIndex >= 0 && currentIndex < participants.length ? participants[currentIndex] : null;

  const participantLabel = (p: PpdbParticipant, idx: number) =>
    p.nama_lengkap?.trim() ? p.nama_lengkap.trim() : `Peserta ${idx + 1} (belum diisi nama)`;

  // Google Sheet push (if configured)
  const pushToSheet = async (listToPush: PpdbParticipant[], urlOverride?: string) => {
    const targetUrl = (urlOverride ?? sheetUrl).trim();
    if (!targetUrl) return;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('Menyimpan ke Google Sheet...');
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ participants: listToPush }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.ok === false) throw new Error(data?.error || 'Respon tidak valid');
      setSyncStatus(`Tersimpan di Google Sheet (${listToPush.length} peserta)`);
    } catch {
      setSyncStatus('Gagal sinkron Google Sheet (data tetap tersimpan lokal)');
    } finally {
      isSyncingRef.current = false;
    }
  };

  const commitParticipants = (next: PpdbParticipant[], activityLabel?: string, replaceCloud = false) => {
    setParticipants(next);
    savePpdbParticipantsList(next, activityLabel, replaceCloud);
    if (sheetUrl.trim()) {
      setSyncStatus('Menunggu sinkron ke Google Sheet...');
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        pushToSheet(next);
      }, 900);
    }
  };

  const pullFromSheet = async (showFeedback = true, urlOverride?: string) => {
    const targetUrl = (urlOverride ?? sheetUrl).trim();
    if (!targetUrl) {
      setSyncStatus('Belum terhubung ke Google Sheet (mode lokal)');
      if (showFeedback) setIsSheetModalOpen(true);
      return;
    }
    setIsPullingSheet(true);
    setSyncStatus('Mengambil data terbaru dari Google Sheet...');
    try {
      const res = await fetch(targetUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.ok === false) throw new Error(data?.error || 'Respon tidak valid');
      if (Array.isArray(data.participants)) {
        const now = Date.now();
        const mapped: PpdbParticipant[] = data.participants.map((r: Record<string, unknown>, idx: number) => {
          const p = emptyParticipant();
          p.id = String(r.id || `ppdb_${now}_${idx}`);
          FIELD_NAMES.forEach((n) => {
            if (r[n] !== undefined && r[n] !== null) {
              p[n] = String(r[n]);
            }
          });
          p.updatedAt = now;
          return p;
        });
        savePpdbParticipantsList(mapped, `Sinkron dari Google Sheet (${mapped.length} peserta)`, true);
        setParticipants(mapped);
        setCurrentIndex(mapped.length > 0 ? 0 : -1);
        setSyncStatus(`Tersinkron dari Google Sheet (${mapped.length} peserta)`);
        if (showFeedback) onToast(`Berhasil mengambil ${mapped.length} data peserta dari Google Sheet.`);
      }
    } catch (err) {
      setSyncStatus('Gagal terhubung ke Google Sheet, memakai data lokal terakhir');
      if (showFeedback) {
        onToast(
          `Gagal terhubung ke Google Sheet: ${err instanceof Error ? err.message : 'Periksa URL Web App'}.`,
          true
        );
      }
    } finally {
      setIsPullingSheet(false);
    }
  };

  useEffect(() => {
    if (sheetUrl.trim()) {
      pullFromSheet(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCellEdit = (idx: number, field: FieldKey, value: string) => {
    const now = Date.now();
    const next = participants.map((p, i) =>
      i === idx ? { ...p, [field]: value, updatedAt: now } : p
    );
    commitParticipants(next);
  };

  const handleAddRow = () => {
    const newRow = emptyParticipant();
    const next = [...participants, newRow];
    const newIdx = next.length - 1;
    if (currentIndex < 0) setCurrentIndex(newIdx);
    commitParticipants(next, 'Tambah peserta PPDB baru');
    onToast(`Baris peserta ke-${newIdx + 1} ditambahkan.`);
    requestAnimationFrame(() => {
      const tr = tableTbodyRef.current?.querySelector(`tr[data-index="${newIdx}"]`);
      if (tr) {
        tr.scrollIntoView({ block: 'nearest' });
        const input = tr.querySelector('input, select') as HTMLElement | null;
        input?.focus();
      }
    });
  };

  const handleConfirmDeleteRow = () => {
    if (deleteTargetIdx === null) return;
    const idx = deleteTargetIdx;
    const label = participants[idx] ? participantLabel(participants[idx], idx) : 'Peserta';
    const next = participants.filter((_, i) => i !== idx);
    setDeleteTargetIdx(null);
    commitParticipants(next, `Hapus peserta PPDB: ${label}`, true);
    if (next.length === 0) {
      setCurrentIndex(-1);
    } else if (currentIndex >= next.length) {
      setCurrentIndex(next.length - 1);
    }
    onToast(`Data "${label}" dihapus.`);
  };

  const handleClearAll = () => {
    setIsClearConfirmOpen(false);
    setCurrentIndex(-1);
    commitParticipants([], 'Hapus semua data peserta PPDB', true);
    onToast('Semua data peserta PPDB berhasil dikosongkan.');
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([FIELD_NAMES, FIELD_NAMES.map(() => '')]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data PPDB');
    XLSX.writeFile(wb, 'Template_Data_PPDB_SD_Negeri_2_Cempaka.xlsx');
    onToast('Template Excel Formulir PPDB (M 1) berhasil diunduh.');
  };

  const handleExportExcel = () => {
    if (participants.length === 0) {
      onToast('Belum ada data peserta untuk diekspor ke Excel.', true);
      return;
    }
    const rows = participants.map((p) => {
      const obj: Record<string, string> = {};
      FIELD_NAMES.forEach((n) => {
        obj[n] = p[n] || '';
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header: FIELD_NAMES });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data PPDB');
    XLSX.writeFile(wb, 'Data_PPDB_SD_Negeri_2_Cempaka.xlsx');
    onToast(`${participants.length} data peserta PPDB berhasil diekspor ke Excel.`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
        if (!rows.length) {
          onToast('Berkas Excel tidak memiliki baris data.', true);
          return;
        }
        // Build label -> fieldKey lookup as fallback if user uploaded human headers
        const labelMap = new Map<string, FieldKey>();
        DATA_FIELDS.forEach((f) => {
          labelMap.set(f.name.toLowerCase(), f.name);
          labelMap.set(f.label.toLowerCase(), f.name);
        });

        const now = Date.now();
        const imported: PpdbParticipant[] = rows.map((r, idx) => {
          const p = emptyParticipant();
          p.id = `ppdb_${now}_${idx}`;
          Object.entries(r).forEach(([k, val]) => {
            const key = labelMap.get(String(k).trim().toLowerCase());
            if (!key) return;
            p[key] = DATE_FIELDS.has(key) ? normalizeImportedDate(val) : String(val ?? '').trim();
          });
          return p;
        });

        commitParticipants(imported, `Impor ${imported.length} peserta PPDB dari Excel`, true);
        setCurrentIndex(0);
        onToast(`${imported.length} data peserta PPDB berhasil diimpor dari Excel.`);
      } catch (err) {
        onToast(`Gagal membaca Excel: ${err instanceof Error ? err.message : 'Format tidak valid'}`, true);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveSheetUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sheetUrlDraft.trim();
    savePpdbSheetUrl(cleaned);
    setSheetUrl(cleaned);
    setIsSheetModalOpen(false);
    if (cleaned) {
      pullFromSheet(true, cleaned);
    } else {
      setSyncStatus('Belum terhubung ke Google Sheet (mode lokal)');
      onToast('Tautan Google Sheet dihapus.');
    }
  };

  const handleSendToSiswa = () => {
    if (!currentParticipant) {
      onToast('Pilih peserta PPDB terlebih dahulu.', true);
      return;
    }
    if (!currentParticipant.nama_lengkap.trim()) {
      onToast('Nama lengkap peserta masih kosong.', true);
      return;
    }
    const existingSiswa = getSiswas();
    const normName = currentParticipant.nama_lengkap.trim().toLowerCase();
    const duplicate = existingSiswa.find((s) => s.nama.trim().toLowerCase() === normName);
    if (duplicate) {
      onToast(`"${duplicate.nama}" sudah terdaftar di Data Siswa (Kelas ${duplicate.kelas}).`, true);
      return;
    }
    const kelasRaw = (currentParticipant.kelas_diterima || '1').replace(/[^0-9]/g, '') || '1';
    const jk: 'L' | 'P' = currentParticipant.jenis_kelamin.toLowerCase().startsWith('p') ? 'P' : 'L';
    const yearMatch = /\d{4}/.exec(currentParticipant.tanggal_diterima || '') || /\d{4}/.exec(config.tahunAjaran || '');
    const tahunMasuk = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();

    const newSiswa: Siswa = {
      id: `s_ppdb_${Date.now()}`,
      nama: currentParticipant.nama_lengkap.trim().toUpperCase(),
      jk,
      agama: currentParticipant.agama || 'Islam',
      warga: currentParticipant.kewarganegaraan || 'WNI',
      tempatLahir: currentParticipant.tempat_lahir || config.kabupaten || 'Cirebon',
      tglLahir: currentParticipant.tanggal_lahir || undefined,
      kelas: kelasRaw,
      rombel: `${kelasRaw}A`,
      status: 'Aktif',
      tahunMasuk,
      alamat: [currentParticipant.alamat, currentParticipant.alamat_2].filter(Boolean).join(' '),
      namaAyah: currentParticipant.nama_ayah?.trim().toUpperCase(),
      namaIbu: currentParticipant.nama_ibu?.trim().toUpperCase(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveSiswa(newSiswa);
    onToast(`"${newSiswa.nama}" berhasil dimasukkan ke Data Siswa Kelas ${newSiswa.kelas}.`);
  };

  const handlePrintSingle = () => {
    if (!singlePrintRef.current) return;
    printDomElement(singlePrintRef.current, {
      paper: 'A4',
      margin: '10mm 12mm',
    });
  };

  const handlePrintAll = () => {
    if (!allPrintRef.current || participants.length === 0) return;
    printDomElement(allPrintRef.current, {
      paper: 'A4',
      margin: '10mm 12mm',
    });
  };

  const nssDigits = useMemo(() => {
    const raw = (config.nss || '101021734018').replace(/\D/g, '').padEnd(12, ' ').slice(0, 12);
    return raw.split('');
  }, [config.nss]);

  const schoolMeta = useMemo(
    () => ({
      namaSekolah: config.namaSekolah || 'SD Negeri 2 Cempaka',
      statusSekolah: config.statusSekolah || 'Negeri',
      desa: config.desa || 'Cempaka',
      kecamatan: config.kecamatan || 'Talun',
      kabupaten: config.kabupaten || 'Cirebon',
      propinsi: config.propinsi || 'Jawa Barat',
      tahunPelajaran: config.tahunAjaran || '2026/2027',
      kepsek: formatGelarInText(config.kepsek || 'H. KAERUDIN, M.Pd.'),
      nipKepsek: config.nipKepsek || '19720904 199412 1 001',
      tempatTtd: config.tempatLaporan || config.kecamatan || 'Talun',
    }),
    [config]
  );

  const fv = (p: PpdbParticipant | null, name: FieldKey, extraClass = '') => {
    const text = p ? formatFieldDisplay(name, p[name]) : '';
    const isUpperBold = FULL_UPPERCASE_FIELDS.has(name);
    return (
      <span
        className={`ppdb-fv ${extraClass} ${isUpperBold ? 'ppdb-fv-upper-bold' : ''}`.trim()}
        data-name={name}
      >
        {text}
      </span>
    );
  };

  const renderPaper = (p: PpdbParticipant | null, keyPrefix = 'preview', multiClass = '') => {
    const tglSuratRaw = p ? formatFieldDisplay('tanggal_surat', p.tanggal_surat) : '';
    const hasYearInTglSurat = /\b(?:19|20)\d{2}\b/.test(tglSuratRaw);
    const defaultYear = /\b(20\d{2})\b/.exec(schoolMeta.tahunPelajaran)?.[1] || String(new Date().getFullYear());

    return (
      <div key={keyPrefix} className={`ppdb-paper ${multiClass}`.trim()}>
        {/* Top line: Format M 1 & 12-box NSS */}
        <div className="ppdb-topline">
          <div className="ppdb-format-box">Format : M 1</div>
          <div className="ppdb-nss">
            <div className="ppdb-nss-title">Nomor Statistik Sekolah</div>
            <div className="ppdb-nss-boxes">
              {nssDigits.map((d, idx) => (
                <span key={idx} className="ppdb-nss-box">
                  {d.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* School header info */}
        <div className="ppdb-school">
          <h1>FORMULIR PENERIMAAN PESERTA DIDIK BARU</h1>
          <p>
            <span className="ppdb-school-label">Nama Sekolah</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.namaSekolah}
          </p>
          <p>
            <span className="ppdb-school-label">Status Sekolah</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.statusSekolah}
          </p>
          <p>
            <span className="ppdb-school-label">Desa</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.desa}
          </p>
          <p>
            <span className="ppdb-school-label">Kecamatan</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.kecamatan}
          </p>
          <p>
            <span className="ppdb-school-label">Kabupaten</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.kabupaten}
          </p>
          <p>
            <span className="ppdb-school-label">Propinsi</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.propinsi}
          </p>
          <p>
            <span className="ppdb-school-label">Tahun Pelajaran</span>
            <span className="ppdb-school-colon">:</span> {schoolMeta.tahunPelajaran}
          </p>
        </div>

        {/* Section A */}
        <div className="ppdb-section">A. KETERANGAN ANAK :</div>
        <table className="ppdb-form-table">
          <tbody>
            <tr>
              <td className="ppdb-num">1.</td>
              <td className="ppdb-label">Nama lengkap</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'nama_lengkap')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">2.</td>
              <td className="ppdb-label">Nama panggilan</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'nama_panggilan')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">3.</td>
              <td className="ppdb-label">Jenis Kelamin</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'jenis_kelamin')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">4.</td>
              <td className="ppdb-label">dilahirkan</td>
              <td className="ppdb-sep">:</td>
              <td>
                <div className="ppdb-inline-line">
                  <span>tanggal</span>
                  {fv(p, 'tanggal_lahir')}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td />
              <td />
              <td>
                <div className="ppdb-inline-line">
                  <span>di</span>
                  {fv(p, 'tempat_lahir')}
                </div>
              </td>
            </tr>
            <tr>
              <td className="ppdb-num">5.</td>
              <td className="ppdb-label">Agama</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'agama')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">6.</td>
              <td className="ppdb-label">kewarganegaraan</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'kewarganegaraan')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">7.</td>
              <td className="ppdb-label">Anak Nomor ke</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'anak_nomor_ke', 'small')} (dari satu ibu)</td>
            </tr>
            <tr>
              <td className="ppdb-num">8.</td>
              <td className="ppdb-label">Banyaknya saudara kandung</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'saudara_kandung', 'small')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">9.</td>
              <td className="ppdb-label">Banyaknya saudara tiri</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'saudara_tiri', 'small')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">10.</td>
              <td className="ppdb-label">Banyaknya saudara angkat</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'saudara_angkat', 'small')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">11.</td>
              <td className="ppdb-label">Bahasa sehari-hari</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'bahasa_sehari_hari')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">12.</td>
              <td className="ppdb-label">Berat badan</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'berat_badan', 'small')} Kg.</td>
            </tr>
            <tr>
              <td className="ppdb-num">13.</td>
              <td className="ppdb-label">Tinggi Badan</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'tinggi_badan', 'small')} Cm.</td>
            </tr>
            <tr>
              <td className="ppdb-num">14.</td>
              <td className="ppdb-label">Golongan Darah</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'golongan_darah', 'small')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">15.</td>
              <td className="ppdb-label">Penyakit yang pernah diderita</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'penyakit')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">16.</td>
              <td className="ppdb-label">Alamat, No. telepon, tempat tinggal</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'alamat')}</td>
            </tr>
            <tr>
              <td />
              <td />
              <td />
              <td>{fv(p, 'alamat_2')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">17.</td>
              <td className="ppdb-label">Bertempat tinggal pada</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'tempat_tinggal')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">18.</td>
              <td className="ppdb-label">Jarak tempat tinggal dengan sekolah</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'jarak_sekolah')}</td>
            </tr>
          </tbody>
        </table>

        {/* Section B */}
        <div className="ppdb-section" style={{ marginTop: '6mm' }}>
          B. KETERANGAN ORANG TUA/WALI
        </div>
        <table className="ppdb-form-table">
          <tbody>
            <tr>
              <td className="ppdb-num">19.</td>
              <td className="ppdb-label">Nama</td>
              <td className="ppdb-sep" />
              <td>
                <div className="ppdb-inline-line">
                  <span>ayah kandung</span>
                  <span className="ppdb-sep">:</span>
                  {fv(p, 'nama_ayah')}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td />
              <td />
              <td>
                <div className="ppdb-inline-line">
                  <span>ibu kandung</span>
                  <span className="ppdb-sep">:</span>
                  {fv(p, 'nama_ibu')}
                </div>
              </td>
            </tr>
            <tr>
              <td className="ppdb-num">20.</td>
              <td className="ppdb-label">Pendidikan tertinggi</td>
              <td />
              <td>
                <div className="ppdb-inline-line">
                  <span>ayah kandung</span>
                  <span className="ppdb-sep">:</span>
                  {fv(p, 'pendidikan_ayah')}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td />
              <td />
              <td>
                <div className="ppdb-inline-line">
                  <span>ibu kandung</span>
                  <span className="ppdb-sep">:</span>
                  {fv(p, 'pendidikan_ibu')}
                </div>
              </td>
            </tr>
            <tr>
              <td className="ppdb-num">21.</td>
              <td className="ppdb-label">Pekerjaan</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'pekerjaan_orangtua')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">22.</td>
              <td className="ppdb-label">Nama Wali Murid (jika ada)</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'nama_wali')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">23.</td>
              <td className="ppdb-label">Pendidikan tertinggi</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'pendidikan_wali')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">24.</td>
              <td className="ppdb-label">Hubungan terhadap anak</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'hubungan_wali')}</td>
            </tr>
            <tr>
              <td className="ppdb-num">25.</td>
              <td className="ppdb-label">Pekerjaan/jabatan</td>
              <td className="ppdb-sep">:</td>
              <td>{fv(p, 'pekerjaan_wali')}</td>
            </tr>
          </tbody>
        </table>

        {/* Page Break -> Halaman 2 */}
        <div className="ppdb-page-break" />

        <div className="ppdb-page-2">
          <div className="ppdb-section">C. ASAL MULA ANAK</div>
          <table className="ppdb-form-table">
            <tbody>
              <tr>
                <td className="ppdb-num">26.</td>
                <td className="ppdb-label">Masuk sekolah ini sebagai</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'status_masuk')}</td>
              </tr>
              <tr>
                <td />
                <td />
                <td />
                <td>(jika pindahan teruskan no. 27)</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">a. Asal anak</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'asal_anak')}</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">b. Nama taman kanak-kanak</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'nama_tk')}</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">c. Tahun dan nomor STTB</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'sttb')}</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">d. lama belajar</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'lama_belajar', 'small')} tahun</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-note-line">(lanjut ke nomor 28)</td>
                <td />
                <td />
              </tr>
              <tr>
                <td className="ppdb-num">27.</td>
                <td className="ppdb-label">Pindahan dari</td>
                <td />
                <td />
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">a. Nama sekolah asal</td>
                <td className="ppdb-sep">:</td>
                <td>
                  {fv(p, 'sekolah_asal', 'medium')} di {fv(p, 'sekolah_asal_lokasi', 'medium')}
                </td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">b. Tanggal</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'tanggal_pindahan')}</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">c. Dari kelas</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'dari_kelas', 'small')}</td>
              </tr>
              <tr>
                <td className="ppdb-num">28.</td>
                <td className="ppdb-label">Diterima di sekolah ini</td>
                <td />
                <td />
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">a. tanggal</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'tanggal_diterima')}</td>
              </tr>
              <tr>
                <td />
                <td className="ppdb-sub">b. di kelas</td>
                <td className="ppdb-sep">:</td>
                <td>{fv(p, 'kelas_diterima', 'small')}</td>
              </tr>
            </tbody>
          </table>

          <div className="ppdb-signature">
            <div />
            <div className="ppdb-date">
              {schoolMeta.tempatTtd},{' '}
              <span className="ppdb-fv" style={{ width: '42mm', display: 'inline-block' }}>
                {tglSuratRaw}
              </span>
              {!hasYearInTglSurat ? ` ${defaultYear}` : ''}
            </div>
            <div>
              <div>Kepala Sekolah,</div>
              <div className="ppdb-signspace" />
              <div className="ppdb-name">{schoolMeta.kepsek}</div>
              <div>NIP. {schoolMeta.nipKepsek}</div>
            </div>
            <div>
              <div>Orang Tua/Wali</div>
              <div className="ppdb-signspace" />
              <div>(....................................)</div>
            </div>
          </div>

          <div className="ppdb-note">
            <div>CATATAN :</div>
            <div>*) CORET YANG TIDAK PERLU</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#13262A] font-display">
            Formulir PPDB (Format : M 1)
          </h1>
          <p className="text-xs text-[#566A6E] mt-0.5">
            Formulir Penerimaan Peserta Didik Baru — kelola data peserta secara tabel, impor/ekspor Excel, sinkron Google Sheet, & cetak A4 presisi.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#566A6E]">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D3DDD9] font-semibold text-[#13262A]">
            {participants.length} Peserta PPDB
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D3DDD9] truncate max-w-[260px]" title={syncStatus}>
            {syncStatus}
          </span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] shadow-xs flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePrintSingle}
          className="px-3.5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
        >
          <Printer className="w-3.5 h-3.5" /> Cetak Formulir
        </button>

        {participants.length > 1 && (
          <button
            type="button"
            onClick={handlePrintAll}
            className="px-3 py-2 bg-[#0E7490] hover:bg-[#0B5F75] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Semua ({participants.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (currentIndex < 0 && participants.length > 0) setCurrentIndex(0);
            setIsManageOpen(true);
          }}
          className="px-3.5 py-2 bg-[#1D7A3A] hover:bg-[#17622E] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
        >
          <Users className="w-3.5 h-3.5" /> Kelola Data Peserta
        </button>

        <input
          ref={excelInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleImportExcel}
        />
        <button
          type="button"
          onClick={() => excelInputRef.current?.click()}
          className="px-3 py-2 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-[#0B6B58]" /> Import Excel
        </button>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="px-3 py-2 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#0B6B58]" /> Template Excel
        </button>

        <button
          type="button"
          onClick={handleExportExcel}
          className="px-3 py-2 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B6B58]" /> Export Excel
        </button>

        {currentParticipant && (
          <button
            type="button"
            onClick={handleSendToSiswa}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            title="Salin data peserta ini ke Data Siswa aktif"
          >
            <UserPlus className="w-3.5 h-3.5" /> Masukkan ke Data Siswa
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSheetUrlDraft(sheetUrl);
              setIsSheetModalOpen(true);
            }}
            className="px-3 py-2 bg-white hover:bg-gray-50 border border-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5 text-[#0B6B58]" /> Hubungkan Google Sheet
          </button>

          <button
            type="button"
            onClick={() => pullFromSheet(true)}
            disabled={isPullingSheet}
            className="px-3 py-2 bg-white hover:bg-gray-50 border border-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0B6B58] ${isPullingSheet ? 'animate-spin' : ''}`} /> Ambil Data Terbaru
          </button>

          {participants.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Data
            </button>
          )}
        </div>
      </div>

      {/* Locked Preview Notice */}
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          Formulir di bawah ini <strong>terkunci</strong> dan hanya menampilkan pratinjau dari data pusat peserta didik. Untuk menambah peserta baru atau mengubah data, klik tombol <strong>&quot;Kelola Data Peserta&quot;</strong> di atas, lalu gunakan panel navigasi di samping formulir untuk berpindah antar peserta.
        </div>
      </div>

      {/* Paper Preview + Sticky Side Nav */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4">
        {/* Side Nav (top on mobile, sticky right on desktop) */}
        <div className="lg:order-2 lg:sticky lg:top-6 bg-white border border-[#D3DDD9] rounded-xl shadow-xs p-3 flex lg:flex-col items-center gap-2.5 shrink-0 w-full lg:w-52">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!participants.length) return;
                setCurrentIndex((prev) => (prev <= 0 ? participants.length - 1 : prev - 1));
              }}
              disabled={!participants.length}
              className="p-2 bg-[#475569] hover:bg-[#334155] disabled:opacity-40 text-white rounded-lg cursor-pointer transition"
              title="Peserta sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs font-bold text-[#13262A] min-w-[60px] text-center">
              {participants.length > 0 ? `${currentIndex + 1} / ${participants.length}` : '0 / 0'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!participants.length) return;
                setCurrentIndex((prev) => (prev >= participants.length - 1 ? 0 : prev + 1));
              }}
              disabled={!participants.length}
              className="p-2 bg-[#475569] hover:bg-[#334155] disabled:opacity-40 text-white rounded-lg cursor-pointer transition"
              title="Peserta berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {participants.length > 0 ? (
            <div className="w-full space-y-1.5">
              <select
                value={currentIndex}
                onChange={(e) => setCurrentIndex(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-[#F8FAF9] font-semibold text-[#13262A]"
              >
                {participants.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    {idx + 1}. {participantLabel(p, idx)}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-[#566A6E] text-center truncate">
                {currentParticipant?.nama_lengkap
                  ? currentParticipant.nama_lengkap.toUpperCase()
                  : 'Belum diisi nama'}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-[#566A6E] text-center">
              Belum ada peserta PPDB. Klik <b>Kelola Data Peserta</b> atau <b>Import Excel</b>.
            </div>
          )}
        </div>

        {/* Formulir A4 Sheet */}
        <div className="lg:order-1 overflow-x-auto max-w-full pb-4">
          <div ref={singlePrintRef}>{renderPaper(currentParticipant, 'single_preview')}</div>
        </div>
      </div>

      {/* Off-screen Print Target for Print All */}
      {participants.length > 1 && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-99999px',
            top: 0,
            width: '210mm',
            pointerEvents: 'none',
            opacity: 0,
          }}
        >
          <div ref={allPrintRef}>
            {participants.map((p, idx) => renderPaper(p, `all_${p.id}_${idx}`, 'ppdb-sheet-multi'))}
          </div>
        </div>
      )}

      {/* MODAL: KELOLA DATA PESERTA (FORMAT TABEL SPREADSHEET) */}
      {isManageOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsManageOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] w-full max-w-[96vw] max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-[#13262A] text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#7EE3C8]" />
                <h2 className="text-sm sm:text-base font-bold font-display">
                  Kelola Data Peserta Didik PPDB (Format Tabel)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 bg-[#1D7A3A] hover:bg-[#17622E] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Baris
                </button>
                <button
                  type="button"
                  onClick={() => setIsManageOpen(false)}
                  className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white">
              <table className="ppdb-grid-table">
                <thead>
                  <tr className="ppdb-group-row">
                    <th className="ppdb-col-num" rowSpan={2}>
                      #
                    </th>
                    {GROUPED_FIELDS.map((g) => (
                      <th key={g.group} colSpan={g.fields.length}>
                        {g.group}
                      </th>
                    ))}
                    <th className="ppdb-col-action" rowSpan={2}>
                      Aksi
                    </th>
                  </tr>
                  <tr className="ppdb-head-row">
                    {DATA_FIELDS.map((f) => (
                      <th key={f.name}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={tableTbodyRef}>
                  {participants.length === 0 ? (
                    <tr>
                      <td colSpan={DATA_FIELDS.length + 2} className="p-6 text-center text-xs text-[#566A6E]">
                        Belum ada data peserta. Klik <b>&quot;Tambah Baris&quot;</b> untuk mulai, atau impor dari Excel.
                      </td>
                    </tr>
                  ) : (
                    participants.map((p, i) => (
                      <tr
                        key={p.id}
                        data-index={i}
                        className={i === currentIndex ? 'ppdb-active-row' : ''}
                      >
                        <td
                          className="ppdb-col-num"
                          onClick={() => setCurrentIndex(i)}
                          title="Klik untuk menampilkan peserta ini di formulir"
                        >
                          {i + 1}
                        </td>
                        {DATA_FIELDS.map((f) => (
                          <td key={f.name}>
                            {f.type === 'select' ? (
                              <select
                                value={p[f.name] || ''}
                                onChange={(e) => handleCellEdit(i, f.name, e.target.value)}
                              >
                                <option value="">-- Pilih --</option>
                                {f.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={f.type === 'date' ? 'date' : 'text'}
                                value={p[f.name] || ''}
                                onChange={(e) => handleCellEdit(i, f.name, e.target.value)}
                              />
                            )}
                          </td>
                        ))}
                        <td className="ppdb-col-action">
                          <button
                            type="button"
                            onClick={() => setDeleteTargetIdx(i)}
                            className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs cursor-pointer transition"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 bg-[#F8FAF9] border-t border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 text-xs text-[#566A6E]">
              <span>
                {currentParticipant
                  ? `Ditampilkan di formulir: ${participantLabel(currentParticipant, currentIndex)}`
                  : 'Belum ada peserta dipilih'}
              </span>
              <span className="hidden sm:inline">
                Klik nomor baris (#) untuk menampilkannya di formulir. Data tersimpan otomatis saat diketik.
              </span>
              <button
                type="button"
                onClick={() => {
                  if (currentIndex < 0 && participants.length > 0) setCurrentIndex(0);
                  setIsManageOpen(false);
                }}
                className="px-4 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition"
              >
                <Check className="w-3.5 h-3.5" /> Tutup & Tampilkan di Formulir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HUBUNGKAN GOOGLE SHEET */}
      {isSheetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSheetModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D3DDD9]">
              <h3 className="text-sm font-bold text-[#13262A] font-display flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0B6B58]" /> Hubungkan Google Sheet (Apps Script Web App)
              </h3>
              <button
                type="button"
                onClick={() => setIsSheetModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSheetUrl} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">
                  URL Web App Google Apps Script
                </label>
                <input
                  type="url"
                  value={sheetUrlDraft}
                  onChange={(e) => setSheetUrlDraft(e.target.value)}
                  placeholder="https://script.google.com/macros/s/xxxxx/exec"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono text-xs"
                />
                <p className="text-[11px] text-[#566A6E] mt-1.5 leading-relaxed">
                  Pastikan deployment Google Apps Script diatur <b>Who has access: Anyone</b>. Kosongkan lalu simpan jika ingin menonaktifkan sinkronisasi Google Sheet.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSheetModalOpen(false)}
                  className="px-3.5 py-2 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-bold rounded-lg cursor-pointer"
                >
                  Simpan & Sinkronkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS SATU BARIS */}
      {deleteTargetIdx !== null && participants[deleteTargetIdx] && (
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#13262A]">Hapus Data Peserta?</h3>
                <p className="text-xs text-[#566A6E] mt-1">
                  Hapus data <b>{participantLabel(participants[deleteTargetIdx], deleteTargetIdx)}</b>? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetIdx(null)}
                className="px-3.5 py-1.5 text-xs bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRow}
                className="px-3.5 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS SEMUA */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#13262A]">Hapus Semua Data PPDB?</h3>
                <p className="text-xs text-[#566A6E] mt-1">
                  Seluruh {participants.length} data peserta PPDB akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-3.5 py-1.5 text-xs bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3.5 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
