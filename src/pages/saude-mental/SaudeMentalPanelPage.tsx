import { useAuth } from '@/contexts/useAuth';
import { SaudeMentalNativeDashboard } from '@/components/saude-mental/SaudeMentalNativeDashboard';

export function SaudeMentalPanelPage() {
  const { profile } = useAuth();

  const managedCompanyIds =
    profile?.role === 'vendedor' ? (profile.managedCompanyIds ?? []) : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Saúde Mental nas Empresas</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Painel alinhado ao modelo do programa (instrumentos T0–T2, dimensões e funil de engajamento), alimentado
            diretamente pelas matrículas e respostas na plataforma. O vendedor vê apenas as empresas da sua carteira; o
            administrador vê todas.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <SaudeMentalNativeDashboard
          managedCompanyIds={managedCompanyIds}
          showEnrolledStudentsTable={profile?.role !== 'vendedor'}
        />
      </div>
    </div>
  );
}
