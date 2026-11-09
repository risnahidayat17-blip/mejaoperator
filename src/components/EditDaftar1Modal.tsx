/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SchoolConfig,
  Guru,
  LaporanBulan as ILaporanBulan,
  TanahItem,
  BangunanRuanganItem,
  JenisBangunanItem,
  PerkakasItem,
} from '../types';
import {
  TANAH,
  BANGUNAN_RUANGAN,
  JENIS_BANGUNAN,
  PERKAKAS,
  AIR_BERSIH,
  BAG_PER_KELAS,
} from '../data/daftar1Static';
import { saveGuru } from '../lib/storage';
import { hitungTotalBulanMasaKerja, parseTmtDate } from './Daftar1Sheet';
import {
  X,
  Save,
  RotateCcw,
  UserCheck,
  Building2,
  Users,
  FileBadge,
  CheckCircle2,
} from 'lucide-react';

interface EditDaftar1ModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string; // YYYY-MM
  config: SchoolConfig;
  guruList: Guru[];
  reportData: ILaporanBulan;
  onSave: (updatedReport: ILaporanBulan) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const EditDaftar1Modal: React.FC<EditDaftar1ModalProps> = ({
  isOpen,
  onClose,
  month,
  config,
  guruList,
  reportData,
  onSave,
  onToast,
}) => {
  if (!isOpen) return null;

  const [yy, mm] = month.split('-').map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const defaultTglLaporan = `${String(lastDay).padStart(2, '0')} ${BULAN[mm - 1] || ''} ${yy}`;

  const [activeTab, setActiveTab] = useState<'guru' | 'sarana' | 'murid' | 'pengesahan'>('guru');

  // ----- State Tab 1: Guru -----
  // Sort guru list with longest service period at top
  const sortedGurus = guruList
    .filter((g) => g.status !== 'Nonaktif')
    .slice()
    .sort((a, b) => {
      const bMasa = hitungTotalBulanMasaKerja(b, yy, mm);
      const aMasa = hitungTotalBulanMasaKerja(a, yy, mm);
      if (bMasa !== aMasa) return bMasa - aMasa;
      const aP = parseTmtDate(a.tmt);
      const bP = parseTmtDate(b.tmt);
      const aTmtVal = aP ? aP.y * 10000 + aP.m * 100 + aP.d : 99999999;
      const bTmtVal = bP ? bP.y * 10000 + bP.m * 100 + bP.d : 99999999;
      if (aTmtVal !== bTmtVal) return aTmtVal - bTmtVal;
      return a.nama.localeCompare(b.nama);
    });

  const [selectedGuruId, setSelectedGuruId] = useState<string>(sortedGurus[0]?.id || '');
  const [guruOverrides, setGuruOverrides] = useState<Record<string, Partial<Guru>>>(
    () => reportData.guruOverrides || {}
  );
  const [guruAbsen, setGuruAbsen] = useState<Record<string, { s?: number; i?: number; a?: number }>>(
    () => reportData.absen || {}
  );
  const [syncToMasterGuru, setSyncToMasterGuru] = useState<boolean>(true);

  // ----- State Tab 2: Sarana & Prasarana -----
  const [tanah, setTanah] = useState<TanahItem[]>(
    () => JSON.parse(JSON.stringify(reportData.sarana?.tanah || TANAH))
  );
  const [bangunanRuangan, setBangunanRuangan] = useState<BangunanRuanganItem[]>(
    () => JSON.parse(JSON.stringify(reportData.sarana?.bangunanRuangan || BANGUNAN_RUANGAN))
  );
  const [jenisBangunan, setJenisBangunan] = useState<JenisBangunanItem[]>(
    () => JSON.parse(JSON.stringify(reportData.sarana?.jenisBangunan || JENIS_BANGUNAN))
  );
  const [perkakas, setPerkakas] = useState<PerkakasItem[]>(
    () => JSON.parse(JSON.stringify(reportData.sarana?.perkakas || PERKAKAS))
  );
  const [airBersih, setAirBersih] = useState<string>(
    () => reportData.sarana?.airBersih || AIR_BERSIH
  );
  const [sewaPerbulan, setSewaPerbulan] = useState<string>(
    () => reportData.sarana?.sewaPerbulan || ''
  );
  const [menumpang, setMenumpang] = useState<string>(
    () => reportData.sarana?.menumpang || ''
  );

  // ----- State Tab 3: Murid & Absen -----
  const [muridSakit, setMuridSakit] = useState<number>(reportData.murid?.sakit || 0);
  const [muridIzin, setMuridIzin] = useState<number>(reportData.murid?.izin || 0);
  const [muridAlpa, setMuridAlpa] = useState<number>(reportData.murid?.alpa || 0);
  const [bagPerKelas, setBagPerKelas] = useState<number>(
    reportData.sarana?.bagPerKelas || BAG_PER_KELAS
  );
  const [kelasPembangunan, setKelasPembangunan] = useState<string>(
    String(reportData.muridOverrides?.kelasPembangunan ?? '-')
  );

  // ----- State Tab 4: Pengesahan & Identitas -----
  const [tglLaporan, setTglLaporan] = useState<string>(
    reportData.pengesahan?.tglLaporan || defaultTglLaporan
  );
  const [tempatLaporan, setTempatLaporan] = useState<string>(
    reportData.pengesahan?.tempatLaporan || config.tempatLaporan || config.kecamatan || config.kabupaten || ''
  );
  const [korwilJabatan, setKorwilJabatan] = useState<string>(
    reportData.pengesahan?.korwilJabatan || config.korwilJabatan || 'Korwil Bidang Pendidikan'
  );
  const [korwilNama, setKorwilNama] = useState<string>(
    reportData.pengesahan?.korwilNama || config.korwilNama || ''
  );
  const [korwilNip, setKorwilNip] = useState<string>(
    reportData.pengesahan?.korwilNip || config.korwilNip || ''
  );
  const [kepsek, setKepsek] = useState<string>(
    reportData.pengesahan?.kepsek || config.kepsek || ''
  );
  const [nipKepsek, setNipKepsek] = useState<string>(
    reportData.pengesahan?.nipKepsek || config.nipKepsek || ''
  );
  const [tahunBerdiri, setTahunBerdiri] = useState<string>(
    reportData.pengesahan?.tahunBerdiri || config.tahunBerdiri || ''
  );
  const [statusSekolah, setStatusSekolah] = useState<string>(
    reportData.pengesahan?.statusSekolah || config.statusSekolah || 'Negeri Biasa'
  );
  const [bahasa, setBahasa] = useState<string>(
    reportData.pengesahan?.bahasa || config.bahasa || 'Indonesia'
  );

  // Helper current active guru form
  const rawCurrentGuru = sortedGurus.find((g) => g.id === selectedGuruId) || sortedGurus[0];
  const currentGuru = rawCurrentGuru
    ? { ...rawCurrentGuru, ...(guruOverrides[rawCurrentGuru.id] || {}) }
    : null;

  const updateCurrentGuruField = (field: keyof Guru, value: any) => {
    if (!currentGuru) return;
    setGuruOverrides((prev) => ({
      ...prev,
      [currentGuru.id]: {
        ...(prev[currentGuru.id] || {}),
        [field]: value,
      },
    }));
  };

  const updateCurrentGuruAbsen = (type: 's' | 'i' | 'a', value: number) => {
    if (!currentGuru) return;
    setGuruAbsen((prev) => ({
      ...prev,
      [currentGuru.id]: {
        ...(prev[currentGuru.id] || {}),
        [type]: value,
      },
    }));
  };

  const handleResetDefaults = () => {
    if (!window.confirm('Kembalikan data sarana dan pengesahan Daftar 1 ke nilai bawaan sistem?')) return;
    setTanah(JSON.parse(JSON.stringify(TANAH)));
    setBangunanRuangan(JSON.parse(JSON.stringify(BANGUNAN_RUANGAN)));
    setJenisBangunan(JSON.parse(JSON.stringify(JENIS_BANGUNAN)));
    setPerkakas(JSON.parse(JSON.stringify(PERKAKAS)));
    setAirBersih(AIR_BERSIH);
    setSewaPerbulan('');
    setMenumpang('');
    setBagPerKelas(BAG_PER_KELAS);
    setKelasPembangunan('-');
    setGuruOverrides({});
    setTglLaporan(defaultTglLaporan);
    setTempatLaporan(config.tempatLaporan || config.kecamatan || config.kabupaten || '');
    setKorwilJabatan(config.korwilJabatan || 'Korwil Bidang Pendidikan');
    setKorwilNama(config.korwilNama || '');
    setKorwilNip(config.korwilNip || '');
    setKepsek(config.kepsek || '');
    setNipKepsek(config.nipKepsek || '');
    setTahunBerdiri(config.tahunBerdiri || '');
    setStatusSekolah(config.statusSekolah || 'Negeri Biasa');
    setBahasa(config.bahasa || 'Indonesia');
    onToast('Data telah dikembalikan ke bawaan format.');
  };

  const handleSaveAll = () => {
    // 1. Simpan ke master data guru jika opsi sinkronisasi aktif
    if (syncToMasterGuru && Object.keys(guruOverrides).length > 0) {
      sortedGurus.forEach((g) => {
        const patch = guruOverrides[g.id];
        if (patch) {
          saveGuru({
            ...g,
            ...patch,
            updatedAt: Date.now(),
          });
        }
      });
    }

    // 2. Susun objek LaporanBulan
    const updated: ILaporanBulan = {
      ...reportData,
      id: month,
      murid: {
        sakit: muridSakit,
        izin: muridIzin,
        alpa: muridAlpa,
      },
      absen: guruAbsen,
      sarana: {
        tanah,
        bangunanRuangan,
        jenisBangunan,
        perkakas,
        airBersih: airBersih.trim(),
        sewaPerbulan: sewaPerbulan.trim(),
        menumpang: menumpang.trim(),
        bagPerKelas,
      },
      muridOverrides: {
        ...(reportData.muridOverrides || {}),
        kelasPembangunan,
      },
      guruOverrides,
      pengesahan: {
        tempatLaporan: tempatLaporan.trim(),
        tglLaporan: tglLaporan.trim(),
        korwilJabatan: korwilJabatan.trim(),
        korwilNama: korwilNama.trim(),
        korwilNip: korwilNip.trim(),
        kepsek: kepsek.trim(),
        nipKepsek: nipKepsek.trim(),
        tahunBerdiri: tahunBerdiri.trim(),
        statusSekolah: statusSekolah.trim(),
        bahasa: bahasa.trim(),
      },
      updatedAt: Date.now(),
    };

    onSave(updated);
    onToast('Perubahan Daftar 1 berhasil disimpan.');
    onClose();
  };

  const inputCls =
    'w-full px-2.5 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6B58]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-5xl w-full p-5 sm:p-6 space-y-4 my-4 text-xs max-h-[94vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#E6EDEA] pb-3 flex-none">
          <div>
            <h2 className="text-base font-bold text-[#13262A] font-display flex items-center gap-2">
              <span>Edit / Koreksi Data Daftar 1</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#E6F2EE] text-[#0B6B58] font-bold">
                Bulan: {month}
              </span>
            </h2>
            <p className="text-[11px] text-[#566A6E] mt-0.5">
              Betulkan rincian data guru, sarana tanah/bangunan/perkakas, statistik murid, atau pengesahan untuk laporan Daftar 1.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#566A6E] hover:text-[#13262A] rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex items-center gap-1.5 border-b border-[#E6EDEA] pb-2 flex-none overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('guru')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'guru'
                ? 'bg-[#0B6B58] text-white shadow-xs'
                : 'bg-[#F1F4F2] text-[#566A6E] hover:bg-[#E5EBE8]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Guru & Tendik ({sortedGurus.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sarana')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'sarana'
                ? 'bg-[#0B6B58] text-white shadow-xs'
                : 'bg-[#F1F4F2] text-[#566A6E] hover:bg-[#E5EBE8]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Sarana & Perkakas (Hal 1 Kanan)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('murid')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'murid'
                ? 'bg-[#0B6B58] text-white shadow-xs'
                : 'bg-[#F1F4F2] text-[#566A6E] hover:bg-[#E5EBE8]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Murid & Absensi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pengesahan')}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'pengesahan'
                ? 'bg-[#0B6B58] text-white shadow-xs'
                : 'bg-[#F1F4F2] text-[#566A6E] hover:bg-[#E5EBE8]'
            }`}
          >
            <FileBadge className="w-3.5 h-3.5" />
            <span>Kop & Tanda Tangan</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: GURU & TENDIK */}
          {activeTab === 'guru' && currentGuru && (
            <div className="grid md:grid-cols-12 gap-4">
              {/* Sidebar daftar guru */}
              <div className="md:col-span-4 border border-[#D3DDD9] rounded-xl overflow-hidden bg-[#FAFBFB] flex flex-col max-h-[500px]">
                <div className="p-2.5 bg-[#F1F4F2] border-b border-[#D3DDD9] font-bold text-[#13262A] text-xs flex items-center justify-between">
                  <span>Pilih Guru / Tendik:</span>
                  <span className="text-[10px] text-[#566A6E]">Urutan masa kerja</span>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-[#E6EDEA]">
                  {sortedGurus.map((g, idx) => {
                    const isSel = g.id === selectedGuruId;
                    const ov = guruOverrides[g.id];
                    const gMasaT = ov?.masaTahun !== undefined ? ov.masaTahun : g.masaTahun;
                    const gMasaB = ov?.masaBulan !== undefined ? ov.masaBulan : g.masaBulan;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGuruId(g.id)}
                        className={`w-full text-left p-2.5 text-xs transition cursor-pointer flex items-start gap-2 ${
                          isSel ? 'bg-[#E6F2EE] font-bold text-[#0B6B58]' : 'hover:bg-white text-[#13262A]'
                        }`}
                      >
                        <span className="w-5 text-center font-mono text-[10px] text-[#566A6E] mt-0.5">
                          {idx + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-semibold">{ov?.nama || g.nama}</div>
                          <div className="text-[10px] text-[#566A6E] flex items-center gap-1 mt-0.5">
                            <span>{ov?.jabatan || g.jabatan || 'Guru'}</span>
                            <span>&bull;</span>
                            <span>
                              {typeof gMasaT === 'number'
                                ? `${gMasaT} th ${gMasaB || 0} bln`
                                : g.tmt || '-'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form edit guru terpilih */}
              <div className="md:col-span-8 border border-[#D3DDD9] rounded-xl p-4 bg-white space-y-3.5">
                <div className="flex flex-wrap items-center justify-between border-b border-[#E6EDEA] pb-2">
                  <div className="font-bold text-[#0B6B58] text-sm flex items-center gap-2">
                    <span>{currentGuru.nama}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#F1F4F2] text-[#566A6E] font-mono">
                      {currentGuru.statusPeg || 'PNS'}
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-[#566A6E] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncToMasterGuru}
                      onChange={(e) => setSyncToMasterGuru(e.target.checked)}
                      className="rounded text-[#0B6B58] focus:ring-[#0B6B58]"
                    />
                    <span>Perbarui juga di Master Data Guru</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nama Lengkap & Gelar</label>
                    <input
                      value={currentGuru.nama || ''}
                      onChange={(e) => updateCurrentGuruField('nama', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NIP</label>
                    <input
                      value={currentGuru.nip || ''}
                      onChange={(e) => updateCurrentGuruField('nip', e.target.value)}
                      className={inputCls}
                      placeholder="19800101 200501 1 001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">KARPEG</label>
                    <input
                      value={currentGuru.karpeg || ''}
                      onChange={(e) => updateCurrentGuruField('karpeg', e.target.value)}
                      className={inputCls}
                      placeholder="G 123456"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tempat Lahir</label>
                    <input
                      value={currentGuru.tempatLahir || ''}
                      onChange={(e) => updateCurrentGuruField('tempatLahir', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tgl Lahir (YYYY-MM-DD)</label>
                    <input
                      value={currentGuru.tglLahir || ''}
                      onChange={(e) => updateCurrentGuruField('tglLahir', e.target.value)}
                      className={inputCls}
                      placeholder="1985-05-20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jenis Kelamin</label>
                    <select
                      value={currentGuru.jk || 'L'}
                      onChange={(e) => updateCurrentGuruField('jk', e.target.value)}
                      className={inputCls}
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Agama</label>
                    <input
                      value={currentGuru.agama || ''}
                      onChange={(e) => updateCurrentGuruField('agama', e.target.value)}
                      className={inputCls}
                      placeholder="Islam"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Status Kawin</label>
                    <select
                      value={currentGuru.kawin || 'K'}
                      onChange={(e) => updateCurrentGuruField('kawin', e.target.value)}
                      className={inputCls}
                    >
                      <option value="K">Kawin (K)</option>
                      <option value="BK">Belum Kawin (BK)</option>
                      <option value="TK">Tidak Kawin (TK)</option>
                      <option value="J/D">Janda / Duda</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Anak &lt; 18 th</label>
                    <input
                      type="number"
                      min={0}
                      value={currentGuru.anak ?? ''}
                      onChange={(e) => updateCurrentGuruField('anak', e.target.value ? Number(e.target.value) : 0)}
                      className={inputCls}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jabatan di Sekolah</label>
                    <input
                      value={currentGuru.jabatan || ''}
                      onChange={(e) => updateCurrentGuruField('jabatan', e.target.value)}
                      className={inputCls}
                      placeholder="Guru Kelas / Kepala Sekolah"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Mengajar di Kls</label>
                    <input
                      value={currentGuru.mengampu || ''}
                      onChange={(e) => updateCurrentGuruField('mengampu', e.target.value)}
                      className={inputCls}
                      placeholder="Contoh: IV atau Mapel PJOK"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Ijazah & Tahunnya</label>
                    <input
                      value={currentGuru.ijazah || currentGuru.pendidikan || ''}
                      onChange={(e) => updateCurrentGuruField('ijazah', e.target.value)}
                      className={inputCls}
                      placeholder="S.1 PGSD (2010)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-[#F8FBFA] p-3 rounded-lg border border-[#E6EDEA]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">TMT Mulai Bekerja (Tgl)</label>
                    <input
                      value={currentGuru.tmt || ''}
                      onChange={(e) => updateCurrentGuruField('tmt', e.target.value)}
                      className={inputCls}
                      placeholder="2010-01-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Masa Kerja (Tahun)</label>
                    <input
                      type="number"
                      min={0}
                      value={currentGuru.masaTahun ?? ''}
                      onChange={(e) => updateCurrentGuruField('masaTahun', e.target.value ? Number(e.target.value) : undefined)}
                      className={inputCls}
                      placeholder="Contoh: 14"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Masa Kerja (Bulan)</label>
                    <input
                      type="number"
                      min={0}
                      max={11}
                      value={currentGuru.masaBulan ?? ''}
                      onChange={(e) => updateCurrentGuruField('masaBulan', e.target.value ? Number(e.target.value) : 0)}
                      className={inputCls}
                      placeholder="Contoh: 2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Golongan / Ruang</label>
                    <input
                      value={currentGuru.golongan || ''}
                      onChange={(e) => updateCurrentGuruField('golongan', e.target.value)}
                      className={inputCls}
                      placeholder="III/a, IX, dll."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">TMT Golongan</label>
                    <input
                      value={currentGuru.tmtGol || ''}
                      onChange={(e) => updateCurrentGuruField('tmtGol', e.target.value)}
                      className={inputCls}
                      placeholder="2022-04-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Gaji Pokok (Rp)</label>
                    <input
                      type="number"
                      value={currentGuru.gaji ?? ''}
                      onChange={(e) => updateCurrentGuruField('gaji', e.target.value ? Number(e.target.value) : 0)}
                      className={inputCls}
                      placeholder="Contoh: 3500000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal SK Terakhir</label>
                    <input
                      value={currentGuru.skTanggal || ''}
                      onChange={(e) => updateCurrentGuruField('skTanggal', e.target.value)}
                      className={inputCls}
                      placeholder="2022-03-01"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nomor SK Terakhir</label>
                    <input
                      value={currentGuru.skNomor || ''}
                      onChange={(e) => updateCurrentGuruField('skNomor', e.target.value)}
                      className={inputCls}
                      placeholder="800/Kpts/2022"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Status Pegawai</label>
                    <select
                      value={currentGuru.statusPeg || 'PNS'}
                      onChange={(e) => updateCurrentGuruField('statusPeg', e.target.value)}
                      className={inputCls}
                    >
                      <option value="PNS">PNS</option>
                      <option value="PPPK">PPPK</option>
                      <option value="PPPK PW">PPPK PW (Paruh Waktu)</option>
                      <option value="GTT / Honorer">G. Bantu / Honorer</option>
                    </select>
                  </div>
                </div>

                {/* Absensi per guru bulan ini */}
                <div className="bg-[#FAFBFB] p-2.5 rounded-lg border border-[#E6EDEA] flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-[#13262A]">Absensi Guru Bulan Ini:</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-[#566A6E]">Sakit:</span>
                      <input
                        type="number"
                        min={0}
                        value={guruAbsen[currentGuru.id]?.s ?? 0}
                        onChange={(e) => updateCurrentGuruAbsen('s', Number(e.target.value))}
                        className="w-14 px-2 py-1 border rounded text-center font-mono text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-[#566A6E]">Izin:</span>
                      <input
                        type="number"
                        min={0}
                        value={guruAbsen[currentGuru.id]?.i ?? 0}
                        onChange={(e) => updateCurrentGuruAbsen('i', Number(e.target.value))}
                        className="w-14 px-2 py-1 border rounded text-center font-mono text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <span className="text-[#566A6E]">Alpa:</span>
                      <input
                        type="number"
                        min={0}
                        value={guruAbsen[currentGuru.id]?.a ?? 0}
                        onChange={(e) => updateCurrentGuruAbsen('a', Number(e.target.value))}
                        className="w-14 px-2 py-1 border rounded text-center font-mono text-xs"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Keterangan Tambahan Lembar</label>
                  <input
                    value={currentGuru.ketLaporan || ''}
                    onChange={(e) => updateCurrentGuruField('ketLaporan', e.target.value)}
                    className={inputCls}
                    placeholder="Contoh: PLPG / Sertifikasi / Cuti"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SARANA & PRASARANA */}
          {activeTab === 'sarana' && (
            <div className="space-y-4">
              {/* A. Tanah */}
              <div className="border border-[#D3DDD9] rounded-xl p-3.5 bg-white space-y-2">
                <div className="font-bold text-xs text-[#0B6B58]">A. Tanah Sekolah</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F1F4F2] text-[#566A6E] text-[11px]">
                      <th className="p-2 text-left">Kepemilikan</th>
                      <th className="p-2 text-left">Luas (M²)</th>
                      <th className="p-2 text-left">No. Persil</th>
                      <th className="p-2 text-left">Tahun Pembelian</th>
                      <th className="p-2 text-left">Harga (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EDEA]">
                    {tanah.map((t, idx) => (
                      <tr key={t.label}>
                        <td className="p-2 font-semibold text-[#13262A]">{t.label}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={t.luas ?? ''}
                            onChange={(e) => {
                              const next = [...tanah];
                              next[idx].luas = e.target.value ? Number(e.target.value) : null;
                              setTanah(next);
                            }}
                            className={inputCls}
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={t.persil ?? ''}
                            onChange={(e) => {
                              const next = [...tanah];
                              next[idx].persil = e.target.value ? Number(e.target.value) : null;
                              setTanah(next);
                            }}
                            className={inputCls}
                            placeholder="-"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.tahun || ''}
                            onChange={(e) => {
                              const next = [...tanah];
                              next[idx].tahun = e.target.value;
                              setTanah(next);
                            }}
                            className={inputCls}
                            placeholder="-"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={t.harga ?? ''}
                            onChange={(e) => {
                              const next = [...tanah];
                              next[idx].harga = e.target.value ? Number(e.target.value) : null;
                              setTanah(next);
                            }}
                            className={inputCls}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* B. Bangunan Ruangan */}
              <div className="border border-[#D3DDD9] rounded-xl p-3.5 bg-white space-y-2">
                <div className="font-bold text-xs text-[#0B6B58]">B. Bangunan Ruangan (Kondisi Baik / Sedang / Rusak)</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F1F4F2] text-[#566A6E] text-[11px]">
                      <th className="p-2 text-left">Label</th>
                      <th className="p-2 text-center" colSpan={2}>Baik (Bgn / Rgn)</th>
                      <th className="p-2 text-center" colSpan={2}>Sedang (Bgn / Rgn)</th>
                      <th className="p-2 text-center" colSpan={2}>Rusak (Bgn / Rgn)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EDEA]">
                    {bangunanRuangan.map((b, idx) => (
                      <tr key={b.label}>
                        <td className="p-2 font-semibold text-[#13262A]">{b.label}</td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={b.baik[0] ?? ''}
                            onChange={(e) => {
                              const next = [...bangunanRuangan];
                              next[idx].baik[0] = e.target.value ? Number(e.target.value) : null;
                              setBangunanRuangan(next);
                            }}
                            className={inputCls + ' text-center'}
                            placeholder="Bgn"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={b.baik[1] ?? ''}
                            onChange={(e) => {
                              const next = [...bangunanRuangan];
                              next[idx].baik[1] = e.target.value ? Number(e.target.value) : null;
                              setBangunanRuangan(next);
                            }}
                            className={inputCls + ' text-center'}
                            placeholder="Rgn"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={b.sedang[0] ?? ''}
                            onChange={(e) => {
                              const next = [...bangunanRuangan];
                              next[idx].sedang[0] = e.target.value ? Number(e.target.value) : null;
                              setBangunanRuangan(next);
                            }}
                            className={inputCls + ' text-center'}
                            placeholder="Bgn"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={b.sedang[1] ?? ''}
                            onChange={(e) => {
                              const next = [...bangunanRuangan];
                              next[idx].sedang[1] = e.target.value ? Number(e.target.value) : null;
                              setBangunanRuangan(next);
                            }}
                            className={inputCls + ' text-center'}
                            placeholder="Rgn"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={b.rusak[0] ?? ''}
                            onChange={(e) => {
                              const next = [...bangunanRuangan];
                              next[idx].rusak[0] = e.target.value ? Number(e.target.value) : null;
                              setBangunanRuangan(next);
                            }}
                            className={inputCls + ' text-center'}
                            placeholder="Bgn"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={b.rusak[1] ?? ''}
                            onChange={(e) => {
                              const next = [...bangunanRuangan];
                              next[idx].rusak[1] = e.target.value ? Number(e.target.value) : null;
                              setBangunanRuangan(next);
                            }}
                            className={inputCls + ' text-center'}
                            placeholder="Rgn"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* C & E: Sewa, Menumpang, Air Bersih */}
              <div className="border border-[#D3DDD9] rounded-xl p-3.5 bg-white grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">C. Menyewa Perbulan (Rp)</label>
                  <input
                    value={sewaPerbulan}
                    onChange={(e) => setSewaPerbulan(e.target.value)}
                    className={inputCls}
                    placeholder="Kosongkan jika tidak ada"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Menumpang di SD</label>
                  <input
                    value={menumpang}
                    onChange={(e) => setMenumpang(e.target.value)}
                    className={inputCls}
                    placeholder="Kosongkan jika gedung sendiri"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">E. Penyediaan Air Bersih</label>
                  <input
                    value={airBersih}
                    onChange={(e) => setAirBersih(e.target.value)}
                    className={inputCls}
                    placeholder="PDAM / Sumur Bor / Pompa"
                  />
                </div>
              </div>

              {/* F. Perkakas */}
              <div className="border border-[#D3DDD9] rounded-xl p-3.5 bg-white space-y-2">
                <div className="font-bold text-xs text-[#0B6B58]">F. Perkakas Sekolah</div>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {perkakas.map((p, idx) => (
                    <div key={p.label} className="p-2.5 bg-[#FAFBFB] border border-[#E6EDEA] rounded-lg space-y-1.5">
                      <div className="font-bold text-[#13262A] text-xs truncate">{p.label}</div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[10px] text-[#566A6E] block">Baik</label>
                          <input
                            value={p.baik ?? ''}
                            onChange={(e) => {
                              const next = [...perkakas];
                              next[idx].baik = e.target.value || null;
                              setPerkakas(next);
                            }}
                            className={inputCls + ' text-center px-1'}
                            placeholder="-"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#566A6E] block">Sedang</label>
                          <input
                            value={p.sedang ?? ''}
                            onChange={(e) => {
                              const next = [...perkakas];
                              next[idx].sedang = e.target.value || null;
                              setPerkakas(next);
                            }}
                            className={inputCls + ' text-center px-1'}
                            placeholder="-"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#566A6E] block">Rusak</label>
                          <input
                            value={p.rusak ?? ''}
                            onChange={(e) => {
                              const next = [...perkakas];
                              next[idx].rusak = e.target.value || null;
                              setPerkakas(next);
                            }}
                            className={inputCls + ' text-center px-1'}
                            placeholder="-"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MURID & ABSEN */}
          {activeTab === 'murid' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="border border-[#D3DDD9] rounded-xl p-4 bg-white space-y-3">
                <div className="font-bold text-xs text-[#0B6B58]">Rekapitulasi Absensi Murid Bulan Ini</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Sakit (Hari/Orang)</label>
                    <input
                      type="number"
                      min={0}
                      value={muridSakit}
                      onChange={(e) => setMuridSakit(Number(e.target.value))}
                      className={inputCls + ' text-center font-mono font-bold'}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Izin (Hari/Orang)</label>
                    <input
                      type="number"
                      min={0}
                      value={muridIzin}
                      onChange={(e) => setMuridIzin(Number(e.target.value))}
                      className={inputCls + ' text-center font-mono font-bold'}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Alpa (Hari/Orang)</label>
                    <input
                      type="number"
                      min={0}
                      value={muridAlpa}
                      onChange={(e) => setMuridAlpa(Number(e.target.value))}
                      className={inputCls + ' text-center font-mono font-bold'}
                    />
                  </div>
                </div>
              </div>

              <div className="border border-[#D3DDD9] rounded-xl p-4 bg-white space-y-3">
                <div className="font-bold text-xs text-[#0B6B58]">Format Tabel Banyak Murid</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jumlah Rombongan per Kelas ("Bag")</label>
                    <input
                      type="number"
                      min={1}
                      value={bagPerKelas}
                      onChange={(e) => setBagPerKelas(Number(e.target.value))}
                      className={inputCls}
                    />
                    <span className="text-[10px] text-[#566A6E] mt-0.5 block">Standar adalah 2 Bag per kelas.</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jumlah Kelas Pembangunan</label>
                    <input
                      value={kelasPembangunan}
                      onChange={(e) => setKelasPembangunan(e.target.value)}
                      className={inputCls}
                      placeholder="-"
                    />
                    <span className="text-[10px] text-[#566A6E] mt-0.5 block">Kolom paling kanan pada tabel murid.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PENGESAHAN & IDENTITAS */}
          {activeTab === 'pengesahan' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="border border-[#D3DDD9] rounded-xl p-4 bg-white space-y-3">
                <div className="font-bold text-xs text-[#0B6B58]">Identitas & Status Sekolah (Header Kiri)</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tahun Pendirian SD</label>
                    <input
                      value={tahunBerdiri}
                      onChange={(e) => setTahunBerdiri(e.target.value)}
                      className={inputCls}
                      placeholder="Contoh: 1975"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Status Sekolah</label>
                    <select
                      value={statusSekolah}
                      onChange={(e) => setStatusSekolah(e.target.value)}
                      className={inputCls}
                    >
                      <option value="Negeri Biasa">a. Negeri Biasa</option>
                      <option value="Negeri Inpres">b. Negeri Inpres</option>
                      <option value="Subsidi">c. Subsidi</option>
                      <option value="Bantuan">d. Bantuan</option>
                      <option value="Swasta Penuh">e. Swasta Penuh</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Bahasa Pengantar</label>
                    <select
                      value={bahasa}
                      onChange={(e) => setBahasa(e.target.value)}
                      className={inputCls}
                    >
                      <option value="Indonesia">INDONESIA</option>
                      <option value="Sunda">SUNDA</option>
                      <option value="Jawa">JAWA</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border border-[#D3DDD9] rounded-xl p-4 bg-white space-y-3">
                <div className="font-bold text-xs text-[#0B6B58]">Tanda Tangan & Titimangsa (Bagian Bawah Halaman 2)</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Korwil */}
                  <div className="p-3 bg-[#FAFBFB] rounded-lg border border-[#E6EDEA] space-y-2">
                    <span className="font-bold text-[#13262A] text-xs block">Pejabat Korwil Bidik (Sebelah Kiri):</span>
                    <div>
                      <label className="block text-[10px] text-[#566A6E] mb-0.5">Jabatan</label>
                      <input
                        value={korwilJabatan}
                        onChange={(e) => setKorwilJabatan(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#566A6E] mb-0.5">Nama Lengkap & Gelar</label>
                      <input
                        value={korwilNama}
                        onChange={(e) => setKorwilNama(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#566A6E] mb-0.5">NIP Korwil</label>
                      <input
                        value={korwilNip}
                        onChange={(e) => setKorwilNip(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Kepala Sekolah */}
                  <div className="p-3 bg-[#FAFBFB] rounded-lg border border-[#E6EDEA] space-y-2">
                    <span className="font-bold text-[#13262A] text-xs block">Kepala Sekolah & Titimangsa (Sebelah Kanan):</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-[#566A6E] mb-0.5">Tempat Laporan</label>
                        <input
                          value={tempatLaporan}
                          onChange={(e) => setTempatLaporan(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#566A6E] mb-0.5">Tanggal Cetak Laporan</label>
                        <input
                          value={tglLaporan}
                          onChange={(e) => setTglLaporan(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#566A6E] mb-0.5">Nama Kepala Sekolah</label>
                      <input
                        value={kepsek}
                        onChange={(e) => setKepsek(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#566A6E] mb-0.5">NIP Kepala Sekolah</label>
                      <input
                        value={nipKepsek}
                        onChange={(e) => setNipKepsek(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E6EDEA] flex-none">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 border border-[#D3DDD9] hover:bg-gray-50 text-[#566A6E] rounded-lg cursor-pointer font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset ke Bawaan
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#D3DDD9] hover:bg-gray-50 text-[#566A6E] rounded-lg cursor-pointer font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Simpan Perubahan Daftar 1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
