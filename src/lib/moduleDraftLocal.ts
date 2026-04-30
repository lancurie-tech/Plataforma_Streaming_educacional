import type { ModuleStepProgress } from '@/types';

const PREFIX = 'medivox:moduleDraft:v1:';

export type ModuleDraftLocalV1 = {
  v: 1;
  answers: Record<string, number>;
  stepProgress: Record<string, ModuleStepProgress>;
  stepIndex: number;
  savedAt: number;
};

function key(uid: string, courseId: string, moduleId: string): string {
  return `${PREFIX}${uid}:${courseId}:${moduleId}`;
}

export function loadModuleDraftLocal(
  uid: string,
  courseId: string,
  moduleId: string
): ModuleDraftLocalV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key(uid, courseId, moduleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1) return null;
    const answers =
      o.answers && typeof o.answers === 'object'
        ? (o.answers as Record<string, number>)
        : {};
    const stepProgress =
      o.stepProgress && typeof o.stepProgress === 'object'
        ? (o.stepProgress as Record<string, ModuleStepProgress>)
        : {};
    const stepIndex = typeof o.stepIndex === 'number' && o.stepIndex >= 0 ? o.stepIndex : 0;
    const savedAt = typeof o.savedAt === 'number' ? o.savedAt : 0;
    return { v: 1, answers, stepProgress, stepIndex, savedAt };
  } catch {
    return null;
  }
}

export function saveModuleDraftLocal(
  uid: string,
  courseId: string,
  moduleId: string,
  draft: ModuleDraftLocalV1
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(uid, courseId, moduleId), JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

export function clearModuleDraftLocal(uid: string, courseId: string, moduleId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(uid, courseId, moduleId));
  } catch {
    /* */
  }
}
