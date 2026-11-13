/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { SchoolConfig, Guru, Siswa } from '../types';
import {
  getDapodikWsConfig,
  saveDapodikWsConfig,
  importBulkGurus,
  importBulkSiswas,
  syncRombelsFromSiswa,
  flushCloudPushNow,
} from '../lib/storage';
import {
  DapodikWsConfig,
  DapodikSekolahInfo,
  fetchDapodikEndpoint,
  extractDapodikRows,
  mapDapodikSekolahInfo,
  mapDapodikGtkToGurus,
  mapDapodikPdToSiswas,
  buildRombelMap,
  parseDapodikRawJson,
  generateWindowsBridgeBat,
} from '../lib/dapodikWebService';
import {
  Server,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Users,
  GraduationCap,
  HelpCircle,
  FileJson,
  Upload,
  Zap,
  ShieldCheck,
  X,
  Copy,
  Check,
} from 'lucide-react';

interface DapodikWebServicePanelProps {
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
  defaultFocus?: 'gtk' | 'siswa' | 'all';
  onImported?: () => void;
}

export const DapodikWebServicePanel: React.FC<DapodikWebServicePanelProps> = ({
  config,
  onToast,
  defaultFocus = 'all',
  onImported,
}) => {
  const [wsCfg, setWsCfg] = useState<DapodikWsConfig>(() => getDapodikWsConfig());
  const [subTab, setSubTab] = useState<'live' | 'json' | 'guide'>('live');
  const [showToken, setShowToken] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<{
    ok: boolean;
    message: string;
    sekolah?: DapodikSekolahInfo;
  } | null>(null);

  // Preview state
  const [fetchedGurus, setFetchedGurus] = useState<Guru[]>([]);
  const [fetchedSiswas, setFetchedSiswas] = useState<Siswa[]>([]);
  const [previewTab, setPreviewTab] = useState<'gtk' | 'siswa'>(
    defaultFocus === 'siswa' ? 'siswa' : 'gtk'
  );
  const [importMode, setImportMode] = useState<'merge' | 'add_only' | 'replace'>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Manual JSON tab
  const [rawJsonText, setRawJsonText] = useState('');
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const updateWs = (patch: Partial<DapodikWsConfig>) => {
    const next = saveDapodikWsConfig(patch);
    setWsCfg(next);
  };

  const handleDownloadBridge = () => {
    let dapodikPort = 5774;
    let bridgePort = 5775;
    try {
      const u1 = new URL(wsCfg.baseUrl || 'http://localhost:5774');
      if (u1.port) dapodikPort = parseInt(u1.port, 10) || 5774;
    } catch {}
    try {
      const u2 = new URL(wsCfg.bridgeUrl || 'http://localhost:5775');
      if (u2.port) bridgePort = parseInt(u2.port, 10) || 5775;
    } catch {}

    const content = generateWindowsBridgeBat(dapodikPort, bridgePort);
    const blob = new Blob([content], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Dapodik_Bridge_Lokal.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    onToast('File Dapodik_Bridge_Lokal.bat diunduh. Klik 2x di laptop Dapodik sebelum tarik data.');
  };

  const handleTestConnection = async () => {
    setBusyAction('test');
    setConnStatus(null);
    try {
      const payload = await fetchDapodikEndpoint(wsCfg, 'getSekolah');
      const info = mapDapodikSekolahInfo(payload);
      const msg = info?.nama
        ? `Terhubung ke Dapodik: ${info.nama} (NPSN ${info.npsn || wsCfg.npsn})`
        : 'Koneksi ke Web Service Dapodik berhasil!';
      setConnStatus({ ok: true, message: msg, sekolah: info });
      if (info?.nama) {
        updateWs({ lastSchoolName: info.nama });
      }
      onToast(msg);
    } catch (err: any) {
      const msg = err?.message || 'Gagal terhubung ke Web Service Dapodik.';
      setConnStatus({ ok: false, message: msg });
      onToast(msg, true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleFetchData = async (target: 'gtk' | 'siswa' | 'all') => {
    setBusyAction(target);
    setConnStatus(null);
    try {
      let nextGurus = target === 'siswa' ? fetchedGurus : [];
      let nextSiswas = target === 'gtk' ? fetchedSiswas : [];

      if (target === 'gtk' || target === 'all') {
        const gtkRes = await fetchDapodikEndpoint(wsCfg, 'getGtk');
        const gtkRows = extractDapodikRows(gtkRes);
        nextGurus = mapDapodikGtkToGurus(gtkRows);
        setFetchedGurus(nextGurus);
      }

      if (target === 'siswa' || target === 'all') {
        let rombelMap: Map<string, { nama: string; tingkat: string }> | undefined;
        try {
          const romRes = await fetchDapodikEndpoint(wsCfg, 'getRombonganBelajar');
          rombelMap = buildRombelMap(extractDapodikRows(romRes));
        } catch {
          // Opsional: beberapa versi Dapodik tidak butuh getRombonganBelajar karena nama_rombel sudah ada di getPesertaDidik
        }
        const pdRes = await fetchDapodikEndpoint(wsCfg, 'getPesertaDidik');
        const pdRows = extractDapodikRows(pdRes);
        nextSiswas = mapDapodikPdToSiswas(pdRows, rombelMap);
        setFetchedSiswas(nextSiswas);
      }

      if (target === 'gtk') setPreviewTab('gtk');
      else if (target === 'siswa') setPreviewTab('siswa');
      else setPreviewTab(nextGurus.length ? 'gtk' : 'siswa');

      const summaryParts: string[] = [];
      if (target === 'gtk' || target === 'all') summaryParts.push(`${nextGurus.length} GTK (Guru & Tendik)`);
      if (target === 'siswa' || target === 'all') summaryParts.push(`${nextSiswas.length} Peserta Didik`);
      const msg = `Berhasil mengambil ${summaryParts.join(' dan ')} dari Web Service Dapodik. Periksa pratinjau lalu klik Simpan.`;
      setConnStatus({ ok: true, message: msg });
      onToast(msg);
    } catch (err: any) {
      const msg = err?.message || 'Gagal mengambil data dari Dapodik.';
      setConnStatus({ ok: false, message: msg });
      onToast(msg, true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleParseManualJson = () => {
    if (!rawJsonText.trim()) {
      onToast('Tempel isi JSON atau unggah file .json terlebih dahulu.', true);
      return;
    }
    try {
      const res = parseDapodikRawJson(rawJsonText);
      if (res.kind === 'gtk') {
        setFetchedGurus(res.gurus);
        setPreviewTab('gtk');
        setSubTab('live');
        onToast(`Terbaca ${res.gurus.length} data Guru & Tendik dari JSON Dapodik.`);
      } else if (res.kind === 'siswa') {
        setFetchedSiswas(res.siswas);
        setPreviewTab('siswa');
        setSubTab('live');
        onToast(`Terbaca ${res.siswas.length} data Peserta Didik dari JSON Dapodik.`);
      } else if (res.kind === 'sekolah' && res.sekolah) {
        setConnStatus({
          ok: true,
          message: `JSON Sekolah terbaca: ${res.sekolah.nama || '-'} (${res.sekolah.npsn || '-'})`,
          sekolah: res.sekolah,
        });
        setSubTab('live');
        onToast('JSON data sekolah terbaca.');
      } else {
        onToast('Format JSON tidak dikenali sebagai output Web Service Dapodik (getGtk / getPesertaDidik).', true);
      }
    } catch {
      onToast('Teks JSON tidak valid. Pastikan seluruh teks JSON disalin utuh.', true);
    }
  };

  const handleCommitImport = async () => {
    if (!fetchedGurus.length && !fetchedSiswas.length) {
      onToast('Belum ada data GTK atau Siswa yang diambil untuk disimpan.', true);
      return;
    }
    if (importMode === 'replace' && !confirmReplace) {
      onToast('Centang konfirmasi penggantian total sebelum menyimpan.', true);
      return;
    }

    setBusyAction('save');
    try {
      const msgs: string[] = [];
      if (fetchedGurus.length > 0) {
        const gRes = importBulkGurus(fetchedGurus, importMode);
        msgs.push(`GTK: +${gRes.added} baru, ${gRes.updated} diperbarui`);
      }
      if (fetchedSiswas.length > 0) {
        const sRes = importBulkSiswas(fetchedSiswas, importMode);
        syncRombelsFromSiswa();
        msgs.push(`Siswa: +${sRes.added} baru, ${sRes.updated} diperbarui`);
      }

      updateWs({
        lastSyncAt: Date.now(),
        lastGtkCount: fetchedGurus.length || wsCfg.lastGtkCount,
        lastSiswaCount: fetchedSiswas.length || wsCfg.lastSiswaCount,
      });

      await flushCloudPushNow().catch(() => false);
      onToast(`Data Dapodik tersimpan (${msgs.join(' | ')}).`);
      setFetchedGurus([]);
      setFetchedSiswas([]);
      setConfirmReplace(false);
      onImported?.();
    } catch (err: any) {
      onToast(err?.message || 'Gagal menyimpan data ke aplikasi.', true);
    } finally {
      setBusyAction(null);
    }
  };

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedUrl(key);
    setTimeout(() => setCopiedUrl(null), 1800);
  };

  const countGuruOnly = fetchedGurus.filter((g) => g.jenisGtk !== 'Tendik').length;
  const countTendikOnly = fetchedGurus.filter((g) => g.jenisGtk === 'Tendik').length;

  return (
    <div className="space-y-4 text-xs">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B6B58] to-[#0E7490] text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm font-display">Web Service Lokal Dapodik (Port 5774)</div>
            <div className="text-[11px] text-emerald-100 mt-0.5">
              Tarik data Guru, Tendik, dan Peserta Didik langsung dari Aplikasi Dapodik laptop operator ke Meja Operator &amp; Supabase Cloud.
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('live')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'live' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-white/85 hover:text-white'
            }`}
          >
            Tarik Data Live
          </button>
          <button
            type="button"
            onClick={() => setSubTab('json')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'json' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-white/85 hover:text-white'
            }`}
          >
            Tempel / Unggah JSON
          </button>
          <button
            type="button"
            onClick={() => setSubTab('guide')}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              subTab === 'guide' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-white/85 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" /> Cara Pakai
          </button>
        </div>
      </div>

      {/* SUBTAB 1: LIVE CONNECTION */}
      {subTab === 'live' && (
        <div className="space-y-4">
          {/* Connection Mode & Bridge Helper */}
          <div className="bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[#13262A]">Konfigurasi Koneksi Web Service Dapodik</span>
              {wsCfg.lastSyncAt && (
                <span className="text-[11px] text-[#566A6E]">
                  Sinkron terakhir:{' '}
                  {new Date(wsCfg.lastSyncAt).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>

            {/* Mode Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  wsCfg.useBridge
                    ? 'bg-white border-[#0B6B58] ring-1 ring-[#0B6B58]/20'
                    : 'bg-white/60 border-[#D3DDD9] hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="wsMode"
                  checked={wsCfg.useBridge}
                  onChange={() => updateWs({ useBridge: true })}
                  className="mt-0.5 accent-[#0B6B58]"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#13262A]">Via Bridge Lokal CORS (Rekomendasi Web HTTPS)</div>
                  <p className="text-[11px] text-[#566A6E] mt-0.5 leading-relaxed">
                    Mengatasi blokir CORS browser saat membuka Meja Operator lewat internet/HTTPS ke Dapodik <code className="font-mono">localhost:5774</code>.
                  </p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDownloadBridge();
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#DAEEE7] hover:bg-[#c5e4d9] text-[#0B6B58] font-bold rounded-lg text-[11px] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh Bridge_Dapodik.bat (Windows)
                    </button>
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  !wsCfg.useBridge
                    ? 'bg-white border-[#0B6B58] ring-1 ring-[#0B6B58]/20'
                    : 'bg-white/60 border-[#D3DDD9] hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="wsMode"
                  checked={!wsCfg.useBridge}
                  onChange={() => updateWs({ useBridge: false })}
                  className="mt-0.5 accent-[#0B6B58]"
                />
                <div>
                  <div className="font-bold text-[#13262A]">Koneksi Langsung ke Dapodik / URL Tunnel</div>
                  <p className="text-[11px] text-[#566A6E] mt-0.5 leading-relaxed">
                    Menghubungi langsung <code className="font-mono">http://localhost:5774</code> (atau URL Ngrok/Cloudflare Tunnel jika menarik dari perangkat lain).
                  </p>
                </div>
              </label>
            </div>

            {/* Form Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">
                  {wsCfg.useBridge ? 'URL Bridge Lokal' : 'URL Web Service Dapodik'}
                </label>
                <input
                  type="text"
                  value={wsCfg.useBridge ? wsCfg.bridgeUrl : wsCfg.baseUrl}
                  onChange={(e) =>
                    updateWs(wsCfg.useBridge ? { bridgeUrl: e.target.value } : { baseUrl: e.target.value })
                  }
                  placeholder={wsCfg.useBridge ? 'http://localhost:5775' : 'http://localhost:5774'}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg bg-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">NPSN Sekolah</label>
                <input
                  type="text"
                  value={wsCfg.npsn}
                  onChange={(e) => updateWs({ npsn: e.target.value })}
                  placeholder={config.npsn || 'Contoh: 20214897'}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg bg-white font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Token Web Service Dapodik</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={wsCfg.token}
                    onChange={(e) => updateWs({ token: e.target.value })}
                    placeholder="Tempel Token dari Dapodik..."
                    className="w-full pl-3 pr-9 py-2 border border-[#D3DDD9] rounded-lg bg-white font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2 top-2 p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                    title={showToken ? 'Sembunyikan Token' : 'Tampilkan Token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E4EBE8]">
              <button
                type="button"
                disabled={!!busyAction}
                onClick={handleTestConnection}
                className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-[#D3DDD9] text-[#13262A] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                {busyAction === 'test' ? 'Menguji...' : 'Tes Koneksi'}
              </button>

              <button
                type="button"
                disabled={!!busyAction}
                onClick={() => handleFetchData('gtk')}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                {busyAction === 'gtk' ? 'Mengambil GTK...' : 'Ambil Data Guru & Tendik'}
              </button>

              <button
                type="button"
                disabled={!!busyAction}
                onClick={() => handleFetchData('siswa')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
              >
                <Users className="w-3.5 h-3.5" />
                {busyAction === 'siswa' ? 'Mengambil Siswa...' : 'Ambil Data Siswa'}
              </button>

              <button
                type="button"
                disabled={!!busyAction}
                onClick={() => handleFetchData('all')}
                className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs ml-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'all' ? 'animate-spin' : ''}`} />
                {busyAction === 'all' ? 'Menarik Semua...' : 'Tarik Semua (GTK + Siswa)'}
              </button>
            </div>
          </div>

          {/* Connection Feedback */}
          {connStatus && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                connStatus.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {connStatus.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <div className="font-semibold">{connStatus.message}</div>
                {connStatus.sekolah && (
                  <div className="text-[11px] opacity-90">
                    Kepala Sekolah: <b>{connStatus.sekolah.kepalaSekolah || '-'}</b> &middot; Alamat:{' '}
                    {connStatus.sekolah.alamat || '-'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live Preview & Commit Box */}
          {(fetchedGurus.length > 0 || fetchedSiswas.length > 0) && (
            <div className="bg-white border border-[#D3DDD9] rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4EBE8] pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('gtk')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                      previewTab === 'gtk'
                        ? 'bg-[#0B6B58] text-white'
                        : 'bg-[#F1F4F2] text-[#566A6E] hover:text-[#13262A]'
                    }`}
                  >
                    GTK ({fetchedGurus.length}: {countGuruOnly} Guru, {countTendikOnly} Tendik)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('siswa')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                      previewTab === 'siswa'
                        ? 'bg-[#0B6B58] text-white'
                        : 'bg-[#F1F4F2] text-[#566A6E] hover:text-[#13262A]'
                    }`}
                  >
                    Peserta Didik ({fetchedSiswas.length} Siswa)
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={importMode}
                    onChange={(e) => {
                      setImportMode(e.target.value as 'merge' | 'add_only' | 'replace');
                      setConfirmReplace(false);
                    }}
                    className="px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg text-xs font-semibold bg-white"
                  >
                    <option value="merge">Perbarui &amp; Tambah Baru (Rekomendasi)</option>
                    <option value="add_only">Hanya Tambah Data Baru</option>
                    <option value="replace">Ganti Total Data</option>
                  </select>

                  <button
                    type="button"
                    disabled={!!busyAction || (importMode === 'replace' && !confirmReplace)}
                    onClick={handleCommitImport}
                    className="px-4 py-1.5 bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {busyAction === 'save' ? 'Menyimpan...' : 'Simpan ke Aplikasi & Cloud'}
                  </button>
                </div>
              </div>

              {importMode === 'replace' && (
                <label className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                    className="accent-rose-600"
                  />
                  Saya memahami opsi &quot;Ganti Total&quot; akan menimpa daftar {fetchedGurus.length ? 'GTK ' : ''}
                  {fetchedSiswas.length ? 'dan Siswa ' : ''}yang ada (password login guru tetap dipertahankan).
                </label>
              )}

              {/* Preview Table */}
              <div className="max-h-64 overflow-auto border border-[#E4EBE8] rounded-lg">
                {previewTab === 'gtk' ? (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-[#F8FAF9] text-[#566A6E] sticky top-0 border-b border-[#E4EBE8]">
                      <tr>
                        <th className="py-2 px-3 w-10">No</th>
                        <th className="py-2 px-3">Nama GTK</th>
                        <th className="py-2 px-3">NIP / NUPTK</th>
                        <th className="py-2 px-3">Jenis</th>
                        <th className="py-2 px-3">Jabatan</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fetchedGurus.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-[#566A6E]">
                            Belum ada data GTK yang ditarik. Klik &quot;Ambil Data Guru &amp; Tendik&quot;.
                          </td>
                        </tr>
                      ) : (
                        fetchedGurus.slice(0, 100).map((g, i) => (
                          <tr key={g.id + i} className="hover:bg-gray-50">
                            <td className="py-1.5 px-3 font-mono text-gray-400">{i + 1}</td>
                            <td className="py-1.5 px-3 font-bold text-[#13262A]">{g.nama}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-600">
                              {g.nip ? `NIP: ${g.nip}` : g.nuptk ? `NUPTK: ${g.nuptk}` : '-'}
                            </td>
                            <td className="py-1.5 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  g.jenisGtk === 'Tendik'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {g.jenisGtk || 'Guru'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">{g.jabatan}</td>
                            <td className="py-1.5 px-3">{g.statusPeg}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-[#F8FAF9] text-[#566A6E] sticky top-0 border-b border-[#E4EBE8]">
                      <tr>
                        <th className="py-2 px-3 w-10">No</th>
                        <th className="py-2 px-3">Nama Peserta Didik</th>
                        <th className="py-2 px-3">NISN / NIPD</th>
                        <th className="py-2 px-3 text-center">JK</th>
                        <th className="py-2 px-3 text-center">Kelas</th>
                        <th className="py-2 px-3">Rombel</th>
                        <th className="py-2 px-3">Nama Ibu / Ayah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fetchedSiswas.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-[#566A6E]">
                            Belum ada data Siswa yang ditarik. Klik &quot;Ambil Data Siswa&quot;.
                          </td>
                        </tr>
                      ) : (
                        fetchedSiswas.slice(0, 100).map((s, i) => (
                          <tr key={s.id + i} className="hover:bg-gray-50">
                            <td className="py-1.5 px-3 font-mono text-gray-400">{i + 1}</td>
                            <td className="py-1.5 px-3 font-bold text-[#13262A]">{s.nama}</td>
                            <td className="py-1.5 px-3 font-mono text-gray-600">
                              {s.nisn || '-'} {s.nis ? `/ ${s.nis}` : ''}
                            </td>
                            <td className="py-1.5 px-3 text-center font-bold">{s.jk}</td>
                            <td className="py-1.5 px-3 text-center font-bold">{s.kelas}</td>
                            <td className="py-1.5 px-3">{s.rombel || '-'}</td>
                            <td className="py-1.5 px-3 text-gray-600">{s.namaIbu || s.namaAyah || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {((previewTab === 'gtk' && fetchedGurus.length > 100) ||
                (previewTab === 'siswa' && fetchedSiswas.length > 100)) && (
                <div className="text-[11px] text-[#566A6E] text-center">
                  Menampilkan 100 baris pertama di pratinjau. Seluruh data tetap tersimpan saat Anda klik Simpan.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MANUAL JSON IMPORT */}
      {subTab === 'json' && (
        <div className="bg-white border border-[#D3DDD9] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-[#13262A] flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-[#0B6B58]" /> Impor / Tempel Respons JSON Web Service Dapodik
              </h3>
              <p className="text-[11px] text-[#566A6E] mt-0.5">
                Alternatif tanpa Bridge: buka endpoint Dapodik (<code className="font-mono">getGtk</code> atau{' '}
                <code className="font-mono">getPesertaDidik</code>) di browser/Postman/Insomnia, salin atau simpan ke file{' '}
                <code className="font-mono">.json</code>, lalu tempel di bawah.
              </p>
            </div>
            <div>
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json,application/json,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setRawJsonText(await f.text());
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => jsonFileRef.current?.click()}
                className="px-3 py-1.5 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Pilih File .json
              </button>
            </div>
          </div>

          <textarea
            value={rawJsonText}
            onChange={(e) => setRawJsonText(e.target.value)}
            rows={7}
            placeholder='Tempel JSON dari Dapodik di sini, contoh: {"results": 12, "rows": [{"nama": "...", "ptk_id": "..."}]}'
            className="w-full p-3 border border-[#D3DDD9] rounded-lg font-mono text-[11px] bg-[#F8FAF9]"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRawJsonText('')}
              className="px-3.5 py-1.5 border border-[#D3DDD9] text-[#566A6E] rounded-lg font-semibold cursor-pointer"
            >
              Bersihkan
            </button>
            <button
              type="button"
              onClick={handleParseManualJson}
              className="px-4 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer"
            >
              Baca JSON &amp; Pratinjau
            </button>
          </div>
        </div>
      )}

      {/* SUBTAB 3: PANDUAN / CARA PAKAI */}
      {subTab === 'guide' && (
        <div className="bg-white border border-[#D3DDD9] rounded-xl p-5 space-y-4 leading-relaxed">
          <div className="flex items-center gap-2 border-b border-[#E4EBE8] pb-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0B6B58]" />
            <h3 className="font-bold text-sm text-[#13262A] font-display">
              Cara Mengambil Data Guru, Tendik &amp; Siswa via Web Service Lokal Dapodik
            </h3>
          </div>

          <ol className="space-y-3 text-xs text-[#13262A] list-decimal pl-5">
            <li>
              <div className="font-bold">Aktifkan Web Service di Aplikasi Dapodik (Laptop Sekolah)</div>
              <p className="text-[#566A6E] mt-0.5">
                Buka Aplikasi Dapodik → masuk menu <b>Pengaturan</b> → <b>Web Service</b> → klik <b>Tambah</b>:
              </p>
              <ul className="list-disc pl-5 mt-1 text-[#566A6E] space-y-0.5">
                <li>Nama Aplikasi: <b>Meja Operator</b></li>
                <li>IP Address: <code className="font-mono bg-gray-100 px-1 rounded">127.0.0.1</code> atau <code className="font-mono bg-gray-100 px-1 rounded">localhost</code></li>
                <li>Port: <code className="font-mono bg-gray-100 px-1 rounded">5774</code> (bawaan Dapodik)</li>
                <li>Klik <b>Simpan</b>, lalu salin kode <b>Token</b> yang muncul di tabel Web Service Dapodik.</li>
              </ul>
            </li>

            <li>
              <div className="font-bold">Jalankan Bridge Lokal CORS (Wajib saat membuka Meja Operator lewat Web/HTTPS)</div>
              <p className="text-[#566A6E] mt-0.5">
                Karena browser memblokir akses lintas-origin (CORS) dari web HTTPS ke port Dapodik <code className="font-mono">5774</code>, unduh lalu klik 2x file bridge di laptop yang sama dengan Dapodik:
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBridge}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh Dapodik_Bridge_Lokal.bat
                </button>
                <span className="text-[11px] text-[#566A6E]">
                  (Berjalan otomatis memakai PowerShell bawaan Windows 10/11, tanpa perlu instal Node.js/Python)
                </span>
              </div>
              <p className="text-[11px] text-[#566A6E] mt-1">
                Biarkan jendela terminal hitam bridge tetap terbuka di port <code className="font-mono">5775</code> selama proses tarik data berlangsung.
              </p>
            </li>

            <li>
              <div className="font-bold">Tarik &amp; Simpan Data Guru, Tendik, dan Siswa</div>
              <p className="text-[#566A6E] mt-0.5">
                Kembali ke tab <b>Tarik Data Live</b> di atas → masukkan <b>NPSN</b> &amp; <b>Token</b> → klik <b>Tes Koneksi</b> → klik <b>Tarik Semua (GTK + Siswa)</b> → periksa pratinjau → klik <b>Simpan ke Aplikasi &amp; Cloud</b>. Data otomatis masuk ke modul Guru &amp; Tendik, Data Siswa, Rombel, dan tersinkron ke Supabase Cloud.
              </p>
            </li>

            <li>
              <div className="font-bold">Endpoint Resmi Web Service Dapodik (Referensi Manual)</div>
              <div className="mt-1 space-y-1.5">
                {[
                  { label: 'Sekolah', path: `/WebService/getSekolah?npsn=${wsCfg.npsn || config.npsn || 'NPSN'}` },
                  { label: 'Guru & Tendik', path: `/WebService/getGtk?npsn=${wsCfg.npsn || config.npsn || 'NPSN'}` },
                  { label: 'Peserta Didik', path: `/WebService/getPesertaDidik?npsn=${wsCfg.npsn || config.npsn || 'NPSN'}` },
                  { label: 'Rombel', path: `/WebService/getRombonganBelajar?npsn=${wsCfg.npsn || config.npsn || 'NPSN'}` },
                ].map((ep) => {
                  const full = `http://localhost:5774${ep.path}`;
                  return (
                    <div key={ep.label} className="flex items-center justify-between gap-2 bg-[#F8FAF9] border border-[#E4EBE8] px-2.5 py-1.5 rounded-lg">
                      <div className="truncate">
                        <span className="font-semibold text-[#0B6B58] mr-2">{ep.label}:</span>
                        <code className="font-mono text-[11px]">{full}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(full, ep.label)}
                        className="px-2 py-0.5 bg-white border border-[#D3DDD9] rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedUrl === ep.label ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedUrl === ep.label ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#566A6E] mt-1">
                Header autentikasi: <code className="font-mono bg-gray-100 px-1 rounded">Authorization: Bearer &lt;TOKEN_ANDA&gt;</code>. Jika tidak memakai Bridge, Anda bisa mengambil JSON lewat Postman/Insomnia/curl lalu menempelkannya di tab <b>Tempel / Unggah JSON</b>.
              </p>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};

interface DapodikWebServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
  defaultFocus?: 'gtk' | 'siswa' | 'all';
  onImported?: () => void;
}

export const DapodikWebServiceModal: React.FC<DapodikWebServiceModalProps> = ({
  isOpen,
  onClose,
  config,
  onToast,
  defaultFocus = 'all',
  onImported,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-4xl w-full p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4EBE8]">
          <span className="text-sm font-bold text-[#13262A] font-display">
            Sinkronisasi Web Service Lokal Dapodik
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DapodikWebServicePanel
          config={config}
          onToast={onToast}
          defaultFocus={defaultFocus}
          onImported={() => {
            onImported?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
};
