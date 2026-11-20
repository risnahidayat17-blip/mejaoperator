/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SchoolConfig } from '../types';
import { LOGO_PEMDA_STIKER } from '../data/stikerLogo';

interface KopSuratProps {
  config: SchoolConfig;
  className?: string;
  logoHeight?: number;
}

export const KopSuratHD: React.FC<KopSuratProps> = ({ config, className = '', logoHeight }) => {
  const logoPemda = config.logoPemda || config.logo || LOGO_PEMDA_STIKER;
  const logoSekolah = config.logoSekolah || '';
  const baseCfgH = config.logoHeight || 100;
  const rawPemdaH = config.logoPemdaHeight || baseCfgH;
  const rawSekolahH = config.logoSekolahHeight || baseCfgH;
  const scale = typeof logoHeight === 'number' ? logoHeight / baseCfgH : 1;
  const pemdaH = Math.max(40, Math.round(rawPemdaH * scale));
  const sekolahH = Math.max(40, Math.round(rawSekolahH * scale));
  const maxH = Math.max(pemdaH, sekolahH);
  const isCompact = typeof logoHeight === 'number' && logoHeight <= 72;
  const layout = config.tataLetakLogo || 'kiri_kedua';
  const hasBoth = Boolean(logoPemda && logoSekolah);

  const lineIndukCls = isCompact
    ? 'text-[13.5px] font-bold uppercase tracking-wider'
    : 'text-[15px] font-bold uppercase tracking-wider';
  const lineSekolahCls = isCompact
    ? 'text-[17.5px] font-bold uppercase tracking-wide my-1'
    : 'text-[20px] font-bold uppercase tracking-wide my-1';
  const lineAlamatCls = isCompact
    ? 'text-[11.5px] italic font-normal text-gray-900 leading-snug'
    : 'text-[12.5px] italic font-normal text-gray-900 leading-snug';

  const pemdaMaxW = isCompact ? Math.max(64, Math.round(pemdaH * 1.1)) : Math.max(56, Math.round(pemdaH * 1.15));
  const sekolahMaxW = isCompact ? Math.max(64, Math.round(sekolahH * 1.1)) : Math.max(56, Math.round(sekolahH * 1.15));

  // Layout 1: Both logos side by side at top left (Requested default)
  if (layout === 'kiri_kedua') {
    const leftWidth = hasBoth
      ? Math.max(isCompact ? 150 : 180, pemdaMaxW + sekolahMaxW + 14)
      : Math.max(isCompact ? 84 : 96, (logoPemda ? pemdaMaxW : sekolahMaxW) + 8);
    const rightWidth = hasBoth ? (isCompact ? 132 : 56) : leftWidth;

    return (
      <div className={`relative pb-3 mb-6 select-text ${className}`}>
        <div
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: `${leftWidth}px 1fr ${rightWidth}px` }}
        >
          <div
            className="flex items-center gap-2.5 shrink-0 justify-start"
            style={{ minHeight: `${maxH + 6}px`, width: `${leftWidth}px` }}
          >
            {logoPemda && (
              <img
                src={logoPemda}
                alt="Logo Pemda"
                className="logo-hd object-contain drop-shadow-xs shrink-0"
                style={{ height: `${pemdaH}px`, maxHeight: `${pemdaH}px`, maxWidth: `${pemdaMaxW}px`, width: 'auto' }}
                loading="eager"
                decoding="sync"
              />
            )}
            {logoSekolah && (
              <img
                src={logoSekolah}
                alt="Logo Sekolah"
                className="logo-hd object-contain drop-shadow-xs shrink-0"
                style={{ height: `${sekolahH}px`, maxHeight: `${sekolahH}px`, maxWidth: `${sekolahMaxW}px`, width: 'auto' }}
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
            <div className={lineIndukCls}>
              {config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}
            </div>
            <div className={`${lineIndukCls} mt-0.5`}>
              {config.kopInduk2 || 'DINAS PENDIDIKAN'}
            </div>
            <div className={lineSekolahCls}>
              {config.namaSekolah?.toUpperCase() || 'SEKOLAH DASAR NEGERI 2 CEMPAKA'}
            </div>
            <div className={lineAlamatCls}>
              {config.kopAlamat || config.alamat || 'Jl. Raden Cempa No. 101 Desa Cempaka Kec. Talun Kab. Cirebon 45171'}
            </div>
          </div>

          <div
            className="invisible pointer-events-none"
            style={{ width: `${rightWidth}px`, height: `${maxH + 6}px` }}
            aria-hidden="true"
          />
        </div>

        <div className="mt-3.5 border-b-[2.5px] border-black" />
        <div className="mt-[2px] border-b-[1px] border-black" />
      </div>
    );
  }

  const sideColWidth = isCompact ? 88 : Math.max(96, pemdaMaxW + 8, sekolahMaxW + 8);

  // Layout 2: Left & Right logos
  if (layout === 'kiri_kanan') {
    return (
      <div className={`relative pb-3 mb-6 select-text ${className}`}>
        <div
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: `${sideColWidth}px 1fr ${sideColWidth}px` }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: `${sideColWidth}px`, minHeight: `${maxH + 6}px` }}
          >
            {logoPemda ? (
              <img
                src={logoPemda}
                alt="Logo Pemda"
                className="logo-hd object-contain drop-shadow-xs"
                style={{ height: `${pemdaH}px`, maxHeight: `${pemdaH}px`, maxWidth: `${pemdaMaxW}px`, width: 'auto' }}
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
            <div className={lineIndukCls}>
              {config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}
            </div>
            <div className={`${lineIndukCls} mt-0.5`}>
              {config.kopInduk2 || 'DINAS PENDIDIKAN'}
            </div>
            <div className={lineSekolahCls}>
              {config.namaSekolah?.toUpperCase() || 'SEKOLAH DASAR NEGERI 2 CEMPAKA'}
            </div>
            <div className={lineAlamatCls}>
              {config.kopAlamat || config.alamat}
            </div>
          </div>

          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: `${sideColWidth}px`, minHeight: `${maxH + 6}px` }}
          >
            {logoSekolah ? (
              <img
                src={logoSekolah}
                alt="Logo Sekolah"
                className="logo-hd object-contain drop-shadow-xs"
                style={{ height: `${sekolahH}px`, maxHeight: `${sekolahH}px`, maxWidth: `${sekolahMaxW}px`, width: 'auto' }}
                loading="eager"
                decoding="sync"
              />
            ) : (
              <div style={{ width: `${sideColWidth}px` }} className="invisible pointer-events-none" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="mt-3.5 border-b-[2.5px] border-black" />
        <div className="mt-[2px] border-b-[1px] border-black" />
      </div>
    );
  }

  // Layout 3 or 4: Single logo
  const isPemdaSingle = layout === 'kiri_pemda_saja' || !logoSekolah;
  const singleLogo = layout === 'kiri_pemda_saja' ? logoPemda : (logoSekolah || logoPemda);
  const singleH = isPemdaSingle ? pemdaH : sekolahH;
  const singleMaxW = isPemdaSingle ? pemdaMaxW : sekolahMaxW;
  const singleSideW = isCompact ? 88 : Math.max(96, singleMaxW + 8);
  return (
    <div className={`relative pb-3 mb-6 select-text ${className}`}>
      <div
        className="grid items-center gap-3"
        style={{ gridTemplateColumns: `${singleSideW}px 1fr ${singleSideW}px` }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: `${singleSideW}px`, minHeight: `${singleH + 6}px` }}
        >
          {singleLogo ? (
            <img
              src={singleLogo}
              alt="Logo"
              className="logo-hd object-contain drop-shadow-xs"
              style={{ height: `${singleH}px`, maxHeight: `${singleH}px`, maxWidth: `${singleMaxW}px`, width: 'auto' }}
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
          <div className={lineIndukCls}>
            {config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON'}
          </div>
          <div className={`${lineIndukCls} mt-0.5`}>
            {config.kopInduk2 || 'DINAS PENDIDIKAN'}
          </div>
          <div className={lineSekolahCls}>
            {config.namaSekolah?.toUpperCase() || 'SEKOLAH DASAR NEGERI 2 CEMPAKA'}
          </div>
          <div className={lineAlamatCls}>
            {config.kopAlamat || config.alamat}
          </div>
        </div>

        <div style={{ width: `${singleSideW}px` }} className="invisible pointer-events-none" aria-hidden="true" />
      </div>

      <div className="mt-3.5 border-b-[2.5px] border-black" />
      <div className="mt-[2px] border-b-[1px] border-black" />
    </div>
  );
};
