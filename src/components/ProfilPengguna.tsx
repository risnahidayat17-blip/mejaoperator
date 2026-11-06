/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import {
  getFromStorage,
  setToStorage,
  setCurrentUser,
  KEYS,
  toPublicUser,
  syncAllOperatorAccounts,
  getSchoolConfig,
} from '../lib/storage';
import { initialUsers } from '../data/initialData';
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from '../lib/auth';
import {
  UserCheck,
  ShieldCheck,
  Lock,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ProfilPenggunaProps {
  currentUser: User;
  onToast: (msg: string, isError?: boolean) => void;
}

export const ProfilPengguna: React.FC<ProfilPenggunaProps> = ({ currentUser, onToast }) => {
  const isOperator = currentUser.role === 'operator';
  const schoolConfig = getSchoolConfig();
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile');

  // Profile Form State
  const [name, setName] = useState(
    isOperator ? (schoolConfig.namaOperator || currentUser.name) : currentUser.name
  );
  const [email, setEmail] = useState(
    currentUser.email || (isOperator ? schoolConfig.emailOperator || '' : '')
  );
  const [email2, setEmail2] = useState(
    currentUser.email2 || (isOperator ? schoolConfig.emailOperator2 || '' : '')
  );
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [nip, setNip] = useState(
    currentUser.nip || (isOperator ? schoolConfig.nipOperator || '' : '')
  );
  const [jabatan, setJabatan] = useState(currentUser.jabatan || '');
  // Ganti kata sandi (kata sandi lama tidak pernah ditampilkan)
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // All Users List (for Operator)
  const [userList, setUserList] = useState<User[]>(getFromStorage<User[]>(KEYS.USERS, initialUsers));

  // Add User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'operator' | 'guru'>('guru');
  const [newJabatan, setNewJabatan] = useState('');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onToast('Nama tidak boleh kosong.', true);
      return;
    }
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanEmail2 = email2.trim();
    const cleanNip = nip.trim();
    const cleanPhone = phone.trim();
    const cleanJabatan = jabatan.trim();

    if (isOperator) {
      // Selaraskan seluruh akun operator di database dan konfigurasi sekolah
      syncAllOperatorAccounts(cleanName, cleanEmail, cleanEmail2, cleanNip, cleanPhone);
      const allUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
      setUserList(allUsers);
      onToast('Profil operator berhasil diperbarui! Nama diselaraskan di seluruh akun (Email 1 & Email 2 sama).');
      return;
    }

    const allUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
    const stored = allUsers.find((u) => u.id === currentUser.id) || currentUser;
    // Hash kata sandi di data tersimpan dipertahankan; hanya data profil yang berubah.
    const updatedUser: User = {
      ...stored,
      name: cleanName,
      email: cleanEmail,
      email2: cleanEmail2,
      phone: cleanPhone,
      nip: cleanNip,
      jabatan: cleanJabatan,
      updatedAt: Date.now(),
    };
    const updatedList = allUsers.some((u) => u.id === currentUser.id)
      ? allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u))
      : [...allUsers, updatedUser];
    setToStorage(KEYS.USERS, updatedList);
    setCurrentUser(toPublicUser(updatedUser));
    setUserList(updatedList);
    onToast('Profil Anda berhasil diperbarui!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changingPw) return;
    if (newPass.length < MIN_PASSWORD_LENGTH) {
      onToast(`Kata sandi baru minimal ${MIN_PASSWORD_LENGTH} karakter.`, true);
      return;
    }
    if (newPass !== confirmPass) {
      onToast('Konfirmasi kata sandi tidak sama.', true);
      return;
    }
    if (newPass === oldPass) {
      onToast('Kata sandi baru harus berbeda dari yang lama.', true);
      return;
    }
    setChangingPw(true);
    try {
      const allUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
      const stored = allUsers.find((u) => u.id === currentUser.id);
      if (!stored || !(await verifyPassword(oldPass, stored.passwordSalt, stored.passwordHash))) {
        onToast('Kata sandi lama tidak sesuai.', true);
        return;
      }
      const h = await hashPassword(newPass);
      const updatedUser: User = { ...stored, ...h, mustChangePassword: false };
      const updatedList = allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u));
      setToStorage(KEYS.USERS, updatedList);
      setCurrentUser(toPublicUser(updatedUser));
      setUserList(updatedList);
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
      onToast('Kata sandi berhasil diganti.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal mengganti kata sandi.', true);
    } finally {
      setChangingPw(false);
    }
  };

  /** Operator mengatur ulang kata sandi akun operator lain (kata sandi lama tidak perlu/ tidak ditampilkan). */
  const handleResetUserPassword = async (u: User) => {
    const pw = window.prompt(`Kata sandi baru untuk "${u.username}" (minimal ${MIN_PASSWORD_LENGTH} karakter):`);
    if (pw === null) return;
    if (pw.length < MIN_PASSWORD_LENGTH) {
      onToast(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`, true);
      return;
    }
    try {
      const h = await hashPassword(pw);
      const all = getFromStorage<User[]>(KEYS.USERS, initialUsers);
      const updatedList = all.map((x) => (x.id === u.id ? { ...x, ...h, mustChangePassword: false } : x));
      setToStorage(KEYS.USERS, updatedList);
      setUserList(updatedList);
      onToast(`Kata sandi ${u.username} berhasil diatur ulang.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal mengatur ulang kata sandi.', true);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const needsPw = newRole === 'operator';
    if (!newUsername.trim() || !newName.trim() || (needsPw && !newPassword)) {
      onToast('Mohon lengkapi username, nama' + (needsPw ? ', dan password.' : '.'), true);
      return;
    }
    if (needsPw && newPassword.length < MIN_PASSWORD_LENGTH) {
      onToast(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`, true);
      return;
    }

    const allUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
    if (allUsers.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      onToast(`Username "${newUsername}" sudah digunakan.`, true);
      return;
    }

    try {
      const h = needsPw ? await hashPassword(newPassword) : {};
      const newUser: User = {
        id: `u_${Date.now()}`,
        username: newUsername.trim(),
        ...h,
        name: newName.trim(),
        role: newRole,
        jabatan: newJabatan.trim() || (newRole === 'operator' ? 'Operator Sekolah' : 'Guru Kelas'),
      };
      const updatedList = [...allUsers, newUser];
      setToStorage(KEYS.USERS, updatedList);
      setUserList(updatedList);
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      setNewJabatan('');
      onToast(`Akun pengguna ${newUser.username} berhasil dibuat.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal membuat akun.', true);
    }
  };

  const handleDeleteUser = (id: string, username: string) => {
    if (id === currentUser.id) {
      onToast('Anda tidak dapat menghapus akun yang sedang digunakan.', true);
      return;
    }
    if (window.confirm(`Yakin ingin menghapus akun "${username}"?`)) {
      const updatedList = userList.filter((u) => u.id !== id);
      setToStorage(KEYS.USERS, updatedList);
      setUserList(updatedList);
      onToast(`Akun ${username} berhasil dihapus.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            {isOperator ? 'Profil & Manajemen Pengguna' : 'Pengaturan Profil Pengguna'}
          </h1>
          <p className="text-xs text-[#566A6E] mt-1">
            {isOperator
              ? 'Kelola profil pribadi, kata sandi, serta hak akses dan akun pengguna lain.'
              : 'Perbarui data pribadi dan nomor kontak Anda.'}
          </p>
        </div>

        {isOperator && (
          <div className="flex items-center gap-2 bg-[#E8EFEC] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'profile' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
              }`}
            >
              Profil Saya
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'users' ? 'bg-white text-[#0B6B58] shadow-xs' : 'text-[#566A6E] hover:text-[#13262A]'
              }`}
            >
              Kelola Semua Akun ({userList.length})
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: PROFILE SAYA */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-[#13262A] mb-4 pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#0B6B58]" /> Data Pribadi Pengguna
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Username</label>
                  <input
                    type="text"
                    value={currentUser.username}
                    disabled
                    className="w-full px-3 py-2 font-mono bg-[#E8EFEC] text-[#566A6E] border border-[#D3DDD9] rounded-lg cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Peran / Hak Akses</label>
                  <input
                    type="text"
                    value={isOperator ? 'Operator (Full Akses)' : 'Guru / Tendik (Akses Terbatas)'}
                    disabled
                    className="w-full px-3 py-2 bg-[#E8EFEC] font-semibold text-[#0B6B58] border border-[#D3DDD9] rounded-lg cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap (dengan Gelar) *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Contoh: Rudi Hartono, S.Pd."
                  className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg focus:ring-2 focus:ring-[#0B6B58]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jabatan / Tugas</label>
                  <input
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">NIP / NUPTK</label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">No. WhatsApp / HP</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="mis. 0812-3456-7890"
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">
                    {isOperator ? 'Email 1 Operator (Email Utama)' : 'Alamat Email'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isOperator ? 'mis. operator@sdn2cempaka.sch.id / risnahidayat09@gmail.com' : 'email@contoh.com'}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              {isOperator && (
                <div className="space-y-3 text-xs pt-1">
                  <div>
                    <label className="block font-semibold text-[#566A6E] mb-1">
                      Email 2 Operator (Email Belajar.id / Kedinasan / Alternatif)
                    </label>
                    <input
                      type="email"
                      value={email2}
                      onChange={(e) => setEmail2(e.target.value)}
                      placeholder="mis. risnahidayat17@admin.sd.belajar.id"
                      className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div className="p-3 bg-[#DAEEE7]/70 border border-[#0B6B58]/30 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#0B6B58] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-[#13262A] leading-relaxed">
                      <span className="font-bold text-[#0B6B58]">Penyelarasan Otomatis Nama Operator: </span>
                      Ketika nama operator diubah (baik di Email 1 maupun Email 2), nama operator akan selalu otomatis sama di kedua email/akun serta disinkronkan ke Supabase Cloud sehingga nama tidak berbeda-beda.
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition"
                >
                  <Save className="w-4 h-4" /> Simpan Profil
                </button>
              </div>
            </form>

            {isOperator && (
              <form onSubmit={handleChangePassword} className="bg-white border border-[#D3DDD9] rounded-xl p-5 shadow-xs space-y-3 mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#566A6E] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0B6B58]" /> Ganti Kata Sandi
                </h3>
                {currentUser.mustChangePassword && (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-[11px] rounded-lg font-medium">
                    Anda masih memakai kata sandi bawaan. Segera ganti dengan kata sandi baru yang hanya Anda ketahui.
                  </div>
                )}
                <div className="max-w-md space-y-3 text-xs">
                  {[
                    { label: 'Kata sandi lama', value: oldPass, set: setOldPass, ac: 'current-password' },
                    { label: `Kata sandi baru (min. ${MIN_PASSWORD_LENGTH} karakter)`, value: newPass, set: setNewPass, ac: 'new-password' },
                    { label: 'Ulangi kata sandi baru', value: confirmPass, set: setConfirmPass, ac: 'new-password' },
                  ].map((f) => (
                    <div key={f.label}>
                      <label className="block font-semibold text-[#566A6E] mb-1">{f.label}</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={f.value}
                          onChange={(e) => f.set(e.target.value)}
                          autoComplete={f.ac}
                          required
                          className="w-full px-3 py-2 pr-10 border border-[#D3DDD9] rounded-lg font-mono"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#566A6E] hover:text-[#13262A] flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPassword ? 'Sembunyikan' : 'Tampilkan yang saya ketik'}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={changingPw}
                    className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition"
                  >
                    <Lock className="w-4 h-4" /> {changingPw ? 'Menyimpan…' : 'Ganti Kata Sandi'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-[#E8EFEC] border border-[#D3DDD9] rounded-xl p-4 text-xs space-y-2">
              <span className="font-bold text-[#13262A] block">Info Akun Aktif:</span>
              <div className="text-[#566A6E]">
                Username:{' '}
                <code className="font-mono font-bold text-[#0B6B58]">{currentUser.username}</code>
              </div>
              {isOperator && (
                <div className="text-[#566A6E]">
                  Kata sandi: <span className="font-mono font-bold text-[#13262A]">••••••••</span>{' '}
                  <span className="text-[10px]">(tersimpan terenkripsi, tidak bisa dilihat)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KELOLA SEMUA AKUN (OPERATOR ONLY) */}
      {isOperator && activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#D3DDD9]">
              <h2 className="text-sm font-bold text-[#13262A] font-display">
                Daftar Akun Pengguna ({userList.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nama</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Username</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Password</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Peran</th>
                    <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D3DDD9]">
                  {userList.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#13262A]">{u.name}</div>
                          <div className="text-[11px] text-[#566A6E]">{u.jabatan}</div>
                        </td>
                        <td className="py-3 px-4">
                          <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono font-bold text-[#0B6B58]">
                            {u.username}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          {u.role === 'operator' ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-gray-500">••••••••</span>
                              <button
                                type="button"
                                onClick={() => handleResetUserPassword(u)}
                                className="text-[11px] text-[#0B6B58] font-semibold underline cursor-pointer"
                              >
                                Atur ulang
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#566A6E] italic">Tanpa password</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === 'operator'
                                ? 'bg-[#DAEEE7] text-[#0B6B58]'
                                : 'bg-[#DDF1E3] text-[#1D7A3A]'
                            }`}
                          >
                            {u.role === 'operator' ? 'Full Operator' : 'Guru / Tendik'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isSelf ? (
                            <span className="text-[11px] text-[#566A6E] italic">Sedang Digunakan</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Hapus Akun"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add user form */}
          <div className="bg-white border border-[#D3DDD9] rounded-xl p-6 shadow-xs max-w-2xl">
            <h2 className="text-sm font-bold text-[#13262A] mb-3 pb-2 border-b border-[#D3DDD9] font-display flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#0B6B58]" /> Tambah Akun Baru
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Username Baru *</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    required
                    placeholder="Contoh: guru2"
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">
                    Password Baru {newRole === 'operator' ? '*' : '(tidak dipakai, guru masuk tanpa password)'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required={newRole === 'operator'}
                    disabled={newRole !== 'operator'}
                    autoComplete="new-password"
                    placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                    className="w-full px-3 py-2 border rounded-lg font-mono disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="Contoh: Nur Aini, S.Pd."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Peran Pengguna</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="guru">Guru / Tendik</option>
                    <option value="operator">Operator (Full Akses)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Jabatan / Penugasan</label>
                  <input
                    type="text"
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    placeholder="Contoh: Guru Kelas 2"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Simpan Akun Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
