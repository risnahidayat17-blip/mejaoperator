/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lembar "Daftar 1" (laporan bulanan sekolah) — format F4 landscape:
 *  - Halaman 1: statistik murid + data sekolah (tanah, bangunan, perkakas, absen, jumlah guru)
 *  - Halaman 2: daftar Guru–Guru
 */

import React from 'react';
import { SchoolConfig, Siswa, Guru, LaporanBulan as ILaporanBulan } from '../types';
import {
  AIR_BERSIH,
  BAG_PER_KELAS,
  BANGUNAN_RUANGAN,
  JENIS_BANGUNAN,
  PERKAKAS,
  TANAH,
  Num,
} from '../data/daftar1Static';

export const KELAS_LIST = ['1', '2', '3', '4', '5', '6'];
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const STATUS_OPTIONS = ['Negeri Biasa', 'Negeri Inpres', 'Subsidi', 'Bantuan', 'Swasta Penuh'];
const BAHASA_OPTIONS = ['INDONESIA', 'SUNDA', 'JAWA'];

const PANGKAT: Record<string, string> = {
  'II/a': 'Pengatur Muda', 'II/b': 'Pengatur Muda Tk.I', 'II/c': 'Pengatur', 'II/d': 'Pengatur Tk.I',
  'III/a': 'Penata Muda', 'III/b': 'Penata Muda Tk.I', 'III/c': 'Penata', 'III/d': 'Penata Tk.I',
  'IV/a': 'Pembina', 'IV/b': 'Pembina Tk.I', 'IV/c': 'Pembina Utama Muda', 'IV/d': 'Pembina Utama Madya',
  'IV/e': 'Pembina Utama',
};

const AGAMA: Record<string, string> = {
  islam: 'Is', kristen: 'Kr', katolik: 'Kt', katholik: 'Kt', hindu: 'Hi', budha: 'Bu', buddha: 'Bu', konghucu: 'Kh',
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" atau "DD-MM-YYYY" -> {y,m,d} tanpa efek zona waktu. */
export function parseTmtDate(s?: string) {
  if (!s) return null;
  const clean = s.trim();
  let m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(clean);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(clean);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  return null;
}

export function parseIso(s?: string) {
  return parseTmtDate(s);
}

const fmtDash = (s?: string) => {
  const p = parseIso(s);
  return p ? `${pad2(p.d)}-${pad2(p.m)}-${p.y}` : '';
};
const fmtLong = (s?: string) => {
  const p = parseIso(s);
  return p ? `${pad2(p.d)} ${BULAN[p.m - 1]} ${p.y}` : '';
};
const cnt = (n: number) => (n ? String(n) : '-');
const rp = (n: Num) => (n ? n.toLocaleString('id-ID') : '-');
const sum = (arr: Num[]) => arr.reduce<number>((a, b) => a + (b || 0), 0);

type LP = { L: number; P: number };

export function hitungTotalBulanMasaKerja(g: Guru, endY: number, endM: number): number {
  if (typeof g.masaTahun === 'number' && g.masaTahun >= 0) {
    return g.masaTahun * 12 + (g.masaBulan || 0);
  }
  const p = parseTmtDate(g.tmt);
  if (!p) return 0;
  const months = (endY - p.y) * 12 + (endM - p.m);
  return months > 0 ? months : 0;
}

function masaKerja(g: Guru, endY: number, endM: number) {
  if (typeof g.masaTahun === 'number') {
    return `${pad2(g.masaTahun)} tahun\n${pad2(g.masaBulan || 0)} bulan`;
  }
  const p = parseTmtDate(g.tmt);
  if (!p) return '';
  let months = (endY - p.y) * 12 + (endM - p.m);
  if (months < 0) months = 0;
  return `${pad2(Math.floor(months / 12))} tahun\n${pad2(months % 12)} bulan`;
}

interface Daftar1Props {
  config: SchoolConfig;
  siswa: Siswa[];
  guru: Guru[];
  reportData: ILaporanBulan;
  month: string; // YYYY-MM
}

export const Daftar1Pages: React.FC<Daftar1Props> = ({ config, siswa, guru, reportData, month }) => {
  const [yy, mm] = month.split('-').map(Number);
  const lastDay = new Date(yy, mm, 0).getDate();
  const bulanLabel = `${BULAN[mm - 1] || ''} ${yy}`.toUpperCase();
  const tglLaporan = `${pad2(lastDay)} ${BULAN[mm - 1]} ${yy}`;

  // ----- Murid -----
  const isAsing = (s: Siswa) => /wna|asing/i.test(s.warga || '');
  const aktif = siswa.filter((s) => s.status === 'Aktif');
  const keluar = siswa.filter(
    (s) => (s.status === 'Mutasi' || s.status === 'Keluar') && (s.tglMutasi || '').startsWith(month),
  );

  const tally = (list: Siswa[], asing: boolean): LP[] =>
    KELAS_LIST.map((k) => {
      const x = list.filter((s) => s.kelas === k && isAsing(s) === asing);
      return { L: x.filter((s) => s.jk === 'L').length, P: x.filter((s) => s.jk === 'P').length };
    });

  const iniI = tally(aktif, false);
  const iniA = tally(aktif, true);
  const outI = tally(keluar, false);
  const outA = tally(keluar, true);
  const inI = KELAS_LIST.map(() => ({ L: 0, P: 0 }));
  const inA = KELAS_LIST.map(() => ({ L: 0, P: 0 }));
  const yblI = iniI.map((c, i) => ({ L: c.L + outI[i].L - inI[i].L, P: c.P + outI[i].P - inI[i].P }));
  const yblA = iniA.map((c, i) => ({ L: c.L + outA[i].L - inA[i].L, P: c.P + outA[i].P - inA[i].P }));

  const totalLP = (rows: LP[]): LP => ({
    L: rows.reduce((a, b) => a + b.L, 0),
    P: rows.reduce((a, b) => a + b.P, 0),
  });
  const jumlahPerKelas = KELAS_LIST.map((_, i) => iniI[i].L + iniI[i].P + iniA[i].L + iniA[i].P);
  const grand = jumlahPerKelas.reduce((a, b) => a + b, 0);

  const groups: { label: string[]; ind: LP[]; asg: LP[]; big: boolean }[] = [
    { label: ['Penghabisan', 'Bulan Ybl.'], ind: yblI, asg: yblA, big: true },
    { label: ['Keluar dalam', 'Bulan ini'], ind: outI, asg: outA, big: false },
    { label: ['Masuk dalam', 'bulan ini'], ind: inI, asg: inA, big: false },
    { label: ['Penghabisan', 'bulan ini'], ind: iniI, asg: iniA, big: true },
  ];

  const renderLP = (rows: LP[], big: boolean) => {
    const t = totalLP(rows);
    const all = [...rows, t];
    const cells = all.flatMap((c, i) => [
      <td key={`l${i}`} className={big ? 'lb-big' : ''}>{cnt(c.L)}</td>,
      <td key={`p${i}`} className={big ? 'lb-big' : ''}>{cnt(c.P)}</td>,
    ]);
    return { cells, total: t.L + t.P };
  };

  // ----- Absen murid -----
  const sakit = reportData.murid?.sakit || 0;
  const izin = reportData.murid?.izin || 0;
  const alpa = reportData.murid?.alpa || 0;
  const absenTot = sakit + izin + alpa;
  const absenPct = grand ? ((absenTot / grand) * 100).toFixed(1).replace('.', ',') : '0,0';
  const two = (n: number) => pad2(n);

  // ----- Guru (Daftar 1: Urutan nama berdasarkan masa kerja terlama yang diatas) -----
  const gtk = guru
    .filter((g) => g.status !== 'Nonaktif')
    .map((g) => {
      const ov = reportData.guruOverrides?.[g.id];
      return ov ? { ...g, ...ov } : g;
    })
    .slice()
    .sort((a, b) => {
      const bMasa = hitungTotalBulanMasaKerja(b, yy, mm);
      const aMasa = hitungTotalBulanMasaKerja(a, yy, mm);
      if (bMasa !== aMasa) {
        return bMasa - aMasa; // Masa kerja terlama di atas
      }
      // Jika masa kerja sama, urutkan tanggal TMT lebih awal di atas
      const aP = parseTmtDate(a.tmt);
      const bP = parseTmtDate(b.tmt);
      const aTmtVal = aP ? aP.y * 10000 + aP.m * 100 + aP.d : 99999999;
      const bTmtVal = bP ? bP.y * 10000 + bP.m * 100 + bP.d : 99999999;
      if (aTmtVal !== bTmtVal) {
        return aTmtVal - bTmtVal;
      }
      return a.nama.localeCompare(b.nama);
    });

  const gurus = gtk.filter((g) => g.jenisGtk !== 'Tendik');
  const gL = gurus.filter((g) => g.jk === 'L').length;
  const gP = gurus.filter((g) => g.jk === 'P').length;

  // Nilai dinamis Sarana & Prasarana (menggunakan data edit jika ada, atau bawaan)
  const bagPerKelas = reportData.sarana?.bagPerKelas || BAG_PER_KELAS;
  const tanahList = reportData.sarana?.tanah || TANAH;
  const brList = reportData.sarana?.bangunanRuangan || BANGUNAN_RUANGAN;
  const jbList = reportData.sarana?.jenisBangunan || JENIS_BANGUNAN;
  const perkakasList = reportData.sarana?.perkakas || PERKAKAS;
  const airBersihVal = reportData.sarana?.airBersih || AIR_BERSIH;
  const sewaVal = reportData.sarana?.sewaPerbulan || '…………………';
  const menumpangVal = reportData.sarana?.menumpang || '…………………';
  const kelasPembangunanVal = String(reportData.muridOverrides?.kelasPembangunan ?? '-');

  // Nilai dinamis Pengesahan & Identitas Sekolah
  const statusSel = (reportData.pengesahan?.statusSekolah || config.statusSekolah || '').toLowerCase();
  const bahasaSel = (reportData.pengesahan?.bahasa || config.bahasa || 'Indonesia').toUpperCase();
  const tahunBerdiriVal = reportData.pengesahan?.tahunBerdiri || config.tahunBerdiri || '-';
  const tglLaporanVal = reportData.pengesahan?.tglLaporan || tglLaporan;
  const tempatLaporanVal = reportData.pengesahan?.tempatLaporan || config.tempatLaporan || config.kecamatan || config.kabupaten || '';
  const korwilJabatanVal = reportData.pengesahan?.korwilJabatan || config.korwilJabatan || 'Korwil Bidang Pendidikan';
  const korwilNamaVal = reportData.pengesahan?.korwilNama || config.korwilNama || '';
  const korwilNipVal = reportData.pengesahan?.korwilNip || config.korwilNip || '';
  const kepsekVal = reportData.pengesahan?.kepsek || config.kepsek || '';
  const nipKepsekVal = reportData.pengesahan?.nipKepsek || config.nipKepsek || '';

  // ----- Total tabel kanan -----
  const tanahTot = {
    luas: sum(tanahList.map((t) => t.luas)),
    persil: sum(tanahList.map((t) => t.persil)),
    harga: sum(tanahList.map((t) => t.harga)),
  };
  const brSum = (key: 'baik' | 'sedang' | 'rusak', i: 0 | 1) => sum(brList.map((b) => b[key][i]));

  const perkakasJumlah = (p: (typeof PERKAKAS)[number]) => {
    const parts = [p.baik, p.sedang, p.rusak];
    const str = parts.find((x) => typeof x === 'string');
    if (str) return str as string;
    return cnt(sum(parts as Num[]));
  };
  const pk = (v: Num | string) => (typeof v === 'string' ? v : cnt(v || 0));

  return (
    <>
      {/* ===================== HALAMAN 1 ===================== */}
      <div className="lb-page">
        <div className="lb-p1">
          {/* ---------- KIRI ---------- */}
          <div className="lb-left">
            <table className="lb-tbl lb-info">
              <colgroup>
                <col style={{ width: '17%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '59%' }} />
              </colgroup>
              <tbody>
                <tr>
                  <td className="lb-nob" />
                  <td colSpan={2} className="lb-title">{(config.namaSekolah || 'SD NEGERI 2 CEMPAKA').toUpperCase()}</td>
                </tr>
                <tr>
                  <td className="lb-c1">
                    <div className="lb-sp">D A F T A R :</div>
                    <div className="lb-sp">B U L A N</div>
                    <div className="lb-bln">{bulanLabel}</div>
                    <div className="lb-sp">B A H A S A</div>
                    <div className="lb-sp">PENGANTAR</div>
                    {BAHASA_OPTIONS.map((b) => (
                      <div key={b} className={`lb-bhs ${bahasaSel.startsWith(b) ? 'on' : ''}`}>{b}</div>
                    ))}
                  </td>
                  <td className="lb-c2">
                    <div className="lb-status-h">Status : *)</div>
                    {STATUS_OPTIONS.map((o, i) => {
                      const sel = statusSel.includes(o.toLowerCase());
                      const letter = 'abcde'[i];
                      return (
                        <div key={o} className={`lb-opt ${sel ? 'is-sel' : ''}`}>
                          <span className={sel ? 'lb-circ' : 'lb-circ0'}>{letter}</span>. {o}
                        </div>
                      );
                    })}
                  </td>
                  <td className="lb-c3">
                    <div className="lb-kv"><span>Tahun Pendirian SD</span><span>: &nbsp;{tahunBerdiriVal}</span></div>
                    <div className="lb-kv"><span>NSS/NPSN</span><span>: &nbsp;{config.nss || '-'}/ {config.npsn || '-'}</span></div>
                    <div className="lb-kv"><span>Alamat</span><span>: &nbsp;{config.alamat}</span></div>
                    <div className="lb-kv"><span>Desa/Kelurahan, Kecamatan</span><span>: &nbsp;{config.desa || '-'}, Kec. {config.kecamatan || '-'}</span></div>
                    <div className="lb-kv"><span>Kabupaten</span><span>: &nbsp;{config.kabupaten || '-'}</span></div>
                    <div className="lb-kv"><span>Propinsi</span><span>: &nbsp;{config.propinsi || '-'}</span></div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Banyak murid */}
            <table className="lb-tbl lb-murid">
              <colgroup>
                <col style={{ width: '10.5%' }} />
                <col style={{ width: '8%' }} />
                {Array.from({ length: 14 }, (_, i) => (
                  <col key={i} style={{ width: '4.8%' }} />
                ))}
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '7.5%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={4} colSpan={2} className="lb-keterangan">KETERANGAN</th>
                  <th colSpan={16} className="lb-sp lb-bm">B A N Y A K &nbsp;&nbsp; M U R I D</th>
                </tr>
                <tr>
                  {ROMAWI.map((r) => (
                    <th key={r} colSpan={2}>{r}</th>
                  ))}
                  <th colSpan={2}>Jumlah</th>
                  <th rowSpan={3} className="lb-sm">Jumlah Murid Semua</th>
                  <th rowSpan={3} className="lb-xs">Jumlah Kelas Pembangunan</th>
                </tr>
                <tr className="lb-sub">
                  {Array.from({ length: 6 }, (_, i) => (
                    <React.Fragment key={i}>
                      <td>{bagPerKelas}</td>
                      <td>Bag</td>
                    </React.Fragment>
                  ))}
                  <td>{bagPerKelas * 6}</td>
                  <td>Bag</td>
                </tr>
                <tr className="lb-sub">
                  {Array.from({ length: 7 }, (_, i) => (
                    <React.Fragment key={i}>
                      <td>L</td>
                      <td>P</td>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const a = renderLP(g.ind, g.big);
                  const b = renderLP(g.asg, false);
                  return (
                    <React.Fragment key={g.label[0] + g.label[1]}>
                      <tr className="lb-r-ind">
                        <td rowSpan={2} className="lb-grp">{g.label[0]}<br />{g.label[1]}</td>
                        <td className="lb-lbl">Indonesia</td>
                        {a.cells}
                        <td className={g.big ? 'lb-big' : ''}>{cnt(a.total + b.total)}</td>
                        <td className={g.big ? 'lb-big' : ''}>{g.big && g.label[0] === 'Penghabisan' && g.label[1] === 'bulan ini' ? kelasPembangunanVal : ''}</td>
                      </tr>
                      <tr className="lb-r-asg">
                        <td className="lb-lbl">Asing</td>
                        {b.cells}
                        <td>-</td>
                        <td />
                      </tr>
                    </React.Fragment>
                  );
                })}
                <tr className="lb-r-tot">
                  <td colSpan={2} className="lb-grp">Jumlah pada penghabisan<br />bulan ini</td>
                  {jumlahPerKelas.map((n, i) => (
                    <td key={i} colSpan={2} className="lb-big2">{cnt(n)}</td>
                  ))}
                  <td colSpan={2} className="lb-big2">{cnt(grand)}</td>
                  <td className="lb-big2">{cnt(grand)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* ---------- KANAN ---------- */}
          <div className="lb-right">
            {/* A. TANAH */}
            <table className="lb-tbl lb-rt">
              <colgroup>
                <col style={{ width: '25%' }} />
                {Array.from({ length: 11 }, (_, i) => (
                  <col key={i} style={{ width: `${75 / 11}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr>
                  <td rowSpan={2} className="lb-l lb-sp2">A. T A N A H</td>
                  <td colSpan={4}>Luas M<sup>2</sup></td>
                  <td colSpan={4}>Tahun</td>
                  <td colSpan={3}>Harga</td>
                </tr>
                <tr>
                  <td colSpan={2} className="lb-xs">Darat/Sawah</td>
                  <td colSpan={2}>No. Persil</td>
                  <td colSpan={4}>Pembelian</td>
                  <td colSpan={3}>Rp</td>
                </tr>
                {tanahList.map((t) => (
                  <tr key={t.label}>
                    <td className="lb-l">{t.label}</td>
                    <td colSpan={2}>{rp(t.luas)}</td>
                    <td colSpan={2}>{cnt(t.persil || 0)}</td>
                    <td colSpan={4}>{t.tahun}</td>
                    <td colSpan={3}>{rp(t.harga)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="lb-l">Jumlah</td>
                  <td colSpan={2}>{rp(tanahTot.luas)}</td>
                  <td colSpan={2}>{cnt(tanahTot.persil)}</td>
                  <td colSpan={4}>-</td>
                  <td colSpan={3}>{rp(tanahTot.harga)}</td>
                </tr>
              </tbody>
            </table>

            {/* B. BANGUNAN RUANGAN */}
            <table className="lb-tbl lb-rt">
              <colgroup>
                <col style={{ width: '25%' }} />
                {Array.from({ length: 11 }, (_, i) => (
                  <col key={i} style={{ width: `${75 / 11}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr>
                  <td rowSpan={2} className="lb-l lb-sp2">B.&nbsp; BANGUNAN<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RUANGAN</td>
                  <td colSpan={2}>Baik</td>
                  <td colSpan={2}>Sedang</td>
                  <td colSpan={4}>Rusak</td>
                  <td colSpan={3}>Jumlah</td>
                </tr>
                <tr>
                  {[1, 1, 1, 1, 2, 2, 2, 1].map((sp, i) => (
                    <td key={i} colSpan={sp}>{i % 2 === 0 ? 'Bgn' : 'Rgn'}</td>
                  ))}
                </tr>
                {brList.map((b) => {
                  const j: [number, number] = [
                    sum([b.baik[0], b.sedang[0], b.rusak[0]]),
                    sum([b.baik[1], b.sedang[1], b.rusak[1]]),
                  ];
                  return (
                    <tr key={b.label}>
                      <td className="lb-l">{b.label}</td>
                      <td>{cnt(b.baik[0] || 0)}</td><td>{cnt(b.baik[1] || 0)}</td>
                      <td>{cnt(b.sedang[0] || 0)}</td><td>{cnt(b.sedang[1] || 0)}</td>
                      <td colSpan={2}>{cnt(b.rusak[0] || 0)}</td><td colSpan={2}>{cnt(b.rusak[1] || 0)}</td>
                      <td colSpan={2}>{cnt(j[0])}</td><td>{cnt(j[1])}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="lb-l">Jumlah</td>
                  <td>{cnt(brSum('baik', 0))}</td><td>{cnt(brSum('baik', 1))}</td>
                  <td>{cnt(brSum('sedang', 0))}</td><td>{cnt(brSum('sedang', 1))}</td>
                  <td colSpan={2}>{cnt(brSum('rusak', 0))}</td><td colSpan={2}>{cnt(brSum('rusak', 1))}</td>
                  <td colSpan={2}>{cnt(brSum('baik', 0) + brSum('sedang', 0) + brSum('rusak', 0))}</td>
                  <td>{cnt(brSum('baik', 1) + brSum('sedang', 1) + brSum('rusak', 1))}</td>
                </tr>
              </tbody>
            </table>

            {/* C & D */}
            <table className="lb-tbl lb-rt">
              <tbody>
                <tr><td className="lb-txt">C. MENYEWA Perbulan Rp {sewaVal} MENUMPANG DI SD {menumpangVal}</td></tr>
                <tr>
                  <td className="lb-txt">
                    D. JENIS/SIFAT BANGUNAN<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Isi dengan jumlah P : Permanen SP : Semi Permanen DR : Darurat
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="lb-tbl lb-rt">
              <colgroup>
                <col style={{ width: '25%' }} />
                {Array.from({ length: 11 }, (_, i) => (
                  <col key={i} style={{ width: `${75 / 11}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr>
                  <td rowSpan={2} className="lb-l" />
                  <td rowSpan={2}>P</td>
                  <td rowSpan={2}>SP</td>
                  <td rowSpan={2}>DR</td>
                  <td colSpan={6}>Th. Pendirian</td>
                  <td colSpan={2} rowSpan={1}>Harga</td>
                </tr>
                <tr>
                  <td colSpan={2}>P</td>
                  <td colSpan={2}>SP</td>
                  <td colSpan={2}>DR</td>
                  <td colSpan={2}>Rp.</td>
                </tr>
                {jbList.map((j) => (
                  <tr key={j.label}>
                    <td className={`lb-l ${j.indent ? 'lb-ind' : ''}`}>{j.label}</td>
                    <td>{cnt(j.jml[0] || 0)}</td>
                    <td>{cnt(j.jml[1] || 0)}</td>
                    <td>{cnt(j.jml[2] || 0)}</td>
                    <td colSpan={2}>{j.thn[0]}</td>
                    <td colSpan={2}>{j.thn[1]}</td>
                    <td colSpan={2}>{j.thn[2]}</td>
                    <td colSpan={2}>{rp(j.harga)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="lb-tbl lb-rt">
              <tbody>
                <tr><td className="lb-txt lb-air">E.&nbsp;&nbsp; PENYEDIAAN AIR&nbsp; BERSIH&nbsp; :&nbsp; {airBersihVal}</td></tr>
              </tbody>
            </table>

            {/* F. PERKAKAS */}
            <table className="lb-tbl lb-rt">
              <colgroup>
                <col style={{ width: '25%' }} />
                {Array.from({ length: 11 }, (_, i) => (
                  <col key={i} style={{ width: `${75 / 11}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr>
                  <td className="lb-l lb-sp2">F.&nbsp; PERKAKAS</td>
                  <td colSpan={2}>Baik</td>
                  <td colSpan={2}>Sedang</td>
                  <td colSpan={4}>Rusak</td>
                  <td colSpan={3}>Jumlah</td>
                </tr>
                {perkakasList.map((p) => (
                  <tr key={p.label}>
                    <td className="lb-l">{p.label}</td>
                    <td colSpan={2}>{pk(p.baik)}</td>
                    <td colSpan={2}>{pk(p.sedang)}</td>
                    <td colSpan={4}>{pk(p.rusak)}</td>
                    <td colSpan={3}>{perkakasJumlah(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* G. ABSEN MURID */}
            <table className="lb-tbl lb-rt">
              <colgroup>
                <col style={{ width: '25%' }} />
                {Array.from({ length: 11 }, (_, i) => (
                  <col key={i} style={{ width: `${75 / 11}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr><td colSpan={12} className="lb-l lb-sp2">G. ABSEN MURID</td></tr>
                <tr>
                  <td className="lb-l">{two(absenTot)} Orang</td>
                  <td colSpan={2} className="lb-nb" />
                  <td colSpan={2} className="lb-l">Sakit</td>
                  <td colSpan={4}>=&nbsp;&nbsp;&nbsp;&nbsp;{two(sakit)}</td>
                  <td colSpan={3} className="lb-l">Orang</td>
                </tr>
                <tr>
                  <td className="lb-l">{absenPct} %</td>
                  <td colSpan={2} className="lb-nb" />
                  <td colSpan={2} className="lb-l">Izin</td>
                  <td colSpan={4}>=&nbsp;&nbsp;&nbsp;&nbsp;{two(izin)}</td>
                  <td colSpan={3} className="lb-l">Orang</td>
                </tr>
                <tr>
                  <td className="lb-l" />
                  <td colSpan={2} className="lb-nb" />
                  <td colSpan={2} className="lb-l">Alpa</td>
                  <td colSpan={4}>=&nbsp;&nbsp;&nbsp;&nbsp;{two(alpa)}</td>
                  <td colSpan={3} className="lb-l">Orang</td>
                </tr>
                <tr>
                  <td className="lb-l lb-sp2">H. JUMLAH GURU</td>
                  <td colSpan={2}>{gurus.length}</td>
                  <td colSpan={2} className="lb-l">L =&nbsp;&nbsp; {gL}</td>
                  <td colSpan={7} className="lb-l">P =&nbsp;&nbsp; {gP}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================== HALAMAN 2 ===================== */}
      <div className="lb-page lb-page2">
        <div className="lb-g-title">GURU – GURU</div>
        <table className="lb-tbl lb-guru">
          <colgroup>
            <col style={{ width: '2%' }} />
            <col style={{ width: '12.6%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '1.9%' }} />
            <col style={{ width: '1.9%' }} />
            <col style={{ width: '2.1%' }} />
            <col style={{ width: '2.4%' }} />
            <col style={{ width: '5.6%' }} />
            <col style={{ width: '4.7%' }} />
            <col style={{ width: '6.4%' }} />
            <col style={{ width: '4.7%' }} />
            <col style={{ width: '3.2%' }} />
            <col style={{ width: '12.6%' }} />
            <col style={{ width: '7.8%' }} />
            <col style={{ width: '4.4%' }} />
            {Array.from({ length: 4 }, (_, i) => (
              <col key={`s${i}`} style={{ width: '1.8%' }} />
            ))}
            {Array.from({ length: 3 }, (_, i) => (
              <col key={`a${i}`} style={{ width: '1.8%' }} />
            ))}
            <col style={{ width: '5.2%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>No</th>
              <th rowSpan={2}>Nama<br /><span className="lb-nrm">Tempat,Tanggal Lahir</span></th>
              <th rowSpan={2}>NIP /<br />KARPEG</th>
              <th rowSpan={2}><span className="lb-vert">Jenis Kelamin</span></th>
              <th rowSpan={2}><span className="lb-vert">Agama</span></th>
              <th rowSpan={2}><span className="lb-vert">Kawin/T. Kawin</span></th>
              <th rowSpan={2}><span className="lb-vert">Anak di bawah umur 18 tahun</span></th>
              <th rowSpan={2}>Ijazah dan tahunnya</th>
              <th rowSpan={2}>Jabatan</th>
              <th rowSpan={2}><span className="lb-vert">Masa kerja seluruhnya yang bisa dihitung untuk pensiun</span></th>
              <th rowSpan={2}><span className="lb-vert">Mulai bekerja di sekolah ini</span></th>
              <th rowSpan={2}><span className="lb-vert">Mengajar di Kls</span></th>
              <th rowSpan={2}>Tanggal dan No. SK. Terakhir</th>
              <th rowSpan={2}>Gol./Ruang<br />TMT</th>
              <th rowSpan={2}>Gaji<br />Pokok</th>
              <th colSpan={4}>Status</th>
              <th colSpan={3}>Absen</th>
              <th rowSpan={2}><span className="lb-vert">Keterangan</span></th>
            </tr>
            <tr>
              {['PNS', 'G. Bantu', 'PPPK', 'PPPK PW', 'Sakit', 'Ijin', 'Alpa'].map((t) => (
                <th key={t} className="lb-vh"><span className="lb-vert">{t}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gtk.map((g, idx) => {
              const ab = reportData.absen?.[g.id] || {};
              const sp = g.statusPeg || '';
              const isPPPKPW = /paruh/i.test(sp);
              const isPPPK = !isPPPKPW && /pppk/i.test(sp);
              const isPNS = !isPPPK && !isPPPKPW && /^(c?pns)/i.test(sp);
              const isBantu = !isPNS && !isPPPK && !isPPPKPW;
              const mark = (on: boolean) => (on ? '√' : '-');
              const pangkat = g.golongan ? PANGKAT[g.golongan] : '';
              const ttl = [g.tempatLahir, fmtLong(g.tglLahir)].filter(Boolean).join(', ');
              const ag = g.agama ? AGAMA[g.agama.toLowerCase()] || g.agama : '';
              return (
                <tr key={g.id}>
                  <td>{idx + 1}</td>
                  <td className="lb-l">
                    <b className="lb-nm">{g.nama}</b>
                    <div>{ttl}</div>
                  </td>
                  <td>
                    {g.nip || '-'}
                    {g.karpeg ? <div>{g.karpeg}</div> : null}
                  </td>
                  <td>{g.jk}</td>
                  <td>{ag}</td>
                  <td>{g.kawin || '-'}</td>
                  <td>{g.anak ? pad2(g.anak) : '-'}</td>
                  <td>{g.ijazah || g.pendidikan || '-'}</td>
                  <td>{g.jabatan}</td>
                  <td className="lb-pre">{masaKerja(g, yy, mm) || '-'}</td>
                  <td>{fmtDash(g.tmt) || '-'}</td>
                  <td>{g.mengampu || '-'}</td>
                  <td>
                    {g.skTanggal ? fmtLong(g.skTanggal) : '-'}
                    {g.skNomor ? <div>{g.skNomor}</div> : null}
                  </td>
                  <td>
                    {g.golongan ? `${pangkat ? pangkat + ' ' : ''}${g.golongan}` : '-'}
                    {g.tmtGol ? <div>{fmtDash(g.tmtGol)}</div> : null}
                  </td>
                  <td>{g.gaji ? g.gaji.toLocaleString('id-ID') : '-'}</td>
                  <td>{mark(isPNS)}</td>
                  <td>{mark(isBantu)}</td>
                  <td>{mark(isPPPK)}</td>
                  <td>{mark(isPPPKPW)}</td>
                  <td>{cnt(ab.s || 0)}</td>
                  <td>{cnt(ab.i || 0)}</td>
                  <td>{cnt(ab.a || 0)}</td>
                  <td>{g.ketLaporan || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="lb-ttd">
          <div className="lb-ttd-l">
            <div>{korwilJabatanVal}</div>
            <div>Kecamatan {config.kecamatan || ''}</div>
            <div className="lb-ttd-gap" />
            <div className="lb-ttd-nm">{korwilNamaVal || '…………………………………'}</div>
            <div>NIP. {korwilNipVal || '…………………………………'}</div>
          </div>
          <div className="lb-ttd-r">
            <div>
              {tempatLaporanVal || config.kecamatan || config.kabupaten}, {tglLaporanVal}
            </div>
            <div>Kepala {config.namaSekolah},</div>
            <div className="lb-ttd-gap" />
            <div className="lb-ttd-nm">{kepsekVal}</div>
            <div>NIP. &nbsp;{nipKepsekVal}</div>
          </div>
        </div>
      </div>
    </>
  );
};
