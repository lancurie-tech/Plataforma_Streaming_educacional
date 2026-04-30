/**
 * Atualiza o campo `demographics` em `users/{uid}` a partir de um JSON (importação tipo Excel).
 *
 * Uso na raiz do repo (com conta de serviço):
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\serviceAccount.json
 *   node scripts/bulk-update-demographics.mjs caminho/para/dados.json
 *
 * Formato do JSON (array):
 * [
 *   { "email": "a@b.com", "sexo": "Feminino", "faixaEtaria": "25 a 34", "segundaJornada": true },
 *   { "email": "c@d.com", "sexo": "Masculino", "faixaEtaria": "35 a 44", "segundaJornada": false }
 * ]
 *
 * sexo: Masculino | Feminino | Outro
 * faixaEtaria: Até 24 | 25 a 34 | 35 a 44 | 45 a 54 | 55 ou mais
 */

import { readFileSync, existsSync } from 'node:fs';
import admin from 'firebase-admin';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS com o JSON da conta de serviço.');
  process.exit(1);
}

const jsonPath = process.argv[2];
if (!jsonPath || !existsSync(jsonPath)) {
  console.error('Uso: node scripts/bulk-update-demographics.mjs <ficheiro.json>');
  process.exit(1);
}

const DEMO_SEXO = new Set(['Masculino', 'Feminino', 'Outro']);
const DEMO_FAIXA = new Set(['Até 24', '25 a 34', '35 a 44', '45 a 54', '55 ou mais']);

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();
const db = admin.firestore();

const rows = JSON.parse(readFileSync(jsonPath, 'utf8'));
if (!Array.isArray(rows)) {
  console.error('O JSON deve ser um array de objetos.');
  process.exit(1);
}

let ok = 0;
let skip = 0;

for (const row of rows) {
  const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
  if (!email) {
    skip++;
    continue;
  }
  const sexo = row.sexo;
  const faixaEtaria = row.faixaEtaria;
  const segundaJornada = row.segundaJornada;
  if (!DEMO_SEXO.has(sexo) || !DEMO_FAIXA.has(faixaEtaria) || typeof segundaJornada !== 'boolean') {
    console.warn('Linha inválida (campos obrigatórios):', row);
    skip++;
    continue;
  }
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    console.warn('Utilizador não encontrado:', email);
    skip++;
    continue;
  }
  const uid = userRecord.uid;
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) {
    console.warn('Documento users inexistente:', uid);
    skip++;
    continue;
  }
  const dem = {
    sexo,
    faixaEtaria,
    segundaJornada,
  };
  if (typeof row.idade === 'number' && row.idade >= 0 && row.idade <= 120) {
    dem.idade = Math.round(row.idade);
  }
  await db.doc(`users/${uid}`).update({
    demographics: dem,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  ok++;
  console.log('Atualizado:', email);
}

console.log(`Concluído. OK: ${ok}, ignorados: ${skip}`);
process.exit(0);
