import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { streamingAssistantChatCallable, mapCallableError } from '@/lib/firebase/callables';
import { listStreamingTracksWithEntries } from '@/lib/firestore/streamingHome';
import {
  useAssistantChatPanelOptional,
  useAssistantCourse,
  useStreamingAssistantFocus,
} from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/useAuth';
import { useBrand } from '@/contexts/useBrand';
import { Button } from '@/components/ui/Button';
import {
  StreamingAssistantMessage,
  type EntryLabelInfo,
} from '@/components/public/StreamingAssistantMessage';
import { defaultResolvedBranding } from '@/lib/brand';

type Msg = { role: 'user' | 'model'; content: string };

const scrollerHideScrollbar =
  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

function streamingHomeIntro(displayName: string): Msg {
  return {
    role: 'model',
    content:
      `Olá! Posso ajudar a encontrar vídeos na página inicial da ${displayName}. Diga o tema que procura (por exemplo cardiologia, liderança, bem-estar) ou em que contexto vai usar o conteúdo.`,
  };
}

function introForCourse(courseTitle: string): Msg {
  return {
    role: 'model',
    content:
      `Está no curso **${courseTitle}**. Posso ajudar com conceitos, estudo e reflexões — **não** respondo a perguntas de testes, questionários ou avaliações deste curso.\n\nVocê tem até **15 perguntas por dia** neste curso. Em que posso ajudar?`,
  };
}

function buildEntryLabels(
  rows: Awaited<ReturnType<typeof listStreamingTracksWithEntries>>
): Record<string, EntryLabelInfo> {
  const map: Record<string, EntryLabelInfo> = {};
  for (const { track, entries } of rows) {
    for (const e of entries) {
      map[e.id] = { title: e.title, trackTitle: track.title };
    }
  }
  return map;
}

export function StreamingAssistantWidget() {
  const brand = useBrand();
  const { focus } = useStreamingAssistantFocus();
  const { courseAssist, courseVideoAssist } = useAssistantCourse();
  const assistantPanel = useAssistantChatPanelOptional();
  const { user, loading: authLoading } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = assistantPanel?.open ?? internalOpen;
  const setOpen = assistantPanel?.setOpen ?? setInternalOpen;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>(() => [
    streamingHomeIntro(defaultResolvedBranding().platformDisplayName),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryLabels, setEntryLabels] = useState<Record<string, EntryLabelInfo>>({});
  const endRef = useRef<HTMLDivElement>(null);

  const introMessage = useMemo(
    () =>
      courseAssist ? introForCourse(courseAssist.courseTitle) : streamingHomeIntro(brand.platformDisplayName),
    [courseAssist, brand.platformDisplayName],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listStreamingTracksWithEntries();
        if (!cancelled) setEntryLabels(buildEntryLabels(rows));
      } catch {
        if (!cancelled) setEntryLabels({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMessages([introMessage]);
    setError(null);
  }, [introMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const focusPayload = useMemo(
    () =>
      focus?.entryId && focus.trackId
        ? { focusEntryId: focus.entryId, focusTrackId: focus.trackId }
        : {},
    [focus]
  );

  const coursePayload = useMemo(
    () =>
      courseAssist?.courseId && courseAssist.courseTitle
        ? { courseId: courseAssist.courseId, courseTitle: courseAssist.courseTitle }
        : {},
    [courseAssist]
  );

  const courseVideoPayload = useMemo(() => {
    if (!courseAssist?.courseId || !courseVideoAssist?.vimeoUrl) return {};
    return {
      courseVideoFocus: {
        moduleId: courseVideoAssist.moduleId,
        stepId: courseVideoAssist.stepId,
        vimeoUrl: courseVideoAssist.vimeoUrl,
        title: courseVideoAssist.title,
        body: courseVideoAssist.body,
      },
    };
  }, [courseAssist?.courseId, courseVideoAssist]);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !user) return;
    setInput('');
    setError(null);
    const nextMsgs: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMsgs);
    setLoading(true);
    try {
      const { data } = await streamingAssistantChatCallable({
        messages: nextMsgs,
        ...focusPayload,
        ...coursePayload,
        ...courseVideoPayload,
      });
      const reply = data?.reply?.trim();
      if (!reply) {
        setError('Resposta vazia.');
        return;
      }
      setMessages([...nextMsgs, { role: 'model', content: reply }]);
    } catch (e) {
      setError(mapCallableError(e));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, user, focusPayload, coursePayload, courseVideoPayload]);

  const focusHint =
    focus && entryLabels[focus.entryId]
      ? `A ver: ${entryLabels[focus.entryId]!.title}`
      : focus
        ? 'Vídeo em destaque (contexto enviado)'
        : null;

  const chatTitle = courseAssist ? 'Mentor' : brand.streamingAssistantChatTitle;

  const subtitle = courseAssist
    ? courseVideoAssist
      ? 'Modo vídeo: transcrição quando disponível'
      : 'Ajuda no curso (sem respostas de teste)'
    : `Vídeos e cursos — ${brand.platformShortName}`;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-100 flex max-w-[100vw] flex-col items-end gap-2 p-0 sm:bottom-5 sm:right-5">
      {open ? (
        <div
          className="pointer-events-auto flex h-[min(360px,calc(100dvh-4.25rem))] w-[min(100vw-1.25rem,300px)] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/95 shadow-2xl shadow-black/50 backdrop-blur-md sm:h-[min(420px,calc(100dvh-5rem))] sm:w-[min(100vw-2rem,360px)]"
          role="dialog"
          aria-label={chatTitle}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
            <div>
              <p className="text-[13px] font-semibold text-zinc-100">{chatTitle}</p>
              <p className="text-[10px] text-zinc-500">{subtitle}</p>
              {focusHint ? (
                <p className="mt-0.5 line-clamp-2 text-[10px] text-emerald-400/90">{focusHint}</p>
              ) : null}
              {courseVideoAssist ? (
                <p className="mt-0.5 line-clamp-2 text-[10px] text-sky-400/90">
                  Foco: {courseVideoAssist.title}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {!authLoading && !user ? (
            <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-4 text-center">
              <p className="text-sm font-medium text-zinc-200">
                Quer usar a inteligência artificial?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Faça login ou cadastre-se para ter acesso à busca inteligente de vídeos e conteúdos.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Link
                  to="/login"
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                >
                  Entrar
                </Link>
                <Link
                  to="/registro"
                  className="rounded-lg border border-zinc-600 px-4 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-500/50 hover:text-emerald-200"
                >
                  Cadastre-se
                </Link>
              </div>
            </div>
          ) : null}

          <div
            className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm ${scrollerHideScrollbar}`}
          >
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}-${m.content.slice(0, 24)}`}
                className={
                  m.role === 'user'
                    ? 'ml-4 rounded-lg rounded-br-sm bg-emerald-900/40 px-2.5 py-2 text-[13px] text-zinc-100'
                    : 'mr-2 rounded-lg rounded-bl-sm border border-zinc-800/80 bg-zinc-950/90 px-2.5 py-2 shadow-inner shadow-black/20'
                }
              >
                {m.role === 'model' ? (
                  <StreamingAssistantMessage
                    content={m.content}
                    entryLabels={entryLabels}
                    onEntryLinkClick={closePanel}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                )}
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Digitando…
              </div>
            ) : null}
            {error ? <p className="text-xs text-red-300 whitespace-pre-wrap">{error}</p> : null}
            <div ref={endRef} />
          </div>

          <form
            className="border-t border-zinc-800 p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="flex gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  user
                    ? courseAssist
                      ? 'Dúvida sobre o conteúdo (não o teste)…'
                      : 'O que gostaria de ver?'
                    : 'Inicie sessão para usar'
                }
                rows={2}
                className="min-h-[40px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
                disabled={loading || !user}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                type="submit"
                disabled={loading || !input.trim() || !user}
                className="h-9 shrink-0 self-end px-2.5 py-0"
              >
                <Send size={16} />
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-600/50 bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500"
        aria-expanded={open}
        aria-label={open ? 'Fechar chat' : 'Abrir chat'}
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
