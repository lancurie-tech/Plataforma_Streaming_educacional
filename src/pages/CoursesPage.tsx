import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useAssistantCourse } from '@/components/layout/PublicLayout';
import { isCompanyActive } from '@/lib/firestore/companyAccess';
import { getCourse } from '@/lib/firestore/courses';
import { listVisibleCourseIdsForStudent } from '@/lib/firestore/studentCourses';
import type { CourseSummary } from '@/types';

export function CoursesPage() {
  const { setAssistantCourse } = useAssistantCourse();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    setAssistantCourse(null);
  }, [setAssistantCourse]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [companyBlocked, setCompanyBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkCompany() {
      if (!profile?.companyId) {
        setCompanyBlocked(false);
        return;
      }
      const ok = await isCompanyActive(profile.companyId);
      if (!cancelled) setCompanyBlocked(ok === false);
    }
    void checkCompany();
    return () => {
      cancelled = true;
    };
  }, [profile?.companyId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (authLoading) return;
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const ids = await listVisibleCourseIdsForStudent(user.uid, profile?.companyId);
        const all = await Promise.all(ids.map((id) => getCourse(id)));
        const list = all.filter((c): c is CourseSummary => c !== null);
        if (!cancelled) setCourses(list);
      } catch {
        if (!cancelled) setErr('Não foi possível carregar seus cursos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [user, profile?.companyId, authLoading]);

  if (profile?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (profile?.role === 'vendedor') {
    return <Navigate to="/vendedor" replace />;
  }

  const greeting = profile?.name ?? user?.displayName ?? 'Aluno';

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
        Olá, {greeting.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        Selecione um programa para continuar.
      </p>

      {companyBlocked ? (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          O acesso da sua empresa foi temporariamente desativado. Entre em contato com o responsável na
          empresa ou com o suporte Medivox.
        </div>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-zinc-500">Carregando cursos…</p>
      ) : err ? (
        <p className="mt-10 text-center text-red-400">{err}</p>
      ) : companyBlocked ? (
        <p className="mt-10 text-center text-zinc-500">Cursos indisponíveis enquanto a empresa estiver inativa.</p>
      ) : courses.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-10 text-center">
          <BookOpen className="mx-auto text-zinc-600" size={40} />
          <p className="mt-4 text-zinc-400">
            Nenhum curso disponível para sua conta. Entre em contato com o suporte para liberação.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                to={`/curso/${c.id}`}
                className="block touch-manipulation rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition-colors active:bg-zinc-900/80 sm:p-6 hover:border-emerald-600/40 hover:bg-zinc-900"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <BookOpen size={20} />
                  </span>
                  <div>
                    <h2 className="font-medium text-zinc-100">{c.title}</h2>
                    {c.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{c.description}</p>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
