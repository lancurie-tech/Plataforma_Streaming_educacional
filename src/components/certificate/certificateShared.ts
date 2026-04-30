export const BRAND_GREEN = '#66BC3F';
export const GREEN_DEEP = '#2d6b1f';
export const GOLD = '#C9A227';
export const GOLD_DARK = '#8B6914';

export const MEDIVOX_LOGO_PATH = '/logo_medivox.png';

export const SEAL_CX = 50;
export const SEAL_CY = 44;

export function certificateLogoAbsoluteUrl(): string {
  if (typeof window === 'undefined') return MEDIVOX_LOGO_PATH;
  return `${window.location.origin}${MEDIVOX_LOGO_PATH}`;
}

export function starburstPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  teeth: number
): string {
  const parts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i * Math.PI) / teeth - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${parts.join(' ')} Z`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function buildPrintSealSvg(logoUrlEscaped: string): string {
  const burst = starburstPath(SEAL_CX, SEAL_CY, 47, 40, 28);
  const gid = 'printGoldLin';
  const rid = 'printGoldRad';
  return `<svg viewBox="0 0 100 118" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:7.25rem;height:8.75rem;filter:drop-shadow(0 4px 12px rgba(0,0,0,.2))">
<defs>
<linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" stop-color="#f5edd4"/><stop offset="35%" stop-color="#e8c84a"/><stop offset="70%" stop-color="#c9a227"/><stop offset="100%" stop-color="#8a6d18"/>
</linearGradient>
<radialGradient id="${rid}" cx="32%" cy="28%" r="75%">
<stop offset="0%" stop-color="#fffef5" stop-opacity="0.95"/><stop offset="45%" stop-color="#f0d878"/><stop offset="100%" stop-color="#d4af37"/>
</radialGradient>
<clipPath id="printSealLogoClip"><circle cx="50" cy="44" r="30.5"/></clipPath>
</defs>
<path d="M 38 86 L 34 108 L 44 102 Z" fill="${GREEN_DEEP}" stroke="${GOLD}" stroke-width="0.6"/>
<path d="M 62 86 L 66 108 L 56 102 Z" fill="${GREEN_DEEP}" stroke="${GOLD}" stroke-width="0.6"/>
<path d="${burst}" fill="${GREEN_DEEP}"/>
<circle cx="50" cy="44" r="38" fill="none" stroke="url(#${gid})" stroke-width="2.2"/>
<circle cx="50" cy="44" r="33.5" fill="url(#${rid})" stroke="${GOLD_DARK}" stroke-width="0.4"/>
<image href="${logoUrlEscaped}" xlink:href="${logoUrlEscaped}" x="25" y="19" width="50" height="50" preserveAspectRatio="xMidYMid meet" clip-path="url(#printSealLogoClip)"/>
<path d="M 24 54 Q 32 60 50 58 Q 68 60 76 54" fill="none" stroke="${GREEN_DEEP}" stroke-width="0.75" stroke-linecap="round" opacity="0.35"/>
</svg>`;
}
