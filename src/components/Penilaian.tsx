/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchoolConfig, Siswa, NilaiRecord, BerkasPenilaian } from '../types';
import {
  getSiswas,
  getNilaiRecords,
  saveNilaiRecord,
  getFromStorage,
  setToStorage,
  KEYS,
} from '../lib/storage';
import {
  Award,
  Save,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';

interface PenilaianProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

export const Penilaian: React.FC<PenilaianProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const [activeTab, setActiveTab] = useState<'input' | 'rekap' | 'berkas'>('input');

  const kelasOptions = (config.kelas || '1, 2, 3, 4, 5, 6')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const mapelOptions = (
    config.mapel ||
    'Pendidikan Agama, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPAS, Seni dan Budaya, PJOK, Bahasa Inggris, Muatan Lokal'
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const [selectedKelas, setSelectedKelas] = useState(kelasOptions[0] || '1');
  const [selectedSemester, setSelectedSemester] = useState(config.semester || '1');
  const [selectedTA, setSelectedTA] = useState(config.tahunAjaran || '2026/2027');
  const [selectedMapel, setSelectedMapel] = useState(mapelOptions[0] || 'Matematika');

  const [siswaList] = useState<Siswa[]>(getSiswas());
  const [nilaiList, setNilaiList] = useState<NilaiRecord[]>(getNilaiRecords());
  const [berkasList, setBerkasList] = useState<BerkasPenilaian[]>(getFromStorage(KEYS.BERKAS, []));

  // Temporary score edits: { [siswaId]: string }
  const [tempScores, setTempScores] = useState<Record<string, string>>({});
  const [isModalBerkasOpen, setIsModalBerkasOpen] = useState(false);
  const [sortByRank, setSortByRank] = useState(false);

  const reloadData = () => {
    setNilaiList(getNilaiRecords());
    setBerkasList(getFromStorage(KEYS.BERKAS, []));
  };

  const activeStudentsInClass = siswaList
    .filter((s) => s.status === 'Aktif' && s.kelas === selectedKelas)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  const getRecordId = (sId: string) =>
    `${sId}_${selectedTA.replace(/[^0-9A-Za-z]/g, '-')}_${selectedSemester}`;

  const getScoreValue = (sId: string) => {
    if (tempScores[sId] !== undefined) return tempScores[sId];
    const recId = getRecordId(sId);
    const found = nilaiList.find((r) => r.id === recId);
    return found && found.nilai && found.nilai[selectedMapel] !== undefined
      ? String(found.nilai[selectedMapel])
      : '';
  };

  const handleScoreChange = (sId: string, val: string) => {
    setTempScores((prev) => ({ ...prev, [sId]: val }));
  };

  const handleSaveScores = () => {
    activeStudentsInClass.forEach((s) => {
      if (tempScores[s.id] !== undefined) {
        const raw = tempScores[s.id].trim();
        const recId = getRecordId(s.id);
        const existing = nilaiList.find((r) => r.id === recId) || {
          id: recId,
          siswaId: s.id,
          kelas: s.kelas,
          ta: selectedTA,
          smt: selectedSemester,
          nilai: {},
        };
        const updatedNilai = { ...existing.nilai };
        if (raw === '') {
          delete updatedNilai[selectedMapel];
        } else {
          const num = Number(raw);
          if (!isNaN(num) && num >= 0 && num <= 100) {
            updatedNilai[selectedMapel] = num;
          }
        }
        saveNilaiRecord({ ...existing, nilai: updatedNilai });
      }
    });

    setTempScores({});
    reloadData();
    onToast(`Nilai ${selectedMapel} Kelas ${selectedKelas} berhasil disimpan.`);
  };

  // Matrix calculation for Rekap
  const rekapData = activeStudentsInClass.map((student) => {
    const recId = getRecordId(student.id);
    const rec = nilaiList.find((r) => r.id === recId);
    const scores = mapelOptions.map((m) =>
      rec?.nilai?.[m] !== undefined ? rec.nilai[m] : null
    );
    const validScores = scores.filter((x): x is number => x !== null);
    const avg = validScores.length
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : null;
    return {
      student,
      scores,
      avg,
    };
  });

  // Calculate ranks based on average
  const rankMap = new Map<string, number>();
  const sortedAvgs = rekapData
    .filter((r) => r.avg !== null)
    .map((r) => Math.round((r.avg as number) * 100) / 100)
    .sort((a, b) => b - a);

  rekapData.forEach((r) => {
    if (r.avg !== null) {
      const rounded = Math.round(r.avg * 100) / 100;
      rankMap.set(r.student.id, sortedAvgs.indexOf(rounded) + 1);
    }
  });

  const displayedRekap = sortByRank
    ? [...rekapData].sort(
        (a, b) => (rankMap.get(a.student.id) || 9999) - (rankMap.get(b.student.id) || 9999)
      )
    : rekapData;

  const mapelAverages = mapelOptions.map((_, mIdx) => {
    const colScores = rekapData.map((r) => r.scores[mIdx]).filter((x): x is number => x !== null);
    if (!colScores.length) return null;
    return Math.round((colScores.reduce((a, b) => a + b, 0) / colScores.length) * 10) / 10;
  });

  const exportRekapCSV = () => {
    const headers = ['Nama Siswa', 'NIS', ...mapelOptions, 'Rata-rata', 'Ranking'];
    const rows = rekapData.map((r) => [
      r.student.nama,
      r.student.nis || '-',
      ...r.scores.map((s) => (s !== null ? s : '-')),
      r.avg !== null ? r.avg.toFixed(1) : '-',
      rankMap.get(r.student.id) || '-',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers, ...rows].map((e) => e.map((x) => `"${x}"`).join(';')).join('\r\n');
    const uri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', `Rekap_Nilai_Kelas_${selectedKelas}_Smt_${selectedSemester}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast('Berkas CSV rekap nilai berhasil diunduh.');
  };

  const handleSaveBerkas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newBerkas: BerkasPenilaian = {
      id: `bp_${Date.now()}`,
      judul: String(form.get('judul')).trim(),
      jenis: String(form.get('jenis')).trim(),
      kelas: String(form.get('kelas')).trim(),
      semester: String(form.get('semester')).trim(),
      tahunAjaran: String(form.get('tahunAjaran')).trim() || config.tahunAjaran,
      keterangan: String(form.get('keterangan')).trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const current = getFromStorage<BerkasPenilaian[]>(KEYS.BERKAS, []);
    setToStorage(KEYS.BERKAS, [...current, newBerkas]);
    reloadData();
    setIsModalBerkasOpen(false);
    onToast(`Berkas "${newBerkas.judul}" berhasil disimpan.`);
  };

  const handleDeleteBerkas = (id: string, judul: string) => {
    if (window.confirm(`Hapus berkas "${judul}"?`)) {
      const current = getFromStorage<BerkasPenilaian[]>(KEYS.BERKAS, []);
      setToStorage(KEYS.BERKAS, current.filter((b) => b.id !== id));
      reloadData();
      onToast(`Berkas "${judul}" dihapus.`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Penilaian & Pengelolaan Rapor
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Input nilai capaian kompetensi per mata pelajaran, rekapitulasi kelas otomatis, dan arsip berkas penilaian.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 bg-[#E8EFEC] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'input' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Input Nilai
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rekap')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'rekap' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Rekap Kelas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('berkas')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'berkas' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Berkas & Rapor ({berkasList.length})
          </button>
        </div>
      </div>

      {/* Filter / Selector Bar */}
      {activeTab !== 'berkas' && (
        <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#566A6E]">Kelas:</span>
              <select
                value={selectedKelas}
                onChange={(e) => {
                  setSelectedKelas(e.target.value);
                  setTempScores({});
                }}
                className="text-xs px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-bold text-[#0B6B58]"
              >
                {kelasOptions.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#566A6E]">Semester:</span>
              <select
                value={selectedSemester}
                onChange={(e) => {
                  setSelectedSemester(e.target.value);
                  setTempScores({});
                }}
                className="text-xs px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>

            {activeTab === 'input' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#566A6E]">Mata Pelajaran:</span>
                <select
                  value={selectedMapel}
                  onChange={(e) => {
                    setSelectedMapel(e.target.value);
                    setTempScores({});
                  }}
                  className="text-xs px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-semibold text-[#13262A]"
                >
                  {mapelOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#566A6E] px-2 py-1 rounded bg-[#F1F4F2] border border-[#D3DDD9]">
              KKM / Batas: <b className="text-[#0B6B58]">{config.kkm}</b>
            </span>

            {activeTab === 'rekap' && (
              <>
                <button
                  type="button"
                  onClick={() => setSortByRank(!sortByRank)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                    sortByRank
                      ? 'bg-[#0B6B58] text-white border-[#0B6B58]'
                      : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-[#E8EFEC]'
                  }`}
                >
                  {sortByRank ? 'Urut: Ranking' : 'Urut: Abjad'}
                </button>
                <button
                  type="button"
                  onClick={exportRekapCSV}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh CSV
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: INPUT NILAI */}
      {activeTab === 'input' && (
        <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#D3DDD9] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#13262A] font-display">
                Input Nilai {selectedMapel} &middot; Kelas {selectedKelas} ({activeStudentsInClass.length} Siswa Aktif)
              </h2>
              <p className="text-xs text-[#566A6E]">
                Masukkan nilai angka 0 - 100. Nilai di bawah KKM ({config.kkm}) otomatis ditandai.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveScores}
              className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Save className="w-4 h-4" /> Simpan Nilai
            </button>
          </div>

          {activeStudentsInClass.length === 0 ? (
            <div className="p-8 text-center text-[#566A6E]">
              <p className="font-semibold text-sm">Tidak ada siswa aktif di Kelas {selectedKelas}</p>
              <p className="text-xs mt-1">Pilih kelas lain atau tambahkan siswa baru di Data Siswa.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-12 text-center">No</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama Lengkap Siswa</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">NIS</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-36 text-center">
                      Nilai {selectedMapel}
                    </th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-32 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {activeStudentsInClass.map((s, idx) => {
                    const val = getScoreValue(s.id);
                    const numVal = val !== '' ? Number(val) : null;
                    const isBelowKkm = numVal !== null && numVal < config.kkm;

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4 text-center text-[#566A6E] font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-[#13262A]">{s.nama}</td>
                        <td className="py-3 px-4 text-[#566A6E] font-mono">{s.nis || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={val}
                            onChange={(e) => handleScoreChange(s.id, e.target.value)}
                            placeholder="0-100"
                            className={`w-24 px-2.5 py-1.5 text-center text-xs font-mono font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#0B6B58] ${
                              isBelowKkm
                                ? 'bg-[#FBEFD0] border-amber-400 text-amber-900'
                                : 'bg-white border-[#D3DDD9] text-[#13262A]'
                            }`}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          {numVal !== null ? (
                            isBelowKkm ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FBEFD0] text-[#8F5B00]">
                                Belum Tuntas
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#DDF1E3] text-[#1D7A3A]">
                                Tuntas
                              </span>
                            )
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Belum diisi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REKAP KELAS */}
      {activeTab === 'rekap' && (
        <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#D3DDD9]">
            <h2 className="text-sm font-bold text-[#13262A] font-display">
              Tabel Rekapitulasi Nilai Seluruh Mata Pelajaran &middot; Kelas {selectedKelas}
            </h2>
            <p className="text-xs text-[#566A6E]">
              Rata-rata per siswa dan rata-rata kelas dihitung otomatis secara transparan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[10px] font-semibold">
                  <th className="py-2.5 px-3 border-b border-[#D3DDD9] whitespace-nowrap">Nama Siswa</th>
                  <th className="py-2.5 px-2 border-b border-[#D3DDD9] whitespace-nowrap text-center">NIS</th>
                  {mapelOptions.map((m) => (
                    <th key={m} className="py-2.5 px-2 border-b border-[#D3DDD9] text-center whitespace-nowrap" title={m}>
                      {m.length > 8 ? `${m.slice(0, 8)}..` : m}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 border-b border-[#D3DDD9] text-center font-bold text-[#0B6B58] whitespace-nowrap">
                    Rata-rata
                  </th>
                  <th className="py-2.5 px-3 border-b border-[#D3DDD9] text-center font-bold text-[#0B6B58] whitespace-nowrap">
                    Ranking
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D3DDD9]">
                {displayedRekap.map((r) => (
                  <tr key={r.student.id} className="hover:bg-gray-50/80">
                    <td className="py-2.5 px-3 font-semibold text-[#13262A] whitespace-nowrap">
                      {r.student.nama}
                    </td>
                    <td className="py-2.5 px-2 text-center text-[#566A6E] font-mono whitespace-nowrap">
                      {r.student.nis || '-'}
                    </td>
                    {r.scores.map((sc, mIdx) => {
                      const isBelow = sc !== null && sc < config.kkm;
                      return (
                        <td
                          key={mIdx}
                          className={`py-2.5 px-2 text-center font-mono font-medium whitespace-nowrap ${
                            isBelow ? 'bg-[#FBEFD0] text-[#8F5B00] font-bold' : ''
                          }`}
                        >
                          {sc !== null ? sc : '-'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#0B6B58] bg-[#E8EFEC]/50 whitespace-nowrap">
                      {r.avg !== null ? r.avg.toFixed(1) : '-'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-center font-mono font-extrabold whitespace-nowrap ${
                        rankMap.get(r.student.id) === 1
                          ? 'bg-[#FBEFD0] text-[#8F5B00]'
                          : (rankMap.get(r.student.id) || 99) <= 3
                          ? 'bg-[#DDF1E3] text-[#1D7A3A]'
                          : 'text-[#13262A]'
                      }`}
                    >
                      {rankMap.get(r.student.id) || '-'}
                    </td>
                  </tr>
                ))}

                <tr className="bg-[#E8EFEC] font-bold text-[#13262A] border-t-2 border-[#D3DDD9]">
                  <td colSpan={2} className="py-3 px-3 text-right">
                    Rata-rata Kelas :
                  </td>
                  {mapelAverages.map((avg, mIdx) => (
                    <td key={mIdx} className="py-3 px-2 text-center font-mono">
                      {avg !== null ? avg : '-'}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center font-mono text-[#0B6B58]">-</td>
                  <td className="py-3 px-3 text-center font-mono">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BERKAS & RAPOR */}
      {activeTab === 'berkas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#566A6E]">
              Arsip berkas blangko rapor kurikulum merdeka, leger nilai, dan dokumen pendukung asesmen.
            </p>
            <button
              type="button"
              onClick={() => setIsModalBerkasOpen(true)}
              className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Berkas
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {berkasList.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-[#D3DDD9] rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DAEEE7] text-[#0B6B58]">
                      {b.jenis}
                    </span>
                    {isOperator && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBerkas(b.id, b.judul)}
                        className="text-gray-400 hover:text-rose-600 transition cursor-pointer"
                        title="Hapus berkas"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <h3 className="font-bold text-[#13262A] text-sm mt-2 font-display">{b.judul}</h3>
                  <p className="text-xs text-[#566A6E] mt-1 line-clamp-2">
                    {b.keterangan || 'Berkas asesmen penilaian sekolah.'}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#D3DDD9] flex items-center justify-between text-xs text-[#566A6E]">
                  <span>
                    Kelas {b.kelas} &middot; Smt {b.semester}
                  </span>
                  <span className="font-mono text-[11px]">{b.tahunAjaran}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH BERKAS */}
      {isModalBerkasOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-[#D3DDD9] max-w-md w-full p-6 space-y-4 my-6">
            <h3 className="text-base font-bold text-[#13262A] font-display">Tambah Berkas Penilaian / Rapor</h3>
            <form onSubmit={handleSaveBerkas} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Judul Berkas *</label>
                <input
                  name="judul"
                  required
                  placeholder="Contoh: Leger Nilai Sumatif Kelas 4"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jenis</label>
                  <select name="jenis" className="w-full px-3 py-2 border rounded-lg">
                    <option value="Rapor">Rapor</option>
                    <option value="Leger nilai">Leger nilai</option>
                    <option value="Daftar nilai">Daftar nilai</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Kelas</label>
                  <select name="kelas" className="w-full px-3 py-2 border rounded-lg">
                    <option value="Semua">Semua Kelas</option>
                    {kelasOptions.map((k) => (
                      <option key={k} value={k}>
                        Kelas {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Semester</label>
                  <select name="semester" defaultValue={config.semester} className="w-full px-3 py-2 border rounded-lg">
                    <option value="1">1 (Ganjil)</option>
                    <option value="2">2 (Genap)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Tahun Ajaran</label>
                  <input
                    name="tahunAjaran"
                    defaultValue={config.tahunAjaran}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Keterangan</label>
                <textarea name="keterangan" rows={2} className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D3DDD9]">
                <button
                  type="button"
                  onClick={() => setIsModalBerkasOpen(false)}
                  className="px-4 py-2 border rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] text-white font-semibold rounded-lg cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
