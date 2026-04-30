import { SAUDE_MENTAL_COURSE_ID } from '@/features/saude-mental/config';
import {
  buildCourseParticipantsFromRows,
  buildSurveyResponsesFromRows,
  resolveInstrumentModuleIds,
} from '@/features/saude-mental/buildSaudeMentalLive';
import {
  buildModulePerformanceFromMedivox,
  calculateCourseFunnel,
  calculateCourseMetrics,
  calculateTrackDistribution,
  filterCourseParticipants,
} from '@/features/saude-mental/courseMetricsMedivox';
import { getCourseTrackLabel } from '@/features/saude-mental/courseLabels';
import {
  calculateDimensionAnalysis,
  calculateGroupComparison,
  calculateHeadlineFlag,
  calculateMean,
  calculateTimeEvolution,
} from '@/features/saude-mental/surveyAnalysis';
import { loadCourseEnrollmentContext } from '@/lib/firestore/analytics';
import { fetchUserDemographicsForUids } from '@/lib/firestore/userDemographics';
import type { CourseMetrics, CourseFunnelStage, ModulePerformance, TrackDistribution } from '@/features/saude-mental/typesCourse';
import type { SurveyResponse } from '@/features/saude-mental/typesSurvey';
import { TIMEPOINT_LABELS } from '@/features/saude-mental/timepoints';

export type SaudeMentalCompanyPdfSnapshot = {
  courseTitle: string;
  companyId: string;
  companyName: string;
  instrumentTitles: { T0: string; T1: string; T2: string };
  courseMetrics: CourseMetrics;
  funnel: CourseFunnelStage[];
  modulePerformance: Array<{
    moduleName: string;
    applicable: number;
    completed: number;
    completionRate: number;
  }>;
  tracks: Array<{ track: string; label: string; participants: number; completionRate: number }>;
  instrumentRates: { T0: number; T1: number; T2: number };
  surveyByTempo: Array<{ tempo: string; label: string; responses: number; avgScore100: number }>;
  headlineT2: ReturnType<typeof calculateHeadlineFlag>;
  dimensionsT2vsT0: Array<{
    dimension: string;
    score100: number;
    delta: number;
    negativePercent: number;
    priority: string;
  }>;
  perTempo: Array<{
    tempo: 'T0' | 'T1' | 'T2';
    label: string;
    responses: number;
    avgScore100: number;
    headline: ReturnType<typeof calculateHeadlineFlag>;
    dimensionsVsT0: Array<{
      dimension: string;
      score100: number;
      delta: number;
      negativePercent: number;
      priority: string;
    }>;
    groupByTrilha: Array<{ group: string; label: string; score: number; count: number; alertPercent: number }>;
  }>;
  radarSeries: Array<{
    dimension: string;
    T0: number;
    T1: number;
    T2: number;
  }>;
  timeEvolution: { tempo: string; score: number }[];
  groupByTrilha: Array<{ group: string; label: string; score: number; count: number; alertPercent: number }>;
  /** Recorte fixo do PDF: uma empresa, todas as trilhas, visão consolidada de período. */
  recorteDescription: string;
};

function surveyStatsForTempo(data: SurveyResponse[], tempo: SurveyResponse['tempo']) {
  const filtered = data.filter((d) => d.tempo === tempo);
  const scores = filtered.map((d) => d.score_geral).filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  const avg = calculateMean(scores);
  return {
    responses: filtered.length,
    avgScore100: Number.isNaN(avg) ? 0 : avg,
  };
}

export async function buildSaudeMentalCompanyPdfSnapshot(
  companyId: string,
  managedCompanyIds: string[],
): Promise<{ ok: true; data: SaudeMentalCompanyPdfSnapshot } | { ok: false; error: string }> {
  if (!companyId.trim()) {
    return { ok: false, error: 'Empresa inválida.' };
  }
  if (!managedCompanyIds.includes(companyId)) {
    return { ok: false, error: 'Empresa fora da carteira.' };
  }

  const ctx = await loadCourseEnrollmentContext(SAUDE_MENTAL_COURSE_ID, {
    companyId,
    managedCompanyIds,
  });

  const companyName =
    ctx.companies.find((c) => c.id === companyId)?.name ?? ctx.rows.find((r) => r.companyId === companyId)?.companyName ?? companyId;

  const instruments = resolveInstrumentModuleIds(ctx.modules);
  if (!instruments) {
    return {
      ok: false,
      error:
        'Não foi possível identificar os três módulos de instrumento (T0/T1/T2). Configure VITE_SAUDE_MENTAL_INSTRUMENT_MODULE_IDS ou títulos reconhecíveis no curso.',
    };
  }

  const instrumentSet = new Set([instruments.T0, instruments.T1, instruments.T2]);
  const moduleById = new Map(ctx.modules.map((m) => [m.id, m]));
  const companyNameMap = new Map(ctx.companies.map((c) => [c.id, c.name]));

  const enrolledUids = ctx.rows.filter((r) => r.enrolled).map((r) => r.uid);
  const demographicsByUid = await fetchUserDemographicsForUids([...new Set(enrolledUids)]);

  const surveyAll = buildSurveyResponsesFromRows(
    ctx.rows,
    moduleById,
    instruments,
    companyNameMap,
    demographicsByUid,
  );
  const participantsAll = buildCourseParticipantsFromRows(
    ctx.rows,
    ctx.modules,
    instruments,
    instrumentSet,
    companyNameMap,
  );

  const selectedEmpresa = companyId;
  const selectedTrilha = 'todas';
  const selectedPeriodo = 'todos';

  const filteredSurvey = surveyAll.filter((r) => r.empresa_id === selectedEmpresa);
  const filteredParticipants = filterCourseParticipants(
    participantsAll,
    selectedEmpresa,
    selectedTrilha,
    selectedPeriodo,
  );

  const currentSurvey = filteredSurvey;
  const baselineSurvey = filteredSurvey.filter((r) => r.tempo === 'T0');

  const courseMetrics = calculateCourseMetrics(filteredParticipants);
  const funnel = calculateCourseFunnel(courseMetrics);
  const modulePerformanceRaw = buildModulePerformanceFromMedivox(
    filteredParticipants,
    ctx.modules,
    instrumentSet,
    ctx.rows,
  );
  const modulePerformance = modulePerformanceRaw.map((m: ModulePerformance) => ({
    moduleName: m.moduleName,
    applicable: m.applicableParticipants,
    completed: m.completedParticipants,
    completionRate: m.completionRate,
  }));

  const trackDistribution = calculateTrackDistribution(filteredParticipants);
  const tracks = trackDistribution.map((t: TrackDistribution) => ({
    track: t.track,
    label: getCourseTrackLabel(t.track),
    participants: t.participants,
    completionRate: t.completionRate,
  }));

  const temps: SurveyResponse['tempo'][] = ['T0', 'T1', 'T2'];
  const surveyByTempo = temps.map((tempo) => {
    const s = surveyStatsForTempo(filteredSurvey, tempo);
    return {
      tempo,
      label: TIMEPOINT_LABELS[tempo],
      responses: s.responses,
      avgScore100: Math.round(s.avgScore100 * 10) / 10,
    };
  });

  const headlineT2 = calculateHeadlineFlag(currentSurvey);
  const dimensionAnalysis = calculateDimensionAnalysis(currentSurvey, baselineSurvey);
  const dimensionsT2vsT0 = dimensionAnalysis.map((d) => ({
    dimension: d.dimension,
    score100: Math.round(d.score * 10) / 10,
    delta: Math.round(d.delta * 10) / 10,
    negativePercent: Math.round(d.negativePercent * 10) / 10,
    priority: d.priority,
  }));

  const timeEvolution = calculateTimeEvolution(filteredSurvey).map((row) => ({
    tempo: row.tempo,
    score: Math.round(row.score * 10) / 10,
  }));

  const groupRaw = calculateGroupComparison(filteredSurvey, 'trilha');
  const groupByTrilha = groupRaw.map((g) => ({
    group: g.group,
    label: getCourseTrackLabel(g.group),
    score: Math.round(g.score * 10) / 10,
    count: g.count,
    alertPercent: Math.round(g.alertPercent * 10) / 10,
  }));

  const perTempo = temps.map((tempo) => {
    const surveyTempo = filteredSurvey.filter((r) => r.tempo === tempo);
    const stats = surveyStatsForTempo(filteredSurvey, tempo);
    const dims = calculateDimensionAnalysis(surveyTempo, baselineSurvey).map((d) => ({
      dimension: d.dimension,
      score100: Math.round(d.score * 10) / 10,
      delta: Math.round(d.delta * 10) / 10,
      negativePercent: Math.round(d.negativePercent * 10) / 10,
      priority: d.priority,
    }));
    const grp = calculateGroupComparison(surveyTempo, 'trilha').map((g) => ({
      group: g.group,
      label: getCourseTrackLabel(g.group),
      score: Math.round(g.score * 10) / 10,
      count: g.count,
      alertPercent: Math.round(g.alertPercent * 10) / 10,
    }));
    return {
      tempo,
      label: TIMEPOINT_LABELS[tempo],
      responses: stats.responses,
      avgScore100: Math.round(stats.avgScore100 * 10) / 10,
      headline: calculateHeadlineFlag(surveyTempo),
      dimensionsVsT0: dims,
      groupByTrilha: grp,
    };
  });

  const dimKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const;
  const radarSeries = dimKeys.map((key, idx) => {
    const scoreForTempo = (tempo: 'T0' | 'T1' | 'T2') => {
      const vals = filteredSurvey
        .filter((r) => r.tempo === tempo)
        .map((r) => r[key])
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
      const mean = calculateMean(vals);
      if (Number.isNaN(mean)) return 0;
      return Math.round((((mean - 1) / 4) * 100) * 10) / 10;
    };
    return {
      dimension: ['Autoconfiança', 'Busca de apoio', 'Atitude', 'Conhecimento', 'Ambiente seguro', 'Intenção', 'Carga de trabalho', 'Responsabilidade'][idx],
      T0: scoreForTempo('T0'),
      T1: scoreForTempo('T1'),
      T2: scoreForTempo('T2'),
    };
  });

  const t0mod = moduleById.get(instruments.T0);
  const t1mod = moduleById.get(instruments.T1);
  const t2mod = moduleById.get(instruments.T2);

  const data: SaudeMentalCompanyPdfSnapshot = {
    courseTitle: ctx.courseTitle,
    companyId,
    companyName,
    instrumentTitles: {
      T0: t0mod?.title?.trim() || 'Instrumento T0',
      T1: t1mod?.title?.trim() || 'Instrumento T1',
      T2: t2mod?.title?.trim() || 'Instrumento T2',
    },
    courseMetrics,
    funnel,
    modulePerformance,
    tracks,
    instrumentRates: {
      T0: Math.round(courseMetrics.instrument1Rate * 10) / 10,
      T1: Math.round(courseMetrics.instrument2Rate * 10) / 10,
      T2: Math.round(courseMetrics.instrument3Rate * 10) / 10,
    },
    surveyByTempo,
    headlineT2,
    dimensionsT2vsT0,
    perTempo,
    radarSeries,
    timeEvolution,
    groupByTrilha,
    recorteDescription: `${companyName} · todas as trilhas · visão consolidada (período) · autopercepção geral (T0, T1, T2) com comparativo`,
  };

  return { ok: true, data };
}
