import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { resolveTenantIdFromProfile } from '@/lib/firestore/tenancy';
import {
  createMarketplaceRequest,
  listCatalogModules,
  listMarketplaceRequestsForTenant,
} from '@/lib/firestore/marketplace';
import { COMMERCIAL_MODULE_IDS } from '@/lib/modules/commercialEntitlements';
import { getTenant, getTenantEntitlements } from '@/lib/firestore/tenancy';
import { Button } from '@/components/ui/Button';
import type { CatalogModuleDoc, MarketplaceRequestDoc } from '@/types';

const COMM_SET = new Set<string>(COMMERCIAL_MODULE_IDS);

function statusPt(s: MarketplaceRequestDoc['status']): string {
  const m: Record<MarketplaceRequestDoc['status'], string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Recusado',
    archived: 'Arquivado',
  };
  return m[s] ?? s;
}

export function AdminMarketplacePage() {
  const { user, profile } = useAuth();
  const tenantId = useMemo(() => resolveTenantIdFromProfile(profile), [profile]);

  const [catalog, setCatalog] = useState<CatalogModuleDoc[]>([]);
  const [requests, setRequests] = useState<MarketplaceRequestDoc[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [pendingByModule, setPendingByModule] = useState<Record<string, boolean>>({});
  const [tenantLabel, setTenantLabel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageById, setMessageById] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const [mods, hist, ent, tdoc] = await Promise.all([
        listCatalogModules(),
        listMarketplaceRequestsForTenant(tenantId),
        getTenantEntitlements(tenantId),
        getTenant(tenantId),
      ]);
      const visibleMods = mods.filter((m) => m.status !== 'hidden');
      setCatalog(visibleMods);
      setRequests(hist);
      setEnabled(
        new Set((ent?.enabledModuleIds ?? []).filter((id) => COMM_SET.has(id)))
      );
      setTenantLabel(tdoc?.displayName ?? tenantId);
      const pendingModuleIds = new Set(
        hist.filter((r) => r.status === 'pending').map((r) => r.moduleId)
      );
      const pend: Record<string, boolean> = {};
      for (const m of visibleMods) {
        pend[m.id] = pendingModuleIds.has(m.id);
      }
      setPendingByModule(pend);
    } catch {
      setError('Não foi possível carregar o marketplace. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRequest(mod: CatalogModuleDoc) {
    if (!tenantId || !user?.uid) return;
    const msg = (messageById[mod.id] ?? '').trim();
    setSubmittingId(mod.id);
    setError(null);
    try {
      await createMarketplaceRequest({
        tenantId,
        tenantDisplayName: tenantLabel,
        moduleId: mod.id,
        commercialModuleId: mod.commercialModuleId,
        message: msg || null,
        requestedByUid: user.uid,
        requestedByEmail: user.email ?? profile?.email ?? null,
      });
      setPendingByModule((prev) => ({ ...prev, [mod.id]: true }));
      setMessageById((prev) => ({ ...prev, [mod.id]: '' }));
      const hist = await listMarketplaceRequestsForTenant(tenantId);
      setRequests(hist);
    } catch {
      setError('Não foi possível enviar o pedido. Verifique as regras e o catálogo no Firestore.');
    } finally {
      setSubmittingId(null);
    }
  }

  if (!tenantId) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold text-zinc-100">Marketplace</h1>
        <p className="mt-2 text-sm text-zinc-400">
          A sua conta não está associada a uma organização (<code className="text-zinc-300">tenantId</code> /
          empresa). Peça suporte para concluir o onboarding.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-zinc-100">Marketplace de módulos</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Solicite a ativação de módulos comerciais para a organização{' '}
        <span className="text-zinc-200">{tenantLabel}</span>. A aprovação é feita pela equipa da
        plataforma.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">A carregar…</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {catalog.map((mod) => {
            const active = enabled.has(mod.commercialModuleId);
            const pending = pendingByModule[mod.id] === true;
            const badge =
              mod.status === 'beta' ? (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                  Beta
                </span>
              ) : null;
            return (
              <li
                key={mod.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-100">{mod.title}</h2>
                    {mod.description ? (
                      <p className="mt-1 max-w-xl text-sm text-zinc-400">{mod.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>
                        Identificador: <code className="text-zinc-400">{mod.commercialModuleId}</code>
                      </span>
                      {badge}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {active ? (
                      <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300">
                        Já ativo
                      </span>
                    ) : pending ? (
                      <span className="rounded-lg bg-zinc-700/50 px-3 py-1.5 text-xs text-zinc-300">
                        Pedido pendente
                      </span>
                    ) : (
                      <Button
                        type="button"
                        className="px-3 py-2 text-xs"
                        disabled={submittingId !== null}
                        onClick={() => void handleRequest(mod)}
                      >
                        {submittingId === mod.id ? 'A enviar…' : 'Solicitar ativação'}
                      </Button>
                    )}
                  </div>
                </div>
                {!active && !pending ? (
                  <label className="mt-4 block">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Mensagem (opcional)
                    </span>
                    <textarea
                      className="mt-1 min-h-[72px] w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                      placeholder="Contexto para a equipa (ex.: período pretendido, contacto)."
                      value={messageById[mod.id] ?? ''}
                      onChange={(e) =>
                        setMessageById((prev) => ({ ...prev, [mod.id]: e.target.value }))
                      }
                      disabled={submittingId !== null}
                      rows={2}
                    />
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-medium text-zinc-100">Histórico de pedidos</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Ainda não há pedidos registados.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-800 rounded-2xl border border-zinc-800">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm text-zinc-200">
                    Módulo <code className="text-zinc-400">{r.commercialModuleId}</code>
                  </p>
                  {r.createdAt ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {r.createdAt.toLocaleString('pt-PT')}
                    </p>
                  ) : null}
                  {r.message ? (
                    <p className="mt-1 text-xs text-zinc-400">&ldquo;{r.message}&rdquo;</p>
                  ) : null}
                </div>
                <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  {statusPt(r.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
