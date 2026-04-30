import type { CompanyCourseAssignment, ModuleScheduleEntry } from '@/types';

function fmt(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function assignmentHasModuleSchedule(a: CompanyCourseAssignment | null | undefined): boolean {
  if (!a?.moduleSchedule) return false;
  return Object.values(a.moduleSchedule).some((s) => s?.opensAt || s?.closesAt);
}

/** `now` dentro da janela configurada (opens 00:00 — closes 23:59 no admin). */
export function isNowWithinModuleWindow(now: Date, e: ModuleScheduleEntry | undefined): boolean {
  if (!e) return false;
  const t = now.getTime();
  if (e.opensAt && t < e.opensAt.getTime()) return false;
  if (e.closesAt && t > e.closesAt.getTime()) return false;
  return Boolean(e.opensAt || e.closesAt);
}

export type StudentModuleLockResult = { locked: boolean; message: string };

/**
 * Trava de módulo para aluno com empresa: combina trilha linear e agendamento por módulo (empresa).
 * Módulos já concluídos permanecem acessíveis para revisão.
 */
export function computeStudentModuleLock(args: {
  now: Date;
  moduleIndex: number;
  moduleId: string;
  orderedModuleIds: string[];
  completedByModule: Record<string, boolean>;
  companyCourseAssignment: CompanyCourseAssignment | null | undefined;
  previewMode: boolean;
  role: string | undefined;
}): StudentModuleLockResult {
  const {
    now,
    moduleIndex,
    moduleId,
    orderedModuleIds,
    completedByModule,
    companyCourseAssignment,
    previewMode,
    role,
  } = args;

  const defaultLinearMsg = 'Conclua o módulo anterior para desbloquear este.';

  if (previewMode || role !== 'student') {
    return { locked: false, message: defaultLinearMsg };
  }

  if (completedByModule[moduleId]) {
    return { locked: false, message: defaultLinearMsg };
  }

  const prevId = moduleIndex > 0 ? orderedModuleIds[moduleIndex - 1] : null;
  const linearBlocked = prevId != null && !completedByModule[prevId];

  const a = companyCourseAssignment;
  if (!assignmentHasModuleSchedule(a)) {
    return {
      locked: linearBlocked,
      message: defaultLinearMsg,
    };
  }

  const entry = a?.moduleSchedule?.[moduleId];
  if (!entry || (!entry.opensAt && !entry.closesAt)) {
    return {
      locked: true,
      message:
        'As datas deste módulo ainda não foram definidas pela empresa. Entre em contato com o administrador do treinamento.',
    };
  }

  if (!isNowWithinModuleWindow(now, entry)) {
    if (entry.opensAt && now.getTime() < entry.opensAt.getTime()) {
      return {
        locked: true,
        message: `Este módulo abre em ${fmt(entry.opensAt)}.`,
      };
    }
    if (entry.closesAt && now.getTime() > entry.closesAt.getTime()) {
      return {
        locked: true,
        message: `O período de acesso a este módulo encerrou em ${fmt(entry.closesAt)}.`,
      };
    }
    return {
      locked: true,
      message: 'Este módulo não está disponível no calendário da empresa.',
    };
  }

  if (linearBlocked) {
    return { locked: true, message: defaultLinearMsg };
  }

  return { locked: false, message: defaultLinearMsg };
}
