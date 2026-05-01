import { PublicMarkdownPage } from '@/components/legal/PublicMarkdownPage';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { TermsOfServiceSections } from '@/legal/content/TermsOfServiceSections';
import { PLATFORM_DISPLAY_NAME } from '@/lib/brand';

export function TermsOfServicePage() {
  return (
    <PublicMarkdownPage
      storageKey="terms"
      title="Termos de uso"
      versionFallback={LEGAL_VERSIONS.termsOfService}
      scope={`Aplicáveis ao conjunto dos serviços da ${PLATFORM_DISPLAY_NAME} (áreas públicas e plataforma de cursos contratada por empresas).`}
      fallback={<TermsOfServiceSections />}
    />
  );
}
