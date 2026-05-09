import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COMMERCIAL_MODULE_IDS } from '@/lib/modules/commercialEntitlements';
import {
  assertPublicSlugAvailableForTenant,
  syncTenantPublicSlugDoc,
} from '@/lib/firestore/tenantPublicSlug';
import {
  getTenant,
  getTenantEntitlements,
  listPlans,
  patchTenantStatus,
  upsertTenant,
  upsertTenantEntitlements,
} from '@/lib/firestore/tenancy';
import {
  isReservedPublicSlug,
  normalizeTenantPublicSlug,
} from '@/lib/tenantHost/normalizePublicSlug';
import { Button } from '@/components/ui/Button';
import {
  masterDeleteTenantCallable,
  masterInviteTenantAdminCallable,
  mapCallableError,
} from '@/lib/firebase/callables';
import { downloadTenantAdminInvitePdf } from '@/lib/pdf/tenantAdminInvitePdf';
import type { PlanDoc, TenantDoc, TenantStatus } from '@/types';

const COMMERCIAL_SET = new Set<string>(COMMERCIAL_MODULE_IDS);

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    String((err as { code: string }).code) === 'permission-denied'
  );
}

type ModState = Record<(typeof COMMERCIAL_MODULE_IDS)[number], boolean>;

function emptyMods(): ModState {
  return {
    streaming: false,
    cursos: false,
    chat: false,
    vendedores: false,
  };
}

function tenantStatusLabel(s: TenantStatus): string {
  if (s === 'active') return 'Ativo';
  if (s === 'suspended') return 'Suspenso (desativado)';
  return 'Pendente';
}

export function MasterTenantDetailPage() {
  const navigate = useNavigate();
  const { tenantId = '' } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<TenantDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [planId, setPlanId] = useState('essencial');
  const [status, setStatus] = useState<TenantStatus>('active');
  const [mods, setMods] = useState<ModState>(() => emptyMods());
  const [limitsText, setLimitsText] = useState('{}');
  const [publicSlug, setPublicSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    async function run() {
      setLoaded(false);
      setFeedback(null);
      try {
        const [t, e, pList] = await Promise.all([
          getTenant(tenantId),
          getTenantEntitlements(tenantId),
          listPlans(),
        ]);
        if (cancelled) return;
        setPlans(pList);
        if (!t) {
          setTenant(null);
          setLoaded(true);
          return;
        }
        setTenant(t);
        setDisplayName(t.displayName);
        setPublicSlug(t.publicSlug ?? '');
        setPlanId(t.planId);
        setStatus(t.status);
        const next = emptyMods();
        if (e) {
          for (const m of COMMERCIAL_MODULE_IDS) {
            next[m] = e.enabledModuleIds.includes(m);
          }
          setPlanId(e.planId);
          setLimitsText(JSON.stringify(e.limits ?? {}, null, 2));
        } else {
          setLimitsText('{}');
        }
        setMods(next);
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setFeedback({ kind: 'err', text: 'Erro ao carregar dados.' });
          setLoaded(true);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !tenantId) return;
    let limits: Record<string, number>;
    try {
      const parsed = JSON.parse(limitsText) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        limits = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && Number.isFinite(v)) limits[k] = v;
          else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
            limits[k] = Number(v);
          }
        }
      } else {
        setFeedback({ kind: 'err', text: 'Limites devem ser um objeto JSON.' });
        return;
      }
    } catch {
      setFeedback({ kind: 'err', text: 'JSON de limites inválido.' });
      return;
    }

    const slugRaw = normalizeTenantPublicSlug(publicSlug);
    const nextSlug = slugRaw || null;
    if (slugRaw && isReservedPublicSlug(slugRaw)) {
      setFeedback({ kind: 'err', text: 'Slug público reservado. Escolha outro.' });
      return;
    }

    const previousSlug = tenant.publicSlug ?? null;

    setSaving(true);
    setFeedback(null);
    try {
      const ent = await getTenantEntitlements(tenantId);
      const prevIds = ent?.enabledModuleIds ?? [];
      const commercialFromUi = COMMERCIAL_MODULE_IDS.filter((m) => mods[m]);
      const legacyExtras = prevIds.filter((id) => !COMMERCIAL_SET.has(id));
      const enabledModuleIds = [...new Set([...commercialFromUi, ...legacyExtras])];

      if (slugRaw) {
        const free = await assertPublicSlugAvailableForTenant(slugRaw, tenantId);
        if (!free) {
          setFeedback({ kind: 'err', text: 'Este slug já está associado a outra organização.' });
          return;
        }
      }

      await upsertTenant(tenantId, {
        displayName: displayName.trim(),
        planId,
        status,
        publicSlug: nextSlug,
      });
      await upsertTenantEntitlements(tenantId, {
        planId,
        enabledModuleIds,
        limits,
      });
      await syncTenantPublicSlugDoc({
        tenantId,
        previousSlug,
        nextSlug,
        displayName: displayName.trim(),
        enabledModuleIds,
        status,
      });
      const refreshed = await getTenant(tenantId);
      if (refreshed) setTenant(refreshed);
      setFeedback({ kind: 'ok', text: 'Guardado. O cliente deve recarregar a aplicação.' });
    } catch (e) {
      setFeedback({
        kind: 'err',
        text: isPermissionDenied(e)
          ? 'Permissão negada. Use uma conta com claim master_admin, faça logout/login após o comando, e confirme `firebase deploy` das regras (tenantPublicSlugs / tenants).'
          : 'Falha ao gravar (regras / rede).',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setInviteBusy(true);
    setInviteFeedback(null);
    try {
      const res = await masterInviteTenantAdminCallable({
        tenantId,
        email: inviteEmail.trim().toLowerCase(),
        adminName: inviteName.trim(),
        appOrigin: window.location.origin,
      });
      try {
        downloadTenantAdminInvitePdf(res.data);
        setInviteFeedback({
          kind: 'ok',
          text:
            'Administrador criado. O PDF com instruções, links e módulos foi descarregado — envie-o manualmente ao cliente.',
        });
      } catch {
        setInviteFeedback({
          kind: 'ok',
          text:
            'Administrador criado, mas falhou gerar o PDF no navegador. Os dados já foram gravados; pode repetir para um novo e-mail ou pedir ao cliente «Esqueci a senha» em /login.',
        });
      }
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      setInviteFeedback({ kind: 'err', text: mapCallableError(err) });
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleQuickStatus(next: TenantStatus) {
    if (!tenant || !tenantId) return;
    setSaving(true);
    setFeedback(null);
    try {
      await patchTenantStatus(tenantId, next);
      const ent = await getTenantEntitlements(tenantId);
      await syncTenantPublicSlugDoc({
        tenantId,
        previousSlug: tenant.publicSlug ?? null,
        nextSlug: tenant.publicSlug ?? null,
        displayName: tenant.displayName,
        enabledModuleIds: ent?.enabledModuleIds ?? [],
        status: next,
      });
      setStatus(next);
      const refreshed = await getTenant(tenantId);
      if (refreshed) setTenant(refreshed);
      setFeedback({
        kind: 'ok',
        text:
          next === 'suspended'
            ? 'Organização desativada: o site público deste slug deixa de estar acessível.'
            : next === 'active'
              ? 'Organização reativada.'
              : 'Estado atualizado.',
      });
    } catch (e) {
      setFeedback({
        kind: 'err',
        text: isPermissionDenied(e)
          ? 'Permissão negada. Confirme conta master e deploy das regras.'
          : 'Não foi possível atualizar o estado.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTenant() {
    if (!tenantId) return;
    setDeleteBusy(true);
    setDeleteFeedback(null);
    try {
      await masterDeleteTenantCallable({
        tenantId,
        confirmation: deleteConfirmText.trim(),
      });
      navigate('/master');
    } catch (err) {
      setDeleteFeedback({ kind: 'err', text: mapCallableError(err) });
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!tenantId || !loaded) {
    return <p className="text-zinc-500">A carregar…</p>;
  }

  if (!tenant) {
    return (
      <div>
        <p className="text-zinc-400">Tenant não encontrado.</p>
        <Link to="/master" className="mt-4 inline-block text-violet-400 hover:underline">
          Voltar à lista
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-zinc-500">
        <Link to="/master" className="text-violet-400 hover:underline">
          ← Lista
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
        {displayName}{' '}
        <span className="font-mono text-lg font-normal text-zinc-500">({tenantId})</span>
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Estado atual:{' '}
        <span className="font-medium text-zinc-200">{tenantStatusLabel(tenant.status)}</span>
      </p>

      <div className="mt-6 flex max-w-2xl flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={saving || tenant.status === 'suspended'}
          onClick={() => void handleQuickStatus('suspended')}
          className="border-amber-600/50 text-amber-200 hover:bg-amber-950/40"
        >
          Desativar organização
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving || tenant.status === 'active'}
          onClick={() => void handleQuickStatus('active')}
          className="border-emerald-600/50 text-emerald-200 hover:bg-emerald-950/30"
        >
          Reativar organização
        </Button>
      </div>
      <p className="mt-2 max-w-2xl text-xs text-zinc-500">
        «Desativar» mantém dados no Firestore, mas bloqueia o site público deste slug. «Reativar» volta a
        permitir o acesso. Para remover tudo permanentemente, use a zona de exclusão abaixo.
      </p>

      <section className="mt-8 max-w-2xl rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
        <h2 className="text-base font-semibold text-violet-100">Primeiro administrador do cliente</h2>
        <p className="mt-1 text-xs text-violet-200/80">
          Cria a conta com perfil <code className="text-violet-200/90">admin</code> e{' '}
          <code className="text-violet-200/90">tenantId</code> neste tenant e{' '}
          <strong className="text-violet-100">descarrega um PDF</strong> com o URL público{' '}
          <span className="font-mono">/{publicSlug.trim() || tenantId}/</span>, links de login e definição de senha,
          passos para o cliente e lista dos módulos ativos nos entitlements.
        </p>
        <form onSubmit={handleInviteAdmin} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400" htmlFor="inv-name">
              Nome do administrador
            </label>
            <input
              id="inv-name"
              value={inviteName}
              onChange={(ev) => setInviteName(ev.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400" htmlFor="inv-email">
              E-mail
            </label>
            <input
              id="inv-email"
              type="email"
              value={inviteEmail}
              onChange={(ev) => setInviteEmail(ev.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100"
              autoComplete="email"
            />
          </div>
          <Button type="submit" isLoading={inviteBusy} variant="outline" className="border-violet-500/40 text-violet-100">
            Criar conta e descarregar PDF
          </Button>
          {inviteFeedback ? (
            <p
              className={
                inviteFeedback.kind === 'ok' ? 'text-sm text-emerald-400' : 'text-sm text-amber-400'
              }
            >
              {inviteFeedback.text}
            </p>
          ) : null}
        </form>
      </section>

      <form onSubmit={handleSave} className="mt-8 max-w-2xl space-y-6">
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
          <label className="block text-sm font-medium text-zinc-300" htmlFor="pubslug">
            Slug público (subdomínio)
          </label>
          <input
            id="pubslug"
            value={publicSlug}
            onChange={(e) => setPublicSlug(normalizeTenantPublicSlug(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 font-mono text-sm text-zinc-100"
            placeholder="vazio = sem URL dedicada"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Path: <span className="break-all font-mono text-zinc-400">/…/{publicSlug.trim() || '«slug»'}/streaming</span>
            <br />
            Subdomínio (quando tiver domínio):{' '}
            <span className="font-mono text-zinc-400">
              {publicSlug.trim() ? `${publicSlug.trim()}.` : '«slug».'}
              {import.meta.env.VITE_PUBLIC_APP_APEX_DOMAIN?.trim() || 'meudominio.com'}
            </span>
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="plan">
            Plano (referência)
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
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso (desativado)</option>
            <option value="pending">Pendente</option>
          </select>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-300">Módulos comerciais</legend>
          <p className="text-xs text-zinc-500">
            Tokens não comerciais em <code className="text-zinc-600">enabledModuleIds</code> são
            preservados ao guardar.
          </p>
          <div className="flex flex-col gap-2">
            {COMMERCIAL_MODULE_IDS.map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={mods[m]}
                  onChange={(ev) => setMods((prev) => ({ ...prev, [m]: ev.target.checked }))}
                  className="rounded border-zinc-600"
                />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="block text-sm font-medium text-zinc-300" htmlFor="lim">
            Limites efetivos (JSON)
          </label>
          <textarea
            id="lim"
            value={limitsText}
            onChange={(e) => setLimitsText(e.target.value)}
            rows={12}
            className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 font-mono text-xs text-zinc-100"
            spellCheck={false}
          />
        </div>
        {feedback ? (
          <p
            className={
              feedback.kind === 'ok' ? 'text-sm text-emerald-400' : 'text-sm text-amber-400'
            }
          >
            {feedback.text}
          </p>
        ) : null}
        <Button type="submit" isLoading={saving}>
          Guardar alterações
        </Button>
      </form>

      <section className="mt-12 max-w-2xl rounded-2xl border border-red-500/35 bg-red-500/5 p-5">
        <h2 className="text-base font-semibold text-red-100">Excluir organização</h2>
        <p className="mt-2 text-sm text-red-200/85">
          Remove permanentemente o documento <code className="text-red-100/90">tenants/{tenantId}</code>
          e <strong className="text-red-100">todas</strong> as subcoleções (cursos, canais, trilhas,
          entitlements, etc.), apaga o slug público associado e limpa o campo{' '}
          <code className="text-red-100/90">tenantId</code> nas empresas ligadas.{' '}
          <strong className="text-red-100">Não</strong> apaga utilizadores Firebase nem documentos em{' '}
          <code className="text-red-100/90">users/</code>.
        </p>
        <div className="mt-4">
          <label className="block text-xs font-medium text-red-200/80" htmlFor="del-confirm">
            Escreva o ID do tenant para confirmar
          </label>
          <input
            id="del-confirm"
            value={deleteConfirmText}
            onChange={(ev) => setDeleteConfirmText(ev.target.value)}
            className="mt-1 w-full rounded-xl border border-red-900/60 bg-zinc-950/80 px-3 py-2 font-mono text-sm text-zinc-100"
            placeholder={tenantId}
            autoComplete="off"
          />
        </div>
        {deleteFeedback ? (
          <p
            className={
              deleteFeedback.kind === 'ok' ? 'mt-3 text-sm text-emerald-400' : 'mt-3 text-sm text-red-300'
            }
          >
            {deleteFeedback.text}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-red-600/60 text-red-200 hover:bg-red-950/40"
          isLoading={deleteBusy}
          disabled={deleteConfirmText.trim() !== tenantId || deleteBusy}
          onClick={() => void handleDeleteTenant()}
        >
          Excluir permanentemente
        </Button>
      </section>
    </div>
  );
}
