/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { StikerBmd } from './StikerBmd';
import { SchoolConfig, Aset } from '../types';
import {
  getAsets,
  saveAset,
  saveAsets,
  deleteAset,
  getBmdItems,
  saveBmdItems,
  getStikerConfig,
  saveStikerConfig,
  subscribeToStorage,
  subscribeToCloudChanges,
} from '../lib/storage';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Search,
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from 'lucide-react';
import {
  parseSikatonFile,
  parseSikatonRows,
  convertToAsets,
  convertToBmdItems,
  ParsedSikatonRow,
  SikatonWorkbookSheet,
  SikatonParseResult,
} from '../lib/sikatonImport';

interface AsetInventarisProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

export const AsetInventaris: React.FC<AsetInventarisProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const [activeTab, setActiveTab] = useState<'daftar' | 'kir' | 'label' | 'bmd'>('daftar');
  const [asets, setAsets] = useState<Aset[]>(getAsets());

  const [searchTerm, setSearchTerm] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');

  // KIR specific
  const [selectedRuangan, setSelectedRuangan] = useState<string>('Semua Ruangan');
  const [penanggungJawab, setPenanggungJawab] = useState<string>('Rudi Hartono, S.Pd.');

  // Modal manual tambah/ubah
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAset, setEditingAset] = useState<Aset | null>(null);

  // Modal Import SIKATON
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<SikatonWorkbookSheet[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [parsedResult, setParsedResult] = useState<SikatonParseResult | null>(null);
  const [importMode, setImportMode] = useState<'tambah' | 'ganti'>('tambah');
  const [syncToBmd, setSyncToBmd] = useState<boolean>(true);
  const [syncSkpd, setSyncSkpd] = useState<boolean>(true);
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadData = () => {
    setAsets(getAsets());
  };

  useEffect(() => {
    const u1 = subscribeToStorage(reloadData);
    const u2 = subscribeToCloudChanges(reloadData);
    return () => {
      u1();
      u2();
    };
  }, []);

  const kibCategories = [
    'KIB A - Tanah',
    'KIB B - Peralatan dan Mesin',
    'KIB C - Gedung dan Bangunan',
    'KIB D - Jalan, Irigasi, dan Jaringan',
    'KIB E - Aset Tetap Lainnya',
  ];

  const ruanganList = Array.from(new Set(asets.map((a) => a.lokasi || 'Ruang Kelas 1').filter(Boolean))).sort();

  const filtered = asets.filter((a) => {
    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      a.nama.toLowerCase().includes(term) ||
      (a.kode && a.kode.toLowerCase().includes(term)) ||
      (a.lokasi && a.lokasi.toLowerCase().includes(term));
    const matchKategori = !filterKategori || a.kategori === filterKategori;
    const matchKondisi = !filterKondisi || a.kondisi === filterKondisi;
    return matchTerm && matchKategori && matchKondisi;
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isOperator) return;
    const form = new FormData(e.currentTarget);
    const record: Aset = {
      id: editingAset ? editingAset.id : `ast_${Date.now()}`,
      nama: String(form.get('nama')).trim(),
      kode: String(form.get('kode')).trim() || undefined,
      merk: String(form.get('merk')).trim() || undefined,
      noRegister: String(form.get('noRegister')).trim() || undefined,
      kategori: String(form.get('kategori')).trim() || kibCategories[1],
      jumlah: Number(form.get('jumlah')) || 1,
      kondisi: (form.get('kondisi') as any) || 'Baik',
      lokasi: String(form.get('lokasi')).trim() || 'Ruang Kelas 1',
      tahunPerolehan: Number(form.get('tahunPerolehan')) || new Date().getFullYear(),
      sumber: String(form.get('sumber')).trim() || 'BOS',
      harga: Number(form.get('harga')) || 0,
      keterangan: String(form.get('keterangan')).trim() || undefined,
      createdAt: editingAset ? editingAset.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    saveAset(record);
    reloadData();
    setIsModalOpen(false);
    setEditingAset(null);
    onToast(`Barang "${record.nama}" berhasil disimpan.`);
  };

  const handleDelete = (id: string, name: string) => {
    if (!isOperator) {
      onToast('Hanya Operator yang berhak menghapus data inventaris.', true);
      return;
    }
    if (window.confirm(`Hapus inventaris "${name}"?`)) {
      deleteAset(id);
      reloadData();
      onToast(`Barang "${name}" dihapus.`);
    }
  };

  const handleProcessFile = async (file: File) => {
    if (!isOperator) return;
    setIsProcessingFile(true);
    try {
      const { result, sheets } = await parseSikatonFile(file);
      setImportFile(file);
      setAvailableSheets(sheets);
      const chosenIdx = sheets.findIndex((s) => s.name === result.sheetName);
      setSelectedSheetIndex(chosenIdx >= 0 ? chosenIdx : 0);
      setParsedResult(result);
      if (result.items.length === 0) {
        onToast('Tidak ditemukan baris barang yang valid pada berkas yang dipilih.', true);
      } else {
        onToast(`Terbaca ${result.items.length} barang dari "${file.name}".`);
      }
    } catch (err: any) {
      console.error('Import error:', err);
      onToast(err?.message || 'Gagal memproses berkas SIKATON.', true);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleSheetSelect = (idx: number) => {
    const sheet = availableSheets[idx];
    if (!sheet) return;
    setSelectedSheetIndex(idx);
    const next = parseSikatonRows(sheet.rows, sheet.name);
    next.availableSheets = availableSheets.map((s) => s.name);
    setParsedResult(next);
  };

  const handleExecuteImport = () => {
    if (!isOperator) return;
    if (!parsedResult || !parsedResult.items.length) {
      onToast('Tidak ada data barang yang bisa diimpor.', true);
      return;
    }
    if (importMode === 'ganti' && !isOperator) {
      onToast('Hanya Operator yang berhak mengganti seluruh data inventaris.', true);
      return;
    }

    const newAsets = convertToAsets(parsedResult.items);
    const finalAsets = importMode === 'ganti' ? newAsets : [...asets, ...newAsets];

    saveAsets(
      finalAsets,
      `Impor ${newAsets.length} barang SIKATON (${importMode === 'ganti' ? 'ganti semua' : 'tambah'})`
    );

    if (syncToBmd) {
      const newBmd = convertToBmdItems(parsedResult.items);
      const existingBmd = getBmdItems();
      const finalBmd = importMode === 'ganti' ? newBmd : [...existingBmd, ...newBmd];
      saveBmdItems(finalBmd, `Sinkronisasi ${newBmd.length} stiker BMD dari impor SIKATON`);
    }

    if (syncSkpd && parsedResult.detectedSkpd) {
      const curCfg = getStikerConfig();
      saveStikerConfig({
        ...curCfg,
        kodeSkpd: parsedResult.detectedSkpd,
      });
    }

    reloadData();
    setIsImportModalOpen(false);
    setImportFile(null);
    setParsedResult(null);
    setAvailableSheets([]);
    onToast(`Berhasil mengimpor ${newAsets.length} data aset dari SIKATON.`);
  };

  const kirItems = asets.filter(
    (a) => selectedRuangan === 'Semua Ruangan' || (a.lokasi || 'Ruang Kelas 1') === selectedRuangan
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Aset & Inventaris Sarana Prasarana
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Pencatatan barang milik sekolah menurut golongan KIB A-E, Kartu Inventaris Ruangan (KIR), dan label stiker inventaris.
          </p>
        </div>

        {isOperator && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsImportModalOpen(true);
              }}
              className="px-3.5 py-2 bg-white border border-[#D3DDD9] hover:bg-[#F3F7F5] text-[#13262A] text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-2 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0B6B58]" /> Impor SIKATON (.xlsx / .csv)
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingAset(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Catat Barang Baru
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="no-print flex items-center gap-2 border-b border-[#D3DDD9] overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('daftar')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'daftar'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          Daftar Aset ({asets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('kir')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'kir'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          Kartu Inventaris Ruangan (KIR)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('label')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'label'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          Label Stiker Barang
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bmd')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'bmd'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          Cetak Stiker BMD
        </button>
      </div>

      {/* TAB 1: DAFTAR ASET */}
      {activeTab === 'daftar' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama barang, kode, atau ruangan lokasi..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
              />
            </div>

            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Golongan KIB</option>
              {kibCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterKondisi}
              onChange={(e) => setFilterKondisi(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Kondisi</option>
              <option value="Baik">Baik</option>
              <option value="Rusak ringan">Rusak Ringan</option>
              <option value="Rusak berat">Rusak Berat</option>
            </select>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Barang & Kode</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Golongan KIB</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Unit</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Kondisi</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Lokasi / Ruangan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Nilai Total</th>
                    {isOperator && (
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {filtered.map((a) => {
                    const totalVal = (a.jumlah || 1) * (a.harga || 0);
                    return (
                      <tr key={a.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#13262A] text-sm">{a.nama}</div>
                          <div className="text-[11px] font-mono text-[#566A6E]">
                            {a.kode || 'Tanpa kode'} {a.merk ? `\xB7 ${a.merk}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E8EFEC] text-[#13262A]">
                            {a.kategori}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono">{a.jumlah}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.kondisi === 'Baik'
                                ? 'bg-[#DDF1E3] text-[#1D7A3A]'
                                : a.kondisi === 'Rusak ringan'
                                ? 'bg-[#FBEFD0] text-[#8F5B00]'
                                : 'bg-[#FBE2DF] text-[#B3261E]'
                            }`}
                          >
                            {a.kondisi}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#566A6E]">{a.lokasi || '-'}</td>
                        <td className="py-3 px-4 text-right font-mono text-[#13262A]">
                          {totalVal > 0
                            ? new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                maximumFractionDigits: 0,
                              }).format(totalVal)
                            : '-'}
                        </td>
                        {isOperator && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAset(a);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                                title="Ubah Aset"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(a.id, a.nama)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Hapus Aset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isOperator ? 7 : 6} className="py-12 text-center text-[#566A6E]">
                        <Package className="w-10 h-10 text-[#A0B0AD] mx-auto mb-2 opacity-60" />
                        <p className="font-semibold text-sm text-[#13262A]">Tidak ada data barang yang sesuai</p>
                        <p className="text-xs text-[#566A6E] mt-1 max-w-md mx-auto">
                          {isOperator
                            ? 'Mulai catat barang baru atau impor berkas data aset resmi SIKATON (.xlsx / .csv).'
                            : 'Belum ada data barang inventaris yang sesuai pencarian.'}
                        </p>
                        {isOperator && (
                          <div className="mt-4 flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsImportModalOpen(true)}
                              className="px-3.5 py-1.5 bg-white border border-[#D3DDD9] hover:bg-[#F3F7F5] text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-2xs"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-[#0B6B58]" /> Impor SIKATON (.xlsx / .csv)
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KIR */}
      {activeTab === 'kir' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#566A6E]">Pilih Ruangan:</span>
              <select
                value={selectedRuangan}
                onChange={(e) => setSelectedRuangan(e.target.value)}
                className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-bold text-[#0B6B58]"
              >
                <option value="Semua Ruangan">Semua Ruangan</option>
                {ruanganList.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <span className="text-xs font-semibold text-[#566A6E] ml-2">Penanggung Jawab:</span>
              <input
                type="text"
                value={penanggungJawab}
                disabled={!isOperator}
                onChange={(e) => setPenanggungJawab(e.target.value)}
                className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg w-56 disabled:bg-gray-50 disabled:text-[#566A6E] disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak Lembar KIR
            </button>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl p-8 shadow-xs select-text print-sheet">
            <div className="text-center pb-4 border-b-2 border-black mb-6">
              <h2 className="text-lg font-bold font-serif uppercase tracking-wider">
                KARTU INVENTARIS RUANGAN (KIR)
              </h2>
              <div className="text-sm font-semibold uppercase">{config.namaSekolah}</div>
              <div className="text-xs text-gray-700">
                RUANGAN : <span className="font-bold underline">{selectedRuangan.toUpperCase()}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse border border-black mb-6">
              <thead>
                <tr className="bg-gray-100 text-center font-bold">
                  <th className="border border-black p-2 w-10">No</th>
                  <th className="border border-black p-2">Nama Barang / Jenis</th>
                  <th className="border border-black p-2">Merk / Model</th>
                  <th className="border border-black p-2">Kode Barang</th>
                  <th className="border border-black p-2 w-16">Tahun</th>
                  <th className="border border-black p-2 w-16">Jumlah</th>
                  <th className="border border-black p-2 w-24">Kondisi</th>
                  <th className="border border-black p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {kirItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                    <td className="border border-black p-2 font-bold">{item.nama}</td>
                    <td className="border border-black p-2">{item.merk || '-'}</td>
                    <td className="border border-black p-2 font-mono">{item.kode || '-'}</td>
                    <td className="border border-black p-2 text-center">{item.tahunPerolehan || '-'}</td>
                    <td className="border border-black p-2 text-center font-bold font-mono">{item.jumlah}</td>
                    <td className="border border-black p-2 text-center font-semibold">{item.kondisi}</td>
                    <td className="border border-black p-2">{item.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-end mt-12 text-xs">
              <div className="text-center w-64">
                <div>Mengetahui,</div>
                <div>Kepala Sekolah</div>
                <div className="h-16" />
                <div className="font-bold underline">{config.kepsek}</div>
                <div>NIP. {config.nipKepsek}</div>
              </div>
              <div className="text-center w-64">
                <div>
                  {config.kabupaten},{' '}
                  {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div>Penanggung Jawab Ruangan</div>
                <div className="h-16" />
                <div className="font-bold underline">{penanggungJawab}</div>
                <div>Pengelola Ruang</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STIKER LABEL */}
      {activeTab === 'label' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#566A6E]">
              Format stiker label inventaris barang siap cetak untuk ditempelkan pada fisik barang sekolah.
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak Label Stiker
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 print:grid-cols-3">
            {asets.map((a) => (
              <div
                key={a.id}
                className="border-2 border-[#0B6B58] rounded-xl p-3 bg-white text-xs space-y-1 shadow-2xs break-inside-avoid"
              >
                <div className="flex items-center justify-between border-b border-[#0B6B58] pb-1 text-[#0B6B58] font-bold text-[10px] uppercase">
                  <span>ASET SEKOLAH</span>
                  <span>{config.namaSekolah?.slice(0, 14)}</span>
                </div>
                <div className="font-bold text-[#13262A] text-xs pt-1 truncate">{a.nama}</div>
                <div className="font-mono text-[11px] text-[#0B6B58] font-bold">
                  {a.kode || 'KIB-B-000'}
                </div>
                <div className="text-[10px] text-gray-500 flex justify-between">
                  <span>Ruang: {a.lokasi || '-'}</span>
                  <span>Th: {a.tahunPerolehan || '2023'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CETAK STIKER BMD (SIKATON) */}
      {activeTab === 'bmd' && <StikerBmd role={role} config={config} onToast={onToast} />}

      {/* ADD / EDIT MODAL */}
      {isOperator && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <h3 className="text-base font-bold text-[#13262A] font-display">
              {editingAset ? 'Ubah Data Aset' : 'Pencatatan Aset / Inventaris Baru'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Barang *</label>
                <input
                  name="nama"
                  defaultValue={editingAset?.nama}
                  required
                  placeholder="Contoh: Meja Siswa Kayu Jati"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kode Barang</label>
                  <input
                    name="kode"
                    defaultValue={editingAset?.kode}
                    placeholder="Contoh: KIB-B-001"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Merk / Model</label>
                  <input
                    name="merk"
                    defaultValue={editingAset?.merk}
                    placeholder="Contoh: ASUS / Lokal"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Golongan KIB</label>
                  <select
                    name="kategori"
                    defaultValue={editingAset?.kategori || kibCategories[1]}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-medium"
                  >
                    {kibCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kondisi</label>
                  <select
                    name="kondisi"
                    defaultValue={editingAset?.kondisi || 'Baik'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak ringan">Rusak Ringan</option>
                    <option value="Rusak berat">Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jumlah Unit *</label>
                  <input
                    type="number"
                    min="1"
                    name="jumlah"
                    defaultValue={editingAset?.jumlah || 1}
                    required
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tahun Perolehan</label>
                  <input
                    type="number"
                    name="tahunPerolehan"
                    defaultValue={editingAset?.tahunPerolehan || 2023}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Sumber Dana</label>
                  <select
                    name="sumber"
                    defaultValue={editingAset?.sumber || 'BOS'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  >
                    <option value="BOS">BOS</option>
                    <option value="APBD">APBD</option>
                    <option value="APBN">APBN</option>
                    <option value="Hibah">Hibah</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Lokasi / Ruangan</label>
                <input
                  name="lokasi"
                  defaultValue={editingAset?.lokasi || 'Ruang Kelas 1'}
                  placeholder="Contoh: Ruang Kelas 4"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan Aset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPOR SIKATON */}
      {isOperator && isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-4xl w-full p-6 space-y-4 my-6 text-xs max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E6EDEA] pb-3 flex-none">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E6F2EE] flex items-center justify-center text-[#0B6B58]">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#13262A] font-display">
                    Impor Data Aset SIKATON / BMD
                  </h3>
                  <p className="text-[11px] text-[#566A6E]">
                    Unggah lembar kerja ekspor SIKATON (Excel .xlsx atau CSV) untuk disinkronkan ke daftar aset dan stiker label.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setParsedResult(null);
                  setAvailableSheets([]);
                }}
                className="p-1.5 text-[#566A6E] hover:text-[#13262A] rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Dropzone */}
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-[#0B6B58] bg-[#E6F2EE]/40'
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
                  {isProcessingFile ? (
                    <div className="py-6 space-y-3">
                      <div className="w-8 h-8 border-3 border-[#0B6B58] border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-semibold text-[#13262A]">Membaca struktur berkas Excel / CSV...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-full bg-[#E6F2EE] flex items-center justify-center text-[#0B6B58] mx-auto">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#13262A]">
                          Tarik berkas SIKATON ke sini, atau klik untuk memilih
                        </p>
                        <p className="text-[11px] text-[#566A6E] mt-1">
                          Mendukung berkas Excel Modern (<b>.xlsx</b>, <b>.xls</b>) serta berkas teks (<b>.csv</b>, <b>.tsv</b>)
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 text-[10px] text-[#0B6B58] bg-[#E6F2EE] px-3 py-1 rounded-full font-medium">
                        <span>Format SIKATON dikenali otomatis: DATA_BMD, KIB A-E, Kode Barang, ID Barang, Merk, Nilai, dll.</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File info banner */}
                  <div className="bg-[#F3F7F5] border border-[#D3DDD9] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-[#D3DDD9] flex items-center justify-center text-[#0B6B58]">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-[#13262A] text-xs flex items-center gap-2">
                          <span>{importFile?.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#566A6E] border border-[#D3DDD9]">
                            {((importFile?.size || 0) / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="text-[11px] text-[#566A6E] mt-0.5 flex flex-wrap items-center gap-2">
                          <span>Lembar aktif: <b>{parsedResult.sheetName}</b></span>
                          <span>&bull;</span>
                          <span className="text-[#0B6B58] font-bold">{parsedResult.totalRowsFound} barang terdeteksi</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setParsedResult(null);
                        setImportFile(null);
                        setAvailableSheets([]);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-[#D3DDD9] hover:bg-gray-50 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileUp className="w-3.5 h-3.5" /> Ganti Berkas
                    </button>
                  </div>

                  {/* Multi-sheet selector jika berkas memiliki lebih dari 1 sheet */}
                  {availableSheets.length > 1 && (
                    <div>
                      <label className="block text-[11px] font-bold text-[#566A6E] mb-1.5">
                        Pilih Lembar Kerja (Worksheet) Excel:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSheets.map((sh, idx) => (
                          <button
                            key={sh.name}
                            type="button"
                            onClick={() => handleSheetSelect(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                              selectedSheetIndex === idx
                                ? 'bg-[#0B6B58] text-white shadow-xs'
                                : 'bg-[#F1F4F2] text-[#566A6E] hover:bg-[#E5EBE8]'
                            }`}
                          >
                            <span>{sh.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                selectedSheetIndex === idx ? 'bg-white/20 text-white' : 'bg-white text-[#566A6E]'
                              }`}
                            >
                              {sh.parsedCount} barang
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata terdeteksi */}
                  {(parsedResult.detectedSkpd || parsedResult.detectedSekolah || parsedResult.detectedNpsn) && (
                    <div className="grid sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-[#D3DDD9]">
                      {parsedResult.detectedSkpd && (
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#566A6E]">Kode SKPD Terdeteksi</div>
                          <div className="font-mono font-bold text-[#13262A] text-xs">{parsedResult.detectedSkpd}</div>
                        </div>
                      )}
                      {parsedResult.detectedSekolah && (
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#566A6E]">Unit / Nama Sekolah</div>
                          <div className="font-bold text-[#13262A] text-xs truncate">{parsedResult.detectedSekolah}</div>
                        </div>
                      )}
                      {parsedResult.detectedNpsn && (
                        <div>
                          <div className="text-[10px] uppercase font-bold text-[#566A6E]">NPSN</div>
                          <div className="font-mono font-bold text-[#13262A] text-xs">{parsedResult.detectedNpsn}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pengaturan Impor */}
                  <div className="bg-[#FAFBFB] p-3.5 rounded-xl border border-[#D3DDD9] space-y-3">
                    <div className="font-bold text-[#13262A] text-xs">Opsi & Integrasi Impor</div>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-[#566A6E]">Metode Penggabungan Data</label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'tambah'}
                              onChange={() => setImportMode('tambah')}
                              className="text-[#0B6B58] focus:ring-[#0B6B58]"
                            />
                            <span><b>Tambahkan</b> ke daftar aset saat ini ({asets.length} ada)</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === 'ganti'}
                              onChange={() => setImportMode('ganti')}
                              className="text-[#0B6B58] focus:ring-[#0B6B58]"
                            />
                            <span className="text-amber-800"><b>Ganti seluruh</b> data aset (timpa data lama)</span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-[#566A6E]">Integrasi Tambahan</label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={syncToBmd}
                              onChange={(e) => setSyncToBmd(e.target.checked)}
                              className="rounded text-[#0B6B58] focus:ring-[#0B6B58]"
                            />
                            <span>Sinkronkan ke <b>Cetak Stiker BMD</b> (siap cetak 16-per-A4)</span>
                          </label>
                          {parsedResult.detectedSkpd && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={syncSkpd}
                                onChange={(e) => setSyncSkpd(e.target.checked)}
                                className="rounded text-[#0B6B58] focus:ring-[#0B6B58]"
                              />
                              <span>Perbarui Kode SKPD stiker ke <b>{parsedResult.detectedSkpd}</b></span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pratinjau Barang */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-[#13262A] text-xs">
                        Pratinjau Data Barang ({parsedResult.items.length} terdeteksi)
                      </div>
                      <input
                        type="search"
                        placeholder="Cari dalam pratinjau..."
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-[#D3DDD9] rounded-lg w-52"
                      />
                    </div>

                    <div className="border border-[#D3DDD9] rounded-xl overflow-hidden max-h-[220px] overflow-y-auto bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#F1F4F2] text-[#566A6E] sticky top-0 text-[10px] font-semibold uppercase">
                          <tr>
                            <th className="py-2 px-3 border-b border-[#D3DDD9] w-8">No</th>
                            <th className="py-2 px-3 border-b border-[#D3DDD9]">Kode / ID</th>
                            <th className="py-2 px-3 border-b border-[#D3DDD9]">Nama Barang & Merk</th>
                            <th className="py-2 px-3 border-b border-[#D3DDD9]">Golongan KIB</th>
                            <th className="py-2 px-3 border-b border-[#D3DDD9] text-center">Jml</th>
                            <th className="py-2 px-3 border-b border-[#D3DDD9] text-center">Kondisi</th>
                            <th className="py-2 px-3 border-b border-[#D3DDD9] text-right">Nilai / Harga</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6EDEA]">
                          {parsedResult.items
                            .filter((it) => {
                              if (!previewSearch) return true;
                              const q = previewSearch.toLowerCase();
                              return (
                                it.namaBarang.toLowerCase().includes(q) ||
                                it.kodeBarang.toLowerCase().includes(q) ||
                                it.idBarang.toLowerCase().includes(q) ||
                                (it.merkType || '').toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 50)
                            .map((it, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/70">
                                <td className="py-2 px-3 font-mono text-[11px]">{it.no || idx + 1}</td>
                                <td className="py-2 px-3 font-mono text-[11px]">
                                  <div className="font-semibold text-[#13262A]">{it.kodeBarang}</div>
                                  <div className="text-[#566A6E] text-[10px]">ID: {it.idBarang}</div>
                                </td>
                                <td className="py-2 px-3">
                                  <div className="font-bold text-[#13262A]">{it.namaBarang}</div>
                                  {it.merkType && (
                                    <div className="text-[10px] text-[#566A6E]">{it.merkType}</div>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E8EFEC] text-[#13262A]">
                                    {it.kategori}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center font-bold font-mono">{it.jumlah}</td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      it.kondisi === 'Baik'
                                        ? 'bg-[#DDF1E3] text-[#1D7A3A]'
                                        : it.kondisi === 'Rusak ringan'
                                        ? 'bg-[#FBEFD0] text-[#8F5B00]'
                                        : 'bg-[#FBE2DF] text-[#B3261E]'
                                    }`}
                                  >
                                    {it.kondisi}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-[#13262A]">
                                  {it.harga && it.harga > 0
                                    ? new Intl.NumberFormat('id-ID', {
                                        style: 'currency',
                                        currency: 'IDR',
                                        maximumFractionDigits: 0,
                                      }).format(it.harga * (it.jumlah || 1))
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E6EDEA] flex-none">
              <span className="text-[11px] text-[#566A6E]">
                {parsedResult
                  ? `Siap mengimpor ${parsedResult.items.length} barang ke inventaris.`
                  : 'Pilih berkas untuk memulai pratinjau.'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setParsedResult(null);
                    setAvailableSheets([]);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] hover:bg-gray-50 text-[#566A6E] rounded-lg cursor-pointer font-semibold"
                >
                  Batal
                </button>
                {parsedResult && parsedResult.items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Impor {parsedResult.items.length} Barang Sekarang
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
