/**
 * Contrato comercial vs capacidades internas do app.
 *
 * Contrato (`enabledModuleIds` gravado pelo master): apenas
 * `streaming` | `cursos` | `chat` | `vendedores`
 *
 * Também aceitamos tokens legados (ex.: `streaming-admin`) e expandimos
 * como equivalentes comerciais.
 *
 * Sempre disponível para utilizadores com tenant (não faz parte do toggle): gestão base
 * via `site-institucional` e `branding-white-label`.
 */

export const COMMERCIAL_MODULE_IDS = ['streaming', 'cursos', 'chat', 'vendedores'] as const;
export type CommercialModuleId = (typeof COMMERCIAL_MODULE_IDS)[number];

const COMMERCIAL_SET = new Set<string>(COMMERCIAL_MODULE_IDS);

const STREAMING_TECH = new Set([
  'streaming-publico',
  'streaming-admin',
]);

const CURSOS_TECH = new Set([
  'catalogo-cursos',
  'admin-cursos',
  'analytics-insights',
  'certificados',
  'core-tenant-admin',
]);

/** Sempre disponível dentro de um tenant (não vai em marketplace). */
const BASELINE_CAPABILITIES = new Set(['site-institucional', 'branding-white-label']);

/** Capacidades técnicas já usadas pelo router/UI (legado). */
const ALL_KNOWN_TECH = new Set<string>([
  ...STREAMING_TECH,
  ...CURSOS_TECH,
  'portal-vendedor',
  'core-auth-access',
  ...BASELINE_CAPABILITIES,
]);

function addStreamingCapabilities(out: Set<string>) {
  out.add('streaming-publico');
  out.add('streaming-admin');
}

function addCursosCapabilities(out: Set<string>) {
  out.add('catalogo-cursos');
  out.add('admin-cursos');
  out.add('analytics-insights');
  out.add('certificados');
  out.add('core-tenant-admin');
}

/**
 * Mapa comercial -> capacidades usadas em `hasModule('…')` para rotas e menus.
 */
function expandCommercialToCapabilities(commercial: ReadonlySet<string>): Set<string> {
  const out = new Set<string>(BASELINE_CAPABILITIES);
  if (commercial.has('streaming')) addStreamingCapabilities(out);
  if (commercial.has('cursos')) addCursosCapabilities(out);
  if (commercial.has('vendedores')) out.add('portal-vendedor');
  return out;
}

/**
 * Infere conjunto comercial a partir dos tokens em `enabledModuleIds`
 * (comercial + técnico legado).
 */
export function deriveCommercialModules(enabledModuleIds: readonly string[]): Set<CommercialModuleId> {
  const out = new Set<CommercialModuleId>();
  for (const id of enabledModuleIds) {
    if (COMMERCIAL_SET.has(id)) out.add(id as CommercialModuleId);
  }
  for (const id of enabledModuleIds) {
    if (STREAMING_TECH.has(id)) out.add('streaming');
    else if (CURSOS_TECH.has(id)) out.add('cursos');
    else if (id === 'portal-vendedor') out.add('vendedores');
  }
  return out;
}

/**
 * Conjunto final de permissões efetivas (baseline + expansão do comercial +
 * inclusão direta de qualquer técnico legado ainda não coberto por expansões).
 */
export function resolveEffectiveLegacyCapabilities(enabledModuleIds: readonly string[]): Set<string> {
  const commercial = deriveCommercialModules(enabledModuleIds);
  const out = expandCommercialToCapabilities(commercial);

  /** Chat não aparece como rota própria: só combinado nas telas (`streaming`+`chat` ou `cursos`+`chat`). */
  for (const id of enabledModuleIds) {
    if (COMMERCIAL_SET.has(id)) continue;
    if (id === 'chat') continue;
    /** Token técnico conhecido (ou granular legado): mantém comportamento anterior. */
    if (ALL_KNOWN_TECH.has(id)) out.add(id);
  }
  return out;
}

export function hasCommercialModule(
  enabledModuleIds: readonly string[],
  module: CommercialModuleId
): boolean {
  return deriveCommercialModules(enabledModuleIds).has(module);
}

export function hasLegacyCapability(enabledModuleIds: readonly string[], capabilityId: string): boolean {
  if (BASELINE_CAPABILITIES.has(capabilityId)) return true;
  const eff = resolveEffectiveLegacyCapabilities(enabledModuleIds);
  return eff.has(capabilityId);
}

