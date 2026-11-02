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
  DEFAULT_SUPABASE_CONFIG,
  UNIFIED_TABLE_NAME,
} from '../lib/supabase';
import { getAllExportableData } from '../lib/storage';
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
} from 'lucide-react';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string, isError?: boolean) => void;
  role?: 'operator' | 'guru';
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  onToast,
  role = 'operator',
}) => {
  const [config, setConfig] = useState(getSupabaseConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sync' | 'sql' | 'credentials'>('status');

  useEffect(() => {
    if (isOpen && role === 'operator') {
      setConfig(getSupabaseConfig());
      runQuickTest();
    }
  }, [isOpen, role]);

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
          localStorage.setItem(key, JSON.stringify(val));
          count++;
        });
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
    const updated = saveSupabaseConfig({
      projectName: String(formData.get('projectName') || '').trim(),
      projectId: String(formData.get('projectId') || '').trim(),
      projectUrl: String(formData.get('projectUrl') || '').trim(),
      apiKey: String(formData.get('apiKey') || '').trim(),
      autoSync: formData.get('autoSync') === 'on',
    });
    setConfig(updated);
    onToast('Konfigurasi Supabase berhasil disimpan.');
    runQuickTest();
  };

  if (!isOpen || role !== 'operator') return null;

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
                  Koneksi & Sinkronisasi Supabase
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
              testResult?.connected
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
                      {testResult?.connected
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
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0B6B58]" />
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
                  Salin skrip ini dan tempel di <a href="https://supabase.com/dashboard/project/qpjgokdxoevjjcrrazqh/sql" target="_blank" rel="noreferrer" className="text-[#0B6B58] underline font-semibold">SQL Editor Supabase</a>.
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
              * Aplikasi otomatis mendukung sinkronisasi universal lewat tabel <code>{UNIFIED_TABLE_NAME}</code> yang bebas konflik dan langsung bekerja dengan RLS publik.
            </p>
          </div>
        )}

        {/* TAB 4: CREDENTIALS */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
            <p className="text-[#566A6E] leading-relaxed">
              Kredensial bawaan telah dikonfigurasi sesuai proyek Supabase Anda. Anda dapat mengubahnya jika membuat proyek Supabase baru.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Proyek</label>
                <input
                  type="text"
                  name="projectName"
                  defaultValue={config.projectName}
                  required
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Project ID</label>
                <input
                  type="text"
                  name="projectId"
                  defaultValue={config.projectId}
                  required
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
                className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono"
              />
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
                onClick={() => {
                  saveSupabaseConfig(DEFAULT_SUPABASE_CONFIG);
                  setConfig(DEFAULT_SUPABASE_CONFIG);
                  onToast('Kredensial dikembalikan ke proyek Meja Operator default.');
                  runQuickTest();
                }}
                className="text-gray-500 hover:text-gray-800 text-[11px] underline cursor-pointer"
              >
                Kembalikan Default (qpjgokdxoevjjcrrazqh)
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
