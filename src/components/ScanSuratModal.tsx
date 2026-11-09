/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  X,
  Check,
  RotateCw,
  RotateCcw,
  Plus,
  Trash2,
  ImageIcon,
  RefreshCw,
  Zap,
  Crop,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  Quad,
  FilterMode,
  detectDocument,
  defaultQuad,
  quadsSimilar,
  warpToCanvas,
  applyFilter,
  rotateCanvas,
  toCanvas,
  loadImageFile,
  refineQuad,
} from '../lib/docScan';
import { buildPdf, PdfPage, OcrLine } from '../lib/pdfBuilder';
import { compressCanvas, jpegToDataUrl, TARGET_BYTES } from '../lib/compress';
import { ocrCanvas, parseSurat, suggestPdfName, SuratFields } from '../lib/suratOcr';

export interface ScanResult {
  pdf: Blob;
  pdfName: string;
  /** JPEG halaman pertama (untuk pratinjau / bukti fisik). */
  thumb: string;
  fields: SuratFields;
  pageCount: number;
  /** Terisi bila pembacaan teks gagal/dilewati; PDF tetap jadi. */
  ocrError?: string;
}

interface Props {
  onClose: () => void;
  onDone: (r: ScanResult) => void;
}

interface ScanPage {
  id: string;
  raw: HTMLCanvasElement;
  quad: Quad;
  cropped: HTMLCanvasElement;
  filter: FilterMode;
  final: HTMLCanvasElement;
  thumb: string;
}

interface Draft {
  raw: HTMLCanvasElement;
  quad: Quad;
  found: boolean;
  /** indeks halaman yang sedang diatur ulang potongannya; null = halaman baru */
  index: number | null;
}

type Step = 'camera' | 'crop' | 'review' | 'process';

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: 'terang', label: 'Terang' },
  { id: 'abu', label: 'Abu-abu' },
  { id: 'bw', label: 'Hitam Putih' },
  { id: 'asli', label: 'Asli' },
];

const mkThumb = (c: HTMLCanvasElement): string => {
  const k = 140 / Math.max(c.width, c.height);
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(c.width * k));
  t.height = Math.max(1, Math.round(c.height * k));
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.7);
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
// Editor potongan: 4 sudut bisa digeser
// ---------------------------------------------------------------------------

const CropEditor: React.FC<{ raw: HTMLCanvasElement; quad: Quad; onChange: (q: Quad) => void }> = ({ raw, quad, onChange }) => {
  const url = useMemo(() => raw.toDataURL('image/jpeg', 0.9), [raw]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ kind: 'c' | 'e'; i: number; start: { x: number; y: number }; q0: Quad } | null>(null);
  const [unit, setUnit] = useState(raw.width / 360);
  const [loupe, setLoupe] = useState<{ x: number; y: number; left: boolean } | null>(null);
  const W = raw.width;
  const H = raw.height;
  const LOUPE = 112;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => {
      const m = svg.getScreenCTM();
      if (m && m.a > 0) setUnit(1 / m.a);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [W, H]);

  const toImg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) };
  };

  // kaca pembesar: gambar area di sekitar titik yang sedang digeser
  useEffect(() => {
    const cv = loupeRef.current;
    if (!cv || !loupe) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const zoom = 3.5;
    const span = (LOUPE / zoom) * unit; // lebar area sumber (piksel gambar asli)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, LOUPE, LOUPE);
    ctx.drawImage(raw, loupe.x - span / 2, loupe.y - span / 2, span, span, 0, 0, LOUPE, LOUPE);
    ctx.beginPath();
    quad.forEach((q, i) => {
      const px = ((q.x - (loupe.x - span / 2)) / span) * LOUPE;
      const py = ((q.y - (loupe.y - span / 2)) / span) * LOUPE;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LOUPE / 2, LOUPE / 2 - 10);
    ctx.lineTo(LOUPE / 2, LOUPE / 2 + 10);
    ctx.moveTo(LOUPE / 2 - 10, LOUPE / 2);
    ctx.lineTo(LOUPE / 2 + 10, LOUPE / 2);
    ctx.stroke();
  }, [loupe, quad, raw, unit]);

  const startDrag = (e: React.PointerEvent, kind: 'c' | 'e', i: number) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { kind, i, start: toImg(e), q0: quad.map((q) => ({ ...q })) as Quad };
    const wr = wrapRef.current?.getBoundingClientRect();
    const p = kind === 'c' ? quad[i] : { x: (quad[i].x + quad[(i + 1) % 4].x) / 2, y: (quad[i].y + quad[(i + 1) % 4].y) / 2 };
    if (wr) setLoupe({ x: p.x, y: p.y, left: e.clientX - wr.left > wr.width / 2 });
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toImg(e);
    let next: Quad;
    let focus = p;
    if (d.kind === 'c') {
      next = d.q0.map((q, i) => (i === d.i ? p : q)) as Quad;
    } else {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      const a = d.i;
      const b = (d.i + 1) % 4;
      next = d.q0.map((q, i) => (i === a || i === b ? { x: clamp(q.x + dx, 0, W), y: clamp(q.y + dy, 0, H) } : q)) as Quad;
      focus = { x: (next[a].x + next[b].x) / 2, y: (next[a].y + next[b].y) / 2 };
    }
    onChange(next);
    const wr = wrapRef.current?.getBoundingClientRect();
    if (wr) setLoupe({ x: focus.x, y: focus.y, left: e.clientX - wr.left > wr.width / 2 });
  };

  const end = () => {
    drag.current = null;
    setLoupe(null);
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" style={{ touchAction: 'none' }}>
        <image href={url} x={0} y={0} width={W} height={H} />
        <polygon
          points={quad.map((q) => `${q.x},${q.y}`).join(' ')}
          fill="rgba(16,185,129,0.14)"
          stroke="#34d399"
          strokeWidth={2 * unit}
          strokeLinejoin="round"
        />
        {/* handle tepi (geser seluruh sisi) */}
        {quad.map((q, i) => {
          const n = quad[(i + 1) % 4];
          return (
            <rect
              key={`e${i}`}
              x={(q.x + n.x) / 2 - 11 * unit}
              y={(q.y + n.y) / 2 - 11 * unit}
              width={22 * unit}
              height={22 * unit}
              rx={6 * unit}
              fill="rgba(255,255,255,0.85)"
              stroke="#059669"
              strokeWidth={2 * unit}
              style={{ cursor: 'move' }}
              onPointerDown={(e) => startDrag(e, 'e', i)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          );
        })}
        {/* handle sudut: ring kecil agar titik sudut kertas tetap terlihat */}
        {quad.map((q, i) => (
          <g key={`c${i}`} onPointerDown={(e) => startDrag(e, 'c', i)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ cursor: 'grab' }}>
            <circle cx={q.x} cy={q.y} r={24 * unit} fill="rgba(0,0,0,0.001)" />
            <circle cx={q.x} cy={q.y} r={11 * unit} fill="rgba(16,185,129,0.25)" stroke="#fff" strokeWidth={2 * unit} />
            <circle cx={q.x} cy={q.y} r={1.8 * unit} fill="#fff" />
          </g>
        ))}
      </svg>
      {loupe && (
        <canvas
          ref={loupeRef}
          width={LOUPE}
          height={LOUPE}
          className="absolute top-2 rounded-full border-2 border-white shadow-xl pointer-events-none bg-black"
          style={{ width: LOUPE, height: LOUPE, [loupe.left ? 'left' : 'right']: 8 }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

export const ScanSuratModal: React.FC<Props> = ({ onClose, onDone }) => {
  const [step, setStep] = useState<Step>('camera');
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [sel, setSel] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const [snapMsg, setSnapMsg] = useState('');

  // kamera
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [camError, setCamError] = useState('');
  const [camReady, setCamReady] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [torch, setTorch] = useState(false);
  const [auto, setAuto] = useState(false);
  const [detected, setDetected] = useState(false);
  const [stability, setStability] = useState(0);
  const autoRef = useRef(false);
  const busyRef = useRef(false);
  const lastQuad = useRef<Quad | null>(null);
  const stable = useRef(0);
  const cooldown = useRef(0);
  const captureRef = useRef<() => void>(() => {});
  const pendingRef = useRef<HTMLCanvasElement[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // pemrosesan
  const [prog, setProg] = useState({ label: '', pct: 0 });
  const skipRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    autoRef.current = auto;
  }, [auto]);

  const startDraft = (raw: HTMLCanvasElement, index: number | null = null, quad?: Quad) => {
    const det = detectDocument(raw, raw.width, raw.height, { refineSide: 1400 });
    setDraft({ raw, quad: quad || (det.found ? det.quad : defaultQuad(raw.width, raw.height)), found: det.found, index });
    setStep('crop');
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busyRef.current) return;
    busyRef.current = true;
    try {
      navigator.vibrate?.(40);
    } catch {
      /* abaikan */
    }
    const raw = toCanvas(v, v.videoWidth, v.videoHeight, 2600);
    startDraft(raw);
  };
  captureRef.current = capture;

  // ---- kamera hidup + deteksi tepi real-time
  useEffect(() => {
    if (step !== 'camera') return;
    let cancelled = false;
    let timer: number | undefined;
    let stream: MediaStream | null = null;
    busyRef.current = false;
    stable.current = 0;
    lastQuad.current = null;
    cooldown.current = Date.now() + 1200;
    setCamError('');
    setCamReady(false);

    const tick = () => {
      const v = videoRef.current;
      const ov = overlayRef.current;
      if (!v || !ov || !v.videoWidth || busyRef.current) return;
      const r = detectDocument(v, v.videoWidth, v.videoHeight, { refineSide: 640 });
      const cw = ov.clientWidth;
      const ch = ov.clientHeight;
      if (ov.width !== cw || ov.height !== ch) {
        ov.width = cw;
        ov.height = ch;
      }
      const k = Math.min(cw / v.videoWidth, ch / v.videoHeight);
      const ox = (cw - v.videoWidth * k) / 2;
      const oy = (ch - v.videoHeight * k) / 2;
      const ctx = ov.getContext('2d')!;
      ctx.clearRect(0, 0, cw, ch);
      if (r.found) {
        ctx.beginPath();
        r.quad.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * k, oy + p.y * k) : ctx.moveTo(ox + p.x * k, oy + p.y * k)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(16,185,129,0.18)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#34d399';
        ctx.stroke();
      }
      const diag = Math.hypot(v.videoWidth, v.videoHeight);
      if (r.found && lastQuad.current && quadsSimilar(r.quad, lastQuad.current, diag * 0.025)) stable.current++;
      else stable.current = r.found ? 1 : 0;
      lastQuad.current = r.found ? r.quad : null;
      setDetected(r.found);
      setStability(Math.min(1, stable.current / 5));
      if (autoRef.current && stable.current >= 5 && Date.now() > cooldown.current) captureRef.current();
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError('Kamera langsung tidak tersedia di browser ini (butuh alamat HTTPS). Gunakan tombol "Kamera HP" atau "Galeri" di bawah.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const caps: any = (track as any).getCapabilities?.() || {};
        setTorchOk(!!caps.torch);
        try {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        } catch {
          /* tidak semua perangkat mendukung */
        }
        setCamReady(true);
        timer = window.setInterval(tick, 250);
      } catch (e: any) {
        const name = e?.name || '';
        setCamError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau pakai tombol "Kamera HP" / "Galeri".'
            : name === 'NotFoundError'
            ? 'Kamera tidak ditemukan di perangkat ini. Gunakan tombol "Galeri" untuk memilih foto surat.'
            : 'Kamera tidak dapat dibuka. Gunakan tombol "Kamera HP" atau "Galeri".'
        );
      }
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      (stream || streamRef.current)?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setTorch(false);
      setDetected(false);
      setStability(0);
    };
  }, [step, facing]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as any] });
      setTorch(!torch);
    } catch {
      /* abaikan */
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      const canv: HTMLCanvasElement[] = [];
      for (const f of list) canv.push(await loadImageFile(f));
      if (!canv.length) return;
      pendingRef.current = canv.slice(1);
      startDraft(canv[0]);
    } catch {
      setCamError('Gagal membaca foto. Coba foto lain.');
    } finally {
      setBusy(false);
    }
  };

  // ---- potong
  const confirmCrop = () => {
    if (!draft) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const cropped = warpToCanvas(draft.raw, draft.quad, 2000);
        if (draft.index !== null) {
          const idx = draft.index;
          setPages((prev) =>
            prev.map((pg, i) => {
              if (i !== idx) return pg;
              const final = applyFilter(cropped, pg.filter);
              return { ...pg, quad: draft.quad, cropped, final, thumb: mkThumb(final) };
            })
          );
          setSel(idx);
          setStep('review');
        } else {
          const filter: FilterMode = pages[0]?.filter || 'terang';
          const final = applyFilter(cropped, filter);
          const pg: ScanPage = {
            id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
            raw: draft.raw,
            quad: draft.quad,
            cropped,
            filter,
            final,
            thumb: mkThumb(final),
          };
          setPages((prev) => [...prev, pg]);
          setSel(pages.length);
          const nextRaw = pendingRef.current.shift();
          if (nextRaw) startDraft(nextRaw);
          else setStep('review');
        }
        setDraft(null);
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const onSnapFail = () => {
    setSnapMsg('Tepi kertas kurang jelas untuk dirapikan otomatis — geser manual.');
    window.setTimeout(() => setSnapMsg(''), 3500);
  };

  const cancelCrop = () => {
    const wasEdit = draft?.index !== null;
    setDraft(null);
    pendingRef.current = [];
    setStep(wasEdit || pages.length ? 'review' : 'camera');
  };

  // ---- ulasan halaman
  const cur = pages[sel];
  const previewUrl = useMemo(() => (cur ? cur.final.toDataURL('image/jpeg', 0.85) : ''), [cur]);

  const setFilter = (f: FilterMode) => {
    setBusy(true);
    setTimeout(() => {
      setPages((prev) =>
        prev.map((pg, i) => {
          if (!applyAll && i !== sel) return pg;
          if (pg.filter === f) return pg;
          const final = applyFilter(pg.cropped, f);
          return { ...pg, filter: f, final, thumb: mkThumb(final) };
        })
      );
      setBusy(false);
    }, 20);
  };

  const rotate = (deg: 90 | 270) => {
    setPages((prev) =>
      prev.map((pg, i) => {
        if (i !== sel) return pg;
        const cropped = rotateCanvas(pg.cropped, deg);
        const final = applyFilter(cropped, pg.filter);
        return { ...pg, cropped, final, thumb: mkThumb(final) };
      })
    );
  };

  const removePage = (i: number) => {
    const newLen = pages.length - 1;
    setPages((prev) => prev.filter((_, k) => k !== i));
    setSel((s) => Math.max(0, Math.min(i < s ? s - 1 : s, newLen - 1)));
    if (newLen <= 0) setStep('camera');
  };

  const movePage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    setPages((prev) => {
      const n = prev.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setSel(j);
  };

  const requestClose = () => {
    if (pages.length && !window.confirm('Buang hasil scan yang belum disimpan?')) return;
    onClose();
  };

  // ---- selesai: baca teks (OCR) + buat PDF
  const finish = async () => {
    if (!pages.length) return;
    setStep('process');
    const n = pages.length;
    let ocrError = '';
    const ocrLines: (OcrLine[] | undefined)[] = [];
    let firstText = '';
    const skipPromise = new Promise<'skip'>((res) => {
      skipRef.current = () => res('skip');
    });
    try {
      for (let i = 0; i < n; i++) {
        const pg = pages[i];
        setProg({ label: `Membaca halaman ${i + 1} dari ${n}…`, pct: i / n });
        let lines: OcrLine[] | undefined;
        if (!ocrError) {
          try {
            const r = await Promise.race([
              ocrCanvas(applyFilter(pg.cropped, 'abu'), (info) => {
                const st = info.status || '';
                const label = /tesseract|core|initializ/i.test(st)
                  ? 'Menyiapkan mesin baca teks (pertama kali agak lama)…'
                  : /language|traineddata/i.test(st)
                  ? 'Mengunduh data bahasa Indonesia…'
                  : `Membaca halaman ${i + 1} dari ${n}…`;
                setProg({ label, pct: (i + (/recogniz/i.test(st) ? info.progress : 0)) / n });
              }),
              skipPromise,
            ]);
            if (r === 'skip') {
              ocrError = 'Pembacaan teks dilewati.';
            } else {
              lines = r.lines;
              if (i === 0) firstText = r.text;
            }
          } catch (e: any) {
            ocrError = e?.message || 'Pembacaan teks gagal.';
          }
        }
        setProg({ label: 'Menyusun halaman PDF…', pct: (i + 0.9) / n });
        ocrLines.push(lines);
      }
      // Batas total PDF 200 KB: anggaran per halaman dihitung setelah dikurangi struktur PDF + lapisan teks OCR.
      setProg({ label: 'Mengompres PDF (maks. 200 KB)…', pct: 0.95 });
      const fields = firstText ? parseSurat(firstText) : {};
      const pdfName = suggestPdfName(fields);
      const textBytes = ocrLines.reduce((t, ls) => t + (ls || []).reduce((a, l) => a + (l.text?.length || 0) + 45, 0), 0);
      const overhead = 1800 + n * 700 + textBytes;
      let share = Math.max(8 * 1024, (TARGET_BYTES * 0.985 - overhead) / n);
      let bytes: Uint8Array = new Uint8Array(0);
      for (let attempt = 0; attempt < 5; attempt++) {
        const outPages: PdfPage[] = [];
        for (let i = 0; i < n; i++) {
          const src = pages[i].final;
          const c = await compressCanvas(src, share);
          const k = c.w / src.width;
          const lines = ocrLines[i]?.map((l) => ({ ...l, x0: l.x0 * k, y0: l.y0 * k, x1: l.x1 * k, y1: l.y1 * k }));
          outPages.push({ jpeg: c.bytes, w: c.w, h: c.h, lines });
        }
        bytes = buildPdf(outPages, { title: pdfName.replace(/\.pdf$/i, ''), subject: fields.perihal || '' });
        if (bytes.length <= TARGET_BYTES) break;
        share *= (TARGET_BYTES * 0.97) / bytes.length;
      }
      const pdf = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: 'application/pdf' });
      const thumb = await jpegToDataUrl((await compressCanvas(pages[0].final, TARGET_BYTES, { startSide: 1400 })).bytes);
      onDone({ pdf, pdfName, thumb, fields, pageCount: n, ocrError: ocrError || undefined });
    } catch (e: any) {
      setStep('review');
      setCamError(e?.message || 'Gagal membuat PDF.');
    } finally {
      skipRef.current = null;
    }
  };

  // ---------------------------------------------------------------------------

  const hiddenInputs = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={nativeRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-neutral-950 text-white flex flex-col">
      {hiddenInputs}

      {/* Bilah atas */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 shrink-0">
        <div className="flex items-center gap-2 font-bold text-sm">
          <FileText className="w-4 h-4 text-emerald-400" />
          Scan Surat Masuk
          {pages.length > 0 && <span className="text-[11px] font-semibold bg-emerald-600 rounded-full px-2 py-0.5">{pages.length} halaman</span>}
        </div>
        <button type="button" onClick={requestClose} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Tutup">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ===== KAMERA ===== */}
      {step === 'camera' && (
        <>
          <div className="relative flex-1 min-h-0 bg-black">
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-contain" />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            {!camReady && !camError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-300 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Membuka kamera…
              </div>
            )}
            {camError && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-sm text-center text-sm text-amber-200 bg-black/70 rounded-xl p-4 border border-amber-500/40">{camError}</div>
              </div>
            )}
            {camReady && (
              <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
                <span
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                    detected ? 'bg-emerald-600 text-white' : 'bg-black/60 text-neutral-200'
                  }`}
                >
                  {detected
                    ? auto
                      ? stability >= 1
                        ? 'Mengambil foto…'
                        : 'Surat terdeteksi — tahan sebentar'
                      : 'Dokumen terdeteksi — tekan SCAN atau Start Auto-Scan'
                    : 'Letakkan surat di permukaan kontras, pastikan 4 sudut kertas terlihat'}
                </span>
              </div>
            )}
            {detected && auto && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-40 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${stability * 100}%` }} />
              </div>
            )}
          </div>

          <div className="shrink-0 bg-black/80 px-4 pt-3 pb-5 space-y-3">
            <div className="flex items-center justify-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setAuto((a) => !a)}
                className={`px-3 py-1 rounded-full font-semibold cursor-pointer ${auto ? 'bg-emerald-600' : 'bg-white/15'}`}
              >
                {auto ? '■ Stop Auto-Scan' : '▶ Start Auto-Scan'}
              </button>
              {torchOk && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`px-3 py-1 rounded-full font-semibold flex items-center gap-1 cursor-pointer ${torch ? 'bg-amber-500 text-black' : 'bg-white/15'}`}
                >
                  <Zap className="w-3 h-3" /> Lampu
                </button>
              )}
              <button
                type="button"
                onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
                className="px-3 py-1 rounded-full bg-white/15 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Balik kamera
              </button>
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto">
              <div className="flex flex-col items-center gap-1 w-24">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                  title="Pilih foto dari galeri"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <span className="text-[10px] text-neutral-300">Galeri</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={capture}
                  disabled={!camReady || busy}
                  className={`w-[72px] h-[72px] rounded-full border-4 flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95 transition ${
                    detected ? 'border-emerald-400 bg-emerald-500/20' : 'border-white bg-white/10'
                  }`}
                  aria-label="Scan"
                >
                  <span className={`w-14 h-14 rounded-full ${detected ? 'bg-emerald-400' : 'bg-white'}`} />
                </button>
                <span className="text-[10px] font-bold tracking-widest text-neutral-200">SCAN</span>
              </div>

              <div className="flex flex-col items-center gap-1 w-24">
                {pages.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep('review')}
                      className="h-11 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Selesai
                    </button>
                    <span className="text-[10px] text-neutral-300">{pages.length} halaman</span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => nativeRef.current?.click()}
                      className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                      title="Buka aplikasi kamera bawaan HP"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                    <span className="text-[10px] text-neutral-300">Kamera HP</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== POTONG ===== */}
      {step === 'crop' && draft && (
        <>
          <div className="px-4 py-2 text-center text-xs text-neutral-300 shrink-0">
            {draft.found ? 'Tepi surat terdeteksi otomatis.' : 'Tepi surat tidak terdeteksi jelas.'} Geser titik sudut (kaca pembesar muncul) atau kotak putih di tengah sisi agar pas dengan tepi kertas, lalu tekan Potong.
            {snapMsg && <div className="mt-1 text-amber-300 font-semibold">{snapMsg}</div>}
          </div>
          <div className="flex-1 min-h-0 px-3 pb-2">
            <CropEditor raw={draft.raw} quad={draft.quad} onChange={(q) => setDraft((d) => (d ? { ...d, quad: q } : d))} />
          </div>
          <div className="shrink-0 bg-black/80 px-4 py-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={cancelCrop} className="px-4 py-2 rounded-xl bg-white/15 text-xs font-semibold cursor-pointer">
              {draft.index !== null ? 'Batal' : 'Ulangi'}
            </button>
            <button
              type="button"
              onClick={() => {
                const det = detectDocument(draft.raw, draft.raw.width, draft.raw.height, { refineSide: 1400 });
                setDraft({ ...draft, quad: det.found ? det.quad : defaultQuad(draft.raw.width, draft.raw.height), found: det.found });
              }}
              className="px-4 py-2 rounded-xl bg-white/15 text-xs font-semibold cursor-pointer"
            >
              Deteksi ulang
            </button>
            <button
              type="button"
              onClick={() => {
                const r = refineQuad(draft.raw, draft.raw.width, draft.raw.height, draft.quad, 1600);
                if (r) setDraft({ ...draft, quad: r });
                else onSnapFail();
              }}
              className="px-4 py-2 rounded-xl bg-white/15 text-xs font-semibold cursor-pointer"
              title="Tempelkan garis ke tepi kertas terdekat"
            >
              Rapikan tepi
            </button>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, quad: defaultQuad(draft.raw.width, draft.raw.height, 0.01) })}
              className="px-4 py-2 rounded-xl bg-white/15 text-xs font-semibold cursor-pointer"
            >
              Seluruh foto
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crop className="w-4 h-4" />} Potong
            </button>
          </div>
        </>
      )}

      {/* ===== ULASAN ===== */}
      {step === 'review' && cur && (
        <>
          {camError && <div className="px-4 py-2 text-xs text-amber-200 bg-amber-900/40 shrink-0">{camError}</div>}
          <div className="flex-1 min-h-0 flex items-center justify-center p-3 bg-neutral-900 relative">
            <img src={previewUrl} alt={`Halaman ${sel + 1}`} className="max-w-full max-h-full object-contain shadow-2xl" />
            {busy && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          <div className="shrink-0 bg-black/85 px-3 pt-3 pb-4 space-y-3">
            {/* thumbnail */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {pages.map((pg, i) => (
                <div key={pg.id} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setSel(i)}
                    className={`block w-12 h-16 rounded-md overflow-hidden border-2 cursor-pointer ${i === sel ? 'border-emerald-400' : 'border-white/20'}`}
                  >
                    <img src={pg.thumb} alt="" className="w-full h-full object-cover" />
                  </button>
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-black text-[9px] font-bold flex items-center justify-center border border-white/30">{i + 1}</span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setStep('camera')}
                className="shrink-0 w-12 h-16 rounded-md border-2 border-dashed border-white/30 flex flex-col items-center justify-center text-[9px] gap-0.5 hover:bg-white/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </div>

            {/* filter */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${cur.filter === f.id ? 'bg-emerald-600' : 'bg-white/15 hover:bg-white/25'}`}
                >
                  {f.label}
                </button>
              ))}
              <label className="flex items-center gap-1 text-[10px] text-neutral-300 ml-1 cursor-pointer">
                <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} /> semua halaman
              </label>
            </div>

            {/* aksi halaman */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
              <button type="button" onClick={() => rotate(270)} className="px-3 py-1.5 rounded-lg bg-white/15 flex items-center gap-1 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Putar
              </button>
              <button type="button" onClick={() => rotate(90)} className="px-3 py-1.5 rounded-lg bg-white/15 flex items-center gap-1 cursor-pointer">
                <RotateCw className="w-3.5 h-3.5" /> Putar
              </button>
              <button
                type="button"
                onClick={() => startDraft(cur.raw, sel, cur.quad)}
                className="px-3 py-1.5 rounded-lg bg-white/15 flex items-center gap-1 cursor-pointer"
              >
                <Crop className="w-3.5 h-3.5" /> Atur potongan
              </button>
              {pages.length > 1 && (
                <>
                  <button type="button" onClick={() => movePage(sel, -1)} disabled={sel === 0} className="px-3 py-1.5 rounded-lg bg-white/15 disabled:opacity-30 cursor-pointer">
                    ← Geser
                  </button>
                  <button type="button" onClick={() => movePage(sel, 1)} disabled={sel === pages.length - 1} className="px-3 py-1.5 rounded-lg bg-white/15 disabled:opacity-30 cursor-pointer">
                    Geser →
                  </button>
                </>
              )}
              <button type="button" onClick={() => removePage(sel)} className="px-3 py-1.5 rounded-lg bg-rose-600/80 flex items-center gap-1 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            </div>

            <button
              type="button"
              onClick={finish}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" /> Selesai: baca surat &amp; buat PDF ({pages.length} hal.)
            </button>
          </div>
        </>
      )}

      {/* ===== PROSES ===== */}
      {step === 'process' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          <div className="text-sm font-semibold">{prog.label || 'Memproses…'}</div>
          <div className="w-64 h-2 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.round(clamp(prog.pct, 0, 1) * 100)}%` }} />
          </div>
          <p className="text-[11px] text-neutral-400 max-w-xs">
            Teks surat dibaca di perangkat ini untuk mengisi nomor surat, tanggal, perihal, dan pengirim secara otomatis.
          </p>
          <button
            type="button"
            onClick={() => skipRef.current?.()}
            className="text-[11px] underline text-neutral-300 hover:text-white cursor-pointer"
          >
            Lewati pembacaan teks (langsung buat PDF)
          </button>
        </div>
      )}
    </div>
  );
};
