import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgePercent,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarRange,
  Clock,
  Filter,
  GraduationCap,
  Layers3,
  Route,
  Target,
  TrendingUp,
  Users,
  Users2,
  HeartPulse,
} from 'lucide-react';
import { getCompany, listCompanies } from '@/lib/firestore/admin';
import { loadCourseEnrollmentContext } from '@/lib/firestore/analytics';
import { fetchUserDemographicsForUids } from '@/lib/firestore/userDemographics';
import type { CompareBy, TimePoint } from '@/features/saude-mental/typesSurvey';
import {
  calculateCourseFunnel,
  calculateCourseMetrics,
  calculateTrackDistribution,
  filterCourseParticipants,
  buildModulePerformanceFromCourseModules,
  buildTrackRequirementSummary,
  getCoursePeriodOptions,
} from '@/features/saude-mental/courseMetricsModules';
import {
  buildCourseParticipantsFromRows,
  buildSurveyResponsesFromRows,
  resolveInstrumentModuleIds,
} from '@/features/saude-mental/buildSaudeMentalLive';
import { SAUDE_MENTAL_COURSE_ID, SAUDE_MENTAL_DIMENSIONS } from '@/features/saude-mental/config';
import { getCourseTrackLabel } from '@/features/saude-mental/courseLabels';
import { TIMEPOINT_LABELS, TIMEPOINT_SHORT_LABELS } from '@/features/saude-mental/timepoints';
import {
  calculateDimensionAnalysis,
  calculateGroupComparison,
  calculateHeadlineFlag,
  calculateMean,
  calculateTimeEvolution,
} from '@/features/saude-mental/surveyAnalysis';
import { computeSecondShiftPanel, computeWomenPanel } from '@/features/saude-mental/womenAndShiftPanels';
import type { CompanyDoc, StudentDemographics } from '@/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';

type SurveyTempoFilter = TimePoint | 'geral';

type Props = {
  managedCompanyIds: string[] | null;
  showEnrolledStudentsTable?: boolean;
};

const card = 'rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-inner shadow-black/20';
const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500';

/** Mesmas alturas dos wrappers — px explícito evita width/height -1 no ResponsiveContainer (Recharts). */
const CHART_H_FUNNEL = 300;
const CHART_H_MODULE_PERF = 360;
const CHART_H_GROUP_COMPARE = 280;
const CHART_H_RADAR = 300;
const CHART_H_EVOLUTION = 220;

function formatPtDateBr(d?: Date) {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function segundaJornadaLabel(v: boolean | undefined) {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  return '—';
}

function MetricCardSm(props: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`${card} min-h-[132px]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">{props.title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-100">{props.value}</p>
          {props.subtitle ? <p className="mt-1 text-xs text-zinc-500">{props.subtitle}</p> : null}
        </div>
        {props.icon ? (
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">{props.icon}</div>
        ) : null}
      </div>
    </div>
  );
}

export function SaudeMentalNativeDashboard({
  managedCompanyIds,
  showEnrolledStudentsTable = true,
}: Props) {
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof loadCourseEnrollmentContext>> | null>(null);

  const [selectedEmpresa, setSelectedEmpresa] = useState('todas');
  const [selectedTrilha, setSelectedTrilha] = useState('todas');
  const [selectedTempo, setSelectedTempo] = useState<SurveyTempoFilter>('T2');
  const [selectedPeriodo, setSelectedPeriodo] = useState('todos');
  const [compareBy, setCompareBy] = useState<CompareBy>('trilha');
  const [tab, setTab] = useState<'course' | 'survey'>('course');
  const [demographicsByUid, setDemographicsByUid] = useState<Map<string, StudentDemographics>>(new Map());

  useEffect(() => {
    let c = false;
    (async () => {
      if (managedCompanyIds && managedCompanyIds.length > 0) {
        const rows = await Promise.all(managedCompanyIds.map((id) => getCompany(id)));
        if (!c) setCompanies(rows.filter((x): x is CompanyDoc => x != null).sort((a, b) => a.name.localeCompare(b.name)));
        return;
      }
      const all = await listCompanies();
      if (!c) setCompanies(all.sort((a, b) => a.name.localeCompare(b.name)));
    })();
    return () => {
      c = true;
    };
  }, [managedCompanyIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await loadCourseEnrollmentContext(SAUDE_MENTAL_COURSE_ID, {
          companyId: selectedEmpresa !== 'todas' ? selectedEmpresa : undefined,
          managedCompanyIds: managedCompanyIds ?? undefined,
        });
        if (!cancelled) setCtx(data);
      } catch (e) {
        if (!cancelled) {
          setCtx(null);
          setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managedCompanyIds, selectedEmpresa]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ctx?.rows.length) {
        if (!cancelled) setDemographicsByUid(new Map());
        return;
      }
      const uids = [...new Set(ctx.rows.map((r) => r.uid))];
      const map = await fetchUserDemographicsForUids(uids);
      if (!cancelled) setDemographicsByUid(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const instruments = useMemo(() => (ctx ? resolveInstrumentModuleIds(ctx.modules) : null), [ctx]);
  const instrumentSet = useMemo(
    () => (instruments ? new Set([instruments.T0, instruments.T1, instruments.T2]) : new Set<string>()),
    [instruments]
  );

  const companyNameMap = useMemo(() => {
    const m = new Map<string, string>();
    if (ctx) for (const c of ctx.companies) m.set(c.id, c.name);
    return m;
  }, [ctx]);

  const moduleById = useMemo(() => {
    if (!ctx) return new Map();
    return new Map(ctx.modules.map((m) => [m.id, m]));
  }, [ctx]);

  const surveyAll = useMemo(() => {
    if (!ctx || !instruments) return [];
    return buildSurveyResponsesFromRows(
      ctx.rows,
      moduleById,
      instruments,
      companyNameMap,
      demographicsByUid
    );
  }, [ctx, instruments, moduleById, companyNameMap, demographicsByUid]);

  const participantsAll = useMemo(() => {
    if (!ctx || !instruments) return [];
    return buildCourseParticipantsFromRows(ctx.rows, ctx.modules, instruments, instrumentSet, companyNameMap);
  }, [ctx, instruments, instrumentSet, companyNameMap]);

  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of surveyAll) {
      map.set(row.empresa_id, row.empresa_nome || row.empresa_id);
    }
    for (const p of participantsAll) {
      map.set(p.company_id, p.company_name || p.company_id);
    }
    companies.forEach((co) => map.set(co.id, co.name));
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
      .map(([id, nome]) => ({ id, nome }));
  }, [surveyAll, participantsAll, companies]);

  const trilhas = useMemo(() => {
    const s = new Set<string>();
    surveyAll.forEach((r) => s.add(r.trilha));
    participantsAll.forEach((p) => s.add(p.track));
    return [...s].filter(Boolean).sort();
  }, [surveyAll, participantsAll]);

  const coursePeriodOptions = useMemo(() => getCoursePeriodOptions(participantsAll), [participantsAll]);

  const filteredSurvey = useMemo(() => {
    let data = surveyAll;
    if (selectedEmpresa !== 'todas') data = data.filter((r) => r.empresa_id === selectedEmpresa);
    if (selectedTrilha !== 'todas') data = data.filter((r) => r.trilha === selectedTrilha);
    return data;
  }, [surveyAll, selectedEmpresa, selectedTrilha]);

  const currentSurvey = useMemo(
    () => (selectedTempo === 'geral' ? filteredSurvey : filteredSurvey.filter((r) => r.tempo === selectedTempo)),
    [filteredSurvey, selectedTempo]
  );
  const baselineSurvey = useMemo(() => filteredSurvey.filter((r) => r.tempo === 'T0'), [filteredSurvey]);

  const womenPanel = useMemo(() => computeWomenPanel(currentSurvey), [currentSurvey]);
  const secondShiftPanel = useMemo(() => computeSecondShiftPanel(currentSurvey), [currentSurvey]);

  const filteredParticipants = useMemo(
    () => filterCourseParticipants(participantsAll, selectedEmpresa, selectedTrilha, selectedPeriodo),
    [participantsAll, selectedEmpresa, selectedTrilha, selectedPeriodo]
  );

  /** Alunos matriculados no curso, alinhados ao mesmo recorte (empresa, trilha, período) dos gráficos. */
  const enrolledStudentsInRecorte = useMemo(() => {
    if (!ctx) return [];
    const allowed = new Set(filteredParticipants.map((p) => p.participant_id));
    const list = ctx.rows.filter((r) => r.enrolled && allowed.has(r.uid));
    return [...list].sort((a, b) => {
      const byCompany = (a.companyName || '').localeCompare(b.companyName || '', 'pt-BR');
      if (byCompany !== 0) return byCompany;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }, [ctx, filteredParticipants]);

  const courseMetrics = useMemo(() => calculateCourseMetrics(filteredParticipants), [filteredParticipants]);
  const courseFunnel = useMemo(() => calculateCourseFunnel(courseMetrics), [courseMetrics]);
  const trackDistribution = useMemo(
    () => calculateTrackDistribution(filteredParticipants),
    [filteredParticipants]
  );
  const requirementSummary = useMemo(
    () => (ctx ? buildTrackRequirementSummary(ctx.modules, instrumentSet) : null),
    [ctx, instrumentSet]
  );
  const modulePerformance = useMemo(() => {
    if (!ctx) return [];
    return buildModulePerformanceFromCourseModules(
      filteredParticipants,
      ctx.modules,
      instrumentSet,
      ctx.rows
    );
  }, [ctx, filteredParticipants, instrumentSet]);

  const surveyMetrics = useMemo(() => {
    const uniqueParticipants = new Set(currentSurvey.map((r) => `${r.empresa_id}-${r.participante_id}`)).size;
    const totalResponses = currentSurvey.length;
    const currentScores = currentSurvey.map((r) => r.score_geral).filter((s): s is number => typeof s === 'number');
    const baselineScores = baselineSurvey.map((r) => r.score_geral).filter((s): s is number => typeof s === 'number');
    const avgScore = calculateMean(currentScores);
    const baselineAvg = calculateMean(baselineScores);
    const delta =
      selectedTempo !== 'T0' && selectedTempo !== 'geral' && !Number.isNaN(baselineAvg)
        ? avgScore - baselineAvg
        : undefined;
    return {
      uniqueParticipants,
      totalResponses,
      avgScore: Number.isNaN(avgScore) ? 0 : avgScore,
      delta: delta !== undefined && Number.isNaN(delta) ? undefined : delta,
    };
  }, [currentSurvey, baselineSurvey, selectedTempo]);

  const headlineFlag = useMemo(() => calculateHeadlineFlag(currentSurvey), [currentSurvey]);
  const dimensionAnalysis = useMemo(
    () => calculateDimensionAnalysis(currentSurvey, baselineSurvey),
    [currentSurvey, baselineSurvey]
  );
  const groupComparison = useMemo(
    () => calculateGroupComparison(currentSurvey, compareBy),
    [currentSurvey, compareBy]
  );
  const timeEvolution = useMemo(() => calculateTimeEvolution(filteredSurvey), [filteredSurvey]);
  const timeComparisonRows = useMemo(() => {
    const points = calculateTimeEvolution(filteredSurvey);
    const baseline = points.find((p) => p.tempo === 'T0')?.score ?? 0;
    return points.map((p) => ({
      ...p,
      deltaVsT0: p.tempo === 'T0' ? 0 : p.score - baseline,
    }));
  }, [filteredSurvey]);
  const radarByTempo = useMemo(() => {
    const questionKeys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const;
    return SAUDE_MENTAL_DIMENSIONS.map((dim, idx) => {
      const key = questionKeys[idx];
      const scoreForTempo = (tempo: TimePoint) => {
        const values = filteredSurvey
          .filter((r) => r.tempo === tempo)
          .map((r) => r[key])
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
        const mean = calculateMean(values);
        if (Number.isNaN(mean)) return 0;
        return ((mean - 1) / 4) * 100;
      };
      return {
        dimension: dim.label,
        T0: scoreForTempo('T0'),
        T1: scoreForTempo('T1'),
        T2: scoreForTempo('T2'),
      };
    });
  }, [filteredSurvey]);

  const compareByLabels: Record<CompareBy, string> = {
    trilha: 'Trilha',
    sexo: 'Sexo',
    faixa_etaria: 'Faixa etária',
    segunda_jornada: 'Segunda jornada',
  };

  const empresaLabel =
    selectedEmpresa === 'todas'
      ? 'Todas as empresas'
      : empresas.find((e) => e.id === selectedEmpresa)?.nome || selectedEmpresa;
  const trilhaLabel =
    selectedTrilha === 'todas' ? 'Todas as trilhas' : getCourseTrackLabel(selectedTrilha);
  const coursePeriodoLabel =
    selectedPeriodo === 'todos'
      ? 'Visão consolidada'
      : coursePeriodOptions.find((o) => o.value === selectedPeriodo)?.label || selectedPeriodo;
  const tempoLabel =
    selectedTempo === 'geral'
      ? 'Todos os instrumentos (T0, T1, T2)'
      : `${TIMEPOINT_LABELS[selectedTempo]} (${TIMEPOINT_SHORT_LABELS[selectedTempo]})`;
  const surveyRecorteLabel = `${empresaLabel} · ${trilhaLabel} · ${tempoLabel}`;
  const courseRecorteLabel = `${empresaLabel} · ${trilhaLabel} · ${coursePeriodoLabel}`;

  const weakestModule = useMemo(() => {
    if (!modulePerformance.length) return null;
    return [...modulePerformance].sort((a, b) => a.completionRate - b.completionRate)[0];
  }, [modulePerformance]);
  const strongestTrack = useMemo(() => {
    if (!trackDistribution.length) return null;
    return [...trackDistribution].sort((a, b) => b.completionRate - a.completionRate)[0];
  }, [trackDistribution]);
  const instrumentGap = courseMetrics.instrument1Rate - courseMetrics.instrument3Rate;

  if (loading) {
    return <p className="text-sm text-zinc-500">A carregar painel de Saúde Mental…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }
  if (!ctx) {
    return <p className="text-sm text-zinc-500">Sem dados.</p>;
  }

  if (!instruments) {
    return (
      <div className={`${card} border-amber-900/50 bg-amber-950/20`}>
        <p className="font-medium text-amber-200">Módulos de instrumento não encontrados</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Defina os três módulos (T0, T1, T2) em{' '}
          <code className="rounded bg-zinc-800 px-1 font-mono text-xs">VITE_SAUDE_MENTAL_INSTRUMENT_MODULE_IDS</code>{' '}
          (IDs Firestore separados por vírgula, ordem Instrumento 01 → 03), ou use títulos com &quot;Instrumento
          01/02/03&quot;, &quot;Autopercepção 1/2/3&quot;, <strong className="text-zinc-300">T0 / T1 / T2</strong> no
          nome, ou três módulos únicos com questionário longo (≥10 itens) — o sistema tenta detetar automaticamente.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Curso em uso: <code className="font-mono text-zinc-400">{SAUDE_MENTAL_COURSE_ID}</code>
          {ctx.modules.length === 0
            ? ' — não há módulos neste curso; confira VITE_SAUDE_MENTAL_COURSE_ID.'
            : ` — ${ctx.modules.length} módulo(s) carregados (lista abaixo).`}
        </p>
        {ctx.modules.length > 0 ? (
          <ul className="mt-3 max-h-48 list-inside list-disc overflow-y-auto text-xs text-zinc-400">
            {ctx.modules.map((m) => (
              <li key={m.id} className="py-0.5">
                <span className="font-mono text-zinc-500">{m.id}</span>
                {' — '}
                {m.title}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const hasSurvey = surveyAll.length > 0;
  const hasCourse = participantsAll.some((p) => p.enrolled);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-px">
        <button
          type="button"
          onClick={() => setTab('course')}
          className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
            tab === 'course'
              ? 'bg-zinc-900 text-emerald-300 ring-1 ring-zinc-700 ring-b-transparent'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Engajamento e conclusão
        </button>
        <button
          type="button"
          onClick={() => setTab('survey')}
          className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
            tab === 'survey'
              ? 'bg-zinc-900 text-emerald-300 ring-1 ring-zinc-700 ring-b-transparent'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Autopercepção
        </button>
      </div>

      {tab === 'course' ? (
        <div className="space-y-8">
          {!hasCourse ? (
            <p className="text-sm text-zinc-500">Ainda não há matrículas concluídas neste recorte.</p>
          ) : (
            <>
              <div className={card}>
                <p className={eyebrow}>Recorte analítico</p>
                <p className="mt-2 text-base font-semibold text-zinc-100">Filtros</p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <Building2 size={14} /> Empresa
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={selectedEmpresa}
                      onChange={(e) => setSelectedEmpresa(e.target.value)}
                    >
                      <option value="todas">Todas as empresas</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <Route size={14} /> Trilha
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={selectedTrilha}
                      onChange={(e) => setSelectedTrilha(e.target.value)}
                    >
                      <option value="todas">Todas as trilhas</option>
                      {trilhas.map((t) => (
                        <option key={t} value={t}>
                          {getCourseTrackLabel(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <CalendarRange size={14} /> Período
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={selectedPeriodo}
                      onChange={(e) => setSelectedPeriodo(e.target.value)}
                    >
                      <option value="todos">Visão consolidada</option>
                      {coursePeriodOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-4 text-xs text-zinc-500">Recorte ativo: {courseRecorteLabel}</p>
              </div>

              <div>
                <p className={eyebrow}>Visão executiva</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-100">Indicadores principais da jornada</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCardSm
                    title="Público elegível"
                    value={courseMetrics.eligibleCount}
                    subtitle="Base no recorte"
                    icon={<Users className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Taxa de adesão"
                    value={`${courseMetrics.adherenceRate.toFixed(1)}%`}
                    subtitle={`${courseMetrics.enrolledCount} inscritos`}
                    icon={<BadgePercent className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Taxa de início"
                    value={`${courseMetrics.penetrationRate.toFixed(1)}%`}
                    subtitle={`${courseMetrics.startedCount} iniciaram`}
                    icon={<Activity className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Taxa de conclusão"
                    value={`${courseMetrics.completionRate.toFixed(1)}%`}
                    subtitle={`${courseMetrics.completedCount} concluíram`}
                    icon={<GraduationCap className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Cobertura final"
                    value={`${courseMetrics.completionPenetrationRate.toFixed(1)}%`}
                    subtitle="Concluintes / elegíveis"
                    icon={<Target className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Avanço médio"
                    value={`${courseMetrics.avgProgress.toFixed(1)}%`}
                    subtitle="Jornada obrigatória (sem instrumentos)"
                    icon={<TrendingUp className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Tempo médio para iniciar"
                    value={
                      Number.isFinite(courseMetrics.avgDaysToStart)
                        ? `${courseMetrics.avgDaysToStart.toFixed(1)} dias`
                        : 'N/D'
                    }
                    subtitle="Inscrição → primeiro acesso (quando houver datas)"
                    icon={<Clock className="h-5 w-5" />}
                  />
                  <MetricCardSm
                    title="Tempo médio para concluir"
                    value={
                      Number.isFinite(courseMetrics.avgDaysToCompletion)
                        ? `${courseMetrics.avgDaysToCompletion.toFixed(1)} dias`
                        : 'N/D'
                    }
                    subtitle="Inscrição → conclusão (quando houver datas)"
                    icon={<Clock className="h-5 w-5" />}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="xl:col-span-5">
                  <div className={card}>
                    <div className="mb-4 flex items-center gap-2">
                      <Filter className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-zinc-100">Funil de engajamento</h3>
                    </div>
                    <p className="mb-4 text-sm text-zinc-500">Da base elegível até a conclusão da jornada.</p>
                    <div className="h-[300px] min-w-0 shrink-0">
                      <ResponsiveContainer width="100%" height={CHART_H_FUNNEL} debounce={50}>
                        <BarChart data={courseFunnel} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                          <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                          <Tooltip
                            cursor={false}
                            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                            labelStyle={{ color: '#e4e4e7' }}
                          />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {courseFunnel.map((entry, idx) => (
                              <Cell
                                key={entry.key}
                                fill={['#34d399', '#2dd4bf', '#22c55e', '#eab308'][idx % 4]}
                              />
                            ))}
                            <LabelList dataKey="count" position="top" fill="#e4e4e7" fontSize={12} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="xl:col-span-7">
                  <div className={card}>
                    <div className="mb-4 flex items-center gap-2">
                      <Users2 className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-zinc-100">Trilhas e instrumentos</h3>
                    </div>
                    {requirementSummary ? (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <BookOpenCheck className="h-4 w-4 text-emerald-400" />
                            <p className="text-sm font-medium text-zinc-200">Estrutura da jornada</p>
                          </div>
                          <ul className="space-y-2 text-sm text-zinc-400">
                            <li className="flex justify-between gap-2">
                              <span>Módulos obrig. colaborador</span>
                              <span className="font-medium text-zinc-200">
                                {requirementSummary.collaboratorRequiredModules}
                              </span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span>Módulos obrig. gestor</span>
                              <span className="font-medium text-zinc-200">
                                {requirementSummary.managerRequiredModules}
                              </span>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span>Pontos de mensuração</span>
                              <span className="font-medium text-emerald-400">
                                {requirementSummary.instrumentCount}
                              </span>
                            </li>
                          </ul>
                        </div>
                        <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/50 p-4">
                          <p className="mb-3 text-sm font-medium text-zinc-200">Cobertura dos instrumentos</p>
                          <ul className="space-y-2 text-sm">
                            <li className="flex justify-between text-zinc-400">
                              <span>Instrumento 01</span>
                              <span className="text-zinc-100">{courseMetrics.instrument1Rate.toFixed(1)}%</span>
                            </li>
                            <li className="flex justify-between text-zinc-400">
                              <span>Instrumento 02</span>
                              <span className="text-zinc-100">{courseMetrics.instrument2Rate.toFixed(1)}%</span>
                            </li>
                            <li className="flex justify-between text-zinc-400">
                              <span>Instrumento 03</span>
                              <span className="text-zinc-100">{courseMetrics.instrument3Rate.toFixed(1)}%</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-stretch">
                <div className="xl:col-span-8">
                  <div className={card}>
                    <div className="mb-4 flex items-center gap-2">
                      <Layers3 className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-zinc-100">Conclusão dos módulos</h3>
                    </div>
                    <p className="mb-4 text-sm text-zinc-500">
                      Exclui os três módulos de instrumento; cores indicam audiência (gestor vs colaborador).
                    </p>
                    <div className="h-[360px] min-h-[280px] min-w-0 shrink-0">
                      <ResponsiveContainer width="100%" height={CHART_H_MODULE_PERF} debounce={50}>
                        <BarChart
                          data={modulePerformance}
                          layout="vertical"
                          margin={{ top: 8, right: 44, left: 4, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="moduleName"
                            width={220}
                            tick={{ fill: '#e4e4e7', fontSize: 10 }}
                            interval={0}
                          />
                          <Tooltip
                            cursor={false}
                            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                          />
                          <Bar dataKey="completionRate" radius={[0, 8, 8, 0]} maxBarSize={26}>
                            {modulePerformance.map((entry) => (
                              <Cell
                                key={entry.moduleId}
                                fill={
                                  entry.audience === 'gestor'
                                    ? '#fb923c'
                                    : entry.audience === 'mixed'
                                      ? '#eab308'
                                      : '#34d399'
                                }
                              />
                            ))}
                            <LabelList
                              dataKey="completionRate"
                              position="right"
                              formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '')}
                              fill="#e4e4e7"
                              fontSize={11}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
                <div className="xl:col-span-4">
                  <div className={`${card} h-full`}>
                    <h3 className="font-semibold text-zinc-100">Resumo do recorte</h3>
                    <p className="mt-1 text-xs text-zinc-500">{courseRecorteLabel}</p>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Taxa de adesão
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-400">
                          {courseMetrics.adherenceRate.toFixed(1)}%
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {courseMetrics.enrolledCount} inscritos de {courseMetrics.eligibleCount} elegíveis
                        </p>
                      </div>
                      <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Módulo com menor conclusão
                        </p>
                        <p className="mt-2 text-lg font-medium text-amber-300">
                          {weakestModule?.moduleName ?? '—'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {weakestModule ? `${weakestModule.completionRate.toFixed(1)}% concluído` : 'Sem base suficiente'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Queda I1 → I3
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-zinc-100">{instrumentGap.toFixed(1)} pp</p>
                        <p className="mt-3 text-xs text-zinc-500">
                          {strongestTrack
                            ? `Melhor conclusão: ${getCourseTrackLabel(strongestTrack.track)}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {showEnrolledStudentsTable ? (
                <div className={card}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={eyebrow}>Cadastro</p>
                      <h3 className="mt-1 font-semibold text-zinc-100">Alunos inscritos no recorte</h3>
                      <p className="mt-1 text-xs text-zinc-500">{courseRecorteLabel}</p>
                    </div>
                    <p className="text-sm text-zinc-400">{enrolledStudentsInRecorte.length} inscrito(s)</p>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
                    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          <th className="px-3 py-2.5">Nome</th>
                          <th className="px-3 py-2.5">E-mail</th>
                          {selectedEmpresa === 'todas' ? <th className="px-3 py-2.5">Empresa</th> : null}
                          <th className="px-3 py-2.5">Perfil</th>
                          <th className="px-3 py-2.5">Inscrição</th>
                          <th className="px-3 py-2.5">Sexo</th>
                          <th className="px-3 py-2.5">Faixa etária</th>
                          <th className="px-3 py-2.5">Segunda jornada</th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-300">
                        {enrolledStudentsInRecorte.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-6 text-center text-zinc-500"
                              colSpan={selectedEmpresa === 'todas' ? 8 : 7}
                            >
                              Nenhum inscrito neste recorte.
                            </td>
                          </tr>
                        ) : (
                          enrolledStudentsInRecorte.map((row) => {
                            const dem = demographicsByUid.get(row.uid);
                            return (
                              <tr key={row.uid} className="border-b border-zinc-800/80 last:border-0">
                                <td className="px-3 py-2.5 font-medium text-zinc-200">{row.name || '—'}</td>
                                <td className="max-w-[220px] truncate px-3 py-2.5 text-zinc-400">{row.email || '—'}</td>
                                {selectedEmpresa === 'todas' ? (
                                  <td className="px-3 py-2.5 text-zinc-400">{row.companyName || '—'}</td>
                                ) : null}
                                <td className="px-3 py-2.5 capitalize text-zinc-400">
                                  {row.companyRoleId ?? '—'}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-zinc-400">
                                  {formatPtDateBr(row.enrolledAt)}
                                </td>
                                <td className="px-3 py-2.5 text-zinc-400">{dem?.sexo ?? '—'}</td>
                                <td className="px-3 py-2.5 text-zinc-400">{dem?.faixaEtaria ?? '—'}</td>
                                <td className="px-3 py-2.5 text-zinc-400">
                                  {segundaJornadaLabel(dem?.segundaJornada)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {!hasSurvey ? (
            <p className="text-sm text-zinc-500">
              Não há respostas de instrumentos com módulos concluídos e pelo menos 6 perguntas por instrumento. Verifique o
              mapeamento dos módulos T0–T2 e as matrículas.
            </p>
          ) : (
            <>
              <div className={card}>
                <p className={eyebrow}>Recorte analítico</p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <Building2 size={14} /> Empresa
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={selectedEmpresa}
                      onChange={(e) => setSelectedEmpresa(e.target.value)}
                    >
                      <option value="todas">Todas as empresas</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <Route size={14} /> Trilha
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={selectedTrilha}
                      onChange={(e) => setSelectedTrilha(e.target.value)}
                    >
                      <option value="todas">Todas as trilhas</option>
                      {trilhas.map((t) => (
                        <option key={t} value={t}>
                          {getCourseTrackLabel(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <Clock size={14} /> Momento
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={selectedTempo}
                      onChange={(e) => setSelectedTempo(e.target.value as TimePoint)}
                    >
                      <option value="geral">Geral — T0 + T1 + T2 (comparativo)</option>
                      <option value="T0">
                        T0 — {TIMEPOINT_LABELS.T0} ({TIMEPOINT_SHORT_LABELS.T0})
                      </option>
                      <option value="T1">
                        T1 — {TIMEPOINT_LABELS.T1} ({TIMEPOINT_SHORT_LABELS.T1})
                      </option>
                      <option value="T2">
                        T2 — {TIMEPOINT_LABELS.T2} ({TIMEPOINT_SHORT_LABELS.T2})
                      </option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      <Users size={14} /> Comparar por
                    </span>
                    <select
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-100"
                      value={compareBy}
                      onChange={(e) => setCompareBy(e.target.value as CompareBy)}
                    >
                      {Object.entries(compareByLabels).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-4 text-xs text-zinc-500">
                  Recorte: {surveyRecorteLabel} · Comparação: {compareByLabels[compareBy]}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCardSm
                  title="Pessoas na amostra"
                  value={surveyMetrics.uniqueParticipants}
                  icon={<Users className="h-5 w-5" />}
                />
                <MetricCardSm
                  title="Respostas no recorte"
                  value={surveyMetrics.totalResponses}
                  icon={<BarChart3 className="h-5 w-5" />}
                />
                <MetricCardSm
                  title="Resultado médio"
                  value={surveyMetrics.avgScore.toFixed(1)}
                  subtitle="Score 0–100 (média Q1–Q6)"
                  icon={<Target className="h-5 w-5" />}
                />
                <MetricCardSm
                  title="Mudança vs Instrumento 01"
                  value={
                    surveyMetrics.delta !== undefined
                      ? `${surveyMetrics.delta >= 0 ? '+' : ''}${surveyMetrics.delta.toFixed(1)}`
                      : 'N/A'
                  }
                  subtitle="Diferença vs linha de base T0"
                  icon={<TrendingUp className="h-5 w-5" />}
                />
              </div>

              {selectedTempo === 'geral' ? (
                <div className={`${card} overflow-x-auto`}>
                  <h3 className="mb-4 font-semibold text-zinc-100">Comparação entre momentos (T0, T1, T2)</h3>
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                        <th className="px-3 py-2">Momento</th>
                        <th className="px-3 py-2 text-right">Score médio (0–100)</th>
                        <th className="px-3 py-2 text-right">Δ vs T0</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeComparisonRows.map((row) => (
                        <tr key={row.tempo} className="border-b border-zinc-800/80 text-zinc-300">
                          <td className="px-3 py-2">
                            {TIMEPOINT_LABELS[row.tempo as TimePoint]} ({TIMEPOINT_SHORT_LABELS[row.tempo as TimePoint]})
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.score.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {row.tempo === 'T0' ? '—' : `${row.deltaVsT0 >= 0 ? '+' : ''}${row.deltaVsT0.toFixed(1)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div
                className={`${card} border-l-4 ${
                  headlineFlag.severity === 'critical'
                    ? 'border-red-500 bg-red-950/20'
                    : headlineFlag.severity === 'warning'
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-emerald-600/60 bg-emerald-950/10'
                }`}
              >
                <p className="text-xs font-medium uppercase text-zinc-500">Sinal principal</p>
                <p className="mt-1 text-lg font-semibold text-zinc-100">{headlineFlag.title}</p>
                <p className="mt-2 text-sm text-zinc-400">{headlineFlag.explanation}</p>
              </div>

              <div className={`${card} overflow-x-auto`}>
                <h3 className="mb-4 font-semibold text-zinc-100">Dimensões (instrumento atual vs T0)</h3>
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                      <th className="px-3 py-2">Dimensão</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-right">Δ</th>
                      <th className="px-3 py-2 text-right">Alerta</th>
                      <th className="px-3 py-2">Prioridade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensionAnalysis.map((d) => (
                      <tr key={d.dimension} className="border-b border-zinc-800/80 text-zinc-300">
                        <td className="px-3 py-2">
                          <span className="font-medium text-zinc-100">{d.dimension}</span>
                          <p className="text-xs text-zinc-500">{d.description}</p>
                        </td>
                        <td className="px-3 py-2 text-right">{d.score.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">{d.delta >= 0 ? '+' : ''}{d.delta.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">{d.negativePercent.toFixed(1)}%</td>
                        <td className="px-3 py-2">{d.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {womenPanel && currentSurvey.length > 0 ? (
                <div className={card}>
                  <div className="mb-4 flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-pink-400" />
                    <h3 className="font-semibold text-zinc-100">Saúde da mulher (Q9 e Q10)</h3>
                  </div>
                  <p className="mb-4 text-sm text-zinc-500">
                    Indicadores alinhados ao painel de referência: equidade e apoio à saúde da mulher. Requer perguntas 9 e
                    10 no instrumento e sexo preenchido no cadastro.
                  </p>
                  {!currentSurvey.some((r) => typeof r.q9 === 'number' || typeof r.q10 === 'number') ? (
                    <p className="text-sm text-amber-200/90">
                      Não há respostas numéricas em Q9/Q10 neste momento — confirme que os módulos de instrumento incluem
                      essas questões (ordem alinhada ao Excel).
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-pink-900/40 bg-pink-950/15 p-4">
                        <p className="text-xs font-semibold uppercase text-pink-300/90">Feminino</p>
                        <p className="mt-2 text-sm text-zinc-400">
                          Q9 média:{' '}
                          <span className="font-medium text-zinc-100">
                            {womenPanel.female.q9 ? womenPanel.female.q9.mean.toFixed(2) : '—'}
                          </span>{' '}
                          · Q10 média:{' '}
                          <span className="font-medium text-zinc-100">
                            {womenPanel.female.q10 ? womenPanel.female.q10.mean.toFixed(2) : '—'}
                          </span>
                        </p>
                        {womenPanel.female.composite ? (
                          <p className="mt-2 text-xs text-zinc-500">
                            Compósito Q9+Q10 · média Likert {womenPanel.female.composite.mean.toFixed(2)} · alertas{' '}
                            {womenPanel.female.composite.negativePercent.toFixed(0)}%
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-sky-900/40 bg-sky-950/15 p-4">
                        <p className="text-xs font-semibold uppercase text-sky-300/90">Masculino</p>
                        <p className="mt-2 text-sm text-zinc-400">
                          Q9 média:{' '}
                          <span className="font-medium text-zinc-100">
                            {womenPanel.male.q9 ? womenPanel.male.q9.mean.toFixed(2) : '—'}
                          </span>{' '}
                          · Q10 média:{' '}
                          <span className="font-medium text-zinc-100">
                            {womenPanel.male.q10 ? womenPanel.male.q10.mean.toFixed(2) : '—'}
                          </span>
                        </p>
                        {womenPanel.male.composite ? (
                          <p className="mt-2 text-xs text-zinc-500">
                            Compósito Q9+Q10 · média Likert {womenPanel.male.composite.mean.toFixed(2)} · alertas{' '}
                            {womenPanel.male.composite.negativePercent.toFixed(0)}%
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-4 lg:col-span-2">
                        <p className="text-xs font-semibold uppercase text-zinc-500">Total do recorte</p>
                        {womenPanel.total.composite ? (
                          <p className="mt-2 text-sm text-zinc-300">
                            Média compósito Q9+Q10:{' '}
                            <span className="font-semibold text-emerald-300">
                              {womenPanel.total.composite.mean.toFixed(2)}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-500">Sem compósito (faltam Q9/Q10).</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {secondShiftPanel &&
              currentSurvey.length > 0 &&
              (secondShiftPanel.yes.count > 0 || secondShiftPanel.no.count > 0) ? (
                <div className={card}>
                  <h3 className="mb-2 font-semibold text-zinc-100">Segunda jornada</h3>
                  <p className="mb-4 text-sm text-zinc-500">
                    Comparação entre quem declarou segunda jornada no cadastro e quem não declarou (médias Q9/Q10 neste
                    momento).
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-4">
                      <p className="text-xs font-semibold uppercase text-amber-300/90">Segunda jornada — Sim ({secondShiftPanel.yes.count})</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Q9: {secondShiftPanel.yes.q9 ? secondShiftPanel.yes.q9.mean.toFixed(2) : '—'} · Q10:{' '}
                        {secondShiftPanel.yes.q10 ? secondShiftPanel.yes.q10.mean.toFixed(2) : '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-950/40 p-4">
                      <p className="text-xs font-semibold uppercase text-zinc-500">Segunda jornada — Não ({secondShiftPanel.no.count})</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Q9: {secondShiftPanel.no.q9 ? secondShiftPanel.no.q9.mean.toFixed(2) : '—'} · Q10:{' '}
                        {secondShiftPanel.no.q10 ? secondShiftPanel.no.q10.mean.toFixed(2) : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className={card}>
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-400" />
                    <h3 className="font-semibold text-zinc-100">
                      Comparação por {compareByLabels[compareBy]}
                    </h3>
                  </div>
                  {groupComparison.length > 1 ? (
                    <div className="h-[280px] min-w-0 shrink-0">
                      <ResponsiveContainer width="100%" height={CHART_H_GROUP_COMPARE} debounce={50}>
                        <BarChart
                          data={[...groupComparison]
                            .sort((a, b) => a.score - b.score)
                            .map((g) => ({ ...g, displayGroup: g.group }))}
                          layout="vertical"
                          margin={{ top: 5, right: 48, left: 8, bottom: 5 }}
                        >
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                          <YAxis
                            type="category"
                            dataKey="displayGroup"
                            width={120}
                            tick={{ fill: '#e4e4e7', fontSize: 12 }}
                          />
                          <Tooltip
                            cursor={false}
                            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                          />
                          <Bar dataKey="score" fill="#34d399" radius={[0, 6, 6, 0]} maxBarSize={28}>
                            <LabelList dataKey="score" position="right" fill="#e4e4e7" fontSize={12} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-zinc-500">
                      Grupos insuficientes para comparação (ex.: sexo/faixa exigem dados no perfil).
                    </p>
                  )}
                </div>
                <div className={card}>
                  <div className="mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-400" />
                    <h3 className="font-semibold text-zinc-100">Visão geral das dimensões</h3>
                  </div>
                  <div className="h-[300px] min-w-0 shrink-0">
                    <ResponsiveContainer width="100%" height={CHART_H_RADAR} debounce={50}>
                      {selectedTempo === 'geral' ? (
                        <RadarChart data={radarByTempo} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                          <PolarGrid stroke="#3f3f46" />
                          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#d4d4d8', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 9 }} />
                          <Legend />
                          <Radar
                            name="T0"
                            dataKey="T0"
                            stroke="#38bdf8"
                            fill="#38bdf8"
                            fillOpacity={0.08}
                            strokeWidth={2}
                          />
                          <Radar
                            name="T1"
                            dataKey="T1"
                            stroke="#34d399"
                            fill="#34d399"
                            fillOpacity={0.08}
                            strokeWidth={2}
                          />
                          <Radar
                            name="T2"
                            dataKey="T2"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.08}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      ) : (
                        <RadarChart data={dimensionAnalysis} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
                          <PolarGrid stroke="#3f3f46" />
                          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#d4d4d8', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 9 }} />
                          <Radar
                            dataKey="score"
                            stroke="#34d399"
                            fill="#34d399"
                            fillOpacity={0.25}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className={card}>
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-semibold text-zinc-100">Evolução do score médio</h3>
                </div>
                <div className="h-[220px] min-w-0 shrink-0">
                  <ResponsiveContainer width="100%" height={CHART_H_EVOLUTION} debounce={50}>
                    <AreaChart
                      data={timeEvolution.map((p) => ({
                        ...p,
                        tempoLabel: TIMEPOINT_LABELS[p.tempo as TimePoint] ?? p.tempo,
                      }))}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="smArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="tempoLabel" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#34d399"
                        strokeWidth={2}
                        fill="url(#smArea)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
