/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StikerBmd } from './StikerBmd';
import { SchoolConfig, Aset } from '../types';
import {
  getAsets,
  saveAset,
  deleteAset,
} from '../lib/storage';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Search,
  X,
} from 'lucide-react';

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

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAset, setEditingAset] = useState<Aset | null>(null);

  const reloadData = () => {
    setAsets(getAsets());
  };

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
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
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
                            {isOperator && (
                              <button
                                type="button"
                                onClick={() => handleDelete(a.id, a.nama)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Hapus Aset"
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
                onChange={(e) => setPenanggungJawab(e.target.value)}
                className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg w-56"
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
      {isModalOpen && (
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
    </div>
  );
};
