/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ikResize } from '../lib/imagekit';
import { RiwayatPengerjaan } from './RiwayatPengerjaan';
import React from 'react';
import { SchoolConfig, Siswa, Guru, Aset, SuratMasuk, SuratKeluar } from '../types';
import {
  Users,
  GraduationCap,
  Package,
  Inbox,
  Send,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Database,
  Cloud,
  ClipboardCheck,
} from 'lucide-react';

interface DashboardProps {
  config: SchoolConfig;
  siswa: Siswa[];
  guru: Guru[];
  aset: Aset[];
  suratmasuk: SuratMasuk[];
  suratkeluar: SuratKeluar[];
  onNavigate: (tab: string) => void;
  onOpenSupabaseModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  config,
  siswa,
  guru,
  aset,
  suratmasuk,
  suratkeluar,
  onNavigate,
  onOpenSupabaseModal,
}) => {
  const activeSiswa = siswa.filter((s) => s.status === 'Aktif');
  const countL = activeSiswa.filter((s) => s.jk === 'L').length;
  const countP = activeSiswa.filter((s) => s.jk === 'P').length;

  const activeGuru = guru.filter((g) => g.status !== 'Nonaktif');
  const countAsn = activeGuru.filter((g) => g.statusPeg === 'PNS' || (g.statusPeg || '').startsWith('PPPK')).length;
  const countNonAsn = activeGuru.length - countAsn;

  let totalAsetUnit = 0;
  let asetBaik = 0;
  let asetRusakRingan = 0;
  let asetRusakBerat = 0;
  aset.forEach((a) => {
    const qty = a.jumlah || 1;
    totalAsetUnit += qty;
    if (a.kondisi === 'Baik') asetBaik += qty;
    else if (a.kondisi === 'Rusak ringan') asetRusakRingan += qty;
    else if (a.kondisi === 'Rusak berat') asetRusakBerat += qty;
  });

  const rombelList = (config.kelas || '1, 2, 3, 4, 5, 6')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => ({
      kelas: k,
      count: activeSiswa.filter((s) => s.kelas === k).length,
    }));
  const maxRombel = Math.max(...rombelList.map((r) => r.count), 1);

  const pendingIssues = [
    {
      count: activeSiswa.filter((s) => !s.nisn).length,
      text: 'siswa aktif belum memiliki nomor NISN',
      tab: 'siswa',
    },
    {
      count: activeSiswa.filter((s) => !s.tglLahir || !s.alamat).length,
      text: 'siswa aktif belum lengkap tanggal lahir atau alamat',
      tab: 'siswa',
    },
    {
      count: activeGuru.filter((g) => !g.nuptk && (g.jabatan || '').includes('Guru')).length,
      text: 'guru belum memiliki NUPTK',
      tab: 'guru',
    },
    {
      count: suratmasuk.filter((s) => s.status !== 'Selesai').length,
      text: 'surat masuk belum selesai ditindaklanjuti',
      tab: 'suratmasuk',
    },
    {
      count: asetRusakBerat,
      text: 'unit sarana prasarana dalam kondisi rusak berat',
      tab: 'aset',
    },
  ].filter((item) => item.count > 0);

  const logo = ikResize(config.logoSekolah || config.logoPemda || config.logo || '', 240);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#0B6B58] to-[#13262A] text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-white/10 p-2 shrink-0 border border-white/20 flex items-center justify-center">
            {logo ? (
              <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain logo-hd drop-shadow-xs" />
            ) : (
              <GraduationCap className="w-10 h-10 text-white" />
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-[#DAEEE7] mb-1.5">
              Administrasi Meja Operator Terpadu
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-display">
              {config.namaSekolah || 'SD Negeri 2 Cempaka'}
            </h1>
            <p className="text-xs text-[#DAEEE7] mt-1 max-w-xl leading-relaxed">
              Kop surat resmi HD di pojok kiri atas aktif di seluruh surat dinas, buku induk, dan rekap mutasi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenSupabaseModal && (
          <button
            type="button"
            onClick={onOpenSupabaseModal}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Cloud className="w-4 h-4 text-emerald-300" />
            Supabase Cloud
          </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('suratkeluar')}
            className="px-4 py-2 bg-white text-[#0B6B58] text-xs font-bold rounded-xl shadow-xs hover:bg-[#DAEEE7] transition cursor-pointer"
          >
            + Buat Surat Keluar
          </button>
          <button
            type="button"
            onClick={() => onNavigate('posujian')}
            className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-200" />
            POS Ujian
          </button>
          <button
            type="button"
            onClick={() => onNavigate('siswa')}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Data Siswa
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('siswa')}
          className="bg-white p-4 rounded-xl border border-[#D3DDD9] hover:border-[#0B6B58] transition shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Siswa Aktif</span>
            <Users className="w-4 h-4 text-[#0B6B58] group-hover:scale-110 transition" />
          </div>
          <div className="text-3xl font-extrabold text-[#13262A] font-display num-tabular">
            {activeSiswa.length}
          </div>
          <div className="text-[11px] text-[#566A6E] mt-1">
            {countL} Laki-laki &middot; {countP} Perempuan
          </div>
        </div>

        <div
          onClick={() => onNavigate('guru')}
          className="bg-white p-4 rounded-xl border border-[#D3DDD9] hover:border-[#0B6B58] transition shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Guru & Tendik</span>
            <GraduationCap className="w-4 h-4 text-[#0B6B58] group-hover:scale-110 transition" />
          </div>
          <div className="text-3xl font-extrabold text-[#13262A] font-display num-tabular">
            {activeGuru.length}
          </div>
          <div className="text-[11px] text-[#566A6E] mt-1">
            {countAsn} ASN &middot; {countNonAsn} Non-ASN
          </div>
        </div>

        <div
          onClick={() => onNavigate('aset')}
          className="bg-white p-4 rounded-xl border border-[#D3DDD9] hover:border-[#0B6B58] transition shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Aset & Sarpras</span>
            <Package className="w-4 h-4 text-[#0B6B58] group-hover:scale-110 transition" />
          </div>
          <div className="text-3xl font-extrabold text-[#13262A] font-display num-tabular">
            {totalAsetUnit} <span className="text-xs font-normal text-gray-500">unit</span>
          </div>
          <div className="text-[11px] text-[#1D7A3A] font-semibold mt-1">
            {totalAsetUnit ? Math.round((asetBaik / totalAsetUnit) * 100) : 0}% Kondisi Baik
          </div>
        </div>

        <div
          onClick={() => onNavigate('suratmasuk')}
          className="bg-white p-4 rounded-xl border border-[#D3DDD9] hover:border-[#0B6B58] transition shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Agenda Surat</span>
            <Inbox className="w-4 h-4 text-[#0B6B58] group-hover:scale-110 transition" />
          </div>
          <div className="text-3xl font-extrabold text-[#13262A] font-display num-tabular">
            {suratmasuk.length + suratkeluar.length}
          </div>
          <div className="text-[11px] text-[#566A6E] mt-1">
            {suratmasuk.length} Masuk &middot; {suratkeluar.length} Keluar
          </div>
        </div>
      </div>

      {/* Rombel & Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rombel Chart */}
        <div className="bg-white p-5 rounded-xl border border-[#D3DDD9] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9] mb-4">
            <h2 className="text-sm font-bold text-[#13262A] font-display">
              Jumlah Siswa Aktif per Rombel Kelas
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('siswa')}
              className="text-xs font-semibold text-[#0B6B58] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Lihat Detail <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {rombelList.map((r) => {
              const pct = (r.count / maxRombel) * 100;
              return (
                <div key={r.kelas} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#13262A]">Kelas {r.kelas}</span>
                    <span className="font-mono font-bold text-[#0B6B58]">{r.count} siswa</span>
                  </div>
                  <div className="w-full bg-[#E8EFEC] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0B6B58] h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white p-5 rounded-xl border border-[#D3DDD9] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9] mb-4">
            <h2 className="text-sm font-bold text-[#13262A] font-display flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Perlu Dilengkapi / Ditindaklanjuti
            </h2>
          </div>
          {pendingIssues.length === 0 ? (
            <div className="py-8 text-center text-[#566A6E] space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-xs font-semibold text-[#1D7A3A]">Semua data pokok sudah lengkap!</p>
              <p className="text-[11px]">Tidak ada data siswa atau berkas yang tertunda saat ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingIssues.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => onNavigate(item.tab)}
                  className="p-3 bg-[#F1F4F2] hover:bg-[#DAEEE7]/60 rounded-xl flex items-center justify-between gap-3 text-xs transition cursor-pointer border border-[#D3DDD9]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                      {item.count}
                    </span>
                    <span className="text-[#13262A] font-medium leading-tight">{item.text}</span>
                  </div>
                  <span className="text-[#0B6B58] font-bold text-[11px] shrink-0">Buka &rarr;</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ringkasan riwayat pengerjaan */}
      <RiwayatPengerjaan />
    </div>
  );
};
