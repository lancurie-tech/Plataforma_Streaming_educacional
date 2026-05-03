import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { MarkdownContent } from '@/components/legal/MarkdownContent';
import { formatCpfDisplay } from '@/lib/cpf';
import { getSitePublicContent } from '@/lib/firestore/siteContent';
import { DEFAULT_ACCOUNT_RIGHTS_MARKDOWN } from '@/legal/defaultAccountRightsMarkdown';

const RIGHTS_PROSE =
  'space-y-6 text-sm leading-relaxed text-zinc-300 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:first:mt-0 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-zinc-100 [&_hr]:my-6 [&_hr]:border-zinc-700';

export function ProfilePage() {
  const { user, profile, masterAdmin, tokenClaimsReady } = useAuth();
  const [rightsMd, setRightsMd] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSitePublicContent()
      .then((doc) => {
        if (cancelled) return;
        const raw = doc?.accountRightsMarkdown?.trim();
        setRightsMd(raw && raw.length > 0 ? raw : DEFAULT_ACCOUNT_RIGHTS_MARKDOWN);
      })
      .catch(() => {
        if (!cancelled) setRightsMd(DEFAULT_ACCOUNT_RIGHTS_MARKDOWN);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (user && !tokenClaimsReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (masterAdmin) {
    return <Navigate to="/master" replace />;
  }

  if (profile?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-zinc-100">Área do usuário</h1>
      <p className="mt-2 text-sm text-zinc-400">Dados da sua conta.</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-10">
          <dl className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Nome</dt>
              <dd className="mt-1 text-zinc-200">{profile?.name ?? user?.displayName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">E-mail</dt>
              <dd className="mt-1 text-zinc-200">{profile?.email ?? user?.email ?? '—'}</dd>
            </div>
            {profile?.cpf ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">CPF</dt>
                <dd className="mt-1 text-zinc-200">{formatCpfDisplay(profile.cpf)}</dd>
              </div>
            ) : null}
            {profile?.companySlug ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Empresa</dt>
                <dd className="mt-1 font-mono text-sm text-zinc-300">{profile.companySlug}</dd>
              </div>
            ) : null}
            {profile?.companyRoleId ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Nível</dt>
                <dd className="mt-1 text-sm text-zinc-200">{profile.companyRoleId}</dd>
              </div>
            ) : null}
            {profile?.companyDepartmentId ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Área</dt>
                <dd className="mt-1 text-sm text-zinc-200">{profile.companyDepartmentId}</dd>
              </div>
            ) : null}
          </dl>

          <ChangePasswordForm />
          <DeleteAccountSection />
        </div>

        <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:sticky lg:top-24">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Meus dados</h2>
          {rightsMd === null ? (
            <p className="mt-4 text-sm text-zinc-500">Carregando…</p>
          ) : (
            <div className={`mt-4 ${RIGHTS_PROSE}`}>
              <MarkdownContent markdown={rightsMd} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
