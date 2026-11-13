/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  saveSchoolConfig,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  downloadBackupJSON,
  restoreBackupJSON,
  resetToDefaults,
  getAllExportableData,
  getKelasList,
  addRombel,
  removeRombel,
  getSiswas,
  syncAllOperatorAccounts,
  syncLocalOperatorsFromConfig,
  mergeRemoteUsers,
  KEYS,
  getSchoolConfig,
} from '../lib/storage';
import { SchoolConfig, LetterTemplate, User } from '../types';
import { htmlToPlainText } from '../lib/docx';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  pushAllToSupabase,
  pullAllFromSupabase,
  generateSupabaseSQLScript,
  DEFAULT_SUPABASE_CONFIG,
} from '../lib/supabase';
import { isImageKitReady, uploadDataUrlToImageKit } from '../lib/imagekit';
import { KopSuratHD } from './KopSuratHD';
import { DapodikWebServicePanel } from './DapodikWebService';
import {
  Settings,
  Sparkles,
  Upload,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  FileText,
  School,
  Save,
  CheckCircle,
  Copy,
  Check,
  Database,
  Cloud,
  Zap,
  ShieldCheck,
  Server,
} from 'lucide-react';

interface PengaturanSekolahProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
  initialTab?: string;
  onOpenSupabaseModal?: () => void;
}

const processLogoFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Berkas harus berupa gambar (PNG, SVG, JPG, WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (file.type === 'image/svg+xml') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const max = 2400; // High resolution retention
        if (width > max || height > max) {
          if (width > height) {
            height = Math.round((height * max) / width);
            width = max;
          } else {
            width = Math.round((width * max) / height);
            height = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const format = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(format, 0.96));
      };
      img.onerror = () => reject(new Error('Gagal memuat berkas gambar.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsDataURL(file);
  });
};

/** Bila ImageKit sudah diatur, unggah gambar dan pakai URL-nya (Supabase hanya menyimpan teks). Jika gagal, pakai data lokal. */
const toCloudImage = async (dataUrl: string, baseName: string): Promise<string> => {
  if (!isImageKitReady()) return dataUrl;
  try {
    return (await uploadDataUrlToImageKit(dataUrl, `${baseName}-${Date.now().toString(36)}`, { subfolder: 'logo' })).url;
  } catch {
    return dataUrl;
  }
};

export const PengaturanSekolah: React.FC<PengaturanSekolahProps> = ({
  role,
  config,
  onToast,
  initialTab = 'kop',
  onOpenSupabaseModal,
}) => {
  const isOperator = role === 'operator';
  const [formData, setFormData] = useState<SchoolConfig>(config);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [templates, setTemplates] = useState<LetterTemplate[]>(getTemplates());

  const effectiveTab = !isOperator && ['supabase', 'dapodik', 'backup'].includes(activeTab) ? 'kop' : activeTab;

  // Template Form Modal
  const [isModalTemplateOpen, setIsModalTemplateOpen] = useState(false);

  // Logo upload references
  const filePemdaRef = useRef<HTMLInputElement>(null);
  const fileSekolahRef = useRef<HTMLInputElement>(null);
  const fileRestoreRef = useRef<HTMLInputElement>(null);

  const [isDraggingPemda, setIsDraggingPemda] = useState(false);
  const [isDraggingSekolah, setIsDraggingSekolah] = useState(false);

  // Supabase Testing in Settings (operator only)
  const [sbConfig] = useState(() => (isOperator ? getSupabaseConfig() : DEFAULT_SUPABASE_CONFIG));
  const [sbTesting, setSbTesting] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<{ connected: boolean; latencyMs: number; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Rombel kelas (hanya operator)
  const [newRombel, setNewRombel] = useState('');
  const rombelNow = getKelasList();
  const siswaPerRombel = (k: string) => getSiswas().filter((x) => x.kelas === k && x.status === 'Aktif').length;
  const handleAddRombel = () => {
    if (!isOperator) return;
    const r = addRombel(newRombel);
    onToast(r.message, !r.ok);
    if (r.ok && r.value) {
      setNewRombel('');
      setFormData((prev) => ({ ...prev, kelas: r.value }));
    }
  };
  const handleRemoveRombel = (k: string) => {
    if (!isOperator) return;
    if (!window.confirm(`Hapus rombel kelas "${k}"?`)) return;
    const r = removeRombel(k);
    onToast(r.message, !r.ok);
    if (r.ok && r.value) setFormData((prev) => ({ ...prev, kelas: r.value }));
  };

  const handleFieldChange = (field: keyof SchoolConfig, val: any) => {
    if (!isOperator) return;
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOperator) return;
    saveSchoolConfig(formData);
    if (formData.namaOperator?.trim()) {
      syncAllOperatorAccounts(
        formData.namaOperator.trim(),
        formData.emailOperator?.trim(),
        formData.emailOperator2?.trim(),
        formData.nipOperator?.trim()
      );
    }
    onToast('Pengaturan sekolah & kop surat berhasil disimpan!');
  };

  const handleUploadPemda = async (file: File) => {
    if (!isOperator) return;
    if (file.size > 10 * 1024 * 1024) {
      onToast('Ukuran berkas logo maksimal 10 MB.', true);
      return;
    }
    try {
      const dataUrl = await processLogoFile(file);
      handleFieldChange('logoPemda', await toCloudImage(dataUrl, 'logo-pemda'));
      onToast('Logo Pemda (resolusi tinggi) berhasil dimuat!');
    } catch (err: any) {
      onToast(err.message || 'Gagal memproses gambar.', true);
    }
  };

  const handleUploadSekolah = async (file: File) => {
    if (!isOperator) return;
    if (file.size > 10 * 1024 * 1024) {
      onToast('Ukuran berkas logo maksimal 10 MB.', true);
      return;
    }
    try {
      const dataUrl = await processLogoFile(file);
      handleFieldChange('logoSekolah', await toCloudImage(dataUrl, 'logo-sekolah'));
      onToast('Logo Sekolah (resolusi tinggi) berhasil dimuat!');
    } catch (err: any) {
      onToast(err.message || 'Gagal memproses gambar.', true);
    }
  };

  const runSbTest = async () => {
    if (!isOperator) return;
    setSbTesting(true);
    const res = await testSupabaseConnection(sbConfig);
    setSbTestResult(res);
    setSbTesting(false);
  };

  const handlePushSupabase = async () => {
    if (!isOperator) return;
    try {
      const data = getAllExportableData();
      const res = await pushAllToSupabase(data);
      if (res.success) onToast(res.message);
      else onToast(res.message, true);
    } catch (e: any) {
      onToast(e.message, true);
    }
  };

  const handlePullSupabase = async () => {
    if (!isOperator) return;
    if (!window.confirm('Unduh data dari Supabase Cloud dan timpa data lokal?')) return;
    try {
      const res = await pullAllFromSupabase();
      if (res.success && res.data) {
        let count = 0;
        Object.entries(res.data).forEach(([key, val]) => {
          if (key === KEYS.USERS && Array.isArray(val)) {
            mergeRemoteUsers(val as User[]);
          } else {
            localStorage.setItem(key, JSON.stringify(val));
          }
          count++;
        });
        const freshCfg = getSchoolConfig();
        if (freshCfg.namaOperator) {
          syncLocalOperatorsFromConfig(freshCfg);
        }
        setFormData(freshCfg);
        window.dispatchEvent(new Event('storage'));
        onToast(`Berhasil menarik ${count} modul data dari Supabase.`);
      } else {
        onToast(res.message, true);
      }
    } catch (e: any) {
      onToast(e.message, true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Pengaturan Master Sekolah & Kop Surat
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            {isOperator
              ? 'Konfigurasi logo Pemda dan logo Sekolah hasil upload, tata letak kop surat, koneksi Supabase, penomoran surat, dan cadangan data.'
              : 'Informasi profil sekolah, tata letak kop surat resmi, format surat, dan penomoran surat (Mode Lihat Saja).'}
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#E8EFEC] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('kop')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              effectiveTab === 'kop' ? 'bg-[#0B6B58] text-white shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Kop Surat & Logo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profil')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              effectiveTab === 'profil' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Profil Sekolah
          </button>
          {isOperator && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('supabase')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  effectiveTab === 'supabase' ? 'bg-[#0B6B58] text-white shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" /> Koneksi Supabase
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dapodik')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  effectiveTab === 'dapodik' ? 'bg-[#0B6B58] text-white shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
                }`}
              >
                <Server className="w-3.5 h-3.5" /> Web Service Dapodik
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              effectiveTab === 'template' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Format Surat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('surat')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              effectiveTab === 'surat' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Penomoran Surat
          </button>
          {isOperator && (
            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                effectiveTab === 'backup' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
              }`}
            >
              Cadangan & Reset
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: KOP SURAT & LOGO */}
        {effectiveTab === 'kop' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-6">
              <div className="pb-3 border-b border-[#D3DDD9]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#DAEEE7] text-[#0B6B58] rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                      Upload Logo Pemda & Logo Sekolah (Resolusi Tinggi)
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Resolusi Penuh (Tanpa Kompresi Buram)
                      </span>
                    </h2>
                    <p className="text-xs text-[#566A6E]">
                      Unggah berkas logo asli dari komputer/perangkat Anda. Format PNG transparan atau SVG vector sangat disarankan untuk ketajaman maksimal saat dicetak.
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Dropzones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Logo Pemda */}
                <div className="p-4 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#13262A] block">
                        1. Logo Pemda (Pemerintah Kabupaten / Kota)
                      </span>
                      <span className="text-[10px] text-[#566A6E]">Pojok kiri atas kop surat dinas</span>
                    </div>
                    {formData.logoPemda && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Terpasang
                      </span>
                    )}
                  </div>

                  <input
                    ref={filePemdaRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadPemda(f);
                      e.target.value = '';
                    }}
                  />

                  {formData.logoPemda ? (
                    <div className="p-3 bg-white border border-gray-200 rounded-lg flex items-center gap-3">
                      <div className="w-16 h-20 bg-gray-50 border border-gray-200 rounded flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        <img
                          src={formData.logoPemda}
                          alt="Logo Pemda"
                          className="max-w-full max-h-full object-contain logo-hd drop-shadow-xs"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1 text-xs">
                        <div className="font-bold text-[#13262A] truncate">Logo Pemda Aktif</div>
                        <p className="text-[10px] text-[#566A6E]">Tampil di pojok kiri atas kop surat.</p>
                        {isOperator && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => filePemdaRef.current?.click()}
                              className="text-xs font-semibold text-[#0B6B58] hover:underline cursor-pointer"
                            >
                              Ganti Berkas
                            </button>
                            <span className="text-gray-300">&middot;</span>
                            <button
                              type="button"
                              onClick={() => {
                                handleFieldChange('logoPemda', '');
                                onToast('Logo Pemda dihapus.');
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isOperator ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingPemda(true);
                      }}
                      onDragLeave={() => setIsDraggingPemda(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingPemda(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleUploadPemda(f);
                      }}
                      onClick={() => filePemdaRef.current?.click()}
                      className={`p-5 rounded-lg border-2 border-dashed cursor-pointer transition text-center flex flex-col items-center justify-center gap-1.5 ${
                        isDraggingPemda
                          ? 'border-[#0B6B58] bg-[#DAEEE7]/60'
                          : 'border-[#CBD7D2] hover:border-[#0B6B58] bg-white'
                      }`}
                    >
                      <Upload className="w-5 h-5 text-[#0B6B58]" />
                      <div className="text-xs font-bold text-[#13262A]">Klik untuk unggah Logo Pemda</div>
                      <div className="text-[10px] text-[#566A6E]">PNG transparan, SVG, atau JPG resolusi tinggi</div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-[#D3DDD9] bg-white text-center text-xs text-[#566A6E]">
                      Belum ada Logo Pemda yang terpasang.
                    </div>
                  )}
                </div>

                {/* 2. Logo Sekolah */}
                <div className="p-4 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-[#13262A] block">
                        2. Logo Sekolah ({formData.namaSekolah || 'SD Negeri 2 Cempaka'})
                      </span>
                      <span className="text-[10px] text-[#566A6E]">Tampil di pojok kiri atas berdampingan atau kanan</span>
                    </div>
                    {formData.logoSekolah && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Terpasang
                      </span>
                    )}
                  </div>

                  <input
                    ref={fileSekolahRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadSekolah(f);
                      e.target.value = '';
                    }}
                  />

                  {formData.logoSekolah ? (
                    <div className="p-3 bg-white border border-gray-200 rounded-lg flex items-center gap-3">
                      <div className="w-16 h-20 bg-gray-50 border border-gray-200 rounded flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        <img
                          src={formData.logoSekolah}
                          alt="Logo Sekolah"
                          className="max-w-full max-h-full object-contain logo-hd drop-shadow-xs"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1 text-xs">
                        <div className="font-bold text-[#13262A] truncate">Logo Sekolah Aktif</div>
                        <p className="text-[10px] text-[#566A6E]">Emblem resmi satuan pendidikan.</p>
                        {isOperator && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => fileSekolahRef.current?.click()}
                              className="text-xs font-semibold text-[#0B6B58] hover:underline cursor-pointer"
                            >
                              Ganti Berkas
                            </button>
                            <span className="text-gray-300">&middot;</span>
                            <button
                              type="button"
                              onClick={() => {
                                handleFieldChange('logoSekolah', '');
                                onToast('Logo Sekolah dihapus.');
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isOperator ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingSekolah(true);
                      }}
                      onDragLeave={() => setIsDraggingSekolah(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingSekolah(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleUploadSekolah(f);
                      }}
                      onClick={() => fileSekolahRef.current?.click()}
                      className={`p-5 rounded-lg border-2 border-dashed cursor-pointer transition text-center flex flex-col items-center justify-center gap-1.5 ${
                        isDraggingSekolah
                          ? 'border-[#0B6B58] bg-[#DAEEE7]/60'
                          : 'border-[#CBD7D2] hover:border-[#0B6B58] bg-white'
                      }`}
                    >
                      <Upload className="w-5 h-5 text-[#0B6B58]" />
                      <div className="text-xs font-bold text-[#13262A]">Klik untuk unggah Logo Sekolah</div>
                      <div className="text-[10px] text-[#566A6E]">PNG transparan, SVG, atau JPG resolusi tinggi</div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-[#D3DDD9] bg-white text-center text-xs text-[#566A6E]">
                      Belum ada Logo Sekolah yang terpasang.
                    </div>
                  )}
                </div>
              </div>

              {/* Layout & Height Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-[#D3DDD9]">
                <div className="p-4 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9] space-y-2.5">
                  <label className="text-xs font-bold text-[#13262A] flex items-center gap-1.5">
                    Tata Letak Penempatan Logo:
                  </label>
                  <select
                    value={formData.tataLetakLogo || 'kiri_kedua'}
                    onChange={(e) => handleFieldChange('tataLetakLogo', e.target.value)}
                    disabled={!isOperator}
                    className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg bg-white font-bold text-[#0B6B58] disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                  >
                    <option value="kiri_kedua">
                      Pojok Kiri Atas: Logo Pemda & Logo Sekolah Berdampingan (Sesuai Permintaan)
                    </option>
                    <option value="kiri_kanan">
                      Logo Pemda di Pojok Kiri Atas & Logo Sekolah di Pojok Kanan Atas
                    </option>
                    <option value="kiri_pemda_saja">Hanya Logo Pemda di Pojok Kiri Atas</option>
                    <option value="kiri_sekolah_saja">Hanya Logo Sekolah di Pojok Kiri Atas</option>
                  </select>
                  <p className="text-[10px] text-[#566A6E] leading-relaxed">
                    Saat opsi <b>&quot;Pojok Kiri Atas: Logo Pemda & Logo Sekolah Berdampingan&quot;</b> aktif, kedua logo yang diunggah akan tertata rapi berdampingan di sudut kiri atas surat.
                  </p>
                </div>

                <div className="p-4 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#13262A] flex items-center gap-1.5">
                      Tinggi Logo di Kop Surat:
                    </label>
                    <span className="font-mono text-xs font-bold text-[#0B6B58]">
                      {formData.logoHeight || 85} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="65"
                    max="115"
                    step="2"
                    value={formData.logoHeight || 85}
                    onChange={(e) => handleFieldChange('logoHeight', Number(e.target.value))}
                    disabled={!isOperator}
                    className="w-full accent-[#0B6B58] cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-[#566A6E]">
                    <span>Kompak (65px)</span>
                    <span>Standar Proporsional (85px)</span>
                    <span>Besar (115px)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Kop Text Inputs */}
            <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#13262A] pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0B6B58]" /> Teks Identitas Kop Surat Resmi (Tata Naskah Dinas)
              </h3>
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">
                    Kop Baris 1 (Pemerintah Kabupaten / Kota)
                  </label>
                  <input
                    type="text"
                    value={formData.kopInduk1 || ''}
                    onChange={(e) => handleFieldChange('kopInduk1', e.target.value)}
                    disabled={!isOperator}
                    placeholder="Contoh: PEMERINTAH KABUPATEN CIREBON"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold uppercase disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">
                    Kop Baris 2 (Dinas Pendidikan)
                  </label>
                  <input
                    type="text"
                    value={formData.kopInduk2 || ''}
                    onChange={(e) => handleFieldChange('kopInduk2', e.target.value)}
                    disabled={!isOperator}
                    placeholder="Contoh: DINAS PENDIDIKAN"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold uppercase disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">
                    Alamat Lengkap pada Kop Surat
                  </label>
                  <input
                    type="text"
                    value={formData.kopAlamat || ''}
                    onChange={(e) => handleFieldChange('kopAlamat', e.target.value)}
                    disabled={!isOperator}
                    placeholder="Jl. Raden Cempa No. 101 Desa Cempaka Kec. Talun Kab. Cirebon 45171"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg text-gray-700 disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Real-Time Preview */}
            <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D3DDD9]">
                <span className="font-bold text-xs text-[#13262A] flex items-center gap-1.5 uppercase tracking-wider font-display">
                  <Sparkles className="w-3.5 h-3.5 text-[#0B6B58]" /> Pratinjau Nyata Kop Surat Resmi
                </span>
                <span className="text-[11px] text-emerald-800 bg-emerald-100 font-bold px-2.5 py-0.5 rounded-full">
                  Format Presisi Seimbang
                </span>
              </div>
              <div className="p-6 bg-white border border-gray-300 rounded-lg shadow-inner max-w-2xl mx-auto select-none">
                <KopSuratHD config={formData} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROFIL SEKOLAH */}
        {effectiveTab === 'profil' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#13262A] pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
              <School className="w-4 h-4 text-[#0B6B58]" /> Identitas Satuan Pendidikan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Satuan Pendidikan *</label>
                <input
                  type="text"
                  value={formData.namaSekolah}
                  onChange={(e) => handleFieldChange('namaSekolah', e.target.value)}
                  disabled={!isOperator}
                  required
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#13262A] disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">NPSN *</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => handleFieldChange('npsn', e.target.value)}
                  disabled={!isOperator}
                  required
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nomor Statistik Sekolah (NSS)</label>
                <input
                  type="text"
                  value={formData.nss || ''}
                  onChange={(e) => handleFieldChange('nss', e.target.value)}
                  disabled={!isOperator}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Status Satuan Pendidikan</label>
                <select
                  value={formData.statusSekolah || 'a. Negeri Biasa'}
                  onChange={(e) => handleFieldChange('statusSekolah', e.target.value)}
                  disabled={!isOperator}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                >
                  <option value="a. Negeri Biasa">a. Negeri Biasa</option>
                  <option value="b. Negeri Inpres">b. Negeri Inpres</option>
                  <option value="c. Subsidi">c. Subsidi</option>
                  <option value="d. Bantuan">d. Bantuan</option>
                  <option value="e. Swasta Penuh">e. Swasta Penuh</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-[#566A6E] mb-1">Alamat Lengkap</label>
                <textarea
                  value={formData.alamat}
                  onChange={(e) => handleFieldChange('alamat', e.target.value)}
                  disabled={!isOperator}
                  rows={2}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Kecamatan</label>
                <input
                  type="text"
                  value={formData.kecamatan || ''}
                  onChange={(e) => handleFieldChange('kecamatan', e.target.value)}
                  disabled={!isOperator}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Kabupaten / Kota</label>
                <input
                  type="text"
                  value={formData.kabupaten || ''}
                  onChange={(e) => handleFieldChange('kabupaten', e.target.value)}
                  disabled={!isOperator}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
              </div>
              <div className="pt-3 md:col-span-2 border-t border-[#D3DDD9]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#566A6E] mb-3">
                  Pimpinan & Pejabat Sekolah
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[#566A6E] mb-1">Nama Kepala Sekolah *</label>
                    <input
                      type="text"
                      value={formData.kepsek}
                      onChange={(e) => handleFieldChange('kepsek', e.target.value)}
                      disabled={!isOperator}
                      required
                      className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#566A6E] mb-1">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      value={formData.nipKepsek}
                      onChange={(e) => handleFieldChange('nipKepsek', e.target.value)}
                      disabled={!isOperator}
                      className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-semibold disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#D3DDD9] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B6B58] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#0B6B58]" /> Operator Sekolah & Admin Dapodik
                    </h4>
                    {isOperator && (
                      <span className="text-[10px] text-[#0B6B58] bg-[#DAEEE7] border border-[#0B6B58]/20 px-2.5 py-0.5 rounded-full font-semibold">
                        Nama Disinkronkan Otomatis (Email 1 & Email 2 Sama)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#566A6E] leading-relaxed">
                    {isOperator
                      ? 'Nama operator sekolah selalu dijaga sama persis di seluruh sistem. Perubahan nama di akun email 1 otomatis tersinkron ke email 2 dan Supabase Cloud sehingga nama tidak berbeda-beda.'
                      : 'Informasi identitas Operator Sekolah.'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#566A6E] mb-1">Nama Operator Sekolah *</label>
                      <input
                        type="text"
                        value={formData.namaOperator || ''}
                        onChange={(e) => handleFieldChange('namaOperator', e.target.value)}
                        disabled={!isOperator}
                        placeholder="Contoh: Risna Hidayat, S.Kom"
                        className="w-full px-3 py-2 border border-[#0B6B58] rounded-lg font-bold text-[#0B6B58] bg-[#DAEEE7]/20 disabled:bg-[#E8EFEC] disabled:border-[#D3DDD9] disabled:text-[#566A6E] disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#566A6E] mb-1">NIP / NUPTK Operator</label>
                      <input
                        type="text"
                        value={formData.nipOperator || ''}
                        onChange={(e) => handleFieldChange('nipOperator', e.target.value)}
                        disabled={!isOperator}
                        placeholder="Contoh: 19890412 201902 1 003"
                        className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#566A6E] mb-1">Email 1 Operator (Email Utama)</label>
                      <input
                        type="email"
                        value={formData.emailOperator || ''}
                        onChange={(e) => handleFieldChange('emailOperator', e.target.value)}
                        disabled={!isOperator}
                        placeholder="Contoh: operator@sdn2cempaka.sch.id / risnahidayat09@gmail.com"
                        className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono text-xs disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#566A6E] mb-1">Email 2 Operator (Email Belajar.id / Alternatif)</label>
                      <input
                        type="email"
                        value={formData.emailOperator2 || ''}
                        onChange={(e) => handleFieldChange('emailOperator2', e.target.value)}
                        disabled={!isOperator}
                        placeholder="Contoh: risnahidayat17@admin.sd.belajar.id"
                        className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono text-xs disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ROMBEL KELAS */}
        {effectiveTab === 'profil' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#13262A] pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
              <School className="w-4 h-4 text-[#0B6B58]" /> Rombel Kelas
              {isOperator && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Khusus Operator</span>
              )}
            </h2>
            <p className="text-xs text-[#566A6E] leading-relaxed">
              Daftar rombongan belajar aktif yang dipakai di data siswa, mutasi, arsip absensi, penilaian, dan laporan.
            </p>
            <div className="flex flex-wrap gap-2">
              {rombelNow.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F1F4F2] border border-[#D3DDD9] rounded-full text-xs font-bold text-[#13262A]">
                  Kelas {k}
                  <span className="text-[10px] font-mono font-semibold text-[#566A6E]">{siswaPerRombel(k)} siswa</span>
                  {isOperator && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRombel(k)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded-full cursor-pointer"
                      title={`Hapus rombel ${k}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isOperator && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={newRombel}
                  onChange={(e) => setNewRombel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRombel();
                    }
                  }}
                  maxLength={12}
                  placeholder="Contoh: 1A"
                  className="w-40 px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddRombel}
                  className="px-3.5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Rombel
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: KONEKSI SUPABASE */}
        {isOperator && effectiveTab === 'supabase' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-5">
            <div className="pb-3 border-b border-[#D3DDD9] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#DAEEE7] text-[#0B6B58] rounded-lg">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                    Koneksi & Sinkronisasi Database Supabase
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Terkoneksi
                    </span>
                  </h2>
                  <p className="text-xs text-[#566A6E]">
                    Proyek Supabase: <b>{sbConfig.projectName}</b> (ID: <code className="font-mono text-[#0B6B58]">{sbConfig.projectId}</code>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={runSbTest}
                disabled={sbTesting}
                className="px-3.5 py-1.5 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                {sbTesting ? 'Mengecek...' : 'Tes Latensi'}
              </button>
            </div>

            {/* Test result alert */}
            {sbTestResult && (
              <div className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                sbTestResult.connected
                  ? 'bg-[#DDF1E3] border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}>
                {sbTestResult.connected ? <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" /> : <RotateCcw className="w-4 h-4 text-rose-700 shrink-0" />}
                <span>{sbTestResult.message}</span>
              </div>
            )}

            {/* Parameters card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Project URL</label>
                <input
                  type="text"
                  value={sbConfig.projectUrl}
                  disabled
                  className="w-full px-3 py-2 bg-gray-50 border border-[#D3DDD9] rounded-lg font-mono text-[11px] text-gray-700"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Project ID</label>
                <input
                  type="text"
                  value={sbConfig.projectId}
                  disabled
                  className="w-full px-3 py-2 bg-gray-50 border border-[#D3DDD9] rounded-lg font-mono text-[11px] font-bold text-[#0B6B58]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-[#566A6E] mb-1">Public API Key (Anon / Publishable)</label>
                <input
                  type="text"
                  value={sbConfig.apiKey}
                  disabled
                  className="w-full px-3 py-2 bg-gray-50 border border-[#D3DDD9] rounded-lg font-mono text-[11px] text-gray-700"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#566A6E] leading-relaxed">
              Supabase hanya menyimpan teks (tabel <code className="font-mono">{sbConfig.tablePrefix}app_store</code>). Foto dan berkas dokumen disimpan di ImageKit.
              Untuk ganti akun Supabase atau mengatur ImageKit, buka{' '}
              {onOpenSupabaseModal ? (
                <button type="button" onClick={onOpenSupabaseModal} className="underline font-semibold text-[#0B6B58] cursor-pointer">
                  Koneksi Supabase &amp; ImageKit
                </button>
              ) : (
                'menu Koneksi Supabase'
              )}
              .
            </p>

            {/* Quick Actions */}
            <div className="p-4 bg-[#F8FAF9] rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <span className="font-bold text-[#13262A] block">Sinkronisasi Cloud Sekarang</span>
                <span className="text-[11px] text-[#566A6E]">
                  Kirim salinan database lokal ke Supabase Cloud atau tarik pembaruan cloud.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullSupabase}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh dari Cloud
                </button>
                <button
                  type="button"
                  onClick={handlePushSupabase}
                  className="px-3 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" /> Unggah ke Cloud
                </button>
              </div>
            </div>

            {/* SQL Migration Script Box */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#13262A]">Skrip SQL Supabase untuk Proyek Anda</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateSupabaseSQLScript());
                    setCopiedSql(true);
                    onToast('Skrip SQL disalin!');
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-white border border-[#D3DDD9] hover:bg-gray-50 rounded text-xs font-semibold flex items-center gap-1 text-[#0B6B58] cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Tersalin!' : 'Salin Script SQL'}
                </button>
              </div>
              <pre className="p-3 bg-gray-900 text-emerald-400 font-mono text-[10px] rounded-lg overflow-x-auto max-h-40 leading-relaxed border border-gray-800">
                {generateSupabaseSQLScript()}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3B: WEB SERVICE LOKAL DAPODIK */}
        {isOperator && effectiveTab === 'dapodik' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs">
            <DapodikWebServicePanel config={formData} onToast={onToast} />
          </div>
        )}

        {/* TAB 4: TEMPLATE SURAT */}
        {effectiveTab === 'template' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D3DDD9]">
              <div>
                <h2 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0B6B58]" /> Format & Template Surat Keluar
                </h2>
                <p className="text-xs text-[#566A6E]">
                  {isOperator
                    ? 'Kelola template surat yang siap dipilih langsung di pembuat Surat Keluar.'
                    : 'Daftar template format surat keluar sekolah (Mode Lihat Saja).'}
                </p>
              </div>
              {isOperator && (
                <button
                  type="button"
                  onClick={() => setIsModalTemplateOpen(true)}
                  className="px-3.5 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Format Baru
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-[#D3DDD9] bg-[#F8FAF9] space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-[#13262A]">{t.judul}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold bg-[#DAEEE7] text-[#0B6B58] px-2 py-0.5 rounded-full">
                          {t.kategori || 'Umum'}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                          {t.ukuranKertas || 'A4'}
                        </span>
                      </div>
                    </div>
                    {isOperator && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Hapus format "${t.judul}"?`)) {
                            deleteTemplate(t.id);
                            setTemplates(getTemplates());
                            onToast(`Format "${t.judul}" dihapus.`);
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Hapus Format"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-3 bg-white p-2.5 rounded-lg border border-gray-200 font-sans leading-relaxed">
                    {t.isi || (t.isiHtml ? htmlToPlainText(t.isiHtml) : '(Belum ada isi format)')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PENOMORAN SURAT */}
        {effectiveTab === 'surat' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#13262A] pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0B6B58]" /> Pola Format Penomoran Surat Keluar
            </h2>
            <div className="space-y-4 text-xs max-w-xl">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Pola Format Nomor Surat</label>
                <input
                  type="text"
                  value={formData.formatNoSurat || ''}
                  onChange={(e) => handleFieldChange('formatNoSurat', e.target.value)}
                  disabled={!isOperator}
                  placeholder="Contoh: 421.2/{no:3}/SD/{tahun}"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold text-[#0B6B58] disabled:bg-[#E8EFEC] disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-[#566A6E] mt-1">
                  Tag yang didukung:{' '}
                  <code className="font-bold text-[#0B6B58]">{'{no:3}'}</code> (001, 002),{' '}
                  <code className="font-bold text-[#0B6B58]">{'{no}'}</code> (1, 2),{' '}
                  <code className="font-bold text-[#0B6B58]">{'{tahun}'}</code> (2026).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: BACKUP & RESTORE */}
        {isOperator && effectiveTab === 'backup' && (
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#13262A] pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
              <Download className="w-4 h-4 text-[#0B6B58]" /> Cadangan Data & Pemulihan
            </h2>
            <div className="space-y-4 text-xs max-w-xl">
              <div className="p-4 bg-[#F1F4F2] rounded-xl border border-[#D3DDD9] space-y-2">
                <div className="font-bold text-[#13262A]">Unduh Cadangan Lengkap (JSON)</div>
                <p className="text-gray-600 leading-relaxed">
                  Simpan salinan seluruh data (siswa, GTK, surat, aset, logo kop surat, pengaturan) ke komputer Anda.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const fName = downloadBackupJSON();
                      onToast(`Cadangan diunduh: ${fName}`);
                    }}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-[#D3DDD9] text-[#13262A] font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#0B6B58]" /> Unduh Cadangan JSON
                  </button>

                  <button
                    type="button"
                    onClick={() => fileRestoreRef.current?.click()}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-[#D3DDD9] text-[#13262A] font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#0B6B58]" /> Pulihkan dari Cadangan
                  </button>

                  <input
                    ref={fileRestoreRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && window.confirm('Pulihkan data dari cadangan ini? Data saat ini akan diperbarui.')) {
                        try {
                          const count = await restoreBackupJSON(file);
                          onToast(`Cadangan berhasil dipulihkan (${count} modul data).`);
                        } catch (err: any) {
                          onToast(err.message, true);
                        }
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-2">
                <div className="font-bold text-rose-800">Kembalikan ke Data Awal Bawaan</div>
                <p className="text-rose-700 leading-relaxed">
                  Mereset database kembali ke data contoh awal sekolah SDN 2 Cempaka.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset seluruh data aplikasi ke kondisi awal?')) {
                      resetToDefaults();
                      onToast('Data berhasil dikembalikan ke default bawaan.');
                    }
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Reset ke Data Awal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Save Button */}
        {isOperator && effectiveTab !== 'dapodik' && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Save className="w-4 h-4" /> Simpan Pengaturan Sekolah
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
