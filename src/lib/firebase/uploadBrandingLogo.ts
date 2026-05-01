import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

const MAX_BYTES = 6 * 1024 * 1024;

export async function uploadBrandingLogo(file: File): Promise<{ url: string; storagePath: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Use apenas PNG, JPG, SVG ou WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Imagem muito grande (máximo 6 MB).');
  }
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 96) || 'logo';
  const storagePath = `siteBranding/${Date.now()}_${safeName}`;
  const r = ref(storage, storagePath);
  await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(r);
  return { url, storagePath };
}
