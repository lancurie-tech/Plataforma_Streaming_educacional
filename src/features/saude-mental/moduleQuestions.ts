import type { ModuleContent, QuestionDef } from '@/types';

/** Mesma ordem que `collectQuestionsByModule` em analytics — importante para mapear Q1…Q10 ao Excel. */
export function orderedQuizQuestionsForModule(mod: ModuleContent): QuestionDef[] {
  const list: QuestionDef[] = [];
  if (mod.questions?.length) list.push(...mod.questions);
  for (const s of mod.steps ?? []) {
    if (s.kind === 'quiz' && s.questions?.length) list.push(...s.questions);
  }
  return list;
}

/** Converte índice da opção (0-based) para escala tipo Likert 1–5. */
export function optionIndexToLikert(answerIdx: number, optionCount: number): number {
  if (typeof answerIdx !== 'number' || answerIdx < 0 || optionCount < 2) return NaN;
  if (optionCount === 5) return answerIdx + 1;
  return 1 + (answerIdx / (optionCount - 1)) * 4;
}
