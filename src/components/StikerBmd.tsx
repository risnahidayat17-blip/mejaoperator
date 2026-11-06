/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import { SchoolConfig, BmdItem, StikerConfig } from '../types';
import { getBmdItems, saveBmdItems, getStikerConfig, saveStikerConfig } from '../lib/storage';
import { LOGO_PEMDA_STIKER } from '../data/stikerLogo';
import { parseSikatonFile, convertToBmdItems } from '../lib/sikatonImport';
import { Printer, Plus, Pencil, Trash2, Search, X, ClipboardPaste, FileUp, FileSpreadsheet } from 'lucide-react';

interface StikerBmdProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

const PER_PAGE = 16; // 2 kolom x 8 baris, sama dengan lembar CETAK di Excel

type Draft = Omit<BmdItem, 'id'>;

/** Pisahkan satu baris CSV/TSV (mendukung tanda kutip). */
function splitLine(line: string, delim: string): string[] {
  if (delim === '\t') return line.split('\t').map((c) => c.trim());
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Baca data BMD hasil salin dari Excel (tab) atau berkas CSV.
 * Kolom yang dikenali:
 *  - 10 kolom atau lebih: lembar DATA_BMD (No, NPSN, Kode SKPD, Nama Sekolah, Kode Barang, ID Barang, KD & ID, Nama Barang, Merk/Type, Sumber Dana)
 *  - 5 kolom: Kode Barang, ID Barang, Nama Barang, Merk/Type, Sumber Dana
 */
export function parseBmdText(text: string): Draft[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0];
  const delim = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const result: Draft[] = [];
  for (const line of lines) {
    const c = splitLine(line, delim);
    let kode = '';
    let id = '';
    let nama = '';
    let merk = '';
    let sumber = '';
    if (c.length >= 10) {
      [kode, id, nama, merk, sumber] = [c[4], c[5], c[7], c[8], c[9]];
    } else if (c.length === 5) {
      [kode, id, nama, merk, sumber] = c;
    } else if (c.length === 6) {
      // Kode, ID, KD&ID, Nama, Merk, Sumber  -atau-  No, Kode, ID, Nama, Merk, Sumber
      if (/^\d{1,5}$/.test(c[0])) [, kode, id, nama, merk, sumber] = c;
      else [kode, id, , nama, merk, sumber] = c;
    } else {
      continue;
    }
    // lewati baris judul & baris kosong
    if (!nama || !kode) continue;
    if (/^kode/i.test(kode) || /^no$/i.test(kode)) continue;
    result.push({ kodeBarang: kode, idBarang: id, namaBarang: nama, merkType: merk, sumberDana: sumber });
  }
  return result;
}

function autoNamaSekolah(config: SchoolConfig): string {
  const nama = (config.namaSekolah || '').replace(/^SD\s+Negeri/i, 'SDN').toUpperCase();
  const kec = (config.kecamatan || '').toUpperCase();
  return kec ? `${nama} KEC. ${kec}` : nama;
}

export const StikerBmd: React.FC<StikerBmdProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const [items, setItems] = useState<BmdItem[]>(getBmdItems());
  const [selected, setSelected] = useState<Set<string>>(() => new Set(getBmdItems().map((b) => b.id)));
  const [cfg, setCfg] = useState<StikerConfig>(getStikerConfig());
  const [startPos, setStartPos] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<BmdItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState<'tambah' | 'ganti'>('tambah');
  const fileRef = useRef<HTMLInputElement>(null);

  const footerText = cfg.namaSekolahStiker?.trim() || autoNamaSekolah(config);

  const logoSrc =
    cfg.logo === 'pemda_bawaan'
      ? LOGO_PEMDA_STIKER
      : cfg.logo === 'pemda_profil'
        ? config.logoPemda || config.logo || LOGO_PEMDA_STIKER
        : cfg.logo === 'sekolah'
          ? config.logoSekolah || ''
          : '';

  const updateCfg = (patch: Partial<StikerConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveStikerConfig(next);
  };

  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim();
    if (!t) return items;
    return items.filter((b) =>
      [b.kodeBarang, b.idBarang, b.namaBarang, b.merkType, b.sumberDana].some((v) => (v || '').toLowerCase().includes(t))
    );
  }, [items, search]);

  const persist = (list: BmdItem[], activity?: string) => {
    saveBmdItems(list, activity);
    setItems(getBmdItems());
  };

  const toPrint = items.filter((b) => selected.has(b.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) filtered.forEach((b) => next.delete(b.id));
    else filtered.forEach((b) => next.add(b.id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // Halaman cetak: slot kosong di depan bila lembar stiker sudah terpakai sebagian.
  const pages = useMemo(() => {
    const slots: (BmdItem | null)[] = [...Array(Math.max(0, startPos - 1)).fill(null), ...toPrint];
    const out: (BmdItem | null)[][] = [];
    for (let i = 0; i < slots.length; i += PER_PAGE) out.push(slots.slice(i, i + PER_PAGE));
    return out;
  }, [toPrint, startPos]);

  const handlePrint = () => {
    if (!toPrint.length) {
      onToast('Pilih minimal satu barang untuk dicetak.', true);
      return;
    }
    document.body.classList.add('printing-stiker');
    const cleanup = () => {
      document.body.classList.remove('printing-stiker');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  };

  const handleSaveForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rec: BmdItem = {
      id: editing ? editing.id : `bmd_${Date.now()}`,
      kodeBarang: String(f.get('kodeBarang')).trim(),
      idBarang: String(f.get('idBarang')).trim(),
      namaBarang: String(f.get('namaBarang')).trim(),
      merkType: String(f.get('merkType')).trim(),
      sumberDana: String(f.get('sumberDana')).trim(),
      createdAt: editing?.createdAt,
      updatedAt: Date.now(),
    };
    if (!rec.namaBarang || !rec.kodeBarang) {
      onToast('Kode Barang dan Nama Barang wajib diisi.', true);
      return;
    }
    const list = editing ? items.map((b) => (b.id === rec.id ? rec : b)) : [...items, rec];
    persist(list, `${editing ? 'Ubah' : 'Tambah'} BMD stiker: ${rec.namaBarang}`);
    if (!editing) setSelected(new Set([...selected, rec.id]));
    setIsFormOpen(false);
    setEditing(null);
    onToast(`Barang "${rec.namaBarang}" disimpan.`);
  };

  const handleDelete = (b: BmdItem) => {
    if (!isOperator) {
      onToast('Hanya Operator yang berhak menghapus data BMD.', true);
      return;
    }
    if (!window.confirm(`Hapus "${b.namaBarang}" (${b.idBarang}) dari daftar stiker?`)) return;
    persist(items.filter((x) => x.id !== b.id), `Hapus BMD stiker: ${b.namaBarang}`);
    const next = new Set(selected);
    next.delete(b.id);
    setSelected(next);
  };

  const handleImport = () => {
    const parsed = parseBmdText(pasteText);
    if (!parsed.length) {
      onToast('Tidak ada baris yang bisa dibaca. Salin kolom Kode Barang, ID Barang, Nama Barang, Merk/Type, Sumber Dana dari Excel.', true);
      return;
    }
    if (pasteMode === 'ganti' && !isOperator) {
      onToast('Hanya Operator yang boleh mengganti seluruh data BMD.', true);
      return;
    }
    const stamp = Date.now();
    const baru: BmdItem[] = parsed.map((d, i) => ({ ...d, id: `bmd_${stamp}_${i}` }));
    const list = pasteMode === 'ganti' ? baru : [...items, ...baru];
    persist(list, `Impor ${baru.length} barang BMD untuk stiker`);
    setSelected(pasteMode === 'ganti' ? new Set(baru.map((b) => b.id)) : new Set([...selected, ...baru.map((b) => b.id)]));
    setPasteText('');
    setIsPasteOpen(false);
    onToast(`${baru.length} barang BMD berhasil diimpor.`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      if (/\.xlsx?$/i.test(file.name)) {
        const { result } = await parseSikatonFile(file);
        if (!result.items.length) {
          onToast('Tidak ditemukan baris barang yang valid pada berkas Excel SIKATON.', true);
          return;
        }
        if (result.detectedSkpd && !cfg.kodeSkpd) {
          updateCfg({ kodeSkpd: result.detectedSkpd });
        }
        const bmdItems = convertToBmdItems(result.items);
        if (pasteMode === 'ganti' && !isOperator) {
          onToast('Hanya Operator yang boleh mengganti seluruh data BMD.', true);
          return;
        }
        const list = pasteMode === 'ganti' ? bmdItems : [...items, ...bmdItems];
        persist(list, `Impor ${bmdItems.length} barang BMD dari ${file.name}`);
        setSelected(pasteMode === 'ganti' ? new Set(bmdItems.map((b) => b.id)) : new Set([...selected, ...bmdItems.map((b) => b.id)]));
        setIsPasteOpen(false);
        onToast(`Berhasil membaca dan mengimpor ${bmdItems.length} barang dari ${file.name}.`);
      } else {
        const reader = new FileReader();
        reader.onload = () => setPasteText(String(reader.result || ''));
        reader.readAsText(file);
      }
    } catch (err: any) {
      onToast(err?.message || 'Gagal membaca berkas Excel.', true);
    }
  };

  const inputCls = 'w-full px-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]';

  const renderSticker = (b: BmdItem) => (
    <div className="stk">
      <div className="stk-main">
        <div className="stk-logo">{logoSrc && <img src={logoSrc} alt="" />}</div>
        <table className="stk-fields">
          <tbody>
            {[
              ['Kode SKPD', cfg.kodeSkpd],
              ['Kode/ID Barang', `${b.kodeBarang} / ${b.idBarang}`],
              ['Nama Barang', b.namaBarang],
              ['Merk / Type', b.merkType || ''],
              ['Sumber Dana', b.sumberDana || ''],
            ].map(([label, val], idx) => (
              <tr key={label}>
                <td className="stk-l">{label}</td>
                <td className="stk-c">:</td>
                <td className={idx < 2 ? 'stk-v stk-b' : 'stk-v'}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stk-foot">{footerText}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <style>{`
        .stk { box-sizing: border-box; width: 96mm; height: 34mm; border: 0.5mm solid #000; background: #fff; color: #000;
               font-family: 'Bookman Old Style', Bookman, 'Palatino Linotype', Georgia, serif; font-size: 8pt; line-height: 1.2;
               display: flex; flex-direction: column; overflow: hidden; }
        .stk-main { flex: 1; min-height: 0; overflow: hidden; display: flex; align-items: safe center; padding: 0.8mm 1.5mm 0.8mm 1.5mm; gap: 1.5mm; }
        .stk-logo { width: 16mm; flex: none; display: flex; align-items: center; justify-content: center; }
        .stk-logo img { max-width: 16mm; max-height: 24mm; object-fit: contain; }
        .stk-fields { border-collapse: collapse; flex: 1; min-width: 0; }
        .stk-fields td { padding: 0; vertical-align: top; }
        .stk-l { width: 22.5mm; font-weight: 700; white-space: nowrap; }
        .stk-c { width: 2mm; }
        .stk-v { word-break: break-word; }
        .stk-b { font-weight: 700; }
        .stk-foot { border-top: 0.5mm solid #000; text-align: center; font-weight: 700; padding: 0.6mm 1mm; font-size: 8.5pt; flex: none; }
        .stk-page { width: 198mm; height: 285mm; padding: 0; display: grid; grid-template-columns: 96mm 96mm; grid-auto-rows: 34mm;
                    column-gap: 4mm; row-gap: 1.5mm; justify-content: start; align-content: start; background: #fff; box-sizing: border-box; }
        .stk-empty { width: 96mm; height: 34mm; }
        @media screen {
          .stk-empty { border: 1px dashed #c5d0cc; box-sizing: border-box; }
          .stk-sheet-wrap { zoom: 0.72; }
          .stk-page { box-shadow: 0 1px 4px rgba(0,0,0,.2); margin: 0 auto 12px; padding: 6mm; width: 210mm; height: 297mm; }
        }
        @media print {
          @page stiker { size: A4 portrait; margin: 6mm; }
          .stiker-print { page: stiker; }
          .stk-page { break-after: page; page-break-after: always; padding: 0; width: 198mm; height: 285mm; margin: 0; }
          .stk-page:last-child { break-after: auto; page-break-after: auto; }
          .stk-sheet-wrap { zoom: 1; }
          body.printing-stiker :not(.stiker-print):not(:has(.stiker-print)):not(.stiker-print *) { display: none !important; }
          body.printing-stiker :has(.stiker-print) { display: block !important; padding: 0 !important; margin: 0 !important; width: auto !important;
            max-width: none !important; height: auto !important; min-height: 0 !important; overflow: visible !important; position: static !important; border: 0 !important; }
          body.printing-stiker .stk-empty { border: 0; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-[#566A6E] max-w-2xl">
          Stiker Barang Milik Daerah (BMD) sesuai data SIKATON: Kode SKPD, Kode/ID Barang, Nama, Merk/Type, dan Sumber Dana. Satu lembar A4 memuat 16 stiker (2 kolom × 8 baris).
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsPasteOpen(true)} className="px-3 py-2 bg-white border border-[#D3DDD9] hover:bg-[#F3F7F5] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer">
            <ClipboardPaste className="w-4 h-4" /> Impor dari Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            className="px-3 py-2 bg-white border border-[#D3DDD9] hover:bg-[#F3F7F5] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tambah Barang
          </button>
          <button type="button" onClick={handlePrint} className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer">
            <Printer className="w-4 h-4" /> Cetak Stiker ({toPrint.length})
          </button>
        </div>
      </div>

      {/* Pengaturan stiker */}
      <div className="no-print bg-white p-3.5 rounded-xl border border-[#D3DDD9] grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs shadow-xs">
        <div>
          <label className="block font-semibold text-[#566A6E] mb-1">Kode SKPD</label>
          <input value={cfg.kodeSkpd} onChange={(e) => updateCfg({ kodeSkpd: e.target.value })} className={inputCls} placeholder="1.01.01.002.0358" />
        </div>
        <div>
          <label className="block font-semibold text-[#566A6E] mb-1">Teks nama sekolah (bawah stiker)</label>
          <input value={cfg.namaSekolahStiker || ''} onChange={(e) => updateCfg({ namaSekolahStiker: e.target.value })} className={inputCls} placeholder={autoNamaSekolah(config)} />
        </div>
        <div>
          <label className="block font-semibold text-[#566A6E] mb-1">Logo stiker</label>
          <select value={cfg.logo} onChange={(e) => updateCfg({ logo: e.target.value as StikerConfig['logo'] })} className={inputCls + ' bg-white'}>
            <option value="pemda_bawaan">Logo Pemda (bawaan Excel)</option>
            <option value="pemda_profil">Logo Pemda dari Pengaturan Sekolah</option>
            <option value="sekolah">Logo Sekolah</option>
            <option value="tanpa">Tanpa logo</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold text-[#566A6E] mb-1">Mulai dari posisi stiker</label>
          <select value={startPos} onChange={(e) => setStartPos(Number(e.target.value))} className={inputCls + ' bg-white'}>
            {Array.from({ length: PER_PAGE }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} (baris {Math.floor(i / 2) + 1}, kolom {(i % 2) + 1})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Daftar BMD */}
      <div className="no-print bg-white rounded-xl border border-[#D3DDD9] shadow-xs overflow-hidden">
        <div className="p-3 border-b border-[#D3DDD9] flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode, ID, nama, merk, atau sumber dana..." className={inputCls + ' pl-9'} />
          </div>
          <span className="text-xs text-[#566A6E]">
            {toPrint.length} dari {items.length} barang dipilih
          </span>
        </div>
        <div className="overflow-x-auto max-h-[360px]">
          <table className="w-full text-xs">
            <thead className="bg-[#F3F7F5] text-[#566A6E] sticky top-0">
              <tr>
                <th className="p-2 w-8 text-center">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Pilih semua" />
                </th>
                <th className="p-2 text-left">No</th>
                <th className="p-2 text-left">Kode / ID Barang</th>
                <th className="p-2 text-left">Nama Barang</th>
                <th className="p-2 text-left">Merk / Type</th>
                <th className="p-2 text-left">Sumber Dana</th>
                <th className="p-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id} className="border-t border-[#E6EDEA] hover:bg-[#F8FBFA]">
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleOne(b.id)} />
                  </td>
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-mono">{b.kodeBarang} / {b.idBarang}</td>
                  <td className="p-2 font-semibold text-[#13262A]">{b.namaBarang}</td>
                  <td className="p-2">{b.merkType}</td>
                  <td className="p-2">{b.sumberDana}</td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-end">
                      <button type="button" onClick={() => { setEditing(b); setIsFormOpen(true); }} className="p-1.5 text-[#0B6B58] hover:bg-[#E6F2EE] rounded cursor-pointer" title="Ubah">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(b)} className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#566A6E]">
                    Belum ada data BMD. Gunakan “Impor dari Excel” atau “Tambah Barang”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pratinjau & area cetak */}
      <div className="no-print text-xs font-semibold text-[#566A6E]">Pratinjau cetak ({pages.length} lembar A4)</div>
      <div className="stiker-print stk-sheet-wrap">
        {pages.map((slots, pi) => (
          <div className="stk-page" key={pi}>
            {slots.map((b, si) => (b ? <div key={b.id + si}>{renderSticker(b)}</div> : <div className="stk-empty" key={'e' + si} />))}
          </div>
        ))}
        {pages.length === 0 && <div className="no-print text-xs text-[#566A6E] p-4">Pilih barang pada daftar di atas untuk melihat pratinjau stiker.</div>}
      </div>

      {/* Modal tambah/ubah */}
      {isFormOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <form onSubmit={handleSaveForm} className="bg-white rounded-xl shadow-xl border border-[#D3DDD9] max-w-lg w-full p-6 space-y-3 my-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#13262A]">{editing ? 'Ubah Barang BMD' : 'Tambah Barang BMD'}</h3>
              <button type="button" onClick={() => { setIsFormOpen(false); setEditing(null); }} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">Kode Barang *</label>
                <input name="kodeBarang" required defaultValue={editing?.kodeBarang} className={inputCls} placeholder="1.3.2.05.01.04.003" />
              </div>
              <div>
                <label className="block font-semibold text-[#566A6E] mb-1">ID Barang *</label>
                <input name="idBarang" required defaultValue={editing?.idBarang} className={inputCls} placeholder="10062847" />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-[#566A6E] mb-1">Nama Barang *</label>
              <input name="namaBarang" required defaultValue={editing?.namaBarang} className={inputCls} />
            </div>
            <div>
              <label className="block font-semibold text-[#566A6E] mb-1">Merk / Type</label>
              <input name="merkType" defaultValue={editing?.merkType} className={inputCls} placeholder="Merk: Lokal / Type: Rak Buku Single" />
            </div>
            <div>
              <label className="block font-semibold text-[#566A6E] mb-1">Sumber Dana</label>
              <input name="sumberDana" defaultValue={editing?.sumberDana} className={inputCls} placeholder="BOS Reguler - TA. 2026 Bln.3" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setIsFormOpen(false); setEditing(null); }} className="px-4 py-2 border border-[#D3DDD9] rounded-lg font-semibold cursor-pointer">Batal</button>
              <button type="submit" className="px-4 py-2 bg-[#0B6B58] text-white rounded-lg font-semibold cursor-pointer">Simpan</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal impor */}
      {isPasteOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-[#D3DDD9] max-w-2xl w-full p-6 space-y-3 my-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#13262A]">Impor Data BMD dari Excel</h3>
              <button type="button" onClick={() => setIsPasteOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[#566A6E]">
              Di Excel, blok sel lalu salin (Ctrl+C) dan tempel di bawah. Bisa dari lembar <b>DATA_BMD</b> (10 kolom, langsung disalin utuh) atau 5 kolom:
              Kode Barang, ID Barang, Nama Barang, Merk/Type, Sumber Dana. Berkas CSV juga bisa dimuat.
            </p>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={8} className={inputCls + ' font-mono'} placeholder="Tempel data di sini..." />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="hidden" onChange={handleFile} />
                <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 border border-[#D3DDD9] hover:bg-[#F3F7F5] rounded-lg font-semibold flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B6B58]" /> Muat Berkas (.xlsx / .csv)
                </button>
                <label className="flex items-center gap-1.5"><input type="radio" checked={pasteMode === 'tambah'} onChange={() => setPasteMode('tambah')} /> Tambahkan ke daftar</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={pasteMode === 'ganti'} onChange={() => setPasteMode('ganti')} /> Ganti semua</label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsPasteOpen(false)} className="px-4 py-2 border border-[#D3DDD9] rounded-lg font-semibold cursor-pointer">Batal</button>
                <button type="button" onClick={handleImport} className="px-4 py-2 bg-[#0B6B58] text-white rounded-lg font-semibold cursor-pointer">Impor</button>
              </div>
            </div>
            {pasteText.trim() && <p className="text-[#566A6E]">Terbaca {parseBmdText(pasteText).length} barang.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
