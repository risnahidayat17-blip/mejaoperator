/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { SchoolConfig, SuratKeluar as ISuratKeluar, Siswa, LetterTemplate } from '../types';
import {
  getSuratKeluar,
  saveSuratKeluar,
  deleteSuratKeluar,
  getSiswas,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  recordActivity,
} from '../lib/storage';
import { docxToHtml, sanitizeLetterHtml, htmlToPlainText, MAX_DOCX_BYTES } from '../lib/docx';
import { KopSuratHD } from './KopSuratHD';
import {
  Send,
  Plus,
  Pencil,
  Trash2,
  Printer,
  FileDown,
  Eye,
  FileText,
  CheckCircle2,
  Search,
  Sparkles,
  Upload,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Save,
} from 'lucide-react';

interface SuratKeluarProps {
  role: 'operator' | 'guru';
  config: SchoolConfig;
  onToast: (msg: string, isError?: boolean) => void;
}

// Data surat yang bisa disisipkan ke surat kustom, contoh: {{nama_siswa}}
const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'nomor', label: 'Nomor surat' },
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'tempat', label: 'Tempat' },
  { key: 'perihal', label: 'Perihal' },
  { key: 'nama_siswa', label: 'Nama siswa' },
  { key: 'nisn', label: 'NISN' },
  { key: 'kelas', label: 'Kelas' },
  { key: 'penandatangan', label: 'Penandatangan' },
  { key: 'nip', label: 'NIP penandatangan' },
  { key: 'jabatan', label: 'Jabatan' },
  { key: 'sekolah', label: 'Nama sekolah' },
];

const escHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Convert number to Indonesian written word
function angkaKeKata(num: number | string): string {
  const map: Record<string, string> = {
    '1': 'Satu',
    '2': 'Dua',
    '3': 'Tiga',
    '4': 'Empat',
    '5': 'Lima',
    '6': 'Enam',
  };
  const str = String(num || '').trim();
  return map[str] ? `${str} (${map[str]})` : str || '-';
}

function cleanNip(nip?: string): string {
  if (!nip) return '';
  const digits = nip.replace(/\D/g, '');
  return digits ? `NIP. ${digits}` : nip;
}

export const SuratKeluar: React.FC<SuratKeluarProps> = ({ role, config, onToast }) => {
  const isOperator = role === 'operator';
  const [suratList, setSuratList] = useState<ISuratKeluar[]>(getSuratKeluar());
  const [siswaList] = useState<Siswa[]>(getSiswas());
  const [templateList, setTemplateList] = useState<LetterTemplate[]>(getTemplates());

  const [searchTerm, setSearchTerm] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [paperSize, setPaperSize] = useState<'A4' | 'Legal'>('A4');

  // Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSurat, setEditingSurat] = useState<ISuratKeluar | null>(null);

  // Form states
  const [jenis, setJenis] = useState('Surat keterangan aktif siswa');
  const [siswaId, setSiswaId] = useState('');
  const [noSurat, setNoSurat] = useState('');
  const [tglSurat, setTglSurat] = useState(new Date().toISOString().split('T')[0]);
  const [tempat, setTempat] = useState(config.kabupaten || 'Cirebon');
  const [perihal, setPerihal] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [sifat, setSifat] = useState('Biasa');
  const [pembuka, setPembuka] = useState('Yang bertanda tangan di bawah ini:');
  const [isi, setIsi] = useState('');
  const [penutup, setPenutup] = useState('Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.');
  const [penandatangan, setPenandatangan] = useState(config.kepsek || 'H. KAERUDIN, M.Pd,');
  const [nipTtd, setNipTtd] = useState(config.nipKepsek || '19720904 199412 1 001');
  const [jabatanTtd, setJabatanTtd] = useState('Kepala Sekolah');
  const [kopOption, setKopOption] = useState('Dengan kop sekolah');

  // Surat kustom (ketik bebas / impor Word)
  const [mode, setMode] = useState<'standar' | 'kustom'>('standar');
  const [isiHtml, setIsiHtmlState] = useState('');
  const isiHtmlRef = useRef('');
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tplId, setTplId] = useState('');
  const [importing, setImporting] = useState(false);

  const setIsiHtml = (html: string) => {
    isiHtmlRef.current = html;
    setIsiHtmlState(html);
  };

  // Isi editor hanya dimuat saat dibuka / diganti dari luar (agar kursor tidak lompat saat mengetik)
  useEffect(() => {
    if (isEditorOpen && mode === 'kustom' && editorRef.current) {
      editorRef.current.innerHTML = isiHtmlRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditorOpen, mode, editorKey]);

  // Preview Modal
  const [previewSurat, setPreviewSurat] = useState<ISuratKeluar | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const modalPreviewRef = useRef<HTMLDivElement>(null);

  const reloadData = () => {
    setSuratList(getSuratKeluar());
  };

  const generateAutoNoSurat = (tgl: string) => {
    const format = config.formatNoSurat || '421.2/{no:3}/SD/2026';
    const year = tgl.slice(0, 4) || '2026';
    const nextNo = suratList.length + 1;
    const noPadded = String(nextNo).padStart(3, '0');
    return format
      .replace('{no:3}', noPadded)
      .replace('{no}', String(nextNo))
      .replace('{tahun}', year);
  };

  const openEditor = (surat?: ISuratKeluar | null) => {
    if (surat) {
      setEditingSurat(surat);
      setJenis(surat.jenis);
      setSiswaId(surat.siswaId || '');
      setNoSurat(surat.noSurat);
      setTglSurat(surat.tglSurat);
      setTempat(surat.tempat || config.kabupaten || 'Cirebon');
      setPerihal(surat.perihal);
      setTujuan(surat.tujuan || '');
      setSifat(surat.sifat || 'Biasa');
      setPembuka(surat.pembuka || '');
      setIsi(surat.isi);
      setPenutup(surat.penutup || '');
      setPenandatangan(surat.penandatangan);
      setNipTtd(surat.nipTtd || '');
      setJabatanTtd(surat.jabatanTtd || 'Kepala Sekolah');
      setKopOption(surat.kop);
      setPaperSize(surat.ukuranKertas || 'A4');
      setMode(surat.mode || 'standar');
      setIsiHtml(surat.isiHtml || '');
      setTplId('');
      setEditorKey((k) => k + 1);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setEditingSurat(null);
      setJenis('Surat keterangan aktif siswa');
      const firstSiswa = siswaList[0];
      setSiswaId(firstSiswa ? firstSiswa.id : '');
      setNoSurat(generateAutoNoSurat(today));
      setTglSurat(today);
      setTempat(config.kabupaten || 'Cirebon');
      setSifat('Biasa');
      setPenandatangan(config.kepsek || 'H. KAERUDIN, M.Pd,');
      setNipTtd(config.nipKepsek || '19720904 199412 1 001');
      setJabatanTtd('Kepala Sekolah');
      setKopOption('Dengan kop sekolah');
      setPaperSize('A4');
      setMode('standar');
      setIsiHtml('');
      setTplId('');
      setEditorKey((k) => k + 1);

      if (firstSiswa) {
        setPerihal(`Surat keterangan aktif siswa a.n. ${firstSiswa.nama}`);
        setIsi(
          `dengan ini menerangkan bahwa nama siswa tersebut di bawah ini, adalah benar Peserta Didik SD NEGERI 2 CEMPAKA KEC. TALUN yang saat ini aktif mengikuti kegiatan belajar mengajar pada Tahun Ajaran ${config.tahunAjaran}.`
        );
      } else {
        setPerihal('Surat keterangan aktif siswa');
        setIsi('dengan ini menerangkan bahwa nama siswa tersebut di bawah ini, adalah benar Peserta Didik sekolah kami.');
      }
      setPenutup('Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.');
    }
    setIsEditorOpen(true);
  };

  const handleSelectSiswa = (sId: string, currentJenis: string) => {
    setSiswaId(sId);
    const s = siswaList.find((x) => x.id === sId);
    if (!s) return;

    if (currentJenis === 'Surat keterangan aktif siswa') {
      setPerihal(`Surat keterangan aktif siswa a.n. ${s.nama}`);
      setIsi(
        `dengan ini menerangkan bahwa nama siswa tersebut di bawah ini, adalah benar Peserta Didik SD NEGERI 2 CEMPAKA KEC. TALUN yang saat ini aktif mengikuti kegiatan belajar mengajar pada Tahun Ajaran ${config.tahunAjaran}.`
      );
      setPenutup('Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.');
    } else if (currentJenis === 'Surat keterangan pindah siswa') {
      setPerihal(`Surat keterangan pindah siswa a.n. ${s.nama}`);
      setIsi(
        `Yang bertanda tangan di bawah ini, Kepala Sekolah Dasar Negeri 2 Cempaka, Kecamatan ${
          config.kecamatan || 'Talun'
        } Kabupaten ${config.kabupaten || 'Cirebon'}, menerangkan bahwa :

Nama : ${s.nama.toUpperCase()}
Tempat, Tanggal Lahir : ${s.tempatLahir || '-'}, ${s.tglLahir || '-'}
NISN : ${s.nisn || '-'}
Kelas : ${angkaKeKata(s.kelas)}
Jenis Kelamin : ${s.jk === 'L' ? 'Laki-laki' : 'Perempuan'}
Alamat : ${s.alamat || '-'}

Sesuai permintaan pindah oleh orang tua :
Nama : ${s.namaAyah || s.namaIbu || '-'}
Alamat : ${s.alamat || '-'}

Telah mengajukan pindah ke ${s.tujuanMutasi || 'Sekolah Dasar Tujuan'} dengan alasan ${
          s.alasanMutasi || 'Mengikuti kepindahan tugas dinas orang tua'
        }.`
      );
      setPenutup('Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.');
    }
  };

  const handleSaveSurat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!perihal.trim()) {
      onToast('Perihal surat wajib diisi.', true);
      return;
    }
    if (!noSurat.trim()) {
      onToast('Nomor surat wajib diisi.', true);
      return;
    }

    const isKustom = mode === 'kustom';
    const cleanHtml = isKustom ? sanitizeLetterHtml(isiHtmlRef.current) : '';
    if (isKustom && !htmlToPlainText(cleanHtml)) {
      onToast('Isi surat kustom masih kosong. Ketik isi surat atau unggah berkas Word.', true);
      return;
    }

    const noAgenda = editingSurat ? editingSurat.noAgenda : String(suratList.length + 1);

    const record: ISuratKeluar = {
      id: editingSurat ? editingSurat.id : `sk_${Date.now()}`,
      noAgenda,
      tglSurat,
      noSurat: noSurat.trim(),
      jenis: isKustom ? 'Surat kustom' : jenis,
      siswaId: siswaId || undefined,
      sifat,
      tempat,
      perihal: perihal.trim(),
      tujuan: tujuan.trim(),
      pembuka,
      isi: isKustom ? htmlToPlainText(cleanHtml).slice(0, 2000) : isi,
      penutup,
      penandatangan,
      nipTtd,
      jabatanTtd,
      kop: kopOption,
      ukuranKertas: paperSize,
      mode: isKustom ? 'kustom' : 'standar',
      isiHtml: isKustom ? cleanHtml : undefined,
      createdAt: editingSurat ? editingSurat.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    saveSuratKeluar(record);
    reloadData();
    setIsEditorOpen(false);
    onToast(`Surat "${record.perihal}" berhasil disimpan ke arsip.`);
  };

  const handleDelete = (id: string, subject: string) => {
    if (!isOperator) {
      onToast('Hanya Operator yang berhak menghapus arsip surat keluar.', true);
      return;
    }
    if (window.confirm(`Hapus arsip surat "${subject}"?`)) {
      deleteSuratKeluar(id);
      reloadData();
      onToast(`Surat "${subject}" berhasil dihapus.`);
    }
  };

  const formatTanggalIndo = (tglStr?: string) => {
    if (!tglStr) return '';
    try {
      const parts = tglStr.split('-');
      if (parts.length === 3) {
        const bln = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
        ];
        const day = parseInt(parts[2], 10);
        const m = bln[parseInt(parts[1], 10) - 1];
        const y = parts[0];
        return `${day} ${m} ${y}`;
      }
    } catch {}
    return tglStr;
  };

  const handlePrint = (pSize?: 'A4' | 'Legal') => {
    const size = pSize || paperSize;
    document.body.setAttribute('data-paper-size', size.toLowerCase());
    const current = previewSurat || editingSurat;
    if (current) {
      recordActivity('Surat Keluar', `Cetak surat keluar: ${current.perihal || current.noSurat || 'Surat'}`, false, 'update');
    }
    window.print();
    setTimeout(() => {
      document.body.removeAttribute('data-paper-size');
    }, 1200);
  };

  // ---------- Surat kustom ----------
  const fillPlaceholders = (html: string, sr: ISuratKeluar) => {
    const st = siswaList.find((x) => x.id === sr.siswaId);
    const vals: Record<string, string | undefined> = {
      nomor: sr.noSurat,
      tanggal: formatTanggalIndo(sr.tglSurat),
      tempat: sr.tempat || config.kabupaten,
      perihal: sr.perihal,
      nama_siswa: st?.nama,
      nisn: st?.nisn,
      kelas: st ? String(st.kelas) : undefined,
      penandatangan: sr.penandatangan,
      nip: cleanNip(sr.nipTtd || config.nipKepsek),
      jabatan: sr.jabatanTtd,
      sekolah: config.namaSekolah,
    };
    return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => {
      const v = vals[k];
      return v ? escHtml(v) : m;
    });
  };

  const syncEditor = () => {
    if (editorRef.current) setIsiHtml(sanitizeLetterHtml(editorRef.current.innerHTML));
  };

  const execFmt = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    syncEditor();
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const txt = e.clipboardData.getData('text/plain');
    document.execCommand(
      'insertHTML',
      false,
      html ? sanitizeLetterHtml(html) : escHtml(txt).replace(/\r?\n/g, '<br>')
    );
    syncEditor();
  };

  const insertPlaceholder = (key: string) => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
    document.execCommand('insertText', false, `{{${key}}}`);
    syncEditor();
  };

  const switchMode = (m: 'standar' | 'kustom') => {
    setMode(m);
    if (m === 'kustom') {
      setJenis('Surat kustom');
      // Hindari data siswa/perihal bawaan format standar terbawa ke surat kustom
      setSiswaId('');
      if (/^Surat keterangan (aktif|pindah) siswa/i.test(perihal)) setPerihal('');
    } else if (jenis === 'Surat kustom') {
      setJenis('Surat keterangan aktif siswa');
    }
  };

  const confirmReplaceBody = () =>
    !htmlToPlainText(isiHtmlRef.current) ||
    window.confirm('Isi surat yang sedang ada akan diganti. Lanjutkan?');

  const handleUploadDocx = async (file?: File | null) => {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      onToast('Pilih berkas Word berformat .docx. Jika berkasnya .doc, buka di Word lalu Simpan Sebagai .docx.', true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_DOCX_BYTES) {
      onToast('Ukuran berkas terlalu besar (maksimal 5 MB).', true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!confirmReplaceBody()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setImporting(true);
    try {
      const { html, notes } = await docxToHtml(await file.arrayBuffer());
      setIsiHtml(html);
      setMode('kustom');
      setJenis('Surat kustom');
      setTplId('');
      setEditorKey((k) => k + 1);
      if (!perihal.trim() || /^Surat keterangan (aktif|pindah) siswa/i.test(perihal)) {
        setPerihal(file.name.replace(/\.docx$/i, ''));
      }
      if (mode !== 'kustom') setSiswaId('');
      onToast(`Berkas "${file.name}" berhasil diimpor. Periksa dan sesuaikan isinya. ${notes.join(' ')}`.trim());
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal membaca berkas Word.', true);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyTemplate = (id: string) => {
    setTplId(id);
    const t = templateList.find((x) => x.id === id);
    if (!t || !t.isiHtml) return;
    if (!confirmReplaceBody()) {
      setTplId('');
      return;
    }
    setIsiHtml(sanitizeLetterHtml(t.isiHtml));
    setPaperSize(t.ukuranKertas || 'A4');
    if (!perihal.trim()) setPerihal(t.judul);
    setEditorKey((k) => k + 1);
  };

  const handleSaveTemplate = () => {
    const html = sanitizeLetterHtml(isiHtmlRef.current);
    if (!htmlToPlainText(html)) {
      onToast('Isi surat masih kosong, belum ada yang bisa disimpan sebagai template.', true);
      return;
    }
    const judul = (window.prompt('Nama template surat (contoh: Surat Tugas, Surat Undangan):', perihal.trim()) || '').trim();
    if (!judul) return;
    const existing = templateList.find((t) => t.judul.toLowerCase() === judul.toLowerCase());
    if (existing && !existing.isiHtml) {
      onToast('Nama itu dipakai oleh format bawaan. Gunakan nama lain.', true);
      return;
    }
    if (existing && !window.confirm(`Template "${existing.judul}" sudah ada. Timpa dengan isi saat ini?`)) return;
    const id = existing?.id || `tpl_${Date.now()}`;
    saveTemplate({
      id,
      judul,
      kategori: 'Kustom',
      ukuranKertas: paperSize,
      isi: '',
      isiHtml: html,
      sumber: 'kustom',
    });
    setTemplateList(getTemplates());
    setTplId(id);
    onToast(`Template "${judul}" tersimpan. Bisa dipakai lagi di surat berikutnya.`);
  };

  const handleDeleteTemplate = () => {
    const t = templateList.find((x) => x.id === tplId);
    if (!t) return;
    if (!window.confirm(`Hapus template "${t.judul}"? Surat yang sudah dibuat tidak terpengaruh.`)) return;
    deleteTemplate(t.id);
    setTemplateList(getTemplates());
    setTplId('');
    onToast(`Template "${t.judul}" dihapus.`);
  };

  const renderSuratContent = (s: ISuratKeluar) => {
    const isAktif = s.jenis === 'Surat keterangan aktif siswa';
    const student = siswaList.find((x) => x.id === s.siswaId);
    const dateFormatted = formatTanggalIndo(s.tglSurat);
    const isLegal = (s.ukuranKertas || paperSize) === 'Legal';

    if (s.mode === 'kustom') {
      return (
        <div
          className={`bg-white text-black w-full mx-auto p-10 md:p-14 shadow-xl border border-gray-300 rounded-sm select-text print-sheet surat-kustom-sheet transition-all ${
            isLegal ? 'max-w-[780px] min-h-[1140px]' : 'max-w-[760px] min-h-[960px]'
          }`}
        >
          {s.kop !== 'Tanpa kop' && <KopSuratHD config={config} />}
          <div
            className="surat-kustom"
            dangerouslySetInnerHTML={{ __html: fillPlaceholders(sanitizeLetterHtml(s.isiHtml || ''), s) }}
          />
        </div>
      );
    }

    return (
      <div
        className={`bg-white text-black w-full mx-auto p-10 md:p-14 shadow-xl border border-gray-300 rounded-sm font-sans select-text leading-relaxed print-sheet transition-all ${
          isLegal ? 'max-w-[780px] min-h-[1140px]' : 'max-w-[760px] min-h-[960px]'
        }`}
      >
        {s.kop !== 'Tanpa kop' && <KopSuratHD config={config} />}

        {isAktif ? (
          <div
            className="space-y-4"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13.5px', color: '#000000' }}
          >
            <div className="text-center my-6">
              <h2 className="text-[14px] font-bold underline uppercase tracking-wide" style={{ textUnderlineOffset: '3px' }}>
                SURAT KETERANGAN
              </h2>
              <div className="text-[13px] mt-0.5">Nomor : {s.noSurat || ''}</div>
            </div>

            <div className="space-y-1">
              <div>Yang bertanda tangan di bawah ini:</div>
              <div className="grid grid-cols-[150px_14px_1fr] text-[13.5px] leading-relaxed">
                <span>Nama</span>
                <span>:</span>
                <span>{s.penandatangan || config.kepsek}</span>
                <span>NIP</span>
                <span>:</span>
                <span>{s.nipTtd || config.nipKepsek}</span>
                <span>Jabatan</span>
                <span>:</span>
                <span>{s.jabatanTtd || 'Kepala Sekolah'}</span>
                <span>Satuan Pendidikan</span>
                <span>:</span>
                <span>{config.namaSekolah}</span>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <div>Menerangkan dengan sesungguhnya bahwa</div>
              <div className="grid grid-cols-[150px_14px_1fr] text-[13.5px] leading-relaxed">
                <span>Nama</span>
                <span>:</span>
                <span className="font-bold">{(student?.nama || 'ABDUL AZIZ').toUpperCase()}</span>
                <span>NISN</span>
                <span>:</span>
                <span>{student?.nisn || '147224749'}</span>
                <span>Kelas</span>
                <span>:</span>
                <span>{angkaKeKata(student?.kelas || '5')}</span>
                <span>Satuan Pendidikan</span>
                <span>:</span>
                <span>{config.namaSekolah}</span>
              </div>
            </div>

            <div className="pt-4 text-justify leading-relaxed">
              {s.isi ||
                'dengan ini menerangkan bahwa nama siswa tersebut di bawah ini, adalah benar Peserta Didik SD NEGERI 2 CEMPAKA KEC. TALUN.'}
            </div>

            <div className="pt-2 text-justify">
              {s.penutup || 'Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.'}
            </div>

            <div className="pt-8 ml-auto w-64 text-left leading-normal">
              <div>
                {s.tempat || config.kabupaten}, {dateFormatted}
              </div>
              <div>{s.jabatanTtd || 'Kepala Sekolah'}</div>
              <div className="h-20" />
              <div className="font-bold underline" style={{ textUnderlineOffset: '2px' }}>
                {s.penandatangan || config.kepsek}
              </div>
              <div className="text-[12.5px]">{cleanNip(s.nipTtd || config.nipKepsek)}</div>
            </div>
          </div>
        ) : (
          <div
            className="space-y-4"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13.5px', color: '#000000' }}
          >
            <div className="text-right">
              {s.tempat || config.kabupaten}, {dateFormatted}
            </div>
            <div className="grid grid-cols-[80px_14px_1fr] text-[13px] gap-y-0.5">
              <span>Nomor</span>
              <span>:</span>
              <span className="font-mono">{s.noSurat}</span>
              <span>Lampiran</span>
              <span>:</span>
              <span>-</span>
              <span>Perihal</span>
              <span>:</span>
              <span className="font-bold">{s.perihal}</span>
            </div>

            {s.tujuan && (
              <div className="pt-2 whitespace-pre-line">
                <div>Kepada Yth:</div>
                <div className="font-bold">{s.tujuan}</div>
              </div>
            )}

            {s.pembuka && <div className="pt-2">{s.pembuka}</div>}
            <div className="whitespace-pre-line text-justify leading-relaxed pt-2">{s.isi}</div>
            {s.penutup && <div className="pt-2 text-justify">{s.penutup}</div>}

            <div className="pt-8 ml-auto w-64 text-left leading-normal">
              <div>{s.jabatanTtd || 'Kepala Sekolah'},</div>
              <div className="h-20" />
              <div className="font-bold underline">{s.penandatangan}</div>
              <div className="text-[12.5px]">{cleanNip(s.nipTtd)}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredSurat = suratList.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    const matchTerm =
      !term ||
      s.perihal.toLowerCase().includes(term) ||
      s.noSurat.toLowerCase().includes(term) ||
      (s.tujuan && s.tujuan.toLowerCase().includes(term));
    const matchJenis = !filterJenis || s.jenis === filterJenis;
    return matchTerm && matchJenis;
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DAEEE7] text-[#0B6B58] mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Kop Surat Beresolusi Tinggi (Pojok Kiri Atas)
          </div>
          <h1 className="text-2xl font-bold text-[#13262A] font-display">
            Surat Keluar & Pembuat Surat Dinas
          </h1>
          <p className="text-xs text-[#566A6E]">
            Format standar dinas pendidikan dengan logo sekolah tajam beresolusi tinggi dan cetak presisi.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openEditor()}
          className="px-4 py-2 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Buat Surat Baru
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#D3DDD9] flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#566A6E] absolute left-3 top-2.5" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari perihal surat, nomor surat, atau tujuan..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D3DDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6B58]"
          />
        </div>

        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value)}
          className="text-xs px-3 py-1.5 border border-[#D3DDD9] rounded-lg bg-white"
        >
          <option value="">Semua Jenis Surat</option>
          <option value="Surat keterangan aktif siswa">Surat Keterangan Aktif Siswa</option>
          <option value="Surat keterangan pindah siswa">Surat Keterangan Pindah Siswa</option>
          <option value="Pemberitahuan">Pemberitahuan</option>
          <option value="Undangan">Undangan</option>
          <option value="Surat tugas">Surat Tugas</option>
        </select>
      </div>

      {/* Table of Letters */}
      <div className="bg-white border border-[#D3DDD9] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F1F4F2] text-[#566A6E] uppercase tracking-wider text-[11px] font-semibold">
                <th className="py-2.5 px-4 border-b border-[#D3DDD9] w-16 text-center">No Agenda</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Perihal Surat</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Nomor & Tanggal</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Tujuan</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9]">Jenis</th>
                <th className="py-2.5 px-4 border-b border-[#D3DDD9] text-right">Aksi & Unduh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D3DDD9]">
              {filteredSurat.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/80">
                  <td className="py-3 px-4 text-center font-mono font-bold text-[#0B6B58]">
                    #{s.noAgenda}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#13262A] text-sm">{s.perihal}</div>
                    <div className="text-[11px] text-[#566A6E]">Penandatangan: {s.penandatangan}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-[#13262A]">{s.noSurat}</div>
                    <div className="text-[11px] text-[#566A6E]">{s.tglSurat}</div>
                  </td>
                  <td className="py-3 px-4 text-[#566A6E]">{s.tujuan || '-'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DAEEE7] text-[#0B6B58]">
                      {s.jenis}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewSurat(s)}
                        className="p-1.5 text-[#0B6B58] hover:bg-[#DAEEE7] rounded transition cursor-pointer"
                        title="Pratinjau Tampilan Surat & Cetak"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditor(s)}
                        className="p-1.5 text-[#566A6E] hover:text-[#0B6B58] hover:bg-[#E8EFEC] rounded transition cursor-pointer"
                        title="Ubah Surat"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isOperator && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.perihal)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Hapus Surat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDITOR MODAL WITH LIVE PREVIEW */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden my-4">
            <div className="px-6 py-3.5 bg-[#0B6B58] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#DAEEE7]" />
                <h2 className="text-base font-bold font-display">
                  {editingSurat ? 'Ubah Surat Keluar' : 'Penyusun Surat Keluar (Kop Surat Resolusi Tinggi)'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#D3DDD9]">
              {/* Form Input Side */}
              <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
                {/* Pilih cara menyusun isi surat */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl">
                  <button
                    type="button"
                    onClick={() => switchMode('standar')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mode === 'standar' ? 'bg-[#0B6B58] text-white shadow-xs' : 'text-[#566A6E] hover:bg-white'
                    }`}
                  >
                    Format Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('kustom')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      mode === 'kustom' ? 'bg-[#0B6B58] text-white shadow-xs' : 'text-[#566A6E] hover:bg-white'
                    }`}
                  >
                    Surat Kustom / Word
                  </button>
                </div>

                {mode === 'standar' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#566A6E]">Format / Jenis Surat *</label>
                    <span className="text-[10px] text-[#0B6B58] font-bold">
                      {templateList.length} Pilihan Template
                    </span>
                  </div>
                  <select
                    value={jenis}
                    onChange={(e) => {
                      const val = e.target.value;
                      setJenis(val);
                      const t = templateList.find((x) => x.judul === val);
                      if (t) {
                        setPaperSize(t.ukuranKertas || 'A4');
                        if (t.pembuka) setPembuka(t.pembuka);
                        if (t.isi) setIsi(t.isi);
                        if (t.penutup) setPenutup(t.penutup);
                        if (t.sifat) setSifat(t.sifat);
                        setPerihal(t.judul);
                      } else if (val === 'Surat keterangan aktif siswa') {
                        setPaperSize('A4');
                        setPembuka('Yang bertanda tangan di bawah ini:');
                        setPenutup('Demikian surat keterangan ini dibuat untuk digunakan sebagaimana mestinya.');
                      } else if (val === 'Surat keterangan pindah siswa') {
                        setPaperSize('Legal');
                      }
                      if (siswaId) handleSelectSiswa(siswaId, val);
                    }}
                    className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg bg-white font-bold text-[#0B6B58]"
                  >
                    <optgroup label="Format Standar Resmi">
                      <option value="Surat keterangan aktif siswa">
                        Surat Keterangan Aktif Siswa (A4 Presisi)
                      </option>
                      <option value="Surat keterangan pindah siswa">
                        Surat Keterangan Pindah Siswa (Legal / F4)
                      </option>
                    </optgroup>
                    <optgroup label="Template Tambahan">
                      {templateList
                        .filter(
                          (t) =>
                            !t.isiHtml &&
                            t.judul !== 'Surat keterangan aktif siswa' &&
                            t.judul !== 'Surat keterangan pindah siswa'
                        )
                        .map((t) => (
                          <option key={t.id} value={t.judul}>
                            {t.judul} ({t.ukuranKertas || 'A4'})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
                ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-[#DAEEE7]/60 border border-[#0B6B58]/30 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#0B6B58]">Surat Kustom</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="px-3 py-1.5 bg-[#0B6B58] hover:bg-[#095747] disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> {importing ? 'Membaca berkas...' : 'Unggah Word (.docx)'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => handleUploadDocx(e.target.files?.[0])}
                      />
                    </div>
                    <p className="text-[11px] text-[#566A6E] leading-relaxed">
                      Ketik surat sendiri, atau unggah surat Word yang sudah ada lalu sesuaikan di kotak di bawah.
                      Header/footer dan gambar di Word tidak ikut; untuk kop pilih &quot;Dengan Kop Resmi&quot; di pratinjau.
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={tplId}
                        onChange={(e) => handleApplyTemplate(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-[#D3DDD9] rounded-lg bg-white"
                      >
                        <option value="">Pakai template kustom tersimpan ({templateList.filter((t) => t.isiHtml).length})</option>
                        {templateList
                          .filter((t) => t.isiHtml)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.judul} ({t.ukuranKertas || 'A4'})
                            </option>
                          ))}
                      </select>
                      {isOperator && tplId && (
                        <button
                          type="button"
                          onClick={handleDeleteTemplate}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="Hapus template ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border border-[#D3DDD9] rounded-lg overflow-hidden bg-white">
                    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[#F8FAF9] border-b border-[#D3DDD9]">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('bold')}
                      title="Tebal"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('italic')}
                      title="Miring"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('underline')}
                      title="Garis bawah"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <Underline className="w-4 h-4" />
                    </button>
                    <span className="w-px h-5 bg-[#D3DDD9] mx-1" />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('justifyLeft')}
                      title="Rata kiri"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('justifyCenter')}
                      title="Rata tengah"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('justifyRight')}
                      title="Rata kanan"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('justifyFull')}
                      title="Rata kiri-kanan"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <AlignJustify className="w-4 h-4" />
                    </button>
                    <span className="w-px h-5 bg-[#D3DDD9] mx-1" />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('insertUnorderedList')}
                      title="Daftar poin"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => execFmt('insertOrderedList')}
                      title="Daftar nomor"
                      className="p-1.5 text-[#13262A] hover:bg-[#DAEEE7] rounded cursor-pointer"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={syncEditor}
                      onBlur={syncEditor}
                      onPaste={handleEditorPaste}
                      data-placeholder="Ketik isi surat di sini, atau unggah dokumen Word di atas..."
                      className="surat-kustom-editor px-4 py-3 max-h-[420px] overflow-y-auto"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-[#566A6E]">
                      Sisipkan data otomatis (klik di tempat kursor):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PLACEHOLDERS.map((ph) => (
                        <button
                          key={ph.key}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertPlaceholder(ph.key)}
                          title={`{{${ph.key}}}`}
                          className="px-2 py-1 text-[11px] bg-[#E8EFEC] hover:bg-[#DAEEE7] text-[#0B6B58] font-semibold rounded-md cursor-pointer"
                        >
                          {ph.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="w-full py-2 bg-white hover:bg-[#F8FAF9] border border-[#0B6B58]/40 text-[#0B6B58] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan isi ini sebagai template
                  </button>
                </div>
                )}

                {/* Paper Size selector */}
                <div className="p-3 bg-[#F8FAF9] border border-[#D3DDD9] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#13262A] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#0B6B58]" /> Ukuran Kertas:
                    </span>
                    <span className="text-[11px] font-mono text-[#0B6B58] font-bold">
                      {paperSize === 'Legal' ? 'Legal / F4 (21.5 x 35.6 cm)' : 'A4 Portrait (21.0 x 29.7 cm)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaperSize('A4')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                        paperSize === 'A4'
                          ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-xs'
                          : 'bg-white text-[#566A6E] border-[#D3DDD9] hover:bg-gray-50'
                      }`}
                    >
                      A4 Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperSize('Legal')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                        paperSize === 'Legal'
                          ? 'bg-[#0B6B58] text-white border-[#0B6B58] shadow-xs'
                          : 'bg-white text-[#566A6E] border-[#D3DDD9] hover:bg-gray-50'
                      }`}
                    >
                      Legal Portrait / F4
                    </button>
                  </div>
                </div>

                {/* Student Selector if applicable */}
                {(mode === 'kustom' || jenis === 'Surat keterangan aktif siswa' || jenis === 'Surat keterangan pindah siswa') && (
                  <div className="p-3 bg-[#DAEEE7]/60 border border-[#0B6B58]/30 rounded-xl space-y-2 text-xs">
                    <label className="block font-bold text-[#0B6B58]">
                      {mode === 'kustom'
                        ? 'Pilih Siswa (opsional, untuk data otomatis {{nama_siswa}}, {{nisn}}, {{kelas}}):'
                        : 'Pilih Siswa (Data Siswa Masuk Otomatis ke Surat):'}
                    </label>
                    <select
                      value={siswaId}
                      onChange={(e) => handleSelectSiswa(e.target.value, jenis)}
                      className="w-full px-3 py-2 border border-[#D3DDD9] rounded-lg bg-white font-semibold text-[#13262A]"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {siswaList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama} &middot; Kelas {s.kelas} {s.status === 'Mutasi' ? '(Status: Mutasi)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#566A6E] mb-1">Nomor Surat *</label>
                    <input
                      type="text"
                      value={noSurat}
                      onChange={(e) => setNoSurat(e.target.value)}
                      required
                      placeholder="Contoh: 421.2/045/SD/2026"
                      className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#566A6E] mb-1">Tanggal Surat</label>
                    <input
                      type="date"
                      value={tglSurat}
                      onChange={(e) => setTglSurat(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#566A6E] mb-1">Perihal Surat *</label>
                  <input
                    type="text"
                    value={perihal}
                    onChange={(e) => setPerihal(e.target.value)}
                    required
                    placeholder="Contoh: Surat keterangan aktif siswa"
                    className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg font-semibold"
                  />
                </div>

                {mode === 'standar' && (
                  <>
                {jenis !== 'Surat keterangan aktif siswa' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#566A6E] mb-1">Tujuan Surat</label>
                    <textarea
                      value={tujuan}
                      onChange={(e) => setTujuan(e.target.value)}
                      rows={2}
                      placeholder="Kepada Yth. Bapak/Ibu..."
                      className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#566A6E] mb-1">Isi Paragraf Surat</label>
                  <textarea
                    value={isi}
                    onChange={(e) => setIsi(e.target.value)}
                    rows={4}
                    placeholder="Ketik isi surat di sini..."
                    className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#566A6E] mb-1">Kalimat Penutup</label>
                  <textarea
                    value={penutup}
                    onChange={(e) => setPenutup(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg"
                  />
                </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#566A6E] mb-1">Penandatangan</label>
                    <input
                      type="text"
                      value={penandatangan}
                      onChange={(e) => setPenandatangan(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D3DDD9] rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#566A6E] mb-1">NIP Penandatangan</label>
                    <input
                      type="text"
                      value={nipTtd}
                      onChange={(e) => setNipTtd(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border border-[#D3DDD9] rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#D3DDD9]">
                  <button
                    type="button"
                    onClick={handleSaveSurat}
                    className="flex-1 py-2.5 bg-[#0B6B58] hover:bg-[#095747] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Simpan Arsip
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint(paperSize)}
                    className="px-3.5 py-2.5 bg-[#E8EFEC] hover:bg-[#D3DDD9] text-[#13262A] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Cetak
                  </button>
                </div>
              </div>

              {/* Live Preview Side */}
              <div className="p-6 bg-[#E8EFEC] overflow-y-auto max-h-[80vh] flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-3 text-xs text-[#566A6E] max-w-[780px]">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0B6B58]" /> Pratinjau Lembar Surat ({paperSize})
                  </span>
                  <select
                    value={kopOption}
                    onChange={(e) => setKopOption(e.target.value)}
                    className="text-xs px-2.5 py-1 border border-[#D3DDD9] rounded-lg bg-white"
                  >
                    <option value="Dengan kop sekolah">Dengan Kop Resmi</option>
                    <option value="Tanpa kop">Tanpa Kop</option>
                  </select>
                </div>
                <div ref={previewRef} className="w-full">
                  {renderSuratContent({
                    id: 'live_preview',
                    noAgenda: '1',
                    tglSurat,
                    noSurat: noSurat || '421.2/.../SD/2026',
                    jenis,
                    siswaId,
                    tempat,
                    perihal: perihal || '(Perihal belum diisi)',
                    tujuan,
                    pembuka,
                    isi: isi || '(Isi surat belum diisi)',
                    penutup,
                    penandatangan: penandatangan || config.kepsek,
                    nipTtd: nipTtd || config.nipKepsek,
                    jabatanTtd: jabatanTtd || 'Kepala Sekolah',
                    kop: kopOption,
                    ukuranKertas: paperSize,
                    mode,
                    isiHtml,
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL VIEW PREVIEW MODAL */}
      {previewSurat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#D3DDD9] w-full max-w-4xl overflow-hidden my-4">
            <div className="px-6 py-3.5 bg-[#13262A] text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#4CC2A5]" />
                <span className="font-bold text-sm font-display truncate max-w-md">
                  Pratinjau Surat: {previewSurat.perihal}
                </span>
                <span className="text-[10px] font-mono font-bold bg-white/15 text-emerald-300 px-2 py-0.5 rounded border border-white/10">
                  {previewSurat.ukuranKertas || 'A4'} Portrait
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrint(previewSurat.ukuranKertas || paperSize)}
                  className="px-3 py-1.5 text-xs bg-[#0B6B58] hover:bg-[#095747] text-white font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSurat(null)}
                  className="px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto max-h-[80vh] bg-[#E8EFEC] flex justify-center">
              <div ref={modalPreviewRef} className="w-full flex justify-center">
                {renderSuratContent(previewSurat)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
