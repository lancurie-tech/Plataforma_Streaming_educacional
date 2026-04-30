import { createRoot } from 'react-dom/client';
import type { SaudeMentalCompanyPdfSnapshot } from '@/lib/pdf/buildSaudeMentalCompanyPdfSnapshot';
import { SaudeMentalPdfChartDeck } from '@/lib/pdf/saudeMentalPdfChartDeck';

export type SaudeMentalPdfChartImages = {
  funnel?: string;
  evolution?: string;
  radarGeral?: string;
  radarT0?: string;
  radarT1?: string;
  radarT2?: string;
};

async function snapEl(el: HTMLElement | null, html2canvas: typeof import('html2canvas').default) {
  if (!el) return undefined;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#e5f3ec',
    logging: false,
    useCORS: true,
  });
  return canvas.toDataURL('image/png');
}

/**
 * Renderiza gráficos off-DOM e devolve PNG em base64 para o jsPDF.
 * Só deve ser usado no browser (nunca em SSR).
 */
export async function captureSaudeMentalChartsPng(
  snapshot: SaudeMentalCompanyPdfSnapshot,
): Promise<SaudeMentalPdfChartImages> {
  const html2canvas = (await import('html2canvas')).default;
  const host = document.createElement('div');
  host.setAttribute('data-sm-pdf-capture', '1');
  host.style.cssText =
    'position:fixed;left:-14000px;top:0;width:660px;pointer-events:none;opacity:1;z-index:2147483646;';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<SaudeMentalPdfChartDeck snapshot={snapshot} />);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => resolve(), 700);
      });
    });
  });

  try {
    const funnel = await snapEl(host.querySelector('#sm-pdf-cap-funnel') as HTMLElement, html2canvas);
    const evolution = await snapEl(host.querySelector('#sm-pdf-cap-evolution') as HTMLElement, html2canvas);
    const radarGeral = await snapEl(host.querySelector('#sm-pdf-cap-radar-geral') as HTMLElement, html2canvas);
    const radarT0 = await snapEl(host.querySelector('#sm-pdf-cap-radar-t0') as HTMLElement, html2canvas);
    const radarT1 = await snapEl(host.querySelector('#sm-pdf-cap-radar-t1') as HTMLElement, html2canvas);
    const radarT2 = await snapEl(host.querySelector('#sm-pdf-cap-radar-t2') as HTMLElement, html2canvas);
    return { funnel, evolution, radarGeral, radarT0, radarT1, radarT2 };
  } finally {
    root.unmount();
    host.remove();
  }
}
