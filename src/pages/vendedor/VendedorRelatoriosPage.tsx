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
import { FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useBrand } from '@/contexts/useBrand';
import { getCompany, listActiveAllowedCourseIds, listCoursesCatalog } from '@/lib/firestore/admin';
import {
  buildCourseAnalyticsReport,
  type AnalyticsRoleSegment,
  type CourseAnalyticsReport,
} from '@/lib/firestore/analytics';
import { listAssignmentExpiryRowsForManagedCompanies } from '@/lib/firestore/seller';
import {
  fetchManagedCompaniesOverview,
  type ManagedCompanyOverview,
} from '@/lib/firestore/sellerDashboard';
import {
  downloadSellerCompanyPdf,
  downloadSellerPortfolioPdf,
} from '@/lib/pdf/sellerCompanyReportPdf';
import { courseReportToSellerPdfSlice } from '@/lib/pdf/sellerCompanyMetricsPdf';
import {
  buildSaudeMentalCompanyPdfSnapshot,
  type SaudeMentalCompanyPdfSnapshot,
} from '@/lib/pdf/buildSaudeMentalCompanyPdfSnapshot';
import type { SaudeMentalPdfChartImages } from '@/lib/pdf/saudeMentalChartCapture';
import { Button } from '@/components/ui/Button';
import type { AssignmentExpiryRow, CompanyDoc } from '@/types';
import { SAUDE_MENTAL_COURSE_ID } from '@/features/saude-mental/config';
import { SaudeMentalNativeDashboard } from '@/components/saude-mental/SaudeMentalNativeDashboard';

const NO_MANAGED_COMPANY_IDS: string[] = [];

const axisTick = { fill: '#a1a1aa', fontSize: 12 };
const gridStroke = '#3f3f46';

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
      <div className="mt-6 h-72 w-full min-w-0">{children}</div>
    </div>
  );
}

type ViewMode = 'course' | 'company';

export function VendedorRelatoriosPage() {
  const brand = useBrand();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const managedIds = profile?.managedCompanyIds ?? NO_MANAGED_COMPANY_IDS;
  const vendorName = profile?.name ?? brand.vendorDisplayFallback;

  const [overviews, setOverviews] = useState<ManagedCompanyOverview[]>([]);
  const [loadingOverviews, setLoadingOverviews] = useState(true);

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
  const [sellerPdfBusyKey, setSellerPdfBusyKey] = useState<string | null>(null);
  const [pdfIncludeEnrollment, setPdfIncludeEnrollment] = useState(true);
  const [pdfIncludeSaudeMental, setPdfIncludeSaudeMental] = useState(true);
  /** Só se aplica à exportação PDF de uma empresa (carteira completa usa só tabelas). */
  const [pdfIncludeSmCharts, setPdfIncludeSmCharts] = useState(false);
  const audienceSegment: AnalyticsRoleSegment = 'combined';

  const canExportSellerPdf = pdfIncludeEnrollment || pdfIncludeSaudeMental;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await Promise.all(managedIds.map((id) => getCompany(id)));
      const co = rows.filter((c): c is CompanyDoc => c != null);
      if (cancelled) return;
      setCompanies(co.sort((a, b) => a.name.localeCompare(b.name)));
    })();
    return () => {
      cancelled = true;
    };
  }, [managedIds]);

  /** Abre visão "por empresa" quando a home envia `?empresa={companyId}`. */
  useEffect(() => {
    const cid = searchParams.get('empresa');
    if (!cid || !companies.length) return;
    if (!companies.some((c) => c.id === cid)) return;
    setCompanyIdFilter(cid);
    setViewMode('company');
  }, [searchParams, companies]);

  useEffect(() => {
    let cancelled = false;
    if (!managedIds.length) {
      setOverviews([]);
      setLoadingOverviews(false);
      return;
    }
    (async () => {
      setLoadingOverviews(true);
      try {
        const data = await fetchManagedCompaniesOverview(managedIds);
        if (!cancelled) setOverviews(data);
      } catch {
        if (!cancelled) setOverviews([]);
      } finally {
        if (!cancelled) setLoadingOverviews(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managedIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCoursesCatalog();
        if (cancelled) return;
        const mapped = list.map((c) => ({ id: c.id, title: c.title }));
        setCourses(mapped);
        setCourseId((prev) => {
          if (!mapped.length) return prev;
          if (mapped.some((c) => c.id === prev)) return prev;
          return mapped[0].id;
        });
      } catch {
        if (!cancelled) setError('Não foi possível carregar os cursos.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        const rows = await listAssignmentExpiryRowsForManagedCompanies(managedIds);
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
  }, [managedIds]);

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

  const courseNameMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c.title])),
    [courses],
  );

  async function exportSellerCompanyPdfForOverview(o: ManagedCompanyOverview) {
    if (!canExportSellerPdf) return;
    setSellerPdfBusyKey(o.company.id);
    try {
      let enrollmentMetrics: ReturnType<typeof courseReportToSellerPdfSlice> | null = null;
      let enrollmentError: string | undefined;
      if (pdfIncludeEnrollment) {
        try {
          const r = await buildCourseAnalyticsReport(courseId, {
            companyId: o.company.id,
            managedCompanyIds: managedIds,
          });
          enrollmentMetrics = courseReportToSellerPdfSlice(r);
        } catch (e) {
          enrollmentError =
            e instanceof Error ? e.message : 'Não foi possível carregar as métricas do curso selecionado.';
        }
      }

      let saudeMentalSnapshot: SaudeMentalCompanyPdfSnapshot | null = null;
      let saudeMentalError: string | undefined;
      if (pdfIncludeSaudeMental) {
        const sm = await buildSaudeMentalCompanyPdfSnapshot(o.company.id, managedIds);
        if (sm.ok) saudeMentalSnapshot = sm.data;
        else saudeMentalError = sm.error;
      }

      let chartImages: SaudeMentalPdfChartImages | undefined;
      if (pdfIncludeSmCharts && pdfIncludeSaudeMental && saudeMentalSnapshot) {
        try {
          const { captureSaudeMentalChartsPng } = await import('@/lib/pdf/saudeMentalChartCapture');
          chartImages = await captureSaudeMentalChartsPng(saudeMentalSnapshot);
        } catch {
          chartImages = undefined;
        }
      }

      await downloadSellerCompanyPdf({
        overview: o,
        vendorName,
        expiryRows,
        courseNames: courseNameMap,
        flags: {
          includeEnrollment: pdfIncludeEnrollment,
          includeSaudeMental: pdfIncludeSaudeMental,
        },
        enrollmentMetrics,
        enrollmentError,
        saudeMentalSnapshot: saudeMentalSnapshot ?? undefined,
        saudeMentalError,
        chartImages,
        branding: brand,
      });
    } finally {
      setSellerPdfBusyKey(null);
    }
  }

  async function exportSellerPortfolioPdfWithMetrics() {
    if (!overviews.length || !canExportSellerPdf) return;
    setSellerPdfBusyKey('portfolio');
    try {
      const byCompanyEntries = await Promise.all(
        overviews.map(async (o) => {
          let enrollmentMetrics: ReturnType<typeof courseReportToSellerPdfSlice> | null | undefined;
          let enrollmentError: string | undefined;
          if (pdfIncludeEnrollment) {
            try {
              const r = await buildCourseAnalyticsReport(courseId, {
                companyId: o.company.id,
                managedCompanyIds: managedIds,
              });
              enrollmentMetrics = courseReportToSellerPdfSlice(r);
            } catch (e) {
              enrollmentError =
                e instanceof Error ? e.message : 'Não foi possível carregar as métricas do curso selecionado.';
            }
          }

          let saudeMentalSnapshot: SaudeMentalCompanyPdfSnapshot | undefined;
          let saudeMentalError: string | undefined;
          if (pdfIncludeSaudeMental) {
            const sm = await buildSaudeMentalCompanyPdfSnapshot(o.company.id, managedIds);
            if (sm.ok) saudeMentalSnapshot = sm.data;
            else saudeMentalError = sm.error;
          }

          return [
            o.company.id,
            {
              enrollmentMetrics,
              enrollmentError,
              saudeMentalSnapshot,
              saudeMentalError,
            },
          ] as const;
        }),
      );

      await downloadSellerPortfolioPdf({
        overviews,
        vendorName,
        expiryRows,
        courseNames: courseNameMap,
        flags: {
          includeEnrollment: pdfIncludeEnrollment,
          includeSaudeMental: pdfIncludeSaudeMental,
        },
        byCompany: Object.fromEntries(byCompanyEntries),
        branding: brand,
      });
    } finally {
      setSellerPdfBusyKey(null);
    }
  }

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
      if (!managedIds.length) {
        setReport(null);
        setLoading(false);
        return;
      }
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
      setLoading(true);
      setError(null);
      try {
        const r = await buildCourseAnalyticsReport(courseId, {
          companyId: viewMode === 'company' ? companyIdFilter : undefined,
          managedCompanyIds: managedIds,
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
    void run();
    return () => {
      cancelled = true;
    };
  }, [courseId, viewMode, companyIdFilter, coursesForCompany, managedIds]);

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

  const moduleBars = useMemo(() => {
    if (!slice) return [];
    return slice.moduleCompletion.map((m) => ({
      modulo: truncateLabel(m.title, 18),
      concluidos: m.completed,
      matriculados: m.enrolled,
    }));
  }, [slice]);

  const enrolledTotal = slice?.enrolledInCourseCount ?? 0;
  const completedAll = slice?.completedFullCourseCount ?? 0;

  const selectedCompanyName =
    companies.find((c) => c.id === companyIdFilter)?.name ?? '';

  const expiringSoon = useMemo(() => {
    return expiryRows.filter((r) => !r.isExpired && r.daysRemaining <= 30 && r.daysRemaining > 0);
  }, [expiryRows]);

  if (!managedIds.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Relatórios</h1>
        <p className="mt-4 max-w-lg text-sm text-zinc-400">
          Sua conta ainda não está vinculada a nenhuma empresa. Peça ao administrador para associar
          as empresas da sua carteira em <span className="text-zinc-300">Admin → Vendedores</span>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Relatórios</h1>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Métricas detalhadas das empresas que você acompanha. No seletor de curso, escolha{' '}
        <strong className="text-zinc-300">Saúde Mental nas Empresas</strong> para abrir o painel ampliado (T0–T2 e
        autopercepção). Para demonstrar o conteúdo como colaborador, use <strong className="text-zinc-300">Cursos</strong>{' '}
        no menu; textos e roteiros de venda estão em <strong className="text-zinc-300">Documentação</strong>.
      </p>

      <section className="mt-8 rounded-2xl border border-sky-900/45 bg-sky-950/25 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Empresas que você representa</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Resumo com colaboradores e cursos liberados (dados do Firestore). Marque abaixo o que entra no PDF de
              relatório: métricas do curso selecionado no painel (matrículas, módulos, quiz), bloco Saúde Mental
              (funil, instrumentos T0–T2, dimensões de autopercepção) e, opcionalmente, imagens dos gráficos na
              exportação por empresa.
            </p>
            <fieldset className="mt-4 space-y-2 rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-300">
              <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Conteúdo do PDF
              </legend>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={pdfIncludeEnrollment}
                  onChange={(e) => setPdfIncludeEnrollment(e.target.checked)}
                />
                <span>
                  Métricas do curso selecionado abaixo (matrículas, conclusão por módulo, desempenho em quiz quando
                  houver chaves)
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={pdfIncludeSaudeMental}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setPdfIncludeSaudeMental(v);
                    if (!v) setPdfIncludeSmCharts(false);
                  }}
                />
                <span>
                  Saúde Mental — autopercepção e engajamento (curso Saúde Mental nas Empresas, recorte da empresa)
                </span>
              </label>
              <label className={`flex items-start gap-2 ${pdfIncludeSaudeMental ? 'cursor-pointer' : 'opacity-45'}`}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!pdfIncludeSaudeMental}
                  checked={pdfIncludeSmCharts}
                  onChange={(e) => setPdfIncludeSmCharts(e.target.checked)}
                />
                <span>
                  Incluir imagens dos gráficos (funil, evolução por momento, radar) — só na exportação{' '}
                  <strong className="text-zinc-200">por empresa</strong>; o PDF da carteira completa usa apenas
                  tabelas.
                </span>
              </label>
              {!canExportSellerPdf ? (
                <p className="text-xs text-amber-200/90">Marque pelo menos uma das duas primeiras opções.</p>
              ) : null}
            </fieldset>
          </div>
          <Button
            type="button"
            variant="outline"
            className="inline-flex items-center gap-2 border-sky-600/60 text-sky-200 hover:bg-sky-950/50"
            disabled={
              overviews.length === 0 ||
              loadingOverviews ||
              sellerPdfBusyKey !== null ||
              !canExportSellerPdf
            }
            onClick={() => void exportSellerPortfolioPdfWithMetrics()}
          >
            <FileDown size={18} />
            {sellerPdfBusyKey === 'portfolio' ? 'Gerando…' : 'PDF — carteira completa'}
          </Button>
        </div>

        {loadingOverviews ? (
          <p className="mt-6 text-sm text-zinc-500">Carregando dados das empresas…</p>
        ) : overviews.length === 0 ? (
          <p className="mt-6 text-sm text-amber-200/90">
            Nenhuma empresa encontrada com os IDs da sua carteira. Peça ao admin para conferir em{' '}
            <span className="font-mono text-zinc-300">Admin → Vendedores</span>.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overviews.map((o) => (
              <li
                key={o.company.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 shadow-sm shadow-black/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-100">{o.company.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">{o.company.slug}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                      o.company.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'
                    }`}
                  >
                    {o.company.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-sm text-zinc-400">
                  <div className="flex justify-between gap-2">
                    <dt>Colaboradores (alunos)</dt>
                    <dd className="tabular-nums text-zinc-200">{o.studentCount}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Cursos liberados</dt>
                    <dd className="tabular-nums text-zinc-200">{o.assignments.length}</dd>
                  </div>
                </dl>
                {o.registrationArchive ? (
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 p-3 text-xs">
                    <p className="font-semibold text-amber-100/95">Cadastro B2B (link e chaves)</p>
                    <p className="mt-1 text-zinc-500">Envie só por canal seguro à empresa.</p>
                    <p className="mt-2 text-zinc-500">Caminho</p>
                    <p className="break-all font-mono text-emerald-400">{o.registrationArchive.registrationPath}</p>
                    {o.registrationArchive.accessKeys?.length ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-zinc-500">Chaves v2 (nível × área): {o.registrationArchive.accessKeys.length} chaves</p>
                        {o.registrationArchive.accessKeys.slice(0, 5).map((k) => (
                          <p key={k.id} className="text-zinc-300">
                            <span className="text-zinc-500">{k.roleLabel} / {k.departmentLabel}:</span>{' '}
                            <span className="font-mono">{k.plainKey}</span>
                          </p>
                        ))}
                        {o.registrationArchive.accessKeys.length > 5 ? (
                          <p className="text-zinc-500">… e mais {o.registrationArchive.accessKeys.length - 5} chaves (exporte o PDF para ver todas)</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Nenhuma chave v2 configurada ainda.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-600">
                    Chaves de cadastro ainda não constam no arquivo (empresa antiga ou arquivo pendente).
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-sky-300 hover:bg-zinc-800"
                    onClick={() => {
                      setViewMode('company');
                      setCompanyIdFilter(o.company.id);
                    }}
                  >
                    Ver nas métricas abaixo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="inline-flex items-center gap-1.5 text-xs"
                    disabled={sellerPdfBusyKey !== null || !canExportSellerPdf}
                    onClick={() => void exportSellerCompanyPdfForOverview(o)}
                  >
                    <FileDown size={14} />
                    {sellerPdfBusyKey === o.company.id ? 'Gerando…' : 'PDF relatório'}
                  </Button>
                  {o.registrationArchive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex items-center gap-1.5 text-xs"
                      onClick={() => {
                        void (async () => {
                          const [{ generateCompanyPdf }, { listModules }] = await Promise.all([
                            import('@/lib/companyPdfExport'),
                            import('@/lib/firestore/courses'),
                          ]);
                          const moduleNames: Record<string, string> = {};
                          const moduleScheduleRowsByCourse: Record<
                            string,
                            Array<{ title: string; opens: string; closes: string }>
                          > = {};
                          for (const a of o.assignments) {
                            try {
                              const mods = await listModules(a.courseId);
                              for (const m of mods) moduleNames[m.id] = m.title;
                              const sched = a.moduleSchedule;
                              if (sched && mods.length > 0) {
                                moduleScheduleRowsByCourse[a.courseId] = mods
                                  .sort((x, y) => x.order - y.order)
                                  .map((m) => {
                                    const s = sched[m.id];
                                    return {
                                      title: m.title,
                                      opens: s?.opensAt ? s.opensAt.toLocaleDateString('pt-BR') : '—',
                                      closes: s?.closesAt ? s.closesAt.toLocaleDateString('pt-BR') : '—',
                                    };
                                  });
                              }
                            } catch { /* ignore */ }
                          }
                          await generateCompanyPdf({
                            companyName: o.company.name,
                            slug: o.company.slug,
                            registrationPath: o.registrationArchive!.registrationPath,
                            roles: o.company.roles ?? [],
                            departments: o.company.departments ?? [],
                            accessKeys: o.registrationArchive!.accessKeys ?? [],
                            courses: courses
                              .filter((c) => o.assignments.some((a2) => a2.courseId === c.id))
                              .map((c) => ({ ...c })),
                            assignments: o.assignments,
                            moduleNames,
                            moduleScheduleRowsByCourse,
                            branding: brand,
                          });
                        })();
                      }}
                    >
                      <FileDown size={14} />
                      Guia de acesso (PDF)
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Prazos de liberação (sua carteira)</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Liberações com data de término nas suas empresas.
        </p>
        {expiryLoading ? (
          <p className="mt-4 text-sm text-zinc-500">Carregando prazos…</p>
        ) : expiryRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nenhuma liberação com prazo nas empresas vinculadas.</p>
        ) : (
          <>
            {expiringSoon.length > 0 ? (
              <p className="mt-4 text-sm text-amber-200/90">
                {expiringSoon.length} liberação(ões) expira(m) em até 30 dias.
              </p>
            ) : null}
            <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[640px] text-left text-sm">
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
                ? 'bg-sky-600 text-white'
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
                ? 'bg-sky-600 text-white'
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
              className="min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
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
            className="min-w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-600"
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
          Esta empresa não tem cursos ativos em liberações no momento.
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
            <strong className="text-emerald-200">Painel Saúde Mental (T0–T2).</strong> Os dados limitam-se às
            empresas da sua carteira; ajuste empresa e trilha nos filtros do painel.
          </div>
          <SaudeMentalNativeDashboard
            managedCompanyIds={managedIds}
            showEnrolledStudentsTable={false}
          />
        </div>
      ) : loading ? (
        <p className="mt-10 text-zinc-500">Carregando dados…</p>
      ) : report ? (
        <>
          {report.filteredCompanyId ? (
            <p className="mt-4 text-sm text-sky-400/90">
              Visão: <strong className="text-zinc-200">{selectedCompanyName}</strong>
            </p>
          ) : null}

          {/* Filtros removidos — segmentação agora por Nível/Área no dashboard admin */}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="inline-flex items-center gap-2 text-sm"
              disabled={!report}
              onClick={() => {
                if (!report || !slice) return;
                void (async () => {
                  const { downloadVendorMetricsPdf } = await import('@/lib/pdf/vendorMetricsPdf');
                  await downloadVendorMetricsPdf({
                    vendorName,
                    courseTitle: report.courseTitle,
                    companyName: selectedCompanyName,
                    enrolledTotal,
                    completedAll,
                    moduleTotal: report.moduleTotal,
                    moduleBars,
                    byUser: slice.byUser ?? [],
                    branding: brand,
                  });
                })();
              }}
            >
              <FileDown size={16} />
              Exportar métricas (PDF)
            </Button>
          </div>

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
              <p className="mt-2 text-3xl font-semibold tabular-nums text-sky-400">
                {enrolledTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Concluíram o curso
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-100">
                {completedAll}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {!report.filteredCompanyId ? (
              <ChartCard title="Alunos por empresa" subtitle="Perfis aluno nas empresas da sua carteira.">
                {studentsPerCompany.length === 0 ? (
                  <p className="text-sm text-zinc-500">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
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
                      <Bar dataKey="alunos" name="Alunos" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            ) : (
              <ChartCard title="Resumo da empresa" subtitle="No curso selecionado.">
                <div className="flex h-full flex-col justify-center gap-4 text-sm text-zinc-300">
                  <p>
                    <span className="text-zinc-500">Alunos na empresa:</span>{' '}
                    <span className="text-xl font-semibold tabular-nums text-zinc-100">
                      {slice?.byCompany[0]?.students ?? 0}
                    </span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Matriculados neste curso:</span>{' '}
                    <span className="text-xl font-semibold tabular-nums text-sky-400">
                      {slice?.byCompany[0]?.enrolledInCourse ?? 0}
                    </span>
                  </p>
                </div>
              </ChartCard>
            )}

            <ChartCard
              title="Conclusão por módulo"
              subtitle="Elegíveis e concluídos (mesma lógica do painel admin)."
            >
              {moduleBars.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem módulos ou matrículas para exibir.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
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
                    <Bar dataKey="concluidos" name="Concluídos" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="matriculados" name="Elegíveis" fill="#52525b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
