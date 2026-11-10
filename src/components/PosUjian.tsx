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
  RambuUjianItem,
  SkemaDudukConfig,
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
  getPosUjianRambu,
  savePosUjianRambu,
  deletePosUjianRambu,
  swapPesertaMeja,
  setPesertaMeja,
  getGurus,
  getSiswas,
  EXAM_DAYS,
  generateJadwalPengawasOtomatis,
  recordActivity,
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
  Search,
  CheckSquare,
  ArrowLeftRight,
  Move,
  Sliders,
  BellOff,
  LayoutGrid,
  Shuffle,
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
  const [rambuList, setRambuList] = useState<RambuUjianItem[]>(getPosUjianRambu());
  const [allGurus, setAllGurus] = useState<Guru[]>(propGuruList || getGurus());
  const [allSiswas, setAllSiswas] = useState<Siswa[]>(propSiswaList || getSiswas());

  // Filter & Search states
  const [selectedRuang, setSelectedRuang] = useState<string>('Semua');
  const [searchPeserta, setSearchPeserta] = useState<string>('');
  const [searchRambu, setSearchRambu] = useState<string>('');
  const [filterRambuKategori, setFilterRambuKategori] = useState<string>('Semua');
  const [filterKartu, setFilterKartu] = useState<'semua' | 'panitia' | 'pengawas'>('semua');

  // Interactive Seating Scheme States
  const [isSwapMode, setIsSwapMode] = useState<boolean>(false);
  const [selectedMejaForSwap, setSelectedMejaForSwap] = useState<{
    id: string;
    meja: number;
    nama: string;
  } | null>(null);
  const [isModalSkemaOpen, setIsModalSkemaOpen] = useState(false);
  const [isModalAssignMejaOpen, setIsModalAssignMejaOpen] = useState(false);
  const [targetMejaToAssign, setTargetMejaToAssign] = useState<number | null>(null);

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
  const [isModalRambuOpen, setIsModalRambuOpen] = useState(false);
  const [editingRambu, setEditingRambu] = useState<RambuUjianItem | null>(null);

  // Print Preview Modal state
  const [printDoc, setPrintDoc] = useState<
    | null
    | 'pos_cover'
    | 'jadwal'
    | 'peserta_dnt'
    | 'panitia_sk'
    | 'pengawas_rekap'
    | 'daftar_hadir_panitia'
    | 'daftar_hadir_pengawas'
    | 'denah_duduk'
    | 'nomor_meja'
    | 'denah_photo'
    | 'kartu_id'
    | 'rambu_selected'
  >(null);
  const [selectedRambuToPrint, setSelectedRambuToPrint] = useState<RambuUjianItem | null>(null);
  const [printRuang, setPrintRuang] = useState<string>('Ruang 01');
  const [selectedHariHadir, setSelectedHariHadir] = useState<number>(1);
  const [printAllHari, setPrintAllHari] = useState<boolean>(false);

  const reloadAll = () => {
    setPosConfig(getPosUjianConfig());
    setJadwalList(getPosUjianJadwal());
    setPesertaList(getPosUjianPeserta());
    setPanitiaList(getPosUjianPanitia());
    setPengawasList(getPosUjianPengawas());
    setRambuList(getPosUjianRambu());
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

  // Active Seating Scheme config
  const skema: SkemaDudukConfig = posConfig.skemaDuduk || {
    format: 'ular',
    jumlahKolom: 4,
    kapasitasMeja: 20,
    labelMeja: 'MEJA',
  };

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

  // Filtered Rambu
  const filteredRambu = rambuList.filter((r) => {
    const term = searchRambu.toLowerCase().trim();
    const matchTerm =
      !term ||
      r.judul.toLowerCase().includes(term) ||
      r.subjudul.toLowerCase().includes(term) ||
      (r.pesanPoin && r.pesanPoin.some((p) => p.toLowerCase().includes(term)));
    const matchKat = filterRambuKategori === 'Semua' || r.kategori === filterRambuKategori;
    return matchTerm && matchKat;
  });

  const rambuKategoriList = Array.from(
    new Set(rambuList.map((r) => r.kategori || 'Umum').filter(Boolean))
  );

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

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

  // Jadwal Ujian (Kolom ruang dihapus sesuai permintaan)
  const handleSaveJadwal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const hariTanggal = String(form.get('hariTanggal') || '').trim();
    const tanggal = String(form.get('tanggal') || '').trim();
    const jamKe = Number(form.get('jamKe')) || 1;
    const waktu = String(form.get('waktu') || '').trim();
    const mataPelajaran = String(form.get('mataPelajaran') || '').trim();
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

  // Generate Peserta
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
    const res = generatePesertaFromSiswa(
      tingkat,
      skema.kapasitasMeja || posConfig.kapasitasPerRuang || 20,
      posConfig.kodeSekolah || '02-12-01'
    );
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

  // Panitia Ujian
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

  // Pengawas Silang
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

  const handleShufflePengawas = () => {
    const fresh = generateJadwalPengawasOtomatis(true);
    setPengawasList(fresh);
    onToast('Rotasi 12 guru pengawas sekolah berhasil diacak seimbang untuk 3 ruang selama 6 hari!');
  };

  // Rambu-Rambu Ujian (Bisa diedit dan ditambah)
  const handleSaveRambu = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const judul = String(form.get('judul') || '').trim().toUpperCase();
    const subjudul = String(form.get('subjudul') || '').trim().toUpperCase();
    const pesanRaw = String(form.get('pesanPoin') || '').trim();
    const keteranganTambahan = String(form.get('keteranganTambahan') || '').trim();
    const warnaTema = (form.get('warnaTema') as any) || 'merah';
    const ikon = (form.get('ikon') as any) || 'VolumeX';
    const catatanKaki = String(form.get('catatanKaki') || '').trim();
    const kategori = String(form.get('kategori') || 'Peringatan').trim();

    if (!judul || !subjudul) {
      onToast('Judul dan Subjudul rambu wajib diisi.', true);
      return;
    }

    const pesanPoin = pesanRaw
      ? pesanRaw
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const item: RambuUjianItem = {
      id: editingRambu ? editingRambu.id : `rmb_${Date.now()}`,
      judul,
      subjudul,
      pesanPoin,
      keteranganTambahan: keteranganTambahan || undefined,
      warnaTema,
      ikon,
      catatanKaki: catatanKaki || undefined,
      kategori: kategori || undefined,
      createdAt: editingRambu?.createdAt || Date.now(),
    };

    savePosUjianRambu(item);
    reloadAll();
    setIsModalRambuOpen(false);
    setEditingRambu(null);
    onToast(`Rambu "${judul}" berhasil disimpan.`);
  };

  const handleDeleteRambu = (id: string, judul: string) => {
    if (!window.confirm(`Hapus rambu "${judul}"?`)) return;
    deletePosUjianRambu(id);
    reloadAll();
    onToast(`Rambu "${judul}" telah dihapus.`);
  };

  // Skema Duduk Configuration & Interactivity
  const handleSaveSkemaDuduk = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const format = (form.get('format') as any) || 'ular';
    const jumlahKolom = Number(form.get('jumlahKolom')) || 4;
    const kapasitasMeja = Number(form.get('kapasitasMeja')) || 20;
    const labelMeja = String(form.get('labelMeja') || 'MEJA').trim();

    const updatedSkema: SkemaDudukConfig = {
      format,
      jumlahKolom,
      kapasitasMeja,
      labelMeja,
    };

    const newCfg: PosUjianConfig = {
      ...posConfig,
      kapasitasPerRuang: kapasitasMeja,
      skemaDuduk: updatedSkema,
    };

    savePosUjianConfig(newCfg);
    setPosConfig(newCfg);
    setIsModalSkemaOpen(false);
    onToast(`Skema duduk berhasil diubah: ${format.toUpperCase()} (${jumlahKolom} Kolom, ${kapasitasMeja} Meja).`);
  };

  const handleDeskClick = (mejaNo: number, student: PesertaUjian | undefined) => {
    if (isSwapMode) {
      if (!selectedMejaForSwap) {
        if (!student) {
          onToast('Pilih meja yang ada siswanya terlebih dahulu untuk dipindahkan/ditukar.', true);
          return;
        }
        setSelectedMejaForSwap({
          id: student.id,
          meja: mejaNo,
          nama: student.nama,
        });
        onToast(`Meja ${mejaNo} (${student.nama}) dipilih. Sekarang klik meja tujuan!`);
      } else {
        if (selectedMejaForSwap.meja === mejaNo) {
          setSelectedMejaForSwap(null);
          onToast('Pemilihan meja dibatalkan.');
          return;
        }
        if (student) {
          // Tukar dua siswa
          swapPesertaMeja(selectedMejaForSwap.id, student.id);
          reloadAll();
          onToast(`Berhasil menukar posisi: ${selectedMejaForSwap.nama} (Meja ${mejaNo}) <-> ${student.nama} (Meja ${selectedMejaForSwap.meja}).`);
        } else {
          // Pindahkan siswa ke meja kosong
          setPesertaMeja(selectedMejaForSwap.id, mejaNo);
          reloadAll();
          onToast(`Berhasil memindahkan ${selectedMejaForSwap.nama} ke Meja ${mejaNo}.`);
        }
        setSelectedMejaForSwap(null);
      }
    } else {
      // Normal mode: buka dialog pilih/assign siswa ke meja ini
      setTargetMejaToAssign(mejaNo);
      setIsModalAssignMejaOpen(true);
    }
  };

  const handleAssignStudentToTargetMeja = (pesertaId: string) => {
    if (!targetMejaToAssign) return;
    setPesertaMeja(pesertaId, targetMejaToAssign);
    reloadAll();
    setIsModalAssignMejaOpen(false);
    setTargetMejaToAssign(null);
    onToast(`Siswa berhasil ditempatkan di Meja ${targetMejaToAssign}.`);
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

  // Helper render ikon rambu
  const renderRambuIcon = (ikon: string, className = 'w-6 h-6') => {
    switch (ikon) {
      case 'AlertTriangle':
        return <AlertTriangle className={className} />;
      case 'FileText':
        return <FileText className={className} />;
      case 'School':
        return <School className={className} />;
      case 'ShieldAlert':
        return <ShieldAlert className={className} />;
      case 'BellOff':
        return <BellOff className={className} />;
      case 'VolumeX':
      default:
        return <VolumeX className={className} />;
    }
  };

  // Helper kelas warna tema rambu
  const getRambuColorStyles = (warna: string) => {
    switch (warna) {
      case 'merah':
        return {
          border: 'border-red-600',
          bgSoft: 'bg-red-50',
          bgBorder: 'border-red-200',
          textAccent: 'text-red-600',
          badge: 'bg-red-600 text-white',
          btn: 'bg-red-600 hover:bg-red-700 text-white',
        };
      case 'amber':
        return {
          border: 'border-amber-600',
          bgSoft: 'bg-amber-50',
          bgBorder: 'border-amber-200',
          textAccent: 'text-amber-700',
          badge: 'bg-amber-600 text-white',
          btn: 'bg-amber-600 hover:bg-amber-700 text-white',
        };
      case 'biru':
        return {
          border: 'border-blue-600',
          bgSoft: 'bg-blue-50',
          bgBorder: 'border-blue-200',
          textAccent: 'text-blue-700',
          badge: 'bg-blue-600 text-white',
          btn: 'bg-blue-600 hover:bg-blue-700 text-white',
        };
      case 'hitam':
        return {
          border: 'border-gray-900',
          bgSoft: 'bg-gray-50',
          bgBorder: 'border-gray-300',
          textAccent: 'text-gray-900',
          badge: 'bg-gray-900 text-white',
          btn: 'bg-gray-900 hover:bg-black text-white',
        };
      case 'hijau':
      default:
        return {
          border: 'border-[#0B6B58]',
          bgSoft: 'bg-[#F4FAF8]',
          bgBorder: 'border-[#B8D7CD]',
          textAccent: 'text-[#0B6B58]',
          badge: 'bg-[#0B6B58] text-white',
          btn: 'bg-[#0B6B58] hover:bg-[#095747] text-white',
        };
    }
  };

  // Jumlah grid kolom CSS dinamis untuk Denah Meja di layar
  const getGridColsClass = (cols: number) => {
    switch (cols) {
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2 sm:grid-cols-3';
      case 5:
        return 'grid-cols-2 sm:grid-cols-5';
      case 4:
      default:
        return 'grid-cols-2 sm:grid-cols-4';
    }
  };

  // Jumlah grid kolom CSS tetap untuk Denah Meja saat dicetak di kertas A4
  const getPrintGridColsClass = (cols: number) => {
    switch (cols) {
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-3';
      case 5:
        return 'grid-cols-5';
      case 4:
      default:
        return 'grid-cols-4';
    }
  };

  // Menentukan nomor meja awal berdasarkan nama ruang (Ruang 1 = 1, Ruang 2 = 21, Ruang 3 = 41...)
  const getRoomStartMeja = (ruangName: string, kapasitas: number = 20): number => {
    const match = ruangName ? ruangName.match(/\d+/) : null;
    if (match) {
      const rNum = parseInt(match[0], 10);
      if (rNum >= 1) {
        return (rNum - 1) * kapasitas + 1;
      }
    }
    return 1;
  };

  // Susunan nomor meja berdasarkan formasi (Pola Ular / Snake: angka 5 tepat di bawah 4)
  const getOrderedMejaList = (
    format: string,
    cols: number,
    total: number,
    startMeja: number = 1
  ): number[] => {
    const cCount = Math.max(2, Math.min(5, cols || 4));
    const tCount = total || 20;
    const rows = Math.ceil(tCount / cCount);
    const result: number[] = [];

    if (format === 'ular') {
      // Pola Ular (Snake / Boustrophedon):
      // Misal startMeja = 21, cCount = 4
      // Baris 0 (genap, kiri ke kanan): 21, 22, 23, 24
      // Baris 1 (ganjil, kanan ke kiri): 28, 27, 26, 25 -> Meja 25 tepat di bawah 24!
      // Baris 2 (genap, kiri ke kanan): 29, 30, 31, 32 -> Meja 29 tepat di bawah 28!
      // Baris 3 (ganjil, kanan ke kiri): 36, 35, 34, 33 -> Meja 33 tepat di bawah 32!
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cCount; c++) {
          let step: number;
          if (r % 2 === 0) {
            step = r * cCount + c;
          } else {
            step = r * cCount + (cCount - 1 - c);
          }
          if (step < tCount) {
            result.push(startMeja + step);
          } else {
            result.push(0);
          }
        }
      }
      return result;
    }

    if (format === 'zigzag') {
      // Zigzag vertikal per kolom:
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cCount; c++) {
          let step: number;
          if (c % 2 === 0) {
            step = c * rows + r;
          } else {
            step = c * rows + (rows - 1 - r);
          }
          if (step < tCount) {
            result.push(startMeja + step);
          } else {
            result.push(0);
          }
        }
      }
      return result;
    }

    // Default 'grid' (1, 2, 3, 4, 5... berurutan dari startMeja)
    for (let i = 0; i < tCount; i++) {
      result.push(startMeja + i);
    }
    return result;
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-[#D3DDD9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B6B58] uppercase tracking-wider">
            <School className="w-4 h-4" />
            <span>Administrasi Asesmen &amp; Ujian</span>
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
          { id: 'rambu', label: `Rambu-Rambu (${rambuList.length})`, icon: VolumeX },
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
                  desc: 'Tabel pelaksanaan mata pelajaran, alokasi jam/waktu, dan tanda tangan kepsek (tanpa kolom ruang).',
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
                  title: 'Jadwal & Rotasi Pengawas Ruang (Landscape)',
                  desc: 'Tabel matriks rotasi 12 guru sekolah sendiri di 3 ruang ujian selama 6 hari (format landscape, tanpa kolom ttd).',
                  icon: ShieldAlert,
                  badge: 'Landscape',
                },
                {
                  id: 'daftar_hadir_panitia',
                  title: 'Daftar Hadir Panitia Ujian (Harian)',
                  desc: 'Format lembar absensi panitia pelaksana ujian sekolah untuk 6 hari pelaksanaan.',
                  icon: UserCheck,
                  badge: 'Absensi Panitia',
                },
                {
                  id: 'daftar_hadir_pengawas',
                  title: 'Daftar Hadir Pengawas Ruang (Harian)',
                  desc: 'Format lembar absensi harian pengawas ruang ujian sekolah (6 pengawas/hari x 6 hari).',
                  icon: Users,
                  badge: 'Absensi Pengawas',
                },
                {
                  id: 'denah_duduk',
                  title: 'Denah Duduk Peserta Ruang Ujian',
                  desc: 'Diagram tata letak meja peserta dapat diatur skema formasi dan jumlah kolomnya.',
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
                  desc: 'Tanda pengenal resmi panitia & pengawas (tanpa ttd kepsek & tanpa nomor ruang pengawas).',
                  icon: IdCard,
                  badge: 'ID Card',
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

      {/* TAB 2: JADWAL UJIAN SEKOLAH (KOLOM RUANG DIHAPUS) */}
      {activeTab === 'jadwal' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#13262A] font-display">
                Jadwal Ujian Sekolah / Asesmen Sumatif Akhir Jenjang
              </h3>
              <p className="text-xs text-[#566A6E]">
                Mata pelajaran, alokasi jam/waktu, dan tanggal pelaksanaan (format dinas tanpa kolom ruang).
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
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-52">Hari &amp; Tanggal</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-20 text-center">Sesi</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-40">Waktu Pelaksanaan</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Mata Pelajaran Diujikan</th>
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
                onClick={() => {
                  setSelectedHariHadir(1);
                  setPrintAllHari(false);
                  setPrintDoc('daftar_hadir_panitia');
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak Daftar Hadir Panitia
              </button>
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

      {/* TAB 5: PENGAWAS RUANG UJIAN (ROTASI 12 GURU SDN 2 CEMPAKA DI 3 RUANG X 6 HARI) */}
      {activeTab === 'pengawas' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-[#13262A] font-display flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#0B6B58]" />
                Jadwal &amp; Rotasi Pengawas Ruang Ujian (12 Guru Sekolah)
              </h3>
              <p className="text-xs text-[#566A6E]">
                Jadwal rotasi 12 guru SDN 2 Cempaka di 3 ruang ujian selama 6 hari pelaksanaan (masing-masing 3 sesi mengawas seimbang).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isOperator && (
                <button
                  type="button"
                  onClick={handleShufflePengawas}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#E6F2EE] hover:bg-[#B8D7CD] text-[#0B6B58] rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-[#B8D7CD]"
                  title="Acak ulang rotasi 12 guru di 3 ruang"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Acak Rotasi Guru
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedHariHadir(1);
                  setPrintAllHari(false);
                  setPrintDoc('daftar_hadir_pengawas');
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak Daftar Hadir Pengawas
              </button>
              <button
                type="button"
                onClick={() => setPrintDoc('pengawas_rekap')}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Jadwal Pengawas (Landscape)
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-3 border-b border-[#D3DDD9] w-10 text-center">No</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-48">Hari &amp; Tanggal</th>
                    <th className="py-2.5 px-3 border-b border-[#D3DDD9] w-36 text-center">Waktu</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Mata Pelajaran</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] bg-emerald-50/50">Ruang 01</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] bg-sky-50/50">Ruang 02</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] bg-amber-50/50">Ruang 03</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {EXAM_DAYS.map((day, idx) => {
                    const r1 = pengawasList.filter(
                      (p) =>
                        (p.hariKe === day.hariKe || p.hariTanggal === day.hariTanggal) &&
                        p.ruangTugas === 'Ruang 01'
                    );
                    const r2 = pengawasList.filter(
                      (p) =>
                        (p.hariKe === day.hariKe || p.hariTanggal === day.hariTanggal) &&
                        p.ruangTugas === 'Ruang 02'
                    );
                    const r3 = pengawasList.filter(
                      (p) =>
                        (p.hariKe === day.hariKe || p.hariTanggal === day.hariTanggal) &&
                        p.ruangTugas === 'Ruang 03'
                    );
                    return (
                      <tr key={day.hariKe} className="hover:bg-gray-50/80">
                        <td className="py-3 px-3 text-center font-mono font-bold text-[#566A6E]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#13262A] whitespace-nowrap">
                          {day.hariTanggal}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium text-[#13262A] whitespace-nowrap">
                          {day.sesi}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#13262A]">
                          {day.mataPelajaran}
                        </td>
                        <td className="py-3 px-4 bg-emerald-50/30">
                          <div className="space-y-1">
                            {r1.map((p, pIdx) => (
                              <div key={p.id || pIdx} className="font-bold text-[#13262A] flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-[#E6F2EE] text-[#0B6B58] text-[10px] flex items-center justify-center font-mono font-bold flex-none">
                                  {pIdx + 1}
                                </span>
                                <span className="truncate">{p.nama}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-sky-50/30">
                          <div className="space-y-1">
                            {r2.map((p, pIdx) => (
                              <div key={p.id || pIdx} className="font-bold text-[#13262A] flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-800 text-[10px] flex items-center justify-center font-mono font-bold flex-none">
                                  {pIdx + 1}
                                </span>
                                <span className="truncate">{p.nama}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 bg-amber-50/30">
                          <div className="space-y-1">
                            {r3.map((p, pIdx) => (
                              <div key={p.id || pIdx} className="font-bold text-[#13262A] flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] flex items-center justify-center font-mono font-bold flex-none">
                                  {pIdx + 1}
                                </span>
                                <span className="truncate">{p.nama}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* REKAP PENUGASAN 12 GURU */}
          <div className="bg-[#F8FBFA] p-3.5 rounded-xl border border-[#D3DDD9] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#13262A] font-display">
                Rekap Beban Tugas Pengawas (12 Guru SDN 2 Cempaka)
              </span>
              <span className="text-[11px] text-[#0B6B58] font-bold">
                Total 36 Slot Tugas &middot; Masing-masing Guru 3 Kali Mengawas
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              {Array.from(new Set(pengawasList.map((p) => p.nama))).map((nama, idx) => {
                const count = pengawasList.filter((p) => p.nama === nama).length;
                return (
                  <div
                    key={nama || idx}
                    className="p-2 rounded-lg bg-white border border-[#E6EDEA] flex items-center justify-between shadow-2xs"
                  >
                    <div className="truncate font-semibold text-[#13262A] text-[11px]" title={nama}>
                      {nama}
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E6F2EE] text-[#0B6B58] flex-none ml-1">
                      {count}x
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DENAH DUDUK UJIAN (SKEMA BISA DIUBAH) */}
      {activeTab === 'denahduduk' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#566A6E]">Pilih Ruang:</span>
              <div className="flex items-center gap-1">
                {ruangOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setPrintRuang(r);
                      setSelectedMejaForSwap(null);
                    }}
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

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Atur Skema Formasi */}
              {isOperator && (
                <button
                  type="button"
                  onClick={() => setIsModalSkemaOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  title="Ubah pola susunan meja, jumlah kolom, dan kapasitas"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#0B6B58]" />
                  Ubah Skema Formasi ({skema.jumlahKolom} Kolom &middot; {skema.format})
                </button>
              )}

              {/* Mode Tukar / Pindah Meja */}
              <button
                type="button"
                onClick={() => {
                  setIsSwapMode(!isSwapMode);
                  setSelectedMejaForSwap(null);
                  onToast(
                    !isSwapMode
                      ? 'Mode Tukar/Pindah Meja aktif. Klik meja awal lalu klik meja tujuan.'
                      : 'Mode Tukar Meja dimatikan.'
                  );
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  isSwapMode
                    ? 'bg-amber-600 text-white shadow-xs animate-pulse'
                    : 'bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A]'
                }`}
                title="Aktifkan klik dua meja untuk bertukar posisi duduk"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {isSwapMode ? 'Mode Tukar Aktif' : 'Tukar / Geser Meja'}
              </button>

              <button
                type="button"
                onClick={() => setPrintDoc('nomor_meja')}
                className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0B6B58]" />
                Cetak Stiker Meja
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

          {/* Banner Peringatan Mode Tukar */}
          {isSwapMode && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Mode Penyesuaian Meja Aktif:</strong>{' '}
                  {selectedMejaForSwap
                    ? `Meja ${selectedMejaForSwap.meja} (${selectedMejaForSwap.nama}) dipilih. Klik meja tujuan untuk menukar atau memindahkannya.`
                    : 'Klik salah satu meja siswa untuk memulai penukaran atau pergeseran posisi.'}
                </span>
              </div>
              {selectedMejaForSwap && (
                <button
                  type="button"
                  onClick={() => setSelectedMejaForSwap(null)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-amber-200 hover:bg-amber-300 rounded cursor-pointer"
                >
                  Batal Pilih
                </button>
              )}
            </div>
          )}

          {/* Interactive Seating Layout Visualizer */}
          <div className="bg-white p-6 rounded-2xl border border-[#D3DDD9] shadow-xs space-y-6">
            <div className="text-center pb-2 border-b border-[#E6EDEA]">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#E6F2EE] text-[#0B6B58] mb-1">
                <LayoutGrid className="w-3.5 h-3.5" />
                Skema:{' '}
                {skema.format === 'ular'
                  ? 'Pola Ular (5 di Bawah 4)'
                  : skema.format === 'zigzag'
                  ? 'Zig-Zag Vertikal'
                  : skema.format.toUpperCase()}{' '}
                &middot; {skema.jumlahKolom} Kolom &middot; Kapasitas {skema.kapasitasMeja} Meja
              </div>
              <h3 className="text-base font-bold text-[#13262A] font-display">
                Denah Duduk Peserta {posConfig.namaUjian} &mdash; {printRuang.toUpperCase()}
              </h3>
              <p className="text-xs text-[#566A6E]">
                Klik pada meja untuk mengatur/menukar peserta secara langsung atau menyesuaikan skema formasi.
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

            {/* Dynamic Student Desks Grid */}
            <div className="max-w-5xl mx-auto pt-4">
              {(() => {
                const roomStartMeja = getRoomStartMeja(printRuang, skema.kapasitasMeja || 20);
                const roomStudents = pesertaList.filter((p) => p.ruang === printRuang);
                const maxStudentMeja = roomStudents.length > 0
                  ? Math.max(...roomStudents.map((p) => p.nomorMeja))
                  : roomStartMeja + (skema.kapasitasMeja || 20) - 1;
                const neededCount = Math.max(1, maxStudentMeja - roomStartMeja + 1);
                const cCount = Math.max(2, Math.min(5, skema.jumlahKolom || 4));
                const fullRows = Math.ceil(neededCount / cCount);
                const roomTotalCells = Math.min(
                  skema.kapasitasMeja || 20,
                  Math.max(cCount, fullRows * cCount)
                );

                return (
                  <div className={`grid gap-3 ${getGridColsClass(skema.jumlahKolom || 4)}`}>
                    {getOrderedMejaList(
                      skema.format,
                      skema.jumlahKolom || 4,
                      roomTotalCells,
                      roomStartMeja
                    ).map((mejaNo, idx) => {
                      if (mejaNo === 0) {
                        return <div key={`empty-cell-${idx}`} className="p-3 opacity-0 select-none pointer-events-none" />;
                      }
                      const student = pesertaList.find(
                        (p) => p.ruang === printRuang && p.nomorMeja === mejaNo
                      );
                      const isSelected = selectedMejaForSwap?.meja === mejaNo;

                      // Meja yang tidak ada pesertanya dihilangkan jika bukan dalam mode tukar
                      if (!student && !isSwapMode) {
                        return <div key={`empty-desk-${mejaNo}`} className="invisible p-3 select-none pointer-events-none" />;
                      }

                      return (
                        <div
                          key={mejaNo}
                          onClick={() => handleDeskClick(mejaNo, student)}
                          className={`p-3 rounded-xl border text-center transition cursor-pointer select-none ${
                            isSelected
                              ? 'border-2 border-amber-500 bg-amber-50 scale-102 shadow-md'
                              : student
                              ? 'border-[#0B6B58]/40 bg-[#FAFDFC] hover:border-[#0B6B58] hover:shadow-sm'
                              : 'border-dashed border-gray-300 bg-gray-50/60 hover:border-gray-400'
                          }`}
                          title={
                            isSwapMode
                              ? isSelected
                                ? 'Klik meja lain untuk bertukar'
                                : 'Klik untuk menukar'
                              : 'Klik untuk ubah peserta di meja ini'
                          }
                        >
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-100">
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#E6F2EE] text-[#0B6B58]'
                          }`}
                        >
                          {skema.labelMeja || 'MEJA'} {String(mejaNo).padStart(2, '0')}
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
                        <div className="py-2 text-[11px] text-gray-400 italic flex items-center justify-center gap-1">
                          <Plus className="w-3 h-3" />
                          <span>Kosong</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

            <div className="text-center pt-3 text-xs text-[#566A6E] border-t border-[#E6EDEA] flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Pintu Masuk Ruangan &middot; Denah ini dapat dicetak dan ditempel di pintu luar ruang ujian.
              </span>
              <button
                type="button"
                onClick={() => setIsModalSkemaOpen(true)}
                className="text-xs font-bold text-[#0B6B58] hover:underline cursor-pointer"
              >
                Ubah Skema Formasi Meja &rarr;
              </button>
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
              {(() => {
                const roomStartMeja = getRoomStartMeja(printRuang, skema.kapasitasMeja || 20);
                const roomStudents = pesertaList.filter((p) => p.ruang === printRuang);
                const maxStudentMeja = roomStudents.length > 0
                  ? Math.max(...roomStudents.map((p) => p.nomorMeja))
                  : roomStartMeja + (skema.kapasitasMeja || 20) - 1;
                const neededCount = Math.max(1, maxStudentMeja - roomStartMeja + 1);
                const cCount = Math.max(2, Math.min(5, skema.jumlahKolom || 4));
                const fullRows = Math.ceil(neededCount / cCount);
                const roomTotalCells = Math.min(
                  skema.kapasitasMeja || 20,
                  Math.max(cCount, fullRows * cCount)
                );

                return getOrderedMejaList(
                  skema.format,
                  skema.jumlahKolom || 4,
                  roomTotalCells,
                  roomStartMeja
                ).map((mejaNo) => {
                  if (mejaNo === 0) return null;
                  const p = pesertaList.find(
                    (s) => s.ruang === printRuang && s.nomorMeja === mejaNo
                  );
                  if (!p) return null; // Meja tanpa peserta dihilangkan

                  return (
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
                            {skema.labelMeja || 'Meja'} {String(p.nomorMeja).padStart(2, '0')}
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
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: KARTU PANITIA DAN PENGAWAS (TANPA TTD KEPSEK & TANPA NO RUANG PENGAWAS) */}
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

          {/* Cards Grid Preview (Clean & Sesuai Permintaan) */}
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

                  {/* Clean bottom tanpa ttd kepsek */}
                  <div className="pt-3 border-t border-gray-200 mt-3 flex items-center justify-between text-[8px] text-[#566A6E]">
                    <span className="font-semibold text-gray-700">Tanda Pengenal Resmi</span>
                    <span className="font-mono text-gray-400">POS-US/2026</span>
                  </div>
                </div>
              ))}

            {/* Pengawas Cards (Tanpa ttd kepsek & tanpa nomor ruang) */}
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

                    {/* Badge Pengawas tanpa nomor ruang */}
                    <div className="mt-2.5 py-1 px-2 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold uppercase tracking-wide">
                      PENGAWAS RUANG
                    </div>
                  </div>

                  {/* Clean bottom tanpa ttd kepsek */}
                  <div className="pt-3 border-t border-gray-200 mt-3 flex items-center justify-between text-[8px] text-[#566A6E]">
                    <span className="font-semibold text-gray-700">Tanda Pengenal Resmi</span>
                    <span className="font-mono text-gray-400">POS-US/2026</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 9: RAMBU-RAMBU & TATA TERTIB UJIAN (BISA DIEDIT & DITAMBAH) */}
      {activeTab === 'rambu' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-[#566A6E] absolute left-3 top-2.5" />
                <input
                  type="search"
                  value={searchRambu}
                  onChange={(e) => setSearchRambu(e.target.value)}
                  placeholder="Cari rambu peringatan, tata tertib, label..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
                />
              </div>

              <select
                value={filterRambuKategori}
                onChange={(e) => setFilterRambuKategori(e.target.value)}
                className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-medium"
              >
                <option value="Semua">Semua Kategori</option>
                {rambuKategoriList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {isOperator && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRambu(null);
                    setIsModalRambuOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Rambu Baru
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Rambu Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRambu.map((r) => {
              const styles = getRambuColorStyles(r.warnaTema);
              return (
                <div
                  key={r.id}
                  className={`bg-white p-5 rounded-2xl border-2 ${styles.border} shadow-xs space-y-4 flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${styles.badge} uppercase`}>
                        {r.kategori || 'Rambu Ujian'}
                      </span>
                      {isOperator && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRambu(r);
                              setIsModalRambuOpen(true);
                            }}
                            className="p-1 text-[#566A6E] hover:text-[#0B6B58] rounded cursor-pointer"
                            title="Ubah Rambu"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRambu(r.id, r.judul)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Hapus Rambu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={`${styles.bgSoft} border ${styles.bgBorder} rounded-xl p-5 text-center space-y-2`}>
                      <div className={`w-12 h-12 rounded-full ${styles.badge} flex items-center justify-center mx-auto shadow-sm`}>
                        {renderRambuIcon(r.ikon, 'w-6 h-6')}
                      </div>
                      <div className={`text-lg md:text-xl font-black ${styles.textAccent} tracking-wider uppercase font-display pt-1`}>
                        {r.judul}
                      </div>
                      <div className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                        {r.subjudul}
                      </div>
                      {r.pesanPoin && r.pesanPoin.length > 0 && (
                        <div className="pt-2 text-left max-w-sm mx-auto text-xs text-gray-700 space-y-1">
                          {r.pesanPoin.map((p, pIdx) => (
                            <div key={pIdx} className="flex items-start gap-1.5">
                              <span className="font-bold text-gray-400">&bull;</span>
                              <span className="leading-tight">{p}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.keteranganTambahan && (
                        <p className="text-[11px] text-gray-500 italic pt-1">{r.keteranganTambahan}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-[#566A6E] truncate max-w-[200px]">
                      {r.catatanKaki || 'Panitia Ujian Sekolah'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRambuToPrint(r);
                        setPrintDoc('rambu_selected');
                      }}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer ${styles.btn}`}
                    >
                      <Printer className="w-3.5 h-3.5" /> Cetak Rambu Ini
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PENGATURAN SKEMA DUDUK FORMATION */}
      {/* ========================================================================= */}
      {isModalSkemaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-md w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#0B6B58]" />
                Ubah Skema Formasi Duduk Siswa
              </h3>
              <button
                type="button"
                onClick={() => setIsModalSkemaOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSkemaDuduk} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Pola Susunan Formasi Meja *</label>
                <select
                  name="format"
                  defaultValue={skema.format}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58]"
                >
                  <option value="ular">Pola Ular (Snake): Meja 5 tepat di bawah 4 (Rekomendasi Utama Ujian)</option>
                  <option value="zigzag">Format Zig-Zag Vertikal per Kolom (Turun - Naik)</option>
                  <option value="grid">Format Berurutan Kiri ke Kanan per Baris (1, 2, 3, 4 / 5, 6, 7, 8)</option>
                  <option value="u_shape">Format Melingkar / Huruf U</option>
                  <option value="baris_ganda">Format Dua Kelompok Baris Ganda</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Format akan langsung diterapkan pada tampilan denah dan hasil cetak denah ruang ujian.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jumlah Kolom Meja</label>
                  <select
                    name="jumlahKolom"
                    defaultValue={skema.jumlahKolom || 4}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                  >
                    <option value={2}>2 Kolom</option>
                    <option value={3}>3 Kolom</option>
                    <option value={4}>4 Kolom (Standar)</option>
                    <option value={5}>5 Kolom</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kapasitas Meja per Ruang</label>
                  <select
                    name="kapasitasMeja"
                    defaultValue={skema.kapasitasMeja || 20}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold"
                  >
                    <option value={10}>10 Meja</option>
                    <option value={16}>16 Meja</option>
                    <option value={20}>20 Meja (Standar Dinas)</option>
                    <option value={24}>24 Meja</option>
                    <option value={28}>28 Meja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Label Awalan Meja</label>
                <input
                  name="labelMeja"
                  defaultValue={skema.labelMeja || 'MEJA'}
                  placeholder="MEJA atau NO"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalSkemaOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Terapkan Skema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN / PINDAH SISWA KE MEJA SPESIFIK */}
      {/* ========================================================================= */}
      {isModalAssignMejaOpen && targetMejaToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-md w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Move className="w-5 h-5 text-[#0B6B58]" />
                Atur Siswa untuk Meja {targetMejaToAssign} ({printRuang})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalAssignMejaOpen(false);
                  setTargetMejaToAssign(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#566A6E]">
                Pilih peserta yang ingin ditempatkan di <strong>Meja {targetMejaToAssign}</strong>:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-[#D3DDD9] rounded-xl p-2">
                {pesertaList
                  .filter((p) => p.ruang === printRuang)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAssignStudentToTargetMeja(p.id)}
                      className={`w-full p-2 rounded-lg text-left transition flex items-center justify-between cursor-pointer ${
                        p.nomorMeja === targetMejaToAssign
                          ? 'bg-[#DAEEE7] text-[#0B6B58] font-bold'
                          : 'hover:bg-gray-100 text-[#13262A]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{p.nama}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {p.nomorPeserta} &middot; NISN: {p.nisn || '-'}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-200">
                        Saat ini: Meja {p.nomorMeja}
                      </span>
                    </button>
                  ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalAssignMejaOpen(false);
                    setTargetMejaToAssign(null);
                  }}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / UBAH RAMBU-RAMBU UJIAN */}
      {/* ========================================================================= */}
      {isModalRambuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <VolumeX className="w-5 h-5 text-[#0B6B58]" />
                {editingRambu ? `Ubah Rambu: ${editingRambu.judul}` : 'Tambah Rambu Ujian Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalRambuOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRambu} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Judul Utama Rambu *</label>
                <input
                  name="judul"
                  defaultValue={editingRambu?.judul || ''}
                  required
                  placeholder="Contoh: HARAP TENANG ! atau BATAS SUCI AREA UJIAN"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold text-[#0B6B58] uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Subjudul Rambu *</label>
                <input
                  name="subjudul"
                  defaultValue={editingRambu?.subjudul || ''}
                  required
                  placeholder="Contoh: SEDANG BERLANGSUNG UJIAN SEKOLAH"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-semibold uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Warna Tema Rambu</label>
                  <select
                    name="warnaTema"
                    defaultValue={editingRambu?.warnaTema || 'merah'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-bold capitalize"
                  >
                    <option value="merah">Merah (Peringatan)</option>
                    <option value="amber">Amber/Kuning (Steril)</option>
                    <option value="hijau">Hijau (Resmi/Dinas)</option>
                    <option value="biru">Biru (Informasi)</option>
                    <option value="hitam">Hitam (Netral Ruang)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Pilihan Ikon</label>
                  <select
                    name="ikon"
                    defaultValue={editingRambu?.ikon || 'VolumeX'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-medium"
                  >
                    <option value="VolumeX">VolumeX (Harap Tenang)</option>
                    <option value="AlertTriangle">AlertTriangle (Peringatan)</option>
                    <option value="BellOff">BellOff (Dilarang HP)</option>
                    <option value="FileText">FileText (Tata Tertib)</option>
                    <option value="School">School (Pintu Ruang)</option>
                    <option value="ShieldAlert">ShieldAlert (Pengawas)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kategori Rambu</label>
                  <input
                    name="kategori"
                    defaultValue={editingRambu?.kategori || 'Peringatan'}
                    placeholder="Peringatan, Zona Steril, dll."
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">
                  Poin-Poin Pesan (Tulis 1 baris per butir pesan)
                </label>
                <textarea
                  name="pesanPoin"
                  defaultValue={editingRambu?.pesanPoin?.join('\n') || ''}
                  rows={4}
                  placeholder={`Contoh:\nDILARANG MEMBUAT KEGADUHAN\nDILARANG BERLALU LALANG DI SEKITAR RUANGAN\nMOHON NONAKTIFKAN NADA DERING HANDPHONE`}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Keterangan Tambahan / Penjelas</label>
                <input
                  name="keteranganTambahan"
                  defaultValue={editingRambu?.keteranganTambahan || ''}
                  placeholder="Keterangan kecil di bawah poin-poin pesan..."
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Catatan Kaki / Penyelenggara</label>
                <input
                  name="catatanKaki"
                  defaultValue={editingRambu?.catatanKaki || 'Panitia Pelaksana Ujian Sekolah - SD Negeri 2 Cempaka'}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalRambuOpen(false)}
                  className="px-4 py-2 border border-[#D3DDD9] text-[#566A6E] rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> Simpan Rambu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PENGATURAN POS UJIAN */}
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
      {/* MODAL: TAMBAH / UBAH JADWAL UJIAN (TANPA KOLOM RUANG) */}
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
      {/* MODAL: TAMBAH / UBAH PESERTA UJIAN */}
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
      {/* MODAL: TAMBAH / UBAH PANITIA UJIAN */}
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
      {/* MODAL: TAMBAH / UBAH PENGAWAS SILANG */}
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
          <div
            className={`bg-[#F1F4F2] rounded-2xl shadow-xl border border-[#D3DDD9] w-full ${
              printDoc === 'pengawas_rekap' ? 'max-w-[1240px]' : 'max-w-[1060px]'
            } my-4 p-4 space-y-3`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 no-print">
              <h3 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#0B6B58]" />
                Pratinjau Cetak Dokumen Resmi Ujian
                {printDoc === 'pengawas_rekap' && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-[#0B6B58] border border-emerald-300">
                    Format Landscape
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    recordActivity('POS Ujian', `Cetak dokumen POS Ujian: ${printDoc}`, false, 'update');
                    window.print();
                  }}
                  className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Cetak Lembar Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintDoc(null);
                    setSelectedRambuToPrint(null);
                  }}
                  className="p-2 text-gray-500 hover:text-gray-800 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SUB-BAR PILIH HARI UNTUK DAFTAR HADIR (PANITIA & PENGAWAS) */}
            {(printDoc === 'daftar_hadir_panitia' || printDoc === 'daftar_hadir_pengawas') && (
              <div className="bg-white p-3 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-2 text-xs no-print shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#13262A] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0B6B58]" />
                    Pilih Hari Pelaksanaan:
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {EXAM_DAYS.map((d) => (
                      <button
                        key={d.hariKe}
                        type="button"
                        onClick={() => {
                          setSelectedHariHadir(d.hariKe);
                          setPrintAllHari(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          !printAllHari && selectedHariHadir === d.hariKe
                            ? 'bg-[#0B6B58] text-white shadow-xs'
                            : 'bg-[#F1F4F2] text-[#566A6E] hover:bg-[#E6EDEA]'
                        }`}
                      >
                        Hari {d.hariKe} ({d.hariTanggal.split(',')[0]})
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPrintAllHari(!printAllHari)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    printAllHari
                      ? 'bg-[#0B6B58] text-white shadow-xs'
                      : 'bg-emerald-50 text-[#0B6B58] border border-[#B8D7CD] hover:bg-emerald-100'
                  }`}
                >
                  {printAllHari ? '✓ Mencetak Semua 6 Hari Sekaligus' : 'Cetak Semua 6 Hari Sekaligus'}
                </button>
              </div>
            )}

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

              {/* JADWAL UJIAN CETAK RESMI (KOLOM RUANG DIHAPUS) */}
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
                        <th className="border border-black p-2 w-52">Hari &amp; Tanggal</th>
                        <th className="border border-black p-2 w-16">Jam Ke</th>
                        <th className="border border-black p-2 w-40">Waktu</th>
                        <th className="border border-black p-2">Mata Pelajaran</th>
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

              {/* JADWAL & ROTASI PENGAWAS RUANG CETAK RESMI (FORMAT LANDSCAPE, ROTASI NAMA GURU DI RUANG 01-03, TANPA KOLOM TTD) */}
              {printDoc === 'pengawas_rekap' && (
                <div className="landscape-print">
                  <style>{`
                    @media print {
                      @page {
                        size: landscape !important;
                        margin: 10mm 15mm !important;
                      }
                    }
                  `}</style>
                  <KopSuratHD config={config} />
                  <div className="text-center pb-4 space-y-1">
                    <div className="text-sm font-bold tracking-wider uppercase underline">
                      JADWAL &amp; ROTASI PENGAWAS RUANG {posConfig.namaUjian.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold uppercase">
                      TAHUN PELAJARAN {posConfig.tahunPelajaran}
                    </div>
                    <div className="text-[11px] font-semibold text-gray-700">
                      {config.namaSekolah?.toUpperCase() || 'SD NEGERI 2 CEMPAKA'} &mdash; KEC. {config.kecamatan?.toUpperCase() || 'TALUN'}
                    </div>
                  </div>

                  <table className="w-full text-left text-xs border-collapse border border-black">
                    <thead>
                      <tr className="bg-gray-100 text-center font-bold">
                        <th className="border border-black p-2 w-10">No</th>
                        <th className="border border-black p-2 w-48">Hari &amp; Tanggal</th>
                        <th className="border border-black p-2 w-32">Waktu</th>
                        <th className="border border-black p-2">Mata Pelajaran</th>
                        <th className="border border-black p-2 w-56 bg-emerald-50/50">Ruang 01</th>
                        <th className="border border-black p-2 w-56 bg-sky-50/50">Ruang 02</th>
                        <th className="border border-black p-2 w-56 bg-amber-50/50">Ruang 03</th>
                      </tr>
                    </thead>
                    <tbody>
                      {EXAM_DAYS.map((day, idx) => {
                        const r1 = pengawasList.filter(
                          (p) =>
                            (p.hariKe === day.hariKe || p.hariTanggal === day.hariTanggal) &&
                            p.ruangTugas === 'Ruang 01'
                        );
                        const r2 = pengawasList.filter(
                          (p) =>
                            (p.hariKe === day.hariKe || p.hariTanggal === day.hariTanggal) &&
                            p.ruangTugas === 'Ruang 02'
                        );
                        const r3 = pengawasList.filter(
                          (p) =>
                            (p.hariKe === day.hariKe || p.hariTanggal === day.hariTanggal) &&
                            p.ruangTugas === 'Ruang 03'
                        );
                        return (
                          <tr key={day.hariKe} className="hover:bg-gray-50">
                            <td className="border border-black p-2 text-center font-mono font-bold">
                              {idx + 1}
                            </td>
                            <td className="border border-black p-2 font-bold whitespace-nowrap">
                              {day.hariTanggal}
                            </td>
                            <td className="border border-black p-2 text-center font-mono whitespace-nowrap">
                              {day.sesi}
                            </td>
                            <td className="border border-black p-2 font-semibold">
                              {day.mataPelajaran}
                            </td>
                            <td className="border border-black p-2 leading-relaxed">
                              {r1.map((p, pIdx) => (
                                <div key={p.id || pIdx} className="font-medium text-black">
                                  {pIdx + 1}. {p.nama}
                                </div>
                              ))}
                            </td>
                            <td className="border border-black p-2 leading-relaxed">
                              {r2.map((p, pIdx) => (
                                <div key={p.id || pIdx} className="font-medium text-black">
                                  {pIdx + 1}. {p.nama}
                                </div>
                              ))}
                            </td>
                            <td className="border border-black p-2 leading-relaxed">
                              {r3.map((p, pIdx) => (
                                <div key={p.id || pIdx} className="font-medium text-black">
                                  {pIdx + 1}. {p.nama}
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="flex justify-between pt-6 text-xs">
                    <div className="text-center w-60">
                      <div>Mengetahui,</div>
                      <div>Ketua Panitia Ujian Sekolah</div>
                      <div className="h-16" />
                      <div className="font-bold underline">
                        {posConfig.ketuaPanitia || 'Risna Hidayat, S.Pd.'}
                      </div>
                      <div>NIP. 198807152019031004</div>
                    </div>
                    <div className="text-center w-60">
                      <div>
                        {config.kabupaten || 'Cirebon'}, {posConfig.tglSkPanitia || '02 Mei 2026'}
                      </div>
                      <div>Kepala Sekolah Dasar Negeri 2 Cempaka,</div>
                      <div className="h-16" />
                      <div className="font-bold underline">{config.kepsek}</div>
                      <div>NIP. {config.nipKepsek}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* DAFTAR HADIR PANITIA UJIAN SEKOLAH (HARIAN 1 S.D. 6) */}
              {printDoc === 'daftar_hadir_panitia' && (
                <div>
                  {(printAllHari
                    ? EXAM_DAYS
                    : EXAM_DAYS.filter((d) => d.hariKe === selectedHariHadir)
                  ).map((d, dIdx, arr) => (
                    <div
                      key={d.hariKe}
                      className={dIdx < arr.length - 1 ? 'page-break mb-12' : ''}
                      style={dIdx < arr.length - 1 ? { pageBreakAfter: 'always' } : undefined}
                    >
                      <KopSuratHD config={config} />
                      <div className="text-center pb-4 space-y-1">
                        <div className="text-sm font-bold tracking-wider uppercase underline">
                          DAFTAR HADIR PANITIA {posConfig.namaUjian.toUpperCase()}
                        </div>
                        <div className="text-xs font-bold uppercase">
                          TAHUN PELAJARAN {posConfig.tahunPelajaran} &mdash; HARI KE-{d.hariKe}
                        </div>
                      </div>

                      <div className="border border-black p-2.5 mb-4 text-xs grid grid-cols-2 gap-x-4 gap-y-1 font-sans bg-gray-50/60">
                        <div>
                          <span className="font-bold">Hari / Tanggal</span> : {d.hariTanggal}
                        </div>
                        <div>
                          <span className="font-bold">Mata Pelajaran</span> : {d.mataPelajaran}
                        </div>
                        <div>
                          <span className="font-bold">Waktu Pelaksanaan</span> : {d.sesi}
                        </div>
                        <div>
                          <span className="font-bold">Tempat Ujian</span> : {config.namaSekolah || 'SD Negeri 2 Cempaka'}
                        </div>
                      </div>

                      <table className="w-full text-left text-xs border-collapse border border-black">
                        <thead>
                          <tr className="bg-gray-100 text-center font-bold">
                            <th className="border border-black p-2 w-10">No</th>
                            <th className="border border-black p-2">Nama Panitia</th>
                            <th className="border border-black p-2 w-36">NIP</th>
                            <th className="border border-black p-2 w-32">Jabatan Panitia</th>
                            <th className="border border-black p-2 w-28">Jam Datang</th>
                            <th className="border border-black p-2 w-28">Jam Pulang</th>
                            <th className="border border-black p-2 w-36">Tanda Tangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {panitiaList.map((p, pIdx) => {
                            const isOdd = (pIdx + 1) % 2 === 1;
                            return (
                              <tr key={p.id}>
                                <td className="border border-black p-2 text-center font-mono font-bold">
                                  {pIdx + 1}
                                </td>
                                <td className="border border-black p-2 font-bold">{p.nama}</td>
                                <td className="border border-black p-2 font-mono text-center">
                                  {p.nip || '-'}
                                </td>
                                <td className="border border-black p-2 font-semibold">
                                  {p.jabatanPanitia}
                                </td>
                                <td className="border border-black p-2 text-center font-mono text-gray-400">
                                  ..... : .....
                                </td>
                                <td className="border border-black p-2 text-center font-mono text-gray-400">
                                  ..... : .....
                                </td>
                                <td className="border border-black p-2">
                                  <div
                                    className={`h-8 flex items-center font-mono text-gray-400 ${
                                      isOdd ? 'justify-start pl-2' : 'justify-end pr-2'
                                    }`}
                                  >
                                    {pIdx + 1}. .........
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="flex justify-between pt-6 text-xs">
                        <div className="text-center w-56">
                          <div>Mengetahui,</div>
                          <div>Ketua Panitia Ujian Sekolah</div>
                          <div className="h-16" />
                          <div className="font-bold underline">
                            {posConfig.ketuaPanitia || 'Risna Hidayat, S.Pd.'}
                          </div>
                          <div>NIP. 198807152019031004</div>
                        </div>
                        <div className="text-center w-56">
                          <div>
                            {config.kabupaten || 'Cirebon'}, {d.hariTanggal.split(',')[1]?.trim() || d.hariTanggal}
                          </div>
                          <div>Kepala Sekolah,</div>
                          <div className="h-16" />
                          <div className="font-bold underline">{config.kepsek}</div>
                          <div>NIP. {config.nipKepsek}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DAFTAR HADIR PENGAWAS RUANG UJIAN (HARIAN 1 S.D. 6) */}
              {printDoc === 'daftar_hadir_pengawas' && (
                <div>
                  {(printAllHari
                    ? EXAM_DAYS
                    : EXAM_DAYS.filter((d) => d.hariKe === selectedHariHadir)
                  ).map((d, dIdx, arr) => {
                    const todaySupervisors = pengawasList
                      .filter(
                        (p) => p.hariKe === d.hariKe || p.hariTanggal === d.hariTanggal
                      )
                      .sort((a, b) => {
                        if (a.ruangTugas !== b.ruangTugas)
                          return a.ruangTugas.localeCompare(b.ruangTugas);
                        return (a.peran || '').localeCompare(b.peran || '');
                      });

                    return (
                      <div
                        key={d.hariKe}
                        className={dIdx < arr.length - 1 ? 'page-break mb-12' : ''}
                        style={dIdx < arr.length - 1 ? { pageBreakAfter: 'always' } : undefined}
                      >
                        <KopSuratHD config={config} />
                        <div className="text-center pb-4 space-y-1">
                          <div className="text-sm font-bold tracking-wider uppercase underline">
                            DAFTAR HADIR PENGAWAS RUANG {posConfig.namaUjian.toUpperCase()}
                          </div>
                          <div className="text-xs font-bold uppercase">
                            TAHUN PELAJARAN {posConfig.tahunPelajaran} &mdash; HARI KE-{d.hariKe}
                          </div>
                        </div>

                        <div className="border border-black p-2.5 mb-4 text-xs grid grid-cols-2 gap-x-4 gap-y-1 font-sans bg-gray-50/60">
                          <div>
                            <span className="font-bold">Hari / Tanggal</span> : {d.hariTanggal}
                          </div>
                          <div>
                            <span className="font-bold">Mata Pelajaran</span> : {d.mataPelajaran}
                          </div>
                          <div>
                            <span className="font-bold">Waktu Pelaksanaan</span> : {d.sesi}
                          </div>
                          <div>
                            <span className="font-bold">Tempat Pelaksanaan</span> : {config.namaSekolah || 'SD Negeri 2 Cempaka'}
                          </div>
                        </div>

                        <table className="w-full text-left text-xs border-collapse border border-black">
                          <thead>
                            <tr className="bg-gray-100 text-center font-bold">
                              <th className="border border-black p-2 w-10">No</th>
                              <th className="border border-black p-2">Nama Lengkap Pengawas</th>
                              <th className="border border-black p-2 w-36">NIP</th>
                              <th className="border border-black p-2 w-44">Asal Satuan Pendidikan</th>
                              <th className="border border-black p-2 w-32">Ruang Tugas</th>
                              <th className="border border-black p-2 w-28">Jam Hadir</th>
                              <th className="border border-black p-2 w-36">Tanda Tangan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {todaySupervisors.map((p, pIdx) => {
                              const isOdd = (pIdx + 1) % 2 === 1;
                              return (
                                <tr key={p.id || pIdx}>
                                  <td className="border border-black p-2 text-center font-mono font-bold">
                                    {pIdx + 1}
                                  </td>
                                  <td className="border border-black p-2 font-bold">{p.nama}</td>
                                  <td className="border border-black p-2 font-mono text-center">
                                    {p.nip || '-'}
                                  </td>
                                  <td className="border border-black p-2">{p.asalSekolah}</td>
                                  <td className="border border-black p-2 font-semibold text-center">
                                    {p.ruangTugas} ({p.peran || `Pengawas ${(pIdx % 2) + 1}`})
                                  </td>
                                  <td className="border border-black p-2 text-center font-mono text-gray-400">
                                    ..... : .....
                                  </td>
                                  <td className="border border-black p-2">
                                    <div
                                      className={`h-8 flex items-center font-mono text-gray-400 ${
                                        isOdd ? 'justify-start pl-2' : 'justify-end pr-2'
                                      }`}
                                    >
                                      {pIdx + 1}. .........
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="flex justify-between pt-6 text-xs">
                          <div className="text-center w-56">
                            <div>Mengetahui,</div>
                            <div>Ketua Panitia Ujian Sekolah</div>
                            <div className="h-16" />
                            <div className="font-bold underline">
                              {posConfig.ketuaPanitia || 'Risna Hidayat, S.Pd.'}
                            </div>
                            <div>NIP. 198807152019031004</div>
                          </div>
                          <div className="text-center w-56">
                            <div>
                              {config.kabupaten || 'Cirebon'}, {d.hariTanggal.split(',')[1]?.trim() || d.hariTanggal}
                            </div>
                            <div>Kepala Sekolah Dasar Negeri 2 Cempaka,</div>
                            <div className="h-16" />
                            <div className="font-bold underline">{config.kepsek}</div>
                            <div>NIP. {config.nipKepsek}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* DENAH DUDUK RUANG CETAK (DINAMIS SESUAI SKEMA JUMLAH KOLOM & KAPASITAS) */}
              {printDoc === 'denah_duduk' && (() => {
                const roomStartMeja = getRoomStartMeja(printRuang, skema.kapasitasMeja || 20);
                const roomStudents = pesertaList.filter((p) => p.ruang === printRuang);
                const maxStudentMeja = roomStudents.length > 0
                  ? Math.max(...roomStudents.map((p) => p.nomorMeja))
                  : roomStartMeja + (skema.kapasitasMeja || 20) - 1;
                const neededCount = Math.max(1, maxStudentMeja - roomStartMeja + 1);
                const cCount = Math.max(2, Math.min(5, skema.jumlahKolom || 4));
                const fullRows = Math.ceil(neededCount / cCount);
                const roomTotalCells = Math.min(
                  skema.kapasitasMeja || 20,
                  Math.max(cCount, fullRows * cCount)
                );

                return (
                  <div>
                    <KopSuratHD config={config} />
                    <div className="text-center pb-4 space-y-1">
                      <div className="text-sm font-bold tracking-wider uppercase underline">
                        DENAH DUDUK PESERTA &mdash; {printRuang.toUpperCase()}
                      </div>
                      <div className="text-xs font-bold">
                        {posConfig.namaUjian.toUpperCase()} &middot; TAHUN PELAJARAN {posConfig.tahunPelajaran}
                      </div>
                    </div>

                    {/* Meja Pengawas 1 dan Meja Pengawas 2 saja (Papan Tulis ditiadakan sesuai instruksi) */}
                    <div className="flex justify-center gap-6 mb-5">
                      <div className="border-2 border-black py-2 px-8 rounded text-center font-bold text-xs bg-gray-50 uppercase tracking-wider">
                        MEJA PENGAWAS 1
                      </div>
                      <div className="border-2 border-black py-2 px-8 rounded text-center font-bold text-xs bg-gray-50 uppercase tracking-wider">
                        MEJA PENGAWAS 2
                      </div>
                    </div>

                    <div className={`grid gap-3 my-6 text-center text-xs ${getPrintGridColsClass(skema.jumlahKolom || 4)}`}>
                      {getOrderedMejaList(
                        skema.format,
                        skema.jumlahKolom || 4,
                        roomTotalCells,
                        roomStartMeja
                      ).map((mejaNo, idx) => {
                        if (mejaNo === 0) {
                          return <div key={`empty-print-${idx}`} className="opacity-0 select-none" />;
                        }
                        const student = pesertaList.find(
                          (p) => p.ruang === printRuang && p.nomorMeja === mejaNo
                        );

                        // Meja yang tidak ada pesertanya dihilangkan
                        if (!student) {
                          return <div key={`empty-desk-${mejaNo}`} className="invisible select-none pointer-events-none" />;
                        }

                        return (
                          <div key={`print-meja-${mejaNo}`} className="border-2 border-black p-2.5 rounded text-center bg-white shadow-2xs">
                            <div className="font-bold underline text-xs">
                              {skema.labelMeja || 'MEJA'} {mejaNo}
                            </div>
                            <div className="pt-1 leading-tight">
                              <div className="font-bold text-[11px] truncate">{student.nama}</div>
                              <div className="font-mono text-[10px]">{student.nomorPeserta}</div>
                              <div className="text-[9px] text-gray-700">
                                ({student.jk === 'L' ? 'Laki-laki' : 'Perempuan'})
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pintu masuk ruangan ditiadakan saat cetak sesuai instruksi */}

                    <div className="flex justify-end pt-6 text-xs">
                      <div className="text-center w-64">
                        <div>Kepala Sekolah,</div>
                        <div className="h-14" />
                        <div className="font-bold underline">{config.kepsek}</div>
                        <div>NIP. {config.nipKepsek}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                            {skema.labelMeja || 'MEJA'} {p.nomorMeja}
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
              {printDoc === 'denah_photo' && (() => {
                const roomStartMeja = getRoomStartMeja(printRuang, skema.kapasitasMeja || 20);
                const roomStudents = pesertaList.filter((p) => p.ruang === printRuang);
                const maxStudentMeja = roomStudents.length > 0
                  ? Math.max(...roomStudents.map((p) => p.nomorMeja))
                  : roomStartMeja + (skema.kapasitasMeja || 20) - 1;
                const neededCount = Math.max(1, maxStudentMeja - roomStartMeja + 1);
                const cCount = Math.max(2, Math.min(5, skema.jumlahKolom || 4));
                const fullRows = Math.ceil(neededCount / cCount);
                const roomTotalCells = Math.min(
                  skema.kapasitasMeja || 20,
                  Math.max(cCount, fullRows * cCount)
                );
                const orderedMejaListForPhoto = getOrderedMejaList(
                  skema.format,
                  skema.jumlahKolom || 4,
                  roomTotalCells,
                  roomStartMeja
                );

                return (
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

                    <div className={`grid gap-3 text-xs ${getPrintGridColsClass(skema.jumlahKolom || 4)}`}>
                      {orderedMejaListForPhoto.map((mejaNo) => {
                        if (mejaNo === 0) return null;
                        const p = pesertaList.find(
                          (s) => s.ruang === printRuang && s.nomorMeja === mejaNo
                        );
                        // Meja yang tidak ada pesertanya dihilangkan
                        if (!p) return null;

                        return (
                          <div
                            key={p.id}
                            className="border border-black p-2 rounded flex gap-2 items-center leading-tight bg-white"
                          >
                            <div className="w-12 h-16 border border-black flex-none flex items-center justify-center text-[8px] text-gray-400 text-center p-1">
                              Foto 3x4
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold font-mono text-[11px]">
                                {skema.labelMeja || 'MEJA'} {p.nomorMeja}
                              </div>
                              <div className="font-bold text-xs truncate" title={p.nama}>
                                {p.nama}
                              </div>
                              <div className="font-mono text-[10px]">{p.nomorPeserta}</div>
                              <div className="text-[9px] text-gray-600">NISN: {p.nisn || '-'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tanda tangan hanya Kepala Sekolah (ttd pengawas dihilangkan sesuai permintaan) */}
                    <div className="flex justify-end pt-8 text-xs">
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
                );
              })()}

              {/* ID CARD PANITIA & PENGAWAS (TANPA TTD KEPSEK & TANPA NO RUANG PENGAWAS) */}
              {printDoc === 'kartu_id' && (
                <div>
                  <div className="text-center pb-4 text-xs font-bold uppercase underline">
                    KARTU TANDA PENGENAL PANITIA &amp; PENGAWAS UJIAN SEKOLAH
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    {/* Panitia Cards */}
                    {(filterKartu === 'semua' || filterKartu === 'panitia') &&
                      panitiaList.map((p) => (
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

                            <div className="mt-2 py-1 px-3 font-bold text-xs border border-black rounded inline-block uppercase">
                              {p.jabatanPanitia}
                            </div>
                          </div>

                          {/* Tanpa TTD Kepsek */}
                          <div className="pt-3 border-t border-black text-[9px] flex justify-between items-center text-left">
                            <span className="font-bold">PANITIA RESMI</span>
                            <span className="font-mono text-gray-500">TP {posConfig.tahunPelajaran}</span>
                          </div>
                        </div>
                      ))}

                    {/* Pengawas Cards (Tanpa No Ruang & Tanpa TTD Kepsek) */}
                    {(filterKartu === 'semua' || filterKartu === 'pengawas') &&
                      pengawasList.map((pg) => (
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

                            {/* Tanpa Nomor Ruang */}
                            <div className="mt-2 py-1 px-3 font-bold text-xs border border-black rounded inline-block uppercase">
                              PENGAWAS RUANG
                            </div>
                          </div>

                          {/* Tanpa TTD Kepsek */}
                          <div className="pt-3 border-t border-black text-[9px] flex justify-between items-center text-left">
                            <span className="font-bold">PENGAWAS RESMI</span>
                            <span className="font-mono text-gray-500">TP {posConfig.tahunPelajaran}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* CETAK RAMBU TERPILIH (DINAMIS SESUAI EDIT/TAMBAH RAMBU) */}
              {printDoc === 'rambu_selected' && selectedRambuToPrint && (
                <div
                  className={`p-8 text-center border-8 ${
                    getRambuColorStyles(selectedRambuToPrint.warnaTema).border
                  } rounded-2xl space-y-6 my-4 font-sans`}
                >
                  <div className="text-lg font-bold uppercase tracking-widest text-black">
                    {config.namaSekolah?.toUpperCase() || 'SD NEGERI 2 CEMPAKA'}
                  </div>

                  <div
                    className={`w-24 h-24 rounded-full ${
                      getRambuColorStyles(selectedRambuToPrint.warnaTema).badge
                    } flex items-center justify-center mx-auto my-4 shadow-sm`}
                  >
                    {renderRambuIcon(selectedRambuToPrint.ikon, 'w-14 h-14')}
                  </div>

                  <div
                    className={`text-4xl md:text-5xl font-black ${
                      getRambuColorStyles(selectedRambuToPrint.warnaTema).textAccent
                    } tracking-wider uppercase font-display leading-tight`}
                  >
                    {selectedRambuToPrint.judul}
                  </div>

                  <div className="text-2xl md:text-3xl font-black text-black uppercase tracking-wide">
                    {selectedRambuToPrint.subjudul}
                  </div>

                  {selectedRambuToPrint.pesanPoin && selectedRambuToPrint.pesanPoin.length > 0 && (
                    <div className="border-t-4 border-b-4 border-black py-5 max-w-xl mx-auto space-y-2 text-sm font-bold uppercase text-left">
                      {selectedRambuToPrint.pesanPoin.map((p, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="font-black text-base">&bull;</span>
                          <span className="leading-tight">{p}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRambuToPrint.keteranganTambahan && (
                    <p className="text-xs text-gray-700 italic max-w-lg mx-auto">
                      {selectedRambuToPrint.keteranganTambahan}
                    </p>
                  )}

                  <div className="text-xs text-gray-600 pt-4 font-semibold uppercase">
                    {selectedRambuToPrint.catatanKaki ||
                      `Panitia Pelaksana Ujian Sekolah - TP ${posConfig.tahunPelajaran}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
