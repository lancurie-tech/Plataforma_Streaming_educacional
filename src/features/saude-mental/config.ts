/**
 * Curso alvo do painel ampliado de Saúde Mental.
 * Sobrescrever com `VITE_SAUDE_MENTAL_COURSE_ID` em `.env` se necessário (ex.: outro ambiente).
 */
export const SAUDE_MENTAL_COURSE_ID =
  (import.meta.env.VITE_SAUDE_MENTAL_COURSE_ID as string | undefined)?.trim() ||
  'lJYnm9IPb60lhblMkaJ2';

/**
 * IDs dos 3 módulos de instrumento (T0, T1, T2 = Instrumento 01…03 no Excel), separados por vírgula.
 * Ex.: `YVDA5...,AbCd...,XyZ...`
 * Se omitido, deteta pelo título: "Instrumento de Autopercepção 1/2", terceiro como "Instrumento de Autopercepção"
 * (sem número) ou "…3"; ou legado "Instrumento 01/02/03".
 */
export const SAUDE_MENTAL_INSTRUMENT_MODULE_IDS_ENV =
  (import.meta.env.VITE_SAUDE_MENTAL_INSTRUMENT_MODULE_IDS as string | undefined)?.trim() ?? '';

/** Dimensões do instrumento de autopercepção (alinhado ao projeto de referência). */
export const SAUDE_MENTAL_DIMENSIONS = [
  { id: 'q1', label: 'Autoconfiança', hint: 'Sinais de alerta e reconhecimento da necessidade de apoio.' },
  { id: 'q2', label: 'Busca de apoio', hint: 'Acolher sem diagnosticar; limites profissionais.' },
  { id: 'q3', label: 'Atitude', hint: 'Falar sobre saúde mental no trabalho.' },
  { id: 'q4', label: 'Conhecimento', hint: 'Papéis, limites e encaminhamento.' },
  { id: 'q5', label: 'Ambiente seguro', hint: 'Pedir apoio sem medo de retaliação.' },
  { id: 'q6', label: 'Intenção', hint: 'Agir diante de sofrimento emocional (próximos 30 dias).' },
  { id: 'q7', label: 'Carga de trabalho', hint: 'Sustentabilidade da carga e ritmo.' },
  { id: 'q8', label: 'Responsabilidade', hint: 'Prioridades e limites no trabalho.' },
] as const;
