/**
 * Seed Fase 1 (multi-tenant minimo):
 * - plans/{planId}
 * - tenants/{tenantId}
 * - tenants/{tenantId}/entitlements/current
 * - tenantPilotData/{docId}
 *
 * Uso:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
 *   npm run seed:fase1-tenants
 */

import { existsSync, readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !existsSync(keyPath)) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS com o JSON de service account.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

const plans = [
  {
    id: 'essencial',
    displayName: 'Essencial',
    active: true,
    limits: {
      maxActiveUsers: 150,
      maxStorageGb: 80,
      maxPublishedVideoHours: 200,
      maxLiveStreamsPerMonth: 4,
      maxActiveCourses: 30,
      maxEnabledModules: 6,
    },
    /** Tokens comerciais: streaming | cursos | chat | vendedores */
    includedModuleIds: ['cursos'],
  },
  {
    id: 'profissional',
    displayName: 'Profissional',
    active: true,
    limits: {
      maxActiveUsers: 800,
      maxStorageGb: 400,
      maxPublishedVideoHours: 1200,
      maxLiveStreamsPerMonth: 20,
      maxActiveCourses: 150,
      maxEnabledModules: 10,
    },
    includedModuleIds: ['cursos', 'streaming', 'chat', 'vendedores'],
  },
];

const tenants = [
  {
    id: 'seed_empresa_alpha',
    displayName: 'Empresa Alpha (tenant)',
    planId: 'essencial',
    status: 'active',
    contacts: ['ops+alpha@example.com'],
    enabledModuleIds: ['cursos'],
  },
  {
    id: 'seed_empresa_beta',
    displayName: 'Empresa Beta (tenant)',
    planId: 'profissional',
    status: 'active',
    contacts: ['ops+beta@example.com'],
    enabledModuleIds: ['cursos', 'streaming', 'chat', 'vendedores'],
  },
];

async function main() {
  for (const plan of plans) {
    await db
      .collection('plans')
      .doc(plan.id)
      .set(
        {
          displayName: plan.displayName,
          active: plan.active,
          limits: plan.limits,
          includedModuleIds: plan.includedModuleIds,
          createdAt: ts(),
          updatedAt: ts(),
          seededByScript: true,
        },
        { merge: true }
      );
  }

  for (const tenant of tenants) {
    const plan = plans.find((x) => x.id === tenant.planId);
    if (!plan) throw new Error(`Plano ausente para tenant ${tenant.id}`);

    await db
      .collection('tenants')
      .doc(tenant.id)
      .set(
        {
          displayName: tenant.displayName,
          planId: tenant.planId,
          status: tenant.status,
          contacts: tenant.contacts,
          createdAt: ts(),
          updatedAt: ts(),
          seededByScript: true,
        },
        { merge: true }
      );

    await db
      .collection('tenants')
      .doc(tenant.id)
      .collection('entitlements')
      .doc('current')
      .set(
        {
          tenantId: tenant.id,
          planId: tenant.planId,
          enabledModuleIds: tenant.enabledModuleIds,
          limits: plan.limits,
          updatedAt: ts(),
          seededByScript: true,
        },
        { merge: true }
      );

    await db
      .collection('tenantPilotData')
      .doc(`${tenant.id}_hello`)
      .set(
        {
          tenantId: tenant.id,
          label: `registro piloto ${tenant.id}`,
          createdAt: ts(),
          updatedAt: ts(),
          seededByScript: true,
        },
        { merge: true }
      );
  }

  console.log('OK - Seed Fase 1 aplicado: plans, tenants, entitlements e tenantPilotData.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
