import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

export const scrollerHideScrollbar =
  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

type VerticalScrollArrowsProps = {
  scrollKey: string;
  children: ReactNode;
  /** Classes da área rolável (altura, flex, overflow). */
  scrollClassName: string;
  /** Classes do wrapper externo (`relative`, flex, etc.). */
  rootClassName?: string;
  ariaLabelUp?: string;
  ariaLabelDown?: string;
};

/**
 * Scroll vertical com scrollbar oculta e setas + gradiente (padrão streaming / sumário do módulo).
 */
export function VerticalScrollArrows({
  scrollKey,
  children,
  scrollClassName,
  rootClassName = 'relative min-h-0 w-full',
  ariaLabelUp = 'Ver conteúdo acima',
  ariaLabelDown = 'Ver conteúdo abaixo',
}: VerticalScrollArrowsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const eps = 6;
    const nextUp = scrollTop > eps;
    const nextDown = scrollTop < maxScroll - eps;
    setCanUp((prev) => (prev === nextUp ? prev : nextUp));
    setCanDown((prev) => (prev === nextDown ? prev : nextDown));
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = 0;
    updateEdges();
    if (!el) return;
    el.addEventListener('scroll', updateEdges, { passive: true });
    const ro = new ResizeObserver(() => updateEdges());
    ro.observe(el);
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      ro.disconnect();
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges, scrollKey]);

  function scrollByDir(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(120, Math.round(el.clientHeight * 0.65));
    el.scrollBy({ top: step * dir, behavior: 'smooth' });
  }

  return (
    <div className={rootClassName}>
      <div
        ref={scrollerRef}
        className={clsx(
          scrollerHideScrollbar,
          'overscroll-y-contain scroll-smooth',
          scrollClassName
        )}
      >
        {children}
      </div>

      {canUp ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-start justify-center bg-linear-to-b from-zinc-950 via-zinc-950/85 to-transparent pt-1">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/90 hover:text-emerald-200"
            aria-label={ariaLabelUp}
          >
            <ChevronUp size={20} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {canDown ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-12 items-end justify-center bg-linear-to-t from-zinc-950 via-zinc-950/85 to-transparent pb-1">
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/90 hover:text-emerald-200"
            aria-label={ariaLabelDown}
          >
            <ChevronDown size={20} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Sumário lateral de passos (altura fixa em viewports pequenos). */
export function ModuleStepNavScroller({
  scrollKey,
  children,
}: {
  scrollKey: string;
  children: ReactNode;
}) {
  return (
    <VerticalScrollArrows
      scrollKey={scrollKey}
      rootClassName="relative min-h-0 w-full"
      scrollClassName="max-h-56 overflow-y-auto lg:max-h-[min(70vh,36rem)]"
      ariaLabelUp="Ver passos anteriores"
      ariaLabelDown="Ver mais passos"
    >
      {children}
    </VerticalScrollArrows>
  );
}
