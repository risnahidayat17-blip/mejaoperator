/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KeuanganEditRow, KeuanganState, SpjKategori, SpjPajakSkema } from '../types';

export const SKEMA_PAJAK_OPTIONS: Array<{
  id: SpjPajakSkema;
  label: string;
  shortLabel: string;
}> = [
  { id: 'auto', label: 'Otomatis (Sesuai Aturan BOSP)', shortLabel: 'Otomatis' },
  { id: 'ppn_pph22', label: 'PPN 11% + PPh Ps. 22 (Barang)', shortLabel: 'PPN + PPh 22' },
  { id: 'ppn_pph23', label: 'PPN 11% + PPh Ps. 23 (Jasa)', shortLabel: 'PPN + PPh 23' },
  { id: 'pph23', label: 'PPh Ps. 23 Saja (Konsumsi / Jasa < 2 Jt)', shortLabel: 'PPh 23' },
  { id: 'pph21', label: 'PPh Ps. 21 (Honorarium / Upah / Lembur)', shortLabel: 'PPh 21' },
  { id: 'ppn_only', label: 'PPN 11% Saja', shortLabel: 'PPN 11%' },
  { id: 'bebas', label: 'Bebas / Non-Objek Pajak', shortLabel: 'Bebas Pajak' },
];

export interface ResolvedBkuTax {
  skemaEfektif: Exclude<SpjPajakSkema, 'auto'>;
  skemaLabel: string;
  ruleReason: string;
  dpp: number;
  ppn: number;
  pph: number;
  pph21: number;
  pph22: number;
  pph23: number;
  jenisPph: string;
  netto: number;
  hasNpwp: boolean;
  isManual: boolean;
}

const MUTASI_KAS_RX =
  /\b(diambil\s+dana|diterima\s+dana|pergeseran|tarik\s+tunai|setor\s+tunai|pindah\s*buku|saldo\s+awal|bunga\s+bank|adm\s+bank)\b/i;

const BEBAS_PAJAK_RX =
  /\b(listrik|pln|pdam|air\s+bersih|telepon|telkom|internet|wifi|indihome|pulsa|kuota\s+data|materai|meterai|benda\s+pos|buku\s+pelajaran|buku\s+teks|ppdb\s+gratis|iuran|retribusi)\b/i;

const KONSUMSI_RX =
  /\b(makan|minum|mamin|konsumsi|snack|katering|catering|nasi\s+kotak|nasi\s+box|kue|jamuan|air\s+mineral|galon|rapat)\b/i;

const JASA_RX =
  /\b(jasa|servis|service|sewa|perbaikan|pemeliharaan|rehab|tukang|sablon|percetakan|pengecatan|laundry|cuci|pasang|instalasi|kalibrasi|fotokopi|jilid)\b/i;

function inferKategori(uraian: string, kodeRek: string): SpjKategori {
  if (
    /\b(sppd|perjalanan\s*dinas|perjadin|uang\s*harian|tiket|penginapan|akomodasi|transport\s*dinas|transportasi\s*dinas|dalam\s*daerah|luar\s*daerah)\b/i.test(
      uraian
    ) ||
    /^5\.1\.02\.04\b/.test(kodeRek)
  ) {
    return 'sppd';
  }
  if (/\b(lembur|uang\s*lembur|makan\s*lembur|overtime)\b/i.test(uraian)) {
    return 'lembur';
  }
  if (
    /\b(honor|honorarium|insentif|upah\s*(?:mengajar|tenaga|guru|karyawan|tukang)?|narasumber|pemateri|pelatih|ekskul|ekstrakurikuler|pengawas\s*(?:ujian|asesmen)|koreksi|panitia|petugas|gaji|guru\s*honorer|tendik|ptt|gtt|jasa\s*(?:profesi|pelatih|tenaga|pendidik|pengajar|operator|keamanan|kebersihan)|jaspel|pembina|penulis\s*ijazah|transport\s*(?:kegiatan|pelatihan|diklat|kkks|kkg|mgmp))\b/i.test(
      uraian
    ) ||
    /^5\.1\.02\.02\.01\.00(?:0[1-9]|[1-4]\d)\b/.test(kodeRek)
  ) {
    return 'honor';
  }
  return 'barang_jasa';
}

function classifyPphColumn(jenisPph: string, pph: number): { pph21: number; pph22: number; pph23: number } {
  if (pph <= 0) return { pph21: 0, pph22: 0, pph23: 0 };
  if (/21/.test(jenisPph)) return { pph21: pph, pph22: 0, pph23: 0 };
  if (/23/.test(jenisPph)) return { pph21: 0, pph22: 0, pph23: pph };
  return { pph21: 0, pph22: pph, pph23: 0 };
}

/**
 * Menghitung pemotongan pajak otomatis (PPN, PPh 21, PPh 22, PPh 23) untuk satu transaksi BKU
 * sesuai ketentuan PMK-58/59/2022 & Tata Kelola Pajak BOSP/ARKAS, atau memakai nilai manual bila diubah user.
 */
export function resolveBkuTax(
  row: KeuanganState['bku'][0],
  edit?: KeuanganEditRow,
  settings?: Partial<KeuanganState['settings']>
): ResolvedBkuTax {
  const bruto = Math.max(0, Math.round(Number(row.pengeluaran) || 0));
  const uraian = String(edit?.untuk ?? row.uraian ?? '').trim();
  const kodeRek = String(edit?.kodeRek ?? row.kodeRek ?? '').trim();
  const hasNpwp =
    edit?.pajakHasNpwp !== undefined
      ? edit.pajakHasNpwp
      : edit?.npwpPenerima?.trim()
        ? true
        : settings?.defaultNpwp !== false;
  const tarifPpn = Math.max(0, Number(settings?.tarifPpn ?? 11));
  const tarifPph21 = Math.max(0, Number(edit?.tarifPph21 ?? settings?.tarifPph21Default ?? 5));
  const autoEnabled = settings?.pajakOtomatis !== false;

  // 1. Jika user sudah mengisi/mengedit pajak secara manual
  if (edit?.pajakManual) {
    const ppn = Math.max(0, Math.round(Number(edit.ppn) || 0));
    const pph = Math.max(0, Math.round(Number(edit.pph) || 0));
    const jenisPph = edit.jenisPph || 'PPh Ps. 22';
    const { pph21, pph22, pph23 } = classifyPphColumn(jenisPph, pph);
    const skemaEfektif: Exclude<SpjPajakSkema, 'auto'> =
      ppn === 0 && pph === 0
        ? 'bebas'
        : pph21 > 0
          ? 'pph21'
          : ppn > 0 && pph23 > 0
            ? 'ppn_pph23'
            : pph23 > 0
              ? 'pph23'
              : ppn > 0 && pph22 > 0
                ? 'ppn_pph22'
                : 'ppn_only';
    return {
      skemaEfektif,
      skemaLabel: SKEMA_PAJAK_OPTIONS.find((o) => o.id === skemaEfektif)?.shortLabel || 'Manual',
      ruleReason: 'Input manual pengguna',
      dpp: ppn > 0 ? Math.round((bruto * 100) / (100 + tarifPpn)) : bruto,
      ppn,
      pph,
      pph21,
      pph22,
      pph23,
      jenisPph,
      netto: Math.max(0, bruto - ppn - pph),
      hasNpwp,
      isManual: true,
    };
  }

  const chosenSkema = edit?.pajakSkema ?? 'auto';
  if (!autoEnabled && chosenSkema === 'auto') {
    return {
      skemaEfektif: 'bebas',
      skemaLabel: 'Nonaktif',
      ruleReason: 'Potong pajak otomatis dimatikan',
      dpp: bruto,
      ppn: 0,
      pph: 0,
      pph21: 0,
      pph22: 0,
      pph23: 0,
      jenisPph: 'PPh Ps. 21/22/23',
      netto: bruto,
      hasNpwp,
      isManual: false,
    };
  }

  // 2. Tentukan skema efektif dari aturan BOSP jika chosenSkema === 'auto'
  let skemaEfektif: Exclude<SpjPajakSkema, 'auto'> = 'bebas';
  let ruleReason = 'Transaksi < Rp 2.000.000 / non-objek';

  if (chosenSkema !== 'auto') {
    skemaEfektif = chosenSkema;
    ruleReason = 'Pilihan skema pajak baris';
  } else {
    const kat = inferKategori(uraian, kodeRek);
    if (MUTASI_KAS_RX.test(uraian)) {
      skemaEfektif = 'bebas';
      ruleReason = 'Mutasi / pergeseran kas bank (bukan belanja)';
    } else if (BEBAS_PAJAK_RX.test(uraian)) {
      skemaEfektif = 'bebas';
      ruleReason = 'Utilitas / benda pos / buku bebas pajak';
    } else if (kat === 'sppd') {
      skemaEfektif = 'bebas';
      ruleReason = 'Belanja SPPD / perjalanan dinas';
    } else if (kat === 'honor' || kat === 'lembur') {
      skemaEfektif = 'pph21';
      ruleReason = `Honor / Lembur (PPh Ps. 21 tarif ${tarifPph21}%)`;
    } else if (KONSUMSI_RX.test(uraian)) {
      skemaEfektif = 'pph23';
      ruleReason = 'Makan & minum / katering (PPh Ps. 23, bebas PPN)';
    } else if (JASA_RX.test(uraian)) {
      if (bruto >= 2000000) {
        skemaEfektif = 'ppn_pph23';
        ruleReason = 'Belanja jasa ≥ Rp 2 jt (PPN 11% + PPh Ps. 23)';
      } else {
        skemaEfektif = 'pph23';
        ruleReason = 'Belanja jasa < Rp 2 jt (PPh Ps. 23)';
      }
    } else if (bruto >= 2000000) {
      skemaEfektif = 'ppn_pph22';
      ruleReason = 'Belanja barang ≥ Rp 2 jt (PPN 11% + PPh Ps. 22)';
    } else {
      skemaEfektif = 'bebas';
      ruleReason = 'Belanja barang < Rp 2 jt (bebas pungut PPN/PPh 22)';
    }
  }

  // 3. Hitung DPP, PPN, dan PPh sesuai skema efektif
  const dppInklusif = Math.round((bruto * 100) / (100 + tarifPpn));
  let dpp = bruto;
  let ppn = 0;
  let pph = 0;
  let pph21 = 0;
  let pph22 = 0;
  let pph23 = 0;
  let jenisPph = 'PPh Ps. 22';

  switch (skemaEfektif) {
    case 'ppn_pph22': {
      dpp = dppInklusif;
      ppn = Math.round((dpp * tarifPpn) / 100);
      pph22 = Math.round(dpp * (hasNpwp ? 0.015 : 0.03));
      pph = pph22;
      jenisPph = 'PPh Pasal 22';
      break;
    }
    case 'ppn_pph23': {
      dpp = dppInklusif;
      ppn = Math.round((dpp * tarifPpn) / 100);
      pph23 = Math.round(dpp * (hasNpwp ? 0.02 : 0.04));
      pph = pph23;
      jenisPph = 'PPh Pasal 23';
      break;
    }
    case 'pph23': {
      dpp = bruto;
      pph23 = Math.round(bruto * (hasNpwp ? 0.02 : 0.04));
      pph = pph23;
      jenisPph = 'PPh Pasal 23';
      break;
    }
    case 'pph21': {
      dpp = bruto;
      pph21 = Math.round((bruto * tarifPph21) / 100);
      pph = pph21;
      jenisPph = 'PPh Pasal 21';
      break;
    }
    case 'ppn_only': {
      dpp = dppInklusif;
      ppn = Math.round((dpp * tarifPpn) / 100);
      jenisPph = 'PPh Ps. 22';
      break;
    }
    case 'bebas':
    default: {
      dpp = bruto;
      jenisPph = 'PPh Ps. 21/22/23';
      break;
    }
  }

  return {
    skemaEfektif,
    skemaLabel: SKEMA_PAJAK_OPTIONS.find((o) => o.id === skemaEfektif)?.shortLabel || 'Bebas',
    ruleReason,
    dpp,
    ppn,
    pph,
    pph21,
    pph22,
    pph23,
    jenisPph,
    netto: Math.max(0, bruto - ppn - pph),
    hasNpwp,
    isManual: false,
  };
}
