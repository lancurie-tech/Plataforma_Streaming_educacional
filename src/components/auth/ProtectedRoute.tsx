import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (location.pathname.startsWith('/vendedor') && profile?.role !== 'vendedor') {
    return (
      <Navigate
        to={profile?.role === 'admin' ? '/admin' : '/cursos'}
        replace
      />
    );
  }

  if (profile?.role === 'vendedor') {
    const allowed = location.pathname.startsWith('/vendedor');
    if (!allowed) {
      return (
        <Navigate
          to={profile.mustChangePassword ? '/vendedor/definir-senha' : '/vendedor'}
          replace
        />
      );
    }
  }

  return <>{children}</>;
}
