/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  SchoolConfig,
  Siswa,
  Guru,
  Aset,
  SuratMasuk,
  SuratKeluar,
  DokumenGtk,
  NilaiRecord,
  BerkasPenilaian,
} from './types';
import { startFileSync } from './lib/files';
import {
  initStorageDefaults,
  subscribeToStorage,
  subscribeToCloudChanges,
  startCloudPolling,
  loadDapodikData,
  migrateLegacyFiles,
  migratePasswords,
  STORAGE_ERROR_EVENT,
  getCurrentUser,
  logout,
  getSchoolConfig,
  getSiswas,
  getGurus,
  getAsets,
  getSuratMasuk,
  getSuratKeluar,
  getDokumenGtks,
  getNilaiRecords,
  getFromStorage,
  KEYS,
  getArsipAbsen,
  getArsipLaporan,
  syncFromCloud,
} from './lib/storage';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { SiswaMutasi } from './components/SiswaMutasi';
import { GuruTendik } from './components/GuruTendik';
import { BukuInduk } from './components/BukuInduk';
import { SuratKeluar as CompSuratKeluar } from './components/SuratKeluar';
import { SuratMasuk as CompSuratMasuk } from './components/SuratMasuk';
import { Penilaian } from './components/Penilaian';
import { ArsipAbsen } from './components/ArsipAbsen';
import { ArsipLaporanSekolah } from './components/ArsipLaporanSekolah';
import { DaftarHadir } from './components/DaftarHadir';
import { AsetInventaris } from './components/AsetInventaris';
import { LaporanBulan } from './components/LaporanBulan';
import { RekapLaporan } from './components/RekapLaporan';
import { LaporanKeuangan } from './components/LaporanKeuangan';
import { ProfilPengguna } from './components/ProfilPengguna';
import { PengaturanSekolah } from './components/PengaturanSekolah';
import { PosUjian } from './components/PosUjian';
import { SupabaseSyncModal } from './components/SupabaseSyncModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [config, setConfig] = useState<SchoolConfig>(getSchoolConfig());
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [asetList, setAsetList] = useState<Aset[]>([]);
  const [suratMasukList, setSuratMasukList] = useState<SuratMasuk[]>([]);
  const [suratKeluarList, setSuratKeluarList] = useState<SuratKeluar[]>([]);
  const [dokGtkList, setDokGtkList] = useState<DokumenGtk[]>([]);
  const [nilaiList, setNilaiList] = useState<NilaiRecord[]>([]);
  const [berkasList, setBerkasList] = useState<BerkasPenilaian[]>([]);

  const [currentTab, setCurrentTab] = useState<string>('dasbor');
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  const refreshAllData = () => {
    setCurrentUser(getCurrentUser());
    setConfig(getSchoolConfig());
    setSiswaList(getSiswas());
    setGuruList(getGurus());
    setAsetList(getAsets());
    setSuratMasukList(getSuratMasuk());
    setSuratKeluarList(getSuratKeluar());
    setDokGtkList(getDokumenGtks());
    setNilaiList(getNilaiRecords());
    setBerkasList(getFromStorage(KEYS.BERKAS, []));
  };

  useEffect(() => {
    initStorageDefaults();
    migratePasswords().catch(() => {});
    refreshAllData();
    const unsub = subscribeToStorage(() => {
      refreshAllData();
    });
    // Data dari perangkat lain: perbarui data tanpa mereset/me-remount tampilan
    const unsubCloud = subscribeToCloudChanges(() => {
      refreshAllData();
    });
    startCloudPolling();
    startFileSync();
    migrateLegacyFiles().catch(() => {});

    // Cek pesan dari setup link jika baru diterapkan
    try {
      const msg = localStorage.getItem('mo_setup_applied_toast');
      if (msg) {
        showToast(msg);
        localStorage.removeItem('mo_setup_applied_toast');
      }
    } catch {}

    // Segera tarik perubahan terbaru dari Supabase Cloud saat aplikasi dibuka
    syncFromCloud()
      .then((count) => {
        if (count > 0) refreshAllData();
      })
      .catch(() => {});

    const onStorageError = (ev: Event) => {
      const msg = (ev as CustomEvent<string>).detail || 'Data gagal disimpan.';
      showToast(msg, true);
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => {
      unsub();
      unsubCloud();
      window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
    };
  }, []);

  const handleLoggedIn = (role: 'operator' | 'guru') => {
    setCurrentTab('dasbor');
    showToast(
      role === 'operator'
        ? 'Berhasil masuk sebagai Operator (Akses Penuh).'
        : 'Berhasil masuk sebagai Guru / Tendik (Mode Lihat Saja).'
    );
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setCurrentTab('dasbor');
  };

  const role = currentUser?.role || 'guru';
  const isOperator = role === 'operator';

  const counts = {
    siswa: siswaList.filter((s) => s.status === 'Aktif').length,
    guru: guruList.filter((g) => g.status !== 'Nonaktif').length,
    aset: asetList.length,
    suratmasuk: suratMasukList.length,
    suratkeluar: suratKeluarList.length,
    berkas: berkasList.length,
    arsipabsen: getArsipAbsen().length,
    arsiplaporan: getArsipLaporan().length,
  };

  // Login view if not authenticated
  if (!currentUser) {
    return (
      <>
        <LoginScreen config={config} onLoggedIn={handleLoggedIn} />
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${
              toast.isError ? 'bg-[#B3261E] text-white' : 'bg-[#13262A] text-white'
            }`}
          >
            {toast.message}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen app-workspace-bg flex flex-col font-sans text-[#13262A] antialiased">
      {/* Navbar Header */}
      <Header
        currentUser={currentUser}
        config={config}
        onLogout={handleLogout}
        onOpenSettingsKop={isOperator ? () => setCurrentTab('pengaturan') : undefined}
        onOpenSupabaseModal={isOperator ? () => setIsSupabaseModalOpen(true) : undefined}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          role={role}
          counts={counts}
          onOpenSupabaseModal={isOperator ? () => setIsSupabaseModalOpen(true) : () => {}}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dasbor' && (
              <Dashboard
                role={role}
                config={config}
                siswa={siswaList}
                guru={guruList}
                aset={asetList}
                suratmasuk={suratMasukList}
                suratkeluar={suratKeluarList}
                onNavigate={(tab) => setCurrentTab(tab)}
                onOpenSupabaseModal={isOperator ? () => setIsSupabaseModalOpen(true) : undefined}
              />
            )}
            {currentTab === 'siswa' && (
              <SiswaMutasi
                role={role}
                config={config}
                onToast={showToast}
                onNavigateToSurat={isOperator ? () => setCurrentTab('suratkeluar') : undefined}
              />
            )}
            {currentTab === 'guru' && (
              <GuruTendik role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'bukuinduk' && (
              <BukuInduk config={config} role={role} onToast={showToast} />
            )}
            {currentTab === 'suratkeluar' && (
              <CompSuratKeluar role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'suratmasuk' && (
              <CompSuratMasuk role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'penilaian' && (
              <Penilaian role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'posujian' && (
              <PosUjian
                config={config}
                role={role}
                onToast={showToast}
                guruList={guruList}
                siswaList={siswaList}
              />
            )}
            {currentTab === 'daftarhadir' && (
              <DaftarHadir role={role} config={config} siswa={siswaList} guru={guruList} onToast={showToast} />
            )}
            {currentTab === 'arsipabsen' && (
              <ArsipAbsen role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'aset' && (
              <AsetInventaris role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'laporanbulan' && (
              <LaporanBulan
                role={role}
                config={config}
                siswa={siswaList}
                guru={guruList}
                onToast={showToast}
              />
            )}
            {currentTab === 'laporan' && (
              <RekapLaporan
                role={role}
                config={config}
                siswa={siswaList}
                guru={guruList}
                aset={asetList}
                onToast={showToast}
              />
            )}
            {currentTab === 'arsiplaporan' && (
              <ArsipLaporanSekolah role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'keuangan' && (
              <LaporanKeuangan role={role} config={config} onToast={showToast} />
            )}
            {currentTab === 'profil' && (
              <ProfilPengguna currentUser={currentUser} onToast={showToast} />
            )}
            {currentTab === 'pengaturan' && (
              <PengaturanSekolah
                role={role}
                config={config}
                onToast={showToast}
                initialTab="kop"
                onOpenSupabaseModal={isOperator ? () => setIsSupabaseModalOpen(true) : undefined}
              />
            )}
          </div>
        </main>
      </div>

      {/* Supabase Cloud Connection & Sync Modal */}
      {isOperator && (
        <SupabaseSyncModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          onToast={showToast}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
            toast.isError
              ? 'bg-[#B3261E] text-white border-rose-700'
              : 'bg-[#13262A] text-white border-[#2B4144]'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
