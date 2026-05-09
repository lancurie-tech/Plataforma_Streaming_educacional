import { buildVimeoPlayerEmbedSrc, withVimeoPlayerOptions } from '@/lib/vimeo';

export type StreamingVideoProvider = 'vimeo' | 'youtube';

export type ResolvedStreamingVideo = {
  provider: StreamingVideoProvider;
  /** Vimeo: URL completa do iframe player; YouTube: só o ID (player usa API). */
  vimeoIframeSrc?: string;
  youtubeVideoId?: string;
};

/**
 * Extrai o ID do vídeo YouTube a partir de URL ou ID cru (11 caracteres típicos).
 */
export function parseYoutubeVideoId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const strict = /^[a-zA-Z0-9_-]{11}$/;
  if (strict.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').replace(/^m\./i, '');
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return id && strict.test(id) ? id : null;
  }
  if (host.endsWith('youtube.com')) {
    const path = url.pathname;
    const shorts = path.match(/^\/shorts\/([a-zA-Z0-9_-]{11})\/?$/);
    if (shorts?.[1]) return shorts[1];
    const embed = path.match(/^\/embed\/([a-zA-Z0-9_-]{11})\/?$/);
    if (embed?.[1]) return embed[1];
    const v = url.searchParams.get('v');
    if (v && strict.test(v)) return v;
  }
  return null;
}

/** URL de thumbnail CDN do YouTube (hqdefault costuma existir para todos). */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** Resolve Vimeo ou YouTube; devolve dados para iframe Vimeo ou ID para YT.Player. */
export function resolveStreamingVideo(raw: string): ResolvedStreamingVideo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const yid = parseYoutubeVideoId(trimmed);
  if (yid) {
    return { provider: 'youtube', youtubeVideoId: yid };
  }

  const vim = buildVimeoPlayerEmbedSrc(trimmed);
  if (vim) {
    return { provider: 'vimeo', vimeoIframeSrc: vim };
  }

  return null;
}

export function buildVimeoHeroIframeSrc(embedSrc: string, autoplay: boolean): string {
  return withVimeoPlayerOptions(embedSrc, { autoplay });
}

/** Indica se a URL da entrada da trilha é reproduzível (Vimeo ou YouTube). */
export function isStreamingEntryVideoUrlOk(raw: string): boolean {
  return resolveStreamingVideo(raw) !== null;
}
