import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Carregando…
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
