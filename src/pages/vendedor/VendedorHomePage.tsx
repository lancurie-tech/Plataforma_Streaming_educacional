import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { listAssignmentExpiryRowsForManagedCompanies } from '@/lib/firestore/seller';
import {
  fetchManagedCompaniesOverview,
  type ManagedCompanyOverview,
} from '@/lib/firestore/sellerDashboard';

const NO_IDS: string[] = [];

export function VendedorHomePage() {
  const { profile } = useAuth();
  const managedIds = profile?.managedCompanyIds ?? NO_IDS;
  const firstName = profile?.name?.split(' ')[0] ?? 'Olá';

  const [overviews, setOverviews] = useState<ManagedCompanyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiryAlert, setExpiryAlert] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!managedIds.length) {
      setOverviews([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [data, rows] = await Promise.all([
          fetchManagedCompaniesOverview(managedIds),
          listAssignmentExpiryRowsForManagedCompanies(managedIds),
        ]);
        if (cancelled) return;
        setOverviews(data);
        const soon = rows.filter(
          (r) => !r.isExpired && r.daysRemaining <= 30 && r.daysRemaining > 0
        );
        setExpiryAlert(soon.length);
      } catch {
        if (!cancelled) {
          setOverviews([]);
          setExpiryAlert(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managedIds]);

  const totals = useMemo(() => {
    let students = 0;
    let assignments = 0;
    for (const o of overviews) {
      students += o.studentCount;
      assignments += o.assignments.length;
    }
    return { students, assignments };
  }, [overviews]);

  if (!managedIds.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Início</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
          Sua conta ainda não está vinculada a nenhuma empresa. Peça ao administrador para associar as
          empresas da sua carteira em <span className="text-zinc-300">Admin → Vendedores</span>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-sky-900/40 bg-linear-to-br from-sky-950/50 to-zinc-950 p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
            <Sparkles size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sky-300/90">Painel do vendedor</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              {firstName}, bem-vindo de volta
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Aqui você vê a sua carteira em resumo. Use os atalhos abaixo para relatórios detalhados,
              prévia dos cursos ou material de apoio para conversas com clientes.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-zinc-500">Carregando resumo…</p>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Empresas</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{overviews.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Colaboradores (total)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{totals.students}</p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Liberações ativas*</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{totals.assignments}</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">*Somatório nas empresas da carteira</p>
            </div>
          </div>
        )}

        {expiryAlert > 0 ? (
          <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95">
            Há <strong>{expiryAlert}</strong> liberação(ões) com término em até 30 dias. Veja detalhes em{' '}
            <Link to="/vendedor/relatorios" className="font-medium text-sky-400 underline-offset-2 hover:underline">
              Relatórios
            </Link>
            .
          </p>
        ) : null}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        Empresas da sua carteira
      </h2>
      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Carregando…</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {overviews.map((o) => (
            <li
              key={o.company.id}
              className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Building2 className="mt-0.5 shrink-0 text-zinc-500" size={20} />
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100">{o.company.name}</p>
                  <p className="truncate font-mono text-xs text-zinc-500">{o.company.slug}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    <span className="tabular-nums text-zinc-300">{o.studentCount}</span> colaboradores ·{' '}
                    <span className="tabular-nums text-zinc-300">{o.assignments.length}</span> liberações
                  </p>
                </div>
              </div>
              <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    o.company.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'
                  }`}
                >
                  {o.company.active ? 'Ativa' : 'Inativa'}
                </span>
                <Link
                  to={`/vendedor/relatorios?empresa=${o.company.id}`}
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  Relatórios
                  <ArrowRight size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-zinc-500">Atalhos</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <li>
          <Link
            to="/vendedor/relatorios"
            className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-sky-500/40 hover:bg-zinc-900/70"
          >
            <BarChart3 className="text-sky-400" size={22} />
            <span className="mt-3 font-medium text-zinc-100">Relatórios</span>
            <span className="mt-1 text-sm text-zinc-500">Métricas, PDFs, prazos e gráficos.</span>
          </Link>
        </li>
        <li>
          <Link
            to="/vendedor/cursos"
            className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-sky-500/40 hover:bg-zinc-900/70"
          >
            <BookOpen className="text-sky-400" size={22} />
            <span className="mt-3 font-medium text-zinc-100">Cursos (prévia)</span>
            <span className="mt-1 text-sm text-zinc-500">Veja o que o colaborador enxerga no curso.</span>
          </Link>
        </li>
        <li>
          <Link
            to="/vendedor/documentacao"
            className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-sky-500/40 hover:bg-zinc-900/70"
          >
            <FileText className="text-sky-400" size={22} />
            <span className="mt-3 font-medium text-zinc-100">Documentação</span>
            <span className="mt-1 text-sm text-zinc-500">Roteiros e resumo por curso para vendas.</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
