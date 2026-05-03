/** Slugs reservados — não podem ser usados como URL de empresa (alinhado às Cloud Functions). */
export const RESERVED_COMPANY_SLUGS = new Set([
  'master',
  'admin',
  'login',
  'registro',
  'cadastro',
  'esqueci-senha',
  'redefinir-senha',
  'curso',
  'cursos',
  'perfil',
  'api',
  'static',
  'assets',
  'vendedor',
  'dashboard',
  'metricas',
  'saude-mental',
  'sobre',
  'contato',
  'termos',
  'privacidade',
  'compromissos',
  'confidencialidade-vendedor',
]);

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
