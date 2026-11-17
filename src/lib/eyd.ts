/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilitas pemformatan nama & gelar sesuai EYD (Ejaan Yang Disempurnakan).
 * Contoh penulisan yang benar: S.Pd., S.Pd.I., S.Pd.SD., M.Pd., S.Kom., A.Ma.Pd. (bukan S.PD).
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

// Urutkan pasangan nilai gelar terpanjang dulu untuk memecah gelar yang menempel tanpa spasi (mis. "S.Pd.M.Pd.")
const SORTED_DEGREE_KEYS = Object.keys(SUFFIX_DEGREES).sort((a, b) => b.length - a.length);

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

/**
 * Memecah deretan gelar dalam satu segmen koma tanpa merusak singkatan seperti "S.PD.", "S.PD.SD.", atau "S.Pd.I.",
 * sekaligus mampu memisahkan gelar yang menempel seperti "S.Pd.M.Pd." atau "S.Pd.Gr.".
 */
function splitDegreeToken(tok: string): string[] {
  const key = compactKey(tok);
  if (!key) return [];
  if (SUFFIX_DEGREES[key]) return [SUFFIX_DEGREES[key]];

  // Cek apakah merupakan gabungan dua gelar yang menempel (mis. "S.Pd.M.Pd.", "S.PD.GR.")
  for (const firstKey of SORTED_DEGREE_KEYS) {
    if (key.length > firstKey.length && key.startsWith(firstKey)) {
      const restKey = key.slice(firstKey.length);
      if (SUFFIX_DEGREES[restKey]) {
        return [SUFFIX_DEGREES[firstKey], SUFFIX_DEGREES[restKey]];
      }
    }
  }

  return [formatSingleDegree(tok)];
}

function splitDegreeChunk(chunk: string): string[] {
  const tokens = chunk
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const tok of tokens) {
    const key = compactKey(tok);
    if (!key) continue;
    if (SUFFIX_DEGREES[key]) {
      out.push(SUFFIX_DEGREES[key]);
      continue;
    }
    out.push(...splitDegreeToken(tok));
  }
  return out.filter(Boolean);
}

function titleCaseWord(word: string, isFirstNameWord: boolean): string {
  if (!word) return '';
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

function parseNameAndDegrees(input?: string) {
  if (!input) return null;
  const raw = input.trim().replace(/\s+/g, ' ').replace(/[,;]+$/g, '').trim();
  if (!raw) return null;

  const segments = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const nameTokens = segments[0].split(/\s+/).filter(Boolean);
  const tailDegrees: string[] = [];

  // Tarik gelar di ujung nama jika belum memakai tanda koma (mis. "Budi Santoso S.Pd")
  while (nameTokens.length > 1) {
    const last = nameTokens[nameTokens.length - 1];
    const key = compactKey(last);
    if (SUFFIX_DEGREES[key]) {
      tailDegrees.unshift(SUFFIX_DEGREES[key]);
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

  const allSuffixes: string[] = [...tailDegrees];
  for (let i = 1; i < segments.length; i++) {
    allSuffixes.push(...splitDegreeChunk(segments[i]));
  }

  return { prefixes, nameTokens, allSuffixes };
}

/**
 * Memformat nama lengkap beserta gelar depan & gelar belakang sesuai kaidah EYD:
 * - Gelar depan: H., Hj., Drs., Dra., Dr., Prof., Ir., K.H.
 * - Nama orang: Title Case (mis. H. Kaerudin, S.Pd., M.Pd.)
 * - Gelar belakang: S.Pd., M.Pd., S.Pd.I., S.Pd.SD., Gr., A.Ma.Pd., dll.
 */
export function formatNamaGelarEYD(input?: string): string {
  const parsed = parseNameAndDegrees(input);
  if (!parsed) return '';
  const formattedName = parsed.nameTokens
    .map((w, idx) => titleCaseWord(w, idx === 0))
    .join(' ');
  const fullNamePart = [...parsed.prefixes, formattedName].filter(Boolean).join(' ');
  if (parsed.allSuffixes.length === 0) return fullNamePart;
  return `${fullNamePart}, ${parsed.allSuffixes.join(', ')}`;
}

/**
 * Memformat nama dengan mempertahankan huruf kapital pada nama pribadi bila diminta
 * (mis. "RISNA HIDAYAT, S.Pd.", "CASWILA, S.Pd.SD.", "H. KAERUDIN, M.Pd."),
 * tetapi SEMUA gelar depan dan gelar belakang selalu mengikuti penulisan EYD (bukan S.PD).
 */
export function formatNamaKapitalGelarEYD(input?: string, forceUpperName = true): string {
  const parsed = parseNameAndDegrees(input);
  if (!parsed) return '';
  const formattedName = parsed.nameTokens
    .map((w) => (forceUpperName ? w.toUpperCase() : w))
    .join(' ');
  const fullNamePart = [...parsed.prefixes, formattedName].filter(Boolean).join(' ');
  if (parsed.allSuffixes.length === 0) return fullNamePart;
  return `${fullNamePart}, ${parsed.allSuffixes.join(', ')}`;
}

const KNOWN_DEGREE_REGEX =
  /\b(S\.Pd\.SD|S\.Pd\.AUD|S\.Pd\.I|S\.Pd\.K|S\.Pd\.H|S\.Pd|M\.Pd\.I|M\.Pd\.K|M\.Pd|S\.Ag|M\.Ag|S\.Si|M\.Si|S\.Kom|M\.Kom|S\.E|M\.E|M\.M|S\.M|S\.H|M\.H|S\.Sos|M\.Sos|S\.Hum|M\.Hum|S\.Psi|M\.Psi|S\.Or|M\.Or|S\.Sn|M\.Sn|S\.T|M\.T|S\.P|M\.P|S\.I\.P|S\.I\.Kom|S\.Ak|M\.Ak|S\.K\.M|M\.K\.M|S\.Kep|M\.Kep|S\.Stat|S\.Th\.I|S\.Fil\.I|S\.S|S\.Fil|S\.Pt|S\.Pi|S\.Hut|S\.A\.P|M\.A\.P|S\.Tr\.Kom|S\.Tr\.Pd|A\.Ma\.Pd\.SD|A\.Ma\.Pd|A\.Ma\.Pust|A\.Ma|A\.Md\.Kom|A\.Md\.Ak|A\.Md\.Pust|A\.Md|Ph\.D)\b\.?/gi;

/** Merapikan penulisan gelar akademik pada kolom Ijazah atau teks bebas agar selalu sesuai EYD (S.Pd., M.Pd., bukan S.PD). */
export function formatGelarInText(input?: string): string {
  if (!input) return '';
  return input.replace(KNOWN_DEGREE_REGEX, (match) => formatSingleDegree(match));
}

/** Alias untuk kolom Ijazah Daftar 1. */
export function formatIjazahEYD(input?: string): string {
  return formatGelarInText(input);
}
