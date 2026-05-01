import { PublicMarkdownPage } from '@/components/legal/PublicMarkdownPage';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { PrivacyPolicySections } from '@/legal/content/PrivacyPolicySections';
import { PLATFORM_DISPLAY_NAME } from '@/lib/brand';

export function PrivacyPolicyPage() {
  return (
    <PublicMarkdownPage
      storageKey="privacy"
      title="Política de privacidade"
      versionFallback={LEGAL_VERSIONS.privacyPolicy}
      scope={`Tratamento de dados pessoais na ${PLATFORM_DISPLAY_NAME}, em linha com a LGPD (Lei nº 13.709/2018).`}
      fallback={<PrivacyPolicySections />}
    />
  );
}
