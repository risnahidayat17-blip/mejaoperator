/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SchoolConfig } from '../types';

interface KopSuratProps {
  config: SchoolConfig;
  className?: string;
}

export const KopSuratHD: React.FC<KopSuratProps> = ({ config, className = '' }) => {
  const logoPemda = config.logoPemda || config.logo || '';
  const logoSekolah = config.logoSekolah || '';
  const height = config.logoHeight || 85;
  const layout = config.tataLetakLogo || 'kiri_kedua';
  const hasBoth = Boolean(logoPemda && logoSekolah);

  // Layout 1: Both logos side by side at top left (Requested default)
  if (layout === 'kiri_kedua') {
    const sideWidth = hasBoth ? 164 : 88;
    return (
      <div className={`relative pb-3 mb-6 select-text ${className}`}>
        <div
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: `${sideWidth}px 1fr ${sideWidth}px` }}
        >
          <div
            className="flex items-center gap-2.5 shrink-0 justify-start"
            style={{ height: `${height + 4}px`, width: `${sideWidth}px` }}
          >
            {logoPemda && (
              <img
                src={logoPemda}
                alt="Logo Pemda"
                className="logo-hd object-contain drop-shadow-xs"
                style={{ maxHeight: `${height}px`, maxWidth: hasBoth ? '76px' : '84px', width: 'auto' }}
                loading="eager"
                decoding="sync"
              />
            )}
            {logoSekolah && (
              <img
                src={logoSekolah}
                alt="Logo Sekolah"
                className="logo-hd object-contain drop-shadow-xs"
                style={{ maxHeight: `${height}px`, maxWidth: hasBoth ? '76px' : '84px', width: 'auto' }}
                loading="eager"
                decoding="sync"
              />
            )}
            {!logoPemda && !logoSekolah && (
              <div className="w-16 h-20 border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-400">
                (Upload Logo)
              </div>
            )}
          </div>

          <div
            className="text-center font-serif leading-tight text-black px-1"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            <div className="text-[13.5px] font-bold uppercase tracking-wider">
              {config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}
            </div>
            <div className="text-[13.5px] font-bold uppercase tracking-wider mt-0.5">
              {config.kopInduk2 || 'DINAS PENDIDIKAN'}
            </div>
            <div className="text-[17.5px] font-bold uppercase tracking-wide my-1">
              {config.namaSekolah?.toUpperCase() || 'SEKOLAH DASAR NEGERI 2 CEMPAKA'}
            </div>
            <div className="text-[11.5px] italic font-normal text-gray-900 leading-snug">
              {config.kopAlamat || config.alamat || 'Jl. Raden Cempa No. 101 Desa Cempaka Kec. Talun Kab. Cirebon 45171'}
            </div>
          </div>

          <div
            className="invisible pointer-events-none"
            style={{ width: `${sideWidth}px`, height: `${height + 4}px` }}
            aria-hidden="true"
          />
        </div>

        <div className="mt-3.5 border-b-[2.5px] border-black" />
        <div className="mt-[2px] border-b-[1px] border-black" />
      </div>
    );
  }

  // Layout 2: Left & Right logos
  if (layout === 'kiri_kanan') {
    return (
      <div className={`relative pb-3 mb-6 select-text ${className}`}>
        <div className="grid grid-cols-[88px_1fr_88px] items-center gap-3">
          <div className="flex items-center justify-center shrink-0 w-[88px]" style={{ height: `${height + 4}px` }}>
            {logoPemda ? (
              <img
                src={logoPemda}
                alt="Logo Pemda"
                className="logo-hd object-contain drop-shadow-xs"
                style={{ maxHeight: `${height}px`, maxWidth: '84px', width: 'auto' }}
                loading="eager"
                decoding="sync"
              />
            ) : (
              <div className="w-16 h-20 border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-400">
                (Logo Pemda)
              </div>
            )}
          </div>

          <div
            className="text-center font-serif leading-tight text-black px-1"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            <div className="text-[13.5px] font-bold uppercase tracking-wider">
              {config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}
            </div>
            <div className="text-[13.5px] font-bold uppercase tracking-wider mt-0.5">
              {config.kopInduk2 || 'DINAS PENDIDIKAN'}
            </div>
            <div className="text-[17.5px] font-bold uppercase tracking-wide my-1">
              {config.namaSekolah?.toUpperCase() || 'SEKOLAH DASAR NEGERI 2 CEMPAKA'}
            </div>
            <div className="text-[11.5px] italic font-normal text-gray-900 leading-snug">
              {config.kopAlamat || config.alamat}
            </div>
          </div>

          <div className="flex items-center justify-center shrink-0 w-[88px]" style={{ height: `${height + 4}px` }}>
            {logoSekolah ? (
              <img
                src={logoSekolah}
                alt="Logo Sekolah"
                className="logo-hd object-contain drop-shadow-xs"
                style={{ maxHeight: `${height}px`, maxWidth: '84px', width: 'auto' }}
                loading="eager"
                decoding="sync"
              />
            ) : (
              <div className="w-[88px] invisible pointer-events-none" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="mt-3.5 border-b-[2.5px] border-black" />
        <div className="mt-[2px] border-b-[1px] border-black" />
      </div>
    );
  }

  // Layout 3 or 4: Single logo
  const singleLogo = layout === 'kiri_pemda_saja' ? logoPemda : (logoSekolah || logoPemda);
  return (
    <div className={`relative pb-3 mb-6 select-text ${className}`}>
      <div className="grid grid-cols-[88px_1fr_88px] items-center gap-3">
        <div className="flex items-center justify-center shrink-0 w-[88px]" style={{ height: `${height + 4}px` }}>
          {singleLogo ? (
            <img
              src={singleLogo}
              alt="Logo"
              className="logo-hd object-contain drop-shadow-xs"
              style={{ maxHeight: `${height}px`, maxWidth: '84px', width: 'auto' }}
              loading="eager"
              decoding="sync"
            />
          ) : (
            <div className="w-16 h-20 border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-400">
              (Logo)
            </div>
          )}
        </div>

        <div
          className="text-center font-serif leading-tight text-black px-1"
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
        >
          <div className="text-[13.5px] font-bold uppercase tracking-wider">
            {config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}
          </div>
          <div className="text-[13.5px] font-bold uppercase tracking-wider mt-0.5">
            {config.kopInduk2 || 'DINAS PENDIDIKAN'}
          </div>
          <div className="text-[17.5px] font-bold uppercase tracking-wide my-1">
            {config.namaSekolah?.toUpperCase() || 'SEKOLAH DASAR NEGERI 2 CEMPAKA'}
          </div>
          <div className="text-[11.5px] italic font-normal text-gray-900 leading-snug">
            {config.kopAlamat || config.alamat}
          </div>
        </div>

        <div className="w-[88px] invisible pointer-events-none" aria-hidden="true" />
      </div>

      <div className="mt-3.5 border-b-[2.5px] border-black" />
      <div className="mt-[2px] border-b-[1px] border-black" />
    </div>
  );
};
