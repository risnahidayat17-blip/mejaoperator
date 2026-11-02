/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, SchoolConfig, Siswa, Guru, Aset, SuratMasuk, SuratKeluar, Mutasi, LetterTemplate } from '../types';

export const initialUsers: User[] = [
  {
    id: "u_operator",
    username: "operator",
    password: "",
    name: "Ahmad Fauzi, S.Kom",
    role: "operator",
    jabatan: "Operator Sekolah & Admin Dapodik",
    nip: "19890412 201902 1 003",
    email: "operator@sdn2cempaka.sch.id",
    phone: "0812-3456-7890"
  },
  {
    id: "u_guru",
    username: "guru",
    password: "guru123",
    name: "Rudi Hartono, S.Pd.",
    role: "guru",
    jabatan: "Guru Kelas 4",
    guruId: "g_rudi",
    nip: "19850315 201001 1 018",
    email: "rudi.hartono@guru.sd.belajar.id",
    phone: "0821-9876-5432"
  },
  {
    id: "u_tendik",
    username: "tendik",
    password: "tendik123",
    name: "Dewi Anggraini, A.Md.",
    role: "guru",
    jabatan: "Tenaga Administrasi Sekolah",
    guruId: "g_dewi",
    email: "dewi.tendik@sdn2cempaka.sch.id",
    phone: "0857-1122-3344"
  }
];
