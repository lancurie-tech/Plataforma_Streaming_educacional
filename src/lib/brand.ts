/**
 * Identidade genérica da plataforma (substitui marca anterior).
 * Ajuste aqui ao white-label ou ao nome comercial definitivo.
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
 */
export const STORAGE_NS = 'pse';

/**
 * Logo principal em `public/` (SVG ou PNG).
 * Substitui por rotas dedicadas (ex.: `/logo-plataforma-branco.png`) quando tiveres novos assets.
 */
export const PLATFORM_LOGO_SRC = '/logo.svg';
