import { PublicMarkdownPage } from '@/components/legal/PublicMarkdownPage';
import { MarkdownContent } from '@/components/legal/MarkdownContent';
import { DEFAULT_CONTACT_MARKDOWN } from '@/legal/defaultContactMarkdown';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { useBrand } from '@/contexts/useBrand';

export function ContactPage() {
  const brand = useBrand();
  return (
    <PublicMarkdownPage
      storageKey="contact"
      title="Contato"
      versionFallback={LEGAL_VERSIONS.contactPage}
      scope={`Canais oficiais de atendimento e informações para falar com a ${brand.platformDisplayName}.`}
      showLegalDisclaimer={false}
      fallback={<MarkdownContent markdown={DEFAULT_CONTACT_MARKDOWN} />}
    />
  );
}
