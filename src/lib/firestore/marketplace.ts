import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  COMMERCIAL_MODULE_IDS,
  type CommercialModuleId,
} from '@/lib/modules/commercialEntitlements';
import type {
  CatalogModuleDoc,
  MarketplaceRequestDoc,
  MarketplaceRequestStatus,
} from '@/types';
import { getTenantEntitlements } from '@/lib/firestore/tenancy';

const COMM_SET = new Set<string>(COMMERCIAL_MODULE_IDS);

const CATALOG_MODULES = collection(db, 'catalog', 'platform', 'modules');

function parseCatalogModule(d: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): CatalogModuleDoc {
  const x = d.data() ?? {};
  const statusRaw = x.status as string | undefined;
  const status =
    statusRaw === 'hidden' || statusRaw === 'beta' || statusRaw === 'active'
      ? statusRaw
      : 'hidden';
  return {
    id: d.id,
    title: typeof x.title === 'string' && x.title ? x.title : d.id,
    description: typeof x.description === 'string' ? x.description : undefined,
    commercialModuleId:
      typeof x.commercialModuleId === 'string' && x.commercialModuleId
        ? x.commercialModuleId
        : d.id,
    status,
  };
}

function parseMarketplaceRequest(d: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): MarketplaceRequestDoc {
  const x = d.data() ?? {};
  const status = x.status as MarketplaceRequestStatus | undefined;
  const safeStatus =
    status === 'pending' ||
    status === 'approved' ||
    status === 'rejected' ||
    status === 'archived'
      ? status
      : 'archived';

  const createdRaw = x.createdAt as { toDate?: () => Date } | undefined;
  const updatedRaw = x.updatedAt as { toDate?: () => Date } | undefined;
  const handledRaw = x.handledAt as { toDate?: () => Date } | undefined;

  return {
    id: d.id,
    tenantId: (x.tenantId as string) ?? '',
    tenantDisplayName:
      typeof x.tenantDisplayName === 'string' ? x.tenantDisplayName : null,
    moduleId: (x.moduleId as string) ?? '',
    commercialModuleId: (x.commercialModuleId as string) ?? '',
    message: typeof x.message === 'string' ? x.message : null,
    status: safeStatus,
    createdAt: createdRaw?.toDate?.(),
    updatedAt: updatedRaw?.toDate?.(),
    requestedByUid: typeof x.requestedByUid === 'string' ? x.requestedByUid : null,
    requestedByEmail: typeof x.requestedByEmail === 'string' ? x.requestedByEmail : null,
    handledByUid: typeof x.handledByUid === 'string' ? x.handledByUid : null,
    handledAt: handledRaw?.toDate?.(),
  };
}

export async function listCatalogModules(): Promise<CatalogModuleDoc[]> {
  const snap = await getDocs(CATALOG_MODULES);
  return snap.docs
    .map((d) =>
      parseCatalogModule(d as unknown as { id: string; data: () => Record<string, unknown> })
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'pt', { sensitivity: 'base' }));
}

export async function listPendingMarketplaceRequests(): Promise<MarketplaceRequestDoc[]> {
  const q = query(
    collection(db, 'marketplaceRequests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    parseMarketplaceRequest(d as unknown as { id: string; data: () => Record<string, unknown> })
  );
}

export async function listMarketplaceRequestsForTenant(
  tenantId: string
): Promise<MarketplaceRequestDoc[]> {
  const q = query(
    collection(db, 'marketplaceRequests'),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    parseMarketplaceRequest(d as unknown as { id: string; data: () => Record<string, unknown> })
  );
}

export async function createMarketplaceRequest(params: {
  tenantId: string;
  tenantDisplayName?: string | null;
  moduleId: string;
  commercialModuleId: string;
  message?: string | null;
  requestedByUid: string;
  requestedByEmail?: string | null;
}): Promise<string> {
  if (params.moduleId !== params.commercialModuleId) {
    throw new Error('moduleId e commercialModuleId devem coincidir.');
  }
  if (!COMM_SET.has(params.commercialModuleId)) {
    throw new Error('Módulo comercial inválido.');
  }
  const ref = await addDoc(collection(db, 'marketplaceRequests'), {
    tenantId: params.tenantId,
    tenantDisplayName: params.tenantDisplayName ?? null,
    moduleId: params.moduleId,
    commercialModuleId: params.commercialModuleId,
    message: params.message?.trim() ? params.message.trim() : null,
    status: 'pending',
    requestedByUid: params.requestedByUid,
    requestedByEmail: params.requestedByEmail ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function approveMarketplaceRequest(
  requestId: string,
  handledByUid: string
): Promise<void> {
  const ref = doc(db, 'marketplaceRequests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Pedido não encontrado.');
  const data = snap.data() as Record<string, unknown>;
  if (data.status !== 'pending') throw new Error('Este pedido já foi tratado.');

  const tenantId = data.tenantId as string | undefined;
  const commercialModuleId = data.commercialModuleId as string | undefined;
  if (!tenantId || !commercialModuleId || !COMM_SET.has(commercialModuleId)) {
    throw new Error('Dados do pedido inválidos.');
  }

  const ent = await getTenantEntitlements(tenantId);
  if (!ent) throw new Error('Entitlements deste tenant não foram encontrados.');

  const mod = commercialModuleId as CommercialModuleId;
  const nextModules = [...new Set([...ent.enabledModuleIds, mod])];

  const entRef = doc(db, 'tenants', tenantId, 'entitlements', 'current');
  const batch = writeBatch(db);
  batch.set(
    entRef,
    {
      tenantId,
      planId: ent.planId,
      enabledModuleIds: nextModules,
      limits: ent.limits,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  batch.update(ref, {
    status: 'approved',
    handledByUid,
    handledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setMarketplaceRequestOutcome(
  requestId: string,
  status: 'rejected' | 'archived',
  handledByUid: string
): Promise<void> {
  const ref = doc(db, 'marketplaceRequests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Pedido não encontrado.');
  const data = snap.data() as Record<string, unknown>;
  if (data.status !== 'pending') throw new Error('Só é possível tratar pedidos pendentes.');
  await updateDoc(ref, {
    status,
    handledByUid,
    handledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
