import { useAuth } from '@/contexts/useAuth';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';

export function AdminAccountPage() {
  const { user, profile } = useAuth();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-zinc-100">Conta</h1>
      <p className="mt-2 text-sm text-zinc-400">E-mail de login e alteração de senha.</p>

      <dl className="mt-8 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">E-mail</dt>
          <dd className="mt-1 text-zinc-200">{profile?.email ?? user?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Nome</dt>
          <dd className="mt-1 text-zinc-200">{profile?.name ?? user?.displayName ?? '—'}</dd>
        </div>
      </dl>

      <div className="mt-10">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
