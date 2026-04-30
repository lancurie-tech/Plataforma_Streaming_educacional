import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { StreamingBanner } from '@/types';

export function parseStreamingBannerDoc(id: string, d: Record<string, unknown>): StreamingBanner {
  const imageUrl = typeof d.imageUrl === 'string' ? d.imageUrl.trim() : '';
  const mobileRaw = typeof d.imageUrlMobile === 'string' ? d.imageUrlMobile.trim() : '';
  const linkUrl = typeof d.linkUrl === 'string' ? d.linkUrl.trim() : '/streaming';
  return {
    id,
    title: (d.title as string)?.trim() || 'Banner',
    imageUrl,
    ...(mobileRaw ? { imageUrlMobile: mobileRaw } : {}),
    linkUrl: linkUrl || '/streaming',
    order: typeof d.order === 'number' ? d.order : 0,
    published: d.published === true,
  };
}

/** Banners visíveis na home Streaming (visitante). */
export async function listPublishedStreamingBanners(): Promise<StreamingBanner[]> {
  const q = query(collection(db, 'streamingBanners'), where('published', '==', true));
  const snap = await getDocs(q);
  const list = snap.docs
    .map((doc) => parseStreamingBannerDoc(doc.id, doc.data() as Record<string, unknown>))
    .filter((b) => Boolean(b.imageUrl) && Boolean(b.linkUrl));
  return list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
