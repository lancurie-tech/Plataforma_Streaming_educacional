import type {
  ModuleContent,
  ModuleMaterialLink,
  ModuleStep,
  ModuleStepProgress,
  QuestionDef,
} from '@/types';

/** Chave única para progresso do módulo “legado” (sem `steps`). */
export const LEGACY_PROGRESS_KEY = '__legacy';

/**
 * Chave em `stepProgress` para um passo na lista visível.
 * Se vários passos repetem o mesmo `id`, cada índice tem chave própria (evita um vídeo liberar todos).
 */
export function stepProgressStorageKey(steps: ModuleStep[], index: number): string {
  const st = steps[index];
  if (!st) return `__idx_${index}`;
  const hasDuplicateId = steps.some((o, j) => j !== index && o.id === st.id);
  if (hasDuplicateId) {
    return `${st.id}::__${index}`;
  }
  return st.id;
}

/** Lê progresso do passo, com migração da chave legada só no primeiro índice entre ids duplicados. */
export function getStepProgressForIndex(
  steps: ModuleStep[],
  index: number,
  stepProgress: Record<string, ModuleStepProgress>
): ModuleStepProgress | undefined {
  const st = steps[index];
  if (!st) return undefined;
  const key = stepProgressStorageKey(steps, index);
  if (stepProgress[key] !== undefined) {
    return stepProgress[key];
  }
  const hasDup = steps.some((o, j) => j !== index && o.id === st.id);
  if (hasDup) {
    const firstIdx = steps.findIndex((o) => o.id === st.id);
    if (index !== firstIdx) return undefined;
  }
  return stepProgress[st.id];
}

export function isStepSatisfied(
  step: ModuleStep,
  answers: Record<string, number>,
  progress: ModuleStepProgress | undefined,
  seeQuestion: (step: ModuleStep, q: QuestionDef) => boolean,
  seeMaterial: (step: ModuleStep, m: ModuleMaterialLink) => boolean
): boolean {
  if (step.kind === 'video') {
    return progress?.videoWatchedToEnd === true;
  }
  if (step.kind === 'materials') {
    const mats = step.materials?.filter((m) => seeMaterial(step, m)) ?? [];
    if (mats.length === 0 && !step.body?.trim()) {
      return true;
    }
    return progress?.materialsDone === true;
  }
  if (step.kind === 'quiz') {
    const qs = step.questions?.filter((q) => seeQuestion(step, q)) ?? [];
    if (qs.length === 0) return true;
    return qs.every((q) => answers[q.id] !== undefined);
  }
  return true;
}

/** Índices 0..N que o aluno pode abrir (último pode ser o primeiro passo ainda incompleto). */
export function maxUnlockedStepIndex(
  steps: ModuleStep[],
  answers: Record<string, number>,
  stepProgress: Record<string, ModuleStepProgress>,
  seeQuestion: (step: ModuleStep, q: QuestionDef) => boolean,
  seeMaterial: (step: ModuleStep, m: ModuleMaterialLink) => boolean
): number {
  if (steps.length === 0) return -1;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i]!;
    const p = getStepProgressForIndex(steps, i, stepProgress);
    if (!isStepSatisfied(st, answers, p, seeQuestion, seeMaterial)) {
      return i;
    }
  }
  return steps.length - 1;
}

export function allStepsSatisfied(
  steps: ModuleStep[],
  answers: Record<string, number>,
  stepProgress: Record<string, ModuleStepProgress>,
  seeQuestion: (step: ModuleStep, q: QuestionDef) => boolean,
  seeMaterial: (step: ModuleStep, m: ModuleMaterialLink) => boolean
): boolean {
  return steps.every((st, i) =>
    isStepSatisfied(st, answers, getStepProgressForIndex(steps, i, stepProgress), seeQuestion, seeMaterial)
  );
}

export function allQuizQuestionsAnswered(questions: QuestionDef[], answers: Record<string, number>): boolean {
  if (questions.length === 0) return true;
  return questions.every((q) => answers[q.id] !== undefined);
}

export function canFinalizeStepModule(
  visibleSteps: ModuleStep[],
  quizQuestions: QuestionDef[],
  answers: Record<string, number>,
  stepProgress: Record<string, ModuleStepProgress>,
  seeQuestion: (step: ModuleStep, q: QuestionDef) => boolean,
  seeMaterial: (step: ModuleStep, m: ModuleMaterialLink) => boolean
): boolean {
  return (
    allStepsSatisfied(visibleSteps, answers, stepProgress, seeQuestion, seeMaterial) &&
    allQuizQuestionsAnswered(quizQuestions, answers)
  );
}

export function isLegacyModuleSatisfied(
  _module: ModuleContent,
  visibleLegacyQuestions: QuestionDef[],
  answers: Record<string, number>,
  legacyProgress: ModuleStepProgress | undefined,
  hasEmbeddableVideo: boolean,
  hasPdf: boolean
): boolean {
  if (!allQuizQuestionsAnswered(visibleLegacyQuestions, answers)) {
    return false;
  }
  if (hasEmbeddableVideo && legacyProgress?.videoWatchedToEnd !== true) {
    return false;
  }
  if (hasPdf && legacyProgress?.materialsDone !== true) {
    return false;
  }
  return true;
}
