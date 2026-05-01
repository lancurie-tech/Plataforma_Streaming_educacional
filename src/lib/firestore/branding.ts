import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export const BRANDING_DOC_ID = 'branding';

const DOC_REF = doc(db, 'siteContent', BRANDING_DOC_ID);

export type BrandingFirestoreDoc = {
  platformDisplayName?: string;
  platformShortName?: string;
  streamingAssistantChatTitle?: string;
  vendorDisplayFallback?: string;
  /** URL pública (Firebase Storage download URL). */
  logoUrl?: string;
  /** Caminho no bucket para `deleteObject` ao substituir/remover. */
  logoStoragePath?: string;
  /** URL pública do favicon (Storage). */
  faviconUrl?: string;
  /** Caminho no bucket do favicon para `deleteObject`. */
  faviconStoragePath?: string;
  palettePrimary?: string;
  palettePrimaryHover?: string;
  paletteAccent?: string;
  paletteBackground?: string;
  paletteText?: string;
  paletteTextMuted?: string;
};

export type BrandingFormDraft = {
  platformDisplayName: string;
  platformShortName: string;
  streamingAssistantChatTitle: string;
  vendorDisplayFallback: string;
};

export type BrandingPaletteDraft = {
  primary: string;
  primaryHover: string;
  accent: string;
  background: string;
  text: string;
  textMuted: string;
};

function strField(data: Record<string, unknown>, k: string): string | undefined {
  const v = data[k];
  return typeof v === 'string' ? v : undefined;
}

export function parseBrandingDoc(data: Record<string, unknown>): BrandingFirestoreDoc {
  return {
    platformDisplayName: strField(data, 'platformDisplayName'),
    platformShortName: strField(data, 'platformShortName'),
    streamingAssistantChatTitle: strField(data, 'streamingAssistantChatTitle'),
    vendorDisplayFallback: strField(data, 'vendorDisplayFallback'),
    logoUrl: strField(data, 'logoUrl'),
    logoStoragePath: strField(data, 'logoStoragePath'),
    faviconUrl: strField(data, 'faviconUrl'),
    faviconStoragePath: strField(data, 'faviconStoragePath'),
    palettePrimary: strField(data, 'palettePrimary'),
    palettePrimaryHover: strField(data, 'palettePrimaryHover'),
    paletteAccent: strField(data, 'paletteAccent'),
    paletteBackground: strField(data, 'paletteBackground'),
    paletteText: strField(data, 'paletteText'),
    paletteTextMuted: strField(data, 'paletteTextMuted'),
  };
}

export function subscribeBranding(onNext: (data: BrandingFirestoreDoc | null) => void): () => void {
  return onSnapshot(DOC_REF, (snap) => {
    if (!snap.exists()) {
      onNext(null);
      return;
    }
    onNext(parseBrandingDoc(snap.data() as Record<string, unknown>));
  });
}

export async function loadBrandingForAdmin(): Promise<BrandingFirestoreDoc | null> {
  const snap = await getDoc(DOC_REF);
  if (!snap.exists()) return null;
  return parseBrandingDoc(snap.data() as Record<string, unknown>);
}

function fieldOrDelete(val: string): string | ReturnType<typeof deleteField> {
  const t = val.trim();
  return t ? t : deleteField();
}

export async function saveBrandingTexts(draft: BrandingFormDraft): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      platformDisplayName: fieldOrDelete(draft.platformDisplayName),
      platformShortName: fieldOrDelete(draft.platformShortName),
      streamingAssistantChatTitle: fieldOrDelete(draft.streamingAssistantChatTitle),
      vendorDisplayFallback: fieldOrDelete(draft.vendorDisplayFallback),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveBrandingLogoFields(logoUrl: string, logoStoragePath: string): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      logoUrl,
      logoStoragePath,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearBrandingLogoFields(): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      logoUrl: deleteField(),
      logoStoragePath: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveBrandingFaviconFields(
  faviconUrl: string,
  faviconStoragePath: string,
): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      faviconUrl,
      faviconStoragePath,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearBrandingFaviconFields(): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      faviconUrl: deleteField(),
      faviconStoragePath: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveBrandingPalette(draft: BrandingPaletteDraft): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      palettePrimary: fieldOrDelete(draft.primary),
      palettePrimaryHover: fieldOrDelete(draft.primaryHover),
      paletteAccent: fieldOrDelete(draft.accent),
      paletteBackground: fieldOrDelete(draft.background),
      paletteText: fieldOrDelete(draft.text),
      paletteTextMuted: fieldOrDelete(draft.textMuted),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function emptyBrandingFormDraft(): BrandingFormDraft {
  return {
    platformDisplayName: '',
    platformShortName: '',
    streamingAssistantChatTitle: '',
    vendorDisplayFallback: '',
  };
}

export function docToBrandingFormDraft(data: BrandingFirestoreDoc | null): BrandingFormDraft {
  const d = emptyBrandingFormDraft();
  if (!data) return d;
  if (data.platformDisplayName) d.platformDisplayName = data.platformDisplayName;
  if (data.platformShortName) d.platformShortName = data.platformShortName;
  if (data.streamingAssistantChatTitle) d.streamingAssistantChatTitle = data.streamingAssistantChatTitle;
  if (data.vendorDisplayFallback) d.vendorDisplayFallback = data.vendorDisplayFallback;
  return d;
}

export function docToBrandingPaletteDraft(data: BrandingFirestoreDoc | null): BrandingPaletteDraft {
  return {
    primary: data?.palettePrimary ?? '',
    primaryHover: data?.palettePrimaryHover ?? '',
    accent: data?.paletteAccent ?? '',
    background: data?.paletteBackground ?? '',
    text: data?.paletteText ?? '',
    textMuted: data?.paletteTextMuted ?? '',
  };
}
