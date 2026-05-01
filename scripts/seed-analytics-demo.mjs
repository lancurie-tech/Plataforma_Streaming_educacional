/**
 * Dados sintéticos para o painel /admin/dashboard (gráficos e tabelas).
 *
 * NÃO altera documentos do curso demo (Saúde Mental): não escreve em
 * `courses/demo` nem nos módulos desse curso. Apenas cria submissões em
 * `users/{uid}/courses/demo/modules/*` (progresso dos alunos).
 *
 * Escreve também `courses/curso_beta` (idempotente) se quiser rodar sem o
 * seed b2b — o conteúdo beta é genérico de teste, não o programa demo.
 *
 * Pré-requisitos:
 *   - Conta de serviço: GOOGLE_APPLICATION_CREDENTIALS
 *   - Curso demo no Firestore: npm run seed:build-demo && npm run seed:firestore
 *
 * Uso (raiz do repo Plataforma de streaming educacional):
 *   npm run seed:analytics-demo
 *
 * Opcional: rode antes `npm run seed:b2b-standby` para Alpha/Beta + chaves;
 * este script adiciona Gamma/Delta e ~24 alunos sintéticos.
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import admin from 'firebase-admin';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error(
    'Defina GOOGLE_APPLICATION_CREDENTIALS com o caminho absoluto do JSON da conta de serviço.'
  );
  process.exit(1);
}

function hashKey(accessKey, keySalt) {
  return createHash('sha256').update(`${accessKey}:${keySalt}`, 'utf8').digest('hex');
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

const TEST_USER_PASSWORD = 'DemoStreaming123!';

const DEMO_MODULES = ['mod-01', 'mod-02'];
const BETA_COURSE_ID = 'curso_beta';
const BETA_MODULE_ID = 'mod_inicio';

const demoAnswerKeys = {
  'mod-01': { 'm1-q1': 2, 'm1-q2': 0, 'm1-q3': 0 },
  'mod-02': { 'm2-q1': 0, 'm2-q2': 0, 'm2-q3': 0 },
};

const cursoBetaDef = {
  doc: { title: 'Curso Beta (teste)', description: 'Segundo curso genérico.' },
  moduleId: BETA_MODULE_ID,
  module: {
    title: 'Boas-vindas',
    content: 'Introdução ao curso beta.',
    order: 0,
    vimeoUrl: 'https://vimeo.com/76979871',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    questions: [{ id: 'q1', prompt: 'Confirmação', options: ['Não', 'Sim'] }],
  },
  answerKey: { correctByQuestionId: { q1: 1 } },
};

const companiesDef = [
  {
    id: 'seed_empresa_gamma',
    name: 'Empresa Gamma (analytics)',
    slug: 'empresa_gamma',
    accessKeyPlain: 'CHAVE-GAMMA-TESTE',
    keySalt: 'c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2',
  },
  {
    id: 'seed_empresa_delta',
    name: 'Empresa Delta (analytics)',
    slug: 'empresa_delta',
    accessKeyPlain: 'CHAVE-DELTA-TESTE',
    keySalt: 'd3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3',
  },
];

const courseIds = ['demo', BETA_COURSE_ID];

function randomCpfDigits() {
  const n = [];
  for (let i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  if (n.every((d) => d === n[0])) n[8] = (n[8] + 1) % 10;
  let s = 0;
  for (let i = 0; i < 9; i++) s += n[i] * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  s = 0;
  const n10 = [...n, d1];
  for (let i = 0; i < 10; i++) s += n10[i] * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return [...n, d1, d2].join('');
}

function answersWithNoise(correctMap, wrongProbability) {
  const answers = {};
  const nOpts = 4;
  for (const [qid, correctIdx] of Object.entries(correctMap)) {
    if (Math.random() < wrongProbability) {
      let w;
      do {
        w = Math.floor(Math.random() * nOpts);
      } while (w === correctIdx);
      answers[qid] = w;
    } else {
      answers[qid] = correctIdx;
    }
  }
  return answers;
}

async function ensureCursoBetaAndCompanies() {
  const batch = db.batch();
  let n = 0;

  const cref = db.collection('courses').doc(BETA_COURSE_ID);
  batch.set(cref, { ...cursoBetaDef.doc, updatedAt: ts() }, { merge: true });
  n++;
  batch.set(cref.collection('modules').doc(cursoBetaDef.moduleId), cursoBetaDef.module, {
    merge: true,
  });
  n++;
  batch.set(
    db.collection('answerKeys').doc(`${BETA_COURSE_ID}__${cursoBetaDef.moduleId}`),
    cursoBetaDef.answerKey,
    { merge: true }
  );
  n++;

  for (const c of companiesDef) {
    const accessKeyHash = hashKey(c.accessKeyPlain, c.keySalt);
    batch.set(
      db.collection('companies').doc(c.id),
      {
        name: c.name,
        slug: c.slug,
        active: true,
        accessKeyHash,
        keySalt: c.keySalt,
        createdAt: ts(),
        updatedAt: ts(),
        seededByScript: true,
        seedAnalyticsDemo: true,
      },
      { merge: true }
    );
    n++;
    for (const cid of courseIds) {
      batch.set(db.doc(`companies/${c.id}/allowedCourses/${cid}`), { assignedAt: ts() }, { merge: true });
      n++;
    }
  }

  await batch.commit();
  console.log(`Firestore: curso_beta + ${companiesDef.length} empresas (${n} writes).`);
}

async function ensureUser(row) {
  let uid;
  try {
    const created = await auth.createUser({
      email: row.email,
      password: TEST_USER_PASSWORD,
      displayName: row.name,
    });
    uid = created.uid;
    console.log('Auth criado:', row.email);
  } catch (e) {
    if (e?.code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(row.email);
      uid = existing.uid;
      console.log('Auth já existia:', row.email);
    } else {
      throw e;
    }
  }

  await db.doc(`users/${uid}`).set(
    {
      name: row.name,
      email: row.email,
      cpf: row.cpf,
      role: 'student',
      companyId: row.companyDocId,
      companySlug: row.companySlug,
      createdAt: ts(),
      updatedAt: ts(),
      seededByScript: true,
      seedAnalyticsDemo: true,
    },
    { merge: true }
  );

  const enrollBatch = db.batch();
  for (const cid of courseIds) {
    enrollBatch.set(db.doc(`users/${uid}/courses/${cid}`), {
      enrolledAt: ts(),
      viaCompany: true,
      seededByScript: true,
      seedAnalyticsDemo: true,
    });
  }
  await enrollBatch.commit();

  const modBatch = db.batch();
  let w = 0;

  for (const mid of DEMO_MODULES) {
    if (Math.random() > 0.72) continue;
    const key = demoAnswerKeys[mid];
    const answers = answersWithNoise(key, 0.35);
    const ref = db.doc(`users/${uid}/courses/demo/modules/${mid}`);
    modBatch.set(
      ref,
      {
        answers,
        submittedAt: ts(),
        status: 'completed',
        updatedAt: ts(),
        seedAnalyticsDemo: true,
      },
      { merge: true }
    );
    w++;
  }

  if (Math.random() > 0.12) {
    const q1 = Math.random() > 0.4 ? 1 : 0;
    modBatch.set(
      db.doc(`users/${uid}/courses/${BETA_COURSE_ID}/modules/${BETA_MODULE_ID}`),
      {
        answers: { q1 },
        submittedAt: ts(),
        status: 'completed',
        updatedAt: ts(),
        seedAnalyticsDemo: true,
      },
      { merge: true }
    );
    w++;
  }

  if (w > 0) await modBatch.commit();
  return uid;
}

async function main() {
  console.log('\n=== Seed analytics (sem alterar courses/demo) ===\n');
  await ensureCursoBetaAndCompanies();

  const rows = [];
  for (let i = 0; i < 24; i++) {
    const company = i % 2 === 0 ? companiesDef[0] : companiesDef[1];
    rows.push({
      email: `streaming-edu.analytics.${i + 1}@example.com`,
      name: `Aluno Analytics ${i + 1}`,
      companyDocId: company.id,
      companySlug: company.slug,
      cpf: randomCpfDigits(),
    });
  }

  console.log('\n=== Criando 24 utilizadores + matrículas + submissões ===\n');
  for (const r of rows) {
    await ensureUser(r);
  }

  console.log('\nSenha (todos):', TEST_USER_PASSWORD);
  console.log('\nNovas empresas (cadastro / slug):');
  for (const c of companiesDef) {
    console.log(`  ${c.name}  slug=${c.slug}  chave=${c.accessKeyPlain}`);
  }
  console.log('\nConcluído.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
