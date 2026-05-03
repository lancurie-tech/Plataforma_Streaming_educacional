import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COMMERCIAL_MODULE_IDS } from '@/lib/modules/commercialEntitlements';
import {
  assertPublicSlugAvailableForTenant,
  syncTenantPublicSlugDoc,
} from '@/lib/firestore/tenantPublicSlug';
import {
  getPlan,
  getTenant,
  listPlans,
  upsertTenant,
  upsertTenantEntitlements,
} from '@/lib/firestore/tenancy';
import {
  isReservedPublicSlug,
  normalizeTenantPublicSlug,
} from '@/lib/tenantHost/normalizePublicSlug';
import { Button } from '@/components/ui/Button';
import type { PlanDoc, TenantStatus } from '@/types';

function normalizeTenantDocId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    String((err as { code: string }).code) === 'permission-denied'
  );
}

export function MasterTenantNewPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [tenantIdDraft, setTenantIdDraft] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [planId, setPlanId] = useState('essencial');
  const [status, setStatus] = useState<TenantStatus>('active');
  const [mods, setMods] = useState<Record<(typeof COMMERCIAL_MODULE_IDS)[number], boolean>>({
    streaming: false,
    cursos: true,
    chat: false,
    vendedores: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [publicSlug, setPublicSlug] = useState('');

  useEffect(() => {
    let cancelled = false;
    listPlans()
      .then((p) => {
        if (!cancelled && p.length) setPlanId((cur) => p.some((x) => x.id === cur) ? cur : p[0].id);
        if (!cancelled) setPlans(p);
      })
      .catch(() => {
        if (!cancelled) setMsg('Não foi possível carregar planos.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = normalizeTenantDocId(tenantIdDraft);
    setPublicSlug(id ? normalizeTenantPublicSlug(id) : '');
  }, [tenantIdDraft]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const id = normalizeTenantDocId(tenantIdDraft);
    if (!id) {
      setMsg('Indique um ID válido (letras, números, _ e -).');
      return;
    }
    if (!displayName.trim()) {
      setMsg('Indique o nome a apresentar.');
      return;
    }
    const slug = normalizeTenantPublicSlug(publicSlug) || id;
    if (isReservedPublicSlug(slug)) {
      setMsg('Este slug público é reservado. Escolha outro.');
      return;
    }
    const enabledModuleIds = COMMERCIAL_MODULE_IDS.filter((m) => mods[m]);
    setSaving(true);
    try {
      const existing = await getTenant(id);
      if (existing) {
        setMsg(`Já existe tenant com o ID «${id}».`);
        return;
      }
      const slugFree = await assertPublicSlugAvailableForTenant(slug, id);
      if (!slugFree) {
        setMsg('Este slug público já está associado a outra organização.');
        return;
      }
      const plan = await getPlan(planId);
      const limits = plan?.limits ? { ...plan.limits } : {};
      await upsertTenant(id, {
        displayName: displayName.trim(),
        planId,
        status,
        contacts: [],
        publicSlug: slug,
      });
      await upsertTenantEntitlements(id, {
        planId,
        enabledModuleIds,
        limits,
      });
      await syncTenantPublicSlugDoc({
        tenantId: id,
        previousSlug: null,
        nextSlug: slug,
        displayName: displayName.trim(),
        enabledModuleIds,
        status,
      });
      navigate(`/master/tenants/${id}`, { replace: true });
    } catch (e) {
      setMsg(
        isPermissionDenied(e)
          ? 'Permissão negada. Use conta com claim master_admin, faça logout/login após definir o claim, e confirme deploy das regras Firestore.'
          : 'Falha ao gravar. Verifique as regras Firestore e o token master_admin.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100">Nova organização</h1>
      <p className="mt-1 text-sm text-zinc-400">
        O ID do documento costuma coincidir com o ID da empresa em <code className="text-zinc-500">companies</code>{' '}
        durante a migração (ex.: <code className="text-zinc-500">seed_empresa_alpha</code>).
      </p>

      <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="tid">
            ID do documento (Firestore)
          </label>
          <input
            id="tid"
            value={tenantIdDraft}
            onChange={(e) => setTenantIdDraft(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-zinc-100"
            placeholder="ex.: minha_instituicao"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="pubslug">
            Slug público (subdomínio)
          </label>
          <input
            id="pubslug"
            value={publicSlug}
            onChange={(e) => setPublicSlug(normalizeTenantPublicSlug(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-zinc-100"
            placeholder="ex.: minha_instituicao"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-zinc-500">
            URL por path (Firebase <code className="text-zinc-500">web.app</code>):{' '}
            <span className="break-all font-mono text-zinc-400">
              …/{publicSlug.trim() || '«slug»'}/streaming
            </span>
            <br />
            Com domínio próprio (wildcard DNS):{' '}
            <span className="font-mono text-zinc-400">
              {publicSlug.trim() ? `${publicSlug.trim()}.` : '«slug».'}
              {import.meta.env.VITE_PUBLIC_APP_APEX_DOMAIN?.trim() || 'meudominio.com'}
            </span>
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="dn">
            Nome a apresentar
          </label>
          <input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="plan">
            Plano
          </label>
          <select
            id="plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.id})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="st">
            Estado
          </label>
          <select
            id="st"
            value={status}
            onChange={(e) => setStatus(e.target.value as TenantStatus)}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100"
          >
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="pending">pending</option>
          </select>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-300">Módulos comerciais</legend>
          <div className="flex flex-col gap-2">
            {COMMERCIAL_MODULE_IDS.map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={mods[m]}
                  onChange={(e) => setMods((prev) => ({ ...prev, [m]: e.target.checked }))}
                  className="rounded border-zinc-600"
                />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
        {msg ? <p className="text-sm text-amber-400">{msg}</p> : null}
        <Button type="submit" isLoading={saving}>
          Criar tenant e entitlements
        </Button>
      </form>
    </div>
  );
}
