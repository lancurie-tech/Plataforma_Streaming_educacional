/** Duplicado mínimo (sem dep. extra) das regras de data em src/lib/billing. */
export const DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD = 5;

export function utcTodayYMD(): string {
  const dt = new Date();
  const y = dt.getUTCFullYear();
  const mIndex = dt.getUTCMonth();
  const d = dt.getUTCDate();
  return formatYMD(y, mIndex, d);
}

function formatYMD(y: number, mIndex0: number, d: number): string {
  const mm = String(mIndex0 + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function parseInclusiveDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ts = Date.UTC(y, mo - 1, d);
  const check = new Date(ts);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function addUtcCalendarDaysFromInclusive(iso: string, deltaDays: number): string | null {
  const p = parseInclusiveDate(iso);
  if (!p) return null;
  const anchor = Date.UTC(p.y, p.m - 1, p.d) + deltaDays * 86_400_000;
  const dt = new Date(anchor);
  return formatYMD(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

/** Primeiro dia UTC em que bloqueio automático deve aplicar-se. */
export function firstUtcBlockedBillingDay(
  billingPaidThroughInclusive: string | null | undefined,
  graceDaysAfterPaidThrough = DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD,
): string | null {
  const raw = (billingPaidThroughInclusive ?? '').trim();
  if (!raw) return null;
  if (!parseInclusiveDate(raw)) return null;
  return addUtcCalendarDaysFromInclusive(raw, graceDaysAfterPaidThrough + 1);
}

export function isPastBillingGraceInclusive(
  billingPaidThroughInclusive: string | null | undefined,
  graceDaysAfterPaidThrough = DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD,
): boolean {
  const blockStart = firstUtcBlockedBillingDay(billingPaidThroughInclusive, graceDaysAfterPaidThrough);
  if (!blockStart) return false;
  return utcTodayYMD() >= blockStart;
}
