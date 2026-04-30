import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { listCompanies, setCompanyActive } from '@/lib/firestore/admin';
import {
  adminCreateCompanyCallable,
  adminDeleteCompanyCallable,
  mapCallableError,
} from '@/lib/firebase/callables';
import { normalizeSlug, RESERVED_COMPANY_SLUGS } from '@/lib/slug';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { CompanyDoc } from '@/types';

export function AdminCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    const list = await listCompanies();
    setCompanies(list.sort((a, b) => a.name.localeCompare(b.name)));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleActive(c: CompanyDoc) {
    try {
      await setCompanyActive(c.id, !c.active);
      await refresh();
    } catch {
      /* ignore */
    }
  }

  async function deleteCompany(c: CompanyDoc) {
    if (
      !window.confirm(
        `EXCLUIR PERMANENTEMENTE a empresa "${c.name}"?\n\nSerão apagados: documento da empresa, liberações de cursos e TODOS os usuários (alunos) vinculados a ela.\n\nEsta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingId(c.id);
    try {
      await adminDeleteCompanyCallable({ companyId: c.id });
      await refresh();
    } catch (e) {
      window.alert(mapCallableError(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const s = normalizeSlug(slug);
    if (!name.trim() || !s) {
      setErr('Preencha nome e um slug válido.');
      return;
    }
    if (RESERVED_COMPANY_SLUGS.has(s)) {
      setErr('Este slug é reservado. Escolha outro.');
      return;
    }
    setBusy(true);
    try {
      const res = await adminCreateCompanyCallable({ name: name.trim(), slug: s });
      setName('');
      setSlug('');
      setModal(false);
      setErr(null);
      await refresh();
      navigate(`/admin/empresas/${res.data.companyId}`);
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setModal(false);
    setErr(null);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Empresas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crie a empresa e configure níveis, áreas, chaves e cursos na página de edição.
          </p>
        </div>
        <Button type="button" onClick={() => setModal(true)} className="gap-2">
          <Plus size={18} />
          Nova empresa
        </Button>
      </div>

      {loading ? (
        <p className="mt-10 text-zinc-500">Carregando…</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {companies.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  to={`/admin/empresas/${c.id}`}
                  className="font-medium text-zinc-100 hover:text-emerald-400"
                >
                  {c.name}
                </Link>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  /{c.slug}/cadastro · {c.active ? 'ativa' : 'inativa'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/admin/empresas/${c.id}`}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => void toggleActive(c)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    c.active
                      ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  }`}
                >
                  {c.active ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  disabled={deletingId === c.id}
                  onClick={() => void deleteCompany(c)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {deletingId === c.id ? '…' : 'Excluir'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {companies.length === 0 && !loading ? (
        <p className="mt-6 text-center text-sm text-zinc-500">Nenhuma empresa ainda.</p>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <form onSubmit={handleCreate} className="space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100">Nova empresa</h2>
              <p className="text-sm text-zinc-500">
                Após criar, você será direcionado para a página de edição onde poderá configurar
                níveis, áreas, chaves de acesso e cursos.
              </p>
              <Input
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da empresa"
              />
              <div>
                <Input
                  label="Slug (URL)"
                  value={slug}
                  onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                  placeholder="ex: minha_empresa"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  URL: /slug/cadastro — apenas letras minúsculas, números e underscore.
                </p>
              </div>
              {err ? <p className="text-sm text-red-400">{err}</p> : null}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" isLoading={busy}>
                  Criar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
