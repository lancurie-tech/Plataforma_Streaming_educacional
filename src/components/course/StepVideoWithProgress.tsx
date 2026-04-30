import { useEffect, useRef } from 'react';
import Player from '@vimeo/player';
import { attachVimeoOrientationFullscreen } from '@/lib/vimeoOrientationFullscreen';
import { withVimeoPlayerOptions } from '@/lib/vimeo';

type Props = {
  title: string;
  body?: string;
  embedSrc: string;
  /** Chave para este passo (fechada na montagem do player). */
  progressStorageKey: string;
  /** Já marcado como visto até ao fim (restauro de rascunho). */
  initialWatchedToEnd: boolean;
  /**
   * Só quando a reprodução chega ao fim (evento `ended` do player).
   * O segundo argumento é sempre `progressStorageKey` desta instância.
   */
  onVideoEnded: (progressStorageKey: string) => void;
  /** Só quando a reprodução chega ao fim — navegação linear entre passos. */
  onPlaybackEnded?: () => void;
  previewMode: boolean;
};

export function StepVideoWithProgress({
  title,
  body,
  embedSrc,
  progressStorageKey,
  initialWatchedToEnd,
  onVideoEnded,
  onPlaybackEnded,
  previewMode,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevEmbedSrcRef = useRef(embedSrc);
  const prevStorageKeyRef = useRef(progressStorageKey);
  const endedReportedRef = useRef(initialWatchedToEnd);
  const onVideoEndedRef = useRef(onVideoEnded);
  const onPlaybackEndedRef = useRef(onPlaybackEnded);

  useEffect(() => {
    onVideoEndedRef.current = onVideoEnded;
  }, [onVideoEnded]);

  useEffect(() => {
    onPlaybackEndedRef.current = onPlaybackEnded;
  }, [onPlaybackEnded]);

  useEffect(() => {
    const srcChanged = prevEmbedSrcRef.current !== embedSrc;
    const keyChanged = prevStorageKeyRef.current !== progressStorageKey;
    if (srcChanged || keyChanged) {
      prevEmbedSrcRef.current = embedSrc;
      prevStorageKeyRef.current = progressStorageKey;
      endedReportedRef.current = initialWatchedToEnd;
    } else {
      endedReportedRef.current = endedReportedRef.current || initialWatchedToEnd;
    }
  }, [embedSrc, initialWatchedToEnd, progressStorageKey]);

  const src = withVimeoPlayerOptions(embedSrc, {});

  useEffect(() => {
    if (previewMode) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const keyForThisPlayer = progressStorageKey;

    let cancelled = false;
    let player: Player | null = null;
    try {
      player = new Player(iframe);
    } catch {
      return () => {};
    }

    const onEnded = () => {
      if (cancelled) return;
      const wasAlreadyEnded = endedReportedRef.current;
      if (!endedReportedRef.current) {
        endedReportedRef.current = true;
        onVideoEndedRef.current(keyForThisPlayer);
      }
      // Só avança o fluxo linear na primeira conclusão deste passo (não ao rever vídeo já contado).
      if (!cancelled && !wasAlreadyEnded) {
        onPlaybackEndedRef.current?.();
      }
    };

    const detachOrientationRef: { current: (() => void) | null } = { current: null };
    void (async () => {
      try {
        await player!.ready();
        if (cancelled) return;
        player!.on('ended', onEnded);
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
          detachOrientationRef.current = attachVimeoOrientationFullscreen(player!, {
            maxViewportWidth: 1024,
          });
        }
      } catch {
        /* embed */
      }
    })();

    return () => {
      cancelled = true;
      detachOrientationRef.current?.();
      detachOrientationRef.current = null;
      if (player) {
        try {
          player.off('ended', onEnded);
        } catch {
          /* */
        }
      }
    };
  }, [src, previewMode, progressStorageKey]);

  return (
    <div className="space-y-4">
      {body ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-zinc-300">{body}</p>
        </div>
      ) : null}
      <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black">
        <iframe
          key={progressStorageKey}
          ref={iframeRef}
          title={title}
          src={src}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
        />
      </div>
    </div>
  );
}
