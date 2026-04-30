import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const DOC_REF = doc(db, 'siteContent', 'publicPages');

export type SitePublicContentDoc = {
  aboutMarkdown?: string;
  aboutVersion?: string;
  contactMarkdown?: string;
  contactVersion?: string;
  termsMarkdown?: string;
  termsVersion?: string;
  privacyMarkdown?: string;
  privacyVersion?: string;
  commitmentsMarkdown?: string;
  commitmentsVersion?: string;
  vendorConfidentialityMarkdown?: string;
  vendorConfidentialityVersion?: string;
  /** Coluna direita em /perfil (direitos LGPD/GDPR). */
  accountRightsMarkdown?: string;
  accountRightsVersion?: string;
};

export type SitePublicContentDraft = {
  aboutMarkdown: string;
  aboutVersion: string;
  contactMarkdown: string;
  contactVersion: string;
  termsMarkdown: string;
  termsVersion: string;
  privacyMarkdown: string;
  privacyVersion: string;
  commitmentsMarkdown: string;
  commitmentsVersion: string;
  vendorConfidentialityMarkdown: string;
  vendorConfidentialityVersion: string;
  accountRightsMarkdown: string;
  accountRightsVersion: string;
};

export function parseSitePublicContentDoc(data: Record<string, unknown>): SitePublicContentDoc {
  const str = (k: string) => (typeof data[k] === 'string' ? data[k] : undefined);
  return {
    aboutMarkdown: str('aboutMarkdown'),
    aboutVersion: str('aboutVersion'),
    contactMarkdown: str('contactMarkdown'),
    contactVersion: str('contactVersion'),
    termsMarkdown: str('termsMarkdown'),
    termsVersion: str('termsVersion'),
    privacyMarkdown: str('privacyMarkdown'),
    privacyVersion: str('privacyVersion'),
    commitmentsMarkdown: str('commitmentsMarkdown'),
    commitmentsVersion: str('commitmentsVersion'),
    vendorConfidentialityMarkdown: str('vendorConfidentialityMarkdown'),
    vendorConfidentialityVersion: str('vendorConfidentialityVersion'),
    accountRightsMarkdown: str('accountRightsMarkdown'),
    accountRightsVersion: str('accountRightsVersion'),
  };
}

/** Leitura pública (sem cache em memória — cada visita à página reflete o Firestore). */
export async function getSitePublicContent(): Promise<SitePublicContentDoc | null> {
  const snap = await getDoc(DOC_REF);
  if (!snap.exists()) return null;
  return parseSitePublicContentDoc(snap.data() as Record<string, unknown>);
}

/** Carrega do Firestore sem cache (uso no admin). */
export async function loadSitePublicContentForEdit(): Promise<SitePublicContentDoc | null> {
  const snap = await getDoc(DOC_REF);
  if (!snap.exists()) return null;
  return parseSitePublicContentDoc(snap.data() as Record<string, unknown>);
}

function fieldOrDelete(val: string): string | ReturnType<typeof deleteField> {
  const t = val.trim();
  return t ? t : deleteField();
}

export async function saveSitePublicContent(draft: SitePublicContentDraft): Promise<void> {
  await setDoc(
    DOC_REF,
    {
      aboutMarkdown: fieldOrDelete(draft.aboutMarkdown),
      aboutVersion: fieldOrDelete(draft.aboutVersion),
      contactMarkdown: fieldOrDelete(draft.contactMarkdown),
      contactVersion: fieldOrDelete(draft.contactVersion),
      termsMarkdown: fieldOrDelete(draft.termsMarkdown),
      termsVersion: fieldOrDelete(draft.termsVersion),
      privacyMarkdown: fieldOrDelete(draft.privacyMarkdown),
      privacyVersion: fieldOrDelete(draft.privacyVersion),
      commitmentsMarkdown: fieldOrDelete(draft.commitmentsMarkdown),
      commitmentsVersion: fieldOrDelete(draft.commitmentsVersion),
      vendorConfidentialityMarkdown: fieldOrDelete(draft.vendorConfidentialityMarkdown),
      vendorConfidentialityVersion: fieldOrDelete(draft.vendorConfidentialityVersion),
      accountRightsMarkdown: fieldOrDelete(draft.accountRightsMarkdown),
      accountRightsVersion: fieldOrDelete(draft.accountRightsVersion),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function emptySitePublicContentDraft(): SitePublicContentDraft {
  return {
    aboutMarkdown: '',
    aboutVersion: '',
    contactMarkdown: '',
    contactVersion: '',
    termsMarkdown: '',
    termsVersion: '',
    privacyMarkdown: '',
    privacyVersion: '',
    commitmentsMarkdown: '',
    commitmentsVersion: '',
    vendorConfidentialityMarkdown: '',
    vendorConfidentialityVersion: '',
    accountRightsMarkdown: '',
    accountRightsVersion: '',
  };
}

export function docToDraft(data: SitePublicContentDoc | null): SitePublicContentDraft {
  const d = emptySitePublicContentDraft();
  if (!data) return d;
  if (data.aboutMarkdown) d.aboutMarkdown = data.aboutMarkdown;
  if (data.aboutVersion) d.aboutVersion = data.aboutVersion;
  if (data.contactMarkdown) d.contactMarkdown = data.contactMarkdown;
  if (data.contactVersion) d.contactVersion = data.contactVersion;
  if (data.termsMarkdown) d.termsMarkdown = data.termsMarkdown;
  if (data.termsVersion) d.termsVersion = data.termsVersion;
  if (data.privacyMarkdown) d.privacyMarkdown = data.privacyMarkdown;
  if (data.privacyVersion) d.privacyVersion = data.privacyVersion;
  if (data.commitmentsMarkdown) d.commitmentsMarkdown = data.commitmentsMarkdown;
  if (data.commitmentsVersion) d.commitmentsVersion = data.commitmentsVersion;
  if (data.vendorConfidentialityMarkdown) d.vendorConfidentialityMarkdown = data.vendorConfidentialityMarkdown;
  if (data.vendorConfidentialityVersion) d.vendorConfidentialityVersion = data.vendorConfidentialityVersion;
  if (data.accountRightsMarkdown) d.accountRightsMarkdown = data.accountRightsMarkdown;
  if (data.accountRightsVersion) d.accountRightsVersion = data.accountRightsVersion;
  return d;
}
