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
  ClipboardCheck,
  Lock,
} from 'lucide-react';

interface DashboardProps {
  role?: 'operator' | 'guru';
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
  role = 'operator',
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
      <div className="bg-gradient-to-r from-[#0B6B58] via-[#0E6470] to-[#13262A] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
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
          <button
            type="button"
            onClick={() => onNavigate('suratkeluar')}
            className="px-4 py-2 bg-white text-[#0B6B58] text-xs font-bold rounded-xl shadow-xs hover:bg-[#DAEEE7] transition cursor-pointer"
          >
            {role === 'operator' ? '+ Buat Surat Keluar' : 'Surat Keluar'}
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
            title={role !== 'operator' ? 'Dikunci khusus Operator Sekolah' : 'Buka Data Siswa'}
            className={`px-4 py-2 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 ${
              role !== 'operator'
                ? 'bg-white/10 text-white/70 cursor-not-allowed'
                : 'bg-white/20 hover:bg-white/30 cursor-pointer'
            }`}
          >
            {role !== 'operator' && <Lock className="w-3.5 h-3.5 text-amber-200" />}
            Data Siswa
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('siswa')}
          title={role !== 'operator' ? 'Dikunci khusus Operator Sekolah' : 'Buka Data Siswa & Mutasi'}
          className={`bg-white/95 p-4 rounded-xl border border-[#CBE0D9] transition shadow-xs group ${
            role !== 'operator' ? 'cursor-not-allowed opacity-85' : 'hover:border-[#0B6B58] cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              Siswa Aktif
              {role !== 'operator' && <Lock className="w-3 h-3 text-amber-600" />}
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#DAEEE7] text-[#0B6B58] flex items-center justify-center group-hover:scale-105 transition">
              <Users className="w-4 h-4" />
            </span>
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
          className="bg-white/95 p-4 rounded-xl border border-[#CBE0D9] hover:border-[#0E7490] transition shadow-xs cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Guru & Tendik</span>
            <span className="w-7 h-7 rounded-lg bg-sky-100 text-[#0369A1] flex items-center justify-center group-hover:scale-105 transition">
              <GraduationCap className="w-4 h-4" />
            </span>
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
          title={role !== 'operator' ? 'Dikunci khusus Operator Sekolah' : 'Buka Aset & Inventaris'}
          className={`bg-white/95 p-4 rounded-xl border border-[#CBE0D9] transition shadow-xs group ${
            role !== 'operator' ? 'cursor-not-allowed opacity-85' : 'hover:border-[#1D7A3A] cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              Aset & Sarpras
              {role !== 'operator' && <Lock className="w-3 h-3 text-amber-600" />}
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#DDF1E3] text-[#1D7A3A] flex items-center justify-center group-hover:scale-105 transition">
              <Package className="w-4 h-4" />
            </span>
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
          title={role !== 'operator' ? 'Dikunci khusus Operator Sekolah' : 'Buka Surat Masuk'}
          className={`bg-white/95 p-4 rounded-xl border border-[#CBE0D9] transition shadow-xs group ${
            role !== 'operator' ? 'cursor-not-allowed opacity-85' : 'hover:border-amber-600 cursor-pointer'
          }`}
        >
          <div className="flex items-center justify-between text-[#566A6E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              Agenda Surat
              {role !== 'operator' && <Lock className="w-3 h-3 text-amber-600" />}
            </span>
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition">
              <Inbox className="w-4 h-4" />
            </span>
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
            {role === 'operator' && (
              <button
                type="button"
                onClick={() => onNavigate('siswa')}
                className="text-xs font-semibold text-[#0B6B58] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Lihat Detail <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
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
              {pendingIssues.map((item, idx) => {
                const locked = role !== 'operator' && item.tab !== 'guru';
                return (
                  <div
                    key={idx}
                    onClick={() => onNavigate(item.tab)}
                    className={`p-3 bg-[#F1F4F2] rounded-xl flex items-center justify-between gap-3 text-xs transition border border-[#D3DDD9] ${
                      locked ? 'opacity-80 cursor-not-allowed' : 'hover:bg-[#DAEEE7]/60 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                        {item.count}
                      </span>
                      <span className="text-[#13262A] font-medium leading-tight">{item.text}</span>
                    </div>
                    {locked ? (
                      <span className="text-amber-700 font-semibold text-[11px] shrink-0 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Operator
                      </span>
                    ) : (
                      <span className="text-[#0B6B58] font-bold text-[11px] shrink-0">Buka &rarr;</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ringkasan riwayat pengerjaan */}
      <RiwayatPengerjaan role={role} />
    </div>
  );
};
