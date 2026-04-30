/* Blocos reutilizados em ChannelPublicPage — export nomeado fora do padrão Fast Refresh. */
/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAssistantCourse } from '@/components/layout/PublicLayout';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Play, X } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { clsx } from 'clsx';
import { VimeoPosterThumb } from '@/components/public/VimeoPosterThumb';
import { getCourse, listPublishedCatalogCourses, listModules } from '@/lib/firestore/courses';
import { buildVimeoPlayerEmbedSrc, withVimeoPlayerOptions } from '@/lib/vimeo';
import type { CourseIntroVideo, CourseSummary, ModuleContent } from '@/types';

export type CatalogEntry = {
  course: CourseSummary;
  modules: ModuleContent[];
};

export function courseIntroItems(course: CourseSummary): CourseIntroVideo[] {
  return course.introVimeoUrls?.length ? course.introVimeoUrls : [];
}

const scrollerHideScrollbar =
  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

/** Mesmo padrão do carrossel de trilhas em Streaming: scroll horizontal suave, sem barra visível, setas quando há mais conteúdo. */
export function FeaturedCoursesScroller({ scrollKey, children }: { scrollKey: string; children: ReactNode }) {
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
        className={`flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden scroll-smooth px-4 pb-3 pt-1 sm:px-0 ${scrollerHideScrollbar}`}
      >
        {children}
      </div>

      {canLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-12 items-center bg-linear-to-r from-zinc-950 via-zinc-950/80 to-transparent pl-1 sm:w-14">
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/90 hover:text-emerald-200"
            aria-label="Ver programas anteriores"
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
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-lg backdrop-blur transition-colors hover:border-emerald-500/50 hover:bg-zinc-800/90 hover:text-emerald-200"
            aria-label="Ver mais programas"
          >
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

type IntroSlide = {
  item: CourseIntroVideo;
  courseIndex: number;
  raw: string;
  src: string;
};

function introThumbCaption(item: CourseIntroVideo, courseIndex: number): string {
  const t = item.title?.trim();
  if (t) return t;
  return `Vídeo ${courseIndex + 1}`;
}

function introHeroHeading(
  item: CourseIntroVideo,
  courseIndex: number,
  totalInCourse: number,
): string {
  const t = item.title?.trim();
  if (t) return t;
  if (totalInCourse > 1) return `Vídeo ${courseIndex + 1} de ${totalInCourse}`;
  return 'Vídeo introdutório';
}

/** Mesmo padrão visual da trilha em destaque no Streaming: hero + lista lateral (desktop) ou carrossel (mobile). */
export function IntroVimeoCarousel({
  items,
  courseTitle,
  variant = 'program',
}: {
  items: CourseIntroVideo[];
  courseTitle: string;
  /** `channel`: textos para página de canal (não “programa”). */
  variant?: 'program' | 'channel';
}) {
  const slides: IntroSlide[] = items
    .map((item, courseIndex) => {
      const raw = item.url.trim();
      const src = buildVimeoPlayerEmbedSrc(raw);
      if (!src) return null;
      return { item, courseIndex, raw, src };
    })
    .filter((x): x is IntroSlide => x !== null);

  const [expanded, setExpanded] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [heroPlaying, setHeroPlaying] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const blockTitle = variant === 'channel' ? 'Vídeos do canal' : 'Vídeos introdutórios';
  const moreAsideLabel = variant === 'channel' ? 'Mais neste canal' : 'Mais neste programa';
  const footnote =
    variant === 'channel'
      ? `Conteúdo do canal «${courseTitle}».`
      : `Parte da introdução ao programa «${courseTitle}».`;

  if (slides.length === 0) {
    return (
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{blockTitle}</h3>
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200/90">
          Nenhuma URL de Vimeo válida. Confira os links no painel administrativo.
        </p>
      </section>
    );
  }

  const safeIdx = Math.min(activeIdx, slides.length - 1);
  const current = slides[safeIdx]!;
  const rest = slides.filter((_, i) => i !== safeIdx);
  const multi = items.length > 1;

  function selectSlide(i: number) {
    setActiveIdx(i);
    setHeroPlaying(false);
  }

  function thumbButton(slide: IntroSlide, slideIdx: number, layout: 'horizontal' | 'vertical', onPick: (idx: number) => void) {
    const compact = layout === 'horizontal';
    const caption = introThumbCaption(slide.item, slide.courseIndex);
    return (
      <button
        key={`${slide.src}-${slide.courseIndex}-${slide.item.coverImageUrl ?? ''}`}
        type="button"
        onClick={() => onPick(slideIdx)}
        className={clsx(
          'group shrink-0 border text-left transition-[transform,box-shadow,border-color] duration-300 ease-out',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/70',
          compact
            ? 'w-37 rounded-lg sm:w-40'
            : 'w-full rounded-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30',
          slideIdx === safeIdx
            ? 'border-emerald-500/60 ring-2 ring-emerald-500/25'
            : 'border-zinc-800 hover:border-zinc-600',
        )}
      >
        <VimeoPosterThumb
          vimeoUrl={slide.raw}
          posterUrl={slide.item.coverImageUrl}
          className={compact ? 'rounded-t-lg' : 'rounded-t-xl'}
        />
        <div
          className={clsx(
            'rounded-b-xl bg-zinc-950/80',
            compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
          )}
        >
          <p
            className={clsx(
              'font-medium text-zinc-200',
              compact ? 'line-clamp-2 text-[11px] leading-snug sm:text-xs' : 'line-clamp-2 text-sm',
            )}
          >
            {caption}
          </p>
        </div>
      </button>
    );
  }

  const heroTitle = introHeroHeading(current.item, current.courseIndex, items.length);
  const heroTitlePlain = current.item.title?.trim();

  /** Faixa horizontal de capas (equivalente à trilha sem foco no Streaming). */
  if (!expanded && multi) {
    return (
      <section aria-label={blockTitle}>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{blockTitle}</h3>
        <div className="relative -mx-4 mt-3 sm:mx-0">
          <div
            className={`flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth px-4 pb-1 sm:px-0 ${scrollerHideScrollbar}`}
          >
            {slides.map((s, i) =>
              thumbButton(s, i, 'horizontal', (idx) => {
                selectSlide(idx);
                setExpanded(true);
              }),
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={blockTitle}
      className="rounded-2xl border border-zinc-800/80 bg-zinc-900/55 p-3 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/15 sm:p-5 lg:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3 pt-0.5 sm:pt-1">
        <h3 className="text-lg font-semibold text-zinc-100 sm:text-xl">{blockTitle}</h3>
        {multi ? (
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setHeroPlaying(false);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-600/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-100"
            aria-label="Fechar visualização em destaque"
          >
            <X size={16} strokeWidth={2} />
            Fechar
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-h-0 min-w-0 flex-1 space-y-3 sm:space-y-4 max-lg:rounded-2xl max-lg:bg-zinc-950/35 max-lg:p-1 max-lg:shadow-[0_0_40px_-12px_rgba(16,185,129,0.22)] max-lg:ring-1 max-lg:ring-emerald-500/20">
          <div className="mx-auto w-full max-w-5xl lg:mx-0">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl shadow-black/50 ring-1 ring-white/5">
              <div className="relative aspect-video w-full">
                {heroPlaying ? (
                  <iframe
                    key={`play-${current.src}-${safeIdx}`}
                    title={`${heroTitle} — ${courseTitle}`}
                    src={withVimeoPlayerOptions(current.src, {})}
                    className="absolute inset-0 h-full w-full rounded-xl"
                    allow="autoplay; fullscreen; picture-in-picture"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setHeroPlaying(true)}
                    className="group absolute inset-0 z-0 overflow-hidden rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/70"
                    aria-label={`Reproduzir: ${heroTitle} — ${courseTitle}`}
                  >
                    <VimeoPosterThumb
                      fillContainer
                      vimeoUrl={current.raw}
                      posterUrl={current.item.coverImageUrl}
                      className="rounded-xl"
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mx-auto w-full max-w-5xl px-0 sm:px-1 lg:mx-0">
            <h4 className="text-base font-semibold text-zinc-100 sm:text-lg lg:text-xl">{heroTitle}</h4>
            {multi && heroTitlePlain ? (
              <p className="mt-1 text-sm text-zinc-500">
                {current.courseIndex + 1} de {items.length}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{footnote}</p>
          </div>
        </div>

        {multi && rest.length > 0 ? (
          <aside
            className="min-h-0 w-full shrink-0 lg:sticky lg:top-32 lg:w-72 lg:border-l lg:border-zinc-800 lg:pl-6"
            aria-label={moreAsideLabel}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 lg:mb-3">
              {moreAsideLabel}
            </p>
            <div className="lg:hidden">
              <div
                className={`flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-1 ${scrollerHideScrollbar}`}
              >
                {rest.map((s) => {
                  const i = slides.indexOf(s);
                  return thumbButton(s, i, 'horizontal', selectSlide);
                })}
              </div>
            </div>
            <div
              className={`hidden max-h-[min(calc(100dvh-11rem),40rem)] flex-col gap-3 overflow-y-auto overflow-x-hidden py-0.5 pr-0.5 lg:flex ${scrollerHideScrollbar}`}
            >
              {rest.map((s) => {
                const i = slides.indexOf(s);
                return thumbButton(s, i, 'vertical', selectSlide);
              })}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function CourseCatalogDetail({ entry }: { entry: CatalogEntry }) {
  const { course, modules } = entry;
  const introItems = courseIntroItems(course);
  const introStableKey = introItems.map((i) => `${i.url}\n${i.title ?? ''}`).join('\n---\n');

  return (
    <article
      id="catalogo-detalhe-curso"
      className="mt-10 scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/35 shadow-xl shadow-black/25"
    >
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <BookOpen size={22} />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-zinc-100 sm:text-2xl">{course.title}</h2>
            {course.description ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{course.description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-5 py-8 sm:px-8">
        <IntroVimeoCarousel
          key={`${course.id}-${introStableKey}`}
          items={introItems}
          courseTitle={course.title}
        />

        {course.about ? (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Sobre o curso</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{course.about}</p>
          </section>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Cronograma</h3>
          <p className="mt-2 text-xs text-zinc-500">
            Módulos e passos do programa
          </p>
          {modules.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Cronograma em definição.</p>
          ) : (
            <ol className="mt-6 space-y-6 border-l border-zinc-700 pl-6">
              {modules.map((mod, mi) => (
                <li key={mod.id} className="relative">
                  <span className="absolute -left-[calc(1.5rem+5px)] top-1.5 flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-zinc-950" />
                  <p className="font-medium text-zinc-200">
                    <span className="mr-2 text-zinc-500">{mi + 1}.</span>
                    {mod.title || `Módulo ${mi + 1}`}
                  </p>
                  {mod.steps?.length ? (
                    <ul className="mt-3 space-y-1.5 border-l border-zinc-800 pl-4">
                      {mod.steps.map((s) => (
                        <li key={s.id} className="text-sm text-zinc-400">
                          {s.title || 'Passo'}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="border-t border-zinc-800 pt-6">
          <Link
            to="/login"
            className="inline-flex text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            Entrar para estudar →
          </Link>
        </div>
      </div>
    </article>
  );
}

type CourseCardProps = {
  entry: CatalogEntry;
  selected: boolean;
  onDiscover: () => void;
};

export function CourseCarouselCard({ entry, selected, onDiscover }: CourseCardProps) {
  const { course } = entry;
  const introItems = courseIntroItems(course);
  const firstRaw = introItems[0]?.url;
  const embedSrc = firstRaw ? buildVimeoPlayerEmbedSrc(firstRaw) : null;
  const coverUrl = course.catalogCardImageUrl?.trim();
  const [coverFailed, setCoverFailed] = useState(false);

  const showCustomCover = Boolean(coverUrl && !coverFailed);

  return (
    <button
      type="button"
      onClick={onDiscover}
      className={clsx(
        'group w-[min(100vw-3rem,280px)] shrink-0 snap-center sm:w-[280px] rounded-xl border text-left transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/70',
        selected
          ? 'border-emerald-500/60 ring-2 ring-emerald-500/25'
          : 'border-zinc-800 hover:border-zinc-600'
      )}
    >
      {showCustomCover ? (
        <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-zinc-900">
          <img
            src={coverUrl}
            alt={`Capa: ${course.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setCoverFailed(true)}
          />
        </div>
      ) : embedSrc && firstRaw ? (
        <VimeoPosterThumb vimeoUrl={firstRaw} className="rounded-t-xl" />
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-t-xl bg-zinc-900 px-4 text-center">
          <Play className="text-zinc-600" size={32} strokeWidth={1.25} />
          <p className="text-xs text-zinc-500">Vídeo introdutório em breve</p>
        </div>
      )}
      <div className="rounded-b-xl bg-zinc-950/80 px-3 py-2.5">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-200">{course.title}</h3>
        {course.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{course.description}</p>
        ) : null}
      </div>
    </button>
  );
}

export function PublicHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAssistantCourse } = useAssistantCourse();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  /** Curso com `channelId` acedido por `?program=` — redireciona para `/canal/…`. */
  const [catalogProgramChannelId, setCatalogProgramChannelId] = useState<string | null>(null);
  const detailAnchorRef = useRef<HTMLDivElement>(null);
  const lastScrolledProgram = useRef<string | null>(null);

  useEffect(() => {
    setAssistantCourse(null);
  }, [setAssistantCourse]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const courses = await listPublishedCatalogCourses();
        const programasOnly = courses.filter((c) => !c.channelId?.trim());
        const withMods = await Promise.all(
          programasOnly.map(async (c) => ({ course: c, modules: await listModules(c.id) })),
        );
        if (!cancelled) setEntries(withMods);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[PublicHomePage] catálogo', e);
        }
        if (!cancelled) {
          const code = e instanceof FirebaseError ? e.code : '';
          const hint =
            code === 'permission-denied'
              ? ' Permissão negada: confira as regras do Firestore e, se usar App Check com enforcement, token de debug em desenvolvimento.'
              : code
                ? ` (${code})`
                : '';
          setErr(`Não foi possível carregar o catálogo de cursos.${hint}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const programParam = searchParams.get('program')?.trim() || null;
  const validSelectedId =
    programParam && entries.some((e) => e.course.id === programParam) ? programParam : null;

  useEffect(() => {
    if (!programParam) {
      setCatalogProgramChannelId(null);
      return;
    }
    if (validSelectedId) {
      setCatalogProgramChannelId(null);
      return;
    }
    let cancelled = false;
    void getCourse(programParam).then((course) => {
      if (cancelled || !course?.catalogPublished) return;
      const cid = course.channelId?.trim();
      setCatalogProgramChannelId(cid || null);
    });
    return () => {
      cancelled = true;
    };
  }, [programParam, validSelectedId]);

  const handleDiscover = useCallback(
    (courseId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('program', courseId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!validSelectedId) {
      lastScrolledProgram.current = null;
      return;
    }
    if (lastScrolledProgram.current === validSelectedId) return;
    lastScrolledProgram.current = validSelectedId;
    requestAnimationFrame(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [validSelectedId]);

  const selectedEntry = validSelectedId
    ? entries.find((e) => e.course.id === validSelectedId) ?? null
    : null;

  const redirectToChannelId = selectedEntry?.course.channelId?.trim();
  if (redirectToChannelId) {
    return <Navigate to={`/canal/${redirectToChannelId}`} replace />;
  }

  const deepLinkChannelId = catalogProgramChannelId?.trim();
  if (deepLinkChannelId) {
    return <Navigate to={`/canal/${deepLinkChannelId}`} replace />;
  }

  if (loading) {
    return <p className="text-center text-zinc-500">Carregando cursos…</p>;
  }

  if (err) {
    return <p className="text-center text-red-400">{err}</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-12 text-center">
        <GraduationCap className="mx-auto text-zinc-600" size={44} />
        <p className="mt-4 text-zinc-400">Nenhum curso publicado no catálogo no momento.</p>
        <p className="mt-2 text-sm text-zinc-500">
          <Link to="/login" className="text-emerald-400 hover:underline">
            Entrar na plataforma
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* <section className="mb-8 text-center"> */}
        {/* <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">Plataforma de Programas</h1> */}
      {/* </section> */}

      <section aria-label="Programas em destaque">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Em destaque</p>
        <FeaturedCoursesScroller scrollKey={entries.map((e) => e.course.id).join(',')}>
          {entries.map((entry) => (
            <CourseCarouselCard
              key={`${entry.course.id}:${entry.course.catalogCardImageUrl?.trim() ?? ''}`}
              entry={entry}
              selected={validSelectedId === entry.course.id}
              onDiscover={() => handleDiscover(entry.course.id)}
            />
          ))}
        </FeaturedCoursesScroller>
      </section>

      <div ref={detailAnchorRef} className="min-h-0">
        {selectedEntry ? (
          <CourseCatalogDetail entry={selectedEntry} />
        ) : (
          <p className="mt-10 text-center text-sm text-zinc-500">
            Toque num dos cursos acima para ver a prévia completa.
          </p>
        )}
      </div>
    </div>
  );
}
