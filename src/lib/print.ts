/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaperPreset = 'A4' | 'Legal' | 'A4-landscape' | 'F4-landscape';

const STYLE_ATTR = 'data-google-print-style';
const PORTAL_ID = 'app-print-portal';

let activeCleanup: (() => void) | null = null;

function parseMarginValues(margin = '14mm 16mm'): [string, string, string, string] {
  const parts = margin.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  if (parts.length >= 4) return [parts[0], parts[1], parts[2], parts[3]];
  return ['14mm', '16mm', '14mm', '16mm'];
}

function buildPageCss(paper: PaperPreset = 'A4', margin = '14mm 16mm', includePortalPadding = true): string {
  let sizeValue = 'A4 portrait';
  switch (paper) {
    case 'Legal':
      sizeValue = 'legal portrait';
      break;
    case 'A4-landscape':
      sizeValue = 'A4 landscape';
      break;
    case 'F4-landscape':
      sizeValue = '330mm 216mm';
      break;
    case 'A4':
    default:
      sizeValue = 'A4 portrait';
      break;
  }

  // @page margin: 0 menghilangkan header/footer bawaan Chrome (tanggal/jam, nama aplikasi, URL, nomor halaman)
  const pageRule = `@page { size: ${sizeValue}; margin: 0; }`;
  if (!includePortalPadding) return pageRule;

  const [pt, pr, pb, pl] = parseMarginValues(margin);
  return `${pageRule}
body.printing-portal #app-print-portal {
  --print-pt: ${pt};
  --print-pr: ${pr};
  --print-pb: ${pb};
  --print-pl: ${pl};
  box-sizing: border-box !important;
  padding: ${pt} ${pr} ${pb} ${pl} !important;
}
body.printing-portal #app-print-portal .sppd-page-2,
body.printing-portal #app-print-portal .page-break + * {
  padding-top: ${pt} !important;
}`;
}

async function waitForImages(root: ParentNode, timeoutMs = 800): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img')).filter((img) => Boolean(img.getAttribute('src')));
  if (imgs.length === 0) return;

  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export interface TriggerPrintOptions {
  pageCss: string;
  bodyClass: string;
  targetRoot?: ParentNode;
  onCleanup?: () => void;
}

/**
 * Membuka Google Chrome Print Preview (window.print()) dengan aturan @page khusus
 * dan pembersihan otomatis saat dialog pratinjau cetak Google ditutup (afterprint).
 */
export async function triggerGooglePrint(options: TriggerPrintOptions): Promise<void> {
  if (activeCleanup) {
    try {
      activeCleanup();
    } catch {}
    activeCleanup = null;
  }

  document.querySelectorAll(`style[${STYLE_ATTR}]`).forEach((el) => el.remove());

  const styleEl = document.createElement('style');
  styleEl.setAttribute(STYLE_ATTR, 'true');
  styleEl.textContent = options.pageCss;
  document.head.appendChild(styleEl);

  document.body.classList.add(options.bodyClass);

  let cleaned = false;
  const cleanUp = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove(options.bodyClass);
    styleEl.remove();
    window.removeEventListener('afterprint', cleanUp);
    if (activeCleanup === cleanUp) activeCleanup = null;
    try {
      options.onCleanup?.();
    } catch {}
  };

  activeCleanup = cleanUp;
  window.addEventListener('afterprint', cleanUp, { once: true });

  await waitForImages(options.targetRoot || document.body);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  try {
    window.focus();
  } catch {}
  window.print();
}

export interface PrintDomOptions {
  paper?: PaperPreset;
  margin?: string;
  pageCss?: string;
  extraPortalClass?: string;
  onCleanup?: () => void;
}

/**
 * Mengkloning elemen DOM ke #app-print-portal (di luar #root) lalu membuka
 * Google Chrome Print Preview agar hasil cetak bersih tanpa UI aplikasi lain,
 * tanpa overlay modal, dan tidak terpotong scroll container.
 */
export async function printDomElement(
  element: HTMLElement | null,
  options: PrintDomOptions = {}
): Promise<boolean> {
  if (!element) return false;

  document.getElementById(PORTAL_ID)?.remove();

  const portal = document.createElement('div');
  portal.id = PORTAL_ID;
  if (options.extraPortalClass) {
    portal.className = options.extraPortalClass;
  }

  const isStikerPortal = options.extraPortalClass === 'printing-stiker-portal';
  if (!isStikerPortal) {
    const [pt, pr, pb, pl] = parseMarginValues(options.margin || '14mm 16mm');
    portal.style.setProperty('--print-pt', pt);
    portal.style.setProperty('--print-pr', pr);
    portal.style.setProperty('--print-pb', pb);
    portal.style.setProperty('--print-pl', pl);
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, .no-print-area, button').forEach((el) => el.remove());
  portal.appendChild(clone);
  document.body.appendChild(portal);

  const pageCss =
    options.pageCss ||
    buildPageCss(options.paper || 'A4', options.margin || '14mm 16mm', !isStikerPortal);

  await triggerGooglePrint({
    pageCss,
    bodyClass: 'printing-portal',
    targetRoot: portal,
    onCleanup: () => {
      portal.remove();
      options.onCleanup?.();
    },
  });

  return true;
}
