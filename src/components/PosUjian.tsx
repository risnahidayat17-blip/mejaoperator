/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SchoolConfig,
  PosUjianConfig,
  JadwalUjianItem,
  PesertaUjian,
  PanitiaUjianItem,
  PengawasSilangItem,
  Guru,
  Siswa,
} from '../types';
import {
  getPosUjianConfig,
  savePosUjianConfig,
  getPosUjianJadwal,
  savePosUjianJadwal,
  deletePosUjianJadwal,
  getPosUjianPeserta,
  savePosUjianPeserta,
  deletePosUjianPeserta,
  generatePesertaFromSiswa,
  getPosUjianPanitia,
  savePosUjianPanitia,
  deletePosUjianPanitia,
  getPosUjianPengawas,
  savePosUjianPengawas,
  deletePosUjianPengawas,
  getGurus,
  getSiswas,
} from '../lib/storage';
import { KopSuratHD } from './KopSuratHD';
import {
  FileText,
  Calendar,
  Users,
  UserCheck,
  ShieldAlert,
  Printer,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  CheckCircle,
  Clock,
  IdCard,
  VolumeX,
  AlertTriangle,
  School,
  Sparkles,
  Download,
  Search,
  CheckSquare,
} from 'lucide-react';

interface PosUjianProps {
  config: SchoolConfig;
  role: 'operator' | 'guru';
  onToast: (msg: string, isError?: boolean) => void;
  guruList?: Guru[];
  siswaList?: Siswa[];
}

type PosTab =
  | 'ringkasan'
  | 'jadwal'
  | 'peserta'
  | 'panitia'
  | 'pengawas'
  | 'denahduduk'
  | 'denahphoto'
  | 'kartu'
  | 'rambu';

export const PosUjian: React.FC<PosUjianProps> = ({
  config,
  role,
  onToast,
  guruList: propGuruList,
  siswaList: propSiswaList,
}) => {
  const isOperator = role === 'operator';

  // State Data
  const [activeTab, setActiveTab] = useState<PosTab>('ringkasan');
  const [posConfig, setPosConfig] = useState<PosUjianConfig>(getPosUjianConfig());
  const [jadwalList, setJadwalList] = useState<JadwalUjianItem[]>(getPosUjianJadwal());
  const [pesertaList, setPesertaList] = useState<PesertaUjian[]>(getPosUjianPeserta());
  const [panitiaList, setPanitiaList] = useState<PanitiaUjianItem[]>(getPosUjianPanitia());
  const [pengawasList, setPengawasList] = useState<PengawasSilangItem[]>(getPosUjianPengawas());
  const [allGurus, setAllGurus] = useState<Guru[]>(propGuruList || getGurus());
  const [allSiswas, setAllSiswas] = useState<Siswa[]>(propSiswaList || getSiswas());

  // Filter & Search states
  const [selectedRuang, setSelectedRuang] = useState<string>('Semua');
  const [searchPeserta, setSearchPeserta] = useState<string>('');
  const [filterRambu, setFilterRambu] = useState<
    'semua' | 'tenang' | 'batassuci' | 'tatatertib_siswa' | 'tatatertib_pengawas' | 'label_pintu' | 'label_ruang'
  >('semua');
  const [filterKartu, setFilterKartu] = useState<'semua' | 'panitia' | 'pengawas'>('semua');

  // Modals
  const [isModalConfigOpen, setIsModalConfigOpen] = useState(false);
  const [isModalJadwalOpen, setIsModalJadwalOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<JadwalUjianItem | null>(null);
  const [isModalPesertaOpen, setIsModalPesertaOpen] = useState(false);
  const [editingPeserta, setEditingPeserta] = useState<PesertaUjian | null>(null);
  const [isModalPanitiaOpen, setIsModalPanitiaOpen] = useState(false);
  const [editingPanitia, setEditingPanitia] = useState<PanitiaUjianItem | null>(null);
  const [isModalPengawasOpen, setIsModalPengawasOpen] = useState(false);
  const [editingPengawas, setEditingPengawas] = useState<PengawasSilangItem | null>(null);

  // Print Preview Modal state
  const [printDoc, setPrintDoc] = useState<
    | null
    | 'pos_cover'
    | 'jadwal'
    | 'peserta_dnt'
    | 'panitia_sk'
    | 'pengawas_rekap'
    | 'denah_duduk'
    | 'nomor_meja'
    | 'denah_photo'
    | 'kartu_id'
    | 'rambu_tenang'
    | 'rambu_batassuci'
    | 'rambu_tatatertib_siswa'
    | 'rambu_tatatertib_pengawas'
    | 'rambu_pintu'
  >(null);
  const [printRuang, setPrintRuang] = useState<string>('Ruang 01');

  const reloadAll = () => {
    setPosConfig(getPosUjianConfig());
    setJadwalList(getPosUjianJadwal());
    setPesertaList(getPosUjianPeserta());
    setPanitiaList(getPosUjianPanitia());
    setPengawasList(getPosUjianPengawas());
    setAllGurus(getGurus());
    setAllSiswas(getSiswas());
  };

  useEffect(() => {
    reloadAll();
  }, []);

  // List of available rooms
  const ruangOptions = Array.from(
    new Set(pesertaList.map((p) => p.ruang).filter(Boolean))
  ).sort();
  if (ruangOptions.length === 0) {
    ruangOptions.push('Ruang 01', 'Ruang 02');
  }

  // Filtered Peserta
  const filteredPeserta = pesertaList.filter((p) => {
    const matchRuang = selectedRuang === 'Semua' || p.ruang === selectedRuang;
    const term = searchPeserta.toLowerCase().trim();
    const matchTerm =
      !term ||
      p.nama.toLowerCase().includes(term) ||
      p.nomorPeserta.toLowerCase().includes(term) ||
      (p.nisn && p.nisn.includes(term)) ||
      (p.nis && p.nis.includes(term));
    return matchRuang && matchTerm;
  });

  // Handlers
  const handleSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const updated: PosUjianConfig = {
      ...posConfig,
      namaUjian: String(form.get('namaUjian') || '').trim() || posConfig.namaUjian,
      tahunPelajaran: String(form.get('tahunPelajaran') || '').trim() || posConfig.tahunPelajaran,
      semester: String(form.get('semester') || '2 (Genap)').trim(),
      tingkatKelas: String(form.get('tingkatKelas') || '6').trim(),
      tglMulai: String(form.get('tglMulai') || '').trim(),
      tglSelesai: String(form.get('tglSelesai') || '').trim(),
      tempatUjian: String(form.get('tempatUjian') || config.namaSekolah).trim(),
      penanggungJawab: String(form.get('penanggungJawab') || config.kepsek).trim(),
      ketuaPanitia: String(form.get('ketuaPanitia') || '').trim(),
      sekretaris: String(form.get('sekretaris') || '').trim(),
      bendahara: String(form.get('bendahara') || '').trim(),
      jumlahRuang: Number(form.get('jumlahRuang')) || 2,
      kapasitasPerRuang: Number(form.get('kapasitasPerRuang')) || 20,
      kodeSekolah: String(form.get('kodeSekolah') || '02-12-01').trim(),
      noSkPanitia: String(form.get('noSkPanitia') || '').trim(),
      tglSkPanitia: String(form.get('tglSkPanitia') || '').trim(),
      catatan: String(form.get('catatan') || '').trim(),
    };
    savePosUjianConfig(updated);
    setPosConfig(updated);
    setIsModalConfigOpen(false);
    onToast('Pengaturan POS Ujian Sekolah berhasil disimpan.');
  };

  const handleSaveJadwal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const hariTanggal = String(form.get('hariTanggal') || '').trim();
    const tanggal = String(form.get('tanggal') || '').trim();
    const jamKe = Number(form.get('jamKe')) || 1;
    const waktu = String(form.get('waktu') || '').trim();
    const mataPelajaran = String(form.get('mataPelajaran') || '').trim();
    const ruangRaw = String(form.get('ruangList') || '').trim();
    const keterangan = String(form.get('keterangan') || '').trim();

    if (!mataPelajaran || !waktu || !hariTanggal) {
      onToast('Mohon lengkapi mata pelajaran, hari/tanggal, dan waktu ujian.', true);
      return;
    }

    const item: JadwalUjianItem = {
      id: editingJadwal ? editingJadwal.id : `jdw_${Date.now()}`,
      hariTanggal,
      tanggal,
      jamKe,
      waktu,
      mataPelajaran,
      ruangList: ruangRaw
        ? ruangRaw.split(',').map((r) => r.trim()).filter(Boolean)
        : ['Ruang 01', 'Ruang 02'],
      keterangan: keterangan || undefined,
    };

    savePosUjianJadwal(item);
    reloadAll();
    setIsModalJadwalOpen(false);
    setEditingJadwal(null);
    onToast(`Jadwal ujian "${mataPelajaran}" berhasil disimpan.`);
  };

  const handleDeleteJadwal = (id: string, mapel: string) => {
    if (!window.confirm(`Hapus jadwal ujian untuk mata pelajaran "${mapel}"?`)) return;
    deletePosUjianJadwal(id);
    reloadAll();
    onToast(`Jadwal mata pelajaran "${mapel}" dihapus.`);
  };

  const handleGeneratePeserta = () => {
    const tingkat = posConfig.tingkatKelas || '6';
    if (
      pesertaList.length > 0 &&
      !window.confirm(
        `Sudah ada ${pesertaList.length} peserta ujian terdaftar. Apakah Anda ingin memperbarui dan men-generate ulang peserta dari data siswa kelas ${tingkat}?`
      )
    ) {
      return;
    }
    const res = generatePesertaFromSiswa(tingkat, posConfig.kapasitasPerRuang || 20, posConfig.kodeSekolah || '02-12-01');
    reloadAll();
    onToast(`Berhasil men-generate ${res.total} peserta ujian ke dalam ${res.ruangCount} ruang.`);
  };

  const handleSavePeserta = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').trim();
    const nomorPeserta = String(form.get('nomorPeserta') || '').trim();
    const nisn = String(form.get('nisn') || '').trim();
    const nis = String(form.get('nis') || '').trim();
    const jk = (form.get('jk') as any) || 'L';
    const kelas = String(form.get('kelas') || posConfig.tingkatKelas || '6').trim();
    const rombel = String(form.get('rombel') || '').trim() || undefined;
    const ruang = String(form.get('ruang') || 'Ruang 01').trim();
    const nomorMeja = Number(form.get('nomorMeja')) || 1;
    const tempatLahir = String(form.get('tempatLahir') || '').trim() || undefined;
    const tglLahir = String(form.get('tglLahir') || '').trim() || undefined;

    if (!nama || !nomorPeserta) {
      onToast('Nama dan Nomor Peserta wajib diisi.', true);
      return;
    }

    const item: PesertaUjian = {
      id: editingPeserta ? editingPeserta.id : `pst_${Date.now()}`,
      siswaId: editingPeserta?.siswaId,
      nomorPeserta,
      nisn,
      nis,
      nama,
      jk,
      kelas,
      rombel,
      ruang,
      nomorMeja,
      tempatLahir,
      tglLahir,
    };

    savePosUjianPeserta(item);
    reloadAll();
    setIsModalPesertaOpen(false);
    setEditingPeserta(null);
    onToast(`Data peserta "${nama}" berhasil disimpan.`);
  };

  const handleDeletePeserta = (id: string, nama: string) => {
    if (!window.confirm(`Hapus peserta ujian "${nama}"?`)) return;
    deletePosUjianPeserta(id);
    reloadAll();
    onToast(`Peserta ujian "${nama}" telah dihapus.`);
  };

  const handleSavePanitia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').trim();
    const nip = String(form.get('nip') || '').trim();
    const jabatanSekolah = String(form.get('jabatanSekolah') || '').trim();
    const jabatanPanitia = String(form.get('jabatanPanitia') || '').trim();
    const tugas = String(form.get('tugas') || '').trim();
    const noHp = String(form.get('noHp') || '').trim();

    if (!nama || !jabatanPanitia) {
      onToast('Nama dan Jabatan Panitia wajib diisi.', true);
      return;
    }

    const item: PanitiaUjianItem = {
      id: editingPanitia ? editingPanitia.id : `pnt_${Date.now()}`,
      nama,
      nip: nip || undefined,
      jabatanSekolah,
      jabatanPanitia,
      tugas: tugas || undefined,
      noHp: noHp || undefined,
    };

    savePosUjianPanitia(item);
    reloadAll();
    setIsModalPanitiaOpen(false);
    setEditingPanitia(null);
    onToast(`Panitia ujian "${nama}" (${jabatanPanitia}) berhasil disimpan.`);
  };

  const handleDeletePanitia = (id: string, nama: string) => {
    if (!window.confirm(`Hapus anggota panitia "${nama}"?`)) return;
    deletePosUjianPanitia(id);
    reloadAll();
    onToast(`Anggota panitia "${nama}" dihapus.`);
  };

  const handleSavePengawas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nama = String(form.get('nama') || '').trim();
    const nip = String(form.get('nip') || '').trim();
    const asalSekolah = String(form.get('asalSekolah') || '').trim();
    const ruangTugas = String(form.get('ruangTugas') || 'Ruang 01').trim();
    const hariTanggal = String(form.get('hariTanggal') || '').trim();
    const mataPelajaran = String(form.get('mataPelajaran') || '').trim();
    const sesi = String(form.get('sesi') || '').trim();
    const noHp = String(form.get('noHp') || '').trim();

    if (!nama || !asalSekolah) {
      onToast('Nama dan Asal Sekolah pengawas wajib diisi.', true);
      return;
    }

    const item: PengawasSilangItem = {
      id: editingPengawas ? editingPengawas.id : `pgw_${Date.now()}`,
      nama,
      nip: nip || undefined,
      asalSekolah,
      ruangTugas,
      hariTanggal: hariTanggal || undefined,
      mataPelajaran: mataPelajaran || undefined,
      sesi: sesi || undefined,
      noHp: noHp || undefined,
    };

    savePosUjianPengawas(item);
    reloadAll();
    setIsModalPengawasOpen(false);
    setEditingPengawas(null);
    onToast(`Pengawas silang "${nama}" berhasil disimpan.`);
  };

  const handleDeletePengawas = (id: string, nama: string) => {
    if (!window.confirm(`Hapus data pengawas "${nama}"?`)) return;
    deletePosUjianPengawas(id);
    reloadAll();
    onToast(`Data pengawas "${nama}" dihapus.`);
  };

  const handleSelectGuruForPanitia = (guruId: string) => {
    const g = allGurus.find((x) => x.id === guruId);
    if (!g) return;
    const form = document.querySelector<HTMLFormElement>('#form-panitia');
    if (!form) return;
    const inputNama = form.elements.namedItem('nama') as HTMLInputElement | null;
    const inputNip = form.elements.namedItem('nip') as HTMLInputElement | null;
    const inputJab = form.elements.namedItem('jabatanSekolah') as HTMLInputElement | null;
    const inputHp = form.elements.namedItem('noHp') as HTMLInputElement | null;
    if (inputNama) inputNama.value = g.nama;
    if (inputNip) inputNip.value = g.nip || '-';
    if (inputJab) inputJab.value = g.jabatan || 'Guru';
    if (inputHp) inputHp.value = g.telp || '';
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-[#D3DDD9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B6B58] uppercase tracking-wider">
            <School className="w-4 h-4" />
            <span>Administrasi Asesmen & Ujian</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#13262A] font-display mt-1">
            POS Ujian Sekolah &amp; Kelengkapan Dokumen
          </h1>
          <p className="text-xs text-[#566A6E] mt-0.5">
            {posConfig.namaUjian} &middot; Tahun Pelajaran {posConfig.tahunPelajaran} &middot;{' '}
            {config.namaSekolah || 'SD Negeri 2 Cempaka'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOperator && (
            <button
              type="button"
              onClick={() => setIsModalConfigOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5 text-[#0B6B58]" />
              Pengaturan Ujian
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setPrintDoc('pos_cover');
            }}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Berkas POS
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#D3DDD9] select-none text-xs">
        {[
          { id: 'ringkasan', label: 'Ringkasan & POS', icon: FileText },
          { id: 'jadwal', label: `Jadwal Ujian (${jadwalList.length})`, icon: Calendar },
          { id: 'peserta', label: `Daftar Peserta (${pesertaList.length})`, icon: Users },
          { id: 'panitia', label: `Panitia Ujian (${panitiaList.length})`, icon: UserCheck },
          { id: 'pengawas', label: `Pengawas Silang (${pengawasList.length})`, icon: ShieldAlert },
          { id: 'denahduduk', label: 'Denah Duduk Ujian', icon: CheckSquare },
          { id: 'denahphoto', label: 'Denah Photo Peserta', icon: Users },
          { id: 'kartu', label: 'Kartu Panitia & Pengawas', icon: IdCard },
          { id: 'rambu', label: 'Rambu-Rambu & Tata Tertib', icon: VolumeX },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as PosTab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#0B6B58] text-white shadow-xs'
                  : 'text-[#566A6E] hover:text-[#13262A] hover:bg-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: RINGKASAN & DOKUMEN POS */}
      {activeTab === 'ringkasan' && (
        <div className="space-y-5">
          {/* Status Kesiapan Ujian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-[#D3DDD9] shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center justify-between">
                <span>Total Peserta Terdaftar</span>
                <Users className="w-4 h-4 text-[#0B6B58]" />
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-1">
                {pesertaList.length} <span className="text-xs font-normal text-gray-500">Siswa</span>
              </div>
              <div className="text-[11px] text-[#0B6B58] font-medium mt-1">
                Tingkat Kelas {posConfig.tingkatKelas} &middot; {ruangOptions.length} Ruangan
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#D3DDD9] shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center justify-between">
                <span>Mata Pelajaran Diujikan</span>
                <Calendar className="w-4 h-4 text-[#0B6B58]" />
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-1">
                {jadwalList.length} <span className="text-xs font-normal text-gray-500">Mapel</span>
              </div>
              <div className="text-[11px] text-[#566A6E] mt-1 truncate">
                {posConfig.tglMulai || '18 Mei 2026'} s/d {posConfig.tglSelesai || '23 Mei 2026'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#D3DDD9] shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center justify-between">
                <span>Susunan Panitia Ujian</span>
                <UserCheck className="w-4 h-4 text-[#0B6B58]" />
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-1">
                {panitiaList.length} <span className="text-xs font-normal text-gray-500">Orang</span>
              </div>
              <div className="text-[11px] text-[#566A6E] mt-1 truncate">
                Ketua: {posConfig.ketuaPanitia || 'Risna Hidayat, S.Pd.'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#D3DDD9] shadow-2xs">
              <div className="text-[11px] text-[#566A6E] font-medium flex items-center justify-between">
                <span>Pengawas Silang Ruang</span>
                <ShieldAlert className="w-4 h-4 text-[#0B6B58]" />
              </div>
              <div className="text-2xl font-bold text-[#13262A] font-display mt-1">
                {pengawasList.length} <span className="text-xs font-normal text-gray-500">Pengawas</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-1">
                Silang antar SD Gugus / Kecamatan
              </div>
            </div>
          </div>

          {/* Quick Document Action Panel */}
          <div className="bg-white p-5 rounded-2xl border border-[#D3DDD9] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#13262A] font-display">
                  Paket Dokumen POS &amp; Perlengkapan Ujian Resmi
                </h3>
                <p className="text-xs text-[#566A6E]">
                  Pilih dokumen yang ingin dicetak langsung dengan format standar Dinas Pendidikan dan Kop HD Resmi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {[
                {
                  id: 'pos_cover',
                  title: 'Cover & Halaman Pengesahan POS',
                  desc: 'Halaman judul, lembar pengesahan kepala sekolah, dan dasar hukum POS.',
                  icon: FileText,
                  badge: 'Dokumen Inti',
                },
                {
                  id: 'jadwal',
                  title: 'Jadwal Ujian Resmi (Kop HD)',
                  desc: 'Tabel pelaksanaan mata pelajaran, alokasi jam/waktu, dan tanda tangan kepsek.',
                  icon: Calendar,
                  badge: 'Wajib Cetak',
                },
                {
                  id: 'peserta_dnt',
                  title: 'Daftar Nominasi Peserta (DNT)',
                  desc: 'Daftar nama, nomor peserta ujian, NISN, rombel, ruang, dan nomor meja.',
                  icon: Users,
                  badge: 'Dinas',
                },
                {
                  id: 'panitia_sk',
                  title: 'SK & Susunan Panitia Ujian',
                  desc: 'Surat Keputusan Kepala Sekolah tentang penetapan panitia beserta rincian tugas.',
                  icon: UserCheck,
                  badge: 'SK Resmi',
                },
                {
                  id: 'pengawas_rekap',
                  title: 'Rekap Jadwal & Tugas Pengawas Silang',
                  desc: 'Daftar pembagian ruang dan surat tugas pengawas silang antar sekolah.',
                  icon: ShieldAlert,
                  badge: 'Pengawas',
                },
                {
                  id: 'denah_duduk',
                  title: 'Denah Duduk Peserta Ruang Ujian',
                  desc: 'Diagram tata letak meja peserta zig-zag untuk ditempel di pintu dan ruang ujian.',
                  icon: CheckSquare,
                  badge: 'Ruangan',
                },
                {
                  id: 'nomor_meja',
                  title: 'Kartu / Label Nomor Meja Peserta',
                  desc: 'Label stiker meja berisi nomor meja, nomor peserta, nama siswa, dan NISN.',
                  icon: Sparkles,
                  badge: 'Meja Siswa',
                },
                {
                  id: 'denah_photo',
                  title: 'Denah Photo / Album Peserta Ujian',
                  desc: 'Lembar album verifikasi fisik foto siswa dengan kolom paraf kehadiran ujian.',
                  icon: Users,
                  badge: 'Pengawas',
                },
                {
                  id: 'kartu_id',
                  title: 'Kartu Panitia & Pengawas (ID Card)',
                  desc: 'Tanda pengenal resmi panitia dan pengawas ruang (siap potong & gantung).',
                  icon: IdCard,
                  badge: 'ID Card',
                },
                {
                  id: 'rambu_tenang',
                  title: 'Rambu: Harap Tenang Sedang Ujian',
                  desc: 'Plang peringatan resmi untuk ketertiban area ruang ujian sekolah.',
                  icon: VolumeX,
                  badge: 'Peringatan',
                },
                {
                  id: 'rambu_batassuci',
                  title: 'Rambu: Batas Suci Area Ujian',
                  desc: 'Tanda larangan masuk bagi pihak yang tidak berkepentingan selama ujian.',
                  icon: AlertTriangle,
                  badge: 'Peringatan',
                },
                {
                  id: 'rambu_tatatertib_siswa',
                  title: 'Tata Tertib Peserta & Pengawas',
                  desc: 'Lembar pedoman tata tertib resmi 10 poin peserta dan pengawas ruang.',
                  icon: FileText,
                  badge: 'Tata Tertib',
                },
              ].map((doc) => {
                const Icon = doc.icon;
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-[#D3DDD9] hover:border-[#0B6B58] transition bg-[#FBFDFD] flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-8 h-8 rounded-lg bg-[#E6F2EE] text-[#0B6B58] flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E8EFEC] text-[#566A6E]">
                          {doc.badge}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#13262A] font-display">{doc.title}</h4>
                      <p className="text-[11px] text-[#566A6E] mt-1 leading-snug">{doc.desc}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPrintDoc(doc.id as any)}
                      className="w-full py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#0B6B58] text-[#0B6B58] hover:text-white rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Pratinjau &amp; Cetak
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL UJIAN SEKOLAH */}
      {activeTab === 'jadwal' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#13262A] font-display">
                Jadwal Ujian Sekolah / Asesmen Sumatif Akhir Jenjang
              </h3>
              <p className="text-xs text-[#566A6E]">
                Atur hari, tanggal, alokasi waktu, dan mata pelajaran ujian untuk dicetak resmi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintDoc('jadwal')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak Jadwal (Kop HD)
              </button>
              {isOperator && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingJadwal(null);
                    setIsModalJadwalOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Mapel Ujian
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-12 text-center">No</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-48">Hari &amp; Tanggal</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-20 text-center">Sesi</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-36">Waktu Pelaksanaan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Mata Pelajaran Diujikan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Ruang</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Keterangan</th>
                    {isOperator && (
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right w-24">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {jadwalList.map((j, idx) => (
                    <tr key={j.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 text-center font-mono text-[#566A6E]">{idx + 1}</td>
                      <td className="py-3 px-4 font-semibold text-[#13262A] whitespace-nowrap">
                        {j.hariTanggal}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E6F2EE] text-[#0B6B58]">
                          Jam Ke-{j.jamKe}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-[#13262A] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#566A6E]" />
                          <span>{j.waktu}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#13262A] text-sm">
                        {j.mataPelajaran}
                      </td>
                      <td className="py-3 px-4 text-[#566A6E]">
                        {j.ruangList?.join(', ') || 'Semua Ruang'}
                      </td>
                      <td className="py-3 px-4 text-[#566A6E]">{j.keterangan || '-'}</td>
                      {isOperator && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingJadwal(j);
                                setIsModalJadwalOpen(true);
                              }}
                              className="p-1 text-[#566A6E] hover:text-[#0B6B58] rounded cursor-pointer"
                              title="Ubah"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteJadwal(j.id, j.mataPelajaran)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DAFTAR PESERTA UJIAN (DNT) */}
      {activeTab === 'peserta' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-[#566A6E] absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={searchPeserta}
                  onChange={(e) => setSearchPeserta(e.target.value)}
                  placeholder="Cari nama peserta, No. Peserta, NISN..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
                />
              </div>

              <select
                value={selectedRuang}
                onChange={(e) => setSelectedRuang(e.target.value)}
                className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-medium"
              >
                <option value="Semua">Semua Ruang ({pesertaList.length})</option>
                {ruangOptions.map((r) => (
                  <option key={r} value={r}>
                    {r} ({pesertaList.filter((p) => p.ruang === r).length} Siswa)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {isOperator && (
                <button
                  type="button"
                  onClick={handleGeneratePeserta}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  title="Generate otomatis dari data kesiswaan kelas 6"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#0B6B58]" />
                  Generate dari Siswa
                </button>
              )}

              <button
                type="button"
                onClick={() => setPrintDoc('peserta_dnt')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak DNT (Kop HD)
              </button>

              {isOperator && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPeserta(null);
                    setIsModalPesertaOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Peserta
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-12 text-center">No</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-40 font-mono">Nomor Peserta</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Lengkap Siswa</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center w-14">L/P</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] font-mono">NISN / NIS</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Rombel</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Ruang Ujian</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center w-20">No. Meja</th>
                    {isOperator && (
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right w-20">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {filteredPeserta.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 text-center font-mono text-[#566A6E]">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#0B6B58] whitespace-nowrap">
                        {p.nomorPeserta}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#13262A] text-sm">
                        {p.nama}
                        {p.tempatLahir && p.tglLahir && (
                          <div className="text-[10px] font-normal text-gray-500">
                            {p.tempatLahir}, {p.tglLahir}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.jk === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {p.jk}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#566A6E]">
                        <div>NISN: {p.nisn || '-'}</div>
                        <div className="text-[10px]">NIS: {p.nis || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-[#13262A]">
                          {p.rombel || `Kelas ${p.kelas}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-[#13262A]">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F2EE] text-[#0B6B58] border border-[#B8D7CD]">
                          {p.ruang}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-sm text-[#13262A]">
                        {p.nomorMeja}
                      </td>
                      {isOperator && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPeserta(p);
                                setIsModalPesertaOpen(true);
                              }}
                              className="p-1 text-[#566A6E] hover:text-[#0B6B58] rounded cursor-pointer"
                              title="Ubah"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePeserta(p.id, p.nama)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DAFTAR PANITIA UJIAN */}
      {activeTab === 'panitia' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#13262A] font-display">
                Susunan Panitia Pelaksana Ujian Sekolah
              </h3>
              <p className="text-xs text-[#566A6E]">
                Surat Keputusan (SK) dan rincian pembagian tugas kepanitiaan ujian sekolah.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintDoc('panitia_sk')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak SK Panitia (Kop HD)
              </button>
              {isOperator && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPanitia(null);
                    setIsModalPanitiaOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Panitia
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {panitiaList.map((p, idx) => (
              <div
                key={p.id}
                className="bg-white p-4 rounded-xl border border-[#D3DDD9] hover:border-[#0B6B58] transition shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#DAEEE7] text-[#0B6B58]">
                      {p.jabatanPanitia}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400">#{idx + 1}</span>
                  </div>

                  <h4 className="text-sm font-bold text-[#13262A] font-display mt-2">{p.nama}</h4>
                  <div className="text-[11px] text-[#566A6E] font-medium">
                    NIP: {p.nip || '-'} &middot; {p.jabatanSekolah || 'Guru'}
                  </div>

                  {p.tugas && (
                    <div className="mt-2 p-2.5 rounded-lg bg-[#F8FBFA] border border-[#E6EDEA] text-[11px] text-[#566A6E] leading-relaxed">
                      <span className="font-semibold text-gray-800">Tugas Pokok: </span>
                      {p.tugas}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#E6EDEA] pt-2.5 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#566A6E] font-mono">
                    {p.noHp ? `HP: ${p.noHp}` : 'SDN 2 Cempaka'}
                  </span>

                  {isOperator && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPanitia(p);
                          setIsModalPanitiaOpen(true);
                        }}
                        className="p-1 text-[#566A6E] hover:text-[#0B6B58] rounded cursor-pointer"
                        title="Ubah"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePanitia(p.id, p.nama)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PENGAWAS SILANG UJIAN */}
      {activeTab === 'pengawas' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#13262A] font-display">
                Daftar Pengawas Silang Ruang Ujian
              </h3>
              <p className="text-xs text-[#566A6E]">
                Rekapitulasi pembagian ruang dan jadwal pengawas silang antar sekolah gugus / kecamatan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintDoc('pengawas_rekap')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak Rekap &amp; Surat Tugas
              </button>
              {isOperator && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPengawas(null);
                    setIsModalPengawasOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Pengawas
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-12 text-center">No</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Lengkap Pengawas</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">NIP / Identitas</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Asal Satuan Pendidikan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-center">Ruang Tugas</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Jadwal Tugas &amp; Mapel</th>
                    {isOperator && (
                      <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right w-20">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {pengawasList.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-4 text-center font-mono text-[#566A6E]">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-[#13262A] text-sm">
                        {p.nama}
                        {p.noHp && <div className="text-[10px] text-gray-500 font-mono">No. HP: {p.noHp}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#566A6E]">{p.nip || '-'}</td>
                      <td className="py-3 px-4 font-semibold text-[#13262A]">{p.asalSekolah}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F2EE] text-[#0B6B58] border border-[#B8D7CD]">
                          {p.ruangTugas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#566A6E] max-w-xs">
                        <div className="font-semibold text-gray-800">{p.hariTanggal || 'Semua Hari Ujian'}</div>
                        <div className="text-[10px] truncate">{p.mataPelajaran || p.sesi || '-'}</div>
                      </td>
                      {isOperator && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPengawas(p);
                                setIsModalPengawasOpen(true);
                              }}
                              className="p-1 text-[#566A6E] hover:text-[#0B6B58] rounded cursor-pointer"
                              title="Ubah"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePengawas(p.id, p.nama)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DENAH DUDUK UJIAN */}
      {activeTab === 'denahduduk' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#566A6E]">Pilih Ruang Ujian:</span>
              <div className="flex items-center gap-1">
                {ruangOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPrintRuang(r)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      printRuang === r
                        ? 'bg-[#0B6B58] text-white shadow-xs'
                        : 'bg-gray-100 text-[#566A6E] hover:bg-gray-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintDoc('nomor_meja')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak Stiker Meja Peserta
              </button>

              <button
                type="button"
                onClick={() => setPrintDoc('denah_duduk')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Denah Ruang Ini
              </button>
            </div>
          </div>

          {/* Interactive Seating Layout Visualizer */}
          <div className="bg-white p-6 rounded-2xl border border-[#D3DDD9] shadow-xs space-y-6">
            <div className="text-center pb-2 border-b border-[#E6EDEA]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0B6B58]">
                TATA LETAK MEJA UJIAN &middot; {printRuang.toUpperCase()}
              </span>
              <h3 className="text-base font-bold text-[#13262A] font-display">
                Denah Duduk Peserta {posConfig.namaUjian}
              </h3>
              <p className="text-xs text-[#566A6E]">
                Format Standar Ujian Dinas (Maksimal 20 Peserta Per Ruangan, Susunan 4 Kolom x 5 Baris)
              </p>
            </div>

            {/* Front of Room Banner: Whiteboard & Supervisor Desks */}
            <div className="max-w-2xl mx-auto space-y-3">
              <div className="bg-[#13262A] text-white py-2 px-4 rounded-lg text-center font-bold text-xs tracking-wider uppercase shadow-xs">
                [ PAPAN TULIS DEPAN KELAS / ARAH PENGAWASAN ]
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="border-2 border-dashed border-[#0B6B58] bg-[#F4FAF8] p-2.5 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-[#0B6B58] uppercase">Meja Pengawas 1</div>
                  <div className="text-xs font-semibold text-[#13262A] truncate">
                    {pengawasList.find((pg) => pg.ruangTugas === printRuang)?.nama || 'Pengawas Ruang 1'}
                  </div>
                </div>
                <div className="border-2 border-dashed border-[#0B6B58] bg-[#F4FAF8] p-2.5 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-[#0B6B58] uppercase">Meja Pengawas 2</div>
                  <div className="text-xs font-semibold text-[#13262A] truncate">
                    {pengawasList.filter((pg) => pg.ruangTugas === printRuang)[1]?.nama || 'Pengawas Ruang 2'}
                  </div>
                </div>
              </div>
            </div>

            {/* Student Desks Grid (20 Desks) */}
            <div className="max-w-4xl mx-auto pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 20 }).map((_, i) => {
                  const mejaNo = i + 1;
                  const student = pesertaList.find(
                    (p) => p.ruang === printRuang && p.nomorMeja === mejaNo
                  );

                  return (
                    <div
                      key={mejaNo}
                      className={`p-3 rounded-xl border text-center transition ${
                        student
                          ? 'border-[#0B6B58]/40 bg-[#FAFDFC] hover:border-[#0B6B58] shadow-2xs'
                          : 'border-dashed border-gray-300 bg-gray-50/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-100">
                        <span className="font-mono text-[10px] font-bold text-[#0B6B58] bg-[#E6F2EE] px-1.5 py-0.5 rounded">
                          MEJA {String(mejaNo).padStart(2, '0')}
                        </span>
                        {student && (
                          <span
                            className={`text-[9px] font-bold px-1 rounded ${
                              student.jk === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                            }`}
                          >
                            {student.jk}
                          </span>
                        )}
                      </div>

                      {student ? (
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-[#13262A] truncate" title={student.nama}>
                            {student.nama}
                          </div>
                          <div className="font-mono text-[10px] text-[#566A6E] truncate">
                            {student.nomorPeserta}
                          </div>
                          <div className="text-[9px] text-gray-500 font-mono">
                            NISN: {student.nisn || '-'}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-[11px] text-gray-400 italic">Kosong / Cadangan</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center pt-3 text-xs text-[#566A6E]">
              Pintu Masuk Ruangan &middot; Denah ini harus dipasang pada pintu luar ruang ujian sebelum hari pertama pelaksanaan.
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DENAH PHOTO PESERTA UJIAN */}
      {activeTab === 'denahphoto' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#566A6E]">Pilih Ruang:</span>
              <div className="flex items-center gap-1">
                {ruangOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPrintRuang(r)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      printRuang === r
                        ? 'bg-[#0B6B58] text-white shadow-xs'
                        : 'bg-gray-100 text-[#566A6E] hover:bg-gray-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPrintDoc('denah_photo')}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Album Foto Ruang Ini
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D3DDD9] shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#13262A] font-display">
                Album / Denah Foto Peserta &mdash; {printRuang}
              </h3>
              <p className="text-xs text-[#566A6E]">
                Format pencocokan identitas fisik peserta ujian untuk pengawas ruang sebelum menandatangani lembar jawaban.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {pesertaList
                .filter((p) => p.ruang === printRuang)
                .sort((a, b) => a.nomorMeja - b.nomorMeja)
                .map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-[#D3DDD9] bg-[#FAFDFC] flex gap-3 items-center"
                  >
                    {/* Photo Box 3x4 */}
                    <div className="w-14 h-18 border-2 border-gray-300 rounded bg-gray-100 flex flex-col items-center justify-center text-center p-1 flex-none shadow-2xs">
                      <div className="text-[9px] font-bold text-gray-500">FOTO</div>
                      <div className="text-[8px] text-gray-400">3 x 4 cm</div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-bold bg-[#E6F2EE] text-[#0B6B58] px-1 rounded">
                          Meja {String(p.nomorMeja).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#13262A] truncate mt-1" title={p.nama}>
                        {p.nama}
                      </div>
                      <div className="font-mono text-[10px] text-[#0B6B58] font-semibold truncate">
                        {p.nomorPeserta}
                      </div>
                      <div className="text-[10px] text-[#566A6E] font-mono truncate">
                        NISN: {p.nisn || '-'}
                      </div>
                      <div className="mt-1 border-t border-dashed border-gray-200 pt-1 text-[9px] text-gray-400 italic">
                        Paraf Peserta: [ ......... ]
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: KARTU PANITIA DAN PENGAWAS */}
      {activeTab === 'kartu' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#566A6E]">Filter Kartu:</span>
              {(['semua', 'panitia', 'pengawas'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilterKartu(k)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition capitalize cursor-pointer ${
                    filterKartu === k
                      ? 'bg-[#0B6B58] text-white shadow-xs'
                      : 'bg-gray-100 text-[#566A6E] hover:bg-gray-200'
                  }`}
                >
                  {k === 'semua' ? 'Semua ID Card' : k === 'panitia' ? 'Panitia Saja' : 'Pengawas Saja'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPrintDoc('kartu_id')}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Semua Kartu ID Card
            </button>
          </div>

          {/* Cards Grid Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Panitia Cards */}
            {(filterKartu === 'semua' || filterKartu === 'panitia') &&
              panitiaList.map((p) => (
                <div
                  key={`card_pan_${p.id}`}
                  className="bg-white rounded-2xl border-2 border-[#0B6B58] p-4 text-center shadow-xs flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-2 bg-[#0B6B58]" />
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-[#0B6B58] uppercase tracking-wider">
                      KARTU TANDA PENGENAL
                    </div>
                    <div className="text-[11px] font-bold uppercase text-[#13262A] leading-tight">
                      PANITIA UJIAN SEKOLAH
                    </div>
                    <div className="text-[9px] text-[#566A6E] mt-0.5">
                      {config.namaSekolah || 'SD Negeri 2 Cempaka'} &middot; TP {posConfig.tahunPelajaran}
                    </div>

                    <div className="my-3 w-16 h-20 border-2 border-dashed border-gray-300 rounded mx-auto bg-gray-50 flex items-center justify-center text-[9px] text-gray-400">
                      Foto 3x4
                    </div>

                    <div className="text-xs font-bold text-[#13262A] leading-tight">{p.nama}</div>
                    <div className="text-[10px] font-mono text-[#566A6E]">NIP. {p.nip || '-'}</div>

                    <div className="mt-2.5 py-1 px-2 rounded-lg bg-[#DAEEE7] text-[#0B6B58] text-[11px] font-bold uppercase tracking-wide">
                      {p.jabatanPanitia}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200 mt-3 flex items-center justify-between text-[8px] text-[#566A6E]">
                    <div className="text-left leading-tight">
                      <div>Kepala Sekolah,</div>
                      <div className="font-bold underline text-black mt-3">{config.kepsek}</div>
                    </div>
                    <div className="w-10 h-10 border border-gray-300 rounded flex items-center justify-center text-[7px] text-gray-400">
                      QR CODE
                    </div>
                  </div>
                </div>
              ))}

            {/* Pengawas Cards */}
            {(filterKartu === 'semua' || filterKartu === 'pengawas') &&
              pengawasList.map((pg) => (
                <div
                  key={`card_pgw_${pg.id}`}
                  className="bg-white rounded-2xl border-2 border-emerald-700 p-4 text-center shadow-xs flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-700" />
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      KARTU TANDA PENGENAL
                    </div>
                    <div className="text-[11px] font-bold uppercase text-[#13262A] leading-tight">
                      PENGAWAS RUANG UJIAN
                    </div>
                    <div className="text-[9px] text-[#566A6E] mt-0.5">
                      {config.namaSekolah || 'SD Negeri 2 Cempaka'} &middot; TP {posConfig.tahunPelajaran}
                    </div>

                    <div className="my-3 w-16 h-20 border-2 border-dashed border-gray-300 rounded mx-auto bg-gray-50 flex items-center justify-center text-[9px] text-gray-400">
                      Foto 3x4
                    </div>

                    <div className="text-xs font-bold text-[#13262A] leading-tight">{pg.nama}</div>
                    <div className="text-[10px] font-mono text-[#566A6E]">NIP. {pg.nip || '-'}</div>
                    <div className="text-[10px] text-gray-600 truncate">{pg.asalSekolah}</div>

                    <div className="mt-2.5 py-1 px-2 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold uppercase tracking-wide">
                      Tugas: {pg.ruangTugas}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200 mt-3 flex items-center justify-between text-[8px] text-[#566A6E]">
                    <div className="text-left leading-tight">
                      <div>Kepala Sekolah,</div>
                      <div className="font-bold underline text-black mt-3">{config.kepsek}</div>
                    </div>
                    <div className="w-10 h-10 border border-gray-300 rounded flex items-center justify-center text-[7px] text-gray-400">
                      QR CODE
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 9: RAMBU-RAMBU & TATA TERTIB UJIAN */}
      {activeTab === 'rambu' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#13262A] font-display">
                Plang &amp; Rambu Peringatan Ruang Ujian Sekolah
              </h3>
              <p className="text-xs text-[#566A6E]">
                Cetak rambu peringatan, batas suci, tata tertib, dan label pintu ruangan standar dinas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rambu 1: Harap Tenang */}
            <div className="bg-white p-5 rounded-2xl border-2 border-red-500 shadow-xs space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <VolumeX className="w-8 h-8" />
                </div>
                <div className="text-xl font-black text-red-600 tracking-wider uppercase font-display pt-1">
                  HARAP TENANG !
                </div>
                <div className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  SEDANG BERLANGSUNG UJIAN SEKOLAH
                </div>
                <p className="text-xs text-gray-600">
                  DILARANG MEMBUAT KEGADUHAN, MENYALAKAN AUDIO, ATAU BERLALU LALANG DI SEKITAR AREA INI.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-[#566A6E]">Ukuran Cetak: A4 Landscape / Portrait</span>
                <button
                  type="button"
                  onClick={() => setPrintDoc('rambu_tenang')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak Rambu Harap Tenang
                </button>
              </div>
            </div>

            {/* Rambu 2: Batas Suci */}
            <div className="bg-white p-5 rounded-2xl border-2 border-amber-500 shadow-xs space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center mx-auto shadow-sm">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="text-xl font-black text-amber-700 tracking-wider uppercase font-display pt-1">
                  BATAS SUCI AREA UJIAN
                </div>
                <div className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  SELAIN PESERTA DAN PENGAWAS DILARANG MASUK
                </div>
                <p className="text-xs text-gray-600">
                  ORANG TUA/WALI MURID DAN PIHAK LUAR MOHON MENUNGGU DI LUAR AREA STERIL UJIAN.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-[#566A6E]">Ukuran Cetak: A4 Landscape / Portrait</span>
                <button
                  type="button"
                  onClick={() => setPrintDoc('rambu_batassuci')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak Rambu Batas Suci
                </button>
              </div>
            </div>

            {/* Rambu 3: Tata Tertib Peserta */}
            <div className="bg-white p-5 rounded-2xl border border-[#D3DDD9] shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6F2EE] text-[#0B6B58] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#13262A] font-display">
                    Tata Tertib Peserta Ujian Sekolah
                  </h4>
                  <p className="text-xs text-[#566A6E]">10 butir peraturan resmi dinas untuk peserta ujian.</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
                <div>1. Hadir di sekolah 15 menit sebelum bel ujian berbunyi.</div>
                <div>2. Membawa kartu peserta ujian dan alat tulis lengkap.</div>
                <div>3. Dilarang membawa HP, alat hitung, dan catatan ke meja ujian.</div>
                <div>4. Mengisi lembar jawaban dengan cermat dan rapi.</div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setPrintDoc('rambu_tatatertib_siswa')}
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak Tata Tertib Peserta
                </button>
              </div>
            </div>

            {/* Rambu 4: Label Pintu Ruang */}
            <div className="bg-white p-5 rounded-2xl border border-[#D3DDD9] shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6F2EE] text-[#0B6B58] flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#13262A] font-display">
                    Label Tempel Pintu Ruang Ujian &amp; Panitia
                  </h4>
                  <p className="text-xs text-[#566A6E]">
                    Signage pintu RUANG 01, RUANG 02, RUANG PANITIA, dan RUANG PENGAWAS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
                <div className="p-2 border rounded-lg bg-gray-50 text-[#0B6B58]">RUANG 01</div>
                <div className="p-2 border rounded-lg bg-gray-50 text-[#0B6B58]">RUANG 02</div>
                <div className="p-2 border rounded-lg bg-gray-50 text-gray-800">RUANG PANITIA</div>
                <div className="p-2 border rounded-lg bg-gray-50 text-gray-800">RUANG PENGAWAS</div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setPrintDoc('rambu_pintu')}
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Cetak Label Pintu Ruangan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PENGATURAN POS UJIAN */}
      {/* ========================================================================= */}
      {isModalConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-xl w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#0B6B58]" />
                Pengaturan Konfigurasi POS Ujian Sekolah
              </h3>
              <button
                type="button"
                onClick={() => setIsModalConfigOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Ujian / Asesmen *</label>
                <input
                  name="namaUjian"
                  defaultValue={posConfig.namaUjian}
                  required
                  placeholder="Contoh: Asesmen Sumatif Akhir Jenjang (ASAJ)"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tahun Pelajaran *</label>
                  <input
                    name="tahunPelajaran"
                    defaultValue={posConfig.tahunPelajaran}
                    required
                    placeholder="2025/2026"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Semester</label>
                  <select
                    name="semester"
                    defaultValue={posConfig.semester}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-medium"
                  >
                    <option value="2 (Genap)">2 (Genap)</option>
                    <option value="1 (Ganjil)">1 (Ganjil)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tingkat Kelas</label>
                  <select
                    name="tingkatKelas"
                    defaultValue={posConfig.tingkatKelas}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                  >
                    <option value="6">Kelas 6 (Ujian Akhir)</option>
                    <option value="Semua">Semua Tingkat (1-6)</option>
                    <option value="1">Kelas 1</option>
                    <option value="2">Kelas 2</option>
                    <option value="3">Kelas 3</option>
                    <option value="4">Kelas 4</option>
                    <option value="5">Kelas 5</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Mulai Ujian</label>
                  <input
                    type="date"
                    name="tglMulai"
                    defaultValue={posConfig.tglMulai}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Selesai Ujian</label>
                  <input
                    type="date"
                    name="tglSelesai"
                    defaultValue={posConfig.tglSelesai}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kode Sekolah (Dinas)</label>
                  <input
                    name="kodeSekolah"
                    defaultValue={posConfig.kodeSekolah}
                    placeholder="02-12-01"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kapasitas per Ruang</label>
                  <input
                    type="number"
                    name="kapasitasPerRuang"
                    defaultValue={posConfig.kapasitasPerRuang}
                    min={1}
                    max={40}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jumlah Ruang Ujian</label>
                  <input
                    type="number"
                    name="jumlahRuang"
                    defaultValue={posConfig.jumlahRuang}
                    min={1}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Penanggung Jawab (Kepsek)</label>
                  <input
                    name="penanggungJawab"
                    defaultValue={posConfig.penanggungJawab || config.kepsek}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Ketua Panitia</label>
                  <input
                    name="ketuaPanitia"
                    defaultValue={posConfig.ketuaPanitia}
                    placeholder="Nama Ketua Panitia"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor SK Panitia</label>
                  <input
                    name="noSkPanitia"
                    defaultValue={posConfig.noSkPanitia}
                    placeholder="421.2/045/SD-02/V/2026"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal SK Panitia</label>
                  <input
                    type="date"
                    name="tglSkPanitia"
                    defaultValue={posConfig.tglSkPanitia}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Catatan Tambahan POS</label>
                <textarea
                  name="catatan"
                  defaultValue={posConfig.catatan}
                  rows={2}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalConfigOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TAMBAH / UBAH JADWAL UJIAN */}
      {/* ========================================================================= */}
      {isModalJadwalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0B6B58]" />
                {editingJadwal ? `Ubah Jadwal: ${editingJadwal.mataPelajaran}` : 'Tambah Jadwal Ujian'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalJadwalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJadwal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Mata Pelajaran *</label>
                <input
                  name="mataPelajaran"
                  defaultValue={editingJadwal?.mataPelajaran || ''}
                  required
                  placeholder="Contoh: Pendidikan Agama dan Budi Pekerti"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Hari &amp; Tanggal Lengkap *</label>
                  <input
                    name="hariTanggal"
                    defaultValue={editingJadwal?.hariTanggal || ''}
                    required
                    placeholder="Contoh: Senin, 18 Mei 2026"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal (ISO)</label>
                  <input
                    type="date"
                    name="tanggal"
                    defaultValue={editingJadwal?.tanggal || ''}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jam / Sesi Ke-</label>
                  <select
                    name="jamKe"
                    defaultValue={editingJadwal?.jamKe || 1}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-medium"
                  >
                    <option value={1}>Sesi 1 (Pagi)</option>
                    <option value={2}>Sesi 2 (Siang)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Waktu Pelaksanaan *</label>
                  <input
                    name="waktu"
                    defaultValue={editingJadwal?.waktu || '07.30 - 09.30 WIB'}
                    required
                    placeholder="07.30 - 09.30 WIB"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Ruang Pelaksanaan (Pisahkan koma)</label>
                <input
                  name="ruangList"
                  defaultValue={editingJadwal?.ruangList?.join(', ') || 'Ruang 01, Ruang 02'}
                  placeholder="Ruang 01, Ruang 02"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Keterangan / Jumlah Soal</label>
                <input
                  name="keterangan"
                  defaultValue={editingJadwal?.keterangan || ''}
                  placeholder="Contoh: 40 butir Pilihan Ganda & 5 Uraian"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalJadwalOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TAMBAH / UBAH PESERTA UJIAN */}
      {/* ========================================================================= */}
      {isModalPesertaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0B6B58]" />
                {editingPeserta ? `Ubah Peserta: ${editingPeserta.nama}` : 'Tambah Peserta Ujian'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalPesertaOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePeserta} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap Siswa *</label>
                <input
                  name="nama"
                  defaultValue={editingPeserta?.nama || ''}
                  required
                  placeholder="Contoh: Muhammad Rizki"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor Peserta Ujian *</label>
                  <input
                    name="nomorPeserta"
                    defaultValue={editingPeserta?.nomorPeserta || `${posConfig.kodeSekolah}-6-0001-8`}
                    required
                    placeholder="02-12-01-6-0001-8"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold text-[#0B6B58]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jenis Kelamin</label>
                  <select
                    name="jk"
                    defaultValue={editingPeserta?.jk || 'L'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-medium"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NISN (10 Digit)</label>
                  <input
                    name="nisn"
                    defaultValue={editingPeserta?.nisn || ''}
                    placeholder="0012345678"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NIS</label>
                  <input
                    name="nis"
                    defaultValue={editingPeserta?.nis || ''}
                    placeholder="26101"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Ruang Ujian *</label>
                  <select
                    name="ruang"
                    defaultValue={editingPeserta?.ruang || 'Ruang 01'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58]"
                  >
                    {ruangOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor Meja *</label>
                  <input
                    type="number"
                    name="nomorMeja"
                    defaultValue={editingPeserta?.nomorMeja || 1}
                    min={1}
                    max={40}
                    required
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Rombel</label>
                  <input
                    name="rombel"
                    defaultValue={editingPeserta?.rombel || '6 A'}
                    placeholder="6 A"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tempat Lahir</label>
                  <input
                    name="tempatLahir"
                    defaultValue={editingPeserta?.tempatLahir || ''}
                    placeholder="Cirebon"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    name="tglLahir"
                    defaultValue={editingPeserta?.tglLahir || ''}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalPesertaOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Peserta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: TAMBAH / UBAH PANITIA UJIAN */}
      {/* ========================================================================= */}
      {isModalPanitiaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#0B6B58]" />
                {editingPanitia ? `Ubah Panitia: ${editingPanitia.nama}` : 'Tambah Panitia Ujian'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalPanitiaOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Pick Guru */}
            <div className="p-3 bg-[#F4FAF8] border border-[#B8D7CD] rounded-xl text-xs space-y-1">
              <span className="font-bold text-[#0B6B58]">Pilih Cepat dari Data Guru / Tendik Sekolah:</span>
              <select
                onChange={(e) => handleSelectGuruForPanitia(e.target.value)}
                defaultValue=""
                className="w-full px-2.5 py-1.5 border border-[#B8D7CD] rounded-lg bg-white font-medium"
              >
                <option value="">-- Pilih Guru / Tendik --</option>
                {allGurus.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama} &middot; {g.jabatan}
                  </option>
                ))}
              </select>
            </div>

            <form id="form-panitia" onSubmit={handleSavePanitia} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap &amp; Gelar *</label>
                <input
                  name="nama"
                  defaultValue={editingPanitia?.nama || ''}
                  required
                  placeholder="Contoh: Risna Hidayat, S.Pd."
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jabatan dalam Panitia *</label>
                  <select
                    name="jabatanPanitia"
                    defaultValue={editingPanitia?.jabatanPanitia || 'Anggota'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58]"
                  >
                    <option value="Penanggung Jawab">Penanggung Jawab</option>
                    <option value="Ketua Panitia">Ketua Panitia</option>
                    <option value="Sekretaris">Sekretaris</option>
                    <option value="Bendahara">Bendahara</option>
                    <option value="Seksi Naskah & Penggandaan">Seksi Naskah &amp; Penggandaan</option>
                    <option value="Seksi Pelaksana & Pengawasan">Seksi Pelaksana &amp; Pengawasan</option>
                    <option value="Seksi Konsumsi">Seksi Konsumsi</option>
                    <option value="Seksi Perlengkapan & Keamanan">Seksi Perlengkapan &amp; Keamanan</option>
                    <option value="Anggota">Anggota</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NIP (Kosongkan bila Non-ASN)</label>
                  <input
                    name="nip"
                    defaultValue={editingPanitia?.nip || ''}
                    placeholder="19880715..."
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jabatan di Sekolah</label>
                  <input
                    name="jabatanSekolah"
                    defaultValue={editingPanitia?.jabatanSekolah || 'Guru Kelas'}
                    placeholder="Contoh: Guru Kelas 6"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor HP / WhatsApp</label>
                  <input
                    name="noHp"
                    defaultValue={editingPanitia?.noHp || ''}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Uraian Tugas Pokok</label>
                <textarea
                  name="tugas"
                  defaultValue={editingPanitia?.tugas || ''}
                  rows={2}
                  placeholder="Keterangan tugas tanggung jawab dalam kepanitiaan ujian..."
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalPanitiaOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Panitia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: TAMBAH / UBAH PENGAWAS SILANG */}
      {/* ========================================================================= */}
      {isModalPengawasOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#0B6B58]" />
                {editingPengawas ? `Ubah Pengawas: ${editingPengawas.nama}` : 'Tambah Pengawas Silang Ujian'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalPengawasOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePengawas} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap &amp; Gelar Pengawas *</label>
                <input
                  name="nama"
                  defaultValue={editingPengawas?.nama || ''}
                  required
                  placeholder="Contoh: Dra. Hj. Nurjanah, M.Pd."
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Asal Satuan Pendidikan *</label>
                  <input
                    name="asalSekolah"
                    defaultValue={editingPengawas?.asalSekolah || 'SD Negeri 1 Cempaka'}
                    required
                    placeholder="SD Negeri 1 Cempaka"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NIP</label>
                  <input
                    name="nip"
                    defaultValue={editingPengawas?.nip || ''}
                    placeholder="19690104..."
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Ruang Tugas Pengawasan *</label>
                  <select
                    name="ruangTugas"
                    defaultValue={editingPengawas?.ruangTugas || 'Ruang 01'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58]"
                  >
                    {ruangOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Nomor HP</label>
                  <input
                    name="noHp"
                    defaultValue={editingPengawas?.noHp || ''}
                    placeholder="081234..."
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Hari &amp; Tanggal Tugas</label>
                <input
                  name="hariTanggal"
                  defaultValue={editingPengawas?.hariTanggal || 'Senin - Rabu, 18 - 20 Mei 2026'}
                  placeholder="Senin - Rabu, 18 - 20 Mei 2026"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Mata Pelajaran yang Diawasi</label>
                <input
                  name="mataPelajaran"
                  defaultValue={editingPengawas?.mataPelajaran || ''}
                  placeholder="Contoh: Pendidikan Agama, PPKn, Bahasa Indonesia"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalPengawasOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Pengawas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIVERSAL PRINT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {printDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#F1F4F2] rounded-2xl shadow-xl border border-[#D3DDD9] w-full max-w-[1060px] my-4 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 no-print">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#0B6B58]" />
                Pratinjau Cetak Dokumen Resmi Ujian
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Cetak Lembar Ini
                </button>
                <button
                  type="button"
                  onClick={() => setPrintDoc(null)}
                  className="p-2 text-gray-500 hover:text-gray-800 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINT CONTAINER WITH KOP HD */}
            <div className="overflow-x-auto bg-white p-8 rounded-xl border border-gray-300 shadow-sm print-sheet text-black font-serif">
              {/* COVER & PENGESAHAN POS */}
              {printDoc === 'pos_cover' && (
                <div className="space-y-8 p-4 text-center">
                  <KopSuratHD config={config} />

                  <div className="space-y-4 pt-6">
                    <div className="text-xl md:text-2xl font-bold tracking-wider uppercase underline">
                      PROSEDUR OPERASIONAL STANDAR (POS)
                    </div>
                    <div className="text-lg font-bold uppercase tracking-wide text-gray-900">
                      {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-base font-bold">
                      TAHUN PELAJARAN {posConfig.tahunPelajaran}
                    </div>
                    <div className="text-sm font-semibold text-gray-800">
                      SEKOLAH DASAR NEGERI 2 CEMPAKA
                    </div>
                  </div>

                  <div className="w-32 h-32 mx-auto my-8 border border-gray-300 flex items-center justify-center p-2 rounded-lg">
                    {config.logoSekolah || config.logoPemda ? (
                      <img
                        src={config.logoSekolah || config.logoPemda}
                        alt="Logo"
                        className="max-h-28 max-w-28 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-gray-400 font-sans">LOGO SEKOLAH</span>
                    )}
                  </div>

                  <div className="text-xs font-medium space-y-1 pt-4 text-left max-w-md mx-auto border-t border-b border-black py-4">
                    <div className="flex justify-between">
                      <span className="font-bold">Satuan Pendidikan</span>
                      <span>: {config.namaSekolah || 'SD Negeri 2 Cempaka'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">NPSN / NSS</span>
                      <span>: {config.npsn || '20215452'} / {config.nss || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Kecamatan / Kabupaten</span>
                      <span>: {config.kecamatan || 'Talun'} / {config.kabupaten || 'Cirebon'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">Ketua Panitia</span>
                      <span>: {posConfig.ketuaPanitia || '-'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between pt-12 text-xs text-left max-w-2xl mx-auto">
                    <div className="text-center w-56">
                      <div>Mengetahui,</div>
                      <div>Pengawas Pembina SD,</div>
                      <div className="h-20" />
                      <div className="font-bold underline">............................................</div>
                      <div>NIP. .......................................</div>
                    </div>

                    <div className="text-center w-56">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah,</div>
                      <div className="h-20" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* JADWAL UJIAN CETAK RESMI */}
              {printDoc === 'jadwal' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-5 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      JADWAL PELAKSANAAN {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      TAHUN PELAJARAN {posConfig.tahunPelajaran}
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-gray-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2 w-44">Hari &amp; Tanggal</th>
                        <th className="border border-black p-2 w-16">Jam Ke</th>
                        <th className="border border-black p-2 w-32">Waktu</th>
                        <th className="border border-black p-2">Mata Pelajaran</th>
                        <th className="border border-black p-2 w-28">Ruang</th>
                        <th className="border border-black p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jadwalList.map((j, idx) => (
                        <tr key={j.id}>
                          <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-black p-2 font-bold">{j.hariTanggal}</td>
                          <td className="border border-black p-2 text-center">{j.jamKe}</td>
                          <td className="border border-black p-2 font-mono whitespace-nowrap">{j.waktu}</td>
                          <td className="border border-black p-2 font-bold">{j.mataPelajaran}</td>
                          <td className="border border-black p-2 text-center">{j.ruangList?.join(', ')}</td>
                          <td className="border border-black p-2">{j.keterangan || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end pt-8 text-xs">
                    <div className="text-center w-64">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* DNT PESERTA CETAK RESMI */}
              {printDoc === 'peserta_dnt' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-5 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      DAFTAR NOMINASI PESERTA {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      TAHUN PELAJARAN {posConfig.tahunPelajaran} {selectedRuang !== 'Semua' && `\u2014 ${selectedRuang}`}
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-gray-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2 w-36">No. Peserta</th>
                        <th className="border border-black p-2">Nama Lengkap Siswa</th>
                        <th className="border border-black p-2 w-12">L/P</th>
                        <th className="border border-black p-2 w-28">NISN</th>
                        <th className="border border-black p-2 w-20">NIS</th>
                        <th className="border border-black p-2 w-20">Ruang</th>
                        <th className="border border-black p-2 w-16">Meja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeserta.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-black p-2 font-mono font-bold whitespace-nowrap">
                            {p.nomorPeserta}
                          </td>
                          <td className="border border-black p-2 font-bold">{p.nama}</td>
                          <td className="border border-black p-2 text-center">{p.jk}</td>
                          <td className="border border-black p-2 font-mono text-center">{p.nisn || '-'}</td>
                          <td className="border border-black p-2 font-mono text-center">{p.nis || '-'}</td>
                          <td className="border border-black p-2 text-center font-bold">{p.ruang}</td>
                          <td className="border border-black p-2 text-center font-bold font-mono">
                            {p.nomorMeja}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between pt-8 text-xs">
                    <div className="text-center w-56">
                      <div>Ketua Panitia Ujian,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{posConfig.ketuaPanitia || 'Risna Hidayat, S.Pd.'}</div>
                      <div>NIP. 198807152019031004</div>
                    </div>
                    <div className="text-center w-56">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* SK PANITIA CETAK RESMI */}
              {printDoc === 'panitia_sk' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-5 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      SUSUNAN PANITIA PELAKSANA {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      LAMPIRAN KEPUTUSAN KEPALA SEKOLAH NOMOR: {posConfig.noSkPanitia || '421.2/045/SD-02/V/2026'}
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-gray-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2 w-44">Jabatan Panitia</th>
                        <th className="border border-black p-2">Nama Lengkap &amp; NIP</th>
                        <th className="border border-black p-2 w-36">Jabatan di Sekolah</th>
                        <th className="border border-black p-2">Uraian Tugas Pokok</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panitiaList.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-black p-2 font-bold">{p.jabatanPanitia}</td>
                          <td className="border border-black p-2">
                            <div className="font-bold">{p.nama}</div>
                            <div className="font-mono text-[11px] text-gray-700">NIP. {p.nip || '-'}</div>
                          </td>
                          <td className="border border-black p-2">{p.jabatanSekolah || 'Guru'}</td>
                          <td className="border border-black p-2">{p.tugas || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end pt-8 text-xs">
                    <div className="text-center w-64">
                      <div>Ditetapkan di: {config.kabupaten || 'Cirebon'}</div>
                      <div>Pada tanggal: {posConfig.tglSkPanitia || '02 Mei 2026'}</div>
                      <div className="mt-1">Kepala Sekolah Dasar Negeri 2 Cempaka,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* REKAP PENGAWAS SILANG CETAK RESMI */}
              {printDoc === 'pengawas_rekap' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-5 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      DAFTAR PENGAWAS SILANG RUANG {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      TAHUN PELAJARAN {posConfig.tahunPelajaran}
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-gray-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2">Nama Pengawas</th>
                        <th className="border border-black p-2 w-36">NIP</th>
                        <th className="border border-black p-2">Asal Sekolah</th>
                        <th className="border border-black p-2 w-24">Ruang Tugas</th>
                        <th className="border border-black p-2 w-44">Jadwal / Sesi</th>
                        <th className="border border-black p-2 w-28">Tanda Tangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pengawasList.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                          <td className="border border-black p-2 font-bold">{p.nama}</td>
                          <td className="border border-black p-2 font-mono text-center">{p.nip || '-'}</td>
                          <td className="border border-black p-2">{p.asalSekolah}</td>
                          <td className="border border-black p-2 text-center font-bold">{p.ruangTugas}</td>
                          <td className="border border-black p-2">{p.hariTanggal || 'Semua Sesi'}</td>
                          <td className="border border-black p-2 text-center">
                            <div className="h-8 flex items-center justify-center font-mono text-gray-400">
                              {idx + 1}. .........
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between pt-8 text-xs">
                    <div className="text-center w-56">
                      <div>Koordinator Pengawas,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{posConfig.ketuaPanitia || 'Risna Hidayat, S.Pd.'}</div>
                      <div>NIP. 198807152019031004</div>
                    </div>
                    <div className="text-center w-56">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* DENAH DUDUK RUANG CETAK */}
              {printDoc === 'denah_duduk' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-4 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      DENAH DUDUK PESERTA &mdash; {printRuang.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      {posConfig.namaUjian.toUpperCase()} &middot; TP {posConfig.tahunPelajaran}
                    </div>
                  </div>

                  <div className="border-2 border-black p-4 rounded mb-4 text-center font-bold text-xs bg-gray-100 uppercase">
                    [ PAPAN TULIS &mdash; MEJA PENGAWAS RUANG ]
                  </div>

                  <div className="grid grid-cols-4 gap-3 my-6 text-center text-xs">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const mejaNo = i + 1;
                      const student = pesertaList.find(
                        (p) => p.ruang === printRuang && p.nomorMeja === mejaNo
                      );

                      return (
                        <div key={mejaNo} className="border-2 border-black p-2.5 rounded text-center">
                          <div className="font-bold underline text-xs">MEJA {mejaNo}</div>
                          {student ? (
                            <div className="pt-1 leading-tight">
                              <div className="font-bold text-[11px] truncate">{student.nama}</div>
                              <div className="font-mono text-[10px]">{student.nomorPeserta}</div>
                              <div className="text-[9px] text-gray-700">({student.jk === 'L' ? 'Laki-laki' : 'Perempuan'})</div>
                            </div>
                          ) : (
                            <div className="pt-2 text-gray-400 italic text-[10px]">Cadangan</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="border border-black p-2 text-center text-[11px] font-bold">
                    PINTU MASUK RUANGAN
                  </div>

                  <div className="flex justify-end pt-6 text-xs">
                    <div className="text-center w-64">
                      <div>Kepala Sekolah,</div>
                      <div className="h-14" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STIKER / KARTU NOMOR MEJA PESERTA */}
              {printDoc === 'nomor_meja' && (
                <div>
                  <div className="text-center pb-4 text-xs font-bold uppercase underline">
                    LABEL KARTU NOMOR MEJA PESERTA &mdash; {selectedRuang}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    {filteredPeserta.map((p) => (
                      <div
                        key={p.id}
                        className="border-2 border-black p-3.5 rounded-lg flex flex-col justify-between space-y-2 bg-white"
                      >
                        <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                          <span className="font-bold text-[11px] uppercase tracking-wide">
                            {config.namaSekolah || 'SDN 2 CEMPAKA'}
                          </span>
                          <span className="font-mono font-black text-sm px-2 py-0.5 bg-black text-white rounded">
                            MEJA {p.nomorMeja}
                          </span>
                        </div>

                        <div className="space-y-1 py-1">
                          <div className="text-[10px] text-gray-600 font-bold uppercase">Nama Peserta:</div>
                          <div className="text-sm font-bold text-black uppercase leading-tight">
                            {p.nama}
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                            <span>No: {p.nomorPeserta}</span>
                            <span>NISN: {p.nisn || '-'}</span>
                          </div>
                        </div>

                        <div className="border-t border-black pt-1 flex items-center justify-between text-[10px] text-gray-700 font-bold">
                          <span>{p.ruang}</span>
                          <span>{posConfig.namaUjian}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DENAH PHOTO (ALBUM FOTO PESERTA) */}
              {printDoc === 'denah_photo' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-4 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      ALBUM DENAH FOTO PESERTA UJIAN &mdash; {printRuang.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      {posConfig.namaUjian.toUpperCase()} &middot; TAHUN PELAJARAN {posConfig.tahunPelajaran}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {pesertaList
                      .filter((p) => p.ruang === printRuang)
                      .sort((a, b) => a.nomorMeja - b.nomorMeja)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="border border-black p-2 rounded flex gap-2 items-center leading-tight"
                        >
                          <div className="w-14 h-18 border border-black flex-none flex items-center justify-center text-[9px] text-gray-400 text-center p-1">
                            Foto 3x4
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold font-mono text-[11px]">MEJA {p.nomorMeja}</div>
                            <div className="font-bold text-xs truncate" title={p.nama}>
                              {p.nama}
                            </div>
                            <div className="font-mono text-[10px]">{p.nomorPeserta}</div>
                            <div className="text-[9px] text-gray-600">NISN: {p.nisn || '-'}</div>
                            <div className="mt-1 pt-1 border-t border-dashed border-gray-400 text-[9px]">
                              Paraf: ...............
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex justify-between pt-8 text-xs">
                    <div className="text-center w-56">
                      <div>Pengawas Ruang,</div>
                      <div className="h-16" />
                      <div>( ............................................ )</div>
                      <div>NIP. .......................................</div>
                    </div>
                    <div className="text-center w-56">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ID CARD PANITIA & PENGAWAS */}
              {printDoc === 'kartu_id' && (
                <div>
                  <div className="text-center pb-4 text-xs font-bold uppercase underline">
                    KARTU TANDA PENGENAL PANITIA &amp; PENGAWAS UJIAN SEKOLAH
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    {/* Combine Panitia & Pengawas based on filter */}
                    {panitiaList.map((p) => (
                      <div
                        key={`print_pan_${p.id}`}
                        className="border-2 border-black p-4 rounded-xl text-center space-y-2 bg-white flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-black">
                            KARTU TANDA PENGENAL
                          </div>
                          <div className="text-xs font-bold uppercase text-black">
                            PANITIA UJIAN SEKOLAH
                          </div>
                          <div className="text-[9px] text-gray-600">
                            {config.namaSekolah} &middot; TP {posConfig.tahunPelajaran}
                          </div>

                          <div className="w-16 h-20 border border-black mx-auto my-3 flex items-center justify-center text-[9px] text-gray-400">
                            Foto 3x4
                          </div>

                          <div className="text-xs font-bold text-black uppercase">{p.nama}</div>
                          <div className="text-[10px] font-mono text-gray-700">NIP. {p.nip || '-'}</div>

                          <div className="mt-2 py-0.5 px-2 font-bold text-xs border border-black rounded inline-block uppercase">
                            {p.jabatanPanitia}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-black text-[9px] flex justify-between items-center text-left">
                          <div>
                            <div>Kepala Sekolah,</div>
                            <div className="font-bold underline mt-4">{config.kepsek}</div>
                          </div>
                          <div className="w-9 h-9 border border-black flex items-center justify-center text-[7px]">
                            STEMPEL
                          </div>
                        </div>
                      </div>
                    ))}

                    {pengawasList.map((pg) => (
                      <div
                        key={`print_pgw_${pg.id}`}
                        className="border-2 border-black p-4 rounded-xl text-center space-y-2 bg-white flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-black">
                            KARTU TANDA PENGENAL
                          </div>
                          <div className="text-xs font-bold uppercase text-black">
                            PENGAWAS RUANG UJIAN
                          </div>
                          <div className="text-[9px] text-gray-600">
                            {config.namaSekolah} &middot; TP {posConfig.tahunPelajaran}
                          </div>

                          <div className="w-16 h-20 border border-black mx-auto my-3 flex items-center justify-center text-[9px] text-gray-400">
                            Foto 3x4
                          </div>

                          <div className="text-xs font-bold text-black uppercase">{pg.nama}</div>
                          <div className="text-[10px] font-mono text-gray-700">NIP. {pg.nip || '-'}</div>
                          <div className="text-[10px] text-gray-700">{pg.asalSekolah}</div>

                          <div className="mt-2 py-0.5 px-2 font-bold text-xs border border-black rounded inline-block uppercase">
                            PENGAWAS {pg.ruangTugas}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-black text-[9px] flex justify-between items-center text-left">
                          <div>
                            <div>Kepala Sekolah,</div>
                            <div className="font-bold underline mt-4">{config.kepsek}</div>
                          </div>
                          <div className="w-9 h-9 border border-black flex items-center justify-center text-[7px]">
                            STEMPEL
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RAMBU HARAP TENANG */}
              {printDoc === 'rambu_tenang' && (
                <div className="p-8 text-center border-8 border-red-600 rounded-2xl space-y-6 my-4 font-sans">
                  <div className="text-lg font-bold uppercase tracking-widest text-black">
                    {config.namaSekolah?.toUpperCase() || 'SD NEGERI 2 CEMPAKA'}
                  </div>

                  <div className="w-24 h-24 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto my-4 shadow-sm">
                    <VolumeX className="w-16 h-16" />
                  </div>

                  <div className="text-4xl md:text-5xl font-black text-red-600 tracking-wider uppercase font-display leading-tight">
                    HARAP TENANG !
                  </div>

                  <div className="text-2xl md:text-3xl font-black text-black uppercase tracking-wide">
                    SEDANG BERLANGSUNG UJIAN SEKOLAH
                  </div>

                  <div className="border-t-4 border-b-4 border-black py-4 max-w-xl mx-auto space-y-1 text-sm font-bold uppercase">
                    <div>DILARANG MEMBUAT KEGADUHAN</div>
                    <div>DILARANG BERLALU LALANG DI SEKITAR RUANG UJIAN</div>
                    <div>MOHON NONAKTIFKAN NADA DERING HANDPHONE</div>
                  </div>

                  <div className="text-xs text-gray-600 pt-4">
                    Panitia Pelaksana Ujian Sekolah &middot; Tahun Pelajaran {posConfig.tahunPelajaran}
                  </div>
                </div>
              )}

              {/* RAMBU BATAS SUCI */}
              {printDoc === 'rambu_batassuci' && (
                <div className="p-8 text-center border-8 border-amber-600 rounded-2xl space-y-6 my-4 font-sans">
                  <div className="text-lg font-bold uppercase tracking-widest text-black">
                    {config.namaSekolah?.toUpperCase() || 'SD NEGERI 2 CEMPAKA'}
                  </div>

                  <div className="w-24 h-24 rounded-full bg-amber-600 text-white flex items-center justify-center mx-auto my-4 shadow-sm">
                    <AlertTriangle className="w-16 h-16" />
                  </div>

                  <div className="text-4xl md:text-5xl font-black text-amber-700 tracking-wider uppercase font-display leading-tight">
                    BATAS SUCI AREA UJIAN
                  </div>

                  <div className="text-2xl md:text-3xl font-black text-black uppercase tracking-wide">
                    SELAIN PESERTA DAN PENGAWAS DILARANG MASUK
                  </div>

                  <div className="border-t-4 border-b-4 border-black py-4 max-w-xl mx-auto space-y-1 text-sm font-bold uppercase">
                    <div>AREA STERIL DAN TERTIB UJIAN SEKOLAH</div>
                    <div>ORANG TUA / PENGANTAR MOHON MENUNGGU DI LUAR AREA INI</div>
                  </div>

                  <div className="text-xs text-gray-600 pt-4">
                    Panitia Pelaksana Ujian Sekolah &middot; Tahun Pelajaran {posConfig.tahunPelajaran}
                  </div>
                </div>
              )}

              {/* TATA TERTIB PESERTA */}
              {printDoc === 'rambu_tatatertib_siswa' && (
                <div>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-4 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      TATA TERTIB PESERTA {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold">
                      TAHUN PELAJARAN {posConfig.tahunPelajaran}
                    </div>
                  </div>

                  <div className="p-6 border-2 border-black rounded-xl text-xs space-y-3 font-serif leading-relaxed">
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Peserta memasuki ruangan setelah tanda masuk dibunyikan, yakni 15 (lima belas) menit sebelum ujian dimulai.</li>
                      <li>Peserta yang terlambat hadir hanya diperkenankan mengikuti ujian setelah mendapat izin dari Ketua Panitia/Kepala Sekolah, tanpa penambahan waktu.</li>
                      <li>Peserta dilarang membawa alat komunikasi elektronik, kalkulator, tas, buku, dan catatan dalam bentuk apa pun ke dalam ruang ujian.</li>
                      <li>Tas, buku, dan catatan dikumpulkan di bagian depan ruang di dalam kelas atau di luar ruang ujian.</li>
                      <li>Peserta membawa alat tulis dan kartu tanda peserta ujian serta meletakkannya di atas meja sebelah kanan.</li>
                      <li>Peserta mengisi daftar hadir dengan menggunakan pulpen/pena yang disediakan pengawas.</li>
                      <li>Peserta mulai mengerjakan soal setelah ada tanda waktu mulai ujian dibunyikan pengawas.</li>
                      <li>Selama ujian berlangsung, peserta hanya dapat meninggalkan ruangan dengan izin dan pengawasan dari pengawas ruang.</li>
                      <li>Peserta yang telah selesai mengerjakan soal sebelum waktu ujian berakhir tidak diperkenankan meninggalkan ruangan sebelum waktu habis.</li>
                      <li>Peserta berhenti mengerjakan soal setelah ada tanda waktu ujian berakhir dan meletakkan lembar jawaban di atas meja masing-masing dengan rapi.</li>
                    </ol>
                  </div>

                  <div className="flex justify-end pt-8 text-xs">
                    <div className="text-center w-64">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* LABEL PINTU RUANGAN */}
              {printDoc === 'rambu_pintu' && (
                <div className="space-y-6">
                  {['RUANG 01', 'RUANG 02', 'RUANG SECRETARIAT PANITIA', 'RUANG PENGAWAS UJIAN'].map(
                    (room) => (
                      <div
                        key={room}
                        className="border-8 border-black p-8 rounded-2xl text-center space-y-3 font-sans my-4"
                      >
                        <div className="text-sm font-bold uppercase tracking-widest text-gray-700">
                          {config.namaSekolah || 'SD NEGERI 2 CEMPAKA'} &middot; UJIAN SEKOLAH TP {posConfig.tahunPelajaran}
                        </div>
                        <div className="text-4xl md:text-5xl font-black text-black tracking-widest uppercase font-display py-4">
                          {room}
                        </div>
                        <div className="text-xs font-semibold text-gray-500 uppercase">
                          HARAP MENJAGA KETERTIBAN DAN KEBERSIHAN RUANGAN
                        </div>
                      </div>
                    )
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
