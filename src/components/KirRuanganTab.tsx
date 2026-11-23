/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Aset, Guru, KirRuang, Rombel, SchoolConfig } from '../types';
import {
  deleteAset,
  deleteKirRuang,
  getGurus,
  getKirRuangs,
  getRombels,
  saveAset,
  saveAsets,
  saveKirRuang,
  saveKirRuangs,
  subscribeToCloudChanges,
  subscribeToStorage,
} from '../lib/storage';
import { printDomElement } from '../lib/print';
import { KopSuratHD } from './KopSuratHD';
import {
  Building2,
  Plus,
  Printer,
  Pencil,
  Trash2,
  PackagePlus,
  Search,
  X,
  ArrowRightLeft,
  CopyPlus,
  Check,
  Minus,
} from 'lucide-react';

interface KirRuanganTabProps {
  isOperator: boolean;
  config: SchoolConfig;
  asets: Aset[];
  kibCategories: string[];
  onReloadAsets: () => void;
  onEditAsetModal: (aset: Aset) => void;
  onToast: (msg: string, isError?: boolean) => void;
}

const STANDARD_ROOM_SUGGESTIONS = [
  'Ruang Kepala Sekolah',
  'Ruang Guru',
  'Ruang Perpustakaan',
  'Ruang UKS',
  'Ruang Laboratorium Komputer',
  'Mushola',
  'Gudang',
  'Kantin / Koperasi',
];

function KirSheetPrintable({
  config,
  roomName,
  kodeRuang,
  penanggungJawab,
  nipPenanggungJawab,
  items,
  showActions,
  confirmDeleteAsetId,
  onAdjustQty,
  onEditItem,
  onDeleteItem,
  onQuickAddTrigger,
}: {
  config: SchoolConfig;
  roomName: string;
  kodeRuang?: string;
  penanggungJawab?: string;
  nipPenanggungJawab?: string;
  items: Aset[];
  showActions?: boolean;
  confirmDeleteAsetId?: string | null;
  onAdjustQty?: (item: Aset, delta: number) => void;
  onEditItem?: (item: Aset) => void;
  onDeleteItem?: (item: Aset) => void;
  onQuickAddTrigger?: () => void;
}) {
  const totalUnit = items.reduce((sum, item) => sum + Math.max(0, Number(item.jumlah) || 0), 0);
  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white text-black select-text">
      <KopSuratHD config={config} logoHeight={62} className="!mb-3 !pb-2" />

      <div className="text-center mb-4">
        <h2 className="text-base font-bold font-serif uppercase tracking-wider underline">
          KARTU INVENTARIS RUANGAN (KIR)
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3 font-serif">
        <div>
          <span className="inline-block w-36 font-semibold">Nama Sekolah / Unit</span>: {config.namaSekolah}
        </div>
        <div>
          <span className="inline-block w-36 font-semibold">Nama Ruangan</span>:{' '}
          <span className="font-bold uppercase">{roomName}</span>
        </div>
        <div>
          <span className="inline-block w-36 font-semibold">NPSN / Kab. Kota</span>: {config.npsn || '-'} /{' '}
          {config.kabupaten || '-'}
        </div>
        <div>
          <span className="inline-block w-36 font-semibold">Kode Ruang</span>: {kodeRuang || '-'}
        </div>
      </div>

      <table className="w-full text-left text-xs border-collapse border border-black mb-5">
        <thead>
          <tr className="bg-gray-100 text-center font-bold">
            <th className="border border-black p-2 w-10">No</th>
            <th className="border border-black p-2">Nama Barang / Jenis</th>
            <th className="border border-black p-2">Merk / Model</th>
            <th className="border border-black p-2">Kode Barang</th>
            <th className="border border-black p-2 w-14">Tahun</th>
            <th className="border border-black p-2 w-20">Jumlah</th>
            <th className="border border-black p-2 w-24">Kondisi</th>
            <th className="border border-black p-2">Keterangan</th>
            {showActions && (
              <th className="no-print border border-black p-2 w-28 text-center">Aksi</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
              <td className="border border-black p-2">
                <div className="font-bold">{item.nama}</div>
                {item.noRegister && (
                  <div className="text-[10px] text-gray-600 font-mono">Reg: {item.noRegister}</div>
                )}
              </td>
              <td className="border border-black p-2">{item.merk || '-'}</td>
              <td className="border border-black p-2 font-mono">{item.kode || '-'}</td>
              <td className="border border-black p-2 text-center">{item.tahunPerolehan || '-'}</td>
              <td className="border border-black p-2 text-center font-bold font-mono">
                <div className="inline-flex items-center justify-center gap-1">
                  {showActions && onAdjustQty && (
                    <button
                      type="button"
                      onClick={() => onAdjustQty(item, -1)}
                      disabled={(item.jumlah || 1) <= 1}
                      title="Kurangi 1 unit"
                      className="no-print w-5 h-5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-200 disabled:opacity-30 inline-flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  <span className="min-w-[18px] text-center">{item.jumlah}</span>
                  {showActions && onAdjustQty && (
                    <button
                      type="button"
                      onClick={() => onAdjustQty(item, 1)}
                      title="Tambah 1 unit"
                      className="no-print w-5 h-5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-200 inline-flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </td>
              <td className="border border-black p-2 text-center font-semibold">{item.kondisi}</td>
              <td className="border border-black p-2">{item.keterangan || '-'}</td>
              {showActions && (
                <td className="no-print border border-black p-1.5 text-center">
                  <div className="inline-flex items-center gap-1">
                    {onEditItem && (
                      <button
                        type="button"
                        onClick={() => onEditItem(item)}
                        className="p-1.5 rounded border border-[#D3DDD9] text-[#0B6B58] hover:bg-[#E8EFEC] cursor-pointer"
                        title="Ubah barang ini"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item)}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                          confirmDeleteAsetId === item.id
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : 'border-[#D3DDD9] text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Hapus barang dari ruangan ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteAsetId === item.id ? 'Yakin?' : ''}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={showActions ? 9 : 8} className="border border-black p-6 text-center text-gray-500">
                <div>Belum ada barang tercatat di {roomName}.</div>
                {showActions && onQuickAddTrigger && (
                  <button
                    type="button"
                    onClick={onQuickAddTrigger}
                    className="no-print mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6B58] text-white text-xs font-semibold hover:bg-[#095747] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Barang Pertama di {roomName}
                  </button>
                )}
              </td>
            </tr>
          )}
          {items.length > 0 && (
            <tr className="bg-gray-50 font-bold">
              <td colSpan={5} className="border border-black p-2 text-right">
                Total ({items.length} Jenis Barang)
              </td>
              <td className="border border-black p-2 text-center font-mono">{totalUnit}</td>
              <td colSpan={showActions ? 3 : 2} className="border border-black p-2" />
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-between items-end mt-10 text-xs font-serif" style={{ pageBreakInside: 'avoid' }}>
        <div className="text-center w-64">
          <div>Mengetahui,</div>
          <div>Kepala Sekolah</div>
          <div className="h-14" />
          <div className="font-bold underline">{config.kepsek || '-'}</div>
          <div>NIP. {config.nipKepsek || '-'}</div>
        </div>
        <div className="text-center w-64">
          <div>
            {config.kabupaten || 'Cirebon'}, {tglCetak}
          </div>
          <div>Penanggung Jawab Ruangan</div>
          <div className="h-14" />
          <div className="font-bold underline">{penanggungJawab?.trim() || '..............................'}</div>
          <div>NIP. {nipPenanggungJawab?.trim() || '-'}</div>
        </div>
      </div>
    </div>
  );
}

export const KirRuanganTab: React.FC<KirRuanganTabProps> = ({
  isOperator,
  config,
  asets,
  kibCategories,
  onReloadAsets,
  onEditAsetModal,
  onToast,
}) => {
  const [savedRuangs, setSavedRuangs] = useState<KirRuang[]>(() => getKirRuangs());
  const [gurus, setGurus] = useState<Guru[]>(() => getGurus());
  const [rombels, setRombels] = useState<Rombel[]>(() => getRombels());

  const [selectedRoomName, setSelectedRoomName] = useState<string>('');
  const [roomSearch, setRoomSearch] = useState('');

  // Inline Add Room form
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomPj, setNewRoomPj] = useState('');
  const [newRoomNip, setNewRoomNip] = useState('');

  // Rename Room inline
  const [isRenamingRoom, setIsRenamingRoom] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);

  // Inline Quick Add Barang to Selected Room
  const [showQuickAddItem, setShowQuickAddItem] = useState(false);
  const [qaNama, setQaNama] = useState('');
  const [qaMerk, setQaMerk] = useState('');
  const [qaKode, setQaKode] = useState('');
  const [qaTahun, setQaTahun] = useState(() => String(new Date().getFullYear()));
  const [qaJumlah, setQaJumlah] = useState('1');
  const [qaKondisi, setQaKondisi] = useState<'Baik' | 'Rusak ringan' | 'Rusak berat'>('Baik');
  const [qaKategori, setQaKategori] = useState(kibCategories[1] || kibCategories[0]);
  const [qaSumber, setQaSumber] = useState('BOS');
  const [qaKeterangan, setQaKeterangan] = useState('');

  // Confirm delete single aset inside KIR
  const [confirmDeleteAsetId, setConfirmDeleteAsetId] = useState<string | null>(null);

  // Modal: Pick / Copy / Move existing Aset from other rooms
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerQtyMap, setPickerQtyMap] = useState<Record<string, number>>({});
  const [reduceSourceOnCopy, setReduceSourceOnCopy] = useState(true);

  const kirPrintRef = useRef<HTMLDivElement>(null);
  const allKirPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      setSavedRuangs(getKirRuangs());
      setGurus(getGurus());
      setRombels(getRombels());
    };
    const u1 = subscribeToStorage(sync);
    const u2 = subscribeToCloudChanges(sync);
    return () => {
      u1();
      u2();
    };
  }, []);

  // Merge saved rooms + any dynamic room names from `asets`
  const allRooms = useMemo<KirRuang[]>(() => {
    const map = new Map<string, KirRuang>();
    savedRuangs.forEach((r) => {
      const clean = r.nama.trim();
      if (!clean) return;
      map.set(clean.toLowerCase(), { ...r, nama: clean });
    });
    asets.forEach((a, idx) => {
      const clean = (a.lokasi || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `kir_auto_${idx}_${key.replace(/[^a-z0-9]+/g, '_')}`,
          nama: clean,
        });
      }
    });
    return Array.from(map.values());
  }, [savedRuangs, asets]);

  // Select default room automatically (prefer first room that has items, else first room)
  useEffect(() => {
    if (!allRooms.length) return;
    const stillExists = allRooms.some((r) => r.nama.toLowerCase() === selectedRoomName.toLowerCase());
    if (!stillExists) {
      const withItems = allRooms.find((r) =>
        asets.some((a) => (a.lokasi || '').trim().toLowerCase() === r.nama.toLowerCase())
      );
      setSelectedRoomName(withItems?.nama || allRooms[0].nama);
    }
  }, [allRooms, asets, selectedRoomName]);

  const activeRoom =
    allRooms.find((r) => r.nama.toLowerCase() === selectedRoomName.toLowerCase()) || allRooms[0] || null;

  const roomStatsMap = useMemo(() => {
    const stats = new Map<string, { itemCount: number; unitCount: number }>();
    asets.forEach((a) => {
      const key = (a.lokasi || '').trim().toLowerCase();
      if (!key) return;
      const prev = stats.get(key) || { itemCount: 0, unitCount: 0 };
      stats.set(key, {
        itemCount: prev.itemCount + 1,
        unitCount: prev.unitCount + Math.max(0, Number(a.jumlah) || 0),
      });
    });
    return stats;
  }, [asets]);

  const kirItems = useMemo(() => {
    if (!activeRoom) return [];
    const key = activeRoom.nama.toLowerCase();
    return asets.filter((a) => (a.lokasi || '').trim().toLowerCase() === key);
  }, [asets, activeRoom]);

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return allRooms;
    return allRooms.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        (r.kodeRuang || '').toLowerCase().includes(q) ||
        (r.penanggungJawab || '').toLowerCase().includes(q)
    );
  }, [allRooms, roomSearch]);

  const roomSuggestions = useMemo(() => {
    const existingKeys = new Set(allRooms.map((r) => r.nama.toLowerCase()));
    const candidates = [
      ...rombels.map((rb) => rb.ruangan?.trim() || `Ruang Kelas ${rb.nama}`),
      ...STANDARD_ROOM_SUGGESTIONS,
    ];
    return Array.from(new Set(candidates)).filter((name) => name && !existingKeys.has(name.toLowerCase()));
  }, [allRooms, rombels]);

  const otherRoomAsets = useMemo(() => {
    if (!activeRoom) return [];
    const activeKey = activeRoom.nama.toLowerCase();
    const q = pickerSearch.trim().toLowerCase();
    return asets.filter((a) => {
      if ((a.lokasi || '').trim().toLowerCase() === activeKey) return false;
      if (!q) return true;
      return `${a.nama} ${a.kode || ''} ${a.merk || ''} ${a.lokasi || ''}`.toLowerCase().includes(q);
    });
  }, [asets, activeRoom, pickerSearch]);

  const roomsToPrintAll = useMemo(() => {
    const nonEmpty = allRooms.filter((r) => (roomStatsMap.get(r.nama.toLowerCase())?.itemCount || 0) > 0);
    return nonEmpty.length > 0 ? nonEmpty : allRooms;
  }, [allRooms, roomStatsMap]);

  const handleRoomMetaUpdate = (patch: Partial<KirRuang>) => {
    if (!activeRoom) return;
    const updated: KirRuang = {
      ...activeRoom,
      ...patch,
    };
    saveKirRuang(updated);
    setSavedRuangs(getKirRuangs());
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newRoomName.trim();
    if (!clean) {
      onToast('Nama ruangan wajib diisi.', true);
      return;
    }
    const existing = allRooms.find((r) => r.nama.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setSelectedRoomName(existing.nama);
      setShowAddRoom(false);
      onToast(`Ruangan "${existing.nama}" sudah ada dan dipilih.`);
      return;
    }
    const created: KirRuang = {
      id: `kir_${Date.now()}`,
      nama: clean,
      kodeRuang: newRoomCode.trim() || undefined,
      penanggungJawab: newRoomPj.trim() || undefined,
      nipPenanggungJawab: newRoomNip.trim() || undefined,
    };
    saveKirRuang(created);
    setSavedRuangs(getKirRuangs());
    setSelectedRoomName(created.nama);
    setNewRoomName('');
    setNewRoomCode('');
    setNewRoomPj('');
    setNewRoomNip('');
    setShowAddRoom(false);
    onToast(`Ruangan KIR "${created.nama}" ditambahkan.`);
  };

  const handleRenameRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    const nextName = renameValue.trim();
    if (!nextName) return;
    const oldKey = activeRoom.nama.toLowerCase();
    if (nextName.toLowerCase() !== oldKey && allRooms.some((r) => r.nama.toLowerCase() === nextName.toLowerCase())) {
      onToast(`Ruangan "${nextName}" sudah terdaftar.`, true);
      return;
    }
    // Update all assets inside old room name
    const nextAsets = asets.map((a) =>
      (a.lokasi || '').trim().toLowerCase() === oldKey ? { ...a, lokasi: nextName, updatedAt: Date.now() } : a
    );
    saveAsets(nextAsets, `Ubah nama ruangan KIR "${activeRoom.nama}" ke "${nextName}"`);
    const nextRuangs = getKirRuangs().map((r) =>
      r.nama.toLowerCase() === oldKey ? { ...r, nama: nextName, updatedAt: Date.now() } : r
    );
    if (!nextRuangs.some((r) => r.nama.toLowerCase() === nextName.toLowerCase())) {
      nextRuangs.push({ ...activeRoom, nama: nextName, updatedAt: Date.now() });
    }
    saveKirRuangs(nextRuangs);
    setSavedRuangs(getKirRuangs());
    onReloadAsets();
    setSelectedRoomName(nextName);
    setIsRenamingRoom(false);
    onToast(`Nama ruangan diubah menjadi "${nextName}".`);
  };

  const handleDeleteRoom = () => {
    if (!activeRoom) return;
    if (!isOperator) {
      onToast('Hanya Operator yang dapat menghapus ruangan KIR.', true);
      return;
    }
    if (!confirmDeleteRoom) {
      setConfirmDeleteRoom(true);
      setTimeout(() => setConfirmDeleteRoom(false), 3500);
      return;
    }
    const oldKey = activeRoom.nama.toLowerCase();
    // Ensure saved list exists before removing so default rooms don't snap back
    const currentList = getKirRuangs();
    const filteredList = currentList.filter((r) => r.nama.toLowerCase() !== oldKey);
    saveKirRuangs(filteredList, `Hapus ruangan KIR: ${activeRoom.nama}`);
    deleteKirRuang(activeRoom.id);

    if (kirItems.length > 0) {
      const nextAsets = asets.filter((a) => (a.lokasi || '').trim().toLowerCase() !== oldKey);
      saveAsets(nextAsets, `Hapus ruangan KIR "${activeRoom.nama}" beserta ${kirItems.length} barangnya`);
      onReloadAsets();
    }
    setSavedRuangs(getKirRuangs());
    setConfirmDeleteRoom(false);
    setSelectedRoomName('');
    onToast(`Ruangan "${activeRoom.nama}" dihapus.`);
  };

  const handleQuickAddBarang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    const cleanName = qaNama.trim();
    if (!cleanName) {
      onToast('Nama barang wajib diisi.', true);
      return;
    }
    const qty = Math.max(1, Math.round(Number(qaJumlah) || 1));
    const newAset: Aset = {
      id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nama: cleanName,
      merk: qaMerk.trim() || undefined,
      kode: qaKode.trim() || undefined,
      kategori: qaKategori || kibCategories[1],
      jumlah: qty,
      kondisi: qaKondisi,
      lokasi: activeRoom.nama,
      tahunPerolehan: Number(qaTahun) || new Date().getFullYear(),
      sumber: qaSumber || 'BOS',
      harga: 0,
      keterangan: qaKeterangan.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveAset(newAset);
    onReloadAsets();
    setQaNama('');
    setQaMerk('');
    setQaKode('');
    setQaJumlah('1');
    setQaKeterangan('');
    onToast(`"${newAset.nama}" (${qty} unit) ditambahkan ke ${activeRoom.nama}.`);
  };

  const handleAdjustQty = (item: Aset, delta: number) => {
    const nextQty = Math.max(1, (item.jumlah || 1) + delta);
    if (nextQty === item.jumlah) return;
    saveAset({ ...item, jumlah: nextQty, updatedAt: Date.now() });
    onReloadAsets();
  };

  const handleDeleteBarang = (item: Aset) => {
    if (!isOperator) {
      onToast('Hanya Operator yang dapat menghapus barang inventaris.', true);
      return;
    }
    if (confirmDeleteAsetId !== item.id) {
      setConfirmDeleteAsetId(item.id);
      setTimeout(() => {
        setConfirmDeleteAsetId((prev) => (prev === item.id ? null : prev));
      }, 3500);
      return;
    }
    deleteAset(item.id);
    setConfirmDeleteAsetId(null);
    onReloadAsets();
    onToast(`"${item.nama}" dihapus dari ${activeRoom?.nama || 'ruangan'}.`);
  };

  const handleMoveAsetToRoom = (item: Aset) => {
    if (!activeRoom) return;
    saveAset({ ...item, lokasi: activeRoom.nama, updatedAt: Date.now() });
    onReloadAsets();
    onToast(`"${item.nama}" dipindahkan ke ${activeRoom.nama}.`);
  };

  const handleCopyOrSplitAsetToRoom = (item: Aset) => {
    if (!activeRoom) return;
    const maxAvail = Math.max(1, Number(item.jumlah) || 1);
    const chosenQty = Math.min(maxAvail, Math.max(1, Math.round(pickerQtyMap[item.id] || 1)));

    if (reduceSourceOnCopy && chosenQty >= maxAvail) {
      handleMoveAsetToRoom(item);
      return;
    }

    const copied: Aset = {
      ...item,
      id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      jumlah: chosenQty,
      lokasi: activeRoom.nama,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (reduceSourceOnCopy && maxAvail > chosenQty) {
      const nextList = asets.map((a) =>
        a.id === item.id ? { ...a, jumlah: maxAvail - chosenQty, updatedAt: Date.now() } : a
      );
      nextList.push(copied);
      saveAsets(nextList, `Bagi ${chosenQty} unit "${item.nama}" ke ${activeRoom.nama}`);
    } else {
      saveAset(copied);
    }
    onReloadAsets();
    onToast(`${chosenQty} unit "${item.nama}" ditambahkan ke ${activeRoom.nama}.`);
  };

  const handleGuruNameInput = (name: string, target: 'new' | 'active') => {
    const matched = gurus.find((g) => g.nama.toLowerCase() === name.trim().toLowerCase());
    if (target === 'new') {
      setNewRoomPj(name);
      if (matched?.nip) setNewRoomNip(matched.nip);
    } else {
      handleRoomMetaUpdate({
        penanggungJawab: name,
        ...(matched?.nip ? { nipPenanggungJawab: matched.nip } : {}),
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Guru Datalist */}
      <datalist id="kir-guru-datalist">
        {gurus.map((g) => (
          <option key={g.id} value={g.nama}>
            {g.nip ? `NIP. ${g.nip}` : g.jabatan || ''}
          </option>
        ))}
      </datalist>

      {/* Top Room Directory Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#D3DDD9] space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-[#13262A] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0B6B58]" />
              <span>Daftar Ruangan KIR ({allRooms.length} Ruangan)</span>
            </div>
            <p className="text-[11px] text-[#566A6E] mt-0.5">
              Pilih ruangan di bawah untuk mengelola dan mencetak KIR masing-masing ruang secara terpisah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#566A6E] absolute left-2.5 top-2" />
              <input
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder="Cari ruangan..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg w-44 bg-white focus:outline-none focus:border-[#0B6B58]"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddRoom((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0B6B58] text-[#0B6B58] hover:bg-emerald-50 text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Ruangan
            </button>

            <button
              type="button"
              onClick={() => printDomElement(allKirPrintRef.current, { paper: 'A4', margin: '12mm 16mm' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D3DDD9] bg-white hover:bg-gray-50 text-[#13262A] text-xs font-semibold cursor-pointer"
              title="Cetak semua ruangan yang memiliki inventaris (1 ruangan per halaman)"
            >
              <Printer className="w-3.5 h-3.5 text-[#0B6B58]" />
              Cetak Semua ({roomsToPrintAll.length})
            </button>

            {activeRoom && (
              <button
                type="button"
                onClick={() => printDomElement(kirPrintRef.current, { paper: 'A4', margin: '12mm 16mm' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak KIR Ruang Ini
              </button>
            )}
          </div>
        </div>

        {/* Inline Add New Room Form */}
        {showAddRoom && (
          <form
            onSubmit={handleCreateRoom}
            className="bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl p-3.5 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#13262A]">Tambah Ruangan Baru untuk KIR</span>
              <button
                type="button"
                onClick={() => setShowAddRoom(false)}
                className="text-[#566A6E] hover:text-[#13262A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {roomSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#566A6E]">Saran cepat:</span>
                {roomSuggestions.slice(0, 8).map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setNewRoomName(sug)}
                    className="px-2 py-0.5 rounded-md border border-[#D3DDD9] bg-white hover:border-[#0B6B58] hover:text-[#0B6B58] text-[11px] font-medium cursor-pointer"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 items-end">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nama Ruangan *</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Contoh: Ruang Kelas 1 / Lab Komputer"
                  required
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kode Ruang</label>
                <input
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value)}
                  placeholder="R.01"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Penanggung Jawab</label>
                <input
                  list="kir-guru-datalist"
                  value={newRoomPj}
                  onChange={(e) => handleGuruNameInput(e.target.value, 'new')}
                  placeholder="Nama guru/petugas"
                  className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                />
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NIP</label>
                  <input
                    value={newRoomNip}
                    onChange={(e) => setNewRoomNip(e.target.value)}
                    placeholder="NIP PJ"
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold cursor-pointer self-end"
                >
                  Simpan
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Room Cards Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {filteredRooms.map((r) => {
            const st = roomStatsMap.get(r.nama.toLowerCase()) || { itemCount: 0, unitCount: 0 };
            const isActive = activeRoom?.nama.toLowerCase() === r.nama.toLowerCase();
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRoomName(r.nama);
                  setIsRenamingRoom(false);
                  setConfirmDeleteRoom(false);
                }}
                className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                  isActive
                    ? 'bg-[#E8EFEC] border-[#0B6B58] ring-1 ring-[#0B6B58]/30'
                    : 'bg-[#FAFBFB] border-[#D3DDD9] hover:bg-white hover:border-[#0B6B58]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className={`text-xs font-bold leading-snug line-clamp-1 ${isActive ? 'text-[#0B6B58]' : 'text-[#13262A]'}`}>
                    {r.nama}
                  </div>
                  {r.kodeRuang && (
                    <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-white border border-[#D3DDD9] text-[#566A6E] shrink-0">
                      {r.kodeRuang}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#566A6E] mt-1 font-mono">
                  {st.itemCount} jenis &middot; {st.unitCount} unit
                </div>
                {r.penanggungJawab && (
                  <div className="text-[10px] text-[#566A6E] truncate mt-0.5">PJ: {r.penanggungJawab}</div>
                )}
              </button>
            );
          })}
          {filteredRooms.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-[#566A6E]">
              Tidak ada ruangan yang cocok dengan pencarian "{roomSearch}".
            </div>
          )}
        </div>
      </div>

      {/* Selected Room Toolbar + Quick Add Barang */}
      {activeRoom && (
        <div className="bg-white p-4 rounded-xl border border-[#D3DDD9] space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {!isRenamingRoom ? (
                <>
                  <h3 className="text-sm font-bold text-[#13262A]">{activeRoom.nama}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(activeRoom.nama);
                      setIsRenamingRoom(true);
                    }}
                    className="p-1 rounded border border-[#D3DDD9] text-[#566A6E] hover:text-[#0B6B58] hover:bg-gray-50 cursor-pointer"
                    title="Ubah nama ruangan"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <form onSubmit={handleRenameRoom} className="inline-flex items-center gap-1.5">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold border border-[#0B6B58] rounded-lg"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="p-1.5 rounded-lg bg-[#0B6B58] text-white cursor-pointer"
                    title="Simpan nama ruangan"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenamingRoom(false)}
                    className="p-1.5 rounded-lg border border-[#D3DDD9] text-[#566A6E] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#F1F4F2] text-[#566A6E] font-medium">
                {kirItems.length} jenis barang
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAddItem((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold cursor-pointer shadow-2xs"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                {showQuickAddItem ? 'Tutup Form Tambah' : 'Tambah Barang ke Ruang Ini'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerSearch('');
                  setIsPickerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D3DDD9] bg-white hover:bg-gray-50 text-[#13262A] text-xs font-semibold cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#0B6B58]" />
                Ambil / Salin dari Daftar Aset
              </button>

              {isOperator && (
                <button
                  type="button"
                  onClick={handleDeleteRoom}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    confirmDeleteRoom
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'border-[#D3DDD9] text-rose-700 hover:bg-rose-50'
                  }`}
                  title={
                    kirItems.length > 0
                      ? `Hapus ruangan ini beserta ${kirItems.length} barang di dalamnya`
                      : 'Hapus ruangan kosong ini'
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmDeleteRoom
                    ? kirItems.length > 0
                      ? `Hapus Ruang + ${kirItems.length} Barang?`
                      : 'Yakin Hapus Ruang?'
                    : 'Hapus Ruang'}
                </button>
              )}
            </div>
          </div>

          {/* Room Meta Controls: Kode Ruang, Penanggung Jawab & NIP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#EAEFED] text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kode Ruang</label>
              <input
                value={activeRoom.kodeRuang || ''}
                onChange={(e) => handleRoomMetaUpdate({ kodeRuang: e.target.value })}
                placeholder="Contoh: R.01 / KLS-4"
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Penanggung Jawab Ruangan</label>
              <input
                list="kir-guru-datalist"
                value={activeRoom.penanggungJawab || ''}
                onChange={(e) => handleGuruNameInput(e.target.value, 'active')}
                placeholder="Pilih guru atau ketik nama PJ"
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">NIP Penanggung Jawab</label>
              <input
                value={activeRoom.nipPenanggungJawab || ''}
                onChange={(e) => handleRoomMetaUpdate({ nipPenanggungJawab: e.target.value })}
                placeholder="NIP (otomatis jika pilih guru)"
                className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg font-mono bg-white"
              />
            </div>
          </div>

          {/* Inline Quick-Add Barang Form for Selected Room */}
          {showQuickAddItem && (
            <form
              onSubmit={handleQuickAddBarang}
              className="bg-[#F4F8F6] border border-[#0B6B58]/30 rounded-xl p-3.5 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-[#0B6B58]">
                  Tambah Barang Baru Khusus di "{activeRoom.nama}"
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickAddItem(false)}
                  className="text-[#566A6E] hover:text-[#13262A] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Nama Barang *</label>
                  <input
                    value={qaNama}
                    onChange={(e) => setQaNama(e.target.value)}
                    placeholder="Contoh: Lemari Arsip / Meja Guru / Papan Tulis"
                    required
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Merk / Model</label>
                  <input
                    value={qaMerk}
                    onChange={(e) => setQaMerk(e.target.value)}
                    placeholder="Contoh: Olympic / Kayu Jati"
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kode Barang</label>
                  <input
                    value={qaKode}
                    onChange={(e) => setQaKode(e.target.value)}
                    placeholder="KIB-B-..."
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Jumlah Unit *</label>
                  <input
                    type="number"
                    min={1}
                    value={qaJumlah}
                    onChange={(e) => setQaJumlah(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Kondisi</label>
                  <select
                    value={qaKondisi}
                    onChange={(e) => setQaKondisi(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-semibold"
                  >
                    <option value="Baik">Baik</option>
                    <option value="Rusak ringan">Rusak Ringan</option>
                    <option value="Rusak berat">Rusak Berat</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Golongan KIB</label>
                  <select
                    value={qaKategori}
                    onChange={(e) => setQaKategori(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  >
                    {kibCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Tahun</label>
                  <input
                    type="number"
                    value={qaTahun}
                    onChange={(e) => setQaTahun(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Sumber Dana</label>
                  <select
                    value={qaSumber}
                    onChange={(e) => setQaSumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  >
                    <option value="BOS">BOS</option>
                    <option value="APBD">APBD</option>
                    <option value="APBN">APBN</option>
                    <option value="Hibah">Hibah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#566A6E] mb-1">Keterangan</label>
                  <input
                    value={qaKeterangan}
                    onChange={(e) => setQaKeterangan(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-2.5 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-3.5 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold cursor-pointer"
                >
                  Simpan ke Ruang
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Printable & Interactive KIR Sheet for Active Room */}
      {activeRoom && (
        <div
          ref={kirPrintRef}
          className="bg-white border border-[#D3DDD9] rounded-xl p-6 md:p-8 shadow-xs print-sheet"
        >
          <KirSheetPrintable
            config={config}
            roomName={activeRoom.nama}
            kodeRuang={activeRoom.kodeRuang}
            penanggungJawab={activeRoom.penanggungJawab}
            nipPenanggungJawab={activeRoom.nipPenanggungJawab}
            items={kirItems}
            showActions={true}
            confirmDeleteAsetId={confirmDeleteAsetId}
            onAdjustQty={handleAdjustQty}
            onEditItem={onEditAsetModal}
            onDeleteItem={handleDeleteBarang}
            onQuickAddTrigger={() => setShowQuickAddItem(true)}
          />
        </div>
      )}

      {/* Hidden Offscreen Multi-Room Print Source */}
      <div className="hidden" aria-hidden="true">
        <div ref={allKirPrintRef}>
          {roomsToPrintAll.map((rm, idx) => {
            const rmItems = asets.filter((a) => (a.lokasi || '').trim().toLowerCase() === rm.nama.toLowerCase());
            return (
              <div
                key={rm.id}
                className="bg-white"
                style={{ pageBreakAfter: idx < roomsToPrintAll.length - 1 ? 'always' : 'auto' }}
              >
                <KirSheetPrintable
                  config={config}
                  roomName={rm.nama}
                  kodeRuang={rm.kodeRuang}
                  penanggungJawab={rm.penanggungJawab}
                  nipPenanggungJawab={rm.nipPenanggungJawab}
                  items={rmItems}
                  showActions={false}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Picker: Ambil / Salin Barang dari Daftar Aset ke Ruangan Aktif */}
      {isPickerOpen && activeRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D3DDD9] max-w-3xl w-full p-5 space-y-4 my-6 text-xs max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E4EBE8] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#13262A]">
                  Ambil / Salin Barang ke "{activeRoom.nama}"
                </h3>
                <p className="text-[11px] text-[#566A6E] mt-0.5">
                  Pindahkan seluruh barang atau bagi sebagian jumlah unit dari Daftar Aset ke ruangan ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 rounded-lg text-[#566A6E] hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#566A6E]" />
                <input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Cari nama barang, kode, merk, atau ruangan asal..."
                  className="w-full pl-8 pr-3 py-1.5 border border-[#D3DDD9] rounded-lg"
                />
              </div>
              <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#13262A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={reduceSourceOnCopy}
                  onChange={(e) => setReduceSourceOnCopy(e.target.checked)}
                  className="accent-[#0B6B58]"
                />
                Kurangi stok di ruangan asal saat menyalin/membagi unit
              </label>
            </div>

            <div className="flex-1 overflow-y-auto border border-[#D3DDD9] rounded-xl divide-y divide-[#EAEFED]">
              {otherRoomAsets.map((item) => {
                const maxQty = Math.max(1, Number(item.jumlah) || 1);
                const valQty = pickerQtyMap[item.id] ?? 1;
                return (
                  <div key={item.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#13262A]">{item.nama}</div>
                      <div className="text-[11px] text-[#566A6E] mt-0.5">
                        Ruang asal: <b>{item.lokasi || 'Belum ditentukan'}</b> &middot; Stok: <b>{maxQty} unit</b>{' '}
                        {item.kode ? `· ${item.kode}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {maxQty > 1 && (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={valQty}
                            onChange={(e) =>
                              setPickerQtyMap((prev) => ({
                                ...prev,
                                [item.id]: Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)),
                              }))
                            }
                            className="w-14 px-2 py-1 border border-[#D3DDD9] rounded-md text-center font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyOrSplitAsetToRoom(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#0B6B58] text-[#0B6B58] hover:bg-emerald-50 font-semibold cursor-pointer"
                          >
                            <CopyPlus className="w-3.5 h-3.5" />
                            Ambil {valQty} Unit
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMoveAsetToRoom(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Pindahkan Semua
                      </button>
                    </div>
                  </div>
                );
              })}
              {otherRoomAsets.length === 0 && (
                <div className="p-8 text-center text-[#566A6E]">
                  Tidak ada barang lain di luar "{activeRoom.nama}".
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E4EBE8]">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-[#D3DDD9] text-[#13262A] font-semibold hover:bg-gray-50 cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
