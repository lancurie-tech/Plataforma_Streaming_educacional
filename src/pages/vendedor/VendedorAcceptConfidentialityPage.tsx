import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import {
  mapCallableError,
  vendedorAcceptConfidentialityCallable,
} from '@/lib/firebase/callables';
import { Button } from '@/components/ui/Button';
import { AuthHeader } from '@/components/layout/AuthHeader';

export function VendedorAcceptConfidentialityPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (!user || profile?.role !== 'vendedor') {
    return <Navigate to="/login" replace />;
  }

  if (profile.mustChangePassword) {
    return <Navigate to="/vendedor/definir-senha" replace />;
  }

  if (profile.vendorConfidentiality?.acceptedAt) {
    return <Navigate to="/vendedor" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setErr('É necessário marcar a caixa de aceite.');
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await vendedorAcceptConfidentialityCallable({ version: LEGAL_VERSIONS.vendorConfidentiality });
      await refreshProfile();
      navigate('/vendedor', { replace: true });
    } catch (e) {
      setErr(mapCallableError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <AuthHeader />
      <div className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-lg flex-col justify-center px-4 py-10">
        <h1 className="text-center text-2xl font-semibold text-zinc-100">Termo de confidencialidade</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Antes de aceder aos relatórios e dados das empresas da sua carteira, confirme que leu e aceita o
          termo de confidencialidade e obrigações de vendedor.
        </p>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-8 space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-zinc-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-600 accent-emerald-600"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Li e aceito o{' '}
              <Link
                to="/confidencialidade-vendedor"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-400 underline-offset-2 hover:underline"
              >
                Termo de confidencialidade e obrigações do vendedor
              </Link>
              , incluindo o dever de sigilo sobre dados de empresas, colaboradores e conteúdos da Medivox,
              e estou ciente das consequências em caso de violação.
            </span>
          </label>
          <p className="text-xs leading-relaxed text-zinc-600">
            A versão aceite fica registada no sistema no momento da confirmação.
          </p>
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Registando…' : 'Confirmar e continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
