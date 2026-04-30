import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Eye, Pencil } from 'lucide-react';
import {
  listCoursesCatalog,
  listCompanies,
  listCompanyIdsWithCourse,
  addCourseToCompany,
  removeCourseFromCompany,
} from '@/lib/firestore/admin';
import type { CompanyDoc, CourseSummary } from '@/types';
import { Button } from '@/components/ui/Button';

export function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCourse, setModalCourse] = useState<CourseSummary | null>(null);
  const [withAccess, setWithAccess] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  async function refreshList() {
    const [c, co] = await Promise.all([listCoursesCatalog(), listCompanies()]);
    setCourses(c.sort((a, b) => a.title.localeCompare(b.title)));
    setCompanies(co.sort((a, b) => a.name.localeCompare(b.name)));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refreshList();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openModal(c: CourseSummary) {
    setModalCourse(c);
    const ids = await listCompanyIdsWithCourse(c.id);
    setWithAccess(new Set(ids));
  }

  function openCoursePreview(id: string) {
    const path = `/curso/${encodeURIComponent(id)}?preview=admin`;
    window.open(`${window.location.origin}${path}`, '_blank', 'noopener,noreferrer');
  }

  async function toggleCompany(companyId: string) {
    if (!modalCourse) return;
    const courseId = modalCourse.id;
    setSaving(companyId);
    try {
      if (withAccess.has(companyId)) {
        await removeCourseFromCompany(companyId, courseId);
        setWithAccess((prev) => {
          const n = new Set(prev);
          n.delete(companyId);
          return n;
        });
      } else {
        await addCourseToCompany(companyId, courseId);
        setWithAccess((prev) => new Set(prev).add(companyId));
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Cursos</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Catálogo global. Crie ou edite cursos; para cada um, escolha quais empresas têm acesso.
          </p>
        </div>
        <Button type="button" onClick={() => navigate('/admin/cursos/novo')}>
          Criar curso
        </Button>
      </div>

      {loading ? (
        <p className="mt-10 text-zinc-500">Carregando…</p>
      ) : courses.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">Nenhum curso na coleção Firestore `courses`.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {courses.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <BookOpen size={20} />
                </span>
                <div>
                  <h2 className="font-medium text-zinc-100">{c.title}</h2>
                  <p className="font-mono text-xs text-zinc-600">{c.id}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/admin/cursos/${c.id}/edit`)}>
                  <Pencil size={16} />
                  Editar
                </Button>
                <Button type="button" variant="outline" onClick={() => openCoursePreview(c.id)}>
                  <Eye size={16} />
                  Prévia
                </Button>
                <Button type="button" variant="outline" onClick={() => void openModal(c)}>
                  Empresas com acesso
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalCourse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-100">{modalCourse.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">Marque ou desmarque empresas.</p>
            <ul className="mt-6 space-y-2">
              {companies.map((co) => {
                const on = withAccess.has(co.id);
                const busy = saving === co.id;
                return (
                  <li
                    key={co.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                  >
                    <span className="text-sm text-zinc-200">
                      {co.name}
                      {!co.active ? (
                        <span className="ml-2 text-xs text-amber-500">(inativa)</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleCompany(co.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        on
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      {busy ? '…' : on ? 'Remover' : 'Incluir'}
                    </button>
                  </li>
                );
              })}
            </ul>
            {companies.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Cadastre empresas primeiro.</p>
            ) : null}
            <Button type="button" className="mt-6 w-full" onClick={() => setModalCourse(null)}>
              Fechar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
