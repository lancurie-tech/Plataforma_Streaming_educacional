import { PublicMarkdownPage } from '@/components/legal/PublicMarkdownPage';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { VendorConfidentialitySections } from '@/legal/content/VendorConfidentialitySections';

export function VendorConfidentialityPage() {
  return (
    <PublicMarkdownPage
      storageKey="vendorConfidentiality"
      title="Termo de confidencialidade e obrigações do vendedor"
      versionFallback={LEGAL_VERSIONS.vendorConfidentiality}
      scope="Aplica-se a utilizadores com perfil de vendedor autorizado, com acesso a dados de empresas clientes e relatórios da plataforma."
      fallback={<VendorConfidentialitySections />}
    />
  );
}
