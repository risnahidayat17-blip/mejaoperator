/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ikResize } from '../lib/imagekit';
import React, { useState } from 'react';
import { SchoolConfig } from '../types';
import { getGurus, loginOperator, loginGuru } from '../lib/storage';
import {
  GraduationCap,
  ShieldCheck,
  UserCheck,
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

interface LoginScreenProps {
  config: SchoolConfig;
  onLoggedIn: (role: 'operator' | 'guru') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ config, onLoggedIn }) => {
  const activeGurus = getGurus().filter((g) => g.status !== 'Nonaktif');
  const [selectedGuruId, setSelectedGuruId] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const logo = ikResize(config.logoSekolah || config.logoPemda || config.logo || '', 240);

  const handleLoginGuru = () => {
    loginGuru(selectedGuruId || undefined);
    onLoggedIn('guru');
  };

  const handleLoginOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const res = await loginOperator(operatorPassword);
    if (res.success) {
      onLoggedIn('operator');
    } else {
      setErrorMessage(res.message || 'Password operator tidak sesuai.');
      setOperatorPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F4F2] flex flex-col items-center justify-center px-4 py-10 font-sans text-[#13262A]">
      <div className="w-full max-w-3xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-white border border-[#D3DDD9] shadow-sm flex items-center justify-center overflow-hidden mb-3 p-2">
            {logo ? (
              <img src={logo} alt="Logo Sekolah" className="w-full h-full object-contain logo-hd drop-shadow-xs" />
            ) : (
              <GraduationCap className="w-10 h-10 text-[#0B6B58]" />
            )}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0B6B58]">
            Sistem Administrasi Sekolah & Supabase Cloud
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display mt-1">
            {config.namaSekolah || 'SD Negeri 2 Cempaka'}
          </h1>
          <p className="text-xs text-[#566A6E] mt-1.5">
            Kecamatan {config.kecamatan || 'Talun'} &middot; Kabupaten {config.kabupaten || 'Cirebon'}
          </p>
        </div>

        {/* Dual Login Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Guru / Tendik */}
          <section className="bg-white rounded-2xl border border-[#D3DDD9] shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#DDF1E3] text-[#1D7A3A] flex items-center justify-center shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold font-display">Masuk sebagai Guru / Tendik</h2>
                <span className="text-[11px] font-semibold text-[#1D7A3A]">Tanpa password</span>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-xs text-[#566A6E] flex-1">
              <li className="flex gap-2">
                <span className="text-[#1D7A3A] font-bold">&#10003;</span>
                <span>Dapat melihat & mengubah data GTK, Penilaian/Rapor, Surat Keluar, dan Absen.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#1D7A3A] font-bold">&#10003;</span>
                <span>Mengunggah dokumen dan mencetak surat ber-Kop resmi resolusi tinggi.</span>
              </li>
            </ul>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
                Pilih Nama Anda (opsional)
              </label>
              <select
                value={selectedGuruId}
                onChange={(e) => setSelectedGuruId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg bg-white"
              >
                <option value="">Tidak memilih nama spesifik</option>
                {activeGurus.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama} &mdash; {g.jabatan}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleLoginGuru}
              className="mt-4 w-full px-4 py-2.5 bg-[#1D7A3A] hover:bg-[#17622e] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <LogIn className="w-4 h-4" /> Masuk sebagai Guru / Tendik
            </button>
          </section>

          {/* Card 2: Operator (Full Access) */}
          <section className="bg-white rounded-2xl border border-[#D3DDD9] shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#DAEEE7] text-[#0B6B58] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold font-display">Masuk sebagai Operator</h2>
                <span className="text-[11px] font-semibold text-[#0B6B58]">Perlu password</span>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-xs text-[#566A6E]">
              <li className="flex gap-2">
                <span className="text-[#0B6B58] font-bold">&#10003;</span>
                <span>Akses penuh seluruh modul, data siswa, mutasi, sarpras, keuangan BKU, dan buku induk.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#0B6B58] font-bold">&#10003;</span>
                <span>Koneksi Supabase Cloud, upload kop logo HD, penomoran surat, dan backup.</span>
              </li>
            </ul>

            <form onSubmit={handleLoginOperator} className="mt-4 flex-1 flex flex-col justify-end">
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
                Password operator
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={operatorPassword}
                  onChange={(e) => {
                    setOperatorPassword(e.target.value);
                    setErrorMessage('');
                  }}
                  autoComplete="current-password"
                  placeholder="Masukkan password operator"
                  aria-label="Password operator"
                  className="w-full pl-3 pr-10 py-2 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-[#566A6E] hover:text-[#13262A] cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMessage && (
                <div role="alert" className="mt-2 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                className="mt-4 w-full px-4 py-2.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <LogIn className="w-4 h-4" /> Masuk sebagai Operator
              </button>
            </form>
          </section>
        </div>

        <p className="text-center text-[11px] text-[#566A6E] mt-6">
          Tahun Ajaran {config.tahunAjaran} &middot; Semester {config.semester}
        </p>
      </div>
    </div>
  );
};
