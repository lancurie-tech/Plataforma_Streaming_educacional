import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { resolveActiveTenantId, tenantContentPath } from '@/lib/firestore/tenantContentScope';
import type { StreamingEntry, StreamingTrack } from '@/types';
import {
  getStreamingTrack,
  listStreamingEntries,
  listStreamingTracksWithEntries,
} from '@/lib/firestore/streamingHome';

export type StreamingTrackWithEntries = {
  track: StreamingTrack;
  entries: StreamingEntry[];
};

export async function loadStreamingAdminTree(): Promise<StreamingTrackWithEntries[]> {
  return listStreamingTracksWithEntries();
}

export async function createStreamingTrack(title: string): Promise<string> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado. Abra o admin pelo URL do cliente (/slug/admin).');
  const col = collection(db, tenantContentPath(tenantId, 'streamingTracks'));
  const ref = doc(col);
  const snap = await getDocs(query(col, orderBy('order', 'asc')));
  const maxOrder = snap.docs.reduce((m, d) => {
    const o = (d.data().order as number) ?? 0;
    return Math.max(m, o);
  }, -1);
  await setDoc(ref, {
    title: title.trim() || 'Nova trilha',
    order: maxOrder + 1,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateStreamingTrack(
  trackId: string,
  data: { title?: string; order?: number }
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof data.title === 'string') payload.title = data.title.trim() || 'Sem título';
  if (typeof data.order === 'number') payload.order = data.order;
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  await setDoc(doc(db, tenantContentPath(tenantId, 'streamingTracks'), trackId), payload, { merge: true });
}

export async function deleteStreamingTrack(trackId: string): Promise<void> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  const entriesSnap = await getDocs(
    collection(db, tenantContentPath(tenantId, 'streamingTracks'), trackId, 'entries')
  );
  let batch = writeBatch(db);
  let n = 0;
  for (const e of entriesSnap.docs) {
    batch.delete(e.ref);
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
  await deleteDoc(doc(db, tenantContentPath(tenantId, 'streamingTracks'), trackId));
}

export async function setStreamingTrackOrder(orderedTrackIds: string[]): Promise<void> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  const batch = writeBatch(db);
  orderedTrackIds.forEach((id, index) => {
    batch.set(
      doc(db, tenantContentPath(tenantId, 'streamingTracks'), id),
      { order: index, updatedAt: serverTimestamp() },
      { merge: true }
    );
  });
  await batch.commit();
}

export async function createStreamingEntry(
  trackId: string,
  input: { title: string; vimeoUrl: string; description?: string; coverImageUrl?: string }
): Promise<string> {
  const t = await getStreamingTrack(trackId);
  if (!t) throw new Error('Trilha não encontrada.');
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  const entriesCol = collection(db, tenantContentPath(tenantId, 'streamingTracks'), trackId, 'entries');
  const ref = doc(entriesCol);
  const existing = await listStreamingEntries(trackId);
  const maxOrder = existing.reduce((m, e) => Math.max(m, e.order), -1);
  const cover = input.coverImageUrl?.trim();
  await setDoc(ref, {
    title: input.title.trim() || 'Sem título',
    vimeoUrl: input.vimeoUrl.trim(),
    coverImageUrl: cover || null,
    description: input.description?.trim() || null,
    order: maxOrder + 1,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateStreamingEntry(
  trackId: string,
  entryId: string,
  input: {
    title?: string;
    vimeoUrl?: string;
    coverImageUrl?: string | null;
    description?: string | null;
    order?: number;
  }
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (typeof input.title === 'string') payload.title = input.title.trim() || 'Sem título';
  if (typeof input.vimeoUrl === 'string') payload.vimeoUrl = input.vimeoUrl.trim();
  if (input.coverImageUrl !== undefined) {
    payload.coverImageUrl =
      input.coverImageUrl === null || input.coverImageUrl === '' ? null : input.coverImageUrl.trim();
  }
  if (input.description !== undefined) {
    payload.description = input.description === null || input.description === '' ? null : input.description;
  }
  if (typeof input.order === 'number') payload.order = input.order;
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  await setDoc(
    doc(db, tenantContentPath(tenantId, 'streamingTracks'), trackId, 'entries', entryId),
    payload,
    { merge: true }
  );
}

export async function deleteStreamingEntry(trackId: string, entryId: string): Promise<void> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  await deleteDoc(
    doc(db, tenantContentPath(tenantId, 'streamingTracks'), trackId, 'entries', entryId)
  );
}

/** Reordena entradas de uma trilha (IDs na ordem desejada). */
export async function setStreamingEntryOrder(trackId: string, orderedEntryIds: string[]): Promise<void> {
  const tenantId = await resolveActiveTenantId();
  if (!tenantId) throw new Error('Tenant não identificado.');
  const batch = writeBatch(db);
  orderedEntryIds.forEach((id, index) => {
    batch.set(
      doc(db, tenantContentPath(tenantId, 'streamingTracks'), trackId, 'entries', id),
      { order: index, updatedAt: serverTimestamp() },
      { merge: true }
    );
  });
  await batch.commit();
}
