import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Capa do vídeo nas trilhas da home streaming (`coverImageUrl` na entrada).
 * Requer regra em `storage.rules` em `streamingTrackEntryCovers/...`.
 */
export async function uploadStreamingEntryCover(
  trackId: string,
  entryId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use apenas PNG, JPG ou WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Imagem muito grande (máximo 6 MB).');
  }
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 96) || 'capa';
  const path = `streamingTrackEntryCovers/${trackId}/${entryId}/${Date.now()}_${safeName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
