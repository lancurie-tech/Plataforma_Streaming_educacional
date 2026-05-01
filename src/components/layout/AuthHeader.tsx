import { Link } from 'react-router-dom';
import { HeaderLogoImg } from '@/components/layout/HeaderLogoImg';
import { useBrand } from '@/contexts/useBrand';

export function AuthHeader() {
  const brand = useBrand();
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-lg items-center justify-center px-4">
        <Link to="/" className="flex items-center justify-center" aria-label={`${brand.platformShortName} — início`}>
          <HeaderLogoImg />
        </Link>
      </div>
    </header>
  );
}
