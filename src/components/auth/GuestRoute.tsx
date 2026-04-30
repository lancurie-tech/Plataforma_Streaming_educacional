import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (user) {
    if (profile?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (profile?.role === 'vendedor') {
      return (
        <Navigate
          to={profile.mustChangePassword ? '/vendedor/definir-senha' : '/vendedor'}
          replace
        />
      );
    }
    return <Navigate to="/streaming" replace />;
  }

  return <>{children}</>;
}
