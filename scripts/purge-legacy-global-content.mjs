/**
 * Apaga conteúdo legado global para forçar operação 100% tenantizada.
 *
 * Coleções/documentos removidos:
 * - channels/*
 * - streamingBanners/*
 * - courses/* + courses/{id}/modules/*
 * - answerKeys/*
 * - siteContent/publicPages
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
 *   npm run purge:legacy-global-content
 */

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function requireServiceAccountPath() {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!p) {
    throw new Error(
      'Defina GOOGLE_APPLICATION_CREDENTIALS com caminho do serviceAccountKey.json antes de executar.'
    );
  }
  return p;
}

const saPath = requireServiceAccountPath();
const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const BATCH_LIMIT = 450;

async function deleteByRefs(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const slice = refs.slice(i, i + BATCH_LIMIT);
    const b = db.batch();
    for (const ref of slice) b.delete(ref);
    await b.commit();
  }
}

async function deleteCollection(path) {
  const snap = await db.collection(path).get();
  if (snap.empty) return 0;
  await deleteByRefs(snap.docs.map((d) => d.ref));
  return snap.size;
}

async function purgeCourses() {
  const courses = await db.collection('courses').get();
  let deletedCourseDocs = 0;
  let deletedModuleDocs = 0;
  for (const c of courses.docs) {
    const mods = await c.ref.collection('modules').get();
    if (!mods.empty) {
      await deleteByRefs(mods.docs.map((d) => d.ref));
      deletedModuleDocs += mods.size;
    }
    await c.ref.delete();
    deletedCourseDocs += 1;
  }
  return { deletedCourseDocs, deletedModuleDocs };
}

async function run() {
  console.log('Iniciando limpeza do conteúdo global legado...');

  const deletedChannels = await deleteCollection('channels');
  console.log(`channels removidos: ${deletedChannels}`);

  const deletedBanners = await deleteCollection('streamingBanners');
  console.log(`streamingBanners removidos: ${deletedBanners}`);

  const { deletedCourseDocs, deletedModuleDocs } = await purgeCourses();
  console.log(`courses removidos: ${deletedCourseDocs}`);
  console.log(`courses/*/modules removidos: ${deletedModuleDocs}`);

  const deletedAnswerKeys = await deleteCollection('answerKeys');
  console.log(`answerKeys removidos: ${deletedAnswerKeys}`);

  await db.doc('siteContent/publicPages').delete().catch(() => {});
  console.log('siteContent/publicPages removido (se existia).');

  console.log('Limpeza concluída.');
}

run().catch((err) => {
  console.error('Falha na limpeza:', err);
  process.exitCode = 1;
});

