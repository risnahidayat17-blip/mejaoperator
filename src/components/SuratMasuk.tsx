/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { SchoolConfig, SuratMasuk as ISuratMasuk } from '../types';
import {
  getSuratMasuk,
  saveSuratMasuk,
  deleteSuratMasuk,
} from '../lib/storage';
import { isImageKitReady, uploadDataUrlToImageKit } from '../lib/imagekit';
import {
  Inbox,
  Plus,
  Pencil,
  Trash2,
  Camera,
  Search,
  Upload,
  CheckCircle,
  X,
} from 'lucide-react';

interface SuratMasukProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Berkas harus berupa gambar (JPG, PNG, WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const max = 1200;
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
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => reject(new Error('Gagal memproses gambar.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsDataURL(file);
  });
};

export const SuratMasuk: React.FC<SuratMasukProps> = ({ role, onToast }) => {
  const isOperator = role === 'operator';
  const [list, setList] = useState<ISuratMasuk[]>(getSuratMasuk());

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSifat, setFilterSifat] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ISuratMasuk | null>(null);
  const [fotoSurat, setFotoSurat] = useState('');
  const [isProcessingImg, setIsProcessingImg] = useState(false);
  const [previewFotoItem, setPreviewFotoItem] = useState<ISuratMasuk | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadData = () => {
    setList(getSuratMasuk());
  };

  const filtered = list.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      item.perihal.toLowerCase().includes(term) ||
      item.asal.toLowerCase().includes(term) ||
      (item.noSurat && item.noSurat.toLowerCase().includes(term)) ||
      (item.disposisi && item.disposisi.toLowerCase().includes(term));
    const matchStatus = !filterStatus || item.status === filterStatus;
    const matchSifat = !filterSifat || item.sifat === filterSifat;
    return matchTerm && matchStatus && matchSifat;
  });

  const openForm = (item?: ISuratMasuk | null) => {
    if (item) {
      setEditingItem(item);
      setFotoSurat(item.fotoSurat || '');
    } else {
      setEditingItem(null);
      setFotoSurat('');
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const record: ISuratMasuk = {
      id: editingItem ? editingItem.id : `sm_${Date.now()}`,
      noAgenda: editingItem ? editingItem.noAgenda : String(list.length + 1),
      tglTerima: String(form.get('tglTerima')).trim(),
      noSurat: String(form.get('noSurat')).trim() || undefined,
      tglSurat: String(form.get('tglSurat')).trim() || undefined,
      sifat: String(form.get('sifat')).trim() || 'Biasa',
      asal: String(form.get('asal')).trim(),
      perihal: String(form.get('perihal')).trim(),
      tujuan: String(form.get('tujuan')).trim() || 'Kepala Sekolah',
      status: (form.get('status') as any) || 'Baru',
      disposisi: String(form.get('disposisi')).trim() || undefined,
      keterangan: String(form.get('keterangan')).trim() || undefined,
      fotoSurat: fotoSurat || undefined,
      createdAt: editingItem ? editingItem.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    saveSuratMasuk(record);
    reloadData();
    setIsModalOpen(false);
    setEditingItem(null);
    setFotoSurat('');
    onToast(`Surat masuk "${record.perihal}" berhasil disimpan.`);
  };

  const handleDelete = (id: string, subject: string) => {
    if (!isOperator) {
      onToast('Hanya Operator yang berhak menghapus agenda surat masuk.', true);
      return;
    }
    if (window.confirm(`Hapus agenda surat masuk "${subject}"?`)) {
      deleteSuratMasuk(id);
      reloadData();
      onToast(`Surat masuk "${subject}" dihapus.`);
    }
  };

  const handleUploadPhoto = async (file: File) => {
    try {
      setIsProcessingImg(true);
      const compressed = await compressImage(file);
      if (isImageKitReady()) {
        try {
          const up = await uploadDataUrlToImageKit(compressed, `surat-masuk-${Date.now().toString(36)}`, {
            subfolder: 'surat-masuk',
          });
          setFotoSurat(up.url); // Supabase hanya menyimpan URL teksnya
          onToast('Foto bukti fisik surat berhasil diunggah ke ImageKit.');
          return;
        } catch (e) {
          setFotoSurat(compressed);
          onToast(
            `Unggah ke ImageKit gagal (${e instanceof Error ? e.message : 'error'}). Foto disimpan sementara di data lokal; jalankan "Migrasi ke ImageKit" nanti.`,
            true
          );
          return;
        }
      }
      setFotoSurat(compressed);
      onToast('Foto dimuat (ImageKit belum diatur, foto disimpan di data lokal).');
    } catch (err: any) {
      onToast(err.message || 'Gagal memproses gambar.', true);
    } finally {
      setIsProcessingImg(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Agenda Surat Masuk & Bukti Fisik
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Pencatatan surat resmi masuk, unggah foto bukti fisik asli, disposisi kepala sekolah, dan tindak lanjut.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openForm()}
          className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Catat Surat Masuk
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari perihal, pengirim, nomor surat, disposisi..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
        >
          <option value="">Semua Status</option>
          <option value="Baru">Baru</option>
          <option value="Diproses">Diproses</option>
          <option value="Selesai">Selesai</option>
        </select>

        <select
          value={filterSifat}
          onChange={(e) => setFilterSifat(e.target.value)}
          className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
        >
          <option value="">Semua Sifat Surat</option>
          <option value="Biasa">Biasa</option>
          <option value="Penting">Penting</option>
          <option value="Segera">Segera</option>
          <option value="Rahasia">Rahasia</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-16 text-center">Agenda</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Perihal & Pengirim</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nomor & Tanggal</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center w-28">Bukti Fisik</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Disposisi & Arahan</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center w-24">Status</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D3DDD9]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80">
                  <td className="py-3 px-4 text-center font-mono font-bold text-[#0B6B58]">
                    #{item.noAgenda}
                    <div className="text-[10px] text-[#566A6E] font-normal">{item.tglTerima}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#13262A] text-sm">{item.perihal}</div>
                    <div className="text-[11px] text-[#0B6B58] font-semibold mt-0.5">
                      Dari: {item.asal}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-[#13262A]">{item.noSurat || '-'}</div>
                    <div className="text-[11px] text-[#566A6E]">Tgl: {item.tglSurat || '-'}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.fotoSurat ? (
                      <button
                        type="button"
                        onClick={() => setPreviewFotoItem(item)}
                        className="group inline-flex flex-col items-center gap-1 cursor-pointer"
                        title="Klik untuk melihat foto fisik surat resolusi penuh"
                      >
                        <div className="w-12 h-14 rounded border border-gray-300 bg-gray-100 overflow-hidden shadow-xs group-hover:ring-2 group-hover:ring-[#0B6B58] transition relative">
                          <img src={item.fotoSurat} alt="Bukti fisik" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] text-[#0B6B58] font-semibold flex items-center gap-0.5">
                          <Camera className="w-3 h-3" /> Ada Foto
                        </span>
                      </button>
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Belum ada</span>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    {item.disposisi ? (
                      <div className="p-2 bg-[#F1F4F2] rounded-lg border border-[#D3DDD9] text-[11px] text-[#13262A]">
                        {item.disposisi}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-[11px]">Belum ada disposisi</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Selesai'
                          ? 'bg-[#DDF1E3] text-[#1D7A3A]'
                          : item.status === 'Diproses'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openForm(item)}
                        className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                        title="Ubah Surat"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isOperator && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.perihal)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Hapus Surat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-xl w-full p-6 space-y-4 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Inbox className="w-5 h-5 text-[#0B6B58]" />
                {editingItem ? 'Ubah Agenda Surat Masuk' : 'Pencatatan Surat Masuk Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Diterima *</label>
                  <input
                    type="date"
                    name="tglTerima"
                    defaultValue={editingItem?.tglTerima || new Date().toISOString().split('T')[0]}
                    required
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Sifat Surat</label>
                  <select name="sifat" defaultValue={editingItem?.sifat || 'Biasa'} className="w-full px-3 py-2 border rounded-lg">
                    <option value="Biasa">Biasa</option>
                    <option value="Penting">Penting</option>
                    <option value="Segera">Segera</option>
                    <option value="Rahasia">Rahasia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Instansi Asal Pengirim *</label>
                <input
                  name="asal"
                  defaultValue={editingItem?.asal}
                  required
                  placeholder="Contoh: Dinas Pendidikan Kabupaten Cirebon"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Perihal Surat *</label>
                <input
                  name="perihal"
                  defaultValue={editingItem?.perihal}
                  required
                  placeholder="Contoh: Pelaksanaan ANBK Jenjang SD 2026"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor Surat Masuk</label>
                  <input
                    name="noSurat"
                    defaultValue={editingItem?.noSurat}
                    placeholder="421.1/1280/Disdik/2026"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Surat</label>
                  <input
                    type="date"
                    name="tglSurat"
                    defaultValue={editingItem?.tglSurat}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              {/* Photo Upload Section */}
              <div className="p-3.5 bg-[#F8FAF9] rounded-xl border border-[#CBD7D2] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#13262A] flex items-center gap-1.5 text-xs">
                    <Camera className="w-4 h-4 text-[#0B6B58]" /> Foto / Scan Bukti Fisik Asli
                  </span>
                  {fotoSurat && (
                    <button
                      type="button"
                      onClick={() => setFotoSurat('')}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus Foto
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadPhoto(f);
                    e.target.value = '';
                  }}
                />

                {fotoSurat ? (
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                    <div className="w-16 h-20 bg-gray-100 rounded overflow-hidden shrink-0 border border-gray-300">
                      <img src={fotoSurat} alt="Foto fisik" className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Foto Fisik Terlampir
                      </div>
                      <p className="text-[10px] text-[#566A6E]">
                        Foto fisik surat telah tersimpan dan siap dijadikan arsip bukti dokumen.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-[#0B6B58] font-bold hover:underline cursor-pointer"
                      >
                        Ganti Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-lg border-2 border-dashed cursor-pointer transition text-center flex flex-col items-center justify-center gap-1 border-[#CBD7D2] hover:border-[#0B6B58] bg-white"
                  >
                    <Upload className="w-6 h-6 text-[#0B6B58]" />
                    <div className="text-xs font-semibold text-[#13262A]">
                      Ambil foto fisik atau pilih berkas scan surat
                    </div>
                    <div className="text-[10px] text-[#566A6E]">JPG, PNG, atau WebP</div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Disposisi Kepala Sekolah</label>
                <textarea
                  name="disposisi"
                  defaultValue={editingItem?.disposisi}
                  rows={2}
                  placeholder="Catatan arahan pimpinan..."
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
                  disabled={isProcessingImg}
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan Surat Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL PHOTO VIEW MODAL */}
      {previewFotoItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-700 max-w-3xl w-full overflow-hidden my-6">
            <div className="px-5 py-3.5 bg-[#13262A] text-white flex items-center justify-between">
              <span className="font-bold text-sm">
                Bukti Fisik: #{previewFotoItem.noAgenda} &mdash; {previewFotoItem.perihal}
              </span>
              <button
                type="button"
                onClick={() => setPreviewFotoItem(null)}
                className="p-1 text-gray-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-gray-900 flex items-center justify-center min-h-[350px] max-h-[70vh] overflow-y-auto">
              {previewFotoItem.fotoSurat ? (
                <img
                  src={previewFotoItem.fotoSurat}
                  alt="Bukti fisik"
                  className="max-h-[65vh] max-w-full object-contain rounded"
                />
              ) : (
                <span className="text-gray-400 text-xs">Belum ada foto fisik</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
