import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  addUtcCalendarMonthsInclusive,
  DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD,
  firstUtcBlockedBillingDay,
  utcTodayYMD,
} from '@/lib/billing/tenantBillingDates';
import { listPlans, listTenants, patchTenantBilling } from '@/lib/firestore/tenancy';
import type { PlanDoc, TenantDoc } from '@/types';

function effectiveGrace(raw: TenantDoc): number {
  const g = raw.billingGraceDays;
  if (typeof g === 'number' && Number.isFinite(g)) return Math.max(0, Math.trunc(g));
  return DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD;
}

export function MasterBillingPage() {
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [rows, setRows] = useState<TenantDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p.displayName])), [plans]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const reload = useCallback(async () => {
    const tenantList = await listTenants();
    tenantList.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt', { sensitivity: 'base' }),
    );
    setRows(tenantList);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [tList, pList] = await Promise.all([listTenants(), listPlans()]);
        if (cancelled) return;
        setPlans(pList);
        tList.sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'pt', { sensitivity: 'base' }),
        );
        setRows(tList);
      } catch {
        if (!cancelled) setErr('Não foi possível carregar faturação.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(tenantId: string, patch: Parameters<typeof patchTenantBilling>[1]) {
    setSaving(true);
    setErr(null);
    try {
      await patchTenantBilling(tenantId, patch);
      await reload();
      setSelectedId(tenantId);
    } catch {
      setErr('Falha ao gravar dados de faturação.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[1220px]">
      <h1 className="text-2xl font-semibold text-zinc-100">Faturamento</h1>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        Gestão manual por tenant em <code className="rounded bg-zinc-900 px-1 text-zinc-500">tenants/…</code>. Quando
        existe <code className="rounded bg-zinc-900 px-1 text-zinc-500">billingPaidThroughInclusive</code> como{' '}
        <strong>YYYYMMDD</strong> em calendário <strong className="text-zinc-300">UTC</strong> (campo texto{' '}
        <span className="font-mono">YYYY-MM-DD</span>), o último dia coberto marca o fim do período pago;
        iniciam‑se{' '}
        <strong className="text-zinc-200">{DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD}</strong> dias corridos UTC de
        tolerança e, no dia seguinte, a função{' '}
        <code className="rounded bg-zinc-900 px-1 text-zinc-500">enforceTenantBillingSchedule</code>{' '}
        (cron diário) suspende automaticamente (<code className="text-zinc-500">billingSuspendedForPayment</code>).
      </p>

      {err ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-zinc-500">A carregar…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8 lg:flex-row">
          <section className="min-w-0 flex-1 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/40">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 border-b border-zinc-800 bg-zinc-950/90 text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Organização</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Ciclo</th>
                  <th className="px-4 py-3">Pago até (UTC)</th>
                  <th className="px-4 py-3">1.º dia bloqueio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 w-36" aria-label="Ações" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {rows.map((r) => {
                  const gd = effectiveGrace(r);
                  const iso = r.billingPaidThroughInclusive?.trim();
                  const isoTrim = iso ?? '';
                  const today = utcTodayYMD();
                  const blockStart = isoTrim ? firstUtcBlockedBillingDay(isoTrim, gd) : null;

                  let estado: { txt: string; cls: string };
                  if (r.status === 'suspended') {
                    estado =
                      r.billingSuspendedForPayment === true
                        ? {
                            txt: 'Suspenso (fatura)',
                            cls: 'text-amber-200',
                          }
                        : { txt: 'Suspenso (manual)', cls: 'text-zinc-500' };
                  } else if (!isoTrim) {
                    estado = { txt: 'Sem período registado', cls: 'text-zinc-500' };
                  } else if (!blockStart) {
                    estado = { txt: 'Data «pago até» inválida', cls: 'text-rose-300' };
                  } else if (today <= isoTrim) {
                    estado = { txt: 'Em dia (período coberto)', cls: 'text-emerald-300/95' };
                  } else if (today < blockStart) {
                    estado = {
                      txt: `Tolerância — bloqueio a partir de ${blockStart} (UTC)`,
                      cls: 'text-orange-200',
                    };
                  } else {
                    estado = {
                      txt: 'Servidor deve suspender até ~08h (Lisboa)',
                      cls: 'text-rose-200',
                    };
                  }

                  return (
                    <tr key={r.id} className="hover:bg-zinc-900/40">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-zinc-100">{r.displayName}</p>
                        <p className="font-mono text-xs text-zinc-600">{r.id}</p>
                        {r.publicSlug?.trim() ? (
                          <p className="text-[11px] text-zinc-600">Slug: {r.publicSlug}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-zinc-300">
                        {planById.get(r.planId) ?? r.planId}
                      </td>
                      <td className="px-4 py-3 align-top text-zinc-300">{r.billingCycle ?? '—'}</td>
                      <td className="px-4 py-3 align-top font-mono text-[11px] text-zinc-300">
                        {isoTrim || '—'}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-[11px] text-zinc-500">
                        {blockStart ?? '—'}
                      </td>
                      <td className={`px-4 py-3 align-top text-xs ${estado.cls}`}>{estado.txt}</td>
                      <td className="px-4 py-3 align-top">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full whitespace-nowrap text-xs"
                          onClick={() => setSelectedId(r.id)}
                          disabled={saving}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <aside className="w-full shrink-0 lg:w-[400px]">
            {selected ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                <Link
                  to={`/master/tenants/${encodeURIComponent(selected.id)}`}
                  className="inline-flex items-center gap-2 text-xs text-violet-400 hover:underline"
                >
                  <ArrowLeft size={14} /> Detalhes do tenant
                </Link>
                <h2 className="mt-3 text-lg font-semibold text-zinc-100">{selected.displayName}</h2>
                <p className="font-mono text-[11px] text-zinc-500">{selected.id}</p>

                <div className="mt-6 space-y-4 text-sm">
                  <div>
                    <label htmlFor="mb-cycle" className="block text-xs font-medium text-zinc-500">
                      Ciclo de cobrança
                    </label>
                    <select
                      id="mb-cycle"
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2.5 text-sm text-zinc-100"
                      value={
                        selected.billingCycle === 'monthly' || selected.billingCycle === 'annual'
                          ? selected.billingCycle
                          : ''
                      }
                      disabled={saving}
                      onChange={(e) =>
                        void persist(selected.id, {
                          billingCycle:
                            e.target.value === 'monthly' || e.target.value === 'annual'
                              ? e.target.value
                              : null,
                        })
                      }
                    >
                      <option value="">(não definido)</option>
                      <option value="monthly">mensal</option>
                      <option value="annual">anual</option>
                    </select>
                  </div>

                  <EditableBillingDates
                    tenant={selected}
                    saving={saving}
                    persist={persist}
                    setErr={setErr}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 border-dashed bg-zinc-950/40 p-6 text-sm text-zinc-500">
                Selecione <strong className="text-zinc-400">Editar</strong> na tabela para ajustar período de pagamento,
                tolerância e notas deste cliente.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Componente controlo rápido: campos texto + botões de extensão. */
function EditableBillingDates(props: {
  tenant: TenantDoc;
  saving: boolean;
  persist: (id: string, p: Parameters<typeof patchTenantBilling>[1]) => Promise<void>;
  setErr: Dispatch<SetStateAction<string | null>>;
}) {
  const { tenant: t0, saving, persist, setErr } = props;
  const [paidThrough, setPaidThrough] = useState(t0.billingPaidThroughInclusive ?? '');
  const [grace, setGrace] = useState<string>(
    t0.billingGraceDays != null && Number.isFinite(t0.billingGraceDays)
      ? String(effectiveGrace(t0))
      : '',
  );
  const [note, setNote] = useState(t0.billingInternalNote ?? '');

  useEffect(() => {
    setPaidThrough(t0.billingPaidThroughInclusive ?? '');
    setGrace(
      t0.billingGraceDays != null && Number.isFinite(t0.billingGraceDays)
        ? String(effectiveGrace(t0))
        : '',
    );
    setNote(t0.billingInternalNote ?? '');
  }, [t0]);

  async function submitCore(opts: Parameters<typeof patchTenantBilling>[1]) {
    await persist(t0.id, opts);
  }

  async function extendOnePeriodClick() {
    const baseIso =
      paidThrough.trim() === '' ? utcTodayYMD() : paidThrough.trim();
    const months = t0.billingCycle === 'annual' ? 12 : 1;
    const next = addUtcCalendarMonthsInclusive(baseIso, months);
    if (!next) return;
    const today = utcTodayYMD();
    const activateCover = !!t0.billingSuspendedForPayment && today <= next;

    await submitCore({
      billingPaidThroughInclusive: next,
      activateOrganization: activateCover,
    });
    setPaidThrough(next);
  }

  async function saveFields() {
    const ptTrim = paidThrough.trim();
    const today = utcTodayYMD();

    if (grace.trim() !== '') {
      const gn = Number(grace.trim());
      if (!Number.isFinite(gn) || gn < 0) {
        setErr('Indique dias de tolerância ≥ 0 ou deixe vazio para o predefinido.');
        return;
      }
    }

    /** Se `pago até` cobre «hoje» UTC inclusivo → reativa (cliente volta a ficar válido até ao cron seguinte caso tenha ficado apenas bloqueado por fatura). */
    const activate =
      t0.billingSuspendedForPayment === true &&
      /^(\d{4})-(\d{2})-(\d{2})$/.test(ptTrim) &&
      today <= ptTrim;

    const graceParsed =
      grace.trim() === ''
        ? null
        : Math.max(0, Math.trunc(Number(grace.trim())));

    await submitCore({
      billingPaidThroughInclusive: ptTrim === '' ? null : ptTrim,
      billingGraceDays: graceParsed,
      billingInternalNote: note.trim() === '' ? null : note.trim(),
      activateOrganization: activate,
    });
  }

  async function liftSuspensionBilling() {
    await submitCore({ activateOrganization: true });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="mb-paid-through" className="block text-xs font-medium text-zinc-500">
          Pago até (inclusive, UTC){' '}
          <span className="font-normal text-zinc-600">
            formato <span className="font-mono">YYYY-MM-DD</span>
          </span>
        </label>
        <input
          id="mb-paid-through"
          placeholder="YYYY-MM-DD"
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2.5 font-mono text-xs text-zinc-100"
          value={paidThrough}
          onChange={(ev) => setPaidThrough(ev.target.value)}
          disabled={saving}
        />
      </div>

      <div>
        <label htmlFor="mb-grace" className="block text-xs font-medium text-zinc-500">
          Dias extras de tolerância (omitir = usar {DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD})
        </label>
        <input
          id="mb-grace"
          inputMode="numeric"
          placeholder={`ex.: ${DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD}`}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2.5 font-mono text-sm text-zinc-100"
          value={grace}
          onChange={(ev) => setGrace(ev.target.value)}
          disabled={saving}
        />
      </div>

      <div>
        <label htmlFor="mb-note" className="block text-xs font-medium text-zinc-500">
          Nota interna Master
        </label>
        <textarea
          id="mb-note"
          rows={3}
          placeholder="Contrato verbal, último valor pago manualmente …"
          className="mt-1 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2.5 text-sm text-zinc-100"
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          disabled={saving}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" onClick={() => void saveFields()} disabled={saving}>
          Guardar campos acima
        </Button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => void extendOnePeriodClick()}>
            Confirmar período seguinte (+{t0.billingCycle === 'annual' ? '12m' : '1m'})
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            title="Útil quando o período ficou válido porque recebe transferência mesmo sem alterar campo de texto."
            onClick={() => void liftSuspensionBilling()}
          >
            Reativar mesmo tenant (limpa marca fatura)
          </Button>
        </div>

        <p className="text-[11px] leading-relaxed text-zinc-600">
          <strong className="text-zinc-300">Gestão típica:</strong> recebe pagamento mensal/anual ⇒ use «Confirmar período seguinte». Se apenas
          desbloqueio sem mudar período porque renegociou ⇒ «Reativar…» mantém dados de data.
          <strong> Planos modelo</strong> ({t0.planId}) não migram quotas automaticamente.
        </p>
      </div>
    </div>
  );
}
