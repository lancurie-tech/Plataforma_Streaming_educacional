/** Chave versionada para permitir futuras migrações sem misturar valores antigos. */
export const ANALYTICS_CONSENT_STORAGE_KEY = 'medivox.consent.analytics.v1';

export type AnalyticsConsentValue = 'granted' | 'denied';

export function readAnalyticsConsent(): AnalyticsConsentValue | null {
  try {
    const v = localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (v === 'granted' || v === 'denied') return v;
    return null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(value: AnalyticsConsentValue): void {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    /* modo privado / storage cheio */
  }
}

export const ANALYTICS_CONSENT_CHANGED_EVENT = 'medivox-analytics-consent-changed';
