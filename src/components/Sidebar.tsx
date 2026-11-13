/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { getSupabaseConfig } from '../lib/supabase';
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
  ShieldCheck,
  Cloud,
  ClipboardCheck,
  ClipboardList,
  FolderArchive,
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
    arsiplaporan: number;
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
  const projectId = isOperator ? getSupabaseConfig().projectId : '';

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
        { id: 'arsiplaporan', label: 'Arsip Laporan Sekolah', icon: <FolderArchive className="w-4 h-4" />, count: counts.arsiplaporan, badge: 'Operator' },
        { id: 'keuangan', label: 'Laporan Keuangan', icon: <BadgeDollarSign className="w-4 h-4" />, badge: 'Operator' },
      ],
    },
    {
      title: isOperator ? 'Pengaturan & Cloud' : 'Profil & Pengaturan',
      items: [
        { id: 'profil', label: 'Profil Pengguna', icon: <UserCheck className="w-4 h-4" /> },
        { id: 'pengaturan', label: 'Pengaturan & Kop', icon: <Settings className="w-4 h-4" />, badge: 'Admin' },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-[#0E3A34] via-[#102F35] to-[#13262A] text-white border-r border-[#0B6B58]/30 flex flex-col shrink-0 min-h-[calc(100vh-65px)] select-none shadow-sm">
      {/* Mode Status Banner */}
      <div className="p-3.5 m-3 rounded-xl border border-white/15 bg-white/10 backdrop-blur-xs text-xs">
        <div className="flex items-center gap-2 mb-1">
          {isOperator ? (
            <ShieldCheck className="w-4 h-4 text-[#7EE3C8]" />
          ) : (
            <UserCheck className="w-4 h-4 text-[#8FE8A8]" />
          )}
          <span className="font-bold text-white font-display">
            {isOperator ? 'Mode Operator Penuh' : 'Mode Guru (Lihat Saja)'}
          </span>
        </div>
        <p className="text-[11px] text-[#CFE6DF] leading-relaxed">
          {isOperator
            ? 'Full akses seluruh administrasi, siswa, GTK, aset, surat, kop logo, dan Supabase Cloud.'
            : 'Anda dapat membuka dan melihat seluruh menu data administrasi sekolah (hanya lihat, tidak dapat menambah atau mengubah data).'}
        </p>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#9BC7BC]">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-gradient-to-r from-[#0F8B72] to-[#0E7490] text-white font-bold shadow-sm cursor-pointer'
                        : 'text-[#E4F1ED] hover:bg-white/10 hover:text-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={isActive ? 'text-white' : 'text-[#8FD1C1]'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOperator && item.badge && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-300/25">
                          {item.badge}
                        </span>
                      )}
                      {item.count !== undefined && item.count > 0 && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-white text-[#0B6B58] font-bold' : 'bg-white/15 text-[#E4F1ED]'
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
      <div className="p-3 m-3 bg-white/10 border border-white/15 rounded-xl text-xs space-y-2">
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className="w-full py-1.5 px-2 bg-white hover:bg-[#DAEEE7] text-[#0B6B58] rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
        >
          <Cloud className="w-3.5 h-3.5" />
          Koneksi Supabase
        </button>
        <div className="text-[10px] text-[#B8DCD2] flex items-center justify-between gap-2">
          <span>Proyek ID</span>
          <code className="font-mono font-semibold text-white truncate">{projectId || '-'}</code>
        </div>
      </div>
      )}
    </aside>
  );
};
