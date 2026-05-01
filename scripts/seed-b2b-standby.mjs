/**
 * Seed para testes SEM Cloud Functions (standby Blaze):
 * - Cursos nas matrículas: demo (Saúde Mental — rode seed:build-demo + seed:firestore antes) + curso_beta (mínimo, criado aqui)
 * - 2 empresas (empresa_alpha, empresa_beta) com chave de acesso fixa (hash SHA-256 igual às Functions)
 * - allowedCourses: cada empresa libera os 2 cursos
 * - 3 usuários aluno (Auth + Firestore + matrícula nos 2 cursos): 2 na Alpha, 1 na Beta
 *
 * O cadastro em /{slug}/cadastro só funciona com registerWithCompany deployada.
 *
 * Uso (PowerShell, raiz Plataforma de streaming educacional):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
 *   npm run seed:build-demo && npm run seed:firestore
 *   npm run seed:b2b-standby
 *
 * Para NÃO criar/atualizar usuários (só cursos + empresas):
 *   $env:B2B_SKIP_USERS="1"
 *   npm run seed:b2b-standby
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import admin from 'firebase-admin';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho absoluto do JSON da conta de serviço.\n' +
      'Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada.'
  );
  process.exit(1);
}

function hashKey(accessKey, keySalt) {
  return createHash('sha256').update(`${accessKey}:${keySalt}`, 'utf8').digest('hex');
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

/** Senha única para os 3 logins de teste (troque em produção / apague usuários de teste). */
const TEST_USER_PASSWORD = 'DemoStreaming123!';

/**
 * CPFs só com dígitos, válidos algoritmicamente, distintos (único por “empresa” no seed).
 */
const testUsers = [
  {
    email: 'b2b.alpha1@example.com',
    name: 'Aluno Alpha Um',
    companyDocId: 'seed_empresa_alpha',
    companySlug: 'empresa_alpha',
    cpf: '39053344705',
  },
  {
    email: 'b2b.alpha2@example.com',
    name: 'Aluno Alpha Dois',
    companyDocId: 'seed_empresa_alpha',
    companySlug: 'empresa_alpha',
    cpf: '52998224725',
  },
  {
    email: 'b2b.beta1@example.com',
    name: 'Aluno Beta Um',
    companyDocId: 'seed_empresa_beta',
    companySlug: 'empresa_beta',
    cpf: '11144477735',
  },
];

const courses = {
  curso_beta: {
    doc: { title: 'Curso Beta (teste)', description: 'Segundo curso genérico.' },
    moduleId: 'mod_inicio',
    module: {
      title: 'Boas-vindas',
      content: 'Introdução ao curso beta.',
      order: 0,
      vimeoUrl: 'https://vimeo.com/76979871',
      pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      questions: [{ id: 'q1', prompt: 'Confirmação', options: ['Não', 'Sim'] }],
    },
    answerKey: { correctByQuestionId: { q1: 1 } },
  },
};

/** Chaves em texto puro — mesma lógica de verificação da Cloud Function registerWithCompany */
const companiesDef = [
  {
    id: 'seed_empresa_alpha',
    name: 'Empresa Alpha (teste)',
    slug: 'empresa_alpha',
    accessKeyPlain: 'CHAVE-ALFA-TESTE',
    keySalt: 'a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0',
  },
  {
    id: 'seed_empresa_beta',
    name: 'Empresa Beta (teste)',
    slug: 'empresa_beta',
    accessKeyPlain: 'CHAVE-BETA-TESTE',
    keySalt: 'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1',
  },
];

/** Inclui `demo` (conteúdo completo via seed:firestore) + curso_beta (criado neste script). */
const courseIds = ['demo', 'curso_beta'];

async function ensureTestUsers() {
  console.log('\n=== Usuários de teste (Auth + Firestore + matrículas) ===\n');

  for (const u of testUsers) {
    let uid;
    try {
      const created = await auth.createUser({
        email: u.email,
        password: TEST_USER_PASSWORD,
        displayName: u.name,
      });
      uid = created.uid;
      console.log('Criado no Auth:', u.email, '→', uid);
    } catch (e) {
      if (e?.code === 'auth/email-already-exists') {
        const existing = await auth.getUserByEmail(u.email);
        uid = existing.uid;
        console.log('Já existia no Auth:', u.email, '→', uid);
      } else {
        throw e;
      }
    }

    await db
      .doc(`users/${uid}`)
      .set(
        {
          name: u.name,
          email: u.email,
          cpf: u.cpf,
          role: 'student',
          companyId: u.companyDocId,
          companySlug: u.companySlug,
          createdAt: ts(),
          updatedAt: ts(),
          seededByScript: true,
        },
        { merge: true }
      );

    const batch = db.batch();
    for (const cid of courseIds) {
      batch.set(db.doc(`users/${uid}/courses/${cid}`), {
        enrolledAt: ts(),
        viaCompany: true,
        seededByScript: true,
      });
    }
    await batch.commit();
    console.log(`  Firestore users/${uid} + matrículas: ${courseIds.join(', ')}`);
  }

  console.log('\nLogin (todos com a mesma senha):');
  console.log(' ', TEST_USER_PASSWORD);
  console.log('E-mails:', testUsers.map((x) => x.email).join(', '));
  console.log('');
}

async function main() {
  const batch = db.batch();
  let n = 0;

  for (const [courseId, def] of Object.entries(courses)) {
    const cref = db.collection('courses').doc(courseId);
    batch.set(cref, { ...def.doc, updatedAt: ts() }, { merge: true });
    n++;
    const mref = cref.collection('modules').doc(def.moduleId);
    batch.set(mref, def.module, { merge: true });
    n++;
    const akId = `${courseId}__${def.moduleId}`;
    batch.set(db.collection('answerKeys').doc(akId), def.answerKey, { merge: true });
    n++;
  }

  for (const c of companiesDef) {
    const accessKeyHash = hashKey(c.accessKeyPlain, c.keySalt);
    const cref = db.collection('companies').doc(c.id);
    batch.set(
      cref,
      {
        name: c.name,
        slug: c.slug,
        active: true,
        accessKeyHash,
        keySalt: c.keySalt,
        createdAt: ts(),
        updatedAt: ts(),
        seededByScript: true,
      },
      { merge: true }
    );
    n++;

    for (const cid of courseIds) {
      const aref = cref.collection('allowedCourses').doc(cid);
      batch.set(aref, { assignedAt: ts() }, { merge: true });
      n++;
    }
  }

  if (n > 450) {
    console.error('Batch muito grande; ajuste o script.');
    process.exit(1);
  }

  await batch.commit();
  console.log('\nOK — Firestore atualizado (%d writes).\n', n);

  console.log('=== Cursos (IDs) ===');
  for (const id of courseIds) console.log(' ', id);

  console.log('\n=== Empresas (use no admin ou no Console) ===');
  for (const c of companiesDef) {
    console.log(`\n  Nome:   ${c.name}`);
    console.log(`  ID doc: ${c.id}`);
    console.log(`  Slug:   ${c.slug}`);
    console.log(`  URL cadastro (no app): /${c.slug}/cadastro`);
    console.log(`  Chave (texto):         ${c.accessKeyPlain}`);
  }

  console.log(
    '\nObs.: sem Functions deployadas, o cadastro pela URL não cria usuário. ' +
      'O painel /admin lista empresas e cursos se seu usuário tiver role admin no Firestore.'
  );
  console.log(
    '\nCurso "demo" (Saúde Mental): se ainda não importou, rode:\n' +
      '  npm run seed:build-demo && npm run seed:firestore\n'
  );

  if (process.env.B2B_SKIP_USERS === '1') {
    console.log('\nB2B_SKIP_USERS=1 — usuários de teste não foram criados.\n');
    return;
  }

  await ensureTestUsers();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
