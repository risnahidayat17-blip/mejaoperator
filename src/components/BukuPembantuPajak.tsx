/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import { KeuanganEditRow, KeuanganState, SchoolConfig, SpjPajakSkema } from '../types';
import { resolveBkuTax, SKEMA_PAJAK_OPTIONS } from '../lib/pajakBku';
import { printDomElement } from '../lib/print';
import { KopSuratHD } from './KopSuratHD';
import {
  Printer,
  RotateCcw,
  CheckCircle2,
  Search,
  ExternalLink,
  Upload,
  Calculator,
  ReceiptText,
} from 'lucide-react';

interface BukuPembantuPajakProps {
  config: SchoolConfig;
  state: KeuanganState;
  onUpdateRowEdit: (rowId: string, patch: Partial<KeuanganEditRow>) => void;
  onPatchAllEdits: (nextEdits: KeuanganState['edits']) => void;
  onUpdateSettings: (patch: Partial<KeuanganState['settings']>) => void;
  onOpenInSpj: (rowId: string) => void;
  onGoToImport: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatRupiah(val: number): string {
  return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
}

function formatAngka(val: number): string {
  const n = Math.round(val || 0);
  return n === 0 ? '-' : n.toLocaleString('id-ID');
}

function formatTglPendek(tgl?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tgl || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : tgl || '-';
}

function formatTglIndo(tgl?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tgl || '');
  return m ? `${parseInt(m[3], 10)} ${MONTH_NAMES[parseInt(m[2], 10) - 1]} ${m[1]}` : tgl || '';
}

export const BukuPembantuPajak: React.FC<BukuPembantuPajakProps> = ({
  config,
  state,
  onUpdateRowEdit,
  onPatchAllEdits,
  onUpdateSettings,
  onOpenInSpj,
  onGoToImport,
  onToast,
}) => {
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [onlyTaxable, setOnlyTaxable] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const autoEnabled = state.settings.pajakOtomatis !== false;
  const defaultNpwp = state.settings.defaultNpwp !== false;
  const tarifPph21Default = state.settings.tarifPph21Default ?? 5;

  // Available months from BKU dates
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    state.bku.forEach((r) => {
      const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(r.tgl || '');
      if (m) {
        const key = `${m[1]}-${m[2]}`;
        const label = `${MONTH_NAMES[parseInt(m[2], 10) - 1]} ${m[1]}`;
        map.set(key, label);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [state.bku]);

  const computedRows = useMemo(() => {
    return state.bku.map((row) => {
      const edit = state.edits[row.id];
      const tax = resolveBkuTax(row, edit, state.settings);
      const totalPajak = tax.ppn + tax.pph;
      const disetor = Boolean(edit?.pajakDisetor) && totalPajak > 0;
      return {
        row,
        edit,
        tax,
        totalPajak,
        disetor,
      };
    });
  }, [state.bku, state.edits, state.settings]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return computedRows.filter(({ row, edit, totalPajak }) => {
      if (monthFilter !== 'ALL') {
        if (!(row.tgl || '').startsWith(monthFilter)) return false;
      }
      if (onlyTaxable && totalPajak <= 0) return false;
      if (q) {
        const hay = `${row.uraian} ${row.noBukti} ${edit?.untuk || ''} ${edit?.pajakNtpn || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [computedRows, monthFilter, onlyTaxable, search]);

  const summary = useMemo(() => {
    let totalBruto = 0;
    let totalPpn = 0;
    let totalPph21 = 0;
    let totalPph22 = 0;
    let totalPph23 = 0;
    let totalDisetor = 0;
    let taxableCount = 0;

    filteredRows.forEach(({ row, tax, totalPajak, disetor }) => {
      totalBruto += Math.round(Number(row.pengeluaran) || 0);
      totalPpn += tax.ppn;
      totalPph21 += tax.pph21;
      totalPph22 += tax.pph22;
      totalPph23 += tax.pph23;
      if (totalPajak > 0) taxableCount += 1;
      if (disetor) totalDisetor += totalPajak;
    });

    const totalPph = totalPph21 + totalPph22 + totalPph23;
    const totalPajak = totalPpn + totalPph;
    const saldoBelumSetor = Math.max(0, totalPajak - totalDisetor);

    return {
      totalBruto,
      totalPpn,
      totalPph,
      totalPph21,
      totalPph22,
      totalPph23,
      totalPajak,
      totalDisetor,
      saldoBelumSetor,
      taxableCount,
    };
  }, [filteredRows]);

  // Ledger entries for Official Print View (chronological Pungut/Potong & Setor rows)
  const printLedger = useMemo(() => {
    type RawEntry = {
      id: string;
      sortDate: string;
      order: number;
      seq: number;
      tgl: string;
      kodeRek: string;
      noBukti: string;
      uraian: string;
      ppn: number;
      pph21: number;
      pph22: number;
      pph23: number;
      pengeluaran: number;
    };

    const raw: RawEntry[] = [];
    filteredRows.forEach(({ row, edit, tax, totalPajak, disetor }, idx) => {
      if (totalPajak <= 0) return;
      const tglPotong = edit?.tgl || row.tgl || '';
      const kodeRek = edit?.kodeRek || row.kodeRek || '';
      const noBukti = row.noBukti || `BKU-${String(idx + 1).padStart(3, '0')}`;
      const uraianBelanja = edit?.untuk || row.uraian;

      const pajakParts: string[] = [];
      if (tax.ppn > 0) pajakParts.push('PPN');
      if (tax.pph21 > 0) pajakParts.push('PPh 21');
      if (tax.pph22 > 0) pajakParts.push('PPh 22');
      if (tax.pph23 > 0) pajakParts.push('PPh 23');
      const jenisLabel = pajakParts.join(' & ') || 'Pajak';

      raw.push({
        id: `${row.id}-potong`,
        sortDate: tglPotong || '9999-99-99',
        order: 0,
        seq: idx,
        tgl: tglPotong,
        kodeRek,
        noBukti,
        uraian: `Potong/Pungut ${jenisLabel} atas ${uraianBelanja}`,
        ppn: tax.ppn,
        pph21: tax.pph21,
        pph22: tax.pph22,
        pph23: tax.pph23,
        pengeluaran: 0,
      });

      if (disetor) {
        const tglSetor = edit?.pajakTglSetor || tglPotong;
        raw.push({
          id: `${row.id}-setor`,
          sortDate: tglSetor || '9999-99-99',
          order: 1,
          seq: idx,
          tgl: tglSetor,
          kodeRek,
          noBukti: edit?.pajakNtpn?.trim() || noBukti,
          uraian: `Setor ${jenisLabel} (${edit?.pajakNtpn?.trim() ? `NTPN: ${edit.pajakNtpn.trim()}` : 'Bukti Setor'}) - ${uraianBelanja}`,
          ppn: 0,
          pph21: 0,
          pph22: 0,
          pph23: 0,
          pengeluaran: totalPajak,
        });
      }
    });

    raw.sort((a, b) => {
      if (a.sortDate !== b.sortDate) return a.sortDate.localeCompare(b.sortDate);
      if (a.seq !== b.seq) return a.seq - b.seq;
      return a.order - b.order;
    });

    let runningSaldo = 0;
    return raw.map((item) => {
      runningSaldo += item.ppn + item.pph21 + item.pph22 + item.pph23 - item.pengeluaran;
      return {
        ...item,
        saldo: runningSaldo,
      };
    });
  }, [filteredRows]);

  const handleResetAllAuto = () => {
    const nextEdits: KeuanganState['edits'] = { ...state.edits };
    filteredRows.forEach(({ row }) => {
      const existing = nextEdits[row.id];
      if (!existing) return;
      nextEdits[row.id] = {
        ...existing,
        pajakManual: false,
        pajakSkema: 'auto',
        ppn: undefined,
        pph: undefined,
      };
    });
    onPatchAllEdits(nextEdits);
    if (!autoEnabled) {
      onUpdateSettings({ pajakOtomatis: true });
    }
    onToast('Pemotongan pajak seluruh transaksi BKU dihitung ulang otomatis.');
  };

  const handleMarkAllDisetor = () => {
    const nextEdits: KeuanganState['edits'] = { ...state.edits };
    const today = new Date().toISOString().slice(0, 10);
    let updatedCount = 0;
    filteredRows.forEach(({ row, edit, totalPajak }) => {
      if (totalPajak <= 0) return;
      updatedCount += 1;
      nextEdits[row.id] = {
        ...edit,
        pajakDisetor: true,
        pajakTglSetor: edit?.pajakTglSetor || edit?.tgl || row.tgl || today,
      };
    });
    if (updatedCount === 0) {
      onToast('Tidak ada transaksi kena pajak pada filter saat ini.', true);
      return;
    }
    onPatchAllEdits(nextEdits);
    onToast(`${updatedCount} transaksi pajak ditandai sudah disetor.`);
  };

  const handlePrint = async () => {
    if (printLedger.length === 0) {
      onToast('Belum ada transaksi kena pajak untuk dicetak pada Buku Pembantu Pajak.', true);
      return;
    }
    await printDomElement(printRef.current, {
      paper: 'A4-landscape',
      margin: '10mm 12mm',
    });
  };

  if (state.bku.length === 0) {
    return (
      <div className="bg-white border border-[#D3DDD9] rounded-xl p-10 text-center space-y-3">
        <ReceiptText className="w-10 h-10 mx-auto text-[#0B6B58]" />
        <h3 className="text-sm font-bold text-[#13262A]">Buku Pembantu Pajak Belum Tersedia</h3>
        <p className="text-xs text-[#566A6E] max-w-md mx-auto">
          Import data BKU (Excel, CSV, atau PDF) atau tambahkan transaksi BKU terlebih dahulu agar pemotongan PPN, PPh Ps. 21, PPh Ps. 22, dan PPh Ps. 23 terhitung otomatis.
        </p>
        <button
          type="button"
          onClick={onGoToImport}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Ke Menu Import BKU
        </button>
      </div>
    );
  }

  const periodeLabel =
    monthFilter === 'ALL'
      ? availableMonths.length > 0
        ? `${availableMonths[0][1]} s.d. ${availableMonths[availableMonths.length - 1][1]}`
        : 'Semua Periode'
      : availableMonths.find(([k]) => k === monthFilter)?.[1] || monthFilter;

  const tahunAnggaran =
    state.settings.tahunAnggaran?.trim() ||
    state.bku.find((r) => /^\d{4}/.test(r.tgl))?.tgl.slice(0, 4) ||
    String(new Date().getFullYear());

  const kotaCetak = state.settings.kota || config.kabupaten || 'Cirebon';
  const tglCetak = formatTglIndo(new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-[#566A6E]">Belanja Bruto BKU</div>
          <div className="text-base font-bold text-[#13262A] font-mono mt-1">{formatRupiah(summary.totalBruto)}</div>
          <div className="text-[11px] text-[#566A6E] mt-0.5">
            {summary.taxableCount} dari {filteredRows.length} transaksi kena pajak
          </div>
        </div>
        <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-[#566A6E]">Total Pungut PPN (11%)</div>
          <div className="text-base font-bold text-[#0B6B58] font-mono mt-1">{formatRupiah(summary.totalPpn)}</div>
          <div className="text-[11px] text-[#566A6E] mt-0.5">Belanja barang/jasa ≥ Rp 2 jt</div>
        </div>
        <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-[#566A6E]">Total Potong PPh (21/22/23)</div>
          <div className="text-base font-bold text-indigo-700 font-mono mt-1">{formatRupiah(summary.totalPph)}</div>
          <div className="text-[11px] text-[#566A6E] mt-0.5">
            21: {formatRupiah(summary.totalPph21)} &middot; 22: {formatRupiah(summary.totalPph22)} &middot; 23: {formatRupiah(summary.totalPph23)}
          </div>
        </div>
        <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5">
          <div className="text-[11px] font-semibold text-[#566A6E]">Total Pajak Sudah Disetor</div>
          <div className="text-base font-bold text-emerald-700 font-mono mt-1">{formatRupiah(summary.totalDisetor)}</div>
          <div className="text-[11px] text-[#566A6E] mt-0.5">Dari total pajak {formatRupiah(summary.totalPajak)}</div>
        </div>
        <div
          className={`border rounded-xl p-3.5 ${
            summary.saldoBelumSetor > 0
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-emerald-50/60 border-emerald-200'
          }`}
        >
          <div className="text-[11px] font-semibold text-[#566A6E]">Saldo Pajak Belum Disetor</div>
          <div
            className={`text-base font-bold font-mono mt-1 ${
              summary.saldoBelumSetor > 0 ? 'text-amber-800' : 'text-emerald-800'
            }`}
          >
            {formatRupiah(summary.saldoBelumSetor)}
          </div>
          <div className="text-[11px] text-[#566A6E] mt-0.5">
            {summary.saldoBelumSetor === 0 ? 'Semua pajak lunas disetor' : 'Menunggu setor NTPN'}
          </div>
        </div>
      </div>

      {/* Auto Tax Rules & Toolbar */}
      <div className="bg-white border border-[#D3DDD9] rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D3DDD9] bg-[#F8FAF9] text-xs font-semibold text-[#13262A] cursor-pointer">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => onUpdateSettings({ pajakOtomatis: e.target.checked })}
                className="accent-[#0B6B58]"
              />
              <Calculator className="w-3.5 h-3.5 text-[#0B6B58]" />
              Potong Pajak Otomatis dari BKU
            </label>

            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D3DDD9] bg-[#F8FAF9] text-xs font-medium text-[#13262A] cursor-pointer">
              <input
                type="checkbox"
                checked={defaultNpwp}
                onChange={(e) => onUpdateSettings({ defaultNpwp: e.target.checked })}
                className="accent-[#0B6B58]"
              />
              Default Rekanan Ber-NPWP
            </label>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#D3DDD9] bg-[#F8FAF9] text-xs">
              <span className="text-[11px] font-semibold text-[#566A6E]">Tarif PPh 21 Honor:</span>
              <select
                value={String(tarifPph21Default)}
                onChange={(e) => onUpdateSettings({ tarifPph21Default: Number(e.target.value) })}
                className="bg-white border border-[#D3DDD9] rounded px-1.5 py-0.5 text-xs font-semibold text-[#13262A]"
              >
                <option value="0">0%</option>
                <option value="2.5">2,5%</option>
                <option value="5">5%</option>
                <option value="6">6% (Non-NPWP)</option>
                <option value="15">15% (Gol. III/PNS)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetAllAuto}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D3DDD9] bg-white hover:bg-gray-50 text-xs font-semibold text-[#13262A] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#0B6B58]" />
              Hitung Ulang Otomatis
            </button>
            <button
              type="button"
              onClick={handleMarkAllDisetor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tandai Semua Disetor
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / PDF Buku Pajak (A4 Landscape)
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E4EBE8]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#566A6E]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari uraian transaksi, no. bukti, atau NTPN..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white focus:outline-none focus:border-[#0B6B58]"
            />
          </div>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white font-semibold text-[#13262A]"
          >
            <option value="ALL">Semua Bulan ({state.bku.length})</option>
            {availableMonths.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#566A6E] cursor-pointer px-2">
            <input
              type="checkbox"
              checked={onlyTaxable}
              onChange={(e) => setOnlyTaxable(e.target.checked)}
              className="accent-[#0B6B58]"
            />
            Hanya transaksi kena pajak
          </label>

          <span className="text-[11px] text-[#566A6E] ml-auto">
            Aturan otomatis: Barang ≥ 2 jt (PPN 11% + PPh 22), Jasa/Konsumsi (PPh 23), Honor (PPh 21), Utilitas/Mutasi/SPPD (Bebas).
          </span>
        </div>
      </div>

      {/* Interactive Table */}
      <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F4F7F5] text-[#13262A] border-b border-[#D3DDD9] text-[11px]">
                <th className="px-3 py-2.5 text-left font-bold whitespace-nowrap">Tgl &amp; No. Bukti</th>
                <th className="px-3 py-2.5 text-left font-bold min-w-[240px]">Uraian Transaksi BKU</th>
                <th className="px-3 py-2.5 text-right font-bold whitespace-nowrap">Bruto BKU</th>
                <th className="px-3 py-2.5 text-left font-bold min-w-[180px]">Skema Pajak &amp; NPWP</th>
                <th className="px-3 py-2.5 text-right font-bold whitespace-nowrap">PPN (Rp)</th>
                <th className="px-3 py-2.5 text-right font-bold whitespace-nowrap">PPh (Rp)</th>
                <th className="px-3 py-2.5 text-right font-bold whitespace-nowrap">Netto Dibayar</th>
                <th className="px-3 py-2.5 text-left font-bold min-w-[205px]">Setor Pajak &amp; NTPN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEFED]">
              {filteredRows.map(({ row, edit, tax, totalPajak, disetor }) => {
                const isTaxable = totalPajak > 0;
                return (
                  <tr key={row.id} className={isTaxable ? 'bg-white hover:bg-[#FAFDFB]' : 'bg-gray-50/40 hover:bg-gray-50'}>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <div className="font-semibold text-[#13262A]">{formatTglPendek(edit?.tgl || row.tgl)}</div>
                      <div className="text-[11px] font-mono text-[#566A6E] mt-0.5">{row.noBukti || '-'}</div>
                    </td>

                    <td className="px-3 py-2.5 align-top">
                      <div className="font-semibold text-[#13262A] leading-snug">{edit?.untuk || row.uraian}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${
                            tax.isManual
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : isTaxable
                                ? 'bg-emerald-50 border-emerald-200 text-[#0B6B58]'
                                : 'bg-gray-100 border-gray-200 text-gray-600'
                          }`}
                        >
                          {tax.ruleReason}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenInSpj(row.id)}
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#0B6B58] hover:underline cursor-pointer"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Buka SPJ
                        </button>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 align-top text-right font-mono font-bold text-[#13262A] whitespace-nowrap">
                      {formatRupiah(row.pengeluaran)}
                    </td>

                    <td className="px-3 py-2.5 align-top">
                      <select
                        value={edit?.pajakSkema ?? 'auto'}
                        onChange={(e) => {
                          const nextSkema = e.target.value as SpjPajakSkema;
                          onUpdateRowEdit(row.id, {
                            pajakSkema: nextSkema,
                            pajakManual: false,
                            ppn: undefined,
                            pph: undefined,
                          });
                        }}
                        className="w-full px-2 py-1 text-[11px] border border-[#D3DDD9] rounded-md bg-white text-[#13262A]"
                      >
                        {SKEMA_PAJAK_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <label className="inline-flex items-center gap-1 text-[11px] text-[#566A6E] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tax.hasNpwp}
                            onChange={(e) =>
                              onUpdateRowEdit(row.id, {
                                pajakHasNpwp: e.target.checked,
                                pajakManual: false,
                              })
                            }
                            className="accent-[#0B6B58]"
                          />
                          Ber-NPWP
                        </label>
                        {tax.isManual && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRowEdit(row.id, {
                                pajakManual: false,
                                ppn: undefined,
                                pph: undefined,
                              })
                            }
                            className="text-[10px] font-semibold text-[#0B6B58] hover:underline cursor-pointer"
                          >
                            Reset Auto
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 align-top text-right">
                      <input
                        type="number"
                        min={0}
                        value={tax.ppn}
                        onChange={(e) => {
                          const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                          onUpdateRowEdit(row.id, {
                            pajakManual: true,
                            ppn: val,
                            pph: tax.pph,
                            jenisPph: tax.jenisPph,
                          });
                        }}
                        className="w-24 px-2 py-1 text-right font-mono text-[11px] border border-[#D3DDD9] rounded-md bg-white focus:outline-none focus:border-[#0B6B58]"
                      />
                    </td>

                    <td className="px-3 py-2.5 align-top text-right">
                      <input
                        type="number"
                        min={0}
                        value={tax.pph}
                        onChange={(e) => {
                          const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                          onUpdateRowEdit(row.id, {
                            pajakManual: true,
                            ppn: tax.ppn,
                            pph: val,
                            jenisPph: tax.jenisPph,
                          });
                        }}
                        className="w-24 px-2 py-1 text-right font-mono text-[11px] border border-[#D3DDD9] rounded-md bg-white focus:outline-none focus:border-[#0B6B58]"
                      />
                      {tax.pph > 0 && (
                        <div className="text-[10px] text-[#566A6E] mt-0.5">{tax.jenisPph}</div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 align-top text-right font-mono font-semibold text-[#0B6B58] whitespace-nowrap">
                      {formatRupiah(tax.netto)}
                    </td>

                    <td className="px-3 py-2.5 align-top">
                      {isTaxable ? (
                        <div className="space-y-1.5">
                          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={disetor}
                              onChange={(e) =>
                                onUpdateRowEdit(row.id, {
                                  pajakDisetor: e.target.checked,
                                  pajakTglSetor:
                                    e.target.checked && !edit?.pajakTglSetor
                                      ? edit?.tgl || row.tgl || new Date().toISOString().slice(0, 10)
                                      : edit?.pajakTglSetor,
                                })
                              }
                              className="accent-[#0B6B58]"
                            />
                            <span className={disetor ? 'text-emerald-700' : 'text-amber-700'}>
                              {disetor ? 'Sudah Disetor' : 'Belum Disetor'}
                            </span>
                          </label>

                          {disetor && (
                            <div className="grid grid-cols-2 gap-1">
                              <input
                                type="date"
                                value={edit?.pajakTglSetor || row.tgl || ''}
                                onChange={(e) => onUpdateRowEdit(row.id, { pajakTglSetor: e.target.value })}
                                className="px-1.5 py-0.5 text-[10px] border border-[#D3DDD9] rounded bg-white"
                                title="Tanggal Setor Pajak"
                              />
                              <input
                                type="text"
                                value={edit?.pajakNtpn || ''}
                                onChange={(e) => onUpdateRowEdit(row.id, { pajakNtpn: e.target.value })}
                                placeholder="No. NTPN"
                                className="px-1.5 py-0.5 text-[10px] border border-[#D3DDD9] rounded bg-white font-mono"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#8EA09B]">Non-Pajak</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-[#566A6E]">
                    Tidak ada transaksi BKU yang sesuai filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Offscreen A4 Landscape Printable Buku Pembantu Pajak */}
      <div className="hidden" aria-hidden="true">
        <div
          ref={printRef}
          className="text-black bg-white"
          style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '10pt', lineHeight: 1.3 }}
        >
          <KopSuratHD config={config} logoHeight={60} className="!mb-2 !pb-2" />

          <div className="text-center mb-3">
            <div className="text-[13pt] font-bold uppercase tracking-wide underline">
              BUKU PEMBANTU PAJAK
            </div>
            <div className="text-[10pt] font-semibold mt-0.5">
              PERIODE : {periodeLabel.toUpperCase()} &middot; TAHUN ANGGARAN {tahunAnggaran}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[9.5pt] mb-3">
            <div>
              <span className="inline-block w-32 font-semibold">Nama Sekolah</span>: {config.namaSekolah}
            </div>
            <div>
              <span className="inline-block w-32 font-semibold">Sumber Dana</span>: {state.settings.sumberDana || 'BOSP'}
            </div>
            <div>
              <span className="inline-block w-32 font-semibold">NPSN</span>: {config.npsn || '-'}
            </div>
            <div>
              <span className="inline-block w-32 font-semibold">Kabupaten / Kota</span>: {kotaCetak}
            </div>
          </div>

          <table className="w-full border-collapse text-[8.5pt]" style={{ border: '1px solid #000' }}>
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan={2} className="border border-black px-1.5 py-1 text-center align-middle w-[68px]">
                  Tanggal
                </th>
                <th rowSpan={2} className="border border-black px-1.5 py-1 text-center align-middle w-[84px]">
                  No. Kode
                </th>
                <th rowSpan={2} className="border border-black px-1.5 py-1 text-center align-middle w-[78px]">
                  No. Bukti
                </th>
                <th rowSpan={2} className="border border-black px-2 py-1 text-center align-middle">
                  Uraian
                </th>
                <th colSpan={4} className="border border-black px-1.5 py-1 text-center">
                  Penerimaan / Pemotongan (Rp)
                </th>
                <th rowSpan={2} className="border border-black px-1.5 py-1 text-center align-middle w-[82px]">
                  Pengeluaran / Setor (Rp)
                </th>
                <th rowSpan={2} className="border border-black px-1.5 py-1 text-center align-middle w-[86px]">
                  Saldo (Rp)
                </th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border border-black px-1.5 py-1 text-center w-[72px]">PPN</th>
                <th className="border border-black px-1.5 py-1 text-center w-[72px]">PPh Ps. 21</th>
                <th className="border border-black px-1.5 py-1 text-center w-[72px]">PPh Ps. 22</th>
                <th className="border border-black px-1.5 py-1 text-center w-[72px]">PPh Ps. 23</th>
              </tr>
            </thead>
            <tbody>
              {printLedger.map((item) => (
                <tr key={item.id}>
                  <td className="border border-black px-1.5 py-1 text-center whitespace-nowrap">
                    {formatTglPendek(item.tgl)}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-center font-mono text-[8pt]">
                    {item.kodeRek || '-'}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-center font-mono text-[8pt]">
                    {item.noBukti}
                  </td>
                  <td className="border border-black px-2 py-1">{item.uraian}</td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono">
                    {formatAngka(item.ppn)}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono">
                    {formatAngka(item.pph21)}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono">
                    {formatAngka(item.pph22)}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono">
                    {formatAngka(item.pph23)}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono">
                    {formatAngka(item.pengeluaran)}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono font-bold">
                    {item.saldo.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-50">
                <td colSpan={4} className="border border-black px-2 py-1.5 text-right uppercase">
                  Jumlah Total
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right font-mono">
                  {summary.totalPpn.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right font-mono">
                  {summary.totalPph21.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right font-mono">
                  {summary.totalPph22.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right font-mono">
                  {summary.totalPph23.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right font-mono">
                  {summary.totalDisetor.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-1.5 py-1.5 text-right font-mono">
                  {summary.saldoBelumSetor.toLocaleString('id-ID')}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-5 grid grid-cols-2 gap-8 text-[9.5pt]" style={{ pageBreakInside: 'avoid' }}>
            <div className="text-center">
              <div>Mengetahui,</div>
              <div>Kepala Sekolah</div>
              <div className="h-14" />
              <div className="font-bold underline">{config.kepsek || '-'}</div>
              <div>NIP. {config.nipKepsek || '-'}</div>
            </div>
            <div className="text-center">
              <div>
                {kotaCetak}, {tglCetak}
              </div>
              <div>Bendahara {state.settings.sumberDana || 'BOS'}</div>
              <div className="h-14" />
              <div className="font-bold underline">{state.settings.bendaharaNama || '-'}</div>
              <div>NIP. {state.settings.bendaharaNip || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
