/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { SchoolConfig, Guru, DokumenGtk, FileRef } from '../types';
import { ikResize } from '../lib/imagekit';
import { MIN_GURU_PASSWORD_LENGTH } from '../lib/auth';
import {
  prepareFile,
  saveFile,
  deleteFile,
  downloadFile,
  getFileDataUrl,
  hasLocalCopy,
  newRecordId,
  type PreparedFile,
} from '../lib/files';
import {
  getGurus,
  saveGuru,
  deleteGuru,
  setGuruPassword,
  clearGuruPassword,
  guruHasPassword,
  getDokumenGtks,
  saveDokumenGtk,
  deleteDokumenGtk,
} from '../lib/storage';
import {
  GraduationCap,
  FolderOpen,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ArrowLeft,
  Paperclip,
  Download,
  CheckCircle2,
  Lock,
  Search,
  X,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

interface GuruTendikProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

export const GuruTendik: React.FC<GuruTendikProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const [gurus, setGurus] = useState<Guru[]>(getGurus());
  const [dokList, setDokList] = useState<DokumenGtk[]>(getDokumenGtks());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJabatan, setFilterJabatan] = useState('');
  const [filterStatusPeg, setFilterStatusPeg] = useState('');

  // Selected Guru for Folder View
  const [selectedGuruId, setSelectedGuruId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Modals
  const [isModalGuruOpen, setIsModalGuruOpen] = useState(false);

  // Atur password login guru (khusus operator)
  const [pwGuru, setPwGuru] = useState<Guru | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwShow, setPwShow] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const openPwModal = (g: Guru) => {
    setPwGuru(g);
    setPwValue('');
    setPwShow(false);
  };

  const generatePw = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = new Uint32Array(8);
    crypto.getRandomValues(buf);
    setPwValue(Array.from(buf, (n) => chars[n % chars.length]).join(''));
    setPwShow(true);
  };

  const handleSavePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwGuru || pwBusy) return;
    if (pwValue.length < MIN_GURU_PASSWORD_LENGTH) {
      onToast(`Password minimal ${MIN_GURU_PASSWORD_LENGTH} karakter.`, true);
      return;
    }
    setPwBusy(true);
    try {
      await setGuruPassword(pwGuru.id, pwValue);
      reloadData();
      onToast(`Password untuk ${pwGuru.nama} berhasil disimpan. Sampaikan ke yang bersangkutan.`);
      setPwGuru(null);
      setPwValue('');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal menyimpan password.', true);
    } finally {
      setPwBusy(false);
    }
  };
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null);
  const [guruType, setGuruType] = useState<'Guru' | 'Tendik'>('Guru');

  const [isModalDokOpen, setIsModalDokOpen] = useState(false);
  const [editingDok, setEditingDok] = useState<DokumenGtk | null>(null);
  const [uploadedFile, setUploadedFile] = useState<FileRef | null>(null);
  const [savingDok, setSavingDok] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Preview Modal
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    dataUrl: string;
    size?: number;
    /** Gambar jarak jauh (sudah diperkecil ImageKit), dimuat langsung tanpa mengunduh berkas asli. */
    remoteImage?: boolean;
    downloadRef?: FileRef;
  } | null>(null);

  const reloadData = () => {
    setGurus(getGurus());
    setDokList(getDokumenGtks());
  };

  const selectedGuru = gurus.find((g) => g.id === selectedGuruId);

  const katUmumList = (config.katUmum || 'SK, SKP e-Kinerja, Surat Tugas, Sertifikat dan pelatihan')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const katPribadiList = (config.katPribadi || 'Ijazah dan transkrip, KTP / KK / NPWP, Karpeg / BPJS / Taspen')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const allCategories = [...katUmumList, ...katPribadiList];

  const filteredGurus = gurus.filter((g) => {
    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      g.nama.toLowerCase().includes(term) ||
      (g.nip && g.nip.includes(term)) ||
      (g.nuptk && g.nuptk.includes(term)) ||
      (g.mengampu && g.mengampu.toLowerCase().includes(term));
    const matchJabatan = !filterJabatan || g.jabatan === filterJabatan;
    const matchStatus = !filterStatusPeg || g.statusPeg === filterStatusPeg;
    return matchTerm && matchJabatan && matchStatus;
  });

  const getGuruDocs = (guruId: string) => dokList.filter((d) => d.guruId === guruId);

  const currentDocs = selectedGuru
    ? getGuruDocs(selectedGuru.id).filter((d) => !selectedCategory || d.kategori === selectedCategory)
    : [];

  const handleSaveGuru = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').trim();
    if (!nama) {
      onToast('Nama Lengkap GTK wajib diisi.', true);
      return;
    }

    const record: Guru = {
      ...(editingGuru || {}),
      id: editingGuru ? editingGuru.id : `g_${Date.now()}`,
      nama,
      nip: String(form.get('nip') || '').trim() || undefined,
      nuptk: String(form.get('nuptk') || '').trim() || undefined,
      jk: (form.get('jk') as any) || 'L',
      jenisGtk: (form.get('jenisGtk') as any) || 'Guru',
      jabatan: String(form.get('jabatan') || '').trim() || 'Guru Kelas',
      statusPeg: String(form.get('statusPeg') || '').trim() || 'PNS',
      mengampu: String(form.get('mengampu') || '').trim() || undefined,
      pendidikan: String(form.get('pendidikan') || '').trim() || 'S1',
      telp: String(form.get('telp') || '').trim() || undefined,
      email: String(form.get('email') || '').trim() || undefined,
      alamat: String(form.get('alamat') || '').trim() || undefined,
      golongan: String(form.get('golongan') || '').trim() || undefined,
      gaji: Number(form.get('gaji')) || 0,
      status: (form.get('status') as any) || 'Aktif',
      createdAt: editingGuru?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    saveGuru(record);
    reloadData();
    setIsModalGuruOpen(false);
    setEditingGuru(null);
    onToast(`Data GTK "${record.nama}" berhasil disimpan.`);
  };

  const handleSaveDok = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedGuru || savingDok) return;
    const form = new FormData(e.currentTarget);
    const kategori = String(form.get('kategori') || '').trim();
    const isPribadi = katPribadiList.includes(kategori);

    setSavingDok(true);
    let newlySaved: FileRef | null = null;
    try {
      // Berkas baru (masih ada dataUrl di memori) disimpan dulu ke penyimpanan berkas.
      let fileRef: FileRef | undefined;
      let cloud = true;
      if (uploadedFile) {
        if (uploadedFile.dataUrl) {
          const res = await saveFile(uploadedFile as PreparedFile, { folder: `gtk/${selectedGuru.id}` });
          fileRef = res.ref;
          newlySaved = res.ref;
          cloud = res.cloud;
        } else {
          fileRef = uploadedFile;
        }
      }

      const record: DokumenGtk = {
        id: editingDok ? editingDok.id : newRecordId('dok'),
        guruId: selectedGuru.id,
        kategori,
        judul: String(form.get('judul') || '').trim(),
        nomor: String(form.get('nomor') || '').trim() || undefined,
        tanggal: String(form.get('tanggal') || '').trim() || undefined,
        tahunAjaran: String(form.get('tahunAjaran') || '').trim() || config.tahunAjaran,
        penerbit: String(form.get('penerbit') || '').trim() || undefined,
        keterangan: String(form.get('keterangan') || '').trim() || undefined,
        file: fileRef,
        isPribadi,
        createdAt: editingDok ? editingDok.createdAt : Date.now(),
        updatedAt: Date.now(),
      };

      if (!saveDokumenGtk(record)) {
        throw new Error('Dokumen gagal disimpan di browser. Muat ulang halaman lalu ulangi.');
      }
      // Berkas lama yang diganti dibersihkan.
      if (editingDok?.file?.id && editingDok.file.id !== fileRef?.id) {
        deleteFile(editingDok.file).catch(() => {});
      }
      reloadData();
      setIsModalDokOpen(false);
      setEditingDok(null);
      setUploadedFile(null);
      setFileError(null);
      onToast(
        cloud
          ? `Dokumen "${record.judul}" berhasil disimpan.`
          : `Dokumen "${record.judul}" tersimpan di perangkat ini dan akan dikirim ke ImageKit otomatis.`
      );
    } catch (err) {
      if (newlySaved) deleteFile(newlySaved).catch(() => {});
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan dokumen.';
      setFileError(msg);
      onToast(msg, true);
    } finally {
      setSavingDok(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const prepared = await prepareFile(file, { allowOffice: true });
      setFileError(null);
      setUploadedFile(prepared);
      onToast(`Berkas "${prepared.name}" berhasil dipilih.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca berkas.';
      setFileError(msg);
      onToast(msg, true);
      input.value = '';
    }
  };

  const openPreview = async (f: FileRef) => {
    // Gambar: tampilkan versi kecil dari ImageKit (hemat kuota). Berkas asli hanya lewat tombol Unduh (khusus operator).
    if (f.url && (f.type || '').startsWith('image/') && !(await hasLocalCopy(f))) {
      setPreviewFile({ name: f.name, dataUrl: ikResize(f.url, 1200), size: f.size, remoteImage: true, downloadRef: f });
      return;
    }
    // PDF / lainnya: hanya diunduh sekali lalu disimpan di perangkat; pembukaan berikutnya tanpa kuota.
    if (f.url && !(await hasLocalCopy(f)) && (f.size || 0) > 3 * 1048576) {
      const mb = ((f.size || 0) / 1048576).toFixed(1);
      if (!window.confirm(`Berkas ${mb} MB akan diunduh sekali dan disimpan di perangkat ini. Lanjutkan?`)) return;
    }
    const dataUrl = await getFileDataUrl(f);
    if (!dataUrl) {
      onToast('Berkas tidak ditemukan. Pastikan ImageKit sudah diatur (menu Koneksi Supabase > ImageKit) atau buka dari perangkat yang mengunggahnya.', true);
      return;
    }
    setPreviewFile({ name: f.name, dataUrl, size: f.size, downloadRef: f });
  };

  return (
    <div className="space-y-5">
      {/* If a Guru is selected, show Folder Documents View */}
      {selectedGuru ? (
        <div className="space-y-5">
          {/* Top navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedGuruId(null);
                  setSelectedCategory('');
                }}
                className="p-2 rounded-lg bg-white border border-[#D3DDD9] hover:bg-[#E8EFEC] text-[#13262A] transition cursor-pointer"
                title="Kembali ke Daftar GTK"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[#13262A] font-display">
                    Folder Dokumen: {selectedGuru.nama}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#DAEEE7] text-[#0B6B58]">
                    {selectedGuru.jabatan}
                  </span>
                </div>
                <p className="text-xs text-[#566A6E] mt-0.5">
                  {selectedGuru.statusPeg} &middot;{' '}
                  {selectedGuru.nip ? `NIP ${selectedGuru.nip}` : 'Non-NIP'} &middot;{' '}
                  {selectedGuru.mengampu || 'SDN 2 Cempaka'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingDok(null);
                  setUploadedFile(null);
                  setFileError(null);
                  setIsModalDokOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Dokumen
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                selectedCategory === ''
                  ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-sm'
                  : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-[#F1F4F2]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <FolderOpen className={`w-5 h-5 ${selectedCategory === '' ? 'text-white' : 'text-[#0B6B58]'}`} />
                <span
                  className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                    selectedCategory === '' ? 'bg-white/20' : 'bg-[#E8EFEC] text-[#566A6E]'
                  }`}
                >
                  {getGuruDocs(selectedGuru.id).length}
                </span>
              </div>
              <div>
                <div className="font-bold text-xs truncate">Semua Dokumen</div>
                <div className={`text-[10px] ${selectedCategory === '' ? 'text-[#DAEEE7]' : 'text-[#566A6E]'}`}>
                  Seluruh berkas
                </div>
              </div>
            </button>

            {allCategories.map((cat) => {
              const isPribadi = katPribadiList.includes(cat);
              const count = getGuruDocs(selectedGuru.id).filter((d) => d.kategori === cat).length;
              const isActive = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                    isActive
                      ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-sm'
                      : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-[#F1F4F2]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <FileText
                      className={`w-4 h-4 ${
                        isActive ? 'text-white' : isPribadi ? 'text-amber-600' : 'text-[#0B6B58]'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isActive ? 'bg-white/20' : 'bg-[#E8EFEC] text-[#566A6E]'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-xs truncate" title={cat}>
                      {cat}
                    </div>
                    {isPribadi && (
                      <div
                        className={`text-[9px] font-medium flex items-center gap-0.5 ${
                          isActive ? 'text-amber-200' : 'text-amber-700'
                        }`}
                      >
                        <Lock className="w-2.5 h-2.5" /> Pribadi
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Table of Documents */}
          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#D3DDD9] flex items-center justify-between">
              <span className="text-xs font-bold text-[#13262A] uppercase tracking-wider">
                Daftar Dokumen: {selectedCategory || 'Semua Kategori'} ({currentDocs.length})
              </span>
            </div>

            {currentDocs.length === 0 ? (
              <div className="p-8 text-center text-[#566A6E] space-y-2">
                <FolderOpen className="w-10 h-10 mx-auto text-gray-300" />
                <p className="text-sm font-semibold">Belum ada dokumen dalam folder ini</p>
                <p className="text-xs max-w-sm mx-auto">
                  Tambahkan arsip SK, SKP e-Kinerja, sertifikat, atau dokumen pribadi GTK.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDok(null);
                    setUploadedFile(null);
                    setIsModalDokOpen(true);
                  }}
                  className="mt-2 px-3 py-1.5 text-xs bg-[#0B6B58] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  + Tambah Dokumen Sekarang
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Judul Dokumen</th>
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Kategori</th>
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Tanggal</th>
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Berkas (&le; 200 KB)</th>
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Penerbit</th>
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D3DDD9]">
                    {currentDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#13262A]">{doc.judul}</div>
                          <div className="text-[11px] font-mono text-[#566A6E]">
                            {doc.nomor || 'Tanpa nomor'}
                          </div>
                          {doc.keterangan && (
                            <div className="text-[11px] text-gray-500 mt-0.5 italic">{doc.keterangan}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              doc.isPribadi ? 'bg-amber-100 text-amber-800' : 'bg-[#E8EFEC] text-[#13262A]'
                            }`}
                          >
                            {doc.kategori}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#566A6E]">{doc.tanggal || '-'}</td>
                        <td className="py-3 px-4">
                          {doc.file ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => doc.file && openPreview(doc.file)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                                title="Klik untuk melihat pratinjau berkas"
                              >
                                <Paperclip className="w-3 h-3 text-emerald-700" />
                                <span className="truncate max-w-[110px]">{doc.file.name}</span>
                                <span className="text-[10px] text-emerald-600 font-mono">
                                  ({((doc.file.size || 0) / 1024).toFixed(0)} KB)
                                </span>
                              </button>
                              {isOperator && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (doc.file && !(await downloadFile(doc.file))) onToast('Berkas tidak ditemukan.', true);
                                  }}
                                  className="p-1 text-[#566A6E] hover:text-[#0B6B58] rounded hover:bg-[#E8EFEC] cursor-pointer"
                                  title="Unduh Berkas"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Tanpa lampiran</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#566A6E]">
                          {doc.penerbit || 'SD Negeri 2 Cempaka'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDok(doc);
                                setUploadedFile(doc.file || null);
                                setIsModalDokOpen(true);
                              }}
                              className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                              title="Ubah Dokumen"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {isOperator && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Hapus dokumen "${doc.judul}"?`)) {
                                    deleteDokumenGtk(doc.id);
                                    reloadData();
                                    onToast(`Dokumen "${doc.judul}" berhasil dihapus.`);
                                  }
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Hapus Dokumen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* GTK DIRECTORY LIST */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#13262A] font-display">
                Data Guru dan Tenaga Kependidikan (GTK)
              </h1>
              <p className="text-xs text-[#566A6E] mt-1">
                Daftar seluruh pendidik dan tenaga kependidikan. Klik tombol folder untuk membuka arsip dokumen: SK, SKP, sertifikat, dan ijazah.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingGuru(null);
                  setGuruType('Tendik');
                  setIsModalGuruOpen(true);
                }}
                className="px-4 py-2 bg-[#DAEEE7] hover:bg-[#c6e6db] text-[#0B6B58] border border-[#0B6B58]/30 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Tendik
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingGuru(null);
                  setGuruType('Guru');
                  setIsModalGuruOpen(true);
                }}
                className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Guru
              </button>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama guru, NIP, NUPTK, atau tugas mengajar..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
              />
            </div>

            <select
              value={filterJabatan}
              onChange={(e) => setFilterJabatan(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Jabatan</option>
              {Array.from(new Set(gurus.map((g) => g.jabatan).filter(Boolean))).map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>

            <select
              value={filterStatusPeg}
              onChange={(e) => setFilterStatusPeg(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Kepegawaian</option>
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
              <option value="PPPK Paruh Waktu">PPPK Paruh Waktu</option>
              <option value="GTT / Honorer">GTT / Honorer</option>
            </select>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Lengkap</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Jabatan / Tugas</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Status Pegawai</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Kontak</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Folder Dokumen</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {filteredGurus.map((g) => {
                    const docCount = getGuruDocs(g.id).length;
                    return (
                      <tr
                        key={g.id}
                        className="hover:bg-gray-50/80 cursor-pointer"
                        onClick={() => setSelectedGuruId(g.id)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#13262A] text-sm hover:text-[#0B6B58] transition">
                            {g.nama}
                          </div>
                          <div className="text-[11px] font-mono text-[#566A6E] mt-0.5">
                            {g.nip ? `NIP ${g.nip}` : g.nuptk ? `NUPTK ${g.nuptk}` : 'Belum ber-NIP'}
                          </div>
                          {isOperator && (
                            <div
                              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                guruHasPassword(g) ? 'bg-[#DDF1E3] text-[#1D7A3A]' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {guruHasPassword(g) ? 'Password sudah diatur' : 'Password belum diatur'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#13262A]">{g.jabatan}</div>
                          <div className="text-[11px] text-[#566A6E]">{g.mengampu || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              g.statusPeg === 'PNS'
                                ? 'bg-[#DAEEE7] text-[#0B6B58]'
                                : g.statusPeg === 'PPPK'
                                ? 'bg-[#DDF1E3] text-[#1D7A3A]'
                                : g.statusPeg === 'PPPK Paruh Waktu'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {g.statusPeg}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#566A6E]">{g.telp || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGuruId(g.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#E8EFEC] hover:bg-[#DAEEE7] text-[#0B6B58] font-semibold rounded-lg text-xs transition cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>{docCount} berkas</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGuru(g);
                                setGuruType(g.jenisGtk || 'Guru');
                                setIsModalGuruOpen(true);
                              }}
                              className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                              title="Ubah Data GTK"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isOperator && (
                              <button
                                type="button"
                                onClick={() => openPwModal(g)}
                                className="p-1.5 text-[#566A6E] hover:text-[#1D7A3A] hover:bg-[#DDF1E3] rounded transition cursor-pointer"
                                title="Atur Password Login"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )}
                            {isOperator && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Hapus data ${g.nama}?`)) {
                                    deleteGuru(g.id);
                                    reloadData();
                                    onToast(`Data ${g.nama} berhasil dihapus.`);
                                  }
                                }}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Hapus GTK"
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
          </div>
        </div>
      )}

      {/* MODAL: ATUR PASSWORD LOGIN GURU (khusus operator) */}
      {isOperator && pwGuru && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <form
            onSubmit={handleSavePw}
            className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#1D7A3A]" />
                Password Login
              </h3>
              <button
                type="button"
                onClick={() => setPwGuru(null)}
                className="p-1 text-[#566A6E] hover:bg-[#E8EFEC] rounded cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#566A6E] leading-relaxed">
              Akun: <span className="font-semibold text-[#13262A]">{pwGuru.nama}</span>
              <br />
              {guruHasPassword(pwGuru)
                ? 'Password lama tidak bisa dilihat. Mengisi password baru akan menggantinya.'
                : 'Akun ini belum punya password, jadi belum bisa masuk.'}
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
                Password baru (minimal {MIN_GURU_PASSWORD_LENGTH} karakter)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={pwShow ? 'text' : 'password'}
                    value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    className="w-full pl-3 pr-10 py-2 text-xs border border-[#D3DDD9] rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#1D7A3A]"
                  />
                  <button
                    type="button"
                    onClick={() => setPwShow(!pwShow)}
                    className="absolute right-2.5 top-2 text-[#566A6E] hover:text-[#13262A] cursor-pointer"
                    title={pwShow ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {pwShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePw}
                  className="px-3 py-2 bg-[#E8EFEC] hover:bg-[#DAEEE7] text-[#0B6B58] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  title="Buat password acak"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Acak
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {guruHasPassword(pwGuru) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Hapus password ${pwGuru.nama}? Akun ini tidak bisa masuk sampai dibuatkan password baru.`)) {
                      clearGuruPassword(pwGuru.id);
                      reloadData();
                      onToast(`Password ${pwGuru.nama} dihapus.`);
                      setPwGuru(null);
                    }
                  }}
                  className="px-3 py-2 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Hapus password
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPwGuru(null)}
                  className="px-4 py-2 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pwBusy || pwValue.length < MIN_GURU_PASSWORD_LENGTH}
                  className="px-4 py-2 bg-[#1D7A3A] hover:bg-[#17622e] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {pwBusy ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD / EDIT GURU */}
      {isModalGuruOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-xl w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#0B6B58]" />
                {editingGuru ? `Ubah Data GTK: ${editingGuru.nama}` : `Tambah ${guruType} Baru`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalGuruOpen(false);
                  setEditingGuru(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGuru} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">
                  Nama Lengkap (dengan Gelar) *
                </label>
                <input
                  name="nama"
                  defaultValue={editingGuru?.nama || ''}
                  required
                  placeholder="Contoh: Budi Santoso, S.Pd.SD"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NIP</label>
                  <input
                    name="nip"
                    defaultValue={editingGuru?.nip || ''}
                    placeholder="18 digit atau kosongkan"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NUPTK</label>
                  <input
                    name="nuptk"
                    defaultValue={editingGuru?.nuptk || ''}
                    placeholder="16 digit NUPTK"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jenis Kelamin</label>
                  <select name="jk" defaultValue={editingGuru?.jk || 'L'} className="w-full px-3 py-2 border rounded-lg">
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jabatan *</label>
                  <input
                    name="jabatan"
                    defaultValue={editingGuru?.jabatan || (guruType === 'Tendik' ? 'Tenaga Administrasi' : 'Guru Kelas')}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Status Pegawai</label>
                  <select
                    name="statusPeg"
                    defaultValue={editingGuru?.statusPeg || 'PNS'}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="PPPK Paruh Waktu">PPPK Paruh Waktu</option>
                    <option value="GTT / Honorer">GTT / Honorer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tugas / Mengampu</label>
                  <input
                    name="mengampu"
                    defaultValue={editingGuru?.mengampu || ''}
                    placeholder="Contoh: Kelas 3 / PJOK"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Pendidikan Terakhir</label>
                  <input
                    name="pendidikan"
                    defaultValue={editingGuru?.pendidikan || 'S1'}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Pangkat / Golongan</label>
                  <input
                    name="golongan"
                    defaultValue={editingGuru?.golongan || ''}
                    placeholder="Contoh: Penata Muda, III/a"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Telepon / WhatsApp</label>
                  <input
                    name="telp"
                    defaultValue={editingGuru?.telp || ''}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalGuruOpen(false);
                    setEditingGuru(null);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Simpan Data GTK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DOKUMEN GTK */}
      {isModalDokOpen && selectedGuru && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <h3 className="text-base font-bold text-[#13262A] font-display">
              {editingDok ? 'Ubah Dokumen GTK' : `Tambah Dokumen untuk ${selectedGuru.nama}`}
            </h3>

            <form onSubmit={handleSaveDok} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Kategori Dokumen *</label>
                {selectedCategory ? (
                  <>
                    <input type="hidden" name="kategori" value={editingDok?.kategori || selectedCategory} />
                    <div className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg bg-[#F1F5F3] text-[#13262A] font-semibold flex items-center gap-2 cursor-not-allowed">
                      <Lock className="w-3.5 h-3.5 text-[#566A6E]" />
                      {editingDok?.kategori || selectedCategory}{' '}
                      {katPribadiList.includes(editingDok?.kategori || selectedCategory) ? '(Pribadi)' : ''}
                    </div>
                  </>
                ) : (
                  <select
                    name="kategori"
                    defaultValue={editingDok?.kategori || selectedCategory || allCategories[0]}
                    required
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c} {katPribadiList.includes(c) ? '(Pribadi)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Judul Dokumen *</label>
                <input
                  name="judul"
                  defaultValue={editingDok?.judul}
                  required
                  placeholder="Contoh: SK Pembagian Tugas Mengajar 2026/2027"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor Surat / Dokumen</label>
                  <input
                    name="nomor"
                    defaultValue={editingDok?.nomor}
                    placeholder="421.2/012/SD/2026"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal</label>
                  <input
                    type="date"
                    name="tanggal"
                    defaultValue={editingDok?.tanggal || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              {/* Upload Field */}
              <div className="p-3.5 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-[#13262A] text-xs flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#0B6B58]" /> Upload Berkas (Maks. 200 KB)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    &le; 200 KB
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadedFile ? (
                  <div className="p-3 bg-white border border-emerald-200 rounded-lg flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#13262A] truncate">
                          {uploadedFile.name}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-mono">
                          {((uploadedFile.size || 0) / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 bg-white border border-dashed border-[#B8CAC4] hover:border-[#0B6B58] rounded-lg cursor-pointer transition text-center flex flex-col items-center justify-center gap-1"
                  >
                    <Upload className="w-6 h-6 text-[#0B6B58]" />
                    <span className="font-semibold text-xs text-[#13262A]">
                      Pilih berkas PDF atau gambar scan
                    </span>
                    <span className="text-[10px] text-[#566A6E]">Ukuran maksimal 10 MB (gambar dikompres otomatis)</span>
                  </div>
                )}

                {fileError && <div className="text-rose-600 text-[11px] font-semibold">{fileError}</div>}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalDokOpen(false);
                    setEditingDok(null);
                    setUploadedFile(null);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDok}
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-60 disabled:cursor-wait text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  {savingDok ? 'Menyimpan…' : 'Simpan Dokumen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-2xl w-full overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-[#13262A] text-white flex items-center justify-between">
              <span className="font-bold text-sm truncate">{previewFile.name}</span>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1 text-gray-300 hover:text-white rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-[#F8FAF9] flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-y-auto">
              {previewFile.remoteImage || previewFile.dataUrl?.startsWith('data:image/') ? (
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-[60vh] max-w-full object-contain rounded"
                />
              ) : previewFile.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewFile.dataUrl}
                  title={previewFile.name}
                  className="w-full h-[55vh] rounded border"
                />
              ) : (
                <div className="text-center space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-[#0B6B58]" />
                  <div className="font-bold text-sm">{previewFile.name}</div>
                  {isOperator && previewFile.downloadRef ? (
                    <button
                      type="button"
                      onClick={() => previewFile.downloadRef && downloadFile(previewFile.downloadRef)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B6B58] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Unduh Berkas
                    </button>
                  ) : (
                    <p className="text-xs text-[#566A6E]">Pratinjau tidak tersedia untuk jenis berkas ini.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
