/**
 * Concede o custom claim master_admin ao utilizador Firebase Auth (Console master).
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
 *   node scripts/set-master-claim.mjs operador@empresa.com
 *
 * O utilizador deve fechar sessão e voltar a entrar (ou esperar refresco do token).
 */

import { existsSync, readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const emailArg = process.argv[2]?.trim();

if (!emailArg) {
  console.error('Utilização: node scripts/set-master-claim.mjs email@servidor');
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS para o JSON da conta de serviço.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();

const user = await auth.getUserByEmail(emailArg);

await auth.setCustomUserClaims(user.uid, { master_admin: true });

console.log('OK — master_admin concedido.');
console.log('  UID:', user.uid);
console.log('  E-mail:', user.email);
