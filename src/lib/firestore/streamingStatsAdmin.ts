import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export type StreamingEntryStatRow = {
  id: string;
  trackId: string;
  trackTitle: string;
  entryTitle: string;
  vimeoVideoId: string;
  views: number;
};

export type StreamingTrackStatRow = {
  id: string;
  trackTitle: string;
  views: number;
};

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Lê agregados gravados pela Cloud Function `logStreamingView` (só admin nas regras). */
export async function listStreamingEntryStats(): Promise<StreamingEntryStatRow[]> {
  const snap = await getDocs(collection(db, 'streamingEntryStats'));
  const rows: StreamingEntryStatRow[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      trackId: typeof x.trackId === 'string' ? x.trackId : '',
      trackTitle: typeof x.trackTitle === 'string' ? x.trackTitle : '—',
      entryTitle: typeof x.entryTitle === 'string' ? x.entryTitle : '—',
      vimeoVideoId: typeof x.vimeoVideoId === 'string' ? x.vimeoVideoId : '',
      views: num(x.views),
    };
  });
  return rows.sort((a, b) => b.views - a.views);
}

export async function listStreamingTrackStats(): Promise<StreamingTrackStatRow[]> {
  const snap = await getDocs(collection(db, 'streamingTrackStats'));
  const rows: StreamingTrackStatRow[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      trackTitle: typeof x.trackTitle === 'string' ? x.trackTitle : '—',
      views: num(x.views),
    };
  });
  return rows.sort((a, b) => b.views - a.views);
}
