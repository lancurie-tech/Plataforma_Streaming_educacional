import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Radio } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { useAssistantCourse } from '@/components/layout/PublicLayout';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';
import {
  CourseCatalogDetail,
  CourseCarouselCard,
  FeaturedCoursesScroller,
  IntroVimeoCarousel,
  type CatalogEntry,
} from '@/pages/PublicHomePage';
import { getPublishedChannelById } from '@/lib/firestore/channels';
import { getCourse, listModules, listPublishedCoursesForChannel } from '@/lib/firestore/courses';
import type { CatalogChannel, CourseIntroVideo, CourseSummary } from '@/types';

/** Mensagens específicas: canal vs lista de cursos vs erro de extensão do browser (fora do app). */
function describeChannelPageError(e: unknown, phase: 'channel' | 'courses' | 'legacy'): string {
  const fe = e instanceof FirebaseError ? e : null;
  const code = fe?.code ?? '';
  const msg = fe?.message ?? '';

  if (code === 'failed-precondition' || msg.toLowerCase().includes('index')) {
    return 'Confira no Firebase Console → Firestore → Índices o composto em `courses` para `catalogPublished` + `channelId`, ou faça deploy de `firestore.indexes.json`.';
  }
  if (code === 'permission-denied') {
    if (phase === 'channel') {
      return 'No Admin (Canais / Streaming), confirme que este canal está **Publicado** e que o ID na URL corresponde ao canal.';
    }
    if (phase === 'courses') {
      return 'Verifique regras do Firestore para `courses` e se os cursos do canal têm `catalogPublished: true` e `channelId` correto.';
    }
    return 'Permissão negada ao carregar o curso de programa vinculado.';
  }
  if (code) return `${code}${msg ? `: ${msg}` : ''}`;
  return e instanceof Error ? e.message : 'Erro desconhecido.';
}

function channelVideosToIntroItems(channel: CatalogChannel): CourseIntroVideo[] {
  const vids = channel.pageVideos ?? [];
  return vids
    .filter((v) => v.vimeoUrl.trim() && v.title.trim())
    .map((v) => ({
      url: v.vimeoUrl.trim(),
      title: v.title.trim(),
      ...(v.coverImageUrl?.trim() ? { coverImageUrl: v.coverImageUrl.trim() } : {}),
    }));
}

export function ChannelPublicPage() {
  const paths = useTenantPublicPaths();
  const { channelId } = useParams<{ channelId: string }>();
  const id = channelId?.trim() ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const { setAssistantCourse } = useAssistantCourse();
  const [channel, setChannel] = useState<CatalogChannel | null | undefined>(undefined);
  const [linkedEntries, setLinkedEntries] = useState<CatalogEntry[]>([]);
  const [legacyEntry, setLegacyEntry] = useState<CatalogEntry | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const detailAnchorRef = useRef<HTMLDivElement>(null);
  const lastScrolledCourse = useRef<string | null>(null);

  useEffect(() => {
    setAssistantCourse(null);
  }, [setAssistantCourse]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setErr(null);
      setChannel(undefined);

      let ch: CatalogChannel | null = null;
      try {
        ch = await getPublishedChannelById(id);
      } catch (e) {
        if (cancelled) return;
        setErr(`Não foi possível carregar o canal. ${describeChannelPageError(e, 'channel')}`);
        setChannel(null);
        setLinkedEntries([]);
        setLegacyEntry(null);
        return;
      }

      if (cancelled) return;
      if (!ch) {
        setChannel(null);
        setLinkedEntries([]);
        setLegacyEntry(null);
        return;
      }
      setChannel(ch);

      try {
        const linked = await listPublishedCoursesForChannel(ch.id);
        const entries: CatalogEntry[] = await Promise.all(
          linked.map(async (c) => ({ course: c, modules: await listModules(c.id) })),
        );
        if (cancelled) return;
        setLinkedEntries(entries);

        if (entries.length === 0 && ch.programCourseId?.trim()) {
          try {
            const course: CourseSummary | null = await getCourse(ch.programCourseId.trim());
            if (cancelled || !course || !course.catalogPublished) {
              setLegacyEntry(null);
            } else {
              const modules = await listModules(course.id);
              if (!cancelled) setLegacyEntry({ course, modules });
            }
          } catch (e) {
            if (cancelled) return;
            /**
             * `getCourse` pode disparar `permission-denied` para visitante/aluno se o curso em
             * `programCourseId` existir mas **não** estiver no catálogo (`catalogPublished: false`).
             * Regras permitem leitura total a admin — por isso só falhava fora do admin.
             * Neste caso o canal ainda é válido; só não há “programa” visível ao público.
             */
            if (e instanceof FirebaseError && e.code === 'permission-denied') {
              setLegacyEntry(null);
            } else {
              setErr(
                `Não foi possível carregar o curso de programa deste canal. ${describeChannelPageError(e, 'legacy')}`,
              );
              setLegacyEntry(null);
            }
          }
        } else {
          setLegacyEntry(null);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(`Não foi possível carregar os cursos deste canal. ${describeChannelPageError(e, 'courses')}`);
        setLinkedEntries([]);
        setLegacyEntry(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const allCourseEntries = [...linkedEntries, ...(legacyEntry ? [legacyEntry] : [])];
  const cursoParam = searchParams.get('curso')?.trim() || null;
  const validSelectedCourseId =
    cursoParam && allCourseEntries.some((e) => e.course.id === cursoParam) ? cursoParam : null;

  const handleSelectCourse = useCallback(
    (courseId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('curso', courseId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (!validSelectedCourseId) {
      lastScrolledCourse.current = null;
      return;
    }
    if (lastScrolledCourse.current === validSelectedCourseId) return;
    lastScrolledCourse.current = validSelectedCourseId;
    requestAnimationFrame(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [validSelectedCourseId]);

  const selectedEntry = validSelectedCourseId
    ? allCourseEntries.find((e) => e.course.id === validSelectedCourseId) ?? null
    : null;

  if (!id) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
        <p className="text-zinc-300">Endereço de canal inválido.</p>
        <Link
          to={paths.streaming}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:underline"
        >
          Voltar ao Streaming
        </Link>
      </div>
    );
  }

  if (channel === undefined && !err) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        Carregando…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {err}
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
        <p className="text-zinc-300">Canal não encontrado ou não publicado.</p>
        <Link
          to={paths.streaming}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:underline"
        >
          <ArrowLeft size={16} />
          Voltar ao Streaming
        </Link>
      </div>
    );
  }

  const introFromChannel = channelVideosToIntroItems(channel);
  const hasVideos = introFromChannel.length > 0;

  return (
    <div className="space-y-14 pb-10">
      <div className="flex justify-center sm:justify-start">
        <Link
          to={paths.streaming}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-emerald-300"
        >
          <ArrowLeft size={16} />
          Streaming
        </Link>
      </div>

      <header className="flex flex-col items-center px-2 text-center">
        <div
          className="relative rounded-full p-1 ring-2 ring-emerald-500/35 ring-offset-4 ring-offset-zinc-950"
          aria-hidden
        >
          {channel.coverImageUrl ? (
            <div className="h-36 w-36 overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900 shadow-[0_0_48px_-8px_rgba(16,185,129,0.35)] sm:h-44 sm:w-44 md:h-52 md:w-52">
              <img
                src={channel.coverImageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900 shadow-[0_0_48px_-8px_rgba(16,185,129,0.25)] sm:h-44 sm:w-44 md:h-52 md:w-52">
              <Radio className="text-emerald-400/90" size={56} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Canal</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl md:text-[2.75rem] md:leading-tight">
          {channel.title}
        </h1>
        {channel.pageDescription ? (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            {channel.pageDescription}
          </p>
        ) : null}
      </header>

      {hasVideos ? (
        <section
          aria-label="Conteúdo do canal"
          className="rounded-2xl border border-zinc-800/90 bg-linear-to-b from-zinc-900/50 to-zinc-950/30 p-4 shadow-xl shadow-black/20 sm:p-6"
        >
          <div className="mb-5 border-b border-zinc-800/80 pb-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Conteúdo do canal</h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Vídeos e episódios disponíveis neste canal (acesso livre à pré-visualização).
            </p>
          </div>
          <IntroVimeoCarousel
            key={`${channel.id}-${introFromChannel.map((i) => `${i.url}:${i.coverImageUrl ?? ''}`).join('|')}`}
            variant="channel"
            items={introFromChannel}
            courseTitle={channel.title}
          />
        </section>
      ) : null}

      {allCourseEntries.length > 0 ? (
        <section
          aria-label="Programas do canal"
          className="rounded-2xl border border-zinc-800/90 bg-zinc-950/25 p-4 sm:p-6"
        >
          <div className="mb-5 border-b border-zinc-800/80 pb-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Programas do canal</h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Escolha um programa para ver a prévia completa (como em Programas).
            </p>
          </div>

          <FeaturedCoursesScroller scrollKey={allCourseEntries.map((e) => e.course.id).join(',')}>
            {allCourseEntries.map((entry) => (
              <CourseCarouselCard
                key={`${entry.course.id}:${entry.course.catalogCardImageUrl?.trim() ?? ''}`}
                entry={entry}
                selected={validSelectedCourseId === entry.course.id}
                onDiscover={() => handleSelectCourse(entry.course.id)}
              />
            ))}
          </FeaturedCoursesScroller>

          <div ref={detailAnchorRef} className="min-h-0 scroll-mt-28">
            {selectedEntry ? (
              <CourseCatalogDetail entry={selectedEntry} />
            ) : (
              <p className="mt-10 text-center text-sm text-zinc-500">
                Toque num dos programas acima para ver a prévia completa.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {!hasVideos && allCourseEntries.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/35 px-6 py-10 text-center text-sm text-zinc-500">
          Conteúdo deste canal em preparação.
        </p>
      ) : null}
    </div>
  );
}
