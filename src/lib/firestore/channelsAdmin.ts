import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { CatalogChannel, ChannelPageVideo } from '@/types';
import { parseChannelDoc } from '@/lib/firestore/channels';
import { resolveActiveTenantId, tenantContentPath } from '@/lib/firestore/tenantContentScope';

export async function listAllChannelsAdmin(): Promise<CatalogChannel[]> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return [];
  const snap = await getDocs(
    query(collection(db, tenantContentPath(tenantId, 'channels')), orderBy('order', 'asc'))
  );
  return snap.docs.map((d) => parseChannelDoc(d.id, d.data() as Record<string, unknown>));
}

export async function getChannelAdmin(channelId: string): Promise<CatalogChannel | null> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) return null;
  const snap = await getDoc(doc(db, tenantContentPath(tenantId, 'channels'), channelId));
  if (!snap.exists()) return null;
  return parseChannelDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function createChannelDraft(): Promise<string> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não resolvido para criar canal.');
  const col = collection(db, tenantContentPath(tenantId, 'channels'));
  const ref = doc(col);
  const snap = await getDocs(col);
  const maxOrder = snap.docs.reduce((m, d) => {
    const o = (d.data().order as number) ?? 0;
    return Math.max(m, o);
  }, -1);
  await setDoc(ref, {
    title: 'Novo canal',
    order: maxOrder + 1,
    published: false,
    coverImageUrl: null,
    pageDescription: null,
    pageVideos: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export type ChannelSaveInput = {
  title: string;
  order: number;
  published: boolean;
  coverImageUrl: string;
  pageDescription: string;
  pageVideos: ChannelPageVideo[];
};

export async function saveChannelAdmin(channelId: string, input: ChannelSaveInput): Promise<void> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não resolvido para salvar canal.');
  const title = input.title.trim();
  if (!title) throw new Error('Informe o nome do canal.');
  const cover = input.coverImageUrl.trim();
  const pageDescription = input.pageDescription.trim();
  const videos = [...input.pageVideos]
    .filter((v) => v.title.trim() && v.vimeoUrl.trim())
    .map((v, i) => ({
      id: v.id.trim(),
      title: v.title.trim(),
      vimeoUrl: v.vimeoUrl.trim(),
      order: typeof v.order === 'number' ? v.order : i,
      ...(v.coverImageUrl?.trim() ? { coverImageUrl: v.coverImageUrl.trim() } : {}),
      ...(v.description?.trim() ? { description: v.description.trim() } : {}),
    }))
    .sort((a, b) => a.order - b.order);

  await setDoc(
    doc(db, tenantContentPath(tenantId, 'channels'), channelId),
    {
      title,
      order: input.order,
      published: input.published === true,
      coverImageUrl: cover || null,
      pageDescription: pageDescription || null,
      pageVideos: videos,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteChannelAdmin(channelId: string): Promise<void> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não resolvido para apagar canal.');
  await deleteDoc(doc(db, tenantContentPath(tenantId, 'channels'), channelId));
}
