import { clsx } from 'clsx';
import { PLATFORM_LOGO_SRC, PLATFORM_SHORT_NAME } from '@/lib/brand';

/** Logo — mesmas dimensões da home pública em todos os headers (`h-18` na barra). */
const LOGO_CLASS =
  'h-11 w-auto max-w-[min(72vw,280px)] object-contain sm:h-12';

export function HeaderLogoImg({ className }: { className?: string }) {
  return (
    <img
      src={PLATFORM_LOGO_SRC}
      alt=""
      title={PLATFORM_SHORT_NAME}
      className={clsx(LOGO_CLASS, className)}
      width={280}
      height={48}
    />
  );
}
