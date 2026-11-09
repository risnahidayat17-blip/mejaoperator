/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { History, Trash2, CheckCircle2, User, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { getActivities, clearActivities, subscribeToStorage } from '../lib/storage';
import { WorkActivity } from '../types';

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

function formatFullDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const RiwayatPengerjaan: React.FC = () => {
  const [range, setRange] = useState<7 | 14 | 30>(14);
  const [showTable, setShowTable] = useState(false);
  const [tableTab, setTableTab] = useState<'log' | 'rekap'>('log');
  const [hover, setHover] = useState<number | null>(null);
  const [activities, setActivities] = useState<WorkActivity[]>(() => getActivities());
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    const unsub = subscribeToStorage(() => {
      setActivities(getActivities());
    });
    return unsub;
  }, []);

  const all = activities;

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

  const handleClear = () => {
    clearActivities();
    setActivities([]);
    setShowConfirmClear(false);
  };

  return (
    <div className="bg-white border border-[#D3DDD9] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#13262A] font-display flex items-center gap-2">
            <History className="w-4 h-4 text-[#0B6B58]" /> Riwayat Pengerjaan
          </h3>
          <p className="text-[11px] text-[#566A6E]">
            {all.length === 0 ? (
              'Belum ada kegiatan pengerjaan yang tercatat di aplikasi'
            ) : (
              <>
                <b className="text-[#13262A]">{total}</b> kegiatan riil dalam {range} hari terakhir (total {all.length} catatan)
              </>
            )}
          </p>
        </div>
        {all.length > 0 && (
          <div className="flex items-center gap-2">
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
            {!showConfirmClear ? (
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                title="Bersihkan riwayat pengerjaan"
                className="p-1.5 text-[#566A6E] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg text-[11px]">
                <span className="text-rose-800 font-medium">Hapus riwayat?</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-1.5 py-0.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Ya
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmClear(false)}
                  className="px-1.5 py-0.5 text-[#566A6E] hover:text-[#13262A] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {all.length === 0 ? (
        <div className="py-8 px-4 text-center bg-[#F9FBFA] rounded-xl border border-dashed border-[#D3DDD9] space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#E8EFEC] text-[#0B6B58] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-[#13262A]">Belum Ada Riwayat Pengerjaan</div>
          <p className="text-[11px] text-[#566A6E] max-w-md mx-auto leading-relaxed">
            Bagian ini hanya memunculkan kegiatan yang benar-benar Anda kerjakan di aplikasi (misalnya menambah, mengubah, atau menghapus data siswa, GTK, surat, sarpras, mutasi, nilai, atau keuangan). Data awal bawaan tidak akan dimunculkan otomatis.
          </p>
        </div>
      ) : total === 0 ? (
        <div className="py-8 text-center text-xs text-[#566A6E]">
          Belum ada kegiatan pengerjaan pada rentang {range} hari ini.
        </div>
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

      {/* Aktivitas terbaru yang benar-benar dikerjakan */}
      {recent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#566A6E]">
              Terakhir Dikerjakan (Aktivitas Guru & Tendik)
            </div>
            <span className="text-[10px] text-[#566A6E]">
              Menampilkan {recent.length} dari {all.length} perubahan
            </span>
          </div>
          <ul className="divide-y divide-[#E8EFEC] border border-[#E8EFEC] rounded-xl overflow-hidden shadow-xs">
            {recent.map((a) => {
              const badgeStyle =
                a.action === 'delete'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : a.baru || a.action === 'create'
                  ? 'bg-[#DAEEE7] text-[#0B6B58] border-[#B8D7CD]'
                  : 'bg-amber-100 text-amber-800 border-amber-200';
              const badgeText =
                a.action === 'delete'
                  ? 'Dihapus'
                  : a.baru || a.action === 'create'
                  ? 'Baru'
                  : 'Diubah';
              const pelaku = a.userNama || 'RISNA HIDAYAT, S.PD.';
              const peran = a.userRole || 'Tendik';

              return (
                <li
                  key={a.id}
                  className="px-3.5 py-2.5 flex flex-wrap md:flex-nowrap items-center gap-2.5 text-xs bg-white hover:bg-[#F9FBFA] transition-colors"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border shrink-0 ${badgeStyle}`}
                  >
                    {badgeText}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F1F4F2] text-[#566A6E] text-[10px] font-semibold shrink-0">
                    {a.module}
                  </span>
                  <span className="font-medium text-[#13262A] truncate flex-1 min-w-[200px]" title={a.label}>
                    {a.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#DAEEE7]/70 border border-[#B8D7CD] text-[#0B6B58] text-[10px] font-bold shrink-0"
                      title={`Pelaksana: ${pelaku} (${peran})`}
                    >
                      <User className="w-3.5 h-3.5 text-[#0B6B58]" />
                      <span className="truncate max-w-[160px]">{pelaku}</span>
                      {peran && (
                        <span className="text-[9px] font-medium text-[#0B6B58]/80 hidden lg:inline">
                          ({peran})
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-[#566A6E] shrink-0 font-mono whitespace-nowrap">
                      {relTime(a.ts)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {all.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#0B6B58] font-bold hover:underline cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              {showTable ? 'Tutup tabel data riwayat' : 'Lihat semua riwayat perubahan (Tabel Audit Log)'}
              {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showTable && (
              <div className="flex items-center gap-1 bg-[#F1F4F2] p-0.5 rounded-lg text-[10px]">
                <button
                  type="button"
                  onClick={() => setTableTab('log')}
                  className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition ${
                    tableTab === 'log' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E]'
                  }`}
                >
                  Log Detail Guru & Tendik ({all.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTableTab('rekap')}
                  className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition ${
                    tableTab === 'rekap' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E]'
                  }`}
                >
                  Rekap Harian
                </button>
              </div>
            )}
          </div>

          {showTable && tableTab === 'log' && (
            <div className="mt-2.5 overflow-x-auto border border-[#E8EFEC] rounded-xl max-h-80 overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-[#F1F4F2] text-[#566A6E] font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Pelaksana (Guru / Tendik)</th>
                    <th className="px-3 py-2">Bagian/Modul</th>
                    <th className="px-3 py-2">Aksi</th>
                    <th className="px-3 py-2">Rincian Perubahan yang Dikerjakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EFEC] bg-white">
                  {all.map((a) => {
                    const badgeStyle =
                      a.action === 'delete'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : a.baru || a.action === 'create'
                        ? 'bg-[#DAEEE7] text-[#0B6B58] border-[#B8D7CD]'
                        : 'bg-amber-100 text-amber-800 border-amber-200';
                    const badgeText =
                      a.action === 'delete'
                        ? 'Dihapus'
                        : a.baru || a.action === 'create'
                        ? 'Baru'
                        : 'Diubah';
                    const pelaku = a.userNama || 'RISNA HIDAYAT, S.PD.';
                    const peran = a.userRole || 'Tendik';

                    return (
                      <tr key={a.id} className="hover:bg-[#F9FBFA] transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap text-[#566A6E] font-mono text-[10px]">
                          {formatFullDate(a.ts)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-bold text-[#13262A]">
                            <User className="w-3 h-3 text-[#0B6B58]" />
                            {pelaku}
                            {peran && (
                              <span className="text-[10px] font-normal text-[#566A6E]">
                                ({peran})
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-[#F1F4F2] text-[#566A6E] text-[10px] font-medium">
                            {a.module}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${badgeStyle}`}>
                            {badgeText}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#13262A] font-medium">
                          {a.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showTable && tableTab === 'rekap' && (
            <div className="mt-2.5 overflow-x-auto border border-[#E8EFEC] rounded-xl">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-[#F1F4F2] text-[#566A6E] font-semibold">
                  <tr>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2 text-right">Jumlah Kegiatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EFEC] bg-white">
                  {[...days].reverse().map((d) => (
                    <tr key={d.key} className="hover:bg-[#F9FBFA]">
                      <td className="px-3 py-2 text-[#13262A]">
                        {d.date.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#0B6B58]">
                        {d.count} kegiatan
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
