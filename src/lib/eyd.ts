/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilitas pemformatan nama & gelar sesuai EYD (Ejaan Yang Disempurnakan).
 */

const PREFIX_TITLES: Record<string, string> = {
  H: 'H.',
  HJ: 'Hj.',
  KH: 'K.H.',
  PROF: 'Prof.',
  DRS: 'Drs.',
  DRA: 'Dra.',
  IR: 'Ir.',
  NS: 'Ns.',
  APT: 'Apt.',
  DRG: 'drg.',
  UST: 'Ust.',
};

const SUFFIX_DEGREES: Record<string, string> = {
  SPD: 'S.Pd.',
  SPDI: 'S.Pd.I.',
  SPDSD: 'S.Pd.SD.',
  SPDAUD: 'S.Pd.AUD.',
  SPDK: 'S.Pd.K.',
  SPDH: 'S.Pd.H.',
  MPD: 'M.Pd.',
  MPDI: 'M.Pd.I.',
  MPDK: 'M.Pd.K.',
  SAG: 'S.Ag.',
  MAG: 'M.Ag.',
  SSI: 'S.Si.',
  MSI: 'M.Si.',
  SKOM: 'S.Kom.',
  MKOM: 'M.Kom.',
  SE: 'S.E.',
  ME: 'M.E.',
  MM: 'M.M.',
  SM: 'S.M.',
  SH: 'S.H.',
  MH: 'M.H.',
  SSOS: 'S.Sos.',
  MSOS: 'M.Sos.',
  SHUM: 'S.Hum.',
  MHUM: 'M.Hum.',
  SPSI: 'S.Psi.',
  MPSI: 'M.Psi.',
  SOR: 'S.Or.',
  MOR: 'M.Or.',
  SSN: 'S.Sn.',
  MSN: 'M.Sn.',
  ST: 'S.T.',
  MT: 'M.T.',
  SP: 'S.P.',
  MP: 'M.P.',
  SIP: 'S.I.P.',
  SIKOM: 'S.I.Kom.',
  SAK: 'S.Ak.',
  MAK: 'M.Ak.',
  SKM: 'S.K.M.',
  MKM: 'M.K.M.',
  SKEP: 'S.Kep.',
  MKEP: 'M.Kep.',
  SSTAT: 'S.Stat.',
  STHI: 'S.Th.I.',
  SFILI: 'S.Fil.I.',
  SS: 'S.S.',
  SFIL: 'S.Fil.',
  SPT: 'S.Pt.',
  SPI: 'S.Pi.',
  SHUT: 'S.Hut.',
  SAP: 'S.A.P.',
  MAP: 'M.A.P.',
  STRKOM: 'S.Tr.Kom.',
  STRPD: 'S.Tr.Pd.',
  AMA: 'A.Ma.',
  AMAPD: 'A.Ma.Pd.',
  AMAPDSD: 'A.Ma.Pd.SD.',
  AMAPUST: 'A.Ma.Pust.',
  AMD: 'A.Md.',
  AMDKOM: 'A.Md.Kom.',
  AMDAK: 'A.Md.Ak.',
  AMDPUST: 'A.Md.Pust.',
  GR: 'Gr.',
  BA: 'B.A.',
  BED: 'B.Ed.',
  MED: 'M.Ed.',
  BSC: 'B.Sc.',
  MSC: 'M.Sc.',
  MA: 'M.A.',
  PHD: 'Ph.D.',
};

const LOWER_PARTICLES = new Set(['bin', 'binti', 'ibnu']);

function compactKey(token: string): string {
  return token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function formatSinglePrefix(token: string): string | null {
  const key = compactKey(token);
  if (!key) return null;
  if (key === 'DR') {
    const clean = token.replace(/\.+$/, '');
    return clean === 'dr' ? 'dr.' : 'Dr.';
  }
  return PREFIX_TITLES[key] || null;
}

function formatSingleDegree(token: string): string {
  const key = compactKey(token);
  if (!key) return '';
  if (SUFFIX_DEGREES[key]) return SUFFIX_DEGREES[key];

  // Fallback untuk gelar bertitik yang belum masuk daftar (mis. M.Tr.Kom.)
  const parts = token
    .replace(/\.+$/, '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return token;
  return (
    parts
      .map((p) =>
        p.length === 1
          ? p.toUpperCase()
          : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
      )
      .join('.') + '.'
  );
}

function splitDegreeChunk(chunk: string): string[] {
  const tokens = chunk
    .replace(/\.(?=[A-Z]{1,3}\.)/g, '. ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const tok of tokens) {
    // Tangani kasus seperti "S.Pd.Gr" atau "S.Pd.Gr." -> ["S.Pd.", "Gr."]
    const grTrail = /^(.*\.)(gr)\.?$/i.exec(tok);
    if (grTrail && compactKey(grTrail[1]) in SUFFIX_DEGREES) {
      out.push(formatSingleDegree(grTrail[1]), 'Gr.');
      continue;
    }
    out.push(formatSingleDegree(tok));
  }
  return out.filter(Boolean);
}

function titleCaseWord(word: string, isFirstNameWord: boolean): string {
  if (!word) return '';
  // Inisial nama bertitik (mis. M. atau A.)
  if (/^[a-zA-Z]\.$/.test(word)) {
    return `${word.charAt(0).toUpperCase()}.`;
  }
  const low = word.toLowerCase();
  if (!isFirstNameWord && LOWER_PARTICLES.has(low)) {
    return low;
  }
  return word
    .split('-')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
    .join('-');
}

/**
 * Memformat nama lengkap beserta gelar depan & gelar belakang sesuai kaidah EYD:
 * - Gelar depan diakhiri titik dengan huruf kapital sesuai kaidah (H., Hj., Drs., Dra., Dr., Prof., Ir., K.H.)
 * - Nama orang menggunakan kapitalisasi awal kata (Title Case)
 * - Gelar belakang dipisahkan koma dan spasi (`, `) serta ditulis sesuai EYD (S.Pd., M.Pd., S.Pd.I., S.Pd.SD., Gr., A.Ma.Pd., dll.)
 */
export function formatNamaGelarEYD(input?: string): string {
  if (!input) return '';
  const raw = input.trim().replace(/\s+/g, ' ').replace(/[,;]+$/g, '').trim();
  if (!raw) return '';

  const segments = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return '';

  const nameTokens = segments[0].split(/\s+/).filter(Boolean);
  const tailDegrees: string[] = [];

  // Tarik gelar di ujung nama jika pengguna belum memakai tanda koma (mis. "Budi Santoso S.Pd")
  while (nameTokens.length > 1) {
    const last = nameTokens[nameTokens.length - 1];
    const key = compactKey(last);
    if (SUFFIX_DEGREES[key]) {
      tailDegrees.unshift(formatSingleDegree(last));
      nameTokens.pop();
    } else {
      break;
    }
  }

  // Pisahkan gelar depan (H., Hj., Prof., Dr., Drs., Dra., Ir., K.H., dll.)
  const prefixes: string[] = [];
  while (nameTokens.length > 1) {
    const first = nameTokens[0];
    const fmt = formatSinglePrefix(first);
    if (fmt) {
      prefixes.push(fmt);
      nameTokens.shift();
    } else {
      break;
    }
  }

  const formattedName = nameTokens
    .map((w, idx) => titleCaseWord(w, idx === 0))
    .join(' ');

  const fullNamePart = [...prefixes, formattedName].filter(Boolean).join(' ');

  const allSuffixes: string[] = [...tailDegrees];
  for (let i = 1; i < segments.length; i++) {
    allSuffixes.push(...splitDegreeChunk(segments[i]));
  }

  if (allSuffixes.length === 0) return fullNamePart;
  return `${fullNamePart}, ${allSuffixes.join(', ')}`;
}

/** Rapikan penulisan singkatan gelar pada kolom Ijazah (jika mengandung singkatan gelar seperti S.PD, M.PD, A.MA). */
export function formatIjazahEYD(input?: string): string {
  if (!input) return '';
  return input.replace(
    /\b(S\.Pd\.I|S\.Pd\.SD|S\.Pd\.AUD|S\.Pd|M\.Pd\.I|M\.Pd|S\.Ag|M\.Ag|S\.Si|M\.Si|S\.Kom|M\.Kom|S\.E|M\.M|S\.H|M\.H|S\.Sos|S\.Or|A\.Ma\.Pd\.SD|A\.Ma\.Pd|A\.Ma|A\.Md\.Kom|A\.Md)\.?(?=\b|\s|$|,|\()/gi,
    (match) => formatSingleDegree(match)
  );
}
