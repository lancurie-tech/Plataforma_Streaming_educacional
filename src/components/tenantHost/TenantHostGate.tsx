import type { ReactNode } from 'react';
import { usePublicTenantHost } from '@/contexts/usePublicTenantHost';

export function TenantHostGate({ children }: { children: ReactNode }) {
  const { loading, hostError, isSuspended } = usePublicTenantHost();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        A carregar ambiente…
      </div>
    );
  }

  if (hostError === 'invalid_slug') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-center text-zinc-300">
        <h1 className="text-lg font-semibold text-zinc-100">Endereço inválido</h1>
        <p className="max-w-md text-sm text-zinc-400">
          Este subdomínio não está disponível. Utilize o endereço enviado pela sua organização ou o site
          principal da plataforma.
        </p>
      </div>
    );
  }

  if (hostError === 'not_found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-center text-zinc-300">
        <h1 className="text-lg font-semibold text-zinc-100">Organização não encontrada</h1>
        <p className="max-w-md text-sm text-zinc-400">
          Não existe uma instância configurada para este endereço. Confirme o link ou contacte o suporte.
        </p>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-center text-zinc-300">
        <h1 className="text-lg font-semibold text-zinc-100">Instância indisponível</h1>
        <p className="max-w-md text-sm text-zinc-400">
          O acesso a esta organização está temporariamente suspenso. Contacte o administrador ou o
          suporte comercial.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
