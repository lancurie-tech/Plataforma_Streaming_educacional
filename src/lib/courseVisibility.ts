import { canViewAudience, canViewByClassification } from '@/lib/contentAudience';
import type {
  ContentAudience,
  ModuleContent,
  ModuleMaterialLink,
  ModuleStep,
  QuestionDef,
  UserProfile,
} from '@/types';

const EMPTY_STEPS: ModuleStep[] = [];

/**
 * Nível/área efetivos do passo: listas no passo substituem só quando não vazias; caso contrário herdam-se as do módulo.
 * (Área é ignorada em `canViewByClassification` — standby; só nível restringe.)
 */
export function effectiveStepClassification(
  module: ModuleContent,
  st: ModuleStep,
): { roles: string[] | undefined; depts: string[] | undefined } {
  const sr = st.visibleToRoles?.filter(Boolean);
  const sd = st.visibleToDepartments?.filter(Boolean);
  return {
    roles: sr && sr.length > 0 ? sr : module.visibleToRoles,
    depts: sd && sd.length > 0 ? sd : module.visibleToDepartments,
  };
}

export type StudentModuleViewContext = {
  previewMode: boolean;
  profile: UserProfile | null | undefined;
};

export type StudentModuleView = {
  showInCourseList: boolean;
  gateModule: boolean;
  useSteps: boolean;
  visibleSteps: ModuleStep[];
  quizQuestions: QuestionDef[];
  visibleLegacyQuestions: QuestionDef[];
  seeMat: (st: ModuleStep, mat: ModuleMaterialLink) => boolean;
  seeQInStep: (st: ModuleStep, q: QuestionDef) => boolean;
};

function syntheticProfile(): UserProfile {
  const now = new Date();
  return {
    id: '_analytics',
    name: '',
    email: '',
    role: 'student',
    createdAt: now,
    updatedAt: now,
  };
}

const SYNTHETIC_CTX: StudentModuleViewContext = {
  previewMode: false,
  profile: syntheticProfile(),
};

function analyticsCtxForRole(roleId: unknown): StudentModuleViewContext {
  if (typeof roleId !== 'string' || !roleId.trim()) return SYNTHETIC_CTX;
  const profile = syntheticProfile();
  profile.companyRoleId = roleId.trim();
  return { previewMode: false, profile };
}

export function computeStudentModuleView(
  module: ModuleContent,
  ctx: StudentModuleViewContext,
): StudentModuleView {
  const stepsInner = module.steps?.length ? module.steps : EMPTY_STEPS;
  const useStepsInner = stepsInner.length > 0;
  const see = (a?: ContentAudience) => canViewAudience(a, ctx);
  const classGate = canViewByClassification(module.visibleToRoles, module.visibleToDepartments, ctx);
  const gate = see(module.audience) && classGate;
  const seeStep = (st: ModuleStep) => {
    if (!see(module.audience) || !see(st.audience)) return false;
    const { roles, depts } = effectiveStepClassification(module, st);
    return canViewByClassification(roles, depts, ctx);
  };
  const seeMatFn = (st: ModuleStep, mat: ModuleMaterialLink) => seeStep(st) && see(mat.audience);
  const seeQStep = (st: ModuleStep, q: QuestionDef) => seeStep(st) && see(q.audience);
  const seeQLegacy = (q: QuestionDef) => gate && see(q.audience);

  const stepHasVisibleSurface = (st: ModuleStep): boolean => {
    if (!seeStep(st)) return false;
    if (st.kind === 'materials') {
      const mats = st.materials?.filter((m) => seeMatFn(st, m)) ?? [];
      return Boolean(st.body?.trim()) || mats.length > 0;
    }
    if (st.kind === 'video') {
      return Boolean(st.body?.trim() || st.vimeoUrl?.trim());
    }
    if (st.kind === 'quiz') {
      const qs = st.questions?.filter((q) => seeQStep(st, q)) ?? [];
      return qs.length > 0;
    }
    return false;
  };

  const visibleSteps = stepsInner.filter(stepHasVisibleSurface);

  let quizQ: QuestionDef[] = [];
  if (module.steps?.length) {
    for (const s of module.steps) {
      if (s.kind !== 'quiz' || !s.questions?.length) continue;
      if (!seeStep(s)) continue;
      for (const q of s.questions) {
        if (seeQStep(s, q)) quizQ.push(q);
      }
    }
  } else {
    quizQ = module.questions.filter(seeQLegacy);
  }

  const visibleLegacyQuestions = module.questions.filter(seeQLegacy);

  let showInCourseList = false;
  if (!gate) {
    showInCourseList = false;
  } else if (useStepsInner) {
    showInCourseList = visibleSteps.length > 0;
  } else {
    showInCourseList = Boolean(
      module.content?.trim() ||
        module.vimeoUrl?.trim() ||
        module.pdfUrl?.trim() ||
        visibleLegacyQuestions.length > 0,
    );
  }

  return {
    showInCourseList,
    gateModule: gate,
    useSteps: useStepsInner,
    visibleSteps,
    quizQuestions: quizQ,
    visibleLegacyQuestions,
    seeMat: seeMatFn,
    seeQInStep: seeQStep,
  };
}

/**
 * Para relatórios: o módulo tem conteúdo visível?
 * Segundo parâmetro mantido por compatibilidade (ignorado — legado gestor/colaborador removido).
 */
export function moduleAppliesToCompanyRole(
  module: ModuleContent,
  roleId?: unknown,
): boolean {
  return computeStudentModuleView(module, analyticsCtxForRole(roleId)).showInCourseList;
}

export function gradableQuestionIdsForRole(
  module: ModuleContent,
  roleId?: unknown,
): Set<string> {
  const v = computeStudentModuleView(module, analyticsCtxForRole(roleId));
  const ids = new Set<string>();
  for (const q of v.quizQuestions) ids.add(q.id);
  for (const q of v.visibleLegacyQuestions) ids.add(q.id);
  return ids;
}

export function questionVisibleToCompanyRole(
  module: ModuleContent,
  questionId: string,
  roleId?: unknown,
): boolean {
  return gradableQuestionIdsForRole(module, roleId).has(questionId);
}
