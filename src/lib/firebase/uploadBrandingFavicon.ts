import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

const MAX_BYTES = 2 * 1024 * 1024;

export async function uploadBrandingFavicon(file: File): Promise<{ url: string; storagePath: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use apenas ficheiros de imagem para o favicon.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Favicon muito grande (máximo 2 MB).');
  }
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 96) || 'favicon';
  const storagePath = `siteBranding/favicon_${Date.now()}_${safeName}`;
  const r = ref(storage, storagePath);
  await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(r);
  return { url, storagePath };
}
