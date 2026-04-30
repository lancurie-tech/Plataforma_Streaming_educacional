import type { ReactNode } from 'react';
import { AuthHeader } from '@/components/layout/AuthHeader';
import { LegalFooter } from '@/components/legal/LegalFooter';

/** Shell comum a login, recuperação e redefinição de senha (sem overlay de boas-vindas). */
export function AuthPublicChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <AuthHeader />
      <div className="flex-1">{children}</div>
      <LegalFooter />
    </div>
  );
}
