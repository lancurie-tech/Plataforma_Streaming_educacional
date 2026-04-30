import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  listCompanies,
  listCoursesCatalog,
  listActiveAllowedCourseIds,
  listAssignmentExpiryRows,
} from '@/lib/firestore/admin';
import {
  buildCourseAnalyticsReport,
  type AnalyticsRoleSegment,
  type CourseAnalyticsReport,
} from '@/lib/firestore/analytics';
import type { AssignmentExpiryRow, CompanyDoc } from '@/types';
import { SAUDE_MENTAL_COURSE_ID } from '@/features/saude-mental/config';
import { SaudeMentalNativeDashboard } from '@/components/saude-mental/SaudeMentalNativeDashboard';

const axisTick = { fill: '#a1a1aa', fontSize: 12 };
const gridStroke = '#3f3f46';

/** Mesmo valor que `h-72` no `ChartCard`. Altura em px evita `width/height -1` no `ResponsiveContainer`. */
const CHART_AREA_PX = 288;

function truncateLabel(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      <div className="mt-6 h-72 min-h-[180px] w-full min-w-0 shrink-0">{children}</div>
    </div>
  );
}

type ViewMode = 'course' | 'company';

export function AdminAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('course');
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [companyIdFilter, setCompanyIdFilter] = useState('');
  const [allowedCourseIds, setAllowedCourseIds] = useState<string[]>([]);
  const [courseId, setCourseId] = useState(SAUDE_MENTAL_COURSE_ID);
  const [report, setReport] = useState<CourseAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiryRows, setExpiryRows] = useState<AssignmentExpiryRow[]>([]);
  const [expiryLoading, setExpiryLoading] = useState(true);
  const audienceSegment: AnalyticsRoleSegment = 'combined';
  const [roleIdFilter, setRoleIdFilter] = useState('');
  const [deptIdFilter, setDeptIdFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [co, list] = await Promise.all([listCompanies(), listCoursesCatalog()]);
        if (cancelled) return;
        setCompanies(co);
        const mapped = list.map((c) => ({ id: c.id, title: c.title }));
        setCourses(mapped);
        setCourseId((prev) => {
          if (!mapped.length) return prev;
          if (mapped.some((c) => c.id === prev)) return prev;
          return mapped[0].id;
        });
      } catch {
        if (!cancelled) setError('Não foi possível carregar empresas ou cursos.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Redirecionamento de /admin/saude-mental: abre o Dashboard já no curso do painel ampliado. */
  useEffect(() => {
    if (searchParams.get('painel') !== 'saude-mental') return;
    if (!courses.length) return;
    if (!courses.some((c) => c.id === SAUDE_MENTAL_COURSE_ID)) return;
    setCourseId(SAUDE_MENTAL_COURSE_ID);
    setViewMode('course');
    setSearchParams({}, { replace: true });
  }, [searchParams, courses, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setExpiryLoading(true);
      try {
        const rows = await listAssignmentExpiryRows();
        if (!cancelled) setExpiryRows(rows);
      } catch {
        if (!cancelled) setExpiryRows([]);
      } finally {
        if (!cancelled) setExpiryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!companyIdFilter) {
      setAllowedCourseIds([]);
      return;
    }
    let cancelled = false;
    listActiveAllowedCourseIds(companyIdFilter).then((ids) => {
      if (!cancelled) setAllowedCourseIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [companyIdFilter]);

  const coursesForCompany = useMemo(() => {
    if (!allowedCourseIds.length) return [];
    const set = new Set(allowedCourseIds);
    return courses.filter((c) => set.has(c.id));
  }, [courses, allowedCourseIds]);

  useEffect(() => {
    if (viewMode !== 'company') return;
    if (!coursesForCompany.length) return;
    setCourseId((prev) =>
      coursesForCompany.some((c) => c.id === prev) ? prev : coursesForCompany[0].id
    );
  }, [viewMode, coursesForCompany]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (courseId === SAUDE_MENTAL_COURSE_ID) {
        setReport(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (viewMode === 'company' && !companyIdFilter) {
        setReport(null);
        setLoading(false);
        return;
      }
      if (
        viewMode === 'company' &&
        companyIdFilter &&
        coursesForCompany.length > 0 &&
        !coursesForCompany.some((c) => c.id === courseId)
      ) {
        setReport(null);
        setLoading(false);
        return;
      }
      if (viewMode === 'company' && companyIdFilter && coursesForCompany.length === 0) {
        setReport(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const r = await buildCourseAnalyticsReport(courseId, {
          companyId: viewMode === 'company' ? companyIdFilter : undefined,
        });
        if (!cancelled) setReport(r);
      } catch (e) {
        if (!cancelled) {
          setReport(null);
          setError(e instanceof Error ? e.message : 'Erro ao montar métricas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, viewMode, companyIdFilter, coursesForCompany]);

  const isSaudeMentalDashboard = courseId === SAUDE_MENTAL_COURSE_ID;

  const slice = useMemo(
    () => (report ? report.segments[audienceSegment] : null),
    [report, audienceSegment]
  );

  const studentsPerCompany = useMemo(() => {
    if (!report) return [];
    return report.segments.combined.byCompany
      .filter((c) => c.students > 0)
      .map((c) => ({
        nome: truncateLabel(c.companyName, 22),
        alunos: c.students,
      }))
      .sort((a, b) => b.alunos - a.alunos);
  }, [report]);

  const accuracyByCompany = useMemo(() => {
    if (!report?.hasGradableContent || !slice) return [];
    return slice.byCompany
      .filter((c) => c.enrolledInCourse > 0 && c.gradedAnswersTotal > 0)
      .map((c) => ({
        nome: truncateLabel(c.companyName, 22),
        pct: c.aggregateAccuracyPercent ?? 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [report?.hasGradableContent, slice]);

  const moduleBars = useMemo(() => {
    if (!slice) return [];
    return slice.moduleCompletion.map((m) => ({
      modulo: truncateLabel(m.title, 18),
      concluidos: m.completed,
      matriculados: m.enrolled,
    }));
  }, [slice]);

  const firstQuestionDist = useMemo(() => {
    if (!slice?.questionDistributions.length) return [];
    const q = slice.questionDistributions[0];
    return Object.entries(q.byOptionIndex).map(([k, v]) => ({
      opcao: `Alt. ${Number(k) + 1}`,
      respostas: v,
    }));
  }, [slice]);

  const enrolledTotal = slice?.enrolledInCourseCount ?? 0;
  const completedAll = slice?.completedFullCourseCount ?? 0;

  const uniqueRoleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of slice?.byUser ?? []) {
      if (u.companyRoleId) ids.add(u.companyRoleId);
    }
    return [...ids].sort();
  }, [slice]);

  const uniqueDeptIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of slice?.byUser ?? []) {
      if (u.companyDepartmentId) ids.add(u.companyDepartmentId);
    }
    return [...ids].sort();
  }, [slice]);

  const filteredByUser = useMemo(() => {
    let rows = slice?.byUser ?? [];
    if (roleIdFilter) rows = rows.filter((u) => u.companyRoleId === roleIdFilter);
    if (deptIdFilter) rows = rows.filter((u) => u.companyDepartmentId === deptIdFilter);
    return rows;
  }, [slice, roleIdFilter, deptIdFilter]);

  const selectedCompanyName =
    companies.find((c) => c.id === companyIdFilter)?.name ?? '';

  const expiringSoon = useMemo(() => {
    return expiryRows.filter((r) => !r.isExpired && r.daysRemaining <= 30 && r.daysRemaining > 0);
  }, [expiryRows]);

  const expiredRecent = useMemo(() => {
    return expiryRows.filter((r) => r.isExpired);
  }, [expiryRows]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Compare desempenho por curso em todas as empresas, ou foque em uma empresa (cursos liberados
        para ela). Para o curso <strong className="text-zinc-300">Saúde Mental nas Empresas</strong>, o painel
        ampliado (instrumentos T0–T2, autopercepção e funil) aparece automaticamente abaixo dos filtros. Acertos
        usam <span className="font-mono text-zinc-500">answerKeys</span> (só admin).
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Prazos de liberação (curso × empresa)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Só aparecem liberações com data de término definida. Ilimitadas não entram na tabela.
        </p>
        {expiryLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Carregando prazos…</p>
        ) : expiryRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Nenhuma liberação com prazo. Configure em Empresas → Editar → Adicionar/Prazo.
          </p>
        ) : (
          <>
            {expiringSoon.length > 0 ? (
              <p className="mt-4 text-sm text-amber-200/90">
                {expiringSoon.length} liberação(ões) expira(m) em até 30 dias.
              </p>
            ) : null}
            <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 border-b border-zinc-800 bg-zinc-900/90 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 font-medium">Curso</th>
                    <th className="px-3 py-2 font-medium">Expira em</th>
                    <th className="px-3 py-2 font-medium text-right">Dias</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {expiryRows.map((r) => (
                    <tr key={`${r.companyId}-${r.courseId}`} className="bg-zinc-950/40">
                      <td className="px-3 py-2 text-zinc-200">{r.companyName}</td>
                      <td className="px-3 py-2 text-zinc-300">{r.courseTitle}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-400">
                        {r.expiresAt.toLocaleDateString('pt-BR')}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          r.isExpired ? 'text-red-400' : r.daysRemaining <= 7 ? 'text-amber-400' : 'text-zinc-400'
                        }`}
                      >
                        {r.isExpired ? '—' : r.daysRemaining}
                      </td>
                      <td className="px-3 py-2">
                        {r.isExpired ? (
                          <span className="text-red-400">Encerrado</span>
                        ) : r.daysRemaining <= 7 ? (
                          <span className="text-amber-400">Crítico</span>
                        ) : r.daysRemaining <= 30 ? (
                          <span className="text-zinc-400">Atenção</span>
                        ) : (
                          <span className="text-emerald-400/80">Ativo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expiredRecent.length > 0 ? (
              <p className="mt-3 text-xs text-zinc-600">
                {expiredRecent.length} linha(s) com acesso já encerrado (documento ainda em allowedCourses —
                remova em Editar se quiser limpar).
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex rounded-lg border border-zinc-700 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('course')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'course'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Por curso
          </button>
          <button
            type="button"
            onClick={() => setViewMode('company')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'company'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Por empresa
          </button>
        </div>

        {viewMode === 'company' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Empresa</span>
            <select
              className="min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-600"
              value={companyIdFilter}
              onChange={(e) => setCompanyIdFilter(e.target.value)}
            >
              <option value="">Selecione…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">
            {viewMode === 'company' ? 'Curso (liberado à empresa)' : 'Curso'}
          </span>
          <select
            className="min-w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-600"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={viewMode === 'company' && !companyIdFilter}
          >
            {(viewMode === 'company' ? coursesForCompany : courses).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {viewMode === 'company' && companyIdFilter && !coursesForCompany.length ? (
        <p className="mt-6 text-sm text-amber-200/90">
          Esta empresa não tem cursos em <span className="font-mono">allowedCourses</span>. Configure
          em Empresas no admin.
        </p>
      ) : null}

      {error ? (
        <p className="mt-8 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {viewMode === 'company' && !companyIdFilter ? (
        <p className="mt-10 text-zinc-500">Escolha uma empresa para carregar as métricas.</p>
      ) : isSaudeMentalDashboard ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/95">
            <strong className="text-emerald-200">Painel Saúde Mental (T0–T2).</strong> Use os filtros de empresa e
            trilha dentro do painel. As métricas gerais por curso (gráficos de matrícula) ficam ocultas neste curso
            para evitar duplicação com o modelo do programa.
          </div>
          <SaudeMentalNativeDashboard managedCompanyIds={null} />
        </div>
      ) : loading ? (
        <p className="mt-10 text-zinc-500">Carregando dados…</p>
      ) : report ? (
        <>
          {report.filteredCompanyId ? (
            <p className="mt-4 text-sm text-emerald-400/90">
              Visão filtrada: <strong className="text-zinc-200">{selectedCompanyName}</strong>
            </p>
          ) : null}

          {slice ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-sm text-zinc-500">Filtrar por:</span>
              {uniqueRoleIds.length > 0 ? (
                <select
                  className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={roleIdFilter}
                  onChange={(e) => setRoleIdFilter(e.target.value)}
                >
                  <option value="">Todos os níveis</option>
                  {uniqueRoleIds.map((id) => (
                    <option key={id} value={id}>{id.charAt(0).toUpperCase() + id.slice(1)}</option>
                  ))}
                </select>
              ) : null}
              {uniqueDeptIds.length > 0 ? (
                <select
                  className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={deptIdFilter}
                  onChange={(e) => setDeptIdFilter(e.target.value)}
                >
                  <option value="">Todas as áreas</option>
                  {uniqueDeptIds.map((id) => (
                    <option key={id} value={id}>{id.charAt(0).toUpperCase() + id.slice(1)}</option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}

          {!report.hasGradableContent ? (
            <p className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
              Não há gabaritos (<span className="font-mono">answerKeys</span>) para os módulos deste
              curso — as colunas de acerto ficam vazias. Cursos com quiz seedados (ex.: demo, curso_beta)
              passam a exibir percentuais após deploy das regras do Firestore.
            </p>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Curso</p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">{report.courseTitle}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Módulos</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-100">
                {report.moduleTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Matriculados neste curso
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-400">
                {enrolledTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Concluíram o curso (módulos visíveis ao papel)
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-100">
                {completedAll}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {!report.filteredCompanyId ? (
              <ChartCard
                title="Colaboradores por empresa"
                subtitle="Total de perfis com role aluno vinculados a cada empresa."
              >
                {studentsPerCompany.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados de empresas com alunos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={CHART_AREA_PX} debounce={50}>
                    <BarChart
                      data={studentsPerCompany}
                      margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis
                        dataKey="nome"
                        tick={axisTick}
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        height={72}
                      />
                      <YAxis tick={axisTick} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: '#e4e4e7' }}
                      />
                      <Bar dataKey="alunos" name="Alunos" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            ) : (
              <ChartCard
                title="Resumo da empresa"
                subtitle="Colaboradores e matrículas no curso selecionado."
              >
                <div className="flex h-full flex-col justify-center gap-4 text-sm text-zinc-300">
                  <p>
                    <span className="text-zinc-500">Alunos na empresa:</span>{' '}
                    <span className="text-xl font-semibold tabular-nums text-zinc-100">
                      {slice?.byCompany[0]?.students ?? 0}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Matriculados neste curso:</span>{' '}
                    <span className="text-xl font-semibold tabular-nums text-emerald-400">
                      {slice?.byCompany[0]?.enrolledInCourse ?? 0}
                    </span>
                  </p>
                  {report.hasGradableContent && slice?.byCompany[0]?.gradedAnswersTotal ? (
                    <p>
                      <span className="text-zinc-500">Taxa de acerto (agregada):</span>{' '}
                      <span className="text-xl font-semibold tabular-nums text-violet-300">
                        {slice?.byCompany[0]?.aggregateAccuracyPercent ?? '—'}%
                      </span>
                    </p>
                  ) : null}
                </div>
              </ChartCard>
            )}

            <ChartCard
              title="Conclusão por módulo"
              subtitle="Elegíveis = matriculados para quem o módulo existe no curso (audiência). Concluídos = status completed."
            >
              {moduleBars.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Este curso não tem módulos publicados ou ainda não há matrículas.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={CHART_AREA_PX} debounce={50}>
                  <BarChart data={moduleBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                      dataKey="modulo"
                      tick={axisTick}
                      interval={0}
                      angle={-22}
                      textAnchor="end"
                      height={64}
                    />
                    <YAxis tick={axisTick} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Bar dataKey="concluidos" name="Concluídos" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="matriculados" name="Elegíveis" fill="#52525b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {accuracyByCompany.length > 0 ? (
            <div className="mt-8">
              <ChartCard
                title="Taxa de acerto por empresa"
                subtitle="Respostas corretas ÷ perguntas com gabarito e resposta enviada (agregado dos matriculados)."
              >
                <ResponsiveContainer width="100%" height={CHART_AREA_PX} debounce={50}>
                  <BarChart data={accuracyByCompany} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis
                      dataKey="nome"
                      tick={axisTick}
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={72}
                    />
                    <YAxis tick={axisTick} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: 8,
                      }}
                      formatter={(v) =>
                        typeof v === 'number' ? [`${v}%`, 'Acerto'] : undefined
                      }
                    />
                    <Bar dataKey="pct" name="% acerto" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : null}

          {firstQuestionDist.length > 0 && slice?.questionDistributions[0] ? (
            <div className="mt-8">
              <ChartCard
                title="Distribuição de respostas (primeira pergunta com dados)"
                subtitle={`${slice.questionDistributions[0].moduleTitle} · ${truncateLabel(slice.questionDistributions[0].questionPrompt, 120)}`}
              >
                <ResponsiveContainer width="100%" height={CHART_AREA_PX} debounce={50}>
                  <BarChart data={firstQuestionDist} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="opcao" tick={axisTick} />
                    <YAxis tick={axisTick} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="respostas" name="Respostas" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : null}

          <div className="mt-10">
            <h2 className="text-lg font-semibold text-zinc-100">
              {report.filteredCompanyId ? 'Indicadores da empresa (curso atual)' : 'Por empresa (curso atual)'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Média de módulos concluídos e acertos (quando houver gabarito) entre matriculados.
            </p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Empresa</th>
                    <th className="px-4 py-3 font-medium text-right">Alunos (total)</th>
                    <th className="px-4 py-3 font-medium text-right">Matriculados</th>
                    <th className="px-4 py-3 font-medium text-right">Média módulos</th>
                    <th className="px-4 py-3 font-medium text-right">Acertos / avaliadas</th>
                    <th className="px-4 py-3 font-medium text-right">% agregado</th>
                    <th className="px-4 py-3 font-medium text-right">Média % por aluno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(slice?.byCompany ?? [])
                    .filter((c) => c.students > 0 || c.enrolledInCourse > 0)
                    .sort((a, b) => b.enrolledInCourse - a.enrolledInCourse)
                    .map((c) => (
                      <tr key={c.companyId} className="bg-zinc-950/40">
                        <td className="px-4 py-3 text-zinc-200">{c.companyName}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{c.students}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                          {c.enrolledInCourse}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-400/90">
                          {c.enrolledInCourse ? c.avgModulesCompleted : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                          {c.gradedAnswersTotal > 0
                            ? `${c.correctAnswersTotal} / ${c.gradedAnswersTotal}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-violet-300">
                          {c.aggregateAccuracyPercent != null ? `${c.aggregateAccuracyPercent}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-violet-300/80">
                          {c.avgUserAccuracyPercent != null ? `${c.avgUserAccuracyPercent}%` : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold text-zinc-100">
              Por aluno
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Módulos e questões contam só o que cada papel pode ver. Acertos usam gabarito e perguntas
              visíveis ao segmento.
            </p>
            <div className="mt-4 max-h-[480px] overflow-auto rounded-2xl border border-zinc-800">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="sticky top-0 border-b border-zinc-800 bg-zinc-900/90 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    {!report.filteredCompanyId ? (
                      <th className="px-4 py-3 font-medium">Empresa</th>
                    ) : null}
                    <th className="px-4 py-3 font-medium">Nível</th>
                    <th className="px-4 py-3 font-medium">Área</th>
                    <th className="px-4 py-3 font-medium">Matrícula</th>
                    <th className="px-4 py-3 font-medium text-right">Módulos</th>
                    <th className="px-4 py-3 font-medium text-right">Acertos</th>
                    <th className="px-4 py-3 font-medium text-right">% quiz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredByUser
                    .slice()
                    .sort((a, b) => {
                      if (a.enrolled !== b.enrolled) return a.enrolled ? -1 : 1;
                      if ((b.scorePercent ?? -1) !== (a.scorePercent ?? -1)) {
                        return (b.scorePercent ?? -1) - (a.scorePercent ?? -1);
                      }
                      return b.modulesCompleted - a.modulesCompleted;
                    })
                    .map((u) => (
                      <tr key={u.uid} className="bg-zinc-950/40">
                        <td className="px-4 py-3 text-zinc-200">{u.name || u.email}</td>
                        {!report.filteredCompanyId ? (
                          <td className="px-4 py-3 text-zinc-400">{u.companyName}</td>
                        ) : null}
                        <td className="px-4 py-3 capitalize text-zinc-400">{u.companyRoleId ?? '—'}</td>
                        <td className="px-4 py-3 capitalize text-zinc-400">{u.companyDepartmentId ?? '—'}</td>
                        <td className="px-4 py-3">
                          {u.enrolled ? (
                            <span className="text-emerald-400">Sim</span>
                          ) : (
                            <span className="text-zinc-500">Não</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                          {u.enrolled && u.moduleTotal > 0
                            ? `${u.modulesCompleted} / ${u.moduleTotal}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                          {u.gradedAnswers > 0
                            ? `${u.correctAnswers} / ${u.gradedAnswers}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-violet-300">
                          {u.scorePercent != null ? `${u.scorePercent}%` : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
