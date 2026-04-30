import { useEffect, useState, type ReactNode } from 'react';
import { LegalDocumentLayout } from '@/components/legal/LegalDocumentLayout';
import { MarkdownContent } from '@/components/legal/MarkdownContent';
import { getSitePublicContent, type SitePublicContentDoc } from '@/lib/firestore/siteContent';

const KEYS = {
  about: { md: 'aboutMarkdown', ver: 'aboutVersion' },
  contact: { md: 'contactMarkdown', ver: 'contactVersion' },
  terms: { md: 'termsMarkdown', ver: 'termsVersion' },
  privacy: { md: 'privacyMarkdown', ver: 'privacyVersion' },
  commitments: { md: 'commitmentsMarkdown', ver: 'commitmentsVersion' },
  vendorConfidentiality: { md: 'vendorConfidentialityMarkdown', ver: 'vendorConfidentialityVersion' },
} as const;

export type PublicMarkdownStorageKey = keyof typeof KEYS;

type Props = {
  storageKey: PublicMarkdownStorageKey;
  title: string;
  versionFallback: string;
  scope?: string;
  showLegalDisclaimer?: boolean;
  fallback: ReactNode;
};

export function PublicMarkdownPage({
  storageKey,
  title,
  versionFallback,
  scope,
  showLegalDisclaimer = true,
  fallback,
}: Props) {
  const [doc, setDoc] = useState<SitePublicContentDoc | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getSitePublicContent().then((d) => {
      if (!cancelled) setDoc(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { md: mdKey, ver: verKey } = KEYS[storageKey];
  const rawMd = doc ? doc[mdKey] : undefined;
  const useMd = typeof rawMd === 'string' && rawMd.trim().length > 0;
  const versionRaw = doc ? doc[verKey] : undefined;
  const version =
    typeof versionRaw === 'string' && versionRaw.trim() ? versionRaw.trim() : versionFallback;

  if (doc === undefined) {
    return (
      <LegalDocumentLayout
        title={title}
        version={versionFallback}
        scope={scope}
        showLegalDisclaimer={showLegalDisclaimer}
      >
        <p className="text-zinc-500">Carregando…</p>
      </LegalDocumentLayout>
    );
  }

  return (
    <LegalDocumentLayout
      title={title}
      version={version}
      scope={scope}
      showLegalDisclaimer={showLegalDisclaimer}
    >
      {useMd ? <MarkdownContent markdown={rawMd!} /> : fallback}
    </LegalDocumentLayout>
  );
}
