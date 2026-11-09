/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ikResize } from '../lib/imagekit';
import React from 'react';
import { User, SchoolConfig } from '../types';
import {
  GraduationCap,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  config: SchoolConfig;
  onLogout: () => void;
  onOpenSettingsKop?: () => void;
  onOpenSupabaseModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  config,
  onLogout,
  onOpenSettingsKop,
}) => {
  const isOperator = currentUser?.role === 'operator';
  const logo = ikResize(config.logoSekolah || config.logoPemda || config.logo || '', 240);

  return (
    <header className="bg-white border-b border-[#D3DDD9] sticky top-0 z-40 shadow-xs">
      <div className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: School Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenSettingsKop}
            title="Klik untuk mengatur logo sekolah & kop surat"
            className="w-10 h-10 rounded-lg bg-[#DAEEE7] border border-[#0B6B58]/20 flex items-center justify-center shrink-0 overflow-hidden text-[#0B6B58] hover:ring-2 hover:ring-[#0B6B58] transition cursor-pointer"
          >
            {logo ? (
              <img src={logo} alt="Logo Sekolah" className="w-8 h-8 object-contain logo-hd" />
            ) : (
              <GraduationCap className="w-6 h-6" />
            )}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#13262A] truncate font-display">
                {config.namaSekolah || 'Meja Operator Sekolah'}
              </h1>
              <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-[#E8EFEC] text-[#566A6E]">
                NPSN {config.npsn || '20215452'}
              </span>
            </div>
            <p className="text-xs text-[#566A6E] truncate">
              Tahun Ajaran {config.tahunAjaran} &middot; Semester {config.semester}
            </p>
          </div>
        </div>

        {/* Right: User Controls */}
        <div className="flex items-center gap-2.5">
          {currentUser && (
            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-[#13262A] truncate max-w-[180px]">
                  {isOperator ? (config.namaOperator || currentUser.name) : currentUser.name}
                </div>
                <div className="text-[11px] text-[#566A6E]">
                  {isOperator ? (
                    <span className="text-[#0B6B58] font-semibold">Operator (Full Akses)</span>
                  ) : (
                    <span className="text-[#1D7A3A] font-semibold">Guru / Tendik</span>
                  )}
                </div>
              </div>

              <div
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                  isOperator
                    ? 'bg-[#DAEEE7] text-[#0B6B58] border-[#0B6B58]/30'
                    : 'bg-[#DDF1E3] text-[#1D7A3A] border-[#1D7A3A]/30'
                }`}
              >
                {isOperator ? (
                  <ShieldCheck className="w-4 h-4 text-[#0B6B58]" />
                ) : (
                  <UserCheck className="w-4 h-4 text-[#1D7A3A]" />
                )}
                <span className="hidden md:inline">{isOperator ? 'Operator Penuh' : 'Guru / Tendik'}</span>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-1.5 text-xs font-medium bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                title="Ganti Akun Pengguna"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Ganti Akun</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-[#566A6E] hover:text-[#B3261E] hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
