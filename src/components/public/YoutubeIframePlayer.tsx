import { useEffect, useRef } from 'react';

type YtPlayerLike = { destroy: () => void };

/** Estado ENDED na API iframe do YouTube. */
const YT_STATE_ENDED = 0;

let ytApiLoading: Promise<void> | null = null;

function ensureYoutubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  const g = window as unknown as {
    YT?: { Player?: new (el: HTMLElement, opts: Record<string, unknown>) => YtPlayerLike };
    onYouTubeIframeAPIReady?: () => void;
  };

  if (g.YT?.Player) return Promise.resolve();

  if (ytApiLoading) return ytApiLoading;

  ytApiLoading = new Promise((resolve, reject) => {
    const prev = g.onYouTubeIframeAPIReady;
    g.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } finally {
        resolve();
      }
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      ytApiLoading = null;
      reject(new Error('Falha ao carregar API do YouTube'));
    };
    document.head.appendChild(s);
  });

  return ytApiLoading;
}

/**
 * Player principal para trilhas (home streaming). Usa a iframe API para evento `ended` (seguinte vídeo).
 */
export function YoutubeIframePlayer({
  videoId,
  title,
  autoplay,
  onEnded,
}: {
  videoId: string;
  title: string;
  autoplay: boolean;
  onEnded: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayerLike | null>(null);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    let cancelled = false;
    const mount = mountRef.current;
    if (!mount || !videoId) return;

    void ensureYoutubeIframeApi()
      .then(() => {
        if (cancelled || !mountRef.current) return;
        const YT = (window as unknown as { YT?: { Player?: new (el: HTMLElement, opts: Record<string, unknown>) => YtPlayerLike } }).YT;
        if (!YT?.Player) return;

        mount.innerHTML = '';
        const player = new YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onStateChange: (ev: { data: number }) => {
              if (ev.data === YT_STATE_ENDED) {
                onEndedRef.current();
              }
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        /* iframe pode falhar em redes restritas — silêncio */
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      mount.innerHTML = '';
    };
  }, [videoId, autoplay]);

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden rounded-xl bg-black">
      <div ref={mountRef} className="h-full w-full" title={title} />
    </div>
  );
}
