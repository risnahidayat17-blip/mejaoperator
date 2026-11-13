/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SchoolConfig, ArsipLaporan as IArsipLaporan, FileRef } from '../types';
import {
  getArsipLaporan,
  saveArsipLaporanList,
  getCurrentUser,
  subscribeToStorage,
  subscribeToCloudChanges,
  recordActivity,
  flushCloudPushNow,
  syncFromCloud,
} from '../lib/storage';
import {
  prepareFile,
  saveFile,
  deleteFile,
  downloadFile,
  openFile,
  newRecordId,
  subscribeFileSync,
  getPendingFileCount,
  type PreparedFile,
} from '../lib/files';
import {
  FolderArchive,
  Plus,
  Eye,
  Trash2,
  Pencil,
  Download,
  AlertCircle,
  Upload,
  Search,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File as FileIcon,
  X,
} from 'lucide-react';

interface ArsipLaporanSekolahProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

const MAX_LAPORAN_BYTES = 5 * 1024 * 1024; // 5 MB

const KATEGORI_OPTIONS = [
  'Laporan Bulanan',
  'Keuangan / BOS',
  'Akademik & Rapor',
  'Ujian & ANBK',
  'Dapodik & Siswa',
  'Sarpras & Aset',
  'Kegiatan Sekolah',
  'Lainnya',
];

const PERIODE_OPTIONS = [
  'Tahunan',
  'Semester 1',
  'Semester 2',
  'Triwulan I',
  'Triwulan II',
  'Triwulan III',
  'Triwulan IV',
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
  'Insidental',
];

const formatSize = (bytes: number): string =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

function getFileBadge(file: FileRef): { label: string; cls: string; icon: React.ReactNode } {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return {
      label: 'PDF',
      cls: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <FileText className="w-3.5 h-3.5" />,
    };
  }
  if (/\.xlsx?$/.test(name) || type.includes('sheet') || type.includes('excel')) {
    return {
      label: 'XLS',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
    };
  }
  if (/\.docx?$/.test(name) || type.includes('word') || type.includes('document')) {
    return {
      label: 'DOC',
      cls: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: <FileText className="w-3.5 h-3.5" />,
    };
  }
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
    return {
      label: 'IMG',
      cls: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: <ImageIcon className="w-3.5 h-3.5" />,
    };
  }
  return {
    label: 'FILE',
    cls: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: <FileIcon className="w-3.5 h-3.5" />,
  };
}

export const ArsipLaporanSekolah: React.FC<ArsipLaporanSekolahProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const currentUser = getCurrentUser();
  const currentTa = config.tahunAjaran || '2026/2027';
  const todayStr = new Date().toISOString().split('T')[0];

  const [items, setItems] = useState<IArsipLaporan[]>(() => getArsipLaporan());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState('semua');
  const [filterTa, setFilterTa] = useState('semua');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<IArsipLaporan | null>(null);
  const [selectedFile, setSelectedFile] = useState<PreparedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<IArsipLaporan | null>(null);
  const [pendingFiles, setPendingFiles] = useState(() => getPendingFileCount());

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeFileSync(() => setPendingFiles(getPendingFileCount())), []);

  useEffect(() => {
    const reload = () => setItems(getArsipLaporan());
    const unsub1 = subscribeToStorage(reload);
    const unsub2 = subscribeToCloudChanges(reload);
    syncFromCloud().catch(() => {});
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const taOptions = Array.from(new Set([currentTa, ...items.map((i) => i.tahunAjaran).filter(Boolean)]))
    .sort()
    .reverse();

  const filtered = items.filter((item) => {
    const matchKat = filterKategori === 'semua' || item.kategori === filterKategori;
    const matchTa = filterTa === 'semua' || item.tahunAjaran === filterTa;
    const q = searchQuery.trim().toLowerCase();
    const matchQ =
      !q ||
      `${item.judul} ${item.kategori} ${item.periode} ${item.nomor || ''} ${item.keterangan || ''} ${item.file?.name || ''}`
        .toLowerCase()
        .includes(q);
    return matchKat && matchTa && matchQ;
  });

  const grouped = Array.from(new Set(filtered.map((i) => i.tahunAjaran || currentTa)))
    .sort()
    .reverse()
    .map((ta) => ({
      ta,
      rows: filtered
        .filter((i) => (i.tahunAjaran || currentTa) === ta)
        .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || (b.createdAt || 0) - (a.createdAt || 0)),
    }));

  const processPickedFile = async (file?: File) => {
    if (!file) return;
    try {
      const prepared = await prepareFile(file, { allowOffice: true, maxBytes: MAX_LAPORAN_BYTES });
      setFileError(null);
      setSelectedFile(prepared);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca berkas.';
      setFileError(msg);
      setSelectedFile(null);
      onToast(msg, true);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    await processPickedFile(file);
    e.target.value = '';
  };

  const canEditItem = (): boolean => isOperator;

  const openNewModal = () => {
    if (!isOperator) return;
    setEditing(null);
    setSelectedFile(null);
    setFileError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isOperator || saving) return;

    if (!selectedFile && !editing) {
      const msg = 'Pilih atau seret file laporan terlebih dahulu.';
      setFileError(msg);
      onToast(msg, true);
      return;
    }

    const form = new FormData(e.currentTarget);
    const judul = String(form.get('judul') || '').trim();
    if (!judul) {
      onToast('Judul laporan wajib diisi.', true);
      return;
    }

    const user = getCurrentUser();
    const now = Date.now();
    const fields = {
      judul,
      kategori: String(form.get('kategori') || KATEGORI_OPTIONS[0]),
      periode: String(form.get('periode') || PERIODE_OPTIONS[0]),
      tanggal: String(form.get('tanggal') || todayStr),
      tahunAjaran: String(form.get('tahunAjaran') || currentTa).trim() || currentTa,
      nomor: String(form.get('nomor') || '').trim(),
      keterangan: String(form.get('keterangan') || '').trim(),
    };

    setSaving(true);
    let newRef: FileRef | null = null;
    try {
      if (selectedFile) {
        const saved = await saveFile(selectedFile, { folder: 'arsip-laporan' });
        newRef = saved.ref;
      }

      if (editing) {
        const updated: IArsipLaporan = {
          ...editing,
          ...fields,
          file: newRef || editing.file,
          updatedAt: now,
        };
        const next = getArsipLaporan().map((i) => (i.id === editing.id ? updated : i));
        if (!saveArsipLaporanList(next)) {
          throw new Error('Perubahan gagal disimpan di browser. Muat ulang halaman lalu coba lagi.');
        }
        if (newRef) deleteFile(editing.file).catch(() => {});
        recordActivity(
          'Arsip Laporan',
          `Ubah arsip laporan "${updated.judul}" (${updated.file.name})`,
          false,
          'update',
          user?.name
        );
        await flushCloudPushNow().catch(() => false);
        setItems(getArsipLaporan());
        setIsModalOpen(false);
        setEditing(null);
        setSelectedFile(null);
        setFileError(null);
        onToast(`Arsip laporan "${updated.judul}" berhasil diperbarui.`);
        return;
      }

      const ref = newRef!;
      const record: IArsipLaporan = {
        id: newRecordId('al'),
        ...fields,
        file: ref,
        uploadedBy: user?.name || '-',
        uploadedById: user?.id,
        createdAt: now,
        updatedAt: now,
      };
      if (!saveArsipLaporanList([record, ...getArsipLaporan()])) {
        await deleteFile(ref);
        throw new Error('Arsip laporan gagal disimpan di browser.');
      }
      recordActivity(
        'Arsip Laporan',
        `Unggah arsip laporan "${record.judul}" (${record.file.name})`,
        true,
        'create',
        user?.name
      );
      await flushCloudPushNow().catch(() => false);
      setItems(getArsipLaporan());
      setIsModalOpen(false);
      setSelectedFile(null);
      setFileError(null);
      onToast(
        ref.url
          ? `Laporan "${record.judul}" berhasil diunggah dan tersimpan di Cloud.`
          : `Laporan "${record.judul}" tersimpan di perangkat ini dan akan dikirim ke ImageKit otomatis saat online.`
      );
    } catch (err) {
      if (newRef) deleteFile(newRef).catch(() => {});
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan arsip laporan.';
      setFileError(msg);
      onToast(msg, true);
    } finally {
      setSaving(false);
    }
  };

  const handleView = async (item: IArsipLaporan) => {
    const ok = await openFile(item.file);
    if (!ok) {
      onToast(
        isOperator
          ? 'Berkas tidak ditemukan. Pastikan ImageKit sudah diatur atau buka dari perangkat pengunggah.'
          : 'Berkas belum tersedia untuk dibuka.',
        true
      );
    }
  };

  const handleDownload = async (item: IArsipLaporan) => {
    const ok = await downloadFile(item.file);
    if (!ok) {
      onToast(
        isOperator
          ? 'Berkas tidak ditemukan. Pastikan ImageKit sudah diatur atau unduh dari perangkat pengunggah.'
          : 'Berkas belum tersedia untuk diunduh.',
        true
      );
    }
  };

  const performDelete = () => {
    if (!isOperator || !confirmDelete) return;
    const item = confirmDelete;
    setConfirmDelete(null);
    if (saveArsipLaporanList(getArsipLaporan().filter((i) => i.id !== item.id))) {
      deleteFile(item.file).catch(() => {});
      recordActivity(
        'Arsip Laporan',
        `Hapus arsip laporan "${item.judul}" (${item.file.name})`,
        false,
        'delete',
        getCurrentUser()?.name
      );
      flushCloudPushNow().catch(() => {});
      setItems(getArsipLaporan());
      onToast(`Arsip "${item.judul}" berhasil dihapus.`);
    }
  };

  const totalBytes = items.reduce((acc, i) => acc + (i.file?.size || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">Arsip Laporan Sekolah</h1>
          <p className="text-xs text-[#566A6E] mt-1">
            {isOperator
              ? 'Unggah, kelompokkan, dan simpan berkas laporan sekolah (PDF, Word, Excel, maupun foto/scan) secara terpusat.'
              : 'Daftar arsip berkas laporan sekolah yang telah diunggah oleh Operator (Mode Lihat Saja).'}
          </p>
        </div>

        {isOperator && (
          <button
            type="button"
            onClick={openNewModal}
            className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Unggah Laporan
          </button>
        )}
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/95 p-3.5 rounded-xl border border-[#D3DDD9] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#566A6E]">Total Arsip Laporan</div>
            <div className="text-xl font-bold text-[#13262A] font-display mt-0.5 num-tabular">{items.length} berkas</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#DAEEE7] text-[#0B6B58] flex items-center justify-center">
            <FolderArchive className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white/95 p-3.5 rounded-xl border border-[#D3DDD9] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#566A6E]">Kategori Terarsip</div>
            <div className="text-xl font-bold text-[#13262A] font-display mt-0.5 num-tabular">
              {new Set(items.map((i) => i.kategori)).size} jenis
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-100 text-[#0369A1] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white/95 p-3.5 rounded-xl border border-[#D3DDD9] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#566A6E]">Total Kapasitas</div>
            <div className="text-xl font-bold text-[#13262A] font-display mt-0.5 num-tabular">
              {formatSize(totalBytes)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
        </div>
      </div>

      {isOperator && pendingFiles > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg font-medium">
          {pendingFiles} berkas tersimpan di perangkat ini dan sedang dikirim ke ImageKit. Pastikan koneksi internet aktif.
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#566A6E]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul laporan, nomor surat, atau nama berkas..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white focus:outline-none focus:border-[#0B6B58]"
            />
          </div>

          <select
            value={filterTa}
            onChange={(e) => setFilterTa(e.target.value)}
            className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-medium"
          >
            <option value="semua">Semua Tahun Ajaran</option>
            {taOptions.map((ta) => (
              <option key={ta} value={ta}>
                TA {ta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {['semua', ...KATEGORI_OPTIONS].map((kat) => (
            <button
              key={kat}
              type="button"
              onClick={() => setFilterKategori(kat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border whitespace-nowrap ${
                filterKategori === kat
                  ? 'bg-[#DAEEE7] text-[#0B6B58] border-[#0B6B58]'
                  : 'bg-white text-[#566A6E] border-[#D3DDD9] hover:bg-[#E8EFEC]'
              }`}
            >
              {kat === 'semua' ? 'Semua Kategori' : kat}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar Arsip */}
      {grouped.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D3DDD9] rounded-2xl p-12 text-center text-[#566A6E] space-y-2.5">
          <FolderArchive className="w-12 h-12 mx-auto text-gray-300" />
          <h3 className="font-bold text-sm text-[#13262A]">
            {items.length === 0 ? 'Belum Ada Arsip Laporan Sekolah' : 'Tidak Ada Laporan yang Cocok'}
          </h3>
          <p className="text-xs max-w-md mx-auto">
            {items.length === 0
              ? isOperator
                ? 'Klik tombol "Unggah Laporan" untuk menyimpan berkas laporan bulanan, BOS, akademik, dapodik, sarpras, atau kegiatan sekolah (PDF, Word, Excel, JPG/PNG).'
                : 'Belum ada berkas arsip laporan yang diunggah oleh Operator.'
              : 'Ubah kata kunci pencarian atau filter kategori/tahun ajaran.'}
          </p>
          {isOperator && items.length === 0 && (
            <button
              type="button"
              onClick={openNewModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Unggah Laporan Pertama
            </button>
          )}
        </div>
      ) : (
        grouped.map((grp) => (
          <section
            key={grp.ta}
            className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs"
          >
            <div className="p-3.5 bg-[#F1F4F2] border-b border-[#D3DDD9] flex items-center justify-between">
              <span className="font-bold text-sm text-[#13262A]">Tahun Ajaran {grp.ta}</span>
              <span className="text-xs font-mono text-[#566A6E]">{grp.rows.length} laporan</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8EFEC] text-[#566A6E] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 w-20">Format</th>
                    <th className="py-2.5 px-4">Judul Laporan & Berkas</th>
                    <th className="py-2.5 px-4">Kategori & Periode</th>
                    <th className="py-2.5 px-4">Tanggal</th>
                    <th className="py-2.5 px-4">Ukuran</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grp.rows.map((row) => {
                    const badge = getFileBadge(row.file);
                    const editable = canEditItem();
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.cls}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-bold text-[#13262A]">{row.judul}</div>
                          <div className="text-[11px] text-[#0B6B58] font-medium mt-0.5 break-all">
                            {row.file.name}
                          </div>
                          {(row.nomor || row.keterangan) && (
                            <div className="text-[11px] text-[#566A6E] mt-0.5">
                              {row.nomor ? `No: ${row.nomor}` : ''}
                              {row.nomor && row.keterangan ? ' · ' : ''}
                              {row.keterangan || ''}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-[#13262A]">{row.kategori}</div>
                          <div className="text-[11px] text-[#566A6E] mt-0.5">{row.periode}</div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="whitespace-nowrap">
                            {row.tanggal
                              ? new Date(row.tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </div>
                          <div className="text-[11px] text-[#566A6E] mt-0.5">{row.uploadedBy || '-'}</div>
                        </td>
                        <td className="py-3 px-4 align-top font-mono text-[#566A6E] whitespace-nowrap">
                          {formatSize(row.file.size)}
                        </td>
                        <td className="py-3 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleView(row)}
                              className="px-2.5 py-1 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" /> Lihat
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownload(row)}
                              className="p-1.5 text-[#0B6B58] hover:bg-[#DAEEE7] rounded transition cursor-pointer"
                              title="Unduh berkas"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(row);
                                  setSelectedFile(null);
                                  setFileError(null);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                                title="Ubah arsip"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {isOperator && (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(row)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Hapus arsip"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {/* UPLOAD / EDIT MODAL */}
      {isOperator && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <form
            key={editing?.id || 'baru'}
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-[#0B6B58]" />
                {editing ? 'Ubah Data Arsip Laporan' : 'Unggah Arsip Laporan Sekolah'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditing(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-[#566A6E] mb-1">Judul Laporan *</label>
              <input
                name="judul"
                defaultValue={editing?.judul || ''}
                required
                placeholder="Contoh: Laporan Realisasi BOS Triwulan I Tahun 2026"
                className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg focus:outline-none focus:border-[#0B6B58]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Kategori Laporan</label>
                <select
                  name="kategori"
                  defaultValue={editing?.kategori || (filterKategori !== 'semua' ? filterKategori : KATEGORI_OPTIONS[0])}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold text-[#13262A] bg-white"
                >
                  {KATEGORI_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Periode</label>
                <select
                  name="periode"
                  defaultValue={editing?.periode || PERIODE_OPTIONS[0]}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold bg-white"
                >
                  {PERIODE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Tahun Ajaran</label>
                <input
                  name="tahunAjaran"
                  defaultValue={editing?.tahunAjaran || currentTa}
                  required
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Laporan</label>
                <input
                  type="date"
                  name="tanggal"
                  defaultValue={editing?.tanggal || todayStr}
                  required
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nomor (Opsional)</label>
                <input
                  name="nomor"
                  defaultValue={editing?.nomor || ''}
                  placeholder="mis. 421/012/2026"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-[#566A6E] mb-1">Keterangan (Opsional)</label>
              <input
                name="keterangan"
                defaultValue={editing?.keterangan || ''}
                placeholder="Catatan ringkas mengenai isi laporan atau lampiran"
                className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
              />
            </div>

            {/* File Dropzone */}
            <div className="text-xs space-y-1.5">
              <label className="block font-semibold text-[#566A6E]">
                {editing
                  ? `Ganti File Laporan (opsional, maks. ${MAX_LAPORAN_BYTES / 1048576} MB)`
                  : `Unggah File Laporan * (PDF, Word, Excel, JPG/PNG · maks. ${MAX_LAPORAN_BYTES / 1048576} MB)`}
              </label>

              {editing && !selectedFile && (
                <div className="text-[11px] text-[#566A6E] bg-[#F8FAF9] px-2.5 py-1.5 rounded-lg border border-[#E4EBE8]">
                  File saat ini: <span className="font-semibold text-[#13262A]">{editing.file.name}</span> ({formatSize(editing.file.size)})
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  processPickedFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-[#0B6B58] bg-[#E8EFEC]'
                    : 'border-[#CBD7D2] bg-gray-50 hover:border-[#0B6B58] hover:bg-[#F8FAF9]'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto text-[#0B6B58]" />
                <div className="font-semibold text-[#13262A] mt-1.5">
                  {selectedFile ? selectedFile.name : 'Klik atau seret file ke sini'}
                </div>
                <div className="text-[11px] text-[#566A6E] mt-0.5">
                  {selectedFile
                    ? `Siap diunggah · ${formatSize(selectedFile.size)}`
                    : 'Mendukung PDF, Word (.doc/.docx), Excel (.xls/.xlsx), JPG & PNG'}
                </div>
              </div>

              {fileError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fileError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D3DDD9]">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditing(null);
                }}
                className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-60 disabled:cursor-wait text-white font-semibold rounded-lg cursor-pointer shadow-xs"
              >
                {saving ? 'Mengunggah…' : editing ? 'Simpan Perubahan' : 'Simpan & Unggah'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {isOperator && confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#13262A]">Hapus Arsip Laporan?</h3>
                <p className="text-xs text-[#566A6E] mt-1">
                  Arsip <span className="font-semibold text-[#13262A]">&quot;{confirmDelete.judul}&quot;</span> ({confirmDelete.file.name}) akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4EBE8] text-xs">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-1.5 border border-[#D3DDD9] text-[#566A6E] rounded-lg font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={performDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
