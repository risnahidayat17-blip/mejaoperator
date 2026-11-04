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
} from '../lib/storage';
import { initialUsers } from '../data/initialData';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile');

  // Profile Form State
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [nip, setNip] = useState(currentUser.nip || '');
  const [jabatan, setJabatan] = useState(currentUser.jabatan || '');
  const [password, setPassword] = useState(currentUser.password || '');
  const [showPassword, setShowPassword] = useState(false);

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
    if (!password.trim()) {
      onToast('Password tidak boleh kosong.', true);
      return;
    }

    const allUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
    const updatedUser: User = {
      ...currentUser,
      name,
      email,
      phone,
      nip,
      jabatan,
      password,
    };

    const updatedList = allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u));
    setToStorage(KEYS.USERS, updatedList);
    setCurrentUser(updatedUser);
    setUserList(updatedList);
    onToast('Profil dan kata sandi Anda berhasil diperbarui!');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newName.trim()) {
      onToast('Mohon lengkapi username, password, dan nama.', true);
      return;
    }

    const allUsers = getFromStorage<User[]>(KEYS.USERS, initialUsers);
    if (allUsers.some((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      onToast(`Username "${newUsername}" sudah digunakan.`, true);
      return;
    }

    const newUser: User = {
      id: `u_${Date.now()}`,
      username: newUsername.trim(),
      password: newPassword.trim(),
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
              : 'Perbarui data pribadi Anda, nomor kontak, serta ubah kata sandi akun.'}
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
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#566A6E] mb-1">Alamat Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#D3DDD9]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#566A6E] mb-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0B6B58]" /> Keamanan & Kata Sandi
                </h3>
                <div className="max-w-md text-xs">
                  <label className="block font-semibold text-[#566A6E] mb-1">Kata Sandi Baru</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 pr-10 border border-[#D3DDD9] rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[#566A6E] hover:text-[#13262A] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition"
                >
                  <Save className="w-4 h-4" /> Simpan Profil
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <div className="bg-[#E8EFEC] border border-[#D3DDD9] rounded-xl p-4 text-xs space-y-2">
              <span className="font-bold text-[#13262A] block">Info Akun Aktif:</span>
              <div className="text-[#566A6E]">
                Username:{' '}
                <code className="font-mono font-bold text-[#0B6B58]">{currentUser.username}</code>
              </div>
              <div className="text-[#566A6E]">
                Password:{' '}
                <code className="font-mono font-bold text-[#13262A]">{currentUser.password}</code>
              </div>
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
                          <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono font-bold text-gray-800">
                            {u.password}
                          </code>
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
                  <label className="block font-semibold text-[#566A6E] mb-1">Password Baru *</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Contoh: guru123"
                    className="w-full px-3 py-2 border rounded-lg font-mono"
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
