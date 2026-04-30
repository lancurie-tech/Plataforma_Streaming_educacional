/**
 * Popula o Firestore a partir de scripts/seed-data.json
 * usando a conta de serviço (Admin SDK).
 *
 * Uso (PowerShell, na raiz Medivox):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\para\serviceAccountKey.json"
 *   npm run seed:firestore
 *
 * Matrícula opcional (cria users/{uid}/courses/demo):
 *   $env:ENROLL_UID="seuUidDoAuth"
 *   npm run seed:firestore
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataPath = join(__dirname, 'seed-data.json');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho absoluto do JSON da conta de serviço.\n' +
      'Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada.\n' +
      'Não commite esse arquivo no Git.'
  );
  process.exit(1);
}

const raw = readFileSync(dataPath, 'utf8');
const seed = JSON.parse(raw);

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  const batch = db.batch();
  let n = 0;

  for (const [courseId, course] of Object.entries(seed.courses ?? {})) {
    const { modules, ...courseFields } = course;
    const courseRef = db.collection('courses').doc(courseId);
    batch.set(courseRef, courseFields, { merge: true });
    n++;

    for (const [moduleId, moduleData] of Object.entries(modules ?? {})) {
      const modRef = courseRef.collection('modules').doc(moduleId);
      batch.set(modRef, moduleData, { merge: true });
      n++;
    }
  }

  for (const [docId, fields] of Object.entries(seed.answerKeys ?? {})) {
    batch.set(db.collection('answerKeys').doc(docId), fields, { merge: true });
    n++;
  }

  const enrollUid = process.env.ENROLL_UID?.trim();
  if (enrollUid) {
    batch.set(db.collection('users').doc(enrollUid).collection('courses').doc('demo'), {
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    n++;
    console.log('Matrícula: users/%s/courses/demo', enrollUid);
  }

  await batch.commit();
  console.log('Firestore atualizado (%d writes no batch).', n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
