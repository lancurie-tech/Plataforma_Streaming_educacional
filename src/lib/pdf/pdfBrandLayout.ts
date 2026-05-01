import type { jsPDF } from 'jspdf';
import { PLATFORM_LOGO_SRC, PLATFORM_SHORT_NAME } from '@/lib/brand';

/** Paleta para PDFs institucionais (navy + texto escuro em papel branco). */
export const PDF_BRAND = {
  margin: 18,
  headerBandH: 22,
  continuationBandH: 11,
  navy: [0, 58, 52] as [number, number, number],
  tableHead: [0, 72, 64] as [number, number, number],
  paperTint: [229, 243, 236] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  inkSoft: [51, 65, 85] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  onDark: [255, 255, 255] as [number, number, number],
  onDarkMuted: [226, 232, 240] as [number, number, number],
  accent: [5, 150, 105] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  warn: [180, 83, 9] as [number, number, number],
  tableFont: 11,
  sectionFs: 13.5,
  titleFs: 20,
  bodyFs: 11.5,
  smallFs: 10,
  footerFs: 9,
};

export function pdfStandardTableProps() {
  const m = PDF_BRAND.margin;
  const fs = PDF_BRAND.tableFont;
  return {
    margin: { left: m, right: m },
    theme: 'grid' as const,
    styles: {
      fontSize: fs,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3.5, right: 3.5 },
      lineColor: [203, 213, 225] as [number, number, number],
      lineWidth: 0.15,
      textColor: PDF_BRAND.ink,
      valign: 'middle' as const,
      fillColor: false as const,
    },
    headStyles: {
      fillColor: PDF_BRAND.tableHead,
      textColor: 255,
      fontStyle: 'bold' as const,
      fontSize: fs,
    },
    bodyStyles: {
      textColor: PDF_BRAND.ink,
      fillColor: false as const,
    },
    alternateRowStyles: {
      fillColor: false as const,
    },
  };
}

async function rasterizeSvgTextToPngDataUrl(svgText: string): Promise<string | null> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo'));
      img.src = url;
    });
    const w = Math.max(1, Math.round(img.width * 4));
    const h = Math.max(1, Math.round(img.height * 4));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizeBlobImageToPngDataUrl(blob: Blob): Promise<string | null> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('img'));
      img.src = url;
    });
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const upscale = 4;
    const w = Math.max(1, Math.round(nw * upscale));
    const h = Math.max(1, Math.round(nh * upscale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Rasteriza o logo (SVG local, PNG/JPEG/WebP em Storage ou público) para PNG em data URL — uso em jsPDF.
 */
export async function loadLogoForPdf(logoSrc: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!logoSrc.trim()) return null;
  const absolute =
    /^https?:\/\//i.test(logoSrc)
      ? logoSrc
      : `${window.location.origin}${logoSrc.startsWith('/') ? logoSrc : `/${logoSrc}`}`;

  try {
    const res = await fetch(absolute, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ct = (blob.type || res.headers.get('content-type') || '').toLowerCase();
    const pathLow = absolute.split('?')[0].toLowerCase();
    const looksSvg = ct.includes('svg') || pathLow.endsWith('.svg');

    if (looksSvg) {
      const svgText = await blob.text();
      return rasterizeSvgTextToPngDataUrl(svgText);
    }
    return rasterizeBlobImageToPngDataUrl(blob);
  } catch {
    return null;
  }
}

/** Compat: logo por defeito em `public/`. */
export async function loadPlatformLogoForPdf(): Promise<string | null> {
  return loadLogoForPdf(PLATFORM_LOGO_SRC);
}

export function drawPdfPageBackground(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  logoDataUrl: string | null,
): void {
  doc.setFillColor(...PDF_BRAND.paperTint);
  doc.rect(0, 0, pageW, pageH, 'F');
  if (!logoDataUrl) return;
  try {
    const ip = doc.getImageProperties(logoDataUrl);
    const wmW = Math.min(pageW * 0.95, pageW - 2);
    const wmH = (ip.height * wmW) / ip.width;
    const wmX = (pageW - wmW) / 2;
    const wmY = (pageH - wmH) / 2;
    doc.addImage(logoDataUrl, 'PNG', wmX, wmY, wmW, wmH);
  } catch {
    // Ignore watermark draw failures.
  }
}

export type PdfCoverHeaderOpts = {
  doc: jsPDF;
  pageW: number;
  logoDataUrl: string | null;
  /** Substitui `PLATFORM_SHORT_NAME` na faixa quando o logo falha. */
  platformShortName?: string;
  /** Ex.: "Relatório para empresa" */
  documentLabel: string;
  /** Título principal abaixo da faixa (ex.: nome da empresa ou "Relatório de métricas") */
  mainTitle: string;
  /** Linha opcional menor (ex.: nome do curso) */
  subtitle?: string;
  /** Metadados (data, representante…) */
  metaLine: string;
};

/** Desenha faixa navy + logo; devolve Y inicial do conteúdo (corpo) em mm. */
export function drawPdfCoverHeader(opts: PdfCoverHeaderOpts): number {
  const {
    doc,
    pageW,
    logoDataUrl,
    platformShortName = PLATFORM_SHORT_NAME,
    documentLabel,
    mainTitle,
    subtitle,
    metaLine,
  } = opts;
  const m = PDF_BRAND.margin;
  const band = PDF_BRAND.headerBandH;
  const pageH = doc.internal.pageSize.getHeight();

  drawPdfPageBackground(doc, pageW, pageH, logoDataUrl);

  doc.setFillColor(...PDF_BRAND.navy);
  doc.rect(0, 0, pageW, band, 'F');

  if (logoDataUrl) {
    try {
      const ip = doc.getImageProperties(logoDataUrl);
      const logoH = 19;
      const logoW = Math.min((ip.width * logoH) / ip.height, pageW - m * 2);
      const logoX = (pageW - logoW) / 2;
      const logoY = (band - logoH) / 2;
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(...PDF_BRAND.onDark);
      doc.text(platformShortName, pageW / 2, band / 2 + 4, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...PDF_BRAND.onDark);
    doc.text(platformShortName, pageW / 2, band / 2 + 4, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BRAND.smallFs);
  doc.setTextColor(...PDF_BRAND.onDarkMuted);
  doc.text(documentLabel, pageW - m, 14, { align: 'right' });

  let y = band + 10;
  doc.setFontSize(PDF_BRAND.smallFs);
  doc.setTextColor(...PDF_BRAND.muted);
  doc.text('Formação digital em saúde', m, y);
  y += 8;

  doc.setFontSize(PDF_BRAND.titleFs);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND.ink);
  doc.text(mainTitle, m, y);
  y += 10;

  if (subtitle) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_BRAND.inkSoft);
    doc.text(subtitle, m, y);
    y += 7;
  }

  doc.setDrawColor(...PDF_BRAND.accent);
  doc.setLineWidth(0.8);
  doc.line(m, y, m + 56, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BRAND.smallFs + 0.5);
  doc.setTextColor(...PDF_BRAND.muted);
  doc.text(metaLine, m, y);
  y += 12;

  return y;
}

export function drawPdfContinuationBand(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  logoDataUrl: string | null,
  leftLabel: string,
  rightTail: string,
): void {
  drawPdfPageBackground(doc, pageW, pageH, logoDataUrl);
  const m = PDF_BRAND.margin;
  const h = PDF_BRAND.continuationBandH;
  doc.setFillColor(...PDF_BRAND.navy);
  doc.rect(0, 0, pageW, h, 'F');
  doc.setFontSize(PDF_BRAND.footerFs);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND.onDark);
  doc.text(leftLabel, m, 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BRAND.footerFs - 0.5);
  doc.setTextColor(...PDF_BRAND.onDarkMuted);
  doc.text(rightTail, m + 22, 7.5, { maxWidth: pageW - m * 2 - 24 });
}

export type PdfContinuationOpts = {
  logoDataUrl?: string | null;
  platformShortName?: string;
};

export function ensurePdfVerticalSpace(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  state: { y: number },
  needMm: number,
  continuationRight: string,
  opts?: PdfContinuationOpts,
): void {
  if (state.y + needMm <= pageH - 16) return;
  doc.addPage();
  drawPdfContinuationBand(
    doc,
    pageW,
    pageH,
    opts?.logoDataUrl ?? null,
    opts?.platformShortName ?? PLATFORM_SHORT_NAME,
    continuationRight,
  );
  state.y = 18;
}

export function addPdfPageFooters(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
  buildLine: (page: number, total: number) => string,
): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(PDF_BRAND.footerFs);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_BRAND.muted);
    doc.text(buildLine(i, total), pageW / 2, pageH - 7, {
      align: 'center',
      maxWidth: pageW - margin * 2,
    });
  }
  doc.setPage(total);
}

/** Secção com barra de acento (igual ao guia de acesso). Atualiza `state.y`. */
export function drawPdfSectionTitle(
  doc: jsPDF,
  pageW: number,
  margin: number,
  state: { y: number },
  title: string,
): void {
  let y = state.y;
  y += 6;
  doc.setFillColor(...PDF_BRAND.accent);
  doc.rect(margin, y, 2, 8, 'F');
  doc.setFontSize(PDF_BRAND.sectionFs);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_BRAND.ink);
  doc.text(title, margin + 5, y + 5.6);
  y += 11;
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  state.y = y;
}
