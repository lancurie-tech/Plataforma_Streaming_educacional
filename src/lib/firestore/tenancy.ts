import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { PlanDoc, TenantBillingCycle, TenantDoc, TenantEntitlements } from '@/types';
import { syncTenantPublicSlugDoc } from '@/lib/firestore/tenantPublicSlug';

function parseTenantDoc(
  d: { id: string; data: () => Record<string, unknown> | undefined }
): TenantDoc {
  const x = d.data() ?? {};

  let billingCycle: TenantBillingCycle | null | undefined;
  const bcRaw = typeof x.billingCycle === 'string' ? x.billingCycle.trim().toLowerCase() : '';
  if (bcRaw === 'monthly' || bcRaw === 'annual') billingCycle = bcRaw;
  else billingCycle = undefined;

  let billingPaidThroughInclusive: string | null | undefined;
  if (
    typeof x.billingPaidThroughInclusive === 'string' &&
    /^(\d{4})-(\d{2})-(\d{2})$/.test(x.billingPaidThroughInclusive.trim())
  ) {
    billingPaidThroughInclusive = x.billingPaidThroughInclusive.trim();
  } else if (x.billingPaidThroughInclusive === null) billingPaidThroughInclusive = null;

  let billingSuspendedForPayment = false;
  if (typeof x.billingSuspendedForPayment === 'boolean') billingSuspendedForPayment = x.billingSuspendedForPayment;
  else if (x.billingSuspendedForPayment === null) billingSuspendedForPayment = false;

  let billingGraceDays: number | null | undefined;
  const gRaw = x.billingGraceDays;
  if (typeof gRaw === 'number' && Number.isFinite(gRaw))
    billingGraceDays = Math.max(0, Math.trunc(gRaw));
  else if (gRaw === null) billingGraceDays = null;

  return {
    id: d.id,
    displayName: (x.displayName as string) ?? d.id,
    planId: (x.planId as string) ?? 'essencial',
    status: (x.status as TenantDoc['status']) ?? 'active',
    contacts: Array.isArray(x.contacts) ? (x.contacts as string[]) : undefined,
    publicSlug:
      typeof x.publicSlug === 'string' && x.publicSlug.trim()
        ? x.publicSlug.trim().toLowerCase()
        : undefined,
    firstAdministratorName:
      typeof x.firstAdministratorName === 'string' && x.firstAdministratorName.trim()
        ? x.firstAdministratorName.trim()
        : undefined,
    firstAdministratorEmail:
      typeof x.firstAdministratorEmail === 'string' && x.firstAdministratorEmail.trim()
        ? x.firstAdministratorEmail.trim().toLowerCase()
        : undefined,
    firstAdministratorUid:
      typeof x.firstAdministratorUid === 'string' && x.firstAdministratorUid.trim()
        ? x.firstAdministratorUid.trim()
        : undefined,
    firstAdministratorInvitedAt: (x.firstAdministratorInvitedAt as { toDate?: () => Date })?.toDate?.(),
    billingCycle,
    billingPaidThroughInclusive,
    billingSuspendedForPayment,
    billingInternalNote:
      typeof x.billingInternalNote === 'string'
        ? x.billingInternalNote
        : x.billingInternalNote === null
          ? null
          : undefined,
    billingGraceDays,
    billingLastUpdatedAt: (x.billingLastUpdatedAt as { toDate?: () => Date })?.toDate?.(),
    createdAt: (x.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (x.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

async function syncTenantPublicSlugFromTenantSnapshot(tenantId: string): Promise<void> {
  const t = await getTenant(tenantId);
  if (!t) return;
  const ent = await getTenantEntitlements(tenantId);
  await syncTenantPublicSlugDoc({
    tenantId,
    previousSlug: t.publicSlug ?? null,
    nextSlug: t.publicSlug ?? null,
    displayName: t.displayName,
    enabledModuleIds: ent?.enabledModuleIds ?? [],
    status: t.status,
  });
}

export async function patchTenantBilling(
  tenantId: string,
  patch: {
    billingCycle?: TenantBillingCycle | null;
    billingPaidThroughInclusive?: string | null | undefined;
    billingInternalNote?: string | null | undefined;
    billingGraceDays?: number | null;
    billingSuspendedForPayment?: boolean | null;
    /** Reativa org e limpa marca de bloqueio por faturação ao gravar período válido ou manualmente. */
    activateOrganization?: boolean;
  },
): Promise<void> {
  const ref = doc(db, 'tenants', tenantId);
  const next: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    billingLastUpdatedAt: serverTimestamp(),
  };

  if (patch.billingCycle !== undefined) {
    if (patch.billingCycle === null) next.billingCycle = null;
    else next.billingCycle = patch.billingCycle;
  }
  if (patch.billingPaidThroughInclusive !== undefined) {
    if (patch.billingPaidThroughInclusive === null) next.billingPaidThroughInclusive = null;
    else next.billingPaidThroughInclusive = patch.billingPaidThroughInclusive.trim();
  }
  if (patch.billingInternalNote !== undefined) {
    next.billingInternalNote = patch.billingInternalNote ?? null;
  }
  if (patch.billingGraceDays !== undefined) next.billingGraceDays = patch.billingGraceDays;
  if (patch.billingSuspendedForPayment !== undefined) {
    next.billingSuspendedForPayment = patch.billingSuspendedForPayment;
  }
  if (patch.activateOrganization) {
    next.status = 'active';
    next.billingSuspendedForPayment = false;
  }

  await updateDoc(ref, next);
  await syncTenantPublicSlugFromTenantSnapshot(tenantId);
}

function parsePlanDoc(d: { id: string; data: () => Record<string, unknown> | undefined }): PlanDoc {
  const x = d.data() ?? {};
  const priceRaw = x.monthlyPriceEUR;
  let monthlyPriceEUR: number | null | undefined = undefined;
  if (priceRaw === null) monthlyPriceEUR = null;
  else if (typeof priceRaw === 'number' && Number.isFinite(priceRaw)) monthlyPriceEUR = priceRaw;
  const noteRaw = x.billingNote;
  let billingNote: string | null | undefined = undefined;
  if (noteRaw === null) billingNote = null;
  else if (typeof noteRaw === 'string' && noteRaw.trim()) billingNote = noteRaw.trim();
  return {
    id: d.id,
    displayName: (x.displayName as string) ?? d.id,
    active: x.active !== false,
    limits: (x.limits as Record<string, number>) ?? {},
    includedModuleIds: Array.isArray(x.includedModuleIds)
      ? (x.includedModuleIds as string[])
      : undefined,
    monthlyPriceEUR,
    billingNote,
    createdAt: (x.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (x.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export async function getTenant(tenantId: string): Promise<TenantDoc | null> {
  const snap = await getDoc(doc(db, 'tenants', tenantId));
  if (!snap.exists()) return null;
  return parseTenantDoc(snap as unknown as { id: string; data: () => Record<string, unknown> });
}

export async function listTenants(): Promise<TenantDoc[]> {
  const snap = await getDocs(collection(db, 'tenants'));
  return snap.docs
    .map((d) =>
      parseTenantDoc(d as unknown as { id: string; data: () => Record<string, unknown> })
    )
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt', { sensitivity: 'base' })
    );
}

export async function getPlan(planId: string): Promise<PlanDoc | null> {
  const snap = await getDoc(doc(db, 'plans', planId));
  if (!snap.exists()) return null;
  return parsePlanDoc(snap as unknown as { id: string; data: () => Record<string, unknown> });
}

export async function listPlans(): Promise<PlanDoc[]> {
  const snap = await getDocs(collection(db, 'plans'));
  return snap.docs.map((d) =>
    parsePlanDoc(d as unknown as { id: string; data: () => Record<string, unknown> })
  );
}

export async function getTenantEntitlements(
  tenantId: string
): Promise<TenantEntitlements | null> {
  const snap = await getDoc(doc(db, 'tenants', tenantId, 'entitlements', 'current'));
  if (!snap.exists()) return null;
  const x = snap.data();
  return {
    tenantId,
    planId: (x.planId as string) ?? 'essencial',
    enabledModuleIds: Array.isArray(x.enabledModuleIds) ? (x.enabledModuleIds as string[]) : [],
    limits: (x.limits as Record<string, number>) ?? {},
    updatedAt: (x.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

/** Atualiza só `status` e `updatedAt` (ex.: desativar rápido no master sem validar o restante formulário). */
export async function patchTenantStatus(tenantId: string, status: TenantDoc['status']): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Resumo de um admin cliente (`role === 'admin'`) associado ao tenant (consola Master). */
export type TenantScopedAdminSummary = {
  uid: string;
  name: string;
  email: string;
  createdMs: number;
};

function ingestAdminUserDocsIntoMap(
  rows: Map<string, TenantScopedAdminSummary>,
  docs: QueryDocumentSnapshot<DocumentData>[],
): void {
  for (const userDoc of docs) {
    const x = userDoc.data();
    if (x.role !== 'admin') continue;
    const email = typeof x.email === 'string' ? x.email.trim().toLowerCase() : '';
    if (!email) continue;
    const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim() : email;
    const createdAtField = x.createdAt as { toDate?: () => Date } | undefined;
    const createdMs = createdAtField?.toDate?.()?.getTime() ?? Number.MAX_SAFE_INTEGER;
    rows.set(userDoc.id, { uid: userDoc.id, name, email, createdMs });
  }
}

/**
 * Administradores cliente ligados a `tenantId`: `users.tenantId` igual ao tenant OU `users.companyId`
 * igual a empresa com `companies.tenantId` (alinhado a `resolveTenantIdFromProfile` na app).
 */
export async function listTenantScopedAdminSummaries(tenantId: string): Promise<TenantScopedAdminSummary[]> {
  const rows = new Map<string, TenantScopedAdminSummary>();
  const byTidSnap = await getDocs(query(collection(db, 'users'), where('tenantId', '==', tenantId)));
  ingestAdminUserDocsIntoMap(rows, byTidSnap.docs);

  const companiesSnap = await getDocs(query(collection(db, 'companies'), where('tenantId', '==', tenantId)));
  await Promise.all(
    companiesSnap.docs.map(async (cDoc) => {
      const snap = await getDocs(query(collection(db, 'users'), where('companyId', '==', cDoc.id)));
      ingestAdminUserDocsIntoMap(rows, snap.docs);
    }),
  );

  return Array.from(rows.values()).sort((a, b) => a.createdMs - b.createdMs);
}

/** Compatível com dados antigos: perfil mais antigo com papel admin ligado ao tenant. */
export async function getOldestTenantAdminProfile(
  tenantId: string
): Promise<{ name: string; email: string } | null> {
  const list = await listTenantScopedAdminSummaries(tenantId);
  const best = list[0];
  return best ? { name: best.name, email: best.email } : null;
}

export async function upsertTenant(
  tenantId: string,
  payload: Pick<TenantDoc, 'displayName' | 'planId' | 'status'> & {
    contacts?: string[];
    publicSlug?: string | null;
  }
): Promise<void> {
  const data: Record<string, unknown> = {
    displayName: payload.displayName,
    planId: payload.planId,
    status: payload.status,
    contacts: payload.contacts ?? [],
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  if (payload.publicSlug === null) {
    data.publicSlug = null;
  } else if (typeof payload.publicSlug === 'string' && payload.publicSlug.trim()) {
    data.publicSlug = payload.publicSlug.trim().toLowerCase();
  }
  await setDoc(doc(db, 'tenants', tenantId), data, { merge: true });
}

export async function upsertTenantEntitlements(
  tenantId: string,
  payload: Pick<TenantEntitlements, 'planId' | 'enabledModuleIds' | 'limits'>
): Promise<void> {
  await setDoc(
    doc(db, 'tenants', tenantId, 'entitlements', 'current'),
    {
      tenantId,
      planId: payload.planId,
      enabledModuleIds: payload.enabledModuleIds,
      limits: payload.limits,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updatePlanMaster(
  planId: string,
  payload: Omit<PlanDoc, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const ref = doc(db, 'plans', planId);
  const snap = await getDoc(ref);

  const price =
    typeof payload.monthlyPriceEUR === 'number' && Number.isFinite(payload.monthlyPriceEUR)
      ? payload.monthlyPriceEUR
      : null;

  const note =
    typeof payload.billingNote === 'string' && payload.billingNote.trim()
      ? payload.billingNote.trim()
      : null;

  const patch: Record<string, unknown> = {
    displayName: payload.displayName.trim() ? payload.displayName.trim() : planId,
    active: !!payload.active,
    limits: payload.limits,
    includedModuleIds: Array.isArray(payload.includedModuleIds) ? payload.includedModuleIds : [],
    monthlyPriceEUR: price,
    billingNote: note,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    patch.createdAt = serverTimestamp();
  }

  await setDoc(ref, patch, { merge: true });
}

/** Legado/nome anterior — igual a {@link updatePlanMaster}. */
export async function upsertPlan(
  planId: string,
  payload: Omit<PlanDoc, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  return updatePlanMaster(planId, payload);
}

/** Mesma lógica que `AuthProvider`: `tenantId` com fallback a `companyId`. */
export function resolveTenantIdFromProfile(
  profile: { tenantId?: string | null; companyId?: string | null } | null | undefined
): string | null {
  if (!profile) return null;
  if (typeof profile.tenantId === 'string' && profile.tenantId) return profile.tenantId;
  if (typeof profile.companyId === 'string' && profile.companyId) return profile.companyId;
  return null;
}

export type TenantPilotRecord = {
  id: string;
  tenantId: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function listTenantPilotRecords(tenantId: string): Promise<TenantPilotRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'tenantPilotData'), where('tenantId', '==', tenantId))
  );
  return snap.docs.map((d): TenantPilotRecord => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      tenantId: x.tenantId as string,
      label: typeof x.label === 'string' ? x.label : '',
      createdAt: (x.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
      updatedAt: (x.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    };
  });
}

export async function upsertTenantPilotRecord(
  recordId: string,
  tenantId: string,
  label: string
): Promise<void> {
  await setDoc(
    doc(db, 'tenantPilotData', recordId),
    {
      tenantId,
      label,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
