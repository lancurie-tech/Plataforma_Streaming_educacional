/**
 * Métricas de engajamento (funil, módulos, trilhas) — baseadas no dashboard de referência,
 * adaptadas a IDs de módulo (`mod-*`) e participantes derivados do Firestore.
 */
import type { ModuleContent } from '@/types';
import { moduleAppliesToCompanyRole } from '@/lib/courseVisibility';
import type {
  CourseFunnelStage,
  CourseMetrics,
  CourseParticipant,
  CoursePeriodOption,
  ModulePerformance,
  TrackDistribution,
  TrackRequirementSummary,
} from '@/features/saude-mental/typesCourse';

/** Título do módulo para métricas; evita mostrar só o ID do documento quando `title` está vazio. */
export function moduleDisplayName(mod: ModuleContent): string {
  const t = mod.title?.trim();
  if (t) return t;
  const steps = mod.steps?.slice().sort((a, b) => a.order - b.order) ?? [];
  const firstStepTitle = steps.find((s) => s.title?.trim())?.title?.trim();
  if (firstStepTitle) return firstStepTitle;
  if (typeof mod.order === 'number' && mod.order > 0) return `Módulo ${mod.order}`;
  return mod.id;
}

const safeRate = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
};

const mean = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const meanOrNaN = (values: number[]) => {
  if (!values.length) return Number.NaN;
  return mean(values);
};

const parseCourseDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const differenceInDays = (start?: string, end?: string) => {
  const startDate = parseCourseDate(start);
  const endDate = parseCourseDate(end);
  if (!startDate || !endDate) return undefined;
  const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 ? diff : undefined;
};

const getCoursePeriodKey = (participant: CourseParticipant) => {
  const referenceDate = parseCourseDate(participant.enrolled_at);
  if (!referenceDate) return undefined;
  const year = String(referenceDate.getFullYear());
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatCoursePeriodLabel = (periodKey: string) => {
  const [year, month] = periodKey.split('-').map(Number);
  const labelDate = new Date(year, (month || 1) - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(labelDate);
};

export const filterCourseParticipants = (
  participants: CourseParticipant[],
  selectedEmpresa: string,
  selectedTrilha: string,
  selectedPeriodo: string
) => {
  return participants.filter((participant) => {
    const matchesEmpresa = selectedEmpresa === 'todas' || participant.company_id === selectedEmpresa;
    const matchesTrilha = selectedTrilha === 'todas' || participant.track === selectedTrilha;
    const matchesPeriodo = selectedPeriodo === 'todos' || getCoursePeriodKey(participant) === selectedPeriodo;
    return matchesEmpresa && matchesTrilha && matchesPeriodo;
  });
};

export const calculateCourseMetrics = (participants: CourseParticipant[]): CourseMetrics => {
  const eligibleCount = participants.filter((p) => p.eligible).length;
  const invitedCount = participants.filter((p) => p.invited).length;
  const enrolledCount = participants.filter((p) => p.enrolled).length;
  const startedCount = participants.filter((p) => p.started).length;
  const completedCount = participants.filter((p) => p.completed).length;
  const avgProgress = mean(participants.map((p) => p.progress_pct));
  const daysToStart = participants
    .map((p) => differenceInDays(p.enrolled_at, p.first_access_at))
    .filter((value): value is number => value !== undefined);
  const daysToCompletion = participants
    .map((p) => differenceInDays(p.enrolled_at, p.completed_at))
    .filter((value): value is number => value !== undefined);
  const instrument1Count = participants.filter((p) => p.instrument_1_status === 'concluido').length;
  const instrument2Count = participants.filter((p) => p.instrument_2_status === 'concluido').length;
  const instrument3Count = participants.filter((p) => p.instrument_3_status === 'concluido').length;

  return {
    eligibleCount,
    invitedCount,
    enrolledCount,
    startedCount,
    completedCount,
    adherenceRate: safeRate(enrolledCount, eligibleCount),
    penetrationRate: safeRate(startedCount, eligibleCount),
    completionRate: safeRate(completedCount, enrolledCount),
    completionPenetrationRate: safeRate(completedCount, eligibleCount),
    avgProgress,
    avgDaysToStart: meanOrNaN(daysToStart),
    avgDaysToCompletion: meanOrNaN(daysToCompletion),
    instrument1Rate: safeRate(instrument1Count, enrolledCount),
    instrument2Rate: safeRate(instrument2Count, enrolledCount),
    instrument3Rate: safeRate(instrument3Count, enrolledCount),
  };
};

export const calculateCourseFunnel = (metrics: CourseMetrics): CourseFunnelStage[] => {
  return [
    { key: 'eligible', label: 'Elegíveis', count: metrics.eligibleCount, rateFromEligible: 100 },
    {
      key: 'enrolled',
      label: 'Inscritos',
      count: metrics.enrolledCount,
      rateFromEligible: safeRate(metrics.enrolledCount, metrics.eligibleCount),
    },
    {
      key: 'started',
      label: 'Iniciaram',
      count: metrics.startedCount,
      rateFromEligible: safeRate(metrics.startedCount, metrics.eligibleCount),
    },
    {
      key: 'completed',
      label: 'Concluíram',
      count: metrics.completedCount,
      rateFromEligible: safeRate(metrics.completedCount, metrics.eligibleCount),
    },
  ];
};

export const calculateTrackDistribution = (participants: CourseParticipant[]): TrackDistribution[] => {
  const total = participants.length;
  const grouped = new Map<string, CourseParticipant[]>();

  participants.forEach((participant) => {
    const key = participant.track || 'não informado';
    const list = grouped.get(key) ?? [];
    list.push(participant);
    grouped.set(key, list);
  });

  return [...grouped.entries()]
    .map(([track, rows]) => {
      const completed = rows.filter((row) => row.completed).length;
      return {
        track,
        participants: rows.length,
        share: safeRate(rows.length, total),
        completed,
        completionRate: safeRate(completed, rows.length),
      };
    })
    .sort((a, b) => b.participants - a.participants);
};

export const getCoursePeriodOptions = (participants: CourseParticipant[]): CoursePeriodOption[] => {
  const periodKeys = [
    ...new Set(participants.map(getCoursePeriodKey).filter((value): value is string => Boolean(value))),
  ];
  return periodKeys
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: formatCoursePeriodLabel(value),
    }));
};

/** Uma barra por módulo de conteúdo (exclui os 3 módulos de instrumento). */
export function buildModulePerformanceFromCourseModules(
  participants: CourseParticipant[],
  modules: ModuleContent[],
  instrumentIds: Set<string>,
  enrollmentRows: Array<{
    uid: string;
    enrolled: boolean;
    companyRole?: string | null;
    moduleStatuses: Record<string, 'draft' | 'completed'>;
  }>
): ModulePerformance[] {
  const learningMods = modules.filter((m) => !instrumentIds.has(m.id));
  const byUid = new Map(enrollmentRows.map((r) => [r.uid, r]));

  return learningMods
    .map((mod) => {
      let applicable = 0;
      let completed = 0;
      for (const p of participants) {
        const row = byUid.get(p.participant_id);
        if (!row?.enrolled) continue;
        if (!moduleAppliesToCompanyRole(mod, row.companyRole)) continue;
        applicable += 1;
        if (row.moduleStatuses[mod.id] === 'completed') completed += 1;
      }
      const completionRate = safeRate(completed, applicable);
      return {
        moduleId: mod.id,
        moduleOrder: mod.order,
        moduleName: moduleDisplayName(mod),
        applicableParticipants: applicable,
        completedParticipants: completed,
        completionRate,
        averageProgress: completionRate,
        requiredItems: 1,
        audience: 'all' as ModulePerformance['audience'],
      };
    })
    .sort((a, b) => a.moduleOrder - b.moduleOrder || a.moduleId.localeCompare(b.moduleId, 'pt-BR', { numeric: true }));
}

export function buildTrackRequirementSummary(
  modules: ModuleContent[],
  instrumentIds: Set<string>
): TrackRequirementSummary {
  const courseMods = modules.filter((m) => !instrumentIds.has(m.id));
  const collaboratorItems = courseMods.length;
  const managerItems = courseMods.length;
  const managerExclusive = 0;
  const collaboratorModules = new Set(courseMods.map((m) => m.id)).size;
  const managerModules = collaboratorModules;

  return {
    collaboratorRequiredItems: collaboratorItems,
    managerRequiredItems: managerItems,
    managerExclusiveItems: managerExclusive,
    collaboratorRequiredModules: collaboratorModules,
    managerRequiredModules: managerModules,
    instrumentCount: instrumentIds.size,
  };
}
