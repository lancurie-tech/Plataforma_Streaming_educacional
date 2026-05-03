/**
 * Seed Fase 4 — catálogo de módulos do marketplace em
 * catalog/platform/modules/{moduleId}
 *
 * Cria também o doc pai `catalog/platform` se não existir.
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
 *   npm run seed:marketplace-catalog
 */

import { existsSync, readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const keyPathRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const keyPath = typeof keyPathRaw === 'string' ? keyPathRaw.trim() : '';
if (!keyPath) {
  console.error(
    'GOOGLE_APPLICATION_CREDENTIALS não está definida (o processo Node não recebeu a variável).'
  );
  console.error('No PowerShell, na mesma janela:');
  console.error('  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\caminho\\completo\\chave.json"');
  console.error('  npm run seed:marketplace-catalog');
  process.exit(1);
}
if (!existsSync(keyPath)) {
  console.error('Ficheiro de service account não encontrado em:');
  console.error(keyPath);
  console.error('Confirme o caminho (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS após definir a variável).');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

const modules = [
  {
    id: 'streaming',
    title: 'Streaming',
    description: 'Home pública de streaming, canais ao vivo sob demanda e gestão da experiência Vimeo.',
    commercialModuleId: 'streaming',
    status: 'active',
  },
  {
    id: 'cursos',
    title: 'Cursos e LMS',
    description: 'Catálogo B2B, matrículas, progresso de alunos, certificados e analytics de uso.',
    commercialModuleId: 'cursos',
    status: 'active',
  },
  {
    id: 'chat',
    title: 'Assistente (IA)',
    description: 'Mentoria por IA nas superfícies de produto combinadas ao streaming ou cursos.',
    commercialModuleId: 'chat',
    status: 'active',
  },
  {
    id: 'vendedores',
    title: 'Equipa comercial',
    description: 'Portal do vendedor, carteiras e relatórios no ecossistema B2B.',
    commercialModuleId: 'vendedores',
    status: 'active',
  },
];

async function main() {
  await db.doc('catalog/platform').set(
    {
      kind: 'marketplace_catalog_root',
      updatedAt: ts(),
      createdAt: ts(),
    },
    { merge: true }
  );

  for (const m of modules) {
    await db.doc(`catalog/platform/modules/${m.id}`).set(
      {
        title: m.title,
        description: m.description,
        commercialModuleId: m.commercialModuleId,
        status: m.status,
        updatedAt: ts(),
        createdAt: ts(),
      },
      { merge: true }
    );
    console.log('OK:', m.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
