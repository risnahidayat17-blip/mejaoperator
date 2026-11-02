/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchoolConfig, Siswa, Guru, LaporanBulan as ILaporanBulan } from '../types';
import { getFromStorage, setToStorage, KEYS } from '../lib/storage';
import { KopSuratHD } from './KopSuratHD';
import { Printer, Pencil, X } from 'lucide-react';

interface LaporanBulanProps {
  config: SchoolConfig;
  siswa: Siswa[];
  guru: Guru[];
  onToast: (msg: string, isError?: boolean) => void;
}

export const LaporanBulan: React.FC<LaporanBulanProps> = ({
  config,
  siswa,
  guru,
  onToast,
}) => {
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [isModalAbsenOpen, setIsModalAbsenOpen] = useState(false);

  const laporanList = getFromStorage<ILaporanBulan[]>(KEYS.LAPORAN, []);
  const reportData = laporanList.find((l) => l.id === selectedMonth) || { id: selectedMonth };

  const activeSiswa = siswa.filter((s) => s.status === 'Aktif');
  const activeGuru = guru.filter((g) => g.status !== 'Nonaktif');

  const rombelList = ['1', '2', '3', '4', '5', '6'];
  const rombelStats = rombelList.map((k) => {
    const list = activeSiswa.filter((s) => s.kelas === k);
    return {
      kelas: k,
      L: list.filter((s) => s.jk === 'L').length,
      P: list.filter((s) => s.jk === 'P').length,
      total: list.length,
    };
  });

  const totalL = rombelStats.reduce((acc, curr) => acc + curr.L, 0);
  const totalP = rombelStats.reduce((acc, curr) => acc + curr.P, 0);
  const grandTotal = totalL + totalP;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAbsen = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const mSakit = Number(form.get('m_sakit')) || 0;
    const mIzin = Number(form.get('m_izin')) || 0;
    const mAlpa = Number(form.get('m_alpa')) || 0;

    const guruAbsen: Record<string, { s?: number; i?: number; a?: number }> = {};
    activeGuru.forEach((g) => {
      guruAbsen[g.id] = {
        s: Number(form.get(`g_${g.id}_s`)) || 0,
        i: Number(form.get(`g_${g.id}_i`)) || 0,
        a: Number(form.get(`g_${g.id}_a`)) || 0,
      };
    });

    const updatedReport: ILaporanBulan = {
      id: selectedMonth,
      murid: { sakit: mSakit, izin: mIzin, alpa: mAlpa },
      absen: guruAbsen,
      updatedAt: Date.now(),
    };

    const currentList = getFromStorage<ILaporanBulan[]>(KEYS.LAPORAN, []);
    const idx = currentList.findIndex((l) => l.id === selectedMonth);
    if (idx >= 0) {
      currentList[idx] = updatedReport;
    } else {
      currentList.push(updatedReport);
    }
    setToStorage(KEYS.LAPORAN, currentList);
    setIsModalAbsenOpen(false);
    onToast(`Data absensi bulan ${selectedMonth} berhasil disimpan.`);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Laporan Bulan (Daftar 1) Resmi
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Format laporan bulanan resmi Kemdikbud / Dinas Pendidikan: statistik murid, sarana, dan roster kepegawaian GTK.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-bold"
          />
          <button
            type="button"
            onClick={() => setIsModalAbsenOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" /> Isi Absen Bulan Ini
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak Daftar 1
          </button>
        </div>
      </div>

      {/* Sheet view */}
      <div className="bg-white border border-[#D3DDD9] rounded-xl p-8 shadow-xs text-black text-xs font-sans leading-tight select-text space-y-6 print-sheet">
        <KopSuratHD config={config} />

        {/* Title Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4 border-b-2 border-black">
          <div className="md:col-span-4 border border-black p-3 text-center flex flex-col justify-center">
            <div className="font-bold tracking-widest text-sm">D A F T A R : 1</div>
            <div className="font-bold tracking-widest text-xs mt-1">B U L A N :</div>
            <div className="font-mono font-bold text-sm text-[#0B6B58] mt-1 uppercase">
              {new Date(`${selectedMonth}-01`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="md:col-span-8 border border-black p-3 space-y-1">
            <div className="text-base font-bold font-serif uppercase tracking-wider text-center border-b border-black pb-1">
              {config.namaSekolah || 'SD NEGERI 2 CEMPAKA'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                Status: <b>{config.statusSekolah || 'Negeri Biasa'}</b>
              </div>
              <div>
                NSS / NPSN: <b>{config.nss || '-'} / {config.npsn || '-'}</b>
              </div>
              <div>
                Tahun Berdiri: <b>{config.tahunBerdiri || '1975'}</b>
              </div>
              <div>
                Bahasa: <b>{config.bahasa || 'Indonesia'}</b>
              </div>
              <div className="col-span-2">
                Alamat: <b>{config.alamat}</b>, {config.kecamatan}, {config.kabupaten}
              </div>
            </div>
          </div>
        </div>

        {/* Many Students Table */}
        <div>
          <div className="text-center font-bold tracking-widest text-xs uppercase bg-gray-100 p-1.5 border border-black border-b-0">
            B A N Y A K &nbsp; M U R I D
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border border-black text-xs">
              <thead>
                <tr className="bg-gray-100 font-bold">
                  <th rowSpan={2} className="border border-black p-2 w-36 text-left">
                    Keterangan
                  </th>
                  {rombelList.map((k) => (
                    <th key={k} colSpan={2} className="border border-black p-1">
                      Kelas {k}
                    </th>
                  ))}
                  <th colSpan={2} className="border border-black p-1 bg-emerald-50">
                    Jumlah
                  </th>
                  <th rowSpan={2} className="border border-black p-2 bg-emerald-100 font-bold">
                    Total Murid
                  </th>
                </tr>
                <tr className="bg-gray-50 text-[11px]">
                  {rombelList.map((k) => (
                    <React.Fragment key={k}>
                      <th className="border border-black p-1">L</th>
                      <th className="border border-black p-1">P</th>
                    </React.Fragment>
                  ))}
                  <th className="border border-black p-1 bg-emerald-50">L</th>
                  <th className="border border-black p-1 bg-emerald-50">P</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 text-left font-semibold">Penghabisan Bulan Ini</td>
                  {rombelStats.map((st) => (
                    <React.Fragment key={st.kelas}>
                      <td className="border border-black p-1 font-mono">{st.L}</td>
                      <td className="border border-black p-1 font-mono">{st.P}</td>
                    </React.Fragment>
                  ))}
                  <td className="border border-black p-1 font-mono font-bold bg-emerald-50">{totalL}</td>
                  <td className="border border-black p-1 font-mono font-bold bg-emerald-50">{totalP}</td>
                  <td className="border border-black p-2 font-mono font-extrabold text-sm bg-emerald-100 text-[#0B6B58]">
                    {grandTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4 Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
          <div className="border border-black p-3 space-y-2">
            <div className="font-bold border-b border-black pb-1">A. TANAH & PEKARANGAN</div>
            <div>
              Luas Pekarangan: <b>3.920 m&sup2;</b>
            </div>
            <div>
              Status Tanah: <b>Pemerintah Daerah (Hak Pakai)</b>
            </div>
            <div>
              No. Persil: <b>42</b>
            </div>
          </div>

          <div className="border border-black p-3 space-y-2">
            <div className="font-bold border-b border-black pb-1">B. BANGUNAN RUANGAN</div>
            <div>
              Ruang Kelas: <b>6 Ruang (Baik)</b>
            </div>
            <div>
              Ruang Kepala Sekolah & Guru: <b>1 Ruang (Baik)</b>
            </div>
            <div>
              Penyediaan Air Bersih: <b>PDAM</b>
            </div>
          </div>

          <div className="border border-black p-3 space-y-2">
            <div className="font-bold border-b border-black pb-1">G. ABSEN MURID BULAN INI</div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-1 bg-gray-100 rounded">
                Sakit: <b>{reportData.murid?.sakit || 4} orang</b>
              </div>
              <div className="p-1 bg-gray-100 rounded">
                Izin: <b>{reportData.murid?.izin || 2} orang</b>
              </div>
              <div className="p-1 bg-gray-100 rounded">
                Alpa: <b>{reportData.murid?.alpa || 1} orang</b>
              </div>
            </div>
          </div>

          <div className="border border-black p-3 space-y-2">
            <div className="font-bold border-b border-black pb-1">H. JUMLAH GURU & PEGAWAI</div>
            <div>
              Total GTK Aktif: <b>{activeGuru.length} orang</b>
            </div>
            <div>
              PNS: <b>{activeGuru.filter((g) => g.statusPeg === 'PNS').length}</b> &middot; PPPK:{' '}
              <b>{activeGuru.filter((g) => g.statusPeg === 'PPPK').length}</b> &middot; Honorer:{' '}
              <b>{activeGuru.filter((g) => g.statusPeg.includes('Honor')).length}</b>
            </div>
          </div>
        </div>

        {/* Page 2 Separator */}
        <div className="border-t-2 border-dashed border-gray-400 my-6 pt-6 text-center text-xs text-gray-500">
          --- HALAMAN 2: DAFTAR GURU & PEGAWAI ---
        </div>

        {/* Teacher Roster */}
        <div>
          <div className="text-center font-bold tracking-widest text-xs uppercase bg-gray-100 p-1.5 border border-black border-b-0">
            D A F T A R &nbsp; G U R U &nbsp; D A N &nbsp; P E G A W A I
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-gray-100 font-bold text-center">
                  <th className="border border-black p-1 w-8">No</th>
                  <th className="border border-black p-1">Nama & NIP</th>
                  <th className="border border-black p-1 w-10">L/P</th>
                  <th className="border border-black p-1">Jabatan / Mengajar</th>
                  <th className="border border-black p-1">Status</th>
                  <th className="border border-black p-1">Pangkat/Gol</th>
                  <th className="border border-black p-1 w-20">Absen (S/I/A)</th>
                </tr>
              </thead>
              <tbody>
                {activeGuru.map((g, idx) => {
                  const absen = reportData.absen?.[g.id] || {};
                  return (
                    <tr key={g.id}>
                      <td className="border border-black p-1 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-1">
                        <b>{g.nama}</b>
                        <div className="text-[10px] text-gray-600 font-mono">{g.nip || 'Non-NIP'}</div>
                      </td>
                      <td className="border border-black p-1 text-center">{g.jk}</td>
                      <td className="border border-black p-1">
                        {g.jabatan} ({g.mengampu || '-'})
                      </td>
                      <td className="border border-black p-1 text-center">{g.statusPeg}</td>
                      <td className="border border-black p-1 text-center">{g.golongan || '-'}</td>
                      <td className="border border-black p-1 text-center font-mono">
                        {absen.s || 0} / {absen.i || 0} / {absen.a || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex justify-between items-end pt-8 text-xs">
          <div className="text-center w-64">
            <div>Mengetahui,</div>
            <div>{config.korwilJabatan || 'Korwil Bidang Pendidikan'}</div>
            <div className="h-16" />
            <div className="font-bold underline">{config.korwilNama || 'KASMAR, S.Pd. MM.H.'}</div>
            <div>NIP. {config.korwilNip || '19710812 199903 1 006'}</div>
          </div>
          <div className="text-center w-64">
            <div>
              {config.tempatLaporan || config.kabupaten},{' '}
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div>Kepala Sekolah,</div>
            <div className="h-16" />
            <div className="font-bold underline">{config.kepsek}</div>
            <div>NIP. {config.nipKepsek}</div>
          </div>
        </div>
      </div>

      {/* ABSEN INPUT MODAL */}
      {isModalAbsenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-4 my-6">
            <div className="flex items-center justify-between pb-2 border-b border-[#D3DDD9]">
              <h3 className="text-base font-bold text-[#13262A] font-display">
                Isi Rekap Absensi Bulan {selectedMonth}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalAbsenOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAbsen} className="space-y-4 text-xs">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <span className="font-bold text-gray-800 block">Absensi Murid (Hari/Orang):</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Sakit</label>
                    <input
                      type="number"
                      name="m_sakit"
                      defaultValue={reportData.murid?.sakit || 4}
                      className="w-full px-2 py-1 border rounded font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Izin</label>
                    <input
                      type="number"
                      name="m_izin"
                      defaultValue={reportData.murid?.izin || 2}
                      className="w-full px-2 py-1 border rounded font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Alpa</label>
                    <input
                      type="number"
                      name="m_alpa"
                      defaultValue={reportData.murid?.alpa || 1}
                      className="w-full px-2 py-1 border rounded font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-gray-800 block mb-2">
                  Absensi Guru (Sakit / Izin / Alpa):
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {activeGuru.map((g) => {
                    const ab = reportData.absen?.[g.id] || {};
                    return (
                      <div key={g.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded">
                        <span className="truncate font-semibold text-[#13262A] w-40">{g.nama}</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            name={`g_${g.id}_s`}
                            defaultValue={ab.s || 0}
                            title="Sakit"
                            className="w-12 px-1 py-0.5 text-center border rounded font-mono"
                          />
                          <input
                            type="number"
                            name={`g_${g.id}_i`}
                            defaultValue={ab.i || 0}
                            title="Izin"
                            className="w-12 px-1 py-0.5 text-center border rounded font-mono"
                          />
                          <input
                            type="number"
                            name={`g_${g.id}_a`}
                            defaultValue={ab.a || 0}
                            title="Alpa"
                            className="w-12 px-1 py-0.5 text-center border rounded font-mono"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalAbsenOpen(false)}
                  className="px-4 py-2 border rounded text-gray-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] text-white font-semibold rounded cursor-pointer"
                >
                  Simpan Absensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
