import * as crypto from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';
import { LEGAL_VERSIONS } from './legalVersions.js';
import {
  assertAssistantDailyQuota,
  handleLogStreamingView,
  handleStreamingAssistantChat,
  type StreamingAssistantRequestData,
} from './streamingOps.js';

initializeApp();
const db = getFirestore();
const authAdmin = getAuth();

setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

/**
 * Callables (Gen 2 / Cloud Run): o browser faz preflight OPTIONS antes do POST.
 * Listas com RegExp + `Origin` por vezes não ecoam `Access-Control-Allow-Origin` (browser mostra CORS genérico).
 * `cors: true` aceita qualquer origem no preflight; proteção real vem do Firebase Auth nas próprias funções
 * e, se ativo, do App Check (`enforceAppCheck`).
 *
 */
const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';

const callableHttp = {
  invoker: 'public' as const,
  cors: true,
  enforceAppCheck,
};

/** Secret Manager — definir com: `firebase functions:secrets:set GOOGLE_API_KEY` antes do deploy. */
const geminiApiKeySecret = defineSecret('GOOGLE_API_KEY');
/** Predefinição: 2.0-flash deixou de estar disponível para novas chaves — override com `GEMINI_MODEL`. */
const geminiModelParam = defineString('GEMINI_MODEL', { default: 'gemini-2.5-flash' });

const RESERVED_SLUGS = new Set([
  'admin',
  'login',
  'registro',
  'cadastro',
  'esqueci-senha',
  'redefinir-senha',
  'curso',
  'cursos',
  'perfil',
  'certificados',
  'api',
  'static',
  'assets',
  'vendedor',
  'dashboard',
  'metricas',
  'saude-mental',
  'termos',
  'privacidade',
  'compromissos',
  'confidencialidade-vendedor',
]);

function hashKey(accessKey: string, keySalt: string): string {
  return crypto.createHash('sha256').update(`${accessKey}:${keySalt}`, 'utf8').digest('hex');
}

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function randomKey(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < length; i++) {
    s += chars[crypto.randomInt(chars.length)]!;
  }
  return s;
}

function randomSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function isValidCpfDigits(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]!, 10) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10 || mod === 11) mod = 0;
  if (mod !== parseInt(d[9]!, 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]!, 10) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10 || mod === 11) mod = 0;
  return mod === parseInt(d[10]!, 10);
}

async function assertIsAdmin(uid: string): Promise<void> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores.');
  }
}

async function deleteUserData(uid: string): Promise<void> {
  const userRef = db.doc(`users/${uid}`);
  const coursesSnap = await userRef.collection('courses').get();
  for (const c of coursesSnap.docs) {
    const mods = await c.ref.collection('modules').get();
    for (const m of mods.docs) {
      await m.ref.delete();
    }
    await c.ref.delete();
  }
  const certs = await userRef.collection('certificates').get();
  for (const x of certs.docs) {
    await x.ref.delete();
  }
  await userRef.delete();
  try {
    await authAdmin.deleteUser(uid);
  } catch {
    /* usuário já inexistente no Auth */
  }
}

const DEMO_SEXO = new Set(['Masculino', 'Feminino', 'Outro']);
const DEMO_FAIXA = new Set(['Até 24', '25 a 34', '35 a 44', '45 a 54', '55 ou mais']);

export const registerWithCompany = onCall(callableHttp, async (request) => {
  const data = request.data as {
    companySlug?: string;
    accessKey?: string;
    email?: string;
    password?: string;
    name?: string;
    cpf?: string;
    legalAcceptance?: {
      termsVersion?: string;
      privacyVersion?: string;
      commitmentsVersion?: string;
    };
    /** Dados para relatórios (painel saúde mental / Excel). */
    demographics?: {
      sexo?: string;
      faixaEtaria?: string;
      segundaJornada?: boolean;
      idade?: number;
    };
  };

  const companySlug = normalizeSlug(data.companySlug ?? '');
  const accessKey = (data.accessKey ?? '').trim();
  const email = (data.email ?? '').trim().toLowerCase();
  const password = data.password ?? '';
  const name = (data.name ?? '').trim();
  const cpfDigits = (data.cpf ?? '').replace(/\D/g, '');

  if (!companySlug || !accessKey || !email || !password || !name || !cpfDigits) {
    throw new HttpsError('invalid-argument', 'Preencha todos os campos.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Senha mínima de 6 caracteres.');
  }
  if (!isValidCpfDigits(cpfDigits)) {
    throw new HttpsError('invalid-argument', 'CPF inválido.');
  }

  const la = data.legalAcceptance;
  if (
    !la ||
    typeof la.termsVersion !== 'string' ||
    typeof la.privacyVersion !== 'string' ||
    typeof la.commitmentsVersion !== 'string' ||
    la.termsVersion !== LEGAL_VERSIONS.termsOfService ||
    la.privacyVersion !== LEGAL_VERSIONS.privacyPolicy ||
    la.commitmentsVersion !== LEGAL_VERSIONS.studentCommitments
  ) {
    throw new HttpsError(
      'invalid-argument',
      'É necessário aceitar os Termos de uso, a Política de privacidade e os Compromissos na versão atual.'
    );
  }

  const dem = data.demographics;
  if (
    !dem ||
    typeof dem.sexo !== 'string' ||
    !DEMO_SEXO.has(dem.sexo) ||
    typeof dem.faixaEtaria !== 'string' ||
    !DEMO_FAIXA.has(dem.faixaEtaria) ||
    typeof dem.segundaJornada !== 'boolean'
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Informe sexo, faixa etária e segunda jornada (dados para relatórios agregados).'
    );
  }
  if (dem.idade !== undefined && dem.idade !== null) {
    if (typeof dem.idade !== 'number' || dem.idade < 0 || dem.idade > 120 || !Number.isFinite(dem.idade)) {
      throw new HttpsError('invalid-argument', 'Idade inválida.');
    }
  }

  const q = await db.collection('companies').where('slug', '==', companySlug).limit(1).get();
  if (q.empty) {
    throw new HttpsError('not-found', 'Empresa ou link inválido.');
  }
  const companyDoc = q.docs[0]!;
  const companyId = companyDoc.id;
  const c = companyDoc.data()!;
  if (c.active === false) {
    throw new HttpsError('failed-precondition', 'Esta empresa está desativada.');
  }

  const allowedDomains = Array.isArray(c.allowedEmailDomains)
    ? (c.allowedEmailDomains as string[]).map((d: string) => d.toLowerCase())
    : [];
  if (allowedDomains.length > 0) {
    const emailDomain = email.split('@')[1] ?? '';
    if (!allowedDomains.includes(emailDomain)) {
      throw new HttpsError(
        'invalid-argument',
        `E-mail não permitido. Esta empresa aceita apenas e-mails com domínio: ${allowedDomains.map((d) => '@' + d).join(', ')}`
      );
    }
  }
  type AccessKeyRow = { roleId: string; departmentId: string; keyHash: string; keySalt: string };
  const accessKeysV2 = Array.isArray(c.accessKeys) ? (c.accessKeys as AccessKeyRow[]) : [];

  if (accessKeysV2.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'Esta empresa ainda não tem chaves configuradas. Peça ao administrador para configurar níveis e áreas.'
    );
  }

  const v2Match = accessKeysV2.find(
    (k) => k.keyHash && k.keySalt && hashKey(accessKey, k.keySalt) === k.keyHash
  );
  if (!v2Match) {
    throw new HttpsError('permission-denied', 'Chave de acesso incorreta.');
  }

  const companyRoleId = v2Match.roleId;
  const companyDepartmentId = v2Match.departmentId;

  const dupCpf = await db
    .collection('users')
    .where('companyId', '==', companyId)
    .where('cpf', '==', cpfDigits)
    .limit(1)
    .get();
  if (!dupCpf.empty) {
    throw new HttpsError('already-exists', 'Este CPF já está cadastrado nesta empresa.');
  }

  const allowedSnap = await db.collection(`companies/${companyId}/allowedCourses`).get();
  const now = Date.now();
  const activeDocs = allowedSnap.docs.filter((docSnap) => {
    const ex = docSnap.data().expiresAt as { toMillis?: () => number } | undefined;
    if (ex == null || typeof ex.toMillis !== 'function') return true;
    return ex.toMillis() > now;
  });
  if (activeDocs.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'Nenhum curso liberado ativo para esta empresa (verifique prazos ou liberações). Contate o suporte.'
    );
  }

  let userRecord;
  try {
    userRecord = await authAdmin.createUser({
      email,
      password,
      displayName: name,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Este e-mail já está em uso.');
    }
    throw new HttpsError('internal', 'Não foi possível criar o usuário.');
  }

  const uid = userRecord.uid;
  const batch = db.batch();

  batch.set(db.doc(`users/${uid}`), {
    name,
    email,
    cpf: cpfDigits,
    role: 'student',
    companyId,
    companySlug,
    companyRoleId,
    companyDepartmentId,
    demographics: {
      sexo: dem.sexo,
      faixaEtaria: dem.faixaEtaria,
      segundaJornada: dem.segundaJornada,
      ...(typeof dem.idade === 'number' ? { idade: Math.round(dem.idade) } : {}),
    },
    legalAcceptanceStudent: {
      termsVersion: la.termsVersion,
      privacyVersion: la.privacyVersion,
      commitmentsVersion: la.commitmentsVersion,
      acceptedAt: FieldValue.serverTimestamp(),
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const docSnap of activeDocs) {
    const courseId = docSnap.id;
    batch.set(db.doc(`users/${uid}/courses/${courseId}`), {
      enrolledAt: FieldValue.serverTimestamp(),
      viaCompany: true,
    });
  }

  try {
    await batch.commit();
  } catch {
    await authAdmin.deleteUser(uid).catch(() => {});
    throw new HttpsError('internal', 'Falha ao finalizar cadastro. Tente novamente.');
  }
  return { uid };
});

export const adminCreateCompany = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  await assertIsAdmin(request.auth.uid);

  const data = request.data as { name?: string; slug?: string };
  const name = (data.name ?? '').trim();
  let slug = normalizeSlug(data.slug ?? '');
  if (!name || !slug) {
    throw new HttpsError('invalid-argument', 'Nome e identificador da URL são obrigatórios.');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new HttpsError('invalid-argument', 'Este identificador de URL não pode ser usado.');
  }

  const dup = await db.collection('companies').where('slug', '==', slug).limit(1).get();
  if (!dup.empty) {
    throw new HttpsError('already-exists', 'Já existe uma empresa com este identificador de URL.');
  }

  const ref = db.collection('companies').doc();
  await ref.set({
    name,
    slug,
    active: true,
    roles: [],
    departments: [],
    accessKeys: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const registrationPath = `/${slug}/cadastro`;
  return { companyId: ref.id, slug, registrationPath };
});

/**
 * Configura níveis (roles), áreas (departments) e gera chaves de acesso por combinação.
 * Cada combinação roleId × departmentId recebe uma chave única; chaves anteriores são substituídas.
 */
export const adminUpdateCompanyConfig = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  await assertIsAdmin(request.auth.uid);

  const data = request.data as {
    companyId?: string;
    roles?: Array<{ id?: string; label?: string }>;
    departments?: Array<{ id?: string; label?: string }>;
    allowedEmailDomains?: string[];
  };
  const companyId = data.companyId?.trim();
  if (!companyId) throw new HttpsError('invalid-argument', 'companyId é obrigatório.');

  const companySnap = await db.doc(`companies/${companyId}`).get();
  if (!companySnap.exists) throw new HttpsError('not-found', 'Empresa não encontrada.');

  const roles = (data.roles ?? [])
    .filter((r) => r.id?.trim() && r.label?.trim())
    .map((r) => ({ id: r.id!.trim(), label: r.label!.trim() }));
  const departments = (data.departments ?? [])
    .filter((d) => d.id?.trim() && d.label?.trim())
    .map((d) => ({ id: d.id!.trim(), label: d.label!.trim() }));

  if (roles.length === 0) throw new HttpsError('invalid-argument', 'Informe pelo menos um nível.');
  if (departments.length === 0) throw new HttpsError('invalid-argument', 'Informe pelo menos uma área.');
  if (roles.length > 20) throw new HttpsError('invalid-argument', 'Máximo de 20 níveis.');
  if (departments.length > 20) throw new HttpsError('invalid-argument', 'Máximo de 20 áreas.');

  type KeyRow = {
    id: string;
    roleId: string;
    departmentId: string;
    keyHash: string;
    keySalt: string;
  };
  type ArchiveRow = {
    id: string;
    roleId: string;
    roleLabel: string;
    departmentId: string;
    departmentLabel: string;
    plainKey: string;
  };
  const accessKeys: KeyRow[] = [];
  const archiveKeys: ArchiveRow[] = [];

  for (const role of roles) {
    for (const dept of departments) {
      const id = `${role.id}__${dept.id}`;
      const plainKey = randomKey();
      const salt = randomSalt();
      accessKeys.push({
        id,
        roleId: role.id,
        departmentId: dept.id,
        keyHash: hashKey(plainKey, salt),
        keySalt: salt,
      });
      archiveKeys.push({
        id,
        roleId: role.id,
        roleLabel: role.label,
        departmentId: dept.id,
        departmentLabel: dept.label,
        plainKey,
      });
    }
  }

  const slug = companySnap.data()!.slug as string;
  const registrationPath = `/${slug}/cadastro`;

  const allowedEmailDomains = (data.allowedEmailDomains ?? [])
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  await db.doc(`companies/${companyId}`).update({
    roles,
    departments,
    accessKeys,
    allowedEmailDomains,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db
    .doc(`companies/${companyId}/adminRegistrationKeys/archive`)
    .set(
      {
        registrationPath,
        roles,
        departments,
        accessKeys: archiveKeys,
        savedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true, keyCount: accessKeys.length, registrationPath };
});

export const adminDeleteCompany = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  await assertIsAdmin(request.auth.uid);

  const companyId = (request.data as { companyId?: string }).companyId?.trim();
  if (!companyId) {
    throw new HttpsError('invalid-argument', 'companyId é obrigatório.');
  }

  const companySnap = await db.doc(`companies/${companyId}`).get();
  if (!companySnap.exists) {
    throw new HttpsError('not-found', 'Empresa não encontrada.');
  }

  const usersSnap = await db.collection('users').where('companyId', '==', companyId).get();
  for (const u of usersSnap.docs) {
    await deleteUserData(u.id);
  }

  const allowedSnap = await db.collection(`companies/${companyId}/allowedCourses`).get();
  for (const a of allowedSnap.docs) {
    await a.ref.delete();
  }

  const keysSnap = await db.collection(`companies/${companyId}/adminRegistrationKeys`).get();
  for (const k of keysSnap.docs) {
    await k.ref.delete();
  }

  await db.doc(`companies/${companyId}`).delete();
  return { ok: true };
});

export const adminCreateVendedor = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  await assertIsAdmin(request.auth.uid);

  const data = request.data as {
    email?: string;
    name?: string;
    provisionalPassword?: string;
    managedCompanyIds?: string[];
  };
  const email = (data.email ?? '').trim().toLowerCase();
  const name = (data.name ?? '').trim();
  const provisionalPassword = data.provisionalPassword ?? '';
  const managedIds = Array.isArray(data.managedCompanyIds)
    ? data.managedCompanyIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  if (!email || !name || provisionalPassword.length < 6) {
    throw new HttpsError(
      'invalid-argument',
      'Nome, e-mail e senha provisória (mín. 6 caracteres) são obrigatórios.'
    );
  }

  for (const cid of managedIds) {
    const c = await db.doc(`companies/${cid}`).get();
    if (!c.exists) {
      throw new HttpsError('invalid-argument', `Empresa não encontrada: ${cid}`);
    }
  }

  let userRecord;
  try {
    userRecord = await authAdmin.createUser({
      email,
      password: provisionalPassword,
      displayName: name,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Este e-mail já está em uso.');
    }
    throw new HttpsError('internal', 'Não foi possível criar o vendedor.');
  }

  const uid = userRecord.uid;
  await db.doc(`users/${uid}`).set({
    name,
    email,
    role: 'vendedor',
    mustChangePassword: true,
    managedCompanyIds: managedIds,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { uid, email };
});

export const adminUpdateVendedorCompanies = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  await assertIsAdmin(request.auth.uid);

  const data = request.data as { vendedorUid?: string; managedCompanyIds?: string[] };
  const vendedorUid = (data.vendedorUid ?? '').trim();
  const managedIds = Array.isArray(data.managedCompanyIds)
    ? data.managedCompanyIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];

  if (!vendedorUid) {
    throw new HttpsError('invalid-argument', 'vendedorUid é obrigatório.');
  }

  const uref = db.doc(`users/${vendedorUid}`);
  const snap = await uref.get();
  if (!snap.exists || snap.data()?.role !== 'vendedor') {
    throw new HttpsError('not-found', 'Vendedor não encontrado.');
  }

  for (const cid of managedIds) {
    const c = await db.doc(`companies/${cid}`).get();
    if (!c.exists) {
      throw new HttpsError('invalid-argument', `Empresa não encontrada: ${cid}`);
    }
  }

  await uref.update({
    managedCompanyIds: managedIds,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const adminDeleteVendedor = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  await assertIsAdmin(request.auth.uid);

  const vendedorUid = (request.data as { vendedorUid?: string }).vendedorUid?.trim();
  if (!vendedorUid) {
    throw new HttpsError('invalid-argument', 'vendedorUid é obrigatório.');
  }
  if (vendedorUid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'Não é possível excluir a própria conta.');
  }

  const snap = await db.doc(`users/${vendedorUid}`).get();
  if (!snap.exists || snap.data()?.role !== 'vendedor') {
    throw new HttpsError('not-found', 'Vendedor não encontrado.');
  }

  await deleteUserData(vendedorUid);
  return { ok: true };
});

export const vendedorClearMustChangePassword = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  const uid = request.auth.uid;
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.role !== 'vendedor') {
    throw new HttpsError('permission-denied', 'Apenas vendedores.');
  }
  await db.doc(`users/${uid}`).update({
    mustChangePassword: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/**
 * Métricas da home streaming (abrir vídeo em destaque).
 * Exige utilizador autenticado para evitar abuso de custo (escritas Firestore) por scripts anónimos.
 */
export const logStreamingView = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      'Inicie sessão para que a visualização conte nas estatísticas.'
    );
  }
  return handleLogStreamingView(db, (request.data ?? {}) as { trackId?: string; entryId?: string });
});

/** Chat assistente (Gemini): login obrigatório + quota diária; contexto streaming + cursos + vídeo em foco. */
export const streamingAssistantChat = onCall(
  { ...callableHttp, secrets: [geminiApiKeySecret] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        'unauthenticated',
        'Inicie sessão para usar o assistente. Isto protege o serviço e o custo da API.'
      );
    }
    const raw = (request.data ?? {}) as StreamingAssistantRequestData;
    await assertAssistantDailyQuota(db, request.auth.uid, raw.courseId);
    return handleStreamingAssistantChat(db, raw, {
      googleApiKey: geminiApiKeySecret.value(),
      modelName: geminiModelParam.value(),
      /** Vimeo é opcional: sem token, o assistente usa fallback sem bloquear deploy. */
      vimeoToken: process.env.VIMEO_ACCESS_TOKEN?.trim(),
    });
  }
);

/**
 * Feedback pós-módulo (acertos/erros) — o cliente não lê `answerKeys` no Firestore (só admin/vendedor).
 */
export const getModuleCompletionFeedback = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  const uid = request.auth.uid;
  const data = request.data as { courseId?: string; moduleId?: string };
  const courseId = data.courseId?.trim();
  const moduleId = data.moduleId?.trim();
  if (!courseId || !moduleId) {
    throw new HttpsError('invalid-argument', 'courseId e moduleId são obrigatórios.');
  }

  const subSnap = await db.doc(`users/${uid}/courses/${courseId}/modules/${moduleId}`).get();
  if (!subSnap.exists || subSnap.data()?.status !== 'completed') {
    throw new HttpsError('failed-precondition', 'Módulo ainda não foi concluído.');
  }
  const answers = subSnap.data()?.answers as Record<string, number> | undefined;
  if (!answers || typeof answers !== 'object') {
    throw new HttpsError('failed-precondition', 'Respostas não encontradas.');
  }

  const keySnap = await db.doc(`answerKeys/${courseId}__${moduleId}`).get();
  if (!keySnap.exists) {
    return { hasGradedQuestions: false, correct: 0, total: 0, details: [] as Array<Record<string, unknown>> };
  }
  const rawKey = keySnap.data()?.correctByQuestionId;
  if (!rawKey || typeof rawKey !== 'object') {
    return { hasGradedQuestions: false, correct: 0, total: 0, details: [] };
  }

  const modSnap = await db.doc(`courses/${courseId}/modules/${moduleId}`).get();
  if (!modSnap.exists) {
    return { hasGradedQuestions: false, correct: 0, total: 0, details: [] };
  }
  const mod = modSnap.data() as Record<string, unknown>;

  type Q = { id: string; prompt: string; options: string[] };
  const questions: Q[] = [];
  const steps = mod.steps as unknown[] | undefined;
  if (Array.isArray(steps)) {
    for (const st of steps) {
      if (!st || typeof st !== 'object') continue;
      const o = st as Record<string, unknown>;
      if (o.kind !== 'quiz' || !Array.isArray(o.questions)) continue;
      for (const q of o.questions as Record<string, unknown>[]) {
        if (typeof q?.id === 'string' && typeof q?.prompt === 'string') {
          questions.push({
            id: q.id,
            prompt: q.prompt,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
          });
        }
      }
    }
  }
  const legacyQs = mod.questions as unknown[] | undefined;
  if (Array.isArray(legacyQs)) {
    for (const q of legacyQs) {
      if (!q || typeof q !== 'object') continue;
      const o = q as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.prompt === 'string') {
        questions.push({
          id: o.id,
          prompt: o.prompt,
          options: Array.isArray(o.options) ? (o.options as string[]) : [],
        });
      }
    }
  }

  const qById = new Map<string, Q>();
  for (const q of questions) {
    qById.set(q.id, q);
  }
  const details: Array<{
    questionId: string;
    prompt: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    correctOptionIndex: number;
    userOptionIndex: number | null;
  }> = [];
  let correct = 0;
  let total = 0;

  for (const [qid, correctIdx] of Object.entries(rawKey as Record<string, unknown>)) {
    if (typeof correctIdx !== 'number') continue;
    const q = qById.get(qid);
    if (!q) continue;
    total++;
    const userIdx = answers[qid];
    const isCorrect = typeof userIdx === 'number' && userIdx === correctIdx;
    if (isCorrect) correct++;
    details.push({
      questionId: qid,
      prompt: q.prompt,
      userAnswer: typeof userIdx === 'number' ? (q.options[userIdx] ?? '—') : '—',
      correctAnswer: q.options[correctIdx] ?? '—',
      isCorrect,
      correctOptionIndex: correctIdx,
      userOptionIndex: typeof userIdx === 'number' ? userIdx : null,
    });
  }

  return {
    hasGradedQuestions: total > 0,
    correct,
    total,
    details,
  };
});

export const vendedorAcceptConfidentiality = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  const uid = request.auth.uid;
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.role !== 'vendedor') {
    throw new HttpsError('permission-denied', 'Apenas vendedores.');
  }
  const version = (request.data as { version?: string })?.version?.trim() ?? '';
  if (version !== LEGAL_VERSIONS.vendorConfidentiality) {
    throw new HttpsError(
      'invalid-argument',
      'Versão do termo de confidencialidade inválida ou desatualizada. Atualize a página e tente novamente.'
    );
  }
  await db.doc(`users/${uid}`).update({
    vendorConfidentiality: {
      version,
      acceptedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/**
 * Exclusão de conta pelo próprio utilizador (LGPD): apaga documento `users/{uid}`,
 * subcoleções (cursos, certificados) e o utilizador no Firebase Auth. Não disponível para `admin`.
 */
export const deleteMyAccount = onCall(callableHttp, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }
  const uid = request.auth.uid;
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Conta não encontrada.');
  }
  const role = snap.data()?.role;
  if (role === 'admin') {
    throw new HttpsError(
      'permission-denied',
      'Contas de administrador não podem ser excluídas por aqui. Contacte o suporte técnico.'
    );
  }
  await deleteUserData(uid);
  return { ok: true };
});
