/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchoolConfig, ArsipAbsen as IArsipAbsen } from '../types';
import {
  getArsipAbsen,
  saveArsipAbsenList,
  getCurrentUser,
  subscribeToStorage,
} from '../lib/storage';
import {
  prepareFile,
  saveFile,
  deleteFile,
  openFile,
  downloadFile,
  newRecordId,
  subscribeFileSync,
  getPendingFileCount,
  type PreparedFile,
} from '../lib/files';
import {
  CalendarCheck,
  Plus,
  Eye,
  Download,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';

interface ArsipAbsenProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

const PERIOD_OPTIONS = [
  'Satu Tahun Ajaran',
  'Semester 1',
  'Semester 2',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
];

const formatSize = (bytes: number): string =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

export const ArsipAbsen: React.FC<ArsipAbsenProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const kelasList = (config.kelas || '1, 2, 3, 4, 5, 6')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const currentTa = config.tahunAjaran || '2026/2027';

  const [items, setItems] = useState<IArsipAbsen[]>(getArsipAbsen());
  const [filterKelas, setFilterKelas] = useState('semua');
  const [filterTa, setFilterTa] = useState('semua');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<PreparedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(getPendingFileCount());

  useEffect(() => subscribeFileSync(() => setPendingFiles(getPendingFileCount())), []);

  useEffect(() => {
    return subscribeToStorage(() => {
      setItems(getArsipAbsen());
    });
  }, []);

  const taOptions = Array.from(new Set([currentTa, ...items.map((i) => i.tahunAjaran)])).sort().reverse();

  const filtered = items.filter(
    (item) =>
      (filterKelas === 'semua' || item.kelas === filterKelas) &&
      (filterTa === 'semua' || item.tahunAjaran === filterTa)
  );

  const grouped = Array.from(new Set(filtered.map((i) => i.tahunAjaran)))
    .sort()
    .reverse()
    .map((ta) => ({
      ta,
      rows: filtered
        .filter((i) => i.tahunAjaran === ta)
        .sort(
          (a, b) =>
            String(a.kelas).localeCompare(String(b.kelas), 'id', { numeric: true }) ||
            (b.createdAt || 0) - (a.createdAt || 0)
        ),
    }));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const prepared = await prepareFile(file, { pdfOnly: true });
      setFileError(null);
      setSelectedFile(prepared);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca berkas.';
      setFileError(msg);
      setSelectedFile(null);
      onToast(msg, true);
      input.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (!selectedFile) {
      setFileError('Pilih berkas PDF absen terlebih dahulu.');
      onToast('Pilih berkas PDF absen terlebih dahulu.', true);
      return;
    }

    const form = new FormData(e.currentTarget);
    const user = getCurrentUser();
    const now = Date.now();
    setSaving(true);
    try {
      const { ref, cloud } = await saveFile(selectedFile);
      const record: IArsipAbsen = {
        id: newRecordId('aa'),
        kelas: String(form.get('kelas')),
        tahunAjaran: String(form.get('tahunAjaran') || '').trim() || currentTa,
        periode: String(form.get('periode')),
        keterangan: String(form.get('keterangan') || '').trim(),
        file: ref,
        uploadedBy: user?.name || '-',
        createdAt: now,
        updatedAt: now,
      };
      if (!saveArsipAbsenList([...getArsipAbsen(), record])) {
        await deleteFile(ref.id);
        throw new Error('Data arsip gagal disimpan di browser. Coba muat ulang halaman lalu ulangi.');
      }
      setItems(getArsipAbsen());
      setIsModalOpen(false);
      setSelectedFile(null);
      setFileError(null);
      onToast(
        cloud
          ? `Absen Kelas ${record.kelas} (${record.tahunAjaran}) berhasil diarsipkan.`
          : `Absen Kelas ${record.kelas} tersimpan di perangkat ini dan akan dikirim ke cloud otomatis saat koneksi tersedia.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan arsip absen.';
      setFileError(msg);
      onToast(msg, true);
    } finally {
      setSaving(false);
    }
  };

  const handleView = async (item: IArsipAbsen) => {
    const ok = await openFile(item.file);
    if (!ok) onToast('Berkas tidak ditemukan. Pastikan tabel mo_files sudah dibuat di Supabase atau buka dari perangkat yang mengunggahnya.', true);
  };

  const handleDownload = async (item: IArsipAbsen) => {
    const ok = await downloadFile(item.file);
    if (!ok) onToast('Berkas tidak ditemukan. Pastikan tabel mo_files sudah dibuat di Supabase atau unduh dari perangkat yang mengunggahnya.', true);
  };

  const handleDelete = (item: IArsipAbsen) => {
    if (window.confirm(`Hapus arsip absen "${item.file.name}" (Kelas ${item.kelas})?`)) {
      if (saveArsipAbsenList(getArsipAbsen().filter((i) => i.id !== item.id))) {
        deleteFile(item.file.id).catch(() => {});
        setItems(getArsipAbsen());
        onToast('Arsip absen berhasil dihapus.');
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">Arsip Absensi Siswa</h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Simpan dan akses berkas PDF absensi per rombel kelas dan tahun ajaran secara terorganisir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsModalOpen(true);
            setSelectedFile(null);
            setFileError(null);
          }}
          className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Unggah Absen (PDF)
        </button>
      </div>

      {pendingFiles > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg font-medium">
          {pendingFiles} berkas tersimpan di perangkat ini dan sedang dikirim ke cloud. Biarkan aplikasi tetap terbuka
          dan pastikan internet aktif. Jika terus muncul, jalankan Skrip SQL terbaru di menu Supabase Cloud.
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {['semua', ...kelasList].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKelas(k)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer border ${
                filterKelas === k
                  ? 'bg-[#DAEEE7] text-[#0B6B58] border-[#0B6B58]'
                  : 'bg-white text-[#566A6E] border-[#D3DDD9] hover:bg-[#E8EFEC]'
              }`}
            >
              {k === 'semua' ? 'Semua Kelas' : `Kelas ${k}`}
            </button>
          ))}
        </div>

        <select
          value={filterTa}
          onChange={(e) => setFilterTa(e.target.value)}
          className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
        >
          <option value="semua">Semua Tahun Ajaran</option>
          {taOptions.map((ta) => (
            <option key={ta} value={ta}>
              {ta}
            </option>
          ))}
        </select>
      </div>

      {/* Content list */}
      {grouped.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D3DDD9] rounded-2xl p-12 text-center text-[#566A6E] space-y-2">
          <CalendarCheck className="w-12 h-12 mx-auto text-gray-300" />
          <h3 className="font-bold text-sm text-[#13262A]">Belum Ada Arsip Absensi</h3>
          <p className="text-xs max-w-sm mx-auto">
            Klik tombol &quot;Unggah Absen (PDF)&quot; di atas untuk menyimpan rekapitulasi kehadiran siswa.
          </p>
        </div>
      ) : (
        grouped.map((grp) => (
          <section
            key={grp.ta}
            className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs"
          >
            <div className="p-4 bg-[#F1F4F2] border-b border-[#D3DDD9] flex items-center justify-between">
              <span className="font-bold text-sm text-[#13262A]">Tahun Ajaran {grp.ta}</span>
              <span className="text-xs font-mono text-[#566A6E]">{grp.rows.length} berkas tersimpan</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E8EFEC] text-[#566A6E] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 w-16 text-center">Kelas</th>
                    <th className="py-2.5 px-4">Periode</th>
                    <th className="py-2.5 px-4">Nama Berkas</th>
                    <th className="py-2.5 px-4">Ukuran</th>
                    <th className="py-2.5 px-4">Diunggah Oleh</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grp.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-7 rounded-lg bg-[#DAEEE7] text-[#0B6B58] font-bold">
                          {row.kelas}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#13262A]">{row.periode}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#13262A]">{row.file.name}</div>
                        {row.keterangan && (
                          <div className="text-[11px] text-[#566A6E] mt-0.5">{row.keterangan}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#566A6E]">{formatSize(row.file.size)}</td>
                      <td className="py-3 px-4">
                        <div>
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </div>
                        <div className="text-[11px] text-[#566A6E]">{row.uploadedBy || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleView(row)}
                            className="px-2.5 py-1 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Lihat
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(row)}
                            className="p-1.5 text-[#0B6B58] hover:bg-[#DAEEE7] rounded transition cursor-pointer"
                            title="Unduh"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {isOperator && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Hapus"
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
          </section>
        ))
      )}

      {/* UPLOAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-[#0B6B58]" /> Unggah Berkas Absen (PDF)
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Kelas</label>
                <select
                  name="kelas"
                  defaultValue={filterKelas !== 'semua' ? filterKelas : kelasList[0]}
                  className="w-full px-3 py-2 border rounded-lg font-bold text-[#0B6B58]"
                >
                  {kelasList.map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Tahun Ajaran</label>
                <input
                  name="tahunAjaran"
                  defaultValue={currentTa}
                  required
                  className="w-full px-3 py-2 border rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-[#566A6E] mb-1">Periode Kehadiran</label>
              <select name="periode" className="w-full px-3 py-2 border rounded-lg font-semibold">
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs">
              <label className="block font-semibold text-[#566A6E] mb-1">Keterangan (Opsional)</label>
              <input
                name="keterangan"
                placeholder="Contoh: Rekapitulasi bulanan semester ganjil"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="text-xs space-y-1.5">
              <label className="block font-semibold text-[#566A6E]">Pilih Berkas PDF (Maks. 3 MB)</label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-dashed border-[#CBD7D2] rounded-lg bg-gray-50 cursor-pointer"
              />
              {selectedFile && (
                <div className="text-emerald-700 text-[11px] font-semibold">
                  Terpilih: {selectedFile.name} ({formatSize(selectedFile.size)})
                </div>
              )}
              {fileError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fileError}
                </div>
              )}
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
                disabled={saving}
                className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-60 disabled:cursor-wait text-white font-semibold rounded-lg cursor-pointer shadow-xs"
              >
                {saving ? 'Menyimpan…' : 'Simpan Arsip'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
