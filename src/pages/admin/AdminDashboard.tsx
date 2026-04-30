import { useEffect, useState } from 'react';
import { Building2, GraduationCap, Users } from 'lucide-react';
import {
  countCompanies,
  countStudentsTotal,
  listCompanies,
  countStudentsByCompany,
} from '@/lib/firestore/admin';

type Row = { companyId: string; name: string; slug: string; active: boolean; students: number };

export function AdminDashboard() {
  const [totalCompanies, setTotalCompanies] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [tc, ts, companies] = await Promise.all([
          countCompanies(),
          countStudentsTotal(),
          listCompanies(),
        ]);
        if (cancelled) return;
        setTotalCompanies(tc);
        setTotalStudents(ts);
        const withCounts: Row[] = await Promise.all(
          companies.map(async (c) => ({
            companyId: c.id,
            name: c.name,
            slug: c.slug,
            active: c.active,
            students: await countStudentsByCompany(c.id),
          }))
        );
        if (!cancelled) setRows(withCounts.sort((a, b) => b.students - a.students));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100">Visão geral</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Resumo em alto nível. Para gráficos, filtros por curso/empresa e prazos, abra o{' '}
        <strong className="text-zinc-300">Dashboard</strong> no menu.
      </p>

      {loading ? (
        <p className="mt-10 text-zinc-500">Carregando dados…</p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-center gap-3 text-zinc-400">
                <Building2 size={22} className="text-emerald-500/80" />
                <span className="text-sm font-medium">Empresas</span>
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-100">{totalCompanies ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-center gap-3 text-zinc-400">
                <Users size={22} className="text-emerald-500/80" />
                <span className="text-sm font-medium">Colaboradores (alunos)</span>
              </div>
              <p className="mt-3 text-3xl font-semibold text-zinc-100">{totalStudents ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-center gap-3 text-zinc-400">
                <GraduationCap size={22} className="text-emerald-500/80" />
                <span className="text-sm font-medium">Por empresa</span>
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                Tabela abaixo mostra colaboradores cadastrados por empresa.
              </p>
            </div>
          </div>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Slug (URL)</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Alunos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((r) => (
                  <tr key={r.companyId} className="bg-zinc-950/40">
                    <td className="px-4 py-3 text-zinc-200">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{r.slug}</td>
                    <td className="px-4 py-3">
                      {r.active ? (
                        <span className="text-emerald-400">Ativa</span>
                      ) : (
                        <span className="text-amber-400">Inativa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{r.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">Nenhuma empresa cadastrada.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
