import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Capa de um vídeo na página pública do canal (`pageVideos[].coverImageUrl`).
 * Requer regra em `storage.rules`: `channelPageVideoCovers/...`.
 */
export async function uploadChannelPageVideoCover(
  channelId: string,
  videoId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use apenas PNG, JPG ou WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Imagem muito grande (máximo 6 MB).');
  }
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 96) || 'capa';
  const path = `channelPageVideoCovers/${channelId}/${videoId}/${Date.now()}_${safeName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
