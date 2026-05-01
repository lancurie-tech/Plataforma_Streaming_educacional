import type { BrandingFirestoreDoc } from '@/lib/firestore/branding';

/**
 * Identidade genérica da plataforma (substitui marca anterior).
 * Valores aqui são *defaults* quando não há personalização no Firestore (`siteContent/branding`).
 */
export const PLATFORM_DISPLAY_NAME = 'Plataforma de streaming educacional';

/** Cabeçalhos compactos (sidebars, rodapés curtos). */
export const PLATFORM_SHORT_NAME = 'Plataforma educacional';

/** Assistente na home de streaming (widget). */
export const STREAMING_ASSISTANT_CHAT_TITLE = 'Assistente';

/** Fallback quando o vendedor não tem nome no perfil. */
export const VENDOR_DISPLAY_FALLBACK = 'Vendedor';

/**
 * Namespace para `localStorage` e eventos — alterar reinicia preferências guardadas
 * (consentimento, onboarding, etc.), mas evita colisão com a implementação anterior.
 * Mantido só em código (não white-label por cliente).
 */
export const STORAGE_NS = 'pse';

/**
 * Sem fallback local para logo em white-label:
 * a marca deve vir apenas do `logoUrl` configurado no Firestore.
 */
export const PLATFORM_LOGO_SRC = '';
export const PLATFORM_FAVICON_SRC = '';

export type BrandPalette = {
  primary: string;
  primaryHover: string;
  accent: string;
  background: string;
  text: string;
  textMuted: string;
};

export const DEFAULT_BRAND_PALETTE: BrandPalette = {
  primary: '#059669',
  primaryHover: '#10b981',
  accent: '#34d399',
  background: '#0c0c0f',
  text: '#f4f4f5',
  textMuted: '#a1a1aa',
};

function pickHexOrDefault(value: string | undefined, fallback: string): string {
  const t = value?.trim();
  return t && /^#[0-9a-fA-F]{6}$/.test(t) ? t : fallback;
}

/** Identidade já aplicando overrides do Firestore (uso em runtime React/PDF). */
export type ResolvedBranding = {
  platformDisplayName: string;
  platformShortName: string;
  streamingAssistantChatTitle: string;
  vendorDisplayFallback: string;
  /** URL absoluta Storage ou caminho em `public/` (ex. `/logo.svg`). */
  logoSrc: string;
  /** URL absoluta Storage ou caminho em `public/` para ícone do navegador. */
  faviconSrc: string;
  palette: BrandPalette;
};

export function defaultResolvedBranding(): ResolvedBranding {
  return {
    platformDisplayName: PLATFORM_DISPLAY_NAME,
    platformShortName: PLATFORM_SHORT_NAME,
    streamingAssistantChatTitle: STREAMING_ASSISTANT_CHAT_TITLE,
    vendorDisplayFallback: VENDOR_DISPLAY_FALLBACK,
    logoSrc: PLATFORM_LOGO_SRC,
    faviconSrc: PLATFORM_FAVICON_SRC,
    palette: DEFAULT_BRAND_PALETTE,
  };
}

export function mergeFirestoreBranding(doc: BrandingFirestoreDoc | null): ResolvedBranding {
  const d = defaultResolvedBranding();
  if (!doc) return d;
  return {
    platformDisplayName: doc.platformDisplayName?.trim() || d.platformDisplayName,
    platformShortName: doc.platformShortName?.trim() || d.platformShortName,
    streamingAssistantChatTitle: doc.streamingAssistantChatTitle?.trim() || d.streamingAssistantChatTitle,
    vendorDisplayFallback: doc.vendorDisplayFallback?.trim() || d.vendorDisplayFallback,
    logoSrc: doc.logoUrl?.trim() || d.logoSrc,
    faviconSrc: doc.faviconUrl?.trim() || d.faviconSrc,
    palette: {
      primary: pickHexOrDefault(doc.palettePrimary, d.palette.primary),
      primaryHover: pickHexOrDefault(doc.palettePrimaryHover, d.palette.primaryHover),
      accent: pickHexOrDefault(doc.paletteAccent, d.palette.accent),
      background: pickHexOrDefault(doc.paletteBackground, d.palette.background),
      text: pickHexOrDefault(doc.paletteText, d.palette.text),
      textMuted: pickHexOrDefault(doc.paletteTextMuted, d.palette.textMuted),
    },
  };
}
