import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { isCompanyActive } from '@/lib/firestore/companyAccess';
import {
  getCourse,
  getUserModuleSubmission,
  isUserEnrolledInCourse,
  listModules,
} from '@/lib/firestore/courses';
import { isCourseAllowedForCompany } from '@/lib/firestore/studentCourses';
import { getCompanyCourseAssignment } from '@/lib/firestore/admin';
import { computeStudentModuleLock } from '@/lib/moduleScheduleAccess';
import { ModuleSection } from '@/components/course/ModuleSection';
import { useAssistantCourseOptional } from '@/components/layout/PublicLayout';
import { computeStudentModuleView } from '@/lib/courseVisibility';
import type { CompanyCourseAssignment, CourseSummary, ModuleContent } from '@/types';

/** Estado do acordeão e do modal de conclusão reseta ao trocar de curso via `key={courseId}` no pai. */
function CourseDetailInner({ courseId }: { courseId: string }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, profile } = useAuth();
  const assistantCourseCtx = useAssistantCourseOptional();
  /** Setter do contexto é estável (useState); não usar o objeto `ctx` inteiro nas deps do efeito. */
  const setAssistantCourseFromLayout = assistantCourseCtx?.setAssistantCourse;
  const setCourseVideoAssistFromLayout = assistantCourseCtx?.setCourseVideoAssist;
  const previewAdmin =
    searchParams.get('preview') === 'admin' && profile?.role === 'admin';
  const previewSeller =
    profile?.role === 'vendedor' && location.pathname.startsWith('/vendedor/curso/');
  const previewMode = previewAdmin || previewSeller;
  const [course, setCourse] = useState<CourseSummary | null | undefined>(undefined);
  const [modules, setModules] = useState<ModuleContent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [courseCompleteBanner, setCourseCompleteBanner] = useState(false);

  const visibleModules = useMemo(() => {
    if (previewMode) return modules;
    const ctx = { previewMode: false, profile };
    return modules.filter((m) => computeStudentModuleView(m, ctx).showInCourseList);
  }, [modules, previewMode, profile]);

  const visibleModuleIdsKey = useMemo(
    () => visibleModules.map((m) => m.id).join('|'),
    [visibleModules],
  );

  const [completedByModule, setCompletedByModule] = useState<Record<string, boolean>>({});

  const companyId = profile?.companyId;
  const shouldLoadCompanyAssignment =
    !previewMode && profile?.role === 'student' && Boolean(companyId);

  const [loadedCompanyAssignment, setLoadedCompanyAssignment] = useState<{
    key: string;
    value: CompanyCourseAssignment | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user || previewMode || visibleModules.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) setCompletedByModule({});
      });
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(
        visibleModules.map(async (m) => {
          const sub = await getUserModuleSubmission(user.uid, courseId, m.id);
          if (!cancelled) map[m.id] = sub?.status === 'completed';
        }),
      );
      if (!cancelled) setCompletedByModule(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, courseId, previewMode, visibleModuleIdsKey, visibleModules]);

  useEffect(() => {
    if (!shouldLoadCompanyAssignment || !companyId) return;
    const key = `${companyId}:${courseId}`;
    let cancelled = false;
    void (async () => {
      try {
        const a = await getCompanyCourseAssignment(companyId, courseId);
        if (!cancelled) setLoadedCompanyAssignment({ key, value: a });
      } catch {
        if (!cancelled) setLoadedCompanyAssignment({ key, value: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadCompanyAssignment, companyId, courseId, previewMode, profile?.role]);

  const companyCourseAssignment = useMemo((): CompanyCourseAssignment | null | undefined => {
    if (!shouldLoadCompanyAssignment || !companyId) return null;
    const key = `${companyId}:${courseId}`;
    if (!loadedCompanyAssignment || loadedCompanyAssignment.key !== key) return undefined;
    return loadedCompanyAssignment.value;
  }, [shouldLoadCompanyAssignment, companyId, courseId, loadedCompanyAssignment]);

  const moduleLocks = useMemo(() => {
    const now = new Date();
    const ids = visibleModules.map((m) => m.id);
    return visibleModules.map((m, index) =>
      computeStudentModuleLock({
        now,
        moduleIndex: index,
        moduleId: m.id,
        orderedModuleIds: ids,
        completedByModule,
        companyCourseAssignment,
        previewMode,
        role: profile?.role,
      }),
    );
  }, [visibleModules, completedByModule, companyCourseAssignment, previewMode, profile?.role]);

  const handleToggleModuleAccordion = useCallback((moduleId: string) => {
    setOpenModuleId((prev) => (prev === moduleId ? null : moduleId));
  }, []);

  /** Ao abrir um módulo no acordeão, centrar a secção na janela (após o painel expandir). */
  useEffect(() => {
    if (!openModuleId || previewMode) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      document.getElementById(`course-module-${openModuleId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }, 100);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [openModuleId, previewMode]);

  const handleModuleFinished = useCallback(
    (completedId: string) => {
      setCompletedByModule((prev) => ({ ...prev, [completedId]: true }));
      const idx = visibleModules.findIndex((m) => m.id === completedId);
      const isLast = idx >= 0 && idx === visibleModules.length - 1;
      if (!previewMode && isLast) {
        setCourseCompleteBanner(true);
      }
      /** O próximo módulo não abre mais sozinho — o aluno escolhe no diálogo de conclusão ou após a revisão. */
    },
    [visibleModules, previewMode],
  );

  useEffect(() => {
    if (!setAssistantCourseFromLayout) return;
    const title = course && typeof course.title === 'string' ? course.title : null;
    if (title) {
      setAssistantCourseFromLayout({ courseId, courseTitle: title });
    } else {
      setAssistantCourseFromLayout(null);
    }
    return () => setAssistantCourseFromLayout(null);
  }, [courseId, course, setAssistantCourseFromLayout]);

  useEffect(() => {
    setCourseVideoAssistFromLayout?.(null);
  }, [courseId, setCourseVideoAssistFromLayout]);

  useEffect(() => {
    if (!courseCompleteBanner) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCourseCompleteBanner(false);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [courseCompleteBanner]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!courseId || !user) return;
      setErr(null);
      setCourse(undefined);
      try {
        if (
          !previewMode &&
          profile?.role === 'student' &&
          profile.companyId &&
          (await isCompanyActive(profile.companyId)) === false
        ) {
          if (!cancelled) {
            setErr('O acesso da sua empresa foi desativado. Você não pode acessar o conteúdo agora.');
            setCourse(null);
          }
          return;
        }
        if (!previewMode && profile?.role === 'student' && user) {
          const enrolled = await isUserEnrolledInCourse(user.uid, courseId);
          if (!enrolled) {
            if (!cancelled) {
              setErr('Você não está matriculado neste curso.');
              setCourse(null);
            }
            return;
          }
          if (profile.companyId) {
            const allowed = await isCourseAllowedForCompany(profile.companyId, courseId);
            if (!allowed) {
              if (!cancelled) {
                setErr(
                  'Este curso não está liberado para a sua empresa no momento. Se você já concluiu antes, seus certificados ficam em Certificados e histórico (menu).'
                );
                setCourse(null);
              }
              return;
            }
          }
        }
        const c = await getCourse(courseId);
        if (cancelled) return;
        setCourse(c);
        if (!c) {
          setModules([]);
          return;
        }
        const mods = await listModules(courseId);
        if (!cancelled) setModules(mods);
      } catch {
        if (!cancelled) {
          setErr('Não foi possível carregar o curso. Verifique se você tem acesso.');
          setCourse(null);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [courseId, user, profile?.role, profile?.companyId, previewMode]);

  if (course === undefined && !err) {
    return <p className="text-zinc-500">Carregando…</p>;
  }

  if (err || !course) {
    return (
      <div className="space-y-4">
        <p className="text-red-400">{err ?? 'Curso não encontrado ou sem permissão.'}</p>
        {err?.includes('Certificados') ? (
          <Link to="/certificados" className="block text-sm text-emerald-400 hover:underline">
            Abrir Certificados e histórico
          </Link>
        ) : null}
        <Link
          to={previewSeller ? '/vendedor/cursos' : '/cursos'}
          className="text-sm text-emerald-400 hover:underline"
        >
          ← Voltar aos cursos
        </Link>
      </div>
    );
  }

  return (
    <div>
      {previewAdmin ? (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
          <p className="font-medium text-amber-200">Pré-visualização (admin)</p>
          <p className="mt-1 text-amber-100/80">
            Visão semelhante à do aluno. O progresso desta sessão não é salvo.
          </p>
          {courseId ? (
            <Link
              to={`/admin/cursos/${courseId}/edit`}
              className="mt-2 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              ← Voltar à edição do curso
            </Link>
          ) : null}
        </div>
      ) : null}
      {previewSeller ? (
        <div className="mb-6 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/95">
          <p className="font-medium text-sky-200">Demonstração (vendas)</p>
          <p className="mt-1 text-sky-100/80">
            Experiência como a do aluno. Respostas de questionários não são salvas.
          </p>
          <Link
            to="/vendedor/cursos"
            className="mt-2 inline-block text-sm font-medium text-sky-300 hover:text-sky-200 hover:underline"
          >
            ← Voltar ao catálogo
          </Link>
        </div>
      ) : null}
      {!previewMode ? (
        <Link
          to="/cursos"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-emerald-400"
        >
          <ArrowLeft size={16} />
          Cursos
        </Link>
      ) : null}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">{course.title}</h1>
        {course.description ? (
          <p className="mt-2 text-zinc-400">{course.description}</p>
        ) : null}
      </header>

      <div className="space-y-4">
        {modules.length === 0 ? (
          <p className="text-zinc-500">Nenhum módulo publicado neste curso.</p>
        ) : visibleModules.length === 0 ? (
          <p className="text-zinc-500">Não há conteúdo para exibir neste curso.</p>
        ) : (
          visibleModules.map((m, index) =>
            user ? (
              <ModuleSection
                key={m.id}
                courseId={courseId}
                uid={user.uid}
                module={m}
                previewMode={previewMode}
                accordionOpenModuleId={previewMode ? undefined : openModuleId}
                onToggleAccordion={previewMode ? undefined : handleToggleModuleAccordion}
                onModuleFinished={previewMode ? undefined : handleModuleFinished}
                onGoToNextModule={
                  !previewMode && index < visibleModules.length - 1
                    ? () => {
                        const nextId = visibleModules[index + 1]!.id;
                        setOpenModuleId(nextId);
                      }
                    : undefined
                }
                scrollAnchorId={`course-module-${m.id}`}
                isModuleLocked={moduleLocks[index]?.locked ?? false}
                moduleLockExplanation={moduleLocks[index]?.message}
                afterFinishNextModule={
                  index < visibleModules.length - 1
                    ? {
                        title: visibleModules[index + 1]!.title,
                        /** Fluxo linear: ao concluir o módulo atual, o seguinte desbloqueia. */
                        unlocked: true,
                      }
                    : null
                }
              />
            ) : null,
          )
        )}
      </div>

      {courseCompleteBanner && !previewMode ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-complete-title"
          onClick={() => setCourseCompleteBanner(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-zinc-900 p-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="course-complete-title"
              className="text-lg font-semibold text-emerald-200"
            >
              Curso finalizado com sucesso!
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              O certificado deste curso ficará disponível na área{' '}
              <strong className="text-zinc-200">Certificados e histórico</strong>.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Link
                to="/certificados"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-emerald-500"
                onClick={() => setCourseCompleteBanner(false)}
              >
                Abrir certificados
              </Link>
              <button
                type="button"
                onClick={() => setCourseCompleteBanner(false)}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Continuar no curso
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();

  if (!courseId) {
    return <p className="text-zinc-400">Curso inválido.</p>;
  }

  return <CourseDetailInner key={courseId} courseId={courseId} />;
}
