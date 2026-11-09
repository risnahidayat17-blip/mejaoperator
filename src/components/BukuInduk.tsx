/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchoolConfig } from '../types';
import { getSiswas, getNilaiRecords } from '../lib/storage';
import { KopSuratHD } from './KopSuratHD';
import { BookOpen, Search, Printer, FileSpreadsheet } from 'lucide-react';
import { ImportDapodikSiswaModal } from './ImportDapodikSiswaModal';

interface BukuIndukProps {
  config: SchoolConfig;
  role?: 'operator' | 'guru';
  onToast?: (msg: string, isError?: boolean) => void;
}

export const BukuInduk: React.FC<BukuIndukProps> = ({ config, role = 'operator', onToast }) => {
  const [siswaList, setSiswaList] = useState(getSiswas());
  const [nilaiList] = useState(getNilaiRecords());
  const [isImportDapodikOpen, setIsImportDapodikOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>(siswaList[0]?.id || '');

  const kelasList = (config.kelas || '1, 2, 3, 4, 5, 6')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const mapelList = (
    config.mapel ||
    'Pendidikan Agama, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPAS, Seni dan Budaya, PJOK, Bahasa Inggris, Muatan Lokal'
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const filtered = siswaList.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      s.nama.toLowerCase().includes(term) ||
      (s.nis && s.nis.includes(term)) ||
      (s.nisn && s.nisn.includes(term));
    const matchKelas = !filterKelas || s.kelas === filterKelas;
    return matchTerm && matchKelas;
  });

  const currentSiswa = siswaList.find((s) => s.id === selectedSiswaId) || filtered[0];
  const siswaNilai = currentSiswa ? nilaiList.filter((n) => n.siswaId === currentSiswa.id) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Buku Induk Register Siswa
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Lembar rekam jejak lengkap peserta didik: identitas diri, data orang tua, serta riwayat nilai berkala dengan Kop Surat HD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportDapodikOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-[#E6F2EE] hover:bg-[#d8e9e4] text-[#0B6B58] border border-[#B8D7CD] rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Impor profil peserta didik dari berkas Dapodik (.xlsx, .xls, .csv)"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0B6B58]" /> Impor Data PD Dapodik
          </button>

          {currentSiswa && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak Lembar Buku Induk
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-4 bg-white border border-[#D3DDD9] rounded-xl p-4 shadow-xs space-y-3">
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari siswa atau NIS..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg"
              />
            </div>

            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 max-h-[65vh] overflow-y-auto divide-y divide-gray-100">
            {filtered.map((s) => {
              const isSelected = currentSiswa?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSiswaId(s.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#DAEEE7] text-[#0B6B58] font-bold shadow-2xs'
                      : 'hover:bg-gray-50 text-[#13262A]'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate">{s.nama}</div>
                    <div className="text-[10px] font-mono text-[#566A6E]">
                      NIS {s.nis || '-'} &middot; Kelas {s.kelas}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      s.status === 'Aktif' ? 'bg-[#DDF1E3] text-[#1D7A3A]' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {s.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Printable Folio */}
        <div className="lg:col-span-8 bg-white border border-[#D3DDD9] rounded-xl p-8 shadow-xs select-text print-sheet">
          {currentSiswa ? (
            <div className="space-y-6">
              <KopSuratHD config={config} />

              <div className="text-center font-bold text-sm tracking-wider uppercase underline pb-2">
                LEMBAR BUKU INDUK REGISTER SISWA
              </div>

              {/* Section A */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 border border-black mb-2">
                  A. IDENTITAS PESERTA DIDIK
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Nama Lengkap:</span>
                    <span className="font-bold">{currentSiswa.nama}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Nomor Induk Siswa (NIS):</span>
                    <span className="font-mono font-semibold">{currentSiswa.nis || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">NISN:</span>
                    <span className="font-mono font-semibold">{currentSiswa.nisn || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Jenis Kelamin:</span>
                    <span>{currentSiswa.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Tempat, Tanggal Lahir:</span>
                    <span>
                      {currentSiswa.tempatLahir || '-'}, {currentSiswa.tglLahir || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Agama:</span>
                    <span>{currentSiswa.agama || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Kewarganegaraan:</span>
                    <span>{currentSiswa.warga || 'Indonesia'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Tahun Masuk / Kelas:</span>
                    <span className="font-semibold">
                      {currentSiswa.tahunMasuk || 2026} / Kelas {currentSiswa.kelas}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Alamat Tempat Tinggal:</span>
                    <span className="text-right font-medium">{currentSiswa.alamat || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section B */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 border border-black mb-2">
                  B. DATA ORANG TUA / WALI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Nama Ayah Kandung:</span>
                    <span className="font-semibold">{currentSiswa.namaAyah || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Nama Ibu Kandung:</span>
                    <span className="font-semibold">{currentSiswa.namaIbu || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Nomor Telepon Orang Tua:</span>
                    <span className="font-mono">{currentSiswa.telpOrtu || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 py-1">
                    <span className="text-gray-600">Status Siswa:</span>
                    <span className="font-bold text-[#0B6B58]">{currentSiswa.status}</span>
                  </div>
                </div>
              </div>

              {/* Section C: Marks */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 border border-black mb-2">
                  C. RIWAYAT CAPAIAN NILAI RAPOR
                </h3>
                {siswaNilai.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3">
                    Belum ada nilai yang terinput untuk siswa ini di menu Penilaian.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse border border-black">
                      <thead>
                        <tr className="bg-gray-100 text-center font-bold">
                          <th className="border border-black p-2">Tahun Ajaran</th>
                          <th className="border border-black p-2 w-16">Smt</th>
                          <th className="border border-black p-2 w-20">Kelas</th>
                          {mapelList.map((m) => (
                            <th key={m} className="border border-black p-2 text-center" title={m}>
                              {m.length > 8 ? `${m.slice(0, 8)}..` : m}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {siswaNilai.map((rec) => (
                          <tr key={rec.id} className="text-center">
                            <td className="border border-black p-2 font-mono">{rec.ta}</td>
                            <td className="border border-black p-2 font-mono">{rec.smt}</td>
                            <td className="border border-black p-2 font-bold">{rec.kelas}</td>
                            {mapelList.map((m) => (
                              <td key={m} className="border border-black p-2 font-mono">
                                {rec.nilai && rec.nilai[m] !== undefined ? rec.nilai[m] : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Signature */}
              <div className="flex justify-end pt-4">
                <div className="text-center w-64 text-xs">
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
          ) : (
            <div className="text-center text-gray-500 py-12">
              <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              Pilih siswa di sebelah kiri untuk melihat buku induk.
            </div>
          )}
        </div>
      </div>

      {/* MODAL IMPOR DATA PD DAPODIK */}
      <ImportDapodikSiswaModal
        role={role}
        config={config}
        isOpen={isImportDapodikOpen}
        onClose={() => setIsImportDapodikOpen(false)}
        onToast={onToast || ((msg) => console.log(msg))}
        onSuccess={(res, count) => {
          const fresh = getSiswas();
          setSiswaList(fresh);
          if (fresh.length > 0 && !selectedSiswaId) {
            setSelectedSiswaId(fresh[0].id);
          }
          let msg = `Berhasil mengimpor ${count} data Dapodik: ${res.added} siswa baru ditambahkan`;
          if (res.updated > 0) msg += `, ${res.updated} data diperbarui`;
          if (res.skipped > 0) msg += `, ${res.skipped} dilewati`;
          if (onToast) onToast(msg + '.');
        }}
      />
    </div>
  );
};
