import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const colorCache = new Map<string, string>();
let colorCtx: CanvasRenderingContext2D | null = null;
let cachedEmbeddedFontsCss: string | null = null;

function getColorContext(): CanvasRenderingContext2D | null {
  if (!colorCtx && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    colorCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return colorCtx;
}

/**
 * Resolves any modern CSS color (oklch, oklab, lab, lch, color-mix, etc.)
 * into a standard rgb()/rgba() string supported by html2canvas v1.4.1.
 */
function resolveColorToRgba(colorExpr: string): string {
  const trimmed = colorExpr.trim();
  const cached = colorCache.get(trimmed);
  if (cached) return cached;

  const ctx = getColorContext();
  if (!ctx) return '#000000';

  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', trimmed)) {
    return 'rgba(0, 0, 0, 0)';
  }

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillStyle = trimmed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const alpha = +(a / 255).toFixed(3);
  const resolved = alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  colorCache.set(trimmed, resolved);
  return resolved;
}

function collectCssVars(cssText: string): Map<string, string> {
  const vars = new Map<string, string>();
  const varRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}{]+);/g;
  let m: RegExpExecArray | null;
  while ((m = varRegex.exec(cssText)) !== null) {
    vars.set(m[1], m[2].trim());
  }
  return vars;
}

function expandCssVars(expr: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 4 || !expr.includes('var(')) return expr;
  return expr.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, (_full, name, fallback) => {
    const val = vars.get(name) || fallback || 'transparent';
    return expandCssVars(val, vars, depth + 1);
  });
}

function sanitizeCssColors(cssText: string, vars?: Map<string, string>): string {
  const fnPattern = /\b(?:oklch|oklab|color-mix|lab|lch)\(/gi;
  if (!fnPattern.test(cssText)) return cssText;

  const varMap = vars || collectCssVars(cssText);
  let result = '';
  let i = 0;
  const len = cssText.length;

  while (i < len) {
    fnPattern.lastIndex = i;
    const match = fnPattern.exec(cssText);
    if (!match) {
      result += cssText.slice(i);
      break;
    }

    const start = match.index;
    result += cssText.slice(i, start);

    let depth = 0;
    let end = start;
    while (end < len) {
      if (cssText[end] === '(') depth++;
      else if (cssText[end] === ')') {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
      end++;
    }

    const rawExpr = cssText.slice(start, end);
    const expanded = expandCssVars(rawExpr, varMap);
    result += resolveColorToRgba(expanded);
    i = end;
  }

  return result;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches Google Font CSS and embeds WOFF2 fonts as base64 data URLs once per session
 * so SVG <foreignObject> renders Hind Siliguri & JetBrains Mono identically to the browser.
 */
async function getEmbeddedGoogleFontsCss(): Promise<string> {
  if (cachedEmbeddedFontsCss !== null) return cachedEmbeddedFontsCss;

  try {
    const fontLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map(l => l.href)
      .filter(href => href.includes('fonts.googleapis.com'));

    let combined = '';
    for (const href of fontLinks) {
      const res = await fetch(href);
      if (!res.ok) continue;
      let css = await res.text();
      const urlMatches = Array.from(css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g));
      const uniqueUrls = Array.from(new Set(urlMatches.map(m => m[1])));
      for (const fontUrl of uniqueUrls) {
        try {
          const fontRes = await fetch(fontUrl);
          if (!fontRes.ok) continue;
          const dataUrl = await blobToDataUrl(await fontRes.blob());
          css = css.split(fontUrl).join(dataUrl);
        } catch {
          // Ignore single font fetch failure
        }
      }
      combined += css + '\n';
    }
    cachedEmbeddedFontsCss = combined;
  } catch {
    cachedEmbeddedFontsCss = '';
  }

  return cachedEmbeddedFontsCss;
}

async function inlineImagesAsDataUrls(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        const dataUrl = await blobToDataUrl(await res.blob());
        img.setAttribute('src', dataUrl);
      } catch {
        // Fallback: keep original src
      }
    })
  );
}

function collectDocumentCss(): string {
  const cssParts: string[] = [];
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i];
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        cssParts.push(rules[j].cssText);
      }
    } catch {
      // Cross-origin CSS handled separately via getEmbeddedGoogleFontsCss
    }
  }
  return cssParts.join('\n');
}

/**
 * Renders an element via Chromium's native SVG <foreignObject> so Tailwind v4 layouts,
 * Bangla ligatures (Hind Siliguri), boxes, borders, and dots match the screen 1:1.
 */
async function renderElementViaForeignObject(sourceEl: HTMLElement, scale = 2.2): Promise<HTMLCanvasElement> {
  await document.fonts.ready;

  const width = sourceEl.offsetWidth;
  const height = sourceEl.offsetHeight;
  if (!width || !height) {
    throw new Error('Target element has zero dimensions');
  }

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.classList.remove('shadow-md', 'mx-auto');

  await inlineImagesAsDataUrls(clone);

  const [fontsCss, docCss] = await Promise.all([
    getEmbeddedGoogleFontsCss(),
    Promise.resolve(collectDocumentCss())
  ]);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.margin = '0';
  wrapper.style.padding = '0';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.color = '#000000';
  wrapper.style.overflow = 'hidden';
  wrapper.style.boxSizing = 'border-box';

  const styleEl = document.createElement('style');
  styleEl.setAttribute('type', 'text/css');
  styleEl.textContent = `${fontsCss}\n${docCss}`;
  wrapper.appendChild(styleEl);
  wrapper.appendChild(clone);

  const serializedXhtml = new XMLSerializer().serializeToString(wrapper);
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${serializedXhtml}</foreignObject></svg>`;

  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err);
    image.src = svgDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Verify canvas isn't tainted before returning
  canvas.toDataURL('image/jpeg', 0.96);
  return canvas;
}

function inlineResolvedElementColors(sourceRoot: HTMLElement, cloneRoot: HTMLElement): void {
  const colorProps = [
    'color',
    'backgroundColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor'
  ] as const;

  const applyForPair = (src: Element, dst: Element) => {
    if (src instanceof HTMLElement && dst instanceof HTMLElement) {
      const cs = window.getComputedStyle(src);
      for (const prop of colorProps) {
        const val = cs[prop];
        if (val && /(?:oklch|oklab|color-mix|lab|lch)\(/i.test(val)) {
          dst.style[prop] = resolveColorToRgba(val);
        }
      }
    }
    const srcChildren = src.children;
    const dstChildren = dst.children;
    const count = Math.min(srcChildren.length, dstChildren.length);
    for (let k = 0; k < count; k++) {
      applyForPair(srcChildren[k], dstChildren[k]);
    }
  };

  applyForPair(sourceRoot, cloneRoot);
}

export function sanitizeClonedDocumentForPdf(clonedDoc: Document): void {
  clonedDoc.documentElement.classList.remove('dark');
  clonedDoc.body.classList.remove('dark');
  clonedDoc.documentElement.style.backgroundColor = '#ffffff';
  clonedDoc.body.style.backgroundColor = '#ffffff';

  const styleNodes = Array.from(clonedDoc.querySelectorAll('style'));
  styleNodes.forEach((node) => node.remove());

  const linkNodes = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
  linkNodes.forEach((node) => {
    const href = node.getAttribute('href') || '';
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      node.remove();
    } else if (!href.includes('fonts.googleapis.com')) {
      node.remove();
    }
  });

  const joinedCss = collectDocumentCss();
  if (joinedCss) {
    const varMap = collectCssVars(joinedCss);
    const cleanStyle = clonedDoc.createElement('style');
    cleanStyle.setAttribute('data-pdf-sanitized', 'true');
    cleanStyle.textContent = sanitizeCssColors(joinedCss, varMap);
    clonedDoc.head.appendChild(cleanStyle);
  }

  const styledEls = Array.from(clonedDoc.querySelectorAll<HTMLElement>('[style]'));
  styledEls.forEach((el) => {
    const raw = el.getAttribute('style');
    if (raw && /(?:oklch|oklab|color-mix|lab|lch)\(/i.test(raw)) {
      el.setAttribute('style', sanitizeCssColors(raw));
    }
  });
}

async function renderElementViaHtml2CanvasFallback(sourceEl: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.margin = '0';
  host.style.padding = '0';
  host.style.background = '#ffffff';
  host.style.zIndex = '-1';

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  inlineResolvedElementColors(sourceEl, clone);
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    return await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => sanitizeClonedDocumentForPdf(clonedDoc)
    });
  } finally {
    document.body.removeChild(host);
  }
}

async function captureElementHighResCanvas(sourceEl: HTMLElement, scale = 2.2): Promise<HTMLCanvasElement> {
  try {
    return await renderElementViaForeignObject(sourceEl, scale);
  } catch (svgErr) {
    console.warn('SVG foreignObject render failed, falling back to sanitized html2canvas:', svgErr);
    return await renderElementViaHtml2CanvasFallback(sourceEl, scale);
  }
}

/**
 * Exports an HTML element (e.g. a Certificate) directly as an A4 Landscape PDF.
 */
export async function downloadCertificateAsPdf(elementId: string, filename: string): Promise<boolean> {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    console.error(`Certificate element with id "${elementId}" not found.`);
    return false;
  }

  try {
    const canvas = await captureElementHighResCanvas(sourceEl, 2.5);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating certificate PDF:', error);
    return false;
  }
}

/**
 * Exports one or more A4 portrait .a4-sheet elements directly into a multi-page PDF file
 * with minimal outer white border and 1:1 browser-exact layout.
 */
export async function downloadSheetsAsPdf(sheets: HTMLElement[], filename: string): Promise<boolean> {
  if (!sheets || sheets.length === 0) return false;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  const marginX = 1.5;
  const marginY = 1.5;
  const maxContentW = pageWidth - marginX * 2;
  const maxContentH = pageHeight - marginY * 2;

  for (let i = 0; i < sheets.length; i++) {
    const canvas = await captureElementHighResCanvas(sheets[i], 2.2);
    const imgData = canvas.toDataURL('image/jpeg', 0.96);

    const ratio = canvas.width / canvas.height;
    let renderW = maxContentW;
    let renderH = renderW / ratio;

    if (renderH > maxContentH) {
      renderH = maxContentH;
      renderW = renderH * ratio;
    }

    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = (pageHeight - renderH) / 2;

    if (i > 0) {
      pdf.addPage();
    }
    pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');
  }

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  pdf.save(cleanFilename);
  return true;
}

/**
 * Exports an Admit Card DOM element directly as an A4 Portrait PDF file.
 */
export async function downloadAdmitCardAsPdf(elementId: string, filename: string): Promise<boolean> {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    console.error(`Admit card element with id "${elementId}" not found.`);
    return false;
  }

  try {
    const canvas = await captureElementHighResCanvas(sourceEl, 2.5);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const marginX = 14;
    const marginTop = 16;
    const maxW = pageWidth - marginX * 2;
    const maxH = pageHeight - marginTop * 2;

    const ratio = canvas.width / canvas.height;
    let renderW = maxW;
    let renderH = renderW / ratio;

    if (renderH > maxH) {
      renderH = maxH;
      renderW = renderH * ratio;
    }

    const offsetX = (pageWidth - renderW) / 2;
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    pdf.addImage(imgData, 'JPEG', offsetX, marginTop, renderW, renderH, undefined, 'FAST');

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating admit card PDF:', error);
    return false;
  }
}

