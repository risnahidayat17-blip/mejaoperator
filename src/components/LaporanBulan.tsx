/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SchoolConfig, Siswa, Guru, LaporanBulan as ILaporanBulan } from '../types';
import { getFromStorage, setToStorage, KEYS } from '../lib/storage';
import { Daftar1Pages, hitungTotalBulanMasaKerja, parseTmtDate } from './Daftar1Sheet';
import { EditDaftar1Modal } from './EditDaftar1Modal';
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [laporanVersion, setLaporanVersion] = useState(0);

  const laporanList = getFromStorage<ILaporanBulan[]>(KEYS.LAPORAN, []);
  const reportData = laporanList.find((l) => l.id === selectedMonth) || { id: selectedMonth };

  const [yy, mm] = selectedMonth.split('-').map(Number);
  const activeGuru = guru
    .filter((g) => g.status !== 'Nonaktif')
    .slice()
    .sort((a, b) => {
      const bMasa = hitungTotalBulanMasaKerja(b, yy || new Date().getFullYear(), mm || new Date().getMonth() + 1);
      const aMasa = hitungTotalBulanMasaKerja(a, yy || new Date().getFullYear(), mm || new Date().getMonth() + 1);
      if (bMasa !== aMasa) return bMasa - aMasa;
      const aP = parseTmtDate(a.tmt);
      const bP = parseTmtDate(b.tmt);
      const aTmtVal = aP ? aP.y * 10000 + aP.m * 100 + aP.d : 99999999;
      const bTmtVal = bP ? bP.y * 10000 + bP.m * 100 + bP.d : 99999999;
      if (aTmtVal !== bTmtVal) return aTmtVal - bTmtVal;
      return a.nama.localeCompare(b.nama);
    });

  // Preview berskala: lembar F4 landscape (330 mm = 1247 px) dikecilkan agar muat di layar
  const PAGE_PX = 1247.2;
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const update = () => {
      setScale(Math.min(1, Math.max(0.3, (wrap.clientWidth - 16) / PAGE_PX)));
      setInnerH(inner.offsetHeight);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const handlePrint = () => {
    const styleEl = document.createElement('style');
    styleEl.textContent = '@page{size:330mm 216mm;margin:0}';
    document.head.appendChild(styleEl);
    document.body.classList.add('printing-laporan');
    const cleanUp = () => {
      document.body.classList.remove('printing-laporan');
      styleEl.remove();
      window.removeEventListener('afterprint', cleanUp);
    };
    window.addEventListener('afterprint', cleanUp);
    setTimeout(() => window.print(), 60);
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
    setLaporanVersion((v) => v + 1);
    setIsModalAbsenOpen(false);
    onToast(`Data absensi bulan ${selectedMonth} berhasil disimpan.`);
  };

  const handleSaveReport = (updatedReport: ILaporanBulan) => {
    const currentList = getFromStorage<ILaporanBulan[]>(KEYS.LAPORAN, []);
    const idx = currentList.findIndex((l) => l.id === selectedMonth);
    if (idx >= 0) {
      currentList[idx] = updatedReport;
    } else {
      currentList.push(updatedReport);
    }
    setToStorage(KEYS.LAPORAN, currentList);
    setLaporanVersion((v) => v + 1);
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
            Format Daftar 1 (F4 landscape): statistik murid, sarana sekolah, absen, dan daftar Guru–Guru.
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
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#0B6B58] hover:bg-[#095747] text-white rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit / Betulkan Data Daftar 1
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-white border border-[#D3DDD9] hover:bg-[#F3F7F5] text-[#13262A] text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-2 cursor-pointer transition"
          >
            <Printer className="w-4 h-4 text-[#0B6B58]" /> Cetak Daftar 1
          </button>
        </div>
      </div>

      {/* Preview Daftar 1 (F4 landscape, 2 halaman) */}
      <div ref={wrapRef} className="w-full bg-[#F1F4F2] rounded-xl overflow-hidden p-2 lb-preview">
        <div style={{ width: PAGE_PX * scale, height: innerH * scale, margin: '0 auto' }}>
          <div
            ref={innerRef}
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_PX }}
          >
            <Daftar1Pages
              key={`${selectedMonth}_${laporanVersion}`}
              config={config}
              siswa={siswa}
              guru={guru}
              reportData={reportData}
              month={selectedMonth}
            />
          </div>
        </div>
      </div>

      {createPortal(
        <div id="lb-print-root">
          <Daftar1Pages
            key={`print_${selectedMonth}_${laporanVersion}`}
            config={config}
            siswa={siswa}
            guru={guru}
            reportData={reportData}
            month={selectedMonth}
          />
        </div>,
        document.body,
      )}

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
                      defaultValue={reportData.murid?.sakit || 0}
                      className="w-full px-2 py-1 border rounded font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Izin</label>
                    <input
                      type="number"
                      name="m_izin"
                      defaultValue={reportData.murid?.izin || 0}
                      className="w-full px-2 py-1 border rounded font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Alpa</label>
                    <input
                      type="number"
                      name="m_alpa"
                      defaultValue={reportData.murid?.alpa || 0}
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

      {/* MODAL EDIT / BETULKAN DATA DAFTAR 1 */}
      <EditDaftar1Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        month={selectedMonth}
        config={config}
        guruList={guru}
        reportData={reportData}
        onSave={handleSaveReport}
        onToast={onToast}
      />
    </div>
  );
};
