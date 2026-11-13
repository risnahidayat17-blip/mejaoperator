/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SchoolConfig, Siswa, Mutasi, Rombel, Guru } from '../types';
import {
  getSiswas,
  saveSiswa,
  deleteSiswa,
  getMutasi,
  saveMutasi,
  deleteMutasi,
  getRombels,
  saveRombel,
  deleteRombelRecord,
  syncRombelsFromSiswa,
  getGurus,
  subscribeToStorage,
  subscribeToCloudChanges,
} from '../lib/storage';
import { KopSuratHD } from './KopSuratHD';
import { ImportDapodikSiswaModal } from './ImportDapodikSiswaModal';
import {
  Users,
  UserPlus,
  ArrowRightLeft,
  Search,
  Download,
  Printer,
  Pencil,
  Trash2,
  CheckCircle,
  X,
  FileSpreadsheet,
  School,
  GraduationCap,
  Plus,
  RefreshCw,
  Check,
  Sparkles,
  Layers,
  BookOpen,
} from 'lucide-react';

interface SiswaMutasiProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
  onNavigateToSurat?: (siswaId?: string) => void;
}

export const SiswaMutasi: React.FC<SiswaMutasiProps> = ({
  role,
  config,
  onToast,
  onNavigateToSurat,
}) => {
  const isOperator = role === 'operator';
  const [activeTab, setActiveTab] = useState<'daftar' | 'rombel' | 'mutasi'>('daftar');
  const [siswaList, setSiswaList] = useState<Siswa[]>(getSiswas());
  const [mutasiList, setMutasiList] = useState<Mutasi[]>(getMutasi());
  const [rombelList, setRombelList] = useState<Rombel[]>(getRombels());
  const [guruList, setGuruList] = useState<Guru[]>(getGurus());

  // Search & Filter
  const [searchSiswa, setSearchSiswa] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterRombel, setFilterRombel] = useState('');
  const [filterJk, setFilterJk] = useState('');

  const [searchRombel, setSearchRombel] = useState('');
  const [filterTingkatRombel, setFilterTingkatRombel] = useState('');

  const [searchMutasi, setSearchMutasi] = useState('');
  const [filterJenisMutasi, setFilterJenisMutasi] = useState('');

  // Modals
  const [isModalSiswaOpen, setIsModalSiswaOpen] = useState(false);
  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null);

  const [isModalRombelOpen, setIsModalRombelOpen] = useState(false);
  const [editingRombel, setEditingRombel] = useState<Rombel | null>(null);

  const [mutatingSiswa, setMutatingSiswa] = useState<Siswa | null>(null);
  const [isModalMutasiKeluarOpen, setIsModalMutasiKeluarOpen] = useState(false);

  const [isModalMutasiMasukOpen, setIsModalMutasiMasukOpen] = useState(false);
  const [isModalPrintRekapOpen, setIsModalPrintRekapOpen] = useState(false);
  const [isImportDapodikOpen, setIsImportDapodikOpen] = useState(false);

  const reloadData = () => {
    setSiswaList(getSiswas());
    setMutasiList(getMutasi());
    setRombelList(getRombels());
    setGuruList(getGurus());
  };

  useEffect(() => {
    const u1 = subscribeToStorage(reloadData);
    const u2 = subscribeToCloudChanges(reloadData);
    return () => {
      u1();
      u2();
    };
  }, []);

  const getStudentRombel = (s: Siswa): string => {
    if (s.rombel) return s.rombel;
    if (s.catatan) {
      const m = /(?:rombel|kelas)\s+([0-9]\s*[A-Za-z])/i.exec(s.catatan);
      if (m) return m[1].toUpperCase();
    }
    return s.kelas;
  };

  const kelasOptions = (config.kelas || '1, 2, 3, 4, 5, 6')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const activeSiswa = siswaList.filter((s) => s.status === 'Aktif');

  const filteredSiswa = activeSiswa.filter((s) => {
    const term = searchSiswa.toLowerCase().trim();
    const matchTerm =
      !term ||
      s.nama.toLowerCase().includes(term) ||
      (s.nis && s.nis.includes(term)) ||
      (s.nisn && s.nisn.includes(term)) ||
      (s.namaAyah && s.namaAyah.toLowerCase().includes(term));
    const matchKelas = !filterKelas || s.kelas === filterKelas;
    const matchRombel =
      !filterRombel ||
      getStudentRombel(s).replace(/\s+/g, '').toLowerCase() === filterRombel.replace(/\s+/g, '').toLowerCase();
    const matchJk = !filterJk || s.jk === filterJk;
    return matchTerm && matchKelas && matchRombel && matchJk;
  });

  const filteredRombels = rombelList.filter((r) => {
    const term = searchRombel.toLowerCase().trim();
    const matchTerm =
      !term ||
      r.nama.toLowerCase().includes(term) ||
      (r.waliKelasNama && r.waliKelasNama.toLowerCase().includes(term)) ||
      (r.ruangan && r.ruangan.toLowerCase().includes(term));
    const matchTingkat = !filterTingkatRombel || r.tingkat === filterTingkatRombel;
    return matchTerm && matchTingkat;
  });

  const handleSaveRombel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!nama) {
      onToast('Nama Rombel Belajar wajib diisi.', true);
      return;
    }
    const tingkat = String(form.get('tingkat') || '1').trim();
    const waliKelasId = String(form.get('waliKelasId') || '').trim() || undefined;
    const waliGuru = guruList.find((g) => g.id === waliKelasId);
    const kurikulum = String(form.get('kurikulum') || 'Kurikulum Merdeka').trim();
    const ruangan = String(form.get('ruangan') || '').trim() || undefined;
    const catatan = String(form.get('catatan') || '').trim() || undefined;

    const record: Rombel = {
      id: editingRombel ? editingRombel.id : `rmb_${Date.now()}`,
      nama,
      tingkat,
      waliKelasId,
      waliKelasNama: waliGuru ? waliGuru.nama : undefined,
      kurikulum,
      ruangan,
      catatan,
      createdAt: editingRombel?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    saveRombel(record);
    reloadData();
    setIsModalRombelOpen(false);
    setEditingRombel(null);
    onToast(editingRombel ? `Rombel "${nama}" berhasil diperbarui.` : `Rombel "${nama}" berhasil ditambahkan.`);
  };

  const handleDeleteRombel = (id: string, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus rombel belajar "${nama}"?`)) return;
    const res = deleteRombelRecord(id);
    onToast(res.message, !res.ok);
    if (res.ok) reloadData();
  };

  const handleSyncRombels = () => {
    const res = syncRombelsFromSiswa();
    reloadData();
    if (res.added > 0) {
      onToast(`Berhasil menambahkan ${res.added} rombel belajar dari data siswa Dapodik.`);
    } else {
      onToast(`Semua rombel dari data siswa sudah sinkron (${res.total} rombel terdaftar).`);
    }
  };

  const handleSaveSiswa = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').trim();
    if (!nama) {
      onToast('Nama Lengkap Siswa wajib diisi.', true);
      return;
    }

    const id = editingSiswa ? editingSiswa.id : `s_${Date.now()}`;
    const status = (form.get('status') as any) || 'Aktif';
    const tglMutasi = String(form.get('tglMutasi') || '').trim();
    const tujuanMutasi = String(form.get('tujuanMutasi') || '').trim();
    const alasanMutasi = String(form.get('alasanMutasi') || '').trim();

    const rombel = String(form.get('rombel') || '').trim() || undefined;
    let kelas = String(form.get('kelas') || kelasOptions[0]).trim();
    if (rombel) {
      const m = /([1-6])/.exec(rombel);
      if (m) kelas = m[1];
    }

    const record: Siswa = {
      id,
      nama,
      nis: String(form.get('nis') || '').trim() || undefined,
      nisn: String(form.get('nisn') || '').trim() || undefined,
      jk: (form.get('jk') as any) || 'L',
      agama: String(form.get('agama') || 'Islam').trim(),
      tempatLahir: String(form.get('tempatLahir') || '').trim() || undefined,
      tglLahir: String(form.get('tglLahir') || '').trim() || undefined,
      kelas,
      rombel,
      status,
      tglMutasi: status !== 'Aktif' && tglMutasi ? tglMutasi : undefined,
      tujuanMutasi: status !== 'Aktif' && tujuanMutasi ? tujuanMutasi : undefined,
      alasanMutasi: status !== 'Aktif' && alasanMutasi ? alasanMutasi : undefined,
      tahunMasuk: Number(form.get('tahunMasuk')) || new Date().getFullYear(),
      alamat: String(form.get('alamat') || '').trim() || undefined,
      namaAyah: String(form.get('namaAyah') || '').trim() || undefined,
      namaIbu: String(form.get('namaIbu') || '').trim() || undefined,
      telpOrtu: String(form.get('telpOrtu') || '').trim() || undefined,
      catatan: String(form.get('catatan') || '').trim() || undefined,
      createdAt: editingSiswa?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    saveSiswa(record);

    if (status !== 'Aktif') {
      const jenis =
        status === 'Mutasi'
          ? 'Keluar (pindah)'
          : status === 'Lulus'
          ? 'Lulus'
          : 'Keluar lainnya';
      saveMutasi({
        id: `mut_${Date.now()}`,
        siswaId: record.id,
        nama: record.nama,
        kelas: record.kelas,
        jenis,
        tanggal: tglMutasi || new Date().toISOString().split('T')[0],
        tujuan: tujuanMutasi || undefined,
        alasan: alasanMutasi || undefined,
        otomatis: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    reloadData();
    setIsModalSiswaOpen(false);
    setEditingSiswa(null);
    onToast(`Data siswa "${record.nama}" berhasil disimpan.`);
  };

  const handleDeleteSiswa = (id: string, nama: string) => {
    if (window.confirm(`Hapus data siswa "${nama}"?`)) {
      deleteSiswa(id);
      reloadData();
      onToast(`Data siswa "${nama}" telah dihapus.`);
    }
  };

  const exportSiswaCSV = () => {
    const headers = ['Nama Siswa', 'NIS', 'NISN', 'L/P', 'Kelas', 'Agama', 'Tempat Lahir', 'Tgl Lahir', 'Alamat', 'Orang Tua'];
    const rows = filteredSiswa.map((s) => [
      s.nama,
      s.nis || '-',
      s.nisn || '-',
      s.jk,
      s.kelas,
      s.agama || '-',
      s.tempatLahir || '-',
      s.tglLahir || '-',
      s.alamat || '-',
      s.namaAyah || s.namaIbu || '-',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map((e) => e.map((x) => `"${x}"`).join(';')).join('\r\n');
    const uri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', `Data_Siswa_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('Data siswa berhasil diekspor ke CSV.');
  };

  const handleSaveMutasiKeluar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mutatingSiswa) return;
    const form = new FormData(e.currentTarget);
    const jenis = (form.get('jenis') as any) || 'Keluar (pindah)';
    const tanggal = String(form.get('tanggal') || '').trim() || new Date().toISOString().split('T')[0];
    const tujuan = String(form.get('tujuan') || '').trim();
    const noSurat = String(form.get('noSurat') || '').trim();
    const alasan = String(form.get('alasan') || '').trim();

    const newStatus = jenis === 'Lulus' ? 'Lulus' : jenis === 'Keluar lainnya' ? 'Keluar' : 'Mutasi';

    saveSiswa({
      ...mutatingSiswa,
      status: newStatus,
      tglMutasi: tanggal,
      tujuanMutasi: tujuan || undefined,
      alasanMutasi: alasan || undefined,
      updatedAt: Date.now(),
    });

    saveMutasi({
      id: `mut_${Date.now()}`,
      siswaId: mutatingSiswa.id,
      nama: mutatingSiswa.nama,
      kelas: mutatingSiswa.kelas,
      jenis,
      tanggal,
      tujuan: tujuan || undefined,
      noSurat: noSurat || undefined,
      alasan: alasan || undefined,
      otomatis: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    reloadData();
    setIsModalMutasiKeluarOpen(false);
    const studentName = mutatingSiswa.nama;
    setMutatingSiswa(null);
    setActiveTab('mutasi');
    onToast(`Siswa "${studentName}" berhasil dimutasikan (${jenis}).`);
  };

  const handleSaveMutasiMasuk = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').trim();
    if (!nama) {
      onToast('Nama Lengkap Siswa wajib diisi.', true);
      return;
    }
    const kelas = String(form.get('kelas') || kelasOptions[0]).trim();
    const tanggal = String(form.get('tanggal') || '').trim() || new Date().toISOString().split('T')[0];
    const asal = String(form.get('asal') || '').trim();
    const noSurat = String(form.get('noSurat') || '').trim();
    const alasan = String(form.get('alasan') || '').trim();
    const autoAddSiswa = form.get('masukkanKeSiswaAktif') === 'on';

    const newSiswaId = `s_${Date.now()}`;
    if (autoAddSiswa) {
      saveSiswa({
        id: newSiswaId,
        nama,
        nis: String(form.get('nis') || '').trim() || undefined,
        nisn: String(form.get('nisn') || '').trim() || undefined,
        jk: (form.get('jk') as any) || 'L',
        kelas,
        status: 'Aktif',
        tahunMasuk: new Date().getFullYear(),
        catatan: asal ? `Pindahan masuk dari ${asal}` : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    saveMutasi({
      id: `mut_${Date.now()}`,
      siswaId: autoAddSiswa ? newSiswaId : undefined,
      nama,
      kelas,
      jenis: 'Masuk (pindahan)',
      tanggal,
      asal: asal || undefined,
      noSurat: noSurat || undefined,
      alasan: alasan || undefined,
      otomatis: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    reloadData();
    setIsModalMutasiMasukOpen(false);
    onToast(
      autoAddSiswa
        ? `Siswa masuk "${nama}" berhasil dicatat & masuk ke daftar aktif.`
        : `Mutasi masuk "${nama}" berhasil disimpan.`
    );
  };

  const filteredMutasi = mutasiList.filter((m) => {
    const term = searchMutasi.toLowerCase().trim();
    const matchTerm =
      !term ||
      m.nama.toLowerCase().includes(term) ||
      (m.tujuan && m.tujuan.toLowerCase().includes(term)) ||
      (m.asal && m.asal.toLowerCase().includes(term)) ||
      (m.alasan && m.alasan.toLowerCase().includes(term)) ||
      (m.noSurat && m.noSurat.toLowerCase().includes(term));
    const matchJenis = !filterJenisMutasi || m.jenis === filterJenisMutasi;
    return matchTerm && matchJenis;
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Data Siswa & Mutasi Peserta Didik
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Pengelolaan buku induk siswa aktif, mutasi masuk pindahan, dan pencatatan mutasi keluar dengan Kop Surat HD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'daftar' && (
            <>
              <button
                type="button"
                onClick={() => setIsImportDapodikOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#E6F2EE] hover:bg-[#d8e9e4] text-[#0B6B58] border border-[#B8D7CD] rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Impor profil peserta didik dari berkas Dapodik (.xlsx, .xls, .csv)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B6B58]" /> Impor Data PD Dapodik
              </button>
              <button
                type="button"
                onClick={exportSiswaCSV}
                className="px-3 py-2 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Unduh CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingSiswa(null);
                  setIsModalSiswaOpen(true);
                }}
                className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Tambah Siswa Baru
              </button>
            </>
          )}

          {activeTab === 'rombel' && (
            <>
              <button
                type="button"
                onClick={handleSyncRombels}
                className="px-3.5 py-2 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                title="Deteksi rombel otomatis dari data siswa Dapodik"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#0B6B58]" /> Sinkronkan dari Siswa
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRombel(null);
                  setIsModalRombelOpen(true);
                }}
                className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Rombel Baru
              </button>
            </>
          )}

          {activeTab === 'mutasi' && (
            <>
              <button
                type="button"
                onClick={() => setIsModalPrintRekapOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Rekap Mutasi
              </button>
              <button
                type="button"
                onClick={() => setIsModalMutasiMasukOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#DAEEE7] hover:bg-[#c6e6db] text-[#0B6B58] border border-[#0B6B58]/30 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Catat Mutasi Masuk
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D3DDD9]">
        <button
          type="button"
          onClick={() => setActiveTab('daftar')}
          className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'daftar'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Daftar Siswa Aktif ({activeSiswa.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rombel')}
          className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'rombel'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          <School className="w-3.5 h-3.5" />
          Rombongan Belajar ({rombelList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mutasi')}
          className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'mutasi'
              ? 'border-[#0B6B58] text-[#0B6B58]'
              : 'border-transparent text-[#566A6E] hover:text-[#13262A]'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Catatan Mutasi Siswa ({mutasiList.length})
        </button>
      </div>

      {/* TAB 1: DAFTAR SISWA AKTIF */}
      {activeTab === 'daftar' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
              <input
                type="search"
                value={searchSiswa}
                onChange={(e) => setSearchSiswa(e.target.value)}
                placeholder="Cari nama siswa, NIS, NISN, atau orang tua..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
              />
            </div>

            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Tingkat</option>
              {kelasOptions.map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>

            <select
              value={filterRombel}
              onChange={(e) => setFilterRombel(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-medium"
            >
              <option value="">Semua Rombel</option>
              {rombelList.map((r) => (
                <option key={r.id} value={r.nama}>
                  Rombel {r.nama} (K{r.tingkat})
                </option>
              ))}
            </select>

            <select
              value={filterJk}
              onChange={(e) => setFilterJk(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Laki-laki & Perempuan</option>
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Lengkap Siswa</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">L/P</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Rombel / Kelas</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Orang Tua / Wali</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Alamat</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {filteredSiswa.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#13262A] text-sm">{s.nama}</div>
                        <div className="text-[11px] font-mono text-[#566A6E]">
                          NIS: {s.nis || '-'} &middot; NISN: {s.nisn || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            s.jk === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {s.jk}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F2EE] text-[#0B6B58] border border-[#B8D7CD]">
                          Rombel {getStudentRombel(s)}
                        </span>
                        <div className="text-[10px] text-[#566A6E] mt-0.5 font-medium">
                          Tingkat {s.kelas}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#566A6E]">
                        <div>{s.namaAyah || s.namaIbu || '-'}</div>
                        {s.telpOrtu && <div className="text-[10px] font-mono text-gray-500">{s.telpOrtu}</div>}
                      </td>
                      <td className="py-3 px-4 text-[#566A6E] max-w-xs truncate">{s.alamat || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOperator && (
                            <button
                              type="button"
                              onClick={() => {
                                setMutatingSiswa(s);
                                setIsModalMutasiKeluarOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-[#FBEFD0] hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg transition flex items-center gap-1 cursor-pointer"
                              title="Mutasikan siswa"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" /> Mutasikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSiswa(s);
                              setIsModalSiswaOpen(true);
                            }}
                            className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                            title="Ubah Data Siswa"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isOperator && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSiswa(s.id, s.nama)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Hapus Siswa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSiswa.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#566A6E]">
                        <div className="max-w-sm mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-full bg-[#E6F2EE] flex items-center justify-center text-[#0B6B58] mx-auto">
                            <FileSpreadsheet className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-[#13262A] text-sm">
                            {searchSiswa || filterKelas || filterJk
                              ? 'Tidak ada siswa yang sesuai filter pencarian'
                              : 'Belum ada data siswa aktif'}
                          </div>
                          <p className="text-xs text-[#566A6E]">
                            {searchSiswa || filterKelas || filterJk
                              ? 'Coba ubah kata kunci atau bersihkan filter kelas/jenis kelamin.'
                              : 'Mulai kelola kesiswaan dengan mengimpor langsung dari berkas profil Dapodik (.xlsx, .xls, .csv).'}
                          </p>
                          {!searchSiswa && !filterKelas && !filterJk && (
                            <button
                              type="button"
                              onClick={() => setIsImportDapodikOpen(true)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                            >
                              <FileSpreadsheet className="w-4 h-4" /> Impor Berkas Dapodik
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROMBONGAN BELAJAR (ROMBEL) */}
      {activeTab === 'rombel' && (
        <div className="space-y-4">
          {/* Quick Rombel Stats Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-[#0B6B58]" /> Total Rombel Belajar
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-0.5">
                {rombelList.length} <span className="text-xs font-normal text-gray-500">Rombel</span>
              </div>
              <div className="text-[10px] text-[#0B6B58] mt-0.5">Tingkat Kelas 1 s/d 6</div>
            </div>

            <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#0B6B58]" /> Siswa Terdaftar
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-0.5">
                {activeSiswa.length} <span className="text-xs font-normal text-gray-500">Siswa Aktif</span>
              </div>
              <div className="text-[10px] text-[#566A6E] mt-0.5">
                Rata-rata {Math.round(activeSiswa.length / Math.max(1, rombelList.length))} siswa/rombel
              </div>
            </div>

            <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#0B6B58]" /> Wali Kelas Ditugaskan
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-0.5">
                {rombelList.filter((r) => r.waliKelasNama).length} / {rombelList.length}
              </div>
              <div className="text-[10px] text-[#566A6E] mt-0.5">Guru penanggung jawab</div>
            </div>

            <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5 shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#0B6B58]" /> Kurikulum Berjalan
              </div>
              <div className="text-sm font-bold text-[#13262A] mt-1.5 truncate">
                Kurikulum Merdeka
              </div>
              <div className="text-[10px] text-[#0B6B58] mt-0.5">Standar Nasional</div>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={searchRombel}
                  onChange={(e) => setSearchRombel(e.target.value)}
                  placeholder="Cari nama rombel (1A, 4B) atau nama wali kelas..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
                />
              </div>

              <select
                value={filterTingkatRombel}
                onChange={(e) => setFilterTingkatRombel(e.target.value)}
                className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
              >
                <option value="">Semua Tingkat (1-6)</option>
                {['1', '2', '3', '4', '5', '6'].map((t) => (
                  <option key={t} value={t}>
                    Tingkat Kelas {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncRombels}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                title="Deteksi rombel otomatis dari biodata siswa / Dapodik"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#0B6B58]" /> Sinkronkan Rombel
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRombel(null);
                  setIsModalRombelOpen(true);
                }}
                className="px-3.5 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Rombel Baru
              </button>
            </div>
          </div>

          {/* Grid Cards of Rombels */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRombels.map((r) => {
              const studentsInThisRombel = activeSiswa.filter(
                (s) => getStudentRombel(s).replace(/\s+/g, '').toLowerCase() === r.nama.replace(/\s+/g, '').toLowerCase()
              );
              const countL = studentsInThisRombel.filter((s) => s.jk === 'L').length;
              const countP = studentsInThisRombel.filter((s) => s.jk === 'P').length;

              return (
                <div
                  key={r.id}
                  className="bg-white border border-[#D3DDD9] hover:border-[#0B6B58]/60 rounded-xl p-4.5 shadow-2xs transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-[#E6F2EE] text-[#0B6B58] border border-[#B8D7CD]">
                            Rombel {r.nama}
                          </span>
                          <span className="text-xs font-semibold text-[#13262A]">
                            Tingkat {r.tingkat}
                          </span>
                        </div>
                        {r.ruangan && (
                          <div className="text-[11px] text-[#566A6E] mt-1 font-medium">
                            {r.ruangan}
                          </div>
                        )}
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-[#566A6E]">
                        {r.kurikulum || 'Kurikulum Merdeka'}
                      </span>
                    </div>

                    {/* Wali Kelas */}
                    <div className="p-2.5 rounded-lg bg-[#F8FBFA] border border-[#E6EDEA] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#E6F2EE] text-[#0B6B58] flex items-center justify-center flex-none">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-[#566A6E] font-medium">Wali Kelas:</div>
                        <div className="text-xs font-bold text-[#13262A] truncate" title={r.waliKelasNama || 'Belum diatur'}>
                          {r.waliKelasNama || <span className="font-normal italic text-gray-400">Belum ditentukan</span>}
                        </div>
                      </div>
                    </div>

                    {/* Student count */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[#566A6E] font-medium">Jumlah Peserta Didik:</span>
                      <span className="font-bold text-[#13262A]">
                        {studentsInThisRombel.length} Siswa{' '}
                        <span className="text-[10px] font-normal text-gray-500">
                          ({countL} L &middot; {countP} P)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-[#E6EDEA] pt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterRombel(r.nama);
                        setActiveTab('daftar');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-[#0B6B58] hover:bg-[#E6F2EE] rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Lihat {studentsInThisRombel.length} Siswa
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRombel(r);
                          setIsModalRombelOpen(true);
                        }}
                        className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                        title="Ubah data rombel"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isOperator && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRombel(r.id, r.nama)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Hapus rombel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRombels.length === 0 && (
            <div className="bg-white border border-[#D3DDD9] rounded-xl p-12 text-center text-[#566A6E] space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#E6F2EE] flex items-center justify-center text-[#0B6B58] mx-auto">
                <School className="w-6 h-6" />
              </div>
              <div className="font-bold text-[#13262A] text-sm">
                Tidak ada rombel belajar yang sesuai
              </div>
              <p className="text-xs max-w-sm mx-auto">
                Tambahkan rombel kelas baru atau klik sinkronkan untuk mendeteksi rombel otomatis dari data siswa Dapodik.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSyncRombels}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#0B6B58]" /> Sinkronkan dari Siswa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRombel(null);
                    setIsModalRombelOpen(true);
                  }}
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Rombel Baru
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATATAN MUTASI */}
      {activeTab === 'mutasi' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
              <input
                type="search"
                value={searchMutasi}
                onChange={(e) => setSearchMutasi(e.target.value)}
                placeholder="Cari nama siswa, sekolah tujuan/asal, alasan..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
              />
            </div>

            <select
              value={filterJenisMutasi}
              onChange={(e) => setFilterJenisMutasi(e.target.value)}
              className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Jenis Mutasi</option>
              <option value="Masuk (pindahan)">Masuk (pindahan)</option>
              <option value="Keluar (pindah)">Keluar (pindah)</option>
              <option value="Lulus">Lulus</option>
              <option value="Keluar lainnya">Keluar lainnya</option>
            </select>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Tanggal</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Siswa</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Jenis Mutasi</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Sekolah Asal / Tujuan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">No. Surat</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Alasan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {filteredMutasi.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 font-mono text-[#566A6E] whitespace-nowrap">{m.tanggal}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#13262A]">{m.nama}</div>
                        <div className="text-[11px] text-[#566A6E]">Kelas {m.kelas}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            m.jenis === 'Masuk (pindahan)'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.jenis === 'Keluar (pindah)'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {m.jenis}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#13262A]">
                        {m.jenis === 'Masuk (pindahan)' ? m.asal || '-' : m.tujuan || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#566A6E]">{m.noSurat || '-'}</td>
                      <td className="py-3 px-4 text-[#566A6E] max-w-xs truncate" title={m.alasan}>
                        {m.alasan || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.jenis === 'Keluar (pindah)' && onNavigateToSurat && m.siswaId && (
                            <button
                              type="button"
                              onClick={() => onNavigateToSurat(m.siswaId)}
                              className="px-2.5 py-1 text-xs font-semibold bg-[#DAEEE7] hover:bg-[#0B6B58] text-[#0B6B58] hover:text-white rounded-lg transition cursor-pointer"
                              title="Buat Surat Keterangan Pindah Resmi"
                            >
                              Buat Surat Pindah
                            </button>
                          )}
                          {isOperator && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Hapus catatan mutasi "${m.nama}"?`)) {
                                  deleteMutasi(m.id);
                                  reloadData();
                                  onToast('Catatan mutasi dihapus.');
                                }
                              }}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus"
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
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT SISWA */}
      {isModalSiswaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-xl w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0B6B58]" />
                {editingSiswa ? `Ubah Data Siswa: ${editingSiswa.nama}` : 'Tambah Peserta Didik Baru'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalSiswaOpen(false);
                  setEditingSiswa(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSiswa} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap Siswa *</label>
                <input
                  name="nama"
                  defaultValue={editingSiswa?.nama || ''}
                  required
                  autoFocus
                  placeholder="Contoh: Alya Putri Ramadhani"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NIS</label>
                  <input
                    name="nis"
                    defaultValue={editingSiswa?.nis || ''}
                    placeholder="26101"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NISN (10 Digit)</label>
                  <input
                    name="nisn"
                    defaultValue={editingSiswa?.nisn || ''}
                    placeholder="0015678234"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jenis Kelamin</label>
                  <select
                    name="jk"
                    defaultValue={editingSiswa?.jk || 'L'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Rombel Belajar</label>
                  <select
                    name="rombel"
                    defaultValue={
                      editingSiswa
                        ? editingSiswa.rombel ||
                          rombelList.find(
                            (r) =>
                              r.nama.replace(/\s+/g, '').toLowerCase() ===
                              getStudentRombel(editingSiswa).replace(/\s+/g, '').toLowerCase()
                          )?.nama ||
                          ''
                        : ''
                    }
                    className="w-full px-3 py-2 border border-[#0B6B58] bg-[#F4FAF8] rounded-lg font-bold text-[#0B6B58]"
                  >
                    <option value="">-- Pilih Rombel --</option>
                    {rombelList.map((r) => (
                      <option key={r.id} value={r.nama}>
                        Rombel {r.nama} (Tk {r.tingkat})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tingkat Kelas *</label>
                  <select
                    name="kelas"
                    defaultValue={editingSiswa?.kelas || kelasOptions[0]}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#13262A]"
                  >
                    {kelasOptions.map((k) => (
                      <option key={k} value={k}>
                        Kelas {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Agama</label>
                  <select
                    name="agama"
                    defaultValue={editingSiswa?.agama || 'Islam'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  >
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingSiswa?.status || 'Aktif'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Mutasi">Mutasi (Pindah)</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Keluar">Keluar Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tempat Lahir</label>
                  <input
                    name="tempatLahir"
                    defaultValue={editingSiswa?.tempatLahir || ''}
                    placeholder="Contoh: Cirebon"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    name="tglLahir"
                    defaultValue={editingSiswa?.tglLahir || ''}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nama Ayah</label>
                  <input
                    name="namaAyah"
                    defaultValue={editingSiswa?.namaAyah || ''}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nama Ibu</label>
                  <input
                    name="namaIbu"
                    defaultValue={editingSiswa?.namaIbu || ''}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Alamat Rumah Lengkap</label>
                <textarea
                  name="alamat"
                  defaultValue={editingSiswa?.alamat || ''}
                  rows={2}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalSiswaOpen(false);
                    setEditingSiswa(null);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Data Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MUTASIKAN SISWA */}
      {isModalMutasiKeluarOpen && mutatingSiswa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-700" />
                Mutasikan Siswa: {mutatingSiswa.nama}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalMutasiKeluarOpen(false);
                  setMutatingSiswa(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMutasiKeluar} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jenis Mutasi *</label>
                  <select name="jenis" defaultValue="Keluar (pindah)" className="w-full px-3 py-2 border rounded-lg font-semibold">
                    <option value="Keluar (pindah)">Keluar (pindah sekolah)</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Keluar lainnya">Keluar lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Mutasi *</label>
                  <input
                    type="date"
                    name="tanggal"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Sekolah Tujuan</label>
                <input
                  name="tujuan"
                  placeholder="Contoh: SD Negeri 1 Sumber"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Alasan Mutasi</label>
                <input
                  name="alasan"
                  placeholder="Contoh: Mengikuti orang tua pindah dinas"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalMutasiKeluarOpen(false);
                    setMutatingSiswa(null);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer"
                >
                  Mutasikan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MUTASI MASUK */}
      {isModalMutasiMasukOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0B6B58]" />
                Catat Mutasi Masuk (Siswa Pindahan)
              </h3>
              <button
                type="button"
                onClick={() => setIsModalMutasiMasukOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMutasiMasuk} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap Siswa *</label>
                <input name="nama" required className="w-full px-3 py-2 border rounded-lg font-semibold" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Diterima di Kelas *</label>
                  <select
                    name="kelas"
                    defaultValue={kelasOptions[0]}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-[#0B6B58]"
                  >
                    {kelasOptions.map((k) => (
                      <option key={k} value={k}>
                        Kelas {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Masuk *</label>
                  <input
                    type="date"
                    name="tanggal"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Sekolah Asal</label>
                <input
                  name="asal"
                  placeholder="Contoh: SD Negeri 3 Talun"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2 text-[#13262A] font-semibold">
                <input type="checkbox" name="masukkanKeSiswaAktif" defaultChecked className="w-4 h-4 accent-[#0B6B58]" />
                Sekaligus masukkan ke Daftar Siswa Aktif
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalMutasiMasukOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan Mutasi Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINT REKAP MUTASI WITH KOP HD */}
      {isModalPrintRekapOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#F1F4F2] rounded-2xl shadow-xl border border-[#D3DDD9] w-full max-w-[1060px] my-4 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#0B6B58]" />
                Rekap Mutasi Siswa &mdash; Pratinjau Cetak Kop HD
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Cetak Lembar Rekap
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalPrintRekapOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-800 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-white p-8 rounded-xl border border-gray-300 shadow-sm print-sheet">
              <KopSuratHD config={config} />
              <div className="text-center font-bold text-sm tracking-wider uppercase underline pb-3">
                REKAPITULASI CATATAN MUTASI PESERTA DIDIK
              </div>

              <table className="w-full text-left text-xs border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100 text-center font-bold">
                    <th className="border border-black p-2 w-10">No</th>
                    <th className="border border-black p-2 w-28">Tanggal</th>
                    <th className="border border-black p-2">Nama Siswa</th>
                    <th className="border border-black p-2 w-16">Kelas</th>
                    <th className="border border-black p-2 w-32">Jenis Mutasi</th>
                    <th className="border border-black p-2">Sekolah Asal / Tujuan</th>
                    <th className="border border-black p-2">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {mutasiList.map((m, idx) => (
                    <tr key={m.id}>
                      <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-2 font-mono whitespace-nowrap">{m.tanggal}</td>
                      <td className="border border-black p-2 font-bold">{m.nama}</td>
                      <td className="border border-black p-2 text-center font-bold">{m.kelas}</td>
                      <td className="border border-black p-2 text-center font-semibold">{m.jenis}</td>
                      <td className="border border-black p-2">
                        {m.jenis === 'Masuk (pindahan)' ? m.asal || '-' : m.tujuan || '-'}
                      </td>
                      <td className="border border-black p-2">{m.alasan || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-8 text-xs">
                <div className="text-center w-64">
                  <div>
                    {config.kabupaten || 'Cirebon'},{' '}
                    {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div>Kepala Sekolah,</div>
                  <div className="h-16" />
                  <div className="font-bold underline">{config.kepsek}</div>
                  <div>NIP. {config.nipKepsek}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: TAMBAH / UBAH ROMBEL BELAJAR */}
      {isModalRombelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <School className="w-5 h-5 text-[#0B6B58]" />
                {editingRombel ? `Ubah Data Rombel: ${editingRombel.nama}` : 'Tambah Rombel Belajar Baru'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalRombelOpen(false);
                  setEditingRombel(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRombel} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nama Rombel *</label>
                  <input
                    name="nama"
                    defaultValue={editingRombel?.nama || ''}
                    required
                    placeholder="Contoh: 1A atau 6B"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58] uppercase"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Contoh: 1A, 1B, 2A, 3C, dll.</p>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tingkat Kelas *</label>
                  <select
                    name="tingkat"
                    defaultValue={editingRombel?.tingkat || '1'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                  >
                    {['1', '2', '3', '4', '5', '6'].map((t) => (
                      <option key={t} value={t}>
                        Tingkat {t} (Kelas {t})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Guru / Wali Kelas</label>
                <select
                  name="waliKelasId"
                  defaultValue={editingRombel?.waliKelasId || ''}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} {g.nip ? `(NIP: ${g.nip})` : ''} - {g.jabatan || 'Guru'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-0.5">Guru yang ditugaskan sebagai wali kelas rombel ini.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kurikulum</label>
                  <select
                    name="kurikulum"
                    defaultValue={editingRombel?.kurikulum || 'Kurikulum Merdeka'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  >
                    <option value="Kurikulum Merdeka">Kurikulum Merdeka</option>
                    <option value="Kurikulum 2013">Kurikulum 2013</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Ruang Kelas / Gedung</label>
                  <input
                    name="ruangan"
                    defaultValue={editingRombel?.ruangan || ''}
                    placeholder="Contoh: Ruang 1A Gedung Utara"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Catatan Tambahan</label>
                <textarea
                  name="catatan"
                  defaultValue={editingRombel?.catatan || ''}
                  rows={2}
                  placeholder="Keterangan jadwal shift, pembagian kelompok, dll."
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalRombelOpen(false);
                    setEditingRombel(null);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Rombel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPOR DATA PD DAPODIK */}
      <ImportDapodikSiswaModal
        role={role}
        config={config}
        isOpen={isImportDapodikOpen}
        onClose={() => setIsImportDapodikOpen(false)}
        onToast={onToast}
        onSuccess={(res, count) => {
          reloadData();
          let msg = `Berhasil mengimpor ${count} data Dapodik: ${res.added} siswa baru ditambahkan`;
          if (res.updated > 0) msg += `, ${res.updated} data diperbarui`;
          if (res.skipped > 0) msg += `, ${res.skipped} dilewati`;
          onToast(msg + '.');
        }}
      />
    </div>
  );
};
