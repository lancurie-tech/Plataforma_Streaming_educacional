import { Link } from 'react-router-dom';
import { HeaderLogoImg } from '@/components/layout/HeaderLogoImg';
import { PLATFORM_SHORT_NAME } from '@/lib/brand';

export function AuthHeader() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-lg items-center justify-center px-4">
        <Link to="/" className="flex items-center justify-center" aria-label={`${PLATFORM_SHORT_NAME} — início`}>
          <HeaderLogoImg />
        </Link>
      </div>
    </header>
  );
}
