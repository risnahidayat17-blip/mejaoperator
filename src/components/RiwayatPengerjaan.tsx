/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import {
  getSiswas,
  getGurus,
  getDokumenGtks,
  getSuratMasuk,
  getSuratKeluar,
  getMutasi,
  getArsipAbsen,
  getAsets,
  getNilaiRecords,
} from '../lib/storage';

/**
 * Ringkasan riwayat pengerjaan. Dibuat dari waktu tambah/ubah yang sudah tercatat pada setiap data
 * (tidak ada data tambahan yang disimpan). Muat data massal (mis. impor Dapodik) dihitung sebagai satu kegiatan.
 */

interface Activity {
  module: string;
  label: string;
  ts: number;
  baru: boolean;
}

const BULK_THRESHOLD = 20; // lebih dari ini dalam satu menit = impor massal

function collect(): Activity[] {
  const raw: Array<{ module: string; items: any[]; label: (x: any) => string }> = [
    { module: 'Siswa', items: getSiswas(), label: (x) => x.nama },
    { module: 'Guru & Tendik', items: getGurus(), label: (x) => x.nama },
    { module: 'Dokumen GTK', items: getDokumenGtks(), label: (x) => x.judul },
    { module: 'Surat masuk', items: getSuratMasuk(), label: (x) => x.perihal },
    { module: 'Surat keluar', items: getSuratKeluar(), label: (x) => x.perihal },
    { module: 'Mutasi', items: getMutasi(), label: (x) => x.nama },
    { module: 'Arsip absen', items: getArsipAbsen(), label: (x) => `Absen Kelas ${x.kelas} - ${x.periode}` },
    { module: 'Aset', items: getAsets(), label: (x) => x.nama },
    { module: 'Penilaian', items: getNilaiRecords(), label: (x) => `Nilai kelas ${x.kelas} ${x.ta}` },
  ];

  const out: Activity[] = [];
  for (const g of raw) {
    const groups = new Map<number, Activity[]>();
    for (const it of g.items) {
      const ts = Number(it.updatedAt || it.createdAt || 0);
      if (!ts) continue;
      const baru = !!it.createdAt && Math.abs(Number(it.updatedAt || it.createdAt) - Number(it.createdAt)) < 2000;
      const a: Activity = { module: g.module, label: String(g.label(it) || '-'), ts, baru };
      const k = Math.floor(ts / 60000);
      const arr = groups.get(k) || [];
      arr.push(a);
      groups.set(k, arr);
    }
    groups.forEach((arr) => {
      if (arr.length > BULK_THRESHOLD) {
        out.push({ module: g.module, label: `Impor / muat data (${arr.length} catatan)`, ts: arr[0].ts, baru: true });
      } else out.push(...arr);
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const RiwayatPengerjaan: React.FC = () => {
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const all = useMemo(collect, [Date.now() - (Date.now() % 5000)]); // segarkan tiap render berselang 5 dtk

  const days = useMemo(() => {
    const list: Array<{ date: Date; key: string; count: number }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      list.push({ date: d, key: dayKey(d), count: 0 });
    }
    const idx = new Map(list.map((x, i) => [x.key, i]));
    for (const a of all) {
      const i = idx.get(dayKey(new Date(a.ts)));
      if (i !== undefined) list[i].count++;
    }
    return list;
  }, [all, range]);

  const perModule = useMemo(() => {
    const from = days[0]?.date.getTime() ?? 0;
    const m = new Map<string, number>();
    for (const a of all) if (a.ts >= from) m.set(a.module, (m.get(a.module) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [all, days]);

  const total = days.reduce((s, d) => s + d.count, 0);
  const maxDay = Math.max(...days.map((d) => d.count), 1);
  const maxMod = Math.max(...perModule.map(([, c]) => c), 1);
  const recent = all.slice(0, 8);

  return (
    <div className="bg-white border border-[#D3DDD9] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#13262A] font-display flex items-center gap-2">
            <History className="w-4 h-4 text-[#0B6B58]" /> Riwayat Pengerjaan
          </h3>
          <p className="text-[11px] text-[#566A6E]">
            <b className="text-[#13262A]">{total}</b> kegiatan input/ubah data dalam {range} hari terakhir
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#E8EFEC] p-0.5 rounded-lg text-[11px]" role="group" aria-label="Rentang waktu">
          {([7, 14, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition ${
                range === r ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
              }`}
            >
              {r} hari
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-[#566A6E]">Belum ada kegiatan pada rentang ini.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Diagram batang per hari */}
          <div className="lg:col-span-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#566A6E] mb-2">Kegiatan per hari</div>
            <div className="relative flex items-end gap-[3px] h-40 border-b border-[#D3DDD9]" onMouseLeave={() => setHover(null)}>
              {[0.5, 1].map((f) => (
                <div
                  key={f}
                  className="absolute left-0 right-0 border-t border-dashed border-[#E8EFEC] pointer-events-none"
                  style={{ bottom: `${f * 100}%` }}
                />
              ))}
              <span className="absolute -top-0.5 left-0 text-[9px] font-mono text-[#566A6E] bg-white pr-1">{maxDay}</span>
              {days.map((d, i) => {
                const h = (d.count / maxDay) * 100;
                const isToday = i === days.length - 1;
                return (
                  <div
                    key={d.key}
                    className="relative flex-1 h-full flex items-end justify-center"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    tabIndex={0}
                    aria-label={`${d.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.count} kegiatan`}
                  >
                    <div
                      className={`w-full max-w-[22px] rounded-t-[4px] transition ${
                        d.count === 0 ? 'bg-[#E8EFEC]' : isToday ? 'bg-[#0B6B58]' : 'bg-[#0B6B58]/70'
                      } ${hover === i ? 'brightness-90' : ''}`}
                      style={{ height: d.count === 0 ? '2px' : `${Math.max(h, 4)}%` }}
                    />
                    {hover === i && (
                      <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#13262A] text-white text-[10px] rounded-md px-2 py-1 shadow-lg pointer-events-none">
                        {d.date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}:{' '}
                        <b>{d.count}</b> kegiatan
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px] mt-1">
              {days.map((d, i) => {
                const show = range <= 14 || i % 3 === 0 || i === days.length - 1;
                return (
                  <div key={d.key} className="flex-1 text-center text-[9px] text-[#566A6E] leading-tight">
                    {show ? (
                      <>
                        <div>{d.date.getDate()}</div>
                        {range <= 14 && <div className="text-[#8A9A9D]">{HARI[d.date.getDay()]}</div>}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per modul */}
          <div className="lg:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#566A6E] mb-2">Per bagian</div>
            <div className="space-y-1.5">
              {perModule.map(([name, c]) => (
                <div key={name} className="flex items-center gap-2 text-[11px]" title={`${name}: ${c} kegiatan`}>
                  <span className="w-24 shrink-0 text-[#13262A] font-medium truncate">{name}</span>
                  <div className="flex-1 h-2.5 bg-[#F1F4F2] rounded-full overflow-hidden">
                    <div className="h-full bg-[#0B6B58] rounded-full" style={{ width: `${(c / maxMod) * 100}%` }} />
                  </div>
                  <span className="w-7 text-right font-mono font-bold text-[#13262A]">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Aktivitas terbaru */}
      {recent.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#566A6E] mb-1.5">Terakhir dikerjakan</div>
          <ul className="divide-y divide-[#E8EFEC] border border-[#E8EFEC] rounded-xl overflow-hidden">
            {recent.map((a, i) => (
              <li key={i} className="px-3 py-2 flex items-center gap-2.5 text-xs bg-white">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                    a.baru ? 'bg-[#DAEEE7] text-[#0B6B58]' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {a.baru ? 'Baru' : 'Diubah'}
                </span>
                <span className="text-[#566A6E] shrink-0 w-24 truncate">{a.module}</span>
                <span className="font-medium text-[#13262A] truncate flex-1">{a.label}</span>
                <span className="text-[10px] text-[#566A6E] shrink-0">{relTime(a.ts)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] text-[#0B6B58] font-semibold underline cursor-pointer"
        >
          {showTable ? 'Sembunyikan tabel data' : 'Lihat sebagai tabel'}
        </button>
        {showTable && (
          <table className="mt-2 w-full text-[11px] border border-[#E8EFEC]">
            <thead className="bg-[#F1F4F2] text-[#566A6E]">
              <tr>
                <th className="text-left px-2 py-1">Tanggal</th>
                <th className="text-right px-2 py-1">Kegiatan</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.key} className="border-t border-[#E8EFEC]">
                  <td className="px-2 py-1">{d.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</td>
                  <td className="px-2 py-1 text-right font-mono font-bold">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
