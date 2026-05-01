import { PublicMarkdownPage } from '@/components/legal/PublicMarkdownPage';
import { LEGAL_VERSIONS } from '@/legal/legalVersions';
import { CommitmentsSections } from '@/legal/content/CommitmentsSections';
import { PLATFORM_DISPLAY_NAME } from '@/lib/brand';

export function CommitmentsPage() {
  return (
    <PublicMarkdownPage
      storageKey="commitments"
      title="Compromissos do participante"
      versionFallback={LEGAL_VERSIONS.studentCommitments}
      scope={`Destinado a colaboradores e gestores que se cadastram no âmbito de empresa contratante de cursos na ${PLATFORM_DISPLAY_NAME}.`}
      fallback={<CommitmentsSections />}
    />
  );
}
