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
 * Logo principal em `public/` (SVG ou PNG) quando não há `logoUrl` no Firestore.
 */
export const PLATFORM_LOGO_SRC = '/logo.svg';

/** Identidade já aplicando overrides do Firestore (uso em runtime React/PDF). */
export type ResolvedBranding = {
  platformDisplayName: string;
  platformShortName: string;
  streamingAssistantChatTitle: string;
  vendorDisplayFallback: string;
  /** URL absoluta Storage ou caminho em `public/` (ex. `/logo.svg`). */
  logoSrc: string;
};

export function defaultResolvedBranding(): ResolvedBranding {
  return {
    platformDisplayName: PLATFORM_DISPLAY_NAME,
    platformShortName: PLATFORM_SHORT_NAME,
    streamingAssistantChatTitle: STREAMING_ASSISTANT_CHAT_TITLE,
    vendorDisplayFallback: VENDOR_DISPLAY_FALLBACK,
    logoSrc: PLATFORM_LOGO_SRC,
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
  };
}
