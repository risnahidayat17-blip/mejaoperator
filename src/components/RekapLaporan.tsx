/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchoolConfig, Siswa, Guru, Aset } from '../types';
import { KopSuratHD } from './KopSuratHD';
import {
  Users,
  GraduationCap,
  Package,
  CheckCircle2,
  Download,
  Printer,
} from 'lucide-react';

interface RekapLaporanProps {
  role?: 'operator' | 'guru';
  config: SchoolConfig;
  siswa: Siswa[];
  guru: Guru[];
  aset: Aset[];
  onToast: (msg: string, isError?: boolean) => void;
}

export const RekapLaporan: React.FC<RekapLaporanProps> = ({
  config,
  siswa,
  guru,
  aset,
  onToast,
}) => {
  const [tab, setTab] = useState<'siswa' | 'guru' | 'aset' | 'lengkap'>('siswa');

  const activeSiswa = siswa.filter((s) => s.status === 'Aktif');
  const activeGuru = guru.filter((g) => g.status !== 'Nonaktif');
  const kelasList = (config.kelas || '1, 2, 3, 4, 5, 6')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    const fileName = `Laporan_${tab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (tab === 'siswa') {
      headers = ['Kelas', 'Laki-laki', 'Perempuan', 'Total'];
      rows = kelasList.map((k) => {
        const inClass = activeSiswa.filter((s) => s.kelas === k);
        const lCount = inClass.filter((s) => s.jk === 'L').length;
        const pCount = inClass.filter((s) => s.jk === 'P').length;
        return [`Kelas ${k}`, lCount, pCount, lCount + pCount];
      });
    } else if (tab === 'guru') {
      headers = ['No', 'Nama Guru', 'NIP', 'NUPTK', 'Jabatan', 'Status', 'Mengampu'];
      rows = activeGuru.map((g, idx) => [
        idx + 1,
        g.nama,
        g.nip || '-',
        g.nuptk || '-',
        g.jabatan,
        g.statusPeg,
        g.mengampu || '-',
      ]);
    } else if (tab === 'aset') {
      headers = ['Nama Barang', 'Kode', 'Kategori', 'Unit', 'Kondisi', 'Lokasi'];
      rows = aset.map((a) => [a.nama, a.kode || '-', a.kategori, a.jumlah, a.kondisi, a.lokasi || '-']);
    } else {
      headers = ['Indikator Pemeriksaan', 'Status Kelengkapan', 'Keterangan'];
      rows = [
        ['Siswa Tanpa NISN', activeSiswa.filter((s) => !s.nisn).length, 'Perlu diinput'],
        ['Siswa Tanpa Tgl Lahir / Alamat', activeSiswa.filter((s) => !s.tglLahir || !s.alamat).length, 'Perlu dilengkapi'],
        ['Guru Tanpa NUPTK', activeGuru.filter((g) => !g.nuptk && (g.jabatan || '').includes('Guru')).length, 'Perlu verifikasi Dapodik'],
      ];
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers, ...rows].map((e) => e.map((x) => `"${x}"`).join(';')).join('\r\n');
    const uri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onToast(`Laporan ${tab} berhasil diunduh dalam format CSV.`);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Rekapitulasi Laporan Administrasi
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            Unduh data rekap kesiswaan, kepegawaian GTK, inventaris sarana prasarana, dan evaluasi data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Unduh CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak Laporan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setTab('siswa')}
          className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            tab === 'siswa'
              ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-xs'
              : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-gray-50'
          }`}
        >
          <Users className="w-5 h-5 shrink-0" />
          <div className="truncate">
            <div className="font-bold text-xs">Rekap Siswa</div>
            <div className={`text-[10px] ${tab === 'siswa' ? 'text-white/80' : 'text-gray-500'}`}>
              Per kelas & jenis kelamin
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTab('guru')}
          className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            tab === 'guru'
              ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-xs'
              : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-gray-50'
          }`}
        >
          <GraduationCap className="w-5 h-5 shrink-0" />
          <div className="truncate">
            <div className="font-bold text-xs">Rekap Guru & Tendik</div>
            <div className={`text-[10px] ${tab === 'guru' ? 'text-white/80' : 'text-gray-500'}`}>
              Status & kepegawaian
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTab('aset')}
          className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            tab === 'aset'
              ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-xs'
              : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-gray-50'
          }`}
        >
          <Package className="w-5 h-5 shrink-0" />
          <div className="truncate">
            <div className="font-bold text-xs">Rekap Aset KIB</div>
            <div className={`text-[10px] ${tab === 'aset' ? 'text-white/80' : 'text-gray-500'}`}>
              Kondisi & total unit
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTab('lengkap')}
          className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
            tab === 'lengkap'
              ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-xs'
              : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="truncate">
            <div className="font-bold text-xs">Uji Kelengkapan</div>
            <div className={`text-[10px] ${tab === 'lengkap' ? 'text-white/80' : 'text-gray-500'}`}>
              Validasi data kosong
            </div>
          </div>
        </button>
      </div>

      {/* Sheet Content */}
      <div className="bg-white border border-[#D3DDD9] rounded-xl p-8 shadow-xs select-text print-sheet">
        <KopSuratHD config={config} />

        <div className="text-center pb-4 border-b border-black mb-5">
          <h2 className="text-base font-bold font-serif uppercase tracking-wider">
            {tab === 'siswa' && 'REKAPITULASI PESERTA DIDIK PER KELAS'}
            {tab === 'guru' && 'DAFTAR REKAPITULASI GURU DAN TENAGA KEPENDIDIKAN'}
            {tab === 'aset' && 'REKAPITULASI ASET DAN SARANA PRASARANA'}
            {tab === 'lengkap' && 'EVALUASI KELENGKAPAN DATA POKOK SEKOLAH'}
          </h2>
          <div className="text-xs font-semibold uppercase">{config.namaSekolah}</div>
          <div className="text-[11px] text-gray-600">
            Tahun Ajaran {config.tahunAjaran} &middot; Semester {config.semester}
          </div>
        </div>

        {tab === 'siswa' && (
          <table className="w-full text-left text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 text-center font-bold">
                <th className="border border-black p-2">Kelas</th>
                <th className="border border-black p-2 w-32">Laki-laki (L)</th>
                <th className="border border-black p-2 w-32">Perempuan (P)</th>
                <th className="border border-black p-2 w-32 bg-emerald-50">Total Siswa</th>
              </tr>
            </thead>
            <tbody>
              {kelasList.map((k) => {
                const list = activeSiswa.filter((s) => s.kelas === k);
                const lCount = list.filter((s) => s.jk === 'L').length;
                const pCount = list.filter((s) => s.jk === 'P').length;
                return (
                  <tr key={k} className="text-center">
                    <td className="border border-black p-2 font-bold text-left pl-4">Kelas {k}</td>
                    <td className="border border-black p-2 font-mono">{lCount}</td>
                    <td className="border border-black p-2 font-mono">{pCount}</td>
                    <td className="border border-black p-2 font-mono font-bold bg-emerald-50">
                      {lCount + pCount}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-200 text-center font-bold">
                <td className="border border-black p-2 text-left pl-4">TOTAL KESELURUHAN</td>
                <td className="border border-black p-2 font-mono">
                  {activeSiswa.filter((s) => s.jk === 'L').length}
                </td>
                <td className="border border-black p-2 font-mono">
                  {activeSiswa.filter((s) => s.jk === 'P').length}
                </td>
                <td className="border border-black p-2 font-mono text-[#0B6B58] text-sm">
                  {activeSiswa.length}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === 'guru' && (
          <table className="w-full text-left text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 text-center font-bold">
                <th className="border border-black p-2 w-10">No</th>
                <th className="border border-black p-2">Nama Lengkap & NIP</th>
                <th className="border border-black p-2">Jabatan</th>
                <th className="border border-black p-2">Status</th>
                <th className="border border-black p-2">Mengampu</th>
                <th className="border border-black p-2">Kontak</th>
              </tr>
            </thead>
            <tbody>
              {activeGuru.map((g, idx) => (
                <tr key={g.id}>
                  <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                  <td className="border border-black p-2">
                    <b>{g.nama}</b>
                    <div className="text-[10px] font-mono text-gray-600">{g.nip || 'Non-NIP'}</div>
                  </td>
                  <td className="border border-black p-2">{g.jabatan}</td>
                  <td className="border border-black p-2 text-center font-semibold">{g.statusPeg}</td>
                  <td className="border border-black p-2">{g.mengampu || '-'}</td>
                  <td className="border border-black p-2 font-mono">{g.telp || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'aset' && (
          <table className="w-full text-left text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 text-center font-bold">
                <th className="border border-black p-2 w-10">No</th>
                <th className="border border-black p-2">Nama Barang & Kode</th>
                <th className="border border-black p-2">Kategori KIB</th>
                <th className="border border-black p-2 w-16">Unit</th>
                <th className="border border-black p-2 w-24">Kondisi</th>
                <th className="border border-black p-2">Lokasi</th>
              </tr>
            </thead>
            <tbody>
              {aset.map((a, idx) => (
                <tr key={a.id}>
                  <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                  <td className="border border-black p-2 font-semibold">
                    {a.nama}
                    <div className="text-[10px] font-mono text-gray-500">{a.kode || '-'}</div>
                  </td>
                  <td className="border border-black p-2">{a.kategori}</td>
                  <td className="border border-black p-2 text-center font-mono font-bold">{a.jumlah}</td>
                  <td className="border border-black p-2 text-center font-semibold">{a.kondisi}</td>
                  <td className="border border-black p-2">{a.lokasi || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'lengkap' && (
          <div className="space-y-3">
            <table className="w-full text-left text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-gray-100 font-bold">
                  <th className="border border-black p-2">Indikator Validasi</th>
                  <th className="border border-black p-2 w-28 text-center">Jumlah Belum Lengkap</th>
                  <th className="border border-black p-2">Tindak Lanjut Rekomendasi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-semibold">Siswa aktif tanpa nomor NISN</td>
                  <td className="border border-black p-2 text-center font-mono font-bold text-amber-700">
                    {activeSiswa.filter((s) => !s.nisn).length}
                  </td>
                  <td className="border border-black p-2 text-gray-600">
                    Sinkronisasikan dengan data residu Dapodik atau vervalpd.data.kemdikbud.go.id
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-semibold">
                    Siswa aktif tanpa tanggal lahir / alamat
                  </td>
                  <td className="border border-black p-2 text-center font-mono font-bold text-amber-700">
                    {activeSiswa.filter((s) => !s.tglLahir || !s.alamat).length}
                  </td>
                  <td className="border border-black p-2 text-gray-600">
                    Lengkapi dokumen Kartu Keluarga / Akta Kelahiran pada buku induk
                  </td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-semibold">Guru yang belum memiliki NUPTK</td>
                  <td className="border border-black p-2 text-center font-mono font-bold text-amber-700">
                    {activeGuru.filter((g) => !g.nuptk && (g.jabatan || '').includes('Guru')).length}
                  </td>
                  <td className="border border-black p-2 text-gray-600">
                    Ajukan penerbitan NUPTK melalui sistem vervalptk Kemdikbud
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-8 text-xs">
          <div className="text-center w-64">
            <div>
              {config.kabupaten},{' '}
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
  );
};
