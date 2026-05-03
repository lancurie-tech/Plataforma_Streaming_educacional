import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Player from '@vimeo/player';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { clsx } from 'clsx';
import { FirebaseError } from 'firebase/app';
import { listPublishedChannels } from '@/lib/firestore/channels';
import { listPublishedStreamingBanners } from '@/lib/firestore/streamingBanners';
import { listStreamingTracksWithEntries } from '@/lib/firestore/streamingHome';
import { StreamingPromoBanners } from '@/components/public/StreamingPromoBanners';
import { VimeoPosterThumb } from '@/components/public/VimeoPosterThumb';
import { attachVimeoOrientationFullscreen } from '@/lib/vimeoOrientationFullscreen';
import { buildVimeoPlayerEmbedSrc, withVimeoPlayerOptions } from '@/lib/vimeo';
import type { CatalogChannel, StreamingBanner, StreamingEntry, StreamingTrack } from '@/types';
import { logStreamingViewCallable } from '@/lib/firebase/callables';
import { useAssistantCourse, useStreamingAssistantFocus } from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/useAuth';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';
import { useAnalyticsConsent } from '@/contexts/AnalyticsConsentContext';

type Row = { track: StreamingTrack; entries: StreamingEntry[] };

type FocusState = { trackId: string; entryId: string };

function StreamingChannelsStrip({
  channels,
  canalHref,
}: {
  channels: CatalogChannel[];
  canalHref: (channelId: string) => string;
}) {
  if (channels.length === 0) return null;
  return (
    <section aria-label="Canais" className="scroll-mt-40 sm:scroll-mt-44">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
        Canais
      </p>
      <div className="flex flex-wrap justify-center gap-8 sm:gap-10">
        {channels.map((ch) => (
          <Link
            key={ch.id}
            to={canalHref(ch.id)}
            className="group flex max-w-26 flex-col items-center gap-2.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-primary-hover) sm:max-w-30"
          >
            <span className="relative flex h-22 w-22 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900 shadow-md transition-[border-color,box-shadow,transform] group-hover:border-(--brand-primary-hover) group-hover:shadow-black/25 group-hover:-translate-y-0.5 sm:h-24 sm:w-24">
              {ch.coverImageUrl ? (
                <img
                  src={ch.coverImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-xl font-semibold text-zinc-500">{ch.title.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            <span className="line-clamp-2 text-sm font-medium leading-tight text-zinc-200 group-hover:text-(--brand-primary-hover)">
              {ch.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function validEntries(entries: StreamingEntry[]): StreamingEntry[] {
  return entries.filter((e) => buildVimeoPlayerEmbedSrc(e.vimeoUrl) !== null);
}

const scrollerHideScrollbar =
  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

function VimeoHeroPlayer({
  embedSrc,
  title,
  autoplay,
  onEnded,
}: {
  embedSrc: string;
  title: string;
  autoplay: boolean;
  onEnded: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onEndedRef = useRef(onEnded);
  const src = withVimeoPlayerOptions(embedSrc, { autoplay });

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;
    const handleEnded = () => {
      if (!cancelled) onEndedRef.current();
    };

    let player: Player | null = null;
    const detachOrientationRef: { current: (() => void) | null } = { current: null };
    try {
      player = new Player(iframe);
    } catch {
      return;
    }

    void (async () => {
      try {
        await player!.ready();
        if (cancelled) {
          void player!.unload().catch(() => {});
          return;
        }
        player!.on('ended', handleEnded);
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
          detachOrientationRef.current = attachVimeoOrientationFullscreen(player!, {
            maxViewportWidth: 1024,
          });
        }
      } catch {
        /* embed restrito ou API indisponível — o iframe continua reproduzível manualmente */
      }
    })();

    return () => {
      cancelled = true;
      detachOrientationRef.current?.();
      detachOrientationRef.current = null;
      if (!player) return;
      try {
        player.off('ended', handleEnded);
      } catch {
        /* ignore */
      }
      /* destroy() remove o iframe do DOM e quebra o React — usar unload() */
      void player.unload().catch(() => {});
    };
  }, [src]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      className="absolute inset-0 h-full w-full rounded-xl"
      allow="autoplay; fullscreen; picture-in-picture"
    />
  );
}

function TrackMediaScroller({
  scrollKey,
  children,
}: {
  scrollKey: string;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const eps = 6;
    setCanLeft(scrollLeft > eps);
    setCanRight(scrollLeft < maxScroll - eps);
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
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
    const step = Math.max(240, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: step * dir, behavior: 'smooth' });
  }

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={scrollerRef}
        className={`flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth px-4 pb-1 sm:px-0 ${scrollerHideScrollbar}`}
      >
        {children}
      </div>

      {canLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center bg-linear-to-r from-zinc-950 via-zinc-950/80 to-transparent pl-1 sm:w-14">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-(--brand-primary-hover) hover:bg-zinc-800/90 hover:text-(--brand-primary-hover)"
            aria-label="Ver conteúdos anteriores"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {canRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-12 items-center justify-end bg-linear-to-l from-zinc-950 via-zinc-950/80 to-transparent pr-1 sm:w-14">
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-(--brand-primary-hover) hover:bg-zinc-800/90 hover:text-(--brand-primary-hover)"
            aria-label="Ver mais conteúdos"
          >
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Lista vertical (desktop) com scrollbar oculta + setas, alinhado ao estilo das trilhas horizontais. */
function TrackVerticalMediaScroller({ scrollKey, children }: { scrollKey: string; children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const eps = 6;
    setCanUp(scrollTop > eps);
    setCanDown(scrollTop < maxScroll - eps);
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
    const step = Math.max(140, Math.round(el.clientHeight * 0.65));
    el.scrollBy({ top: step * dir, behavior: 'smooth' });
  }

  return (
    <div className="relative min-h-0 w-full">
      <div
        ref={scrollerRef}
        className={`flex max-h-[min(calc(100dvh-11rem),40rem)] min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden py-0.5 pr-0.5 ${scrollerHideScrollbar}`}
      >
        {children}
      </div>

      {canUp ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-start justify-center bg-linear-to-b from-zinc-950 via-zinc-950/85 to-transparent pt-0.5">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/90 hover:text-emerald-200"
            aria-label="Ver vídeos anteriores desta trilha"
          >
            <ChevronUp size={20} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {canDown ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-12 items-end justify-center bg-linear-to-t from-zinc-950 via-zinc-950/85 to-transparent pb-0.5">
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/90 hover:text-emerald-200"
            aria-label="Ver mais vídeos desta trilha"
          >
            <ChevronDown size={20} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StreamThumbnailCard({
  entry,
  selected,
  onOpen,
  fullWidth = false,
  compact = false,
}: {
  entry: StreamingEntry;
  selected?: boolean;
  onOpen: () => void;
  /** Lista vertical ao lado do hero (desktop). */
  fullWidth?: boolean;
  /** Carrossel mobile: cartão mais estreito para destacar o vídeo principal. */
  compact?: boolean;
}) {
  const widthShape = compact
    ? 'w-[9.25rem] shrink-0 rounded-lg sm:w-40'
    : fullWidth
      ? 'w-full rounded-xl'
      : 'w-[min(100vw-3rem,280px)] shrink-0 rounded-xl sm:w-[280px]';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        'group border text-left transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-primary-hover)',
        !compact && 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30',
        compact && 'hover:border-zinc-600',
        widthShape,
        selected
          ? 'border-(--brand-primary-hover) ring-2 ring-(--brand-primary)'
          : 'border-zinc-800 hover:border-zinc-600'
      )}
    >
      <VimeoPosterThumb
        key={`${entry.id}:${entry.vimeoUrl}:${entry.coverImageUrl ?? ''}`}
        vimeoUrl={entry.vimeoUrl}
        posterUrl={entry.coverImageUrl}
        className={compact ? 'rounded-t-lg' : 'rounded-t-xl'}
      />
      <div
        className={clsx(
          'rounded-b-xl bg-zinc-950/80',
          compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        )}
      >
        <h3
          className={clsx(
            'font-medium text-zinc-200',
            compact ? 'line-clamp-2 text-[11px] leading-snug sm:text-xs' : 'line-clamp-2 text-sm',
          )}
        >
          {entry.title}
        </h3>
        {entry.description && !compact ? (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{entry.description}</p>
        ) : null}
        {entry.description && compact ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-zinc-600">{entry.description}</p>
        ) : null}
      </div>
    </button>
  );
}

export function StreamingHomePage() {
  const [searchParams] = useSearchParams();
  const paths = useTenantPublicPaths();
  const { user } = useAuth();
  const { analyticsAllowed } = useAnalyticsConsent();
  const { setStreamingFocus } = useStreamingAssistantFocus();
  const { setAssistantCourse } = useAssistantCourse();

  useEffect(() => {
    setAssistantCourse(null);
  }, [setAssistantCourse]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [channels, setChannels] = useState<CatalogChannel[]>([]);
  const [promoBanners, setPromoBanners] = useState<StreamingBanner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [heroAutoplay, setHeroAutoplay] = useState(false);
  const deepLinkEntryApplied = useRef<string | null>(null);

  useEffect(() => {
    if (focus) {
      setStreamingFocus({ trackId: focus.trackId, entryId: focus.entryId });
    } else {
      setStreamingFocus(null);
    }
    return () => setStreamingFocus(null);
  }, [focus, setStreamingFocus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listStreamingTracksWithEntries();
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof FirebaseError
              ? e.message
              : e instanceof Error
                ? e.message
                : 'Não foi possível carregar o conteúdo.';
          setError(msg);
        }
      }
      try {
        const ch = await listPublishedChannels();
        if (!cancelled) setChannels(ch);
      } catch {
        /* canais opcionais */
      }
      try {
        const promos = await listPublishedStreamingBanners();
        if (!cancelled) setPromoBanners(promos);
      } catch {
        /* banners opcionais */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Abre vídeo a partir de `/streaming?entry=<id>` (ex.: link no assistente). */
  useEffect(() => {
    if (!rows?.length) return;
    const entryId = searchParams.get('entry')?.trim();
    if (!entryId) {
      deepLinkEntryApplied.current = null;
      return;
    }
    if (deepLinkEntryApplied.current === entryId) return;
    for (const { track, entries } of rows) {
      const hit = entries.find((e) => e.id === entryId);
      if (hit) {
        deepLinkEntryApplied.current = entryId;
        queueMicrotask(() => {
          setFocus({ trackId: track.id, entryId });
          setHeroAutoplay(false);
        });
        return;
      }
    }
  }, [rows, searchParams]);

  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`streaming-track-${focus.trackId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    // Só ao focar uma trilha; trocar o vídeo na mesma trilha não deve re-rolar a página.
  }, [focus?.trackId]); // eslint-disable-line react-hooks/exhaustive-deps -- trackId only

  useEffect(() => {
    if (!focus || !user || !analyticsAllowed) return;
    const key = `streamView:${focus.trackId}:${focus.entryId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* modo privado / storage indisponível */
    }
    void logStreamingViewCallable({
      trackId: focus.trackId,
      entryId: focus.entryId,
    }).catch(() => {});
  }, [focus, user, analyticsAllowed]);

  const handleVideoEnded = useCallback(
    (trackId: string, entries: StreamingEntry[], currentEntryId: string) => {
      const idx = entries.findIndex((e) => e.id === currentEntryId);
      if (idx < 0 || idx >= entries.length - 1) return;
      const next = entries[idx + 1];
      if (!next) return;
      setHeroAutoplay(true);
      setFocus({ trackId, entryId: next.id });
    },
    []
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        Carregando…
      </div>
    );
  }

  const visible = rows
    .map((r) => ({ ...r, entries: validEntries(r.entries) }))
    .filter((r) => r.entries.length > 0);

  const showTracks = visible.length > 0;

  const ordered = showTracks
    ? [...visible].sort((a, b) => {
        if (!focus) return 0;
        if (a.track.id === focus.trackId) return -1;
        if (b.track.id === focus.trackId) return 1;
        return 0;
      })
    : [];

  return (
    <div className="flex flex-col gap-10 sm:gap-12">
      {promoBanners.length > 0 ? (
        <StreamingPromoBanners banners={promoBanners} streamingHomePath={paths.streaming} />
      ) : null}
      <StreamingChannelsStrip channels={channels} canalHref={paths.canal} />

      {!showTracks ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-lg font-medium text-zinc-200">Trilhas em preparação</p>
          <p className="mt-2 text-sm text-zinc-500">
            Em breve haverá trilhas com vídeos e podcasts aqui. A administração pode configurar tudo em{' '}
            <span className="text-zinc-400">Admin → Home streaming</span>.
          </p>
        </div>
      ) : null}

      {ordered.map(({ track, entries }) => {
        const isFocusedTrack = focus?.trackId === track.id;
        const activeEntry =
          isFocusedTrack && focus ? entries.find((e) => e.id === focus.entryId) : null;
        const heroSrc = activeEntry ? buildVimeoPlayerEmbedSrc(activeEntry.vimeoUrl) : null;
        const rest = activeEntry ? entries.filter((e) => e.id !== activeEntry.id) : entries;

        return (
          <section
            key={track.id}
            id={`streaming-track-${track.id}`}
            className={clsx(
              /* scroll-mt alinhado ao header público (logo + subnav) para não “cortar” o título ao focar a trilha */
              'scroll-mt-40 rounded-2xl transition-[background-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:scroll-mt-44',
              isFocusedTrack &&
                'bg-zinc-900/55 p-3 shadow-[0_0_0_1px_color-mix(in_srgb,var(--brand-primary)_25%,transparent)] ring-1 ring-(--brand-primary) sm:p-5 lg:p-6'
            )}
          >
            <div
              className={clsx(
                'mb-4 flex items-start justify-between gap-3',
                isFocusedTrack && 'pt-0.5 sm:pt-1',
              )}
            >
              <h2
                id={`track-${track.id}`}
                className="text-lg font-semibold text-zinc-100 sm:text-xl"
              >
                {track.title}
              </h2>
              {isFocusedTrack ? (
                <button
                  type="button"
                  onClick={() => {
                    setFocus(null);
                    setHeroAutoplay(false);
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-600/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-100"
                  aria-label="Fechar visualização em destaque"
                >
                  <X size={16} strokeWidth={2} />
                  Fechar
                </button>
              ) : null}
            </div>

            {isFocusedTrack && activeEntry && heroSrc ? (
              <div className="flex min-h-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                <div
                  key={activeEntry.id}
                  className="stream-hero-animate min-h-0 min-w-0 flex-1 space-y-3 sm:space-y-4 lg:max-w-none max-lg:rounded-2xl max-lg:bg-zinc-950/35 max-lg:p-1 max-lg:shadow-[0_0_40px_-12px_color-mix(in_srgb,var(--brand-primary)_30%,transparent)] max-lg:ring-1 max-lg:ring-(--brand-primary)"
                >
                  <div className="mx-auto w-full max-w-5xl lg:mx-0">
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl shadow-black/50 ring-1 ring-white/5">
                      <div className="relative aspect-video w-full">
                        <VimeoHeroPlayer
                          embedSrc={heroSrc}
                          title={activeEntry.title}
                          autoplay={heroAutoplay}
                          onEnded={() => handleVideoEnded(track.id, entries, activeEntry.id)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto w-full max-w-5xl px-0 sm:px-1 lg:mx-0">
                    <h3 className="text-base font-semibold text-zinc-100 sm:text-lg lg:text-xl">
                      {activeEntry.title}
                    </h3>
                    {activeEntry.description ? (
                      <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-400 sm:line-clamp-5 lg:line-clamp-none">
                        {activeEntry.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {rest.length > 0 ? (
                  <aside
                    key={`${activeEntry.id}-strip`}
                    className="stream-strip-animate min-h-0 w-full shrink-0 lg:sticky lg:top-32 lg:w-72 lg:border-l lg:border-zinc-800 lg:pl-6"
                    aria-label="Outros vídeos desta trilha"
                  >
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 lg:mb-3">
                      Mais nesta trilha
                    </p>
                    <div className="lg:hidden">
                      <TrackMediaScroller scrollKey={`strip-m:${track.id}:${activeEntry.id}`}>
                        {rest.map((entry) => (
                          <StreamThumbnailCard
                            key={entry.id}
                            entry={entry}
                            compact
                            onOpen={() => {
                              setHeroAutoplay(false);
                              setFocus({ trackId: track.id, entryId: entry.id });
                            }}
                          />
                        ))}
                      </TrackMediaScroller>
                    </div>
                    <div className="hidden lg:block">
                      <TrackVerticalMediaScroller scrollKey={`strip-d:${track.id}:${activeEntry.id}`}>
                        {rest.map((entry) => (
                          <StreamThumbnailCard
                            key={entry.id}
                            entry={entry}
                            fullWidth
                            onOpen={() => {
                              setHeroAutoplay(false);
                              setFocus({ trackId: track.id, entryId: entry.id });
                            }}
                          />
                        ))}
                      </TrackVerticalMediaScroller>
                    </div>
                  </aside>
                ) : null}
              </div>
            ) : (
              <TrackMediaScroller scrollKey={`${track.id}:${entries.map((e) => e.id).join(',')}`}>
                {entries.map((entry) => (
                  <StreamThumbnailCard
                    key={entry.id}
                    entry={entry}
                    onOpen={() => {
                      setHeroAutoplay(false);
                      setFocus({ trackId: track.id, entryId: entry.id });
                    }}
                  />
                ))}
              </TrackMediaScroller>
            )}
          </section>
        );
      })}
    </div>
  );
}
