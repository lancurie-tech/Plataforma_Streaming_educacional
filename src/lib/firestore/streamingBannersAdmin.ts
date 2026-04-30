import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { StreamingBanner } from '@/types';
import { parseStreamingBannerDoc } from '@/lib/firestore/streamingBanners';

export async function listAllStreamingBannersAdmin(): Promise<StreamingBanner[]> {
  const snap = await getDocs(collection(db, 'streamingBanners'));
  return snap.docs
    .map((d) => parseStreamingBannerDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export async function createStreamingBannerDraft(): Promise<string> {
  const col = collection(db, 'streamingBanners');
  const ref = doc(col);
  const snap = await getDocs(col);
  const maxOrder = snap.docs.reduce((m, d) => {
    const o = (d.data().order as number) ?? 0;
    return Math.max(m, o);
  }, -1);
  await setDoc(ref, {
    title: 'Novo banner',
    imageUrl: '',
    imageUrlMobile: null,
    linkUrl: '/streaming',
    order: maxOrder + 1,
    published: false,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export type StreamingBannerSaveInput = {
  title: string;
  imageUrl: string;
  imageUrlMobile: string;
  linkUrl: string;
  order: number;
  published: boolean;
};

export async function saveStreamingBannerAdmin(
  bannerId: string,
  input: StreamingBannerSaveInput,
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Informe o título do banner (acessibilidade).');
  const linkUrl = input.linkUrl.trim();
  if (!linkUrl) throw new Error('Informe o destino do clique (URL ou rota).');
  const imageUrl = input.imageUrl.trim();
  if (input.published && !imageUrl) {
    throw new Error('Para publicar, envie a imagem principal do banner.');
  }
  const mobile = input.imageUrlMobile.trim();
  await setDoc(
    doc(db, 'streamingBanners', bannerId),
    {
      title,
      imageUrl,
      imageUrlMobile: mobile || null,
      linkUrl,
      order: input.order,
      published: input.published === true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteStreamingBannerAdmin(bannerId: string): Promise<void> {
  await deleteDoc(doc(db, 'streamingBanners', bannerId));
}

/** Reordena pela lista completa já ordenada (índices 0..n-1 → order 0..n-1). */
export async function reorderStreamingBannersAdmin(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      setDoc(
        doc(db, 'streamingBanners', id),
        {
          order: index,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ),
  );
}
