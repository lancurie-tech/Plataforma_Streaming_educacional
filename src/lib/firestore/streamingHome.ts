import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { StreamingEntry, StreamingTrack } from '@/types';

function parseTrack(id: string, d: Record<string, unknown>): StreamingTrack {
  return {
    id,
    title: typeof d.title === 'string' ? d.title : 'Sem título',
    order: typeof d.order === 'number' ? d.order : 0,
  };
}

function parseEntry(id: string, d: Record<string, unknown>): StreamingEntry {
  const coverRaw = d.coverImageUrl;
  return {
    id,
    title: typeof d.title === 'string' ? d.title : 'Sem título',
    vimeoUrl: typeof d.vimeoUrl === 'string' ? d.vimeoUrl : '',
    coverImageUrl:
      typeof coverRaw === 'string' && coverRaw.trim() ? coverRaw.trim() : undefined,
    description: typeof d.description === 'string' ? d.description : undefined,
    order: typeof d.order === 'number' ? d.order : 0,
  };
}

export async function listStreamingEntries(trackId: string): Promise<StreamingEntry[]> {
  const q = query(
    collection(db, 'streamingTracks', trackId, 'entries'),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((x) => parseEntry(x.id, x.data() as Record<string, unknown>));
}

/** Trilhas ordenadas, cada uma com entradas (home pública). */
export async function listStreamingTracksWithEntries(): Promise<
  { track: StreamingTrack; entries: StreamingEntry[] }[]
> {
  const tq = query(collection(db, 'streamingTracks'), orderBy('order', 'asc'));
  const tsnap = await getDocs(tq);
  const tracks = tsnap.docs.map((d) => parseTrack(d.id, d.data() as Record<string, unknown>));
  return Promise.all(
    tracks.map(async (track) => ({ track, entries: await listStreamingEntries(track.id) }))
  );
}

export async function getStreamingTrack(trackId: string): Promise<StreamingTrack | null> {
  const snap = await getDoc(doc(db, 'streamingTracks', trackId));
  if (!snap.exists()) return null;
  return parseTrack(snap.id, snap.data() as Record<string, unknown>);
}
