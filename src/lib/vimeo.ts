/**
 * Extrai o ID numérico do Vimeo a partir de URL completa ou retorna o próprio valor se já for só dígitos.
 */
export function parseVimeoVideoId(input: string): string | null {
  const src = buildVimeoPlayerEmbedSrc(input);
  if (!src) return null;
  const m = src.match(/\/video\/(\d+)/);
  return m?.[1] ?? null;
}

/**
 * Monta a URL do iframe player.vimeo.com.
 * Vídeos com link do tipo vimeo.com/ID/HASH (não listados / privados com hash na URL)
 * precisam de ?h=HASH — sem isso o player mostra erro genérico.
 */
export function buildVimeoPlayerEmbedSrc(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    return `https://player.vimeo.com/video/${s}`;
  }

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '');
  if (!host.endsWith('vimeo.com')) {
    return null;
  }

  const path = url.pathname;
  const unlisted = path.match(/^\/(\d{6,})\/([a-f0-9]+)\/?$/i);
  const qpH = url.searchParams.get('h');

  if (unlisted) {
    const id = unlisted[1];
    const h = qpH || unlisted[2];
    return `https://player.vimeo.com/video/${id}?h=${encodeURIComponent(h)}`;
  }

  const standard = path.match(/^\/(?:video\/)?(\d{6,})\/?$/i);
  if (standard) {
    const id = standard[1];
    if (qpH) {
      return `https://player.vimeo.com/video/${id}?h=${encodeURIComponent(qpH)}`;
    }
    return `https://player.vimeo.com/video/${id}`;
  }

  return null;
}

/** Parâmetros para o player.js (API) e encadeamento de reprodução. */
export function withVimeoPlayerOptions(
  embedSrc: string,
  opts: { autoplay?: boolean } = {}
): string {
  let u: URL;
  try {
    u = new URL(embedSrc);
  } catch {
    return embedSrc;
  }
  u.searchParams.set('api', '1');
  u.searchParams.set('autopause', '0');
  if (opts.autoplay) {
    u.searchParams.set('autoplay', '1');
  }
  return u.toString();
}

/**
 * URL de página do Vimeo (oEmbed / capas em vídeos não listados precisam do hash na rota).
 */
export function vimeoWatchUrlFromEmbedSrc(embedSrc: string): string | null {
  try {
    const u = new URL(embedSrc);
    const m = u.pathname.match(/\/video\/(\d+)/i);
    if (!m) return null;
    const id = m[1]!;
    const h = u.searchParams.get('h');
    if (h) {
      return `https://vimeo.com/${id}/${h}`;
    }
    return `https://vimeo.com/${id}`;
  } catch {
    return null;
  }
}

async function fetchThumbnailFromVimeoOembed(candidateUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(candidateUrl)}&width=1280`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    return typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null;
  } catch {
    return null;
  }
}

/**
 * URL da capa via oEmbed oficial do Vimeo (`vimeo.com/api/oembed.json`).
 * O fallback noembed.com foi removido: exige `connect-src` extra e viola CSP comuns em produção.
 */
export async function fetchVimeoThumbnailUrl(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates: string[] = [];
  const seen = new Set<string>();

  function add(u: string) {
    const n = u.trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      candidates.push(n);
    }
  }

  add(trimmed);

  const embed = buildVimeoPlayerEmbedSrc(trimmed);
  if (embed) {
    const watch = vimeoWatchUrlFromEmbedSrc(embed);
    if (watch) add(watch);
    add(embed);
  }

  const id = parseVimeoVideoId(trimmed);
  if (id) {
    add(`https://vimeo.com/${id}`);
    add(`https://vimeo.com/video/${id}`);
  }

  for (const url of candidates) {
    const thumb = await fetchThumbnailFromVimeoOembed(url);
    if (thumb) return thumb;
  }

  return null;
}
