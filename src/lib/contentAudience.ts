import type { ContentAudience, UserProfile } from '@/types';

export function parseContentAudience(raw: unknown): ContentAudience {
  if (raw === 'all') return raw;
  return 'all';
}

/**
 * Verificação de audiência legada — agora que gestor/colaborador foi removido,
 * a audiência é sempre 'all' e esta função retorna true.
 * Mantida para compatibilidade com dados antigos no Firestore.
 */
export function canViewAudience(
  _audience: ContentAudience | undefined,
  opts: { previewMode: boolean; profile: UserProfile | null | undefined },
): boolean {
  if (opts.previewMode) return true;
  if (opts.profile?.role === 'admin') return true;
  return true;
}

/**
 * Verifica restrição por nível (roleIds / companyRoleId).
 * `visibleToDepartments` permanece no modelo de dados e no editor, mas está em standby:
 * não restringe quem vê o conteúdo — a área do usuário segue no cadastro para métricas e chaves.
 */
export function canViewByClassification(
  visibleToRoles: string[] | undefined,
  visibleToDepartments: string[] | undefined,
  opts: { previewMode: boolean; profile: UserProfile | null | undefined },
): boolean {
  void visibleToDepartments;
  if (opts.previewMode) return true;
  if (opts.profile?.role === 'admin') return true;

  const roleIds = visibleToRoles?.filter(Boolean);
  if (!roleIds || roleIds.length === 0) return true;

  const userRoleId = opts.profile?.companyRoleId;
  if (!userRoleId || !roleIds.includes(userRoleId)) return false;
  return true;
}
