import type Player from '@vimeo/player';

/**
 * Em ecrãs estreitos, ao passar a landscape com o vídeo a reproduzir, pede fullscreen ao player Vimeo.
 * Requer interação prévia (reprodução) — alinhado às políticas dos browsers.
 * Em portrait tenta sair do fullscreen se o documento estiver em fullscreen.
 */
export function attachVimeoOrientationFullscreen(
  player: Player,
  opts: { maxViewportWidth: number }
): () => void {
  let cancelled = false;
  let hasPlayed = false;
  const onPlay = () => {
    hasPlayed = true;
  };
  player.on('play', onPlay);

  const run = async () => {
    if (cancelled) return;
    try {
      const landscape =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(orientation: landscape)').matches === true;
      const narrow = typeof window !== 'undefined' && window.innerWidth <= opts.maxViewportWidth;
      const paused = await player.getPaused();
      if (landscape && narrow && hasPlayed && !paused) {
        await player.requestFullscreen();
        return;
      }
      if (!landscape && typeof document !== 'undefined' && document.fullscreenElement) {
        await player.exitFullscreen();
      }
    } catch {
      /* política do browser / iOS */
    }
  };

  const mql = typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)') : null;
  mql?.addEventListener('change', run);
  window.addEventListener('resize', run);

  return () => {
    cancelled = true;
    player.off('play', onPlay);
    mql?.removeEventListener('change', run);
    window.removeEventListener('resize', run);
  };
}
