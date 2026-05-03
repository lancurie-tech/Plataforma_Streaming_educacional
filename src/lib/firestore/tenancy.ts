import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { PlanDoc, TenantDoc, TenantEntitlements } from '@/types';

function parseTenantDoc(
  d: { id: string; data: () => Record<string, unknown> | undefined }
): TenantDoc {
  const x = d.data() ?? {};
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
    createdAt: (x.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    updatedAt: (x.updatedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

function parsePlanDoc(d: { id: string; data: () => Record<string, unknown> | undefined }): PlanDoc {
  const x = d.data() ?? {};
  return {
    id: d.id,
    displayName: (x.displayName as string) ?? d.id,
    active: x.active !== false,
    limits: (x.limits as Record<string, number>) ?? {},
    includedModuleIds: Array.isArray(x.includedModuleIds)
      ? (x.includedModuleIds as string[])
      : undefined,
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

export async function upsertPlan(
  planId: string,
  payload: Omit<PlanDoc, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await setDoc(
    doc(db, 'plans', planId),
    {
      displayName: payload.displayName,
      active: payload.active,
      limits: payload.limits,
      includedModuleIds: payload.includedModuleIds ?? [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
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
