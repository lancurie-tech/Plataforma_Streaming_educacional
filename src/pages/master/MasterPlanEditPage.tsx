import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { PlanDoc } from '@/types';
import { COMMERCIAL_MODULE_IDS } from '@/lib/modules/commercialEntitlements';
import {
  PLAN_COMMERCIAL_MODULE_LABELS_PT,
  PLAN_LIMIT_FIELD_KEYS,
  PLAN_LIMIT_LABELS_PT,
  type PlanLimitFieldKey,
} from '@/lib/plans/planFormConstants';
import { getPlan, updatePlanMaster } from '@/lib/firestore/tenancy';
import { Button } from '@/components/ui/Button';

const STANDARD_LIMIT_SET = new Set<string>(PLAN_LIMIT_FIELD_KEYS);
type CommercialModuleId = (typeof COMMERCIAL_MODULE_IDS)[number];

function coerceLimitNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }
  return 0;
}

function limitsStateFromPlan(limitsIn: Record<string, number> | undefined): Record<string, number> {
  const src = limitsIn ?? {};
  const out: Record<string, number> = {};
  for (const key of PLAN_LIMIT_FIELD_KEYS) {
    out[key] = coerceLimitNumber(src[key]);
  }
  for (const [key, raw] of Object.entries(src)) {
    if (!(key in out)) out[key] = coerceLimitNumber(raw);
  }
  return out;
}

function includedSetFromPlan(plan: PlanDoc): Set<string> {
  const ids = Array.isArray(plan.includedModuleIds) ? plan.includedModuleIds : [];
  const set = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if ((COMMERCIAL_MODULE_IDS as readonly string[]).includes(id)) set.add(id);
  }
  return set;
}

function orderedIncludedIds(set: ReadonlySet<string>): CommercialModuleId[] {
  return COMMERCIAL_MODULE_IDS.filter((id) => set.has(id));
}

export function MasterPlanEditPage() {
  const { planId = '' } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const decodedId = decodeURIComponent(planId.trim());

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [active, setActive] = useState(true);
  const [limitsState, setLimitsState] = useState<Record<string, number>>({});
  const [includedSet, setIncludedSet] = useState<Set<string>>(() => new Set());
  const [priceRaw, setPriceRaw] = useState('');
  const [billingNote, setBillingNote] = useState('');

  const applyLoadedPlan = useCallback((plan: PlanDoc) => {
    setDisplayName(plan.displayName ?? plan.id);
    setActive(plan.active !== false);
    setLimitsState(limitsStateFromPlan(plan.limits));
    setIncludedSet(includedSetFromPlan(plan));
    if (typeof plan.monthlyPriceEUR === 'number' && Number.isFinite(plan.monthlyPriceEUR)) {
      setPriceRaw(String(plan.monthlyPriceEUR));
    } else {
      setPriceRaw('');
    }
    setBillingNote(typeof plan.billingNote === 'string' ? plan.billingNote : '');
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!decodedId) {
      setLoadErr('Plano não indicado.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const snap = await getPlan(decodedId);
        if (cancelled) return;
        if (!snap) {
          setLoadErr('Plano não encontrado.');
          setLoading(false);
          return;
        }
        applyLoadedPlan(snap);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoadErr('Erro ao carregar o plano.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [decodedId, applyLoadedPlan]);

  const extraLimitKeys = useMemo(
    () =>
      Object.keys(limitsState)
        .filter((k) => !STANDARD_LIMIT_SET.has(k))
        .sort((a, b) => a.localeCompare(b, 'pt')),
    [limitsState],
  );

  function toggleModule(id: CommercialModuleId) {
    setIncludedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setStandardLimit(key: PlanLimitFieldKey, valueStr: string) {
    const n = coerceLimitNumber(valueStr.trim() === '' ? 0 : Number(valueStr.replace(',', '.')));
    setLimitsState((prev) => ({ ...prev, [key]: n }));
  }

  function setExtraLimit(key: string, valueStr: string) {
    const n = coerceLimitNumber(valueStr.trim() === '' ? 0 : Number(valueStr.replace(',', '.')));
    setLimitsState((prev) => ({ ...prev, [key]: n }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!decodedId) return;
    setSaving(true);
    setFeedback(null);
    const priceParsed =
      priceRaw.trim() === ''
        ? null
        : (() => {
            const n = Number(priceRaw.replace(',', '.'));
            return Number.isFinite(n) ? n : null;
          })();
    try {
      await updatePlanMaster(decodedId, {
        displayName: displayName.trim() ? displayName.trim() : decodedId,
        active,
        limits: limitsState,
        includedModuleIds: orderedIncludedIds(includedSet),
        monthlyPriceEUR: priceParsed,
        billingNote: billingNote.trim() || null,
      });
      navigate('/master/planos');
    } catch {
      setFeedback({ kind: 'err', text: 'Não foi possível gravar (permissões Firestore?).' });
    } finally {
      setSaving(false);
    }
  }

  if (!decodedId || loadErr === 'Plano não indicado.') {
    return (
      <div>
        <p className="text-amber-400">{loadErr ?? 'Inválido.'}</p>
        <Link className="mt-4 inline-block text-violet-400 hover:underline" to="/master/planos">
          ← Voltar aos planos
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-zinc-500">A carregar…</p>;
  }

  if (loadErr) {
    return (
      <div>
        <p className="text-amber-400">{loadErr}</p>
        <Link className="mt-4 inline-block text-violet-400 hover:underline" to="/master/planos">
          ← Voltar aos planos
        </Link>
      </div>
    );
  }

  const orderedSelectable = [...COMMERCIAL_MODULE_IDS];

  return (
    <div>
      <Link
        to="/master/planos"
        className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:underline"
      >
        <ArrowLeft size={16} />
        Voltar aos planos
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">Editar plano</h1>
      <p className="mt-1 font-mono text-sm text-zinc-500">plans/{decodedId}</p>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 max-w-2xl space-y-8">
        <section className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400" htmlFor="plan-display">
              Nome a apresentar
            </label>
            <input
              id="plan-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100"
              autoComplete="off"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Plano ativo (visível nos dropdowns da consola Master)
          </label>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-200">Limites modelo</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Valores inteiros ≥ 0. Outras chaves existentes em Firestore aparecem abaixo e são preservadas ao guardar.
            As alterações afetam o documento deste plano; <strong>não atualizam sozinhas</strong> os tenants que já tenham{' '}
            <code className="text-zinc-600">entitlements/current</code> gravado — atualize lá separadamente se precisar
            aplicar novo teto aos clientes.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PLAN_LIMIT_FIELD_KEYS.map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-zinc-400" htmlFor={`lim-${key}`}>
                  {PLAN_LIMIT_LABELS_PT[key]}
                </label>
                <input
                  id={`lim-${key}`}
                  type="number"
                  min={0}
                  step={1}
                  value={limitsState[key] ?? 0}
                  onChange={(e) => setStandardLimit(key, e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-zinc-100"
                />
              </div>
            ))}
          </div>
          {extraLimitKeys.length > 0 ? (
            <>
              <h3 className="mt-6 text-xs font-semibold uppercase text-zinc-500">Limites extra (Firestore)</h3>
              <div className="mt-3 grid gap-3">
                {extraLimitKeys.map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-zinc-400" htmlFor={`xl-${key}`}>
                      <code className="text-[11px] text-zinc-500">{key}</code>
                    </label>
                    <input
                      id={`xl-${key}`}
                      type="number"
                      min={0}
                      step={1}
                      value={limitsState[key] ?? 0}
                      onChange={(e) => setExtraLimit(key, e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-zinc-100"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-200">Módulos comerciais incluídos</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Lista gravada como <code className="text-zinc-600">includedModuleIds</code> na ordem comercial habitual.
          </p>
          <ul className="mt-4 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            {orderedSelectable.map((id) => {
              const checked = includedSet.has(id);
              return (
                <li key={id}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-100">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleModule(id)}
                      className="mt-0.5 rounded border-zinc-600"
                    />
                    <span>
                      {PLAN_COMMERCIAL_MODULE_LABELS_PT[id] ?? id}{' '}
                      <span className="font-mono text-xs text-zinc-500">({id})</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-200">Referência comercial (opcional)</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400" htmlFor="plan-price">
                Preço mensal (EUR)
              </label>
              <input
                id="plan-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="vazio = sem valor"
                value={priceRaw}
                onChange={(e) => setPriceRaw(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400" htmlFor="plan-bill-note">
                Nota de facturação
              </label>
              <textarea
                id="plan-bill-note"
                value={billingNote}
                onChange={(e) => setBillingNote(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100"
                placeholder="Ex.: Anual por fatura; IVA à taxa legal…"
              />
            </div>
          </div>
        </section>

        {feedback ? (
          <p className={feedback.kind === 'ok' ? 'text-sm text-emerald-400' : 'text-sm text-amber-400'}>
            {feedback.text}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" isLoading={saving}>
            Guardar alterações
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => navigate('/master/planos')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
