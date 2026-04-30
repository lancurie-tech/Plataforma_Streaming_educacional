import type { Timestamp } from 'firebase/firestore';

export function expiresAtFromAssignmentData(data: Record<string, unknown>): Date | null {
  const ex = data.expiresAt;
  if (ex == null || ex === undefined) return null;
  const ts = ex as Timestamp;
  if (typeof ts.toDate === 'function') return ts.toDate();
  return null;
}

/** Sem campo `expiresAt` ou data futura → acesso liberado. */
export function isAssignmentActive(data: Record<string, unknown>, atMs = Date.now()): boolean {
  const end = expiresAtFromAssignmentData(data);
  if (end === null) return true;
  return end.getTime() > atMs;
}

export function formatAccessRemaining(expiresAt: Date | null): {
  shortLabel: string;
  urgent: boolean;
  expired: boolean;
} {
  if (expiresAt === null) {
    return { shortLabel: 'Acesso ilimitado', urgent: false, expired: false };
  }
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) {
    return { shortLabel: 'Acesso encerrado', urgent: false, expired: true };
  }
  const days = Math.ceil(ms / 86_400_000);
  const dateStr = expiresAt.toLocaleDateString('pt-BR');
  if (days <= 7) {
    return {
      shortLabel: days <= 1 ? `Expira em menos de 24h (${dateStr})` : `Restam ${days} dia(s) · ${dateStr}`,
      urgent: true,
      expired: false,
    };
  }
  return {
    shortLabel: `Expira em ${dateStr} (${days} dias)`,
    urgent: false,
    expired: false,
  };
}
