/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { SchoolConfig, Siswa } from '../types';
import { importBulkSiswas, ImportBulkSiswaResult } from '../lib/storage';
import {
  parseDapodikSiswaFile,
  combineAllSheetsDapodik,
  DapodikSiswaParseResult,
  DapodikWorkbookSheet,
  parseDapodikSiswaRows,
} from '../lib/dapodikSiswaImport';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Users,
  Layers,
  ArrowRight,
  RefreshCw,
  Building2,
  Info,
} from 'lucide-react';

interface ImportDapodikSiswaModalProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ImportBulkSiswaResult, count: number) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const ImportDapodikSiswaModal: React.FC<ImportDapodikSiswaModalProps> = ({
  role,
  config,
  isOpen,
  onClose,
  onSuccess,
  onToast,
}) => {
  const isOperator = role === 'operator';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<DapodikWorkbookSheet[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [isCombinedAll, setIsCombinedAll] = useState(false);
  const [parsedResult, setParsedResult] = useState<DapodikSiswaParseResult | null>(null);

  // Settings
  const [importMode, setImportMode] = useState<'merge' | 'add_only' | 'replace'>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [searchPreview, setSearchPreview] = useState('');
  const [filterKelasPreview, setFilterKelasPreview] = useState('');

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const { result, sheets } = await parseDapodikSiswaFile(file);
      setImportFile(file);
      setAvailableSheets(sheets);
      setIsCombinedAll(false);

      const chosenIdx = sheets.findIndex((s) => s.name === result.sheetName);
      setSelectedSheetIndex(chosenIdx >= 0 ? chosenIdx : 0);
      setParsedResult(result);

      if (result.items.length === 0) {
        onToast('Tidak ditemukan data siswa pada berkas. Pastikan ada baris Nama, NISN/NIPD, dan Kelas.', true);
      } else {
        onToast(`Terbaca ${result.items.length} data siswa dari "${file.name}".`);
      }
    } catch (err: any) {
      console.error('Dapodik import error:', err);
      onToast(err?.message || 'Gagal membaca berkas Dapodik.', true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSheetSelect = (idx: number) => {
    if (idx === -1) {
      // Gabungkan semua sheet
      setIsCombinedAll(true);
      const combined = combineAllSheetsDapodik(availableSheets);
      setParsedResult(combined);
      return;
    }

    const sheet = availableSheets[idx];
    if (!sheet) return;
    setIsCombinedAll(false);
    setSelectedSheetIndex(idx);
    const next = parseDapodikSiswaRows(sheet.rows, sheet.name);
    next.availableSheets = availableSheets.map((s) => s.name);
    setParsedResult(next);
  };

  const handleExecuteImport = () => {
    if (!parsedResult || !parsedResult.items.length) {
      onToast('Tidak ada data siswa yang bisa diimpor.', true);
      return;
    }

    if (importMode === 'replace' && !isOperator) {
      onToast('Hanya Operator yang berhak mengganti total seluruh data siswa.', true);
      return;
    }

    if (importMode === 'replace' && !confirmReplace) {
      onToast('Centang konfirmasi penggantian seluruh data siswa sebelum melanjutkan.', true);
      return;
    }

    try {
      const result = importBulkSiswas(parsedResult.items, importMode);
      onSuccess(result, parsedResult.items.length);
      handleReset();
      onClose();
    } catch (err: any) {
      console.error('Import save error:', err);
      onToast(err?.message || 'Gagal menyimpan data ke sistem.', true);
    }
  };

  const handleReset = () => {
    setImportFile(null);
    setAvailableSheets([]);
    setParsedResult(null);
    setIsCombinedAll(false);
    setSelectedSheetIndex(0);
    setConfirmReplace(false);
    setSearchPreview('');
    setFilterKelasPreview('');
  };

  const previewList = (parsedResult?.items || []).filter((s) => {
    const term = searchPreview.toLowerCase().trim();
    const matchTerm =
      !term ||
      s.nama.toLowerCase().includes(term) ||
      (s.nisn && s.nisn.includes(term)) ||
      (s.nis && s.nis.includes(term)) ||
      (s.namaIbu && s.namaIbu.toLowerCase().includes(term)) ||
      (s.alamat && s.alamat.toLowerCase().includes(term));
    const matchKelas = !filterKelasPreview || s.kelas === filterKelasPreview;
    return matchTerm && matchKelas;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-4xl w-full p-5 sm:p-6 space-y-4 my-6 text-xs max-h-[94vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E6EDEA] pb-3 flex-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F2EE] flex items-center justify-center text-[#0B6B58] flex-none">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#13262A] font-display">
                  Impor Data Peserta Didik (Dapodik)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F2EE] text-[#0B6B58]">
                  PD Dapodik
                </span>
              </div>
              <p className="text-[11px] text-[#566A6E] mt-0.5">
                Unggah berkas ekspor profil siswa dari Aplikasi Dapodik / SP Datadik (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 text-[#566A6E] hover:text-[#13262A] rounded-lg hover:bg-gray-100 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* STEP 1: Upload Dropzone if no file processed */}
          {!parsedResult ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleProcessFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-[#0B6B58] bg-[#E6F2EE]/50'
                  : 'border-[#C2D1CD] hover:border-[#0B6B58] bg-[#F8FBFA]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleProcessFile(f);
                  e.target.value = '';
                }}
              />
              {isProcessing ? (
                <div className="py-8 space-y-3">
                  <div className="w-9 h-9 border-3 border-[#0B6B58] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-[#13262A]">
                    Membaca struktur data siswa dari berkas Dapodik...
                  </p>
                  <p className="text-[11px] text-[#566A6E]">
                    Mengekstrak NISN, NIPD/NIS, nama rombel, tanggal lahir, dan biodata orang tua.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-[#E6F2EE] flex items-center justify-center text-[#0B6B58] mx-auto shadow-xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#13262A]">
                      Tarik berkas Data Peserta Didik ke sini, atau klik untuk memilih
                    </p>
                    <p className="text-[11px] text-[#566A6E] mt-1">
                      Mendukung format <b>.xlsx</b>, <b>.xls</b> (unduhan Dapodik / SP Datadik), serta <b>.csv</b>
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] text-[#566A6E]">
                    <span className="bg-white border border-[#D3DDD9] px-2.5 py-1 rounded-md font-medium">
                      ✓ Kolom Dapodik Dikenali Otomatis
                    </span>
                    <span className="bg-white border border-[#D3DDD9] px-2.5 py-1 rounded-md font-medium">
                      ✓ Deteksi Rombel & Kelas Otomatis
                    </span>
                    <span className="bg-white border border-[#D3DDD9] px-2.5 py-1 rounded-md font-medium">
                      ✓ Konversi Tanggal & NISN 10 Digit
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: File parsed - Preview & Options */
            <div className="space-y-4">
              {/* File Info & Sheet Selector */}
              <div className="bg-[#F8FBFA] border border-[#E6EDEA] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-[240px]">
                  <div className="w-8 h-8 rounded-lg bg-[#E6F2EE] text-[#0B6B58] flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#13262A] text-xs truncate max-w-xs">
                      {importFile?.name}
                    </div>
                    <div className="text-[10px] text-[#566A6E]">
                      {((importFile?.size || 0) / 1024).toFixed(1)} KB •{' '}
                      {parsedResult.items.length} siswa valid terbaca
                    </div>
                  </div>
                </div>

                {/* Multi-sheet selector if exists */}
                {availableSheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#566A6E]">Lembar (Sheet):</span>
                    <select
                      value={isCombinedAll ? -1 : selectedSheetIndex}
                      onChange={(e) => handleSheetSelect(Number(e.target.value))}
                      className="px-2.5 py-1 bg-white border border-[#D3DDD9] rounded-lg text-xs font-semibold text-[#13262A]"
                    >
                      {availableSheets.map((s, idx) => (
                        <option key={s.name} value={idx}>
                          {s.name} ({s.parsedCount} siswa)
                        </option>
                      ))}
                      <option value={-1}>
                        ★ Gabungkan Semua Sheet ({availableSheets.reduce((a, b) => a + b.parsedCount, 0)} siswa)
                      </option>
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#0B6B58] hover:bg-[#E6F2EE] rounded-lg transition cursor-pointer"
                >
                  Ganti Berkas
                </button>
              </div>

              {/* Detected School Header Info (if found in file) */}
              {(parsedResult.detectedSekolah || parsedResult.detectedNpsn) && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/70 rounded-xl flex items-center gap-2.5 text-blue-900">
                  <Building2 className="w-4 h-4 text-blue-600 flex-none" />
                  <div className="text-[11px]">
                    <span className="font-semibold">Informasi Terdeteksi: </span>
                    {parsedResult.detectedSekolah && <span>{parsedResult.detectedSekolah} </span>}
                    {parsedResult.detectedNpsn && (
                      <span className="font-mono text-[10px] bg-blue-100/70 px-1.5 py-0.5 rounded ml-1">
                        NPSN: {parsedResult.detectedNpsn}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white border border-[#D3DDD9] rounded-xl p-3">
                  <div className="text-[10px] text-[#566A6E] font-medium">Total Siswa</div>
                  <div className="text-xl font-bold text-[#13262A] font-display mt-0.5">
                    {parsedResult.totalRowsFound}
                  </div>
                  <div className="text-[10px] text-[#0B6B58] mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Siap diimpor
                  </div>
                </div>

                <div className="bg-white border border-[#D3DDD9] rounded-xl p-3">
                  <div className="text-[10px] text-[#566A6E] font-medium">Laki-laki / Perempuan</div>
                  <div className="text-lg font-bold text-[#13262A] font-display mt-0.5">
                    {parsedResult.totalLakiLaki} <span className="text-xs font-normal text-gray-500">L</span> •{' '}
                    {parsedResult.totalPerempuan} <span className="text-xs font-normal text-gray-500">P</span>
                  </div>
                  <div className="text-[10px] text-[#566A6E] mt-0.5">Jenis kelamin valid</div>
                </div>

                <div className="bg-white border border-[#D3DDD9] rounded-xl p-3">
                  <div className="text-[10px] text-[#566A6E] font-medium">Sebaran Kelas</div>
                  <div className="text-xs font-bold text-[#13262A] mt-1 truncate">
                    {Object.entries(parsedResult.byKelas)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([k, cnt]) => `K${k}: ${cnt}`)
                      .join(' • ') || '-'}
                  </div>
                  <div className="text-[10px] text-[#566A6E] mt-0.5">Tingkat 1 - 6</div>
                </div>

                <div className="bg-white border border-[#D3DDD9] rounded-xl p-3">
                  <div className="text-[10px] text-[#566A6E] font-medium">Rombel Terbaca</div>
                  <div className="text-xs font-bold text-[#13262A] mt-1 truncate" title={parsedResult.rombelList.join(', ')}>
                    {parsedResult.rombelList.length > 0
                      ? `${parsedResult.rombelList.length} Rombel (${parsedResult.rombelList.slice(0, 3).join(', ')}${
                          parsedResult.rombelList.length > 3 ? '...' : ''
                        })`
                      : 'Bawaan Kelas'}
                  </div>
                  <div className="text-[10px] text-[#566A6E] mt-0.5">Rombongan belajar</div>
                </div>
              </div>

              {/* Import Mode Selection */}
              <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5 space-y-2.5">
                <div className="font-bold text-[#13262A] text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0B6B58]" />
                  Pilih Cara Penggabungan Data ke Sistem:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`border rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition ${
                      importMode === 'merge'
                        ? 'border-[#0B6B58] bg-[#E6F2EE]/30'
                        : 'border-[#E6EDEA] hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-[#0B6B58] focus:ring-[#0B6B58]"
                    />
                    <div>
                      <div className="font-bold text-[#13262A] text-xs">Perbarui & Tambah (Rekomendasi)</div>
                      <p className="text-[10px] text-[#566A6E] mt-0.5">
                        Memperbarui biodata siswa jika NISN / NIS / Nama sudah terdaftar, dan menambahkan siswa baru jika belum ada.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`border rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition ${
                      importMode === 'add_only'
                        ? 'border-[#0B6B58] bg-[#E6F2EE]/30'
                        : 'border-[#E6EDEA] hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="add_only"
                      checked={importMode === 'add_only'}
                      onChange={() => setImportMode('add_only')}
                      className="mt-0.5 text-[#0B6B58] focus:ring-[#0B6B58]"
                    />
                    <div>
                      <div className="font-bold text-[#13262A] text-xs">Hanya Tambah Baru</div>
                      <p className="text-[10px] text-[#566A6E] mt-0.5">
                        Hanya menambahkan siswa baru yang belum ada di database. Data siswa lama tidak akan diubah.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`border rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition ${
                      importMode === 'replace'
                        ? 'border-red-400 bg-red-50/40'
                        : 'border-[#E6EDEA] hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="font-bold text-red-700 text-xs">Ganti Seluruh Data Siswa</div>
                      <p className="text-[10px] text-[#566A6E] mt-0.5">
                        Mengganti total seluruh daftar siswa dengan berkas ini. Digunakan saat pembaruan tahun ajaran baru.
                      </p>
                    </div>
                  </label>
                </div>

                {importMode === 'replace' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-none mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <p className="text-[11px] font-semibold">
                        Perhatian: Opsi ini akan menghapus data siswa lama dan menggantikannya dengan {parsedResult.items.length} siswa dari berkas ini.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmReplace}
                          onChange={(e) => setConfirmReplace(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[11px] font-medium text-red-900">
                          Saya mengonfirmasi untuk mengganti seluruh data siswa aktif sekolah.
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Table Section */}
              <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[#13262A] text-xs">
                    Pratinjau Data Siswa ({previewList.length} dari {parsedResult.items.length})
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari siswa / NISN..."
                        value={searchPreview}
                        onChange={(e) => setSearchPreview(e.target.value)}
                        className="pl-8 pr-3 py-1 bg-[#F8FBFA] border border-[#D3DDD9] rounded-lg text-xs w-44"
                      />
                    </div>
                    <select
                      value={filterKelasPreview}
                      onChange={(e) => setFilterKelasPreview(e.target.value)}
                      className="px-2.5 py-1 bg-[#F8FBFA] border border-[#D3DDD9] rounded-lg text-xs"
                    >
                      <option value="">Semua Kelas</option>
                      {['1', '2', '3', '4', '5', '6'].map((k) => (
                        <option key={k} value={k}>
                          Kelas {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border border-[#E6EDEA] rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#F8FBFA] border-b border-[#E6EDEA] text-[#566A6E] sticky top-0 font-semibold">
                      <tr>
                        <th className="py-2 px-2.5 w-10 text-center">No</th>
                        <th className="py-2 px-2.5">Nama Peserta Didik</th>
                        <th className="py-2 px-2.5">NISN</th>
                        <th className="py-2 px-2.5">NIS/NIPD</th>
                        <th className="py-2 px-2 text-center">JK</th>
                        <th className="py-2 px-2.5">Tgl Lahir</th>
                        <th className="py-2 px-2 text-center">Kelas</th>
                        <th className="py-2 px-2.5">Nama Ibu / Ayah</th>
                        <th className="py-2 px-2.5">Alamat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6EDEA]">
                      {previewList.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-gray-400">
                            Tidak ada siswa yang cocok dengan filter pencarian.
                          </td>
                        </tr>
                      ) : (
                        previewList.slice(0, 100).map((s, idx) => (
                          <tr key={s.id || idx} className="hover:bg-[#F8FBFA]">
                            <td className="py-1.5 px-2.5 text-center text-gray-400 font-mono text-[10px]">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2.5 font-bold text-[#13262A] whitespace-nowrap">
                              {s.nama}
                              {s.catatan && (
                                <span className="block text-[9px] text-[#0B6B58] font-normal truncate max-w-[180px]">
                                  {s.catatan}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-gray-700 whitespace-nowrap">
                              {s.nisn || '-'}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-gray-700 whitespace-nowrap">
                              {s.nis || '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  s.jk === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                                }`}
                              >
                                {s.jk}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-gray-600 whitespace-nowrap">
                              {s.tglLahir || '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-[#13262A]">
                              {s.kelas}
                            </td>
                            <td className="py-1.5 px-2.5 text-gray-600 whitespace-nowrap truncate max-w-[140px]">
                              {s.namaIbu || s.namaAyah || '-'}
                            </td>
                            <td className="py-1.5 px-2.5 text-gray-500 truncate max-w-[180px]" title={s.alamat}>
                              {s.alamat || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {previewList.length > 100 && (
                  <div className="text-[10px] text-center text-[#566A6E] pt-1">
                    Menampilkan 100 dari {previewList.length} siswa (seluruh {parsedResult.items.length} data akan diproses saat impor).
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#E6EDEA] pt-3 flex items-center justify-between gap-3 flex-none">
          <div className="text-[11px] text-[#566A6E]">
            {parsedResult ? (
              <span>
                Total <b>{parsedResult.items.length} siswa</b> siap diimpor ke buku induk & kesiswaan.
              </span>
            ) : (
              <span>Format didukung: Berkas Excel (.xlsx, .xls) atau CSV dari Dapodik.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-3.5 py-2 border border-[#D3DDD9] hover:bg-gray-100 text-[#13262A] rounded-xl font-semibold cursor-pointer transition text-xs"
            >
              Batal
            </button>

            {parsedResult && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importMode === 'replace' && !confirmReplace}
                className={`px-4 py-2 rounded-xl font-semibold text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer text-xs ${
                  importMode === 'replace' && !confirmReplace
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#0B6B58] hover:bg-[#095747]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Impor {parsedResult.items.length} Data Siswa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
