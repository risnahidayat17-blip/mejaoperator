/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import {
  KeuanganEditRow,
  KeuanganState,
  SchoolConfig,
  SpjDocType,
  SpjFotoItem,
  SpjHonorRow,
  SpjItemRow,
  SpjKategori,
} from '../types';
import { KopSuratHD } from './KopSuratHD';
import { compressImageFileToDataUrl } from '../lib/compress';
import { isImageKitReady, uploadDataUrlToImageKit } from '../lib/imagekit';
import {
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  ReceiptText,
  ClipboardCheck,
  FileSpreadsheet,
  Users,
  FileText,
  Calculator,
  Tag,
} from 'lucide-react';

export interface SpjDocTabMeta {
  id: SpjDocType;
  label: string;
  shortLabel: string;
  paperLabel: string;
}

export const SPJ_DOC_TABS: SpjDocTabMeta[] = [
  { id: 'kwitansi', label: 'Kwitansi BOS', shortLabel: 'Kwitansi', paperLabel: '215 × 75 mm / 180 × 76 mm' },
  { id: 'nota_pesanan', label: 'Nota Pesanan', shortLabel: 'Nota Pesanan', paperLabel: 'A4 Portrait' },
  { id: 'bast', label: 'BAST', shortLabel: 'BAST', paperLabel: 'A4 Portrait' },
  { id: 'model_a2', label: 'Model A2', shortLabel: 'Model A2', paperLabel: 'A4 Portrait' },
  { id: 'tanda_terima_honor', label: 'Tanda Terima Honor', shortLabel: 'Terima Honor', paperLabel: 'A4 Portrait' },
  { id: 'dokumentasi', label: 'Dokumentasi Kegiatan', shortLabel: 'Dokumentasi', paperLabel: 'A4 Portrait' },
  { id: 'invoice', label: 'Invoice', shortLabel: 'Invoice', paperLabel: 'A4 Portrait' },
];

export const SPJ_KATEGORI_META: Record<
  SpjKategori,
  { label: string; shortLabel: string; badgeCls: string; desc: string }
> = {
  barang_jasa: {
    label: 'Pembelian Barang / Jasa',
    shortLabel: 'Barang/Jasa',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-200',
    desc: 'Menggunakan Kwitansi, Nota Pesanan, BAST, Model A2, Dokumentasi & Invoice.',
  },
  honor: {
    label: 'Pembayaran Honor',
    shortLabel: 'Honor',
    badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    desc: 'Menggunakan Kwitansi, Model A2, Tanda Terima Honor & Dokumentasi (tanpa Nota Pesanan/BAST/Invoice barang).',
  },
  lembur: {
    label: 'Uang Lembur',
    shortLabel: 'Lembur',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
    desc: 'Menggunakan Kwitansi, Model A2, Tanda Terima Uang Lembur & Dokumentasi (tanpa kolom jenis barang).',
  },
  sppd: {
    label: 'SPPD / Perjadin',
    shortLabel: 'SPPD',
    badgeCls: 'bg-violet-50 text-violet-800 border-violet-200',
    desc: 'Menggunakan Kwitansi, Model A2, Daftar Biaya SPPD & Dokumentasi (tanpa kolom jenis barang).',
  },
};

export function detectSpjKategori(uraian?: string, kodeRek?: string): SpjKategori {
  const txt = String(uraian || '').trim();
  const rek = String(kodeRek || '').trim();
  if (
    /\b(sppd|perjalanan\s*dinas|perjadin|uang\s*harian|tiket|penginapan|akomodasi|transport\s*dinas|transportasi\s*dinas)\b/i.test(txt) ||
    /^5\.1\.02\.04\b/.test(rek)
  ) {
    return 'sppd';
  }
  if (/\b(lembur|uang\s*lembur|makan\s*lembur|overtime)\b/i.test(txt)) {
    return 'lembur';
  }
  if (
    /\b(honor|honorarium|insentif|upah\s*(?:mengajar|tenaga|guru|karyawan)|narasumber|pemateri|pelatih|ekskul|ekstrakurikuler|pengawas\s*(?:ujian|asesmen)|koreksi|panitia|petugas|gaji|guru\s*honorer|tendik|ptt|gtt|jasa\s*(?:profesi|pelatih|tenaga))\b/i.test(
      txt
    ) ||
    /^5\.1\.02\.02\.01\b/.test(rek)
  ) {
    return 'honor';
  }
  return 'barang_jasa';
}

export function getAllowedDocTabs(kategori: SpjKategori): SpjDocTabMeta[] {
  if (kategori === 'barang_jasa') {
    return SPJ_DOC_TABS.filter((t) => t.id !== 'tanda_terima_honor');
  }
  const honorTabLabel =
    kategori === 'lembur'
      ? { label: 'Tanda Terima Lembur', shortLabel: 'Terima Lembur' }
      : kategori === 'sppd'
        ? { label: 'Tanda Terima SPPD', shortLabel: 'Terima SPPD' }
        : { label: 'Tanda Terima Honor', shortLabel: 'Terima Honor' };

  return SPJ_DOC_TABS.filter(
    (t) => t.id === 'kwitansi' || t.id === 'model_a2' || t.id === 'tanda_terima_honor' || t.id === 'dokumentasi'
  ).map((t) => (t.id === 'tanda_terima_honor' ? { ...t, ...honorTabLabel } : t));
}

export function getBundleDocsForKategori(kategori: SpjKategori): Exclude<SpjDocType, 'kwitansi'>[] {
  if (kategori === 'barang_jasa') {
    return ['nota_pesanan', 'bast', 'model_a2', 'dokumentasi', 'invoice'];
  }
  return ['model_a2', 'tanda_terima_honor', 'dokumentasi'];
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function formatTglIndo(tglStr?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tglStr || '');
  return m ? `${parseInt(m[3], 10)} ${MONTH_NAMES[parseInt(m[2], 10) - 1]} ${m[1]}` : tglStr || '';
}

export function getRomanMonthAndYear(tglStr?: string): { roman: string; year: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tglStr || '');
  if (!m) {
    const now = new Date();
    return { roman: ROMAN_MONTHS[now.getMonth()], year: String(now.getFullYear()) };
  }
  const monthIdx = Math.min(11, Math.max(0, parseInt(m[2], 10) - 1));
  return { roman: ROMAN_MONTHS[monthIdx], year: m[1] };
}

export function formatRupiah(val: number): string {
  return 'Rp ' + Math.round(val || 0).toLocaleString('id-ID');
}

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

function terbilangAngka(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return terbilangAngka(n - 10) + ' belas';
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilangAngka(n % 10) : '');
  if (n < 200) return 'seratus' + (n - 100 ? ' ' + terbilangAngka(n - 100) : '');
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilangAngka(n % 100) : '');
  if (n < 2000) return 'seribu' + (n - 1000 ? ' ' + terbilangAngka(n - 1000) : '');
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilangAngka(n % 1000) : '');
  if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 ? ' ' + terbilangAngka(n % 1000000) : '');
  if (n < 1000000000000) return terbilangAngka(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 ? ' ' + terbilangAngka(n % 1000000000) : '');
  return terbilangAngka(Math.floor(n / 1000000000000)) + ' triliun' + (n % 1000000000000 ? ' ' + terbilangAngka(n % 1000000000000) : '');
}

export function terbilang(n: number): string {
  const rounded = Math.round(Math.abs(n || 0));
  const kata = rounded === 0 ? 'nol' : terbilangAngka(rounded);
  return kata.replace(/\b\w/g, (c) => c.toUpperCase()) + ' Rupiah';
}

export function terbilangKata(n: number): string {
  const rounded = Math.round(Math.abs(n || 0));
  if (rounded === 0) return 'Nol';
  return terbilangAngka(rounded);
}

function getDatePartsIndo(tglStr?: string): {
  hari: string;
  tanggalKata: string;
  bulan: string;
  tahunKata: string;
  formatted: string;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tglStr || '');
  if (!m) {
    return {
      hari: '..........',
      tanggalKata: '..........',
      bulan: '..........',
      tahunKata: '..........',
      formatted: tglStr || '....................',
    };
  }
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  return {
    hari: DAY_NAMES[dt.getDay()] || '..........',
    tanggalKata: terbilangAngka(d),
    bulan: MONTH_NAMES[mo - 1] || '..........',
    tahunKata: terbilangAngka(y),
    formatted: `${d} ${MONTH_NAMES[mo - 1]} ${y}`,
  };
}

export function parseVolNumber(vol: string): number {
  const cleaned = String(vol || '').replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isFinite(num) && num > 0 ? num : 1;
}

export interface ComputedSpjValues {
  kategori: SpjKategori;
  seq: string;
  tahun: string;
  noKw: string;
  tgl: string;
  penerima: string;
  alamatPenerima: string;
  npwpPenerima: string;
  telpPenerima: string;
  jabatanPenerima: string;
  untuk: string;
  kodeRek: string;
  pelaksanaNama: string;
  pelaksanaNip: string;
  items: SpjItemRow[];
  itemsTotal: number;
  noPesanan: string;
  tglPesanan: string;
  batasWaktu: string;
  catatanPesanan: string;
  noBast: string;
  tglBast: string;
  catatanBast: string;
  noA2: string;
  tglA2: string;
  kodeKegiatan: string;
  ppn: number;
  pph: number;
  jenisPph: string;
  nettoA2: number;
  noHonor: string;
  tglHonor: string;
  honorJudul: string;
  honorRows: SpjHonorRow[];
  honorBruto: number;
  honorPph: number;
  honorNetto: number;
  dokJudul: string;
  dokTanggal: string;
  dokTempat: string;
  dokPelaksana: string;
  dokCatatan: string;
  dokFoto: SpjFotoItem[];
  noInvoice: string;
  tglInvoice: string;
  jatuhTempo: string;
  metodeBayar: string;
  ppnInvoice: number;
  invoiceTotal: number;
  statusInvoice: string;
}

export function computeSpjValues(
  row: KeuanganState['bku'][0],
  index: number,
  edit: KeuanganEditRow | undefined,
  settings: KeuanganState['settings'],
  config: SchoolConfig
): ComputedSpjValues {
  const seqNum = parseInt(row.noBukti.match(/(\d+)\s*$/)?.[1] ?? '', 10) || index + 1;
  const seq = String(seqNum).padStart(3, '0');
  const tgl = edit?.tgl ?? row.tgl;
  const { roman, year } = getRomanMonthAndYear(tgl);
  const tahun = settings.tahunAnggaran?.trim() || year;
  const prefix = (settings.prefix || 'BOSP').trim() || 'BOSP';
  const untuk = edit?.untuk ?? row.uraian;
  const kodeRek = edit?.kodeRek ?? row.kodeRek ?? '';
  const kategori: SpjKategori = edit?.kategoriSpj ?? detectSpjKategori(untuk, kodeRek);
  const noKw = edit?.noKw ?? `BKU-${seq}`;

  const items: SpjItemRow[] =
    edit?.items && edit.items.length > 0
      ? edit.items
      : [{ nama: untuk, vol: '1', satuan: 'Paket', harga: Math.round(row.pengeluaran || 0) }];

  const itemsTotal = items.reduce(
    (sum, it) => sum + Math.round(parseVolNumber(it.vol) * (Number(it.harga) || 0)),
    0
  );

  const penerima = edit?.penerima ?? '';
  const defaultHonorNama =
    penerima ||
    (kategori === 'lembur' ? 'Pegawai Penerima Lembur' : kategori === 'sppd' ? 'Pelaksana Perjalanan Dinas' : 'Penerima Honorarium');
  const defaultHonorJabatan =
    kategori === 'lembur'
      ? 'Guru / Tenaga Kependidikan'
      : kategori === 'sppd'
        ? 'Pelaksana Tugas / SPPD'
        : 'Pelaksana / Narasumber / Petugas';
  const defaultHonorVol = kategori === 'lembur' || kategori === 'sppd' ? '1 Hari' : '1 Kali';

  const honorRows: SpjHonorRow[] =
    edit?.honorRows && edit.honorRows.length > 0
      ? edit.honorRows
      : [
          {
            nama: defaultHonorNama,
            jabatan: defaultHonorJabatan,
            vol: defaultHonorVol,
            satuanHonor: Math.round(row.pengeluaran || 0),
            pph: 0,
          },
        ];

  const honorBruto = honorRows.reduce((s, r) => s + Math.round(Number(r.satuanHonor) || 0), 0);
  const honorPph = honorRows.reduce((s, r) => s + Math.round(Number(r.pph) || 0), 0);
  const honorNetto = Math.max(0, honorBruto - honorPph);

  const ppn = Math.round(Number(edit?.ppn) || 0);
  const pph = Math.round(Number(edit?.pph) || 0);
  const nettoA2 = Math.max(0, Math.round(row.pengeluaran || 0) - ppn - pph);

  const ppnInvoice = Math.round(Number(edit?.ppnInvoice) || 0);
  const invoiceTotal = itemsTotal + ppnInvoice;
  const honorDocPrefix = kategori === 'lembur' ? 'DL' : kategori === 'sppd' ? 'SPD' : 'DH';

  return {
    kategori,
    seq,
    tahun,
    noKw,
    tgl,
    penerima,
    alamatPenerima: edit?.alamatPenerima ?? '',
    npwpPenerima: edit?.npwpPenerima ?? '',
    telpPenerima: edit?.telpPenerima ?? '',
    jabatanPenerima: edit?.jabatanPenerima ?? 'Pemilik / Penyedia',
    untuk,
    kodeRek,
    pelaksanaNama: edit?.pelaksanaNama ?? settings.bendaharaNama,
    pelaksanaNip: edit?.pelaksanaNip ?? settings.bendaharaNip,
    items,
    itemsTotal,
    noPesanan: edit?.noPesanan ?? `${seq}/NP-${prefix}/${roman}/${tahun}`,
    tglPesanan: edit?.tglPesanan ?? tgl,
    batasWaktu: edit?.batasWaktu ?? tgl,
    catatanPesanan:
      edit?.catatanPesanan ??
      'Barang / jasa agar dikirim sesuai spesifikasi dan dalam kondisi baik serta melampirkan nota/faktur resmi.',
    noBast: edit?.noBast ?? `${seq}/BAST-${prefix}/${roman}/${tahun}`,
    tglBast: edit?.tglBast ?? tgl,
    catatanBast:
      edit?.catatanBast ??
      'Telah diperiksa bersama dan dinyatakan lengkap, baik, serta sesuai dengan Nota Pesanan dan ketentuan yang berlaku.',
    noA2: edit?.noA2 ?? `A2/${row.noBukti || noKw}`,
    tglA2: edit?.tglA2 ?? tgl,
    kodeKegiatan: edit?.kodeKegiatan ?? prefix,
    ppn,
    pph,
    jenisPph: edit?.jenisPph ?? (kategori === 'honor' || kategori === 'lembur' ? 'PPh Pasal 21' : 'PPh Ps. 21/22/23'),
    nettoA2,
    noHonor: edit?.noHonor ?? `${seq}/${honorDocPrefix}-${prefix}/${roman}/${tahun}`,
    tglHonor: edit?.tglHonor ?? tgl,
    honorJudul: edit?.honorJudul ?? untuk,
    honorRows,
    honorBruto,
    honorPph,
    honorNetto,
    dokJudul: edit?.dokJudul ?? untuk,
    dokTanggal: edit?.dokTanggal ?? tgl,
    dokTempat: edit?.dokTempat ?? (config.namaSekolah || 'SD Negeri 2 Cempaka'),
    dokPelaksana: edit?.dokPelaksana ?? (edit?.pelaksanaNama || settings.bendaharaNama),
    dokCatatan:
      edit?.dokCatatan ??
      `Dokumentasi fisik pelaksanaan / realisasi belanja ${settings.sumberDana} sesuai BKU nomor bukti ${row.noBukti || noKw}.`,
    dokFoto: Array.isArray(edit?.dokFoto) ? edit!.dokFoto! : [],
    noInvoice: edit?.noInvoice ?? `INV/${tahun}/${roman}/${seq}`,
    tglInvoice: edit?.tglInvoice ?? tgl,
    jatuhTempo: edit?.jatuhTempo ?? tgl,
    metodeBayar: edit?.metodeBayar ?? 'Tunai / Transfer Bank',
    ppnInvoice,
    invoiceTotal,
    statusInvoice: edit?.statusInvoice ?? 'LUNAS',
  };
}

interface SheetProps {
  docType: Exclude<SpjDocType, 'kwitansi'>;
  config: SchoolConfig;
  settings: KeuanganState['settings'];
  row: KeuanganState['bku'][0];
  v: ComputedSpjValues;
}

const NotaPesananSheet: React.FC<Omit<SheetProps, 'docType'>> = ({ config, settings, row, v }) => {
  return (
    <div className="spj-a4-sheet">
      <KopSuratHD config={config} logoHeight={68} className="!mb-3 !pb-2" />

      <div className="text-center mb-4">
        <div className="text-[13pt] font-bold underline tracking-wide uppercase">NOTA PESANAN BARANG / JASA</div>
        <div className="text-[10.5pt]">Nomor: {v.noPesanan}</div>
      </div>

      <div className="flex justify-between items-start gap-6 text-[10.5pt] mb-4">
        <div className="w-[55%]">
          <table className="w-full text-[10.5pt]">
            <tbody>
              <tr>
                <td className="w-[95px] py-0.5 align-top">Perihal</td>
                <td className="w-[12px] py-0.5 align-top">:</td>
                <td className="py-0.5 font-semibold">Pesanan Barang / Jasa ({settings.sumberDana})</td>
              </tr>
              <tr>
                <td className="py-0.5 align-top">Ref. BKU</td>
                <td className="py-0.5 align-top">:</td>
                <td className="py-0.5">
                  {row.noBukti || v.noKw} {v.kodeRek ? `(Kode Rek: ${v.kodeRek})` : ''}
                </td>
              </tr>
              <tr>
                <td className="py-0.5 align-top">Batas Kirim</td>
                <td className="py-0.5 align-top">:</td>
                <td className="py-0.5">{formatTglIndo(v.batasWaktu) || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="w-[45%]">
          <div>
            {settings.kota}, {formatTglIndo(v.tglPesanan) || '....................'}
          </div>
          <div className="mt-1">Kepada Yth.</div>
          <div className="font-bold">{v.penerima || '........................................'}</div>
          <div className="text-[10pt] leading-snug">{v.alamatPenerima || 'Di Tempat'}</div>
          {v.telpPenerima && <div className="text-[9.5pt]">Telp: {v.telpPenerima}</div>}
        </div>
      </div>

      <p className="text-[10.5pt] mb-3 text-justify">
        Dengan hormat, sehubungan dengan kebutuhan operasional kegiatan{' '}
        <strong>{v.untuk}</strong> pada {config.namaSekolah} yang bersumber dari{' '}
        <strong>{settings.sumberDana}</strong> Tahun Anggaran {v.tahun}, bersama ini kami memesan barang/jasa dengan rincian sebagai berikut:
      </p>

      <table className="spj-a4-table text-[10pt] mb-3">
        <thead>
          <tr>
            <th style={{ width: '34px' }}>No.</th>
            <th>Nama Barang / Jasa / Uraian</th>
            <th style={{ width: '58px' }}>Vol</th>
            <th style={{ width: '70px' }}>Satuan</th>
            <th style={{ width: '105px' }}>Harga Satuan</th>
            <th style={{ width: '115px' }}>Jumlah Harga</th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((it, idx) => {
            const sub = Math.round(parseVolNumber(it.vol) * (Number(it.harga) || 0));
            return (
              <tr key={idx}>
                <td className="text-center">{idx + 1}</td>
                <td>{it.nama || '-'}</td>
                <td className="text-center">{it.vol || '1'}</td>
                <td className="text-center">{it.satuan || 'Unit'}</td>
                <td className="text-right font-mono">{formatRupiah(it.harga)}</td>
                <td className="text-right font-mono">{formatRupiah(sub)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={5} className="text-right font-bold">
              JUMLAH TOTAL
            </td>
            <td className="text-right font-bold font-mono">{formatRupiah(v.itemsTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="text-[10pt] mb-3">
        <span className="font-semibold">Terbilang:</span>{' '}
        <span className="italic font-bold">{terbilang(v.itemsTotal)}</span>
      </div>

      {v.catatanPesanan && (
        <div className="text-[9.5pt] mb-5 border border-black/40 p-2 bg-gray-50/60">
          <strong>Catatan Pengiriman &amp; Pembayaran:</strong> {v.catatanPesanan}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 mt-6 text-[10.5pt] text-center">
        <div>
          <div>Mengetahui / Menyetujui,</div>
          <div>Kepala {config.namaSekolah}</div>
          <div className="h-[20mm]" />
          <div className="font-bold underline">{config.kepsek || '................................'}</div>
          <div className="text-[9.5pt]">NIP. {config.nipKepsek || '-'}</div>
        </div>
        <div>
          <div>
            {settings.kota}, {formatTglIndo(v.tglPesanan) || '....................'}
          </div>
          <div>Pemesan / Pelaksana Kegiatan,</div>
          <div className="h-[20mm]" />
          <div className="font-bold underline">{v.pelaksanaNama || settings.bendaharaNama}</div>
          <div className="text-[9.5pt]">NIP. {v.pelaksanaNip || settings.bendaharaNip || '-'}</div>
        </div>
      </div>
    </div>
  );
};

const BastSheet: React.FC<Omit<SheetProps, 'docType'>> = ({ config, settings, row, v }) => {
  const dp = getDatePartsIndo(v.tglBast);
  return (
    <div className="spj-a4-sheet">
      <KopSuratHD config={config} logoHeight={68} className="!mb-3 !pb-2" />

      <div className="text-center mb-4">
        <div className="text-[12.5pt] font-bold underline tracking-wide uppercase">
          BERITA ACARA SERAH TERIMA BARANG / JASA
        </div>
        <div className="text-[10.5pt]">Nomor: {v.noBast}</div>
      </div>

      <p className="text-[10.5pt] mb-3 text-justify">
        Pada hari ini <strong>{dp.hari}</strong> tanggal <strong>{dp.tanggalKata}</strong> bulan{' '}
        <strong>{dp.bulan}</strong> tahun <strong>{dp.tahunKata}</strong> ({dp.formatted}), bertempat di{' '}
        {config.namaSekolah}, kami yang bertanda tangan di bawah ini:
      </p>

      <table className="w-full text-[10pt] mb-3">
        <tbody>
          <tr>
            <td className="w-[24px] py-0.5 align-top font-bold">1.</td>
            <td className="w-[120px] py-0.5 align-top">Nama</td>
            <td className="w-[12px] py-0.5 align-top">:</td>
            <td className="py-0.5 font-bold">{v.penerima || '........................................'}</td>
          </tr>
          <tr>
            <td />
            <td className="py-0.5 align-top">Jabatan</td>
            <td className="py-0.5 align-top">:</td>
            <td className="py-0.5">{v.jabatanPenerima || 'Pemilik / Rekanan / Penyedia'}</td>
          </tr>
          <tr>
            <td />
            <td className="py-0.5 align-top">Alamat</td>
            <td className="py-0.5 align-top">:</td>
            <td className="py-0.5">{v.alamatPenerima || '-'}</td>
          </tr>
          <tr>
            <td />
            <td colSpan={3} className="pt-0.5 pb-2 italic">
              Selanjutnya disebut sebagai <strong>PIHAK PERTAMA (Yang Menyerahkan)</strong>.
            </td>
          </tr>

          <tr>
            <td className="w-[24px] py-0.5 align-top font-bold">2.</td>
            <td className="w-[120px] py-0.5 align-top">Nama</td>
            <td className="w-[12px] py-0.5 align-top">:</td>
            <td className="py-0.5 font-bold">{config.kepsek || '........................................'}</td>
          </tr>
          <tr>
            <td />
            <td className="py-0.5 align-top">NIP</td>
            <td className="py-0.5 align-top">:</td>
            <td className="py-0.5">{config.nipKepsek || '-'}</td>
          </tr>
          <tr>
            <td />
            <td className="py-0.5 align-top">Jabatan</td>
            <td className="py-0.5 align-top">:</td>
            <td className="py-0.5">Kepala {config.namaSekolah}</td>
          </tr>
          <tr>
            <td />
            <td colSpan={3} className="pt-0.5 pb-1 italic">
              Selanjutnya disebut sebagai <strong>PIHAK KEDUA (Yang Menerima)</strong>.
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10.5pt] mb-2.5 text-justify">
        Berdasarkan Nota Pesanan Nomor <strong>{v.noPesanan}</strong> dan pencatatan BKU Nomor Bukti{' '}
        <strong>{row.noBukti || v.noKw}</strong> ({v.kodeRek || settings.sumberDana}), PIHAK PERTAMA telah menyerahkan
        kepada PIHAK KEDUA dan PIHAK KEDUA telah menerima dalam keadaan baik dan lengkap barang/jasa untuk keperluan{' '}
        <strong>{v.untuk}</strong> sebagai berikut:
      </p>

      <table className="spj-a4-table text-[9.5pt] mb-2.5">
        <thead>
          <tr>
            <th style={{ width: '32px' }}>No.</th>
            <th>Nama Barang / Pekerjaan</th>
            <th style={{ width: '54px' }}>Vol</th>
            <th style={{ width: '64px' }}>Satuan</th>
            <th style={{ width: '98px' }}>Harga Satuan</th>
            <th style={{ width: '108px' }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((it, idx) => {
            const sub = Math.round(parseVolNumber(it.vol) * (Number(it.harga) || 0));
            return (
              <tr key={idx}>
                <td className="text-center">{idx + 1}</td>
                <td>{it.nama || '-'}</td>
                <td className="text-center">{it.vol || '1'}</td>
                <td className="text-center">{it.satuan || 'Unit'}</td>
                <td className="text-right font-mono">{formatRupiah(it.harga)}</td>
                <td className="text-right font-mono">{formatRupiah(sub)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={5} className="text-right font-bold">
              TOTAL NILAI SERAH TERIMA
            </td>
            <td className="text-right font-bold font-mono">{formatRupiah(v.itemsTotal)}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10pt] mb-4 text-justify">
        {v.catatanBast} Demikian Berita Acara Serah Terima ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.
      </p>

      <div className="grid grid-cols-2 gap-8 mt-4 text-[10pt] text-center">
        <div>
          <div>PIHAK PERTAMA</div>
          <div>Yang Menyerahkan / Penyedia,</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{v.penerima || '................................'}</div>
          <div className="text-[9pt]">{v.jabatanPenerima || 'Penyedia / Toko'}</div>
        </div>
        <div>
          <div>PIHAK KEDUA</div>
          <div>Yang Menerima / Kepala Sekolah,</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{config.kepsek || '................................'}</div>
          <div className="text-[9pt]">NIP. {config.nipKepsek || '-'}</div>
        </div>
      </div>

      <div className="mt-4 pt-2 text-center text-[9.5pt]">
        <div>Mengetahui / Lunas Dibayar, Bendahara {settings.sumberDana}</div>
        <div className="mt-10 font-bold underline">{settings.bendaharaNama}</div>
        <div className="text-[8.5pt]">NIP. {settings.bendaharaNip || '-'}</div>
      </div>
    </div>
  );
};

const ModelA2Sheet: React.FC<Omit<SheetProps, 'docType'>> = ({ config, settings, row, v }) => {
  const pemda1 = (settings.pemdaTitle || config.kopInduk1 || 'PEMERINTAH KABUPATEN CIREBON').toUpperCase();
  const pemda2 = (config.kopInduk2 || 'DINAS PENDIDIKAN').toUpperCase();
  const hasTax = v.ppn > 0 || v.pph > 0;

  return (
    <div className="spj-a4-sheet">
      {/* Bingkai Resmi Model A2 */}
      <div className="border-[1.5pt] border-black p-4">
        {/* Header Pemda & Kotak Kode */}
        <div className="flex justify-between items-start gap-4 border-b-[1.5pt] border-black pb-3 mb-3">
          <div className="flex-1">
            <div className="text-[11pt] font-bold leading-tight">{pemda1}</div>
            <div className="text-[10.5pt] font-bold leading-tight">{pemda2}</div>
            <div className="text-[10.5pt] font-bold leading-tight mt-0.5">
              {(config.namaSekolah || 'SD NEGERI 2 CEMPAKA').toUpperCase()}
            </div>
            <div className="text-[8.5pt] mt-0.5 text-gray-800">{config.kopAlamat || config.alamat}</div>
          </div>

          <div className="w-[240px] border border-black text-[9pt]">
            <div className="flex border-b border-black">
              <div className="w-[95px] px-1.5 py-0.5 font-semibold border-r border-black bg-gray-100">Model</div>
              <div className="flex-1 px-1.5 py-0.5 font-bold">A2 (BOSP)</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-[95px] px-1.5 py-0.5 font-semibold border-r border-black bg-gray-100">Tahun Angg.</div>
              <div className="flex-1 px-1.5 py-0.5">{v.tahun}</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-[95px] px-1.5 py-0.5 font-semibold border-r border-black bg-gray-100">No. Bukti BKU</div>
              <div className="flex-1 px-1.5 py-0.5 font-mono">{row.noBukti || v.noKw}</div>
            </div>
            <div className="flex border-b border-black">
              <div className="w-[95px] px-1.5 py-0.5 font-semibold border-r border-black bg-gray-100">No. A2</div>
              <div className="flex-1 px-1.5 py-0.5 font-mono">{v.noA2}</div>
            </div>
            <div className="flex">
              <div className="w-[95px] px-1.5 py-0.5 font-semibold border-r border-black bg-gray-100">Kode Rek.</div>
              <div className="flex-1 px-1.5 py-0.5 font-mono font-bold">{v.kodeRek || '-'}</div>
            </div>
          </div>
        </div>

        <div className="text-center my-3">
          <div className="text-[13pt] font-bold tracking-wider underline uppercase">
            TANDA BUKTI PENGELUARAN / KWITANSI (MODEL A2)
          </div>
          <div className="text-[9.5pt] mt-0.5">
            Sumber Dana: <strong>{settings.sumberDana}</strong> &middot; Kegiatan: <strong>{v.kodeKegiatan}</strong>
          </div>
        </div>

        <table className="w-full text-[10.5pt] mt-3 mb-4">
          <tbody>
            <tr>
              <td className="w-[155px] py-1.5 align-top">Sudah terima dari</td>
              <td className="w-[14px] py-1.5 align-top">:</td>
              <td className="py-1.5 border-b border-dotted border-black font-semibold">
                Bendahara {settings.sumberDana} {config.namaSekolah}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 align-top">Uang sejumlah</td>
              <td className="py-1.5 align-top">:</td>
              <td className="py-1.5 border-b border-dotted border-black italic font-bold bg-gray-100/80 px-2">
                {terbilang(row.pengeluaran)}
              </td>
            </tr>
            <tr>
              <td className="py-1.5 align-top">Untuk pembayaran</td>
              <td className="py-1.5 align-top">:</td>
              <td className="py-1.5 border-b border-dotted border-black leading-relaxed">{v.untuk}</td>
            </tr>
            <tr>
              <td className="py-1.5 align-top">Nama Penerima</td>
              <td className="py-1.5 align-top">:</td>
              <td className="py-1.5 border-b border-dotted border-black font-semibold">
                {v.penerima || '........................................'}
                {v.npwpPenerima ? ` (NPWP/NIK: ${v.npwpPenerima})` : ''}
              </td>
            </tr>
            {v.alamatPenerima && (
              <tr>
                <td className="py-1.5 align-top">Alamat Penerima</td>
                <td className="py-1.5 align-top">:</td>
                <td className="py-1.5 border-b border-dotted border-black">{v.alamatPenerima}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Box Nominal & Rincian Pajak */}
        <div className="flex flex-wrap justify-between items-stretch gap-4 my-4 border border-black p-3 bg-gray-50/70">
          <div className="flex flex-col justify-center">
            <div className="text-[9.5pt] font-semibold uppercase text-gray-700">Jumlah Kotor (Bruto)</div>
            <div className="inline-block border-[1.5pt] border-black bg-white px-4 py-1.5 mt-1 text-[13pt] font-bold font-mono">
              {formatRupiah(row.pengeluaran)},-
            </div>
          </div>

          <div className="flex-1 min-w-[230px] text-[9.5pt] border-l border-black/30 pl-4">
            <div className="font-bold underline mb-1">Perhitungan Pembayaran &amp; Pajak:</div>
            <div className="flex justify-between py-0.5">
              <span>Nilai Bruto BKU</span>
              <span className="font-mono">{formatRupiah(row.pengeluaran)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Potongan PPN</span>
              <span className="font-mono">{v.ppn > 0 ? formatRupiah(v.ppn) : 'Rp 0'}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Potongan {v.jenisPph}</span>
              <span className="font-mono">{v.pph > 0 ? formatRupiah(v.pph) : 'Rp 0'}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-black font-bold">
              <span>{hasTax ? 'Jumlah Diterima Bersih (Netto)' : 'Jumlah Dibayarkan'}</span>
              <span className="font-mono">{formatRupiah(v.nettoA2)}</span>
            </div>
          </div>
        </div>

        {/* 3-Kolom Tanda Tangan Khas Model A2 */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-2 text-[9.5pt] text-center border-t border-black/40">
          <div>
            <div>Mengetahui / Setuju Dibayar,</div>
            <div>Kepala {config.namaSekolah}</div>
            <div className="h-[20mm]" />
            <div className="font-bold underline">{config.kepsek || '........................'}</div>
            <div className="text-[8.5pt]">NIP. {config.nipKepsek || '-'}</div>
          </div>

          <div>
            <div>Lunas Dibayar Tanggal,</div>
            <div>{formatTglIndo(v.tglA2) || '....................'}</div>
            <div className="text-[9pt]">Bendahara {settings.sumberDana}</div>
            <div className="h-[16mm]" />
            <div className="font-bold underline">{settings.bendaharaNama}</div>
            <div className="text-[8.5pt]">NIP. {settings.bendaharaNip || '-'}</div>
          </div>

          <div>
            <div>
              {settings.kota}, {formatTglIndo(v.tglA2) || '....................'}
            </div>
            <div>Yang Menerima Uang,</div>
            <div className="h-[20mm] flex items-center justify-center">
              {row.pengeluaran >= 5000000 && (
                <span className="border border-dashed border-gray-500 px-2 py-1 text-[7.5pt] text-gray-600">
                  Meterai Rp10.000
                </span>
              )}
            </div>
            <div className="font-bold underline">{v.penerima || '........................'}</div>
            <div className="text-[8.5pt]">{v.npwpPenerima ? `NPWP/NIK: ${v.npwpPenerima}` : '\u00A0'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TandaTerimaHonorSheet: React.FC<Omit<SheetProps, 'docType'>> = ({ config, settings, row, v }) => {
  const titleText =
    v.kategori === 'lembur'
      ? 'DAFTAR TANDA TERIMA UANG LEMBUR PEGAWAI'
      : v.kategori === 'sppd'
        ? 'DAFTAR RINCIAN BIAYA & TANDA TERIMA PERJALANAN DINAS (SPPD)'
        : 'DAFTAR TANDA TERIMA HONORARIUM / INSENTIF KEGIATAN';

  const colNamaLabel =
    v.kategori === 'lembur' ? 'Nama Pegawai' : v.kategori === 'sppd' ? 'Nama Pelaksana' : 'Nama Penerima';
  const colJabatanLabel =
    v.kategori === 'lembur' ? 'Jabatan / Gol' : v.kategori === 'sppd' ? 'Jabatan / Tujuan SPPD' : 'Jabatan / Tugas';
  const colVolLabel =
    v.kategori === 'lembur' ? 'Hari / Jam' : v.kategori === 'sppd' ? 'Lama' : 'Vol';
  const colBrutoLabel =
    v.kategori === 'sppd' ? 'Biaya SPPD / Transport' : 'Jumlah Bruto';
  const colPajakLabel = v.kategori === 'sppd' ? 'Potongan' : 'Pot. PPh 21';

  return (
    <div className="spj-a4-sheet">
      <KopSuratHD config={config} logoHeight={68} className="!mb-3 !pb-2" />

      <div className="text-center mb-3">
        <div className="text-[12pt] font-bold underline tracking-wide uppercase">{titleText}</div>
        <div className="text-[10pt]">Nomor: {v.noHonor}</div>
      </div>

      <table className="w-full text-[9.5pt] mb-3">
        <tbody>
          <tr>
            <td className="w-[125px] py-0.5">Kegiatan / Uraian</td>
            <td className="w-[10px] py-0.5">:</td>
            <td className="py-0.5 font-semibold">{v.honorJudul}</td>
          </tr>
          <tr>
            <td className="py-0.5">Sumber Dana / Rek</td>
            <td className="py-0.5">:</td>
            <td className="py-0.5">
              {settings.sumberDana} &middot; Kode Rek: <span className="font-mono">{v.kodeRek || '-'}</span> &middot; Ref
              BKU: <span className="font-mono">{row.noBukti || v.noKw}</span>
            </td>
          </tr>
          <tr>
            <td className="py-0.5">Tanggal Pembayaran</td>
            <td className="py-0.5">:</td>
            <td className="py-0.5">{formatTglIndo(v.tglHonor) || '-'}</td>
          </tr>
        </tbody>
      </table>

      <table className="spj-a4-table text-[9pt] mb-3">
        <thead>
          <tr>
            <th style={{ width: '28px' }}>No</th>
            <th>{colNamaLabel}</th>
            <th style={{ width: '120px' }}>{colJabatanLabel}</th>
            <th style={{ width: '62px' }}>{colVolLabel}</th>
            <th style={{ width: '86px' }}>{colBrutoLabel}</th>
            <th style={{ width: '72px' }}>{colPajakLabel}</th>
            <th style={{ width: '86px' }}>Diterima Bersih</th>
            <th style={{ width: '100px' }}>Tanda Tangan</th>
          </tr>
        </thead>
        <tbody>
          {v.honorRows.map((hr, idx) => {
            const bruto = Math.round(Number(hr.satuanHonor) || 0);
            const pph = Math.round(Number(hr.pph) || 0);
            const netto = Math.max(0, bruto - pph);
            const isOdd = idx % 2 === 0;
            return (
              <tr key={idx}>
                <td className="text-center py-2.5">{idx + 1}</td>
                <td className="font-semibold py-2.5">{hr.nama || '-'}</td>
                <td className="py-2.5">{hr.jabatan || '-'}</td>
                <td className="text-center py-2.5">{hr.vol || '1'}</td>
                <td className="text-right font-mono py-2.5">{formatRupiah(bruto)}</td>
                <td className="text-right font-mono py-2.5">{pph > 0 ? formatRupiah(pph) : 'Rp 0'}</td>
                <td className="text-right font-mono font-semibold py-2.5">{formatRupiah(netto)}</td>
                <td className="py-2.5 text-[8.5pt]" style={{ paddingLeft: isOdd ? '8px' : '44px' }}>
                  {idx + 1}. ............
                </td>
              </tr>
            );
          })}
          <tr className="font-bold bg-gray-100">
            <td colSpan={4} className="text-right">
              JUMLAH TOTAL
            </td>
            <td className="text-right font-mono">{formatRupiah(v.honorBruto)}</td>
            <td className="text-right font-mono">{formatRupiah(v.honorPph)}</td>
            <td className="text-right font-mono">{formatRupiah(v.honorNetto)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="text-[9.5pt] mb-5">
        <span className="font-semibold">Terbilang Bruto:</span>{' '}
        <span className="italic font-bold">{terbilang(v.honorBruto)}</span>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-4 text-[10pt] text-center">
        <div>
          <div>Mengetahui / Menyetujui,</div>
          <div>Kepala {config.namaSekolah}</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{config.kepsek || '................................'}</div>
          <div className="text-[9pt]">NIP. {config.nipKepsek || '-'}</div>
        </div>
        <div>
          <div>
            {settings.kota}, {formatTglIndo(v.tglHonor) || '....................'}
          </div>
          <div>Lunas Dibayar, Bendahara {settings.sumberDana}</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{settings.bendaharaNama}</div>
          <div className="text-[9pt]">NIP. {settings.bendaharaNip || '-'}</div>
        </div>
      </div>
    </div>
  );
};

const DokumentasiKegiatanSheet: React.FC<Omit<SheetProps, 'docType'>> = ({ config, settings, row, v }) => {
  const photos = v.dokFoto;
  return (
    <div className="spj-a4-sheet">
      <KopSuratHD config={config} logoHeight={68} className="!mb-3 !pb-2" />

      <div className="text-center mb-3">
        <div className="text-[12pt] font-bold underline tracking-wide uppercase">
          DOKUMENTASI KEGIATAN / BUKTI FISIK REALISASI
        </div>
        <div className="text-[9.5pt]">Tahun Anggaran {v.tahun} &middot; {settings.sumberDana}</div>
      </div>

      <table className="spj-a4-table text-[9.5pt] mb-4">
        <tbody>
          <tr>
            <td className="w-[150px] font-semibold bg-gray-100">Nama Kegiatan / Uraian</td>
            <td className="font-bold">{v.dokJudul}</td>
          </tr>
          <tr>
            <td className="font-semibold bg-gray-100">Tanggal Pelaksanaan</td>
            <td>{formatTglIndo(v.dokTanggal) || '-'}</td>
          </tr>
          <tr>
            <td className="font-semibold bg-gray-100">Tempat Pelaksanaan</td>
            <td>{v.dokTempat || config.namaSekolah}</td>
          </tr>
          <tr>
            <td className="font-semibold bg-gray-100">Ref. BKU / Kode Rek.</td>
            <td>
              No. Bukti: <span className="font-mono font-semibold">{row.noBukti || v.noKw}</span> &middot; Kode Rek:{' '}
              <span className="font-mono">{v.kodeRek || '-'}</span> &middot; Nilai:{' '}
              <span className="font-mono font-semibold">{formatRupiah(row.pengeluaran)}</span>
            </td>
          </tr>
          {v.penerima && (
            <tr>
              <td className="font-semibold bg-gray-100">
                {v.kategori === 'barang_jasa' ? 'Penyedia / Penerima' : 'Koordinator / Penerima'}
              </td>
              <td>{v.penerima}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Grid Foto Dokumentasi */}
      {photos.length > 0 ? (
        <div className={`grid gap-3 mb-4 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {photos.slice(0, 4).map((f, idx) => (
            <div key={idx} className="border border-black p-2 bg-white text-center">
              <div
                className="w-full overflow-hidden bg-gray-50 flex items-center justify-center"
                style={{ height: photos.length === 1 ? '95mm' : '56mm' }}
              >
                <img
                  src={f.url}
                  alt={f.caption || `Dokumentasi ${idx + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="text-[9pt] mt-1.5 font-medium text-gray-900">
                {f.caption || `Foto ${idx + 1}: ${v.dokJudul}`}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[1, 2].map((slot) => (
            <div
              key={slot}
              className="border border-dashed border-gray-400 p-4 text-center flex flex-col items-center justify-center text-gray-500"
              style={{ height: '56mm' }}
            >
              <Camera className="w-7 h-7 mb-1.5 opacity-40" />
              <div className="text-[9pt]">Slot Foto Dokumentasi {slot}</div>
              <div className="text-[8pt]">(Unggah foto di panel editor di bawah)</div>
            </div>
          ))}
        </div>
      )}

      {v.dokCatatan && (
        <div className="text-[9.5pt] mb-4 border border-black/50 p-2 bg-gray-50">
          <strong>Keterangan:</strong> {v.dokCatatan}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 mt-4 text-[10pt] text-center">
        <div>
          <div>Mengetahui,</div>
          <div>Kepala {config.namaSekolah}</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{config.kepsek || '................................'}</div>
          <div className="text-[9pt]">NIP. {config.nipKepsek || '-'}</div>
        </div>
        <div>
          <div>
            {settings.kota}, {formatTglIndo(v.dokTanggal) || '....................'}
          </div>
          <div>Pelaksana Kegiatan / Bendahara,</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{v.dokPelaksana || settings.bendaharaNama}</div>
          <div className="text-[9pt]">NIP. {v.pelaksanaNip || settings.bendaharaNip || '-'}</div>
        </div>
      </div>
    </div>
  );
};

const InvoiceSheet: React.FC<Omit<SheetProps, 'docType'>> = ({ config, settings, row, v }) => {
  return (
    <div className="spj-a4-sheet spj-a4-sheet--sans">
      {/* Header Rekanan & INVOICE Badge */}
      <div className="flex justify-between items-start gap-6 pb-4 border-b-2 border-slate-800 mb-5">
        <div className="flex-1">
          <div className="text-[15pt] font-bold text-slate-900 tracking-tight uppercase">
            {v.penerima || 'NAMA TOKO / REKANAN PENYEDIA'}
          </div>
          <div className="text-[9.5pt] text-slate-700 mt-1 leading-snug">
            {v.alamatPenerima || 'Alamat Rekanan / Penyedia Barang & Jasa'}
          </div>
          {(v.telpPenerima || v.npwpPenerima) && (
            <div className="text-[9pt] text-slate-600 mt-1 space-x-3">
              {v.telpPenerima && <span>Telp: {v.telpPenerima}</span>}
              {v.npwpPenerima && <span>NPWP/NIK: {v.npwpPenerima}</span>}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-[20pt] font-extrabold tracking-widest text-slate-900 leading-none">INVOICE</div>
          <div className="text-[9.5pt] font-mono font-semibold text-slate-700 mt-1.5">No: {v.noInvoice}</div>
          {v.statusInvoice && (
            <div className="inline-block mt-1.5 px-2.5 py-0.5 border-2 border-emerald-700 text-emerald-800 font-bold text-[9pt] tracking-wider uppercase">
              {v.statusInvoice}
            </div>
          )}
        </div>
      </div>

      {/* Bill To & Metadata */}
      <div className="grid grid-cols-2 gap-6 mb-5 text-[9.5pt]">
        <div className="border border-slate-300 p-3 bg-slate-50/70">
          <div className="text-[8.5pt] font-bold uppercase tracking-wider text-slate-500 mb-1">Ditagihkan Kepada:</div>
          <div className="font-bold text-[10.5pt] text-slate-900">{config.namaSekolah}</div>
          <div className="text-slate-700">u.p. Bendahara {settings.sumberDana}</div>
          <div className="text-slate-600 text-[9pt] mt-0.5">{config.kopAlamat || config.alamat}</div>
        </div>

        <div className="border border-slate-300 p-3">
          <table className="w-full text-[9.5pt]">
            <tbody>
              <tr>
                <td className="text-slate-600 py-0.5">Tanggal Invoice</td>
                <td className="text-right font-semibold py-0.5">{formatTglIndo(v.tglInvoice) || '-'}</td>
              </tr>
              <tr>
                <td className="text-slate-600 py-0.5">Jatuh Tempo</td>
                <td className="text-right font-semibold py-0.5">{formatTglIndo(v.jatuhTempo) || '-'}</td>
              </tr>
              <tr>
                <td className="text-slate-600 py-0.5">Ref. Nota Pesanan</td>
                <td className="text-right font-mono text-[8.5pt] py-0.5">{v.noPesanan}</td>
              </tr>
              <tr>
                <td className="text-slate-600 py-0.5">Ref. BKU / Kode Rek</td>
                <td className="text-right font-mono text-[8.5pt] py-0.5">
                  {row.noBukti || v.noKw} {v.kodeRek ? `/ ${v.kodeRek}` : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabel Item Invoice */}
      <table className="spj-a4-table text-[9.5pt] mb-4">
        <thead>
          <tr>
            <th style={{ width: '32px' }}>No</th>
            <th>Deskripsi Barang / Jasa</th>
            <th style={{ width: '54px' }}>Qty</th>
            <th style={{ width: '68px' }}>Satuan</th>
            <th style={{ width: '105px' }}>Harga Satuan</th>
            <th style={{ width: '112px' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((it, idx) => {
            const sub = Math.round(parseVolNumber(it.vol) * (Number(it.harga) || 0));
            return (
              <tr key={idx}>
                <td className="text-center">{idx + 1}</td>
                <td>{it.nama || '-'}</td>
                <td className="text-center">{it.vol || '1'}</td>
                <td className="text-center">{it.satuan || 'Unit'}</td>
                <td className="text-right font-mono">{formatRupiah(it.harga)}</td>
                <td className="text-right font-mono">{formatRupiah(sub)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary & Terbilang */}
      <div className="flex justify-between items-start gap-6 mb-6">
        <div className="flex-1 text-[9.5pt] border border-slate-300 p-3 bg-slate-50/70">
          <div>
            <span className="font-semibold">Terbilang:</span>{' '}
            <span className="italic font-bold">{terbilang(v.invoiceTotal)}</span>
          </div>
          <div className="mt-1.5 text-[9pt] text-slate-700">
            <span className="font-semibold">Metode Pembayaran:</span> {v.metodeBayar}
          </div>
          <div className="mt-0.5 text-[9pt] text-slate-700">
            <span className="font-semibold">Keperluan BKU:</span> {v.untuk}
          </div>
        </div>

        <div className="w-[240px] border border-slate-800 text-[9.5pt]">
          <div className="flex justify-between px-3 py-1.5 border-b border-slate-300">
            <span>Subtotal</span>
            <span className="font-mono font-semibold">{formatRupiah(v.itemsTotal)}</span>
          </div>
          <div className="flex justify-between px-3 py-1.5 border-b border-slate-300">
            <span>PPN</span>
            <span className="font-mono">{v.ppnInvoice > 0 ? formatRupiah(v.ppnInvoice) : 'Rp 0'}</span>
          </div>
          <div className="flex justify-between px-3 py-2 bg-slate-900 text-white font-bold text-[10.5pt]">
            <span>TOTAL</span>
            <span className="font-mono">{formatRupiah(v.invoiceTotal)}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-8 text-[9.5pt] text-center">
        <div>
          <div>Diterima &amp; Diverifikasi Oleh,</div>
          <div>Bendahara {settings.sumberDana}</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{settings.bendaharaNama}</div>
          <div className="text-[8.5pt]">NIP. {settings.bendaharaNip || '-'}</div>
        </div>
        <div>
          <div>
            {settings.kota}, {formatTglIndo(v.tglInvoice) || '....................'}
          </div>
          <div>Hormat Kami, Penyedia / Toko</div>
          <div className="h-[19mm]" />
          <div className="font-bold underline">{v.penerima || '................................'}</div>
          <div className="text-[8.5pt]">{v.jabatanPenerima || 'Rekanan / Pemilik'}</div>
        </div>
      </div>
    </div>
  );
};

export const SpjDocSheet: React.FC<SheetProps> = ({ docType, config, settings, row, v }) => {
  // Pengaman: transaksi Honor / Lembur / SPPD tidak pernah menampilkan Nota Pesanan, BAST, atau Invoice barang
  if (v.kategori !== 'barang_jasa' && (docType === 'nota_pesanan' || docType === 'bast' || docType === 'invoice')) {
    return <TandaTerimaHonorSheet config={config} settings={settings} row={row} v={v} />;
  }
  switch (docType) {
    case 'nota_pesanan':
      return <NotaPesananSheet config={config} settings={settings} row={row} v={v} />;
    case 'bast':
      return <BastSheet config={config} settings={settings} row={row} v={v} />;
    case 'model_a2':
      return <ModelA2Sheet config={config} settings={settings} row={row} v={v} />;
    case 'tanda_terima_honor':
      return <TandaTerimaHonorSheet config={config} settings={settings} row={row} v={v} />;
    case 'dokumentasi':
      return <DokumentasiKegiatanSheet config={config} settings={settings} row={row} v={v} />;
    case 'invoice':
      return <InvoiceSheet config={config} settings={settings} row={row} v={v} />;
  }
};

interface SpjDocEditorProps {
  docType: SpjDocType;
  row: KeuanganState['bku'][0];
  v: ComputedSpjValues;
  edit: KeuanganEditRow;
  onPatch: (patch: Partial<KeuanganEditRow>) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const SpjDocEditor: React.FC<SpjDocEditorProps> = ({
  docType,
  row,
  v,
  edit,
  onPatch,
  onToast,
}) => {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const bkuNominal = Math.round(row.pengeluaran || 0);
  const itemsMatchBku = v.itemsTotal === bkuNominal;
  const honorMatchBku = v.honorBruto === bkuNominal;

  const updateItemAt = (idx: number, patch: Partial<SpjItemRow>) => {
    const next = v.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onPatch({ items: next });
  };

  const addItemRow = () => {
    onPatch({
      items: [...v.items, { nama: '', vol: '1', satuan: 'Unit', harga: 0 }],
    });
  };

  const removeItemRow = (idx: number) => {
    const next = v.items.filter((_, i) => i !== idx);
    onPatch({ items: next.length ? next : [{ nama: v.untuk, vol: '1', satuan: 'Paket', harga: bkuNominal }] });
  };

  const syncItemsToBku = () => {
    if (v.items.length === 1) {
      const vol = parseVolNumber(v.items[0].vol);
      onPatch({ items: [{ ...v.items[0], harga: Math.round(bkuNominal / vol) }] });
      return;
    }
    const others = v.items.slice(0, -1).reduce((s, it) => s + Math.round(parseVolNumber(it.vol) * (it.harga || 0)), 0);
    const last = v.items[v.items.length - 1];
    const lastVol = parseVolNumber(last.vol);
    const rem = Math.max(0, bkuNominal - others);
    const next = v.items.map((it, i) => (i === v.items.length - 1 ? { ...it, harga: Math.round(rem / lastVol) } : it));
    onPatch({ items: next });
  };

  const updateHonorAt = (idx: number, patch: Partial<SpjHonorRow>) => {
    const next = v.honorRows.map((hr, i) => (i === idx ? { ...hr, ...patch } : hr));
    onPatch({ honorRows: next });
  };

  const addHonorRow = () => {
    onPatch({
      honorRows: [
        ...v.honorRows,
        { nama: '', jabatan: 'Anggota / Panitia', vol: '1 Kali', satuanHonor: 0, pph: 0 },
      ],
    });
  };

  const removeHonorRow = (idx: number) => {
    const next = v.honorRows.filter((_, i) => i !== idx);
    onPatch({
      honorRows: next.length
        ? next
        : [{ nama: v.penerima || 'Penerima', jabatan: 'Pelaksana', vol: '1 Kali', satuanHonor: bkuNominal, pph: 0 }],
    });
  };

  const splitHonorEvenly = () => {
    const count = Math.max(1, v.honorRows.length);
    const each = Math.floor(bkuNominal / count);
    const remainder = bkuNominal - each * count;
    const next = v.honorRows.map((hr, i) => ({
      ...hr,
      satuanHonor: i === 0 ? each + remainder : each,
    }));
    onPatch({ honorRows: next });
  };

  const handleUploadFotos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const existing = v.dokFoto;
    const remaining = Math.max(0, 4 - existing.length);
    if (remaining === 0) {
      onToast('Maksimal 4 foto dokumentasi per transaksi BKU.', true);
      return;
    }

    setUploadingFoto(true);
    try {
      const selected = Array.from(files).slice(0, remaining);
      const added: SpjFotoItem[] = [];
      const cloudReady = isImageKitReady();

      for (const file of selected) {
        if (!file.type.startsWith('image/')) continue;
        // Kompres ringan <= 55 KB agar cepat & aman untuk storage lokal maupun upload
        const compressed = await compressImageFileToDataUrl(file, cloudReady ? 95 * 1024 : 55 * 1024);
        let finalUrl = compressed;
        if (cloudReady) {
          try {
            const up = await uploadDataUrlToImageKit(
              compressed,
              `spj-dok-${row.id}-${Date.now().toString(36)}`,
              { subfolder: 'spj-keuangan' }
            );
            finalUrl = up.url;
          } catch {
            // Fallback ke compressed data URL jika unggah cloud gagal sementara
            finalUrl = await compressImageFileToDataUrl(file, 50 * 1024);
          }
        }
        added.push({
          url: finalUrl,
          caption: file.name.replace(/\.[^/.]+$/, ''),
        });
      }

      if (added.length) {
        onPatch({ dokFoto: [...existing, ...added] });
        onToast(`${added.length} foto dokumentasi ditambahkan.`);
      }
    } catch (err: any) {
      onToast(err?.message || 'Gagal memproses foto dokumentasi.', true);
    } finally {
      setUploadingFoto(false);
    }
  };

  const isBarangJasa = v.kategori === 'barang_jasa';
  const needsItemsEditor = isBarangJasa && (docType === 'nota_pesanan' || docType === 'bast' || docType === 'invoice');

  return (
    <div className="mt-4 space-y-4 text-xs">
      {/* 0. Pemilih Jenis Transaksi SPJ (Barang/Jasa vs Honor vs Lembur vs SPPD) */}
      <div className="p-3 rounded-xl bg-white border border-[#D3DDD9] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-[#13262A] flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#0B6B58]" />
            Jenis Transaksi SPJ
          </div>
          <p className="text-[11px] text-[#566A6E] mt-0.5">{SPJ_KATEGORI_META[v.kategori].desc}</p>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#D3DDD9] bg-[#F8FAF9] p-1">
          {(Object.keys(SPJ_KATEGORI_META) as SpjKategori[]).map((kat) => {
            const meta = SPJ_KATEGORI_META[kat];
            const active = v.kategori === kat;
            return (
              <button
                key={kat}
                type="button"
                onClick={() => onPatch({ kategoriSpj: kat })}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0B6B58] text-white shadow-xs'
                    : 'text-[#566A6E] hover:bg-white hover:text-[#13262A]'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Data Inti BKU & Penerima (sinkron ke semua dokumen) */}
      <div className="p-3.5 rounded-xl bg-[#F8FAF9] border border-[#D3DDD9]">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
          <div className="font-bold text-[#13262A] flex items-center gap-1.5">
            <ReceiptText className="w-3.5 h-3.5 text-[#0B6B58]" />
            Data Transaksi BKU &amp; {isBarangJasa ? 'Pihak Rekanan / Toko' : 'Penerima / Pelaksana'} (Terhubung Semua Dokumen)
          </div>
          <span className="text-[11px] font-mono font-semibold text-[#0B6B58]">
            Nilai BKU: {formatRupiah(bkuNominal)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">No. Kwitansi / Ref</label>
            <input
              value={v.noKw}
              onChange={(e) => onPatch({ noKw: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Transaksi BKU</label>
            <input
              type="date"
              value={v.tgl}
              onChange={(e) => onPatch({ tgl: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kode Rekening</label>
            <input
              value={v.kodeRek}
              onChange={(e) => onPatch({ kodeRek: e.target.value })}
              placeholder="mis. 5.1.02.01.01.0026"
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
              {isBarangJasa ? 'Penerima / Toko / Rekanan' : 'Penerima / Koordinator'}
            </label>
            <input
              value={v.penerima}
              onChange={(e) => onPatch({ penerima: e.target.value })}
              placeholder={isBarangJasa ? 'Nama toko / penyedia' : 'Nama penerima / koordinator'}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            />
          </div>

          {docType !== 'kwitansi' && isBarangJasa && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jabatan Rekanan</label>
                <input
                  value={edit.jabatanPenerima ?? v.jabatanPenerima}
                  onChange={(e) => onPatch({ jabatanPenerima: e.target.value })}
                  placeholder="Pemilik / Direktur / Penyedia"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NPWP / NIK Penerima</label>
                <input
                  value={v.npwpPenerima}
                  onChange={(e) => onPatch({ npwpPenerima: e.target.value })}
                  placeholder="Opsional"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">No. Telp / HP Rekanan</label>
                <input
                  value={v.telpPenerima}
                  onChange={(e) => onPatch({ telpPenerima: e.target.value })}
                  placeholder="Opsional"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Alamat Toko / Rekanan</label>
                <input
                  value={v.alamatPenerima}
                  onChange={(e) => onPatch({ alamatPenerima: e.target.value })}
                  placeholder="Alamat penyedia"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
            </>
          )}

          {docType !== 'kwitansi' && !isBarangJasa && (
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NPWP / NIK Penerima (Opsional)</label>
              <input
                value={v.npwpPenerima}
                onChange={(e) => onPatch({ npwpPenerima: e.target.value })}
                placeholder="Opsional"
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
              />
            </div>
          )}

          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
              Untuk Pembayaran / Uraian Kegiatan
            </label>
            <textarea
              value={v.untuk}
              onChange={(e) => onPatch({ untuk: e.target.value })}
              rows={2}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            />
          </div>
        </div>
      </div>

      {/* 2. Rincian Barang / Jasa (Hanya untuk kategori Pembelian Barang / Jasa) */}
      {needsItemsEditor && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9]">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
            <div className="font-bold text-[#13262A] flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B6B58]" />
              Rincian Barang / Jasa (Sinkron di Nota Pesanan, BAST &amp; Invoice)
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {itemsMatchBku ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" /> Cocok dg BKU
                </span>
              ) : (
                <button
                  type="button"
                  onClick={syncItemsToBku}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  <AlertCircle className="w-3 h-3" />
                  Total item ({formatRupiah(v.itemsTotal)}) ≠ BKU ({formatRupiah(bkuNominal)}) · Samakan
                </button>
              )}
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B6B58] text-white text-[11px] font-semibold cursor-pointer hover:bg-[#095747]"
              >
                <Plus className="w-3 h-3" /> Tambah Baris
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAF9] text-[#566A6E]">
                  <th className="border border-[#D3DDD9] px-2 py-1.5 text-left">Nama Barang / Jasa</th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-20">Vol</th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-24">Satuan</th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-32">Harga Satuan</th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-32 text-right">Subtotal</th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {v.items.map((it, idx) => {
                  const sub = Math.round(parseVolNumber(it.vol) * (Number(it.harga) || 0));
                  return (
                    <tr key={idx}>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          value={it.nama}
                          onChange={(e) => updateItemAt(idx, { nama: e.target.value })}
                          placeholder="Uraian barang/jasa"
                          className="w-full px-2 py-1 border border-transparent focus:border-[#0B6B58] rounded outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          value={it.vol}
                          onChange={(e) => updateItemAt(idx, { vol: e.target.value })}
                          className="w-full px-2 py-1 text-center border border-transparent focus:border-[#0B6B58] rounded outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          value={it.satuan}
                          onChange={(e) => updateItemAt(idx, { satuan: e.target.value })}
                          className="w-full px-2 py-1 text-center border border-transparent focus:border-[#0B6B58] rounded outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          type="number"
                          value={it.harga}
                          onChange={(e) => updateItemAt(idx, { harga: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full px-2 py-1 text-right font-mono border border-transparent focus:border-[#0B6B58] rounded outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] px-2 py-1 text-right font-mono font-semibold text-[#13262A]">
                        {formatRupiah(sub)}
                      </td>
                      <td className="border border-[#D3DDD9] p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          title="Hapus baris"
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3A. Field Khusus Nota Pesanan */}
      {docType === 'nota_pesanan' && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9] grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nomor Nota Pesanan</label>
            <input
              value={v.noPesanan}
              onChange={(e) => onPatch({ noPesanan: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Pesanan</label>
            <input
              type="date"
              value={v.tglPesanan}
              onChange={(e) => onPatch({ tglPesanan: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Batas Waktu Pengiriman</label>
            <input
              type="date"
              value={v.batasWaktu}
              onChange={(e) => onPatch({ batasWaktu: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nama Pemesan / Pelaksana</label>
            <input
              value={v.pelaksanaNama}
              onChange={(e) => onPatch({ pelaksanaNama: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NIP Pemesan</label>
            <input
              value={v.pelaksanaNip}
              onChange={(e) => onPatch({ pelaksanaNip: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Catatan Pesanan</label>
            <input
              value={v.catatanPesanan}
              onChange={(e) => onPatch({ catatanPesanan: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 3B. Field Khusus BAST */}
      {docType === 'bast' && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9] grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nomor BAST</label>
            <input
              value={v.noBast}
              onChange={(e) => onPatch({ noBast: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Serah Terima (BAST)</label>
            <input
              type="date"
              value={v.tglBast}
              onChange={(e) => onPatch({ tglBast: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Ref. No. Nota Pesanan</label>
            <input
              value={v.noPesanan}
              onChange={(e) => onPatch({ noPesanan: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Keterangan Hasil Pemeriksaan BAST</label>
            <input
              value={v.catatanBast}
              onChange={(e) => onPatch({ catatanBast: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 3C. Field Khusus Model A2 */}
      {docType === 'model_a2' && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9]">
          <div className="font-bold text-[#13262A] flex items-center gap-1.5 mb-2.5">
            <Calculator className="w-3.5 h-3.5 text-[#0B6B58]" />
            Pengaturan Model A2 &amp; Pajak Belanja
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nomor Model A2</label>
              <input
                value={v.noA2}
                onChange={(e) => onPatch({ noA2: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Lunas Dibayar</label>
              <input
                type="date"
                value={v.tglA2}
                onChange={(e) => onPatch({ tglA2: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kode Kegiatan / Sub</label>
              <input
                value={v.kodeKegiatan}
                onChange={(e) => onPatch({ kodeKegiatan: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Potongan PPN (Rp)</label>
              <input
                type="number"
                value={v.ppn}
                onChange={(e) => onPatch({ ppn: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jenis PPh</label>
              <select
                value={v.jenisPph}
                onChange={(e) => onPatch({ jenisPph: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
              >
                <option value="PPh Ps. 21/22/23">PPh Ps. 21/22/23</option>
                <option value="PPh Pasal 21">PPh Pasal 21</option>
                <option value="PPh Pasal 22">PPh Pasal 22</option>
                <option value="PPh Pasal 23">PPh Pasal 23</option>
                <option value="PPh Final">PPh Final</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Potongan PPh (Rp)</label>
              <input
                type="number"
                value={v.pph}
                onChange={(e) => onPatch({ pph: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3D. Field Khusus Tanda Terima Honor / Lembur / SPPD */}
      {docType === 'tanda_terima_honor' && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-bold text-[#13262A] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#0B6B58]" />
              {v.kategori === 'lembur'
                ? 'Daftar Penerima Uang Lembur Pegawai'
                : v.kategori === 'sppd'
                  ? 'Daftar Pelaksana & Rincian Biaya SPPD'
                  : 'Daftar Penerima Honorarium / Insentif'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {honorMatchBku ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" /> Bruto cocok dg BKU
                </span>
              ) : (
                <button
                  type="button"
                  onClick={splitHonorEvenly}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  <AlertCircle className="w-3 h-3" />
                  Total Bruto ({formatRupiah(v.honorBruto)}) ≠ BKU · Bagi Rata
                </button>
              )}
              <button
                type="button"
                onClick={addHonorRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B6B58] text-white text-[11px] font-semibold cursor-pointer hover:bg-[#095747]"
              >
                <Plus className="w-3 h-3" /> Tambah Penerima
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
                {v.kategori === 'lembur' ? 'Nomor Daftar Lembur' : v.kategori === 'sppd' ? 'Nomor Rincian SPPD' : 'Nomor Daftar Honor'}
              </label>
              <input
                value={v.noHonor}
                onChange={(e) => onPatch({ noHonor: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Tanda Terima</label>
              <input
                type="date"
                value={v.tglHonor}
                onChange={(e) => onPatch({ tglHonor: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">
                {v.kategori === 'lembur' ? 'Uraian Kegiatan Lembur' : v.kategori === 'sppd' ? 'Keperluan / Tujuan SPPD' : 'Judul Kegiatan Honor'}
              </label>
              <input
                value={v.honorJudul}
                onChange={(e) => onPatch({ honorJudul: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAF9] text-[#566A6E]">
                  <th className="border border-[#D3DDD9] px-2 py-1.5 text-left">
                    {v.kategori === 'sppd' ? 'Nama Pelaksana' : 'Nama Penerima'}
                  </th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 text-left w-40">
                    {v.kategori === 'sppd' ? 'Jabatan / Tujuan' : 'Jabatan / Tugas'}
                  </th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-24">
                    {v.kategori === 'lembur' || v.kategori === 'sppd' ? 'Hari / Jam' : 'Volume'}
                  </th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-28">
                    {v.kategori === 'sppd' ? 'Biaya (Rp)' : 'Bruto (Rp)'}
                  </th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-24">
                    {v.kategori === 'sppd' ? 'Potongan (Rp)' : 'PPh 21 (Rp)'}
                  </th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-28 text-right">Bersih</th>
                  <th className="border border-[#D3DDD9] px-2 py-1.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {v.honorRows.map((hr, idx) => {
                  const netto = Math.max(0, Math.round(hr.satuanHonor || 0) - Math.round(hr.pph || 0));
                  return (
                    <tr key={idx}>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          value={hr.nama}
                          onChange={(e) => updateHonorAt(idx, { nama: e.target.value })}
                          placeholder="Nama lengkap penerima"
                          className="w-full px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          value={hr.jabatan}
                          onChange={(e) => updateHonorAt(idx, { jabatan: e.target.value })}
                          placeholder="Jabatan / tugas"
                          className="w-full px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          value={hr.vol}
                          onChange={(e) => updateHonorAt(idx, { vol: e.target.value })}
                          className="w-full px-2 py-1 text-center outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          type="number"
                          value={hr.satuanHonor}
                          onChange={(e) => updateHonorAt(idx, { satuanHonor: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full px-2 py-1 text-right font-mono outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] p-1">
                        <input
                          type="number"
                          value={hr.pph}
                          onChange={(e) => updateHonorAt(idx, { pph: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full px-2 py-1 text-right font-mono outline-none"
                        />
                      </td>
                      <td className="border border-[#D3DDD9] px-2 py-1 text-right font-mono font-semibold text-[#13262A]">
                        {formatRupiah(netto)}
                      </td>
                      <td className="border border-[#D3DDD9] p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeHonorRow(idx)}
                          title="Hapus penerima"
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3E. Field Khusus Dokumentasi Kegiatan */}
      {docType === 'dokumentasi' && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-bold text-[#13262A] flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#0B6B58]" />
              Dokumentasi Kegiatan &amp; Foto Bukti Fisik (Maks. 4 Foto)
            </div>
            <button
              type="button"
              disabled={uploadingFoto || v.dokFoto.length >= 4}
              onClick={() => fotoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
            >
              {uploadingFoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploadingFoto ? 'Memproses Foto...' : `Unggah Foto (${v.dokFoto.length}/4)`}
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleUploadFotos(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Judul Dokumentasi Kegiatan</label>
              <input
                value={v.dokJudul}
                onChange={(e) => onPatch({ dokJudul: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Pelaksanaan</label>
              <input
                type="date"
                value={v.dokTanggal}
                onChange={(e) => onPatch({ dokTanggal: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tempat / Lokasi Kegiatan</label>
              <input
                value={v.dokTempat}
                onChange={(e) => onPatch({ dokTempat: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nama Pelaksana / Penanggung Jawab</label>
              <input
                value={v.dokPelaksana}
                onChange={(e) => onPatch({ dokPelaksana: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Catatan Dokumentasi</label>
              <input
                value={v.dokCatatan}
                onChange={(e) => onPatch({ dokCatatan: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
              />
            </div>
          </div>

          {v.dokFoto.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {v.dokFoto.map((foto, idx) => (
                <div key={idx} className="border border-[#D3DDD9] rounded-lg p-2 flex gap-2.5 items-center bg-[#F8FAF9]">
                  <img
                    src={foto.url}
                    alt={foto.caption || `Foto ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border border-[#D3DDD9] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-semibold text-[#566A6E] mb-1">Keterangan Foto {idx + 1}</label>
                    <input
                      value={foto.caption ?? ''}
                      onChange={(e) => {
                        const next = v.dokFoto.map((f, i) => (i === idx ? { ...f, caption: e.target.value } : f));
                        onPatch({ dokFoto: next });
                      }}
                      placeholder="Keterangan foto kegiatan..."
                      className="w-full px-2 py-1 border border-[#D3DDD9] rounded bg-white text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onPatch({ dokFoto: v.dokFoto.filter((_, i) => i !== idx) })}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    title="Hapus foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3F. Field Khusus Invoice */}
      {docType === 'invoice' && (
        <div className="p-3.5 rounded-xl bg-white border border-[#D3DDD9] grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nomor Invoice</label>
            <input
              value={v.noInvoice}
              onChange={(e) => onPatch({ noInvoice: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tanggal Invoice</label>
            <input
              type="date"
              value={v.tglInvoice}
              onChange={(e) => onPatch({ tglInvoice: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jatuh Tempo</label>
            <input
              type="date"
              value={v.jatuhTempo}
              onChange={(e) => onPatch({ jatuhTempo: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Metode Pembayaran</label>
            <input
              value={v.metodeBayar}
              onChange={(e) => onPatch({ metodeBayar: e.target.value })}
              placeholder="Tunai / Transfer Bank"
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">PPN Tambahan (Rp)</label>
            <input
              type="number"
              value={v.ppnInvoice}
              onChange={(e) => onPatch({ ppnInvoice: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Status Pembayaran</label>
            <select
              value={v.statusInvoice}
              onChange={(e) => onPatch({ statusInvoice: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
            >
              <option value="LUNAS">LUNAS</option>
              <option value="BELUM LUNAS">BELUM LUNAS</option>
              <option value="TRANSFER TERVERIFIKASI">TRANSFER TERVERIFIKASI</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export const SPJ_A4_PRINT_OPTIONS = {
  paper: 'A4' as const,
  margin: '12mm 14mm',
};

export const DOC_ICON_MAP: Record<SpjDocType, React.ReactNode> = {
  kwitansi: <ReceiptText className="w-3.5 h-3.5" />,
  nota_pesanan: <FileText className="w-3.5 h-3.5" />,
  bast: <ClipboardCheck className="w-3.5 h-3.5" />,
  model_a2: <Calculator className="w-3.5 h-3.5" />,
  tanda_terima_honor: <Users className="w-3.5 h-3.5" />,
  dokumentasi: <Camera className="w-3.5 h-3.5" />,
  invoice: <FileSpreadsheet className="w-3.5 h-3.5" />,
};
