import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { STORAGE_NS } from '@/lib/brand';
import { useBrand } from '@/contexts/useBrand';

type Phase = 'curtain' | 'ready' | 'leaving' | 'gone';

/** Só para `variant="sessionOnce"` (ex.: cadastro): não repetir overlay na mesma sessão. */
const WELCOME_SEEN_KEY = `${STORAGE_NS}.publicWelcomeSeen`;

function readWelcomeAlreadySeen(): boolean {
  try {
    return typeof window !== 'undefined' && sessionStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export type PublicWelcomeOverlayProps = {
  /**
   * `gate` — rota `/`: sempre mostrar, depois `onComplete` (navegar para `/streaming`).
   * `sessionOnce` — ex. cadastro: pode omitir se já visto nesta sessão.
   */
  variant?: 'gate' | 'sessionOnce';
  /** Chamado quando o ecrã terminou (fase `gone`), antes de desmontar. */
  onComplete?: () => void;
};

export function PublicWelcomeOverlay({
  variant = 'sessionOnce',
  onComplete,
}: PublicWelcomeOverlayProps) {
  const brand = useBrand();
  const shouldSkipInitialOverlay = variant === 'sessionOnce' && readWelcomeAlreadySeen();
  const [phase, setPhase] = useState<Phase>(() => (shouldSkipInitialOverlay ? 'gone' : 'curtain'));

  const dismiss = useCallback(() => {
    setPhase((p) => {
      if (p === 'gone' || p === 'leaving') return p;
      return 'leaving';
    });
  }, []);

  useEffect(() => {
    if (phase !== 'curtain') return;
    const id = requestAnimationFrame(() => setPhase('ready'));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'ready') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = reduce ? 1100 : 2400;
    const t = setTimeout(() => dismiss(), ms);
    return () => clearTimeout(t);
  }, [phase, dismiss]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => setPhase('gone'), 560);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'gone') return;
    if (variant === 'sessionOnce') {
      try {
        sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
      } catch {
        /* quota / modo privado */
      }
    }
    onComplete?.();
  }, [phase, variant, onComplete]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase === 'ready') dismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, dismiss]);

  if (phase === 'gone') return null;

  const leaving = phase === 'leaving';
  const showInnerContent = phase === 'ready' || phase === 'leaving';

  return (
    <div
      className={clsx(
        'public-welcome-root fixed inset-0 z-200 flex cursor-pointer flex-col items-center justify-center px-6 opacity-100',
        leaving && 'public-welcome-root--leave'
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-welcome-title"
      onClick={dismiss}
    >
      <div className="public-welcome-glow pointer-events-none absolute inset-0" aria-hidden />

      <div
        className={clsx(
          'relative z-10 flex max-w-lg flex-col items-center text-center',
          phase === 'curtain' && 'opacity-0',
          showInnerContent && 'opacity-100',
          phase === 'ready' && 'public-welcome-content'
        )}
      >
        <div className="public-welcome-logo-wrap group relative">
          <div className="public-welcome-logo-ring pointer-events-none" aria-hidden />
          {brand.logoSrc ? (
            <img
              src={brand.logoSrc}
              alt={brand.platformShortName}
              width={320}
              height={56}
              className="public-welcome-logo relative z-1 h-14 w-auto max-w-[min(85vw,320px)] object-contain sm:h-46"
              draggable={false}
            />
          ) : null}
        </div>

        <h1
          id="public-welcome-title"
          className="mt-10 text-[1.35rem] font-light tracking-[0.22em] text-zinc-100/95 sm:text-2xl"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Bem-vindo ao futuro da educação
        </h1>
      </div>
    </div>
  );
}
