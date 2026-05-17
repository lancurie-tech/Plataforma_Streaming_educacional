/** Dias de tolerância após o último dia válido inclusivo antes do bloqueio automático por faturação. */
export const DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD = 5;

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

function formatYMD(y: number, mIndex0: number, d: number): string {
  const mm = String(mIndex0 + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function utcDaysInMonth(y: number, mIndex0: number): number {
  return new Date(Date.UTC(y, mIndex0 + 1, 0)).getUTCDate();
}

/** Adiciona dias corridos UTC a uma data YYYY-MM-DD (início do dia UTC). */
export function addUtcCalendarDaysFromInclusive(iso: string, deltaDays: number): string | null {
  const p = parseInclusiveDate(iso);
  if (!p) return null;
  const anchor = Date.UTC(p.y, p.m - 1, p.d) + deltaDays * 86_400_000;
  const dt = new Date(anchor);
  return formatYMD(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

/** Primeiro dia (UTC YYYY-MM-DD) em que o acesso deve ser bloqueado: paidThroughInclusive + GRACE_DAYS + 1. */
export function firstUtcBlockedBillingDay(
  billingPaidThroughInclusive: string | null | undefined,
  graceDaysAfterPaidThrough = DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD,
): string | null {
  const raw = (billingPaidThroughInclusive ?? '').trim();
  if (!raw) return null;
  const p = parseInclusiveDate(raw);
  if (!p) return null;
  return addUtcCalendarDaysFromInclusive(raw, graceDaysAfterPaidThrough + 1);
}

/** YYYY-MM-DD de hoje em UTC para comparações com primeiro dia de bloqueio. */
export function utcTodayYMD(): string {
  const dt = new Date();
  return formatYMD(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

/** `true` se hoje UTC >= primeiro dia bloqueado. */
export function isPastBillingGraceInclusive(
  billingPaidThroughInclusive: string | null | undefined,
  graceDaysAfterPaidThrough = DEFAULT_BILLING_GRACE_AFTER_PAID_PERIOD,
): boolean {
  const blockStart = firstUtcBlockedBillingDay(billingPaidThroughInclusive, graceDaysAfterPaidThrough);
  if (!blockStart) return false;
  const today = utcTodayYMD();
  return today >= blockStart;
}

/** Adiciona meses preservando dia (clamp ao último dia do mês UTC). */
export function addUtcCalendarMonthsInclusive(iso: string, deltaMonths: number): string | null {
  const p = parseInclusiveDate(iso);
  if (!p) return null;
  const base = Date.UTC(p.y, p.m - 1 + deltaMonths, 1);
  const dn = new Date(base);
  const wy = dn.getUTCFullYear();
  const wmi = dn.getUTCMonth();
  const dim = utcDaysInMonth(wy, wmi);
  const day = Math.min(p.d, dim);
  return formatYMD(wy, wmi, day);
}

export function todayInclusiveYMDLocal(): string {
  const dt = new Date();
  const y = dt.getFullYear();
  const mo = dt.getMonth();
  const d = dt.getDate();
  return formatYMD(y, mo, d);
}
