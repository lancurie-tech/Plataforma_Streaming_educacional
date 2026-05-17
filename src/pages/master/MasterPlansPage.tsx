import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { listPlans } from '@/lib/firestore/tenancy';
import type { PlanDoc } from '@/types';
import {
  PLAN_COMMERCIAL_MODULE_LABELS_PT,
  PLAN_LIMIT_LABELS_PT,
} from '@/lib/plans/planFormConstants';

const PLAN_ORDER_DEFAULT = ['essencial', 'profissional'];


function sortPlans(plans: PlanDoc[]): PlanDoc[] {
  return [...plans].sort((a, b) => {
    const oa = PLAN_ORDER_DEFAULT.indexOf(a.id);
    const ob = PLAN_ORDER_DEFAULT.indexOf(b.id);
    if (oa >= 0 && ob >= 0) return oa - ob;
    if (oa >= 0) return -1;
    if (ob >= 0) return 1;
    return a.displayName.localeCompare(b.displayName, 'pt', { sensitivity: 'base' });
  });
}

function formatLimitRow(key: string, value: number): { label: string; valueDisplay: string } {
  const label = PLAN_LIMIT_LABELS_PT[key as keyof typeof PLAN_LIMIT_LABELS_PT] ?? key;
  let valueDisplay = String(value);
  if (key === 'maxPublishedVideoHours') valueDisplay = `${value} h`;
  if (key === 'maxStorageGb') valueDisplay = `${value} GB`;
  return { label, valueDisplay };
}

function formatEUR(n: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function MasterPlansPage() {
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const list = await listPlans();
        if (!cancelled) setPlans(sortPlans(list));
      } catch {
        if (!cancelled) setErr('Não foi possível carregar os planos.');
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
      <h1 className="text-2xl font-semibold text-zinc-100">Planos comerciais</h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-400">
        Definições na coleção <code className="font-mono text-zinc-500">plans/</code> do Firestore. Em cada cartão use{' '}
        <strong className="font-medium text-zinc-300">Editar</strong> para mudar limites, módulos comerciais e
        referência de preço (campos opcionais <code className="font-mono text-zinc-500">monthlyPriceEUR</code> e{' '}
        <code className="font-mono text-zinc-500">billingNote</code>).
      </p>

      {loading ? (
        <p className="mt-8 text-zinc-500">A carregar…</p>
      ) : err ? (
        <p className="mt-8 text-amber-400">{err}</p>
      ) : plans.length === 0 ? (
        <p className="mt-8 text-zinc-500">Nenhum plano encontrado. Execute o seed ou crie docs em Firestore.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {plans.map((plan) => {
            const mods = plan.includedModuleIds?.length ? plan.includedModuleIds : [];
            const priceDefined =
              typeof plan.monthlyPriceEUR === 'number' && Number.isFinite(plan.monthlyPriceEUR);

            const limitEntries = Object.entries(plan.limits).sort(([a], [b]) =>
              (
                PLAN_LIMIT_LABELS_PT[a as keyof typeof PLAN_LIMIT_LABELS_PT] ?? a
              ).localeCompare(PLAN_LIMIT_LABELS_PT[b as keyof typeof PLAN_LIMIT_LABELS_PT] ?? b, 'pt', {
                sensitivity: 'base',
              })
            );

            const editHref = `/master/planos/${encodeURIComponent(plan.id)}/editar`;

            return (
              <li
                key={plan.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6 shadow-sm shadow-black/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-100">{plan.displayName}</h2>
                    <p className="mt-1 font-mono text-xs text-zinc-500">plans/{plan.id}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Link
                      to={editHref}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/40 px-4 py-2.5 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-950/40"
                    >
                      <Pencil size={16} className="shrink-0" />
                      Editar
                    </Link>
                    <span
                    className={
                      plan.active
                        ? 'shrink-0 rounded-full border border-emerald-500/40 bg-emerald-950/35 px-2.5 py-1 text-xs font-medium text-emerald-200'
                        : 'shrink-0 rounded-full border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-400'
                    }
                  >
                    {plan.active ? 'Ativo à venda / em uso' : 'Inativo'}
                  </span>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Limites (entitlements modelo)
                    </h3>
                    {limitEntries.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">Sem limites no documento.</p>
                    ) : (
                      <dl className="mt-3 space-y-2 text-sm">
                        {limitEntries.map(([k, v]) => {
                          const { label, valueDisplay } = formatLimitRow(k, typeof v === 'number' ? v : 0);
                          return (
                            <div
                              key={k}
                              className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-zinc-800/80 pb-2 last:border-0 last:pb-0"
                            >
                              <dt className="text-zinc-400">{label}</dt>
                              <dd className="font-mono text-zinc-100">{valueDisplay}</dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Módulos incluídos (contrato seed)
                      </h3>
                      {mods.length === 0 ? (
                        <p className="mt-2 text-sm text-zinc-500">
                          Nenhum <code className="text-xs text-zinc-400">includedModuleIds</code> definido —
                          verifique Firestore ou o script de seed.
                        </p>
                      ) : (
                        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-200">
                          {mods.map((mid) => (
                            <li key={mid}>
                              <span className="font-medium text-zinc-100">
                                {PLAN_COMMERCIAL_MODULE_LABELS_PT[mid] ?? mid}{' '}
                              </span>
                              <span className="font-mono text-xs text-zinc-500">({mid})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
                        Preço (referência Master)
                      </h3>
                      {priceDefined ? (
                        <>
                          <p className="mt-2 text-2xl font-semibold text-violet-50">
                            {formatEUR(plan.monthlyPriceEUR as number)}{' '}
                            <span className="text-sm font-normal text-violet-200/85">/ mês</span>
                          </p>
                          {plan.billingNote?.trim() ? (
                            <p className="mt-2 text-sm text-violet-100/80">{plan.billingNote.trim()}</p>
                          ) : null}
                        </>
                      ) : plan.monthlyPriceEUR === null ? (
                        <p className="mt-2 text-sm text-zinc-400">
                          Campo <code className="text-xs">monthlyPriceEUR</code> explicitamente{' '}
                          <strong className="text-zinc-300">null</strong> — sem valor mensal registado.
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-400">
                          Não definido. Abra <strong className="font-medium text-zinc-300">Editar</strong> e preencha o
                          preço mensal (EUR) ou deixe em branco para remover o valor.
                        </p>
                      )}
                      {!priceDefined && plan.billingNote?.trim() ? (
                        <p className="mt-3 border-t border-violet-500/20 pt-3 text-sm text-violet-100/85">
                          {plan.billingNote.trim()}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
