import { Outlet } from 'react-router-dom';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { AppHeader } from './AppHeader';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
        <Outlet />
      </main>
      <LegalFooter />
    </div>
  );
}
