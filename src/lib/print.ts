/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaperPreset = 'A4' | 'Legal' | 'A4-landscape' | 'F4-landscape';

const STYLE_ATTR = 'data-google-print-style';
const PORTAL_ID = 'app-print-portal';

let activeCleanup: (() => void) | null = null;

function buildPageCss(paper: PaperPreset = 'A4', margin = '14mm 16mm'): string {
  switch (paper) {
    case 'Legal':
      return `@page { size: legal portrait; margin: ${margin}; }`;
    case 'A4-landscape':
      return `@page { size: A4 landscape; margin: ${margin}; }`;
    case 'F4-landscape':
      return `@page { size: 330mm 216mm; margin: ${margin}; }`;
    case 'A4':
    default:
      return `@page { size: A4 portrait; margin: ${margin}; }`;
  }
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

  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, .no-print-area, button').forEach((el) => el.remove());
  portal.appendChild(clone);
  document.body.appendChild(portal);

  const pageCss = options.pageCss || buildPageCss(options.paper || 'A4', options.margin || '14mm 16mm');

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
