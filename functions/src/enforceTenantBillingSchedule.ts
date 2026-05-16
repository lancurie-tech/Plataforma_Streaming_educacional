import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD,
  firstUtcBlockedBillingDay,
  isPastBillingGraceInclusive,
} from './billingUtc.js';

const db = getFirestore();

function resolveGraceDays(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.trunc(raw));
  return DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD;
}

async function mirrorTenantToPublicSlug(opts: {
  tenantId: string;
  slug: string;
  displayName: string;
  enabledModuleIds: string[];
  status: string;
}): Promise<void> {
  await db.doc(`tenantPublicSlugs/${opts.slug}`).set(
    {
      tenantId: opts.tenantId,
      displayName: opts.displayName,
      enabledModuleIds: opts.enabledModuleIds,
      status: opts.status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Diário: tenants com período válido registado cuja tolerância pós‑vencimento expirou
 * passam `suspended` com `billingSuspendedForPayment`; sincroniza `tenantPublicSlugs`.
 *
 * Ignora tenants já suspensos por motivos manuais (`billingSuspendedForPayment` falsy + status suspended).
 */
export const enforceTenantBillingSchedule = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: 'Europe/Lisbon',
    region: 'southamerica-east1',
  },
  async () => {
    const snap = await db.collection('tenants').get();

    for (const docSnap of snap.docs) {
      const id = docSnap.id;
      const d = docSnap.data();
      const status = typeof d.status === 'string' ? d.status : 'active';

      if (status === 'suspended' && d.billingSuspendedForPayment !== true) {
        continue;
      }

      const paidThrough =
        typeof d.billingPaidThroughInclusive === 'string' ? d.billingPaidThroughInclusive.trim() : '';
      if (!paidThrough) continue;

      const grace = resolveGraceDays(d.billingGraceDays);
      const blockDay = firstUtcBlockedBillingDay(paidThrough, grace);
      const shouldSuspend = blockDay !== null && isPastBillingGraceInclusive(paidThrough, grace);

      if (!shouldSuspend) continue;
      if (status === 'suspended' && d.billingSuspendedForPayment === true) continue;

      let entIds: string[] = [];
      const entSnap = await db.doc(`tenants/${id}/entitlements/current`).get();
      if (entSnap.exists) {
        const x = entSnap.data()!;
        entIds = Array.isArray(x.enabledModuleIds)
          ? (x.enabledModuleIds as unknown[]).filter((z) => typeof z === 'string')
          : [];
      }

      const displayName =
        typeof d.displayName === 'string' && d.displayName.trim() ? d.displayName.trim() : id;
      const slugRaw =
        typeof d.publicSlug === 'string' && d.publicSlug.trim()
          ? d.publicSlug.trim().toLowerCase()
          : '';

      await db.doc(`tenants/${id}`).update({
        status: 'suspended',
        billingSuspendedForPayment: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (slugRaw) {
        await mirrorTenantToPublicSlug({
          tenantId: id,
          slug: slugRaw,
          displayName,
          enabledModuleIds: entIds,
          status: 'suspended',
        });
      }
    }
  },
);
