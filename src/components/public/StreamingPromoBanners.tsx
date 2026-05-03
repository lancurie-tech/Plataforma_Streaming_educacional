import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { StreamingBanner } from '@/types';

const ROTATE_MS = 5500;

const SLOT_OFFSETS = [-2, -1, 0, 1, 2] as const;

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

function normalizeInternalHref(href: string, streamingHomePath: string): string {
  const t = href.trim();
  if (!t || t === '#') return streamingHomePath;
  if (t === '/streaming') return streamingHomePath;
  if (t.startsWith('/')) return t;
  return `/${t}`;
}

type BannerTileProps = {
  banner: StreamingBanner;
  /** Destaque visual (centro do carrossel). */
  featured: boolean;
  /** Carregar imagem com prioridade (slot central). */
  eagerImage: boolean;
  /** Rota da home de streaming (ex. `/alpha/streaming`). */
  streamingHomePath: string;
};

function BannerTile({ banner, featured, eagerImage, streamingHomePath }: BannerTileProps) {
  const desktop = banner.imageUrl;
  const mobile = banner.imageUrlMobile?.trim();
  const label = banner.title.trim() || 'Destaque';
  const href = banner.linkUrl.trim() || streamingHomePath;
  const external = isExternalHref(href);

  const inner = (
    <picture className="block h-full w-full bg-zinc-900">
      {mobile ? <source media="(max-width: 639px)" srcSet={mobile} /> : null}
      <img
        src={desktop}
        alt=""
        className={clsx(
          'h-full w-full object-cover',
          'object-top-left sm:object-center',
          'transition-[transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
          featured
            ? 'brightness-100'
            : 'brightness-[0.72] sm:brightness-[0.78] group-hover:brightness-95 sm:group-hover:brightness-100',
        )}
        loading={eagerImage ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </picture>
  );

  const wrapCls = clsx(
    'group relative block h-full w-full overflow-hidden rounded-xl outline-none',
    'transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
    'focus-visible:ring-2 focus-visible:ring-(--brand-primary-hover)',
    featured
      ? 'z-10 -translate-y-1.5 scale-[1.05] border-2 border-(--brand-primary-hover) shadow-xl shadow-black/40 ring-2 ring-(--brand-primary) sm:-translate-y-2 sm:scale-[1.07] md:scale-[1.06]'
      : 'scale-[0.9] border border-zinc-700/90 shadow-md shadow-black/25 sm:scale-[0.94] md:scale-[0.96]',
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapCls}
        aria-label={label}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link to={normalizeInternalHref(href, streamingHomePath)} className={wrapCls} aria-label={label}>
      {inner}
    </Link>
  );
}

/** Largura relativa: no mobile só 3 slots visíveis (−1,0,1), o centro fica bem maior. */
function slotWrapperClass(offset: (typeof SLOT_OFFSETS)[number]): string {
  const outer = offset === -2 || offset === 2;
  const height = slotHeightClass(offset);
  if (outer) {
    return clsx(
      'hidden min-w-0 basis-0 sm:flex sm:flex-[0.72]',
      height,
    );
  }
  if (offset === 0) {
    return clsx('flex min-w-0 basis-0 flex-[1.95] sm:flex-[1.72]', height);
  }
  return clsx('flex min-w-0 basis-0 flex-[0.76] sm:flex-[1]', height);
}

function slotHeightClass(offset: (typeof SLOT_OFFSETS)[number]): string {
  if (offset === 0) {
    return 'h-[min(36vw,13.5rem)] sm:h-40 md:h-44 lg:h-[11.5rem]';
  }
  if (offset === -1 || offset === 1) {
    return 'h-[min(19vw,7rem)] sm:h-28 md:h-32 lg:h-36';
  }
  return 'h-[min(18vw,6.75rem)] sm:h-22 md:h-26';
}

function StreamingPromoBannersCarousel({
  banners,
  streamingHomePath,
}: {
  banners: StreamingBanner[];
  streamingHomePath: string;
}) {
  const n = banners.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    if (n < 2) return;
    setActiveIndex((i) => (i + 1) % n);
  }, [n]);

  useEffect(() => {
    if (n <= 1 || paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(tick, ROTATE_MS);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [n, paused, tick]);

  function goNext() {
    if (n < 2) return;
    setActiveIndex((i) => (i + 1) % n);
  }

  function goPrev() {
    if (n < 2) return;
    setActiveIndex((i) => (i - 1 + n) % n);
  }

  function goToDot(k: number) {
    if (n < 2) return;
    setActiveIndex(k);
  }

  function indexForOffset(offset: (typeof SLOT_OFFSETS)[number]): number {
    return ((activeIndex + offset) % n + n) % n;
  }

  if (n === 1) {
    const b = banners[0]!;
    return (
      <section
        aria-label="Destaques e novidades"
        className="scroll-mt-40 sm:scroll-mt-44"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="mx-auto max-w-2xl">
          <div className={clsx(slotHeightClass(0), 'overflow-hidden rounded-xl')}>
            <BannerTile banner={b} featured eagerImage streamingHomePath={streamingHomePath} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Destaques e novidades"
      className="relative scroll-mt-40 sm:scroll-mt-44"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex items-end justify-center gap-1.5 sm:gap-2 md:gap-3"
        role="region"
        aria-roledescription="carrossel"
        aria-label={`${n} destaques; o do meio está em evidência`}
      >
        {SLOT_OFFSETS.map((offset) => {
          const idx = indexForOffset(offset);
          const b = banners[idx]!;
          const featured = offset === 0;
          return (
            <div key={`slot-${offset}`} className={slotWrapperClass(offset)}>
              <BannerTile
                banner={b}
                featured={featured}
                eagerImage={featured}
                streamingHomePath={streamingHomePath}
              />
            </div>
          );
        })}
      </div>

      {n > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/90 text-zinc-100 shadow-lg backdrop-blur hover:border-(--brand-primary-hover) hover:bg-zinc-800/95 sm:left-0 sm:h-10 sm:w-10"
            aria-label="Destaque anterior"
          >
            <ChevronLeft size={20} strokeWidth={2} className="sm:h-[22px] sm:w-[22px]" />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/90 text-zinc-100 shadow-lg backdrop-blur hover:border-(--brand-primary-hover) hover:bg-zinc-800/95 sm:right-0 sm:h-10 sm:w-10"
            aria-label="Próximo destaque"
          >
            <ChevronRight size={20} strokeWidth={2} className="sm:h-[22px] sm:w-[22px]" />
          </button>
          <div
            className="mt-4 flex justify-center gap-1.5"
            role="tablist"
            aria-label="Indicadores do carrossel"
          >
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Ir para destaque ${i + 1}: ${b.title}`}
                onClick={() => goToDot(i)}
                className={clsx(
                  'h-2 rounded-full transition-all',
                  i === activeIndex ? 'w-6 bg-(--brand-primary)' : 'w-2 bg-zinc-600 hover:bg-zinc-500',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** `key` na faixa interna reinicia o índice do carrossel quando a lista de banners muda (sem setState em effect). */
export function StreamingPromoBanners({
  banners,
  streamingHomePath,
}: {
  banners: StreamingBanner[];
  /** Home de streaming deste tenant (obrigatório para links relativos nos banners). */
  streamingHomePath: string;
}) {
  if (banners.length === 0) return null;
  const bannerIdsKey = banners.map((b) => b.id).join('|');
  return (
    <StreamingPromoBannersCarousel
      key={bannerIdsKey}
      banners={banners}
      streamingHomePath={streamingHomePath}
    />
  );
}
