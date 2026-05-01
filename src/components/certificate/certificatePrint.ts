import {
  BRAND_GREEN,
  GREEN_DEEP,
  GOLD,
  buildPrintSealSvg,
  certificateLogoAbsoluteUrl,
  escapeHtml,
  formatDateLong,
} from '@/components/certificate/certificateShared';
import {
  formatCertificateAudienceLine,
  type UserCertificate,
} from '@/lib/firestore/certificates';
import { PLATFORM_DISPLAY_NAME, PLATFORM_SHORT_NAME } from '@/lib/brand';

export function openCertificatePrintWindow(c: UserCertificate): void {
  const w = window.open('', '_blank');
  if (!w) return;

  const issued = formatDateLong(c.issuedAt);
  const safeTitle = escapeHtml(c.courseTitle);
  const audienceLine = formatCertificateAudienceLine();
  const safeAudience = audienceLine ? escapeHtml(audienceLine) : '';
  const safeName = escapeHtml(c.studentName);
  const safeCode = escapeHtml(c.verificationCode);
  const iso = c.issuedAt.toISOString();
  const logoUrl = certificateLogoAbsoluteUrl();
  const safeLogoUrl = escapeHtml(logoUrl);
  const sealSvg = buildPrintSealSvg(safeLogoUrl);

  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Certificado — ${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Great+Vibes&family=Montserrat:wght@500;600;700&display=swap" rel="stylesheet"/>
<style>
  @page {
    size: A4 landscape;
    margin: 5mm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
  }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e8e8ea;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    position: relative;
    width: 100%;
    max-width: 1050px;
    aspect-ratio: 297 / 210;
    background: #fff;
    overflow: hidden;
    box-shadow: 0 4px 40px rgba(0,0,0,0.12);
    color: #222;
  }
  .poly {
    position: absolute;
    left: 0; top: 0;
    width: 70%; height: 38%;
    background: linear-gradient(148deg, #8fd06e 0%, ${BRAND_GREEN} 42%, #52a836 100%);
    clip-path: polygon(0 0, 100% 0, 42% 100%, 0 62%);
    z-index: 0;
  }
  .corner { position: absolute; width: 96px; height: 96px; pointer-events: none; opacity: 0.95; z-index: 2; }
  .corner-tr { right: 0; top: 0; }
  .corner-bl { left: 0; bottom: 0; transform: scaleX(-1); }
  .corner svg { width: 100%; height: 100%; }
  .seal-pos {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    z-index: 10;
  }
  @media (min-width: 640px) {
    .seal-pos { bottom: 1.25rem; right: 1.25rem; }
  }
  .wrap {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    min-height: 100%;
    height: 100%;
    padding: 0.85rem 1.35rem 4.5rem;
    text-align: center;
    box-sizing: border-box;
  }
  @media (min-width: 640px) {
    .wrap { padding: 1rem 1.75rem 4.75rem; }
  }
  @media (min-width: 768px) {
    .wrap { padding: 1.1rem 2.25rem 5rem; }
  }
  .cert-title {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 700;
    font-size: clamp(1.5rem, 4vw, 2.15rem);
    letter-spacing: 0.2em;
    color: ${GREEN_DEEP};
    margin: 0;
    line-height: 1.1;
  }
  .cert-sub {
    font-family: Montserrat, sans-serif;
    font-weight: 700;
    font-size: clamp(0.6rem, 1.2vw, 0.75rem);
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: ${GOLD};
    margin: 0.5rem 0 0;
  }
  .inner {
    flex: 0 0 auto;
    width: 100%;
    max-width: 42rem;
    margin-left: auto;
    margin-right: auto;
  }
  .grant {
    font-family: Montserrat, sans-serif;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #444;
    margin: 1.25rem 0 0;
    padding-bottom: 0.35rem;
    line-height: 1.45;
  }
  .name {
    font-family: 'Great Vibes', cursive;
    font-size: clamp(1.35rem, 3.8vw, 2.65rem);
    color: #111;
    margin: 0.85rem auto 0;
    padding: 0.45rem 0.85rem 0.2rem;
    border-bottom: 1px solid #d4d4d8;
    display: block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.55;
  }
  .body {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(0.9rem, 1.7vw, 1rem);
    line-height: 1.55;
    color: #4a4a4a;
    margin: 1.1rem auto 0;
    max-width: 34rem;
  }
  .course-label {
    font-family: Montserrat, sans-serif;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #555;
    margin: 1.15rem 0 0;
  }
  .course-name {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 700;
    font-size: clamp(1.1rem, 2.6vw, 1.55rem);
    color: ${GREEN_DEEP};
    margin: 0.5rem auto 0;
    max-width: 34rem;
    line-height: 1.3;
  }
  .course-audience {
    font-family: Montserrat, sans-serif;
    font-size: clamp(0.65rem, 1.2vw, 0.75rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #5a6b52;
    margin: 0.35rem auto 0;
    max-width: 34rem;
    line-height: 1.35;
  }
  .sigs {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid #e4e4e7;
    max-width: 30rem;
    margin-left: auto;
    margin-right: auto;
  }
  @media (min-width: 640px) {
    .sigs { flex-direction: row; justify-content: center; gap: 4rem; }
  }
  .sig { flex: 1; text-align: center; max-width: 14rem; }
  .sig-line { height: 1px; background: ${GREEN_DEEP}; margin: 0 auto 8px; }
  .sig-label {
    font-family: Montserrat, sans-serif;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #555;
    margin: 0;
  }
  .reg-subtle {
    font-family: Montserrat, sans-serif;
    font-size: 7px;
    line-height: 1.45;
    color: #8b8b95;
    text-align: center;
    margin: 0.45rem auto 0;
    padding-bottom: 0.35rem;
    max-width: 28rem;
    letter-spacing: 0.02em;
  }
  .reg-subtle .mono {
    font-family: ui-monospace, monospace;
    font-size: 7.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: #6b7280;
  }
  @media print {
    @page {
      size: A4 landscape;
      margin: 0;
    }
    html, body {
      width: 297mm !important;
      height: 210mm !important;
      max-height: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #fff !important;
    }
    body {
      display: block !important;
    }
    .sheet {
      position: relative !important;
      box-shadow: none !important;
      max-width: none !important;
      width: 297mm !important;
      height: 210mm !important;
      max-height: 210mm !important;
      aspect-ratio: auto !important;
      margin: 0 !important;
      page-break-after: avoid !important;
      page-break-before: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .wrap {
      position: relative !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      top: auto !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: flex-start !important;
      align-items: stretch !important;
      height: 100% !important;
      width: 100% !important;
      max-height: 210mm !important;
      padding: 3mm 4mm 13mm !important;
      box-sizing: border-box !important;
    }
    .cert-title { font-size: 1.35rem !important; letter-spacing: 0.16em !important; }
    .cert-sub { font-size: 0.55rem !important; margin-top: 0.25rem !important; }
    .grant {
      font-size: 9px !important;
      margin-top: 0.55rem !important;
      padding-bottom: 0.3rem !important;
      line-height: 1.4 !important;
    }
    .name {
      font-size: clamp(1.15rem, 2.8vw, 1.75rem) !important;
      max-width: 100% !important;
      margin-top: 0.65rem !important;
      padding-top: 0.35rem !important;
      line-height: 1.5 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .body { font-size: 0.78rem !important; line-height: 1.45 !important; margin-top: 0.5rem !important; }
    .course-label { font-size: 8px !important; margin-top: 0.65rem !important; }
    .course-name { font-size: 1rem !important; margin-top: 0.2rem !important; }
    .course-audience { font-size: 0.55rem !important; margin-top: 0.2rem !important; }
    .sigs { margin-top: 0.4rem !important; padding-top: 0.45rem !important; gap: 0.55rem !important; }
    .sig-label { font-size: 8px !important; }
    .reg-subtle { font-size: 6.5px !important; margin-top: 0.25rem !important; padding-bottom: 1.25mm !important; }
    .reg-subtle .mono { font-size: 6.5px !important; }
    .corner { width: 72px !important; height: 72px !important; }
    .seal-pos svg { width: 5.25rem !important; height: auto !important; }
    .seal-pos { bottom: 3.5mm !important; right: 3.5mm !important; }
  }
</style></head><body>
<div class="sheet">
  <div class="poly"></div>
  <div class="corner corner-tr"><svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M140 0h-50M140 0v50M140 8h-42M140 8v42M140 16h-34M140 16v34M0 140h50M0 140v-50M0 132h42M0 132v-42M0 124h34M0 124v-34" stroke="${GOLD}" stroke-width="1.2"/></svg></div>
  <div class="corner corner-bl"><svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M140 0h-50M140 0v50M140 8h-42M140 8v42M140 16h-34M140 16v34M0 140h50M0 140v-50M0 132h42M0 132v-42M0 124h34M0 124v-34" stroke="${GOLD}" stroke-width="1.2"/></svg></div>
  <div class="seal-pos">${sealSvg}</div>
  <div class="wrap">
    <h1 class="cert-title">CERTIFICADO</h1>
    <p class="cert-sub">de conclusão</p>
    <div class="inner">
      <p class="grant">${escapeHtml(`A ${PLATFORM_DISPLAY_NAME} confere a`)}</p>
      <p class="name" title="${safeName}">${safeName}</p>
      <p class="body">O título de conclusão do curso abaixo, obtido mediante o cumprimento de todos os módulos e critérios estabelecidos, em comprovação de esforço e dedicação.</p>
      <p class="course-label">Curso</p>
      <p class="course-name">${safeTitle}</p>
      ${safeAudience ? `<p class="course-audience">${safeAudience}</p>` : ''}
      <div class="sigs">
        <div class="sig"><div class="sig-line"></div><p class="sig-label">${escapeHtml(PLATFORM_SHORT_NAME)}</p></div>
        <div class="sig"><div class="sig-line"></div><p class="sig-label">Validação digital</p></div>
      </div>
      <p class="reg-subtle"><span style="text-transform:uppercase;letter-spacing:0.14em;">Registro</span> <span class="mono">${safeCode}</span> <span style="color:#d4d4d8;">·</span> <time datetime="${iso}">${escapeHtml(issued)}</time></p>
    </div>
  </div>
</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 200);
}
