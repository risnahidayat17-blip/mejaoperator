/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  pushAllToSupabase,
  pullAllFromSupabase,
  generateSupabaseSQLScript,
  resetSupabaseConfig,
  getStoreTable,
  getSqlEditorUrl,
} from '../lib/supabase';
import {
  getImageKitConfig,
  saveImageKitConfig,
  resetImageKitConfig,
  testImageKitConnection,
  isImageKitReady,
} from '../lib/imagekit';
import { buildSetupLink } from '../lib/setupLink';
import {
  mergeRemoteUsers,
  syncLocalOperatorsFromConfig,
  KEYS,
  getSchoolConfig,
} from '../lib/storage';
import { User } from '../types';
import { getAllExportableData, resetCloudSyncState, migrateFilesToImageKit } from '../lib/storage';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Copy,
  Check,
  ExternalLink,
  X,
  Database,
  Lock,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [config, setConfig] = useState(getSupabaseConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    latencyMs: number;
    message: string;
    tableReady?: boolean;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sync' | 'sql' | 'credentials' | 'imagekit'>('status');
  const [ikConfig, setIkConfig] = useState(getImageKitConfig());
  const [ikTesting, setIkTesting] = useState(false);
  const [ikResult, setIkResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfig(getSupabaseConfig());
      setIkConfig(getImageKitConfig());
      runQuickTest();
    }
  }, [isOpen]);

  const runQuickTest = async () => {
    setIsTesting(true);
    const res = await testSupabaseConnection();
    setTestResult(res);
    setIsTesting(false);
  };

  const handlePushToCloud = async () => {
    setIsSyncing(true);
    try {
      const data = getAllExportableData();
      const res = await pushAllToSupabase(data);
      if (res.success) {
        onToast(res.message);
        setConfig(getSupabaseConfig());
      } else {
        onToast(res.message, true);
      }
    } catch (err: any) {
      onToast(err.message || 'Gagal sinkronisasi ke Supabase', true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!window.confirm('Tarik data dari Supabase Cloud dan timpa data lokal?')) return;
    setIsSyncing(true);
    try {
      const res = await pullAllFromSupabase();
      if (res.success && res.data) {
        let count = 0;
        Object.entries(res.data).forEach(([key, val]) => {
          if (key === KEYS.USERS && Array.isArray(val)) {
            mergeRemoteUsers(val as User[]);
          } else {
            localStorage.setItem(key, JSON.stringify(val));
          }
          count++;
        });
        const freshCfg = getSchoolConfig();
        if (freshCfg.namaOperator) {
          syncLocalOperatorsFromConfig(freshCfg);
        }
        window.dispatchEvent(new Event('storage'));
        onToast(`Berhasil menarik ${count} modul data dari Supabase.`);
        setConfig(getSupabaseConfig());
      } else {
        onToast(res.message, true);
      }
    } catch (err: any) {
      onToast(err.message || 'Gagal mengunduh dari Supabase', true);
    } finally {
      setIsSyncing(false);
    }
  };

  const copySqlScript = () => {
    const script = generateSupabaseSQLScript();
    navigator.clipboard.writeText(script);
    setCopiedSql(true);
    onToast('Skrip SQL Supabase berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const before = getSupabaseConfig();
    const updated = saveSupabaseConfig({
      projectName: String(formData.get('projectName') || '').trim() || before.projectName,
      projectUrl: String(formData.get('projectUrl') || '').trim(),
      apiKey: String(formData.get('apiKey') || '').trim(),
      tablePrefix: String(formData.get('tablePrefix') ?? '').trim(),
      autoSync: formData.get('autoSync') === 'on',
    });
    setConfig(updated);
    const moved =
      before.projectUrl !== updated.projectUrl || before.apiKey !== updated.apiKey || before.tablePrefix !== updated.tablePrefix;
    if (moved) {
      resetCloudSyncState();
      onToast('Akun Supabase diganti. Jalankan skrip SQL di proyek baru, lalu buka tab Sinkronisasi Cloud > Unggah ke Cloud Sekarang.');
      setActiveTab('sql');
    } else {
      onToast('Konfigurasi Supabase berhasil disimpan.');
    }
    runQuickTest();
  };

  const handleResetConfig = () => {
    const updated = resetSupabaseConfig();
    resetCloudSyncState();
    setConfig(updated);
    onToast('Kredensial dikembalikan ke nilai bawaan (.env / cloud.config.ts).');
    runQuickTest();
  };

  const handleSaveImageKit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const updated = saveImageKitConfig({
      publicKey: String(f.get('ikPublicKey') || '').trim(),
      urlEndpoint: String(f.get('ikUrlEndpoint') || '').trim(),
      authEndpoint: String(f.get('ikAuthEndpoint') || '').trim(),
      folder: String(f.get('ikFolder') || '').trim(),
    });
    setIkConfig(updated);
    onToast('Pengaturan ImageKit disimpan.');
    runIkTest();
  };

  const runIkTest = async () => {
    setIkTesting(true);
    const r = await testImageKitConnection();
    setIkResult({ ok: r.ok, message: r.message });
    setIkTesting(false);
  };

  const handleResetImageKit = () => {
    setIkConfig(resetImageKitConfig());
    setIkResult(null);
    onToast('Pengaturan ImageKit dikembalikan ke nilai bawaan.');
  };

  const handleMigrate = async () => {
    if (!window.confirm('Pindahkan berkas, foto surat masuk, dan logo lama ke ImageKit? Proses ini aman diulang.')) return;
    setMigrating(true);
    setMigrateMsg('Memulai...');
    try {
      const r = await migrateFilesToImageKit(setMigrateMsg);
      const msg = `Migrasi selesai: ${r.moved} dipindahkan, ${r.failed} gagal, ${r.skipped} tidak ditemukan di perangkat/cloud lama.`;
      setMigrateMsg(msg);
      onToast(msg, r.failed > 0);
    } catch (err: any) {
      setMigrateMsg(err.message || 'Migrasi gagal.');
      onToast(err.message || 'Migrasi gagal.', true);
    } finally {
      setMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] max-w-2xl w-full p-6 space-y-4 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D3DDD9]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#DAEEE7] text-[#0B6B58] flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#13262A] font-display">
                  Koneksi Supabase &amp; ImageKit
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live Cloud
                </span>
              </div>
              <p className="text-xs text-[#566A6E]">
                Proyek: <span className="font-semibold text-[#13262A]">{config.projectName || 'Meja Operator'}</span> ({config.projectId})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-[#E8EFEC] p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'status' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Status Koneksi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'sync' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Sinkronisasi Cloud
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'sql' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Skrip SQL Supabase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('imagekit')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'imagekit' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            ImageKit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition cursor-pointer ${
              activeTab === 'credentials' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
            }`}
          >
            Kredensial
          </button>
        </div>

        {/* TAB 1: STATUS */}
        {activeTab === 'status' && (
          <div className="space-y-4 text-xs">
            {/* Live Connection Card */}
            <div className={`p-4 rounded-xl border transition ${
              testResult?.connected && testResult.tableReady === false
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : testResult?.connected
                ? 'bg-[#DDF1E3]/60 border-emerald-300 text-emerald-950'
                : testResult === null
                ? 'bg-[#F1F4F2] border-[#D3DDD9]'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {testResult?.connected ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : testResult === null ? (
                    <Cloud className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {testResult?.connected && testResult.tableReady === false
                        ? 'Terhubung, tabel belum dibuat'
                        : testResult?.connected
                        ? 'Terhubung ke Database Supabase'
                        : testResult === null
                        ? 'Memeriksa koneksi Supabase...'
                        : 'Koneksi ke Supabase Bermasalah'}
                    </h4>
                    <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                      {testResult ? testResult.message : 'Mengirim ping REST ke server Supabase...'}
                    </p>
                    {testResult?.latencyMs ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold bg-white/80 px-2 py-0.5 rounded border border-black/10">
                        <Zap className="w-3 h-3 text-emerald-600" />
                        Latensi REST: {testResult.latencyMs} ms
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={runQuickTest}
                  disabled={isTesting}
                  className="px-2.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  Tes Ulang
                </button>
              </div>
            </div>

            {/* Connection Information Summary */}
            <div className="bg-[#F8FAF9] p-4 rounded-xl border border-[#D3DDD9] space-y-2">
              <span className="font-bold text-[#13262A] block uppercase text-[10px] tracking-wider">
                Parameter Proyek Supabase:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#566A6E] block">Nama Proyek:</span>
                  <span className="font-semibold text-[#13262A]">{config.projectName}</span>
                </div>
                <div>
                  <span className="text-[#566A6E] block">Project ID:</span>
                  <code className="font-mono font-bold text-[#0B6B58]">{config.projectId}</code>
                </div>
                <div>
                  <span className="text-[#566A6E] block">Tabel data (teks):</span>
                  <code className="font-mono font-bold text-[#0B6B58]">{getStoreTable()}</code>
                </div>
                <div>
                  <span className="text-[#566A6E] block">Foto &amp; berkas:</span>
                  <span className={`font-semibold ${isImageKitReady(ikConfig) ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {isImageKitReady(ikConfig) ? 'ImageKit aktif' : 'ImageKit belum diatur'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[#566A6E] block">Project REST URL:</span>
                  <code className="font-mono text-[11px] text-[#13262A] break-all">{config.projectUrl}</code>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[#566A6E] block">API Key (Anon/Publishable):</span>
                  <code className="font-mono text-[10px] text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 block truncate">
                    {config.apiKey}
                  </code>
                </div>
              </div>
            </div>

            {/* Tautan pengaturan untuk perangkat lain */}
            <div className="p-3 bg-white border border-[#D3DDD9] rounded-xl space-y-1.5">
              <span className="font-bold text-[#13262A] block">Hubungkan perangkat / guru lain</span>
              <span className="text-[11px] text-[#566A6E] block leading-relaxed">
                Pengaturan di menu ini hanya tersimpan di browser ini. Salin tautan di bawah dan kirim ke guru atau perangkat lain; cukup dibuka sekali
                dan koneksi Supabase + ImageKit langsung terisi. (Tidak berisi Private Key.)
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(buildSetupLink());
                  onToast('Tautan pengaturan disalin. Kirim ke guru / perangkat lain.');
                }}
                className="px-3 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Salin tautan pengaturan
              </button>
            </div>

            {/* Auto Sync Toggle */}
            <div className="p-3 bg-white border border-[#D3DDD9] rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-[#13262A] block">Auto-Sync Otomatis di Latar Belakang</span>
                <span className="text-[11px] text-[#566A6E]">
                  Menyimpan otomatis setiap kali Anda menambah atau mengubah siswa, guru, surat, atau keuangan.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoSync}
                  onChange={(e) => {
                    const updated = saveSupabaseConfig({ autoSync: e.target.checked });
                    setConfig(updated);
                    onToast(e.target.checked ? 'Auto-sync Supabase diaktifkan.' : 'Auto-sync dinonaktifkan.');
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0B6B58]" />
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: CLOUD SYNC */}
        {activeTab === 'sync' && (
          <div className="space-y-4 text-xs">
            <p className="text-gray-600 leading-relaxed">
              Anda dapat menyinkronkan data antara penyimpanan lokal browser dan server Supabase Cloud secara manual kapan saja.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#13262A] text-sm">
                    <UploadCloud className="w-4 h-4 text-[#0B6B58]" />
                    Unggah ke Supabase (Push)
                  </div>
                  <p className="text-[11px] text-[#566A6E] mt-1 leading-relaxed">
                    Kirim semua data siswa, GTK, aset, surat keluar/masuk, nilai, dan pengaturan ke tabel cloud di Supabase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushToCloud}
                  disabled={isSyncing}
                  className="w-full py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  {isSyncing ? 'Mengunggah...' : 'Unggah ke Cloud Sekarang'}
                </button>
              </div>

              <div className="p-4 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#13262A] text-sm">
                    <DownloadCloud className="w-4 h-4 text-blue-600" />
                    Unduh dari Supabase (Pull)
                  </div>
                  <p className="text-[11px] text-[#566A6E] mt-1 leading-relaxed">
                    Ambil data terbaru dari cloud Supabase ke perangkat/browser ini. Berguna saat berganti komputer atau operator baru.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={isSyncing}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4" />
                  {isSyncing ? 'Mengunduh...' : 'Unduh dari Cloud'}
                </button>
              </div>
            </div>

            {config.lastSyncedAt && (
              <div className="text-[11px] text-gray-500 text-center font-mono">
                Terakhir disinkronkan: {new Date(config.lastSyncedAt).toLocaleString('id-ID')}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SQL SCHEMA SCRIPT */}
        {activeTab === 'sql' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#13262A] block">Skrip DDL SQL Supabase</span>
                <span className="text-[11px] text-[#566A6E]">
                  Salin skrip ini dan tempel di <a href={getSqlEditorUrl()} target="_blank" rel="noreferrer" className="text-[#0B6B58] underline font-semibold">Supabase SQL Editor</a> untuk membuat tabel dan security rules.
                </span>
              </div>
              <button
                type="button"
                onClick={copySqlScript}
                className="px-3 py-1.5 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition shrink-0"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Tersalin!' : 'Salin Script SQL'}
              </button>
            </div>

            <div className="relative">
              <pre className="p-3 bg-gray-900 text-emerald-400 font-mono text-[10.5px] rounded-xl overflow-x-auto max-h-64 leading-relaxed border border-gray-800">
                {generateSupabaseSQLScript()}
              </pre>
            </div>
            <p className="text-[11px] text-[#566A6E] italic">
              * Supabase hanya menyimpan teks lewat tabel <code>{getStoreTable()}</code>. Skrip menyesuaikan otomatis dengan awalan tabel di tab Kredensial, dan aman dijalankan berulang. Berkas juga tersedia di <code>supabase/setup.sql</code>.
            </p>
          </div>
        )}

        {/* TAB: IMAGEKIT */}
        {activeTab === 'imagekit' && (
          <div className="space-y-3.5 text-xs">
            <p className="text-[#566A6E] leading-relaxed">
              Foto dan berkas dokumen (PDF, gambar, Word) disimpan di <b>ImageKit</b>; Supabase hanya menyimpan teks dan alamat URL berkas.
              Unggah butuh <b>Auth Endpoint</b> (menyimpan Private Key di server, bukan di aplikasi). Panduan dan skrip gratis ada di{' '}
              <code>imagekit/apps-script-auth.gs</code> dan <code>docs/PINDAH-AKUN.md</code>.
            </p>

            {ikResult && (
              <div className={`p-3 rounded-lg border font-medium ${ikResult.ok ? 'bg-[#DDF1E3] border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-800'}`}>
                {ikResult.message}
              </div>
            )}

            <form onSubmit={handleSaveImageKit} className="space-y-3">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Public Key</label>
                <input type="text" name="ikPublicKey" defaultValue={ikConfig.publicKey} placeholder="public_xxxxxxxx=" className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono" />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Auth Endpoint (URL Web App)</label>
                <input type="url" name="ikAuthEndpoint" defaultValue={ikConfig.authEndpoint} placeholder="https://script.google.com/macros/s/.../exec" className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">URL Endpoint (opsional)</label>
                  <input type="url" name="ikUrlEndpoint" defaultValue={ikConfig.urlEndpoint} placeholder="https://ik.imagekit.io/idAnda" className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Folder induk</label>
                  <input type="text" name="ikFolder" defaultValue={ikConfig.folder} placeholder="/meja-operator" className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono" />
                </div>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-[#D3DDD9]">
                <button type="button" onClick={handleResetImageKit} className="text-gray-500 hover:text-gray-800 text-[11px] underline cursor-pointer">
                  Kembalikan ke nilai bawaan (.env)
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={runIkTest} disabled={ikTesting} className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${ikTesting ? 'animate-spin' : ''}`} /> Tes
                  </button>
                  <button type="submit" className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg shadow-sm cursor-pointer">
                    Simpan
                  </button>
                </div>
              </div>
            </form>

            <div className="p-3.5 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#13262A] text-sm">
                <ImageIcon className="w-4 h-4 text-[#0B6B58]" /> Migrasi berkas lama ke ImageKit
              </div>
              <p className="text-[11px] text-[#566A6E] leading-relaxed">
                Memindahkan berkas dokumen GTK, arsip absen, foto surat masuk, dan logo yang masih tersimpan di Supabase lama atau di perangkat ini.
                Setelah selesai, Supabase hanya berisi teks. Jalankan dari perangkat yang paling lengkap datanya.
              </p>
              <button
                type="button"
                onClick={handleMigrate}
                disabled={migrating || !isImageKitReady(ikConfig)}
                className="px-3.5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" /> {migrating ? 'Memindahkan...' : 'Migrasi ke ImageKit'}
              </button>
              {migrateMsg && <div className="text-[11px] font-mono text-[#13262A]">{migrateMsg}</div>}
            </div>
          </div>
        )}

        {/* TAB 4: CREDENTIALS */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
            <p className="text-[#566A6E] leading-relaxed">
              Untuk pindah akun Supabase cukup isi <b>Project URL</b> dan <b>Publishable key</b> proyek baru. Project ID dan nama tabel
              mengikuti otomatis. Pengaturan ini tersimpan di browser perangkat ini; agar berlaku di semua perangkat, isi{' '}
              <code>.env</code> lalu deploy ulang.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Proyek (label)</label>
                <input
                  type="text"
                  name="projectName"
                  defaultValue={config.projectName}
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Awalan tabel</label>
                <input
                  type="text"
                  name="tablePrefix"
                  defaultValue={config.tablePrefix}
                  placeholder="mo_"
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#566A6E] mb-1">Project URL</label>
              <input
                type="url"
                name="projectUrl"
                defaultValue={config.projectUrl}
                required
                placeholder="https://xxxx.supabase.co"
                className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
              />
              <span className="text-[10px] text-[#566A6E]">Project ID terdeteksi: <code>{config.projectId}</code></span>
            </div>

            <div>
              <label className="block font-semibold text-[#566A6E] mb-1">Public API Key (Anon / Publishable)</label>
              <input
                type="text"
                name="apiKey"
                defaultValue={config.apiKey}
                required
                className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoSyncBox"
                name="autoSync"
                defaultChecked={config.autoSync}
                className="w-4 h-4 accent-[#0B6B58]"
              />
              <label htmlFor="autoSyncBox" className="font-semibold text-[#13262A] cursor-pointer">
                Aktifkan Auto-Sync Otomatis saat Ada Perubahan Data
              </label>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#D3DDD9]">
              <button
                type="button"
                onClick={handleResetConfig}
                className="text-gray-500 hover:text-gray-800 text-[11px] underline cursor-pointer"
              >
                Kembalikan ke nilai bawaan (.env)
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg shadow-sm cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
