import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

const MAX_BYTES = 6 * 1024 * 1024;

export type StreamingBannerImageVariant = 'desktop' | 'mobile';

export async function uploadStreamingBannerImage(
  bannerId: string,
  file: File,
  variant: StreamingBannerImageVariant,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use apenas PNG, JPG ou WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Imagem muito grande (máximo 6 MB).');
  }
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 96) || 'banner';
  const path = `streamingBanners/${bannerId}/${variant}_${Date.now()}_${safeName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
  return getDownloadURL(r);
}
