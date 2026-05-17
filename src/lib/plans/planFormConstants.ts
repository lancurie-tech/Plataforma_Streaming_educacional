/** Chaves de `plans/{id}.limits` usadas no seed — editáveis na Master sem perder outros campos. */
export const PLAN_LIMIT_FIELD_KEYS = [
  'maxActiveUsers',
  'maxStorageGb',
  'maxPublishedVideoHours',
  'maxLiveStreamsPerMonth',
  'maxActiveCourses',
  'maxEnabledModules',
] as const;

export type PlanLimitFieldKey = (typeof PLAN_LIMIT_FIELD_KEYS)[number];

export const PLAN_LIMIT_LABELS_PT: Record<PlanLimitFieldKey, string> = {
  maxActiveUsers: 'Utilizadores ativos (máx.)',
  maxStorageGb: 'Armazenamento (GB)',
  maxPublishedVideoHours: 'Horas de vídeo publicadas',
  maxLiveStreamsPerMonth: 'Transmissões ao vivo por mês',
  maxActiveCourses: 'Cursos ativos',
  maxEnabledModules: 'Módulos comerciais (teto técnico)',
};

export const PLAN_COMMERCIAL_MODULE_LABELS_PT: Record<string, string> = {
  streaming: 'Streaming',
  cursos: 'Cursos',
  chat: 'Chat / assistente',
  vendedores: 'Portal de vendedores',
};
