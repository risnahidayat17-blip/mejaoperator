/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Send,
  Inbox,
  Award,
  CalendarCheck,
  Package,
  Calendar,
  FileText,
  BadgeDollarSign,
  UserCheck,
  Settings,
  Lock,
  ShieldCheck,
  Cloud,
  ClipboardCheck,
  ClipboardList,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  role: 'operator' | 'guru';
  counts: {
    siswa: number;
    guru: number;
    aset: number;
    suratmasuk: number;
    suratkeluar: number;
    berkas: number;
    arsipabsen: number;
  };
  onOpenSupabaseModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  role,
  counts,
  onOpenSupabaseModal,
}) => {
  const isOperator = role === 'operator';

  const sections = [
    {
      title: 'Data Pokok',
      items: [
        { id: 'dasbor', label: 'Dasbor Ringkasan', icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'siswa', label: 'Data Siswa & Mutasi', icon: <Users className="w-4 h-4" />, count: counts.siswa, badge: 'Operator' },
        { id: 'guru', label: 'Guru dan Tendik', icon: <GraduationCap className="w-4 h-4" />, count: counts.guru },
        { id: 'bukuinduk', label: 'Buku Induk Siswa', icon: <BookOpen className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Arsip & Surat',
      items: [
        { id: 'suratkeluar', label: 'Surat Keluar (Kop HD)', icon: <Send className="w-4 h-4" />, count: counts.suratkeluar },
        { id: 'suratmasuk', label: 'Surat Masuk', icon: <Inbox className="w-4 h-4" />, count: counts.suratmasuk },
        { id: 'penilaian', label: 'Penilaian & Rapor', icon: <Award className="w-4 h-4" />, count: counts.berkas },
        { id: 'posujian', label: 'POS Ujian Sekolah', icon: <ClipboardCheck className="w-4 h-4" /> },
        { id: 'daftarhadir', label: 'Daftar Hadir Siswa', icon: <ClipboardList className="w-4 h-4" /> },
        { id: 'arsipabsen', label: 'Arsip Absen', icon: <CalendarCheck className="w-4 h-4" />, count: counts.arsipabsen },
      ],
    },
    {
      title: 'Sarana & Pelaporan',
      items: [
        { id: 'aset', label: 'Aset & Inventaris', icon: <Package className="w-4 h-4" />, count: counts.aset },
        { id: 'laporanbulan', label: 'Laporan Bulan (Daftar 1)', icon: <Calendar className="w-4 h-4" /> },
        { id: 'laporan', label: 'Rekap Laporan', icon: <FileText className="w-4 h-4" /> },
        { id: 'keuangan', label: 'Laporan Keuangan', icon: <BadgeDollarSign className="w-4 h-4" />, badge: 'Operator' },
      ],
    },
    {
      title: 'Pengaturan & Cloud',
      items: [
        { id: 'profil', label: 'Profil Pengguna', icon: <UserCheck className="w-4 h-4" /> },
        { id: 'pengaturan', label: 'Pengaturan & Kop', icon: <Settings className="w-4 h-4" />, badge: 'Admin' },
      ],
    },
  ];

  const allowedForGuru = [
    'dasbor',
    'guru',
    'bukuinduk',
    'posujian',
    'suratkeluar',
    'arsipabsen',
    'daftarhadir',
    'penilaian',
    'profil',
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#D3DDD9] flex flex-col shrink-0 min-h-[calc(100vh-65px)] select-none">
      {/* Mode Status Banner */}
      <div className="p-3.5 m-3 rounded-xl border bg-[#F1F4F2] text-xs">
        <div className="flex items-center gap-2 mb-1">
          {isOperator ? (
            <ShieldCheck className="w-4 h-4 text-[#0B6B58]" />
          ) : (
            <UserCheck className="w-4 h-4 text-[#1D7A3A]" />
          )}
          <span className="font-bold text-[#13262A] font-display">
            {isOperator ? 'Mode Operator Penuh' : 'Mode Guru & Tendik'}
          </span>
        </div>
        <p className="text-[11px] text-[#566A6E] leading-relaxed">
          {isOperator
            ? 'Full akses seluruh administrasi, siswa, GTK, aset, surat, kop logo, dan Supabase Cloud.'
            : 'Akses Guru & Tendik: Mengelola GTK, Buku Induk Siswa, POS Ujian, Penilaian, Surat Keluar, dan Absensi (Data Siswa khusus Operator).'}
        </p>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#566A6E]">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = currentTab === item.id;
                const isLocked = !isOperator && !allowedForGuru.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isLocked}
                    aria-disabled={isLocked}
                    title={isLocked ? 'Terkunci \u2014 khusus Operator' : undefined}
                    onClick={() => !isLocked && onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isLocked
                        ? 'text-[#566A6E]/50 cursor-not-allowed'
                        : isActive
                        ? 'bg-[#DAEEE7] text-[#0B6B58] font-bold shadow-xs cursor-pointer'
                        : 'text-[#13262A] hover:bg-[#E8EFEC] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'text-[#0B6B58]' : 'text-[#566A6E]'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLocked && <Lock className="w-3.5 h-3.5 text-gray-400" />}
                      {!isLocked && item.badge && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          {item.badge}
                        </span>
                      )}
                      {!isLocked && item.count !== undefined && item.count > 0 && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-[#0B6B58] text-white' : 'bg-[#E8EFEC] text-[#566A6E]'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Supabase Cloud Quick Action in Sidebar (khusus operator) */}
      {isOperator && (
      <div className="p-3 m-3 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl text-xs space-y-2">
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className="w-full py-1.5 px-2 bg-white hover:bg-[#DAEEE7] border border-[#CBD7D2] text-[#0B6B58] rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Cloud className="w-3.5 h-3.5" />
          Koneksi Supabase
        </button>
        <div className="text-[10px] text-[#566A6E] flex items-center justify-between">
          <span>Proyek ID</span>
          <code className="font-mono font-semibold text-[#0B6B58]">qpjgokdxoevjjcrrazqh</code>
        </div>
      </div>
      )}
    </aside>
  );
};
