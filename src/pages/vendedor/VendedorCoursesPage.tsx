import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { listPublishedCatalogCourses } from '@/lib/firestore/courses';
import type { CourseSummary } from '@/types';

export function VendedorCoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const list = await listPublishedCatalogCourses();
        if (!cancelled) {
          setCourses(list.sort((a, b) => a.title.localeCompare(b.title)));
        }
      } catch {
        if (!cancelled) setErr('Não foi possível carregar o catálogo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100">Cursos no catálogo</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Abra um curso para mostrar a experiência do aluno. As respostas de questionários{' '}
        <strong className="text-zinc-300">não são salvas</strong> neste modo. Para roteiro por módulo e
        pitch B2B, use <strong className="text-zinc-300">Documentação</strong> no menu.
      </p>

      {loading ? (
        <p className="mt-8 text-zinc-500">Carregando…</p>
      ) : err ? (
        <p className="mt-8 text-red-400">{err}</p>
      ) : courses.length === 0 ? (
        <p className="mt-8 text-zinc-500">Nenhum curso publicado no catálogo.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                to={`/vendedor/curso/${c.id}`}
                className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-sky-500/40 hover:bg-zinc-900/70"
              >
                <BookOpen className="mt-0.5 shrink-0 text-sky-400" size={22} />
                <div>
                  <p className="font-medium text-zinc-100">{c.title}</p>
                  {c.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{c.description}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
