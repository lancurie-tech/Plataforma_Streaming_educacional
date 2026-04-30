import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { CatalogChannel, ChannelPageVideo } from '@/types';

function parsePageVideos(raw: unknown): ChannelPageVideo[] {
  if (!Array.isArray(raw)) return [];
  const out: ChannelPageVideo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const vimeoUrl = typeof o.vimeoUrl === 'string' ? o.vimeoUrl.trim() : '';
    if (!id || !title || !vimeoUrl) continue;
    const description =
      typeof o.description === 'string' && o.description.trim() ? o.description.trim() : undefined;
    const coverRaw = o.coverImageUrl;
    const coverImageUrl =
      typeof coverRaw === 'string' && coverRaw.trim() ? coverRaw.trim() : undefined;
    const order = typeof o.order === 'number' ? o.order : out.length;
    out.push({
      id,
      title,
      vimeoUrl,
      ...(coverImageUrl ? { coverImageUrl } : {}),
      ...(description ? { description } : {}),
      order,
    });
  }
  return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function parseChannelDoc(id: string, d: Record<string, unknown>): CatalogChannel {
  const programRaw = typeof d.programCourseId === 'string' ? d.programCourseId.trim() : '';
  const cover =
    typeof d.coverImageUrl === 'string' && d.coverImageUrl.trim() ? d.coverImageUrl.trim() : undefined;
  const pageDescription =
    typeof d.pageDescription === 'string' && d.pageDescription.trim()
      ? d.pageDescription.trim()
      : undefined;
  const pageVideos = parsePageVideos(d.pageVideos);
  const ch: CatalogChannel = {
    id,
    title: (d.title as string)?.trim() || 'Canal',
    order: typeof d.order === 'number' ? d.order : 0,
    ...(cover ? { coverImageUrl: cover } : {}),
    ...(pageDescription ? { pageDescription } : {}),
    ...(pageVideos.length ? { pageVideos } : {}),
    ...(programRaw ? { programCourseId: programRaw } : {}),
    published: d.published === true,
  };
  return ch;
}

/** Canais visíveis na home Streaming (visitante). */
export async function listPublishedChannels(): Promise<CatalogChannel[]> {
  const q = query(collection(db, 'channels'), where('published', '==', true));
  const snap = await getDocs(q);
  return snap.docs
    .map((docSnap) => parseChannelDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Leitura pública de um canal publicado (página `/canal/:id`). */
export async function getPublishedChannelById(channelId: string): Promise<CatalogChannel | null> {
  const snap = await getDoc(doc(db, 'channels', channelId));
  if (!snap.exists()) return null;
  const c = parseChannelDoc(snap.id, snap.data() as Record<string, unknown>);
  if (!c.published) return null;
  return c;
}
