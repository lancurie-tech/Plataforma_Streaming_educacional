import { useCallback, useEffect, useState } from 'react';
import {
  approveMarketplaceRequest,
  listPendingMarketplaceRequests,
  setMarketplaceRequestOutcome,
} from '@/lib/firestore/marketplace';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/useAuth';
import type { MarketplaceRequestDoc } from '@/types';

function formatDt(d?: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('pt-PT');
}

export function MasterMarketplaceInboxPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MarketplaceRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPendingMarketplaceRequests();
      setItems(list);
    } catch {
      setError('Erro ao carregar pedidos. Confirme índices Firestore e permissões master.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    id: string,
    fn: () => Promise<void>,
    okMsg: string
  ): Promise<void> {
    setBusyId(id);
    setFeedback(null);
    setError(null);
    try {
      await fn();
      setFeedback(okMsg);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Operação falhou.';
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  const uid = user?.uid ?? '';

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Marketplace · Pedidos pendentes</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Aprovar adiciona o módulo a <code className="text-zinc-300">enabledModuleIds</code> do
            tenant em <code className="text-zinc-300">…/entitlements/current</code>.
          </p>
        </div>
        <Button type="button" variant="outline" className="px-3 py-2 text-xs" onClick={() => void load()}>
          Atualizar
        </Button>
      </div>

      {feedback ? (
        <p className="mt-4 rounded-lg border border-emerald-900/70 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-10 text-sm text-zinc-500">A carregar…</p>
      ) : items.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">Não há pedidos pendentes.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Módulo</th>
                <th className="px-4 py-3 font-medium">Pedido por</th>
                <th className="px-4 py-3 font-medium">Mensagem</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((r) => (
                <tr key={r.id} className="bg-zinc-950/40">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                    {formatDt(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">
                    <div className="font-medium">{r.tenantDisplayName || r.tenantId}</div>
                    <div className="text-xs text-zinc-500">
                      <code>{r.tenantId}</code>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-zinc-300">{r.commercialModuleId}</code>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {r.requestedByEmail ?? r.requestedByUid ?? '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-zinc-500">
                    {r.message?.trim() ? r.message : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        className="bg-emerald-600 px-3 py-2 text-xs hover:bg-emerald-500"
                        disabled={busyId !== null || !uid}
                        onClick={() =>
                          void act(r.id, () => approveMarketplaceRequest(r.id, uid), 'Pedido aprovado.')
                        }
                      >
                        {busyId === r.id ? '…' : 'Aprovar'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3 py-2 text-xs"
                        disabled={busyId !== null || !uid}
                        onClick={() =>
                          void act(
                            r.id,
                            () => setMarketplaceRequestOutcome(r.id, 'rejected', uid),
                            'Pedido recusado.'
                          )
                        }
                      >
                        Recusar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3 py-2 text-xs"
                        disabled={busyId !== null || !uid}
                        onClick={() =>
                          void act(
                            r.id,
                            () => setMarketplaceRequestOutcome(r.id, 'archived', uid),
                            'Pedido arquivado.'
                          )
                        }
                      >
                        Arquivar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
