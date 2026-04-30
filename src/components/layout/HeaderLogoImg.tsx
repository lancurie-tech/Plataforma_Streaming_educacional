import { clsx } from 'clsx';

/** Logo branco — mesmas dimensões da home pública em todos os headers (`h-18` na barra). */
const LOGO_CLASS =
  'h-11 w-auto max-w-[min(72vw,280px)] object-contain sm:h-12';

export function HeaderLogoImg({ className }: { className?: string }) {
  return (
    <img
      src="/logo_medivo_branco.png"
      alt=""
      className={clsx(LOGO_CLASS, className)}
      width={280}
      height={48}
    />
  );
}
