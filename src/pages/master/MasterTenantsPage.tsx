import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTenants } from '@/lib/firestore/tenancy';
import type { TenantDoc } from '@/types';

export function MasterTenantsPage() {
  const [rows, setRows] = useState<TenantDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const list = await listTenants();
        if (!cancelled) setRows(list);
      } catch {
        if (!cancelled) setErr('Não foi possível carregar a lista de tenants.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100">Organizações (tenants)</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Gerir planos, módulos e limites gravados em Firestore (<code className="text-zinc-500">tenants/</code>{' '}
        e{' '}
        <code className="text-zinc-500">entitlements/current</code>). O cliente atualiza permissões ao recarregar
        a página.
      </p>

      {loading ? (
        <p className="mt-8 text-zinc-500">A carregar…</p>
      ) : err ? (
        <p className="mt-8 text-amber-400">{err}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">ID documento</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="bg-zinc-950/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/master/tenants/${r.id}`}
                      className="font-medium text-violet-300 hover:underline"
                    >
                      {r.displayName || r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{r.id}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.planId}</td>
                  <td className="px-4 py-3 text-zinc-300">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">
              Sem tenants.{' '}
              <Link className="text-violet-400 hover:underline" to="/master/tenants/novo">
                Criar primeira organização
              </Link>
              .
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
