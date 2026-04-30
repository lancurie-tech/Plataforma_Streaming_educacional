/**
 * Versões dos documentos legais (incrementar quando o advogado publicar nova versão).
 * Manter em sincronia com `functions/src/legalVersions.ts`.
 */
export const LEGAL_VERSIONS = {
  aboutPage: '2026-04-18-v1',
  contactPage: '2026-04-18-v1',
  termsOfService: '2026-04-09-v1',
  privacyPolicy: '2026-04-09-v1',
  studentCommitments: '2026-04-09-v1',
  vendorConfidentiality: '2026-04-09-v1',
} as const;

export type LegalVersionKey = keyof typeof LEGAL_VERSIONS;
