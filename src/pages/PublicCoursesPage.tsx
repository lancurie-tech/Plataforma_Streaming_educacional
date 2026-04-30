import { useAuth } from '@/contexts/useAuth';
import { PublicHomePage } from '@/pages/PublicHomePage';
import { CoursesPage } from '@/pages/CoursesPage';

/**
 * `/cursos` (Programas): mesmo catálogo público para visitantes, admin e vendedor; alunos autenticados
 * veem a lista de cursos liberados (`CoursesPage`).
 */
export function PublicCoursesPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-zinc-500">
        Carregando…
      </div>
    );
  }

  if (user && profile?.role === 'student') {
    return <CoursesPage />;
  }

  return <PublicHomePage />;
}
