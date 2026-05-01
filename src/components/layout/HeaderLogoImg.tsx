import { clsx } from 'clsx';
import { useBrand } from '@/contexts/useBrand';

/** Logo — mesmas dimensões da home pública em todos os headers (`h-18` na barra). */
const LOGO_CLASS =
  'h-11 w-auto max-w-[min(72vw,280px)] object-contain sm:h-12';

export function HeaderLogoImg({ className }: { className?: string }) {
  const brand = useBrand();
  if (!brand.logoSrc) return null;
  return (
    <img
      src={brand.logoSrc}
      alt=""
      title={brand.platformShortName}
      className={clsx(LOGO_CLASS, className)}
      width={280}
      height={48}
    />
  );
}
