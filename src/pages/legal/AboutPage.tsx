import { PublicMarkdownPage } from '@/components/legal/PublicMarkdownPage';
import { MarkdownContent } from '@/components/legal/MarkdownContent';
import { DEFAULT_ABOUT_MARKDOWN } from '@/legal/defaultAboutMarkdown';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { PLATFORM_SHORT_NAME } from '@/lib/brand';

export function AboutPage() {
  return (
    <PublicMarkdownPage
      storageKey="about"
      title={`Sobre — ${PLATFORM_SHORT_NAME}`}
      versionFallback={LEGAL_VERSIONS.aboutPage}
      scope="Conheça nossa história, benefícios e respostas a dúvidas frequentes."
      showLegalDisclaimer={false}
      fallback={<MarkdownContent markdown={DEFAULT_ABOUT_MARKDOWN} />}
    />
  );
}
