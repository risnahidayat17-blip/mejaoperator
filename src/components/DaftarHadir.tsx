/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ClipboardList } from 'lucide-react';
import { Guru, SchoolConfig, Siswa } from '../types';
import { getRombels, recordActivity } from '../lib/storage';
import { triggerGooglePrint } from '../lib/print';
import { KopSuratHD } from './KopSuratHD';

interface Props {
  config: SchoolConfig;
  siswa: Siswa[];
  guru: Guru[];
  onToast: (msg: string, isError?: boolean) => void;
}

type Jenis = 'kelas' | 'pjok' | 'pai' | 'ekskul';

const JENIS: Record<Jenis, { label: string; judul: string; mapel: string; ttd: string; re: RegExp }> = {
  kelas: {
    label: 'Guru Kelas',
    judul: 'DAFTAR HADIR SISWA',
    mapel: 'Wali Kelas / Guru Kelas',
    ttd: 'Guru Kelas',
    re: /guru kelas|wali/i,
  },
  pjok: {
    label: 'Guru PJOK',
    judul: 'DAFTAR HADIR SISWA — PJOK',
    mapel: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    ttd: 'Guru PJOK',
    re: /pjok|jasmani|penjas|olahraga/i,
  },
  pai: {
    label: 'Guru PAI',
    judul: 'DAFTAR HADIR SISWA — PAI',
    mapel: 'Pendidikan Agama Islam dan Budi Pekerti (PAI)',
    ttd: 'Guru PAI',
    re: /agama|\bpai\b|islam/i,
  },
  ekskul: {
    label: 'Ekstrakurikuler',
    judul: 'DAFTAR HADIR SISWA — EKSTRAKURIKULER',
    mapel: 'Kegiatan Ekstrakurikuler',
    ttd: 'Pembina Ekstrakurikuler',
    re: /ekskul|ekstrakurikuler|pramuka|pembina|pelatih|drumband|tari|silat|futsal/i,
  },
};

const EKSKUL_PRESETS = [
  'Pramuka',
  'Drumband',
  'Pencak Silat',
  'Seni Tari',
  'Futsal / Olahraga',
  'BTQ / Keagamaan',
  'English Club',
  'MIPA / Sains',
  'TIK / Komputer',
];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Rombel siswa: kolom rombel, atau "Rombel 6 A" di catatan, atau tingkat kelas saja. */
export function rombelOf(s: Siswa): string {
  if (s.rombel && s.rombel.trim()) return s.rombel.trim().toUpperCase();
  const m = (s.catatan || '').match(/rombel\s+(\d+\s*[A-Za-z]*)/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim().toUpperCase();
  return String(s.kelas || '').trim();
}

const tingkatOf = (s: Siswa) => String(s.kelas || '').trim() || rombelOf(s).charAt(0);
const num = (v: string) => parseInt(v, 10) || 0;

const todayId = () => {
  const d = new Date();
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

interface SheetProps {
  config: SchoolConfig;
  jenis: Jenis;
  rows: Siswa[];
  /** Guru Kelas: bulan yang dicetak. */
  year: number;
  month: number; // 0-11
  hariLibur: 'minggu' | 'sabtuminggu';
  /** PJOK / PAI / Ekstrakurikuler: semester (1 = Juli–Desember, 2 = Januari–Juni) dan jumlah pertemuan per bulan. */
  semester: 1 | 2;
  pertemuan: number;
  scopeLabel: string;
  ekskulNama: string;
  jadwalEkskul: string;
  guruNama: string;
  guruNip: string;
  tempatTanggal: string;
  pakaiKop: boolean;
}

const SEM_MONTHS: Record<1 | 2, number[]> = { 1: [6, 7, 8, 9, 10, 11], 2: [0, 1, 2, 3, 4, 5] };
const PX_MM = 25.4 / 96;
const ROW = 6; // tinggi baris Guru Kelas (mm)

const DaftarHadirPages: React.FC<SheetProps> = ({
  config,
  jenis,
  rows,
  year,
  month,
  hariLibur,
  semester,
  pertemuan,
  scopeLabel,
  ekskulNama,
  jadwalEkskul,
  guruNama,
  guruNip,
  tempatTanggal,
  pakaiKop,
}) => {
  const meta = JENIS[jenis];
  const sem = jenis !== 'kelas'; // PJOK, PAI & Ekstrakurikuler: mingguan per semester
  const sheetTitle =
    jenis === 'ekskul' && ekskulNama.trim()
      ? `DAFTAR HADIR SISWA — EKSTRAKURIKULER ${ekskulNama.trim().toUpperCase()}`
      : meta.judul;
  const days = new Date(year, month + 1, 0).getDate();
  const isOff = (d: number) => {
    const w = new Date(year, month, d).getDay();
    return w === 0 || (hariLibur === 'sabtuminggu' && w === 6);
  };
  const months = SEM_MONTHS[semester];
  const per = Math.min(6, Math.max(3, pertemuan));
  const cols = sem ? months.length * per : days;

  const maxCfgLogoH = Math.max(config.logoPemdaHeight || config.logoHeight || 100, config.logoSekolahHeight || config.logoHeight || 100);
  const effectiveLogoH = sem ? 68 : maxCfgLogoH;
  const kopMM = pakaiKop ? ((effectiveLogoH + 24) * PX_MM) : 0;

  // ---- kapasitas halaman (mm)
  const pageMM = sem ? 198 : 192; // tinggi area isi
  const headMM = sem ? 11.5 : 12;
  const titleMM = sem ? 9 : 14;
  const infoMM = sem ? 13 : 22;
  const sigMM = sem ? 28 : 36;
  let rowMM = ROW;
  let chunks: Siswa[][];
  if (sem) {
    const avail = pageMM - kopMM - titleMM - infoMM - headMM - sigMM - 3;
    const fit = avail / Math.max(1, rows.length);
    if (fit >= 3.2) {
      rowMM = Math.min(6, fit);
      chunks = [rows];
    } else {
      rowMM = 4.4;
      const cap1 = Math.floor((pageMM - kopMM - titleMM - infoMM - headMM - 3) / rowMM);
      const capN = Math.floor((pageMM - 8 - headMM - 3) / rowMM);
      chunks = [];
      let i = 0;
      while (i < rows.length) {
        const cap = chunks.length === 0 ? cap1 : capN;
        chunks.push(rows.slice(i, i + cap));
        i += cap;
      }
      const sigRows = Math.ceil(sigMM / rowMM);
      const lastCap = (chunks.length === 1 ? cap1 : capN) - sigRows;
      const last = chunks[chunks.length - 1];
      if (last.length > lastCap) {
        chunks[chunks.length - 1] = last.slice(0, Math.max(0, lastCap));
        chunks.push(last.slice(Math.max(0, lastCap)));
      }
    }
  } else {
    const cap1 = Math.floor((pageMM - kopMM - 36 - headMM) / ROW) - 2;
    const capN = Math.floor((pageMM - 12 - headMM) / ROW) - 2;
    chunks = [];
    let i = 0;
    while (i < rows.length || chunks.length === 0) {
      const cap = chunks.length === 0 ? cap1 : capN;
      chunks.push(rows.slice(i, i + cap));
      i += cap;
    }
    const capLast = (chunks.length === 1 ? cap1 : capN) - 7;
    const last = chunks[chunks.length - 1];
    if (last.length > capLast) {
      chunks[chunks.length - 1] = last.slice(0, capLast);
      chunks.push(last.slice(capLast));
    }
  }

  const L = rows.filter((s) => s.jk === 'L').length;
  const P = rows.filter((s) => s.jk === 'P').length;
  let no = 0;

  const dateColW = 5.2;
  const semColW = Math.max(4.6, Math.min(8, 186 / Math.max(1, cols)));
  const colW = sem ? semColW : dateColW;
  const fs = rowMM >= 4.6 ? 7.5 : rowMM >= 3.9 ? 7 : 6.5;
  const nameW = sem ? 52 : 0;

  const header = (
    <>
      <colgroup>
        <col style={{ width: '7mm' }} />
        <col style={sem ? { width: `${nameW}mm` } : undefined} />
        <col style={{ width: '7mm' }} />
        {Array.from({ length: cols }).map((_, k) => (
          <col key={k} style={{ width: `${colW}mm` }} />
        ))}
        <col style={{ width: '6mm' }} />
        <col style={{ width: '6mm' }} />
        <col style={{ width: '6mm' }} />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2}>No</th>
          <th rowSpan={2}>Nama Siswa</th>
          <th rowSpan={2}>L/P</th>
          {sem ? (
            months.map((m) => (
              <th key={m} colSpan={per} className="dh-mstart">
                {BULAN[m]}
              </th>
            ))
          ) : (
            <th colSpan={cols}>{`Tanggal — ${BULAN[month]} ${year}`}</th>
          )}
          <th colSpan={3} className="dh-mstart">Jumlah</th>
        </tr>
        <tr>
          {Array.from({ length: cols }).map((_, k) => (
            <th key={k} className={`${!sem && isOff(k + 1) ? 'dh-off' : ''} ${sem && k % per === 0 ? 'dh-mstart' : ''}`}>
              {sem ? (k % per) + 1 : k + 1}
            </th>
          ))}
          <th className="dh-mstart">S</th>
          <th>I</th>
          <th>A</th>
        </tr>
      </thead>
    </>
  );

  const semLabel = `Semester ${semester} (${semester === 1 ? 'Ganjil' : 'Genap'}) — Tahun Ajaran ${config.tahunAjaran}`;

  return (
    <>
      {chunks.map((chunk, pi) => {
        const isLast = pi === chunks.length - 1;
        return (
          <section
            key={pi}
            className={`dh-page ${sem ? 'dh-sem' : ''}`}
            style={{ ['--dh-row' as string]: `${rowMM}mm`, ['--dh-fs' as string]: `${fs}pt` } as React.CSSProperties}
          >
            {pi === 0 ? (
              <>
                {pakaiKop && (
                  <KopSuratHD config={config} className="dh-kop" logoHeight={sem ? 68 : undefined} />
                )}
                <div className="dh-title">{sheetTitle}</div>
                <div className="dh-info">
                  <div>
                    <div>
                      <span>{jenis === 'ekskul' ? 'Ekstrakurikuler' : 'Mata Pelajaran'}</span>:{' '}
                      {jenis === 'ekskul'
                        ? `${ekskulNama.trim() || 'Ekstrakurikuler'}${jadwalEkskul.trim() ? ` (${jadwalEkskul.trim()})` : ''}`
                        : meta.mapel}
                    </div>
                    <div><span>{jenis === 'ekskul' ? 'Kelompok / Kelas' : 'Kelas / Rombel'}</span>: {scopeLabel}</div>
                    <div><span>{jenis === 'ekskul' ? 'Pembina / Pelatih' : 'Nama Guru'}</span>: {guruNama || '................................'}</div>
                  </div>
                  <div>
                    {sem ? (
                      <div><span>Semester</span>: {semester} ({semester === 1 ? 'Ganjil' : 'Genap'})</div>
                    ) : (
                      <div><span>Bulan / Tahun</span>: {BULAN[month]} {year}</div>
                    )}
                    <div><span>Tahun Ajaran</span>: {config.tahunAjaran}{sem ? '' : ` (Semester ${config.semester})`}</div>
                    <div><span>Jumlah Siswa</span>: {rows.length} (L: {L}, P: {P})</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="dh-title dh-title-sm">
                {sheetTitle} — {scopeLabel} — {sem ? semLabel : `${BULAN[month]} ${year}`} (lanjutan)
              </div>
            )}

            <table className="dh-table">
              {header}
              <tbody>
                {chunk.map((s) => {
                  no++;
                  return (
                    <tr key={s.id}>
                      <td className="dh-c">{no}</td>
                      <td className="dh-nm">{s.nama}</td>
                      <td className="dh-c">{s.jk}</td>
                      {Array.from({ length: cols }).map((_, k) => (
                        <td key={k} className={`${!sem && isOff(k + 1) ? 'dh-off' : ''} ${sem && k % per === 0 ? 'dh-mstart' : ''}`} />
                      ))}
                      <td className="dh-mstart" />
                      <td />
                      <td />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isLast && (
              <>
                <div className="dh-ket">
                  Keterangan: isi dengan tanda ✓ atau <b>H</b> = Hadir, <b>S</b> = Sakit, <b>I</b> = Izin, <b>A</b> = Alpa (tanpa keterangan).
                  {sem ? ` Angka 1–${per} di bawah nama bulan = pertemuan mingguan ke-.` : ' Kolom berwarna abu-abu = hari libur.'}
                </div>
                <div className="dh-ttd">
                  <div>
                    <div>Mengetahui,</div>
                    <div>Kepala Sekolah</div>
                    <div className="dh-gap" />
                    <div className="dh-nm2">{config.kepsek}</div>
                    <div>{config.nipKepsek ? `NIP. ${config.nipKepsek}` : ''}</div>
                  </div>
                  <div>
                    <div>{tempatTanggal}</div>
                    <div>
                      {jenis === 'ekskul' && ekskulNama.trim()
                        ? `Pembina ${ekskulNama.trim()}`
                        : `${meta.ttd}${jenis === 'kelas' ? ` ${scopeLabel}` : ''}`}
                    </div>
                    <div className="dh-gap" />
                    <div className="dh-nm2">{guruNama || '................................'}</div>
                    <div>{guruNip ? `NIP. ${guruNip}` : ''}</div>
                  </div>
                </div>
              </>
            )}
          </section>
        );
      })}
    </>
  );
};

export const DaftarHadir: React.FC<Props> = ({ config, siswa, guru, onToast }) => {
  const now = new Date();
  const [jenis, setJenis] = useState<Jenis>('kelas');
  const [semester, setSemester] = useState<1 | 2>(/2|genap/i.test(String(config.semester || '')) ? 2 : 1);
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [hariLibur, setHariLibur] = useState<'minggu' | 'sabtuminggu'>('sabtuminggu');
  const [pertemuan, setPertemuan] = useState(5);
  const [pakaiKop, setPakaiKop] = useState(true);
  const [agamaFilter, setAgamaFilter] = useState<'islam' | 'semua'>('semua');
  const [scope, setScope] = useState('');
  const [ekskulPreset, setEkskulPreset] = useState('Pramuka');
  const [ekskulCustom, setEkskulCustom] = useState('');
  const [jadwalEkskul, setJadwalEkskul] = useState('');
  const [pilihPesertaManual, setPilihPesertaManual] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [pesertaSearch, setPesertaSearch] = useState('');
  const [guruId, setGuruId] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualNip, setManualNip] = useState('');
  const [tempatTanggal, setTempatTanggal] = useState(`${config.tempatLaporan || config.desa || ''}${config.tempatLaporan || config.desa ? ', ' : ''}${todayId()}`);

  const aktif = useMemo(() => siswa.filter((s) => s.status === 'Aktif'), [siswa]);
  const rombels = useMemo(() => getRombels(), []);

  const rombelNames = useMemo(() => {
    const set = new Set<string>(aktif.map(rombelOf).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [aktif]);
  const tingkatNames = useMemo(
    () => Array.from(new Set(aktif.map(tingkatOf).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id', { numeric: true })),
    [aktif]
  );

  useEffect(() => {
    if (!scope) setScope(rombelNames[0] ? `R:${rombelNames[0]}` : tingkatNames[0] ? `T:${tingkatNames[0]}` : '');
  }, [rombelNames, tingkatNames, scope]);

  // jenis -> bawaan kolom, filter agama & reset scope ekskul jika berpindah ke kelas/pjok/pai
  useEffect(() => {
    setAgamaFilter(jenis === 'pai' ? 'islam' : 'semua');
    if (jenis !== 'ekskul' && (scope === 'ALL' || scope.startsWith('G:'))) {
      setScope(rombelNames[0] ? `R:${rombelNames[0]}` : tingkatNames[0] ? `T:${tingkatNames[0]}` : '');
    }
    if (jenis !== 'ekskul') {
      setPilihPesertaManual(false);
    }
  }, [jenis, scope, rombelNames, tingkatNames]);

  const ekskulNama = ekskulPreset === '__custom__' ? ekskulCustom : ekskulPreset;
  const scopeKind = scope.slice(0, 1);
  const scopeVal = scope.slice(2);
  const scopeLabel =
    scope === 'ALL'
      ? 'Semua Siswa (Kelas 1–6)'
      : scope === 'G:1-3'
        ? 'Kelas 1–3 (Siaga / Kelas Rendah)'
        : scope === 'G:4-6'
          ? 'Kelas 4–6 (Penggalang / Kelas Tinggi)'
          : scopeKind === 'T'
            ? `${scopeVal} (semua rombel)`
            : scopeVal;

  const guruOpts = useMemo(
    () => guru.filter((g) => g.status === 'Aktif' && g.jenisGtk !== 'Tendik').sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [guru]
  );

  // pilih guru otomatis: wali kelas rombel / guru yang jabatan-mengampunya cocok
  useEffect(() => {
    let id = '';
    if (jenis === 'kelas') {
      const rb = rombels.find((r) => r.nama.toUpperCase() === scopeVal.toUpperCase());
      if (rb?.waliKelasId && guruOpts.some((g) => g.id === rb.waliKelasId)) id = rb.waliKelasId;
      else if (rb?.waliKelasNama) id = guruOpts.find((g) => g.nama === rb.waliKelasNama)?.id || '';
    } else {
      const re = JENIS[jenis].re;
      id = guruOpts.find((g) => re.test(`${g.mengampu || ''} ${g.jabatan || ''}`))?.id || '';
    }
    setGuruId(id);
  }, [jenis, scopeVal, rombels, guruOpts]);

  const gSel = guruOpts.find((g) => g.id === guruId);
  const guruNama = gSel ? gSel.nama : manualNama;
  const guruNip = gSel ? gSel.nip || '' : manualNip;

  const matchesScope = (s: Siswa) => {
    if (scope === 'ALL') return true;
    if (scope === 'G:1-3') return ['1', '2', '3'].includes(tingkatOf(s));
    if (scope === 'G:4-6') return ['4', '5', '6'].includes(tingkatOf(s));
    return scopeKind === 'T' ? tingkatOf(s) === scopeVal : rombelOf(s) === scopeVal;
  };

  const baseScopeRows = useMemo(() => {
    return aktif
      .filter(matchesScope)
      .filter((s) => agamaFilter === 'semua' || /islam/i.test(s.agama || ''))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [aktif, scope, scopeKind, scopeVal, agamaFilter]);

  const filtered = useMemo(() => {
    if (jenis !== 'ekskul' || !pilihPesertaManual) return baseScopeRows;
    return baseScopeRows.filter((s) => !excludedIds.has(s.id));
  }, [baseScopeRows, jenis, pilihPesertaManual, excludedIds]);

  const excluded = useMemo(() => {
    if (agamaFilter === 'semua') return 0;
    return aktif.filter(matchesScope).length - baseScopeRows.length;
  }, [aktif, baseScopeRows, scope, scopeKind, scopeVal, agamaFilter]);

  const togglePeserta = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [yy, mm] = ym.split('-').map(num);
  const sheetProps: SheetProps = {
    config,
    jenis,
    rows: filtered,
    year: yy || now.getFullYear(),
    month: Math.max(0, (mm || 1) - 1),
    hariLibur,
    semester,
    pertemuan: Math.min(6, Math.max(3, pertemuan)),
    scopeLabel,
    ekskulNama,
    jadwalEkskul,
    guruNama,
    guruNip,
    tempatTanggal,
    pakaiKop,
  };

  // pratinjau berskala agar muat di layar
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);
  const PAGE_PX = 1123; // 297 mm
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
  }, [filtered.length, jenis, semester, pertemuan, pakaiKop]);

  const handlePrint = () => {
    if (!filtered.length) {
      onToast('Tidak ada siswa pada pilihan ini.', true);
      return;
    }
    const labelLog = jenis === 'ekskul' ? `Ekstrakurikuler ${ekskulNama || ''}`.trim() : JENIS[jenis].label;
    recordActivity(
      'Daftar Hadir',
      `Cetak/Simpan PDF ${labelLog} - ${scopeLabel} (${jenis === 'kelas' ? `Periode ${ym}` : `Semester ${semester}`})`,
      false,
      'update'
    );
    triggerGooglePrint({
      pageCss: '@page{size:297mm 210mm;margin:0}',
      bodyClass: 'printing-hadir',
      targetRoot: document.getElementById('dh-print-root') || document.body,
    });
  };

  const sel = 'w-full px-3 py-2 text-sm border border-[#D3DDD9] rounded-lg bg-white focus:outline-hidden focus:border-[#0B6B58]';
  const lbl = 'block text-[11px] font-bold text-[#566A6E] mb-1';

  const searchedPickerRows = useMemo(() => {
    const q = pesertaSearch.trim().toLowerCase();
    if (!q) return baseScopeRows;
    return baseScopeRows.filter((s) => `${s.nama} ${rombelOf(s)}`.toLowerCase().includes(q));
  }, [baseScopeRows, pesertaSearch]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#13262A] font-display flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#0B6B58]" /> Daftar Hadir Siswa
          </h2>
          <p className="text-xs text-[#566A6E] mt-0.5">
            Cetak daftar hadir per kelas &amp; mingguan semester untuk Guru Kelas, Guru PJOK, Guru PAI, dan Ekstrakurikuler (A4 mendatar).
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 rounded-xl bg-[#0B6B58] hover:bg-[#095746] text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="bg-white border border-[#D3DDD9] rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(JENIS) as Jenis[]).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setJenis(j)}
              className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer border ${
                jenis === j ? 'bg-[#0B6B58] text-white border-[#0B6B58]' : 'bg-white text-[#13262A] border-[#D3DDD9] hover:bg-[#F1F4F2]'
              }`}
            >
              {JENIS[j].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {jenis === 'ekskul' && (
            <>
              <div>
                <label className={lbl}>Kegiatan Ekstrakurikuler</label>
                <select className={sel} value={ekskulPreset} onChange={(e) => setEkskulPreset(e.target.value)}>
                  {EKSKUL_PRESETS.map((nm) => (
                    <option key={nm} value={nm}>
                      {nm}
                    </option>
                  ))}
                  <option value="__custom__">— Ketik nama lain —</option>
                </select>
              </div>
              {ekskulPreset === '__custom__' && (
                <div>
                  <label className={lbl}>Nama Ekstrakurikuler</label>
                  <input
                    className={sel}
                    value={ekskulCustom}
                    onChange={(e) => setEkskulCustom(e.target.value)}
                    placeholder="mis. Marching Band / Karawitan"
                  />
                </div>
              )}
              <div>
                <label className={lbl}>Hari / Jadwal Latihan (opsional)</label>
                <input
                  className={sel}
                  value={jadwalEkskul}
                  onChange={(e) => setJadwalEkskul(e.target.value)}
                  placeholder="mis. Sabtu, 14.00 WIB"
                />
              </div>
            </>
          )}

          <div>
            <label className={lbl}>{jenis === 'ekskul' ? 'Kelompok / Kelas Peserta' : 'Kelas / Rombel'}</label>
            <select className={sel} value={scope} onChange={(e) => setScope(e.target.value)}>
              {jenis === 'ekskul' && (
                <optgroup label="Gabungan Ekstrakurikuler">
                  <option value="ALL">Semua Siswa Aktif (Kelas 1–6)</option>
                  <option value="G:1-3">Kelas 1–3 (Siaga / Kelas Rendah)</option>
                  <option value="G:4-6">Kelas 4–6 (Penggalang / Kelas Tinggi)</option>
                </optgroup>
              )}
              <optgroup label="Per rombel">
                {rombelNames.map((r) => (
                  <option key={r} value={`R:${r}`}>
                    Rombel {r}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Gabungan satu tingkat">
                {tingkatNames.map((t) => (
                  <option key={t} value={`T:${t}`}>
                    Kelas {t} (semua rombel)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          {jenis === 'kelas' ? (
            <>
              <div>
                <label className={lbl}>Bulan</label>
                <input type="month" className={sel} value={ym} onChange={(e) => setYm(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Hari libur diarsir</label>
                <select className={sel} value={hariLibur} onChange={(e) => setHariLibur(e.target.value as 'minggu' | 'sabtuminggu')}>
                  <option value="sabtuminggu">Sabtu &amp; Minggu</option>
                  <option value="minggu">Minggu saja</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={lbl}>Semester (1 lembar = 1 semester)</label>
                <select className={sel} value={semester} onChange={(e) => setSemester(Number(e.target.value) === 2 ? 2 : 1)}>
                  <option value={1}>Semester 1 — Juli s.d. Desember</option>
                  <option value={2}>Semester 2 — Januari s.d. Juni</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Pertemuan mingguan / bulan (3 – 6)</label>
                <input type="number" min={3} max={6} className={sel} value={pertemuan} onChange={(e) => setPertemuan(num(e.target.value))} />
              </div>
            </>
          )}

          <div>
            <label className={lbl}>{jenis === 'ekskul' ? 'Nama Pembina / Pelatih' : 'Nama guru'}</label>
            <select className={sel} value={guruId} onChange={(e) => setGuruId(e.target.value)}>
              <option value="">— Ketik manual —</option>
              {guruOpts.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama}
                  {g.jabatan ? ` (${g.jabatan})` : ''}
                </option>
              ))}
            </select>
          </div>
          {!gSel && (
            <>
              <div>
                <label className={lbl}>{jenis === 'ekskul' ? 'Nama Pembina / Pelatih (manual)' : 'Nama guru (manual)'}</label>
                <input className={sel} value={manualNama} onChange={(e) => setManualNama(e.target.value)} placeholder="Nama lengkap + gelar" />
              </div>
              <div>
                <label className={lbl}>NIP (opsional)</label>
                <input className={sel} value={manualNip} onChange={(e) => setManualNip(e.target.value)} />
              </div>
            </>
          )}
          {jenis === 'pai' && (
            <div>
              <label className={lbl}>Siswa yang dicantumkan</label>
              <select className={sel} value={agamaFilter} onChange={(e) => setAgamaFilter(e.target.value as 'islam' | 'semua')}>
                <option value="islam">Hanya yang beragama Islam</option>
                <option value="semua">Semua siswa</option>
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>Kop Surat &amp; Logo</label>
            <select className={sel} value={pakaiKop ? 'ya' : 'tidak'} onChange={(e) => setPakaiKop(e.target.value === 'ya')}>
              <option value="ya">Dengan Kop Resmi &amp; Logo</option>
              <option value="tidak">Tanpa Kop (Kertas Berkop)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Tempat, tanggal (di tanda tangan)</label>
            <input className={sel} value={tempatTanggal} onChange={(e) => setTempatTanggal(e.target.value)} />
          </div>
        </div>

        {jenis === 'ekskul' && baseScopeRows.length > 0 && (
          <div className="border border-[#D3DDD9] rounded-xl p-3 bg-[#F8FAF9] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#13262A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={pilihPesertaManual}
                  onChange={(e) => setPilihPesertaManual(e.target.checked)}
                  className="accent-[#0B6B58]"
                />
                Pilih anggota ekskul tertentu saja ({filtered.length} dari {baseScopeRows.length} siswa dipilih)
              </label>
              {pilihPesertaManual && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExcludedIds(new Set())}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-[#D3DDD9] text-[#0B6B58] hover:bg-emerald-50 cursor-pointer"
                  >
                    Centang Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcludedIds(new Set(baseScopeRows.map((s) => s.id)))}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-[#D3DDD9] text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    Kosongkan
                  </button>
                </div>
              )}
            </div>

            {pilihPesertaManual && (
              <div className="space-y-2">
                <input
                  value={pesertaSearch}
                  onChange={(e) => setPesertaSearch(e.target.value)}
                  placeholder="Cari nama atau rombel siswa..."
                  className="w-full sm:w-72 px-2.5 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white focus:outline-hidden focus:border-[#0B6B58]"
                />
                <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 pr-1">
                  {searchedPickerRows.map((s) => {
                    const checked = !excludedIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          checked ? 'bg-white border-[#0B6B58]/40 text-[#13262A]' : 'bg-gray-50 border-gray-200 text-[#566A6E]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePeserta(s.id)}
                          className="accent-[#0B6B58] shrink-0"
                        />
                        <span className="truncate flex-1 font-medium">{s.nama}</span>
                        <span className="text-[10px] font-mono text-[#566A6E] shrink-0">Kls {rombelOf(s)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-[#566A6E]">
          {filtered.length} siswa aktif akan dicetak
          {excluded > 0 && ` (${excluded} siswa non-Islam tidak dicantumkan)`}.
          {jenis !== 'kelas' && !gSel && ' Pembina/guru belum terpilih otomatis — pilih dari daftar atau ketik manual.'}
        </div>
      </div>

      <div ref={wrapRef} className="dh-preview bg-neutral-200 rounded-xl p-2 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#566A6E]">Tidak ada siswa aktif pada pilihan ini.</div>
        ) : (
          <div style={{ height: innerH * scale }}>
            <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_PX }}>
              <DaftarHadirPages {...sheetProps} />
            </div>
          </div>
        )}
      </div>

      {createPortal(
        <div id="dh-print-root">
          <DaftarHadirPages {...sheetProps} />
        </div>,
        document.body
      )}
    </div>
  );
};
