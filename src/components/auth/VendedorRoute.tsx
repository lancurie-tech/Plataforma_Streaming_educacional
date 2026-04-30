import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

/**
 * Painel do vendedor. A rota `/vendedor/definir-senha` fica fora deste wrapper.
 */
export function VendedorRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

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

  if (!profile.vendorConfidentiality?.acceptedAt) {
    return <Navigate to="/vendedor/aceitar-confidencialidade" replace />;
  }

  return <>{children}</>;
}
