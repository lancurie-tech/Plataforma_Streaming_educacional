import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import {
  loadMasterConsumptionRows,
  type TenantConsumptionRow,
} from '@/lib/firestore/masterConsumption';

function fmt(n: number) {
  if (n < 0) return '—';
  return String(n);
}

export function MasterConsumptionPage() {
  const [rows, setRows] = useState<TenantConsumptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const data = await loadMasterConsumptionRows();
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setErr('Não foi possível carregar o painel de consumo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    let companies = 0;
    let users = 0;
    let courses = 0;
    let channels = 0;
    let banners = 0;
    let tracks = 0;
    for (const r of rows) {
      if (r.companiesLinked >= 0) companies += r.companiesLinked;
      if (r.usersWithTenantId >= 0) users += r.usersWithTenantId;
      if (r.courses >= 0) courses += r.courses;
      if (r.channels >= 0) channels += r.channels;
      if (r.streamingBanners >= 0) banners += r.streamingBanners;
      if (r.streamingTracks >= 0) tracks += r.streamingTracks;
    }
    return { companies, users, courses, channels, banners, tracks };
  }, [rows]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100">Consumo por organização</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Vista consolidada para acompanhar empresas ligadas ao tenant, utilizadores com{' '}
        <code className="text-zinc-500">tenantId</code>, conteúdo tenantizado (cursos, canais, banners,
        trilhas streaming)
        e limite <code className="text-zinc-500">maxActiveUsers</code> nos entitlements.
      </p>

      {loading ? (
        <p className="mt-8 text-zinc-500">A carregar…</p>
      ) : err ? (
        <p className="mt-8 text-amber-400">{err}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Empresas (ligadas)</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{totals.companies}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Perfis com tenantId</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{totals.users}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Cursos</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{totals.courses}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Canais</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{totals.channels}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Banners</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{totals.banners}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Trilhas</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{totals.tracks}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-zinc-500">
            «Perfis com tenantId» conta apenas documentos em <code className="text-zinc-600">users</code>{' '}
            onde <code className="text-zinc-600">tenantId</code> coincide com o tenant. Utilizadores só
            com <code className="text-zinc-600">companyId</code> podem não aparecer até o perfil ser
            atualizado.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Organização</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Empresas</th>
                  <th className="px-4 py-3 font-medium text-right">Utilizadores</th>
                  <th className="px-4 py-3 font-medium text-right">Limite users</th>
                  <th className="px-4 py-3 font-medium text-right">Cursos</th>
                  <th className="px-4 py-3 font-medium text-right">Canais</th>
                  <th className="px-4 py-3 font-medium text-right">Banners</th>
                  <th className="px-4 py-3 font-medium text-right">Trilhas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.map((r) => {
                  const over =
                    r.maxActiveUsers != null &&
                    r.usersWithTenantId >= 0 &&
                    r.usersWithTenantId > r.maxActiveUsers;
                  return (
                    <tr key={r.tenant.id} className="bg-zinc-950/40">
                      <td className="px-4 py-3">
                        <Link
                          to={`/master/tenants/${r.tenant.id}`}
                          className="font-medium text-violet-300 hover:underline"
                        >
                          {r.tenant.displayName || r.tenant.id}
                        </Link>
                        <div className="mt-0.5 font-mono text-[11px] text-zinc-500">{r.tenant.id}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{r.tenant.planId}</td>
                      <td className="px-4 py-3 text-zinc-300">{r.tenant.status}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {fmt(r.companiesLinked)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          over ? 'text-amber-300' : 'text-zinc-200'
                        }`}
                      >
                        {fmt(r.usersWithTenantId)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                        {r.maxActiveUsers != null ? r.maxActiveUsers : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {fmt(r.courses)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {fmt(r.channels)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {fmt(r.streamingBanners)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {fmt(r.streamingTracks)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="flex items-center justify-center gap-2 p-8 text-center text-sm text-zinc-500">
                <Activity size={18} className="shrink-0 opacity-70" />
                Sem tenants registados.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
