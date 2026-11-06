/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Impor dokumen Word (.docx) menjadi HTML sederhana untuk surat keluar kustom.
 * Tanpa library tambahan: .docx adalah berkas zip berisi XML, dibaca langsung di browser.
 * Yang dibawa: paragraf, rata teks, tebal/miring/garis bawah, ukuran & jenis huruf, indentasi,
 * penomoran/bullet, tabel (termasuk gabung sel), dan jeda halaman.
 * Yang tidak dibawa: header/footer Word (kop gunakan kop resmi aplikasi), gambar, kotak teks.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const MAX_DOCX_BYTES = 5 * 1024 * 1024;

/* ------------------------------ ZIP reader ------------------------------ */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Peramban ini belum mendukung pembacaan Word. Perbarui Chrome/Edge/Safari ke versi terbaru.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(buf: ArrayBuffer, wanted: string[]): Promise<Record<string, string>> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Berkas ini bukan dokumen Word (.docx) yang valid.');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  const out: Record<string, string> = {};
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted.includes(name)) continue;
    const lhName = dv.getUint16(lho + 26, true);
    const lhExtra = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lhName + lhExtra;
    const raw = u8.subarray(start, start + csize);
    const bytes = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (!bytes) throw new Error('Format kompresi dokumen Word tidak didukung.');
    out[name] = dec.decode(bytes);
  }
  return out;
}

/* ------------------------------ XML helpers ------------------------------ */

const parseXml = (xml: string): Document => {
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('Isi dokumen Word tidak dapat dibaca.');
  return d;
};

const kids = (el: Element | null | undefined, local: string): Element[] =>
  el ? Array.from(el.children).filter((c) => c.localName === local && c.namespaceURI === W) : [];
const kid = (el: Element | null | undefined, local: string): Element | null => kids(el, local)[0] || null;
const wattr = (el: Element | null | undefined, name: string): string | null =>
  el ? el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name) : null;
const onOff = (el: Element | null): boolean | undefined => {
  if (!el) return undefined;
  const v = wattr(el, 'val');
  return !(v === '0' || v === 'false' || v === 'off');
};
const num = (v: string | null): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

interface Props {
  jc?: string;
  indLeft?: number;
  indFirst?: number;
  indHanging?: number;
  before?: number;
  after?: number;
  line?: number;
  numId?: string;
  ilvl?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  strike?: boolean;
  caps?: boolean;
  sz?: number;
  font?: string;
  color?: string;
  vert?: string;
}

function readPPr(pPr: Element | null): Props {
  const o: Props = {};
  if (!pPr) return o;
  const jc = wattr(kid(pPr, 'jc'), 'val');
  if (jc) o.jc = jc;
  const ind = kid(pPr, 'ind');
  if (ind) {
    o.indLeft = num(wattr(ind, 'left') ?? wattr(ind, 'start'));
    o.indFirst = num(wattr(ind, 'firstLine'));
    o.indHanging = num(wattr(ind, 'hanging'));
  }
  const np = kid(pPr, 'numPr');
  if (np) {
    const nid = wattr(kid(np, 'numId'), 'val');
    if (nid) o.numId = nid;
    const il = num(wattr(kid(np, 'ilvl'), 'val'));
    if (il !== undefined) o.ilvl = il;
  }
  const sp = kid(pPr, 'spacing');
  if (sp) {
    o.before = num(wattr(sp, 'before'));
    o.after = num(wattr(sp, 'after'));
    if ((wattr(sp, 'lineRule') || 'auto') === 'auto') o.line = num(wattr(sp, 'line'));
  }
  return o;
}

function readRPr(rPr: Element | null): Props {
  const o: Props = {};
  if (!rPr) return o;
  const b = onOff(kid(rPr, 'b'));
  if (b !== undefined) o.b = b;
  const i = onOff(kid(rPr, 'i'));
  if (i !== undefined) o.i = i;
  const uEl = kid(rPr, 'u');
  if (uEl) o.u = wattr(uEl, 'val') !== 'none';
  const st = onOff(kid(rPr, 'strike'));
  if (st !== undefined) o.strike = st;
  const caps = onOff(kid(rPr, 'caps'));
  if (caps !== undefined) o.caps = caps;
  const sz = num(wattr(kid(rPr, 'sz'), 'val'));
  if (sz) o.sz = sz / 2;
  const f = kid(rPr, 'rFonts');
  const font = wattr(f, 'ascii') || wattr(f, 'hAnsi');
  if (font) o.font = font;
  const c = wattr(kid(rPr, 'color'), 'val');
  if (c && /^[0-9a-fA-F]{6}$/.test(c) && c.toLowerCase() !== '000000') o.color = '#' + c;
  const va = wattr(kid(rPr, 'vertAlign'), 'val');
  if (va) o.vert = va;
  return o;
}

const merge = (...list: Props[]): Props => {
  const out: Props = {};
  for (const p of list) for (const [k, v] of Object.entries(p)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
};

/* ------------------------------ Numbering ------------------------------ */

interface NumLevel {
  fmt: string;
  text: string;
  left?: number;
  hanging?: number;
}

function toRoman(n: number): string {
  const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let r = '';
  for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
  return r;
}
const toAlpha = (n: number): string => {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
};
function fmtNumber(fmt: string, n: number): string {
  switch (fmt) {
    case 'lowerLetter': return toAlpha(n);
    case 'upperLetter': return toAlpha(n).toUpperCase();
    case 'lowerRoman': return toRoman(n);
    case 'upperRoman': return toRoman(n).toUpperCase();
    case 'decimalZero': return String(n).padStart(2, '0');
    default: return String(n);
  }
}

/* ------------------------------ Converter ------------------------------ */

const NB = '\u00a0';

export interface DocxResult {
  html: string;
  /** Peringatan untuk pengguna (mis. gambar tidak ikut). */
  notes: string[];
}

export async function docxToHtml(buf: ArrayBuffer): Promise<DocxResult> {
  const files = await readZip(buf, ['word/document.xml', 'word/styles.xml', 'word/numbering.xml']);
  if (!files['word/document.xml']) throw new Error('Berkas ini bukan dokumen Word (.docx) yang valid.');
  const notes: string[] = [];

  // ----- styles -----
  const pStyles: Record<string, { based?: string; p: Props; r: Props }> = {};
  let defP: Props = {};
  let defR: Props = {};
  if (files['word/styles.xml']) {
    const sdoc = parseXml(files['word/styles.xml']);
    const root = sdoc.documentElement;
    const dd = kid(root, 'docDefaults');
    defR = readRPr(kid(kid(dd, 'rPrDefault'), 'rPr'));
    defP = readPPr(kid(kid(dd, 'pPrDefault'), 'pPr'));
    for (const st of kids(root, 'style')) {
      const id = wattr(st, 'styleId');
      if (!id) continue;
      pStyles[id] = {
        based: wattr(kid(st, 'basedOn'), 'val') || undefined,
        p: readPPr(kid(st, 'pPr')),
        r: readRPr(kid(st, 'rPr')),
      };
    }
  }
  const resolveStyle = (id: string | null, seen = 0): { p: Props; r: Props } => {
    if (!id || !pStyles[id] || seen > 8) return { p: {}, r: {} };
    const base = resolveStyle(pStyles[id].based || null, seen + 1);
    return { p: merge(base.p, pStyles[id].p), r: merge(base.r, pStyles[id].r) };
  };
  const normal = resolveStyle(pStyles['Normal'] ? 'Normal' : null);
  const baseP = merge(defP, normal.p);
  const baseR = merge(defR, normal.r);

  // ----- numbering -----
  const absLevels: Record<string, Record<number, NumLevel>> = {};
  const numToAbs: Record<string, string> = {};
  const numOverride: Record<string, Record<number, number>> = {};
  if (files['word/numbering.xml']) {
    const ndoc = parseXml(files['word/numbering.xml']);
    const root = ndoc.documentElement;
    for (const an of kids(root, 'abstractNum')) {
      const id = wattr(an, 'abstractNumId');
      if (!id) continue;
      absLevels[id] = {};
      for (const lvl of kids(an, 'lvl')) {
        const il = num(wattr(lvl, 'ilvl')) ?? 0;
        const ind = kid(kid(lvl, 'pPr'), 'ind');
        absLevels[id][il] = {
          fmt: wattr(kid(lvl, 'numFmt'), 'val') || 'decimal',
          text: wattr(kid(lvl, 'lvlText'), 'val') || '%1.',
          left: num(wattr(ind, 'left') ?? wattr(ind, 'start')),
          hanging: num(wattr(ind, 'hanging')),
        };
      }
    }
    for (const n of kids(root, 'num')) {
      const id = wattr(n, 'numId');
      const abs = wattr(kid(n, 'abstractNumId'), 'val');
      if (id && abs) numToAbs[id] = abs;
      if (id) {
        numOverride[id] = {};
        for (const ov of kids(n, 'lvlOverride')) {
          const il = num(wattr(ov, 'ilvl')) ?? 0;
          const st = num(wattr(kid(ov, 'startOverride'), 'val'));
          if (st !== undefined) numOverride[id][il] = st;
        }
      }
    }
  }
  const counters: Record<string, number[]> = {};

  // ----- build -----
  const doc = parseXml(files['word/document.xml']);
  const body = kid(doc.documentElement, 'body');
  if (!body) throw new Error('Dokumen Word kosong.');
  const root = document.createElement('div');
  const rootStyle: string[] = [];
  if (baseR.font) rootStyle.push(`font-family:'${baseR.font.replace(/['"]/g, '')}',serif`);
  if (baseR.sz) rootStyle.push(`font-size:${baseR.sz}pt`);
  root.setAttribute('style', rootStyle.join(';'));
  let hasImage = false;

  const pt = (tw?: number) => (tw ? `${Math.round((tw / 20) * 10) / 10}pt` : '');

  const buildRun = (r: Element, base: Props, parent: HTMLElement) => {
    const rStyleId = wattr(kid(kid(r, 'rPr'), 'rStyle'), 'val');
    const props = merge(base, resolveStyle(rStyleId).r, readRPr(kid(r, 'rPr')));
    const span = document.createElement('span');
    const css: string[] = [];
    if (props.b) css.push('font-weight:bold');
    if (props.i) css.push('font-style:italic');
    const deco = [props.u ? 'underline' : '', props.strike ? 'line-through' : ''].filter(Boolean).join(' ');
    if (deco) css.push(`text-decoration:${deco}`);
    if (props.caps) css.push('text-transform:uppercase');
    if (props.sz && props.sz !== baseR.sz) css.push(`font-size:${props.sz}pt`);
    if (props.font && props.font !== baseR.font) css.push(`font-family:'${props.font.replace(/['"]/g, '')}',serif`);
    if (props.color) css.push(`color:${props.color}`);
    if (props.vert === 'superscript') css.push('vertical-align:super;font-size:smaller');
    if (props.vert === 'subscript') css.push('vertical-align:sub;font-size:smaller');
    if (css.length) span.setAttribute('style', css.join(';'));
    let any = false;
    for (const c of Array.from(r.children)) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === 't' || c.localName === 'instrText') {
        if (c.localName === 'instrText') continue;
        span.appendChild(document.createTextNode((c.textContent || '').replace(/ {2}/g, ' ' + NB)));
        any = true;
      } else if (c.localName === 'tab') {
        span.appendChild(document.createTextNode(NB.repeat(8)));
        any = true;
      } else if (c.localName === 'br') {
        if (wattr(c, 'type') === 'page') {
          const pb = document.createElement('div');
          pb.setAttribute('style', 'page-break-after:always');
          parent.appendChild(span);
          parent.appendChild(pb);
          return;
        }
        span.appendChild(document.createElement('br'));
        any = true;
      } else if (c.localName === 'noBreakHyphen') {
        span.appendChild(document.createTextNode('\u2011'));
        any = true;
      } else if (c.localName === 'drawing' || c.localName === 'pict') {
        hasImage = true;
      }
    }
    if (any) parent.appendChild(span);
  };

  const buildInline = (container: Element, base: Props, parent: HTMLElement) => {
    for (const c of Array.from(container.children)) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === 'r') buildRun(c, base, parent);
      else if (['hyperlink', 'smartTag', 'ins', 'fldSimple', 'sdt', 'sdtContent', 'customXml'].includes(c.localName)) {
        buildInline(c, base, parent);
      }
    }
  };

  const buildParagraph = (p: Element, parent: HTMLElement) => {
    const pPrEl = kid(p, 'pPr');
    const styleId = wattr(kid(pPrEl, 'pStyle'), 'val');
    const st = resolveStyle(styleId);
    const props = merge(baseP, st.p, readPPr(pPrEl));
    const runBase = st.r;
    const el = document.createElement('p');
    const css: string[] = [];
    const jcMap: Record<string, string> = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify', left: 'left', start: 'left' };
    if (props.jc && jcMap[props.jc]) css.push(`text-align:${jcMap[props.jc]}`);
    let left = props.indLeft;
    let first = props.indFirst;
    let hanging = props.indHanging;

    // penomoran / bullet (dibuat manual agar tetap sama saat disunting dan dicetak)
    let label = '';
    if (props.numId) {
      const numId = props.numId;
      const il = props.ilvl ?? 0;
      const abs = numId ? numToAbs[numId] : undefined;
      const lvl = abs ? absLevels[abs]?.[il] : undefined;
      if (numId && numId !== '0' && lvl) {
        const key = numId;
        counters[key] = counters[key] || [];
        const cur = counters[key];
        for (let k = il + 1; k < cur.length; k++) cur[k] = 0;
        cur[il] = (cur[il] ?? (numOverride[numId]?.[il] ?? 1) - 1) + 1;
        if (lvl.fmt === 'bullet') {
          label = '\u2022';
        } else {
          label = lvl.text.replace(/%(\d)/g, (_m, d) => {
            const lv = Number(d) - 1;
            const lf = absLevels[abs!]?.[lv]?.fmt || 'decimal';
            return fmtNumber(lf, cur[lv] ?? 1);
          });
        }
        if (left === undefined) left = lvl.left;
        if (hanging === undefined && first === undefined) hanging = lvl.hanging ?? 360;
      }
    }
    if (left) css.push(`margin-left:${pt(left)}`);
    if (hanging) css.push(`text-indent:-${pt(hanging)}`);
    else if (first) css.push(`text-indent:${pt(first)}`);
    css.push(`margin-top:${props.before ? pt(props.before) : '0'}`);
    css.push(`margin-bottom:${props.after ? pt(props.after) : '0'}`);
    if (props.line && props.line > 0) css.push(`line-height:${Math.round((props.line / 240) * 100) / 100}`);
    el.setAttribute('style', css.join(';'));

    if (label) {
      const lab = document.createElement('span');
      lab.textContent = label + NB.repeat(2);
      el.appendChild(lab);
    }
    buildInline(p, runBase, el);
    if (!el.textContent && !el.querySelector('br')) {
      el.appendChild(document.createElement('br'));
    }
    parent.appendChild(el);
  };

  const hasBorder = (el: Element | null): boolean => {
    if (!el) return false;
    return Array.from(el.children).some((b) => {
      const v = wattr(b, 'val');
      return v && v !== 'nil' && v !== 'none';
    });
  };

  const buildTable = (tbl: Element, parent: HTMLElement) => {
    const tblPr = kid(tbl, 'tblPr');
    const styleName = wattr(kid(tblPr, 'tblStyle'), 'val') || '';
    const tableBorders = hasBorder(kid(tblPr, 'tblBorders')) || /grid/i.test(styleName);
    const t = document.createElement('table');
    t.setAttribute('style', 'border-collapse:collapse;width:100%;table-layout:fixed');
    const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => num(wattr(g, 'w')) || 0);
    const totalW = grid.reduce((a, b) => a + b, 0);
    if (totalW > 0) {
      const cg = document.createElement('colgroup');
      grid.forEach((w) => {
        const c = document.createElement('col');
        c.setAttribute('style', `width:${Math.round((w / totalW) * 1000) / 10}%`);
        cg.appendChild(c);
      });
      t.appendChild(cg);
    }
    const rows = kids(tbl, 'tr');
    // rowspan dari vMerge
    const spans = new Map<string, number>();
    const colOf: number[][] = rows.map(() => []);
    const lastRestart: Record<number, { r: number; c: number }> = {};
    rows.forEach((tr, ri) => {
      let col = 0;
      for (const tc of kids(tr, 'tc')) {
        const tcPr = kid(tc, 'tcPr');
        const gs = num(wattr(kid(tcPr, 'gridSpan'), 'val')) || 1;
        const vm = kid(tcPr, 'vMerge');
        if (vm) {
          if (wattr(vm, 'val') === 'restart') {
            lastRestart[col] = { r: ri, c: col };
            spans.set(`${ri}:${col}`, 1);
          } else if (lastRestart[col]) {
            const k = `${lastRestart[col].r}:${col}`;
            spans.set(k, (spans.get(k) || 1) + 1);
          }
        }
        colOf[ri].push(col);
        col += gs;
      }
    });
    const tb = document.createElement('tbody');
    rows.forEach((tr, ri) => {
      const row = document.createElement('tr');
      kids(tr, 'tc').forEach((tc, ci) => {
        const tcPr = kid(tc, 'tcPr');
        const col = colOf[ri][ci];
        const vm = kid(tcPr, 'vMerge');
        if (vm && wattr(vm, 'val') !== 'restart') return; // sel lanjutan, sudah tercakup rowspan
        const cell = document.createElement('td');
        const gs = num(wattr(kid(tcPr, 'gridSpan'), 'val')) || 1;
        if (gs > 1) cell.setAttribute('colspan', String(gs));
        const rs = spans.get(`${ri}:${col}`) || 1;
        if (rs > 1) cell.setAttribute('rowspan', String(rs));
        const va = ({ center: 'middle', bottom: 'bottom' } as Record<string, string>)[wattr(kid(tcPr, 'vAlign'), 'val') || ''] || 'top';
        const css = ['padding:2px 5px', `vertical-align:${va}`];
        const cellBorder = hasBorder(kid(tcPr, 'tcBorders'));
        if (tableBorders || cellBorder) css.push('border:1px solid #000');
        cell.setAttribute('style', css.join(';'));
        buildBlocks(tc, cell);
        if (!cell.childNodes.length) cell.appendChild(document.createElement('br'));
        row.appendChild(cell);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    parent.appendChild(t);
    // beri jarak setelah tabel agar paragraf berikutnya tidak menempel
    const gap = document.createElement('p');
    gap.setAttribute('style', 'margin:0');
    gap.appendChild(document.createElement('br'));
    if (parent === root) parent.appendChild(gap);
  };

  const buildBlocks = (container: Element, parent: HTMLElement) => {
    for (const c of Array.from(container.children)) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === 'p') buildParagraph(c, parent);
      else if (c.localName === 'tbl') buildTable(c, parent);
      else if (c.localName === 'sdt') buildBlocks(kid(c, 'sdtContent') || c, parent);
    }
  };

  buildBlocks(body, root);
  if (hasImage) notes.push('Gambar di dalam dokumen Word tidak ikut diimpor. Untuk kop surat, gunakan "Dengan Kop Resmi".');
  if (!(root.textContent || '').trim()) throw new Error('Dokumen Word ini tidak berisi teks.');
  const wrap = document.createElement('div');
  if (rootStyle.length) wrap.setAttribute('style', root.getAttribute('style') || '');
  wrap.innerHTML = root.innerHTML;
  return { html: sanitizeLetterHtml(wrap.outerHTML), notes };
}

/* ------------------------------ Sanitizer ------------------------------ */

const ALLOWED_TAGS = new Set([
  'p', 'div', 'span', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'font',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'noscript', 'template', 'svg', 'math', 'form', 'textarea', 'select', 'button', 'input', 'img', 'video', 'audio']);
const ALLOWED_STYLE = new Set([
  'text-align', 'font-weight', 'font-style', 'text-decoration', 'text-transform', 'font-size', 'font-family',
  'color', 'margin-left', 'margin-top', 'margin-bottom', 'text-indent', 'line-height', 'width', 'vertical-align',
  'border', 'border-collapse', 'table-layout', 'padding', 'page-break-after', 'page-break-before', 'page-break-inside',
]);
const SAFE_VALUE = /^[#\w\s.,%'"\-()]*$/;

/** Bersihkan HTML (hasil impor Word atau paste) agar hanya berisi pemformatan surat yang aman. */
export function sanitizeLetterHtml(html: string): string {
  const src = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const out = document.createElement('div');

  const cleanStyle = (style: string): string => {
    const keep: string[] = [];
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const val = decl.slice(i + 1).trim();
      if (ALLOWED_STYLE.has(prop) && SAFE_VALUE.test(val) && !/url\(|expression|javascript/i.test(val)) {
        keep.push(`${prop}:${val}`);
      }
    }
    return keep.join(';');
  };

  const walk = (from: Node, to: HTMLElement) => {
    from.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(n.textContent || ''));
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) return;
      if (!ALLOWED_TAGS.has(tag)) {
        walk(el, to); // tag tidak dikenal: ambil isinya saja
        return;
      }
      const c = document.createElement(tag);
      const st = el.getAttribute('style');
      if (st) {
        const cs = cleanStyle(st);
        if (cs) c.setAttribute('style', cs);
      }
      if (tag === 'td' || tag === 'th') {
        const cs = parseInt(el.getAttribute('colspan') || '', 10);
        const rs = parseInt(el.getAttribute('rowspan') || '', 10);
        if (cs > 1 && cs < 50) c.setAttribute('colspan', String(cs));
        if (rs > 1 && rs < 200) c.setAttribute('rowspan', String(rs));
      }
      walk(el, c);
      to.appendChild(c);
    });
  };
  walk(src, out);
  return out.innerHTML;
}

/** Teks polos dari HTML (untuk pencarian arsip). */
export function htmlToPlainText(html: string): string {
  const d = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return (d.body.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
}
